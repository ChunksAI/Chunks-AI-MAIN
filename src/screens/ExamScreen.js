// @ts-nocheck
/**
 * src/screens/ExamScreen.js — Task 29
 *
 * Owns:
 *   • #screen-exam HTML injection (replaces data-exam-screen placeholder)
 *
 * All exam logic (examStart, examAbort, examSkip, examNext, examRetry,
 * examNewTopic, examSelectType, examSelectDiff, examSelectScanMode,
 * examSrcTab, examHandlePdfFile, examDragOver, examDragLeave, examDrop,
 * examClearSource, examClearNotes, _examCallAPI, etc.) remains in the
 * large exam script block in index.html — those will move in a later phase.
 */

// ── HTML template ─────────────────────────────────────────────────────────────

const EXAM_HTML = /* html */`
<div class="screen" id="screen-exam" style="flex-direction:row;overflow:hidden;">

  <aside class="sidebar" data-sidebar-screen="exam"></aside>

  <!-- Main exam area -->
  <main class="exam-main">
    <div class="exam-wrap">

      <!-- SETUP VIEW -->
      <div id="exam-setup">

        <!-- Back to Workspace button (shown when navigated from workspace chat) -->
        <div id="exam-back-to-ws" style="display:none;margin-bottom:12px;">
          <button onclick="wsBackToWorkspace()" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:var(--surface-2);border:1px solid var(--border-sm);border-radius:var(--r-pill);color:var(--text-3);font-size:11px;font-family:var(--font-body);cursor:pointer;transition:background 0.15s;" onmouseenter="this.style.background='var(--surface-3)'" onmouseleave="this.style.background='var(--surface-2)'">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
            <span class="exam-back-label">← Back to Workspace</span>
          </button>
        </div>

        <!-- Top row: Exam Mode label + history button -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:32px;gap:12px;">
          <div>
            <div style="font-family:var(--font-mono);font-size:10px;color:var(--gold);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;">Exam Mode</div>
            <h1 style="font-family:var(--font-head);font-size:20px;font-weight:800;color:var(--text-1);">Test Your Knowledge</h1>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
            <div id="exam-adaptive-badge" style="display:none;align-items:center;gap:5px;padding:4px 10px;background:rgba(139,124,248,0.12);border:1px solid rgba(139,124,248,0.3);border-radius:20px;font-size:10px;color:var(--violet);font-weight:600;letter-spacing:0.04em;">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              ADAPTIVE ON
            </div>
            <button onclick="examShowHistory()" style="display:flex;align-items:center;gap:6px;padding:7px 13px;background:var(--surface-2);border:1px solid var(--border-sm);border-radius:var(--r-sm);color:var(--text-3);font-size:11px;font-family:var(--font-body);cursor:pointer;white-space:nowrap;transition:background 0.15s;" onmouseenter="this.style.background='var(--surface-3)'" onmouseleave="this.style.background='var(--surface-2)'">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              History
            </button>
          </div>
        </div>

        <!-- ══ WIZARD ══════════════════════════════════════════════════════ -->
        <div class="ewiz-wrap">

          <!-- Step trail -->
          <div class="ewiz-trail">
            <div class="ewiz-dot active" id="ewiz-dot-1"></div>
            <div class="ewiz-trail-line" id="ewiz-line-1"></div>
            <div class="ewiz-dot" id="ewiz-dot-2"></div>
            <div class="ewiz-trail-line" id="ewiz-line-2"></div>
            <div class="ewiz-dot" id="ewiz-dot-3"></div>
          </div>

          <!-- ── STEP 1: What are you studying? ────────────────────────── -->
          <div class="ewiz-step" id="ewiz-step-1">
            <div class="ewiz-step-lbl">STEP 1 OF 3</div>
            <h2 class="ewiz-heading">What are you studying?</h2>
            <p class="ewiz-sub">Enter a topic, chapter, or concept — or attach your study material below.</p>

            <input class="ewiz-topic-inp" id="exam-topic-input" type="text" placeholder="e.g. Thermodynamics, Chapter 7…" autocomplete="off" />

            <!-- Pill toggles for PDF / Notes -->
            <div class="ewiz-attach-row">
              <button class="ewiz-pill-btn" id="ewiz-pdf-btn" onclick="_ewizTogglePdf()">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                + Attach PDF
              </button>
              <button class="ewiz-pill-btn" id="ewiz-notes-btn" onclick="_ewizToggleNotes()">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                + Paste notes
              </button>
            </div>

            <!-- PDF zone (hidden until toggled) -->
            <div class="ewiz-attach-zone" id="exam-src-pdf" style="display:none;">
              <input type="file" id="exam-pdf-file" accept="application/pdf" style="display:none;" onchange="examHandlePdfFile(this)">
              <div class="exam-upload-zone" id="exam-upload-zone"
                   onclick="if(!this.classList.contains('has-file'))document.getElementById('exam-pdf-file').click()"
                   ondragover="examDragOver(event)" ondragleave="examDragLeave(event)" ondrop="examDrop(event)">
                <div id="exam-upload-idle">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-4);margin-bottom:8px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <div style="font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:3px;">Drop a PDF here or click to browse</div>
                  <div style="font-size:11px;color:var(--text-4);">Questions will be generated from your document's content</div>
                </div>
                <div id="exam-upload-attached" style="display:none;width:100%;">
                  <div class="exam-file-badge">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span id="exam-file-name">document.pdf</span>
                    <span id="exam-file-pages" style="color:var(--text-4);margin-left:auto;flex-shrink:0;"></span>
                    <button class="exam-file-clear" data-action="examClearSource" title="Remove">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <div id="exam-extract-status" style="font-size:11px;color:var(--text-4);margin-top:6px;display:flex;align-items:center;gap:5px;"></div>
                </div>
              </div>
            </div>

            <!-- Notes zone (hidden until toggled) -->
            <div class="ewiz-attach-zone" id="exam-src-notes" style="display:none;">
              <textarea id="exam-notes-input" class="exam-input exam-notes-area"
                placeholder="Paste your study notes, lecture slides text, or any content you want the exam based on…"></textarea>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;">
                <span id="exam-notes-count" style="font-size:10px;color:var(--text-4);font-family:var(--font-mono);">0 chars</span>
                <button data-action="examClearNotes" class="hover-clear-btn" style="font-size:10px;color:var(--text-4);background:none;border:none;cursor:pointer;font-family:var(--font-body);">Clear</button>
              </div>
            </div>

            <!-- Scan mode (shown only when PDF is attached) -->
            <div class="exam-field" id="exam-scan-mode-field" style="display:none;margin-top:16px;">
              <label style="display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-3);margin-bottom:8px;">Generation Mode</label>
              <div class="exam-scan-grid">
                <div class="exam-scan-card active" data-mode="quick" data-action="examSelectScanMode-self">
                  <div class="exam-scan-top"><span class="exam-scan-icon">⚡</span><span class="exam-scan-badge" style="background:rgba(45,212,191,0.12);color:var(--teal);">~4s</span></div>
                  <div class="exam-scan-name">Quick</div>
                  <div class="exam-scan-desc">Fixed question count from your material. Fast, great for a quick quiz.</div>
                </div>
                <div class="exam-scan-card" data-mode="smart" data-action="examSelectScanMode-self">
                  <div class="exam-scan-top"><span class="exam-scan-icon">🧠</span><span class="exam-scan-badge" style="background:rgba(139,124,248,0.12);color:var(--violet);">~6s</span></div>
                  <div class="exam-scan-name">Smart</div>
                  <div class="exam-scan-desc">AI reads the full document first, then generates questions covering every section.</div>
                </div>
                <div class="exam-scan-card" data-mode="deep" data-action="examSelectScanMode-self">
                  <div class="exam-scan-top"><span class="exam-scan-icon">🔬</span><span class="exam-scan-badge" style="background:rgba(232,172,46,0.12);color:var(--gold);">~20s</span></div>
                  <div class="exam-scan-name">Deep Scan</div>
                  <div class="exam-scan-desc">Chunks your document, extracts every concept, and generates one question per concept.</div>
                </div>
              </div>
              <div id="exam-deep-note" style="display:none;margin-top:8px;font-size:11px;color:var(--text-4);padding:8px 12px;background:var(--gold-muted);border:1px solid var(--gold-border);border-radius:var(--r-sm);line-height:1.5;">
                🔬 Deep Scan generates <strong style="color:var(--gold);">one question per concept</strong> found across your entire document.
              </div>
            </div>

            <!-- Step footer -->
            <div class="ewiz-footer">
              <span id="ewiz-step1-hint" class="ewiz-step1-hint">Enter a topic or attach material to continue</span>
              <button class="ewiz-btn-primary" id="ewiz-choose-format-btn" onclick="ewizNext()" disabled>
                Choose format
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          </div><!-- /ewiz-step-1 -->

          <!-- ── STEP 2: Pick a format ──────────────────────────────────── -->
          <div class="ewiz-step" id="ewiz-step-2" style="display:none;">
            <div class="ewiz-step-lbl">STEP 2 OF 3</div>
            <h2 class="ewiz-heading">Pick a format</h2>
            <p class="ewiz-sub">Choose a template — you can customize sections and settings in the next step.</p>

            <div class="ewiz-tpl-grid">

              <div class="ewiz-tpl-card exam-tpl-card" data-tpl="quickquiz" onclick="examSelectTemplate('quickquiz');_ewizOnTplSelect()">
                <div class="ewiz-tpl-check" id="ewiz-tpl-check-quickquiz">✓</div>
                <span class="ewiz-tpl-icon">⚡</span>
                <div class="ewiz-tpl-name">Quick quiz</div>
                <div class="ewiz-tpl-desc">10-question check for a single topic</div>
                <span class="ewiz-tpl-pts ewiz-pts-amber">25 pts</span>
              </div>

              <div class="ewiz-tpl-card exam-tpl-card" data-tpl="university" onclick="examSelectTemplate('university');_ewizOnTplSelect()">
                <div class="ewiz-tpl-check" id="ewiz-tpl-check-university">✓</div>
                <span class="ewiz-tpl-icon">🎓</span>
                <div class="ewiz-tpl-name">University standard</div>
                <div class="ewiz-tpl-desc">Classic format for most college courses</div>
                <span class="ewiz-tpl-pts ewiz-pts-blue">100 pts</span>
              </div>

              <div class="ewiz-tpl-card exam-tpl-card" data-tpl="sciencemidterm" onclick="examSelectTemplate('sciencemidterm');_ewizOnTplSelect()">
                <div class="ewiz-tpl-check" id="ewiz-tpl-check-sciencemidterm">✓</div>
                <span class="ewiz-tpl-icon">🔬</span>
                <div class="ewiz-tpl-name">Science midterm</div>
                <div class="ewiz-tpl-desc">Problem-solving heavy with short answer</div>
                <span class="ewiz-tpl-pts ewiz-pts-green">85 pts</span>
              </div>

              <div class="ewiz-tpl-card exam-tpl-card" data-tpl="boardexam" onclick="examSelectTemplate('boardexam');_ewizOnTplSelect()">
                <div class="ewiz-tpl-check" id="ewiz-tpl-check-boardexam">✓</div>
                <span class="ewiz-tpl-icon">📋</span>
                <div class="ewiz-tpl-name">Board exam drill</div>
                <div class="ewiz-tpl-desc">High-volume MC for medical boards</div>
                <span class="ewiz-tpl-pts ewiz-pts-amber">100 pts</span>
              </div>

              <div class="ewiz-tpl-card exam-tpl-card" data-tpl="comprehensive" onclick="examSelectTemplate('comprehensive');_ewizOnTplSelect()">
                <div class="ewiz-tpl-check" id="ewiz-tpl-check-comprehensive">✓</div>
                <span class="ewiz-tpl-icon">🏆</span>
                <div class="ewiz-tpl-name">Comprehensive final</div>
                <div class="ewiz-tpl-desc">Full coverage with all question types</div>
                <span class="ewiz-tpl-pts ewiz-pts-blue">120 pts</span>
              </div>

              <div class="ewiz-tpl-card ewiz-tpl-custom exam-tpl-card" data-tpl="custom" onclick="examSelectTemplate('custom');_ewizOnTplSelect()">
                <div class="ewiz-tpl-check" id="ewiz-tpl-check-custom">✓</div>
                <span class="ewiz-tpl-icon ewiz-tpl-custom-icon">+</span>
                <div class="ewiz-tpl-name">Custom</div>
                <div class="ewiz-tpl-desc">Build your own from scratch</div>
              </div>

            </div><!-- /ewiz-tpl-grid -->

            <!-- Step footer -->
            <div class="ewiz-footer">
              <button class="ewiz-btn-ghost" onclick="ewizBack()">← Back</button>
              <button class="ewiz-btn-primary ewiz-disabled" id="ewiz-customize-btn" onclick="if(_examActiveTemplate)ewizNext()" disabled>
                Customize
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          </div><!-- /ewiz-step-2 -->

          <!-- ── STEP 3: Customize your exam ───────────────────────────── -->
          <div class="ewiz-step" id="ewiz-step-3" style="display:none;">
            <div class="ewiz-step-lbl">STEP 3 OF 3</div>
            <h2 class="ewiz-heading">Customize your exam</h2>

            <!-- Sections card -->
            <div class="ewiz-sections-card" id="exam-sections-wrap">
              <div class="ewiz-sec-hdr">
                <span id="exam-sections-title">EXAM SECTIONS</span>
              </div>
              <div class="exam-sections-table ewiz-sec-table">
                <div class="exam-sections-thead">
                  <span>Section</span>
                  <span>Qty</span>
                  <span>Pts ea.</span>
                  <span>Subtotal</span>
                  <span></span>
                </div>
                <div id="exam-sections-body"></div>
              </div>
              <div id="exam-section-add-picker" style="display:none;" class="exam-section-type-picker ewiz-chip-tray"></div>
              <button class="ewiz-add-section-btn exam-section-add-btn" onclick="examSectionAdd()">+ Add a section</button>
            </div>

            <!-- Live summary bar -->
            <div class="ewiz-summary-bar exam-summary-bar">
              <div class="ewiz-sum-item exam-summary-stat">
                <span class="ess-label">Sections</span>
                <span class="ess-value" id="sum-sections">0</span>
              </div>
              <div class="ewiz-sum-item exam-summary-stat">
                <span class="ess-label">Questions</span>
                <span class="ess-value" id="sum-questions">0</span>
              </div>
              <div class="ewiz-sum-item exam-summary-stat">
                <span class="ess-label">Total pts</span>
                <span class="ess-value ess-gold ewiz-sum-amber" id="sum-points">0 pts</span>
              </div>
              <div class="ewiz-sum-item exam-summary-stat">
                <span class="ess-label">Est. time</span>
                <span class="ess-value" id="sum-duration">—</span>
              </div>
            </div>

            <!-- Settings row: Time + Difficulty -->
            <div class="ewiz-settings-row">
              <div class="ewiz-setting">
                <div class="ewiz-setting-label">Time limit</div>
                <select class="ewiz-select exam-input" id="exam-time-input">
                  <option value="0">No limit</option>
                  <option value="600">10 min</option>
                  <option value="1200">20 min</option>
                  <option value="1800">30 min</option>
                  <option value="2700">45 min</option>
                  <option value="3600">1 hour</option>
                  <option value="7200">2 hours</option>
                </select>
              </div>
              <div class="ewiz-setting">
                <div class="ewiz-setting-label">Difficulty</div>
                <div class="ewiz-diff-group">
                  <button class="ewiz-diff-btn exam-type-btn" data-diff="easy" data-action="examSelectDiff-self">Easy</button>
                  <button class="ewiz-diff-btn exam-type-btn active" data-diff="medium" data-action="examSelectDiff-self">Medium</button>
                  <button class="ewiz-diff-btn exam-type-btn" data-diff="hard" data-action="examSelectDiff-self">Hard</button>
                  <button class="ewiz-diff-btn exam-type-btn ewiz-diff-ai" data-diff="adaptive" data-action="examSelectDiff-self">AI</button>
                </div>
              </div>
            </div>

            <!-- Error display -->
            <div id="exam-error" class="ewiz-error-msg" style="display:none;"></div>

            <!-- Generate Exam button -->
            <button class="ewiz-gen-btn" id="exam-start-btn" data-action="examStart">
              <span class="ewiz-star">✦</span>
              Generate Exam
            </button>

            <!-- Change template link -->
            <div class="ewiz-change-tpl">
              <button onclick="ewizBack()">← Change template</button>
            </div>
          </div><!-- /ewiz-step-3 -->

        </div><!-- /ewiz-wrap -->

        <!-- ══ SAVED EXAMS ══════════════════════════════════════════════════ -->
        <div id="exam-saved-section" style="display:none;margin-top:28px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:0.07em;text-transform:uppercase;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:4px;vertical-align:-1px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Saved Exams
            </div>
          </div>
          <div id="exam-saved-list" style="display:flex;flex-direction:column;gap:6px;"></div>
        </div>

      </div><!-- /exam-setup -->

      <!-- LOADING -->
      <div id="exam-loading" style="display:none;text-align:center;padding:60px 24px;">
        <div style="display:flex;justify-content:center;gap:5px;margin-bottom:16px;">
          <span style="width:6px;height:6px;border-radius:50%;background:var(--gold);animation:blink 1s ease-in-out infinite;display:inline-block;"></span>
          <span style="width:6px;height:6px;border-radius:50%;background:var(--gold);animation:blink 1s ease-in-out 0.2s infinite;display:inline-block;"></span>
          <span style="width:6px;height:6px;border-radius:50%;background:var(--gold);animation:blink 1s ease-in-out 0.4s infinite;display:inline-block;"></span>
        </div>
        <div style="font-family:var(--font-head);font-size:15px;font-weight:700;color:var(--text-1);margin-bottom:6px;" id="exam-loading-text">Generating your exam…</div>
        <div style="font-size:12px;color:var(--text-4);">Writing questions on <span id="exam-loading-topic" style="color:var(--gold);"></span></div>
        <div id="exam-loading-adaptive" style="display:none;margin-top:8px;font-size:11px;color:var(--violet);font-weight:500;"></div>

        <!-- Deep scan progress (hidden for quick/smart) -->
        <div id="exam-deep-progress" style="display:none;margin-top:28px;max-width:400px;margin-left:auto;margin-right:auto;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span id="exam-deep-step-text" style="font-size:11px;color:var(--text-3);font-family:var(--font-mono);text-align:left;"></span>
            <span id="exam-deep-pct" style="font-size:11px;color:var(--gold);font-family:var(--font-mono);">0%</span>
          </div>
          <div style="height:3px;background:var(--surface-4);border-radius:2px;overflow:hidden;">
            <div id="exam-deep-bar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--gold),var(--violet));border-radius:2px;transition:width 0.4s ease;"></div>
          </div>
          <div id="exam-deep-stages" style="display:flex;justify-content:space-between;margin-top:12px;gap:6px;">
            <div class="exam-deep-stage" id="stage-chunk">
              <div class="exam-deep-stage-dot"></div>
              <div class="exam-deep-stage-label">Split</div>
            </div>
            <div class="exam-deep-stage-line"></div>
            <div class="exam-deep-stage" id="stage-extract">
              <div class="exam-deep-stage-dot"></div>
              <div class="exam-deep-stage-label">Extract</div>
            </div>
            <div class="exam-deep-stage-line"></div>
            <div class="exam-deep-stage" id="stage-generate">
              <div class="exam-deep-stage-dot"></div>
              <div class="exam-deep-stage-label">Generate</div>
            </div>
          </div>
        </div>
      </div><!-- /exam-loading -->

      <!-- QUIZ VIEW -->
      <div id="exam-quiz" style="display:none;">
        <div class="exam-topbar">
          <button data-action="examAbort" class="hover-abort-btn" style="background:transparent;border:none;color:var(--text-4);cursor:pointer;font-size:12px;font-family:var(--font-body);display:flex;align-items:center;gap:4px;padding:0;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
            Exit
          </button>
          <div class="exam-progress-wrap">
            <div class="exam-progress-label">
              <span id="exam-q-label">Question 1 of 10</span>
              <span id="exam-score-live">0 correct</span>
            </div>
            <div class="exam-progress-track">
              <div class="exam-progress-fill" id="exam-progress-fill" style="width:0%"></div>
            </div>
          </div>
          <div class="exam-timer" id="exam-timer-display">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span id="exam-timer-text">--:--</span>
          </div>
          <div id="exam-adaptive-diff-badge" style="display:none;font-size:10px;font-weight:600;padding:3px 9px;background:rgba(139,124,248,0.12);border:1px solid rgba(139,124,248,0.3);border-radius:20px;color:var(--violet);white-space:nowrap;"></div>
        </div>

        <div id="exam-q-card" class="exam-q-card">
          <div class="exam-q-header">
            <div id="exam-q-ref" style="display:none;" class="exam-q-ref">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <span id="exam-q-ref-text"></span>
            </div>
            <div class="exam-q-num" id="exam-q-num">QUESTION 1</div>
            <!-- CBL Clinical Vignette Card -->
            <div id="exam-cbl-card" style="display:none;" class="exam-cbl-card">
              <div class="exam-cbl-header">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                <span>Clinical Vignette</span>
                <span id="exam-cbl-tag" class="exam-cbl-tag"></span>
              </div>
              <div id="exam-cbl-vitals" class="exam-cbl-vitals"></div>
              <div id="exam-cbl-body" class="exam-cbl-body"></div>
            </div>
            <div class="exam-q-text" id="exam-q-text">Loading…</div>
          </div>
          <div class="exam-options" id="exam-options"></div>
          <!-- Open-ended answer area (shown instead of options for open-ended questions) -->
          <div id="exam-openended-area" style="display:none;padding:0 0 8px;">
            <textarea id="exam-openended-input"
              placeholder="Type your answer here… Aim for 2–5 sentences. The AI will evaluate your response for accuracy and completeness."
              style="width:100%;min-height:110px;padding:12px 14px;background:var(--surface-3);border:1px solid var(--border-sm);border-radius:var(--r-sm);color:var(--text-1);font-size:13px;font-family:var(--font-body);line-height:1.6;resize:vertical;box-sizing:border-box;"
              oninput="examOpenEndedInput(this)"></textarea>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;">
              <span id="exam-oe-char-count" style="font-size:10px;color:var(--text-4);font-family:var(--font-mono);">0 chars</span>
              <span id="exam-oe-hint" style="font-size:10px;color:var(--text-4);">Press Next to submit for AI grading</span>
            </div>
          </div>
          <div class="exam-feedback" id="exam-feedback"></div>
        </div>

        <div class="exam-nav">
          <div style="font-size:11px;color:var(--text-4);" id="exam-answered-hint"></div>
          <div style="display:flex;gap:8px;">
            <button class="exam-nav-btn secondary" id="exam-skip-btn" data-action="examSkip">Skip</button>
            <button class="exam-nav-btn primary" id="exam-next-btn" data-action="examNext" disabled>Next →</button>
          </div>
        </div>
      </div><!-- /exam-quiz -->

      <!-- RESULTS VIEW -->
      <div id="exam-results" style="display:none;">
        <div style="margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-4);letter-spacing:0.06em;margin-bottom:4px;">EXAM COMPLETE</div>
            <div style="font-family:var(--font-head);font-size:18px;font-weight:700;color:var(--text-1);" id="results-topic-title"></div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button id="exam-share-btn" onclick="shareExamResults(this)" style="display:flex;align-items:center;gap:5px;padding:6px 12px;background:var(--surface-2);border:1px solid var(--border-sm);border-radius:var(--r-sm);color:var(--text-3);font-size:11px;font-family:var(--font-body);cursor:pointer;" onmouseenter="this.style.background='var(--surface-3)'" onmouseleave="this.style.background='var(--surface-2)'">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              Share
            </button>
            <button onclick="examShowHistory()" style="display:flex;align-items:center;gap:5px;padding:6px 12px;background:var(--surface-2);border:1px solid var(--border-sm);border-radius:var(--r-sm);color:var(--text-3);font-size:11px;font-family:var(--font-body);cursor:pointer;" onmouseenter="this.style.background='var(--surface-3)'" onmouseleave="this.style.background='var(--surface-2)'">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              View History
            </button>
          </div>
        </div>
        <div class="exam-results-card">
          <div class="exam-results-header">
            <div class="exam-score-ring" id="score-ring">0%</div>
            <h3 id="results-headline">Good effort!</h3>
            <p id="results-subline">Review the questions below to see where you went wrong.</p>
          </div>
          <div class="exam-stats-row">
            <div class="exam-stat">
              <div class="exam-stat-num" id="stat-correct">0</div>
              <div class="exam-stat-label">Correct</div>
            </div>
            <div class="exam-stat">
              <div class="exam-stat-num" id="stat-wrong" style="color:var(--text-3);">0</div>
              <div class="exam-stat-label">Wrong / Skipped</div>
            </div>
            <div class="exam-stat">
              <div class="exam-stat-num" id="stat-time-taken">—</div>
              <div class="exam-stat-label">Time Taken</div>
            </div>
            <div class="exam-stat">
              <div class="exam-stat-num" id="stat-streak">0</div>
              <div class="exam-stat-label">Best Streak</div>
            </div>
          </div>
          <div class="exam-review" id="exam-review-list"></div>

          <!-- ── Weak Concepts Panel (shown when student got questions wrong) ── -->
          <div id="exam-weak-panel" style="display:none; margin:0 24px 4px; padding:16px 18px; background:rgba(248,113,113,0.06); border:1px solid rgba(248,113,113,0.18); border-radius:var(--r-sm);">
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span style="font-size:11px;font-weight:700;color:#f87171;letter-spacing:0.06em;text-transform:uppercase;">Concepts to Review</span>
              <span id="exam-weak-count" style="font-size:10px;color:var(--text-4);font-family:var(--font-mono);margin-left:auto;"></span>
            </div>
            <div id="exam-weak-chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;"></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="exam-nav-btn secondary" id="exam-goto-flash-btn" onclick="examGoToFlashcards()" style="font-size:11px;padding:7px 14px;display:flex;align-items:center;gap:6px;">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                Study with Flashcards
              </button>
              <button class="exam-nav-btn secondary" id="exam-goto-visual-btn" onclick="examGoToVisualTutor()" style="font-size:11px;padding:7px 14px;display:flex;align-items:center;gap:6px;">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                Explain with Visual Tutor
              </button>
              <!-- Task 6: Review weak concepts directly in workspace chat -->
              <button class="exam-nav-btn secondary" id="exam-goto-chat-btn" onclick="examGoToChat()" style="font-size:11px;padding:7px 14px;display:flex;align-items:center;gap:6px;border-color:var(--border-md);color:var(--text-2);">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Review in Chat
              </button>
            </div>
          </div>

          <div class="exam-actions">
            <button class="exam-nav-btn primary" data-action="examRetry" style="flex:1;">
              Retake Exam
            </button>
            <button class="exam-nav-btn secondary" data-action="examNewTopic" style="flex:1;">
              New Topic
            </button>
            <!-- Feedback-loop: review flashcards after exam -->
            <button class="exam-nav-btn secondary" onclick="window.showScreen?.('flash')" style="flex:1;">
              📚 Review Flashcards
            </button>
          </div>
        </div>
      </div><!-- /exam-results -->

      <!-- ══ HISTORY VIEW (Task 2) ══════════════════════════════════════ -->
      <div id="exam-history-view" style="display:none;padding:0 0 40px;">

        <!-- Header -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px;">
          <button onclick="examHideHistory()" style="display:flex;align-items:center;gap:5px;background:transparent;border:none;color:var(--text-4);cursor:pointer;font-size:12px;font-family:var(--font-body);padding:0;" onmouseenter="this.style.color='var(--text-2)'" onmouseleave="this.style.color='var(--text-4)'">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </button>
          <div>
            <div style="font-family:var(--font-mono);font-size:10px;color:var(--gold);letter-spacing:0.08em;text-transform:uppercase;">Exam History</div>
            <div style="font-family:var(--font-head);font-size:18px;font-weight:700;color:var(--text-1);">Your Progress Over Time</div>
          </div>
          <button onclick="examClearHistory()" style="margin-left:auto;display:flex;align-items:center;gap:5px;padding:6px 11px;background:transparent;border:1px solid rgba(248,113,113,0.25);border-radius:var(--r-sm);color:#f87171;font-size:11px;font-family:var(--font-body);cursor:pointer;" onmouseenter="this.style.background='rgba(248,113,113,0.07)'" onmouseleave="this.style.background='transparent'">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            Clear All
          </button>
        </div>

        <!-- Summary stats -->
        <div id="exam-hist-summary" style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:24px;"></div>

        <!-- Score line graph -->
        <div id="exam-hist-graph" style="background:var(--surface-1);border:1px solid var(--border-xs);border-radius:var(--r-sm);padding:16px 18px;margin-bottom:24px;"></div>

        <!-- Topic progress section -->
        <div style="margin-bottom:24px;">
          <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:0.07em;text-transform:uppercase;margin-bottom:12px;">Progress by Topic</div>
          <div id="exam-hist-topics" style="display:flex;flex-direction:column;gap:10px;"></div>
        </div>

        <!-- Full history table -->
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--text-3);letter-spacing:0.07em;text-transform:uppercase;margin-bottom:12px;">All Attempts</div>
          <div id="exam-hist-table" style="display:flex;flex-direction:column;gap:6px;"></div>
        </div>

      </div><!-- /exam-history-view -->

    </div><!-- /exam-wrap -->
  </main>
</div><!-- /#screen-exam -->
`;

