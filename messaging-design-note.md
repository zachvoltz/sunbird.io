# Coach ↔ Student messaging — design note

**Status:** decision input · no code changes yet
**Scope:** a persistent, real-time chat thread per coach–student pair that doubles
as a unified activity timeline (messages + take uploads + lesson notes + assignments),
plus per-channel notification preferences.
**Date:** 2026-06-18

---

## Summary

A persistent, real-time chat **thread per coach–student pair** that doubles as a
unified activity timeline. Plain messages, take submissions, lesson notes, and
assignments all appear inline as cards. Live delivery via WebSocket-backed Durable
Objects. Per-channel notification preferences (push / SMS / email) with quiet
hours, firing only when the recipient is away.

## Decisions locked in

| Area | Decision |
|---|---|
| **Goal** | Replace scattered comms — one home for coach↔student interaction |
| **Structure** | 1:1 thread per coach–student pair (no group threads in V1) |
| **Timeline** | Inline activity cards (take submitted, notes sent, etc.) woven into the message stream |
| **Data model** | Extend existing `SessionMessage` (generalize beyond booking scope) |
| **Real-time** | One Durable Object per conversation, WebSocket |
| **Push** | Web-only → Web Push (service worker), designed to swap in native later |
| **Notif settings** | Per-channel toggles (push/SMS/email) + quiet hours |
| **Notif trigger** | Only when recipient is offline/away and still unread after a short delay |
| **SMS** | Deferred to fast-follow — Cloudflare has **no** first-party SMS product; SMS means calling a third party (Twilio-style) over `fetch()`. Phone capture + opt-in is net-new. |
| **Composer** | Text + file/audio attachments (reuse R2) |

## Relevant existing infrastructure

- **`SessionMessage`** + **`SessionMessageRead`** already exist but are
  **booking-scoped** (one thread per lesson). Inbox UI + read-receipt patterns
  (`Inbox.tsx`, `MyInbox.tsx`, `User.lastInboxViewedAt`) are reusable.
- No WebSocket / Durable Objects deployed yet; current comms are polling +
  browser custom events.
- **Email** works via the Cloudflare Email Sending binding (`env.EMAIL`,
  `email.service.ts`). **No SMS, no push** today.
- File storage is **R2** (`MEDIA_BUCKET`); take audio upload flow is reusable for
  chat attachments.
- Coach↔student is many-to-many overall, linked via `StudentInvite`, `Booking`,
  and `Subscription`; `Booking` is the core lesson entity.

---

## 1. Data model (Prisma)

Generalize `SessionMessage` and add a grouping entity.

- **`Conversation`** (new) — one per coach–student pair. `coachId`, `studentId`
  (unique composite), `lastActivityAt`, `createdAt`. This is the DO's identity and
  the thread anchor.
- **`SessionMessage`** (extend):
  - add `conversationId` (nullable → backfill), make `bookingId` nullable
  - `kind`: `TEXT | TAKE_SUBMITTED | TAKE_REPLY | NOTES_SENT | ASSIGNMENT | SYSTEM`
    — drives which card renders
  - `refType` / `refId` — soft link to the source entity (Take, Booking notes,
    Assignment) for the activity cards
  - `attachments` (JSON) — array of `{ r2Key, mime, name, durationSec? }`
- **`SessionMessageRead`** (exists) — keep; key by conversation. Powers unread
  counts and the "away + still unread" notification gate.
- **`NotificationPreference`** (new) — per user: `pushEnabled`, `smsEnabled`,
  `emailEnabled`, `quietHoursStart`, `quietHoursEnd`, `timezone`. Plus `phone` +
  `phoneVerified` (added now, used when SMS lands).
- **`PushSubscription`** (new) — Web Push endpoint per device: `userId`,
  `endpoint`, `p256dh`, `auth`.

**Migration note:** dev DB has drifted — use `prisma db push` + a hand-written
migration (not `migrate dev`). Backfill a `Conversation` per existing distinct
(coachId, studentId) from bookings, then point existing `SessionMessage` rows at
them.

## 2. Activity cards ("everything in chat")

Producers post into the conversation instead of (or in addition to) their current
side effects:

- **Take submitted** → `kind=TAKE_SUBMITTED` card, inline player + link to review
- **Coach take reply / annotations** → `kind=TAKE_REPLY`
- **Practice notes sent** (`practiceNotesSentAt`) → `kind=NOTES_SENT`
- **Assignment created** → `kind=ASSIGNMENT`

Each is a thin insert into `SessionMessage` referencing the real entity — source
models stay the source of truth; the card is a rich-rendering timeline pointer. A
shared helper (`postActivity(conversationId, kind, ref)`) keeps producers
consistent.

## 3. Real-time (Durable Objects)

- One DO instance per `Conversation` (id = conversationId).
- Holds the WebSocket connections for the two participants, fans out new
  messages/cards, and tracks **presence** (who's connected) — this is what powers
  the "don't notify if they're actively here" rule.
- Worker routes: `GET /api/conversations/:id/ws` (upgrade),
  `GET /api/conversations/:id/messages` (history/pagination from D1),
  `POST /api/conversations/:id/messages`.
- DO writes to D1 via the Prisma adapter on send, broadcasts to sockets, then
  enqueues a notification check.
- Use **hibernation-friendly** WebSockets (cost). See the `durable-objects` skill
  when implementing.

## 4. Notifications

**Trigger pipeline** (after a message/card is persisted):

1. For each recipient, check DO presence — if connected & focused on the thread,
   stop (in-app only).
2. If away, wait a short debounce (~60s) and re-check the unread flag; if read in
   the meantime, stop.
3. Still unread → consult `NotificationPreference`: skip channels that are off;
   if inside quiet hours, **defer** push/email to window-end (recommended) rather
   than dropping.
4. Dispatch via a **channel-adapter interface** (`notify(channel, user,
   payload)`):
   - **Email** — existing Cloudflare Email binding + a new "new activity" template
   - **Web Push** — service worker + VAPID keys, `web-push` from the Worker
   - **SMS** — adapter stubbed now, Twilio REST in fast-follow

The debounce / quiet-hours deferral is naturally a **DO Alarm** (per conversation
or per recipient) — no new cron needed, though the existing `*/15` cron can sweep
as a backstop.

## 5. Frontend

- New `Conversation` page (coach + student variants) extending/replacing
  `Inbox`/`MyInbox` — WebSocket client, optimistic send, infinite-scroll history,
  per-`kind` card renderers, composer with R2 upload (reuse take upload flow).
- Settings page: three channel toggles + quiet-hours picker + (later) phone verify.
- Service worker registration + push permission prompt.
- Unread badges (currently `lastInboxViewedAt` / `SessionMessageRead`) repointed to
  conversations.

## 6. Suggested build order

1. Data model + migration + `Conversation` backfill.
2. REST messaging (send/list) text-only, reusing inbox UI — no live yet.
3. Activity-card producers (takes, notes, assignments) → cards render.
4. Durable Object + WebSocket live delivery + presence.
5. Attachments in composer.
6. Notification preferences + Web Push + email "away" notifications with the
   presence / quiet-hours gate.
7. **Fast-follow:** SMS adapter (Twilio) + phone verification.

## Open questions

- **Group lessons:** V1 is 1:1 only, but bookings can be group-capable — confirm
  group threads stay out of scope.
- **Quiet hours:** defer notifications to window-end (recommended) vs. silently
  drop.
- **History retention / export:** any compliance need to retain or export
  coach↔student messages?
