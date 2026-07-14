import { useEffect, useRef, useState } from "react";

// Continuous monophonic pitch tracking off the microphone, for the singing
// scale drills. Same time-domain autocorrelation the chord detector uses, but
// it exposes the live fundamental frequency (Hz) and input level rather than
// latched pitch classes. The caller compares `hz` to a target note.

export type PitchStatus = "idle" | "requesting" | "listening" | "denied" | "unsupported" | "error";

export interface PitchState {
  status: PitchStatus;
  level: number; // 0..1 recent loudness (drives level meters / airflow)
  hz: number | null; // smoothed fundamental, or null when nothing pitched
}

const MIN_HZ = 70;
const MAX_HZ = 1400; // covers up to ~A5+ for high sirens
const RMS_GATE = 0.012;
const CLARITY = 0.9;

function detectFundamental(buf: Float32Array, sampleRate: number): number | null {
  const size = buf.length;
  let energy = 0;
  for (let i = 0; i < size; i++) energy += buf[i] * buf[i];
  if (Math.sqrt(energy / size) < RMS_GATE) return null;

  const minLag = Math.max(2, Math.floor(sampleRate / MAX_HZ));
  const maxLag = Math.min(size - 1, Math.ceil(sampleRate / MIN_HZ));
  let prev = 0;
  let rising = false;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    let e1 = 0;
    let e2 = 0;
    for (let i = 0; i < size - lag; i++) {
      const a = buf[i];
      const b = buf[i + lag];
      corr += a * b;
      e1 += a * a;
      e2 += b * b;
    }
    const norm = e1 > 0 && e2 > 0 ? corr / Math.sqrt(e1 * e2) : 0;
    if (norm > prev) {
      rising = true;
    } else if (rising) {
      if (prev >= CLARITY) {
        const hz = sampleRate / (lag - 1);
        return hz >= MIN_HZ && hz <= MAX_HZ ? hz : null;
      }
      rising = false;
    }
    prev = norm;
  }
  return null;
}

export function usePitchTracker(enabled: boolean): PitchState {
  const [status, setStatus] = useState<PitchStatus>("idle");
  const [level, setLevel] = useState(0);
  const [hz, setHz] = useState<number | null>(null);
  const smoothed = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }

    let cancelled = false;
    let ctx: AudioContext | null = null;
    let stream: MediaStream | null = null;
    let raf = 0;
    let lastHzPush = 0;
    let lastLevelPush = 0;

    setStatus("requesting");
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(s);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        const sampleRate = ctx.sampleRate;
        const time = new Float32Array(analyser.fftSize);
        setStatus("listening");

        const tick = () => {
          if (cancelled || !ctx) return;
          raf = requestAnimationFrame(tick);
          analyser.getFloatTimeDomainData(time);

          let sum = 0;
          for (let i = 0; i < time.length; i++) sum += time[i] * time[i];
          const rms = Math.sqrt(sum / time.length);
          const now = performance.now();
          if (now - lastLevelPush > 60) {
            lastLevelPush = now;
            setLevel(Math.min(1, rms * 8));
          }

          const detected = detectFundamental(time, sampleRate);
          if (detected == null) {
            smoothed.current = null;
            if (now - lastHzPush > 90) {
              lastHzPush = now;
              setHz(null);
            }
            return;
          }
          // Exponential smoothing to steady the needle; snap on big jumps.
          const s0 = smoothed.current;
          smoothed.current =
            s0 == null || Math.abs(1200 * Math.log2(detected / s0)) > 120
              ? detected
              : s0 * 0.7 + detected * 0.3;
          if (now - lastHzPush > 55) {
            lastHzPush = now;
            setHz(smoothed.current);
          }
        };
        raf = requestAnimationFrame(tick);
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus(err?.name === "NotAllowedError" ? "denied" : "error");
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (ctx) ctx.close().catch(() => {});
    };
  }, [enabled]);

  return { status, level, hz };
}
