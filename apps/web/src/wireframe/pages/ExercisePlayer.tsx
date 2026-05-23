import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AssignmentPublic } from "@sunbird/shared";
import { useAuth } from "@/context/AuthContext";
import { STFrame } from "../components/STFrame";
import { Icon } from "../components/Icon";
import { Squiggle } from "../components/Squiggle";
import { useMyStudentDetail } from "../hooks/useCoachData";
import { MobileStatusBar } from "../components/MobileStatusBar";

// ── helpers ──────────────────────────────────────────────
// A simple "line of staff" SVG with light notes, matching the design.
function LineStaff({
  width = 320,
  withClef = true,
  withTime = true,
  barLines = [80, 160, 240, 310],
  notes = [],
  highlight,
  annotations,
}: {
  width?: number;
  withClef?: boolean;
  withTime?: boolean;
  barLines?: number[];
  notes?: { x: number; y: number }[];
  highlight?: [number, number];
  annotations?: React.ReactNode;
}) {
  return (
    <svg
      viewBox={`0 0 ${width} 80`}
      width="100%"
      height="80"
      style={{ display: "block", overflow: "visible" }}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={i}
          x1="6"
          y1={18 + i * 10}
          x2={width - 6}
          y2={18 + i * 10}
          stroke="var(--ink)"
          strokeWidth="1"
        />
      ))}
      {withClef && (
        <text x="8" y="50" fontFamily="Caveat" fontSize="34" fill="var(--ink)">
          𝄞
        </text>
      )}
      {withTime && (
        <>
          <text x="34" y="36" fontFamily="serif" fontSize="14" fontWeight="700">
            4
          </text>
          <text x="34" y="54" fontFamily="serif" fontSize="14" fontWeight="700">
            4
          </text>
        </>
      )}
      {barLines.map((x, i) => (
        <line key={i} x1={x} y1="18" x2={x} y2="58" stroke="var(--ink)" strokeWidth="1.2" />
      ))}
      {highlight && (
        <rect
          x={highlight[0]}
          y="10"
          width={highlight[1] - highlight[0]}
          height="58"
          fill="var(--accent)"
          opacity="0.18"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
      )}
      {notes.map((n, i) => (
        <g key={i}>
          <ellipse
            cx={n.x}
            cy={n.y}
            rx="5.5"
            ry="4"
            fill="var(--ink)"
            transform={`rotate(-18 ${n.x} ${n.y})`}
          />
          <line
            x1={n.x + 4}
            y1={n.y - 1}
            x2={n.x + 4}
            y2={n.y - 22}
            stroke="var(--ink)"
            strokeWidth="1.4"
          />
        </g>
      ))}
      {annotations}
    </svg>
  );
}

function lineNotes(seed: number, count = 12, xStart = 55, xEnd = 305) {
  const ys = [22, 27, 32, 37, 42, 47, 52];
  const step = (xEnd - xStart) / (count - 1);
  let s = seed;
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    s = (s * 9301 + 49297) % 233280;
    out.push({ x: xStart + i * step, y: ys[Math.floor((s / 233280) * ys.length)] });
  }
  return out;
}

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

type ScoreMode = "listen" | "loop" | "annotated";