// ── Mount ─────────────────────────────────────────────────────────────────────

export function mountExamScreen() {
  const placeholder = document.querySelector('[data-exam-screen]');
  if (!placeholder) {
    console.warn('[ExamScreen] placeholder [data-exam-screen] not found');
    return;
  }
  placeholder.outerHTML = EXAM_HTML;

  // ── Enable/disable "Choose format" based on topic or material
  window._ewizUpdateNextBtn = function() {
    const btn  = document.getElementById('ewiz-choose-format-btn');
    const hint = document.getElementById('ewiz-step1-hint');
    if (!btn) return;
    const topic    = (document.getElementById('exam-topic-input')?.value || '').trim();
    const hasInput = topic.length > 0 || (window._examSourceText && window._examSourceText.length > 0);
    btn.disabled = !hasInput;
    if (hint) hint.style.display = hasInput ? 'none' : '';
  };

  // ── Wire notes textarea listener now that the DOM element exists
  const notesEl = document.getElementById('exam-notes-input');
  if (notesEl) {
    notesEl.addEventListener('input', () => {
      const len = notesEl.value.length;
      const countEl = document.getElementById('exam-notes-count');
      if (countEl) countEl.textContent = len.toLocaleString() + ' chars';
      window._examSourceText  = notesEl.value.slice(0, 100000);
      window._examSourceLabel = 'your notes';
      if (typeof window._examToggleScanMode === 'function') window._examToggleScanMode(len > 0);
      window._ewizUpdateNextBtn();
    });
  }

  // ── Task 3: Show adaptive badge when topic has history with weak concepts
  const topicInput = document.getElementById('exam-topic-input');
  const adaptiveBadge = document.getElementById('exam-adaptive-badge');
  if (topicInput && adaptiveBadge) {
    const updateBadge = () => {
      const ctx = typeof window._examGetWeakContext === 'function'
        ? window._examGetWeakContext(topicInput.value.trim())
        : null;
      adaptiveBadge.style.display = ctx ? 'flex' : 'none';
      if (ctx) {
        adaptiveBadge.title = `Focusing on: ${ctx.concepts.slice(0,3).join(', ')} (${ctx.attempts} past attempt${ctx.attempts>1?'s':''}, avg ${ctx.avgScore}%)`;
      }
    };
    topicInput.addEventListener('input', updateBadge);
    // Run once on mount in case topic was pre-filled
    setTimeout(updateBadge, 300);
  }

  // Wire topic input to button state
  if (topicInput) {
    topicInput.addEventListener('input', window._ewizUpdateNextBtn);
  }

  // Run once on mount to set initial state
  window._ewizUpdateNextBtn();
}

// ── Auto-mount (synchronous) ──────────────────────────────────────────────────
mountExamScreen();

console.log('[ExamScreen] module loaded ✦');


/* ═══════════════════════════════════════════════════════════════
   EXAM SOURCE MATERIAL — PDF upload + notes
═══════════════════════════════════════════════════════════════ */

let _examSourceText  = '';   // extracted PDF text or pasted notes
let _examSourceLabel = '';   // short label for loading screen
let _examSourceTab   = 'pdf';
let _pdfjsLibExam    = null;

/* ── Tab toggle ─────────────────────────────────────────── */
function examSrcTab(btn) {
  document.querySelectorAll('.exam-src-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _examSourceTab = btn.dataset.tab;
  document.getElementById('exam-src-pdf').style.display   = _examSourceTab === 'pdf'   ? '' : 'none';
  document.getElementById('exam-src-notes').style.display = _examSourceTab === 'notes' ? '' : 'none';
  // Clear the other source when switching
  if (_examSourceTab === 'pdf')   { examClearNotes(); }
  if (_examSourceTab === 'notes') { examClearSource(null, true); }
}

/* ── PDF.js lazy loader ──────────────────────────────────── */
function _loadPdfJsExam() {
  return new Promise((resolve, reject) => {
    if (_pdfjsLibExam) return resolve(_pdfjsLibExam);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      _pdfjsLibExam = window.pdfjsLib;
      _pdfjsLibExam.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(_pdfjsLibExam);
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js'));
    document.head.appendChild(script);
  });
}

/* ── Drag & drop handlers ────────────────────────────────── */
function examDragOver(e) {
  e.preventDefault();
  document.getElementById('exam-upload-zone').classList.add('drag-over');
}
function examDragLeave(e) {
  document.getElementById('exam-upload-zone').classList.remove('drag-over');
}
function examDrop(e) {
  e.preventDefault();
  document.getElementById('exam-upload-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type === 'application/pdf') {
    _examProcessPdf(file);
  }
}

/* ── File input handler ──────────────────────────────────── */
function examHandlePdfFile(input) {
  const file = input.files[0];
  if (file) _examProcessPdf(file);
  input.value = ''; // allow re-selecting same file
}

/* ── Core PDF extraction ─────────────────────────────────── */
async function _examProcessPdf(file) {
  const zone       = document.getElementById('exam-upload-zone');
  const idle       = document.getElementById('exam-upload-idle');
  const attached   = document.getElementById('exam-upload-attached');
  const statusEl   = document.getElementById('exam-extract-status');
  const nameEl     = document.getElementById('exam-file-name');
  const pagesEl    = document.getElementById('exam-file-pages');

  // Show attached state immediately
  nameEl.textContent = file.name.length > 38 ? file.name.slice(0, 36) + '…' : file.name;
  pagesEl.textContent = '';
  statusEl.innerHTML = '<div class="exam-extract-spinner"></div><span>Extracting text…</span>';
  idle.style.display     = 'none';
  attached.style.display = '';
  zone.classList.add('has-file');

  try {
    const lib       = await _loadPdfJsExam();
    const arrayBuf  = await file.arrayBuffer();
    const pdfDoc    = await lib.getDocument({ data: arrayBuf }).promise;
    const numPages  = pdfDoc.numPages;
    pagesEl.textContent = numPages + ' page' + (numPages !== 1 ? 's' : '');

    // Extract text from every page (cap at 40 pages to stay within token budget)
    const maxPages = Math.min(numPages, 40);
    let fullText = '';
    for (let p = 1; p <= maxPages; p++) {
      const page    = await pdfDoc.getPage(p);
      const content = await page.getTextContent();
      fullText += content.items.map(i => i.str).join(' ') + '\n';
    }
    fullText = fullText.trim();

    if (!fullText) throw new Error('No text found — the PDF may be scanned/image-based.');

    _examSourceText  = fullText.slice(0, 100000); // ~25k tokens — covers 60+ slide PDFs
    _examSourceLabel = file.name.replace(/\.pdf$/i, '');
    _examToggleScanMode(true);
    if (typeof window._ewizUpdateNextBtn === 'function') window._ewizUpdateNextBtn();

    const charCount  = _examSourceText.length.toLocaleString();
    const truncated  = fullText.length > 100000;
    statusEl.innerHTML =
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' +
      '<span style="color:var(--green);">Ready — ' + charCount + ' chars extracted' + (truncated ? ' (truncated)' : '') + '</span>';

  } catch (err) {
    _examSourceText  = '';
    _examSourceLabel = '';
    statusEl.innerHTML =
      '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
      '<span style="color:var(--red);">' + err.message + '</span>';
    if (typeof window._ewizUpdateNextBtn === 'function') window._ewizUpdateNextBtn();
  }
}

/* ── Clear PDF source ────────────────────────────────────── */
function examClearSource(e, silent) {
  if (e) e.stopPropagation();
  _examSourceText  = '';
  _examSourceLabel = '';
  document.getElementById('exam-upload-idle').style.display     = '';
  document.getElementById('exam-upload-attached').style.display = 'none';
  document.getElementById('exam-upload-zone').classList.remove('has-file');
  document.getElementById('exam-pdf-file').value = '';
  _examToggleScanMode(false);
  if (typeof window._ewizUpdateNextBtn === 'function') window._ewizUpdateNextBtn();
}

/* ── Notes handlers ──────────────────────────────────────── */
function examClearNotes() {
  const notesEl = document.getElementById('exam-notes-input');
  if (notesEl) notesEl.value = '';
  document.getElementById('exam-notes-count').textContent = '0 chars';
  _examSourceText  = '';
  _examSourceLabel = '';
  _examToggleScanMode(false);
  if (typeof window._ewizUpdateNextBtn === 'function') window._ewizUpdateNextBtn();
}


/* ═══════════════════════════════════════════════════════════════
   EXAM MODE ENGINE
═══════════════════════════════════════════════════════════════ */
const _IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

let _examQuestions   = [];
let _examIdx         = 0;
let _examAnswers     = [];
let _examTimerSec    = 0;
let _examTimerHandle = null;
let _examStartTime   = 0;
let _examTopic       = '';
let _examType        = 'mcq';
let _examDiff        = 'medium';
let _examStreakBest  = 0;
let _examStreakCur   = 0;
let _activeExamRecentId = null; // tracks sidebar entry for current exam session — retakes update it
let _examAbortCtrl   = null;    // AbortController for in-flight exam API calls
let _examIsRetake    = false;   // true when examRetry() triggered (same questions, reset answers)

// ── Task 5: Adaptive difficulty ramp state ────────────────────────────────
let _examAdaptiveDiff    = 'medium'; // current live difficulty level
let _examAdaptivePools   = null;     // { easy:[], medium:[], hard:[] } — pre-generated pools
let _examAdaptiveEnabled = false;    // true when adaptive ramp is active
const DIFF_ORDER = ['easy','medium','hard'];

// ── Exam Templates + Sections ─────────────────────────────────────────────
const EXAM_SECTION_TYPES = {
  mcq:            { label: 'Multiple Choice',  desc: 'Choose the best answer',        color: '#e8ac2e', typeLabel: 'multiple-choice' },
  truefalse:      { label: 'True / False',     desc: 'Select true or false',           color: '#2dd4bf', typeLabel: 'true/false' },
  identification: { label: 'Identification',  desc: 'Name the term or concept',       color: '#e8ac2e', typeLabel: 'multiple-choice' },
  openended:      { label: 'Essay',            desc: 'Long-form written answer',       color: '#4ade80', typeLabel: 'open-ended' },
  fillinblank:    { label: 'Fill in Blank',    desc: 'Complete the statement',         color: '#60a5fa', typeLabel: 'fill-in-the-blank' },
  matching:       { label: 'Matching',         desc: 'Match terms to definitions',     color: '#60a5fa', typeLabel: 'matching' },
  problem:        { label: 'Problem-solving',  desc: 'Work through a problem',         color: '#a78bfa', typeLabel: 'open-ended' },
  situational:    { label: 'Situational',      desc: 'Real-world scenario',            color: '#a78bfa', typeLabel: 'situational' },
};

const EXAM_TEMPLATES = {
  university:    { name: 'University Standard',  sections: [ {type:'mcq',count:30,pts:1}, {type:'openended',count:2,pts:5}, {type:'identification',count:10,pts:6} ] },
  quickquiz:     { name: 'Quick Quiz',            sections: [ {type:'mcq',count:10,pts:2}, {type:'truefalse',count:5,pts:1} ] },
  sciencemidterm:{ name: 'Science Midterm',       sections: [ {type:'mcq',count:20,pts:2}, {type:'openended',count:3,pts:5}, {type:'problem',count:5,pts:6} ] },
  boardexam:     { name: 'Board Exam Drill',      sections: [ {type:'mcq',count:100,pts:1} ] },
  comprehensive: { name: 'Comprehensive Final',   sections: [ {type:'mcq',count:25,pts:2}, {type:'identification',count:10,pts:3}, {type:'openended',count:3,pts:10}, {type:'problem',count:2,pts:5} ] },
  custom:        { name: 'Custom',                sections: [ {type:'mcq',count:10,pts:2} ] },
};

let _examSections       = [];   // active section list (deep-copied from template or user-built)
let _examActiveTemplate = null; // id of currently selected template card

/* ── EXAM WIZARD — 3-step setup navigation ────────────────────────────── */
let _ewizStep        = 1;
let _ewizAttachState = null; // 'pdf' | 'notes' | null

function ewizGoTo(step) {
  _ewizStep = step;
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById('ewiz-step-' + i);
    if (el) el.style.display = i === step ? '' : 'none';
  }
  _ewizUpdateTrail();
}

