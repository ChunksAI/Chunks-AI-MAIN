// @ts-nocheck
/**
 * src/utils/typewriter.js
 *
 * Word-by-word typewriter utilities for AI chat responses.
 *
 * Exports:
 *   extractThinkBlock(text)                        — strips <think>…</think> from text, returns { answer, thinkingContent }
 *   typewriteResponse(element, fullText, options)  — simulated typewriter for non-streaming responses
 *   streamResponseToElement(element, stream)       — word-by-word renderer for SSE / ReadableStream
 */

const _wait = ms => new Promise(res => setTimeout(res, ms));

/**
 * When a model embeds its entire response — including the final answer —
 * inside the `<think>` block with nothing after `</think>`, this helper
 * tries to split the thinking string into `{ answer, thinkingContent }`.
 *
 * Strategy:
 *   1. Look for an explicit "Final answer:" / "In summary:" marker paragraph.
 *   2. Fall back to the last double-newline-separated paragraph.
 *
 * Returns `{ answer: '', thinkingContent: original }` when no split is found.
 *
 * @param {string} thinking  Inner content of the `<think>` block.
 * @returns {{ answer: string, thinkingContent: string|null }}
 */
function _salvageAnswerFromThinking(thinking) {
  if (!thinking) return { answer: '', thinkingContent: thinking };

  // 1. Explicit final-answer marker
  const MARKER = /\*{0,2}(?:final\s+answer|my\s+answer)\*{0,2}\s*[:\-–]|(?:in\s+(?:summary|conclusion|short))[,:]?\s/i;
  const markerMatch = MARKER.exec(thinking);
  if (markerMatch) {
    const prevBreak = thinking.lastIndexOf('\n\n', markerMatch.index);
    const splitAt = prevBreak !== -1 ? prevBreak + 2 : markerMatch.index;
    const candidate = thinking.slice(splitAt).trim();
    if (candidate) {
      return { answer: candidate, thinkingContent: thinking.slice(0, splitAt).trim() || null };
    }
  }

  // 2. Last blank-line-separated paragraph
  const lastBreak = thinking.lastIndexOf('\n\n');
  if (lastBreak !== -1) {
    const candidate = thinking.slice(lastBreak).trim();
    if (candidate) {
      return { answer: candidate, thinkingContent: thinking.slice(0, lastBreak).trim() || null };
    }
  }

  return { answer: '', thinkingContent: thinking || null };
}

/**
 * Strip any `<think>…</think>` block from `text` and return the two parts
 * separately.  This is the frontend safety-net: the backend should already
 * do this, but if it misses (wrong mode, malformed tags, etc.) we make sure
 * the raw `<think>` markup never reaches the chat panel.
 *
 * Also handles the edge case where the model embeds its final answer inside
 * the `<think>` block with nothing after `</think>` — the last paragraph of
 * the thinking content is salvaged as the answer so the user always sees a
 * meaningful response.
 *
 * @param {string} text  Raw AI response that may contain a `<think>` block.
 * @returns {{ answer: string, thinkingContent: string|null }}
 *   `answer`          — text with all `<think>…</think>` blocks removed and trimmed.
 *   `thinkingContent` — the stripped reasoning text, or `null` when absent.
 */
export function extractThinkBlock(text) {
  if (!text) return { answer: text, thinkingContent: null };
  // Closed <think>…</think> block — strip all occurrences, capture first
  const match = text.match(/<think>([\s\S]*?)<\/think>/i);
  if (match) {
    let thinkingContent = match[1].trim() || null;
    let answer = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    // If nothing came after </think>, the model embedded the answer inside
    // the thinking block — salvage the final answer from there.
    if (!answer && thinkingContent) {
      ({ answer, thinkingContent } = _salvageAnswerFromThinking(thinkingContent));
    }
    return { answer, thinkingContent };
  }
  // Unclosed <think> tag — everything from the tag onward is thinking content
  const partialMatch = text.match(/([\s\S]*?)<think>([\s\S]*)/i);
  if (partialMatch) {
    let answer = partialMatch[1].trim();
    let thinkingContent = partialMatch[2].trim() || null;
    if (!answer && thinkingContent) {
      ({ answer, thinkingContent } = _salvageAnswerFromThinking(thinkingContent));
    }
    return { answer, thinkingContent };
  }
  return { answer: text, thinkingContent: null };
}

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

    // Auto-scroll every 10 words
    if (i % 10 === 0 && onScroll) onScroll();
  }

  // Final render to ensure the full text is complete and formatted
  // Skip if cancelled so only the partial text typed so far is shown
  if (!isCancelled?.()) {
    if (render) {
      element.innerHTML = render(fullText);
    } else {
      element.textContent = fullText;
    }
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
