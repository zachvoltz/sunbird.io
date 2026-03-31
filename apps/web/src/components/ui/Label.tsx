import type { LabelHTMLAttributes } from "react";

type Props = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className = "", children, ...props }: Props) {
  return (
    <label
      className={`block text-sm font-medium text-charcoal mb-1.5 ${className}`}
      {...props}
    >
      {children}
    </label>
  );
}
