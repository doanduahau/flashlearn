"use server";

import { loadDueCandidateResult } from "@/features/spaced-repetition/server/due-repository";
import {
  SMART_REVIEW_BATCH_SIZE,
  smartReviewTargetCardIds,
} from "@/features/smart-review/utils/smart-review-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

type StartSmartReviewResult =
  { ok: true; sessionId: string } | { ok: false; error: string; empty?: boolean };

const GENERIC_ERROR = "Không thể bắt đầu phiên ôn. Vui lòng thử lại.";

async function signedInUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

/**
 * Has no client input by design: the server derives up-to-date, owner-scoped
 * direct FSRS due candidates immediately before creating the ordinary quiz session.
 */
export async function startSmartReview(): Promise<StartSmartReviewResult> {
  const supabase = await createClient();
  const userId = await signedInUserId(supabase);
  if (!userId) {
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };
  }

  const evaluationTime = new Date().toISOString();
  let dueResult;
  try {
    dueResult = await loadDueCandidateResult(
      supabase,
      userId,
      { type: "library" },
      evaluationTime,
      SMART_REVIEW_BATCH_SIZE,
    );
  } catch {
    logger.warn("smart_review.load_due_candidates_failed");
    return { ok: false, error: GENERIC_ERROR };
  }

  const targetCardIds = smartReviewTargetCardIds(dueResult);
  if (targetCardIds.length === 0) {
    return { ok: false, empty: true, error: "Không còn thẻ cần ôn." };
  }

  const admin = createAdminClient();
  const { data: sessionId, error } = await admin.rpc("create_owned_quiz_session_from_card_ids", {
    p_user_id: userId,
    p_card_ids: targetCardIds,
  });
  if (error || !sessionId) return { ok: false, error: GENERIC_ERROR };

  return { ok: true, sessionId };
}
