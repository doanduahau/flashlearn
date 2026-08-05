import { describe, expect, it } from "vitest";
import { utils, write } from "xlsx";

import { parseWorkbook, validateImportFile } from "@/features/imports/utils/parse-workbook";

function browserFile(name: string, bytes: Uint8Array): File {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const file = new File([copy.buffer], name);
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  });
  return file;
}

describe("parseWorkbook", () => {
  it("reads CSV text in browser memory", async () => {
    const file = browserFile("cards.csv", new TextEncoder().encode("Front,Back\nXin chào,Hello"));
    await expect(parseWorkbook(file)).resolves.toEqual([
      {
        name: "Sheet1",
        rows: [
          ["Front", "Back"],
          ["Xin chào", "Hello"],
        ],
      },
    ]);
  });

  it("reads all XLSX worksheets in browser memory", async () => {
    const workbook = utils.book_new();
    utils.book_append_sheet(
      workbook,
      utils.aoa_to_sheet([
        ["A", "B"],
        ["1", "2"],
      ]),
      "First",
    );
    utils.book_append_sheet(
      workbook,
      utils.aoa_to_sheet([
        ["Front", "Back"],
        ["Cảm ơn", "Thanks"],
      ]),
      "Vietnamese",
    );
    const bytes = write(workbook, { type: "array", bookType: "xlsx" });
    const sheets = await parseWorkbook(browserFile("cards.xlsx", new Uint8Array(bytes)));
    expect(sheets.map(({ name }) => name)).toEqual(["First", "Vietnamese"]);
    expect(sheets[1]?.rows[1]).toEqual(["Cảm ơn", "Thanks"]);
  });

  it("rejects unsupported and oversized files before parsing", () => {
    expect(validateImportFile(browserFile("cards.txt", new Uint8Array()))).toMatch(/xlsx.*csv/i);
    const oversized = new File([], "cards.csv");
    Object.defineProperty(oversized, "size", { value: 5 * 1024 * 1024 + 1 });
    expect(validateImportFile(oversized)).toMatch(/5 MB/);
  });
});
