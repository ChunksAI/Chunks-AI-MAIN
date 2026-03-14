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
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="url(#lg-gv)" stroke-width="1.5" stroke-linecap="round"><path d="M9 12h6m-3-3v6"/><path d="M3 7V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"/><path d="M21 7H3l1.5 11A2 2 0 0 0 6.48 20h11.04a2 2 0 0 0 1.98-2L21 7z"/></svg>
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

let _dragSrcId  = null;
let _dragSrcSid = null;

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
