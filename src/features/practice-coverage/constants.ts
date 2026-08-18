/**
 * Appearance-count mode groups (Task N17). The priority policy counts how many
 * completed sessions included a card per GROUP instead of per mode:
 *   - Kiểm tra group: quiz + match + typing (all quiz-group modes share one bucket)
 *   - Học group: memory + runner
 * (lật thẻ/study deliberately never writes coverage, so it has no bucket.)
 *
 * These live in a plain module (NOT a "use server" file, which may only export
 * async functions) so every feature can import them.
 */

/** Modes whose appearances share one "Kiểm tra" (quiz/match/typing) group bucket. */
export const QUIZ_COVERAGE_MODES = ["quiz", "match", "typing"] as const;

/** Modes whose appearances share one "Học" (memory/runner) group bucket. */
export const STUDY_COVERAGE_MODES = ["memory", "runner"] as const;

/** Every mode that writes per-card appearance counts into flashcard_coverage. */
export type CoverageMode =
  (typeof QUIZ_COVERAGE_MODES)[number] | (typeof STUDY_COVERAGE_MODES)[number];
