"use server";

import { randomInt } from "node:crypto";

import { selectCardsByPriority } from "@/features/learning-modes/types";
import { STUDY_COVERAGE_MODES } from "@/features/practice-coverage/constants";
import {
  loadAppearanceCounts,
  loadWrongAnswerCardIds,
} from "@/features/practice-coverage/server/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { runnerBestTimeSchema, runnerStartSchema } from "../schemas/runner-schema";
import {
  RUNNER_QUESTION_COUNTS,
  type RunnerCard,
  type RunnerQuestionCount,
} from "../types/runner-types";
import { buildRunnerSession, createSeededRunnerRandom } from "../utils/runner-session";

async function authenticatedUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export type RunnerAvailability = {
  availableCounts: RunnerQuestionCount[];
  message: string | null;
  hiddenByEligibility: boolean;
};

export type RunnerAvailabilityResult =
  | { ok: true; eligibleCount: number; eligibility: RunnerAvailability }
  | { ok: false; error: string };

export type StartRunnerSessionResult =
  | {
      ok: true;
      session: { runnerSessionId: string; selectedCount: number; eligibleCount: number };
    }
  | { ok: false; error: string };

export type SubmitRunnerBestTimeResult =
  | { ok: true; bestMs: number; questionCount: number; isNewBest: boolean }
  | { ok: false; error: string };

function poolMessage(): string {
  return "Không đủ thẻ hợp lệ để bắt đầu Runner.";
}

async function loadCards(
  supabase: Awaited<ReturnType<typeof createClient>>,
  source: { all: boolean; setIds: string[]; collectionIds: string[] },
): Promise<RunnerCard[]> {
  let rows: RunnerCard[] = [];
  if (source.all) {
    const { data, error } = await supabase
      .from("flashcards")
      .select("id, front, back")
      .order("set_id", { ascending: true })
      .order("position", { ascending: true });
    if (error) throw new Error("runner card query failed");
    rows = data ?? [];
  } else {
    if (source.setIds.length) {
      const { data: sources, error: sourceError } = await supabase
        .from("flashcard_sets")
        .select("id")
        .in("id", source.setIds);
      if (sourceError || (sources ?? []).length !== source.setIds.length) {
        throw new Error("runner source ownership failed");
      }
      const { data, error } = await supabase
        .from("flashcards")
        .select("id, front, back")
        .in("set_id", source.setIds)
        .order("set_id", { ascending: true })
        .order("position", { ascending: true });
      if (error) throw new Error("runner set card query failed");
      rows.push(...(data ?? []));
    }
    if (source.collectionIds.length) {
      const { data: sources, error: sourceError } = await supabase
        .from("special_collections")
        .select("id")
        .in("id", source.collectionIds);
      if (sourceError || (sources ?? []).length !== source.collectionIds.length) {
        throw new Error("runner source ownership failed");
      }
      const { data, error } = await supabase
        .from("special_collection_items")
        .select("flashcard_id, flashcards(id, front, back)")
        .in("collection_id", source.collectionIds);
      if (error) throw new Error("runner collection card query failed");
      rows.push(
        ...(data ?? [])
          .map((item) => item.flashcards)
          .filter((card): card is RunnerCard => card !== null),
      );
    }
  }

  const seen = new Set<string>();
  return rows.flatMap((row) => {
    if (seen.has(row.id)) return [];
    seen.add(row.id);
    return [{ id: row.id, front: row.front, back: row.back }];
  });
}

async function filterByEligibility(
  supabase: Awaited<ReturnType<typeof createClient>>,
  cards: RunnerCard[],
): Promise<{ eligible: RunnerCard[]; hiddenByEligibility: boolean }> {
  if (cards.length === 0) return { eligible: [], hiddenByEligibility: false };
  const ids = cards.map((card) => card.id);
  const { data, error } = await supabase.rpc("load_runner_candidate_eligibility", {
    p_card_ids: ids,
  });
  if (error || !data) throw new Error("runner eligibility query failed");
  const eligibleIds = new Set(data.filter((row) => row.eligible).map((row) => row.flashcard_id));
  const eligible = cards.filter((card) => eligibleIds.has(card.id));
  return { eligible, hiddenByEligibility: eligible.length < cards.length };
}

