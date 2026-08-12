import { describe, expect, it } from "vitest";

import { matchStartSchema } from "@/features/match/schemas/match-schema";
import { quizStartSchema } from "@/features/quiz/schemas/quiz-schema";

const REGULAR = "11111111-1111-4111-8111-111111111111";
const SPECIAL = "22222222-2222-4222-8222-222222222222";

describe("coverage source-selection boundary", () => {
  it("accepts same-area multi-select and rejects cross-area mixing for Match", () => {
    expect(
      matchStartSchema.safeParse({
        all: false,
        setIds: [REGULAR],
        collectionIds: [],
        questionCount: 12,
      }).success,
    ).toBe(true);
    expect(
      matchStartSchema.safeParse({
        all: false,
        setIds: [REGULAR],
        collectionIds: [SPECIAL],
        questionCount: 12,
      }).success,
    ).toBe(false);
  });

  it("keeps All exclusive and rejects cross-area mixing for traditional Quiz", () => {
    expect(
      quizStartSchema.safeParse({
        all: true,
        setIds: [REGULAR],
        collectionIds: [],
        mode: "balanced",
        questionCount: 10,
      }).success,
    ).toBe(false);
    expect(
      quizStartSchema.safeParse({
        all: false,
        setIds: [REGULAR],
        collectionIds: [SPECIAL],
        mode: "balanced",
        questionCount: 10,
      }).success,
    ).toBe(false);
  });
});
