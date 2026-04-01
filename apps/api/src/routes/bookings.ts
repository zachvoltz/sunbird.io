import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { createBookingSchema, practiceNotesSchema, createSessionMessageSchema, createSessionResourceSchema } from "@sunbird/shared";
import { createEmailService } from "../services/email.service";
import { createZoomService } from "../services/zoom.service";
import { createZoomClient } from "../lib/oauth";

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
    lessonType: {
      id: b.lessonType.id,
      slug: b.lessonType.slug,
      title: b.lessonType.title,
      subtitle: b.lessonType.subtitle,
      description: b.lessonType.description,
      imageUrl: b.lessonType.imageUrl,
      pricePerSession: b.lessonType.pricePerSession,
    },
    lessonCategory: b.lessonCategory
      ? {
          id: b.lessonCategory.id,
          slug: b.lessonCategory.slug,
          title: b.lessonCategory.title,
          description: b.lessonCategory.description,
        }
      : null,
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
  lessonType: true,
  lessonCategory: true,
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

  const { lessonTypeId, lessonCategoryId, coachId: providedCoachId, startsAt: startsAtStr, mode, studentNote } = parsed.data;
  const db = getDb();

  // Verify lesson type exists
  const lessonType = await db.lessonType.findUnique({ where: { id: lessonTypeId } });
  if (!lessonType) {
    return c.json({ error: "Lesson type not found" }, 404);
  }

  // Verify category belongs to this lesson type (if provided)
  if (lessonCategoryId) {
    const category = await db.lessonCategory.findFirst({
      where: { id: lessonCategoryId, lessonTypeId },
    });
    if (!category) {
      return c.json({ error: "Lesson category not found for this lesson type" }, 400);
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

  // Verify coach teaches this lesson type
  if (coachId) {
    const coachTeaches = await db.coachLessonType.findFirst({
      where: { coachId, lessonTypeId },
    });
    if (!coachTeaches) {
      return c.json({ error: "This coach does not teach this lesson type" }, 400);
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

  // If online, create Zoom meeting before persisting the booking
  let meetingUrl: string | null = null;
  let meetingId: string | null = null;
  let meetingProvider: string | null = null;

  if (mode === "ONLINE" && coachId) {
    try {
      const clientId = (c.env as any)?.ZOOM_CLIENT_ID || process.env.ZOOM_CLIENT_ID || "";
      const clientSecret = (c.env as any)?.ZOOM_CLIENT_SECRET || process.env.ZOOM_CLIENT_SECRET || "";
      const redirectUri = (c.env as any)?.ZOOM_REDIRECT_URI || process.env.ZOOM_REDIRECT_URI || "";
      const zoom = createZoomClient(clientId, clientSecret, redirectUri);
      const zoomService = createZoomService(db, zoom);

      const meeting = await zoomService.createMeeting(coachId, {
        topic: `Sunbird: ${lessonType.title} lesson`,
        startTime: startsAt.toISOString(),
        duration: LESSON_DURATION_MINS,
        inviteeEmail: user.email,
      });

      meetingUrl = meeting.joinUrl;
      meetingId = meeting.meetingId;
      meetingProvider = "zoom";
    } catch (err) {
      console.error("Zoom meeting creation failed:", err);
      return c.json({ error: "Failed to create Zoom meeting. Please ensure your coach has Zoom connected." }, 400);
    }
  }

  const booking = await db.booking.create({
    data: {
      userId: user.id,
      coachId,
      lessonTypeId,
      lessonCategoryId: lessonCategoryId ?? null,
      startsAt,
      endsAt,
      mode,
      meetingUrl,
      meetingId,
      meetingProvider,
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
    email.sendBookingConfirmation(user.email, user.name, lessonType.title, formatDateTime(startsAt)).catch(console.error);
  } catch {}

  return c.json({ data: serializeBooking(booking) }, 201);
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
    include: { lessonType: true, user: { select: { email: true, name: true } } },
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

  // Delete Zoom meeting if online (fire and forget)
  if (booking.meetingId && booking.meetingProvider === "zoom" && booking.coachId) {
    try {
      const clientId = (c.env as any)?.ZOOM_CLIENT_ID || process.env.ZOOM_CLIENT_ID || "";
      const clientSecret = (c.env as any)?.ZOOM_CLIENT_SECRET || process.env.ZOOM_CLIENT_SECRET || "";
      const redirectUri = (c.env as any)?.ZOOM_REDIRECT_URI || process.env.ZOOM_REDIRECT_URI || "";
      const zoom = createZoomClient(clientId, clientSecret, redirectUri);
      const zoomService = createZoomService(db, zoom);
      zoomService.deleteMeeting(booking.coachId, booking.meetingId).catch(console.error);
    } catch {}
  }

  // Send cancellation email
  try {
    const apiKey = (c.env as any)?.RESEND_API_KEY || process.env.RESEND_API_KEY || "";
    const from = (c.env as any)?.EMAIL_FROM || process.env.EMAIL_FROM || "noreply@sunbird.io";
    const email = createEmailService(apiKey, from);
    email.sendBookingCancellation(booking.user.email, booking.user.name, booking.lessonType.title, formatDateTime(booking.startsAt)).catch(console.error);
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
      lessonType: true,
      lessonCategory: true,
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
      booking.lessonType.title,
      booking.lessonCategory?.title ?? "Open",
      parsed.data.practiceNotes,
    ).catch(console.error);
  } catch {}

  return c.json({ data: serializeBooking(updated) });
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
  const check = await requireBookingParticipant(c);
  if (check instanceof Response) return check;

  const db = getDb();
  const messages = await db.sessionMessage.findMany({
    where: { bookingId: check.booking.id },
    include: { sender: { select: senderSelect } },
    orderBy: { createdAt: "asc" },
  });

  return c.json({ data: messages.map(serializeMessage) });
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
