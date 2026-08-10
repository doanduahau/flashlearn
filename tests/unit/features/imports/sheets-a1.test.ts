import { describe, expect, it } from "vitest";

import { buildA1Range, escapeA1SheetName } from "@/features/imports/utils/sheets-a1";

describe("escapeA1SheetName", () => {
  it("wraps a simple name in single quotes", () => {
    expect(escapeA1SheetName("Sheet1")).toBe("'Sheet1'");
  });

  it("escapes apostrophes by doubling them", () => {
    expect(escapeA1SheetName("O'Brien")).toBe("'O''Brien'");
  });

  it("handles spaces", () => {
    expect(escapeA1SheetName("Chapter 1")).toBe("'Chapter 1'");
  });

  it("handles Vietnamese Unicode", () => {
    expect(escapeA1SheetName("Bảng tính học từ vựng")).toBe("'Bảng tính học từ vựng'");
  });

  it("handles a mix of special characters", () => {
    expect(escapeA1SheetName("Từ vựng " + "Anh''Em")).toBe("'Từ vựng Anh''''Em'");
  });
});

describe("buildA1Range", () => {
  it("builds a bounded range with 2001 rows and 52 columns", () => {
    expect(buildA1Range("Sheet1", 2001, 52)).toBe("'Sheet1'!A1:AZ2001");
  });

  it("includes exactly IMPORT_MAX_ROWS + 1 rows for a 2000 limit", () => {
    expect(buildA1Range("Data", 2001, 52)).toBe("'Data'!A1:AZ2001");
  });

  it("uses a bounded row count that cannot exceed the import limit", () => {
    const range = buildA1Range("Data", 2001, 52);
    expect(range.endsWith("2001")).toBe(true);
    expect(range.includes("2002")).toBe(false);
  });

  it("escapes sheet title with spaces", () => {
    expect(buildA1Range("My Sheet", 2001, 52)).toBe("'My Sheet'!A1:AZ2001");
  });

  it("escapes sheet title with apostrophe", () => {
    expect(buildA1Range("Bob's Sheet", 2001, 52)).toBe("'Bob''s Sheet'!A1:AZ2001");
  });

  it("escapes Vietnamese sheet title", () => {
    expect(buildA1Range("Từ vựng tiếng Anh", 2001, 52)).toBe("'Từ vựng tiếng Anh'!A1:AZ2001");
  });
});
