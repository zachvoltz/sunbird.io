import { createMiddleware } from "hono/factory";
import type { Role } from "@sunbird/shared";
import { getDb } from "../lib/db";
import { validateSession, parseSessionCookie } from "../lib/session";

type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  role: string;
};

type AuthEnv = {
  Variables: {
    user: AuthUser | null;
    sessionId: string | null;
  };
};

/**
 * Parses the session cookie, validates it, and attaches user to context.
 * Does NOT reject unauthenticated requests — that's requireAuth's job.
 */
export const sessionMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const cookieHeader = c.req.header("Cookie");
  const sessionId = parseSessionCookie(cookieHeader);

  if (!sessionId) {
    c.set("user", null);
    c.set("sessionId", null);
    return next();
  }

  const db = getDb();
  const result = await validateSession(db, sessionId);

  if (!result) {
    c.set("user", null);
    c.set("sessionId", null);
    return next();
  }

  c.set("user", result.user);
  c.set("sessionId", sessionId);
  return next();
});

/**
 * Rejects with 401 if no valid session.
 */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }
  return next();
});

/**
 * Rejects with 403 if user's role is not in the allowed list.
 * Must be used after requireAuth.
 */
export function requireRole(...roles: Role[]) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const user = c.get("user");
    if (!user || !roles.includes(user.role as Role)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    return next();
  });
}
