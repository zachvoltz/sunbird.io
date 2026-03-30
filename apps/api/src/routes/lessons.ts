import { Hono } from "hono";
import { getDb } from "../lib/db";

export const lessonRoutes = new Hono();

// GET /api/lessons — list all lesson types with categories
lessonRoutes.get("/", async (c) => {
  const db = getDb();
  const lessonTypes = await db.lessonType.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      categories: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  return c.json({
    data: lessonTypes.map((lt) => ({
      id: lt.id,
      slug: lt.slug,
      title: lt.title,
      subtitle: lt.subtitle,
      description: lt.description,
      imageUrl: lt.imageUrl,
      pricePerSession: lt.pricePerSession,
      categories: lt.categories.map((cat) => ({
        id: cat.id,
        slug: cat.slug,
        title: cat.title,
        description: cat.description,
      })),
    })),
  });
});

// GET /api/lessons/:slug — single lesson type with categories
lessonRoutes.get("/:slug", async (c) => {
  const { slug } = c.req.param();
  const db = getDb();

  const lessonType = await db.lessonType.findUnique({
    where: { slug },
    include: {
      categories: {
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  if (!lessonType) {
    return c.json({ error: "Lesson type not found" }, 404);
  }

  return c.json({
    data: {
      id: lessonType.id,
      slug: lessonType.slug,
      title: lessonType.title,
      subtitle: lessonType.subtitle,
      description: lessonType.description,
      imageUrl: lessonType.imageUrl,
      pricePerSession: lessonType.pricePerSession,
      categories: lessonType.categories.map((cat) => ({
        id: cat.id,
        slug: cat.slug,
        title: cat.title,
        description: cat.description,
      })),
    },
  });
});
