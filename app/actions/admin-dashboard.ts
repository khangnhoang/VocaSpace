// app/actions/admin-dashboard.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { getActiveProfileEmails } from "@/lib/supabase/profile-emails";
import {
  adminDashboardSchema,
  adminDashboardSummaryRpcSchema,
  AdminDashboardDTO,
  RawEnrollmentJoin,
} from "@/lib/schemas/admin-dashboard";

const MISSING_LEARNER_NAME = "Học viên ẩn danh";
const MISSING_COURSE_TITLE = "Khóa học đã bị gỡ bỏ";

export async function getAdminDashboardData(): Promise<{ data?: AdminDashboardDTO; error?: string }> {
  const supabase = await createClient();

  try {
    // ------------------------------------------------------------------------
    // STEP 1: KIỂM TRA QUYỀN TRUY CẬP (ROLE VALIDATION)
    // ------------------------------------------------------------------------
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .is("removed_at", null)
      .single();

    if (profileError || !profile || profile.role !== "admin") {
      return { error: "Từ chối truy cập. Bạn không có quyền hạn quản trị viên." };
    }

    // ------------------------------------------------------------------------
    // STEP 2: SỐ LIỆU TỔNG HỢP TỪ RPC + NĂM LƯỢT GHI DANH GẦN NHẤT
    // Mọi số đếm/tổng nằm trong RPC để không bị cắt ở max_rows (1000); chỉ danh sách năm lượt ghi danh đọc theo dòng.
    // ------------------------------------------------------------------------
    const [summaryResult, recentEnrollmentsResult] = await Promise.all([
      supabase.rpc("admin_dashboard_summary"),
      supabase
        .from("enrollments")
        .select(`
          id,
          enrolled_at,
          profiles:user_id (id, full_name, avatar_url),
          courses:course_id (title)
        `)
        .order("enrolled_at", { ascending: false })
        .limit(5),
    ]);

    if (summaryResult.error || recentEnrollmentsResult.error) {
      console.error("❌ [ADMIN DASHBOARD QUERY ERROR]:", summaryResult.error ?? recentEnrollmentsResult.error);
      throw new Error("Một trong các câu truy vấn của báo cáo quản trị bị thất bại.");
    }

    const summary = adminDashboardSummaryRpcSchema.safeParse(summaryResult.data);
    if (!summary.success) {
      console.error("❌ [ADMIN DASHBOARD SUMMARY SHAPE ERROR]:", summary.error.issues);
      return { error: "Cấu trúc dữ liệu tổng hợp không hợp lệ." };
    }
    const rpc = summary.data;

    // ------------------------------------------------------------------------
    // STEP 3: ÁNH XẠ SANG DTO
    // ------------------------------------------------------------------------
    const rawEnrollments = (recentEnrollmentsResult.data || []) as unknown as RawEnrollmentJoin[];
    // AUTH-019: email học viên chỉ đọc bằng service role, sau bước kiểm tra admin ở STEP 1,
    // và chỉ cho các hồ sơ đang hoạt động mà query ghi danh vừa trả về.
    const studentEmails = await getActiveProfileEmails(
      rawEnrollments.flatMap((e) => (e.profiles ? [e.profiles.id] : [])),
    );
    if (!studentEmails) {
      throw new Error("Không đọc được email học viên của các lượt ghi danh gần đây.");
    }

    const rawDataPayload = {
      generatedAt: rpc.generated_at,
      pending: {
        count: rpc.pending.count,
        oldestSubmittedAt: rpc.pending.oldest_submitted_at,
      },
      metrics: {
        revenue: rpc.revenue.total,
        students: rpc.users.students,
        publishedCourses: rpc.published_courses,
        learningCards: rpc.flashcards,
      },
      revenueMonths: rpc.revenue.months,
      userDistribution: rpc.users,
      topCourses: rpc.top_courses.map((c) => ({
        id: c.id,
        title: c.title,
        enrollmentCount: c.enrollment_count,
        revenue: c.revenue,
      })),
      recentEnrollments: rawEnrollments.map((e) => ({
        id: e.id,
        studentName: e.profiles?.full_name || MISSING_LEARNER_NAME,
        // Hồ sơ đã gỡ/không còn hoặc chưa có email thì để null, không bịa email.
        studentEmail: (e.profiles && studentEmails.get(e.profiles.id)) || null,
        studentAvatar: e.profiles?.avatar_url || null,
        courseTitle: e.courses?.title || MISSING_COURSE_TITLE,
        enrolledAt: e.enrolled_at,
      })),
    };

    // ------------------------------------------------------------------------
    // STEP 4: SCHEMA STRUCTURING (CHỐT CHẶN AN TOÀN)
    // ------------------------------------------------------------------------
    const validated = adminDashboardSchema.safeParse(rawDataPayload);

    if (!validated.success) {
      console.error("❌ [ADMIN DASHBOARD ZOD ERROR]:", validated.error.issues);
      return { error: "Cấu trúc dữ liệu tổng hợp không hợp lệ." };
    }

    return { data: validated.data };

  } catch (err) {
    console.error("❌ [ADMIN DASHBOARD EXCEPTION]:", err);
    return { error: "Gặp sự cố hệ thống khi tải báo cáo dữ liệu quản trị." };
  }
}
