import { describe, it, expect } from "vitest";
import {
  generateSessionId,
  serializeSessionCookie,
  clearSessionCookie,
  parseSessionCookie,
} from "../lib/session";

describe("generateSessionId", () => {
  it("returns a 64-char hex string", () => {
    const id = generateSessionId();
    expect(id).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces unique IDs", () => {
    const a = generateSessionId();
    const b = generateSessionId();
    expect(a).not.toBe(b);
  });
});

describe("serializeSessionCookie", () => {
  it("includes session ID", () => {
    const cookie = serializeSessionCookie("abc123", new Date(Date.now() + 86400000));
    expect(cookie).toContain("session=abc123");
  });

  it("includes HttpOnly", () => {
    const cookie = serializeSessionCookie("x", new Date(Date.now() + 86400000));
    expect(cookie).toContain("HttpOnly");
  });

  it("includes SameSite=Lax", () => {
    const cookie = serializeSessionCookie("x", new Date(Date.now() + 86400000));
    expect(cookie).toContain("SameSite=Lax");
  });

  it("includes Path=/", () => {
    const cookie = serializeSessionCookie("x", new Date(Date.now() + 86400000));
    expect(cookie).toContain("Path=/");
  });

  it("includes positive Max-Age for future expiry", () => {
    const cookie = serializeSessionCookie("x", new Date(Date.now() + 3600000));
    const match = cookie.match(/Max-Age=(\d+)/);
    expect(match).toBeTruthy();
    expect(Number(match![1])).toBeGreaterThan(0);
  });
});

describe("clearSessionCookie", () => {
  it("sets session to empty", () => {
    expect(clearSessionCookie()).toContain("session=");
  });

  it("sets Max-Age=0", () => {
    expect(clearSessionCookie()).toContain("Max-Age=0");
  });

  it("includes HttpOnly", () => {
    expect(clearSessionCookie()).toContain("HttpOnly");
  });
});

describe("parseSessionCookie", () => {
  it("extracts session ID from valid header", () => {
    expect(parseSessionCookie("session=abc123")).toBe("abc123");
  });

  it("extracts session from multiple cookies", () => {
    expect(parseSessionCookie("other=val; session=xyz; another=val")).toBe("xyz");
  });

  it("returns null for undefined header", () => {
    expect(parseSessionCookie(undefined)).toBeNull();
  });

  it("returns null when session cookie is absent", () => {
    expect(parseSessionCookie("other=val; foo=bar")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseSessionCookie("")).toBeNull();
  });
});
