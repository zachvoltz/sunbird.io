export function Squiggle({ w = 60, color = "currentColor" }: { w?: number; color?: string }) {
  return (
    <svg width={w} height="8" viewBox="0 0 60 8" fill="none" style={{ display: "block" }}>
      <path
        d="M1 4 Q 6 1, 11 4 T 21 4 T 31 4 T 41 4 T 51 4 T 59 4"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
