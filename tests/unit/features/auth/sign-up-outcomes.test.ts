import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`Redirect to ${url}`);
  }),
}));

import { signUp } from "@/features/auth/server/actions";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("signUp outcomes", () => {
  it("redirects to /dashboard when a session is returned immediately", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { session: { access_token: "test" }, user: null },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const formData = new FormData();
    formData.set("displayName", "Test User");
    formData.set("email", "test@example.com");
    formData.set("password", "password123");
    formData.set("confirmPassword", "password123");

    await expect(signUp(formData)).rejects.toThrow("Redirect to /dashboard");
  });

  it("redirects to /check-email when user is returned but no session (confirmation required)", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({
          data: { session: null, user: { id: "test-id" } },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const formData = new FormData();
    formData.set("displayName", "Test User");
    formData.set("email", "test@example.com");
    formData.set("password", "password123");
    formData.set("confirmPassword", "password123");

    await expect(signUp(formData)).rejects.toThrow("Redirect to /check-email");
  });

  it("redirects to sign-up with error on auth error", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signUp: vi
          .fn()
          .mockResolvedValue({ data: null, error: { message: "Email already registered" } }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const formData = new FormData();
    formData.set("displayName", "Test User");
    formData.set("email", "test@example.com");
    formData.set("password", "password123");
    formData.set("confirmPassword", "password123");

    await expect(signUp(formData)).rejects.toThrow("Redirect to /sign-up?error=");
  });

  it("redirects to sign-up with error on unexpected incomplete response", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        signUp: vi.fn().mockResolvedValue({ data: null, error: null }),
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>);

    const formData = new FormData();
    formData.set("displayName", "Test User");
    formData.set("email", "test@example.com");
    formData.set("password", "password123");
    formData.set("confirmPassword", "password123");

    await expect(signUp(formData)).rejects.toThrow("Redirect to /sign-up?error=");
  });
});
