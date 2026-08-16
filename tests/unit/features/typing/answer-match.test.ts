import { describe, expect, it } from "vitest";

import {
  isAnswerCorrect,
  levenshtein,
  normalizeAnswer,
} from "@/features/typing/utils/answer-match";

describe("normalizeAnswer", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeAnswer("  Xin   chào  ")).toBe("xin chao");
  });

  it("lowercases and strips Vietnamese diacritics (including đ)", () => {
    expect(normalizeAnswer("Xin chào Việt Nam Đà Nẵng")).toBe("xin chao viet nam da nang");
  });

  it("strips punctuation from both ends of tokens", () => {
    expect(normalizeAnswer("Xin chào, bạn ơi!")).toBe("xin chao ban oi");
  });

  it("keeps digits", () => {
    expect(normalizeAnswer("Bài 2: Phần 3")).toBe("bai 2 phan 3");
  });

  it("returns empty string for blank input", () => {
    expect(normalizeAnswer("   ")).toBe("");
    expect(normalizeAnswer("")).toBe("");
  });
});

describe("levenshtein", () => {
  it("computes edit distance between two strings", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("abc", "abc")).toBe(0);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });
});

describe("isAnswerCorrect", () => {
  it("accepts an exact match", () => {
    expect(isAnswerCorrect("Xin chào", "Xin chào")).toBe(true);
  });

  it("accepts a match that only differs in diacritics", () => {
    expect(isAnswerCorrect("xin chao", "xin chào")).toBe(true);
  });

  it("accepts a match that only differs in punctuation and case", () => {
    expect(isAnswerCorrect("Xin chào!", "xin chào")).toBe(true);
  });

  it("accepts the same tokens in a different order", () => {
    expect(isAnswerCorrect("học tiếng anh", "tiếng anh học")).toBe(true);
  });

  it("rejects an answer missing a significant word", () => {
    expect(isAnswerCorrect("học tiếng anh", "cách học tiếng anh")).toBe(false);
  });

  it("rejects an answer with extra words", () => {
    expect(isAnswerCorrect("cách học tiếng anh nhanh", "học tiếng anh")).toBe(false);
  });

  it("accepts a minor spelling mistake via levenshtein", () => {
    expect(isAnswerCorrect("phương pháp họ", "phương pháp học")).toBe(true);
  });

  it("rejects a different meaning", () => {
    expect(isAnswerCorrect("con mèo", "con chó")).toBe(false);
  });

  it("rejects when both sides are empty", () => {
    expect(isAnswerCorrect("", "")).toBe(false);
  });

  it("rejects when either side is empty", () => {
    expect(isAnswerCorrect("", "câu trả lời")).toBe(false);
    expect(isAnswerCorrect("câu trả lời", "")).toBe(false);
  });

  it("accepts matching numbers", () => {
    expect(isAnswerCorrect("42", "42")).toBe(true);
  });

  it("rejects differing numbers", () => {
    expect(isAnswerCorrect("123", "1234")).toBe(false);
  });

  it("handles very short answers without false positives", () => {
    expect(isAnswerCorrect("a", "a")).toBe(true);
    expect(isAnswerCorrect("a", "b")).toBe(false);
  });
});
