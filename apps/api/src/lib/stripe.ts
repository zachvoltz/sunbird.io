// Stripe SDK factory wired for Cloudflare Workers. The SDK ships a
// fetch-based HTTP client that works in the Workers runtime without
// any Node.js polyfills; we just have to opt into it explicitly.
import Stripe from "stripe";

export function makeStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    // Pinning ourselves to a known API version so the SDK's typings
    // match the runtime. Cast through `as any` because the version
    // string union shifts between SDK minor releases.
    apiVersion: "2024-12-18.acacia" as any,
    httpClient: Stripe.createFetchHttpClient(),
  });
}
