import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  loadMasterySnapshot,
  type MasterySnapshotScope,
} from "@/features/mastery/server/load-mastery-snapshot";
import type { MasteryAggregate } from "@/features/mastery/utils/aggregate-mastery";
import type { Database } from "@/lib/supabase/types";

type Supabase = SupabaseClient<Database>;

// Kept as a compatibility name for existing aggregate callers.
export type MasteryAggregateScope = MasterySnapshotScope;

export async function loadMasteryAggregate(
  supabase: Supabase,
  scope: MasteryAggregateScope,
  evaluationTime = new Date().toISOString(),
): Promise<MasteryAggregate> {
  const snapshot = await loadMasterySnapshot(supabase, scope, { evaluationTime });
  return snapshot.aggregate;
}
