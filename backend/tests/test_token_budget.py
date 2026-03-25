"""Tests for the token_budget service."""
import json
import os
from unittest.mock import MagicMock, patch

import services.token_budget as tb


class TestMaxTokensForEndpoint:
    """Test max_tokens_for_endpoint resolution."""

    def test_known_endpoint_returns_configured_limit(self):
        assert tb.max_tokens_for_endpoint('chat') == 6_000
        assert tb.max_tokens_for_endpoint('quiz') == 12_000
        assert tb.max_tokens_for_endpoint('image') == 2_000
        assert tb.max_tokens_for_endpoint('study_materials') == 8_000
        assert tb.max_tokens_for_endpoint('flashcards') == 4_000
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
        assert tb.max_tokens_for_endpoint('chat', override=None) == 6_000

    def test_override_zero_uses_default(self):
        assert tb.max_tokens_for_endpoint('chat', override=0) == 6_000

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


class TestInit:
    """Test init() injection."""

    def test_init_sets_redis(self):
        sentinel = MagicMock()
        tb.init(redis=sentinel)
        assert tb._redis is sentinel
        tb._redis = None  # cleanup
