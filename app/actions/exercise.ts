"use server";
import { createClient } from "@/utils/supabase/server";
import {
  exerciseSchema,
  type ExerciseFormValues,
} from "@/lib/schemas/exercise";
import { SupabaseClient } from "@supabase/supabase-js";
export type {
  FullExercise,
  FullExerciseGroup,
  FullExerciseQuestion,
  FullExerciseOption,
} from "@/lib/schemas/exercise";

// Import trực tiếp từ file Schema nội bộ để phục vụ gán kiểu hàm Get
import { FullExercise as IFullExercise } from "@/lib/schemas/exercise";

// ==========================================
// HÀM TIỆN ÍCH: TỰ ĐỘNG TÍNH ORDER_INDEX TIẾP THEO
// (Nhờ RLS, câu query này tự động bỏ qua các bản ghi đã xóa mềm)
// ==========================================
async function getNextOrderIndex(
  supabase: SupabaseClient,
  tableName: string,
  parentColumn: string,
  parentId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from(tableName)
    .select("order_index")
    .eq(parentColumn, parentId)
    .order("order_index", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return 1;
  return (data.order_index as number) + 1;
}

// ==========================================
// 1. LẤY DANH SÁCH BÀI TẬP VÀ CÂU HỎI BÊN TRONG
// (Cực kỳ tinh gọn - RLS tự động chặn lọc dòng đã bị xóa mềm ở mọi tầng lồng nhau)
// ==========================================
export async function getExercisesByTopicId(
  topicId: string,
): Promise<{ data?: IFullExercise[]; error?: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("exercises")
    .select(
      `
      id, title, part_type, order_index,
      questions (
        id, group_id, content, explanation, order_index,
        options:question_options ( id, content, is_correct )
      ),
      groups:question_groups (
        id, passage_text, audio_url, image_url, order_index,
        questions (
          id, content, explanation, order_index,
          options:question_options ( id, content, is_correct )
        )
      )
    `,
    )
    .eq("topic_id", topicId)
    .order("order_index", { ascending: true });

  if (error) return { error: error.message };

  // Khử trùng lặp: Lọc tầng server để root questions chỉ chứa câu hỏi đơn lẻ (group_id === null)
  const formattedData = data?.map((ex: any) => ({
    ...ex,
    questions: ex.questions?.filter((q: any) => q.group_id === null) || [],
  })) as IFullExercise[];

  return { data: formattedData };
}

// ============================================================================
// 2. API: THÊM BÀI TẬP MỚI (BỌC GIÁP BẢO MẬT COLLAB + BATCH INSERT ĐÁP ÁN)
// ============================================================================
export async function createExercise(
  topicId: string,
  rawData: ExerciseFormValues,
) {
  const supabase = await createClient();

  try {
    // CHẶNG A: KIỂM TRA ĐĂNG NHẬP (AUTH CHECK)
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user)
      return { error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };

    // CHẶNG B: TRUY VẾT NGƯỢC KIỂM TRA QUYỀN HẠN TỪ BẢNG COLLABORATORS
    const { data: topicData, error: topicError } = await supabase
      .from("topics")
      .select("id, course_id, removed_at") // 🔥 Đã tận dụng cột course_id được làm phẳng sau refactor
      .eq("id", topicId)
      .single();

    if (topicError || !topicData)
      return { error: "Không tìm thấy bài học tương ứng trong hệ thống." };
    if (topicData.removed_at !== null)
      return { error: "Không thể thêm bài tập vào một chủ đề đã bị xóa!" };
    const courseId = topicData.course_id;

    const { data: collaborator, error: collabError } = await supabase
      .from("course_collaborators")
      .select("role")
      .eq("course_id", courseId)
      .eq("user_id", user.id)
      .single();

    if (
      collabError ||
      !collaborator ||
      !["editor", "co_owner", "owner"].includes(collaborator.role)
    ) {
      return {
        error:
          "Từ chối truy cập. Bạn không có quyền hạn chỉnh sửa khóa học này.",
      };
    }

    // CHẶNG C: THẨM ĐỊNH KHỚP ZOD CONTRACT SCHEMAS
    const validated = exerciseSchema.safeParse(rawData);
    if (!validated.success)
      return {
        error: `Cấu trúc dữ liệu lỗi: ${validated.error.issues[0].message}`,
      };

    // 🔥 SỬA LỖI TS: Gán giá trị mặc định [] phòng trường hợp undefined
    const { title, part_type, groups = [], questions = [] } = validated.data;

    const cleanGroups = groups.filter(
      (g) =>
        g.passage_text?.trim() || g.audio_url?.trim() || g.questions.length > 0,
    );
    const cleanStandaloneQuestions = questions.filter(
      (q) => q.content.trim() !== "",
    );

    if (cleanGroups.length === 0 && cleanStandaloneQuestions.length === 0) {
      return {
        error:
          "Bài tập phải có ít nhất 1 nhóm câu hỏi hoặc 1 câu hỏi lẻ hợp lệ!",
      };
    }

    // CHẶNG D: INSERT PHÂN CẤP AN TOÀN
    const nextExerciseOrder = await getNextOrderIndex(
      supabase,
      "exercises",
      "topic_id",
      topicId,
    );

    // Insert Tầng 1: Exercise (Bổ sung course_id được derive trực tiếp từ server)
    const { data: newExercise, error: exError } = await supabase
      .from("exercises")
      .insert({
        topic_id: topicId,
        course_id: courseId, // 🔥 Kế thừa Authorization Graph từ server
        title,
        part_type,
        order_index: nextExerciseOrder,
      })
      .select("id")
      .single();

    if (exError || !newExercise)
      throw new Error(exError?.message || "Lỗi tạo Bài tập");

    // ========================================================================
    // KỊCH BẢN 1: XỬ LÝ CÂU HỎI THEO CỤM/NHÓM (PART 6, PART 7)
    // ========================================================================
    if (cleanGroups.length > 0) {
      for (let gIndex = 0; gIndex < cleanGroups.length; gIndex++) {
        const group = cleanGroups[gIndex];
        const nextGroupOrder = gIndex + 1;

        const { data: newGroup, error: grError } = await supabase
          .from("question_groups")
          .insert({
            exercise_id: newExercise.id,
            passage_text: group.passage_text || null,
            audio_url: group.audio_url || null,
            image_url: group.image_url || null,
            order_index: nextGroupOrder,
          })
          .select("id")
          .single();

        if (grError || !newGroup) throw new Error("Lỗi tạo Nhóm câu hỏi");

        const groupQuestions = group.questions.filter(
          (q) => q.content.trim() !== "",
        );

        for (let qIndex = 0; qIndex < groupQuestions.length; qIndex++) {
          const question = groupQuestions[qIndex];
          const nextQuestionOrder = qIndex + 1;

          const { data: newQuestion, error: qError } = await supabase
            .from("questions")
            .insert({
              group_id: newGroup.id,
              exercise_id: newExercise.id, // Ràng buộc trực tiếp lên exercise theo thiết kế mới
              course_id: courseId, // Đồng bộ làm phẳng RLS
              content: question.content,
              explanation: question.explanation || null,
              order_index: nextQuestionOrder,
            })
            .select("id")
            .single();

          if (qError || !newQuestion)
            throw new Error("Lỗi tạo Câu hỏi trong nhóm");

          await insertOptionsHelper(supabase, newQuestion.id, question.options);
        }
      }
    }

    // ========================================================================
    // KỊCH BẢN 2: XỬ LÝ CÂU HỎI ĐƠN LẺ TRỰC TIẾP (PART 5)
    // ========================================================================
    if (cleanStandaloneQuestions.length > 0) {
      for (let qIndex = 0; qIndex < cleanStandaloneQuestions.length; qIndex++) {
        const question = cleanStandaloneQuestions[qIndex];
        const nextQuestionOrder = qIndex + 1;

        const { data: newQuestion, error: qError } = await supabase
          .from("questions")
          .insert({
            group_id: null, // Không đi qua nhóm ngữ liệu
            exercise_id: newExercise.id, // Trực thuộc thẳng bài tập tổng
            course_id: courseId, // Làm phẳng RLS hoàn toàn
            content: question.content,
            explanation: question.explanation || null,
            order_index: nextQuestionOrder,
          })
          .select("id")
          .single();

        if (qError || !newQuestion) throw new Error("Lỗi tạo Câu hỏi lẻ");

        await insertOptionsHelper(supabase, newQuestion.id, question.options);
      }
    }

    return { success: true, message: "Đã tạo bài tập kèm câu hỏi thành công!" };
  } catch (err) {
    console.error("🚨 [EXERCISE INSERT EXCEPTION]:", err);
    return { error: (err as Error).message || "Lỗi hệ thống khi lưu bài tập." };
  }
}

