'use client';

import { useState } from 'react';
import { useStudy } from '@/contexts/StudyContext';
import type { ChatMessage } from '@/types';

interface MessageActionsProps {
  msg: ChatMessage;
  onRetry?: () => void;
}

/**
 * MessageActions — row of small action buttons rendered below every AI message.
 *
 *  • 📋 Copy  — copies msg.text (markdown) to clipboard
 *  • ↻ Retry  — re-sends the last user message; or calls onRetry when provided
 *  • 👍 / 👎  — feedback (shows a thank-you toast, no-op beyond that)
 */
export default function MessageActions({ msg, onRetry }: MessageActionsProps) {
  const { state, handleSendMessage, dispatch } = useStudy();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(msg.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      dispatch({ type: 'SHOW_TOAST', payload: 'Copy failed — please copy manually.' });
    }
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else if (state.lastUserMessage) {
      void handleSendMessage(state.lastUserMessage);
    }
  };

  const handleFeedback = (positive: boolean) => {
    dispatch({
      type: 'SHOW_TOAST',
      payload: positive ? '👍 Thanks for the feedback!' : '👎 Thanks for the feedback!',
    });
  };

  return (
    <div className="msg-actions">
      <button
        className="msg-action-btn"
        onClick={() => void handleCopy()}
        title={copied ? 'Copied!' : 'Copy to clipboard'}
      >
        {copied ? '✓ Copied!' : '📋 Copy'}
      </button>
      <button
        className="msg-action-btn"
        onClick={handleRetry}
        title="Retry this response"
        disabled={!onRetry && !state.lastUserMessage}
      >
        ↻ Retry
      </button>
      <button
        className="msg-action-btn"
        onClick={() => handleFeedback(true)}
        title="Good response"
      >
        👍
      </button>
      <button
        className="msg-action-btn"
        onClick={() => handleFeedback(false)}
        title="Bad response"
      >
        👎
      </button>
    </div>
  );
}
