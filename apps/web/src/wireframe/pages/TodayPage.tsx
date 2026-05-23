import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AssignmentPublic, BookingPublic, StudentDetailPublic } from "@sunbird/shared";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { STFrame } from "../components/STFrame";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { Tag } from "../components/Tag";
import { Squiggle } from "../components/Squiggle";
import { useMyStudentDetail } from "../hooks/useCoachData";
import { useNow } from "../hooks/useNow";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function relativeFromNow(targetIso: string, now: Date): string {
  const diffMs = new Date(targetIso).getTime() - now.getTime();
  if (diffMs <= -60_000) {
    const past = Math.abs(diffMs);
    const h = Math.floor(past / 3_600_000);
    const m = Math.floor((past / 60_000) % 60);
    if (h > 0) return `${h}h ${m}m ago`;
    return `${m}m ago`;
  }
  if (Math.abs(diffMs) < 60_000) return "now";
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs / 60_000) % 60);
  if (h > 0) return `in ${h}h ${m}m`;
  return `in ${m}m`;
}

function greetingFor(now: Date): string {
  const h = now.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const ASSIGNMENT_ICON: Record<AssignmentPublic["type"], "metro" | "note" | "mic"> = {
  WARMUP: "metro",
  EXERCISE: "note",
  SONG: "mic",
};

function thisMonday(now = new Date()): Date {
  const out = new Date(now);
  const day = out.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() + offset);
  return out;
}

