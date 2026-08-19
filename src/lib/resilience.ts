import { logger } from "@/lib/logger";
import { getManagedRedis } from "@/lib/security/managed-redis";

const DEFAULT_TIMEOUT_MS = 10_000;
const BREAKER_WINDOW_SECONDS = 60;
const BREAKER_FAILURE_THRESHOLD = 5;
const BREAKER_OPEN_SECONDS = 60;

export class ExternalServiceTimeoutError extends Error {
  constructor(
    readonly service: string,
    timeoutMs: number,
  ) {
    super(`${service} timed out after ${timeoutMs}ms`);
    this.name = "ExternalServiceTimeoutError";
  }
}

export class CircuitOpenError extends Error {
  constructor(readonly service: string) {
    super(`${service} is temporarily unavailable`);
    this.name = "CircuitOpenError";
  }
}

export async function withTimeout<T>(
  service: string,
  operation: Promise<T>,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new ExternalServiceTimeoutError(service, timeoutMs)),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function fetchWithTimeout(
  service: string,
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new ExternalServiceTimeoutError(service, timeoutMs);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function withCircuitBreaker<T>(
  service: string,
  operation: () => Promise<T>,
): Promise<T> {
  const redis = getManagedRedis();
  if (!redis) return operation();

  // Stable legacy namespace preserves an open circuit across the brand deploy.
  const keyPrefix = `flashlearn:circuit:${service}`;
  const openUntil = await redis.get<number>(`${keyPrefix}:open-until`);
  if (typeof openUntil === "number" && openUntil > Date.now()) {
    logger.warn("circuit_breaker.open", { service });
    throw new CircuitOpenError(service);
  }

  try {
    const result = await operation();
    await redis.del(`${keyPrefix}:failures`);
    return result;
  } catch (error) {
    const failures = await redis.incr(`${keyPrefix}:failures`);
    if (failures === 1) await redis.expire(`${keyPrefix}:failures`, BREAKER_WINDOW_SECONDS);
    if (failures >= BREAKER_FAILURE_THRESHOLD) {
      await redis.set(`${keyPrefix}:open-until`, Date.now() + BREAKER_OPEN_SECONDS * 1000, {
        ex: BREAKER_OPEN_SECONDS,
      });
      logger.error("circuit_breaker.opened", { service, failures });
    }
    throw error;
  }
}
