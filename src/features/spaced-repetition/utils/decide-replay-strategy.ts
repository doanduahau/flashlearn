import type { ReplayMode } from "@/features/spaced-repetition/types/reconciliation-types";
import type { ScheduleRow } from "@/features/spaced-repetition/server/schedule-repository";

export type ReplayDecision = {
  replayMode: ReplayMode;
  reason:
    | "no_schedule"
    | "config_mismatch"
    | "up_to_date"
    | "event_count_decreased"
    | "safe_incremental"
    | "late_or_out_of_order";
};

export function decideReplayStrategy(
  schedule: ScheduleRow | null,
  totalSchedulableCount: number,
  configMatchesCurrent: boolean,
  afterCursorCount: number,
): ReplayDecision {
  if (!schedule) {
    return { replayMode: "full", reason: "no_schedule" };
  }

  if (!configMatchesCurrent) {
    return { replayMode: "full", reason: "config_mismatch" };
  }

  if (totalSchedulableCount === schedule.processedEventCount) {
    return { replayMode: "none", reason: "up_to_date" };
  }

  if (totalSchedulableCount < schedule.processedEventCount) {
    return { replayMode: "full", reason: "event_count_decreased" };
  }

  if (schedule.processedEventCount + afterCursorCount === totalSchedulableCount) {
    return { replayMode: "incremental", reason: "safe_incremental" };
  }

  return { replayMode: "full", reason: "late_or_out_of_order" };
}
