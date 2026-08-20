import { describe, expect, it, vi } from "vitest";

import type { DraftFlashcard } from "@/features/imports/types/import-types";
import type { FlashcardGenerationProvider } from "@/features/imports/types/import-types";
import { pasteToDraftCards } from "@/features/imports/adapters/paste-adapter";
import { validateDraftCards } from "@/features/imports/utils/validate-draft-cards";

function mockProvider(cards: DraftFlashcard[]): FlashcardGenerationProvider {
  return {
    generateCards: vi.fn().mockResolvedValue(cards),
  };
}

function failingProvider(message: string): FlashcardGenerationProvider {
  return {
    generateCards: vi.fn().mockRejectedValue(new Error(message)),
  };
}

describe("pasteToDraftCards — structured path (zero AI)", () => {
  it("processes TSV without calling AI", async () => {
    const provider = mockProvider([]);
    const result = await pasteToDraftCards("a\tb\nc\td", { provider });
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.aiUsed).toBe(false);
      expect(result.cards).toHaveLength(2);
    }
    expect(provider.generateCards).not.toHaveBeenCalled();
  });

  it("processes Q:/A: pairs without calling AI", async () => {
    const provider = mockProvider([]);
    const result = await pasteToDraftCards("Q: What?\nA: Answer", { provider });
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.aiUsed).toBe(false);
    }
    expect(provider.generateCards).not.toHaveBeenCalled();
  });

  it("returns error for empty input", async () => {
    const result = await pasteToDraftCards("", { provider: mockProvider([]) });
    expect(result.kind).toBe("error");
  });

  it("does not call provider for empty input", async () => {
    const provider = mockProvider([]);
    await pasteToDraftCards("  ", { provider });
    expect(provider.generateCards).not.toHaveBeenCalled();
  });
});

describe("pasteToDraftCards — semantic path (AI fallback)", () => {
  it("routes continuous prose to provider", async () => {
    const provider = mockProvider([{ front: "OS", back: "Quản lý tài nguyên" }]);
    const result = await pasteToDraftCards(
      "Hệ điều hành quản lý tài nguyên phần cứng và cung cấp môi trường cho các chương trình chạy trên máy tính.",
      { provider },
    );
    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.aiUsed).toBe(true);
      expect(result.cards).toHaveLength(1);
    }
    expect(provider.generateCards).toHaveBeenCalledTimes(1);
  });

  it("makes exactly one AI call per analysis", async () => {
    const provider = mockProvider([{ front: "a", back: "b" }]);
    await pasteToDraftCards(
      "Đây là một đoạn văn dài về chủ đề lập trình hướng đối tượng. OOP có bốn tính chất chính là tính đóng gói, tính kế thừa, tính đa hình và tính trừu tượng.",
      { provider },
    );
    expect(provider.generateCards).toHaveBeenCalledTimes(1);
  });

  it("handles provider failure gracefully", async () => {
    const result = await pasteToDraftCards(
      "Một đoạn văn bản dài về kiến trúc máy tính và các thành phần bên trong CPU bao gồm ALU, CU và các thanh ghi.",
      { provider: failingProvider("API error") },
    );
    expect(result.kind).toBe("error");
  });

  it("returns error when no provider configured for prose", async () => {
    const result = await pasteToDraftCards(
      "Hệ thống quản lý cơ sở dữ liệu là phần mềm giúp tổ chức và truy xuất dữ liệu hiệu quả.",
      {},
    );
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("AI");
    }
  });
});

describe("pasteToDraftCards — limits", () => {
  it("rejects content exceeding PASTE_MAX_CHARS", async () => {
    const longText = "x".repeat(200_001);
    const result = await pasteToDraftCards(longText, { provider: mockProvider([]) });
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toContain("200.000");
    }
  });
});

describe("pasteToDraftCards + validateDraftCards convergence", () => {
  it("generated cards pass through validation", () => {
    const cards: DraftFlashcard[] = [
      { front: "A", back: "B" },
      { front: "C", back: "D" },
      { front: "A", back: "B" },
    ];
    const validation = validateDraftCards(cards);
    expect(validation.valid).toBe(2);
    expect(validation.duplicate).toBe(1);
  });

  it("structured paste cards are validatable", () => {
    const cards: DraftFlashcard[] = [{ front: "test", back: "value" }];
    const validation = validateDraftCards(cards);
    expect(validation.valid).toBe(1);
    expect(validation.cards[0]?.front).toBe("test");
  });
});
