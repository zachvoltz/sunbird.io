# Sunbird — Music Lessons Platform Development Roadmap

Sunbird is a webapp/PWA that connects students with music teachers for lessons, workshops, and community engagement. The platform supports three roles — **admin**, **teacher**, and **student** — and launches with a single teacher (Ellisa Sun), with the architecture designed to scale to many teachers over time.

---

## Roles & Permissions

| Role | Description |
|------|-------------|
| **Admin** | Full platform control. Manages teachers, lesson types, workshops, events, and moderation. Can do everything a teacher can. |
| **Teacher** | Sets their own availability calendar, views/manages their bookings, communicates with students via lesson comment feeds, marks lesson progress. |
| **Student** | Signs up (Google OAuth or email/password), browses teachers and lesson types, requests one-off or recurring lesson schedules, views upcoming/past lessons on a calendar, participates in the community song feed, gives feedback on songs. |

---

## Phase 0 — Project Scaffolding & Tooling (Days 1–3)

**Goal:** Establish the monorepo, CI pipeline, and local development environment so all subsequent work lands on solid ground.

### Tasks

- [x] **0.1 — Initialize Turborepo monorepo**
  Create root `package.json`, `turbo.json`, `tsconfig.base.json`. Set up `apps/web`, `apps/api`, `packages/db`, `packages/shared` workspaces.
  _AC: `turbo build` succeeds with empty apps._

- [x] **0.2 — Scaffold React + Vite app (`apps/web`)**
  Vite with React + TypeScript template. Install Tailwind CSS 4, PostCSS. Configure path aliases (`@/`).
  _AC: `pnpm dev` serves a blank page at `localhost:5173`._

- [x] **0.3 — Scaffold Hono API (`apps/api`)**
  Hono with Cloudflare Workers adapter. Add `wrangler.toml`. Configure TypeScript.
  _AC: `wrangler dev` responds to `GET /api/health` with `200 OK`._

- [x] **0.4 — Set up Prisma (`packages/db`)**
  Initialize Prisma with the full schema. Configure for SQLite (D1) initially. Export typed client from `packages/db/index.ts`.
  _AC: `prisma generate` succeeds; types importable from `@ellisa/db`._

- [x] **0.5 — Set up shared package (`packages/shared`)**
  Create Zod validation schemas for common entities (user registration, contact form, booking). Export shared TypeScript types.
  _AC: Types and validators importable from `@ellisa/shared`._

- [x] **0.6 — Configure linting & formatting**
  ESLint (flat config), Prettier, `lint-staged` + Husky pre-commit hook.
  _AC: `turbo lint` passes on all workspaces._

- [x] **0.7 — Set up CI pipeline**
  GitHub Actions workflow: install, lint, typecheck, test, build on push/PR to `main`.
  _AC: Pipeline runs green on an empty commit._

- [x] **0.8 — Configure Cloudflare deployment**
  Cloudflare Pages for `apps/web` (build output `dist/`). Workers deployment for `apps/api`. Preview deployments on PRs.
  _AC: Pushing to `main` triggers auto-deploy; PR branches get preview URLs._

- [x] **0.9 — Set up environment variables**
  Document all required env vars (`DATABASE_URL`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `R2_*`, `SESSION_SECRET`). Create `.env.example`. Configure Wrangler secrets for production.
  _AC: `.env.example` is complete; local dev runs with `.env` file._

### Key Decisions

- **Package manager:** pnpm (workspace support, fast installs, strict by default).
- **Database for local dev:** SQLite file via Prisma. Production will use D1 or Neon — defer that decision until Phase 2 when we need real persistence.
- **Testing:** Vitest for unit/integration tests across all workspaces. Playwright for E2E (added in Phase 2).

---

## Phase 1 — Design System & Public Pages (Weeks 1–4)

**Goal:** Deliver the public-facing pages: Home (platform landing), About, Lessons, Pricing, Contact. Nail the visual design and establish the PWA shell so it can be reused in every subsequent phase.

### 1A — Design System Foundation (Week 1)

- [x] **1A.1 — Tailwind theme configuration**
  Define custom colors (`cream`, `charcoal`, `gold`, `sage`, `coral`), fonts (Playfair Display, Inter, Caveat), spacing scale, border-radius tokens, shadow tokens in `tailwind.config.ts`.
  _AC: All design plan colors/fonts available as Tailwind utilities._

- [x] **1A.2 — Font loading**
  Self-host Playfair Display, Inter, and Caveat via `@fontsource` packages or manual WOFF2 files. Preload critical fonts in `index.html`.
  _AC: Fonts render correctly; no FOUT on fast connections; LCP unaffected._

- [x] **1A.3 — Base component library**
  Build atomic components: `Button` (primary/ghost/outline variants), `Card`, `Badge`, `Input`, `Textarea`, `Select`, `Label`, `SectionHeading`, `Container`, `Divider`.
  _AC: Each component accepts standard props, renders per design spec._

- [x] **1A.4 — Layout shell**
  `Header` (sticky, scroll-aware background transition, responsive hamburger menu), `Footer` (4-column desktop, stacked mobile), `PageLayout` wrapper with max-width and padding.
  _AC: Header/footer match design plan specs at all 3 breakpoints._

- [x] **1A.5 — Icon setup**
  Install Lucide React. Create an `Icon` wrapper if needed for consistent sizing/stroke.
  _AC: Icons render at correct weight (1.5px stroke)._