function _ewizUpdateTrail() {
  for (let n = 1; n <= 3; n++) {
    const dot = document.getElementById('ewiz-dot-' + n);
    if (!dot) return; // wizard not mounted yet
    dot.className = 'ewiz-dot';
    if (n < _ewizStep) dot.classList.add('done');
    if (n === _ewizStep) dot.classList.add('active');
    if (n < 3) {
      const line = document.getElementById('ewiz-line-' + n);
      if (line) line.classList.toggle('done', n < _ewizStep);
    }
  }
}

function ewizNext() {
  if (_ewizStep === 1) {
    ewizGoTo(2);
  } else if (_ewizStep === 2) {
    if (!_examActiveTemplate) return;
    ewizGoTo(3);
    // Ensure sections wrap is visible and freshly rendered
    const sectionsWrap = document.getElementById('exam-sections-wrap');
    if (sectionsWrap) sectionsWrap.style.display = '';
    _examSectionsRender();
    _examSummaryUpdate();
  }
}

function ewizBack() {
  if (_ewizStep > 1) ewizGoTo(_ewizStep - 1);
}

function _ewizOnTplSelect() {
  const btn = document.getElementById('ewiz-customize-btn');
  if (btn) { btn.disabled = false; btn.classList.remove('ewiz-disabled'); }
}

function _ewizTogglePdf() {
  const pdfZone  = document.getElementById('exam-src-pdf');
  const notesZone = document.getElementById('exam-src-notes');
  const pdfBtn   = document.getElementById('ewiz-pdf-btn');
  const notesBtn = document.getElementById('ewiz-notes-btn');
  if (_ewizAttachState === 'pdf') {
    _ewizAttachState = null;
    pdfBtn.classList.remove('active');
    if (pdfZone) pdfZone.style.display = 'none';
    examClearSource(null, true);
  } else {
    _ewizAttachState = 'pdf';
    pdfBtn.classList.add('active');
    if (pdfZone) pdfZone.style.display = '';
    notesBtn.classList.remove('active');
    if (notesZone) notesZone.style.display = 'none';
    _examSourceTab = 'pdf';
    examClearNotes();
  }
  const scanField = document.getElementById('exam-scan-mode-field');
  if (scanField) scanField.style.display = _ewizAttachState === 'pdf' ? '' : 'none';
}

function _ewizToggleNotes() {
  const pdfZone  = document.getElementById('exam-src-pdf');
  const notesZone = document.getElementById('exam-src-notes');
  const pdfBtn   = document.getElementById('ewiz-pdf-btn');
  const notesBtn = document.getElementById('ewiz-notes-btn');
  if (_ewizAttachState === 'notes') {
    _ewizAttachState = null;
    notesBtn.classList.remove('active');
    if (notesZone) notesZone.style.display = 'none';
    examClearNotes();
  } else {
    _ewizAttachState = 'notes';
    notesBtn.classList.add('active');
    if (notesZone) notesZone.style.display = '';
    pdfBtn.classList.remove('active');
    if (pdfZone) pdfZone.style.display = 'none';
    _examSourceTab = 'notes';
    examClearSource(null, true);
  }
  const scanField = document.getElementById('exam-scan-mode-field');
  if (scanField) scanField.style.display = 'none'; // scan mode only for PDF
}

function examSelectTemplate(id) {
  _examActiveTemplate = id;
  document.querySelectorAll('.exam-tpl-card').forEach(c => c.classList.toggle('active', c.dataset.tpl === id));
  _ewizOnTplSelect(); // enable "Customize →" button in wizard

  const tpl = EXAM_TEMPLATES[id];
  if (!tpl) return;

  _examSections = tpl.sections.map(s => ({ ...s })); // shallow copy of flat objects (no nested refs)

  const hasSections = _examSections.length > 0 || id === 'custom';
  const sectionsWrap = document.getElementById('exam-sections-wrap');
  const tplHint      = document.getElementById('exam-tpl-hint');
  if (sectionsWrap) sectionsWrap.style.display = hasSections ? '' : 'none';
  if (tplHint)      tplHint.style.display      = hasSections ? '' : 'none';

  const titleEl = document.getElementById('exam-sections-title');
  if (titleEl) titleEl.textContent = 'EXAM SECTIONS \u2014 ' + tpl.name.toUpperCase();

  // Hide individual count/type pickers when sections take over
  const countField = document.getElementById('exam-count-field');
  const typeField  = document.getElementById('exam-type-field');
  if (countField) countField.style.display = hasSections ? 'none' : '';
  if (typeField)  typeField.style.display  = hasSections ? 'none' : '';

  _examSectionsRender();
}

function _examSectionsRender() {
  const body = document.getElementById('exam-sections-body');
  if (!body) return;
  body.innerHTML = '';

  _examSections.forEach((sec, idx) => {
    const info = EXAM_SECTION_TYPES[sec.type] || EXAM_SECTION_TYPES.mcq;
    const typeOptions = Object.entries(EXAM_SECTION_TYPES)
      .map(([k, v]) => `<option value="${k}"${k === sec.type ? ' selected' : ''}>${v.label}</option>`)
      .join('');

    const row = document.createElement('div');
    row.className = 'exam-section-row';
    row.dataset.idx = idx;
    row.innerHTML =
      `<div class="exam-section-type-cell">` +
        `<span class="exam-section-dot" style="background:${info.color}"></span>` +
        `<div class="exam-section-type-info">` +
          `<select class="exam-section-type-sel" onchange="_examSectionEdit(${idx},'type',this.value)">${typeOptions}</select>` +
          `<div class="exam-section-type-desc">${info.desc}</div>` +
        `</div>` +
      `</div>` +
      `<input class="exam-section-count-inp" type="number" min="1" max="300" value="${parseInt(sec.count)}" oninput="_examSectionEdit(${idx},'count',this.value)">` +
      `<input class="exam-section-pts-inp" type="number" min="1" max="100" value="${parseInt(sec.pts)}" oninput="_examSectionEdit(${idx},'pts',this.value)">` +
      `<div class="exam-section-subtotal" id="sec-sub-${idx}">${parseInt(sec.count) * parseInt(sec.pts)} pts</div>` +
      `<button class="exam-section-del${_examSections.length === 1 ? ' ewiz-hidden' : ''}" onclick="examSectionDelete(${idx})" title="Remove">\u00d7</button>`;
    body.appendChild(row);
  });

  _examSummaryUpdate();
}

function _examSectionEdit(idx, field, value) {
  if (!_examSections[idx]) return;
  if (field === 'type') {
    _examSections[idx].type = value;
    _examSectionsRender(); // full re-render to update dot + desc
    return;
  }
  const n = Math.max(1, parseInt(value) || 1);
  _examSections[idx][field] = n;
  const subEl = document.getElementById('sec-sub-' + idx);
  if (subEl) subEl.textContent = (_examSections[idx].count * _examSections[idx].pts) + ' pts';
  _examSummaryUpdate();
}

const _EXAM_MINS_PER_Q       = 1.5; // estimated minutes per question
const _EXAM_DUR_ROUNDING     = 5;   // round est. duration to nearest N minutes

function _examSummaryUpdate() {
  const totalQ   = _examSections.reduce((s, x) => s + (parseInt(x.count) || 0), 0);
  const totalPts = _examSections.reduce((s, x) => s + ((parseInt(x.count) || 0) * (parseInt(x.pts) || 0)), 0);
  const estMin   = totalQ > 0 ? Math.max(_EXAM_DUR_ROUNDING, Math.round(totalQ * _EXAM_MINS_PER_Q / _EXAM_DUR_ROUNDING) * _EXAM_DUR_ROUNDING) : 0;

  const el = id => document.getElementById(id);
  if (el('sum-sections'))  el('sum-sections').textContent  = _examSections.length;
  if (el('sum-questions')) el('sum-questions').textContent = totalQ;
  if (el('sum-points'))    el('sum-points').textContent    = totalPts + ' pts';
  if (el('sum-duration'))  el('sum-duration').textContent  = estMin > 0 ? '~' + estMin + ' min' : '—';
}

function examSectionDelete(idx) {
  if (_examSections.length <= 1) return; // minimum 1 section
  const rows = document.querySelectorAll('.exam-section-row');
  const row  = rows[idx];
  const doRemove = () => {
    _examSections.splice(idx, 1);
    _examSectionsRender();
  };
  if (row) {
    // Animate out then remove
    row.style.transition = 'opacity 0.18s, max-height 0.22s ease, padding 0.22s ease';
    row.style.maxHeight  = row.scrollHeight + 'px';
    row.style.overflow   = 'hidden';
    requestAnimationFrame(() => {
      row.style.opacity        = '0';
      row.style.maxHeight      = '0';
      row.style.paddingTop     = '0';
      row.style.paddingBottom  = '0';
    });
    setTimeout(doRemove, 230);
  } else {
    doRemove();
  }
}

function examSectionAdd() {
  const picker = document.getElementById('exam-section-add-picker');
  if (!picker) return;
  const isVisible = picker.style.display !== 'none';
  if (isVisible) { picker.style.display = 'none'; return; }
  // Build type picker buttons
  picker.innerHTML = '<span class="estp-label">Choose type:</span>' +
    Object.entries(EXAM_SECTION_TYPES).map(([k, v]) =>
      `<button class="estp-btn" onclick="examSectionAddType('${k}')">${v.label}</button>`
    ).join('');
  picker.style.display = '';
}

function examSectionAddType(type) {
  _examSections.push({ type, count: 5, pts: 2 });
  _examSectionsRender();
  const picker = document.getElementById('exam-section-add-picker');
  if (picker) picker.style.display = 'none';
  // Ensure sections wrap is visible and count/type pickers are hidden
  const sectionsWrap = document.getElementById('exam-sections-wrap');
  if (sectionsWrap) sectionsWrap.style.display = '';
  const countField = document.getElementById('exam-count-field');
  const typeField  = document.getElementById('exam-type-field');
  if (countField) countField.style.display = 'none';
  if (typeField)  typeField.style.display  = 'none';
}

function examSelectType(btn) {
  document.querySelectorAll('#exam-type-grid .exam-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _examType = btn.dataset.type;
  const sitHint = document.getElementById('exam-situational-hint');
  if (sitHint) sitHint.style.display = _examType === 'situational' ? '' : 'none';
  const cblHint = document.getElementById('exam-cbl-hint');
  if (cblHint) cblHint.style.display = _examType === 'cbl' ? '' : 'none';
  const oeHint = document.getElementById('exam-openended-hint');
  if (oeHint) oeHint.style.display = _examType === 'openended' ? '' : 'none';
  const fibHint = document.getElementById('exam-fillinblank-hint');
  if (fibHint) fibHint.style.display = _examType === 'fillinblank' ? '' : 'none';
  const matchHint = document.getElementById('exam-matching-hint');
  if (matchHint) matchHint.style.display = _examType === 'matching' ? '' : 'none';
}

function examSelectDiff(btn) {
  btn.closest('div').querySelectorAll('.exam-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  _examDiff = btn.dataset.diff;
  const hint = document.getElementById('exam-adaptive-diff-hint');
  if (hint) hint.style.display = _examDiff === 'adaptive' ? '' : 'none';
}

function _examShow(view) {
  ['exam-setup','exam-loading','exam-quiz','exam-results','exam-history-view'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === view ? 'block' : 'none';
  });
}

/* ─────────────────────────────────────────────────────────────
   SCAN MODE STATE
───────────────────────────────────────────────────────────── */
let _examScanMode = 'quick';

function examSelectScanMode(card) {
  document.querySelectorAll('.exam-scan-card').forEach(c => c.classList.remove('active'));
  card.classList.add('active');
  _examScanMode = card.dataset.mode;

  const countLabel = document.getElementById('exam-count-label');
  const deepNote   = document.getElementById('exam-deep-note');
  if (_examScanMode === 'deep') {
    if (countLabel) countLabel.textContent = 'Max Questions (cap)';
    if (deepNote)   deepNote.style.display = '';
  } else {
    if (countLabel) countLabel.textContent = 'Number of Questions';
    if (deepNote)   deepNote.style.display = 'none';
  }
}

/* Show/hide scan mode picker when source material changes */
function _examToggleScanMode(hasSource) {
  const field = document.getElementById('exam-scan-mode-field');
  if (field) field.style.display = hasSource ? '' : 'none';
  if (!hasSource) {
    // Reset to quick when source removed
    document.querySelectorAll('.exam-scan-card').forEach(c => c.classList.remove('active'));
    const first = document.querySelector('.exam-scan-card[data-mode="quick"]');
    if (first) first.classList.add('active');
    _examScanMode = 'quick';
    const countLabel = document.getElementById('exam-count-label');
    if (countLabel) countLabel.textContent = 'Number of Questions';
    const deepNote = document.getElementById('exam-deep-note');
    if (deepNote) deepNote.style.display = 'none';
  }
}

/* ─────────────────────────────────────────────────────────────
   SHARED API CALL HELPER
───────────────────────────────────────────────────────────── */
async function _examCallAPI(prompt, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const _examAuthHdr = typeof window._getAuthHeader === 'function' ? await window._getAuthHeader() : _getAuthHeader();
      const fetchOpts = {
        method: 'POST', headers: {'Content-Type':'application/json', ..._examAuthHdr},
        body: JSON.stringify({ question: prompt, mode: 'generate', task_type: 'exam', ...(() => { const p = _aiParams(6); return { complexity: p.complexity, language: p.language, safe_content: p.safe_content }; })(), bookId: 'none', history: [] })
      };
      if (_examAbortCtrl) fetchOpts.signal = _examAbortCtrl.signal;
      const resp = await fetch(API_BASE + '/ask', fetchOpts);
      if (resp.status === 429) {
        // Could be guest IP limit OR server rate limit — check body
        try {
          const _429data = await resp.clone().json();
          if (_handleGuestLimited(_429data)) return;
        } catch(_) {}
        const wait = 2000 * (attempt + 1);
        if (attempt < retries) { await new Promise(r => setTimeout(r, wait)); continue; }
        throw new Error('Server is busy — please wait a moment and try again.');
      }
      if (resp.status === 504 || resp.status === 502 || resp.status === 503) {
        if (attempt < retries) { await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); continue; }
        throw new Error('Server timeout (504) — Railway may be cold-starting, please try again.');
      }
      if (resp.status === 400) {
        let errMsg = 'Bad request — check your input and try again.';
        try { const errData = await resp.json(); if (errData.error) errMsg = errData.error; } catch (_) {}
        throw new Error(errMsg);
      }
      if (!resp.ok) throw new Error('Server error ' + resp.status);
      const data = await resp.json();
      // Log full response for debugging
      // Try all common field names the server might use
      const rawAnswer = data.answer || data.response || data.text || data.content || data.result || '';
      // Backend may return a pre-parsed object/array — JSON.stringify so the parser can handle it
      const answer = typeof rawAnswer === 'string' ? rawAnswer :
                     (rawAnswer && typeof rawAnswer === 'object') ? JSON.stringify(rawAnswer) :
                     String(rawAnswer ?? '');
      if (!answer && attempt < retries) {
        console.warn('[API] Empty answer, retrying... data:', JSON.stringify(data).slice(0, 200));
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      return answer.trim();
    } catch(err) {
      if (attempt < retries && (err.message.includes('fetch') || err.message.includes('network'))) {
        await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

/* ─────────────────────────────────────────────────────────────
   PARSE QUESTIONS — shared JSON extraction
───────────────────────────────────────────────────────────── */
function _examParseQuestions(raw) {
  // Step 1: strip markdown code fences
  let cleaned = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  // Step 2: find outermost JSON array
  const s = cleaned.indexOf('[');
  const e = cleaned.lastIndexOf(']');
  if (s < 0 || e < 0) {
    // Log first 300 chars for debugging
    console.warn('CBL raw response:', raw.slice(0, 300));
    throw new Error('No question array found — the AI returned an unexpected format. Please try again.');
  }

  let jsonStr = cleaned.slice(s, e + 1);

  // Step 3: common JSON fixes
  jsonStr = jsonStr
    .replace(/,\s*([}\]])/g, '$1')          // trailing commas
    .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":') // unquoted keys
    .replace(/:\s*'([^']*)'/g, ': "$1"');    // single-quoted values

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch(e1) {
    // Step 4: try extracting individual objects if full array fails
    const objects = [];
    const objRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
    let m;
    while ((m = objRegex.exec(jsonStr)) !== null) {
      try { objects.push(JSON.parse(m[0])); } catch {}
    }
    if (objects.length) { parsed = objects; }
    else {
      console.warn('Parse failed. Raw:', raw.slice(0, 500));
      throw new Error('Could not parse questions — please try again.');
    }
  }

  if (!Array.isArray(parsed) || !parsed.length) throw new Error('No questions returned.');
  return parsed;
}

/* ─────────────────────────────────────────────────────────────
   DEEP SCAN PROGRESS UI
───────────────────────────────────────────────────────────── */
function _deepSetStage(stage) {
  // stage: 'chunk' | 'extract' | 'generate'
  const order = ['chunk', 'extract', 'generate'];
  const idx   = order.indexOf(stage);
  order.forEach((s, i) => {
    const el = document.getElementById('stage-' + s);
    if (!el) return;
    el.classList.remove('active', 'done');
    if (i < idx)  el.classList.add('done');
    if (i === idx) el.classList.add('active');
  });
}

function _deepSetProgress(pct, stepText) {
  const bar  = document.getElementById('exam-deep-bar');
  const pctEl = document.getElementById('exam-deep-pct');
  const textEl = document.getElementById('exam-deep-step-text');
  if (bar)   bar.style.width  = pct + '%';
  if (pctEl)  pctEl.textContent = Math.round(pct) + '%';
  if (textEl) textEl.textContent = stepText;
}

/* ─────────────────────────────────────────────────────────────
   TEXT CHUNKER
───────────────────────────────────────────────────────────── */
function _examChunkText(text, wordsPerChunk = 250) {
  const words  = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    const idx = chunks.length + 1;
    chunks.push({
      idx,
      text: words.slice(i, i + wordsPerChunk).join(' ')
    });
  }
  return chunks;
}

/* Build a labeled source string for Smart/Quick prompts */
function _examLabeledSource(text, wordsPerChunk = 250) {
  const chunks = _examChunkText(text, wordsPerChunk);
  const total  = chunks.length;
  return chunks.map(c => `[BLOCK ${c.idx} of ${total}]\n${c.text}`).join('\n\n');
}

/* ─────────────────────────────────────────────────────────────
   PIPELINE A — QUICK (1 call, fixed count)
───────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────
   BATCH HELPER — splits large requests into ≤10-question calls
───────────────────────────────────────────────────────────── */
async function _examBatchedGenerate(prompt, totalCount) {
  const BATCH = 10;
  if (totalCount <= BATCH) {
    // Small enough — single call
    const raw = await _examCallAPI(prompt);
    return _examParseQuestions(raw);
  }
  // Replace the count in the prompt for each batch
  let all = [];
  const numBatches = Math.ceil(totalCount / BATCH);
  for (let bi = 0; bi < numBatches; bi++) {
    const batchCount = Math.min(BATCH, totalCount - all.length);
    const batchPrompt = prompt.replace(
      /Generate exactly \d+ /,
      `Generate exactly ${batchCount} `
    );
    const raw = await _examCallAPI(batchPrompt);
    const qs  = _examParseQuestions(raw);
    all = all.concat(qs);
    if (bi < numBatches - 1) await new Promise(r => setTimeout(r, 700));
  }
  return all;
}

/* ═══════════════════════════════════════════════════════════════
   ADAPTIVE QUESTION WEIGHTING — Task 3
   Reads exam history to find concepts the student consistently
   gets wrong, then injects them into the generation prompt so
   the AI prioritises those weak areas.
═══════════════════════════════════════════════════════════════ */

/**
 * Returns a weak-context object for the given topic based on history.
 * { concepts: string[], missRate: number, attempts: number } or null if no data.
 */
function _examGetWeakContext(topic) {
  const history = _examHistoryLoad();
  if (!history.length) return null;

  // Find attempts on the same topic (fuzzy match — topic words overlap)
  const topicWords = (topic || '').toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const related = history.filter(r => {
    if (!r.topic) return false;
    const rt = r.topic.toLowerCase();
    return topicWords.some(w => rt.includes(w)) || rt.includes((topic||'').toLowerCase().slice(0,12));
  });

  if (!related.length) return null;

  // Build a map of missed question texts → miss count
  const missMap = {};
  related.forEach(r => {
    if (!r.wrongConcepts) return;
    r.wrongConcepts.forEach(c => {
      missMap[c] = (missMap[c] || 0) + 1;
    });
  });

  // Sort by miss frequency, take top 6
  const concepts = Object.entries(missMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([c]) => c);

  if (!concepts.length) return null;

  const avgScore = Math.round(related.reduce((s, r) => s + r.score, 0) / related.length);
  return { concepts, attempts: related.length, avgScore };
}

