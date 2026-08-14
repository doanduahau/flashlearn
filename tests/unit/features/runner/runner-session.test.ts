import { describe, expect, it } from "vitest";

import type { RunnerCard } from "@/features/runner/types/runner-types";
import {
  buildRunnerSession,
  createSeededRunnerRandom,
} from "@/features/runner/utils/runner-session";

function cards(count: number): RunnerCard[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `card-${index}`,
    front: `Front ${index}`,
    back: `Back ${index}`,
  }));
}

describe("buildRunnerSession", () => {
  it("selects exactly the requested count of unique cards", () => {
    const plan = buildRunnerSession(cards(24), 12, createSeededRunnerRandom(1));
    expect(plan).not.toBeNull();
    expect(plan?.selectedCount).toBe(12);
    expect(plan?.sessionCardIds).toHaveLength(12);
    expect(new Set(plan?.sessionCardIds).size).toBe(12);
  });

  it("returns null when there are not enough cards", () => {
    expect(buildRunnerSession(cards(5), 12, createSeededRunnerRandom(1))).toBeNull();
  });

  it("is deterministic for a fixed seed", () => {
    const first = buildRunnerSession(cards(24), 12, createSeededRunnerRandom(42));
    const second = buildRunnerSession(cards(24), 12, createSeededRunnerRandom(42));
    expect(first?.sessionCardIds).toEqual(second?.sessionCardIds);
  });

  it("places priority (uncovered) cards first for the random filter", () => {
    const priority = new Set(["card-7", "card-9"]);
    const plan = buildRunnerSession(cards(24), 12, createSeededRunnerRandom(1), priority);
    expect(plan?.sessionCardIds.slice(0, 2).sort()).toEqual(["card-7", "card-9"]);
  });

  it("never mutates the input card array", () => {
    const input = cards(24);
    const snapshot = input.map((card) => ({ ...card }));
    buildRunnerSession(input, 12, createSeededRunnerRandom(1));
    expect(input).toEqual(snapshot);
  });
});
