import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { getDb } from "../lib/db";
import { parseRoutine } from "../lib/routine";
import { computeStreak } from "../lib/streak";

type MeEnv = {
  Variables: {
    user: { id: string; email: string; name: string; avatarUrl: string | null; bio: string | null; role: string } | null;
    sessionId: string | null;
  };
};

const me = new Hono<MeEnv>();

// UTC midnight for the given date — the canonical "day" key for routine
// completions and streak math, so a check-off is scoped to a calendar day
// regardless of the request's local time.
function utcMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

me.get("/", requireAuth, (c) => {
  const user = c.get("user")!;
  return c.json({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      role: user.role,
    },
  });
});

// GET /api/me/student-data — same shape as /api/coaches/students/:id but for self.
// Lets the practice / journal screens fetch the logged-in student's own data
// without needing COACH/ADMIN role.
me.get("/student-data", requireAuth, async (c) => {
  const user = c.get("user")!;
  const db = getDb();

  const userSelect = {
    id: true, name: true, email: true, avatarUrl: true, bio: true, role: true,
  } as const;

  const [student, bookings, completionDays, assignments, takes, latestSentNote] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: {
        id: true, name: true, email: true, avatarUrl: true, bio: true,
        age: true, instrument: true, currentRoutine: true,
      },
    }),
    db.booking.findMany({
      where: { userId: user.id },
      orderBy: { startsAt: "desc" },
      select: {
        id: true, startsAt: true, endsAt: true, status: true, mode: true,
        practiceNotes: true, practiceNotesSentAt: true, noteSections: true,
        coachId: true,
        coach: { select: userSelect },
      },
    }),
    // Distinct days the student completed an exercise — streak is derived
    // from these (source of truth) rather than a separately-bumped counter.
    db.routineCompletion.findMany({
      where: { userId: user.id },
      select: { day: true },
      distinct: ["day"],
      orderBy: { day: "desc" },
    }),
    db.assignment.findMany({
      where: { studentId: user.id },
      orderBy: [{ weekStartsOn: "desc" }, { sortOrder: "asc" }],
      take: 30,
    }),
    db.take.findMany({
      where: { studentId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        annotations: { include: { author: { select: userSelect } } },
        replies: { include: { author: { select: userSelect } } },
      },
    }),
    db.booking.findFirst({
      where: { userId: user.id, practiceNotes: { not: null } },
      orderBy: { startsAt: "desc" },
      include: {
        coach: { select: userSelect },
        lessonSummary: { include: { editedBy: { select: userSelect } } },
        noteReadReceipts: true,
        noteVoiceMemos: {
          include: { addedBy: { select: userSelect } },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
  ]);

  if (!student) {
    return c.json({ error: "Not found" }, 404);
  }

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

  // Enrich the routine with media URLs from the linked library items and
  // today's completion state, so the Practice path can play audio/MIDI and
  // render which stops are checked off for the day.
  const parsedRoutine = parseRoutine((student as any).currentRoutine);
  const libIds = parsedRoutine.items
    .map((it) => it.libraryItemId)
    .filter((x): x is string => !!x);
  const today = utcMidnight(new Date());
  const since = new Date(today.getTime() - 13 * 86_400_000); // last 14 days incl. today
  const [libItems, completions] = await Promise.all([
    libIds.length
      ? db.libraryItem.findMany({
          where: { id: { in: libIds } },
          select: { id: true, audioUrl: true, midiUrl: true, pdfUrl: true, hasMidi: true },
        })
      : Promise.resolve([] as Array<{ id: string; audioUrl: string | null; midiUrl: string | null; pdfUrl: string | null; hasMidi: boolean }>),
    db.routineCompletion.findMany({
      where: { userId: user.id, day: { gte: since } },
      select: { routineItemId: true, day: true },
    }),
  ]);
  const libById = new Map(libItems.map((l) => [l.id, l]));
  const doneIds = new Set(
    completions.filter((rc) => rc.day.getTime() === today.getTime()).map((rc) => rc.routineItemId),
  );
  // Distinct calendar days (UTC) the student completed at least one exercise,
  // for the streak row on the Practice page.
  const recentPracticeDays = [
    ...new Set(completions.map((rc) => rc.day.toISOString().slice(0, 10))),
  ].sort();
  const enrichedRoutine = {
    items: parsedRoutine.items.map((it) => {
      const lib = it.libraryItemId ? libById.get(it.libraryItemId) : null;
      return {
        ...it,
        audioUrl: lib?.audioUrl ?? null,
        midiUrl: lib?.midiUrl ?? null,
        pdfUrl: lib?.pdfUrl ?? null,
        hasMidi: lib?.hasMidi ?? false,
        completedToday: doneIds.has(it.id),
      };
    }),
    updatedAt: parsedRoutine.updatedAt,
  };

  const derivedStreak = computeStreak(
    completionDays.map((r) => r.day.toISOString().slice(0, 10)),
  );

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
    streak: {
      currentDays: derivedStreak.currentDays,
      longestDays: derivedStreak.longestDays,
      lastPracticedAt: derivedStreak.lastDay
        ? new Date(derivedStreak.lastDay + "T00:00:00.000Z").toISOString()
        : null,
    },
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
    latestNoteCoach: latestSentNote?.coach ?? null,
    routine: enrichedRoutine,
    recentPracticeDays,
  };

  return c.json({ data });
});

