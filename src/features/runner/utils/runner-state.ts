import type {
  Feedback,
  RunnerDifficulty,
  RunnerEvent,
  RunnerQuestion,
  RunnerState,
} from "../types/runner-types";
import { getRunnerDifficultyConfig } from "./runner-difficulty";

export function createRunnerState(
  questions: RunnerQuestion[],
  difficulty: RunnerDifficulty,
): RunnerState {
  if (questions.length === 0) {
    throw new Error("runner requires at least one question");
  }

  const { lives } = getRunnerDifficultyConfig(difficulty);

  const correctIndexes = questions.map((question) => {
    if (question.choices.length !== 3) {
      throw new Error("runner question must have exactly three choices");
    }
    const correctIndex = question.choices.indexOf(question.correctAnswer);
    if (correctIndex === -1) {
      throw new Error("runner question correct answer must be one of the choices");
    }
    return correctIndex;
  });

  return {
    status: "ready",
    questions,
    questionIndex: 0,
    activeAnswerIndex: null,
    itemSeq: 0,
    correctIndexes,
    lives,
    completedCount: 0,
    elapsedMs: 0,
    feedback: null,
    jumpState: "grounded",
  };
}

export function nextAnswerIndex(index: number): number {
  return (index + 1) % 3;
}

export function applyRunnerEvent(state: RunnerState, event: RunnerEvent): RunnerState {
  switch (event.type) {
    case "START":
      return state.status === "ready"
        ? { ...state, status: "playing", activeAnswerIndex: 0 }
        : state;
    case "JUMP":
      return state.status === "playing" && state.jumpState === "grounded"
        ? { ...state, jumpState: "airborne" }
        : state;
    case "LAND":
      return state.status === "playing" && state.jumpState === "airborne"
        ? { ...state, jumpState: "grounded" }
        : state;
    case "PASS_ACTIVE_ITEM":
      return passActiveItem(state, event.itemSeq);
    case "HIT_ACTIVE_ITEM":
      return hitActiveItem(state, event.itemSeq);
    case "TICK":
      return tick(state, event.deltaMs);
    case "PAUSE":
      return state.status === "playing" ? { ...state, status: "paused" } : state;
    case "RESUME":
      return state.status === "paused" ? { ...state, status: "playing" } : state;
  }
}

function passActiveItem(state: RunnerState, itemSeq: number): RunnerState {
  if (state.status !== "playing") return state;
  if (itemSeq !== state.itemSeq) return state;
  const active = state.activeAnswerIndex;
  if (active === null) return state;
  return {
    ...state,
    activeAnswerIndex: nextAnswerIndex(active),
    itemSeq: state.itemSeq + 1,
  };
}

function hitActiveItem(state: RunnerState, itemSeq: number): RunnerState {
  if (state.status !== "playing") return state;
  if (itemSeq !== state.itemSeq) return state;
  const active = state.activeAnswerIndex;
  if (active === null) return state;

  const correctIndex = state.correctIndexes[state.questionIndex];
  const isCorrect = active === correctIndex;
  const feedback: Feedback = {
    kind: isCorrect ? "correct" : "wrong",
    questionIndex: state.questionIndex,
    itemSeq: state.itemSeq,
  };

  if (isCorrect) {
    const completedCount = state.completedCount + 1;
    if (state.questionIndex === state.questions.length - 1) {
      return {
        ...state,
        status: "completed",
        activeAnswerIndex: null,
        completedCount,
        feedback,
      };
    }
    return {
      ...state,
      questionIndex: state.questionIndex + 1,
      activeAnswerIndex: 0,
      itemSeq: state.itemSeq + 1,
      completedCount,
      feedback,
    };
  }

  const lives = state.lives - 1;
  if (lives <= 0) {
    return {
      ...state,
      status: "game-over",
      lives: 0,
      activeAnswerIndex: null,
      feedback,
    };
  }
  return {
    ...state,
    lives,
    activeAnswerIndex: nextAnswerIndex(active),
    itemSeq: state.itemSeq + 1,
    feedback,
  };
}

function tick(state: RunnerState, deltaMs: number): RunnerState {
  if (state.status !== "playing") return state;
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return state;
  const floored = Math.floor(deltaMs);
  if (floored === 0) return state;
  return { ...state, elapsedMs: state.elapsedMs + floored };
}
