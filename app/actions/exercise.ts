"use server";
import { createClient } from "@/utils/supabase/server";
import { exerciseSchema, type ExerciseFormValues } from "@/lib/schemas/exercise";
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
  parentId: string
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
export async function getExercisesByTopicId(topicId: string): Promise<{ data?: IFullExercise[]; error?: string }> {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("exercises")
    .select(`
      id, title, part_type, order_index,
      groups:question_groups (
        id, passage_text, audio_url, image_url, order_index,
        questions (
          id, content, explanation, order_index,
          options:question_options (
            id, content, is_correct
          )
        )
      )
    `)
    .eq("topic_id", topicId)
    .order("order_index", { ascending: true });

  if (error) return { error: error.message };
  // Ép kiểu dữ liệu trả về để FE hưởng lợi từ Intellisense
  return { data: data as unknown as IFullExercise[] };
}

// ============================================================================
// 2. API: THÊM BÀI TẬP MỚI (BỌC GIÁP BẢO MẬT COLLAB + BATCH INSERT ĐÁP ÁN)
// ============================================================================
export async function createExercise(topicId: string, rawData: ExerciseFormValues) {
  const supabase = await createClient();
  
  try {
    // CHẶNG A: KIỂM TRA ĐĂNG NHẬP (AUTH CHECK)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };

    // CHẶNG B: TRUY VẾT NGƯỢC KIỂM TRA QUYỀN HẠN TỪ BẢNG COLLABORATORS
    const { data: topicData, error: topicError } = await supabase
      .from("topics")
      .select("id, chapters!inner(course_id)")
      .eq("id", topicId)
      .single();

    if (topicError || !topicData) return { error: "Không tìm thấy bài học tương ứng trong hệ thống." };
    const courseId = (topicData.chapters as any)?.course_id;

    const { data: collaborator, error: collabError } = await supabase
      .from("course_collaborators")
      .select("role")
      .eq("course_id", courseId)
      .eq("user_id", user.id)
      .single();

    if (collabError || !collaborator || !["editor", "co_owner", "owner"].includes(collaborator.role)) {
      return { error: "Từ chối truy cập. Bạn không có quyền hạn chỉnh sửa khóa học này." };
    }

    // CHẶNG C: THẨM ĐỊNH KHỚP ZOD CONTRACT SCHEMAS
    const validated = exerciseSchema.safeParse(rawData);
    if (!validated.success) return { error: `Cấu trúc dữ liệu lỗi: ${validated.error.issues[0].message}` };
    
    const { title, part_type, groups } = validated.data;
    
    const cleanGroups = groups.filter(g => 
      g.passage_text?.trim() || g.audio_url?.trim() || g.questions.length > 0
    );

    if (cleanGroups.length === 0) return { error: "Bài tập phải có ít nhất 1 nhóm câu hỏi hợp lệ!" };

    // CHẶNG D: INSERT PHÂN CẤP AN TOÀN
    const nextExerciseOrder = await getNextOrderIndex(supabase, "exercises", "topic_id", topicId);

    // Insert Tầng 1: Exercise
    const { data: newExercise, error: exError } = await supabase
      .from("exercises")
      .insert({ topic_id: topicId, title, part_type, order_index: nextExerciseOrder })
      .select("id").single();
    
    if (exError || !newExercise) throw new Error(exError?.message || "Lỗi tạo Bài tập");

    // Vòng lặp Insert Tầng 2: Question Groups
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
          order_index: nextGroupOrder
        })
        .select("id").single();
        
      if (grError || !newGroup) throw new Error("Lỗi tạo Nhóm câu hỏi");

      const cleanQuestions = group.questions.filter(q => q.content.trim() !== "");

      // Vòng lặp Insert Tầng 3: Questions
      for (let qIndex = 0; qIndex < cleanQuestions.length; qIndex++) {
        const question = cleanQuestions[qIndex];
        const nextQuestionOrder = qIndex + 1;

        const { data: newQuestion, error: qError } = await supabase
          .from("questions")
          .insert({
            group_id: newGroup.id,
            exercise_id: newExercise.id,
            content: question.content,
            explanation: question.explanation || null,
            order_index: nextQuestionOrder
          })
          .select("id").single();

        if (qError || !newQuestion) throw new Error("Lỗi tạo Câu hỏi");

        const cleanOptions = question.options.filter(opt => opt.content.trim() !== "");
        if (cleanOptions.length === 0) throw new Error("Câu hỏi phải có ít nhất 1 đáp án");

        // 🔥 BIỆN PHÁP HIỆU NĂNG BATCHING TẦNG 4: Gom và tự động đánh nhãn A, B, C, D
        const optionsToInsert = cleanOptions.map((opt, oIdx) => ({
          question_id: newQuestion.id,
          content: opt.content,
          label: String.fromCharCode(65 + oIdx), // 0 -> A, 1 -> B,...
          is_correct: opt.is_correct
        }));

        const { error: optError } = await supabase.from("question_options").insert(optionsToInsert);
        if (optError) throw new Error("Lỗi tạo Đáp án");
      }
    }

    return { success: true, message: "Đã tạo bài tập kèm câu hỏi thành công!" };
  } catch (err) {
    console.error("🚨 [EXERCISE INSERT EXCEPTION]:", err);
    return { error: (err as Error).message || "Lỗi hệ thống khi lưu bài tập." };
  }
}

