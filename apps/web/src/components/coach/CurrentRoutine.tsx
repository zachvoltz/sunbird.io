import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  SINGING_EXERCISES,
  singingRoutineId,
  singingRoutineKind,
  CHORD_ROUTINE_ITEM_ID,
  CHORD_ROUTINE_TITLE,
  CHORD_ROUTINE_DURATION_MIN,
  type LibraryItemKind,
  type LibraryItemPublic,
  type RoutineItem,
  type RoutinePublic,
  type SingingExercise,
} from "@sunbird/shared";
import { Icon } from "@/wireframe/components/Icon";
import { Tag } from "@/wireframe/components/Tag";

// Built-in guided singing exercise → a routine item snapshot.
function itemFromSinging(ex: SingingExercise): RoutineItem {
  return {
    id: singingRoutineId(ex.type),
    libraryItemId: null,
    kind: singingRoutineKind(ex),
    title: ex.name,
    bars: null,
    bpmStart: null,
    bpmEnd: null,
    durationMin: ex.durationMin,
    note: null,
  };
}

// The Chord Flash Cards trainer as a routine item (rendered specially on the
// student's path — a link into the trainer rather than a library media item).
function chordRoutineItem(): RoutineItem {
  return {
    id: CHORD_ROUTINE_ITEM_ID,
    libraryItemId: null,
    kind: "exercise",
    title: CHORD_ROUTINE_TITLE,
    bars: null,
    bpmStart: null,
    bpmEnd: null,
    durationMin: CHORD_ROUTINE_DURATION_MIN,
    note: null,
  };
}

const KIND_ICON: Record<LibraryItemKind, "metro" | "note" | "mic"> = {
  warmup: "metro",
  exercise: "note",
  song: "mic",
};

const KIND_LABEL: Record<LibraryItemKind, string> = {
  warmup: "warmup",
  exercise: "exercise",
  song: "song",
};

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function itemFromLibrary(li: LibraryItemPublic): RoutineItem {
  return {
    id: makeId(),
    libraryItemId: li.id,
    kind: li.kind,
    title: li.title,
    bars: null,
    bpmStart: li.bpmStart,
    bpmEnd: li.bpmEnd,
    durationMin: li.durationMin,
    note: null,
  };
}

function summarizeItem(it: RoutineItem): string {
  const tempo =
    it.bpmStart && it.bpmEnd && it.bpmStart !== it.bpmEnd
      ? `${it.bpmStart} → ${it.bpmEnd} bpm`
      : it.bpmStart
      ? `${it.bpmStart} bpm`
      : null;
  return [KIND_LABEL[it.kind], it.bars, tempo, it.durationMin ? `${it.durationMin} min` : null]
    .filter(Boolean)
    .join(" · ");
}

type Props = {
  routine: RoutinePublic;
  /** When true, an "edit" button is shown. When false, the list is read-only. */
  editable: boolean;
  /** PUT endpoint, e.g. `/api/coaches/students/<id>/routine`. Required when editable. */
  saveUrl?: string;
  /** When set, the save also snapshots the routine onto this session (booking). */
  bookingId?: string;
  /** Called with the server-confirmed routine after a successful save. */
  onSaved?: (routine: RoutinePublic) => void;
  /** Section title; defaults to "Current routine". */
  title?: string;
  /** Override the empty-state copy. */
  emptyHint?: string;
  /** Start in edit mode (used by Next-tab where editing is the default). */
  startInEditMode?: boolean;
};

