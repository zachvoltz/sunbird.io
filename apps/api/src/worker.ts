// Cloudflare Worker entry point. Wraps the Hono app (default-exported from
// index.ts, kept that way so local dev + tests use it directly) and adds the
// `scheduled` handler for cron-driven lesson reminders.
import app from "./index";
import { initDbD1, getDb } from "./lib/db";
import { createEmailService } from "./services/email.service";
import { processLessonReminders } from "./lib/reminders";

type Env = {
  DB: D1Database;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
};

export default {
  fetch: app.fetch,

  // Runs on the cron schedule in wrangler.toml ("*/15 * * * *"). Sends any due
  // 24h / 1h lesson reminders; idempotent via the booking reminder flags.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        try {
          initDbD1(env.DB);
          const email = createEmailService(env.RESEND_API_KEY ?? "", env.EMAIL_FROM ?? "noreply@sunbird.io");
          const result = await processLessonReminders(getDb(), email, new Date());
          console.log(`[cron] lesson reminders sent: ${result.sent1h} (1h), ${result.sent24h} (24h)`);
        } catch (err) {
          console.error("[cron] lesson reminder run failed:", err);
        }
      })(),
    );
  },
};
