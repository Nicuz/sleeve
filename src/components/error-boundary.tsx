import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui] uncaught render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-16">
        <div className="panel max-w-md p-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-red-400/20 bg-red-500/10 text-red-300">
            <AlertTriangle size={22} />
          </span>
          <h1 className="mt-4 font-display text-xl font-semibold text-cream">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Sleeve hit an unexpected error. Your collection is safe; reload to continue.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-xl border border-white/10 bg-ink-950/60 p-3 text-left text-[10px] text-muted">
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn btn-primary mt-5"
          >
            <RotateCcw size={15} />
            Reload
          </button>
        </div>
      </div>
    );
  }
}
