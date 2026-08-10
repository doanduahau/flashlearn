import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchPublicSpreadsheet,
  parseSheetValues,
  validatePublicSpreadsheetUrl,
} from "@/features/imports/utils/public-sheets";
import { GOOGLE_SHEETS_MAX_COLUMNS, IMPORT_MAX_ROWS } from "@/lib/constants";

const MOCK_API_KEY = "mock-browser-api-key";

function mockFetchResponse(status: number, json: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      status,
      json: async () => json,
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("validatePublicSpreadsheetUrl", () => {
  it("accepts a valid Google Sheets URL", () => {
    const result = validatePublicSpreadsheetUrl(
      "https://docs.google.com/spreadsheets/d/abc123abc123abc123abc123abc123abc12/edit",
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.spreadsheetId).toBe("abc123abc123abc123abc123abc123abc12");
  });

  it("rejects malformed URLs", () => {
    expect(validatePublicSpreadsheetUrl("not-a-url").ok).toBe(false);
  });

  it("rejects non-Google URLs", () => {
    expect(validatePublicSpreadsheetUrl("https://example.com/x").ok).toBe(false);
  });

  it("rejects other Google document types", () => {
    expect(
      validatePublicSpreadsheetUrl(
        "https://docs.google.com/document/d/abc123abc123abc123abc123abc123abc12/edit",
      ).ok,
    ).toBe(false);
  });
});

describe("fetchPublicSpreadsheet — browser API key path", () => {
  it("uses the browser API key in the query string (referrer-restricted path)", async () => {
    mockFetchResponse(200, {
      properties: { title: "Test Sheet" },
      sheets: [{ properties: { sheetId: 0, title: "Sheet1", index: 0 } }],
    });

    await fetchPublicSpreadsheet(
      "https://docs.google.com/spreadsheets/d/abc123abc123abc123abc123abc123abc12/edit",
      MOCK_API_KEY,
    );

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(firstUrl).toContain(`key=${MOCK_API_KEY}`);
    expect(firstUrl).toContain("sheets.googleapis.com");
  });

  it("requests a bounded A1 range for values, not the full sheet", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        calls.push(String(url));
        if (String(url).includes("/values/")) {
          return {
            status: 200,
            json: async () => ({
              values: [
                ["Front", "Back"],
                ["A", "B"],
              ],
            }),
          };
        }
        return {
          status: 200,
          json: async () => ({
            properties: { title: "Test Sheet" },
            sheets: [{ properties: { sheetId: 0, title: "Sheet1", index: 0 } }],
          }),
        };
      }),
    );

    await fetchPublicSpreadsheet(
      "https://docs.google.com/spreadsheets/d/abc123abc123abc123abc123abc123abc12/edit",
      MOCK_API_KEY,
    );

    const valuesUrl = calls.find((u) => u.includes("/values/"));
    expect(valuesUrl).toBeTruthy();
    const expected = encodeURIComponent(
      `A1:${colLetters(GOOGLE_SHEETS_MAX_COLUMNS - 1)}${IMPORT_MAX_ROWS + 1}`,
    );
    expect(valuesUrl).toContain(expected);
  });

  it("returns auth_required when public access is denied (private sheet)", async () => {
    mockFetchResponse(403, { error: { message: "Forbidden" } });

    const result = await fetchPublicSpreadsheet(
      "https://docs.google.com/spreadsheets/d/abc123abc123abc123abc123abc123abc12/edit",
      MOCK_API_KEY,
    );
    expect(result.kind).toBe("auth_required");
  });

  it("returns error for malformed URL without calling Google", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPublicSpreadsheet("https://bad.example.com/x", MOCK_API_KEY);
    expect(result.kind).toBe("error");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns error when the spreadsheet is not found", async () => {
    mockFetchResponse(404, { error: { message: "Not Found" } });
    const result = await fetchPublicSpreadsheet(
      "https://docs.google.com/spreadsheets/d/abc123abc123abc123abc123abc123abc12/edit",
      MOCK_API_KEY,
    );
    expect(result.kind).toBe("error");
  });
});

function colLetters(index: number): string {
  let result = "";
  let n = index + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    result = String.fromCharCode(65 + r) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

describe("parseSheetValues", () => {
  it("caps rows to IMPORT_MAX_ROWS + 1 at parse time", () => {
    const bigRows = Array.from({ length: 5000 }, (_, i) => [`front${i}`, `back${i}`]);
    const result = parseSheetValues({ values: bigRows }, "Sheet1");
    expect(result.rows.length).toBeLessThanOrEqual(IMPORT_MAX_ROWS + 1);
    expect(result.rowCount).toBe(4999);
  });

  it("treats first row as headers", () => {
    const result = parseSheetValues(
      {
        values: [
          ["Front", "Back"],
          ["A", "B"],
        ],
      },
      "Sheet1",
    );
    expect(result.headers).toEqual(["Front", "Back"]);
    expect(result.rows).toEqual([["A", "B"]]);
  });
});
