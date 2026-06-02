// Client error reporting. Centralizes how the app surfaces runtime errors so a
// real provider (e.g. Sentry) can be dropped in here later without touching call
// sites. For now it POSTs a compact payload to /api/client-errors, which logs to
// the Worker (visible via `wrangler tail` / Cloudflare logs).
//
// To swap in Sentry: install @sentry/react, init it in installGlobalErrorHandlers,
// and call Sentry.captureException inside reportError (keep the backend POST or
// drop it). Nothing else in the app needs to change.

type ErrorContext = {
  // Where it came from: a React boundary, a global handler, or a manual call.
  source?: "boundary" | "window.onerror" | "unhandledrejection" | "manual";
  // Optional extra info (component stack, a tag, etc.).
  info?: string;
};

const ENDPOINT = "/api/client-errors";
const MAX_REPORTS_PER_SESSION = 15;
const DEDUPE_WINDOW_MS = 10_000;

let sent = 0;
const recent = new Map<string, number>();

function truncate(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  return s.length > max ? s.slice(0, max) : s;
}

export function reportError(error: unknown, context: ErrorContext = {}): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const key = `${err.name}:${err.message}`;

    // Throttle floods and skip duplicates seen very recently.
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < DEDUPE_WINDOW_MS) return;
    recent.set(key, now);
    if (sent >= MAX_REPORTS_PER_SESSION) return;
    sent++;

    const payload = {
      name: truncate(err.name, 200),
      message: truncate(err.message, 2000),
      stack: truncate(err.stack, 8000),
      source: context.source ?? "manual",
      info: truncate(context.info, 4000),
      url: truncate(typeof location !== "undefined" ? location.href : undefined, 2000),
      userAgent: truncate(typeof navigator !== "undefined" ? navigator.userAgent : undefined, 500),
      ts: new Date().toISOString(),
    };

    // Fire-and-forget; keepalive lets it survive a navigation/unload.
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
      keepalive: true,
    }).catch(() => { /* never let reporting throw */ });
  } catch {
    /* reporting must never break the app */
  }
}

let installed = false;

// Catch errors that don't flow through a React boundary: uncaught exceptions and
// unhandled promise rejections. Safe to call once at app startup.
export function installGlobalErrorHandlers(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e) => {
    reportError(e.error ?? new Error(e.message), { source: "window.onerror" });
  });
  window.addEventListener("unhandledrejection", (e) => {
    reportError(e.reason ?? new Error("Unhandled promise rejection"), {
      source: "unhandledrejection",
    });
  });
}
