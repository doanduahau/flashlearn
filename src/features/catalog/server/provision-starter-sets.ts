import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getFeatureFlags } from "@/lib/telemetry/feature-flags";
import {
  bucketCount,
  createTelemetryCorrelationId,
  recordTelemetry,
} from "@/lib/telemetry/telemetry";

export type StarterProvisioningResult =
  | { outcome: "disabled" }
  | {
      outcome: "completed" | "partial" | "failed";
      createdSets: number;
      existingSets: number;
      missingSets: number;
      attempts: number;
    }
  | { outcome: "unavailable" };

/**
 * Best-effort post-auth provisioning. This function intentionally never throws:
 * catalog or service-role failures must not prevent an authenticated app render.
 */
export async function provisionStarterSetsForAuthenticatedUser(
  userId: string,
): Promise<StarterProvisioningResult> {
  if (!getFeatureFlags().starterProvisioningEnabled) return { outcome: "disabled" };

  try {
    const { data, error } = await createAdminClient().rpc("provision_starter_sets_with_quota", {
      p_user_id: userId,
      p_enforcement_mode: getFeatureFlags().quotaEnforcementMode,
    });
    const result = data?.[0];
    if (error || !result) {
      recordProvisioning("unavailable", 0, 3);
      return { outcome: "unavailable" };
    }

    const outcome =
      result.provisioning_status === "completed" ||
      result.provisioning_status === "partial" ||
      result.provisioning_status === "failed"
        ? result.provisioning_status
        : "failed";
    recordProvisioning(outcome, result.created_sets, result.missing_sets);

    return {
      outcome,
      createdSets: result.created_sets,
      existingSets: result.existing_sets,
      missingSets: result.missing_sets,
      attempts: result.attempts,
    };
  } catch {
    recordProvisioning("unavailable", 0, 3);
    return { outcome: "unavailable" };
  }
}

function recordProvisioning(
  outcome: "completed" | "partial" | "failed" | "unavailable",
  createdSets: number,
  missingSets: number,
): void {
  recordTelemetry({
    name: "capystudy.provisioning.completed",
    correlationId: createTelemetryCorrelationId(),
    outcome,
    createdCountBucket: bucketCount(createdSets),
    missingCountBucket: bucketCount(missingSets),
  });
}
