import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { hasCycle } from "../lib/graph";
import {
  createCurriculumSchema,
  saveCurriculumGraphSchema,
  markProgressSchema,
  unmarkProgressSchema,
  createNodeResourceSchema,
  createPracticeDrillSchema,
} from "@sunbird/shared";

export const curriculumRoutes = new Hono();

function serializeCurriculum(c: any) {
  return {
    id: c.id,
    coachId: c.coachId,
    lessonTypeId: c.lessonTypeId,
    title: c.title,
    description: c.description,
    nodes: (c.nodes ?? []).map((n: any) => ({
      id: n.id,
      title: n.title,
      description: n.description,
      positionX: n.positionX,
      positionY: n.positionY,
      color: n.color,
      resources: (n.resourceLinks ?? []).map((link: any) => ({
        id: link.resource.id,
        type: link.resource.type,
        title: link.resource.title,
        url: link.resource.url,
        createdAt: link.resource.createdAt.toISOString(),
      })),
      drills: (n.drills ?? []).map((d: any) => ({
        id: d.id,
        nodeId: d.nodeId,
        title: d.title,
        description: d.description,
        resourceId: d.resourceId,
      })),
    })),
    edges: (c.edges ?? []).map((e: any) => ({
      id: e.id,
      fromNodeId: e.fromNodeId,
      toNodeId: e.toNodeId,
    })),
  };
}

function serializeProgress(p: any) {
  return {
    id: p.id,
    studentId: p.studentId,
    nodeId: p.nodeId,
    coachId: p.coachId,
    completedAt: p.completedAt.toISOString(),
    notes: p.notes,
  };
}

// ─── Coach Endpoints ───

// GET /api/curriculum/:lessonTypeId — get coach's curriculum
curriculumRoutes.get("/:lessonTypeId", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const { lessonTypeId } = c.req.param();
  const db = getDb();

  const curriculum = await db.curriculum.findUnique({
    where: { coachId_lessonTypeId: { coachId: user.id, lessonTypeId } },
    include: { nodes: { orderBy: { sortOrder: "asc" }, include: { resourceLinks: { include: { resource: true } }, drills: { orderBy: { sortOrder: "asc" } } } }, edges: true },
  });

  if (!curriculum) {
    return c.json({ error: "Curriculum not found" }, 404);
  }

  return c.json({ data: serializeCurriculum(curriculum) });
});

// POST /api/curriculum — create new curriculum
curriculumRoutes.post("/", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = createCurriculumSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const db = getDb();

  // Verify coach teaches this lesson type
  const teaches = await db.coachLessonType.findFirst({
    where: { coachId: user.id, lessonTypeId: parsed.data.lessonTypeId },
  });
  if (!teaches) {
    return c.json({ error: "You do not teach this lesson type" }, 400);
  }

  // Check for existing
  const existing = await db.curriculum.findUnique({
    where: { coachId_lessonTypeId: { coachId: user.id, lessonTypeId: parsed.data.lessonTypeId } },
  });
  if (existing) {
    return c.json({ error: "Curriculum already exists for this lesson type" }, 409);
  }

  const curriculum = await db.curriculum.create({
    data: {
      coachId: user.id,
      lessonTypeId: parsed.data.lessonTypeId,
      title: parsed.data.title ?? null,
      description: parsed.data.description ?? null,
    },
    include: { nodes: { include: { resourceLinks: { include: { resource: true } }, drills: true } }, edges: true },
  });

  return c.json({ data: serializeCurriculum(curriculum) }, 201);
});

// PUT /api/curriculum/:curriculumId/graph — bulk save nodes + edges
curriculumRoutes.put("/:curriculumId/graph", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const { curriculumId } = c.req.param();
  const body = await c.req.json();
  const parsed = saveCurriculumGraphSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const db = getDb();

  const curriculum = await db.curriculum.findUnique({ where: { id: curriculumId } });
  if (!curriculum || curriculum.coachId !== user.id) {
    return c.json({ error: "Curriculum not found" }, 404);
  }

  // Cycle detection
  if (hasCycle(parsed.data.edges)) {
    return c.json({ error: "Curriculum graph contains a cycle. Prerequisites cannot be circular." }, 400);
  }

  // Delete existing nodes and edges (cascade deletes edges via node deletion)
  await db.curriculumEdge.deleteMany({ where: { curriculumId } });
  await db.curriculumNode.deleteMany({ where: { curriculumId } });

  // Create nodes
  for (let i = 0; i < parsed.data.nodes.length; i++) {
    const n = parsed.data.nodes[i];
    await db.curriculumNode.create({
      data: {
        id: n.id,
        curriculumId,
        title: n.title,
        description: n.description ?? null,
        positionX: n.positionX,
        positionY: n.positionY,
        color: n.color ?? null,
        sortOrder: i,
      },
    });
  }

  // Create edges
  for (const e of parsed.data.edges) {
    await db.curriculumEdge.create({
      data: {
        id: e.id,
        curriculumId,
        fromNodeId: e.fromNodeId,
        toNodeId: e.toNodeId,
      },
    });
  }

  // Return updated curriculum
  const updated = await db.curriculum.findUnique({
    where: { id: curriculumId },
    include: { nodes: { orderBy: { sortOrder: "asc" }, include: { resourceLinks: { include: { resource: true } }, drills: { orderBy: { sortOrder: "asc" } } } }, edges: true },
  });

  return c.json({ data: serializeCurriculum(updated) });
});

