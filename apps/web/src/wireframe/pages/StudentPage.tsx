import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { AssignmentPublic, NoteSections, RoutinePublic, StudentDetailPublic, TakePublic } from "@sunbird/shared";
import { DTFrame } from "../components/DTFrame";
import { WFFrame } from "../components/WFFrame";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { Tag } from "../components/Tag";
import { Squiggle } from "../components/Squiggle";
import { WaveBars, waveHeights } from "../components/WaveBars";
import { Staff } from "../components/Staff";
import { MockTag } from "../components/MockTag";
import { useIsMobile } from "../hooks/useIsMobile";
import { useStudentDetail } from "../hooks/useCoachData";
import { CurrentRoutine } from "@/components/coach/CurrentRoutine";
import { conversationsApi } from "@/lib/api";

// Open (or create) the conversation with `userId` and navigate to it.
function MessageButton({ userId, className }: { userId: string; className?: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={className ?? "btn small ghost"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const id = await conversationsApi.with(userId);
          navigate(`/messages/${id}`);
        } catch (err: any) {
          window.alert(err?.body?.error ?? "Couldn't open the conversation");
          setBusy(false);
        }
      }}
    >
      {busy ? "opening…" : "message"}
    </button>
  );
}

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatTenure(firstIso: string | null): string | null {
  if (!firstIso) return null;
  const start = new Date(firstIso);
  const now = new Date();
  const months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (months < 1) return "just started with you";
  if (months < 12) return `${months}mo with you`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m > 0 ? `${y}yr ${m}mo with you` : `${y}yr with you`;
}

function weekRangeLabel(): string {
  const now = new Date();
  const day = now.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const mon = new Date(now);
  mon.setDate(now.getDate() + offset);
  const fri = new Date(mon);
  fri.setDate(mon.getDate() + 4);
  return `${mon.toLocaleDateString([], { month: "short", day: "numeric" })}–${fri.getDate()}`;
}

function formatSelfRating(stars: number | null): string {
  if (stars == null) return "";
  return "★".repeat(stars) + "☆".repeat(Math.max(0, 5 - stars));
}

const ICON_BY_TYPE: Record<AssignmentPublic["type"], "metro" | "note" | "mic"> = {
  WARMUP: "metro",
  EXERCISE: "note",
  SONG: "mic",
};

const TYPE_LABEL: Record<AssignmentPublic["type"], string> = {
  WARMUP: "warmup",
  EXERCISE: "exercise",
  SONG: "song",
};

function NoteRow({ label, body, draft }: { label: string; body: React.ReactNode; draft?: boolean }) {
  return (
    <div className="ns-row">
      <div className="ns-label">{label}</div>
      <div className={"ns-body" + (draft ? " wf-scrawl" : "")}>{body}</div>
    </div>
  );
}

function StructuredNote({ sections }: { sections: NoteSections }) {
  const rows: Array<[string, string | undefined]> = [
    ["intro", sections.intro],
    ["scales & exercises done", sections.scalesExercises],
    ["topics discussed", sections.topics],
    ["song work", sections.songWork],
    ["other song suggestions", sections.otherSongs],
    ["next time", sections.nextTime],
  ];
  return (
    <div className="note-sections mt-1">
      {rows
        .filter(([, v]) => v && v.trim().length > 0)
        .map(([label, body]) => (
          <NoteRow key={label} label={label} body={<span style={{ whiteSpace: "pre-line" }}>{body}</span>} />
        ))}
    </div>
  );
}

