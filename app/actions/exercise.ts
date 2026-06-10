"use server";

import { createClient } from "@/utils/supabase/server";
import {
  exerciseSchema,
  type ExerciseFormValues,
  type FullExercise as IFullExercise,
} from "@/lib/schemas/exercise";
import { SupabaseClient } from "@supabase/supabase-js";

export type {
  FullExercise,
  FullExerciseGroup,
  FullExerciseQuestion,
  FullExerciseOption,
} from "@/lib/schemas/exercise";

type OptionInput = {
  id?: string;
  content: string;
  is_correct: boolean;
};

type RawOption = {
  id?: string;
  content?: string;
  is_correct?: boolean;
  label?: string | null;
  order_index?: number | null;
  removed_at?: string | null;
};

type RawQuestion = {
  id?: string;
  group_id?: string | null;
  content?: string;
  explanation?: string | null;
  order_index?: number | null;
  removed_at?: string | null;
  options?: RawOption[];
};

type RawGroup = {
  id?: string;
  passage_text?: string | null;
  audio_url?: string | null;
  image_url?: string | null;
  order_index?: number | null;
  removed_at?: string | null;
  questions?: RawQuestion[];
};

type RawExercise = {
  id: string;
  title: string;
  part_type: string;
  order_index: number;
  questions?: RawQuestion[];
  groups?: RawGroup[];
};

function sortOptions(options: RawOption[] = []) {
  return options
    .filter((option) => option.removed_at == null)
    .sort(
      (a, b) =>
        (a.order_index ?? Number.MAX_SAFE_INTEGER) -
          (b.order_index ?? Number.MAX_SAFE_INTEGER) ||
        (a.label || "").localeCompare(b.label || "") ||
        (a.id || "").localeCompare(b.id || ""),
    );
}

function sortQuestions(questions: RawQuestion[] = []) {
  return questions
    .filter((question) => question.removed_at == null)
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map((question) => ({
      ...question,
      options: sortOptions(question.options || []),
    }));
}

function normalizeQuestion(question: RawQuestion) {
  return {
    ...question,
    content: question.content?.trim() || "",
    explanation: question.explanation?.trim() || undefined,
    options: (question.options || [])
      .map((option) => ({
        id: option.id,
        content: option.content?.trim() || "",
        is_correct: !!option.is_correct,
      }))
      .filter((option: OptionInput) => option.content !== ""),
  };
}

function normalizeExercisePayload(rawData: ExerciseFormValues): ExerciseFormValues {
  const groups = (rawData.groups || [])
    .map((group) => ({
      passage_text: group.passage_text?.trim() || undefined,
      audio_url: group.audio_url?.trim() || undefined,
      image_url: group.image_url?.trim() || undefined,
      questions: (group.questions || [])
        .map(normalizeQuestion)
        .filter((question) => question.content !== ""),
    }))
    .filter((group) => group.questions.length > 0);

  const questions = (rawData.questions || [])
    .map(normalizeQuestion)
    .filter((question) => question.content !== "");

  return {
    title: rawData.title?.trim() || "",
    part_type: rawData.part_type,
    groups,
    questions,
  };
}

function mapCreateExerciseRpcError(message: string) {
  const errorMap: Record<string, string> = {
    AUTH_REQUIRED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    TOPIC_NOT_FOUND: "Không tìm thấy bài học tương ứng trong hệ thống.",
    TOPIC_REMOVED: "Không thể thêm bài tập vào một chủ đề đã bị xóa!",
    COURSE_EDIT_FORBIDDEN:
      "Từ chối truy cập. Bạn không có quyền hạn chỉnh sửa khóa học này.",
    EXERCISE_TITLE_REQUIRED: "Tên bài tập không được để trống.",
    EXERCISE_TITLE_TOO_SHORT: "Tên bài tập phải dài hơn 3 ký tự.",
    EXERCISE_PART_TYPE_REQUIRED: "Vui lòng chọn loại bài tập.",
    GROUP_REQUIRES_QUESTION:
      "Mỗi nhóm câu hỏi phải có ít nhất 1 câu hỏi hợp lệ.",
    QUESTION_CONTENT_REQUIRED: "Nội dung câu hỏi không được để trống.",
    QUESTION_REQUIRES_TWO_OPTIONS:
      "Mỗi câu hỏi phải có ít nhất 2 đáp án hợp lệ.",
    QUESTION_REQUIRES_CORRECT_OPTION:
      "Mỗi câu hỏi phải có ít nhất 1 đáp án đúng hợp lệ.",
    EXERCISE_REQUIRES_QUESTION:
      "Bài tập phải có ít nhất 1 câu hỏi hợp lệ.",
  };

  return errorMap[message] || message;
}

