import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const variantClasses: Record<Variant, string> = {
  primary:
    "text-cream bg-iris hover:bg-iris-hover",
  outline:
    "text-charcoal border border-charcoal hover:bg-charcoal hover:text-cream",
  ghost:
    "text-text-secondary hover:text-charcoal",
};

const sizeClasses: Record<Size, string> = {
  sm: "text-[12px] px-4 py-1.5",
  md: "text-[13px] px-5 py-2.5",
  lg: "text-[14px] px-6 py-3",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  children,
  ...props
}: Props) {
  return (
    <button
      className={`font-medium tracking-wide rounded-card transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
