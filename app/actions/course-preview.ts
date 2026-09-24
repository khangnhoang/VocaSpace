"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  chapterHidePreviewProjectionSchema,
  coursePreviewAllocationSchema,
  coursePreviewMarkerMutationSchema,
  topicDeletePreviewProjectionSchema,
  type CoursePreviewAllocation,
  type CoursePreviewMarkerMutationInput,
} from "@/lib/schemas/course-preview";
import { getCourseOverviewPath, getCourseStructurePath } from "@/lib/course-authoring/routes";
import { createClient } from "@/utils/supabase/server";

type RpcError = { code?: string; message?: string; details?: string; hint?: string };
type PreviewMutationActionResult =
  | { error: string; allocation?: CoursePreviewAllocation; success?: never }
  | { success: true; allocation: CoursePreviewAllocation; error?: never };

function rpcErrorText(error: RpcError | null | undefined) {
  return [error?.code, error?.message, error?.details].filter(Boolean).join(" ");
}

function mapPreviewRpcError(error: RpcError | null | undefined) {
  const text = rpcErrorText(error);
  if (text.includes("AUTH_REQUIRED")) return "Vui lòng đăng nhập lại.";
  if (text.includes("COURSE_PREVIEW_FORBIDDEN") || text.includes("COURSE_EDIT_FORBIDDEN")) {
    return "Bạn không có quyền quản lý bài học xem thử trong khóa học này.";
  }
  if (text.includes("TOPIC_PENDING_FROZEN")) {
    return "Chương có bài học đang chờ duyệt; hãy xử lý quy trình duyệt trước khi ẩn chương.";
  }
  if (text.includes("PREVIEW_QUOTA_RESOLUTION_REQUIRED")) {
    return "Phân bổ bài học xem thử đã thay đổi. Hãy tải lại số liệu và chọn lại bài học cần bỏ xem thử.";
  }
  if (text.includes("PREVIEW_SELECTION_STALE")) {
    return "Một số bài học đã thay đổi. Hãy kiểm tra danh sách mới trước khi xác nhận.";
  }
  if (text.includes("PREVIEW_SELECTION_INVALID")) {
    return "Danh sách bài học cần bỏ xem thử không hợp lệ.";
  }
  if (text.includes("COURSE_PREVIEW_MARKER_MANAGEMENT_REQUIRED")) {
    return "Cần chủ khóa học, đồng chủ khóa học hoặc biên tập viên để bỏ các nhãn xem thử khác.";
  }
  if (text.includes("CHAPTER_NOT_FOUND") || text.includes("TOPIC_NOT_FOUND")) {
    return "Nội dung không còn khả dụng.";
  }
  if (text.includes("COURSE_NOT_FOUND")) return "Khóa học không còn khả dụng.";
  return "Không thể cập nhật bài học xem thử. Vui lòng thử lại.";
}

async function getAuthorizedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function getCoursePreviewAllocation(courseId: string) {
  const parsedCourseId = z.uuid().safeParse(courseId);
  if (!parsedCourseId.success) return { error: "ID khóa học không hợp lệ." };
  const { supabase, user } = await getAuthorizedUser();
  if (!user) return { error: "Vui lòng đăng nhập lại." };

  const { data, error } = await supabase.rpc("get_course_preview_allocation", {
    p_course_id: parsedCourseId.data,
  });
  if (error) {
    console.error("[COURSE PREVIEW ALLOCATION ERROR]:", error);
    return { error: mapPreviewRpcError(error) };
  }
  const allocation = coursePreviewAllocationSchema.safeParse(data);
  if (!allocation.success) {
    console.error("[COURSE PREVIEW ALLOCATION SHAPE ERROR]:", allocation.error.issues);
    return { error: "Không thể tải phân bổ bài học xem thử. Vui lòng thử lại." };
  }
  return { data: allocation.data };
}

export async function setCourseTopicPreviewMarkers(
  rawInput: CoursePreviewMarkerMutationInput,
): Promise<PreviewMutationActionResult> {
  const parsed = coursePreviewMarkerMutationSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Thông tin bài học xem thử không hợp lệ." };
  }
  const { supabase, user } = await getAuthorizedUser();
  if (!user) return { error: "Vui lòng đăng nhập lại." };

  const { data, error } = await supabase.rpc("set_course_topic_preview_markers", {
    p_course_id: parsed.data.courseId,
    p_mark_topic_ids: parsed.data.markTopicIds,
    p_unmark_topic_ids: parsed.data.unmarkTopicIds,
  });
  if (error) {
    console.error("[COURSE PREVIEW MARKER MUTATION ERROR]:", error);
    const message = mapPreviewRpcError(error);
    const text = rpcErrorText(error);
    if (text.includes("PREVIEW_QUOTA_RESOLUTION_REQUIRED") || text.includes("PREVIEW_SELECTION_STALE")) {
      const fresh = await supabase.rpc("get_course_preview_allocation", {
        p_course_id: parsed.data.courseId,
      });
      const allocation = coursePreviewAllocationSchema.safeParse(fresh.data);
      return {
        error: message,
        ...(fresh.error || !allocation.success ? {} : { allocation: allocation.data }),
      };
    }
    return { error: message };
  }

  const allocation = coursePreviewAllocationSchema.safeParse(data);
  if (!allocation.success) {
    console.error("[COURSE PREVIEW MARKER RPC SHAPE ERROR]:", allocation.error.issues);
    return { error: "Không thể xác nhận phân bổ bài học xem thử. Vui lòng tải lại." };
  }
  revalidatePath(getCourseOverviewPath(parsed.data.courseId));
  revalidatePath(getCourseStructurePath(parsed.data.courseId));
  return { success: true as const, allocation: allocation.data };
}

export async function getChapterHidePreviewProjection(chapterId: string) {
  const parsedId = z.uuid().safeParse(chapterId);
  if (!parsedId.success) return { error: "ID chương không hợp lệ." };
  const { supabase, user } = await getAuthorizedUser();
  if (!user) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("get_chapter_hide_preview_projection", {
    p_chapter_id: parsedId.data,
  });
  if (error) {
    console.error("[CHAPTER HIDE PREVIEW PROJECTION ERROR]:", error);
    return { error: mapPreviewRpcError(error) };
  }
  const projection = chapterHidePreviewProjectionSchema.safeParse(data);
  if (!projection.success) {
    console.error("[CHAPTER HIDE PREVIEW PROJECTION SHAPE ERROR]:", projection.error.issues);
    return { error: "Không thể tải số liệu xem thử của chương. Vui lòng thử lại." };
  }
  return { data: projection.data };
}

export async function getTopicDeletePreviewProjection(topicId: string) {
  const parsedId = z.uuid().safeParse(topicId);
  if (!parsedId.success) return { error: "ID bài học không hợp lệ." };
  const { supabase, user } = await getAuthorizedUser();
  if (!user) return { error: "Vui lòng đăng nhập lại." };
  const { data, error } = await supabase.rpc("get_topic_delete_preview_projection", {
    p_topic_id: parsedId.data,
  });
  if (error) {
    console.error("[TOPIC DELETE PREVIEW PROJECTION ERROR]:", error);
    return { error: mapPreviewRpcError(error) };
  }
  const projection = topicDeletePreviewProjectionSchema.safeParse(data);
  if (!projection.success) {
    console.error("[TOPIC DELETE PREVIEW PROJECTION SHAPE ERROR]:", projection.error.issues);
    return { error: "Không thể tải số liệu xem thử của bài học. Vui lòng thử lại." };
  }
  return { data: projection.data };
}
