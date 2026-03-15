/**
 * src/components/SettingsModal.js — Task 24
 *
 * Owns the settings modal HTML, open/close logic, all settings controls,
 * and data-management functions.
 *
 * Previously in index.html:
 *   • #settings-modal HTML block (~lines 7677–7987, 311 lines)
 *   • Settings JS block (~lines 2181–3044, ~420 lines):
 *       openSettings / closeSettings
 *       settingsFontSize + restore-font-size IIFE
 *       _restoreSettings IIFE
 *       _initDropdownAria IIFE
 *       settingsNav / settingsDropdown / settingsSelect
 *       applyAccentColor / settingsSelectAccent / settingsSelectVoice / settingsPlayVoice
 *       settingsToggleChanged / settingsSelectDefaultBook / settingsSelectStudyMode
 *       _getStudyMode / _isFollowupsEnabled / _isAutoFlashEnabled
 *       dataToggleSaveHistory / dataToggleImprove
 *       clearAllHistory / clearPdfCache / _updateCacheSizeLabel
 *       DOMContentLoaded restore handler
 *
 * window bridges set here:
 *   window.openSettings          window.closeSettings
 *   window.settingsNav           window.settingsFontSize
 *   window.settingsDropdown      window.settingsSelect
 *   window.applyAccentColor      window.settingsSelectAccent
 *   window.settingsSelectVoice   window.settingsPlayVoice
 *   window.settingsToggleChanged window.settingsSelectDefaultBook
 *   window.settingsSelectStudyMode
 *   window._getStudyMode         window._isFollowupsEnabled
 *   window._isAutoFlashEnabled
 *   window.dataToggleSaveHistory window.dataToggleImprove
 *   window.clearAllHistory       window.clearPdfCache
 */

// ── HTML template ─────────────────────────────────────────────────────────────

