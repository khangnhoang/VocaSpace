// File: app/actions/course.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import {
  courseCollaboratorInviteSchema,
  courseIdSchema,
  courseSchema,
  teacherCourseRowsSchema,
  type TeacherCourse,
} from "@/lib/schemas/course";
import { revalidatePath } from "next/cache";
import { getTeacherCourseListRouteFileRevalidationPath } from "@/lib/course-authoring/routes";

function mapCourseMutationError(code?: string, message?: string) {
  if (message?.includes("AUTH_REQUIRED")) {
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  }

  if (message?.includes("COURSE_CREATE_FORBIDDEN")) {
    return "Bạn không có quyền tạo khóa học.";
  }

  if (code === "23505") {
    return "Đường dẫn khóa học đã tồn tại. Vui lòng chọn đường dẫn khác.";
  }

  if (code === "42501") {
    return "Bạn không có quyền thực hiện thao tác này.";
  }

  if (code === "PGRST116") {
    return "Khóa học không còn khả dụng hoặc bạn không có quyền chỉnh sửa.";
  }

  return "Không thể lưu thông tin khóa học. Vui lòng thử lại.";
}

function mapCourseReadError(code?: string) {
  if (code === "42501") {
    return "Bạn không có quyền xem danh sách khóa học này.";
  }

  return "Không thể tải dữ liệu khóa học. Vui lòng thử lại.";
}

type CourseUpdateData = {
  title: string;
  slug: string;
  description: string;
  price: number;
  thumbnail_url?: string;
};

function revalidateTeacherCourseListRouteFile() {
  revalidatePath(getTeacherCourseListRouteFileRevalidationPath());
}

// ==========================================
// 1. TẠO KHÓA HỌC MỚI
// ==========================================
// Nhận FormData từ form giáo viên, validate dữ liệu đầu vào rồi gọi RPC để tạo course và owner trong một giao dịch.
export async function createCourse(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại!" };

  const validated = courseSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    price: formData.get("price") ?? "",
    thumbnail_file: formData.get("thumbnail_file"),
  });

  if (!validated.success) {
    return {
      error: validated.error.issues[0]?.message ?? "Thông tin khóa học không hợp lệ.",
    };
  }

  const {
    title,
    slug,
    description,
    price: rawPrice,
    thumbnail_file: file,
  } = validated.data;
  const price = parseFloat(rawPrice || "0") || 0;

  let thumbnail_url = null;

  // Xử lý Upload Ảnh bìa
  if (file && file.size > 0) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("course_thumbnails")
      .upload(fileName, file);

    if (uploadError) {
      console.error("[COURSE THUMBNAIL UPLOAD ERROR]:", uploadError);
      return { error: "Không thể tải ảnh khóa học lên. Vui lòng thử lại." };
    }

    const { data: publicUrlData } = supabase.storage
      .from("course_thumbnails")
      .getPublicUrl(fileName);

    thumbnail_url = publicUrlData.publicUrl;
  }

  // RPC bảo đảm course draft và owner collaborator được tạo cùng lúc hoặc rollback cùng lúc.
  const { data: courseId, error: courseError } = await supabase.rpc(
    "create_course_with_owner",
    {
      p_title: title,
      p_slug: slug,
      p_description: description,
      p_price: price,
      p_thumbnail_url: thumbnail_url,
    },
  );

  if (courseError || !courseId) {
    console.error("[COURSE CREATE ERROR]:", courseError);
    return {
      error: mapCourseMutationError(courseError?.code, courseError?.message),
    };
  }

  revalidateTeacherCourseListRouteFile();
  return { success: true, message: "Khởi tạo khóa học thành công!" };
}

