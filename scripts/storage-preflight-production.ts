import { createClient } from "@supabase/supabase-js";

import {
  buildStoragePreflightReport,
  postgresCharacterLength,
  type UserStorageUsage,
} from "../src/features/entitlements/utils/storage-preflight";
import type { Database } from "../src/lib/supabase/types";

import {
  ALLOWED_PRODUCTION_PROJECT_REFS,
  resolveProductionIdentity,
} from "./lib/production-identity";

const PAGE_SIZE = 500;

function usageFor(map: Map<string, UserStorageUsage>, userId: string): UserStorageUsage {
  const existing = map.get(userId);
  if (existing) return existing;
  const created = { sets: 0, cards: 0, collections: 0 };
  map.set(userId, created);
  return created;
}

function formatDistribution(
  label: string,
  value: { p50: number; p90: number; p99: number; max: number },
) {
  return `${label}: p50=${value.p50}, p90=${value.p90}, p99=${value.p99}, max=${value.max}`;
}

async function main(): Promise<void> {
  const identity = resolveProductionIdentity(process.env, ALLOWED_PRODUCTION_PROJECT_REFS);
  const client = createClient<Database>(identity.url, identity.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const usageByUser = new Map<string, UserStorageUsage>();
  let accountCount = 0;
  let totalSets = 0;
  let totalCards = 0;
  let totalCollections = 0;
  let oversizedCardSides = 0;
  let maxCardSideChars = 0;

  for (let page = 1; ; page += 1) {
    const result = await client.auth.admin.listUsers({ page, perPage: 1_000 });
    if (result.error) throw new Error("failed to count production accounts");
    accountCount += result.data.users.length;
    if (result.data.users.length < 1_000) break;
  }

  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await client
      .from("flashcard_sets")
      .select("id,user_id")
      .order("id", { ascending: true })
      .range(start, start + PAGE_SIZE - 1);
    if (error) throw new Error("failed to read flashcard set usage");
    for (const row of data) {
      usageFor(usageByUser, row.user_id).sets += 1;
      totalSets += 1;
    }
    if (data.length < PAGE_SIZE) break;
  }

  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await client
      .from("flashcards")
      .select("id,user_id,front,back")
      .order("id", { ascending: true })
      .range(start, start + PAGE_SIZE - 1);
    if (error) throw new Error("failed to read flashcard usage");
    for (const row of data) {
      usageFor(usageByUser, row.user_id).cards += 1;
      totalCards += 1;
      const frontLength = postgresCharacterLength(row.front);
      const backLength = postgresCharacterLength(row.back);
      maxCardSideChars = Math.max(maxCardSideChars, frontLength, backLength);
      if (frontLength > 50_000) oversizedCardSides += 1;
      if (backLength > 50_000) oversizedCardSides += 1;
    }
    if (data.length < PAGE_SIZE) break;
  }

  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await client
      .from("special_collections")
      .select("id,user_id")
      .order("id", { ascending: true })
      .range(start, start + PAGE_SIZE - 1);
    if (error) throw new Error("failed to read collection usage");
    for (const row of data) {
      usageFor(usageByUser, row.user_id).collections += 1;
      totalCollections += 1;
    }
    if (data.length < PAGE_SIZE) break;
  }

  const report = buildStoragePreflightReport({
    accountCount,
    usageByUser,
    totalSets,
    totalCards,
    totalCollections,
    oversizedCardSides,
    maxCardSideChars,
  });

  console.log("CAPYSTUDY STORAGE PREFLIGHT — READ ONLY");
  console.log(`Project: ${identity.projectRef}`);
  console.log(`Accounts: ${report.accountCount}`);
  console.log(`Accounts with storage: ${report.accountsWithStorage}`);
  console.log(
    `Total sets/cards/collections: ${report.totalSets}/${report.totalCards}/${report.totalCollections}`,
  );
  console.log(`Accounts above Free limits: ${report.accountsAboveFree}`);
  console.log(`Accounts above Pro limits: ${report.accountsAbovePro}`);
  console.log(formatDistribution("Sets per account", report.setDistribution));
  console.log(formatDistribution("Cards per account", report.cardDistribution));
  console.log(formatDistribution("Collections per account", report.collectionDistribution));
  console.log(`Maximum card-side characters: ${report.maxCardSideChars}`);
  console.log(`Card sides above 50,000 characters: ${report.oversizedCardSides}`);
  console.log(`Estimated legacy floor rows: ${report.accountCount}`);
  console.log(
    report.migrationBlockedByHardLength
      ? "RESULT: BLOCKED — sanitize card sides above 50,000 before LP-07 migration."
      : "RESULT: READY FOR STAGING REVIEW — no 50,000-character migration blocker found.",
  );
  console.log("READ-ONLY — NO WRITES PERFORMED; no user identifiers or card content printed.");

  if (report.migrationBlockedByHardLength) process.exitCode = 2;
}

await main();
