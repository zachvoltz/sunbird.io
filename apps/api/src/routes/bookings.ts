import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { createBookingSchema, createRecurringScheduleSchema, rescheduleBookingSchema, practiceNotesSchema, createSessionMessageSchema, createSessionResourceSchema } from "@sunbird/shared";
import { createEmailService } from "../services/email.service";
import { createCallsService } from "../services/calls.service";
import { pushEventMirror, deleteEventMirror } from "./google-calendar";
import { parseRoutine } from "../lib/routine";
import { makeStripe } from "../lib/stripe";
import { requiresPayment, type CoachPayInfo } from "../lib/payments";

const LESSON_DURATION_MINS = 60;

export const bookingRoutes = new Hono();

function formatDateTime(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

// Drop a system-style SessionMessage on a booking. A message is shown in
// the inbox of the booking participant who did NOT send it, so passing
// `senderId = the acting user` notifies the *other* party. Fire-and-forget;
// never fails the request that triggered it.
async function notifyOtherParty(
  db: any,
  args: { bookingId: string; senderId: string; content: string },
) {
  try {
    await db.sessionMessage.create({
      data: { bookingId: args.bookingId, senderId: args.senderId, content: args.content },
    });
  } catch (err) {
    console.error("Failed to write notification:", err);
  }
}

// Booking-created/updated notification to the coach: a message FROM the
// student so it lands in the coach's inbox. No-op when there's no coach or
// the requester is the coach themselves.
async function notifyCoachOfBooking(
  db: any,
  args: {
    bookingId: string;
    studentId: string;
    coachId: string | null;
    content: string;
  },
) {
  if (!args.coachId) return;
  if (args.studentId === args.coachId) return;
  await notifyOtherParty(db, { bookingId: args.bookingId, senderId: args.studentId, content: args.content });
}

function parseNoteSections(raw: string | null | undefined) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function serializeBooking(b: any) {
  return {
    id: b.id,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    status: b.status,
    mode: b.mode ?? "IN_PERSON",
    meetingUrl: b.meetingUrl ?? null,
    meetingProvider: b.meetingProvider ?? null,
    studentNote: b.studentNote,
    practiceNotes: b.practiceNotes,
    noteSections: parseNoteSections(b.noteSections),
    routineSnapshot: b.routineSnapshot ? parseRoutine(b.routineSnapshot) : null,
    completedAt: b.completedAt?.toISOString() ?? null,
    usedSubscription: b.usedSubscription,
    subscriptionId: b.subscriptionId ?? null,
    paymentStatus: b.paymentStatus ?? "NOT_REQUIRED",
    scheduleId: b.scheduleId ?? null,
    category: b.category
      ? { id: b.category.id, slug: b.category.slug, title: b.category.title, subtitle: b.category.subtitle, description: b.category.description, imageUrl: b.category.imageUrl }
      : null,
    skillTree: b.skillTree
      ? { id: b.skillTree.id, title: b.skillTree.title }
      : null,
    node: b.node
      ? { id: b.node.id, title: b.node.title }
      : null,
    createdAt: b.createdAt.toISOString(),
    user: b.user
      ? { id: b.user.id, name: b.user.name, avatarUrl: b.user.avatarUrl, bio: b.user.bio }
      : undefined,
    coach: b.coach
      ? { id: b.coach.id, name: b.coach.name, avatarUrl: b.coach.avatarUrl, bio: b.coach.bio }
      : undefined,
  };
}

const bookingInclude = {
  category: true,
  skillTree: { select: { id: true, title: true } },
  node: { select: { id: true, title: true } },
  user: { select: { id: true, name: true, avatarUrl: true, bio: true } },
  coach: { select: { id: true, name: true, avatarUrl: true, bio: true, sessionAddress: true } },
};

// Validate that a [startsAt, endsAt) slot is bookable for a specific coach:
// not in the past, no overlapping non-cancelled booking, the coach teaches the
// category, the slot falls on the coach's weekly availability, and no CoachBusy
// block overlaps. Shared by create + reschedule so both stay in lockstep.
// `excludeBookingId` skips a booking from the conflict check (the one being
// rescheduled). Returns the first failure as { ok:false, status, error }.
type SlotCheck = { ok: true } | { ok: false; status: 400 | 409; error: string };
async function validateCoachSlot(
  db: any,
  args: { coachId: string; categoryId: string; startsAt: Date; endsAt: Date; excludeBookingId?: string },
): Promise<SlotCheck> {
  const { coachId, categoryId, startsAt, endsAt, excludeBookingId } = args;

  if (startsAt <= new Date()) {
    return { ok: false, status: 400, error: "Cannot book a time in the past" };
  }

  const conflictWhere: any = {
    startsAt: { lt: endsAt },
    endsAt: { gt: startsAt },
    status: { not: "CANCELLED" },
    coachId,
  };
  if (excludeBookingId) {
    conflictWhere.id = { not: excludeBookingId };
  }
  const conflict = await db.booking.findFirst({ where: conflictWhere });
  if (conflict) {
    return { ok: false, status: 409, error: "This time slot is no longer available" };
  }

  const coachTeaches = await db.coachCategory.findFirst({ where: { coachId, categoryId } });
  if (!coachTeaches) {
    return { ok: false, status: 400, error: "This coach does not teach this category" };
  }

  const dayOfWeek = startsAt.getUTCDay();
  const timeStr = `${String(startsAt.getUTCHours()).padStart(2, "0")}:${String(startsAt.getUTCMinutes()).padStart(2, "0")}`;
  const coachAvail = await db.coachAvailability.findFirst({
    where: { coachId, dayOfWeek, startTime: timeStr, isActive: true },
  });
  if (!coachAvail) {
    return { ok: false, status: 400, error: "This time is not within the coach's available hours" };
  }

  // Busy beats available — reject if any CoachBusy row overlaps this slot.
  const busyOverlap = await db.coachBusy.findFirst({
    where: { coachId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
  });
  if (busyOverlap) {
    return { ok: false, status: 409, error: "The coach is unavailable at this time" };
  }

  return { ok: true };
}

function stripeKey(c: any): string | undefined {
  return (c.env as any)?.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || undefined;
}

// Hosted Stripe Checkout for a single lesson — a destination charge to the
// coach's connected account. Returns the redirect URL, or null if Stripe isn't
// configured (caller falls back to a free booking).
async function createBookingCheckout(
  c: any,
  args: { coachAccountId: string; amountCents: number; lessonTitle: string; bookingId: string; studentEmail: string },
): Promise<string | null> {
  const key = stripeKey(c);
  if (!key) return null;
  const stripe = makeStripe(key);
  const origin = new URL(c.req.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: args.studentEmail,
    line_items: [
      { price_data: { currency: "usd", unit_amount: args.amountCents, product_data: { name: args.lessonTitle } }, quantity: 1 },
    ],
    payment_intent_data: { transfer_data: { destination: args.coachAccountId } },
    metadata: { bookingId: args.bookingId },
    success_url: `${origin}/my-bookings?payment=success`,
    cancel_url: `${origin}/my-bookings?payment=canceled`,
  });
  return session.url;
}

// Hosted Stripe Checkout for a recurring schedule — a Subscription billing the
// session rate at the schedule's cadence (weekly / every-2-weeks), routed to
// the coach's connected account. Returns the URL or null if Stripe is unset.
async function createSubscriptionCheckout(
  c: any,
  args: { coachAccountId: string; amountCents: number; lessonTitle: string; scheduleId: string; frequency: string; studentEmail: string },
): Promise<string | null> {
  const key = stripeKey(c);
  if (!key) return null;
  const stripe = makeStripe(key);
  const origin = new URL(c.req.url).origin;
  const intervalCount = args.frequency === "BIWEEKLY" ? 2 : 1;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: args.studentEmail,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: args.amountCents,
          recurring: { interval: "week", interval_count: intervalCount },
          product_data: { name: args.lessonTitle },
        },
        quantity: 1,
      },
    ],
    subscription_data: { transfer_data: { destination: args.coachAccountId } },
    metadata: { scheduleId: args.scheduleId },
    success_url: `${origin}/my-bookings?payment=success`,
    cancel_url: `${origin}/my-bookings?payment=canceled`,
  });
  return session.url;
}

