import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  // Email-style selection — a set of selected item ids, independent of
  // read/unread state. Bulk actions (mark read/unread) act on this set.
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const refresh = useCallback(() => {
    setLoading(true);
    apiFetch<{ data: { items: InboxItem[] } }>("/api/coaches/inbox")
      .then((r) => setItems(r.data.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  // Write read state for one or many items at once. Optimistic so it feels
  // instant; rolls back (via refresh) if any write fails.
  const setReadMany = useCallback(async (ids: string[], read: boolean) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    setItems((prev) =>
      prev ? prev.map((it) => (idSet.has(it.id) ? { ...it, unread: !read } : it)) : prev,
    );
    try {
      await Promise.all(
        ids.map((id) => apiFetch(`/api/coaches/inbox/${id}/read`, { method: read ? "POST" : "DELETE" })),
      );
      window.dispatchEvent(new Event("sunbird:inbox-viewed"));
    } catch (err: any) {
      window.alert(err?.body?.error ?? "Couldn't update read state");
      refresh();
    }
  }, [refresh]);

  const setRead = useCallback((id: string, read: boolean) => setReadMany([id], read), [setReadMany]);

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

  // ── selection helpers ──
  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const selectExactly = useCallback((ids: string[]) => setSelected(new Set(ids)), []);
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  return {
    items, loading, selected,
    setRead, setReadMany, markAllRead,
    toggleSelect, selectExactly, clearSelection,
  };
}

// Email-inbox "time" column: hour for today, weekday for this week,
// date otherwise — mirrors Gmail / Apple Mail conventions.
function inboxTime(iso: string, now: number): string {
  const d = new Date(iso);
  const sameDay = new Date(now).toDateString() === d.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  const diffDays = Math.floor((now - d.getTime()) / 86_400_000);
  if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: "short" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

type InboxBucket = "Today" | "Yesterday" | "This week" | "Earlier";
const BUCKET_ORDER: InboxBucket[] = ["Today", "Yesterday", "This week", "Earlier"];

function inboxBucket(iso: string, now: number): InboxBucket {
  const d = new Date(iso);
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const t = d.getTime();
  if (t >= todayStart.getTime()) return "Today";
  if (t >= todayStart.getTime() - 86_400_000) return "Yesterday";
  if (t >= todayStart.getTime() - 7 * 86_400_000) return "This week";
  return "Earlier";
}

function groupByBucket(items: InboxItem[], now: number): Array<[InboxBucket, InboxItem[]]> {
  const map = new Map<InboxBucket, InboxItem[]>();
  for (const it of items) {
    const k = inboxBucket(it.createdAt, now);
    const arr = map.get(k) ?? [];
    arr.push(it);
    map.set(k, arr);
  }
  return BUCKET_ORDER.filter((k) => map.has(k)).map((k) => [k, map.get(k)!]);
}

// Checkbox that supports the "some but not all" indeterminate state — used
// for the email-style select-all in the toolbar.
function TriCheckbox({
  checked, indeterminate, onChange, title,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  title?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked;
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      title={title}
      style={{ width: 15, height: 15, accentColor: "var(--accent)", cursor: "pointer" }}
    />
  );
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
        <Link to="/coach/roster" className="btn small">back to today</Link>
        <Link to="/coach/library" className="btn small ghost">open library</Link>
      </div>
    </div>
  );
}

function InboxRow({
  item,
  now,
  selected,
  onToggleSelect,
  onToggleRead,
  onOpen,
}: {
  item: InboxItem;
  now: number;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleRead: (id: string, read: boolean) => void;
  onOpen: (item: InboxItem) => void;
}) {
  const studentName = item.booking.student?.name ?? item.sender.name;
  const category = item.booking.category?.title;
  const snippet = item.content.replace(/\s+/g, " ").trim();
  const lessonAt = new Date(item.booking.startsAt).toLocaleDateString([], {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  return (
    <div
      className={"inbox-row" + (item.unread ? " unread" : "") + (selected ? " selected" : "")}
      title={`${studentName} · ${lessonAt}`}
    >
      <label className="ibx-check" title={selected ? "deselect" : "select"}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(item.id)}
          style={{ width: 15, height: 15, accentColor: "var(--accent)" }}
        />
      </label>
      {/* The body navigates (and marks the message read, like opening an
          email). The checkbox and read-dot stay outside it so they toggle
          state instead of navigating. */}
      <Link
        to={`/coach/session/${item.bookingId}`}
        className="ibx-row-link"
        onClick={() => onOpen(item)}
      >
        <Avatar name={studentName} size={28} />
        <span className="ibx-sender">{studentName}</span>
        <span className="ibx-snippet">
          {category && <span className="ibx-tag">[{category}]</span>}
          {snippet}
        </span>
        <span className="ibx-when">{inboxTime(item.createdAt, now)}</span>
      </Link>
      <button
        type="button"
        className="ibx-dot"
        onClick={() => onToggleRead(item.id, item.unread)}
        title={item.unread ? "mark as read" : "mark as unread"}
        aria-label={item.unread ? "mark as read" : "mark as unread"}
      />
    </div>
  );
}

// The email-style action bar: a select-all checkbox plus either the filter
// pills (nothing selected) or bulk read actions (one or more selected).
function InboxToolbar({
  allSelected,
  someSelected,
  selectedCount,
  onToggleAll,
  onMarkSelectedRead,
  onMarkSelectedUnread,
  onClearSelection,
  filter,
  setFilter,
  total,
  unreadCount,
}: {
  allSelected: boolean;
  someSelected: boolean;
  selectedCount: number;
  onToggleAll: () => void;
  onMarkSelectedRead: () => void;
  onMarkSelectedUnread: () => void;
  onClearSelection: () => void;
  filter: Filter;
  setFilter: (f: Filter) => void;
  total: number;
  unreadCount: number;
}) {
  return (
    <div className="inbox-toolbar">
      <label className="ibx-check" title={allSelected ? "deselect all" : "select all"}>
        <TriCheckbox checked={allSelected} indeterminate={someSelected} onChange={onToggleAll} />
      </label>
      {selectedCount > 0 ? (
        <>
          <span className="small" style={{ fontWeight: 600 }}>{selectedCount} selected</span>
          <button className="btn small ghost" onClick={onMarkSelectedRead}>mark read</button>
          <button className="btn small ghost" onClick={onMarkSelectedUnread}>mark unread</button>
          <span className="tb-spacer" />
          <button className="btn small ghost" onClick={onClearSelection}>cancel</button>
        </>
      ) : (
        <div className="pill-row">
          <span
            className={"p" + (filter === "all" ? " on" : "")}
            onClick={() => setFilter("all")}
            style={{ cursor: "pointer" }}
          >
            all{` · ${total}`}
          </span>
          <span
            className={"p" + (filter === "unread" ? " on" : "")}
            onClick={() => setFilter("unread")}
            style={{ cursor: "pointer" }}
          >
            unread{unreadCount > 0 ? ` · ${unreadCount}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}

function InboxList({
  items, now, selected, onToggleSelect, onToggleRead, onOpen,
}: {
  items: InboxItem[];
  now: number;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleRead: (id: string, read: boolean) => void;
  onOpen: (item: InboxItem) => void;
}) {
  return (
    <div className="inbox-list">
      {groupByBucket(items, now).map(([label, rows]) => (
        <div key={label} className="inbox-group">
          <div className="inbox-day-label">{label}</div>
          {rows.map((item) => (
            <InboxRow
              key={item.id}
              item={item}
              now={now}
              selected={selected.has(item.id)}
              onToggleSelect={onToggleSelect}
              onToggleRead={onToggleRead}
              onOpen={onOpen}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function InboxDesktop() {
  const {
    items, loading, selected,
    setRead, setReadMany, markAllRead,
    toggleSelect, selectExactly, clearSelection,
  } = useInbox();
  const [filter, setFilter] = useState<Filter>("all");
  const now = Date.now();

  const visible = useMemo(() => {
    if (!items) return [];
    if (filter === "unread") return items.filter((i) => i.unread);
    return items;
  }, [items, filter]);

  const unreadCount = useMemo(() => (items ?? []).filter((i) => i.unread).length, [items]);

  // Selection is scoped to what's visible under the current filter.
  const visibleIds = useMemo(() => visible.map((i) => i.id), [visible]);
  const selectedVisible = useMemo(
    () => visibleIds.filter((id) => selected.has(id)),
    [visibleIds, selected],
  );
  const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
  const someSelected = selectedVisible.length > 0;

  const toggleAll = () => (allSelected ? clearSelection() : selectExactly(visibleIds));
  const markSelectedRead = () => { setReadMany(selectedVisible, true); clearSelection(); };
  const markSelectedUnread = () => { setReadMany(selectedVisible, false); clearSelection(); };
  // Opening a message marks it read, like an email client.
  const openItem = (item: InboxItem) => { if (item.unread) setRead(item.id, true); };

  return (
    <DTFrame side="inbox">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Inbox</h2>
          <div className="dt-sub">
            Messages, booking notifications, and updates from your students.
          </div>
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

      <div className="dt-main-body">
        <div className="panel" style={{ height: "100%", padding: 0 }}>
          <div className="panel-body scroll" style={{ padding: 0 }}>
            {!loading && (items?.length ?? 0) > 0 && (
              <InboxToolbar
                allSelected={allSelected}
                someSelected={someSelected}
                selectedCount={selectedVisible.length}
                onToggleAll={toggleAll}
                onMarkSelectedRead={markSelectedRead}
                onMarkSelectedUnread={markSelectedUnread}
                onClearSelection={clearSelection}
                filter={filter}
                setFilter={(f) => { setFilter(f); clearSelection(); }}
                total={items?.length ?? 0}
                unreadCount={unreadCount}
              />
            )}
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
            {visible.length > 0 && (
              <InboxList
                items={visible}
                now={now}
                selected={selected}
                onToggleSelect={toggleSelect}
                onToggleRead={setRead}
                onOpen={openItem}
              />
            )}
          </div>
        </div>
      </div>
    </DTFrame>
  );
}

function InboxMobile() {
  const {
    items, loading, selected,
    setRead, setReadMany, markAllRead,
    toggleSelect, selectExactly, clearSelection,
  } = useInbox();
  const now = Date.now();
  const unreadCount = (items ?? []).filter((i) => i.unread).length;

  const allItems = items ?? [];
  const visibleIds = allItems.map((i) => i.id);
  const selectedVisible = visibleIds.filter((id) => selected.has(id));
  const allSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
  const someSelected = selectedVisible.length > 0;

  const toggleAll = () => (allSelected ? clearSelection() : selectExactly(visibleIds));
  const markSelectedRead = () => { setReadMany(selectedVisible, true); clearSelection(); };
  const markSelectedUnread = () => { setReadMany(selectedVisible, false); clearSelection(); };
  const openItem = (item: InboxItem) => { if (item.unread) setRead(item.id, true); };

  return (
    <WFFrame navActive="notes">
      <div className="wf-header">
        <div>
          <h2 className="wf-title">Inbox</h2>
          <div className="wf-subtitle">messages &amp; bookings</div>
        </div>
        <Link to="/coach/roster" className="btn icon ghost"><Icon name="back" size={14} /></Link>
      </div>
      <div className="wf-body col scroll-y" style={{ alignItems: "stretch", padding: 0 }}>
        {loading && !items && (
          <div className="small muted center" style={{ padding: 20 }}>loading…</div>
        )}
        {!loading && allItems.length === 0 && (
          <InboxEmpty what="Inbox is quiet." />
        )}
        {allItems.length > 0 && (
          <>
            <div className="inbox-toolbar">
              <label className="ibx-check" title={allSelected ? "deselect all" : "select all"}>
                <TriCheckbox checked={allSelected} indeterminate={someSelected} onChange={toggleAll} />
              </label>
              {someSelected ? (
                <>
                  <span className="small" style={{ fontWeight: 600 }}>{selectedVisible.length} selected</span>
                  <button className="btn small ghost" onClick={markSelectedRead}>read</button>
                  <button className="btn small ghost" onClick={markSelectedUnread}>unread</button>
                  <span className="tb-spacer" />
                  <button className="btn small ghost" onClick={clearSelection}>cancel</button>
                </>
              ) : (
                <>
                  <span className="small muted">{allItems.length} message{allItems.length === 1 ? "" : "s"}</span>
                  <span className="tb-spacer" />
                  <button className="btn small ghost" onClick={markAllRead} disabled={unreadCount === 0}>
                    mark all read
                  </button>
                </>
              )}
            </div>
            <InboxList
              items={allItems}
              now={now}
              selected={selected}
              onToggleSelect={toggleSelect}
              onToggleRead={setRead}
              onOpen={openItem}
            />
          </>
        )}
      </div>
    </WFFrame>
  );
}

export function InboxPage() {
  const isMobile = useIsMobile();
  return isMobile ? <InboxMobile /> : <InboxDesktop />;
}
