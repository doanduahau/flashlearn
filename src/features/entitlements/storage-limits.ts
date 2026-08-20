import type { PlanId } from "@/features/entitlements/server/entitlement-service";

export type StoragePlanTier = "free" | "pro";
export type ImportCommitSource =
  "manual" | "csv_xlsx" | "google_sheets" | "paste_structured" | "paste_prose" | "docx" | "pdf";

type ImportRequestLimit = Readonly<{
  cards: number;
  sourceChars?: number;
  sourceBytes?: number;
}>;

export const STORAGE_PLAN_LIMITS = {
  free: { sets: 20, cards: 3_000, collections: 10, cardSideChars: 5_000 },
  pro: { sets: 200, cards: 30_000, collections: 100, cardSideChars: 20_000 },
} as const;

export const IMPORT_REQUEST_LIMITS: Readonly<
  Record<ImportCommitSource, Readonly<Record<StoragePlanTier, ImportRequestLimit>>>
> = {
  manual: { free: { cards: 500 }, pro: { cards: 2_000 } },
  csv_xlsx: {
    free: { cards: 500, sourceBytes: 5 * 1024 * 1024 },
    pro: { cards: 2_000, sourceBytes: 15 * 1024 * 1024 },
  },
  google_sheets: { free: { cards: 500 }, pro: { cards: 2_000 } },
  paste_structured: {
    free: { cards: 500, sourceChars: 50_000 },
    pro: { cards: 2_000, sourceChars: 200_000 },
  },
  paste_prose: {
    free: { cards: 100, sourceChars: 25_000 },
    pro: { cards: 500, sourceChars: 100_000 },
  },
  docx: {
    free: { cards: 100, sourceBytes: 5 * 1024 * 1024, sourceChars: 30_000 },
    pro: { cards: 500, sourceBytes: 15 * 1024 * 1024, sourceChars: 100_000 },
  },
  pdf: {
    free: { cards: 100, sourceBytes: 5 * 1024 * 1024, sourceChars: 30_000 },
    pro: { cards: 500, sourceBytes: 15 * 1024 * 1024, sourceChars: 100_000 },
  },
};

export function storagePlanTier(plan: PlanId): StoragePlanTier {
  return plan === "free" ? "free" : "pro";
}
