import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type {
  BookingPublic,
  CoachDashboardPublic,
  MissingNotesItem,
  PlanGapItem,
  UnreviewedTakeItem,
} from "@sunbird/shared";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { DTFrame } from "../components/DTFrame";
import { WFFrame } from "../components/WFFrame";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { Tag } from "../components/Tag";
import { Squiggle } from "../components/Squiggle";
import { WaveBars, waveHeights } from "../components/WaveBars";
import { useIsMobile } from "../hooks/useIsMobile";
import { useCoachDashboard } from "../hooks/useCoachData";
import { useNow } from "../hooks/useNow";

function firstName(full: string | undefined): string {
  if (!full) return "there";
  return full.trim().split(/\s+/)[0];
}

function greetingFor(now: Date): string {
  const h = now.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

type StudentInfo = {
  id: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  email: string;
  bookingCount: number;
  lastLessonAt: string;
};

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function studentIdSlug(name: string, fallback: string): string {
  const slug = name.toLowerCase().split(/\s+/)[0].replace(/[^a-z]/g, "");
  return slug || fallback;
}

// Small per-card tilt for the .box.wobble cards. Alternates direction
// and uses a couple of magnitudes so a column doesn't look like a
// perfectly-spaced fan. Snaps to 0 on hover via CSS.
function wobbleRotation(i: number): string {
  const angles = [-0.4, 0.3, -0.25, 0.45];
  return `rotate(${angles[i % angles.length]}deg)`;
}

function RosterDesktop({
  bookings,
  students,
  dashboard,
  dashboardLoading,
  coachName,
}: {
  bookings: BookingPublic[];
  students: StudentInfo[];
  dashboard: CoachDashboardPublic | undefined;
  dashboardLoading: boolean;
  coachName: string | undefined;
}) {
  const now = useNow();
  const todayStr = ymd(now);

  const todayBookings = bookings.filter(
    (b) => b.status === "CONFIRMED" && ymd(new Date(b.startsAt)) === todayStr,
  );
  const needsCount =
    (dashboard?.unreviewedTakes.length ?? 0) +
    (dashboard?.bookingsMissingNotes.length ?? 0) +
    (dashboard?.studentsWithoutPlan.length ?? 0);

  const dateLabel = now.toLocaleDateString([], {
    weekday: "long", month: "short", day: "numeric",
  });

  return (
    <DTFrame side="roster">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">{dateLabel}</h2>
          <div className="dt-sub">
            {greetingFor(now)}, {firstName(coachName)} — {todayBookings.length} lesson
            {todayBookings.length === 1 ? "" : "s"} today, {needsCount} thing
            {needsCount === 1 ? "" : "s"} need you
          </div>
        </div>
        <div className="row gap-2">
          <span className="chip"><Icon name="clock" size={11}/> {formatTime(now.toISOString())}</span>
          <span className="chip" style={{ background: "var(--highlight)" }}>🔥 {students.length || 23} students</span>
          <Link to="/coach/library" className="btn small">＋ from library</Link>
          <Link to="/coach/midi/capture" className="btn small primary">＋ create exercise</Link>
        </div>
      </div>

      <div className="dt-main-body">
        <div className="dt-cols thirds" style={{ gridTemplateColumns: "1fr 1fr 1fr", height: "100%" }}>
          {/* Today's lessons */}
          <div className="panel panel-cool">
            <div className="panel-head">
              <div className="panel-title">Lessons today</div>
              <span className="chip tiny">{todayBookings.length}</span>
            </div>
            <div className="panel-body scroll col gap-3" style={{ paddingTop: 12 }}>
              {todayBookings.length === 0 ? (
                <div
                  className="box dashed"
                  style={{
                    textAlign: "center",
                    padding: "24px 14px",
                    color: "var(--ink-soft)",
                  }}
                >
                  <div className="wf-scrawl bold" style={{ fontSize: 22, color: "var(--ink)" }}>
                    No lessons today.
                  </div>
                  <div className="small muted mt-2">
                    A clear day for the studio. Drop one onto a student's week from the
                    library, or block out practice time.
                  </div>
                  <div className="row gap-2 mt-3" style={{ justifyContent: "center" }}>
                    <Link to="/coach/calendar" className="btn small">view week</Link>
                    <Link to="/coach/library" className="btn small ghost">open library</Link>
                  </div>
                </div>
              ) : (
                todayBookings.map((b, i) => (
                  <TodayBookingCard key={b.id} booking={b} prominent={i === 0} now={now} index={i} />
                ))
              )}
            </div>
          </div>

          {/* Needs you */}
          <NeedsYouPanel dashboard={dashboard} loading={dashboardLoading} now={now} />

          {/* This week */}
          <ThisWeekPanel dashboard={dashboard} loading={dashboardLoading} totalStudents={students.length} />
        </div>
      </div>
    </DTFrame>
  );
}

function NeedsYouPanel({
  dashboard,
  loading,
  now,
}: {
  dashboard: CoachDashboardPublic | undefined;
  loading: boolean;
  now: Date;
}) {
  const takes = dashboard?.unreviewedTakes ?? [];
  const missingNotes = dashboard?.bookingsMissingNotes ?? [];
  const planGaps = dashboard?.studentsWithoutPlan ?? [];
  const total = takes.length + missingNotes.length + planGaps.length;

  return (
    <div className={"panel " + (total > 0 ? "panel-warm" : "tinted")}>
      <div className="panel-head">
        <div className="panel-title">Needs you</div>
        {total > 0 && <span className="chip tiny accent">{total}</span>}
      </div>
      <div className="panel-body scroll col gap-3">
        {loading && !dashboard && <div className="small muted">Loading…</div>}

        {!loading && total === 0 && (
          <div
            className="box dashed"
            style={{ textAlign: "center", padding: "24px 14px", color: "var(--ink-soft)" }}
          >
            <div className="wf-scrawl bold" style={{ fontSize: 22, color: "var(--ink)" }}>
              All caught up.
            </div>
            <div className="small muted mt-2">
              No unreviewed takes, no missing notes, no weekly plans overdue.
            </div>
          </div>
        )}

        {takes.map((t, i) => (
          <UnreviewedTakeCard key={t.take.id} item={t} index={i} />
        ))}

        {missingNotes.map((m, i) => (
          <MissingNotesCard key={m.booking.id} item={m} index={takes.length + i} />
        ))}

        {planGaps.map((g, i) => (
          <PlanGapCard key={g.student.id} item={g} now={now} index={takes.length + missingNotes.length + i} />
        ))}
      </div>
    </div>
  );
}

function UnreviewedTakeCard({ item, index }: { item: UnreviewedTakeItem; index: number }) {
  const t = item.take;
  const heights = waveHeights(t.id.charCodeAt(0) + t.id.length, 28);
  const ageLabel =
    item.ageHours < 1
      ? "just now"
      : item.ageHours < 24
      ? `${Math.round(item.ageHours)}h ago`
      : `${Math.floor(item.ageHours / 24)}d ago`;
  const dur = `${Math.floor(t.durationSec / 60)}:${String(t.durationSec % 60).padStart(2, "0")}`;
  return (
    <div className="box accent wobble" style={{ transform: wobbleRotation(index) }}>
      <div className="row between">
        <div className="row gap-2">
          <Avatar name={item.student.name} size={32} />
          <div>
            <div className="bold">{item.student.name.split(" ")[0]} · new take</div>
            <div className="tiny muted">
              {t.pieceTitle}
              {t.bars ? ` · ${t.bars}` : ""} · {dur}
            </div>
          </div>
        </div>
        <span className="tiny muted">{ageLabel}</span>
      </div>
      <WaveBars heights={heights} played={0} />
      {t.selfNote && (
        <div className="small mt-1 muted" style={{ fontStyle: "italic" }}>
          "{t.selfNote}"
        </div>
      )}
      <div className="row gap-2 mt-2">
        <Link to={`/coach/takes/${t.id}`} className="btn small accent grow">
          review &amp; reply
        </Link>
        <button className="btn icon ghost"><Icon name="play" size={12} /></button>
      </div>
    </div>
  );
}

function MissingNotesCard({ item, index }: { item: MissingNotesItem; index: number }) {
  const b = item.booking;
  const name = b.user?.name ?? "Student";
  const slug = b.user?.id ?? b.id;
  const ageLabel =
    item.daysAgo === 0 ? "today" : item.daysAgo === 1 ? "yesterday" : `${item.daysAgo}d ago`;
  return (
    <div className="box wobble" style={{ transform: wobbleRotation(index) }}>
      <div className="row between">
        <div className="row gap-2">
          <Avatar name={name} size={32} />
          <div>
            <div className="bold">
              {name.split(" ")[0]} · note unsent
            </div>
            <div className="tiny muted">lesson {ageLabel} · needs a practice note</div>
          </div>
        </div>
        <Link to={`/coach/student/${slug}`} className="btn small">write</Link>
      </div>
    </div>
  );
}

function PlanGapCard({ item, now, index }: { item: PlanGapItem; now: Date; index: number }) {
  const daysSince = item.lastBookingAt
    ? Math.max(0, Math.floor((now.getTime() - new Date(item.lastBookingAt).getTime()) / 86_400_000))
    : null;
  return (
    <div className="box dashed wobble" style={{ transform: wobbleRotation(index) }}>
      <div className="row gap-2">
        <Avatar name={item.student.name} size={32} />
        <div className="grow">
          <div className="bold">{item.student.name.split(" ")[0]} · weekly plan due</div>
          <div className="tiny muted">
            {daysSince == null ? "no recent lesson" : daysSince === 0 ? "last lesson today" : `last lesson ${daysSince}d ago`}
          </div>
        </div>
        <Link to={`/coach/student/${item.student.id}`} className="btn small">plan</Link>
      </div>
    </div>
  );
}

function ThisWeekPanel({
  dashboard,
  loading,
  totalStudents,
}: {
  dashboard: CoachDashboardPublic | undefined;
  loading: boolean;
  totalStudents: number;
}) {
  const stats = dashboard?.weekStats;
  const density = dashboard?.weekDensity ?? [];
  const activity = dashboard?.recentActivity ?? [];
  const maxLessonsAnyDay = density.reduce((m, d) => Math.max(m, d.lessonCount), 0) || 1;

  const weekStart = dashboard?.weekStartsOn ? new Date(dashboard.weekStartsOn) : null;
  const weekEnd = weekStart
    ? new Date(weekStart.getTime() + 6 * 86_400_000)
    : null;
  const weekLabel =
    weekStart && weekEnd
      ? `${weekStart.toLocaleDateString([], { month: "short", day: "numeric" })} – ${weekEnd.getDate()}`
      : "this week";

  return (
    <div className="panel" style={{ background: "transparent" }}>
      <div className="panel-head">
        <div className="panel-title">This week</div>
        <div className="pill-row">
          <span className="p">week</span>
          <span className="p on">studio</span>
        </div>
      </div>
      <div className="panel-body scroll col gap-3">
        {loading && !dashboard && <div className="small muted">Loading…</div>}

        <div className="row gap-2 small muted">
          <span>{stats?.totalStudents ?? totalStudents} students</span><span>·</span>
          <span>{stats?.activeThisWeek ?? 0} active this week</span><span>·</span>
          <span>{stats?.takesReceivedThisWeek ?? 0} takes received</span>
        </div>

        {/* mini calendar */}
        <div className="box small">
          <div className="row between mb-2">
            <span className="bold">{weekLabel}</span>
            <span className="tiny muted">
              {stats?.bookingsThisWeek ?? 0} lesson{(stats?.bookingsThisWeek ?? 0) === 1 ? "" : "s"} booked
            </span>
          </div>
          <div className="row gap-1" style={{ height: 60 }}>
            {density.map((day) => (
              <div
                key={day.date}
                style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, alignItems: "stretch" }}
              >
                <div
                  className="tiny center"
                  style={{ color: day.isToday ? "var(--accent)" : "var(--ink-soft)" }}
                >
                  {day.dayLabel}
                </div>
                <div
                  style={{
                    flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: 2,
                    border: "1px solid var(--ink-faint)", borderRadius: 4,
                    background: day.isToday ? "var(--accent-soft)" : "var(--paper)",
                    justifyContent: "flex-end",
                  }}
                >
                  {Array.from({ length: day.lessonCount }).map((_, j) => (
                    <div
                      key={j}
                      style={{
                        flex: 1,
                        background: "var(--ink)",
                        opacity: 0.4 + 0.5 * (day.lessonCount / maxLessonsAnyDay),
                        borderRadius: 2,
                        minHeight: 4,
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="small muted mb-2">RECENT ACTIVITY</div>
          {activity.length === 0 ? (
            <div className="small muted">No activity yet this week.</div>
          ) : (
            <div className="col gap-2">
              {activity.map((a, i) => {
                const firstName = a.student.name.split(" ")[0];
                const ageMs = Date.now() - new Date(a.at).getTime();
                const ageLabel =
                  ageMs < 3_600_000
                    ? `${Math.max(1, Math.round(ageMs / 60_000))}m`
                    : ageMs < 86_400_000
                    ? `${Math.round(ageMs / 3_600_000)}h`
                    : ageMs < 2 * 86_400_000
                    ? "y"
                    : `${Math.floor(ageMs / 86_400_000)}d`;
                return (
                  <div key={i} className="row gap-2 small">
                    <Avatar name={a.student.name} size={22} />
                    <span>
                      <span className="bold">{firstName}</span> {a.text}
                    </span>
                    <span className="muted tiny" style={{ marginLeft: "auto" }}>
                      {ageLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="hr-hand" />

        <Link to="/coach/inbox" className="btn small ghost">open inbox →</Link>
      </div>
    </div>
  );
}

function relativeFromNow(targetIso: string, now: Date): string {
  const diffMs = new Date(targetIso).getTime() - now.getTime();
  if (diffMs <= -60_000) {
    // already started or finished
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

function TodayBookingCard({
  booking,
  prominent,
  now,
  index,
}: {
  booking: BookingPublic;
  prominent: boolean;
  now: Date;
  index: number;
}) {
  const name = booking.user?.name ?? "Student";
  const slug = booking.user?.id ?? studentIdSlug(name, booking.id);
  const piece = booking.skillTree?.title ?? booking.category?.title ?? null;
  const durMin = Math.max(
    1,
    Math.round((new Date(booking.endsAt).getTime() - new Date(booking.startsAt).getTime()) / 60_000),
  );
  const mode = booking.mode === "ONLINE" ? "online" : "in person";
  const startTime = formatTime(booking.startsAt);
  const isLive = new Date(booking.startsAt) <= now && new Date(booking.endsAt) > now;
  const cornerLabel = isLive ? "live now" : relativeFromNow(booking.startsAt, now);

  return (
    <div
      className={(prominent ? "box thick wobble" : "box wobble")}
      style={{ position: "relative", transform: wobbleRotation(index) }}
    >
      <div className="corner">{prominent ? cornerLabel : startTime}</div>
      <div className="row gap-3">
        <Avatar name={name} size={prominent ? 46 : 40} />
        <div className="grow">
          <div className={prominent ? "bold big" : "bold"}>
            <Link
              to={`/coach/student/${slug}`}
              style={{ color: "inherit", textDecoration: "none" }}
            >
              {name}
            </Link>
          </div>
          <div className="small muted">
            {startTime} · {durMin} min · {mode}
            {piece ? <> · {piece}</> : null}
          </div>
        </div>
      </div>
      {prominent && <Squiggle w={70} color="var(--ink-faint)" />}
      {booking.studentNote && (
        <div className="small mt-2" style={{ fontStyle: "italic" }}>
          "{booking.studentNote}"
        </div>
      )}
      <div className="row gap-2 mt-2">
        <Link to={`/coach/student/${slug}`} className="btn small grow">
          open lesson page
        </Link>
        {booking.mode === "ONLINE" && (
          <Link to={`/coach/live/${booking.id}`} className="btn small primary">
            {isLive ? "rejoin call ↗" : "join call ↗"}
          </Link>
        )}
      </div>
    </div>
  );
}

function RosterMobile() {
  return (
    <WFFrame navActive="home">
      <div className="wf-header">
        <div>
          <h2 className="wf-title">Friday</h2>
          <div className="wf-subtitle">2 lessons · 4 need you</div>
        </div>
        <div className="wf-avatar">K</div>
      </div>
      <div className="wf-body col gap-3 scroll-y">
        <div className="seg">
          <div className="s on">today</div>
          <div className="s">needs you · 4</div>
          <div className="s">all</div>
        </div>

        <div className="box thick" style={{ position: "relative" }}>
          <div className="corner">3:00 PM</div>
          <div className="row gap-3">
            <Avatar name="Maya" size={40} />
            <div className="grow">
              <div className="bold">Maya R.</div>
              <div className="tiny muted">14 · piano · 30 min · online</div>
            </div>
          </div>
          <div className="small mt-2">River Flows + Hanon № 4</div>
          <div className="row gap-2 mt-2">
            <Tag color="coral">take · 0:48</Tag>
            <Tag>3 prep</Tag>
          </div>
          <Link to="/coach/student/maya" className="btn small primary mt-2" style={{ width: "100%" }}>open lesson</Link>
        </div>

        <div className="box">
          <div className="row gap-3">
            <Avatar name="Jonas" size={36} />
            <div className="grow">
              <div className="bold">Jonas K. <span className="tiny muted">4:00 PM</span></div>
              <div className="tiny muted">11 · piano · in person</div>
            </div>
          </div>
        </div>

        <div className="small muted">NEEDS YOU</div>
        <div className="box accent" style={{ borderWidth: 2 }}>
          <div className="row gap-2">
            <Avatar name="Theo" size={28} />
            <div className="grow small">
              <div className="bold">Theo · new take</div>
              <div className="tiny muted">Blackbird · 1:12</div>
            </div>
            <Link to="/coach/takes/theo-blackbird-1" className="btn small accent">review</Link>
          </div>
        </div>
        <div className="box">
          <div className="row gap-2">
            <Avatar name="Sam" size={28} />
            <div className="grow small">
              <div className="bold">Sam's mom · voice msg</div>
              <div className="tiny muted">0:22</div>
            </div>
            <Icon name="play" size={14} />
          </div>
        </div>
      </div>
    </WFFrame>
  );
}

export function RosterPage() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingPublic[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const { dashboard, loading: dashboardLoading } = useCoachDashboard();

  useEffect(() => {
    apiFetch<{ data: BookingPublic[] }>("/api/bookings")
      .then((r) => setBookings(r.data))
      .catch(() => { /* keep design's mock content visible */ });
    apiFetch<{ data: StudentInfo[] }>("/api/coaches/students")
      .then((r) => setStudents(r.data))
      .catch(() => { /* DTFrame's shared hook also fetches and will fill in */ });
  }, []);

  return isMobile ? (
    <RosterMobile />
  ) : (
    <RosterDesktop
      bookings={bookings}
      students={students}
      dashboard={dashboard}
      dashboardLoading={dashboardLoading}
      coachName={user?.name}
    />
  );
}
