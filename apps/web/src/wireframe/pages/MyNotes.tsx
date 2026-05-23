import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { BookingPublic, NoteSections, StudentDetailPublic } from "@sunbird/shared";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { STFrame } from "../components/STFrame";
import { Icon } from "../components/Icon";
import { Squiggle } from "../components/Squiggle";
import { useMyStudentDetail } from "../hooks/useCoachData";
import { MobileStatusBar } from "../components/MobileStatusBar";

function MobileCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="dt-main-body"
      style={{
        height: "100%",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 390,
          minHeight: 0,
          border: "1.5px solid var(--ink)",
          borderRadius: 22,
          background: "var(--paper)",
          boxShadow: "3px 4px 0 rgba(0,0,0,0.08)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </div>
    </div>
  );
}

const StatusBar = MobileStatusBar;

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

function thisWeekDays(now = new Date()): Array<{ label: string; date: Date; isToday: boolean }> {
  const out: Array<{ label: string; date: Date; isToday: boolean }> = [];
  const day = now.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + offset);
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    out.push({
      label: DAYS[(i + 1) % 7], // Mon→Sun: M T W T F S S
      date: d,
      isToday: d.toDateString() === now.toDateString(),
    });
  }
  return out;
}

function WeekStrip({
  bookingsByYmd,
  todayHasLesson,
}: {
  bookingsByYmd: Map<string, BookingPublic[]>;
  todayHasLesson: boolean;
}) {
  const days = thisWeekDays();
  return (
    <div className="row gap-2 between">
      {days.map((d) => {
        const key = d.date.toISOString().slice(0, 10);
        const dayBookings = bookingsByYmd.get(key) ?? [];
        const hasLesson = dayBookings.length > 0;
        const isPastOrToday = d.date.getTime() <= Date.now();
        const isCompleted = isPastOrToday && !d.isToday;
        return (
          <div
            key={key}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "6px 0",
              border: "1.5px solid " + (d.isToday ? "var(--accent)" : "var(--ink)"),
              background: d.isToday
                ? "var(--accent)"
                : isCompleted
                ? "var(--paper-2)"
                : "var(--paper)",
              color: d.isToday ? "white" : "var(--ink)",
              borderRadius: 8,
              position: "relative",
            }}
          >
            <div className="tiny">{d.label}</div>
            <div className="bold">{d.date.getDate()}</div>
            {hasLesson && (
              <div
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "var(--highlight)",
                  border: "1.5px solid var(--ink)",
                }}
              />
            )}
          </div>
        );
      })}
      {/* keep ts happy about unused param */}
      <span style={{ display: "none" }}>{String(todayHasLesson)}</span>
    </div>
  );
}

function formatDay(date: Date): string {
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ──────────────────────────────────────────────────────────
// /my-notes — Journal (week view OR Friday lesson-day view)
// ──────────────────────────────────────────────────────────
export function MyNotesPage() {
  const { user } = useAuth();
  const { detail } = useMyStudentDetail();
  const [bookings, setBookings] = useState<BookingPublic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: BookingPublic[] }>("/api/bookings")
      .then((r) => setBookings(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const initial = user?.name?.trim().charAt(0).toUpperCase() ?? "?";
  const todayStr = ymd(new Date());
  const weekStart = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    const m = new Date(now);
    m.setHours(0, 0, 0, 0);
    m.setDate(m.getDate() + offset);
    return m;
  }, []);
  const weekEnd = useMemo(() => {
    const e = new Date(weekStart);
    e.setDate(weekStart.getDate() + 7);
    return e;
  }, [weekStart]);

  const bookingsByYmd = useMemo(() => {
    const m = new Map<string, BookingPublic[]>();
    for (const b of bookings) {
      if (b.status === "CANCELLED") continue;
      const k = ymd(new Date(b.startsAt));
      const list = m.get(k) ?? [];
      list.push(b);
      m.set(k, list);
    }
    return m;
  }, [bookings]);

  const todayLessons = bookingsByYmd.get(todayStr) ?? [];
  const todayHasLesson = todayLessons.some((b) => b.status === "CONFIRMED");

  if (todayHasLesson) {
    return (
      <LessonDayView
        booking={todayLessons.find((b) => b.status === "CONFIRMED")!}
        bookingsByYmd={bookingsByYmd}
        initial={initial}
        streak={detail?.streak?.currentDays ?? 0}
        detail={detail}
      />
    );
  }

  // Week-view mode
  return (
    <STFrame side="notes">
      <MobileCard>
        <div className="wf">
          <StatusBar />
          <div className="wf-header">
            <div>
              <h2 className="wf-title">Practice journal</h2>
              <div className="wf-subtitle">
                week of {weekStart.toLocaleDateString([], { month: "short", day: "numeric" })}
              </div>
            </div>
            <div className="wf-avatar">{initial}</div>
          </div>
          <div className="wf-body col gap-3 scroll-y">
            <WeekStrip bookingsByYmd={bookingsByYmd} todayHasLesson={todayHasLesson} />

            {loading && <div className="small muted">Loading…</div>}

            {/* Past bookings inside this week */}
            {bookings
              .filter((b) => {
                const t = new Date(b.startsAt).getTime();
                return t >= weekStart.getTime() && t < weekEnd.getTime();
              })
              .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
              .map((b) => {
                const d = new Date(b.startsAt);
                if (b.practiceNotes && d.getTime() <= Date.now()) {
                  return <JournalLessonCard key={b.id} booking={b} />;
                }
                if (d.getTime() > Date.now()) {
                  return <JournalUpcoming key={b.id} booking={b} />;
                }
                return null;
              })}

            {/* Today auto-log card if no lesson */}
            {!todayHasLesson && (
              <div className="box dashed accent">
                <div className="row between">
                  <span className="bold">
                    {new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}{" "}
                    <span className="chip accent tiny" style={{ marginLeft: 6 }}>today</span>
                  </span>
                  <span className="tiny muted">{detail?.streak ? `🔥 ${detail.streak.currentDays}d` : ""}</span>
                </div>
                <div className="small muted mt-1">
                  Open today's path to track your practice.
                </div>
                <Link to="/practice" className="btn small mt-2">
                  <Icon name="play" size={11} /> start today's path →
                </Link>
              </div>
            )}

            <div className="postit small" style={{ transform: "rotate(0.6deg)" }}>
              Tip: tap any note to read the whole letter 🎵
            </div>
          </div>
        </div>
      </MobileCard>
    </STFrame>
  );
}

