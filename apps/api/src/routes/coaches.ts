import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";

export const coachRoutes = new Hono();

// GET /api/coaches — list all coaches (public, only published by default)
coachRoutes.get("/", async (c) => {
  const db = getDb();
  const all = c.req.query("all"); // ?all=true to include unpublished (for booking flow)
  const categoryId = c.req.query("categoryId");

  const where: any = { role: "COACH" };
  if (!all) {
    where.isPublished = true;
  }

  const coaches = await db.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      bio: true,
      slug: true,
      headline: true,
      coverImageUrl: true,
      isPublished: true,
      sessionAddress: true,
      coachCategories: { select: { categoryId: true } },
    },
    orderBy: { name: "asc" },
  });

  let filtered = coaches;
  if (categoryId) {
    filtered = coaches.filter((c: any) =>
      c.coachCategories.some((cc: any) => cc.categoryId === categoryId),
    );
  }

  return c.json({
    data: filtered.map((c: any) => ({
      id: c.id,
      name: c.name,
      avatarUrl: c.avatarUrl,
      bio: c.bio,
      slug: c.slug,
      headline: c.headline,
      coverImageUrl: c.coverImageUrl,
      isPublished: c.isPublished,
      sessionAddress: c.sessionAddress,
      categoryIds: c.coachCategories.map((cc: any) => cc.categoryId),
    })),
  });
});

// GET /api/coaches/students — list coach's students (coach/admin)
// NOTE: Must be before /:slug to avoid being caught by the wildcard
coachRoutes.get("/students", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const db = getDb();

  const coachFilter = user.role === "COACH" ? { coachId: user.id } : {};

  const bookings = await db.booking.findMany({
    where: {
      ...coachFilter,
      status: { not: "CANCELLED" },
    },
    select: {
      userId: true,
      startsAt: true,
      user: { select: { id: true, name: true, avatarUrl: true, bio: true, email: true } },
    },
    orderBy: { startsAt: "desc" },
  });

  const studentMap = new Map<string, {
    id: string;
    name: string;
    avatarUrl: string | null;
    bio: string | null;
    email: string;
    bookingCount: number;
    lastLessonAt: string;
  }>();

  for (const b of bookings) {
    const existing = studentMap.get(b.userId);
    if (existing) {
      existing.bookingCount++;
    } else {
      studentMap.set(b.userId, {
        id: b.user.id,
        name: b.user.name,
        avatarUrl: b.user.avatarUrl,
        bio: b.user.bio,
        email: b.user.email,
        bookingCount: 1,
        lastLessonAt: b.startsAt.toISOString(),
      });
    }
  }

  const students = Array.from(studentMap.values()).sort((a, b) =>
    b.lastLessonAt.localeCompare(a.lastLessonAt),
  );

  return c.json({ data: students });
});

// GET /api/coaches/:slug — public coach profile
coachRoutes.get("/:slug", async (c) => {
  const { slug } = c.req.param();
  const db = getDb();

  const coach = await db.user.findFirst({
    where: { slug, role: "COACH", isPublished: true },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      slug: true,
      headline: true,
      longBio: true,
      coverImageUrl: true,
      credentials: true,
      socialLinks: true,
      sessionAddress: true,
      coachCategories: {
        include: { category: true },
      },
      coachSkillTrees: {
        include: { nodes: { select: { id: true } } },
      },
    },
  });

  if (!coach) {
    return c.json({ error: "Coach not found" }, 404);
  }

  // Parse social links JSON
  let socialLinks: Record<string, string> | null = null;
  try {
    if ((coach as any).socialLinks) socialLinks = JSON.parse((coach as any).socialLinks);
  } catch {}

  return c.json({
    data: {
      id: coach.id,
      slug: coach.slug,
      name: coach.name,
      headline: (coach as any).headline,
      longBio: (coach as any).longBio,
      avatarUrl: coach.avatarUrl,
      coverImageUrl: (coach as any).coverImageUrl,
      credentials: (coach as any).credentials,
      socialLinks,
      sessionAddress: (coach as any).sessionAddress,
      categories: (coach as any).coachCategories.map((cc: any) => {
        const skillTreeCount = (coach as any).coachSkillTrees.filter((st: any) => st.categoryId === cc.categoryId).length;
        return {
          id: cc.category.id,
          slug: cc.category.slug,
          title: cc.category.title,
          subtitle: cc.category.subtitle,
          description: cc.category.description,
          imageUrl: cc.category.imageUrl,
          skillTreeCount,
        };
      }),
    },
  });
});