function mapQuestionSyncRpcError(message: string) {
  const errorMap: Record<string, string> = {
    AUTH_REQUIRED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    QUESTION_NOT_FOUND: "Không tìm thấy câu hỏi tương ứng.",
    QUESTION_EDIT_FORBIDDEN: "Bạn không có quyền chỉnh sửa câu hỏi này.",
    QUESTION_CONTENT_REQUIRED: "Nội dung câu hỏi không được để trống!",
    QUESTION_REQUIRES_TWO_OPTIONS:
      "Câu hỏi phải có ít nhất 2 đáp án hợp lệ.",
    QUESTION_REQUIRES_CORRECT_OPTION:
      "Câu hỏi phải có ít nhất 1 đáp án đúng hợp lệ.",
    OPTION_DUPLICATE: "Danh sách đáp án có dữ liệu trùng lặp.",
    OPTION_NOT_FOUND: "Không tìm thấy đáp án tương ứng để cập nhật.",
  };

  return errorMap[message] || message;
}

function mapDeleteExerciseRpcError(message: string) {
  const errorMap: Record<string, string> = {
    AUTH_REQUIRED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
    EXERCISE_NOT_FOUND: "Không tìm thấy bài tập tương ứng.",
    EXERCISE_ALREADY_REMOVED: "Bài tập này đã được xóa trước đó.",
    COURSE_EDIT_FORBIDDEN:
      "Bạn không có quyền chỉnh sửa nội dung khóa học này.",
  };

  return (
    errorMap[message] ||
    "Không thể xóa bài tập. Vui lòng tải lại trang và thử lại."
  );
}
export async function getExercisesByTopicId(
  topicId: string,
): Promise<{ data?: IFullExercise[]; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("exercises")
    .select(
      `
      id, title, part_type, order_index, removed_at,
      questions (
        id, group_id, content, explanation, order_index, removed_at,
        options:question_options ( id, content, is_correct, label, order_index, removed_at )
      ),
      groups:question_groups (
        id, passage_text, audio_url, image_url, order_index, removed_at,
        questions (
          id, content, explanation, order_index, removed_at,
          options:question_options ( id, content, is_correct, label, order_index, removed_at )
        )
      )
    `,
    )
    .eq("topic_id", topicId)
    .is("removed_at", null)
    .order("order_index", { ascending: true });

  if (error) return { error: error.message };

  const formattedData = (data as RawExercise[] | null)?.map((exercise) => ({
    ...exercise,
    questions: sortQuestions(
      exercise.questions?.filter(
        (question) =>
          question.group_id === null && question.removed_at == null,
      ) || [],
    ),
    groups:
      exercise.groups
        ?.filter((group) => group.removed_at == null)
        ?.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((group) => ({
          ...group,
          questions: sortQuestions(group.questions || []),
        })) || [],
  })) as IFullExercise[];

  return { data: formattedData };
}

export async function createExercise(
  topicId: string,
  rawData: ExerciseFormValues,
) {
  const supabase = await createClient();

  try {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };
    }

    const normalizedPayload = normalizeExercisePayload(rawData);
    const validated = exerciseSchema.safeParse(normalizedPayload);

    if (!validated.success) {
      return {
        error: `Cấu trúc dữ liệu lỗi: ${validated.error.issues[0].message}`,
      };
    }

    const { error: rpcError } = await supabase.rpc(
      "create_exercise_with_content",
      {
        p_topic_id: topicId,
        p_payload: validated.data,
      },
    );

    if (rpcError) {
      throw new Error(mapCreateExerciseRpcError(rpcError.message));
    }

    return {
      success: true,
      message: "Đã tạo bài tập kèm câu hỏi thành công!",
    };
  } catch (err) {
    console.error("[EXERCISE INSERT EXCEPTION]:", err);
    return {
      error: (err as Error).message || "Lỗi hệ thống khi lưu bài tập.",
    };
  }
}

