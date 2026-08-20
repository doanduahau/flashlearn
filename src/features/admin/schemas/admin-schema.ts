import { z } from "zod";

// ============================================================
// Catalog mutation schemas
// ============================================================

export const adminCatalogUpdateSchema = z.object({
  catalog_set_id: z.uuid("Bộ thư viện không hợp lệ."),
  title: z.string().trim().min(1, "Tiêu đề không được để trống.").max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  category_id: z.uuid().optional(),
  language_front: z.string().trim().min(1).max(20).optional(),
  language_back: z.string().trim().min(1).max(20).optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]).optional().nullable(),
  tags: z.array(z.string().trim().max(50)).max(10).optional(),
  is_starter: z.boolean().optional(),
});

export const adminReasonSchema = z
  .string()
  .trim()
  .min(1, "Lý do không được để trống.")
  .max(500, "Lý do tối đa 500 ký tự.");

// ============================================================
// User mutation schemas
// ============================================================

export const adminUsageAdjustSchema = z.object({
  target_user_id: z.uuid("ID người dùng không hợp lệ."),
  usage_key: z.string().trim().min(1, "Usage key không được để trống.").max(100),
  amount: z
    .number()
    .int("Số tiền phải là số nguyên.")
    .min(-10000, "Số tiền tối thiểu -10000.")
    .max(10000, "Số tiền tối đa 10000.")
    .refine((v) => v !== 0, "Số tiền không được bằng 0."),
  reason: adminReasonSchema,
});

export const adminEntitlementOverrideSchema = z.object({
  target_user_id: z.uuid("ID người dùng không hợp lệ."),
  entitlement_key: z.string().trim().min(1).max(100),
  value_type: z.enum(["integer", "boolean", "text"]),
  integer_value: z.number().int().min(-100000).max(100000).optional(),
  boolean_value: z.boolean().optional(),
  text_value: z.string().trim().max(500).optional(),
  expires_at: z.string().datetime("Thời hạn không hợp lệ."),
  reason: adminReasonSchema,
});

// ============================================================
// Job mutation schemas
// ============================================================

export const adminJobRetrySchema = z.object({
  job_id: z.uuid("ID công việc không hợp lệ."),
  reason: adminReasonSchema,
});

// ============================================================
// Catalog card schemas
// ============================================================

export const adminCatalogCardSchema = z.object({
  front: z.string().trim().min(1, "Mặt trước không được trống.").max(5000),
  back: z.string().trim().min(1, "Mặt sau không được trống.").max(5000),
});

export const adminCatalogCardsSchema = z
  .array(adminCatalogCardSchema)
  .min(1, "Phải có ít nhất 1 thẻ.")
  .max(2000, "Tối đa 2000 thẻ.");
