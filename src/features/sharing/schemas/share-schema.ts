import { z } from "zod";

export const shareActionSchema = z.object({
  setId: z.uuid("Mã bộ flashcard không hợp lệ."),
  enabled: z.boolean().optional(),
});
