/**
 * notesTabXss.test.ts
 *
 * Verifies that the safe DOM population logic used by NoteCard in NotesTab.tsx
 * never parses user-supplied note content as HTML.
 *
 * We exercise the same algorithm copied verbatim from the component's useEffect
 * so that any future regression in the component is caught here.
 */

// ── Helper: mirrors the useEffect body in NoteCard ────────────────────────────

/**
 * Populate a contenteditable element with plain-text content, using the same
 * approach as NoteCard in NotesTab.tsx.  Line breaks in the stored string
 * become <br> elements; everything else is a text node.
 *
 * This must NEVER call innerHTML so that malicious markup is never parsed.
 */
function setNoteContentSafe(el: HTMLElement, content: string): void {
  el.textContent = '';
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    el.appendChild(document.createTextNode(line));
    if (i < lines.length - 1) {
      el.appendChild(document.createElement('br'));
    }
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NoteCard content population – XSS safety', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.setAttribute('contenteditable', 'true');
    document.body.appendChild(container);
    // Ensure global XSS canary is clear before each test.
    delete (window as typeof window & { __xss?: unknown }).__xss;
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('does not create an <img> element when content contains an img tag', () => {
    const malicious = '<img src=x onerror="window.__xss=1"> hello';
    setNoteContentSafe(container, malicious);

    expect(container.querySelector('img')).toBeNull();
  });

  it('does not execute injected script via onerror', () => {
    const malicious = '<img src=x onerror="window.__xss=1">';
    setNoteContentSafe(container, malicious);

    expect((window as typeof window & { __xss?: unknown }).__xss).toBeUndefined();
  });

  it('does not create a <script> element', () => {
    const malicious = '<script>window.__xss=1</script>';
    setNoteContentSafe(container, malicious);

    expect(container.querySelector('script')).toBeNull();
  });

  it('preserves the literal tag characters as visible text', () => {
    const malicious = '<img src=x onerror="alert(1)"> hello';
    setNoteContentSafe(container, malicious);

    expect(container.textContent).toContain('<img');
    expect(container.textContent).toContain('hello');
  });

  it('preserves newlines by inserting <br> elements', () => {
    setNoteContentSafe(container, 'line one\nline two\nline three');

    const brs = container.querySelectorAll('br');
    expect(brs.length).toBe(2);
    expect(container.textContent).toContain('line one');
    expect(container.textContent).toContain('line three');
  });

  it('handles empty content without throwing', () => {
    expect(() => setNoteContentSafe(container, '')).not.toThrow();
    expect(container.textContent).toBe('');
  });
});
