"use server";
import { createClient } from "@/utils/supabase/server";
import { exerciseSchema, type ExerciseFormValues } from "@/lib/schemas/exercise";
import { Exercise, QuestionGroup, Question, QuestionOption } from "@/types/database";
import { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// ĐỊNH NGHĨA KIỂU SSOT 4 TẦNG (DÙNG CHUNG CHO SERVER ACTION VÀ UI COMPONENT)
// ============================================================================

export type FullExerciseOption = QuestionOption;

export type FullExerciseQuestion = Question & {
  options: FullExerciseOption[];
};

export type FullExerciseGroup = QuestionGroup & {
  questions: FullExerciseQuestion[];
};

export interface FullExercise extends Exercise {
  groups: FullExerciseGroup[];
}

// ==========================================
// HÀM TIỆN ÍCH: TỰ ĐỘNG TÍNH ORDER_INDEX TIẾP THEO
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
// ==========================================
export async function getExercisesByTopicId(topicId: string): Promise<{ data?: FullExercise[]; error?: string }> {
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
  return { data: data as unknown as FullExercise[] };
}

// ==========================================
// 2. THÊM BÀI TẬP MỚI (INSERT 4 TẦNG LIÊN HOÀN)
// ==========================================
// app/actions/exercise.ts

export async function createExercise(topicId: string, rawData: ExerciseFormValues) {
  const supabase = await createClient();
  
  const validated = exerciseSchema.safeParse(rawData);
  if (!validated.success) return { error: "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại Form." };
  
  // FIX 1: Lấy order_index tự động, BỎ qua order_index từ Form gửi lên
  const { title, part_type, groups } = validated.data;
  
  const cleanGroups = groups.filter(g => 
    g.passage_text?.trim() || g.audio_url?.trim() || g.questions.length > 0
  );

  if (cleanGroups.length === 0) {
     return { error: "Bài tập phải có ít nhất 1 nhóm câu hỏi hợp lệ!" };
  }

  try {
    // FIX 2: Tự động tính order_index cho Bài Tập mới dựa vào Topic ID
    const nextExerciseOrder = await getNextOrderIndex(supabase, "exercises", "topic_id", topicId);

    // Insert Tầng 1: Exercise
    const { data: newExercise, error: exError } = await supabase
      .from("exercises")
      .insert({ topic_id: topicId, title, part_type, order_index: nextExerciseOrder })
      .select("id").single();
    
    if (exError || !newExercise) throw new Error(exError?.message || "Lỗi tạo Bài tập");

    // Vòng lặp Insert Tầng 2
    for (let gIndex = 0; gIndex < cleanGroups.length; gIndex++) {
      const group = cleanGroups[gIndex];
      
      // FIX 3: Tự động tính order_index cho Group mới dựa vào Exercise ID
      const nextGroupOrder = await getNextOrderIndex(supabase, "question_groups", "exercise_id", newExercise.id);

      const { data: newGroup, error: grError } = await supabase
        .from("question_groups")
        .insert({
          exercise_id: newExercise.id,
          passage_text: group.passage_text || null,
          audio_url: group.audio_url || null,
          order_index: nextGroupOrder
        })
        .select("id").single();
        
      if (grError || !newGroup) throw new Error("Lỗi tạo Nhóm câu hỏi");

      const cleanQuestions = group.questions.filter(q => q.content.trim() !== "");

      // Vòng lặp Insert Tầng 3
      for (let qIndex = 0; qIndex < cleanQuestions.length; qIndex++) {
        const question = cleanQuestions[qIndex];
        
        // FIX 4: Tự động tính order_index cho Question mới dựa vào Group ID
        const nextQuestionOrder = await getNextOrderIndex(supabase, "questions", "group_id", newGroup.id);

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
        if(cleanOptions.length === 0) throw new Error("Câu hỏi phải có ít nhất 1 đáp án");

        const optionsToInsert = cleanOptions.map(opt => ({
          question_id: newQuestion.id,
          content: opt.content,
          is_correct: opt.is_correct
        }));

        const { error: optError } = await supabase.from("question_options").insert(optionsToInsert);
        if (optError) throw new Error("Lỗi tạo Đáp án");
      }
    }

    return { success: true, message: "Đã tạo bài tập kèm câu hỏi thành công!" };
  } catch (err) {
    const error = err as Error;
    return { error: error.message || "Lỗi hệ thống khi lưu bài tập." };
  }
}

// ==========================================
// XÓA BÀI TẬP (CASCADE DELETE)
// ==========================================
export async function deleteExercise(exerciseId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  try {
    // 1. Tìm tất cả các Questions thuộc Exercise này
    const { data: questions } = await supabase
      .from("questions")
      .select("id")
      .eq("exercise_id", exerciseId);

    // 2. Nếu có Questions, xóa toàn bộ Options của chúng
    if (questions && questions.length > 0) {
      const questionIds = questions.map(q => q.id);
      await supabase.from("question_options").delete().in("question_id", questionIds);
    }

    // 3. Xóa Questions
    await supabase.from("questions").delete().eq("exercise_id", exerciseId);
    
    // 4. Xóa Question Groups
    await supabase.from("question_groups").delete().eq("exercise_id", exerciseId);
    
    // 5. Cuối cùng, xóa chính Exercise
    const { error } = await supabase.from("exercises").delete().eq("id", exerciseId);
    
    if (error) throw new Error(error.message);

    return { success: true, message: "Đã xóa bài tập thành công!" };
  } catch (err) {
    // Ép kiểu err thành Error để lấy message an toàn
    const error = err as Error;
    return { error: error.message || "Lỗi khi xóa bài tập" };
  }
  }

// Cập nhật Thông tin cơ bản Bài Tập (Tên & Part)
export async function updateExerciseBasic(exerciseId: string, title: string, part_type: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  if (title.length < 4) return { error: "Tên bài tập quá ngắn!" };

  try {
    const { error } = await supabase
      .from("exercises")
      .update({ title, part_type })
      .eq("id", exerciseId);

    if (error) throw new Error(error.message);
    return { success: true, message: "Đã cập nhật thông tin bài tập!" };
  } catch (err) {
    const error = err as Error;
    return { error: error.message || "Lỗi cập nhật bài tập." };
  }
}

// ==========================================
// XÓA NHÓM NGỮ LIỆU (CASCADE DELETE) - TẦNG 2
// ==========================================
export async function deleteQuestionGroup(groupId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  try {
    // 1. Tìm các câu hỏi thuộc Group này
    const { data: questions } = await supabase.from("questions").select("id").eq("group_id", groupId);

    // 2. Xóa Options của các câu hỏi đó
    if (questions && questions.length > 0) {
      const questionIds = questions.map(q => q.id);
      await supabase.from("question_options").delete().in("question_id", questionIds);
    }

    // 3. Xóa Câu hỏi
    await supabase.from("questions").delete().eq("group_id", groupId);
    
    // 4. Xóa Nhóm
    const { error } = await supabase.from("question_groups").delete().eq("id", groupId);
    if (error) throw new Error(error.message);

    return { success: true, message: "Đã xóa nhóm câu hỏi!" };
  } catch (err) {
    const error = err as Error;
    return { error: error.message || "Lỗi khi xóa nhóm câu hỏi." };
  }
}

// ==========================================
// XÓA CÂU HỎI (CASCADE DELETE) - TẦNG 3
// ==========================================
export async function deleteQuestion(questionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  try {
    // 1. Xóa Options trước
    await supabase.from("question_options").delete().eq("question_id", questionId);
    
    // 2. Xóa Câu hỏi
    const { error } = await supabase.from("questions").delete().eq("id", questionId);
    if (error) throw new Error(error.message);

    return { success: true, message: "Đã xóa câu hỏi!" };
  } catch (err) {
    const error = err as Error;
    return { error: error.message || "Lỗi khi xóa câu hỏi." };
  }
}

// ==========================================
// CẬP NHẬT NHÓM NGỮ LIỆU (TẦNG 2)
// ==========================================
export async function updateQuestionGroup(groupId: string, passage_text: string, audio_url: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập!" };

  try {
    const { error } = await supabase
      .from("question_groups")
      .update({ passage_text: passage_text || null, audio_url: audio_url || null })
      .eq("id", groupId);

    if (error) throw new Error(error.message);
    return { success: true, message: "Đã cập nhật Nhóm ngữ liệu!" };
  } catch (err) {
    const error = err as Error;
    return { error: error.message || "Lỗi cập nhật Nhóm." };
  }
}

// ==========================================
// CẬP NHẬT CÂU HỎI & ĐÁP ÁN (TẦNG 3 & 4)
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
      .update({ content })
      .eq("id", questionId);
    if (qError) throw new Error(qError.message);

    // 2. Cập nhật từng đáp án
    for (const opt of options) {
      if (opt.id) {
        const { error: optError } = await supabase
          .from("question_options")
          .update({ content: opt.content, is_correct: opt.is_correct })
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