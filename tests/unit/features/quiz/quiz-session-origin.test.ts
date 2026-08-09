import { describe, expect, it } from "vitest";

import { quizSessionOrigin } from "@/features/quiz/utils/quiz-session-origin";

describe("quizSessionOrigin", () => {
  it("keeps the durable Smart Review origin distinct", () => {
    expect(quizSessionOrigin("smart_review")).toBe("smart_review");
  });

  it("treats historical and unknown values as the compatible manual origin", () => {
    expect(quizSessionOrigin("manual")).toBe("manual");
    expect(quizSessionOrigin("legacy")).toBe("manual");
  });
});
