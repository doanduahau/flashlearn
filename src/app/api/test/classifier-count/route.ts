import { NextResponse } from "next/server";

import { mockClassifierCount } from "@/features/imports/adapters/gemini-classifier";
import { isTestRuntime } from "@/lib/env";

const MOCK_ENABLED =
  (process.env.CAPYSTUDY_CLASSIFIER_MOCK ?? "").trim() === "1" && isTestRuntime();

export async function GET(req: Request) {
  if (!MOCK_ENABLED) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const url = new URL(req.url);
  if (url.searchParams.get("reset") === "1") {
    mockClassifierCount.reset();
  }
  return NextResponse.json(
    { calls: mockClassifierCount.calls },
    { headers: { "Cache-Control": "no-store" } },
  );
}
