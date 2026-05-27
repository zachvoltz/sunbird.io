import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth } from "../middleware/auth";

export const searchRoutes = new Hono();

const PER_CATEGORY = 6;

// A single hit the topbar dropdown renders. Each carries everything
// the frontend needs to display + navigate, so the component stays
// generic.
type SearchHit = {
  id: string;
  title: string;
  sub?: string;
  href: string;
  iconKind: "person" | "path" | "lesson" | "note" | "booking";
};

type SearchCategory = { label: string; hits: SearchHit[] };

function ymd(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

// GET /api/search?q=<text> — jump-to search for the topbar. Branches on
// the caller's role:
//   COACH/ADMIN — Students · Paths · Lessons (within their paths)
//   STUDENT     — Coaches · Lessons (their bookings) · Notes (with
//                 practiceNotes that match)
searchRoutes.get("/", requireAuth, async (c) => {
  const user = c.get("user")!;
  const raw = (c.req.query("q") ?? "").trim();
  if (raw.length === 0) {
    return c.json({ data: { categories: [] as SearchCategory[] } });
  }
  const q = raw.toLowerCase();
  const db = getDb();

  if (user.role === "COACH" || user.role === "ADMIN") {
    return c.json({ data: { categories: await coachSearch(db, user, raw, q) } });
  }
  return c.json({ data: { categories: await studentSearch(db, user, raw, q) } });
});

// ── Coach scope ────────────────────────────────────────────

async function coachSearch(db: any, user: any, raw: string, q: string): Promise<SearchCategory[]> {
  const coachFilter = user.role === "COACH" ? { coachId: user.id } : {};

  // Students — distinct users with non-cancelled bookings under this coach
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
      user: { select: { id: true, name: true } },
    },
    orderBy: { startsAt: "desc" },
    take: 50,
  });
  const seen = new Set<string>();
  const students: SearchHit[] = [];
  for (const b of bookings) {
    if (seen.has(b.userId)) continue;
    seen.add(b.userId);
    students.push({
      id: b.user.id,
      title: b.user.name,
      sub: `last lesson ${ymd(b.startsAt.toISOString())}`,
      href: `/coach/student/${b.user.id}`,
      iconKind: "person",
    });
    if (students.length >= PER_CATEGORY) break;
  }

  // Paths — by title/sub
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
  const paths: SearchHit[] = pathRows.map((p) => ({
    id: p.id,
    title: p.title,
    sub: p.sub ?? p.status,
    href: `/coach/library/paths/${p.slug}`,
    iconKind: "path",
  }));

  // Path lessons — grep parsed node JSON across all coach paths
  const allPaths: any[] = await db.path.findMany({
    where: { coachId: user.id },
    select: { slug: true, title: true, nodes: true },
  });
  const lessons: SearchHit[] = [];
  for (const p of allPaths) {
    let nodes: any[] = [];
    try { nodes = JSON.parse(p.nodes); } catch { continue; }
    if (!Array.isArray(nodes)) continue;
    for (const n of nodes) {
      const t = String(n?.title ?? "").toLowerCase();
      const tb = String(n?.titleB ?? "").toLowerCase();
      if (t.includes(q) || tb.includes(q)) {
        lessons.push({
          id: `${p.slug}:${n.id}`,
          title: `${n.title} ${n.titleB ?? ""}`.trim(),
          sub: `in ${p.title}`,
          href: `/coach/library/paths/${p.slug}/lessons/${n.id}`,
          iconKind: "lesson",
        });
        if (lessons.length >= PER_CATEGORY) break;
      }
    }
    if (lessons.length >= PER_CATEGORY) break;
  }

  return [
    students.length ? { label: "Students", hits: students } : null,
    paths.length    ? { label: "Paths",    hits: paths    } : null,
    lessons.length  ? { label: "Lessons",  hits: lessons  } : null,
  ].filter(Boolean) as SearchCategory[];
}

// ── Student scope ──────────────────────────────────────────

async function studentSearch(db: any, user: any, raw: string, q: string): Promise<SearchCategory[]> {
  // Coaches — distinct users this student has booked with, matching query
  const coachBookings: any[] = await db.booking.findMany({
    where: {
      userId: user.id,
      status: { not: "CANCELLED" },
      coach: {
        OR: [
          { name: { contains: raw } },
          { headline: { contains: raw } },
        ],
      },
    },
    select: {
      coachId: true,
      startsAt: true,
      coach: { select: { id: true, name: true, slug: true, headline: true } },
    },
    orderBy: { startsAt: "desc" },
    take: 50,
  });
  const seenCoach = new Set<string>();
  const coaches: SearchHit[] = [];
  for (const b of coachBookings) {
    if (!b.coachId || seenCoach.has(b.coachId)) continue;
    seenCoach.add(b.coachId);
    coaches.push({
      id: b.coach.id,
      title: b.coach.name,
      sub: b.coach.headline ?? `last lesson ${ymd(b.startsAt.toISOString())}`,
      href: b.coach.slug ? `/coaches/${b.coach.slug}` : `/coach/student/${b.coach.id}`,
      iconKind: "person",
    });
    if (coaches.length >= PER_CATEGORY) break;
  }

  // Lessons — their bookings matching by category title, coach name, or
  // their own student-note. We exclude bookings that already match the
  // notes category below so they don't double up.
  const lessonBookings: any[] = await db.booking.findMany({
    where: {
      userId: user.id,
      OR: [
        { studentNote: { contains: raw } },
        { category: { title: { contains: raw } } },
        { coach: { name: { contains: raw } } },
      ],
    },
    select: {
      id: true,
      startsAt: true,
      status: true,
      practiceNotes: true,
      category: { select: { title: true } },
      coach:    { select: { name: true } },
    },
    orderBy: { startsAt: "desc" },
    take: PER_CATEGORY * 2,
  });
  const lessons: SearchHit[] = [];
  for (const b of lessonBookings) {
    if (b.practiceNotes && q && String(b.practiceNotes).toLowerCase().includes(q)) {
      // surfaces below in Notes — skip here
      continue;
    }
    lessons.push({
      id: b.id,
      title: b.category?.title ?? "Lesson",
      sub: `${b.coach?.name ?? "—"} · ${ymd(b.startsAt.toISOString())} · ${b.status.toLowerCase()}`,
      href: `/my-bookings/${b.id}`,
      iconKind: "booking",
    });
    if (lessons.length >= PER_CATEGORY) break;
  }

  // Notes — bookings whose practiceNotes contain the query
  const noteBookings: any[] = await db.booking.findMany({
    where: {
      userId: user.id,
      practiceNotes: { contains: raw },
    },
    select: {
      id: true,
      startsAt: true,
      category: { select: { title: true } },
      coach:    { select: { name: true } },
    },
    orderBy: { startsAt: "desc" },
    take: PER_CATEGORY,
  });
  const notes: SearchHit[] = noteBookings.map((b) => ({
    id: b.id,
    title: b.category?.title ?? "Lesson notes",
    sub: `${b.coach?.name ?? "—"} · ${ymd(b.startsAt.toISOString())}`,
    href: `/my-notes/${b.id}`,
    iconKind: "note",
  }));

  return [
    coaches.length ? { label: "Coaches", hits: coaches } : null,
    lessons.length ? { label: "Lessons", hits: lessons } : null,
    notes.length   ? { label: "Notes",   hits: notes   } : null,
  ].filter(Boolean) as SearchCategory[];
}
