import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useSidebarStudents } from "../hooks/useSidebarStudents";
import { useAuth } from "@/context/AuthContext";
import { TopSearch } from "./TopSearch";
import { UiSettings } from "./UiSettings";
import { InviteStudentModal } from "./InviteStudentModal";
import { Icon } from "./Icon";
import { apiFetch, conversationsApi } from "@/lib/api";
import { useIsMobile } from "../hooks/useIsMobile";

// Sum of unread direct messages across all of the caller's conversations,
// for the sidebar's Messages badge. Refetches on route change and when the
// thread fires `sunbird:inbox-viewed` after clearing a conversation's unread.
function useMessagesUnread(): number {
  const [count, setCount] = useState(0);
  const params = useParams();
  useEffect(() => {
    let cancelled = false;
    const refetch = () => {
      conversationsApi
        .list()
        .then((items) => {
          if (!cancelled) setCount(items.reduce((n, c) => n + c.unreadCount, 0));
        })
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

// Unread incoming SessionMessages for the calling coach. Used to
// render the sidebar's Inbox badge. Refetches:
//   - on every route change (DTFrame re-mounts per page),
//   - when the Inbox page fires `sunbird:inbox-viewed` so the badge
//     clears immediately on open instead of waiting for the next nav.
function useInboxCount(): number {
  const [count, setCount] = useState(0);
  const params = useParams();
  useEffect(() => {
    let cancelled = false;
    const refetch = () => {
      apiFetch<{ data: { count: number } }>("/api/coaches/inbox-count")
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

export type SidebarStudent = {
  id: string;
  n: string;
  dot?: boolean;
  today?: boolean;
  when: string;
  // "PENDING" entries are invited students who haven't logged in yet — they
  // render gray and link to the invite status page (by inviteId) rather than a
  // real student page. Active students omit these / use "ACTIVE".
  status?: "ACTIVE" | "PENDING";
  inviteId?: string;
};

function DTTopBar({
  live = false,
  collapsed = false,
  onToggleSide,
}: {
  live?: boolean;
  collapsed: boolean;
  onToggleSide: () => void;
}) {
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
      <Link to="/coach/roster" className="dt-brand">
        <span className="bird">♪</span>
        {!collapsed && (
          <>
            sunbird{" "}
            <span className="muted small" style={{ fontWeight: 400, marginLeft: 4 }}>
              / teach
            </span>
          </>
        )}
      </Link>
      <TopSearch placeholder="jump to student, path, lesson…" />
      <div className="grow" />
      {live && (
        <div
          className="chip"
          style={{ background: "var(--accent)", color: "white", borderColor: "var(--accent)" }}
        >
          ● live lesson
        </div>
      )}
      <button className="btn small ghost">＋ new</button>
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

function DTSidebar({
  on,
  collapsed,
  students,
}: {
  on: string;
  collapsed: boolean;
  students: SidebarStudent[];
}) {
  const params = useParams<{ studentId?: string; inviteId?: string }>();
  const inboxCount = useInboxCount();
  const messagesUnread = useMessagesUnread();
  const [inviteOpen, setInviteOpen] = useState(false);
  return (
    <div className={"dt-side" + (collapsed ? " collapsed" : "")}>
      {inviteOpen && <InviteStudentModal onClose={() => setInviteOpen(false)} />}
      <Link to="/coach/roster" className={"item" + (on === "roster" ? " on" : "")} title="Today">
        <span className="nav-ico"><Icon name="home" size={18} /></span>
        {!collapsed && <span>Today</span>}
      </Link>
      <Link
        to="/coach/inbox"
        className={"item" + (on === "inbox" ? " on" : "")}
        title={inboxCount > 0 ? `Inbox (${inboxCount})` : "Inbox"}
      >
        <span className="nav-ico"><Icon name="inbox" size={18} /></span>
        {!collapsed && (
          <>
            <span>Inbox</span>
            {inboxCount > 0 && (
              <span
                className="chip tiny"
                style={{ marginLeft: "auto", padding: "0 6px", fontSize: 10, color: "var(--ink)" }}
              >
                {inboxCount}
              </span>
            )}
          </>
        )}
        {collapsed && inboxCount > 0 && (
          <span className="dot" style={{ position: "absolute", top: 6, right: 6, marginLeft: 0 }}/>
        )}
      </Link>
      <Link
        to="/messages"
        className={"item" + (on === "messages" ? " on" : "")}
        title={messagesUnread > 0 ? `Messages (${messagesUnread})` : "Messages"}
      >
        <span className="nav-ico"><Icon name="send" size={18} /></span>
        {!collapsed && (
          <>
            <span>Messages</span>
            {messagesUnread > 0 && (
              <span
                className="chip tiny"
                style={{ marginLeft: "auto", padding: "0 6px", fontSize: 10, color: "var(--ink)" }}
              >
                {messagesUnread}
              </span>
            )}
          </>
        )}
        {collapsed && messagesUnread > 0 && (
          <span className="dot" style={{ position: "absolute", top: 6, right: 6, marginLeft: 0 }}/>
        )}
      </Link>
      <Link to="/coach/calendar" className={"item" + (on === "calendar" ? " on" : "")} title="Calendar">
        <span className="nav-ico"><Icon name="cal" size={18} /></span>
        {!collapsed && <span>Calendar</span>}
      </Link>
      <Link to="/coach/library" className={"item" + (on === "library" ? " on" : "")} title="Library">
        <span className="nav-ico"><Icon name="lib" size={18} /></span>
        {!collapsed && <span>Library</span>}
      </Link>
      <Link to="/coach/payments" className={"item" + (on === "payments" ? " on" : "")} title="Payments">
        <span className="nav-ico"><Icon name="money" size={18} /></span>
        {!collapsed && <span>Payments</span>}
      </Link>
      <Link to="/coach/profile" className={"item" + (on === "profile" ? " on" : "")} title="Profile">
        <span className="nav-ico"><Icon name="profile" size={18} /></span>
        {!collapsed && <span>Profile</span>}
      </Link>
      <Link to="/coach/account" className={"item" + (on === "account" ? " on" : "")} title="Account">
        <span className="nav-ico"><Icon name="user" size={18} /></span>
        {!collapsed && <span>Account</span>}
      </Link>

      {!collapsed && (
        <div className="sec-label row between" style={{ alignItems: "center" }}>
          <span>STUDENTS · {students.length}</span>
          <button
            onClick={() => setInviteOpen(true)}
            title="Invite a student"
            aria-label="Invite a student"
            style={{
              border: 0,
              background: "transparent",
              cursor: "pointer",
              color: "var(--ink-faint)",
              fontSize: 16,
              lineHeight: 1,
              padding: "0 2px",
            }}
          >
            ＋
          </button>
        </div>
      )}
      {collapsed && (
        <div className="sec-label" style={{ textAlign: "center", padding: "10px 0 4px" }}>—</div>
      )}

      {students.map((s) => {
        const pending = s.status === "PENDING";
        const isCurrent = pending
          ? on === "invite" && params.inviteId === s.inviteId
          : on === "student" && params.studentId === s.id;
        return (
          <Link
            key={s.id}
            to={pending ? `/coach/invite/${s.inviteId}` : `/coach/student/${s.id}`}
            className={"item" + (isCurrent ? " on" : "")}
            title={pending ? `${s.n} — invited` : s.n}
            style={pending ? { opacity: 0.55 } : undefined}
          >
            <span className="avatar">{s.n[0]}</span>
            {!collapsed && (
              <>
                <span
                  style={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >{s.n}</span>
                {s.dot && !s.today && <span className="dot" style={{ marginLeft: 4 }}/>}
                <span
                  style={{
                    marginLeft: "auto",
                    flex: "0 0 auto",
                    fontSize: 10,
                    fontFamily: "var(--hand)",
                    color: s.today ? "var(--accent)" : "var(--ink-faint)",
                    opacity: s.today ? 0.95 : 0.6,
                    paddingLeft: 6,
                  }}
                >{s.when}</span>
              </>
            )}
            {collapsed && s.today && (
              <span style={{
                position: "absolute", top: 2, right: 2,
                width: 8, height: 8, borderRadius: "50%",
                background: "var(--highlight)", border: "1.5px solid var(--ink)",
              }}/>
            )}
            {collapsed && s.dot && !s.today && (
              <span className="dot" style={{ position: "absolute", top: 2, right: 2, marginLeft: 0 }}/>
            )}
          </Link>
        );
      })}
      <UiSettings collapsed={collapsed} />
    </div>
  );
}

export function DTFrame({
  side = "roster",
  live = false,
  students,
  children,
}: {
  side?: string;
  live?: boolean;
  students?: SidebarStudent[];
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const isMobile = useIsMobile(900);
  const loc = useLocation();
  useEffect(() => {
    setNavOpen(false);
  }, [loc.pathname]);
  const onToggleSide = () => (isMobile ? setNavOpen((o) => !o) : setCollapsed((c) => !c));
  const fetched = useSidebarStudents();
  // Caller-supplied list wins; otherwise show the cached real-data list, or
  // an empty array while the first fetch is in flight.
  const resolved = students ?? fetched ?? [];
  return (
    <div className="wireframe-root dt-shell">
      <div className={"dt" + (collapsed ? " dt--collapsed" : "") + (navOpen ? " dt--nav-open" : "")}>
        <DTTopBar live={live} collapsed={collapsed} onToggleSide={onToggleSide} />
        <DTSidebar on={side} collapsed={collapsed} students={resolved} />
        {navOpen && <div className="dt-nav-backdrop" onClick={() => setNavOpen(false)} />}
        <div className="dt-main">{children}</div>
      </div>
    </div>
  );
}

