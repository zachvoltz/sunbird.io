// Sheet-music staff renderer (treble clef)

const NOTE_Y: Record<string, number> = {
  "E4": 40, "F4": 36, "G4": 32, "A4": 28, "B4": 24,
  "C5": 20, "D5": 16, "E5": 12, "F5": 8, "G5": 4, "A5": 0,
  "D4": 44, "C4": 48, "B3": 52, "A3": 56,
};

export type StaffNoteSpec = {
  pitch: string;
  dur: "q" | "h" | "e" | "w";
  acc?: "#" | "b";
  x?: number;
};

function StaffNote({ x, y, dur = "q", acc, stem = "up" }: {
  x: number; y: number; dur?: StaffNoteSpec["dur"]; acc?: StaffNoteSpec["acc"]; stem?: "up" | "down";
}) {
  const hollow = dur === "h" || dur === "w";
  const flag = dur === "e";
  const stemH = 32;
  const stemX = stem === "up" ? x + 6 : x - 6;
  const stemY1 = y;
  const stemY2 = stem === "up" ? y - stemH : y + stemH;
  return (
    <g>
      {acc && (
        <text x={x - 11} y={y + 4} fontSize="14" fontFamily="serif">
          {acc === "#" ? "♯" : "♭"}
        </text>
      )}
      <ellipse
        cx={x} cy={y} rx="6" ry="4.5" transform={`rotate(-20 ${x} ${y})`}
        fill={hollow ? "var(--paper)" : "var(--ink)"}
        stroke="var(--ink)" strokeWidth="1.5"
      />
      {dur !== "w" && (
        <line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2} stroke="var(--ink)" strokeWidth="1.5"/>
      )}
      {flag && (
        <path d={`M ${stemX} ${stemY2} q 8 4 5 14`} stroke="var(--ink)" strokeWidth="1.5" fill="none"/>
      )}
    </g>
  );
}

export function Staff({
  notes = [],
  width = 460,
  beats = 4,
  bar = 1,
  highlight,
}: {
  notes?: StaffNoteSpec[];
  width?: number;
  beats?: number;
  bar?: number;
  highlight?: [number, number];
}) {
  const top = 8;
  const h = 40;
  const startX = 56;
  const endX = width - 8;
  const step = (endX - startX) / Math.max(beats, 1);
  return (
    <svg viewBox={`0 0 ${width} 80`} width="100%" height="90" style={{ overflow: "visible" }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1="6" x2={width - 4} y1={top + i * 8} y2={top + i * 8} stroke="var(--ink)" strokeWidth="1"/>
      ))}
      <text x="10" y="38" fontSize="38" fontFamily="serif" fill="var(--ink)">𝄞</text>
      <text x="34" y="26" fontSize="14" fontFamily="serif" fontWeight="700">4</text>
      <text x="34" y="42" fontSize="14" fontFamily="serif" fontWeight="700">4</text>
      <text x="6" y="-2" fontSize="10" fill="var(--ink-faint)" fontFamily="var(--hand)">bar {bar}</text>
      {highlight && (
        <rect
          x={startX + highlight[0] * step - 4}
          y={top - 4}
          width={(highlight[1] - highlight[0]) * step + 8}
          height={h + 8}
          fill="var(--highlight)"
          opacity="0.55"
          rx="3"
        />
      )}
      {notes.map((n, i) => {
        const y = top + (NOTE_Y[n.pitch] ?? 20);
        const x = startX + (n.x ?? i) * step;
        return (
          <StaffNote
            key={i}
            x={x}
            y={y}
            dur={n.dur}
            acc={n.acc}
            stem={(NOTE_Y[n.pitch] ?? 0) > 20 ? "up" : "down"}
          />
        );
      })}
      <line x1={width - 4} y1={top} x2={width - 4} y2={top + h} stroke="var(--ink)" strokeWidth="2"/>
    </svg>
  );
}
