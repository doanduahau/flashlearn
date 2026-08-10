import { describe, expect, it } from "vitest";

import { parseColumnBodies, parseHeaderScan } from "@/features/imports/utils/sheets-parser";
import { GOOGLE_SHEETS_HEADER_SCAN_MAX_COLUMNS, IMPORT_MAX_ROWS } from "@/lib/constants";

describe("parseHeaderScan", () => {
  it("returns a fixed-width header array up to the discovery bound", () => {
    const result = parseHeaderScan({ values: [["Front", "Back"]] });
    expect(result).toHaveLength(GOOGLE_SHEETS_HEADER_SCAN_MAX_COLUMNS);
    expect(result[0]).toBe("Front");
    expect(result[1]).toBe("Back");
  });

  it("fills empty trailing columns with empty strings", () => {
    const result = parseHeaderScan({ values: [["Front", "Back"]] });
    expect(result[701]).toBe("");
  });

  it("handles missing values array", () => {
    const result = parseHeaderScan({});
    expect(result).toHaveLength(GOOGLE_SHEETS_HEADER_SCAN_MAX_COLUMNS);
    expect(result.every((cell) => cell === "")).toBe(true);
  });
});

describe("parseColumnBodies", () => {
  it("places values at their original column indices", () => {
    const result = parseColumnBodies(
      {
        valueRanges: [
          { range: "Sheet1!B2:B2001", values: [["B1"], ["B2"], ["B3"]] },
          { range: "Sheet1!D2:D2001", values: [["D1"], ["D2"], ["D3"]] },
        ],
      },
      [1, 3],
    );
    expect(result.headers[1]).toBe("B1");
    expect(result.headers[3]).toBe("D1");
    expect(result.rows[0]?.[1]).toBe("B2");
    expect(result.rows[0]?.[3]).toBe("D2");
    expect(result.rowCount).toBe(2);
  });

  it("keeps unrelated columns empty (no A:C body loaded)", () => {
    const result = parseColumnBodies(
      {
        valueRanges: [
          { range: "Sheet1!B2:B2001", values: [["H"], ["v1"]] },
          { range: "Sheet1!D2:D2001", values: [["H2"], ["v3"]] },
        ],
      },
      [1, 3],
    );
    expect(result.rows[0]?.[0]).toBe("");
    expect(result.rows[0]?.[1]).toBe("v1");
    expect(result.rows[0]?.[2]).toBe("");
    expect(result.rows[0]?.[3]).toBe("v3");
  });

  it("caps rows to the canonical import bound", () => {
    const bigValues = Array.from({ length: 5000 }, (_, i) => [`v${i}`]);
    const result = parseColumnBodies(
      {
        valueRanges: [{ range: "Sheet1!A2:A5000", values: bigValues }],
      },
      [0],
    );
    expect(result.rows.length).toBe(IMPORT_MAX_ROWS);
  });
});
