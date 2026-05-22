// 14 white keys, C4..B5; black keys positioned over them

const WHITE_KEYS = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5", "D5", "E5", "F5", "G5", "A5", "B5"];
const BLACK_POSITIONS = [0.7, 1.7, 3.7, 4.7, 5.7, 7.7, 8.7, 10.7, 11.7, 12.7];
const BLACK_PITCHES = ["C#4", "D#4", "F#4", "G#4", "A#4", "C#5", "D#5", "F#5", "G#5", "A#5"];

export function MiniPiano({ lit = [], held = [] }: { lit?: string[]; held?: string[] }) {
  return (
    <div className="piano">
      {WHITE_KEYS.map((k) => (
        <div
          key={k}
          className={"wk" + (held.includes(k) ? " held" : lit.includes(k) ? " lit" : "")}
        />
      ))}
      {BLACK_POSITIONS.map((frac, i) => (
        <div
          key={i}
          className="bk"
          style={{
            left: `calc(${frac} * (100% / 14) - 2.3%)`,
            background: held.includes(BLACK_PITCHES[i])
              ? "var(--accent)"
              : lit.includes(BLACK_PITCHES[i])
              ? "var(--ink-soft)"
              : "var(--ink)",
          }}
        />
      ))}
    </div>
  );
}
