import { describe, expect, it } from "vitest";
import { courseSchema } from "@/lib/schemas/course";

// Test plan:
// - Mục tiêu: kiểm tra schema course dùng chung cho React Hook Form và Server Action chặn input rỗng/whitespace.
// - Loại test: schema.
// - Đối tượng: courseSchema.
// - Case thành công: payload hợp lệ được trim trước khi submit qua trust boundary.
// - Case thất bại: title/description whitespace-only và slug sai định dạng bị reject.
// - Bảo mật/phân quyền: không áp dụng ở schema; Server Action vẫn kiểm tra auth/permission riêng.
// - Ổn định/resilience: invalid payload không được xem là dữ liệu có nghĩa chỉ vì đủ độ dài bằng khoảng trắng.
// - Invariant cần giữ: client/server cùng dùng một schema để không lệch validation.
// - Kết quả verify gần nhất: passed bằng `npm.cmd run test:run`.

describe("courseSchema", () => {
  it("trims valid course text fields before crossing the submit boundary", () => {
    const result = courseSchema.safeParse({
      title: "  TOEIC Foundation  ",
      slug: "  toeic-foundation  ",
      description: "  Lộ trình nền tảng TOEIC cho người mới.  ",
      price: " 0 ",
      thumbnail_file: null,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      title: "TOEIC Foundation",
      slug: "toeic-foundation",
      description: "Lộ trình nền tảng TOEIC cho người mới.",
      price: "0",
    });
  });

  it("rejects whitespace-only required fields", () => {
    const result = courseSchema.safeParse({
      title: "     ",
      slug: "toeic-basic",
      description: "          ",
      price: "0",
      thumbnail_file: null,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors.title?.[0]).toBe(
      "Tên khóa học phải có ít nhất 5 ký tự",
    );
    expect(result.error.flatten().fieldErrors.description?.[0]).toBe(
      "Mô tả khóa học ít nhất 10 ký tự",
    );
  });

  it("rejects invalid slugs before a course can be created", () => {
    const result = courseSchema.safeParse({
      title: "TOEIC Foundation",
      slug: "TOEIC Foundation",
      description: "Lộ trình nền tảng TOEIC cho người mới.",
      price: "0",
      thumbnail_file: null,
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors.slug?.[0]).toBe(
      "Đường dẫn chỉ được chứa chữ cái thường, số và dấu gạch ngang (VD: toeic-800)",
    );
  });
});
