import { z } from "zod";

export const catalogSetIdSchema = z.uuid("Bộ thư viện không hợp lệ.");

const filterValue = z
  .string()
  .trim()
  .max(40)
  .regex(/^[a-z0-9-]*$/)
  .catch("");

export const catalogFiltersSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  category: filterValue,
  language: z.enum(["", "vi-en", "vi-vi"]).catch(""),
  level: z.enum(["", "beginner", "intermediate", "advanced"]).catch(""),
});

export function parseCatalogFilters(input: {
  q?: string | string[];
  category?: string | string[];
  language?: string | string[];
  level?: string | string[];
}) {
  const scalar = (value: string | string[] | undefined) => (typeof value === "string" ? value : "");
  return catalogFiltersSchema.parse({
    q: scalar(input.q),
    category: scalar(input.category),
    language: scalar(input.language),
    level: scalar(input.level),
  });
}
