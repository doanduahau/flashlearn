import { z } from "zod";

export const adjustUserUsageSchema = z.object({
  target_user_id: z.string().uuid("ID người dùng không hợp lệ"),
  usage_key: z.string().trim().min(1, "Khóa sử dụng không được để trống"),
  amount: z
    .number()
    .int("Số lượng phải là số nguyên")
    .refine((val) => val !== 0, "Số lượng điều chỉnh phải khác 0")
    .refine(
      (val) => val >= -10000 && val <= 10000,
      "Số lượng điều chỉnh phải từ -10,000 đến +10,000",
    ),
  reason: z
    .string()
    .trim()
    .min(10, "Lý do phải có ít nhất 10 ký tự")
    .max(500, "Lý do tối đa 500 ký tự"),
  mutation_token: z.string().uuid("Mutation token không hợp lệ").optional(),
});

export type AdjustUserUsageInput = z.infer<typeof adjustUserUsageSchema>;

export const overrideUserEntitlementSchema = z.object({
  target_user_id: z.string().uuid("ID người dùng không hợp lệ"),
  entitlement_key: z.string().trim().min(1, "Khóa quyền lợi không được để trống"),
  value_type: z.enum(["integer", "boolean", "text"]),
  integer_value: z
    .number()
    .int("Giá trị phải là số nguyên")
    .min(0, "Giá trị phải >= 0")
    .optional()
    .nullable(),
  boolean_value: z.boolean().optional().nullable(),
  text_value: z.string().trim().min(1).max(500).optional().nullable(),
  expires_at: z
    .string()
    .min(1, "Ngày hết hạn không được để trống")
    .refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && date.getTime() > Date.now();
    }, "Ngày hết hạn phải trong tương lai")
    .refine((val) => {
      const date = new Date(val);
      const maxDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 + 60 * 1000);
      return date <= maxDate;
    }, "Thời hạn tùy chỉnh tối đa 365 ngày"),
  expected_updated_at: z.string().optional().nullable(),
  reason: z
    .string()
    .trim()
    .min(10, "Lý do phải có ít nhất 10 ký tự")
    .max(500, "Lý do tối đa 500 ký tự"),
  mutation_token: z.string().uuid("Mutation token không hợp lệ").optional(),
});

export type OverrideUserEntitlementInput = z.infer<typeof overrideUserEntitlementSchema>;

export const removeUserEntitlementOverrideSchema = z.object({
  target_user_id: z.string().uuid("ID người dùng không hợp lệ"),
  entitlement_key: z.string().trim().min(1, "Khóa quyền lợi không được để trống"),
  expected_updated_at: z.string().optional().nullable(),
  reason: z
    .string()
    .trim()
    .min(10, "Lý do phải có ít nhất 10 ký tự")
    .max(500, "Lý do tối đa 500 ký tự"),
  mutation_token: z.string().uuid("Mutation token không hợp lệ").optional(),
});

export type RemoveUserEntitlementOverrideInput = z.infer<
  typeof removeUserEntitlementOverrideSchema
>;
