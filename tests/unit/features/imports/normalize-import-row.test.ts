import { describe, expect, it } from "vitest";

import { summarizeImport } from "@/features/imports/utils/normalize-import-row";

describe("summarizeImport", () => {
  it("normalizes Unicode and counts blank, partial, and duplicate pairs", () => {
    const summary = summarizeImport(
      [
        ["Front", "Back"],
        ["  Xin chào\r\n", " Việt Nam "],
        ["", ""],
        ["Only", ""],
        ["Xin chào\n", "Việt Nam"],
      ],
      0,
      1,
    );
    expect(summary).toMatchObject({
      valid: 1,
      blank: 1,
      partial: 1,
      duplicate: 1,
      rows: [{ front: "Xin chào", back: "Việt Nam" }],
    });
  });

  it("rejects more than 2,000 valid cards", () => {
    const rows = [
      ["Front", "Back"],
      ...Array.from({ length: 2001 }, (_, index) => [`F${index}`, `B${index}`]),
    ];
    expect(() => summarizeImport(rows, 0, 1)).toThrow("2.000");
  });
});
