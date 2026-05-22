export function WaveBars({ heights, color, played = 0 }: {
  heights: number[]; color?: string; played?: number;
}) {
  return (
    <div className="wave">
      {heights.map((h, i) => (
        <i key={i} style={{
          height: `${Math.max(6, h * 100)}%`,
          background: i / heights.length < played ? "var(--accent)" : (color || "var(--ink)"),
          opacity: i / heights.length < played ? 1 : 0.75,
        }}/>
      ))}
    </div>
  );
}

// Stable pseudo-random heights from a seed
export function waveHeights(seed: number, count = 40): number[] {
  let s = seed;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    s = (s * 9301 + 49297) % 233280;
    out.push(0.2 + (s / 233280) * 0.8);
  }
  return out;
}
