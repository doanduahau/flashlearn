import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { hasStorageQuotaWarning } from "@/features/entitlements/server/storage-quota-status";

describe("storage quota status", () => {
  it("returns true only for a recent warning in DB warn mode", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [{ enforcement_mode: "warn", has_recent_warning: true }],
        error: null,
      }),
    };

    await expect(
      hasStorageQuotaWarning(supabase as unknown as Parameters<typeof hasStorageQuotaWarning>[0]),
    ).resolves.toBe(true);
  });

  it("fails closed without displaying a warning when status cannot load", async () => {
    const supabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: new Error("unavailable") }),
    };

    await expect(
      hasStorageQuotaWarning(supabase as unknown as Parameters<typeof hasStorageQuotaWarning>[0]),
    ).resolves.toBe(false);
  });
});
