import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export type AdjacentLesson = { id: string; startsAt: string } | null;
export type AdjacentLessons = { prev: AdjacentLesson; next: AdjacentLesson };

const EMPTY: AdjacentLessons = { prev: null, next: null };

// Previous/next lesson for the same coach+student pair (by start time), used to
// drive the Prev/Next buttons in the session-page header. Backed by
// GET /api/bookings/:id/adjacent, which works for both the student and coach.
export function useAdjacentLessons(bookingId: string | undefined): AdjacentLessons {
  const [adjacent, setAdjacent] = useState<AdjacentLessons>(EMPTY);
  useEffect(() => {
    if (!bookingId) {
      setAdjacent(EMPTY);
      return;
    }
    let cancelled = false;
    apiFetch<{ data: AdjacentLessons }>(`/api/bookings/${bookingId}/adjacent`)
      .then((r) => { if (!cancelled) setAdjacent(r.data); })
      .catch(() => { if (!cancelled) setAdjacent(EMPTY); });
    return () => { cancelled = true; };
  }, [bookingId]);
  return adjacent;
}
