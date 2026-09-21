import { z } from "zod";
import { topicAuthorIdentitySchema } from "@/lib/schemas/topic-workflow";

const topicIdSchema = z.uuid("ID bài học không hợp lệ.");
const noteIdSchema = z.uuid("ID ghi chú không hợp lệ.");

// Khớp `review_notes_body_length_check` và độ dài `rejection_reason` hiện có.
export const reviewNoteBodySchema = z
  .string()
  .trim()
  .min(1, "Nội dung ghi chú không được để trống.")
  .max(2000, "Ghi chú không được vượt quá 2000 ký tự.");

// Cố ý KHÔNG có `authorUserId`: đây là field server-owned, lấy từ auth.uid()
// (cột có default auth.uid() và policy WITH CHECK ép lại).
export const createReviewNoteSchema = z
  .strictObject({
    topicId: topicIdSchema,
    cardId: z.uuid().nullable().optional(),
    exerciseId: z.uuid().nullable().optional(),
    body: reviewNoteBodySchema,
  })
  .refine((value) => !(value.cardId && value.exerciseId), {
    message: "Ghi chú chỉ được gắn vào một flashcard hoặc một bài tập.",
  });

export const updateReviewNoteSchema = z.strictObject({
  noteId: noteIdSchema,
  body: reviewNoteBodySchema,
});

export const removeReviewNoteSchema = z.strictObject({ noteId: noteIdSchema });

export const topicReviewNotesReadInputSchema = z.object({ topicId: topicIdSchema });

export const reviewNoteSchema = z.strictObject({
  id: z.uuid(),
  topicId: z.uuid(),
  cardId: z.uuid().nullable(),
  exerciseId: z.uuid().nullable(),
  author: topicAuthorIdentitySchema,
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  isEdited: z.boolean(),
  removedAt: z.string().nullable(),
  removedBy: topicAuthorIdentitySchema.nullable(),
});

// DTO của đường đọc: giữ nguyên `reviewNoteSchema` ở trên (canonical note shape) và
// bổ sung nhãn đích để UI render "Flashcard: <từ>" / "Bài tập: <tiêu đề>".
// Nguồn nhãn: `exercise.title`, còn card lấy `front_content.word` — bảng `cards`
// không có cột `title` trong repository này.
export const topicReviewNoteSchema = reviewNoteSchema.extend({
  cardTitle: z.string().nullable(),
  exerciseTitle: z.string().nullable(),
});

export type CreateReviewNoteInput = z.infer<typeof createReviewNoteSchema>;
export type UpdateReviewNoteInput = z.infer<typeof updateReviewNoteSchema>;
export type RemoveReviewNoteInput = z.infer<typeof removeReviewNoteSchema>;
export type TopicReviewNotesReadInput = z.infer<typeof topicReviewNotesReadInputSchema>;
export type ReviewNote = z.infer<typeof reviewNoteSchema>;
export type TopicReviewNote = z.infer<typeof topicReviewNoteSchema>;
