import { Link, useSearchParams } from "react-router-dom";
import type { AssignmentPublic, LibraryItemKind, RoutineItem, StudentDetailPublic } from "@sunbird/shared";
import { useAuth } from "@/context/AuthContext";
import { STFrame } from "../components/STFrame";
import { Icon } from "../components/Icon";
import { Squiggle } from "../components/Squiggle";
import { useMyStudentDetail } from "../hooks/useCoachData";
import { useNow } from "../hooks/useNow";
import { MobileStatusBar } from "../components/MobileStatusBar";

// ── path geometry (verbatim from design) ─────────────────
const PATH_D =
  "M 50 30 Q 280 60 60 130 Q -40 200 280 230 Q 360 290 50 320 Q -40 380 280 410 Q 340 470 80 500";
const PATH_SLOTS: Array<{ x: number; y: number }> = [
  { x: 50, y: 30 },
  { x: 60, y: 130 },
  { x: 280, y: 230 },
  { x: 50, y: 320 },
  { x: 280, y: 410 },
  { x: 80, y: 500 },
];

type Stop = {
  label: string;
  /** Routine-driven stops carry a routineItemId; assignment-driven ones carry assignmentId. */
  routineItemId?: string;
  assignmentId?: string;
  type?: AssignmentPublic["type"];
  status?: AssignmentPublic["status"];
  bars?: string | null;
  tempo?: string | null;
  durationMin?: number | null;
};

const KIND_TO_ASSIGNMENT_TYPE: Record<LibraryItemKind, AssignmentPublic["type"]> = {
  warmup: "WARMUP",
  exercise: "EXERCISE",
  song: "SONG",
};

