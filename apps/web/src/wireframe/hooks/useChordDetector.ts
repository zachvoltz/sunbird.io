import { useEffect, useRef, useState } from "react";

// Real-time chord-tone detector for the flash-card front.
//
// Earlier versions summed the FFT spectrum into a 12-bin chroma, but a single
// played note's harmonics spread energy across many pitch classes, so one note
// lit up several tones. Instead we detect the *fundamental* pitch with
// time-domain autocorrelation (a tuner-style algorithm) and light only the
// tone whose pitch class is actually being played. Octave errors from
// autocorrelation fold to the same pitch class, so they don't cause false
// positives. Detection latches — once a tone is heard it stays lit for the
// card. This is a formative aid, never a grade.

export type DetectorStatus = "idle" | "requesting" | "listening" | "denied" | "unsupported" | "error";

export interface ChordDetectorState {
  status: DetectorStatus;
  level: number; // 0..1 recent input loudness — drives the eq animation
  detected: boolean[]; // per target pitch class, latched true once heard
}

const C0 = 16.351597831287414; // frequency of C0, our pitch-class reference
const MIN_HZ = 70; // low E is ~82 Hz; a little headroom
const MAX_HZ = 1320; // highest fretted fundamentals we care about
const RMS_GATE = 0.014; // below this = silence, don't detect (lower catches quiet middle strings)
const CLARITY = 0.9; // normalized autocorrelation peak — how "pitched" the signal is
const HOLD_FRAMES = 1; // frames the same note must persist before latching (1 = catch a brief clear moment)

function freqToPitchClass(hz: number): number {
  return ((Math.round(12 * Math.log2(hz / C0)) % 12) + 12) % 12;
}

// Normalized autocorrelation pitch detection over the guitar range. Returns the
// fundamental frequency and a 0..1 clarity, or null when the signal isn't
// clearly pitched. Uses length-normalized cross-correlation (so it's unbiased
// across the pitch range) and takes the FIRST peak above the clarity threshold,
// which is the fundamental period rather than an octave/harmonic multiple.
function detectFundamental(buf: Float32Array, sampleRate: number): { hz: number; clarity: number } | null {
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
    // Cosine-normalized correlation in [-1, 1]; ~1 for a periodic signal at its
    // period, independent of lag length.
    const norm = e1 > 0 && e2 > 0 ? corr / Math.sqrt(e1 * e2) : 0;

    if (norm > prev) {
      rising = true;
    } else if (rising) {
      // Just passed a local maximum (value `prev`, at lag-1).
      if (prev >= CLARITY) {
        const hz = sampleRate / (lag - 1);
        if (hz < MIN_HZ || hz > MAX_HZ) return null;
        return { hz, clarity: prev };
      }
      rising = false; // not strong enough — keep looking for a later peak
    }
    prev = norm;
  }
  return null;
}

export function useChordDetector(
  targets: number[],
  enabled: boolean,
  resetKey: string,
): ChordDetectorState {
  const [status, setStatus] = useState<DetectorStatus>("idle");
  const [level, setLevel] = useState(0);
  const [detected, setDetected] = useState<boolean[]>(() => targets.map(() => false));

  const detectedRef = useRef<boolean[]>(targets.map(() => false));

  // Reset latch whenever the card (resetKey) or target count changes.
  useEffect(() => {
    detectedRef.current = targets.map(() => false);
    setDetected(targets.map(() => false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, targets.length]);

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
    let lastLevelPush = 0;
    let heldPc = -1;
    let heldCount = 0;

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
        analyser.fftSize = 2048; // ~43 ms @ 48 kHz — a few periods of the lowest note
        source.connect(analyser);
        const sampleRate = ctx.sampleRate;
        const time = new Float32Array(analyser.fftSize);
        setStatus("listening");

        const tick = () => {
          if (cancelled || !ctx) return;
          raf = requestAnimationFrame(tick);
          analyser.getFloatTimeDomainData(time);

          // Loudness → eq bars.
          let sum = 0;
          for (let i = 0; i < time.length; i++) sum += time[i] * time[i];
          const rms = Math.sqrt(sum / time.length);
          const now = performance.now();
          if (now - lastLevelPush > 80) {
            lastLevelPush = now;
            setLevel(Math.min(1, rms * 8));
          }

          const pitch = detectFundamental(time, sampleRate);
          if (!pitch) {
            heldPc = -1;
            heldCount = 0;
            return;
          }
          const pc = freqToPitchClass(pitch.hz);
          // Debounce: the same pitch class must persist a couple of frames.
          if (pc === heldPc) heldCount += 1;
          else {
            heldPc = pc;
            heldCount = 1;
          }
          if (heldCount < HOLD_FRAMES) return;

          let changed = false;
          for (let i = 0; i < targets.length; i++) {
            if (!detectedRef.current[i] && targets[i] === pc) {
              detectedRef.current[i] = true;
              changed = true;
            }
          }
          if (changed) setDetected([...detectedRef.current]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, resetKey, targets.length]);

  return { status, level, detected };
}
