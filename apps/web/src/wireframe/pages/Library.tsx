import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { DTFrame } from "../components/DTFrame";
import { WFFrame } from "../components/WFFrame";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { Tag } from "../components/Tag";
import { LibItem } from "../components/LibItem";
import { useIsMobile } from "../hooks/useIsMobile";
import { PathsBrowsePane, PathsMobile, useCoachPaths } from "./Paths";
import { apiFetch } from "@/lib/api";
import type { LibraryItemKind, LibraryItemPublic, PathSummary } from "@sunbird/shared";

const KIND_LABEL: Record<LibraryItemKind, string> = {
  warmup: "WARMUPS",
  exercise: "EXERCISES",
  song: "SONGS & PIECES",
};
const KIND_ICON: Record<LibraryItemKind, "metro" | "note" | "mic"> = {
  warmup: "metro",
  exercise: "note",
  song: "mic",
};

// Render the booking metadata under each item the same way the design
// mocked it: "<kind> · <bpm range> · <duration> · <MIDI?>".
function formatItemSubtitle(it: LibraryItemPublic): string {
  if (it.subtitle && it.subtitle.trim().length > 0) return it.subtitle;
  const parts: string[] = [it.kind];
  if (it.bpmStart != null && it.bpmEnd != null && it.bpmStart !== it.bpmEnd) {
    parts.push(`${it.bpmStart}→${it.bpmEnd} bpm`);
  } else if (it.bpmStart != null) {
    parts.push(`${it.bpmStart} bpm`);
  }
  if (it.durationMin != null) parts.push(`${it.durationMin} min`);
  if (it.hasMidi) parts.push("MIDI");
  if (it.pdfUrl) parts.push("PDF");
  return parts.join(" · ");
}

