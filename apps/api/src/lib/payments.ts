// Shared payment helpers. Kept separate from the provider adapters so the
// "does this booking need paying for" decision is testable without any SDK.

import type { CoachConnection, ProviderId } from "./payment-provider/types";

export type CoachPayInfo = {
  paymentProvider: string | null;
  // Stripe Connect
  stripeAccountId: string | null;
  stripeChargesEnabled: boolean;
  // Square OAuth
  squareAccessToken: string | null;
  squareLocationId: string | null;
  squareConnected: boolean;
  sessionPrice: number | null;
};

// Whether the coach's chosen provider is connected and able to take charges.
// Stripe needs the Connect account + charges enabled; Square needs the OAuth
// access token + location and the connected flag.
export function coachCanCharge(coach: CoachPayInfo): boolean {
  if (coach.paymentProvider === "SQUARE") {
    return !!(coach.squareConnected && coach.squareAccessToken && coach.squareLocationId);
  }
  return !!(coach.stripeAccountId && coach.stripeChargesEnabled);
}

// A booking needs payment only when the coach can actually accept charges on
// their chosen provider AND has set a non-zero session rate. Otherwise the
// lesson is free and no Checkout is created.
export function requiresPayment(
  coach: CoachPayInfo | null | undefined,
): coach is CoachPayInfo & { sessionPrice: number } {
  return !!(coach && coachCanCharge(coach) && (coach.sessionPrice ?? 0) > 0);
}

// Project the coach row onto the provider-neutral connection the adapters take.
export function toCoachConnection(coach: CoachPayInfo): CoachConnection {
  return {
    provider: (coach.paymentProvider as ProviderId) ?? "STRIPE",
    stripeAccountId: coach.stripeAccountId,
    squareAccessToken: coach.squareAccessToken,
    squareLocationId: coach.squareLocationId,
  };
}
