import { describe, expect, it } from "vitest";

import type {
  ActiveFlashcardMastery,
  CardReviewEventRow,
} from "@/features/mastery/types/mastery-types";
import { loadMasterySnapshotWithRepository } from "@/features/mastery/utils/load-mastery-snapshot";
import { selectSmartReviewCandidates } from "@/features/mastery/utils/select-smart-review-candidates";

const NOW = "2026-08-09T12:00:00.000Z";
const OLD = "2026-05-01T12:00:00.000Z";

class FakeScopeRepository {
  scopeCalls = 0;
  activeCalls = 0;
  eventCalls = 0;

  constructor(
    private readonly scopedCardIds: string[],
    private readonly activeCardIds: string[],
    private readonly events: CardReviewEventRow[],
  ) {}

  async findActiveCardIdsInScope(): Promise<string[]> {
    this.scopeCalls += 1;
    return [...this.scopedCardIds];
  }

  async findActiveCardIds(cardIds: readonly string[]): Promise<string[]> {
    this.activeCalls += 1;
    return this.activeCardIds.filter((cardId) => cardIds.includes(cardId));
  }

  async findReviewEvents(): Promise<CardReviewEventRow[]> {
    this.eventCalls += 1;
    return [...this.events];
  }
}

function mastery(
  flashcardId: string,
  status: ActiveFlashcardMastery["status"],
  score: number | null,
  lastReviewedAt: string | null,
): ActiveFlashcardMastery {
  return {
    flashcardId,
    status,
    score,
    lastReviewedAt,
    reviewCount: score === null ? 0 : 1,
    correctCount: 0,
    incorrectCount: score === null ? 0 : 1,
  };
}

function event(flashcardId: string, isCorrect: boolean, reviewedAt = NOW): CardReviewEventRow {
  return { flashcardId, isCorrect, reviewedAt };
}

describe("selectSmartReviewCandidates", () => {
  it("returns only review-status cards, excluding untested, learning, and strong", () => {
    const result = selectSmartReviewCandidates([
      mastery("untested", "untested", null, null),
      mastery("learning", "learning", 59, NOW),
      mastery("strong", "strong", 86, NOW),
      mastery("review", "review", 36.5, NOW),
    ]);

    expect(result).toEqual({
      total: 1,
      candidates: [{ flashcardId: "review", status: "review", score: 36.5, lastReviewedAt: NOW }],
    });
  });

  it("ranks lower score, then older review time, then stable UUID order", () => {
    const result = selectSmartReviewCandidates([
      mastery("card-b", "review", 20, NOW),
      mastery("card-a", "review", 20, NOW),
      mastery("older", "review", 20, OLD),
      mastery("weakest", "review", 10, NOW),
    ]);

    expect(result.candidates.map((candidate) => candidate.flashcardId)).toEqual([
      "weakest",
      "older",
      "card-a",
      "card-b",
    ]);
  });

  it("limits the returned batch without changing the full candidate total", () => {
    const result = selectSmartReviewCandidates(
      [
        mastery("first", "review", 10, NOW),
        mastery("second", "review", 20, NOW),
        mastery("third", "review", 30, NOW),
      ],
      2,
    );

    expect(result.total).toBe(3);
    expect(result.candidates.map((candidate) => candidate.flashcardId)).toEqual([
      "first",
      "second",
    ]);
  });
});