export function ExercisePlayerPage() {
  const params = useParams<{ assignmentId: string }>();
  const { user } = useAuth();
  const { detail, loading } = useMyStudentDetail();
  const [mode, setMode] = useState<ScoreMode>("listen");
  const [playing, setPlaying] = useState(true);

  const assignment: AssignmentPublic | undefined = detail?.assignments.find(
    (a) => a.id === params.assignmentId,
  );

  const initial = user?.name?.trim().charAt(0).toUpperCase() ?? "?";
  const title = assignment?.title ?? (loading ? "Loading…" : "Exercise");
  const subtitle =
    assignment?.subtitle ??
    (assignment?.durationMin ? `${assignment.durationMin} min` : "5 min");
  const targetBpm = assignment?.tempoBpmEnd ?? 92;
  const startBpm = assignment?.tempoBpmStart ?? targetBpm;
  const annotationNotes = lineNotes(2, 12);

  return (
    <STFrame side="lessons">
      <MobileCard>
        <div className="wf">
          <MobileStatusBar />

          <div className="wf-header">
            <Link to="/practice" className="btn icon ghost" style={{ border: 0, background: "transparent" }}>
              <Icon name="back" size={16} />
            </Link>
            <div className="small bold muted center" style={{ flex: 1 }}>
              {mode === "loop" ? "Looping bar 12" : assignment?.title.split("·")[0]?.trim() ?? "Exercise"}
            </div>
            <div className="wf-avatar">{initial}</div>
          </div>

          <div
            className="wf-body col gap-3"
            style={{ overflowY: "auto", paddingBottom: 20 }}
          >
            {mode === "listen" && (
              <>
                <div>
                  <h2 className="wf-title" style={{ fontSize: 26 }}>{title}</h2>
                  <div className="small muted">listen first · then play along</div>
                </div>
                <div className="seg">
                  <div className="s on">1 · Listen</div>
                  <div className="s">2 · Play along</div>
                  <div className="s">3 · Solo</div>
                </div>

                <div className="box" style={{ padding: "14px 10px" }}>
                  <div className="tiny muted mb-2 row between" style={{ padding: "0 4px" }}>
                    <span>bar 1-4</span>
                    <span>♩ = {startBpm}</span>
                  </div>
                  <LineStaff notes={lineNotes(1, 12)} highlight={[40, 80]} />
                  <LineStaff withClef={false} withTime={false} notes={lineNotes(7, 12)} />
                </div>

                <div className="box col gap-2 thick">
                  <div className="row between">
                    <div className="row gap-2">
                      <Icon name="headphones" size={14} />
                      <span className="bold small">Reference</span>
                    </div>
                    <div className="tiny muted">0:08 / 0:42</div>
                  </div>
                  <div className="progress"><i style={{ width: "20%" }} /></div>
                  <div className="row gap-3 mt-1" style={{ justifyContent: "center" }}>
                    <button className="btn icon"><Icon name="back" size={14} /></button>
                    <button
                      className="btn accent big icon"
                      style={{ width: 56, height: 56 }}
                      onClick={() => setPlaying((p) => !p)}
                    >
                      <Icon name={playing ? "pause" : "play"} size={22} stroke="white" />
                    </button>
                    <button className="btn icon"><Icon name="chev" size={14} /></button>
                  </div>
                  <div className="row gap-2" style={{ justifyContent: "center" }}>
                    <span className="chip dashed">follow along</span>
                    <span className="chip dashed">click track</span>
                  </div>
                </div>

                {assignment?.noteText && (
                  <div className="postit small" style={{ transform: "rotate(0.6deg)" }}>
                    {assignment.noteText}
                  </div>
                )}

                <div className="row gap-2 mt-2">
                  <button
                    onClick={() => setMode("loop")}
                    className="btn small grow"
                  >
                    drill a bar →
                  </button>
                  <button
                    onClick={() => setMode("annotated")}
                    className="btn small grow"
                  >
                    K's notes →
                  </button>
                </div>
              </>
            )}

            {mode === "loop" && (
              <LoopMode
                title={title}
                start={startBpm}
                target={targetBpm}
                onExit={() => setMode("listen")}
              />
            )}

            {mode === "annotated" && (
              <AnnotatedMode
                title={title}
                notes={annotationNotes}
                onExit={() => setMode("listen")}
              />
            )}
          </div>
        </div>
      </MobileCard>
    </STFrame>
  );
}

