import type { RunnerDifficulty, RunnerDifficultyConfig } from "./types/runner-types";

/**
 * Capy Runner - difficulty configuration.
 *
 * Configures the timing parameter (timePerItemMs) and life count.
 */
export const RUNNER_DIFFICULTY_CONFIGS = {
  easy: { lives: 3, timePerItemMs: 3300 },
  medium: { lives: 2, timePerItemMs: 2500 },
  hard: { lives: 1, timePerItemMs: 2000 },
} as const satisfies Record<RunnerDifficulty, RunnerDifficultyConfig>;
