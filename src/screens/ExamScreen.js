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
        <div style="margin-bottom:24px;">
          <div style="font-family:var(--font-mono);font-size:10px;color:var(--gold);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">Exam Mode</div>
          <h1 style="font-family:var(--font-head);font-size:24px;font-weight:800;color:var(--text-1);margin-bottom:6px;">Test Your Knowledge</h1>
          <p style="font-size:13px;color:var(--text-4);line-height:1.6;">Generate a timed exam from any topic or textbook chapter. The AI will create questions, grade your answers, and explain what you got wrong.</p>
        </div>

        <div class="exam-setup-card">
          <div class="exam-setup-header">
            <h2>Configure Your Exam</h2>
            <p>Choose your topic, format, and difficulty — the AI does the rest.</p>
          </div>
          <div class="exam-setup-body">

            <div class="exam-field">
              <label>Topic or Chapter</label>
              <input class="exam-input" id="exam-topic-input" type="text" placeholder="e.g. Mitosis and Meiosis, World War II, Newton's Laws…" />
            </div>

            <!-- ── Source Material ── -->
            <div class="exam-field">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <label style="margin-bottom:0;">Source Material <span style="color:var(--text-4);font-weight:400;letter-spacing:0;">(optional)</span></label>
                <div class="exam-src-tabs" id="exam-src-tabs">
                  <button class="exam-src-tab active" data-tab="pdf" onclick="examSrcTab(this)">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    PDF
                  </button>
                  <button class="exam-src-tab" data-tab="notes" onclick="examSrcTab(this)">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
                    Notes
                  </button>
                </div>
              </div>

              <!-- PDF tab -->
              <div id="exam-src-pdf">
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

              <!-- Notes tab -->
              <div id="exam-src-notes" style="display:none;">
                <textarea id="exam-notes-input" class="exam-input exam-notes-area"
                  placeholder="Paste your study notes, lecture slides text, or any content you want the exam based on…"></textarea>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px;">
                  <span id="exam-notes-count" style="font-size:10px;color:var(--text-4);font-family:var(--font-mono);">0 chars</span>
                  <button data-action="examClearNotes" class="hover-clear-btn" style="font-size:10px;color:var(--text-4);background:none;border:none;cursor:pointer;font-family:var(--font-body);">Clear</button>
                </div>
              </div>
            </div>
            <!-- /Source Material -->

            <!-- ── Scan Mode (shown when source material is attached) ── -->
            <div class="exam-field" id="exam-scan-mode-field" style="display:none;">
              <label>Generation Mode</label>
              <div class="exam-scan-grid">

                <div class="exam-scan-card active" data-mode="quick" data-action="examSelectScanMode-self">
                  <div class="exam-scan-top">
                    <span class="exam-scan-icon">⚡</span>
                    <span class="exam-scan-badge" style="background:rgba(45,212,191,0.12);color:var(--teal);">~4s</span>
                  </div>
                  <div class="exam-scan-name">Quick</div>
                  <div class="exam-scan-desc">Fixed question count from your material. Fast, great for a quick quiz.</div>
                </div>

                <div class="exam-scan-card" data-mode="smart" data-action="examSelectScanMode-self">
                  <div class="exam-scan-top">
                    <span class="exam-scan-icon">🧠</span>
                    <span class="exam-scan-badge" style="background:rgba(139,124,248,0.12);color:var(--violet);">~6s</span>
                  </div>
                  <div class="exam-scan-name">Smart</div>
                  <div class="exam-scan-desc">AI reads the full document first, then generates questions covering every section.</div>
                </div>

                <div class="exam-scan-card" data-mode="deep" data-action="examSelectScanMode-self">
                  <div class="exam-scan-top">
                    <span class="exam-scan-icon">🔬</span>
                    <span class="exam-scan-badge" style="background:rgba(232,172,46,0.12);color:var(--gold);">~20s</span>
                  </div>
                  <div class="exam-scan-name">Deep Scan</div>
                  <div class="exam-scan-desc">Chunks your document, extracts every concept, and generates one question per concept.</div>
                </div>

              </div>
              <!-- Deep scan note -->
              <div id="exam-deep-note" style="display:none;margin-top:8px;font-size:11px;color:var(--text-4);padding:8px 12px;background:var(--gold-muted);border:1px solid var(--gold-border);border-radius:var(--r-sm);line-height:1.5;">
                🔬 Deep Scan generates <strong style="color:var(--gold);">one question per concept</strong> found across your entire document — ignoring the question count unless you set it above 10 to cap large results.
              </div>
            </div>
            <!-- /Scan Mode -->

            <div class="exam-row">
              <div class="exam-field">
                <label id="exam-count-label">Number of Questions</label>
                <select class="exam-input" id="exam-count-input">
                  <option value="5">5 questions</option>
                  <option value="10" selected>10 questions</option>
                  <option value="15">15 questions</option>
                  <option value="20">20 questions</option>
                  <option value="30">30 questions</option>
                </select>
              </div>
              <div class="exam-field">
                <label>Time Limit</label>
                <select class="exam-input" id="exam-time-input">
                  <option value="0">No limit</option>
                  <option value="300">5 minutes</option>
                  <option value="600" selected>10 minutes</option>
                  <option value="900">15 minutes</option>
                  <option value="1800">30 minutes</option>
                </select>
              </div>
            </div>

            <div class="exam-field">
              <label>Question Type</label>
              <div class="exam-type-grid exam-type-grid-5" id="exam-type-grid">
                <button class="exam-type-btn active" data-type="mcq" data-action="examSelectType-self">
                  <span class="etb-icon">🔘</span>Multiple Choice
                </button>
                <button class="exam-type-btn" data-type="truefalse" data-action="examSelectType-self">
                  <span class="etb-icon">✅</span>True / False
                </button>
                <button class="exam-type-btn" data-type="situational" data-action="examSelectType-self">
                  <span class="etb-icon">⚡</span>Situational
                </button>
                <button class="exam-type-btn" data-type="cbl" data-action="examSelectType-self">
                  <span class="etb-icon">🩺</span>Case-Based
                </button>
                <button class="exam-type-btn" data-type="mixed" data-action="examSelectType-self">
                  <span class="etb-icon">🎲</span>Mixed
                </button>
              </div>
              <!-- CBL hint -->
              <div id="exam-cbl-hint" style="display:none;margin-top:8px;font-size:12px;color:#e0c4c4;padding:10px 14px;background:rgba(220,38,38,0.13);border:1px solid rgba(220,38,38,0.35);border-radius:var(--r-sm);line-height:1.6;">
                🩺 Case-Based Learning presents a full clinical vignette — patient age, sex, chief complaint, history, vitals, and labs — then asks for the <strong style="color:#ff8a8a;font-weight:700;">diagnosis, next best step, or treatment</strong>. Designed for medical students.
              </div>
              <!-- Situational hint -->
              <div id="exam-situational-hint" style="display:none;margin-top:8px;font-size:12px;color:#c8c0e0;padding:10px 14px;background:rgba(139,92,246,0.13);border:1px solid rgba(139,92,246,0.35);border-radius:var(--r-sm);line-height:1.6;">
                📋 Situational questions present a real-world scenario (patient case, workplace event, academic problem) and ask what the <strong style="color:#b899ff;font-weight:700;">best course of action</strong> is. Great for clinical, professional, or applied exams.
              </div>
            </div>

            <div class="exam-field">
              <label>Difficulty</label>
              <div style="display:flex;gap:8px;">
                <button class="exam-type-btn" data-diff="easy" data-action="examSelectDiff-self" style="flex:1;">Easy</button>
                <button class="exam-type-btn active" data-diff="medium" data-action="examSelectDiff-self" style="flex:1;">Medium</button>
                <button class="exam-type-btn" data-diff="hard" data-action="examSelectDiff-self" style="flex:1;">Hard</button>
              </div>
            </div>

            <div id="exam-error" style="display:none;font-size:12px;color:#f87171;padding:10px 14px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:var(--r-sm);"></div>

            <button class="exam-start-btn" id="exam-start-btn" data-action="examStart">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Generate Exam
            </button>
          </div>
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
          <div class="exam-actions">
            <button class="exam-nav-btn primary" data-action="examRetry" style="flex:1;">
              Retake Exam
            </button>
            <button class="exam-nav-btn secondary" data-action="examNewTopic" style="flex:1;">
              New Topic
            </button>
          </div>
        </div>
      </div><!-- /exam-results -->

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

  // Wire notes textarea listener now that the DOM element exists
  const notesEl = document.getElementById('exam-notes-input');
  if (notesEl) {
    notesEl.addEventListener('input', () => {
      const len = notesEl.value.length;
      const countEl = document.getElementById('exam-notes-count');
      if (countEl) countEl.textContent = len.toLocaleString() + ' chars';
      window._examSourceText  = notesEl.value.slice(0, 60000);
      window._examSourceLabel = 'your notes';
      if (typeof window._examToggleScanMode === 'function') window._examToggleScanMode(len > 0);
    });
  }
}

// ── Auto-mount (synchronous) ──────────────────────────────────────────────────
mountExamScreen();

console.log('[ExamScreen] module loaded ✦');
