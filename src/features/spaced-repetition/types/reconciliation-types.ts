export type FsrsReconciliationStatus =
  | "up_to_date"
  | "created"
  | "updated"
  | "rebuilt"
  | "no_schedule"
  | "deleted"
  | "config_mismatch_rebuilt";

export type ReplayMode = "none" | "incremental" | "full";

export type FsrsReconciliationResult = {
  status: FsrsReconciliationStatus;
  replayMode: ReplayMode;
  processedEventCount: number;
  projectionRevision: number | null;
};

export type BackfillAggregate = {
  scanned: number;
  created: number;
  incrementallyUpdated: number;
  rebuilt: number;
  configMismatchRebuilt: number;
  alreadyCurrent: number;
  noSchedule: number;
  skippedDeleted: number;
  failed: number;
};

export const EMPTY_BACKFILL_AGGREGATE: BackfillAggregate = {
  scanned: 0,
  created: 0,
  incrementallyUpdated: 0,
  rebuilt: 0,
  configMismatchRebuilt: 0,
  alreadyCurrent: 0,
  noSchedule: 0,
  skippedDeleted: 0,
  failed: 0,
};
