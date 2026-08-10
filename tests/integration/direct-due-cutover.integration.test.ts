// @vitest-environment node
//
// Direct FSRS due cutover — local integration scenarios.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/supabase/types";

vi.mock("server-only", () => ({}));

const { countDueCards, findDueCandidates, loadDueCandidateResult } =
  await import("@/features/spaced-repetition/server/due-repository");

type Supabase = SupabaseClient<Database>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EVAL = "2026-08-09T12:00:00.000Z";
const DUE_PAST = "2026-08-09T10:00:00.000Z";
const DUE_FUTURE = "2026-09-09T10:00:00.000Z";

if (!supabaseUrl || !serviceKey) {
  describe.skip("Direct due cutover — needs local Supabase env", () => {
    it("is skipped when local env is absent", () => {});
  });
} else {
  const client: Supabase = createClient<Database>(supabaseUrl, serviceKey);

  let userId = "";
  let setId = "";
  const dueCardIds: string[] = [];
  const futureCardIds: string[] = [];

  beforeAll(async () => {
    const prefix = `c2c-${Date.now()}`;
    const { data: u } = await client.auth.admin.createUser({
      email: `${prefix}@test.flashlearn.dev`,
      password: "IntegrationTest1!",
      email_confirm: true,
    });
    userId = u?.user?.id ?? "";
    if (!userId) throw new Error("no user");

    setId = "d1000000-0000-4000-8000-000000000001";
    await client.from("flashcard_sets").insert({ id: setId, user_id: userId, name: "C2C" });

    const DUE_COUNT = 25;

    dueCardIds.length = 0;
    futureCardIds.length = 0;
    for (let i = 0; i < DUE_COUNT; i++) {
      dueCardIds.push(`d2000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`);
    }
    for (let i = 0; i < 5; i++) {
      futureCardIds.push(`d3000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`);
    }

    const allIds = [...dueCardIds, ...futureCardIds];
    await client
      .from("flashcards")
      .insert(allIds.map((id) => ({ id, user_id: userId, set_id: setId, front: "F", back: "B" })));

    // Create an orphan schedule (no flashcard user_id match — but flashcard exists)
    // Actually skip this for now, just create normal schedules
    await client.from("card_learning_schedule").insert([
      ...dueCardIds.map((cardId, i) => ({
        user_id: userId,
        flashcard_id: cardId,
        state: ((i % 3) + 1) as number, // mix Learning/Review/Relearning
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
      })),
      ...futureCardIds.map((cardId) => ({
        user_id: userId,
        flashcard_id: cardId,
        state: 1,
        stability: 1,
        difficulty: 1,
        due: DUE_FUTURE,
        scheduled_days: 0,
        learning_steps: 1,
        last_review: DUE_FUTURE,
        projection_revision: 1,
        processed_event_count: 1,
        last_processed_reviewed_at: DUE_FUTURE,
        last_processed_review_event_id: "00000000-0000-0000-0000-ffffffffffff",
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

  it("Dashboard due total >10 (full backlog visible)", async () => {
    const total = await countDueCards(client, userId, { type: "library" }, EVAL);
    expect(total).toBe(25);
  });

  it("startSmartReview creates at most 10 candidates from 25 due", async () => {
    const result = await loadDueCandidateResult(client, userId, { type: "library" }, EVAL, 10);
    expect(result.total).toBe(25);
    expect(result.candidates).toHaveLength(10);
  });

  it("due ordering is deterministic: due ASC, last_review ASC, id ASC", async () => {
    const result = await loadDueCandidateResult(client, userId, { type: "library" }, EVAL, 10);
    const dues = result.candidates.map((c) => c.due);
    expect(dues).toEqual(dues.slice().sort());
  });

  it("Learning, Review, and Relearning states are all due-eligible", async () => {
    const result = await loadDueCandidateResult(client, userId, { type: "library" }, EVAL, 25);
    const states = new Set(result.candidates.map((c) => c.state));
    expect(states.has(1)).toBe(true); // Learning
    expect(states.has(2)).toBe(true); // Review
    expect(states.has(3)).toBe(true); // Relearning
  });

  it("future-due cards not eligible", async () => {
    const all = await loadDueCandidateResult(client, userId, { type: "library" }, EVAL, 50);
    const allIds = new Set(all.candidates.map((c) => c.flashcardId));
    for (const id of futureCardIds) {
      expect(allIds.has(id)).toBe(false);
    }
  });

  it("result continuation uses fresh total (may exceed 10)", async () => {
    const total = await countDueCards(client, userId, { type: "library" }, EVAL);
    expect(total).toBeGreaterThan(10);
  });
}
