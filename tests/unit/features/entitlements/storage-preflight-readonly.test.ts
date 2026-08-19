import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("storage production preflight safety", () => {
  it("contains no Supabase write operation or mutation RPC", async () => {
    const source = await readFile(
      path.join(process.cwd(), "scripts", "storage-preflight-production.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/\.(?:insert|update|delete|upsert|rpc)\s*\(/);
    expect(source).toContain("resolveProductionIdentity");
    expect(source).toContain("READ-ONLY — NO WRITES PERFORMED");
  });
});