const SETTINGS_MODAL_HTML = `
<div class="settings-modal" id="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
  <div class="settings-content">

    <!-- Left Nav -->
    <div class="settings-nav">
      <button class="settings-close" onclick="closeSettings()" aria-label="Close settings">✕</button>
      <span id="settings-modal-title" class="sr-only">Settings</span>
      <div style="height:38px;"></div>

      <nav aria-label="Settings sections">
      <div class="settings-nav-item active" role="button" tabindex="0" aria-current="page" onclick="settingsNav('general', this)" onkeydown="if(event.key==='Enter'||event.key===' ')settingsNav('general',this)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        General
      </div>
      <div class="settings-nav-item" role="button" tabindex="0" onclick="settingsNav('notifications', this)" onkeydown="if(event.key==='Enter'||event.key===' ')settingsNav('notifications',this)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
        Notifications
      </div>
      <div class="settings-nav-item" role="button" tabindex="0" onclick="settingsNav('personalization', this)" onkeydown="if(event.key==='Enter'||event.key===' ')settingsNav('personalization',this)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        Personalization
      </div>
      <div class="settings-nav-item" role="button" tabindex="0" onclick="settingsNav('apps', this)" onkeydown="if(event.key==='Enter'||event.key===' ')settingsNav('apps',this)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="9" height="9" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/><rect x="2" y="13" width="9" height="9" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/></svg>
        Apps
      </div>
      <div class="settings-nav-item" role="button" tabindex="0" onclick="settingsNav('data', this)" onkeydown="if(event.key==='Enter'||event.key===' ')settingsNav('data',this)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>
        Data controls
      </div>
      <div class="settings-nav-item" role="button" tabindex="0" onclick="settingsNav('security', this)" onkeydown="if(event.key==='Enter'||event.key===' ')settingsNav('security',this)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Security
      </div>
      <div class="settings-nav-item" role="button" tabindex="0" onclick="settingsNav('parental', this)" onkeydown="if(event.key==='Enter'||event.key===' ')settingsNav('parental',this)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Parental controls
      </div>
      <div class="settings-nav-item" role="button" tabindex="0" onclick="settingsNav('account', this)" onkeydown="if(event.key==='Enter'||event.key===' ')settingsNav('account',this)">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        Account
      </div>
      </nav>
    </div>

    <!-- Right Panel -->
    <div class="settings-panel" role="region" aria-label="Settings content">

      <!-- General -->
      <div class="settings-page active" id="settings-page-general">
        <div class="settings-page-title">General</div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Appearance</div></div>
          <div class="settings-select-wrap">
            <div class="settings-select-btn" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-label="Appearance" tabindex="0" data-action="settingsDropdown-self" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();settingsDropdown(this)}">
              <span>System</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            <div class="settings-select-menu" role="listbox" data-setting-key="appearance">
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left">
            <div class="settings-row-label">Chat font size</div>
            <div class="settings-row-desc">Adjust text size for chat messages.</div>
          </div>
          <div class="font-size-picker" id="font-size-picker">
            <button class="font-size-btn" onclick="settingsFontSize('small',this)">S</button>
            <button class="font-size-btn active" onclick="settingsFontSize('medium',this)">M</button>
            <button class="font-size-btn" onclick="settingsFontSize('large',this)">L</button>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Accent color</div></div>
          <div class="settings-select-wrap">
            <div class="settings-select-btn" data-action="settingsDropdown-self">
              <span style="display:flex;align-items:center;gap:7px;"><span id="accent-dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--text-3);flex-shrink:0;"></span>Default</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            <div class="settings-select-menu" data-setting-key="accent">
              <div class="settings-select-option selected" onclick="settingsSelectAccent(this,'#888','Default')">Default</div>
              <div class="settings-select-option" onclick="settingsSelectAccent(this,'#e8ac2e','Gold')">Gold</div>
              <div class="settings-select-option" onclick="settingsSelectAccent(this,'#8b7cf8','Violet')">Violet</div>
              <div class="settings-select-option" onclick="settingsSelectAccent(this,'#2dd4bf','Teal')">Teal</div>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Language</div></div>
          <div class="settings-select-wrap">
            <div class="settings-select-btn" data-action="settingsDropdown-self">
              <span>Auto-detect</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            <div class="settings-select-menu" data-setting-key="language">
              <div class="settings-select-option selected" data-action="settingsSelect-self">Auto-detect</div>
              <div class="settings-select-option" data-action="settingsSelect-self">English</div>
              <div class="settings-select-option" data-action="settingsSelect-self">Filipino</div>
              <div class="settings-select-option" data-action="settingsSelect-self">Spanish</div>
              <div class="settings-select-option" data-action="settingsSelect-self">French</div>
              <div class="settings-select-option" data-action="settingsSelect-self">Japanese</div>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left">
            <div class="settings-row-label">Spoken language</div>
            <div class="settings-row-desc">For best results, select the language you mainly speak. If it's not listed, it may still be supported via auto-detection.</div>
          </div>
          <div class="settings-select-wrap">
            <div class="settings-select-btn" data-action="settingsDropdown-self">
              <span>Auto-detect</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            <div class="settings-select-menu" data-setting-key="spoken-language">
              <div class="settings-select-option selected" data-action="settingsSelect-self">Auto-detect</div>
              <div class="settings-select-option" data-action="settingsSelect-self">English</div>
              <div class="settings-select-option" data-action="settingsSelect-self">Filipino</div>
              <div class="settings-select-option" data-action="settingsSelect-self">Spanish</div>
              <div class="settings-select-option" data-action="settingsSelect-self">French</div>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Voice</div></div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button class="settings-play-btn" id="voice-play-btn" data-action="settingsPlayVoice">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play
            </button>
            <div class="settings-select-wrap">
              <div class="settings-select-btn" data-action="settingsDropdown-self" style="min-width:90px;">
                <span id="voice-label">Maple</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
              </div>
              <div class="settings-select-menu" data-setting-key="voice">
                <div class="settings-select-option" data-action="settingsSelectVoice-self">Echo</div>
                <div class="settings-select-option" data-action="settingsSelectVoice-self">Nova</div>
                <div class="settings-select-option" data-action="settingsSelectVoice-self">Shimmer</div>
              </div>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left">
            <div class="settings-row-label">Separate Voice</div>
            <div class="settings-row-desc">Keep Chunks AI Voice in a separate full screen, without real time transcripts and visuals.</div>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" checked onchange="settingsToggleChanged(this,'separate-voice')">
            <div class="settings-toggle-track"></div>
            <div class="settings-toggle-thumb"></div>
          </label>
        </div>
      </div>

      <!-- Notifications -->
      <div class="settings-page" id="settings-page-notifications">
        <div class="settings-page-title">Notifications</div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Study reminders</div><div class="settings-row-desc">Get reminded to study at your scheduled times.</div></div>
          <label class="settings-toggle"><input type="checkbox" checked><div class="settings-toggle-track"></div><div class="settings-toggle-thumb"></div></label>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Flashcard review alerts</div><div class="settings-row-desc">Be notified when cards are due for review.</div></div>
          <label class="settings-toggle"><input type="checkbox" checked><div class="settings-toggle-track"></div><div class="settings-toggle-thumb"></div></label>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">New library books</div><div class="settings-row-desc">Get notified when new textbooks are added.</div></div>
          <label class="settings-toggle"><input type="checkbox"><div class="settings-toggle-track"></div><div class="settings-toggle-thumb"></div></label>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Product updates</div><div class="settings-row-desc">Feature announcements and improvements.</div></div>
          <label class="settings-toggle"><input type="checkbox"><div class="settings-toggle-track"></div><div class="settings-toggle-thumb"></div></label>
        </div>
      </div>

      <!-- Personalization -->
      <div class="settings-page" id="settings-page-personalization">
        <div class="settings-page-title">Personalization</div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Default book</div><div class="settings-row-desc">The textbook that opens by default in Workspace.</div></div>
          <div class="settings-select-wrap">
            <div class="settings-select-btn" data-action="settingsDropdown-self">
              <span>Atkins Chemistry</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            <div class="settings-select-menu" id="default-book-menu">
              <div class="settings-select-option selected" data-book-id="atkins" data-action="settingsSelectDefaultBook-self">Atkins Chemistry</div>
              <div class="settings-select-option" data-book-id="zumdahl" data-action="settingsSelectDefaultBook-self">Zumdahl General Chemistry</div>
              <div class="settings-select-option" data-book-id="klein" data-action="settingsSelectDefaultBook-self">Klein Organic Chemistry</div>
              <div class="settings-select-option" data-book-id="harris" data-action="settingsSelectDefaultBook-self">Harris Analytical</div>
              <div class="settings-select-option" data-book-id="anaphy2e" data-action="settingsSelectDefaultBook-self">Anatomy &amp; Physiology</div>
              <div class="settings-select-option" data-book-id="netter" data-action="settingsSelectDefaultBook-self">Netter Anatomy</div>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Study mode</div><div class="settings-row-desc">Adjust AI response depth and detail level.</div></div>
          <div class="settings-select-wrap">
            <div class="settings-select-btn" data-action="settingsDropdown-self">
              <span>Balanced</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
            </div>
            <div class="settings-select-menu" id="study-mode-menu">
              <div class="settings-select-option" data-mode="concise" data-action="settingsSelectStudyMode-self">Concise</div>
              <div class="settings-select-option selected" data-mode="balanced" data-action="settingsSelectStudyMode-self">Balanced</div>
              <div class="settings-select-option" data-mode="detailed" data-action="settingsSelectStudyMode-self">Detailed</div>
            </div>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Show follow-up questions</div><div class="settings-row-desc">Display suggested follow-ups after AI responses.</div></div>
          <label class="settings-toggle"><input type="checkbox" id="toggle-followups" checked onchange="settingsToggleChanged(this,'followups')"><div class="settings-toggle-track"></div><div class="settings-toggle-thumb"></div></label>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Auto-generate flashcards</div><div class="settings-row-desc">Suggest flashcard creation after key answers.</div></div>
          <label class="settings-toggle"><input type="checkbox" id="toggle-auto-flash" onchange="settingsToggleChanged(this,'auto-flash')"><div class="settings-toggle-track"></div><div class="settings-toggle-thumb"></div></label>
        </div>
      </div>

      <!-- Apps -->
      <div class="settings-page" id="settings-page-apps">
        <div class="settings-page-title">Apps</div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Connected apps</div><div class="settings-row-desc">No apps connected yet.</div></div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">API access</div><div class="settings-row-desc">Manage your API keys and integrations.</div></div>
          <div class="settings-select" style="color:var(--text-3);cursor:default;">Coming soon</div>
        </div>
      </div>

      <!-- Data controls -->
      <div class="settings-page" id="settings-page-data">
        <div class="settings-page-title">Data controls</div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Save chat history</div><div class="settings-row-desc">Store your conversations for future reference.</div></div>
          <label class="settings-toggle"><input type="checkbox" id="toggle-save-history" checked onchange="dataToggleSaveHistory(this)"><div class="settings-toggle-track"></div><div class="settings-toggle-thumb"></div></label>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Use data to improve Chunks AI</div><div class="settings-row-desc">Help improve the product by sharing anonymised usage data.</div></div>
          <label class="settings-toggle"><input type="checkbox" id="toggle-improve-data" checked onchange="dataToggleImprove(this)"><div class="settings-toggle-track"></div><div class="settings-toggle-thumb"></div></label>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Delete all chat history</div><div class="settings-row-desc">Permanently remove all saved conversations.</div></div>
          <button id="delete-all-btn" data-action="clearAllHistory" style="padding:6px 14px;border-radius:var(--r-sm);background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);color:var(--red);font-size:12px;font-family:var(--font-body);cursor:pointer;transition:background 120ms;">Delete all</button>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Cached textbooks</div><div class="settings-row-desc" id="cache-size-label">Textbooks are cached locally so they load instantly after the first download.</div></div>
          <button id="clear-cache-btn" data-action="clearPdfCache" style="padding:6px 14px;border-radius:var(--r-sm);background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);color:var(--red);font-size:12px;font-family:var(--font-body);cursor:pointer;transition:background 120ms;">Clear cache</button>
        </div>
      </div>

      <!-- Security -->
      <div class="settings-page" id="settings-page-security">
        <div class="settings-page-title">Security</div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Two-factor authentication</div><div class="settings-row-desc">Add an extra layer of security to your account.</div></div>
          <label class="settings-toggle"><input type="checkbox"><div class="settings-toggle-track"></div><div class="settings-toggle-thumb"></div></label>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Active sessions</div><div class="settings-row-desc">View and manage devices logged into your account.</div></div>
          <div class="settings-select" style="color:var(--text-3);cursor:default;">1 device</div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Change password</div></div>
          <button style="padding:6px 14px;border-radius:var(--r-sm);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-1);font-size:12px;font-family:var(--font-body);cursor:pointer;">Update</button>
        </div>
      </div>

      <!-- Parental controls -->
      <div class="settings-page" id="settings-page-parental">
        <div class="settings-page-title">Parental controls</div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Safe content mode</div><div class="settings-row-desc">Restrict content to age-appropriate study material.</div></div>
          <label class="settings-toggle"><input type="checkbox"><div class="settings-toggle-track"></div><div class="settings-toggle-thumb"></div></label>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Set a PIN</div><div class="settings-row-desc">Protect settings with a PIN code.</div></div>
          <button style="padding:6px 14px;border-radius:var(--r-sm);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-1);font-size:12px;font-family:var(--font-body);cursor:pointer;">Set PIN</button>
        </div>
      </div>

      <!-- Account -->
      <div class="settings-page" id="settings-page-account">
        <div class="settings-page-title">Account</div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Name</div></div>
          <div style="font-size:13px;color:var(--text-2);">Charles Daryll Contridas</div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Username</div></div>
          <div style="font-size:13px;color:var(--text-2);font-family:var(--font-mono);">@contridascharles91</div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label">Plan</div><div class="settings-row-desc">Upgrade to unlock more features.</div></div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;color:var(--text-3);">Free</span>
            <button onclick="closeSettings();openUpgradeModal()" style="padding:5px 12px;border-radius:var(--r-pill);background:var(--gold);border:none;color:#090900;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-body);">Upgrade</button>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-row-left"><div class="settings-row-label" style="color:var(--red);">Delete account</div><div class="settings-row-desc">Permanently delete your account and all data.</div></div>
          <button style="padding:6px 14px;border-radius:var(--r-sm);background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);color:var(--red);font-size:12px;font-family:var(--font-body);cursor:pointer;">Delete</button>
        </div>
      </div>

    </div><!-- /settings-panel -->
  </div><!-- /settings-content -->
</div>`;

