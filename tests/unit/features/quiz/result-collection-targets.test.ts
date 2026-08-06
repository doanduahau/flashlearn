import { describe, expect, it } from "vitest";
import { buildQuizResultCollectionTargets } from "@/features/quiz/utils/result-collection-targets";

const Q1 = "00000000-0000-0000-0000-000000000001";
const Q2 = "00000000-0000-0000-0000-000000000002";
const CARD = "00000000-0000-0000-0000-00000000000a";
const OTHER_CARD = "00000000-0000-0000-0000-00000000000b";
const SET = "00000000-0000-0000-0000-0000000000aa";
const COLLECTION = "00000000-0000-0000-0000-0000000000bb";

describe("buildQuizResultCollectionTargets", () => {
  it("creates a save target only for incorrect questions with a live flashcard", () => {
    const targets = buildQuizResultCollectionTargets({
      questions: [
        { id: Q1, is_correct: false, flashcard_id: CARD },
        { id: Q2, is_correct: true, flashcard_id: OTHER_CARD },
      ],
      collections: [{ id: COLLECTION, name: "Khó nhớ" }],
      membershipsByCard: { [CARD]: [COLLECTION] },
      setByCard: { [CARD]: SET },
    });
    expect(targets.get(Q1)).toEqual({
      kind: "save",
      questionId: Q1,
      flashcardId: CARD,
      setId: SET,
      collections: [{ id: COLLECTION, name: "Khó nhớ" }],
      memberships: [COLLECTION],
    });
    expect(targets.has(Q2)).toBe(false);
  });

  it("does not create targets for unanswered questions", () => {
    const targets = buildQuizResultCollectionTargets({
      questions: [{ id: Q1, is_correct: null, flashcard_id: CARD }],
      collections: [],
      membershipsByCard: {},
      setByCard: { [CARD]: SET },
    });
    expect(targets.has(Q1)).toBe(false);
  });

  it("marks questions whose source flashcard was deleted", () => {
    const targets = buildQuizResultCollectionTargets({
      questions: [{ id: Q1, is_correct: false, flashcard_id: null }],
      collections: [],
      membershipsByCard: {},
      setByCard: {},
    });
    expect(targets.get(Q1)).toEqual({ kind: "missing", questionId: Q1 });
  });

  it("marks incorrect questions whose flashcard set cannot be resolved", () => {
    const targets = buildQuizResultCollectionTargets({
      questions: [{ id: Q1, is_correct: false, flashcard_id: CARD }],
      collections: [],
      membershipsByCard: {},
      setByCard: {},
    });
    expect(targets.get(Q1)).toEqual({ kind: "missing", questionId: Q1 });
  });
});
