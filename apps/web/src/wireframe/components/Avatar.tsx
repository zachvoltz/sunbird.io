export function Avatar({ name = "?", size = 36, bg }: {
  name?: string; size?: number; bg?: string;
}) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      border: "1.5px solid var(--ink)",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: bg || "var(--paper-2)",
      fontFamily: "var(--scrawl)",
      fontSize: size * 0.5,
      flex: "0 0 auto",
    }}>
      {name[0]}
    </div>
  );
}
