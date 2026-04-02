import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { createBookingSchema, createRecurringScheduleSchema, practiceNotesSchema, createSessionMessageSchema, createSessionResourceSchema } from "@sunbird/shared";
import { createEmailService } from "../services/email.service";
import { createCallsService } from "../services/calls.service";

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
    completedAt: b.completedAt?.toISOString() ?? null,
    usedSubscription: b.usedSubscription,
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

// POST /api/bookings — create a booking
bookingRoutes.post("/", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const { categoryId, skillTreeId, nodeId, coachId: providedCoachId, startsAt: startsAtStr, mode, studentNote } = parsed.data;
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

  // Check if the slot is in the past
  if (startsAt <= new Date()) {
    return c.json({ error: "Cannot book a time in the past" }, 400);
  }

  // Check for conflicting bookings (scoped to this coach if assigned)
  const conflictWhere: any = {
    startsAt: { lt: endsAt },
    endsAt: { gt: startsAt },
    status: { not: "CANCELLED" },
  };
  if (coachId) {
    conflictWhere.coachId = coachId;
  }

  const conflict = await db.booking.findFirst({ where: conflictWhere });
  if (conflict) {
    return c.json({ error: "This time slot is no longer available" }, 409);
  }

  // Verify coach teaches this category
  if (coachId) {
    const coachTeaches = await db.coachCategory.findFirst({
      where: { coachId, categoryId },
    });
    if (!coachTeaches) {
      return c.json({ error: "This coach does not teach this category" }, 400);
    }
  }

  // Verify the slot matches the coach's availability
  const dayOfWeek = startsAt.getUTCDay();
  const timeStr = `${String(startsAt.getUTCHours()).padStart(2, "0")}:${String(startsAt.getUTCMinutes()).padStart(2, "0")}`;

  if (coachId) {
    const coachAvail = await db.coachAvailability.findFirst({
      where: { coachId, dayOfWeek, startTime: timeStr, isActive: true },
    });
    if (!coachAvail) {
      return c.json({ error: "This time is not within the coach's available hours" }, 400);
    }
  } else {
    // Fallback to global slots if no coach assigned
    const availSlot = await db.availabilitySlot.findFirst({
      where: { dayOfWeek, startTime: timeStr, isActive: true },
    });
    if (!availSlot) {
      return c.json({ error: "This time is not within available hours" }, 400);
    }
  }

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
    },
    include: bookingInclude,
  });

  // Send confirmation email (fire and forget)
  try {
    const apiKey = (c.env as any)?.RESEND_API_KEY || process.env.RESEND_API_KEY || "";
    const from = (c.env as any)?.EMAIL_FROM || process.env.EMAIL_FROM || "noreply@sunbird.io";
    const email = createEmailService(apiKey, from);
    email.sendBookingConfirmation(user.email, user.name, category.title, formatDateTime(startsAt)).catch(console.error);
  } catch {}

  return c.json({ data: serializeBooking(booking) }, 201);
});

// PATCH /api/bookings/:id/node — select/change node on a session
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

// PATCH /api/bookings/:id/cancel — cancel a booking
bookingRoutes.patch("/:id/cancel", requireAuth, async (c) => {
  const { id } = c.req.param();
  const user = c.get("user")!;
  const db = getDb();

  const booking = await db.booking.findUnique({
    where: { id },
    include: { category: true, user: { select: { email: true, name: true } } },
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

  // Send cancellation email
  try {
    const apiKey = (c.env as any)?.RESEND_API_KEY || process.env.RESEND_API_KEY || "";
    const from = (c.env as any)?.EMAIL_FROM || process.env.EMAIL_FROM || "noreply@sunbird.io";
    const email = createEmailService(apiKey, from);
    email.sendBookingCancellation(booking.user.email, booking.user.name, booking.category?.title ?? "Lesson", formatDateTime(booking.startsAt)).catch(console.error);
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

// PATCH /api/bookings/:id/notes — add practice notes and email student (coach/admin)
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

  const updated = await db.booking.update({
    where: { id },
    data: {
      practiceNotes: parsed.data.practiceNotes,
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
      parsed.data.practiceNotes,
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
    },
  });

  // Create bookings
  const createdBookings = [];
  for (const date of dates) {
    const endsAt = new Date(date.getTime() + LESSON_DURATION_MINS * 60 * 1000);

    const booking = await db.booking.create({
      data: {
        userId: user.id,
        coachId,
        lessonTypeId: null,
        categoryId,
        skillTreeId: skillTreeId ?? null,
        nodeId: nodeId ?? null,
        startsAt: date,
        endsAt,
        mode,
        studentNote: studentNote ?? null,
        scheduleId: schedule.id,
        status: "CONFIRMED",
      },
      include: bookingInclude,
    });

    createdBookings.push(serializeBooking(booking));
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

  // Cancel all future confirmed bookings
  const now = new Date();
  const futureBookings = await db.booking.findMany({
    where: { scheduleId, status: "CONFIRMED", startsAt: { gt: now } },
  });

  for (const booking of futureBookings) {
    await db.booking.update({ where: { id: booking.id }, data: { status: "CANCELLED" } });
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
      // Return peer's CF session ID if they've already joined (for pulling tracks)
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

  const sessions = parseCallSessions(booking.callSessionId);
  let mySessionId = sessions[user.id];

  const body = await c.req.json();

  // First tracks call for this user — create a new CF session with the SDP
  if (!mySessionId) {
    const newSession = await callsService.createSession();
    mySessionId = newSession.sessionId;

    // Store this user's session ID
    sessions[user.id] = mySessionId;
    await db.booking.update({
      where: { id },
      data: { callSessionId: JSON.stringify(sessions) },
    });
  }

  const result = await callsService.newTracks(mySessionId, body);

  // Return the peer's session ID alongside the track result so client can pull
  const peerId = booking.userId === user.id ? booking.coachId : booking.userId;
  const peerSessionId = peerId ? (sessions[peerId] ?? null) : null;

  return c.json({ data: { ...result, mySessionId, peerSessionId } });
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
