// Paths — Khan-style lesson trees inside the Coach's Library.
//
// Reads from the API (/api/paths) backed by the Path + PathAssignment
// tables. Three views:
//
//   PathsBrowsePane   — grid of path cards rendered inside the Library
//                       page when the "paths" tab is active. Library
//                       owns surrounding chrome (header, tabs, search);
//                       this owns the filter strip + grid.
//   PathEditorPage    — full page: tree editor at /coach/library/paths/:slug
//   PathLessonDetailPage — full page: focused lesson editor at
//                       /coach/library/paths/:slug/lessons/:lessonId
//
// The lesson-level content (text/key-insight/inline-sheet/try-it blocks,
// attachments) is still mock — only the path itself + its node/edge
// graph is persisted. That'll evolve as the design firms up.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type {
  PathDetail,
  PathEdge,
  PathLessonNode,
  PathShape,
  PathStudentRef,
  PathSummary,
} from "@sunbird/shared";
import { apiFetch } from "@/lib/api";
import { DTFrame } from "../components/DTFrame";
import { WFFrame } from "../components/WFFrame";
import { Icon } from "../components/Icon";
import { Tag } from "../components/Tag";
import { Squiggle } from "../components/Squiggle";
import { Staff } from "../components/Staff";

// ── hooks ──────────────────────────────────────────────────

