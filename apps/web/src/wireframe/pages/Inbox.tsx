import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DTFrame } from "../components/DTFrame";
import { WFFrame } from "../components/WFFrame";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { Squiggle } from "../components/Squiggle";
import { useIsMobile } from "../hooks/useIsMobile";
import { apiFetch } from "@/lib/api";

type InboxItem = {
  id: string;
  bookingId: string;
  content: string;
  createdAt: string;
  unread: boolean;
  sender: { id: string; name: string; avatarUrl: string | null };
  booking: {
    id: string;
    startsAt: string;
    category: { title: string } | null;
    student: { id: string; name: string } | null;
  };
};

type Filter = "all" | "unread";

function useInbox() {
  const [items, setItems] = useState<InboxItem[] | undefined>();
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    apiFetch<{ data: { items: InboxItem[] } }>("/api/coaches/inbox")
      .then((r) => setItems(r.data.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // Optimistic local toggle so the checkbox feels instant; the
  // backend write is fire-and-forget but errors surface via alert.
  const setRead = useCallback(async (id: string, read: boolean) => {
    setItems((prev) =>
      prev ? prev.map((it) => (it.id === id ? { ...it, unread: !read } : it)) : prev,
    );
    try {
      await apiFetch(`/api/coaches/inbox/${id}/read`, {
        method: read ? "POST" : "DELETE",
      });
      window.dispatchEvent(new Event("sunbird:inbox-viewed"));
    } catch (err: any) {
      // Roll back and tell the user.
      setItems((prev) =>
        prev ? prev.map((it) => (it.id === id ? { ...it, unread: read } : it)) : prev,
      );
      window.alert(err?.body?.error ?? "Couldn't update read state");
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((prev) => (prev ? prev.map((it) => ({ ...it, unread: false })) : prev));
    try {
      await apiFetch("/api/coaches/inbox-viewed", { method: "POST" });
      window.dispatchEvent(new Event("sunbird:inbox-viewed"));
    } catch (err: any) {
      window.alert(err?.body?.error ?? "Couldn't mark all read");
      refresh();
    }
  }, [refresh]);

  return { items, loading, setRead, markAllRead };
}

function relativeTime(iso: string, now: number): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function InboxEmpty({ what }: { what: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 12,
        padding: "40px 24px",
        color: "var(--ink-soft)",
      }}
    >
      <svg width="120" height="84" viewBox="0 0 120 84" fill="none" aria-hidden>
        <rect x="8" y="14" width="104" height="60" rx="6"
          stroke="var(--ink)" strokeWidth="2" fill="var(--paper)" />
        <path d="M 10 18 L 60 50 L 110 18"
          stroke="var(--ink)" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
        <path d="M 12 70 L 46 44" stroke="var(--ink-faint)" strokeWidth="1.2" fill="none" />
        <path d="M 108 70 L 74 44" stroke="var(--ink-faint)" strokeWidth="1.2" fill="none" />
      </svg>
      <div className="wf-scrawl bold" style={{ fontSize: 24, color: "var(--ink)" }}>
        {what}
      </div>
      <Squiggle w={90} color="var(--ink-faint)" />
      <div className="small muted" style={{ maxWidth: 360 }}>
        Booking notifications, voice memos from parents, and take submissions will
        land here. Nothing new right now.
      </div>
      <div className="row gap-2 mt-3">
        <Link to="/coach" className="btn small">back to today</Link>
        <Link to="/coach/library" className="btn small ghost">open library</Link>
      </div>
    </div>
  );
}

function InboxRow({
  item,
  now,
  onToggleRead,
}: {
  item: InboxItem;
  now: number;
  onToggleRead: (id: string, read: boolean) => void;
}) {
  const studentName = item.booking.student?.name ?? item.sender.name;
  const category = item.booking.category?.title;
  const lessonAt = new Date(item.booking.startsAt).toLocaleDateString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <div
      className={"box small row gap-3" + (item.unread ? " accent" : "")}
      style={{
        borderWidth: item.unread ? 2 : 1.5,
        position: "relative",
        padding: 12,
      }}
    >
      {/* Read checkbox — wrapped so clicks don't bubble to the row link. */}
      <label
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          flex: "0 0 auto",
          paddingTop: 2,
        }}
        title={item.unread ? "mark read" : "mark unread"}
      >
        <input
          type="checkbox"
          checked={!item.unread}
          onChange={(e) => onToggleRead(item.id, e.target.checked)}
          style={{ width: 16, height: 16, accentColor: "var(--accent)" }}
        />
      </label>

      <Link
        to={`/coach/session/${item.bookingId}`}
        className="row gap-3 grow"
        style={{ textDecoration: "none", color: "inherit", minWidth: 0 }}
      >
        <Avatar name={studentName} size={36} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="row gap-2" style={{ alignItems: "baseline" }}>
            <span className="bold">{studentName}</span>
            {item.unread && (
              <span
                className="chip tiny"
                style={{
                  background: "var(--accent)",
                  color: "var(--paper)",
                  borderColor: "var(--accent)",
                  padding: "0 6px",
                  fontSize: 9,
                }}
              >
                new
              </span>
            )}
            <span className="grow" />
            <span className="tiny muted">{relativeTime(item.createdAt, now)}</span>
          </div>
          <div className="small" style={{ marginTop: 2, whiteSpace: "pre-wrap" }}>
            {item.content}
          </div>
          <div className="tiny muted" style={{ marginTop: 4 }}>
            {category ? `${category} · ` : ""}
            {lessonAt}
          </div>
        </div>
        <Icon name="chev" size={11} />
      </Link>
    </div>
  );
}

