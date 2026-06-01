import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { parseRoutine, serializeRoutine } from "../lib/routine";
import { serializeGoal } from "../lib/goals";
import type { RoutineItem, LibraryItemKind } from "@sunbird/shared";
import { createTakeReplySchema, createTakeAnnotationSchema } from "@sunbird/shared";
import { createEmailService } from "../services/email.service";

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

// GET /api/coaches/inbox-count — number of unread incoming
// SessionMessages for this coach. Read state is per-item: a message is
// unread when it has no read receipt for this user. Powers the sidebar
// badge.
coachRoutes.get("/inbox-count", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  const bookingFilter = user.role === "COACH" ? { coachId: user.id } : {};
  const count = await db.sessionMessage.count({
    where: {
      booking: bookingFilter,
      NOT: { senderId: user.id },
      reads: { none: { userId: user.id } },
    },
  });
  return c.json({ data: { count } });
});

// POST /api/coaches/inbox/:messageId/read — mark a single message read.
// Upsert is idempotent; calling it on an already-read message is fine.
coachRoutes.post("/inbox/:messageId/read", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const messageId = c.req.param("messageId");
  const db = getDb();
  // Verify the message exists and belongs to a booking this coach
  // owns — otherwise we'd be writing read receipts for other coaches'
  // inboxes via guessed IDs.
  const msg = await db.sessionMessage.findUnique({
    where: { id: messageId },
    include: { booking: { select: { coachId: true } } },
  });
  if (!msg) return c.json({ error: "Not found" }, 404);
  if (user.role === "COACH" && msg.booking.coachId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }
  await db.sessionMessageRead.upsert({
    where: { messageId_userId: { messageId, userId: user.id } },
    update: { readAt: new Date() },
    create: { messageId, userId: user.id },
  });
  return c.json({ data: { ok: true } });
});

// DELETE /api/coaches/inbox/:messageId/read — un-mark (toggle back to
// unread) by removing the per-item read receipt. Read state is purely
// receipt-based, so this sticks across reloads.
coachRoutes.delete("/inbox/:messageId/read", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const messageId = c.req.param("messageId");
  const db = getDb();
  await db.sessionMessageRead.deleteMany({
    where: { messageId, userId: user.id },
  });
  return c.json({ data: { ok: true } });
});

// GET /api/coaches/inbox — list incoming SessionMessages on this
// coach's bookings (not sent by them), newest first, capped at 50.
// Returns each message with sender + booking context plus an `unread`
// flag (no read receipt for this user) so the UI can highlight new
// rows without a second roundtrip.
coachRoutes.get("/inbox", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  const bookingFilter = user.role === "COACH" ? { coachId: user.id } : {};

  const messages: any[] = await db.sessionMessage.findMany({
    where: {
      booking: bookingFilter,
      NOT: { senderId: user.id },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      sender:  { select: { id: true, name: true, avatarUrl: true } },
      booking: {
        select: {
          id: true,
          startsAt: true,
          category: { select: { title: true } },
          user:     { select: { id: true, name: true } },
        },
      },
      // Just the receipt for the calling user, if any.
      reads: {
        where: { userId: user.id },
        select: { readAt: true },
      },
    },
  });

  return c.json({
    data: {
      items: messages.map((m) => {
        const hasReceipt = Array.isArray(m.reads) && m.reads.length > 0;
        return {
          id: m.id,
          bookingId: m.bookingId,
          content: m.content,
          createdAt: m.createdAt.toISOString(),
          unread: !hasReceipt,
          sender: {
            id: m.sender.id,
            name: m.sender.name,
            avatarUrl: m.sender.avatarUrl ?? null,
          },
          booking: {
            id: m.booking.id,
            startsAt: m.booking.startsAt.toISOString(),
            category: m.booking.category ? { title: m.booking.category.title } : null,
            student: m.booking.user
              ? { id: m.booking.user.id, name: m.booking.user.name }
              : null,
          },
        };
      }),
    },
  });
});

