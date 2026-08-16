import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchPublicSheetValues,
  fetchPublicSpreadsheet,
  validatePublicSpreadsheetUrl,
} from "@/features/imports/utils/public-sheets";
import { GOOGLE_SHEETS_HEADER_SCAN_MAX_COLUMNS } from "@/lib/constants";

const MOCK_API_KEY = "mock-browser-api-key";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetchResponse(status: number, json: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      status,
      json: async () => json,
    }),
  );
}

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

describe("fetchPublicSpreadsheet — browser API key header discovery", () => {
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

  it("requests a header scan bounded to one row across the discovery width", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        calls.push(String(url));
        if (String(url).includes("/values/")) {
          return {
            status: 200,
            json: async () => ({ values: [["Front", "Back"]] }),
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

    const headerUrl = calls.find((u) => u.includes("/values/"));
    expect(headerUrl).toBeTruthy();
    const expected = encodeURIComponent(
      `A1:${colLetters(GOOGLE_SHEETS_HEADER_SCAN_MAX_COLUMNS - 1)}20`,
    );
    expect(headerUrl).toContain(expected);
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
});

describe("fetchPublicSheetValues — adaptive column body", () => {
  it("requests only the selected columns via batchGet with the browser API key", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        json: async () => ({
          valueRanges: [
            { range: "Sheet1!B2:B2001", values: [["B1"], ["B2"]] },
            { range: "Sheet1!C2:C2001", values: [["C1"], ["C2"]] },
          ],
        }),
      }),
    );

    const result = await fetchPublicSheetValues(
      "abc123abc123abc123abc123abc123abc12",
      "Sheet1",
      MOCK_API_KEY,
      [1, 2],
    );

    expect(result.kind).toBe("success");
    const fetchMock = vi.mocked(fetch);
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain(":batchGet");
    expect(url).toContain(`key=${MOCK_API_KEY}`);
  });

  it("rejects invalid column sets", async () => {
    const result = await fetchPublicSheetValues(
      "abc123abc123abc123abc123abc123abc12",
      "Sheet1",
      MOCK_API_KEY,
      [],
    );
    expect(result.kind).toBe("error");
  });

  it("rejects more than 26 columns", async () => {
    const result = await fetchPublicSheetValues(
      "abc123abc123abc123abc123abc123abc12",
      "Sheet1",
      MOCK_API_KEY,
      Array.from({ length: 27 }, (_, i) => i),
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
