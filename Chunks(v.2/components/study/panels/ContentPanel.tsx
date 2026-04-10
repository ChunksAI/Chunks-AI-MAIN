'use client';

import { useState } from 'react';

interface ContentPanelProps {
  style?: React.CSSProperties;
  onExplain?: (text: string) => void;
  onQuiz?: (text: string) => void;
  onSummarize?: () => void;
}

export default function ContentPanel({ style, onExplain, onQuiz, onSummarize }: ContentPanelProps) {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  const showTooltip = (id: string) => {
    setActiveTooltip(id);
    setTimeout(() => setActiveTooltip(null), 4000);
  };

  return (
    <div className="content-panel" style={style}>
      {/* ── Panel header ── */}
      <div className="panel-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text3)' }}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
        <span className="panel-title">Biology Textbook — Chapter 3</span>
        <div className="panel-actions">
          <button className="panel-btn">p. 47</button>
          <button className="panel-btn">☰</button>
        </div>
      </div>

      {/* ── PDF viewer ── */}
      <div className="pdf-viewer">

        {/* Page 1 */}
        <div className="pdf-page">
          <div className="pdf-chapter">Chapter 3</div>
          <div className="pdf-subtitle">Cell Structure and Function · Pages 47–68</div>
          <div className="pdf-body">
            <p>
              The cell is the basic structural and functional unit of all living organisms.{' '}
              <span
                className="highlight"
                onClick={() => showTooltip('h1')}
              >
                Every cell is bounded by a plasma membrane that separates the intracellular
                environment from the extracellular environment.
                <div className={`selection-tooltip${activeTooltip === 'h1' ? ' visible' : ''}`}>
                  <button className="tooltip-btn" onClick={(e) => { e.stopPropagation(); onExplain?.('plasma membrane'); }}>✦ Explain</button>
                  <div className="divider-v" />
                  <button className="tooltip-btn" onClick={(e) => { e.stopPropagation(); onQuiz?.('plasma membrane'); }}>❓ Quiz me</button>
                  <div className="divider-v" />
                  <button className="tooltip-btn" onClick={(e) => { e.stopPropagation(); onSummarize?.(); }}>↓ Summarize</button>
                </div>
              </span>
            </p>
            <p>
              Cells contain a variety of internal structures called organelles. The nucleus,
              often called the control center of the cell, houses the cell&apos;s genetic material
              in the form of DNA.{' '}
              <span
                className="highlight"
                onClick={() => showTooltip('h2')}
              >
                The mitochondria, often referred to as the &ldquo;powerhouse of the cell,&rdquo;
                generate adenosine triphosphate (ATP) through cellular respiration.
                <div className={`selection-tooltip${activeTooltip === 'h2' ? ' visible' : ''}`}>
                  <button className="tooltip-btn" onClick={(e) => { e.stopPropagation(); onExplain?.('mitochondria'); }}>✦ Explain</button>
                  <div className="divider-v" />
                  <button className="tooltip-btn" onClick={(e) => { e.stopPropagation(); onQuiz?.('mitochondria'); }}>❓ Quiz me</button>
                  <div className="divider-v" />
                  <button className="tooltip-btn" onClick={(e) => { e.stopPropagation(); onSummarize?.(); }}>↓ Summarize</button>
                </div>
              </span>
            </p>
            <p>
              The endoplasmic reticulum (ER) exists in two forms: rough ER, which is studded
              with ribosomes and involved in protein synthesis, and smooth ER, which is involved
              in lipid synthesis and detoxification. The Golgi apparatus processes and packages
              proteins for secretion or internal use.
            </p>
            <p>
              Lysosomes contain digestive enzymes and are responsible for breaking down waste
              materials and cellular debris. Vacuoles store materials such as water, food, or
              waste products. In plant cells, a large central vacuole maintains cell turgor pressure.
            </p>
          </div>
          <div className="page-num">47</div>
        </div>

        {/* Page 2 */}
        <div className="pdf-page">
          <div className="pdf-body">
            <p>
              The cytoskeleton is a network of protein filaments that provides structural support
              to the cell and plays roles in cell movement and division. It consists of three main
              components: microtubules, microfilaments (actin filaments), and intermediate filaments.
            </p>
            <p>
              <strong>Cell Communication:</strong> Cells communicate with each other through various
              mechanisms including direct contact via gap junctions, and through chemical signals such
              as hormones and neurotransmitters. Signal transduction pathways allow cells to respond
              to external stimuli.
            </p>
            <p>
              The plasma membrane is composed of a phospholipid bilayer embedded with various proteins.
              This fluid mosaic model, proposed by Singer and Nicolson in 1972, describes the dynamic
              nature of the membrane where lipids and proteins can move laterally.
            </p>
          </div>
          <div className="page-num">48</div>
        </div>

      </div>
    </div>
  );
}
