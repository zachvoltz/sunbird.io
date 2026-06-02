import { Hono } from "hono";

export const clientErrorsRoutes = new Hono();

const MAX_BODY_BYTES = 16 * 1024; // 16 KB — plenty for a stack + context.

// POST /api/client-errors — ingest a client-side error report (from the React
// ErrorBoundary + global handlers). We log it to the Worker so it shows up in
// `wrangler tail` / Cloudflare logs. Unauthenticated (errors happen pre-login
// too) but size-capped so it can't be used to flood logs.
//
// Sentry hook: if you later set a SENTRY_DSN, forward `report` to Sentry's
// "store" endpoint via fetch here (or move capture to the client SDK) — the
// client contract (reportError → this route) stays the same.
clientErrorsRoutes.post("/", async (c) => {
  const raw = await c.req.text().catch(() => "");
  if (!raw || raw.length > MAX_BODY_BYTES) {
    // Acknowledge regardless — reporting should never surface as a client error.
    return c.body(null, 204);
  }

  let report: any;
  try {
    report = JSON.parse(raw);
  } catch {
    return c.body(null, 204);
  }

  console.error("[client-error]", JSON.stringify({
    name: report?.name,
    message: report?.message,
    source: report?.source,
    url: report?.url,
    info: report?.info,
    stack: report?.stack,
    userAgent: report?.userAgent,
    ts: report?.ts,
  }));

  return c.body(null, 204);
});
