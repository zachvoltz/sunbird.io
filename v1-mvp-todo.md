# Birdie — V1 MVP TODO

Status legend: `[x]` done · `[~]` partial / needs work · `[ ]` not started

Wireframe references:
- Student/practice flows: https://api.anthropic.com/v1/design/h/B3_pULTNtn88vMFKNBmAzg?open_file=Practice+Views+-+Wireframes+v2.html
- Teacher flows: https://api.anthropic.com/v1/design/h/wKfZvT9cQ37JXrYX9pQgJg?open_file=Teacher+Views+-+Wireframes.html

---

## 1. Auth (coach + student)

- [x] Email/password register, login, logout, session cookie
- [x] Password reset via email
- [x] Final pass on logout UX — "sign out" button in the topbar for both student (`STFrame.tsx`) and coach (`DTFrame.tsx`); coach also retains the Account-page logout
- [~] **Add a "student or coach?" step to the signup flow** — applies to both email/password and Google OAuth signup. Implemented as a **post-signup landing step** at `/onboarding/role` (`apps/web/src/pages/Onboarding.tsx`), gated by `AuthGate` for any authed user with `roleChosen = false`.
  - [x] Decide placement: **post-signup landing step** chosen. Added `User.roleChosen Boolean @default(false)` (schema + D1 migration `0023_add_role_chosen.sql`, existing users backfilled to true) as the "no role set yet" signal — schema previously had no unset state.
  - [x] Persist the chosen role on the `User` record (`COACH` or `STUDENT`) — `POST /api/me/role` (one-time; 409 on re-pick), wired to the picker buttons
  - [x] Email/password signup: lands on the picker (`Login.tsx` routes to `/onboarding/role` when `roleChosen` is false). Role chosen post-signup, not in the register payload.
  - [x] Google OAuth signup: callback now redirects first-time Google users to `/onboarding/role` before any dashboard (`auth.ts`); `AuthGate` is the safety net
  - [x] Returning Google users (already have a role / `roleChosen = true`) skip the picker and land on their dashboard as before
  - [ ] Surface "Sign up as a student" / "Sign up as a coach" entry points on the marketing/home page (optional polish — the post-signup picker covers the core flow)
- [ ] **Google sign-up / sign-in working end-to-end for both coaches and students** (must ship in V1)
  - [x] Backend OAuth start + callback wired (`/api/auth/oauth/google`, `/api/auth/oauth/google/cb`), arctic-based; links by email if user exists, otherwise creates user + sends welcome email
  - [x] "Continue with Google" button on Login page
  - [ ] Configure `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` in `.dev.vars` and Cloudflare secrets (prod)
  - [ ] Register dev + prod redirect URIs in the Google Cloud Console OAuth client
  - [ ] Surface "Continue with Google" on the coach signup path too (not just Login)
  - [ ] End-to-end test: new coach via Google, new student via Google, existing email/password user adding Google as a linked account

---

## 2. Coach: availability & pricing

