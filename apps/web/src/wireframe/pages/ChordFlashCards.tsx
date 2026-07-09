import { useCallback, useEffect, useState } from "react";
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
import { MobileStatusBar } from "../components/MobileStatusBar";
import { ChordChart, MasteryRing } from "../components/ChordChart";

// ── phone-frame card, matching the practice section's other mobile pages ──
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

// ── tiny Web-Audio chord synth for the "Hear it" button ──
const PITCH_CLASS: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6,
  G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

function playChord(notes: string[]) {
  const AudioCtx =
    (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  // Voice the chord ascending from C3 so it sounds like a strum, not a cluster.
  let prevMidi = 47; // just below C3
  const now = ctx.currentTime;
  notes.forEach((n, i) => {
    const pc = PITCH_CLASS[n];
    if (pc === undefined) return;
    let midi = 48 + pc; // C3 octave
    while (midi <= prevMidi) midi += 12;
    prevMidi = midi;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const t = now + i * 0.09; // light arpeggio
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.16, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 1.7);
  });
  setTimeout(() => ctx.close().catch(() => {}), 2200);
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
      <MobileCard>
        <div className="wf" style={{ height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <MobileStatusBar />
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
      </MobileCard>
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
  return (
    <>
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
    </>
  );
}

// ── card FRONT · chord name + simulated note detector ──
function CardFront({
  card,
  micOn,
  onReveal,
}: {
  card: ChordCardPublic;
  micOn: boolean;
  onReveal: () => void;
}) {
  // Simulated live detector: tones light up one-by-one, mirroring the
  // wireframe's "each tone reveals as it's detected" behaviour. This is a
  // formative aid (a design preview of on-device pitch detection), never a
  // grade — the student self-grades on the back.
  const [detected, setDetected] = useState(0);
  const [hintTier, setHintTier] = useState(0);
  const total = card.tones.length;

  useEffect(() => {
    if (!micOn) return;
    setDetected(0);
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setDetected(n);
      if (n >= total) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [card.id, micOn, total]);

  const hints = [
    `Root note is ${card.tones[0]?.note ?? "?"}`,
    `${total} tones — a ${card.name.replace(/[A-G]#?b?/, "").trim() || "major"} shape`,
    `Recommended: ${card.voicings.find((v) => v.recommended)?.label ?? card.voicings[0]?.label ?? "open"}`,
    "Full answer is on the back — tap Reveal",
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: 20 }}>
      <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>
        🂠 Front
      </div>
      <div style={{ fontWeight: 800, letterSpacing: -1, fontSize: 60, marginTop: 22 }}>{card.name}</div>

      {micOn ? (
        <div className="box filled" style={{ width: "100%", marginTop: "auto", padding: "12px 12px 13px" }}>
          <div className="row between" style={{ marginBottom: 11 }}>
            <span className="row" style={{ gap: 7, fontWeight: 700, fontSize: 12.5, color: "var(--accent)" }}>
              <EqBars /> {detected >= total ? "Detected" : "Listening…"}
            </span>
            <span className="tiny muted" style={{ fontWeight: 700 }}>{Math.min(detected, total)} / {total} tones</span>
          </div>
          <div className="row" style={{ gap: 8, alignItems: "stretch" }}>
            {card.tones.map((t, i) => {
              const on = i < detected;
              return (
                <div
                  key={i}
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
                </div>
              );
            })}
          </div>
          <div className="tiny muted" style={{ textAlign: "center", marginTop: 10 }}>
            Play the chord — each tone reveals its name as it's detected
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

function EqBars() {
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 16 }}>
      {[6, 13, 9, 15].map((h, i) => (
        <i
          key={i}
          style={{
            width: 3,
            height: h,
            background: "var(--accent)",
            borderRadius: 2,
            display: "inline-block",
            animation: `cfc-eq 0.9s ease-in-out ${i * 0.12}s infinite alternate`,
          }}
        />
      ))}
      <style>{`@keyframes cfc-eq { from { transform: scaleY(0.5); } to { transform: scaleY(1); } }`}</style>
    </span>
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
  const primary = card.voicings.find((v) => v.recommended) ?? card.voicings[0];
  const alternates = card.voicings.filter((v) => v.id !== primary?.id);
  const [altIndex, setAltIndex] = useState(0);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: 20 }}>
      <div className="col" style={{ alignItems: "center", gap: 6 }}>
        <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>
          🂡 Back · flipped
        </div>
        <div style={{ fontWeight: 800, letterSpacing: -0.5, fontSize: 30 }}>{card.name}</div>
      </div>

      {primary && (
        <div className="box filled" style={{ position: "relative", marginTop: 10, padding: "16px 14px 10px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span
            className="chip accent"
            style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}
          >
            ★ recommended for your level
          </span>
          <ChordChart shape={primary.shape} size="lg" mirror={mirror} />
          <button
            className="btn small"
            style={{ marginTop: 10, borderRadius: 999 }}
            onClick={() => playChord(card.tones.map((t) => t.note))}
          >
            🔊 Hear it
          </button>
        </div>
      )}

      {alternates.length > 0 && (
        <>
          <div className="row between" style={{ margin: "16px 0 8px" }}>
            <span className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 700 }}>
              Alternate voicings
            </span>
            <span className="tiny" style={{ color: "var(--accent)", fontFamily: "var(--scrawl)", fontSize: 14 }}>swipe →</span>
          </div>
          <div className="row hide-scroll" style={{ gap: 11, overflowX: "auto", paddingBottom: 4 }}>
            {alternates.map((v, i) => (
              <button
                key={v.id}
                onClick={() => setAltIndex(i)}
                className="box"
                style={{ flex: "none", width: 122, padding: "9px 8px 8px", display: "flex", flexDirection: "column", alignItems: "center", opacity: i === altIndex ? 1 : 0.62, cursor: "pointer" }}
              >
                <ChordChart shape={v.shape} size="sm" mirror={mirror} />
                <span className="tiny" style={{ fontWeight: 700, color: "var(--ink-soft)", textAlign: "center", marginTop: 5, lineHeight: 1.2 }}>
                  {v.label}
                </span>
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 6, justifyContent: "center", marginTop: 9 }}>
            {alternates.map((_, i) => (
              <i
                key={i}
                style={{
                  width: i === altIndex ? 16 : 6,
                  height: 6,
                  borderRadius: 999,
                  background: i === altIndex ? "var(--accent)" : "var(--ink-faint)",
                  display: "inline-block",
                  transition: "all .2s",
                }}
              />
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
