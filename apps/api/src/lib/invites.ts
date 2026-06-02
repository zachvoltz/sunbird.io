import type { getDb } from "./db";

type Db = ReturnType<typeof getDb>;

// When a user logs in / signs up, claim any PENDING coach invites addressed to
// their email: flip them to ACCEPTED and link them to this user. This is the
// gray→active transition in the coach's sidebar. Idempotent and safe to call on
// every auth event — it no-ops when there are no pending invites.
export async function claimStudentInvites(
  db: Db,
  user: { id: string; email: string },
): Promise<void> {
  const email = user.email.toLowerCase();
  await db.studentInvite.updateMany({
    where: { email, status: "PENDING" },
    data: { status: "ACCEPTED", studentId: user.id, acceptedAt: new Date() },
  });
}