- [x] Weekly recurring availability (`CoachAvailability`)
- [x] Date-specific busy blocks (`CoachBusy`)
- [x] Per-lesson-type pricing (`LessonType.pricePerSession`)
- [x] Recurring plan pricing data model (`SubscriptionPlan`)
- [ ] Coach UI to create/edit `SubscriptionPlan` rows (recurring price tiers) — **needs mockup**
- [x] Sanity-check timezone handling on availability across DST — audited every date/time site. **No DST drift bug**: the system is UTC-anchored end-to-end (availability "HH:MM" treated as UTC; slots built as `…THH:MM:00Z`; booking validation matches `getUTCDay()`/`getUTCHours()`; recurring advances by fixed ms on UTC timestamps, so occurrences don't slip across DST). Fixed one latent inconsistency: `availability.ts` listed slots using **local** `getDay()` + non-`Z` parse, which diverges from booking validation's UTC on a non-UTC dev server — now UTC throughout (`getUTCDay()`, `…Z`, UTC past/30-day bounds). Added `availability.test.ts` + a DST-safety comment on `generateScheduleDates`. **Known limitation (deferred, product decision):** no per-coach timezone — availability is implicitly UTC and emails hardcode `America/Chicago`; revisit if going multi-timezone/multi-coach.

---

## 3. Coach: profile & public booking link

- [x] Slug-based public profile (`/coaches/:slug`) with headline, long bio, credentials, social links, cover image
- [x] `isPublished` toggle
- [x] "Book a session" CTA wired from public profile into booking flow
- [x] Profile edit screen on `/coach/account` + public-page URL surfaced there
- [x] Account left column scrolls properly
- [x] QR code for the published public page on `/coach/profile` — shown once published, downloadable as a PNG (`qrcode` lib, client-side data URL)
- [ ] Confirm cover-image upload works end-to-end from the edit screen (R2 binding now exists — verify it's used here too)
- [ ] Add link to Ellisa's podcast on the public profile / site (per existing project memory)

---

## 4. Booking flow (student-facing)

- [x] Browse availability by category / lesson type
- [x] Browse availability by specific teacher (teacher page)
- [x] Multi-step booking UI (`apps/web/src/pages/book/*`)
- [x] One-time booking API (`POST /api/bookings`)
- [x] Recurring booking API — weekly / biweekly / monthly (`POST /api/bookings/recurring`, `RecurringSchedule` model)
- [x] Recurring booking UI — cadence picker (weekly / biweekly) + session-count preview in `StepConfirm.tsx`; monthly not yet exposed in UI
- [x] Confirmation screen post-booking (`pages/book/BookingSuccess.tsx`)
- [x] Cancel / reschedule UI for student — **cancel** done (`PATCH /api/bookings/:id/cancel`, plus recurring-series cancel); **reschedule** done: `PATCH /api/bookings/:id/reschedule` (same coach, re-validates the new slot via the shared `validateCoachSlot` helper + `GET /api/availability`; re-mirrors Google Calendar, notifies coach, emails student via `sendBookingReschedule`). UI is a date→time picker modal on the live `/my-bookings` (`MyBookingsPage.tsx` `RescheduleModal`). Tests in `booking-reschedule.test.ts`. Single occurrence only for recurring series.

---

## 5. Payments (Stripe) — biggest gap

- [x] Schema wired: added `User.sessionPrice`, `Booking.paymentStatus`, `RecurringSchedule.stripeSubscriptionId`/`paymentStatus` (D1 migration `0025_add_payments.sql`)
- [x] **Decision:** Stripe-only for V1 · hosted **Checkout Sessions** (no in-app card UI) · flat per-coach **session rate** (`User.sessionPrice`, cents). Square abstraction + `SubscriptionPlan` monthly tiers deferred (mockup-blocked).
- [~] Add Stripe SDK to `apps/api` — `stripe` dep + `lib/stripe.ts` present and used; still need `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` in `.dev.vars` / Cloudflare secrets (declared in Bindings + `.env.example`)
- [x] Coach onboarding: Stripe Connect (Express) — `routes/coach-payments.ts`; added `PATCH /rate` + a session-rate editor in `Payments.tsx`
- [x] One-time payment flow: hosted Checkout (destination charge) on `POST /api/bookings` when the coach charges; booking `PENDING` → `PAID` via webhook; free path unchanged. Client redirects from `StepConfirm.tsx`.
- [x] Recurring payment flow: `POST /api/bookings/recurring` opens a subscription Checkout (session rate × cadence) and **defers** booking creation; webhook activates the schedule + creates bookings, stores `stripeSubscriptionId`
- [x] Webhook endpoint `POST /api/webhooks/stripe` (`routes/payments.ts`, async signature verify) → pure `handleStripeEvent`: `checkout.session.completed` (payment + subscription), `checkout.session.expired`, `invoice.payment_failed`, `customer.subscription.deleted`
- [x] Handle failed-payment state on the booking + notify coach + student — expired checkout → `FAILED`/cancelled + notify both; subscription failure → schedule `PAST_DUE` + notify both (reuses §6 plumbing, new `sendPaymentFailed` email)
- [~] Refund / cancel-subscription — **cancel-subscription** done (cancel-series cancels the Stripe subscription); refund UI still deferred (mockup)
- [ ] **Needs mockup:** payment step polish, payment failure / retry screens, refund UI (hosted Checkout removed the booking-flow + onboarding mockup blockers)
- Tests: `payments.test.ts` (free path), `stripe-events.test.ts` (handler). Live Checkout/webhook need the Stripe CLI (`stripe listen`) + test keys — can't run under plain Node dev.

### 5b. Multi-provider: Square as a Stripe alternative (let coaches pick)

Est. **~1.5–3 weeks marginal** on top of building Stripe's payment flows. Most cost is the second client checkout + subscriptions + webhooks; onboarding parity + the abstraction layer is the small part (~2–4 days). Decide *before* building Stripe checkout — the abstraction is cheap up front, expensive to retrofit.

- [ ] **Spike first (½ day):** verify the `square` npm SDK runs on the Cloudflare Workers runtime (`nodejs_compat`); if not, plan to call Square's REST API via `fetch`. This is the biggest unknown.
- [ ] Provider abstraction layer: an interface (`onboardingLink`, `createCheckout`, `createSubscription`, `verifyWebhook`) with Stripe + Square implementations; refactor `coach-payments.ts` to dispatch on the coach's chosen provider instead of calling `stripe.*` directly
- [ ] Schema generalization (D1 migration, dev + prod): `paymentProvider` per coach + provider-neutral / Square-specific IDs (`squareMerchantId`, `squareLocationId`, OAuth token, etc.) alongside the existing `stripe*` columns
- [ ] Square onboarding via **OAuth** (store coach access token + merchant/location) — different model than Stripe Connect account-links, not a drop-in
- [ ] Square one-time payments: **Web Payments SDK** card tokenization in the browser → create payment server-side → confirm via webhook
- [ ] Square subscriptions: Catalog + Subscriptions API (diverges most from Stripe; highest effort/uncertainty)
- [ ] Square webhook endpoint + signature verification (separate from Stripe's)
- [ ] Coach UI: provider chooser on `/coach/payments`; student checkout branches on the coach's provider (Square Web Payments card form vs Stripe)
- [ ] End-to-end test in **both** Stripe and Square sandboxes (onboarding, one-time, recurring, failed payment, refund)

---

## 6. Notifications (inbox + email)

- [x] Email: booking confirmation, booking cancellation, practice notes, password reset (Resend)
- [x] In-app inbox — coach and student inboxes rendered from real data
- [x] API: list / unread-count for inbox; unread tracked via `lastInboxViewedAt`
- [x] Inbox badge / unread count in left-nav (coach + student)
- [x] Inbox routed into the main app (no longer wireframe-only)
- [x] Booking created → coach inbox notification
- [x] Generic `Notification` model audit — the booking-scoped `SessionMessage` model is generic enough: a message with `senderId = X` lands in the inbox of the booking's *other* participant, so "notify the other party" = `notifyOtherParty(db, { bookingId, senderId: actingUserId, content })` (`bookings.ts`). No new model needed.
- [x] Student inbox list — `GET /api/me/inbox` + real message list rendered in `MyInbox.tsx` (mirrors coach `Inbox.tsx`, per-item read toggles). Previously count-only.
- [~] Remaining notification triggers for V1:
  - [x] Booking cancelled / rescheduled → both sides — cancel + reschedule now notify the non-actor in-app (`notifyOtherParty`) and email the non-actor / both sides
  - [ ] Payment failed → coach + student — deferred (payments not built yet, §5)
  - [x] New take submitted → coach — `POST /api/me/takes` drops a coach inbox message + emails the coach (`sendNewTakeToCoach`)
  - [x] Coach replied on take → student — new `POST /api/coaches/takes/:takeId/reply` (creates `TakeReply`, marks take `REPLIED`) notifies the student inbox + emails (`sendTakeReply`). Annotations endpoint still TODO (§9).
  - [x] Upcoming lesson reminder (24h + 1h) → both sides — `processLessonReminders` (`lib/reminders.ts`, idempotent via `Booking.remindedAt24h/1h`), driven by a Cloudflare cron in `src/worker.ts` (`*/15 * * * *`). Cron only fires in the deployed Worker; logic is unit-tested.
- [x] Mark-read action (click an inbox row → marks individual notification read, not just the global `lastInboxViewedAt` watermark) — per-item read receipts via `SessionMessageRead`; `POST`/`DELETE /api/coaches/inbox/:messageId/read` toggles, wired to the inbox row checkbox in `Inbox.tsx`

---

## 7. Video calls

- [x] Cloudflare Calls integration (`apps/api/src/services/calls.service.ts`)
- [x] Coach session page with embedded video (`apps/web/src/pages/teacher/Session.tsx`)
- [x] Student session page (recent commit: "Wrap student session page in left-nav")
- [ ] Pre-call check (mic/cam permissions, device picker) — **deferred, needs mockup**
- [x] Reconnect / dropped-call handling — `useCallsSession.ts` now watches the push connection after connect; on a drop it rebuilds the push session (reusing the existing media, fresh CF session via the server's 410/425 retry) with capped exponential backoff and a `reconnecting` UI banner in `VideoCall.tsx`, giving up to a `Connection lost` error after ~5 attempts. The pull loop stays alive for the call and re-pulls if the remote drops (peer reconnect). Also fixed the latent error-state "Try again" no-op (join guard). Frontend-only; no backend change. Not auto-testable (WebRTC).
- [x] "Join lesson" entry points — already present: explicit "join call ↗" buttons on the student dashboard (`TodayPage.tsx`) + `MyBookingsPage.tsx` and coach dashboard (`Roster.tsx`) for live ONLINE lessons; coach `Calendar.tsx` rows + inbox rows link into the session page where the call mounts.

---

## 8. Coach session tools: notes + exercises

- [x] Structured note sections (intro, scales/exercises, topics, song work, next time)
- [x] Notes emailed to student via Resend
- [x] Note read receipts + voice memos
- [x] `Assignment` data model (warmups / exercises / songs, per booking, per student)
- [x] Coach Library: persisted exercise items (Exercises tab) with inline edit/delete, horizontal filter strip
- [x] Audio upload + playback on library items (R2 bucket bound)
- [x] Library item editor simplified: dropped BPM/MIDI, renamed subtitle → notes
- [x] Paths: Khan-style lesson trees inside the Library, persisted, with "+ add lesson" affordance in both the path editor and tree canvas
- [x] Wire library items + paths into the per-session assignment UI
  - **Library items** were already wired via the routine system: the coach session Follow-up tab's editable `CurrentRoutine` includes a `LibraryPicker` (search/pick warmups·exercises·songs, drag-reorder, per-step notes) saved to `User.currentRoutine` + snapshotted to `Booking.routineSnapshot`.
  - **Paths**: added path assignment end-to-end — `POST/PATCH/DELETE /api/paths/:slug/assign[/:studentId]` (enroll / advance current lesson / unenroll, `firstLessonId` on enroll) + `GET /api/me/paths`. Coach assigns/advances/removes from a "students on path" panel in the path editor (`Paths.tsx`); students see their path + `lesson X of N` progress in `MyCurriculumHub.tsx`. Tests in `path-assignment.test.ts`.
- [x] Carry-over logic — satisfied implicitly by the routine model: `User.currentRoutine` is global per-student, so opening the next session's Follow-up pre-populates with last session's routine, fully editable (no per-session copy needed). The orphaned per-week `Assignment` table is superseded by the routine system.
- [x] Notes visible to student after the lesson — dedicated student notes views render full `noteSections` (intro / scales & exercises / topics / song work / suggestions / next time) with `practiceNotes` fallback (`/my-notes`, `/my-notes/:bookingId` in `wireframe/pages/MyNotes.tsx`). Also surfaced on the in-session page via the `NoteRecap` component in the Upcoming + Follow-up phases (`StudentSession.tsx`)

---

## 9. Takes (audio submissions) + coach review

- [x] `Take` model, `POST /api/me/takes`, audio storage
- [x] `TakeAnnotation` + `TakeReply` data model
- [x] Coach take-review wireframe with annotations (LOVE / WATCH / TRY_THIS)
- [x] Student record-take wireframe
- [x] Move record-take UI into main student app routing (`/practice/record/:assignmentId` → `RecordTakePage`)
- [x] Move coach take-review UI into main coach app routing (`/coach/takes/:takeId` → `TakeReviewPage`)
- [ ] Student "take history" view per lesson — **confirm mockup covers this**
- [x] Audio storage backend: R2 bucket bound (proven on library audio) — reuse for takes
- [ ] Confirm take audio max length + file size limits, error states on oversize uploads
- [ ] Notification on new take (see §6)

---

## 10. Student practice experience

- [x] `Assignment` model + `GET /api/me/student-data` returns assignments
- [x] `PracticeStreak` model
- [x] Practice-path wireframe (`apps/web/src/wireframe/pages/PracticePath.tsx`)
- [x] Exercise player wireframe
- [x] Calendar wireframe (`apps/web/src/wireframe/pages/Calendar.tsx`)
- [x] Move PracticePath into main routing — `/practice` → `PracticePathPage`
- [x] Move ExercisePlayer into main routing — `/practice/exercise/:assignmentId` → `ExercisePlayerPage`
- [ ] Move Calendar into main routing; ensure it pulls real `PracticeStreak` + completed-assignment data — Calendar is currently routed for the **coach** only (`/coach/calendar`, pulls bookings/availability); a **student** calendar wired to `PracticeStreak`/assignment data is still missing
- [ ] "Mark practiced" action on exercises → updates streak + calendar
- [x] Confirm exercises shown on PracticePath are pulled from the **latest** lesson's assignment set — PracticePath prefers the coach-set `routine` (source of truth), falling back to current-week assignments (`PracticePath.tsx:227-237`)

---

## 11. Left-nav / shell / dashboards

- [x] Left-nav for coach (with live inbox unread badge)
- [x] Left-nav for student (incl. student session page recently wrapped, with inbox unread badge)
- [x] Live-ticking clocks on dashboards
- [x] Topbar search wired for both coach and student
- [x] Calendar (not Today) highlighted on the coach session page nav
- [x] Coach dashboard: today's lessons, takes awaiting review, missing-notes/plan gaps (`/coach` Roster via `useCoachDashboard`)
- [x] Student dashboard: today's/next lesson, this week's practice, streak, takes submitted/unreviewed (`/today` TodayPage via `useMyStudentDetail` + `/api/bookings`)
- [ ] **Needs mockup confirmation:** final dashboard layouts for both roles

---

## 12. Pre-launch polish

- [ ] Empty states for: no bookings, no takes, no assignments, empty inbox
- [ ] Loading / error states across the app
- [ ] Mobile responsiveness pass on booking flow, session page, practice path, calendar
- [ ] Transactional email templates branded (currently functional, may need design pass) — **needs mockup**
- [ ] Terms of service + privacy policy pages (required for Stripe Connect onboarding)
- [ ] Production env: Cloudflare secrets for Resend, Stripe, Calls; D1 prod database; domain + SSL
- [ ] Basic analytics / error reporting (Sentry?)

---

## Items that need mockups before they can be built

1. Stripe Connect coach onboarding
2. Payment step inside student booking flow (one-time + recurring)
3. Payment failure / retry / past-due states
4. Coach UI for creating/editing recurring `SubscriptionPlan` tiers
5. Pre-call device-check screen
6. Branded transactional email templates
7. Final coach + student dashboard layouts
8. Confirmation of student "take history" view layout