// ── Inject on DOMContentLoaded ────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('settings-modal')) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = SETTINGS_MODAL_HTML;
  document.body.appendChild(tmp.firstElementChild);

  // Attach click-outside listener after inject
  document.getElementById('settings-modal')?.addEventListener('click', function (e) {
    if (e.target === this && !document.getElementById('confirm-modal')?.classList.contains('active')) {
      closeSettings();
    }
  });

  _initDropdownAria();
  _restoreSettings();
  _updateCacheSizeLabel();
  _restoreDataToggles();
});

// ── Open / close ──────────────────────────────────────────────────────────────

let _settingsFocusRelease = null;

export function openSettings(page) {
  const modal = document.getElementById('settings-modal');
  if (!modal) return;
  modal.classList.add('active');

  if (page) {
    const navItems = modal.querySelectorAll('.settings-nav-item');
    const pages    = modal.querySelectorAll('.settings-page');
    navItems.forEach(n => { n.classList.remove('active'); n.removeAttribute('aria-current'); });
    pages.forEach(p => p.classList.remove('active'));

    const pageMap = {
      general: 0, notifications: 1, personalization: 2,
      apps: 3, data: 4, security: 5, parental: 6, account: 7
    };
    const idx = pageMap[page] ?? 0;
    navItems[idx]?.classList.add('active');
    navItems[idx]?.setAttribute('aria-current', 'page');
    modal.querySelector('#settings-page-' + page)?.classList.add('active');
    if (page === 'data') _updateCacheSizeLabel();
  }
  _settingsFocusRelease = window.trapFocus?.(modal) ?? null;
}

