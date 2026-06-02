// Background refresh of Square OAuth access tokens. Square access tokens expire
// (~30 days); without a refresh, a connected coach's payments would silently
// break once the token lapses. This is driven by the Worker cron (see worker.ts)
// and is idempotent/safe to run as often as the cron fires — it only touches
// coaches whose token is near expiry, and once refreshed their expiry jumps
// ~30 days out, so they fall out of the window until next cycle.
//
// Pure + dependency-injected (the refresh call is injectable) so it unit-tests
// without hitting Square, mirroring lib/reminders.ts.

import { refreshSquareToken, type SquareTokenResult } from "./payment-provider/square";
import type { PaymentEnv } from "./payment-provider/types";

type RefreshFn = (env: PaymentEnv, refreshToken: string) => Promise<SquareTokenResult>;

// Refresh this many ms before expiry, so a missed cron run (or a few) can't
// strand a coach with a dead token.
const REFRESH_BUFFER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function processSquareTokenRefresh(
  db: any,
  env: PaymentEnv,
  now: Date,
  deps: { refresh?: RefreshFn } = {},
): Promise<{ refreshed: number; failed: number }> {
  // Can't refresh without the platform OAuth credentials configured.
  if (!env.SQUARE_APPLICATION_ID || !env.SQUARE_APPLICATION_SECRET) {
    return { refreshed: 0, failed: 0 };
  }
  const refresh = deps.refresh ?? refreshSquareToken;
  const threshold = new Date(now.getTime() + REFRESH_BUFFER_MS);

  const coaches = await db.user.findMany({
    where: {
      paymentProvider: "SQUARE",
      squareConnected: true,
      squareRefreshToken: { not: null },
      squareTokenExpiresAt: { not: null, lte: threshold },
    },
    select: { id: true, squareRefreshToken: true },
  });

  let refreshed = 0;
  let failed = 0;
  for (const coach of coaches) {
    try {
      const t = await refresh(env, coach.squareRefreshToken as string);
      await db.user.update({
        where: { id: coach.id },
        data: {
          squareAccessToken: t.accessToken,
          // Square may or may not rotate the refresh token; keep the old one if
          // the response omits it.
          squareRefreshToken: t.refreshToken || coach.squareRefreshToken,
          squareTokenExpiresAt: t.expiresAt ? new Date(t.expiresAt) : null,
        },
      });
      refreshed++;
    } catch (err) {
      // A revoked/invalid token will keep failing; log and move on rather than
      // letting one coach block the rest. (Coach re-connects via OAuth to fix.)
      console.error(`[cron] Square token refresh failed for coach ${coach.id}:`, err);
      failed++;
    }
  }
  return { refreshed, failed };
}