function useLibraryItems() {
  const [items, setItems] = useState<LibraryItemPublic[] | undefined>();
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(() => {
    setLoading(true);
    apiFetch<{ data: LibraryItemPublic[] }>("/api/library")
      .then((r) => setItems(r.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { items, loading, refresh };
}

async function promptCreateLibraryItem(): Promise<LibraryItemPublic | null> {
  const title = window.prompt("Title for the new library item:")?.trim();
  if (!title) return null;
  const kindRaw = window
    .prompt("Kind — warmup / exercise / song:", "exercise")
    ?.trim()
    .toLowerCase();
  const kind: LibraryItemKind =
    kindRaw === "warmup" || kindRaw === "song" ? kindRaw : "exercise";
  try {
    const res = await apiFetch<{ data: LibraryItemPublic }>("/api/library", {
      method: "POST",
      body: JSON.stringify({ title, kind }),
    });
    return res.data;
  } catch (err: any) {
    window.alert(err?.body?.error ?? "Couldn't create item.");
    return null;
  }
}

type LibTab = "exercises" | "paths";

function useLibTab(): [LibTab, (t: LibTab) => void] {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get("tab");
  const initial: LibTab = fromUrl === "paths" ? "paths" : "exercises";
  const [tab, setTab] = useState<LibTab>(initial);
  const update = (t: LibTab) => {
    setTab(t);
    const next = new URLSearchParams(params);
    if (t === "paths") next.set("tab", "paths");
    else next.delete("tab");
    setParams(next, { replace: true });
  };
  return [tab, update];
}

// Pill toggle reused in both the filter rail's VIEW section and the
// middle-column header so the active subview is unambiguous.
function TabPills({
  tab,
  onChange,
  itemCount,
  pathCount,
}: {
  tab: LibTab;
  onChange: (t: LibTab) => void;
  itemCount: number;
  pathCount: number;
}) {
  return (
    <div className="pill-row" style={{ marginBottom: 0 }}>
      <span
        className={"p" + (tab === "exercises" ? " on" : "")}
        onClick={() => onChange("exercises")}
        style={{ cursor: "pointer" }}
      >
        items · {itemCount}
      </span>
      <span
        className={"p" + (tab === "paths" ? " on" : "")}
        onClick={() => onChange("paths")}
        style={{ cursor: "pointer" }}
      >
        paths · {pathCount}
      </span>
      <span className="p muted" style={{ opacity: 0.6 }}>tags</span>
      <span className="p muted" style={{ opacity: 0.6 }}>shared</span>
    </div>
  );
}

async function promptCreatePath(): Promise<string | null> {
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

function ExercisesFilterRail({ items }: { items: LibraryItemPublic[] | undefined }) {
  const counts = useMemo(() => {
    const c = { all: 0, warmup: 0, exercise: 0, song: 0 };
    for (const it of items ?? []) {
      c.all++;
      if (it.kind === "warmup" || it.kind === "exercise" || it.kind === "song") c[it.kind]++;
    }
    return c;
  }, [items]);
  return (
    <>
      <div className="small muted mb-2">TYPE</div>
      <div className="col gap-1 small">
        <div className="row gap-2"><div className="checkbox done" style={{ width: 16, height: 16 }} /> all <span className="muted" style={{ marginLeft: "auto" }}>{counts.all}</span></div>
        <div className="row gap-2"><div className="checkbox" style={{ width: 16, height: 16 }} /> warmups <span className="muted" style={{ marginLeft: "auto" }}>{counts.warmup}</span></div>
        <div className="row gap-2"><div className="checkbox" style={{ width: 16, height: 16 }} /> exercises <span className="muted" style={{ marginLeft: "auto" }}>{counts.exercise}</span></div>
        <div className="row gap-2"><div className="checkbox" style={{ width: 16, height: 16 }} /> songs <span className="muted" style={{ marginLeft: "auto" }}>{counts.song}</span></div>
      </div>

      <div className="small muted mt-3 mb-2">FOR</div>
      <div className="col gap-1 small">
        <div>♪ beginner · 14</div>
        <div>♪ intermediate · 20</div>
        <div>♪ advanced · 8</div>
      </div>

      <div className="small muted mt-3 mb-2">TAGS</div>
      <div className="row gap-1" style={{ flexWrap: "wrap" }}>
        <Tag>scales</Tag><Tag>finger ind.</Tag><Tag color="coral">phrasing</Tag>
        <Tag>sight-read</Tag><Tag>dynamics</Tag><Tag>technique</Tag>
        <Tag color="yellow">recital</Tag>
      </div>

      <div className="hr-hand" />
      <div className="small muted mb-1">SHARED WITH YOU</div>
      <div className="small">· M. Ortega · 6</div>
      <div className="small">· Suzuki packet · 11</div>
    </>
  );
}

function PathsFilterRail() {
  return (
    <>
      <div className="small muted mb-2">STATUS</div>
      <div className="col gap-1 small">
        <div className="row gap-2"><div className="checkbox done" style={{ width: 14, height: 14 }} /> all</div>
        <div className="row gap-2"><div className="checkbox" style={{ width: 14, height: 14 }} /> published <span className="muted" style={{ marginLeft: "auto" }}>4</span></div>
        <div className="row gap-2"><div className="checkbox" style={{ width: 14, height: 14 }} /> draft <span className="muted" style={{ marginLeft: "auto" }}>2</span></div>
      </div>

      <div className="small muted mt-3 mb-2">FOR</div>
      <div className="col gap-1 small">
        <div>♪ piano · 4</div>
        <div>♪ voice · 1</div>
        <div>♪ any · 1</div>
      </div>

      <div className="hr-hand" />
      <div className="small muted mb-1">TEMPLATES</div>
      <div className="small">· Suzuki bk 1</div>
      <div className="small">· Bastien primer</div>
      <div className="small">· Voice · sing speech</div>
    </>
  );
}

function ExercisesPane({
  items,
  loading,
  onCreate,
}: {
  items: LibraryItemPublic[] | undefined;
  loading: boolean;
  onCreate: () => void;
}) {
  // Group by kind so each section renders in the expected order.
  const grouped = useMemo(() => {
    const map: Record<LibraryItemKind, LibraryItemPublic[]> = {
      warmup: [], exercise: [], song: [],
    };
    for (const it of items ?? []) {
      if (it.kind === "warmup" || it.kind === "exercise" || it.kind === "song") {
        map[it.kind].push(it);
      }
    }
    return map;
  }, [items]);

  const total = items?.length ?? 0;

  return (
    <>
      {/* item grid */}
      <div className="panel" style={{ padding: "10px 14px" }}>
        <div className="row between mb-2">
          <div className="row gap-2">
            <div className="dt-search" style={{ flex: "0 0 220px", padding: "4px 12px" }}>
              <span>⌕</span><span>search library…</span>
            </div>
            <div className="pill-row">
              <span className="p on">recent</span>
              <span className="p">A–Z</span>
              <span className="p">most-used</span>
            </div>
          </div>
          <div className="row gap-2">
            <button className="btn small ghost" onClick={onCreate}>＋ quick add</button>
            <span className="tiny muted">{total} item{total === 1 ? "" : "s"}</span>
          </div>
        </div>

        <div className="panel-body scroll">
          {loading && !items && (
            <div className="small muted" style={{ padding: "20px 4px" }}>loading library…</div>
          )}

          {!loading && total === 0 && (
            <div className="box dashed" style={{ textAlign: "center", padding: "32px 16px", color: "var(--ink-soft)" }}>
              <div className="wf-scrawl bold" style={{ fontSize: 22, color: "var(--ink)" }}>
                Empty library.
              </div>
              <div className="small muted mt-2 mb-3">
                Add a warmup, exercise, or song to get started.
              </div>
              <button className="btn primary" onClick={onCreate}>＋ add an item</button>
            </div>
          )}

          {(["warmup", "exercise", "song"] as LibraryItemKind[]).map((kind) => {
            const list = grouped[kind];
            if (list.length === 0) return null;
            return (
              <div key={kind}>
                <div className="small muted mt-3 mb-2">{KIND_LABEL[kind]}</div>
                {list.map((it) => (
                  <LibItem
                    key={it.id}
                    icon={KIND_ICON[it.kind]}
                    title={it.title}
                    sub={formatItemSubtitle(it)}
                    tags={it.tags}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* assign-to rail */}
      <div className="panel tinted">
        <div className="panel-head">
          <div className="panel-title">Assign to…</div>
        </div>
        <div className="panel-body scroll col gap-2">
          <div className="small muted">QUICK · drag here</div>
          <div className="dropzone">
            <div style={{ fontSize: 18, marginBottom: 4 }}>drop on a student's week ↓</div>
            <div className="small muted" style={{ fontFamily: "var(--hand)" }}>or pick from list</div>
          </div>

          {[
            { n: "Maya R.", when: "this week", drop: true },
            { n: "Theo P.", when: "this week" },
            { n: "Lina S.", when: "next week" },
            { n: "Jonas K.", when: "this week" },
            { n: "Sam W.", when: "next week" },
            { n: "Ana B.", when: "next week" },
          ].map((s) => (
            <div
              key={s.n}
              className={"box small row gap-2" + (s.drop ? " accent" : "")}
              style={{ borderWidth: s.drop ? 2 : 1.5, position: "relative" }}
            >
              <Avatar name={s.n} size={26} />
              <div className="grow">
                <div className="bold small">{s.n}</div>
                <div className="tiny muted">{s.when}</div>
              </div>
              {s.drop && <span className="chip tiny accent">drop ↓</span>}
            </div>
          ))}

          <div className="hr-hand" />
          <button className="btn small ghost">＋ multi-select students</button>
        </div>
      </div>
    </>
  );
}

function LibraryDesktop() {
  const [tab, setTab] = useLibTab();
  const isPaths = tab === "paths";
  const { paths, loading: pathsLoading, refresh: refreshPaths } = useCoachPaths();
  const { items, loading: itemsLoading, refresh: refreshItems } = useLibraryItems();
  const navigate = useNavigate();

  const pathCount = paths?.length ?? 0;
  const itemCount = items?.length ?? 0;

  const handleCreatePath = async () => {
    const newSlug = await promptCreatePath();
    if (newSlug) {
      refreshPaths();
      navigate(`/coach/library/paths/${newSlug}`);
    }
  };

  const handleCreateItem = async () => {
    const created = await promptCreateLibraryItem();
    if (created) refreshItems();
  };

  const handleCreate = isPaths ? handleCreatePath : handleCreateItem;

  return (
    <DTFrame side="library">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Library</h2>
          <div className="dt-sub">
            {isPaths
              ? "your collection — items + paths · drag onto a student's week"
              : "42 items · your collection · drag onto a student's week →"}
          </div>
        </div>
        <div className="row gap-2">
          <button className="btn small ghost">import MIDI / PDF</button>
          {isPaths ? (
            <button className="btn small primary" onClick={handleCreate}>＋ new path</button>
          ) : (
            <Link to="/coach/midi/capture" className="btn small primary">＋ record new</Link>
          )}
        </div>
      </div>

      <div className="dt-main-body">
        <div className="dt-cols" style={{ gridTemplateColumns: "180px 1fr 320px", height: "100%", gap: 14 }}>
          {/* filter rail — VIEW pill toggle on top, then context-specific filters */}
          <div className="panel" style={{ padding: "12px 10px" }}>
            <div className="small muted mb-2">VIEW</div>
            <div className="col gap-1 small mb-2">
              <div
                className={"row gap-2"}
                style={{
                  cursor: "pointer",
                  padding: "1px 2px",
                  borderRadius: 3,
                  background: tab === "exercises" ? "var(--highlight)" : undefined,
                }}
                onClick={() => setTab("exercises")}
              >
                <span style={{ width: 14 }}>{tab === "exercises" ? "▸" : "·"}</span>
                <b style={{ fontWeight: tab === "exercises" ? 700 : 500 }}>items</b>
                <span className="muted" style={{ marginLeft: "auto" }}>42</span>
              </div>
              <div
                className="row gap-2"
                style={{
                  cursor: "pointer",
                  padding: "1px 2px",
                  borderRadius: 3,
                  background: tab === "paths" ? "var(--highlight)" : undefined,
                }}
                onClick={() => setTab("paths")}
              >
                <span style={{ width: 14 }}>{tab === "paths" ? "▸" : "·"}</span>
                <b style={{ fontWeight: tab === "paths" ? 700 : 500 }}>paths</b>
                <span className="muted" style={{ marginLeft: "auto" }}>{pathCount}</span>
              </div>
            </div>

            {isPaths ? <PathsFilterRail /> : <ExercisesFilterRail items={items} />}
          </div>

          {isPaths ? (
            <PathsBrowsePane
              activeFilters={<TabPills tab={tab} onChange={setTab} itemCount={itemCount} pathCount={pathCount} />}
              paths={paths}
              loading={pathsLoading}
              onCreate={handleCreatePath}
            />
          ) : (
            <ExercisesPane
              items={items}
              loading={itemsLoading}
              onCreate={handleCreateItem}
            />
          )}
        </div>
      </div>
    </DTFrame>
  );
}

function LibraryMobile() {
  const [tab, setTab] = useLibTab();
  const { items, loading, refresh } = useLibraryItems();

  if (tab === "paths") return <PathsMobile />;

  const count = items?.length ?? 0;

  return (
    <WFFrame navActive="home">
      <div className="wf-header">
        <div>
          <h2 className="wf-title">Library</h2>
          <div className="wf-subtitle">
            {loading ? "loading…" : `${count} item${count === 1 ? "" : "s"}`}
          </div>
        </div>
        <button
          className="btn icon ghost"
          onClick={async () => {
            const created = await promptCreateLibraryItem();
            if (created) refresh();
          }}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
      <div className="wf-body col gap-2 scroll-y">
        <div className="dt-search" style={{ padding: "4px 12px" }}>
          <span>⌕</span><span>search…</span>
        </div>
        <div className="seg">
          <div className="s on" onClick={() => setTab("exercises")}>items</div>
          <div className="s" onClick={() => setTab("paths")}>paths</div>
          <div className="s">shared</div>
        </div>

        {!loading && count === 0 && (
          <div className="small muted center" style={{ marginTop: 18 }}>
            No items yet — tap ＋ to add one.
          </div>
        )}

        {(items ?? []).map((it) => (
          <LibItem
            key={it.id}
            icon={KIND_ICON[it.kind]}
            title={it.title}
            sub={formatItemSubtitle(it)}
            tags={it.tags}
          />
        ))}

        {count > 0 && (
          <div className="postit small wf-scrawl" style={{ transform: "rotate(0.4deg)" }}>
            Tap any item to assign · long-press to multi-select
          </div>
        )}
      </div>
    </WFFrame>
  );
}

export function LibraryPage() {
  const isMobile = useIsMobile();
  return isMobile ? <LibraryMobile /> : <LibraryDesktop />;
}
