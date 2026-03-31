import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../lib/password";

describe("hashPassword", () => {
  it("returns salt:hash format", () => {
    const result = hashPassword("testpassword");
    const parts = result.split(":");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^[a-f0-9]{32}$/); // 16 bytes = 32 hex chars
    expect(parts[1]).toMatch(/^[a-f0-9]{128}$/); // 64 bytes = 128 hex chars
  });

  it("produces different salts each call", () => {
    const a = hashPassword("same");
    const b = hashPassword("same");
    expect(a).not.toBe(b);
  });
});

describe("verifyPassword", () => {
  it("returns true for correct password", () => {
    const hash = hashPassword("mypassword");
    expect(verifyPassword("mypassword", hash)).toBe(true);
  });

  it("returns false for wrong password", () => {
    const hash = hashPassword("mypassword");
    expect(verifyPassword("wrongpassword", hash)).toBe(false);
  });

  it("returns false for corrupted hash", () => {
    expect(verifyPassword("any", "notavalidhash")).toBe(false);
  });

  it("returns false for empty stored value", () => {
    expect(verifyPassword("any", "")).toBe(false);
  });
});
