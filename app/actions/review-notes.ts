"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  createReviewNoteSchema,
  removeReviewNoteSchema,
  topicReviewNoteSchema,
  topicReviewNotesReadInputSchema,
  updateReviewNoteSchema,
  type CreateReviewNoteInput,
  type RemoveReviewNoteInput,
  type TopicReviewNote,
  type TopicReviewNotesReadInput,
  type UpdateReviewNoteInput,
} from "@/lib/schemas/review-notes";

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

type ReviewNoteReadError = {
  error: string;
  reason: "forbidden" | "unavailable" | "error";
};

type ReviewNoteRow = {
  id: string;
  topic_id: string;
  card_id: string | null;
  exercise_id: string | null;
  author_user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  removed_at: string | null;
  removed_by_user_id: string | null;
  author: ProfileRow | null;
  removed_by: ProfileRow | null;
  card: { front_content: Record<string, unknown> | null } | null;
  exercise: { title: string | null } | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

// `revalidatePath` cho chính route file của màn Topic Builder, theo convention
// `getTeacherCourseListRouteFileRevalidationPath` trong `lib/course-authoring/routes`.
const TOPIC_BUILDER_ROUTE_FILE_REVALIDATION_PATH =
  "/(teacher)/teacher/courses/[id]/topics/[topicId]";

const reviewNoteUnavailableMessage =
  "Bài học không còn khả dụng trong cấu trúc hiện tại của khóa học.";

function getErrorText(error?: SupabaseErrorLike | null) {
  return `${error?.code ?? ""} ${error?.message ?? ""}`;
}

function mapReviewNoteError(error?: SupabaseErrorLike | null) {
  const text = getErrorText(error);

  if (text.includes("AUTH_REQUIRED")) return "Vui lòng đăng nhập lại.";
  if (text.includes("REVIEW_NOTE_TARGET_TOPIC_MISMATCH")) {
    return "Ghi chú chỉ được gắn vào flashcard hoặc bài tập của chính bài học này.";
  }
  if (text.includes("REVIEW_NOTE_IDENTITY_IMMUTABLE")) {
    return "Ghi chú không thể đổi đối tượng hoặc tác giả sau khi tạo.";
  }
  if (text.includes("review_notes_single_target_check")) {
    return "Ghi chú chỉ được gắn vào một flashcard hoặc một bài tập.";
  }
  if (text.includes("review_notes_body_not_blank_check")) {
    return "Nội dung ghi chú không được để trống.";
  }
  if (text.includes("review_notes_body_length_check")) {
    return "Ghi chú không được vượt quá 2000 ký tự.";
  }
  if (text.includes("TOPIC_NOT_FOUND")) return reviewNoteUnavailableMessage;
  if (
    error?.code === "42501" ||
    text.includes("row-level security") ||
    text.includes("permission denied")
  ) {
    return "Bạn không có quyền ghi chú cho bài học này.";
  }

  return "Không thể lưu ghi chú. Vui lòng thử lại.";
}

function toAuthorIdentity(
  userId: string | null,
  profile: ProfileRow | null,
) {
  if (!userId) return null;

  return {
    userId,
    fullName: profile?.full_name ?? null,
    email: profile?.email ?? null,
    avatarUrl: profile?.avatar_url ?? null,
  };
}

function toTopicReviewNote(row: ReviewNoteRow): TopicReviewNote | null {
  const cardWord = row.card?.front_content?.word;
  const parsed = topicReviewNoteSchema.safeParse({
    id: row.id,
    topicId: row.topic_id,
    cardId: row.card_id,
    exerciseId: row.exercise_id,
    author: toAuthorIdentity(row.author_user_id, row.author) ?? {
      userId: row.author_user_id,
      fullName: null,
      email: null,
      avatarUrl: null,
    },
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isEdited: new Date(row.updated_at).getTime() > new Date(row.created_at).getTime(),
    removedAt: row.removed_at,
    removedBy: toAuthorIdentity(row.removed_by_user_id, row.removed_by),
    cardTitle: typeof cardWord === "string" ? cardWord : null,
    exerciseTitle: row.exercise?.title ?? null,
  });

  if (!parsed.success) {
    console.error("[REVIEW NOTE SHAPE ERROR]:", parsed.error.issues);
    return null;
  }

  return parsed.data;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, user } : null;
}

/**
 * Đường đọc tách khỏi workflow RPC: ghi chú cần `cards`/`exercises` để render
 * nhãn đích, và không được ghép vào DTO vòng đời topic.
 *
 * Action **không** tự kiểm tra authorization — RLS (`d1_can_read_topic_review_notes`)
 * là nơi ép quyền. Người ngoài khoá học nhận mảng rỗng, không nhận lỗi.
 */
