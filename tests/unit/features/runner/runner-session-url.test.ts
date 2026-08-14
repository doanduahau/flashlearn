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
      filter: "wrong" as const,
      difficulty: "hard" as const,
    };
    const href = buildRunnerSessionHref("00000000-0000-4000-8000-000000000010", source);
    const params = Object.fromEntries(new URL(`https://flashlearn.local${href}`).searchParams);

    expect(parseRunnerReplaySource(params)).toEqual(source);
  });

  it("rejects replay params that mix source areas or omit required fields", () => {
    expect(
      parseRunnerReplaySource({
        sets: SET_A,
        collections: SET_B,
        count: "12",
        filter: "unseen",
        difficulty: "medium",
      }),
    ).toBeNull();
    expect(parseRunnerReplaySource({ all: "1", count: "12" })).toBeNull();
  });
});
