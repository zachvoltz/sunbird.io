import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  centsOff,
  noteToFreq,
  singingExercise,
  singingRoutineId,
  singingTypeFromId,
  type SingingExercise,
  type SingingExerciseType,
} from "@sunbird/shared";
import { apiFetch } from "@/lib/api";
import { STFrame } from "../components/STFrame";
import { Icon } from "../components/Icon";
import { Squiggle } from "../components/Squiggle";
import { usePitchTracker } from "../hooks/usePitchTracker";

// airflow / breath glyph (not in the base Icon set)
function Puff({ size = 15, stroke = "currentColor" }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 7 h8 a2.2 2.2 0 1 0 -2.2 -2.2" />
      <path d="M3 11 h11 a2.4 2.4 0 1 1 -2.4 2.4" />
      <path d="M3 15 h6" />
    </svg>
  );
}

// One-shot Web-Audio reference tone.
function playTone(freq: number, dur = 1.3) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    setTimeout(() => ctx.close().catch(() => {}), (dur + 0.2) * 1000);
  } catch {
    /* ignore */
  }
}

// ── page shell ───────────────────────────────────────────
export function SingingExercisePage() {
  const params = useParams<{ type: string }>();
  const navigate = useNavigate();
  const type = singingTypeFromId(singingRoutineId((params.type ?? "") as SingingExerciseType))
    ? (params.type as SingingExerciseType)
    : null;
  const exercise = type ? singingExercise(type) : undefined;

  // Mark the routine stop done, then return to the path.
  const finish = useCallback(() => {
    if (type) {
      apiFetch("/api/me/routine/complete", {
        method: "POST",
        body: JSON.stringify({ routineItemId: singingRoutineId(type), completed: true }),
      }).catch(() => {});
    }
    navigate("/practice");
  }, [type, navigate]);

  return (
    <STFrame side="practice">
      <div className="dt-main-body" style={{ height: "100%", padding: 0, minHeight: 0 }}>
        <div className="wf" style={{ height: "100%", width: "100%", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
          <div style={{ flex: 1, minHeight: 0, width: "100%", maxWidth: 460, margin: "0 auto", display: "flex", flexDirection: "column" }}>
            {!exercise ? (
              <div className="wf-body" style={{ padding: 24 }}>
                <div className="small muted">Unknown exercise.</div>
                <button className="btn accent" style={{ marginTop: 12 }} onClick={() => navigate("/practice")}>← back to practice</button>
              </div>
            ) : (
              <Drill exercise={exercise} onExit={() => navigate("/practice")} onFinish={finish} />
            )}
          </div>
        </div>
      </div>
    </STFrame>
  );
}

function Header({ title, meta, onExit }: { title: string; meta: string; onExit: () => void }) {
  return (
    <div className="wf-header" style={{ paddingBottom: 6, alignItems: "center" }}>
      <button className="btn icon" aria-label="Back" onClick={onExit}>‹</button>
      <div style={{ textAlign: "center", flex: 1 }}>
        <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: "0.12em" }}>Warmup</div>
        <div className="wf-scrawl bold" style={{ fontSize: 22, lineHeight: 1.05 }}>{title}</div>
      </div>
      <span style={{ width: 38 }} />
    </div>
  );
}

// dispatch by which params the exercise carries (so new library exercises work)
function Drill({ exercise, onExit, onFinish }: { exercise: SingingExercise; onExit: () => void; onFinish: () => void }) {
  if (exercise.box) return <BoxBreathing ex={exercise} onExit={onExit} onFinish={onFinish} />;
  if (exercise.hiss) return <SustainedHiss ex={exercise} onExit={onExit} onFinish={onFinish} />;
  if (exercise.quickCatch) return <QuickCatch ex={exercise} onExit={onExit} onFinish={onFinish} />;
  return <ScaleDrill ex={exercise} onExit={onExit} onFinish={onFinish} />;
}

type DrillProps = { ex: SingingExercise; onExit: () => void; onFinish: () => void };

