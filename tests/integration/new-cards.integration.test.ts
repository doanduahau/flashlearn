// @vitest-environment node
//
// Real local-Supabase coverage for the RLS-scoped New Cards read model.

import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/supabase/types";

vi.mock("server-only", () => ({}));

const { countNewCards, loadNewCardCandidateResult } =
  await import("@/features/spaced-repetition/server/new-cards-repository");

type Supabase = SupabaseClient<Database>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !serviceKey || !publishableKey) {
  describe.skip("New Cards — needs local Supabase env", () => {
    it("is skipped when local Supabase is absent", () => {});
  });
} else {
  const admin: Supabase = createClient<Database>(supabaseUrl, serviceKey);
  let client: Supabase;
  let userId = "";
  let setId = "";

  const newCards: Array<{ id: string; createdAt: string }> = [];
  const scheduled: string[] = [];
  const explicitRatings: string[] = [];
  const booleanFallbacks: string[] = [];
  const nullOnly: string[] = [];

  beforeAll(async () => {
    const email = `d1-${randomUUID()}@test.capystudy.dev`;
    const password = "IntegrationTest1!";
    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (userError || !userData.user) throw userError ?? new Error("Missing integration user");
    userId = userData.user.id;

    client = createClient<Database>(supabaseUrl, publishableKey);
    const signedIn = await client.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;

    setId = randomUUID();
    const setInsert = await admin
      .from("flashcard_sets")
      .insert({ id: setId, user_id: userId, name: "D1 New Cards" });
    if (setInsert.error) throw setInsert.error;

    for (let index = 0; index < 15; index += 1) {
      newCards.push({
        id: randomUUID(),
        createdAt: `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      });
    }
    for (let index = 0; index < 4; index += 1) scheduled.push(randomUUID());
    for (let index = 0; index < 2; index += 1) explicitRatings.push(randomUUID());
    for (let index = 0; index < 2; index += 1) booleanFallbacks.push(randomUUID());
    nullOnly.push(randomUUID());

    const allCardIds = [
      ...newCards.map((card) => card.id),
      ...scheduled,
      ...explicitRatings,
      ...booleanFallbacks,
      ...nullOnly,
    ];
    const cardsInsert = await admin.from("flashcards").insert(
      allCardIds.map((id, index) => {
        const newCard = newCards.find((card) => card.id === id);
        return {
          id,
          user_id: userId,
          set_id: setId,
          front: `Front ${index}`,
          back: `Back ${index}`,
          created_at: newCard?.createdAt ?? "2026-02-01T00:00:00.000Z",
        };
      }),
    );
    if (cardsInsert.error) throw cardsInsert.error;

    const scheduleInsert = await admin.from("card_learning_schedule").insert(
      scheduled.map((id) => ({
        user_id: userId,
        flashcard_id: id,
        state: 1,
        stability: 1,
        difficulty: 1,
        due: "2026-08-09T10:00:00.000Z",
        scheduled_days: 0,
        learning_steps: 1,
        last_review: "2026-08-09T10:00:00.000Z",
        projection_revision: 1,
        processed_event_count: 1,
        last_processed_reviewed_at: "2026-08-09T10:00:00.000Z",
        last_processed_review_event_id: randomUUID(),
        algorithm: "fsrs-6",
        implementation: "ts-fsrs@5.4.1",
        parameter_set: "capystudy-v1",
      })),
    );
    if (scheduleInsert.error) throw scheduleInsert.error;

    const eventInsert = await admin.from("card_review_events").insert([
      {
        user_id: userId,
        flashcard_id: explicitRatings[0],
        source: "study_recall",
        is_correct: true,
        fsrs_rating: 1,
        reviewed_at: "2026-08-09T10:00:00.000Z",
      },
      {
        user_id: userId,
        flashcard_id: explicitRatings[1],
        source: "study_recall",
        is_correct: true,
        fsrs_rating: 4,
        reviewed_at: "2026-08-09T10:01:00.000Z",
      },
      {
        user_id: userId,
        flashcard_id: booleanFallbacks[0],
        source: "study_recall",
        is_correct: true,
        fsrs_rating: null,
        reviewed_at: "2026-08-09T10:02:00.000Z",
      },
      {
        user_id: userId,
        flashcard_id: booleanFallbacks[1],
        source: "study_recall",
        is_correct: false,
        fsrs_rating: null,
        reviewed_at: "2026-08-09T10:03:00.000Z",
      },
      {
        user_id: userId,
        flashcard_id: nullOnly[0],
        source: "study_recall",
        is_correct: null,
        fsrs_rating: null,
        reviewed_at: "2026-08-09T10:04:00.000Z",
      },
    ]);
    if (eventInsert.error) throw eventInsert.error;
  }, 60_000);

  afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  }, 30_000);

  describe("genuine New Cards", () => {
    it("uses the canonical explicit-rating or boolean-fallback schedulable predicate", async () => {
      await expect(countNewCards(client)).resolves.toBe(16);
    });

    it("excludes schedules and all schedulable event shapes while retaining null/null history", async () => {
      const result = await loadNewCardCandidateResult(client, 10);
      const ids = new Set(result.candidates.map((candidate) => candidate.flashcardId));

      expect(result.total).toBe(16);
      expect(result.candidates).toHaveLength(10);
      for (const id of [...scheduled, ...explicitRatings, ...booleanFallbacks]) {
        expect(ids.has(id)).toBe(false);
      }
      // The 10-card payload is intentionally capped; the exact total of 16
      // above proves the null/null-only fixture remains eligible alongside
      // the 15 ordinary New fixtures.
    });

    it("orders candidates by created_at then flashcard id", async () => {
      const result = await loadNewCardCandidateResult(client, 10);
      const expected = [...newCards]
        .sort((left, right) =>
          left.createdAt === right.createdAt
            ? left.id.localeCompare(right.id)
            : left.createdAt.localeCompare(right.createdAt),
        )
        .slice(0, 10)
        .map((card) => card.id);
      expect(result.candidates.map((candidate) => candidate.flashcardId)).toEqual(expected);
    });

    it("keeps abandoned targets New and removes only a card with an answered schedulable event", async () => {
      const before = await loadNewCardCandidateResult(client, 10);
      const abandonedCardId = before.candidates[0]?.flashcardId;
      const answeredCardId = before.candidates[1]?.flashcardId;
      if (!abandonedCardId || !answeredCardId) throw new Error("Missing New Card fixtures");

      const created = await admin.rpc("create_owned_quiz_session_from_card_ids_new_cards", {
        p_user_id: userId,
        p_card_ids: [abandonedCardId],
      });
      if (created.error || !created.data) throw created.error ?? new Error("Missing session");
      expect(await countNewCards(client)).toBe(16);

      const answered = await admin.rpc("create_owned_quiz_session_from_card_ids_new_cards", {
        p_user_id: userId,
        p_card_ids: [answeredCardId],
      });
      if (answered.error || !answered.data) throw answered.error ?? new Error("Missing session");
      const question = await client
        .from("quiz_questions")
        .select("id, correct_choice_index")
        .eq("session_id", answered.data)
        .single();
      if (question.error || !question.data) throw question.error ?? new Error("Missing question");

      const submitted = await client.rpc("submit_quiz_answer", {
        p_question_id: question.data.id,
        p_selected_choice_index: question.data.correct_choice_index,
      });
      if (submitted.error) throw submitted.error;

      const after = await loadNewCardCandidateResult(client, 10);
      expect(after.total).toBe(15);
      expect(after.candidates.some((candidate) => candidate.flashcardId === abandonedCardId)).toBe(
        true,
      );
      expect(after.candidates.some((candidate) => candidate.flashcardId === answeredCardId)).toBe(
        false,
      );
    });
  });
}
