import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { createAvailabilitySchema } from "@sunbird/shared";

export const availabilityRoutes = new Hono();

const LESSON_DURATION_MINS = 60;

type Slot = { startsAt: string; endsAt: string; coachIds: string[] };

// Computes the bookable slots for a single UTC date. Shared by the per-date
// endpoint and the "upcoming" scan so both stay in lockstep. Everything is
// UTC-anchored to match booking validation (see the note in GET "/").
async function computeSlotsForDate(
  db: ReturnType<typeof getDb>,
  dateStr: string,
  opts: { categoryId?: string; coachId?: string; now?: Date } = {},
): Promise<Slot[]> {
  const dayOfWeek = new Date(dateStr + "T00:00:00Z").getUTCDay();
  const now = opts.now ?? new Date();

  // Per-coach availability for this day-of-week.
  const coachSlots = await db.coachAvailability.findMany({
    where: { dayOfWeek, isActive: true },
    orderBy: { startTime: "asc" },
  });
  if (coachSlots.length === 0) return [];

  // If a category is given, restrict to coaches who teach it.
  let qualifiedCoachIds: Set<string> | null = null;
  if (opts.categoryId) {
    const coachCategories = await db.coachCategory.findMany({
      where: { categoryId: opts.categoryId },
      select: { coachId: true },
    });
    qualifiedCoachIds = new Set(coachCategories.map((cc: any) => cc.coachId));
  }

  const dayStart = new Date(dateStr + "T00:00:00Z");
  const dayEnd = new Date(dateStr + "T23:59:59Z");

  // Existing bookings, date-specific busy blocks, and Google Calendar shadows
  // all block a slot (busy/shadows take precedence over availability).
  const bookings = await db.booking.findMany({
    where: { startsAt: { gte: dayStart, lte: dayEnd }, status: { not: "CANCELLED" } },
    select: { coachId: true, startsAt: true, endsAt: true },
  });
  const busyBlocks = await db.coachBusy.findMany({
    where: { startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
    select: { coachId: true, startsAt: true, endsAt: true },
  });
  const googleShadows = await db.googleEvent.findMany({
    where: { bookingId: null, busyId: null, startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
    select: { coachId: true, startsAt: true, endsAt: true },
  });

  const timeToCoaches = new Map<string, Set<string>>();
  for (const slot of coachSlots) {
    const coachId = (slot as any).coachId as string;

    // Pinned-coach booking: ignore every other coach's slots.
    if (opts.coachId && coachId !== opts.coachId) continue;
    // Skip if coach doesn't teach this category.
    if (qualifiedCoachIds && !qualifiedCoachIds.has(coachId)) continue;

    const startsAt = new Date(`${dateStr}T${slot.startTime}:00Z`);
    const endsAt = new Date(startsAt.getTime() + LESSON_DURATION_MINS * 60 * 1000);

    if (startsAt <= now) continue; // past slot
    if (bookings.some((b: any) => b.coachId === coachId && startsAt < b.endsAt && endsAt > b.startsAt)) continue;
    if (busyBlocks.some((bb: any) => bb.coachId === coachId && startsAt < bb.endsAt && endsAt > bb.startsAt)) continue;
    if (googleShadows.some((g: any) => g.coachId === coachId && startsAt < g.endsAt && endsAt > g.startsAt)) continue;

    const key = startsAt.toISOString();
    if (!timeToCoaches.has(key)) timeToCoaches.set(key, new Set());
    timeToCoaches.get(key)!.add(coachId);
  }

  return Array.from(timeToCoaches.entries())
    .map(([startsAt, coachIds]) => ({
      startsAt,
      endsAt: new Date(new Date(startsAt).getTime() + LESSON_DURATION_MINS * 60 * 1000).toISOString(),
      coachIds: Array.from(coachIds),
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// GET /api/availability?date=YYYY-MM-DD&lessonTypeId=X — available time slots
availabilityRoutes.get("/", async (c) => {
  const dateStr = c.req.query("date");
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return c.json({ error: "date query parameter required (YYYY-MM-DD)" }, 400);
  }

  // Everything in this endpoint is UTC-anchored: slots are built as
  // `${dateStr}T${startTime}:00Z` and booking validation matches on
  // startsAt.getUTCDay()/getUTCHours() (bookings.ts). So we parse the date,
  // derive the day-of-week, and bound past/future all in UTC — otherwise a
  // non-UTC dev server (Workers run in UTC, but `tsx` dev runs local) would
  // pick a different day-of-week here than booking validation accepts.
  const date = new Date(dateStr + "T00:00:00Z");
  if (isNaN(date.getTime())) {
    return c.json({ error: "Invalid date" }, 400);
  }

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (date < today) {
    return c.json({ error: "Cannot book dates in the past" }, 400);
  }

  const maxDate = new Date(today);
  maxDate.setUTCDate(maxDate.getUTCDate() + 30);
  if (date > maxDate) {
    return c.json({ error: "Cannot book more than 30 days ahead" }, 400);
  }

  const categoryId = c.req.query("categoryId");
  // When booking from a specific coach's page the flow is pinned to them, so
  // only that coach's slots should come back.
  const coachIdFilter = c.req.query("coachId");
  const db = getDb();

  const available = await computeSlotsForDate(db, dateStr, {
    categoryId,
    coachId: coachIdFilter,
    now,
  });

  return c.json({ data: available });
});

// GET /api/availability/upcoming?days=N&categoryId=&coachId= — the soonest
// bookable slots across the next N days (default 14, capped at 30), so the
// booking UI can show times up front without making the student pick a date
// first. Returns a flat, time-sorted list; the client groups it by day.
availabilityRoutes.get("/upcoming", async (c) => {
  const categoryId = c.req.query("categoryId");
  const coachId = c.req.query("coachId");
  const daysParam = Number(c.req.query("days"));
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 30) : 14;

  const db = getDb();
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const MAX_SLOTS = 60;
  const out: Slot[] = [];
  // Start at today (i=0) so later-today slots count; computeSlotsForDate drops
  // anything already past.
  for (let i = 0; i <= days && out.length < MAX_SLOTS; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const slots = await computeSlotsForDate(db, dateStr, { categoryId, coachId, now });
    out.push(...slots);
  }

  return c.json({ data: out.slice(0, MAX_SLOTS) });
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
