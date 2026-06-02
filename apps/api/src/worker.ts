// Cloudflare Worker entry point. Wraps the Hono app (default-exported from
// index.ts, kept that way so local dev + tests use it directly) and adds the
// `scheduled` handler for cron-driven lesson reminders.
import app from "./index";
import { initDbD1, getDb } from "./lib/db";
import { createEmailService } from "./services/email.service";
import { processLessonReminders } from "./lib/reminders";
import { processSquareTokenRefresh } from "./lib/square-token-refresh";

type Env = {
  DB: D1Database;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  SQUARE_ENVIRONMENT?: string;
  SQUARE_APPLICATION_ID?: string;
  SQUARE_APPLICATION_SECRET?: string;
  SQUARE_WEBHOOK_SIGNATURE_KEY?: string;
};

export default {
  fetch: app.fetch,

  // Runs on the cron schedule in wrangler.toml ("*/15 * * * *"). Each tick:
  //  - sends any due 24h / 1h lesson reminders (idempotent via booking flags);
  //  - refreshes Square OAuth tokens nearing expiry (no-op unless a Square
  //    coach is within the refresh window). The two jobs are independent —
  //    one failing must not skip the other.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const now = new Date();
        initDbD1(env.DB);

        try {
          const email = createEmailService(env.RESEND_API_KEY ?? "", env.EMAIL_FROM ?? "noreply@sunbird.io");
          const result = await processLessonReminders(getDb(), email, now);
          console.log(`[cron] lesson reminders sent: ${result.sent1h} (1h), ${result.sent24h} (24h)`);
        } catch (err) {
          console.error("[cron] lesson reminder run failed:", err);
        }

        try {
          const result = await processSquareTokenRefresh(
            getDb(),
            {
              SQUARE_ENVIRONMENT: env.SQUARE_ENVIRONMENT,
              SQUARE_APPLICATION_ID: env.SQUARE_APPLICATION_ID,
              SQUARE_APPLICATION_SECRET: env.SQUARE_APPLICATION_SECRET,
              SQUARE_WEBHOOK_SIGNATURE_KEY: env.SQUARE_WEBHOOK_SIGNATURE_KEY,
            },
            now,
          );
          if (result.refreshed || result.failed) {
            console.log(`[cron] Square token refresh: ${result.refreshed} ok, ${result.failed} failed`);
          }
        } catch (err) {
          console.error("[cron] Square token refresh run failed:", err);
        }
      })(),
    );
  },
};
