import { toast } from "sonner";
import type { TopicProgress } from "@/lib/schemas/learning-workspace";

/**
 * D4 G7: a failed sync after a saved write is surfaced but does not block
 * learning. `onCompleted` lets the workspace show the persistent completed state
 * whenever the server reports the topic as complete; its argument is the server's
 * `newlyCompleted`. LF5: a new completion has no toast, the workspace shows the
 * completion screen instead.
 * `progressError` is the already-translated notice (U3 H4): the caller resolves the server text against the recorded key of its
 * own request; absent, the result's text is shown as the server built it.
 */
export function announceTopicProgress(
  result: {
    topicProgress?: TopicProgress;
    progressError?: string;
  },
  onCompleted?: (newlyCompleted: boolean) => void,
  progressError?: string,
) {
  if (result.topicProgress?.isTopicCompleted) {
    onCompleted?.(result.topicProgress.newlyCompleted);
  }
  const notice = progressError ?? result.progressError;
  if (notice) toast.error(notice);
}
