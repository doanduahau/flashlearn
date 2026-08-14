import { describe, expect, it } from "vitest";

import {
  buildRunnerSessionHref,
  parseRunnerReplaySource,
} from "@/features/runner/utils/runner-session-url";

const SET_A = "00000000-0000-4000-8000-000000000001";
const SET_B = "00000000-0000-4000-8000-000000000002";

describe("runner session replay URL", () => {
  it("round-trips a valid regular-set source", () => {
    const source = {
      all: false,
      setIds: [SET_A, SET_B],
      collectionIds: [],
      questionCount: 18 as const,
      difficulty: "hard" as const,
    };
    const href = buildRunnerSessionHref("00000000-0000-4000-8000-000000000010", source);
    const params = Object.fromEntries(new URL(`https://flashlearn.local${href}`).searchParams);

    expect(parseRunnerReplaySource(params)).toEqual(source);
  });

  it("round-trips mixed regular and special sources", () => {
    const source = {
      all: false,
      setIds: [SET_A],
      collectionIds: [SET_B],
      questionCount: 12 as const,
      difficulty: "medium" as const,
    };
    const href = buildRunnerSessionHref("00000000-0000-4000-8000-000000000010", source);
    const params = Object.fromEntries(new URL(`https://flashlearn.local${href}`).searchParams);

    expect(parseRunnerReplaySource(params)).toEqual(source);
  });

  it("rejects replay params that mix all with sources or omit required fields", () => {
    expect(
      parseRunnerReplaySource({ all: "1", sets: SET_A, count: "12", difficulty: "medium" }),
    ).toBeNull();
    expect(parseRunnerReplaySource({ all: "1", count: "12" })).toBeNull();
    expect(parseRunnerReplaySource({ all: "0", count: "12", difficulty: "medium" })).toBeNull();
  });
});
