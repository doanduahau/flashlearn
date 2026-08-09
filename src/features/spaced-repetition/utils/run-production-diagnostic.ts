import { createFlashlearnScheduler } from "../config";
import { replayReviewHistory } from "./replay-history";
import type { MasterySnapshot } from "@/features/mastery/utils/load-mastery-snapshot";
import {
  analyzeOneReview,
  analyzeReviewState,
  analyzeShortTermLearning,
  checkSchedulerMismatches,
  analyzeUntestedWithHistory,
  classifyByLastReviewAge,
  classifyByOverdue,
  classifyByReviewCount,
  classifyByState,
  classifyLastEventOutcome,
  crossTabMastery,
  type FsrsOnlyCardDetail,
  type MasteryCardInfo,
  type OverdueBucket,
  type PerUserDiagnostic,
  sumAgeBuckets,
  sumLastEventOutcomes,
  sumMasteryCrossTabs,
  sumReviewCountBuckets,
  sumStateBuckets,
} from "./diagnose-due-divergence";

type EventWithCardId = {
  flashcardId: string;
  id: string;
  reviewedAt: string;
  isCorrect: boolean | null;
  fsrsRating: number | null;
};

export type CardTraceInfo = {
  flashcardId: string;
  existsInFlashcards: boolean;
  flashcardUserId: string | null;
  scheduleUserId: string;
};

export type TraceMissingReasonCounts = {
  absentFromFlashcards: number;
  ownershipMismatch: number;
  presentInFlashcards: number;
  unexplained: number;
};

export type TraceMissingReport = {
  userId: string;
  label: string;
  fsrsOnlyCount: number;
  missingFromMasteryCount: number;
  stageByStage: {
    presentInFlashcards: number;
    passOwnership: number;
    passLibraryScope: number;
    passActiveCardPredicate: number;
    haveSchedulableEvent: number;
    representedInMasterySnapshot: number;
    unexplainedGap: number;
  };
  reasonCounts: TraceMissingReasonCounts;
};

export type ProductionDiagnosticDataAccess = {
  loadUsersWithHistory(): Promise<string[]>;
  loadMasterySnapshot(userId: string, evaluationTime: string): Promise<MasterySnapshot>;
  loadFsrsDueCardIds(userId: string, evaluationTime: string): Promise<string[]>;
  loadFsrsCardDetails(userId: string, cardIds: string[]): Promise<FsrsOnlyCardDetail[]>;
  loadSchedulableEventsWithCardIds(userId: string, cardIds: string[]): Promise<EventWithCardId[]>;
  loadCardTraceInfo(userId: string, cardIds: string[]): Promise<CardTraceInfo[]>;
};

export type ReplaySampleResult = {
  total: number;
  mismatches: number;
};

export type AggregateDiagnostic = {
  totalFsrsOnlyCards: number;
  stateBuckets: ReturnType<typeof sumStateBuckets>;
  reviewCountBuckets: ReturnType<typeof sumReviewCountBuckets>;
  lastReviewAgeBuckets: ReturnType<typeof sumAgeBuckets>;
  overdueBuckets: Omit<OverdueBucket, "medianHours" | "p90Hours" | "maxHours">;
  lastEventOutcome: ReturnType<typeof sumLastEventOutcomes>;
  masteryCrossTab: ReturnType<typeof sumMasteryCrossTabs>;
  totalSchedulerMismatches: number;
  shortTermLearningTotal: number;
  oneReviewTotal: number;
  replayCheck: ReplaySampleResult;
  untestedWithHistoryTotal: number;
};

export type ProductionDiagnosticResult = {
  evaluationTime: string;
  perUser: PerUserDiagnostic[];
  aggregate: AggregateDiagnostic;
};

function buildMasteryMap(snapshot: MasterySnapshot): Map<string, MasteryCardInfo> {
  const map = new Map<string, MasteryCardInfo>();
  for (const m of snapshot.masteries) {
    map.set(m.flashcardId, { flashcardId: m.flashcardId, status: m.status, score: m.score });
  }
  return map;
}

function pickSampleIds(
  details: readonly FsrsOnlyCardDetail[],
  predicate: (d: FsrsOnlyCardDetail) => boolean,
  maxCount: number,
): string[] {
  return details
    .filter(predicate)
    .map((d) => d.flashcardId)
    .sort()
    .slice(0, maxCount);
}

function stateMatches(replayedName: string, persistedState: number): boolean {
  return (
    (replayedName === "New" && persistedState === 0) ||
    (replayedName === "Learning" && persistedState === 1) ||
    (replayedName === "Review" && persistedState === 2) ||
    (replayedName === "Relearning" && persistedState === 3)
  );
}

