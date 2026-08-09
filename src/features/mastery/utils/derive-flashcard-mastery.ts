import type {
  CardReviewOutcome,
  FlashcardMastery,
  MasteryStatus,
} from "@/features/mastery/types/mastery-types";

// Mastery V1 is intentionally a confidence signal, not a review scheduler.
export const MASTERY_V1 = {
  baseScore: 50,
  correctOutcomeWeight: 1,
  incorrectOutcomeWeight: -1.5,
  outcomeScoreMultiplier: 9,
  eventRecencyHalfLifeDays: 45,
  confidenceDecayHalfLifeDays: 120,
  reviewThreshold: 45,
  strongThreshold: 75,
  minimumReviewsForStrong: 4,
  minimumScore: 0,
  maximumScore: 100,
} as const;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

type ChronologicalOutcome = CardReviewOutcome & { reviewedAtMilliseconds: number };

function timestamp(value: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new RangeError("reviewedAt must be a valid UTC timestamp");
  return parsed;
}

function clamp(score: number): number {
  return Math.min(MASTERY_V1.maximumScore, Math.max(MASTERY_V1.minimumScore, score));
}

function halfLifeWeight(ageDays: number, halfLifeDays: number): number {
  return Math.pow(0.5, ageDays / halfLifeDays);
}

function chronological(events: readonly CardReviewOutcome[]): ChronologicalOutcome[] {
  return events
    .map((event) => ({ ...event, reviewedAtMilliseconds: timestamp(event.reviewedAt) }))
    .sort((left, right) => left.reviewedAtMilliseconds - right.reviewedAtMilliseconds);
}

function statusFor(score: number, reviewCount: number): MasteryStatus {
  if (score < MASTERY_V1.reviewThreshold) return "review";
  if (score >= MASTERY_V1.strongThreshold && reviewCount >= MASTERY_V1.minimumReviewsForStrong) {
    return "strong";
  }
  return "learning";
}

export function deriveFlashcardMastery(
  events: readonly CardReviewOutcome[],
  evaluationTime: string,
): FlashcardMastery {
  if (events.length === 0) {
    return {
      status: "untested",
      score: null,
      reviewCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      lastReviewedAt: null,
    };
  }

  const evaluatedAtMilliseconds = timestamp(evaluationTime);
  const ordered = chronological(events);
  const lastEvent = ordered.at(-1);
  if (!lastEvent) throw new Error("Expected at least one review event");

  let correctCount = 0;
  let incorrectCount = 0;
  let evidence = 0;

  for (const event of ordered) {
    const ageDays = Math.max(
      0,
      (evaluatedAtMilliseconds - event.reviewedAtMilliseconds) / MILLISECONDS_PER_DAY,
    );
    const recencyWeight = halfLifeWeight(ageDays, MASTERY_V1.eventRecencyHalfLifeDays);

    if (event.isCorrect === true) {
      correctCount += 1;
      evidence += MASTERY_V1.correctOutcomeWeight * recencyWeight;
    } else if (event.isCorrect === false) {
      incorrectCount += 1;
      evidence += MASTERY_V1.incorrectOutcomeWeight * recencyWeight;
    }
  }

  const lastReviewAgeDays = Math.max(
    0,
    (evaluatedAtMilliseconds - lastEvent.reviewedAtMilliseconds) / MILLISECONDS_PER_DAY,
  );
  const confidenceBeforeDecay = clamp(
    MASTERY_V1.baseScore + evidence * MASTERY_V1.outcomeScoreMultiplier,
  );
  const score = clamp(
    confidenceBeforeDecay *
      halfLifeWeight(lastReviewAgeDays, MASTERY_V1.confidenceDecayHalfLifeDays),
  );

  return {
    status: statusFor(score, ordered.length),
    score,
    reviewCount: ordered.length,
    correctCount,
    incorrectCount,
    lastReviewedAt: new Date(lastEvent.reviewedAtMilliseconds).toISOString(),
  };
}
