import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

type Bindings = {
  ENVIRONMENT: string;
  // DB: D1Database;
  // SONGS_BUCKET: R2Bucket;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  }),
);

app.get("/", (c) => {
  return c.json({ name: "Ellisa Sun API", status: "ok" });
});

app.get("/api/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Route modules will be mounted here as they're built:
// app.route("/api/auth", authRoutes);
// app.route("/api/lessons", lessonRoutes);
// app.route("/api/bookings", bookingRoutes);
// app.route("/api/community", communityRoutes);
// app.route("/api/contact", contactRoutes);
// app.route("/api/admin", adminRoutes);
// app.route("/api/webhooks", webhookRoutes);

export default app;
