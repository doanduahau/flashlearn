import { describe, expect, it } from "vitest";

import {
  assertProductionBackup,
  parseStarterBackfillOptions,
} from "../../../scripts/lib/starter-backfill-options";

describe("starter backfill operator options", () => {
  it("defaults to a read-only dry run", () => {
    expect(parseStarterBackfillOptions([])).toMatchObject({
      execute: false,
      batchSize: 25,
      concurrency: 2,
      resume: false,
    });
  });

  it("requires explicit confirmation, checkpoint, and capacity gates for writes", () => {
    expect(() => parseStarterBackfillOptions(["--execute"])).toThrow("--confirm");
    expect(() =>
      parseStarterBackfillOptions(["--execute", "--confirm", "BACKFILL_STARTERS"]),
    ).toThrow("--checkpoint");
  });

  it("rejects unsafe batch and concurrency values", () => {
    expect(() => parseStarterBackfillOptions(["--batch-size", "101"])).toThrow("batch-size");
    expect(() => parseStarterBackfillOptions(["--concurrency", "6"])).toThrow("concurrency");
  });

  it("requires a verified production backup no older than 24 hours", () => {
    const now = new Date("2026-08-19T20:00:00Z");
    expect(() => assertProductionBackup("production", undefined, now)).toThrow("backup");
    expect(() =>
      assertProductionBackup("production", new Date("2026-08-18T19:59:59Z"), now),
    ).toThrow("24 hours");
    expect(() =>
      assertProductionBackup("production", new Date("2026-08-19T10:00:00Z"), now),
    ).not.toThrow();
  });
});
