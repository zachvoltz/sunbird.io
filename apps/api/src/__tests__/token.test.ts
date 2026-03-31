import { describe, it, expect } from "vitest";
import { generateToken, hashToken } from "../lib/token";

describe("generateToken", () => {
  it("returns a 64-char hex string", () => {
    const token = generateToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces unique tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });
});

describe("hashToken", () => {
  it("returns a 64-char hex string (SHA-256)", () => {
    const hash = hashToken("test-token");
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces consistent hash for same input", () => {
    expect(hashToken("abc")).toBe(hashToken("abc"));
  });

  it("produces different hash for different input", () => {
    expect(hashToken("abc")).not.toBe(hashToken("def"));
  });
});
