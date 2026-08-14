// @vitest-environment node
//
// Reproduces the card-scope mismatch condition found in production:
// schedule.user_id differs from flashcard.user_id, causing FSRS due
// to see the card but MasterySnapshot to exclude it.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { Database } from "@/lib/supabase/types";

vi.mock("server-only", () => ({}));

const { loadCardMasteries } = await import("@/features/mastery/server/load-card-masteries");

const { countDueCards, findDueCandidates } =
  await import("@/features/spaced-repetition/server/due-repository");

type Supabase = SupabaseClient<Database>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EVAL = "2026-08-09T12:00:00.000Z";
const DUE = "2026-08-09T10:00:00.000Z";

if (!supabaseUrl || !serviceKey) {
  describe.skip("Card-scope mismatch — needs local Supabase env", () => {
    it("is skipped when local env is absent", () => {});
  });
} else {
  const client: Supabase = createClient<Database>(supabaseUrl, serviceKey);

  let userA = "";
  let userB = "";
  let cardAId = "";

  beforeAll(async () => {
    const prefix = `card-scope-${Date.now()}`;
    const { data: dataA, error: errA } = await client.auth.admin.createUser({
      email: `${prefix}-a@test.capystudy.dev`,
      password: "IntegrationTest1!",
      email_confirm: true,
    });
    if (errA || !dataA?.user) throw errA ?? new Error("no user A");
    userA = dataA.user.id;

    const { data: dataB, error: errB } = await client.auth.admin.createUser({
      email: `${prefix}-b@test.capystudy.dev`,
      password: "IntegrationTest1!",
      email_confirm: true,
    });
    if (errB || !dataB?.user) throw errB ?? new Error("no user B");
    userB = dataB.user.id;

    const setIdA = "f0000000-0000-4000-8000-000000000001";
    await client.from("flashcard_sets").insert({
      id: setIdA,
      user_id: userA,
      name: "OwnershipTest",
    });

    cardAId = "f0000000-0000-4000-8000-00000000000a";
    await client.from("flashcards").insert({
      id: cardAId,
      user_id: userA,
      set_id: setIdA,
      front: "Front A",
      back: "Back A",
    });

    // Create a review event owned by user A
    await client.from("card_review_events").insert({
      user_id: userA,
      flashcard_id: cardAId,
      source: "study_recall",
      is_correct: true,
      fsrs_rating: 3,
      reviewed_at: new Date(Date.now() - 86400000).toISOString(),
    });

    // Create a schedule row for user B referencing user A's card
    // This simulates the production inconsistency
    await client.from("card_learning_schedule").insert({
      user_id: userB,
      flashcard_id: cardAId,
      state: 1,
      stability: 1,
      difficulty: 1,
      due: DUE,
      scheduled_days: 0,
      learning_steps: 1,
      last_review: DUE,
      projection_revision: 1,
      processed_event_count: 1,
      last_processed_reviewed_at: DUE,
      last_processed_review_event_id: "00000000-0000-0000-0000-000000000000",
      algorithm: "fsrs-6",
      implementation: "ts-fsrs@5.4.1",
      parameter_set: "capystudy-v1",
    });

    await client.from("profiles").upsert({ id: userA });
    await client.from("profiles").upsert({ id: userB });
  }, 60000);

  afterAll(async () => {
    if (userA) await client.auth.admin.deleteUser(userA);
    if (userB) await client.auth.admin.deleteUser(userB);
  }, 30000);

  describe("FSRS due sees card owned by another user", () => {
    it("countDueCards returns 1 for user B (schedule owner)", async () => {
      const count = await countDueCards(client, userB, { type: "library" }, EVAL);
      expect(count).toBe(1);
    });

    it("findDueCandidates returns the card for user B", async () => {
      const candidates = await findDueCandidates(client, userB, { type: "library" }, EVAL);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].flashcardId).toBe(cardAId);
    });

    it("countDueCards returns 0 for user A (card owner, no schedule)", async () => {
      const count = await countDueCards(client, userA, { type: "library" }, EVAL);
      expect(count).toBe(0);
    });
  });

  describe("MasterySnapshot excludes foreign-user card", () => {
    it("scoped Mastery (user B's own flashcards) does not include user A's card", async () => {
      // Simulate the diagnostic's findActiveCardIdsInScope pattern
      const userBCardIds: string[] = [];
      let start = 0;
      while (true) {
        const { data } = await client
          .from("flashcards")
          .select("id")
          .eq("user_id", userB)
          .order("id", { ascending: true })
          .range(start, start + 999);
        const page = data ?? [];
        userBCardIds.push(...page.map((r) => r.id));
        if (page.length < 1000) break;
        start += 1000;
      }

      expect(userBCardIds).not.toContain(cardAId);
    });

    it("Mastery for user A's own flashcards includes the card", async () => {
      const userACardIds: string[] = [];
      let start = 0;
      while (true) {
        const { data } = await client
          .from("flashcards")
          .select("id")
          .eq("user_id", userA)
          .order("id", { ascending: true })
          .range(start, start + 999);
        const page = data ?? [];
        userACardIds.push(...page.map((r) => r.id));
        if (page.length < 1000) break;
        start += 1000;
      }

      expect(userACardIds).toContain(cardAId);

      const masteries = await loadCardMasteries(client, userACardIds, EVAL);
      const ids = masteries.map((m) => m.flashcardId);
      expect(ids).toContain(cardAId);
    });
  });
}