function AssignmentCard({ a }: { a: AssignmentPublic }) {
  const icon = ICON_BY_TYPE[a.type];
  const accent = a.hasNotePinned;
  const tempo =
    a.tempoBpmStart && a.tempoBpmEnd && a.tempoBpmStart !== a.tempoBpmEnd
      ? `${a.tempoBpmStart} → ${a.tempoBpmEnd} bpm`
      : a.tempoBpmStart
      ? `${a.tempoBpmStart} bpm`
      : null;
  const sub = [TYPE_LABEL[a.type], tempo, a.durationMin ? `${a.durationMin} min` : null, a.hasMidi ? "MIDI" : null]
    .filter(Boolean)
    .join(" · ");

  // Sheet preview only for the demo Hanon exercise — keyed by title since we
  // don't yet store sheet refs on assignments.
  const showSheet = a.title.startsWith("Hanon");

  return (
    <div className="box mb-2" style={accent ? { borderColor: "var(--accent)" } : undefined}>
      <div className="row gap-3">
        <span className="drag-handle">⋮⋮</span>
        <Icon name={icon} size={18} stroke={a.type === "SONG" ? "var(--accent)" : "currentColor"} />
        <div className="grow">
          <div className="bold">{a.title}</div>
          <div className="tiny muted">{sub}</div>
        </div>
        {a.status === "COMPLETED" && <Tag>completed {a.completionCount > 0 ? `${a.completionCount}×` : ""}</Tag>}
        {a.status === "IN_PROGRESS" && a.completionCount > 0 && <Tag>{a.completionCount}× done</Tag>}
        {a.hasNotePinned && <Tag color="coral">your note pinned</Tag>}
        {a.type === "SONG" && a.dueAt && <Tag color="coral">take received</Tag>}
        <Link to={a.type === "EXERCISE" ? "/coach/midi/edit" : "/coach/library"} className="btn small ghost">✎</Link>
      </div>
      {showSheet && (
        <div className="staff" style={{ marginTop: 6, height: 64 }}>
          <Staff
            width={460}
            bar={12}
            notes={[
              { pitch: "E4", dur: "e", x: 0.0 },
              { pitch: "G4", dur: "e", x: 0.4 },
              { pitch: "B4", dur: "e", x: 0.8 },
              { pitch: "C5", dur: "e", x: 1.2 },
              { pitch: "D5", dur: "e", x: 1.6 },
              { pitch: "E5", dur: "e", x: 2.0 },
              { pitch: "D5", dur: "e", x: 2.4 },
              { pitch: "C5", dur: "e", x: 2.8 },
              { pitch: "B4", dur: "e", x: 3.2 },
              { pitch: "G4", dur: "e", x: 3.6 },
            ]}
            highlight={[2.4, 3.2]}
          />
          {a.noteText && (
            <div className="score-pin" style={{ left: "58%", top: "-2px" }}>fingers 3 → 4</div>
          )}
        </div>
      )}
    </div>
  );
}

function TakeCard({ take, prominent }: { take: TakePublic; prominent: boolean }) {
  if (!prominent) {
    return (
      <div className="box small filled">
        <div className="row between">
          <span>
            <span className="bold">{take.pieceTitle}</span>
            {take.bars ? ` · ${take.bars}` : ""} · take {take.takeNumber}
          </span>
          <span className="tiny muted">
            {new Date(take.createdAt).toLocaleDateString([], { weekday: "short" })}
            {take.selfRating ? ` · ${formatSelfRating(take.selfRating)}` : ""}
          </span>
        </div>
      </div>
    );
  }
  const heights = waveHeights(take.id.charCodeAt(0) + take.id.length, 32);
  return (
    <div className="box accent" style={{ borderWidth: 2 }}>
      <div className="row between">
        <div>
          <div className="bold small">
            {take.pieceTitle}
            {take.bars ? ` · ${take.bars}` : ""}
          </div>
          <div className="tiny muted">
            take {take.takeNumber} · {Math.floor(take.durationSec / 60)}:
            {String(take.durationSec % 60).padStart(2, "0")} ·
            {" sent "}
            {new Date(take.createdAt).toLocaleDateString([], { weekday: "short" })}
          </div>
        </div>
        {take.selfRating && <Tag color="coral">{formatSelfRating(take.selfRating)} self</Tag>}
      </div>
      <WaveBars heights={heights} played={0} />
      <div className="row gap-2 mt-1">
        <Link to={`/coach/takes/${take.id}`} className="btn small accent grow">open in review →</Link>
        <button className="btn icon ghost"><Icon name="play" size={12} /></button>
      </div>
    </div>
  );
}

