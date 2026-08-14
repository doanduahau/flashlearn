import { RUNNER_DIFFICULTY_CONFIGS } from "../config";
import type { RunnerDifficulty, RunnerDifficultyConfig } from "../types/runner-types";

export function getRunnerDifficultyConfig(difficulty: RunnerDifficulty): RunnerDifficultyConfig {
  const config = RUNNER_DIFFICULTY_CONFIGS[difficulty];
  if (!config) {
    throw new Error(`Unknown runner difficulty: ${String(difficulty)}`);
  }
  return config;
}

const RUNNER_DIFFICULTY_LABELS: Record<RunnerDifficulty, string> = {
  easy: "Dễ",
  medium: "Vừa",
  hard: "Khó",
};

export function runnerDifficultyLabel(difficulty: RunnerDifficulty): string {
  return RUNNER_DIFFICULTY_LABELS[difficulty];
}

/**
 * Movement speed for the active food item. The Canvas runtime later divides the
 * playable pixel distance by timePerItemMs to derive a constant px/ms speed.
 */
export function calculateRunnerSpeed(distancePx: number, timePerItemMs: number): number {
  if (!Number.isFinite(distancePx) || distancePx <= 0) {
    throw new Error("distancePx must be a positive finite number");
  }
  if (!Number.isFinite(timePerItemMs) || timePerItemMs <= 0) {
    throw new Error("timePerItemMs must be a positive finite number");
  }
  return distancePx / timePerItemMs;
}
