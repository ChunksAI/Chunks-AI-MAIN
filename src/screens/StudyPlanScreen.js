/**
 * src/screens/StudyPlanScreen.js — Task 30
 *
 * Owns:
 *   • #screen-studyplan HTML injection (replaces data-studyplan-screen placeholder)
 *   • #sp-explain-drawer HTML injection (replaces data-sp-explain-drawer placeholder)
 *
 * All study plan logic lives in src/state/studyPlanState.js (Task 18).
 *
 * Fixes carried over from index.html:
 *   • Notes "Clear" button called undefined updateNotesCount() → fixed to spUpdateNotesCount()
 */

// ── HTML templates ────────────────────────────────────────────────────────────

const STUDYPLAN_HTML = /* html */`
<div class="screen" id="screen-studyplan">

  <!-- SIDEBAR -->
  <aside class="sidebar" data-sidebar-screen="studyplan"></aside>

  <!-- MAIN -->
  <div class="sp-main" style="position:relative;">

    <!-- TOP BAR -->
    <div class="sp-topbar">
      <button type="button" class="mst-back sp-back-btn" data-action="goHome" aria-label="Back" style="display:none;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--gold);flex-shrink:0;"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      <span class="sp-topbar-title">Study Plan</span>
      <span class="sp-topbar-badge">CRITICAL PATH</span>
      <div class="sp-topbar-actions">
        <button class="sp-topbar-btn" id="btn-new-plan" data-action="spShowEmpty">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Plan
        </button>
        <button class="sp-topbar-btn" id="btn-active-plan" data-action="spShowPlan" style="display:none;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
          View Plan
        </button>
      </div>
    </div>

    <!-- BODY -->
    <div class="sp-body">

      <!-- ══ EMPTY / SETUP STATE ══ -->
      <div id="sp-empty-state" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;align-items:center;width:100%;">
        <div class="sp-setup">

          <!-- Hero -->
          <div class="sp-setup-hero">
            <div class="sp-setup-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#e8ac2e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
            <div class="sp-setup-title">Build Your Critical Path</div>
            <div class="sp-setup-subtitle">Upload your lecture slides or enter a topic — the AI will break it into essential concepts and guide you step-by-step to full mastery.</div>
            <div class="sp-hero-chips">
              <span class="sp-hero-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>Step-by-step pacing</span>
              <span class="sp-hero-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>Mastery tracking</span>
              <span class="sp-hero-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>AI flashcards</span>
              <span class="sp-hero-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 11l3 3L22 4"/></svg>Exam simulation</span>
            </div>
          </div>

          <!-- Setup Card -->
          <div class="sp-setup-card">
            <div class="sp-setup-card-header">
              <h2>Create a Study Plan</h2>
              <p>Choose a topic or upload your material — we handle the rest.</p>
            </div>
            <div class="sp-setup-card-body">

              <!-- Source tabs -->
              <div class="sp-field">
                <label>Source Material</label>
                <div class="sp-src-tabs">
                  <button class="sp-src-tab active" id="sp-tab-upload" onclick="spSwitchTab('upload')">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Upload Slides
                  </button>
                  <button class="sp-src-tab" id="sp-tab-topic" onclick="spSwitchTab('topic')">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
                    Enter Topic
                  </button>
                  <button class="sp-src-tab" id="sp-tab-notes" onclick="spSwitchTab('notes')">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Paste Notes
                  </button>
                </div>
              </div>

              <!-- Upload zone -->
              <div id="sp-src-upload">
                <input type="file" id="sp-file-input" accept="application/pdf" style="display:none;" onchange="spHandleFileSelect(this.files[0])">
                <div class="sp-upload-zone" id="sp-upload-idle"
                  onclick="document.getElementById('sp-file-input').click()"
                  ondragover="spDragOver(event)"
                  ondragleave="spDragLeave(event)"
                  ondrop="spDrop(event)">
                  <div class="sp-upload-zone-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-3);"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  </div>
                  <div class="sp-upload-zone-label">Drop a PDF here or click to browse</div>
                  <div class="sp-upload-zone-sub">AI will extract every concept from your slides</div>
                </div>
                <div id="sp-upload-attached" style="display:none;">
                  <div style="display:flex;align-items:center;gap:10px;padding:11px 13px;background:var(--surface-2);border:1px solid var(--gold-border);border-radius:var(--r-md);">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span id="sp-file-name" style="font-size:12px;font-weight:600;color:var(--text-1);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
                    <span id="sp-file-pages" style="font-size:11px;color:var(--text-3);font-family:var(--font-mono);flex-shrink:0;"></span>
                    <button data-action="spClearUpload" class="hover-del-btn" style="background:none;border:none;cursor:pointer;color:var(--text-3);padding:2px;display:flex;align-items:center;transition:color 120ms;">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div id="sp-extract-status" style="display:none;align-items:center;gap:7px;margin-top:8px;font-size:11px;color:var(--text-3);">
                    <div class="sp-spinner"></div>
                    <span id="sp-extract-msg">Extracting text from PDF…</span>
                  </div>
                  <div id="sp-extract-done" style="display:none;align-items:center;gap:6px;margin-top:8px;font-size:11px;color:var(--green);">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span id="sp-extract-chars"></span> characters extracted — ready to generate
                  </div>
                </div>
              </div>

              <!-- Topic input -->
              <div id="sp-src-topic" style="display:none;">
                <div class="sp-field">
                  <label>Topic or Subject</label>
                  <input class="sp-input" type="text" placeholder="e.g. Nucleophilic Substitution, The French Revolution, Mitosis…" id="sp-topic-input">
                </div>
                <div class="sp-field" style="margin-top:12px;">
                  <label>Depth <span style="color:var(--text-4);font-weight:400;">(optional)</span></label>
                  <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button class="sp-activity-chip active-chip" id="sp-depth-intro" onclick="spSetDepth('intro')">Introductory</button>
                    <button class="sp-activity-chip" id="sp-depth-mid" onclick="spSetDepth('mid')">Intermediate</button>
                    <button class="sp-activity-chip" id="sp-depth-adv" onclick="spSetDepth('adv')">Advanced</button>
                    <button class="sp-activity-chip" id="sp-depth-exam" onclick="spSetDepth('exam')">Exam Prep</button>
                  </div>
                </div>
              </div>

              <!-- Notes textarea -->
              <div id="sp-src-notes" style="display:none;">
                <textarea class="sp-input" id="sp-notes-input" rows="5"
                  style="resize:none;line-height:1.6;"
                  placeholder="Paste your notes, lecture text, or any content to build the plan from…"
                  oninput="spUpdateNotesCount()"></textarea>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;">
                  <span id="sp-notes-count" style="font-size:10px;color:var(--text-4);font-family:var(--font-mono);">0 chars</span>
                  <button onclick="document.getElementById('sp-notes-input').value='';spUpdateNotesCount();" class="hover-clear-btn" style="font-size:10px;color:var(--text-4);background:none;border:none;cursor:pointer;font-family:var(--font-body);">Clear</button>
                </div>
              </div>

              <!-- Validation error -->
              <div id="sp-validation-error" style="display:none;align-items:center;gap:7px;padding:10px 13px;background:rgba(248,113,113,0.07);border:1px solid rgba(248,113,113,0.2);border-radius:var(--r-md);font-size:12px;color:var(--red);">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span id="sp-validation-msg">Please provide a topic or upload a file.</span>
              </div>

              <button class="sp-generate-btn" id="sp-generate-btn" data-action="spHandleGenerate">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                Generate Critical Path
              </button>

            </div>
          </div>

        </div>
      </div>

      <!-- ══ ACTIVE / POPULATED STATE ══ -->
      <div id="sp-active-state" style="display:none;flex:1;overflow:hidden;">
        <div class="sp-body" style="height:100%;">

          <!-- Roadmap column -->
          <div class="sp-roadmap-col">

            <!-- Plan header -->
            <div class="sp-plan-header">
              <div class="sp-plan-header-info">
                <div class="sp-plan-header-eyebrow">Study Plan · Organic Chemistry</div>
                <div class="sp-plan-header-title">Nucleophilic Substitution Reactions</div>
                <div class="sp-plan-header-sub">6 core concepts · ~4 hrs to mastery · Based on Klein, Ch. 7</div>
              </div>
              <div class="sp-overall-ring">
                <svg width="60" height="60" viewBox="0 0 60 60">
                  <circle cx="30" cy="30" r="24" fill="none" stroke="var(--surface-3)" stroke-width="5"/>
                  <circle id="sp-ring-arc" cx="30" cy="30" r="24" fill="none" stroke="var(--gold)" stroke-width="5"
                    stroke-dasharray="150.8" stroke-dashoffset="150.8"
                    stroke-linecap="round" transform="rotate(-90 30 30)"/>
                  <text id="sp-ring-pct" x="30" y="34" text-anchor="middle" font-family="'Syne',sans-serif" font-size="12" font-weight="800" fill="#ededf0">0%</text>
                </svg>
                <div class="sp-overall-ring-label">Overall</div>
              </div>
            </div>

            <!-- Stats row -->
            <div class="sp-stats-row" id="sp-stats-row-chips"></div>

            <!-- Roadmap label -->
            <div class="sp-roadmap-label">Critical Path to Mastery</div>

            <!-- THE PATH -->
            <div class="sp-path">

              <!-- ① MASTERED -->
              <div class="sp-node">
                <div class="sp-node-bullet mastered">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div class="sp-node-card">
                  <div class="sp-node-card-top">
                    <div class="sp-node-card-title">1. Nucleophiles &amp; Electrophiles</div>
                    <span class="sp-node-status-badge mastered">Mastered</span>
                  </div>
                  <div class="sp-node-card-desc">Understand what makes a molecule a nucleophile or electrophile, and how electron density drives reactivity.</div>
                  <div class="sp-mastery-bar-wrap">
                    <div class="sp-mastery-bar-track"><div class="sp-mastery-bar-fill" style="width:100%;background:var(--green);"></div></div>
                    <div class="sp-mastery-pct" style="color:var(--green);">100%</div>
                  </div>
                  <div class="sp-activities" style="margin-top:10px;">
                    <span class="sp-activity-chip done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> AI Explain</span>
                    <span class="sp-activity-chip done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Flashcards</span>
                    <span class="sp-activity-chip done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Practice Q's</span>
                    <span class="sp-activity-chip done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Mini Exam</span>
                  </div>
                </div>
              </div>

              <!-- ② MASTERED -->
              <div class="sp-node">
                <div class="sp-node-bullet mastered">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div class="sp-node-card">
                  <div class="sp-node-card-top">
                    <div class="sp-node-card-title">2. Leaving Groups &amp; Substrate Structure</div>
                    <span class="sp-node-status-badge mastered">Mastered</span>
                  </div>
                  <div class="sp-node-card-desc">Identify good vs. poor leaving groups, and understand how primary, secondary, and tertiary substrates behave differently.</div>
                  <div class="sp-mastery-bar-wrap">
                    <div class="sp-mastery-bar-track"><div class="sp-mastery-bar-fill" style="width:100%;background:var(--green);"></div></div>
                    <div class="sp-mastery-pct" style="color:var(--green);">100%</div>
                  </div>
                  <div class="sp-activities" style="margin-top:10px;">
                    <span class="sp-activity-chip done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> AI Explain</span>
                    <span class="sp-activity-chip done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Flashcards</span>
                    <span class="sp-activity-chip done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Practice Q's</span>
                    <span class="sp-activity-chip done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Mini Exam</span>
                  </div>
                </div>
              </div>

              <!-- ③ IN PROGRESS -->
              <div class="sp-node">
                <div class="sp-node-bullet in-progress"><span style="font-size:13px;">3</span></div>
                <div class="sp-node-card active-card">
                  <div class="sp-node-card-top">
                    <div class="sp-node-card-title">3. The SN2 Mechanism</div>
                    <span class="sp-node-status-badge in-progress">In Progress</span>
                  </div>
                  <div class="sp-node-card-desc">Master the concerted backside-attack mechanism: transition state geometry, stereochemical inversion (Walden inversion), and rate law.</div>
                  <div class="sp-mastery-bar-wrap">
                    <div class="sp-mastery-bar-track"><div class="sp-mastery-bar-fill" style="width:65%;background:var(--gold);"></div></div>
                    <div class="sp-mastery-pct" style="color:var(--gold);">65%</div>
                  </div>
                  <div class="sp-activities" style="margin-top:10px;">
                    <span class="sp-activity-chip done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> AI Explain</span>
                    <span class="sp-activity-chip done"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Flashcards</span>
                    <span class="sp-activity-chip active-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Practice Q's</span>
                    <span class="sp-activity-chip locked-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Mini Exam</span>
                  </div>
                </div>
              </div>

              <!-- ④ READY -->
              <div class="sp-node">
                <div class="sp-node-bullet ready"><span style="font-size:13px;">4</span></div>
                <div class="sp-node-card">
                  <div class="sp-node-card-top">
                    <div class="sp-node-card-title">4. The SN1 Mechanism</div>
                    <span class="sp-node-status-badge ready">Ready</span>
                  </div>
                  <div class="sp-node-card-desc">Understand carbocation formation, racemization, solvent effects, and why SN1 favors tertiary substrates in polar protic solvents.</div>
                  <div class="sp-mastery-bar-wrap">
                    <div class="sp-mastery-bar-track"><div class="sp-mastery-bar-fill" style="width:0%;background:var(--violet);"></div></div>
                    <div class="sp-mastery-pct">0%</div>
                  </div>
                  <div class="sp-activities" style="margin-top:10px;">
                    <span class="sp-activity-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg> AI Explain</span>
                    <span class="sp-activity-chip locked-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Flashcards</span>
                    <span class="sp-activity-chip locked-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Practice Q's</span>
                    <span class="sp-activity-chip locked-chip"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Mini Exam</span>
                  </div>
                </div>
              </div>

              <!-- ⑤ LOCKED -->
              <div class="sp-node">
                <div class="sp-node-bullet locked"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
                <div class="sp-node-card">
                  <div class="sp-node-card-top">
                    <div class="sp-node-card-title">5. SN1 vs SN2 — Predicting the Pathway</div>
                    <span class="sp-node-status-badge locked">Locked</span>
                  </div>
                  <div class="sp-node-card-desc">Apply decision-making frameworks to predict which mechanism dominates based on substrate, nucleophile, solvent, and temperature.</div>
                  <div class="sp-mastery-bar-wrap">
                    <div class="sp-mastery-bar-track"><div class="sp-mastery-bar-fill" style="width:0%;background:var(--text-4);"></div></div>
                    <div class="sp-mastery-pct">—</div>
                  </div>
                  <div class="sp-activities" style="margin-top:10px;">
                    <span class="sp-activity-chip locked-chip">AI Explain</span>
                    <span class="sp-activity-chip locked-chip">Flashcards</span>
                    <span class="sp-activity-chip locked-chip">Practice Q's</span>
                    <span class="sp-activity-chip locked-chip">Mini Exam</span>
                  </div>
                </div>
              </div>

              <!-- ⑥ LOCKED -->
              <div class="sp-node">
                <div class="sp-node-bullet locked"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div>
                <div class="sp-node-card">
                  <div class="sp-node-card-top">
                    <div class="sp-node-card-title">6. Exam Simulation — Full Topic</div>
                    <span class="sp-node-status-badge locked">Locked</span>
                  </div>
                  <div class="sp-node-card-desc">A timed, graded exam across all six concepts. Unlocks when all prior concepts reach 80%+ mastery.</div>
                  <div class="sp-mastery-bar-wrap">
                    <div class="sp-mastery-bar-track"><div class="sp-mastery-bar-fill" style="width:0%;"></div></div>
                    <div class="sp-mastery-pct">—</div>
                  </div>
                  <div style="margin-top:10px;display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-4);">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Unlock by completing all previous concepts
                  </div>
                </div>
              </div>

            </div><!-- /.sp-path -->
          </div><!-- /.sp-roadmap-col -->

          <!-- Right detail panel -->
          <div class="sp-detail-col" id="sp-detail-col">
            <div>
              <div class="sp-detail-section-title">Overall Progress</div>
              <div class="sp-donut-wrap">
                <svg id="sp-donut-svg" width="120" height="120" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="48" fill="none" stroke="var(--surface-3)" stroke-width="10"/>
                  <circle id="sp-donut-mastered" cx="60" cy="60" r="48" fill="none" stroke="var(--green)" stroke-width="10" stroke-dasharray="301.6" stroke-dashoffset="301.6" stroke-linecap="round" transform="rotate(-90 60 60)"/>
                  <circle id="sp-donut-inprogress" cx="60" cy="60" r="48" fill="none" stroke="var(--gold)" stroke-width="10" stroke-dasharray="301.6" stroke-dashoffset="301.6" stroke-linecap="round" transform="rotate(-90 60 60)"/>
                  <text id="sp-donut-pct" x="60" y="55" text-anchor="middle" font-family="'Syne',sans-serif" font-size="22" font-weight="800" fill="#ededf0">0%</text>
                  <text x="60" y="72" text-anchor="middle" font-family="'DM Sans',sans-serif" font-size="10" fill="#55556a">mastery</text>
                </svg>
                <div class="sp-legend">
                  <div class="sp-legend-row"><div class="sp-legend-dot" style="background:var(--green);"></div>Mastered<div class="sp-legend-count" id="sp-leg-mastered">0 / 0</div></div>
                  <div class="sp-legend-row"><div class="sp-legend-dot" style="background:var(--gold);"></div>In Progress<div class="sp-legend-count" id="sp-leg-inprog">0 / 0</div></div>
                  <div class="sp-legend-row"><div class="sp-legend-dot" style="background:var(--violet);"></div>Ready<div class="sp-legend-count" id="sp-leg-ready">0 / 0</div></div>
                  <div class="sp-legend-row"><div class="sp-legend-dot" style="background:var(--text-4);"></div>Locked<div class="sp-legend-count" id="sp-leg-locked">0 / 0</div></div>
                </div>
              </div>
            </div>
            <div>
              <div class="sp-detail-section-title">Exam Readiness</div>
              <div class="sp-readiness">
                <div class="sp-readiness-header">
                  <div class="sp-readiness-title">Score Forecast</div>
                  <div class="sp-readiness-score" id="sp-readiness-score">0%</div>
                </div>
                <div class="sp-readiness-bar-track"><div class="sp-readiness-bar-fill" id="sp-readiness-bar"></div></div>
                <div class="sp-readiness-note" id="sp-readiness-note">Generate a study plan to see your forecast.</div>
              </div>
            </div>
            <div>
              <div class="sp-detail-section-title">Up Next</div>
              <div class="sp-upcoming" id="sp-upcoming-list">
                <div style="font-size:12px;color:var(--text-4);padding:8px 0;">Generate a plan to see suggestions.</div>
              </div>
            </div>
            <div style="padding:14px 16px;background:var(--surface-1);border:1px solid var(--border-xs);border-radius:var(--r-lg);display:flex;align-items:center;gap:12px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <div>
                <div id="sp-time-remaining" style="font-size:12px;font-weight:600;color:var(--text-1);margin-bottom:2px;">—</div>
                <div id="sp-time-sub" style="font-size:11px;color:var(--text-3);">Complete activities to track your pace.</div>
              </div>
            </div>
          </div><!-- /.sp-detail-col -->

        </div><!-- inner sp-body -->
      </div><!-- /#sp-active-state -->

    </div><!-- /.sp-body -->
  </div><!-- /.sp-main -->

  <!-- ══ Generation Overlay ══ -->
  <div id="sp-generating-overlay">
    <div class="sp-gen-card">
      <div class="sp-spinner-lg"></div>
      <div>
        <div style="font-family:var(--font-head);font-size:16px;font-weight:800;color:var(--text-1);margin-bottom:4px;">Building Your Critical Path</div>
        <div style="font-size:12px;color:var(--text-3);">Analyzing material and mapping concepts…</div>
      </div>
      <div class="sp-gen-steps">
        <div class="sp-gen-step" id="gen-step-1"><div class="sp-gen-step-dot"></div>Reading source material</div>
        <div class="sp-gen-step" id="gen-step-2"><div class="sp-gen-step-dot"></div>Identifying core concepts</div>
        <div class="sp-gen-step" id="gen-step-3"><div class="sp-gen-step-dot"></div>Building prerequisite map</div>
        <div class="sp-gen-step" id="gen-step-4"><div class="sp-gen-step-dot"></div>Estimating time to mastery</div>
        <div class="sp-gen-step" id="gen-step-5"><div class="sp-gen-step-dot"></div>Finalizing critical path</div>
      </div>
    </div>
  </div>

</div><!-- /#screen-studyplan -->
`;

