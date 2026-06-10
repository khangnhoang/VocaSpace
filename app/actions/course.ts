// File: app/actions/course.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

function mapCourseMutationError(code?: string) {
  if (code === "23505") {
    return "Đường dẫn khóa học đã tồn tại. Vui lòng chọn đường dẫn khác.";
  }

  if (code === "42501") {
    return "Bạn không có quyền thực hiện thao tác này.";
  }

  return "Không thể lưu thông tin khóa học. Vui lòng thử lại.";
}

function mapCourseReadError(code?: string) {
  if (code === "42501") {
    return "Bạn không có quyền xem danh sách khóa học này.";
  }

  return "Không thể tải dữ liệu khóa học. Vui lòng thử lại.";
}

type CourseStatus = "draft" | "pending" | "published";
type CourseMemberRole = "previewer" | "editor" | "co_owner" | "owner";

type CourseRecord = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number | null;
  status: CourseStatus | null;
  order_index: number | null;
};

type TeacherCourseRow = {
  role: CourseMemberRole;
  courses: CourseRecord | CourseRecord[];
};

type CourseUpdateData = {
  title: string;
  slug: string;
  description: string;
  price: number;
  thumbnail_url?: string;
};

// ==========================================
// 1. TẠO KHÓA HỌC MỚI
// ==========================================
export async function createCourse(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại!" };

  const title = formData.get("title") as string;
  const slug = formData.get("slug") as string;
  const description = formData.get("description") as string;
  const price = parseFloat(formData.get("price") as string) || 0;
  const file = formData.get("thumbnail_file") as File | null;

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

  // Insert vào bảng courses
  const { data: newCourse, error: courseError } = await supabase
    .from("courses")
    .insert({ title, slug, description, price, thumbnail_url, status: "draft" })
    .select()
    .single();

  if (courseError) {
    console.error("[COURSE CREATE ERROR]:", courseError);
    return { error: mapCourseMutationError(courseError.code) };
  }

  // 5. Bắn dữ liệu vào bảng course_collaborators (Xác nhận quyền Chủ sở hữu)
  const { error: collabError } = await supabase
    .from("course_collaborators")
    .insert({
      course_id: newCourse.id,
      user_id: user.id,
      role: "owner",
      added_by: user.id,
    });

  // NẾU GÁN QUYỀN THẤT BẠI -> TỰ HỦY KHÓA HỌC VỪA TẠO ĐỂ TRÁNH RÁC DATABASE
  if (collabError) {
    await supabase.from("courses").delete().eq("id", newCourse.id);
    console.error("[COURSE COLLABORATOR CREATE ERROR]:", collabError);
    return {
      error: "Không thể phân quyền khóa học. Đã hoàn tác dữ liệu vừa tạo.",
    };
  }

  revalidatePath("/(teacher)/courses");
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
        id, title, slug, description, thumbnail_url, price, status, order_index
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

  // Chuẩn hóa data trả về cho UI
  const formattedCourses = ((data || []) as unknown as TeacherCourseRow[])
    .map((item) => {
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
    .filter((course) => course !== null);

  return { data: formattedCourses };
}

// ==========================================
// 3. XÓA KHÓA HỌC (SOFT DELETE)
// ==========================================
export async function deleteCourse(courseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại!" };

  // Cập nhật cột removed_at thay vì xóa hẳn (Đúng chuẩn Production)
  const { error } = await supabase
    .from("courses")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", courseId);

  if (error) {
    console.error("[COURSE DELETE ERROR]:", error);
    return { error: "Không thể xóa khóa học. Vui lòng thử lại." };
  }

  revalidatePath("/(teacher)/courses");
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại!" };

  // 1. Kiểm tra quyền sở hữu (Chỉ Owner, Co-owner hoặc Editor mới được sửa)
  const { isValid, role } = await verifyCourseAccess(courseId);
  if (!isValid || role === "previewer") {
    return { error: "Bạn không có quyền chỉnh sửa khóa học này!" };
  }

  // 2. Lấy dữ liệu từ Form
  const title = formData.get("title") as string;
  const slug = formData.get("slug") as string;
  const description = formData.get("description") as string;
  const price = parseFloat(formData.get("price") as string) || 0;
  const file = formData.get("thumbnail_file") as File | null;

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
  const { error } = await supabase
    .from("courses")
    .update(updateData)
    .eq("id", courseId);

  if (error) {
    console.error("[COURSE UPDATE ERROR]:", error);
    return { error: mapCourseMutationError(error.code) };
  }

  revalidatePath("/(teacher)/courses");
  return { success: true, message: "Đã cập nhật thông tin khóa học!" };
}

// ==========================================
// 6. THÊM CỘNG TÁC VIÊN (BẢN NHÁP - FAKE TOAST)
// ==========================================

// Tạo nhanh 1 schema để check định dạng email
const collabEmailSchema = z.string().email("Định dạng email không hợp lệ!");

export async function addCollaborator(
  courseId: string,
  email: string,
  role: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại!" };

  // 1. Zod check định dạng email
  const validated = collabEmailSchema.safeParse(email);
  if (!validated.success) return { error: validated.error.issues[0].message };

  // Không cho phép tự thêm chính mình
  if (email === user.email) {
    return { error: "Bạn không thể tự thêm chính mình làm cộng tác viên!" };
  }

  // 2. Tìm User trong bảng profiles dựa vào email
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("email", email)
    .single();

  if (error || !profile) {
    return { error: "Không tìm thấy người dùng với email này trong hệ thống!" };
  }

  // 3. FAKE TOAST: Tạm thời chỉ trả về thành công thay vì Insert thật vào DB
  // (Sau này anh em mình sẽ viết lệnh INSERT vào bảng course_collaborators tại đây)
  return {
    success: true,
    message: `Đã gửi lời mời quyền [${role}] đến ${profile.full_name || email}!`,
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
