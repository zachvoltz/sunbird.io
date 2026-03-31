import { forwardRef, type InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ error, className = "", ...props }, ref) => {
    return (
      <div>
        <input
          ref={ref}
          className={`w-full border rounded-lg px-4 py-2.5 text-sm text-charcoal placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-charcoal/20 focus:border-charcoal transition-colors ${
            error ? "border-coral" : "border-warm-gray"
          } ${className}`}
          {...props}
        />
        {error && <p className="text-coral text-xs mt-1">{error}</p>}
      </div>
    );
  },
);
