import { randomUUID } from "node:crypto";

import { env } from "@/lib/env";
import { getManagedRedis } from "@/lib/security/managed-redis";

const SLOT_TTL_SECONDS = 5 * 60;
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
end
return 0
`;

export class DistributedSemaphoreUnavailableError extends Error {
  constructor() {
    super("distributed semaphore unavailable");
    this.name = "DistributedSemaphoreUnavailableError";
  }
}

export class DistributedConcurrencyError extends Error {
  constructor() {
    super("distributed concurrency limit reached");
    this.name = "DistributedConcurrencyError";
  }
}

export type DistributedSemaphoreLease = Readonly<{
  release(): Promise<void>;
}>;

function requiresManagedRedis(): boolean {
  return process.env.NODE_ENV === "production" && env.runtimeEnvironment !== "test";
}

/**
 * Acquires one of a bounded number of per-user slots. Each slot has a crash TTL
 * and a random owner token; release is compare-and-delete so one request cannot
 * release another request's lease.
 */
export async function acquireHeavyJobSlot(
  userId: string,
  limit: number,
): Promise<DistributedSemaphoreLease> {
  const redis = getManagedRedis();
  if (!redis) {
    if (requiresManagedRedis()) throw new DistributedSemaphoreUnavailableError();
    return { release: async () => undefined };
  }

  const ownerToken = randomUUID();
  const safeLimit = Math.max(1, Math.min(10, Math.floor(limit)));
  for (let slot = 0; slot < safeLimit; slot += 1) {
    const key = `capystudy:heavy-job:${userId}:${slot}`;
    const acquired = await redis.set(key, ownerToken, { nx: true, ex: SLOT_TTL_SECONDS });
    if (acquired !== "OK") continue;
    return {
      async release(): Promise<void> {
        await redis.eval(RELEASE_SCRIPT, [key], [ownerToken]);
      },
    };
  }
  throw new DistributedConcurrencyError();
}