- [x] **1A.6 — Texture & imagery setup**
  Add subtle paper-grain background texture as a CSS utility class. Set up responsive image component with `loading="lazy"` and Cloudflare Image Resizing URL helper.
  _AC: Texture visible at low opacity on section backgrounds._

- [ ] **1A.7 — PWA shell**
  Add `manifest.json` with app name, icons, theme color, and `display: standalone`. Register a basic service worker for offline shell and asset caching.
  _AC: App is installable on mobile/desktop. Offline shows branded "you're offline" page._

### 1B — Client-Side Routing & Page Shells (Week 1–2)

- [x] **1B.1 — Install React Router (or TanStack Router)**
  Configure client-side routing with code-split routes for all pages in the sitemap.
  _AC: Navigation between routes works; browser back/forward works; 404 page exists._

- [ ] **1B.2 — SEO meta tags**
  Install `react-helmet-async` (or equivalent). Create a `PageMeta` component that sets `<title>`, `<meta description>`, OG tags per page.
  _AC: Each page has unique, descriptive meta tags. View source confirms correct tags._

- [x] **1B.3 — Scroll behavior**
  Scroll to top on route change. Smooth scroll for anchor links.
  _AC: Navigating to a new page starts at the top._

### 1C — Public Pages (Weeks 2–4)

- [x] **1C.1 — Home page**
  Platform landing page: hero section, value proposition, lesson type cards, featured teacher spotlight (Ellisa), community teaser, testimonials placeholder, CTA to sign up.
  _AC: Page matches design plan layout. All CTAs navigate correctly. Responsive at all breakpoints._

- [ ] **1C.2 — About page**
  Platform mission, teacher spotlight section (initially Ellisa: hero image, bio, pull quote, credentials). Designed to accommodate multiple teacher profiles in the future.
  _AC: Content renders with correct typography hierarchy._

- [x] **1C.3 — Lessons index page**
  Intro paragraph + lesson type cards (Voice, Songwriting, Performance, Theory, Poetry in Song). Cards link to individual lesson pages.
  _AC: Cards display correctly in staggered layout. Hover states work._

- [x] **1C.4 — Individual lesson pages**
  Template component for `/lessons/[slug]`. Sections: hero banner, "What You'll Explore", "Who This Is For", "What a Session Looks Like", pricing summary, "Book a Lesson" CTA.
  _AC: All 5 lesson pages render from the same template with different content._

- [ ] **1C.5 — Pricing page**
  Per-session and subscription pricing cards, workshop pricing section, FAQ accordion. Pricing shown per lesson type.
  _AC: Pricing displays clearly. FAQ items expand/collapse._

- [ ] **1C.6 — Contact page**
  Two-column layout: message + form (name, email, subject dropdown, message body, submit). Social links below.
  _AC: Form validates client-side (Zod). Submission hits API (wired in 1D)._

- [x] **1C.7 — Workshops page (static shell)**
  Card layout for upcoming workshops. "Sign up" buttons present but gated behind auth (Phase 2). Use placeholder data.
  _AC: Cards render with date, title, duration, description, CTA._

- [ ] **1C.8 — Events page (static shell)**
  Card layout with "Free" badge. RSVP inline form (name + email). Use placeholder data.
  _AC: Cards render. Inline RSVP form validates._

### 1D — Contact Form API (Week 3–4)

- [ ] **1D.1 — `POST /api/contact` endpoint**
  Hono route that validates request body (Zod), stores `ContactMessage` in DB, returns 201.
  _AC: Invalid submissions return 400 with field errors. Valid submissions persist to DB._

- [ ] **1D.2 — Contact email notification**
  On submission, send email to admin via Resend with the message details.
  _AC: Admin receives an email for each contact form submission._

- [ ] **1D.3 — Wire frontend to API**
  Connect contact form `onSubmit` to the API. Show success/error feedback with appropriate UI states.
  _AC: User sees success message after submission. Errors display inline._

- [ ] **1D.4 — Rate limiting**
  Add IP-based rate limiting middleware to the contact endpoint (e.g., 5 requests per minute).
  _AC: Excessive submissions return 429._

### 1E — Deployment & QA (Week 4)

- [ ] **1E.1 — Content pass**
  Replace all placeholder text with real copy. Replace placeholder images with real photography.
  _AC: No lorem ipsum or stock photos remain._

- [ ] **1E.2 — Responsive QA**
  Test all pages at mobile (375px), tablet (768px), desktop (1440px). Fix layout issues.
  _AC: No horizontal overflow, no overlapping text, all elements reachable._

- [ ] **1E.3 — Accessibility audit**
  Run axe-core; check keyboard navigation, focus rings, color contrast, alt text, labels, ARIA landmarks.
  _AC: Zero critical or serious axe violations. Full keyboard navigation works._

- [ ] **1E.4 — Performance audit**
  Run Lighthouse. Optimize images, lazy-load below-fold content, check bundle size.
  _AC: Lighthouse Performance > 95, initial JS < 150KB gzip._

- [ ] **1E.5 — Generate sitemap.xml and robots.txt**
  Static generation or build-time script that outputs `sitemap.xml` with all public URLs and a permissive `robots.txt`.
  _AC: Files served at `/sitemap.xml` and `/robots.txt`._

- [ ] **1E.6 — Structured data**
  Add JSON-LD for `MusicSchool` / `Organization` on home, `Course` on each lesson page.
  _AC: Google Rich Results Test validates the structured data._

