// app/actions/progress.ts
"use server";

import { createClient } from "@/utils/supabase/server";

// ============================================================================
// 1. KÉO LỊCH SỬ ĐÁP ÁN & TIẾN ĐỘ TOPIC (Nguồn Chân Lý Duy Nhất)
// ============================================================================
export async function getTopicLearningHistory(topicId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { answers: {}, progress: null };

  // Lấy danh sách các đáp án đúng user đã chọn
  const { data: answers } = await supabase
    .from("user_question_answers")
    .select("question_id, selected_option_id, is_correct")
    .eq("user_id", user.id);

  // Lấy trực tiếp tiến độ từ bảng user_topic_progress
  const { data: progress } = await supabase
    .from("user_topic_progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("topic_id", topicId)
    .maybeSingle();

  // Chuyển đổi mảng thành Object tra cứu nhanh O(1) cho Frontend
  const answerMap: Record<string, string> = {};
  answers?.forEach(a => {
    if (a.is_correct) answerMap[a.question_id] = a.selected_option_id;
  });

  return { answers: answerMap, progress };
}

// ============================================================================
// 2. CẬP NHẬT TRẠNG THÁI HOÀN THÀNH STAGE (UPSERT CHUẨN)
// ============================================================================
export async function updateStageProgress(topicId: string, stage: 'flashcard' | 'exercise') {
  if (!topicId) {
    console.error("❌ [UPDATE PROGRESS]: Tham số topicId bị thiếu!");
    return { error: "Missing topicId" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập" };

  const updateData: any = {};
  if (stage === 'flashcard') updateData.is_flashcard_completed = true;
  if (stage === 'exercise') updateData.is_exercise_completed = true;

  try {
    // Lấy trạng thái cờ hiện tại để đối chiếu
    const { data: current, error: selectError } = await supabase
      .from("user_topic_progress")
      .select("*")
      .eq("user_id", user.id)
      .eq("topic_id", topicId)
      .maybeSingle();

    if (selectError) {
      console.warn("⚠️ [UPDATE PROGRESS WARN]: Lỗi khi kéo tiến độ cũ -", selectError.message);
    }

    // Thuật toán chốt cờ tổng: Nếu stage còn lại đã xong thì bật true
    const isAllDone = current 
      ? (stage === 'flashcard' ? current.is_exercise_completed : current.is_flashcard_completed)
      : false;

    // Thực thi UPSERT an toàn và ép trả về kết quả để xác nhận
    const { data: savedData, error: upsertError } = await supabase
      .from("user_topic_progress")
      .upsert({
        user_id: user.id,
        topic_id: topicId,
        ...updateData,
        is_topic_completed: isAllDone,
        completed_at: isAllDone ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id, topic_id' })
      .select()
      .single();

    if (upsertError) {
      console.error("❌ [UPDATE PROGRESS DB ERROR]:", upsertError.message, upsertError.details);
      return { error: upsertError.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error("❌ [UPDATE PROGRESS SYSTEM ERROR]:", err?.message);
    return { error: "Lỗi hệ thống khi cập nhật tiến độ" };
  }
}

// ============================================================================
// 3. CHẤM ĐIỂM BÀI TẬP VÀ LƯU DB
// ============================================================================
export async function submitQuestionAnswer(questionId: string, selectedOptionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập" };

  const { data: question, error: qError } = await supabase
    .from("questions")
    .select(`
      id, explanation,
      options:question_options(id, is_correct)
    `)
    .eq("id", questionId)
    .single();

  if (qError || !question) return { error: "Không tìm thấy câu hỏi" };

  const correctOption = question.options.find(opt => opt.is_correct);
  const isCorrect = correctOption?.id === selectedOptionId;

  // Thực thi UPSERT an toàn dựa trên Khóa UNIQUE(user_id, question_id)
  await supabase
    .from("user_question_answers")
    .upsert(
      {
        user_id: user.id,
        question_id: questionId,
        selected_option_id: selectedOptionId,
        is_correct: isCorrect,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id, question_id" }
    );

  if (!isCorrect) {
    return { 
      success: true, 
      isCorrect: false, 
      explanation: question.explanation || "Đáp án chưa chính xác. Bạn hãy thử lại nhé!" 
    };
  }

  return { success: true, isCorrect: true };
}