function thisWeeksAssignments(detail: StudentDetailPublic | undefined): AssignmentPublic[] {
  if (!detail) return [];
  const mondayIso = thisMonday().toISOString();
  return detail.assignments
    .filter((a) => a.weekStartsOn === mondayIso || new Date(a.weekStartsOn) >= thisMonday())
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function TodayPage() {
  const { user } = useAuth();
  const { detail, loading } = useMyStudentDetail();
  const [bookings, setBookings] = useState<BookingPublic[]>([]);

  useEffect(() => {
    apiFetch<{ data: BookingPublic[] }>("/api/bookings")
      .then((r) => setBookings(r.data))
      .catch(() => {});
  }, []);

  const now = useNow();
  const todayStr = ymd(now);
  const todayBooking = bookings.find(
    (b) => b.status === "CONFIRMED" && ymd(new Date(b.startsAt)) === todayStr,
  );
  const nextBooking = bookings
    .filter((b) => b.status === "CONFIRMED" && new Date(b.startsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];

  const weekly = thisWeeksAssignments(detail);
  const done = weekly.filter((a) => a.status === "COMPLETED").length;
  const total = weekly.length;
  const nextUp = weekly.find((a) => a.status !== "COMPLETED");

  const recentTakes = detail?.takes.slice(0, 3) ?? [];
  const unreviewedSent = detail?.takes.filter((t) => t.status === "UNREVIEWED").length ?? 0;
  const repliedNotSeen = detail?.takes.filter((t) => t.status === "REPLIED").length ?? 0;

  const dateLabel = now.toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const firstName = (user?.name ?? "there").split(" ")[0];

  return (
    <STFrame side="home">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">{dateLabel}</h2>
          <div className="dt-sub">
            {greetingFor(now)}, {firstName} —{" "}
            {todayBooking
              ? `lesson today at ${formatTime(todayBooking.startsAt)}`
              : nextBooking
              ? `next lesson ${new Date(nextBooking.startsAt).toLocaleDateString([], {
                  weekday: "short",
                })} ${formatTime(nextBooking.startsAt)}`
              : "no upcoming lessons"}
            {total > 0 && (
              <>
                {" · "}
                {done} of {total} stops done
              </>
            )}
          </div>
        </div>
        <div className="row gap-2">
          {detail?.streak && detail.streak.currentDays > 0 && (
            <span className="chip" style={{ background: "var(--highlight)" }}>
              🔥 {detail.streak.currentDays}d streak
            </span>
          )}
          <Link to="/practice" className="btn small primary">
            <Icon name="play" size={11} stroke="white" /> start today's path
          </Link>
        </div>
      </div>

      <div className="dt-main-body">
        <div className="dt-cols thirds" style={{ gridTemplateColumns: "1fr 1fr 1fr", height: "100%" }}>
          {/* TODAY — lesson + path */}
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Today</div>
              {todayBooking && <span className="chip tiny accent">lesson</span>}
            </div>
            <div className="panel-body scroll col gap-3" style={{ paddingTop: 12 }}>
              {todayBooking ? (
                <TodayLessonCard booking={todayBooking} now={now} />
              ) : nextBooking ? (
                <UpcomingLessonCard booking={nextBooking} />
              ) : (
                <NoLessonCard />
              )}

              <PracticeProgressCard
                done={done}
                total={total}
                nextUp={nextUp}
                loading={loading}
              />

              {detail?.streak && (
                <StreakCard
                  currentDays={detail.streak.currentDays}
                  longestDays={detail.streak.longestDays}
                />
              )}
            </div>
          </div>

          {/* THIS WEEK — assignments */}
          <div className="panel tinted">
            <div className="panel-head">
              <div className="panel-title">This week</div>
              <span className="chip tiny">{total} items</span>
            </div>
            <div className="panel-body scroll col gap-2">
              {loading && !detail && <div className="small muted">Loading…</div>}
              {!loading && weekly.length === 0 && (
                <div className="small muted">
                  Nothing assigned for this week yet. Your teacher will drop items here after your
                  next lesson.
                </div>
              )}
              {weekly.map((a) => (
                <AssignmentRow key={a.id} a={a} />
              ))}
            </div>
          </div>

          {/* NOTES + TAKES */}
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">From your teacher</div>
              {detail?.latestNoteBookingId && (
                <Link to={`/my-notes/${detail.latestNoteBookingId}`} className="btn small ghost">
                  read note →
                </Link>
              )}
            </div>
            <div className="panel-body scroll col gap-3">
              {detail?.latestNoteSections?.intro || detail?.latestNotePracticeNotes ? (
                <Link
                  to={
                    detail.latestNoteBookingId
                      ? `/my-notes/${detail.latestNoteBookingId}`
                      : "/my-notes"
                  }
                  className="box"
                  style={{ textDecoration: "none", color: "inherit", position: "relative" }}
                >
                  <div className="corner">latest note</div>
                  <div className="row between mb-1 mt-1">
                    <span className="wf-scrawl bold" style={{ fontSize: 18 }}>
                      {detail.latestNoteStartsAt
                        ? `After ${new Date(detail.latestNoteStartsAt).toLocaleDateString([], {
                            weekday: "long",
                          })}'s lesson`
                        : "Most recent note"}
                    </span>
                  </div>
                  <Squiggle w={50} color="var(--ink-faint)" />
                  <div className="small mt-2" style={{ whiteSpace: "pre-line", lineHeight: 1.5 }}>
                    {(detail.latestNoteSections?.intro || detail.latestNotePracticeNotes || "")
                      .toString()
                      .slice(0, 140)}
                    {(detail.latestNoteSections?.intro || detail.latestNotePracticeNotes || "")
                      .toString().length > 140
                      ? "…"
                      : ""}
                  </div>
                </Link>
              ) : (
                !loading && (
                  <div className="small muted">
                    No practice notes yet. They'll appear here after your first lesson.
                  </div>
                )
              )}

              {detail?.latestLessonSummary && (
                <div className="ai-summary compact">
                  <div className="ai-summary-head">
                    <span className="ai-badge">✦ AI</span>
                    <span className="ai-title">lesson summary</span>
                    {detail.latestLessonSummary.durationMin && (
                      <span className="ai-meta">{detail.latestLessonSummary.durationMin} min</span>
                    )}
                  </div>
                  <ul className="ai-bullets">
                    {detail.latestLessonSummary.bullets.slice(0, 3).map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="hr-hand" />

              <div className="small muted">YOUR TAKES</div>
              {recentTakes.length === 0 ? (
                <div className="small muted">
                  Nothing sent yet. Record a take from the practice path.
                </div>
              ) : (
                recentTakes.map((t) => <TakeRow key={t.id} take={t} />)
              )}
              {(unreviewedSent > 0 || repliedNotSeen > 0) && (
                <div className="row gap-2 small">
                  {unreviewedSent > 0 && <Tag>{unreviewedSent} awaiting reply</Tag>}
                  {repliedNotSeen > 0 && <Tag color="coral">{repliedNotSeen} replied</Tag>}
                </div>
              )}
              <Link to="/my-takes" className="btn small ghost">all takes →</Link>
            </div>
          </div>
        </div>
      </div>
    </STFrame>
  );
}

function TodayLessonCard({ booking, now }: { booking: BookingPublic; now: Date }) {
  const coachName = booking.coach?.name ?? "your teacher";
  const piece = booking.skillTree?.title ?? booking.category?.title ?? "lesson";
  const durMin = Math.max(
    1,
    Math.round((new Date(booking.endsAt).getTime() - new Date(booking.startsAt).getTime()) / 60_000),
  );
  const isLive = new Date(booking.startsAt) <= now && new Date(booking.endsAt) > now;
  const corner = isLive ? "live now" : relativeFromNow(booking.startsAt, now);
  return (
    <div className="box thick" style={{ position: "relative" }}>
      <div className="corner">{corner}</div>
      <div className="row gap-3">
        <Avatar name={coachName} size={46} />
        <div className="grow">
          <div className="bold big">with {coachName.split(" ")[0]}</div>
          <div className="small muted">
            {formatTime(booking.startsAt)} · {durMin} min ·{" "}
            {booking.mode === "ONLINE" ? "online" : "in person"} · {piece}
          </div>
        </div>
      </div>
      <Squiggle w={70} color="var(--ink-faint)" />
      {booking.studentNote && (
        <div className="small mt-2" style={{ fontStyle: "italic" }}>"{booking.studentNote}"</div>
      )}
      <div className="row gap-2 mt-2">
        <Link to={`/my-bookings/${booking.id}`} className="btn small grow">open session</Link>
        {booking.mode === "ONLINE" && (
          <Link to={`/my-bookings/${booking.id}`} className="btn small primary">
            {isLive ? "rejoin call ↗" : "join call ↗"}
          </Link>
        )}
      </div>
    </div>
  );
}

function UpcomingLessonCard({ booking }: { booking: BookingPublic }) {
  const coachName = booking.coach?.name ?? "your teacher";
  return (
    <div className="box">
      <div className="row gap-3">
        <Avatar name={coachName} size={36} />
        <div className="grow">
          <div className="bold">Next lesson</div>
          <div className="tiny muted">
            {new Date(booking.startsAt).toLocaleDateString([], {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}{" "}
            · {formatTime(booking.startsAt)} · with {coachName.split(" ")[0]}
          </div>
        </div>
      </div>
      <Link to="/my-bookings" className="btn small ghost mt-2">view bookings →</Link>
    </div>
  );
}

function NoLessonCard() {
  return (
    <div
      className="box dashed"
      style={{ textAlign: "center", padding: "20px 14px", color: "var(--ink-soft)" }}
    >
      <div className="wf-scrawl bold" style={{ fontSize: 22, color: "var(--ink)" }}>
        No lesson today.
      </div>
      <div className="small muted mt-2">A quiet practice day — make the most of it.</div>
      <div className="row gap-2 mt-3" style={{ justifyContent: "center" }}>
        <Link to="/book" className="btn small primary">book a lesson</Link>
        <Link to="/my-bookings" className="btn small ghost">view upcoming</Link>
      </div>
    </div>
  );
}

function PracticeProgressCard({
  done,
  total,
  nextUp,
  loading,
}: {
  done: number;
  total: number;
  nextUp: AssignmentPublic | undefined;
  loading: boolean;
}) {
  if (loading && total === 0) return null;
  if (total === 0) {
    return (
      <div className="box dashed">
        <div className="bold">No path yet</div>
        <div className="tiny muted mt-1">
          Once your teacher assigns items, your practice path appears here.
        </div>
      </div>
    );
  }
  const pct = total > 0 ? (done / total) * 100 : 0;
  return (
    <div className="box">
      <div className="row between mb-2">
        <div className="bold">Today's path</div>
        <span className="tiny muted">{done} / {total} stops</span>
      </div>
      <div className="progress"><i style={{ width: `${pct}%` }} /></div>
      {nextUp && (
        <div className="small mt-2">
          Up next: <span className="bold">{nextUp.title}</span>
          {nextUp.tempoBpmEnd ? ` · ${nextUp.tempoBpmEnd} bpm` : ""}
        </div>
      )}
      <div className="row gap-2 mt-2">
        <Link to="/practice" className="btn small primary grow">
          <Icon name="play" size={11} stroke="white" />
          {done === 0 ? "begin" : done === total ? "open path" : "continue"}
        </Link>
      </div>
    </div>
  );
}

function StreakCard({ currentDays, longestDays }: { currentDays: number; longestDays: number }) {
  return (
    <div className="box small">
      <div className="row between">
        <div>
          <div className="wf-scrawl bold" style={{ fontSize: 22, lineHeight: 1 }}>
            🔥 {currentDays}d
          </div>
          <div className="tiny muted">current streak</div>
        </div>
        <div className="muted small">
          best <span className="bold">{longestDays}d</span>
        </div>
      </div>
    </div>
  );
}

function AssignmentRow({ a }: { a: AssignmentPublic }) {
  const icon = ASSIGNMENT_ICON[a.type];
  const isDone = a.status === "COMPLETED";
  const isCurrent = a.hasNotePinned || a.type === "SONG";
  const to = a.type === "SONG" ? `/practice/record/${a.id}` : `/practice/exercise/${a.id}`;
  const sub = [
    a.subtitle,
    a.tempoBpmStart && a.tempoBpmEnd && a.tempoBpmStart !== a.tempoBpmEnd
      ? `${a.tempoBpmStart} → ${a.tempoBpmEnd} bpm`
      : a.tempoBpmStart
      ? `${a.tempoBpmStart} bpm`
      : null,
    a.durationMin ? `${a.durationMin} min` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      to={to}
      className={"box small row gap-3" + (isDone ? " filled" : "")}
      style={{
        textDecoration: "none",
        color: "inherit",
        borderColor: isCurrent && !isDone ? "var(--accent)" : undefined,
      }}
    >
      <div className={"checkbox" + (isDone ? " done" : "")} style={{ width: 18, height: 18 }} />
      <Icon name={icon} size={16} stroke={a.type === "SONG" ? "var(--accent)" : "currentColor"} />
      <div className="grow">
        <div className={isDone ? "scribble-through" : "bold"}>{a.title}</div>
        <div className="tiny muted">{sub}</div>
      </div>
      {!isDone && a.type === "SONG" && a.dueAt && (
        <Tag color="coral">
          due {new Date(a.dueAt).toLocaleDateString([], { weekday: "short" })}
        </Tag>
      )}
      {isDone && <span className="tiny muted">{a.completionCount}×</span>}
      <Icon name="chev" size={11} stroke="var(--ink-faint)" />
    </Link>
  );
}

function TakeRow({ take }: { take: StudentDetailPublic["takes"][number] }) {
  const status = take.status === "UNREVIEWED" ? "waiting" : take.status === "REPLIED" ? "replied" : "in review";
  const statusColor = take.status === "REPLIED" ? "coral" : undefined;
  return (
    <div className="box small">
      <div className="row between">
        <div className="small">
          <span className="bold">{take.pieceTitle}</span>
          {take.bars ? ` · ${take.bars}` : ""}
        </div>
        <Tag color={statusColor as "coral" | undefined}>{status}</Tag>
      </div>
      <div className="tiny muted mt-1">
        take {take.takeNumber} · {Math.floor(take.durationSec / 60)}:
        {String(take.durationSec % 60).padStart(2, "0")} ·{" "}
        {new Date(take.createdAt).toLocaleDateString([], { weekday: "short" })}
      </div>
    </div>
  );
}
