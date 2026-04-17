'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — catches render errors in the subtree and shows a fallback UI
 * instead of crashing the entire app. Wrap each tab or panel independently so
 * a broken tab doesn't take down the sidebar or topbar.
 *
 * Must be a class component — hooks cannot catch render errors.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error.message, info.componentStack);
    // TODO: Report to Sentry: Sentry.captureException(error, { extra: info })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            padding: 32,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            color: 'var(--text2)',
            fontSize: 14,
          }}
        >
          <span style={{ fontSize: 36 }}>⚠️</span>
          <strong style={{ fontSize: 15, color: 'var(--text)' }}>Something went wrong</strong>
          <p style={{ margin: 0, color: 'var(--text3)', textAlign: 'center', maxWidth: 320 }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="ws-add-btn"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </button>
            <button
              className="ws-add-btn"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
