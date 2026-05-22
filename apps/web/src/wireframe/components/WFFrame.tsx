function StatusBar({ time = "9:41" }: { time?: string }) {
  return (
    <div className="wf-status">
      <span>{time}</span>
      <span className="dots">• • •</span>
      <span>⌁ 87%</span>
    </div>
  );
}

const NAV_ITEMS = [
  { id: "home", label: "Home", ico: "⌂" },
  { id: "practice", label: "Practice", ico: "♪" },
  { id: "notes", label: "Notes", ico: "✎" },
  { id: "you", label: "You", ico: "☻" },
] as const;

function BottomNav({ active = "practice" }: { active?: string }) {
  return (
    <div className="wf-nav">
      {NAV_ITEMS.map((n) => (
        <div key={n.id} className={"navitem" + (n.id === active ? " active" : "")}>
          <div className="ico">{n.ico}</div>
          <div>{n.label}</div>
        </div>
      ))}
    </div>
  );
}

export function WFFrame({
  children,
  statusTime,
  navActive,
}: {
  children: React.ReactNode;
  statusTime?: string;
  navActive?: string;
}) {
  return (
    <div className="wireframe-root" style={{ minHeight: "100vh" }}>
      <div className="wf">
        <StatusBar time={statusTime} />
        {children}
        <BottomNav active={navActive} />
      </div>
    </div>
  );
}
