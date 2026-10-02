import { toast } from "sonner";
import type { TopicProgress } from "@/lib/schemas/learning-workspace";

export const TOPIC_COMPLETED_MESSAGE = "Chúc mừng bạn đã hoàn thành trọn vẹn bài học!";

/**
 * D4 G7: completion is announced only when the server reports the topic just
 * became complete; a failed sync after a saved write is surfaced but does not
 * block learning. `onCompleted` lets the workspace show the persistent
 * completed state whenever the server reports the topic as complete.
 */
export function announceTopicProgress(
  result: {
    topicProgress?: TopicProgress;
    progressError?: string;
  },
  onCompleted?: () => void,
) {
  if (result.topicProgress?.newlyCompleted) toast.success(TOPIC_COMPLETED_MESSAGE);
  if (result.topicProgress?.isTopicCompleted) onCompleted?.();
  if (result.progressError) toast.error(result.progressError);
}