export async function deleteExercise(exerciseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Vui lòng đăng nhập!" };

  try {
    const { error } = await supabase.rpc("soft_delete_exercise_cascade", {
      p_exercise_id: exerciseId,
    });

    if (error) {
      // The RPC is the permission boundary; raw DB/RLS details stay in server logs.
      console.error("[DELETE EXERCISE RPC ERROR]:", error);
      return { error: mapDeleteExerciseRpcError(error.message) };
    }

    return { success: true, message: "Đã xóa bài tập thành công!" };
  } catch (err) {
    console.error("[DELETE EXERCISE EXCEPTION]:", err);
    return {
      error: "Không thể xóa bài tập. Vui lòng tải lại trang và thử lại.",
    };
  }
}

export async function updateExerciseBasic(
  exerciseId: string,
  title: string,
  part_type: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Vui lòng đăng nhập!" };

  const hasAccess = await checkInstructorAccess(supabase, user.id, exerciseId);
  if (!hasAccess) {
    return { error: "Bạn không có quyền chỉnh sửa nội dung khóa học này." };
  }

  if (title.length < 4) return { error: "Tên bài tập quá ngắn!" };

  try {
    const { error } = await supabase
      .from("exercises")
      .update({ title, part_type })
      .eq("id", exerciseId);

    if (error) throw new Error(error.message);
    return { success: true, message: "Đã cập nhật thông tin bài tập!" };
  } catch (err) {
    return { error: (err as Error).message || "Lỗi cập nhật bài tập." };
  }
}

export async function deleteQuestionGroup(groupId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Vui lòng đăng nhập!" };

  const { data: group } = await supabase
    .from("question_groups")
    .select("exercise_id")
    .eq("id", groupId)
    .is("removed_at", null)
    .single();

  if (!group) return { error: "Không tìm thấy nhóm câu hỏi." };

  const hasAccess = await checkInstructorAccess(
    supabase,
    user.id,
    group.exercise_id,
  );
  if (!hasAccess) return { error: "Bạn không có quyền tác động vào khóa học này." };

  try {
    const now = new Date().toISOString();

    const { data: questions } = await supabase
      .from("questions")
      .select("id")
      .eq("group_id", groupId)
      .is("removed_at", null);

    if (questions && questions.length > 0) {
      const { error: optionsError } = await supabase
        .from("question_options")
        .update({ removed_at: now })
        .in(
          "question_id",
          questions.map((question) => question.id),
        )
        .is("removed_at", null);

      if (optionsError) throw new Error(optionsError.message);
    }

    const { error: questionsError } = await supabase
      .from("questions")
      .update({ removed_at: now })
      .eq("group_id", groupId)
      .is("removed_at", null);

    if (questionsError) throw new Error(questionsError.message);

    const { error } = await supabase
      .from("question_groups")
      .update({ removed_at: now })
      .eq("id", groupId)
      .is("removed_at", null);

    if (error) throw new Error(error.message);
    return { success: true, message: "Đã xóa nhóm câu hỏi!" };
  } catch (err) {
    return { error: (err as Error).message || "Lỗi khi xóa nhóm câu hỏi." };
  }
}

export async function deleteQuestion(questionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Vui lòng đăng nhập!" };

  const { data: question } = await supabase
    .from("questions")
    .select("id, exercise_id, group_id, removed_at")
    .eq("id", questionId)
    .single();

  if (!question || question.removed_at) {
    return { error: "Không tìm thấy câu hỏi tương ứng." };
  }

  const hasAccess = await checkInstructorAccess(
    supabase,
    user.id,
    question.exercise_id,
  );
  if (!hasAccess) return { error: "Bạn không có quyền chỉnh sửa câu hỏi này." };

  try {
    const now = new Date().toISOString();

    if (question.group_id) {
      const { count, error: countError } = await supabase
        .from("questions")
        .select("id", { count: "exact", head: true })
        .eq("group_id", question.group_id)
        .is("removed_at", null);

      if (countError) throw new Error(countError.message);

      if ((count ?? 0) <= 1) {
        return {
          error: "Nhóm câu hỏi phải có ít nhất một câu hỏi và đáp án hợp lệ.",
        };
      }
    } else {
      const { count: standaloneCount, error: standaloneCountError } =
        await supabase
          .from("questions")
          .select("id", { count: "exact", head: true })
          .eq("exercise_id", question.exercise_id)
          .is("group_id", null)
          .is("removed_at", null);

      if (standaloneCountError) throw new Error(standaloneCountError.message);

      const { data: activeGroups, error: groupsError } = await supabase
        .from("question_groups")
        .select("id")
        .eq("exercise_id", question.exercise_id)
        .is("removed_at", null);

      if (groupsError) throw new Error(groupsError.message);

      let groupedQuestionCount = 0;
      const activeGroupIds = activeGroups?.map((group) => group.id) || [];

      if (activeGroupIds.length > 0) {
        const { count, error: groupedCountError } = await supabase
          .from("questions")
          .select("id", { count: "exact", head: true })
          .in("group_id", activeGroupIds)
          .is("removed_at", null);

        if (groupedCountError) throw new Error(groupedCountError.message);
        groupedQuestionCount = count ?? 0;
      }

      if ((standaloneCount ?? 0) + groupedQuestionCount <= 1) {
        return {
          error: "Bài tập phải có ít nhất một câu hỏi hợp lệ.",
        };
      }
    }

    const { error: optionsError } = await supabase
      .from("question_options")
      .update({ removed_at: now })
      .eq("question_id", questionId)
      .is("removed_at", null);

    if (optionsError) throw new Error(optionsError.message);

    const { error } = await supabase
      .from("questions")
      .update({ removed_at: now })
      .eq("id", questionId)
      .is("removed_at", null);

    if (error) throw new Error(error.message);
    return { success: true, message: "Đã xóa câu hỏi!" };
  } catch (err) {
    return { error: (err as Error).message || "Lỗi khi xóa câu hỏi." };
  }
}

