import { useEffect, useMemo, useRef, useState } from "react";

// Plays a chord through the app's Magenta <midi-player> (SoundFont), the same
// engine the exercise pages use. The sounding notes are computed from a
// voicing's absolute frets + standard tuning, wrapped in a tiny in-memory
// Standard MIDI File, and strummed on an acoustic guitar. The heavy SoundFont
// engine is dynamic-imported so callers stay light until a chord is shown.
const SOUNDFONT = "https://storage.googleapis.com/magentadata/js/soundfonts/sgm_plus";
type MidiEl = HTMLElement & {
  src?: string;
  soundFont?: string;
  start?: () => Promise<void> | void;
  stop?: () => void;
  currentTime?: number;
};

// Standard-tuning open-string MIDI numbers, low E → high E.
const OPEN_STRING_MIDI = [40, 45, 50, 55, 59, 64];
export function voicingMidi(fingering: (number | "x")[]): number[] {
  const out: number[] = [];
  fingering.forEach((f, i) => {
    if (f !== "x") out.push(OPEN_STRING_MIDI[i] + (f as number)); // f = absolute fret
  });
  return out;
}

// Encode a Standard MIDI File (format 0) that strums `notes` on acoustic
// guitar, returned as a data URI for the <midi-player> src.
function chordMidiUri(notes: number[]): string {
  const TPQ = 480, STRUM = 16, SUSTAIN = 1400, VEL = 82, PROGRAM = 24;
  const vlq = (n: number) => {
    const b = [n & 0x7f];
    n >>= 7;
    while (n > 0) { b.unshift((n & 0x7f) | 0x80); n >>= 7; }
    return b;
  };
  const events: { tick: number; data: number[] }[] = [
    { tick: 0, data: [0xff, 0x51, 0x03, 0x07, 0xa1, 0x20] }, // tempo 120bpm
    { tick: 0, data: [0xc0, PROGRAM] }, // program change
  ];
  notes.forEach((p, i) => events.push({ tick: i * STRUM, data: [0x90, p, VEL] }));
  notes.forEach((p, i) => events.push({ tick: SUSTAIN + i * STRUM, data: [0x80, p, 0x40] }));
  events.sort((a, b) => a.tick - b.tick);
  const track: number[] = [];
  let last = 0;
  for (const e of events) {
    track.push(...vlq(e.tick - last), ...e.data);
    last = e.tick;
  }
  track.push(0x00, 0xff, 0x2f, 0x00); // end of track
  const len = track.length;
  const bytes = [
    0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (TPQ >> 8) & 0xff, TPQ & 0xff,
    0x4d, 0x54, 0x72, 0x6b, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff,
    ...track,
  ];
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return "data:audio/midi;base64," + btoa(bin);
}

export function HearItButton({
  fingering,
  label = "🔊 Hear it",
  className = "btn small",
  style,
}: {
  fingering: (number | "x")[];
  label?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<MidiEl>(null);
  const [registered, setRegistered] = useState(false);
  const [ready, setReady] = useState(false);
  const pending = useRef(false);
  const uri = useMemo(() => chordMidiUri(voicingMidi(fingering)), [fingering]);

  // Pull in the (heavy) SoundFont player lazily, only once a chord is shown.
  useEffect(() => {
    let ok = true;
    // html-midi-player ships no types; we only need its side effect (it
    // registers the <midi-player> custom element).
    // @ts-ignore
    import("html-midi-player").then(() => ok && setRegistered(true)).catch(() => {});
    return () => { ok = false; };
  }, []);

  useEffect(() => {
    if (!registered) return;
    const el = ref.current;
    if (!el) return;
    el.soundFont = SOUNDFONT;
    el.src = uri;
    setReady(false);
    const onLoad = () => {
      setReady(true);
      if (pending.current) {
        pending.current = false;
        void el.start?.();
      }
    };
    el.addEventListener("load", onLoad);
    return () => el.removeEventListener("load", onLoad);
  }, [registered, uri]);

  const play = () => {
    const el = ref.current;
    if (!el || !ready) {
      pending.current = true; // play as soon as it finishes loading
      return;
    }
    try {
      el.stop?.();
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
    void el.start?.();
  };

  return (
    <>
      {registered && <midi-player ref={ref as unknown as React.Ref<HTMLElement>} style={{ display: "none" }} />}
      <button className={className} style={style} onClick={play}>
        {label}
      </button>
    </>
  );
}