// DELETE /api/curriculum/:curriculumId — delete curriculum
curriculumRoutes.delete("/:curriculumId", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const { curriculumId } = c.req.param();
  const db = getDb();

  const curriculum = await db.curriculum.findUnique({ where: { id: curriculumId } });
  if (!curriculum || curriculum.coachId !== user.id) {
    return c.json({ error: "Curriculum not found" }, 404);
  }

  await db.curriculum.delete({ where: { id: curriculumId } });
  return c.json({ data: { ok: true } });
});

// ─── Progress Endpoints ───

// GET /api/curriculum/:curriculumId/progress/:studentId
curriculumRoutes.get("/:curriculumId/progress/:studentId", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const { curriculumId, studentId } = c.req.param();
  const db = getDb();

  const curriculum = await db.curriculum.findUnique({
    where: { id: curriculumId },
    include: { nodes: { select: { id: true } } },
  });
  if (!curriculum) {
    return c.json({ error: "Curriculum not found" }, 404);
  }

  const nodeIds = curriculum.nodes.map((n: any) => n.id);
  const progress = await db.studentProgress.findMany({
    where: { studentId, nodeId: { in: nodeIds } },
  });

  return c.json({ data: progress.map(serializeProgress) });
});

// POST /api/curriculum/:curriculumId/progress — mark node complete
curriculumRoutes.post("/:curriculumId/progress", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const { curriculumId } = c.req.param();
  const body = await c.req.json();
  const parsed = markProgressSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const db = getDb();

  // Verify node belongs to this curriculum
  const node = await db.curriculumNode.findFirst({
    where: { id: parsed.data.nodeId, curriculumId },
  });
  if (!node) {
    return c.json({ error: "Node not found in this curriculum" }, 404);
  }

  const progress = await db.studentProgress.upsert({
    where: { studentId_nodeId: { studentId: parsed.data.studentId, nodeId: parsed.data.nodeId } },
    update: { coachId: user.id, notes: parsed.data.notes ?? null, completedAt: new Date() },
    create: {
      studentId: parsed.data.studentId,
      nodeId: parsed.data.nodeId,
      coachId: user.id,
      notes: parsed.data.notes ?? null,
    },
  });

  return c.json({ data: serializeProgress(progress) }, 201);
});

// DELETE /api/curriculum/:curriculumId/progress — unmark node
curriculumRoutes.delete("/:curriculumId/progress", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const { curriculumId } = c.req.param();
  const body = await c.req.json();
  const parsed = unmarkProgressSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const db = getDb();

  // Verify node belongs to this curriculum
  const node = await db.curriculumNode.findFirst({
    where: { id: parsed.data.nodeId, curriculumId },
  });
  if (!node) {
    return c.json({ error: "Node not found in this curriculum" }, 404);
  }

  await db.studentProgress.deleteMany({
    where: { studentId: parsed.data.studentId, nodeId: parsed.data.nodeId },
  });

  return c.json({ data: { ok: true } });
});

// ─── Node Resources & Drills ───

// POST /api/curriculum/:curriculumId/nodes/:nodeId/resources — link a resource to a node
curriculumRoutes.post("/:curriculumId/nodes/:nodeId/resources", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const { curriculumId, nodeId } = c.req.param();
  const body = await c.req.json();
  const { resourceId } = body as { resourceId: string };

  if (!resourceId) {
    return c.json({ error: "resourceId is required" }, 400);
  }

  const db = getDb();
  const node = await db.curriculumNode.findFirst({ where: { id: nodeId, curriculumId } });
  if (!node) return c.json({ error: "Node not found" }, 404);

  const curriculum = await db.curriculum.findUnique({ where: { id: curriculumId } });
  if (!curriculum || curriculum.coachId !== user.id) return c.json({ error: "Forbidden" }, 403);

  // Verify resource belongs to this coach
  const resource = await db.coachResource.findFirst({ where: { id: resourceId, coachId: user.id } });
  if (!resource) return c.json({ error: "Resource not found" }, 404);

  await db.nodeResourceLink.upsert({
    where: { nodeId_resourceId: { nodeId, resourceId } },
    update: {},
    create: { nodeId, resourceId },
  });

  return c.json({ data: { id: resource.id, type: resource.type, title: resource.title, url: resource.url, createdAt: resource.createdAt.toISOString() } }, 201);
});

