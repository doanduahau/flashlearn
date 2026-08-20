import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acquireHeavyJobSlot: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/security/distributed-semaphore", () => ({
  acquireHeavyJobSlot: mocks.acquireHeavyJobSlot,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));

import { runProcessingJobPhase } from "@/features/entitlements/server/processing-job-service";

const JOB = {
  id: "aaaaaaaa-0000-4000-8000-000000000001",
  userId: "bbbbbbbb-0000-4000-8000-000000000002",
};

describe("runProcessingJobPhase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockResolvedValue({
      data: [{ job_status: "running", concurrent_limit: 1 }],
      error: null,
    });
    mocks.acquireHeavyJobSlot.mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined) });
  });

  it("runs the operation and releases the lease and DB phase afterwards", async () => {
    const operation = vi.fn().mockResolvedValue("result");
    const result = await runProcessingJobPhase(JOB, operation);

    expect(result).toBe("result");
    expect(mocks.rpc).toHaveBeenCalledWith("begin_processing_job_phase", expect.any(Object));
    expect(mocks.rpc).toHaveBeenCalledWith("pause_processing_job", expect.any(Object));
  });

  it("pauses the job back to queued when the semaphore cannot be acquired", async () => {
    mocks.acquireHeavyJobSlot.mockRejectedValue(new Error("concurrency limit reached"));
    const operation = vi.fn().mockResolvedValue("result");

    await expect(runProcessingJobPhase(JOB, operation)).rejects.toThrow(
      "concurrency limit reached",
    );

    // The operation never ran, the lease was never released, and the DB phase
    // was explicitly paused so the job does not stay stuck in 'running'.
    expect(operation).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("pause_processing_job", expect.any(Object));
  });

  it("rethrows when the DB phase itself rejects before acquiring a slot", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: new Error("processing job is not active"),
    });

    await expect(runProcessingJobPhase(JOB, vi.fn())).rejects.toThrow(
      "processing_job_concurrency_failed",
    );
    expect(mocks.acquireHeavyJobSlot).not.toHaveBeenCalled();
  });
});
