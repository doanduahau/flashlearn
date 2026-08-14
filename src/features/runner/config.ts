import type { RunnerDifficulty, RunnerDifficultyConfig } from "./types/runner-types";

/**
 * Capy Runner - frozen difficulty configuration.
 *
 * INVARIANT - these values are product-owner frozen. Difficulty changes ONLY the
 * timing parameter (timePerItemMs) and the frozen life count. No other mechanic
 * differs (no jump height, gravity, answer count, scoring, or question rules).
 */
export const RUNNER_DIFFICULTY_CONFIGS = {
  easy: { lives: 3, timePerItemMs: 4500 },
  medium: { lives: 2, timePerItemMs: 3200 },
  hard: { lives: 1, timePerItemMs: 2400 },
} as const satisfies Record<RunnerDifficulty, RunnerDifficultyConfig>;
