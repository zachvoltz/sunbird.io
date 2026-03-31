import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLHRElement>;

export function Divider({ className = "", ...props }: Props) {
  return (
    <hr className={`editorial-rule ${className}`} {...props} />
  );
}
