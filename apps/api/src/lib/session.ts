import type { PrismaClient } from "@sunbird/db";

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_REFRESH_THRESHOLD_MS = SESSION_MAX_AGE_MS / 2; // 15 days

export function generateSessionId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSession(db: PrismaClient, userId: string) {
  const id = generateSessionId();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  const session = await db.session.create({
    data: { id, userId, expiresAt },
  });

  return { session, cookie: serializeSessionCookie(id, expiresAt) };
}

export async function validateSession(db: PrismaClient, sessionId: string) {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) return null;

  // Expired
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }

  // Sliding expiry: refresh if past 50% of lifetime
  const timeSinceCreation = Date.now() - (session.expiresAt.getTime() - SESSION_MAX_AGE_MS);
  if (timeSinceCreation > SESSION_REFRESH_THRESHOLD_MS) {
    const newExpiry = new Date(Date.now() + SESSION_MAX_AGE_MS);
    await db.session.update({
      where: { id: sessionId },
      data: { expiresAt: newExpiry },
    });
    session.expiresAt = newExpiry;
  }

  return { user: session.user, session };
}

export async function invalidateSession(db: PrismaClient, sessionId: string) {
  await db.session.delete({ where: { id: sessionId } }).catch(() => {});
}

export function serializeSessionCookie(sessionId: string, expiresAt: Date): string {
  const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  const parts = [
    `session=${sessionId}`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Path=/`,
    `Max-Age=${maxAge}`,
  ];
  if (typeof globalThis !== "undefined" && "location" in globalThis) {
    // production check would go here
  }
  return parts.join("; ");
}

export function clearSessionCookie(): string {
  return "session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
}

export function parseSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)session=([^;]+)/);
  return match ? match[1] : null;
}
