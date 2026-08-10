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

import { openGoogleSheet } from "@/features/imports/server/analyze-google-sheets";
import { GOOGLE_SHEETS_MAX_COLUMNS, IMPORT_MAX_ROWS } from "@/lib/constants";

afterEach(() => {
  vi.clearAllMocks();
});

function okFetch(url: string) {
  mocks.fetch.mockImplementation(async (input: string) => {
    if (String(input).includes("/values/")) {
      return {
        status: 200,
        ok: true,
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
      ok: true,
      json: async () => ({
        properties: { title: "Private Sheet" },
        sheets: [{ properties: { sheetId: 0, title: "Sheet1", index: 0 } }],
      }),
    };
  });
}

describe("openGoogleSheet (private flow)", () => {
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

  it("requests a bounded A1 range for values", async () => {
    mocks.getClaims.mockResolvedValue({ data: { claims: {} } });
    okFetch("http://x");
    vi.stubGlobal("fetch", mocks.fetch);

    await openGoogleSheet({
      spreadsheetId: "abc123abc123abc123abc123abc123abc12",
      accessToken: "token-123",
      sheetIndex: 0,
    });

    const valuesCall = mocks.fetch.mock.calls.find((c) => String(c[0]).includes("/values/"));
    expect(valuesCall).toBeTruthy();
    const url = String(valuesCall?.[0]);
    const expected = encodeURIComponent(
      `A1:${colLetters(GOOGLE_SHEETS_MAX_COLUMNS - 1)}${IMPORT_MAX_ROWS + 1}`,
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
