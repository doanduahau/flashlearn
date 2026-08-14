// @vitest-environment node
// Real local-Supabase Task D coverage: answer RPC → immutable event → shadow reconciliation.

import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createCapyStudyScheduler } from "@/features/spaced-repetition/config";
import { reconcileCardSchedule } from "@/features/spaced-repetition/server/reconcile-card-schedule";
import { replayReviewHistory } from "@/features/spaced-repetition/utils/replay-history";
import type { Database } from "@/lib/supabase/types";

type Supabase = SupabaseClient<Database>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !serviceRoleKey || !publishableKey) {
  describe.skip("FSRS shadow quiz integration — needs local Supabase credentials", () => {
    it("is skipped without local credentials", () => {});
  });
} else {
  const localUrl: string = url;
  const localPublishableKey: string = publishableKey;
  const admin: Supabase = createClient<Database>(localUrl, serviceRoleKey);
  const createdUsers: string[] = [];

  async function createUserClient(tag: string): Promise<{ userId: string; client: Supabase }> {
    const email = `fsrs-shadow-${tag}-${randomUUID()}@test.capystudy.dev`;
    const password = "IntegrationTest1!";
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) throw error ?? new Error("Missing integration user");
    createdUsers.push(data.user.id);

    const client: Supabase = createClient<Database, "public">(localUrl, localPublishableKey);
    const signedIn = await client.auth.signInWithPassword({ email, password });
    if (signedIn.error) throw signedIn.error;
    return { userId: data.user.id, client };
  }

  async function createCardFixture(userId: string) {
    const setId = randomUUID();
    const targetId = randomUUID();
    const distractorId = randomUUID();
    const { error } = await admin
      .from("flashcard_sets")
      .insert({ id: setId, user_id: userId, name: "FSRS" });
    if (error) throw error;
    const cards = await admin.from("flashcards").insert([
      { id: targetId, user_id: userId, set_id: setId, front: "Target", back: "Target answer" },
      {
        id: distractorId,
        user_id: userId,
        set_id: setId,
        front: "Distractor",
        back: "Distractor answer",
      },
    ]);
    if (cards.error) throw cards.error;
    return { setId, targetId, distractorId };
  }

  async function createManualQuestion(userId: string, targetId: string) {
    const sessionId = randomUUID();
    const questionId = randomUUID();
    const session = await admin.from("quiz_sessions").insert({
      id: sessionId,
      user_id: userId,
      mode: "balanced",
      requested_question_count: 1,
      actual_question_count: 1,
      source_set_ids: [],
      source_collection_ids: [],
      source_all: true,
    });
    if (session.error) throw session.error;
    const question = await admin.from("quiz_questions").insert({
      id: questionId,
      session_id: sessionId,
      user_id: userId,
      position: 0,
      flashcard_id: targetId,
      source_flashcard_id: targetId,
      prompt: "Target",
      correct_answer: "Target answer",
      choices: ["Target answer", "Distractor answer"],
      correct_choice_index: 0,
    });
    if (question.error) throw question.error;
    return { sessionId, questionId };
  }

  async function answer(client: Supabase, questionId: string, choice: number) {
    const { data, error } = await client.rpc("submit_quiz_answer", {
      p_question_id: questionId,
      p_selected_choice_index: choice,
    });
    if (error || !data?.[0]) throw error ?? new Error("Missing answer result");
    return data[0];
  }

  async function expectProjectionMatchesReplay(userId: string, cardId: string) {
    const events = await admin
      .from("card_review_events")
      .select("id, reviewed_at, is_correct, fsrs_rating")
      .eq("user_id", userId)
      .eq("flashcard_id", cardId)
      .order("reviewed_at", { ascending: true })
      .order("id", { ascending: true });
    if (!events.data) throw new Error("Missing replay events");
    const replay = replayReviewHistory(
      events.data.map((event) => ({
        eventId: event.id,
        reviewedAt: event.reviewed_at,
        isCorrect: event.is_correct,
        fsrsRating: event.fsrs_rating,
      })),
      createCapyStudyScheduler(),
    );
    if (!replay) throw new Error("Expected a schedulable replay state");
    const schedule = await admin
      .from("card_learning_schedule")
      .select(
        "state, stability, difficulty, reps, lapses, processed_event_count, last_processed_review_event_id",
      )
      .eq("user_id", userId)
      .eq("flashcard_id", cardId)
      .single();
    expect(schedule.data).toMatchObject({
      state:
        replay.state === "New"
          ? 0
          : replay.state === "Learning"
            ? 1
            : replay.state === "Review"
              ? 2
              : 3,
      reps: replay.reps,
      lapses: replay.lapses,
      processed_event_count: events.data.length,
      last_processed_review_event_id: events.data.at(-1)?.id,
    });
    expect(schedule.data?.stability).toBeCloseTo(replay.stability, 8);
    expect(schedule.data?.difficulty).toBeCloseTo(replay.difficulty, 8);
  }

  afterAll(async () => {
    for (const userId of createdUsers) await admin.auth.admin.deleteUser(userId);
  });

  describe("FSRS shadow quiz integration", () => {
    let userId = "";
    let userClient: Supabase;
    let targetId = "";
    let distractorId = "";

    beforeAll(async () => {
      const user = await createUserClient("main");
      userId = user.userId;
      userClient = user.client;
      ({ targetId, distractorId } = await createCardFixture(userId));
    });

    it("projects a first manual correct answer and keeps distractors out of history", async () => {
      const { sessionId, questionId } = await createManualQuestion(userId, targetId);
      const result = await answer(userClient, questionId, 0);
      expect(result.is_correct).toBe(true);
      expect(result.flashcard_id).toBe(targetId);
      expect(result.review_event_id).toBeTruthy();
      await reconcileCardSchedule(userClient, userId, result.flashcard_id);

      const event = await admin
        .from("card_review_events")
        .select("is_correct, fsrs_rating")
        .eq("id", result.review_event_id)
        .single();
      expect(event.data).toMatchObject({ is_correct: true, fsrs_rating: 3 });
      const schedule = await admin
        .from("card_learning_schedule")
        .select("processed_event_count")
        .eq("user_id", userId)
        .eq("flashcard_id", targetId)
        .single();
      expect(schedule.data?.processed_event_count).toBe(1);
      await expectProjectionMatchesReplay(userId, targetId);
      const distractorEvents = await admin
        .from("card_review_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("flashcard_id", distractorId);
      expect(distractorEvents.count).toBe(0);
      const origin = await admin
        .from("quiz_sessions")
        .select("origin")
        .eq("id", sessionId)
        .single();
      expect(origin.data?.origin).toBe("manual");
    });

    it("increments the same target projection after a second real incorrect manual review", async () => {
      const { questionId } = await createManualQuestion(userId, targetId);
      const result = await answer(userClient, questionId, 1);
      expect(result.is_correct).toBe(false);
      await reconcileCardSchedule(userClient, userId, result.flashcard_id);

      const events = await admin
        .from("card_review_events")
        .select("id, fsrs_rating")
        .eq("user_id", userId)
        .eq("flashcard_id", targetId);
      expect(events.data).toHaveLength(2);
      expect(events.data?.some((event) => event.fsrs_rating === 1)).toBe(true);
      const schedule = await admin
        .from("card_learning_schedule")
        .select("processed_event_count")
        .eq("user_id", userId)
        .eq("flashcard_id", targetId)
        .single();
      expect(schedule.data?.processed_event_count).toBe(2);
      await expectProjectionMatchesReplay(userId, targetId);
    });

    it("uses identical rating/projection semantics for a Smart Review session", async () => {
      const session = await admin.rpc("create_owned_quiz_session_from_card_ids", {
        p_user_id: userId,
        p_card_ids: [targetId],
      });
      if (session.error || !session.data)
        throw session.error ?? new Error("Missing Smart Review session");
      const question = await admin
        .from("quiz_questions")
        .select("id, correct_choice_index")
        .eq("session_id", session.data)
        .single();
      if (!question.data) throw new Error("Missing Smart Review question");
      const result = await answer(userClient, question.data.id, question.data.correct_choice_index);
      await reconcileCardSchedule(userClient, userId, result.flashcard_id);

      const event = await admin
        .from("card_review_events")
        .select("fsrs_rating")
        .eq("id", result.review_event_id)
        .single();
      expect(event.data?.fsrs_rating).toBe(3);
      const origin = await admin
        .from("quiz_sessions")
        .select("origin")
        .eq("id", session.data)
        .single();
      expect(origin.data?.origin).toBe("smart_review");
      const schedule = await admin
        .from("card_learning_schedule")
        .select("processed_event_count")
        .eq("user_id", userId)
        .eq("flashcard_id", targetId)
        .single();
      expect(schedule.data?.processed_event_count).toBe(3);
    });

    it("repairs a skipped shadow write through the same-choice retry without another event or daily completion", async () => {
      const user = await createUserClient("repair");
      const cards = await createCardFixture(user.userId);
      const { questionId } = await createManualQuestion(user.userId, cards.targetId);
      const first = await answer(user.client, questionId, 0);
      const absent = await admin
        .from("card_learning_schedule")
        .select("id")
        .eq("user_id", user.userId)
        .eq("flashcard_id", cards.targetId)
        .maybeSingle();
      expect(absent.data).toBeNull();

      const retry = await answer(user.client, questionId, 0);
      expect(retry.review_event_id).toBe(first.review_event_id);
      await reconcileCardSchedule(user.client, user.userId, retry.flashcard_id);
      const eventCount = await admin
        .from("card_review_events")
        .select("id", { count: "exact", head: true })
        .eq("quiz_question_id", questionId);
      expect(eventCount.count).toBe(1);
      const daily = await admin
        .from("daily_learning_records")
        .select("completed_quiz_count")
        .eq("user_id", user.userId)
        .single();
      expect(daily.data?.completed_quiz_count).toBe(1);
      const repaired = await admin
        .from("card_learning_schedule")
        .select("processed_event_count")
        .eq("user_id", user.userId)
        .eq("flashcard_id", cards.targetId)
        .single();
      expect(repaired.data?.processed_event_count).toBe(1);
    });
  });
}
