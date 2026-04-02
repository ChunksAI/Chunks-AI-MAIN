"""
Tests for backend/services/plan_limits.py — Plan-based feature limits.
"""
from __future__ import annotations

import sys
import os
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.plan_limits import (
    PLAN_LIMITS,
    PlanLimitExceeded,
    check_plan_limit,
    get_plan_limits,
    get_usage,
    init,
    record_plan_usage,
    _mem_counters,
)
from services.auth import Tier


@pytest.fixture(autouse=True)
def _reset_counters():
    """Clear in-memory counters before each test."""
    _mem_counters.clear()
    init(redis=None)
    yield
    _mem_counters.clear()


# ── PLAN_LIMITS structure ────────────────────────────────────────────────────

class TestPlanLimitsConfig:
    """Verify the PLAN_LIMITS configuration is well-formed."""

    def test_all_tiers_present(self):
        assert 'free' in PLAN_LIMITS
        assert 'pro'  in PLAN_LIMITS
        assert 'ultra' in PLAN_LIMITS

    def test_free_has_finite_limits(self):
        free = PLAN_LIMITS['free']
        assert free['daily_messages'] > 0
        assert free['monthly_flashcard_sets'] > 0
        assert free['monthly_study_plans'] > 0

    def test_storage_mb_present_in_all_tiers(self):
        for tier in ('free', 'pro', 'ultra'):
            assert 'storage_mb' in PLAN_LIMITS[tier], f'{tier} missing storage_mb'
            assert PLAN_LIMITS[tier]['storage_mb'] > 0

    def test_storage_tiers_ordered(self):
        assert PLAN_LIMITS['free']['storage_mb'] < PLAN_LIMITS['pro']['storage_mb']
        assert PLAN_LIMITS['pro']['storage_mb'] < PLAN_LIMITS['ultra']['storage_mb']

    def test_free_blocks_premium_features(self):
        free = PLAN_LIMITS['free']
        assert free['monthly_research'] == 0
        assert free['monthly_exam_prep'] == 0

    def test_pro_is_unlimited(self):
        pro = PLAN_LIMITS['pro']
        for key, val in pro.items():
            if key == 'storage_mb':
                assert val > 0, f'pro.{key} should be a positive storage limit'
            else:
                assert val == -1, f'pro.{key} should be -1 (unlimited), got {val}'

    def test_ultra_is_unlimited(self):
        ultra = PLAN_LIMITS['ultra']
        for key, val in ultra.items():
            if key == 'storage_mb':
                assert val > 0, f'ultra.{key} should be a positive storage limit'
            else:
                assert val == -1, f'ultra.{key} should be -1 (unlimited), got {val}'


class TestGetPlanLimits:
    def test_returns_free_by_default(self):
        result = get_plan_limits('unknown_tier')
        assert result == PLAN_LIMITS['free']

    def test_returns_pro(self):
        result = get_plan_limits('pro')
        assert result['daily_messages'] == -1

    def test_returns_copy(self):
        """Returned dict should be a copy, not a reference."""
        a = get_plan_limits('free')
        a['daily_messages'] = 9999
        assert PLAN_LIMITS['free']['daily_messages'] != 9999


# ── PlanLimitExceeded ────────────────────────────────────────────────────────

class TestPlanLimitExceeded:
    def test_response_for_zero_limit(self):
        exc = PlanLimitExceeded('monthly_research', 0, 0, 'free')
        with pytest.importorskip('flask').Flask(__name__).test_request_context():
            resp, status = exc.response()
            data = resp.json()
            assert status == 429
            assert data['plan_limited'] is True
            assert data['upgrade_needed'] is True
            assert 'not available' in data['error'].lower()

    def test_response_for_exceeded_limit(self):
        exc = PlanLimitExceeded('daily_messages', 25, 25, 'free')
        with pytest.importorskip('flask').Flask(__name__).test_request_context():
            resp, status = exc.response()
            data = resp.json()
            assert status == 429
            assert data['plan_limited'] is True
            assert data['limit'] == 25
            assert 'reached' in data['error'].lower()


# ── check_plan_limit ─────────────────────────────────────────────────────────

class TestCheckPlanLimit:
    def test_pro_is_never_blocked(self):
        """Pro users should never be blocked on any feature."""
        for feature in PLAN_LIMITS['pro']:
            check_plan_limit('user-1', Tier.PRO, feature)  # should not raise

    def test_ultra_is_never_blocked(self):
        """Ultra users should never be blocked on any feature."""
        for feature in PLAN_LIMITS['ultra']:
            check_plan_limit('user-2', Tier.ULTRA, feature)

    def test_free_blocked_on_disabled_feature(self):
        with pytest.raises(PlanLimitExceeded) as exc_info:
            check_plan_limit('user-3', Tier.FREE, 'monthly_research')
        assert exc_info.value.limit == 0
        assert exc_info.value.tier == 'free'

    def test_free_daily_messages_increments(self):
        user = 'user-daily'
        limit = PLAN_LIMITS['free']['daily_messages']
        for _ in range(limit):
            check_plan_limit(user, Tier.FREE, 'daily_messages')
        # Next call should raise
        with pytest.raises(PlanLimitExceeded):
            check_plan_limit(user, Tier.FREE, 'daily_messages')

    def test_unknown_feature_fails_open(self):
        """Unknown features should be allowed (fail-open)."""
        check_plan_limit('user-x', Tier.FREE, 'nonexistent_feature')

    def test_unknown_tier_defaults_to_free(self):
        with pytest.raises(PlanLimitExceeded):
            check_plan_limit('user-y', 'diamond', 'monthly_research')

    def test_tier_enum_accepted(self):
        """Tier enum values should work directly."""
        check_plan_limit('user-enum', Tier.PRO, 'daily_messages')

    def test_tier_string_accepted(self):
        """Plain strings should work too."""
        check_plan_limit('user-str', 'pro', 'daily_messages')


# ── get_usage / record_plan_usage ────────────────────────────────────────────

class TestUsageTracking:
    def test_initial_usage_is_zero(self):
        assert get_usage('new-user', 'daily_messages') == 0

    def test_record_increments(self):
        record_plan_usage('u1', 'daily_messages')
        record_plan_usage('u1', 'daily_messages')
        assert get_usage('u1', 'daily_messages') == 2

    def test_separate_users(self):
        record_plan_usage('u-a', 'daily_messages')
        record_plan_usage('u-b', 'daily_messages')
        assert get_usage('u-a', 'daily_messages') == 1
        assert get_usage('u-b', 'daily_messages') == 1


# ── Redis integration ────────────────────────────────────────────────────────

class TestRedisIntegration:
    def test_redis_incr_called(self):
        mock_redis = MagicMock()
        mock_redis.get.return_value = b'0'
        mock_redis.incr.return_value = 1
        init(redis=mock_redis)

        check_plan_limit('redis-user', Tier.FREE, 'daily_messages')
        mock_redis.incr.assert_called_once()

    def test_redis_fallback_on_error(self):
        mock_redis = MagicMock()
        mock_redis.get.side_effect = Exception('Redis down')
        mock_redis.incr.side_effect = Exception('Redis down')
        init(redis=mock_redis)

        # Should fall back to in-memory and not crash
        check_plan_limit('fallback-user', Tier.FREE, 'daily_messages')
