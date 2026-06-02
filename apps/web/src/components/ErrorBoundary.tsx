import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "@/lib/reportError";

// Catches render-time errors anywhere below it, reports them, and shows a
// friendly fallback instead of a blank white screen.
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, { source: "boundary", info: info.componentStack ?? undefined });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h1 className="font-display text-2xl font-bold text-charcoal mb-3">
            Something went wrong
          </h1>
          <p className="text-sm text-text-secondary mb-6">
            The page hit an unexpected error. Reloading usually fixes it — if it
            keeps happening, let us know.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-[13px] font-medium text-cream bg-charcoal px-6 py-2.5 rounded-full hover:bg-ink transition-all"
          >
            Reload the page
          </button>
        </div>
      </div>
    );
  }
}
