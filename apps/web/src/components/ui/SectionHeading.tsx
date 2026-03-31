import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLHeadingElement> & {
  as?: "h1" | "h2" | "h3";
};

export function SectionHeading({ as: Tag = "h2", className = "", children, ...props }: Props) {
  return (
    <Tag
      className={`text-[11px] font-medium uppercase tracking-[0.15em] text-text-secondary mb-4 ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
}
