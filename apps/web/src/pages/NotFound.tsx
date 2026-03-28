import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-6">
        Page not found
      </p>
      <h1 className="font-display text-6xl md:text-8xl font-bold mb-6">404</h1>
      <p className="text-text-secondary mb-2">
        This page doesn't exist.
      </p>
      <p className="text-text-secondary italic mb-10">
        Which, honestly, describes most first drafts.
      </p>
      <Link
        to="/"
        className="text-[13px] font-medium text-charcoal border border-charcoal px-6 py-2.5 hover:bg-charcoal hover:text-cream transition-all duration-300 tracking-wide"
      >
        Back to the beginning
      </Link>
    </div>
  );
}
