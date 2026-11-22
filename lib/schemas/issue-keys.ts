import { z } from "zod";

// Lỗi sai kiểu (ví dụ FormData thiếu trường trả `null`, hoặc object bị thiếu) trước đây hiện nguyên văn Zod "Invalid input:
// expected string, received null". Giữ đúng văn bản đó làm giá trị tiếng Việt, nhưng đi qua catalog: message là `khóa|kiểu nhận
// được` để mọi kiểu nhận được (null, undefined, number, array…) cho ra đúng văn bản cũ (U2 G2).
export function wrongType(expected: "string" | "object") {
  return (issue: { input?: unknown }) => `zodType.${expected}|${z.core.util.getParsedType(issue.input)}`;
}
