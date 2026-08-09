import { describe, expect, it } from "vitest";

import { loadCardMasteriesWithRepository } from "@/features/mastery/utils/load-card-masteries";
import type {
  CardMasteryRepository,
  CardReviewEventRow,
} from "@/features/mastery/types/mastery-types";

const NOW = "2026-08-09T12:00:00.000Z";

class FakeMasteryRepository implements CardMasteryRepository {
  activeCalls: string[][] = [];
  eventCalls: string[][] = [];

  constructor(
    private readonly activeCardIds: string[],
    private readonly events: CardReviewEventRow[],
  ) {}

  async findActiveCardIds(cardIds: readonly string[]): Promise<string[]> {
    this.activeCalls.push([...cardIds]);
    return this.activeCardIds.filter((cardId) => cardIds.includes(cardId));
  }

  async findReviewEvents(cardIds: readonly string[]): Promise<CardReviewEventRow[]> {
    this.eventCalls.push([...cardIds]);
    return this.events.filter((event) => cardIds.includes(event.flashcardId));
  }
}

describe("loadCardMasteriesWithRepository", () => {
  it("loads active cards and their events in two batch repository calls", async () => {
    const repository = new FakeMasteryRepository(
      ["card-a", "card-b"],
      [
        { flashcardId: "card-a", isCorrect: true, reviewedAt: NOW },
        { flashcardId: "card-b", isCorrect: false, reviewedAt: NOW },
      ],
    );

    const results = await loadCardMasteriesWithRepository(
      repository,
      ["card-a", "deleted-card", "card-b", "card-a"],
      NOW,
    );

    expect(results.map((result) => result.flashcardId)).toEqual(["card-a", "card-b"]);
    expect(repository.activeCalls).toEqual([["card-a", "deleted-card", "card-b"]]);
    expect(repository.eventCalls).toEqual([["card-a", "card-b"]]);
    expect(results.find((result) => result.flashcardId === "card-a")?.status).toBe("learning");
  });

  it("does not return a foreign card when RLS only exposes the caller's cards and events", async () => {
    const repository = new FakeMasteryRepository(
      ["user-b-card"],
      [{ flashcardId: "user-b-card", isCorrect: true, reviewedAt: NOW }],
    );

    const results = await loadCardMasteriesWithRepository(
      repository,
      ["user-a-card", "user-b-card"],
      NOW,
    );

    expect(results).toHaveLength(1);
    expect(results[0]?.flashcardId).toBe("user-b-card");
  });
});
