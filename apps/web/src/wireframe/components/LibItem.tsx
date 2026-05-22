import { Icon } from "./Icon";
import { Tag } from "./Tag";

type IconName = "play" | "pause" | "note" | "mic" | "record" | "fire" | "clock" | "chev" | "star" | "metro" | "plus" | "back" | "pin" | "headphones" | "send";

export function LibItem({
  icon,
  title,
  sub,
  tags = [],
  dragging,
}: {
  icon: IconName;
  title: string;
  sub: string;
  tags?: string[];
  dragging?: boolean;
}) {
  return (
    <div
      className="box small mb-2"
      style={{
        transform: dragging ? "rotate(-1deg) translateY(-2px)" : undefined,
        boxShadow: dragging ? "3px 3px 0 rgba(0,0,0,0.15)" : undefined,
      }}
    >
      <div className="row gap-3">
        <span className="drag-handle">⋮⋮</span>
        <Icon name={icon} size={16} />
        <div className="grow">
          <div className="bold">{title}</div>
          <div className="tiny muted">{sub}</div>
        </div>
        {tags.map((t) => <Tag key={t}>{t}</Tag>)}
      </div>
    </div>
  );
}
