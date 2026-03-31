import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
};

export function Card({ interactive, className = "", children, ...props }: Props) {
  return (
    <div
      className={`bg-surface rounded-card shadow-card p-6 ${
        interactive ? "hover:shadow-elevated transition-shadow duration-300" : ""
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