// DELETE /api/curriculum/:curriculumId/nodes/:nodeId/resources/:resourceId — unlink a resource
curriculumRoutes.delete("/:curriculumId/nodes/:nodeId/resources/:resourceId", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const { curriculumId, nodeId, resourceId } = c.req.param();
  const db = getDb();

  const curriculum = await db.curriculum.findUnique({ where: { id: curriculumId } });
  if (!curriculum || curriculum.coachId !== user.id) return c.json({ error: "Forbidden" }, 403);

  await db.nodeResourceLink.deleteMany({ where: { nodeId, resourceId } });
  return c.json({ data: { ok: true } });
});

// POST /api/curriculum/:curriculumId/nodes/:nodeId/drills
curriculumRoutes.post("/:curriculumId/nodes/:nodeId/drills", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const { curriculumId, nodeId } = c.req.param();
  const body = await c.req.json();
  const parsed = createPracticeDrillSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const db = getDb();
  const node = await db.curriculumNode.findFirst({ where: { id: nodeId, curriculumId } });
  if (!node) return c.json({ error: "Node not found" }, 404);

  const curriculum = await db.curriculum.findUnique({ where: { id: curriculumId } });
  if (!curriculum || curriculum.coachId !== user.id) return c.json({ error: "Forbidden" }, 403);

  const drill = await db.practiceDrill.create({
    data: {
      nodeId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      resourceId: parsed.data.resourceId ?? null,
    },
  });

  return c.json({ data: { id: drill.id, nodeId: drill.nodeId, title: drill.title, description: drill.description, resourceId: drill.resourceId } }, 201);
});

// DELETE /api/curriculum/:curriculumId/nodes/:nodeId/drills/:drillId
curriculumRoutes.delete("/:curriculumId/nodes/:nodeId/drills/:drillId", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const { curriculumId, drillId } = c.req.param();
  const db = getDb();

  const curriculum = await db.curriculum.findUnique({ where: { id: curriculumId } });
  if (!curriculum || curriculum.coachId !== user.id) return c.json({ error: "Forbidden" }, 403);

  await db.practiceDrill.delete({ where: { id: drillId } }).catch(() => {});
  return c.json({ data: { ok: true } });
});

// ─── Student / Public Endpoints ───

// GET /api/curriculum/for-student/:lessonTypeId — student's coach's curriculum + progress
curriculumRoutes.get("/for-student/:lessonTypeId", requireAuth, async (c) => {
  const user = c.get("user")!;
  const { lessonTypeId } = c.req.param();
  const db = getDb();

  // Find the student's most recent booking for this lesson type to determine their coach
  const recentBooking = await db.booking.findFirst({
    where: { userId: user.id, lessonTypeId, status: { not: "CANCELLED" }, coachId: { not: null } },
    orderBy: { startsAt: "desc" },
    select: { coachId: true },
  });

  if (!recentBooking?.coachId) {
    return c.json({ error: "No curriculum found. Book a lesson first." }, 404);
  }

  const curriculum = await db.curriculum.findUnique({
    where: { coachId_lessonTypeId: { coachId: recentBooking.coachId, lessonTypeId } },
    include: { nodes: { orderBy: { sortOrder: "asc" }, include: { resourceLinks: { include: { resource: true } }, drills: { orderBy: { sortOrder: "asc" } } } }, edges: true },
  });

  if (!curriculum) {
    return c.json({ error: "Your coach has not created a curriculum for this lesson type yet." }, 404);
  }

  const nodeIds = curriculum.nodes.map((n: any) => n.id);
  const progress = await db.studentProgress.findMany({
    where: { studentId: user.id, nodeId: { in: nodeIds } },
  });

  return c.json({
    data: {
      ...serializeCurriculum(curriculum),
      progress: progress.map(serializeProgress),
    },
  });
});

// GET /api/curriculum/preview/:lessonTypeSlug — public preview
curriculumRoutes.get("/preview/:lessonTypeSlug", async (c) => {
  const { lessonTypeSlug } = c.req.param();
  const db = getDb();

  const lessonType = await db.lessonType.findUnique({ where: { slug: lessonTypeSlug } });
  if (!lessonType) {
    return c.json({ error: "Lesson type not found" }, 404);
  }

  // Find any curriculum for this lesson type (first coach's)
  const curriculum = await db.curriculum.findFirst({
    where: { lessonTypeId: lessonType.id },
    include: { nodes: { orderBy: { sortOrder: "asc" }, include: { resourceLinks: { include: { resource: true } }, drills: { orderBy: { sortOrder: "asc" } } } }, edges: true },
  });

  if (!curriculum) {
    return c.json({ error: "No curriculum available yet" }, 404);
  }

  return c.json({ data: serializeCurriculum(curriculum) });
});
