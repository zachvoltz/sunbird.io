import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { sessionMiddleware, requireAuth } from "./middleware/auth";
import { createEmailService } from "./services/email.service";
import { getEnv } from "./lib/env";
import { authRoutes } from "./routes/auth";
import { meRoutes } from "./routes/me";
import { availabilityRoutes } from "./routes/availability";
import { bookingRoutes } from "./routes/bookings";
import { coachRoutes } from "./routes/coaches";
import { coachSettingsRoutes } from "./routes/coach-settings";
import { coachBusyRoutes } from "./routes/coach-busy";
import { pathRoutes } from "./routes/paths";
import { searchRoutes } from "./routes/search";
import { libraryRoutes } from "./routes/library";
import { coachPaymentsRoutes } from "./routes/coach-payments";
import { coachPlansRoutes } from "./routes/coach-plans";
import { packagesRoutes } from "./routes/packages";
import { googleCalendarRoutes } from "./routes/google-calendar";
import { categoryRoutes } from "./routes/categories";
import { skillTreeRoutes } from "./routes/skill-trees";
import { paymentsRoutes } from "./routes/payments";
import { clientErrorsRoutes } from "./routes/client-errors";
import { conversationRoutes } from "./routes/conversations";
import { notificationRoutes } from "./routes/notifications";
import { initDb, initDbD1 } from "./lib/db";

type Bindings = {
  ENVIRONMENT: string;
  SESSION_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  // Cloudflare Email Sending binding (replaces Resend). Present only in the
  // Workers runtime; undefined in local Node dev, where sends are skipped.
  EMAIL?: SendEmail;
  EMAIL_FROM: string;
  CF_CALLS_APP_ID: string;
  CF_CALLS_APP_TOKEN: string;
  DATABASE_URL: string;
  DB: D1Database;
  ASSETS: { fetch: typeof fetch };
  // R2 bucket for library audio + future media. Optional: the upload
  // endpoint returns 501 with a helpful message when this isn't bound.
  MEDIA_BUCKET?: R2Bucket;
  // Stripe secret key (sk_test_… or sk_live_…). Optional: payment
  // endpoints 501 until this is configured via `wrangler secret put`.
  STRIPE_SECRET_KEY?: string;
  // Stripe webhook signing secret (whsec_…). Required to verify
  // /api/webhooks/stripe; the endpoint 400s without it.
  STRIPE_WEBHOOK_SECRET?: string;
  // Square (alternative processor, §5b). All optional: Square endpoints 501
  // until configured. SQUARE_ENVIRONMENT is "sandbox" (default) or "production".
  SQUARE_ENVIRONMENT?: string;
  SQUARE_APPLICATION_ID?: string;
  SQUARE_APPLICATION_SECRET?: string;
  SQUARE_WEBHOOK_SIGNATURE_KEY?: string;
  // Messaging: Durable Object namespace for live conversation rooms, Web Push
  // VAPID keys (public is safe to expose; private is a secret), and the public
  // app origin used to build links in notifications.
  CONVERSATION_ROOM?: DurableObjectNamespace;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  PUBLIC_APP_URL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.onError((err, c) => {
  console.error("Unhandled error:", err.message, err.stack);
  return c.json({ error: err.message, stack: err.stack }, 500);
});

app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  }),
);
app.use("/api/*", async (c, next) => {
  if (c.env?.DB) {
    // Cloudflare Workers — use D1 adapter
    initDbD1(c.env.DB);
  } else {
    // Local Node.js dev — use SQLite via DATABASE_URL
    const dbUrl = (c.env?.DATABASE_URL as string) || (typeof process !== "undefined" ? process.env.DATABASE_URL : undefined);
    initDb(dbUrl);
  }
  return next();
});
app.use("/api/*", sessionMiddleware);

app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Diagnostic: fire a test email and return the send result inline (id on
// success, the error reason on failure). Auth-gated so it can't be used to spam;
// defaults to sending to the caller's own address. Optional ?to= override.
//   curl -X POST https://…/api/health/email -H "Cookie: session=…"
//   curl -X POST "https://…/api/health/email?to=me@example.com" -H "Cookie: …"
app.post("/api/health/email", requireAuth, async (c) => {
  const user = c.get("user")!;
  const to = c.req.query("to") || user.email;
  const email = createEmailService(c.env?.EMAIL, getEnv(c, "EMAIL_FROM") || "noreply@usesunbird.com");
  try {
    const result = await email.sendTest(to);
    const ok = !result.skipped && !result.error;
    return c.json({ data: { to, ok, ...result } }, ok ? 200 : 400);
  } catch (err: any) {
    return c.json({ error: err?.message ?? "Send failed", to }, 502);
  }
});

app.route("/api/auth", authRoutes);
app.route("/api/me", meRoutes);
app.route("/api/me", notificationRoutes);
app.route("/api/conversations", conversationRoutes);
app.route("/api/availability", availabilityRoutes);
app.route("/api/bookings", bookingRoutes);
app.route("/api/coaches", coachRoutes);
app.route("/api/coach-settings", coachSettingsRoutes);
app.route("/api/coach-busy", coachBusyRoutes);
app.route("/api/paths", pathRoutes);
app.route("/api/search", searchRoutes);
app.route("/api/library", libraryRoutes);
app.route("/api/coach-payments", coachPaymentsRoutes);
app.route("/api/coach-plans", coachPlansRoutes);
app.route("/api/packages", packagesRoutes);
app.route("/api/calendar/google", googleCalendarRoutes);
app.route("/api/categories", categoryRoutes);
app.route("/api/skill-trees", skillTreeRoutes);
app.route("/api/webhooks", paymentsRoutes);
app.route("/api/client-errors", clientErrorsRoutes);

// Serve frontend assets for all non-API routes (SPA fallback)
app.get("*", async (c) => {
  try {
    if (c.env?.ASSETS) {
      return c.env.ASSETS.fetch(c.req.raw);
    }
  } catch (err: any) {
    console.error("Asset fetch error:", err.message);
  }
  return c.notFound();
});

export default app;
