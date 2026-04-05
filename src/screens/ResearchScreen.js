// @ts-nocheck
/**
 * src/screens/ResearchScreen.js — Task 28
 *
 * Owns:
 *   • #screen-research HTML injection (replaces data-research-screen placeholder)
 *   • Re-initialises the drag-and-drop outline sorter after mount, because the
 *     _initDragDrop() IIFE in index.html runs at parse time (non-module script)
 *     before this module injects #screen-research, so it no-ops and we must
 *     re-attach the same listeners here.
 *
 * All research logic (RS state, _researchStart, _renderOutline, _generateParagraph,
 * switchResearchTab, _researchSelectLayer, _switchCitTab, _runPaperSearch,
 * _exportPDF, _flashAutosave, etc.) remains in the large research script block
 * in index.html — those will move in a later phase.
 */

// ── HTML template ─────────────────────────────────────────────────────────────

const RESEARCH_HTML = /* html */`
<div class="screen" id="screen-research" style="flex-direction:row;overflow:hidden;">

  <!-- Mobile topbar (hidden on desktop) -->
  <div class="mobile-screen-topbar" style="display:none;">
    <button type="button" class="mst-back" data-action="goHome" aria-label="Back">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
    </button>
    <span class="mst-title">Research</span>
    <div class="mst-badge gold" id="research-mobile-badge" style="display:none;">In Progress</div>
  </div>

  <!-- Sidebar -->
  <aside class="sidebar" data-sidebar-screen="research"></aside>

  <!-- Main Research Layout -->
  <div class="research-layout">

    <!-- Top bar (hidden until project started) -->
    <div class="research-topbar" id="research-topbar" style="display:none;">
      <button class="icon-btn" data-action="_researchBackToSetup" style="margin-right:4px;" title="Back to setup">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <div class="research-topbar-title" id="research-paper-title">Untitled Research</div>
      <div class="research-status">
        <div class="research-status-dot"></div>
        <span id="research-progress-label">0 of 17 layers complete</span>
      </div>
      <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-4);display:flex;align-items:center;gap:4px;">
        <span id="topbar-words">0</span><span style="opacity:0.5;">/ ~3,000 words</span>
      </div>
      <span id="autosave-indicator" style="font-family:var(--font-mono);font-size:10px;color:var(--text-4);opacity:0;transition:opacity 0.4s;margin-left:4px;">✓ Saved</span>
      <button class="btn-sec-research" data-action="_confirmNewPaper" style="font-size:11px;padding:5px 14px;margin-left:4px;">New Paper</button>
      <button class="btn-sec-research" style="font-size:11px;padding:5px 14px;" data-action="_exportPDF">Export PDF</button>
    </div>

    <!-- SETUP VIEW -->
    <div class="research-setup" id="research-setup-view">
      <div class="research-setup-icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#e8ac2e" stroke-width="1.5" stroke-linecap="round"><path d="M9 12h6m-3-3v6"/><path d="M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"/><path d="M21 7H3l1.5 11A2 2 0 0 0 6.48 20h11.04a2 2 0 0 0 1.98-2L21 7z"/></svg>
      </div>
      <h2>Start Your Research Paper</h2>
      <p>Enter your topic and research problem. The AI will generate a structured outline with sections and layers — then guide you step-by-step using real academic sources.</p>
      <div class="setup-form">
        <div class="setup-field">
          <div class="setup-label">Research Title</div>
          <input class="setup-input" id="research-title-input" type="text" placeholder="e.g. The Impact of Social Media on Academic Performance Among College Students">
        </div>
        <div class="setup-field">
          <div class="setup-label">Research Problem / Objective</div>
          <textarea class="setup-input" id="research-problem-input" rows="3" placeholder="Describe the problem you want to solve or the question you want to answer…"></textarea>
        </div>
        <div class="setup-row">
          <div class="setup-field" style="flex:1;">
            <div class="setup-label">Field / Discipline</div>
            <input class="setup-input" id="research-field-input" type="text" placeholder="e.g. Psychology, Education, Chemistry…">
          </div>
          <div class="setup-field" style="flex:1;">
            <div class="setup-label">Paper Type</div>
            <select class="setup-input" id="research-type-input" style="cursor:pointer;">
              <option>Quantitative Research</option>
              <option>Qualitative Research</option>
              <option>Mixed Methods</option>
              <option>Literature Review</option>
              <option>Case Study</option>
            </select>
          </div>
        </div>
        <button class="setup-btn" id="generate-outline-btn" data-action="_researchStart">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span id="generate-outline-btn-text">Generate Research Outline</span>
        </button>

        <!-- AI Generation progress (hidden until generating) -->
        <div id="outline-gen-progress" style="display:none;margin-top:16px;width:100%;max-width:520px;">
          <div style="background:var(--surface-2);border:1px solid var(--border-xs);border-radius:var(--r-md);padding:16px 18px;display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="display:flex;gap:4px;" id="gen-thinking-dots">
                <span style="width:5px;height:5px;border-radius:50%;background:var(--violet);animation:blink 1s ease-in-out infinite;display:inline-block;"></span>
                <span style="width:5px;height:5px;border-radius:50%;background:var(--violet);animation:blink 1s ease-in-out 0.2s infinite;display:inline-block;"></span>
                <span style="width:5px;height:5px;border-radius:50%;background:var(--violet);animation:blink 1s ease-in-out 0.4s infinite;display:inline-block;"></span>
              </div>
              <span id="gen-status-text" style="font-size:12px;color:var(--text-2);">Thinking about your research topic…</span>
            </div>
            <div style="height:3px;background:var(--surface-3);border-radius:2px;overflow:hidden;">
              <div id="gen-progress-bar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--violet),var(--gold));border-radius:2px;transition:width 0.5s ease;"></div>
            </div>
            <div id="gen-outline-preview" style="display:none;font-size:11px;color:var(--text-3);font-family:var(--font-mono);line-height:1.8;"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- MAIN RESEARCH VIEW (outline + editor + sources) -->
    <div id="research-view-main" style="display:none;flex:1;overflow:hidden;">
      <div class="research-body">

        <!-- Left: Outline tree -->
        <nav class="research-outline">
          <div class="research-outline-head">
            <span>Outline</span>
            <span id="outline-done-counter" style="color:var(--teal);font-size:9px;">0 / 17 done</span>
          </div>
          <div class="research-outline-scroll">

            <!-- Section I -->
            <div class="ro-section open">
              <div class="ro-section-header active" onclick="this.parentElement.classList.toggle('open')">
                <span class="ro-section-num">I</span>
                <span>Introduction</span>
                <div class="ro-progress">
                  <div class="ro-pip filled"></div>
                  <div class="ro-pip filled"></div>
                  <div class="ro-pip"></div>
                  <div class="ro-pip"></div>
                  <div class="ro-pip"></div>
                </div>
                <svg class="ro-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
              <div class="ro-layers">
                <div class="ro-layer done" onclick="_researchSelectLayer(this,'Background of the Study','Introduction')">Background of the Study</div>
                <div class="ro-layer done" onclick="_researchSelectLayer(this,'Global Problem','Introduction')">Global Problem</div>
                <div class="ro-layer active" onclick="_researchSelectLayer(this,'Local Problem','Introduction')">Local Problem</div>
                <div class="ro-layer" onclick="_researchSelectLayer(this,'Research Gap','Introduction')">Research Gap</div>
                <div class="ro-layer" onclick="_researchSelectLayer(this,'Purpose of the Study','Introduction')">Purpose of the Study</div>
              </div>
            </div>

            <!-- Section II -->
            <div class="ro-section">
              <div class="ro-section-header" onclick="this.parentElement.classList.toggle('open')">
                <span class="ro-section-num">II</span>
                <span>Review of Related Literature</span>
                <div class="ro-progress">
                  <div class="ro-pip"></div>
                  <div class="ro-pip"></div>
                  <div class="ro-pip"></div>
                </div>
                <svg class="ro-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
              <div class="ro-layers">
                <div class="ro-layer" onclick="_researchSelectLayer(this,'Theoretical Framework','Review of Related Literature')">Theoretical Framework</div>
                <div class="ro-layer" onclick="_researchSelectLayer(this,'Related Studies (Global)','Review of Related Literature')">Related Studies (Global)</div>
                <div class="ro-layer" onclick="_researchSelectLayer(this,'Related Studies (Local)','Review of Related Literature')">Related Studies (Local)</div>
              </div>
            </div>

            <!-- Section III -->
            <div class="ro-section">
              <div class="ro-section-header" onclick="this.parentElement.classList.toggle('open')">
                <span class="ro-section-num">III</span>
                <span>Methodology</span>
                <div class="ro-progress">
                  <div class="ro-pip"></div>
                  <div class="ro-pip"></div>
                  <div class="ro-pip"></div>
                  <div class="ro-pip"></div>
                </div>
                <svg class="ro-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
              <div class="ro-layers">
                <div class="ro-layer" onclick="_researchSelectLayer(this,'Research Design','Methodology')">Research Design</div>
                <div class="ro-layer" onclick="_researchSelectLayer(this,'Participants &amp; Sampling','Methodology')">Participants &amp; Sampling</div>
                <div class="ro-layer" onclick="_researchSelectLayer(this,'Data Collection','Methodology')">Data Collection</div>
                <div class="ro-layer" onclick="_researchSelectLayer(this,'Data Analysis','Methodology')">Data Analysis</div>
              </div>
            </div>

            <!-- Section IV -->
            <div class="ro-section">
              <div class="ro-section-header" onclick="this.parentElement.classList.toggle('open')">
                <span class="ro-section-num">IV</span>
                <span>Results &amp; Discussion</span>
                <div class="ro-progress">
                  <div class="ro-pip"></div>
                  <div class="ro-pip"></div>
                  <div class="ro-pip"></div>
                </div>
                <svg class="ro-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
              <div class="ro-layers">
                <div class="ro-layer">Key Findings</div>
                <div class="ro-layer">Interpretation</div>
                <div class="ro-layer">Implications</div>
              </div>
            </div>

            <!-- Section V -->
            <div class="ro-section">
              <div class="ro-section-header" onclick="this.parentElement.classList.toggle('open')">
                <span class="ro-section-num">V</span>
                <span>Conclusion</span>
                <div class="ro-progress">
                  <div class="ro-pip"></div>
                  <div class="ro-pip"></div>
                </div>
                <svg class="ro-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
              </div>
              <div class="ro-layers">
                <div class="ro-layer">Summary</div>
                <div class="ro-layer">Recommendations</div>
              </div>
            </div>

          </div><!-- /scroll -->
        </nav>

        <!-- Center: Layer editor -->
        <div class="research-main">
          <div class="research-tabs">
            <div class="research-tab active" onclick="switchResearchTab('write', this)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Write Layer
            </div>
            <div class="research-tab" onclick="switchResearchTab('search', this)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              Search Papers
            </div>
            <div class="research-tab" onclick="switchResearchTab('paper', this)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Full Paper
            </div>
          </div>

          <div class="research-content">

            <!-- TAB: Write Layer -->
            <div id="tab-write" class="research-tab-panel" style="display:flex;flex:1;overflow:hidden;">
            <div class="layer-editor" style="overflow-y:auto;">

              <div class="layer-header">
                <div class="layer-section-crumb">
                  <span>Introduction</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
                  <span style="color:var(--gold);">Local Problem</span>
                </div>
                <div class="layer-title">Local Problem</div>
                <div class="layer-desc" id="layer-desc-text">Loading…</div>
                <div id="layer-tip-card" style="display:none;margin-top:8px;background:var(--surface-2);border:1px solid var(--border-xs);border-radius:var(--r-sm);overflow:hidden;">
                  <div id="layer-tip-checklist" style="padding:10px 14px 6px;display:flex;flex-direction:column;gap:5px;font-size:11px;color:var(--text-3);line-height:1.5;"></div>
                  <div style="padding:6px 14px 8px;display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border-xs);">
                    <span id="layer-tip-target" style="font-size:10px;color:var(--text-4);font-family:var(--font-mono);"></span>
                    <button data-action="_toggleTip" style="font-size:10px;padding:4px 10px;background:var(--surface-3);border:1px solid var(--border-xs);border-radius:var(--r-pill);color:var(--text-3);cursor:pointer;font-family:var(--font-body);position:relative;z-index:1;">Dismiss</button>
                  </div>
                </div>
                <button id="layer-tip-toggle" data-action="_toggleTip" style="margin-top:6px;font-size:10px;background:transparent;border:none;color:var(--text-4);cursor:pointer;font-family:var(--font-body);padding:0;display:flex;align-items:center;gap:4px;">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Show tips
                </button>
              </div>

              <div class="layer-steps" id="layer-steps-container">
                <!-- Rendered dynamically by _renderLayerEditor() -->
              </div>
            </div><!-- /layer-editor -->
            </div><!-- /tab-write -->

            <!-- TAB: Search Papers -->
            <div id="tab-search" class="research-tab-panel" style="display:none;flex:1;flex-direction:column;overflow:hidden;">
              <div style="padding:20px 24px 12px;border-bottom:1px solid var(--border-xs);flex-shrink:0;">
                <div style="font-family:var(--font-head);font-size:15px;font-weight:700;color:var(--text-1);margin-bottom:4px;">Search Academic Papers</div>
                <div style="font-size:12px;color:var(--text-3);">Find and attach sources to any layer of your research paper.</div>
                <div style="display:flex;gap:8px;margin-top:12px;">
                  <div class="hover-search-wrap" style="flex:1;display:flex;align-items:center;gap:8px;background:var(--surface-2);border:1px solid var(--border-xs);border-radius:var(--r-sm);padding:8px 12px;transition:border-color var(--t-fast);">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="color:var(--text-4);flex-shrink:0;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <input id="paper-search-input" type="text" placeholder="Search by title, author, keyword…" style="flex:1;background:transparent;border:none;outline:none;font-family:var(--font-body);font-size:13px;color:var(--text-1);" onkeydown="if(event.key==='Enter')_runPaperSearch()">
                  </div>
                  <button data-action="_runPaperSearch" class="hover-search-btn" style="padding:8px 18px;border-radius:var(--r-sm);background:var(--gold);border:none;color:#090900;font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font-body);white-space:nowrap;transition:background var(--t-fast);">Search</button>
                </div>
                <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
                  <span style="font-size:11px;color:var(--text-4);">Try:</span>
                  <span id="search-chip-1" class="prompt-chip" style="font-size:11px;padding:3px 10px;" onclick="document.getElementById('paper-search-input').value=this.textContent;_runPaperSearch()">social media academic performance</span>
                  <span id="search-chip-2" class="prompt-chip" style="font-size:11px;padding:3px 10px;" onclick="document.getElementById('paper-search-input').value=this.textContent;_runPaperSearch()">digital distraction students</span>
                  <span id="search-chip-3" class="prompt-chip" style="font-size:11px;padding:3px 10px;" onclick="document.getElementById('paper-search-input').value=this.textContent;_runPaperSearch()">screen time GPA correlation</span>
                </div>
              </div>
              <!-- Ready-to-write banner — shown when sources are attached -->
              <div id="sources-ready-banner" style="display:none;padding:10px 24px;background:var(--gold-muted);border-bottom:1px solid var(--gold-border);flex-shrink:0;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span id="sources-ready-label" style="font-size:12px;color:var(--gold);font-weight:600;">1 source attached to this layer</span>
                  </div>
                  <button onclick="switchResearchTab('write', document.querySelectorAll('.research-tab')[0])" style="padding:5px 14px;border-radius:var(--r-pill);background:var(--gold);border:none;color:#090900;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font-body);white-space:nowrap;">
                    Write Layer →
                  </button>
                </div>
              </div>
              <div id="paper-search-results" style="flex:1;overflow-y:auto;padding:16px 24px;display:flex;flex-direction:column;gap:8px;">
                <!-- Default state -->
                <div id="paper-search-empty" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:10px;color:var(--text-4);text-align:center;">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" opacity="0.25"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <div style="font-size:12px;">Search for papers and attach them to this layer</div>
                  <div style="font-size:11px;color:var(--text-4);opacity:0.6;">Sources give the AI context to write a better paragraph</div>
                </div>
              </div>
            </div><!-- /tab-search -->

            <!-- TAB: Full Paper — rendered dynamically by _renderFullPaper() -->
            <div id="tab-paper" class="research-tab-panel" style="display:none;flex:1;flex-direction:column;overflow:hidden;">
              <div style="padding:16px 24px 12px;border-bottom:1px solid var(--border-xs);flex-shrink:0;display:flex;align-items:center;gap:10px;">
                <div style="flex:1;">
                  <div style="font-family:var(--font-head);font-size:15px;font-weight:700;color:var(--text-1);">Full Paper Preview</div>
                  <div style="font-size:12px;color:var(--text-3);margin-top:2px;" id="full-paper-subtitle">All accepted layers compiled</div>
                </div>
                <button data-action="_exportPDF" class="hover-export-btn" style="padding:6px 14px;border-radius:var(--r-pill);background:transparent;border:1px solid var(--border-md);color:var(--text-2);font-size:11px;cursor:pointer;font-family:var(--font-body);display:flex;align-items:center;gap:6px;transition:all var(--t-fast);">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Export PDF
                </button>
              </div>
              <div id="full-paper-body" style="flex:1;overflow-y:auto;padding:32px 48px;max-width:800px;margin:0 auto;width:100%;">
                <!-- Rendered by _renderFullPaper() -->
              </div>
            </div><!-- /tab-paper -->

          </div><!-- /research-content -->
        </div><!-- /research-main -->

        <!-- Right: Sources panel -->
        <div class="research-side">
          <!-- Citation Manager tabs -->
          <div style="display:flex;border-bottom:1px solid var(--border-xs);">
            <button id="cit-tab-sources" onclick="_switchCitTab('sources')" style="flex:1;padding:10px 0;background:transparent;border:none;border-bottom:2px solid var(--gold);color:var(--text-1);font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font-body);transition:all 0.15s;">Sources</button>
            <button id="cit-tab-refs" onclick="_switchCitTab('refs')" style="flex:1;padding:10px 0;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--text-3);font-size:11px;font-weight:600;cursor:pointer;font-family:var(--font-body);transition:all 0.15s;">References</button>
            <span id="sources-count-badge" style="display:flex;align-items:center;padding:0 10px;font-size:10px;color:var(--gold);font-family:var(--font-mono);">0</span>
          </div>

          <!-- Sources tab -->
          <div id="cit-panel-sources" class="research-side-scroll" style="flex:1;overflow-y:auto;padding:12px;">
            <!-- Rendered dynamically by _renderSourcesPanel() -->
          </div>

          <!-- References tab -->
          <div id="cit-panel-refs" style="display:none;flex:1;overflow-y:auto;padding:12px;">
            <!-- Rendered dynamically by _renderReferences() -->
          </div>

          <div class="research-paper-stats">
            <div class="rps-card">
              <div class="rps-num" id="stat-sources">0</div>
              <div class="rps-label">Sources Used</div>
            </div>
            <div class="rps-card">
              <div class="rps-num" id="stat-layers">0</div>
              <div class="rps-label">Layers Done</div>
            </div>
            <div class="rps-card">
              <div class="rps-num" id="stat-words">0</div>
              <div class="rps-label">Words Written</div>
            </div>
            <div class="rps-card" style="border-color:var(--gold-border);">
              <div class="rps-num" id="stat-pct" style="font-size:16px;">0%</div>
              <div class="rps-label">Complete</div>
            </div>
          </div>
        </div>

      </div><!-- /research-body -->
    </div><!-- /research-view-main -->

  </div><!-- /research-layout -->
</div><!-- /screen-research -->
`;

