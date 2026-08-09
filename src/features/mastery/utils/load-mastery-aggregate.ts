import type { MasteryAggregate } from "@/features/mastery/utils/aggregate-mastery";
import {
  loadMasterySnapshotWithRepository,
  type MasteryScopeRepository,
} from "@/features/mastery/utils/load-mastery-snapshot";

export type { MasteryScopeRepository } from "@/features/mastery/utils/load-mastery-snapshot";

export async function loadMasteryAggregateWithRepository(
  repository: MasteryScopeRepository,
  evaluationTime: string,
): Promise<MasteryAggregate> {
  const snapshot = await loadMasterySnapshotWithRepository(repository, evaluationTime);
  return snapshot.aggregate;
}