// Regenerate a schedule's occurrence dates (future only) from its stored
// cadence — used by both the free path and the subscription webhook so they
// produce identical bookings without persisting the date list.
//
// DST-safe: we advance by a fixed millisecond delta on UTC timestamps, so every
// occurrence lands at the SAME absolute instant (and the same UTC wall-clock,
// which is what booking validation checks). Using local `setDate(getDate()+7)`
// here would slip by an hour across a US DST boundary — we deliberately don't.
function generateScheduleDates(schedule: any, now: Date): Date[] {
  const intervalDays = schedule.frequency === "BIWEEKLY" ? 14 : 7;
  const dates: Date[] = [];
  let current = new Date(schedule.startsOn);
  const end = new Date(schedule.endsOn);
  while (current <= end) {
    if (current > now) dates.push(new Date(current));
    current = new Date(current.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  }
  return dates;
}

// Create the CONFIRMED booking rows for a schedule. Shared by the free path
// and the subscription webhook (which has no request context, hence no Google
// Calendar mirroring here — the free path mirrors separately).
export async function createScheduleBookingRows(
  db: any,
  schedule: any,
  opts: { paymentStatus: string; studentNote?: string | null },
): Promise<any[]> {
  const dates = generateScheduleDates(schedule, new Date());
  const rows: any[] = [];
  for (const date of dates) {
    const endsAt = new Date(date.getTime() + LESSON_DURATION_MINS * 60 * 1000);
    const booking = await db.booking.create({
      data: {
        userId: schedule.userId,
        coachId: schedule.coachId,
        lessonTypeId: null,
        categoryId: schedule.categoryId,
        skillTreeId: schedule.skillTreeId ?? null,
        nodeId: schedule.nodeId ?? null,
        startsAt: date,
        endsAt,
        mode: schedule.mode,
        studentNote: opts.studentNote ?? null,
        scheduleId: schedule.id,
        status: "CONFIRMED",
        paymentStatus: opts.paymentStatus,
      },
      include: bookingInclude,
    });
    rows.push(booking);
  }
  return rows;
}

// POST /api/bookings — create a booking
bookingRoutes.post("/", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const { categoryId, skillTreeId, nodeId, coachId: providedCoachId, startsAt: startsAtStr, mode, studentNote, usePackage } = parsed.data;
  const db = getDb();

  // Verify category exists
  const category = await db.category.findUnique({ where: { id: categoryId } });
  if (!category) {
    return c.json({ error: "Category not found" }, 404);
  }

  // Verify skill tree belongs to coach+category (if provided)
  if (skillTreeId) {
    const st = await db.skillTree.findFirst({ where: { id: skillTreeId, categoryId } });
    if (!st) {
      return c.json({ error: "Skill tree not found for this category" }, 400);
    }
  }

  // Verify node belongs to skill tree (if provided)
  if (nodeId && skillTreeId) {
    const node = await db.skillTreeNode.findFirst({ where: { id: nodeId, skillTreeId } });
    if (!node) {
      return c.json({ error: "Node not found in this skill tree" }, 400);
    }
  }

  // Resolve coach — use provided, or auto-assign if only one coach exists
  let coachId = providedCoachId ?? null;
  if (!coachId) {
    const coaches = await db.user.findMany({ where: { role: "COACH" } });
    if (coaches.length === 1) {
      coachId = coaches[0].id;
    }
  }

  // Verify coach exists and is actually a coach
  if (coachId) {
    const coach = await db.user.findFirst({ where: { id: coachId, role: "COACH" } });
    if (!coach) {
      return c.json({ error: "Coach not found" }, 404);
    }
  }

  const startsAt = new Date(startsAtStr);
  const endsAt = new Date(startsAt.getTime() + LESSON_DURATION_MINS * 60 * 1000);

  if (coachId) {
    const slot = await validateCoachSlot(db, { coachId, categoryId, startsAt, endsAt });
    if (!slot.ok) {
      return c.json({ error: slot.error }, slot.status);
    }
  } else {
    // No coach assigned — the helper is coach-scoped, so run the minimal
    // legacy checks inline (past + global conflict + global availability slot).
    if (startsAt <= new Date()) {
      return c.json({ error: "Cannot book a time in the past" }, 400);
    }
    const conflict = await db.booking.findFirst({
      where: { startsAt: { lt: endsAt }, endsAt: { gt: startsAt }, status: { not: "CANCELLED" } },
    });
    if (conflict) {
      return c.json({ error: "This time slot is no longer available" }, 409);
    }
    const dayOfWeek = startsAt.getUTCDay();
    const timeStr = `${String(startsAt.getUTCHours()).padStart(2, "0")}:${String(startsAt.getUTCMinutes()).padStart(2, "0")}`;
    const availSlot = await db.availabilitySlot.findFirst({
      where: { dayOfWeek, startTime: timeStr, isActive: true },
    });
    if (!availSlot) {
      return c.json({ error: "This time is not within available hours" }, 400);
    }
  }

  // Pay with a package credit when asked: requires an active, non-exhausted
  // subscription with this coach. The booking is then PAID (the credit covers
  // it) and no Stripe Checkout is opened. We re-check credits here rather than
  // trusting the client.
  let creditSub: { id: string; lessonsUsedThisPeriod: number; lessonsPerMonth: number } | null = null;
  if (usePackage) {
    if (!coachId) {
      return c.json({ error: "A package credit needs a specific coach." }, 400);
    }
    const sub = await db.subscription.findFirst({
      where: { userId: user.id, coachId, status: "ACTIVE" },
      include: { plan: { select: { lessonsPerMonth: true } } },
      orderBy: { createdAt: "desc" },
    });
    if (!sub) {
      return c.json({ error: "You don't have an active package with this coach." }, 409);
    }
    if (sub.lessonsUsedThisPeriod >= sub.plan.lessonsPerMonth) {
      return c.json({ error: "You've used all your package credits this month." }, 409);
    }
    creditSub = { id: sub.id, lessonsUsedThisPeriod: sub.lessonsUsedThisPeriod, lessonsPerMonth: sub.plan.lessonsPerMonth };
  }

  // Does this coach charge for lessons? Drives whether we open Checkout.
  // A package credit short-circuits per-session payment.
  const coachPay: CoachPayInfo | null = coachId
    ? await db.user.findUnique({
        where: { id: coachId },
        select: { stripeAccountId: true, stripeChargesEnabled: true, sessionPrice: true },
      })
    : null;
  const needsPayment = !creditSub && requiresPayment(coachPay);

  const booking = await db.booking.create({
    data: {
      userId: user.id,
      coachId,
      lessonTypeId: null,
      categoryId,
      skillTreeId: skillTreeId ?? null,
      nodeId: nodeId ?? null,
      startsAt,
      endsAt,
      mode,
      studentNote: studentNote ?? null,
      status: "CONFIRMED",
      usedSubscription: !!creditSub,
      subscriptionId: creditSub?.id ?? null,
      paymentStatus: creditSub ? "PAID" : needsPayment ? "PENDING" : "NOT_REQUIRED",
    },
    include: bookingInclude,
  });

  // Consume the credit now that the booking exists.
  if (creditSub) {
    await db.subscription.update({
      where: { id: creditSub.id },
      data: { lessonsUsedThisPeriod: { increment: 1 } },
    });
  }

  // Notify the coach in their inbox.
  await notifyCoachOfBooking(db, {
    bookingId: booking.id,
    studentId: user.id,
    coachId,
    content: `📅 Booked a ${category.title} lesson — ${formatDateTime(startsAt)}`,
  });

  // Push to the coach's Google Calendar (best-effort).
  if (coachId) {
    const studentName = user.name ?? user.email ?? "student";
    await pushEventMirror(c, {
      coachId,
      bookingId: booking.id,
      startsAt,
      endsAt,
      summary: `${studentName} · ${category.title}`,
      description: studentNote ?? undefined,
    });
  }

  // Paid lesson: open Stripe Checkout and return its URL for the client to
  // redirect to. The booking stays PENDING until the webhook confirms payment.
  if (needsPayment && coachPay) {
    try {
      const checkoutUrl = await createBookingCheckout(c, {
        coachAccountId: coachPay.stripeAccountId!,
        amountCents: coachPay.sessionPrice!,
        lessonTitle: category.title,
        bookingId: booking.id,
        studentEmail: user.email,
      });
      if (checkoutUrl) {
        return c.json({ data: serializeBooking(booking), checkoutUrl }, 201);
      }
    } catch (err) {
      console.error("Stripe Checkout creation failed:", err);
      return c.json({ error: "Couldn't start payment. Please try again." }, 502);
    }
  }

  // Free lesson — confirm immediately. Send confirmation email (fire and forget).
  try {
    const apiKey = (c.env as any)?.RESEND_API_KEY || process.env.RESEND_API_KEY || "";
    const from = (c.env as any)?.EMAIL_FROM || process.env.EMAIL_FROM || "noreply@sunbird.io";
    const email = createEmailService(apiKey, from);
    email.sendBookingConfirmation(user.email, user.name, category.title, formatDateTime(startsAt)).catch(console.error);
  } catch {}

  return c.json({ data: serializeBooking(booking) }, 201);
});