export function closeSettings() {
  document.getElementById('settings-modal')?.classList.remove('active');
  if (_settingsFocusRelease) { _settingsFocusRelease(); _settingsFocusRelease = null; }
}

// ── Nav ───────────────────────────────────────────────────────────────────────

export function settingsNav(page, el) {
  document.querySelectorAll('.settings-nav-item').forEach(n => {
    n.classList.remove('active');
    n.removeAttribute('aria-current');
  });
  document.querySelectorAll('.settings-page').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  el.setAttribute('aria-current', 'page');
  document.getElementById('settings-page-' + page)?.classList.add('active');
  if (page === 'data') _updateCacheSizeLabel();
}

// ── Font size ─────────────────────────────────────────────────────────────────

export function settingsFontSize(size, btn) {
  const map = { small: '11px', medium: '13px', large: '15px' };
  if (!map[size]) return;
  document.documentElement.style.setProperty('--chat-font-size', map[size]);
  document.querySelectorAll('.font-size-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  try { localStorage.setItem('chunks-chat-font-size', size); } catch (e) {}
}

// Restore font size immediately (before DOMContentLoaded)
(function () {
  try {
    const s = localStorage.getItem('chunks-chat-font-size');
    const map = { small: '11px', medium: '13px', large: '15px' };
    if (s && map[s]) {
      document.documentElement.style.setProperty('--chat-font-size', map[s]);
      const sync = () => {
        document.querySelectorAll('.font-size-btn').forEach(b => b.classList.remove('active'));
        const t = document.querySelector(`.font-size-btn[onclick*="'${s}'"]`);
        if (t) t.classList.add('active');
      };
      document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', sync)
        : sync();
    }
  } catch (e) {}
})();

// ── Dropdown ──────────────────────────────────────────────────────────────────

let _openDropdownBtn = null;

export function settingsDropdown(btn) {
  const menu   = btn.nextElementSibling;
  const isOpen = menu.classList.contains('open');

  document.querySelectorAll('.settings-select-menu.open').forEach(m => {
    m.classList.remove('open');
    m.previousElementSibling?.setAttribute('aria-expanded', 'false');
  });
  document.querySelectorAll('.settings-select-btn.open').forEach(b => b.classList.remove('open'));

  if (!isOpen) {
    menu.classList.add('open');
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    _openDropdownBtn = btn;
  } else {
    btn.setAttribute('aria-expanded', 'false');
    _openDropdownBtn = null;
  }
}

// Close dropdowns when clicking outside
document.addEventListener('click', function (e) {
  if (!e.target.closest('.settings-select-wrap')) {
    document.querySelectorAll('.settings-select-menu.open').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.settings-select-btn.open').forEach(b => b.classList.remove('open'));
  }
});

export function settingsSelect(optionEl) {
  const menu  = optionEl.closest('.settings-select-menu');
  const btn   = menu.previousElementSibling;
  const label = btn.querySelector('span');

  menu.querySelectorAll('.settings-select-option').forEach(o => {
    o.classList.remove('selected');
    o.setAttribute('aria-selected', 'false');
  });
  optionEl.classList.add('selected');
  optionEl.setAttribute('aria-selected', 'true');

  const text = optionEl.textContent.replace('✓', '').trim();
  label.textContent = text;

  const key = menu.dataset.settingKey;
  if (key) { try { localStorage.setItem('chunks_setting_' + key, text); } catch (e) {} }

  menu.classList.remove('open');
  btn.classList.remove('open');
  btn.setAttribute('aria-expanded', 'false');
}

// ── Accent color ──────────────────────────────────────────────────────────────

function _hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function applyAccentColor(color) {
  const root = document.documentElement;
  if (!color || color === '#888') {
    ['--gold','--gold-bright','--gold-muted','--gold-glow','--gold-border',
     '--accent','--accent-dim','--accent-glow'].forEach(v => root.style.removeProperty(v));
  } else {
    const [r, g, b] = _hexToRgb(color);
    root.style.setProperty('--gold',        color);
    root.style.setProperty('--gold-bright', color);
    root.style.setProperty('--gold-muted',  `rgba(${r},${g},${b},0.10)`);
    root.style.setProperty('--gold-glow',   `rgba(${r},${g},${b},0.20)`);
    root.style.setProperty('--gold-border', `rgba(${r},${g},${b},0.22)`);
    root.style.setProperty('--accent',      color);
    root.style.setProperty('--accent-dim',  `rgba(${r},${g},${b},0.12)`);
    root.style.setProperty('--accent-glow', `rgba(${r},${g},${b},0.25)`);
  }
}

export function settingsSelectAccent(optionEl, color, name) {
  const menu = optionEl.closest('.settings-select-menu');
  const btn  = menu.previousElementSibling;

  menu.querySelectorAll('.settings-select-option').forEach(o => o.classList.remove('selected'));
  optionEl.classList.add('selected');
  applyAccentColor(color);

  const dot = document.getElementById('accent-dot');
  if (dot) dot.style.background = color === '#888' ? 'var(--text-3)' : color;

  const displayColor = color === '#888' ? 'var(--text-3)' : color;
  btn.querySelector('span').innerHTML = `<span style="display:inline-flex;align-items:center;gap:7px;"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${displayColor};flex-shrink:0;"></span>${name}</span>`;

  try {
    localStorage.setItem('chunks_setting_accent', name);
    localStorage.setItem('chunks_setting_accent_color', color);
  } catch (e) {}

  menu.classList.remove('open');
  btn.classList.remove('open');
}

// ── Voice ─────────────────────────────────────────────────────────────────────

export function settingsSelectVoice(optionEl) {
  settingsSelect(optionEl);
  const voice = optionEl.textContent.trim();
  const lbl = document.getElementById('voice-label');
  if (lbl) lbl.textContent = voice;
  try { localStorage.setItem('chunks_setting_voice', voice); } catch (e) {}
}

export function settingsPlayVoice() {
  const btn   = document.getElementById('voice-play-btn');
  const voice = document.getElementById('voice-label')?.textContent || 'Maple';
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(`Hi, I'm ${voice}, your Chunks AI study assistant.`);
    utter.rate = 0.95;
    window.speechSynthesis.speak(utter);
    btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Playing`;
    utter.onend = () => {
      btn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play`;
    };
  } else {
    window.wsShowToast?.('🔊', 'Voice preview not supported in this browser', '');
  }
}

