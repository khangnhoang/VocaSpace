import { Rating } from "ts-fsrs";

// Nguồn duy nhất của bốn nút tự đánh giá thẻ, dùng chung cho FlashcardStage và ReviewSheet để màu không lệch nhau (LF6 AC5).
// Chỉ phản ánh mức nhớ: Attention cho mức khó hơn, Recall cho mức dễ hơn. Đây không phải tín hiệu đúng/sai nên Growth và
// Correction không dùng ở đây.
export const FLASHCARD_RATINGS = [
  {
    rating: Rating.Again,
    label: "Lại",
    className: "border-attention-line bg-attention-quiet text-attention hover:bg-attention-quiet hover:border-attention",
  },
  {
    rating: Rating.Hard,
    label: "Khó",
    className: "border-attention-line bg-white text-attention hover:bg-attention-quiet hover:border-attention",
  },
  {
    rating: Rating.Good,
    label: "Ổn",
    className: "border-recall-line bg-white text-recall hover:bg-recall-quiet hover:border-recall",
  },
  {
    rating: Rating.Easy,
    label: "Dễ",
    className: "border-recall-line bg-recall-quiet text-recall hover:bg-recall-quiet hover:border-recall",
  },
] as const;
