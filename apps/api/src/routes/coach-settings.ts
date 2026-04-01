import { Hono } from "hono";
import { generateState, generateCodeVerifier } from "arctic";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { createZoomClient } from "../lib/oauth";
import { updateCoachSettingsSchema } from "@sunbird/shared";

export const coachSettingsRoutes = new Hono();

// GET /api/coach-settings — get coach settings
coachSettingsRoutes.get("/", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const db = getDb();

  const zoomAccount = await db.oAuthAccount.findFirst({
    where: { userId: user.id, provider: "zoom" },
  });

  return c.json({
    data: {
      sessionAddress: (user as any).sessionAddress ?? null,
      zoomConnected: !!zoomAccount?.accessToken,
    },
  });
});

// PATCH /api/coach-settings — update session address
coachSettingsRoutes.patch("/", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json();
  const parsed = updateCoachSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }

  const db = getDb();
  await db.user.update({
    where: { id: user.id },
    data: { sessionAddress: parsed.data.sessionAddress ?? null },
  });

  return c.json({ data: { ok: true } });
});

// GET /api/coach-settings/zoom/connect — initiate Zoom OAuth
coachSettingsRoutes.get("/zoom/connect", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const clientId = (c.env as any)?.ZOOM_CLIENT_ID || process.env.ZOOM_CLIENT_ID || "";
  const clientSecret = (c.env as any)?.ZOOM_CLIENT_SECRET || process.env.ZOOM_CLIENT_SECRET || "";
  const redirectUri = (c.env as any)?.ZOOM_REDIRECT_URI || process.env.ZOOM_REDIRECT_URI || "";

  const zoom = createZoomClient(clientId, clientSecret, redirectUri);
  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const url = zoom.createAuthorizationURL(state, codeVerifier, ["meeting:write:meeting"]);

  const cookieOpts = "HttpOnly; SameSite=Lax; Path=/; Max-Age=600";
  c.header("Set-Cookie", `zoom_oauth_state=${state}; ${cookieOpts}`);
  c.header("Set-Cookie", `zoom_oauth_verifier=${codeVerifier}; ${cookieOpts}`, { append: true });

  return c.redirect(url.toString());
});

// GET /api/coach-settings/zoom/cb — Zoom OAuth callback
coachSettingsRoutes.get("/zoom/cb", requireAuth, async (c) => {
  const user = c.get("user")!;
  const url = new URL(c.req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookieHeader = c.req.header("Cookie") || "";
  const storedState = cookieHeader.match(/zoom_oauth_state=([^;]+)/)?.[1];
  const storedVerifier = cookieHeader.match(/zoom_oauth_verifier=([^;]+)/)?.[1];

  if (!code || !state || !storedState || !storedVerifier || state !== storedState) {
    return c.redirect("/coach/settings?error=oauth_failed");
  }

  const clientId = (c.env as any)?.ZOOM_CLIENT_ID || process.env.ZOOM_CLIENT_ID || "";
  const clientSecret = (c.env as any)?.ZOOM_CLIENT_SECRET || process.env.ZOOM_CLIENT_SECRET || "";
  const redirectUri = (c.env as any)?.ZOOM_REDIRECT_URI || process.env.ZOOM_REDIRECT_URI || "";

  const zoom = createZoomClient(clientId, clientSecret, redirectUri);

  try {
    const tokens = await zoom.validateAuthorizationCode(code, storedVerifier);
    const accessToken = tokens.accessToken();
    const refreshToken = tokens.hasRefreshToken() ? tokens.refreshToken() : null;
    const expiresAt = tokens.accessTokenExpiresAt();

    // Fetch Zoom user info
    // Fetch Zoom user info — use user's own ID as fallback if API fails
    let zoomProviderId = user.id;
    try {
      const userRes = await fetch("https://api.zoom.us/v2/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (userRes.ok) {
        const zoomUserData = (await userRes.json()) as Record<string, any>;
        zoomProviderId = zoomUserData.id ?? zoomUserData.user_id ?? user.id;
      }
    } catch {}
    zoomProviderId = String(zoomProviderId);

    const db = getDb();
    await db.oAuthAccount.upsert({
      where: {
        provider_providerId: { provider: "zoom", providerId: String(zoomProviderId) },
      },
      update: {
        userId: user.id,
        accessToken,
        refreshToken,
        accessTokenExpiresAt: expiresAt,
        scopes: "meeting:write:meeting",
      },
      create: {
        provider: "zoom",
        providerId: String(zoomProviderId),
        userId: user.id,
        accessToken,
        refreshToken,
        accessTokenExpiresAt: expiresAt,
        scopes: "meeting:write:meeting",
      },
    });

    // Clear OAuth cookies
    const clearOpts = "HttpOnly; SameSite=Lax; Path=/; Max-Age=0";
    c.header("Set-Cookie", `zoom_oauth_state=; ${clearOpts}`);
    c.header("Set-Cookie", `zoom_oauth_verifier=; ${clearOpts}`, { append: true });

    return c.redirect("/coach/settings?zoom=connected");
  } catch (err: any) {
    console.error("Zoom OAuth error:", err);
    const msg = encodeURIComponent(err?.message ?? "unknown");
    return c.redirect(`/coach/settings?error=oauth_failed&detail=${msg}`);
  }
});

// POST /api/coach-settings/zoom/disconnect — remove Zoom connection
coachSettingsRoutes.post("/zoom/disconnect", requireAuth, requireRole("COACH", "ADMIN"), async (c) => {
  const user = c.get("user")!;
  const db = getDb();

  await db.oAuthAccount.deleteMany({
    where: { userId: user.id, provider: "zoom" },
  });

  return c.json({ data: { ok: true } });
});