// PATCH /api/bookings/:id/node — select/change node on a session
// PATCH /api/bookings/:id/student-note — the owning student sets their
// "bring up with my coach" note for an upcoming session. These surface on
// the coach's session-prep agenda.
bookingRoutes.patch("/:id/student-note", requireAuth, async (c) => {
  const { id } = c.req.param();
  const user = c.get("user")!;
  const body = await c.req.json().catch(() => ({}));
  const note = typeof body.studentNote === "string" ? body.studentNote.slice(0, 500) : "";

  const db = getDb();
  const booking = await db.booking.findUnique({ where: { id }, include: bookingInclude });
  if (!booking) return c.json({ error: "Booking not found" }, 404);
  if (booking.userId !== user.id) return c.json({ error: "Forbidden" }, 403);

  const updated = await db.booking.update({
    where: { id },
    data: { studentNote: note || null },
    include: bookingInclude,
  });
  return c.json({ data: serializeBooking(updated) });
});

bookingRoutes.patch("/:id/node", requireAuth, async (c) => {
  const { id } = c.req.param();
  const user = c.get("user")!;
  const body = await c.req.json();
  const { nodeId: newNodeId } = body as { nodeId: string };

  if (!newNodeId) return c.json({ error: "nodeId is required" }, 400);

  const db = getDb();
  const booking = await db.booking.findUnique({ where: { id } });
  if (!booking) return c.json({ error: "Booking not found" }, 404);

  if (user.role === "STUDENT" && booking.userId !== user.id) return c.json({ error: "Forbidden" }, 403);
  if (user.role === "COACH" && booking.coachId !== user.id) return c.json({ error: "Forbidden" }, 403);

  // Verify node exists
  const node = await db.skillTreeNode.findUnique({
    where: { id: newNodeId },
    include: {
      resourceLinks: { include: { resource: true } },
      drills: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!node) return c.json({ error: "Node not found" }, 404);

  // Update booking with the new node (and its skill tree)
  const updated = await db.booking.update({
    where: { id },
    data: { nodeId: newNodeId, skillTreeId: node.skillTreeId },
    include: bookingInclude,
  });

  // Auto-copy node resources to session resources
  for (const link of (node as any).resourceLinks ?? []) {
    const r = link.resource;
    await db.sessionResource.upsert({
      where: { id: `sr_${id}_${r.id}` },
      update: {},
      create: {
        id: `sr_${id}_${r.id}`,
        bookingId: id,
        addedById: user.id,
        type: r.type,
        title: r.title,
        url: r.url,
      },
    }).catch(() => {});
  }

  return c.json({ data: serializeBooking(updated) });
});

// GET /api/bookings — list bookings
bookingRoutes.get("/", requireAuth, async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  const status = c.req.query("status");

  const where: any = {};
  if (user.role === "STUDENT") {
    where.userId = user.id;
  } else if (user.role === "COACH") {
    where.coachId = user.id;
  }
  // ADMIN sees all
  if (status) {
    where.status = status;
  }

  const bookings = await db.booking.findMany({
    where,
    include: bookingInclude,
    orderBy: { startsAt: "desc" },
  });

  return c.json({ data: bookings.map(serializeBooking) });
});

// GET /api/bookings/:id — single booking
bookingRoutes.get("/:id", requireAuth, async (c) => {
  const { id } = c.req.param();
  const user = c.get("user")!;
  const db = getDb();

  const booking = await db.booking.findUnique({
    where: { id },
    include: bookingInclude,
  });

  if (!booking) {
    return c.json({ error: "Booking not found" }, 404);
  }

  if (user.role === "STUDENT" && booking.userId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }
  if (user.role === "COACH" && booking.coachId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  return c.json({ data: serializeBooking(booking) });
});

// GET /api/bookings/:id/previous — most recent COMPLETED session this
// coach had with the same student, before the given booking. Used by
// the coach session page to show a "Last time" recap card during prep.
// Returns { data: null } when there's no prior session.
bookingRoutes.get("/:id/previous", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user")!;
  const db = getDb();

  const current = await db.booking.findUnique({
    where: { id },
    select: { coachId: true, userId: true, startsAt: true },
  });
  if (!current) {
    return c.json({ error: "Booking not found" }, 404);
  }
  if (user.role === "COACH" && current.coachId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const previous = await db.booking.findFirst({
    where: {
      coachId: current.coachId,
      userId: current.userId,
      status: "COMPLETED",
      startsAt: { lt: current.startsAt },
    },
    orderBy: { startsAt: "desc" },
    include: bookingInclude,
  });

  return c.json({ data: previous ? serializeBooking(previous) : null });
});

// POST /api/bookings/:id/next-week — coach quick-action that books the
// same student at the same UTC time +7 days, reusing category / skill
// tree / node / mode / coach. Used by the Next tab on the coach session
// page as a one-click "lock in next week" affordance.
//
// We re-run the same conflict / availability / busy checks as the
// student-facing POST /api/bookings so we never bypass the coach's
// real schedule. On a conflict the coach is told to "pick another
// time" and falls back to the calendar.
bookingRoutes.post("/:id/next-week", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user")!;
  const db = getDb();

  const source = await db.booking.findUnique({
    where: { id },
    include: { user: { select: { id: true } } },
  });
  if (!source) return c.json({ error: "Booking not found" }, 404);
  if (user.role === "COACH" && source.coachId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }
  if (!source.coachId) {
    return c.json({ error: "Source booking has no coach" }, 400);
  }

  const startsAt = new Date(source.startsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const endsAt = new Date(source.endsAt.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (startsAt <= new Date()) {
    return c.json({ error: "Next-week slot is in the past" }, 400);
  }

  const conflict = await db.booking.findFirst({
    where: {
      coachId: source.coachId,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      status: { not: "CANCELLED" },
    },
  });
  if (conflict) {
    return c.json({ error: "That slot is already booked next week" }, 409);
  }

  const dayOfWeek = startsAt.getUTCDay();
  const timeStr = `${String(startsAt.getUTCHours()).padStart(2, "0")}:${String(startsAt.getUTCMinutes()).padStart(2, "0")}`;
  const coachAvail = await db.coachAvailability.findFirst({
    where: { coachId: source.coachId, dayOfWeek, startTime: timeStr, isActive: true },
  });
  if (!coachAvail) {
    return c.json({ error: "Coach is no longer available at this time next week" }, 400);
  }

  const busyOverlap = await db.coachBusy.findFirst({
    where: {
      coachId: source.coachId,
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  if (busyOverlap) {
    return c.json({ error: "Coach is marked busy at this time next week" }, 409);
  }

  const booking = await db.booking.create({
    data: {
      userId: source.userId,
      coachId: source.coachId,
      lessonTypeId: null,
      categoryId: source.categoryId,
      skillTreeId: source.skillTreeId,
      nodeId: source.nodeId,
      startsAt,
      endsAt,
      mode: source.mode,
      studentNote: null,
      status: "CONFIRMED",
    },
    include: bookingInclude,
  });

  return c.json({ data: serializeBooking(booking) }, 201);
});

// GET /api/bookings/:id/next-suggested — what to offer when wrapping up a
// session: a future slot (the recurring cadence if the booking belongs to a
// schedule, else same-time +7d, rolled forward until it's in the future) plus
// whether a future booking already exists (so the book-next gate can skip).
bookingRoutes.get("/:id/next-suggested", requireAuth, async (c) => {
  const { id } = c.req.param();
  const user = c.get("user")!;
  const db = getDb();

  const source = await db.booking.findUnique({
    where: { id },
    include: {
      schedule: { include: { category: true, coach: { select: { id: true, name: true, avatarUrl: true, bio: true } }, _count: { select: { bookings: true } } } },
    },
  });
  if (!source) return c.json({ error: "Booking not found" }, 404);
  if (user.role === "STUDENT" && source.userId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }
  if (user.role === "COACH" && source.coachId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const now = new Date();
  const alreadyBooked = source.coachId
    ? (await db.booking.findFirst({
        where: {
          userId: source.userId,
          coachId: source.coachId,
          status: { not: "CANCELLED" },
          startsAt: { gt: now },
        },
        select: { id: true },
      })) !== null
    : false;

  // Roll the same-time-next-week slot forward until it lands in the future
  // (a session that ended weeks ago shouldn't suggest a past date).
  const durationMs = source.endsAt.getTime() - source.startsAt.getTime();
  let start = new Date(source.startsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  while (start <= now) start = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  const suggested = { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + durationMs).toISOString() };

  const s = source.schedule;
  const recurring = s
    ? {
        id: s.id,
        frequency: s.frequency,
        dayOfWeek: s.dayOfWeek,
        startTime: s.startTime,
        startsOn: s.startsOn.toISOString(),
        endsOn: s.endsOn.toISOString(),
        status: s.status,
        category: s.category
          ? {
              id: s.category.id,
              slug: s.category.slug,
              title: s.category.title,
              subtitle: s.category.subtitle ?? null,
              description: s.category.description,
              imageUrl: s.category.imageUrl ?? null,
            }
          : null,
        coach: (s as any).coach,
        bookingCount: (s as any)._count?.bookings ?? 0,
      }
    : null;

  return c.json({ data: { suggested, recurring, alreadyBooked } });
});

// PATCH /api/bookings/:id/cancel — cancel a booking
bookingRoutes.patch("/:id/cancel", requireAuth, async (c) => {
  const { id } = c.req.param();
  const user = c.get("user")!;
  const db = getDb();

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      category: true,
      user: { select: { email: true, name: true } },
      coach: { select: { email: true, name: true } },
    },
  });

  if (!booking) {
    return c.json({ error: "Booking not found" }, 404);
  }
  if (user.role === "STUDENT" && booking.userId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }
  if (user.role === "COACH" && booking.coachId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }
  if (booking.status !== "CONFIRMED") {
    return c.json({ error: "Only confirmed bookings can be cancelled" }, 400);
  }

  const updated = await db.booking.update({
    where: { id },
    data: { status: "CANCELLED" },
    include: bookingInclude,
  });

  // Return the package credit if this booking was paid with one (guarded so a
  // period rollover can't push the counter negative).
  if (booking.usedSubscription && booking.subscriptionId) {
    await db.subscription.updateMany({
      where: { id: booking.subscriptionId, lessonsUsedThisPeriod: { gt: 0 } },
      data: { lessonsUsedThisPeriod: { decrement: 1 } },
    });
  }

  // Tear down the mirrored Google Calendar event, if any.
  if (booking.coachId) {
    await deleteEventMirror(c, { coachId: booking.coachId, bookingId: id });
  }

  // Notify the other party in-app (senderId = actor → the non-actor sees it).
  const lessonTitle = booking.category?.title ?? "Lesson";
  await notifyOtherParty(db, {
    bookingId: id,
    senderId: user.id,
    content: `❌ Cancelled ${lessonTitle} — ${formatDateTime(booking.startsAt)}`,
  });

  // Email the non-actor: when the student cancels, tell the coach; otherwise
  // tell the student.
  try {
    const apiKey = (c.env as any)?.RESEND_API_KEY || process.env.RESEND_API_KEY || "";
    const from = (c.env as any)?.EMAIL_FROM || process.env.EMAIL_FROM || "noreply@sunbird.io";
    const email = createEmailService(apiKey, from);
    const actorIsStudent = booking.userId === user.id;
    const recipient = actorIsStudent ? booking.coach : booking.user;
    if (recipient?.email) {
      email.sendBookingCancellation(recipient.email, recipient.name, lessonTitle, formatDateTime(booking.startsAt)).catch(console.error);
    }
  } catch {}

  return c.json({ data: serializeBooking(updated) });
});

// PATCH /api/bookings/:id/reschedule — move an upcoming booking to a new time
// with the same coach. Re-validates the new slot against the coach's
// availability; the booking stays CONFIRMED and keeps its category/coach/note
// and any recurring scheduleId (only this occurrence moves).
bookingRoutes.patch("/:id/reschedule", requireAuth, async (c) => {
  const { id } = c.req.param();
  const user = c.get("user")!;
  const db = getDb();

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      category: true,
      user: { select: { email: true, name: true } },
      coach: { select: { email: true, name: true } },
    },
  });

  if (!booking) {
    return c.json({ error: "Booking not found" }, 404);
  }
  if (user.role === "STUDENT" && booking.userId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }
  if (user.role === "COACH" && booking.coachId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }
  if (booking.status !== "CONFIRMED") {
    return c.json({ error: "Only confirmed bookings can be rescheduled" }, 400);
  }
  if (!booking.coachId) {
    return c.json({ error: "This booking has no coach to reschedule with" }, 400);
  }
  if (!booking.categoryId) {
    return c.json({ error: "This booking has no category to reschedule" }, 400);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = rescheduleBookingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const startsAt = new Date(parsed.data.newStartsAt);
  const endsAt = new Date(startsAt.getTime() + LESSON_DURATION_MINS * 60 * 1000);

  const slot = await validateCoachSlot(db, {
    coachId: booking.coachId,
    categoryId: booking.categoryId,
    startsAt,
    endsAt,
    excludeBookingId: id,
  });
  if (!slot.ok) {
    return c.json({ error: slot.error }, slot.status);
  }

  const updated = await db.booking.update({
    where: { id },
    data: { startsAt, endsAt },
    include: bookingInclude,
  });

  // Re-mirror the Google Calendar event at the new time (best-effort).
  await deleteEventMirror(c, { coachId: booking.coachId, bookingId: id });
  const studentName = booking.user.name ?? booking.user.email ?? "student";
  await pushEventMirror(c, {
    coachId: booking.coachId,
    bookingId: id,
    startsAt,
    endsAt,
    summary: `${studentName} · ${booking.category?.title ?? "Lesson"}`,
    description: booking.studentNote ?? undefined,
  });

  // Notify the other party in-app (senderId = actor → the non-actor sees it).
  const lessonTitle = booking.category?.title ?? "lesson";
  await notifyOtherParty(db, {
    bookingId: id,
    senderId: user.id,
    content: `🔄 Rescheduled ${lessonTitle} — now ${formatDateTime(startsAt)}`,
  });

  // Email both sides (fire and forget) so the change reaches everyone.
  try {
    const apiKey = (c.env as any)?.RESEND_API_KEY || process.env.RESEND_API_KEY || "";
    const from = (c.env as any)?.EMAIL_FROM || process.env.EMAIL_FROM || "noreply@sunbird.io";
    const email = createEmailService(apiKey, from);
    const oldLabel = formatDateTime(booking.startsAt);
    const newLabel = formatDateTime(startsAt);
    const recipients = [booking.user, booking.coach].filter((r): r is { email: string; name: string } => !!r?.email);
    for (const r of recipients) {
      email.sendBookingReschedule(r.email, r.name, lessonTitle, oldLabel, newLabel).catch(console.error);
    }
  } catch {}

  return c.json({ data: serializeBooking(updated) });
});

// PATCH /api/bookings/:id/complete — mark lesson as completed (coach/admin)
bookingRoutes.patch("/:id/complete", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user")!;
  const db = getDb();

  const booking = await db.booking.findUnique({ where: { id } });
  if (!booking) {
    return c.json({ error: "Booking not found" }, 404);
  }
  if (user.role === "COACH" && booking.coachId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }
  if (booking.status !== "CONFIRMED") {
    return c.json({ error: "Only confirmed bookings can be completed" }, 400);
  }

  const updated = await db.booking.update({
    where: { id },
    data: { status: "COMPLETED", completedAt: new Date() },
    include: bookingInclude,
  });

  return c.json({ data: serializeBooking(updated) });
});

// PATCH /api/bookings/:id/notes — save sectioned lesson notes and email
// the student. Accepts either { practiceNotes } (legacy flat string) or
// { noteSections } (Intro / Exercises done / Topics discussed / Song work /
// Next time). When sections are provided, we also persist a flattened
// practiceNotes string so existing consumers (TodayPage, etc.) keep working.
bookingRoutes.patch("/:id/notes", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const { id } = c.req.param();
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = practiceNotesSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const db = getDb();
  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      category: true,
      user: { select: { email: true, name: true } },
    },
  });

  if (!booking) {
    return c.json({ error: "Booking not found" }, 404);
  }
  if (user.role === "COACH" && booking.coachId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const sections = parsed.data.noteSections;
  const SECTION_LABELS: Array<[keyof NonNullable<typeof sections>, string]> = [
    ["intro", "Intro"],
    ["scalesExercises", "Exercises done"],
    ["topics", "Topics discussed"],
    ["songWork", "Song work"],
    ["nextTime", "Next time"],
  ];

  const flatFromSections = sections
    ? SECTION_LABELS
        .map(([key, label]) => {
          const v = (sections[key] ?? "").trim();
          return v ? `${label}\n${v}` : null;
        })
        .filter(Boolean)
        .join("\n\n")
    : "";

  const practiceNotesText = (parsed.data.practiceNotes?.trim() || flatFromSections).trim();

  const updated = await db.booking.update({
    where: { id },
    data: {
      practiceNotes: practiceNotesText,
      noteSections: sections ? JSON.stringify(sections) : null,
      practiceNotesSentAt: new Date(),
      status: booking.status === "CONFIRMED" ? "COMPLETED" : booking.status,
      completedAt: booking.completedAt ?? new Date(),
    },
    include: bookingInclude,
  });

  // Send practice notes email
  try {
    const apiKey = (c.env as any)?.RESEND_API_KEY || process.env.RESEND_API_KEY || "";
    const from = (c.env as any)?.EMAIL_FROM || process.env.EMAIL_FROM || "noreply@sunbird.io";
    const email = createEmailService(apiKey, from);
    email.sendPracticeNotes(
      booking.user.email,
      booking.user.name,
      booking.category?.title ?? "Lesson",
      "Open",
      practiceNotesText,
    ).catch(console.error);
  } catch {}

  return c.json({ data: serializeBooking(updated) });
});

