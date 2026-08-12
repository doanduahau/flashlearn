import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

import {
  isProtectedRoute,
  isGuestRoute,
  isAuthRoute,
  PROTECTED_ROUTES,
  GUEST_ONLY_ROUTES,
  AUTH_ROUTES,
  ALL_GUEST_ROUTES,
} from "@/features/auth/utils/routes";

describe("proxy activation", () => {
  it("src/proxy.ts exists as the Next.js 16 proxy entry point", () => {
    const proxyPath = path.join(process.cwd(), "src/proxy.ts");
    expect(fs.existsSync(proxyPath)).toBe(true);
  });

  it("root proxy.ts does not exist", () => {
    const proxyPath = path.join(process.cwd(), "proxy.ts");
    expect(fs.existsSync(proxyPath)).toBe(false);
  });

  it("src/middleware.ts does not exist as a Next.js entry point", () => {
    const middlewarePath = path.join(process.cwd(), "src/middleware.ts");
    expect(fs.existsSync(middlewarePath)).toBe(false);
  });
});

describe("isProtectedRoute", () => {
  for (const route of PROTECTED_ROUTES) {
    it(`recognizes ${route} as protected`, () => {
      expect(isProtectedRoute(route)).toBe(true);
    });
  }

  it("recognizes a sub-route of a protected route as protected", () => {
    expect(isProtectedRoute("/sets/abc123")).toBe(true);
  });

  it("recognizes a sub-route of a protected route with query params as protected", () => {
    expect(isProtectedRoute("/sets/abc123?page=1")).toBe(true);
  });

  it("recognizes a sub-route of a protected route with encoded path as protected", () => {
    expect(isProtectedRoute("/quiz/test-id")).toBe(true);
  });

  it("does not recognize a guest route as protected", () => {
    expect(isProtectedRoute("/sign-in")).toBe(false);
  });

  it("does not recognize the home page as protected", () => {
    expect(isProtectedRoute("/")).toBe(false);
  });

  it("does not recognize the check-email page as protected", () => {
    expect(isProtectedRoute("/check-email")).toBe(false);
  });

  it("does not recognize an unknown route as protected", () => {
    expect(isProtectedRoute("/unknown-route-12345")).toBe(false);
  });

  it("does not treat prefix collisions as protected", () => {
    expect(isProtectedRoute("/settings-public")).toBe(false);
  });
});

describe("isGuestRoute", () => {
  for (const route of ALL_GUEST_ROUTES) {
    it(`recognizes ${route} as a guest route`, () => {
      expect(isGuestRoute(route)).toBe(true);
    });
  }

  it("recognizes a sub-route of a guest route as a guest route", () => {
    expect(isGuestRoute("/auth/confirm?token_hash=abc")).toBe(true);
  });

  it("does not recognize a protected route as a guest route", () => {
    expect(isGuestRoute("/dashboard")).toBe(false);
  });
});

describe("isAuthRoute", () => {
  for (const route of AUTH_ROUTES) {
    it(`recognizes ${route} as an auth route`, () => {
      expect(isAuthRoute(route)).toBe(true);
    });
  }

  it("does not recognize a protected route as an auth route", () => {
    expect(isAuthRoute("/dashboard")).toBe(false);
  });

  it("does not recognize a guest-only route as an auth route", () => {
    expect(isAuthRoute("/sign-in")).toBe(false);
  });
});

describe("unknown routes", () => {
  it("does not redirect unknown routes to sign-in", () => {
    expect(isProtectedRoute("/unknown-route-12345")).toBe(false);
    expect(isGuestRoute("/unknown-route-12345")).toBe(false);
  });

  it("does not treat unknown routes as guest routes", () => {
    expect(isGuestRoute("/unknown-route-12345")).toBe(false);
  });
});

describe("PROTECTED_ROUTES constant", () => {
  it("includes all required protected routes", () => {
    expect(PROTECTED_ROUTES).toEqual([
      "/dashboard",
      "/import",
      "/sets",
      "/collections",
      "/study",
      "/match",
      "/quiz",
      "/history",
      "/statistics",
      "/settings",
    ]);
  });
});

describe("GUEST_ONLY_ROUTES constant", () => {
  it("includes all required guest-only routes", () => {
    expect(GUEST_ONLY_ROUTES).toEqual(["/sign-in", "/sign-up"]);
  });
});

describe("AUTH_ROUTES constant", () => {
  it("includes all required auth routes", () => {
    expect(AUTH_ROUTES).toEqual(["/check-email", "/auth/confirm", "/auth/error"]);
  });
});

describe("ALL_GUEST_ROUTES constant", () => {
  it("includes all required guest routes", () => {
    expect(ALL_GUEST_ROUTES).toEqual([
      "/",
      "/sign-in",
      "/sign-up",
      "/check-email",
      "/auth/confirm",
      "/auth/error",
    ]);
  });
});