// ── ① Box breathing ──────────────────────────────────────
function BoxBreathing({ ex, onExit, onFinish }: DrillProps) {
  const box = ex.box!;
  const phaseDurs = [box.inhale, box.hold, box.exhale, box.hold];
  const cycleLen = phaseDurs.reduce((a, b) => a + b, 0);
  const total = cycleLen * box.cycles;
  const [elapsed, setElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const startRef = useRef<number | null>(null);
  const baseRef = useRef(0);

  useEffect(() => {
    if (paused) return;
    startRef.current = null;
    let raf = 0;
    const tick = (t: number) => {
      if (startRef.current == null) startRef.current = t;
      const e = baseRef.current + (t - startRef.current) / 1000;
      if (e >= total) {
        setElapsed(total);
        return;
      }
      setElapsed(e);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      if (startRef.current != null) baseRef.current += (performance.now() - startRef.current) / 1000;
      cancelAnimationFrame(raf);
    };
  }, [paused, total]);

  const done = elapsed >= total;
  const inCycle = elapsed % cycleLen;
  const cycle = Math.min(box.cycles, Math.floor(elapsed / cycleLen) + 1);
  let acc = 0;
  let phaseIdx = 0;
  let phaseElapsed = 0;
  for (let i = 0; i < phaseDurs.length; i++) {
    if (inCycle < acc + phaseDurs[i]) {
      phaseIdx = i;
      phaseElapsed = inCycle - acc;
      break;
    }
    acc += phaseDurs[i];
  }
  const phaseNames = ["inhale", "hold", "exhale", "hold"];
  const countRemaining = Math.max(1, Math.ceil(phaseDurs[phaseIdx] - phaseElapsed));
  const arc = phaseDurs[phaseIdx] ? phaseElapsed / phaseDurs[phaseIdx] : 0;

  if (done) {
    return (
      <FinishScreen icon="🌬️" title="Breathing done." sub="Nice and steady — shoulders relaxed." onFinish={onFinish} onExit={onExit} />
    );
  }

  return (
    <>
      <Header title="Box breathing" meta={ex.meta} onExit={onExit} />
      <div className="wf-body col gap-3" style={{ justifyContent: "flex-start" }}>
        <div className="center small muted">follow the ring · cycle {cycle} of {box.cycles}</div>
        <BreathDial phase={phaseNames[phaseIdx]} count={countRemaining} arc={arc} />
        <div className="row" style={{ gap: 6, justifyContent: "center" }}>
          {phaseNames.map((p, i) => (
            <span key={i} className={"chip" + (i === phaseIdx ? " filled" : "")} style={{ fontSize: 12 }}>
              {p} {phaseDurs[i]}s
            </span>
          ))}
        </div>
        <div className="postit small" style={{ transform: "rotate(-0.6deg)", alignSelf: "center" }}>
          drop the shoulders — breathe into the belly, not the chest
        </div>
        <div className="grow" />
        <div className="row gap-2" style={{ justifyContent: "center" }}>
          <button className="btn ghost small" onClick={() => setPaused((p) => !p)}>{paused ? "resume" : "pause"}</button>
          <button className="btn small" onClick={onFinish}>finish →</button>
        </div>
      </div>
    </>
  );
}

function BreathDial({ phase, count, arc, size = 210 }: { phase: string; count: number; arc: number; size?: number }) {
  const R = size / 2 - 16;
  const C = 2 * Math.PI * R;
  const cx = size / 2;
  const cy = size / 2;
  return (
    <div style={{ position: "relative", width: size, height: size, margin: "0 auto" }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: "block" }}>
        <circle cx={cx} cy={cy} r={R} fill="var(--paper)" stroke="var(--ink-faint)" strokeWidth="2" strokeDasharray="2 5" />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--accent)" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${C * arc} ${C}`} transform={`rotate(-90 ${cx} ${cy})`} />
        <circle cx={cx + R * Math.cos(2 * Math.PI * arc - Math.PI / 2)} cy={cy + R * Math.sin(2 * Math.PI * arc - Math.PI / 2)}
          r="7" fill="var(--paper)" stroke="var(--accent)" strokeWidth="2.5" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: "0.15em" }}>{phase}</div>
        <div className="wf-scrawl" style={{ fontSize: 60, lineHeight: 0.9 }}>{count}</div>
        <div className="tiny muted">seconds</div>
      </div>
    </div>
  );
}