/**
 * Injects the adaptive weak-concept instruction into a prompt BEFORE
 * the "Output ONLY" line, so it doesn't appear after the JSON example
 * and confuse the model.
 */
function _examWeakClause(weakContext) {
  if (!weakContext || !weakContext.concepts.length) return '';
  return `\nADAPTIVE FOCUS: This student has taken this exam ${weakContext.attempts} time(s) and repeatedly misses these concepts: ${weakContext.concepts.map(c => `"${c}"`).join(', ')}. Weight at least 60% of questions toward these weak areas.\n`;
}

function _examInjectWeak(prompt, weakContext) {
  const clause = _examWeakClause(weakContext);
  if (!clause) return prompt;
  // Insert just before the first "Output ONLY" instruction
  const marker = 'Output ONLY';
  const idx = prompt.indexOf(marker);
  if (idx === -1) return prompt + clause;
  return prompt.slice(0, idx) + clause + prompt.slice(idx);
}

async function _examRunQuick(topic, sourceText, count, typeLabel, weakContext) {
  let prompt;
  if (sourceText) {
    const topicClause = topic ? ` Focus specifically on: "${topic}".` : '';
    const _labeledSrc = _examLabeledSource(sourceText);
    if (typeLabel === 'situational') {
      prompt = `You are creating a situational exam from the following source material.${topicClause}
Generate exactly ${count} situational exam questions. Difficulty: ${_examDiff}.
Each question must: (1) open with a realistic scenario drawn from the source material (2-4 sentences), (2) ask what the BEST action or decision is, (3) have exactly 4 plausible options labeled A-D where only one is clearly best.
Base scenarios ONLY on content in the source. Include a 1-2 sentence explanation for the correct answer.
Each question MUST include a "ref" field citing the [BLOCK X of Y] it came from (e.g. "ref": "Block 3").
Output ONLY a raw JSON array with no markdown:
[{"q":"SCENARIO: ...\n\nQuestion: What should you do?","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"...","ref":"Block X"}]

SOURCE MATERIAL (labeled by block):
---
${_labeledSrc.slice(0, 100000)}
---`;
    } else if (typeLabel === 'case-based-learning') {
      prompt = `You are a rigorous medical educator. Create Case-Based Learning (CBL) questions from the following source material.${topicClause}
Generate exactly ${count} clinical vignette questions. Base each case ONLY on content from the source.
Vary the question focus: diagnosis, next best step, mechanism, and treatment.

DIFFICULTY RULES — apply strictly based on: ${_examDiff}
- easy:   Common textbook presentations. Classic symptoms, obvious vitals, straightforward distractors that are clearly wrong to any student.
- medium: Slightly atypical presentations. One or two misleading findings. Distractors are plausible but distinguishable with solid knowledge.
- hard:   USMLE Step 2 CK / clinical board level. Use these tactics:
    • Present ZEBRA diagnoses alongside HORSES — rare conditions that mimic common ones
    • Include red herrings: a finding that strongly suggests the wrong answer (e.g. fever + neck stiffness but NOT meningitis)
    • Vitals and labs should have subtle abnormalities, not obvious ones (e.g. HR 102, not 160)
    • Distractors must be clinically plausible and commonly confused — no throwaway wrong answers
    • Ask "next best step" rather than diagnosis whenever possible — management decisions are harder
    • Use age/sex/timing to steer toward a non-obvious answer (e.g. MI in a 32-year-old woman)
    • Explanation must cite the KEY distinguishing feature that rules out the distractors
Each question MUST include a "ref" field citing the block it came from.
Output ONLY a raw JSON array — no markdown:
[{"case":{"patient":"...","chief_complaint":"...","history":"...","vitals":{"BP":"...","HR":"...","RR":"...","Temp":"...","SpO2":"..."},"findings":"...","tag":"Diagnosis|Next Best Step|Treatment|Mechanism"},"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"..."}]

SOURCE MATERIAL (labeled by block):
---
${_labeledSrc.slice(0, 100000)}
---`;
    } else if (typeLabel === 'open-ended') {
      prompt = `You are creating open-ended short-answer exam questions from the following source material.${topicClause}
Generate exactly ${count} open-ended questions. Difficulty: ${_examDiff}.
Base questions ONLY on the source content. Each requires a written answer (2-5 sentences) demonstrating real understanding.
Include ideal_answer (2-4 sentences of a complete correct response), rubric (3-4 bullet points of what a full answer must cover), and a ref field citing the block.
Output ONLY a raw JSON array with no markdown:
[{"q":"...","ideal_answer":"...","rubric":["point 1","point 2","point 3"],"explanation":"...","ref":"Block X"}]

SOURCE MATERIAL (labeled by block):
---
${_labeledSrc.slice(0, 100000)}
---`;
    } else {
      prompt = `You are creating an exam from the following source material.${topicClause}
Generate exactly ${count} ${typeLabel} exam questions. Difficulty: ${_examDiff}.
Base your questions ONLY on the content provided. Rules: MCQ has 4 options labeled A-D. True/False options are exactly ["True","False"]. Fill-in-the-blank questions must contain ___ in the question text with 4 options. Matching questions present a term and ask which definition fits. One correct answer each. Include a 1-2 sentence explanation per question.
Each question MUST include a "ref" field citing the [BLOCK X of Y] it came from (e.g. "ref": "Block 3").
Output ONLY a raw JSON array with no markdown:
[{"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"...","ref":"Block X"}]

SOURCE MATERIAL (labeled by block):
---
${_labeledSrc.slice(0, 100000)}
---`;
    }
  } else {
    if (typeLabel === 'situational') {
      prompt = `Generate exactly ${count} situational exam questions about: "${topic}". Difficulty: ${_examDiff}.
Each question must: (1) open with a realistic, specific real-world scenario (2-4 sentences describing a situation a practitioner, student, or professional would face), (2) ask what the BEST action or decision is, (3) have exactly 4 options labeled A-D where all options are plausible but only one is clearly best.
Include a 1-2 sentence explanation for why the correct answer is best.
Output ONLY a raw JSON array with no markdown:
[{"q":"SCENARIO: ...\n\nQuestion: What should you do?","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"..."}]`;
    } else if (typeLabel === 'case-based-learning') {
      prompt = `You are a rigorous medical educator writing Case-Based Learning (CBL) exam questions about: "${topic}".
Generate exactly ${count} clinical vignette questions. Vary the focus: mix diagnosis, next best step, mechanism, and treatment questions.

DIFFICULTY RULES — apply strictly based on: ${_examDiff}
- easy:   Common textbook presentations. Classic symptoms, obvious vitals, straightforward distractors that are clearly wrong to any student.
- medium: Slightly atypical presentations. One or two misleading findings. Distractors are plausible but distinguishable with solid knowledge.
- hard:   USMLE Step 2 CK / clinical board level. Use these tactics:
    • Present ZEBRA diagnoses alongside HORSES — rare conditions that mimic common ones
    • Include red herrings: a finding that strongly suggests the wrong answer (e.g. fever + neck stiffness but NOT meningitis)
    • Vitals and labs should have subtle abnormalities, not obvious ones (e.g. HR 102, not 160)
    • Distractors must be clinically plausible and commonly confused — no throwaway wrong answers
    • Ask "next best step" rather than diagnosis whenever possible — management decisions are harder
    • Use age/sex/timing to steer toward a non-obvious answer (e.g. MI in a 32-year-old woman)
    • Explanation must cite the KEY distinguishing feature that rules out the distractors
Output ONLY a raw JSON array — no markdown, no extra fields:
[{"case":{"patient":"...","chief_complaint":"...","history":"...","vitals":{"BP":"...","HR":"...","RR":"...","Temp":"...","SpO2":"..."},"findings":"...","tag":"Diagnosis|Next Best Step|Treatment|Mechanism"},"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"..."}]`;
    } else if (typeLabel === 'open-ended') {
      prompt = `Generate exactly ${count} open-ended short-answer questions about: "${topic}". Difficulty: ${_examDiff}.
Each question requires a written answer (2-5 sentences) demonstrating real understanding.
Include ideal_answer (2-4 sentences of a complete correct response) and rubric (3-4 bullet points of what a full answer must cover).
Output ONLY a raw JSON array with no markdown:
[{"q":"...","ideal_answer":"...","rubric":["point 1","point 2","point 3"],"explanation":"..."}]`;
    } else {
      prompt = `Generate exactly ${count} ${typeLabel} exam questions about: "${topic}". Difficulty: ${_examDiff}.
Rules: MCQ has 4 options labeled A-D. True/False options are exactly ["True","False"]. Fill-in-the-blank questions must contain ___ in the question text with 4 options. Matching questions present a term and ask which definition fits. One correct answer each. Include a 1-2 sentence explanation per question.
Output ONLY a raw JSON array with no markdown:
[{"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"..."}]`;
    }
  }
  return await _examBatchedGenerate(_examInjectWeak(prompt, weakContext), count);
}

/* ─────────────────────────────────────────────────────────────
   PIPELINE B — SMART (1 call, full-coverage prompt)
───────────────────────────────────────────────────────────── */
async function _examRunSmart(topic, sourceText, count, typeLabel, weakContext) {
  let prompt;
  if (sourceText) {
    const topicClause = topic ? ` Topic focus: "${topic}".` : '';
    const _labeledSrc = _examLabeledSource(sourceText);
    if (typeLabel === 'situational') {
      prompt = `You are a thorough situational exam writer.${topicClause}
Read the ENTIRE source material below (labeled by block) from start to finish.
Identify real-world scenarios, cases, decisions, and practical applications across ALL blocks.
Generate up to ${count} situational exam questions distributed evenly across blocks.
Each question must: (1) open with a 2-4 sentence realistic scenario, (2) ask what the BEST action is, (3) have 4 plausible options labeled A-D where only one is clearly best.
Difficulty: ${_examDiff}. Include a 1-2 sentence explanation per question.
Each question MUST include a "ref" field citing the block it came from (e.g. "ref": "Block 3").
Output ONLY a raw JSON array with no markdown:
[{"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"...","ref":"Block X"}]

SOURCE MATERIAL (labeled by block):
---
${_labeledSrc.slice(0, 100000)}
---`;
    } else {
      prompt = `You are a thorough exam writer.${topicClause}
Read the ENTIRE source material below (labeled by block) from start to finish.
Identify EVERY distinct concept across ALL blocks — do not skip any block.
Generate up to ${count} ${typeLabel} exam questions covering the FULL document evenly across all blocks.
Difficulty: ${_examDiff}.
Rules: MCQ has 4 options labeled A-D. True/False options are exactly ["True","False"]. Fill-in-the-blank questions must contain ___ in the question text with 4 options. Matching questions present a term and ask which definition fits. One correct answer each. Include a 1-2 sentence explanation per question.
Each question MUST include a "ref" field citing the block it came from (e.g. "ref": "Block 3").
Output ONLY a raw JSON array with no markdown:
[{"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"...","ref":"Block X"}]

SOURCE MATERIAL (labeled by block):
---
${_labeledSrc.slice(0, 100000)}
---`;
    }
  } else {
    if (typeLabel === 'situational') {
      prompt = `You are a thorough situational exam writer. Generate exactly ${count} situational exam questions about: "${topic}".
Difficulty: ${_examDiff}. Cover a broad range of real-world scenarios — vary the settings, roles, and complications.
Each question must: (1) open with a 2-4 sentence realistic scenario, (2) ask what the BEST action is, (3) have 4 plausible options labeled A-D where only one is clearly best. Include a 1-2 sentence explanation per question.
Output ONLY a raw JSON array with no markdown:
[{"q":"SCENARIO: ...\n\nQuestion: What should you do?","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"..."}]`;
    } else if (typeLabel === 'case-based-learning') {
      prompt = `You are a rigorous medical educator writing Case-Based Learning (CBL) questions about: "${topic}".
Generate exactly ${count} clinical vignette questions distributed across diagnosis, next best step, mechanism, and treatment.

DIFFICULTY RULES — apply strictly based on: ${_examDiff}
- easy:   Common textbook presentations. Classic symptoms, obvious vitals, straightforward distractors that are clearly wrong to any student.
- medium: Slightly atypical presentations. One or two misleading findings. Distractors are plausible but distinguishable with solid knowledge.
- hard:   USMLE Step 2 CK / clinical board level. Use these tactics:
    • Present ZEBRA diagnoses alongside HORSES — rare conditions that mimic common ones
    • Include red herrings: a finding that strongly suggests the wrong answer (e.g. fever + neck stiffness but NOT meningitis)
    • Vitals and labs should have subtle abnormalities, not obvious ones (e.g. HR 102, not 160)
    • Distractors must be clinically plausible and commonly confused — no throwaway wrong answers
    • Ask "next best step" rather than diagnosis whenever possible — management decisions are harder
    • Use age/sex/timing to steer toward a non-obvious answer (e.g. MI in a 32-year-old woman)
    • Explanation must cite the KEY distinguishing feature that rules out the distractors
Output ONLY a raw JSON array — no markdown, no extra fields:
[{"case":{"patient":"...","chief_complaint":"...","history":"...","vitals":{"BP":"...","HR":"...","RR":"...","Temp":"...","SpO2":"..."},"findings":"...","tag":"Diagnosis|Next Best Step|Treatment|Mechanism"},"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"..."}]`;
    } else {
      prompt = `You are a thorough exam writer. Generate exactly ${count} ${typeLabel} exam questions about: "${topic}".
Difficulty: ${_examDiff}. Cover a broad range of subtopics — do not focus only on the most obvious concepts.
Rules: MCQ has 4 options labeled A-D. True/False options are exactly ["True","False"]. Fill-in-the-blank questions must contain ___ in the question text with 4 options. Matching questions present a term and ask which definition fits. One correct answer each. Include a 1-2 sentence explanation per question.
Output ONLY a raw JSON array with no markdown:
[{"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"..."}]`;
    }
  }
  return await _examBatchedGenerate(_examInjectWeak(prompt, weakContext), count);
}

