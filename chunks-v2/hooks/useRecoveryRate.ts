'use client';

/**
 * useRecoveryRate — React hook for consuming recovery rate analytics.
 *
 * Returns live RecoveryStats from lib/recoveryAnalytics and re-renders
 * whenever data changes (via the 'chunks:recovery-changed' custom event).
 *
 * Usage:
 *   const { rate, ratePct, total, recovered, pending, attempts } = useRecoveryRate();
 */

import { useState, useEffect, useCallback } from 'react';
import { computeRecoveryStats, type RecoveryStats } from '@/lib/recoveryAnalytics';

const EMPTY_STATS: RecoveryStats = {
  total: 0,
  recovered: 0,
  rate: 0,
  ratePct: 0,
  pending: 0,
  attempts: [],
};

export function useRecoveryRate(): RecoveryStats {
  const [stats, setStats] = useState<RecoveryStats>(EMPTY_STATS);

  const refresh = useCallback(() => {
    setStats(computeRecoveryStats());
  }, []);

  useEffect(() => {
    // Compute on mount
    refresh();
    // Re-compute whenever the recovery analytics data changes
    window.addEventListener('chunks:recovery-changed', refresh);
    return () => window.removeEventListener('chunks:recovery-changed', refresh);
  }, [refresh]);

  return stats;
}
