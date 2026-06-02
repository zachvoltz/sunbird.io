// Provider dispatch + env helpers. Routes call getProvider(coach.paymentProvider)
// and then the shared checkout/cancel methods, never a processor SDK directly.
import type { Context } from "hono";
import type { PaymentProvider, ProviderId, PaymentEnv } from "./types";
import { stripeProvider } from "./stripe";
import { squareProvider } from "./square";

export * from "./types";

export function getProvider(provider: string | null | undefined): PaymentProvider {
  return provider === "SQUARE" ? squareProvider : stripeProvider;
}

// Read the resolved payment env from Hono bindings (Workers) or process.env
// (local Node dev) — the same fallback pattern the rest of the app uses.
export function readPaymentEnv(c: Context): PaymentEnv {
  const pick = (k: string): string | undefined =>
    ((c.env as any)?.[k] as string | undefined) ??
    (typeof process !== "undefined" ? process.env[k] : undefined) ??
    undefined;
  return {
    STRIPE_SECRET_KEY: pick("STRIPE_SECRET_KEY"),
    SQUARE_ENVIRONMENT: pick("SQUARE_ENVIRONMENT"),
    SQUARE_APPLICATION_ID: pick("SQUARE_APPLICATION_ID"),
    SQUARE_APPLICATION_SECRET: pick("SQUARE_APPLICATION_SECRET"),
    SQUARE_WEBHOOK_SIGNATURE_KEY: pick("SQUARE_WEBHOOK_SIGNATURE_KEY"),
  };
}

export type { PaymentProvider, ProviderId, PaymentEnv };
