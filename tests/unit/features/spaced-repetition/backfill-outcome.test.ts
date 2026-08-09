import { describe, expect, it } from "vitest";

import {
  EMPTY_BACKFILL_AGGREGATE,
  recordBackfillOutcome,
} from "@/features/spaced-repetition/types/reconciliation-types";

describe("recordBackfillOutcome", () => {
  it("starts from an all-zero aggregate", () => {
    expect(EMPTY_BACKFILL_AGGREGATE).toEqual({
      scanned: 0,
      created: 0,
      incrementallyUpdated: 0,
      rebuilt: 0,
      configMismatchRebuilt: 0,
      alreadyCurrent: 0,
      noSchedule: 0,
      skippedDeleted: 0,
      failed: 0,
    });
  });

  it("records each status into its own bucket", () => {
    let agg = EMPTY_BACKFILL_AGGREGATE;
    agg = recordBackfillOutcome(agg, "created");
    agg = recordBackfillOutcome(agg, "updated");
    agg = recordBackfillOutcome(agg, "rebuilt");
    agg = recordBackfillOutcome(agg, "config_mismatch_rebuilt");
    agg = recordBackfillOutcome(agg, "up_to_date");
    agg = recordBackfillOutcome(agg, "up_to_date");
    agg = recordBackfillOutcome(agg, "no_schedule");
    agg = recordBackfillOutcome(agg, "deleted");

    expect(agg.created).toBe(1);
    expect(agg.incrementallyUpdated).toBe(1);
    expect(agg.rebuilt).toBe(1);
    expect(agg.configMismatchRebuilt).toBe(1);
    expect(agg.alreadyCurrent).toBe(2);
    expect(agg.noSchedule).toBe(1);
    expect(agg.skippedDeleted).toBe(1);
    expect(agg.failed).toBe(0);
    expect(agg.scanned).toBe(0);
  });

  it("treats an unknown status as a failure", () => {
    const agg = recordBackfillOutcome(EMPTY_BACKFILL_AGGREGATE, "no_schedule" as never);
    // no_schedule is known; an unknown status (cast) falls through to failed
    const unknown = recordBackfillOutcome(EMPTY_BACKFILL_AGGREGATE, "bogus" as never);
    expect(agg.noSchedule).toBe(1);
    expect(unknown.failed).toBe(1);
  });

  it("is immutable on the input aggregate", () => {
    const before = { ...EMPTY_BACKFILL_AGGREGATE };
    recordBackfillOutcome(EMPTY_BACKFILL_AGGREGATE, "created");
    expect(EMPTY_BACKFILL_AGGREGATE).toEqual(before);
  });
});
