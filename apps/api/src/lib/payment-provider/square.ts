// Square adapter + a fetch-based REST client for the Cloudflare Workers runtime.
//
// We deliberately do NOT add the `square` npm SDK (the §5b spike flagged it as
// the biggest unknown on Workers); a thin `fetch` wrapper is the same approach
// lib/stripe.ts takes with Stripe's fetch HTTP client and has no runtime risk.
//
// Card collection mirrors the Stripe hosted model:
//   • one-time   → Checkout / Payment Links API (hosted page, redirect)
//   • recurring  → Subscriptions API billed by INVOICE (no card-on-file, no Web
//                  Payments SDK): Square emails/serves a hosted invoice per cycle
//                  and we redirect the student to the first invoice's public_url.
//
// OAuth helpers + webhook verification are exported for the route layer to use
// (onboarding/status stay route-side; see routes/coach-payments.ts).
import type {
  PaymentProvider,
  PaymentEnv,
  BookingCheckoutArgs,
  SubscriptionCheckoutArgs,
  PackageCheckoutArgs,
  CheckoutResult,
} from "./types";

const SQUARE_VERSION = "2025-01-23";

export function squareBaseUrl(env: PaymentEnv): string {
  return env.SQUARE_ENVIRONMENT === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";
}

// OAuth scopes we need: take payments + manage orders, subscriptions, customers,
// invoices, and catalog (subscription plans live in the catalog).
const OAUTH_SCOPES = [
  "MERCHANT_PROFILE_READ",
  "PAYMENTS_WRITE",
  "ORDERS_WRITE",
  "ORDERS_READ",
  "SUBSCRIPTIONS_WRITE",
  "CUSTOMERS_WRITE",
  "CUSTOMERS_READ",
  "INVOICES_WRITE",
  "INVOICES_READ",
  "ITEMS_WRITE",
  "ITEMS_READ",
];

