import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { BookingPublic } from "@sunbird/shared";
import { apiFetch } from "@/lib/api";
import { DTFrame } from "../components/DTFrame";
import { WFFrame } from "../components/WFFrame";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { Tag } from "../components/Tag";
import { Squiggle } from "../components/Squiggle";
import { WaveBars, waveHeights } from "../components/WaveBars";
import { useIsMobile } from "../hooks/useIsMobile";

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

function RosterDesktop({
  bookings,
  students,
}: { bookings: BookingPublic[]; students: StudentInfo[] }) {
  const now = new Date();
  const todayStr = ymd(now);

  const todayBookings = bookings.filter(
    (b) => b.status === "CONFIRMED" && ymd(new Date(b.startsAt)) === todayStr,
  );
  const needsAttention = bookings.filter(
    (b) =>
      (b.status === "CONFIRMED" && new Date(b.startsAt) <= now && !b.practiceNotes) ||
      (b.status === "COMPLETED" && !b.practiceNotes),
  );

  const dateLabel = now.toLocaleDateString([], {
    weekday: "long", month: "short", day: "numeric",
  });

  return (
    <DTFrame side="roster">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">{dateLabel}</h2>
          <div className="dt-sub">
            Good morning, K — {todayBookings.length} lesson{todayBookings.length === 1 ? "" : "s"} today,{" "}
            {needsAttention.length} thing{needsAttention.length === 1 ? "" : "s"} need you
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
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Lessons today</div>
              <span className="chip tiny">{todayBookings.length}</span>
            </div>
            <div className="panel-body scroll col gap-3">
              {todayBookings.length === 0 && (
                <>
                  <TodayBookingDemoCard />
                  <TodayBookingSmallDemoCard />
                </>
              )}
              {todayBookings.map((b, i) => (
                <TodayBookingCard key={b.id} booking={b} prominent={i === 0} />
              ))}
              <div className="postit small wf-scrawl" style={{ transform: "rotate(-0.6deg)" }}>
                Reminder: send Lina's parents the recital sign-up by EOD
              </div>
            </div>
          </div>

          {/* Needs you */}
          <div className="panel tinted">
            <div className="panel-head">
              <div className="panel-title">Needs you</div>
              <span className="chip tiny accent">{Math.max(needsAttention.length, 4)}</span>
            </div>
            <div className="panel-body scroll col gap-3">
              <div className="box accent" style={{ borderWidth: 2 }}>
                <div className="row between">
                  <div className="row gap-2">
                    <Avatar name="Maya" size={32} />
                    <div>
                      <div className="bold">Maya · new take</div>
                      <div className="tiny muted">River Flows · bars 16-24 · 0:48</div>
                    </div>
                  </div>
                  <span className="tiny muted">2h ago</span>
                </div>
                <WaveBars heights={waveHeights(11, 28)} played={0} />
                <div className="row gap-2 mt-2">
                  <Link to="/coach/takes/maya-river-3" className="btn small accent grow">review &amp; reply</Link>
                  <button className="btn icon ghost"><Icon name="play" size={12} /></button>
                </div>
              </div>

              <div className="box">
                <div className="row between">
                  <div className="row gap-2">
                    <Avatar name="Theo" size={32} />
                    <div>
                      <div className="bold">Theo · new take</div>
                      <div className="tiny muted">Blackbird · 1:12 · self-rated ★★☆☆☆</div>
                    </div>
                  </div>
                  <span className="tiny muted">yesterday</span>
                </div>
                <div className="small mt-1 muted">"the second verse keeps tripping"</div>
              </div>

              <div className="box">
                <div className="row gap-2">
                  <Avatar name="Sam" size={32} />
                  <div className="grow">
                    <div className="bold">Sam's mom · voice msg</div>
                    <div className="tiny muted">0:22 · about Tuesday's reschedule</div>
                  </div>
                  <Icon name="play" size={14} />
                </div>
              </div>

              <div className="box dashed">
                <div className="row gap-2">
                  <Avatar name="Ana" size={32} />
                  <div className="grow">
                    <div className="bold">Ana · weekly plan due</div>
                    <div className="tiny muted">last sent 8 days ago</div>
                  </div>
                  <button className="btn small">plan</button>
                </div>
              </div>
            </div>
          </div>

          {/* This week */}
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">This week</div>
              <div className="pill-row">
                <span className="p">week</span>
                <span className="p on">studio</span>
              </div>
            </div>
            <div className="panel-body scroll col gap-3">
              <div className="row gap-2 small muted">
                <span>{students.length || 23} students</span><span>·</span>
                <span>18 active this week</span><span>·</span>
                <span>11 takes received</span>
              </div>

              {/* mini calendar */}
              <div className="box small">
                <div className="row between mb-2">
                  <span className="bold">Apr 15 – 21</span>
                  <span className="tiny muted">14 lessons booked</span>
                </div>
                <div className="row gap-1" style={{ height: 60 }}>
                  {[
                    { d: "M", h: [3, 2, 1] },
                    { d: "T", h: [2, 3, 2, 1] },
                    { d: "W", h: [2, 1, 2] },
                    { d: "T", h: [3, 2] },
                    { d: "F", h: [2, 2], today: true },
                    { d: "S", h: [] as number[] },
                    { d: "S", h: [] as number[] },
                  ].map((day, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, alignItems: "stretch" }}>
                      <div className="tiny center" style={{ color: day.today ? "var(--accent)" : "var(--ink-soft)" }}>{day.d}</div>
                      <div style={{
                        flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: 2,
                        border: "1px solid var(--ink-faint)", borderRadius: 4,
                        background: day.today ? "var(--accent-soft)" : "var(--paper)",
                      }}>
                        {day.h.map((n, j) => (
                          <div key={j} style={{ flex: 1, background: "var(--ink)", opacity: 0.3 + n * 0.2, borderRadius: 2 }} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="small muted mb-2">RECENT ACTIVITY</div>
                <div className="col gap-2">
                  {[
                    { who: "Maya", what: "sent a take", when: "2h" },
                    { who: "Lina", what: "completed warmup ×3", when: "4h" },
                    { who: "Theo", what: "opened your notes", when: "6h" },
                    { who: "Jonas", what: "streak +1 · 6d", when: "y" },
                    { who: "Reza", what: "missed practice goal", when: "2d" },
                  ].map((a, i) => (
                    <div key={i} className="row gap-2 small">
                      <Avatar name={a.who} size={22} />
                      <span><span className="bold">{a.who}</span> {a.what}</span>
                      <span className="muted tiny" style={{ marginLeft: "auto" }}>{a.when}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hr-hand" />

              <button className="btn small ghost">open inbox →</button>
            </div>
          </div>
        </div>
      </div>
    </DTFrame>
  );
}

function TodayBookingDemoCard() {
  return (
    <div className="box thick" style={{ position: "relative" }}>
      <div className="corner">in 5h 18m</div>
      <div className="row gap-3">
        <Avatar name="Maya" size={46} />
        <div className="grow">
          <div className="bold big">Maya R. <span className="muted small">· 14 · piano</span></div>
          <div className="small muted">3:00 PM · 30 min · online</div>
        </div>
      </div>
      <Squiggle w={70} color="var(--ink-faint)" />
      <div className="small mt-2">
        Today's plan: <span className="hi">River Flows bars 16-24</span>, Hanon № 4 review
      </div>
      <div className="row gap-2 mt-2">
        <Tag color="coral">new take to review</Tag>
        <Tag>3 prep items</Tag>
      </div>
      <div className="row gap-2 mt-2">
        <Link to="/coach/student/maya" className="btn small grow">open lesson page</Link>
        <Link to="/coach/live/maya" className="btn small primary">join call ↗</Link>
      </div>
    </div>
  );
}

function TodayBookingSmallDemoCard() {
  return (
    <div className="box">
      <div className="row gap-3">
        <Avatar name="Jonas" size={40} />
        <div className="grow">
          <div className="bold">Jonas K. <span className="muted small">· 11 · piano</span></div>
          <div className="small muted">4:00 PM · 30 min · in person</div>
        </div>
      </div>
      <div className="small mt-2 muted">Hanon № 4 · prep checklist 2/3 done</div>
      <div className="row gap-2 mt-2">
        <Link to="/coach/student/jonas" className="btn small grow">open lesson</Link>
        <button className="btn small ghost">message</button>
      </div>
    </div>
  );
}

function TodayBookingCard({ booking, prominent }: { booking: BookingPublic; prominent: boolean }) {
  const name = booking.user?.name ?? "Student";
  const slug = booking.user?.id ?? studentIdSlug(name, booking.id);
  const piece = booking.skillTree?.title ?? booking.category?.title ?? "Lesson";
  return (
    <div className={prominent ? "box thick" : "box"} style={{ position: "relative" }}>
      {prominent && <div className="corner">{formatTime(booking.startsAt)}</div>}
      <div className="row gap-3">
        <Avatar name={name} size={prominent ? 46 : 40} />
        <div className="grow">
          <div className={prominent ? "bold big" : "bold"}>
            {name}{" "}
            <span className="muted small">· {booking.mode === "ONLINE" ? "online" : "in person"}</span>
          </div>
          <div className="small muted">{formatTime(booking.startsAt)} · {piece}</div>
        </div>
      </div>
      {booking.studentNote && (
        <div className="small mt-2 muted" style={{ fontStyle: "italic" }}>"{booking.studentNote}"</div>
      )}
      <div className="row gap-2 mt-2">
        <Link to={`/coach/student/${slug}`} className="btn small grow">open lesson page</Link>
        {booking.mode === "ONLINE" && (
          <Link to={`/coach/live/${booking.id}`} className="btn small primary">join call ↗</Link>
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
  const [bookings, setBookings] = useState<BookingPublic[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);

  useEffect(() => {
    apiFetch<{ data: BookingPublic[] }>("/api/bookings")
      .then((r) => setBookings(r.data))
      .catch(() => { /* keep design's mock content visible */ });
    apiFetch<{ data: StudentInfo[] }>("/api/coaches/students")
      .then((r) => setStudents(r.data))
      .catch(() => { /* DTFrame's shared hook also fetches and will fill in */ });
  }, []);

  return isMobile ? <RosterMobile /> : <RosterDesktop bookings={bookings} students={students} />;
}
