// app/actions/admin-dashboard.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { 
  adminDashboardSchema, 
  AdminDashboardDTO,
  RawEnrollmentJoin,
  RawCourseWithEnrollments 
} from "@/lib/schemas/admin-dashboard"; // 🔥 IMPORT TOÀN BỘ THEO QUY TẮC SOT

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
    // STEP 2: THỰC THI TRUY VẤN SONG SONG (PROMISE.ALL OPTIMIZATION)
    // ------------------------------------------------------------------------
    const [
      activeCoursesResult,
      flashcardsResult,
      usersResult,
      businessDataResult,
      recentEnrollmentsResult
    ] = await Promise.all([
      supabase.from("courses").select("*", { count: "exact", head: true }).eq("status", "published").is("removed_at", null),
      supabase.from("user_flashcards").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("role").is("removed_at", null),
      supabase.from("courses").select("id, title, price, enrollments(id)").is("removed_at", null),
      supabase.from("enrollments").select(`
        id,
        enrolled_at,
        profiles:user_id (full_name, email, avatar_url),
        courses:course_id (title, price)
      `).order("enrolled_at", { ascending: false }).limit(5)
    ]);

    if (
      activeCoursesResult.error || 
      flashcardsResult.error || 
      usersResult.error || 
      businessDataResult.error || 
      recentEnrollmentsResult.error
    ) {
      // Ném ra exception để khối catch ở dưới bắt lấy và log lại
      throw new Error("Một trong các câu truy vấn độc lập từ Supabase bị thất bại.");
    }

    // ------------------------------------------------------------------------
    // STEP 3: XỬ LÝ VÀ MAPPING DỮ LIỆU TỔNG HỢP
    // ------------------------------------------------------------------------
    let studentsCount = 0;
    let teachersCount = 0;
    let adminsCount = 0;

    const rawUsers = usersResult.data || [];
    rawUsers.forEach((u) => {
      if (u.role === "student") studentsCount++;
      else if (u.role === "teacher") teachersCount++;
      else if (u.role === "admin") adminsCount++;
    });

    let totalRevenue = 0;
    const rawCourses = (businessDataResult.data || []) as unknown as RawCourseWithEnrollments[];
    
    const mappedTopCourses = rawCourses.map((c) => {
      const enrollmentCount = c.enrollments?.length || 0;
      const courseRevenue = enrollmentCount * c.price;
      totalRevenue += courseRevenue;

      return {
        id: c.id,
        title: c.title,
        enrollmentCount,
        revenue: courseRevenue,
      };
    });

    const top5Courses = mappedTopCourses
      .sort((a, b) => b.enrollmentCount - a.enrollmentCount)
      .slice(0, 5);

    const rawEnrollments = (recentEnrollmentsResult.data || []) as unknown as RawEnrollmentJoin[];
    const mappedEnrollments = rawEnrollments.map((e) => {
      const diffMinutes = Math.floor((Date.now() - new Date(e.enrolled_at).getTime()) / 60000);
      let timeAgo = "Vừa xong";
      if (diffMinutes > 0 && diffMinutes < 60) timeAgo = `${diffMinutes} phút trước`;
      else if (diffMinutes >= 60 && diffMinutes < 1440) timeAgo = `${Math.floor(diffMinutes / 60)} giờ trước`;
      else if (diffMinutes >= 1440) timeAgo = `${Math.floor(diffMinutes / 1440)} ngày trước`;

      return {
        id: e.id,
        studentName: e.profiles?.full_name || "Học viên ẩn danh",
        studentEmail: e.profiles?.email || "no-email@vocaspace.com",
        studentAvatar: e.profiles?.avatar_url || null,
        courseTitle: e.courses?.title || "Khóa học đã bị gỡ bỏ",
        price: e.courses?.price || 0,
        enrolledAt: timeAgo,
      };
    });

    const mockRevenueTrends = [
      { month: "T1", revenue: Math.round(totalRevenue * 0.1) },
      { month: "T2", revenue: Math.round(totalRevenue * 0.15) },
      { month: "T3", revenue: Math.round(totalRevenue * 0.12) },
      { month: "T4", revenue: Math.round(totalRevenue * 0.25) },
      { month: "T5", revenue: Math.round(totalRevenue * 0.18) },
      { month: "T6", revenue: Math.round(totalRevenue * 0.1) },
      { month: "T7", revenue: Math.round(totalRevenue * 0.09) },
    ];

    const rawDataPayload = {
      metrics: {
        totalRevenue,
        totalStudents: studentsCount,
        activeCourses: activeCoursesResult.count || 0,
        totalFlashcardReviews: flashcardsResult.count || 0,
      },
      revenueTrends: mockRevenueTrends,
      userDistribution: {
        students: studentsCount,
        teachers: teachersCount,
        admins: adminsCount,
      },
      topCourses: top5Courses,
      recentEnrollments: mappedEnrollments,
    };

    // ------------------------------------------------------------------------
    // STEP 4: SCHEMA STRUCTURING (CHỐT CHẶN AN TOÀN)
    // ------------------------------------------------------------------------
    const validated = adminDashboardSchema.safeParse(rawDataPayload);

    if (!validated.success) {
      console.error("❌ [ADMIN DASHBOARD ZOD ERROR]:", validated.error.issues);
      return { error: `Cấu trúc dữ liệu tổng hợp không hợp lệ: ${validated.error.issues[0].message}` };
    }

    return { data: validated.data };

  } catch (err) {
    console.error("❌ [ADMIN DASHBOARD EXCEPTION]:", err);
    return { error: "Gặp sự cố hệ thống khi tải báo cáo dữ liệu quản trị." };
  }
}