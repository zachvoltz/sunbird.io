import { forwardRef, type SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  error?: string;
};

export const Select = forwardRef<HTMLSelectElement, Props>(
  ({ error, className = "", children, ...props }, ref) => {
    return (
      <div>
        <select
          ref={ref}
          className={`w-full border rounded-lg px-4 py-2.5 text-sm text-charcoal bg-surface focus:outline-none focus:ring-2 focus:ring-charcoal/20 focus:border-charcoal transition-colors ${
            error ? "border-coral" : "border-warm-gray"
          } ${className}`}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-coral text-xs mt-1">{error}</p>}
      </div>
    );
  },
);
