import { Rating } from "ts-fsrs";
import viFlashcard from "@/messages/vi/flashcard.json";
import { staticTranslate } from "@/lib/i18n/translate";

const viFlashcardText = staticTranslate("flashcard", viFlashcard);

// Nguồn duy nhất của bốn nút tự đánh giá thẻ, dùng chung cho FlashcardStage và ReviewSheet để màu không lệch nhau (LF6 AC5).
// Chỉ phản ánh mức nhớ: Attention cho mức khó hơn, Recall cho mức dễ hơn. Đây không phải tín hiệu đúng/sai nên Growth và
// Correction không dùng ở đây.
// English localization U2: `labelKey` là khóa trong namespace `flashcard` mà màn hình dịch theo ngôn ngữ đang dùng; `label` giữ
// bản tiếng Việt lấy từ catalog để mã và test chỉ cần tên mặc định không phải dựng provider.
export const FLASHCARD_RATINGS = [
  {
    rating: Rating.Again,
    labelKey: "rating.again",
    label: viFlashcardText("rating.again"),
    className: "border-attention-line bg-attention-quiet text-attention hover:bg-attention-quiet hover:border-attention",
  },
  {
    rating: Rating.Hard,
    labelKey: "rating.hard",
    label: viFlashcardText("rating.hard"),
    className: "border-attention-line bg-white text-attention hover:bg-attention-quiet hover:border-attention",
  },
  {
    rating: Rating.Good,
    labelKey: "rating.good",
    label: viFlashcardText("rating.good"),
    className: "border-recall-line bg-white text-recall hover:bg-recall-quiet hover:border-recall",
  },
  {
    rating: Rating.Easy,
    labelKey: "rating.easy",
    label: viFlashcardText("rating.easy"),
    className: "border-recall-line bg-recall-quiet text-recall hover:bg-recall-quiet hover:border-recall",
  },
] as const;
