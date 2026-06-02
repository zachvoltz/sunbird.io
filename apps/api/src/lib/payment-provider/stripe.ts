// Stripe adapter — wraps the existing hosted-Checkout flows behind the
// PaymentProvider interface. Behavior-preserving: this is the same logic that
// previously lived inline in bookings.ts / packages.ts, just relocated so the
// route layer can dispatch by provider.
import { makeStripe } from "../stripe";
import type {
  PaymentProvider,
  PaymentEnv,
  BookingCheckoutArgs,
  SubscriptionCheckoutArgs,
  PackageCheckoutArgs,
  CheckoutResult,
} from "./types";

export const stripeProvider: PaymentProvider = {
  id: "STRIPE",

  // One-time lesson — a destination charge to the coach's connected account.
  // Correlated to the booking via Checkout Session metadata (the webhook reads
  // metadata.bookingId), so no externalRef is returned.
  async createBookingCheckout(env: PaymentEnv, args: BookingCheckoutArgs): Promise<CheckoutResult> {
    const key = env.STRIPE_SECRET_KEY;
    if (!key) return { url: null };
    const stripe = makeStripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: args.studentEmail,
      line_items: [
        { price_data: { currency: "usd", unit_amount: args.amountCents, product_data: { name: args.lessonTitle } }, quantity: 1 },
      ],
      payment_intent_data: { transfer_data: { destination: args.connection.stripeAccountId! } },
      metadata: { bookingId: args.bookingId },
      success_url: `${args.origin}/my-bookings?payment=success`,
      cancel_url: `${args.origin}/my-bookings?payment=canceled`,
    });
    return { url: session.url };
  },

  // Recurring schedule — a Subscription billing the session rate at the
  // schedule's cadence (weekly / every-2-weeks), routed to the coach's account.
  async createSubscriptionCheckout(env: PaymentEnv, args: SubscriptionCheckoutArgs): Promise<CheckoutResult> {
    const key = env.STRIPE_SECRET_KEY;
    if (!key) return { url: null };
    const stripe = makeStripe(key);
    const intervalCount = args.frequency === "BIWEEKLY" ? 2 : 1;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: args.studentEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: args.amountCents,
            recurring: { interval: "week", interval_count: intervalCount },
            product_data: { name: args.lessonTitle },
          },
          quantity: 1,
        },
      ],
      subscription_data: { transfer_data: { destination: args.connection.stripeAccountId! } },
      metadata: { scheduleId: args.scheduleId },
      success_url: `${args.origin}/my-bookings?payment=success`,
      cancel_url: `${args.origin}/my-bookings?payment=canceled`,
    });
    return { url: session.url };
  },

  // Monthly package — a Subscription billed monthly. The Subscription row is
  // created by the webhook (checkout.session.completed) from the metadata here.
  async createPackageCheckout(env: PaymentEnv, args: PackageCheckoutArgs): Promise<CheckoutResult> {
    const key = env.STRIPE_SECRET_KEY;
    if (!key) return { url: null };
    const stripe = makeStripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: args.studentEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: args.amountCents,
            recurring: { interval: "month" },
            product_data: { name: `${args.planName} — ${args.lessonsPerMonth} lessons/mo` },
          },
          quantity: 1,
        },
      ],
      subscription_data: { transfer_data: { destination: args.connection.stripeAccountId! } },
      metadata: { planId: args.planId, studentId: args.studentId, coachId: args.coachId },
      success_url: `${args.origin}/my-bookings?package=success`,
      cancel_url: `${args.origin}/my-bookings?package=canceled`,
    });
    return { url: session.url };
  },

  async cancelSubscription(env: PaymentEnv, args: { externalSubscriptionId: string }): Promise<void> {
    const key = env.STRIPE_SECRET_KEY;
    if (!key) return;
    await makeStripe(key).subscriptions.cancel(args.externalSubscriptionId);
  },
};
