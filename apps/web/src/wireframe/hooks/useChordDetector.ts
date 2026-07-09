import { useEffect, useRef, useState } from "react";

// Real-time chord-tone detector for the flash-card front.
//
// A guitar chord is polyphonic, so single-pitch autocorrelation won't find all
// the notes. Instead we fold the FFT magnitude spectrum into a 12-bin "chroma"
// vector (energy per pitch class, summed across octaves) and light up a target
// tone once its pitch class is prominent while the student is actually playing.
// Detection latches — once a tone is heard it stays lit for the card, matching
// the wireframe's ✓ behaviour. This is a formative aid, never a grade.

export type DetectorStatus = "idle" | "requesting" | "listening" | "denied" | "unsupported" | "error";

export interface ChordDetectorState {
  status: DetectorStatus;
  level: number; // 0..1 recent input loudness — drives the eq animation
  detected: boolean[]; // per target pitch class, latched true once heard
}

const C0 = 16.351597831287414; // frequency of C0, our pitch-class reference
const MIN_HZ = 70; // low E on a guitar is ~82 Hz; leave headroom
const MAX_HZ = 1300; // covers fretted notes + their lower partials
const LEVEL_GATE = 0.012; // RMS below this = silence, don't detect
const PROMINENCE = 0.55; // a target must reach this fraction of the loudest bin

export function useChordDetector(
  targets: number[],
  enabled: boolean,
  resetKey: string,
): ChordDetectorState {
  const [status, setStatus] = useState<DetectorStatus>("idle");
  const [level, setLevel] = useState(0);
  const [detected, setDetected] = useState<boolean[]>(() => targets.map(() => false));

  // Latched detections live in a ref so the rAF loop can mutate without
  // re-subscribing; we push to state only when something changes.
  const detectedRef = useRef<boolean[]>(targets.map(() => false));

  // Reset latch whenever the card (resetKey) or its targets change.
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
        analyser.fftSize = 8192; // ~5–6 Hz bins → resolves low notes
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);

        const sampleRate = ctx.sampleRate;
        const binHz = sampleRate / analyser.fftSize;
        const freq = new Float32Array(analyser.frequencyBinCount);
        const time = new Float32Array(analyser.fftSize);
        const loBin = Math.max(1, Math.floor(MIN_HZ / binHz));
        const hiBin = Math.min(analyser.frequencyBinCount - 1, Math.ceil(MAX_HZ / binHz));

        setStatus("listening");

        const tick = () => {
          if (cancelled || !ctx) return;
          raf = requestAnimationFrame(tick);

          // Input loudness (RMS) — gates detection and drives the eq bars.
          analyser.getFloatTimeDomainData(time);
          let sum = 0;
          for (let i = 0; i < time.length; i++) sum += time[i] * time[i];
          const rms = Math.sqrt(sum / time.length);
          const now = performance.now();
          if (now - lastLevelPush > 80) {
            lastLevelPush = now;
            setLevel(Math.min(1, rms * 8));
          }
          if (rms < LEVEL_GATE) return;

          // Build a 12-bin chroma from the magnitude spectrum.
          analyser.getFloatFrequencyData(freq); // dB
          const chroma = new Float32Array(12);
          for (let b = loBin; b <= hiBin; b++) {
            const mag = Math.pow(10, freq[b] / 20); // dB → linear
            const f = b * binHz;
            const pc = ((Math.round(12 * Math.log2(f / C0)) % 12) + 12) % 12;
            chroma[pc] += mag;
          }
          let maxC = 0;
          for (let i = 0; i < 12; i++) if (chroma[i] > maxC) maxC = chroma[i];
          if (maxC <= 0) return;

          // Latch any target pitch class that's currently prominent.
          let changed = false;
          for (let i = 0; i < targets.length; i++) {
            if (detectedRef.current[i]) continue;
            if (chroma[targets[i]] >= PROMINENCE * maxC) {
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
