// Persists an in-progress booking across the Google OAuth full-page redirect.
// The inline email/password sign-in at the Confirm step never leaves the page,
// so it needs none of this — only the "Continue with Google" path does, since
// that navigates away to Google and back. We gate restoration on an explicit
// resume flag so a stale booking can never resurrect on a later fresh visit:
// only a booking we deliberately stashed right before the Google hop comes back.

import type { BookingState } from "./BookPage";

const KEY = "birdie_booking_resume";

// Fields refetched fresh on mount (categories, coaches) are dropped — we only
// stash the user's choices.
type Saved = Omit<BookingState, "categories" | "coaches">;

export function stashBookingForGoogle(state: BookingState): void {
  try {
    const { categories: _c, coaches: _co, ...rest } = state;
    sessionStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    /* ignore — worst case the student re-picks their slot */
  }
}

// Returns the stashed booking (and clears it) only when a resume is pending.
export function consumeBookingResume(): Partial<Saved> | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as Partial<Saved>;
  } catch {
    return null;
  }
}
