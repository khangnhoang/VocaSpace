// app/actions/course-detail.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { 
  courseDetailSchema, 
  CourseDetailDTO,
  RawCourseQueryRow,
  RawChapterQueryRow,
  InstructorDTO
} from "@/lib/schemas/course-detail"; // 🔥 IMPORT TOÀN BỘ THEO QUY TẮC SOT

interface FSRSMetaData {
  state?: number;
  [key: string]: unknown;
}

export async function getCourseDetail(courseSlug: string): Promise<{ data?: CourseDetailDTO; error?: string }> {
  const supabase = await createClient();

  try {
    // 1. Truy vấn thông tin khóa học & Giảng viên
    const { data: rawCourse, error: courseError } = await supabase
      .from("courses")
      .select(`
        id, title, slug, description, thumbnail_url, price,
        course_collaborators (
          role,
          profile:profiles (
            id, full_name, avatar_url,
            teacher_profile:teacher_profiles (bio, experience_years, certifications)
          )
        )
      `)
      .eq("slug", courseSlug)
      .is("removed_at", null)
      .single();

    if (courseError || !rawCourse) {
      return { error: "Không tìm thấy khóa học hoặc khóa học đã bị ẩn." };
    }

    const course = rawCourse as unknown as RawCourseQueryRow;

    // 2. Truy vấn đề cương Syllabus và số lượng count liên quan
    const { data: rawChapters, error: syllabusError } = await supabase
      .from("chapters")
      .select(`
        id, title, order_index,
        topics (
          id, title, slug, status, order_index,
          cards:cards(count),
          exercises:exercises(count)
        )
      `)
      .eq("course_id", course.id)
      .is("removed_at", null)
      .is("topics.removed_at", null)
      .eq("topics.status", "published")
      .order("order_index", { ascending: true });

    if (syllabusError) {
      return { error: "Không thể nạp đề cương bài học lúc này." };
    }

    const chaptersData = (rawChapters || []) as unknown as RawChapterQueryRow[];

    // 3. Xác thực trạng thái Enroll
    const { data: { user } } = await supabase.auth.getUser();
    let is_enrolled = false;

    if (user) {
      const { data: enrollment } = await supabase
        .from("enrollments")
        .select("id")
        .eq("course_id", course.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (enrollment) is_enrolled = true;
    }

    const { count: totalEnrollmentsCount } = await supabase
      .from("enrollments")
      .select("*", { count: "exact", head: true })
      .eq("course_id", course.id);

    // 4. Thực thi biến đổi dữ liệu (Mapping)
    let owner: InstructorDTO | null = null;
    const collaborators: InstructorDTO[] = [];

    course.course_collaborators?.forEach((collab) => {
      const profile = collab.profile;
      if (!profile) return;

      const tProfile = Array.isArray(profile.teacher_profile)
        ? profile.teacher_profile[0]
        : profile.teacher_profile;

      const instructorObj: InstructorDTO = {
        id: profile.id,
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        bio: tProfile?.bio || null,
        experience_years: tProfile?.experience_years || null,
        certifications: tProfile?.certifications || null,
      };

      if (collab.role === "owner") {
        owner = instructorObj;
      } else {
        collaborators.push(instructorObj);
      }
    });

    if (!owner) {
      owner = {
        id: "default-owner",
        full_name: "Đang cập nhật",
        avatar_url: null,
        bio: null,
        experience_years: null,
        certifications: null,
      };
    }

    let total_topics = 0;
    let total_cards = 0;
    let total_exercises = 0;

    const mappedSyllabus = chaptersData.map((chap) => {
      const sortedTopics = (chap.topics || []).sort((a, b) => a.order_index - b.order_index);

      const mappedTopics = sortedTopics.map((t, index) => {
        total_topics++;
        const cardsCount = t.cards[0]?.count || 0;
        const exercisesCount = t.exercises[0]?.count || 0;

        total_cards += cardsCount;
        total_exercises += exercisesCount;

        const topicType: "video" | "vocabulary" | "exercise" = exercisesCount > 0 ? "exercise" : "vocabulary";
        const isFree = chap.order_index === 1 && index === 0;

        return {
          id: t.id,
          title: t.title,
          slug: t.slug,
          status: t.status,
          order_index: t.order_index,
          topic_type: topicType,
          is_free_preview: isFree,
        };
      });

      return {
        id: chap.id,
        title: chap.title,
        order_index: chap.order_index,
        topics: mappedTopics,
      };
    });

    const rawDataPayload = {
      id: course.id,
      title: course.title,
      slug: course.slug,
      description: course.description,
      thumbnail_url: course.thumbnail_url,
      price: course.price,
      original_price: null,
      badges: ["Mới"],
      is_enrolled,
      stats: {
        total_chapters: chaptersData.length,
        total_topics,
        total_cards,
        total_exercises,
        total_enrollments: totalEnrollmentsCount || 0,
      },
      owner,
      collaborators,
      syllabus: mappedSyllabus,
    };

    // 5. Cổng kiểm duyệt Zod bảo vệ dữ liệu nghiêm ngặt
    const validated = courseDetailSchema.safeParse(rawDataPayload);

    if (!validated.success) {
      console.error("❌ [ZOD VALIDATION CRITICAL ERROR]:", validated.error.issues);
      return { error: `Dữ liệu hệ thống bị sai lệch cấu trúc: ${validated.error.issues[0].message}` };
    }

    return { data: validated.data };

  } catch (err) {
    console.error("❌ [COURSE DETAIL SYSTEM EXCEPTION]:", err);
    return { error: "Hệ thống gặp sự cố trong quá trình đồng bộ chi tiết khóa học." };
  }
}