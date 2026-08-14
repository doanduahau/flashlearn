import { describe, expect, it } from "vitest";

import {
  buildMasteryMap,
  runActiveLoaderTrace,
  runMasteryPipelineTrace,
  runUntestedHistoryTrace,
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
import { createActiveCardLoaderTrace } from "@/features/mastery/utils/find-active-card-ids";
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
    parameterSet: "capystudy-v1",
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
      derivations: [],
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
      derivations: [
        { flashcardId: "target-a", eventCount: 1, status: "review" },
        { flashcardId: "target-b", eventCount: 1, status: "learning" },
      ],
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
      loadScheduleCardIdsWithProcessedHistory: async () => [],
      loadFsrsReplayEvents: async () => [],
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

  it("reports per-batch metadata and same-query alternative probes without raw IDs", async () => {
    const data: ProductionDiagnosticDataAccess = {
      loadUsersWithHistory: async () => ["user-a"],
      loadMasterySnapshot: async (_userId, evaluationTime, pipelineTrace, activeLoaderTrace) => {
        pipelineTrace?.scopedCardIds.push("target-a", "target-b");
        pipelineTrace?.requestedCardIds.push("target-a", "target-b");
        activeLoaderTrace?.batches.push({
          inputIdCount: 2,
          pagesRequested: 1,
          rowsReturned: 0,
          error: { code: "PGRST123", status: 400, category: "postgrest" },
        });
        return {
          evaluationTime,
          masteries: [],
          aggregate: { total: 0, untested: 0, review: 0, learning: 0, strong: 0 },
          reviewCandidates: { total: 0, candidates: [] },
        };
      },
      loadFsrsDueCardIds: async () => ["target-a", "target-b"],
      loadFsrsCardDetails: async () => [],
      loadSchedulableEventsWithCardIds: async () => [],
      loadCardTraceInfo: async () => [],
      loadScheduleCardIdsWithProcessedHistory: async () => [],
      loadFsrsReplayEvents: async () => [],
      probeActiveCardIds: async (_cardIds, inBatchSize) => {
        const trace = createActiveCardLoaderTrace();
        trace.batches.push({
          inputIdCount: 2,
          pagesRequested: 1,
          rowsReturned: inBatchSize === 50 ? 2 : 0,
          error:
            inBatchSize === 50 ? null : { code: "PGRST123", status: 400, category: "postgrest" },
        });
        if (inBatchSize === 50) trace.returnedCardIds.push("target-a", "target-b");
        return trace;
      },
    };

    await expect(runActiveLoaderTrace(data, NOW, 200, [100, 50])).resolves.toEqual([
      {
        userId: "user-a",
        label: "User 1",
        totalInputIds: 2,
        configuredInBatchSize: 200,
        configuredBatchCount: 1,
        batches: [
          {
            inputIdCount: 2,
            pagesRequested: 1,
            rowsReturned: 0,
            error: { code: "PGRST123", status: 400, category: "postgrest" },
          },
        ],
        alternativeBatchProbes: [
          {
            inBatchSize: 200,
            queries: 1,
            totalIdsReturned: 0,
            targetIdsReturned: 0,
            errorBatches: 1,
          },
          {
            inBatchSize: 100,
            queries: 1,
            totalIdsReturned: 0,
            targetIdsReturned: 0,
            errorBatches: 1,
          },
          {
            inBatchSize: 50,
            queries: 1,
            totalIdsReturned: 2,
            targetIdsReturned: 2,
            errorBatches: 0,
          },
        ],
      },
    ]);
  });

  it("traces untested schedule cards through the real Mastery event invocation", async () => {
    const data: ProductionDiagnosticDataAccess = {
      loadUsersWithHistory: async () => ["user-a"],
      loadMasterySnapshot: async (_userId, evaluationTime, trace) => {
        trace?.activeCardIds.push("legacy-correct", "legacy-incorrect");
        trace?.derivedMasteryCardIds.push("legacy-correct", "legacy-incorrect");
        trace?.derivations.push(
          { flashcardId: "legacy-correct", eventCount: 0, status: "untested" },
          { flashcardId: "legacy-incorrect", eventCount: 0, status: "untested" },
        );
        return {
          evaluationTime,
          masteries: [
            {
              flashcardId: "legacy-correct",
              status: "untested",
              score: null,
              reviewCount: 0,
              correctCount: 0,
              incorrectCount: 0,
              lastReviewedAt: null,
            },
            {
              flashcardId: "legacy-incorrect",
              status: "untested",
              score: null,
              reviewCount: 0,
              correctCount: 0,
              incorrectCount: 0,
              lastReviewedAt: null,
            },
          ],
          aggregate: { total: 2, untested: 2, review: 0, learning: 0, strong: 0 },
          reviewCandidates: { total: 0, candidates: [] },
        };
      },
      loadFsrsDueCardIds: async () => [],
      loadFsrsCardDetails: async () => [],
      loadSchedulableEventsWithCardIds: async () => [],
      loadCardTraceInfo: async () => [],
      loadScheduleCardIdsWithProcessedHistory: async () => ["legacy-correct", "legacy-incorrect"],
      loadFsrsReplayEvents: async () => [
        {
          flashcardId: "legacy-correct",
          id: "event-a",
          reviewedAt: NOW,
          isCorrect: true,
          fsrsRating: null,
          userId: "user-a",
          source: "quiz",
          quizQuestionId: "question-a",
          quizSessionId: "session-a",
        },
        {
          flashcardId: "legacy-incorrect",
          id: "event-b",
          reviewedAt: NOW,
          isCorrect: false,
          fsrsRating: null,
          userId: "user-a",
          source: "quiz",
          quizQuestionId: "question-b",
          quizSessionId: "session-b",
        },
      ],
    };
    await expect(runUntestedHistoryTrace(data, NOW)).resolves.toMatchObject([
      {
        targetCount: 2,
        activeTargetCount: 2,
        masteryLoadedEventCount: 0,
        zeroEventDerivations: 2,
        resultingUntested: 2,
        fsrsSchedulableEventCount: 2,
        eventOwnership: { matches: 2, mismatches: 0 },
        legacyShape: { ratingNull: 2, correct: 1, incorrect: 1 },
      },
    ]);
  });
});