/* ─────────────────────────────────────────────────────────────
   PIPELINE C — DEEP SCAN (multi-call: chunk → concepts → questions)
───────────────────────────────────────────────────────────── */
async function _examRunDeepScan(topic, sourceText, maxCount, typeLabel, weakContext) {
  const deepProg = document.getElementById('exam-deep-progress');
  if (deepProg) deepProg.style.display = '';

  // ── STAGE 1: Chunk ────────────────────────────────────────
  _deepSetStage('chunk');
  _deepSetProgress(5, 'Splitting document into sections…');
  await new Promise(r => setTimeout(r, 120)); // micro-delay for UI paint

  const chunks = _examChunkText(sourceText, 500); // 500 words/chunk keeps calls under rate limit
  _deepSetProgress(10, `Split into ${chunks.length} sections`);

  // ── STAGE 2: Extract concepts sequentially with block refs ────
  _deepSetStage('extract');
  const topicClause = topic ? ` The overall subject is: "${topic}".` : '';
  const allConcepts = [];
  let _lastExtractErr = '';

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]; // {idx, text}
    const blockLabel = `Block ${chunk.idx} of ${chunks.length}`;
    const prompt = `Extract the 4-6 most important, distinct, testable concepts from this passage.${topicClause}
Return ONLY a JSON array of objects, no markdown:
[{"concept":"short concept string max 12 words","ref":"${blockLabel}"}]

PASSAGE (${blockLabel}):
---
${chunk.text}
---`;
    try {
      const raw = await _examCallAPI(prompt);
      const s = raw.indexOf('['), e = raw.lastIndexOf(']');
      if (s >= 0 && e >= 0) {
        const arr = JSON.parse(raw.slice(s, e + 1));
        if (Array.isArray(arr)) {
          arr.forEach(item => {
            if (typeof item === 'string') allConcepts.push({concept: item.trim(), ref: blockLabel});
            else if (item && typeof item.concept === 'string') allConcepts.push({concept: item.concept.trim(), ref: item.ref || blockLabel});
          });
        }
      }
    } catch(err) { _lastExtractErr = err.message; }

    const pct = 10 + ((i + 1) / chunks.length) * 55;
    _deepSetProgress(pct, `Scanned ${i + 1} of ${chunks.length} sections — ${allConcepts.length} concepts found`);
    // Throttle: 700ms between extraction calls (~85 req/min, under 120/min limit)
    if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 700));
  }

  if (!allConcepts.length) throw new Error('Could not extract concepts from the document. Try Smart or Quick mode.');

  // Deduplicate by concept text
  const seen    = new Set();
  const unique  = allConcepts.filter(c => {
    const key = c.concept.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const hardCap = maxCount <= 10 ? 80 : maxCount;
  const capped  = unique.slice(0, hardCap);

  _deepSetProgress(68, `${capped.length} unique concepts identified — generating questions…`);

  // ── STAGE 3: Generate one question per concept ────────────
  _deepSetStage('generate');

  const conceptList = capped.map((c, i) => `${i + 1}. [${c.ref}] ${c.concept}`).join('\n');
  const topicLine   = topic ? `The subject is: "${topic}".` : '';
  let prompt;
  if (typeLabel === 'situational') {
    prompt = `You are a precise situational exam writer. ${topicLine}
Generate exactly ${capped.length} situational exam questions — one per concept listed below.
For each concept, create a realistic 2-4 sentence scenario involving that concept, then ask what the BEST action is.
Provide 4 plausible options labeled A-D where only one is clearly best. Difficulty: ${_examDiff}. Include a 1-2 sentence explanation per question.
Each question MUST include the "ref" value from its concept entry (e.g. "ref": "Block 3 of 12").
Output ONLY a raw JSON array with no markdown, in the same order as the concepts:
[{"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"...","ref":"Block X"}]

CONCEPTS (number. [source block] concept):
${conceptList}`;
  } else {
    prompt = `You are a precise exam writer. ${topicLine}
Generate exactly ${capped.length} ${typeLabel} exam questions — one per concept listed below.
Each question must test the specific concept it corresponds to. Difficulty: ${_examDiff}.
Rules: MCQ has 4 options labeled A-D. True/False options are exactly ["True","False"]. Fill-in-the-blank questions must contain ___ in the question text with 4 options. Matching questions present a term and ask which definition fits. One correct answer each. Include a 1-2 sentence explanation per question.
Each question MUST include the "ref" value from its concept entry (e.g. "ref": "Block 3 of 12").
Output ONLY a raw JSON array with no markdown, in the same order as the concepts:
[{"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"...","ref":"Block X"}]

CONCEPTS (number. [source block] concept):
${conceptList}`;
  }

  // ── Batch generation: max 10 questions per call to avoid token limits ──
  const BATCH_SIZE = 10;
  const batches = [];
  for (let b = 0; b < capped.length; b += BATCH_SIZE) {
    batches.push(capped.slice(b, b + BATCH_SIZE));
  }

  let allQuestions = [];
  for (let bi = 0; bi < batches.length; bi++) {
    const batch     = batches[bi];
    const batchList = batch.map((c, i) => `${allQuestions.length + i + 1}. [${c.ref}] ${c.concept}`).join('\n');
    const batchPct  = 65 + Math.round(((bi + 1) / batches.length) * 30);
    _deepSetProgress(batchPct, `Generating questions ${allQuestions.length + 1}–${allQuestions.length + batch.length} of ${capped.length}…`);

    let batchPrompt;
    if (typeLabel === 'situational') {
      batchPrompt = `You are a precise situational exam writer. ${topicLine}
Generate exactly ${batch.length} situational exam questions — one per concept listed below.
For each concept, create a realistic 2-4 sentence scenario, then ask what the BEST action is.
Provide 4 plausible options labeled A-D. Difficulty: ${_examDiff}. Include a 1-2 sentence explanation per question.
Each question MUST include the "ref" value from its concept entry.
Output ONLY a raw JSON array with no markdown:
[{"q":"SCENARIO: ...\n\nQuestion: What should you do?","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"...","ref":"Block X"}]

CONCEPTS:
${batchList}`;
    } else if (typeLabel === 'case-based-learning') {
      batchPrompt = `You are a rigorous medical educator. ${topicLine}
Generate exactly ${batch.length} Case-Based Learning questions — one per concept below. Difficulty: ${_examDiff}.
For each concept create a clinical vignette then ask ONE focused question (diagnosis, next best step, mechanism, or treatment).
Each question MUST include the "ref" value from its concept entry.
Output ONLY a raw JSON array — no markdown:
[{"case":{"patient":"...","chief_complaint":"...","history":"...","vitals":{"BP":"...","HR":"...","RR":"...","Temp":"...","SpO2":"..."},"findings":"...","tag":"Diagnosis|Next Best Step|Treatment|Mechanism"},"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"...","ref":"Block X"}]

CONCEPTS:
${batchList}`;
    } else {
      batchPrompt = `You are a precise exam writer. ${topicLine}
Generate exactly ${batch.length} ${typeLabel} exam questions — one per concept listed below. Difficulty: ${_examDiff}.
Rules: MCQ has 4 options labeled A-D. True/False options are exactly ["True","False"]. Fill-in-the-blank questions must contain ___ in the question text with 4 options. Matching questions present a term and ask which definition fits. One correct answer. Include a 1-2 sentence explanation.
Each question MUST include the "ref" value from its concept entry.
Output ONLY a raw JSON array with no markdown:
[{"q":"...","options":["A. ...","B. ...","C. ...","D. ..."],"answer":"A","explanation":"...","ref":"Block X"}]

CONCEPTS:
${batchList}`;
    }

    const batchRaw = await _examCallAPI(_examInjectWeak(batchPrompt, weakContext));
    const batchQs  = _examParseQuestions(batchRaw);
    allQuestions   = allQuestions.concat(batchQs);

    // Throttle between generation batches
    if (bi < batches.length - 1) await new Promise(r => setTimeout(r, 700));
  }

  _deepSetProgress(98, 'Finalizing exam…');
  await new Promise(r => setTimeout(r, 200));
  _deepSetProgress(100, 'Done!');
  document.getElementById('stage-generate')?.classList.replace('active', 'done');

  return allQuestions;
}

/* ─────────────────────────────────────────────────────────────
   MAIN ENTRY POINT
───────────────────────────────────────────────────────────── */
/* ═══════════════════════════════════════════════════════════════
   ADAPTIVE DIFFICULTY RAMP — Task 5
   Pre-generates 3 pools (easy/medium/hard). After each answer,
   picks the next question from the appropriate pool based on
   running performance.
═══════════════════════════════════════════════════════════════ */

/**
 * Generates all 3 difficulty pools in parallel.
 * Each pool gets ceil(count/2) questions so we never run dry.
 */
async function _examGenerateAdaptivePools(topic, sourceText, typeLabel, count, weakContext) {
  const poolSize = Math.max(5, Math.ceil(count * 0.8));
  const savedDiff = _examDiff;

  const generate = async (diff) => {
    _examDiff = diff;
    let qs;
    if (_examScanMode === 'deep' && sourceText) {
      qs = await _examRunDeepScan(topic, sourceText, poolSize, typeLabel, weakContext);
    } else if (_examScanMode === 'smart') {
      qs = await _examRunSmart(topic, sourceText, poolSize, typeLabel, weakContext);
    } else {
      qs = await _examRunQuick(topic, sourceText, poolSize, typeLabel, weakContext);
    }
    // Tag each question with its difficulty
    return qs.map(q => ({ ...q, _diff: diff }));
  };

  // Generate all 3 pools — medium first (fastest feedback), then easy/hard
  const [medium, easy, hard] = await Promise.all([
    generate('medium'),
    generate('easy'),
    generate('hard'),
  ]);

  _examDiff = savedDiff; // restore original setting
  return { easy, medium, hard };
}

/**
 * Pick the next question from the adaptive pool based on current performance.
 * Updates _examAdaptiveDiff based on recent correct/wrong answers.
 */
function _examAdaptivePick() {
  const answered  = _examAnswers.filter(a => a !== null);
  const recentN   = Math.min(answered.length, 3);
  const recent    = answered.slice(-recentN);
  const recentCorrect = recent.filter(a => a.correct).length;

  // Escalate if last 2 were correct, drop if last 2 were wrong
  const diffIdx = DIFF_ORDER.indexOf(_examAdaptiveDiff);
  if (recentN >= 2 && recentCorrect === recentN && diffIdx < 2) {
    _examAdaptiveDiff = DIFF_ORDER[diffIdx + 1]; // harder
  } else if (recentN >= 2 && recentCorrect === 0 && diffIdx > 0) {
    _examAdaptiveDiff = DIFF_ORDER[diffIdx - 1]; // easier
  }

  // Pick from current pool, fall back to adjacent if empty
  const pools = _examAdaptivePools;
  const tryDiffs = [_examAdaptiveDiff,
    DIFF_ORDER[DIFF_ORDER.indexOf(_examAdaptiveDiff) + 1] || 'hard',
    DIFF_ORDER[DIFF_ORDER.indexOf(_examAdaptiveDiff) - 1] || 'easy'];

  for (const d of tryDiffs) {
    if (pools[d] && pools[d].length > 0) {
      return pools[d].shift(); // consume from pool
    }
  }
  return null; // all pools exhausted
}

/** Update the difficulty badge in the quiz topbar */
function _examUpdateDiffBadge() {
  const badge = document.getElementById('exam-adaptive-diff-badge');
  if (!badge) return;
  if (!_examAdaptiveEnabled) { badge.style.display = 'none'; return; }
  const labels = { easy: '🟢 Easy', medium: '🟡 Medium', hard: '🔴 Hard' };
  badge.textContent = labels[_examAdaptiveDiff] || _examAdaptiveDiff;
  badge.style.display = '';
}

/**
 * After an answer, determine the new difficulty and replace the NEXT
 * unanswered question with one from the appropriate pool if available.
 */
function _examAdaptiveReorder() {
  const nextIdx = _examIdx + 1;
  if (nextIdx >= _examQuestions.length) return;
  if (!_examAdaptivePools) return;

  // Re-evaluate current difficulty
  const answered = _examAnswers.filter(a => a !== null);
  const recentN  = Math.min(answered.length, 3);
  const recent   = answered.slice(-recentN);
  const recentCorrect = recent.filter(a => a.correct).length;
  const diffIdx  = DIFF_ORDER.indexOf(_examAdaptiveDiff);

  if (recentN >= 2 && recentCorrect === recentN && diffIdx < 2) {
    _examAdaptiveDiff = DIFF_ORDER[diffIdx + 1];
  } else if (recentN >= 2 && recentCorrect === 0 && diffIdx > 0) {
    _examAdaptiveDiff = DIFF_ORDER[diffIdx - 1];
  }

  // Swap in a question at the right difficulty for the next slot
  const nextQ = _examAdaptivePick();
  if (nextQ) {
    _examQuestions[nextIdx] = nextQ;
    // Extend answers array if needed
    if (_examAnswers.length <= nextIdx) _examAnswers.push(null);
    else _examAnswers[nextIdx] = null;
  }
}

async function examStart() {
  if (_isGuestMode() && !window.guestGate?.('exam')) return;
  if (_isGuestMode()) window.enforceExamConstraints?.();
  const startBtn = document.getElementById('exam-start-btn');
  if (startBtn.disabled) return; // prevent double-click race
  const topic = document.getElementById('exam-topic-input').value.trim();
  const errEl = document.getElementById('exam-error');
  errEl.style.display = 'none';

  // Resolve notes source
  const notesVal = (document.getElementById('exam-notes-input')?.value || '').trim();
  if (_examSourceTab === 'notes' && notesVal) {
    _examSourceText  = notesVal.slice(0, 100000);
    _examSourceLabel = 'your notes';
  }

  if (!topic && !_examSourceText) {
    errEl.textContent = 'Please enter a topic or upload source material.';
    errEl.style.display = 'block';
    return;
  }

  const useSections = _examSections.length > 0;
  const count   = useSections
    ? _examSections.reduce((s, x) => s + (parseInt(x.count) || 0), 0)
    : (parseInt(document.getElementById('exam-count-input')?.value) || 10);
  const timeSec = parseInt(document.getElementById('exam-time-input').value) || 0;
  _examTopic    = topic || _examSourceLabel || 'Uploaded document';
  _examTimerSec = timeSec;

  startBtn.disabled = true;
  document.getElementById('exam-loading-topic').textContent = _examTopic;
  document.getElementById('exam-loading-text').textContent  =
    _examScanMode === 'deep' ? 'Deep scanning your document…' :
    _examScanMode === 'smart' ? 'Analyzing full content…' :
    'Generating your exam…';

  // ── Task 3: Show adaptive note if weak context exists ────────────────────
  const _weakCtxPreview = _examGetWeakContext(_examTopic);
  const adaptiveNoteEl  = document.getElementById('exam-loading-adaptive');
  if (adaptiveNoteEl) {
    if (_weakCtxPreview) {
      adaptiveNoteEl.textContent = `⚡ Adaptive: focusing on ${_weakCtxPreview.concepts.slice(0,2).join(', ')}${_weakCtxPreview.concepts.length > 2 ? ' + more' : ''}`;
      adaptiveNoteEl.style.display = '';
    } else {
      adaptiveNoteEl.style.display = 'none';
    }
  }

  // Show/hide deep progress panel
  const deepProg = document.getElementById('exam-deep-progress');
  if (deepProg) deepProg.style.display = 'none';
  // Reset stages
  ['chunk','extract','generate'].forEach(s => {
    const el = document.getElementById('stage-' + s);
    if (el) el.classList.remove('active','done');
  });

  _examShow('exam-loading');

  const typeLabel = {mcq:'multiple-choice',truefalse:'true/false',fillinblank:'fill-in-the-blank',matching:'matching',situational:'situational',cbl:'case-based-learning',mixed:'mixed (include a variety: multiple-choice, true/false, fill-in-the-blank, and situational)',openended:'open-ended'}[_examType];

  // ── Task 3: Build adaptive weak context from history ─────────────────────
  const _weakContext = _examGetWeakContext(_examTopic);

  // Cancel any previous in-flight generation
  if (_examAbortCtrl) _examAbortCtrl.abort();
  _examAbortCtrl = new AbortController();

  try {
    let questions;

    if (useSections) {
      // ── Template/sections mode: generate each section independently ──
      document.getElementById('exam-loading-text').textContent = 'Generating sections…';
      const sectionResults = await Promise.all(
        _examSections.map(section => {
          const sInfo = EXAM_SECTION_TYPES[section.type] || EXAM_SECTION_TYPES.mcq;
          const tl = sInfo.typeLabel;
          if (tl === 'open-ended') {
            return _examRunOpenEnded(topic, _examSourceText, section.count);
          }
          return _examRunQuick(topic, _examSourceText, section.count, tl, _weakContext);
        })
      );
      questions = sectionResults.flat();
      _examAdaptiveEnabled = false;
    } else if (_examType === 'openended') {
      questions = await _examRunOpenEnded(topic, _examSourceText, count);
      _examAdaptiveEnabled = false;
    } else if (_examDiff === 'adaptive') {
      // ── Task 5: adaptive difficulty ramp ─────────────────
      _examAdaptiveDiff  = 'medium'; // start at medium
      document.getElementById('exam-loading-text').textContent = 'Generating adaptive exam pools…';
      _examAdaptivePools = await _examGenerateAdaptivePools(topic, _examSourceText, typeLabel, count, _weakContext);
      // Build initial question sequence from pools
      questions = [];
      let diff = 'medium';
      for (let i = 0; i < count; i++) {
        const tryDiffs = [diff,
          DIFF_ORDER[DIFF_ORDER.indexOf(diff)+1] || 'hard',
          DIFF_ORDER[DIFF_ORDER.indexOf(diff)-1] || 'easy'];
        let q = null;
        for (const d of tryDiffs) {
          if (_examAdaptivePools[d] && _examAdaptivePools[d].length > 0) {
            q = _examAdaptivePools[d].shift();
            break;
          }
        }
        if (q) questions.push(q);
      }
      // Replenish pools for mid-exam adaptive swaps
      _examAdaptivePools = await _examGenerateAdaptivePools(topic, _examSourceText, typeLabel, count, _weakContext);
      _examAdaptiveEnabled = true;
    } else if (_examScanMode === 'deep' && _examSourceText) {
      questions = await _examRunDeepScan(topic, _examSourceText, count, typeLabel, _weakContext);
      _examAdaptiveEnabled = false;
    } else if (_examScanMode === 'smart') {
      questions = await _examRunSmart(topic, _examSourceText, count, typeLabel, _weakContext);
      _examAdaptiveEnabled = false;
    } else {
      questions = await _examRunQuick(topic, _examSourceText, count, typeLabel, _weakContext);
      _examAdaptiveEnabled = false;
    }

    _examQuestions  = questions;
    _examIdx        = 0;
    _examAnswers    = new Array(questions.length).fill(null);
    _examStreakBest = 0;
    _examStreakCur  = 0;
    _examIsRetake   = false;
    _examStartTime  = Date.now();
    // Auto-save generated exam so it can be retaken later
    _examSaveGenerated();
    _examRenderSavedExams();
    _examShow('exam-quiz');
    _examRenderQuestion();
    if (_isGuestMode()) window.guestRecordUsage?.('exam');
    if (_examTimerSec > 0) _examStartTimer();
    else document.getElementById('exam-timer-display').style.display = 'none';

  } catch(err) {
    if (err.name === 'AbortError') { _examShow('exam-setup'); return; }
    _examShow('exam-setup');
    errEl.textContent = '';
    errEl.appendChild(document.createTextNode(err.message));
    errEl.appendChild(document.createElement('br'));
    const _retryBtn = document.createElement('button');
    _retryBtn.textContent = 'Try again';
    _retryBtn.style.cssText = 'margin-top:7px;padding:4px 12px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-2);font-size:10px;cursor:pointer;font-family:var(--font-body);';
    _retryBtn.onclick = examStart;
    errEl.appendChild(_retryBtn);
    errEl.style.display = 'block';
  } finally {
    startBtn.disabled = false;
    _examAbortCtrl = null;
  }
}


/* ═══════════════════════════════════════════════════════════════
   OPEN-ENDED QUESTION ENGINE — Task 4
═══════════════════════════════════════════════════════════════ */

/**
 * Generate open-ended questions. Returns array of:
 * { q, sampleAnswer, rubric, explanation, openended: true }
 */
async function _examRunOpenEnded(topic, sourceText, count) {
  let prompt;
  if (sourceText) {
    const labeled = _examLabeledSource(sourceText);
    prompt = `You are creating open-ended short-answer exam questions from the following source material.
Topic focus: "${topic || 'the document'}". Difficulty: ${_examDiff}.
Generate exactly ${count} open-ended questions that require a written response of 2–5 sentences.
Each question should test understanding, not just recall — ask students to explain, compare, analyse, or apply concepts.

For each question provide:
- "q": the question text
- "sampleAnswer": a model answer (3–6 sentences) the student should aim for
- "rubric": 3 bullet points describing what a good answer must include
- "explanation": 1–2 sentences of teaching context

Output ONLY a raw JSON array with no markdown:
[{"q":"...","sampleAnswer":"...","rubric":["point 1","point 2","point 3"],"explanation":"...","openended":true}]

SOURCE MATERIAL:
---
${labeled.slice(0, 50000)}
---`;
  } else {
    prompt = `You are a rigorous exam writer creating open-ended short-answer questions about: "${topic}". Difficulty: ${_examDiff}.
Generate exactly ${count} open-ended questions that require written responses of 2–5 sentences.
Each question should test understanding — ask students to explain, compare, analyse, or apply concepts. Avoid simple yes/no questions.

For each question provide:
- "q": the question text
- "sampleAnswer": a model answer (3–6 sentences)
- "rubric": 3 bullet points describing what a good answer must include
- "explanation": 1–2 sentences of teaching context

Output ONLY a raw JSON array with no markdown:
[{"q":"...","sampleAnswer":"...","rubric":["point 1","point 2","point 3"],"explanation":"...","openended":true}]`;
  }
  const raw = await _examCallAPI(prompt);
  return _examParseQuestions(raw);
}

/**
 * Grade a student's open-ended response using the AI.
 * Returns { score: 0-100, feedback, correct: bool }
 */
async function _examGradeOpenEnded(question, studentAnswer) {
  if (!studentAnswer || !studentAnswer.trim()) {
    return { score: 0, feedback: 'No answer was provided.', correct: false };
  }
  const rubricText = Array.isArray(question.rubric)
    ? question.rubric.map((r,i) => `${i+1}. ${r}`).join('\n')
    : '';
  const prompt = `You are grading a student's short-answer exam response. Be fair but rigorous.

QUESTION: ${question.q}

SAMPLE ANSWER: ${question.sampleAnswer}

GRADING RUBRIC:
${rubricText}

STUDENT'S ANSWER: ${studentAnswer}

Grade the student's answer. Give a score from 0–100 based on accuracy, completeness, and understanding.
- 90–100: Covers all key points clearly and accurately
- 70–89: Covers most key points with minor gaps
- 50–69: Partially correct but missing important elements
- 0–49: Incorrect, incomplete, or off-topic

Output ONLY a raw JSON object with no markdown:
{"score":85,"feedback":"Your explanation of X was strong. However, you missed Y and Z. The key insight is...","correct":true}

Set "correct" to true if score >= 70.`;

  try {
    const raw  = await _examCallAPI(prompt);
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s >= 0 && e >= 0) {
      const obj = JSON.parse(raw.slice(s, e + 1));
      return {
        score:    Math.min(100, Math.max(0, parseInt(obj.score) || 0)),
        feedback: obj.feedback || 'Graded.',
        correct:  !!obj.correct
      };
    }
  } catch(err) {}
  return { score: 0, feedback: 'Could not grade response. Please try again.', correct: false };
}

/** char counter for open-ended textarea */
function examOpenEndedInput(el) {
  const countEl = document.getElementById('exam-oe-char-count');
  if (countEl) countEl.textContent = el.value.length + ' chars';
  // Enable Next once they've typed something meaningful (≥20 chars)
  const nextBtn = document.getElementById('exam-next-btn');
  if (nextBtn) nextBtn.disabled = el.value.trim().length < 20;
}


function _examMd(text) {
  if (!text) return '';
  if (typeof homeMarkdown !== 'function') return String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  return sanitize(homeMarkdown(String(text)));
}
function _examMdInline(text) {
  return _examMd(text).replace(/^\s*<p>([\s\S]*?)<\/p>\s*$/, '$1').trim();
}

