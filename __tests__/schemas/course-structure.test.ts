import { describe, expect, it } from "vitest";
import {
  chapterCreateSchema,
  chapterFormSchema,
  chapterMoveDirectionSchema,
  chapterMoveSchema,
  chapterUpdateSchema,
} from "@/lib/schemas/chapter";
import {
  topicCreateSchema,
  topicMoveDirectionSchema,
  topicMoveSchema,
  topicSchema,
  topicUpdateSchema,
} from "@/lib/schemas/topic";

// Test plan:
// - Mục tiêu: kiểm tra schema PR7 cho chapter/topic metadata và payload move up/down.
// - Loại test: schema.
// - Đối tượng: chapterFormSchema, chapterCreateSchema, chapterUpdateSchema, chapterMoveSchema, topicSchema, topicCreateSchema, topicUpdateSchema, topicMoveSchema.
// - Case thành công: trim title, chấp nhận status hợp lệ, và nhận hướng move hợp lệ.
// - Case thất bại: UUID sai, title trắng, status sai, hoặc hướng move sai bị reject.
// - Bảo mật/phân quyền: không áp dụng ở schema; Server Action kiểm tra auth/permission riêng.
// - Ổn định/resilience: client không thể gửi order_index; move chỉ nhận id + direction.
// - Invariant cần giữ: Server Action/RPC là nơi duy nhất tính hoặc đổi order_index.
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
    const createResult = chapterCreateSchema.safeParse({
      courseId: "11111111-1111-4111-8111-111111111111",
      title: "Foundations",
      order_index: 99,
    });

    expect(createResult.success).toBe(true);
    if (createResult.success) {
      expect(createResult.data).toEqual({
        courseId: "11111111-1111-4111-8111-111111111111",
        title: "Foundations",
      });
    }

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
    const createResult = topicCreateSchema.safeParse({
      courseId: "11111111-1111-4111-8111-111111111111",
      chapterId: "22222222-2222-4222-8222-222222222222",
      title: "TOEIC Part 1",
      status: "published",
      order_index: 99,
    });

    expect(createResult.success).toBe(true);
    if (createResult.success) {
      expect(createResult.data).toEqual({
        courseId: "11111111-1111-4111-8111-111111111111",
        chapterId: "22222222-2222-4222-8222-222222222222",
        title: "TOEIC Part 1",
        status: "published",
      });
    }

    expect(
      topicUpdateSchema.safeParse({
        topicId: "33333333-3333-4333-8333-333333333333",
        title: "TOEIC Part 1",
        status: "archived",
      }).success,
    ).toBe(false);
  });

  it("validates chapter and topic move directions", () => {
    expect(chapterMoveDirectionSchema.safeParse("up").success).toBe(true);
    expect(topicMoveDirectionSchema.safeParse("down").success).toBe(true);
    expect(chapterMoveDirectionSchema.safeParse("left").success).toBe(false);
    expect(topicMoveDirectionSchema.safeParse("sideways").success).toBe(false);
  });

  it("validates chapter and topic move payload identifiers", () => {
    expect(
      chapterMoveSchema.safeParse({
        chapterId: "22222222-2222-4222-8222-222222222222",
        direction: "up",
      }).success,
    ).toBe(true);
    expect(
      topicMoveSchema.safeParse({
        topicId: "33333333-3333-4333-8333-333333333333",
        direction: "down",
      }).success,
    ).toBe(true);
    expect(
      chapterMoveSchema.safeParse({
        chapterId: "not-a-uuid",
        direction: "up",
      }).success,
    ).toBe(false);
    expect(
      topicMoveSchema.safeParse({
        topicId: "33333333-3333-4333-8333-333333333333",
        direction: "around",
      }).success,
    ).toBe(false);
  });
});
