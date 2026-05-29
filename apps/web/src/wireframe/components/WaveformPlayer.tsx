import { useEffect, useRef, useState } from "react";
import "html-midi-player";
import { Icon } from "./Icon";

// SoundCloud-style players: a round accent play/pause button, a clickable
// waveform of bars (filled up to the playhead), elapsed/total time, and a
// loop toggle. Audio uses real decoded peaks; MIDI is driven through the
// hidden <midi-player> element (Magenta synth) with peaks derived from its
// parsed note sequence.

const SOUNDFONT = "https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus";
const BAR_COUNT = 200;

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function flatPeaks(): number[] {
  // Gentle placeholder waveform shown until real peaks are computed.
  return Array.from({ length: BAR_COUNT }, (_, i) => 0.28 + 0.18 * Math.abs(Math.sin(i / 3)));
}

// ── presentational waveform transport ────────────────────
function WaveformPlayer({
  peaks,
  progress,
  playing,
  currentTime,
  duration,
  loop,
  label,
  onTogglePlay,
  onToggleLoop,
  onSeek,
}: {
  peaks: number[];
  progress: number;
  playing: boolean;
  currentTime: number;
  duration: number;
  loop: boolean;
  label: string;
  onTogglePlay: () => void;
  onToggleLoop: () => void;
  onSeek: ((fraction: number) => void) | null;
}) {
  const barW = 1;
  const gap = 1;
  const vbW = peaks.length * (barW + gap);
  const vbH = 40;
  const playedBars = Math.round(progress * peaks.length);
  return (
    <div className="row gap-3" style={{ alignItems: "center" }}>
      <button
        onClick={onTogglePlay}
        aria-label={playing ? "pause" : "play"}
        style={{
          flex: "0 0 auto",
          width: 42,
          height: 42,
          borderRadius: "50%",
          border: "none",
          background: "var(--accent)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={playing ? "pause" : "play"} size={18} stroke="white" />
      </button>

      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        <svg
          viewBox={`0 0 ${vbW} ${vbH}`}
          width="100%"
          height={vbH}
          preserveAspectRatio="none"
          style={{ display: "block", cursor: onSeek ? "pointer" : "default" }}
          onClick={
            onSeek
              ? (e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  onSeek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
                }
              : undefined
          }
        >
          {peaks.map((p, i) => {
            const h = Math.max(2, p * vbH);
            return (
              <rect
                key={i}
                x={i * (barW + gap)}
                y={(vbH - h) / 2}
                width={barW}
                height={h}
                rx={1}
                fill={i < playedBars ? "var(--accent)" : "var(--ink-faint)"}
              />
            );
          })}
        </svg>
        <div className="row between" style={{ marginTop: 3 }}>
          <span className="tiny muted">{label}</span>
          <span className="tiny muted">
            {fmt(currentTime)} / {fmt(duration)}
          </span>
        </div>
      </div>

      <button
        onClick={onToggleLoop}
        title={loop ? "looping" : "loop off"}
        aria-pressed={loop}
        style={{
          flex: "0 0 auto",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: loop ? "var(--accent)" : "var(--ink-faint)",
          fontSize: 20,
          lineHeight: 1,
          padding: 2,
        }}
      >
        ⟲
      </button>
    </div>
  );
}

// ── audio: decode real peaks via Web Audio ───────────────
let _audioCtx: AudioContext | null = null;
function audioCtx(): AudioContext {
  return (_audioCtx ??= new (window.AudioContext || (window as any).webkitAudioContext)());
}

async function decodePeaks(url: string, n: number): Promise<number[] | null> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const audio = await audioCtx().decodeAudioData(buf);
  const ch = audio.getChannelData(0);
  const block = Math.max(1, Math.floor(ch.length / n));
  const peaks: number[] = [];
  let max = 0;
  for (let i = 0; i < n; i++) {
    let m = 0;
    const start = i * block;
    for (let j = 0; j < block; j++) {
      const v = Math.abs(ch[start + j] ?? 0);
      if (v > m) m = v;
    }
    peaks.push(m);
    if (m > max) max = m;
  }
  return peaks.map((p) => (max > 0 ? p / max : 0));
}

export function AudioPlayer({ src, label = "reference audio" }: { src: string; label?: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [peaks, setPeaks] = useState<number[]>(flatPeaks);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const raf = useRef<number | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    setPeaks(flatPeaks());
    decodePeaks(src, BAR_COUNT)
      .then((p) => {
        if (alive && p) setPeaks(p);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [src]);

  // Smooth playhead while playing.
  useEffect(() => {
    function tick() {
      const a = ref.current;
      if (a) {
        setCur(a.currentTime);
        if (a.duration) setDur(a.duration);
      }
      raf.current = requestAnimationFrame(tick);
    }
    if (playing) raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing]);

  const progress = dur > 0 ? Math.min(1, cur / dur) : 0;
  return (
    <>
      <audio
        ref={ref}
        src={src}
        loop={loop}
        preload="metadata"
        style={{ display: "none" }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
      />
      <WaveformPlayer
        peaks={peaks}
        progress={progress}
        playing={playing}
        currentTime={cur}
        duration={dur}
        loop={loop}
        label={label}
        onTogglePlay={() => {
          const a = ref.current;
          if (!a) return;
          if (a.paused) void a.play();
          else a.pause();
        }}
        onToggleLoop={() => setLoop((l) => !l)}
        onSeek={(f) => {
          const a = ref.current;
          if (a && a.duration) {
            a.currentTime = f * a.duration;
            setCur(a.currentTime);
          }
        }}
      />
    </>
  );
}

// ── MIDI: drive the hidden <midi-player> through the same UI ──
function peaksFromNoteSequence(ns: any, n: number, duration: number): number[] | null {
  if (!ns || !Array.isArray(ns.notes) || ns.notes.length === 0) return null;
  const total =
    duration ||
    ns.totalTime ||
    Math.max(...ns.notes.map((x: any) => x.endTime ?? 0)) ||
    1;
  const buckets = new Array(n).fill(0);
  for (const note of ns.notes) {
    const t = note.startTime ?? 0;
    const i = Math.min(n - 1, Math.max(0, Math.floor((t / total) * n)));
    buckets[i] += 1;
  }
  const max = Math.max(...buckets, 1);
  return buckets.map((v) => 0.22 + 0.78 * (v / max));
}

type MidiEl = HTMLElement & {
  src?: string;
  soundFont?: string;
  loop?: boolean;
  playing?: boolean;
  duration?: number;
  currentTime?: number;
  noteSequence?: any;
  start?: () => Promise<void> | void;
  stop?: () => void;
};

export function MidiPlayer({ src, label = "play-along (MIDI)" }: { src: string; label?: string }) {
  const ref = useRef<MidiEl>(null);
  const [peaks, setPeaks] = useState<number[]>(flatPeaks);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const clock = useRef<{ raf?: number; startedAt?: number }>({});

  // Configure the element (properties, not attributes, to avoid the
  // library's attribute parsing quirks).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.soundFont = SOUNDFONT;
    el.src = src;
    el.loop = loop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  useEffect(() => {
    if (ref.current) ref.current.loop = loop;
  }, [loop]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function stopClock() {
      if (clock.current.raf) cancelAnimationFrame(clock.current.raf);
      clock.current.raf = undefined;
    }
    function runClock() {
      stopClock();
      const tick = () => {
        const started = clock.current.startedAt ?? performance.now();
        const d = ref.current?.duration || dur || 1;
        let c = (performance.now() - started) / 1000;
        if (c > d) {
          if (ref.current?.loop) {
            clock.current.startedAt = performance.now();
            c = 0;
          } else c = d;
        }
        setCur(c);
        clock.current.raf = requestAnimationFrame(tick);
      };
      clock.current.raf = requestAnimationFrame(tick);
    }

    const onLoad = () => {
      const d = el.duration || 0;
      setDur(d);
      setPeaks(peaksFromNoteSequence(el.noteSequence, BAR_COUNT, d) ?? flatPeaks());
    };
    const onStart = () => {
      setPlaying(true);
      clock.current.startedAt = performance.now();
      runClock();
    };
    const onStop = () => {
      setPlaying(false);
      stopClock();
      setCur(0);
    };
    const onLoop = () => {
      clock.current.startedAt = performance.now();
      setCur(0);
    };

    el.addEventListener("load", onLoad);
    el.addEventListener("start", onStart);
    el.addEventListener("stop", onStop);
    el.addEventListener("loop", onLoop);
    if (el.noteSequence) onLoad();

    return () => {
      el.removeEventListener("load", onLoad);
      el.removeEventListener("start", onStart);
      el.removeEventListener("stop", onStop);
      el.removeEventListener("loop", onLoop);
      stopClock();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const progress = dur > 0 ? Math.min(1, cur / dur) : 0;
  return (
    <>
      <midi-player ref={ref as any} style={{ display: "none" }} />
      <WaveformPlayer
        peaks={peaks}
        progress={progress}
        playing={playing}
        currentTime={cur}
        duration={dur}
        loop={loop}
        label={label}
        onTogglePlay={() => {
          const el = ref.current;
          if (!el || !el.noteSequence) return;
          if (el.playing) el.stop?.();
          else void el.start?.();
        }}
        onToggleLoop={() => setLoop((l) => !l)}
        onSeek={null}
      />
    </>
  );
}