export async function updateQuestionGroup(
  groupId: string,
  passage_text: string,
  audio_url: string,
  image_url: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Vui lòng đăng nhập!" };

  const { data: group } = await supabase
    .from("question_groups")
    .select("exercise_id")
    .eq("id", groupId)
    .single();

  if (!group) return { error: "Không tìm thấy nhóm câu hỏi." };

  const hasAccess = await checkInstructorAccess(
    supabase,
    user.id,
    group.exercise_id,
  );
  if (!hasAccess) return { error: "Bạn không có quyền tác động vào khóa học này." };

  try {
    const { error } = await supabase
      .from("question_groups")
      .update({
        passage_text: passage_text || null,
        audio_url: audio_url || null,
        image_url: image_url || null,
      })
      .eq("id", groupId);

    if (error) throw new Error(error.message);
    return { success: true, message: "Đã cập nhật Nhóm ngữ liệu!" };
  } catch (err) {
    return { error: (err as Error).message || "Lỗi cập nhật Nhóm." };
  }
}

export async function updateQuestion(
  questionId: string,
  content: string,
  explanation: string | null,
  options: OptionInput[],
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Vui lòng đăng nhập!" };

  if (!content.trim()) return { error: "Nội dung câu hỏi không được để trống!" };

  const cleanOptions = options
    .map((option) => ({
      id: option.id,
      content: option.content.trim(),
      is_correct: option.is_correct,
    }))
    .filter((option) => option.content !== "");

  if (cleanOptions.length < 2) {
    return { error: "Câu hỏi phải có ít nhất 2 đáp án hợp lệ." };
  }

  if (!cleanOptions.some((option) => option.is_correct)) {
    return { error: "Câu hỏi phải có ít nhất 1 đáp án đúng hợp lệ." };
  }

  try {
    const { error: rpcError } = await supabase.rpc(
      "sync_question_with_options",
      {
        p_question_id: questionId,
        p_content: content,
        p_explanation: explanation,
        p_options: cleanOptions,
      },
    );

    if (rpcError) {
      throw new Error(mapQuestionSyncRpcError(rpcError.message));
    }

    return {
      success: true,
      message: "Đã cập nhật câu hỏi và đồng bộ đáp án thành công!",
    };
  } catch (err) {
    console.error("[UPDATE QUESTION EXCEPTION]:", err);
    return { error: (err as Error).message || "Lỗi cập nhật Câu hỏi." };
  }
}

async function checkInstructorAccess(
  supabase: SupabaseClient,
  userId: string,
  exerciseId: string,
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (profile?.role === "admin") return true;

  const { data: exercise } = await supabase
    .from("exercises")
    .select("course_id")
    .eq("id", exerciseId)
    .single();

  if (!exercise) return false;

  const { data, error } = await supabase.rpc("has_course_management_access", {
    target_course_id: exercise.course_id,
  });

  if (error) {
    console.error("[EXERCISE ACCESS CHECK ERROR]:", error);
    return false;
  }

  return data === true;
}