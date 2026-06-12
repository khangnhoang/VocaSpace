import { describe, expect, it } from "vitest";
import { AikenParseError, parseAikenToGroups } from "@/lib/utils/aiken-parser";

const validAiken = `Passage: Read the text and answer questions.
[Audio]: https://example.com/audio.mp3
[Image]: https://placehold.co/600x400.png
Q: What is the correct answer?
A. First option
B. Second option
C. Third option
D. Fourth option
ANSWER: B

Q2: Choose the best response.
A) Option A
B) Option B
C) Option C
D) Option D
ANSWER: D`;

function expectAikenError(input: string) {
  try {
    parseAikenToGroups(input);
  } catch (error) {
    expect(error).toBeInstanceOf(AikenParseError);
    return error as AikenParseError;
  }

  throw new Error("Expected AikenParseError");
}

describe("AIKEN bulk parser", () => {
  it("parses valid bulk input successfully", () => {
    const groups = parseAikenToGroups(validAiken);

    expect(groups).toHaveLength(1);
    expect(groups[0].passage_text).toContain("Read the text");
    expect(groups[0].audio_url).toBe("https://example.com/audio.mp3");
    expect(groups[0].image_url).toBe("https://placehold.co/600x400.png");
    expect(groups[0].questions).toHaveLength(2);
    expect(groups[0].questions[0].options.find((option) => option.is_correct)?.content).toBe(
      "Second option",
    );
  });

  it("rejects empty and whitespace-only input without partial payload", () => {
    for (const input of ["", "   \n  "]) {
      const error = expectAikenError(input);
      expect(error.issues[0].line).toBe(1);
      expect(error.issues[0].message).toContain("Không tìm thấy câu hỏi hợp lệ");
    }
  });

  it("rejects missing ANSWER with a line number", () => {
    const error = expectAikenError(`Q: What is the correct answer?
A. First option
B. Second option`);

    expect(error.issues.some((issue) => issue.message.includes("Dòng 1: Thiếu ANSWER"))).toBe(
      true,
    );
  });

  it("rejects answers that do not match any option", () => {
    const error = expectAikenError(`Q: What is the correct answer?
A. First option
B. Second option
C. Third option
D. Fourth option
ANSWER: E`);

    expect(error.issues[0].message).toContain(
      "Dòng 6: Không tìm thấy đáp án đúng trong danh sách lựa chọn",
    );
  });

  it("rejects too few options", () => {
    const error = expectAikenError(`Q: What is the correct answer?
A. First option
ANSWER: A`);

    expect(error.issues[0].message).toContain("Dòng 1: Câu hỏi phải có ít nhất 2 đáp án");
  });

  it("rejects malformed option lines", () => {
    const error = expectAikenError(`Q: What is the correct answer?
First option
B. Second option
ANSWER: B`);

    expect(error.issues[0].message).toContain("Dòng 2: Định dạng dòng không hợp lệ");
  });
});