// POST /api/me/takes — student submits a new take. Coach is inferred from the
// assignment's coach, or from the student's most recent booking if no
// assignment is attached.
me.post("/takes", requireAuth, async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  const body = await c.req.json<{
    assignmentId?: string | null;
    pieceTitle: string;
    bars?: string | null;
    takeNumber?: number;
    durationSec: number;
    selfRating?: number | null;
    selfNote?: string | null;
  }>();

  if (!body.pieceTitle || typeof body.durationSec !== "number") {
    return c.json({ error: "pieceTitle and durationSec are required" }, 400);
  }

  let coachId: string | null = null;
  if (body.assignmentId) {
    const a = await db.assignment.findUnique({
      where: { id: body.assignmentId },
      select: { coachId: true, studentId: true },
    });
    if (!a || a.studentId !== user.id) {
      return c.json({ error: "Assignment not found" }, 404);
    }
    coachId = a.coachId;
  } else {
    const lastBooking = await db.booking.findFirst({
      where: { userId: user.id, coachId: { not: null } },
      orderBy: { startsAt: "desc" },
      select: { coachId: true },
    });
    coachId = lastBooking?.coachId ?? null;
  }
  if (!coachId) {
    return c.json({ error: "No coach to send the take to" }, 400);
  }

  const take = await db.take.create({
    data: {
      studentId: user.id,
      coachId,
      assignmentId: body.assignmentId ?? null,
      pieceTitle: body.pieceTitle,
      bars: body.bars ?? null,
      takeNumber: body.takeNumber ?? 1,
      durationSec: Math.max(1, Math.round(body.durationSec)),
      selfRating: body.selfRating ?? null,
      selfNote: body.selfNote ?? null,
      status: "UNREVIEWED",
    },
  });

  return c.json({ data: { id: take.id } }, 201);
});

// GET /api/me/inbox-count — unread incoming SessionMessages for the
// calling user (treated as a student). A message is unread when it
// arrived after lastInboxViewedAt (or never set) AND has no per-item
// read receipt for this user.
me.get("/inbox-count", requireAuth, async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  const meRow = await db.user.findUnique({
    where: { id: user.id },
    select: { lastInboxViewedAt: true },
  });
  const since = meRow?.lastInboxViewedAt ?? null;
  const count = await db.sessionMessage.count({
    where: {
      booking: { userId: user.id },
      NOT: { senderId: user.id },
      ...(since ? { createdAt: { gt: since } } : {}),
      reads: { none: { userId: user.id } },
    },
  });
  return c.json({ data: { count } });
});

