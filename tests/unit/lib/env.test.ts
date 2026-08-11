import { afterEach, describe, expect, it, vi } from "vitest";

import type { SupabaseConfig } from "@/lib/env";

async function loadEnv() {
  vi.resetModules();
  return await import("@/lib/env");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("env validation", () => {
  it("parses the Supabase publishable key configuration", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_key");

    const envModule = await loadEnv();
    const config: SupabaseConfig = envModule.getSupabasePublishableConfig();

    expect(envModule.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).toBe("sb_publishable_test_key");
    expect(config).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_test_key",
    });
  });

  it("keeps placeholder routes safe when Supabase config is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    const envModule = await loadEnv();

    expect(envModule.env.NEXT_PUBLIC_SUPABASE_URL).toBeUndefined();
    expect(() => envModule.getSupabasePublishableConfig()).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });

  it("keeps the service role key server-only and requires it only for private RPCs", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");

    const envModule = await loadEnv();

    expect(envModule.getSupabaseServiceConfig()).toEqual({
      url: "https://example.supabase.co",
      serviceRoleKey: "service-role-test-key",
    });
  });

  it("rejects an invalid Supabase URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "not-a-url");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_key");

    await expect(loadEnv()).rejects.toThrow(/Invalid environment variables/);
  });

  it("refuses the configured production Supabase project from local development by default", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://rtrllrlilupoesikeypt.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");

    const envModule = await loadEnv();

    expect(() => envModule.getSupabasePublishableConfig()).toThrow(
      /Refusing to use the production Supabase project from local development/,
    );
    expect(() => envModule.getSupabaseServiceConfig()).toThrow(
      /Refusing to use the production Supabase project from local development/,
    );
  });

  it("allows an explicit local diagnostic override without changing production behavior", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://rtrllrlilupoesikeypt.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_key");
    vi.stubEnv("NEXT_PUBLIC_ALLOW_PRODUCTION_SUPABASE_FROM_LOCAL", "1");

    const envModule = await loadEnv();

    expect(envModule.getSupabasePublishableConfig().url).toBe(
      "https://rtrllrlilupoesikeypt.supabase.co",
    );
  });
});
