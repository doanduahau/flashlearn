import { describe, expect, it, vi } from "vitest";

// Guard: the production diagnostic command must be diagnostic-only. If it ever
// imports a write-capable reconciliation module, the mock factory below throws
// and this test fails, proving the command cannot reach reconcileCardSchedule,
// the projection CAS RPC, or any INSERT/UPDATE/DELETE/UPSERT path.

vi.mock("@/features/spaced-repetition/server/reconcile-orchestrator", () => {
  throw new Error("fsrs-diagnose-production must not import reconcile-orchestrator");
});
vi.mock("@/features/spaced-repetition/server/reconcile-card-schedule", () => {
  throw new Error("fsrs-diagnose-production must not import reconcile-card-schedule");
});
vi.mock("@/features/spaced-repetition/server/service-role-repository", () => {
  throw new Error("fsrs-diagnose-production must not import service-role-repository");
});
vi.mock("@/features/quiz/server/create-own-quiz-session", () => {
  throw new Error("fsrs-diagnose-production must not import quiz creation");
});
vi.mock("@/features/mastery/server/get-dashboard-snapshot", () => {
  throw new Error("fsrs-diagnose-production must not import dashboard snapshot");
});

describe("fsrs-diagnose-production is read-only", () => {
  it("loads without importing any write-capable reconciliation module", async () => {
    const mod = await import("@/../scripts/fsrs-diagnose-production");
    expect(mod).toBeDefined();
  });

  it("exposes no write-capable or mutation entry points", async () => {
    const mod = (await import("@/../scripts/fsrs-diagnose-production")) as Record<string, unknown>;
    expect(mod.reconcileCardSchedule).toBeUndefined();
    expect(mod.upsertCardSchedule).toBeUndefined();
    expect(mod.buildServiceRoleWriter).toBeUndefined();
    expect(mod.runProductionBackfill).toBeUndefined();
  });
});
