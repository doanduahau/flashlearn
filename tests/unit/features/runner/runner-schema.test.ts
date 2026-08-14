import { describe, expect, it } from "vitest";

import { runnerStartSchema } from "@/features/runner/schemas/runner-schema";

const SET_ID = "aaaaaaaa-0000-4000-8000-000000000001";
const COLLECTION_ID = "bbbbbbbb-0000-4000-8000-000000000002";

function validInput() {
  return {
    all: true,
    setIds: [],
    collectionIds: [],
    questionCount: 12,
    filter: "unseen",
    difficulty: "medium",
  };
}

describe("runnerStartSchema", () => {
  it("defaults difficulty to medium and filter to unseen", () => {
    const parsed = runnerStartSchema.parse({ all: true, questionCount: 12 });
    expect(parsed.difficulty).toBe("medium");
    expect(parsed.filter).toBe("unseen");
  });

  it("accepts each difficulty value", () => {
    for (const difficulty of ["easy", "medium", "hard"]) {
      expect(runnerStartSchema.parse({ ...validInput(), difficulty }).difficulty).toBe(difficulty);
    }
  });

  it("rejects an unknown difficulty", () => {
    expect(() => runnerStartSchema.parse({ ...validInput(), difficulty: "nightmare" })).toThrow();
  });

  it("accepts only 12/18/24 question counts", () => {
    for (const count of [12, 18, 24]) {
      expect(runnerStartSchema.parse({ ...validInput(), questionCount: count }).questionCount).toBe(
        count,
      );
    }
    for (const count of [0, 10, 13, 30]) {
      expect(() => runnerStartSchema.parse({ ...validInput(), questionCount: count })).toThrow();
    }
  });

  it("rejects combining all with a source", () => {
    const result = runnerStartSchema.safeParse({
      ...validInput(),
      all: true,
      setIds: [SET_ID],
    });
    expect(result.success).toBe(false);
  });

  it("rejects mixing regular and special sources", () => {
    const result = runnerStartSchema.safeParse({
      ...validInput(),
      all: false,
      setIds: [SET_ID],
      collectionIds: [COLLECTION_ID],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty selection when not all", () => {
    const result = runnerStartSchema.safeParse({
      ...validInput(),
      all: false,
      setIds: [],
      collectionIds: [],
    });
    expect(result.success).toBe(false);
  });
});
