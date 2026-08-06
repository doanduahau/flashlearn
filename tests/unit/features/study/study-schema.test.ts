import { describe, expect, it } from "vitest";

import { parseStudySessionParams, studySourceSchema } from "@/features/study/schemas/study-schema";
import { STUDY_MAX_SOURCES } from "@/lib/constants";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";
const UUID_C = "33333333-3333-4333-8333-333333333333";

function uuidList(count: number): string[] {
  return Array.from(
    { length: count },
    (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  );
}

describe("studySourceSchema", () => {
  it("accepts valid set and collection ids", () => {
    const result = studySourceSchema.safeParse({ setIds: [UUID_A], collectionIds: [UUID_B] });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.setIds).toEqual([UUID_A]);
      expect(result.data.collectionIds).toEqual([UUID_B]);
    }
  });

  it("defaults to empty arrays when fields are missing", () => {
    const result = studySourceSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.setIds).toEqual([]);
      expect(result.data.collectionIds).toEqual([]);
    }
  });

  it("rejects an invalid set or collection id", () => {
    expect(studySourceSchema.safeParse({ setIds: ["nope"] }).success).toBe(false);
    expect(studySourceSchema.safeParse({ collectionIds: ["nope"] }).success).toBe(false);
  });

  it("rejects more than the source limit in one list", () => {
    expect(studySourceSchema.safeParse({ setIds: uuidList(STUDY_MAX_SOURCES + 1) }).success).toBe(
      false,
    );
    expect(studySourceSchema.safeParse({ setIds: uuidList(STUDY_MAX_SOURCES) }).success).toBe(true);
  });
});

describe("parseStudySessionParams", () => {
  it("parses comma-separated set and collection ids", () => {
    const result = parseStudySessionParams({
      sets: `${UUID_A},${UUID_B}`,
      collections: UUID_C,
    });
    expect(result).toEqual({
      all: false,
      setIds: [UUID_A, UUID_B],
      collectionIds: [UUID_C],
      seed: undefined,
    });
  });

  it("parses repeated array params and trims whitespace", () => {
    const result = parseStudySessionParams({ sets: [` ${UUID_A} `, UUID_B] });
    expect(result?.setIds).toEqual([UUID_A, UUID_B]);
  });

  it("parses the all-cards flag", () => {
    const result = parseStudySessionParams({ all: "1" });
    expect(result).toEqual({ all: true, setIds: [], collectionIds: [], seed: undefined });
  });

  it("parses a valid shuffle seed", () => {
    const result = parseStudySessionParams({ all: "1", seed: "123456" });
    expect(result?.seed).toBe(123456);
  });

  it("rejects empty params with no source", () => {
    expect(parseStudySessionParams({})).toBeNull();
    expect(parseStudySessionParams({ sets: "" })).toBeNull();
  });

  it("rejects an invalid uuid in the source lists", () => {
    expect(parseStudySessionParams({ sets: "not-a-uuid" })).toBeNull();
    expect(parseStudySessionParams({ collections: "not-a-uuid" })).toBeNull();
  });

  it("rejects an invalid seed", () => {
    expect(parseStudySessionParams({ all: "1", seed: "abc" })).toBeNull();
    expect(parseStudySessionParams({ all: "1", seed: "-1" })).toBeNull();
    expect(parseStudySessionParams({ all: "1", seed: "1.5" })).toBeNull();
  });

  it("rejects source lists longer than the limit", () => {
    expect(parseStudySessionParams({ sets: uuidList(STUDY_MAX_SOURCES + 1).join(",") })).toBeNull();
  });
});
