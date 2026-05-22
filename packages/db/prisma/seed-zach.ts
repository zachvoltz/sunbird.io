// Demo seed for the new Coach UI. Idempotent — safe to re-run.
//
// What this sets up for Zach Voltz (zachvoltz@gmail.com):
//   - age + instrument on the User row
//   - a 14-day practice streak
//   - a recent COMPLETED booking with a structured practice note + AI summary
//     stub + 2 read receipts
//   - the next CONFIRMED booking moved to today @ 3:00 PM
//   - 3 weekly assignments (warmup / exercise / song) for this week
//   - 2 takes (one with pin + voice annotations + a coach reply)
//
// All demo rows are tagged with internal markers (subtitle prefix, noteText
// prefix) so a re-run wipes the prior demo rows before re-inserting.

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const DEMO_TAG = "[demo]";

function mondayOf(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = out.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  out.setUTCDate(out.getUTCDate() + diff);
  return out;
}

async function main() {
  const zach = await db.user.findUnique({ where: { email: "zachvoltz@gmail.com" } });
  if (!zach) {
    console.error("Zach not found — run the main seed first.");
    process.exit(1);
  }

  // ── 1. User profile additions ──────────────────────────
  await db.user.update({
    where: { id: zach.id },
    data: { age: 32, instrument: "voice" },
  });

  // ── 2. Practice streak ─────────────────────────────────
  await db.practiceStreak.upsert({
    where: { userId: zach.id },
    update: {
      currentDays: 14,
      longestDays: 22,
      lastPracticedAt: new Date(),
    },
    create: {
      userId: zach.id,
      currentDays: 14,
      longestDays: 22,
      lastPracticedAt: new Date(),
    },
  });

  // ── 3. Sync today's booking → "today 3:00 PM" ──────────
  const today = new Date();
  const todayAt3pm = new Date(today);
  todayAt3pm.setHours(15, 0, 0, 0);
  const todayAt330pm = new Date(today);
  todayAt330pm.setHours(15, 30, 0, 0);

  const upcoming = await db.booking.findFirst({
    where: { userId: zach.id, status: "CONFIRMED" },
    orderBy: { startsAt: "asc" },
  });
  if (upcoming) {
    await db.booking.update({
      where: { id: upcoming.id },
      data: {
        coachId: zach.id, // self as coach for demo
        startsAt: todayAt3pm,
        endsAt: todayAt330pm,
        mode: "ONLINE",
      },
    });
  }

  // ── 4. Completed booking with structured note + summary ─
  // Find existing demo note booking (idempotency), or create one a week back.
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  weekAgo.setHours(15, 0, 0, 0);
  const weekAgoEnd = new Date(weekAgo);
  weekAgoEnd.setMinutes(30);

  // Find by demo marker in studentNote
  let pastBooking = await db.booking.findFirst({
    where: { userId: zach.id, studentNote: { startsWith: DEMO_TAG } },
  });

  const sections = {
    intro: "Hi Zach — really nice work today, especially the dynamics in the new piece.",
    scalesExercises:
      "C major 2 oct (clean) · Hanon № 4 at 60 bpm — finger 3↔4 cleaner than last week",
    topics:
      "finger 3 ↔ 4 independence · shaping the phrase peak · pedal-with-the-ear, not the beat",
    songWork:
      "River Flows bars 16-24 — tone control on the swell, dynamics ✓",
    otherSongs: "Chopin Prélude № 4 · Debussy Arabesque № 1 (browse together Fri)",
    nextTime:
      "1. Hanon № 4 — slow on bar 12, fingers 3 & 4. Start at 60 bpm.\n2. River Flows — send a take of bars 16-24 by Wed.\nKeep that streak going! — K",
  };
  const flatNote = [
    sections.intro,
    "",
    "Scales & exercises done:",
    sections.scalesExercises,
    "",
    "Topics discussed:",
    sections.topics,
    "",
    "Song work:",
    sections.songWork,
    "",
    "Other song suggestions:",
    sections.otherSongs,
    "",
    "Next time:",
    sections.nextTime,
  ].join("\n");

  if (!pastBooking) {
    pastBooking = await db.booking.create({
      data: {
        userId: zach.id,
        coachId: zach.id,
        startsAt: weekAgo,
        endsAt: weekAgoEnd,
        status: "COMPLETED",
        mode: "ONLINE",
        studentNote: `${DEMO_TAG} (demo) excited to dig into the new piece this week`,
        practiceNotes: flatNote,
        practiceNotesSentAt: new Date(weekAgo.getTime() + 30 * 60_000),
        noteSections: JSON.stringify(sections),
        completedAt: new Date(weekAgo.getTime() + 30 * 60_000),
      },
    });
  } else {
    await db.booking.update({
      where: { id: pastBooking.id },
      data: {
        startsAt: weekAgo,
        endsAt: weekAgoEnd,
        practiceNotes: flatNote,
        practiceNotesSentAt: new Date(weekAgo.getTime() + 30 * 60_000),
        noteSections: JSON.stringify(sections),
        status: "COMPLETED",
        completedAt: new Date(weekAgo.getTime() + 30 * 60_000),
      },
    });
  }

  // AI summary stub on the past booking
  const summaryBullets = [
    "Spent ~12 min on Hanon № 4; finger 3→4 swap at bar 12 settled at 60 bpm by the end.",
    "River Flows bars 16-24 ran for ~8 min — clear breakthrough on the dynamic swell at bar 20; pedal still rushing.",
    "Brief discussion of next piece — Chopin Prélude № 4 and Debussy Arabesque came up.",
    "Action items: slow practice 60 bpm · take by Wed · new-piece browse Friday.",
  ];
  await db.lessonSummary.upsert({
    where: { bookingId: pastBooking.id },
    update: {
      bullets: JSON.stringify(summaryBullets),
      status: "READY",
      durationMin: 28,
      generatedAt: new Date(weekAgo.getTime() + 31 * 60_000),
    },
    create: {
      bookingId: pastBooking.id,
      bullets: JSON.stringify(summaryBullets),
      status: "READY",
      durationMin: 28,
      generatedAt: new Date(weekAgo.getTime() + 31 * 60_000),
    },
  });

  // Read receipts — two demo opens (delete + recreate for idempotency)
  await db.noteReadReceipt.deleteMany({ where: { bookingId: pastBooking.id } });
  await db.noteReadReceipt.createMany({
    data: [
      { bookingId: pastBooking.id, userId: zach.id, readAt: new Date(weekAgo.getTime() + 90 * 60_000) },
      { bookingId: pastBooking.id, userId: zach.id, readAt: new Date(weekAgo.getTime() + 6 * 3600_000) },
    ],
  });

  // ── 5. Assignments for this week ───────────────────────
  const weekStart = mondayOf(today);
  // Wipe demo assignments first
  await db.assignment.deleteMany({
    where: { studentId: zach.id, subtitle: { startsWith: DEMO_TAG } },
  });
  await db.assignment.createMany({
    data: [
      {
        studentId: zach.id,
        coachId: zach.id,
        type: "WARMUP",
        title: "C major scale · 2 octaves",
        subtitle: `${DEMO_TAG} warmup · 80 bpm · 5 min · MIDI attached`,
        bars: null,
        weekStartsOn: weekStart,
        tempoBpmStart: 80,
        tempoBpmEnd: 80,
        durationMin: 5,
        status: "IN_PROGRESS",
        completionCount: 4,
        sortOrder: 0,
        hasMidi: true,
      },
      {
        studentId: zach.id,
        coachId: zach.id,
        type: "EXERCISE",
        title: "Hanon № 4 — bar 12 loop",
        subtitle: `${DEMO_TAG} exercise · 60 → 88 bpm · 8 min`,
        bars: "bar 12",
        weekStartsOn: weekStart,
        tempoBpmStart: 60,
        tempoBpmEnd: 88,
        durationMin: 8,
        status: "IN_PROGRESS",
        completionCount: 2,
        noteText: "Slow this WAY down — really lift 3 & 4 on the repeats. Hands separate first.",
        hasNotePinned: true,
        hasMidi: true,
        sortOrder: 1,
      },
      {
        studentId: zach.id,
        coachId: zach.id,
        type: "SONG",
        title: "River Flows in You — bars 16-24",
        subtitle: `${DEMO_TAG} song · 88 bpm · record & send · due Wed`,
        bars: "bars 16-24",
        weekStartsOn: weekStart,
        tempoBpmStart: 88,
        tempoBpmEnd: 88,
        durationMin: 10,
        status: "IN_PROGRESS",
        completionCount: 3,
        dueAt: new Date(weekStart.getTime() + 2 * 86400_000), // Wednesday
        hasMidi: true,
        sortOrder: 2,
      },
    ],
  });

  // ── 6. Takes ──────────────────────────────────────────
  // Wipe demo takes first
  await db.take.deleteMany({
    where: { studentId: zach.id, selfNote: { startsWith: DEMO_TAG } },
  });
  const riverAssignment = await db.assignment.findFirst({
    where: { studentId: zach.id, title: { startsWith: "River Flows" } },
  });

  const recentTake = await db.take.create({
    data: {
      studentId: zach.id,
      coachId: zach.id,
      assignmentId: riverAssignment?.id ?? null,
      pieceTitle: "River Flows in You",
      bars: "bars 16-24",
      takeNumber: 3,
      durationSec: 48,
      audioUrl: null, // file upload deferred
      selfRating: 4,
      selfNote: `${DEMO_TAG} feels pretty good!`,
      status: "UNREVIEWED",
      createdAt: new Date(today.getTime() - 2 * 3600_000),
    },
  });
  await db.takeAnnotation.createMany({
    data: [
      {
        takeId: recentTake.id,
        authorId: zach.id,
        kind: "LOVE",
        targetType: "SCORE_BAR",
        targetBar: 18,
        text: "The swell here was beautiful — exactly what I asked for. The dynamic arc up to E5 is now sounding intentional.",
      },
      {
        takeId: recentTake.id,
        authorId: zach.id,
        kind: "WATCH",
        targetType: "SCORE_BAR",
        targetBar: 20,
        text: "Ending still rushes a touch. Try landing on the E quarter — count 'and-1' instead of 'and.'",
      },
      {
        takeId: recentTake.id,
        authorId: zach.id,
        kind: "TRY_THIS",
        targetType: "TIMELINE",
        targetTimeSec: 34,
        text: "Try the final cadence with the soft pedal — see if it lifts.",
      },
    ],
  });

  await db.take.create({
    data: {
      studentId: zach.id,
      coachId: zach.id,
      pieceTitle: "Hanon № 4",
      bars: "bar 12",
      takeNumber: 2,
      durationSec: 32,
      selfRating: 3,
      selfNote: `${DEMO_TAG} bar 12 still tripping me up`,
      status: "REPLIED",
      reviewedAt: new Date(today.getTime() - 86400_000),
      createdAt: new Date(today.getTime() - 2 * 86400_000),
    },
  });

  await db.take.create({
    data: {
      studentId: zach.id,
      coachId: zach.id,
      pieceTitle: "River Flows in You",
      takeNumber: 1,
      durationSec: 41,
      selfRating: 3,
      selfNote: `${DEMO_TAG} first attempt`,
      status: "REPLIED",
      reviewedAt: new Date(today.getTime() - 4 * 86400_000),
      createdAt: new Date(today.getTime() - 5 * 86400_000),
    },
  });

  console.log("Seeded Zach demo data:");
  console.log("  · profile: age 32, voice");
  console.log("  · streak: 14 / 22 days");
  console.log("  · past lesson with note + AI summary + 2 reads");
  console.log("  · today's lesson @ 3:00 PM");
  console.log("  · 3 weekly assignments");
  console.log("  · 3 takes (1 with 3 annotations)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
