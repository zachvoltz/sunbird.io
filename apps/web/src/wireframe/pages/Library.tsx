import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { DTFrame } from "../components/DTFrame";
import { WFFrame } from "../components/WFFrame";
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

// Render the item metadata under each row the same way the design
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

// Top-level tab pills (items vs paths) — sits in the panel header.
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
    </div>
  );
}

// Horizontal type/kind filter strip — sits above the list. Wired to
// real filtering so the chips do something rather than just decorate.
type ExerciseKindFilter = LibraryItemKind | "all";

function ExerciseTypeFilter({
  active,
  onChange,
  counts,
}: {
  active: ExerciseKindFilter;
  onChange: (k: ExerciseKindFilter) => void;
  counts: { all: number; warmup: number; exercise: number; song: number };
}) {
  const opts: Array<{ id: ExerciseKindFilter; label: string }> = [
    { id: "all", label: "all" },
    { id: "warmup", label: "warmups" },
    { id: "exercise", label: "exercises" },
    { id: "song", label: "songs" },
  ];
  return (
    <div className="row gap-3" style={{ alignItems: "center", flexWrap: "wrap" }}>
      <span className="small muted" style={{ letterSpacing: "0.08em" }}>TYPE</span>
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

// Inline-edit row for a library item. View mode renders like LibItem
// but with an "edit" button; edit mode expands the row into a small
// form with save / cancel / delete. Saves PUT, deletes DELETE; both
// call `onChange` (typically refreshItems) so the list re-fetches.
const editInputStyle: React.CSSProperties = {
  fontFamily: "var(--hand)",
  fontSize: 14,
  padding: "4px 8px",
  border: "1.5px solid var(--ink-faint)",
  borderRadius: 6,
  background: "var(--paper)",
  color: "var(--ink)",
  outline: "none",
};

function LibraryRow({
  item,
  onChange,
}: {
  item: LibraryItemPublic;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LibraryItemPublic>(item);
  const [tagsInput, setTagsInput] = useState<string>(item.tags.join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync local draft if the parent's item reference changes (e.g.
  // after refresh) — but only when we're not in the middle of an edit.
  useEffect(() => {
    if (!editing) {
      setDraft(item);
      setTagsInput(item.tags.join(", "));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.updatedAt]);

  const cancel = () => {
    setDraft(item);
    setTagsInput(item.tags.join(", "));
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      await apiFetch(`/api/library/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({
          kind: draft.kind,
          title: draft.title,
          subtitle: draft.subtitle ?? undefined,
          tags,
          bpmStart: draft.bpmStart ?? undefined,
          bpmEnd: draft.bpmEnd ?? undefined,
          durationMin: draft.durationMin ?? undefined,
          hasMidi: draft.hasMidi,
        }),
      });
      setEditing(false);
      onChange();
    } catch (err: any) {
      setError(err?.body?.error ?? "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const del = async () => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    try {
      await apiFetch(`/api/library/${item.id}`, { method: "DELETE" });
      onChange();
    } catch (err: any) {
      window.alert(err?.body?.error ?? "Couldn't delete");
    }
  };

  if (!editing) {
    return (
      <div className="box small mb-2">
        <div className="row gap-3" style={{ alignItems: "center" }}>
          <span className="drag-handle">⋮⋮</span>
          <Icon name={KIND_ICON[item.kind]} size={16} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="bold">{item.title}</div>
            <div className="tiny muted">{formatItemSubtitle(item)}</div>
          </div>
          {item.tags.map((t) => <Tag key={t}>{t}</Tag>)}
          <button className="btn small ghost" onClick={() => setEditing(true)}>edit</button>
        </div>
      </div>
    );
  }

  return (
    <div className="box small mb-2" style={{ borderColor: "var(--accent)", borderWidth: 2 }}>
      <div className="col gap-2">
        <div className="row gap-2" style={{ flexWrap: "wrap" }}>
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Title"
            style={{ ...editInputStyle, flex: "1 1 200px", minWidth: 0 }}
          />
          <select
            value={draft.kind}
            onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as LibraryItemKind }))}
            style={{ ...editInputStyle, flex: "0 0 auto" }}
          >
            <option value="warmup">warmup</option>
            <option value="exercise">exercise</option>
            <option value="song">song</option>
          </select>
        </div>

        <div className="row gap-2" style={{ alignItems: "center", flexWrap: "wrap" }}>
          <label className="tiny muted">bpm</label>
          <input
            type="number"
            value={draft.bpmStart ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, bpmStart: e.target.value ? Number(e.target.value) : null }))}
            placeholder="start"
            style={{ ...editInputStyle, width: 80 }}
          />
          <span className="muted small">→</span>
          <input
            type="number"
            value={draft.bpmEnd ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, bpmEnd: e.target.value ? Number(e.target.value) : null }))}
            placeholder="end"
            style={{ ...editInputStyle, width: 80 }}
          />
          <label className="tiny muted" style={{ marginLeft: 12 }}>min</label>
          <input
            type="number"
            value={draft.durationMin ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, durationMin: e.target.value ? Number(e.target.value) : null }))}
            placeholder=""
            style={{ ...editInputStyle, width: 70 }}
          />
          <label className="row gap-1 small" style={{ alignItems: "center", marginLeft: 12 }}>
            <input
              type="checkbox"
              checked={draft.hasMidi}
              onChange={(e) => setDraft((d) => ({ ...d, hasMidi: e.target.checked }))}
            />
            MIDI
          </label>
        </div>

        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="tags, comma, separated"
          style={{ ...editInputStyle, width: "100%" }}
        />

        <input
          value={draft.subtitle ?? ""}
          onChange={(e) => setDraft((d) => ({ ...d, subtitle: e.target.value || null }))}
          placeholder="subtitle (optional — overrides the auto-derived line)"
          style={{ ...editInputStyle, width: "100%" }}
        />

        {error && <div className="small" style={{ color: "var(--accent)" }}>{error}</div>}

        <div className="row gap-2" style={{ alignItems: "center" }}>
          <button className="btn small primary" onClick={save} disabled={saving || !draft.title.trim()}>
            {saving ? "saving…" : "save"}
          </button>
          <button className="btn small ghost" onClick={cancel}>cancel</button>
          <span className="grow" />
          <button
            className="btn small ghost"
            onClick={del}
            style={{ color: "var(--accent)" }}
          >
            delete
          </button>
        </div>
      </div>
    </div>
  );
}

function ExercisesPane({
  items,
  loading,
  onCreate,
  onChange,
}: {
  items: LibraryItemPublic[] | undefined;
  loading: boolean;
  onCreate: () => void;
  onChange: () => void;
}) {
  const [kindFilter, setKindFilter] = useState<ExerciseKindFilter>("all");

  const counts = useMemo(() => {
    const c = { all: 0, warmup: 0, exercise: 0, song: 0 };
    for (const it of items ?? []) {
      c.all++;
      if (it.kind === "warmup" || it.kind === "exercise" || it.kind === "song") c[it.kind]++;
    }
    return c;
  }, [items]);

  // Group by kind so each section renders in the expected order. The
  // kindFilter narrows which sections are shown.
  const grouped = useMemo(() => {
    const map: Record<LibraryItemKind, LibraryItemPublic[]> = {
      warmup: [], exercise: [], song: [],
    };
    for (const it of items ?? []) {
      if (kindFilter !== "all" && it.kind !== kindFilter) continue;
      if (it.kind === "warmup" || it.kind === "exercise" || it.kind === "song") {
        map[it.kind].push(it);
      }
    }
    return map;
  }, [items, kindFilter]);

  const visibleCount = grouped.warmup.length + grouped.exercise.length + grouped.song.length;
  const total = items?.length ?? 0;

  return (
    <>
      <ExerciseTypeFilter active={kindFilter} onChange={setKindFilter} counts={counts} />

      <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", marginTop: 12 }}>
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

        {!loading && total > 0 && visibleCount === 0 && (
          <div className="small muted center" style={{ padding: "20px 4px" }}>
            No {kindFilter === "all" ? "items" : kindFilter + "s"} match this filter.
          </div>
        )}

        {(["warmup", "exercise", "song"] as LibraryItemKind[]).map((kind) => {
          const list = grouped[kind];
          if (list.length === 0) return null;
          return (
            <div key={kind}>
              <div className="small muted mt-3 mb-2">{KIND_LABEL[kind]}</div>
              {list.map((it) => (
                <LibraryRow key={it.id} item={it} onChange={onChange} />
              ))}
            </div>
          );
        })}
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

  return (
    <DTFrame side="library">
      <div className="dt-main-head">
        <div>
          <h2 className="dt-title">Library</h2>
          <div className="dt-sub">
            {isPaths
              ? "your paths — drag onto a student's week"
              : "your warmups, exercises, and songs"}
          </div>
        </div>
        <div className="row gap-2">
          {isPaths ? (
            <button className="btn small primary" onClick={handleCreatePath}>＋ new path</button>
          ) : (
            <>
              <button className="btn small ghost" onClick={handleCreateItem}>＋ quick add</button>
              <Link to="/coach/midi/capture" className="btn small primary">＋ record new</Link>
            </>
          )}
        </div>
      </div>

      <div className="dt-main-body">
        <div className="panel" style={{ height: "100%", padding: "12px 16px" }}>
          {/* Top header row: tab pills + search + sort */}
          <div className="row between mb-3" style={{ flexWrap: "wrap", gap: 12 }}>
            <TabPills tab={tab} onChange={setTab} itemCount={itemCount} pathCount={pathCount} />
            <div className="row gap-2">
              <div className="dt-search" style={{ flex: "0 0 220px", padding: "4px 12px" }}>
                <span>⌕</span>
                <span>search {isPaths ? "paths" : "library"}…</span>
              </div>
              <div className="pill-row">
                <span className="p on">recent</span>
                <span className="p">A–Z</span>
                <span className="p">most-used</span>
              </div>
            </div>
          </div>

          {isPaths ? (
            <PathsBrowsePane
              paths={paths}
              loading={pathsLoading}
              onCreate={handleCreatePath}
            />
          ) : (
            <ExercisesPane
              items={items}
              loading={itemsLoading}
              onCreate={handleCreateItem}
              onChange={refreshItems}
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
