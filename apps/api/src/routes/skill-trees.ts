import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { hasCycle } from "../lib/graph";
import {
  createSkillTreeSchema,
  saveSkillTreeGraphSchema,
  stMarkProgressSchema,
  stUnmarkProgressSchema,
  createNodeResourceSchema,
  createPracticeDrillSchema,
} from "@sunbird/shared";

export const skillTreeRoutes = new Hono();

const nodeInclude = {
  resourceLinks: { include: { resource: true } },
  drills: { orderBy: { sortOrder: "asc" as const } },
};

function serializeSkillTree(st: any) {
  return {
    id: st.id,
    coachId: st.coachId,
    categoryId: st.categoryId,
    title: st.title,
    description: st.description,
    nodes: (st.nodes ?? []).map((n: any) => ({
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
    edges: (st.edges ?? []).map((e: any) => ({
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

const fullInclude = {
  nodes: { orderBy: { sortOrder: "asc" as const }, include: nodeInclude },
  edges: true,
};

// ─── Coach Endpoints ───

// GET /api/skill-trees/by-category/:categoryId — coach's skill trees for a category
skillTreeRoutes.get("/by-category/:categoryId", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const { categoryId } = c.req.param();
  const db = getDb();

  const trees = await db.skillTree.findMany({
    where: { coachId: user.id, categoryId },
    include: { nodes: { select: { id: true } } },
    orderBy: { createdAt: "asc" },
  });

  return c.json({
    data: trees.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      nodeCount: t.nodes.length,
    })),
  });
});

// GET /api/skill-trees/:skillTreeId — full skill tree with nodes/edges
skillTreeRoutes.get("/:skillTreeId", requireAuth, async (c) => {
  const { skillTreeId } = c.req.param();
  const db = getDb();

  const st = await db.skillTree.findUnique({
    where: { id: skillTreeId },
    include: fullInclude,
  });

  if (!st) return c.json({ error: "Skill tree not found" }, 404);
  return c.json({ data: serializeSkillTree(st) });
});

// POST /api/skill-trees — create new skill tree
skillTreeRoutes.post("/", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = createSkillTreeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const db = getDb();

  // Verify coach teaches this category
  const teaches = await db.coachCategory.findFirst({
    where: { coachId: user.id, categoryId: parsed.data.categoryId },
  });
  if (!teaches) {
    return c.json({ error: "You do not teach this category" }, 400);
  }

  const st = await db.skillTree.create({
    data: {
      coachId: user.id,
      categoryId: parsed.data.categoryId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
    },
    include: fullInclude,
  });

  return c.json({ data: serializeSkillTree(st) }, 201);
});

// PUT /api/skill-trees/:skillTreeId/graph — bulk save nodes + edges
skillTreeRoutes.put("/:skillTreeId/graph", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const { skillTreeId } = c.req.param();
  const body = await c.req.json();
  const parsed = saveSkillTreeGraphSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const db = getDb();
  const st = await db.skillTree.findUnique({ where: { id: skillTreeId } });
  if (!st || st.coachId !== user.id) {
    return c.json({ error: "Skill tree not found" }, 404);
  }

  if (hasCycle(parsed.data.edges)) {
    return c.json({ error: "Skill tree contains a cycle. Prerequisites cannot be circular." }, 400);
  }

  await db.skillTreeEdge.deleteMany({ where: { skillTreeId } });
  await db.skillTreeNode.deleteMany({ where: { skillTreeId } });

  for (let i = 0; i < parsed.data.nodes.length; i++) {
    const n = parsed.data.nodes[i];
    await db.skillTreeNode.create({
      data: {
        id: n.id,
        skillTreeId,
        title: n.title,
        description: n.description ?? null,
        positionX: n.positionX,
        positionY: n.positionY,
        color: n.color ?? null,
        sortOrder: i,
      },
    });
  }

  for (const e of parsed.data.edges) {
    await db.skillTreeEdge.create({
      data: { id: e.id, skillTreeId, fromNodeId: e.fromNodeId, toNodeId: e.toNodeId },
    });
  }

  const updated = await db.skillTree.findUnique({
    where: { id: skillTreeId },
    include: fullInclude,
  });

  return c.json({ data: serializeSkillTree(updated) });
});

// DELETE /api/skill-trees/:skillTreeId
skillTreeRoutes.delete("/:skillTreeId", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const { skillTreeId } = c.req.param();
  const db = getDb();

  const st = await db.skillTree.findUnique({ where: { id: skillTreeId } });
  if (!st || st.coachId !== user.id) return c.json({ error: "Skill tree not found" }, 404);

  await db.skillTree.delete({ where: { id: skillTreeId } });
  return c.json({ data: { ok: true } });
});

// ─── Progress ───

// GET /api/skill-trees/:skillTreeId/progress/:studentId
skillTreeRoutes.get("/:skillTreeId/progress/:studentId", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const { skillTreeId, studentId } = c.req.param();
  const db = getDb();

  const st = await db.skillTree.findUnique({
    where: { id: skillTreeId },
    include: { nodes: { select: { id: true } } },
  });
  if (!st) return c.json({ error: "Skill tree not found" }, 404);

  const nodeIds = st.nodes.map((n: any) => n.id);
  const progress = await db.sTNodeProgress.findMany({
    where: { studentId, nodeId: { in: nodeIds } },
  });

  return c.json({ data: progress.map(serializeProgress) });
});