// ── Mount ─────────────────────────────────────────────────────────────────────

export function mountResearchScreen() {
  const placeholder = document.querySelector('[data-research-screen]');
  if (!placeholder) {
    console.warn('[ResearchScreen] placeholder [data-research-screen] not found');
    return;
  }
  placeholder.outerHTML = RESEARCH_HTML;

  // Re-initialise drag-and-drop after injecting the screen.
  // The _initDragDrop() IIFE in index.html runs at parse time (non-module script)
  // before this module executes, so it finds no #screen-research and no-ops.
  // We replicate the same listener setup here.
  _initResearchDragDrop();
}

// ── Drag-and-drop outline sorter ──────────────────────────────────────────────
// Mirrors the _initDragDrop() IIFE in index.html. Listeners are attached once
// to the persistent #screen-research root — re-rendering the outline never
// leaks handlers.
// _dragSrcId / _dragSrcSid are declared by the appended research-engine block below.

function _initResearchDragDrop() {
  const root = document.getElementById('screen-research');
  if (!root) return;

  root.addEventListener('dragstart', e => {
    const el = e.target.closest('.ro-layer[draggable]');
    if (!el) return;
    _dragSrcId  = el.dataset.lid;
    _dragSrcSid = el.dataset.sid;
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  root.addEventListener('dragend', () => {
    root.querySelectorAll('.ro-layer').forEach(l =>
      l.classList.remove('dragging', 'drag-over')
    );
  });

  root.addEventListener('dragover', e => {
    const target = e.target.closest('.ro-layer[draggable]');
    if (!target) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    root.querySelectorAll('.ro-layer').forEach(l => l.classList.remove('drag-over'));
    if (target.dataset.lid !== _dragSrcId) target.classList.add('drag-over');
  });

  root.addEventListener('drop', e => {
    e.preventDefault();
    const target = e.target.closest('.ro-layer[draggable]');
    if (!target || !_dragSrcId || target.dataset.lid === _dragSrcId) return;

    // RS / _save / _renderOutline / _showToast live in index.html's research block
    const RS = window.RS;
    if (!RS?.outline) return;

    const srcSec = RS.outline.find(s => s.id === _dragSrcSid);
    const dstSec = RS.outline.find(s => s.id === target.dataset.sid);
    if (!srcSec || !dstSec) return;

    const srcIdx = srcSec.layers.findIndex(l => l.id === _dragSrcId);
    const dstIdx = dstSec.layers.findIndex(l => l.id === target.dataset.lid);
    if (srcIdx === -1 || dstIdx === -1) return;

    const [moved] = srcSec.layers.splice(srcIdx, 1);
    dstSec.layers.splice(dstIdx, 0, moved);

    window._save?.();
    window._renderOutline?.();
    window._showToast?.('⇅', `Moved "${moved.name}"`, 'var(--text-3)');
  });
}

// ── Auto-mount (synchronous) ──────────────────────────────────────────────────
mountResearchScreen();

console.log('[ResearchScreen] module loaded ✦');

/* ══════════════════════════════════════════════════════════════
   CHUNKS RESEARCH — STATE ENGINE
   localStorage key: chunks_research_v1
   All state lives in RS (Research State).
   Call _save() after any mutation. _load() on page start.
═══════════════════════════════════════════════════════════════ */

/* ── Backend URL — controlled by API_BASE constant defined at top of page ── */

const LS_KEY = 'chunks_research_v1';

/* ── Default outline structure (17 layers total) ── */
const DEFAULT_OUTLINE = [
  { id: 'intro',   num: 'I',   title: 'Introduction',               open: true,
    layers: [
      { id: 'intro-bg',      name: 'Background of the Study' },
      { id: 'intro-global',  name: 'Global Problem'          },
      { id: 'intro-local',   name: 'Local Problem'           },
      { id: 'intro-gap',     name: 'Research Gap'            },
      { id: 'intro-purpose', name: 'Purpose of the Study'    },
    ]
  },
  { id: 'rrl',    num: 'II',  title: 'Review of Related Literature', open: false,
    layers: [
      { id: 'rrl-theory',   name: 'Theoretical Framework'    },
      { id: 'rrl-global',   name: 'Related Studies (Global)' },
      { id: 'rrl-local',    name: 'Related Studies (Local)'  },
    ]
  },
  { id: 'method', num: 'III', title: 'Methodology',                  open: false,
    layers: [
      { id: 'method-design',    name: 'Research Design'          },
      { id: 'method-sample',    name: 'Participants & Sampling'  },
      { id: 'method-collect',   name: 'Data Collection'          },
      { id: 'method-analysis',  name: 'Data Analysis'            },
    ]
  },
  { id: 'results', num: 'IV', title: 'Results & Discussion',         open: false,
    layers: [
      { id: 'results-findings',  name: 'Key Findings'   },
      { id: 'results-interp',    name: 'Interpretation' },
      { id: 'results-impl',      name: 'Implications'   },
    ]
  },
  { id: 'conclusion', num: 'V', title: 'Conclusion',                 open: false,
    layers: [
      { id: 'conc-summary', name: 'Summary'         },
      { id: 'conc-rec',     name: 'Recommendations' },
    ]
  },
];

/* ── Blank state template ── */
function _blankState() {
  return {
    title:    '',
    problem:  '',
    field:    '',
    type:     'Quantitative Research',
    started:  false,
    activeLayerId: 'intro-bg',
    layers: {},   // { [layerId]: { status:'pending'|'active'|'done', paragraph:'', sources:[], isEdited:false } }
    outline: DEFAULT_OUTLINE,
  };
}

/* ── RS: live state object ── */
let RS = _blankState();
let _stageTimerHandle = null; // cancellable reference for outline-generation progress timer

/* ── Persist ── */
function _save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(RS));
    _flashAutosave();
  } catch(e) { console.warn('Save failed', e); }
}

function _load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      RS = Object.assign(_blankState(), parsed);
      // Ensure outline always has full structure
      if (!RS.outline || RS.outline.length !== DEFAULT_OUTLINE.length) {
        RS.outline = DEFAULT_OUTLINE;
      }
    }
  } catch(e) {
    console.warn('Load failed, using blank state', e);
    RS = _blankState();
  }
}

/* ── Get/set a single layer state ── */
function _layer(id) {
  if (!RS.layers[id]) {
    RS.layers[id] = { status: 'pending', paragraph: '', sources: [], isEdited: false, history: [] };
  }
  return RS.layers[id];
}

/* ── Autosave flash ── */
let _saveTimer = null;
function _flashAutosave() {
  const el = document.getElementById('autosave-indicator');
  if (!el) return;
  el.style.opacity = '1';
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => { el.style.opacity = '0'; }, 2000);
}

/* ══════════════════════════════════════════════════════════════
   SIDEBAR & NAVIGATION
══════════════════════════════════════════════════════════════ */
// animateOrbits — provided by index.html
// toggleSidebar — provided by index.html
// newChat — provided by index.html
// openLibraryModal — provided by index.html

/* ══════════════════════════════════════════════════════════════
   SETUP FORM
══════════════════════════════════════════════════════════════ */
function _bindSetupForm() {
  const fields = [
    ['research-title-input',   'title'],
    ['research-problem-input', 'problem'],
    ['research-field-input',   'field'],
    ['research-type-input',    'type'],
  ];
  fields.forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    // Restore
    el.value = RS[key] || '';
    // Save on input
    el.addEventListener('input', () => { RS[key] = el.value; _save(); });
    el.addEventListener('change', () => { RS[key] = el.value; _save(); });
  });
}

// ── Shared fetch helper for all research AI calls ─────────────────────────
// Retries up to 3 times on 429 with exponential backoff (2s, 4s, 8s).
// Handles guest-limited responses before retrying.
// Pass an AbortSignal as the second arg (e.g. for paper search cancellation).
async function _researchFetchWithRetry(bodyObj, signal, _statusEl) {
  // _statusEl (optional): a DOM element to show live countdown during rate-limit waits
  // Auth header is fetched inside the loop so each retry gets a fresh token,
  // preventing stale-token 403s on long sessions.

  const MAX_ATTEMPTS = 4;
  const DELAYS = [2000, 4000, 8000]; // 2s, 4s, 8s between retries
  let res;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Refresh auth header on every attempt so an expired token is never re-used.
    const _authHdr = (typeof window._getAuthHeader === 'function')
      ? await window._getAuthHeader()
      : _getAuthHeader();

    res = await fetch(API_BASE + '/ask', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ..._authHdr },
      ...(signal ? { signal } : {}),
      body:    JSON.stringify(bodyObj)
    });

    // 403 — CSRF / origin mismatch or auth failure.
    // Retry once with a freshly-fetched token; give up on a second 403.
    if (res.status === 403) {
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      break; // second 403 — let the caller surface the error
    }

    if (res.status !== 429) break;

    // 429 — check why before deciding to retry.
    const d429 = await res.clone().json().catch(() => ({}));

    // Guest wall — stop immediately and show login prompt.
    if (_handleGuestLimited(d429)) {
      throw Object.assign(new Error('guest_limited'), { _guestLimited: true });
    }

    // Plan limit exceeded — opening the upgrade modal is more helpful than retrying.
    if (d429.plan_limited && d429.upgrade_needed) {
      if (typeof window.openUpgradeModal === 'function') window.openUpgradeModal();
      throw Object.assign(new Error('plan_limited'), { _planLimited: true });
    }

    if (attempt >= MAX_ATTEMPTS - 1) {
      throw new Error('Server is busy — please try again in a moment.');
    }

    // Show live countdown so the UI doesn't look frozen
    const waitMs = DELAYS[attempt] || 8000;
    const waitSec = Math.ceil(waitMs / 1000);
    if (_statusEl) {
      let remaining = waitSec;
      _statusEl.textContent = `Server busy — retrying in ${remaining}s…`;
      const tick = setInterval(() => {
        remaining--;
        if (remaining > 0) _statusEl.textContent = `Server busy — retrying in ${remaining}s…`;
        else clearInterval(tick);
      }, 1000);
      await new Promise(r => setTimeout(r, waitMs));
      clearInterval(tick);
    } else {
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
  return res;
}

