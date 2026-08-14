import { STREAK_LEVEL_THRESHOLDS, type MascotLevel } from "../types/mascot-types";

/**
 * Maps the player's current streak to a mascot level. Levels rise at the frozen
 * streak milestones (30/60/120/240) and fall back when the streak drops.
 */
export function levelFromStreak(streak: number): MascotLevel {
  const safe = Number.isFinite(streak) && streak >= 0 ? Math.floor(streak) : 0;
  if (safe >= STREAK_LEVEL_THRESHOLDS[4]) return 5;
  if (safe >= STREAK_LEVEL_THRESHOLDS[3]) return 4;
  if (safe >= STREAK_LEVEL_THRESHOLDS[2]) return 3;
  if (safe >= STREAK_LEVEL_THRESHOLDS[1]) return 2;
  return 1;
}
