import { describe, expect, it } from "vitest";

import { mapRunnerSessionRows } from "@/features/runner/utils/map-runner-session-payload";

const CARD_A = "aaaaaaaa-0000-4000-8000-000000000001";
const CARD_B = "aaaaaaaa-0000-4000-8000-000000000002";

function row(overrides: Record<string, unknown> = {}) {
  return {
    flashcard_id: CARD_A,
    front: "prompt",
    correct_answer: "answer",
    choices: ["wrong-a", "wrong-b", "answer"],
    ...overrides,
  };
}

describe("mapRunnerSessionRows", () => {
  it("maps a valid row preserving the prepared choice order", () => {
    expect(mapRunnerSessionRows([row()])).toEqual([
      {
        flashcardId: CARD_A,
        front: "prompt",
        correctAnswer: "answer",
        choices: ["wrong-a", "wrong-b", "answer"],
      },
    ]);
  });

  it("maps multiple rows preserving their order", () => {
    const questions = mapRunnerSessionRows([
      row({ flashcard_id: CARD_A }),
      row({ flashcard_id: CARD_B }),
    ]);
    expect(questions.map((question) => question.flashcardId)).toEqual([CARD_A, CARD_B]);
  });

  it("rejects a row with fewer than three choices", () => {
    expect(() => mapRunnerSessionRows([row({ choices: ["a", "b"] })])).toThrow();
  });

  it("rejects a row with more than three choices", () => {
    expect(() => mapRunnerSessionRows([row({ choices: ["a", "b", "c", "d"] })])).toThrow();
  });

  it("rejects a row whose correct answer is not among the choices", () => {
    expect(() => mapRunnerSessionRows([row({ correct_answer: "missing" })])).toThrow();
  });

  it("rejects a row with non-string choices", () => {
    expect(() => mapRunnerSessionRows([row({ choices: [1, "a", "b"] })])).toThrow();
  });

  it("rejects a row missing a required field", () => {
    expect(() =>
      mapRunnerSessionRows([{ flashcard_id: CARD_A, front: "x", correct_answer: "a" }]),
    ).toThrow();
  });
});
