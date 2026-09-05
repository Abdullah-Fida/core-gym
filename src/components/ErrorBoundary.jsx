import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Button from './ui/Button';

/**
 * Top-level crash screen.
 *
 * The previous version rendered a raw `#fee2e2` panel with a 🚨 emoji and the
 * full monospace stack trace — a debugging artifact that real users would see
 * in production. The stack is now kept for the console and hidden behind a
 * details disclosure in development only.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // TODO: forward to an error reporter once one is configured.
    console.error('[Batgos] Unhandled error', error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-danger-soft text-danger mb-5">
            <AlertTriangle className="size-7" aria-hidden="true" />
          </div>

          <h1 className="text-xl font-bold text-heading font-display">Something went wrong</h1>
          <p className="text-sm text-muted mt-2">
            The page failed to load. Reloading usually fixes it — if it keeps happening, contact support.
          </p>

          <div className="flex gap-2 justify-center mt-6">
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="size-4" aria-hidden="true" />
              Reload
            </Button>
            <Button variant="secondary" onClick={() => { window.location.href = '/'; }}>
              Go home
            </Button>
          </div>

          {import.meta.env.DEV && (
            <details className="mt-8 text-left">
              <summary className="text-xs text-muted cursor-pointer">Technical details (dev only)</summary>
              <pre className="mt-2 p-3 rounded-lg bg-surface-2 border border-line text-[0.6875rem] text-body overflow-auto max-h-64 whitespace-pre-wrap">
                {error.stack || error.message}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
