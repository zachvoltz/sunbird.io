// Standard "something went wrong" UI for failed data fetches, with an optional
// retry. Two variants: inline (a small banner inside a section) and block (a
// centered panel for a whole page/section).
export function ErrorState({
  message = "Something went wrong while loading this.",
  onRetry,
  variant = "block",
  className = "",
}: {
  message?: string;
  onRetry?: () => void;
  variant?: "block" | "inline";
  className?: string;
}) {
  if (variant === "inline") {
    return (
      <div className={`bg-coral/10 border border-coral/30 text-coral text-sm px-4 py-3 rounded-card ${className}`}>
        {message}
        {onRetry && (
          <button onClick={onRetry} className="ml-2 underline font-medium hover:no-underline">
            retry
          </button>
        )}
      </div>
    );
  }
  return (
    <div className={`flex flex-col items-center justify-center text-center gap-3 py-12 px-6 ${className}`}>
      <p className="text-sm text-text-secondary max-w-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-[13px] font-medium text-charcoal border border-charcoal/20 px-5 py-2 rounded-full hover:border-charcoal/50 hover:bg-charcoal hover:text-cream transition-all"
        >
          Try again
        </button>
      )}
    </div>
  );
}
