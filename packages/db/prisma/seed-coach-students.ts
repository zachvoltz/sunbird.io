// Demo students + sessions for the Coach experience.
//
// Creates four students assigned to Zach (the coach) with a mix of past
// and upcoming bookings. Idempotent — re-running cleans prior demo rows
// (identified by the `@demo.coach` email suffix) and re-inserts.
//
//   Maya Chen     — voice · 2 past, 1 upcoming
//   Theo Martinez — songwriting · 3 past, 2 upcoming
//   Priya Patel   — guitar-for-singers · 1 past, 1 upcoming
//   Jordan Lee    — voice · 0 past, 1 upcoming  (brand-new student)

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const EMAIL_SUFFIX = "@demo.coach";

type Mode = "ONLINE" | "IN_PERSON";

type Spec = {
  name: string;
  email: string;
  age: number;
  bio: string;
  instrument: string;
  lessonTypeSlug: "voice" | "songwriting" | "guitar-for-singers";
  lessonCategorySlug: string;
  mode: Mode;
  past: Array<{ daysAgo: number; hour: number; durationMin: number; note?: string }>;
  upcoming: Array<{ daysFromNow: number; hour: number; durationMin: number; note?: string }>;
};

const STUDENTS: Spec[] = [
  {
    name: "Maya Chen",
    email: `maya${EMAIL_SUFFIX}`,
    age: 27,
    bio: "Indie-folk songwriter rebuilding her head voice after a vocal nodule scare.",
    instrument: "voice",
    lessonTypeSlug: "voice",
    lessonCategorySlug: "tune-up",
    mode: "ONLINE",
    past: [
      { daysAgo: 14, hour: 10, durationMin: 45, note: "warming up bigger before the chorus" },
      { daysAgo: 7,  hour: 10, durationMin: 45, note: "let's revisit breath on the bridge" },
    ],
    upcoming: [
      { daysFromNow: 0, hour: 15, durationMin: 45, note: "want to try the new song!" },
      { daysFromNow: 2, hour: 10, durationMin: 45 },
    ],
  },
  {
    name: "Theo Martinez",
    email: `theo${EMAIL_SUFFIX}`,
    age: 34,
    bio: "Math teacher writing his first EP. Strong lyrics, shy melodies.",
    instrument: "guitar",
    lessonTypeSlug: "songwriting",
    lessonCategorySlug: "my-first-epm",
    mode: "ONLINE",
    past: [
      { daysAgo: 21, hour: 18, durationMin: 60 },
      { daysAgo: 14, hour: 18, durationMin: 60, note: "bringing a verse + chorus rough" },
      { daysAgo: 7,  hour: 18, durationMin: 60 },
    ],
    upcoming: [
      { daysFromNow: 1, hour: 18, durationMin: 60, note: "EP track 2 — needs a B-section" },
      { daysFromNow: 8, hour: 18, durationMin: 60 },
    ],
  },
  {
    name: "Priya Patel",
    email: `priya${EMAIL_SUFFIX}`,
    age: 19,
    bio: "College freshman — sings in two a-cappella groups, learning guitar to accompany herself.",
    instrument: "guitar",
    lessonTypeSlug: "guitar-for-singers",
    lessonCategorySlug: "open",
    mode: "IN_PERSON",
    past: [
      { daysAgo: 10, hour: 16, durationMin: 30, note: "first lesson — open chords + strumming" },
    ],
    upcoming: [{ daysFromNow: 4, hour: 16, durationMin: 30 }],
  },
  {
    name: "Jordan Lee",
    email: `jordan${EMAIL_SUFFIX}`,
    age: 41,
    bio: "Engineering manager who finally booked his first voice lesson after years of putting it off.",
    instrument: "voice",
    lessonTypeSlug: "voice",
    lessonCategorySlug: "just-getting-started",
    mode: "ONLINE",
    past: [],
    upcoming: [{ daysFromNow: 3, hour: 12, durationMin: 30, note: "totally new to this — please be gentle!" }],
  },
];

