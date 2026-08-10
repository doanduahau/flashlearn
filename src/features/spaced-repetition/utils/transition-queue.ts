import type { FsrsDueCandidate } from "../types/due-types";

export type TransitionClassification = "normal" | "legacy" | "anomaly";

export type CursorEvent = {
  fsrsRating: number | null;
  isCorrect: boolean | null;
};

export type ScheduleCursor = {
  state: number;
  scheduledDays: number;
  lastProcessedReviewEventId: string;
};

export type ClassifiedCandidate = {
  candidate: FsrsDueCandidate;
  classification: TransitionClassification;
};

export type FsrsTransitionQueue = {
  evaluationTime: string;
  rawDueTotal: number;
  normalDueTotal: number;
  legacyDebtTotal: number;
  anomalyTotal: number;
  candidates: ClassifiedCandidate[];
  normalSelected: number;
  legacySelected: number;
  actionableNow: number;
};

export const SMART_REVIEW_BATCH_SIZE = 10;

export function classifyCandidate(
  cursor: ScheduleCursor,
  lastEvent: CursorEvent | null,
): TransitionClassification {
  const stateReview = cursor.state === 2;

  if (stateReview) return "normal";

  const hasExplicitRating =
    lastEvent?.fsrsRating != null && lastEvent.fsrsRating >= 1 && lastEvent.fsrsRating <= 4;

  if (hasExplicitRating) return "normal";

  const isShortTermLearning = cursor.state === 1 || cursor.state === 3;

  if (!isShortTermLearning) return "normal";

  if (cursor.scheduledDays !== 0) return "normal";

  if (lastEvent === null) return "anomaly";

  if (lastEvent.fsrsRating != null) return "normal";

  if (lastEvent.isCorrect !== null) return "legacy";

  return "anomaly";
}

function stableCandidateKey(c: FsrsDueCandidate): string {
  return `${c.due}\0${c.lastReview ?? ""}\0${c.flashcardId}`;
}

export function buildFsrsTransitionQueue(
  classified: readonly ClassifiedCandidate[],
  evaluationTime: string,
  batchSize = SMART_REVIEW_BATCH_SIZE,
): FsrsTransitionQueue {
  const normal: ClassifiedCandidate[] = [];
  const legacy: ClassifiedCandidate[] = [];
  let anomalyTotal = 0;

  for (const item of classified) {
    if (item.classification === "anomaly") {
      anomalyTotal += 1;
      normal.push(item);
    } else if (item.classification === "normal") {
      normal.push(item);
    } else {
      legacy.push(item);
    }
  }

  normal.sort((a, b) =>
    stableCandidateKey(a.candidate).localeCompare(stableCandidateKey(b.candidate)),
  );
  legacy.sort((a, b) =>
    stableCandidateKey(a.candidate).localeCompare(stableCandidateKey(b.candidate)),
  );

  const candidates: ClassifiedCandidate[] = [];
  const normalCount = Math.min(normal.length, batchSize);
  const legacyCount = Math.min(batchSize - normalCount, legacy.length);

  for (let i = 0; i < normalCount; i++) candidates.push(normal[i]);
  for (let i = 0; i < legacyCount; i++) candidates.push(legacy[i]);

  return {
    evaluationTime,
    rawDueTotal: classified.length,
    normalDueTotal: normal.length,
    legacyDebtTotal: legacy.length,
    anomalyTotal,
    candidates,
    normalSelected: normalCount,
    legacySelected: legacyCount,
    actionableNow: candidates.length,
  };
}

export type PerUserTransitionSimulation = {
  userId: string;
  label: string;
  rawDueTotal: number;
  normalDueTotal: number;
  legacyDebtTotal: number;
  anomalyTotal: number;
  normalSelected: number;
  legacySelected: number;
  actionableNow: number;
};

export type TransitionSimulationResult = {
  evaluationTime: string;
  perUser: PerUserTransitionSimulation[];
  aggregate: {
    users: number;
    rawDueTotal: number;
    normalDueTotal: number;
    legacyDebtTotal: number;
    anomalyTotal: number;
  };
};
