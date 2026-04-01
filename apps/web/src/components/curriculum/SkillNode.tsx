import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export type SkillNodeData = {
  title: string;
  description?: string;
  color?: string;
};

function SkillNodeComponent({ data, selected }: NodeProps) {
  const d = data as SkillNodeData;
  const color = d.color || "iris";

  const colorMap: Record<string, string> = {
    iris: "bg-iris",
    gold: "bg-gold",
    sage: "bg-sage",
    coral: "bg-coral",
  };

  return (
    <div
      className={`bg-surface rounded-card shadow-card w-48 overflow-hidden transition-shadow ${
        selected ? "ring-2 ring-iris shadow-elevated" : ""
      }`}
    >
      <Handle type="target" position={Position.Top} className="!bg-charcoal/30 !w-2 !h-2" />
      <div className={`h-1 ${colorMap[color] ?? "bg-iris"}`} />
      <div className="p-3">
        <p className="font-display text-sm font-semibold text-charcoal leading-tight">
          {d.title || "Untitled"}
        </p>
        {d.description && (
          <p className="text-[11px] text-text-secondary mt-1 line-clamp-2">
            {d.description}
          </p>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-charcoal/30 !w-2 !h-2" />
    </div>
  );
}

export const SkillNode = memo(SkillNodeComponent);
