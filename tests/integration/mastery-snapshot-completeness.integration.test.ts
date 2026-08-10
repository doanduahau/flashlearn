// @vitest-environment node
//
// REAL local-Supabase integration coverage for MasterySnapshot completeness.
// Requires a running local Supabase stack.
// Tests that findActiveCardIds paginates correctly for >1000 cards,
// and that all cards appear in the MasterySnapshot.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/supabase/types";

vi.mock("server-only", () => ({}));

const { findActiveCardIds, findReviewEvents, loadCardMasteries } =
  await import("@/features/mastery/server/load-card-masteries");

const { loadMasterySnapshot } = await import("@/features/mastery/server/load-mastery-snapshot");
const { buildServiceRoleRepository } =
  await import("@/features/spaced-repetition/server/service-role-repository");

type Supabase = SupabaseClient<Database>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CARD_COUNT = 1205;
const EVAL = "2026-08-09T12:00:00.000Z";

if (!supabaseUrl || !serviceKey) {
  describe.skip("MasterySnapshot completeness — needs local Supabase env", () => {
    it("is skipped when local env is absent", () => {});
  });
} else {
  const client: Supabase = createClient<Database>(supabaseUrl, serviceKey);

  let userId = "";
  let cardIds: string[] = [];
  let setId = "";

  beforeAll(async () => {
    const prefix = `mastery-completeness-${Date.now()}`;
    const email = `${prefix}@test.flashlearn.dev`;
    const { data: userData, error: userError } = await client.auth.admin.createUser({
      email,
      password: "IntegrationTest1!",
      email_confirm: true,
    });
    if (userError) throw userError;
    userId = userData.user?.id ?? "";
    if (!userId) throw new Error("Failed to create user");

    setId = "e0000000-0000-4000-8000-000000000001";

    await client.from("flashcard_sets").insert({
      id: setId,
      user_id: userId,
      name: "Completeness Test Set",
    });

    // Create 1205 flashcards
    cardIds = [];
    const FLASHCARD_BATCH = 500;
    for (let i = 0; i < CARD_COUNT; i += FLASHCARD_BATCH) {
      const batchData = Array.from(
        { length: Math.min(FLASHCARD_BATCH, CARD_COUNT - i) },
        (_, j) => {
          const seq = (i + j).toString(16).padStart(12, "0");
          return {
            id: `e0000000-0000-4000-8000-${seq}`,
            user_id: userId,
            set_id: setId,
            front: `Front ${i + j}`,
            back: `Back ${i + j}`,
            position: i + j,
          };
        },
      );
      const { error } = await client.from("flashcards").insert(batchData);
      if (error) throw error;
      cardIds.push(...batchData.map((b) => b.id));
    }

    // Add review events for the first 5 cards AND cards at positions 1100-1104
    // (to ensure events beyond page 1000 are loaded)
    const cardIdsWithEvents = [
      cardIds[0],
      cardIds[1],
      cardIds[2],
      cardIds[3],
      cardIds[4],
      cardIds[1100],
      cardIds[1101],
      cardIds[1102],
      cardIds[1103],
      cardIds[1104],
    ];

    const { error: eventError } = await client.from("card_review_events").insert(
      cardIdsWithEvents.map((cardId, idx) => ({
        user_id: userId,
        flashcard_id: cardId,
        source: "study_recall",
        is_correct: idx === 1 ? false : true,
        // Historical binary rows intentionally have no FSRS rating. Both the
        // Mastery event loader and FSRS fallback semantics must retain them.
        fsrs_rating: idx < 2 ? null : 3,
        reviewed_at: new Date(Date.now() - idx * 86400000).toISOString(),
      })),
    );
    if (eventError) throw eventError;

    // Ensure the user's profile exists
    await client.from("profiles").upsert({ id: userId });
  }, 60000);

  afterAll(async () => {
    if (userId) {
      await client.auth.admin.deleteUser(userId);
    }
  }, 30000);

  describe("findActiveCardIds pagination", () => {
    it("returns all 1205 cards across multiple pages", async () => {
      const result = await findActiveCardIds(client, cardIds);
      expect(result).toHaveLength(CARD_COUNT);
      for (const id of cardIds) {
        expect(result).toContain(id);
      }
    }, 30000);

    it("returns empty for non-existent card IDs", async () => {
      const result = await findActiveCardIds(client, [
        "00000000-0000-0000-0000-000000000000",
        "11111111-1111-1111-1111-111111111111",
      ]);
      expect(result).toHaveLength(0);
    });
  });

  describe("findReviewEvents pagination", () => {
    it("loads events for cards defined early and late in the ID list", async () => {
      const targetIds = [cardIds[0], cardIds[1100], cardIds[1104]];
      const events = await findReviewEvents(client, targetIds);
      const foundCardIds = new Set(events.map((e) => e.flashcardId));
      for (const id of targetIds) {
        expect(foundCardIds.has(id)).toBe(true);
      }
    }, 30000);

    it("returns empty for cards with no events", async () => {
      const noEventCardIds = [cardIds[500], cardIds[900], cardIds[1199]];
      const events = await findReviewEvents(client, noEventCardIds);
      expect(events).toHaveLength(0);
    });

    it("loads legacy binary correct and incorrect events used by FSRS fallback", async () => {
      const [correctCardId, incorrectCardId] = [cardIds[0], cardIds[1]];
      const masteryEvents = await findReviewEvents(client, [correctCardId, incorrectCardId]);
      const correctnessByCard = new Map(
        masteryEvents.map((event) => [event.flashcardId, event.isCorrect]),
      );
      expect(correctnessByCard.get(correctCardId)).toBe(true);
      expect(correctnessByCard.get(incorrectCardId)).toBe(false);

      const repository = buildServiceRoleRepository(client);
      const [correctReplayEvents, incorrectReplayEvents] = await Promise.all([
        repository.loadAllSchedulableEvents(userId, correctCardId),
        repository.loadAllSchedulableEvents(userId, incorrectCardId),
      ]);
      expect(correctReplayEvents).toHaveLength(1);
      expect(incorrectReplayEvents).toHaveLength(1);
      expect(correctReplayEvents[0]).toMatchObject({ isCorrect: true, fsrsRating: null });
      expect(incorrectReplayEvents[0]).toMatchObject({ isCorrect: false, fsrsRating: null });
    });
  });

  describe("MasterySnapshot completeness for 1205 cards", () => {
    it("all 1205 cards appear in MasterySnapshot.masteries", async () => {
      const snapshot = await loadMasterySnapshot(
        client,
        { type: "library" },
        { evaluationTime: EVAL },
      );

      const masteryCardIds = new Set(snapshot.masteries.map((m) => m.flashcardId));
      for (const id of cardIds) {
        expect(
          masteryCardIds.has(id),
          `Expected card ${id} to be in MasterySnapshot.masteries`,
        ).toBe(true);
      }
    }, 60000);

    it("cards with review events have non-untested status", async () => {
      const snapshot = await loadMasterySnapshot(
        client,
        { type: "library" },
        { evaluationTime: EVAL },
      );

      const masteryMap = new Map(snapshot.masteries.map((m) => [m.flashcardId, m.status]));

      const eventCardIds = [cardIds[0], cardIds[1100], cardIds[1104]];
      for (const id of eventCardIds) {
        expect(masteryMap.get(id)).not.toBe("untested");
      }
    }, 30000);

    it("unreviewed cards are reported as genuine untested", async () => {
      const snapshot = await loadMasterySnapshot(
        client,
        { type: "library" },
        { evaluationTime: EVAL },
      );

      const masteryMap = new Map(snapshot.masteries.map((m) => [m.flashcardId, m.status]));

      const noEventIds = [cardIds[500], cardIds[900], cardIds[1199]];
      for (const id of noEventIds) {
        expect(masteryMap.get(id)).toBe("untested");
      }
    }, 30000);

    it("snapshot contains no duplicate card entries", async () => {
      const snapshot = await loadMasterySnapshot(
        client,
        { type: "library" },
        { evaluationTime: EVAL },
      );

      const seen = new Set<string>();
      for (const m of snapshot.masteries) {
        expect(seen.has(m.flashcardId)).toBe(false);
        seen.add(m.flashcardId);
      }
    }, 30000);
  });

  describe("loadCardMasteries batch", () => {
    it("correctly loads masteries for a specific subset of cards", async () => {
      const subsetIds = [cardIds[0], cardIds[500], cardIds[1100]];
      const masteries = await loadCardMasteries(client, subsetIds, EVAL);

      expect(masteries).toHaveLength(3);
      const ids = masteries.map((m) => m.flashcardId).sort();
      expect(ids).toEqual(subsetIds.slice().sort());
    }, 30000);
  });
}
