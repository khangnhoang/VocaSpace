// app/actions/progress.ts
"use server";

import { createClient } from "@/utils/supabase/server";

// 1. Kiểm tra xem User đã từng học thẻ trong Topic này chưa
export async function checkTopicProgress(topicId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { hasStudied: false };

  // Tìm xem có bất kỳ bản ghi user_flashcards nào thuộc topic này không
  const { data, error } = await supabase
    .from("user_flashcards")
    .select("id, cards!inner(topic_id)")
    .eq("user_id", user.id)
    .eq("cards.topic_id", topicId)
    .limit(1);

  if (error || !data || data.length === 0) return { hasStudied: false };
  return { hasStudied: true };
}

// 2. Chấm điểm bài tập và lưu DB
export async function submitQuestionAnswer(questionId: string, selectedOptionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Vui lòng đăng nhập" };

  // Lấy câu hỏi, lời giải thích và các option để đối chiếu
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

  // Lưu lịch sử (Upsert nhờ có UNIQUE constraint)
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
      explanation: question.explanation || "Sai rồi! Hãy xem kỹ lại ngữ liệu và chọn đáp án khác." 
    };
  }

  return { success: true, isCorrect: true };
}   