### Phase 1 Deliverable
A fully deployed, responsive public-facing PWA shell with landing pages, lesson listings, and contact form. Everything a visitor needs to understand the platform — but no accounts, payments, or community features yet.

---

## Phase 2 — Authentication, Roles & Booking (Weeks 5–8)

**Goal:** Students can create accounts, browse teachers, request one-off or recurring lesson schedules, and manage bookings. Teachers can set their availability calendar. Role-based access (admin/teacher/student) enforced throughout.

### 2A — Authentication (Week 5–6)

- [x] **2A.1 — Auth library setup**
  Install and configure Lucia Auth (or Auth.js). Set up session table, cookie configuration (`HttpOnly`, `Secure`, `SameSite=Lax`), 30-day sliding expiry.
  _AC: Auth middleware runs on every request; session cookie set/validated correctly._

- [x] **2A.2 — Registration endpoint**
  `POST /api/auth/register` — validate input (Zod), hash password (Argon2 via `@node-rs/argon2`), create `User` with `STUDENT` role + `Session`, return session cookie.
  _AC: Duplicate email returns 409. Weak password returns 400. Valid registration sets cookie and returns user with role._

- [x] **2A.3 — Login endpoint**
  `POST /api/auth/login` — validate credentials, create session.
  _AC: Wrong password returns 401. Successful login sets session cookie._

- [x] **2A.4 — Logout endpoint**
  `POST /api/auth/logout` — invalidate session, clear cookie.
  _AC: Cookie cleared; subsequent requests are unauthenticated._

- [x] **2A.5 — Google OAuth**
  `GET /api/auth/oauth/google` (redirect) + `GET /api/auth/oauth/google/cb` (callback). Upsert `OAuthAccount` + `User`. New OAuth users default to `STUDENT` role.
  _AC: Full OAuth flow works end-to-end. Returning Google users log in without creating duplicate accounts._

- [x] **2A.6 — Password reset flow**
  `POST /api/auth/forgot-password` sends reset email with tokenized link. `POST /api/auth/reset-password` validates token, updates password.
  _AC: Reset email sent. Token expires after 1 hour. Password successfully changed._

- [x] **2A.7 — Auth & role middleware**
  Hono middleware that reads session cookie, loads user + role, attaches to context (`c.var.user`). Export `requireAuth`, `requireRole('TEACHER')`, `requireRole('ADMIN')` middleware.
  _AC: Protected routes return 401 without valid session. Role-restricted routes return 403 for wrong role. User object with role available in route handlers._

- [x] **2A.8 — Login/Register UI**
  `/login` page with tab toggle (Sign In / Create Account). Form validation. Google OAuth button. Redirect to `?redirect` param after login.
  _AC: Forms validate. Auth works end-to-end. Redirect works._

- [x] **2A.9 — Auth state in frontend**
  React context/hook (`useAuth`) that fetches `GET /api/me` on mount. Provides `user`, `role`, `isAuthenticated`, `login`, `logout`, `register` methods.
  _AC: Components can conditionally render based on auth state and role. Header shows avatar when logged in._

- [x] **2A.10 — Auth gate component**
  `<AuthGate>` wrapper that redirects to `/login?redirect=current-path` if not authenticated. `<RoleGate role="TEACHER">` for role-restricted sections.
  _AC: Unauthenticated users get redirected to login and back. Wrong-role users see an appropriate message._

- [ ] **2A.11 — Welcome email**
  Trigger welcome email via Resend on registration.
  _AC: New users receive a welcome email._

### 2B — Teacher Availability (Week 6–7)

- [ ] **2B.1 — Teacher profile & onboarding**
  Admin can invite/create teacher accounts (`POST /api/admin/teachers`). Teacher profile includes name, bio, avatar, specialties, and lesson types they teach.
  _AC: Admin can create teacher accounts. Teachers appear on the platform with their profile._

- [x] **2B.2 — Teacher availability calendar**
  `/teacher/availability` — teachers set their bookable time slots on a weekly calendar. CRUD API at `POST /api/teacher/availability`. Supports recurring weekly slots and one-off overrides (blocked dates).
  _AC: Teacher can set recurring weekly availability. Can block specific dates. Non-teacher gets 403._

- [x] **2B.3 — Available slots endpoint**
  `GET /api/availability?date=YYYY-MM-DD&lessonType=voice&teacherId=X` — returns available time slots for a given date by cross-referencing teacher's `AvailabilitySlot` with existing `Booking` records.
  _AC: Only genuinely open slots returned. Booked slots excluded. Filters by teacher and lesson type._

### 2C — Booking System (Week 6–8)

- [ ] **2C.1 — Stripe integration setup**
  Install `stripe` SDK. Configure webhook endpoint `POST /api/webhooks/stripe` with signature verification. Set up Stripe products/prices for each lesson type.
  _AC: Webhook endpoint verifies Stripe signatures. Test events processed correctly._

- [x] **2C.2 — Request a lesson (one-off)**
  `POST /api/bookings` — student selects a teacher, lesson type, date/time. Creates Stripe Checkout Session, returns checkout URL. On `checkout.session.completed` webhook, creates `Booking` record with `CONFIRMED` status.
  _AC: Double-booking prevented (race condition handled with DB constraint). Booking created only after payment succeeds._

