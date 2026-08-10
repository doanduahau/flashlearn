import { describe, expect, it } from "vitest";

import {
  buildA1Range,
  buildDataColumnRange,
  buildHeaderScanRange,
  columnIndexToLetters,
  escapeA1SheetName,
  lettersToColumnIndex,
} from "@/features/imports/utils/sheets-a1";

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
});

describe("columnIndexToLetters", () => {
  it("maps 0 to A", () => {
    expect(columnIndexToLetters(0)).toBe("A");
  });

  it("maps 25 to Z", () => {
    expect(columnIndexToLetters(25)).toBe("Z");
  });

  it("maps 26 to AA", () => {
    expect(columnIndexToLetters(26)).toBe("AA");
  });

  it("maps 51 to AZ", () => {
    expect(columnIndexToLetters(51)).toBe("AZ");
  });

  it("maps 52 to BA", () => {
    expect(columnIndexToLetters(52)).toBe("BA");
  });

  it("maps 53 to BB", () => {
    expect(columnIndexToLetters(53)).toBe("BB");
  });

  it("maps 701 to ZZ", () => {
    expect(columnIndexToLetters(701)).toBe("ZZ");
  });

  it("handles negative indices safely", () => {
    expect(columnIndexToLetters(-1)).toBe("A");
  });
});

describe("lettersToColumnIndex", () => {
  it("maps A to 0", () => {
    expect(lettersToColumnIndex("A")).toBe(0);
  });

  it("maps Z to 25", () => {
    expect(lettersToColumnIndex("Z")).toBe(25);
  });

  it("maps AA to 26", () => {
    expect(lettersToColumnIndex("AA")).toBe(26);
  });

  it("maps AZ to 51", () => {
    expect(lettersToColumnIndex("AZ")).toBe(51);
  });

  it("maps BA to 52", () => {
    expect(lettersToColumnIndex("BA")).toBe(52);
  });

  it("maps ZZ to 701", () => {
    expect(lettersToColumnIndex("ZZ")).toBe(701);
  });

  it("is case-insensitive", () => {
    expect(lettersToColumnIndex("ba")).toBe(52);
  });
});

describe("buildHeaderScanRange", () => {
  it("builds a one-row scan across the discovery width", () => {
    expect(buildHeaderScanRange("Sheet1", 702)).toBe("'Sheet1'!A1:ZZ1");
  });

  it("escapes the sheet title", () => {
    expect(buildHeaderScanRange("O'Brien", 702)).toBe("'O''Brien'!A1:ZZ1");
  });
});

describe("buildDataColumnRange", () => {
  it("builds a bounded data range starting at row 2", () => {
    expect(buildDataColumnRange("Sheet1", 1, 2000)).toBe("'Sheet1'!B2:B2001");
  });

  it("supports columns after AZ", () => {
    expect(buildDataColumnRange("Sheet1", 52, 2000)).toBe("'Sheet1'!BA2:BA2001");
  });

  it("escapes the sheet title", () => {
    expect(buildDataColumnRange("Tiếng Việt", 1, 2000)).toBe("'Tiếng Việt'!B2:B2001");
  });
});

describe("buildA1Range", () => {
  it("builds a bounded range with 2001 rows and 52 columns", () => {
    expect(buildA1Range("Sheet1", 2001, 52)).toBe("'Sheet1'!A1:AZ2001");
  });

  it("escapes sheet title with apostrophe", () => {
    expect(buildA1Range("Bob's Sheet", 2001, 52)).toBe("'Bob''s Sheet'!A1:AZ2001");
  });
});