// POST /api/coaches/inbox-viewed — "mark all read". Creates a read
// receipt for every incoming message that lacks one, so the state is
// per-item (and a later per-item "mark unread" actually sticks).
coachRoutes.post("/inbox-viewed", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const db = getDb();
  const bookingFilter = user.role === "COACH" ? { coachId: user.id } : {};
  const unread = await db.sessionMessage.findMany({
    where: {
      booking: bookingFilter,
      NOT: { senderId: user.id },
      reads: { none: { userId: user.id } },
    },
    select: { id: true },
  });
  if (unread.length > 0) {
    await db.sessionMessageRead.createMany({
      data: unread.map((m) => ({ messageId: m.id, userId: user.id })),
    });
  }
  return c.json({ data: { count: 0 } });
});

// POST /api/coaches/takes/:takeId/reply — coach leaves written feedback on a
// student's take. Records a TakeReply, flips the take to REPLIED, and notifies
// the student (inbox message + email).
coachRoutes.post("/takes/:takeId/reply", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const takeId = c.req.param("takeId");
  const db = getDb();

  const body = await c.req.json().catch(() => null);
  const parsed = createTakeReplySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const take = await db.take.findUnique({
    where: { id: takeId },
    select: { id: true, coachId: true, studentId: true, pieceTitle: true },
  });
  if (!take) {
    return c.json({ error: "Take not found" }, 404);
  }
  if (user.role === "COACH" && take.coachId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const reply = await db.takeReply.create({
    data: {
      takeId,
      authorId: user.id,
      text: parsed.data.text ?? null,
      starRating: parsed.data.starRating ?? null,
      summaryText: parsed.data.summaryText ?? null,
    },
  });
  await db.take.update({ where: { id: takeId }, data: { status: "REPLIED", reviewedAt: new Date() } });

  // Notify the student: message on their most recent booking with this coach
  // (senderId = coach → student inbox), plus an email. Best-effort.
  const booking = await db.booking.findFirst({
    where: { userId: take.studentId, coachId: take.coachId },
    orderBy: { startsAt: "desc" },
    select: { id: true },
  });
  if (booking) {
    await db.sessionMessage
      .create({ data: { bookingId: booking.id, senderId: user.id, content: `💬 ${user.name} replied on your "${take.pieceTitle}" take` } })
      .catch((err: unknown) => console.error("Failed to write take-reply notification:", err));
  }
  try {
    const student = await db.user.findUnique({ where: { id: take.studentId }, select: { email: true, name: true } });
    if (student?.email) {
      const apiKey = (c.env as any)?.RESEND_API_KEY || process.env.RESEND_API_KEY || "";
      const from = (c.env as any)?.EMAIL_FROM || process.env.EMAIL_FROM || "noreply@sunbird.io";
      createEmailService(apiKey, from)
        .sendTakeReply(student.email, student.name, user.name, take.pieceTitle)
        .catch(console.error);
    }
  } catch {}

  return c.json({ data: { id: reply.id } }, 201);
});

// Serialize a take (with its annotations + replies) to the TakePublic shape.
function serializeTake(t: any) {
  return {
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
    annotations: (t.annotations ?? []).map((a: any) => ({
      id: a.id, takeId: a.takeId, kind: a.kind, targetType: a.targetType,
      targetBar: a.targetBar, targetTimeSec: a.targetTimeSec, text: a.text,
      voiceUrl: a.voiceUrl, voiceDurSec: a.voiceDurSec,
      createdAt: a.createdAt.toISOString(), author: a.author,
    })),
    replies: (t.replies ?? []).map((r: any) => ({
      id: r.id, takeId: r.takeId, text: r.text, voiceUrl: r.voiceUrl,
      voiceDurSec: r.voiceDurSec, starRating: r.starRating, summaryText: r.summaryText,
      createdAt: r.createdAt.toISOString(), author: r.author,
    })),
  };
}

const takeAuthorSelect = { select: { id: true, name: true, email: true, avatarUrl: true, role: true } };
const takeReviewInclude = {
  annotations: { include: { author: takeAuthorSelect }, orderBy: { createdAt: "asc" as const } },
  replies: { include: { author: takeAuthorSelect }, orderBy: { createdAt: "asc" as const } },
  student: { select: { id: true, name: true, avatarUrl: true } },
};