- [ ] **2C.3 — Request a recurring schedule**
  `POST /api/bookings/recurring` — student requests a recurring lesson schedule (e.g., weekly on Tuesdays at 4pm with Teacher X). Creates a `RecurringSchedule` record. Generates upcoming `Booking` records for the next N weeks. Payment handled per-session or via subscription.
  _AC: Recurring bookings generated correctly. Teacher can see the recurring pattern. Student can cancel the series or individual sessions._

- [x] **2C.4 — Booking confirmation email**
  On booking creation, send confirmation email with date, time, lesson type, teacher name, and calendar invite (`.ics` attachment).
  _AC: User receives email with correct details and downloadable calendar event._

- [x] **2C.5 — Cancel booking endpoint**
  `PATCH /api/bookings/:id/cancel` — sets status to `CANCELLED`. Implement cancellation policy (e.g., free cancellation 24h+ before; no refund within 24h).
  _AC: Cancellation within policy gets refund via Stripe. Late cancellation marked but no refund._

- [x] **2C.6 — Booking flow UI**
  `/book` page with multi-step flow: (1) select lesson type, (2) select teacher (initially just Ellisa), (3) pick date/time from teacher's availability calendar, (4) choose one-off or recurring, (5) confirm & pay (redirects to Stripe Checkout).
  _AC: Full flow works end-to-end. Calendar shows only available dates for selected teacher. Time slots update based on selected date._

- [x] **2C.7 — Booking confirmation page**
  Success page after Stripe redirect with booking summary, teacher info, and "Add to Calendar" button.
  _AC: Shows correct booking details. Calendar download works._

- [x] **2C.8 — Calendar component**
  Date picker that highlights available days for the selected teacher. Fetches availability on month change. Disabled past dates.
  _AC: Available days visually distinct. Selecting a day loads time slots. Mobile-friendly._

### 2D — Lesson Communication (Week 7)

- [x] **2D.1 — Lesson comment feed API**
  `GET /api/bookings/:id/comments` and `POST /api/bookings/:id/comments` — threaded comment feed attached to each booking. Only the student and assigned teacher can read/write.
  _AC: Comments persist and display in chronological order. Unauthorized users get 403._

- [x] **2D.2 — Lesson comment feed UI**
  On the booking detail page, show a comment thread between student and teacher. Supports text messages. Teacher and student can post before/after the lesson.
  _AC: Messages appear in real-time-ish (polling or optimistic updates). Clean, chat-like UI._

- [ ] **2D.3 — Comment notification emails**
  When a new comment is posted on a booking, email the other party (student or teacher).
  _AC: Notification sent. Respects notification preferences._

### 2D+ — Post-Session Forms (Week 7–8)

- [ ] **2D+.1 — Structured session notes schema**
  Add `improvementNotes` and `nextGoalNotes` columns to Booking (alongside existing `practiceNotes`). Update validators and types.
  _AC: Three separate note fields stored per booking. Existing practiceNotes data preserved._

- [ ] **2D+.2 — Coach post-session form on Session page**
  When a booking is completed, show a 3-field form on the Session page: Practice Notes (required), Improvement Notes (optional), Next Goal (optional). "Mark Complete" button for past CONFIRMED sessions. Notes display read-only after sending.
  _AC: Coach can complete a session and send structured notes from the Session page. Notes emailed to student with 3 labeled sections._

- [ ] **2D+.3 — Upgrade Dashboard notes form**
  Update the Dashboard inline notes form from a single textarea to 3 fields matching the Session page.
  _AC: Dashboard and Session page both use the same 3-field notes structure._

- [ ] **2D+.4 — Student post-session notes display**
  Show the 3 structured note sections on the Student Session page and MyBookings past section.
  _AC: Students see labeled Practice Notes, Improvement Notes, and Next Goal on completed sessions._

- [ ] **2D+.5 — Student "schedule next" prompt**
  On completed sessions, prompt the student to book their next lesson with a CTA linking to `/book?lessonTypeId=xxx`. Pre-select lesson type in the booking flow.
  _AC: Student sees "Ready for your next session?" on completed bookings. Link pre-fills lesson type._

### 2D++ — Video & Location Integration (Week 7–8)

- [x] **2D++.1 — Schema: booking mode, meeting fields, coach address, OAuth tokens**
  Add `mode` (ONLINE/IN_PERSON), `meetingUrl`, `meetingId`, `meetingProvider` to Booking. Add `sessionAddress` to User. Extend OAuthAccount with `accessToken`, `refreshToken`, `accessTokenExpiresAt`, `scopes`.
  _AC: Migration runs cleanly. Existing bookings default to IN_PERSON._

- [x] **2D++.2 — Zoom OAuth for coaches**
  Coach settings page at `/coach/settings` with Zoom connect/disconnect. OAuth flow follows existing Google pattern using `arctic` library. Tokens stored in OAuthAccount.
  _AC: Coach can connect Zoom, see "Connected" status, and disconnect. Gear icon on Dashboard links to settings._

- [x] **2D++.3 — Coach session address**
  Text input on coach settings page for in-person lesson address. `PATCH /api/coach-settings` endpoint.
  _AC: Coach can save an address. Address shown to students who book in-person lessons._

- [x] **2D++.4 — Booking mode selection**
  Add Online/In-Person radio toggle to StepConfirm in the booking flow. Only show Online option if selected coach has Zoom connected. Send `mode` in booking POST body.
  _AC: Student can choose lesson mode. In-person shows coach address. Online only available when coach has Zoom._

