import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { BookingPublic } from "@sunbird/shared";
import { apiFetch } from "@/lib/api";
import { DTFrame } from "../components/DTFrame";
import { WFFrame } from "../components/WFFrame";
import { Icon } from "../components/Icon";
import { Avatar } from "../components/Avatar";
import { Tag } from "../components/Tag";
import { Squiggle } from "../components/Squiggle";
import { useIsMobile } from "../hooks/useIsMobile";
import { useNow } from "../hooks/useNow";

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
function CalendarDesktop({ bookings, loading }: { bookings: BookingPublic[]; loading: boolean }) {
  const now = useNow(60_000);
  const [view, setView] = useState<ViewMode>("week");
  const [weekStart, setWeekStart] = useState<Date>(() => mondayOf(now));

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
            </div>
          </div>
          <div className="panel-body scroll">
            {view === "week" && (
              <WeekGrid days={days} bookings={weekBookings} now={now} />
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
  now,
}: {
  days: Date[];
  bookings: BookingPublic[];
  now: Date;
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
            now={now}
            bookings={bookings.filter((b) => sameDay(new Date(b.startsAt), d))}
          />
        ))}
      </div>
    </div>
  );
}

function DayColumn({
  day,
  bookings,
  now,
}: {
  day: Date;
  bookings: BookingPublic[];
  now: Date;
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
      {/* hour grid lines */}
      {HOURS.slice(0, -1).map((h) => (
        <div
          key={h}
          style={{
            height: HOUR_PX,
            borderBottom: "1.5px dotted var(--ink-faint)",
          }}
        />
      ))}

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
