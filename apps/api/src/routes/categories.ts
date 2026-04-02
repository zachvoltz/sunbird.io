import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { createCategorySchema } from "@sunbird/shared";

export const categoryRoutes = new Hono();

// GET /api/categories — list all categories (public)
categoryRoutes.get("/", async (c) => {
  const db = getDb();
  const categories = await db.category.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return c.json({
    data: categories.map((cat: any) => ({
      id: cat.id,
      slug: cat.slug,
      title: cat.title,
      subtitle: cat.subtitle,
      description: cat.description,
      imageUrl: cat.imageUrl,
    })),
  });
});

// GET /api/categories/:slug — single category (public)
categoryRoutes.get("/:slug", async (c) => {
  const { slug } = c.req.param();
  const db = getDb();

  const category = await db.category.findUnique({ where: { slug } });
  if (!category) {
    return c.json({ error: "Category not found" }, 404);
  }

  return c.json({
    data: {
      id: category.id,
      slug: category.slug,
      title: category.title,
      subtitle: category.subtitle,
      description: category.description,
      imageUrl: category.imageUrl,
    },
  });
});

// POST /api/categories — create category (coach/admin)
categoryRoutes.post("/", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const body = await c.req.json();
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const db = getDb();

  // Check slug uniqueness
  const existing = await db.category.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) {
    return c.json({ error: "A category with this slug already exists" }, 409);
  }

  const category = await db.category.create({
    data: {
      slug: parsed.data.slug,
      title: parsed.data.title,
      subtitle: parsed.data.subtitle ?? null,
      description: parsed.data.description,
      imageUrl: parsed.data.imageUrl ?? null,
    },
  });

  return c.json({
    data: {
      id: category.id,
      slug: category.slug,
      title: category.title,
      subtitle: category.subtitle,
      description: category.description,
      imageUrl: category.imageUrl,
    },
  }, 201);
});