describe("loadMasterySnapshotWithRepository", () => {
  it("returns an empty aggregate and no candidates when there are no active cards", async () => {
    const repository = new FakeScopeRepository([], [], []);

    await expect(loadMasterySnapshotWithRepository(repository, NOW)).resolves.toMatchObject({
      evaluationTime: NOW,
      masteries: [],
      aggregate: { total: 0, untested: 0, review: 0, learning: 0, strong: 0 },
      reviewCandidates: { total: 0, candidates: [] },
    });
    expect(repository.scopeCalls).toBe(1);
    expect(repository.activeCalls).toBe(0);
    expect(repository.eventCalls).toBe(0);
  });

  it("does not make untested active cards Smart Review candidates", async () => {
    const repository = new FakeScopeRepository(["a", "b"], ["a", "b"], []);
    const snapshot = await loadMasterySnapshotWithRepository(repository, NOW);

    expect(snapshot.aggregate).toEqual({
      total: 2,
      untested: 2,
      review: 0,
      learning: 0,
      strong: 0,
    });
    expect(snapshot.reviewCandidates).toEqual({ total: 0, candidates: [] });
  });

  it("excludes a deleted card even when its historical review events remain", async () => {
    const repository = new FakeScopeRepository(
      ["live-card", "deleted-card"],
      ["live-card"],
      [event("live-card", false), event("deleted-card", false)],
    );
    const snapshot = await loadMasterySnapshotWithRepository(repository, NOW);

    expect(snapshot.aggregate).toEqual({
      total: 1,
      untested: 0,
      review: 1,
      learning: 0,
      strong: 0,
    });
    expect(snapshot.reviewCandidates.candidates.map((candidate) => candidate.flashcardId)).toEqual([
      "live-card",
    ]);
  });

  it("does not let User B data affect a User A-scoped snapshot", async () => {
    const repository = new FakeScopeRepository(
      ["user-a-card"],
      ["user-a-card"],
      [event("user-a-card", false), event("user-b-card", false)],
    );
    const snapshot = await loadMasterySnapshotWithRepository(repository, NOW);

    expect(snapshot.aggregate).toEqual({
      total: 1,
      untested: 0,
      review: 1,
      learning: 0,
      strong: 0,
    });
    expect(snapshot.reviewCandidates.candidates.map((candidate) => candidate.flashcardId)).toEqual([
      "user-a-card",
    ]);
  });

  it("uses one fixed time so aggregate and candidate projections agree exactly", async () => {
    const repository = new FakeScopeRepository(
      ["review", "learning", "strong", "untested"],
      ["review", "learning", "strong", "untested"],
      [
        event("review", false),
        event("learning", true),
        event("strong", true),
        event("strong", true),
        event("strong", true),
        event("strong", true),
      ],
    );

    const snapshot = await loadMasterySnapshotWithRepository(repository, NOW);
    expect(snapshot.evaluationTime).toBe(NOW);
    expect(snapshot.aggregate.review).toBe(snapshot.reviewCandidates.total);
    expect(snapshot.reviewCandidates.candidates.map((candidate) => candidate.flashcardId)).toEqual([
      "review",
    ]);
  });

  it("is exactly deterministic for identical history and evaluation time", async () => {
    const repository = new FakeScopeRepository(
      ["first", "second"],
      ["first", "second"],
      [event("first", false, OLD), event("second", false, NOW)],
    );

    const first = await loadMasterySnapshotWithRepository(repository, NOW);
    const second = await loadMasterySnapshotWithRepository(repository, NOW);
    expect(second).toEqual(first);
  });

  it("loads scope, active cards, and review history once for both projections", async () => {
    const repository = new FakeScopeRepository(
      ["review", "untested"],
      ["review", "untested"],
      [event("review", false)],
    );
    const snapshot = await loadMasterySnapshotWithRepository(repository, NOW, 1);

    expect(snapshot.aggregate.review).toBe(1);
    expect(snapshot.reviewCandidates).toMatchObject({
      total: 1,
      candidates: [{ flashcardId: "review" }],
    });
    expect(repository.scopeCalls).toBe(1);
    expect(repository.activeCalls).toBe(1);
    expect(repository.eventCalls).toBe(1);
  });

  it("retains candidates beyond 1,000 cards and events without per-card reads", async () => {
    const cardIds = Array.from(
      { length: 1005 },
      (_, index) => `card-${index.toString().padStart(4, "0")}`,
    );
    const repository = new FakeScopeRepository(
      cardIds,
      cardIds,
      cardIds.map((flashcardId) => event(flashcardId, false)),
    );
    const snapshot = await loadMasterySnapshotWithRepository(repository, NOW, 1005);

    expect(snapshot.aggregate).toEqual({
      total: 1005,
      untested: 0,
      review: 1005,
      learning: 0,
      strong: 0,
    });
    expect(snapshot.reviewCandidates.total).toBe(1005);
    expect(snapshot.reviewCandidates.candidates).toHaveLength(1005);
    expect(snapshot.reviewCandidates.candidates[0]?.flashcardId).toBe("card-0000");
    expect(snapshot.reviewCandidates.candidates.at(-1)?.flashcardId).toBe("card-1004");
    expect(repository.activeCalls).toBe(1);
    expect(repository.eventCalls).toBe(1);
  });
});
