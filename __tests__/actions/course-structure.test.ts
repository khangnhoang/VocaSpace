import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createChapter,
  deleteChapter,
  updateChapter,
} from "@/app/actions/chapter";
import {
  createTopic,
  deleteTopic,
  updateTopic,
} from "@/app/actions/topic";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Test plan:
// - Mục tiêu: kiểm tra Server Actions PR4 là boundary validate input và tự append order_index.
// - Loại test: action/unit với Supabase mock.
// - Đối tượng: createChapter, updateChapter, deleteChapter, createTopic, updateTopic, deleteTopic.
// - Case thành công: chapter/topic mới lấy max order server-side rồi insert max + 1; update/delete dùng object payload hợp lệ.
// - Case thất bại: payload sai bị reject trước auth/DB; topic không tạo trong chapter inactive/sai course.
// - Bảo mật/phân quyền: test này xác nhận validate trước DB; RLS/permission thật vẫn do Supabase policy kiểm soát.
// - Ổn định/resilience: soft-deleted rows vẫn được tính trong max order query vì PR4 không normalize ordering.
// - Invariant cần giữ: client không gửi order_index, Server Action là source of truth cho append.
// - Kết quả verify gần nhất: passed bằng `npm.cmd run test:run -- __tests__/schemas/course-structure.test.ts __tests__/actions/course-structure.test.ts`.

const mockedCreateClient = vi.mocked(createClient);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const courseId = "11111111-1111-4111-8111-111111111111";
const chapterId = "22222222-2222-4222-8222-222222222222";
const topicId = "33333333-3333-4333-8333-333333333333";
const teacherId = "44444444-4444-4444-8444-444444444444";

function authClient(queues: Record<string, unknown[]>) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: teacherId, email: "teacher@example.com" } },
      }),
    },
    from: vi.fn((table: string) => {
      const queue = queues[table];
      if (!queue?.length) {
        throw new Error(`Unexpected table query: ${table}`);
      }
      return queue.shift();
    }),
  };
}

function mockCreateClient(client: unknown) {
  mockedCreateClient.mockResolvedValueOnce(
    client as Awaited<ReturnType<typeof createClient>>,
  );
}

function maxOrderQuery(orderIndex: number | null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: orderIndex === null ? null : { order_index: orderIndex },
      error: null,
    }),
  };
}

function insertQuery(data: Record<string, unknown>) {
  return {
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

function updateQuery(data: Record<string, unknown>) {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

function activeChapterQuery(found = true) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: found ? { id: chapterId } : null,
      error: found ? null : { code: "PGRST116", message: "not found" },
    }),
  };
}

describe("course structure actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid chapter creation input before auth or database access", async () => {
    const result = await createChapter({
      courseId: "not-a-course-id",
      title: "  ",
    });

    expect(result.error).toBe("ID khóa học không hợp lệ.");
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("creates chapters with the next server-side order across all rows", async () => {
    const maxQuery = maxOrderQuery(7);
    const created = {
      id: chapterId,
      course_id: courseId,
      title: "Intro",
      order_index: 8,
      created_at: "2026-06-15T00:00:00.000Z",
      updated_at: "2026-06-15T00:00:00.000Z",
      removed_at: null,
    };
    const createQuery = insertQuery(created);
    mockCreateClient(authClient({ chapters: [maxQuery, createQuery] }));

    const result = await createChapter({ courseId, title: " Intro " });

    expect(result.success).toBe(true);
    expect(createQuery.insert).toHaveBeenCalledWith({
      course_id: courseId,
      title: "Intro",
      order_index: 8,
    });
    expect(maxQuery.eq).toHaveBeenCalledWith("course_id", courseId);
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/courses/${courseId}/structure`);
  });

  it("updates and hides chapters through validated object payloads", async () => {
    const chapterUpdate = updateQuery({
      id: chapterId,
      course_id: courseId,
      title: "Updated",
      order_index: 1,
      created_at: "2026-06-15T00:00:00.000Z",
      updated_at: "2026-06-15T00:00:00.000Z",
      removed_at: null,
    });
    mockCreateClient(authClient({ chapters: [chapterUpdate] }));

    const updateResult = await updateChapter({ chapterId, title: " Updated " });

    expect(updateResult.success).toBe(true);
    expect(chapterUpdate.update).toHaveBeenCalledWith({ title: "Updated" });

    const chapterDelete = updateQuery({ id: chapterId, course_id: courseId });
    mockCreateClient(authClient({ chapters: [chapterDelete] }));

    const deleteResult = await deleteChapter({ chapterId });

    expect(deleteResult.success).toBe(true);
    expect(chapterDelete.update).toHaveBeenCalledWith({
      removed_at: expect.any(String),
    });
  });

  it("creates topics only under an active chapter and appends order server-side", async () => {
    const chapterQuery = activeChapterQuery(true);
    const maxQuery = maxOrderQuery(4);
    const created = {
      id: topicId,
      course_id: courseId,
      chapter_id: chapterId,
      title: "Topic",
      status: "draft",
      order_index: 5,
      created_at: "2026-06-15T00:00:00.000Z",
    };
    const createQuery = insertQuery(created);
    mockCreateClient(authClient({ chapters: [chapterQuery], topics: [maxQuery, createQuery] }));

    const result = await createTopic({
      courseId,
      chapterId,
      title: " Topic ",
      status: "draft",
    });

    expect(result.success).toBe(true);
    expect(chapterQuery.eq).toHaveBeenCalledWith("course_id", courseId);
    expect(maxQuery.eq).toHaveBeenCalledWith("chapter_id", chapterId);
    expect(createQuery.insert).toHaveBeenCalledWith({
      course_id: courseId,
      chapter_id: chapterId,
      title: "Topic",
      status: "draft",
      order_index: 5,
    });
  });

  it("does not create topics under an inactive or mismatched chapter", async () => {
    const chapterQuery = activeChapterQuery(false);
    mockCreateClient(authClient({ chapters: [chapterQuery] }));

    const result = await createTopic({
      courseId,
      chapterId,
      title: "Topic",
      status: "draft",
    });

    expect(result.error).toBe("Không thể thêm bài học vào chương không còn hoạt động.");
  });

  it("updates and hides topics through validated object payloads", async () => {
    const topicUpdate = updateQuery({
      id: topicId,
      course_id: courseId,
      chapter_id: chapterId,
      title: "Updated topic",
      status: "published",
      order_index: 1,
      created_at: "2026-06-15T00:00:00.000Z",
    });
    mockCreateClient(authClient({ topics: [topicUpdate] }));

    const updateResult = await updateTopic({
      topicId,
      title: " Updated topic ",
      status: "published",
    });

    expect(updateResult.success).toBe(true);
    expect(topicUpdate.update).toHaveBeenCalledWith({
      title: "Updated topic",
      status: "published",
    });

    const topicDelete = updateQuery({ id: topicId, course_id: courseId });
    mockCreateClient(authClient({ topics: [topicDelete] }));

    const deleteResult = await deleteTopic({ topicId });

    expect(deleteResult.success).toBe(true);
    expect(topicDelete.update).toHaveBeenCalledWith({
      removed_at: expect.any(String),
    });
  });
});
