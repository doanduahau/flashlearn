import type { QuizMode } from "@/features/quiz/schemas/quiz-schema";

export const learningFilters = ["unseen", "wrong", "random"] as const;

export type LearningFilter = (typeof learningFilters)[number];

export const LEARNING_FILTER_OPTIONS: ReadonlyArray<{
  value: LearningFilter;
  label: string;
}> = [
  { value: "unseen", label: "Chưa làm" },
  { value: "wrong", label: "Câu sai" },
  { value: "random", label: "Ngẫu nhiên" },
];

/**
 * Maps the shared three-filter UI to the existing Quiz RPC modes. "Cân bằng"
 * is no longer exposed to users; the Quiz engine keeps its internal balanced
 * fallback ordering for the other modes.
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
 * The strict eligible pool for a filter, applied over the selected source
 * scope's card ids. Filters never backfill:
 *
 * - "unseen" keeps only mode-specific uncovered ids.
 * - "wrong" keeps only the canonical shared wrong-answer history.
 * - "random" keeps the whole pool (coverage fairness is applied later during
 *   selection, not by restricting the pool).
 */
export function applyLearningFilter(
  filter: LearningFilter,
  ids: readonly string[],
  uncoveredIds: ReadonlySet<string>,
  wrongIds: ReadonlySet<string>,
): string[] {
  switch (filter) {
    case "unseen":
      return ids.filter((id) => uncoveredIds.has(id));
    case "wrong":
      return ids.filter((id) => wrongIds.has(id));
    case "random":
      return [...ids];
  }
}

export function insufficientPoolMessage(filter: LearningFilter): string {
  switch (filter) {
    case "unseen":
      return "Không đủ thẻ chưa làm để bắt đầu.";
    case "wrong":
      return "Không đủ câu sai để bắt đầu.";
    case "random":
      return "Chưa đủ thẻ để bắt đầu.";
  }
}

export function emptyPoolMessage(filter: LearningFilter): string {
  switch (filter) {
    case "unseen":
      return "Chưa có thẻ chưa làm.";
    case "wrong":
      return "Chưa có câu sai.";
    case "random":
      return "Chưa có thẻ nào để kiểm tra.";
  }
}
