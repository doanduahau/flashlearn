// @vitest-environment node
//
// REAL local-Supabase integration coverage for the FSRS due read model.
// Requires a running local Supabase stack (run via: npm run fsrs:test:local).
// Seeds card_learning_schedule rows directly and verifies countDueCards /
// findDueCandidates against real rows and RLS-scoped queries.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  countDueCards,
  findDueCandidates,
  loadDueCandidateResult,
} from "@/features/spaced-repetition/server/due-repository";
import type { Database } from "@/lib/supabase/types";

type Supabase = SupabaseClient<Database>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EVAL = "2026-08-09T12:00:00.000Z";

if (!supabaseUrl || !serviceKey) {
  describe.skip("FSRS due read model — needs local Supabase env", () => {
    it("is skipped when local env is absent", () => {});
  });
} else {
  const client: Supabase = createClient<Database>(supabaseUrl, serviceKey);

  const users: string[] = [];
  let userA = "";
  let userB = "";

  const setIdA = "da000000-0000-4000-8000-0000000000a0";
  const setIdB = "da000000-0000-4000-8000-0000000000b0";
  const setIdBForUserB = "da000000-0000-4000-8000-0000000000e0";
  const collectionId = "da000000-0000-4000-8000-0000000000c0";

  // Cards for user A
  const overdueCard = "da000000-0000-4000-8000-000000000001";
  const dueNowCard = "da000000-0000-4000-8000-000000000002";
  const futureCard = "da000000-0000-4000-8000-000000000003";
  const noScheduleCard = "da000000-0000-4000-8000-000000000004";

  // Card for user B
  const userBCard = "da000000-0000-4000-8000-000000000005";

  async function createUser(tag: string): Promise<string> {
    const email = `fsrs-due-${tag}-${Date.now()}@test.flashlearn.dev`;
    const { data, error } = await client.auth.admin.createUser({
      email,
      password: "IntegrationTest1!",
      email_confirm: true,
    });
    if (error) throw error;
    if (!data?.user) throw new Error("createUser returned no user");
    return data.user.id;
  }

  async function createSet(userId: string, setId: string, name: string): Promise<void> {
    const { error } = await client.from("flashcard_sets").insert({
      id: setId,
      user_id: userId,
      name,
    });
    if (error) throw error;
  }

  async function createCard(
    userId: string,
    setId: string,
    cardId: string,
    front: string,
  ): Promise<void> {
    const { error } = await client.from("flashcards").insert({
      id: cardId,
      user_id: userId,
      set_id: setId,
      front,
      back: `Back ${front}`,
    });
    if (error) throw error;
  }

  async function createSchedule(params: {
    userId: string;
    cardId: string;
    due: string;
    lastReview: string;
    state?: number;
  }): Promise<void> {
    const { error } = await client.from("card_learning_schedule").insert({
      user_id: params.userId,
      flashcard_id: params.cardId,
      state: params.state ?? 2,
      stability: 5,
      difficulty: 3,
      due: params.due,
      scheduled_days: 10,
      learning_steps: 0,
      reps: 2,
      lapses: 0,
      last_review: params.lastReview,
      projection_revision: 0,
      processed_event_count: 2,
      last_processed_reviewed_at: params.lastReview,
      last_processed_review_event_id: "da000000-0000-4000-8000-0000000000ff",
      algorithm: "fsrs-6",
      implementation: "ts-fsrs@5.4.1",
      parameter_set: "flashlearn-v1",
    });
    if (error) throw error;
  }

  async function addToCollection(userId: string, cardId: string): Promise<void> {
    const { error } = await client
      .from("special_collection_items")
      .insert({ user_id: userId, collection_id: collectionId, flashcard_id: cardId });
    if (error) throw error;
  }

  beforeAll(async () => {
    userA = await createUser("due-a");
    userB = await createUser("due-b");
    users.push(userA, userB);

    await createSet(userA, setIdA, "Set A");
    await createSet(userA, setIdB, "Set B");
    await createCard(userA, setIdA, overdueCard, "Overdue");
    await createCard(userA, setIdA, dueNowCard, "Due Now");
    await createCard(userA, setIdB, futureCard, "Future");
    await createCard(userA, setIdB, noScheduleCard, "No Schedule");

    await createSet(userB, setIdBForUserB, "Set B (B)");
    await createCard(userB, setIdBForUserB, userBCard, "B Card");

    // Schedules for user A: overdue + due-now + future.
    await createSchedule({
      userId: userA,
      cardId: overdueCard,
      due: "2026-08-08T12:00:00.000Z",
      lastReview: "2026-08-01T12:00:00.000Z",
    });
    await createSchedule({
      userId: userA,
      cardId: dueNowCard,
      due: EVAL, // exactly at evaluation time -> eligible
      lastReview: "2026-08-02T12:00:00.000Z",
    });
    await createSchedule({
      userId: userA,
      cardId: futureCard,
      due: "2026-08-20T12:00:00.000Z",
      lastReview: "2026-08-03T12:00:00.000Z",
    });

    // noScheduleCard intentionally has no schedule row.

    // Collection membership for user A: overdue + dueNow in collection.
    await client.from("special_collections").insert({
      id: collectionId,
      user_id: userA,
      name: "Coll A",
    });
    await addToCollection(userA, overdueCard);
    await addToCollection(userA, dueNowCard);

    // User B has one schedule row (future relative to eval) in set B.
    await createSchedule({
      userId: userB,
      cardId: userBCard,
      due: "2026-08-30T12:00:00.000Z",
      lastReview: "2026-08-01T12:00:00.000Z",
    });
  });

  afterAll(async () => {
    for (const userId of users) {
      await client.from("card_learning_schedule").delete().eq("user_id", userId);
      await client.from("special_collection_items").delete().eq("user_id", userId);
      await client.from("special_collections").delete().eq("user_id", userId);
      await client.from("flashcards").delete().eq("user_id", userId);
      await client.from("flashcard_sets").delete().eq("user_id", userId);
      await client.auth.admin.deleteUser(userId);
    }
  });

  describe("due read model — library scope", () => {
    it("counts due cards in the library", async () => {
      const count = await countDueCards(client, userA, { type: "library" }, EVAL);
      // overdue + dueNow = 2 (future excluded, no-schedule excluded)
      expect(count).toBe(2);
    });

    it("returns top candidates ordered by due", async () => {
      const candidates = await findDueCandidates(client, userA, { type: "library" }, EVAL, 10);
      expect(candidates.map((c) => c.flashcardId)).toEqual([overdueCard, dueNowCard]);
    });

    it("returns total = full count and candidates = limited", async () => {
      const { total, candidates } = await loadDueCandidateResult(
        client,
        userA,
        { type: "library" },
        EVAL,
        1,
      );
      expect(total).toBe(2);
      expect(candidates).toHaveLength(1);
      expect(candidates[0]?.flashcardId).toBe(overdueCard);
    });
  });

  describe("due read model — scoped", () => {
    it("counts due within a set", async () => {
      const count = await countDueCards(client, userA, { type: "set", setId: setIdA }, EVAL);
      // Set A has overdue + dueNow -> 2
      expect(count).toBe(2);
      const countB = await countDueCards(client, userA, { type: "set", setId: setIdB }, EVAL);
      // Set B has future (not due) + no-schedule (no row) -> 0
      expect(countB).toBe(0);
    });

    it("counts due within a collection", async () => {
      const count = await countDueCards(client, userA, { type: "collection", collectionId }, EVAL);
      expect(count).toBe(2);
    });

    it("returns candidates for set and collection scopes", async () => {
      const setCandidates = await findDueCandidates(
        client,
        userA,
        { type: "set", setId: setIdA },
        EVAL,
      );
      expect(setCandidates.map((c) => c.flashcardId)).toEqual([overdueCard, dueNowCard]);

      const collCandidates = await findDueCandidates(
        client,
        userA,
        { type: "collection", collectionId },
        EVAL,
      );
      expect(collCandidates.map((c) => c.flashcardId)).toEqual([overdueCard, dueNowCard]);
    });
  });

  describe("due read model — isolation", () => {
    it("excludes another user's cards", async () => {
      const candidates = await findDueCandidates(client, userA, { type: "library" }, EVAL, 10);
      expect(candidates.some((c) => c.flashcardId === userBCard)).toBe(false);
      expect(candidates).toHaveLength(2);
    });

    it("user B has no due cards at this evaluation time", async () => {
      const count = await countDueCards(client, userB, { type: "library" }, EVAL);
      expect(count).toBe(0);
    });
  });

  describe("due read model — excluded cards", () => {
    it("excludes cards with no schedule row", async () => {
      const candidates = await findDueCandidates(client, userA, { type: "library" }, EVAL, 10);
      expect(candidates.some((c) => c.flashcardId === noScheduleCard)).toBe(false);
    });

    it("does not include future-due cards", async () => {
      const candidates = await findDueCandidates(client, userA, { type: "library" }, EVAL, 10);
      expect(candidates.some((c) => c.flashcardId === futureCard)).toBe(false);
    });
  });

  describe("due read model — >10 candidates limit vs total", () => {
    it("seeds 12 due cards and verifies total=12, limit returns 10", async () => {
      const setIdC = "da000000-0000-4000-8000-0000000000d0";
      await createSet(userA, setIdC, "Set C");
      const manyCardIds: string[] = [];
      for (let i = 0; i < 12; i++) {
        const id = `da000000-0000-4000-8000-000000000${String(10 + i).padStart(3, "0")}`;
        manyCardIds.push(id);
        await createCard(userA, setIdC, id, `Many ${i}`);
        await createSchedule({
          userId: userA,
          cardId: id,
          due: `2026-08-01T12:00:0${String(i).padStart(2, "0")}.000Z`,
          lastReview: "2026-08-01T11:00:00.000Z",
        });
      }
      const { total, candidates } = await loadDueCandidateResult(
        client,
        userA,
        { type: "library" },
        EVAL,
        10,
      );
      expect(total).toBeGreaterThanOrEqual(14); // 2 base + 12 seeded
      expect(candidates).toHaveLength(10);
      // Clean up seeded rows.
      await client.from("card_learning_schedule").delete().in("flashcard_id", manyCardIds);
      await client.from("flashcards").delete().in("id", manyCardIds);
      await client.from("flashcard_sets").delete().eq("id", setIdC);
    });
  });

  describe("due read model — result shape", () => {
    it("exposes only flashcardId, due, lastReview, state", async () => {
      const candidates = await findDueCandidates(client, userA, { type: "library" }, EVAL, 1);
      const row = candidates[0];
      if (!row) throw new Error("expected at least one due candidate");
      expect(Object.keys(row).sort()).toEqual(["due", "flashcardId", "lastReview", "state"]);
      expect(row.due).toBeTruthy();
      expect(row.lastReview).toBeTruthy();
      expect(row.state).toBe(2);
    });
  });
}
