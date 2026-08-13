import type { QuizMode } from "@/features/quiz/schemas/quiz-schema";

export const learningFilters = ["unseen", "wrong", "random"] as const;

export type LearningFilter = (typeof learningFilters)[number];

export const LEARNING_FILTER_OPTIONS: ReadonlyArray<{
  value: LearningFilter;
  label: string;
}> = [
  { value: "unseen", label: "Chưa" },
  { value: "wrong", label: "Sai" },
  { value: "random", label: "Ngẫu nhiên" },
];

/**
 * Maps the shared three-filter UI to the existing Quiz RPC modes. "Cân bằng"
 * is no longer exposed to users, but the Quiz engine keeps its internal
 * balanced fallback ordering for the other modes.
 */
export function learningFilterToQuizMode(filter: LearningFilter): QuizMode {
  switch (filter) {
    case "unseen":
      return "never_tested";
    case "wrong":
      return "wrong_answers";
    case "random":
      return "pure_random";
  }
}

/**
 * Resolves which card ids to prioritise for Match/Memory selection.
 *
 * - "unseen" and "random" both prioritise the mode-specific uncovered ids so
 *   repeated sessions keep covering the whole pool (coverage fairness).
 * - "wrong" prioritises the canonical shared wrong-answer history.
 */
export function priorityIdsForFilter(
  filter: LearningFilter,
  uncoveredIds: ReadonlySet<string>,
  wrongIds: ReadonlySet<string>,
): ReadonlySet<string> {
  switch (filter) {
    case "unseen":
    case "random":
      return uncoveredIds;
    case "wrong":
      return wrongIds;
  }
}