// ── Toggles ───────────────────────────────────────────────────────────────────

export function settingsToggleChanged(checkbox, key) {
  const val = checkbox.checked;
  localStorage.setItem('chunks_setting_' + key, val ? '1' : '0');
  if (key === 'followups') {
    document.querySelectorAll('.followups').forEach(el => { el.style.display = val ? '' : 'none'; });
  }
  window.wsShowToast?.(val ? '✓' : '✕', `${key.replace(/-/g, ' ')} ${val ? 'enabled' : 'disabled'}`, val ? '' : '');
}

export function settingsSelectDefaultBook(optionEl) {
  settingsSelect(optionEl);
  const bookId = optionEl.dataset.bookId;
  if (bookId) {
    localStorage.setItem('chunks_default_book', bookId);
    window.wsShowToast?.('📚', `Default book set to ${optionEl.textContent.trim()}`, '');
  }
}

export function settingsSelectStudyMode(optionEl) {
  settingsSelect(optionEl);
  const mode = optionEl.dataset.mode;
  if (mode) {
    localStorage.setItem('chunks_study_mode', mode);
    window.wsShowToast?.('✓', `Study mode: ${optionEl.textContent.trim()}`, '');
  }
}

// ── Helpers used by other modules ─────────────────────────────────────────────

export function _getStudyMode()        { return localStorage.getItem('chunks_study_mode') || 'balanced'; }
export function _isFollowupsEnabled()  { return localStorage.getItem('chunks_setting_followups') !== '0'; }
export function _isAutoFlashEnabled()  { return localStorage.getItem('chunks_setting_auto-flash') === '1'; }

