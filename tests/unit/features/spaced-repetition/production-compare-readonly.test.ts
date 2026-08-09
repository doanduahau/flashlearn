import { describe, expect, it, vi } from "vitest";

// Guard: the production comparison command must be diagnostic-only. If it ever
// imports a write-capable reconciliation module, the mock factory below throws
// and this test fails, proving the command cannot reach reconcileCardSchedule,
// the projection CAS RPC, or any INSERT/UPDATE/DELETE/UPSERT path.

vi.mock("@/features/spaced-repetition/server/reconcile-orchestrator", () => {
  throw new Error("fsrs-compare-production must not import reconcile-orchestrator");
});
vi.mock("@/features/spaced-repetition/server/reconcile-card-schedule", () => {
  throw new Error("fsrs-compare-production must not import reconcile-card-schedule");
});
vi.mock("@/features/spaced-repetition/server/service-role-repository", () => {
  throw new Error("fsrs-compare-production must not import service-role-repository");
});
vi.mock("@/features/spaced-repetition/server/schedule-repository", () => {
  throw new Error("fsrs-compare-production must not import schedule-repository");
});

describe("fsrs-compare-production is read-only", () => {
  it("loads without importing any write-capable reconciliation module", async () => {
    const mod = await import("@/../scripts/fsrs-compare-production");
    expect(mod).toBeDefined();
  });

  it("exposes no write-capable reconciliation entry points", async () => {
    const mod = (await import("@/../scripts/fsrs-compare-production")) as Record<string, unknown>;
    expect(mod.reconcileCardSchedule).toBeUndefined();
    expect(mod.buildServiceRoleWriter).toBeUndefined();
    expect(mod.runProductionBackfill).toBeUndefined();
  });
});
