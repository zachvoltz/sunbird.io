import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { makeStripe } from "../lib/stripe";
import { readPaymentEnv } from "../lib/payment-provider";
import {
  buildSquareAuthorizeUrl,
  exchangeSquareCode,
  getSquareMainLocationId,
} from "../lib/payment-provider/square";

export const coachPaymentsRoutes = new Hono();

// Provider-neutral connection status the frontend reads to pick the onboarding
// stage. Field names are generic (account/charges/payouts) so the same UI drives
// both Stripe Connect and Square — `provider` tells it which copy to show.
type StatusPayload = {
  provider: "STRIPE" | "SQUARE";
  hasAccount: boolean;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  accountId: string | null;
  sessionPrice: number | null;
};

const coachSelect = {
  paymentProvider: true,
  stripeAccountId: true,
  stripeChargesEnabled: true,
  stripePayoutsEnabled: true,
  stripeDetailsSubmitted: true,
  squareMerchantId: true,
  squareConnected: true,
  sessionPrice: true,
  email: true,
} as const;

function serializeStatus(u: any): StatusPayload {
  if (u.paymentProvider === "SQUARE") {
    // Square has no multi-stage verification — once OAuth completes the merchant
    // can take charges, so all three flags collapse to squareConnected.
    return {
      provider: "SQUARE",
      hasAccount: !!u.squareMerchantId,
      detailsSubmitted: !!u.squareConnected,
      chargesEnabled: !!u.squareConnected,
      payoutsEnabled: !!u.squareConnected,
      accountId: u.squareMerchantId ?? null,
      sessionPrice: u.sessionPrice ?? null,
    };
  }
  return {
    provider: "STRIPE",
    hasAccount: !!u.stripeAccountId,
    detailsSubmitted: !!u.stripeDetailsSubmitted,
    chargesEnabled: !!u.stripeChargesEnabled,
    payoutsEnabled: !!u.stripePayoutsEnabled,
    accountId: u.stripeAccountId ?? null,
    sessionPrice: u.sessionPrice ?? null,
  };
}

// Fetch the account from Stripe and sync the three flags onto our row so the
// frontend can read state cheaply between syncs. (Square needs no equivalent —
// its flags are derived from squareConnected, set at OAuth time.)
async function refreshFromStripe(
  c: any,
  db: any,
  userId: string,
  accountId: string,
) {
  const key = (c.env as any)?.STRIPE_SECRET_KEY as string | undefined;
  if (!key) return null;
  const stripe = makeStripe(key);
  try {
    const acct = await stripe.accounts.retrieve(accountId);
    const updated = await db.user.update({
      where: { id: userId },
      data: {
        stripeChargesEnabled: !!acct.charges_enabled,
        stripePayoutsEnabled: !!acct.payouts_enabled,
        stripeDetailsSubmitted: !!acct.details_submitted,
      },
      select: coachSelect,
    });
    return updated;
  } catch (err) {
    console.error("Stripe account refresh failed:", err);
    return null;
  }
}

// GET /api/coach-payments/status?refresh=1
// Returns the calling coach's current connection status for their chosen
// provider. `refresh=1` re-syncs from Stripe (no-op for Square).
coachPaymentsRoutes.get(
  "/status",
  requireAuth,
  requireRole("COACH", "ADMIN"),
  async (c) => {
    const user = c.get("user")!;
    const db = getDb();
    let row: any = await db.user.findUnique({ where: { id: user.id }, select: coachSelect });
    if (!row) return c.json({ error: "User not found" }, 404);

    if (c.req.query("refresh") === "1" && row.paymentProvider !== "SQUARE" && row.stripeAccountId) {
      const fresh = await refreshFromStripe(c, db, user.id, row.stripeAccountId);
      if (fresh) row = fresh;
    }

    return c.json({ data: serializeStatus(row) });
  },
);

// PATCH /api/coach-payments/provider — set the coach's payment processor.
// Body: { provider: "STRIPE" | "SQUARE" }. Switching is allowed pre-connection;
// the unused provider's columns simply stay dormant.
coachPaymentsRoutes.patch(
  "/provider",
  requireAuth,
  requireRole("COACH", "ADMIN"),
  async (c) => {
    const user = c.get("user")!;
    const body = (await c.req.json().catch(() => null)) as { provider?: unknown } | null;
    const provider = body?.provider;
    if (provider !== "STRIPE" && provider !== "SQUARE") {
      return c.json({ error: "provider must be STRIPE or SQUARE" }, 400);
    }
    const db = getDb();
    await db.user.update({ where: { id: user.id }, data: { paymentProvider: provider } });
    return c.json({ data: { provider } });
  },
);

