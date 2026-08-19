import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  assertProductionBackup,
  parseStarterBackfillOptions,
} from "./lib/starter-backfill-options";
import { env, getSupabaseServiceConfig } from "../src/lib/env";
import type { Database } from "../src/lib/supabase/types";

type BackfillCursor = { createdAt: string; userId: string };
type BackfillCandidate = {
  user_id: string;
  user_created_at: string;
  provisioning_status: string;
  missing_starter_sets: number;
  missing_starter_cards: number;
};
type Summary = {
  eligible: number;
  alreadyComplete: number;
  created: number;
  completedUsers: number;
  partial: number;
  failed: number;
  estimatedNewSets: number;
  estimatedNewCards: number;
};
type Checkpoint = { cursor: BackfillCursor; summary: Summary; updatedAt: string };

let stopRequested = false;
process.on("SIGINT", () => {
  stopRequested = true;
});

function resolveCheckpoint(checkpointPath: string): string {
  const workspace = path.resolve(process.cwd());
  const resolved = path.resolve(workspace, checkpointPath);
  if (resolved !== workspace && !resolved.startsWith(`${workspace}${path.sep}`)) {
    throw new Error("checkpoint path must stay inside the workspace");
  }
  return resolved;
}

async function loadCheckpoint(checkpointPath: string): Promise<Checkpoint> {
  const parsed = JSON.parse(await readFile(checkpointPath, "utf8")) as Partial<Checkpoint>;
  if (!parsed.cursor?.createdAt || !parsed.cursor.userId || !parsed.summary) {
    throw new Error("invalid starter backfill checkpoint");
  }
  return parsed as Checkpoint;
}

async function saveCheckpoint(checkpointPath: string, checkpoint: Checkpoint): Promise<void> {
  await writeFile(checkpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
}

function emptySummary(): Summary {
  return {
    eligible: 0,
    alreadyComplete: 0,
    created: 0,
    completedUsers: 0,
    partial: 0,
    failed: 0,
    estimatedNewSets: 0,
    estimatedNewCards: 0,
  };
}

async function mapWithConcurrency<T>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (nextIndex < values.length) {
        const value = values[nextIndex++];
        if (value !== undefined) await worker(value);
      }
    }),
  );
}

async function main(): Promise<void> {
  const options = parseStarterBackfillOptions(process.argv.slice(2));
  assertProductionBackup(env.runtimeEnvironment, options.backupVerifiedAt);

  const checkpointPath = options.checkpointPath
    ? resolveCheckpoint(options.checkpointPath)
    : undefined;
  const checkpoint =
    options.resume && checkpointPath ? await loadCheckpoint(checkpointPath) : undefined;
  let cursor = checkpoint?.cursor;
  const summary = checkpoint?.summary ?? emptySummary();
  const startedAt = Date.now();
  let processedBatches = 0;
  const { url, serviceRoleKey } = getSupabaseServiceConfig();
  const supabase = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  while (!stopRequested) {
    const { data, error } = await supabase.rpc("get_starter_backfill_batch", {
      p_after_created_at: cursor?.createdAt,
      p_after_user_id: cursor?.userId,
      p_limit: options.batchSize,
    });
    if (error) throw new Error(`backfill_batch_failed:${error.code ?? "unknown"}`);
    const candidates = (data ?? []) as BackfillCandidate[];
    if (candidates.length === 0) break;
    processedBatches += 1;

    const batchNewSets = candidates.reduce(
      (total, candidate) => total + candidate.missing_starter_sets,
      0,
    );
    const batchNewCards = candidates.reduce(
      (total, candidate) => total + candidate.missing_starter_cards,
      0,
    );
    if (
      options.execute &&
      (summary.estimatedNewSets + batchNewSets > (options.maxNewSets ?? 0) ||
        summary.estimatedNewCards + batchNewCards > (options.maxNewCards ?? 0))
    ) {
      throw new Error("approved backfill capacity would be exceeded; stop and request approval");
    }

    summary.eligible += candidates.length;
    summary.alreadyComplete += candidates.filter(
      (candidate) => candidate.missing_starter_sets === 0,
    ).length;
    summary.estimatedNewSets += batchNewSets;
    summary.estimatedNewCards += batchNewCards;

    if (options.execute) {
      await mapWithConcurrency(candidates, options.concurrency, async (candidate) => {
        if (candidate.provisioning_status === "completed") return;
        const { data: provisioned, error: provisionError } = await supabase.rpc(
          "provision_starter_sets",
          { p_user_id: candidate.user_id },
        );
        const result = provisioned?.[0];
        if (provisionError || !result) {
          summary.failed += 1;
          console.error(
            JSON.stringify({ userId: candidate.user_id, errorCode: "starter_provision_failed" }),
          );
        } else if (result.provisioning_status === "completed") {
          summary.created += result.created_sets;
          summary.completedUsers += 1;
        } else if (result.provisioning_status === "partial") {
          summary.created += result.created_sets;
          summary.partial += 1;
        } else {
          summary.failed += 1;
        }
      });
    }

    const last = candidates.at(-1);
    if (!last) break;
    cursor = { createdAt: last.user_created_at, userId: last.user_id };
    if (options.execute && checkpointPath) {
      await saveCheckpoint(checkpointPath, {
        cursor,
        summary,
        updatedAt: new Date().toISOString(),
      });
    }
    if (candidates.length < options.batchSize) break;
    if (options.throttleMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.throttleMs));
    }
  }

  const estimatedBytes = summary.estimatedNewSets * 1_024 + summary.estimatedNewCards * 512;
  const estimatedExecutionSeconds =
    (summary.eligible * 0.25) / options.concurrency +
    Math.max(0, processedBatches - 1) * (options.throttleMs / 1_000);
  const report = {
    mode: options.execute ? "execute" : "dry-run",
    interrupted: stopRequested,
    ...summary,
    estimatedDatabaseGrowthBytes: estimatedBytes,
    estimatedDatabaseGrowthMiB: Number((estimatedBytes / 1024 / 1024).toFixed(2)),
    estimatedExecutionDurationSeconds: Number(estimatedExecutionSeconds.toFixed(2)),
    reportDurationSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(2)),
    checkpoint: options.execute ? checkpointPath : undefined,
  };
  console.log(JSON.stringify(report, null, 2));
  if (stopRequested) process.exitCode = 130;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "starter_backfill_failed";
  console.error(`Starter backfill failed: ${message}`);
  process.exitCode = 1;
});