// POST /api/me/inbox-viewed — stamp the user's lastInboxViewedAt to
// now. Behaves as a "mark all read" — the per-item reads stay in
// place but cease to be load-bearing.
me.post("/inbox-viewed", requireAuth, async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  await db.user.update({
    where: { id: user.id },
    data: { lastInboxViewedAt: new Date() },
  });
  return c.json({ data: { count: 0 } });
});

// POST /api/me/inbox/:messageId/read — mark a single message read
// from the student side. Only valid for messages on bookings the
// caller owns as the student.
me.post("/inbox/:messageId/read", requireAuth, async (c) => {
  const user = c.get("user")!;
  const messageId = c.req.param("messageId");
  const db = getDb();
  const msg = await db.sessionMessage.findUnique({
    where: { id: messageId },
    include: { booking: { select: { userId: true } } },
  });
  if (!msg) return c.json({ error: "Not found" }, 404);
  if (msg.booking.userId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }
  await db.sessionMessageRead.upsert({
    where: { messageId_userId: { messageId, userId: user.id } },
    update: { readAt: new Date() },
    create: { messageId, userId: user.id },
  });
  return c.json({ data: { ok: true } });
});

me.delete("/inbox/:messageId/read", requireAuth, async (c) => {
  const user = c.get("user")!;
  const messageId = c.req.param("messageId");
  const db = getDb();
  await db.sessionMessageRead.deleteMany({
    where: { messageId, userId: user.id },
  });
  return c.json({ data: { ok: true } });
});

// POST /api/me/routine/complete — toggle today's completion for one routine
// item. Body: { routineItemId: string, completed: boolean }. The first
// completion of any item on a given day advances the practice streak;
// un-checking removes the day's row but never rolls the streak back.
me.post("/routine/complete", requireAuth, async (c) => {
  const user = c.get("user")!;
  const db = getDb();

  const body = (await c.req.json().catch(() => null)) as
    | { routineItemId?: unknown; completed?: unknown }
    | null;
  const routineItemId = typeof body?.routineItemId === "string" ? body.routineItemId : "";
  const completed = body?.completed === true;
  if (!routineItemId) {
    return c.json({ error: "routineItemId required" }, 400);
  }

  // Guard: the id must belong to the student's own current routine.
  const student = await db.user.findUnique({
    where: { id: user.id },
    select: { currentRoutine: true },
  });
  const routine = parseRoutine(student?.currentRoutine ?? null);
  if (!routine.items.some((it) => it.id === routineItemId)) {
    return c.json({ error: "Routine item not found" }, 404);
  }

  const now = new Date();
  const today = utcMidnight(now);

  if (completed) {
    await db.routineCompletion.upsert({
      where: { userId_routineItemId_day: { userId: user.id, routineItemId, day: today } },
      update: {},
      create: { userId: user.id, routineItemId, day: today },
    });
  } else {
    await db.routineCompletion.deleteMany({
      where: { userId: user.id, routineItemId, day: today },
    });
  }

  // Recompute the streak from the actual completion days (source of truth)
  // and persist it, so un-checking rolls the streak back correctly instead
  // of leaving a stale counter.
  const completionDays = await db.routineCompletion.findMany({
    where: { userId: user.id },
    select: { day: true },
    distinct: ["day"],
  });
  const derived = computeStreak(completionDays.map((r) => r.day.toISOString().slice(0, 10)));
  const lastPracticedAt = derived.lastDay
    ? new Date(derived.lastDay + "T00:00:00.000Z")
    : null;
  await db.practiceStreak.upsert({
    where: { userId: user.id },
    update: { currentDays: derived.currentDays, longestDays: derived.longestDays, lastPracticedAt },
    create: {
      userId: user.id,
      currentDays: derived.currentDays,
      longestDays: derived.longestDays,
      lastPracticedAt,
    },
  });

  return c.json({
    data: {
      routineItemId,
      completedToday: completed,
      streak: {
        currentDays: derived.currentDays,
        longestDays: derived.longestDays,
        lastPracticedAt: lastPracticedAt?.toISOString() ?? null,
      },
    },
  });
});

export { me as meRoutes };
