"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  chapterCreateSchema,
  chapterDeleteSchema,
  chapterMoveSchema,
  chapterRestoreSchema,
  chapterUpdateSchema,
  type ChapterCreateInput,
  type ChapterDeleteInput,
  type ChapterMoveInput,
  type ChapterRestoreInput,
  type ChapterUpdateInput,
} from "@/lib/schemas/chapter";
import {
  chapterHidePreviewProjectionSchema,
  type ChapterHidePreviewProjection,
} from "@/lib/schemas/course-preview";
import {
  getCourseOverviewPath,
  getCourseStructurePath,
} from "@/lib/course-authoring/routes";

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

type ChapterRpcRow = {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  created_at?: string;
  updated_at?: string;
  removed_at?: string | null;
};

type ChapterAccessRow = {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
  created_by_user_id: string;
};

type CreateChapterRpcResult = {
  status: "created";
  chapter: ChapterRpcRow;
};

type MoveChapterRpcResult = {
  status: "moved" | "noop";
  reason?: "already_first" | "already_last";
  course_id?: string;
  chapter_id?: string;
  neighbor_chapter_id?: string;
  direction?: "up" | "down";
  previous_order_index?: number;
  new_order_index?: number;
  order_index?: number;
};

type ChapterDeleteResult =
  | { error: string; previewProjection?: ChapterHidePreviewProjection; success?: never; message?: never }
  | { success: true; message: string; error?: never; previewProjection?: never };

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

function getRpcErrorText(error?: SupabaseErrorLike | null) {
  return `${error?.code ?? ""} ${error?.message ?? ""}`;
}

function mapChapterOrderingRpcError(error?: SupabaseErrorLike | null) {
  const text = getRpcErrorText(error);

  if (text.includes("AUTH_REQUIRED")) return "Vui lòng đăng nhập lại.";
  if (text.includes("COURSE_EDIT_FORBIDDEN")) {
    return "Bạn không có quyền chỉnh sửa chương của khóa học này.";
  }
  if (text.includes("COURSE_NOT_FOUND")) {
    return "Khóa học không còn khả dụng.";
  }
  if (text.includes("TOPIC_PENDING_FROZEN")) {
    return "Chương có bài học đang chờ duyệt; hãy xử lý quy trình duyệt trước khi thay đổi chương.";
  }
  if (text.includes("CHAPTER_NOT_FOUND") || text.includes("CHAPTER_REMOVED")) {
    return "Chương không còn khả dụng trong cấu trúc khóa học.";
  }
  if (text.includes("CHAPTER_NOT_REMOVED")) {
    return "Chương đang hiển thị trong cấu trúc khóa học.";
  }
  if (text.includes("INVALID_DIRECTION")) {
    return "Hướng di chuyển chương không hợp lệ.";
  }
  if (
    error?.code === "23505" ||
    error?.code === "23514" ||
    text.includes("ORDER_INDEX") ||
    text.includes("unique")
  ) {
    return "Thứ tự chương đang bị xung đột. Vui lòng tải lại trang và thử lại.";
  }

  return mapChapterMutationError(error?.code);
}

function revalidateCourseStructure(courseId: string) {
  revalidatePath(getCourseOverviewPath(courseId));
  revalidatePath(getCourseStructurePath(courseId));
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

  const { data: rpcResult, error } = await supabase.rpc("create_chapter_ordered", {
    p_course_id: input.courseId,
    p_title: input.title,
  });

  if (error) {
    console.error("[CHAPTER CREATE ERROR]:", error);
    return { error: mapChapterOrderingRpcError(error) };
  }

  const result = rpcResult as CreateChapterRpcResult | null;
  if (!result || result.status !== "created" || !result.chapter) {
    console.error("[CHAPTER CREATE RPC SHAPE ERROR]:", rpcResult);
    return { error: "Không thể lưu chương. Vui lòng thử lại." };
  }
  const data = result.chapter;

  revalidateCourseStructure(input.courseId);
  return {
    success: true,
    message: "Đã thêm chương mới thành công.",
    data,
  };
}

export async function moveChapterOrder(rawInput: ChapterMoveInput) {
  const parsed = chapterMoveSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Thông tin di chuyển chương không hợp lệ.",
    };
  }

  const input = parsed.data;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại." };

  const { data, error } = await supabase.rpc("move_chapter_order", {
    p_chapter_id: input.chapterId,
    p_direction: input.direction,
  });

  if (error) {
    console.error("[CHAPTER MOVE ERROR]:", error);
    return { error: mapChapterOrderingRpcError(error) };
  }

  const result = data as MoveChapterRpcResult | null;
  if (!result || (result.status !== "moved" && result.status !== "noop")) {
    console.error("[CHAPTER MOVE RPC SHAPE ERROR]:", data);
    return { error: "Không thể cập nhật thứ tự chương. Vui lòng thử lại." };
  }

  if (result.course_id) revalidateCourseStructure(result.course_id);

  return {
    success: true,
    message:
      result.status === "noop"
        ? "Thứ tự chương không thay đổi."
        : "Đã cập nhật thứ tự chương.",
    data: result,
  };
}

