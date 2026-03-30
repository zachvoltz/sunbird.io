import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { createBookingSchema, practiceNotesSchema } from "@sunbird/shared";
import { createEmailService } from "../services/email.service";

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
    studentNote: b.studentNote,
    practiceNotes: b.practiceNotes,
    completedAt: b.completedAt?.toISOString() ?? null,
    usedSubscription: b.usedSubscription,
    createdAt: b.createdAt.toISOString(),
    user: b.user
      ? { id: b.user.id, name: b.user.name, avatarUrl: b.user.avatarUrl, bio: b.user.bio }
      : undefined,
  };
}

const bookingInclude = {
  lessonType: true,
  lessonCategory: true,
  user: { select: { id: true, name: true, avatarUrl: true, bio: true } },
};

// POST /api/bookings — create a booking
bookingRoutes.post("/", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const { lessonTypeId, lessonCategoryId, startsAt: startsAtStr, studentNote } = parsed.data;
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

  const startsAt = new Date(startsAtStr);
  const endsAt = new Date(startsAt.getTime() + LESSON_DURATION_MINS * 60 * 1000);

  // Check if the slot is in the past
  if (startsAt <= new Date()) {
    return c.json({ error: "Cannot book a time in the past" }, 400);
  }

  // Check for conflicting bookings
  const conflict = await db.booking.findFirst({
    where: {
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      status: { not: "CANCELLED" },
    },
  });

  if (conflict) {
    return c.json({ error: "This time slot is no longer available" }, 409);
  }

  // Verify the slot matches an availability window
  const dayOfWeek = startsAt.getUTCDay();
  const timeStr = `${String(startsAt.getUTCHours()).padStart(2, "0")}:${String(startsAt.getUTCMinutes()).padStart(2, "0")}`;
  const availSlot = await db.availabilitySlot.findFirst({
    where: {
      dayOfWeek,
      startTime: timeStr,
      isActive: true,
    },
  });

  if (!availSlot) {
    return c.json({ error: "This time is not within available hours" }, 400);
  }

  const booking = await db.booking.create({
    data: {
      userId: user.id,
      lessonTypeId,
      lessonCategoryId: lessonCategoryId ?? null,
      startsAt,
      endsAt,
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
  }
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
    email.sendBookingCancellation(booking.user.email, booking.user.name, booking.lessonType.title, formatDateTime(booking.startsAt)).catch(console.error);
  } catch {}

  return c.json({ data: serializeBooking(updated) });
});

// PATCH /api/bookings/:id/complete — mark lesson as completed (teacher/admin)
bookingRoutes.patch("/:id/complete", requireAuth, requireRole("TEACHER", "ADMIN"), async (c) => {
  const { id } = c.req.param();
  const db = getDb();

  const booking = await db.booking.findUnique({ where: { id } });
  if (!booking) {
    return c.json({ error: "Booking not found" }, 404);
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

// PATCH /api/bookings/:id/notes — add practice notes and email student (teacher/admin)
bookingRoutes.patch("/:id/notes", requireAuth, requireRole("TEACHER", "ADMIN"), async (c) => {
  const { id } = c.req.param();
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