// Hàm helper bóc tách riêng logic chèn Batching Options để tái sử dụng ở cả 2 kịch bản
async function insertOptionsHelper(
  supabase: SupabaseClient,
  questionId: string,
  rawOptions: any[],
) {
  const cleanOptions = rawOptions.filter((opt) => opt.content.trim() !== "");
  if (cleanOptions.length === 0)
    throw new Error("Câu hỏi phải có ít nhất 1 đáp án");

  const optionsToInsert = cleanOptions.map((opt, oIdx) => ({
    question_id: questionId,
    content: opt.content,
    label: String.fromCharCode(65 + oIdx), // Tự động dán nhãn A, B, C, D
    is_correct: opt.is_correct,
  }));

  const { error: optError } = await supabase
    .from("question_options")
    .insert(optionsToInsert);
  if (optError) throw new Error("Lỗi tạo Đáp án");
}

// ==========================================
// 3. XÓA BÀI TẬP (CẬP NHẬT LUỒNG SOFT DELETE CASCADE)
// ==========================================
export async function deleteExercise(exerciseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  // Chốt chặn bảo mật Server Action
  const hasAccess = await checkInstructorAccess(supabase, user.id, exerciseId);
  if (!hasAccess)
    return { error: "Bạn không có quyền chỉnh sửa nội dung khóa học này." };

  try {
    const now = new Date().toISOString();

    // 1. Tìm tất cả các Questions thuộc Exercise này (RLS tự lọc chỉ lấy những câu đang active)
    const { data: questions } = await supabase
      .from("questions")
      .select("id")
      .eq("exercise_id", exerciseId);

    // 2. Nếu có Questions, tiến hành Soft Delete toàn bộ Options của chúng
    if (questions && questions.length > 0) {
      const questionIds = questions.map((q) => q.id);
      await supabase
        .from("question_options")
        .update({ removed_at: now })
        .in("question_id", questionIds);
    }

    // 3. Soft Delete Questions
    await supabase
      .from("questions")
      .update({ removed_at: now })
      .eq("exercise_id", exerciseId);

    // 4. Soft Delete Question Groups
    await supabase
      .from("question_groups")
      .update({ removed_at: now })
      .eq("exercise_id", exerciseId);

    // 5. Cuối cùng, Soft Delete chính Exercise
    const { error } = await supabase
      .from("exercises")
      .update({ removed_at: now })
      .eq("id", exerciseId);

    if (error) throw new Error(error.message);

    return { success: true, message: "Đã xóa bài tập thành công!" };
  } catch (err) {
    const error = err as Error;
    return { error: error.message || "Lỗi khi xóa bài tập" };
  }
}