// Authed JSON request against the Square API. Throws with the response body on a
// non-2xx so callers can surface Square's error detail.
async function squareFetch(
  env: PaymentEnv,
  accessToken: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<any> {
  const res = await fetch(`${squareBaseUrl(env)}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = json?.errors?.[0]?.detail ?? res.statusText;
    throw new Error(`Square ${path} failed (${res.status}): ${detail}`);
  }
  return json;
}

// Idempotency keys must be ≤192 chars and stable across retries of the same
// logical operation. We derive them from our own row ids + a purpose tag.
function idemKey(purpose: string, id: string): string {
  return `${purpose}_${id}`.slice(0, 192);
}

// ─── OAuth (used by routes/coach-payments.ts) ───

export function buildSquareAuthorizeUrl(env: PaymentEnv, state: string): string {
  const appId = env.SQUARE_APPLICATION_ID ?? "";
  const scope = OAUTH_SCOPES.join("+");
  return `${squareBaseUrl(env)}/oauth2/authorize?client_id=${encodeURIComponent(appId)}&scope=${scope}&session=false&state=${encodeURIComponent(state)}`;
}

export type SquareTokenResult = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string | null; // ISO timestamp
  merchantId: string;
};

async function oauthToken(env: PaymentEnv, body: Record<string, unknown>): Promise<SquareTokenResult> {
  const res = await fetch(`${squareBaseUrl(env)}/oauth2/token`, {
    method: "POST",
    headers: { "Square-Version": SQUARE_VERSION, "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.SQUARE_APPLICATION_ID,
      client_secret: env.SQUARE_APPLICATION_SECRET,
      ...body,
    }),
  });
  const json: any = await res.json();
  if (!res.ok) {
    throw new Error(`Square OAuth failed (${res.status}): ${json?.errors?.[0]?.detail ?? res.statusText}`);
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_at ?? null,
    merchantId: json.merchant_id,
  };
}

export function exchangeSquareCode(env: PaymentEnv, code: string): Promise<SquareTokenResult> {
  return oauthToken(env, { grant_type: "authorization_code", code });
}

export function refreshSquareToken(env: PaymentEnv, refreshToken: string): Promise<SquareTokenResult> {
  return oauthToken(env, { grant_type: "refresh_token", refresh_token: refreshToken });
}

// The merchant's main (first) location id — needed for every order/subscription.
export async function getSquareMainLocationId(env: PaymentEnv, accessToken: string): Promise<string | null> {
  const json = await squareFetch(env, accessToken, "/v2/locations");
  return json.locations?.[0]?.id ?? null;
}

// ─── Webhook signature verification ───
//
// Square signs with HMAC-SHA256 over (notificationUrl + rawBody), base64-encoded,
// delivered in the `x-square-hmacsha256-signature` header. Uses Web Crypto so it
// runs identically on Workers and Node (vitest).
export async function verifySquareWebhook(
  signatureKey: string,
  notificationUrl: string,
  rawBody: string,
  signature: string | null | undefined,
): Promise<boolean> {
  if (!signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(signatureKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(notificationUrl + rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  // Constant-time-ish compare (length check first, then char-by-char OR).
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

// ─── Subscription plumbing (recurring + packages) ───

// Square subscription cadence enum. We support the three cadences the app offers.
function squareCadence(frequency: string): string {
  if (frequency === "BIWEEKLY") return "EVERY_TWO_WEEKS";
  if (frequency === "MONTHLY") return "MONTHLY";
  return "WEEKLY";
}

async function findOrCreateCustomer(
  env: PaymentEnv,
  accessToken: string,
  email: string,
  name?: string | null,
): Promise<string> {
  const search = await squareFetch(env, accessToken, "/v2/customers/search", {
    method: "POST",
    body: { query: { filter: { email_address: { exact: email } } }, limit: 1 },
  });
  const found = search.customers?.[0]?.id;
  if (found) return found;
  const created = await squareFetch(env, accessToken, "/v2/customers", {
    method: "POST",
    body: { idempotency_key: idemKey("cust", email), email_address: email, given_name: name ?? undefined },
  });
  return created.customer.id;
}

// Create a catalog subscription plan + variation for this price/cadence and
// return the variation id (subscriptions reference a plan *variation*). We mint a
// fresh plan per checkout; that's simplest given the Workers runtime has no place
// to cache catalog ids, at the cost of some catalog clutter (acceptable, and
// noted for a later "reuse by (coach,cadence,price)" optimization).
async function createPlanVariation(
  env: PaymentEnv,
  accessToken: string,
  args: { name: string; cadence: string; amountCents: number; refId: string },
): Promise<string> {
  const res = await squareFetch(env, accessToken, "/v2/catalog/batch-upsert", {
    method: "POST",
    body: {
      idempotency_key: idemKey("plan", args.refId),
      batches: [
        {
          objects: [
            {
              type: "SUBSCRIPTION_PLAN",
              id: "#plan",
              subscription_plan_data: {
                name: args.name,
                subscription_plan_variations: [
                  {
                    type: "SUBSCRIPTION_PLAN_VARIATION",
                    id: "#variation",
                    subscription_plan_variation_data: {
                      name: args.name,
                      phases: [
                        {
                          cadence: args.cadence,
                          pricing: { type: "STATIC", price_money: { amount: args.amountCents, currency: "USD" } },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  });
  const mapping = (res.id_mappings ?? []).find((m: any) => m.client_object_id === "#variation");
  if (!mapping?.object_id) throw new Error("Square catalog upsert returned no variation id");
  return mapping.object_id;
}

// Best-effort lookup of the hosted invoice URL for a just-created subscription.
// Invoices are generated asynchronously, so this may return null (the caller then
// redirects to ?payment=pending; the invoice.payment_made webhook does the rest).
async function firstInvoiceUrl(
  env: PaymentEnv,
  accessToken: string,
  args: { locationId: string; customerId: string; subscriptionId: string },
): Promise<string | null> {
  try {
    const res = await squareFetch(env, accessToken, "/v2/invoices/search", {
      method: "POST",
      body: { query: { filter: { location_ids: [args.locationId], customer_ids: [args.customerId] } }, limit: 10 },
    });
    const inv = (res.invoices ?? []).find((i: any) => i.subscription_id === args.subscriptionId);
    return inv?.public_url ?? null;
  } catch {
    return null;
  }
}

// Shared by recurring schedules + monthly packages: create the customer, plan,
// and an invoice-billed subscription; return its id + the first invoice URL.
async function createInvoiceSubscription(
  env: PaymentEnv,
  args: {
    connection: BookingCheckoutArgs["connection"];
    amountCents: number;
    name: string;
    cadence: string;
    refId: string;
    studentEmail: string;
    studentName?: string | null;
  },
): Promise<{ subscriptionId: string; invoiceUrl: string | null }> {
  const accessToken = args.connection.squareAccessToken!;
  const locationId = args.connection.squareLocationId!;
  const customerId = await findOrCreateCustomer(env, accessToken, args.studentEmail, args.studentName);
  const planVariationId = await createPlanVariation(env, accessToken, {
    name: args.name,
    cadence: args.cadence,
    amountCents: args.amountCents,
    refId: args.refId,
  });
  const sub = await squareFetch(env, accessToken, "/v2/subscriptions", {
    method: "POST",
    body: {
      idempotency_key: idemKey("sub", args.refId),
      location_id: locationId,
      plan_variation_id: planVariationId,
      customer_id: customerId,
      // No card_id → Square bills the customer by invoice (hosted invoice page).
    },
  });
  const subscriptionId = sub.subscription.id as string;
  const invoiceUrl = await firstInvoiceUrl(env, accessToken, { locationId, customerId, subscriptionId });
  return { subscriptionId, invoiceUrl };
}

function squareConfigured(env: PaymentEnv, args: { connection: BookingCheckoutArgs["connection"] }): boolean {
  return !!(args.connection.squareAccessToken && args.connection.squareLocationId);
}

// ─── The adapter ───

export const squareProvider: PaymentProvider = {
  id: "SQUARE",

  // One-time lesson — hosted Payment Link. We tag the order with
  // reference_id = bookingId and persist the returned order_id (externalRef) so
  // the payment.updated webhook can match the payment back to the booking.
  async createBookingCheckout(env: PaymentEnv, args: BookingCheckoutArgs): Promise<CheckoutResult> {
    if (!squareConfigured(env, args)) return { url: null };
    const res = await squareFetch(env, args.connection.squareAccessToken!, "/v2/online-checkout/payment-links", {
      method: "POST",
      body: {
        idempotency_key: idemKey("pl", args.bookingId),
        order: {
          location_id: args.connection.squareLocationId,
          reference_id: args.bookingId,
          line_items: [
            { name: args.lessonTitle, quantity: "1", base_price_money: { amount: args.amountCents, currency: "USD" } },
          ],
        },
        checkout_options: { redirect_url: `${args.origin}/my-bookings?payment=success` },
      },
    });
    const link = res.payment_link;
    return { url: link?.url ?? null, externalRef: link?.order_id };
  },

  // Recurring schedule — invoice-billed subscription. externalRef is the Square
  // subscription id; the route stores it on the schedule and the
  // invoice.payment_made webhook activates the schedule + creates its bookings.
  async createSubscriptionCheckout(env: PaymentEnv, args: SubscriptionCheckoutArgs): Promise<CheckoutResult> {
    if (!squareConfigured(env, args)) return { url: null };
    const { subscriptionId, invoiceUrl } = await createInvoiceSubscription(env, {
      connection: args.connection,
      amountCents: args.amountCents,
      name: args.lessonTitle,
      cadence: squareCadence(args.frequency),
      refId: args.scheduleId,
      studentEmail: args.studentEmail,
      studentName: args.studentName,
    });
    return { url: invoiceUrl ?? `${args.origin}/my-bookings?payment=pending`, externalRef: subscriptionId };
  },

  // Monthly package — invoice-billed monthly subscription. The route creates a
  // PENDING Subscription row carrying externalRef; the webhook activates it.
  async createPackageCheckout(env: PaymentEnv, args: PackageCheckoutArgs): Promise<CheckoutResult> {
    if (!squareConfigured(env, args)) return { url: null };
    const { subscriptionId, invoiceUrl } = await createInvoiceSubscription(env, {
      connection: args.connection,
      amountCents: args.amountCents,
      name: `${args.planName} — ${args.lessonsPerMonth} lessons/mo`,
      cadence: "MONTHLY",
      refId: args.planId + "_" + args.studentId,
      studentEmail: args.studentEmail,
      studentName: args.studentName,
    });
    return { url: invoiceUrl ?? `${args.origin}/my-bookings?package=pending`, externalRef: subscriptionId };
  },

  async cancelSubscription(
    env: PaymentEnv,
    args: { connection: BookingCheckoutArgs["connection"]; externalSubscriptionId: string },
  ): Promise<void> {
    const token = args.connection.squareAccessToken;
    if (!token) return;
    await squareFetch(env, token, `/v2/subscriptions/${args.externalSubscriptionId}/cancel`, { method: "POST" });
  },
};
