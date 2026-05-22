// Voice range tracker — chest / mix / head bands + piano keyboard with passaggi and today's hits.

const KW = 32;
const KH = 70;
const BKW = 20;
const BKH = 44;
const KB_W = 22 * KW;

const WHITES = ["C", "D", "E", "F", "G", "A", "B"];
const BLACK_AFTER: Record<string, string> = { C: "C#", D: "D#", F: "F#", G: "G#", A: "A#" };

type Key = { note: string; x: number; white: boolean };

const KB_KEYS: Key[] = (() => {
  const arr: Key[] = [];
  let x = 0;
  for (let oct = 3; oct <= 5; oct++) {
    for (const w of WHITES) {
      arr.push({ note: w + oct, x, white: true });
      if (BLACK_AFTER[w]) {
        arr.push({ note: BLACK_AFTER[w] + oct, x: x + KW - BKW / 2, white: false });
      }
      x += KW;
    }
  }
  arr.push({ note: "C6", x, white: true });
  return arr;
})();

const xOfNote = (note: string): number => {
  const k = KB_KEYS.find((k) => k.note === note);
  if (!k) return 0;
  return k.x + (k.white ? KW / 2 : BKW / 2);
};

export type Range = [string, string];
export type Today = { lowest?: string; highest?: string; newHigh?: string };
export type Passaggi = { primo?: string; secondo?: string };

