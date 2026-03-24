/**
 * src/state/flash/state.js — Shared mutable state + localStorage key constants
 */

export const fc = {
  deck:            [],
  index:           0,
  flipped:         false,
  stats:           { easy: 0, ok: 0, hard: 0, skipped: 0 },
  ratings:         [],
  currentDeckMeta: null,
  hardOnly:        false,
};

export const ACCENT_KEY  = 'chunks_fc_accent_v1';
export const STREAK_KEY  = 'chunks_fc_streak_v1';
export const FREEZE_KEY  = 'chunks_fc_freeze_v1';
export const XP_KEY      = 'chunks_fc_xp_v1';
export const MASTERY_KEY = 'chunks_fc_mastery_v1';
export const LEGEND_KEY  = 'chunks_fc_legend_v1';
