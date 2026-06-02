# Pricing model — design note & reconciliation

**Status:** decision input · no code changes yet
**Scope:** resolves the contradiction in `v1-mvp-todo.md` §2 between the shipped
recurring-billing flow and the orphaned `SubscriptionPlan` model.
**Date:** 2026-06-02

---

## The problem

The schema and the codebase describe **two different recurring-pricing models**,
and the todo treats one of them as an unbuilt feature when it's actually a
competing design we already chose against.

### Model A — per-session rate × cadence (SHIPPED, active)

- `User.sessionPrice` (cents, nullable; null/0 = free) is the coach's single flat
  rate. Set via `PATCH /api/coach-payments/rate`, edited in `Payments.tsx`
  (`SessionRateCard`).
- A recurring booking (`POST /api/bookings/recurring`) opens a **Stripe
  subscription Checkout** built inline in `bookings.ts:createSubscriptionCheckout`:
  - `unit_amount = sessionPrice`
  - `recurring: { interval: "week", interval_count: 1 | 2 }` — weekly or biweekly
    (`frequency === "BIWEEKLY" ? 2 : 1`, `bookings.ts:212`)
  - destination charge to the coach's connected account
- Bookings are deferred until the webhook confirms payment, then generated from
  the schedule's cadence (`createScheduleBookingRows` / `generateScheduleDates`).
- `RecurringSchedule.frequency` is a free string, default `"WEEKLY"`; only
  `WEEKLY` and `BIWEEKLY` are produced. **There is no MONTHLY path** in checkout,
  and no concept of "N lessons per month."

### Model B — tiered monthly plans (SCHEMA ONLY, orphaned)

- `SubscriptionPlan { name, lessonsPerMonth, priceMonthly, stripePriceId,
  isActive, sortOrder }` and `Subscription { planId, stripeSubscriptionId,
  status, currentPeriodStart/End, lessonsUsedThisPeriod }`.
- This describes **named monthly tiers** — e.g. "Starter: 4 lessons/mo for $80",
  with per-period lesson-credit tracking (`lessonsUsedThisPeriod`).
- **Zero code touches either table**: no API routes, no UI, and the Stripe
  webhook handler (`payments.ts`) never reads/writes them. `stripePriceId` is
  `@unique` but nothing ever populates it.

### Also orphaned: `LessonType.pricePerSession`

- `LessonType.pricePerSession` (cents) exists and looks like it was meant to let
  different lesson types carry different prices. The booking flow never reads it
  — single and recurring bookings both price off `User.sessionPrice`. So
  per-lesson-type pricing is **schema-only** too.

---

## When each model makes sense

| | Model A (per-session × cadence) | Model B (tiered monthly plans) |
|---|---|---|
| Mental model | "My lessons are $X each, book a standing weekly slot" | "Pick a package: 4/mo, 8/mo, …" |
| Coach setup | one number | define & price multiple tiers, each needing a Stripe Price |
| Student choice | cadence (weekly/biweekly) | which plan tier |
| Billing | per-occurrence subscription | flat monthly, decoupled from specific slots |
| Credit tracking | none needed (1 charge ↔ 1 lesson) | required (`lessonsUsedThisPeriod`) — must decrement on book, handle overage/rollover |
| Reschedule/cancel | maps cleanly to one occurrence | needs credit refund/consume rules |
| Stripe objects | `price_data` created inline per checkout | a `Price` object per tier, created/synced ahead of time |

Model B is the right shape **only if** coaches actually want to sell packages
decoupled from specific time slots (studio/bundle pricing). For a single-coach
V1 (Ellisa) selling standing weekly lessons, Model A already covers the need and
B adds a second billing path with materially more surface area (credit
accounting, plan CRUD, Stripe Price lifecycle, a student plan-picker, and
reschedule/cancel credit semantics).

---

## What to do with the orphaned models

Three coherent end-states — do **not** leave both half-present:

1. **Commit to A, retire B (recommended for V1).** Treat `SubscriptionPlan` /
   `Subscription` / `LessonType.pricePerSession` as a deliberate non-goal.
   Either drop the tables in a future migration or leave them dormant with a
   schema comment marking them unused. Close §2.
2. **Commit to B, replace A.** Build plan CRUD + Stripe Price sync + student
   plan-picker + credit tracking; migrate the recurring flow off `sessionPrice`.
   Multi-day; needs a mockup. Only justified if packages are a real requirement.
3. **Support both.** Highest cost — two billing paths, two reschedule/cancel
   semantics, and a coach-level toggle for which model they sell. Not warranted
   for V1.

### Migration implications

