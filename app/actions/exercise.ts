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
export async function createExercise(topicId: string, rawData: ExerciseFormValues) {
  const supabase = await createClient();
  
  // 1. Chốt chặn Zod Validation
  const validated = exerciseSchema.safeParse(rawData);
  if (!validated.success) return { error: "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại Form." };
  const { title, part_type, order_index, groups } = validated.data;

  try {
    // 2. Insert Tầng 1: Exercise
    const { data: newExercise, error: exError } = await supabase
      .from("exercises")
      .insert({ topic_id: topicId, title, part_type, order_index })
      .select("id").single();
    
    if (exError || !newExercise) throw new Error(exError?.message || "Lỗi tạo Bài tập");

    // 3. Vòng lặp Insert Tầng 2: Question Groups
    for (let gIndex = 0; gIndex < groups.length; gIndex++) {
      const group = groups[gIndex];
      const { data: newGroup, error: grError } = await supabase
        .from("question_groups")
        .insert({
          exercise_id: newExercise.id,
          passage_text: group.passage_text,
          audio_url: group.audio_url,
          image_url: group.image_url,
          order_index: gIndex + 1
        })
        .select("id").single();
        
      if (grError || !newGroup) throw new Error("Lỗi tạo Nhóm câu hỏi");

      // 4. Vòng lặp Insert Tầng 3: Questions
      for (let qIndex = 0; qIndex < group.questions.length; qIndex++) {
        const question = group.questions[qIndex];
        const { data: newQuestion, error: qError } = await supabase
          .from("questions")
          .insert({
            group_id: newGroup.id,
            exercise_id: newExercise.id, // Lưu kèm exercise_id cho dễ quản lý sau này
            content: question.content,
            explanation: question.explanation,
            order_index: qIndex + 1
          })
          .select("id").single();

        if (qError || !newQuestion) throw new Error("Lỗi tạo Câu hỏi");

        // 5. Insert Tầng 4: Options (Map ra mảng rồi insert 1 lượt cho nhanh)
        const optionsToInsert = question.options.map(opt => ({
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
    // Lưu ý: Nếu muốn an toàn tuyệt đối, sau này mình sẽ phải viết Trigger/RPC
    // để rollback nếu có 1 bước lỗi. Hiện tại cứ bắn lỗi ra trước.
    return { error: err.message || "Lỗi hệ thống khi lưu bài tập." };
  }
}