import { toast } from "sonner";
import type { TopicProgress } from "@/lib/schemas/learning-workspace";

export const MEMORY_CHECK_PASSED_MESSAGE = "Đã hoàn thành memory check!";
export const newCardsAddedMessage = (count: number) =>
  `Bài học vừa có thêm ${count} thẻ mới. Học xong rồi làm lại memory check nhé.`;

/**
 * D4 G7: a failed sync after a saved write is surfaced but does not block
 * learning. `onCompleted` lets the workspace show the persistent completed state
 * whenever the server reports the topic as complete; its argument is the server's
 * `newlyCompleted`. LF5: a new completion has no toast, the workspace shows the
 * completion screen instead.
 */
export function announceTopicProgress(
  result: {
    topicProgress?: TopicProgress;
    progressError?: string;
  },
  onCompleted?: (newlyCompleted: boolean) => void,
) {
  if (result.topicProgress?.isTopicCompleted) {
    onCompleted?.(result.topicProgress.newlyCompleted);
  }
  if (result.progressError) toast.error(result.progressError);
}
