import { useEffect, useState } from "react";

/**
 * Re-renders on a ticking interval so time-sensitive displays (clocks,
 * countdowns, "live now" detection) stay current without a manual refresh.
 *
 * Default 15 s — fine for minute-resolution UI without burning cycles.
 */
export function useNow(intervalMs = 15_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    // Also tick once immediately so we don't have to wait `intervalMs` for the
    // first update after mount (helps SSR-hydrated or stale-after-blur cases).
    setNow(new Date());
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}
