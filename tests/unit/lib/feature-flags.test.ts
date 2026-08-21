import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

async function loadFlags() {
  vi.resetModules();
  return await import("@/lib/telemetry/feature-flags");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("feature flags", () => {
  it("keeps new product surfaces off and quota observational by default", async () => {
    const { getFeatureFlags } = await loadFlags();

    expect(getFeatureFlags()).toEqual({
      catalogEnabled: false,
      starterProvisioningEnabled: false,
      quotaEnforcementMode: "observe",
      adminConsoleEnabled: false,
      billingEnabled: false,
      adminCatalogMutationsEnabled: false,
    });
  });

  it("reads server-side rollout settings", async () => {
    vi.stubEnv("CAPYSTUDY_CATALOG_ENABLED", "true");
    vi.stubEnv("CAPYSTUDY_STARTER_PROVISIONING_ENABLED", "true");
    vi.stubEnv("CAPYSTUDY_QUOTA_ENFORCEMENT_MODE", "warn");
    vi.stubEnv("CAPYSTUDY_ADMIN_CONSOLE_ENABLED", "true");
    vi.stubEnv("CAPYSTUDY_BILLING_ENABLED", "true");
    vi.stubEnv("CAPYSTUDY_ADMIN_CATALOG_MUTATIONS_ENABLED", "true");

    const { getFeatureFlags } = await loadFlags();

    expect(getFeatureFlags()).toEqual({
      catalogEnabled: true,
      starterProvisioningEnabled: true,
      quotaEnforcementMode: "warn",
      adminConsoleEnabled: true,
      billingEnabled: true,
      adminCatalogMutationsEnabled: true,
    });
  });
});