// ── ② Sustained hiss ─────────────────────────────────────
const HISS_HISTORY_KEY = "sing-hiss-history";
function loadHiss(): number[] {
  try {
    return JSON.parse(localStorage.getItem(HISS_HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function SustainedHiss({ ex, onExit, onFinish }: DrillProps) {
  const goal = ex.hiss!.goalSec;
  const [stage, setStage] = useState<"ready" | "holding" | "done">("ready");
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);
  const held = useRef(0);
  const { level } = usePitchTracker(stage === "holding");
  const silentMs = useRef(0);

  // Stopwatch while holding; auto-stop when airflow drops out (~0.7s of silence).
  useEffect(() => {
    if (stage !== "holding") return;
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      held.current += dt / 1000;
      setSeconds(held.current);
      if (level < 0.03) silentMs.current += dt;
      else silentMs.current = 0;
      if (held.current > 1.5 && silentMs.current > 700) {
        setStage("done");
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage, level]);

  // sample the level trace a few times a second
  useEffect(() => {
    if (stage !== "holding") return;
    const id = setInterval(() => setLevels((l) => [...l.slice(-59), level]), 120);
    return () => clearInterval(id);
  }, [stage, level]);

  const start = () => {
    held.current = 0;
    silentMs.current = 0;
    setSeconds(0);
    setLevels([]);
    setStage("holding");
  };

  if (stage === "done") {
    const result = Math.round(held.current);
    return <HissResult held={result} goal={goal} onFinish={onFinish} onExit={onExit} />;
  }

  return (
    <>
      <Header title="Sustained hiss" meta={ex.meta} onExit={onExit} />
      <div className="wf-body col gap-3">
        <div className="center small muted">one long, steady “sss” — keep the airflow even</div>

        <div className="box thick accent center" style={{ padding: "18px 14px" }}>
          <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: "0.15em" }}>{stage === "holding" ? "holding" : "ready"}</div>
          <div className="wf-scrawl" style={{ fontSize: 66, lineHeight: 0.9, color: "var(--accent)" }}>
            {Math.floor(seconds)}<span style={{ fontSize: 26 }}>s</span>
          </div>
          <div className="row gap-2" style={{ justifyContent: "center", marginTop: 4 }}>
            <LevelBars level={stage === "holding" ? level : 0} />
            <span className="tiny muted">{stage === "holding" ? "airflow" : "tap start, then hiss"}</span>
          </div>
        </div>

        <div>
          <div className="row between small mb-1">
            <span className="muted">goal</span>
            <span className="bold">{goal}s {stage === "holding" && seconds < goal && <span className="muted">· {Math.ceil(goal - seconds)}s to go</span>}</span>
          </div>
          <div className="progress"><i style={{ width: `${Math.min(100, (seconds / goal) * 100)}%` }} /></div>
        </div>

        <div className="box small">
          <div className="tiny muted mb-1">airflow steadiness</div>
          <svg viewBox="0 0 320 46" width="100%" height="46" style={{ display: "block" }}>
            <line x1="0" y1="23" x2="320" y2="23" stroke="var(--ink-faint)" strokeWidth="1" strokeDasharray="2 4" />
            <path
              d={levels.length > 1 ? levels.map((v, i) => `${i === 0 ? "M" : "L"} ${(i / Math.max(1, levels.length - 1)) * 316 + 2} ${23 - Math.min(20, v * 40)}`).join(" ") : "M 4 23 L 316 23"}
              fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="grow" />
        {stage === "ready" ? (
          <button className="btn accent big" style={{ alignSelf: "center" }} onClick={start}>
            <Icon name="play" size={14} stroke="white" /> start hold
          </button>
        ) : (
          <button className="btn accent" style={{ alignSelf: "center" }} onClick={() => setStage("done")}>
            <Icon name="pause" size={13} stroke="white" /> stop &amp; log this hold
          </button>
        )}
      </div>
    </>
  );
}

function HissResult({ held, goal, onFinish, onExit }: { held: number; goal: number; onFinish: () => void; onExit: () => void }) {
  const [history] = useState<number[]>(() => {
    const prev = loadHiss();
    const next = [...prev, held].slice(-5);
    try {
      localStorage.setItem(HISS_HISTORY_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    return next;
  });
  const beat = held - goal;
  const max = Math.max(goal, ...history, 1);
  return (
    <>
      <Header title={beat >= 0 ? "Nice hold." : "Good effort."} meta="" onExit={onExit} />
      <div className="wf-body col gap-3">
        <div className="box thick center" style={{ padding: "16px 14px", borderColor: "var(--accent)", position: "relative" }}>
          {beat >= 0 && <div className="corner">+{beat}s</div>}
          <div className="tiny muted" style={{ textTransform: "uppercase", letterSpacing: "0.15em" }}>you held</div>
          <div className="wf-scrawl" style={{ fontSize: 60, lineHeight: 0.9, color: "var(--accent)" }}>{held}<span style={{ fontSize: 24 }}>s</span></div>
          <div className="small muted">goal was {goal}s — {beat >= 0 ? `beat it by ${beat}` : `${-beat}s short, keep at it`}</div>
          <Squiggle w={80} color="var(--accent)" />
        </div>

        {history.length > 1 && (
          <div className="box small">
            <div className="tiny muted mb-2">vs your last {history.length} tries</div>
            <div className="row" style={{ gap: 8, alignItems: "flex-end", height: 60 }}>
              {history.map((v, i) => {
                const last = i === history.length - 1;
                return (
                  <div key={i} className="col center" style={{ flex: 1, gap: 3 }}>
                    <div style={{ width: "100%", height: (v / max) * 46, borderRadius: 4, background: last ? "var(--accent)" : "var(--paper-2)", border: "1.5px solid " + (last ? "var(--accent)" : "var(--ink)") }} />
                    <div className="tiny muted">{v}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="grow" />
        <button className="btn accent big" style={{ alignSelf: "center", boxShadow: "2px 2px 0 var(--ink)" }} onClick={onFinish}>
          <Icon name="chev" size={15} stroke="white" /> done
        </button>
      </div>
    </>
  );
}

function LevelBars({ level }: { level: number }) {
  const bars = [0.5, 1, 0.7, 1.1, 0.6];
  return (
    <span style={{ display: "inline-flex", alignItems: "flex-end", gap: 2, height: 16 }}>
      {bars.map((b, i) => (
        <i key={i} style={{ width: 3, height: Math.min(16, Math.max(3, 16 * (0.2 + level * b * 1.4))), background: "var(--accent)", borderRadius: 2, display: "inline-block", transition: "height .08s ease" }} />
      ))}
    </span>
  );
}

// ── ③ Quick-catch breaths ────────────────────────────────
function QuickCatch({ ex, onExit, onFinish }: DrillProps) {
  const { reps, bpm } = ex.quickCatch!;
  const [rep, setRep] = useState(1);
  const [running, setRunning] = useState(true);
  const [beat, setBeat] = useState(false); // pulse

  useEffect(() => {
    if (!running) return;
    const beatMs = (60 / bpm) * 1000;
    // three beats per rep: two "sing", one "catch"
    let count = 0;
    const id = setInterval(() => {
      count++;
      setBeat((b) => !b);
      if (count % 3 === 0) {
        setRep((r) => {
          if (r >= reps) {
            clearInterval(id);
            setRunning(false);
            return r;
          }
          return r + 1;
        });
      }
    }, beatMs);
    return () => clearInterval(id);
  }, [running, bpm, reps]);

  const done = !running && rep >= reps;
  if (done) {
    return <FinishScreen icon="💨" title="Breath control up." sub={`${reps} clean quick-catch reps — the catch stayed silent.`} onFinish={onFinish} onExit={onExit} />;
  }

  return (
    <>
      <Header title="Quick-catch breaths" meta={ex.meta} onExit={onExit} />
      <div className="wf-body col gap-3">
        <div className="center small muted">short phrase, fast silent breath, go again · {reps} reps</div>

        <div className="box" style={{ padding: "14px 10px" }}>
          <svg viewBox="0 0 320 96" width="100%" height="96" style={{ display: "block" }}>
            <line x1="6" y1="70" x2="314" y2="70" stroke="var(--ink-faint)" strokeWidth="1" />
            {[8, 92, 176, 260].map((x0, i) => (
              <g key={i}>
                <path d={`M ${x0} 70 Q ${x0 + 22} ${34 - i * 2} ${x0 + 44} 70`} fill="none" stroke="var(--ink)" strokeWidth="2.5" />
                {i < 3 && (
                  <>
                    <text x={x0 + 58} y={54} textAnchor="middle" fontSize="16" fill="var(--accent)">↺</text>
                    <text x={x0 + 58} y={86} textAnchor="middle" fontSize="9" fill="var(--accent)" fontFamily="var(--hand)">catch</text>
                  </>
                )}
              </g>
            ))}
            <circle cx={8 + ((rep - 1) % 4) * 84 + 22} cy={beat ? 40 : 70} r="6" fill="var(--accent)" stroke="var(--ink)" strokeWidth="1.5" style={{ transition: "cy .1s" }} />
          </svg>
          <div className="tiny muted center">phrase {rep} of {reps} · breath in under 1 beat</div>
        </div>

        <div className="row gap-2" style={{ justifyContent: "center" }}>
          <span className="chip filled">rep {rep} / {reps}</span>
          <span className="chip"><Icon name="metro" size={11} /> {bpm} bpm</span>
        </div>

        <div className="postit small" style={{ transform: "rotate(0.5deg)", alignSelf: "center" }}>
          the catch should be silent — no gasp. relax the throat.
        </div>

        <div className="grow" />
        <div className="row gap-2" style={{ justifyContent: "center" }}>
          <button className="btn ghost small" onClick={() => setRunning((r) => !r)}>{running ? "pause" : "resume"}</button>
          <button className="btn accent small" onClick={onFinish}>finish →</button>
        </div>
      </div>
    </>
  );
}

// ── ④ Scale / siren / hum drill (live pitch) ─────────────
function drillNotes(ex: SingingExercise): { notes: string[]; labels: string[]; refNote: string } {
  if (ex.scale) return { notes: ex.scale.notes, labels: ex.scale.solfege, refNote: ex.scale.refNote };
  if (ex.siren) return { notes: [ex.siren.low, ex.siren.high], labels: [ex.siren.low, ex.siren.high], refNote: ex.siren.low };
  if (ex.hum) return { notes: ex.hum.notes, labels: ex.hum.notes, refNote: ex.hum.notes[0] };
  return { notes: ["C4"], labels: ["C4"], refNote: "C4" };
}

type NoteResult = { note: string; label: string; cents: number | null };

function ScaleDrill({ ex, onExit, onFinish }: DrillProps) {
  const { notes, labels, refNote } = useMemo(() => drillNotes(ex), [ex]);
  const [ti, setTi] = useState(0);
  const [results, setResults] = useState<NoteResult[]>([]);
  const [finished, setFinished] = useState(false);
  const { status, hz } = usePitchTracker(!finished);

  const targetHz = noteToFreq(notes[Math.min(ti, notes.length - 1)]) ?? 261.63;
  const liveCents = hz != null ? Math.max(-60, Math.min(60, centsOff(hz, targetHz))) : null;

  const onTargetMs = useRef(0);
  const bestCents = useRef(999);
  const lastT = useRef<number | null>(null);

  const advance = useCallback(
    (cents: number | null) => {
      setResults((r) => [...r, { note: notes[ti], label: labels[ti], cents }]);
      onTargetMs.current = 0;
      bestCents.current = 999;
      lastT.current = null;
      if (ti + 1 >= notes.length) setFinished(true);
      else setTi(ti + 1);
    },
    [ti, notes, labels],
  );

  // Accumulate on-target time as the sung pitch settles near the current note.
  useEffect(() => {
    if (finished) return;
    if (hz == null || liveCents == null) {
      lastT.current = null;
      return;
    }
    const now = performance.now();
    const dt = lastT.current != null ? now - lastT.current : 0;
    lastT.current = now;
    if (Math.abs(liveCents) <= 45) {
      onTargetMs.current += dt;
      if (Math.abs(liveCents) < Math.abs(bestCents.current)) bestCents.current = liveCents;
      if (onTargetMs.current >= 450) advance(bestCents.current === 999 ? liveCents : bestCents.current);
    } else {
      onTargetMs.current = Math.max(0, onTargetMs.current - dt * 0.6);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hz]);

  if (finished) {
    return <ScaleSummary ex={ex} results={results} onFinish={onFinish} onExit={onExit} />;
  }

  const inTune = liveCents != null && Math.abs(liveCents) <= 8;
  return (
    <>
      <Header title={ex.name.replace(/ ·.*/, "")} meta={ex.meta} onExit={onExit} />
      <div className="wf-body col gap-3">
        <div className="row between">
          <div className="small muted">
            {status === "denied" ? "mic blocked — enable to track pitch" : status === "listening" ? `on “${labels[ti]}” · sing the note` : "starting mic…"}
          </div>
          {status === "listening" && (
            <span className="chip accent" style={{ gap: 6 }}>
              <Icon name="mic" size={11} stroke="var(--accent)" /> listening
            </span>
          )}
        </div>

        <ScaleStaffSvg notes={notes} labels={labels} current={ti} />

        <PitchMeterView cents={liveCents} inTune={inTune} note={notes[ti]} />

        <div className="box small row gap-2" style={{ alignItems: "center" }}>
          <button className="btn icon" style={{ width: 34, height: 34 }} onClick={() => playTone(targetHz)} aria-label="Reference tone">
            <Icon name="play" size={13} />
          </button>
          <div className="grow">
            <div className="bold small">Reference tone · {notes[ti]}</div>
            <div className="tiny muted">tap to hear the target pitch</div>
          </div>
          <button className="btn small" onClick={() => playTone(noteToFreq(refNote) ?? targetHz)}>root {refNote}</button>
        </div>

        <div className="grow" />
        <div className="row gap-2" style={{ justifyContent: "center" }}>
          <button className="btn ghost small" onClick={() => { setTi(0); setResults([]); }}>restart</button>
          <button className="btn accent small" onClick={() => advance(null)}>skip note →</button>
        </div>
      </div>
    </>
  );
}

function ScaleStaffSvg({ notes, labels, current }: { notes: string[]; labels: string[]; current: number }) {
  const midis = notes.map((n) => noteToFreq(n)!).map((f) => 69 + 12 * Math.log2(f / 440));
  const lo = Math.min(...midis);
  const hi = Math.max(...midis);
  const span = Math.max(1, hi - lo);
  const W = 320;
  const x0 = 40;
  const x1 = W - 30;
  const xs = notes.map((_, i) => (notes.length === 1 ? (x0 + x1) / 2 : x0 + (i / (notes.length - 1)) * (x1 - x0)));
  const yFor = (i: number) => 54 - ((midis[i] - lo) / span) * 42;
  const cx = xs[current];
  const cy = yFor(current);
  return (
    <div className="box" style={{ padding: "16px 10px 8px", position: "relative" }}>
      <div className="tiny muted mb-1 row between" style={{ padding: "0 4px" }}>
        <span>{notes[0]} → {notes[notes.length - 1]}</span>
        <span>vowel “ee”</span>
      </div>
      <svg viewBox="0 0 320 78" width="100%" height="78" style={{ display: "block" }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1="6" y1={14 + i * 10} x2="314" y2={14 + i * 10} stroke="var(--ink-faint)" strokeWidth="1" />
        ))}
        <text x="12" y="46" fontFamily="Caveat" fontSize="30" fill="var(--ink)">𝄞</text>
        {/* note dots */}
        {xs.map((x, i) => (
          <g key={i}>
            <ellipse cx={x} cy={yFor(i)} rx="6" ry="4.5" fill={i === current ? "var(--accent)" : "var(--ink)"} transform={`rotate(-18 ${x} ${yFor(i)})`} />
            <text x={x} y={72} textAnchor="middle" fontSize="12" fill={i === current ? "var(--accent)" : "var(--ink-faint)"} fontFamily="var(--hand)" fontWeight={i === current ? 700 : 400}>{labels[i]}</text>
          </g>
        ))}
        {/* playhead */}
        <line x1={cx} y1="6" x2={cx} y2="62" stroke="var(--accent)" strokeWidth="2" strokeDasharray="3 3" />
        <circle cx={cx} cy={cy} r="10" fill="none" stroke="var(--accent)" strokeWidth="2" />
      </svg>
    </div>
  );
}

function PitchMeterView({ cents, inTune, note }: { cents: number | null; inTune: boolean; note: string }) {
  const pct = cents == null ? 50 : 50 + (Math.max(-50, Math.min(50, cents)) / 50) * 50;
  return (
    <div className="box" style={{ padding: "12px 14px" }}>
      <div className="row between tiny muted mb-2">
        <span>flat ♭</span>
        <span className="bold" style={{ color: cents == null ? "var(--ink-faint)" : inTune ? "#2f6a3f" : "var(--accent)" }}>
          {cents == null ? `sing ${note}` : inTune ? "in tune ✓" : `${cents > 0 ? "+" : ""}${cents}¢ ${cents < 0 ? "flat" : "sharp"}`}
        </span>
        <span>sharp ♯</span>
      </div>
      <div style={{ position: "relative", height: 30 }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 3, background: "var(--ink)", transform: "translateY(-50%)" }} />
        <div style={{ position: "absolute", left: "42%", width: "16%", top: "50%", transform: "translateY(-50%)", height: 16, borderRadius: 4, background: "rgba(47,106,63,0.15)", border: "1.5px solid #2f6a3f" }} />
        {cents != null && (
          <div style={{ position: "absolute", left: pct + "%", top: "50%", transform: "translate(-50%,-50%)", width: 16, height: 16, borderRadius: "50%", background: inTune ? "#2f6a3f" : "var(--accent)", border: "2px solid var(--ink)", transition: "left .08s ease" }} />
        )}
      </div>
    </div>
  );
}

function ScaleSummary({ ex, results, onFinish, onExit }: DrillProps & { results: NoteResult[] }) {
  const scored = results.filter((r) => r.cents != null);
  const inTuneCount = scored.filter((r) => Math.abs(r.cents!) <= 15).length;
  const pct = results.length ? Math.round((inTuneCount / results.length) * 100) : 0;
  const R = 48;
  const C = 2 * Math.PI * R;
  return (
    <>
      <Header title={`${ex.name.replace(/ ·.*/, "")} done.`} meta="" onExit={onExit} />
      <div className="wf-body col gap-3 scroll-y">
        <div className="box thick center" style={{ padding: 14, borderColor: "var(--accent)" }}>
          <svg viewBox="0 0 120 120" width="118" height="118" style={{ display: "block", margin: "0 auto" }}>
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--paper-2)" strokeWidth="10" />
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--accent)" strokeWidth="10" strokeLinecap="round"
              strokeDasharray={`${(C * pct) / 100} ${C}`} transform="rotate(-90 60 60)" />
            <text x="60" y="56" textAnchor="middle" fontFamily="Caveat" fontSize="34" fontWeight="700" fill="var(--ink)">{pct}%</text>
            <text x="60" y="76" textAnchor="middle" fontFamily="Patrick Hand" fontSize="12" fill="var(--ink-soft)">in tune</text>
          </svg>
          <div className="small muted">{inTuneCount} of {results.length} notes within ±15¢</div>
        </div>

        <div className="small muted">NOTE BY NOTE</div>
        <div className="col gap-2">
          {results.map((n, i) => {
            const good = n.cents != null && Math.abs(n.cents) <= 15;
            const col = n.cents == null ? "var(--ink-faint)" : good ? "#2f6a3f" : "var(--accent)";
            return (
              <div key={i} className="box small row gap-2" style={{ alignItems: "center", padding: "7px 11px" }}>
                <span style={{ width: 30, height: 30, flex: "none", borderRadius: "50%", border: "2px solid " + col, display: "grid", placeItems: "center" }}>
                  <span className="wf-scrawl bold" style={{ fontSize: 12, color: col }}>{n.label}</span>
                </span>
                <div className="grow small">{n.cents == null ? "skipped" : good ? "in tune" : n.cents < 0 ? "a little flat" : "a little sharp"}</div>
                <span className="chip tiny" style={{ borderColor: col, color: col }}>
                  {n.cents == null ? "—" : `${n.cents > 0 ? "+" : ""}${n.cents}¢`}
                </span>
              </div>
            );
          })}
        </div>

        <div className="postit small" style={{ transform: "rotate(-0.5deg)" }}>
          keep the soft palate lifted — don’t push for pitch, let it float.
        </div>

        <div className="grow" />
        <button className="btn accent big" style={{ alignSelf: "center", boxShadow: "2px 2px 0 var(--ink)" }} onClick={onFinish}>
          <Icon name="chev" size={15} stroke="white" /> done
        </button>
      </div>
    </>
  );
}

// shared "exercise complete" screen for breath drills
function FinishScreen({ icon, title, sub, onFinish, onExit }: { icon: string; title: string; sub: string; onFinish: () => void; onExit: () => void }) {
  return (
    <>
      <Header title="Done" meta="" onExit={onExit} />
      <div className="wf-body col" style={{ justifyContent: "center", alignItems: "center", textAlign: "center", gap: 12, flex: 1 }}>
        <div style={{ fontSize: 44 }}>{icon}</div>
        <div className="wf-scrawl bold" style={{ fontSize: 30, lineHeight: 1.05, color: "var(--accent)" }}>{title}</div>
        <div className="small muted" style={{ maxWidth: 300 }}>{sub}</div>
        <Squiggle w={80} color="var(--accent)" />
        <button className="btn accent big" style={{ marginTop: 8, boxShadow: "2px 2px 0 var(--ink)" }} onClick={onFinish}>
          <Icon name="chev" size={15} stroke="white" /> done
        </button>
      </div>
    </>
  );
}
