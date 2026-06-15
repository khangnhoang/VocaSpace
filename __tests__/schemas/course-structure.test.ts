import { describe, expect, it } from "vitest";
import {
  chapterCreateSchema,
  chapterFormSchema,
  chapterUpdateSchema,
} from "@/lib/schemas/chapter";
import {
  topicCreateSchema,
  topicSchema,
  topicUpdateSchema,
} from "@/lib/schemas/topic";

// Test plan:
// - Mục tiêu: kiểm tra schema PR4 cho chapter/topic metadata không còn nhận order_index từ form.
// - Loại test: schema.
// - Đối tượng: chapterFormSchema, chapterCreateSchema, chapterUpdateSchema, topicSchema, topicCreateSchema, topicUpdateSchema.
// - Case thành công: trim title và chấp nhận status hợp lệ.
// - Case thất bại: UUID sai, title trắng, status sai bị reject.
// - Bảo mật/phân quyền: không áp dụng ở schema; Server Action kiểm tra auth/permission riêng.
// - Ổn định/resilience: client không thể gửi order_index như contract metadata hợp lệ của PR4.
// - Invariant cần giữ: Server Action là nơi duy nhất tính order_index khi tạo chapter/topic.
// - Kết quả verify gần nhất: passed bằng `npm.cmd run test:run -- __tests__/schemas/course-structure.test.ts __tests__/actions/course-structure.test.ts`.

describe("course structure schemas", () => {
  it("accepts trimmed chapter metadata without order input", () => {
    const result = chapterFormSchema.safeParse({
      title: "  Part 1 - Listening  ",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ title: "Part 1 - Listening" });
  });

  it("validates chapter create and update boundary identifiers", () => {
    expect(
      chapterCreateSchema.safeParse({
        courseId: "11111111-1111-4111-8111-111111111111",
        title: "Foundations",
      }).success,
    ).toBe(true);

    expect(
      chapterUpdateSchema.safeParse({
        chapterId: "not-a-uuid",
        title: "Foundations",
      }).success,
    ).toBe(false);
  });

  it("accepts topic title and status metadata without order input", () => {
    const result = topicSchema.safeParse({
      title: "  TOEIC Part 1  ",
      status: "draft",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({ title: "TOEIC Part 1", status: "draft" });
  });

  it("validates topic create and update boundaries", () => {
    expect(
      topicCreateSchema.safeParse({
        courseId: "11111111-1111-4111-8111-111111111111",
        chapterId: "22222222-2222-4222-8222-222222222222",
        title: "TOEIC Part 1",
        status: "published",
      }).success,
    ).toBe(true);

    expect(
      topicUpdateSchema.safeParse({
        topicId: "33333333-3333-4333-8333-333333333333",
        title: "TOEIC Part 1",
        status: "archived",
      }).success,
    ).toBe(false);
  });
});