async function _researchStart() {
  if (_isGuestMode() && !window.guestGate?.('research')) return;

  const title   = document.getElementById('research-title-input')?.value.trim();
  const problem = document.getElementById('research-problem-input')?.value.trim() || '';
  const field   = document.getElementById('research-field-input')?.value.trim() || '';
  const type    = document.getElementById('research-type-input')?.value || 'Quantitative Research';

  // Validate
  if (!title) {
    const inp = document.getElementById('research-title-input');
    inp?.focus();
    inp.style.borderColor = 'var(--red)';
    inp.style.boxShadow = '0 0 0 2px rgba(248,113,113,0.15)';
    setTimeout(() => { inp.style.borderColor = ''; inp.style.boxShadow = ''; }, 1800);
    return;
  }

  // Save form values
  RS.title   = title;
  RS.problem = problem;
  RS.field   = field;
  RS.type    = type;

  // Show loading UI
  const btn      = document.getElementById('generate-outline-btn');
  const btnText  = document.getElementById('generate-outline-btn-text');
  const progress = document.getElementById('outline-gen-progress');
  const statusEl = document.getElementById('gen-status-text');
  const barEl    = document.getElementById('gen-progress-bar');
  const preview  = document.getElementById('gen-outline-preview');

  btn.disabled = true;
  btn.style.opacity = '0.6';
  progress.style.display = 'block';

  // Animate progress through stages
  const stages = [
    { pct: 15, text: 'Analyzing your research topic…' },
    { pct: 35, text: 'Identifying key sections for ' + type + '…' },
    { pct: 55, text: 'Generating layers and sub-topics…' },
    { pct: 75, text: 'Structuring your research outline…' },
    { pct: 90, text: 'Almost ready…' },
  ];
  let stageIdx = 0;
  if (_stageTimerHandle) { clearInterval(_stageTimerHandle); _stageTimerHandle = null; }
  _stageTimerHandle = setInterval(() => {
    if (stageIdx >= stages.length) return;
    const s = stages[stageIdx++];
    statusEl.textContent = s.text;
    barEl.style.width = s.pct + '%';
  }, 800);

  try {
    const prompt = `Generate a structured research paper outline as raw JSON only. No explanation, no markdown, no backticks — just the JSON array.

Research Title: ${title}
Research Problem/Objective: ${problem || '(not specified)'}
Field/Discipline: ${field || '(not specified)'}
Paper Type: ${type}

Return ONLY a JSON array like this:
[
  {
    "id": "intro",
    "title": "Introduction",
    "layers": [
      { "id": "intro_background", "name": "Background of the Study" },
      { "id": "intro_global", "name": "Global Problem" }
    ]
  }
]

Rules:
- 4 to 6 sections appropriate for ${type}
- Each section has 2 to 5 layers (sub-sections)
- IDs are unique snake_case strings
- Layer names are specific and academic (e.g. "Background of the Study", "Research Gap", "Theoretical Framework")
- Tailor sections and layers to the field and topic provided
- For Quantitative Research: Introduction, Review of Related Literature, Methodology, Results and Discussion, Conclusion
- For Qualitative Research: Introduction, Literature Review, Research Design, Findings and Analysis, Conclusion
- For Literature Review: Introduction, Scope and Coverage, Thematic Analysis, Synthesis, Conclusion
- For Case Study: Introduction, Background of Case, Analysis, Discussion, Conclusion
- For Mixed Methods: Introduction, Literature Review, Quantitative Methods, Qualitative Methods, Integrated Findings, Conclusion
- Output ONLY the JSON array — nothing before or after it`;

    const response = await _researchFetchWithRetry({
      question:   prompt,
      mode:       'study',
      task_type:  'research',
      ...(() => { const p = _aiParams(7); return { complexity: p.complexity, language: p.language, safe_content: p.safe_content }; })(),
      bookId:     'none',
      history:    []
    }, null, statusEl);

    if (!response.ok) throw new Error('Server error ' + response.status + ' — please try again.');
    const data = await response.json();
    if (_handleGuestLimited(data)) return;
    if (!data.success) throw new Error(data.error || 'Backend returned failure');
    const raw = (data.answer || '').trim();

    // ── Aggressive JSON extractor ──────────────────────────────────────────
    // Model may wrap in markdown, add prose before/after, or use single quotes.
    // Strategy: find the outermost [ ... ] array in the response.
    function extractJsonArray(str) {
      // 1. Strip markdown fences
      str = str.replace(/```json/gi, '').replace(/```/g, '').trim();
      // 2. Find first '[' and last ']'
      const start = str.indexOf('[');
      const end   = str.lastIndexOf(']');
      if (start === -1 || end === -1 || end <= start) throw new Error('No JSON array found in response');
      let candidate = str.slice(start, end + 1);
      // 3. Fix common model mistakes:
      //    - Trailing commas before } or ]
      candidate = candidate.replace(/,\s*([}\]])/g, '$1');
      //    - Single-quoted strings → double-quoted
      candidate = candidate.replace(/'([^'\n]*)'/g, '"$1"');
      //    - Unquoted keys: word: → "word":
      candidate = candidate.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
      return JSON.parse(candidate);
    }

    const parsed = extractJsonArray(raw);

    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Invalid outline structure');

    // Finish progress bar
    clearInterval(_stageTimerHandle); _stageTimerHandle = null;
    barEl.style.width = '100%';
    statusEl.textContent = '✓ Outline generated!';

    // Show outline preview before transition
    preview.style.display = 'block';
    preview.innerHTML = parsed.map((sec, i) => {
      const roman = ['I','II','III','IV','V','VI','VII','VIII'][i] || (i+1);
      return `<span style="color:var(--text-1);font-weight:600;">${roman}. ${sec.title}</span>\n` +
        sec.layers.map(l => `  · ${l.name}`).join('\n');
    }).join('\n\n');

    // Normalize parsed outline to match RS structure
    RS.outline = parsed.map((sec, i) => ({
      id:     sec.id || 'section_' + i,
      num:    ['I','II','III','IV','V','VI','VII','VIII'][i] || String(i+1),
      title:  sec.title,
      open:   i === 0,
      layers: (sec.layers || []).map(l => ({
        id:   l.id || sec.id + '_' + l.name.toLowerCase().replace(/[^a-z0-9]/g,'_').replace(/__+/g,'_'),
        name: l.name
      }))
    }));

    // Set first layer active
    const firstLayer = RS.outline[0]?.layers[0];
    if (firstLayer) {
      RS.activeLayerId = firstLayer.id;
      _layer(firstLayer.id).status = 'active';
    }

    RS.started = true;
    _save();
    if (_isGuestMode()) window.guestRecordUsage?.('research');

    // Short pause so student can see the outline preview, then transition
    await new Promise(r => setTimeout(r, 1200));
    _showResearchView();

  } catch (err) {
    clearInterval(_stageTimerHandle); _stageTimerHandle = null;

    // Plan-limited: upgrade modal already opened by _researchFetchWithRetry — just reset the button.
    // Guest-limited: login wall already shown — same.
    if (err._planLimited || err._guestLimited) {
      progress.style.display = 'none';
      btn.disabled = false;
      btn.style.opacity = '1';
      return;
    }

    console.error('Outline generation failed:', err);
    console.error('Backend URL was:', API_BASE + '/ask');

    // Show the REAL error so it's debuggable
    const errMsg = err?.message || String(err);
    statusEl.textContent = '⚠ ' + errMsg;
    statusEl.style.color = 'var(--red)';
    barEl.style.width = '100%';
    barEl.style.background = 'var(--red)';

    // Use default outline as fallback
    RS.outline = DEFAULT_OUTLINE.map(s => ({ ...s, layers: s.layers.map(l => ({ ...l })) }));
    const firstLayer = RS.outline[0]?.layers[0];
    if (firstLayer) {
      RS.activeLayerId = firstLayer.id;
      _layer(firstLayer.id).status = 'active';
    }
    RS.started = true;
    _save();

    await new Promise(r => setTimeout(r, 1600));
    _showResearchView();
  } finally {
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

function _researchBackToSetup() {
  // Cancel any in-flight outline generation timer
  if (_stageTimerHandle) { clearInterval(_stageTimerHandle); _stageTimerHandle = null; }
  document.getElementById('research-view-main').style.display = 'none';
  document.getElementById('research-setup-view').style.display = 'flex';
  document.getElementById('research-topbar').style.display = 'none';
  // Reset progress/preview UI so stale state from a previous session does not show
  const progress = document.getElementById('outline-gen-progress');
  if (progress) progress.style.display = 'none';
  const preview = document.getElementById('gen-outline-preview');
  if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
  const bar = document.getElementById('gen-progress-bar');
  if (bar) bar.style.width = '0%';
  const statusEl = document.getElementById('gen-status-text');
  if (statusEl) statusEl.textContent = 'Thinking about your research topic…';
  const btn = document.getElementById('generate-outline-btn');
  if (btn) { btn.disabled = false; btn.style.opacity = ''; }
}

/* ══════════════════════════════════════════════════════════════
   SHOW / RESTORE RESEARCH VIEW
══════════════════════════════════════════════════════════════ */
function _showResearchView() {
  document.getElementById('research-setup-view').style.display   = 'none';
  document.getElementById('research-view-main').style.display    = 'flex';
  document.getElementById('research-view-main').style.flex       = '1';
  document.getElementById('research-view-main').style.overflow   = 'hidden';
  document.getElementById('research-topbar').style.display       = 'flex';
  document.getElementById('research-paper-title').textContent    = RS.title || 'Untitled Research';
  // Show mobile badge
  const rmb = document.getElementById('research-mobile-badge');
  if (rmb) rmb.style.display = 'flex';

  _renderOutline();
  _renderLayerEditor(RS.activeLayerId);
  _renderSourcesPanel();
  _updateStats();
  _updateSearchChips();
}

function _updateSearchChips() {
  // Build smart search suggestions from the paper's title, field, and active layer
  const allLayers  = RS.outline.flatMap(s => s.layers);
  const activeLayer = allLayers.find(l => l.id === RS.activeLayerId);
  const field = RS.field || '';
  const layerName = activeLayer?.name || '';

  // Extract 2-3 key words from title
  const titleWords = (RS.title || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g,'')
    .split(/\s+/)
    .filter(w => w.length > 3 && !['among','between','effects','study','research','impact','role','relationship','analysis'].includes(w))
    .slice(0,3);

  const chip1 = titleWords.join(' ') || 'academic performance students';
  const chip2 = field ? `${field.toLowerCase()} ${titleWords[0] || ''}`.trim() : (titleWords[0] || '') + ' systematic review';
  const chip3 = layerName ? layerName.toLowerCase() : titleWords.slice(1).join(' ') || 'higher education';

  const chips = [chip1, chip2, chip3];
  chips.forEach((text, i) => {
    const el = document.getElementById('search-chip-' + (i+1));
    if (el && text) { el.textContent = text; }
  });
}

/* ══════════════════════════════════════════════════════════════
   OUTLINE TREE — fully dynamic
══════════════════════════════════════════════════════════════ */
function _renderOutline() {
  const container = document.querySelector('.research-outline-scroll');
  if (!container) return;
  container.innerHTML = '';

  const totalLayers = RS.outline.flatMap(s => s.layers).length;
  const doneLayers  = RS.outline.flatMap(s => s.layers).filter(l => _layer(l.id).status === 'done').length;

  document.getElementById('outline-done-counter').textContent = `${doneLayers} / ${totalLayers} done`;

  const romanNums = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];

  RS.outline.forEach((section, si) => {
    const secLayers    = section.layers;
    const doneSec      = secLayers.filter(l => _layer(l.id).status === 'done').length;
    const isOpen       = section.open;

    const secEl = document.createElement('div');
    secEl.className = 'ro-section' + (isOpen ? ' open' : '');
    secEl.dataset.sid = section.id;

    // Build pip HTML
    const pips = secLayers.map(l => {
      const st = _layer(l.id).status;
      return `<div class="ro-pip${st === 'done' ? ' filled' : ''}"></div>`;
    }).join('');

    const isSecActive = secLayers.some(l => _layer(l.id).status === 'active');

    secEl.innerHTML = `
      <div class="ro-section-header${isSecActive ? ' active' : ''}" onclick="_toggleSection('${section.id}')">
        <span class="ro-section-num">${romanNums[si] || section.num}</span>
        <span>${section.title}</span>
        <div class="ro-progress">${pips}</div>
        <svg class="ro-chevron" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg>
      </div>
      <div class="ro-layers">
        ${secLayers.map(layer => {
          const st = _layer(layer.id).status;
          const isActive = layer.id === RS.activeLayerId;
          const wc = _layer(layer.id).paragraph ? _wordCount(_layer(layer.id).paragraph) : 0;
          const tgt = _wordTarget(layer.name);
          const wcBadge = wc > 0 ? `<span style="font-family:var(--font-mono);font-size:9px;color:${wc >= tgt ? 'var(--teal)' : 'var(--text-4)'};margin-left:auto;flex-shrink:0;">${wc}w</span>` : '';
          return `<div class="ro-layer ${st === 'done' ? 'done' : ''} ${isActive ? 'active' : ''}"
            data-lid="${layer.id}"
            data-sid="${section.id}"
            draggable="true"
            onclick="_researchSelectLayer(this,'${layer.name}','${section.title}','${layer.id}')"
            style="display:flex;align-items:center;gap:4px;"
          ><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${layer.name}</span>${wcBadge}</div>`;
        }).join('')}
      </div>`;

    container.appendChild(secEl);
  });
}

/* ── Drag-and-drop: delegated on persistent ancestor ──────────
   Listeners are attached once to #screen-research (never removed
   or re-added), so re-rendering the outline never leaks handlers. */
let _dragSrcId  = null;
let _dragSrcSid = null;