export function CurrentRoutine({
  routine,
  editable,
  saveUrl,
  bookingId,
  onSaved,
  title = "Current routine",
  emptyHint,
  startInEditMode = false,
}: Props) {
  const [editing, setEditing] = useState(startInEditMode && editable);
  const [draft, setDraft] = useState<RoutineItem[]>(routine.items);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drag-reorder state. dragIndex = the row being dragged; dragOverIndex =
  // the row the cursor is currently hovering. We use HTML5 DnD rather than
  // a library to keep the dep graph small.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Resync draft when the source routine changes (e.g., a parent refetched).
  // Skips while editing so an in-flight edit isn't trampled by a background refresh.
  useEffect(() => {
    if (!editing) setDraft(routine.items);
  }, [routine.items, editing]);

  const items = editing ? draft : routine.items;
  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(routine.items),
    [draft, routine.items],
  );

  function startEdit() {
    setDraft(routine.items);
    setError(null);
    setEditing(true);
  }
  function cancelEdit() {
    setDraft(routine.items);
    setError(null);
    setEditing(false);
  }
  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    const next = draft.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setDraft(next);
  }
  function remove(idx: number) {
    setDraft(draft.filter((_, i) => i !== idx));
  }
  function onDragStart(idx: number, e: React.DragEvent) {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = "move";
    // Firefox needs some payload on the dataTransfer to actually fire drag events.
    e.dataTransfer.setData("text/plain", String(idx));
  }
  function onDragOver(idx: number, e: React.DragEvent) {
    if (dragIndex === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== idx) setDragOverIndex(idx);
  }
  function onDrop(idx: number, e: React.DragEvent) {
    e.preventDefault();
    if (dragIndex !== null) reorder(dragIndex, idx);
    setDragIndex(null);
    setDragOverIndex(null);
  }
  function onDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }
  function updateNote(idx: number, note: string) {
    setDraft(draft.map((it, i) => (i === idx ? { ...it, note: note || null } : it)));
  }
  function addItem(it: RoutineItem) {
    setDraft([...draft, it]);
  }

  async function save() {
    if (!saveUrl) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: RoutinePublic }>(saveUrl, {
        method: "PUT",
        body: JSON.stringify(bookingId ? { items: draft, bookingId } : { items: draft }),
      });
      onSaved?.(res.data);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="row between mb-2">
        <div className="small muted" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
          {title} · {items.length} item{items.length === 1 ? "" : "s"}
        </div>
        {editable && !editing && (
          <button className="btn small ghost" onClick={startEdit}>✎ edit</button>
        )}
        {editable && editing && (
          <div className="row gap-2">
            <button className="btn small ghost" onClick={cancelEdit} disabled={saving}>
              cancel
            </button>
            <button
              className="btn small primary"
              onClick={save}
              disabled={saving || !dirty}
            >
              {saving ? "saving…" : "save"}
            </button>
          </div>
        )}
      </div>

      {items.length === 0 && !editing && (
        <div className="box dashed small muted">
          {emptyHint ?? "No routine set yet. Add items from the library →"}
        </div>
      )}

      {items.map((it, i) => {
        const isDragging = dragIndex === i;
        const isDropTarget =
          editing && dragIndex !== null && dragOverIndex === i && dragIndex !== i;
        return (
        <div
          className="box mb-2"
          key={it.id}
          draggable={editing}
          onDragStart={editing ? (e) => onDragStart(i, e) : undefined}
          onDragOver={editing ? (e) => onDragOver(i, e) : undefined}
          onDrop={editing ? (e) => onDrop(i, e) : undefined}
          onDragEnd={editing ? onDragEnd : undefined}
          style={{
            opacity: isDragging ? 0.4 : 1,
            cursor: editing ? "grab" : undefined,
            borderTop:
              isDropTarget && (dragIndex as number) > i
                ? "3px solid var(--accent)"
                : undefined,
            borderBottom:
              isDropTarget && (dragIndex as number) < i
                ? "3px solid var(--accent)"
                : undefined,
          }}
        >
          <div className="row gap-3">
            {editing && (
              <span
                className="muted"
                aria-label="Drag to reorder"
                style={{ cursor: "grab", userSelect: "none", letterSpacing: -2 }}
              >
                ⋮⋮
              </span>
            )}
            <span className="muted small" style={{ width: 18, textAlign: "right" }}>{i + 1}.</span>
            <Icon name={KIND_ICON[it.kind]} size={16} />
            <div className="grow">
              <div className="bold">{it.title}</div>
              <div className="tiny muted">{summarizeItem(it)}</div>
              {!editing && it.note && (
                <div className="small mt-1" style={{ fontStyle: "italic" }}>
                  "{it.note}"
                </div>
              )}
            </div>
            {editing ? (
              <button
                className="btn small ghost"
                onClick={() => remove(i)}
                aria-label="Remove from routine"
              >
                ✕
              </button>
            ) : (
              <Tag>{KIND_LABEL[it.kind]}</Tag>
            )}
          </div>
          {editing && (
            <input
              type="text"
              value={it.note ?? ""}
              onChange={(e) => updateNote(i, e.target.value)}
              placeholder="add a note for this step (optional)"
              className="mt-2"
              style={{
                width: "100%",
                fontFamily: "var(--hand)",
                fontSize: 13,
                padding: "5px 8px",
                border: "1.5px solid var(--ink-faint)",
                borderRadius: 6,
                background: "var(--paper)",
                color: "var(--ink)",
                outline: "none",
              }}
            />
          )}
        </div>
        );
      })}

      {editing && <LibraryPicker onPick={(it) => addItem(it)} existing={draft} />}

      {error && (
        <div className="small mt-2" style={{ color: "var(--accent)" }}>{error}</div>
      )}
    </div>
  );
}

// ── Library picker ──
//
// Fetches the coach's library once (cached at module scope) and presents
// a grouped list of warmups/exercises/songs. Picking one appends an
// itemFromLibrary() snapshot to the draft. Already-included items are
// dimmed but still clickable — a coach may want the same warmup twice.

let libraryCache: LibraryItemPublic[] | null = null;
let libraryInflight: Promise<LibraryItemPublic[]> | null = null;

function fetchLibrary(): Promise<LibraryItemPublic[]> {
  if (libraryCache) return Promise.resolve(libraryCache);
  if (libraryInflight) return libraryInflight;
  libraryInflight = apiFetch<{ data: LibraryItemPublic[] }>("/api/library")
    .then((r) => {
      libraryCache = r.data;
      libraryInflight = null;
      return r.data;
    })
    .catch(() => {
      libraryInflight = null;
      return [];
    });
  return libraryInflight;
}