export function useCoachPaths() {
  const [paths, setPaths] = useState<PathSummary[] | undefined>();
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    apiFetch<{ data: PathSummary[] }>("/api/paths")
      .then((r) => setPaths(r.data))
      .catch(() => setPaths([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { paths, loading, refresh };
}

function useCoachPath(slug: string | undefined) {
  const [path, setPath] = useState<PathDetail | undefined>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const refresh = useCallback(() => {
    if (!slug) return;
    setLoading(true);
    setNotFound(false);
    apiFetch<{ data: PathDetail }>(`/api/paths/${slug}`)
      .then((r) => setPath(r.data))
      .catch((err: any) => {
        if (err?.status === 404) setNotFound(true);
        else setPath(undefined);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setNotFound(true);
      return;
    }
    refresh();
  }, [slug, refresh]);

  return { path, loading, notFound, refresh };
}

// Pick a fresh `n{N}` id that isn't already used in the node list. We
// keep the sequential pattern so seed data + new lessons read the same.
function nextNodeId(existing: PathLessonNode[]): string {
  const ids = new Set(existing.map((n) => n.id));
  let i = existing.length + 1;
  while (ids.has(`n${i}`)) i++;
  return `n${i}`;
}

// Minimal create flow — uses prompt() for now so we ship without a
// modal component. Returns the slug of the new path if successful so
// the caller can navigate into the editor.
async function createPathInteractive(): Promise<string | null> {
  const title = window.prompt("Name this path:")?.trim();
  if (!title) return null;
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  if (!slug) {
    window.alert("Couldn't derive a URL slug from that name.");
    return null;
  }
  try {
    await apiFetch<{ data: PathSummary }>("/api/paths", {
      method: "POST",
      body: JSON.stringify({
        slug,
        title,
        shape: "linear",
        status: "draft",
        nodes: [],
        edges: [],
      }),
    });
    return slug;
  } catch (err: any) {
    window.alert(err?.body?.error ?? "Couldn't create path.");
    return null;
  }
}

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

// ── PathsBrowsePane — grid of path cards. Library owns the outer
// chrome (header, tabs, search); this owns the status-filter strip
// and the card grid. ───────────────────────────────────────────────

type PathStatusFilter = "all" | "published" | "draft";

function PathStatusBar({
  active,
  onChange,
  counts,
}: {
  active: PathStatusFilter;
  onChange: (s: PathStatusFilter) => void;
  counts: { all: number; published: number; draft: number };
}) {
  const opts: Array<{ id: PathStatusFilter; label: string }> = [
    { id: "all", label: "all" },
    { id: "published", label: "published" },
    { id: "draft", label: "draft" },
  ];
  return (
    <div className="row gap-3" style={{ alignItems: "center", flexWrap: "wrap" }}>
      <span className="small muted" style={{ letterSpacing: "0.08em" }}>STATUS</span>
      <div className="pill-row" style={{ marginBottom: 0 }}>
        {opts.map((o) => {
          const n = o.id === "all" ? counts.all : counts[o.id];
          return (
            <span
              key={o.id}
              className={"p" + (active === o.id ? " on" : "")}
              onClick={() => onChange(o.id)}
              style={{ cursor: "pointer" }}
            >
              {o.label}
              {n > 0 ? ` · ${n}` : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function PathsBrowsePane({
  paths,
  loading,
  onCreate,
}: {
  paths: PathSummary[] | undefined;
  loading: boolean;
  onCreate: () => void;
}) {
  const [status, setStatus] = useState<PathStatusFilter>("all");

  const counts = useMemo(() => {
    const c = { all: 0, published: 0, draft: 0 };
    for (const p of paths ?? []) {
      c.all++;
      if (p.status === "published" || p.status === "draft") c[p.status]++;
    }
    return c;
  }, [paths]);

  const visible = useMemo(() => {
    if (!paths) return [];
    return status === "all" ? paths : paths.filter((p) => p.status === status);
  }, [paths, status]);

  return (
    <>
      <PathStatusBar active={status} onChange={setStatus} counts={counts} />

      <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", marginTop: 12 }}>
        {loading && !paths && (
          <div className="small muted" style={{ padding: "24px 4px" }}>loading paths…</div>
        )}

        <div className="paths-grid">
          {visible.map((p, i) => (
            <Link
              key={p.id}
              to={`/coach/library/paths/${p.slug}`}
              className={"path-card" + (p.coral ? " coral" : "")}
              style={{ transform: `rotate(${i % 2 === 0 ? -0.3 : 0.4}deg)` }}
            >
              <div className="path-card-head">
                <div className="row gap-2" style={{ alignItems: "flex-start" }}>
                  <span className="path-icon">⤳</span>
                  <div className="grow">
                    <div className="bold">{p.title}</div>
                    {p.sub && <div className="tiny muted">{p.sub}</div>}
                  </div>
                  {p.status === "draft" && <Tag>draft</Tag>}
                </div>
              </div>

              <PathMini shape={p.shape} />

              <div className="path-card-foot row gap-2 small">
                <Tag>{p.lessons} lesson{p.lessons === 1 ? "" : "s"}</Tag>
                {p.students > 0
                  ? <Tag color="coral">{p.students} on it</Tag>
                  : <span className="muted tiny">no students yet</span>}
                <span className="grow" />
                <span className="btn small ghost">open →</span>
              </div>
            </Link>
          ))}

          {/* "new path" tile — only on the "all" filter so the create
              affordance doesn't drift into a filtered subset */}
          {status === "all" && (
            <button
              className="path-card path-card--new"
              onClick={(e) => { e.preventDefault(); onCreate(); }}
              style={{ font: "inherit", color: "inherit", textAlign: "left" }}
            >
              <div className="row" style={{ flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 6 }}>
                <div style={{ fontSize: 28, lineHeight: 1, color: "var(--accent)" }}>＋</div>
                <div className="bold">New path</div>
                <div className="tiny muted" style={{ textAlign: "center", padding: "0 14px" }}>
                  start blank, from a student's history, or pick a template
                </div>
                <span className="btn small primary mt-1">create →</span>
              </div>
            </button>
          )}
        </div>

        {!loading && paths && paths.length === 0 && (
          <div className="small muted center" style={{ marginTop: 18 }}>
            No paths yet — click <b>+ new path</b> above to start one.
          </div>
        )}
        {!loading && paths && paths.length > 0 && visible.length === 0 && (
          <div className="small muted center" style={{ marginTop: 18 }}>
            No {status} paths.
          </div>
        )}
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
  studentsOnIt,
  onAddLesson,
}: {
  nodes: PathLessonNode[];
  edges: PathEdge[];
  selected?: string;
  pathSlug: string;
  studentsOnIt: PathStudentRef[];
  onAddLesson: () => void;
}) {
  // Lay out columns dynamically based on the max col index in nodes.
  const maxCol = Math.max(0, ...nodes.map((n) => n.col));
  const colCount = maxCol + 1;
  const COL_W = 180;
  const canvasW = Math.max(640, colCount * COL_W + 80);
  const colX = (col: number) => 40 + COL_W / 2 + col * COL_W;
  const rowY = (r: number) => 40 + r * 84;
  const nodeW = 130;
  const nodeH = 48;
  const maxRow = Math.max(0, ...nodes.map((n) => n.row));
  const lastNode = nodes[nodes.length - 1];
  // Reserve one extra row at the bottom for the "+ add lesson" placeholder.
  const totalH = rowY(maxRow + 1) + nodeH + 30;

  const pos = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return null;
    return { x: colX(n.col), y: rowY(n.row), n };
  };

  // Group students by their current lesson so the badge sits next to it.
  const studentsByNode = useMemo(() => {
    const map = new Map<string, PathStudentRef[]>();
    for (const s of studentsOnIt) {
      if (!s.currentLessonId) continue;
      const arr = map.get(s.currentLessonId) ?? [];
      arr.push(s);
      map.set(s.currentLessonId, arr);
    }
    return map;
  }, [studentsOnIt]);

  return (
    <svg viewBox={`0 0 ${canvasW} ${totalH}`} width="100%" height={totalH}
      style={{ display: "block", overflow: "visible" }}>
      {edges.map(([a, b], i) => {
        const A = pos(a);
        const B = pos(b);
        if (!A || !B) return null;
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
        const p = pos(n.id);
        if (!p) return null;
        const { x, y } = p;
        const isSel = n.id === selected;
        const done = n.state === "done";
        const current = n.state === "current";
        const locked = n.state === "locked";
        const checkpoint = /checkpoint|recital|review/i.test(n.meta) || /★/.test(n.title);
        const fill = isSel ? "var(--highlight)"
          : done ? "var(--paper-2)"
          : current ? "var(--accent-soft)"
          : "var(--paper)";
        const border = current ? "var(--accent)" : "var(--ink)";
        const strokeW = isSel || current ? 2.5 : 1.5;
        const studentsHere = studentsByNode.get(n.id) ?? [];
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

            {/* student avatars beside this node, if any are here */}
            {studentsHere.length > 0 && (
              <g transform={`translate(${x - nodeW / 2 - 12}, ${y})`}>
                {studentsHere.slice(0, 3).map((s, i) => (
                  <g key={s.id} transform={`translate(0, ${-28 - i * 18})`}>
                    <circle r="9" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
                    <text textAnchor="middle" y="3" fontSize="10" fontFamily="var(--scrawl)">
                      {s.name.charAt(0)}
                    </text>
                  </g>
                ))}
                <text x="-12" y={-28 - studentsHere.length * 18 + 4} textAnchor="end"
                  fontSize="9" fontFamily="var(--mono)" fill="var(--ink-faint)">
                  {studentsHere.length} here
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* "+ add lesson" placeholder slot — sits one row below the last
          node so the affordance lives inside the tree the coach is
          already looking at. Dashed connector telegraphs where the new
          node will land. */}
      {lastNode && (() => {
        const addX = colX(lastNode.col);
        const addY = rowY(lastNode.row + 1);
        const fromX = colX(lastNode.col);
        const fromY = rowY(lastNode.row) + nodeH / 2;
        const toY = addY - nodeH / 2;
        const midY = (fromY + toY) / 2;
        return (
          <g
            style={{ cursor: "pointer" }}
            onClick={onAddLesson}
          >
            <path
              d={`M ${fromX} ${fromY} C ${fromX} ${midY}, ${addX} ${midY}, ${addX} ${toY}`}
              stroke="var(--ink-faint)" strokeWidth="1.5" fill="none"
              strokeDasharray="4 4" opacity="0.6"
            />
            <rect
              x={addX - nodeW / 2} y={addY - nodeH / 2}
              width={nodeW} height={nodeH} rx="6"
              fill="transparent"
              stroke="var(--accent)" strokeWidth="1.5"
              strokeDasharray="5 4"
            />
            <text
              x={addX} y={addY + 2}
              textAnchor="middle"
              fontSize="14" fontFamily="var(--hand)"
              fill="var(--accent)" fontWeight="700"
            >
              ＋ add lesson
            </text>
            <text
              x={addX} y={addY + 18}
              textAnchor="middle"
              fontSize="10" fontFamily="var(--mono)"
              fill="var(--ink-faint)" letterSpacing="0.04em"
            >
              click to add
            </text>
          </g>
        );
      })()}
    </svg>
  );
}

// ── PathEditorPage — /coach/library/paths/:slug ────────────

function findCurrentLessonId(nodes: PathLessonNode[]): string | undefined {
  return nodes.find((n) => n.state === "current")?.id ?? nodes[0]?.id;
}

export function PathEditorPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { path, loading, notFound, refresh } = useCoachPath(slug);
  const { paths } = useCoachPaths();

  const selected = useMemo(
    () => (path ? findCurrentLessonId(path.nodes) : undefined),
    [path],
  );
  const selectedNode = path?.nodes.find((n) => n.id === selected);

  const addLesson = useCallback(async () => {
    if (!path) return;
    const title = window.prompt("Lesson title:")?.trim();
    if (!title) return;
    const id = nextNodeId(path.nodes);
    const lastNode = path.nodes[path.nodes.length - 1];
    const newNode: PathLessonNode = {
      id,
      col: lastNode ? lastNode.col : 1,
      row: lastNode ? lastNode.row + 1 : 0,
      title,
      titleB: "",
      meta: "",
    };
    const nextNodes = [...path.nodes, newNode];
    const nextEdges: PathEdge[] = lastNode
      ? [...path.edges, [lastNode.id, id]]
      : path.edges;
    try {
      await apiFetch(`/api/paths/${path.slug}`, {
        method: "PUT",
        body: JSON.stringify({ nodes: nextNodes, edges: nextEdges }),
      });
      refresh();
    } catch (err: any) {
      window.alert(err?.body?.error ?? "Couldn't add lesson.");
    }
  }, [path, refresh]);

  if (notFound) {
    return (
      <DTFrame side="library">
        <div className="dt-main-head">
          <div>
            <h2 className="dt-title">Path not found</h2>
            <div className="dt-sub">Maybe it was deleted or moved.</div>
          </div>
          <Link to="/coach/library?tab=paths" className="btn small primary">back to paths</Link>
        </div>
      </DTFrame>
    );
  }

  if (loading || !path) {
    return (
      <DTFrame side="library">
        <div className="dt-main-head">
          <div>
            <h2 className="dt-title">Loading…</h2>
            <div className="dt-sub">fetching path</div>
          </div>
        </div>
      </DTFrame>
    );
  }

  const lessonIdx = selected
    ? Math.max(0, path.nodes.findIndex((n) => n.id === selected)) + 1
    : 1;

  return (
    <DTFrame side="library">
      <div className="dt-main-head">
        <div className="row gap-3" style={{ alignItems: "center" }}>
          <Link to="/coach/library?tab=paths" className="btn icon ghost">
            <Icon name="back" size={14} />
          </Link>
          <div>
            <div className="row gap-2" style={{ alignItems: "baseline" }}>
              <span className="tiny muted">paths /</span>
              <h2 className="dt-title" style={{ fontSize: 26 }}>{path.title}</h2>
              <Tag>{path.status}</Tag>
            </div>
            <div className="dt-sub">
              {path.lessons} lesson{path.lessons === 1 ? "" : "s"} · {path.students}{" "}
              {path.students === 1 ? "student" : "students"} on it
            </div>
          </div>
        </div>
        <div className="row gap-2">
          <button className="btn small ghost">duplicate</button>
          <button className="btn small ghost">preview as student</button>
          <button className="btn small primary" onClick={addLesson}>＋ add lesson</button>
        </div>
      </div>

      <div className="dt-main-body">
        <div className="dt-cols" style={{ gridTemplateColumns: "200px 1fr 340px", height: "100%", gap: 14 }}>
          {/* path list rail */}
          <div className="panel" style={{ padding: "10px 8px" }}>
            <div className="small muted mb-2">YOUR PATHS</div>
            <div className="col gap-1 small">
              {(paths ?? []).map((p) => (
                <Link
                  key={p.id}
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
            <button
              className="btn small ghost mt-2"
              style={{ width: "100%" }}
              onClick={async () => {
                const newSlug = await createPathInteractive();
                if (newSlug) navigate(`/coach/library/paths/${newSlug}`);
              }}
            >
              ＋ new path
            </button>

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
                {path.nodes.length === 0 ? (
                  <div className="box dashed" style={{
                    margin: 40, padding: "32px 18px", textAlign: "center",
                    color: "var(--ink-soft)",
                  }}>
                    <div className="wf-scrawl bold" style={{ fontSize: 22, color: "var(--ink)" }}>
                      Empty path.
                    </div>
                    <div className="small muted mt-2 mb-3">
                      No lessons yet — drop in your first one.
                    </div>
                    <button className="btn primary" onClick={addLesson}>
                      ＋ add lesson
                    </button>
                  </div>
                ) : (
                  <PathTreeSVG
                    nodes={path.nodes}
                    edges={path.edges}
                    selected={selected}
                    pathSlug={path.slug}
                    studentsOnIt={path.studentsOnIt}
                    onAddLesson={addLesson}
                  />
                )}
              </div>
            </div>
          </div>

          {/* selected lesson detail */}
          <div className="panel tinted">
            <div className="panel-head">
              <div>
                <div className="tiny muted">
                  {selectedNode
                    ? `LESSON ${lessonIdx} of ${path.lessons}`
                    : "NO LESSON SELECTED"}
                </div>
                <div className="panel-title">
                  {selectedNode ? `${selectedNode.title} ${selectedNode.titleB}`.trim() : "—"}
                </div>
              </div>
              {selectedNode && (
                <Link to={`/coach/library/paths/${path.slug}/lessons/${selectedNode.id}`} className="btn small">
                  expand →
                </Link>
              )}
            </div>
            <div className="panel-body scroll col gap-3">
              {!selectedNode ? (
                <div className="col gap-3">
                  <div className="small muted">
                    This path has no lessons yet.
                  </div>
                  <button className="btn small primary" onClick={addLesson} style={{ alignSelf: "flex-start" }}>
                    ＋ add lesson
                  </button>
                </div>
              ) : (
                <>
                  <div className="row gap-2">
                    {selectedNode.state === "current" && <Tag color="coral">in focus</Tag>}
                    {selectedNode.meta && <Tag>{selectedNode.meta}</Tag>}
                  </div>

                  <div className="small muted">NOTES TO STUDENT</div>
                  <div className="box dashed" style={{
                    fontFamily: "var(--scrawl)", fontSize: 16, lineHeight: 1.45,
                    padding: "10px 12px", background: "var(--paper)",
                  }}>
                    Lesson content lives on the focused editor — open it to edit text,
                    attachments, and exercises.
                  </div>

                  <div className="hr-hand" />
                  <div className="row gap-2">
                    <button className="btn small ghost grow">duplicate</button>
                    <button className="btn small grow">↑ move</button>
                    <button className="btn small primary grow">save</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </DTFrame>
  );
}

// ── PathLessonDetailPage — focused single-lesson editor ────

export function PathLessonDetailPage() {
  const { slug, lessonId } = useParams<{ slug: string; lessonId: string }>();
  const { path, loading, notFound } = useCoachPath(slug);
  const node = path?.nodes.find((n) => n.id === lessonId);

  if (notFound || (path && !node && !loading)) {
    return (
      <DTFrame side="library">
        <div className="dt-main-head">
          <div>
            <h2 className="dt-title">Lesson not found</h2>
            <div className="dt-sub">It may have been removed from this path.</div>
          </div>
          <Link
            to={`/coach/library/paths/${slug ?? ""}`}
            className="btn small primary"
          >
            back to path
          </Link>
        </div>
      </DTFrame>
    );
  }

  if (loading || !path || !node) {
    return (
      <DTFrame side="library">
        <div className="dt-main-head">
          <div>
            <h2 className="dt-title">Loading…</h2>
          </div>
        </div>
      </DTFrame>
    );
  }

  const lessonIdx = Math.max(0, path.nodes.findIndex((n) => n.id === node.id)) + 1;
  const title = `${node.title} ${node.titleB}`.trim();

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
              <span className="tiny muted">lesson {lessonIdx}</span>
            </div>
            <h2 className="dt-title" style={{ fontSize: 28 }}>{title}</h2>
          </div>
        </div>
        <div className="row gap-2">
          <Tag>auto-saved · 14s ago</Tag>
          <button className="btn small ghost">preview as student</button>
          <button className="btn small primary">save &amp; close</button>
        </div>
      </div>

      <div className="dt-main-body">
        <div className="dt-cols" style={{ gridTemplateColumns: "1fr 320px", height: "100%", gap: 14 }}>
          {/* main editor — content blocks are illustrative for now */}
          <div className="panel" style={{ padding: 0 }}>
            <div className="panel-head" style={{ padding: "10px 16px" }}>
              <div className="pill-row">
                <span className="p on">content</span>
                <span className="p">attachments</span>
                <span className="p">exercises</span>
                <span className="p">settings</span>
              </div>
              <div className="row gap-2">
                {node.meta && <Tag>{node.meta}</Tag>}
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
                {title}{" "}
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
                {node.meta || "Add a one-line summary…"}
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
                    Add an explanation for {title}. What's the core idea? Where does it usually
                    trip students up?
                  </div>
                </div>

                <div className="cblock">
                  <div className="cblock-tag">⌘ key insight</div>
                  <div className="cblock-body" style={{
                    background: "var(--highlight)", padding: "6px 10px", borderRadius: 3,
                    fontFamily: "var(--hand)", fontSize: 15,
                  }}>
                    The one thing they should remember after this lesson.
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

          {/* right · attachments + exercises (still illustrative) */}
          <div className="col gap-3" style={{ minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div className="panel" style={{ flex: "0 0 auto" }}>
              <div className="panel-head">
                <div className="panel-title">Attachments</div>
                <span className="chip tiny">0</span>
              </div>
              <div className="panel-body col gap-1">
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
                <span className="chip tiny">0</span>
              </div>
              <div className="panel-body scroll col gap-1">
                <div className="row gap-2 small">
                  <div className="pill-row">
                    <span className="p on">attached</span>
                    <span className="p">browse library</span>
                  </div>
                </div>

                <div className="small muted center mt-3">No exercises attached yet.</div>

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
  const { paths, loading } = useCoachPaths();
  const navigate = useNavigate();

  return (
    <WFFrame navActive="home">
      <div className="wf-header">
        <div>
          <h2 className="wf-title">Paths</h2>
          <div className="wf-subtitle">
            {loading ? "loading…" : `${paths?.length ?? 0} paths`}
          </div>
        </div>
        <button
          className="btn icon ghost"
          onClick={async () => {
            const slug = await createPathInteractive();
            if (slug) navigate(`/coach/library/paths/${slug}`);
          }}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div className="wf-body col gap-2 scroll-y">
        <div className="seg">
          <div className="s">items</div>
          <div className="s on">paths</div>
          <div className="s">shared</div>
        </div>

        {!loading && paths && paths.length === 0 && (
          <div className="small muted center" style={{ marginTop: 18 }}>
            No paths yet — tap ＋ to start one.
          </div>
        )}

        {(paths ?? []).map((p) => (
          <Link
            key={p.id}
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

        <button
          className="btn primary"
          style={{ marginTop: 4 }}
          onClick={async () => {
            const slug = await createPathInteractive();
            if (slug) navigate(`/coach/library/paths/${slug}`);
          }}
        >
          ＋ new path
        </button>
      </div>
    </WFFrame>
  );
}