(function _initDragDrop() {
  // Use the screen element as the persistent root — it is never
  // re-created, so this listener is attached exactly once.
  const root = document.getElementById('screen-research');
  if (!root) return;

  root.addEventListener('dragstart', e => {
    const el = e.target.closest('.ro-layer[draggable]');
    if (!el) return;
    _dragSrcId  = el.dataset.lid;
    _dragSrcSid = el.dataset.sid;
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  root.addEventListener('dragend', () => {
    root.querySelectorAll('.ro-layer').forEach(l =>
      l.classList.remove('dragging', 'drag-over')
    );
  });

  root.addEventListener('dragover', e => {
    const target = e.target.closest('.ro-layer[draggable]');
    if (!target) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    root.querySelectorAll('.ro-layer').forEach(l => l.classList.remove('drag-over'));
    if (target.dataset.lid !== _dragSrcId) target.classList.add('drag-over');
  });

  root.addEventListener('drop', e => {
    e.preventDefault();
    const target = e.target.closest('.ro-layer[draggable]');
    if (!target || !_dragSrcId || target.dataset.lid === _dragSrcId) return;

    const srcSec = RS.outline.find(s => s.id === _dragSrcSid);
    const dstSec = RS.outline.find(s => s.id === target.dataset.sid);
    if (!srcSec || !dstSec) return;

    const srcIdx = srcSec.layers.findIndex(l => l.id === _dragSrcId);
    const dstIdx = dstSec.layers.findIndex(l => l.id === target.dataset.lid);
    if (srcIdx === -1 || dstIdx === -1) return;

    const [moved] = srcSec.layers.splice(srcIdx, 1);
    dstSec.layers.splice(dstIdx, 0, moved);

    _save();
    _renderOutline();
    _showToast('⇅', `Moved "${moved.name}"`, 'var(--text-3)');
  });
})();

function _toggleSection(sectionId) {
  const sec = RS.outline.find(s => s.id === sectionId);
  if (sec) { sec.open = !sec.open; _save(); }
  const el = document.querySelector(`.ro-section[data-sid="${sectionId}"]`);
  if (el) el.classList.toggle('open', sec?.open);
}

/* ══════════════════════════════════════════════════════════════
   LAYER EDITOR
══════════════════════════════════════════════════════════════ */
function _researchSelectLayer(el, name, section, layerId) {
  RS.activeLayerId = layerId;
  _save();
  _renderLayerEditor(layerId);
  _renderSourcesPanel();

  // Update outline active highlight
  document.querySelectorAll('.ro-layer').forEach(l => l.classList.remove('active'));
  el.classList.add('active');
}

function _renderLayerEditor(layerId) {
  const allLayers = RS.outline.flatMap(s => s.layers);
  const layerObj  = allLayers.find(l => l.id === layerId);
  if (!layerObj) return;

  const sectionObj = RS.outline.find(s => s.layers.some(l => l.id === layerId));
  const ls         = _layer(layerId);

  // Update crumb and title
  const crumb = document.querySelector('.layer-section-crumb');
  const title = document.querySelector('.layer-title');
  const desc  = document.querySelector('.layer-desc');
  if (crumb) crumb.innerHTML = `<span>${sectionObj?.title || ''}</span><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m9 18 6-6-6-6"/></svg><span style="color:var(--gold);">${layerObj.name}</span>`;
  if (title) title.textContent = layerObj.name;
  const descEl = document.getElementById('layer-desc-text') || desc;
  if (descEl) descEl.textContent = _layerHint(layerObj.name);
  if (desc && desc.id !== 'layer-desc-text') desc.textContent = _layerHint(layerObj.name);

  // Populate tip checklist
  const tipList = document.getElementById('layer-tip-checklist');
  const tipTarget = document.getElementById('layer-tip-target');
  if (tipList) {
    const items = _layerChecklist(layerObj.name);
    tipList.innerHTML = items.map(t =>
      `<div style="display:flex;align-items:flex-start;gap:6px;">
        <span style="color:var(--gold);flex-shrink:0;margin-top:1px;">·</span>
        <span>${t}</span>
      </div>`
    ).join('');
  }
  if (tipTarget) tipTarget.textContent = `Target: ~${_wordTarget(layerObj.name)} words`;

  // Re-render steps based on layer status
  const stepsEl = document.getElementById('layer-steps-container') || document.querySelector('.layer-steps');
  if (!stepsEl) return;
  stepsEl.innerHTML = _buildLayerSteps(layerId, layerObj, ls);
  _bindLayerStepActions(layerId);
}

function _layerHint(name) {
  const hints = {
    'Background of the Study': 'Introduce your topic broadly — what is it, why does it matter globally? Aim for 2–3 paragraphs with at least 2 recent sources.',
    'Global Problem':           'Present the problem at a worldwide scale. Use statistics and cite global studies to establish the severity of the issue.',
    'Local Problem':            'Narrow down to your country, institution, or community. Show how the global problem manifests locally with local studies.',
    'Research Gap':             'Identify what is missing in existing literature. What has not been studied yet? This justifies your paper\'s existence.',
    'Purpose of the Study':     'State clearly what your study aims to achieve. Use action verbs: "This study aims to determine, explore, examine…"',
    'Theoretical Framework':    'Present the theory or model that underpins your study. Explain how it connects to your research problem.',
    'Related Studies (Global)': 'Summarize and synthesize relevant international studies. Group by themes, not by author.',
    'Related Studies (Local)':  'Summarize local studies related to your topic. Highlight similarities and differences with global studies.',
    'Research Design':          'Describe the overall approach: quantitative, qualitative, or mixed. Justify why this design suits your research questions.',
    'Participants & Sampling':  'Describe who your participants are, how many, and how you will select them. Justify your sampling method.',
    'Data Collection':          'Describe your instruments (survey, interview, test) and procedure for gathering data.',
    'Data Analysis':            'Explain the statistical tests or qualitative methods you will use to analyze your data.',
    'Key Findings':             'Present your main results clearly. Use data, tables, or quotes to support your findings.',
    'Interpretation':           'Explain what your findings mean in context. Connect back to your theoretical framework.',
    'Implications':             'Discuss practical and theoretical implications of your findings for the field.',
    'Summary':                  'Briefly restate the purpose, methods, and key findings of your study.',
    'Recommendations':          'Suggest future research directions and practical actions based on your findings.',
  };
  return hints[name] || `Write the "${name}" section of your research paper. The AI will help you find relevant sources and generate a structured paragraph.`;
}

const LAYER_CHECKLISTS = {
  'Background of the Study': ['Introduce the broad topic clearly','Explain why it matters at a global scale','Give 2–3 recent statistics or facts','Cite at least 2 academic sources','End with a transition toward the problem'],
  'Global Problem': ['State the problem with data/statistics','Reference global studies (2018–present)','Show scale: how many people/countries affected?','Cite at least 2 international sources'],
  'Local Problem': ['Narrow from global to local context','Use Philippine or regional statistics','Reference local studies or government reports','Show how the global problem exists locally'],
  'Research Gap': ['State what existing studies have NOT addressed','Use phrases like "however", "despite this", "limited studies"','Reference at least 1–2 studies that fall short','Connect the gap directly to your study'],
  'Purpose of the Study': ['Use action verbs: determine, explore, examine, assess','State the specific objectives (1–3 items)','Mention who benefits from this research','Keep it concise — 1 paragraph maximum'],
  'Theoretical Framework': ['Name the theory/model and its author','Explain the core idea in 2–3 sentences','Show how it relates to your research problem','Cite the original source of the theory'],
  'Related Studies (Global)': ['Group studies by theme, not by author','Compare and contrast different findings','Use synthesis: "Similarly…", "In contrast…"','Cite at least 3 international studies'],
  'Related Studies (Local)': ['Focus on Philippine or regional studies','Note similarities and gaps vs global studies','Use recent studies (within 10 years preferred)','At least 2–3 local sources required'],
  'Research Design': ['Name the design (descriptive, correlational, etc.)','Justify WHY this design fits your questions','Mention quantitative/qualitative/mixed','Reference a methodologist who defines this design'],
  'Participants & Sampling': ['State who your participants are (age, school, role)','Give the exact number or target sample size','Name the sampling technique (purposive, random, etc.)','Justify why this sampling method is appropriate'],
  'Data Collection': ['Name your instrument (survey, interview, test)','State who validated it (if applicable)','Describe the procedure step by step','Note any ethical considerations (consent, etc.)'],
  'Data Analysis': ['Name the statistical test(s) you will use','Match the test to your research design','If qualitative: state your analysis approach (thematic, etc.)','Mention the software used (SPSS, R, NVivo, etc.)'],
  'Key Findings': ['Present results in order of importance','Use specific numbers and percentages','Reference your data tables/figures if applicable','Answer each research objective directly'],
  'Interpretation': ['Explain what each finding MEANS','Connect findings back to your theoretical framework','Compare with previous studies (agree/disagree)','Use hedging language where appropriate'],
  'Implications': ['Practical: what should teachers/policymakers do?','Theoretical: how does this extend the literature?','Who are the specific beneficiaries?','Be concrete — avoid vague statements'],
  'Summary': ['Restate purpose in 1–2 sentences','Summarize methodology briefly','Highlight 2–3 key findings','Do NOT introduce new information here'],
  'Recommendations': ['Give specific, actionable recommendations','Target different stakeholders (teachers, admin, future researchers)','Suggest at least 1 area for future research','Connect each recommendation to a finding'],
};
function _layerChecklist(name) { return LAYER_CHECKLISTS[name] || ['Write clearly and formally','Cite your sources using (Author, Year)','Aim for 150–200 words','Stay focused on the section topic']; }

function _toggleTip() {
  const card = document.getElementById('layer-tip-card');
  const btn  = document.getElementById('layer-tip-toggle');
  if (!card) return;
  const show = card.style.display === 'none';
  card.style.display = show ? 'block' : 'none';
  if (btn) btn.textContent = show ? 'Hide tips' : 'Show tips';
}

const WORD_TARGETS = {
  'Background of the Study': 220, 'Global Problem': 180, 'Local Problem': 180,
  'Research Gap': 160, 'Purpose of the Study': 150, 'Theoretical Framework': 200,
  'Related Studies (Global)': 220, 'Related Studies (Local)': 200,
  'Research Design': 180, 'Participants & Sampling': 160, 'Data Collection': 160,
  'Data Analysis': 160, 'Key Findings': 220, 'Interpretation': 200,
  'Implications': 180, 'Summary': 150, 'Recommendations': 150,
};
function _wordTarget(name) { return WORD_TARGETS[name] || 180; }

function _buildLayerSteps(layerId, layerObj, ls) {
  const isDone   = ls.status === 'done';
  const isActive = ls.status === 'active' || ls.status === 'pending';
  const hasPara  = !!ls.paragraph;

  const sourcesHtml = ls.sources.length > 0
    ? ls.sources.map((s,i) => `
        <div class="paper-card selected" data-source-idx="${i}">
          <div class="paper-check"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#090900" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg></div>
          <div class="paper-meta">
            <div class="paper-title">${_esc(s.title)}</div>
            <div class="paper-authors">${_esc(s.authors)}</div>
            <div class="paper-journal">${_esc(s.journal)} <span class="paper-year">${s.year}</span></div>
          </div>
        </div>`).join('')
    : `<div style="font-size:12px;color:var(--text-4);padding:10px 0;">No sources attached yet — go to <strong style="color:var(--text-3);">Search Papers</strong> tab to find and attach sources to this layer.</div>`;

  // Single unified editor — always visible, AI content populates it, user can edit directly
  const editorLabel = isDone ? '✓ Accepted' : ls.isEdited ? '✎ Edited' : hasPara ? '✦ AI Generated' : '✏ Write here';
  const editorColor = isDone ? 'var(--teal)' : ls.isEdited ? 'var(--gold)' : hasPara ? 'var(--violet)' : 'var(--text-4)';
  const placeholder = ls.sources.length > 0
    ? `Start writing the "${layerObj.name}" section, or click Generate with AI below…`
    : `Start writing the "${layerObj.name}" section here…`;

  const paraHtml = `
    <div class="unified-editor" id="layer-para-${layerId}" style="border:1px solid var(--border-xs);border-radius:var(--r-sm);background:var(--surface-2);overflow:hidden;transition:border-color 0.2s;">
      <!-- Toolbar -->
      <div class="editor-toolbar" style="display:flex;align-items:center;gap:4px;padding:6px 10px;border-bottom:1px solid var(--border-xs);background:var(--surface-1);">
        <span style="font-size:9px;color:${editorColor};font-family:var(--font-mono);letter-spacing:0.04em;flex:1;">${editorLabel}</span>
        <span id="word-count-${layerId}" style="font-size:9px;color:var(--text-4);font-family:var(--font-mono);">${hasPara ? _wordCount(ls.paragraph) : 0} words</span>
        <span id="autosave-dot-${layerId}" style="font-size:9px;color:var(--text-4);font-family:var(--font-mono);opacity:0;transition:opacity 0.3s;margin-left:4px;">✓ saved</span>
        ${hasPara ? `<button onclick="_showHistory('${layerId}')" title="Version history" style="background:transparent;border:none;color:var(--text-4);cursor:pointer;padding:2px 5px;font-size:10px;font-family:var(--font-mono);border-radius:3px;transition:color 0.15s;" onmouseenter="this.style.color='var(--violet)'" onmouseleave="this.style.color='var(--text-4)'">⧖</button>` : ''}
        ${!isDone ? `
        <button onclick="_clearParagraph('${layerId}')" title="Clear" style="background:transparent;border:none;color:var(--text-4);cursor:pointer;padding:2px 4px;font-size:11px;line-height:1;border-radius:3px;" onmouseenter="this.style.color='var(--red)'" onmouseleave="this.style.color='var(--text-4)'">✕</button>
        ` : ''}
      </div>
      <!-- Editor body -->
      <div
        id="para-text-${layerId}"
        contenteditable="${isDone ? 'false' : 'true'}"
        spellcheck="true"
        data-placeholder="${placeholder}"
        style="min-height:120px;padding:14px 16px;font-size:13px;color:var(--text-1);line-height:1.9;outline:none;caret-color:var(--gold);white-space:pre-wrap;word-break:break-word;${isDone ? 'color:var(--text-2);' : ''}"
      >${hasPara ? ls.paragraph.replace(/<[^>]*>/g,' ').trim() : ''}</div>
      ${!isDone ? `
      <!-- Word count progress bar -->
      <div style="padding:4px 10px 0;background:var(--surface-1);">
        <div style="height:2px;background:var(--border-xs);border-radius:1px;overflow:hidden;">
          <div id="wc-bar-${layerId}" style="height:100%;width:0%;background:var(--gold);border-radius:1px;transition:width 0.4s;"></div>
        </div>
      </div>
      <!-- Bottom bar -->
      <div style="display:flex;align-items:center;gap:8px;padding:5px 10px 6px;border-top:none;background:var(--surface-1);">
        <span style="font-size:10px;color:var(--text-4);">⌘↵ accept · Tab indent</span>
        <div style="flex:1;"></div>
        ${hasPara ? `<button class="btn-sec-research" style="font-size:11px;padding:5px 12px;" onclick="_acceptLayer('${layerId}')">Accept & Continue →</button>` : ''}
      </div>` : `
      <div style="padding:6px 10px;border-top:1px solid var(--border-xs);background:var(--surface-1);display:flex;align-items:center;gap:8px;">
        <span style="font-size:10px;color:var(--teal);">✓ Accepted</span>
        <div style="flex:1;"></div>
        <button class="btn-sec-research" style="font-size:10px;padding:3px 10px;" onclick="_undoAccept('${layerId}')">↩ Undo</button>
      </div>`}
    </div>
    ${!hasPara && !isDone && ls.sources.length > 0 ? `
    <div style="margin-top:8px;padding:10px 14px;background:var(--gold-muted);border:1px solid var(--gold-border);border-radius:var(--r-sm);display:flex;align-items:center;gap:8px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <span style="font-size:11px;color:var(--gold);">${ls.sources.length} source${ls.sources.length > 1 ? 's' : ''} attached — generate or write manually above</span>
    </div>` : ''}`;

  return `
    <!-- Step 1: Sources -->
    <div class="layer-step ${isDone ? 'done-step' : 'active-step'}" id="step1-${layerId}">
      <div class="step-head">
        <div class="step-num">${isDone ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' : '1'}</div>
        <div class="step-label">Attach Academic Sources</div>
        <span class="step-badge ${isDone ? 'done' : ls.sources.length ? 'active' : 'pending'}">${ls.sources.length ? ls.sources.length + ' attached' : 'None yet'}</span>
      </div>
      <div class="step-body">
        <div class="paper-list" id="attached-sources-${layerId}">${sourcesHtml}</div>
        <div style="display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap;">
          <button class="btn-sec-research" style="font-size:11px;" onclick="switchResearchTab('search', document.querySelectorAll('.research-tab')[1])">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-right:4px;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            ${ls.sources.length ? 'Add More Sources' : 'Search for Sources'}
          </button>
          ${ls.sources.length > 0 && !isDone ? `
          <button onclick="document.getElementById('step2-${layerId}').classList.add('active-step');document.getElementById('btn-generate-${layerId}')?.scrollIntoView({behavior:'smooth',block:'nearest'})" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:var(--r-pill);background:var(--gold);border:none;color:#090900;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font-body);">
            Write Paragraph
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#090900" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>` : ''}
        </div>
      </div>
    </div>

    <!-- Step 2: Paragraph -->
    <div class="layer-step ${hasPara ? (isDone ? 'done-step' : 'active-step') : (ls.sources.length > 0 && !isDone ? 'active-step' : '')}" id="step2-${layerId}">
      <div class="step-head">
        <div class="step-num">${isDone && hasPara ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' : '2'}</div>
        <div class="step-label">Write Paragraph</div>
        <span class="step-badge ${hasPara ? (isDone ? 'done' : 'active') : 'pending'}">${hasPara ? (isDone ? 'Accepted' : 'Ready') : 'Pending'}</span>
      </div>
      <div class="step-body">
        ${paraHtml}
        ${!isDone ? `
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px;">
          ${hasPara ? `
          <!-- Instruction box — shown only when regenerating -->
          <div id="regen-box-${layerId}" style="display:none;flex-direction:column;gap:6px;padding:10px 12px;background:var(--surface-1);border:1px solid var(--border-xs);border-radius:var(--r-sm);">
            <div style="font-size:10px;color:var(--text-4);font-family:var(--font-mono);letter-spacing:0.04em;">INSTRUCTIONS FOR AI</div>
            <textarea
              id="regen-instruction-${layerId}"
              placeholder="e.g. Make it more formal, add more citations, focus on Philippine context, shorten to 150 words…"
              style="width:100%;min-height:60px;background:var(--surface-2);border:1px solid var(--border-xs);border-radius:var(--r-sm);padding:8px 10px;font-size:12px;color:var(--text-1);font-family:var(--font-body);resize:vertical;outline:none;line-height:1.6;transition:border-color 0.15s;box-sizing:border-box;"
              onfocus="this.style.borderColor='var(--gold-border)'"
              onblur="this.style.borderColor='var(--border-xs)'"
              onkeydown="if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();_generateParagraph('${layerId}')}"
            ></textarea>
            <div style="display:flex;gap:8px;align-items:center;">
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${['More formal','Shorter','Add more citations','More local context','Expand with examples'].map(s =>
                  `<span onclick="document.getElementById('regen-instruction-${layerId}').value='${s}'" style="font-size:10px;padding:2px 8px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-xs);color:var(--text-3);cursor:pointer;font-family:var(--font-body);">${s}</span>`
                ).join('')}
              </div>
              <div style="flex:1;"></div>
              <button onclick="document.getElementById('regen-box-${layerId}').style.display='none'" style="font-size:10px;background:transparent;border:none;color:var(--text-4);cursor:pointer;font-family:var(--font-body);">Cancel</button>
              <button class="btn-primary-research" id="btn-generate-${layerId}" onclick="_generateParagraph('${layerId}')" style="font-size:11px;padding:6px 14px;">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" style="margin-right:4px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Regenerate
              </button>
            </div>
          </div>
          <!-- Collapsed trigger when paragraph exists -->
          <div id="regen-trigger-${layerId}" class="layer-actions">
            <button class="btn-sec-research" style="font-size:11px;" onclick="
              document.getElementById('regen-box-${layerId}').style.display='flex';
              document.getElementById('regen-trigger-${layerId}').style.display='none';
              document.getElementById('regen-instruction-${layerId}').focus();">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="margin-right:4px;"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
              Regenerate with Instructions
            </button>
          </div>` : `
          <!-- First generation -->
          <div class="layer-actions">
            <button class="btn-primary-research" id="btn-generate-${layerId}" onclick="_generateParagraph('${layerId}')">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Generate with AI
            </button>
          </div>`}
        </div>` : ''}

      </div>
    </div>

    <!-- Step 3: Review -->
    <div class="layer-step ${isDone ? 'done-step' : ''}" id="step3-${layerId}">
      <div class="step-head">
        <div class="step-num">${isDone ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>' : '3'}</div>
        <div class="step-label">Review & Accept</div>
        <span class="step-badge ${isDone ? 'done' : 'pending'}">${isDone ? 'Complete' : 'Pending'}</span>
      </div>
    </div>`;
}

function _bindLayerStepActions(layerId) {
  const paraEl   = document.getElementById(`para-text-${layerId}`);
  const editorEl = document.getElementById(`layer-para-${layerId}`);
  const layerObj = RS.outline.flatMap(s => s.layers).find(l => l.id === layerId);
  if (layerObj) _layer(layerId).name = layerObj.name; // cache for word target

  if (paraEl && !paraEl.getAttribute('data-bound')) {
    paraEl.setAttribute('data-bound', '1');

    let saveTimer;
    let lastSaved = '';

    // ── Live word count on every keystroke ──
    paraEl.addEventListener('input', () => {
      const text = paraEl.innerText || '';
      const wc     = _wordCount(text);
      const target = _wordTarget(_layer(layerId).name || '');
      const wcEl   = document.getElementById(`word-count-${layerId}`);
      const barEl  = document.getElementById(`wc-bar-${layerId}`);
      if (wcEl) {
        wcEl.textContent = wc + ' words';
        wcEl.style.color = wc >= target ? 'var(--teal)' : 'var(--text-4)';
      }
      if (barEl) {
        const pct = Math.min(100, Math.round(wc / target * 100));
        barEl.style.width = pct + '%';
        barEl.style.background = wc >= target ? 'var(--teal)' : 'var(--gold)';
      }

      // Show "saving…" dot
      const dot = document.getElementById(`autosave-dot-${layerId}`);
      if (dot) { dot.textContent = '…'; dot.style.opacity = '1'; dot.style.color = 'var(--text-4)'; }

      // Debounced autosave — 800ms after last keystroke
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const newText = paraEl.innerText.trim();
        if (newText === lastSaved) return;  // no change
        lastSaved = newText;
        const ls = _layer(layerId);
        ls.paragraph = newText;
        ls.isEdited  = (ls.paragraph !== '');
        _save();
        _updateStats();
        _renderFullPaper();

        // Flash "✓ saved"
        if (dot) {
          dot.textContent = '✓ saved';
          dot.style.color  = 'var(--teal)';
          dot.style.opacity = '1';
          setTimeout(() => { dot.style.opacity = '0'; }, 1800);
        }

        // Show Accept button in toolbar if has content
        const acceptBtn = editorEl?.querySelector('.accept-inline-btn');
        if (acceptBtn) acceptBtn.style.display = newText ? 'inline-flex' : 'none';

        // Update label
        const label = editorEl?.querySelector('.editor-label');
        if (label && newText) { label.textContent = '✎ Edited'; label.style.color = 'var(--gold)'; }

      }, 800);
    });

    // ── Focus: highlight editor border ──
    paraEl.addEventListener('focus', () => {
      if (editorEl) editorEl.style.borderColor = 'var(--gold-border)';
    });
    paraEl.addEventListener('blur', () => {
      if (editorEl) editorEl.style.borderColor = 'var(--border-xs)';
    });

    // ── Tab key: insert 4 spaces instead of moving focus ──
    paraEl.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        document.execCommand('insertText', false, '    ');
      }
      // Ctrl/Cmd + Enter = Accept
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const ls = _layer(layerId);
        if (ls.paragraph) _acceptLayer(layerId);
      }
    });

    // Seed lastSaved with existing content
    lastSaved = (paraEl.innerText || '').trim();

    // Init word count bar
    if (lastSaved) {
      const wc     = _wordCount(lastSaved);
      const target = _wordTarget(layerObj?.name || '');
      const wcEl2  = document.getElementById(`word-count-${layerId}`);
      const barEl2 = document.getElementById(`wc-bar-${layerId}`);
      if (wcEl2) { wcEl2.textContent = wc + ' words'; wcEl2.style.color = wc >= target ? 'var(--teal)' : 'var(--text-4)'; }
      if (barEl2) { barEl2.style.width = Math.min(100, Math.round(wc / target * 100)) + '%'; barEl2.style.background = wc >= target ? 'var(--teal)' : 'var(--gold)'; }
    }
  }

  // ── Source removal from step 1 chips ──
  document.querySelectorAll(`#attached-sources-${layerId} .paper-card`).forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.sourceIdx);
      _layer(layerId).sources.splice(idx, 1);
      _save();
      _renderLayerEditor(layerId);
      _renderSourcesPanel();
      _updateStats();
    });
  });
}

