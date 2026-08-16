import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getClaims: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getClaims: mocks.getClaims },
  }),
}));

import {
  openGoogleSheet,
  loadPrivateSheetValues,
} from "@/features/imports/server/analyze-google-sheets";
import { GOOGLE_SHEETS_HEADER_SCAN_MAX_COLUMNS, IMPORT_MAX_ROWS } from "@/lib/constants";

afterEach(() => {
  vi.clearAllMocks();
});

function okFetch(url: string) {
  mocks.fetch.mockImplementation(async (input: string) => {
    const u = String(input);
    if (u.includes(":batchGet")) {
      return {
        status: 200,
        ok: true,
        json: async () => ({
          valueRanges: [
            { range: "Sheet1!A2:A2001", values: [["B1"], ["B2"], ["B3"]] },
            { range: "Sheet1!C2:C2001", values: [["C1"], ["C2"], ["C3"]] },
          ],
        }),
      };
    }
    if (u.includes("/values/")) {
      return {
        status: 200,
        ok: true,
        json: async () => ({
          values: [
            ["Front", "Back", "Extra"],
            ["A", "B", "X"],
          ],
        }),
      };
    }
    return {
      status: 200,
      ok: true,
      json: async () => ({
        properties: { title: "Private Sheet" },
        sheets: [{ properties: { sheetId: 0, title: "Sheet1", index: 0 } }],
      }),
    };
  });
}

describe("openGoogleSheet (private flow) — header discovery", () => {
  it("requires authentication", async () => {
    mocks.getClaims.mockResolvedValue({ data: null });
    const result = await openGoogleSheet({});
    expect(result.kind).toBe("error");
  });

  it("uses the access token via Bearer header, never a browser API key", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: {} } });
    okFetch("http://x");
    vi.stubGlobal("fetch", mocks.fetch);

    const result = await openGoogleSheet({
      spreadsheetId: "abc123abc123abc123abc123abc123abc12",
      accessToken: "token-123",
      sheetIndex: 0,
    });

    expect(result.kind).toBe("success");
    const allCalls = mocks.fetch.mock.calls;
    expect(allCalls.length).toBeGreaterThan(0);
    for (const call of allCalls) {
      const [url, init] = call as [string, RequestInit];
      expect(String(url)).not.toContain("key=");
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      expect(auth).toBe(`Bearer token-123`);
    }
  });

  it("requests a header scan across the full sheet and discovery width", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: {} } });
    okFetch("http://x");
    vi.stubGlobal("fetch", mocks.fetch);

    await openGoogleSheet({
      spreadsheetId: "abc123abc123abc123abc123abc123abc12",
      accessToken: "token-123",
      sheetIndex: 0,
    });

    const headerCall = mocks.fetch.mock.calls.find((c) => String(c[0]).includes("/values/"));
    expect(headerCall).toBeTruthy();
    const url = String(headerCall?.[0]);
    const expected = encodeURIComponent(
      `A1:${colLetters(GOOGLE_SHEETS_HEADER_SCAN_MAX_COLUMNS - 1)}`,
    );
    expect(url).toContain(expected);
  });

  it("returns auth_required when no access token is provided", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: {} } });
    const result = await openGoogleSheet({
      spreadsheetId: "abc123abc123abc123abc123abc123abc12",
      sheetIndex: 0,
    });
    expect(result.kind).toBe("auth_required");
  });

  it("rejects invalid spreadsheet IDs", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: {} } });
    const result = await openGoogleSheet({
      spreadsheetId: "short",
      accessToken: "token",
      sheetIndex: 0,
    });
    expect(result.kind).toBe("error");
  });
});

describe("loadPrivateSheetValues — adaptive column body", () => {
  it("requests only the selected columns via batchGet, bounded to 2001 rows", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: {} } });
    okFetch("http://x");
    vi.stubGlobal("fetch", mocks.fetch);

    await loadPrivateSheetValues({
      spreadsheetId: "abc123abc123abc123abc123abc123abc12",
      accessToken: "token-123",
      sheetTitle: "Sheet1",
      columns: [1, 2],
    });

    const batchCall = mocks.fetch.mock.calls.find((c) => String(c[0]).includes(":batchGet"));
    expect(batchCall).toBeTruthy();
    const url = String(batchCall?.[0]);
    expect(url).toContain("ranges=");
    expect(url).toContain("Sheet1");
  });

  it("reconstructs rows from selected column bodies", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: {} } });
    okFetch("http://x");
    vi.stubGlobal("fetch", mocks.fetch);

    const result = await loadPrivateSheetValues({
      spreadsheetId: "abc123abc123abc123abc123abc123abc12",
      accessToken: "token-123",
      sheetTitle: "Sheet1",
      columns: [1, 2],
    });

    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.sheetData.rows.length).toBeLessThanOrEqual(IMPORT_MAX_ROWS);
    }
  });

  it("rejects invalid column sets", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: {} } });
    const result = await loadPrivateSheetValues({
      spreadsheetId: "abc123abc123abc123abc123abc123abc12",
      accessToken: "token-123",
      sheetTitle: "Sheet1",
      columns: [],
    });
    expect(result.kind).toBe("error");
  });

  it("rejects more than 26 columns", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: {} } });
    const result = await loadPrivateSheetValues({
      spreadsheetId: "abc123abc123abc123abc123abc123abc12",
      accessToken: "token-123",
      sheetTitle: "Sheet1",
      columns: Array.from({ length: 27 }, (_, i) => i),
    });
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
