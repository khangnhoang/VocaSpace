import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthSessionMissingError } from "@supabase/supabase-js";
import { getEnrolledCourseOverview } from "@/app/actions/enrolled-course-overview";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: bảo vệ access classification, protected-read boundary và DTO tổng quan course.
// - Loại test: Server Action với Supabase boundary mock.
// - Đối tượng: getEnrolledCourseOverview.
// - Case thành công: enrolled learner nhận ordered progress projection đầy đủ, kể cả dữ liệu phân trang.
// - Case thất bại: invalid/missing course, auth/query failure và malformed output trả state an toàn.
// - Bảo mật/phân quyền: unenrolled learner dừng trước chapter/topic/progress reads.
// - Ổn định/resilience: output/query error không rò Supabase/Zod detail và không silent truncate 501 topics.
// - Invariant cần giữ: chỉ parsed slug và current authenticated user tham gia trusted queries.
// - Kết quả verify gần nhất: passed trong focused CP3 action/helper regression command.

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);

const course = {
  id: "course-one",
  slug: "toeic-nen-tang",
  title: "TOEIC nền tảng",
  thumbnail_url: null,
};

const chapter = {
  id: "chapter-one",
  course_id: course.id,
  title: "Chương 1",
  order_index: 1,
  removed_at: null,
};

const topics = [
  {
    id: "topic-two",
    course_id: course.id,
    chapter_id: chapter.id,
    title: "Bài 2",
    slug: "bai-2",
    order_index: 2,
    status: "published",
    removed_at: null,
  },
  {
    id: "topic-one",
    course_id: course.id,
    chapter_id: chapter.id,
    title: "Bài 1",
    slug: "bai-1",
    order_index: 1,
    status: "published",
    removed_at: null,
  },
];

function createSingleQuery(data: unknown, error: unknown = null) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is"]) {
    query[method] = vi.fn(() => query);
  }
  query.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  return query;
}

function createRowsQuery(data: unknown[] = [], error: unknown = null) {
  const query: Record<string, unknown> = {};
  let rangeFrom = 0;
  let rangeTo = Number.MAX_SAFE_INTEGER;
  for (const method of ["select", "eq", "in", "is", "order"]) {
    query[method] = vi.fn(() => query);
  }
  query.range = vi.fn((from: number, to: number) => {
    rangeFrom = from;
    rangeTo = to;
    return query;
  });
  query.then = (
    resolve: (value: { data: unknown[]; error: unknown }) => unknown,
    reject: (reason: unknown) => unknown,
  ) =>
    Promise.resolve({
      data: error ? [] : data.slice(rangeFrom, rangeTo + 1),
      error,
    }).then(resolve, reject);
  return query;
}

function mockSupabase({
  user = { id: "user-one" },
  authError = null,
  queries = {},
}: {
  user?: { id: string } | null;
  authError?: unknown;
  queries?: Record<string, Record<string, unknown>>;
} = {}) {
  const from = vi.fn((table: string) => {
    const query = queries[table];
    if (!query) throw new Error(`Unexpected table query: ${table}`);
    return query;
  });
  mockedCreateClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: authError,
      }),
    },
    from,
  } as never);
  return from;
}