function LoopMode({
  title,
  start,
  target,
  onExit,
}: { title: string; start: number; target: number; onExit: () => void }) {
  const [paused, setPaused] = useState(false);
  const bigNotes = [
    { x: 80, y: 32 },
    { x: 120, y: 27 },
    { x: 160, y: 37 },
    { x: 200, y: 32 },
    { x: 240, y: 42 },
    { x: 280, y: 32 },
  ];
  return (
    <>
      <div className="row between">
        <h2 className="wf-title" style={{ fontSize: 22 }}>bar 12 only</h2>
        <span className="chip accent tiny">⟲ looping</span>
      </div>

      <div className="box small">
        <div className="tiny muted mb-1">full piece</div>
        <svg viewBox="0 0 320 40" width="100%" height="40" style={{ display: "block" }}>
          <line x1="4" y1="20" x2="316" y2="20" stroke="var(--ink-faint)" strokeWidth="1" />
          {Array.from({ length: 16 }).map((_, i) => (
            <line
              key={i}
              x1={4 + i * 19.5}
              y1="14"
              x2={4 + i * 19.5}
              y2="26"
              stroke="var(--ink-faint)"
              strokeWidth="0.8"
            />
          ))}
          <rect
            x={4 + 11 * 19.5}
            y="8"
            width="19.5"
            height="24"
            fill="var(--accent)"
            opacity="0.45"
            stroke="var(--accent)"
            strokeWidth="1.2"
          />
          <text x={4 + 11.5 * 19.5} y="40" textAnchor="middle" fontFamily="Caveat" fontSize="11" fill="var(--accent)" fontWeight="700">
            12
          </text>
        </svg>
      </div>

      <div className="box thick accent" style={{ padding: "14px 10px" }}>
        <svg viewBox="0 0 320 110" width="100%" height="110" style={{ display: "block", overflow: "visible" }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1="6"
              y1={30 + i * 12}
              x2="314"
              y2={30 + i * 12}
              stroke="var(--ink)"
              strokeWidth="1.2"
            />
          ))}
          <text x="8" y="74" fontFamily="Caveat" fontSize="50" fill="var(--ink)">
            𝄞
          </text>
          <line x1="50" y1="30" x2="50" y2="78" stroke="var(--ink)" strokeWidth="1.4" />
          <line x1="314" y1="30" x2="314" y2="78" stroke="var(--ink)" strokeWidth="1.4" />
          {bigNotes.map((n, i) => (
            <g key={i}>
              <ellipse
                cx={n.x}
                cy={n.y + 18}
                rx="8"
                ry="6"
                fill="var(--ink)"
                transform={`rotate(-18 ${n.x} ${n.y + 18})`}
              />
              <line
                x1={n.x + 6}
                y1={n.y + 17}
                x2={n.x + 6}
                y2={n.y - 12}
                stroke="var(--ink)"
                strokeWidth="1.6"
              />
              <text
                x={n.x}
                y={n.y + 38}
                textAnchor="middle"
                fontFamily="Caveat"
                fontSize="14"
                fill="var(--accent)"
                fontWeight="700"
              >
                {[1, 2, 3, 4, 3, 2][i]}
              </text>
            </g>
          ))}
          <line x1="155" y1="22" x2="155" y2="86" stroke="var(--accent)" strokeWidth="2" strokeDasharray="3 3" />
          <circle cx="155" cy="22" r="4" fill="var(--accent)" />
        </svg>
        <div className="tiny muted center">finger numbers shown · {title.split("·")[0]}</div>
      </div>

      <div>
        <div className="row between small mb-1">
          <span className="bold">Tempo</span>
          <span>
            <span className="wf-scrawl big bold">{start}</span>{" "}
            <span className="muted">/ {target} bpm</span>
          </span>
        </div>
        <div style={{ position: "relative", height: 30 }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 2, background: "var(--ink)", transform: "translateY(-50%)" }} />
          <div style={{ position: "absolute", left: "32%", top: "50%", transform: "translate(-50%,-50%)", width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", border: "2px solid var(--ink)" }} />
          <div style={{ position: "absolute", left: "60%", top: "50%", transform: "translate(-50%,-50%)", width: 14, height: 14, borderRadius: "50%", background: "var(--paper)", border: "1.5px solid var(--ink-faint)" }} />
          <div style={{ position: "absolute", left: "60%", top: 30, transform: "translateX(-50%)", fontSize: 10, color: "var(--ink-soft)" }}>target</div>
        </div>
      </div>

      <div className="row gap-2 mt-1">
        <span className="chip dashed">+2 bpm each loop</span>
        <span className="chip">count-in</span>
        <span className="chip"><Icon name="metro" size={11} /> click</span>
      </div>

      <div className="row gap-3 mt-1" style={{ justifyContent: "center" }}>
        <button className="btn" onClick={onExit}>exit loop</button>
        <button
          className="btn accent big icon"
          style={{ width: 56, height: 56 }}
          onClick={() => setPaused((p) => !p)}
        >
          <Icon name={paused ? "play" : "pause"} size={22} stroke="white" />
        </button>
        <button className="btn primary" onClick={onExit}>got it →</button>
      </div>
    </>
  );
}

