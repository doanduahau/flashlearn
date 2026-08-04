import { describe, expect, it } from "vitest";

import { isSafeRedirect, sanitizeRedirect } from "@/features/auth/utils/safe-redirect";

describe("isSafeRedirect", () => {
  it("allows a safe internal path", () => {
    expect(isSafeRedirect("/dashboard")).toBe(true);
  });

  it("allows a safe internal path with a sub-route", () => {
    expect(isSafeRedirect("/sets/abc123")).toBe(true);
  });

  it("rejects an absolute URL", () => {
    expect(isSafeRedirect("https://evil.com")).toBe(false);
  });

  it("rejects an absolute URL with http", () => {
    expect(isSafeRedirect("http://evil.com")).toBe(false);
  });

  it("rejects a protocol-relative URL", () => {
    expect(isSafeRedirect("//evil.com")).toBe(false);
  });

  it("rejects a backslash-based bypass", () => {
    expect(isSafeRedirect("\\evil.com")).toBe(false);
  });

  it("rejects a path containing backslashes", () => {
    expect(isSafeRedirect("/dashboard\\evil")).toBe(false);
  });

  it("rejects a path that does not start with /", () => {
    expect(isSafeRedirect("dashboard")).toBe(false);
  });

  it("rejects the sign-in page as a redirect destination", () => {
    expect(isSafeRedirect("/sign-in")).toBe(false);
  });

  it("rejects the sign-up page as a redirect destination", () => {
    expect(isSafeRedirect("/sign-up")).toBe(false);
  });

  it("rejects the check-email page as a redirect destination", () => {
    expect(isSafeRedirect("/check-email")).toBe(false);
  });

  it("rejects the auth confirm page as a redirect destination", () => {
    expect(isSafeRedirect("/auth/confirm")).toBe(false);
  });

  it("rejects the auth error page as a redirect destination", () => {
    expect(isSafeRedirect("/auth/error")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isSafeRedirect("")).toBe(false);
  });

  it("rejects null", () => {
    expect(isSafeRedirect(null as unknown as string)).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isSafeRedirect(undefined as unknown as string)).toBe(false);
  });
});

describe("sanitizeRedirect", () => {
  it("returns a safe internal path", () => {
    expect(sanitizeRedirect("/dashboard")).toBe("/dashboard");
  });

  it("returns the fallback for an external URL", () => {
    expect(sanitizeRedirect("https://evil.com", "/dashboard")).toBe("/dashboard");
  });

  it("returns the fallback for a protocol-relative URL", () => {
    expect(sanitizeRedirect("//evil.com", "/dashboard")).toBe("/dashboard");
  });

  it("returns the fallback for a guest-only route", () => {
    expect(sanitizeRedirect("/sign-in", "/dashboard")).toBe("/dashboard");
  });

  it("returns the default fallback when no fallback is provided", () => {
    expect(sanitizeRedirect("https://evil.com")).toBe("/dashboard");
  });

  it("returns the default fallback for null", () => {
    expect(sanitizeRedirect(null)).toBe("/dashboard");
  });

  it("returns the default fallback for undefined", () => {
    expect(sanitizeRedirect(undefined)).toBe("/dashboard");
  });
});
