import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { pathToFileURL } from "node:url";

import { loadTransitionQueue } from "../src/features/spaced-repetition/server/transition-queue";
import type { PerUserTransitionSimulation } from "../src/features/spaced-repetition/utils/transition-queue";
import type { Database } from "../src/lib/supabase/types";

import {
  ALLOWED_PRODUCTION_PROJECT_REFS,
  resolveProductionIdentity,
} from "./lib/production-identity";

type Supabase = SupabaseClient<Database>;

function formatSimulation(
  projectRef: string,
  result: { evaluationTime: string; perUser: PerUserTransitionSimulation[] },
): string {
  const lines = [
    "FSRS CUTOVER SIMULATION (READ-ONLY)",
    "",
    `Project: ${projectRef}`,
    `Evaluation time (UTC): ${result.evaluationTime}`,
    `Users: ${result.perUser.length}`,
  ];

  let totalRaw = 0;
  let totalNormal = 0;
  let totalLegacy = 0;
  let totalAnomaly = 0;

  for (const u of result.perUser) {
    totalRaw += u.rawDueTotal;
    totalNormal += u.normalDueTotal;
    totalLegacy += u.legacyDebtTotal;
    totalAnomaly += u.anomalyTotal;

    lines.push(
      "",
      `  ${u.label}:`,
      `    Raw FSRS due:       ${u.rawDueTotal}`,
      `    Normal due:         ${u.normalDueTotal}`,
      `    Legacy debt:        ${u.legacyDebtTotal}`,
      `    Anomalies:          ${u.anomalyTotal}`,
      `    Actionable now:     ${u.actionableNow}`,
      `    Normal selected:    ${u.normalSelected}`,
      `    Legacy selected:    ${u.legacySelected}`,
    );
  }

  lines.push(
    "",
    "Aggregate:",
    `  Users:              ${result.perUser.length}`,
    `  Raw due:            ${totalRaw}`,
    `  Normal due:         ${totalNormal}`,
    `  Legacy debt:        ${totalLegacy}`,
    `  Anomalies:          ${totalAnomaly}`,
    "",
    "READ-ONLY — NO WRITES PERFORMED",
  );

  return lines.join("\n");
}

async function main(): Promise<void> {
  const identity = resolveProductionIdentity(process.env, ALLOWED_PRODUCTION_PROJECT_REFS);
  const evaluationTime = new Date().toISOString();

  const client = createClient<Database>(identity.url, identity.serviceRoleKey);

  const userIds = await loadUserIds(client);
  const perUser: PerUserTransitionSimulation[] = [];

  for (let index = 0; index < userIds.length; index += 1) {
    const userId = userIds[index];
    const queue = await loadTransitionQueue(client, userId, { type: "library" }, evaluationTime);

    perUser.push({
      userId,
      label: `User ${index + 1}`,
      rawDueTotal: queue.rawDueTotal,
      normalDueTotal: queue.normalDueTotal,
      legacyDebtTotal: queue.legacyDebtTotal,
      anomalyTotal: queue.anomalyTotal,
      normalSelected: queue.normalSelected,
      legacySelected: queue.legacySelected,
      actionableNow: queue.actionableNow,
    });
  }

  console.log(formatSimulation(identity.projectRef, { evaluationTime, perUser }));
}

async function loadUserIds(client: Supabase): Promise<string[]> {
  const userIds = new Set<string>();
  let start = 0;
  while (true) {
    const { data } = await client
      .from("card_learning_schedule")
      .select("user_id")
      .range(start, start + 999);
    const page = data ?? [];
    for (const row of page as Array<{ user_id: string }>) userIds.add(row.user_id);
    if (page.length === 0) break;
    start += page.length;
  }
  return Array.from(userIds).sort();
}

function isDirectExecution(): boolean {
  if (!process.argv[1]) return false;
  return (
    process.argv[1] === import.meta.url || pathToFileURL(process.argv[1]).href === import.meta.url
  );
}

if (isDirectExecution()) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
