import type { PlanId } from "@/features/entitlements/server/entitlement-service";

export type AiPlanTier = "free" | "pro";
export type DocumentSource = "docx" | "pdf";

export const AI_JOB_LIMITS = {
  free: {
    startPerHour: 4,
    concurrent: 1,
    physicalCallsPerJob: 5,
    typingBatchItems: 50,
    typingBatchChars: 20_000,
  },
  pro: {
    startPerHour: 20,
    concurrent: 2,
    physicalCallsPerJob: 20,
    typingBatchItems: 100,
    typingBatchChars: 80_000,
  },
} as const;

export const DOCUMENT_PROCESSING_LIMITS = {
  docx: {
    free: { bytes: 5 * 1024 * 1024, characters: 30_000, cards: 100 },
    pro: { bytes: 15 * 1024 * 1024, characters: 100_000, cards: 500 },
  },
  pdf: {
    free: { bytes: 5 * 1024 * 1024, pages: 30, characters: 30_000, cards: 100 },
    pro: { bytes: 15 * 1024 * 1024, pages: 200, characters: 100_000, cards: 500 },
  },
} as const;

export const DOCUMENT_ARCHIVE_LIMITS = {
  free: { entries: 1_000, uncompressedBytes: 40 * 1024 * 1024, compressionRatio: 100 },
  pro: { entries: 2_000, uncompressedBytes: 120 * 1024 * 1024, compressionRatio: 100 },
} as const;

export const PDF_OBJECT_LIMITS = {
  free: 50_000,
  pro: 200_000,
} as const;

export function aiPlanTier(plan: PlanId): AiPlanTier {
  return plan === "free" ? "free" : "pro";
}

/** Stable commercial formula; provider token pricing never changes this UI quota. */
export function calculateContentCredits(inputCharacters: number, generatedCards: number): number {
  const chars = Math.max(0, Math.floor(inputCharacters));
  const cards = Math.max(0, Math.floor(generatedCards));
  return Math.max(1, Math.ceil(chars / 5_000) + Math.ceil(cards / 25));
}

export function estimateContentCredits(inputCharacters: number, maximumCards: number): number {
  return calculateContentCredits(inputCharacters, maximumCards);
}
