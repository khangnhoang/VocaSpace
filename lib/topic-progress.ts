import type { SupabaseClient } from "@supabase/supabase-js";
import {
  topicProgressRpcResultSchema,
  type TopicProgress,
} from "@/lib/schemas/learning-workspace";

// D4: topic completion is derived and written only by the database RPC; callers
// never compute or claim completion themselves (plan G1/G5).

/** Syncs the caller's own progress row; returns null when it could not be verified. */
export async function syncTopicProgress(
  supabase: SupabaseClient,
  topicId: string,
): Promise<TopicProgress | null> {
  const { data, error } = await supabase.rpc("d4_sync_topic_progress", {
    p_topic_id: topicId,
  });
  if (error) {
    console.error("Topic progress sync failed", error);
    return null;
  }

  const parsed = topicProgressRpcResultSchema.safeParse(data);
  if (!parsed.success) {
    console.error("Topic progress sync returned invalid data", parsed.error.issues);
    return null;
  }
  return parsed.data;
}
