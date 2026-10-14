import { randomUUID } from "node:crypto";
import { isolatedAdmin } from "../../scripts/e2e/admin-gate-fixture.mjs";

const TEACHER_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN_ID = "11111111-1111-4111-8111-111111111111";

type FixtureCourse = { id: string; title: string; slug: string };

function throwIfError(label: string, error: { message: string } | null) {
  if (error) throw new Error(`${label}: ${error.message}`);
}

/**
 * Dựng 3 khóa học cho spec duyệt của admin (AD3): hai khóa chờ duyệt (khóa "approve" gửi trước khóa "reject") và một khóa đã xuất bản.
 * Mỗi khóa có owner là giáo viên seed, một chương và một bài học đã xuất bản. Chỉ chạy trên runtime E2E cô lập (cổng 45441):
 * isolatedAdmin từ chối mọi môi trường khác trước khi tạo client ghi.
 */
export async function createAdminCourseReviewFixture() {
  const supabase = isolatedAdmin(process.env);
  const suffix = randomUUID().slice(0, 8);
  const createdIds: string[] = [];

  async function createCourse(label: string, status: "pending" | "published", submittedMinutesAgo: number | null) {
    const title = `AD3 E2E ${label} ${suffix}`;
    const slug = `ad3-e2e-${label}-${suffix}`;
    const { data: course, error } = await supabase
      .from("courses")
      .insert({
        title,
        slug,
        description: `Khóa học kiểm thử ${label}`,
        status,
        price: 0,
        submitted_at:
          submittedMinutesAgo === null ? null : new Date(Date.now() - submittedMinutesAgo * 60_000).toISOString(),
      })
      .select("id")
      .single();
    if (error || !course) throw new Error(`create ${label} course: ${error?.message ?? "no row"}`);
    createdIds.push(course.id);

    const { error: ownerError } = await supabase
      .from("course_collaborators")
      .insert({ course_id: course.id, user_id: TEACHER_ID, role: "owner", added_by: ADMIN_ID });
    throwIfError(`create ${label} owner`, ownerError);

    const { data: chapter, error: chapterError } = await supabase
      .from("chapters")
      .insert({ course_id: course.id, created_by_user_id: TEACHER_ID, title: `Chương ${label}`, order_index: 1 })
      .select("id")
      .single();
    if (chapterError || !chapter) throw new Error(`create ${label} chapter: ${chapterError?.message ?? "no row"}`);

    const { error: topicError } = await supabase.from("topics").insert({
      course_id: course.id,
      chapter_id: chapter.id,
      title: `Bài học ${label}`,
      status: "published",
      order_index: 1,
      original_creator_user_id: TEACHER_ID,
      responsible_author_user_id: TEACHER_ID,
      first_approved_at: new Date().toISOString(),
    });
    throwIfError(`create ${label} topic`, topicError);

    return { id: course.id as string, title, slug } satisfies FixtureCourse;
  }

  async function cleanup() {
    if (createdIds.length === 0) return;
    const ids = [...createdIds];
    createdIds.length = 0;
    // Hạ khóa học tạo audit (và có thể con trỏ nguyên nhân preview); hai bảng này không cascade từ courses.
    for (const [table, column] of [
      ["platform_moderation_audits", "target_id"],
      ["course_preview_moderation_causes", "course_id"],
      ["topics", "course_id"],
      ["chapters", "course_id"],
      ["course_collaborators", "course_id"],
      ["courses", "id"],
    ] as const) {
      const { error } = await supabase.from(table).delete().in(column, ids);
      throwIfError(`remove ${table}`, error);
    }
  }

  try {
    const approve = await createCourse("approve", "pending", 120);
    const reject = await createCourse("reject", "pending", 60);
    const demote = await createCourse("demote", "published", null);
    return { suffix, approve, reject, demote, cleanup };
  } catch (error) {
    // Dựng dở dang vẫn phải dọn; lỗi dọn không che lỗi gốc.
    await cleanup().catch((cleanupError) => console.error(cleanupError));
    throw error;
  }
}
