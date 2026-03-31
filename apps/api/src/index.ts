import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { sessionMiddleware } from "./middleware/auth";
import { authRoutes } from "./routes/auth";
import { meRoutes } from "./routes/me";
import { lessonRoutes } from "./routes/lessons";
import { availabilityRoutes } from "./routes/availability";
import { bookingRoutes } from "./routes/bookings";
import { coachRoutes } from "./routes/coaches";
import { initDb, initDbD1 } from "./lib/db";

type Bindings = {
  ENVIRONMENT: string;
  SESSION_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  DATABASE_URL: string;
  DB: D1Database;
  // SONGS_BUCKET: R2Bucket;
};

const app = new Hono<{ Bindings: Bindings }>();

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: err.message }, 500);
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

app.get("/", (c) => {
  return c.json({ name: "Sunbird API", status: "ok" });
});

app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.route("/api/auth", authRoutes);
app.route("/api/me", meRoutes);
app.route("/api/lessons", lessonRoutes);
app.route("/api/availability", availabilityRoutes);
app.route("/api/bookings", bookingRoutes);
app.route("/api/coaches", coachRoutes);

// Route modules will be mounted here as they're built:
// app.route("/api/community", communityRoutes);
// app.route("/api/contact", contactRoutes);
// app.route("/api/webhooks", webhookRoutes);

export default app;
