import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { createLibraryItemSchema, updateLibraryItemSchema } from "@sunbird/shared";

export const libraryRoutes = new Hono();

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function serialize(it: any) {
  return {
    id: it.id,
    coachId: it.coachId,
    kind: it.kind,
    title: it.title,
    subtitle: it.subtitle ?? null,
    tags: parseTags(it.tags),
    bpmStart: it.bpmStart ?? null,
    bpmEnd: it.bpmEnd ?? null,
    durationMin: it.durationMin ?? null,
    hasMidi: !!it.hasMidi,
    midiUrl: it.midiUrl ?? null,
    pdfUrl: it.pdfUrl ?? null,
    audioUrl: it.audioUrl ?? null,
    sortOrder: it.sortOrder ?? 0,
    createdAt: it.createdAt.toISOString(),
    updatedAt: it.updatedAt.toISOString(),
  };
}

// GET /api/library — list this coach's library items, sorted by kind
// then sortOrder so the UI can group them in section order.
libraryRoutes.get("/", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  const items: any[] = await db.libraryItem.findMany({
    where: { coachId: user.id },
    orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return c.json({ data: items.map(serialize) });
});

// POST /api/library — create a new library item for the calling coach.
libraryRoutes.post("/", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = createLibraryItemSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }
  const db = getDb();
  const created = await db.libraryItem.create({
    data: {
      coachId: user.id,
      kind: parsed.data.kind,
      title: parsed.data.title,
      subtitle: parsed.data.subtitle ?? null,
      tags: JSON.stringify(parsed.data.tags ?? []),
      bpmStart: parsed.data.bpmStart ?? null,
      bpmEnd: parsed.data.bpmEnd ?? null,
      durationMin: parsed.data.durationMin ?? null,
      hasMidi: !!parsed.data.hasMidi,
      midiUrl: parsed.data.midiUrl ?? null,
      pdfUrl: parsed.data.pdfUrl ?? null,
      audioUrl: parsed.data.audioUrl ?? null,
    },
  });
  return c.json({ data: serialize(created) }, 201);
});

// PUT /api/library/:id — partial update
libraryRoutes.put("/:id", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = updateLibraryItemSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }
  const db = getDb();
  const existing = await db.libraryItem.findUnique({ where: { id } });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.coachId !== user.id && user.role !== "ADMIN") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const data: any = {};
  if (parsed.data.kind !== undefined) data.kind = parsed.data.kind;
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.subtitle !== undefined) data.subtitle = parsed.data.subtitle ?? null;
  if (parsed.data.tags !== undefined) data.tags = JSON.stringify(parsed.data.tags);
  if (parsed.data.bpmStart !== undefined) data.bpmStart = parsed.data.bpmStart ?? null;
  if (parsed.data.bpmEnd !== undefined) data.bpmEnd = parsed.data.bpmEnd ?? null;
  if (parsed.data.durationMin !== undefined) data.durationMin = parsed.data.durationMin ?? null;
  if (parsed.data.hasMidi !== undefined) data.hasMidi = !!parsed.data.hasMidi;
  if (parsed.data.midiUrl !== undefined) data.midiUrl = parsed.data.midiUrl ?? null;
  if (parsed.data.pdfUrl !== undefined) data.pdfUrl = parsed.data.pdfUrl ?? null;
  if (parsed.data.audioUrl !== undefined) data.audioUrl = parsed.data.audioUrl ?? null;

  const updated = await db.libraryItem.update({ where: { id }, data });
  return c.json({ data: serialize(updated) });
});

// DELETE /api/library/:id
libraryRoutes.delete("/:id", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const id = c.req.param("id");
  const db = getDb();
  const existing = await db.libraryItem.findUnique({ where: { id } });
  if (!existing) return c.json({ error: "Not found" }, 404);
  if (existing.coachId !== user.id && user.role !== "ADMIN") {
    return c.json({ error: "Forbidden" }, 403);
  }
  await db.libraryItem.delete({ where: { id } });
  return c.json({ data: { ok: true } });
});
