import type { HTMLAttributes } from "react";

type Variant = "default" | "success" | "error" | "warning";

type Props = HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
};

const variantClasses: Record<Variant, string> = {
  default: "text-iris",
  success: "text-sage",
  error: "text-coral",
  warning: "text-gold",
};

export function Badge({ variant = "default", className = "", children, ...props }: Props) {
  return (
    <span
      className={`text-[11px] font-medium uppercase tracking-wider ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
