import { useMemo, useState } from "react";
import {
  SINGING_LIBRARY,
  singingExercise,
  singingRoutineId,
  singingTypeFromId,
  type RoutineItem,
  type SingingExercise,
} from "@sunbird/shared";
import { routineApi } from "@/lib/api";
import { Icon } from "./Icon";
import { Squiggle } from "./Squiggle";

// airflow glyph for breath exercises
function Puff({ size = 15, stroke = "currentColor" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 7 h8 a2.2 2.2 0 1 0 -2.2 -2.2" />
      <path d="M3 11 h11 a2.4 2.4 0 1 1 -2.4 2.4" />
      <path d="M3 15 h6" />
    </svg>
  );
}
function kindIcon(kind: string, stroke: string, size = 15) {
  if (kind === "warmup") return <Puff size={size} stroke={stroke} />;
  if (kind === "song") return <Icon name="headphones" size={size} stroke={stroke} />;
  return <Icon name="note" size={size} stroke={stroke} />;
}

const DUR_PRESETS = [1, 2, 3, 5];
function nextDuration(cur: number | null): number {
  const i = cur == null ? -1 : DUR_PRESETS.indexOf(cur);
  return DUR_PRESETS[(i + 1) % DUR_PRESETS.length];
}
function minsOf(items: { durationMin: number | null }[]): number {
  return items.reduce((s, i) => s + (i.durationMin ?? 0), 0);
}

type DraftItem = {
  id?: string;
  title: string;
  kind: "warmup" | "exercise" | "song";
  durationMin: number | null;
  singType: string | null;
};

function toDraft(it: RoutineItem): DraftItem {
  return {
    id: it.id,
    title: it.title,
    kind: (it.kind as DraftItem["kind"]) ?? "exercise",
    durationMin: it.durationMin ?? null,
    singType: singingTypeFromId(it.id),
  };
}

type Screen = "edit" | "library" | "recap";

