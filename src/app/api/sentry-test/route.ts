import { timingSafeEqual } from "node:crypto";

import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";

export const runtime = "nodejs";

const SENTRY_TEST_MESSAGE = "capystudy-staging-sentry-test";
const SENTRY_FLUSH_TIMEOUT_MS = 5_000;

function hasValidToken(request: Request): boolean {
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

export async function GET(request: Request): Promise<NextResponse> {
  if (env.runtimeEnvironment !== "staging" || !hasValidToken(request)) {
    return new NextResponse(null, { status: 404 });
  }

  Sentry.captureException(new Error(SENTRY_TEST_MESSAGE), {
    tags: { event: SENTRY_TEST_MESSAGE },
  });
  const flushed = await Sentry.flush(SENTRY_FLUSH_TIMEOUT_MS);

  return new NextResponse(null, {
    status: flushed ? 204 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
