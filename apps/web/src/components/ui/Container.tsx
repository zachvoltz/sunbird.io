import type { HTMLAttributes } from "react";

type Size = "sm" | "md" | "lg";

type Props = HTMLAttributes<HTMLDivElement> & {
  size?: Size;
};

const sizeClasses: Record<Size, string> = {
  sm: "max-w-[700px]",
  md: "max-w-[900px]",
  lg: "max-w-[1200px]",
};

export function Container({ size = "lg", className = "", children, ...props }: Props) {
  return (
    <div
      className={`mx-auto px-6 md:px-10 ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
