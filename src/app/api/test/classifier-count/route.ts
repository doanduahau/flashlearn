import { NextResponse } from "next/server";

import { mockClassifierCount } from "@/features/imports/adapters/gemini-classifier";

const MOCK_ENABLED = (process.env.FLASHLEARN_CLASSIFIER_MOCK ?? "").trim() === "1";

export async function GET(req: Request) {
  if (!MOCK_ENABLED) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const url = new URL(req.url);
  if (url.searchParams.get("reset") === "1") {
    mockClassifierCount.reset();
  }
  return NextResponse.json({ calls: mockClassifierCount.calls });
}
