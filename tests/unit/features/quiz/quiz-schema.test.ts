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
        questionCount: 0,
      }).success,
    ).toBe(false));
  it("accepts sub-10 question counts for Tất cả N", () =>
    expect(
      quizStartSchema.safeParse({
        all: true,
        setIds: [],
        collectionIds: [],
        questionCount: 7,
      }).success,
    ).toBe(true));
  it("accepts a question count at the max", () =>
    expect(
      quizStartSchema.safeParse({
        all: true,
        setIds: [],
        collectionIds: [],
        questionCount: 100,
      }).success,
    ).toBe(true));
  it("rejects custom sessions without sources and combined source overflow", () => {
    expect(
      quizStartSchema.safeParse({
        all: false,
        setIds: [],
        collectionIds: [],
        questionCount: 10,
      }).success,
    ).toBe(false);
    expect(
      quizStartSchema.safeParse({
        all: false,
        setIds: ids,
        collectionIds: [],
        questionCount: 10,
      }).success,
    ).toBe(false);
  });
});
