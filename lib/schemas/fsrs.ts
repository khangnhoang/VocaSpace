// lib/schemas/fsrs.ts (Hoặc ghép chung vào learn.ts)
import { z } from "zod";

export const fsrsMetaSchema = z.object({
  due: z.coerce.date(), // Tự động biến string ISO thành Object Date
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: z.number(),
  scheduled_days: z.number(),
  reps: z.number(),
  lapses: z.number(),
  state: z.number(),
  last_review: z.coerce.date().optional().nullable(),
});