export async function getChaptersByCourseId(courseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại." };

  const { data: membership, error: membershipError } = await supabase
    .from("course_collaborators")
    .select("role")
    .eq("course_id", courseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return { error: mapChapterReadError(membershipError?.code) };
  }

  const { data, error } = await supabase
    .from("chapters")
    .select(
      "id, course_id, title, order_index, created_at, updated_at, removed_at, created_by_user_id",
    )
    .eq("course_id", courseId)
    .is("removed_at", null)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[CHAPTER LIST ERROR]:", error);
    return { error: mapChapterReadError(error.code) };
  }

  const canManageAnyChapter =
    membership.role === "owner" || membership.role === "co_owner";
  return {
    data: (data as ChapterAccessRow[]).map(
      ({ created_by_user_id, ...chapter }) => ({
        ...chapter,
        canManage:
          canManageAnyChapter ||
          (membership.role === "editor" && created_by_user_id === user.id),
      }),
    ),
  };
}

export async function getDeletedChaptersByCourseId(courseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại." };

  const { data: membership, error: membershipError } = await supabase
    .from("course_collaborators")
    .select("role")
    .eq("course_id", courseId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError || !membership) {
    return { error: mapChapterReadError(membershipError?.code) };
  }

  const { data, error } = await supabase
    .from("chapters")
    .select(
      "id, course_id, title, order_index, created_at, updated_at, removed_at, created_by_user_id",
    )
    .eq("course_id", courseId)
    .not("removed_at", "is", null)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[DELETED CHAPTER LIST ERROR]:", error);
    return { error: mapChapterReadError(error.code) };
  }

  const canManageAnyChapter =
    membership.role === "owner" || membership.role === "co_owner";
  return {
    data: (data as ChapterAccessRow[]).map(
      ({ created_by_user_id, ...chapter }) => ({
        ...chapter,
        canManage:
          canManageAnyChapter ||
          (membership.role === "editor" && created_by_user_id === user.id),
      }),
    ),
  };
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

export async function deleteChapter(rawInput: ChapterDeleteInput): Promise<ChapterDeleteResult> {
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

  const { data, error } = await supabase.rpc("hide_chapter", {
    p_chapter_id: input.chapterId,
    p_unmark_topic_ids: input.unmarkTopicIds,
  });

  if (error) {
    console.error("[CHAPTER DELETE ERROR]:", error);
    const rpcText = getRpcErrorText(error);
    if (rpcText.includes("PREVIEW_QUOTA_RESOLUTION_REQUIRED") || rpcText.includes("PREVIEW_SELECTION_STALE")) {
      const fresh = await supabase.rpc("get_chapter_hide_preview_projection", {
        p_chapter_id: input.chapterId,
      });
      const projection = chapterHidePreviewProjectionSchema.safeParse(fresh.data);
      return {
        error: rpcText.includes("PREVIEW_QUOTA_RESOLUTION_REQUIRED")
          ? "Phân bổ bài học xem thử đã thay đổi. Hãy tải lại và chọn đủ bài học cần bỏ xem thử."
          : "Một số bài học đã thay đổi. Hãy kiểm tra danh sách mới trước khi xác nhận.",
        ...(fresh.error || !projection.success ? {} : { previewProjection: projection.data }),
      };
    }
    return { error: mapChapterOrderingRpcError(error) };
  }

  const result = data as { status?: string; course_id?: string } | null;
  if (result?.status !== "hidden" || !result.course_id) {
    console.error("[CHAPTER HIDE RPC SHAPE ERROR]:", data);
    return { error: "Không thể ẩn chương. Vui lòng thử lại." };
  }

  revalidateCourseStructure(result.course_id);
  return { success: true, message: "Đã ẩn chương khỏi khóa học." };
}

export async function restoreChapter(rawInput: ChapterRestoreInput) {
  const parsed = chapterRestoreSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Thông tin khôi phục chương không hợp lệ.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập lại." };

  const { data, error } = await supabase.rpc("restore_chapter_ordered", {
    p_chapter_id: parsed.data.chapterId,
  });

  if (error) {
    console.error("[CHAPTER RESTORE ERROR]:", error);
    return { error: mapChapterOrderingRpcError(error) };
  }

  const result = data as {
    status?: string;
    course_id?: string;
    chapter?: ChapterRpcRow;
  } | null;
  if (result?.status !== "restored" || !result.course_id || !result.chapter) {
    console.error("[CHAPTER RESTORE RPC SHAPE ERROR]:", data);
    return { error: "Không thể khôi phục chương. Vui lòng thử lại." };
  }

  revalidateCourseStructure(result.course_id);
  return {
    success: true,
    message: "Đã khôi phục chương vào cuối cấu trúc khóa học.",
    data: result.chapter,
  };
}
