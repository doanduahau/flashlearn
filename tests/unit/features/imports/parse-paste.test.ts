import { describe, expect, it } from "vitest";

import { parsePaste } from "@/features/imports/utils/parse-paste";

describe("parsePaste — TSV input", () => {
  it("parses tab-separated two-column data", () => {
    const result = parsePaste("apple\tquả táo\nbanana\tquả chuối");
    expect(result.kind).toBe("structured");
    if (result.kind === "structured") {
      expect(result.cards).toHaveLength(2);
      expect(result.cards[0]?.front).toBe("apple");
      expect(result.cards[0]?.back).toBe("quả táo");
      expect(result.cards[1]?.front).toBe("banana");
      expect(result.cards[1]?.back).toBe("quả chuối");
    }
  });

  it("trims whitespace from TSV values", () => {
    const result = parsePaste("  hello  \tworld  ");
    expect(result.kind).toBe("structured");
    if (result.kind === "structured") {
      expect(result.cards[0]?.front).toBe("hello");
      expect(result.cards[0]?.back).toBe("world");
    }
  });

  it("rejects TSV rows with less than two columns", () => {
    const result = parsePaste("single\ncolumn\tonly");
    expect(result.kind).toBe("semantic_required");
  });
});

describe("parsePaste — Q:/A: pairs", () => {
  it("parses Q: and A: pairs", () => {
    const result = parsePaste("Q: HTTP là gì?\nA: HyperText Transfer Protocol");
    expect(result.kind).toBe("structured");
    if (result.kind === "structured") {
      expect(result.cards).toHaveLength(1);
      expect(result.cards[0]?.front).toBe("HTTP là gì?");
      expect(result.cards[0]?.back).toBe("HyperText Transfer Protocol");
    }
  });

  it("handles lowercase q: and a:", () => {
    const result = parsePaste("q: DNS là gì?\na: Domain Name System");
    expect(result.kind).toBe("structured");
    if (result.kind === "structured") {
      expect(result.cards[0]?.front).toBe("DNS là gì?");
      expect(result.cards[0]?.back).toBe("Domain Name System");
    }
  });

  it("strips Q:/A: prefix labels", () => {
    const result = parsePaste("Q:  CPU là gì?   \nA:  Central Processing Unit   ");
    expect(result.kind).toBe("structured");
    if (result.kind === "structured") {
      expect(result.cards[0]?.front).toBe("CPU là gì?");
      expect(result.cards[0]?.back).toBe("Central Processing Unit");
    }
  });
});

describe("parsePaste — Question:/Answer: pairs", () => {
  it("parses Question: and Answer: pairs", () => {
    const result = parsePaste("Question: Thủ đô của Việt Nam?\nAnswer: Hà Nội");
    expect(result.kind).toBe("structured");
    if (result.kind === "structured") {
      expect(result.cards[0]?.front).toBe("Thủ đô của Việt Nam?");
      expect(result.cards[0]?.back).toBe("Hà Nội");
    }
  });
});

describe("parsePaste — Term:/Definition: pairs", () => {
  it("parses Term: and Definition: pairs", () => {
    const result = parsePaste("Term: API\nDefinition: Application Programming Interface");
    expect(result.kind).toBe("structured");
    if (result.kind === "structured") {
      expect(result.cards[0]?.front).toBe("API");
      expect(result.cards[0]?.back).toBe("Application Programming Interface");
    }
  });
});

describe("parsePaste — edge cases", () => {
  it("handles CRLF newlines", () => {
    const result = parsePaste("one\ttwo\r\nthree\tfour");
    expect(result.kind).toBe("structured");
    if (result.kind === "structured") {
      expect(result.cards).toHaveLength(2);
    }
  });

  it("skips blank lines between pairs", () => {
    const result = parsePaste("Q: A?\n\nA: B");
    expect(result.kind).toBe("structured");
    if (result.kind === "structured") {
      expect(result.cards[0]?.front).toBe("A?");
      expect(result.cards[0]?.back).toBe("B");
    }
  });

  it("preserves Vietnamese Unicode", () => {
    const result = parsePaste("Q: Tại sao bầu trời màu xanh?\nA: Tán xạ Rayleigh");
    expect(result.kind).toBe("structured");
    if (result.kind === "structured") {
      expect(result.cards[0]?.front).toBe("Tại sao bầu trời màu xanh?");
      expect(result.cards[0]?.back).toBe("Tán xạ Rayleigh");
    }
  });

  it("preserves order of pairs", () => {
    const result = parsePaste("Q: First\nA: 1\nQ: Second\nA: 2\nQ: Third\nA: 3");
    expect(result.kind).toBe("structured");
    if (result.kind === "structured") {
      expect(result.cards).toHaveLength(3);
      expect(result.cards[0]?.front).toBe("First");
      expect(result.cards[2]?.front).toBe("Third");
    }
  });

  it("returns empty structured for empty input", () => {
    const result = parsePaste("");
    expect(result.kind).toBe("structured");
    if (result.kind === "structured") {
      expect(result.cards).toHaveLength(0);
    }
  });

  it("returns empty structured for whitespace-only input", () => {
    const result = parsePaste("   \n  \n   ");
    expect(result.kind).toBe("structured");
    if (result.kind === "structured") {
      expect(result.cards).toHaveLength(0);
    }
  });
});

describe("parsePaste — prose detection", () => {
  it("classifies continuous prose as semantic_required", () => {
    const prose =
      "Hệ điều hành quản lý tài nguyên phần cứng và cung cấp môi trường cho các chương trình. Một chức năng quan trọng là CPU scheduling quyết định tiến trình nào được chạy tiếp theo.";
    const result = parsePaste(prose);
    expect(result.kind).toBe("semantic_required");
  });

  it("does not falsely parse prose as pairs", () => {
    const prose =
      "Mạng máy tính là tập hợp các máy tính được kết nối với nhau nhằm chia sẻ tài nguyên. Các giao thức mạng phổ biến bao gồm TCP/IP.";
    const result = parsePaste(prose);
    expect(result.kind).toBe("semantic_required");
  });

  it("recognizes TSV even with prose-length lines", () => {
    const longValues =
      "đây là một câu hỏi rất dài để kiểm tra\tnội dung trả lời cũng rất dài không kém gì câu hỏi";
    const result = parsePaste(longValues);
    expect(result.kind).toBe("structured");
  });
});