const SP_EXPLAIN_DRAWER_HTML = /* html */`
<div id="sp-explain-drawer" role="dialog" aria-modal="true" aria-labelledby="sp-explain-title">

  <!-- Header -->
  <div class="sp-explain-header">
    <div class="sp-explain-header-icon" id="sp-drawer-icon" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e8ac2e" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>
    </div>
    <div class="sp-explain-header-text">
      <div class="sp-explain-eyebrow" id="sp-drawer-eyebrow">AI Explain</div>
      <div id="sp-explain-title">Concept Title</div>
    </div>
    <button data-action="spCloseExplainDrawer" class="hover-close-btn" aria-label="Close AI Explain" style="background:none;border:none;cursor:pointer;color:var(--text-3);padding:4px;display:flex;align-items:center;border-radius:var(--r-sm);transition:color var(--t-fast),background var(--t-fast);">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>

  <!-- Tab bar -->
  <div class="sp-drawer-tabs" role="tablist" aria-label="Content tabs">
    <button class="sp-drawer-tab active" id="sp-tab-explain" role="tab" aria-selected="true" aria-controls="sp-panel-explain" data-action="spDrawerTab" data-tab="explain">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>
      AI Explain
    </button>
    <button class="sp-drawer-tab" id="sp-tab-flash" role="tab" aria-selected="false" aria-controls="sp-panel-flash" data-action="spDrawerTab" data-tab="flash">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/></svg>
      Flashcards
    </button>
    <button class="sp-drawer-tab" id="sp-tab-pq" role="tab" aria-selected="false" aria-controls="sp-panel-pq" data-action="spDrawerTab" data-tab="pq">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
      Practice Q's
    </button>
    <button class="sp-drawer-tab" id="sp-tab-exam" role="tab" aria-selected="false" aria-controls="sp-panel-exam" data-action="spDrawerTab" data-tab="exam">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      Mini Exam
    </button>
  </div>

  <!-- Key terms -->
  <div id="sp-explain-chips"></div>

  <!-- EXPLAIN VIEW -->
  <div id="sp-view-explain" role="tabpanel" aria-labelledby="sp-tab-explain" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;">
    <div id="sp-explain-body" style="flex:1;overflow-y:auto;padding:20px 22px 32px;font-size:13.5px;line-height:1.85;color:var(--text-2);">
      <div class="sp-explain-spinner"></div>
    </div>
  </div>

  <!-- FLASHCARD VIEW -->
  <div id="sp-view-flash" role="tabpanel" aria-labelledby="sp-tab-flash" style="flex:1;display:none;flex-direction:column;overflow:hidden;">
    <div id="sp-fc-loading" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--text-3);">
      <div class="sp-explain-spinner"></div>
      <div style="font-size:12px;">Generating flashcards…</div>
    </div>
    <div id="sp-fc-deck" style="flex:1;display:none;flex-direction:column;padding:16px 20px;gap:12px;overflow:hidden;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="flex:1;height:3px;background:var(--surface-3);border-radius:2px;overflow:hidden;">
          <div id="sp-fc-progress-bar" style="height:100%;background:var(--gold);border-radius:2px;transition:width 0.3s;width:0%;"></div>
        </div>
        <span id="sp-fc-counter" style="font-size:11px;font-family:var(--font-mono);color:var(--text-4);flex-shrink:0;">1 / 10</span>
      </div>
      <div class="sp-fc-scene" data-action="spFcFlip">
        <div class="sp-fc-card" id="sp-fc-card">
          <div class="sp-fc-front">
            <div class="sp-fc-side-label">Question</div>
            <div id="sp-fc-front-text" class="sp-fc-text"></div>
            <div class="sp-fc-tap-hint">Tap to reveal answer</div>
          </div>
          <div class="sp-fc-back">
            <div class="sp-fc-side-label" style="color:var(--teal);">Answer</div>
            <div id="sp-fc-back-text" class="sp-fc-text"></div>
          </div>
        </div>
      </div>
      <div id="sp-fc-ratings" style="display:none;gap:8px;">
        <button class="sp-fc-rate-btn hard" onclick="spFcRate('hard')">😓 Hard</button>
        <button class="sp-fc-rate-btn ok"   onclick="spFcRate('ok')">🤔 OK</button>
        <button class="sp-fc-rate-btn easy" onclick="spFcRate('easy')">😄 Easy</button>
      </div>
    </div>
    <div id="sp-fc-complete" style="flex:1;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;">
      <div style="font-size:32px;">🎉</div>
      <div style="font-family:var(--font-head);font-size:16px;font-weight:700;color:var(--text-1);">Deck Complete!</div>
      <div id="sp-fc-result-text" style="font-size:12px;color:var(--text-3);line-height:1.6;"></div>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <button data-action="spFcRestart" style="padding:8px 16px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-2);font-size:12px;cursor:pointer;font-family:var(--font-body);">Restart</button>
        <button data-action="spDrawerTab" data-tab="explain" style="padding:8px 16px;border-radius:var(--r-pill);background:var(--gold);border:none;color:#090900;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-body);">Back to Explain</button>
      </div>
    </div>
  </div>

  <!-- PRACTICE Q's VIEW -->
  <div id="sp-view-pq" style="flex:1;display:none;flex-direction:column;overflow:hidden;">
    <div id="sp-pq-loading" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--text-3);">
      <div class="sp-explain-spinner"></div>
      <div style="font-size:12px;">Generating questions…</div>
    </div>
    <div id="sp-pq-question-view" style="flex:1;display:none;flex-direction:column;padding:16px 20px;gap:12px;overflow:hidden;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="flex:1;height:3px;background:var(--surface-3);border-radius:2px;overflow:hidden;">
          <div id="sp-pq-progress-bar" style="height:100%;background:var(--teal);border-radius:2px;transition:width 0.3s;width:0%;"></div>
        </div>
        <span id="sp-pq-counter" style="font-size:11px;font-family:var(--font-mono);color:var(--text-4);flex-shrink:0;">1 / 5</span>
      </div>
      <div style="background:var(--surface-2);border:1px solid var(--border-sm);border-radius:var(--r-lg);padding:16px 18px;">
        <div style="font-family:var(--font-mono);font-size:10px;color:var(--teal);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">Question</div>
        <div id="sp-pq-question-text" style="font-size:14px;font-weight:600;color:var(--text-1);line-height:1.5;"></div>
      </div>
      <div id="sp-pq-input-wrap" style="display:flex;flex-direction:column;gap:8px;">
        <textarea id="sp-pq-answer-input" placeholder="Type your answer here…" rows="3"
          style="width:100%;background:var(--surface-2);border:1px solid var(--border-sm);border-radius:var(--r-md);padding:12px 14px;font-family:var(--font-body);font-size:13px;color:var(--text-1);resize:none;outline:none;transition:border-color var(--t-fast);line-height:1.5;"
          onfocus="this.style.borderColor='rgba(45,212,191,0.4)'" onblur="this.style.borderColor=''"
          onkeydown="if(event.key==='Enter'&&(event.ctrlKey||event.metaKey))spPqSubmit()"></textarea>
        <button data-action="spPqSubmit" id="sp-pq-submit-btn"
          style="align-self:flex-end;padding:8px 20px;border-radius:var(--r-pill);background:var(--teal);border:none;color:#051a18;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font-body);transition:opacity var(--t-fast);">
          Submit Answer
        </button>
      </div>
      <div id="sp-pq-result" style="display:none;flex-direction:column;gap:10px;overflow-y:auto;">
        <div id="sp-pq-verdict" style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-radius:var(--r-md);font-size:13px;font-weight:600;"></div>
        <div id="sp-pq-explanation" style="font-size:12.5px;color:var(--text-2);line-height:1.7;padding:12px 14px;background:var(--surface-2);border:1px solid var(--border-xs);border-radius:var(--r-md);"></div>
        <button data-action="spPqNext" id="sp-pq-next-btn"
          style="align-self:flex-end;padding:8px 20px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-1);font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-body);">
          Next Question →
        </button>
      </div>
    </div>
    <div id="sp-pq-complete" style="flex:1;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;">
      <div id="sp-pq-complete-emoji" style="font-size:36px;">🎯</div>
      <div style="font-family:var(--font-head);font-size:16px;font-weight:700;color:var(--text-1);">Practice Complete!</div>
      <div id="sp-pq-complete-text" style="font-size:12px;color:var(--text-3);line-height:1.6;"></div>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <button data-action="spPqRestart" style="padding:8px 16px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-2);font-size:12px;cursor:pointer;font-family:var(--font-body);">Retry</button>
        <button data-action="spDrawerTab" data-tab="exam" style="padding:8px 16px;border-radius:var(--r-pill);background:var(--teal);border:none;color:#051a18;font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font-body);">Take Mini Exam →</button>
      </div>
    </div>
  </div>

  <!-- MINI EXAM VIEW -->
  <div id="sp-view-exam" style="flex:1;display:none;flex-direction:column;overflow:hidden;">
    <div id="sp-exam-loading" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;color:var(--text-3);">
      <div class="sp-explain-spinner" style="border-top-color:var(--red);"></div>
      <div style="font-size:12px;">Generating exam…</div>
    </div>
    <div id="sp-exam-intro" style="flex:1;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;">
      <div style="width:52px;height:52px;border-radius:var(--r-lg);background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.25);display:flex;align-items:center;justify-content:center;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      </div>
      <div style="font-family:var(--font-head);font-size:16px;font-weight:700;color:var(--text-1);">Mini Exam Ready</div>
      <div style="font-size:12px;color:var(--text-3);line-height:1.6;">10 questions · Timed · Pass at 70% to unlock next concept</div>
      <div id="sp-exam-timer-display" style="font-family:var(--font-mono);font-size:28px;font-weight:700;color:var(--red);">5:00</div>
      <button data-action="spExamStart" style="padding:10px 28px;border-radius:var(--r-pill);background:var(--red);border:none;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font-body);">Start Exam</button>
    </div>
    <div id="sp-exam-question-view" style="flex:1;display:none;flex-direction:column;padding:14px 18px;gap:10px;overflow:hidden;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:8px;flex:1;">
          <div style="flex:1;height:3px;background:var(--surface-3);border-radius:2px;overflow:hidden;">
            <div id="sp-exam-progress-bar" style="height:100%;background:var(--red);border-radius:2px;transition:width 0.3s;width:0%;"></div>
          </div>
          <span id="sp-exam-counter" style="font-size:11px;font-family:var(--font-mono);color:var(--text-4);flex-shrink:0;">1/10</span>
        </div>
        <div id="sp-exam-timer" style="font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--red);margin-left:12px;flex-shrink:0;">5:00</div>
      </div>
      <div style="background:var(--surface-2);border:1px solid var(--border-sm);border-radius:var(--r-md);padding:14px 16px;flex-shrink:0;">
        <div id="sp-exam-q-text" style="font-size:13px;font-weight:600;color:var(--text-1);line-height:1.5;"></div>
      </div>
      <div id="sp-exam-options" style="display:flex;flex-direction:column;gap:7px;overflow-y:auto;flex:1;"></div>
    </div>
    <div id="sp-exam-results" style="flex:1;display:none;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;overflow-y:auto;">
      <div id="sp-exam-result-emoji" style="font-size:40px;"></div>
      <div id="sp-exam-result-title" style="font-family:var(--font-head);font-size:18px;font-weight:800;color:var(--text-1);"></div>
      <div id="sp-exam-result-score" style="font-family:var(--font-mono);font-size:32px;font-weight:700;"></div>
      <div id="sp-exam-result-sub" style="font-size:12px;color:var(--text-3);line-height:1.6;max-width:300px;"></div>
      <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap;justify-content:center;">
        <button data-action="spExamRestart" style="padding:8px 16px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-2);font-size:12px;cursor:pointer;font-family:var(--font-body);">Retry Exam</button>
        <button data-action="spDrawerTab" data-tab="explain" style="padding:8px 16px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-2);font-size:12px;cursor:pointer;font-family:var(--font-body);">Back to Explain</button>
      </div>
    </div>
  </div>

</div><!-- /#sp-explain-drawer -->
`;

// ── Mount ─────────────────────────────────────────────────────────────────────

export function mountStudyPlanScreen() {
  const screenPlaceholder = document.querySelector('[data-studyplan-screen]');
  if (!screenPlaceholder) {
    console.warn('[StudyPlanScreen] placeholder [data-studyplan-screen] not found');
    return;
  }
  screenPlaceholder.outerHTML = STUDYPLAN_HTML;

  const drawerPlaceholder = document.querySelector('[data-sp-explain-drawer]');
  if (!drawerPlaceholder) {
    console.warn('[StudyPlanScreen] placeholder [data-sp-explain-drawer] not found');
    return;
  }
  drawerPlaceholder.outerHTML = SP_EXPLAIN_DRAWER_HTML;
}

// ── Auto-mount (synchronous) ──────────────────────────────────────────────────
mountStudyPlanScreen();

console.log('[StudyPlanScreen] module loaded ✦');
