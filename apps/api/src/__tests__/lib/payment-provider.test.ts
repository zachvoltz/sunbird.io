import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { requiresPayment, coachCanCharge, type CoachPayInfo } from "../../lib/payments";
import { getProvider } from "../../lib/payment-provider";
import { verifySquareWebhook } from "../../lib/payment-provider/square";

function coach(overrides: Partial<CoachPayInfo>): CoachPayInfo {
  return {
    paymentProvider: "STRIPE",
    stripeAccountId: null,
    stripeChargesEnabled: false,
    squareAccessToken: null,
    squareLocationId: null,
    squareConnected: false,
    sessionPrice: null,
    ...overrides,
  };
}

describe("requiresPayment / coachCanCharge (provider-aware)", () => {
  it("Stripe: needs account + charges enabled + a non-zero rate", () => {
    expect(requiresPayment(coach({ paymentProvider: "STRIPE", stripeAccountId: "acct_1", stripeChargesEnabled: true, sessionPrice: 5000 }))).toBe(true);
    // charges not enabled
    expect(requiresPayment(coach({ paymentProvider: "STRIPE", stripeAccountId: "acct_1", stripeChargesEnabled: false, sessionPrice: 5000 }))).toBe(false);
    // no rate set → free
    expect(requiresPayment(coach({ paymentProvider: "STRIPE", stripeAccountId: "acct_1", stripeChargesEnabled: true, sessionPrice: null }))).toBe(false);
  });

  it("Square: needs token + location + connected + a non-zero rate", () => {
    expect(requiresPayment(coach({ paymentProvider: "SQUARE", squareAccessToken: "tok", squareLocationId: "loc", squareConnected: true, sessionPrice: 5000 }))).toBe(true);
    // connected but missing token
    expect(coachCanCharge(coach({ paymentProvider: "SQUARE", squareAccessToken: null, squareLocationId: "loc", squareConnected: true }))).toBe(false);
    // missing location
    expect(coachCanCharge(coach({ paymentProvider: "SQUARE", squareAccessToken: "tok", squareLocationId: null, squareConnected: true }))).toBe(false);
    // not connected
    expect(coachCanCharge(coach({ paymentProvider: "SQUARE", squareAccessToken: "tok", squareLocationId: "loc", squareConnected: false }))).toBe(false);
    // connected but no rate → free
    expect(requiresPayment(coach({ paymentProvider: "SQUARE", squareAccessToken: "tok", squareLocationId: "loc", squareConnected: true, sessionPrice: 0 }))).toBe(false);
  });

  it("does not require payment for a Stripe coach when SQUARE is selected but unconnected", () => {
    expect(requiresPayment(coach({ paymentProvider: "SQUARE", stripeAccountId: "acct_1", stripeChargesEnabled: true, sessionPrice: 5000 }))).toBe(false);
  });
});

describe("getProvider dispatch", () => {
  it("maps the discriminator to the right adapter", () => {
    expect(getProvider("SQUARE").id).toBe("SQUARE");
    expect(getProvider("STRIPE").id).toBe("STRIPE");
    // unknown / null defaults to Stripe (matches the column default)
    expect(getProvider(null).id).toBe("STRIPE");
    expect(getProvider(undefined).id).toBe("STRIPE");
  });
});

describe("verifySquareWebhook", () => {
  const key = "test-signature-key";
  const url = "https://api.example.com/api/webhooks/square";
  const body = JSON.stringify({ type: "payment.updated", data: { object: { payment: { id: "p1" } } } });
  // Square's scheme: base64( HMAC_SHA256( key, notificationUrl + rawBody ) ).
  const sign = (k: string, u: string, b: string) => createHmac("sha256", k).update(u + b).digest("base64");

  it("accepts a correctly-signed payload", async () => {
    expect(await verifySquareWebhook(key, url, body, sign(key, url, body))).toBe(true);
  });

  it("rejects a tampered body", async () => {
    const tampered = body.replace("p1", "p2");
    expect(await verifySquareWebhook(key, url, tampered, sign(key, url, body))).toBe(false);
  });

  it("rejects a wrong signature / missing header", async () => {
    expect(await verifySquareWebhook(key, url, body, "not-a-real-signature")).toBe(false);
    expect(await verifySquareWebhook(key, url, body, null)).toBe(false);
    expect(await verifySquareWebhook("different-key", url, body, sign(key, url, body))).toBe(false);
  });
});
