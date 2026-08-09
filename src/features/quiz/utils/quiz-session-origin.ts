export type QuizSessionOrigin = "manual" | "smart_review";

export function quizSessionOrigin(value: string): QuizSessionOrigin {
  return value === "smart_review" ? "smart_review" : "manual";
}
