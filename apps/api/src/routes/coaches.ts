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

// GET /api/coaches/students/:id — full StudentDetail aggregate for the student page
coachRoutes.get("/students/:id", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const studentId = c.req.param("id");
  const db = getDb();

  const coachFilter = user.role === "COACH" ? { coachId: user.id } : {};

  const [student, bookings, streak, assignments, takes, latestSentNote] = await Promise.all([
    db.user.findUnique({
      where: { id: studentId },
      select: {
        id: true, name: true, email: true, avatarUrl: true, bio: true,
        age: true, instrument: true,
      },
    }),
    db.booking.findMany({
      where: { ...coachFilter, userId: studentId },
      orderBy: { startsAt: "desc" },
      select: {
        id: true, startsAt: true, endsAt: true, status: true,
        practiceNotes: true, practiceNotesSentAt: true, noteSections: true,
      },
    }),
    db.practiceStreak.findUnique({ where: { userId: studentId } }),
    db.assignment.findMany({
      where: { studentId, ...(user.role === "COACH" ? { coachId: user.id } : {}) },
      orderBy: [{ weekStartsOn: "desc" }, { sortOrder: "asc" }],
      take: 30,
    }),
    db.take.findMany({
      where: { studentId, ...(user.role === "COACH" ? { coachId: user.id } : {}) },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        annotations: { include: { author: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } } } },
        replies: { include: { author: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } } } },
      },
    }),
    db.booking.findFirst({
      where: {
        ...coachFilter,
        userId: studentId,
        practiceNotes: { not: null },
      },
      orderBy: { startsAt: "desc" },
      include: {
        lessonSummary: { include: { editedBy: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } } } },
        noteReadReceipts: true,
        noteVoiceMemos: {
          include: { addedBy: { select: { id: true, name: true, email: true, avatarUrl: true, role: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
  ]);

  if (!student) {
    return c.json({ error: "Student not found" }, 404);
  }

  // Aggregate booking-derived dates
  const sortedAsc = bookings.slice().sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const firstLessonAt = sortedAsc[0]?.startsAt.toISOString() ?? null;
  const lastLessonAt = bookings[0]?.startsAt.toISOString() ?? null;

  let latestNoteSections: any = null;
  if (latestSentNote?.noteSections) {
    try {
      latestNoteSections = JSON.parse(latestSentNote.noteSections);
    } catch {
      latestNoteSections = null;
    }
  }

  let latestSummary: any = null;
  if (latestSentNote?.lessonSummary) {
    let bullets: string[] = [];
    try {
      const parsed = JSON.parse(latestSentNote.lessonSummary.bullets);
      if (Array.isArray(parsed)) bullets = parsed.filter((x) => typeof x === "string");
    } catch {}
    latestSummary = {
      id: latestSentNote.lessonSummary.id,
      bookingId: latestSentNote.lessonSummary.bookingId,
      bullets,
      status: latestSentNote.lessonSummary.status,
      durationMin: latestSentNote.lessonSummary.durationMin,
      recordingUrl: latestSentNote.lessonSummary.recordingUrl,
      editedBy: latestSentNote.lessonSummary.editedBy ?? null,
      generatedAt: latestSentNote.lessonSummary.generatedAt?.toISOString() ?? null,
      updatedAt: latestSentNote.lessonSummary.updatedAt.toISOString(),
      createdAt: latestSentNote.lessonSummary.createdAt.toISOString(),
    };
  }

  const data = {
    id: student.id,
    name: student.name,
    email: student.email,
    avatarUrl: student.avatarUrl,
    bio: student.bio,
    age: student.age,
    instrument: student.instrument,
    bookingCount: bookings.length,
    firstLessonAt,
    lastLessonAt,
    streak: streak
      ? {
          currentDays: streak.currentDays,
          longestDays: streak.longestDays,
          lastPracticedAt: streak.lastPracticedAt?.toISOString() ?? null,
        }
      : null,
    assignments: assignments.map((a: any) => ({
      id: a.id,
      studentId: a.studentId,
      coachId: a.coachId,
      type: a.type,
      title: a.title,
      subtitle: a.subtitle,
      bars: a.bars,
      weekStartsOn: a.weekStartsOn.toISOString(),
      tempoBpmStart: a.tempoBpmStart,
      tempoBpmEnd: a.tempoBpmEnd,
      durationMin: a.durationMin,
      status: a.status,
      completionCount: a.completionCount,
      noteText: a.noteText,
      sortOrder: a.sortOrder,
      hasMidi: a.hasMidi,
      hasNotePinned: a.hasNotePinned,
      dueAt: a.dueAt?.toISOString() ?? null,
      bookingId: a.bookingId,
      resourceId: a.resourceId,
      createdAt: a.createdAt.toISOString(),
    })),
    takes: takes.map((t: any) => ({
      id: t.id,
      studentId: t.studentId,
      coachId: t.coachId,
      assignmentId: t.assignmentId,
      pieceTitle: t.pieceTitle,
      bars: t.bars,
      takeNumber: t.takeNumber,
      durationSec: t.durationSec,
      audioUrl: t.audioUrl,
      selfRating: t.selfRating,
      selfNote: t.selfNote,
      status: t.status,
      reviewedAt: t.reviewedAt?.toISOString() ?? null,
      createdAt: t.createdAt.toISOString(),
      annotations: t.annotations.map((a: any) => ({
        id: a.id,
        takeId: a.takeId,
        kind: a.kind,
        targetType: a.targetType,
        targetBar: a.targetBar,
        targetTimeSec: a.targetTimeSec,
        text: a.text,
        voiceUrl: a.voiceUrl,
        voiceDurSec: a.voiceDurSec,
        createdAt: a.createdAt.toISOString(),
        author: a.author,
      })),
      replies: t.replies.map((r: any) => ({
        id: r.id,
        takeId: r.takeId,
        text: r.text,
        voiceUrl: r.voiceUrl,
        voiceDurSec: r.voiceDurSec,
        starRating: r.starRating,
        summaryText: r.summaryText,
        createdAt: r.createdAt.toISOString(),
        author: r.author,
      })),
    })),
    latestNoteBookingId: latestSentNote?.id ?? null,
    latestNoteSections,
    latestNotePracticeNotes: latestSentNote?.practiceNotes ?? null,
    latestNoteStartsAt: latestSentNote?.startsAt.toISOString() ?? null,
    latestNoteSentAt: latestSentNote?.practiceNotesSentAt?.toISOString() ?? null,
    latestNoteReadCount: latestSentNote?.noteReadReceipts.length ?? 0,
    latestLessonSummary: latestSummary,
    latestNoteVoiceMemos:
      latestSentNote?.noteVoiceMemos.map((v: any) => ({
        id: v.id,
        bookingId: v.bookingId,
        audioUrl: v.audioUrl,
        durationSec: v.durationSec,
        createdAt: v.createdAt.toISOString(),
        addedBy: v.addedBy,
      })) ?? [],
  };

  return c.json({ data });
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

