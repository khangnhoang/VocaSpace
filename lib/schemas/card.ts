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

export const topicIdSchema = z.uuid("ID bài học không hợp lệ.");
export const cardIdSchema = z.uuid("ID thẻ từ vựng không hợp lệ.");

export const createCardActionSchema = z.object({
  topicId: topicIdSchema,
  values: cardSchema,
  confirmPublished: z.boolean().optional().default(false),
});

export const updateCardActionSchema = z.object({
  cardId: cardIdSchema,
  values: cardSchema,
  confirmPublished: z.boolean().optional().default(false),
});

export const createBulkCardsActionSchema = z.object({
  topicId: topicIdSchema,
  cardsData: z
    .array(cardSchema)
    .min(1, "Danh sách thẻ từ vựng không được để trống."),
  confirmPublished: z.boolean().optional().default(false),
});

export const deleteCardSchema = z.object({
  cardId: cardIdSchema,
  confirmPublished: z.boolean().optional().default(false),
});

export type CreateCardActionInput = z.infer<typeof createCardActionSchema>;
export type UpdateCardActionInput = z.infer<typeof updateCardActionSchema>;
export type CreateBulkCardsActionInput = z.infer<
  typeof createBulkCardsActionSchema
>;
export type DeleteCardInput = z.infer<typeof deleteCardSchema>;
