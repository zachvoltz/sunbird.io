import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { sessionMiddleware } from "./middleware/auth";
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
import { categoryRoutes } from "./routes/categories";
import { skillTreeRoutes } from "./routes/skill-trees";
import { initDb, initDbD1 } from "./lib/db";

type Bindings = {
  ENVIRONMENT: string;
  SESSION_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  CF_CALLS_APP_ID: string;
  CF_CALLS_APP_TOKEN: string;
  DATABASE_URL: string;
  DB: D1Database;
  ASSETS: { fetch: typeof fetch };
  // R2 bucket for library audio + future media. Optional: the upload
  // endpoint returns 501 with a helpful message when this isn't bound.
  MEDIA_BUCKET?: R2Bucket;
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

app.route("/api/auth", authRoutes);
app.route("/api/me", meRoutes);
app.route("/api/availability", availabilityRoutes);
app.route("/api/bookings", bookingRoutes);
app.route("/api/coaches", coachRoutes);
app.route("/api/coach-settings", coachSettingsRoutes);
app.route("/api/coach-busy", coachBusyRoutes);
app.route("/api/paths", pathRoutes);
app.route("/api/search", searchRoutes);
app.route("/api/library", libraryRoutes);
app.route("/api/categories", categoryRoutes);
app.route("/api/skill-trees", skillTreeRoutes);

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
