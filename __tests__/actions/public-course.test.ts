import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublicCourseCatalog,
  getPublicCourseDetail,
} from "@/app/actions/public-course";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: bảo vệ Server Action catalog/detail công khai và lớp phủ ghi danh/tiến độ của học viên (LF3 AC10).
// - Loại test: unit Server Action với Supabase client mock (RPC, enrollment và user_topic_progress là các chain riêng).
// - Đối tượng: `getPublicCourseCatalog`, `getPublicCourseDetail` và `learner_progress` suy ra từ `buildLearnCourseProgressProjection`.
// - Case thành công: catalog chuẩn hóa; detail cho khách, chưa ghi danh, ghi danh chưa có tiến độ, một phần, xong hết và syllabus rỗng.
// - Case thất bại: slug sai, RPC lỗi/null/lệch contract, lỗi đọc enrollment và lỗi đọc tiến độ đều trả lỗi hoặc not_found, không ra dữ liệu giả.
// - Bảo mật/phân quyền: chỉ đọc hàng `user_topic_progress` của chính người dùng (kể cả admin), không lộ user id trong DTO; khách không đọc bảng nào.
// - Ổn định/resilience: tiến độ đọc theo chunk 100 id; syllabus rỗng bỏ qua lần đọc.
// - Invariant cần giữ: topic tiếp theo chỉ do projection quyết định; khớp với tổng quan khóa học (parity ở integration test riêng).
// - Kết quả verify gần nhất: `npx vitest run __tests__/actions/public-course.test.ts` đạt 20 tests (2026-10-11, sau LF3 CP7); targeted ESLint đạt.

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);
const courseId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

function catalogItem() {
  return {
    id: courseId,
    title: "Public Course",
    slug: "public-course",
    thumbnail_url: null,
    price: "120000",
    created_at: "2026-07-10T10:00:00.000Z",
    enrollment_count: "12",
  };
}

function detailPayload() {
  return {
    ...catalogItem(),
    description: "Public description",
    is_preview_suspended: false,
    owner: null,
    collaborators: [],
    syllabus: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        title: "Empty chapter",
        order_index: 0,
        topics: [],
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        title: "First non-empty chapter",
        order_index: 1,
        topics: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            title: "First topic",
            slug: "first-topic",
            order_index: 0,
            is_preview: true,
          },
          {
            id: "66666666-6666-4666-8666-666666666666",
            title: "Second topic",
            slug: "second-topic",
            order_index: 1,
            is_preview: false,
          },
        ],
      },
      {
        id: "77777777-7777-4777-8777-777777777777",
        title: "Later chapter",
        order_index: 2,
        topics: [
          {
            id: "88888888-8888-4888-8888-888888888888",
            title: "Later topic",
            slug: "later-topic",
            order_index: 0,
            is_preview: false,
          },
        ],
      },
    ],
  };
}

type ClientOptions = {
  rpcData?: unknown;
  rpcError?: unknown;
  user?: { id: string } | null;
  enrollment?: { id: string } | null;
  enrollmentError?: unknown;
  // LF3 AC10: hàng user_topic_progress hoàn thành và lỗi đọc tiến độ.
  progressRows?: { topic_id: string; is_topic_completed: boolean }[];
  progressError?: unknown;
};

function createMockClient(options: ClientOptions = {}) {
  const enrollmentQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  enrollmentQuery.select.mockImplementation(() => enrollmentQuery);
  enrollmentQuery.eq.mockImplementation(() => enrollmentQuery);
  enrollmentQuery.maybeSingle.mockResolvedValue({
    data: options.enrollment ?? null,
    error: options.enrollmentError ?? null,
  });

  const progressQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
  };
  progressQuery.select.mockImplementation(() => progressQuery);
  progressQuery.eq.mockImplementation(() => progressQuery);
  progressQuery.in.mockImplementation(() => progressQuery);
  progressQuery.order.mockImplementation(() => progressQuery);
  progressQuery.range.mockImplementation(() =>
    Promise.resolve(
      options.progressError
        ? { data: null, error: options.progressError }
        : { data: options.progressRows ?? [], error: null },
    ),
  );

  return {
    rpc: vi.fn().mockResolvedValue({
      data: options.rpcData,
      error: options.rpcError ?? null,
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user ?? null },
        error: null,
      }),
    },
    from: vi.fn((table: string) =>
      table === "user_topic_progress" ? progressQuery : enrollmentQuery,
    ),
    enrollmentQuery,
    progressQuery,
  };
}

