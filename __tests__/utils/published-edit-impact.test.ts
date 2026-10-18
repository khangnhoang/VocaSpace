import { describe, expect, it } from "vitest";
import {
  describeAnswerImpact,
  getQuestionAnswerImpact,
  hasAnswerImpact,
} from "@/lib/course-authoring/published-edit-impact";

// Test plan:
// - Mục tiêu: xác định khi nào lưu một câu hỏi của bài học đã xuất bản cần cảnh báo (TFEAT1 AC5):
//   chỉ khi bỏ một đáp án đã lưu hoặc đổi đáp án đúng.
// - Loại test: unit thuần cho hàm so sánh bản đã lưu với bản sắp gửi.
// - Case thành công: giữ nguyên đáp án, chỉ sửa chữ, thêm đáp án sai mới → không cảnh báo.
// - Case cảnh báo: xóa đáp án, xóa chữ của đáp án (bị lọc như server), chuyển đáp án đúng sang
//   đáp án khác hoặc sang đáp án mới → có cảnh báo, nội dung nêu học viên phải trả lời lại.
// - Nhiều đáp án đúng: so cả tập id đáp án đúng; bỏ bớt, thêm đáp án đúng, hoặc đáp án đúng mới chưa có id đều cảnh báo;
//   chỉ sửa chữ mà giữ nguyên tập thì không.
// - Invariant cần giữ: so sánh theo id đã lưu, không theo vị trí hay nội dung chữ.

const saved = [
  { id: "a", is_correct: true },
  { id: "b", is_correct: false },
  { id: "c", is_correct: false },
];

describe("getQuestionAnswerImpact", () => {
  it("reports no impact when only wording changes or a wrong option is added", () => {
    const impact = getQuestionAnswerImpact(saved, [
      { id: "a", content: "Chữ mới", is_correct: true },
      { id: "b", content: "B", is_correct: false },
      { id: "c", content: "C", is_correct: false },
      { content: "Đáp án sai mới", is_correct: false },
    ]);

    expect(impact).toEqual({ removedOption: false, correctChanged: false });
    expect(hasAnswerImpact(impact)).toBe(false);
  });

  it("reports a removed option when a saved option is dropped from the edit", () => {
    const impact = getQuestionAnswerImpact(saved, [
      { id: "a", content: "A", is_correct: true },
      { id: "b", content: "B", is_correct: false },
    ]);

    expect(impact).toEqual({ removedOption: true, correctChanged: false });
    expect(describeAnswerImpact(impact)).toBe("Đáp án bị bỏ sẽ không còn hiển thị cho học viên.");
  });

  it("treats an option whose text was cleared as removed because the server filters it", () => {
    const impact = getQuestionAnswerImpact(saved, [
      { id: "a", content: "A", is_correct: true },
      { id: "b", content: "   ", is_correct: false },
      { id: "c", content: "C", is_correct: false },
    ]);

    expect(impact.removedOption).toBe(true);
  });

  it("reports a correct-answer change when another saved option becomes correct", () => {
    const impact = getQuestionAnswerImpact(saved, [
      { id: "a", content: "A", is_correct: false },
      { id: "b", content: "B", is_correct: true },
      { id: "c", content: "C", is_correct: false },
    ]);

    expect(impact).toEqual({ removedOption: false, correctChanged: true });
    expect(describeAnswerImpact(impact)).toContain("phải trả lời lại");
  });

  it("reports a correct-answer change when a brand-new option becomes correct", () => {
    const impact = getQuestionAnswerImpact(saved, [
      { id: "a", content: "A", is_correct: false },
      { id: "b", content: "B", is_correct: false },
      { id: "c", content: "C", is_correct: false },
      { content: "Mới", is_correct: true },
    ]);

    expect(impact.correctChanged).toBe(true);
    expect(impact.removedOption).toBe(false);
  });

  describe("with several correct options", () => {
    const multi = [
      { id: "a", is_correct: true },
      { id: "b", is_correct: true },
      { id: "c", is_correct: false },
    ];

    it("reports a change when a saved correct option stops being correct", () => {
      const impact = getQuestionAnswerImpact(multi, [
        { id: "a", content: "A", is_correct: true },
        { id: "b", content: "B", is_correct: false },
        { id: "c", content: "C", is_correct: false },
      ]);

      expect(impact).toEqual({ removedOption: false, correctChanged: true });
    });

    it("reports a change when another saved option becomes correct as well", () => {
      const impact = getQuestionAnswerImpact(saved, [
        { id: "a", content: "A", is_correct: true },
        { id: "b", content: "B", is_correct: true },
        { id: "c", content: "C", is_correct: false },
      ]);

      expect(impact).toEqual({ removedOption: false, correctChanged: true });
    });

    it("reports a change when a new option without an id is also marked correct", () => {
      const impact = getQuestionAnswerImpact(multi, [
        { id: "a", content: "A", is_correct: true },
        { id: "b", content: "B", is_correct: true },
        { id: "c", content: "C", is_correct: false },
        { content: "Mới", is_correct: true },
      ]);

      expect(impact.correctChanged).toBe(true);
    });

    it("reports no change for a wording-only edit that keeps the same correct set", () => {
      const impact = getQuestionAnswerImpact(multi, [
        { id: "b", content: "B sửa chữ", is_correct: true },
        { id: "a", content: "A sửa chữ", is_correct: true },
        { id: "c", content: "C", is_correct: false },
      ]);

      expect(impact).toEqual({ removedOption: false, correctChanged: false });
    });
  });

  it("reports both effects when the correct option is deleted", () => {
    const impact = getQuestionAnswerImpact(saved, [
      { id: "b", content: "B", is_correct: true },
      { id: "c", content: "C", is_correct: false },
    ]);

    expect(impact).toEqual({ removedOption: true, correctChanged: true });
    expect(describeAnswerImpact(impact)).toContain("Đáp án bị bỏ");
    expect(describeAnswerImpact(impact)).toContain("phải trả lời lại");
  });
});
