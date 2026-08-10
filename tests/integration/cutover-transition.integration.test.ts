// @vitest-environment node
//
// REAL local-Supabase integration for FSRS Smart Review cutover scenarios.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/supabase/types";

vi.mock("server-only", () => ({}));

const { loadTransitionQueue } =
  await import("@/features/spaced-repetition/server/transition-queue");
const { reconcileCardSchedule } =
  await import("@/features/spaced-repetition/server/reconcile-card-schedule");

type Supabase = SupabaseClient<Database>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const DUE_PAST = "2026-08-09T10:00:00.000Z";
const EVAL = "2026-08-09T12:00:00.000Z";

if (!supabaseUrl || !serviceKey || !publishableKey) {
  describe.skip("Cutover integration — needs local Supabase env", () => {
    it("is skipped when local env is absent", () => {});
  });
} else {
  const client: Supabase = createClient<Database>(supabaseUrl, serviceKey);

  let userId = "";
  let setId = "";
  let userClient: Supabase;
  const normalCardIds: string[] = [];
  const legacyCardIds: string[] = [];
  const normalEventIds: string[] = [];
  const legacyEventIds: string[] = [];

  beforeAll(async () => {
    const prefix = `c2b-${Date.now()}`;
    const email = `${prefix}@test.flashlearn.dev`;
    const password = "IntegrationTest1!";
    const { data: u } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    userId = u?.user?.id ?? "";
    if (!userId) throw new Error("no user");
    userClient = createClient<Database>(supabaseUrl, publishableKey);
    const signedIn = await userClient.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;

    setId = "c1000000-0000-4000-8000-000000000001";
    await client.from("flashcard_sets").insert({ id: setId, user_id: userId, name: "C2B" });

    const COUNT = 12;

    normalCardIds.length = 0;
    normalEventIds.length = 0;
    for (let i = 0; i < COUNT; i++) {
      normalCardIds.push(`c2000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`);
      normalEventIds.push(`c3000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`);
    }

    legacyCardIds.length = 0;
    legacyEventIds.length = 0;
    for (let i = 0; i < COUNT; i++) {
      legacyCardIds.push(`c4000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`);
      legacyEventIds.push(`c5000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`);
    }

    const allCardIds = [...normalCardIds, ...legacyCardIds];

    await client.from("flashcards").insert(
      allCardIds.map((id) => ({
        id,
        user_id: userId,
        set_id: setId,
        front: `Front ${id}`,
        back: `Back ${id}`,
      })),
    );

    // Events: normal get explicit rating=3, legacy get null rating
    await client.from("card_review_events").insert([
      ...normalCardIds.map((cardId, i) => ({
        id: normalEventIds[i],
        user_id: userId,
        flashcard_id: cardId,
        source: "study_recall" as const,
        is_correct: true,
        fsrs_rating: 3,
        reviewed_at: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
      })),
      ...legacyCardIds.map((cardId, i) => ({
        id: legacyEventIds[i],
        user_id: userId,
        flashcard_id: cardId,
        source: "study_recall" as const,
        is_correct: true,
        fsrs_rating: null as number | null,
        reviewed_at: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
      })),
    ]);

    // Schedules: all Learning, scheduled_days=0, due now
    await client.from("card_learning_schedule").insert([
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
    ]);

    await client.from("profiles").upsert({ id: userId });
  }, 60000);

  afterAll(async () => {
    if (userId) await client.auth.admin.deleteUser(userId);
  }, 30000);

  describe("Scenario A: 12 normal + 12 legacy => first 10 normal", () => {
    it("raw due = 24, normal past = 12, session has 10 normal", async () => {
      const q = await loadTransitionQueue(client, userId, { type: "library" }, EVAL);
      expect(q.rawDueTotal).toBe(24);
      expect(q.normalDueTotal).toBe(12);
      expect(q.legacyDebtTotal).toBe(12);
      expect(q.normalSelected).toBe(10);
      expect(q.legacySelected).toBe(0);
      expect(q.actionableNow).toBe(10);
      expect(q.candidates).toHaveLength(10);
    });

    it("persists the queue's ordered targets as quiz question positions", async () => {
      const queue = await loadTransitionQueue(client, userId, { type: "library" }, EVAL);
      const targetIds = queue.candidates.map((item) => item.candidate.flashcardId);
      const { data: sessionId, error } = await client.rpc(
        "create_owned_quiz_session_from_card_ids",
        { p_user_id: userId, p_card_ids: targetIds },
      );
      if (error || !sessionId) throw error ?? new Error("Missing explicit quiz session");

      const questions = await client
        .from("quiz_questions")
        .select("source_flashcard_id")
        .eq("session_id", sessionId)
        .order("position", { ascending: true });
      expect(questions.error).toBeNull();
      expect(questions.data?.map((question) => question.source_flashcard_id)).toEqual(targetIds);
      expect(questions.data).toHaveLength(10);
    });
  });

  describe("Scenario B: simulate drain => after some reviews, fewer normal", () => {
    it("with only 7 normal remaining, 3 legacy fill in", async () => {
      // Simulate draining 5 normal cards by removing them from schedule
      const drainedIds = normalCardIds.slice(0, 5);
      await client
        .from("card_learning_schedule")
        .delete()
        .eq("user_id", userId)
        .in("flashcard_id", drainedIds);

      const q = await loadTransitionQueue(client, userId, { type: "library" }, EVAL);
      expect(q.normalDueTotal).toBe(7); // 12 - 5
      expect(q.normalSelected).toBe(7);
      expect(q.legacySelected).toBe(3);
      expect(q.actionableNow).toBe(10);
    });
  });

  describe("Scenario C: 0 normal, all legacy", () => {
    it("10 legacy selected when no normal remain", async () => {
      // Drain all remaining normal cards
      const remainingNormalIds = normalCardIds.slice(5);
      await client
        .from("card_learning_schedule")
        .delete()
        .eq("user_id", userId)
        .in("flashcard_id", remainingNormalIds);

      const q = await loadTransitionQueue(client, userId, { type: "library" }, EVAL);
      expect(q.normalDueTotal).toBe(0);
      expect(q.legacyDebtTotal).toBe(12);
      expect(q.normalSelected).toBe(0);
      expect(q.legacySelected).toBe(10);
      expect(q.actionableNow).toBe(10);
    });

    it("exits legacy classification after an explicit-rated quiz answer and reconciliation", async () => {
      const legacyQueue = await loadTransitionQueue(client, userId, { type: "library" }, EVAL);
      const legacyCardId = legacyQueue.candidates[0]?.candidate.flashcardId;
      expect(legacyCardId).toBeTruthy();

      const { data: sessionId, error: sessionError } = await client.rpc(
        "create_owned_quiz_session_from_card_ids",
        { p_user_id: userId, p_card_ids: [legacyCardId as string] },
      );
      if (sessionError || !sessionId) {
        throw sessionError ?? new Error("Missing explicit quiz session");
      }
      const question = await client
        .from("quiz_questions")
        .select("id, correct_choice_index")
        .eq("session_id", sessionId)
        .single();
      if (question.error || !question.data) throw question.error ?? new Error("Missing question");

      const answered = await userClient.rpc("submit_quiz_answer", {
        p_question_id: question.data.id,
        p_selected_choice_index: question.data.correct_choice_index,
      });
      if (answered.error || !answered.data?.[0]) {
        throw answered.error ?? new Error("Missing answer result");
      }
      expect(answered.data[0].flashcard_id).toBe(legacyCardId);
      await reconcileCardSchedule(userClient, userId, legacyCardId as string);

      const event = await client
        .from("card_review_events")
        .select("fsrs_rating")
        .eq("id", answered.data[0].review_event_id)
        .single();
      expect(event.data?.fsrs_rating).toBe(3);

      const futureQueue = await loadTransitionQueue(
        client,
        userId,
        { type: "library" },
        "2030-01-01T00:00:00.000Z",
      );
      expect(
        futureQueue.candidates.find((item) => item.candidate.flashcardId === legacyCardId)
          ?.classification,
      ).toBe("normal");
    });
  });

  describe("Scenario D: fresh evaluationTime", () => {
    it("different evaluationTime produces consistent count", async () => {
      const q = await loadTransitionQueue(client, userId, { type: "library" }, EVAL);
      const q2 = await loadTransitionQueue(
        client,
        userId,
        { type: "library" },
        "2026-08-09T12:01:00.000Z",
      );
      // Same cards, same due, should produce same count
      expect(q2.actionableNow).toBe(q.actionableNow);
    });
  });

  describe("Scenario E: fill respects max of 10", () => {
    it("actionableNow is never more than 10", async () => {
      // Restore all 12 normal cards
      for (let i = 0; i < 12; i++) {
        await client.from("card_learning_schedule").upsert({
          user_id: userId,
          flashcard_id: normalCardIds[i],
          state: 1,
          stability: 1,
          difficulty: 1,
          due: DUE_PAST,
          scheduled_days: 0,
          learning_steps: 1,
          last_review: DUE_PAST,
          projection_revision: 2,
          processed_event_count: 1,
          last_processed_reviewed_at: DUE_PAST,
          last_processed_review_event_id: normalEventIds[i],
          algorithm: "fsrs-6",
          implementation: "ts-fsrs@5.4.1",
          parameter_set: "flashlearn-v1",
        });
      }

      const q = await loadTransitionQueue(client, userId, { type: "library" }, EVAL);
      expect(q.actionableNow).toBeLessThanOrEqual(10);
    });
  });
}
