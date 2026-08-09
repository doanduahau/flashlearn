import { describe, expect, it } from "vitest";

import { EMPTY_MASTERY_AGGREGATE } from "@/features/mastery/utils/aggregate-mastery";
import { loadMasteryAggregateWithRepository } from "@/features/mastery/utils/load-mastery-aggregate";
import type { CardReviewEventRow } from "@/features/mastery/types/mastery-types";

const NOW = "2026-08-09T12:00:00.000Z";
const OLD = "2026-05-01T12:00:00.000Z";

class FakeScopeRepository {
  scopeCalls = 0;
  activeCalls = 0;
  eventCalls = 0;
  activeCallsArgs: string[][] = [];

  constructor(
    private readonly scopeCardIds: string[],
    private readonly activeCardIds: string[],
    private readonly events: CardReviewEventRow[],
  ) {}

  async findActiveCardIdsInScope(): Promise<string[]> {
    this.scopeCalls += 1;
    return [...this.scopeCardIds];
  }

  async findActiveCardIds(cardIds: readonly string[]): Promise<string[]> {
    this.activeCalls += 1;
    this.activeCallsArgs.push([...cardIds]);
    return this.activeCardIds.filter((cardId) => cardIds.includes(cardId));
  }

  async findReviewEvents(cardIds: readonly string[]): Promise<CardReviewEventRow[]> {
    this.eventCalls += 1;
    return this.events.filter((event) => cardIds.includes(event.flashcardId));
  }
}

function ids(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `card-${index}`);
}

function eventsFor(
  cardId: string,
  count: number,
  correct: boolean,
  reviewedAt: string,
): CardReviewEventRow[] {
  return Array.from({ length: count }, () => ({
    flashcardId: cardId,
    isCorrect: correct,
    reviewedAt,
  }));
}

describe("loadMasteryAggregateWithRepository", () => {
  it("empty library => all counts zero", async () => {
    const repository = new FakeScopeRepository([], [], []);
    const result = await loadMasteryAggregateWithRepository(repository, NOW);
    expect(result).toEqual(EMPTY_MASTERY_AGGREGATE);
    expect(repository.scopeCalls).toBe(1);
    expect(repository.activeCalls).toBe(0);
    expect(repository.eventCalls).toBe(0);
  });

  it("all never-tested cards => untested count equals the scope size", async () => {
    const repository = new FakeScopeRepository(ids(5), ids(5), []);
    const result = await loadMasteryAggregateWithRepository(repository, NOW);
    expect(result.untested).toBe(5);
    expect(result.total).toBe(5);
  });

  it("paginated UI does not cause a partial aggregate", async () => {
    // A set contains 235 active cards; a page only renders 20 of them.
    const repository = new FakeScopeRepository(ids(235), ids(235), []);
    const result = await loadMasteryAggregateWithRepository(repository, NOW);

    expect(result.total).toBe(235);
    expect(result.untested).toBe(235);
    // The re-validation step still receives the whole scope, never just the page.
    expect(repository.activeCallsArgs[0]).toHaveLength(235);
  });

  it("deleted cards are excluded from active totals", async () => {
    const fullScope = ids(235);
    const active = fullScope.filter(
      (id) => id !== "card-10" && id !== "card-11" && id !== "card-12",
    );
    const repository = new FakeScopeRepository(fullScope, active, []);
    const result = await loadMasteryAggregateWithRepository(repository, NOW);

    expect(result.total).toBe(232);
    expect(result.untested).toBe(232);
  });

  it("User B cards and events never affect User A's aggregate", async () => {
    const userACards = ids(4);
    const events = [
      ...eventsFor(userACards[0], 5, true, NOW), // -> strong
      ...eventsFor(userACards[1], 3, false, NOW), // -> review
      // User B's card is outside User A's scope and must never be counted.
      ...eventsFor("user-b-card", 9, true, NOW),
    ];
    const repository = new FakeScopeRepository(userACards, userACards, events);
    const result = await loadMasteryAggregateWithRepository(repository, NOW);

    expect(result.total).toBe(4);
    expect(result.strong).toBe(1);
    expect(result.review).toBe(1);
    expect(result.learning).toBe(0);
    expect(result.untested).toBe(2);
  });

  it("uses one fixed evaluation time for the whole batch", async () => {
    const repository = new FakeScopeRepository(
      ["card-a", "card-b"],
      ["card-a", "card-b"],
      [
        ...eventsFor("card-a", 5, true, NOW), // recent -> strong at NOW
        ...eventsFor("card-b", 5, true, OLD), // decayed -> review at NOW, strong at OLD
      ],
    );

    const now = await loadMasteryAggregateWithRepository(repository, NOW);
    expect(now).toEqual({ total: 2, untested: 0, review: 1, learning: 0, strong: 1 });

    const old = await loadMasteryAggregateWithRepository(repository, OLD);
    expect(old).toEqual({ total: 2, untested: 0, review: 0, learning: 0, strong: 2 });

    // Both evaluations were single batches (one scope, one event query each).
    expect(repository.scopeCalls).toBe(2);
    expect(repository.eventCalls).toBe(2);
  });

  it("aggregates the whole scope in a fixed number of batch queries (no N+1)", async () => {
    const repository = new FakeScopeRepository(ids(235), ids(235), [
      ...eventsFor("card-0", 5, true, NOW),
    ]);
    const result = await loadMasteryAggregateWithRepository(repository, NOW);

    expect(result.total).toBe(235);
    expect(repository.scopeCalls).toBe(1);
    expect(repository.activeCalls).toBe(1);
    expect(repository.eventCalls).toBe(1);
  });
});
