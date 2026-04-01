import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";

export const coachRoutes = new Hono();

// GET /api/coaches — list all coaches (public)
coachRoutes.get("/", async (c) => {
  const db = getDb();
  const coaches = await db.user.findMany({
    where: { role: "COACH" },
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      bio: true,
      sessionAddress: true,
      oauthAccounts: { where: { provider: "zoom" }, select: { id: true } },
    },
    orderBy: { name: "asc" },
  });

  return c.json({
    data: coaches.map((c: any) => ({
      id: c.id,
      name: c.name,
      avatarUrl: c.avatarUrl,
      bio: c.bio,
      sessionAddress: c.sessionAddress,
      hasZoomConnected: c.oauthAccounts.length > 0,
    })),
  });
});

// GET /api/coaches/students — list coach's students (coach/admin)
coachRoutes.get("/students", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const db = getDb();

  const coachFilter = user.role === "COACH" ? { coachId: user.id } : {};

  // Get distinct students with booking stats
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

  // Aggregate by student
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