- **A-only:** no data migration needed (nothing populates B). Optional cleanup
  migration to drop `SubscriptionPlan` / `Subscription` and
  `LessonType.pricePerSession`. Remember dev DB drift — use `prisma db push` +
  hand-written migration per existing project convention.
- **Adopting B later:** `stripePriceId` is `@unique` and `NOT NULL`; you must
  create Stripe `Price` objects before inserting plan rows. Plan to seed/create
  Prices in the coach-payments onboarding, not as a raw insert.
- Either way, decide `LessonType.pricePerSession` alongside `sessionPrice` so we
  don't keep two "price" fields where only one is read.

---

## Decision (2026-06-02)

**Both models coexist. Model A stays as-is for standing per-session lessons;
Model B (N-per-month packages) is a confirmed near-term feature.** Product has
answered the open question below: yes, we will sell lesson packages soon. So
`SubscriptionPlan` is *not* dropped — it's promoted from orphaned schema to a
scheduled build, and `LessonType.pricePerSession` stays reserved pending the
same work.

Implications:

- §2's SubscriptionPlan line changes from "needs mockup" to **planned — coexists
  with per-session; mockup-gated**, not "deferred / drop."
- Do **not** write a cleanup migration to drop the B tables — they're now the
  foundation of the packages feature.
- Coexistence model (decided at build time): **additive** — a coach offers
  per-session AND packages; the student picks per booking ("use a package
  credit" vs pay per session). Chosen over the per-coach exclusive toggle this
  note first recommended, so every booking records how it was paid
  (`Booking.usedSubscription` / `subscriptionId`).

## Model B — IMPLEMENTED (2026-06-02)

Built additively (see decision below; product chose "offer both"). Shipped:
schema + D1 migration `0026`; coach plan CRUD (`/api/coach-plans`) + editor on
`/coach/payments`; student `/api/packages` (list / mine / subscribe); webhook
subscription create + credit reset + cancel; per-booking credit consumption
(`usePackage`) with credit return on cancel; "use a package credit" in the
booking confirm step and a Packages section on the coach public profile. Tests:
`coach-plans`, `packages`, `package-credits`, `stripe-events`.

**Deviation from the outline below:** we did **not** pre-create Stripe `Price`
objects per tier. The subscribe Checkout builds inline `price_data` with a
destination transfer to the coach's connected account — identical to the shipped
per-session recurring flow — so plan CRUD needs no Stripe round-trip and
`SubscriptionPlan.stripePriceId` stays reserved/unused. This sidesteps the
platform-vs-connected-account Price ownership question entirely.

**Period dates** on a `Subscription` are an approximation (`+1 month`) set at
creation and refreshed on each `invoice.paid` (`subscription_cycle`); the credit
reset is driven by those Stripe cycle events, not by comparing dates.

## Model B — original build outline (for reference)

Mockup-gated, but the shape is known. Roughly in dependency order:

1. **Coexistence model (decide first).** How A and B relate for a given coach:
   recommend a **per-coach choice** — a coach sells *either* per-session standing
   lessons *or* monthly packages, surfaced as a toggle on `/coach/payments`.
   (Selling both simultaneously multiplies the student-facing and
   reschedule/cancel logic; avoid unless required.)
2. **Plan CRUD API:** `GET/POST/PATCH/DELETE /api/coach/plans` over
   `SubscriptionPlan`. On create/edit, create or update the Stripe `Price`
   object and store `stripePriceId` (it's `@unique` + non-null — Price must
   exist before the row).
3. **Coach UI:** plan-tier editor on `/coach/payments` (name, lessons/month,
   monthly price, active toggle, sort) — mirrors the existing `SessionRateCard`
   pattern.
4. **Student plan-picker:** in the booking flow, when the coach is in package
   mode, pick a tier → subscription Checkout off `stripePriceId` (monthly
   interval), then `Subscription` row created in the webhook.
5. **Credit tracking:** decrement `Subscription.lessonsUsedThisPeriod` on each
   booking; block/queue when the period's credits are exhausted; reset on
   `currentPeriodStart` rollover (webhook). Define overage and rollover rules.
6. **Reschedule/cancel semantics:** moving a booking returns/holds a credit;
   define refund behavior on plan cancel mid-period.
7. **Webhook wiring:** extend `payments.ts` to handle the package subscription
   (`checkout.session.completed` → create `Subscription`; `invoice.paid` →
   reset period + credits; `customer.subscription.deleted` → mark cancelled).

Cost is concentrated in 5–6 (credit accounting + reschedule semantics), not the
CRUD. Estimate firms up after the mockup.

**Resolved — open question:** "do we anticipate selling lesson packages
(N-per-month) soon?" → **Yes** (product, 2026-06-02). Hence the decision above.
