// LF3: trạng thái flashcard của chính học viên cho một topic, tính từ các dòng `user_flashcards` của họ.
// Đây là phiên bản TypeScript của hai quy tắc SQL (parity được test trong lf3-memory-check-cards-seen-gate):
//   - unseenCardIds : thẻ active chưa có dòng nào của học viên; memory check chỉ mở khi danh sách này rỗng
//                     (private.lf3_cards_seen_gate_open), bỏ qua last_rating;
//   - unratedCardIds: thẻ active chưa có dòng nào với last_rating >= 3 (Ổn/Dễ), đúng `flashcards_done` của LF1/D4;
//   - dueCardIds    : (LF4) thẻ đã có dòng của học viên và hoặc đã đến hạn FSRS (`next_review_date <= now`) hoặc chưa Ổn/Dễ.
//                     Thẻ chưa xem không bao giờ "đến hạn": chúng đi vào hàng đợi mặc định, không qua lời mời ôn lại.
// Chỉ dòng có `user_id` trùng học viên được tính, vì admin đang hoạt động đọc được dòng của mọi học viên.

export type OwnCardRatingRow = { user_id: string; last_rating: number | null; next_review_date: string | null };

export type CardWithRatings = {
  id: string;
  ratings?: OwnCardRatingRow[] | null;
};

export type CardProgress = {
  unseenCardIds: string[];
  unratedCardIds: string[];
  dueCardIds: string[];
};

export function summarizeOwnCardProgress(
  activeCards: CardWithRatings[],
  userId: string,
  now: Date = new Date(),
): CardProgress {
  const unseenCardIds: string[] = [];
  const unratedCardIds: string[] = [];
  const dueCardIds: string[] = [];
  for (const card of activeCards) {
    // Thiếu mảng ratings là dữ liệu hỏng, không phải "chưa xem": lỗi rõ thay vì khóa nhầm học viên.
    if (!Array.isArray(card.ratings)) {
      throw new Error("Card ratings were not loaded for the learner");
    }
    const own = card.ratings.filter((row) => row.user_id === userId);
    if (own.length === 0) unseenCardIds.push(card.id);
    const rated = own.some((row) => row.last_rating !== null && row.last_rating >= 3);
    if (!rated) unratedCardIds.push(card.id);
    // Ngày hỏng (NaN) so sánh sai nên không làm thẻ "đến hạn" theo FSRS; thẻ chưa Ổn/Dễ vẫn đến hạn theo nhánh còn lại.
    const fsrsDue = own.some((row) => row.next_review_date !== null && new Date(row.next_review_date).getTime() <= now.getTime());
    if (own.length > 0 && (fsrsDue || !rated)) dueCardIds.push(card.id);
  }
  return { unseenCardIds, unratedCardIds, dueCardIds };
}
