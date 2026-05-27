import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { TopSearch } from "./TopSearch";

type NavId = "home" | "practice" | "lessons" | "inbox" | "notes" | "takes" | "curriculum" | "profile";

const NAV: Array<{ id: NavId; label: string; icon: string; to: string }> = [
  { id: "home", label: "Today", icon: "⌂", to: "/today" },
  { id: "practice", label: "Practice", icon: "♪", to: "/practice" },
  { id: "lessons", label: "Lessons", icon: "♬", to: "/my-bookings" },
  { id: "inbox", label: "Inbox", icon: "✉", to: "/my-inbox" },
  { id: "notes", label: "Journal", icon: "✎", to: "/my-notes" },
  { id: "takes", label: "My takes", icon: "⌥", to: "/my-takes" },
  { id: "curriculum", label: "Curriculum", icon: "▦", to: "/my-curriculum" },
  { id: "profile", label: "Profile", icon: "☻", to: "/my-profile" },
];

// Same shape as DTFrame's useInboxCount, just pointed at /api/me.
// Refetches on route change and on the "sunbird:inbox-viewed" event
// that MyInbox dispatches when the user opens the inbox.
function useInboxCount(): number {
  const [count, setCount] = useState(0);
  const params = useParams();
  useEffect(() => {
    let cancelled = false;
    const refetch = () => {
      apiFetch<{ data: { count: number } }>("/api/me/inbox-count")
        .then((r) => { if (!cancelled) setCount(r.data.count); })
        .catch(() => { /* leave at last known */ });
    };
    refetch();
    window.addEventListener("sunbird:inbox-viewed", refetch);
    return () => {
      cancelled = true;
      window.removeEventListener("sunbird:inbox-viewed", refetch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);
  return count;
}

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
      <TopSearch placeholder="jump to coach, lesson, note…" />
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
  const inboxCount = useInboxCount();
  return (
    <div className={"dt-side" + (collapsed ? " collapsed" : "")}>
      {NAV.map((n) => {
        const isInbox = n.id === "inbox";
        const showBadge = isInbox && inboxCount > 0;
        return (
          <Link
            key={n.id}
            to={n.to}
            className={"item" + (n.id === on ? " on" : "")}
            title={showBadge ? `${n.label} (${inboxCount})` : n.label}
          >
            <span style={{ width: 18, textAlign: "center", flex: "0 0 18px" }}>{n.icon}</span>
            {!collapsed && (
              <>
                <span>{n.label}</span>
                {showBadge && (
                  <span
                    className="chip tiny"
                    style={{ marginLeft: "auto", padding: "0 6px", fontSize: 10 }}
                  >
                    {inboxCount}
                  </span>
                )}
              </>
            )}
            {collapsed && showBadge && (
              <span className="dot" style={{ position: "absolute", top: 6, right: 6, marginLeft: 0 }}/>
            )}
          </Link>
        );
      })}
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
      : loc.pathname.startsWith("/my-inbox")
      ? "inbox"
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
