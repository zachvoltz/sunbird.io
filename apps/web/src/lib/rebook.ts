import type { BookingPublic } from "@sunbird/shared";

// Deep link that starts a fresh booking pre-pinned to the same coach and
// category as an existing booking. Lands the student straight on the
// "soonest times with {coach}" step (coachId pins the coach; the coach step is
// skipped), so re-booking a regular lesson is one tap. Falls back gracefully if
// either id is missing.
export function rebookHref(b: Pick<BookingPublic, "coach" | "category">): string {
  const params = new URLSearchParams();
  if (b.coach?.id) params.set("coachId", b.coach.id);
  if (b.category?.id) params.set("categoryId", b.category.id);
  const qs = params.toString();
  return qs ? `/book?${qs}` : "/book";
}
