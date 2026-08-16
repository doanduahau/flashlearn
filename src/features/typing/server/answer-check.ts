import "server-only";

import { isAnswerCorrect } from "../utils/answer-match";
import { checkAnswerWithAI } from "./gemini-answer-check";

/**
 * Two-step typing grader:
 * 1. local matching (normalize + similarity) — correct answers never hit the AI;
 * 2. answers the local matcher marks WRONG are sent to the AI reviewer, which
 *    accepts them when they share the language and the meaning;
 * 3. if the AI is unavailable or misbehaves, the local result is kept (an AI
 *    failure never flips a wrong answer to correct — it stays wrong).
 */
export async function gradeTypingAnswer(
  userAnswer: string,
  correctAnswer: string,
): Promise<boolean> {
  if (isAnswerCorrect(userAnswer, correctAnswer)) return true;
  try {
    const ai = await checkAnswerWithAI({ userAnswer, correctAnswer });
    return ai.correct;
  } catch {
    return false;
  }
}
