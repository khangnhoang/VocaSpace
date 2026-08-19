// lib/schemas/fsrs.ts (Hoặc ghép chung vào learn.ts)
import { z } from "zod";

export const fsrsMetaSchema = z.object({
  due: z.coerce.date(), // Tự động biến string ISO thành Object Date
  stability: z.number(),
  difficulty: z.number(),
  elapsed_days: z.number(),
  scheduled_days: z.number(),
  learning_steps: z.number(),
  reps: z.number(),
  lapses: z.number(),
  state: z.number(),
  last_review: z.coerce.date().optional().nullable(),
});

export const cardReviewInputSchema = z.strictObject({
  cardId: z.uuid(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});
