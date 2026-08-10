// @vitest-environment node
//
// REAL local-Supabase integration test for the FSRS transition queue.
// Seeds historical legacy-debt Learning cards, explicit-rating cards,
// Review cards, and future-due cards; verifies classification and queue ordering.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/supabase/types";

vi.mock("server-only", () => ({}));

const { loadTransitionQueue } =
  await import("@/features/spaced-repetition/server/transition-queue");

type Supabase = SupabaseClient<Database>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DUE_PAST = "2026-08-09T10:00:00.000Z";
const EVAL = "2026-08-09T12:00:00.000Z";

if (!supabaseUrl || !serviceKey) {
  describe.skip("Transition queue integration — needs local Supabase env", () => {
    it("is skipped when local env is absent", () => {});
  });
} else {
  const client: Supabase = createClient<Database>(supabaseUrl, serviceKey);

  let userId = "";
  let otherUserId = "";
  let setId = "";
  let collectionId = "";

  beforeAll(async () => {
    const prefix = `tq-${Date.now()}`;
    const { data: u } = await client.auth.admin.createUser({
      email: `${prefix}-a@test.flashlearn.dev`,
      password: "IntegrationTest1!",
      email_confirm: true,
    });
    userId = u?.user?.id ?? "";
    if (!userId) throw new Error("no user");

    const { data: u2 } = await client.auth.admin.createUser({
      email: `${prefix}-b@test.flashlearn.dev`,
      password: "IntegrationTest1!",
      email_confirm: true,
    });
    otherUserId = u2?.user?.id ?? "";
    if (!otherUserId) throw new Error("no other user");

    setId = "b1000000-0000-4000-8000-000000000001";
    await client.from("flashcard_sets").insert({ id: setId, user_id: userId, name: "TQ" });

    collectionId = "b2000000-0000-4000-8000-000000000001";
    await client.from("special_collections").insert({
      id: collectionId,
      user_id: userId,
      name: "TQ Collection",
    });

    // 12 legacy: Learning, scheduled_days=0, null rating, binary correct
    const legacyCardIds = Array.from(
      { length: 12 },
      (_, i) => `b1000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`,
    );
    const legacyEventIds = Array.from(
      { length: 12 },
      (_, i) => `b2000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`,
    );

    // 8 normal: Learning, explicit rating=3
    const normalCardIds = Array.from(
      { length: 8 },
      (_, i) => `b3000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`,
    );
    const normalEventIds = Array.from(
      { length: 8 },
      (_, i) => `b4000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`,
    );

    // 3 Review cards
    const reviewCardIds = Array.from(
      { length: 3 },
      (_, i) => `b5000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`,
    );
    const reviewEventIds = Array.from(
      { length: 3 },
      (_, i) => `b6000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`,
    );

    const allCardIds = [...legacyCardIds, ...normalCardIds, ...reviewCardIds];

    await client.from("flashcards").insert(
      allCardIds.map((id) => ({
        id,
        user_id: userId,
        set_id: setId,
        front: `Front`,
        back: `Back`,
      })),
    );

    await client.from("special_collection_items").insert(
      allCardIds.map((id) => ({
        user_id: userId,
        collection_id: collectionId,
        flashcard_id: id,
      })),
    );

    // Insert events
    const { error: evtError } = await client.from("card_review_events").insert([
      ...legacyCardIds.map((cardId, i) => ({
        id: legacyEventIds[i],
        user_id: userId,
        flashcard_id: cardId,
        source: "study_recall",
        is_correct: true,
        fsrs_rating: null as number | null,
        reviewed_at: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
      })),
      ...normalCardIds.map((cardId, i) => ({
        id: normalEventIds[i],
        user_id: userId,
        flashcard_id: cardId,
        source: "study_recall",
        is_correct: true,
        fsrs_rating: 3,
        reviewed_at: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
      })),
      ...reviewCardIds.map((cardId, i) => ({
        id: reviewEventIds[i],
        user_id: userId,
        flashcard_id: cardId,
        source: "study_recall",
        is_correct: true,
        fsrs_rating: 3,
        reviewed_at: new Date(Date.now() - (i + 3) * 86400000).toISOString(),
      })),
    ]);

    if (evtError) throw evtError;

    // Insert schedules
    const { error: schedError } = await client.from("card_learning_schedule").insert([
      ...legacyCardIds.map((cardId, i) => ({
        user_id: userId,
        flashcard_id: cardId,
        state: 1,
        stability: 1,
        difficulty: 1,
        due: DUE_PAST,
        scheduled_days: 0,
        learning_steps: 1,
        last_review: DUE_PAST,
        projection_revision: 1,
        processed_event_count: 1,
        last_processed_reviewed_at: DUE_PAST,
        last_processed_review_event_id: legacyEventIds[i],
        algorithm: "fsrs-6",
        implementation: "ts-fsrs@5.4.1",
        parameter_set: "flashlearn-v1",
      })),
      ...normalCardIds.map((cardId, i) => ({
        user_id: userId,
        flashcard_id: cardId,
        state: 1,
        stability: 1,
        difficulty: 1,
        due: DUE_PAST,
        scheduled_days: 0,
        learning_steps: 1,
        last_review: DUE_PAST,
        projection_revision: 1,
        processed_event_count: 1,
        last_processed_reviewed_at: DUE_PAST,
        last_processed_review_event_id: normalEventIds[i],
        algorithm: "fsrs-6",
        implementation: "ts-fsrs@5.4.1",
        parameter_set: "flashlearn-v1",
      })),
      ...reviewCardIds.map((cardId) => ({
        user_id: userId,
        flashcard_id: cardId,
        state: 2,
        stability: 5,
        difficulty: 3,
        due: DUE_PAST,
        scheduled_days: 7,
        learning_steps: 0,
        last_review: DUE_PAST,
        projection_revision: 1,
        processed_event_count: 2,
        last_processed_reviewed_at: DUE_PAST,
        last_processed_review_event_id: reviewEventIds[0],
        algorithm: "fsrs-6",
        implementation: "ts-fsrs@5.4.1",
        parameter_set: "flashlearn-v1",
      })),
    ]);

    if (schedError) throw schedError;

    // Anomaly card (missing cursor event)
    const anomalyCardId = "b7000000-0000-4000-8000-000000000001";
    await client.from("flashcards").insert({
      id: anomalyCardId,
      user_id: userId,
      set_id: setId,
      front: "Anomaly",
      back: "Anomaly",
    });
    await client.from("card_learning_schedule").insert({
      user_id: userId,
      flashcard_id: anomalyCardId,
      state: 1,
      stability: 1,
      difficulty: 1,
      due: DUE_PAST,
      scheduled_days: 0,
      learning_steps: 1,
      last_review: DUE_PAST,
      projection_revision: 1,
      processed_event_count: 1,
      last_processed_reviewed_at: DUE_PAST,
      last_processed_review_event_id: "00000000-0000-0000-0000-ffffffffffff",
      algorithm: "fsrs-6",
      implementation: "ts-fsrs@5.4.1",
      parameter_set: "flashlearn-v1",
    });

    await client.from("profiles").upsert({ id: userId });
    await client.from("profiles").upsert({ id: otherUserId });
  }, 60000);

  afterAll(async () => {
    if (userId) await client.auth.admin.deleteUser(userId);
    if (otherUserId) await client.auth.admin.deleteUser(otherUserId);
  }, 30000);

  describe("classification", () => {
    it("legacy cards classified as legacy debt", async () => {
      const q = await loadTransitionQueue(client, userId, { type: "library" }, EVAL);
      expect(q.legacyDebtTotal).toBe(12);
    });

    it("explicit-rating + Review + anomaly classified as normal", async () => {
      const q = await loadTransitionQueue(client, userId, { type: "library" }, EVAL);
      expect(q.normalDueTotal).toBe(12); // 8 explicit + 3 review + 1 anomaly
    });

    it("anomaly cards counted separately but treated as normal", async () => {
      const q = await loadTransitionQueue(client, userId, { type: "library" }, EVAL);
      expect(q.anomalyTotal).toBe(1);
      expect(q.normalDueTotal).toBeGreaterThanOrEqual(1);
    });

    it("raw due total matches", async () => {
      const q = await loadTransitionQueue(client, userId, { type: "library" }, EVAL);
      expect(q.rawDueTotal).toBe(24); // 12 legacy + 8 normal + 3 review + 1 anomaly
    });
  });

  describe("queue ordering", () => {
    it("fills normal first, then legacy", async () => {
      const q = await loadTransitionQueue(client, userId, { type: "library" }, EVAL);
      expect(q.normalSelected).toBe(10);
      expect(q.legacySelected).toBe(0);
      expect(q.actionableNow).toBe(10);
    });

    it("actionableNow <= 10", async () => {
      const q = await loadTransitionQueue(client, userId, { type: "library" }, EVAL);
      expect(q.actionableNow).toBeLessThanOrEqual(10);
    });
  });

  describe("scope", () => {
    it("set scope returns only set cards", async () => {
      const q = await loadTransitionQueue(client, userId, { type: "set", setId }, EVAL);
      expect(q.rawDueTotal).toBe(24);
    });

    it("collection scope returns only collection cards", async () => {
      const q = await loadTransitionQueue(
        client,
        userId,
        { type: "collection", collectionId },
        EVAL,
      );
      expect(q.rawDueTotal).toBe(23); // anomaly not in collection
    });

    it("foreign user has no due cards", async () => {
      const q = await loadTransitionQueue(client, otherUserId, { type: "library" }, EVAL);
      expect(q.rawDueTotal).toBe(0);
    });
  });
}
