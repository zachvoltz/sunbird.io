import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { createAvailabilitySchema } from "@sunbird/shared";

export const availabilityRoutes = new Hono();

const LESSON_DURATION_MINS = 60;

// GET /api/availability?date=YYYY-MM-DD&lessonTypeId=X — available time slots
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
  const categoryId = c.req.query("categoryId");
  const db = getDb();

  // Get per-coach availability for this day
  const coachSlots = await db.coachAvailability.findMany({
    where: { dayOfWeek, isActive: true },
    orderBy: { startTime: "asc" },
  });

  if (coachSlots.length === 0) {
    return c.json({ data: [] });
  }

  // If categoryId provided, filter to coaches who teach it
  let qualifiedCoachIds: Set<string> | null = null;
  if (categoryId) {
    const coachCategories = await db.coachCategory.findMany({
      where: { categoryId },
      select: { coachId: true },
    });
    qualifiedCoachIds = new Set(coachCategories.map((cc: any) => cc.coachId));
  }

  // Get existing bookings for this date (not cancelled), per coach
  const dayStart = new Date(dateStr + "T00:00:00Z");
  const dayEnd = new Date(dateStr + "T23:59:59Z");

  const bookings = await db.booking.findMany({
    where: {
      startsAt: { gte: dayStart, lte: dayEnd },
      status: { not: "CANCELLED" },
    },
    select: { coachId: true, startsAt: true, endsAt: true },
  });

  // Build a map: time string -> set of available coach IDs
  const timeToCoaches = new Map<string, Set<string>>();

  for (const slot of coachSlots) {
    const coachId = (slot as any).coachId as string;

    // Skip if coach doesn't teach this lesson type
    if (qualifiedCoachIds && !qualifiedCoachIds.has(coachId)) continue;

    const startsAt = new Date(`${dateStr}T${slot.startTime}:00Z`);
    const endsAt = new Date(startsAt.getTime() + LESSON_DURATION_MINS * 60 * 1000);

    // Skip past slots
    if (startsAt <= now) continue;

    // Check if this coach has a conflicting booking
    const hasConflict = bookings.some(
      (b: any) => b.coachId === coachId && startsAt < b.endsAt && endsAt > b.startsAt,
    );
    if (hasConflict) continue;

    const key = startsAt.toISOString();
    if (!timeToCoaches.has(key)) {
      timeToCoaches.set(key, new Set());
    }
    timeToCoaches.get(key)!.add(coachId);
  }

  // Convert to response array
  const available = Array.from(timeToCoaches.entries())
    .map(([startsAt, coachIds]) => ({
      startsAt,
      endsAt: new Date(new Date(startsAt).getTime() + LESSON_DURATION_MINS * 60 * 1000).toISOString(),
      coachIds: Array.from(coachIds),
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return c.json({ data: available });
});

// POST /api/availability — create availability slot (legacy global, kept for backward compat)
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

// GET /api/availability/slots — list all availability slots (legacy)
availabilityRoutes.get("/slots", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const db = getDb();
  const slots = await db.availabilitySlot.findMany({
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  return c.json({ data: slots });
});

// DELETE /api/availability/:id — remove a slot (legacy)
availabilityRoutes.delete("/:id", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const { id } = c.req.param();
  const db = getDb();
  await db.availabilitySlot.delete({ where: { id } });
  return c.json({ data: { success: true } });
});
