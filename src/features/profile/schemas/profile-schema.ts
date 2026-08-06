import { z } from "zod";

import { isSupportedTimezone } from "@/features/profile/constants/timezones";
import { PROFILE_DISPLAY_NAME_MAX_LENGTH } from "@/lib/constants";

export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(
      PROFILE_DISPLAY_NAME_MAX_LENGTH,
      `Tên hiển thị tối đa ${PROFILE_DISPLAY_NAME_MAX_LENGTH} ký tự.`,
    )
    .optional()
    .transform((value) => (value && value.length > 0 ? value : null)),
  timezone: z
    .string()
    .max(64, "Múi giờ không hợp lệ.")
    .min(1, "Vui lòng chọn múi giờ.")
    .refine((value) => isSupportedTimezone(value), "Múi giờ không hợp lệ."),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
