import { describe, expect, it, vi } from "vitest";

import {
  adaptSheetData,
  semanticSheetToCards,
} from "@/features/imports/adapters/google-sheets-adapter";
import type { FlashcardGenerationProvider } from "@/features/imports/types/import-types";

describe("adaptSheetData", () => {
  it("auto-detects Front/Back and returns structured cards", () => {
    const result = adaptSheetData({
      headers: ["Front", "Back"],
      rows: [
        ["apple", "quả táo"],
        ["banana", "quả chuối"],
      ],
      rowCount: 2,
    });
    expect(result.kind).toBe("structured");
    if (result.kind === "structured") {
      expect(result.cards).toHaveLength(2);
      expect(result.cards[0]?.front).toBe("apple");
      expect(result.mapping.frontColumn).toBe(0);
      expect(result.mapping.backColumn).toBe(1);
    }
  });

  it("uses preferred mapping when provided", () => {
    const result = adaptSheetData(
      {
        headers: ["Topic", "Q", "A"],
        rows: [["1", "What is CPU?", "Central Processing Unit"]],
        rowCount: 1,
      },
      { frontColumn: 1, backColumn: 2 },
    );
    expect(result.kind).toBe("structured");
    if (result.kind === "structured") {
      expect(result.cards[0]?.front).toBe("What is CPU?");
    }
  });

  it("returns error for empty rows", () => {
    const result = adaptSheetData({
      headers: ["A", "B"],
      rows: [],
      rowCount: 0,
    });
    expect(result.kind).toBe("error");
  });

  it("detects single-column as semantic fallback", () => {
    const result = adaptSheetData({
      headers: ["Notes"],
      rows: [["CPU là bộ xử lý trung tâm"], ["RAM là bộ nhớ truy xuất ngẫu nhiên"]],
      rowCount: 2,
    });
    expect(result.kind).toBe("single_column_semantic");
    if (result.kind === "single_column_semantic") {
      expect(result.text).toContain("CPU");
      expect(result.text).toContain("RAM");
    }
  });

  it("returns needs_mapping for ambiguous columns", () => {
    const result = adaptSheetData({
      headers: ["ID", "Topic", "Question", "Answer", "Notes"],
      rows: [["1", "CS", "CPU là gì?", "Central Processing Unit", "review"]],
      rowCount: 1,
    });
    expect(result.kind).toBe("needs_mapping");
  });
});

describe("semanticSheetToCards", () => {
  it("calls provider with text and returns cards", async () => {
    const mockProvider: FlashcardGenerationProvider = {
      generateCards: vi.fn().mockResolvedValue([{ front: "Q", back: "A" }]),
    };
    const cards = await semanticSheetToCards("CPU là bộ xử lý", mockProvider);
    expect(cards).toHaveLength(1);
    expect(mockProvider.generateCards).toHaveBeenCalledTimes(1);
    expect(mockProvider.generateCards).toHaveBeenCalledWith({ text: "CPU là bộ xử lý" });
  });
});