- [x] **2D++.5 — Auto-create Zoom meeting on booking**
  When an online booking is confirmed, call Zoom API to create a meeting in the coach's account with the student invited. Store `meetingUrl` and `meetingId` on the booking. Delete meeting on cancellation.
  _AC: Online booking automatically creates Zoom meeting. Link available immediately. Cancelled bookings clean up Zoom meeting._

- [x] **2D++.6 — Display meeting info on session pages**
  Show "Join Zoom" button on both coach and student session pages for online bookings. Show address for in-person bookings. Include meeting/address info in booking confirmation email.
  _AC: Both parties see the Zoom link or address. Confirmation email includes the relevant info._

- [ ] **2D++.7 — Google Meet support (future)**
  Add Google Meet as a second video provider using the same pattern. Coach connects Google account, meetings auto-created via Google Calendar API.
  _AC: Coach can choose between Zoom and Google Meet. Same booking flow works for both providers._

### 2E — Student Dashboard (Week 7–8)

- [x] **2E.1 — Student calendar / upcoming lessons**
  `/dashboard` — calendar view showing the student's upcoming booked lessons. Each entry shows lesson type, teacher, date/time, and status. Click to open booking detail with comment feed.
  _AC: Calendar displays all upcoming bookings. Supports month/week/day views. Mobile-friendly._

- [x] **2E.2 — Lesson history**
  `/dashboard/history` — list of past lessons with date, teacher, lesson type, and status (completed, cancelled, no-show). Filterable by lesson type and teacher.
  _AC: Past bookings shown in reverse chronological order. Filters work._

- [ ] **2E.3 — Student profile page**
  `/account/profile` — view and edit name, bio, avatar. `PATCH /api/me` endpoint. Avatar upload to R2.
  _AC: Profile updates persist. Avatar displays in header and community._

- [ ] **2E.4 — Account layout**
  Sidebar (desktop) / tab bar (mobile) navigation between Dashboard, History, Profile, Subscription (placeholder), My Songs (placeholder).
  _AC: Navigation works. Active state shown. Layout responsive._

### 2F — Teacher Dashboard (Week 7–8)

- [x] **2F.1 — Teacher calendar view**
  `/teacher/calendar` — calendar showing all of the teacher's upcoming bookings. Color-coded by lesson type. Click to open booking detail with student info and comment feed.
  _AC: Teacher sees all their bookings. Day/week/month views. Can distinguish lesson types at a glance._

- [x] **2F.2 — Teacher booking management**
  `/teacher/bookings` — list view of upcoming and past bookings. Can mark lessons as completed or no-show. Can view student profiles.
  _AC: Status updates reflect in student's booking list. Teacher can filter by status, lesson type, student._

### 2G — Admin Management (Week 8)

- [ ] **2G.1 — Admin teacher management**
  `POST /api/admin/teachers` — invite/create teacher accounts, assign lesson types, activate/deactivate. Admin UI at `/admin/teachers`.
  _AC: Admin can create and manage teacher accounts. Deactivated teachers don't appear in booking flow._

- [ ] **2G.2 — Admin bookings view**
  `GET /api/admin/bookings` — all bookings across all teachers. Filterable by date, status, lesson type, teacher. Admin UI at `/admin/bookings`.
  _AC: Admin sees all bookings. Can filter. Non-admin gets 403._

- [ ] **2G.3 — Admin contact messages**
  `GET /api/admin/contacts` + `PATCH /api/admin/contacts/:id` — view and mark as read.
  _AC: Admin sees all contact submissions. Unread count shown._

- [ ] **2G.4 — Admin lesson type management**
  `POST /api/admin/lessons` — create/update lesson types (title, description, pricing, images). Assign which teachers can teach each type.
  _AC: Changes reflect on public lesson pages immediately. Teacher-lesson associations enforced in booking flow._

### 2H — E2E Testing Setup (Week 8)

- [ ] **2H.1 — Playwright setup**
  Install Playwright. Configure test environment with seeded DB (admin, teacher, student accounts).
  _AC: `pnpm test:e2e` runs against local dev server._

- [ ] **2H.2 — Critical path tests**
  E2E tests for: registration, login, booking flow (with Stripe test mode), teacher availability setup, lesson comment feed.
  _AC: Tests pass in CI._

### Phase 2 Deliverable
Students can register (email or Google), browse lesson types, book one-off or recurring lessons with a teacher, and communicate through lesson comment feeds. Students have a calendar dashboard and lesson history. Teachers manage their availability and bookings. Admin controls teachers, lesson types, and platform settings.

---

## Phase 3 — Subscriptions & Workshops (Weeks 9–11)

**Goal:** Add recurring subscription plans, workshop registration, and free event RSVPs.

### 3A — Subscriptions (Week 9–10)

- [ ] **3A.1 — Subscription plans in Stripe**
  Create Stripe Products and Prices for each plan (e.g., 4 lessons/month, 8 lessons/month). Seed `SubscriptionPlan` table.
  _AC: Plans exist in both Stripe and local DB._

- [ ] **3A.2 — Subscribe endpoint**
  `POST /api/subscription/checkout` — creates Stripe Checkout Session in `subscription` mode.
  _AC: Redirects user to Stripe. Subscription created on success._

- [ ] **3A.3 — Stripe subscription webhooks**
  Handle `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`. Create/update/cancel `Subscription` records. Reset `lessonsUsedThisPeriod` on each billing cycle.
  _AC: Subscription lifecycle fully synced between Stripe and DB._