function _examRenderQuestion() {
  const q = _examQuestions[_examIdx], total = _examQuestions.length;
  _examUpdateDiffBadge();
  document.getElementById('exam-q-label').textContent = `Question ${_examIdx+1} of ${total}`;
  document.getElementById('exam-q-num').textContent   = `QUESTION ${_examIdx+1}`;

  // Show/hide source reference badge
  const refEl     = document.getElementById('exam-q-ref');
  const refTextEl = document.getElementById('exam-q-ref-text');
  if (refEl && refTextEl) {
    if (q.ref) {
      refTextEl.textContent = q.ref;
      refEl.style.display = '';
    } else {
      refEl.style.display = 'none';
    }
  }

  // Remove old scenario if present
  let existingScenario = document.getElementById('exam-q-scenario');
  if (existingScenario) existingScenario.remove();

  const rawQ   = q.q || '';
  const cblCard = document.getElementById('exam-cbl-card');
  const cblVitals = document.getElementById('exam-cbl-vitals');
  const cblBody   = document.getElementById('exam-cbl-body');
  const cblTag    = document.getElementById('exam-cbl-tag');
  const qTextEl   = document.getElementById('exam-q-text');

  if (q.case && typeof q.case === 'object') {
    // ── CBL: render clinical vignette card ──────────────────
    const c = q.case;
    if (cblTag) cblTag.textContent = c.tag || 'Clinical Case';

    // Vitals row
    if (cblVitals) {
      const vitals = c.vitals || {};
      const VITAL_LABELS = {BP:'BP',HR:'HR',RR:'RR',Temp:'Temp',SpO2:'SpO₂'};
      const NORMAL = {BP:'120/80',HR:'60-100',RR:'12-20',Temp:'36.5-37.5',SpO2:'≥95%'};
      cblVitals.innerHTML = Object.entries(vitals).map(([k,v]) => {
        const isAbn = (k==='HR' && (parseInt(v)<60||parseInt(v)>100)) ||
                      (k==='RR' && (parseInt(v)<12||parseInt(v)>20)) ||
                      (k==='SpO2' && parseInt(v)<95) ||
                      (k==='Temp' && (parseFloat(v)<36.5||parseFloat(v)>37.5));
        return '<div class="exam-cbl-vital-item"><span class="exam-cbl-vital-label">'+(VITAL_LABELS[k]||k)+'</span><span class="exam-cbl-vital-value'+(isAbn?' abnormal':'')+'">'+(v||'—')+'</span></div>';
      }).join('');
    }

    // Case body
    if (cblBody) {
      const patientLine = c.patient ? '<strong>'+c.patient+'</strong> — ' : '';
      const cc = c.chief_complaint ? '<strong>CC:</strong> '+c.chief_complaint+'<br>' : '';
      const hx = c.history ? c.history + '<br>' : '';
      const pe = c.findings ? '<strong>Findings:</strong> '+c.findings : '';
      cblBody.innerHTML = patientLine + cc + hx + pe;
    }

    if (cblCard) cblCard.style.display = '';
    // Add CBL q-type badge before question text
    const existingBadge = document.getElementById('exam-cbl-qtype');
    if (existingBadge) existingBadge.remove();
    const badge = document.createElement('div');
    badge.id = 'exam-cbl-qtype';
    badge.className = 'exam-cbl-q-type';
    badge.textContent = '🩺 ' + (q.case.tag || 'Clinical Question');
    qTextEl.parentNode.insertBefore(badge, qTextEl);
    qTextEl.innerHTML = _examMd(rawQ);

  } else {
    // Hide CBL card
    if (cblCard) cblCard.style.display = 'none';
    const existingBadge = document.getElementById('exam-cbl-qtype');
    if (existingBadge) existingBadge.remove();

    // Situational: split SCENARIO block from question stem
    const qHeader = document.querySelector('.exam-q-header');
    const scenarioMatch = rawQ.match(/^SCENARIO:\s*([\s\S]+?)\n\n(?:Question:\s*)?([\s\S]+)$/i);
    if (scenarioMatch) {
      const scenarioEl = document.createElement('div');
      scenarioEl.id = 'exam-q-scenario';
      scenarioEl.className = 'exam-q-scenario';
      scenarioEl.innerHTML = '<strong>📋 Scenario</strong>' + scenarioMatch[1].trim();
      qHeader.insertBefore(scenarioEl, qTextEl);
      qTextEl.innerHTML = _examMd(scenarioMatch[2].trim());
    } else {
      qTextEl.innerHTML = _examMd(rawQ);
    }
  }
  document.getElementById('exam-progress-fill').style.width = (_examIdx/total*100)+'%';
  document.getElementById('exam-score-live').textContent  = _examAnswers.filter(a=>a&&a.correct).length+' correct';

  const optEl = document.getElementById('exam-options');
  const oeArea = document.getElementById('exam-openended-area');
  const oeInput = document.getElementById('exam-openended-input');
  optEl.innerHTML = '';

  if (q.openended) {
    // ── Open-ended: show textarea instead of option buttons ──
    if (optEl) optEl.style.display = 'none';
    if (oeArea) oeArea.style.display = '';
    if (oeInput) {
      const prev = _examAnswers[_examIdx];
      if (prev && prev.openendedText) {
        oeInput.value = prev.openendedText;
        oeInput.disabled = true;
      } else {
        oeInput.value = '';
        oeInput.disabled = false;
      }
      const countEl = document.getElementById('exam-oe-char-count');
      if (countEl) countEl.textContent = oeInput.value.length + ' chars';
    }
    const hintEl = document.getElementById('exam-oe-hint');
    const prev = _examAnswers[_examIdx];
    if (hintEl) hintEl.textContent = prev ? '' : 'Press Next to submit for AI grading';
  } else {
    // ── MCQ / T-F / Situational / CBL ─────────────────────
    if (optEl) optEl.style.display = '';
    if (oeArea) oeArea.style.display = 'none';
  const letters = ['A','B','C','D','E'];
  q.options.forEach((opt, i) => {
    const letter = q.options.length === 2 ? (i===0?'T':'F') : letters[i];
    const btn = document.createElement('button');
    btn.className = 'exam-option';
    const letterSpan = document.createElement('span');
    letterSpan.className = 'opt-letter';
    letterSpan.textContent = letter;
    const textSpan = document.createElement('span');
    textSpan.className = 'opt-text';
    textSpan.innerHTML = _examMdInline(opt.replace(/^[A-DF]\.\s*/,''));
    btn.appendChild(letterSpan);
    btn.appendChild(textSpan);
    btn.addEventListener('click', () => _examSelect(i, btn));
    const prev = _examAnswers[_examIdx];
    if (prev !== null) {
      btn.disabled = true;
      const correctText = q.answer.replace(/^[A-DF]\.\s*/,'').trim().toLowerCase();
      const optText = opt.replace(/^[A-DF]\.\s*/,'').trim().toLowerCase();
      if (i === prev.selected) btn.classList.add(prev.correct ? 'option--correct' : 'option--wrong');
      if (!prev.correct && optText === correctText) btn.classList.add('option--correct');
    }
    optEl.appendChild(btn);
  });
  } // end else (MCQ/T-F/etc.)

  const fb = document.getElementById('exam-feedback');
  fb.className = 'exam-feedback'; fb.innerHTML = '';
  const prev = _examAnswers[_examIdx];
  if (prev !== null) _examShowFeedback(prev.correct, prev.openendedFeedback || q.explanation, prev.openendedScore);

  const nextBtn = document.getElementById('exam-next-btn');
  const skipBtn = document.getElementById('exam-skip-btn');
  nextBtn.disabled = prev === null;
  nextBtn.textContent = _examIdx === total-1 ? 'Finish' : 'Next';
  skipBtn.style.display = prev === null ? 'inline-block' : 'none';
  document.getElementById('exam-answered-hint').textContent =
    prev ? '' : `${_examAnswers.filter(a=>a!==null).length} of ${total} answered`;
}

function _examSelect(idx, btn) {
  if (_examAnswers[_examIdx] !== null) return;
  const q = _examQuestions[_examIdx];
  const chosen = q.options[idx].replace(/^[A-DF]\.\s*/,'').trim().toLowerCase();
  const ansLetter = q.answer.replace(/^([A-D])[\.\s].*/,'$1').trim();
  const letters = ['A','B','C','D','E'];
  let isCorrect = letters[idx] === ansLetter;
  if (!isCorrect) isCorrect = chosen === q.answer.replace(/^[A-DF]\.\s*/,'').trim().toLowerCase();
  if (q.options.length === 2) {
    isCorrect = (idx===0 && /^(true|t)$/i.test(q.answer)) || (idx===1 && /^(false|f)$/i.test(q.answer)) || isCorrect;
  }
  _examAnswers[_examIdx] = {selected:idx, correct:isCorrect, skipped:false};
  if (isCorrect) { _examStreakCur++; _examStreakBest = Math.max(_examStreakBest,_examStreakCur); }
  else _examStreakCur = 0;
  _examSaveProgress();

  // ── Task 5: swap remaining unanswered questions if adaptive ───────────────
  if (_examAdaptiveEnabled) _examAdaptiveReorder();
  _examUpdateDiffBadge();

  document.querySelectorAll('#exam-options .exam-option').forEach((o,i) => {
    o.disabled = true;
    if (i===idx) o.classList.add(isCorrect?'option--correct':'option--wrong');
    const oText = q.options[i].replace(/^[A-DF]\.\s*/,'').trim().toLowerCase();
    if (!isCorrect && oText === q.answer.replace(/^[A-DF]\.\s*/,'').trim().toLowerCase()) o.classList.add('option--correct');
  });
  _examShowFeedback(isCorrect, q.explanation);
  document.getElementById('exam-next-btn').disabled = false;
  document.getElementById('exam-skip-btn').style.display = 'none';
  document.getElementById('exam-score-live').textContent = _examAnswers.filter(a=>a&&a.correct).length+' correct';
}

function _examShowFeedback(ok, explanation, score) {
  const fb = document.getElementById('exam-feedback');
  fb.className = 'exam-feedback show '+(ok?'correct-fb':'wrong-fb');
  const scoreTag = (score !== undefined) ? ` <span style="font-size:11px;opacity:0.75;">(${score}/100)</span>` : '';
  fb.innerHTML = sanitize('<strong>'+(ok?'✓ Correct!':'✗ Incorrect')+'</strong>'+scoreTag) + (explanation ? ' — ' + _examMdInline(explanation) : '');
}

function examSkip() {
  _examAnswers[_examIdx] = {selected:-1, correct:false, skipped:true};
  _examStreakCur = 0;
  _examSaveProgress();
  examNext();
}

async function examNext() {
  const q = _examQuestions[_examIdx];

  // ── Open-ended: grade before advancing ───────────────────
  if (q && q.openended && _examAnswers[_examIdx] === null) {
    const oeInput = document.getElementById('exam-openended-input');
    const studentAnswer = oeInput ? oeInput.value.trim() : '';
    if (studentAnswer.length < 20) return; // guard — button should already be disabled

    // Disable UI while grading
    const nextBtn = document.getElementById('exam-next-btn');
    if (nextBtn) { nextBtn.disabled = true; nextBtn.textContent = 'Grading…'; }
    if (oeInput) oeInput.disabled = true;
    const hintEl = document.getElementById('exam-oe-hint');
    if (hintEl) hintEl.textContent = '⏳ AI is evaluating your answer…';

    const result = await _examGradeOpenEnded(q, studentAnswer);

    _examAnswers[_examIdx] = {
      selected: -1,
      correct: result.correct,
      skipped: false,
      openendedText: studentAnswer,
      openendedScore: result.score,
      openendedFeedback: result.feedback
    };

    if (result.correct) { _examStreakCur++; _examStreakBest = Math.max(_examStreakBest, _examStreakCur); }
    else _examStreakCur = 0;

    _examSaveProgress();
    _examShowFeedback(result.correct, result.feedback, result.score);
    document.getElementById('exam-score-live').textContent = _examAnswers.filter(a=>a&&a.correct).length+' correct';
    if (nextBtn) { nextBtn.disabled = false; nextBtn.textContent = _examIdx === _examQuestions.length-1 ? 'Finish' : 'Next →'; }
    if (hintEl) hintEl.textContent = '';
    return;
  }

  if (_examAnswers[_examIdx]===null) return;
  if (_examIdx < _examQuestions.length-1) {
    _examIdx++;
    _examSaveProgress();
    const card = document.getElementById('exam-q-card');
    card.style.animation='none'; requestAnimationFrame(()=>{card.style.animation='';});
    _examRenderQuestion();
  } else { _examFinish(); }
}

function _examStartTimer() {
  document.getElementById('exam-timer-display').style.display = 'flex';
  _examTimerHandle = setInterval(()=>{
    _examTimerSec--;
    const m = String(Math.floor(_examTimerSec/60)).padStart(2,'0');
    const s = String(_examTimerSec%60).padStart(2,'0');
    const el = document.getElementById('exam-timer-text');
    if (el) el.textContent = m+':'+s;
    if (_examTimerSec<=60) document.getElementById('exam-timer-display')?.classList.add('warn');
    if (_examTimerSec<=0) { clearInterval(_examTimerHandle); _examFinish(); }
  },1000);
}

function _examFinish() {
  clearInterval(_examTimerHandle);
  _examClearProgress();
  const elapsed = Math.round((Date.now()-_examStartTime)/1000);
  const correct = _examAnswers.filter(a=>a&&a.correct).length;
  const total   = _examQuestions.length;
  const pct     = Math.round(correct/total*100);
  const mm = String(Math.floor(elapsed/60)).padStart(2,'0');
  const ss = String(elapsed%60).padStart(2,'0');

  const ring = document.getElementById('score-ring');
  ring.textContent = pct+'%';
  ring.className   = 'exam-score-ring '+(pct>=60?'pass':'fail');
  document.getElementById('results-topic-title').textContent = _examTopic;
  document.getElementById('results-headline').textContent =
    pct===100?'🏆 Perfect Score!':pct>=80?'🎉 Excellent work!':pct>=60?'✓ Passing grade!':'📚 Keep studying!';
  document.getElementById('results-subline').textContent =
    pct>=60?'Review the answers below to reinforce what you learned.':'Study the explanations and try again — you\'ve got this.';
  document.getElementById('stat-correct').textContent    = correct;
  document.getElementById('stat-wrong').textContent      = total-correct;
  document.getElementById('stat-time-taken').textContent = mm+':'+ss;
  document.getElementById('stat-streak').textContent     = _examStreakBest;

  const reviewEl = document.getElementById('exam-review-list');
  reviewEl.innerHTML = _examQuestions.map((q,i)=>{
    const ans = _examAnswers[i];
    const ok  = ans&&ans.correct;
    const skip = ans&&ans.skipped;
    const _letters = ['A','B','C','D','E'];
    const isTF = q.options && q.options.length === 2;
    // Your answer: letter + full text
    let chosenDisplay = 'Skipped';
    if (!skip && ans && ans.selected >= 0) {
      const _letter = isTF ? (ans.selected===0?'T':'F') : _letters[ans.selected];
      const _text   = q.options[ans.selected].replace(/^[A-DF]\.\s*/,'');
      chosenDisplay = _letter + '. ' + _text;
    }
    // Correct: find matching option and show letter + full text
    const correctLetter  = (q.answer||'').replace(/^([A-DF])\..*/, '$1').trim();
    const correctOpt     = q.options ? q.options.find(o => o.trim().toUpperCase().startsWith(correctLetter+'.') || o.trim().toUpperCase().startsWith(correctLetter+' ')) : null;
    const correctText    = correctOpt ? correctOpt.replace(/^[A-DF]\.\s*/,'') : q.answer;
    const correctDisplay = correctLetter + '. ' + correctText;

    const border = ok?'border-color:rgba(45,212,191,0.3)':'border-color:rgba(248,113,113,0.2)';

    // ── Open-ended review ────────────────────────────────────────────────────
    if (q.openended) {
      const studentText = ans && ans.openendedText ? ans.openendedText : (skip ? 'Skipped' : '—');
      const score       = ans && ans.openendedScore !== undefined ? ans.openendedScore : null;
      const feedback    = ans && ans.openendedFeedback ? ans.openendedFeedback : q.explanation || '';
      const scoreTag    = score !== null ? ' <span style="font-size:11px;opacity:0.8;">(' + score + '/100)</span>' : '';
      return '<div class="exam-review-item" style="'+border+'">'+
        '<div style="font-size:10px;font-weight:700;color:var(--violet);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;">✍️ Open-Ended</div>'+
        '<div class="exam-review-q">'+(i+1)+'. '+_examMdInline(q.q)+'</div>'+
        '<div class="exam-review-answer" style="flex-direction:column;gap:4px;">'+
          '<div><span class="exam-review-label">Your answer:</span> <span class="exam-review-val '+(ok?'c':'w')+'">'+scoreTag+' '+sanitize(studentText)+'</span></div>'+
          (!ok ? '<div style="margin-top:6px;"><span class="exam-review-label">Sample answer:</span> <span class="exam-review-val c">'+sanitize(q.sampleAnswer||q.ideal_answer||'—')+'</span></div>' : '')+
        '</div>'+
        (feedback?'<div class="exam-review-explanation">'+_examMdInline(feedback)+'</div>':'')+
      '</div>';
    }

    return '<div class="exam-review-item" style="'+border+'">'+
      '<div class="exam-review-q">'+(i+1)+'. '+_examMdInline(q.q)+'</div>'+
      '<div class="exam-review-answer">'+
        '<span class="exam-review-label">Your answer:</span> <span class="exam-review-val '+(ok?'c':'w')+'">'+(skip?'Skipped':chosenDisplay)+'</span>'+
        (!ok?'<span class="exam-review-label" style="margin-left:8px;">Correct:</span> <span class="exam-review-val c">'+correctDisplay+'</span>':'')+
      '</div>'+
      (q.explanation?'<div class="exam-review-explanation">'+_examMdInline(q.explanation)+'</div>':'')+
    '</div>';
  }).join('');

  // ── Weak Concepts Panel ────────────────────────────────────────────────────
  _examBuildWeakPanel();

  const _snapId = Date.now();

  // ── Save to full persistent history (Task 2) ──────────────────────────────
  const wrongConcepts = _examQuestions
    .filter((q, i) => !_examAnswers[i] || !_examAnswers[i].correct)
    .map(q => _examExtractConcept(q))
    .filter(Boolean);

  _examHistoryAppend({
    timestamp: _snapId,
    topic:     _examTopic,
    score:     pct,
    date:      new Date().toLocaleDateString(),
    count:     total,
    correct:   correct,
    type:      _examType,
    diff:      _examDiff,
    timeTaken: mm+':'+ss,
    wrongConcepts,
    isRetake:  _examIsRetake,
  });

  // ── Update SRS weight store (per-concept miss counts) ──────────────────────
  _examSrsUpdateWeights(wrongConcepts, _examTopic);

  // ── Also persist to Supabase (per-user, cross-device) ─────────────────────
  // _examAnswers[i] = { selected: optionIndex, correct: bool, skipped: bool }
  // Map to per-question { chosen: letter } that the Supabase schema expects.
  const _answerLetters = ['A','B','C','D','E'];
  const _questionsWithChosen = _examQuestions.map((q, i) => {
    const ans = _examAnswers[i];
    const chosen = (ans && !ans.skipped && ans.selected >= 0)
      ? (_answerLetters[ans.selected] ?? null)
      : null;
    return { ...q, chosen };
  });
  window.ExamDB?.saveExamResult({
    documentId: null,
    topic:      _examTopic,
    questions:  _questionsWithChosen,
    score:      pct,
    meta: {
      type:         _examType,
      diff:         _examDiff,
      timeTaken:    mm + ':' + ss,
      wrongConcepts,
      count:        total,
      correct,
    },
  }).catch(err => console.warn('[ExamDB] save error:', err));
  // ── End Supabase persist ──────────────────────────────────────────────────
  const recent = JSON.parse(localStorage.getItem('exam_recent')||'[]');
  recent.unshift({
    id: _snapId,
    topic: _examTopic,
    score: pct,
    date: new Date().toLocaleDateString(),
    count: total,
    correct: correct,
    type: _examType,
    diff: _examDiff,
    timeTaken: mm+':'+ss
  });
  const trimmed = recent.slice(0, 5);
  localStorage.setItem('exam_recent', JSON.stringify(trimmed));
  // Save full snapshot (questions + answers) separately
  localStorage.setItem('exam_snap_' + _snapId, JSON.stringify({
    questions: _examQuestions,
    answers: _examAnswers,
    topic: _examTopic,
    type: _examType,
    diff: _examDiff
  }));
  // Add to sidebar recent history — reuse existing entry on retake, create new on fresh exam
  const newLabel = _examTopic + ' (' + pct + '%)';
  if (_activeExamRecentId) {
    // Retake — update the existing sidebar item in place (no new entry)
    const existing = _recentItems.find(r => r.id === _activeExamRecentId);
    if (existing) {
      existing.label    = newLabel.length > 32 ? newLabel.slice(0, 32).trimEnd() + '…' : newLabel;
      existing.question = newLabel;
      existing._snapId  = String(_snapId);
      _saveRecent();
      _renderAllRecent();
      _setActiveRecent(_activeExamRecentId);
    } else {
      // Entry was deleted — fall through to create a new one
      _activeExamRecentId = null;
    }
  }
  if (!_activeExamRecentId) {
    // Fresh exam — create new sidebar entry
    recentAdd(newLabel, null, 'exam');
    if (_recentItems.length && _recentItems[0].source === 'exam') {
      _recentItems[0]._snapId = String(_snapId);
      _activeExamRecentId = _recentItems[0].id;
      _saveRecent();
    }
  }
  // Clean up old snapshots beyond 5
  trimmed.forEach((r,i) => { if (i >= 5 && r.id) localStorage.removeItem('exam_snap_' + r.id); });
  _examLoadRecent();

  // ── Study Loop: auto-return to workspace chat with result summary ──────
  try {
    const navFrom = sessionStorage.getItem('chunks_nav_from');
    if (navFrom === 'workspace') {
      const _retTopic = _examTopic;
      const _retCorrect = correct;
      const _retTotal = total;
      // Clear the nav flag so repeat visits don't trigger this
      sessionStorage.removeItem('chunks_nav_from');
      // Show results briefly, then navigate back to workspace with a summary card
      setTimeout(() => {
        if (typeof window.showScreen === 'function') window.showScreen('workspace');
        // Allow workspace to render before appending the card
        setTimeout(() => {
          if (typeof window.wsShowExamReturnCard === 'function') {
            window.wsShowExamReturnCard(_retTopic, _retCorrect, _retTotal);
          }
        }, 300);
      }, 2000);
    }
  } catch (_) {}

  _examShow('exam-results');
}

function _examLoadRecent() {
  const list = document.getElementById('exam-recent-list');
  if (!list) return;
  const recent = JSON.parse(localStorage.getItem('exam_recent')||'[]');
  if (!recent.length) { list.innerHTML='<div style="padding:8px 12px;font-size:11px;color:var(--text-4);">No exams yet</div>'; return; }
  list.innerHTML = recent.slice(0,5).map(r=>{
    const scoreColor = r.score>=60?'var(--teal)':'#f87171';
    const countLabel = r.count ? '('+String(r.count).padStart(2,'0')+') ' : '';
    return '<div style="padding:5px 12px;font-size:11px;color:var(--text-3);display:flex;justify-content:space-between;gap:8px;cursor:pointer;border-radius:var(--r-sm);" '+
    'onmouseenter="this.style.background=\'var(--surface-2)\'" onmouseleave="this.style.background=\'transparent\'" '+
    'onclick="_examLoadSnap(\''+r.id+'\')" >'+
    '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;"><span style="color:var(--text-4);">'+countLabel+'</span>'+r.topic+'</span>'+
    '<span style="flex-shrink:0;color:'+scoreColor+';">'+r.score+'%</span>'+
    '</div>';
  }).join('');
}

