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

// GET /api/coaches/dashboard — aggregate powering /coach (Roster)
coachRoutes.get("/dashboard", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  const coachFilter = user.role === "COACH" ? { coachId: user.id } : {};

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayStart.getDate() + 1);

  // Monday of this week (local time)
  const day = now.getDay(); // 0=Sun
  const offset = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + offset);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const studentSelect = {
    id: true, name: true, email: true, avatarUrl: true, bio: true, role: true,
  } as const;

  const [allBookings, unreviewedTakes, weeklyAssignments, recentTakes] = await Promise.all([
    db.booking.findMany({
      where: { ...coachFilter, status: { not: "CANCELLED" } },
      orderBy: { startsAt: "desc" },
      include: { user: { select: studentSelect } },
    }),
    db.take.findMany({
      where: { ...coachFilter, status: "UNREVIEWED" },
      orderBy: { createdAt: "desc" },
      include: { student: { select: studentSelect } },
    }),
    db.assignment.findMany({
      where: { ...coachFilter, weekStartsOn: weekStart },
      select: { studentId: true },
    }),
    db.take.findMany({
      where: { ...coachFilter, createdAt: { gte: weekStart } },
      orderBy: { createdAt: "desc" },
      include: { student: { select: studentSelect } },
    }),
  ]);

  // ── Derive: unreviewed takes ────────────────────────────
  const unreviewedItems = unreviewedTakes.slice(0, 6).map((t: any) => ({
    take: {
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
      annotations: [],
      replies: [],
    },
    student: t.student,
    ageHours: Math.max(0, (now.getTime() - t.createdAt.getTime()) / 3_600_000),
  }));

  // ── Derive: bookings that completed without a practice note ─
  const bookingsMissingNotes = allBookings
    .filter((b: any) =>
      (b.status === "CONFIRMED" && b.startsAt <= now && !b.practiceNotes) ||
      (b.status === "COMPLETED" && !b.practiceNotes),
    )
    .slice(0, 6)
    .map((b: any) => ({
      booking: serializeBookingLight(b),
      daysAgo: Math.max(0, Math.floor((now.getTime() - b.startsAt.getTime()) / 86_400_000)),
    }));

  // ── Derive: students with no assignments this week ──────
  const studentMap = new Map<string, any>();
  for (const b of allBookings) {
    if (!studentMap.has(b.userId)) studentMap.set(b.userId, b.user);
  }
  const studentsWithAssignmentsThisWeek = new Set(weeklyAssignments.map((a: any) => a.studentId));
  // Only flag students who have an upcoming booking this week or had one last week —
  // anyone fully inactive shouldn't churn the list.
  const studentLastBookingAt = new Map<string, Date>();
  for (const b of allBookings) {
    const prev = studentLastBookingAt.get(b.userId);
    if (!prev || b.startsAt > prev) studentLastBookingAt.set(b.userId, b.startsAt);
  }
  const studentsWithoutPlan: any[] = [];
  for (const [sid, student] of studentMap.entries()) {
    if (studentsWithAssignmentsThisWeek.has(sid)) continue;
    const last = studentLastBookingAt.get(sid);
    const hasUpcoming = allBookings.some(
      (b: any) => b.userId === sid && b.startsAt >= now && b.startsAt < weekEnd,
    );
    const recentlyActive = last && now.getTime() - last.getTime() < 21 * 86_400_000;
    if (hasUpcoming || recentlyActive) {
      studentsWithoutPlan.push({
        student,
        lastBookingAt: last ? last.toISOString() : null,
      });
    }
  }
  studentsWithoutPlan.sort((a, b) =>
    (a.lastBookingAt ?? "").localeCompare(b.lastBookingAt ?? ""),
  );

  // ── Stats ──────────────────────────────────────────────
  const bookingsThisWeek = allBookings.filter(
    (b: any) => b.startsAt >= weekStart && b.startsAt < weekEnd,
  );
  const activeStudentsThisWeek = new Set<string>();
  for (const b of bookingsThisWeek) activeStudentsThisWeek.add(b.userId);
  for (const t of recentTakes) activeStudentsThisWeek.add(t.studentId);

  // ── Week density (Mon..Sun, lesson counts) ─────────────
  const dayLabels = ["M", "T", "W", "T", "F", "S", "S"];
  const todayYmd = ymd(now);
  const weekDensity = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const nextDay = new Date(d);
    nextDay.setDate(d.getDate() + 1);
    const count = allBookings.filter(
      (b: any) => b.status !== "CANCELLED" && b.startsAt >= d && b.startsAt < nextDay,
    ).length;
    return {
      dayLabel: dayLabels[i],
      date: ymd(d),
      lessonCount: count,
      isToday: ymd(d) === todayYmd,
    };
  });

  // ── Activity feed ──────────────────────────────────────
  const activity: any[] = [];
  for (const t of recentTakes.slice(0, 8)) {
    activity.push({
      kind: "TAKE_SENT",
      student: t.student,
      text: t.pieceTitle ? `sent a take · ${t.pieceTitle}` : "sent a take",
      at: t.createdAt.toISOString(),
    });
  }
  for (const b of allBookings) {
    if (b.status !== "COMPLETED" || !b.completedAt) continue;
    if (b.completedAt < weekStart) continue;
    activity.push({
      kind: "BOOKING_COMPLETED",
      student: b.user,
      text: "completed a lesson",
      at: b.completedAt.toISOString(),
    });
  }
  activity.sort((a, b) => (a.at < b.at ? 1 : -1));

  return c.json({
    data: {
      unreviewedTakes: unreviewedItems,
      bookingsMissingNotes,
      studentsWithoutPlan: studentsWithoutPlan.slice(0, 6),
      weekStats: {
        totalStudents: studentMap.size,
        activeThisWeek: activeStudentsThisWeek.size,
        takesReceivedThisWeek: recentTakes.length,
        bookingsThisWeek: bookingsThisWeek.length,
      },
      weekDensity,
      recentActivity: activity.slice(0, 8),
      weekStartsOn: weekStart.toISOString(),
    },
  });
});

function ymd(d: Date): string {
  // Local-date YYYY-MM-DD (matches the front-end's local-date math).
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function serializeBookingLight(b: any) {
  return {
    id: b.id,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    status: b.status,
    mode: b.mode,
    meetingUrl: b.meetingUrl,
    meetingProvider: b.meetingProvider,
    studentNote: b.studentNote,
    practiceNotes: b.practiceNotes,
    completedAt: b.completedAt?.toISOString() ?? null,
    usedSubscription: b.usedSubscription,
    scheduleId: b.scheduleId,
    category: b.category ?? null,
    skillTree: b.skillTree ?? null,
    node: b.node ?? null,
    createdAt: b.createdAt.toISOString(),
    user: b.user,
    coach: b.coach,
  };
}

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

