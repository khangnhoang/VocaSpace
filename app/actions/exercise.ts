"use server";
import { createClient } from "@/utils/supabase/server";
import { exerciseSchema, type ExerciseFormValues } from "@/lib/schemas/exercise";

// ==========================================
// 1. LẤY DANH SÁCH BÀI TẬP VÀ CÂU HỎI BÊN TRONG
// ==========================================
export async function getExercisesByTopicId(topicId: string) {
  const supabase = await createClient();
  
  // Dùng Query Builder của Supabase để lấy dữ liệu 4 tầng trong 1 câu Query
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
  return { data };
}

// ==========================================
// 2. THÊM BÀI TẬP MỚI (INSERT 4 TẦNG LIÊN HOÀN)
// ==========================================
// app/actions/exercise.ts

export async function createExercise(topicId: string, rawData: ExerciseFormValues) {
  const supabase = await createClient();
  
  // 1. Chốt chặn Zod Validation (Vẫn giữ nguyên)
  const validated = exerciseSchema.safeParse(rawData);
  if (!validated.success) return { error: "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại Form." };
  
  const { title, part_type, order_index, groups } = validated.data;

  // FIX TẠI ĐÂY: RỬA DỮ LIỆU (Sanitize Data)
  // Lọc bỏ những Group không có nội dung (không có văn bản, không có audio, VÀ không có câu hỏi nào)
  const cleanGroups = groups.filter(g => 
    g.passage_text?.trim() || g.audio_url?.trim() || g.questions.length > 0
  );

  if (cleanGroups.length === 0) {
     return { error: "Bài tập phải có ít nhất 1 nhóm câu hỏi hợp lệ!" };
  }

  try {
    // 2. Insert Tầng 1: Exercise
    const { data: newExercise, error: exError } = await supabase
      .from("exercises")
      .insert({ topic_id: topicId, title, part_type, order_index })
      .select("id").single();
    
    if (exError || !newExercise) throw new Error(exError?.message || "Lỗi tạo Bài tập");

    // 3. Vòng lặp Insert Tầng 2: Thay 'groups' thành 'cleanGroups'
    for (let gIndex = 0; gIndex < cleanGroups.length; gIndex++) {
      const group = cleanGroups[gIndex];
      // ... (Phần Insert Group giữ nguyên)
      const { data: newGroup, error: grError } = await supabase
        .from("question_groups")
        .insert({
          exercise_id: newExercise.id,
          passage_text: group.passage_text || null, // Đảm bảo null nếu rỗng
          audio_url: group.audio_url || null,       // Đảm bảo null nếu rỗng
          order_index: gIndex + 1
        })
        .select("id").single();
        
      if (grError || !newGroup) throw new Error("Lỗi tạo Nhóm câu hỏi");

      // 4. Lọc tiếp Câu hỏi rỗng trước khi Insert
      const cleanQuestions = group.questions.filter(q => q.content.trim() !== "");

      // Vòng lặp Insert Tầng 3: Thay 'group.questions' thành 'cleanQuestions'
      for (let qIndex = 0; qIndex < cleanQuestions.length; qIndex++) {
        const question = cleanQuestions[qIndex];
        // ... (Phần Insert Câu hỏi & Đáp án giữ nguyên)
        const { data: newQuestion, error: qError } = await supabase
          .from("questions")
          .insert({
            group_id: newGroup.id,
            exercise_id: newExercise.id,
            content: question.content,
            explanation: question.explanation || null,
            order_index: qIndex + 1
          })
          .select("id").single();

        if (qError || !newQuestion) throw new Error("Lỗi tạo Câu hỏi");

        // Lọc đáp án rỗng (tùy chọn)
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
  } catch (err: any) {
    return { error: err.message || "Lỗi hệ thống khi lưu bài tập." };
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
  } catch (err: any) {
    return { error: err.message || "Lỗi khi xóa bài tập." };
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
  } catch (err: any) {
    return { error: err.message || "Lỗi cập nhật bài tập." };
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
  } catch (err: any) {
    return { error: err.message || "Lỗi khi xóa nhóm câu hỏi." };
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
  } catch (err: any) {
    return { error: err.message || "Lỗi khi xóa câu hỏi." };
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
  } catch (err: any) {
    return { error: err.message || "Lỗi cập nhật Nhóm." };
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
  } catch (err: any) {
    return { error: err.message || "Lỗi cập nhật Câu hỏi." };
  }
}