export function RoutineEditor({
  coachItems,
  initial,
  onClose,
  onSaved,
}: {
  coachItems: RoutineItem[]; // locked, teacher-set
  initial: RoutineItem[]; // the student's own, editable
  onClose: () => void;
  onSaved: (items: RoutineItem[]) => void;
}) {
  const [screen, setScreen] = useState<Screen>("edit");
  const [rows, setRows] = useState<DraftItem[]>(() => initial.map(toDraft));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialIds = useMemo(() => new Set(initial.map((i) => i.id)), [initial]);
  const [recap, setRecap] = useState<{ added: number; removed: number; order: RoutineItem[] } | null>(null);

  const totalMin = minsOf(coachItems) + minsOf(rows);

  // ── row ops ──
  const move = (i: number, dir: -1 | 1) =>
    setRows((r) => {
      const j = i + dir;
      if (j < 0 || j >= r.length) return r;
      const n = [...r];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  const remove = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const retime = (i: number) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, durationMin: nextDuration(row.durationMin) } : row)));
  const setTitle = (i: number, title: string) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, title } : row)));
  const addSinging = (ex: SingingExercise) =>
    setRows((r) =>
      r.some((row) => row.id === singingRoutineId(ex.type))
        ? r
        : [...r, { id: singingRoutineId(ex.type), title: ex.name, kind: ex.kind === "breath" ? "warmup" : "exercise", durationMin: ex.durationMin, singType: ex.type }],
    );
  const addCustom = () => {
    setRows((r) => [...r, { title: "", kind: "exercise", durationMin: null, singType: null }]);
    setScreen("edit");
  };

  async function save() {
    const payload = rows
      .filter((d) => d.singType || d.title.trim().length > 0)
      .map((d) => ({ id: d.id, title: d.singType ? d.title : d.title.trim(), durationMin: d.durationMin }));
    setSaving(true);
    setError(null);
    try {
      const routine = await routineApi.updateCustom(payload);
      onSaved(routine.items);
      const savedIds = new Set(routine.items.map((i) => i.id));
      const added = routine.items.filter((i) => !initialIds.has(i.id)).length;
      const removed = [...initialIds].filter((id) => !savedIds.has(id)).length;
      setRecap({ added, removed, order: [...coachItems, ...routine.items] });
      setScreen("recap");
    } catch (e: any) {
      setError(e?.body?.error ?? "Couldn't save your routine.");
    } finally {
      setSaving(false);
    }
  }

  async function undo() {
    setSaving(true);
    try {
      const routine = await routineApi.updateCustom(initial.map((i) => ({ id: i.id, title: i.title, durationMin: i.durationMin })));
      onSaved(routine.items);
    } catch {
      /* ignore */
    }
    onClose();
  }

  return (
    <div
      onClick={screen === "edit" ? undefined : () => {}}
      style={{ position: "fixed", inset: 0, zIndex: 40, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        className="box thick"
        style={{ width: "100%", maxWidth: 440, height: "min(760px, 92vh)", background: "var(--paper)", padding: 0, boxShadow: "4px 5px 0 var(--ink)", display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        {screen === "edit" && (
          <EditScreen
            coachItems={coachItems}
            rows={rows}
            totalMin={totalMin}
            saving={saving}
            error={error}
            onCancel={onClose}
            onDone={save}
            onAdd={() => setScreen("library")}
            move={move}
            remove={remove}
            retime={retime}
            setTitle={setTitle}
          />
        )}
        {screen === "library" && (
          <LibraryScreen rows={rows} onBack={() => setScreen("edit")} onAddSinging={addSinging} onAddCustom={addCustom} />
        )}
        {screen === "recap" && recap && <RecapScreen recap={recap} totalMin={totalMin} initialIds={initialIds} onUndo={undo} onClose={onClose} />}
      </div>
    </div>
  );
}

// ── edit ─────────────────────────────────────────────────
function EditScreen({
  coachItems,
  rows,
  totalMin,
  saving,
  error,
  onCancel,
  onDone,
  onAdd,
  move,
  remove,
  retime,
  setTitle,
}: {
  coachItems: RoutineItem[];
  rows: DraftItem[];
  totalMin: number;
  saving: boolean;
  error: string | null;
  onCancel: () => void;
  onDone: () => void;
  onAdd: () => void;
  move: (i: number, d: -1 | 1) => void;
  remove: (i: number) => void;
  retime: (i: number) => void;
  setTitle: (i: number, t: string) => void;
}) {
  return (
    <>
      <div className="wf-header" style={{ alignItems: "center", flex: "none" }}>
        <button className="btn small ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div className="wf-scrawl bold" style={{ fontSize: 21, lineHeight: 1 }}>Editing routine</div>
          <div className="tiny muted">reorder · remove · retime</div>
        </div>
        <button className="btn small accent" onClick={onDone} disabled={saving}>{saving ? "Saving…" : "Done"}</button>
      </div>

      <div className="wf-body col gap-2 scroll-y" style={{ flex: 1, overflowY: "auto", padding: "6px 16px 16px" }}>
        {/* locked coach items */}
        {coachItems.map((ex) => (
          <Row key={ex.id} locked kind={ex.kind} title={ex.title} durationMin={ex.durationMin} sub="set by your coach" />
        ))}

        {/* editable student items */}
        {rows.map((row, i) => (
          <Row
            key={row.id ?? `new-${i}`}
            kind={row.kind}
            title={row.title}
            singing={!!row.singType}
            durationMin={row.durationMin}
            sub={row.singType ? "guided" : "your exercise"}
            onUp={i > 0 ? () => move(i, -1) : undefined}
            onDown={i < rows.length - 1 ? () => move(i, 1) : undefined}
            onRemove={() => remove(i)}
            onRetime={() => retime(i)}
            onTitle={row.singType ? undefined : (t) => setTitle(i, t)}
          />
        ))}

        <button className="btn ghost" style={{ width: "100%", borderColor: "var(--accent)", color: "var(--accent)", marginTop: 4 }} onClick={onAdd}>
          <Icon name="plus" size={15} stroke="var(--accent)" /> Add from library
        </button>

        <div className="row between small muted" style={{ padding: "2px 4px" }}>
          <span>total time</span>
          <span className="bold" style={{ color: "var(--ink)" }}>~{totalMin} min</span>
        </div>

        {error && <div className="tiny" style={{ color: "var(--accent)" }}>{error}</div>}

        {coachItems.length > 0 && (
          <div className="postit small" style={{ transform: "rotate(0.5deg)" }}>
            greyed rows are your coach's required warmup — reorder &amp; add around them.
          </div>
        )}
      </div>
    </>
  );
}

// a single routine row (locked or editable)
function Row({
  locked,
  singing,
  kind,
  title,
  durationMin,
  sub,
  onUp,
  onDown,
  onRemove,
  onRetime,
  onTitle,
}: {
  locked?: boolean;
  singing?: boolean;
  kind: string;
  title: string;
  durationMin: number | null;
  sub: string;
  onUp?: () => void;
  onDown?: () => void;
  onRemove?: () => void;
  onRetime?: () => void;
  onTitle?: (t: string) => void;
}) {
  const stroke = locked ? "var(--ink-faint)" : "var(--ink)";
  return (
    <div className="box" style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", opacity: locked ? 0.6 : 1 }}>
      {!locked && (
        <div className="col" style={{ gap: 2 }}>
          <button className="btn icon small" aria-label="Move up" onClick={onUp} disabled={!onUp} style={{ width: 24, height: 20, opacity: onUp ? 1 : 0.25 }}>↑</button>
          <button className="btn icon small" aria-label="Move down" onClick={onDown} disabled={!onDown} style={{ width: 24, height: 20, opacity: onDown ? 1 : 0.25 }}>↓</button>
        </div>
      )}
      {locked && <span style={{ width: 22, textAlign: "center", color: "var(--ink-faint)" }}>🔒</span>}
      <span style={{ flex: "none", width: 32, height: 32, borderRadius: 9, border: `1.6px solid ${locked ? "var(--ink-faint)" : "var(--ink)"}`, display: "grid", placeItems: "center", background: "var(--paper)" }}>
        {kindIcon(kind, stroke)}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {onTitle ? (
          <input
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            placeholder="Exercise name"
            maxLength={120}
            style={{ width: "100%", border: 0, borderBottom: "1.5px solid var(--ink-faint)", background: "transparent", outline: "none", fontFamily: "var(--hand)", fontSize: 15, color: "var(--ink)", padding: "2px 0", fontWeight: 700 }}
          />
        ) : (
          <div className="bold small" style={{ lineHeight: 1.15 }}>{title}</div>
        )}
        <div className="tiny muted">{singing ? "guided · " : ""}{sub}</div>
      </div>
      {onRetime ? (
        <button className="chip tiny" style={{ borderStyle: "dashed", cursor: "pointer", flex: "none" }} onClick={onRetime}>
          {durationMin ?? "–"}m ▾
        </button>
      ) : (
        <span className="chip tiny" style={{ flex: "none" }}>{durationMin ?? "–"}m</span>
      )}
      {onRemove && (
        <button className="btn icon" aria-label="Remove" onClick={onRemove} style={{ width: 30, height: 30, borderColor: "var(--accent)", flex: "none" }}>
          <span style={{ color: "var(--accent)", fontSize: 16, lineHeight: 1 }}>–</span>
        </button>
      )}
      {locked && <span className="btn icon" style={{ width: 30, height: 30, opacity: 0.3, borderStyle: "dashed", flex: "none" }}>–</span>}
    </div>
  );
}

// ── library ──────────────────────────────────────────────
type Filter = "all" | "breath" | "scale" | "rec";
function LibraryScreen({
  rows,
  onBack,
  onAddSinging,
  onAddCustom,
}: {
  rows: DraftItem[];
  onBack: () => void;
  onAddSinging: (ex: SingingExercise) => void;
  onAddCustom: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const added = useMemo(() => new Set(rows.map((r) => r.id).filter(Boolean) as string[]), [rows]);

  const q = query.trim().toLowerCase();
  const sections = SINGING_LIBRARY.map((sec) => ({
    section: sec.section,
    items: sec.items.filter((ex) => {
      if (filter === "breath" && ex.kind !== "breath") return false;
      if (filter === "scale" && ex.kind !== "scale") return false;
      if (filter === "rec" && !ex.recommended) return false;
      if (q && !ex.name.toLowerCase().includes(q) && !ex.meta.toLowerCase().includes(q)) return false;
      return true;
    }),
  })).filter((s) => s.items.length > 0);

  return (
    <>
      <div className="wf-header" style={{ alignItems: "center", flex: "none" }}>
        <button className="btn icon" aria-label="Back" onClick={onBack}>‹</button>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div className="wf-scrawl bold" style={{ fontSize: 21, lineHeight: 1 }}>Add exercises</div>
          <div className="tiny muted">tap + to drop into your routine</div>
        </div>
        <span style={{ width: 38 }} />
      </div>

      <div className="wf-body col gap-3 scroll-y" style={{ flex: 1, overflowY: "auto", padding: "6px 16px 16px" }}>
        <div className="box small row gap-2" style={{ alignItems: "center", padding: "6px 12px" }}>
          <Icon name="note" size={14} stroke="var(--ink-faint)" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search exercises…"
            style={{ flex: 1, border: 0, background: "transparent", outline: "none", fontFamily: "var(--hand)", fontSize: 15, color: "var(--ink)" }}
          />
        </div>
        <div className="row gap-2" style={{ flexWrap: "wrap" }}>
          {([["all", "All"], ["breath", "Breath"], ["scale", "Scales"], ["rec", "★ Suggested"]] as [Filter, string][]).map(([f, label]) => (
            <button key={f} className={"chip" + (filter === f ? (f === "rec" ? " accent" : " filled") : "")} style={{ cursor: "pointer" }} onClick={() => setFilter(f)}>
              {label}
            </button>
          ))}
        </div>

        {sections.map((sec) => (
          <div key={sec.section} className="col gap-2">
            <div className="small muted" style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>{sec.section}</div>
            {sec.items.map((ex) => {
              const isAdded = added.has(singingRoutineId(ex.type));
              return (
                <div key={ex.type} className="box" style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", borderColor: isAdded ? "var(--accent)" : undefined, background: isAdded ? "var(--accent-soft)" : undefined }}>
                  <span style={{ flex: "none", width: 32, height: 32, borderRadius: 9, border: `1.6px solid ${isAdded ? "var(--accent)" : "var(--ink)"}`, display: "grid", placeItems: "center", background: "var(--paper)" }}>
                    {kindIcon(ex.kind === "breath" ? "warmup" : "exercise", isAdded ? "var(--accent)" : "var(--ink)")}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="bold small" style={{ lineHeight: 1.15 }}>{ex.name}</div>
                    <div className="tiny muted">{ex.meta}{ex.recommended && <span style={{ color: "var(--accent)" }}> · ★ suggested</span>}</div>
                  </div>
                  {isAdded ? (
                    <span className="chip tiny accent" style={{ flex: "none" }}>added ✓</span>
                  ) : (
                    <button className="btn icon" onClick={() => onAddSinging(ex)} aria-label={`Add ${ex.name}`} style={{ width: 32, height: 32, flex: "none" }}>
                      <Icon name="plus" size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div className="col gap-2">
          <div className="small muted" style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}>Your own</div>
          <button className="box dashed row gap-2" style={{ width: "100%", padding: "10px 11px", cursor: "pointer", alignItems: "center", textAlign: "left" }} onClick={onAddCustom}>
            <span style={{ flex: "none", width: 32, height: 32, borderRadius: 9, border: "1.6px dashed var(--ink-faint)", display: "grid", placeItems: "center" }}>
              <Icon name="plus" size={15} stroke="var(--ink-faint)" />
            </span>
            <span className="grow small bold">Write your own exercise</span>
          </button>
        </div>
      </div>

      <div style={{ padding: "10px 16px 14px", borderTop: "1.5px dashed var(--ink-faint)", flex: "none" }}>
        <button className="btn accent big" style={{ width: "100%", boxShadow: "2px 2px 0 var(--ink)" }} onClick={onBack}>
          Done · back to routine
        </button>
      </div>
    </>
  );
}

// ── recap ────────────────────────────────────────────────
function RecapScreen({
  recap,
  totalMin,
  initialIds,
  onUndo,
  onClose,
}: {
  recap: { added: number; removed: number; order: RoutineItem[] };
  totalMin: number;
  initialIds: Set<string>;
  onUndo: () => void;
  onClose: () => void;
}) {
  const changeText =
    recap.added && recap.removed
      ? `${recap.added} added, ${recap.removed} removed`
      : recap.added
        ? `${recap.added} added`
        : recap.removed
          ? `${recap.removed} removed`
          : "reordered";
  return (
    <>
      <div className="wf-header" style={{ flex: "none" }}>
        <div>
          <h2 className="wf-title">Routine updated</h2>
          <div className="wf-subtitle">{recap.order.length} exercises · ~{totalMin} min · saved</div>
        </div>
        <button className="btn small ghost" onClick={onUndo}><Icon name="back" size={12} /> Undo</button>
      </div>

      <div className="wf-body col gap-3 scroll-y" style={{ flex: 1, overflowY: "auto", padding: "6px 16px 16px" }}>
        <div className="box thick accent center" style={{ padding: 14 }}>
          <div style={{ fontSize: 26 }}>✓</div>
          <div className="wf-scrawl bold" style={{ fontSize: 24, lineHeight: 1.05, color: "var(--accent)" }}>{changeText}</div>
          <div className="small muted">shared with your coach automatically</div>
          <Squiggle w={70} color="var(--accent)" />
        </div>

        <div className="small muted" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>Your new order</div>
        <div className="col gap-2">
          {recap.order.map((ex, i) => {
            const isNew = !initialIds.has(ex.id) && (ex.id.startsWith("custom-") || ex.id.startsWith("sing-"));
            const stroke = isNew ? "var(--accent)" : "var(--ink)";
            return (
              <div key={ex.id + i} className="box" style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 11px", borderColor: isNew ? "var(--accent)" : undefined, background: isNew ? "var(--accent-soft)" : undefined }}>
                <span style={{ flex: "none", width: 30, height: 30, borderRadius: 9, border: `1.6px solid ${stroke}`, display: "grid", placeItems: "center", background: "var(--paper)" }}>
                  {kindIcon(ex.kind, stroke)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bold small" style={{ lineHeight: 1.15 }}>{ex.title}</div>
                  <div className="tiny muted">{isNew ? <span style={{ color: "var(--accent)" }}>just added</span> : ex.kind === "warmup" ? "breath" : "voice · pitch"}</div>
                </div>
                <span className="chip tiny" style={{ flex: "none" }}>{ex.durationMin ?? "–"}m</span>
              </div>
            );
          })}
        </div>

        <div className="postit small" style={{ transform: "rotate(-0.5deg)" }}>
          your routine syncs to your lesson — add anything back anytime from the library.
        </div>
      </div>

      <div style={{ padding: "10px 16px 14px", borderTop: "1.5px dashed var(--ink-faint)", flex: "none" }}>
        <button className="btn accent big" style={{ width: "100%", boxShadow: "2px 2px 0 var(--ink)" }} onClick={onClose}>
          <Icon name="play" size={15} stroke="white" /> Back to routine
        </button>
      </div>
    </>
  );
}
