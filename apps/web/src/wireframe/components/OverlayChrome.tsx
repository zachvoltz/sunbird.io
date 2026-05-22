import type { CSSProperties, ReactNode } from "react";

export function OverlayChrome({
  title,
  right,
  children,
  style,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        background: "transparent",
        border: "1.5px solid var(--ink)",
        borderRadius: 14,
        boxShadow: "3px 4px 0 rgba(0,0,0,0.18)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        className="row between"
        style={{
          padding: "8px 12px",
          borderBottom: "1.5px dashed var(--ink)",
          background: "rgba(251,248,241,0.78)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          flex: "0 0 auto",
        }}
      >
        <div className="row gap-2" style={{ alignItems: "center" }}>
          <span className="drag-handle" style={{ fontSize: 11 }}>⋮⋮</span>
          <span className="wf-scrawl bold" style={{ fontSize: 17 }}>{title}</span>
        </div>
        <div className="row gap-1" style={{ alignItems: "center" }}>
          {right}
          <button className="btn icon" style={{ width: 22, height: 22, fontSize: 11, padding: 0 }}>−</button>
          <button className="btn icon" style={{ width: 22, height: 22, fontSize: 11, padding: 0 }}>×</button>
        </div>
      </div>
      <div
        style={{
          flex: "1 1 auto",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
