import { describe, expect, it } from "vitest";
import { summarizeOwnCardProgress, type CardWithRatings } from "@/lib/card-progress";

// Test plan:
// - Mục tiêu: `summarizeOwnCardProgress` phân loại thẻ active của một học viên thành chưa xem, chưa Ổn/Dễ và đến hạn (LF4 AC5).
// - Loại test: unit.
// - Đối tượng: lib/card-progress.ts.
// - Case thành công: thẻ chưa xem; thẻ Ổn/Dễ chưa đến hạn; thẻ Ổn/Dễ đã quá hạn FSRS; thẻ Lại/Khó dù hạn còn xa; biên thời gian trước/bằng/sau `now`.
// - Case thất bại: thiếu mảng `ratings` ném lỗi rõ; ngày hỏng không làm thẻ đã Ổn/Dễ thành đến hạn.
// - Bảo mật/phân quyền: chỉ dòng của đúng học viên được tính (admin đọc được mọi dòng).
// - Ổn định/resilience: nhiều dòng của cùng học viên không làm trùng id; thẻ chưa xem không bao giờ đến hạn.
// - Invariant cần giữ: đến hạn = đã có dòng của học viên và (next_review_date <= now hoặc chưa có last_rating >= 3).
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/utils/card-progress.test.ts`.
// - Ghi chú: parity với SQL của unseen/unrated nằm ở lf3-memory-check-cards-seen-gate; đến hạn chỉ có ở TypeScript.

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOW = new Date("2026-10-12T10:00:00.000Z");

function card(id: string, ratings: CardWithRatings["ratings"]): CardWithRatings {
  return { id, ratings };
}
function row(lastRating: number | null, nextReviewDate: string | null, userId = USER) {
  return { user_id: userId, last_rating: lastRating, next_review_date: nextReviewDate };
}

describe("summarizeOwnCardProgress due cards", () => {
  it("marks a seen card due at or before now and not after now", () => {
    const result = summarizeOwnCardProgress(
      [
        card("before", [row(3, "2026-10-12T09:59:59.999Z")]),
        card("equal", [row(4, "2026-10-12T10:00:00.000Z")]),
        card("after", [row(3, "2026-10-12T10:00:00.001Z")]),
      ],
      USER,
      NOW,
    );
    expect(result.dueCardIds).toEqual(["before", "equal"]);
    expect(result.unratedCardIds).toEqual([]);
  });

  it("marks a card rated Again or Hard due even when its next review date is far away", () => {
    const result = summarizeOwnCardProgress(
      [card("again", [row(1, "2099-01-01T00:00:00Z")]), card("hard", [row(2, "2099-01-01T00:00:00Z")]), card("good", [row(3, "2099-01-01T00:00:00Z")])],
      USER,
      NOW,
    );
    expect(result.dueCardIds).toEqual(["again", "hard"]);
  });

  it("never marks an unseen card due and counts only the learner's own rows", () => {
    const result = summarizeOwnCardProgress(
      [card("unseen", []), card("foreign", [row(1, "2000-01-01T00:00:00Z", OTHER)]), card("own", [row(1, "2000-01-01T00:00:00Z"), row(1, "2000-01-01T00:00:00Z", OTHER)])],
      USER,
      NOW,
    );
    expect(result.unseenCardIds).toEqual(["unseen", "foreign"]);
    expect(result.dueCardIds).toEqual(["own"]);
  });

  it("does not let a malformed date or a missing date make a Good card due", () => {
    const result = summarizeOwnCardProgress(
      [card("bad-date", [row(3, "not a date")]), card("no-date", [row(4, null)]), card("no-rating", [row(null, "2099-01-01T00:00:00Z")])],
      USER,
      NOW,
    );
    // Chỉ thẻ chưa có last_rating >= 3 đến hạn (nhánh "chưa Ổn/Dễ"), không phải nhờ ngày.
    expect(result.dueCardIds).toEqual(["no-rating"]);
  });

  it("fails loud when the ratings were not loaded for a card", () => {
    expect(() => summarizeOwnCardProgress([{ id: "broken" }], USER, NOW)).toThrow("Card ratings were not loaded for the learner");
  });
});
