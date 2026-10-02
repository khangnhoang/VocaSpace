import { toast } from "sonner";
import type { TopicProgress } from "@/lib/schemas/learning-workspace";

export const TOPIC_COMPLETED_MESSAGE = "Chúc mừng bạn đã hoàn thành trọn vẹn bài học!";

/**
 * D4 G7: completion is announced only when the server reports the topic just
 * became complete; a failed sync after a saved write is surfaced but does not
 * block learning.
 */
export function announceTopicProgress(result: {
  topicProgress?: TopicProgress;
  progressError?: string;
}) {
  if (result.topicProgress?.newlyCompleted) toast.success(TOPIC_COMPLETED_MESSAGE);
  if (result.progressError) toast.error(result.progressError);
}