- [ ] **3A.4 — Subscriber booking logic**
  Modify `POST /api/bookings` — if user has active subscription with remaining lessons, set `usedSubscription=true` and skip Stripe Checkout. Otherwise, fall through to one-time payment.
  _AC: Subscriber with remaining lessons books without payment. Subscriber who exceeded allotment pays per-session._

- [ ] **3A.5 — Stripe Customer Portal**
  `POST /api/subscription/portal` — generate Stripe Customer Portal session URL.
  _AC: User can upgrade, downgrade, cancel, update payment method via Stripe-hosted UI._

- [ ] **3A.6 — Subscription UI (pricing page)**
  Update `/pricing` to show subscription plans with "Subscribe" CTAs. Indicate current plan if subscribed.
  _AC: Plans display with correct pricing. Subscribe button triggers checkout. Active plan highlighted._

- [ ] **3A.7 — Subscription UI (account)**
  `/account/subscription` — shows current plan, renewal date, lessons used/remaining this period, manage button (links to Stripe Portal).
  _AC: All subscription details accurate. "Manage" opens Stripe Portal._

### 3B — Workshops (Week 10–11)

- [ ] **3B.1 — Admin/teacher workshop CRUD**
  `POST /api/admin/workshops` — create/edit workshops (title, description, date, duration, capacity, price, image, teacher). Teachers can also create workshops for themselves.
  _AC: Admin/teacher can create workshops. Validation enforces required fields._

- [ ] **3B.2 — Public workshop listing**
  `GET /api/workshops` — returns upcoming workshops sorted by date. Include registration count for capacity display and teacher info.
  _AC: Endpoint returns workshops with `spotsRemaining` count and teacher name._

- [ ] **3B.3 — Workshop registration**
  `POST /api/workshops/:id/register` — auth required. Creates Stripe Checkout Session for workshop price. On payment success (webhook), creates `WorkshopRegistration`. Checks capacity.
  _AC: Full workshops return 409. Payment required. Registration created on payment success._

- [ ] **3B.4 — Workshops page (dynamic)**
  Replace placeholder data with API-driven content. "Sign up" triggers auth gate then Stripe flow. Show "X spots remaining". Past workshops in collapsed muted section.
  _AC: Real data displayed. Registration flow works end-to-end._

### 3C — Free Events (Week 11)

- [ ] **3C.1 — Admin event CRUD**
  `POST /api/admin/events` — create/edit free events.
  _AC: Admin can create events._

- [ ] **3C.2 — Public event listing**
  `GET /api/events` — upcoming events sorted by date.
  _AC: Events returned with RSVP count._

- [ ] **3C.3 — RSVP endpoint**
  `POST /api/events/:id/rsvp` — no auth required. Accepts name + email. Deduplicates by email per event.
  _AC: Duplicate RSVP returns 409. Valid RSVP persists and returns 201._

- [ ] **3C.4 — Events page (dynamic)**
  Replace placeholders with API data. Inline RSVP form (no redirect to login). "Free" badge on all cards.
  _AC: RSVP works without login. Confirmation shown inline._

- [ ] **3C.5 — Event/workshop reminders**
  Cloudflare Worker cron job that runs daily, finds events/workshops happening within 24 hours, sends reminder emails to registered/RSVP'd users.
  _AC: Reminders sent ~24h before event. No duplicate reminders._

### Phase 3 Deliverable
Full monetization in place: subscriptions, per-session payments, workshop purchases. Free events with lightweight RSVP. Automated reminders. The platform's business model is fully operational.

---

## Phase 4 — Community Song Feed (Weeks 12–14)

**Goal:** Build the song-sharing hub where students upload original work, listen, like, and give feedback.

### 4A — File Storage (Week 12)

- [ ] **4A.1 — R2 bucket setup**
  Create `sunbird-songs` R2 bucket. Configure CORS for direct upload from browser.
  _AC: Bucket exists and accepts uploads from the web app origin._

- [ ] **4A.2 — Presigned upload URL endpoint**
  `POST /api/community/upload-url` — returns a presigned R2 PUT URL. Validates file type (`.mp3`, `.wav`, `.m4a`, `.ogg`) and size (< 50MB) before issuing.
  _AC: Only valid audio types get an upload URL. URL expires after 15 minutes._

- [ ] **4A.3 — Presigned playback URL**
  When serving songs, generate short-lived presigned GET URLs for audio files so content is semi-private to authenticated users.
  _AC: Audio URLs work for logged-in users. URLs expire after 1 hour._

### 4B — Song CRUD (Week 12–13)

- [ ] **4B.1 — Create song endpoint**
  `POST /api/community/songs` — title, description, audio key (R2) or external URL, tags. Auth required (students and teachers).
  _AC: Song created with correct user association. Either `audioUrl` or `externalUrl` required._

- [ ] **4B.2 — List songs endpoint**
  `GET /api/community/songs` — paginated feed. Supports `sort` (recent, most-liked) and `tag` filter. Includes like count and whether current user has liked.
  _AC: Pagination works. Sorting correct. Like state accurate per user._

- [ ] **4B.3 — Edit/delete song endpoints**
  `PATCH /api/community/songs/:id` and `DELETE /api/community/songs/:id` — owner only.
  _AC: Non-owner gets 403. Delete removes R2 object._

- [ ] **4B.4 — Like toggle**
  `POST /api/community/songs/:id/like` — toggles like on/off.
  _AC: Liking twice removes the like. Like count updates._

