import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ChordCardPublic,
  ChordCardStatus,
  ChordDeckOverviewPublic,
  ChordGrade,
  ChordLevelDetailPublic,
  ChordSessionPublic,
  ChordSettingsPublic,
} from "@sunbird/shared";
import { chordsApi } from "@/lib/api";
import { STFrame } from "../components/STFrame";
import { Icon } from "../components/Icon";
import { ChordChart, MasteryRing } from "../components/ChordChart";
import { HearItButton } from "../components/HearItButton";
import { useChordDetector } from "../hooks/useChordDetector";

// Parse a note name to its pitch class (0–11). Handles any number of sharps
// or flats, including the double accidentals the library uses (e.g. "Bbb").
const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteToPc(name: string): number {
  let pc = LETTER_PC[name[0]] ?? 0;
  for (const ch of name.slice(1)) pc += ch === "#" ? 1 : ch === "b" ? -1 : 0;
  return ((pc % 12) + 12) % 12;
}

// Bright ascending C-major arpeggio + a final octave — a "level-up" chime for
// the all-tones-hit celebration.
function playSuccessChime() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 · E5 · G5 · C6
    notes.forEach((freq, i) => {
      const t = now + i * 0.075;
      const last = i === notes.length - 1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const peak = last ? 0.22 : 0.16;
      const tail = last ? 0.6 : 0.4;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(peak, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + tail);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + tail + 0.05);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1100);
  } catch {
    /* audio unavailable — the visual burst still plays */
  }
}

// ── view state ──
type View =
  | { name: "decks" }
  | { name: "level"; levelId: number }
  | { name: "session"; source: "due" | number }
  | { name: "settings" };