// ==========================================
// 2. LẤY DANH SÁCH KHÓA HỌC (CHỈ LẤY CỦA MÌNH)
// ==========================================
export async function getCoursesForTeacher() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại!" };

  // Join bảng course_collaborators với courses để lấy đúng khóa học ông này được phép thấy
  // Mệnh đề !inner ép buộc chỉ lấy những khóa chưa bị xóa mềm (removed_at IS NULL)
  const { data, error } = await supabase
    .from("course_collaborators")
    .select(
      `
      role,
      courses!inner (
        id, title, slug, description, thumbnail_url, price, status, order_index, reject_message, reviewed_at
      )
    `,
    )
    .eq("user_id", user.id)
    .is("courses.removed_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[COURSE LIST ERROR]:", error);
    return { error: mapCourseReadError(error.code) };
  }

  const parsedRows = teacherCourseRowsSchema.safeParse(data || []);
  if (!parsedRows.success) {
    console.error("[COURSE LIST SHAPE ERROR]:", parsedRows.error.issues);
    return {
      error: "Cấu trúc dữ liệu khóa học không hợp lệ. Vui lòng thử lại.",
    };
  }

  // Chuẩn hóa data trả về cho UI sau khi schema đã kiểm tra shape từ Supabase.
  const formattedCourses = parsedRows.data
    .map((item): TeacherCourse | null => {
      const course = Array.isArray(item.courses)
        ? item.courses[0]
        : item.courses;

      if (!course) return null;

      return {
        ...course,
        price: course.price ?? 0,
        status: course.status ?? "draft",
        order_index: course.order_index ?? 0,
        my_role: item.role,
      };
    })
    .filter((course): course is TeacherCourse => course !== null);

  return { data: formattedCourses };
}

// ==========================================
// 3. XÓA KHÓA HỌC (SOFT DELETE)
// ==========================================
export async function deleteCourse(courseId: string) {
  const parsedCourseId = courseIdSchema.safeParse(courseId);
  if (!parsedCourseId.success) {
    return {
      error:
        parsedCourseId.error.issues[0]?.message ??
        "ID khóa học không hợp lệ.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại!" };

  // Cập nhật cột removed_at thay vì xóa hẳn (Đúng chuẩn Production)
  const { data, error } = await supabase
    .from("courses")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", parsedCourseId.data)
    .is("removed_at", null)
    .select("id");

  if (error) {
    console.error("[COURSE DELETE ERROR]:", error);
    return { error: "Không thể đưa khóa học vào thùng rác. Vui lòng thử lại." };
  }

  if (!data || data.length !== 1) {
    return {
      error:
        "Không thể đưa khóa học vào thùng rác. Khóa học có thể đã bị ẩn hoặc bạn không có quyền chỉnh sửa.",
    };
  }

  revalidateTeacherCourseListRouteFile();
  return { success: true, message: "Đã đưa khóa học vào thùng rác." };
}

// ==========================================
// 4. KIỂM TRA QUYỀN TRUY CẬP KHÓA HỌC
// ==========================================
export async function verifyCourseAccess(courseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { isValid: false, error: "Vui lòng đăng nhập lại!" };

  // Kiểm tra khóa học có tồn tại, chưa bị xóa và user có quyền không
  const { data, error } = await supabase
    .from("course_collaborators")
    .select(
      `
      role,
      courses!inner ( id, removed_at )
    `,
    )
    .eq("course_id", courseId)
    .eq("user_id", user.id)
    .is("courses.removed_at", null) // Chốt chặn: Không lấy khóa học đã xóa
    .single();

  if (error || !data) {
    return {
      isValid: false,
      error: "Khóa học không tồn tại hoặc bạn không có quyền truy cập!",
    };
  }

  return { isValid: true, role: data.role };
}

// ==========================================
// 5. CẬP NHẬT THÔNG TIN CƠ BẢN KHÓA HỌC
// ==========================================
export async function updateCourse(courseId: string, formData: FormData) {
  const parsedCourseId = courseIdSchema.safeParse(courseId);
  if (!parsedCourseId.success) {
    return {
      error:
        parsedCourseId.error.issues[0]?.message ??
        "ID khóa học không hợp lệ.",
    };
  }

  const validated = courseSchema.safeParse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    price: formData.get("price") ?? "",
    thumbnail_file: formData.get("thumbnail_file"),
  });

  if (!validated.success) {
    return {
      error:
        validated.error.issues[0]?.message ??
        "Thông tin khóa học không hợp lệ.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại!" };

  // 1. Kiểm tra quyền sở hữu (Chỉ Owner, Co-owner hoặc Editor mới được sửa)
  const { isValid, role } = await verifyCourseAccess(parsedCourseId.data);
  if (!isValid || role === "previewer") {
    return { error: "Bạn không có quyền chỉnh sửa khóa học này!" };
  }

  const {
    title,
    slug,
    description,
    price: rawPrice,
    thumbnail_file: file,
  } = validated.data;
  const price = parseFloat(rawPrice || "0") || 0;

  // Khởi tạo object chứa dữ liệu cần cập nhật
  const updateData: CourseUpdateData = {
    title,
    slug,
    description,
    price,
  };

  // 3. Xử lý Ảnh bìa (Chỉ upload nếu có file mới được gửi lên)
  if (file && file.size > 0) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("course_thumbnails")
      .upload(fileName, file);

    if (uploadError) {
      console.error("[COURSE THUMBNAIL UPLOAD ERROR]:", uploadError);
      return { error: "Không thể tải ảnh khóa học lên. Vui lòng thử lại." };
    }

    const { data: publicUrlData } = supabase.storage
      .from("course_thumbnails")
      .getPublicUrl(fileName);

    // Bổ sung URL mới vào object cập nhật
    updateData.thumbnail_url = publicUrlData.publicUrl;
  }

  // 4. Thực thi Update vào Database
  const { data, error } = await supabase
    .from("courses")
    .update(updateData)
    .eq("id", parsedCourseId.data)
    .is("removed_at", null)
    .select("id")
    .single();

  if (error || !data) {
    console.error("[COURSE UPDATE ERROR]:", error);
    return { error: mapCourseMutationError(error?.code, error?.message) };
  }

  revalidateTeacherCourseListRouteFile();
  return { success: true, message: "Đã cập nhật thông tin khóa học!" };
}

