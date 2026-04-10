import { useEffect, useRef } from 'react';

/**
 * useAutoScroll — smoothly scrolls a sentinel element into view whenever
 * the provided dependencies change (e.g. a new message arrives).
 *
 * Returns a ref to attach to the sentinel `<div>` at the bottom of the
 * scrollable list. Extracted from ChatPanel to keep the component clean.
 *
 * @example
 * const sentinelRef = useAutoScroll([messages, isTyping]);
 * return (
 *   <div className="chat-messages">
 *     {messages.map(...)}
 *     <div ref={sentinelRef} />
 *   </div>
 * );
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useAutoScroll(deps: any[]) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sentinelRef.current?.scrollIntoView({ behavior: 'smooth' });
    // deps array is intentionally spread — consumer controls when to scroll
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return sentinelRef;
}