export async function getTopicReviewNotes(
  rawInput: TopicReviewNotesReadInput,
): Promise<
  { data: { notes: TopicReviewNote[]; currentUserId: string } } | ReviewNoteReadError
> {
  const parsed = topicReviewNotesReadInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Đường dẫn bài học không hợp lệ.",
      reason: "unavailable",
    };
  }

  const session = await requireUser();
  if (!session) return { error: "Vui lòng đăng nhập lại.", reason: "forbidden" };

  const { data, error } = await session.supabase
    .from("review_notes")
    .select(
      `
      id,
      topic_id,
      card_id,
      exercise_id,
      author_user_id,
      body,
      created_at,
      updated_at,
      removed_at,
      removed_by_user_id,
      author:profiles!review_notes_author_user_id_fkey ( id, full_name, email, avatar_url ),
      removed_by:profiles!review_notes_removed_by_user_id_fkey ( id, full_name, email, avatar_url ),
      card:cards!review_notes_card_id_fkey ( front_content ),
      exercise:exercises!review_notes_exercise_id_fkey ( title )
    `,
    )
    .eq("topic_id", parsed.data.topicId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    console.error("[REVIEW NOTES READ ERROR]:", error);
    return {
      error: "Không thể tải ghi chú của bài học. Vui lòng thử lại.",
      reason: "error",
    };
  }

  const notes = ((data ?? []) as unknown as ReviewNoteRow[])
    .map(toTopicReviewNote)
    .filter((note): note is TopicReviewNote => note !== null);

  return { data: { notes, currentUserId: session.user.id } };
}

export async function createReviewNote(rawInput: CreateReviewNoteInput) {
  const parsed = createReviewNoteSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ghi chú không hợp lệ." };
  }

  const session = await requireUser();
  if (!session) return { error: "Vui lòng đăng nhập lại." };

  // `author_user_id` do DB điền từ `auth.uid()`; client không bao giờ gửi field này.
  const { error } = await session.supabase.from("review_notes").insert({
    topic_id: parsed.data.topicId,
    card_id: parsed.data.cardId ?? null,
    exercise_id: parsed.data.exerciseId ?? null,
    body: parsed.data.body,
  });

  if (error) {
    console.error("[REVIEW NOTE CREATE ERROR]:", error);
    return { error: mapReviewNoteError(error) };
  }

  revalidatePath(TOPIC_BUILDER_ROUTE_FILE_REVALIDATION_PATH, "page");
  return { success: true, message: "Đã gửi ghi chú." };
}

export async function updateReviewNote(rawInput: UpdateReviewNoteInput) {
  const parsed = updateReviewNoteSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ghi chú không hợp lệ." };
  }

  const session = await requireUser();
  if (!session) return { error: "Vui lòng đăng nhập lại." };

  const { data, error } = await session.supabase
    .from("review_notes")
    .update({ body: parsed.data.body })
    .eq("id", parsed.data.noteId)
    .select("id");

  if (error) {
    console.error("[REVIEW NOTE UPDATE ERROR]:", error);
    return { error: mapReviewNoteError(error) };
  }

  if (!data || data.length === 0) {
    return { error: "Bạn chỉ có thể sửa ghi chú của chính mình." };
  }

  revalidatePath(TOPIC_BUILDER_ROUTE_FILE_REVALIDATION_PATH, "page");
  return { success: true, message: "Đã cập nhật ghi chú." };
}

export async function removeReviewNote(rawInput: RemoveReviewNoteInput) {
  const parsed = removeReviewNoteSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ghi chú không hợp lệ." };
  }

  const session = await requireUser();
  if (!session) return { error: "Vui lòng đăng nhập lại." };

  // Xoá mềm: row vẫn phải tới được người đọc để render tombstone.
  const { data, error } = await session.supabase
    .from("review_notes")
    .update({
      removed_at: new Date().toISOString(),
      removed_by_user_id: session.user.id,
    })
    .eq("id", parsed.data.noteId)
    .is("removed_at", null)
    .select("id");

  if (error) {
    console.error("[REVIEW NOTE REMOVE ERROR]:", error);
    return { error: mapReviewNoteError(error) };
  }

  if (!data || data.length === 0) {
    return { error: "Bạn chỉ có thể xóa ghi chú của chính mình." };
  }

  revalidatePath(TOPIC_BUILDER_ROUTE_FILE_REVALIDATION_PATH, "page");
  return { success: true, message: "Đã xóa ghi chú." };
}
