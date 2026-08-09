import { createEmptyCard, State, type Card, type FSRS } from "ts-fsrs";

import { createFlashlearnScheduler, FLASHLEARN_SCHEDULER_IDENTITY } from "../config";
import type {
  FsrsReconciliationResult,
  FsrsReconciliationStatus,
  ReplayMode,
} from "../types/reconciliation-types";
import type {
  ReviewReplayFact,
  ScheduleRow,
  SchedulableEventRow,
} from "../types/spaced-repetition-types";
import { ratingForReviewFact } from "../utils/rating-map";

const MAX_RETRIES = 3;

const CURRENT_CONFIG = {
  algorithm: FLASHLEARN_SCHEDULER_IDENTITY.algorithm as string,
  implementation: FLASHLEARN_SCHEDULER_IDENTITY.implementation as string,
  parameterSet: FLASHLEARN_SCHEDULER_IDENTITY.parameterSet as string,
};

export type ScheduleReconcileRepository = {
  loadSchedule(userId: string, cardId: string): Promise<ScheduleRow | null>;
  countSchedulableEvents(userId: string, cardId: string): Promise<number>;
  loadSchedulableEventsAfter(
    userId: string,
    cardId: string,
    lastReviewedAt: string,
    lastEventId: string,
  ): Promise<SchedulableEventRow[]>;
  loadAllSchedulableEvents(userId: string, cardId: string): Promise<SchedulableEventRow[]>;
  checkCardActive(userId: string, cardId: string): Promise<boolean>;
};

export type ScheduleReconcileWriter = {
  upsert(params: {
    userId: string;
    cardId: string;
    expectedProjectionRevision: number;
    card: Card;
    processedEventCount: number;
    lastProcessedReviewedAt: string;
    lastProcessedReviewEventId: string;
  }): Promise<number>;
};

export type ReconcileContext = {
  repository: ScheduleReconcileRepository;
  writer: ScheduleReconcileWriter;
};

function configMatches(schedule: ScheduleRow): boolean {
  return (
    schedule.algorithm === CURRENT_CONFIG.algorithm &&
    schedule.implementation === CURRENT_CONFIG.implementation &&
    schedule.parameterSet === CURRENT_CONFIG.parameterSet
  );
}

function factFromRow(row: SchedulableEventRow): ReviewReplayFact {
  return {
    eventId: row.id,
    reviewedAt: row.reviewedAt,
    isCorrect: row.isCorrect,
    fsrsRating: row.fsrsRating,
  };
}

function fsrsCardFromSchedule(schedule: ScheduleRow): Card {
  return {
    due: new Date(schedule.due),
    stability: schedule.stability,
    difficulty: schedule.difficulty,
    scheduled_days: schedule.scheduledDays,
    learning_steps: schedule.learningSteps,
    reps: schedule.reps,
    lapses: schedule.lapses,
    state: schedule.state as State,
    last_review: new Date(schedule.lastReview),
    elapsed_days: 0,
  };
}

function replayAll(events: readonly SchedulableEventRow[], scheduler: FSRS): Card {
  let card: Card = createEmptyCard(new Date(events[0]?.reviewedAt ?? Date.now()));
  for (const row of events) {
    const rating = ratingForReviewFact(factFromRow(row));
    if (rating === null) continue;
    card = scheduler.next(card, new Date(row.reviewedAt), rating).card;
  }
  return card;
}

function buildResult(
  status: FsrsReconciliationStatus,
  replayMode: ReplayMode,
  processedEventCount: number,
  projectionRevision: number | null,
): FsrsReconciliationResult {
  return { status, replayMode, processedEventCount, projectionRevision };
}

function finalEventOf(events: readonly SchedulableEventRow[]): SchedulableEventRow {
  const last = events[events.length - 1];
  if (!last) throw new Error("Expected at least one schedulable event");
  return last;
}

/**
 * Reconcile the FSRS projection for one user/card against immutable review
 * history. Pure orchestration: no `server-only`, no Supabase imports. Callers
 * supply a repository (reads) and a writer (the private CAS RPC).
 */