// POST /api/skill-trees/:skillTreeId/progress
skillTreeRoutes.post("/:skillTreeId/progress", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const { skillTreeId } = c.req.param();
  const body = await c.req.json();
  const parsed = stMarkProgressSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const db = getDb();
  const node = await db.skillTreeNode.findFirst({
    where: { id: parsed.data.nodeId, skillTreeId },
  });
  if (!node) return c.json({ error: "Node not found" }, 404);

  const progress = await db.sTNodeProgress.upsert({
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

// DELETE /api/skill-trees/:skillTreeId/progress
skillTreeRoutes.delete("/:skillTreeId/progress", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const { skillTreeId } = c.req.param();
  const body = await c.req.json();
  const parsed = stUnmarkProgressSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed" }, 400);
  }

  const db = getDb();
  await db.sTNodeProgress.deleteMany({
    where: { studentId: parsed.data.studentId, nodeId: parsed.data.nodeId },
  });
  return c.json({ data: { ok: true } });
});

// ─── Node Resources & Drills ───

// POST /api/skill-trees/:skillTreeId/nodes/:nodeId/resources
skillTreeRoutes.post("/:skillTreeId/nodes/:nodeId/resources", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const { skillTreeId, nodeId } = c.req.param();
  const body = await c.req.json();
  const { resourceId } = body as { resourceId: string };
  if (!resourceId) return c.json({ error: "resourceId is required" }, 400);

  const db = getDb();
  const st = await db.skillTree.findUnique({ where: { id: skillTreeId } });
  if (!st || st.coachId !== user.id) return c.json({ error: "Forbidden" }, 403);

  const resource = await db.coachResource.findFirst({ where: { id: resourceId, coachId: user.id } });
  if (!resource) return c.json({ error: "Resource not found" }, 404);

  await db.sTNodeResourceLink.upsert({
    where: { nodeId_resourceId: { nodeId, resourceId } },
    update: {},
    create: { nodeId, resourceId },
  });

  return c.json({ data: { id: resource.id, type: resource.type, title: resource.title, url: resource.url, createdAt: resource.createdAt.toISOString() } }, 201);
});

// DELETE /api/skill-trees/:skillTreeId/nodes/:nodeId/resources/:resourceId
skillTreeRoutes.delete("/:skillTreeId/nodes/:nodeId/resources/:resourceId", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const { skillTreeId, nodeId, resourceId } = c.req.param();
  const db = getDb();

  const st = await db.skillTree.findUnique({ where: { id: skillTreeId } });
  if (!st || st.coachId !== user.id) return c.json({ error: "Forbidden" }, 403);

  await db.sTNodeResourceLink.deleteMany({ where: { nodeId, resourceId } });
  return c.json({ data: { ok: true } });
});

