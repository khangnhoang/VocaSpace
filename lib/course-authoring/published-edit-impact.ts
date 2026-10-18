// Chỉ các thao tác có thể làm học viên mất nội dung hoặc đổi cách chấm điểm mới cần cảnh báo
// khi bài học đã xuất bản (TFEAT1 AC5). Thêm mới và đổi tên lưu thẳng, không qua đây.
export type PublishedDeleteTarget =
  | "card"
  | "exercise"
  | "question"
  | "memory_check_question"
  | "memory_check"
  | "topic";

export const PUBLISHED_DELETE_IMPACT: Record<PublishedDeleteTarget, string> = {
  card: "Bài học đang xuất bản, nên học viên sẽ không còn thấy thẻ này ngay khi bạn xóa.",
  exercise:
    "Bài học đang xuất bản, nên học viên sẽ không còn thấy bài tập và các câu hỏi bên trong ngay khi bạn xóa. Câu trả lời đã lưu của họ không bị chấm lại.",
  question:
    "Bài học đang xuất bản, nên học viên sẽ không còn thấy câu hỏi này ngay khi bạn xóa. Câu trả lời đã lưu của họ không bị chấm lại.",
  memory_check_question:
    "Bài học đang xuất bản, nên học viên sẽ không còn thấy câu memory check này ngay khi bạn xóa.",
  memory_check:
    "Bài học đang xuất bản, nên học viên sẽ đi thẳng từ flashcard sang bài tập ngay khi bạn gỡ memory check.",
  topic:
    "Bài học đang xuất bản, nên học viên sẽ không còn thấy bài học này ngay khi bạn ẩn nó.",
};

export interface AnswerImpact {
  removedOption: boolean;
  correctChanged: boolean;
}

interface SavedOption {
  id: string;
  is_correct: boolean;
}

interface EditedOption {
  id?: string;
  content: string;
  is_correct: boolean;
}

// So bản đã lưu với bản sắp gửi: đáp án nào đã lưu mà không còn trong bản gửi (kể cả bị xóa chữ
// nên bị lọc) là "bị bỏ"; tập đáp án đúng đã lưu khác tập đáp án đúng đã giữ là "đổi đáp án đúng".
// Schema và RPC cho phép nhiều đáp án đúng nên so cả tập, không chỉ đáp án đúng đầu tiên.
export function getQuestionAnswerImpact(
  saved: readonly SavedOption[],
  edited: readonly EditedOption[],
): AnswerImpact {
  const kept = edited.filter((option) => option.content.trim() !== "");
  const keptIds = new Set(
    kept.flatMap((option) => (option.id ? [option.id] : [])),
  );
  const removedOption = saved.some((option) => !keptIds.has(option.id));

  const savedCorrectIds = new Set(
    saved.filter((option) => option.is_correct).map((option) => option.id),
  );
  const keptCorrect = kept.filter((option) => option.is_correct);
  // Đáp án đúng chưa có id là đáp án mới nên chắc chắn làm đổi tập đáp án đúng.
  const correctChanged =
    keptCorrect.some((option) => !option.id) ||
    keptCorrect.length !== savedCorrectIds.size ||
    keptCorrect.some((option) => !savedCorrectIds.has(option.id as string));

  return { removedOption, correctChanged };
}

export function hasAnswerImpact(impact: AnswerImpact) {
  return impact.removedOption || impact.correctChanged;
}

// Tiêu đề nêu đúng điều sắp xảy ra: đổi đáp án đúng thì nói thẳng, chỉ bỏ đáp án thì dùng tiêu đề trung tính.
export function describeAnswerImpactTitle(impact: AnswerImpact) {
  return impact.correctChanged ? "Đổi đáp án đúng?" : "Lưu thay đổi đáp án?";
}

export function describeAnswerImpact(impact: AnswerImpact) {
  const parts: string[] = [];
  if (impact.correctChanged) {
    parts.push(
      "Học viên chưa hoàn thành bài học sẽ được chấm theo đáp án mới: ai đã chọn đáp án cũ sẽ phải làm lại câu này. Học viên đã hoàn thành bài học vẫn giữ kết quả. Nhớ sửa lời giải cho khớp với đáp án mới.",
    );
  }
  if (impact.removedOption) {
    parts.push("Đáp án bị bỏ sẽ không còn hiện cho học viên.");
  }
  return parts.join(" ");
}
