import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CHORD_ROUTINE_ITEM_ID, singingExercise, singingTypeFromId } from "@sunbird/shared";
import type { LibraryItemKind, RoutineItem, StudentDetailPublic } from "@sunbird/shared";
import { apiFetch } from "@/lib/api";
import { STFrame } from "../components/STFrame";
import { Icon } from "../components/Icon";
import { RoutineEditor } from "../components/RoutineEditor";
import { AudioPlayer, MidiPlayer } from "../components/WaveformPlayer";
import { useMyStudentDetail } from "../hooks/useCoachData";
import { useIsMobile } from "../hooks/useIsMobile";

const KIND_LABEL: Record<LibraryItemKind, string> = {
  warmup: "warmup",
  exercise: "exercise",
  song: "song",
};

// ── path geometry ────────────────────────────────────────
// One stop per routine item, laid out as a vertical serpentine so the path
// scales to any number of items (the old design hard-coded six slots).
const VB_W = 300;
const TOP = 46;
const GAP = 108;
const LEFT_X = 74;
const RIGHT_X = 226;

function slotFor(i: number): { x: number; y: number } {
  return { x: i % 2 === 0 ? LEFT_X : RIGHT_X, y: TOP + i * GAP };
}

function buildPathD(n: number): string {
  if (n === 0) return "";
  let d = `M ${slotFor(0).x} ${slotFor(0).y}`;
  for (let i = 1; i < n; i++) {
    const a = slotFor(i - 1);
    const b = slotFor(i);
    const bow = i % 2 === 0 ? 72 : -72; // alternate the curve's bend
    const cx = (a.x + b.x) / 2 + bow;
    const cy = (a.y + b.y) / 2;
    d += ` Q ${cx} ${cy} ${b.x} ${b.y}`;
  }
  return d;
}

function tempoLabel(it: RoutineItem): string | null {
  if (it.bpmStart && it.bpmEnd && it.bpmStart !== it.bpmEnd) return `${it.bpmStart} → ${it.bpmEnd} bpm`;
  if (it.bpmStart) return `${it.bpmStart} bpm`;
  return null;
}

function metaLine(it: RoutineItem): string {
  return [KIND_LABEL[it.kind], it.bars, tempoLabel(it), it.durationMin ? `${it.durationMin} min` : null]
    .filter(Boolean)
    .join(" · ");
}

