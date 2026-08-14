// @vitest-environment node
//
// REAL local-Supabase integration coverage for FSRS schedule reconciliation.
// These tests require a running local Supabase stack and are skipped otherwise.
// Run via: npm run fsrs:test:local
//
// They exercise:
//   immutable review events → TypeScript replay → private CAS RPC
//   → card_learning_schedule → second reconciliation is a true no-op
// using real local Supabase rows and the real service-role RPC.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createEmptyCard, Rating, type Card, type Grade } from "ts-fsrs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createCapyStudyScheduler } from "@/features/spaced-repetition/config";
import {
  reconcileCardScheduleWithRepo,
  type ScheduleReconcileRepository,
  type ScheduleReconcileWriter,
} from "@/features/spaced-repetition/server/reconcile-orchestrator";
import type { Database } from "@/lib/supabase/types";
import {
  SCHEDULABLE_EVENT_OR_PREDICATE,
  isSchedulableEventRow,
  type ScheduleRow,
  type SchedulableEventRow,
} from "@/features/spaced-repetition/types/spaced-repetition-types";

type Supabase = SupabaseClient<Database>;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SCHEDULABLE_OR = SCHEDULABLE_EVENT_OR_PREDICATE;

function buildRepository(client: Supabase): ScheduleReconcileRepository {
  return {
    loadSchedule: async (userId, cardId) => {
      const { data } = await client
        .from("card_learning_schedule")
        .select("*")
        .eq("user_id", userId)
        .eq("flashcard_id", cardId)
        .maybeSingle();
      if (!data) return null;
      return {
        state: data.state,
        stability: data.stability,
        difficulty: data.difficulty,
        due: data.due,
        scheduledDays: data.scheduled_days,
        learningSteps: data.learning_steps,
        reps: data.reps,
        lapses: data.lapses,
        lastReview: data.last_review,
        projectionRevision: data.projection_revision,
        processedEventCount: data.processed_event_count,
        lastProcessedReviewedAt: data.last_processed_reviewed_at,
        lastProcessedReviewEventId: data.last_processed_review_event_id,
        algorithm: data.algorithm,
        implementation: data.implementation,
        parameterSet: data.parameter_set,
        updatedAt: data.updated_at,
      };
    },
    countSchedulableEvents: async (userId, cardId) => {
      const { count } = await client
        .from("card_review_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("flashcard_id", cardId)
        .or(SCHEDULABLE_OR);
      return count ?? 0;
    },
    loadSchedulableEventsAfter: async (userId, cardId, lastReviewedAt, lastEventId) => {
      const { data } = await client
        .from("card_review_events")
        .select("id, reviewed_at, is_correct, fsrs_rating")
        .eq("user_id", userId)
        .eq("flashcard_id", cardId)
        .or(
          `reviewed_at.gt.${lastReviewedAt},and(reviewed_at.eq.${lastReviewedAt},id.gt.${lastEventId})`,
        )
        .order("reviewed_at", { ascending: true })
        .order("id", { ascending: true });
      return (data ?? [])
        .map((row) => ({
          id: row.id,
          reviewedAt: row.reviewed_at,
          isCorrect: row.is_correct,
          fsrsRating: row.fsrs_rating,
        }))
        .filter(isSchedulableEventRow);
    },
    loadAllSchedulableEvents: async (userId, cardId) => {
      const results: SchedulableEventRow[] = [];
      let start = 0;
      while (true) {
        const { data } = await client
          .from("card_review_events")
          .select("id, reviewed_at, is_correct, fsrs_rating")
          .eq("user_id", userId)
          .eq("flashcard_id", cardId)
          .or(SCHEDULABLE_OR)
          .order("reviewed_at", { ascending: true })
          .order("id", { ascending: true })
          .range(start, start + 1000 - 1);
        const page = data ?? [];
        results.push(
          ...page.map((row) => ({
            id: row.id,
            reviewedAt: row.reviewed_at,
            isCorrect: row.is_correct,
            fsrsRating: row.fsrs_rating,
          })),
        );
        if (page.length < 1000) return results;
        start += 1000;
      }
    },
    checkCardActive: async (userId, cardId) => {
      const { count } = await client
        .from("flashcards")
        .select("id", { count: "exact", head: true })
        .eq("id", cardId)
        .eq("user_id", userId);
      return (count ?? 0) > 0;
    },
  };
}

function buildWriter(client: Supabase): ScheduleReconcileWriter {
  return {
    upsert: async ({
      userId,
      cardId,
      expectedProjectionRevision,
      card,
      processedEventCount,
      lastProcessedReviewedAt,
      lastProcessedReviewEventId,
    }: {
      userId: string;
      cardId: string;
      expectedProjectionRevision: number;
      card: Card;
      processedEventCount: number;
      lastProcessedReviewedAt: string;
      lastProcessedReviewEventId: string;
    }) => {
      const { data: revision, error } = await client.rpc("upsert_card_learning_schedule", {
        p_user_id: userId,
        p_flashcard_id: cardId,
        p_expected_projection_revision: expectedProjectionRevision,
        p_state: card.state,
        p_stability: card.stability,
        p_difficulty: card.difficulty,
        p_due: card.due.toISOString(),
        p_scheduled_days: card.scheduled_days,
        p_learning_steps: card.learning_steps,
        p_reps: card.reps,
        p_lapses: card.lapses,
        p_last_review: card.last_review?.toISOString() ?? card.due.toISOString(),
        p_processed_event_count: processedEventCount,
        p_last_processed_reviewed_at: lastProcessedReviewedAt,
        p_last_processed_review_event_id: lastProcessedReviewEventId,
        p_algorithm: "fsrs-6",
        p_implementation: "ts-fsrs@5.4.1",
        p_parameter_set: "capystudy-v1",
      });
      if (error) throw error;
      return revision as number;
    },
  };
}

if (!supabaseUrl || !serviceKey) {
  describe.skip("FSRS real-local reconciliation — needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY", () => {
    it("is skipped when local env is absent", () => {});
  });
} else {
  const client: Supabase = createClient<Database>(supabaseUrl, serviceKey);
  const repository = buildRepository(client);
  const writer = buildWriter(client);

  // Deterministic fixed timestamps
  const T0 = "2026-08-09T12:00:00.000Z";
  const T0_PLUS_5M = "2026-08-09T12:05:00.000Z";
  const T0_PLUS_1D = "2026-08-10T12:00:00.000Z";

  async function createUser(tag: string): Promise<string> {
    const email = `fsrs-it-${tag}-${Date.now()}@test.capystudy.dev`;
    const { data, error } = await client.auth.admin.createUser({
      email,
      password: "IntegrationTest1!",
      email_confirm: true,
    });
    if (error) throw error;
    if (!data?.user) throw new Error("createUser returned no user");
    return data.user.id;
  }

  async function createSet(userId: string, setId: string): Promise<void> {
    const { error } = await client.from("flashcard_sets").insert({
      id: setId,
      user_id: userId,
      name: `Set ${setId}`,
    });
    if (error) throw error;
  }

  async function createCard(userId: string, setId: string, cardId: string): Promise<void> {
    const { error } = await client.from("flashcards").insert({
      id: cardId,
      user_id: userId,
      set_id: setId,
      front: `Front ${cardId}`,
      back: `Back ${cardId}`,
    });
    if (error) throw error;
  }

  async function insertEvent(params: {
    eventId: string;
    userId: string;
    cardId: string;
    reviewedAt: string;
    isCorrect?: boolean | null;
    fsrsRating?: number | null;
  }): Promise<void> {
    const { error } = await client.from("card_review_events").insert({
      id: params.eventId,
      user_id: params.userId,
      flashcard_id: params.cardId,
      source: "smart_review",
      is_correct: params.isCorrect ?? null,
      reviewed_at: params.reviewedAt,
      fsrs_rating: params.fsrsRating ?? null,
    });
    if (error) throw error;
  }

  async function cleanup(userIds: string[]): Promise<void> {
    for (const userId of userIds) {
      await client.from("card_learning_schedule").delete().eq("user_id", userId);
      await client.from("card_review_events").delete().eq("user_id", userId);
      await client.from("flashcards").delete().eq("user_id", userId);
      await client.from("flashcard_sets").delete().eq("user_id", userId);
      await client.auth.admin.deleteUser(userId);
    }
  }

  async function fullReplay(events: SchedulableEventRow[]): Promise<Card> {
    const scheduler = createCapyStudyScheduler();
    let card = createEmptyCard(new Date(events[0]?.reviewedAt ?? T0));
    for (const row of events) {
      const rating: Grade | null =
        row.fsrsRating != null &&
        (row.fsrsRating === Rating.Again ||
          row.fsrsRating === Rating.Hard ||
          row.fsrsRating === Rating.Good ||
          row.fsrsRating === Rating.Easy)
          ? row.fsrsRating
          : row.isCorrect === true
            ? Rating.Good
            : row.isCorrect === false
              ? Rating.Again
              : null;
      if (rating === null) continue;
      card = scheduler.next(card, new Date(row.reviewedAt), rating).card;
    }
    return card;
  }

  function expectCardMatches(card: Card, row: ScheduleRow) {
    expect(row.state).toBe(card.state);
    expect(row.stability).toBeCloseTo(card.stability, 6);
    expect(row.difficulty).toBeCloseTo(card.difficulty, 6);
    expect(Date.parse(row.due)).toBe(Date.parse(new Date(card.due).toISOString()));
    expect(row.scheduledDays).toBeCloseTo(card.scheduled_days, 6);
    expect(row.learningSteps).toBe(card.learning_steps);
    expect(row.reps).toBe(card.reps);
    expect(row.lapses).toBe(card.lapses);
    expect(Date.parse(row.lastReview)).toBe(
      Date.parse(new Date(card.last_review ?? new Date()).toISOString()),
    );
  }

  describe("FSRS real-local reconciliation", () => {
    const users: string[] = [];
    let userId = "";

    beforeAll(async () => {
      userId = await createUser("main");
      users.push(userId);
    });

    afterAll(async () => {
      await cleanup(users);
    });

    it("creates a first projection for a card with a single correct event", async () => {
      const setId = "10000000-0000-4000-8000-000000000001";
      const cardId = "10000000-0000-4000-8000-000000000002";
      await createSet(userId, setId);
      await createCard(userId, setId, cardId);
      await insertEvent({
        eventId: "10000000-0000-4000-8000-000000000003",
        userId,
        cardId,
        reviewedAt: T0,
        isCorrect: true,
      });

      const result = await reconcileCardScheduleWithRepo({ repository, writer }, userId, cardId);
      expect(result.status).toBe("created");
      expect(result.replayMode).toBe("full");
      expect(result.processedEventCount).toBe(1);
      expect(result.projectionRevision).toBe(0);

      const row = await repository.loadSchedule(userId, cardId);
      expect(row).not.toBeNull();
      if (!row) throw new Error("expected schedule");

      // Verify persisted projection equals pure replay.
      const allEvents = await repository.loadAllSchedulableEvents(userId, cardId);
      const replay = await fullReplay(allEvents);
      expectCardMatches(replay, row);
      expect(row.processedEventCount).toBe(1);
      expect(row.lastProcessedReviewEventId).toBe("10000000-0000-4000-8000-000000000003");
      expect(Date.parse(row.lastProcessedReviewedAt)).toBe(Date.parse(T0));
      expect(row.algorithm).toBe("fsrs-6");
      expect(row.implementation).toBe("ts-fsrs@5.4.1");
      expect(row.parameterSet).toBe("capystudy-v1");
    });

    it("second reconciliation is a true no-op (revision + updated_at unchanged)", async () => {
      const cardId = "10000000-0000-4000-8000-000000000002";
      const before = await repository.loadSchedule(userId, cardId);
      if (!before) throw new Error("expected existing schedule");

      const result = await reconcileCardScheduleWithRepo({ repository, writer }, userId, cardId);
      expect(result.status).toBe("up_to_date");
      expect(result.replayMode).toBe("none");

      const after = await repository.loadSchedule(userId, cardId);
      if (!after) throw new Error("expected existing schedule");
      expect(after.projectionRevision).toBe(before.projectionRevision);
      expect(Date.parse(after.updatedAt)).toBe(Date.parse(before.updatedAt));
      expect(after.due).toBe(before.due);
      expect(after.stability).toBe(before.stability);
      expect(after.difficulty).toBe(before.difficulty);
      expect(after.processedEventCount).toBe(before.processedEventCount);
      expect(after.lastProcessedReviewEventId).toBe(before.lastProcessedReviewEventId);
    });

    it("incrementally updates when a later event is appended", async () => {
      const cardId = "10000000-0000-4000-8000-000000000002";
      await insertEvent({
        eventId: "10000000-0000-4000-8000-000000000004",
        userId,
        cardId,
        reviewedAt: T0_PLUS_1D,
        isCorrect: false,
      });

      const before = await repository.loadSchedule(userId, cardId);
      if (!before) throw new Error("expected existing schedule");

      const result = await reconcileCardScheduleWithRepo({ repository, writer }, userId, cardId);
      expect(["updated", "rebuilt"]).toContain(result.status);
      expect(result.processedEventCount).toBe(2);

      const row = await repository.loadSchedule(userId, cardId);
      if (!row) throw new Error("expected schedule");
      expect(row.processedEventCount).toBe(2);
      expect(row.lastProcessedReviewEventId).toBe("10000000-0000-4000-8000-000000000004");
      expect(Date.parse(row.lastProcessedReviewedAt)).toBe(Date.parse(T0_PLUS_1D));
      expect(row.projectionRevision).toBeGreaterThan(before.projectionRevision);

      const allEvents = await repository.loadAllSchedulableEvents(userId, cardId);
      const replay = await fullReplay(allEvents);
      expectCardMatches(replay, row);
    });

    it("detects a late/out-of-order event and performs full rebuild", async () => {
      const cardId = "10000000-0000-4000-8000-000000000002";

      // Insert a NEW event that sorts BEFORE the existing cursor (event 004 at +1d).
      // This creates a late/out-of-order event not explainable by the after-cursor query.
      await insertEvent({
        eventId: "10000000-0000-4000-8000-000000000005",
        userId,
        cardId,
        reviewedAt: T0_PLUS_5M, // sorts before 004
        isCorrect: true,
      });

      const before = await repository.loadSchedule(userId, cardId);
      if (!before) throw new Error("expected existing schedule");
      const beforeRevision = before.projectionRevision;

      const result = await reconcileCardScheduleWithRepo({ repository, writer }, userId, cardId);
      expect(result.status).toBe("rebuilt");
      expect(result.replayMode).toBe("full");
      expect(result.processedEventCount).toBe(3);

      const row = await repository.loadSchedule(userId, cardId);
      if (!row) throw new Error("expected schedule");
      expect(row.processedEventCount).toBe(3);
      expect(row.projectionRevision).toBe(beforeRevision + 1);
      expect(row.lastProcessedReviewEventId).toBe("10000000-0000-4000-8000-000000000004");

      const allEvents = await repository.loadAllSchedulableEvents(userId, cardId);
      expect(allEvents.map((e) => e.id)).toEqual([
        "10000000-0000-4000-8000-000000000003",
        "10000000-0000-4000-8000-000000000005",
        "10000000-0000-4000-8000-000000000004",
      ]);
      const replay = await fullReplay(allEvents);
      expectCardMatches(replay, row);

      // Rerun → up_to_date, revision unchanged.
      const rerun = await reconcileCardScheduleWithRepo({ repository, writer }, userId, cardId);
      expect(rerun.status).toBe("up_to_date");
      const rerunRow = await repository.loadSchedule(userId, cardId);
      if (!rerunRow) throw new Error("expected schedule");
      expect(rerunRow.projectionRevision).toBe(row.projectionRevision);
    });

    it("handles same-timestamp events with deterministic UUID ordering", async () => {
      const setId = "20000000-0000-4000-8000-000000000001";
      const cardId = "20000000-0000-4000-8000-000000000002";
      await createSet(userId, setId);
      await createCard(userId, setId, cardId);

      // Same reviewed_at; event-id ordering decides canonical sequence.
      await insertEvent({
        eventId: "20000000-0000-4000-8000-00000000000b",
        userId,
        cardId,
        reviewedAt: T0,
        isCorrect: false,
      });
      await insertEvent({
        eventId: "20000000-0000-4000-8000-00000000000a",
        userId,
        cardId,
        reviewedAt: T0,
        isCorrect: true,
      });

      const result = await reconcileCardScheduleWithRepo({ repository, writer }, userId, cardId);
      expect(result.status).toBe("created");

      const row = await repository.loadSchedule(userId, cardId);
      if (!row) throw new Error("expected schedule");
      // Canonical order: id ...00a (correct) then ...00b (incorrect).
      // Final cursor is UUID-greatest event: ...00b.
      expect(row.lastProcessedReviewEventId).toBe("20000000-0000-4000-8000-00000000000b");
      expect(row.processedEventCount).toBe(2);

      const allEvents = await repository.loadAllSchedulableEvents(userId, cardId);
      expect(allEvents.map((e) => e.id)).toEqual([
        "20000000-0000-4000-8000-00000000000a",
        "20000000-0000-4000-8000-00000000000b",
      ]);
      const replay = await fullReplay(allEvents);
      expectCardMatches(replay, row);

      // Rerun is no-op.
      const rerun = await reconcileCardScheduleWithRepo({ repository, writer }, userId, cardId);
      expect(rerun.status).toBe("up_to_date");
    });

    it("excludes null/null non-schedulable events", async () => {
      const setId = "30000000-0000-4000-8000-000000000001";
      const cardId = "30000000-0000-4000-8000-000000000002";
      await createSet(userId, setId);
      await createCard(userId, setId, cardId);

      await insertEvent({
        eventId: "30000000-0000-4000-8000-000000000003",
        userId,
        cardId,
        reviewedAt: T0,
        isCorrect: true,
      });
      // null/null event — should NOT be counted or alter replay.
      await insertEvent({
        eventId: "30000000-0000-4000-8000-000000000004",
        userId,
        cardId,
        reviewedAt: T0_PLUS_5M,
        isCorrect: null,
        fsrsRating: null,
      });

      const result = await reconcileCardScheduleWithRepo({ repository, writer }, userId, cardId);
      expect(result.status).toBe("created");
      expect(result.processedEventCount).toBe(1);

      const row = await repository.loadSchedule(userId, cardId);
      if (!row) throw new Error("expected schedule");
      expect(row.processedEventCount).toBe(1);
      expect(row.lastProcessedReviewEventId).toBe("30000000-0000-4000-8000-000000000003");
      expect(Date.parse(row.lastProcessedReviewedAt)).toBe(Date.parse(T0));

      const allEvents = await repository.loadAllSchedulableEvents(userId, cardId);
      expect(allEvents).toHaveLength(1);
      const replay = await fullReplay(allEvents);
      expectCardMatches(replay, row);
    });

    it("honors stored fsrs_rating over binary is_correct", async () => {
      const setId = "40000000-0000-4000-8000-000000000001";
      const cardId = "40000000-0000-4000-8000-000000000002";
      await createSet(userId, setId);
      await createCard(userId, setId, cardId);

      // is_correct=true but stored fsrs_rating=Again (1) — rating must win.
      await insertEvent({
        eventId: "40000000-0000-4000-8000-000000000003",
        userId,
        cardId,
        reviewedAt: T0,
        isCorrect: true,
        fsrsRating: Rating.Again,
      });

      const result = await reconcileCardScheduleWithRepo({ repository, writer }, userId, cardId);
      expect(result.status).toBe("created");

      const row = await repository.loadSchedule(userId, cardId);
      if (!row) throw new Error("expected schedule");

      // Pure replay with Again (not Good) must match.
      const allEvents = await repository.loadAllSchedulableEvents(userId, cardId);
      expect(allEvents).toHaveLength(1);
      expect(allEvents[0]?.fsrsRating).toBe(Rating.Again);
      const replay = await fullReplay(allEvents);
      expectCardMatches(replay, row);
    });

    it("handles >1000 schedulable events with pagination", async () => {
      const setId = "50000000-0000-4000-8000-000000000001";
      const cardId = "50000000-0000-4000-8000-000000000002";
      await createSet(userId, setId);
      await createCard(userId, setId, cardId);

      const count = 1005;
      const events: Array<{
        id: string;
        userId: string;
        cardId: string;
        reviewedAt: string;
        isCorrect: boolean;
      }> = [];
      const base = Date.parse(T0);
      for (let i = 0; i < count; i++) {
        // Deterministic timestamps, 1 second apart.
        const ts = new Date(base + i * 1000).toISOString();
        // UUIDs: fixed prefix + padded index, valid uuidv4-ish format.
        const hex = i.toString(16).padStart(12, "0");
        events.push({
          id: `50000000-0000-4000-8000-${hex}`,
          userId,
          cardId,
          reviewedAt: ts,
          isCorrect: i % 2 === 0,
        });
      }

      for (let i = 0; i < events.length; i += 100) {
        const chunk = events.slice(i, i + 100);
        const { error } = await client.from("card_review_events").insert(
          chunk.map((e) => ({
            id: e.id,
            user_id: e.userId,
            flashcard_id: e.cardId,
            source: "smart_review",
            is_correct: e.isCorrect,
            reviewed_at: e.reviewedAt,
          })),
        );
        if (error) throw error;
      }

      const result = await reconcileCardScheduleWithRepo({ repository, writer }, userId, cardId);
      expect(result.status).toBe("created");
      expect(result.processedEventCount).toBe(count);

      const row = await repository.loadSchedule(userId, cardId);
      if (!row) throw new Error("expected schedule");
      expect(row.processedEventCount).toBe(count);

      // Final cursor must be the canonical final event (highest reviewed_at, then id).
      const lastEvent = events[events.length - 1];
      if (!lastEvent) throw new Error("expected last event");
      expect(row.lastProcessedReviewEventId).toBe(lastEvent.id);
      expect(Date.parse(row.lastProcessedReviewedAt)).toBe(Date.parse(lastEvent.reviewedAt));

      const allEvents = await repository.loadAllSchedulableEvents(userId, cardId);
      expect(allEvents).toHaveLength(count);
      const replay = await fullReplay(allEvents);
      expectCardMatches(replay, row);
    });

    it("is a no-op on a second full run (idempotency)", async () => {
      // This covers idempotency for the >1000 card.
      const cardId = "50000000-0000-4000-8000-000000000002";
      const before = await repository.loadSchedule(userId, cardId);
      if (!before) throw new Error("expected schedule");

      const result = await reconcileCardScheduleWithRepo({ repository, writer }, userId, cardId);
      expect(result.status).toBe("up_to_date");

      const after = await repository.loadSchedule(userId, cardId);
      if (!after) throw new Error("expected schedule");
      expect(after.projectionRevision).toBe(before.projectionRevision);
    });

    it("concurrent reconciliation from a stale projection converges without lost updates", async () => {
      // Fresh card with one schedulable event, no schedule row yet.
      const setId = "80000000-0000-4000-8000-000000000001";
      const cardId = "80000000-0000-4000-8000-000000000002";
      await createSet(userId, setId);
      await createCard(userId, setId, cardId);
      await insertEvent({
        eventId: "80000000-0000-4000-8000-000000000003",
        userId,
        cardId,
        reviewedAt: T0,
        isCorrect: true,
      });
      await insertEvent({
        eventId: "80000000-0000-4000-8000-000000000004",
        userId,
        cardId,
        reviewedAt: T0_PLUS_5M,
        isCorrect: false,
      });

      // Both callers start with NO schedule row (expected_revision = -1).
      const results = await Promise.allSettled([
        reconcileCardScheduleWithRepo({ repository, writer }, userId, cardId),
        reconcileCardScheduleWithRepo({ repository, writer }, userId, cardId),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<{
        status: string;
        processedEventCount: number;
        projectionRevision: number | null;
      }>[];
      // At least one caller must succeed.
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);
      // If both succeeded, no double-application: one is created, the other up_to_date.
      for (const r of fulfilled) {
        expect(["created", "up_to_date", "updated", "rebuilt"]).toContain(r.value.status);
        expect(r.value.processedEventCount).toBe(2);
      }

      // Final persisted state equals exactly one full replay of all events.
      const row = await repository.loadSchedule(userId, cardId);
      if (!row) throw new Error("expected schedule");
      expect(row.processedEventCount).toBe(2);
      expect(row.lastProcessedReviewEventId).toBe("80000000-0000-4000-8000-000000000004");

      const allEvents = await repository.loadAllSchedulableEvents(userId, cardId);
      expect(allEvents).toHaveLength(2);
      const replay = await fullReplay(allEvents);
      expectCardMatches(replay, row);

      // The CAS design must not inflate the revision via no-op retries.
      // One creation (rev 0) plus at most one extra CAS write; an exactly-correct
      // concurrent run leaves rev at 0 (second caller no-ops). A race that forces
      // the second caller to rebuild can reach 1. Cap the assertion at a sane bound.
      expect(row.projectionRevision).toBeLessThanOrEqual(1);
    });
  });

  describe("FSRS real-local user isolation", () => {
    const users: string[] = [];
    let userA = "";
    let userB = "";

    beforeAll(async () => {
      userA = await createUser("iso-a");
      userB = await createUser("iso-b");
      users.push(userA, userB);
    });

    afterAll(async () => {
      await cleanup(users);
    });

    it("does not mix user B events into user A projections", async () => {
      const setIdA = "60000000-0000-4000-8000-000000000001";
      const cardIdA = "60000000-0000-4000-8000-000000000002";
      const setIdB = "60000000-0000-4000-8000-000000000003";
      const cardIdB = "60000000-0000-4000-8000-000000000004";

      await createSet(userA, setIdA);
      await createSet(userB, setIdB);
      await createCard(userA, setIdA, cardIdA);
      await createCard(userB, setIdB, cardIdB);

      // Both users have one correct event.
      await insertEvent({
        eventId: "60000000-0000-4000-8000-000000000005",
        userId: userA,
        cardId: cardIdA,
        reviewedAt: T0,
        isCorrect: true,
      });
      await insertEvent({
        eventId: "60000000-0000-4000-8000-000000000006",
        userId: userB,
        cardId: cardIdB,
        reviewedAt: T0,
        isCorrect: true,
      });

      const resultA = await reconcileCardScheduleWithRepo({ repository, writer }, userA, cardIdA);
      expect(resultA.status).toBe("created");
      expect(resultA.processedEventCount).toBe(1);

      const rowA = await repository.loadSchedule(userA, cardIdA);
      if (!rowA) throw new Error("expected schedule A");
      expect(rowA.processedEventCount).toBe(1);
      expect(rowA.lastProcessedReviewEventId).toBe("60000000-0000-4000-8000-000000000005");

      // User B must NOT have a schedule row created by A's operation.
      const rowB = await repository.loadSchedule(userB, cardIdB);
      expect(rowB).toBeNull();

      // Reconcile B independently.
      const resultB = await reconcileCardScheduleWithRepo({ repository, writer }, userB, cardIdB);
      expect(resultB.status).toBe("created");
      const rowBAfter = await repository.loadSchedule(userB, cardIdB);
      if (!rowBAfter) throw new Error("expected schedule B");
      expect(rowBAfter.processedEventCount).toBe(1);
      expect(rowBAfter.lastProcessedReviewEventId).toBe("60000000-0000-4000-8000-000000000006");
    });

    it("deleted card cascade removes schedule but preserves events", async () => {
      const setId = "70000000-0000-4000-8000-000000000001";
      const cardId = "70000000-0000-4000-8000-000000000002";
      await createSet(userA, setId);
      await createCard(userA, setId, cardId);
      await insertEvent({
        eventId: "70000000-0000-4000-8000-000000000003",
        userId: userA,
        cardId,
        reviewedAt: T0,
        isCorrect: true,
      });

      const result = await reconcileCardScheduleWithRepo({ repository, writer }, userA, cardId);
      expect(result.status).toBe("created");

      const scheduleBefore = await repository.loadSchedule(userA, cardId);
      expect(scheduleBefore).not.toBeNull();

      // Delete the card → FK cascade removes schedule; events remain.
      const { error } = await client.from("flashcards").delete().eq("id", cardId);
      if (error) throw error;

      const scheduleAfter = await repository.loadSchedule(userA, cardId);
      expect(scheduleAfter).toBeNull();

      const { count } = await client
        .from("card_review_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userA)
        .eq("flashcard_id", cardId);
      expect(count).toBe(1);

      // Reconciliation later must NOT recreate a schedule for the deleted card.
      const resultAfter = await reconcileCardScheduleWithRepo(
        { repository, writer },
        userA,
        cardId,
      );
      expect(resultAfter.status).toBe("deleted");
      const scheduleFinal = await repository.loadSchedule(userA, cardId);
      expect(scheduleFinal).toBeNull();
    });
  });
}
