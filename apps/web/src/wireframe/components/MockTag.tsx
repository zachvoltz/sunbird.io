// Small chip marking content that still needs a backend.

export function MockTag({ children = "needs backend" }: { children?: React.ReactNode }) {
  return (
    <span
      className="chip tiny"
      style={{
        background: "var(--paper)",
        borderColor: "var(--ink-faint)",
        borderStyle: "dashed",
        color: "var(--ink-faint)",
        fontFamily: "var(--mono)",
        fontSize: 10,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
      }}
      title="placeholder content — wire to API later"
    >
      ✦ {children}
    </span>
  );
}

export function MockBanner() {
  return (
    <div
      className="box small"
      style={{
        borderStyle: "dashed",
        borderColor: "var(--ink-faint)",
        background: "var(--paper)",
        color: "var(--ink-soft)",
        fontFamily: "var(--mono)",
        fontSize: 11,
        marginBottom: 10,
        padding: "6px 10px",
      }}
    >
      <span style={{ color: "var(--ink-faint)" }}>✦ DESIGN PREVIEW</span>{" "}
      Sections marked <MockTag>needs backend</MockTag> show static placeholder content. The
      backend models for assignments, takes, structured notes, AI summary, voice memos, and
      streaks haven't been built yet.
    </div>
  );
}