// POST /api/skill-trees/:skillTreeId/nodes/:nodeId/drills
skillTreeRoutes.post("/:skillTreeId/nodes/:nodeId/drills", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const { skillTreeId, nodeId } = c.req.param();
  const body = await c.req.json();
  const parsed = createPracticeDrillSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation failed" }, 400);

  const db = getDb();
  const st = await db.skillTree.findUnique({ where: { id: skillTreeId } });
  if (!st || st.coachId !== user.id) return c.json({ error: "Forbidden" }, 403);

  const drill = await db.sTDrill.create({
    data: {
      nodeId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      resourceId: parsed.data.resourceId ?? null,
    },
  });

  return c.json({ data: { id: drill.id, nodeId: drill.nodeId, title: drill.title, description: drill.description, resourceId: drill.resourceId } }, 201);
});

// DELETE /api/skill-trees/:skillTreeId/nodes/:nodeId/drills/:drillId
skillTreeRoutes.delete("/:skillTreeId/nodes/:nodeId/drills/:drillId", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const { skillTreeId, drillId } = c.req.param();
  const db = getDb();

  const st = await db.skillTree.findUnique({ where: { id: skillTreeId } });
  if (!st || st.coachId !== user.id) return c.json({ error: "Forbidden" }, 403);

  await db.sTDrill.delete({ where: { id: drillId } }).catch(() => {});
  return c.json({ data: { ok: true } });
});

// ─── Student / Public ───

// GET /api/skill-trees/by-coach/:coachId/:categoryId — public, for booking flow
skillTreeRoutes.get("/by-coach/:coachId/:categoryId", async (c) => {
  const { coachId, categoryId } = c.req.param();
  const db = getDb();

  const trees = await db.skillTree.findMany({
    where: { coachId, categoryId },
    include: { nodes: { select: { id: true, title: true } } },
    orderBy: { createdAt: "asc" },
  });

  return c.json({
    data: trees.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      nodeCount: t.nodes.length,
      nodes: t.nodes.map((n: any) => ({ id: n.id, title: n.title })),
    })),
  });
});

// GET /api/skill-trees/for-student/:categoryId
skillTreeRoutes.get("/for-student/:categoryId", requireAuth, async (c) => {
  const user = c.get("user")!;
  const { categoryId } = c.req.param();
  const db = getDb();

  // Find student's most recent booking for this category
  const recentBooking = await db.booking.findFirst({
    where: { userId: user.id, categoryId, status: { not: "CANCELLED" }, coachId: { not: null } },
    orderBy: { startsAt: "desc" },
    select: { coachId: true, skillTreeId: true },
  });

  if (!recentBooking?.coachId) {
    return c.json({ error: "No skill tree found. Book a lesson first." }, 404);
  }

  // Use the specific skill tree from the booking, or the first one
  let st;
  if (recentBooking.skillTreeId) {
    st = await db.skillTree.findUnique({
      where: { id: recentBooking.skillTreeId },
      include: fullInclude,
    });
  }

  if (!st) {
    st = await db.skillTree.findFirst({
      where: { coachId: recentBooking.coachId, categoryId },
      include: fullInclude,
    });
  }

  if (!st) {
    return c.json({ error: "Your coach has not created a skill tree for this category yet." }, 404);
  }

  const nodeIds = st.nodes.map((n: any) => n.id);
  const progress = await db.sTNodeProgress.findMany({
    where: { studentId: user.id, nodeId: { in: nodeIds } },
  });

  return c.json({
    data: {
      ...serializeSkillTree(st),
      progress: progress.map(serializeProgress),
    },
  });
});

// GET /api/skill-trees/preview/:categorySlug — public preview
skillTreeRoutes.get("/preview/:categorySlug", async (c) => {
  const { categorySlug } = c.req.param();
  const db = getDb();

  const category = await db.category.findUnique({ where: { slug: categorySlug } });
  if (!category) return c.json({ error: "Category not found" }, 404);

  const st = await db.skillTree.findFirst({
    where: { categoryId: category.id },
    include: fullInclude,
  });

  if (!st) return c.json({ error: "No skill tree available yet" }, 404);
  return c.json({ data: serializeSkillTree(st) });
});