function InboxDesktop() {
  const { items, loading, setRead, markAllRead } = useInbox();
  const [filter, setFilter] = useState<Filter>("all");
  const now = Date.now();

  const visible = useMemo(() => {
    if (!items) return [];
    if (filter === "unread") return items.filter((i) => i.unread);
    return items;
  }, [items, filter]);

  const unreadCount = useMemo(() => (items ?? []).filter((i) => i.unread).length, [items]);

  return (
    <DTFrame side="inbox">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Inbox</h2>
          <div className="dt-sub">
            Messages, booking notifications, and updates from your students.
          </div>
        </div>
        <div className="row gap-2">
          <div className="pill-row">
            <span
              className={"p" + (filter === "all" ? " on" : "")}
              onClick={() => setFilter("all")}
              style={{ cursor: "pointer" }}
            >
              all{items ? ` · ${items.length}` : ""}
            </span>
            <span
              className={"p" + (filter === "unread" ? " on" : "")}
              onClick={() => setFilter("unread")}
              style={{ cursor: "pointer" }}
            >
              unread{unreadCount > 0 ? ` · ${unreadCount}` : ""}
            </span>
          </div>
          <button
            className="btn small ghost"
            onClick={markAllRead}
            disabled={unreadCount === 0}
            title={unreadCount === 0 ? "nothing to mark" : "mark every item read"}
          >
            mark all read
          </button>
        </div>
      </div>

      <div className="dt-main-body">
        <div className="panel" style={{ height: "100%" }}>
          <div className="panel-body scroll col gap-2" style={{ padding: 14 }}>
            {loading && !items && (
              <div className="small muted" style={{ padding: 20 }}>loading inbox…</div>
            )}
            {!loading && (items?.length ?? 0) === 0 && (
              <InboxEmpty what="Inbox is quiet." />
            )}
            {!loading && items && items.length > 0 && visible.length === 0 && (
              <div className="small muted" style={{ padding: 20, textAlign: "center" }}>
                No unread items — switch to <b>all</b> above to see everything.
              </div>
            )}
            {visible.map((item) => (
              <InboxRow key={item.id} item={item} now={now} onToggleRead={setRead} />
            ))}
          </div>
        </div>
      </div>
    </DTFrame>
  );
}

function InboxMobile() {
  const { items, loading, setRead, markAllRead } = useInbox();
  const now = Date.now();
  const unreadCount = (items ?? []).filter((i) => i.unread).length;

  return (
    <WFFrame navActive="notes">
      <div className="wf-header">
        <div>
          <h2 className="wf-title">Inbox</h2>
          <div className="wf-subtitle">messages &amp; bookings</div>
        </div>
        <Link to="/coach" className="btn icon ghost"><Icon name="back" size={14} /></Link>
      </div>
      <div className="wf-body col gap-3 scroll-y" style={{ alignItems: "stretch" }}>
        {!loading && unreadCount > 0 && (
          <button className="btn small ghost" onClick={markAllRead} style={{ alignSelf: "flex-end" }}>
            mark all read
          </button>
        )}
        {loading && !items && (
          <div className="small muted center" style={{ padding: 20 }}>loading…</div>
        )}
        {!loading && (items?.length ?? 0) === 0 && (
          <div className="box dashed" style={{ paddingBottom: 24 }}>
            <InboxEmpty what="Inbox is quiet." />
          </div>
        )}
        {(items ?? []).map((item) => (
          <InboxRow key={item.id} item={item} now={now} onToggleRead={setRead} />
        ))}
      </div>
    </WFFrame>
  );
}

export function InboxPage() {
  const isMobile = useIsMobile();
  return isMobile ? <InboxMobile /> : <InboxDesktop />;
}
