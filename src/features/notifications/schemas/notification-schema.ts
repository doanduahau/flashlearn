import { z } from "zod";

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const saveNotificationPreferencesSchema = z.object({
  pushEnabled: z.boolean(),
  streakEnabled: z.boolean(),
  streakTime: z.string().regex(timeRegex, "Giờ nhắc giữ streak không hợp lệ (định dạng HH:MM)."),
  reviewEnabled: z.boolean(),
  reviewTime: z.string().regex(timeRegex, "Giờ nhắc ôn tập không hợp lệ (định dạng HH:MM)."),
});

export const savePushSubscriptionSchema = z.object({
  endpoint: z.string().min(1, "Endpoint không được để trống."),
  p256dh: z.string().min(1, "Khóa p256dh không được để trống."),
  auth: z.string().min(1, "Khóa auth không được để trống."),
  userAgent: z.string().optional(),
});

export const deletePushSubscriptionSchema = z.object({
  endpoint: z.string().optional(),
});

export type SaveNotificationPreferencesInput = z.infer<typeof saveNotificationPreferencesSchema>;
export type SavePushSubscriptionInput = z.infer<typeof savePushSubscriptionSchema>;
export type DeletePushSubscriptionInput = z.infer<typeof deletePushSubscriptionSchema>;