function compareSchedules(
  replayed: ReturnType<typeof replayReviewHistory>,
  persisted: { state: number; due: string },
): boolean {
  if (!replayed) return false;
  if (!stateMatches(replayed.state, persisted.state)) return false;
  const replayedDue = new Date(replayed.due).getTime();
  const persistedDue = new Date(persisted.due).getTime();
  return Math.abs(replayedDue - persistedDue) <= 2000;
}

function runReplayCheck(
  samples: readonly FsrsOnlyCardDetail[],
  eventsByCard: ReadonlyMap<string, readonly EventWithCardId[]>,
): ReplaySampleResult {
  if (samples.length === 0) return { total: 0, mismatches: 0 };

  const scheduler = createFlashlearnScheduler();
  let mismatches = 0;

  for (const sample of samples) {
    const events = eventsByCard.get(sample.flashcardId) ?? [];
    const replayed = replayReviewHistory(
      events.map((e) => ({
        eventId: e.id,
        reviewedAt: e.reviewedAt,
        isCorrect: e.isCorrect,
        fsrsRating: e.fsrsRating,
      })),
      scheduler,
    );

    if (!compareSchedules(replayed, { state: sample.state, due: sample.due })) {
      mismatches += 1;
    }
  }

  return { total: samples.length, mismatches };
}

export async function runProductionDiagnostic(
  data: ProductionDiagnosticDataAccess,
  evaluationTime: string,
): Promise<ProductionDiagnosticResult> {
  const userIds = await data.loadUsersWithHistory();
  const perUser: PerUserDiagnostic[] = [];
  let replayTotal = 0;
  let replayMismatches = 0;

  for (let index = 0; index < userIds.length; index += 1) {
    const userId = userIds[index];
    const [snapshot, fsrsCardIds] = await Promise.all([
      data.loadMasterySnapshot(userId, evaluationTime),
      data.loadFsrsDueCardIds(userId, evaluationTime),
    ]);

    const masteryReviewIds = new Set(
      snapshot.reviewCandidates.candidates.map((c) => c.flashcardId),
    );
    const fsrsOnlyIds = fsrsCardIds.filter((id) => !masteryReviewIds.has(id));
    if (fsrsOnlyIds.length === 0) continue;

    const details = await data.loadFsrsCardDetails(userId, fsrsOnlyIds);
    const masteryMap = buildMasteryMap(snapshot);

    const sampleIds = new Set([
      ...pickSampleIds(details, (d) => d.state === 1 && d.scheduledDays === 0, 3),
      ...pickSampleIds(details, (d) => d.state === 3 && d.scheduledDays === 0, 2),
      ...pickSampleIds(details, (d) => d.state === 2, 3),
      ...pickSampleIds(details, (d) => d.processedEventCount === 1, 3),
    ]);

    let replayResult: ReplaySampleResult = { total: 0, mismatches: 0 };
    if (sampleIds.size > 0) {
      const events = await data.loadSchedulableEventsWithCardIds(userId, [...sampleIds]);
      const eventsByCard = new Map<string, EventWithCardId[]>();
      for (const e of events) {
        const list = eventsByCard.get(e.flashcardId);
        if (list) list.push(e);
        else eventsByCard.set(e.flashcardId, [e]);
      }
      const samples = details.filter((d) => sampleIds.has(d.flashcardId));
      replayResult = runReplayCheck(samples, eventsByCard);
    }

    perUser.push({
      userId,
      label: `User ${index + 1}`,
      fsrsOnlyCount: details.length,
      stateBuckets: classifyByState(details),
      reviewCountBuckets: classifyByReviewCount(details),
      lastReviewAgeBuckets: classifyByLastReviewAge(details, evaluationTime),
      overdueBuckets: classifyByOverdue(details, evaluationTime),
      lastEventOutcome: classifyLastEventOutcome(details),
      masteryCrossTab: crossTabMastery(details, masteryMap),
      oneReview: analyzeOneReview(details, evaluationTime),
      shortTermLearning: analyzeShortTermLearning(details),
      reviewState: analyzeReviewState(details, evaluationTime, masteryMap),
      schedulerMismatchCount: checkSchedulerMismatches(details),
      untestedWithHistory: analyzeUntestedWithHistory(details, masteryMap),
    });

    replayTotal += replayResult.total;
    replayMismatches += replayResult.mismatches;
  }

  return {
    evaluationTime,
    perUser,
    aggregate: {
      totalFsrsOnlyCards: perUser.reduce((sum, u) => sum + u.fsrsOnlyCount, 0),
      stateBuckets: sumStateBuckets(perUser.map((u) => u.stateBuckets)),
      reviewCountBuckets: sumReviewCountBuckets(perUser.map((u) => u.reviewCountBuckets)),
      lastReviewAgeBuckets: sumAgeBuckets(perUser.map((u) => u.lastReviewAgeBuckets)),
      overdueBuckets: {
        within1h: perUser.reduce((s, u) => s + u.overdueBuckets.within1h, 0),
        h1to24h: perUser.reduce((s, u) => s + u.overdueBuckets.h1to24h, 0),
        d1to7: perUser.reduce((s, u) => s + u.overdueBuckets.d1to7, 0),
        d7to30: perUser.reduce((s, u) => s + u.overdueBuckets.d7to30, 0),
        d30to90: perUser.reduce((s, u) => s + u.overdueBuckets.d30to90, 0),
        gt90d: perUser.reduce((s, u) => s + u.overdueBuckets.gt90d, 0),
      },
      lastEventOutcome: sumLastEventOutcomes(perUser.map((u) => u.lastEventOutcome)),
      masteryCrossTab: sumMasteryCrossTabs(perUser.map((u) => u.masteryCrossTab)),
      totalSchedulerMismatches: perUser.reduce((s, u) => s + u.schedulerMismatchCount, 0),
      shortTermLearningTotal: perUser.reduce((s, u) => s + u.shortTermLearning.count, 0),
      oneReviewTotal: perUser.reduce((s, u) => s + u.oneReview.count, 0),
      replayCheck: { total: replayTotal, mismatches: replayMismatches },
      untestedWithHistoryTotal: perUser.reduce((s, u) => s + u.untestedWithHistory.count, 0),
    },
  };
}

