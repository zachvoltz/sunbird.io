// Upcoming-lesson reminders. Driven by the Worker cron (see worker.ts) but
// written as a pure function over (db, email, now) so it's unit-testable
// without the scheduler. Two windows — 24h and 1h before a lesson — each
// guarded by an idempotency flag on the Booking so an overlapping cron tick
// never double-sends.

const HOUR_MS = 60 * 60 * 1000;

type EmailLike = {
  sendLessonReminder(to: string, name: string, lessonType: string, dateTime: string, whenLabel: string): Promise<unknown>;
};

function formatDateTime(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "America/Chicago",
  });
}

// Notify both sides of one upcoming booking: an inbox message to the student
// (senderId = coach) and to the coach (senderId = student), plus an email each.
async function remindOne(db: any, email: EmailLike, booking: any, whenLabel: string) {
  const lessonType = booking.category?.title ?? "Lesson";
  const when = formatDateTime(new Date(booking.startsAt));
  const content = `⏰ Reminder: ${lessonType} ${whenLabel} — ${when}`;

  // In-app: one message per direction. senderId determines who DOESN'T see it,
  // so the coach-as-sender row lands in the student's inbox and vice-versa.
  const rows: { bookingId: string; senderId: string; content: string }[] = [];
  if (booking.coachId) rows.push({ bookingId: booking.id, senderId: booking.coachId, content });
  if (booking.userId) rows.push({ bookingId: booking.id, senderId: booking.userId, content });
  for (const data of rows) {
    await db.sessionMessage.create({ data }).catch((err: unknown) => console.error("reminder message failed:", err));
  }

  // Email both parties (best-effort).
  for (const person of [booking.user, booking.coach]) {
    if (person?.email) {
      email.sendLessonReminder(person.email, person.name, lessonType, when, whenLabel).catch(console.error);
    }
  }
}

const bookingInclude = {
  category: { select: { title: true } },
  user: { select: { email: true, name: true } },
  coach: { select: { email: true, name: true } },
};

/**
 * Send any due 24h / 1h lesson reminders. Idempotent: each booking is flagged
 * once per window, so re-running (e.g. overlapping cron ticks) is a no-op.
 */
export async function processLessonReminders(db: any, email: EmailLike, now: Date): Promise<{ sent24h: number; sent1h: number }> {
  // 1h window: starts within the next hour, not yet 1h-reminded.
  const due1h = await db.booking.findMany({
    where: {
      status: "CONFIRMED",
      remindedAt1h: null,
      startsAt: { gt: now, lte: new Date(now.getTime() + HOUR_MS) },
    },
    include: bookingInclude,
  });
  for (const b of due1h) {
    await remindOne(db, email, b, "in 1 hour");
    await db.booking.update({ where: { id: b.id }, data: { remindedAt1h: now } });
  }

  // 24h window: starts between 1h and 24h out, not yet 24h-reminded. The lower
  // bound (now+1h) keeps this from firing on lessons already inside the 1h window.
  const due24h = await db.booking.findMany({
    where: {
      status: "CONFIRMED",
      remindedAt24h: null,
      startsAt: { gt: new Date(now.getTime() + HOUR_MS), lte: new Date(now.getTime() + 24 * HOUR_MS) },
    },
    include: bookingInclude,
  });
  for (const b of due24h) {
    await remindOne(db, email, b, "in 24 hours");
    await db.booking.update({ where: { id: b.id }, data: { remindedAt24h: now } });
  }

  return { sent24h: due24h.length, sent1h: due1h.length };
}
