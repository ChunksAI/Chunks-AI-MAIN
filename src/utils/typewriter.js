// @ts-nocheck
/**
 * src/utils/typewriter.js
 *
 * Word-by-word typewriter utilities for AI chat responses.
 *
 * Exports:
 *   typewriteResponse(element, fullText, options)  — simulated typewriter for non-streaming responses
 *   streamResponseToElement(element, stream)       — word-by-word renderer for SSE / ReadableStream
 */

const _wait = ms => new Promise(res => setTimeout(res, ms));

/**
 * Simulate a typewriter effect on `element` for the given `fullText`.
 * Re-renders through `options.render` (e.g. markdown renderer) on every word
 * so that formatting is incrementally applied.
 *
 * @param {HTMLElement} element    — target element to render into
 * @param {string}      fullText  — complete AI response text
 * @param {object}      [options]
 * @param {function}    [options.render]   — (text) => html string (e.g. homeMarkdown)
 * @param {function}    [options.onDone]   — callback when typing finishes
 * @param {function}    [options.onScroll] — called periodically for auto-scroll
 * @param {function}    [options.isCancelled] — () => boolean, stops typing if true
 * @returns {Promise<void>}
 */
export async function typewriteResponse(element, fullText, {
  render,
  onDone,
  onScroll,
  isCancelled,
} = {}) {
  if (!element || !fullText) { onDone?.(); return; }

  let typed = '';
  const words = fullText.split(/(\s+)/);

  for (let i = 0; i < words.length; i++) {
    if (isCancelled?.()) break;

    typed += words[i];

    if (render) {
      element.innerHTML = render(typed);
    } else {
      element.textContent = typed;
    }

    // Punctuation-aware delay
    const word = words[i].trim();
    if (!word) {
      await _wait(8);
      continue;
    }
    const delay = /[.!?]$/.test(word) ? 100
                : /[,;:]$/.test(word) ? 50
                : 22;
    await _wait(delay);

    // Auto-scroll every 5 real words
    if (i % 10 === 0 && onScroll) onScroll();
  }

  // Final render to ensure the full text is complete and formatted
  if (render) {
    element.innerHTML = render(fullText);
  } else {
    element.textContent = fullText;
  }

  onScroll?.();
  onDone?.();
}

/**
 * Stream an SSE / ReadableStream response word-by-word into `element`.
 *
 * @param {HTMLElement}    element  — target element
 * @param {ReadableStream} stream  — response.body from fetch
 * @param {object}         [options]
 * @param {function}       [options.render]   — (text) => html string
 * @param {function}       [options.onDone]   — callback when stream ends
 * @param {function}       [options.onScroll] — called periodically
 * @returns {Promise<string>} full accumulated text
 */
export async function streamResponseToElement(element, stream, {
  render,
  onDone,
  onScroll,
} = {}) {
  const reader  = stream.getReader();
  const decoder = new TextDecoder();
  let fullText  = '';

  element.textContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });

    // Parse SSE format if present
    const lines = chunk.split('\n');
    for (const line of lines) {
      let text = '';
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          text = data.token || data.text || data.content || '';
        } catch { /* not JSON — treat as plain text */ }
      } else if (line.trim()) {
        text = line;
      }

      if (!text) continue;
      fullText += text;

      // Render word by word
      const words = text.split(/(\s+)/);
      for (const word of words) {
        if (render) {
          element.innerHTML = render(fullText);
        } else {
          element.textContent = fullText;
        }
        await _wait(word.trim() ? 22 : 8);
      }
    }

    onScroll?.();
  }

  // Final render
  if (render) {
    element.innerHTML = render(fullText);
  }

  onScroll?.();
  onDone?.();
  return fullText;
}
