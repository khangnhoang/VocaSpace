// File: app/actions/course.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// ==========================================
// 1. TẠO KHÓA HỌC MỚI
// ==========================================
export async function createCourse(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại!" };

  const title = formData.get("title") as string;
  const slug = formData.get("slug") as string;
  const description = formData.get("description") as string;
  const price = parseFloat(formData.get("price") as string) || 0;
  const file = formData.get("thumbnail_file") as File | null;

  let thumbnail_url = null;

  // Xử lý Upload Ảnh bìa
  if (file && file.size > 0) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("course_thumbnails")
      .upload(fileName, file);

    if (uploadError) return { error: "Lỗi upload ảnh: " + uploadError.message };

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

  if (courseError) return { error: courseError.message };

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
    return { error: "Lỗi phân quyền khóa học. Đã hoàn tác dữ liệu! Chi tiết: " + collabError.message };
  }

  revalidatePath("/(teacher)/courses");
  return { success: true, message: "Khởi tạo khóa học thành công!" };
}

// ==========================================
// 2. LẤY DANH SÁCH KHÓA HỌC (CHỈ LẤY CỦA MÌNH)
// ==========================================
export async function getCoursesForTeacher() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Join bảng course_collaborators với courses để lấy đúng khóa học ông này được phép thấy
  // Mệnh đề !inner ép buộc chỉ lấy những khóa chưa bị xóa mềm (removed_at IS NULL)
  const { data, error } = await supabase
    .from("course_collaborators")
    .select(`
      role,
      courses!inner (
        id, title, slug, description, thumbnail_url, price, status, order_index
      )
    `)
    .eq("user_id", user.id)
    .is("courses.removed_at", null)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message };

  // Chuẩn hóa data trả về cho UI
  const formattedCourses = data.map((item: any) => ({
    ...item.courses,
    my_role: item.role,
  }));

  return { data: formattedCourses };
}

// ==========================================
// 3. XÓA KHÓA HỌC (SOFT DELETE)
// ==========================================
export async function deleteCourse(courseId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Cập nhật cột removed_at thay vì xóa hẳn (Đúng chuẩn Production)
  const { error } = await supabase
    .from("courses")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", courseId);

  if (error) return { error: error.message };

  revalidatePath("/(teacher)/courses");
  return { success: true, message: "Đã đưa khóa học vào thùng rác." };
}