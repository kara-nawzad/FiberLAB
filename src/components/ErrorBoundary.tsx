import { Component, type ErrorInfo, type ReactNode } from 'react';

/* ========================================================================== *
 * ErrorBoundary — the last line of defence against a white screen.
 *
 * A render/lifecycle throw anywhere below the workbench unmounts React's tree
 * and leaves an empty page, which looks like a broken deploy. This boundary
 * catches that, keeps the FiberLAB branding on screen and offers one clear way
 * forward: reload. The same component also reports the failure through
 * `onError`, so a host can log it without the UI depending on a service.
 *
 * Note: boundaries only catch throws during rendering, in constructors and in
 * lifecycle methods. Errors thrown inside event handlers, timers or promises
 * never reach them — those are logged by `main.tsx`'s window listeners instead.
 * ========================================================================== */

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional reporter (console by default) — keep it side-effect free. */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error, info);
      return;
    }
    // Keep the stack in the console so a field report can be diagnosed.
    console.error('FiberLAB crashed while rendering:', error, info.componentStack);
  }

  private reload = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  private retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="fl-crash" role="alert" aria-live="assertive">
        <div className="fl-crash-card">
          <span className="fl-crash-mark" aria-hidden="true">
            <svg viewBox="0 0 64 64" width="40" height="40" focusable="false">
              <rect width="64" height="64" rx="14" fill="currentColor" />
              <path
                d="M12 44h10l6-24 6 24h18"
                fill="none"
                stroke="#fff4e6"
                strokeWidth="4.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>

          <p className="fl-crash-eyebrow">Workbench interrupted</p>
          <h1 className="fl-crash-title">
            Fiber<b>LAB</b> hit an unexpected error
          </h1>
          <p className="fl-crash-copy">
            Your design is kept in this browser session, so reloading the workbench is safe. If it happens again, note
            what you were doing and send it to the project’s issue tracker.
          </p>

          <pre className="fl-crash-detail" aria-label="Error detail">
            {error.message || String(error)}
          </pre>

          <div className="fl-crash-actions">
            <button type="button" className="pu-btn pri" onClick={this.reload} autoFocus>
              Reload Workbench
            </button>
            <button type="button" className="pu-btn" onClick={this.retry}>
              Try again without reloading
            </button>
            <a
              className="pu-btn"
              href="https://github.com/kara-nawzad/FiberLAB/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              Report an issue
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
