import { z } from "zod";

export const topicContributorInputSchema = z.object({
  topicId: z.uuid("ID bài học không hợp lệ."),
  userId: z.uuid("ID cộng tác viên không hợp lệ."),
});

export const topicContributorRemovalSchema = z.object({
  contributorId: z.uuid("ID contributor không hợp lệ."),
});

export const topicResponsibilityTransferSchema = z.object({
  topicId: z.uuid("ID bài học không hợp lệ."),
  recipientUserId: z.uuid("ID người nhận trách nhiệm không hợp lệ."),
});

export type TopicContributorInput = z.infer<typeof topicContributorInputSchema>;
export type TopicContributorRemovalInput = z.infer<typeof topicContributorRemovalSchema>;
export type TopicResponsibilityTransferInput = z.infer<typeof topicResponsibilityTransferSchema>;
