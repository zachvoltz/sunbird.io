// Two-way Google Calendar sync — OAuth flow + sync endpoints.
//
// The connect/cb flow is separate from the login Google OAuth: it
// asks for the calendar.events scope with offline access so we can
// keep a refresh token. Tokens are stored in OAuthAccount under
// provider = "google_calendar" (distinct from "google" used by login).

import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";
import {
  GOOGLE_CALENDAR_PROVIDER,
  buildAuthUrl,
  createEvent,
  deleteEvent,
  ensureAccessToken,
  exchangeCodeForTokens,
  listEvents,
} from "../lib/google-calendar";

export const googleCalendarRoutes = new Hono();

function getEnv(c: any, key: string): string {
  const v = (c.env as any)?.[key] ?? (typeof process !== "undefined" ? process.env?.[key] : undefined);
  if (!v) throw new Error(`Missing env: ${key}`);
  return String(v);
}

// State cookie helper. We use a short-lived random state to bind the
// callback to the user who initiated the connect.
function cookieOpts(secure: boolean): string {
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure ? "; Secure" : ""}`;
}

function buildRedirectUri(c: any): string {
  const origin = new URL(c.req.url).origin;
  return `${origin}/api/calendar/google/cb`;
}

// GET /api/calendar/google/status — has the coach connected? + a
// quick summary of how many shadow events are cached.
googleCalendarRoutes.get(
  "/status",
  requireAuth,
  requireRole("COACH", "ADMIN"),
  async (c) => {
    const user = c.get("user")!;
    const db = getDb();
    const acct = await db.oAuthAccount.findFirst({
      where: { userId: user.id, provider: GOOGLE_CALENDAR_PROVIDER },
      select: { accessTokenExpiresAt: true },
    });
    const shadowCount = await db.googleEvent.count({
      where: { coachId: user.id, bookingId: null, busyId: null },
    });
    let lastSyncedAt: string | null = null;
    if (acct) {
      const latest = await db.googleEvent.findFirst({
        where: { coachId: user.id },
        orderBy: { syncedAt: "desc" },
        select: { syncedAt: true },
      });
      lastSyncedAt = latest?.syncedAt.toISOString() ?? null;
    }
    return c.json({
      data: {
        connected: !!acct,
        shadowCount,
        lastSyncedAt,
      },
    });
  },
);

// GET /api/calendar/google/connect — kick off OAuth, redirect to Google.
googleCalendarRoutes.get(
  "/connect",
  requireAuth,
  requireRole("COACH", "ADMIN"),
  async (c) => {
    const user = c.get("user")!;
    let clientId: string;
    try {
      clientId = getEnv(c, "GOOGLE_CLIENT_ID");
    } catch {
      return c.json({ error: "Google OAuth isn't configured (missing GOOGLE_CLIENT_ID)" }, 501);
    }
    const redirectUri = buildRedirectUri(c);
    const state = `${user.id}:${crypto.randomUUID()}`;
    const url = buildAuthUrl({ clientId, redirectUri, state });
    const secure = redirectUri.startsWith("https://");
    c.header("Set-Cookie", `gcal_state=${state}; ${cookieOpts(secure)}`);
    return c.redirect(url);
  },
);

// GET /api/calendar/google/cb — token exchange; redirects back to
// the calendar page so the UI re-renders connected.
googleCalendarRoutes.get(
  "/cb",
  requireAuth,
  requireRole("COACH", "ADMIN"),
  async (c) => {
    const user = c.get("user")!;
    const code = c.req.query("code");
    const state = c.req.query("state");
    const error = c.req.query("error");
    const cookieHeader = c.req.header("cookie") ?? "";
    const storedState = cookieHeader.match(/gcal_state=([^;]+)/)?.[1];

    if (error) {
      return c.redirect(`/coach/calendar?gcal=denied`);
    }
    if (!code || !state || state !== storedState || !state.startsWith(`${user.id}:`)) {
      return c.redirect(`/coach/calendar?gcal=invalid`);
    }

    let clientId: string, clientSecret: string;
    try {
      clientId = getEnv(c, "GOOGLE_CLIENT_ID");
      clientSecret = getEnv(c, "GOOGLE_CLIENT_SECRET");
    } catch {
      return c.redirect(`/coach/calendar?gcal=not-configured`);
    }
    const redirectUri = buildRedirectUri(c);

    let tokens;
    try {
      tokens = await exchangeCodeForTokens({ clientId, clientSecret, redirectUri, code });
    } catch (err) {
      console.error("Google Calendar token exchange failed:", err);
      return c.redirect(`/coach/calendar?gcal=token-failed`);
    }

    const db = getDb();
    const existing = await db.oAuthAccount.findFirst({
      where: { userId: user.id, provider: GOOGLE_CALENDAR_PROVIDER },
    });
    if (existing) {
      await db.oAuthAccount.update({
        where: { id: existing.id },
        data: {
          accessToken: tokens.accessToken,
          // Keep the existing refresh token if Google didn't return a
          // new one — happens when the user has previously consented.
          refreshToken: tokens.refreshToken ?? existing.refreshToken,
          accessTokenExpiresAt: tokens.expiresAt,
          scopes: tokens.scope,
        },
      });
    } else {
      await db.oAuthAccount.create({
        data: {
          provider: GOOGLE_CALENDAR_PROVIDER,
          // providerId is required + unique with provider. Stuffing
          // the user id keeps it unique without an extra Google call.
          providerId: user.id,
          userId: user.id,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          accessTokenExpiresAt: tokens.expiresAt,
          scopes: tokens.scope,
        },
      });
    }

    const secure = redirectUri.startsWith("https://");
    c.header("Set-Cookie", `gcal_state=; Path=/; Max-Age=0${secure ? "; Secure" : ""}`);
    return c.redirect(`/coach/calendar?gcal=connected`);
  },
);

// POST /api/calendar/google/disconnect — remove the token row.
// Leaves outbound mirrors in place but they become orphaned (won't
// be cleaned up unless the coach re-connects + re-syncs).
googleCalendarRoutes.post(
  "/disconnect",
  requireAuth,
  requireRole("COACH", "ADMIN"),
  async (c) => {
    const user = c.get("user")!;
    const db = getDb();
    await db.oAuthAccount.deleteMany({
      where: { userId: user.id, provider: GOOGLE_CALENDAR_PROVIDER },
    });
    // Drop inbound shadows so the Sunbird calendar isn't haunted by
    // events that may no longer reflect reality.
    await db.googleEvent.deleteMany({
      where: { coachId: user.id, bookingId: null, busyId: null },
    });
    return c.json({ data: { ok: true } });
  },
);

// POST /api/calendar/google/sync — pull events from the next 90 days
// (and 7 days back) and upsert inbound shadows. Mirrors created by
// outbound writes are skipped so we don't double-render them.
googleCalendarRoutes.post(
  "/sync",
  requireAuth,
  requireRole("COACH", "ADMIN"),
  async (c) => {
    const user = c.get("user")!;
    const db = getDb();
    const acct = await db.oAuthAccount.findFirst({
      where: { userId: user.id, provider: GOOGLE_CALENDAR_PROVIDER },
    });
    if (!acct) return c.json({ error: "Not connected" }, 400);

    let clientId: string, clientSecret: string;
    try {
      clientId = getEnv(c, "GOOGLE_CLIENT_ID");
      clientSecret = getEnv(c, "GOOGLE_CLIENT_SECRET");
    } catch {
      return c.json({ error: "Google OAuth not configured" }, 501);
    }

    let accessToken: string;
    try {
      accessToken = await ensureAccessToken({
        account: acct,
        clientId,
        clientSecret,
        onRefresh: async (next) => {
          await db.oAuthAccount.update({
            where: { id: acct.id },
            data: {
              accessToken: next.accessToken,
              accessTokenExpiresAt: next.expiresAt,
            },
          });
        },
      });
    } catch (err: any) {
      console.error("Google token refresh failed:", err);
      return c.json({ error: "Couldn't refresh Google token" }, 502);
    }

    const now = new Date();
    const timeMin = new Date(now.getTime() - 7 * 86_400_000);
    const timeMax = new Date(now.getTime() + 90 * 86_400_000);

    let events;
    try {
      events = await listEvents({ accessToken, timeMin, timeMax });
    } catch (err: any) {
      console.error("Google Calendar list failed:", err);
      return c.json({ error: err?.message ?? "List failed" }, 502);
    }

    // Identify which Google event IDs are our own outbound mirrors so
    // we don't ingest them as inbound shadows.
    const mirrorRows = await db.googleEvent.findMany({
      where: { coachId: user.id, OR: [{ bookingId: { not: null } }, { busyId: { not: null } }] },
      select: { googleEventId: true },
    });
    const mirrorIds = new Set(mirrorRows.map((r: any) => r.googleEventId));

    let upserts = 0;
    for (const e of events) {
      if (mirrorIds.has(e.id)) continue;
      if (e.status === "cancelled") continue;
      const start = e.start?.dateTime ? new Date(e.start.dateTime) : (e.start?.date ? new Date(e.start.date) : null);
      const end   = e.end?.dateTime   ? new Date(e.end.dateTime)   : (e.end?.date   ? new Date(e.end.date)   : null);
      if (!start || !end) continue;
      await db.googleEvent.upsert({
        where: { coachId_googleEventId: { coachId: user.id, googleEventId: e.id } },
        update: {
          startsAt: start,
          endsAt: end,
          summary: e.summary ?? null,
          syncedAt: now,
        },
        create: {
          coachId: user.id,
          googleEventId: e.id,
          googleCalendarId: "primary",
          startsAt: start,
          endsAt: end,
          summary: e.summary ?? null,
        },
      });
      upserts++;
    }

    // Sweep out shadows that no longer exist on Google (deleted or
    // moved outside the window). Only touch inbound rows.
    const seen = new Set(events.map((e) => e.id));
    const stale = await db.googleEvent.findMany({
      where: { coachId: user.id, bookingId: null, busyId: null },
      select: { id: true, googleEventId: true },
    });
    const toDrop = stale.filter((s: any) => !seen.has(s.googleEventId)).map((s: any) => s.id);
    if (toDrop.length > 0) {
      await db.googleEvent.deleteMany({ where: { id: { in: toDrop } } });
    }

    return c.json({ data: { synced: upserts, removed: toDrop.length } });
  },
);

// GET /api/calendar/google/events?from=&to= — return shadow events
// for the coach so the calendar UI can render them as busy blocks.
googleCalendarRoutes.get(
  "/events",
  requireAuth,
  requireRole("COACH", "ADMIN"),
  async (c) => {
    const user = c.get("user")!;
    const from = c.req.query("from");
    const to = c.req.query("to");
    const now = new Date();
    const start = from ? new Date(from) : new Date(now.getTime() - 7 * 86_400_000);
    const end   = to   ? new Date(to)   : new Date(now.getTime() + 90 * 86_400_000);
    const db = getDb();
    const rows = await db.googleEvent.findMany({
      where: {
        coachId: user.id,
        bookingId: null,
        busyId: null,
        startsAt: { lt: end },
        endsAt: { gt: start },
      },
      orderBy: { startsAt: "asc" },
    });
    return c.json({
      data: rows.map((r: any) => ({
        id: r.id,
        googleEventId: r.googleEventId,
        summary: r.summary ?? null,
        startsAt: r.startsAt.toISOString(),
        endsAt: r.endsAt.toISOString(),
      })),
    });
  },
);

// ── Helpers used by booking + busy hooks ─────────────────

// Best-effort: create a Google event mirroring a Sunbird resource.
// Returns the inserted GoogleEvent row id, or null if the coach isn't
// connected (no-op) or Google rejected the call (logged).
export async function pushEventMirror(
  c: any,
  args: {
    coachId: string;
    bookingId?: string;
    busyId?: string;
    startsAt: Date;
    endsAt: Date;
    summary: string;
    description?: string;
  },
): Promise<string | null> {
  const db = getDb();
  const acct = await db.oAuthAccount.findFirst({
    where: { userId: args.coachId, provider: GOOGLE_CALENDAR_PROVIDER },
  });
  if (!acct) return null;

  let clientId: string, clientSecret: string;
  try {
    clientId = getEnv(c, "GOOGLE_CLIENT_ID");
    clientSecret = getEnv(c, "GOOGLE_CLIENT_SECRET");
  } catch {
    return null;
  }

  try {
    const accessToken = await ensureAccessToken({
      account: acct,
      clientId,
      clientSecret,
      onRefresh: async (next) => {
        await db.oAuthAccount.update({
          where: { id: acct.id },
          data: { accessToken: next.accessToken, accessTokenExpiresAt: next.expiresAt },
        });
      },
    });
    const ev = await createEvent({
      accessToken,
      summary: args.summary,
      description: args.description,
      startsAt: args.startsAt,
      endsAt: args.endsAt,
    });
    const row = await db.googleEvent.create({
      data: {
        coachId: args.coachId,
        googleEventId: ev.id,
        googleCalendarId: "primary",
        bookingId: args.bookingId ?? null,
        busyId: args.busyId ?? null,
        startsAt: args.startsAt,
        endsAt: args.endsAt,
        summary: args.summary,
      },
    });
    return row.id;
  } catch (err) {
    console.error("Google Calendar push failed:", err);
    return null;
  }
}

// Best-effort: delete the Google event mirroring this booking/busy row.
export async function deleteEventMirror(
  c: any,
  args: { coachId: string; bookingId?: string; busyId?: string },
): Promise<void> {
  if (!args.bookingId && !args.busyId) return;
  const db = getDb();
  const mirror = await db.googleEvent.findFirst({
    where: {
      coachId: args.coachId,
      bookingId: args.bookingId ?? undefined,
      busyId: args.busyId ?? undefined,
    },
  });
  if (!mirror) return;

  const acct = await db.oAuthAccount.findFirst({
    where: { userId: args.coachId, provider: GOOGLE_CALENDAR_PROVIDER },
  });
  if (acct) {
    let clientId: string, clientSecret: string;
    try {
      clientId = getEnv(c, "GOOGLE_CLIENT_ID");
      clientSecret = getEnv(c, "GOOGLE_CLIENT_SECRET");
    } catch {
      // fall through to local cleanup
      await db.googleEvent.delete({ where: { id: mirror.id } });
      return;
    }
    try {
      const accessToken = await ensureAccessToken({
        account: acct,
        clientId,
        clientSecret,
        onRefresh: async (next) => {
          await db.oAuthAccount.update({
            where: { id: acct.id },
            data: { accessToken: next.accessToken, accessTokenExpiresAt: next.expiresAt },
          });
        },
      });
      await deleteEvent({ accessToken, eventId: mirror.googleEventId });
    } catch (err) {
      console.error("Google Calendar delete failed:", err);
    }
  }
  await db.googleEvent.delete({ where: { id: mirror.id } });
}