/* ── Generate paragraph (placeholder until backend) ── */
function _generateParagraph(layerId) {
  const ls  = _layer(layerId);
  const btn = document.getElementById(`btn-generate-${layerId}`);
  if (!btn) return;

  // ── Button loading state ──
  btn.disabled = true;
  btn.innerHTML = `<span style="display:inline-flex;gap:3px;align-items:center;">
    <span style="width:4px;height:4px;border-radius:50%;background:#090900;animation:blink 1s ease-in-out infinite;"></span>
    <span style="width:4px;height:4px;border-radius:50%;background:#090900;animation:blink 1s ease-in-out 0.2s infinite;"></span>
    <span style="width:4px;height:4px;border-radius:50%;background:#090900;animation:blink 1s ease-in-out 0.4s infinite;"></span>
  </span> Writing…`;

  const allLayers  = RS.outline.flatMap(s => s.layers);
  const layerObj   = allLayers.find(l => l.id === layerId);
  const sectionObj = RS.outline.find(s => s.layers.some(l => l.id === layerId));

  // Previous accepted paragraphs for context
  const prevLayers = allLayers
    .filter(l => l.id !== layerId && _layer(l.id).status === 'done' && _layer(l.id).paragraph)
    .slice(-3)
    .map(l => ({ name: l.name, paragraph: _layer(l.id).paragraph.replace(/<[^>]*>/g,' ').trim() }));

  // Read instruction if the regen box is open
  const instrEl  = document.getElementById(`regen-instruction-${layerId}`);
  const instruction = instrEl?.value?.trim() || '';

  const payload = {
    title:       RS.title,
    problem:     RS.problem,
    field:       RS.field,
    type:        RS.type,
    section:     sectionObj?.title || '',
    layerName:   layerObj?.name || layerId,
    sources:     ls.sources,
    prevLayers,
    instruction  // injected into the prompt when set
  };

  // Save current paragraph to history before overwriting
  if (ls.paragraph) _pushHistory(layerId, ls.paragraph);

  // ── Inject streaming container into the step body immediately ──
  ls.paragraph = '';
  ls.isEdited  = false;
  _renderLayerEditor(layerId);   // renders the empty box

  // After re-render, grab the live paragraph element
  const paraEl   = document.getElementById(`para-text-${layerId}`);
  const wcEl     = document.getElementById(`word-count-${layerId}`);
  const btnAfter = document.getElementById(`btn-generate-${layerId}`);
  if (btnAfter) {
    btnAfter.disabled = true;
    btnAfter.innerHTML = `<span style="display:inline-flex;gap:3px;align-items:center;">
      <span style="width:4px;height:4px;border-radius:50%;background:#090900;animation:blink 1s ease-in-out infinite;"></span>
      <span style="width:4px;height:4px;border-radius:50%;background:#090900;animation:blink 1s ease-in-out 0.2s infinite;"></span>
      <span style="width:4px;height:4px;border-radius:50%;background:#090900;animation:blink 1s ease-in-out 0.4s infinite;"></span>
    </span> Writing…`;
  }

  // Add blinking cursor
  let streamedText = '';
  if (paraEl) {
    paraEl.contentEditable = 'false';
    paraEl.textContent = '';
    paraEl.appendChild(Object.assign(document.createElement('span'), {className:'stream-cursor', textContent:'▋'}));
  }

  // ── SSE stream ──
  // Use async auth header to ensure logged-in token is always fresh
  Promise.resolve(
    typeof window._getAuthHeader === 'function' ? window._getAuthHeader() : _getAuthHeader()
  ).then(_streamAuthHdr => fetch(API_BASE + '/api/stream-layer', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', ..._streamAuthHdr },
    body:    JSON.stringify(payload)
  }))
  .then(resp => {
    if (!resp.ok) throw new Error(`Stream error ${resp.status}`);
    const reader  = resp.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    function pump() {
      return reader.read().then(({ done, value }) => {
        if (done) { _onStreamDone(layerId, streamedText); return; }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();   // keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('event: done')) {
            _onStreamDone(layerId, streamedText);
            reader.cancel();
            return;
          }
          if (line.startsWith('event: error')) continue;
          if (!line.startsWith('data: ')) continue;

          try {
            const obj   = JSON.parse(line.slice(6));
            const token = obj.token || '';
            if (!token) continue;
            streamedText += token;

            // Live update the paragraph box
            if (paraEl) {
              // Update plain text — unified editor uses innerText not innerHTML
              paraEl.textContent = streamedText;
              paraEl.appendChild(Object.assign(document.createElement('span'), {className:'stream-cursor', textContent:'▋'}));
              paraEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              // Live word count
              const wcEl = document.getElementById(`word-count-${layerId}`);
              if (wcEl) wcEl.textContent = _wordCount(streamedText) + ' words';
            }
            if (wcEl) wcEl.textContent = _wordCount(streamedText) + ' words';
          } catch(_) {}
        }

        return pump();
      });
    }

    return pump();
  })
  .catch(err => {
    console.error('Stream failed, falling back to /ask:', err);
    _generateParagraphFallback(layerId, payload);
  });
}

function _onStreamDone(layerId, text) {
  const ls = _layer(layerId);
  ls.paragraph = text.trim();
  ls.isEdited  = false;
  _save();
  _renderLayerEditor(layerId);
  _renderSourcesPanel();
  _updateStats();
  _showToast('✦', 'Paragraph written!', 'var(--violet)');
  // Clear instruction field after successful generation
  const instrEl = document.getElementById(`regen-instruction-${layerId}`);
  if (instrEl) instrEl.value = '';
}

