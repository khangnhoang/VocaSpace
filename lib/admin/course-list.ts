import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ADMIN_COURSE_PAGE_SIZE,
  adminCourseStatusFilters,
  type AdminCourseFilter,
  type AdminCourseItemStatus,
  type AdminCourseListData,
  type AdminCourseListRow,
  type AdminCourseOutlineChapter,
  type AdminCourseOutlineTopic,
  type AdminCourseStatusFilter,
  type AdminCourseSummary,
  type AdminCourseTabCounts,
} from "@/lib/schemas/admin-course";
import { readAllSupabaseRows } from "@/lib/supabase-pagination";

// Đọc dữ liệu màn hình /admin/courses bằng chính session của admin (không service role, AD3 G1).
// Quyền đọc đến từ nhánh admin của policy `can_view_course_basic`; module này không tự kiểm tra quyền,
// nên caller phải gọi sau requireAdminPage() (page) hoặc getActiveAdminUserId() (Server Action).

export type AdminCourseReadResult<T> = { data: T; error: null } | { data: null; error: string };

const COURSE_COLUMNS =
  "id, title, slug, price, status, submitted_at, reviewed_at, reject_message, removed_at";
// Filter `role = owner` trên embed chỉ thu hẹp các dòng collaborator được nhúng, không loại course khỏi kết quả.
const OWNER_EMBED = "course_collaborators(role, profiles(full_name))";

type OwnerEmbed = {
  role: string;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};

type CourseRow = {
  id: string;
  title: string;
  slug: string;
  price: number;
  status: AdminCourseItemStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  reject_message: string | null;
  removed_at: string | null;
  course_collaborators?: OwnerEmbed[] | null;
};

/**
 * Escape một cụm tìm kiếm thành điều kiện `.or(...)` trên title và slug để mọi ký tự được so khớp đúng nghĩa đen (AD3 G3).
 * Hai lớp: (1) `\`, `%`, `_` cho LIKE; (2) bọc dấu nháy kép và escape `\`, `"` theo quy tắc giá trị của PostgREST,
 * nhờ đó `,`, `(`, `)` không tách hay đóng điều kiện `or`. PostgREST còn đổi `*` thành `%` trong like/ilike,
 * nên `*` được thay bằng `_` (khớp ký tự `*`, và cả một ký tự bất kỳ) thay vì trở thành wildcard nhiều ký tự.
 */
export function buildCourseSearchFilter(q: string): string {
  const likeEscaped = q.replace(/[\\%_]/g, (char) => `\\${char}`).replace(/\*/g, "_");
  const pattern = `%${likeEscaped}%`;
  const quoted = `"${pattern.replace(/[\\"]/g, (char) => `\\${char}`)}"`;
  return `title.ilike.${quoted},slug.ilike.${quoted}`;
}

function ownerNameOf(row: CourseRow): string | null {
  const owner = row.course_collaborators?.find((member) => member.role === "owner");
  if (!owner) return null;
  const profile = Array.isArray(owner.profiles) ? owner.profiles[0] : owner.profiles;
  const name = profile?.full_name?.trim();
  return name ? name : null;
}

function mapCourseRow(row: CourseRow): AdminCourseListRow {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    price: row.price,
    ownerName: ownerNameOf(row),
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    // Lý do chỉ hiển thị cho course draft đã bị admin từ chối; gửi duyệt lại xóa dấu vết này ở RPC.
    rejectMessage:
      row.status === "draft" && row.reviewed_at && row.reject_message ? row.reject_message : null,
    removedAt: row.removed_at,
  };
}

// Truy vấn `courses` đã áp bộ lọc của một tab và cụm tìm kiếm. Tab removed chỉ gồm course có removed_at;
// các tab còn lại chỉ gồm course chưa bị gỡ (AD3 AC3).
function filteredCourses(
  supabase: SupabaseClient,
  columns: string,
  status: AdminCourseStatusFilter,
  q: string,
  options?: { count: "exact"; head: boolean },
) {
  let query = supabase.from("courses").select(columns, options);
  if (status === "removed") {
    query = query.not("removed_at", "is", null);
  } else {
    query = query.is("removed_at", null);
    if (status !== "all") query = query.eq("status", status);
  }
  if (q) query = query.or(buildCourseSearchFilter(q));
  return query;
}

async function countTab(supabase: SupabaseClient, status: AdminCourseStatusFilter, q: string) {
  const { count, error } = await filteredCourses(supabase, "id", status, q, { count: "exact", head: true });
  return error ? null : count;
}