function JournalLessonCard({ booking }: { booking: BookingPublic }) {
  const sections = parseSections(booking);
  return (
    <Link to={`/my-notes/${booking.id}`} className="box thick" style={{ position: "relative", textDecoration: "none", color: "inherit" }}>
      <div className="corner">lesson</div>
      <div className="row between mb-1">
        <span className="wf-scrawl big bold">{formatDay(new Date(booking.startsAt))}</span>
        <span className="tiny muted">
          {new Date(booking.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          {booking.coach ? ` · ${booking.coach.name.split(" ")[0]}` : ""}
        </span>
      </div>
      <Squiggle w={60} color="var(--ink-faint)" />
      <div className="small mt-2" style={{ lineHeight: 1.5 }}>
        {sections?.intro
          ? sections.intro.length > 110
            ? sections.intro.slice(0, 108) + "…"
            : sections.intro
          : (booking.practiceNotes || "").slice(0, 140) + ((booking.practiceNotes ?? "").length > 140 ? "…" : "")}
      </div>
      <div className="row gap-2 mt-3">
        <span className="chip tiny accent">read full →</span>
      </div>
    </Link>
  );
}

function JournalUpcoming({ booking }: { booking: BookingPublic }) {
  return (
    <div className="box small" style={{ position: "relative" }}>
      <div className="row between">
        <span className="bold">{formatDay(new Date(booking.startsAt))}</span>
        <span className="tiny muted">
          {new Date(booking.startsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} ·
          lesson
        </span>
      </div>
      <div className="tiny muted mt-1">prep checklist will open here the night before</div>
    </div>
  );
}

function parseSections(b: BookingPublic): NoteSections | null {
  // BookingPublic doesn't carry noteSections; this branch is for forwards
  // compatibility once the shared type exposes it. For now, return null and
  // fall back to practiceNotes text.
  const anyB = b as unknown as { noteSections?: string };
  if (!anyB.noteSections) return null;
  try {
    return JSON.parse(anyB.noteSections) as NoteSections;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────────
// /my-notes/:bookingId — expanded lesson note
// ──────────────────────────────────────────────────────────
export function MyNoteExpandedPage() {
  const params = useParams<{ bookingId: string }>();
  const { user } = useAuth();
  const { detail } = useMyStudentDetail();
  const [booking, setBooking] = useState<BookingPublic | undefined>();
  const [loading, setLoading] = useState(true);
  const initial = user?.name?.trim().charAt(0).toUpperCase() ?? "?";

  useEffect(() => {
    if (!params.bookingId) return;
    apiFetch<{ data: BookingPublic }>(`/api/bookings/${params.bookingId}`)
      .then((r) => setBooking(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.bookingId]);

  const isLatest = detail?.latestNoteBookingId && params.bookingId === detail.latestNoteBookingId;
  const sections =
    (isLatest && detail?.latestNoteSections) || parseSections(booking ?? ({} as BookingPublic));
  const summary = isLatest ? detail?.latestLessonSummary : null;
  const coachName = booking?.coach?.name ?? "your teacher";

  return (
    <STFrame side="notes">
      <MobileCard>
        <div className="wf">
          <StatusBar />
          <div className="wf-header">
            <Link to="/my-notes" className="btn icon ghost" style={{ border: 0, background: "transparent" }}>
              <Icon name="back" size={16} />
            </Link>
            <div className="small bold muted">
              {booking ? formatDay(new Date(booking.startsAt)) : "Lesson"}
            </div>
            <div className="wf-avatar">{initial}</div>
          </div>
          <div className="wf-body col gap-3 scroll-y" style={{ paddingBottom: 24 }}>
            {loading && <div className="small muted">Loading…</div>}
            {!loading && !booking && (
              <div className="small muted">Couldn't find that lesson note.</div>
            )}

            {booking && (
              <>
                <div className="row gap-3">
                  <div className="wf-avatar" style={{ width: 46, height: 46, fontSize: 22 }}>
                    {coachName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="bold">{coachName}</div>
                    <div className="tiny muted">
                      after {formatDay(new Date(booking.startsAt))}'s lesson
                    </div>
                  </div>
                </div>

                <div className="box thick" style={{ padding: "18px 16px" }}>
                  <Squiggle w={70} color="var(--ink-faint)" />
                  {sections ? (
                    <div className="note-sections mt-2" style={{ gridTemplateColumns: "96px 1fr" }}>
                      {renderSection("intro", sections.intro)}
                      {renderSection("scales & exercises", sections.scalesExercises)}
                      {renderSection("topics", sections.topics)}
                      {renderSection("song work", sections.songWork)}
                      {renderSection("suggestions", sections.otherSongs)}
                      {renderSection("next time", sections.nextTime)}
                    </div>
                  ) : booking.practiceNotes ? (
                    <div className="small mt-2" style={{ whiteSpace: "pre-line", lineHeight: 1.5 }}>
                      {booking.practiceNotes}
                    </div>
                  ) : (
                    <div className="small muted">No note was attached to this lesson.</div>
                  )}
                  <Squiggle w={70} color="var(--ink-faint)" />

                  {summary && (
                    <div className="ai-summary mt-2">
                      <div className="ai-summary-head">
                        <span className="ai-badge">✦ AI</span>
                        <span className="ai-title">lesson summary</span>
                        <span className="ai-meta">
                          {summary.durationMin ? `${summary.durationMin} min · ` : ""}auto
                        </span>
                      </div>
                      <ul className="ai-bullets">
                        {summary.bullets.map((b, i) => (
                          <li key={i}>{b}</li>
                        ))}
                      </ul>
                      <div className="ai-foot">
                        <span className="tiny muted">edited by {coachName.split(" ")[0]}</span>
                        <button className="btn small ghost" style={{ marginLeft: "auto" }}>
                          ▶ replay
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {detail && (
                  <>
                    <div className="small muted">ATTACHED TO TODAY'S PRACTICE</div>
                    {detail.assignments
                      .filter((a) => a.bookingId === booking.id || isLatest)
                      .slice(0, 4)
                      .map((a) => (
                        <div
                          key={a.id}
                          className="box small row gap-3"
                          style={a.type === "SONG" ? { borderColor: "var(--accent)" } : undefined}
                        >
                          <Icon name={a.type === "WARMUP" ? "metro" : a.type === "SONG" ? "mic" : "note"} size={18} stroke={a.type === "SONG" ? "var(--accent)" : "currentColor"} />
                          <div className="grow">
                            <div className="bold">{a.title}</div>
                            <div className="tiny muted">
                              {a.type === "SONG" ? "record & send" : a.type === "EXERCISE" ? "exercise" : "warmup"}
                              {a.durationMin ? ` · ${a.durationMin} min` : ""}
                              {a.dueAt ? ` · due ${new Date(a.dueAt).toLocaleDateString([], { weekday: "short" })}` : ""}
                            </div>
                          </div>
                          {a.type === "SONG" ? (
                            <Link to={`/practice/record/${a.id}`} className="btn small accent">
                              record
                            </Link>
                          ) : (
                            <Link to={`/practice/exercise/${a.id}`} className="btn small ghost">
                              <Icon name="play" size={12} />
                            </Link>
                          )}
                        </div>
                      ))}
                  </>
                )}

                <div className="row gap-2">
                  <button className="btn small grow">react ♡</button>
                  <button className="btn small grow">
                    <Icon name="send" size={11} /> reply
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </MobileCard>
    </STFrame>
  );
}

function renderSection(label: string, body: string | undefined) {
  if (!body || !body.trim()) return null;
  return (
    <div className="ns-row" key={label}>
      <div className="ns-label">{label}</div>
      <div className="ns-body" style={{ whiteSpace: "pre-line" }}>{body}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Lesson-day view (used when there's a CONFIRMED booking today)
// ──────────────────────────────────────────────────────────
function LessonDayView({
  booking,
  bookingsByYmd,
  initial,
  streak,
  detail,
}: {
  booking: BookingPublic;
  bookingsByYmd: Map<string, BookingPublic[]>;
  initial: string;
  streak: number;
  detail: StudentDetailPublic | undefined;
}) {
  const now = new Date();
  const start = new Date(booking.startsAt);
  const msUntil = start.getTime() - now.getTime();
  const hUntil = Math.max(0, Math.floor(msUntil / 3_600_000));
  const mUntil = Math.max(0, Math.floor((msUntil / 60_000) % 60));
  const coachName = booking.coach?.name?.split(" ")[0] ?? "your teacher";

  const prepFromLatest = detail?.assignments.slice(0, 3) ?? [];

  return (
    <STFrame side="notes">
      <MobileCard>
        <div className="wf">
          <StatusBar />
          <div className="wf-header">
            <div>
              <h2 className="wf-title">Lesson today!</h2>
              <div className="wf-subtitle">
                {start.toLocaleDateString([], { weekday: "short" })} ·{" "}
                {start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{" "}
                · in {hUntil > 0 ? `${hUntil}h ` : ""}
                {mUntil}m
              </div>
            </div>
            <div className="row gap-2">
              {streak > 0 && (
                <span className="chip accent" style={{ background: "var(--accent)", color: "white", borderColor: "var(--accent)" }}>🔥 {streak}</span>
              )}
              <div className="wf-avatar">{initial}</div>
            </div>
          </div>
          <div className="wf-body col gap-3 scroll-y" style={{ paddingBottom: 24 }}>
            <WeekStrip bookingsByYmd={bookingsByYmd} todayHasLesson />

            <div className="box thick accent" style={{ textAlign: "center", padding: "14px 12px" }}>
              <div className="tiny muted">UPCOMING LESSON</div>
              <div className="wf-scrawl bold" style={{ fontSize: 32, lineHeight: 1, marginTop: 2 }}>
                {start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · today
              </div>
              <div className="small muted mt-1">
                {coachName} · {Math.round((new Date(booking.endsAt).getTime() - start.getTime()) / 60_000)} min
              </div>
              <Squiggle w={80} color="var(--accent)" />
            </div>

            {prepFromLatest.length > 0 && (
              <>
                <div className="small muted">PREP FOR TODAY</div>
                {prepFromLatest.map((a) => {
                  const isDone = a.status === "COMPLETED";
                  const isCurrent = a.status === "IN_PROGRESS" && !isDone;
                  return (
                    <div
                      key={a.id}
                      className="box row gap-3 mt-2"
                      style={isCurrent ? { borderColor: "var(--accent)" } : undefined}
                    >
                      <div className={"checkbox" + (isDone ? " done" : "")} />
                      <div className="grow">
                        <div className={isDone ? "scribble-through grow" : "bold"}>{a.title}</div>
                        <div className="tiny muted">
                          {a.completionCount > 0
                            ? `${a.completionCount} sessions`
                            : a.subtitle ?? ""}
                        </div>
                      </div>
                      {!isDone && a.type === "SONG" && (
                        <Link to={`/practice/record/${a.id}`} className="btn small accent">
                          start
                        </Link>
                      )}
                      {!isDone && a.type !== "SONG" && (
                        <Link to={`/practice/exercise/${a.id}`} className="btn small">
                          start
                        </Link>
                      )}
                      {isDone && <Icon name="send" size={12} stroke="var(--ink-faint)" />}
                    </div>
                  );
                })}
              </>
            )}

            <div className="box dashed">
              <div className="row between mb-2">
                <div className="bold small">★ Things to ask {coachName}</div>
                <Icon name="plus" size={14} />
              </div>
              <div className="small muted">+ add your own questions before the lesson</div>
            </div>

            {detail?.latestNoteBookingId && (
              <Link to={`/my-notes/${detail.latestNoteBookingId}`} className="btn primary big">
                Open last week's note ↗
              </Link>
            )}
          </div>
        </div>
      </MobileCard>
    </STFrame>
  );
}