// Fallback for when /api/stream-layer isn't deployed yet — uses /ask
async function _generateParagraphFallback(layerId, payload) {
  const allLayers  = RS.outline.flatMap(s => s.layers);
  const layerObj   = allLayers.find(l => l.id === layerId);
  const sectionObj = RS.outline.find(s => s.layers.some(l => l.id === layerId));
  const ls         = _layer(layerId);

  const sourceContext = ls.sources.length
    ? ls.sources.map((s,i) => `[${i+1}] ${s.title} — ${s.authors} (${s.year}), ${s.journal}`).join('\n')
    : '';

  const prevParagraphs = (payload.prevLayers || [])
    .map(p => `[${p.name}]:\n${p.paragraph}`).join('\n\n');

  const instrNote = payload.instruction
    ? `\n\nSPECIAL INSTRUCTION: ${payload.instruction}`
    : '';

  const prompt = `Write exactly ONE academic paragraph (150–250 words) for the "${layerObj?.name}" sub-section of Section ${sectionObj?.title || ''}.

Research title: "${RS.title}"
${RS.problem ? 'Research problem: ' + RS.problem : ''}
${RS.field   ? 'Field: '            + RS.field   : ''}
Paper type: ${RS.type}

${sourceContext ? 'Sources — cite as (Author, Year):\n' + sourceContext : 'No sources — write from general knowledge.'}
${prevParagraphs ? '\nPrevious sections (maintain continuity, do not repeat):\n' + prevParagraphs : ''}${instrNote}

Output the paragraph text only. No heading, no label, no preamble.`;

  try {
    const resp = await _researchFetchWithRetry({ question: prompt, mode: 'study', task_type: 'research', ...(() => { const p = _aiParams(7); return { complexity: p.complexity, language: p.language, safe_content: p.safe_content }; })(), bookId: 'none', history: [] });
    const data = await resp.json();
    if (_handleGuestLimited(data)) return;
    if (!data.success) throw new Error(data.error);
    let para = (data.answer || '').trim().replace(/^#{1,3}[^\n]*\n/gm,'').trim();
    ls.paragraph = para;
    ls.isEdited  = false;
    _save();
    _renderLayerEditor(layerId);
    _updateStats();
    _showToast('✦', 'Paragraph written!', 'var(--violet)');
  } catch(err) {
    const paraEl = document.getElementById(`para-text-${layerId}`);
    if (paraEl) paraEl.innerHTML = `<em style="color:var(--red);">⚠ ${_esc(err.message)}</em>`;
    const btnEl = document.getElementById(`btn-generate-${layerId}`);
    if (btnEl) { btnEl.disabled = false; btnEl.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Retry'; }
  }
}


/* ── Accept layer ── */
function _acceptLayer(layerId) {
  const ls = _layer(layerId);
  if (!ls.paragraph) return;
  ls.status = 'done';

  const allLayers   = RS.outline.flatMap(s => s.layers);
  const idx         = allLayers.findIndex(l => l.id === layerId);
  const acceptedName = allLayers[idx]?.name || 'Layer';
  const doneSoFar   = allLayers.filter(l => _layer(l.id).status === 'done').length;
  const total       = allLayers.length;

  // Find next pending layer
  let nextLayerId = null;
  let nextLayerName = null;
  let crossedSection = false;
  const currentSec = RS.outline.find(s => s.layers.some(l => l.id === layerId));

  for (let i = idx + 1; i < allLayers.length; i++) {
    if (_layer(allLayers[i].id).status !== 'done') {
      _layer(allLayers[i].id).status = 'active';
      nextLayerId   = allLayers[i].id;
      nextLayerName = allLayers[i].name;
      const nextSec = RS.outline.find(s => s.layers.some(l => l.id === nextLayerId));
      if (nextSec) {
        nextSec.open  = true;
        crossedSection = nextSec !== currentSec;
      }
      RS.activeLayerId = nextLayerId;
      break;
    }
  }

  _save();
  _renderOutline();
  _renderSourcesPanel();
  _renderReferences();
  _updateStats();
  _renderFullPaper();

  // ── Animated transition ──
  const editorEl = document.getElementById('layer-steps-container');
  if (editorEl) {
    // Flash green on the completed step
    editorEl.style.transition = 'opacity 0.2s ease';
    editorEl.style.opacity    = '0';
    setTimeout(() => {
      _renderLayerEditor(RS.activeLayerId);
      editorEl.style.opacity = '1';

      // Scroll the new layer into view in the outline
      const newLayerEl = document.querySelector(`[data-lid="${RS.activeLayerId}"]`);
      if (newLayerEl) {
        newLayerEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        // Pulse the newly active layer in the outline
        newLayerEl.style.transition = 'background 0.4s ease';
        newLayerEl.style.background = 'var(--gold-muted)';
        setTimeout(() => newLayerEl.style.background = '', 800);
      }
      // Update layer title + breadcrumb in header
      const newLayer = RS.outline.flatMap(s => s.layers).find(l => l.id === RS.activeLayerId);
      const newSec   = RS.outline.find(s => s.layers.some(l => l.id === RS.activeLayerId));
      const titleEl  = document.getElementById('layer-editor-title');
      const bcEl     = document.getElementById('layer-breadcrumb');
      if (titleEl && newLayer) titleEl.textContent = newLayer.name;
      if (bcEl && newSec)      bcEl.textContent    = newSec.title + ' › ' + (newLayer?.name || '');
    }, 200);
  } else {
    _renderLayerEditor(RS.activeLayerId);
  }

  // ── Contextual toast ──
  if (!nextLayerId) {
    // All layers done — paper complete!
    _showMilestone('🎉', 'Paper Complete!', 'All layers accepted. Your research paper is ready.');
  } else if (doneSoFar === total - 1 && nextLayerId) {
    _showMilestone('✦', 'Almost there!', `Just ${total - doneSoFar} layer left — "${nextLayerName}"`);
  } else if (crossedSection) {
    const nextSec = RS.outline.find(s => s.layers.some(l => l.id === nextLayerId));
    _showToast('▶', `Moving to ${nextSec?.title || 'next section'}`, 'var(--violet)');
  } else {
    _showToast('✓', `"${acceptedName}" done — next: "${nextLayerName}"`, 'var(--teal)');
  }
}

function _showMilestone(icon, title, message) {
  // Full-screen milestone overlay — dismisses automatically after 3.5s or on click
  let el = document.getElementById('milestone-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'milestone-overlay';
    el.style.cssText = `
      position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
      background:rgba(9,9,0,0.75);backdrop-filter:blur(6px);will-change:transform;z-index:9999;
      opacity:0;transition:opacity 0.3s ease;cursor:pointer;`;
    el.innerHTML = `
      <div style="text-align:center;padding:40px 56px;background:var(--surface-2);border:1px solid var(--border-md);border-radius:var(--r-lg);max-width:400px;">
        <div id="ms-icon" style="font-size:40px;margin-bottom:12px;"></div>
        <div id="ms-title" style="font-family:var(--font-head);font-size:22px;font-weight:800;color:var(--text-1);margin-bottom:8px;"></div>
        <div id="ms-msg" style="font-size:13px;color:var(--text-3);line-height:1.6;"></div>
        <div style="margin-top:20px;font-size:11px;color:var(--text-4);">click anywhere to continue</div>
      </div>`;
    el.addEventListener('click', () => _dismissMilestone());
    document.body.appendChild(el);
  }
  document.getElementById('ms-icon').textContent  = icon;
  document.getElementById('ms-title').textContent = title;
  document.getElementById('ms-msg').textContent   = message;
  requestAnimationFrame(() => el.style.opacity = '1');
  clearTimeout(el._timer);
  el._timer = setTimeout(_dismissMilestone, 3500);
}

function _dismissMilestone() {
  const el = document.getElementById('milestone-overlay');
  if (!el) return;
  el.style.opacity = '0';
  setTimeout(() => el.remove(), 300);
}

/* ── Undo accept ── */
function _undoAccept(layerId) {
  _layer(layerId).status = 'active';
  RS.activeLayerId = layerId;
  _save();
  _renderOutline();
  _renderLayerEditor(layerId);
  _updateStats();
}

/* ── Clear paragraph ── */
function _clearParagraph(layerId) {
  const ls = _layer(layerId);
  if (ls.paragraph) _pushHistory(layerId, ls.paragraph);
  ls.paragraph = '';
  ls.isEdited  = false;
  _save();
  _renderLayerEditor(layerId);
  _updateStats();
}

/* ══════════════════════════════════════════════════════════════
   SOURCES PANEL
══════════════════════════════════════════════════════════════ */
function _updateSourcesBanner() {
  const banner   = document.getElementById('sources-ready-banner');
  const label    = document.getElementById('sources-ready-label');
  if (!banner) return;
  const count = (_layer(RS.activeLayerId).sources || []).length;
  if (count > 0) {
    banner.style.display = 'block';
    label.textContent = `${count} source${count > 1 ? 's' : ''} attached to this layer — ready to write`;
  } else {
    banner.style.display = 'none';
  }
}

function _switchCitTab(tab) {
  const srcPanel = document.getElementById('cit-panel-sources');
  const refPanel = document.getElementById('cit-panel-refs');
  const srcBtn   = document.getElementById('cit-tab-sources');
  const refBtn   = document.getElementById('cit-tab-refs');
  if (!srcPanel) return;
  if (tab === 'sources') {
    srcPanel.style.display = 'block';
    refPanel.style.display = 'none';
    srcBtn.style.borderBottomColor = 'var(--gold)';
    srcBtn.style.color = 'var(--text-1)';
    refBtn.style.borderBottomColor = 'transparent';
    refBtn.style.color = 'var(--text-3)';
  } else {
    srcPanel.style.display = 'none';
    refPanel.style.display = 'block';
    srcBtn.style.borderBottomColor = 'transparent';
    srcBtn.style.color = 'var(--text-3)';
    refBtn.style.borderBottomColor = 'var(--gold)';
    refBtn.style.color = 'var(--text-1)';
    _renderReferences();
  }
}

function _allUniqueSources() {
  // Returns [{title, authors, journal, year, usedInLayers:[...]}] deduped across all layers
  const map = new Map();
  RS.outline.flatMap(s => s.layers).forEach(layer => {
    _layer(layer.id).sources.forEach(s => {
      if (!map.has(s.title)) {
        map.set(s.title, { ...s, usedIn: [] });
      }
      map.get(s.title).usedIn.push(layer.name);
    });
  });
  return [...map.values()];
}

function _citKey(source) {
  // Produce (Author, Year) citation key from a source object
  const firstAuthor = (source.authors || '').split(',')[0].trim().split(' ').pop();
  return `(${firstAuthor}, ${source.year})`;
}

function _renderSourcesPanel() {
  const panel = document.getElementById('cit-panel-sources');
  if (!panel) return;
  panel.innerHTML = '';

  const currentLayerId = RS.activeLayerId;
  const currentSources = _layer(currentLayerId).sources;
  const allLayers      = RS.outline.flatMap(s => s.layers);

  // Prev-layer sources (done layers only)
  const prevSources = [];
  allLayers.forEach(l => {
    if (l.id !== currentLayerId && _layer(l.id).status === 'done') {
      _layer(l.id).sources.forEach(s => prevSources.push({ ...s, fromLayer: l.name }));
    }
  });

  const totalUnique = _allUniqueSources().length;
  const badge = document.getElementById('sources-count-badge');
  if (badge) badge.textContent = totalUnique;

  if (!currentSources.length && !prevSources.length) {
    panel.innerHTML = `
      <div style="padding:24px 8px;text-align:center;color:var(--text-4);font-size:12px;line-height:1.8;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.2" style="display:block;margin:0 auto 10px;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        No sources yet.<br>Search for papers and attach them to this layer.
      </div>`;
    return;
  }

  if (currentSources.length) {
    panel.innerHTML += `<div style="font-size:10px;color:var(--gold);font-family:var(--font-mono);letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px;display:flex;align-items:center;gap:6px;"><span style="width:5px;height:5px;border-radius:50%;background:var(--gold);display:inline-block;"></span>This Layer · ${currentSources.length}</div>`;
    currentSources.forEach((s, i) => {
      const key = _citKey(s);
      const chip = document.createElement('div');
      chip.className = 'source-chip';
      chip.style.cssText += 'cursor:pointer;';
      chip.innerHTML = `
        <div class="source-chip-num">${i + 1}</div>
        <div class="source-chip-text" style="flex:1;min-width:0;">
          <div class="source-chip-title">${_esc(s.title)}</div>
          <div class="source-chip-meta" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span>${_esc(s.authors.split(',')[0])} · ${s.year}</span>
            <span class="cite-tag" style="font-size:9px;">${_esc(key)}</span>
          </div>
        </div>
        <button title="Remove source" style="flex-shrink:0;background:transparent;border:none;color:var(--text-4);cursor:pointer;padding:2px 4px;font-size:12px;line-height:1;" data-remove="${i}">✕</button>`;
      chip.querySelector('[data-remove]').addEventListener('click', (e) => {
        e.stopPropagation();
        _layer(currentLayerId).sources.splice(i, 1);
        _save(); _renderSourcesPanel(); _renderLayerEditor(currentLayerId); _updateStats();
      });
      // Click chip = show detail popover
      chip.addEventListener('click', () => _showSourceDetail(s));
      panel.appendChild(chip);
    });
  }

  if (prevSources.length) {
    const div = document.createElement('div');
    div.style.cssText = 'font-size:10px;color:var(--teal);font-family:var(--font-mono);letter-spacing:0.06em;text-transform:uppercase;margin:14px 0 8px;display:flex;align-items:center;gap:6px;';
    div.innerHTML = `<span style="width:5px;height:5px;border-radius:50%;background:var(--teal);display:inline-block;"></span>Previous Layers · ${prevSources.length}`;
    panel.appendChild(div);
    prevSources.forEach((s, i) => {
      const chip = document.createElement('div');
      chip.className = 'source-chip';
      chip.style.cursor = 'pointer';
      chip.innerHTML = `
        <div class="source-chip-num" style="background:rgba(45,212,191,0.1);border-color:rgba(45,212,191,0.3);color:var(--teal);">${currentSources.length + i + 1}</div>
        <div class="source-chip-text">
          <div class="source-chip-title">${_esc(s.title)}</div>
          <div class="source-chip-meta">${_esc(s.authors.split(',')[0])} · ${s.year} · <em>${_esc(s.fromLayer)}</em></div>
        </div>`;
      chip.addEventListener('click', () => _showSourceDetail(s));
      panel.appendChild(chip);
    });
  }

  // "View References →" footer link
  if (totalUnique > 0) {
    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top:14px;padding-top:10px;border-top:1px solid var(--border-xs);text-align:center;';
    footer.innerHTML = `<button onclick="_switchCitTab('refs')" style="background:transparent;border:none;color:var(--text-4);font-size:11px;cursor:pointer;font-family:var(--font-body);">View full reference list →</button>`;
    panel.appendChild(footer);
  }
}

function _showSourceDetail(s) {
  // Small tooltip/popover with full source info
  let el = document.getElementById('source-detail-popover');
  if (!el) {
    el = document.createElement('div');
    el.id = 'source-detail-popover';
    el.style.cssText = `position:fixed;z-index:9995;max-width:320px;background:var(--surface-3);
      border:1px solid var(--border-md);border-radius:var(--r-sm);padding:14px 16px;
      font-family:var(--font-body);font-size:12px;color:var(--text-2);
      box-shadow:0 8px 32px rgba(0,0,0,0.5);line-height:1.6;
      opacity:0;transform:translateY(4px);transition:opacity 0.15s,transform 0.15s;`;
    document.body.appendChild(el);
    document.addEventListener('click', (e) => {
      if (!el.contains(e.target)) _hideSourceDetail();
    });
  }
  const key = _citKey(s);
  el.innerHTML = `
    <div style="font-weight:700;color:var(--text-1);margin-bottom:6px;line-height:1.4;">${_esc(s.title)}</div>
    <div style="color:var(--text-3);font-size:11px;margin-bottom:4px;">${_esc(s.authors)}</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--teal);">${_esc(s.journal || '')}</span>
      <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-4);">${s.year}</span>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <span class="cite-tag" style="font-size:10px;padding:2px 7px;cursor:text;user-select:all;" title="Click to select">${_esc(key)}</span>
      <button onclick="_copyCiteKey('${key.replace(/'/g,"\'")}',this)" style="background:var(--surface-2);border:1px solid var(--border-xs);color:var(--text-3);font-size:10px;padding:2px 8px;border-radius:var(--r-pill);cursor:pointer;font-family:var(--font-body);">Copy</button>
    </div>`;

  // Position near cursor / right panel
  const panel = document.querySelector('.research-side');
  const rect  = panel ? panel.getBoundingClientRect() : { left: window.innerWidth - 340, top: 100 };
  el.style.left = (rect.left - 330) + 'px';
  el.style.top  = Math.min(rect.top + 60, window.innerHeight - 200) + 'px';
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
}

function _hideSourceDetail() {
  const el = document.getElementById('source-detail-popover');
  if (!el) return;
  el.style.opacity = '0';
  el.style.transform = 'translateY(4px)';
}

function _copyCiteKey(key, btn) {
  navigator.clipboard.writeText(key).then(() => {
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.style.color = 'var(--teal)';
    setTimeout(() => { btn.textContent = orig; btn.style.color = ''; }, 1500);
  }).catch(() => {
    btn.textContent = 'Failed';
    setTimeout(() => btn.textContent = 'Copy', 1500);
  });
}

function _renderReferences() {
  const panel = document.getElementById('cit-panel-refs');
  if (!panel) return;

  const sources = _allUniqueSources();
  if (!sources.length) {
    panel.innerHTML = `<div style="padding:24px 8px;text-align:center;color:var(--text-4);font-size:12px;line-height:1.8;">No sources attached yet.<br>Attach papers to your layers to build the reference list.</div>`;
    return;
  }

  // Sort: alphabetical by first author last name
  sources.sort((a, b) => {
    const la = (a.authors || '').split(',')[0].trim().split(' ').pop().toLowerCase();
    const lb = (b.authors || '').split(',')[0].trim().split(' ').pop().toLowerCase();
    return la.localeCompare(lb);
  });

  let html = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
      <div style="font-size:10px;color:var(--text-4);font-family:var(--font-mono);letter-spacing:0.06em;text-transform:uppercase;">${sources.length} source${sources.length !== 1 ? 's' : ''}</div>
      <button onclick="_copyAllRefs()" style="font-size:10px;padding:3px 10px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-xs);color:var(--text-3);cursor:pointer;font-family:var(--font-body);">Copy All</button>
    </div>`;

  sources.forEach((s, i) => {
    const key = _citKey(s);
    // APA-style: Authors (Year). Title. Journal.
    const apa = `${s.authors} (${s.year}). ${s.title}. ${s.journal ? s.journal + '.' : ''}`;
    html += `
      <div style="margin-bottom:12px;padding:10px 12px;background:var(--surface-2);border-radius:var(--r-sm);border:1px solid var(--border-xs);">
        <div style="display:flex;align-items:flex-start;gap:8px;">
          <span style="font-family:var(--font-mono);font-size:10px;color:var(--text-4);flex-shrink:0;margin-top:1px;">[${i+1}]</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:11px;color:var(--text-2);line-height:1.6;">${_esc(apa)}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap;">
              <span class="cite-tag" style="font-size:9px;">${_esc(key)}</span>
              <button onclick="_copyCiteKey('${key.replace(/'/g,"\'")}',this)" style="background:transparent;border:none;color:var(--text-4);font-size:10px;cursor:pointer;font-family:var(--font-body);text-decoration:underline;">copy key</button>
              ${s.usedIn?.length ? `<span style="font-size:9px;color:var(--text-4);">Used in: ${s.usedIn.map(n => _esc(n)).join(', ')}</span>` : ''}
            </div>
          </div>
        </div>
      </div>`;
  });

  panel.innerHTML = sanitize(html);
}

function _copyAllRefs() {
  const sources = _allUniqueSources();
  sources.sort((a, b) => {
    const la = (a.authors || '').split(',')[0].trim().split(' ').pop().toLowerCase();
    const lb = (b.authors || '').split(',')[0].trim().split(' ').pop().toLowerCase();
    return la.localeCompare(lb);
  });
  const text = sources.map((s, i) =>
    `[${i+1}] ${s.authors} (${s.year}). ${s.title}. ${s.journal || ''}.`
  ).join('\n\n');
  navigator.clipboard.writeText(text).then(() => {
    _showToast('📋', 'References copied to clipboard', 'var(--teal)');
  });
}


/* ══════════════════════════════════════════════════════════════
   PARAGRAPH HISTORY
══════════════════════════════════════════════════════════════ */
function _pushHistory(layerId, text) {
  const ls = _layer(layerId);
  if (!ls.history) ls.history = [];
  // Don't duplicate the most recent entry
  if (ls.history.length && ls.history[ls.history.length - 1].text === text) return;
  ls.history.push({ text, ts: Date.now() });
  if (ls.history.length > 10) ls.history.shift(); // keep last 10
  _save();
}

function _showHistory(layerId) {
  const ls = _layer(layerId);
  const versions = (ls.history || []).slice().reverse(); // newest first
  if (!versions.length) {
    _showToast('○', 'No previous versions yet', 'var(--text-4)');
    return;
  }

  // Build modal
  let modal = document.getElementById('history-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'history-modal';
    modal.style.cssText = `position:fixed;inset:0;z-index:9997;display:flex;align-items:center;justify-content:center;`;
    modal.innerHTML = `
      <div onclick="if(event.target===this)_closeHistory()" style="position:absolute;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);will-change:transform;"></div>
      <div style="position:relative;z-index:1;width:min(560px,90vw);max-height:75vh;background:var(--surface-2);border:1px solid var(--border-md);border-radius:var(--r-md);display:flex;flex-direction:column;overflow:hidden;">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border-xs);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
          <div style="font-family:var(--font-head);font-size:14px;font-weight:700;color:var(--text-1);">Version History</div>
          <button onclick="_closeHistory()" style="background:transparent;border:none;color:var(--text-4);cursor:pointer;font-size:16px;line-height:1;">✕</button>
        </div>
        <div id="history-list" style="flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px;"></div>
      </div>`;
    document.body.appendChild(modal);
  }

  const list = document.getElementById('history-list');
  list.innerHTML = versions.map((v, i) => {
    const d    = new Date(v.ts);
    const time = d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const date = d.toLocaleDateString([], {month:'short', day:'numeric'});
    const wc   = _wordCount(v.text);
    const preview = v.text.slice(0, 160) + (v.text.length > 160 ? '…' : '');
    return `
      <div style="background:var(--surface-1);border:1px solid var(--border-xs);border-radius:var(--r-sm);padding:12px 14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div style="font-family:var(--font-mono);font-size:10px;color:var(--text-4);">Version ${versions.length - i} · ${date} ${time} · ${wc} words</div>
          <button onclick="_restoreVersion('${layerId}',${versions.length - 1 - i})" style="font-size:10px;padding:2px 10px;border-radius:var(--r-pill);background:var(--gold-muted);border:1px solid var(--gold-border);color:var(--gold);cursor:pointer;font-family:var(--font-body);">Restore</button>
        </div>
        <div style="font-size:11px;color:var(--text-3);line-height:1.6;">${_esc(preview)}</div>
      </div>`;
  }).join('');

  modal.style.display = 'flex';
}

function _closeHistory() {
  const m = document.getElementById('history-modal');
  if (m) m.style.display = 'none';
}

function _restoreVersion(layerId, historyIdx) {
  const ls = _layer(layerId);
  const v  = ls.history[historyIdx];
  if (!v) return;
  // Save current as new history entry before restoring
  if (ls.paragraph) _pushHistory(layerId, ls.paragraph);
  ls.paragraph = v.text;
  ls.isEdited  = true;
  _save();
  _renderLayerEditor(layerId);
  _updateStats();
  _closeHistory();
  _showToast('↩', 'Version restored', 'var(--teal)');
}

/* ══════════════════════════════════════════════════════════════
   STATS
══════════════════════════════════════════════════════════════ */
function _updateStats() {
  const allLayers   = RS.outline.flatMap(s => s.layers);
  const total       = allLayers.length;
  const done        = allLayers.filter(l => _layer(l.id).status === 'done').length;
  const pct         = Math.round((done / total) * 100);

  // Unique sources across all layers
  const allSourceTitles = new Set();
  allLayers.forEach(l => _layer(l.id).sources.forEach(s => allSourceTitles.add(s.title)));

  // Total words across all paragraphs
  let words = 0;
  allLayers.forEach(l => { if (_layer(l.id).paragraph) words += _wordCount(_layer(l.id).paragraph); });

  // Update DOM
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('stat-sources', allSourceTitles.size);
  set('stat-layers',  done);
  set('stat-words',   words.toLocaleString());
  set('stat-pct',     pct + '%');
  set('research-progress-label', `${done} of ${total} layers complete`);
  set('outline-done-counter',    `${done} / ${total} done`);
  set('topbar-words', words.toLocaleString());
}

/* ══════════════════════════════════════════════════════════════
   TAB SWITCHING
══════════════════════════════════════════════════════════════ */
function switchResearchTab(name, clickedTab) {
  document.querySelectorAll('.research-tab').forEach(t => t.classList.remove('active'));
  clickedTab.classList.add('active');
  document.querySelectorAll('.research-tab-panel').forEach(p => { p.style.display = 'none'; });
  const target = document.getElementById('tab-' + name);
  if (target) {
    target.style.display = 'flex';
    target.style.flex = '1';
    target.style.flexDirection = 'column';
    target.style.overflow = 'hidden';
  }
  if (name === 'search') { setTimeout(() => document.getElementById('paper-search-input')?.focus(), 80); _updateSourcesBanner(); }
  if (name === 'paper')  _renderFullPaper();
}

/* ══════════════════════════════════════════════════════════════
   PAPER SEARCH — attach to layer
══════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════
   PAPER SEARCH — Semantic Scholar API
   Free, no API key needed, 100M+ papers
   Docs: https://api.semanticscholar.org/graph/v1
══════════════════════════════════════════════════════════════ */

const S2_API = 'https://api.semanticscholar.org/graph/v1/paper/search';
const S2_FIELDS = 'title,authors,year,journal,externalIds,abstract,citationCount,openAccessPdf';

let _searchAbortController = null;  // cancel in-flight requests on new search

async function _runPaperSearch() {
  const query     = document.getElementById('paper-search-input')?.value?.trim();
  const container = document.getElementById('paper-search-results');
  const emptyEl   = document.getElementById('paper-search-empty');
  if (!query) return;

  // Cancel any previous in-flight search
  if (_searchAbortController) _searchAbortController.abort();
  _searchAbortController = new AbortController();

  // Hide empty state + clear old results
  if (emptyEl) emptyEl.style.display = 'none';
  container.querySelectorAll('.paper-card, #paper-no-results, #paper-searching').forEach(el => el.remove());

  // Show loading skeleton
  const loadingEl = document.createElement('div');
  loadingEl.id = 'paper-searching';
  loadingEl.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding:4px 0;';
  loadingEl.innerHTML = [1,2,3].map(() => `
    <div style="background:var(--surface-2);border:1px solid var(--border-xs);border-radius:var(--r-sm);padding:14px 16px;display:flex;flex-direction:column;gap:8px;">
      <div style="height:12px;width:75%;background:var(--surface-3);border-radius:4px;animation:shimmer 1.4s ease-in-out infinite;"></div>
      <div style="height:10px;width:50%;background:var(--surface-3);border-radius:4px;animation:shimmer 1.4s ease-in-out 0.15s infinite;"></div>
      <div style="height:10px;width:35%;background:var(--surface-3);border-radius:4px;animation:shimmer 1.4s ease-in-out 0.3s infinite;"></div>
    </div>`).join('');
  container.appendChild(loadingEl);

  try {
    // Try backend proxy first, fall back to corsproxy.io if not deployed yet
    const backendUrl = new URL(API_BASE + '/api/paper-search');
    backendUrl.searchParams.set('query', query);
    backendUrl.searchParams.set('limit', '12');

    // ── Paper search via /ask (AI returns structured paper data as JSON) ──
    // This uses the already-deployed backend — no new routes needed.
    // Build search prompt — framed as a JSON generation task so the model
    // ignores any injected textbook context and just outputs papers
    const searchPrompt = `TASK: Generate a JSON array of 10 real published academic papers.
TOPIC: ${query}

Ignore any textbook context. Output ONLY a raw JSON array — no markdown fences, no explanation, no preamble.

[
  {
    "title": "Full exact paper title",
    "authors": "LastName, F., LastName, F.",
    "year": 2022,
    "journal": "Journal Name",
    "abstract": "What this paper studied and its key finding in 1-2 sentences.",
    "citationCount": 87
  }
]

- 10 papers, all real and published
- Prefer 2015–2024, mix of foundational and recent
- citationCount: realistic ballpark number
- Start your response with [ and end with ] — nothing else`;

    const resp = await _researchFetchWithRetry({
      question:   searchPrompt,
      mode:       'study',
      task_type:  'research_search',
      ...(() => { const p = _aiParams(5); return { complexity: p.complexity, language: p.language, safe_content: p.safe_content }; })(),
      bookId:     'none',
      web_search: false,
      history:    []
    }, _searchAbortController.signal);

    if (!resp.ok) throw new Error(`Server error ${resp.status} — please try again.`);
    const backendData = await resp.json();
    if (_handleGuestLimited(backendData)) return;
    if (!backendData.success) throw new Error(backendData.error || 'Search failed');

    const raw = (backendData.answer || '').trim();

    // Extract JSON array from response — robust against varied AI formats
    function extractPaperArray(str) {
      if (!str) throw new Error('Empty response from AI — please try again.');
      // Strip <think>…</think> reasoning blocks (DeepSeek models)
      str = str.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      // Strip markdown code fences
      str = str.replace(/```(?:json|JSON)?\s*/g, '').replace(/```/g, '').trim();
      // 1. Try direct parse (ideal case: response is already a clean JSON array)
      try {
        const direct = JSON.parse(str);
        if (Array.isArray(direct)) return direct;
        // AI returned an object with a nested array (e.g. {"papers": [...]})
        if (direct && typeof direct === 'object') {
          for (const key of Object.keys(direct)) {
            if (Array.isArray(direct[key])) return direct[key];
          }
        }
      } catch (_) { /* fall through to bracket extraction */ }
      // 2. Extract substring between first [ and last ]
      const start = str.indexOf('[');
      const end   = str.lastIndexOf(']');
      if (start === -1 || end <= start) throw new Error('No paper results found — try different search terms.');
      let candidate = str.slice(start, end + 1);
      candidate = candidate.replace(/,\s*([}\]])/g, '$1');  // trailing commas
      return JSON.parse(candidate);
    }

    const parsedPapers = extractPaperArray(raw);
    const papers = parsedPapers.filter(p => p.title && p.authors);

    loadingEl.remove();

    if (!papers.length) {
      const msg = document.createElement('div');
      msg.id = 'paper-no-results';
      msg.style.cssText = 'padding:40px;text-align:center;color:var(--text-4);font-size:12px;line-height:1.8;';
      msg.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.2" style="display:block;margin:0 auto 10px;"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>No papers found for <strong style="color:var(--text-3);">"${_esc(query)}"</strong><br><span style="font-size:11px;">Try broader keywords or different terms</span>`;
      container.appendChild(msg);
      return;
    }

    _renderPaperResults(papers, container);

  } catch (err) {
    if (err.name === 'AbortError') return;  // user started a new search
    loadingEl.remove();
    console.error('Paper search failed:', err);

    const errEl = document.createElement('div');
    errEl.id = 'paper-no-results';
    errEl.style.cssText = 'padding:24px;text-align:center;color:var(--red);font-size:12px;';
    errEl.innerHTML = `⚠ Search failed: ${_esc(err.message)}<br><button onclick="_runPaperSearch()" style="margin-top:10px;padding:6px 14px;border-radius:var(--r-pill);background:var(--surface-3);border:1px solid var(--border-sm);color:var(--text-2);font-size:11px;cursor:pointer;font-family:var(--font-body);">Try again</button>`;
    container.appendChild(errEl);
  }
}