function _examShowResults() {
  const correct = _examAnswers.filter(a=>a&&a.correct).length;
  const total   = _examQuestions.length;
  const pct     = Math.round(correct/total*100);

  const ring = document.getElementById('score-ring');
  if (ring) { ring.textContent = pct+'%'; ring.className = 'exam-score-ring '+(pct>=60?'pass':'fail'); }
  const topicTitleEl = document.getElementById('results-topic-title');
  if (topicTitleEl) topicTitleEl.textContent = _examTopic;
  const headEl = document.getElementById('results-headline');
  if (headEl) headEl.textContent = pct===100?'🏆 Perfect Score!':pct>=80?'🎉 Excellent work!':pct>=60?'✓ Passing grade!':'📚 Keep studying!';
  const subEl = document.getElementById('results-subline');
  if (subEl) subEl.textContent = pct>=60?'Review the answers below to reinforce what you learned.':'Study the explanations and try again \u2014 you\'ve got this.';
  const statC = document.getElementById('stat-correct');   if (statC) statC.textContent = correct;
  const statW = document.getElementById('stat-wrong');     if (statW) statW.textContent = total-correct;
  const statT = document.getElementById('stat-time-taken');if (statT) statT.textContent = '--:--';
  const statS = document.getElementById('stat-streak');    if (statS) statS.textContent = _examStreakBest;

  const reviewEl = document.getElementById('exam-review-list');
  if (reviewEl) reviewEl.innerHTML = _examQuestions.map((q,i)=>{
    const ans = _examAnswers[i];
    const ok  = ans&&ans.correct;
    const skip = ans&&ans.skipped;
    const _letters = ['A','B','C','D','E'];
    const isTF = q.options && q.options.length === 2;
    let chosenDisplay = 'Skipped';
    if (!skip && ans && ans.selected >= 0) {
      const _letter = isTF ? (ans.selected===0?'T':'F') : _letters[ans.selected];
      const _text   = q.options[ans.selected].replace(/^[A-DF]\.\s*/,'');
      chosenDisplay = _letter + '. ' + _text;
    }
    const correctLetter  = (q.answer||'').replace(/^([A-DF])\..*/, '$1').trim();
    const correctOpt     = q.options ? q.options.find(o => o.trim().toUpperCase().startsWith(correctLetter+'.') || o.trim().toUpperCase().startsWith(correctLetter+' ')) : null;
    const correctText    = correctOpt ? correctOpt.replace(/^[A-DF]\.\s*/,'') : q.answer;
    const correctDisplay = correctLetter + '. ' + correctText;
    const border = ok?'border-color:rgba(45,212,191,0.3)':'border-color:rgba(248,113,113,0.2)';
    if (q.openended) {
      const studentText = ans && ans.openendedText ? ans.openendedText : (skip ? 'Skipped' : '—');
      const score       = ans && ans.openendedScore !== undefined ? ans.openendedScore : null;
      const feedback    = ans && ans.openendedFeedback ? ans.openendedFeedback : q.explanation || '';
      const scoreTag    = score !== null ? ' <span style=\"font-size:11px;opacity:0.8;\">('+score+'/100)</span>' : '';
      return '<div class=\"exam-review-item\" style=\"'+border+'\">'+
        '<div style=\"font-size:10px;font-weight:700;color:var(--violet);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:6px;\">✍️ Open-Ended</div>'+
        '<div class=\"exam-review-q\">'+(i+1)+'. '+_examMdInline(q.q)+'</div>'+
        '<div class=\"exam-review-answer\" style=\"flex-direction:column;gap:4px;\">'+
          '<div><span class=\"exam-review-label\">Your answer:</span> <span class=\"exam-review-val '+(ok?'c':'w')+'\">'+scoreTag+' '+sanitize(studentText)+'</span></div>'+
          (!ok ? '<div style=\"margin-top:6px;\"><span class=\"exam-review-label\">Sample answer:</span> <span class=\"exam-review-val c\">'+sanitize(q.sampleAnswer||q.ideal_answer||'—')+'</span></div>' : '')+
        '</div>'+
        (feedback?'<div class=\"exam-review-explanation\">'+_examMdInline(feedback)+'</div>':'')+
      '</div>';
    }
    return '<div class=\"exam-review-item\" style=\"'+border+'\">'+
      '<div class=\"exam-review-q\">'+(i+1)+'. '+_examMdInline(q.q)+'</div>'+
      '<div class=\"exam-review-answer\">'+
        '<span class=\"exam-review-label\">Your answer:</span> <span class=\"exam-review-val '+(ok?'c':'w')+'">'+(skip?'Skipped':chosenDisplay)+'</span>'+
        (!ok?'<span class=\"exam-review-label\" style=\"margin-left:8px;\">Correct:</span> <span class=\"exam-review-val c\">'+correctDisplay+'</span>':'')+
      '</div>'+
      (q.explanation?'<div class=\"exam-review-explanation\">'+_examMdInline(q.explanation)+'</div>':'')+
    '</div>';
  }).join('');

  _examBuildWeakPanel();
  _examShow('exam-results');
}

function _examLoadSnap(id, recentItemId) {
  if (!id) return;
  const raw = localStorage.getItem('exam_snap_' + id);
  if (!raw) {
    const recent = JSON.parse(localStorage.getItem('exam_recent')||'[]');
    const entry  = recent.find(r => String(r.id) === String(id));
    if (entry) document.getElementById('exam-topic-input').value = entry.topic;
    _examShow('exam-setup');
    return;
  }
  try {
    const snap      = JSON.parse(raw);
    _examQuestions  = snap.questions;
    _examAnswers    = snap.answers;
    _examTopic      = snap.topic;
    _examType       = snap.type || 'mcq';
    _examDiff       = snap.diff || 'medium';
    _examStreakBest = 0;
    _examStreakCur  = 0;
    // Restore session tracking so a retake updates this sidebar entry
    if (recentItemId) _activeExamRecentId = recentItemId;
    _examShowResults();
  } catch(e) { _examShow('exam-setup'); }
}

/* ═══════════════════════════════════════════════════════════════
   EXAM HISTORY SYSTEM — Task 2
   Stores every completed exam in localStorage under 'exam_history'.
   No cap — full persistent history with per-topic progress tracking.
═══════════════════════════════════════════════════════════════ */

const EXAM_HISTORY_KEY = 'exam_history_v2';

function _examHistoryLoad() {
  try { return JSON.parse(localStorage.getItem(EXAM_HISTORY_KEY) || '[]'); }
  catch(e) { return []; }
}

function _examHistorySave(entries) {
  try { localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(entries)); }
  catch(e) {}
}

/** Append a new entry; called from _examFinish */
function _examHistoryAppend(entry) {
  const history = _examHistoryLoad();
  history.push(entry);
  _examHistorySave(history);
}