function LibraryPicker({
  onPick,
  existing,
}: {
  onPick: (item: RoutineItem) => void;
  existing: RoutineItem[];
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LibraryItemPublic[]>(libraryCache ?? []);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(!libraryCache);

  useEffect(() => {
    if (libraryCache) return;
    let alive = true;
    fetchLibrary().then((r) => {
      if (!alive) return;
      setItems(r);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const existingLibIds = new Set(existing.map((e) => e.libraryItemId).filter(Boolean) as string[]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => it.title.toLowerCase().includes(q));
  }, [items, query]);
  const grouped = useMemo(() => {
    const g: Record<LibraryItemKind, LibraryItemPublic[]> = { warmup: [], exercise: [], song: [] };
    for (const it of filtered) g[it.kind].push(it);
    return g;
  }, [filtered]);

  if (!open) {
    return (
      <button className="box dashed small w-full" onClick={() => setOpen(true)} style={{ width: "100%", cursor: "pointer" }}>
        ＋ add from library
      </button>
    );
  }

  return (
    <div className="box" style={{ background: "var(--paper-2)" }}>
      <div className="row between mb-2">
        <div className="small bold">Library</div>
        <button className="btn small ghost" onClick={() => setOpen(false)}>done</button>
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="search…"
        style={{
          width: "100%",
          fontFamily: "var(--hand)",
          fontSize: 13,
          padding: "5px 8px",
          border: "1.5px solid var(--ink-faint)",
          borderRadius: 6,
          background: "var(--paper)",
          color: "var(--ink)",
          outline: "none",
          marginBottom: 8,
        }}
      />
      {/* Built-in guided vocal warmups — available to every coach. */}
      {(() => {
        const q = query.trim().toLowerCase();
        const sing = SINGING_EXERCISES.filter((ex) => !q || ex.name.toLowerCase().includes(q) || ex.meta.toLowerCase().includes(q));
        if (sing.length === 0) return null;
        const existingIds = new Set(existing.map((e) => e.id));
        return (
          <div className="mb-2">
            <div className="tiny muted mb-1" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
              guided vocal warmups · {sing.length}
            </div>
            {sing.map((ex) => {
              const already = existingIds.has(singingRoutineId(ex.type));
              return (
                <button
                  key={ex.type}
                  onClick={() => onPick(itemFromSinging(ex))}
                  className="box small row gap-2"
                  style={{ width: "100%", textAlign: "left", cursor: "pointer", opacity: already ? 0.55 : 1, marginBottom: 4 }}
                >
                  <Icon name={ex.kind === "breath" ? "metro" : "note"} size={14} />
                  <span className="grow">{ex.name} <span className="tiny muted">· {ex.meta}</span></span>
                  {already && <Tag>added</Tag>}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Chord Flash Cards trainer — available to every coach. */}
      {(() => {
        const q = query.trim().toLowerCase();
        if (q && !CHORD_ROUTINE_TITLE.toLowerCase().includes(q) && !"chords".includes(q)) return null;
        const already = existing.some((e) => e.id === CHORD_ROUTINE_ITEM_ID);
        return (
          <div className="mb-2">
            <div className="tiny muted mb-1" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
              practice tools
            </div>
            <button
              onClick={() => onPick(chordRoutineItem())}
              className="box small row gap-2"
              style={{ width: "100%", textAlign: "left", cursor: "pointer", opacity: already ? 0.55 : 1, marginBottom: 4 }}
            >
              <span style={{ fontSize: 15 }}>🎸</span>
              <span className="grow">{CHORD_ROUTINE_TITLE} <span className="tiny muted">· chord trainer</span></span>
              {already && <Tag>added</Tag>}
            </button>
          </div>
        );
      })()}

      {loading && <div className="small muted">Loading…</div>}
      {!loading && filtered.length === 0 && SINGING_EXERCISES.length === 0 && (
        <div className="small muted">No items match.</div>
      )}
      {(["warmup", "exercise", "song"] as LibraryItemKind[]).map((kind) => {
        const list = grouped[kind];
        if (list.length === 0) return null;
        return (
          <div key={kind} className="mb-2">
            <div className="tiny muted mb-1" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
              {KIND_LABEL[kind]}s · {list.length}
            </div>
            {list.map((li) => {
              const already = existingLibIds.has(li.id);
              return (
                <button
                  key={li.id}
                  onClick={() => onPick(itemFromLibrary(li))}
                  className="box small row gap-2"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    cursor: "pointer",
                    opacity: already ? 0.55 : 1,
                    marginBottom: 4,
                  }}
                >
                  <Icon name={KIND_ICON[li.kind]} size={14} />
                  <span className="grow">{li.title}</span>
                  {already && <Tag>added</Tag>}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
