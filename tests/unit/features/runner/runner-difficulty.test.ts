import { describe, expect, it } from "vitest";

import { RUNNER_DIFFICULTY_CONFIGS } from "@/features/runner/config";
import {
  calculateRunnerSpeed,
  getRunnerDifficultyConfig,
} from "@/features/runner/utils/runner-difficulty";

describe("runner difficulty configuration", () => {
  it("exposes the frozen lives counts", () => {
    expect(getRunnerDifficultyConfig("easy").lives).toBe(3);
    expect(getRunnerDifficultyConfig("medium").lives).toBe(2);
    expect(getRunnerDifficultyConfig("hard").lives).toBe(1);
  });

  it("exposes the frozen time-per-item values", () => {
    expect(getRunnerDifficultyConfig("easy").timePerItemMs).toBe(6000);
    expect(getRunnerDifficultyConfig("medium").timePerItemMs).toBe(4200);
    expect(getRunnerDifficultyConfig("hard").timePerItemMs).toBe(3000);
  });

  it("rejects an unknown difficulty", () => {
    expect(() => getRunnerDifficultyConfig("nightmare" as never)).toThrow();
  });

  it("keeps the frozen constants map in sync with the config accessor", () => {
    expect(RUNNER_DIFFICULTY_CONFIGS.easy).toEqual(getRunnerDifficultyConfig("easy"));
    expect(RUNNER_DIFFICULTY_CONFIGS.medium).toEqual(getRunnerDifficultyConfig("medium"));
    expect(RUNNER_DIFFICULTY_CONFIGS.hard).toEqual(getRunnerDifficultyConfig("hard"));
  });
});

describe("calculateRunnerSpeed", () => {
  it("returns distance per millisecond", () => {
    expect(calculateRunnerSpeed(1200, 6000)).toBeCloseTo(0.2, 10);
    expect(calculateRunnerSpeed(840, 4200)).toBeCloseTo(0.2, 10);
    expect(calculateRunnerSpeed(600, 3000)).toBeCloseTo(0.2, 10);
  });

  it("rejects non-positive distance", () => {
    expect(() => calculateRunnerSpeed(0, 1000)).toThrow();
    expect(() => calculateRunnerSpeed(-10, 1000)).toThrow();
  });

  it("rejects non-positive time", () => {
    expect(() => calculateRunnerSpeed(100, 0)).toThrow();
    expect(() => calculateRunnerSpeed(100, -10)).toThrow();
  });

  it("rejects non-finite dimensions", () => {
    expect(() => calculateRunnerSpeed(Number.NaN, 1000)).toThrow();
    expect(() => calculateRunnerSpeed(Number.POSITIVE_INFINITY, 1000)).toThrow();
    expect(() => calculateRunnerSpeed(100, Number.NaN)).toThrow();
    expect(() => calculateRunnerSpeed(100, Number.POSITIVE_INFINITY)).toThrow();
  });
});