export async function reconcileCardScheduleWithRepo(
  context: ReconcileContext,
  userId: string,
  cardId: string,
): Promise<FsrsReconciliationResult> {
  const { repository, writer } = context;
  const scheduler = createFlashlearnScheduler();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const active = await repository.checkCardActive(userId, cardId);
    if (!active) return buildResult("deleted", "none", 0, null);

    const totalCount = await repository.countSchedulableEvents(userId, cardId);

    if (totalCount === 0) {
      return buildResult("no_schedule", "none", 0, null);
    }

    const existing = await repository.loadSchedule(userId, cardId);

    if (!existing) {
      const allEvents = await repository.loadAllSchedulableEvents(userId, cardId);
      const card = replayAll(allEvents, scheduler);
      const final = finalEventOf(allEvents);

      try {
        const revision = await writer.upsert({
          userId,
          cardId,
          expectedProjectionRevision: -1,
          card,
          processedEventCount: allEvents.length,
          lastProcessedReviewedAt: final.reviewedAt,
          lastProcessedReviewEventId: final.id,
        });
        return buildResult("created", "full", allEvents.length, revision);
      } catch {
        continue;
      }
    }

    if (!configMatches(existing)) {
      const allEvents = await repository.loadAllSchedulableEvents(userId, cardId);
      const card = replayAll(allEvents, scheduler);
      const final = finalEventOf(allEvents);

      try {
        const revision = await writer.upsert({
          userId,
          cardId,
          expectedProjectionRevision: existing.projectionRevision,
          card,
          processedEventCount: allEvents.length,
          lastProcessedReviewedAt: final.reviewedAt,
          lastProcessedReviewEventId: final.id,
        });
        return buildResult("config_mismatch_rebuilt", "full", allEvents.length, revision);
      } catch {
        continue;
      }
    }

    if (totalCount === existing.processedEventCount) {
      return buildResult("up_to_date", "none", totalCount, existing.projectionRevision);
    }

    if (totalCount < existing.processedEventCount) {
      const allEvents = await repository.loadAllSchedulableEvents(userId, cardId);
      const card = replayAll(allEvents, scheduler);
      const final = finalEventOf(allEvents);

      try {
        const revision = await writer.upsert({
          userId,
          cardId,
          expectedProjectionRevision: existing.projectionRevision,
          card,
          processedEventCount: allEvents.length,
          lastProcessedReviewedAt: final.reviewedAt,
          lastProcessedReviewEventId: final.id,
        });
        return buildResult("rebuilt", "full", allEvents.length, revision);
      } catch {
        continue;
      }
    }

    // More events exist: try incremental fast path.
    const after = await repository.loadSchedulableEventsAfter(
      userId,
      cardId,
      existing.lastProcessedReviewedAt,
      existing.lastProcessedReviewEventId,
    );

    if (existing.processedEventCount + after.length === totalCount) {
      let card = fsrsCardFromSchedule(existing);
      for (const row of after) {
        const rating = ratingForReviewFact(factFromRow(row));
        if (rating === null) continue;
        card = scheduler.next(card, new Date(row.reviewedAt), rating).card;
      }
      const final =
        after.length > 0
          ? finalEventOf(after)
          : {
              id: existing.lastProcessedReviewEventId,
              reviewedAt: existing.lastProcessedReviewedAt,
              isCorrect: null,
              fsrsRating: null,
            };

      try {
        const revision = await writer.upsert({
          userId,
          cardId,
          expectedProjectionRevision: existing.projectionRevision,
          card,
          processedEventCount: totalCount,
          lastProcessedReviewedAt: final.reviewedAt,
          lastProcessedReviewEventId: final.id,
        });
        return buildResult(
          after.length > 0 ? "updated" : "up_to_date",
          "incremental",
          totalCount,
          revision,
        );
      } catch {
        continue;
      }
    }

    // Late/out-of-order events: full replay.
    const allEvents = await repository.loadAllSchedulableEvents(userId, cardId);
    const card = replayAll(allEvents, scheduler);
    const final = finalEventOf(allEvents);

    try {
      const revision = await writer.upsert({
        userId,
        cardId,
        expectedProjectionRevision: existing.projectionRevision,
        card,
        processedEventCount: allEvents.length,
        lastProcessedReviewedAt: final.reviewedAt,
        lastProcessedReviewEventId: final.id,
      });
      return buildResult("rebuilt", "full", allEvents.length, revision);
    } catch {
      continue;
    }
  }

  throw new Error(`Reconciliation failed after ${MAX_RETRIES} retries for card ${cardId}`);
}
