import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { createCoachBusySchema } from "@sunbird/shared";
import { pushEventMirror, deleteEventMirror } from "./google-calendar";

export const coachBusyRoutes = new Hono();

function serializeBusy(b: any) {
  return {
    id: b.id,
    coachId: b.coachId,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    label: b.label ?? null,
    createdAt: b.createdAt.toISOString(),
  };
}

// GET /api/coach-busy?from=ISO&to=ISO — list this coach's busy blocks.
// Defaults to a 90-day window starting today if no range is provided.
coachBusyRoutes.get("/", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const from = c.req.query("from");
  const to = c.req.query("to");
  const now = new Date();
  const start = from ? new Date(from) : new Date(now.getTime() - 7 * 86_400_000);
  const end = to ? new Date(to) : new Date(now.getTime() + 90 * 86_400_000);

  const db = getDb();
  const rows = await db.coachBusy.findMany({
    where: {
      coachId: user.id,
      // Overlap test: row.startsAt < end AND row.endsAt > start
      startsAt: { lt: end },
      endsAt: { gt: start },
    },
    orderBy: { startsAt: "asc" },
  });

  return c.json({ data: rows.map(serializeBusy) });
});

// POST /api/coach-busy — create a new busy block for the calling coach.
coachBusyRoutes.post("/", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = createCoachBusySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const db = getDb();
  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(parsed.data.endsAt);
  const label = parsed.data.label ?? null;
  const created = await db.coachBusy.create({
    data: { coachId: user.id, startsAt, endsAt, label },
  });

  // Mirror onto Google Calendar (best-effort).
  await pushEventMirror(c, {
    coachId: user.id,
    busyId: created.id,
    startsAt,
    endsAt,
    summary: label ? `Busy · ${label}` : "Busy",
  });

  return c.json({ data: serializeBusy(created) });
});

// DELETE /api/coach-busy/:id — remove a busy block (must own it).
coachBusyRoutes.delete("/:id", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const db = getDb();

  const existing = await db.coachBusy.findUnique({ where: { id } });
  if (!existing) {
    return c.json({ error: "Not found" }, 404);
  }
  if (existing.coachId !== user.id && user.role !== "ADMIN") {
    return c.json({ error: "Forbidden" }, 403);
  }

  // Drop the Google mirror first; the cascade on GoogleEvent.busyId
  // is SET NULL, which would leave an orphan row otherwise.
  await deleteEventMirror(c, { coachId: existing.coachId, busyId: id });
  await db.coachBusy.delete({ where: { id } });
  return c.json({ data: { ok: true } });
});