export function VoiceRangePiano({
  chest = ["F3", "E4"],
  mix = ["A3", "G5"],
  head = ["D5", "A5"],
  today = { lowest: "G3", highest: "A5", newHigh: "A5" },
  passaggi = { primo: "E4", secondo: "F#5" },
  showLabels = true,
  height = 200,
}: {
  chest?: Range;
  mix?: Range;
  head?: Range;
  today?: Today;
  passaggi?: Passaggi;
  showLabels?: boolean;
  height?: number;
}) {
  const W = KB_W;
  const bandY = 14;
  const bandH = 16;
  const gap = 6;
  const kbY = bandY + (bandH + gap) * 3 + 18;

  const xL = (n: string) => xOfNote(n) - 6;
  const xR = (n: string) => xOfNote(n) + 6;

  const bandRect = (range: Range, y: number, fill: string, stroke: string, hatched = false) => (
    <g>
      <rect
        x={xL(range[0])} y={y} width={xR(range[1]) - xL(range[0])} height={bandH}
        rx={bandH / 2} fill={fill} stroke={stroke} strokeWidth="1.5"
      />
      {hatched && (
        <rect
          x={xL(range[0])} y={y} width={xR(range[1]) - xL(range[0])} height={bandH}
          rx={bandH / 2} fill="url(#vr-hatch-coral)"
        />
      )}
    </g>
  );

  return (
    <svg viewBox={`0 -10 ${W} ${height}`} width="100%" height={height}>
      <defs>
        <pattern id="vr-hatch-coral" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(-45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent)" strokeWidth="1.5" opacity="0.45" />
        </pattern>
      </defs>

      {/* head (top) */}
      {bandRect(head, bandY, "var(--paper)", "var(--accent)", true)}
      <text x={xOfNote(head[0]) - 4} y={bandY + bandH - 4} fontSize="10" fill="var(--accent)" fontFamily="var(--hand)">{head[0]}</text>
      <text x={xOfNote(head[1]) + 6} y={bandY + bandH - 4} fontSize="10" fill="var(--accent)" fontFamily="var(--hand)">{head[1]}</text>
      <text x={6} y={bandY + bandH - 4} fontSize="11" fill="var(--accent)" fontFamily="var(--scrawl)" fontWeight="700">head</text>

      {/* mix */}
      {bandRect(mix, bandY + bandH + gap, "var(--highlight)", "var(--ink)")}
      <text x={xOfNote(mix[0]) - 4} y={bandY + (bandH + gap) + bandH - 4} fontSize="10" fill="var(--ink)" fontFamily="var(--hand)">{mix[0]}</text>
      <text x={xOfNote(mix[1]) + 6} y={bandY + (bandH + gap) + bandH - 4} fontSize="10" fill="var(--ink)" fontFamily="var(--hand)">{mix[1]}</text>
      <text x={6} y={bandY + (bandH + gap) + bandH - 4} fontSize="11" fill="var(--ink)" fontFamily="var(--scrawl)" fontWeight="700">mix</text>

      {/* chest */}
      {bandRect(chest, bandY + (bandH + gap) * 2, "var(--accent)", "var(--accent)")}
      <text x={xOfNote(chest[0]) - 4} y={bandY + (bandH + gap) * 2 + bandH - 4} fontSize="10" fill="white" fontFamily="var(--hand)">{chest[0]}</text>
      <text x={xOfNote(chest[1]) + 6} y={bandY + (bandH + gap) * 2 + bandH - 4} fontSize="10" fill="var(--accent)" fontFamily="var(--hand)">{chest[1]}</text>
      <text x={6} y={bandY + (bandH + gap) * 2 + bandH - 4} fontSize="11" fill="var(--ink)" fontFamily="var(--scrawl)" fontWeight="700">chest</text>

      {/* passaggio markers */}
      {[passaggi.primo, passaggi.secondo].filter(Boolean).map((p, i) => (
        <g key={p as string}>
          <line
            x1={xOfNote(p as string)} x2={xOfNote(p as string)}
            y1={bandY - 6} y2={kbY - 4}
            stroke="var(--ink)" strokeWidth="1" strokeDasharray="2 3" opacity="0.6"
          />
          <text
            x={xOfNote(p as string) + 3} y={bandY - 10} fontSize="9"
            fill="var(--ink-faint)" fontFamily="var(--hand)"
          >
            {i === 0 ? "1° passaggio" : "2° passaggio"} · {p}
          </text>
        </g>
      ))}

      {/* today's new high marker */}
      {today.newHigh && (
        <g>
          <polygon
            points={`${xOfNote(today.newHigh)},${bandY - 2}
              ${xOfNote(today.newHigh) - 4},${bandY - 12}
              ${xOfNote(today.newHigh) + 4},${bandY - 12}`}
            fill="var(--accent)" stroke="var(--ink)" strokeWidth="1"
          />
          <text
            x={xOfNote(today.newHigh) + 7} y={bandY - 4} fontSize="10"
            fill="var(--accent)" fontFamily="var(--scrawl)" fontWeight="700"
          >
            ★ NEW · {today.newHigh}
          </text>
        </g>
      )}

      {/* piano keyboard */}
      {KB_KEYS.filter((k) => k.white).map((k) => (
        <g key={k.note}>
          <rect
            x={k.x + 0.5} y={kbY} width={KW - 1} height={KH}
            fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5"
          />
          {showLabels && (k.note.startsWith("C") || k.note === today.lowest || k.note === today.highest) && (
            <text
              x={k.x + KW / 2} y={kbY + KH - 4} fontSize="9"
              textAnchor="middle" fill="var(--ink-faint)" fontFamily="var(--hand)"
            >
              {k.note}
            </text>
          )}
        </g>
      ))}
      {KB_KEYS.filter((k) => !k.white).map((k) => (
        <rect
          key={k.note} x={k.x} y={kbY} width={BKW} height={BKH}
          fill="var(--ink)" stroke="var(--ink)" strokeWidth="1" rx="2"
        />
      ))}

      {/* today's reached pins on keyboard */}
      {today.lowest && (
        <g>
          <circle cx={xOfNote(today.lowest)} cy={kbY + KH + 8} r="6"
            fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.5" />
          <text x={xOfNote(today.lowest)} y={kbY + KH + 11} fontSize="9"
            textAnchor="middle" fontFamily="var(--scrawl)">▼</text>
          <text x={xOfNote(today.lowest)} y={kbY + KH + 24} fontSize="10"
            textAnchor="middle" fill="var(--ink-faint)" fontFamily="var(--hand)">
            low {today.lowest}
          </text>
        </g>
      )}
      {today.highest && (
        <g>
          <circle cx={xOfNote(today.highest)} cy={kbY + KH + 8} r="6"
            fill="var(--accent)" stroke="var(--ink)" strokeWidth="1.5" />
          <text x={xOfNote(today.highest)} y={kbY + KH + 11} fontSize="9"
            textAnchor="middle" fontFamily="var(--scrawl)" fill="white">▲</text>
          <text x={xOfNote(today.highest)} y={kbY + KH + 24} fontSize="10"
            textAnchor="middle" fill="var(--accent)" fontFamily="var(--hand)" fontWeight="700">
            high {today.highest}
          </text>
        </g>
      )}
    </svg>
  );
}
