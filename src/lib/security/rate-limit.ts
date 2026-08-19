import { createHash } from "node:crypto";

import { Ratelimit } from "@upstash/ratelimit";
import { headers } from "next/headers";

import { logger } from "@/lib/logger";
import { env } from "@/lib/env";
import { getManagedRedis } from "@/lib/security/managed-redis";
import { recordRateLimitTelemetry } from "@/lib/telemetry/telemetry";

type RateLimitPolicy =
  | "authSignIn"
  | "authSignUp"
  | "import"
  | "aiGeneration"
  | "googleSheets"
  | "learningSubmit"
  | "catalogInstallFree"
  | "catalogInstallPro"
  | "publicShare";

type PolicyConfig = Readonly<{
  limit: number;
  window: Parameters<typeof Ratelimit.slidingWindow>[1];
}>;

const POLICY_CONFIG: Record<RateLimitPolicy, PolicyConfig> = {
  authSignIn: { limit: 5, window: "15 m" },
  authSignUp: { limit: 4, window: "1 h" },
  import: { limit: 12, window: "1 h" },
  aiGeneration: { limit: 20, window: "1 h" },
  googleSheets: { limit: 30, window: "10 m" },
  learningSubmit: { limit: 30, window: "10 m" },
  catalogInstallFree: { limit: 10, window: "1 h" },
  catalogInstallPro: { limit: 30, window: "1 h" },
  publicShare: { limit: 120, window: "1 m" },
};

const limiters = new Map<RateLimitPolicy, Ratelimit>();

export type RateLimitResult =
  { ok: true } | { ok: false; retryAfterSeconds: number; unavailable: boolean };

function getLimiter(policy: RateLimitPolicy): Ratelimit | null {
  const existing = limiters.get(policy);
  if (existing) return existing;

  const redis = getManagedRedis();
  if (!redis) return null;

  const config = POLICY_CONFIG[policy];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.limit, config.window),
    analytics: true,
    // Keep the established key namespace during the brand transition so an
    // active rate-limit window cannot be bypassed by deploying a rename.
    prefix: `flashlearn:rate-limit:${policy}`,
  });
  limiters.set(policy, limiter);
  return limiter;
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" && env.runtimeEnvironment !== "test";
}

function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

/** Builds a privacy-preserving key from the trusted request headers. */
export async function requestRateLimitKey(scope: string, subject?: string): Promise<string> {
  let ip = "unknown";
  try {
    const requestHeaders = await headers();
    const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
    ip = forwarded || requestHeaders.get("x-real-ip") || "unknown";
  } catch {
    // Unit tests call actions without Next.js request context. Production actions always have one.
  }
  return `${scope}:${fingerprint(`${subject ?? "anonymous"}:${ip}`)}`;
}

export function subjectRateLimitKey(scope: string, subject: string): string {
  return `${scope}:${fingerprint(subject)}`;
}

/** Consumes a limit. Production fails closed when the required managed Redis config is absent. */
export async function consumeRateLimit(
  policy: RateLimitPolicy,
  identifier: string,
): Promise<RateLimitResult> {
  const limiter = getLimiter(policy);
  if (!limiter) {
    if (isProductionRuntime()) logger.error("rate_limit.unavailable", { policy, production: true });
    recordRateLimitTelemetry({
      policy,
      outcome: isProductionRuntime() ? "unavailable" : "allowed",
    });
    return isProductionRuntime()
      ? { ok: false, retryAfterSeconds: 60, unavailable: true }
      : { ok: true };
  }

  try {
    const result = await limiter.limit(identifier);
    if (result.success) {
      recordRateLimitTelemetry({ policy, outcome: "allowed" });
      return { ok: true };
    }
    const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    logger.warn("rate_limit.exceeded", { policy, retryAfterSeconds });
    recordRateLimitTelemetry({ policy, outcome: "limited", retryAfterSeconds });
    return { ok: false, retryAfterSeconds, unavailable: false };
  } catch (error) {
    if (isProductionRuntime()) logger.exception("rate_limit.check_failed", error, { policy });
    recordRateLimitTelemetry({
      policy,
      outcome: isProductionRuntime() ? "unavailable" : "allowed",
      retryAfterSeconds: 60,
    });
    return isProductionRuntime()
      ? { ok: false, retryAfterSeconds: 60, unavailable: true }
      : { ok: true };
  }
}

export function rateLimitMessage(result: Exclude<RateLimitResult, { ok: true }>): string {
  if (result.unavailable) return "Dịch vụ bảo vệ tạm thời không sẵn sàng. Vui lòng thử lại sau.";
  return `Bạn thao tác quá nhanh. Vui lòng thử lại sau ${result.retryAfterSeconds} giây.`;
}