describe("getEnrolledCourseOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["UPPERCASE", "bad slug", "bad/slug", "ab"])(
    "returns not-found for invalid slug %s before creating a database client",
    async (slug) => {
      await expect(getEnrolledCourseOverview(slug)).resolves.toEqual({
        status: "not_found",
      });
      expect(mockedCreateClient).not.toHaveBeenCalled();
    },
  );

  it("requires authentication before querying course data", async () => {
    const from = mockSupabase({ user: null });

    await expect(
      getEnrolledCourseOverview(course.slug),
    ).resolves.toEqual({ status: "auth_required" });
    expect(from).not.toHaveBeenCalled();
  });

  it("classifies Supabase's missing-session auth error as authentication required", async () => {
    const from = mockSupabase({
      user: null,
      authError: new AuthSessionMissingError(),
    });

    await expect(getEnrolledCourseOverview(course.slug)).resolves.toEqual({
      status: "auth_required",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns a recoverable error when the auth service fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const from = mockSupabase({
      user: null,
      authError: { message: "sensitive auth error" },
    });

    await expect(getEnrolledCourseOverview(course.slug)).resolves.toEqual({
      status: "error",
      errorCode: "QUERY_FAILED",
      error: "Không thể tải tổng quan khóa học lúc này. Vui lòng thử lại.",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns not-found for a missing or learner-invisible course", async () => {
    const from = mockSupabase({
      queries: { courses: createSingleQuery(null) },
    });

    await expect(getEnrolledCourseOverview(course.slug)).resolves.toEqual({
      status: "not_found",
    });
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("courses");
  });

  it("returns a public-safe same-route state without protected reads for an unenrolled learner", async () => {
    const from = mockSupabase({
      queries: {
        courses: createSingleQuery(course),
        enrollments: createSingleQuery(null),
      },
    });

    await expect(getEnrolledCourseOverview(course.slug)).resolves.toEqual({
      status: "unenrolled",
      course: { slug: course.slug, title: course.title },
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "courses",
      "enrollments",
    ]);
  });

  it("returns the B2-ordered progress projection for an enrolled learner", async () => {
    const from = mockSupabase({
      queries: {
        courses: createSingleQuery(course),
        enrollments: createSingleQuery({ id: "enrollment-one" }),
        chapters: createRowsQuery([chapter]),
        topics: createRowsQuery(topics),
        user_topic_progress: createRowsQuery([
          { topic_id: "topic-one", is_topic_completed: true },
        ]),
      },
    });

    await expect(getEnrolledCourseOverview(course.slug)).resolves.toEqual({
      status: "success",
      data: {
        courseSlug: course.slug,
        courseTitle: course.title,
        courseThumbnailUrl: null,
        totalTopicCount: 2,
        completedTopicCount: 1,
        progressPercentage: 50,
        status: "in-progress",
        nextTopic: {
          slug: "bai-2",
          title: "Bài 2",
          chapterTitle: "Chương 1",
        },
        lastTopic: {
          slug: "bai-2",
          title: "Bài 2",
          chapterTitle: "Chương 1",
        },
        chapters: [
          {
            id: chapter.id,
            title: chapter.title,
            topics: [
              {
                id: "topic-one",
                slug: "bai-1",
                title: "Bài 1",
                isCompleted: true,
              },
              {
                id: "topic-two",
                slug: "bai-2",
                title: "Bài 2",
                isCompleted: false,
              },
            ],
          },
        ],
      },
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "courses",
      "enrollments",
      "chapters",
      "topics",
      "user_topic_progress",
    ]);
  });

  it("returns a safe error when a protected content query fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockSupabase({
      queries: {
        courses: createSingleQuery(course),
        enrollments: createSingleQuery({ id: "enrollment-one" }),
        chapters: createRowsQuery([], { message: "sensitive query error" }),
      },
    });

    await expect(getEnrolledCourseOverview(course.slug)).resolves.toEqual({
      status: "error",
      errorCode: "QUERY_FAILED",
      error: "Không thể tải tổng quan khóa học lúc này. Vui lòng thử lại.",
    });
  });

  it("rejects malformed output without exposing validation detail", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockSupabase({
      queries: {
        courses: createSingleQuery({ ...course, title: "" }),
        enrollments: createSingleQuery(null),
      },
    });

    await expect(getEnrolledCourseOverview(course.slug)).resolves.toEqual({
      status: "error",
      errorCode: "INVALID_DATA",
      error: "Dữ liệu tổng quan khóa học không hợp lệ.",
    });
  });

  it("reads every topic page instead of silently truncating the overview", async () => {
    const pagedTopics = Array.from({ length: 501 }, (_, index) => ({
      ...topics[0],
      id: `topic-${index.toString().padStart(3, "0")}`,
      slug: `bai-${index + 1}`,
      title: `Bài ${index + 1}`,
      order_index: index,
    }));
    const topicQuery = createRowsQuery(pagedTopics);
    mockSupabase({
      queries: {
        courses: createSingleQuery(course),
        enrollments: createSingleQuery({ id: "enrollment-one" }),
        chapters: createRowsQuery([chapter]),
        topics: topicQuery,
        user_topic_progress: createRowsQuery(),
      },
    });

    const result = await getEnrolledCourseOverview(course.slug);

    expect(result.status).toBe("success");
    if (result.status === "success") {
      expect(result.data.totalTopicCount).toBe(501);
      expect(result.data.chapters[0].topics).toHaveLength(501);
    }
    expect(topicQuery.range).toHaveBeenNthCalledWith(1, 0, 499);
    expect(topicQuery.range).toHaveBeenNthCalledWith(2, 500, 999);
  });
});
