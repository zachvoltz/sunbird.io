import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { BookingPublic, CoachBusyPublic, CoachAvailabilitySlot } from "@sunbird/shared";
import { apiFetch } from "@/lib/api";
import { DTFrame } from "../components/DTFrame";
import { WFFrame } from "../components/WFFrame";
import { Icon } from "../components/Icon";
import { Avatar } from "../components/Avatar";
import { Tag } from "../components/Tag";
import { Squiggle } from "../components/Squiggle";
import { useIsMobile } from "../hooks/useIsMobile";
import { useNow } from "../hooks/useNow";

// Coach edit modes for the week grid.
//   view   — read-only (default)
//   hours  — toggle recurring weekly availability per hour
//   busy   — click an hour to create a 1-hour date-specific busy block;
//            click an existing block to delete it
type EditMode = "view" | "hours" | "busy";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS: number[] = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const HOUR_PX = 44;
const START_HOUR = HOURS[0];
const END_HOUR = HOURS[HOURS.length - 1];

type ViewMode = "week" | "list" | "month";

// ── date helpers ─────────────────────────────────────────
function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function mondayOf(d: Date): Date {
  const out = startOfDay(d);
  const day = out.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  out.setDate(out.getDate() + offset);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatHour(h: number): string {
  const period = h < 12 ? "a" : "p";
  const display = h === 12 ? 12 : h > 12 ? h - 12 : h;
  return `${display}${period}`;
}

// ── color palette per status ─────────────────────────────
const STATUS_COLOR: Record<string, { bg: string; border: string; text: string }> = {
  CONFIRMED: {
    bg: "var(--accent-soft)",
    border: "var(--accent)",
    text: "var(--accent)",
  },
  COMPLETED: {
    bg: "var(--paper-2)",
    border: "var(--ink)",
    text: "var(--ink-soft)",
  },
  CANCELLED: {
    bg: "var(--paper)",
    border: "var(--ink-faint)",
    text: "var(--ink-faint)",
  },
  NO_SHOW: {
    bg: "var(--paper)",
    border: "var(--ink-faint)",
    text: "var(--ink-faint)",
  },
};

// ── grid event positioning ───────────────────────────────
type PositionedEvent = {
  booking: BookingPublic;
  top: number;
  height: number;
};

function placeEvent(b: BookingPublic): PositionedEvent | null {
  const start = new Date(b.startsAt);
  const end = new Date(b.endsAt);
  const startHour = start.getHours() + start.getMinutes() / 60;
  const endHour = end.getHours() + end.getMinutes() / 60;
  if (endHour <= START_HOUR || startHour >= END_HOUR + 1) return null;
  const clampedStart = Math.max(startHour, START_HOUR);
  const clampedEnd = Math.min(endHour, END_HOUR + 1);
  const top = (clampedStart - START_HOUR) * HOUR_PX;
  const height = Math.max(20, (clampedEnd - clampedStart) * HOUR_PX);
  return { booking: b, top, height };
}

// ──────────────────────────────────────────────────────────
// Desktop view
// ──────────────────────────────────────────────────────────
// Build a Set<string> keyed "day-hour" (day 0=Mon..6=Sun, hour 0-23) from
// the server's CoachAvailabilitySlot[] (which uses dayOfWeek where 0=Sun).
function availabilityToKeys(slots: CoachAvailabilitySlot[]): Set<string> {
  const keys = new Set<string>();
  for (const s of slots) {
    if (!s.isActive) continue;
    // server day: 0=Sun..6=Sat; UI day: 0=Mon..6=Sun
    const uiDay = (s.dayOfWeek + 6) % 7;
    const [hStr] = s.startTime.split(":");
    const hour = Number(hStr);
    if (Number.isFinite(hour)) keys.add(`${uiDay}-${hour}`);
  }
  return keys;
}

function keysToSlots(keys: Set<string>): Array<{ dayOfWeek: number; startTime: string; endTime: string }> {
  const out: Array<{ dayOfWeek: number; startTime: string; endTime: string }> = [];
  for (const k of keys) {
    const [uiDayStr, hStr] = k.split("-");
    const uiDay = Number(uiDayStr);
    const hour = Number(hStr);
    if (!Number.isFinite(uiDay) || !Number.isFinite(hour)) continue;
    // back to server convention (0=Sun)
    const dayOfWeek = (uiDay + 1) % 7;
    const startTime = `${String(hour).padStart(2, "0")}:00`;
    const endHour = (hour + 1) % 24;
    const endTime = `${String(endHour).padStart(2, "0")}:00`;
    out.push({ dayOfWeek, startTime, endTime });
  }
  return out;
}

function CalendarDesktop({ bookings, loading }: { bookings: BookingPublic[]; loading: boolean }) {
  const now = useNow(60_000);
  const [view, setView] = useState<ViewMode>("week");
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(now));
  const [editMode, setEditMode] = useState<EditMode>("view");

  // Availability: local Set<"day-hour"> + dirty tracker + saving state.
  const [availKeys, setAvailKeys] = useState<Set<string>>(new Set());
  const [savedAvailKeys, setSavedAvailKeys] = useState<Set<string>>(new Set());
  const [savingAvail, setSavingAvail] = useState(false);

  // Busy blocks — date-specific, fetched for a wide window so navigation
  // between weeks doesn't refetch.
  const [busy, setBusy] = useState<CoachBusyPublic[]>([]);

  // Google Calendar shadow events (pulled from the coach's connected
  // Google primary calendar). Rendered alongside Sunbird busy blocks
  // with a distinct visual treatment.
  type GoogleShadow = { id: string; summary: string | null; startsAt: string; endsAt: string };
  const [googleShadows, setGoogleShadows] = useState<GoogleShadow[]>([]);
  const [googleStatus, setGoogleStatus] = useState<{
    connected: boolean;
    lastSyncedAt: string | null;
  }>({ connected: false, lastSyncedAt: null });
  const [googleSyncing, setGoogleSyncing] = useState(false);

  // Load availability + busy on mount.
  useEffect(() => {
    apiFetch<{ data: { availability: CoachAvailabilitySlot[] } }>("/api/coach-settings")
      .then((res) => {
        const keys = availabilityToKeys(res.data.availability ?? []);
        setAvailKeys(keys);
        setSavedAvailKeys(keys);
      })
      .catch(() => {});
  }, []);

  const refreshBusy = useCallback(() => {
    apiFetch<{ data: CoachBusyPublic[] }>("/api/coach-busy")
      .then((res) => setBusy(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => { refreshBusy(); }, [refreshBusy]);

  const refreshGoogleStatus = useCallback(() => {
    apiFetch<{ data: { connected: boolean; lastSyncedAt: string | null } }>(
      "/api/calendar/google/status",
    )
      .then((r) => setGoogleStatus(r.data))
      .catch(() => { /* leave at last known */ });
  }, []);
  const refreshGoogleShadows = useCallback(() => {
    apiFetch<{ data: GoogleShadow[] }>("/api/calendar/google/events")
      .then((r) => setGoogleShadows(r.data))
      .catch(() => setGoogleShadows([]));
  }, []);

  useEffect(() => { refreshGoogleStatus(); }, [refreshGoogleStatus]);
  useEffect(() => { refreshGoogleShadows(); }, [refreshGoogleShadows]);

  // If we just returned from the Google OAuth flow, run an immediate
  // sync so the user sees their events without an extra click.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gcal") === "connected") {
      setGoogleSyncing(true);
      apiFetch("/api/calendar/google/sync", { method: "POST" })
        .then(() => {
          refreshGoogleStatus();
          refreshGoogleShadows();
        })
        .catch(() => { /* surfaced via status */ })
        .finally(() => setGoogleSyncing(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncGoogle = useCallback(async () => {
    if (googleSyncing) return;
    setGoogleSyncing(true);
    try {
      await apiFetch("/api/calendar/google/sync", { method: "POST" });
      refreshGoogleStatus();
      refreshGoogleShadows();
    } catch (err: any) {
      window.alert(err?.body?.error ?? "Couldn't sync with Google.");
    } finally {
      setGoogleSyncing(false);
    }
  }, [googleSyncing, refreshGoogleShadows, refreshGoogleStatus]);

  const disconnectGoogle = useCallback(async () => {
    if (!window.confirm("Disconnect Google Calendar? Inbound events will be removed.")) return;
    try {
      await apiFetch("/api/calendar/google/disconnect", { method: "POST" });
      setGoogleShadows([]);
      refreshGoogleStatus();
    } catch (err: any) {
      window.alert(err?.body?.error ?? "Couldn't disconnect.");
    }
  }, [refreshGoogleStatus]);

  const availDirty = useMemo(() => {
    if (availKeys.size !== savedAvailKeys.size) return true;
    for (const k of availKeys) if (!savedAvailKeys.has(k)) return true;
    return false;
  }, [availKeys, savedAvailKeys]);

  const toggleAvailHour = useCallback((uiDay: number, hour: number) => {
    setAvailKeys((prev) => {
      const next = new Set(prev);
      const key = `${uiDay}-${hour}`;
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const saveAvailability = useCallback(async () => {
    setSavingAvail(true);
    try {
      await apiFetch("/api/coach-settings/availability", {
        method: "PUT",
        body: JSON.stringify({ slots: keysToSlots(availKeys) }),
      });
      setSavedAvailKeys(new Set(availKeys));
    } catch {}
    finally { setSavingAvail(false); }
  }, [availKeys]);

  const addBusyAt = useCallback(async (date: Date, hour: number) => {
    const start = new Date(date);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    try {
      await apiFetch<{ data: CoachBusyPublic }>("/api/coach-busy", {
        method: "POST",
        body: JSON.stringify({
          startsAt: start.toISOString(),
          endsAt: end.toISOString(),
        }),
      });
      refreshBusy();
    } catch {}
  }, [refreshBusy]);

  const removeBusy = useCallback(async (id: string) => {
    try {
      await apiFetch(`/api/coach-busy/${id}`, { method: "DELETE" });
      setBusy((prev) => prev.filter((b) => b.id !== id));
    } catch {}
  }, []);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const weekBookings = useMemo(
    () =>
      bookings.filter((b) => {
        const t = new Date(b.startsAt);
        return t >= weekStart && t < addDays(weekStart, 7);
      }),
    [bookings, weekStart],
  );

  const weekLabel = useMemo(() => {
    const end = addDays(weekStart, 6);
    const fmt = (d: Date) => d.toLocaleDateString([], { month: "short", day: "numeric" });
    return `${fmt(weekStart)} – ${end.getDate()}`;
  }, [weekStart]);

  const monthLabel = weekStart.toLocaleDateString([], { month: "long", year: "numeric" });
  const isThisWeek = sameDay(weekStart, mondayOf(now));

  return (
    <DTFrame side="calendar">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Calendar</h2>
          <div className="dt-sub">
            {monthLabel} · {weekBookings.length} session{weekBookings.length === 1 ? "" : "s"} this week
            {editMode === "hours" && <> · <span style={{ color: "var(--accent)" }}>click hours to mark when you're open</span></>}
            {editMode === "busy" && <> · <span style={{ color: "var(--accent)" }}>click any hour to block it out</span></>}
          </div>
        </div>
        <div className="row gap-2">
          <button className="btn small ghost" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            ← prev
          </button>
          <button
            className="btn small"
            onClick={() => setWeekStart(mondayOf(new Date()))}
            disabled={isThisWeek}
            style={isThisWeek ? { opacity: 0.6 } : undefined}
          >
            this week
          </button>
          <button className="btn small ghost" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            next →
          </button>
          <div className="pill-row" style={{ marginLeft: 8 }}>
            <span
              className={"p" + (view === "week" ? " on" : "")}
              onClick={() => setView("week")}
            >
              week
            </span>
            <span
              className={"p" + (view === "month" ? " on" : "")}
              onClick={() => setView("month")}
            >
              month
            </span>
            <span
              className={"p" + (view === "list" ? " on" : "")}
              onClick={() => setView("list")}
            >
              list
            </span>
          </div>
          {/* Edit-mode pill — only meaningful on the week view */}
          {view === "week" && (
            <div className="pill-row" style={{ marginLeft: 4 }}>
              <span className={"p" + (editMode === "view" ? " on" : "")} onClick={() => setEditMode("view")}>
                view
              </span>
              <span className={"p" + (editMode === "hours" ? " on" : "")} onClick={() => setEditMode("hours")}>
                hours
              </span>
              <span className={"p" + (editMode === "busy" ? " on" : "")} onClick={() => setEditMode("busy")}>
                busy
              </span>
            </div>
          )}
          {editMode === "hours" && view === "week" && (
            <button
              className="btn small primary"
              onClick={saveAvailability}
              disabled={!availDirty || savingAvail}
              style={!availDirty ? { opacity: 0.5 } : undefined}
            >
              {savingAvail ? "saving…" : availDirty ? "save hours" : "saved"}
            </button>
          )}
          {/* Google Calendar connect / sync. The connect button is a
              full-page redirect (anchor, not button) so the OAuth flow
              works without preflight CORS. */}
          {googleStatus.connected ? (
            <div className="row gap-2" style={{ alignItems: "center", marginLeft: 4 }}>
              <span
                className="chip tiny"
                style={{ background: "#e6f1e9", borderColor: "#4a8a5a", color: "#2f6a3f" }}
                title={googleStatus.lastSyncedAt ?? undefined}
              >
                ● Google synced
              </span>
              <button
                className="btn small ghost"
                onClick={syncGoogle}
                disabled={googleSyncing}
              >
                {googleSyncing ? "syncing…" : "sync now"}
              </button>
              <button className="btn small ghost" onClick={disconnectGoogle}>
                disconnect
              </button>
            </div>
          ) : (
            <a
              className="btn small"
              href="/api/calendar/google/connect"
              style={{ marginLeft: 4 }}
            >
              connect Google ↗
            </a>
          )}
        </div>
      </div>

      <div className="dt-main-body">
        <div className="panel" style={{ height: "100%" }}>
          <div className="panel-head">
            <div className="row gap-3">
              <div className="panel-title">{weekLabel}</div>
              {loading && <span className="small muted">loading…</span>}
            </div>
            <div className="row gap-2 small muted">
              <span><LegendDot color="var(--accent)" /> confirmed</span>
              <span><LegendDot color="var(--ink)" /> completed</span>
              <span><LegendDot color="var(--ink-faint)" /> cancelled</span>
              <span><LegendDot color="var(--accent)" /> busy</span>
            </div>
          </div>
          <div className="panel-body scroll">
            {view === "week" && (
              <WeekGrid
                days={days}
                bookings={weekBookings}
                busy={busy}
                now={now}
                editMode={editMode}
                availKeys={availKeys}
                onToggleAvailHour={toggleAvailHour}
                onAddBusy={addBusyAt}
                onRemoveBusy={removeBusy}
              />
            )}
            {view === "list" && (
              <ListView bookings={weekBookings} weekStart={weekStart} now={now} />
            )}
            {view === "month" && (
              <MonthView
                anchor={weekStart}
                bookings={bookings}
                onPickDay={(d) => {
                  setWeekStart(mondayOf(d));
                  setView("week");
                }}
              />
            )}
          </div>
        </div>
      </div>
    </DTFrame>
  );
}

function LegendDot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        marginRight: 4,
        verticalAlign: "middle",
      }}
    />
  );
}

function WeekGrid({
  days,
  bookings,
  busy,
  googleShadows,
  now,
  editMode,
  availKeys,
  onToggleAvailHour,
  onAddBusy,
  onRemoveBusy,
}: {
  days: Date[];
  bookings: BookingPublic[];
  busy: CoachBusyPublic[];
  googleShadows: GoogleShadowRow[];
  now: Date;
  editMode: EditMode;
  availKeys: Set<string>;
  onToggleAvailHour: (uiDay: number, hour: number) => void;
  onAddBusy: (date: Date, hour: number) => void;
  onRemoveBusy: (id: string) => void;
}) {
  return (
    <div
      style={{
        border: "1.5px solid var(--ink)",
        borderRadius: 10,
        background: "var(--paper)",
        overflow: "hidden",
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "52px repeat(7, 1fr)",
          background: "var(--paper-2)",
          borderBottom: "1.5px solid var(--ink)",
        }}
      >
        <div />
        {days.map((d, i) => (
          <div
            key={i}
            style={{
              padding: "8px 10px",
              borderLeft: "1.5px dotted var(--ink-faint)",
              fontFamily: "var(--scrawl)",
              fontWeight: 700,
              fontSize: 16,
              color: sameDay(d, now) ? "var(--accent)" : "var(--ink)",
            }}
          >
            {WEEKDAYS[i]}{" "}
            <span className="muted small" style={{ fontWeight: 400 }}>
              {d.getDate()}
            </span>
          </div>
        ))}
      </div>

      {/* Body: hour gutter + 7 day columns, all positioned */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "52px repeat(7, 1fr)",
        }}
      >
        {/* Hour gutter */}
        <div style={{ background: "var(--paper-2)" }}>
          {HOURS.slice(0, -1).map((h) => (
            <div
              key={h}
              style={{
                height: HOUR_PX,
                padding: "4px 6px",
                textAlign: "right",
                color: "var(--ink-faint)",
                fontFamily: "var(--mono)",
                fontSize: 10,
                borderBottom: "1.5px dotted var(--ink-faint)",
              }}
            >
              {formatHour(h)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((d, idx) => (
          <DayColumn
            key={idx}
            day={d}
            uiDay={idx}
            now={now}
            bookings={bookings.filter((b) => sameDay(new Date(b.startsAt), d))}
            busy={busy.filter((bb) => sameDay(new Date(bb.startsAt), d))}
            editMode={editMode}
            availKeys={availKeys}
            onToggleAvailHour={onToggleAvailHour}
            onAddBusy={onAddBusy}
            onRemoveBusy={onRemoveBusy}
          />
        ))}
      </div>
    </div>
  );
}

// Coral diagonal hatch used to render busy blocks, distinct from booking
// fills (solid coral) and availability shading (paper-2 wash).
const BUSY_HATCH = "repeating-linear-gradient(135deg, rgba(232,93,77,0.18) 0 6px, rgba(232,93,77,0.36) 6px 8px)";

// Slate hatch for Google Calendar shadows — distinct from coral busy
// blocks, so coaches can tell at a glance which side made the conflict.
const GOOGLE_HATCH = "repeating-linear-gradient(135deg, rgba(60,90,140,0.14) 0 6px, rgba(60,90,140,0.28) 6px 8px)";

type GoogleShadowRow = { id: string; summary: string | null; startsAt: string; endsAt: string };

function DayColumn({
  day,
  uiDay,
  bookings,
  busy,
  googleShadows,
  now,
  editMode,
  availKeys,
  onToggleAvailHour,
  onAddBusy,
  onRemoveBusy,
}: {
  day: Date;
  uiDay: number;
  bookings: BookingPublic[];
  busy: CoachBusyPublic[];
  googleShadows: GoogleShadowRow[];
  now: Date;
  editMode: EditMode;
  availKeys: Set<string>;
  onToggleAvailHour: (uiDay: number, hour: number) => void;
  onAddBusy: (date: Date, hour: number) => void;
  onRemoveBusy: (id: string) => void;
}) {
  const isToday = sameDay(day, now);
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const nowOffset = (minutesNow / 60 - START_HOUR) * HOUR_PX;
  const showNowLine = isToday && nowOffset >= 0 && nowOffset <= (HOURS.length - 1) * HOUR_PX;

  return (
    <div
      style={{
        position: "relative",
        borderLeft: "1.5px dotted var(--ink-faint)",
        background: isToday ? "rgba(232,93,77,0.04)" : undefined,
      }}
    >
      {/* hour cells — each one is the unit of interaction in edit modes */}
      {HOURS.slice(0, -1).map((h) => {
        const isAvail = availKeys.has(`${uiDay}-${h}`);
        const hoursMode = editMode === "hours";
        const busyMode = editMode === "busy";
        return (
          <div
            key={h}
            onClick={
              hoursMode
                ? () => onToggleAvailHour(uiDay, h)
                : busyMode
                ? () => onAddBusy(day, h)
                : undefined
            }
            title={
              hoursMode
                ? isAvail ? "click to unmark this hour as available" : "click to mark this hour as available"
                : busyMode
                ? "click to block this hour"
                : undefined
            }
            style={{
              position: "relative",
              height: HOUR_PX,
              borderBottom: "1.5px dotted var(--ink-faint)",
              cursor: hoursMode || busyMode ? "pointer" : undefined,
              // Soft paper-2 wash on cells the coach has marked as
              // available — visible in all modes so the schedule is
              // always legible.
              background: isAvail
                ? "rgba(26,22,18,0.05)"
                : undefined,
              transition: "background 0.15s ease",
            }}
          >
            {hoursMode && (
              <div
                style={{
                  position: "absolute",
                  top: 4,
                  right: 6,
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  border: "1.5px solid var(--ink-faint)",
                  background: isAvail ? "var(--ink)" : "var(--paper)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--paper)",
                  fontSize: 10,
                  fontWeight: 700,
                  pointerEvents: "none",
                }}
              >
                {isAvail ? "✓" : ""}
              </div>
            )}
          </div>
        );
      })}

      {/* busy overlays — coral hatch above availability shading but
          beneath events. Always visible regardless of editMode so the
          coach can see what they've blocked. Click in busy mode to delete. */}
      {busy.map((bb) => {
        const start = new Date(bb.startsAt);
        const end = new Date(bb.endsAt);
        const startHour = start.getHours() + start.getMinutes() / 60;
        const endHour = end.getHours() + end.getMinutes() / 60;
        if (endHour <= START_HOUR || startHour >= END_HOUR + 1) return null;
        const top = (Math.max(startHour, START_HOUR) - START_HOUR) * HOUR_PX;
        const height = Math.max(20, (Math.min(endHour, END_HOUR + 1) - Math.max(startHour, START_HOUR)) * HOUR_PX);
        return (
          <div
            key={bb.id}
            onClick={editMode === "busy" ? () => onRemoveBusy(bb.id) : undefined}
            title={
              editMode === "busy"
                ? "click to remove this busy block"
                : bb.label ?? "busy"
            }
            style={{
              position: "absolute",
              left: 1,
              right: 1,
              top,
              height,
              background: BUSY_HATCH,
              border: "1.5px solid var(--accent)",
              borderRadius: 4,
              zIndex: 1,
              cursor: editMode === "busy" ? "pointer" : "help",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              padding: "2px 5px",
              fontFamily: "var(--hand)",
              fontSize: 11,
              color: "var(--accent)",
              fontWeight: 600,
              pointerEvents: "auto",
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {bb.label ?? "busy"}
            </span>
            {editMode === "busy" && <span style={{ marginLeft: 4 }}>✕</span>}
          </div>
        );
      })}

      {/* Google Calendar shadows — slate hatch, read-only. Sit at the
          same z-layer as Sunbird busy blocks so they visually compete
          for the same time without one swallowing the other. */}
      {googleShadows.map((g) => {
        const start = new Date(g.startsAt);
        const end = new Date(g.endsAt);
        const startHour = start.getHours() + start.getMinutes() / 60;
        const endHour = end.getHours() + end.getMinutes() / 60;
        if (endHour <= START_HOUR || startHour >= END_HOUR + 1) return null;
        const top = (Math.max(startHour, START_HOUR) - START_HOUR) * HOUR_PX;
        const height = Math.max(20, (Math.min(endHour, END_HOUR + 1) - Math.max(startHour, START_HOUR)) * HOUR_PX);
        return (
          <div
            key={g.id}
            title={`Google: ${g.summary ?? "(no title)"}`}
            style={{
              position: "absolute",
              left: 1,
              right: 1,
              top,
              height,
              background: GOOGLE_HATCH,
              border: "1.5px dashed #3c5a8c",
              borderRadius: 4,
              zIndex: 1,
              cursor: "help",
              display: "flex",
              alignItems: "flex-start",
              padding: "2px 5px",
              fontFamily: "var(--hand)",
              fontSize: 11,
              color: "#3c5a8c",
              fontWeight: 600,
              pointerEvents: "auto",
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              G · {g.summary ?? "busy"}
            </span>
          </div>
        );
      })}

      {/* events */}
      {bookings.map((b) => {
        const placed = placeEvent(b);
        if (!placed) return null;
        return <EventBlock key={b.id} placed={placed} />;
      })}

      {/* now line */}
      {showNowLine && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: nowOffset,
            borderTop: "2px solid var(--accent)",
            pointerEvents: "none",
            zIndex: 3,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: -4,
              top: -4,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "var(--accent)",
            }}
          />
        </div>
      )}
    </div>
  );
}

function EventBlock({ placed }: { placed: PositionedEvent }) {
  const b = placed.booking;
  const c = STATUS_COLOR[b.status] ?? STATUS_COLOR.CONFIRMED;
  const studentName = b.user?.name ?? "Student";
  const piece = b.skillTree?.title ?? b.category?.title ?? null;
  const compact = placed.height < 48;
  return (
    <Link
      to={`/coach/session/${b.id}`}
      title={`${studentName} · ${formatTime(b.startsAt)}${piece ? ` · ${piece}` : ""}`}
      style={{
        position: "absolute",
        left: 2,
        right: 2,
        top: placed.top,
        height: placed.height,
        background: c.bg,
        border: `1.5px solid ${c.border}`,
        borderRadius: 6,
        padding: compact ? "2px 6px" : "4px 8px",
        textDecoration: "none",
        color: c.text,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 1,
        zIndex: 2,
        boxShadow: "1px 1px 0 rgba(0,0,0,0.08)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--scrawl)",
          fontWeight: 700,
          fontSize: compact ? 12 : 14,
          lineHeight: 1.1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {formatTime(b.startsAt)} · {studentName.split(" ")[0]}
      </div>
      {!compact && piece && (
        <div
          style={{
            fontSize: 11,
            opacity: 0.85,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {piece}
        </div>
      )}
      {!compact && b.mode === "ONLINE" && (
        <div style={{ fontSize: 10, opacity: 0.7 }}>online</div>
      )}
    </Link>
  );
}

function ListView({
  bookings,
  weekStart,
  now,
}: {
  bookings: BookingPublic[];
  weekStart: Date;
  now: Date;
}) {
  const sorted = bookings.slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const byDay = new Map<string, BookingPublic[]>();
  for (const b of sorted) {
    const key = startOfDay(new Date(b.startsAt)).toISOString();
    const arr = byDay.get(key) ?? [];
    arr.push(b);
    byDay.set(key, arr);
  }

  if (sorted.length === 0) {
    return (
      <div className="box dashed" style={{ textAlign: "center", padding: "32px 24px" }}>
        <div className="wf-scrawl bold" style={{ fontSize: 22, color: "var(--ink)" }}>
          Nothing booked this week.
        </div>
        <div className="small muted mt-2">Use prev/next to look at a different week.</div>
      </div>
    );
  }

  return (
    <div className="col gap-3">
      {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => {
        const key = startOfDay(d).toISOString();
        const dayBookings = byDay.get(key) ?? [];
        if (dayBookings.length === 0) return null;
        const isToday = sameDay(d, now);
        return (
          <div key={key}>
            <div className="row gap-2 mb-2">
              <span
                className="wf-scrawl bold"
                style={{ fontSize: 20, color: isToday ? "var(--accent)" : "var(--ink)" }}
              >
                {d.toLocaleDateString([], { weekday: "long" })}
              </span>
              <span className="muted small">
                {d.toLocaleDateString([], { month: "short", day: "numeric" })}
              </span>
              {isToday && <Tag color="coral">today</Tag>}
            </div>
            <div className="col gap-2">
              {dayBookings.map((b) => (
                <ListEventRow key={b.id} booking={b} now={now} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ListEventRow({ booking, now }: { booking: BookingPublic; now: Date }) {
  const studentName = booking.user?.name ?? "Student";
  const piece = booking.skillTree?.title ?? booking.category?.title ?? null;
  const start = new Date(booking.startsAt);
  const end = new Date(booking.endsAt);
  const durMin = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));
  const isLive = start <= now && end > now;
  const isPast = end <= now;
  const c = STATUS_COLOR[booking.status] ?? STATUS_COLOR.CONFIRMED;
  return (
    <Link
      to={`/coach/session/${booking.id}`}
      className="box small row gap-3"
      style={{
        textDecoration: "none",
        color: "inherit",
        borderColor: isLive ? "var(--accent)" : undefined,
        borderWidth: isLive ? 2 : undefined,
        opacity: isPast && booking.status !== "COMPLETED" ? 0.65 : 1,
      }}
    >
      <Avatar name={studentName} size={36} />
      <div className="grow">
        <div className="bold">
          {formatTime(booking.startsAt)} · {studentName}
          {isLive && (
            <span className="chip tiny accent" style={{ marginLeft: 8, background: "var(--accent)", color: "white", borderColor: "var(--accent)" }}>
              live now
            </span>
          )}
        </div>
        <div className="tiny muted">
          {durMin} min · {booking.mode === "ONLINE" ? "online" : "in person"}
          {piece ? ` · ${piece}` : ""}
        </div>
      </div>
      <span
        className="chip tiny"
        style={{
          background: c.bg,
          borderColor: c.border,
          color: c.text,
        }}
      >
        {booking.status.toLowerCase()}
      </span>
      <Icon name="chev" size={12} stroke="var(--ink-faint)" />
    </Link>
  );
}

function MonthView({
  anchor,
  bookings,
  onPickDay,
}: {
  anchor: Date;
  bookings: BookingPublic[];
  onPickDay: (d: Date) => void;
}) {
  // Render the calendar month containing `anchor`. Weeks start on Mon.
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const firstMonday = mondayOf(first);
  const lastSunday = addDays(mondayOf(last), 6);
  const dayCount = Math.round((+lastSunday - +firstMonday) / 86_400_000) + 1;
  const days = Array.from({ length: dayCount }, (_, i) => addDays(firstMonday, i));
  const today = startOfDay(new Date());

  const countByDay = new Map<string, number>();
  for (const b of bookings) {
    if (b.status === "CANCELLED") continue;
    const k = startOfDay(new Date(b.startsAt)).toISOString();
    countByDay.set(k, (countByDay.get(k) ?? 0) + 1);
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          border: "1.5px solid var(--ink)",
          borderRadius: 10,
          overflow: "hidden",
          background: "var(--paper)",
        }}
      >
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            style={{
              padding: "8px 10px",
              borderBottom: "1.5px solid var(--ink)",
              background: "var(--paper-2)",
              fontFamily: "var(--scrawl)",
              fontWeight: 700,
              fontSize: 14,
              textAlign: "center",
            }}
          >
            {d}
          </div>
        ))}
        {days.map((d) => {
          const inMonth = d.getMonth() === anchor.getMonth();
          const isToday = sameDay(d, today);
          const count = countByDay.get(startOfDay(d).toISOString()) ?? 0;
          return (
            <button
              key={d.toISOString()}
              onClick={() => onPickDay(d)}
              style={{
                minHeight: 76,
                padding: 6,
                border: 0,
                borderTop: "1px dotted var(--ink-faint)",
                borderLeft: "1px dotted var(--ink-faint)",
                background: isToday ? "var(--accent-soft)" : "var(--paper)",
                opacity: inMonth ? 1 : 0.4,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                fontFamily: "inherit",
                textAlign: "left",
              }}
            >
              <div
                className="row between"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: isToday ? "var(--accent)" : "var(--ink)",
                }}
              >
                <span>{d.getDate()}</span>
                {count > 0 && <span className="tiny muted">{count}</span>}
              </div>
              <div
                style={{
                  marginTop: 6,
                  display: "flex",
                  gap: 2,
                  flexWrap: "wrap",
                }}
              >
                {Array.from({ length: Math.min(count, 4) }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--accent)",
                    }}
                  />
                ))}
                {count > 4 && <span className="tiny muted">+{count - 4}</span>}
              </div>
            </button>
          );
        })}
      </div>
      <div className="tiny muted center mt-2">
        Click any day to jump to that week.
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Mobile view — list-first, with day groups
// ──────────────────────────────────────────────────────────
function CalendarMobile({ bookings }: { bookings: BookingPublic[] }) {
  const now = useNow(60_000);
  const upcoming = bookings
    .filter((b) => new Date(b.endsAt) >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 20);

  return (
    <WFFrame navActive="home">
      <div className="wf-header">
        <div>
          <h2 className="wf-title">Calendar</h2>
          <div className="wf-subtitle">{upcoming.length} upcoming</div>
        </div>
        <Link to="/coach" className="btn icon ghost"><Icon name="back" size={14} /></Link>
      </div>
      <div className="wf-body col gap-3 scroll-y" style={{ alignItems: "stretch" }}>
        {upcoming.length === 0 ? (
          <div className="box dashed" style={{ textAlign: "center", padding: "24px 14px" }}>
            <div className="wf-scrawl bold" style={{ fontSize: 22, color: "var(--ink)" }}>
              Nothing on the books.
            </div>
            <Squiggle w={80} color="var(--ink-faint)" />
          </div>
        ) : (
          upcoming.map((b) => <ListEventRow key={b.id} booking={b} now={now} />)
        )}
      </div>
    </WFFrame>
  );
}

// ──────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────
export function CalendarPage() {
  const isMobile = useIsMobile();
  const [bookings, setBookings] = useState<BookingPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: BookingPublic[] }>("/api/bookings")
      .then((r) => setBookings(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return isMobile
    ? <CalendarMobile bookings={bookings} />
    : <CalendarDesktop bookings={bookings} loading={loading} />;
}
