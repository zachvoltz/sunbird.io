import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { createAvailabilitySchema } from "@sunbird/shared";

export const availabilityRoutes = new Hono();

const LESSON_DURATION_MINS = 60;

// GET /api/availability?date=YYYY-MM-DD — available time slots for a date
availabilityRoutes.get("/", async (c) => {
  const dateStr = c.req.query("date");
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return c.json({ error: "date query parameter required (YYYY-MM-DD)" }, 400);
  }

  const date = new Date(dateStr + "T00:00:00");
  if (isNaN(date.getTime())) {
    return c.json({ error: "Invalid date" }, 400);
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date < today) {
    return c.json({ error: "Cannot book dates in the past" }, 400);
  }

  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 30);
  if (date > maxDate) {
    return c.json({ error: "Cannot book more than 30 days ahead" }, 400);
  }

  const dayOfWeek = date.getDay();
  const db = getDb();

  // Get availability slots for this day of week
  const slots = await db.availabilitySlot.findMany({
    where: { dayOfWeek, isActive: true },
    orderBy: { startTime: "asc" },
  });

  // Get existing bookings for this date (not cancelled)
  const dayStart = new Date(dateStr + "T00:00:00Z");
  const dayEnd = new Date(dateStr + "T23:59:59Z");

  const bookings = await db.booking.findMany({
    where: {
      startsAt: { gte: dayStart, lte: dayEnd },
      status: { not: "CANCELLED" },
    },
    select: { startsAt: true, endsAt: true },
  });

  // Generate concrete time slots and filter out booked ones
  const available = slots
    .map((slot) => {
      const startsAt = new Date(`${dateStr}T${slot.startTime}:00Z`);
      const endsAt = new Date(startsAt.getTime() + LESSON_DURATION_MINS * 60 * 1000);
      return { startsAt, endsAt };
    })
    .filter((slot) => {
      // Filter out slots in the past
      if (slot.startsAt <= now) return false;
      // Filter out slots that overlap with existing bookings
      return !bookings.some(
        (b) => slot.startsAt < b.endsAt && slot.endsAt > b.startsAt,
      );
    })
    .map((slot) => ({
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
    }));

  return c.json({ data: available });
});

// POST /api/availability — create availability slot (teacher/admin)
availabilityRoutes.post("/", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const body = await c.req.json();
  const parsed = createAvailabilitySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const db = getDb();
  const slot = await db.availabilitySlot.create({
    data: parsed.data,
  });

  return c.json({ data: slot }, 201);
});

// GET /api/availability/slots — list all availability slots (teacher/admin)
availabilityRoutes.get("/slots", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const db = getDb();
  const slots = await db.availabilitySlot.findMany({
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  return c.json({ data: slots });
});

// DELETE /api/availability/:id — remove a slot (teacher/admin)
availabilityRoutes.delete("/:id", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const { id } = c.req.param();
  const db = getDb();
  await db.availabilitySlot.delete({ where: { id } });
  return c.json({ data: { success: true } });
});
