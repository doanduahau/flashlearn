import { describe, expect, it, vi } from "vitest";

import { updateSession } from "@/lib/supabase/proxy";
import type { NextRequest } from "next/server";

vi.mock("next/server", () => ({
  NextResponse: {
    next: vi.fn(({ request }: { request: unknown }) => ({
      request,
      cookies: { set: vi.fn() },
    })),
    redirect: vi.fn((url: URL) => ({ url, status: 302 })),
  },
}));

vi.mock("@/lib/env", () => ({
  getSupabasePublishableConfig: vi.fn().mockReturnValue({
    url: "http://localhost:54321",
    publishableKey: "test-key",
  }),
}));

describe("proxy route protection behavior", () => {
  it("returns a response when updateSession succeeds", async () => {
    const result = await updateSession({
      nextUrl: { pathname: "/dashboard" } as unknown as NextRequest,
      cookies: { getAll: vi.fn().mockReturnValue([]) },
    } as unknown as NextRequest);

    expect(result).toBeDefined();
    expect(result.response).toBeDefined();
  });

  it("returns null claims when Supabase config is missing", async () => {
    const { getSupabasePublishableConfig } = await import("@/lib/env");
    vi.mocked(getSupabasePublishableConfig).mockImplementation(() => {
      throw new Error("Missing config");
    });

    const result = await updateSession({
      nextUrl: { pathname: "/dashboard" } as unknown as NextRequest,
      cookies: { getAll: vi.fn().mockReturnValue([]) },
    } as unknown as NextRequest);

    expect(result.claims).toBeNull();
  });
});