// ─── Recurring Schedules ───

// POST /api/bookings/recurring — create a recurring schedule with bookings
bookingRoutes.post("/recurring", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = createRecurringScheduleSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const { categoryId, skillTreeId, nodeId, coachId, startsAt: startsAtStr, frequency, endsOn: endsOnStr, mode, studentNote } = parsed.data;
  const db = getDb();

  // Verify category and coach
  const category = await db.category.findUnique({ where: { id: categoryId } });
  if (!category) return c.json({ error: "Category not found" }, 404);

  const coachTeaches = await db.coachCategory.findFirst({ where: { coachId, categoryId } });
  if (!coachTeaches) return c.json({ error: "Coach does not teach this category" }, 400);

  const firstStart = new Date(startsAtStr);
  const endsOn = new Date(endsOnStr + "T23:59:59Z");
  const dayOfWeek = firstStart.getUTCDay();
  const timeStr = `${String(firstStart.getUTCHours()).padStart(2, "0")}:${String(firstStart.getUTCMinutes()).padStart(2, "0")}`;

  // Verify coach availability for this day/time
  const coachAvail = await db.coachAvailability.findFirst({
    where: { coachId, dayOfWeek, startTime: timeStr, isActive: true },
  });
  if (!coachAvail) return c.json({ error: "Coach is not available at this time" }, 400);

  // Generate all dates
  const intervalDays = frequency === "BIWEEKLY" ? 14 : 7;
  const dates: Date[] = [];
  let current = new Date(firstStart);
  while (current <= endsOn) {
    if (current > new Date()) dates.push(new Date(current));
    current = new Date(current.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  }

  if (dates.length === 0) return c.json({ error: "No valid dates in the selected range" }, 400);

  // Check conflicts for all dates
  for (const date of dates) {
    const dateEnd = new Date(date.getTime() + LESSON_DURATION_MINS * 60 * 1000);
    const conflict = await db.booking.findFirst({
      where: {
        coachId,
        startsAt: { lt: dateEnd },
        endsAt: { gt: date },
        status: { not: "CANCELLED" },
      },
    });
    if (conflict) {
      return c.json({ error: `Time slot conflict on ${date.toISOString().split("T")[0]}` }, 409);
    }
  }

  // Does this coach charge? Drives whether we subscribe via Checkout.
  const coachPay: CoachPayInfo | null = await db.user.findUnique({
    where: { id: coachId },
    select: { stripeAccountId: true, stripeChargesEnabled: true, sessionPrice: true },
  });
  const needsPayment = requiresPayment(coachPay);

  // Create schedule
  const schedule = await db.recurringSchedule.create({
    data: {
      userId: user.id,
      coachId,
      lessonTypeId: null,
      categoryId,
      skillTreeId: skillTreeId ?? null,
      nodeId: nodeId ?? null,
      dayOfWeek,
      startTime: timeStr,
      frequency,
      mode,
      startsOn: dates[0],
      endsOn,
      status: "ACTIVE",
      paymentStatus: needsPayment ? "PENDING" : "NOT_REQUIRED",
    },
  });

  // Paid series: open a subscription Checkout and DEFER booking creation until
  // the webhook confirms payment (the schedule's bookings are created then).
  if (needsPayment && coachPay) {
    try {
      const checkoutUrl = await createSubscriptionCheckout(c, {
        coachAccountId: coachPay.stripeAccountId!,
        amountCents: coachPay.sessionPrice!,
        lessonTitle: `${category.title} (${frequency.toLowerCase()})`,
        scheduleId: schedule.id,
        frequency,
        studentEmail: user.email,
      });
      if (checkoutUrl) {
        return c.json({
          data: {
            schedule: {
              id: schedule.id, frequency: schedule.frequency, dayOfWeek: schedule.dayOfWeek,
              startTime: schedule.startTime, startsOn: schedule.startsOn.toISOString(),
              endsOn: schedule.endsOn.toISOString(), status: schedule.status,
            },
            bookings: [],
          },
          checkoutUrl,
        }, 201);
      }
    } catch (err) {
      console.error("Stripe subscription Checkout creation failed:", err);
      return c.json({ error: "Couldn't start payment. Please try again." }, 502);
    }
  }

  // Free series: create the bookings now (shared helper), then mirror calendar.
  const bookingRows = await createScheduleBookingRows(db, schedule, {
    paymentStatus: "NOT_REQUIRED",
    studentNote: studentNote ?? null,
  });
  const createdBookings = bookingRows.map(serializeBooking);
  const studentName = user.name ?? user.email ?? "student";
  for (const b of bookingRows) {
    await pushEventMirror(c, {
      coachId,
      bookingId: b.id,
      startsAt: new Date(b.startsAt),
      endsAt: new Date(b.endsAt),
      summary: `${studentName} · ${category.title}`,
      description: studentNote ?? undefined,
    });
  }

  // Notify the coach in their inbox — one summary message anchored on
  // the first booking, so the badge ticks up by 1 (not N).
  if (createdBookings.length > 0) {
    await notifyCoachOfBooking(db, {
      bookingId: createdBookings[0].id,
      studentId: user.id,
      coachId,
      content: `📅 Booked ${dates.length} ${frequency.toLowerCase()} ${category.title} lessons — starting ${formatDateTime(dates[0])}`,
    });
  }

  // Send confirmation email
  try {
    const apiKey = (c.env as any)?.RESEND_API_KEY || process.env.RESEND_API_KEY || "";
    const from = (c.env as any)?.EMAIL_FROM || process.env.EMAIL_FROM || "noreply@sunbird.io";
    const email = createEmailService(apiKey, from);
    email.sendBookingConfirmation(
      user.email, user.name, category.title,
      `${dates.length} ${frequency.toLowerCase()} sessions starting ${formatDateTime(dates[0])}`,
    ).catch(console.error);
  } catch {}

  return c.json({
    data: {
      schedule: {
        id: schedule.id,
        frequency: schedule.frequency,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        startsOn: schedule.startsOn.toISOString(),
        endsOn: schedule.endsOn.toISOString(),
        status: schedule.status,
      },
      bookings: createdBookings,
    },
  }, 201);
});

