import { useEffect, useState } from "react";
import type { LibraryItemKind, RoutineItem, StudentDetailPublic } from "@sunbird/shared";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { STFrame } from "../components/STFrame";
import { Icon } from "../components/Icon";
import { AudioPlayer, MidiPlayer } from "../components/WaveformPlayer";
import { useMyStudentDetail } from "../hooks/useCoachData";

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
}: {
  item: RoutineItem;
  index: number;
  total: number;
  busy: boolean;
  onToggle: () => void;
}) {
  const done = !!item.completedToday;
  const hasMidi = !!(item.hasMidi && item.midiUrl);
  return (
    <div className="wf">
      <div className="row between" style={{ alignItems: "baseline", marginBottom: 6 }}>
        <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
          Stop {index + 1} of {total} · {KIND_LABEL[item.kind]}
        </div>
        {done && <span className="chip accent tiny">done today</span>}
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

export function PracticePathPage() {
  const { user } = useAuth();
  const { detail, loading } = useMyStudentDetail();

  // Local, mutable copies so a check-off updates the path + streak instantly.
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [streak, setStreak] = useState<StudentDetailPublic["streak"]>(null);
  const [recentDays, setRecentDays] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!detail) return;
    setItems(detail.routine.items);
    setStreak(detail.streak);
    setRecentDays(detail.recentPracticeDays ?? []);
    setSelectedId((cur) => cur ?? detail.routine.items[0]?.id ?? null);
  }, [detail]);

  const selectedItem = items.find((it) => it.id === selectedId) ?? items[0] ?? null;
  const selectedIndex = selectedItem ? items.findIndex((it) => it.id === selectedItem.id) : -1;
  const doneCount = items.filter((it) => it.completedToday).length;
  const allDone = items.length > 0 && doneCount === items.length;
  const initial = user?.name?.trim().charAt(0).toUpperCase() ?? "?";

  async function toggleComplete(item: RoutineItem) {
    const next = !item.completedToday;
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
                <div className="wf-avatar">{initial}</div>
              </div>
            </div>

            {items.length > 0 && (
              <StreakRow
                completedDays={new Set(recentDays)}
                streakDays={streak?.currentDays ?? 0}
                todayDone={doneCount > 0}
              />
            )}

            {items.length > 0 && (
              <div style={{ padding: "0 18px 8px" }}>
                <div className="progress">
                  <i style={{ width: `${(doneCount / items.length) * 100}%` }} />
                </div>
              </div>
            )}

            <div style={{ padding: "8px 8px 24px" }}>
              {loading && items.length === 0 ? (
                <div className="small muted" style={{ padding: 18 }}>Loading…</div>
              ) : items.length === 0 ? (
                <div className="box dashed small muted" style={{ margin: 12 }}>
                  No routine set yet — your coach builds this after your next lesson.
                </div>
              ) : (
                <PathSvg items={items} selectedId={selectedItem?.id ?? null} onSelect={setSelectedId} />
              )}
            </div>
          </div>

          {/* Right — selected exercise detail */}
          <div className="flex-1" style={{ overflowY: "auto", padding: 24, minWidth: 0 }}>
            {selectedItem ? (
              <ExerciseDetail
                item={selectedItem}
                index={selectedIndex}
                total={items.length}
                busy={busyId === selectedItem.id}
                onToggle={() => toggleComplete(selectedItem)}
              />
            ) : (
              <div className="small muted" style={{ padding: 8 }}>
                {loading ? "Loading…" : "Pick a stop on your path to see the details."}
              </div>
            )}
          </div>
        </div>
      </div>
    </STFrame>
  );
}

function dayLabelToday(): string {
  return new Date().toLocaleDateString([], { weekday: "long" });
}