export async function runMissingCardTrace(
  data: ProductionDiagnosticDataAccess,
  evaluationTime: string,
): Promise<TraceMissingReport[]> {
  const userIds = await data.loadUsersWithHistory();
  const reports: TraceMissingReport[] = [];

  for (let index = 0; index < userIds.length; index += 1) {
    const userId = userIds[index];
    const [snapshot, fsrsCardIds] = await Promise.all([
      data.loadMasterySnapshot(userId, evaluationTime),
      data.loadFsrsDueCardIds(userId, evaluationTime),
    ]);

    const masteryReviewIds = new Set(
      snapshot.reviewCandidates.candidates.map((c) => c.flashcardId),
    );
    const fsrsOnlyIds = fsrsCardIds.filter((id) => !masteryReviewIds.has(id));
    if (fsrsOnlyIds.length === 0) continue;

    const masteryMap = buildMasteryMap(snapshot);
    const details = await data.loadFsrsCardDetails(userId, fsrsOnlyIds);
    const untested = analyzeUntestedWithHistory(details, masteryMap);
    if (untested.reasonCategories.noCardInMasterySnapshot === 0) continue;

    const missingCardIds = details
      .filter((d) => !masteryMap.has(d.flashcardId))
      .map((d) => d.flashcardId);

    const traceInfo = await data.loadCardTraceInfo(userId, missingCardIds);

    const scheduleUserIdMap = new Map(
      details
        .filter((d) => missingCardIds.includes(d.flashcardId))
        .map((d) => [d.flashcardId, userId]),
    );

    let presentInFlashcards = 0;
    let passOwnership = 0;
    let absentFromFlashcards = 0;
    let ownershipMismatch = 0;
    let present = 0;
    let unexplained = 0;

    for (const info of traceInfo) {
      if (!info.existsInFlashcards) {
        absentFromFlashcards += 1;
        continue;
      }
      presentInFlashcards += 1;

      const scheduleOwner = scheduleUserIdMap.get(info.flashcardId) ?? userId;
      if (info.flashcardUserId === scheduleOwner) {
        passOwnership += 1;
        present += 1;
        unexplained += 1;
      } else {
        ownershipMismatch += 1;
      }
    }

    reports.push({
      userId,
      label: `User ${index + 1}`,
      fsrsOnlyCount: details.length,
      missingFromMasteryCount: missingCardIds.length,
      stageByStage: {
        presentInFlashcards,
        passOwnership,
        passLibraryScope: presentInFlashcards,
        passActiveCardPredicate: presentInFlashcards,
        haveSchedulableEvent: missingCardIds.length,
        representedInMasterySnapshot: 0,
        unexplainedGap: unexplained,
      },
      reasonCounts: {
        absentFromFlashcards,
        ownershipMismatch,
        presentInFlashcards: present,
        unexplained,
      },
    });
  }

  return reports;
}
