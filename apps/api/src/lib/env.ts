import type { Context } from "hono";

/**
 * Read an environment variable from Hono bindings (Cloudflare Workers)
 * or fall back to process.env (Node.js local dev).
 */
export function getEnv(c: Context, key: string): string {
  return (c.env?.[key] as string) || (typeof process !== "undefined" ? process.env[key] : undefined) || "";
}