// POST /api/bookings/recurring/:scheduleId/cancel — cancel all future bookings in series
bookingRoutes.post("/recurring/:scheduleId/cancel", requireAuth, async (c) => {
  const user = c.get("user")!;
  const { scheduleId } = c.req.param();
  const db = getDb();

  const schedule = await db.recurringSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) return c.json({ error: "Schedule not found" }, 404);
  if (schedule.userId !== user.id && user.role !== "ADMIN") {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Cancel the schedule
  await db.recurringSchedule.update({ where: { id: scheduleId }, data: { status: "CANCELLED" } });

  // Cancel the backing Stripe subscription, if any (best-effort). The
  // subscription.deleted webhook will also fire, but cancelling here is idempotent.
  if (schedule.stripeSubscriptionId) {
    const key = stripeKey(c);
    if (key) {
      try {
        await makeStripe(key).subscriptions.cancel(schedule.stripeSubscriptionId);
      } catch (err) {
        console.error("Stripe subscription cancel failed:", err);
      }
    }
  }

  // Cancel all future confirmed bookings
  const now = new Date();
  const futureBookings = await db.booking.findMany({
    where: { scheduleId, status: "CONFIRMED", startsAt: { gt: now } },
  });

  for (const booking of futureBookings) {
    await db.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
    if (booking.coachId) {
      await deleteEventMirror(c, { coachId: booking.coachId, bookingId: booking.id });
    }
  }

  return c.json({ data: { ok: true, cancelledCount: futureBookings.length } });
});

