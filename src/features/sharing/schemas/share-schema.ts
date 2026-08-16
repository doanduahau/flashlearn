import { z } from "zod";

export const shareActionSchema = z.object({
  setId: z.uuid("Mã bộ flashcard không hợp lệ."),
  enabled: z.boolean().optional(),
});

export const cloneSharedSetSchema = z.object({
  token: z.string().regex(/^[0-9a-f]{32}$/, "Token chia sẻ không hợp lệ."),
});