export async function getRunnerAvailability(input: unknown): Promise<RunnerAvailabilityResult> {
  const parsed = runnerStartSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const supabase = await createClient();
  if (!(await authenticatedUserId(supabase))) {
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };
  }

  try {
    const cards = await loadCards(supabase, parsed.data);
    const { eligible, hiddenByEligibility } = await filterByEligibility(supabase, cards);
    const availableCounts = RUNNER_QUESTION_COUNTS.filter((count) => count <= eligible.length);
    const message = availableCounts.length === 0 ? poolMessage() : null;
    return {
      ok: true,
      eligibleCount: eligible.length,
      eligibility: { availableCounts, message, hiddenByEligibility },
    };
  } catch {
    return { ok: false, error: "Không thể tải thẻ Runner lúc này." };
  }
}

export async function startRunnerSession(input: unknown): Promise<StartRunnerSessionResult> {
  const parsed = runnerStartSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const supabase = await createClient();
  const userId = await authenticatedUserId(supabase);
  if (!userId) return { ok: false, error: "Phiên đăng nhập đã hết hạn." };

  try {
    const cards = await loadCards(supabase, parsed.data);
    const { eligible } = await filterByEligibility(supabase, cards);
    const availableCounts = RUNNER_QUESTION_COUNTS.filter((count) => count <= eligible.length);
    if (!availableCounts.includes(parsed.data.questionCount)) {
      return { ok: false, error: poolMessage() };
    }

    const random = createSeededRunnerRandom(randomInt(0, 2 ** 32));
    const shuffled = buildRunnerSession(eligible, eligible.length, random);
    if (!shuffled) return { ok: false, error: poolMessage() };
    const eligibleById = new Map(eligible.map((card) => [card.id, card]));
    const [appearance, wrong] = await Promise.all([
      loadAppearanceCounts(STUDY_COVERAGE_MODES, shuffled.sessionCardIds),
      loadWrongAnswerCardIds(shuffled.sessionCardIds),
    ]);
    const selectedIds = selectCardsByPriority(
      shuffled.sessionCardIds,
      wrong,
      appearance,
      parsed.data.questionCount,
    );
    const selectedCards = selectedIds.flatMap((id) => {
      const card = eligibleById.get(id);
      return card ? [card] : [];
    });
    const plan = buildRunnerSession(selectedCards, parsed.data.questionCount, random);
    if (!plan) return { ok: false, error: "Không thể tạo phiên Runner với phạm vi hiện tại." };

    const admin = createAdminClient();
    const { data: runnerSessionId, error } = await admin.rpc("create_runner_session", {
      p_user_id: userId,
      p_session_card_ids: plan.sessionCardIds,
      p_scope_card_ids: eligible.map((card) => card.id),
      p_difficulty: parsed.data.difficulty,
    });
    if (error || !runnerSessionId) {
      return { ok: false, error: "Không thể tạo phiên Runner lúc này." };
    }

    return {
      ok: true,
      session: {
        runnerSessionId,
        selectedCount: plan.selectedCount,
        eligibleCount: eligible.length,
      },
    };
  } catch {
    return { ok: false, error: "Không thể tạo phiên Runner lúc này." };
  }
}

export async function submitRunnerBestTime(
  runnerSessionId: string,
  elapsedMs: number,
): Promise<SubmitRunnerBestTimeResult> {
  const parsed = runnerBestTimeSchema.safeParse({ runnerSessionId, elapsedMs });
  if (!parsed.success) {
    return { ok: false, error: "Không thể lưu kỷ lục lúc này." };
  }

  try {
    const supabase = await createClient();
    if (!(await authenticatedUserId(supabase))) {
      return { ok: false, error: "Không thể lưu kỷ lục lúc này." };
    }

    const { data, error } = await supabase.rpc("submit_runner_best_time", {
      p_runner_session_id: parsed.data.runnerSessionId,
      p_elapsed_ms: parsed.data.elapsedMs,
    });
    const result = data?.[0];
    if (
      error ||
      !result ||
      typeof result.result_best_ms !== "number" ||
      typeof result.result_question_count !== "number" ||
      typeof result.is_new_best !== "boolean"
    ) {
      return { ok: false, error: "Không thể lưu kỷ lục lúc này." };
    }

    return {
      ok: true,
      bestMs: result.result_best_ms,
      questionCount: result.result_question_count,
      isNewBest: result.is_new_best,
    };
  } catch {
    return { ok: false, error: "Không thể lưu kỷ lục lúc này." };
  }
}