export async function listAdminCourses(
  supabase: SupabaseClient,
  filter: AdminCourseFilter,
): Promise<AdminCourseReadResult<AdminCourseListData>> {
  const { status, q, page } = filter;

  const countResults = await Promise.all(adminCourseStatusFilters.map((tab) => countTab(supabase, tab, q)));
  if (countResults.some((count) => count === null)) {
    console.error("[ADMIN COURSE COUNT ERROR]");
    return { data: null, error: "Không thể tải danh sách khóa học. Vui lòng thử lại." };
  }
  const counts = Object.fromEntries(
    adminCourseStatusFilters.map((tab, index) => [tab, countResults[index] as number]),
  ) as AdminCourseTabCounts;

  const total = counts[status];
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_COURSE_PAGE_SIZE));
  const meta = { counts, total, page, pageSize: ADMIN_COURSE_PAGE_SIZE, totalPages };

  // Trang vượt quá trang cuối: không đọc hàng nào (range vượt count có thể bị API từ chối), UI hiển thị trạng thái rỗng.
  if (total === 0 || page > totalPages) return { data: { rows: [], ...meta }, error: null };

  const from = (page - 1) * ADMIN_COURSE_PAGE_SIZE;
  const ordered = filteredCourses(supabase, `${COURSE_COLUMNS}, ${OWNER_EMBED}`, status, q).eq(
    "course_collaborators.role",
    "owner",
  );
  const primaryOrder =
    status === "pending"
      ? ordered.order("submitted_at", { ascending: true })
      : status === "removed"
        ? ordered.order("removed_at", { ascending: false })
        : ordered.order("updated_at", { ascending: false });

  const { data, error } = await primaryOrder
    .order("id", { ascending: true })
    .range(from, from + ADMIN_COURSE_PAGE_SIZE - 1);

  if (error) {
    console.error("[ADMIN COURSE LIST ERROR]:", error);
    return { data: null, error: "Không thể tải danh sách khóa học. Vui lòng thử lại." };
  }

  return { data: { rows: ((data ?? []) as unknown as CourseRow[]).map(mapCourseRow), ...meta }, error: null };
}

type ChapterRow = { id: string; title: string };
type TopicRow = { id: string; chapter_id: string | null; title: string; status: AdminCourseItemStatus };

/**
 * Metadata và dàn bài (chương, bài học đang hoạt động) của một khóa học cho panel tóm tắt (AD3 AC4).
 * Không đọc nội dung bài học. Dàn bài đọc đủ vượt `max_rows` của API nhờ readAllSupabaseRows; mỗi truy vấn sắp xếp
 * theo (order_index, id) để các trang liên tiếp không trùng hay sót hàng.
 * `{ data: null, error: null }` nghĩa là không có course nào với id này.
 */
export async function getAdminCourseSummaryData(
  supabase: SupabaseClient,
  courseId: string,
): Promise<AdminCourseReadResult<AdminCourseSummary> | { data: null; error: null }> {
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select(`${COURSE_COLUMNS}, description, thumbnail_url, ${OWNER_EMBED}`)
    .eq("id", courseId)
    .eq("course_collaborators.role", "owner")
    .maybeSingle();

  if (courseError) {
    console.error("[ADMIN COURSE SUMMARY ERROR]:", courseError);
    return { data: null, error: "Không thể tải tóm tắt khóa học. Vui lòng thử lại." };
  }
  if (!course) return { data: null, error: null };

  const [chapters, topics] = await Promise.all([
    readAllSupabaseRows<ChapterRow>((from, to) =>
      supabase
        .from("chapters")
        .select("id, title")
        .eq("course_id", courseId)
        .is("removed_at", null)
        .order("order_index", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
    readAllSupabaseRows<TopicRow>((from, to) =>
      supabase
        .from("topics")
        .select("id, chapter_id, title, status")
        .eq("course_id", courseId)
        .is("removed_at", null)
        .order("order_index", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  if (chapters.data === null || topics.data === null) {
    console.error("[ADMIN COURSE OUTLINE ERROR]:", chapters.error ?? topics.error);
    return { data: null, error: "Không thể tải tóm tắt khóa học. Vui lòng thử lại." };
  }

  const topicsByChapter = new Map<string, AdminCourseOutlineTopic[]>();
  for (const topic of topics.data) {
    if (!topic.chapter_id) continue;
    const list = topicsByChapter.get(topic.chapter_id) ?? [];
    list.push({ id: topic.id, title: topic.title, status: topic.status });
    topicsByChapter.set(topic.chapter_id, list);
  }

  // Chỉ chương đang hoạt động được liệt kê; bài học thuộc chương đã gỡ không xuất hiện và không được đếm.
  const outline: AdminCourseOutlineChapter[] = chapters.data.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    topics: topicsByChapter.get(chapter.id) ?? [],
  }));
  const publishedTopicCount = outline.reduce(
    (sum, chapter) => sum + chapter.topics.filter((topic) => topic.status === "published").length,
    0,
  );

  const row = course as unknown as CourseRow & { description: string | null; thumbnail_url: string | null };
  return {
    data: {
      course: { ...mapCourseRow(row), description: row.description, thumbnailUrl: row.thumbnail_url },
      chapters: outline,
      publishedTopicCount,
    },
    error: null,
  };
}
