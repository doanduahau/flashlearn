import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("deployment constraints", () => {
  const srcFiles = [
    "proxy.ts",
    "src/lib/supabase/proxy.ts",
    "src/lib/supabase/server.ts",
    "src/lib/supabase/client.ts",
    "src/features/auth/server/actions.ts",
    "src/features/auth/utils/safe-redirect.ts",
    "src/features/auth/utils/auth-error.ts",
    "src/lib/env.ts",
  ];

  const allContent = srcFiles
    .map((file) => {
      const filePath = path.join(process.cwd(), file);
      if (!fs.existsSync(filePath)) return "";
      return fs.readFileSync(filePath, "utf-8");
    })
    .join("\n");

  it("does not depend on Mailpit in production code", () => {
    const mailpitPatterns = ["mailpit", "localhost:8025", "localhost:54324"];
    for (const pattern of mailpitPatterns) {
      const lowerContent = allContent.toLowerCase();
      const isInDocs = pattern.includes("54324");
      if (isInDocs) continue;
      expect(lowerContent).not.toContain(pattern.toLowerCase());
    }
  });

  it("does not require SMTP in production code", () => {
    expect(allContent.toLowerCase()).not.toContain("smtp");
  });

  it("does not require DATABASE_URL in env schema", () => {
    const envPath = path.join(process.cwd(), "src/lib/env.ts");
    const envContent = fs.readFileSync(envPath, "utf-8");
    expect(envContent).not.toContain("DATABASE_URL");
  });

  it("does not require DIRECT_URL in env schema", () => {
    const envPath = path.join(process.cwd(), "src/lib/env.ts");
    const envContent = fs.readFileSync(envPath, "utf-8");
    expect(envContent).not.toContain("DIRECT_URL");
  });

  it("does not require SERVICE_ROLE_KEY in frontend code", () => {
    expect(allContent).not.toContain("SERVICE_ROLE_KEY");
  });
});
