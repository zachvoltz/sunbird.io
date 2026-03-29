import { scrypt } from "@noble/hashes/scrypt.js";
import { randomBytes, bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, dkLen: 64 };

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scrypt(new TextEncoder().encode(password), salt, SCRYPT_PARAMS);
  return `${bytesToHex(salt)}:${bytesToHex(derived)}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;

  const salt = hexToBytes(saltHex);
  const expectedHash = hexToBytes(hashHex);
  const derived = scrypt(new TextEncoder().encode(password), salt, SCRYPT_PARAMS);

  // Constant-time comparison
  if (derived.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i++) {
    diff |= derived[i] ^ expectedHash[i];
  }
  return diff === 0;
}
