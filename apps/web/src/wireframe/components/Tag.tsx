export function Tag({ children, color }: {
  children: React.ReactNode;
  color?: "coral" | "yellow";
}) {
  return (
    <span className="chip tiny" style={{
      background: color === "coral" ? "var(--accent-soft)" : color === "yellow" ? "var(--highlight)" : "var(--paper)",
      borderColor: color === "coral" ? "var(--accent)" : "var(--ink)",
      color: color === "coral" ? "var(--accent)" : "var(--ink)",
    }}>
      {children}
    </span>
  );
}
