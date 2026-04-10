'use client';

/**
 * contexts/SettingsContext.tsx — global user preferences
 *
 * All settings are persisted in localStorage under the `chunks_setting_*`
 * key prefix so they survive page refreshes and match the old v1 system.
 *
 * Usage:
 *   const { settings, setSetting } = useSettings();
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

// ─── Settings shape ───────────────────────────────────────────────────────────

export interface Settings {
  appearance:       'light' | 'dark';
  chatFontSize:     'small' | 'medium' | 'large';
  accentColor:      string;
  language:         string;
  spokenLanguage:   string;
  voice:            string;
  separateVoice:    boolean;

  notifStudy:       boolean;
  notifFlashcard:   boolean;
  notifLibrary:     boolean;
  notifUpdates:     boolean;

  studyMode:        'concise' | 'balanced' | 'detailed';
  showFollowups:    boolean;
  autoFlash:        boolean;

  saveChatHistory:  boolean;
  improveData:      boolean;

  safeContent:      boolean;
}

const DEFAULTS: Settings = {
  appearance:       'light',
  chatFontSize:     'small',
  accentColor:      'default',
  language:         'Auto-detect',
  spokenLanguage:   'Auto-detect',
  voice:            'Maple',
  separateVoice:    false,

  notifStudy:       true,
  notifFlashcard:   true,
  notifLibrary:     false,
  notifUpdates:     false,

  studyMode:        'balanced',
  showFollowups:    true,
  autoFlash:        false,

  saveChatHistory:  true,
  improveData:      true,

  safeContent:      false,
};

// ─── Context types ────────────────────────────────────────────────────────────

interface SettingsContextValue {
  settings: Settings;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetSettings: () => void;
  /** Whether the settings modal is currently open. */
  isOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

const LS_MAP: Record<keyof Settings, string> = {
  appearance:       'chunks_setting_appearance',
  chatFontSize:     'chunks-chat-font-size',
  accentColor:      'chunks_setting_accent',
  language:         'chunks_setting_language',
  spokenLanguage:   'chunks_setting_spoken-language',
  voice:            'chunks_setting_voice',
  separateVoice:    'chunks_setting_separate-voice',
  notifStudy:       'chunks_setting_notif-study',
  notifFlashcard:   'chunks_setting_notif-flashcard',
  notifLibrary:     'chunks_setting_notif-library',
  notifUpdates:     'chunks_setting_notif-updates',
  studyMode:        'chunks_study_mode',
  showFollowups:    'chunks_setting_followups',
  autoFlash:        'chunks_setting_auto-flash',
  saveChatHistory:  'chunks_save_history',
  improveData:      'chunks_improve_data',
  safeContent:      'chunks_setting_safe-content',
};

const BOOL_KEYS: Set<keyof Settings> = new Set([
  'separateVoice', 'notifStudy', 'notifFlashcard', 'notifLibrary', 'notifUpdates',
  'showFollowups', 'autoFlash', 'saveChatHistory', 'improveData', 'safeContent',
]);

function load(): Settings {
  const s = { ...DEFAULTS };
  if (typeof window === 'undefined') return s;
  try {
    for (const [key, lsKey] of Object.entries(LS_MAP) as [keyof Settings, string][]) {
      const raw = localStorage.getItem(lsKey);
      if (raw === null) continue;
      if (BOOL_KEYS.has(key)) {
        (s as Record<string, unknown>)[key] = raw === '1' || raw === 'true';
      } else {
        (s as Record<string, unknown>)[key] = raw;
      }
    }
  } catch { /* ignore */ }
  return s;
}

function persist<K extends keyof Settings>(key: K, value: Settings[K]) {
  try {
    const lsKey = LS_MAP[key];
    if (BOOL_KEYS.has(key)) {
      localStorage.setItem(lsKey, (value as boolean) ? '1' : '0');
    } else {
      localStorage.setItem(lsKey, String(value));
    }
  } catch { /* ignore */ }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const SettingsContext = createContext<SettingsContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage after mount (avoid SSR mismatch)
  useEffect(() => {
    setSettings(load());
    setHydrated(true);
  }, []);

  // Apply appearance class to <html> element
  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.setAttribute(
      'data-theme',
      settings.appearance === 'dark' ? 'dark' : 'light',
    );
  }, [settings.appearance, hydrated]);

  const setSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    persist(key, value);
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULTS);
    try {
      for (const lsKey of Object.values(LS_MAP)) {
        localStorage.removeItem(lsKey);
      }
      localStorage.removeItem('chunks_settings_initialized');
    } catch { /* ignore */ }
  }, []);

  const openSettings  = useCallback(() => setIsOpen(true), []);
  const closeSettings = useCallback(() => setIsOpen(false), []);

  return (
    <SettingsContext.Provider value={{ settings, setSetting, resetSettings, isOpen, openSettings, closeSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
