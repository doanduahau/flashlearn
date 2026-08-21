import "server-only";

import { env } from "@/lib/env";

export type QuotaEnforcementMode = "observe" | "warn" | "block";

export type FeatureFlags = Readonly<{
  catalogEnabled: boolean;
  starterProvisioningEnabled: boolean;
  quotaEnforcementMode: QuotaEnforcementMode;
  adminConsoleEnabled: boolean;
  adminCatalogMutationsEnabled: boolean;
  adminUserMutationsEnabled: boolean;
  billingEnabled: boolean;
}>;

function isEnabled(value: "true" | "false"): boolean {
  return value === "true";
}

/**
 * Server-only rollout controls. Defaults intentionally keep every new product
 * surface off and quota enforcement observational until a staged rollout says otherwise.
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    catalogEnabled: isEnabled(env.CAPYSTUDY_CATALOG_ENABLED),
    starterProvisioningEnabled: isEnabled(env.CAPYSTUDY_STARTER_PROVISIONING_ENABLED),
    quotaEnforcementMode: env.CAPYSTUDY_QUOTA_ENFORCEMENT_MODE,
    adminConsoleEnabled: isEnabled(env.CAPYSTUDY_ADMIN_CONSOLE_ENABLED),
    adminCatalogMutationsEnabled: isEnabled(env.CAPYSTUDY_ADMIN_CATALOG_MUTATIONS_ENABLED),
    adminUserMutationsEnabled: isEnabled(env.CAPYSTUDY_ADMIN_USER_MUTATIONS_ENABLED),
    billingEnabled: isEnabled(env.CAPYSTUDY_BILLING_ENABLED),
  };
}