// ==========================================
// 4. CẬP NHẬT THÔNG TIN CƠ BẢN BÀI TẬP (BỎ UPDATED_AT - DB TRIGGER TỰ XỬ LÝ)
// ==========================================
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

  // Chốt chặn bảo mật Server Action
  const hasAccess = await checkInstructorAccess(supabase, user.id, exerciseId);
  if (!hasAccess)
    return { error: "Bạn không có quyền chỉnh sửa nội dung khóa học này." };

  if (title.length < 4) return { error: "Tên bài tập quá ngắn!" };

  try {
    const { error } = await supabase
      .from("exercises")
      .update({ title, part_type }) // 🔥 Đã bỏ updated_at thủ công
      .eq("id", exerciseId);

    if (error) throw new Error(error.message);
    return { success: true, message: "Đã cập nhật thông tin bài tập!" };
  } catch (err) {
    const error = err as Error;
    return { error: error.message || "Lỗi cập nhật bài tập." };
  }
}

// ==========================================
// 5. XÓA NHÓM NGỮ LIỆU (SOFT DELETE CASCADE) - TẦNG 2
// ==========================================
export async function deleteQuestionGroup(groupId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  // Áp dụng cho cả deleteQuestionGroup và updateQuestionGroup
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
  if (!hasAccess)
    return { error: "Bạn không có quyền tác động vào khóa học này." };

  try {
    const now = new Date().toISOString();

    // 1. Tìm các câu hỏi thuộc Group này
    const { data: questions } = await supabase
      .from("questions")
      .select("id")
      .eq("group_id", groupId);

    // 2. Soft Delete Options của các câu hỏi đó
    if (questions && questions.length > 0) {
      const questionIds = questions.map((q) => q.id);
      await supabase
        .from("question_options")
        .update({ removed_at: now })
        .in("question_id", questionIds);
    }

    // 3. Soft Delete Câu hỏi
    await supabase
      .from("questions")
      .update({ removed_at: now })
      .eq("group_id", groupId);

    // 4. Soft Delete Nhóm
    const { error } = await supabase
      .from("question_groups")
      .update({ removed_at: now })
      .eq("id", groupId);
    if (error) throw new Error(error.message);

    return { success: true, message: "Đã xóa nhóm câu hỏi!" };
  } catch (err) {
    const error = err as Error;
    return { error: error.message || "Lỗi khi xóa nhóm câu hỏi." };
  }
}

