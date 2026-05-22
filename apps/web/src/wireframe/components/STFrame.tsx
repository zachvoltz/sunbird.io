import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

type NavId = "home" | "practice" | "lessons" | "notes" | "takes" | "curriculum" | "profile";

const NAV: Array<{ id: NavId; label: string; icon: string; to: string }> = [
  { id: "home", label: "Today", icon: "⌂", to: "/today" },
  { id: "practice", label: "Practice", icon: "♪", to: "/practice" },
  { id: "lessons", label: "Lessons", icon: "♬", to: "/my-bookings" },
  { id: "notes", label: "Journal", icon: "✎", to: "/my-notes" },
  { id: "takes", label: "My takes", icon: "⌥", to: "/my-takes" },
  { id: "curriculum", label: "Curriculum", icon: "▦", to: "/my-curriculum" },
  { id: "profile", label: "Profile", icon: "☻", to: "/my-profile" },
];

function STTopBar({ collapsed, onToggleSide }: { collapsed: boolean; onToggleSide: () => void }) {
  const { user, logout } = useAuth();
  const initial = user?.name?.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="dt-topbar">
      <button
        className="btn icon"
        onClick={onToggleSide}
        title={collapsed ? "expand sidebar" : "collapse sidebar"}
        style={{ width: 30, height: 30, padding: 0, fontSize: 14, border: 0, background: "transparent" }}
      >
        {collapsed ? "☰" : "〈"}
      </button>
      <Link to="/my-bookings" className="dt-brand">
        <span className="bird">♪</span>
        {!collapsed && (
          <>
            sunbird{" "}
            <span className="muted small" style={{ fontWeight: 400, marginLeft: 4 }}>
              / practice
            </span>
          </>
        )}
      </Link>
      <div className="dt-search">
        <span>⌕</span>
        <span>search your lessons, notes, takes…</span>
        <span className="kbd" style={{ marginLeft: "auto" }}>⌘K</span>
      </div>
      <div className="grow" />
      <Link to="/book" className="btn small primary">＋ book a lesson</Link>
      <button
        className="btn small ghost"
        onClick={() => logout()}
        title="sign out"
      >
        sign out
      </button>
      <div className="wf-avatar" title={user?.name ?? "you"}>{initial}</div>
    </div>
  );
}

function STSidebar({ on, collapsed }: { on: NavId; collapsed: boolean }) {
  return (
    <div className={"dt-side" + (collapsed ? " collapsed" : "")}>
      {NAV.map((n) => (
        <Link
          key={n.id}
          to={n.to}
          className={"item" + (n.id === on ? " on" : "")}
          title={n.label}
        >
          <span style={{ width: 18, textAlign: "center", flex: "0 0 18px" }}>{n.icon}</span>
          {!collapsed && <span>{n.label}</span>}
        </Link>
      ))}
    </div>
  );
}

export function STFrame({
  side = "home",
  children,
}: {
  side?: NavId;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const loc = useLocation();
  // If caller didn't pass a side, infer from the path.
  const inferred: NavId =
    side !== "home"
      ? side
      : loc.pathname.startsWith("/today")
      ? "home"
      : loc.pathname.startsWith("/practice")
      ? "practice"
      : loc.pathname.startsWith("/my-notes")
      ? "notes"
      : loc.pathname.startsWith("/my-takes")
      ? "takes"
      : loc.pathname.startsWith("/my-curriculum")
      ? "curriculum"
      : loc.pathname.startsWith("/my-profile")
      ? "profile"
      : loc.pathname.startsWith("/my-bookings")
      ? "lessons"
      : "home";
  return (
    <div className="wireframe-root" style={{ height: "100vh", overflow: "hidden" }}>
      <div
        className="dt"
        style={{ gridTemplateColumns: (collapsed ? "56px" : "220px") + " 1fr" }}
      >
        <STTopBar collapsed={collapsed} onToggleSide={() => setCollapsed((c) => !c)} />
        <STSidebar on={inferred} collapsed={collapsed} />
        <div className="dt-main">{children}</div>
      </div>
    </div>
  );
}
