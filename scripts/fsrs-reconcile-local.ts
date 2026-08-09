import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { reconcileCardScheduleWithRepo } from "../src/features/spaced-repetition/server/reconcile-orchestrator";
import {
  buildServiceRoleRepository,
  buildServiceRoleWriter,
} from "../src/features/spaced-repetition/server/service-role-repository";
import {
  EMPTY_BACKFILL_AGGREGATE,
  recordBackfillOutcome,
  type FsrsReconciliationStatus,
} from "../src/features/spaced-repetition/types/reconciliation-types";
import { SCHEDULABLE_EVENT_OR_PREDICATE } from "../src/features/spaced-repetition/types/spaced-repetition-types";
import type { Database } from "../src/lib/supabase/types";
import { resolveLocalSupabaseEnv } from "./lib/local-supabase-env.mjs";

// Local-only safety: reuse the established local-endpoint guard. The runner
// refuses production/non-local Supabase URLs before touching anything.
const npmCliPath = process.env.npm_execpath;
if (!npmCliPath) throw new Error("npm_execpath is required; run via npm script.");

const CARD_BATCH_SIZE = 50;

type Supabase = SupabaseClient<Database>;

const SCHEDULABLE_OR = SCHEDULABLE_EVENT_OR_PREDICATE;

async function resolveClient(): Promise<Supabase> {
  const env = await resolveLocalSupabaseEnv(npmCliPath);
  const client = createClient<Database>(env.supabaseUrl, env.serviceRoleKey);
  return client;
}

async function loadUsers(client: Supabase): Promise<string[]> {
  const { data } = await client
    .from("card_review_events")
    .select("user_id")
    .or(SCHEDULABLE_OR)
    .order("user_id", { ascending: true });

  const ids = new Set<string>();
  for (const row of data ?? []) {
    ids.add(row.user_id);
  }
  return Array.from(ids);
}

async function loadActiveCardIds(
  client: Supabase,
  userId: string,
  batchSize: number,
  afterId?: string,
): Promise<string[]> {
  let query = client
    .from("card_review_events")
    .select("flashcard_id")
    .eq("user_id", userId)
    .or(SCHEDULABLE_OR)
    .order("flashcard_id", { ascending: true })
    .limit(batchSize);

  if (afterId) {
    query = query.gt("flashcard_id", afterId);
  }

  const { data } = await query;

  const ids = new Set<string>();
  for (const row of data ?? []) {
    ids.add(row.flashcard_id);
  }
  return Array.from(ids);
}

async function reconcileCard(
  client: Supabase,
  userId: string,
  cardId: string,
): Promise<FsrsReconciliationStatus> {
  const repository = buildServiceRoleRepository(client);
  const writer = buildServiceRoleWriter(client);
  const result = await reconcileCardScheduleWithRepo({ repository, writer }, userId, cardId);
  return result.status;
}

async function main(): Promise<void> {
  console.log("Verifying local Supabase...");
  const client = await resolveClient();
  console.log("Connected.");

  console.log("Loading users with FSRS-eligible review history...");
  const users = await loadUsers(client);
  console.log(`Found ${users.length} user(s).`);

  let aggregate = { ...EMPTY_BACKFILL_AGGREGATE };

  for (const userId of users) {
    let afterId: string | undefined;

    while (true) {
      const cardIds = await loadActiveCardIds(client, userId, CARD_BATCH_SIZE, afterId);
      if (cardIds.length === 0) break;

      for (const cardId of cardIds) {
        aggregate.scanned += 1;
        try {
          const status = await reconcileCard(client, userId, cardId);
          aggregate = recordBackfillOutcome(aggregate, status);
        } catch {
          aggregate.failed += 1;
        }
      }

      afterId = cardIds[cardIds.length - 1];

      if (aggregate.scanned % 50 === 0) {
        console.log(
          `  progress: scanned=${aggregate.scanned} created=${aggregate.created} updated=${aggregate.incrementallyUpdated} rebuilt=${aggregate.rebuilt} upToDate=${aggregate.alreadyCurrent} failed=${aggregate.failed}`,
        );
      }
    }
  }

  console.log("\n--- Backfill Complete ---");
  console.log(`  scanned:         ${aggregate.scanned}`);
  console.log(`  created:         ${aggregate.created}`);
  console.log(`  updated:         ${aggregate.incrementallyUpdated}`);
  console.log(`  rebuilt:         ${aggregate.rebuilt}`);
  console.log(`  configMismatch:  ${aggregate.configMismatchRebuilt}`);
  console.log(`  alreadyCurrent:  ${aggregate.alreadyCurrent}`);
  console.log(`  noSchedule:      ${aggregate.noSchedule}`);
  console.log(`  skippedDeleted:  ${aggregate.skippedDeleted}`);
  console.log(`  failed:          ${aggregate.failed}`);

  if (aggregate.failed > 0) {
    process.exitCode = 1;
    console.error(`\n${aggregate.failed} card(s) failed reconciliation.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