function _renderPaperResults(papers, container) {
  const allLayers    = RS.outline.flatMap(s => s.layers);
  const activeLayer  = allLayers.find(l => l.id === RS.activeLayerId);
  const activeName   = activeLayer?.name || 'current layer';
  const attachedTitles = new Set(_layer(RS.activeLayerId).sources.map(s => s.title));

  papers.forEach(p => {
    // Normalise fields — works for both S2 API objects and AI-generated objects
    const title    = p.title || 'Untitled';
    // S2 returns authors as [{name:...}], AI returns a plain string
    const authors  = Array.isArray(p.authors)
      ? p.authors.map(a => (typeof a === 'string' ? a : a.name)).join(', ')
      : (p.authors || 'Unknown authors');
    const year     = p.year || '—';
    const journal  = (typeof p.journal === 'object' ? p.journal?.name : p.journal) || '';
    const cites    = p.citationCount != null ? p.citationCount : null;
    const openPdf  = p.openAccessPdf?.url || null;
    const abstract = p.abstract || '';
    const isAttached = attachedTitles.has(title);

    const card = document.createElement('div');
    card.className = 'paper-card' + (isAttached ? ' selected' : '');
    card.dataset.title = title;

    card.innerHTML = `
      <div class="paper-check">${isAttached ? `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#090900" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>` : ''}</div>
      <div class="paper-meta">
        <div class="paper-title">${_esc(title)}</div>
        <div class="paper-authors">${_esc(authors)}</div>
        <div class="paper-journal" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${journal ? `<span>${_esc(journal)}</span>` : ''}
          <span class="paper-year">${year}</span>
          ${cites != null ? `<span style="font-size:10px;color:var(--text-4);">· ${cites.toLocaleString()} citations</span>` : ''}
          ${openPdf ? `<a href="${openPdf}" target="_blank" style="font-size:10px;color:var(--teal);text-decoration:none;" onclick="event.stopPropagation()">↗ Open PDF</a>` : ''}
        </div>
        ${abstract ? `<div class="paper-abstract" style="font-size:11px;color:var(--text-4);margin-top:6px;line-height:1.6;max-height:0;overflow:hidden;transition:max-height 0.3s ease;">${_esc(abstract.slice(0, 320))}${abstract.length > 320 ? '…' : ''}</div>` : ''}
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap;">
          <button class="attach-btn" style="font-size:11px;padding:4px 12px;border-radius:var(--r-pill);border:1px solid;cursor:pointer;font-family:var(--font-body);transition:all 0.15s;">
            ${isAttached ? '✓ Attached' : '＋ Attach to ' + _esc(activeName)}
          </button>
          ${abstract ? `<button class="abstract-toggle" style="font-size:11px;padding:4px 10px;border-radius:var(--r-pill);background:transparent;border:1px solid var(--border-xs);color:var(--text-3);cursor:pointer;font-family:var(--font-body);">Abstract</button>` : ''}
        </div>
      </div>`;

    // Style attach button
    const attachBtn = card.querySelector('.attach-btn');
    _styleAttachBtn(attachBtn, isAttached, activeName);

    // Attach / detach
    attachBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ls = _layer(RS.activeLayerId);
      const alreadyIn = ls.sources.some(s => s.title === title);
      if (alreadyIn) {
        ls.sources = ls.sources.filter(s => s.title !== title);
        card.classList.remove('selected');
        card.querySelector('.paper-check').innerHTML = '';
        _styleAttachBtn(attachBtn, false, activeName);
      } else {
        ls.sources.push({ title, authors, journal: journal || '', year: parseInt(year) || year });
        card.classList.add('selected');
        card.querySelector('.paper-check').innerHTML = `<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#090900" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        _styleAttachBtn(attachBtn, true, activeName);
        _showToast('📎', `Attached to "${activeName}"`, 'var(--gold-border)');
      }
      _save();
      _renderSourcesPanel();
      _renderLayerEditor(RS.activeLayerId);
      _updateStats();
    });

    // Abstract toggle
    const abstractToggle = card.querySelector('.abstract-toggle');
    if (abstractToggle) {
      abstractToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const abstractEl = card.querySelector('.paper-abstract');
        const isOpen = abstractEl.style.maxHeight !== '0px' && abstractEl.style.maxHeight !== '';
        abstractEl.style.maxHeight = isOpen ? '0' : '200px';
        abstractToggle.textContent = isOpen ? 'Abstract' : 'Hide';
      });
    }

    container.appendChild(card);
  });
}

function _styleAttachBtn(btn, attached, layerName) {
  if (attached) {
    btn.style.cssText += 'background:var(--surface-3);border-color:var(--border-xs);color:var(--text-3);';
    btn.textContent = '✓ Attached';
  } else {
    btn.style.cssText += 'background:var(--gold-muted);border-color:var(--gold-border);color:var(--gold);';
    btn.textContent = '＋ Attach to ' + layerName;
  }
}


