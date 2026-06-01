import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { TopSearch } from "./TopSearch";
import { UiSettings } from "./UiSettings";
import { Icon } from "./Icon";
import { useIsMobile } from "../hooks/useIsMobile";

type NavId = "home" | "practice" | "calendar" | "lessons" | "inbox" | "notes" | "goals" | "takes" | "curriculum" | "profile";
type NavIcon = "home" | "note" | "cal" | "cap" | "inbox" | "journal" | "star" | "mic" | "map" | "user";

const NAV: Array<{ id: NavId; label: string; icon: NavIcon; to: string }> = [
  { id: "home", label: "Today", icon: "home", to: "/today" },
  { id: "practice", label: "Practice", icon: "note", to: "/practice" },
  { id: "calendar", label: "Calendar", icon: "cal", to: "/my-calendar" },
  { id: "lessons", label: "Lessons", icon: "cap", to: "/my-bookings" },
  { id: "inbox", label: "Inbox", icon: "inbox", to: "/my-inbox" },
  { id: "notes", label: "Journal", icon: "journal", to: "/my-notes" },
  { id: "goals", label: "Goals", icon: "star", to: "/my-goals" },
  { id: "takes", label: "My takes", icon: "mic", to: "/my-takes" },
  { id: "curriculum", label: "Curriculum", icon: "map", to: "/my-curriculum" },
  { id: "profile", label: "Profile", icon: "user", to: "/my-profile" },
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
            <span className="nav-ico"><Icon name={n.icon} size={18} /></span>
            {!collapsed && (
              <>
                <span>{n.label}</span>
                {showBadge && (
                  <span
                    className="chip tiny"
                    style={{ marginLeft: "auto", padding: "0 6px", fontSize: 10, color: "var(--ink)" }}
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
      <UiSettings collapsed={collapsed} />
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
  const [navOpen, setNavOpen] = useState(false);
  const isMobile = useIsMobile(900);
  const loc = useLocation();
  // Close the mobile tray on navigation.
  useEffect(() => {
    setNavOpen(false);
  }, [loc.pathname]);
  // The topbar toggle opens the pull-out tray on mobile, or collapses the
  // rail on desktop.
  const onToggleSide = () => (isMobile ? setNavOpen((o) => !o) : setCollapsed((c) => !c));
  // If caller didn't pass a side, infer from the path.
  const inferred: NavId =
    side !== "home"
      ? side
      : loc.pathname.startsWith("/today")
      ? "home"
      : loc.pathname.startsWith("/practice")
      ? "practice"
      : loc.pathname.startsWith("/my-calendar")
      ? "calendar"
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
    <div className="wireframe-root dt-shell">
      <div className={"dt" + (collapsed ? " dt--collapsed" : "") + (navOpen ? " dt--nav-open" : "")}>
        <STTopBar collapsed={collapsed} onToggleSide={onToggleSide} />
        <STSidebar on={inferred} collapsed={collapsed} />
        {navOpen && <div className="dt-nav-backdrop" onClick={() => setNavOpen(false)} />}
        <div className="dt-main">{children}</div>
      </div>
    </div>
  );
}
