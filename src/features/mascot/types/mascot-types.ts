export type MascotLevel = 1 | 2 | 3 | 4 | 5;

export type MascotState =
  "normal" | "happy" | "sad" | "congrats" | "run" | "thinking" | "point-right";

export const STREAK_LEVEL_THRESHOLDS = [0, 30, 60, 120, 240] as const;