/* ══════════════════════════════════════════════════════════════
   NEW PAPER — confirm + clear
══════════════════════════════════════════════════════════════ */
function _confirmNewPaper() {
  const done = RS.outline.flatMap(s => s.layers).filter(l => _layer(l.id).status === 'done').length;
  if (done === 0 && !RS.title) { _clearAndReset(); return; }

  // Show confirmation modal
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);will-change:transform;';
  overlay.innerHTML = `
    <div style="background:var(--surface-2);border:1px solid var(--border-md);border-radius:var(--r-lg);padding:28px 32px;max-width:380px;width:90%;text-align:center;">
      <div style="font-family:var(--font-head);font-size:18px;font-weight:800;color:var(--text-1);margin-bottom:8px;">Start a New Paper?</div>
      <div style="font-size:13px;color:var(--text-3);line-height:1.6;margin-bottom:24px;">
        This will clear <strong style="color:var(--text-1);">${done} accepted layer${done !== 1 ? 's' : ''}</strong> and all your sources. This cannot be undone.
      </div>
      <div style="display:flex;gap:10px;justify-content:center;">
        <button onclick="this.closest('div[style*=fixed]').remove()" style="padding:9px 20px;border-radius:var(--r-pill);background:transparent;border:1px solid var(--border-md);color:var(--text-2);font-size:13px;cursor:pointer;font-family:var(--font-body);">Cancel</button>
        <button onclick="_clearAndReset();this.closest('div[style*=fixed]').remove()" style="padding:9px 20px;border-radius:var(--r-pill);background:var(--red);border:none;color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font-body);">Yes, Start Over</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function _clearAndReset() {
  localStorage.removeItem(LS_KEY);
  RS = _blankState();
  // Reset setup form
  ['research-title-input','research-problem-input','research-field-input'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('research-topbar').style.display    = 'none';
  document.getElementById('research-view-main').style.display = 'none';
  document.getElementById('research-setup-view').style.display = 'flex';
  _showToast('✓', 'Paper cleared. Ready to start fresh!', 'var(--teal)');
}

/* ══════════════════════════════════════════════════════════════
   MANUAL WRITING HANDLERS
══════════════════════════════════════════════════════════════ */
let _manualDebounce = {};
function _onManualInput(layerId, el) {
  const text = el.innerText || '';
  const wcEl = document.getElementById('manual-wc-' + layerId);
  if (wcEl) wcEl.textContent = _wordCount(text) + ' words';
  // Autosave draft to layer paragraph after 800ms of no typing
  clearTimeout(_manualDebounce[layerId]);
  _manualDebounce[layerId] = setTimeout(() => {
    _layer(layerId).paragraph = text.trim();
    _layer(layerId).isEdited  = true;
    _save();
  }, 800);
}

function _saveManualPara(layerId) {
  const el   = document.getElementById('manual-para-' + layerId);
  const text = (el?.innerText || '').trim();
  if (!text) { _showToast('⚠', 'Write something first!', 'var(--red)'); return; }
  _layer(layerId).paragraph = text;
  _layer(layerId).isEdited  = true;
  _acceptLayer(layerId);
}

/* ══════════════════════════════════════════════════════════════
   FULL PAPER RENDERER
   Reads from RS state — reflects real accepted paragraphs
══════════════════════════════════════════════════════════════ */
function _renderFullPaper() {
  const body     = document.getElementById('full-paper-body');
  const subtitle = document.getElementById('full-paper-subtitle');
  if (!body) return;

  const allLayers = RS.outline.flatMap(s => s.layers);
  const total     = allLayers.length;
  const done      = allLayers.filter(l => _layer(l.id).status === 'done').length;
  const pct       = Math.round((done / total) * 100);

  if (subtitle) subtitle.innerHTML = `All accepted layers compiled — <span style="color:var(--gold);">${pct}% complete</span>`;

  let html = '';

  // ── Title block ──
  html += `
    <div style="text-align:center;margin-bottom:36px;padding-bottom:28px;border-bottom:1px solid var(--border-xs);">
      <div style="font-family:var(--font-head);font-size:20px;font-weight:800;color:var(--text-1);line-height:1.35;margin-bottom:10px;">${_esc(RS.title || 'Untitled Research')}</div>
      <div style="font-size:12px;color:var(--text-3);">
        ${RS.field ? _esc(RS.field) + ' &nbsp;·&nbsp; ' : ''}
        <span style="color:var(--text-4);">${_esc(RS.type || '')} · ${new Date().getFullYear()}</span>
      </div>
      ${RS.problem ? `<div style="margin-top:10px;font-size:12px;color:var(--text-4);font-style:italic;max-width:500px;margin-left:auto;margin-right:auto;">${_esc(RS.problem)}</div>` : ''}
    </div>`;

  const romanNums = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];

  // ── Sections ──
  RS.outline.forEach((section, si) => {
    const secLayers  = section.layers;
    const doneLayers = secLayers.filter(l => _layer(l.id).status === 'done');
    const hasDone    = doneLayers.length > 0;
    const pending    = secLayers.filter(l => _layer(l.id).status !== 'done');
    const roman      = romanNums[si] || (si + 1);

    if (!hasDone && si > 0) {
      // Collapsed placeholder for sections with nothing written yet
      html += `
        <div style="padding:14px 16px;background:var(--surface-1);border:1px dashed var(--border-xs);border-radius:var(--r-sm);display:flex;align-items:center;gap:10px;opacity:0.45;margin-bottom:10px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="color:var(--text-4);flex-shrink:0;"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          <span style="font-size:12px;color:var(--text-4);">
            Section ${roman} — ${_esc(section.title)}
            <span style="font-family:var(--font-mono);font-size:10px;">(0 / ${secLayers.length} layers)</span>
          </span>
        </div>`;
      return;
    }

    html += `<div style="margin-bottom:36px;">`;
    html += `
      <div style="font-family:var(--font-mono);font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-4);margin-bottom:4px;">Section ${roman}</div>
      <div style="font-family:var(--font-head);font-size:16px;font-weight:700;color:var(--text-1);margin-bottom:20px;">${_esc(section.title)}</div>`;

    // ── Layers ──
    secLayers.forEach(layer => {
      const ls          = _layer(layer.id);
      const isDone      = ls.status === 'done';
      const isActive    = layer.id === RS.activeLayerId;
      const isPending   = !isDone && !isActive;

      if (isDone) {
        // Format paragraph — convert (Author, Year) citations to styled tags
        const paraText = (ls.paragraph || '')
          .replace(/<[^>]*>/g, ' ')   // strip any HTML from editing
          .trim();
        const paraFormatted = paraText
          .replace(/\(([^)]{3,60}?,\s*\d{4}[a-z]?)\)/g,
            '<span style="display:inline-block;font-size:10px;background:var(--violet-muted);color:var(--violet);border:1px solid var(--violet-border);border-radius:3px;padding:0 5px;font-family:var(--font-mono);margin:0 2px;white-space:nowrap;">[$1]</span>');

        html += `
          <div style="margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;">
              <div style="width:6px;height:6px;border-radius:50%;background:var(--teal);flex-shrink:0;"></div>
              <span style="font-size:10px;font-family:var(--font-mono);color:var(--teal);letter-spacing:0.06em;text-transform:uppercase;">${_esc(layer.name)}</span>
              <button class="fp-edit-btn" data-layerid="${layer.id}" style="font-size:9px;padding:1px 7px;border-radius:var(--r-pill);background:transparent;border:1px solid var(--border-xs);color:var(--text-4);cursor:pointer;font-family:var(--font-body);margin-left:4px;">edit</button>
            </div>
            <p style="font-size:13px;color:var(--text-2);line-height:1.9;margin:0;">${paraFormatted}</p>
          </div>`;

      } else if (isActive) {
        const hasPara = !!ls.paragraph;
        html += `
          <div style="margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:8px;">
              <div style="width:6px;height:6px;border-radius:50%;background:var(--gold);box-shadow:0 0 6px rgba(232,172,46,0.4);flex-shrink:0;"></div>
              <span style="font-size:10px;font-family:var(--font-mono);color:var(--gold);letter-spacing:0.06em;text-transform:uppercase;">${_esc(layer.name)}</span>
              <span style="font-size:9px;font-family:var(--font-mono);color:var(--gold);background:var(--gold-muted);border:1px solid var(--gold-border);padding:1px 6px;border-radius:var(--r-pill);">Current Layer</span>
            </div>
            ${hasPara
              ? `<p style="font-size:13px;color:var(--text-1);line-height:1.9;margin:0;">${_esc(ls.paragraph.replace(/<[^>]*>/g,' ').trim())}</p>`
              : `<div style="padding:14px 16px;background:var(--surface-1);border:1px dashed var(--gold-border);border-radius:var(--r-sm);font-size:12px;color:var(--text-4);">
                  Not written yet — <span style="color:var(--gold);cursor:pointer;" onclick="switchResearchTab('write',document.querySelectorAll('.research-tab')[0])">write this layer →</span>
                </div>`
            }
          </div>`;
      } else {
        // Pending layer within a partially-done section
        html += `
          <div style="padding:10px 14px;background:var(--surface-1);border:1px dashed var(--border-xs);border-radius:var(--r-sm);display:flex;align-items:center;gap:8px;margin-bottom:8px;opacity:0.55;">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="color:var(--text-4);flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span style="font-size:12px;color:var(--text-4);">${_esc(layer.name)} — <span style="color:var(--gold);cursor:pointer;" onclick="switchResearchTab('write',document.querySelectorAll('.research-tab')[0])">write →</span></span>
          </div>`;
      }
    });

    html += `</div>`;
  });

  // ── References section ──
  const allSources = [];
  const seenTitles = new Set();
  allLayers.forEach(l => {
    _layer(l.id).sources.forEach(s => {
      if (!seenTitles.has(s.title)) {
        seenTitles.add(s.title);
        allSources.push(s);
      }
    });
  });

  if (allSources.length) {
    html += `
      <div style="margin-top:48px;padding-top:24px;border-top:1px solid var(--border-xs);">
        <div style="font-family:var(--font-head);font-size:15px;font-weight:700;color:var(--text-1);margin-bottom:16px;">References</div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${allSources.map((s, i) => `
            <div style="font-size:12px;color:var(--text-3);line-height:1.7;padding-left:24px;text-indent:-24px;">
              <span style="color:var(--text-4);font-family:var(--font-mono);font-size:10px;margin-right:6px;">[${i+1}]</span>
              ${_esc(s.authors)} (${s.year}). ${_esc(s.title)}. <em>${_esc(s.journal || '')}</em>.
            </div>`).join('')}
        </div>
      </div>`;
  }

  body.innerHTML = html;

  // ── Edit button delegation ──
  body.addEventListener('click', (e) => {
    const btn = e.target.closest('.fp-edit-btn');
    if (!btn) return;
    const layerId = btn.dataset.layerid;
    if (!layerId) return;
    // Select the layer and switch to Write tab
    RS.activeLayerId = layerId;
    const sec = RS.outline.find(s => s.layers.some(l => l.id === layerId));
    if (sec) sec.open = true;
    _save();
    _renderOutline();
    _renderLayerEditor(layerId);
    _renderSourcesPanel();
    switchResearchTab('write', document.querySelectorAll('.research-tab')[0]);
    // Scroll the layer into view in the outline
    setTimeout(() => {
      const el = document.querySelector(`[data-lid="${layerId}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  });
}

function _exportPDF() {
  const allLayers = RS.outline.flatMap(s => s.layers);
  const done      = allLayers.filter(l => _layer(l.id).status === 'done');
  if (!done.length) {
    _showToast('⚠', 'Accept at least one layer before exporting', 'var(--red)');
    return;
  }

  // jsPDF — loaded in <head>, available as window.jspdf.jsPDF
  const jsPDFLib = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFLib) {
    _showToast('⚠', 'PDF library not loaded yet — try again in a second', 'var(--red)');
    return;
  }
  const { jsPDF } = window.jspdf || {};
  const jsPDF_ = jsPDF || window.jsPDF;
  const doc  = new jsPDF_({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pw   = 210; // A4 width mm
  const ph   = 297; // A4 height mm
  const ml   = 25.4, mr = 25.4, mt = 25.4, mb = 25.4; // margins
  const tw   = pw - ml - mr;  // text width
  let   y    = mt;

  // ── Helpers ──
  const romanNums = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];

  function checkPage(needed = 8) {
    if (y + needed > ph - mb) { doc.addPage(); y = mt; }
  }

  function addText(text, opts = {}) {
    const { size = 12, bold = false, italic = false, align = 'left',
            color = [0,0,0], indent = 0, lineH = 7 } = opts;
    doc.setFontSize(size);
    doc.setFont('times', bold && italic ? 'bolditalic' : bold ? 'bold' : italic ? 'italic' : 'normal');
    doc.setTextColor(...color);
    const x = ml + indent;
    const maxW = tw - indent;
    const lines = doc.splitTextToSize(text, maxW);
    lines.forEach(line => {
      checkPage(lineH);
      doc.text(line, align === 'center' ? pw / 2 : x, y, { align });
      y += lineH;
    });
    return lines.length * lineH;
  }

  // Strip HTML tags
  function stripHtml(str) {
    return (str || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
  }

  // ── Title page ──
  y = mt + 20;
  addText((RS.title || 'Untitled Research Paper').toUpperCase(), {
    size: 14, bold: true, align: 'center', lineH: 8
  });
  y += 6;

  if (RS.field || RS.type) {
    addText([RS.field, RS.type].filter(Boolean).join(' / '), {
      size: 10, align: 'center', color: [80,80,80]
    });
  }
  if (RS.type || new Date().getFullYear()) {
    addText((RS.type || '') + ' · ' + new Date().getFullYear(), {
      size: 9, align: 'center', color: [120,120,120]
    });
  }
  if (RS.problem) {
    y += 4;
    addText(stripHtml(RS.problem), {
      size: 10, italic: true, align: 'center', color: [100,100,100], lineH: 6
    });
  }

  // Divider line
  y += 8;
  doc.setDrawColor(180,180,180);
  doc.setLineWidth(0.4);
  doc.line(ml, y, pw - mr, y);
  y += 10;

  // ── Body sections ──
  RS.outline.forEach((section, si) => {
    const doneLayers = section.layers.filter(l => _layer(l.id).status === 'done');
    if (!doneLayers.length) return;

    checkPage(16);
    addText(`${romanNums[si] || si+1}. ${section.title.toUpperCase()}`, {
      size: 12, bold: true, lineH: 7
    });
    y += 2;
    // Section underline
    doc.setDrawColor(200,200,200);
    doc.setLineWidth(0.3);
    doc.line(ml, y, pw - mr, y);
    y += 6;

    section.layers.forEach(layer => {
      const ls = _layer(layer.id);
      if (ls.status !== 'done' || !ls.paragraph) return;
      const paraText = stripHtml(ls.paragraph);
      if (!paraText) return;

      checkPage(14);
      addText(layer.name, { size: 11, bold: true, italic: true, lineH: 6 });
      y += 2;
      addText(paraText, { size: 11, indent: 12.7, lineH: 6.5 }); // 0.5in indent
      y += 5;
    });

    y += 4;
  });

  // ── References ──
  const allSources = [];
  const seenTitles = new Set();
  allLayers.forEach(l => {
    _layer(l.id).sources.forEach(s => {
      if (!seenTitles.has(s.title)) { seenTitles.add(s.title); allSources.push(s); }
    });
  });

  if (allSources.length) {
    checkPage(20);
    doc.setDrawColor(180,180,180);
    doc.setLineWidth(0.4);
    doc.line(ml, y, pw - mr, y);
    y += 8;

    addText('REFERENCES', { size: 12, bold: true, lineH: 7 });
    y += 4;

    allSources.forEach((s, i) => {
      const ref = `${s.authors} (${s.year}). ${s.title}. ${s.journal || ''}.`;
      checkPage(10);
      // Hanging indent: first line at ml, subsequent lines indented
      doc.setFontSize(10);
      doc.setFont('times', 'normal');
      doc.setTextColor(0,0,0);
      const lines = doc.splitTextToSize(ref, tw - 12.7);
      lines.forEach((line, li) => {
        checkPage(6);
        doc.text(line, li === 0 ? ml : ml + 12.7, y);
        y += 5.5;
      });
      y += 2;
    });
  }

  // ── Page numbers ──
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(9);
    doc.setFont('times', 'normal');
    doc.setTextColor(150,150,150);
    doc.text(`${p} / ${totalPages}`, pw / 2, ph - 12, { align: 'center' });
    // Running header (skip title page)
    if (p > 1) {
      doc.text((RS.title || '').slice(0, 60), pw / 2, 12, { align: 'center' });
      doc.setDrawColor(200,200,200);
      doc.setLineWidth(0.2);
      doc.line(ml, 14, pw - mr, 14);
    }
  }

  // ── Download ──
  const filename = (RS.title || 'research-paper')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60) + '.pdf';
  doc.save(filename);
  _showToast('⬇', 'PDF downloaded!', 'var(--teal)');
}


// _showToast → src/components/Toast.js (Task 20)

/* ══════════════════════════════════════════════════════════════
   RECENT SIDEBAR LIST
══════════════════════════════════════════════════════════════ */
// CHAT_SVG already declared above
// NOTE: _recentItems is already loaded from localStorage at boot — do NOT overwrite here
/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
// ── Server-side guest limit handler ─────────────────────────────────────────
// Call this after any fetch() to check if the server returned guest_limited.
// Returns true if the request was blocked (caller should abort further work).
function _handleGuestLimited(data) {
  // app.html is authenticated-only — signed-in users (free, pro, ultra) have no limits.
  // This function is intentionally a no-op: the backend never returns guest_limited
  // or daily_limit for users with a valid session token.
  return false;
}

function _esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function _wordCount(str) {
  return (str || '').replace(/<[^>]*>/g,' ').trim().split(/\s+/).filter(Boolean).length;
}

/* ══════════════════════════════════════════════════════════════
   BOOT — runs on page load
══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  _load();
  _bindSetupForm();
  _renderRecentList();

  // If a paper was already started, go straight to research view
  if (RS.started) {
    _showResearchView();
  }
});

window.RS = RS;