// ==========================================
// 6. XÓA CÂU HỎI (SOFT DELETE) - TẦNG 3
// ==========================================
export async function deleteQuestion(questionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  // Áp dụng cho cả deleteQuestion và updateQuestion
  const { data: question } = await supabase
    .from("questions")
    .select("exercise_id")
    .eq("id", questionId)
    .single();
  if (!question) return { error: "Không tìm thấy câu hỏi tương ứng." };

  const hasAccess = await checkInstructorAccess(
    supabase,
    user.id,
    question.exercise_id,
  );
  if (!hasAccess) return { error: "Bạn không có quyền chỉnh sửa câu hỏi này." };

  try {
    const now = new Date().toISOString();

    // 1. Soft Delete Options trước
    await supabase
      .from("question_options")
      .update({ removed_at: now })
      .eq("question_id", questionId);

    // 2. Soft Delete Câu hỏi chính
    const { error } = await supabase
      .from("questions")
      .update({ removed_at: now })
      .eq("id", questionId);
    if (error) throw new Error(error.message);

    return { success: true, message: "Đã xóa câu hỏi!" };
  } catch (err) {
    const error = err as Error;
    return { error: error.message || "Lỗi khi xóa câu hỏi." };
  }
}

// ==========================================
// 7. CẬP NHẬT NHÓM NGỮ LIỆU - ĐÃ BỔ SUNG IMAGE_URL
// ==========================================
export async function updateQuestionGroup(
  groupId: string,
  passage_text: string,
  audio_url: string,
  image_url: string, // 🔥 Bổ sung tham số nhận vào
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  const { data: group } = await supabase.from("question_groups").select("exercise_id").eq("id", groupId).single();
  if (!group) return { error: "Không tìm thấy nhóm câu hỏi." };

  const hasAccess = await checkInstructorAccess(supabase, user.id, group.exercise_id);
  if (!hasAccess) return { error: "Bạn không có quyền tác động vào khóa học này." };

  try {
    const { error } = await supabase
      .from("question_groups")
      .update({
        passage_text: passage_text || null,
        audio_url: audio_url || null,
        image_url: image_url || null, // 🔥 Cập nhật đồng bộ DB
      })
      .eq("id", groupId);

    if (error) throw new Error(error.message);
    return { success: true, message: "Đã cập nhật Nhóm ngữ liệu!" };
  } catch (err) {
    const error = err as Error;
    return { error: error.message || "Lỗi cập nhật Nhóm." };
  }
}

