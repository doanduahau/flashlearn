import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockRequirePermission = vi.fn();
vi.mock("@/features/admin/server/authorization", () => ({
  AdminAuthorizationError: class extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "AdminAuthorizationError";
    }
  },
  requireAdminPermission: (...args: unknown[]) => mockRequirePermission(...args),
}));

const mockRpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: mockRpc,
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { adminAdjustUserUsage } from "@/features/admin/server/admin-user-actions";
import { adminRetryProcessingJob } from "@/features/admin/server/admin-job-actions";

describe("admin user adjustments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue({
      userId: "actor-123",
      roles: ["support"],
    });
  });

  it("adjusts usage successfully", async () => {
    mockRpc.mockResolvedValue({
      data: [{ usage_key: "ai.content_credits.monthly", amount: 50, entry_type: "admin_adjust" }],
      error: null,
    });
    const result = await adminAdjustUserUsage(
      "user-456",
      "ai.content_credits.monthly",
      50,
      "Compensation",
    );
    expect(result.ok).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith(
      "admin_adjust_user_usage",
      expect.objectContaining({
        p_actor_user_id: "actor-123",
        p_target_user_id: "user-456",
        p_amount: 50,
      }),
    );
  });

  it("rejects zero amount", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "amount must be between -10000 and 10000 (non-zero)" },
    });
    const result = await adminAdjustUserUsage(
      "user-456",
      "ai.content_credits.monthly",
      0,
      "reason",
    );
    expect(result.ok).toBe(false);
  });

  it("rejects unauthorized user", async () => {
    mockRequirePermission.mockRejectedValue(new Error("admin permission denied"));
    const result = await adminAdjustUserUsage("user-456", "key", 10, "reason");
    expect(result.ok).toBe(false);
  });
});

describe("admin job retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePermission.mockResolvedValue({
      userId: "actor-123",
      roles: ["support"],
    });
  });

  it("retries failed job successfully", async () => {
    mockRpc.mockResolvedValue({
      data: [{ job_id: "job-1", status: "queued" }],
      error: null,
    });
    const result = await adminRetryProcessingJob("job-1", "Transient error");
    expect(result.ok).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith(
      "admin_retry_processing_job",
      expect.objectContaining({
        p_actor_user_id: "actor-123",
        p_job_id: "job-1",
        p_reason: "Transient error",
      }),
    );
  });

  it("rejects non-failed job", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "can only retry failed jobs" },
    });
    const result = await adminRetryProcessingJob("job-1", "reason");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("lỗi");
    }
  });

  it("rejects unauthorized user", async () => {
    mockRequirePermission.mockRejectedValue(new Error("admin permission denied"));
    const result = await adminRetryProcessingJob("job-1", "reason");
    expect(result.ok).toBe(false);
  });
});
