import { z } from "zod";

import { IMPORT_MAX_ROWS } from "@/lib/constants";

export const importPayloadSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên bộ flashcard.").max(120),
  cards: z
    .array(
      z.object({
        front: z.string().trim().min(1).max(50000),
        back: z.string().trim().min(1).max(50000),
      }),
    )
    .min(1)
    .max(IMPORT_MAX_ROWS),
});
