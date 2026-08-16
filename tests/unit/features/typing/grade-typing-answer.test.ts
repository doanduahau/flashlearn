import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkAnswerWithAI: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/features/typing/server/gemini-answer-check", () => ({
  checkAnswerWithAI: mocks.checkAnswerWithAI,
}));

import { gradeTypingAnswer } from "@/features/typing/server/answer-check";

afterEach(() => {
  vi.clearAllMocks();
});

describe("gradeTypingAnswer — two-step grading", () => {
  it("accepts a locally correct answer and never calls the AI", async () => {
    const result = await gradeTypingAnswer("xin chao", "xin chào");

    expect(result).toBe(true);
    expect(mocks.checkAnswerWithAI).not.toHaveBeenCalled();
  });

  it("accepts an answer the AI confirms as same language and meaning", async () => {
    mocks.checkAnswerWithAI.mockResolvedValue({ correct: true, reason: null });

    const result = await gradeTypingAnswer("cách học tiếng anh", "phương pháp học tiếng Anh");

    expect(result).toBe(true);
    expect(mocks.checkAnswerWithAI).toHaveBeenCalledTimes(1);
    expect(mocks.checkAnswerWithAI).toHaveBeenCalledWith({
      userAnswer: "cách học tiếng anh",
      correctAnswer: "phương pháp học tiếng Anh",
    });
  });

  it("rejects an answer the AI says is not equivalent", async () => {
    mocks.checkAnswerWithAI.mockResolvedValue({ correct: false, reason: "Khác nghĩa" });

    const result = await gradeTypingAnswer("con mèo", "con chó");

    expect(result).toBe(false);
    expect(mocks.checkAnswerWithAI).toHaveBeenCalledTimes(1);
  });

  it("keeps the local result when the AI throws", async () => {
    mocks.checkAnswerWithAI.mockRejectedValue(new Error("AI timeout"));

    const result = await gradeTypingAnswer("con mèo", "con chó");

    expect(result).toBe(false);
    expect(mocks.checkAnswerWithAI).toHaveBeenCalledTimes(1);
  });

  it("keeps the local result when the API key is missing", async () => {
    mocks.checkAnswerWithAI.mockRejectedValue(new Error("GEMINI_API_KEY is not configured."));

    const result = await gradeTypingAnswer("con mèo", "con chó");

    expect(result).toBe(false);
  });
});