/** Show the history view, render everything */
async function examShowHistory() {
  ['exam-setup','exam-loading','exam-quiz','exam-results'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const histView = document.getElementById('exam-history-view');
  if (histView) histView.style.display = '';

  // Try Supabase first (per-user, cross-device); fall back to localStorage
  if (window.ExamDB && window.ChunksDB?.isLoggedIn()) {
    try {
      const remote = await window.ExamDB.loadExamHistory();
      if (remote && remote.length) {
        _examRenderHistory(_examNormaliseSupabaseRows(remote));
        return;
      }
    } catch (_) {}
  }
  _examRenderHistory();
}

function examHideHistory() {
  const histView = document.getElementById('exam-history-view');
  if (histView) histView.style.display = 'none';
  _examShow('exam-setup');
}

function examClearHistory() {
  if (!confirm('Clear all exam history? This cannot be undone.')) return;
  localStorage.removeItem(EXAM_HISTORY_KEY);
  _examRenderHistory();
}

function _examRenderHistory(history) {
  if (!history) history = _examHistoryLoad();
  _examRenderSummary(history);
  _examRenderScoreGraph(history);
  _examRenderTopics(history);
  _examRenderTable(history);
}

/**
 * Convert Supabase exams rows into the localStorage format expected
 * by the render functions.
 * Supabase row: { id, user_id, document_id, topic, questions, score, meta, created_at }
 * Expected:     { timestamp, topic, score, date, count, correct, type, diff, timeTaken, wrongConcepts }
 */
function _examNormaliseSupabaseRows(rows) {
  return rows.map(row => {
    const qs      = Array.isArray(row.questions) ? row.questions : [];
    const count   = row.meta?.count   ?? qs.length;
    const correct = row.meta?.correct ?? qs.filter(q => q.chosen && q.chosen === q.answer).length;
    return {
      timestamp:    new Date(row.created_at).getTime(),
      topic:        row.topic || row.document_id || 'Unknown',
      score:        row.score,
      date:         new Date(row.created_at).toLocaleDateString(),
      count,
      correct,
      type:         row.meta?.type         || null,
      diff:         row.meta?.diff         || null,
      timeTaken:    row.meta?.timeTaken     || null,
      wrongConcepts:row.meta?.wrongConcepts || [],
    };
  });
}

function _examRenderSummary(history) {
  const el = document.getElementById('exam-hist-summary');
  if (!el) return;
  if (!history.length) {
    el.innerHTML = '<div style="grid-column:1/-1;font-size:12px;color:var(--text-4);padding:20px 0;text-align:center;">No exams completed yet. Take your first exam to start tracking progress.</div>';
    return;
  }
  const total   = history.length;
  const avg     = Math.round(history.reduce((s,r) => s + r.score, 0) / total);
  const best    = Math.max(...history.map(r => r.score));
  const passing = history.filter(r => r.score >= 60).length;
  const passRate = Math.round(passing / total * 100);
  const stats = [
    { label: 'Exams Taken',   value: total,        color: 'var(--teal)' },
    { label: 'Average Score', value: avg + '%',     color: avg >= 60 ? 'var(--teal)' : '#f87171' },
    { label: 'Best Score',    value: best + '%',    color: 'var(--gold)' },
    { label: 'Pass Rate',     value: passRate + '%',color: passRate >= 60 ? 'var(--teal)' : '#f87171' },
  ];
  el.innerHTML = stats.map(s => `
    <div style="background:var(--surface-1);border:1px solid var(--border-xs);border-radius:var(--r-sm);padding:14px 16px;text-align:center;">
      <div style="font-family:var(--font-head);font-size:22px;font-weight:800;color:${s.color};margin-bottom:4px;">${s.value}</div>
      <div style="font-size:10px;color:var(--text-4);letter-spacing:0.05em;text-transform:uppercase;">${s.label}</div>
    </div>`).join('');
}

function _examRenderTopics(history) {
  const el = document.getElementById('exam-hist-topics');
  if (!el) return;
  if (!history.length) { el.innerHTML = ''; return; }

  // Group by topic (case-insensitive)
  const topicMap = {};
  history.forEach(r => {
    const key = (r.topic || 'Unknown').toLowerCase().trim();
    if (!topicMap[key]) topicMap[key] = { label: r.topic, entries: [] };
    topicMap[key].entries.push(r);
  });

  // Sort topics by most recent attempt
  const topics = Object.values(topicMap).sort((a, b) => {
    const aLast = Math.max(...a.entries.map(e => e.timestamp || 0));
    const bLast = Math.max(...b.entries.map(e => e.timestamp || 0));
    return bLast - aLast;
  });

  el.innerHTML = topics.map(t => {
    const sorted   = [...t.entries].sort((a,b) => (a.timestamp||0) - (b.timestamp||0));
    const scores   = sorted.map(e => e.score);
    const first    = scores[0];
    const last     = scores[scores.length - 1];
    const trend    = last - first;
    const trendStr = trend > 0 ? `+${trend}%` : trend < 0 ? `${trend}%` : '—';
    const trendCol = trend > 0 ? 'var(--teal)' : trend < 0 ? '#f87171' : 'var(--text-4)';
    const attempts = sorted.length;

    // Mini sparkline bars
    const maxScore = 100;
    const bars = scores.slice(-10).map(s => {
      const h   = Math.max(4, Math.round((s / maxScore) * 36));
      const col = s >= 60 ? 'var(--teal)' : '#f87171';
      return `<div style="width:6px;height:${h}px;background:${col};border-radius:2px;flex-shrink:0;align-self:flex-end;" title="${s}%"></div>`;
    }).join('');

    return `
      <div style="background:var(--surface-1);border:1px solid var(--border-xs);border-radius:var(--r-sm);padding:14px 18px;display:flex;align-items:center;gap:16px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;color:var(--text-1);margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.label}</div>
          <div style="font-size:11px;color:var(--text-4);">${attempts} attempt${attempts>1?'s':''} · Latest: <span style="color:${last>=60?'var(--teal)':'#f87171'};font-weight:600;">${last}%</span></div>
        </div>
        <div style="display:flex;align-items:flex-end;gap:3px;height:40px;">${bars}</div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-size:13px;font-weight:700;color:${trendCol};">${trendStr}</div>
          <div style="font-size:10px;color:var(--text-4);">trend</div>
        </div>
      </div>`;
  }).join('');
}

function _examRenderTable(history) {
  const el = document.getElementById('exam-hist-table');
  if (!el) return;
  if (!history.length) { el.innerHTML = ''; return; }

  // Most recent first
  const sorted = [...history].sort((a,b) => (b.timestamp||0) - (a.timestamp||0));

  el.innerHTML = sorted.map(r => {
    const scoreCol  = r.score >= 60 ? 'var(--teal)' : '#f87171';
    const diffLabel = { easy:'Easy', medium:'Medium', hard:'Hard' }[r.diff] || r.diff || '—';
    const typeLabel = { mcq:'MCQ', truefalse:'T/F', situational:'Situational', cbl:'Case-Based', mixed:'Mixed' }[r.type] || r.type || '—';
    const date      = r.date || '—';
    const time      = r.timeTaken || '—';
    return `
      <div style="background:var(--surface-1);border:1px solid var(--border-xs);border-radius:var(--r-sm);padding:11px 16px;display:flex;align-items:center;gap:12px;font-size:12px;">
        <div style="font-size:16px;font-weight:800;color:${scoreCol};font-family:var(--font-head);width:42px;flex-shrink:0;">${r.score}%</div>
        <div style="flex:1;min-width:0;">
          <div style="color:var(--text-1);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.topic || '—'}</div>
          <div style="color:var(--text-4);font-size:11px;margin-top:2px;">${typeLabel} · ${diffLabel} · ${r.correct ?? '?'}/${r.count ?? '?'} correct</div>
        </div>
        <div style="text-align:right;flex-shrink:0;color:var(--text-4);font-size:11px;line-height:1.6;">
          <div>${date}</div>
          <div>${time}</div>
        </div>
      </div>`;
  }).join('');
}



/**
 * Extracts a short concept label from a question that was answered wrong.
 * Uses the question text to derive a 2–5 word concept name.
 */
function _examExtractConcept(q) {
  const text = q.q || '';
  // Strip common question prefixes to get the core concept
  const cleaned = text
    .replace(/^(which of the following|what is|what are|define|explain|describe|identify|in the context of|according to|which|what)\s+/i, '')
    .replace(/\?.*$/, '')
    .trim();
  // Take first 6 words max
  const words = cleaned.split(/\s+/).slice(0, 6).join(' ');
  // Capitalise first letter
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Builds / refreshes the weak concepts panel based on current _examAnswers.
 */
function _examBuildWeakPanel() {
  const panel    = document.getElementById('exam-weak-panel');
  const chipsEl  = document.getElementById('exam-weak-chips');
  const countEl  = document.getElementById('exam-weak-count');
  if (!panel || !chipsEl) return;

  // Collect wrong/skipped questions
  const wrongQs = _examQuestions.filter((q, i) => {
    const a = _examAnswers[i];
    return !a || !a.correct;
  });

  if (!wrongQs.length) {
    panel.style.display = 'none';
    return;
  }

  // Deduplicate concepts
  const seen = new Set();
  const concepts = [];
  wrongQs.forEach(q => {
    const c = _examExtractConcept(q);
    if (c && !seen.has(c.toLowerCase())) {
      seen.add(c.toLowerCase());
      concepts.push({ label: c, q });
    }
  });

  // Store globally so nav functions can read them
  window._examWeakConcepts = concepts;
  window._examWeakTopic    = _examTopic;

  countEl.textContent = wrongQs.length + ' missed';
  chipsEl.innerHTML = concepts.slice(0, 8).map(c =>
    `<span style="
      display:inline-flex;align-items:center;gap:4px;
      padding:3px 9px;border-radius:20px;font-size:11px;
      background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.25);
      color:#f87171;font-weight:500;cursor:default;">
      ${c.label}
    </span>`
  ).join('');

  panel.style.display = '';
}

/**
 * Navigate to Flashcards screen, pre-seeding the topic with weak concepts.
 */
function examGoToFlashcards() {
  const concepts = (window._examWeakConcepts || []).map(c => c.label).join(', ');
  const topic    = window._examWeakTopic || _examTopic;
  // Try to pre-fill the flashcard topic input if it exists
  const fcTopic = document.getElementById('fc-topic-input') || document.getElementById('flash-topic-input');
  if (fcTopic) fcTopic.value = concepts || topic;
  // Store in sessionStorage so FlashScreen can pick it up on mount
  try {
    sessionStorage.setItem('exam_weak_prefill', JSON.stringify({ topic, concepts }));
  } catch(e) {}
  showScreen('flash');
}

/**
 * Navigate to Visual Tutor screen, pre-seeding the query with weak concepts.
 */
function examGoToVisualTutor() {
  const concepts = (window._examWeakConcepts || []).map(c => c.label).slice(0, 3).join(', ');
  const topic    = window._examWeakTopic || _examTopic;
  const query    = concepts ? `Explain ${concepts} from ${topic}` : `Explain ${topic}`;
  // Try to pre-fill the visual tutor input
  const vtInput = document.getElementById('vt-input') || document.getElementById('visual-tutor-input');
  if (vtInput) vtInput.value = query;
  try {
    sessionStorage.setItem('exam_weak_prefill', JSON.stringify({ topic, concepts, vtQuery: query }));
  } catch(e) {}
  showScreen('visual');
}

/**
 * Task 6: Navigate to Workspace Chat with weak concepts pre-filled and auto-sent.
 */
function examGoToChat() {
  const concepts = (window._examWeakConcepts || []).map(c => c.label).slice(0, 5);
  const topic    = window._examWeakTopic || _examTopic;

  let prompt;
  if (concepts.length === 0) {
    prompt = `I just took a practice exam on "${topic}". Can you explain the key concepts I should review?`;
  } else if (concepts.length === 1) {
    prompt = `I got this concept wrong on my exam about "${topic}". Can you explain it clearly?\n\n• ${concepts[0]}`;
  } else {
    const list = concepts.map(c => `• ${c}`).join('\n');
    prompt = `I got these ${concepts.length} concepts wrong on my exam about "${topic}". Can you explain each one?\n\n${list}`;
  }

  if (typeof showScreen === 'function') showScreen('workspace');
  setTimeout(() => {
    const inp = document.getElementById('ws-chat-input');
    if (!inp) return;
    inp.value = prompt;
    if (typeof wsAutoResize === 'function') wsAutoResize(inp);
    inp.focus();
    setTimeout(() => { if (typeof window.wsChatSend === 'function') window.wsChatSend(); }, 350);
  }, 250);
}


/**
 * Retake the current exam — reuses the same set of questions (no AI call).
 * Resets answers, index, streak, and timer; records it as a retake in history.
 */
function examRetry() {
  if (!_examQuestions || !_examQuestions.length) {
    // No questions in memory — fall back to re-generate
    const topicEl = document.getElementById('exam-topic-input');
    if (topicEl) topicEl.value = _examTopic;
    examStart();
    return;
  }
  clearInterval(_examTimerHandle);
  _examClearProgress();
  _examAnswers    = new Array(_examQuestions.length).fill(null);
  _examIdx        = 0;
  _examStreakBest = 0;
  _examStreakCur  = 0;
  _examStartTime  = Date.now();
  _examIsRetake   = true;
  _examShow('exam-quiz');
  _examRenderQuestion();
  if (_examTimerSec > 0) _examStartTimer();
  else { const td = document.getElementById('exam-timer-display'); if (td) td.style.display = 'none'; }
}
function examNewTopic() { _activeExamRecentId = null; document.getElementById('exam-topic-input').value = ''; _examShow('exam-setup'); }
function examAbort() { clearInterval(_examTimerHandle); _examClearProgress(); if (_examAbortCtrl) { _examAbortCtrl.abort(); _examAbortCtrl = null; } _examShow('exam-setup'); }

/* ═══════════════════════════════════════════════════════════════
   SRS WEIGHT STORE — per-concept miss counts (spaced repetition)
   Stored in localStorage under 'exam_srs_v1':
   { [topic_key]: { [concept]: { misses: N, lastSeen: timestamp } } }
═══════════════════════════════════════════════════════════════ */
const EXAM_SRS_KEY = 'exam_srs_v1';
const EXAM_SRS_TOPIC_KEY_MAX = 40; // max chars for localStorage topic key

function _examSrsLoad() {
  try { return JSON.parse(localStorage.getItem(EXAM_SRS_KEY) || '{}'); }
  catch(e) { return {}; }
}

/** Update miss counts after finishing an exam */
function _examSrsUpdateWeights(wrongConcepts, topic) {
  if (!wrongConcepts || !wrongConcepts.length) return;
  const topicKey = (topic || '').toLowerCase().trim().slice(0, EXAM_SRS_TOPIC_KEY_MAX);
  const store = _examSrsLoad();
  if (!store[topicKey]) store[topicKey] = {};
  const now = Date.now();
  wrongConcepts.forEach(c => {
    if (!c) return;
    const prev = store[topicKey][c] || { misses: 0, lastSeen: 0 };
    store[topicKey][c] = { misses: prev.misses + 1, lastSeen: now };
  });
  try { localStorage.setItem(EXAM_SRS_KEY, JSON.stringify(store)); } catch(e) {}
}

/* ═══════════════════════════════════════════════════════════════
   SAVED EXAMS — auto-save generated exams for later retaking
   Stored in localStorage under 'exam_saved_v1':
   Array of { id, topic, type, diff, count, createdAt, questions }
═══════════════════════════════════════════════════════════════ */
const EXAM_SAVED_KEY = 'exam_saved_v1';
const EXAM_SAVED_MAX = 20;

function _examSavedLoad() {
  try { return JSON.parse(localStorage.getItem(EXAM_SAVED_KEY) || '[]'); }
  catch(e) { return []; }
}

/** Auto-save the newly generated exam so it can be retaken anytime */
function _examSaveGenerated() {
  if (!_examQuestions || !_examQuestions.length) return;
  const saved = _examSavedLoad();
  const id = Date.now();
  const entry = {
    id,
    topic:     _examTopic,
    type:      _examType,
    diff:      _examDiff,
    count:     _examQuestions.length,
    createdAt: new Date().toLocaleDateString(),
    questions: _examQuestions,
  };
  saved.unshift(entry);
  // Keep at most EXAM_SAVED_MAX
  const trimmed = saved.slice(0, EXAM_SAVED_MAX);
  try { localStorage.setItem(EXAM_SAVED_KEY, JSON.stringify(trimmed)); } catch(e) {}
}

// ── In-progress exam persistence ─────────────────────────────────────────────
const EXAM_INPROGRESS_KEY = 'exam_inprogress_v1';

/** Save the current mid-exam state so it can be restored after navigation. */
function _examSaveProgress() {
  if (!_examQuestions || !_examQuestions.length) return;
  const state = {
    questions:    _examQuestions,
    answers:      _examAnswers,
    idx:          _examIdx,
    topic:        _examTopic,
    type:         _examType,
    diff:         _examDiff,
    startTime:    _examStartTime,
    streakBest:   _examStreakBest,
    streakCur:    _examStreakCur,
    isRetake:     _examIsRetake,
    timerSec:     _examTimerSec,
    savedAt:      Date.now(),
  };
  try { localStorage.setItem(EXAM_INPROGRESS_KEY, JSON.stringify(state)); } catch(e) {}
}

/** Remove the in-progress snapshot (exam finished, aborted, or retried). */
function _examClearProgress() {
  try { localStorage.removeItem(EXAM_INPROGRESS_KEY); } catch(e) {}
}

/**
 * Attempt to restore a mid-exam session from localStorage.
 * Returns true if a valid in-progress state was found and restored.
 */
function _examRestoreProgress() {
  let state;
  try { state = JSON.parse(localStorage.getItem(EXAM_INPROGRESS_KEY) || 'null'); } catch(e) { return false; }
  if (!state || !Array.isArray(state.questions) || !state.questions.length) return false;
  // Don't restore a fully-answered exam — let it go to setup (user should finish normally)
  const allAnswered = state.answers && state.answers.length === state.questions.length &&
                      state.answers.every(a => a !== null);
  if (allAnswered) { _examClearProgress(); return false; }

  clearInterval(_examTimerHandle);
  _examQuestions  = state.questions;
  _examAnswers    = state.answers || new Array(state.questions.length).fill(null);
  _examIdx        = typeof state.idx === 'number' ? state.idx : 0;
  _examTopic      = state.topic  || '';
  _examType       = state.type   || 'mcq';
  _examDiff       = state.diff   || 'medium';
  _examStartTime  = state.startTime  || Date.now();
  _examStreakBest = state.streakBest || 0;
  _examStreakCur  = state.streakCur  || 0;
  _examIsRetake   = !!state.isRetake;
  // Adjust remaining timer to account for time elapsed while away
  if (typeof state.timerSec === 'number' && state.timerSec > 0) {
    const elapsedAway = state.savedAt ? Math.round((Date.now() - state.savedAt) / 1000) : 0;
    _examTimerSec = Math.max(0, state.timerSec - elapsedAway);
  } else {
    _examTimerSec = 0;
  }

  _examShow('exam-quiz');
  _examRenderQuestion();
  if (_examTimerSec > 0) {
    _examStartTimer();
  } else if (state.timerSec > 0) {
    // Timer originally existed but expired while away — finish the exam
    _examFinish();
  } else {
    const td = document.getElementById('exam-timer-display');
    if (td) td.style.display = 'none';
  }
  return true;
}

/** Open a saved exam for retaking (loads questions, resets state, shows quiz) */
function _examOpenSaved(id) {
  const saved = _examSavedLoad();
  const entry = saved.find(e => String(e.id) === String(id));
  if (!entry || !entry.questions) return;
  clearInterval(_examTimerHandle);
  _examQuestions  = entry.questions;
  _examIdx        = 0;
  _examAnswers    = new Array(_examQuestions.length).fill(null);
  _examTopic      = entry.topic;
  _examType       = entry.type || 'mcq';
  _examDiff       = entry.diff || 'medium';
  _examStreakBest = 0;
  _examStreakCur  = 0;
  _examIsRetake   = false;
  _examStartTime  = Date.now();
  _examShow('exam-quiz');
  _examRenderQuestion();
  const td = document.getElementById('exam-timer-display');
  if (td) td.style.display = 'none';
}

/** Delete a saved exam by id */
function _examDeleteSaved(id) {
  const saved = _examSavedLoad().filter(e => String(e.id) !== String(id));
  try { localStorage.setItem(EXAM_SAVED_KEY, JSON.stringify(saved)); } catch(e) {}
  _examRenderSavedExams();
}

/** Render the saved exams list in the setup view */
function _examRenderSavedExams() {
  const container = document.getElementById('exam-saved-list');
  if (!container) return;
  const saved = _examSavedLoad();
  if (!saved.length) {
    container.innerHTML = '<div style="font-size:11px;color:var(--text-4);padding:8px 0;">No saved exams yet — generate one to save it automatically.</div>';
    const section = document.getElementById('exam-saved-section');
    if (section) section.style.display = 'none';
    return;
  }
  const section = document.getElementById('exam-saved-section');
  if (section) section.style.display = '';
  const typeLabel = { mcq:'MCQ', truefalse:'T/F', situational:'Situational', cbl:'Case-Based', mixed:'Mixed', openended:'Open-Ended' };
  container.innerHTML = saved.map(e => {
    const tl = typeLabel[e.type] || e.type || 'MCQ';
    const dl = { easy:'Easy', medium:'Medium', hard:'Hard', adaptive:'Adaptive' }[e.diff] || e.diff || 'Medium';
    return `<div class="exam-saved-item">
      <div class="exam-saved-info" onclick="_examOpenSaved('${e.id}')">
        <div class="exam-saved-topic">${e.topic || 'Untitled'}</div>
        <div class="exam-saved-meta">${e.count} Q · ${tl} · ${dl} · ${e.createdAt}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;">
        <button class="exam-saved-btn" onclick="_examOpenSaved('${e.id}')">Retake</button>
        <button class="exam-saved-btn exam-saved-share" onclick="shareExamSaved('${e.id}',this)" title="Share">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        </button>
        <button class="exam-saved-btn exam-saved-del" onclick="_examDeleteSaved('${e.id}')" title="Delete">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════
   SCORE LINE GRAPH — rendered in exam-history-view
   Shows score over time using SVG polyline.
   Each data point is clickable to open the exam summary modal.
═══════════════════════════════════════════════════════════════ */

/** Renders an SVG line chart of score over time into #exam-hist-graph */
function _examRenderScoreGraph(history) {
  const container = document.getElementById('exam-hist-graph');
  if (!container) return;
  if (!history || history.length < 2) {
    container.style.display = 'none';
    return;
  }
  container.style.display = '';

  // Sort chronologically
  const sorted = [...history].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  const W = 600, H = 160, PAD_L = 32, PAD_R = 20, PAD_T = 16, PAD_B = 28;
  const graphW = W - PAD_L - PAD_R;
  const graphH = H - PAD_T - PAD_B;

  const scores = sorted.map(e => e.score);
  const minS = 0, maxS = 100;

  const xScale = i => PAD_L + (scores.length < 2 ? graphW / 2 : (i / (scores.length - 1)) * graphW);
  const yScale = s => PAD_T + graphH - ((s - minS) / (maxS - minS)) * graphH;

  // Polyline points
  const points = scores.map((s, i) => `${xScale(i)},${yScale(s)}`).join(' ');

  // Filled area under the line
  const areaPoints = [
    `${xScale(0)},${PAD_T + graphH}`,
    ...scores.map((s, i) => `${xScale(i)},${yScale(s)}`),
    `${xScale(scores.length - 1)},${PAD_T + graphH}`
  ].join(' ');

  // Horizontal grid lines at 0, pass threshold, 80, 100
  const gridLines = [0, _EXAM_PASS_THRESHOLD, 80, 100].map(v => {
    const y = yScale(v);
    const col = v === _EXAM_PASS_THRESHOLD ? 'rgba(232,172,46,0.25)' : 'rgba(255,255,255,0.06)';
    return `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="${col}" stroke-width="1" stroke-dasharray="${v === _EXAM_PASS_THRESHOLD ? '4 3' : '0'}"/>
      <text x="${PAD_L - 4}" y="${y + 4}" text-anchor="end" font-size="9" fill="rgba(255,255,255,0.3)">${v}</text>`;
  }).join('');

  // Clickable data points
  const dots = scores.map((s, i) => {
    const cx = xScale(i), cy = yScale(s);
    const col = s >= _EXAM_PASS_THRESHOLD ? 'var(--teal)' : '#f87171';
    const entry = sorted[i];
    const label = (entry.topic || '').slice(0, _GRAPH_TOOLTIP_MAX_CHARS);
    const snapId = entry.timestamp;
    return `<circle cx="${cx}" cy="${cy}" r="4" fill="${col}" stroke="var(--surface-1)" stroke-width="2"
        style="cursor:pointer" onclick="_examGraphPointClick(${snapId})"
        title="${label} — ${s}% — ${entry.date || ''}"/>`;
  }).join('');

  // X-axis date labels (show first, last, and at most 3 in between)
  const labelIdxs = new Set([0, scores.length - 1]);
  if (scores.length > 2) {
    const step = Math.max(1, Math.floor((scores.length - 1) / 3));
    for (let i = step; i < scores.length - 1; i += step) labelIdxs.add(i);
  }
  const xLabels = [...labelIdxs].map(i => {
    const x = xScale(i);
    // Strip year (e.g. "/2024") to save horizontal space on x-axis
    const d = (sorted[i].date || '').replace(/\/\d{4}$/, '');
    return `<text x="${x}" y="${H - 4}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.3)">${d}</text>`;
  }).join('');

  container.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:var(--text-4);letter-spacing:0.07em;text-transform:uppercase;margin-bottom:10px;">Score Over Time</div>
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;overflow:visible;">
      <defs>
        <linearGradient id="exam-graph-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--teal)" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="var(--teal)" stop-opacity="0.01"/>
        </linearGradient>
      </defs>
      ${gridLines}
      <polygon points="${areaPoints}" fill="url(#exam-graph-grad)"/>
      <polyline points="${points}" fill="none" stroke="var(--teal)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}
      ${xLabels}
    </svg>`;
}

/** Called when user clicks a dot on the score graph */
function _examGraphPointClick(snapId) {
  if (!snapId) return;
  const raw = localStorage.getItem('exam_snap_' + snapId);
  if (!raw) {
    // No snap — show summary from history only
    const history = _examHistoryLoad();
    const entry = history.find(e => String(e.timestamp) === String(snapId));
    if (!entry) return;
    _examShowGraphSummaryModal(entry, null);
    return;
  }
  try {
    const snap = JSON.parse(raw);
    const history = _examHistoryLoad();
    const entry = history.find(e => String(e.timestamp) === String(snapId));
    _examShowGraphSummaryModal(entry || { topic: snap.topic, score: 0, date: '' }, snap);
  } catch(e) {}
}

/** Shows a compact modal with exam summary when a graph point is clicked */
const _SUMMARY_MODAL_MAX_QUESTIONS = 8; // max questions shown in the summary modal
const _GRAPH_TOOLTIP_MAX_CHARS = 28;    // max topic label length shown in graph dot tooltips
const _EXAM_PASS_THRESHOLD = 60;        // minimum score % considered a passing grade (matches app-wide rule)

/** Retakes an exam from a snapshot, closing the summary modal first */
function _examRetakeFromSnapshot(snapId) {
  const modal = document.getElementById('exam-graph-modal');
  if (modal) modal.remove();
  const raw = localStorage.getItem('exam_snap_' + snapId);
  if (!raw) return;
  try {
    const snap = JSON.parse(raw);
    if (!snap.questions || !snap.questions.length) return;
    clearInterval(_examTimerHandle);
    _examQuestions  = snap.questions;
    _examAnswers    = new Array(_examQuestions.length).fill(null);
    _examTopic      = snap.topic || _examTopic;
    _examType       = snap.type || 'mcq';
    _examDiff       = snap.diff || 'medium';
    _examIdx        = 0;
    _examStreakBest = 0;
    _examStreakCur  = 0;
    _examIsRetake   = false;
    _examStartTime  = Date.now();
    _examShow('exam-quiz');
    _examRenderQuestion();
    const td = document.getElementById('exam-timer-display');
    if (td) td.style.display = 'none';
  } catch(e) {}
}

function _examShowGraphSummaryModal(entry, snap) {
  let modal = document.getElementById('exam-graph-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'exam-graph-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);padding:16px;';
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }
  const pct = entry ? entry.score : 0;
  const scoreCol = pct >= _EXAM_PASS_THRESHOLD ? 'var(--teal)' : '#f87171';
  const qs = snap ? snap.questions : [];
  const ans = snap ? snap.answers : [];

  const reviewHtml = qs.slice(0, _SUMMARY_MODAL_MAX_QUESTIONS).map((q, i) => {
    const a = ans[i];
    const ok = a && a.correct;
    return `<div style="padding:8px 0;border-bottom:1px solid var(--border-xs);font-size:12px;">
      <span style="color:${ok ? 'var(--teal)' : '#f87171'};margin-right:6px;">${ok ? '✓' : '✗'}</span>
      ${q.q ? q.q.slice(0, 80) + (q.q.length > 80 ? '…' : '') : ''}
    </div>`;
  }).join('');

  const snapId = entry ? entry.timestamp || 0 : 0;
  modal.innerHTML = `<div style="background:var(--surface-1);border:1px solid var(--border-sm);border-radius:var(--r-md);padding:24px;max-width:480px;width:100%;max-height:80vh;overflow-y:auto;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div>
        <div style="font-size:11px;color:var(--text-4);margin-bottom:2px;">${entry ? entry.date || '' : ''}</div>
        <div style="font-size:16px;font-weight:700;color:var(--text-1);">${entry ? entry.topic || 'Exam' : 'Exam'}</div>
      </div>
      <div style="font-size:28px;font-weight:800;color:${scoreCol};font-family:var(--font-head);">${pct}%</div>
    </div>
    ${entry ? `<div style="display:flex;gap:16px;margin-bottom:16px;font-size:12px;color:var(--text-3);">
      <span>${entry.correct ?? '?'}/${entry.count ?? '?'} correct</span>
      <span>${entry.timeTaken || '—'}</span>
      ${ entry.isRetake ? '<span style="color:var(--gold);">↺ Retake</span>' : '' }
    </div>` : ''}
    ${reviewHtml ? `<div style="font-size:10px;font-weight:700;color:var(--text-4);letter-spacing:0.07em;text-transform:uppercase;margin-bottom:8px;">Questions</div>${reviewHtml}` : ''}
    ${qs.length > _SUMMARY_MODAL_MAX_QUESTIONS ? `<div style="font-size:11px;color:var(--text-4);margin-top:8px;">…and ${qs.length - _SUMMARY_MODAL_MAX_QUESTIONS} more</div>` : ''}
    <div style="display:flex;gap:8px;margin-top:20px;flex-wrap:wrap;">
      ${snap ? `<button onclick="_examRetakeFromSnapshot(${snapId})" style="padding:7px 16px;background:var(--gold);color:#1a1a1a;border:none;border-radius:var(--r-sm);font-size:12px;font-weight:600;cursor:pointer;">Retake</button>` : ''}
      <button onclick="document.getElementById('exam-graph-modal').remove()" style="padding:7px 16px;background:var(--surface-2);border:1px solid var(--border-sm);border-radius:var(--r-sm);font-size:12px;color:var(--text-3);cursor:pointer;">Close</button>
    </div>
  </div>`;
}

// Expose for sidebar _clickRecent
window._examLoadSnap = _examLoadSnap;
window._examShow     = _examShow;
Object.defineProperty(window, '_activeExamRecentId', {
  get: () => _activeExamRecentId,
  set: v  => { _activeExamRecentId = v; },
  configurable: true,
});

// Expose exam PDF upload handlers so ExamScreen.js inline handlers can call them
window._ewizTogglePdf     = _ewizTogglePdf;
window._ewizToggleNotes   = _ewizToggleNotes;
window.examSrcTab         = examSrcTab;
window.examHandlePdfFile  = examHandlePdfFile;
window.examDragOver       = examDragOver;
window.examDragLeave      = examDragLeave;
window.examDrop           = examDrop;
window.examClearSource    = examClearSource;
window.examClearNotes     = examClearNotes;
window._examToggleScanMode = _examToggleScanMode;
window.examGoToFlashcards  = examGoToFlashcards;
window.examGoToVisualTutor = examGoToVisualTutor;
window.examGoToChat        = examGoToChat;
window.examShowHistory     = examShowHistory;
window.examHideHistory     = examHideHistory;
window.examClearHistory    = examClearHistory;
window._examGetWeakContext = _examGetWeakContext;
window._examOpenSaved      = _examOpenSaved;
window._examDeleteSaved    = _examDeleteSaved;
window._examGraphPointClick = _examGraphPointClick;
window._examRetakeFromSnapshot = _examRetakeFromSnapshot;

// Expose wizard navigation / open-ended input handlers
window.ewizNext            = ewizNext;
window.ewizBack            = ewizBack;
window._ewizOnTplSelect    = _ewizOnTplSelect;
window.examOpenEndedInput  = examOpenEndedInput;

// Expose template/sections functions for inline handlers in dynamically rendered HTML
window.examSelectTemplate  = examSelectTemplate;
window.examSectionDelete   = examSectionDelete;
window.examSectionAdd      = examSectionAdd;
window.examSectionAddType  = examSectionAddType;
window._examSectionEdit    = _examSectionEdit;

// Expose mutable exam source state so ExamScreen.js module can write to them
Object.defineProperty(window, '_examSourceText',  { get: () => _examSourceText,  set: v => { _examSourceText  = v; }, configurable: true });
Object.defineProperty(window, '_examSourceLabel', { get: () => _examSourceLabel, set: v => { _examSourceLabel = v; }, configurable: true });

// Expose exam result state for shareExamResults() in share.js
Object.defineProperty(window, '_examQuestions', { get: () => _examQuestions, configurable: true });
Object.defineProperty(window, '_examAnswers',   { get: () => _examAnswers,   configurable: true });
Object.defineProperty(window, '_examTopic',     { get: () => _examTopic,     configurable: true });
Object.defineProperty(window, '_examType',      { get: () => _examType,      configurable: true });
Object.defineProperty(window, '_examDiff',      { get: () => _examDiff,      configurable: true });

document.addEventListener('DOMContentLoaded', () => { _examLoadRecent(); _examRenderSavedExams(); });


