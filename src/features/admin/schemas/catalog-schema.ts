import { z } from "zod";

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const catalogCardItemSchema = z.object({
  front: z
    .string()
    .trim()
    .min(1, "Mặt trước không được để trống")
    .max(50_000, "Mặt trước tối đa 50,000 ký tự"),
  back: z
    .string()
    .trim()
    .min(1, "Mặt sau không được để trống")
    .max(50_000, "Mặt sau tối đa 50,000 ký tự"),
});

export const createCatalogSetSchema = z.object({
  category_id: z.string().uuid("Danh mục không hợp lệ"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      SLUG_REGEX,
      "Slug chỉ được chứa chữ thường không dấu, số và dấu gạch ngang (ví dụ: tieng-anh-giao-tiep)",
    ),
  title: z
    .string()
    .trim()
    .min(1, "Tiêu đề không được để trống")
    .max(120, "Tiêu đề tối đa 120 ký tự"),
  description: z
    .string()
    .trim()
    .max(500, "Mô tả tối đa 500 ký tự")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  language_front: z.string().trim().max(32, "Mã ngôn ngữ tối đa 32 ký tự").default("vi"),
  language_back: z.string().trim().max(32, "Mã ngôn ngữ tối đa 32 ký tự").default("en"),
  level: z
    .string()
    .trim()
    .max(32, "Cấp độ tối đa 32 ký tự")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  tags: z
    .array(z.string().trim().max(30, "Tag tối đa 30 ký tự"))
    .max(20, "Tối đa 20 tags")
    .default([]),
});

export const updateCatalogMetadataSchema = z.object({
  catalog_set_id: z.string().uuid("ID bộ catalog không hợp lệ"),
  expected_updated_at: z.string().min(1, "expected_updated_at is required"),
  title: z
    .string()
    .trim()
    .min(1, "Tiêu đề không được để trống")
    .max(120, "Tiêu đề tối đa 120 ký tự"),
  description: z
    .string()
    .trim()
    .max(500, "Mô tả tối đa 500 ký tự")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  category_id: z.string().uuid("Danh mục không hợp lệ"),
  language_front: z.string().trim().max(32, "Mã ngôn ngữ tối đa 32 ký tự").default("vi"),
  language_back: z.string().trim().max(32, "Mã ngôn ngữ tối đa 32 ký tự").default("en"),
  level: z
    .string()
    .trim()
    .max(32, "Cấp độ tối đa 32 ký tự")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  tags: z
    .array(z.string().trim().max(30, "Tag tối đa 30 ký tự"))
    .max(20, "Tối đa 20 tags")
    .default([]),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_REGEX, "Slug chỉ được chứa chữ thường không dấu, số và dấu gạch ngang")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
});

export const replaceCatalogCardsSchema = z.object({
  catalog_set_id: z.string().uuid("ID bộ catalog không hợp lệ"),
  expected_updated_at: z.string().min(1, "expected_updated_at is required"),
  cards: z.array(catalogCardItemSchema).max(2000, "Trình biên tập chỉ hỗ trợ tối đa 2000 thẻ"),
  reason: z.string().trim().min(1, "Lý do thay đổi là bắt buộc").max(500, "Lý do tối đa 500 ký tự"),
});

export const catalogLifecycleActionSchema = z.object({
  catalog_set_id: z.string().uuid("ID bộ catalog không hợp lệ"),
  expected_updated_at: z.string().min(1, "expected_updated_at is required"),
  reason: z.string().trim().min(1, "Lý do thao tác là bắt buộc").max(500, "Lý do tối đa 500 ký tự"),
});

export const swapStarterSetSchema = z.object({
  old_starter_set_id: z.string().uuid("ID bộ starter cũ không hợp lệ"),
  new_draft_set_id: z.string().uuid("ID bộ draft mới không hợp lệ"),
  expected_updated_at_old: z.string().min(1, "expected_updated_at_old is required"),
  expected_updated_at_new: z.string().min(1, "expected_updated_at_new is required"),
  reason: z
    .string()
    .trim()
    .min(1, "Lý do thay thế starter là bắt buộc")
    .max(500, "Lý do tối đa 500 ký tự"),
});

export type CreateCatalogSetInput = z.infer<typeof createCatalogSetSchema>;
export type UpdateCatalogMetadataInput = z.infer<typeof updateCatalogMetadataSchema>;
export type ReplaceCatalogCardsInput = z.infer<typeof replaceCatalogCardsSchema>;
export type CatalogLifecycleActionInput = z.infer<typeof catalogLifecycleActionSchema>;
export type SwapStarterSetInput = z.infer<typeof swapStarterSetSchema>;
export type CatalogCardItem = z.infer<typeof catalogCardItemSchema>;
