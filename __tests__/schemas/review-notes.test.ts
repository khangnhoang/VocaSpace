import { describe, expect, it } from "vitest";
import {
  createReviewNoteSchema,
  removeReviewNoteSchema,
  reviewNoteSchema,
  topicReviewNoteSchema,
  updateReviewNoteSchema,
} from "@/lib/schemas/review-notes";

// Test plan:
// - Mục tiêu: kiểm tra contract Zod của `review_notes` — body, đích gắn, field server-owned và DTO đọc.
// - Loại test: schema/unit.
// - Đối tượng: createReviewNoteSchema, updateReviewNoteSchema, removeReviewNoteSchema, reviewNoteSchema, topicReviewNoteSchema.
// - Case thành công: note cấp topic, note gắn đúng một card hoặc một exercise, body được trim.
// - Case thất bại: body rỗng/toàn khoảng trắng/quá 2000 ký tự, cardId + exerciseId cùng lúc, unknown key,
//   và id không phải uuid đều bị chặn.
// - Bảo mật/phân quyền: `authorUserId` KHÔNG tồn tại trong contract — client không gửi được tác giả.
// - Ổn định/resilience: DTO đọc chấp nhận `removedAt`/`removedBy` null cho note chưa xoá và object cho tombstone.
// - Invariant cần giữ: note không mang verdict; contract chỉ mô tả nội dung + đích, không mô tả trạng thái duyệt.
// - Kết quả verify gần nhất: passed (8 test) bằng `npx vitest run __tests__/schemas/review-notes.test.ts`.

const topicId = "11111111-1111-4111-8111-111111111111";
const cardId = "22222222-2222-4222-8222-222222222222";
const exerciseId = "33333333-3333-4333-8333-333333333333";
const noteId = "44444444-4444-4444-8444-444444444444";
const userId = "55555555-5555-4555-8555-555555555555";

describe("review notes schemas", () => {
  it("accepts a topic-level note and trims the body", () => {
    const parsed = createReviewNoteSchema.safeParse({ topicId, body: "  Cần thêm ví dụ.  " });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.body).toBe("Cần thêm ví dụ.");
      expect(parsed.data.cardId).toBeUndefined();
      expect(parsed.data.exerciseId).toBeUndefined();
    }
  });

  it("accepts exactly one target and rejects two targets at once", () => {
    expect(createReviewNoteSchema.safeParse({ topicId, cardId, body: "Sai phiên âm." }).success).toBe(true);
    expect(createReviewNoteSchema.safeParse({ topicId, exerciseId, body: "Thiếu đáp án." }).success).toBe(true);

    const dual = createReviewNoteSchema.safeParse({ topicId, cardId, exerciseId, body: "Hai đích." });
    expect(dual.success).toBe(false);
    if (!dual.success) {
      expect(dual.error.issues[0]?.message)
        .toBe("Ghi chú chỉ được gắn vào một flashcard hoặc một bài tập.");
    }
  });

  it("rejects blank and oversized bodies", () => {
    expect(createReviewNoteSchema.safeParse({ topicId, body: "" }).success).toBe(false);
    expect(createReviewNoteSchema.safeParse({ topicId, body: "   " }).success).toBe(false);
    expect(createReviewNoteSchema.safeParse({ topicId, body: "x".repeat(2001) }).success).toBe(false);
    expect(createReviewNoteSchema.safeParse({ topicId, body: "x".repeat(2000) }).success).toBe(true);
  });

  it("never accepts a client-supplied author", () => {
    const spoofed = createReviewNoteSchema.safeParse({ topicId, body: "Giả danh.", authorUserId: userId });
    expect(spoofed.success).toBe(false);
    expect(JSON.stringify(createReviewNoteSchema.shape)).not.toContain("authorUserId");
  });

  it("rejects unknown keys on every write schema", () => {
    expect(createReviewNoteSchema.safeParse({ topicId, body: "Hợp lệ.", extra: 1 }).success).toBe(false);
    expect(updateReviewNoteSchema.safeParse({ noteId, body: "Hợp lệ.", extra: 1 }).success).toBe(false);
    expect(removeReviewNoteSchema.safeParse({ noteId, extra: 1 }).success).toBe(false);
  });

  it("requires uuids for note and topic ids", () => {
    expect(updateReviewNoteSchema.safeParse({ noteId: "not-a-uuid", body: "Nội dung." }).success).toBe(false);
    expect(removeReviewNoteSchema.safeParse({ noteId: "not-a-uuid" }).success).toBe(false);
    expect(createReviewNoteSchema.safeParse({ topicId: "not-a-uuid", body: "Nội dung." }).success).toBe(false);
  });

  it("describes a live note and a tombstone in the read DTO", () => {
    const live = reviewNoteSchema.safeParse({
      id: noteId,
      topicId,
      cardId,
      exerciseId: null,
      author: { userId, fullName: "Reviewer", email: "reviewer@example.com", avatarUrl: null },
      body: "Nội dung.",
      createdAt: "2026-09-17T06:00:00.000Z",
      updatedAt: "2026-09-17T06:00:00.000Z",
      isEdited: false,
      removedAt: null,
      removedBy: null,
    });
    expect(live.success).toBe(true);

    const tombstone = topicReviewNoteSchema.safeParse({
      id: noteId,
      topicId,
      cardId: null,
      exerciseId,
      author: { userId, fullName: null, email: null, avatarUrl: null },
      body: "Nội dung.",
      createdAt: "2026-09-17T06:00:00.000Z",
      updatedAt: "2026-09-17T07:00:00.000Z",
      isEdited: true,
      removedAt: "2026-09-17T07:00:00.000Z",
      removedBy: { userId, fullName: "Reviewer", email: "reviewer@example.com", avatarUrl: null },
      cardTitle: null,
      exerciseTitle: "Bài tập 5",
    });
    expect(tombstone.success).toBe(true);
    if (tombstone.success) {
      expect(tombstone.data.exerciseTitle).toBe("Bài tập 5");
      expect(tombstone.data.cardTitle).toBeNull();
    }
  });

  it("requires the target-label fields on the read DTO", () => {
    const missingLabels = topicReviewNoteSchema.safeParse({
      id: noteId,
      topicId,
      cardId: null,
      exerciseId: null,
      author: { userId, fullName: null, email: null, avatarUrl: null },
      body: "Nội dung.",
      createdAt: "2026-09-17T06:00:00.000Z",
      updatedAt: "2026-09-17T06:00:00.000Z",
      isEdited: false,
      removedAt: null,
      removedBy: null,
    });
    expect(missingLabels.success).toBe(false);
  });
});
