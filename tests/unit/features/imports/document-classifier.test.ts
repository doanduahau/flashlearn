import { describe, expect, it } from "vitest";

import {
  classifySection,
  DETERMINISTIC_CONFIDENCE_THRESHOLD,
} from "@/features/imports/utils/document-classifier";
import type { ExtractedDocumentBlock } from "@/features/imports/types/document-types";

function t(rows: string[][]): ExtractedDocumentBlock {
  return { type: "table", rows };
}

function p(text: string): ExtractedDocumentBlock {
  return { type: "paragraph", text };
}

function h(text: string, level = 1): ExtractedDocumentBlock {
  return { type: "heading", text, level };
}

describe("classifySection — deterministic", () => {
  describe("flashcard_like — high confidence, zero AI", () => {
    it("explicit Question/Answer 2-column table", () => {
      const result = classifySection({
        heading: "Quiz",
        blocks: [
          t([
            ["Question", "Answer"],
            ["CPU là gì?", "Bộ xử lý trung tâm"],
            ["RAM là gì?", "Bộ nhớ truy xuất"],
          ]),
        ],
      });
      expect(result.kind).toBe("flashcard_like");
      expect(result.confidence).toBeGreaterThanOrEqual(DETERMINISTIC_CONFIDENCE_THRESHOLD);
      expect(result.deterministic).toBe(true);
    });

    it("explicit Term/Definition table", () => {
      const result = classifySection({
        blocks: [
          t([
            ["Term", "Definition"],
            ["API", "Application Programming Interface"],
          ]),
        ],
      });
      expect(result.kind).toBe("flashcard_like");
      expect(result.confidence).toBeGreaterThanOrEqual(DETERMINISTIC_CONFIDENCE_THRESHOLD);
    });

    it("explicit Front/Back table", () => {
      const result = classifySection({
        blocks: [
          t([
            ["Front", "Back"],
            ["Hello", "Xin chào"],
          ]),
        ],
      });
      expect(result.kind).toBe("flashcard_like");
      expect(result.confidence).toBeGreaterThanOrEqual(DETERMINISTIC_CONFIDENCE_THRESHOLD);
    });

    it("headerless repeated 2-column table with many rows", () => {
      const result = classifySection({
        blocks: [
          t([
            ["CPU", "Central Processing Unit"],
            ["RAM", "Random Access Memory"],
            ["HTTP", "HyperText Transfer Protocol"],
          ]),
        ],
      });
      expect(result.kind).toBe("flashcard_like");
      expect(result.confidence).toBeGreaterThanOrEqual(DETERMINISTIC_CONFIDENCE_THRESHOLD);
      expect(result.deterministic).toBe(true);
    });
  });

  describe("prose — deterministic, zero AI", () => {
    it("multi-paragraph explanatory text", () => {
      const result = classifySection({
        blocks: [
          p(
            "Hệ điều hành là phần mềm quản lý tài nguyên phần cứng và cung cấp môi trường cho các chương trình thực thi.",
          ),
          p("Bộ lập lịch CPU quyết định tiến trình nào được sử dụng CPU tiếp theo."),
        ],
      });
      expect(result.kind).toBe("prose");
      expect(result.confidence).toBeGreaterThanOrEqual(DETERMINISTIC_CONFIDENCE_THRESHOLD);
    });

    it("single long paragraph", () => {
      const result = classifySection({
        blocks: [
          p(
            "Mạng máy tính là tập hợp các máy tính được kết nối với nhau nhằm chia sẻ tài nguyên và trao đổi thông tin.",
          ),
        ],
      });
      expect(result.kind).toBe("prose");
      expect(result.confidence).toBeGreaterThanOrEqual(DETERMINISTIC_CONFIDENCE_THRESHOLD);
    });
  });

  describe("mixed — moderate confidence", () => {
    it("table + surrounding prose", () => {
      const result = classifySection({
        heading: "OS Concepts",
        blocks: [
          p("Here are some key concepts about operating systems."),
          t([
            ["Question", "Answer"],
            ["OS là gì?", "Hệ điều hành"],
          ]),
          p("The OS manages hardware resources efficiently."),
        ],
      });
      expect(result.kind).toBe("mixed");
      expect(result.confidence).toBeLessThan(DETERMINISTIC_CONFIDENCE_THRESHOLD);
    });
  });

  describe("empty", () => {
    it("no meaningful content", () => {
      const result = classifySection({ blocks: [] });
      expect(result.kind).toBe("empty");
      expect(result.confidence).toBe(1);
    });
  });

  describe("confidence bounds", () => {
    it("all confidences are in [0, 1]", () => {
      const cases = [
        {
          heading: "Q",
          blocks: [
            t([
              ["Question", "Answer"],
              ["A", "B"],
            ]),
          ],
        },
        { blocks: [p("Just prose.")] },
        { blocks: [] },
      ];
      for (const c of cases) {
        const r = classifySection(c);
        expect(r.confidence).toBeGreaterThanOrEqual(0);
        expect(r.confidence).toBeLessThanOrEqual(1);
      }
    });
  });
});
