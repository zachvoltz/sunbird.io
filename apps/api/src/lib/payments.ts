// Shared payment helpers. Kept separate from the Stripe client factory so the
// "does this booking need paying for" decision is testable without Stripe.

export type CoachPayInfo = {
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  sessionPrice: number | null;
};

// A booking needs payment only when the coach can actually accept charges
// (Connect onboarded + charges enabled) AND has set a non-zero session rate.
// Otherwise the lesson is free and no Checkout is created.
export function requiresPayment(coach: CoachPayInfo | null | undefined): coach is CoachPayInfo & { stripeAccountId: string; sessionPrice: number } {
  return !!(
    coach &&
    coach.stripeAccountId &&
    coach.stripeChargesEnabled &&
    (coach.sessionPrice ?? 0) > 0
  );
}
