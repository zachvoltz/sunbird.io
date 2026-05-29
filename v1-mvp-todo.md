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
- [ ] **Add a "student or coach?" step to the signup flow** — applies to both email/password and Google OAuth signup
  - [ ] Decide placement: pre-signup picker (role chosen before either auth method) vs. post-signup landing step that runs the first time a user has no role set yet
  - [ ] Persist the chosen role on the `User` record (`COACH` or `STUDENT`)
  - [ ] Pre-signup picker links: surface both "Sign up as a student" and "Sign up as a coach" entry points from the marketing/home page
  - [ ] Email/password signup: include role in the registration form payload
  - [ ] Google OAuth signup: today the callback creates a user with the schema default role (`auth.ts:264`) — change the flow so first-time Google users are sent to the role-picker step before being routed to a dashboard
  - [ ] Returning Google users (already have a role) should skip the picker and land on their dashboard as before
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
- [ ] Sanity-check timezone handling on availability across DST

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
- [~] Cancel / reschedule UI for student — **cancel** done (`MyBookings.tsx` → `PATCH /api/bookings/:id/cancel`, plus recurring-series cancel); **reschedule** still missing (no API or UI)

---

## 5. Payments (Stripe) — biggest gap

- [~] Schema has `stripePaymentId`, `stripeSubscriptionId`, `Subscription`, `SubscriptionPlan` — no integration code yet
- [ ] Pick Stripe approach: Checkout Sessions (fastest) vs. Payment Element (custom UI)
- [ ] Add Stripe SDK to `apps/api`; store keys in `.dev.vars` / Cloudflare secrets
- [ ] Coach onboarding: Stripe Connect (Express) so payouts go to the coach, not the platform
- [ ] One-time payment flow: create PaymentIntent on booking, confirm on client, mark booking paid on webhook
- [ ] Recurring payment flow: create Stripe Subscription on recurring booking, link to `RecurringSchedule`
- [ ] Webhook endpoint: `payment_intent.succeeded`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`
- [ ] Handle failed-payment state on the booking + notify coach + student
- [ ] Refund / cancel-subscription UI (coach side, at minimum)
- [ ] **Needs mockup:** Stripe Connect onboarding screen for coach, payment step in student booking flow, payment failure / retry states

---

## 6. Notifications (inbox + email)

- [x] Email: booking confirmation, booking cancellation, practice notes, password reset (Resend)
- [x] In-app inbox — coach and student inboxes rendered from real data
- [x] API: list / unread-count for inbox; unread tracked via `lastInboxViewedAt`
- [x] Inbox badge / unread count in left-nav (coach + student)
- [x] Inbox routed into the main app (no longer wireframe-only)
- [x] Booking created → coach inbox notification
- [ ] Generic `Notification` model audit — confirm whether the current implementation is generic enough to absorb the remaining triggers below, or if it's booking-specific and needs widening
- [ ] Remaining notification triggers for V1:
  - [ ] Booking cancelled / rescheduled → both sides
  - [ ] Payment failed → coach + student
  - [ ] New take submitted → coach
  - [ ] Coach added notes / replied on take → student
  - [ ] Upcoming lesson reminder (24h + 1h) → both sides
- [ ] Mark-read action (click an inbox row → marks individual notification read, not just the global `lastInboxViewedAt` watermark) — confirm whether this is needed for V1 or if watermark-only is acceptable

---

## 7. Video calls

- [x] Cloudflare Calls integration (`apps/api/src/services/calls.service.ts`)
- [x] Coach session page with embedded video (`apps/web/src/pages/teacher/Session.tsx`)
- [x] Student session page (recent commit: "Wrap student session page in left-nav")
- [ ] Pre-call check (mic/cam permissions, device picker) — **may need mockup**
- [ ] Reconnect / dropped-call handling
- [ ] "Join lesson" entry points from inbox + dashboard + calendar

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
- [ ] Wire library items + paths into the per-session `Assignment` UI — coach picks items from library to assign to a specific session
- [ ] Carry-over logic: when coach opens a new session, pre-populate exercises from the previous lesson for that student, with edit affordance
- [x] Notes visible to student after the lesson — dedicated student notes views render full `noteSections` (intro / scales & exercises / topics / song work / suggestions / next time) with `practiceNotes` fallback (`/my-notes`, `/my-notes/:bookingId` in `wireframe/pages/MyNotes.tsx`). Note: not yet surfaced on the in-session page (`StudentSession.tsx`)

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
