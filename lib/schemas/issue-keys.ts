import { z } from "zod";

// Lỗi sai kiểu (ví dụ FormData thiếu trường trả `null`, hoặc object bị thiếu) trước đây hiện nguyên văn Zod "Invalid input:
// expected string, received null". Giữ đúng văn bản đó làm giá trị tiếng Việt, nhưng đi qua catalog: message là `khóa|kiểu nhận
// được` để mọi kiểu nhận được cho ra đúng văn bản cũ (U2 G2).
//
// Kiểu nhận được lấy từ chính bộ định dạng tiếng Anh của Zod (cùng bộ mà message mặc định dùng) thay vì `getParsedType`: hai hàm
// khác nhau ở File, Date, NaN và Infinity, nên tự dựng bảng riêng sẽ làm đổi văn bản cũ.
const zodEnglish = z.locales.en();

function receivedType(input: unknown): string {
  const text = zodEnglish.localeError({ code: "invalid_type", expected: "string", input } as Parameters<
    typeof zodEnglish.localeError
  >[0]);
  const marker = "received ";
  return typeof text === "string" ? text.slice(text.lastIndexOf(marker) + marker.length) : String(text?.message);
}

export function wrongType(expected: "string" | "object") {
  return (issue: { input?: unknown }) => `zodType.${expected}|${receivedType(issue.input)}`;
}
