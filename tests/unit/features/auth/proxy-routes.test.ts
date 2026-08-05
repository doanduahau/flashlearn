import { describe, expect, it } from "vitest";

import {
  isProtectedRoute,
  isGuestRoute,
  isAuthRoute,
  PROTECTED_ROUTES,
  GUEST_ONLY_ROUTES,
  AUTH_ROUTES,
  ALL_GUEST_ROUTES,
} from "@/features/auth/utils/routes";

describe("isProtectedRoute", () => {
  for (const route of PROTECTED_ROUTES) {
    it(`recognizes ${route} as protected`, () => {
      expect(isProtectedRoute(route)).toBe(true);
    });
  }

  it("recognizes a sub-route of a protected route as protected", () => {
    expect(isProtectedRoute("/sets/abc123")).toBe(true);
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

describe("PROTECTED_ROUTES constant", () => {
  it("includes all required protected routes", () => {
    expect(PROTECTED_ROUTES).toEqual([
      "/dashboard",
      "/import",
      "/sets",
      "/collections",
      "/study",
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
