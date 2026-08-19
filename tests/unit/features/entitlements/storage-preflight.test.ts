import { describe, expect, it } from "vitest";

import {
  buildStoragePreflightReport,
  postgresCharacterLength,
} from "@/features/entitlements/utils/storage-preflight";

describe("storage production preflight", () => {
  it("reports Free/Pro overages and hard-length blockers without identities", () => {
    const report = buildStoragePreflightReport({
      accountCount: 4,
      usageByUser: new Map([
        ["a", { sets: 1, cards: 10, collections: 1 }],
        ["b", { sets: 21, cards: 3_001, collections: 11 }],
        ["c", { sets: 201, cards: 30_001, collections: 101 }],
      ]),
      totalSets: 223,
      totalCards: 33_012,
      totalCollections: 113,
      oversizedCardSides: 1,
      maxCardSideChars: 50_001,
    });

    expect(report.accountsWithStorage).toBe(3);
    expect(report.accountsAboveFree).toBe(2);
    expect(report.accountsAbovePro).toBe(1);
    expect(report.migrationBlockedByHardLength).toBe(true);
    expect(report.cardDistribution.max).toBe(30_001);
  });

  it("counts PostgreSQL-style Unicode characters rather than UTF-16 units", () => {
    expect("🦫".length).toBe(2);
    expect(postgresCharacterLength("A🦫B")).toBe(3);
  });
});
