// Paths — Khan-style lesson trees inside the Coach's Library.
//
// Three views, all ported from /tmp/design/songbird/project/tw-paths.jsx
// (the "Teacher Views" handoff bundle):
//
//   PathsBrowsePane   — middle column + right rail content for the Library
//                       page when the "paths" tab is active.
//   PathEditorPage    — full page: tree editor at /coach/library/paths/:slug
//   PathLessonDetailPage — full page: focused lesson editor at
//                       /coach/library/paths/:slug/lessons/:lessonId
//
// Data is mock for now; this is a design implementation pass.

import { Link, useParams } from "react-router-dom";
import { DTFrame } from "../components/DTFrame";
import { WFFrame } from "../components/WFFrame";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { Tag } from "../components/Tag";
import { Squiggle } from "../components/Squiggle";
import { Staff } from "../components/Staff";

// ── data ───────────────────────────────────────────────────

export type PathShape = "linear" | "branch" | "spiral";

export type PathSummary = {
  slug: string;
  title: string;
  sub: string;
  lessons: number;
  students: number;
  status: "published" | "draft";
  shape: PathShape;
  coral?: boolean;
  tags: string[];
};

export const PATHS: PathSummary[] = [
  {
    slug: "piano-fundamentals",
    title: "Piano fundamentals",
    sub: "for total beginners · ages 6+",
    lessons: 12, students: 4, status: "published",
    shape: "linear", tags: ["beginner", "method"],
  },
  {
    slug: "reading-sheet-music",
    title: "Reading sheet music",
    sub: "from treble to two-hand reading",
    lessons: 8, students: 2, status: "published",
    shape: "branch", tags: ["theory"],
  },
  {
    slug: "voice-chest-mix",
    title: "Voice · chest → mix",
    sub: "passaggio navigation in 9 weeks",
    lessons: 9, students: 3, status: "published",
    shape: "spiral", tags: ["voice"], coral: true,
  },
  {
    slug: "hanon-slowly",
    title: "Hanon, slowly",
    sub: "finger independence over 6 months",
    lessons: 24, students: 6, status: "published",
    shape: "linear", tags: ["technique"],
  },
  {
    slug: "recital-prep-25",
    title: "Recital prep · summer '25",
    sub: "shared pieces, polished",
    lessons: 4, students: 8, status: "draft",
    shape: "branch", tags: ["recital"],
  },
  {
    slug: "sight-reading-sprint",
    title: "Sight-reading sprint",
    sub: "daily 5-min drills",
    lessons: 30, students: 0, status: "draft",
    shape: "linear", tags: ["drill"],
  },
];

// Lesson nodes for the demo "Piano Fundamentals" path. Real paths would
// own their own nodes/edges; this is the design's reference data.
type NodeState = "done" | "current" | "locked" | undefined;
type LessonNode = {
  id: string;
  col: number;
  row: number;
  title: string;
  titleB: string;
  meta: string;
  state?: NodeState;
};

const FUNDAMENTALS_NODES: LessonNode[] = [
  { id: "n1", col: 1, row: 0, title: "Posture &", titleB: "hand position", meta: "1 lesson · 5 min", state: "done" },
  { id: "n2", col: 1, row: 1, title: "C major", titleB: "5-finger", meta: "1 · scale", state: "done" },
  { id: "n3", col: 1, row: 2, title: "Reading", titleB: "treble clef", meta: "2 · theory", state: "current" },
  { id: "n4a", col: 0, row: 3, title: "Bass clef", titleB: "intro", meta: "1 · theory" },
  { id: "n4b", col: 2, row: 3, title: "Intervals", titleB: "—", meta: "1 · ear" },
  { id: "n5", col: 1, row: 4, title: "Hands", titleB: "together", meta: "2 · technique" },
  { id: "n6", col: 1, row: 5, title: "Twinkle", titleB: "variations", meta: "2 · piece" },
  { id: "n7", col: 1, row: 6, title: "Dynamics", titleB: "& shaping", meta: "1 · musicality", state: "locked" },
  { id: "n8", col: 1, row: 7, title: "Mini-recital ★", titleB: "check-in", meta: "checkpoint", state: "locked" },
];

const FUNDAMENTALS_EDGES: Array<[string, string]> = [
  ["n1", "n2"], ["n2", "n3"],
  ["n3", "n4a"], ["n3", "n4b"],
  ["n4a", "n5"], ["n4b", "n5"],
  ["n5", "n6"], ["n6", "n7"], ["n7", "n8"],
];

