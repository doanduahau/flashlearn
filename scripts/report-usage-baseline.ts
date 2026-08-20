import { createClient } from "@supabase/supabase-js";

import { env, getSupabaseServiceConfig } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

const MAX_ROWS = 10_000;

type Distribution = {
  sampledRows: number;
  totalRows: number;
  truncated: boolean;
  usersWithRows: number;
  min: number;
  median: number;
  p95: number;
  max: number;
};

function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const index = Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1);
  return values[index] ?? 0;
}

function summarizeUserRows(
  rows: Array<{ user_id: string }>,
  totalRows: number | null,
): Distribution {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);

  const values = Array.from(counts.values()).sort((a, b) => a - b);
  return {
    sampledRows: rows.length,
    totalRows: totalRows ?? rows.length,
    truncated: (totalRows ?? rows.length) > rows.length,
    usersWithRows: values.length,
    min: values[0] ?? 0,
    median: percentile(values, 0.5),
    p95: percentile(values, 0.95),
    max: values.at(-1) ?? 0,
  };
}

function assertSafeTarget(): void {
  if (env.runtimeEnvironment === "production") {
    throw new Error("Refusing to run a baseline report against production.");
  }
}

async function main(): Promise<void> {
  assertSafeTarget();
  const { url, serviceRoleKey } = getSupabaseServiceConfig();
  const supabase = createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [profiles, sets, cards] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("flashcard_sets")
      .select("user_id", { count: "exact" })
      .range(0, MAX_ROWS - 1),
    supabase
      .from("flashcards")
      .select("user_id", { count: "exact" })
      .range(0, MAX_ROWS - 1),
  ]);

  for (const result of [profiles, sets, cards]) {
    if (result.error)
      throw new Error(`Unable to build baseline: ${result.error.code ?? "query_failed"}`);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    environment: env.runtimeEnvironment ?? "unknown",
    scope: "read_only",
    sampleLimitPerTable: MAX_ROWS,
    users: { total: profiles.count ?? 0 },
    setsPerUser: summarizeUserRows(sets.data ?? [], sets.count),
    cardsPerUser: summarizeUserRows(cards.data ?? [], cards.count),
    importAndErrorSignal: {
      source: "Sentry/structured events",
      querySpec: "docs/TELEMETRY.md#baseline-queries",
      note: "No import content, filename, email, token, or raw error detail is queried or printed.",
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "baseline_report_failed";
  console.error(`Usage baseline failed: ${message}`);
  process.exitCode = 1;
});
