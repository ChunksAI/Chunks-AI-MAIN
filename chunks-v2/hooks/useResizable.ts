'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseResizableOptions {
  initialPct?: number;
  minPct?: number;
  maxPct?: number;
}

/**
 * Drives the drag-to-resize split panel.
 * Returns the current percentage width for the left panel,
 * and refs/handlers to wire up to the resizer element.
 */
export function useResizable({
  initialPct = 42,
  minPct = 25,
  maxPct = 65,
}: UseResizableOptions = {}) {
  const [pct, setPct] = useState(initialPct);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const raw = ((e.clientX - rect.left) / rect.width) * 100;
      setPct(Math.min(maxPct, Math.max(minPct, raw)));
    };

    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [minPct, maxPct]);

  return { pct, containerRef, onMouseDown };
}