function atHour(daysOffset: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function main() {
  const zach = await db.user.findUnique({ where: { email: "zachvoltz@gmail.com" } });
  if (!zach) {
    console.error("Zach not found — run the main seed first.");
    process.exit(1);
  }

  // ── Wipe prior demo rows (cascades to bookings via FK) ──
  const prior = await db.user.findMany({
    where: { email: { endsWith: EMAIL_SUFFIX } },
    select: { id: true },
  });
  if (prior.length > 0) {
    const ids = prior.map((u) => u.id);
    await db.booking.deleteMany({
      where: { OR: [{ userId: { in: ids } }, { coachId: { in: ids } }] },
    });
    await db.user.deleteMany({ where: { id: { in: ids } } });
  }

  const lessonTypes = await db.lessonType.findMany({ include: { categories: true } });
  const ltBySlug = new Map(lessonTypes.map((lt) => [lt.slug, lt]));

  // Pull the coach's library so we can stitch a starter routine for Maya.
  const library = await db.libraryItem.findMany({ where: { coachId: zach.id } });
  const libByTitle = new Map(library.map((li) => [li.title, li]));

  let totalBookings = 0;
  for (const s of STUDENTS) {
    const lt = ltBySlug.get(s.lessonTypeSlug);
    if (!lt) throw new Error(`LessonType not found: ${s.lessonTypeSlug}`);
    const lc = lt.categories.find((c) => c.slug === s.lessonCategorySlug);
    if (!lc) throw new Error(`LessonCategory not found: ${s.lessonTypeSlug}/${s.lessonCategorySlug}`);

    const student = await db.user.create({
      data: {
        email: s.email,
        name: s.name,
        role: "STUDENT",
        age: s.age,
        bio: s.bio,
        instrument: s.instrument,
      },
    });

    for (const p of s.past) {
      const startsAt = atHour(-p.daysAgo, p.hour);
      const endsAt = new Date(startsAt.getTime() + p.durationMin * 60_000);
      await db.booking.create({
        data: {
          userId: student.id,
          coachId: zach.id,
          lessonTypeId: lt.id,
          lessonCategoryId: lc.id,
          startsAt,
          endsAt,
          status: "COMPLETED",
          mode: s.mode,
          studentNote: p.note ?? null,
          completedAt: endsAt,
        },
      });
      totalBookings++;
    }

    for (const u of s.upcoming) {
      const startsAt = atHour(u.daysFromNow, u.hour);
      const endsAt = new Date(startsAt.getTime() + u.durationMin * 60_000);
      await db.booking.create({
        data: {
          userId: student.id,
          coachId: zach.id,
          lessonTypeId: lt.id,
          lessonCategoryId: lc.id,
          startsAt,
          endsAt,
          status: "CONFIRMED",
          mode: s.mode,
          studentNote: u.note ?? null,
        },
      });
      totalBookings++;
    }

    // Give Maya a starter routine so the Plan / Next / Student / Practice
    // surfaces have something to render right away. Items snapshot the
    // library at seed time so renaming a library item later doesn't
    // corrupt the routine.
    if (s.email === `maya${EMAIL_SUFFIX}`) {
      const titles = [
        "Breathing · 4-7-8",
        "C major scale · 2 octaves",
        "Hanon № 1 · slow",
        "Phrasing drill — long-line",
        "River Flows in You — Yiruma",
      ];
      const items = titles
        .map((t) => libByTitle.get(t))
        .filter((li): li is NonNullable<typeof li> => !!li)
        .map((li) => ({
          id: Math.random().toString(36).slice(2, 10),
          libraryItemId: li.id,
          kind: li.kind,
          title: li.title,
          bars: null,
          bpmStart: li.bpmStart,
          bpmEnd: li.bpmEnd,
          durationMin: li.durationMin,
          note: null,
        }));
      if (items.length > 0) {
        await db.user.update({
          where: { id: student.id },
          data: {
            currentRoutine: JSON.stringify({
              items,
              updatedAt: new Date().toISOString(),
            }),
          },
        });
      }
    }
  }

  console.log(`Seeded ${STUDENTS.length} demo students, ${totalBookings} bookings for coach ${zach.email}`);
  for (const s of STUDENTS) {
    console.log(`  · ${s.name.padEnd(16)} ${s.past.length} past · ${s.upcoming.length} upcoming`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
