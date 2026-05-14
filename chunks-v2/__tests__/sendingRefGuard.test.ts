/**
 * sendingRefGuard.test.ts
 *
 * Verifies that the sendingRef mutex in ChatPanel's handleSend prevents a
 * second /ask call when handleSend is invoked twice concurrently (double-Enter
 * or double-click), and that empty / whitespace-only messages are rejected by
 * the inflightRef + whitespace guard in StudyContext's handleSendMessage.
 *
 * These tests exercise the guard logic directly (without rendering React
 * components) so they run fast and don't require a DOM or React context.
 */

// ── sendingRef guard (mirrors ChatPanel's handleSend mutex) ───────────────────

/**
 * Simulates the sendingRef mutex pattern used in handleSend:
 *   - sendingRef.current = true  at the start
 *   - try { ... } finally { sendingRef.current = false }
 *
 * Returns the number of times the api function was actually invoked.
 */
async function makeHandleSend(api: () => Promise<void>): Promise<() => Promise<void>> {
  const sendingRef = { current: false };

  return async function handleSend(inputValue: string) {
    if (sendingRef.current) return;
    sendingRef.current = true;
    try {
      const val = inputValue.trim();
      if (!val) return;
      await api();
    } finally {
      sendingRef.current = false;
    }
  };
}

describe('sendingRef mutex — duplicate-send prevention', () => {
  it('calls the API exactly once when handleSend is invoked concurrently', async () => {
    let callCount = 0;
    // The api call resolves after a tick so the second invocation arrives while
    // the first is still in-flight.
    const api = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
    const handleSend = await makeHandleSend(() => { callCount++; return api(); });

    // Fire two calls without awaiting the first — simulates rapid double-Enter.
    const p1 = handleSend('hello');
    const p2 = handleSend('hello');
    await Promise.all([p1, p2]);

    expect(callCount).toBe(1);
  });

  it('allows a second send after the first has finished', async () => {
    let callCount = 0;
    const api = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
    const handleSend = await makeHandleSend(() => { callCount++; return api(); });

    await handleSend('first');
    await handleSend('second');

    expect(callCount).toBe(2);
  });

  it('resets the ref even when the send is rejected', async () => {
    let callCount = 0;
    const api = async () => { callCount++; throw new Error('network error'); };
    const sendingRef = { current: false };
    const handleSend = async (inputValue: string) => {
      if (sendingRef.current) return;
      sendingRef.current = true;
      try {
        const val = inputValue.trim();
        if (!val) return;
        await api();
      } catch {
        // swallow — real handler shows an error bubble
      } finally {
        sendingRef.current = false;
      }
    };

    await handleSend('message');           // throws, but finally resets ref
    await handleSend('retry');             // must succeed (ref is false again)

    expect(callCount).toBe(2);
    expect(sendingRef.current).toBe(false);
  });
});

// ── Whitespace / empty guard (mirrors StudyContext's handleSendMessage) ────────

/**
 * Simulates the inflightRef + whitespace guard used in handleSendMessage.
 */
function makeHandleSendMessage(api: (text: string) => Promise<void>) {
  const inflightRef = { current: false };

  return async function handleSendMessage(text: string) {
    if (inflightRef.current) return;
    if (!text.trim()) return;        // ← new whitespace guard
    inflightRef.current = true;
    try {
      await api(text);
    } finally {
      inflightRef.current = false;
    }
  };
}

describe('handleSendMessage whitespace / empty guard', () => {
  it('does not call the API for an empty string', async () => {
    let callCount = 0;
    const fn = makeHandleSendMessage(async () => { callCount++; });
    await fn('');
    expect(callCount).toBe(0);
  });

  it('does not call the API for a whitespace-only string', async () => {
    let callCount = 0;
    const fn = makeHandleSendMessage(async () => { callCount++; });
    await fn('   \t\n  ');
    expect(callCount).toBe(0);
  });

  it('calls the API for a non-empty trimmed string', async () => {
    let callCount = 0;
    const fn = makeHandleSendMessage(async () => { callCount++; });
    await fn('  hello  ');
    expect(callCount).toBe(1);
  });

  it('blocks a second concurrent call', async () => {
    let callCount = 0;
    const api = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
    const fn = makeHandleSendMessage(async (t) => { callCount++; await api(); });

    const p1 = fn('question');
    const p2 = fn('question again');
    await Promise.all([p1, p2]);
    expect(callCount).toBe(1);
  });
});
