import { z } from "zod";

export const cardSchema = z.object({
  word: z.string().min(1, { message: "Vui lòng nhập từ vựng" }),
  pos: z.string().optional(),
  phonetic: z.string().optional(),
  translation: z.string().min(1, { message: "Vui lòng nhập nghĩa của từ" }),
  explanation: z.string().optional(),
  example: z.string().optional(),
  exampleTranslation: z.string().optional(),
  hint: z.string().optional(),
});

export type CardFormValues = z.infer<typeof cardSchema>;