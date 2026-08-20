import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getManagedRedis: vi.fn(), set: vi.fn(), eval: vi.fn() }));

vi.mock("@/lib/env", () => ({ env: { runtimeEnvironment: "test" } }));
vi.mock("@/lib/security/managed-redis", () => ({ getManagedRedis: mocks.getManagedRedis }));

import {
  DistributedConcurrencyError,
  acquireHeavyJobSlot,
} from "@/lib/security/distributed-semaphore";

describe("distributed heavy-job semaphore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getManagedRedis.mockReturnValue({ set: mocks.set, eval: mocks.eval });
  });

  it("uses bounded slots, a crash TTL, and compare-delete release", async () => {
    mocks.set.mockResolvedValueOnce(null).mockResolvedValueOnce("OK");
    const lease = await acquireHeavyJobSlot("user-1", 2);
    expect(mocks.set).toHaveBeenCalledTimes(2);
    expect(mocks.set.mock.calls[1]?.[2]).toEqual({ nx: true, ex: 300 });
    await lease.release();
    expect(mocks.eval).toHaveBeenCalledOnce();
    const [, keys, ownerArgs] = mocks.eval.mock.calls[0]!;
    expect(keys).toEqual(["capystudy:heavy-job:user-1:1"]);
    expect(ownerArgs).toHaveLength(1);
  });

  it("rejects when every plan slot is occupied", async () => {
    mocks.set.mockResolvedValue(null);
    await expect(acquireHeavyJobSlot("user-1", 1)).rejects.toBeInstanceOf(
      DistributedConcurrencyError,
    );
  });
});
