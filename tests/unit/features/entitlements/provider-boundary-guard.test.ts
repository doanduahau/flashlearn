import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const SOURCE_ROOT = join(process.cwd(), "src");
const APPROVED = new Set([
  "features/imports/adapters/gemini-classifier.ts",
  "features/imports/adapters/gemini-provider.ts",
  "features/typing/server/gemini-answer-check.ts",
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("AI provider accounting boundary", () => {
  it("allows GoogleGenAI only in reviewed adapters that require a call budget", () => {
    const users = sourceFiles(SOURCE_ROOT)
      .filter((path) => readFileSync(path, "utf8").includes("GoogleGenAI"))
      .map((path) => relative(SOURCE_ROOT, path).replaceAll("\\", "/"));
    expect(new Set(users)).toEqual(APPROVED);
    for (const path of users) {
      const source = readFileSync(join(SOURCE_ROOT, path), "utf8");
      expect(source).toContain("ProviderCallBudget");
      expect(source).toContain("beforeCall");
      expect(source).toContain("afterCall");
    }
  });
});
