// Fretboard chord-diagram renderer, ported from the Chord Flash Cards
// wireframe's `chordSVG` generator. Draws a 6-string / 5-fret grid with the
// nut (or a base-fret marker), finger dots, optional barre, and open/muted
// markers above each string. Colours come from the app's paper design tokens
// so it sits alongside the rest of the practice UI.

import type { ChordShape } from "@sunbird/shared";

type ChartSize = "lg" | "sm";

// Mirror a shape left↔right for left-handed players. Reversing the string
// order (rather than CSS-flipping the whole SVG) keeps finger numbers and the
// base-fret label readable.
function mirrorShape(shape: ChordShape): ChordShape {
  const n = shape.fingering.length; // 6
  return {
    fingering: [...shape.fingering].reverse(),
    fingers: shape.fingers ? [...shape.fingers].reverse() : undefined,
    baseFret: shape.baseFret,
    barre: shape.barre
      ? { fret: shape.barre.fret, from: n - 1 - shape.barre.to, to: n - 1 - shape.barre.from }
      : undefined,
  };
}

export function ChordChart({
  shape: rawShape,
  size = "lg",
  mirror = false,
}: {
  shape: ChordShape;
  size?: ChartSize;
  mirror?: boolean;
}) {
  const shape = mirror ? mirrorShape(rawShape) : rawShape;
  const big = size !== "sm";
  const W = big ? 150 : 112;
  const H = big ? 188 : 140;
  const nS = 6; // strings
  const nF = 5; // frets shown
  const padX = big ? 20 : 16;
  const padTop = 34;
  const padBot = big ? 16 : 12;
  const gw = W - padX * 2;
  const gh = H - padTop - padBot;
  const sx = gw / (nS - 1);
  const fy = gh / nF;
  const X = (i: number) => padX + i * sx;
  const Y = (j: number) => padTop + j * fy;
  const base = shape.baseFret || 1;

  const ink = "var(--ink)";
  const inkSoft = "var(--ink-soft)";
  const inkFaint = "var(--ink-faint)";
  const paper = "var(--paper)";

  const barre = shape.barre;
  const dr = big ? 9 : 6.8;
  const my = padTop - 13; // y of the open/muted markers row

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      style={{ display: "block", overflow: "visible" }}
      role="img"
      aria-label="chord diagram"
    >
      {/* fret lines */}
      {Array.from({ length: nF + 1 }, (_, j) => (
        <line
          key={`h${j}`}
          x1={X(0)}
          y1={Y(j)}
          x2={X(5)}
          y2={Y(j)}
          stroke={inkSoft}
          strokeWidth={1.4}
        />
      ))}
      {/* strings */}
      {Array.from({ length: nS }, (_, i) => (
        <line
          key={`v${i}`}
          x1={X(i)}
          y1={Y(0)}
          x2={X(i)}
          y2={Y(nF)}
          stroke={inkSoft}
          strokeWidth={1.4}
        />
      ))}

      {/* nut (open position) or base-fret label */}
      {base === 1 ? (
        <rect x={X(0) - 1} y={padTop - 4.5} width={gw + 2} height={4.5} fill={ink} />
      ) : (
        <text
          x={X(0) - 8}
          y={Y(0) + fy * 0.65}
          fill={inkSoft}
          fontFamily="var(--ui, sans-serif)"
          fontSize={10}
          fontWeight={700}
          textAnchor="end"
          dominantBaseline="middle"
        >
          {base}fr
        </text>
      )}

      {/* barre */}
      {barre &&
        (() => {
          const cy = Y(barre.fret - base + 1) - fy / 2;
          const x1 = X(barre.from);
          const x2 = X(barre.to);
          const r = Math.min(sx * 0.42, big ? 9 : 7);
          return (
            <rect x={x1 - r} y={cy - r} width={x2 - x1 + 2 * r} height={2 * r} rx={r} fill={ink} />
          );
        })()}

      {/* per-string markers + finger dots */}
      {shape.fingering.map((v, i) => {
        const x = X(i);
        if (v === "x") {
          return (
            <text
              key={i}
              x={x}
              y={my}
              fill={inkFaint}
              fontSize={11}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              ×
            </text>
          );
        }
        if (v === 0) {
          return (
            <text
              key={i}
              x={x}
              y={my}
              fill={inkFaint}
              fontSize={11}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              ○
            </text>
          );
        }
        // Fretted note. Skip if the barre already covers it.
        if (barre && v === barre.fret && i >= barre.from && i <= barre.to) return null;
        const cy = Y(v - base + 1) - fy / 2;
        const finger = shape.fingers?.[i];
        return (
          <g key={i}>
            <circle cx={x} cy={cy} r={dr} fill={ink} />
            {finger && (
              <text
                x={x}
                y={cy + 0.5}
                fill={paper}
                fontFamily="var(--ui, sans-serif)"
                fontSize={big ? 11 : 9}
                fontWeight={700}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {finger}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Circular mastery ring with the percentage in the centre — the deck-picker
// and level-detail progress indicator from the wireframe.
export function MasteryRing({ pct, size = 34 }: { pct: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  const off = c * (1 - clamped / 100);
  return (
    <svg width={size} height={size} style={{ display: "block", flex: "none" }} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--paper-2)" strokeWidth={4} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2}
        y={size / 2 + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={9}
        fontWeight={800}
        fill="var(--ink-soft)"
        fontFamily="var(--ui, sans-serif)"
      >
        {clamped}
      </text>
    </svg>
  );
}