export function ChordFlashCardsPage() {
  const [view, setView] = useState<View>({ name: "decks" });
  const [settings, setSettings] = useState<ChordSettingsPublic | null>(null);

  // Settings are loaded once and shared: the session needs micCheck +
  // handedness, and the settings screen edits them.
  useEffect(() => {
    let alive = true;
    chordsApi
      .getSettings()
      .then((s) => alive && setSettings(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <STFrame side="practice">
      {/* Full-bleed: fills the width of the practice content area on desktop and
          shrinks to the viewport on mobile (no phone frame). */}
      <div className="dt-main-body" style={{ height: "100%", padding: 0, minHeight: 0 }}>
        <div
          className="wf"
          style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}
        >
          {view.name === "decks" && (
            <DeckPicker
              onOpenLevel={(levelId) => setView({ name: "level", levelId })}
              onStartDue={() => setView({ name: "session", source: "due" })}
              onStartLevel={(levelId) => setView({ name: "session", source: levelId })}
              onOpenSettings={() => setView({ name: "settings" })}
            />
          )}
          {view.name === "level" && (
            <LevelDetail
              levelId={view.levelId}
              onBack={() => setView({ name: "decks" })}
              onStart={() => setView({ name: "session", source: view.levelId })}
            />
          )}
          {view.name === "session" && (
            <Session
              source={view.source}
              settings={settings}
              onExit={() => setView({ name: "decks" })}
            />
          )}
          {view.name === "settings" && (
            <Settings
              settings={settings}
              onChange={setSettings}
              onBack={() => setView({ name: "decks" })}
            />
          )}
        </div>
      </div>
    </STFrame>
  );
}

// ── screen 1 · deck picker ───────────────────────────────
function DeckPicker({
  onOpenLevel,
  onStartDue,
  onStartLevel,
  onOpenSettings,
}: {
  onOpenLevel: (levelId: number) => void;
  onStartDue: () => void;
  onStartLevel: (levelId: number) => void;
  onOpenSettings: () => void;
}) {
  const [data, setData] = useState<ChordDeckOverviewPublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    chordsApi
      .decks()
      .then((d) => alive && setData(d))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const dueCount = data?.dueCount ?? 0;
  // When nothing is scheduled, the hero starts the first level with cards.
  const firstOpenLevel = data?.levels.find((l) => !l.locked && l.dueCount > 0)?.id ?? 1;

  return (
    <>
      <div className="wf-header">
        <h2 className="wf-title" style={{ fontSize: 22 }}>Chord Flash Cards</h2>
        <button className="btn icon" aria-label="Settings" onClick={onOpenSettings}>
          ⚙
        </button>
      </div>

      <div className="wf-body" style={{ overflowY: "auto", padding: "0 18px 20px" }}>
        {/* Due for review — the default action */}
        <button
          className="box accent"
          onClick={() => (dueCount > 0 ? onStartDue() : onStartLevel(firstOpenLevel))}
          style={{
            width: "100%",
            textAlign: "left",
            display: "flex",
            alignItems: "center",
            gap: 14,
            background: "var(--accent-soft)",
            borderWidth: 2,
            padding: 16,
            cursor: "pointer",
          }}
        >
          <span
            style={{
              flex: "none",
              minWidth: 46,
              height: 46,
              padding: "0 10px",
              borderRadius: 14,
              background: "var(--accent)",
              color: "white",
              fontSize: 22,
              fontWeight: 800,
              display: "grid",
              placeItems: "center",
            }}
          >
            {dueCount}
          </span>
          <span style={{ flex: 1 }}>
            <b style={{ fontSize: 18 }}>{dueCount > 0 ? "Due for review" : "Start learning"}</b>
            <div className="small" style={{ color: "var(--accent)", marginTop: 2 }}>
              {dueCount > 0 ? "Weak & scheduled cards · mixed levels" : "Fresh cards across your levels"}
            </div>
          </span>
          <span
            style={{
              flex: "none",
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "var(--paper)",
              border: "2px solid var(--accent)",
              color: "var(--accent)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Icon name="play" size={15} />
          </span>
        </button>

        <div className="small muted" style={{ textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700, margin: "18px 2px 8px" }}>
          Levels
        </div>

        {loading && !data ? (
          <div className="small muted" style={{ padding: 8 }}>Loading…</div>
        ) : (
          <div className="col" style={{ gap: 9 }}>
            {data?.levels.map((l) => (
              <button
                key={l.id}
                className="box"
                disabled={l.locked}
                onClick={() => !l.locked && onOpenLevel(l.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 13,
                  padding: "11px 13px",
                  textAlign: "left",
                  width: "100%",
                  opacity: l.locked ? 0.55 : 1,
                  cursor: l.locked ? "default" : "pointer",
                }}
              >
                <span
                  style={{
                    flex: "none",
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: "var(--paper-2)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 800,
                    fontSize: 15,
                    color: "var(--ink-soft)",
                  }}
                >
                  {l.locked ? "🔒" : l.id}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ fontSize: 15, display: "block", lineHeight: 1.15 }}>{l.name}</b>
                  <span
                    className="tiny muted"
                    style={{ display: "block", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {l.desc}
                  </span>
                </span>
                {l.locked ? (
                  <span className="chip">Locked</span>
                ) : (
                  <MasteryRing pct={l.masteryPct} size={36} />
                )}
              </button>
            ))}
          </div>
        )}

        <div
          className="box dashed"
          style={{ marginTop: 12, padding: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--ink-soft)", fontWeight: 600, fontSize: 14 }}
          title="Custom decks are coming soon"
        >
          ＋ Custom decks <span className="tiny muted">· soon</span>
        </div>
      </div>
    </>
  );
}

// ── status glyphs shared by level detail + session ──
const STATUS_META: Record<ChordCardStatus, { glyph: string; label: string }> = {
  known: { glyph: "✓", label: "Known" },
  learning: { glyph: "~", label: "Learning" },
  new: { glyph: "+", label: "New" },
};

// ── screen 4 · level detail ──────────────────────────────
function LevelDetail({
  levelId,
  onBack,
  onStart,
}: {
  levelId: number;
  onBack: () => void;
  onStart: () => void;
}) {
  const [data, setData] = useState<ChordLevelDetailPublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    chordsApi
      .level(levelId)
      .then((d) => alive && setData(d))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [levelId]);

  return (
    <>
      <div className="wf-header">
        <button className="btn icon" aria-label="Back" onClick={onBack}>‹</button>
        <div className="small bold" style={{ flex: 1, textAlign: "center" }}>Level {levelId}</div>
        <span style={{ width: 38 }} />
      </div>

      <div className="wf-body" style={{ overflowY: "auto", padding: "4px 18px 20px" }}>
        {loading && !data ? (
          <div className="small muted" style={{ padding: 8 }}>Loading…</div>
        ) : data ? (
          <>
            <h2 className="wf-title" style={{ fontSize: 24 }}>{data.name}</h2>
            <div className="small muted" style={{ marginTop: 6, lineHeight: 1.45 }}>{data.desc}</div>

            <div className="row" style={{ margin: "14px 0 4px", gap: 10 }}>
              <span className="tiny muted" style={{ fontWeight: 700 }}>Mastery</span>
              <div className="progress" style={{ flex: 1 }}>
                <i style={{ width: `${data.masteryPct}%` }} />
              </div>
              <span className="small bold">{data.masteryPct}%</span>
            </div>

            <div className="col" style={{ gap: 7, marginTop: 10 }}>
              {data.chords.map((ch) => {
                const meta = STATUS_META[ch.status];
                const bg =
                  ch.status === "known" ? "var(--ink)" : ch.status === "learning" ? "var(--paper)" : "var(--paper-2)";
                const color = ch.status === "known" ? "white" : ch.status === "learning" ? "var(--accent)" : "var(--ink-faint)";
                const border = ch.status === "learning" ? "2px solid var(--accent)" : ch.status === "new" ? "1.5px solid var(--ink-faint)" : "none";
                return (
                  <div key={ch.id} className="box" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px" }}>
                    <span
                      style={{
                        flex: "none",
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 12,
                        fontWeight: 800,
                        background: bg,
                        color,
                        border,
                      }}
                    >
                      {meta.glyph}
                    </span>
                    <span style={{ flex: 1, fontWeight: 700, fontSize: 15 }}>{ch.name}</span>
                    <span className="tiny muted" style={{ fontWeight: 600 }}>{meta.label}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="small muted" style={{ padding: 8 }}>Couldn't load this level.</div>
        )}
      </div>

      <div style={{ flex: "none", padding: 16, borderTop: "1.5px dashed var(--ink-faint)" }}>
        <button className="btn accent big" style={{ width: "100%" }} onClick={onStart}>
          {data && data.dueCount > 0 ? `Continue · ${data.dueCount} due` : "Review level"}
        </button>
      </div>
    </>
  );
}

// ── screens 2 + 3 · the review session ───────────────────
const GRADES: { grade: ChordGrade; label: string; sub: string; miss?: boolean }[] = [
  { grade: "again", label: "Missed", sub: "< 1 day", miss: true },
  { grade: "hard", label: "Hard", sub: "soon" },
  { grade: "good", label: "Got it", sub: "days" },
  { grade: "easy", label: "Easy", sub: "weeks" },
];

function Session({
  source,
  settings,
  onExit,
}: {
  source: "due" | number;
  settings: ChordSettingsPublic | null;
  onExit: () => void;
}) {
  const [data, setData] = useState<ChordSessionPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [graded, setGraded] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    chordsApi
      .session(source)
      .then((d) => alive && setData(d))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [source]);

  const cards = data?.cards ?? [];
  const card: ChordCardPublic | undefined = cards[index];
  const mirror = settings?.handedness === "left";
  const micOn = settings?.micCheck !== false;

  const grade = useCallback(
    (g: ChordGrade) => {
      if (!card) return;
      chordsApi.grade(card.id, g).catch(() => {});
      setGraded((n) => n + 1);
      if (index + 1 >= cards.length) {
        setDone(true);
      } else {
        setIndex((i) => i + 1);
        setFlipped(false);
      }
    },
    [card, index, cards.length],
  );

  if (loading) {
    return <SessionShell onExit={onExit} progress={0} count="…"><div className="small muted" style={{ padding: 24, textAlign: "center" }}>Loading cards…</div></SessionShell>;
  }

  if (done || cards.length === 0) {
    return (
      <SessionShell onExit={onExit} progress={1} count={cards.length ? `${cards.length} / ${cards.length}` : "0"}>
        <div className="col" style={{ alignItems: "center", justifyContent: "center", flex: 1, gap: 10, padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>{cards.length ? "🎸" : "✅"}</div>
          <h2 className="wf-title" style={{ fontSize: 24 }}>
            {cards.length ? "Session complete" : "Nothing due right now"}
          </h2>
          <div className="small muted">
            {cards.length
              ? `You reviewed ${graded} card${graded === 1 ? "" : "s"}. Weak ones will come back sooner.`
              : "You're all caught up — start a level to learn new chords."}
          </div>
          <button className="btn accent big" style={{ marginTop: 8 }} onClick={onExit}>done →</button>
        </div>
      </SessionShell>
    );
  }

  const progress = cards.length ? (index) / cards.length : 0;

  return (
    <SessionShell onExit={onExit} progress={progress} count={`${index + 1} / ${cards.length}`}>
      {!flipped ? (
        <CardFront key={`front-${card!.id}`} card={card!} micOn={micOn} onReveal={() => setFlipped(true)} />
      ) : (
        <CardBack key={`back-${card!.id}`} card={card!} mirror={mirror} onGrade={grade} />
      )}
    </SessionShell>
  );
}

function SessionShell({
  onExit,
  progress,
  count,
  children,
}: {
  onExit: () => void;
  progress: number;
  count: string;
  children: React.ReactNode;
}) {
  // A flashcard is a focused, card-like experience, so cap + centre it rather
  // than stretching across the full-width practice area (the list screens stay
  // full-width).
  return (
    <div
      style={{ flex: 1, minHeight: 0, width: "100%", maxWidth: 460, margin: "0 auto", display: "flex", flexDirection: "column" }}
    >
      <div className="row" style={{ gap: 12, padding: "8px 16px 4px", flex: "none" }}>
        <button className="btn icon" aria-label="Close session" onClick={onExit}>✕</button>
        <div className="progress" style={{ flex: 1 }}>
          <i style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <span className="small bold muted" style={{ minWidth: 48, textAlign: "center" }}>{count}</span>
      </div>
      <div className="wf-body" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", padding: 0 }}>
        {children}
      </div>
    </div>
  );
}

// ── card FRONT · chord name + live mic note detector ──
function CardFront({
  card,
  micOn,
  onReveal,
}: {
  card: ChordCardPublic;
  micOn: boolean;
  onReveal: () => void;
}) {
  const [hintTier, setHintTier] = useState(0);
  const total = card.tones.length;

  // Target pitch classes for this card (stable per card).
  const targets = useMemo(
    () => card.tones.map((t) => noteToPc(t.note)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card.id],
  );

  // Real detection off the microphone. It only lights a tone once that note is
  // actually sounding — nothing reveals on its own. This is a formative aid,
  // never a grade (the student self-grades on the back).
  const { status, level, detected } = useChordDetector(targets, micOn, card.id);

  // When the mic isn't available, let the student tap a tone to reveal it.
  const [manual, setManual] = useState<Set<number>>(new Set());
  const micActive = status === "listening" || status === "requesting";
  const reveal = card.tones.map((_, i) => detected[i] || manual.has(i));
  const onCount = reveal.filter(Boolean).length;
  const tappable = !micActive; // don't let taps give the answer away while listening

  // When every tone is hit: celebrate, then auto-flip to the reveal. Guarded by
  // a ref so it fires exactly once per card; onReveal is read through a ref so a
  // fresh onReveal identity each render can't cancel the pending timer.
  const allHit = total > 0 && onCount >= total;
  const [celebrating, setCelebrating] = useState(false);
  const firedRef = useRef(false);
  const revealRef = useRef(onReveal);
  revealRef.current = onReveal;
  useEffect(() => {
    if (!allHit || firedRef.current) return;
    firedRef.current = true;
    setCelebrating(true);
    playSuccessChime();
    const t = setTimeout(() => revealRef.current(), 1250);
    return () => clearTimeout(t);
  }, [allHit]);

  const statusLabel =
    status === "requesting"
      ? "Enabling mic…"
      : status === "listening"
        ? onCount >= total
          ? "All tones detected"
          : "Listening…"
        : status === "denied"
          ? "Mic blocked"
          : status === "unsupported"
            ? "Mic not supported"
            : status === "error"
              ? "Mic unavailable"
              : "Ready";

  const caption =
    status === "listening"
      ? "Play the notes one at a time — each lights up as it's detected"
      : status === "denied"
        ? "Allow mic access to auto-detect, or tap a tone to reveal"
        : status === "requesting"
          ? "Waiting for microphone permission…"
          : "Tap a tone to reveal it, then check the back";

  const hints = [
    `Root note is ${card.tones[0]?.note ?? "?"}`,
    `${total} tones — a ${card.name.replace(/[A-G]#?b?/, "").trim() || "major"} shape`,
    `Recommended: ${card.voicings.find((v) => v.recommended)?.label ?? card.voicings[0]?.label ?? "open"}`,
    "Full answer is on the back — tap Reveal",
  ];

  return (
    <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: 20 }}>
      {celebrating && <SuccessBurst name={card.name} />}
      <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>
        🂠 Front
      </div>
      <div style={{ fontWeight: 800, letterSpacing: -1, fontSize: 60, marginTop: 22 }}>{card.name}</div>

      {micOn ? (
        <div className="box filled" style={{ width: "100%", marginTop: "auto", padding: "12px 12px 13px" }}>
          <div className="row between" style={{ marginBottom: 11 }}>
            <span className="row" style={{ gap: 7, fontWeight: 700, fontSize: 12.5, color: micActive ? "var(--accent)" : "var(--ink-faint)" }}>
              <EqBars level={level} active={status === "listening"} /> {statusLabel}
            </span>
            <span className="tiny muted" style={{ fontWeight: 700 }}>{onCount} / {total} tones</span>
          </div>
          <div className="row" style={{ gap: 8, alignItems: "stretch" }}>
            {card.tones.map((t, i) => {
              const on = reveal[i];
              return (
                <button
                  key={i}
                  onClick={tappable ? () => setManual((m) => new Set(m).add(i)) : undefined}
                  disabled={!tappable || on}
                  style={{
                    position: "relative",
                    flex: 1,
                    minWidth: 0,
                    borderRadius: 13,
                    border: on ? "1.8px solid var(--accent)" : "1.8px dashed var(--ink-faint)",
                    background: on ? "var(--accent)" : "var(--paper)",
                    color: on ? "white" : "var(--ink-faint)",
                    padding: "9px 4px 7px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 3,
                    minHeight: 60,
                    justifyContent: "center",
                    opacity: on ? 1 : 0.75,
                    transition: "all .3s ease",
                    cursor: tappable && !on ? "pointer" : "default",
                    font: "inherit",
                  }}
                >
                  {on && (
                    <span
                      style={{
                        position: "absolute",
                        top: -7,
                        right: -6,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "var(--paper)",
                        border: "2px solid var(--accent)",
                        color: "var(--accent)",
                        fontSize: 10,
                        fontWeight: 800,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      ✓
                    </span>
                  )}
                  <span style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{on ? t.note : "?"}</span>
                  <span className="tiny" style={{ fontWeight: 700, color: on ? "rgba(255,255,255,0.9)" : "var(--ink-faint)", whiteSpace: "nowrap" }}>
                    {t.degree}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="tiny muted" style={{ textAlign: "center", marginTop: 10 }}>
            {caption}
          </div>
        </div>
      ) : (
        <div className="small muted" style={{ marginTop: "auto", textAlign: "center" }}>
          Play {card.name} on your guitar, then reveal.
        </div>
      )}

      <button
        className="col"
        onClick={() => setHintTier((t) => Math.min(4, t + 1))}
        style={{ alignItems: "center", gap: 5, margin: "16px 0 8px", background: "transparent", border: 0, cursor: "pointer" }}
      >
        <span className="small muted" style={{ borderBottom: "1.5px dotted var(--ink-faint)", paddingBottom: 2 }}>
          {hintTier === 0 ? "Need a hint?" : hints[hintTier - 1]}
        </span>
        <span className="row" style={{ gap: 5 }}>
          {[0, 1, 2, 3].map((i) => (
            <i
              key={i}
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: i < hintTier ? "var(--accent)" : "var(--ink-faint)",
                display: "inline-block",
              }}
            />
          ))}
        </span>
      </button>

      <div style={{ flex: "none", width: "100%", paddingTop: 8, borderTop: "1.5px dashed var(--ink-faint)" }}>
        <button className="btn accent big" style={{ width: "100%" }} onClick={onReveal}>Reveal</button>
      </div>
    </div>
  );
}

// Equalizer meter. When `active`, bar heights track the live mic `level` so it
// visibly reacts to playing; otherwise it sits idle and dim.
function EqBars({ level = 0, active = true }: { level?: number; active?: boolean }) {
  const base = [0.55, 1, 0.72, 1.1];
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 16 }}>
      {base.map((b, i) => (
        <i
          key={i}
          style={{
            width: 3,
            height: active ? Math.min(16, Math.max(3, 16 * (0.22 + level * b * 1.3))) : 4,
            background: "var(--accent)",
            borderRadius: 2,
            display: "inline-block",
            transition: "height .08s ease",
            opacity: active ? 1 : 0.4,
          }}
        />
      ))}
    </span>
  );
}

// Shown over the card front the moment every tone is hit, just before the
// auto-reveal flips the card.
function SuccessBurst({ name }: { name: string }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        textAlign: "center",
        background: "color-mix(in srgb, var(--paper) 85%, transparent)",
        backdropFilter: "blur(2px)",
        WebkitBackdropFilter: "blur(2px)",
        animation: "cfc-fade .18s ease-out both",
      }}
    >
      <style>{`
        @keyframes cfc-fade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cfc-pop { 0% { transform: scale(.4); opacity: 0 } 55% { transform: scale(1.15); opacity: 1 } 100% { transform: scale(1) } }
        @keyframes cfc-ring { 0% { transform: scale(.5); opacity: .55 } 100% { transform: scale(2.1); opacity: 0 } }
        @keyframes cfc-spark { 0% { transform: translateY(6px) scale(.5); opacity: 0 } 30% { opacity: 1 } 100% { transform: translateY(-40px) scale(1); opacity: 0 } }
      `}</style>
      <div style={{ position: "relative", width: 84, height: 84, display: "grid", placeItems: "center" }}>
        <span style={{ position: "absolute", inset: 6, borderRadius: "50%", border: "2px solid var(--accent)", animation: "cfc-ring .9s ease-out .05s infinite" }} />
        <span style={{ position: "absolute", inset: 6, borderRadius: "50%", border: "2px solid var(--accent)", animation: "cfc-ring .9s ease-out .35s infinite" }} />
        {["✨", "🎉", "⭐"].map((s, i) => (
          <span key={i} style={{ position: "absolute", top: 8, fontSize: 15, left: `${18 + i * 26}%`, animation: `cfc-spark 1s ease-out ${0.1 + i * 0.12}s infinite` }}>
            {s}
          </span>
        ))}
        <span
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "var(--accent)",
            color: "white",
            display: "grid",
            placeItems: "center",
            fontSize: 38,
            fontWeight: 800,
            boxShadow: "0 6px 18px -6px var(--accent)",
            animation: "cfc-pop .5s cubic-bezier(.2,1.3,.4,1) both",
          }}
        >
          ✓
        </span>
      </div>
      <div className="wf-scrawl bold" style={{ fontSize: 34, lineHeight: 1.05, color: "var(--accent)", marginTop: 6 }}>
        Nailed it!
      </div>
      <div className="small muted">all tones detected · {name}</div>
    </div>
  );
}

// ── card BACK · chart + alternate voicings + self-grade ──
function CardBack({
  card,
  mirror,
  onGrade,
}: {
  card: ChordCardPublic;
  mirror: boolean;
  onGrade: (g: ChordGrade) => void;
}) {
  // All voicings for this chord, recommended one first; the big chart is a
  // swipeable carousel across them.
  const voicings = useMemo(() => {
    const vs = card.voicings;
    const rec = vs.findIndex((v) => v.recommended);
    return rec > 0 ? [vs[rec], ...vs.filter((_, i) => i !== rec)] : vs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);
  const count = voicings.length;
  const [vIndex, setVIndex] = useState(0);
  const touchX = useRef<number | null>(null);
  const idx = Math.min(vIndex, count - 1);
  const current = voicings[idx];
  const step = (d: number) => setVIndex((i) => Math.max(0, Math.min(count - 1, Math.min(i, count - 1) + d)));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 20 }}>
      <div className="col" style={{ alignItems: "center", gap: 6 }}>
        <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>
          🂡 Back · flipped
        </div>
        <div style={{ fontWeight: 800, letterSpacing: -0.5, fontSize: 30 }}>{card.name}</div>
      </div>

      {current && (
        <div
          className="box filled"
          style={{ position: "relative", marginTop: 14, padding: "16px 14px 10px", display: "flex", flexDirection: "column", alignItems: "center" }}
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
          }}
        >
          <span
            className="chip accent"
            style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}
          >
            {current.recommended ? "★ recommended for your level" : `voicing ${idx + 1} of ${count}`}
          </span>

          {count > 1 && (
            <button
              className="btn icon"
              aria-label="Previous voicing"
              onClick={() => step(-1)}
              disabled={idx === 0}
              style={{ position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, opacity: idx === 0 ? 0.3 : 1 }}
            >
              ‹
            </button>
          )}
          <ChordChart shape={current.shape} size="lg" mirror={mirror} />
          {count > 1 && (
            <button
              className="btn icon"
              aria-label="Next voicing"
              onClick={() => step(1)}
              disabled={idx === count - 1}
              style={{ position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, opacity: idx === count - 1 ? 0.3 : 1 }}
            >
              ›
            </button>
          )}

          {current.label && (
            <div className="tiny bold" style={{ marginTop: 4, color: "var(--ink-soft)" }}>{current.label}</div>
          )}
          <HearItButton key={current.id} fingering={current.shape.fingering} style={{ marginTop: 10, borderRadius: 999 }} />

          {count > 1 && (
            <div className="row" style={{ gap: 6, justifyContent: "center", marginTop: 10 }}>
              {voicings.map((_, i) => (
                <i
                  key={i}
                  onClick={() => setVIndex(i)}
                  style={{
                    width: i === idx ? 16 : 6,
                    height: 6,
                    borderRadius: 999,
                    background: i === idx ? "var(--accent)" : "var(--ink-faint)",
                    cursor: "pointer",
                    transition: "all .2s",
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {count > 1 && (
        <>
          <div className="row between" style={{ margin: "16px 0 8px" }}>
            <span className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>
              All voicings · {count}
            </span>
            <span className="tiny" style={{ color: "var(--accent)", fontFamily: "var(--scrawl)", fontSize: 14 }}>swipe or tap →</span>
          </div>
          <div className="row hide-scroll" style={{ gap: 11, overflowX: "auto", paddingBottom: 4 }}>
            {voicings.map((v, i) => (
              <button
                key={v.id}
                onClick={() => setVIndex(i)}
                className="box"
                style={{
                  flex: "none",
                  width: 108,
                  padding: "9px 8px 8px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  border: i === idx ? "2px solid var(--accent)" : undefined,
                  opacity: i === idx ? 1 : 0.6,
                  cursor: "pointer",
                }}
              >
                <ChordChart shape={v.shape} size="sm" mirror={mirror} />
                <span className="tiny" style={{ fontWeight: 700, color: i === idx ? "var(--accent)" : "var(--ink-soft)", textAlign: "center", marginTop: 5, lineHeight: 1.2 }}>
                  {v.label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      <div style={{ flex: "none", marginTop: "auto", paddingTop: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
          {GRADES.map((g) => (
            <button
              key={g.grade}
              onClick={() => onGrade(g.grade)}
              className="btn"
              style={{
                height: 56,
                flexDirection: "column",
                gap: 2,
                fontSize: 13,
                fontWeight: 700,
                borderStyle: g.miss ? "dashed" : "solid",
                padding: 0,
              }}
            >
              {g.label}
              <small style={{ fontSize: 9, fontWeight: 600, color: "var(--ink-faint)" }}>{g.sub}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── screen 5 · settings ──────────────────────────────────
function Settings({
  settings,
  onChange,
  onBack,
}: {
  settings: ChordSettingsPublic | null;
  onChange: (s: ChordSettingsPublic) => void;
  onBack: () => void;
}) {
  const [saving, setSaving] = useState(false);

  const patch = useCallback(
    (p: Partial<ChordSettingsPublic>) => {
      if (!settings) return;
      const next = { ...settings, ...p };
      onChange(next); // optimistic
      setSaving(true);
      chordsApi
        .updateSettings(p)
        .then((saved) => onChange(saved))
        .catch(() => onChange(settings)) // revert
        .finally(() => setSaving(false));
    },
    [settings, onChange],
  );

  return (
    <>
      <div className="wf-header">
        <button className="btn icon" aria-label="Back" onClick={onBack}>‹</button>
        <h2 className="wf-title" style={{ fontSize: 20, flex: 1, textAlign: "center" }}>Settings</h2>
        <span style={{ width: 38 }} />
      </div>

      <div className="wf-body" style={{ overflowY: "auto", padding: "4px 18px 20px" }}>
        {!settings ? (
          <div className="small muted" style={{ padding: 8 }}>Loading…</div>
        ) : (
          <>
            <SetGroup label="Display" />
            <SetRow title="Handedness" sub="Chart mirroring">
              <Seg
                options={[{ v: "right", t: "Right" }, { v: "left", t: "Left" }]}
                value={settings.handedness}
                onPick={(v) => patch({ handedness: v as ChordSettingsPublic["handedness"] })}
              />
            </SetRow>
            <SetRow title="Notation" sub="Accidentals">
              <Seg
                options={[{ v: "sharp", t: "♯" }, { v: "flat", t: "♭" }]}
                value={settings.notation}
                onPick={(v) => patch({ notation: v as ChordSettingsPublic["notation"] })}
              />
            </SetRow>
            <SetRow title="Theme" sub="Light / dark">
              <Seg
                options={[{ v: "light", t: "Light" }, { v: "dark", t: "Dark" }, { v: "auto", t: "Auto" }]}
                value={settings.theme}
                onPick={(v) => patch({ theme: v as ChordSettingsPublic["theme"] })}
              />
            </SetRow>

            <SetGroup label="Practice" />
            <SetRow title="New cards / day" sub="Introduce per session">
              <Stepper
                value={settings.newPerDay}
                min={1}
                max={50}
                onChange={(n) => patch({ newPerDay: n })}
              />
            </SetRow>
            <SetRow title="Level gating" sub="Lock levels until mastered">
              <Toggle on={settings.levelGating} onToggle={() => patch({ levelGating: !settings.levelGating })} />
            </SetRow>
            <SetRow title="Microphone check" sub="Auto-detect played chord">
              <Toggle on={settings.micCheck} onToggle={() => patch({ micCheck: !settings.micCheck })} />
            </SetRow>

            <div className="tiny muted" style={{ marginTop: 14, textAlign: "center" }}>
              {saving ? "Saving…" : "Changes save automatically"}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function SetGroup({ label }: { label: string }) {
  return (
    <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: 0.7, fontWeight: 700, margin: "16px 2px 8px" }}>
      {label}
    </div>
  );
}

function SetRow({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="box" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 13px", marginBottom: 8, minHeight: 56 }}>
      <div style={{ flex: 1 }}>
        <b style={{ fontSize: 14.5, display: "block" }}>{title}</b>
        <span className="tiny muted">{sub}</span>
      </div>
      {children}
    </div>
  );
}

function Seg({
  options,
  value,
  onPick,
}: {
  options: { v: string; t: string }[];
  value: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="seg" style={{ flex: "none" }}>
      {options.map((o) => (
        <button
          key={o.v}
          className={"s" + (value === o.v ? " on" : "")}
          onClick={() => onPick(o.v)}
          style={{ background: "transparent", border: 0, cursor: "pointer", font: "inherit" }}
        >
          {o.t}
        </button>
      ))}
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="row" style={{ gap: 12, flex: "none" }}>
      <button className="btn icon" style={{ width: 34, height: 34 }} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span className="bold" style={{ fontSize: 16, minWidth: 26, textAlign: "center" }}>{value}</span>
      <button className="btn icon" style={{ width: 34, height: 34 }} onClick={() => onChange(Math.min(max, value + 1))}>＋</button>
    </div>
  );
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={on}
      style={{
        flex: "none",
        width: 48,
        height: 28,
        borderRadius: 999,
        background: on ? "var(--accent)" : "var(--paper-2)",
        border: `1.8px solid ${on ? "var(--accent)" : "var(--ink-faint)"}`,
        position: "relative",
        cursor: "pointer",
        transition: "background .15s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          transition: "left .15s",
        }}
      />
    </button>
  );
}