function mockClient(client: ReturnType<typeof createMockClient>) {
  mockedCreateClient.mockResolvedValueOnce(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
}

describe("public course actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a normalized catalog success result", async () => {
    const client = createMockClient({ rpcData: [catalogItem()] });
    mockClient(client);

    const result = await getPublicCourseCatalog();

    expect(result).toEqual({
      status: "success",
      data: [{ ...catalogItem(), price: 120000, enrollment_count: 12 }],
    });
    expect(client.rpc).toHaveBeenCalledWith("get_public_course_catalog");
  });

  it("preserves an empty catalog as success", async () => {
    mockClient(createMockClient({ rpcData: [] }));
    await expect(getPublicCourseCatalog()).resolves.toEqual({
      status: "success",
      data: [],
    });
  });

  it("does not convert catalog RPC errors into empty data", async () => {
    mockClient(createMockClient({ rpcData: null, rpcError: { message: "db" } }));
    const result = await getPublicCourseCatalog();
    expect(result.status).toBe("error");
    expect("data" in result).toBe(false);
  });

  it("returns a safe error on catalog contract drift", async () => {
    mockClient(
      createMockClient({
        rpcData: [{ ...catalogItem(), enrollment_count: -1 }],
      }),
    );
    await expect(getPublicCourseCatalog()).resolves.toMatchObject({
      status: "error",
    });
  });

  it("rejects an invalid detail slug before creating a database client", async () => {
    await expect(getPublicCourseDetail("bad slug/segment")).resolves.toEqual({
      status: "not_found",
    });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("distinguishes a null detail payload as not found", async () => {
    mockClient(createMockClient({ rpcData: null }));
    await expect(getPublicCourseDetail("public-course")).resolves.toEqual({
      status: "not_found",
    });
  });

  it("returns a recoverable detail error when the RPC fails", async () => {
    mockClient(createMockClient({ rpcError: { message: "db" } }));
    await expect(getPublicCourseDetail("public-course")).resolves.toMatchObject({
      status: "error",
    });
  });

  it("returns a recoverable detail error on protected contract drift", async () => {
    mockClient(
      createMockClient({
        rpcData: { ...detailPayload(), enrollment_user_id: userId },
      }),
    );
    await expect(getPublicCourseDetail("public-course")).resolves.toMatchObject({
      status: "error",
    });
  });

  it("maps persisted Preview eligibility without choosing a topic in the Action", async () => {
    const client = createMockClient({ rpcData: detailPayload() });
    mockClient(client);

    const result = await getPublicCourseDetail("public-course");

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected success result");
    expect(result.data.is_enrolled).toBe(false);
    expect(result.data.owner).toBeNull();
    expect(result.data.collaborators).toEqual([]);
    expect(
      result.data.syllabus.flatMap((chapter) =>
        chapter.topics.map((topic) => topic.is_preview),
      ),
    ).toEqual([true, false, false]);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("overlays only the authenticated user's enrollment state", async () => {
    const client = createMockClient({
      rpcData: detailPayload(),
      user: { id: userId },
      enrollment: { id: "99999999-9999-4999-8999-999999999999" },
    });
    mockClient(client);

    const result = await getPublicCourseDetail("public-course");

    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected success result");
    expect(result.data.is_enrolled).toBe(true);
    expect(client.from).toHaveBeenCalledWith("enrollments");
    expect(client.enrollmentQuery.select).toHaveBeenCalledWith("id");
    expect(client.enrollmentQuery.eq).toHaveBeenNthCalledWith(
      1,
      "course_id",
      courseId,
    );
    expect(client.enrollmentQuery.eq).toHaveBeenNthCalledWith(
      2,
      "user_id",
      userId,
    );
    expect(JSON.stringify(result.data)).not.toContain(userId);
  });

  it("keeps an authenticated unenrolled user on a successful public detail result", async () => {
    const client = createMockClient({
      rpcData: detailPayload(),
      user: { id: userId },
      enrollment: null,
    });
    mockClient(client);

    const result = await getPublicCourseDetail("public-course");

    expect(client.auth.getUser).toHaveBeenCalledOnce();
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("Expected success result");
    expect(result.data.is_enrolled).toBe(false);
    expect(client.enrollmentQuery.maybeSingle).toHaveBeenCalledOnce();
    expect(client.enrollmentQuery.eq).toHaveBeenNthCalledWith(
      1,
      "course_id",
      courseId,
    );
    expect(client.enrollmentQuery.eq).toHaveBeenNthCalledWith(
      2,
      "user_id",
      userId,
    );
  });

  it("returns a recoverable error when enrollment overlay cannot be trusted", async () => {
    mockClient(
      createMockClient({
        rpcData: detailPayload(),
        user: { id: userId },
        enrollmentError: { message: "rls failure" },
      }),
    );
    await expect(getPublicCourseDetail("public-course")).resolves.toMatchObject({
      status: "error",
    });
  });

  describe("enrolled learner progress overlay (LF3 AC10)", () => {
    const firstTopicId = "55555555-5555-4555-8555-555555555555";
    const secondTopicId = "66666666-6666-4666-8666-666666666666";
    const laterTopicId = "88888888-8888-4888-8888-888888888888";

    async function enrolledDetail(options: Partial<ClientOptions> = {}) {
      const client = createMockClient({
        rpcData: detailPayload(),
        user: { id: userId },
        enrollment: { id: "99999999-9999-4999-8999-999999999999" },
        ...options,
      });
      mockClient(client);
      const result = await getPublicCourseDetail("public-course");
      return { client, result };
    }

    it("gives anonymous visitors and not-enrolled learners no progress and no progress read", async () => {
      const anonymous = createMockClient({ rpcData: detailPayload() });
      mockClient(anonymous);
      const anonymousResult = await getPublicCourseDetail("public-course");
      expect(anonymousResult).toMatchObject({
        status: "success",
        data: { is_enrolled: false, learner_progress: null },
      });
      expect(anonymous.from).not.toHaveBeenCalled();

      const unenrolled = createMockClient({
        rpcData: detailPayload(),
        user: { id: userId },
        enrollment: null,
      });
      mockClient(unenrolled);
      const unenrolledResult = await getPublicCourseDetail("public-course");
      expect(unenrolledResult).toMatchObject({
        status: "success",
        data: { is_enrolled: false, learner_progress: null },
      });
      expect(unenrolled.from).not.toHaveBeenCalledWith("user_topic_progress");
    });

    it("marks the first topic next when an enrolled learner has no progress", async () => {
      const { result } = await enrolledDetail({ progressRows: [] });

      expect(result).toMatchObject({
        status: "success",
        data: {
          is_enrolled: true,
          learner_progress: {
            completed_topic_ids: [],
            next_topic_slug: "first-topic",
          },
        },
      });
    });

    it("projects completed topics and the next not-completed topic for partial progress", async () => {
      const { result } = await enrolledDetail({
        progressRows: [{ topic_id: firstTopicId, is_topic_completed: true }],
      });

      expect(result).toMatchObject({
        status: "success",
        data: {
          learner_progress: {
            completed_topic_ids: [firstTopicId],
            next_topic_slug: "second-topic",
          },
        },
      });
    });

    it("has no next topic when every topic is completed", async () => {
      const { result } = await enrolledDetail({
        progressRows: [firstTopicId, secondTopicId, laterTopicId].map(
          (topic_id) => ({ topic_id, is_topic_completed: true }),
        ),
      });

      expect(result).toMatchObject({
        status: "success",
        data: {
          learner_progress: {
            completed_topic_ids: [firstTopicId, secondTopicId, laterTopicId],
            next_topic_slug: null,
          },
        },
      });
    });

    it("has no next topic and skips the progress read for an empty syllabus", async () => {
      const { client, result } = await enrolledDetail({
        rpcData: {
          ...detailPayload(),
          syllabus: [
            {
              id: "33333333-3333-4333-8333-333333333333",
              title: "Empty chapter",
              order_index: 0,
              topics: [],
            },
          ],
        },
      });

      expect(result).toMatchObject({
        status: "success",
        data: {
          is_enrolled: true,
          learner_progress: { completed_topic_ids: [], next_topic_slug: null },
        },
      });
      expect(client.from).not.toHaveBeenCalledWith("user_topic_progress");
    });

    it("reads only the learner's own completed rows for the syllabus topics, even for an admin learner", async () => {
      const { client } = await enrolledDetail({
        user: { id: userId, app_metadata: { role: "admin" } } as { id: string },
      });

      expect(client.from).toHaveBeenCalledWith("user_topic_progress");
      expect(client.progressQuery.select).toHaveBeenCalledWith(
        "topic_id, is_topic_completed",
      );
      expect(client.progressQuery.eq).toHaveBeenCalledWith("user_id", userId);
      expect(client.progressQuery.eq).toHaveBeenCalledWith(
        "is_topic_completed",
        true,
      );
      expect(client.progressQuery.in).toHaveBeenCalledWith("topic_id", [
        firstTopicId,
        secondTopicId,
        laterTopicId,
      ]);
    });

    it("reads progress in id chunks for a long syllabus", async () => {
      const topics = Array.from({ length: 150 }, (_, index) => ({
        id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        title: `Topic ${index}`,
        slug: `topic-${index}`,
        order_index: index,
        is_preview: false,
      }));
      const { client, result } = await enrolledDetail({
        rpcData: {
          ...detailPayload(),
          syllabus: [
            {
              id: "44444444-4444-4444-8444-444444444444",
              title: "Long chapter",
              order_index: 0,
              topics,
            },
          ],
        },
      });

      expect(result.status).toBe("success");
      expect(client.progressQuery.in).toHaveBeenCalledTimes(2);
      expect(client.progressQuery.in.mock.calls[0][1]).toHaveLength(100);
      expect(client.progressQuery.in.mock.calls[1][1]).toHaveLength(50);
    });

    it("fails loud when the progress read fails", async () => {
      const { result } = await enrolledDetail({
        progressError: { message: "rls failure" },
      });

      expect(result).toEqual({
        status: "error",
        error: "Không thể tải thông tin khóa học lúc này. Vui lòng thử lại.",
      });
    });
  });
});