// GET /api/coaches/takes/:takeId — a single take with annotations + replies +
// the student, for the coach review page.
coachRoutes.get("/takes/:takeId", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const takeId = c.req.param("takeId");
  const db = getDb();
  const take: any = await db.take.findUnique({ where: { id: takeId }, include: takeReviewInclude });
  if (!take) return c.json({ error: "Take not found" }, 404);
  if (user.role === "COACH" && take.coachId !== user.id) {
    return c.json({ error: "Forbidden" }, 403);
  }
  return c.json({ data: { ...serializeTake(take), student: take.student } });
});

// POST /api/coaches/takes/:takeId/annotations — pin an annotation on a take.
coachRoutes.post("/takes/:takeId/annotations", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const takeId = c.req.param("takeId");
  const db = getDb();
  const body = await c.req.json().catch(() => null);
  const parsed = createTakeAnnotationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const take = await db.take.findUnique({ where: { id: takeId }, select: { coachId: true, status: true } });
  if (!take) return c.json({ error: "Take not found" }, 404);
  if (user.role === "COACH" && take.coachId !== user.id) return c.json({ error: "Forbidden" }, 403);

  const ann = await db.takeAnnotation.create({
    data: {
      takeId,
      authorId: user.id,
      kind: parsed.data.kind,
      targetType: parsed.data.targetType,
      targetBar: parsed.data.targetBar ?? null,
      targetTimeSec: parsed.data.targetTimeSec ?? null,
      text: parsed.data.text ?? null,
    },
    include: { author: takeAuthorSelect },
  });
  // Opening a review on an untouched take moves it out of the unreviewed queue.
  if (take.status === "UNREVIEWED") {
    await db.take.update({ where: { id: takeId }, data: { status: "REVIEWING" } });
  }
  return c.json({
    data: {
      id: ann.id, takeId: ann.takeId, kind: ann.kind, targetType: ann.targetType,
      targetBar: ann.targetBar, targetTimeSec: ann.targetTimeSec, text: ann.text,
      voiceUrl: ann.voiceUrl, voiceDurSec: ann.voiceDurSec,
      createdAt: ann.createdAt.toISOString(), author: ann.author,
    },
  }, 201);
});

