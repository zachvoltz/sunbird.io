import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createTestDb } from "../helpers";
import { getDb, resetDb } from "../../lib/db";
import { processLessonReminders } from "../../lib/reminders";

let cleanup: () => void;
let coachId: string;
let studentId: string;
let categoryId: string;

// Records sendLessonReminder calls so we can assert on emails without Resend.
function recorderEmail() {
  const calls: { to: string; whenLabel: string }[] = [];
  return {
    calls,
    async sendLessonReminder(to: string, _name: string, _lt: string, _dt: string, whenLabel: string) {
      calls.push({ to, whenLabel });
    },
  };
}

async function booking(startsAt: Date) {
  const db = getDb();
  const b = await db.booking.create({
    data: {
      userId: studentId,
      coachId,
      categoryId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
      status: "CONFIRMED",
    },
  });
  return b.id;
}

beforeAll(async () => {
  resetDb();
  const testDb = createTestDb();
  cleanup = testDb.cleanup;
  const db = getDb();
  const coach = await db.user.create({ data: { name: "Coach", email: "c@example.com", role: "COACH", roleChosen: true } });
  coachId = coach.id;
  const student = await db.user.create({ data: { name: "Student", email: "s@example.com", roleChosen: true } });
  studentId = student.id;
  const cat = await db.category.create({ data: { slug: "guitar", title: "Guitar", description: "x" } });
  categoryId = cat.id;
});

afterAll(() => {
  resetDb();
  cleanup();
});

describe("processLessonReminders", () => {
  it("sends 1h and 24h reminders to both sides, is idempotent, and skips far-out lessons", async () => {
    const db = getDb();
    const now = new Date();
    const in30m = await booking(new Date(now.getTime() + 30 * 60 * 1000));
    const in12h = await booking(new Date(now.getTime() + 12 * 60 * 60 * 1000));
    await booking(new Date(now.getTime() + 48 * 60 * 60 * 1000)); // too far → nothing

    const email = recorderEmail();
    const res = await processLessonReminders(db, email, now);
    expect(res.sent1h).toBe(1);
    expect(res.sent24h).toBe(1);

    // Two reminded bookings × two inbox rows (student + coach) = 4 messages.
    const msgCount = await db.sessionMessage.count();
    expect(msgCount).toBe(4);
    // Two reminded bookings × two recipients = 4 emails.
    expect(email.calls.length).toBe(4);

    // Flags set on the right bookings.
    const b30 = await db.booking.findUnique({ where: { id: in30m }, select: { remindedAt1h: true, remindedAt24h: true } });
    expect(b30?.remindedAt1h).not.toBeNull();
    expect(b30?.remindedAt24h).toBeNull();
    const b12 = await db.booking.findUnique({ where: { id: in12h }, select: { remindedAt1h: true, remindedAt24h: true } });
    expect(b12?.remindedAt24h).not.toBeNull();
    expect(b12?.remindedAt1h).toBeNull();

    // Second run with the same `now` is a no-op (idempotent).
    const again = await processLessonReminders(db, recorderEmail(), now);
    expect(again.sent1h).toBe(0);
    expect(again.sent24h).toBe(0);
    expect(await db.sessionMessage.count()).toBe(4);
  });
});