function PathSvg({
  stops,
  progress,
  current,
  completedAll,
}: {
  stops: Stop[];
  progress: number;
  current: number;
  completedAll: boolean;
}) {
  return (
    <svg viewBox="0 0 340 540" width="100%" height="100%" style={{ display: "block" }}>
      <path
        d={PATH_D}
        fill="none"
        stroke="var(--ink)"
        strokeWidth="2.5"
        strokeDasharray="2 6"
        strokeLinecap="round"
      />
      {completedAll && (
        <path
          d={PATH_D}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      )}
      {PATH_SLOTS.slice(0, stops.length).map((slot, i) => {
        const stop = stops[i];
        const done = i < progress;
        const now = i === current && !completedAll;
        const isSong = stop.type === "SONG" || i === stops.length - 1;
        const fill = done
          ? isSong
            ? "var(--accent)"
            : "var(--ink)"
          : now
          ? "var(--accent)"
          : "var(--paper)";
        const stroke = now ? "var(--accent)" : "var(--ink)";
        const r = now ? 26 : 20;
        return (
          <g key={i}>
            {now && (
              <circle
                cx={slot.x}
                cy={slot.y}
                r={r + 8}
                fill="none"
                stroke="var(--accent)"
                strokeDasharray="3 4"
                strokeWidth="1.5"
              />
            )}
            <circle cx={slot.x} cy={slot.y} r={r} fill={fill} stroke={stroke} strokeWidth="2" />
            {isSong ? (
              <text
                x={slot.x}
                y={slot.y + 5}
                textAnchor="middle"
                fill={done ? "white" : "var(--accent)"}
                fontFamily="Caveat"
                fontSize="20"
                fontWeight="700"
              >
                ♪
              </text>
            ) : (
              <text
                x={slot.x}
                y={slot.y + 5}
                textAnchor="middle"
                fill={done ? "var(--paper)" : now ? "white" : "var(--ink)"}
                fontFamily="Caveat"
                fontSize="20"
                fontWeight="700"
              >
                {i + 1}
              </text>
            )}
            <text
              x={slot.x}
              y={slot.y + r + 16}
              textAnchor="middle"
              fill="var(--ink)"
              fontFamily="Patrick Hand"
              fontSize="13"
            >
              {stop.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function MobileCard({ children }: { children: React.ReactNode }) {
  // Centered 390×760 mobile-card on desktop; full-width on narrow viewports.
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

type ViewMode = "auto" | "start" | "mid" | "done";

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

function routineStop(it: RoutineItem): Stop {
  return {
    label: it.title.length > 18 ? it.title.slice(0, 16) + "…" : it.title,
    routineItemId: it.id,
    type: KIND_TO_ASSIGNMENT_TYPE[it.kind],
    bars: it.bars,
    tempo:
      it.bpmStart && it.bpmEnd && it.bpmStart !== it.bpmEnd
        ? `${it.bpmStart} → ${it.bpmEnd} bpm`
        : it.bpmStart
        ? `${it.bpmStart} bpm`
        : null,
    durationMin: it.durationMin,
  };
}

function assignmentStop(a: AssignmentPublic): Stop {
  return {
    label: a.title.length > 18 ? a.title.slice(0, 16) + "…" : a.title,
    assignmentId: a.id,
    type: a.type,
    status: a.status,
    bars: a.bars,
    tempo:
      a.tempoBpmStart && a.tempoBpmEnd && a.tempoBpmStart !== a.tempoBpmEnd
        ? `${a.tempoBpmStart} → ${a.tempoBpmEnd} bpm`
        : a.tempoBpmStart
        ? `${a.tempoBpmStart} bpm`
        : null,
    durationMin: a.durationMin,
  };
}

function buildStops(detail: StudentDetailPublic | undefined): Stop[] {
  // Prefer the coach-set routine — it's the source of truth for what
  // the student should practice today. Fall back to this-week's
  // assignments (legacy) and then the design's placeholder labels so a
  // brand-new student still sees the shape of the page.
  const routine = detail?.routine?.items ?? [];
  if (routine.length > 0) {
    return routine.slice(0, PATH_SLOTS.length).map(routineStop);
  }
  const weekly = thisWeeksAssignments(detail);
  if (weekly.length > 0) {
    return weekly.slice(0, PATH_SLOTS.length).map(assignmentStop);
  }
  return [
    { label: "Breathing" },
    { label: "C scale" },
    { label: "Hanon 4" },
    { label: "Arpeggios" },
    { label: "Sight read" },
    { label: "River Flows" },
  ];
}

function deriveProgress(stops: Stop[]): { progress: number; current: number; completedAll: boolean } {
  const completed = stops.findIndex((s) => s.status !== "COMPLETED");
  // findIndex returns -1 when *all* match, meaning all done.
  if (stops.every((s) => s.status === "COMPLETED")) {
    return { progress: stops.length, current: -1, completedAll: true };
  }
  const progress = stops.filter((s) => s.status === "COMPLETED").length;
  // current = first not-completed (which is what findIndex returned in normal case)
  const current = completed === -1 ? 0 : completed;
  return { progress, current, completedAll: false };
}

export function PracticePathPage() {
  const [search] = useSearchParams();
  const { user } = useAuth();
  const { detail, loading } = useMyStudentDetail();
  const stops = buildStops(detail);

  const derived = deriveProgress(stops);
  // Allow ?state=start|mid|done to preview the other states from the same data.
  const mode = (search.get("state") as ViewMode | null) ?? "auto";
  const view =
    mode === "start"
      ? { progress: 0, current: 0, completedAll: false }
      : mode === "mid"
      ? { progress: 2, current: 2, completedAll: false }
      : mode === "done"
      ? { progress: stops.length, current: -1, completedAll: true }
      : derived;

  const currentStop = stops[view.current] ?? stops[0];
  const minutesIn =
    detail?.streak?.lastPracticedAt && view.progress > 0 && !view.completedAll ? 14 : null;

  const headerTitle = view.completedAll
    ? "All done!"
    : view.progress === 0
    ? `${dayLabelToday()}'s path`
    : "On your way";
  const headerSub = view.completedAll
    ? `${dayLabelToday()} · ${detail?.streak ? `streak +1` : "great work"}`
    : view.progress === 0
    ? `${stops.length} stops · just you, your instrument`
    : `${view.progress} of ${stops.length} done${minutesIn ? ` · ${minutesIn} min in` : ""}`;
  const initial = user?.name?.trim().charAt(0).toUpperCase() ?? "?";

  return (
    <STFrame side="home">
      <MobileCard>
        <div className="wf">
          <MobileStatusBar />

          <div className="wf-header">
            <div>
              <h2 className="wf-title">{headerTitle}</h2>
              <div className="wf-subtitle">{headerSub}</div>
            </div>
            <div className="row gap-2">
              {detail?.streak && detail.streak.currentDays > 0 && !view.completedAll && (
                <span className="chip accent" style={{ background: "var(--accent)", color: "white", borderColor: "var(--accent)" }}>🔥 {detail.streak.currentDays}</span>
              )}
              <div className="wf-avatar">{initial}</div>
            </div>
          </div>

          {!view.completedAll && view.progress > 0 && (
            <div style={{ padding: "0 18px 6px" }}>
              <div className="progress">
                <i style={{ width: `${(view.progress / stops.length) * 100}%` }} />
              </div>
            </div>
          )}

          <div
            className="wf-body"
            style={{ position: "relative", overflow: "hidden", paddingBottom: 16 }}
          >
            {loading && (
              <div className="small muted" style={{ padding: 18 }}>
                Loading…
              </div>
            )}
            <PathSvg
              stops={stops}
              progress={view.progress}
              current={view.current}
              completedAll={view.completedAll}
            />

            {/* State A — pinned teacher note */}
            {view.progress === 0 && !view.completedAll && detail?.latestNoteSections?.intro && (
              <div
                style={{ position: "absolute", left: "50%", top: 60, transform: "translateX(-50%)" }}
                className="postit"
              >
                <div className="tiny muted">PINNED · your teacher</div>
                <div className="wf-scrawl" style={{ fontSize: 18, lineHeight: 1 }}>
                  {detail.latestNoteSections.intro.length > 60
                    ? detail.latestNoteSections.intro.slice(0, 58) + "…"
                    : detail.latestNoteSections.intro}
                </div>
              </div>
            )}

            {/* State B — current stop tooltip */}
            {!view.completedAll && view.progress > 0 && currentStop && (
              <div
                style={{
                  position: "absolute",
                  left: 18,
                  top: 148,
                  background: "white",
                  border: "1.5px solid var(--accent)",
                  borderRadius: 10,
                  padding: "6px 10px",
                  maxWidth: 170,
                }}
              >
                <div className="bold small">{currentStop.label}</div>
                <div className="tiny muted">
                  {[currentStop.durationMin ? `${currentStop.durationMin} min` : null, currentStop.tempo]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
                <svg
                  width="80"
                  height="40"
                  viewBox="0 0 80 40"
                  style={{ position: "absolute", right: -66, top: 18, pointerEvents: "none" }}
                >
                  <path
                    d="M 4 6 Q 30 8 50 28"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                  <polygon points="46,24 54,30 48,32" fill="var(--accent)" />
                </svg>
              </div>
            )}

            {/* State C — celebration card */}
            {view.completedAll && (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "38%",
                  transform: "translate(-50%, -50%) rotate(-1.5deg)",
                  width: "82%",
                }}
              >
                <div
                  className="box thick accent"
                  style={{
                    padding: "16px 14px",
                    background: "var(--paper)",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 34, lineHeight: 1 }}>🎺</div>
                  <div className="wf-scrawl bold" style={{ fontSize: 30, lineHeight: 1.05 }}>
                    nailed it
                  </div>
                  <div className="small muted">
                    all {stops.length} stops
                    {detail?.streak ? ` · streak now ${detail.streak.currentDays} days` : ""}
                  </div>
                  <Squiggle w={80} color="var(--accent)" />
                  <div
                    className="row gap-2 mt-3"
                    style={{ justifyContent: "center", flexWrap: "wrap" }}
                  >
                    <span className="chip accent">+1 streak day</span>
                    <span className="chip">{stops.length} stops</span>
                    {detail && detail.takes.some((t) => t.status === "UNREVIEWED") && (
                      <span className="chip">1 take sent</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* CTA buttons */}
            {!view.completedAll && currentStop && (
              <BeginCTA stop={currentStop} progress={view.progress} />
            )}
            {view.completedAll && (
              <>
                <Link
                  to="/my-bookings"
                  className="btn primary"
                  style={{
                    position: "absolute",
                    bottom: 58,
                    left: "50%",
                    transform: "translateX(-50%)",
                  }}
                >
                  see today's recap →
                </Link>
                <button
                  className="btn ghost small"
                  style={{
                    position: "absolute",
                    bottom: 18,
                    left: "50%",
                    transform: "translateX(-50%)",
                  }}
                >
                  practice more (bonus)
                </button>
              </>
            )}
          </div>
        </div>
      </MobileCard>
    </STFrame>
  );
}

function BeginCTA({ stop, progress }: { stop: Stop; progress: number }) {
  const label =
    progress === 0
      ? `Begin · stop 1`
      : `Continue · ${stop.label}`;
  const to = stop.assignmentId
    ? stop.type === "SONG"
      ? `/practice/record/${stop.assignmentId}`
      : `/practice/exercise/${stop.assignmentId}`
    : "#";
  return (
    <Link
      to={to}
      className="btn accent big"
      style={{
        position: "absolute",
        bottom: 14,
        left: "50%",
        transform: "translateX(-50%)",
        boxShadow: "2px 2px 0 var(--ink)",
        textDecoration: "none",
      }}
    >
      <Icon name="play" size={16} stroke="white" /> {label}
    </Link>
  );
}

function dayLabelToday(): string {
  return new Date().toLocaleDateString([], { weekday: "long" });
}
