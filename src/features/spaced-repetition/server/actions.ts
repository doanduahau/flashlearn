"use server";

import { loadNewCardCandidateResult } from "@/features/spaced-repetition/server/new-cards-repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const NEW_CARDS_BATCH_SIZE = 10;

type StartNewCardsResult =
  { ok: true; sessionId: string } | { ok: false; error: string; empty?: boolean };

const GENERIC_ERROR = "Không thể bắt đầu học thẻ mới. Vui lòng thử lại.";

async function signedInUserId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return typeof data?.claims?.sub === "string" ? data.claims.sub : null;
}

export async function startNewCardsLearning(): Promise<StartNewCardsResult> {
  const supabase = await createClient();
  const userId = await signedInUserId(supabase);
  if (!userId) {
    return { ok: false, error: "Phiên đăng nhập đã hết hạn." };
  }

  let result;
  try {
    result = await loadNewCardCandidateResult(supabase, userId, NEW_CARDS_BATCH_SIZE);
  } catch {
    console.error("[new_cards] start new cards load failed");
    return { ok: false, error: GENERIC_ERROR };
  }

  if (result.candidates.length === 0) {
    return { ok: false, empty: true, error: "Không còn thẻ mới để học." };
  }

  const cardIds = result.candidates.map((c) => c.flashcardId);
  const admin = createAdminClient();
  const { data: sessionId, error } = await admin.rpc(
    "create_owned_quiz_session_from_card_ids_new_cards",
    { p_user_id: userId, p_card_ids: cardIds },
  );
  if (error || !sessionId) return { ok: false, error: GENERIC_ERROR };

  return { ok: true, sessionId };
}