// ── path SVG ─────────────────────────────────────────────
function PathSvg({
  items,
  selectedId,
  onSelect,
}: {
  items: RoutineItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const n = items.length;
  const viewH = TOP + Math.max(0, n - 1) * GAP + 64;
  const pathD = buildPathD(n);
  return (
    <svg viewBox={`0 0 ${VB_W} ${viewH}`} width="100%" height={viewH} style={{ display: "block" }}>
      {pathD && (
        <path
          d={pathD}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="2.5"
          strokeDasharray="2 6"
          strokeLinecap="round"
        />
      )}
      {items.map((it, i) => {
        const slot = slotFor(i);
        const done = !!it.completedToday;
        const selected = it.id === selectedId;
        const isSong = it.kind === "song";
        const fill = done ? "var(--accent)" : selected ? "white" : "var(--paper)";
        const stroke = selected || done ? "var(--accent)" : "var(--ink)";
        const r = selected ? 25 : 20;
        return (
          <g key={it.id} style={{ cursor: "pointer" }} onClick={() => onSelect(it.id)}>
            {selected && (
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
            <text
              x={slot.x}
              y={slot.y + 6}
              textAnchor="middle"
              fill={done ? "white" : "var(--ink)"}
              fontFamily="Caveat"
              fontSize="20"
              fontWeight="700"
            >
              {done ? "✓" : isSong ? "♪" : i + 1}
            </text>
            <text
              x={slot.x}
              y={slot.y + r + 17}
              textAnchor="middle"
              fill="var(--ink)"
              fontFamily="Patrick Hand"
              fontSize="13"
            >
              {it.title.length > 20 ? it.title.slice(0, 18) + "…" : it.title}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── exercise detail pane ─────────────────────────────────
function ExerciseDetail({
  item,
  index,
  total,
  busy,
  onToggle,
  onPrev,
  onNext,
}: {
  item: RoutineItem;
  index: number;
  total: number;
  busy: boolean;
  onToggle: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const done = !!item.completedToday;
  const hasMidi = !!(item.hasMidi && item.midiUrl);
  const isChord = item.id === CHORD_ROUTINE_ITEM_ID;
  const singType = singingTypeFromId(item.id);
  const singEx = singType ? singingExercise(singType) : undefined;
  return (
    <div className="wf" style={{ minHeight: 0 }}>
      <div className="row" style={{ alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <button
          className="btn icon small"
          onClick={onPrev}
          disabled={!onPrev}
          aria-label="Previous exercise"
          style={{ opacity: onPrev ? 1 : 0.3 }}
        >
          ‹
        </button>
        <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: 0.5, textAlign: "center" }}>
          Stop {index + 1} of {total} · {KIND_LABEL[item.kind]}
          {done && " · done"}
        </div>
        <button
          className="btn icon small"
          onClick={onNext}
          disabled={!onNext}
          aria-label="Next exercise"
          style={{ opacity: onNext ? 1 : 0.3 }}
        >
          ›
        </button>
      </div>

      <h2 className="wf-title" style={{ marginBottom: 2 }}>{item.title}</h2>
      <div className="wf-subtitle" style={{ marginBottom: 14 }}>{metaLine(item)}</div>

      {item.note && (
        <div className="box mb-3" style={{ background: "var(--paper-2)" }}>
          <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            from your coach
          </div>
          <div className="wf-scrawl" style={{ fontSize: 17, lineHeight: 1.15 }}>"{item.note}"</div>
        </div>
      )}

      {isChord ? (
        <>
          <div className="box mb-3" style={{ background: "var(--paper-2)" }}>
            <div className="wf-scrawl" style={{ fontSize: 17, lineHeight: 1.2 }}>
              Spaced-repetition chord practice — run today's due cards.
            </div>
          </div>
          <Link
            to="/practice/chords"
            className="btn accent big mb-3"
            style={{ width: "100%", textDecoration: "none" }}
          >
            <Icon name="play" size={15} stroke="white" /> Practice chords →
          </Link>
        </>
      ) : singType ? (
        <>
          <div className="box mb-3" style={{ background: "var(--paper-2)" }}>
            <div className="wf-scrawl" style={{ fontSize: 17, lineHeight: 1.2 }}>
              {singEx?.kind === "breath"
                ? "Guided breath drill — follow the pacer."
                : "Guided vocal drill — sing along, live pitch feedback."}
            </div>
          </div>
          <Link
            to={`/practice/sing/${singType}`}
            className="btn accent big mb-3"
            style={{ width: "100%", textDecoration: "none" }}
          >
            <Icon name="play" size={15} stroke="white" /> Start exercise →
          </Link>
        </>
      ) : (
        <>
          {/* Audio — SoundCloud-style waveform player */}
          {item.audioUrl ? (
            <div className="box mb-3">
              <AudioPlayer key={`audio-${item.id}`} src={item.audioUrl} label="reference audio" />
            </div>
          ) : null}

          {/* MIDI — same player UI, driven by the Magenta synth */}
          {hasMidi && (
            <div className="box mb-3">
              <MidiPlayer key={`midi-${item.id}`} src={item.midiUrl!} label="play-along (MIDI)" />
            </div>
          )}

          {/* PDF / sheet music */}
          {item.pdfUrl && (
            <a href={item.pdfUrl} target="_blank" rel="noreferrer" className="btn ghost small mb-3" style={{ textDecoration: "none" }}>
              open sheet music →
            </a>
          )}

          {!item.audioUrl && !hasMidi && !item.pdfUrl && (
            <div className="box dashed small muted mb-3">No audio or MIDI attached to this exercise.</div>
          )}
        </>
      )}

      <button
        className={"btn big " + (done ? "ghost" : "accent")}
        onClick={onToggle}
        disabled={busy}
        style={{ width: "100%" }}
      >
        {done ? "↩ mark not done" : (
          <>
            <Icon name="play" size={15} stroke="white" /> mark done for today
          </>
        )}
      </button>
    </div>
  );
}

// ── streak row ───────────────────────────────────────────
const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

// Last `n` calendar days as UTC YYYY-MM-DD keys (matching the server's day
// key), most-recent last, so the row reads left→right ending on today.
function lastNDaysUTC(n: number): Array<{ key: string; label: string; isToday: boolean }> {
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const out: Array<{ key: string; label: string; isToday: boolean }> = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(todayUTC - i * 86_400_000);
    out.push({ key: d.toISOString().slice(0, 10), label: WEEKDAY[d.getUTCDay()], isToday: i === 0 });
  }
  return out;
}

function StreakRow({
  completedDays,
  streakDays,
  todayDone,
}: {
  completedDays: Set<string>;
  streakDays: number;
  todayDone: boolean;
}) {
  const days = lastNDaysUTC(7);
  return (
    <div style={{ padding: "0 18px 12px" }}>
      <div className="row between" style={{ alignItems: "baseline", marginBottom: 6 }}>
        <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
          last 7 days
        </div>
        <div className="small bold" style={{ color: "var(--accent)" }}>
          {streakDays > 0 ? `🔥 ${streakDays} day${streakDays === 1 ? "" : "s"} in a row` : "start your streak"}
        </div>
      </div>
      <div className="row" style={{ gap: 6 }}>
        {days.map((d) => {
          const done = completedDays.has(d.key) || (d.isToday && todayDone);
          return (
            <div key={d.key} className="col" style={{ alignItems: "center", gap: 3, flex: 1 }}>
              <div className="tiny muted">{d.label}</div>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                  fontFamily: "Caveat",
                  fontWeight: 700,
                  background: done ? "var(--accent)" : "var(--paper)",
                  color: done ? "white" : "var(--ink-faint)",
                  border: `2px solid ${d.isToday || done ? "var(--accent)" : "var(--ink-faint)"}`,
                }}
              >
                {done ? "✓" : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── celebration ──────────────────────────────────────────
const CONFETTI = ["🎉", "✨", "🎊", "⭐", "🔥"];

function CelebrationOverlay({
  fromStreak,
  toStreak,
  onClose,
}: {
  fromStreak: number;
  toStreak: number;
  onClose: () => void;
}) {
  const [count, setCount] = useState(fromStreak);
  const [note, setNote] = useState("");
  const [noteState, setNoteState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [noteError, setNoteError] = useState<string | null>(null);

  useEffect(() => {
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(fromStreak + (toStreak - fromStreak) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    // No auto-dismiss — the note prompt is interactive.
    return () => cancelAnimationFrame(raf);
  }, [fromStreak, toStreak]);

  async function sendNote() {
    const text = note.trim();
    if (!text) return;
    setNoteState("sending");
    setNoteError(null);
    try {
      await apiFetch("/api/me/practice-note", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setNoteState("sent");
    } catch (e: any) {
      setNoteState("error");
      setNoteError(e?.body?.error ?? "Couldn't send your note.");
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.35)",
      }}
    >
      <style>{`
        @keyframes cf-fall { 0%{ transform: translateY(-12vh) rotate(0); opacity:1 } 100%{ transform: translateY(112vh) rotate(540deg); opacity:0.85 } }
        @keyframes pop-in { 0%{ transform: scale(0.6) rotate(-3deg); opacity:0 } 60%{ transform: scale(1.08) rotate(1deg); opacity:1 } 100%{ transform: scale(1) rotate(0) } }
        @keyframes flame-pulse { 0%,100%{ transform: scale(1) } 50%{ transform: scale(1.18) } }
      `}</style>
      {Array.from({ length: 28 }, (_, i) => {
        const left = (i * 37) % 100;
        const delay = (i % 10) * 0.18;
        const dur = 2.6 + (i % 5) * 0.5;
        return (
          <span
            key={i}
            style={{
              position: "fixed",
              top: 0,
              left: `${left}%`,
              fontSize: 18 + (i % 4) * 6,
              animation: `cf-fall ${dur}s linear ${delay}s infinite`,
              pointerEvents: "none",
            }}
          >
            {CONFETTI[i % CONFETTI.length]}
          </span>
        );
      })}
      <div
        className="box thick accent"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--paper)",
          textAlign: "center",
          padding: "26px 30px",
          maxWidth: 340,
          animation: "pop-in 0.5s ease-out both",
          boxShadow: "4px 5px 0 var(--ink)",
        }}
      >
        <div style={{ fontSize: 40, lineHeight: 1 }}>🎺</div>
        <div className="wf-scrawl bold" style={{ fontSize: 34, lineHeight: 1.05, marginTop: 4 }}>
          nailed it
        </div>
        <div className="small muted" style={{ marginBottom: 14 }}>
          you finished today's practice
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <span style={{ fontSize: 44, display: "inline-block", animation: "flame-pulse 1.1s ease-in-out infinite" }}>
            🔥
          </span>
          <span className="wf-scrawl bold" style={{ fontSize: 56, lineHeight: 1, color: "var(--accent)" }}>
            {count}
          </span>
        </div>
        <div className="small bold" style={{ color: "var(--accent)" }}>
          day{count === 1 ? "" : "s"} in a row
        </div>

        {/* Quick note to self / coach */}
        <div className="hr-hand" style={{ margin: "16px 0 12px" }} />
        {noteState === "sent" ? (
          <div className="small" style={{ color: "var(--accent)", marginBottom: 12 }}>
            ✓ note sent to your coach
          </div>
        ) : (
          <>
            <div className="small bold" style={{ textAlign: "left", marginBottom: 6 }}>
              Leave a note about today
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="How did it go? Anything for your coach…"
              rows={3}
              maxLength={2000}
              style={{
                width: "100%",
                fontFamily: "var(--hand)",
                fontSize: 14,
                padding: "8px 10px",
                border: "1.5px solid var(--ink-faint)",
                borderRadius: 8,
                background: "var(--paper)",
                color: "var(--ink)",
                outline: "none",
                resize: "vertical",
              }}
            />
            {noteError && (
              <div className="tiny" style={{ color: "var(--accent)", marginTop: 4, textAlign: "left" }}>
                {noteError}
              </div>
            )}
            <button
              className="btn small primary"
              onClick={sendNote}
              disabled={noteState === "sending" || !note.trim()}
              style={{ marginTop: 8 }}
            >
              {noteState === "sending" ? "sending…" : "send note to coach"}
            </button>
          </>
        )}

        <div>
          <button className="btn ghost" onClick={onClose} style={{ marginTop: 14 }}>
            {noteState === "sent" ? "done →" : "skip · keep it going →"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PracticePathPage() {
  const { detail, loading } = useMyStudentDetail();

  // Local, mutable copies so a check-off updates the path + streak instantly.
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [streak, setStreak] = useState<StudentDetailPublic["streak"]>(null);
  const [recentDays, setRecentDays] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<{ from: number; to: number } | null>(null);
  // Mobile (single-column) uses "peek-behind": the detail floats over the
  // dimmed path only once a stop is tapped. Matches the md breakpoint where
  // the two-pane layout kicks in.
  const isMobile = useIsMobile(768);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  // The student's own items (authoritative, from the server) — the editable
  // segment. Everything else on the path is the coach's, which stays locked
  // (including a Chord Flash Cards stop the coach assigned).
  const [customRoutine, setCustomRoutine] = useState<RoutineItem[]>([]);
  const customIds = new Set(customRoutine.map((i) => i.id));
  const lockedCoachItems = items.filter((i) => !customIds.has(i.id));

  // Merge a freshly-saved student list back into the path: coach items first,
  // then the student's own items — preserving today's completion state.
  function applyCustom(saved: RoutineItem[]) {
    setCustomRoutine(saved);
    setItems((cur) => {
      const doneById = new Map(cur.map((i) => [i.id, i.completedToday]));
      const coach = cur.filter((i) => !customIds.has(i.id));
      const custom = saved.map((it) => ({ ...it, completedToday: doneById.get(it.id) ?? false }));
      return [...coach, ...custom];
    });
  }

  // Tapping a stop selects it; on mobile that floats its detail over the path.
  function selectStop(id: string) {
    setSelectedId(id);
    if (isMobile) setDetailOpen(true);
  }

  useEffect(() => {
    if (!detail) return;
    setItems(detail.routine.items);
    setCustomRoutine(detail.customRoutine ?? []);
    setStreak(detail.streak);
    setRecentDays(detail.recentPracticeDays ?? []);
    setSelectedId((cur) => cur ?? detail.routine.items[0]?.id ?? null);
  }, [detail]);

  const selectedItem = items.find((it) => it.id === selectedId) ?? items[0] ?? null;
  const selectedIndex = selectedItem ? items.findIndex((it) => it.id === selectedItem.id) : -1;
  const doneCount = items.filter((it) => it.completedToday).length;
  const allDone = items.length > 0 && doneCount === items.length;

  // Step between exercises (clamped at the ends). Wired to the detail
  // prev/next buttons and the mobile swipe gesture.
  const canPrev = selectedIndex > 0;
  const canNext = selectedIndex >= 0 && selectedIndex < items.length - 1;
  function navigate(delta: number) {
    const target = selectedIndex + delta;
    if (target < 0 || target >= items.length) return;
    setSelectedId(items[target].id);
  }
  const touchStartX = useRef<number | null>(null);

  async function toggleComplete(item: RoutineItem) {
    const next = !item.completedToday;
    const prevStreak = streak?.currentDays ?? 0;
    const idx = items.findIndex((it) => it.id === item.id);
    // Will every exercise be done once this toggle applies?
    const allDoneAfter = items.every((it) => (it.id === item.id ? next : it.completedToday));
    setBusyId(item.id);
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, completedToday: next } : it)));
    try {
      const res = await apiFetch<{
        data: { completedToday: boolean; streak: StudentDetailPublic["streak"] };
      }>("/api/me/routine/complete", {
        method: "POST",
        body: JSON.stringify({ routineItemId: item.id, completed: next }),
      });
      if (res.data.streak) setStreak(res.data.streak);
      // On marking done: celebrate once everything's complete, otherwise
      // advance to the next stop.
      if (next) {
        if (allDoneAfter) {
          // Close the mobile peek-behind so the celebration isn't left
          // covering a lingering overlay once dismissed.
          setDetailOpen(false);
          setCelebrate({ from: prevStreak, to: res.data.streak?.currentDays ?? prevStreak });
        } else if (idx >= 0 && idx < items.length - 1) {
          setSelectedId(items[idx + 1].id);
        }
      }
    } catch {
      // revert on failure
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, completedToday: !next } : it)));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <STFrame side="practice">
      <div className="dt-main-body" style={{ height: "100%", padding: 0 }}>
        <div className="flex flex-col md:flex-row h-full" style={{ minHeight: 0 }}>
          {/* Left — the path */}
          <div
            className="md:w-[360px] md:flex-none md:border-r"
            style={{ overflowY: "auto", borderColor: "var(--ink-faint)" }}
          >
            {/* Header (title + progress + avatar) is desktop-only; on mobile
                it's redundant with the topbar avatar and the streak row. */}
            {!isMobile && (
              <div className="wf-header" style={{ position: "sticky", top: 0, background: "var(--paper)", zIndex: 1 }}>
                <div>
                  <h2 className="wf-title">
                    {allDone ? "All done!" : `${dayLabelToday()}'s path`}
                  </h2>
                  <div className="wf-subtitle">
                    {items.length > 0
                      ? `${doneCount} of ${items.length} done today`
                      : "no routine yet"}
                  </div>
                </div>
                <div className="row gap-2">
                  {streak && streak.currentDays > 0 && (
                    <span className="chip accent" style={{ background: "var(--accent)", color: "white", borderColor: "var(--accent)" }}>
                      🔥 {streak.currentDays}
                    </span>
                  )}
                </div>
              </div>
            )}

            {items.length > 0 && (
              <StreakRow
                completedDays={new Set(recentDays)}
                streakDays={streak?.currentDays ?? 0}
                todayDone={allDone}
              />
            )}

            {items.length > 0 && (
              <div style={{ padding: "0 18px 8px" }}>
                <div className="progress">
                  <i style={{ width: `${(doneCount / items.length) * 100}%` }} />
                </div>
              </div>
            )}

            <div style={{ padding: "8px 8px 12px" }}>
              {loading && items.length === 0 ? (
                <div className="small muted" style={{ padding: 18 }}>Loading…</div>
              ) : items.length === 0 ? (
                <div className="box dashed small muted" style={{ margin: 12 }}>
                  No routine yet — your coach builds this after your next lesson, or add your own below.
                </div>
              ) : (
                <PathSvg items={items} selectedId={selectedItem?.id ?? null} onSelect={selectStop} />
              )}
            </div>

            {/* Edit your routine — reorder, remove, retime, add from the library */}
            <div style={{ padding: "0 12px 24px" }}>
              <button className="btn small" style={{ width: "100%", borderStyle: "dashed" }} onClick={() => setEditorOpen(true)}>
                <Icon name="note" size={14} /> Edit my routine
              </button>
            </div>
          </div>

          {/* Right — selected exercise detail (two-pane on desktop only;
              mobile uses the peek-behind overlay below). */}
          <div className="hidden md:block flex-1" style={{ overflowY: "auto", padding: 24, minWidth: 0 }}>
            {selectedItem ? (
              <ExerciseDetail
                item={selectedItem}
                index={selectedIndex}
                total={items.length}
                busy={busyId === selectedItem.id}
                onToggle={() => toggleComplete(selectedItem)}
                onPrev={canPrev ? () => navigate(-1) : undefined}
                onNext={canNext ? () => navigate(1) : undefined}
              />
            ) : (
              <div className="small muted" style={{ padding: 8 }}>
                {loading ? "Loading…" : "Pick a stop on your path to see the details."}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile peek-behind — detail floats over the dimmed path. */}
      {isMobile && detailOpen && selectedItem && (
        <div
          onClick={() => setDetailOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 30,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 16px",
            background: "rgba(240,238,233,0.66)",
            backdropFilter: "blur(1.5px)",
            WebkitBackdropFilter: "blur(1.5px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => {
              touchStartX.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              if (touchStartX.current == null) return;
              const dx = e.changedTouches[0].clientX - touchStartX.current;
              touchStartX.current = null;
              if (Math.abs(dx) > 40) navigate(dx < 0 ? 1 : -1);
            }}
            className="box thick"
            style={{
              width: "92%",
              maxWidth: 360,
              maxHeight: "78vh",
              overflowY: "auto",
              background: "var(--paper)",
              padding: 16,
              boxShadow: "3px 3px 0 var(--ink)",
              transform: "rotate(-0.5deg)",
            }}
          >
            <ExerciseDetail
              item={selectedItem}
              index={selectedIndex}
              total={items.length}
              busy={busyId === selectedItem.id}
              onToggle={() => toggleComplete(selectedItem)}
              onPrev={canPrev ? () => navigate(-1) : undefined}
              onNext={canNext ? () => navigate(1) : undefined}
            />
          </div>
          <div className="tiny muted" style={{ marginTop: 12, textAlign: "center" }}>
            ‹ swipe › · tap the dimmed path to step back out
          </div>
        </div>
      )}

      {celebrate && (
        <CelebrationOverlay
          fromStreak={celebrate.from}
          toStreak={celebrate.to}
          onClose={() => setCelebrate(null)}
        />
      )}

      {editorOpen && (
        <RoutineEditor
          coachItems={lockedCoachItems}
          initial={customRoutine}
          onClose={() => setEditorOpen(false)}
          onSaved={applyCustom}
        />
      )}
    </STFrame>
  );
}


function dayLabelToday(): string {
  return new Date().toLocaleDateString([], { weekday: "long" });
}
