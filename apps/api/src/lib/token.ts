import { bytesToHex } from "@noble/hashes/utils.js";
import { sha256 } from "@noble/hashes/sha2.js";

export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function hashToken(token: string): string {
  const encoded = new TextEncoder().encode(token);
  return bytesToHex(sha256(encoded));
}
