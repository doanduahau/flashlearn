export type QuizSessionOrigin = "manual" | "smart_review" | "new_cards";

export function quizSessionOrigin(value: string): QuizSessionOrigin {
  if (value === "smart_review") return "smart_review";
  if (value === "new_cards") return "new_cards";
  return "manual";
}
