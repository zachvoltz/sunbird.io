// Provider-neutral payment abstraction (§5b).
//
// Each coach picks a processor (User.paymentProvider = "STRIPE" | "SQUARE").
// Routes dispatch through getProvider() (see ./index) instead of calling
// `stripe.*` directly, so adding a processor is a new adapter — not a rewrite of
// the booking / package flows. Onboarding + account status stay in the route
// layer (Stripe Connect account-links and Square OAuth are structurally
// different); this interface covers only the checkout / cancel operations that
// bookings.ts and packages.ts share.

export type ProviderId = "STRIPE" | "SQUARE";

// The resolved payment env (Cloudflare bindings or process.env). All optional —
// an unset provider simply yields a null checkout URL and callers fall back to a
// free booking, exactly like the original Stripe-only `501` guards.
export type PaymentEnv = {
  STRIPE_SECRET_KEY?: string;
  SQUARE_ENVIRONMENT?: string; // "sandbox" (default) | "production"
  SQUARE_APPLICATION_ID?: string;
  SQUARE_APPLICATION_SECRET?: string;
  SQUARE_WEBHOOK_SIGNATURE_KEY?: string;
};

// The coach-side connection a checkout routes funds to — exactly the columns the
// adapters need off the coach's User row.
export type CoachConnection = {
  provider: ProviderId;
  // Stripe Connect
  stripeAccountId: string | null;
  // Square OAuth
  squareAccessToken: string | null;
  squareLocationId: string | null;
};

export type CheckoutResult = {
  // Redirect target for the student. null ONLY when the provider is unconfigured
  // (missing keys) — callers then fall back to a free booking. For a Square
  // subscription whose first invoice isn't materialized yet this points at the
  // `?payment=pending` page.
  url: string | null;
  // Provider-side id to persist for webhook correlation. Set by Square (known
  // synchronously: order id for one-time, subscription id for recurring);
  // omitted by Stripe, which correlates via Checkout Session metadata.
  externalRef?: string;
};

export type BookingCheckoutArgs = {
  connection: CoachConnection;
  amountCents: number;
  lessonTitle: string;
  bookingId: string;
  studentEmail: string;
  studentName?: string | null;
  origin: string;
};

export type SubscriptionCheckoutArgs = {
  connection: CoachConnection;
  amountCents: number;
  lessonTitle: string;
  scheduleId: string;
  frequency: string; // "WEEKLY" | "BIWEEKLY"
  studentEmail: string;
  studentName?: string | null;
  origin: string;
};

export type PackageCheckoutArgs = {
  connection: CoachConnection;
  amountCents: number;
  planName: string;
  lessonsPerMonth: number;
  planId: string;
  studentId: string;
  coachId: string;
  studentEmail: string;
  studentName?: string | null;
  origin: string;
};

export interface PaymentProvider {
  readonly id: ProviderId;
  // One-time lesson payment (hosted Checkout / Payment Link).
  createBookingCheckout(env: PaymentEnv, args: BookingCheckoutArgs): Promise<CheckoutResult>;
  // Recurring lesson schedule (subscription billed at the schedule's cadence).
  createSubscriptionCheckout(env: PaymentEnv, args: SubscriptionCheckoutArgs): Promise<CheckoutResult>;
  // Monthly package (subscription billed monthly).
  createPackageCheckout(env: PaymentEnv, args: PackageCheckoutArgs): Promise<CheckoutResult>;
  // Cancel the backing subscription (best-effort; the webhook also reconciles).
  // `connection` carries the coach credentials Square needs (Stripe uses the
  // platform key in `env` and ignores it).
  cancelSubscription(
    env: PaymentEnv,
    args: { connection: CoachConnection; externalSubscriptionId: string },
  ): Promise<void>;
}