- [ ] **4B.5 — Song feedback / comments CRUD**
  `GET /api/community/songs/:id/comments` and `POST /api/community/songs/:id/comments`. Students and teachers can leave feedback on songs.
  _AC: Comments paginated. Only comment author can delete their own._

### 4C — Community UI (Week 13–14)

- [ ] **4C.1 — Community feed page**
  `/community` — vertical stream of song cards with audio player, like button (heart icon + count), comment/feedback thread toggle, student name + avatar, timestamp. Filter/sort controls.
  _AC: Feed loads with infinite scroll or pagination. Sort and filter work._

- [ ] **4C.2 — Audio player component**
  Custom audio player UI matching design system: play/pause, progress bar, time display. Works with both R2 presigned URLs and external URLs (YouTube/SoundCloud embed fallback).
  _AC: Playback works. Player styled consistently._

- [ ] **4C.3 — Song upload form**
  Floating "Share a Song" button. Modal or page with: title, description, file upload (drag-and-drop) or external URL input, tag selector.
  _AC: Upload flow: get presigned URL -> upload to R2 -> create song record. Progress indicator during upload._

- [ ] **4C.4 — My Songs page**
  `/community/my-songs` — user's own submissions with edit/delete actions.
  _AC: Edit opens pre-filled form. Delete confirms before removing._

- [ ] **4C.5 — Feedback notification emails**
  When someone comments/gives feedback on your song, receive an email notification (configurable in account settings).
  _AC: Notification sent. Users can opt out._

### 4D — Moderation (Week 14)

- [ ] **4D.1 — Admin/teacher moderation tools**
  Admin and teachers can view all songs and comments. Hide/delete inappropriate content.
  _AC: Hidden songs don't appear in feed. Admin/teacher sees "hidden" indicator._

- [ ] **4D.2 — Report button**
  Users can report songs or comments for review (simple flag, no reason required for MVP).
  _AC: Report stored. Admin notified of new reports._

### Phase 4 Deliverable
A functioning community where students share songs, listen to each other's work, give feedback through likes and comments, and teachers can moderate content. The heart of the student community is live.

---

## Phase 5 — Polish & Growth (Weeks 15–19)

**Goal:** Refinement, SEO optimization, and features that drive long-term engagement and discoverability.

### 5A — Testimonials & Social Proof (Week 15)

- [ ] **5A.1 — Testimonials data model**
  Add `Testimonial` model (name, photo, quote, teacher, featured flag). Admin CRUD.
  _AC: Admin can create/edit/feature testimonials._

- [ ] **5A.2 — Testimonials carousel**
  Home page testimonials section with rotating student quotes + photos.
  _AC: Carousel auto-advances. Accessible (pause on hover/focus)._

- [ ] **5A.3 — Home page community teaser**
  Replace placeholder in Home page community section with real data — 3 most recent songs with mini audio players.
  _AC: Real songs shown. Play button works. Links to full community feed._

### 5B — SEO & Analytics (Week 15–16)

- [ ] **5B.1 — Full SEO pass**
  Audit and finalize all `<title>`, `<meta description>`, OG tags, canonical URLs. Ensure all pages have unique, keyword-rich metadata.
  _AC: No duplicate titles/descriptions. OG images set per page type._

- [ ] **5B.2 — Structured data expansion**
  JSON-LD for `Event` on workshops/events pages, `FAQPage` on pricing, `Organization` on home.
  _AC: Google Rich Results Test validates all schemas._

- [ ] **5B.3 — Analytics integration**
  Cloudflare Web Analytics or Plausible. Privacy-friendly, no cookies.
  _AC: Dashboard shows page views, top pages, referrers._

- [ ] **5B.4 — Open Graph images**
  Generate or design OG images for sharing (home, about, each lesson type).
  _AC: Social shares show branded preview images._

### 5C — UX Improvements (Week 16–17)

- [ ] **5C.1 — Calendar view for events**
  Toggle between list and calendar view on events page (FullCalendar or custom).
  _AC: Calendar shows events on correct dates. Clicking an event opens details._

- [ ] **5C.2 — Song lyrics/transcript display**
  Optional lyrics field on song submissions. Display as expandable section on song cards.
  _AC: Lyrics formatted with line breaks. Collapsible to save space._

- [ ] **5C.3 — Notification preferences**
  Account settings for email notification toggles (booking reminders, community activity, newsletter).
  _AC: Preferences persist. Email sending respects preferences._

- [ ] **5C.4 — Loading & error states**
  Skeleton loaders for all async content. Error boundaries with friendly error pages.
  _AC: No blank screens during loading. Errors show actionable messages._

### 5D — Learning Path Roadmaps (Week 17)

- [ ] **5D.1 — Learning path data model**
  Add `LearningPath` model (lessonTypeId, nodes, edges, milestones). Each lesson type gets a structured curriculum tree with prerequisite relationships between topics. Teachers can customize paths for their students.
  _AC: Schema supports directed acyclic graph of learning nodes per lesson type. Admin/teacher can CRUD paths._

- [ ] **5D.2 — Admin/teacher learning path editor**
  Visual tree/graph editor for teachers to define the curriculum progression for each lesson type (e.g., Voice: Breathing -> Pitch -> Range -> Style). Drag-and-drop node arrangement.
  _AC: Admin/teacher can create, reorder, and connect nodes. Prerequisite chains enforced (no cycles)._

