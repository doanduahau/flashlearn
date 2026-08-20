import { beforeEach, describe, expect, it, vi } from "vitest";

const { getFeatureFlags, rpc } = vi.hoisted(() => ({
  getFeatureFlags: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/telemetry/feature-flags", () => ({ getFeatureFlags }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc }),
}));
vi.mock("@/lib/telemetry/telemetry", () => ({
  bucketCount: (value: number) => String(value),
  createTelemetryCorrelationId: () => "correlation-id",
  recordTelemetry: vi.fn(),
}));

import { provisionStarterSetsForAuthenticatedUser } from "@/features/catalog/server/provision-starter-sets";

describe("starter provisioning boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFeatureFlags.mockReturnValue({ starterProvisioningEnabled: false });
  });

  it("does not touch the database while the rollout flag is off", async () => {
    await expect(provisionStarterSetsForAuthenticatedUser("user-id")).resolves.toEqual({
      outcome: "disabled",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not fail authenticated rendering when the catalog is unavailable", async () => {
    getFeatureFlags.mockReturnValue({ starterProvisioningEnabled: true });
    rpc.mockRejectedValue(new Error("connection failed"));

    await expect(provisionStarterSetsForAuthenticatedUser("user-id")).resolves.toEqual({
      outcome: "unavailable",
    });
  });

  it("maps the service-role RPC result", async () => {
    getFeatureFlags.mockReturnValue({ starterProvisioningEnabled: true });
    rpc.mockResolvedValue({
      data: [
        {
          provisioning_status: "completed",
          created_sets: 3,
          existing_sets: 0,
          missing_sets: 0,
          attempts: 1,
        },
      ],
      error: null,
    });

    await expect(provisionStarterSetsForAuthenticatedUser("user-id")).resolves.toEqual({
      outcome: "completed",
      createdSets: 3,
      existingSets: 0,
      missingSets: 0,
      attempts: 1,
    });
  });
});
