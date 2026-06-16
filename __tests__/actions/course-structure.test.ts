import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createChapter,
  deleteChapter,
  updateChapter,
} from "@/app/actions/chapter";
import {
  createTopic,
  deleteTopic,
  getCourseStats,
  getTopicsByChapterId,
  updateTopic,
  verifyTopicAuthoringContext,
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
// - Mục tiêu: kiểm tra Server Actions PR4 là boundary validate input, tự append order_index, authoring permission, unavailable context, và lỗi read không fail-open.
// - Loại test: action/unit với Supabase mock.
// - Đối tượng: createChapter, updateChapter, deleteChapter, createTopic, updateTopic, deleteTopic, verifyTopicAuthoringContext, getCourseStats, getTopicsByChapterId.
// - Case thành công: chapter/topic mới lấy max order server-side rồi insert max + 1; update/delete dùng object payload hợp lệ.
// - Case thất bại: payload sai bị reject trước auth/DB; topic không tạo trong chapter inactive/sai course; unavailable topic không bị log như unexpected error; stats/list query failures trả lỗi thay vì dữ liệu giả.
// - Bảo mật/phân quyền: topic authoring guard phải yêu cầu has_course_management_access trước khi đọc context topic và phân biệt forbidden với query failure.
// - Ổn định/resilience: soft-deleted rows vẫn được tính trong max order query vì PR4 không normalize ordering.
// - Invariant cần giữ: client không gửi order_index, Server Action là source of truth cho append.
// - Kết quả verify gần nhất: passed bằng `npm.cmd run test:run -- __tests__/actions/course-structure.test.ts __tests__/components/course-workspace-routes.test.tsx`.

const mockedCreateClient = vi.mocked(createClient);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const courseId = "11111111-1111-4111-8111-111111111111";
const chapterId = "22222222-2222-4222-8222-222222222222";
const topicId = "33333333-3333-4333-8333-333333333333";
const teacherId = "44444444-4444-4444-8444-444444444444";

type MockQueryError = { code?: string; message: string };

function authClient(
  queues: Record<string, unknown[]>,
  rpcResult: { data: boolean | null; error: MockQueryError | null } = {
    data: true,
    error: null,
  },
) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: teacherId, email: "teacher@example.com" } },
      }),
    },
    rpc: vi.fn().mockResolvedValue(rpcResult),
    from: vi.fn((table: string) => {
      const queue = queues[table];
      if (!queue?.length) {
        throw new Error(`Unexpected table query: ${table}`);
      }
      return queue.shift();
    }),
  };
}

function awaitableListQuery(result: {
  data: unknown[] | null;
  count?: number | null;
  error: MockQueryError | null;
}) {
  const resolved = Promise.resolve(result);
  const query: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    is: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    then: typeof resolved.then;
  } = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    then: resolved.then.bind(resolved),
  };

  return query;
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

