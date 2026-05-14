"""Tests for the token_budget service."""
import json
import os
from unittest.mock import MagicMock, patch

import pytest
import services.token_budget as tb


class TestMaxTokensForEndpoint:
    """Test max_tokens_for_endpoint resolution."""

    def test_known_endpoint_returns_configured_limit(self):
        assert tb.max_tokens_for_endpoint('chat') == 20_000
        assert tb.max_tokens_for_endpoint('quiz') == 12_000
        assert tb.max_tokens_for_endpoint('image') == 2_000
        assert tb.max_tokens_for_endpoint('study_materials') == 8_000
        assert tb.max_tokens_for_endpoint('flashcards') == 6_000
        assert tb.max_tokens_for_endpoint('chat_web_search') == 4_000
        assert tb.max_tokens_for_endpoint('chat_exam') == 10_000

    def test_unknown_endpoint_returns_default(self):
        assert tb.max_tokens_for_endpoint('nonexistent') == 6_000

    def test_override_below_ceiling_is_respected(self):
        # Requesting fewer tokens than ceiling → use override
        assert tb.max_tokens_for_endpoint('quiz', override=5_000) == 5_000

    def test_override_above_ceiling_is_capped(self):
        # Requesting more tokens than ceiling → use ceiling
        assert tb.max_tokens_for_endpoint('image', override=10_000) == 2_000

    def test_override_none_uses_default(self):
        assert tb.max_tokens_for_endpoint('chat', override=None) == 20_000

    def test_override_zero_uses_default(self):
        assert tb.max_tokens_for_endpoint('chat', override=0) == 20_000

    def test_absolute_max_caps_all(self):
        """Even the highest endpoint limit cannot exceed ABSOLUTE_MAX_TOKENS."""
        original = tb.ABSOLUTE_MAX_TOKENS
        tb.ABSOLUTE_MAX_TOKENS = 1_000
        try:
            assert tb.max_tokens_for_endpoint('quiz') == 1_000
        finally:
            tb.ABSOLUTE_MAX_TOKENS = original


