import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { createPathSchema, updatePathSchema } from "@sunbird/shared";

export const pathRoutes = new Hono();

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed as T;
  } catch {
    return fallback;
  }
}

function serializeSummary(p: any, students: number) {
  const nodes = parseJson<any[]>(p.nodes, []);
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    sub: p.sub ?? null,
    shape: p.shape,
    status: p.status,
    coral: !!p.coral,
    lessons: Array.isArray(nodes) ? nodes.length : 0,
    students,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// GET /api/paths — list paths for the calling coach (with student counts)
pathRoutes.get("/", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const db = getDb();

  const paths = await db.path.findMany({
    where: { coachId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { assignments: true } } },
  });

  return c.json({
    data: paths.map((p: any) => serializeSummary(p, p._count?.assignments ?? 0)),
  });
});

// GET /api/paths/:slug — full path detail including nodes/edges +
// students currently on it (for the editor's right rail)
pathRoutes.get("/:slug", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const slug = c.req.param("slug");
  const db = getDb();

  const p: any = await db.path.findUnique({
    where: { coachId_slug: { coachId: user.id, slug } },
    include: {
      assignments: {
        include: { student: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { startedAt: "asc" },
      },
    },
  });
  if (!p) return c.json({ error: "Path not found" }, 404);

  const nodes = parseJson<any[]>(p.nodes, []);
  const edges = parseJson<any[]>(p.edges, []);

  return c.json({
    data: {
      ...serializeSummary(p, p.assignments.length),
      coachId: p.coachId,
      nodes,
      edges,
      studentsOnIt: p.assignments.map((a: any) => ({
        id: a.student.id,
        name: a.student.name,
        avatarUrl: a.student.avatarUrl ?? null,
        currentLessonId: a.currentLessonId ?? null,
        startedAt: a.startedAt.toISOString(),
      })),
    },
  });
});

// POST /api/paths — create a new path
pathRoutes.post("/", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = createPathSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const db = getDb();
  try {
    const created = await db.path.create({
      data: {
        coachId: user.id,
        slug: parsed.data.slug,
        title: parsed.data.title,
        sub: parsed.data.sub ?? null,
        shape: parsed.data.shape,
        status: parsed.data.status,
        coral: parsed.data.coral,
        nodes: JSON.stringify(parsed.data.nodes),
        edges: JSON.stringify(parsed.data.edges),
      },
    });
    return c.json({ data: serializeSummary(created, 0) }, 201);
  } catch (err: any) {
    if (String(err?.message ?? "").includes("Unique constraint")) {
      return c.json({ error: "A path with that slug already exists" }, 409);
    }
    throw err;
  }
});

// PUT /api/paths/:slug — partial update (slug, title, nodes, edges, etc.)
pathRoutes.put("/:slug", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const slug = c.req.param("slug");
  const body = await c.req.json();
  const parsed = updatePathSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const db = getDb();
  const existing = await db.path.findUnique({
    where: { coachId_slug: { coachId: user.id, slug } },
  });
  if (!existing) return c.json({ error: "Path not found" }, 404);

  const data: any = {};
  if (parsed.data.slug !== undefined) data.slug = parsed.data.slug;
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.sub !== undefined) data.sub = parsed.data.sub ?? null;
  if (parsed.data.shape !== undefined) data.shape = parsed.data.shape;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.coral !== undefined) data.coral = parsed.data.coral;
  if (parsed.data.nodes !== undefined) data.nodes = JSON.stringify(parsed.data.nodes);
  if (parsed.data.edges !== undefined) data.edges = JSON.stringify(parsed.data.edges);

  const updated = await db.path.update({
    where: { id: existing.id },
    data,
    include: { _count: { select: { assignments: true } } },
  });
  return c.json({ data: serializeSummary(updated, (updated as any)._count?.assignments ?? 0) });
});

// DELETE /api/paths/:slug — remove a path (and its assignments via cascade)
pathRoutes.delete("/:slug", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const slug = c.req.param("slug");
  const db = getDb();

  const existing = await db.path.findUnique({
    where: { coachId_slug: { coachId: user.id, slug } },
  });
  if (!existing) return c.json({ error: "Path not found" }, 404);

  await db.path.delete({ where: { id: existing.id } });
  return c.json({ data: { ok: true } });
});