function StudentDesktop({ detail, loading }: { detail: StudentDetailPublic | undefined; loading: boolean }) {
  const isMobile = useIsMobile();
  // Locally track the routine so save edits show immediately without
  // having to refetch the entire StudentDetail aggregate.
  const [routine, setRoutine] = useState<RoutinePublic | null>(null);
  const liveRoutine = routine ?? detail?.routine ?? { items: [], updatedAt: null };
  if (loading && !detail) {
    return (
      <DTFrame side="student">
        <div className="dt-main-head"><div className="dt-title">Loading…</div></div>
      </DTFrame>
    );
  }
  if (!detail) {
    return (
      <DTFrame side="student">
        <div className="dt-main-head">
          <div>
            <div className="dt-title">Student not found</div>
            <div className="dt-sub">No record for that id — they may not have a booking with you.</div>
          </div>
          <Link to="/coach/roster" className="btn small">back to today</Link>
        </div>
      </DTFrame>
    );
  }

  const tenure = formatTenure(detail.firstLessonAt);
  const todaysLesson = detail.assignments.length > 0 ? null : null; // placeholder
  // Today's lesson: derive from booking-shaped fallback. We don't have today's booking
  // in the aggregate, so fetch it lazily via the global bookings cache by looking at
  // streak / latest note dates. Simpler: just check whether there's a CONFIRMED booking
  // listed via detail (we don't carry that yet) — show only if known.

  const firstName = detail.name.split(" ")[0];
  const streak = detail.streak;
  const sections = detail.latestNoteSections;
  const noteDay = detail.latestNoteStartsAt
    ? new Date(detail.latestNoteStartsAt).toLocaleDateString([], { weekday: "long" })
    : null;
  const noteDayShort = detail.latestNoteStartsAt
    ? new Date(detail.latestNoteStartsAt).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
    : null;
  const sentAt = detail.latestNoteSentAt
    ? new Date(detail.latestNoteSentAt).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })
    : null;

  const newTakes = detail.takes.filter((t) => t.status === "UNREVIEWED");
  const prominentTake = newTakes[0] ?? detail.takes[0];
  const otherTakes = detail.takes.filter((t) => t.id !== prominentTake?.id).slice(0, 4);

  // Today's lesson info isn't part of detail; minor enhancement to do in a follow-up.
  // For now, surface streak + tenure + age/instrument in the subtitle and skip "today".

  return (
    <DTFrame side="student">
      <div className="dt-main-head">
        <div className="row gap-3">
          <Link to="/coach/roster" className="btn icon" style={{ border: 0, background: "transparent" }}>
            <Icon name="back" size={14} />
          </Link>
          <Avatar name={detail.name} size={48} />
          <div>
            <h2 className="dt-title" style={{ fontSize: 30 }}>{detail.name}</h2>
            <div className="dt-sub">
              {detail.age != null && <>{detail.age} · </>}
              {detail.instrument ?? <MockTag>instrument unset</MockTag>}
              {tenure && <> · {tenure}</>}
              {streak && streak.currentDays > 0 && (
                <span className="muted"> · 🔥 {streak.currentDays}d streak</span>
              )}
            </div>
          </div>
        </div>
        <div className="row gap-2">
          <MessageButton userId={detail.id} />
          <button className="btn small">history</button>
        </div>
      </div>

      <div className="dt-main-body">
        <div className="dt-cols" style={{ gridTemplateColumns: isMobile ? "1fr" : "1.3fr 1fr", height: isMobile ? "auto" : "100%" }}>
          {/* LEFT: this week */}
          <div className="panel" style={{ padding: 0 }}>
            <div className="panel-head" style={{ padding: "12px 16px 0" }}>
              <div className="row gap-3">
                <div className="panel-title">This week</div>
                <span className="chip tiny" style={{ background: "var(--paper-2)" }}>{weekRangeLabel()}</span>
              </div>
              <div className="pill-row">
                <span className="p on">plan</span>
                <span className="p">history</span>
                <Link to="voice" className="p" style={{ color: "inherit", textDecoration: "none" }}>profile</Link>
              </div>
            </div>
            <div className="panel-body scroll" style={{ padding: "4px 16px 16px" }}>
              {/* Latest practice note — REAL */}
              <div className="box thick" style={{ position: "relative", marginTop: 8 }}>
                <div className="corner">{noteDayShort ? `${noteDayShort}'s note` : "no note yet"}</div>
                <div className="row between mb-1">
                  <span className="wf-scrawl big bold">
                    {noteDay ? `After ${noteDay}'s lesson` : "No practice note sent yet"}
                  </span>
                  {sentAt && <span className="tiny muted">drafted · sent {sentAt}</span>}
                </div>
                <Squiggle w={60} color="var(--ink-faint)" />

                {sections ? (
                  <StructuredNote sections={sections} />
                ) : detail.latestNotePracticeNotes ? (
                  <div className="small mt-2" style={{ whiteSpace: "pre-line", lineHeight: 1.55 }}>
                    {detail.latestNotePracticeNotes}
                  </div>
                ) : (
                  <div className="small mt-2 muted">
                    No practice note attached to a completed lesson yet.
                  </div>
                )}

                <div className="row gap-2 mt-2">
                  <button className="btn small ghost">✎ edit</button>
                  <button className="btn small ghost">＋ add voice memo</button>
                  {detail.latestNoteReadCount > 0 && (
                    <span className="chip tiny" style={{ marginLeft: "auto" }}>
                      ✓ {firstName} opened · {detail.latestNoteReadCount}x
                    </span>
                  )}
                </div>
              </div>

              {/* Current routine — coach-managed, ordered list of exercises
                  the student practices between lessons. Saves call PUT
                  /api/coaches/students/:id/routine. */}
              <div className="mt-3">
                <CurrentRoutine
                  routine={liveRoutine}
                  editable
                  saveUrl={`/api/coaches/students/${detail.id}/routine`}
                  onSaved={setRoutine}
                  emptyHint={`No routine set for ${firstName} yet. Add items from the library →`}
                />
              </div>

              {/* Assignments — REAL */}
              <div className="row between mt-3 mb-2">
                <div className="small muted">
                  ASSIGNED THIS WEEK · {detail.assignments.length} item{detail.assignments.length === 1 ? "" : "s"}
                </div>
                <Link to="/coach/library" className="btn small ghost">＋ add from library</Link>
              </div>

              {detail.assignments.length === 0 ? (
                <div className="box dashed small muted">
                  No assignments for this week yet. Drop one from the library →
                </div>
              ) : (
                detail.assignments.map((a) => <AssignmentCard key={a.id} a={a} />)
              )}

              <div className="dropzone mt-2">
                drop from library · or paste a MIDI / PDF
              </div>
            </div>
          </div>

          {/* RIGHT: takes + draft */}
          <div className="col gap-3" style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div className="panel" style={{ flex: "0 0 auto" }}>
              <div className="panel-head">
                <div className="panel-title">Takes received</div>
                {newTakes.length > 0 && (
                  <span className="chip tiny accent">{newTakes.length} new</span>
                )}
              </div>
              <div className="panel-body col gap-2">
                {prominentTake ? (
                  <>
                    <TakeCard take={prominentTake} prominent />
                    {otherTakes.map((t) => (
                      <TakeCard key={t.id} take={t} prominent={false} />
                    ))}
                  </>
                ) : (
                  <div className="box dashed small muted">No takes received yet.</div>
                )}
              </div>
            </div>

            {/* Draft of today's note — still mock (no draft persistence yet) */}
            <div className="panel tinted" style={{ flex: "1 1 auto", minHeight: 0 }}>
              <div className="panel-head">
                <div className="panel-title">Draft · today's note</div>
                <div className="row gap-2">
                  <span className="chip tiny" style={{ background: "var(--highlight)" }}>auto-sends after lesson</span>
                  <MockTag>draft persistence</MockTag>
                </div>
              </div>
              <div className="panel-body scroll col gap-2">
                <div className="row gap-2 small">
                  <Tag>voice memo</Tag>
                  <Tag>handwritten</Tag>
                  <Tag>type</Tag>
                </div>

                <div className="note-sections draft">
                  <NoteRow label="intro" body={<>{firstName} — bar 20 swell really came through on take 3.</>} draft />
                  <NoteRow label="scales & exercises done" body={<>C major 2 oct · Hanon 4 bar 12 — cleaner!</>} draft />
                  <NoteRow label="topics discussed" body={<span className="muted" style={{ fontStyle: "italic" }}>…</span>} draft />
                  <NoteRow label="song work" body={<>River — keep at 88, work the ending</>} draft />
                  <NoteRow label="other song suggestions" body={<>Chopin Prélude № 4?</>} draft />
                  <NoteRow label="next time" body={<span className="muted" style={{ fontStyle: "italic" }}>…</span>} draft />
                </div>

                <div className="small muted mt-1">ATTACH TO NEXT WEEK</div>
                <div className="box small row gap-2">
                  <Icon name="note" size={14} />
                  <span className="grow">Hanon № 4 · bar 16-20 (next 4 bars)</span>
                  <span className="muted tiny">from library</span>
                </div>
                <div className="box small row gap-2 dashed">
                  <Icon name="plus" size={12} />
                  <span className="muted">add warmup, exercise, or song</span>
                </div>

                <div className="hr-hand" />
                <div className="row gap-2">
                  <button className="btn small ghost grow">save draft</button>
                  <button className="btn small primary grow">send now →</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DTFrame>
  );
}

