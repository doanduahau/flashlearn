// @vitest-environment node
//
// New Cards read model integration tests.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/supabase/types";

vi.mock("server-only", () => ({}));

const { countNewCards, loadNewCardCandidateResult } =
  await import("@/features/spaced-repetition/server/new-cards-repository");

type Supabase = SupabaseClient<Database>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  describe.skip("New Cards — needs local Supabase env", () => {
    it("is skipped when local env is absent", () => {});
  });
} else {
  const client: Supabase = createClient<Database>(supabaseUrl, serviceKey);

  let userId = "";
  let setId = "";

  // 15 genuine new cards
  const newCards: string[] = [];
  // cards with schedules
  const scheduled: string[] = [];
  // no-schedule + explicit rating history (projection anomaly)
  const projectionAnomaly: string[] = [];
  // no-schedule + null/null event only (still new)
  const nullOnly: string[] = [];

  beforeAll(async () => {
    const prefix = `d1-${Date.now()}`;
    const { data: u } = await client.auth.admin.createUser({
      email: `${prefix}@test.flashlearn.dev`,
      password: "IntegrationTest1!",
      email_confirm: true,
    });
    userId = u?.user?.id ?? "";
    if (!userId) throw new Error("no user");

    setId = "e1000000-0000-4000-8000-000000000001";
    await client.from("flashcard_sets").insert({ id: setId, user_id: userId, name: "D1" });

    for (let i = 0; i < 15; i++) {
      newCards.push(`e1000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`);
    }
    for (let i = 0; i < 4; i++) {
      scheduled.push(`e2000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`);
    }
    for (let i = 0; i < 2; i++) {
      projectionAnomaly.push(`e3000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`);
    }
    for (let i = 0; i < 1; i++) {
      nullOnly.push(`e4000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`);
    }

    const allIds = [...newCards, ...scheduled, ...projectionAnomaly, ...nullOnly];
    await client
      .from("flashcards")
      .insert(allIds.map((id) => ({ id, user_id: userId, set_id: setId, front: "F", back: "B" })));

    // Schedules for scheduled cards
    await client.from("card_learning_schedule").insert(
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
        last_processed_review_event_id: "00000000-0000-0000-0000-ffffffffffff",
        algorithm: "fsrs-6",
        implementation: "ts-fsrs@5.4.1",
        parameter_set: "flashlearn-v1",
      })),
    );

    // Explicit rating events for projection anomaly
    await client.from("card_review_events").insert(
      projectionAnomaly.map((id) => ({
        user_id: userId,
        flashcard_id: id,
        source: "study_recall",
        is_correct: true,
        fsrs_rating: 3,
        reviewed_at: new Date().toISOString(),
      })),
    );

    // null/null events for nullOnly card
    await client.from("card_review_events").insert(
      nullOnly.map((id) => ({
        user_id: userId,
        flashcard_id: id,
        source: "study_recall",
        is_correct: null,
        fsrs_rating: null,
        reviewed_at: new Date().toISOString(),
      })),
    );

    await client.from("profiles").upsert({ id: userId });
  }, 60000);

  afterAll(async () => {
    if (userId) await client.auth.admin.deleteUser(userId);
  }, 30000);

  describe("genuine new cards", () => {
    it("count reflects only cards with no schedule and no schedulable events", async () => {
      const count = await countNewCards(client, userId);
      expect(count).toBe(16); // 15 genuine new + 1 null/null-only
    });

    it("scheduled cards excluded", async () => {
      const result = await loadNewCardCandidateResult(client, userId, 50);
      const ids = new Set(result.candidates.map((c) => c.flashcardId));
      for (const id of scheduled) expect(ids.has(id)).toBe(false);
    });

    it("projection anomaly excluded", async () => {
      const result = await loadNewCardCandidateResult(client, userId, 50);
      const ids = new Set(result.candidates.map((c) => c.flashcardId));
      for (const id of projectionAnomaly) expect(ids.has(id)).toBe(false);
    });

    it("null/null-only event card remains new", async () => {
      const result = await loadNewCardCandidateResult(client, userId, 50);
      const ids = new Set(result.candidates.map((c) => c.flashcardId));
      for (const id of nullOnly) expect(ids.has(id)).toBe(true);
    });

    it("batch limit respects max 10", async () => {
      const result = await loadNewCardCandidateResult(client, userId, 10);
      expect(result.total).toBe(16);
      expect(result.candidates).toHaveLength(10);
    });

    it("oldest created_at first, then flashcard_id tie-break", async () => {
      const result = await loadNewCardCandidateResult(client, userId, 16);
      const dates = result.candidates.map((c) => c.createdAt);
      expect(dates).toEqual(dates.slice().sort());
    });
  });
}
