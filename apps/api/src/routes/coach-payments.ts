import { Hono } from "hono";
import { getDb } from "../lib/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { makeStripe } from "../lib/stripe";

export const coachPaymentsRoutes = new Hono();

// Shape returned to the frontend. Mirrors the booleans on the User row
// plus the stripeAccountId. The UI uses these to decide which
// onboarding stage to render (entry vs verifying vs connected).
type StatusPayload = {
  hasStripeAccount: boolean;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  stripeAccountId: string | null;
};

function serializeStatus(u: any): StatusPayload {
  return {
    hasStripeAccount: !!u.stripeAccountId,
    detailsSubmitted: !!u.stripeDetailsSubmitted,
    chargesEnabled: !!u.stripeChargesEnabled,
    payoutsEnabled: !!u.stripePayoutsEnabled,
    stripeAccountId: u.stripeAccountId ?? null,
  };
}

// Fetch the account from Stripe and sync the three flags onto our row
// so the frontend can read state cheaply between syncs.
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
    });
    return updated;
  } catch (err) {
    console.error("Stripe account refresh failed:", err);
    return null;
  }
}

// GET /api/coach-payments/status?refresh=1
// Returns the calling coach's current Stripe Connect status. When
// `refresh=1` is set, we hit Stripe first so the response reflects any
// state the coach changed on Stripe.com (e.g. just finished onboarding).
coachPaymentsRoutes.get(
  "/status",
  requireAuth,
  requireRole("COACH", "ADMIN"),
  async (c) => {
    const user = c.get("user")!;
    const db = getDb();
    let row: any = await db.user.findUnique({
      where: { id: user.id },
      select: {
        stripeAccountId: true,
        stripeChargesEnabled: true,
        stripePayoutsEnabled: true,
        stripeDetailsSubmitted: true,
      },
    });
    if (!row) return c.json({ error: "User not found" }, 404);

    if (c.req.query("refresh") === "1" && row.stripeAccountId) {
      const fresh = await refreshFromStripe(c, db, user.id, row.stripeAccountId);
      if (fresh) row = fresh;
    }

    return c.json({ data: serializeStatus(row) });
  },
);

// POST /api/coach-payments/onboarding-link
// Creates an Express account if the coach doesn't have one yet, then
// generates a fresh Account Link URL the frontend redirects to. The
// link is short-lived — generate one per click. Body is empty.
coachPaymentsRoutes.post(
  "/onboarding-link",
  requireAuth,
  requireRole("COACH", "ADMIN"),
  async (c) => {
    const user = c.get("user")!;
    const key = (c.env as any)?.STRIPE_SECRET_KEY as string | undefined;
    if (!key) {
      return c.json({
        error: "Stripe isn't configured yet — set STRIPE_SECRET_KEY.",
      }, 501);
    }
    const db = getDb();
    const stripe = makeStripe(key);
    const origin = new URL(c.req.url).origin;

    let row: any = await db.user.findUnique({
      where: { id: user.id },
      select: { stripeAccountId: true, email: true },
    });
    if (!row) return c.json({ error: "User not found" }, 404);

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
        await db.user.update({
          where: { id: user.id },
          data: { stripeAccountId: accountId },
        });
      } catch (err: any) {
        console.error("Stripe accounts.create failed:", err);
        return c.json({
          error: err?.message ?? "Couldn't create Stripe account",
        }, 502);
      }
    }

    try {
      const link = await stripe.accountLinks.create({
        account: accountId!,
        // If the link expires before the coach finishes, send them
        // back to the entry page so the frontend can re-request a
        // fresh link.
        refresh_url: `${origin}/coach/payments?stage=entry`,
        // After completing (or aborting) onboarding on Stripe's
        // hosted UI, land on /coach/payments?stage=verifying so the
        // frontend can poll status until charges/payouts unlock.
        return_url: `${origin}/coach/payments?stage=verifying`,
        type: "account_onboarding",
      });
      return c.json({ data: { url: link.url, expiresAt: link.expires_at } });
    } catch (err: any) {
      console.error("Stripe accountLinks.create failed:", err);
      return c.json({
        error: err?.message ?? "Couldn't generate onboarding link",
      }, 502);
    }
  },
);

// POST /api/coach-payments/dashboard-link
// Creates a single-use login link into the Express dashboard so the
// coach can manage their account (update bank, view payouts, etc.).
// Only valid once the account is detail-submitted.
coachPaymentsRoutes.post(
  "/dashboard-link",
  requireAuth,
  requireRole("COACH", "ADMIN"),
  async (c) => {
    const user = c.get("user")!;
    const key = (c.env as any)?.STRIPE_SECRET_KEY as string | undefined;
    if (!key) {
      return c.json({
        error: "Stripe isn't configured yet — set STRIPE_SECRET_KEY.",
      }, 501);
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
      return c.json({
        error: err?.message ?? "Couldn't generate dashboard link",
      }, 502);
    }
  },
);
