"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  chapterCreateSchema,
  chapterDeleteSchema,
  chapterUpdateSchema,
  type ChapterCreateInput,
  type ChapterDeleteInput,
  type ChapterUpdateInput,
} from "@/lib/schemas/chapter";

function mapChapterReadError(code?: string) {
  if (code === "42501") {
    return "Bạn không có quyền xem dữ liệu chương của khóa học này.";
  }

  return "Không thể tải dữ liệu chương. Vui lòng thử lại.";
}

function mapChapterMutationError(code?: string) {
  if (code === "42501") {
    return "Bạn không có quyền chỉnh sửa chương của khóa học này.";
  }

  return "Không thể lưu chương. Vui lòng thử lại.";
}

function revalidateCourseStructure(courseId: string) {
  revalidatePath(`/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}/structure`);
}

export async function createChapter(rawInput: ChapterCreateInput) {
  const parsed = chapterCreateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Thông tin chương không hợp lệ.",
    };
  }

  const input = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại." };

  const { data: maxChapter, error: maxError } = await supabase
    .from("chapters")
    .select("order_index")
    .eq("course_id", input.courseId)
    .order("order_index", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxError) {
    console.error("[CHAPTER ORDER ERROR]:", maxError);
    return { error: mapChapterMutationError(maxError.code) };
  }

  const nextOrderIndex = (maxChapter?.order_index ?? 0) + 1;
  const { data, error } = await supabase
    .from("chapters")
    .insert({
      course_id: input.courseId,
      title: input.title,
      order_index: nextOrderIndex,
    })
    .select()
    .single();

  if (error) {
    console.error("[CHAPTER CREATE ERROR]:", error);
    return { error: mapChapterMutationError(error.code) };
  }

  revalidateCourseStructure(input.courseId);
  return {
    success: true,
    message: "Đã thêm chương mới thành công.",
    data,
  };
}

export async function getChaptersByCourseId(courseId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("chapters")
    .select("*")
    .eq("course_id", courseId)
    .is("removed_at", null)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[CHAPTER LIST ERROR]:", error);
    return { error: mapChapterReadError(error.code) };
  }

  return { data };
}

export async function updateChapter(rawInput: ChapterUpdateInput) {
  const parsed = chapterUpdateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Thông tin chương không hợp lệ.",
    };
  }

  const input = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại." };

  const { data, error } = await supabase
    .from("chapters")
    .update({ title: input.title })
    .eq("id", input.chapterId)
    .is("removed_at", null)
    .select("id, course_id, title, order_index, created_at, updated_at, removed_at")
    .single();

  if (error) {
    console.error("[CHAPTER UPDATE ERROR]:", error);
    return { error: mapChapterMutationError(error.code) };
  }

  revalidateCourseStructure(data.course_id);
  return {
    success: true,
    message: "Đã cập nhật chương.",
    data,
  };
}

export async function deleteChapter(rawInput: ChapterDeleteInput) {
  const parsed = chapterDeleteSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Thông tin chương không hợp lệ.",
    };
  }

  const input = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại." };

  const { data, error } = await supabase
    .from("chapters")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", input.chapterId)
    .is("removed_at", null)
    .select("id, course_id")
    .single();

  if (error) {
    console.error("[CHAPTER DELETE ERROR]:", error);
    return { error: mapChapterMutationError(error.code) };
  }

  revalidateCourseStructure(data.course_id);
  return { success: true, message: "Đã ẩn chương khỏi khóa học." };
}
