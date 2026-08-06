import { z } from "zod";

import type { StudySessionParams } from "@/features/study/types/study-types";
import { STUDY_MAX_SOURCES } from "@/lib/constants";

const idListSchema = z
  .array(z.uuid("Mã không hợp lệ."))
  .max(STUDY_MAX_SOURCES, `Tối đa ${STUDY_MAX_SOURCES} mục.`);

const seedSchema = z.number().int().min(0).max(4294967295);

export const studySourceSchema = z
  .object({
    setIds: z
      .array(z.uuid("Mã bộ flashcard không hợp lệ."))
      .max(STUDY_MAX_SOURCES, `Tối đa ${STUDY_MAX_SOURCES} bộ.`)
      .default([]),
    collectionIds: z
      .array(z.uuid("Mã bộ đặc biệt không hợp lệ."))
      .max(STUDY_MAX_SOURCES, `Tối đa ${STUDY_MAX_SOURCES} bộ.`)
      .default([]),
  })
  .refine(
    ({ setIds, collectionIds }) => setIds.length + collectionIds.length <= STUDY_MAX_SOURCES,
    `Tối đa ${STUDY_MAX_SOURCES} nguồn.`,
  );

function extractIdList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  const parts = Array.isArray(value) ? value : value.split(",");
  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

export function parseStudySessionParams(
  raw: Record<string, string | string[] | undefined>,
): StudySessionParams | null {
  const all = raw["all"] === "1";

  const sets = idListSchema.safeParse(extractIdList(raw["sets"]));
  if (!sets.success) return null;
  const collections = idListSchema.safeParse(extractIdList(raw["collections"]));
  if (!collections.success) return null;
  if (sets.data.length + collections.data.length > STUDY_MAX_SOURCES) return null;

  const rawSeed = typeof raw["seed"] === "string" ? raw["seed"] : undefined;
  let seed: number | undefined;
  if (rawSeed !== undefined) {
    const parsedSeed = seedSchema.safeParse(Number(rawSeed));
    if (!parsedSeed.success) return null;
    seed = parsedSeed.data;
  }

  if (!all && sets.data.length === 0 && collections.data.length === 0) return null;

  return { all, setIds: sets.data, collectionIds: collections.data, seed };
}