// ── PathMini — small tree preview rendered inside path cards ─

export function PathMini({ shape = "linear", h = 80 }: { shape?: PathShape; h?: number }) {
  const stroke = "var(--ink)";
  const dot = (x: number, y: number, filled = true, accent = false) => (
    <circle
      cx={x} cy={y} r={filled ? 4 : 3.5}
      fill={filled ? (accent ? "var(--accent)" : stroke) : "var(--paper)"}
      stroke={stroke} strokeWidth={accent ? 1.5 : 1}
    />
  );
  const line = (x1: number, y1: number, x2: number, y2: number, dashed?: boolean) => (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={stroke} strokeWidth="1.2"
      strokeDasharray={dashed ? "3 3" : ""} opacity={dashed ? 0.5 : 1}
    />
  );

  if (shape === "branch") {
    return (
      <svg viewBox="0 0 220 60" width="100%" height={h * 0.75}>
        {line(20, 30, 60, 30)}{line(60, 30, 100, 18)}{line(60, 30, 100, 42)}
        {line(100, 18, 140, 30)}{line(100, 42, 140, 30)}{line(140, 30, 180, 30)}{line(180, 30, 200, 30, true)}
        {dot(20, 30)}{dot(60, 30, true, true)}{dot(100, 18)}{dot(100, 42)}{dot(140, 30)}{dot(180, 30, false)}{dot(200, 30, false)}
      </svg>
    );
  }
  if (shape === "spiral") {
    return (
      <svg viewBox="0 0 220 60" width="100%" height={h * 0.75}>
        <path d="M 20 30 Q 50 10, 80 30 T 140 30 T 200 30" stroke={stroke} strokeWidth="1.2" fill="none" />
        {dot(20, 30)}{dot(80, 30)}{dot(140, 30, true, true)}{dot(200, 30, false)}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 220 60" width="100%" height={h * 0.75}>
      {line(20, 30, 60, 30)}{line(60, 30, 100, 30)}{line(100, 30, 140, 30)}{line(140, 30, 180, 30)}{line(180, 30, 200, 30, true)}
      {dot(20, 30)}{dot(60, 30)}{dot(100, 30, true, true)}{dot(140, 30, false)}{dot(180, 30, false)}{dot(200, 30, false)}
    </svg>
  );
}

// ── PathsBrowsePane — middle + right column for the Library when
// the "paths" tab is active. Library owns DTFrame + filter rail. ────

export function PathsBrowsePane({ activeFilters }: { activeFilters?: React.ReactNode }) {
  return (
    <>
      {/* paths grid (middle column) */}
      <div className="panel" style={{ padding: "10px 14px" }}>
        <div className="row between mb-2">
          <div className="row gap-2">
            {activeFilters}
            <div className="dt-search" style={{ flex: "0 0 200px", padding: "4px 12px" }}>
              <span>⌕</span><span>search paths…</span>
            </div>
          </div>
          <div className="row gap-2">
            <div className="pill-row">
              <span className="p on">recent</span>
              <span className="p">A–Z</span>
              <span className="p">most used</span>
            </div>
          </div>
        </div>

        <div className="panel-body scroll">
          <div className="paths-grid">
            {PATHS.map((p, i) => (
              <Link
                key={p.slug}
                to={`/coach/library/paths/${p.slug}`}
                className={"path-card" + (p.coral ? " coral" : "")}
                style={{ transform: `rotate(${i % 2 === 0 ? -0.3 : 0.4}deg)` }}
              >
                <div className="path-card-head">
                  <div className="row gap-2" style={{ alignItems: "flex-start" }}>
                    <span className="path-icon">⤳</span>
                    <div className="grow">
                      <div className="bold">{p.title}</div>
                      <div className="tiny muted">{p.sub}</div>
                    </div>
                    {p.status === "draft" && <Tag>draft</Tag>}
                  </div>
                </div>

                <PathMini shape={p.shape} />

                <div className="path-card-foot row gap-2 small">
                  <Tag>{p.lessons} lessons</Tag>
                  {p.students > 0
                    ? <Tag color="coral">{p.students} on it</Tag>
                    : <span className="muted tiny">no students yet</span>}
                  <span className="grow" />
                  <span className="btn small ghost">open →</span>
                </div>
              </Link>
            ))}

            {/* "new path" tile */}
            <div className="path-card path-card--new">
              <div className="row" style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 6 }}>
                <div style={{ fontSize: 28, lineHeight: 1, color: "var(--accent)" }}>＋</div>
                <div className="bold">New path</div>
                <div className="tiny muted" style={{ textAlign: "center", padding: "0 14px" }}>
                  start blank, from a student's history, or pick a template
                </div>
                <button className="btn small primary mt-1">create →</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* right rail · explain + drag-to-assign + who's on what */}
      <div className="panel tinted">
        <div className="panel-head">
          <div className="panel-title">Assign a path…</div>
        </div>
        <div className="panel-body scroll col gap-2">
          <div className="dropzone">
            <div style={{ fontSize: 16, marginBottom: 2 }}>drag a path onto a student ↓</div>
            <div className="small muted" style={{ fontFamily: "var(--hand)" }}>they'll start at lesson 1 · you can branch later</div>
          </div>

          <div className="postit" style={{ transform: "rotate(-1.2deg)", padding: 12 }}>
            <div className="bold small">what's a path?</div>
            <Squiggle w={50} color="var(--ink-faint)" />
            <div className="small" style={{ marginTop: 4, lineHeight: 1.45 }}>
              A path is a tree of lessons. Each lesson has notes, attachments, and exercises.
              Students walk through them at their own pace — you nudge from the side.
            </div>
          </div>

          <div className="small muted mt-2">CURRENTLY ON A PATH</div>
          {[
            { n: "Maya R.", path: "Piano fundamentals", at: "8 / 12" },
            { n: "Theo P.", path: "Piano fundamentals", at: "5 / 12" },
            { n: "Ana B.", path: "Voice · chest → mix", at: "3 / 9" },
            { n: "Sam W.", path: "Reading sheet music", at: "2 / 8" },
          ].map((s) => (
            <div key={s.n} className="box small row gap-2">
              <Avatar name={s.n} size={24} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="bold tiny" style={{ fontSize: 12 }}>{s.n}</div>
                <div className="tiny muted" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.path}
                </div>
              </div>
              <span className="chip tiny">{s.at}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── PathTreeSVG — full editor tree ─────────────────────────

function PathTreeSVG({
  nodes,
  edges,
  selected,
  pathSlug,
}: {
  nodes: LessonNode[];
  edges: Array<[string, string]>;
  selected?: string;
  pathSlug: string;
}) {
  const colX = [140, 320, 500];
  const rowY = (r: number) => 40 + r * 84;
  const nodeW = 130;
  const nodeH = 48;
  const pos = (id: string) => {
    const n = nodes.find((x) => x.id === id)!;
    return { x: colX[n.col], y: rowY(n.row), n };
  };
  const totalH = rowY(Math.max(...nodes.map((n) => n.row))) + nodeH + 30;

  return (
    <svg viewBox={`0 0 640 ${totalH}`} width="100%" height={totalH}
      style={{ display: "block", overflow: "visible" }}>
      {edges.map(([a, b], i) => {
        const A = pos(a);
        const B = pos(b);
        const x1 = A.x;
        const y1 = A.y + nodeH / 2;
        const x2 = B.x;
        const y2 = B.y - nodeH / 2;
        const dashed = nodes.find((n) => n.id === b)?.state === "locked";
        const mid = (y1 + y2) / 2;
        const d = `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`;
        return (
          <path key={i} d={d}
            stroke="var(--ink)" strokeWidth="1.5" fill="none"
            strokeDasharray={dashed ? "4 4" : ""} opacity={dashed ? 0.45 : 1} />
        );
      })}

      {nodes.map((n) => {
        const { x, y } = pos(n.id);
        const isSel = n.id === selected;
        const done = n.state === "done";
        const current = n.state === "current";
        const locked = n.state === "locked";
        const checkpoint = n.id === "n8";
        const fill = isSel ? "var(--highlight)"
          : done ? "var(--paper-2)"
          : current ? "var(--accent-soft)"
          : "var(--paper)";
        const border = current ? "var(--accent)" : "var(--ink)";
        const strokeW = isSel || current ? 2.5 : 1.5;
        return (
          <g key={n.id} style={{ cursor: "pointer" }}>
            <Link to={`/coach/library/paths/${pathSlug}/lessons/${n.id}`}>
              {checkpoint && (
                <rect
                  x={x - nodeW / 2 - 4} y={y - nodeH / 2 - 4}
                  width={nodeW + 8} height={nodeH + 8} rx="8"
                  fill="none" stroke="var(--ink)" strokeWidth="1"
                  strokeDasharray="2 3" opacity="0.5"
                />
              )}
              <rect
                x={x - nodeW / 2} y={y - nodeH / 2}
                width={nodeW} height={nodeH} rx="6"
                fill={fill} stroke={border} strokeWidth={strokeW}
                strokeDasharray={locked ? "4 3" : ""}
                opacity={locked ? 0.85 : 1}
              />
              {done && (
                <>
                  <circle cx={x + nodeW / 2 - 4} cy={y - nodeH / 2 + 4} r="6"
                    fill="var(--ink)" stroke="var(--paper)" strokeWidth="1.5" />
                  <text x={x + nodeW / 2 - 4} y={y - nodeH / 2 + 7}
                    textAnchor="middle" fontSize="8" fill="var(--paper)">✓</text>
                </>
              )}
              {current && (
                <circle cx={x + nodeW / 2 - 4} cy={y - nodeH / 2 + 4} r="6"
                  fill="var(--accent)" stroke="var(--paper)" strokeWidth="1.5" />
              )}
              {locked && (
                <text x={x + nodeW / 2 - 8} y={y - nodeH / 2 + 10}
                  fontSize="11" fill="var(--ink-faint)">🔒</text>
              )}
              <text x={x} y={y - 4} textAnchor="middle"
                fontSize="13" fontFamily="var(--hand)" fill="var(--ink)" fontWeight="700">
                {n.title}
              </text>
              <text x={x} y={y + 10} textAnchor="middle"
                fontSize="11.5" fontFamily="var(--hand)" fill="var(--ink)">
                {n.titleB}
              </text>
              <text x={x} y={y + 22} textAnchor="middle"
                fontSize="9" fontFamily="var(--mono)" fill="var(--ink-faint)" letterSpacing="0.04em">
                {n.meta}
              </text>
            </Link>
          </g>
        );
      })}

      {/* hand-annotated hint near the current node */}
      <g transform={`translate(${colX[1] + 80}, ${rowY(2) + 30})`}>
        <text fontFamily="var(--scrawl)" fontSize="14" fill="var(--accent)" transform="rotate(-6)">
          drop exercise here →
        </text>
        <path d="M -4 -14 q 20 -8 40 -2" stroke="var(--accent)" strokeWidth="1.5" fill="none" />
      </g>

      {/* student avatars beside the current node */}
      <g transform={`translate(${colX[1] - 75}, ${rowY(2)})`}>
        <g transform="translate(-12, -28)">
          <circle r="9" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
          <text textAnchor="middle" y="3" fontSize="10" fontFamily="var(--scrawl)">M</text>
        </g>
        <g transform="translate(-26, -28)">
          <circle r="9" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
          <text textAnchor="middle" y="3" fontSize="10" fontFamily="var(--scrawl)">T</text>
        </g>
        <text x="-44" y="-24" textAnchor="end" fontSize="9"
          fontFamily="var(--mono)" fill="var(--ink-faint)">
          2 here
        </text>
      </g>
    </svg>
  );
}

// ── PathEditorPage — /coach/library/paths/:slug ────────────

export function PathEditorPage() {
  const { slug = "piano-fundamentals" } = useParams<{ slug: string }>();
  const path = PATHS.find((p) => p.slug === slug) ?? PATHS[0];
  const selected = "n3";

  return (
    <DTFrame side="library">
      <div className="dt-main-head">
        <div className="row gap-3" style={{ alignItems: "center" }}>
          <Link to="/coach/library" className="btn icon ghost">
            <Icon name="back" size={14} />
          </Link>
          <div>
            <div className="row gap-2" style={{ alignItems: "baseline" }}>
              <span className="tiny muted">paths /</span>
              <h2 className="dt-title" style={{ fontSize: 26 }}>{path.title}</h2>
              <Tag>{path.status}</Tag>
            </div>
            <div className="dt-sub">
              {path.lessons} lessons · {path.students} students on it · last edited Tue
            </div>
          </div>
        </div>
        <div className="row gap-2">
          <button className="btn small ghost">duplicate</button>
          <button className="btn small ghost">preview as student</button>
          <button className="btn small primary">＋ add lesson</button>
        </div>
      </div>

      <div className="dt-main-body">
        <div className="dt-cols" style={{ gridTemplateColumns: "200px 1fr 340px", height: "100%", gap: 14 }}>
          {/* path list rail */}
          <div className="panel" style={{ padding: "10px 8px" }}>
            <div className="small muted mb-2">YOUR PATHS</div>
            <div className="col gap-1 small">
              {PATHS.map((p) => (
                <Link
                  key={p.slug}
                  to={`/coach/library/paths/${p.slug}`}
                  className={"item" + (p.slug === path.slug ? " on" : "")}
                  style={{ borderRadius: 3, padding: "5px 6px", lineHeight: 1.2 }}
                >
                  <div style={{ flex: "0 0 16px" }}>⤳</div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className={p.slug === path.slug ? "bold" : ""} style={{ fontSize: 13 }}>{p.title}</div>
                    <div className="tiny muted" style={{ fontSize: 10 }}>
                      {p.lessons} · {p.status === "draft" ? "draft" : `${p.students}↑`}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <button className="btn small ghost mt-2" style={{ width: "100%" }}>＋ new path</button>

            <div className="hr-hand" />
            <div className="small muted mb-1">VIEW</div>
            <div className="col gap-1 small">
              <div className="row gap-2"><div className="checkbox done" style={{ width: 14, height: 14 }} /> show students</div>
              <div className="row gap-2"><div className="checkbox done" style={{ width: 14, height: 14 }} /> show locked</div>
              <div className="row gap-2"><div className="checkbox" style={{ width: 14, height: 14 }} /> show est. time</div>
            </div>
          </div>

          {/* tree canvas */}
          <div className="panel" style={{ padding: 0, position: "relative" }}>
            <div className="panel-head" style={{ padding: "8px 14px" }}>
              <div className="row gap-2">
                <div className="pill-row">
                  <span className="p on">tree</span>
                  <span className="p">list</span>
                  <span className="p">grid</span>
                </div>
                <span className="muted tiny" style={{ marginLeft: 8 }}>
                  drag to reorder · click a node to edit
                </span>
              </div>
              <div className="row gap-2">
                <button className="btn icon ghost" title="zoom out">−</button>
                <span className="tiny muted">100%</span>
                <button className="btn icon ghost" title="zoom in">＋</button>
                <button className="btn icon ghost" title="fit">⛶</button>
              </div>
            </div>
            <div className="panel-body scroll" style={{ padding: "14px 20px", background: "var(--paper)" }}>
              <div style={{
                position: "relative",
                backgroundImage: "radial-gradient(circle, rgba(26,22,18,0.07) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
                borderRadius: 6,
                padding: 8,
                minHeight: "100%",
              }}>
                <PathTreeSVG
                  nodes={FUNDAMENTALS_NODES}
                  edges={FUNDAMENTALS_EDGES}
                  selected={selected}
                  pathSlug={path.slug}
                />
              </div>
            </div>
          </div>

          {/* selected lesson detail */}
          <div className="panel tinted">
            <div className="panel-head">
              <div>
                <div className="tiny muted">LESSON 3 of {path.lessons}</div>
                <div className="panel-title">Reading treble clef</div>
              </div>
              <Link to={`/coach/library/paths/${path.slug}/lessons/${selected}`} className="btn small">expand →</Link>
            </div>
            <div className="panel-body scroll col gap-3">
              <div className="row gap-2">
                <Tag color="coral">in focus</Tag>
                <Tag>theory</Tag>
                <Tag>2 sub-lessons</Tag>
              </div>

              <div className="small muted">NOTES TO STUDENT</div>
              <div className="box dashed" style={{
                fontFamily: "var(--scrawl)", fontSize: 16, lineHeight: 1.45,
                padding: "10px 12px", background: "var(--paper)",
              }}>
                Treble clef = the swirly one. Lines spell <span className="hi">EGBDF</span>{" "}
                ("Every Good Boy Does Fine"), spaces spell <span className="hi">FACE</span>.
                We'll start on lines, then add spaces.
              </div>

              <div className="small muted">ATTACHMENTS · 3</div>
              <div className="col gap-1">
                <div className="box small row gap-2">
                  <Icon name="note" size={14} />
                  <div className="grow">
                    <div className="bold tiny" style={{ fontSize: 12 }}>treble-clef-cheatsheet.pdf</div>
                    <div className="tiny muted">1 page · printable</div>
                  </div>
                  <Icon name="chev" size={11} />
                </div>
                <div className="box small row gap-2">
                  <span style={{ fontSize: 14 }}>♫</span>
                  <div className="grow">
                    <div className="bold tiny" style={{ fontSize: 12 }}>reading-demo.mid</div>
                    <div className="tiny muted">8 bars · slow playback</div>
                  </div>
                  <Icon name="play" size={11} />
                </div>
                <div className="box small row gap-2">
                  <span style={{ fontSize: 14 }}>🎙</span>
                  <div className="grow">
                    <div className="bold tiny" style={{ fontSize: 12 }}>klein-explains.mp3</div>
                    <div className="tiny muted">2:14 · your voice memo</div>
                  </div>
                  <Icon name="play" size={11} />
                </div>
                <button className="btn small ghost" style={{ alignSelf: "flex-start" }}>＋ attach…</button>
              </div>

              <div className="small muted">EXERCISES · 4</div>
              <div className="col gap-1">
                <div className="box small row gap-2" style={{ borderColor: "var(--accent)" }}>
                  <Icon name="metro" size={14} />
                  <div className="grow">
                    <div className="bold tiny" style={{ fontSize: 12 }}>Name-the-note · lines</div>
                    <div className="tiny muted">drill · auto-graded · from library</div>
                  </div>
                  <Tag>from lib</Tag>
                </div>
                <div className="box small row gap-2">
                  <Icon name="note" size={14} />
                  <div className="grow">
                    <div className="bold tiny" style={{ fontSize: 12 }}>Name-the-note · spaces</div>
                    <div className="tiny muted">drill · auto-graded</div>
                  </div>
                  <Tag>from lib</Tag>
                </div>
                <div className="box small row gap-2">
                  <Icon name="note" size={14} stroke="var(--accent)" />
                  <div className="grow">
                    <div className="bold tiny" style={{ fontSize: 12 }}>Play these 5 notes</div>
                    <div className="tiny muted">MIDI · play to advance · custom</div>
                  </div>
                  <Tag color="coral">new</Tag>
                </div>
                <div className="box small row gap-2 dashed" style={{ borderStyle: "dashed", background: "transparent" }}>
                  <span className="muted small">＋ exercise from library</span>
                  <span className="grow" />
                  <span className="muted small">＋ create here</span>
                </div>
              </div>

              <div className="hr-hand" />
              <div className="row gap-2">
                <button className="btn small ghost grow">duplicate</button>
                <button className="btn small grow">↑ move</button>
                <button className="btn small primary grow">save</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DTFrame>
  );
}

// ── PathLessonDetailPage — focused single-lesson editor ────

export function PathLessonDetailPage() {
  const { slug = "piano-fundamentals" } = useParams<{ slug: string; lessonId: string }>();
  const path = PATHS.find((p) => p.slug === slug) ?? PATHS[0];

  return (
    <DTFrame side="library">
      <div className="dt-main-head">
        <div className="row gap-3" style={{ alignItems: "center" }}>
          <Link to={`/coach/library/paths/${path.slug}`} className="btn icon ghost">
            <Icon name="back" size={14} />
          </Link>
          <div>
            <div className="row gap-2" style={{ alignItems: "baseline" }}>
              <span className="tiny muted">paths /</span>
              <span className="tiny muted">{path.title} /</span>
              <span className="tiny muted">lesson 3</span>
            </div>
            <h2 className="dt-title" style={{ fontSize: 28 }}>Reading treble clef</h2>
          </div>
        </div>
        <div className="row gap-2">
          <Tag>auto-saved · 14s ago</Tag>
          <button className="btn small ghost">preview as Maya</button>
          <button className="btn small primary">save &amp; close</button>
        </div>
      </div>

      <div className="dt-main-body">
        <div className="dt-cols" style={{ gridTemplateColumns: "1fr 320px", height: "100%", gap: 14 }}>
          {/* main editor */}
          <div className="panel" style={{ padding: 0 }}>
            <div className="panel-head" style={{ padding: "10px 16px" }}>
              <div className="pill-row">
                <span className="p on">content</span>
                <span className="p">attachments · 3</span>
                <span className="p">exercises · 4</span>
                <span className="p">settings</span>
              </div>
              <div className="row gap-2">
                <Tag>theory</Tag>
                <Tag>est. 12 min</Tag>
              </div>
            </div>

            <div className="panel-body scroll" style={{ padding: "16px 24px" }}>
              <div className="row gap-2 mb-2">
                <span className="small muted">TITLE</span>
              </div>
              <div className="box" style={{
                border: "1.5px dashed var(--ink)",
                fontFamily: "var(--scrawl)", fontSize: 22, padding: "8px 14px",
                background: "var(--paper)",
              }}>
                Reading treble clef{" "}
                <span style={{ borderRight: "1.5px solid var(--ink)", marginLeft: 2 }}>&nbsp;</span>
              </div>

              <div className="row gap-2 mt-3 mb-2">
                <span className="small muted">SHORT DESCRIPTION · shows on path tree</span>
              </div>
              <div className="box" style={{
                border: "1.5px dashed var(--ink-faint)",
                padding: "8px 12px", background: "var(--paper)",
                fontFamily: "var(--hand)", fontSize: 14,
              }}>
                The swirly clef — line and space names.
              </div>

              <div className="row gap-2 mt-3 mb-2">
                <span className="small muted">CONTENT</span>
                <span className="grow" />
                <div className="pill-row" style={{ fontSize: 11 }}>
                  <span className="p on">type</span>
                  <span className="p">handwrite</span>
                  <span className="p">voice</span>
                  <span className="p">video</span>
                </div>
              </div>

              <div className="content-blocks">
                <div className="cblock">
                  <div className="cblock-tag">¶ text</div>
                  <div className="cblock-body" style={{ fontFamily: "var(--hand)", fontSize: 15, lineHeight: 1.55 }}>
                    The <b>treble clef</b> wraps around the second line from the bottom — that's the
                    G line. Once you know G, you can count up or down. Most piano music for your
                    right hand lives on the treble staff.
                  </div>
                </div>

                <div className="cblock">
                  <div className="cblock-tag">⌘ key insight</div>
                  <div className="cblock-body" style={{
                    background: "var(--highlight)", padding: "6px 10px", borderRadius: 3,
                    fontFamily: "var(--hand)", fontSize: 15,
                  }}>
                    Lines: <b>E G B D F</b> · Spaces: <b>F A C E</b>
                  </div>
                </div>

                <div className="cblock">
                  <div className="cblock-tag">♬ inline sheet</div>
                  <div className="cblock-body" style={{ background: "var(--paper-2)", borderRadius: 4, padding: 8 }}>
                    <Staff
                      width={520}
                      notes={[
                        { pitch: "E4", dur: "q", x: 0 },
                        { pitch: "G4", dur: "q", x: 1 },
                        { pitch: "B4", dur: "q", x: 2 },
                        { pitch: "D5", dur: "q", x: 3 },
                      ]}
                      bar={1}
                    />
                  </div>
                </div>

                <div className="cblock">
                  <div className="cblock-tag">★ try it</div>
                  <div className="cblock-body" style={{ fontFamily: "var(--hand)", fontSize: 15, lineHeight: 1.5 }}>
                    Play E, G, B, D, F up the keyboard. Then say the names out loud as you play.
                    When you can do it without looking, you've got the lines. <br />
                    <span className="muted small">
                      → linked to exercise: <b>Name-the-note · lines</b>
                    </span>
                  </div>
                </div>

                <div className="cblock add">
                  <div className="cblock-tag">＋</div>
                  <div className="cblock-body row gap-2 muted small" style={{ flexWrap: "wrap" }}>
                    <span>add ¶ text</span><span>·</span>
                    <span>♬ sheet</span><span>·</span>
                    <span>🎙 voice memo</span><span>·</span>
                    <span>🎥 video</span><span>·</span>
                    <span>★ try-it</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* right · attachments + exercises */}
          <div className="col gap-3" style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div className="panel" style={{ flex: "0 0 auto" }}>
              <div className="panel-head">
                <div className="panel-title">Attachments</div>
                <span className="chip tiny">3</span>
              </div>
              <div className="panel-body col gap-1">
                <div className="box small row gap-2">
                  <Icon name="note" size={14} />
                  <div className="grow">
                    <div className="bold tiny" style={{ fontSize: 12 }}>treble-clef-cheatsheet.pdf</div>
                    <div className="tiny muted">1 page · printable · auto-attached on assign</div>
                  </div>
                  <Icon name="chev" size={11} />
                </div>
                <div className="box small row gap-2">
                  <span style={{ fontSize: 14 }}>♫</span>
                  <div className="grow">
                    <div className="bold tiny" style={{ fontSize: 12 }}>reading-demo.mid</div>
                    <div className="tiny muted">8 bars · slow · plays in browser</div>
                  </div>
                  <Icon name="play" size={11} />
                </div>
                <div className="box small row gap-2">
                  <span style={{ fontSize: 14 }}>🎙</span>
                  <div className="grow">
                    <div className="bold tiny" style={{ fontSize: 12 }}>klein-explains.mp3</div>
                    <div className="tiny muted">2:14 · your voice memo</div>
                  </div>
                  <Icon name="play" size={11} />
                </div>
                <div className="dropzone" style={{ padding: 10, marginTop: 6 }}>
                  <div className="small" style={{ fontFamily: "var(--hand)" }}>
                    drop a PDF, MIDI, audio, image…
                  </div>
                  <div className="tiny muted" style={{ fontFamily: "var(--hand)" }}>
                    or paste a link
                  </div>
                </div>
              </div>
            </div>

            <div className="panel tinted" style={{ flex: "1 1 auto", minHeight: 0 }}>
              <div className="panel-head">
                <div className="panel-title">Exercises</div>
                <span className="chip tiny">4</span>
              </div>
              <div className="panel-body scroll col gap-1">
                <div className="row gap-2 small">
                  <div className="pill-row">
                    <span className="p on">attached</span>
                    <span className="p">browse library</span>
                  </div>
                </div>

                <div className="box small row gap-2 mt-1">
                  <span className="drag-handle">⋮⋮</span>
                  <Icon name="metro" size={14} />
                  <div className="grow">
                    <div className="bold tiny" style={{ fontSize: 12 }}>Name-the-note · lines</div>
                    <div className="tiny muted">drill · 30 q · auto-graded</div>
                  </div>
                  <Tag>from lib</Tag>
                </div>
                <div className="box small row gap-2">
                  <span className="drag-handle">⋮⋮</span>
                  <Icon name="note" size={14} />
                  <div className="grow">
                    <div className="bold tiny" style={{ fontSize: 12 }}>Name-the-note · spaces</div>
                    <div className="tiny muted">drill · 30 q · auto-graded</div>
                  </div>
                  <Tag>from lib</Tag>
                </div>
                <div className="box small row gap-2" style={{ borderColor: "var(--accent)" }}>
                  <span className="drag-handle">⋮⋮</span>
                  <Icon name="note" size={14} stroke="var(--accent)" />
                  <div className="grow">
                    <div className="bold tiny" style={{ fontSize: 12 }}>Play these 5 notes</div>
                    <div className="tiny muted">MIDI · E G B D F · play to advance</div>
                  </div>
                  <Tag color="coral">new · custom</Tag>
                </div>
                <div className="box small row gap-2">
                  <span className="drag-handle">⋮⋮</span>
                  <Icon name="mic" size={14} />
                  <div className="grow">
                    <div className="bold tiny" style={{ fontSize: 12 }}>Sight-read · take 1</div>
                    <div className="tiny muted">record &amp; send · 4 bars</div>
                  </div>
                  <Tag>from lib</Tag>
                </div>

                <div className="row gap-2 mt-2">
                  <button className="btn small ghost grow">＋ from library</button>
                  <button className="btn small primary grow">＋ create here</button>
                </div>

                <div className="postit" style={{ transform: "rotate(0.5deg)", padding: 10, marginTop: 6 }}>
                  <div className="bold tiny" style={{ fontSize: 12 }}>auto-advance</div>
                  <Squiggle w={40} color="var(--ink-faint)" />
                  <div className="small" style={{ marginTop: 2, fontFamily: "var(--hand)" }}>
                    Student moves to next lesson when:
                    <div className="row gap-2 mt-1">
                      <div className="checkbox done" style={{ width: 14, height: 14 }} />
                      <span>all exercises complete</span>
                    </div>
                    <div className="row gap-2">
                      <div className="checkbox" style={{ width: 14, height: 14 }} />
                      <span>teacher unlocks manually</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DTFrame>
  );
}

// ── Mobile · path browse list ──────────────────────────────

export function PathsMobile() {
  return (
    <WFFrame navActive="home">
      <div className="wf-header">
        <div>
          <h2 className="wf-title">Paths</h2>
          <div className="wf-subtitle">{PATHS.length} paths · 23 students</div>
        </div>
        <button className="btn icon ghost"><Icon name="plus" size={14} /></button>
      </div>
      <div className="wf-body col gap-2 scroll-y">
        <div className="seg">
          <div className="s">items</div>
          <div className="s on">paths</div>
          <div className="s">shared</div>
        </div>

        {PATHS.slice(0, 5).map((p) => (
          <Link
            key={p.slug}
            to={`/coach/library/paths/${p.slug}`}
            className={"path-card path-card--mobile" + (p.coral ? " coral" : "")}
          >
            <div className="row gap-2">
              <span className="path-icon">⤳</span>
              <div className="grow">
                <div className="bold" style={{ fontSize: 14 }}>{p.title}</div>
                <div className="tiny muted">
                  {p.lessons} · {p.status === "draft" ? "draft" : `${p.students} on it`}
                </div>
              </div>
              {p.status === "draft" && <Tag>draft</Tag>}
              <Icon name="chev" size={11} />
            </div>
            <PathMini shape={p.shape} h={50} />
          </Link>
        ))}

        <button className="btn primary" style={{ marginTop: 4 }}>＋ new path</button>
      </div>
    </WFFrame>
  );
}
