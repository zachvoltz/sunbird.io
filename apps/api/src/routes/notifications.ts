// Notification settings + Web Push subscription management for the caller.
// Mounted under /api/me alongside meRoutes. Pairs with the dispatch logic in
// services/notifications.service.ts and the ConversationRoom DO.
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { getDb } from "../lib/db";
import { updateNotificationPreferenceSchema, pushSubscriptionSchema } from "@sunbird/shared";
import { ensureNotificationPref, serializeNotificationPref } from "../services/notifications.service";

export const notificationRoutes = new Hono();

// GET /api/me/notification-preferences — current settings (created lazily).
notificationRoutes.get("/notification-preferences", requireAuth, async (c) => {
  const user = c.get("user")!;
  const pref = await ensureNotificationPref(getDb(), user.id);
  return c.json({ data: serializeNotificationPref(pref) });
});

// PATCH /api/me/notification-preferences — toggle channels / quiet hours / phone.
// Changing the phone clears phoneVerified (re-verification is a fast-follow).
notificationRoutes.patch("/notification-preferences", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json().catch(() => null);
  const parsed = updateNotificationPreferenceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, 400);
  }
  const db = getDb();
  await ensureNotificationPref(db, user.id);

  const data: Record<string, unknown> = { ...parsed.data };
  if ("phone" in parsed.data) data.phoneVerified = false;

  const pref = await db.notificationPreference.update({ where: { userId: user.id }, data });
  return c.json({ data: serializeNotificationPref(pref) });
});

// GET /api/me/push/vapid-public-key — the public VAPID key the browser needs to
// subscribe. Empty string when push isn't configured (the UI hides the toggle).
notificationRoutes.get("/push/vapid-public-key", requireAuth, async (c) => {
  return c.json({ data: { key: (c.env as any)?.VAPID_PUBLIC_KEY ?? "" } });
});

// POST /api/me/push/subscriptions — register a browser Web Push subscription.
// Upsert by endpoint so re-subscribing the same browser is idempotent.
notificationRoutes.post("/push/subscriptions", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json().catch(() => null);
  const parsed = pushSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid subscription" }, 400);
  }
  const db = getDb();
  const { endpoint, keys } = parsed.data;
  await db.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth },
    create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });
  return c.json({ data: { ok: true } }, 201);
});

// DELETE /api/me/push/subscriptions — remove a subscription by endpoint
// (browser unsubscribed or push toggled off).
notificationRoutes.delete("/push/subscriptions", requireAuth, async (c) => {
  const user = c.get("user")!;
  const body = await c.req.json().catch(() => null);
  const endpoint = body?.endpoint;
  if (typeof endpoint !== "string") return c.json({ error: "endpoint required" }, 400);
  await getDb().pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return c.json({ data: { ok: true } });
});
