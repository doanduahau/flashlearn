import { describe, expect, it } from "vitest";

import { getMasteryPresentation } from "@/features/mastery/presentation/mastery-presentation";
import type {
  CardMasteryRepository,
  CardReviewEventRow,
  MasteryStatus,
} from "@/features/mastery/types/mastery-types";
import { loadCardMasteriesWithRepository } from "@/features/mastery/utils/load-card-masteries";

const NOW = "2026-08-09T12:00:00.000Z";
const PAGE_SIZE = 20;

function eventFor(cardId: string, count: number, correct: boolean): CardReviewEventRow[] {
  return Array.from({ length: count }, () => ({
    flashcardId: cardId,
    isCorrect: correct,
    reviewedAt: NOW,
  }));
}

class FakeMasteryRepository implements CardMasteryRepository {
  activeCalls = 0;
  eventCalls = 0;

  constructor(
    private readonly activeCardIds: string[],
    private readonly events: CardReviewEventRow[],
  ) {}

  async findActiveCardIds(cardIds: readonly string[]): Promise<string[]> {
    this.activeCalls += 1;
    return this.activeCardIds.filter((cardId) => cardIds.includes(cardId));
  }

  async findReviewEvents(cardIds: readonly string[]): Promise<CardReviewEventRow[]> {
    this.eventCalls += 1;
    return this.events.filter((event) => cardIds.includes(event.flashcardId));
  }
}

describe("batch mastery loading for a paginated card list", () => {
  const pageCardIds = Array.from({ length: PAGE_SIZE }, (_, index) => `card-${index}`);

  async function buildResults() {
    const repository = new FakeMasteryRepository(pageCardIds, [
      ...eventFor("card-0", 5, true), // recent, repeated correct -> strong
      ...eventFor("card-1", 3, false), // repeated mistakes -> review
      ...eventFor("card-2", 1, true), // single correct -> learning
      // card-3..card-19 have no events -> untested
    ]);

    return {
      repository,
      masteries: await loadCardMasteriesWithRepository(repository, pageCardIds, NOW),
    };
  }

  it("loads mastery for the whole visible page in one batch (no N+1)", async () => {
    const { repository, masteries } = await buildResults();
    expect(repository.activeCalls).toBe(1);
    expect(repository.eventCalls).toBe(1);
    expect(masteries).toHaveLength(PAGE_SIZE);
  });

  it("derives the expected status for each card on the page", async () => {
    const { masteries } = await buildResults();
    const byCard = new Map(masteries.map((mastery) => [mastery.flashcardId, mastery.status]));
    expect(byCard.get("card-0")).toBe("strong");
    expect(byCard.get("card-1")).toBe("review");
    expect(byCard.get("card-2")).toBe("learning");
    for (let index = 3; index < PAGE_SIZE; index += 1) {
      expect(byCard.get(`card-${index}`)).toBe("untested");
    }
  });

  it("renders a neutral presentation for untested cards with no events", async () => {
    const { masteries } = await buildResults();
    const untested = masteries.find((mastery) => mastery.flashcardId === "card-3");
    expect(untested?.status).toBe("untested");
    expect(getMasteryPresentation(untested?.status ?? "untested").cardClassName).toContain(
      "mastery-untested",
    );
  });

  it("applies the correct presentation to every card via a mastery status map", async () => {
    const { masteries } = await buildResults();
    const statusByCard = new Map<string, MasteryStatus>();
    for (const mastery of masteries) {
      statusByCard.set(mastery.flashcardId, mastery.status);
    }
    for (const cardId of pageCardIds) {
      const status = statusByCard.get(cardId) ?? "untested";
      const presentation = getMasteryPresentation(status);
      expect(presentation.label).toBeTruthy();
      expect(presentation.cardClassName).toContain("mastery-");
    }
  });

  it("filters out cards deleted between the list query and the mastery load", async () => {
    const repository = new FakeMasteryRepository(
      pageCardIds.filter((cardId) => cardId !== "card-7"),
      [...eventFor("card-0", 5, true)],
    );
    const masteries = await loadCardMasteriesWithRepository(repository, pageCardIds, NOW);
    expect(masteries.some((mastery) => mastery.flashcardId === "card-7")).toBe(false);
    expect(masteries).toHaveLength(PAGE_SIZE - 1);
  });

  it("does not leak raw scores to the presentation layer", async () => {
    const { masteries } = await buildResults();
    for (const mastery of masteries) {
      const presentation = getMasteryPresentation(mastery.status);
      expect(String(mastery.score)).not.toContain(presentation.label);
      expect(presentation.label).not.toMatch(/\d|%|score|điểm|phần trăm/i);
    }
  });
});
