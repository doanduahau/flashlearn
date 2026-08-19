export const BACKFILL_CONFIRMATION = "BACKFILL_STARTERS";
export const MAX_BACKFILL_BATCH_SIZE = 100;
export const MAX_BACKFILL_CONCURRENCY = 5;

export type StarterBackfillOptions = {
  execute: boolean;
  batchSize: number;
  concurrency: number;
  throttleMs: number;
  checkpointPath?: string;
  resume: boolean;
  maxNewSets?: number;
  maxNewCards?: number;
  backupVerifiedAt?: Date;
};

function readPositiveInteger(args: string[], index: number, flag: string): number {
  const value = Number(args[index + 1]);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${flag} requires an integer`);
  return value;
}

export function parseStarterBackfillOptions(args: string[]): StarterBackfillOptions {
  const options: StarterBackfillOptions = {
    execute: false,
    batchSize: 25,
    concurrency: 2,
    throttleMs: 250,
    resume: false,
  };
  let confirmation: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--execute") options.execute = true;
    else if (flag === "--resume") options.resume = true;
    else if (flag === "--batch-size") options.batchSize = readPositiveInteger(args, index++, flag);
    else if (flag === "--concurrency")
      options.concurrency = readPositiveInteger(args, index++, flag);
    else if (flag === "--throttle-ms")
      options.throttleMs = readPositiveInteger(args, index++, flag);
    else if (flag === "--max-new-sets")
      options.maxNewSets = readPositiveInteger(args, index++, flag);
    else if (flag === "--max-new-cards")
      options.maxNewCards = readPositiveInteger(args, index++, flag);
    else if (flag === "--checkpoint") options.checkpointPath = args[++index];
    else if (flag === "--confirm") confirmation = args[++index];
    else if (flag === "--backup-verified-at") {
      const raw = args[++index];
      const parsed = new Date(raw ?? "");
      if (Number.isNaN(parsed.getTime())) throw new Error("--backup-verified-at requires ISO time");
      options.backupVerifiedAt = parsed;
    } else throw new Error(`Unknown argument: ${flag}`);
  }

  if (options.batchSize < 1 || options.batchSize > MAX_BACKFILL_BATCH_SIZE) {
    throw new Error(`--batch-size must be between 1 and ${MAX_BACKFILL_BATCH_SIZE}`);
  }
  if (options.concurrency < 1 || options.concurrency > MAX_BACKFILL_CONCURRENCY) {
    throw new Error(`--concurrency must be between 1 and ${MAX_BACKFILL_CONCURRENCY}`);
  }
  if (options.throttleMs > 5_000) throw new Error("--throttle-ms must be at most 5000");
  if (options.resume && !options.checkpointPath) {
    throw new Error("--resume requires --checkpoint");
  }
  if (options.execute) {
    if (confirmation !== BACKFILL_CONFIRMATION) {
      throw new Error(`--execute requires --confirm ${BACKFILL_CONFIRMATION}`);
    }
    if (!options.checkpointPath) throw new Error("--execute requires --checkpoint");
    if (options.maxNewSets === undefined || options.maxNewCards === undefined) {
      throw new Error("--execute requires --max-new-sets and --max-new-cards capacity gates");
    }
  }

  return options;
}

export function assertProductionBackup(
  environment: string | undefined,
  backupVerifiedAt: Date | undefined,
  now = new Date(),
): void {
  if (environment !== "production") return;
  if (!backupVerifiedAt) throw new Error("production execution requires --backup-verified-at");
  const ageMs = now.getTime() - backupVerifiedAt.getTime();
  if (ageMs < 0 || ageMs > 24 * 60 * 60 * 1_000) {
    throw new Error("production backup verification must be within the last 24 hours");
  }
}