// ── Data controls ─────────────────────────────────────────────────────────────

export function dataToggleSaveHistory(checkbox) {
  // Chat history is always saved — this toggle now only controls
  // whether usage data is shared (kept for UI compatibility).
  // Force the checkbox back on if somehow unchecked.
  if (checkbox) checkbox.checked = true;
  localStorage.removeItem('chunks_save_history');
  window.wsShowToast?.('✓', 'Chat history is always saved', '');
}

export function dataToggleImprove(checkbox) {
  const enabled = checkbox.checked;
  localStorage.setItem('chunks_improve_data', enabled ? '1' : '0');
  window.wsShowToast?.(enabled ? '✓' : '✕', `Usage data sharing ${enabled ? 'enabled' : 'disabled'}`, '');
}

export function clearAllHistory() {
  window.showConfirmModal?.({
    title:        'Clear your chat history — are you sure?',
    desc:         'This will permanently delete all saved conversations and cannot be undone.',
    confirmLabel: 'Confirm deletion',
    onConfirm: () => {
      // ── Clear all history keys from localStorage ──────────
      Object.keys(localStorage).filter(k =>
        k.startsWith('chunks_session_') ||
        k.startsWith('chunks_ws_session_') ||
        k.startsWith('chunks_vt_session_') ||
        k.startsWith('exam_snap_') ||
        k === 'chunks_recent' ||
        k === 'chunks_active_home_session' ||
        k === 'chunks_active_ws_book' ||
        k === 'chunks_active_recent_id' ||
        k === 'chunks_home_session' ||
        k === 'chunks_active_vt_session' ||
        k === 'exam_recent'
      ).forEach(k => localStorage.removeItem(k));

      // ── Reset in-memory state via window bridges ──────────
      // _recentItems is a live getter — clear via _saveRecent pattern
      if (Array.isArray(window._recentItems)) window._recentItems.length = 0;
      if (window._activeRecentId !== undefined) window._activeRecentId = null;
      if (window.homeHistory !== undefined)     window.homeHistory    = [];
      if (window._homeSessionId !== undefined)  window._homeSessionId = null;
      if (window._wsChatHistory !== undefined)  window._wsChatHistory = [];
      if (window._activeExamRecentId !== undefined) window._activeExamRecentId = null;

      // ── Re-render sidebar history (all sections show empty) ─
      window._renderAllRecent?.();

      // ── Reset Home screen to landing ──────────────────────
      const chatHist    = document.getElementById('home-chat-history');
      const homeLanding = document.getElementById('home-landing');
      const homeHero    = document.querySelector('.home-hero');
      const homeBar     = document.getElementById('home-input-bar');
      const homeScroll  = document.getElementById('home-scroll-area');
      if (chatHist)    chatHist.innerHTML = '';
      if (homeLanding) homeLanding.style.display = '';
      if (homeHero)    homeHero.style.display = '';
      if (homeBar)     homeBar.style.display = 'none';
      if (homeScroll)  homeScroll.style.justifyContent = 'center';

      // ── Reset Workspace messages ──────────────────────────
      const wsMsgs = document.getElementById('ws-messages');
      if (wsMsgs) wsMsgs.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--text-4);text-align:center;padding:24px;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.25"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <div style="font-size:12px;color:var(--text-4);">Ask a question to start the conversation</div>
        </div>`;

      // ── Reset Visual Tutor to blank canvas ────────────────
      if (typeof window._vtClear === 'function') window._vtClear();

      // ── Reset Exam to setup view ──────────────────────────
      if (typeof window._examShow === 'function') window._examShow('exam-setup');
      const examTopicInput = document.getElementById('exam-topic-input');
      if (examTopicInput) examTopicInput.value = '';
      // Clear exam recent list in the exam screen sidebar
      const examRecentList = document.getElementById('exam-recent-list');
      if (examRecentList) examRecentList.innerHTML = '<div style="padding:8px 12px;font-size:11px;color:var(--text-4);">No exams yet</div>';

      closeSettings();
      setTimeout(() => window.showSimpleNotif?.('Chat history cleared'), 200);
    }
  });
}

export async function clearPdfCache() {
  if (!('caches' in window)) {
    window.wsShowToast?.('⚠', 'Cache API not supported in this browser', '');
    return;
  }
  window.showConfirmModal?.({
    title:        'Clear cached textbooks — are you sure?',
    desc:         'Textbooks will be re-downloaded the next time you open them in Workspace.',
    confirmLabel: 'Confirm deletion',
    onConfirm: async () => {
      await caches.delete('chunks-pdf-v1');
      _updateCacheSizeLabel();
      closeSettings();
      setTimeout(() => window.showSimpleNotif?.('PDF cache cleared'), 200);
    }
  });
}

export async function _updateCacheSizeLabel() {
  const el = document.getElementById('cache-size-label');
  if (!el || !('caches' in window)) return;
  try {
    const cache = await caches.open('chunks-pdf-v1');
    const keys  = await cache.keys();
    if (keys.length === 0) {
      el.textContent = 'No textbooks cached yet.';
    } else {
      let totalBytes = 0;
      for (const req of keys) {
        const res = await cache.match(req);
        const buf = await res.clone().arrayBuffer();
        totalBytes += buf.byteLength;
      }
      const mb = (totalBytes / 1048576).toFixed(1);
      el.textContent = `${keys.length} textbook${keys.length > 1 ? 's' : ''} cached — ${mb} MB`;
    }
  } catch (e) {
    el.textContent = 'Textbooks cached locally for fast loading.';
  }
}

// ── Restore persisted settings ────────────────────────────────────────────────

function _restoreSettings() {
  function applySelect(key, value) {
    const menu = document.querySelector(`.settings-select-menu[data-setting-key="${key}"]`);
    if (!menu || !value) return;
    const btn   = menu.previousElementSibling;
    const match = Array.from(menu.querySelectorAll('.settings-select-option'))
      .find(o => o.textContent.replace('✓', '').trim() === value);
    if (!match) return;
    menu.querySelectorAll('.settings-select-option').forEach(o => o.classList.remove('selected'));
    match.classList.add('selected');
    btn.querySelector('span').textContent = value;
  }

  // Accent color
  const accentName  = localStorage.getItem('chunks_setting_accent');
  const accentColor = localStorage.getItem('chunks_setting_accent_color');
  if (accentName && accentColor) {
    applyAccentColor(accentColor);
    const menu = document.querySelector('.settings-select-menu[data-setting-key="accent"]');
    if (menu) {
      const btn   = menu.previousElementSibling;
      const match = Array.from(menu.querySelectorAll('.settings-select-option'))
        .find(o => o.textContent.trim() === accentName);
      if (match) {
        menu.querySelectorAll('.settings-select-option').forEach(o => o.classList.remove('selected'));
        match.classList.add('selected');
        const dot = document.getElementById('accent-dot');
        const dotColor = accentColor === '#888' ? 'var(--text-3)' : accentColor;
        if (dot) dot.style.background = dotColor;
        btn.querySelector('span').innerHTML = `<span style="display:inline-flex;align-items:center;gap:7px;"><span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${dotColor};flex-shrink:0;"></span>${accentName}</span>`;
      }
    }
  }

  // Voice
  const voice = localStorage.getItem('chunks_setting_voice');
  if (voice) {
    applySelect('voice', voice);
    const lbl = document.getElementById('voice-label');
    if (lbl) lbl.textContent = voice;
  }

  applySelect('appearance',      localStorage.getItem('chunks_setting_appearance'));
  applySelect('language',        localStorage.getItem('chunks_setting_language'));
  applySelect('spoken-language', localStorage.getItem('chunks_setting_spoken-language'));

  // Default book
  const savedBook = localStorage.getItem('chunks_default_book');
  if (savedBook) {
    const bookMenu = document.getElementById('default-book-menu');
    if (bookMenu) {
      const match = bookMenu.querySelector(`[data-book-id="${savedBook}"]`);
      if (match) {
        bookMenu.querySelectorAll('.settings-select-option').forEach(o => o.classList.remove('selected'));
        match.classList.add('selected');
        const btn = bookMenu.previousElementSibling;
        if (btn) btn.querySelector('span').textContent = match.textContent.trim();
      }
    }
  }

  // Study mode
  const savedMode = localStorage.getItem('chunks_study_mode');
  if (savedMode) {
    const modeMenu = document.getElementById('study-mode-menu');
    if (modeMenu) {
      const match = modeMenu.querySelector(`[data-mode="${savedMode}"]`);
      if (match) {
        modeMenu.querySelectorAll('.settings-select-option').forEach(o => o.classList.remove('selected'));
        match.classList.add('selected');
        const btn = modeMenu.previousElementSibling;
        if (btn) btn.querySelector('span').textContent = match.textContent.trim();
      }
    }
  }

  // Toggles
  const followups = localStorage.getItem('chunks_setting_followups');
  if (followups !== null) {
    const el = document.getElementById('toggle-followups');
    if (el) el.checked = followups !== '0';
  }
  const autoFlash = localStorage.getItem('chunks_setting_auto-flash');
  if (autoFlash !== null) {
    const el = document.getElementById('toggle-auto-flash');
    if (el) el.checked = autoFlash === '1';
  }
}

