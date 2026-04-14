// File: app/actions/chapter.ts
"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// ==========================================
// 1. TẠO CHƯƠNG MỚI (CREATE)
// ==========================================
export async function createChapter(courseId: string, title: string, orderIndex: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Kiểm tra xem user này có quyền với course này không (RLS đã lo, nhưng check thêm cho chắc)
  const { data: collab } = await supabase
    .from("course_collaborators")
    .select("role")
    .eq("course_id", courseId)
    .eq("user_id", user.id)
    .single();

  // Cho phép admin, hoặc những người có role trong khóa học (trừ previewer)
  // Lưu ý: Nếu user là admin, đoạn check collab có thể null, cần bypass nếu là admin.
  // Ở đây tui để Supabase RLS dưới DB tự lo việc block, mình cứ bắn lệnh Insert.

  const { data, error } = await supabase
    .from("chapters")
    .insert({
      course_id: courseId,
      title: title,
      order_index: orderIndex,
    })
    .select()
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/(teacher)/courses/[id]`, 'page');
  return { success: true, message: "Đã thêm chương mới thành công!", data };
}

// ==========================================
// 2. LẤY DANH SÁCH CHƯƠNG CỦA 1 KHÓA HỌC (READ)
// ==========================================
export async function getChaptersByCourseId(courseId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("chapters")
    .select("*")
    .eq("course_id", courseId)
    .is("removed_at", null) // Chỉ lấy những chương chưa bị xóa mềm
    .order("order_index", { ascending: true }) // Sắp xếp theo thứ tự
    .order("created_at", { ascending: true }); // Nếu trùng order thì xếp theo ngày tạo

  if (error) return { error: error.message };
  return { data };
}

// ==========================================
// 3. XÓA CHƯƠNG (SOFT DELETE)
// ==========================================
export async function deleteChapter(chapterId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // Xóa mềm: Cập nhật removed_at
  const { error } = await supabase
    .from("chapters")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", chapterId);

  if (error) return { error: error.message };

  revalidatePath(`/(teacher)/courses/[id]`, 'page');
  return { success: true, message: "Đã xóa chương thành công!" };
}