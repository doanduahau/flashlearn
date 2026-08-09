import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/supabase/types";
import { resolveLocalSupabaseEnv, requireLocalEndpoint } from "./lib/local-supabase-env.mjs";

// We reuse the env-helper pattern from test-e2e-local.mjs and the supabase-js
// client to interact with the local stack directly without running the Next.js
// server. The npm_execpath is required to locate supabase status.
const npmCliPath = process.env.npm_execpath;
if (!npmCliPath) throw new Error("npm_execpath is required; run via npm script.");

const CARD_BATCH_SIZE = 50;

type Supabase = SupabaseClient<Database>;

async function resolveClient(): Promise<Supabase> {
  const env = await resolveLocalSupabaseEnv(npmCliPath);
  // Re-validate through the same helper so the script fails safe on prod URLs.
  requireLocalEndpoint("NEXT_PUBLIC_SUPABASE_URL", env.supabaseUrl);
  const client = createClient<Database>(env.supabaseUrl, env.serviceRoleKey);
  return client;
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
    .or("fsrs_rating.gte.1,and,fsrs_rating.lte.4,is_correct.not.is.null")
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

async function loadUsers(client: Supabase): Promise<string[]> {
  const { data } = await client
    .from("card_review_events")
    .select("user_id")
    .or("fsrs_rating.gte.1,and,fsrs_rating.lte.4,is_correct.not.is.null")
    .order("user_id", { ascending: true });

  const ids = new Set<string>();
  for (const row of data ?? []) {
    ids.add(row.user_id);
  }
  return Array.from(ids);
}

async function reconcileCard(client: Supabase, userId: string, cardId: string): Promise<string> {
  const { reconcileCardSchedule } =
    await import("../src/features/spaced-repetition/server/reconcile-card-schedule");
  const result = await reconcileCardSchedule(client, userId, cardId);
  return result.status;
}

async function main(): Promise<void> {
  console.log("Verifying local Supabase...");
  const client = await resolveClient();
  console.log("Connected.");

  console.log("Loading users with FSRS-eligible review history...");
  const users = await loadUsers(client);
  console.log(`Found ${users.length} user(s).`);

  let scanned = 0;
  let created = 0;
  let updated = 0;
  let rebuilt = 0;
  let configMismatch = 0;
  let upToDate = 0;
  let noSchedule = 0;
  let skippedDeleted = 0;
  let failed = 0;

  for (const userId of users) {
    let afterId: string | undefined;

    while (true) {
      const cardIds = await loadActiveCardIds(client, userId, CARD_BATCH_SIZE, afterId);
      if (cardIds.length === 0) break;

      for (const cardId of cardIds) {
        scanned += 1;
        try {
          const status = await reconcileCard(client, userId, cardId);
          switch (status) {
            case "created":
              created += 1;
              break;
            case "updated":
              updated += 1;
              break;
            case "rebuilt":
              rebuilt += 1;
              break;
            case "config_mismatch_rebuilt":
              configMismatch += 1;
              break;
            case "up_to_date":
              upToDate += 1;
              break;
            case "no_schedule":
              noSchedule += 1;
              break;
            case "deleted":
              skippedDeleted += 1;
              break;
            default:
              failed += 1;
          }
        } catch {
          failed += 1;
        }
      }

      afterId = cardIds[cardIds.length - 1];

      if (scanned % 50 === 0) {
        console.log(
          `  progress: scanned=${scanned} created=${created} updated=${updated} rebuilt=${rebuilt} upToDate=${upToDate} failed=${failed}`,
        );
      }
    }
  }

  console.log("\n--- Backfill Complete ---");
  console.log(`  scanned:         ${scanned}`);
  console.log(`  created:         ${created}`);
  console.log(`  updated:         ${updated}`);
  console.log(`  rebuilt:         ${rebuilt}`);
  console.log(`  configMismatch:  ${configMismatch}`);
  console.log(`  alreadyCurrent:  ${upToDate}`);
  console.log(`  noSchedule:      ${noSchedule}`);
  console.log(`  skippedDeleted:  ${skippedDeleted}`);
  console.log(`  failed:          ${failed}`);

  if (failed > 0) {
    process.exitCode = 1;
    console.error(`\n${failed} card(s) failed reconciliation.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