function _restoreDataToggles() {
  // Save history is always on — ensure the toggle reflects that
  const saveHistoryEl = document.getElementById('toggle-save-history');
  if (saveHistoryEl) saveHistoryEl.checked = true;
  localStorage.removeItem('chunks_save_history'); // clean up any stale '0' value

  if (localStorage.getItem('chunks_improve_data') === '0') {
    const el = document.getElementById('toggle-improve-data');
    if (el) el.checked = false;
  }
  if (localStorage.getItem('chunks_setting_followups') === '0') {
    const el = document.getElementById('toggle-followups');
    if (el) el.checked = false;
  }
  if (localStorage.getItem('chunks_setting_auto-flash') === '1') {
    const el = document.getElementById('toggle-auto-flash');
    if (el) el.checked = true;
  }
}

// ── ARIA init for dropdowns ───────────────────────────────────────────────────

function _initDropdownAria() {
  document.querySelectorAll('.settings-select-menu').forEach(menu => {
    if (!menu.getAttribute('role')) menu.setAttribute('role', 'listbox');
    menu.querySelectorAll('.settings-select-option').forEach(opt => {
      opt.setAttribute('role', 'option');
      opt.setAttribute('aria-selected', opt.classList.contains('selected') ? 'true' : 'false');
      if (!opt.hasAttribute('tabindex')) opt.setAttribute('tabindex', '0');
    });
    const btn = menu.previousElementSibling;
    if (btn && btn.classList.contains('settings-select-btn') && !btn.getAttribute('role')) {
      btn.setAttribute('role', 'combobox');
      btn.setAttribute('aria-haspopup', 'listbox');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('tabindex', '0');
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); settingsDropdown(this); }
      });
    }
  });
}

// ── Window bridges ────────────────────────────────────────────────────────────

window.openSettings              = openSettings;
window.closeSettings             = closeSettings;
window.settingsNav               = settingsNav;
window.settingsFontSize          = settingsFontSize;
window.settingsDropdown          = settingsDropdown;
window.settingsSelect            = settingsSelect;
window.applyAccentColor          = applyAccentColor;
window.settingsSelectAccent      = settingsSelectAccent;
window.settingsSelectVoice       = settingsSelectVoice;
window.settingsPlayVoice         = settingsPlayVoice;
window.settingsToggleChanged     = settingsToggleChanged;
window.settingsSelectDefaultBook = settingsSelectDefaultBook;
window.settingsSelectStudyMode   = settingsSelectStudyMode;
window._getStudyMode             = _getStudyMode;
window._isFollowupsEnabled       = _isFollowupsEnabled;
window._isAutoFlashEnabled       = _isAutoFlashEnabled;
window.dataToggleSaveHistory     = dataToggleSaveHistory;
window.dataToggleImprove         = dataToggleImprove;
window.clearAllHistory           = clearAllHistory;
window.clearPdfCache             = clearPdfCache;
