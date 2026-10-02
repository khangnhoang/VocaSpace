import { describe, expect, it } from "vitest";
import { memoryCheckQuestionSchema } from "@/lib/schemas/exercise";

// Test plan:
// - Mục tiêu: giữ payload câu memory check (D3) tách khỏi exercise TOEIC.
// - Case thành công: câu có ≥2 đáp án không rỗng và ≥1 đáp án đúng; giải thích tùy chọn.
// - Case thất bại: thiếu nội dung, thiếu đáp án (đáp án trắng không tính), không có đáp án đúng, có part_type hoặc nhóm câu.
// - Invariant cần giữ: memory check không mang TOEIC part (G1).

const valid = {
  content: "\"progress\" nghĩa là gì?",
  options: [
    { content: "tiến độ", is_correct: true },
    { content: "tiền lương", is_correct: false },
  ],
};

describe("memoryCheckQuestionSchema", () => {
  it("accepts a question with two options, one correct and an optional explanation", () => {
    expect(memoryCheckQuestionSchema.safeParse(valid).success).toBe(true);
    expect(memoryCheckQuestionSchema.safeParse({ ...valid, explanation: "tiến độ" }).success).toBe(true);
  });

  it.each([
    ["blank content", { ...valid, content: "   " }, "Vui lòng nhập nội dung câu hỏi"],
    [
      "one non-blank option",
      { ...valid, options: [{ content: "tiến độ", is_correct: true }, { content: "  ", is_correct: false }] },
      "Phải có ít nhất 2 đáp án",
    ],
    [
      "no correct option",
      { ...valid, options: [{ content: "A", is_correct: false }, { content: "B", is_correct: false }] },
      "Phải chọn nhất 1 đáp án đúng",
    ],
    [
      "a correct option that is blank",
      { ...valid, options: [{ content: " ", is_correct: true }, { content: "A", is_correct: false }, { content: "B", is_correct: false }] },
      "Phải chọn nhất 1 đáp án đúng",
    ],
  ])("rejects %s", (_label, payload, message) => {
    const result = memoryCheckQuestionSchema.safeParse(payload);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(message);
  });

  it.each([
    ["part_type", { ...valid, part_type: "part5" }],
    ["group fields", { ...valid, passage_text: "passage" }],
  ])("rejects %s", (_label, payload) => {
    const result = memoryCheckQuestionSchema.safeParse(payload);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].code).toBe("unrecognized_keys");
  });
});
