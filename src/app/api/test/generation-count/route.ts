import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const MOCK_ENABLED = (process.env.FLASHLEARN_GENERATION_MOCK ?? "").trim() === "1";

function readCount(): number {
  const path = process.env.FLASHLEARN_GENERATION_COUNT_FILE;
  if (!path) return 0;
  try {
    const raw = existsSync(path) ? readFileSync(path, "utf8") : "";
    return raw.split("\n").filter((l) => l.trim() !== "").length;
  } catch {
    return 0;
  }
}

function resetCount(): void {
  const path = process.env.FLASHLEARN_GENERATION_COUNT_FILE;
  if (!path) return;
  try {
    writeFileSync(path, "", "utf8");
  } catch {
    /* best effort */
  }
}

export async function GET(req: Request) {
  if (!MOCK_ENABLED) return NextResponse.json({ error: "not found" }, { status: 404 });
  const url = new URL(req.url);
  if (url.searchParams.get("reset") === "1") resetCount();
  return NextResponse.json({ calls: readCount() });
}
