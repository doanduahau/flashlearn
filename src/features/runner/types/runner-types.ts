export type RunnerQuestion = {
  flashcardId: string;
  front: string;
  correctAnswer: string;
  choices: [string, string, string];
};

export type RunnerDifficulty = "easy" | "medium" | "hard";

export type RunnerDifficultyConfig = {
  lives: number;
  timePerItemMs: number;
};

export type RunnerStatus = "ready" | "playing" | "paused" | "game-over" | "completed";

export type JumpState = "grounded" | "airborne";

export type Feedback = {
  kind: "correct" | "wrong";
  questionIndex: number;
  itemSeq: number;
};

export type RunnerState = {
  status: RunnerStatus;
  questions: RunnerQuestion[];
  questionIndex: number;
  activeAnswerIndex: number | null;
  itemSeq: number;
  correctIndexes: number[];
  lives: number;
  completedCount: number;
  elapsedMs: number;
  feedback: Feedback | null;
  jumpState: JumpState;
};

export type RunnerEvent =
  | { type: "START" }
  | { type: "JUMP" }
  | { type: "LAND" }
  | { type: "PASS_ACTIVE_ITEM"; itemSeq: number }
  | { type: "HIT_ACTIVE_ITEM"; itemSeq: number }
  | { type: "TICK"; deltaMs: number }
  | { type: "PAUSE" }
  | { type: "RESUME" };
