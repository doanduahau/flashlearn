import "server-only";

import {
  calculateContentCredits,
  estimateContentCredits,
} from "@/features/entitlements/ai-job-limits";
import {
  finalizeUsage,
  getEffectivePlan,
  refundUsage,
  reserveUsage,
} from "@/features/entitlements/server/entitlement-service";
import {
  finishProcessingJob,
  linkJobReservation,
  loadProcessingJobOutput,
  runProcessingJobPhase,
  startProcessingJob,
  storeProcessingJobOutput,
  type ProcessingJobKind,
  type ProcessingJobSource,
} from "@/features/entitlements/server/processing-job-service";
import { createProviderCallBudget } from "@/features/entitlements/server/provider-call-budget";
import { GeminiFlashcardGenerationProvider } from "@/features/imports/adapters/gemini-provider";
import type { DraftFlashcard } from "@/features/imports/types/import-types";
import { consumeRateLimit, rateLimitMessage, subjectRateLimitKey } from "@/lib/security/rate-limit";

export class AiJobUserError extends Error {
  constructor(
    readonly code: "quota_exceeded" | "rate_limited" | "concurrency" | "conflict" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "AiJobUserError";
  }
}

function parseCachedCards(value: unknown): DraftFlashcard[] | null {
  if (!Array.isArray(value)) return null;
  const cards: DraftFlashcard[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const entry = item as Record<string, unknown>;
    if (typeof entry.front !== "string" || typeof entry.back !== "string") return null;
    cards.push({ front: entry.front, back: entry.back });
  }
  return cards;
}

function jobError(error: unknown): AiJobUserError {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("concurrency") || message.includes("semaphore")) {
    return new AiJobUserError(
      "concurrency",
      "Bạn đang có quá nhiều tác vụ nặng đang chạy. Vui lòng chờ tác vụ hiện tại hoàn tất.",
    );
  }
  return new AiJobUserError(
    "unavailable",
    "Dịch vụ AI tạm thời không sẵn sàng. Vui lòng thử lại sau.",
  );
}

export async function runMeteredFlashcardGeneration(input: {
  userId: string;
  kind: Extract<ProcessingJobKind, "paste_generate" | "google_sheets_generate">;
  source: Extract<ProcessingJobSource, "paste_prose" | "google_sheets_semantic">;
  text: string;
  maximumCards: number;
  idempotencyKey: string;
  correlationId: string;
}): Promise<{ cards: DraftFlashcard[]; replayed: boolean }> {
  const plan = await getEffectivePlan(input.userId);
  const rateLimit = await consumeRateLimit(
    plan === "free" ? "aiGenerationFree" : "aiGenerationPro",
    subjectRateLimitKey("ai-heavy-start", input.userId),
  );
  if (!rateLimit.ok) throw new AiJobUserError("rate_limited", rateLimitMessage(rateLimit));

  const job = await startProcessingJob({
    userId: input.userId,
    kind: input.kind,
    source: input.source,
    idempotencyKey: input.idempotencyKey,
    correlationId: input.correlationId,
  });

  if (job.replayed && job.status === "succeeded") {
    const cached = await loadProcessingJobOutput(job.id, input.userId);
    const cards = cached?.outputKind === "flashcards" ? parseCachedCards(cached.payload) : null;
    if (cards) return { cards, replayed: true };
    throw new AiJobUserError("unavailable", "Kết quả tác vụ cũ đã hết hạn. Hãy tạo yêu cầu mới.");
  }
  if (job.replayed && ["queued", "running"].includes(job.status)) {
    throw new AiJobUserError("conflict", "Tác vụ này đang được xử lý. Vui lòng chờ kết quả.");
  }
  if (job.replayed) {
    throw new AiJobUserError("unavailable", "Tác vụ trước không hoàn tất. Hãy tạo yêu cầu mới.");
  }

  const requestedCredits = estimateContentCredits(input.text.length, input.maximumCards);
  const reservation = await reserveUsage({
    userId: input.userId,
    usageKey: "ai.content_credits.monthly",
    requestedAmount: requestedCredits,
    idempotencyKey: input.idempotencyKey,
    correlationId: input.correlationId,
  });
  const reservationId = reservation.reservation_id ?? null;
  if (reservation.wouldBlock && reservation.enforcementMode === "block") {
    await finishProcessingJob({
      jobId: job.id,
      userId: input.userId,
      status: "cancelled",
      errorCode: "QUOTA_EXCEEDED",
    });
    throw new AiJobUserError(
      "quota_exceeded",
      "Bạn đã dùng hết lượt AI trong tháng. Nội dung dạng bảng vẫn có thể import không dùng AI.",
    );
  }
  if (reservationId) {
    await linkJobReservation({
      jobId: job.id,
      userId: input.userId,
      reservationId,
      purpose: "content_credit",
    });
  }

  let usableResult = false;
  try {
    const cards = await runProcessingJobPhase({ id: job.id, userId: input.userId }, async () => {
      const provider = new GeminiFlashcardGenerationProvider(
        createProviderCallBudget({ jobId: job.id, userId: input.userId }),
      );
      return provider.generateCards({ text: input.text });
    });
    usableResult = true;
    const actualCredits = calculateContentCredits(input.text.length, cards.length);
    await storeProcessingJobOutput({
      jobId: job.id,
      userId: input.userId,
      outputKind: "flashcards",
      payload: cards,
    });
    if (reservationId) await finalizeUsage(reservationId, actualCredits);
    await finishProcessingJob({
      jobId: job.id,
      userId: input.userId,
      status: "succeeded",
      outputItems: cards.length,
    });
    return { cards, replayed: false };
  } catch (error) {
    if (reservationId) {
      if (usableResult) await finalizeUsage(reservationId, requestedCredits).catch(() => undefined);
      else await refundUsage(reservationId, "provider_or_platform_failure").catch(() => undefined);
    }
    await finishProcessingJob({
      jobId: job.id,
      userId: input.userId,
      status: usableResult ? "reconcile_required" : "failed",
      errorCode: usableResult ? "OUTPUT_PERSIST_FAILED" : "PROVIDER_FAILED",
    }).catch(() => undefined);
    throw error instanceof AiJobUserError ? error : jobError(error);
  }
}
