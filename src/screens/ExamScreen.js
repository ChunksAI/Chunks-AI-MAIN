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
        <div style="margin-bottom:24px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
          <div>
            <div style="font-family:var(--font-mono);font-size:10px;color:var(--gold);letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">Exam Mode</div>
            <h1 style="font-family:var(--font-head);font-size:24px;font-weight:800;color:var(--text-1);margin-bottom:6px;">Test Your Knowledge</h1>
            <p style="font-size:13px;color:var(--text-4);line-height:1.6;">Generate a timed exam from any topic or textbook chapter. The AI will create questions, grade your answers, and explain what you got wrong.</p>
          </div>
          <button onclick="examShowHistory()" style="flex-shrink:0;display:flex;align-items:center;gap:6px;padding:7px 13px;background:var(--surface-2);border:1px solid var(--border-sm);border-radius:var(--r-sm);color:var(--text-3);font-size:11px;font-family:var(--font-body);cursor:pointer;white-space:nowrap;transition:background 0.15s;" onmouseenter="this.style.background='var(--surface-3)'" onmouseleave="this.style.background='var(--surface-2)'">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            History
          </button>
        </div>

        <div class="exam-setup-card">
          <div class="exam-setup-header">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
              <div>
                <h2>Configure Your Exam</h2>
                <p>Choose your topic, format, and difficulty — the AI does the rest.</p>
              </div>
              <div id="exam-adaptive-badge" style="display:none;flex-shrink:0;display:flex;align-items:center;gap:5px;padding:4px 10px;background:rgba(139,124,248,0.12);border:1px solid rgba(139,124,248,0.3);border-radius:20px;font-size:10px;color:var(--violet);font-weight:600;letter-spacing:0.04em;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                ADAPTIVE ON
              </div>
            </div>
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
                <button class="exam-type-btn" data-type="openended" data-action="examSelectType-self">
                  <span class="etb-icon">✍️</span>Open-Ended
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
              <!-- Open-Ended hint -->
              <div id="exam-openended-hint" style="display:none;margin-top:8px;font-size:12px;color:#c0d8c0;padding:10px 14px;background:rgba(45,212,191,0.08);border:1px solid rgba(45,212,191,0.25);border-radius:var(--r-sm);line-height:1.6;">
                ✍️ Open-ended questions require a written response. The AI will read your answer and score it based on accuracy, completeness, and understanding — giving you detailed feedback on what you got right and what to improve.
              </div>
            </div>

            <div class="exam-field">
              <label>Difficulty</label>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="exam-type-btn" data-diff="easy" data-action="examSelectDiff-self" style="flex:1;">Easy</button>
                <button class="exam-type-btn active" data-diff="medium" data-action="examSelectDiff-self" style="flex:1;">Medium</button>
                <button class="exam-type-btn" data-diff="hard" data-action="examSelectDiff-self" style="flex:1;">Hard</button>
                <button class="exam-type-btn" data-diff="adaptive" data-action="examSelectDiff-self" style="flex:1;border-color:rgba(139,124,248,0.4);color:var(--violet);">
                  ⚡ Adaptive
                </button>
              </div>
              <div id="exam-adaptive-diff-hint" style="display:none;margin-top:8px;font-size:11px;color:var(--violet);padding:8px 12px;background:rgba(139,124,248,0.08);border:1px solid rgba(139,124,248,0.25);border-radius:var(--r-sm);line-height:1.6;">
                ⚡ <strong>Adaptive mode</strong> generates 3 difficulty pools and dynamically escalates or drops difficulty based on your answers — get 2 right in a row and it gets harder, miss 2 and it eases up.
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
          <button onclick="examShowHistory()" style="display:flex;align-items:center;gap:5px;padding:6px 12px;background:var(--surface-2);border:1px solid var(--border-sm);border-radius:var(--r-sm);color:var(--text-3);font-size:11px;font-family:var(--font-body);cursor:pointer;" onmouseenter="this.style.background='var(--surface-3)'" onmouseleave="this.style.background='var(--surface-2)'">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            View History
          </button>
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

  // ── Wire notes textarea listener now that the DOM element exists
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
}

// ── Auto-mount (synchronous) ──────────────────────────────────────────────────
mountExamScreen();

console.log('[ExamScreen] module loaded ✦');
