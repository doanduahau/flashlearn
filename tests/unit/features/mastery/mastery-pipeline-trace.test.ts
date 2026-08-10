import { describe, expect, it } from "vitest";

import {
  buildMasteryMap,
  runMasteryPipelineTrace,
  type ProductionDiagnosticDataAccess,
} from "@/features/spaced-repetition/utils/run-production-diagnostic";
import {
  crossTabMastery,
  type FsrsOnlyCardDetail,
} from "@/features/spaced-repetition/utils/diagnose-due-divergence";
import type {
  CardReviewEventRow,
  MasteryPipelineTrace,
} from "@/features/mastery/types/mastery-types";
import { loadMasterySnapshotWithRepository } from "@/features/mastery/utils/load-mastery-snapshot";

const NOW = "2026-08-10T12:00:00.000Z";

class Repository {
  constructor(
    private readonly scopedCardIds: string[],
    private readonly activeCardIds: string[],
    private readonly events: CardReviewEventRow[],
  ) {}

  async findActiveCardIdsInScope(): Promise<string[]> {
    return [...this.scopedCardIds];
  }

  async findActiveCardIds(cardIds: readonly string[]): Promise<string[]> {
    return this.activeCardIds.filter((id) => cardIds.includes(id));
  }

  async findReviewEvents(cardIds: readonly string[]): Promise<CardReviewEventRow[]> {
    return this.events.filter((event) => cardIds.includes(event.flashcardId));
  }
}

function fsrsDetail(flashcardId: string): FsrsOnlyCardDetail {
  return {
    flashcardId,
    state: 2,
    due: NOW,
    lastReview: NOW,
    scheduledDays: 1,
    processedEventCount: 1,
    learningSteps: 0,
    algorithm: "fsrs-6",
    implementation: "ts-fsrs@5.4.1",
    parameterSet: "flashlearn-v1",
    lastEventFsrsRating: 3,
    lastEventIsCorrect: true,
  };
}

describe("Mastery pipeline instrumentation", () => {
  it("uses the real snapshot, map, and cross-tab key chain without candidate-limit truncation", async () => {
    const targetCardIds = ["target-a", "target-b"];
    const pipelineTrace: MasteryPipelineTrace = {
      scopedCardIds: [],
      requestedCardIds: [],
      activeCardIds: [],
      reviewEventCardIds: [],
      derivedMasteryCardIds: [],
      returnedMasteryCardIds: [],
      snapshotMasteryCardIds: [],
    };
    const snapshot = await loadMasterySnapshotWithRepository(
      new Repository(targetCardIds, targetCardIds, [
        { flashcardId: "target-a", isCorrect: false, reviewedAt: NOW },
        { flashcardId: "target-b", isCorrect: true, reviewedAt: NOW },
      ]),
      NOW,
      1,
      pipelineTrace,
    );

    const masteryMap = buildMasteryMap(snapshot);
    for (const targetCardId of targetCardIds) {
      expect(masteryMap.has(targetCardId)).toBe(true);
      expect(masteryMap.get(targetCardId)?.flashcardId).toBe(targetCardId);
    }
    expect(crossTabMastery(targetCardIds.map(fsrsDetail), masteryMap)).toMatchObject({
      review: 1,
      learning: 1,
      untested: 0,
    });

    expect(snapshot.masteries).toHaveLength(2);
    expect(snapshot.reviewCandidates.candidates).toHaveLength(1);
    expect(pipelineTrace).toEqual({
      scopedCardIds: targetCardIds,
      requestedCardIds: targetCardIds,
      activeCardIds: targetCardIds,
      reviewEventCardIds: targetCardIds,
      derivedMasteryCardIds: targetCardIds,
      returnedMasteryCardIds: targetCardIds,
      snapshotMasteryCardIds: targetCardIds,
    });
  });

  it("reports the first loss from the shared loader rather than inferred SQL stages", async () => {
    const repository = new Repository(
      ["present-review", "missing-after-scope"],
      ["present-review"],
      [{ flashcardId: "present-review", isCorrect: false, reviewedAt: NOW }],
    );
    const data: ProductionDiagnosticDataAccess = {
      loadUsersWithHistory: async () => ["user-a"],
      loadMasterySnapshot: async (
        _userId: string,
        evaluationTime: string,
        pipelineTrace?: MasteryPipelineTrace,
      ) => loadMasterySnapshotWithRepository(repository, evaluationTime, undefined, pipelineTrace),
      loadFsrsDueCardIds: async () => ["present-review", "missing-after-scope"],
      loadFsrsCardDetails: async () => [],
      loadSchedulableEventsWithCardIds: async () => [],
      loadCardTraceInfo: async () => [],
    };

    await expect(runMasteryPipelineTrace(data, NOW)).resolves.toEqual([
      {
        userId: "user-a",
        label: "User 1",
        targetCount: 1,
        overallMasteries: 1,
        targetStageCounts: {
          p0RequestedScope: 1,
          p1ScopedCardIds: 1,
          p2RequestedCardIds: 1,
          p3ActiveCardIds: 0,
          p4EventBearingCardIds: 0,
          p4ReviewEventCount: 0,
          p5DerivedMasteries: 0,
          p6ReturnedMasteries: 0,
          p7SnapshotMasteries: 0,
        },
      },
    ]);
  });
});