// ==========================================
// 8. CẬP NHẬT CÂU HỎI & ĐÁP ÁN - ĐÃ VÁ BUG SYNC OPTIONS
// ==========================================
export async function updateQuestion(
  questionId: string,
  content: string,
  explanation: string | null, // 🔥 Thêm trường giải thích
  options: { id?: string; content: string; is_correct: boolean }[], // 🔥 id chuyển thành optional để nhận option mới
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  const { data: question } = await supabase.from("questions").select("exercise_id").eq("id", questionId).single();
  if (!question) return { error: "Không tìm thấy câu hỏi tương ứng." };

  const hasAccess = await checkInstructorAccess(supabase, user.id, question.exercise_id);
  if (!hasAccess) return { error: "Bạn không có quyền chỉnh sửa câu hỏi này." };

  if (!content.trim()) return { error: "Nội dung câu hỏi không được để trống!" };

  try {
    // 1. Cập nhật nội dung & giải thích của câu hỏi
    const { error: qError } = await supabase
      .from("questions")
      .update({ content, explanation: explanation || null })
      .eq("id", questionId);
    if (qError) throw new Error(qError.message);

    // 2. Lấy danh sách đáp án hiện tại đang active trong DB để so sánh
    const { data: currentOptions } = await supabase
      .from("question_options")
      .select("id")
      .eq("question_id", questionId)
      .is("removed_at", null);

    const currentOptIds = currentOptions?.map(o => o.id) || [];
    const incomingOptIds = options.filter(o => o.id).map(o => o.id as string);

    // Quyết định hành động: Đáp án nào không nằm trong danh sách gửi lên nữa -> Soft Delete
    const idsToDelete = currentOptIds.filter(id => !incomingOptIds.includes(id));
    if (idsToDelete.length > 0) {
      await supabase
        .from("question_options")
        .update({ removed_at: new Date().toISOString() })
        .in("id", idsToDelete);
    }

    // 3. Duyệt qua danh sách gửi lên để Xử lý Update hoặc Insert
    for (let oIdx = 0; oIdx < options.length; oIdx++) {
      const opt = options[oIdx];
      const label = String.fromCharCode(65 + oIdx); // Tự động chuẩn hoá lại nhãn A, B, C, D đề phòng có sự thay đổi số lượng

      if (opt.id) {
        // Có ID -> Cập nhật nội dung cũ
        const { error: optError } = await supabase
          .from("question_options")
          .update({ content: opt.content, is_correct: opt.is_correct, label })
          .eq("id", opt.id);
        if (optError) throw new Error(optError.message);
      } else {
        // Không có ID -> Giáo viên vừa ấn "Thêm đáp án" ở UI -> INSERT mới
        const { error: optError } = await supabase
          .from("question_options")
          .insert({
            question_id: questionId,
            content: opt.content,
            is_correct: opt.is_correct,
            label
          });
        if (optError) throw new Error(optError.message);
      }
    }

    return { success: true, message: "Đã cập nhật câu hỏi và đồng bộ đáp án thành công!" };
  } catch (err) {
    console.error("🚨 [UPDATE QUESTION EXCEPTION]:", err);
    return { error: (err as Error).message || "Lỗi cập nhật Câu hỏi." };
  }
}

// Hàm helper bảo mật nội bộ (Không export)
async function checkInstructorAccess(
  supabase: SupabaseClient,
  userId: string,
  exerciseId: string,
): Promise<boolean> {
  const { data: ex } = await supabase
    .from("exercises")
    .select("course_id")
    .eq("id", exerciseId)
    .single();
  if (!ex) return false;

  const { data: collab } = await supabase
    .from("course_collaborators")
    .select("role")
    .eq("course_id", ex.course_id)
    .eq("user_id", userId)
    .single();

  return !!collab && ["editor", "co_owner", "owner"].includes(collab.role);
}