// DELETE /api/coaches/takes/:takeId/annotations/:annotationId — remove a pin.
coachRoutes.delete("/takes/:takeId/annotations/:annotationId", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const { takeId, annotationId } = c.req.param();
  const db = getDb();
  const take = await db.take.findUnique({ where: { id: takeId }, select: { coachId: true } });
  if (!take) return c.json({ error: "Take not found" }, 404);
  if (user.role === "COACH" && take.coachId !== user.id) return c.json({ error: "Forbidden" }, 403);
  await db.takeAnnotation.deleteMany({ where: { id: annotationId, takeId } });
  return c.json({ data: { ok: true } });
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

  // ── Derive: students whose most recent session has passed with no future
  // booking on the books (the "skip-the-gate" follow-up to-do). One row per
  // such student, anchored on their latest past booking. ────────────────
  const bookingsNeedingNextSession: any[] = [];
  for (const [sid, student] of studentMap.entries()) {
    const hasFuture = allBookings.some((b: any) => b.userId === sid && b.startsAt >= now);
    if (hasFuture) continue;
    // Latest past booking (allBookings is sorted desc) — only flag recently
    // active students so long-lapsed ones don't clutter the column.
    const lastPast = allBookings.find((b: any) => b.userId === sid && b.startsAt < now);
    if (!lastPast) continue;
    if (now.getTime() - lastPast.startsAt.getTime() > 21 * 86_400_000) continue;
    bookingsNeedingNextSession.push({
      student,
      lastBookingId: lastPast.id,
      lastBookingAt: lastPast.startsAt.toISOString(),
    });
  }
  bookingsNeedingNextSession.sort((a, b) => (a.lastBookingAt < b.lastBookingAt ? 1 : -1));

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
      bookingsNeedingNextSession: bookingsNeedingNextSession.slice(0, 6),
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
  let noteSections: any = null;
  if (b.noteSections) {
    try { noteSections = JSON.parse(b.noteSections); } catch {}
  }
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
    noteSections,
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

  const [student, bookings, streak, assignments, takes, latestSentNote, goals] = await Promise.all([
    db.user.findUnique({
      where: { id: studentId },
      select: {
        id: true, name: true, email: true, avatarUrl: true, bio: true,
        age: true, instrument: true, currentRoutine: true,
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
    // Goals this student shares — scoped to this coach when the caller is a
    // coach so they only see goals shared with them.
    // Tolerate a not-yet-migrated Goal table in prod (see me.ts).
    db.goal.findMany({
      where: { studentId, status: { not: "ARCHIVED" }, ...(user.role === "COACH" ? { coachId: user.id } : {}) },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }).catch(() => []),
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
    takes: takes.map(serializeTake),
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
    routine: parseRoutine((student as any).currentRoutine),
    goals: goals.map(serializeGoal),
  };

  return c.json({ data });
});

// PUT /api/coaches/students/:id/routine — replace a student's current
// routine with the supplied ordered list. The caller must coach this
// student (i.e. own at least one booking with them) unless they're an
// admin. Items are stored as snapshots so renaming/deleting a library
// item later doesn't corrupt the routine.
coachRoutes.put("/students/:id/routine", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const studentId = c.req.param("id");
  const db = getDb();

  if (user.role === "COACH") {
    const hasBooking = await db.booking.findFirst({
      where: { userId: studentId, coachId: user.id },
      select: { id: true },
    });
    if (!hasBooking) return c.json({ error: "Forbidden" }, 403);
  }

  const body = (await c.req.json().catch(() => null)) as
    | { items?: Array<Partial<RoutineItem>>; bookingId?: string }
    | null;
  if (!body || !Array.isArray(body.items)) {
    return c.json({ error: "items array required" }, 400);
  }

  // Optional: when the routine is saved at the end of a session, the caller
  // passes that session's bookingId so we snapshot the routine onto it. The
  // booking must belong to this student (and this coach, unless admin).
  const bookingId = typeof body.bookingId === "string" ? body.bookingId : null;
  if (bookingId) {
    const booking = await db.booking.findFirst({
      where: {
        id: bookingId,
        userId: studentId,
        ...(user.role === "COACH" ? { coachId: user.id } : {}),
      },
      select: { id: true },
    });
    if (!booking) return c.json({ error: "Booking not found" }, 404);
  }

  const ALLOWED_KINDS: ReadonlySet<LibraryItemKind> = new Set(["warmup", "exercise", "song"]);
  const cleaned: RoutineItem[] = [];
  for (const raw of body.items) {
    if (!raw || typeof raw !== "object") continue;
    const kind = raw.kind as LibraryItemKind | undefined;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (!kind || !ALLOWED_KINDS.has(kind) || !title) continue;
    cleaned.push({
      id: typeof raw.id === "string" && raw.id ? raw.id : Math.random().toString(36).slice(2, 10),
      libraryItemId: typeof raw.libraryItemId === "string" ? raw.libraryItemId : null,
      kind,
      title,
      bars: typeof raw.bars === "string" ? raw.bars : null,
      bpmStart: typeof raw.bpmStart === "number" ? raw.bpmStart : null,
      bpmEnd: typeof raw.bpmEnd === "number" ? raw.bpmEnd : null,
      durationMin: typeof raw.durationMin === "number" ? raw.durationMin : null,
      note: typeof raw.note === "string" ? raw.note : null,
    });
  }

  const stored = serializeRoutine(cleaned);
  await db.user.update({ where: { id: studentId }, data: { currentRoutine: stored } });
  if (bookingId) {
    await db.booking.update({ where: { id: bookingId }, data: { routineSnapshot: stored } });
  }
  return c.json({ data: parseRoutine(stored) });
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

