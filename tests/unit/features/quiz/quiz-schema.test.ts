import { describe, expect, it } from "vitest";
import { QUIZ_MAX_SOURCES, quizStartSchema } from "@/features/quiz/schemas/quiz-schema";

const ids = Array.from(
  { length: QUIZ_MAX_SOURCES + 1 },
  (_, index) => `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
);
describe("quizStartSchema", () => {
  it("requires at least one question", () =>
    expect(
      quizStartSchema.safeParse({
        all: true,
        setIds: [],
        collectionIds: [],
        mode: "balanced",
        questionCount: 0,
      }).success,
    ).toBe(false));
  it("accepts sub-10 question counts for Tất cả N", () =>
    expect(
      quizStartSchema.safeParse({
        all: true,
        setIds: [],
        collectionIds: [],
        mode: "never_tested",
        questionCount: 7,
      }).success,
    ).toBe(true));
  it("accepts every server selection mode", () =>
    ["balanced", "never_tested", "wrong_answers", "pure_random"].forEach((mode) =>
      expect(
        quizStartSchema.safeParse({
          all: true,
          setIds: [],
          collectionIds: [],
          mode,
          questionCount: 10,
        }).success,
      ).toBe(true),
    ));
  it("rejects custom sessions without sources and combined source overflow", () => {
    expect(
      quizStartSchema.safeParse({
        all: false,
        setIds: [],
        collectionIds: [],
        mode: "balanced",
        questionCount: 10,
      }).success,
    ).toBe(false);
    expect(
      quizStartSchema.safeParse({
        all: false,
        setIds: ids,
        collectionIds: [],
        mode: "balanced",
        questionCount: 10,
      }).success,
    ).toBe(false);
  });
});
