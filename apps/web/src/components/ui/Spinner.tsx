// The app's standard loading spinner. Consolidates the inline
// `border-2 … animate-spin` div that was copy-pasted across ~10 pages.
export function Spinner({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{ width: size, height: size, borderWidth: Math.max(2, Math.round(size / 12)) }}
      className={`border-charcoal/20 border-t-charcoal rounded-full animate-spin ${className}`}
    />
  );
}

// Centered spinner for full-section / full-page loading.
export function LoadingState({ className = "min-h-[40vh]" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Spinner />
    </div>
  );
}
