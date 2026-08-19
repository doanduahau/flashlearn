import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getManagedRedis } from "@/lib/security/managed-redis";

export const runtime = "nodejs";

function hasValidToken(request: NextRequest): boolean {
  const expected = process.env.HEALTHCHECK_TOKEN;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

/** Protected readiness probe for the monitoring service. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!hasValidToken(request)) return new NextResponse(null, { status: 404 });

  const missing = [
    !env.NEXT_PUBLIC_SUPABASE_URL && "supabase_url",
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && "supabase_key",
    process.env.FLASHLEARN_ENVIRONMENT === "production" && !getManagedRedis() && "managed_redis",
  ].filter(Boolean);
  if (missing.length > 0) {
    logger.error("health.readiness_failed", { missing });
    return new NextResponse(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const redis = getManagedRedis();
    if (redis) await redis.ping();
  } catch (error) {
    logger.exception("health.redis_unavailable", error);
    return new NextResponse(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
