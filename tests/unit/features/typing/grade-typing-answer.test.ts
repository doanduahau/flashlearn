import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { gradeTypingAnswersBatch } from "@/features/typing/server/answer-check";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("gradeTypingAnswersBatch", () => {
  it("grades every answer locally before sending only misses in one batch", async () => {
    const review = vi.fn().mockResolvedValue([{ id: B, correct: true, reason: null }]);
    const result = await gradeTypingAnswersBatch(
      [
        { id: A, userAnswer: "xin chao", correctAnswer: "xin chào" },
        { id: B, userAnswer: "bye bye", correctAnswer: "tạm biệt" },
      ],
      { review },
    );

    expect(review).toHaveBeenCalledOnce();
    expect(review).toHaveBeenCalledWith([
      { id: B, userAnswer: "bye bye", correctAnswer: "tạm biệt" },
    ]);
    expect(result.results).toEqual([
      { id: A, correct: true },
      { id: B, correct: true },
    ]);
    expect(result.reviewed).toBe(1);
  });

  it("does not call the provider when all answers match locally", async () => {
    const review = vi.fn();
    const result = await gradeTypingAnswersBatch(
      [{ id: A, userAnswer: "xin chao", correctAnswer: "xin chào" }],
      { review },
    );
    expect(review).not.toHaveBeenCalled();
    expect(result.results).toEqual([{ id: A, correct: true }]);
  });

  it("fails closed to local wrong results when the provider fails", async () => {
    const review = vi.fn().mockRejectedValue(new Error("timeout"));
    const result = await gradeTypingAnswersBatch(
      [{ id: A, userAnswer: "mèo", correctAnswer: "chó" }],
      { review },
    );
    expect(result.results).toEqual([{ id: A, correct: false }]);
    expect(result.degraded).toBe(true);
    expect(result.reviewed).toBe(0);
  });
});