function StudentMobile({ detail, loading }: { detail: StudentDetailPublic | undefined; loading: boolean }) {
  if (loading && !detail) {
    return <WFFrame navActive="home"><div className="wf-body">Loading…</div></WFFrame>;
  }
  if (!detail) {
    return <WFFrame navActive="home"><div className="wf-body">Student not found</div></WFFrame>;
  }
  const firstName = detail.name.split(" ")[0];
  const sections = detail.latestNoteSections;
  const prominentTake = detail.takes.find((t) => t.status === "UNREVIEWED") ?? detail.takes[0];

  return (
    <WFFrame navActive="home">
      <div className="wf-header">
        <Link to="/coach/roster" className="btn icon" style={{ border: 0, background: "transparent" }}>
          <Icon name="back" size={14} />
        </Link>
        <div className="center">
          <div className="small muted tiny">
            {detail.instrument ?? ""}
            {detail.streak && detail.streak.currentDays > 0 ? ` · 🔥 ${detail.streak.currentDays}d` : ""}
          </div>
          <div className="bold">{detail.name}</div>
        </div>
        <Avatar name={detail.name} size={32} />
      </div>
      <div className="wf-body col gap-3 scroll-y">
        <div className="seg">
          <div className="s on">plan</div>
          <div className="s">takes · {detail.takes.length}</div>
          <div className="s">note</div>
        </div>

        <div className="box thick" style={{ position: "relative" }}>
          <div className="corner">
            {detail.latestNoteStartsAt
              ? new Date(detail.latestNoteStartsAt).toLocaleDateString([], { weekday: "short" }) + "'s note"
              : "no note"}
          </div>
          {sections ? (
            <div className="small wf-scrawl">
              {sections.intro}
            </div>
          ) : detail.latestNotePracticeNotes ? (
            <div className="small wf-scrawl" style={{ whiteSpace: "pre-line" }}>
              {detail.latestNotePracticeNotes.split("\n").slice(0, 3).join("\n")}
            </div>
          ) : (
            <div className="small muted">No practice note attached to a completed lesson yet.</div>
          )}
        </div>

        <div className="small muted">
          THIS WEEK · {detail.assignments.length}
        </div>
        {detail.assignments.slice(0, 3).map((a) => {
          const icon = ICON_BY_TYPE[a.type];
          const isAccent = a.hasNotePinned;
          return (
            <div
              key={a.id}
              className="box small row gap-2"
              style={isAccent ? { borderColor: "var(--accent)" } : undefined}
            >
              <Icon name={icon} size={14} stroke={a.type === "SONG" ? "var(--accent)" : "currentColor"} />
              <div className="grow">
                <div className="bold tiny" style={{ fontSize: 13 }}>{a.title}</div>
                <div className="tiny muted">{TYPE_LABEL[a.type]}{a.status === "COMPLETED" ? " · ✓" : ""}</div>
              </div>
              {a.type === "SONG" && prominentTake?.pieceTitle.startsWith("River") ? (
                <Link to={`/coach/takes/${prominentTake.id}`} className="btn small accent">review</Link>
              ) : a.status === "COMPLETED" ? (
                <Tag>✓</Tag>
              ) : (
                <Icon name="chev" size={12} />
              )}
            </div>
          );
        })}

        <Link to="/coach/library" className="btn ghost">＋ add from library</Link>

        <div className="small muted">DRAFT · today's note <MockTag>draft persistence</MockTag></div>
        <div className="box dashed">
          <div className="small">{firstName} — bar 20 swell really came through. Next week: keep River at 88…</div>
          <div className="row gap-2 mt-2">
            <button className="btn small grow">✎ edit</button>
            <button className="btn small primary grow">send →</button>
          </div>
        </div>
      </div>
    </WFFrame>
  );
}

export function StudentPage() {
  const isMobile = useIsMobile();
  const params = useParams<{ studentId: string }>();
  const { detail, loading } = useStudentDetail(params.studentId);
  return isMobile
    ? <StudentMobile detail={detail} loading={loading} />
    : <StudentDesktop detail={detail} loading={loading} />;
}