- [ ] **5D.3 — Learning path visualization UI**
  Khan Academy-style roadmap view on each lesson page (`/lessons/[slug]/roadmap`). Interactive node map showing topics, prerequisites, and progression paths. Nodes are color-coded by category/difficulty.
  _AC: Roadmap renders as a visual tree/graph. Nodes show title, description, and connections. Responsive at all breakpoints._

- [ ] **5D.4 — Student progress tracking**
  Track which learning nodes a student has completed (marked by their teacher after sessions). Show progress on the roadmap visualization (completed = filled, in-progress = outlined, locked = grayed).
  _AC: Progress persists per student per lesson type. Roadmap reflects current progress state._

- [ ] **5D.5 — Roadmap links from lesson pages**
  Add "View Learning Roadmap" CTA on each individual lesson page, linking to the interactive roadmap view.
  _AC: CTA visible on all 5 lesson pages. Links route correctly._

### 5E — Newsletter & Outreach (Week 18)

- [ ] **5E.1 — Newsletter signup**
  Footer email input for non-users. Integrate with Resend audience or Buttondown.
  _AC: Email collected and added to list. Double opt-in confirmation sent._

- [ ] **5E.2 — Admin announcements**
  Admin can send bulk email to all students or specific segments (subscribers, community members).
  _AC: Email sent via Resend. Unsubscribe link included._

### 5F — Final QA & Hardening (Week 19)

- [ ] **5F.1 — Security audit**
  Review all endpoints for auth bypass, role escalation, injection, CSRF. Verify Stripe webhook signatures. Check R2 presigned URL scoping. Rate limit all public write endpoints.
  _AC: No critical vulnerabilities. All write endpoints rate-limited. Role boundaries tested._

- [ ] **5F.2 — Performance audit (final)**
  Lighthouse on all key pages. Bundle analysis. Image optimization pass.
  _AC: All pages > 95 Lighthouse Performance. Initial JS < 150KB gzip. LCP < 2.0s._

- [ ] **5F.3 — Cross-browser testing**
  Test on Chrome, Firefox, Safari (macOS + iOS), Edge.
  _AC: No visual or functional regressions across browsers._

- [ ] **5F.4 — Accessibility audit (final)**
  Full axe-core + manual screen reader testing (VoiceOver).
  _AC: WCAG 2.1 AA compliance. Zero critical/serious violations._

- [ ] **5F.5 — Error monitoring**
  Set up Sentry or equivalent for frontend and API error tracking.
  _AC: Unhandled errors captured with context. Alerts configured._

- [ ] **5F.6 — Backup & disaster recovery**
  Configure D1/Neon automated backups. Document recovery procedure.
  _AC: Backups running daily. Recovery tested at least once._

### Phase 5 Deliverable
A polished, production-hardened platform with strong SEO, analytics, social proof, and engagement features. Ready for sustained growth and onboarding additional teachers.

---

## Dependency Map

```
Phase 0 (Scaffolding)
  |
  v
Phase 1 (Design System + Public Pages + PWA Shell)
  |
  +----------------------+
  v                      v
Phase 2 (Auth, Roles,    |
  Booking, Dashboards)   |
  |                      |
  v                      |
Phase 3 (Subscriptions   |
  + Workshops)           |
  |                      |
  v                      |
Phase 4 (Community) <----+  (R2 setup can start during Phase 2 if needed)
  |
  v
Phase 5 (Polish + Growth)
```

Phases are sequential because each depends on the prior phase's infrastructure (especially auth + roles from Phase 2). However, within each phase, front-end and back-end tasks can be parallelized between developers.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| D1 limitations (SQLite on edge) hit scaling issues | Medium | High | Design schema to be Neon-compatible. Migration path documented. Switch trigger: > 1GB DB or need for full-text search. |
| Stripe webhook delivery failures | Low | High | Implement idempotent webhook handlers. Store raw events. Add retry logic. Monitor for unprocessed events. |
| Audio file storage costs grow unexpectedly | Low | Medium | 50MB limit per file. Monitor R2 usage. Add admin ability to archive old community songs. |
| Scope creep in community features | High | Medium | Strict MVP scope per phase. Defer features like real-time chat, playlists, collaborative songwriting to post-launch. |
| Multi-teacher scheduling conflicts | Medium | Medium | Teacher availability is per-teacher. DB constraints prevent double-booking. Clear UI shows only available slots. |
| Role escalation vulnerabilities | Low | High | Role checks in middleware (not just UI). E2E tests cover role boundaries. Security audit in Phase 5. |

---

## Testing Strategy

| Layer | Tool | Coverage Target |
|-------|------|----------------|
| Unit tests | Vitest | Business logic in `services/`, validators, utility functions, role checks |
| API integration tests | Vitest + Hono test client | All API endpoints with seeded DB (test all 3 roles) |
| Component tests | Vitest + Testing Library | Interactive components (booking calendar, audio player, forms, comment feed) |
| E2E tests | Playwright | Critical user paths: register -> book -> communicate -> pay; teacher availability setup; admin teacher management |
| Visual regression | Playwright screenshots (optional) | Key pages at 3 breakpoints |

Tests run in CI on every PR. E2E tests run against a preview deployment.

---

## Definition of Done (per task)

- [ ] Code written, typed, and linted
- [ ] Relevant tests pass
- [ ] Responsive at all 3 breakpoints
- [ ] Accessible (no axe violations)
- [ ] Role-based access enforced (if applicable)
- [ ] PR reviewed and merged
- [ ] Deployed to preview environment
- [ ] Acceptance criteria met
