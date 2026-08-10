import { describe, expect, it } from "vitest";

import { quizSessionOrigin } from "@/features/quiz/utils/quiz-session-origin";

describe("quizSessionOrigin", () => {
  it("returns new_cards for 'new_cards'", () => {
    expect(quizSessionOrigin("new_cards")).toBe("new_cards");
  });

  it("returns smart_review for 'smart_review'", () => {
    expect(quizSessionOrigin("smart_review")).toBe("smart_review");
  });

  it("returns manual for 'manual'", () => {
    expect(quizSessionOrigin("manual")).toBe("manual");
  });

  it("returns manual for unknown values", () => {
    expect(quizSessionOrigin("unknown")).toBe("manual");
    expect(quizSessionOrigin("")).toBe("manual");
  });
});
