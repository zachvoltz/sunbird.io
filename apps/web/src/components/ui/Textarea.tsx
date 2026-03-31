import { forwardRef, type TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(
  ({ error, className = "", ...props }, ref) => {
    return (
      <div>
        <textarea
          ref={ref}
          className={`w-full border rounded-lg px-4 py-3 text-sm text-charcoal placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-charcoal/20 focus:border-charcoal transition-colors resize-none ${
            error ? "border-coral" : "border-warm-gray"
          } ${className}`}
          {...props}
        />
        {error && <p className="text-coral text-xs mt-1">{error}</p>}
      </div>
    );
  },
);
