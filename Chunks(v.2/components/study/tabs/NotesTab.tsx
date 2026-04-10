interface NotesTabProps {
  onNewNote: () => void;
}

export default function NotesTab({ onNewNote }: NotesTabProps) {
  return (
    <div className="workspace-tab">
      <div className="ws-header">
        <div>
          <div className="ws-title">Notes</div>
          <div className="ws-meta">Auto-saved · Chapter 3 — Cell Biology</div>
        </div>
        <button className="ws-add-btn" onClick={onNewNote}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New Note
        </button>
      </div>

      <div className="ws-grid">
        <div className="review-card">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 500, marginBottom: 12, letterSpacing: -0.2 }}>
            Chapter 3 — My Notes
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.85 }}>
            <p style={{ marginBottom: 10 }}><strong>Key organelles to remember:</strong></p>
            <p style={{ marginBottom: 6 }}>• <strong>Nucleus</strong> — DNA storage, transcription</p>
            <p style={{ marginBottom: 6 }}>• <strong>Mitochondria</strong> — ATP via cellular respiration (⚠ study more)</p>
            <p style={{ marginBottom: 6 }}>• <strong>ER (rough)</strong> — protein synthesis with ribosomes</p>
            <p style={{ marginBottom: 6 }}>• <strong>ER (smooth)</strong> — lipid synthesis, detox</p>
            <p style={{ marginBottom: 10 }}>• <strong>Golgi</strong> — packaging + secretion</p>
            <p style={{ marginBottom: 10 }}>
              <em>Analogy: Cell = city. Nucleus = city hall, Mito = power plant, Golgi = post office.</em>
            </p>
            <p style={{ color: 'var(--text3)', fontSize: 12 }}>Auto-saved · AI-enhanced · Last edited 12 min ago</p>
          </div>
        </div>
      </div>
    </div>
  );
}