// ==========================================
// 6. THÊM CỘNG TÁC VIÊN (CHƯA HỖ TRỢ PERSISTENCE)
// ==========================================

// Nhận yêu cầu mời collaborator từ UI, validate trust boundary rồi fail loud vì hệ thống chưa có persistence/RLS cho lời mời.
export async function addCollaborator(
  courseId: string,
  email: string,
  role: string,
) {
  const validated = courseCollaboratorInviteSchema.safeParse({
    courseId,
    email,
    role,
  });

  if (!validated.success) {
    return {
      error:
        validated.error.issues[0]?.message ??
        "Thông tin cộng tác viên không hợp lệ.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại!" };

  const input = validated.data;

  // Không cho phép tự thêm chính mình
  if (input.email === user.email?.toLowerCase()) {
    return { error: "Bạn không thể tự thêm chính mình làm cộng tác viên!" };
  }

  return {
    error:
      "Tính năng cộng tác viên chưa được hỗ trợ. Chưa có lời mời hoặc quyền truy cập nào được tạo.",
  };
}

// ==========================================
// 7. LẤY DANH SÁCH KHÓA HỌC CHO TRANG CHỦ (PUBLIC)
// ==========================================
export async function getPublishedCourses() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("courses")
    .select("id, title, slug, thumbnail_url, price")
    .eq("status", "published") // Chỉ lấy khóa học đã xuất bản
    .is("removed_at", null) // Không lấy khóa học đã xóa
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Lỗi khi fetch public courses:", error);
    return []; // Trả về mảng rỗng nếu lỗi để UI không bị sập
  }

  return data;
}
