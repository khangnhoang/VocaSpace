import type { SupabaseClient } from "@supabase/supabase-js";

export async function hasLearningEnrollment(
  supabase: SupabaseClient,
  userId: string,
  courseId: string,
) {
  const { data, error } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
}