function AnnotatedMode({
  title,
  notes,
  onExit,
}: { title: string; notes: { x: number; y: number }[]; onExit: () => void }) {
  return (
    <>
      <div className="row between">
        <h2 className="wf-title" style={{ fontSize: 22 }}>Score · with notes</h2>
        <div className="seg" style={{ flex: "0 0 auto" }}>
          <div className="s on tiny" style={{ padding: "3px 8px" }}>annotated</div>
          <div className="s tiny" style={{ padding: "3px 8px" }} onClick={onExit}>clean</div>
        </div>
      </div>

      <div className="box" style={{ padding: "14px 10px", position: "relative" }}>
        <LineStaff
          notes={notes}
          annotations={
            <g>
              <ellipse
                cx={notes[2].x}
                cy={notes[2].y}
                rx="14"
                ry="11"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.8"
              />
              <path
                d={`M ${notes[2].x + 20} ${notes[2].y - 6} Q ${notes[2].x + 35} ${notes[2].y - 22} ${notes[2].x + 50} ${notes[2].y - 26}`}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.5"
              />
              <polygon
                points={`${notes[2].x + 22},${notes[2].y - 4} ${notes[2].x + 18},${notes[2].y - 10} ${notes[2].x + 28},${notes[2].y - 2}`}
                fill="var(--accent)"
              />
              <text x={notes[2].x + 52} y={notes[2].y - 22} fontFamily="Caveat" fontSize="13" fill="var(--accent)" fontWeight="700">
                soft!
              </text>

              <circle cx={notes[6].x} cy={notes[6].y + 12} r="2" fill="var(--accent)" />
              <circle cx={notes[7].x} cy={notes[7].y + 12} r="2" fill="var(--accent)" />
              <text x={notes[7].x - 6} y={notes[7].y + 28} fontFamily="Caveat" fontSize="12" fill="var(--accent)">
                staccato
              </text>

              <text x={notes[10].x - 20} y={notes[10].y - 22} fontFamily="Caveat" fontSize="13" fill="var(--accent)">
                cresc.
              </text>
              <line x1={notes[10].x - 10} y1={notes[10].y - 12} x2={notes[11].x + 8} y2={notes[11].y - 16} stroke="var(--accent)" strokeWidth="1.5" />
              <line x1={notes[10].x - 10} y1={notes[10].y - 10} x2={notes[11].x + 8} y2={notes[11].y - 6} stroke="var(--accent)" strokeWidth="1.5" />
            </g>
          }
        />
        <LineStaff withClef={false} withTime={false} notes={lineNotes(9, 12)} />
      </div>

      <div className="small muted">YOUR TEACHER'S NOTES</div>
      {[
        { i: 1, title: "bar 2 · soft", body: "play the circled note pp" },
        { i: 2, title: "bar 3 · staccato", body: "light fingers, off the key fast" },
        { i: 3, title: "bar 4 · crescendo", body: "build into the next phrase" },
      ].map((n) => (
        <div key={n.i} className="box small row gap-3">
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "1.5px solid var(--accent)",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
            }}
          >
            {n.i}
          </div>
          <div className="grow">
            <div className="bold">{n.title}</div>
            <div className="tiny muted">{n.body}</div>
          </div>
          <button className="btn small">jump</button>
        </div>
      ))}

      <Squiggle w={70} color="var(--ink-faint)" />
      <button className="btn small ghost" onClick={onExit}>← back</button>
      <span className="tiny muted center">
        Note: annotations are still a design preview · pinned bars not wired to API yet.
      </span>
      <span style={{ display: "none" }}>{title}</span>
    </>
  );
}
