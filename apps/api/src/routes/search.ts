import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";

export const searchRoutes = new Hono();

const PER_CATEGORY = 6;

// GET /api/search?q=<text> — coach-scoped jump-to search.
// Returns categorized results: students (people the coach has booked
// with), paths (their library paths), and lessons (nodes within those
// paths). Falls back to empty when no query is supplied.
searchRoutes.get("/", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const raw = (c.req.query("q") ?? "").trim();
  if (raw.length === 0) {
    return c.json({ data: { students: [], paths: [], lessons: [] } });
  }
  const q = raw.toLowerCase();
  const db = getDb();
  const coachFilter = user.role === "COACH" ? { coachId: user.id } : {};

  // ── Students — anyone with a non-cancelled booking under this coach
  // whose name or email matches the query. Distinct + capped.
  const bookings: any[] = await db.booking.findMany({
    where: {
      ...coachFilter,
      status: { not: "CANCELLED" },
      user: {
        OR: [
          { name: { contains: raw } },
          { email: { contains: raw } },
        ],
      },
    },
    select: {
      userId: true,
      startsAt: true,
      user: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { startsAt: "desc" },
    take: 50,
  });
  const seen = new Set<string>();
  const students: Array<{ id: string; name: string; avatarUrl: string | null; lastLessonAt: string }> = [];
  for (const b of bookings) {
    if (seen.has(b.userId)) continue;
    seen.add(b.userId);
    students.push({
      id: b.user.id,
      name: b.user.name,
      avatarUrl: b.user.avatarUrl ?? null,
      lastLessonAt: b.startsAt.toISOString(),
    });
    if (students.length >= PER_CATEGORY) break;
  }

  // ── Paths — by title/sub
  const pathRows: any[] = await db.path.findMany({
    where: {
      coachId: user.id,
      OR: [
        { title: { contains: raw } },
        { sub: { contains: raw } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: PER_CATEGORY,
  });
  const paths = pathRows.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    sub: p.sub ?? null,
    status: p.status,
  }));

  // ── Lessons — pull all of this coach's paths and grep node titles in
  // memory. The graphs are small (<60 nodes per path) so this is fine
  // even with 50+ paths.
  const allPaths: any[] = await db.path.findMany({
    where: { coachId: user.id },
    select: { id: true, slug: true, title: true, nodes: true },
  });
  const lessons: Array<{
    pathSlug: string;
    pathTitle: string;
    nodeId: string;
    title: string;
    titleB: string;
  }> = [];
  for (const p of allPaths) {
    let nodes: any[] = [];
    try { nodes = JSON.parse(p.nodes); } catch { /* skip */ }
    if (!Array.isArray(nodes)) continue;
    for (const n of nodes) {
      const t = String(n?.title ?? "").toLowerCase();
      const tb = String(n?.titleB ?? "").toLowerCase();
      if (t.includes(q) || tb.includes(q)) {
        lessons.push({
          pathSlug: p.slug,
          pathTitle: p.title,
          nodeId: String(n.id),
          title: String(n.title ?? ""),
          titleB: String(n.titleB ?? ""),
        });
        if (lessons.length >= PER_CATEGORY) break;
      }
    }
    if (lessons.length >= PER_CATEGORY) break;
  }

  return c.json({ data: { students, paths, lessons } });
});