// ─── Video Call ───
// Each participant gets their own Cloudflare Calls session (1 session = 1 PeerConnection).
// callSessionId stores a JSON map: { "userId1": "cfSessionId1", "userId2": "cfSessionId2" }

function parseCallSessions(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

// Atomically set a single key in the callSessionId JSON map using SQLite json_set.
// This avoids the race condition where two concurrent read-modify-write operations
// overwrite each other's keys.
async function atomicSaveSession(db: ReturnType<typeof getDb>, bookingId: string, key: string, sessionId: string) {
  await db.$executeRawUnsafe(
    `UPDATE "Booking" SET "callSessionId" = json_set(COALESCE("callSessionId", '{}'), '$.' || ?, ?) WHERE "id" = ?`,
    key,
    sessionId,
    bookingId,
  );
}

// POST /api/bookings/:id/call/join — returns peer info (no session created yet)
bookingRoutes.post("/:id/call/join", requireAuth, async (c) => {
  const { id } = c.req.param();
  const user = c.get("user")!;
  const db = getDb();

  const booking = await db.booking.findUnique({ where: { id } });
  if (!booking) return c.json({ error: "Booking not found" }, 404);

  if (user.role !== "ADMIN" && booking.userId !== user.id && booking.coachId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  if (booking.mode !== "ONLINE") {
    return c.json({ error: "This is not an online session" }, 400);
  }

  if (booking.status !== "CONFIRMED") {
    return c.json({ error: "This session is not active" }, 400);
  }

  const peerId = booking.userId === user.id ? booking.coachId : booking.userId;
  const sessions = parseCallSessions(booking.callSessionId);

  return c.json({
    data: {
      userId: user.id,
      peerId,
      peerSessionId: peerId ? (sessions[peerId] ?? null) : null,
    },
  });
});

// POST /api/bookings/:id/call/tracks — create CF session (if needed) and proxy track negotiation
bookingRoutes.post("/:id/call/tracks", requireAuth, async (c) => {
  const { id } = c.req.param();
  const user = c.get("user")!;
  const db = getDb();

  const booking = await db.booking.findUnique({ where: { id } });
  if (!booking) return c.json({ error: "Booking not found" }, 404);

  if (user.role !== "ADMIN" && booking.userId !== user.id && booking.coachId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const appId = (c.env as any)?.CF_CALLS_APP_ID || process.env.CF_CALLS_APP_ID || "";
  const appToken = (c.env as any)?.CF_CALLS_APP_TOKEN || process.env.CF_CALLS_APP_TOKEN || "";
  const callsService = createCallsService(appId, appToken);

  const sessionKey = user.id;
  let mySessionId = parseCallSessions(booking.callSessionId)[sessionKey];

  const body = await c.req.json();

  // Create a new CF session if one doesn't exist for this role
  if (!mySessionId) {
    const newSession = await callsService.createSession();
    mySessionId = newSession.sessionId;
    await atomicSaveSession(db, id, sessionKey, mySessionId);
  }

  // Try tracks negotiation; if session is stale (410/425), create fresh and retry
  let result;
  try {
    result = await callsService.newTracks(mySessionId, body);
  } catch (err: any) {
    if (err.message?.includes("410") || err.message?.includes("425")) {
      const freshSession = await callsService.createSession();
      mySessionId = freshSession.sessionId;
      await atomicSaveSession(db, id, sessionKey, mySessionId);
      result = await callsService.newTracks(mySessionId, body);
    } else {
      throw err;
    }
  }

  // Return the peer's session ID (what we pull from)
  const peerId = booking.userId === user.id ? booking.coachId : booking.userId;
  const latestBooking = await db.booking.findUnique({ where: { id } });
  const latestSessions = parseCallSessions(latestBooking?.callSessionId ?? null);
  const peerSessionId = peerId ? (latestSessions[peerId] ?? null) : null;

  return c.json({ data: { ...result, mySessionId, peerSessionId } });
});

// POST /api/bookings/:id/call/pull — dedicated pull session for receiving remote tracks
bookingRoutes.post("/:id/call/pull", requireAuth, async (c) => {
  const { id } = c.req.param();
  const user = c.get("user")!;
  const db = getDb();

  const booking = await db.booking.findUnique({ where: { id } });
  if (!booking) return c.json({ error: "Booking not found" }, 404);

  if (user.role !== "ADMIN" && booking.userId !== user.id && booking.coachId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const appId = (c.env as any)?.CF_CALLS_APP_ID || process.env.CF_CALLS_APP_ID || "";
  const appToken = (c.env as any)?.CF_CALLS_APP_TOKEN || process.env.CF_CALLS_APP_TOKEN || "";
  const callsService = createCallsService(appId, appToken);

  const body = await c.req.json();

  // Always create a fresh pull session — each pull attempt uses a new PeerConnection
  const newSession = await callsService.createSession();
  const pullSessionId = newSession.sessionId;
  await atomicSaveSession(db, id, `${user.id}:pull`, pullSessionId);

  const result = await callsService.newTracks(pullSessionId, body);

  return c.json({ data: { ...result } });
});

// PUT /api/bookings/:id/call/renegotiate — proxy SDP renegotiation
bookingRoutes.put("/:id/call/renegotiate", requireAuth, async (c) => {
  const { id } = c.req.param();
  const user = c.get("user")!;
  const db = getDb();

  const booking = await db.booking.findUnique({ where: { id } });
  if (!booking) return c.json({ error: "Booking not found" }, 404);

  if (user.role !== "ADMIN" && booking.userId !== user.id && booking.coachId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const sessions = parseCallSessions(booking.callSessionId);
  const mySessionId = sessions[user.id];
  if (!mySessionId) {
    return c.json({ error: "No active session for this user" }, 400);
  }

  const appId = (c.env as any)?.CF_CALLS_APP_ID || process.env.CF_CALLS_APP_ID || "";
  const appToken = (c.env as any)?.CF_CALLS_APP_TOKEN || process.env.CF_CALLS_APP_TOKEN || "";
  const callsService = createCallsService(appId, appToken);

  const body = await c.req.json();
  const result = await callsService.renegotiate(mySessionId, body.sessionDescription);

  return c.json({ data: result });
});

// ─── Session Messages ───

const senderSelect = { id: true, name: true, avatarUrl: true, bio: true };

function serializeMessage(m: any) {
  return {
    id: m.id,
    bookingId: m.bookingId,
    sender: m.sender,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  };
}

function serializeResource(r: any) {
  return {
    id: r.id,
    bookingId: r.bookingId,
    type: r.type,
    title: r.title,
    url: r.url,
    addedBy: r.addedBy,
    createdAt: r.createdAt.toISOString(),
  };
}

/** Checks that the authenticated user is a participant (student, coach, or admin). */
async function requireBookingParticipant(c: any): Promise<{ booking: any } | Response> {
  const { id } = c.req.param();
  const user = c.get("user")!;
  const db = getDb();

  const booking = await db.booking.findUnique({ where: { id } });
  if (!booking) return c.json({ error: "Booking not found" }, 404);

  if (user.role !== "ADMIN" && booking.userId !== user.id && booking.coachId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }
  return { booking };
}

// GET /api/bookings/:id/messages
bookingRoutes.get("/:id/messages", requireAuth, async (c) => {
  try {
    const check = await requireBookingParticipant(c);
    if (check instanceof Response) return check;

    const db = getDb();
    const messages = await db.sessionMessage.findMany({
      where: { bookingId: check.booking.id },
      include: { sender: { select: senderSelect } },
      orderBy: { createdAt: "asc" },
    });

    return c.json({ data: messages.map(serializeMessage) });
  } catch (err: any) {
    console.error("Messages error:", err.message, err.stack);
    return c.json({ error: err.message, stack: err.stack }, 500);
  }
});

// POST /api/bookings/:id/messages
bookingRoutes.post("/:id/messages", requireAuth, async (c) => {
  const check = await requireBookingParticipant(c);
  if (check instanceof Response) return check;

  const body = await c.req.json();
  const parsed = createSessionMessageSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const user = c.get("user")!;
  const db = getDb();
  const message = await db.sessionMessage.create({
    data: {
      bookingId: check.booking.id,
      senderId: user.id,
      content: parsed.data.content,
    },
    include: { sender: { select: senderSelect } },
  });

  return c.json({ data: serializeMessage(message) }, 201);
});

// ─── Session Resources ───

// GET /api/bookings/:id/resources
bookingRoutes.get("/:id/resources", requireAuth, async (c) => {
  const check = await requireBookingParticipant(c);
  if (check instanceof Response) return check;

  const db = getDb();
  const resources = await db.sessionResource.findMany({
    where: { bookingId: check.booking.id },
    include: { addedBy: { select: senderSelect } },
    orderBy: { createdAt: "desc" },
  });

  return c.json({ data: resources.map(serializeResource) });
});

// POST /api/bookings/:id/resources
bookingRoutes.post("/:id/resources", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const check = await requireBookingParticipant(c);
  if (check instanceof Response) return check;

  const body = await c.req.json();
  const parsed = createSessionResourceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const user = c.get("user")!;
  const db = getDb();
  const resource = await db.sessionResource.create({
    data: {
      bookingId: check.booking.id,
      addedById: user.id,
      type: parsed.data.type,
      title: parsed.data.title,
      url: parsed.data.url,
    },
    include: { addedBy: { select: senderSelect } },
  });

  return c.json({ data: serializeResource(resource) }, 201);
});

// DELETE /api/bookings/:id/resources/:resourceId
bookingRoutes.delete("/:id/resources/:resourceId", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const check = await requireBookingParticipant(c);
  if (check instanceof Response) return check;

  const { resourceId } = c.req.param();
  const db = getDb();

  const resource = await db.sessionResource.findFirst({
    where: { id: resourceId, bookingId: check.booking.id },
  });
  if (!resource) return c.json({ error: "Resource not found" }, 404);

  await db.sessionResource.delete({ where: { id: resourceId } });
  return c.json({ data: { ok: true } });
});
