import { describe, expect, it } from "vitest";

import {
  extractSpreadsheetId,
  isValidSheetsUrl,
} from "@/features/imports/utils/extract-spreadsheet-id";

describe("extractSpreadsheetId", () => {
  it("extracts from standard URL", () => {
    expect(
      extractSpreadsheetId(
        "https://docs.google.com/spreadsheets/d/abc123abc123abc123abc123abc123abc12/edit",
      ),
    ).toBe("abc123abc123abc123abc123abc123abc12");
  });

  it("extracts with query params", () => {
    expect(
      extractSpreadsheetId(
        "https://docs.google.com/spreadsheets/d/abc123abc123abc123abc123abc123abc12/edit?usp=sharing",
      ),
    ).toBe("abc123abc123abc123abc123abc123abc12");
  });

  it("rejects non-google URLs", () => {
    expect(extractSpreadsheetId("https://example.com/doc/123")).toBeNull();
  });

  it("rejects other Google URLs", () => {
    expect(extractSpreadsheetId("https://docs.google.com/document/d/abc123/edit")).toBeNull();
  });

  it("rejects short IDs", () => {
    expect(extractSpreadsheetId("https://docs.google.com/spreadsheets/d/short/edit")).toBeNull();
  });

  it("rejects empty string", () => {
    expect(extractSpreadsheetId("")).toBeNull();
  });
});

describe("isValidSheetsUrl", () => {
  it("returns true for valid URL", () => {
    expect(
      isValidSheetsUrl(
        "https://docs.google.com/spreadsheets/d/abc123abc123abc123abc123abc123abc12/edit",
      ),
    ).toBe(true);
  });

  it("returns false for invalid URL", () => {
    expect(isValidSheetsUrl("not-a-url")).toBe(false);
  });
});