function topicContextQuery(found = true) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: found
        ? {
            id: topicId,
            title: "Topic",
            course_id: courseId,
            removed_at: null,
            chapters: {
              id: chapterId,
              course_id: courseId,
              removed_at: null,
            },
          }
        : null,
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

  it("validates topic authoring context against active topic and active parent chapter", async () => {
    const contextQuery = topicContextQuery(true);
    const client = authClient({ topics: [contextQuery] });
    mockCreateClient(client);

    const result = await verifyTopicAuthoringContext({ courseId, topicId });

    expect(result.isValid).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith("has_course_management_access", {
      target_course_id: courseId,
    });
    expect(contextQuery.eq).toHaveBeenCalledWith("id", topicId);
    expect(contextQuery.eq).toHaveBeenCalledWith("course_id", courseId);
    expect(contextQuery.eq).toHaveBeenCalledWith("chapters.course_id", courseId);
    expect(contextQuery.is).toHaveBeenCalledWith("removed_at", null);
    expect(contextQuery.is).toHaveBeenCalledWith("chapters.removed_at", null);

    const inactiveContextQuery = topicContextQuery(false);
    mockCreateClient(authClient({ topics: [inactiveContextQuery] }));

    const inactiveResult = await verifyTopicAuthoringContext({ courseId, topicId });
    expect(inactiveResult).toEqual({
      isValid: false,
      reason: "unavailable",
      error: "Bài học không còn khả dụng trong cấu trúc hiện tại của khóa học.",
    });
  });

  it("denies topic authoring context when the actor lacks course management access", async () => {
    const client = authClient(
      {},
      {
        data: false,
        error: null,
      },
    );
    mockCreateClient(client);

    const result = await verifyTopicAuthoringContext({ courseId, topicId });

    expect(result).toEqual({
      isValid: false,
      reason: "forbidden",
      error: "Bạn không có quyền chỉnh sửa khóa học này.",
    });
    expect(client.rpc).toHaveBeenCalledWith("has_course_management_access", {
      target_course_id: courseId,
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("classifies unavailable topic authoring context without logging expected no-row results", async () => {
    const contextQuery = topicContextQuery(false);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateClient(authClient({ topics: [contextQuery] }));

    const result = await verifyTopicAuthoringContext({ courseId, topicId });

    expect(result).toEqual({
      isValid: false,
      reason: "unavailable",
      error: "Bài học không còn khả dụng trong cấu trúc hiện tại của khóa học.",
    });
    expect(consoleError).not.toHaveBeenCalledWith(
      "[TOPIC CONTEXT ERROR]:",
      expect.anything(),
    );

    consoleError.mockRestore();
  });

  it("keeps unexpected topic authoring context failures observable", async () => {
    const contextQuery = topicContextQuery(false);
    contextQuery.single.mockResolvedValueOnce({
      data: null,
      error: { code: "50000", message: "database unavailable" },
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateClient(authClient({ topics: [contextQuery] }));

    const result = await verifyTopicAuthoringContext({ courseId, topicId });

    expect(result).toEqual({
      isValid: false,
      reason: "error",
      error: "Không thể kiểm tra trạng thái bài học. Vui lòng thử lại.",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[TOPIC CONTEXT ERROR]:",
      expect.objectContaining({ code: "50000" }),
    );

    consoleError.mockRestore();
  });

  it("keeps unexpected topic authoring access failures observable", async () => {
    const client = authClient(
      {},
      {
        data: null,
        error: { code: "50000", message: "rpc unavailable" },
      },
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mockCreateClient(client);

    const result = await verifyTopicAuthoringContext({ courseId, topicId });

    expect(result).toEqual({
      isValid: false,
      reason: "error",
      error: "Không thể kiểm tra quyền chỉnh sửa khóa học. Vui lòng thử lại.",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[TOPIC CONTEXT ACCESS ERROR]:",
      expect.objectContaining({ code: "50000" }),
    );

    consoleError.mockRestore();
  });

  it("propagates course stats query failures instead of returning false zero counts", async () => {
    mockCreateClient(
      authClient({
        chapters: [
          awaitableListQuery({
            data: null,
            count: null,
            error: { code: "42501", message: "permission denied" },
          }),
        ],
      }),
    );

    const result = await getCourseStats(courseId);

    expect(result).toEqual({
      error: "Bạn không có quyền xem thống kê của khóa học này.",
    });
  });

  it("distinguishes empty topic lists from chapter lookup failures", async () => {
    const chapterQuery = activeChapterQuery(false);
    mockCreateClient(authClient({ chapters: [chapterQuery] }));

    const missingChapterResult = await getTopicsByChapterId(chapterId);

    expect(missingChapterResult).toEqual({
      error:
        "Chương không còn hoạt động hoặc bạn không có quyền xem bài học.",
    });

    const activeChapter = activeChapterQuery(true);
    const emptyTopics = awaitableListQuery({
      data: [],
      count: null,
      error: null,
    });
    mockCreateClient(
      authClient({ chapters: [activeChapter], topics: [emptyTopics] }),
    );

    const emptyTopicsResult = await getTopicsByChapterId(chapterId);

    expect(emptyTopicsResult).toEqual({ data: [] });
  });
});