class TestDailyBudget:
    """Test daily cost budget checking."""

    def setup_method(self):
        """Reset module state between tests."""
        tb._redis = None
        tb._mem_usage.clear()

    def test_no_budget_always_allows(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop('DAILY_COST_BUDGET_USD', None)
            assert tb.check_daily_budget() is True

    def test_zero_budget_always_allows(self):
        with patch.dict(os.environ, {'DAILY_COST_BUDGET_USD': '0'}):
            assert tb.check_daily_budget() is True

    def test_budget_allows_when_under(self):
        with patch.dict(os.environ, {'DAILY_COST_BUDGET_USD': '5.00'}):
            tb.record_usage('model', 100, 50, 1.00, 'chat')
            assert tb.check_daily_budget() is True

    def test_budget_blocks_when_exceeded(self):
        with patch.dict(os.environ, {'DAILY_COST_BUDGET_USD': '1.00'}):
            tb.record_usage('model', 100, 50, 1.50, 'chat')
            assert tb.check_daily_budget() is False


class TestRecordAndGetUsage:
    """Test usage recording and retrieval (in-memory fallback)."""

    def setup_method(self):
        tb._redis = None
        tb._mem_usage.clear()

    def test_record_and_retrieve(self):
        tb.record_usage('openai/gpt-4o-mini', 500, 200, 0.005, 'chat')
        tb.record_usage('openai/gpt-4o-mini', 300, 100, 0.003, 'flashcards')

        usage = tb.get_daily_usage()
        assert usage['total_requests'] == 2
        assert usage['total_prompt_tokens'] == 800
        assert usage['total_completion_tokens'] == 300
        assert abs(usage['total_cost_usd'] - 0.008) < 1e-6
        assert 'openai/gpt-4o-mini' in usage['model_breakdown']
        assert usage['model_breakdown']['openai/gpt-4o-mini']['requests'] == 2

    def test_empty_usage(self):
        usage = tb.get_daily_usage()
        assert usage['total_requests'] == 0
        assert usage['total_cost_usd'] == 0.0

    def test_redis_record(self):
        """When Redis is available, entries are pushed to a list."""
        mock_redis = MagicMock()
        tb._redis = mock_redis
        try:
            tb.record_usage('model/x', 10, 20, 0.001, 'chat')
            mock_redis.rpush.assert_called_once()
            mock_redis.expire.assert_called_once()
            # Verify the serialised entry
            pushed = json.loads(mock_redis.rpush.call_args[0][1])
            assert pushed['model'] == 'model/x'
            assert pushed['prompt_tokens'] == 10
        finally:
            tb._redis = None

    def test_redis_fallback_on_error(self):
        """If Redis write fails, falls back to in-memory."""
        mock_redis = MagicMock()
        mock_redis.rpush.side_effect = Exception("Redis down")
        mock_redis.lrange.side_effect = Exception("Redis down")
        tb._redis = mock_redis
        try:
            tb.record_usage('m', 1, 2, 0.01, 'chat')
            usage = tb.get_daily_usage()
            assert usage['total_requests'] == 1
        finally:
            tb._redis = None


class TestUserMonthlyUsage:
    """Test per-user monthly usage recording and retrieval."""

    def setup_method(self):
        tb._redis = None
        tb._mem_usage.clear()
        tb._mem_user_usage.clear()

    def test_record_with_user_id_populates_monthly(self):
        tb.record_usage('model/x', 100, 50, 0.01, 'chat', user_id='user-abc')
        tb.record_usage('model/x', 200, 80, 0.02, 'quiz', user_id='user-abc')

        usage = tb.get_user_monthly_usage('user-abc')
        assert usage['user_id'] == 'user-abc'
        assert usage['total_requests'] == 2
        assert usage['total_prompt_tokens'] == 300
        assert usage['total_completion_tokens'] == 130
        assert abs(usage['total_cost_usd'] - 0.03) < 1e-6
        assert 'model/x' in usage['model_breakdown']
        assert 'chat' in usage['endpoint_breakdown']
        assert 'quiz' in usage['endpoint_breakdown']

    def test_empty_user_usage(self):
        usage = tb.get_user_monthly_usage('nonexistent')
        assert usage['total_requests'] == 0
        assert usage['total_cost_usd'] == 0.0
        assert usage['user_id'] == 'nonexistent'

    def test_no_user_id_skips_monthly(self):
        tb.record_usage('model/x', 100, 50, 0.01, 'chat', user_id='')
        # Daily still recorded
        daily = tb.get_daily_usage()
        assert daily['total_requests'] == 1
        # No user-monthly entries
        assert tb._mem_user_usage == {}

    def test_monthly_report_multiple_users(self):
        tb.record_usage('m', 10, 5, 0.001, 'chat', user_id='alice')
        tb.record_usage('m', 20, 10, 0.002, 'quiz', user_id='bob')
        tb.record_usage('m', 30, 15, 0.003, 'chat', user_id='alice')

        report = tb.get_monthly_usage_report()
        assert 'alice' in report['users']
        assert 'bob' in report['users']
        assert report['users']['alice']['total_requests'] == 2
        assert report['users']['bob']['total_requests'] == 1
        assert report['totals']['total_requests'] == 3

    def test_specific_month_query(self):
        tb.record_usage('m', 10, 5, 0.001, 'chat', user_id='user1')
        usage = tb.get_user_monthly_usage('user1', '2020-01')
        assert usage['total_requests'] == 0
        assert usage['month'] == '2020-01'

    def test_record_with_user_id_redis(self):
        """When Redis is available, per-user monthly entries are pushed."""
        mock_redis = MagicMock()
        tb._redis = mock_redis
        try:
            tb.record_usage('model/x', 10, 20, 0.001, 'chat', user_id='u1')
            # Daily + user-monthly = 2 rpush calls
            assert mock_redis.rpush.call_count == 2
        finally:
            tb._redis = None


class TestInit:
    """Test init() injection."""

    def test_init_sets_redis(self):
        sentinel = MagicMock()
        tb.init(redis=sentinel)
        assert tb._redis is sentinel
        tb._redis = None  # cleanup


class TestUserDailyTokenBudget:
    """Tests for per-user daily token cap enforcement."""

    def setup_method(self):
        tb._redis = None
        tb._mem_user_daily_tokens.clear()

    # ── cap lookup ────────────────────────────────────────────────────────────

    def test_default_caps_match_requirements(self):
        assert tb._DEFAULT_USER_DAILY_TOKEN_CAPS['free']  == 20_000
        assert tb._DEFAULT_USER_DAILY_TOKEN_CAPS['pro']   == 400_000
        assert tb._DEFAULT_USER_DAILY_TOKEN_CAPS['ultra'] == 2_000_000

    def test_env_override_free_cap(self):
        """The free cap can be overridden (simulates TOKEN_CAP_FREE env var)."""
        original = tb._DEFAULT_USER_DAILY_TOKEN_CAPS['free']
        tb._DEFAULT_USER_DAILY_TOKEN_CAPS['free'] = 5_000
        try:
            tb.record_user_daily_tokens('user-override', 5_000)
            with pytest.raises(tb.UserDailyTokenBudgetExceeded) as exc_info:
                tb.check_user_daily_token_budget('user-override', 'free')
            assert exc_info.value.cap == 5_000
        finally:
            tb._DEFAULT_USER_DAILY_TOKEN_CAPS['free'] = original
            tb._mem_user_daily_tokens.clear()

    # ── record_user_daily_tokens (in-memory) ──────────────────────────────────

    def test_record_increments_counter(self):
        tb.record_user_daily_tokens('user-1', 500)
        tb.record_user_daily_tokens('user-1', 300)
        assert tb.get_user_daily_tokens('user-1') == 800

    def test_record_zero_is_noop(self):
        tb.record_user_daily_tokens('user-1', 0)
        assert tb.get_user_daily_tokens('user-1') == 0

    def test_record_empty_user_id_is_noop(self):
        tb.record_user_daily_tokens('', 100)
        assert tb._mem_user_daily_tokens == {}

    def test_get_unknown_user_returns_zero(self):
        assert tb.get_user_daily_tokens('nobody') == 0

    # ── check_user_daily_token_budget (in-memory) ─────────────────────────────

    def test_check_allows_when_under_cap(self):
        tb.record_user_daily_tokens('user-a', 1_000)
        tb.check_user_daily_token_budget('user-a', 'free')  # should not raise

    def test_check_blocks_when_at_cap(self):
        tb.record_user_daily_tokens('user-b', 20_000)
        with pytest.raises(tb.UserDailyTokenBudgetExceeded) as exc_info:
            tb.check_user_daily_token_budget('user-b', 'free')
        assert exc_info.value.used == 20_000
        assert exc_info.value.cap  == 20_000
        assert exc_info.value.tier == 'free'

    def test_check_blocks_when_over_cap(self):
        tb.record_user_daily_tokens('user-c', 21_000)
        with pytest.raises(tb.UserDailyTokenBudgetExceeded):
            tb.check_user_daily_token_budget('user-c', 'free')

    def test_check_allows_pro_within_cap(self):
        tb.record_user_daily_tokens('user-d', 399_999)
        tb.check_user_daily_token_budget('user-d', 'pro')  # should not raise

    def test_check_blocks_pro_over_cap(self):
        tb.record_user_daily_tokens('user-e', 400_001)
        with pytest.raises(tb.UserDailyTokenBudgetExceeded) as exc_info:
            tb.check_user_daily_token_budget('user-e', 'pro')
        assert exc_info.value.tier == 'pro'

    def test_unknown_tier_falls_back_to_free_cap(self):
        """An unrecognised tier string is treated as free."""
        tb.record_user_daily_tokens('user-f', 20_001)
        with pytest.raises(tb.UserDailyTokenBudgetExceeded):
            tb.check_user_daily_token_budget('user-f', 'enterprise')

    def test_zero_cap_means_unlimited(self):
        """Setting a cap to 0 should never block the user."""
        original = tb._DEFAULT_USER_DAILY_TOKEN_CAPS.copy()
        tb._DEFAULT_USER_DAILY_TOKEN_CAPS['free'] = 0
        try:
            tb.record_user_daily_tokens('user-g', 999_999)
            tb.check_user_daily_token_budget('user-g', 'free')  # must not raise
        finally:
            tb._DEFAULT_USER_DAILY_TOKEN_CAPS.update(original)

    # ── response shape ────────────────────────────────────────────────────────

    def test_exceeded_response_is_429(self):
        exc = tb.UserDailyTokenBudgetExceeded(used=20_000, cap=20_000, tier='free')
        resp = exc.response()
        assert resp.status_code == 429
        import json as _json
        body = _json.loads(resp.body)
        assert body['success'] is False
        assert body['token_limited'] is True
        assert body['tier'] == 'free'
        assert 'error' in body

    # ── Redis integration ─────────────────────────────────────────────────────

    def test_record_uses_incrby_on_redis(self):
        mock_redis = MagicMock()
        mock_redis.incrby.return_value = 500
        tb._redis = mock_redis
        try:
            tb.record_user_daily_tokens('user-h', 500)
            mock_redis.incrby.assert_called_once()
            mock_redis.expire.assert_called_once()
        finally:
            tb._redis = None

    def test_check_reads_from_redis(self):
        mock_redis = MagicMock()
        mock_redis.get.return_value = b'5000'
        tb._redis = mock_redis
        try:
            # 5 000 < 20 000 (free cap) → allowed
            tb.check_user_daily_token_budget('user-i', 'free')
        finally:
            tb._redis = None

    def test_check_redis_blocks_when_over_cap(self):
        mock_redis = MagicMock()
        mock_redis.get.return_value = b'25000'   # over free cap of 20 000
        tb._redis = mock_redis
        try:
            with pytest.raises(tb.UserDailyTokenBudgetExceeded):
                tb.check_user_daily_token_budget('user-j', 'free')
        finally:
            tb._redis = None

    def test_check_redis_error_blocks_free_user(self):
        """Redis failure should fail-closed for free users."""
        mock_redis = MagicMock()
        mock_redis.get.side_effect = Exception('Redis down')
        tb._redis = mock_redis
        try:
            with pytest.raises(tb.UserDailyTokenBudgetExceeded):
                tb.check_user_daily_token_budget('user-k', 'free')
        finally:
            tb._redis = None

    def test_check_redis_error_allows_pro_user(self):
        """Redis failure should fail-open for paid users."""
        mock_redis = MagicMock()
        mock_redis.get.side_effect = Exception('Redis down')
        tb._redis = mock_redis
        try:
            tb.check_user_daily_token_budget('user-l', 'pro')  # must not raise
        finally:
            tb._redis = None

    # ── record_usage integration ──────────────────────────────────────────────

    def test_record_usage_populates_daily_token_counter(self):
        """record_usage() should automatically update the per-user daily counter."""
        tb.record_usage('model/x', 300, 200, 0.01, 'chat', user_id='user-m')
        assert tb.get_user_daily_tokens('user-m') == 500  # 300 + 200

    def test_record_usage_skips_guest_ip_prefix(self):
        """Guest ip: user IDs must NOT increment the daily token counter."""
        tb.record_usage('model/x', 100, 50, 0.01, 'chat', user_id='ip:1.2.3.4')
        assert tb.get_user_daily_tokens('ip:1.2.3.4') == 0
        assert tb._mem_user_daily_tokens == {}
