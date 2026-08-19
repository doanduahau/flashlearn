import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Public liveness probe. It deliberately avoids dependency calls and sensitive details. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { status: "ok" },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
