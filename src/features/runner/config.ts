import type { RunnerDifficulty, RunnerDifficultyConfig } from "./types/runner-types";

/**
 * Capy Runner - difficulty configuration.
 *
 * Configures the timing parameter (timePerItemMs) and life count.
 */
export const RUNNER_DIFFICULTY_CONFIGS = {
  easy: { lives: 3, timePerItemMs: 2500 },
  medium: { lives: 2, timePerItemMs: 1800 },
  hard: { lives: 1, timePerItemMs: 1400 },
} as const satisfies Record<RunnerDifficulty, RunnerDifficultyConfig>;
