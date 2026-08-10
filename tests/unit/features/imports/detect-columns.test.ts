import { describe, expect, it } from "vitest";

import { detectColumns, applyMapping } from "@/features/imports/utils/detect-columns";

describe("detectColumns", () => {
  it("detects Front/Back headers", () => {
    const result = detectColumns(["Front", "Back", "Notes"]);
    expect(result.kind).toBe("mapped");
    if (result.kind === "mapped") {
      expect(result.mapping.frontColumn).toBe(0);
      expect(result.mapping.backColumn).toBe(1);
    }
  });

  it("detects Question/Answer", () => {
    const result = detectColumns(["Topic", "Question", "Answer"]);
    expect(result.kind).toBe("mapped");
    if (result.kind === "mapped") {
      expect(result.mapping.frontColumn).toBe(1);
      expect(result.mapping.backColumn).toBe(2);
    }
  });

  it("detects Q/A", () => {
    const result = detectColumns(["Q", "A"]);
    expect(result.kind).toBe("mapped");
    if (result.kind === "mapped") {
      expect(result.mapping.frontColumn).toBe(0);
      expect(result.mapping.backColumn).toBe(1);
    }
  });

  it("detects Term/Definition", () => {
    const result = detectColumns(["Term", "Definition"]);
    expect(result.kind).toBe("mapped");
    if (result.kind === "mapped") {
      expect(result.mapping.frontColumn).toBe(0);
      expect(result.mapping.backColumn).toBe(1);
    }
  });

  it("detects Vietnamese Mat truoc/Mat sau", () => {
    const result = detectColumns(["Mặt trước", "Mặt sau"]);
    expect(result.kind).toBe("mapped");
    if (result.kind === "mapped") {
      expect(result.mapping.frontColumn).toBe(0);
      expect(result.mapping.backColumn).toBe(1);
    }
  });

  it("detects Cau hoi/Cau tra loi", () => {
    const result = detectColumns(["Câu hỏi", "Câu trả lời"]);
    expect(result.kind).toBe("mapped");
    if (result.kind === "mapped") {
      expect(result.mapping.frontColumn).toBe(0);
      expect(result.mapping.backColumn).toBe(1);
    }
  });

  it("maps exactly-two columns automatically", () => {
    const result = detectColumns(["English", "Tiếng Việt"]);
    expect(result.kind).toBe("mapped");
    if (result.kind === "mapped") {
      expect(result.mapping.frontColumn).toBe(0);
      expect(result.mapping.backColumn).toBe(1);
    }
  });

  it("single column returns single_column kind", () => {
    const result = detectColumns(["Notes"]);
    expect(result.kind).toBe("single_column");
  });

  it("ambiguous returns needs_mapping kind for many columns", () => {
    const result = detectColumns(["A", "B", "C", "D", "E"]);
    expect(result.kind).toBe("ambiguous");
    if (result.kind === "ambiguous") {
      expect(result.columns).toHaveLength(5);
      expect(result.columns[0]?.index).toBe(0);
      expect(result.columns[4]?.index).toBe(4);
    }
  });

  it("detects Front/Back located after AZ (BA and BB)", () => {
    const wide = Array.from({ length: 702 }, () => "");
    wide[52] = "Front";
    wide[53] = "Back";
    const result = detectColumns(wide);
    expect(result.kind).toBe("mapped");
    if (result.kind === "mapped") {
      expect(result.mapping.frontColumn).toBe(52);
      expect(result.mapping.backColumn).toBe(53);
    }
  });

  it("detects Question/Answer located in far columns with leading empties", () => {
    const wide = Array.from({ length: 702 }, () => "");
    wide[52] = "Question";
    wide[53] = "Answer";
    wide[54] = "Notes";
    const result = detectColumns(wide);
    expect(result.kind).toBe("mapped");
    if (result.kind === "mapped") {
      expect(result.mapping.frontColumn).toBe(52);
      expect(result.mapping.backColumn).toBe(53);
    }
  });

  it("single column at far index returns that index", () => {
    const wide = Array.from({ length: 702 }, () => "");
    wide[53] = "Notes";
    const result = detectColumns(wide);
    expect(result.kind).toBe("single_column");
    if (result.kind === "single_column") {
      expect(result.columnIndex).toBe(53);
      expect(result.columnName).toBe("Notes");
    }
  });

  it("case-insensitive matching", () => {
    const result = detectColumns(["front", "BACK"]);
    expect(result.kind).toBe("mapped");
  });
});

describe("applyMapping", () => {
  it("maps all rows using column mapping", () => {
    const rows = [
      ["apple", "quả táo"],
      ["banana", "quả chuối"],
    ];
    const cards = applyMapping(rows, { frontColumn: 0, backColumn: 1 });
    expect(cards).toHaveLength(2);
    expect(cards[0]?.front).toBe("apple");
    expect(cards[0]?.back).toBe("quả táo");
    expect(cards[0]?.sourceRow).toBe(1);
  });

  it("preserves order", () => {
    const rows = [
      ["A", "1"],
      ["B", "2"],
      ["C", "3"],
    ];
    const cards = applyMapping(rows, { frontColumn: 0, backColumn: 1 });
    expect(cards).toHaveLength(3);
    expect(cards[0]?.front).toBe("A");
    expect(cards[2]?.front).toBe("C");
  });
});