// ==========================================
// 3. XÓA BÀI TẬP (CẬP NHẬT LUỒNG SOFT DELETE CASCADE)
// ==========================================
export async function deleteExercise(exerciseId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  try {
    const now = new Date().toISOString();

    // 1. Tìm tất cả các Questions thuộc Exercise này (RLS tự lọc chỉ lấy những câu đang active)
    const { data: questions } = await supabase
      .from("questions")
      .select("id")
      .eq("exercise_id", exerciseId);

    // 2. Nếu có Questions, tiến hành Soft Delete toàn bộ Options của chúng
    if (questions && questions.length > 0) {
      const questionIds = questions.map(q => q.id);
      await supabase.from("question_options").update({ removed_at: now }).in("question_id", questionIds);
    }

    // 3. Soft Delete Questions
    await supabase.from("questions").update({ removed_at: now }).eq("exercise_id", exerciseId);
    
    // 4. Soft Delete Question Groups
    await supabase.from("question_groups").update({ removed_at: now }).eq("exercise_id", exerciseId);
    
    // 5. Cuối cùng, Soft Delete chính Exercise
    const { error } = await supabase.from("exercises").update({ removed_at: now }).eq("id", exerciseId);
    
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
export async function updateExerciseBasic(exerciseId: string, title: string, part_type: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  try {
    const now = new Date().toISOString();

    // 1. Tìm các câu hỏi thuộc Group này
    const { data: questions } = await supabase.from("questions").select("id").eq("group_id", groupId);

    // 2. Soft Delete Options của các câu hỏi đó
    if (questions && questions.length > 0) {
      const questionIds = questions.map(q => q.id);
      await supabase.from("question_options").update({ removed_at: now }).in("question_id", questionIds);
    }

    // 3. Soft Delete Câu hỏi
    await supabase.from("questions").update({ removed_at: now }).eq("group_id", groupId);
    
    // 4. Soft Delete Nhóm
    const { error } = await supabase.from("question_groups").update({ removed_at: now }).eq("id", groupId);
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  try {
    const now = new Date().toISOString();

    // 1. Soft Delete Options trước
    await supabase.from("question_options").update({ removed_at: now }).eq("question_id", questionId);
    
    // 2. Soft Delete Câu hỏi chính
    const { error } = await supabase.from("questions").update({ removed_at: now }).eq("id", questionId);
    if (error) throw new Error(error.message);

    return { success: true, message: "Đã xóa câu hỏi!" };
  } catch (err) {
    const error = err as Error;
    return { error: error.message || "Lỗi khi xóa câu hỏi." };
  }
}

// ==========================================
// 7. CẬP NHẬT NHÓM NGỮ LIỆU (BỎ UPDATED_AT) - TẦNG 2
// ==========================================
export async function updateQuestionGroup(groupId: string, passage_text: string, audio_url: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  try {
    const { error } = await supabase
      .from("question_groups")
      .update({ passage_text: passage_text || null, audio_url: audio_url || null }) // 🔥 Đã bỏ updated_at thủ công
      .eq("id", groupId);

    if (error) throw new Error(error.message);
    return { success: true, message: "Đã cập nhật Nhóm ngữ liệu!" };
  } catch (err) {
    const error = err as Error;
    return { error: error.message || "Lỗi cập nhật Nhóm." };
  }
}

// ==========================================
// 8. CẬP NHẬT CÂU HỎI & ĐÁP ÁN (BỎ UPDATED_AT) - TẦNG 3 & 4
// ==========================================
export async function updateQuestion(questionId: string, content: string, options: { id: string, content: string, is_correct: boolean }[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  if (!content.trim()) return { error: "Nội dung câu hỏi không được để trống!" };

  try {
    // 1. Cập nhật nội dung câu hỏi
    const { error: qError } = await supabase
      .from("questions")
      .update({ content }) // 🔥 Đã bỏ updated_at thủ công
      .eq("id", questionId);
    if (qError) throw new Error(qError.message);

    // 2. Cập nhật từng đáp án
    for (const opt of options) {
      if (opt.id) {
        const { error: optError } = await supabase
          .from("question_options")
          .update({ content: opt.content, is_correct: opt.is_correct }) // 🔥 Đã bỏ updated_at thủ công
          .eq("id", opt.id);
        if (optError) throw new Error(optError.message);
      }
    }

    return { success: true, message: "Đã cập nhật Câu hỏi!" };
  } catch (err) {
    const error = err as Error;
    return { error: error.message || "Lỗi cập nhật Câu hỏi." };
  }
}