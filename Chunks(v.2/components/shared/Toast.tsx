'use client';

import { useEffect, useRef } from 'react';

interface ToastProps {
  message: string | null;
}

/**
 * Controlled toast — shows when `message` is non-null.
 * Parent clears message after ~2.8 s to hide it.
 */
export default function Toast({ message }: ToastProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (message) {
      ref.current.classList.add('show');
    } else {
      ref.current.classList.remove('show');
    }
  }, [message]);

  return (
    <div ref={ref} className="notif-toast">
      {message ?? ''}
    </div>
  );
}
