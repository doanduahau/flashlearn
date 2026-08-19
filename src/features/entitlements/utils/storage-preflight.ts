export type UserStorageUsage = {
  sets: number;
  cards: number;
  collections: number;
};

export type StoragePreflightInput = {
  accountCount: number;
  usageByUser: ReadonlyMap<string, UserStorageUsage>;
  totalSets: number;
  totalCards: number;
  totalCollections: number;
  oversizedCardSides: number;
  maxCardSideChars: number;
};

type Distribution = { p50: number; p90: number; p99: number; max: number };

export type StoragePreflightReport = StoragePreflightInput & {
  accountsWithStorage: number;
  accountsAboveFree: number;
  accountsAbovePro: number;
  setDistribution: Distribution;
  cardDistribution: Distribution;
  collectionDistribution: Distribution;
  migrationBlockedByHardLength: boolean;
};

function percentile(sorted: readonly number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.ceil(sorted.length * ratio) - 1] ?? 0;
}

function distribution(values: readonly number[]): Distribution {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    p99: percentile(sorted, 0.99),
    max: sorted.at(-1) ?? 0,
  };
}

export function buildStoragePreflightReport(input: StoragePreflightInput): StoragePreflightReport {
  const usages = [...input.usageByUser.values()];
  return {
    ...input,
    accountsWithStorage: usages.length,
    accountsAboveFree: usages.filter(
      (usage) => usage.sets > 20 || usage.cards > 3_000 || usage.collections > 10,
    ).length,
    accountsAbovePro: usages.filter(
      (usage) => usage.sets > 200 || usage.cards > 30_000 || usage.collections > 100,
    ).length,
    setDistribution: distribution(usages.map((usage) => usage.sets)),
    cardDistribution: distribution(usages.map((usage) => usage.cards)),
    collectionDistribution: distribution(usages.map((usage) => usage.collections)),
    migrationBlockedByHardLength: input.oversizedCardSides > 0,
  };
}

export function postgresCharacterLength(value: string): number {
  return [...value].length;
}