// POST /api/coach-payments/onboarding-link
// Returns the URL the coach is redirected to in order to connect. For Stripe
// that's a fresh Connect Account Link (creating the Express account on first
// use); for Square it's the OAuth authorize URL.
coachPaymentsRoutes.post(
  "/onboarding-link",
  requireAuth,
  requireRole("COACH", "ADMIN"),
  async (c) => {
    const user = c.get("user")!;
    const db = getDb();
    const row: any = await db.user.findUnique({ where: { id: user.id }, select: coachSelect });
    if (!row) return c.json({ error: "User not found" }, 404);

    // ─── Square: OAuth authorize URL ───
    if (row.paymentProvider === "SQUARE") {
      const env = readPaymentEnv(c);
      if (!env.SQUARE_APPLICATION_ID) {
        return c.json({ error: "Square isn't configured yet — set SQUARE_APPLICATION_ID." }, 501);
      }
      // state = the coach id, verified in the callback to bind the grant.
      const url = buildSquareAuthorizeUrl(env, user.id);
      return c.json({ data: { url } });
    }

    // ─── Stripe: create Express account (first time) + Account Link ───
    const key = (c.env as any)?.STRIPE_SECRET_KEY as string | undefined;
    if (!key) {
      return c.json({ error: "Stripe isn't configured yet — set STRIPE_SECRET_KEY." }, 501);
    }
    const stripe = makeStripe(key);
    const origin = new URL(c.req.url).origin;

    let accountId = row.stripeAccountId as string | null;
    if (!accountId) {
      try {
        const acct = await stripe.accounts.create({
          type: "express",
          email: row.email ?? undefined,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: "individual",
        });
        accountId = acct.id;
        await db.user.update({ where: { id: user.id }, data: { stripeAccountId: accountId } });
      } catch (err: any) {
        console.error("Stripe accounts.create failed:", err);
        return c.json({ error: err?.message ?? "Couldn't create Stripe account" }, 502);
      }
    }

    try {
      const link = await stripe.accountLinks.create({
        account: accountId!,
        refresh_url: `${origin}/coach/payments?stage=entry`,
        return_url: `${origin}/coach/payments?stage=verifying`,
        type: "account_onboarding",
      });
      return c.json({ data: { url: link.url, expiresAt: link.expires_at } });
    } catch (err: any) {
      console.error("Stripe accountLinks.create failed:", err);
      return c.json({ error: err?.message ?? "Couldn't generate onboarding link" }, 502);
    }
  },
);

// GET /api/coach-payments/square/callback?code=...&state=...
// Square OAuth redirect target. Exchanges the auth code for tokens, stores the
// merchant/location + tokens, marks the coach connected, and bounces back into
// the SPA. `state` must equal the session coach id (basic CSRF binding).
coachPaymentsRoutes.get(
  "/square/callback",
  requireAuth,
  requireRole("COACH", "ADMIN"),
  async (c) => {
    const user = c.get("user")!;
    const db = getDb();
    const origin = new URL(c.req.url).origin;
    const code = c.req.query("code");
    const state = c.req.query("state");

    if (c.req.query("error") || !code) {
      return c.redirect(`${origin}/coach/payments?stage=entry&square_error=1`);
    }
    if (state !== user.id) {
      return c.redirect(`${origin}/coach/payments?stage=entry&square_error=state`);
    }

    try {
      const env = readPaymentEnv(c);
      const tokens = await exchangeSquareCode(env, code);
      const locationId = await getSquareMainLocationId(env, tokens.accessToken);
      await db.user.update({
        where: { id: user.id },
        data: {
          paymentProvider: "SQUARE",
          squareMerchantId: tokens.merchantId,
          squareLocationId: locationId,
          squareAccessToken: tokens.accessToken,
          squareRefreshToken: tokens.refreshToken,
          squareTokenExpiresAt: tokens.expiresAt ? new Date(tokens.expiresAt) : null,
          squareConnected: true,
        },
      });
      return c.redirect(`${origin}/coach/payments?stage=connected`);
    } catch (err) {
      console.error("Square OAuth callback failed:", err);
      return c.redirect(`${origin}/coach/payments?stage=entry&square_error=exchange`);
    }
  },
);

// POST /api/coach-payments/dashboard-link
// Stripe-only: a single-use login link into the Express dashboard. Square coaches
// manage their account in their own Square dashboard.
coachPaymentsRoutes.post(
  "/dashboard-link",
  requireAuth,
  requireRole("COACH", "ADMIN"),
  async (c) => {
    const user = c.get("user")!;
    const key = (c.env as any)?.STRIPE_SECRET_KEY as string | undefined;
    if (!key) {
      return c.json({ error: "Stripe isn't configured yet — set STRIPE_SECRET_KEY." }, 501);
    }
    const db = getDb();
    const row: any = await db.user.findUnique({
      where: { id: user.id },
      select: { stripeAccountId: true },
    });
    if (!row?.stripeAccountId) {
      return c.json({ error: "No Stripe account on file" }, 400);
    }
    try {
      const stripe = makeStripe(key);
      const login = await stripe.accounts.createLoginLink(row.stripeAccountId);
      return c.json({ data: { url: login.url } });
    } catch (err: any) {
      console.error("Stripe accounts.createLoginLink failed:", err);
      return c.json({ error: err?.message ?? "Couldn't generate dashboard link" }, 502);
    }
  },
);

// PATCH /api/coach-payments/rate — set the coach's flat per-session price.
// Body: { sessionPrice: number | null } in cents. null/0 makes lessons free.
coachPaymentsRoutes.patch(
  "/rate",
  requireAuth,
  requireRole("COACH", "ADMIN"),
  async (c) => {
    const user = c.get("user")!;
    const body = (await c.req.json().catch(() => null)) as { sessionPrice?: unknown } | null;
    const raw = body?.sessionPrice;
    if (raw !== null && (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw > 1_000_000)) {
      return c.json({ error: "sessionPrice must be a non-negative amount in cents (or null)" }, 400);
    }
    const sessionPrice = raw === null || raw === 0 ? null : Math.round(raw as number);
    const db = getDb();
    await db.user.update({ where: { id: user.id }, data: { sessionPrice } });
    return c.json({ data: { sessionPrice } });
  },
);
