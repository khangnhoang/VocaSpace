import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLearningWorkspace } from "@/app/actions/learning-workspace";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: bảo vệ precedence, protected-read boundary, exact topic relation và query budget C2.
// - Loại test: Server Action với Supabase boundary mock.
// - Đối tượng: getLearningWorkspace.
// - Case thành công: enrolled learner nhận ordered syllabus, exact content và topic-scoped history.
// - Case thất bại: malformed/missing route, query failure và malformed aggregate trả state an toàn.
// - Bảo mật/phân quyền: guest/unenrolled dừng trước protected syllabus/topic reads.
// - Ổn định/resilience: wrong-course topic không fallback; output không chứa option correctness.
// - Invariant cần giữ: success path dùng một auth và đúng ba DB requests, không client waterfall.
// - Kết quả verify gần nhất: 36/36 test passed trong focused CP1 Vitest command.

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);

const ids = {
  course: "11111111-1111-4111-8111-111111111111",
  chapter: "22222222-2222-4222-8222-222222222222",
  topic: "33333333-3333-4333-8333-333333333333",
  card: "44444444-4444-4444-8444-444444444444",
  exercise: "55555555-5555-4555-8555-555555555555",
  group: "66666666-6666-4666-8666-666666666666",
  question: "77777777-7777-4777-8777-777777777777",
  option: "88888888-8888-4888-8888-888888888888",
  enrollment: "99999999-9999-4999-8999-999999999999",
};

const user = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
const course = {
  id: ids.course,
  slug: "toeic-nen-tang",
  title: "TOEIC nền tảng",
  enrollments: [{ id: ids.enrollment, user_id: user.id }],
};
const chapter = {
  id: ids.chapter,
  title: "Chương 1",
  order_index: 1,
  course_id: ids.course,
  removed_at: null,
  topics: [
    {
      id: ids.topic,
      slug: "bai-1",
      title: "Bài 1",
      status: "published",
      order_index: 1,
      chapter_id: ids.chapter,
      course_id: ids.course,
      removed_at: null,
    },
  ],
};
const topic = {
  ...chapter.topics[0],
  chapter: {
    id: ids.chapter,
    course_id: ids.course,
    removed_at: null,
  },
  cards: [
    {
      id: ids.card,
      topic_id: ids.topic,
      front_content: { word: "reliable" },
      back_content: { translation: "đáng tin cậy" },
      audio_url: null,
      image_url: null,
      order_index: 1,
      removed_at: null,
    },
  ],
  progress: [
    {
      topic_id: ids.topic,
      is_flashcard_completed: true,
      is_exercise_completed: false,
      is_topic_completed: false,
    },
  ],
  exercises: [
    {
      id: ids.exercise,
      topic_id: ids.topic,
      course_id: ids.course,
      title: "Bài tập",
      part_type: "single-choice",
      order_index: 1,
      removed_at: null,
      groups: [
        {
          id: ids.group,
          exercise_id: ids.exercise,
          passage_text: null,
          audio_url: null,
          image_url: null,
          order_index: 1,
          removed_at: null,
          questions: [
            {
              id: ids.question,
              exercise_id: ids.exercise,
              course_id: ids.course,
              content: "Chọn đáp án đúng",
              explanation: "Giải thích",
              order_index: 1,
              removed_at: null,
              options: [
                {
                  id: ids.option,
                  question_id: ids.question,
                  content: "Đáp án A",
                  label: "A",
                  is_correct: true,
                  order_index: 1,
                  removed_at: null,
                },
              ],
              answers: [
                { selected_option_id: ids.option, is_correct: true },
              ],
            },
          ],
        },
      ],
    },
  ],
};

function singleQuery(data: unknown, error: unknown = null) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is"]) {
    query[method] = vi.fn(() => query);
  }
  query.maybeSingle = vi.fn().mockResolvedValue({ data, error });
  return query;
}

function rowsQuery(data: unknown[], error: unknown = null) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is"]) {
    query[method] = vi.fn(() => query);
  }
  query.then = (
    resolve: (value: { data: unknown[]; error: unknown }) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise.resolve({ data, error }).then(resolve, reject);
  return query;
}

function mockSupabase({
  currentUser = user,
  authError = null,
  queries = {},
}: {
  currentUser?: typeof user | null;
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
        data: { user: currentUser },
        error: authError,
      }),
    },
    from,
  } as never);
  return from;
}

describe("getLearningWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid course syntax before creating a database client", async () => {
    await expect(
      getLearningWorkspace("BAD COURSE", "bad/topic"),
    ).resolves.toEqual({ status: "not_found" });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("requires authentication before classifying an invalid topic", async () => {
    const from = mockSupabase({ currentUser: null });

    await expect(
      getLearningWorkspace(course.slug, "bad/topic"),
    ).resolves.toEqual({ status: "auth_required" });
    expect(from).not.toHaveBeenCalled();
  });

  it("lets missing course and unenrolled states win before child classification", async () => {
    let from = mockSupabase({
      queries: { courses: singleQuery(null) },
    });
    await expect(
      getLearningWorkspace(course.slug, "bad/topic"),
    ).resolves.toEqual({ status: "not_found" });
    expect(from).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    from = mockSupabase({
      queries: {
        courses: singleQuery({ ...course, enrollments: [] }),
      },
    });
    await expect(
      getLearningWorkspace(course.slug, "bad/topic"),
    ).resolves.toEqual({
      status: "unenrolled",
      course: { slug: course.slug, title: course.title },
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["courses"]);
  });

  it("returns topic unavailable without protected reads for enrolled malformed input", async () => {
    const from = mockSupabase({
      queries: { courses: singleQuery(course) },
    });

    await expect(
      getLearningWorkspace(course.slug, "bad/topic"),
    ).resolves.toEqual({
      status: "topic_unavailable",
      course: { slug: course.slug, title: course.title },
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["courses"]);
  });

  it("does not fall back when the exact enrolled topic is unavailable", async () => {
    const from = mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters: rowsQuery([chapter]),
        topics: singleQuery(null),
      },
    });

    await expect(
      getLearningWorkspace(course.slug, "khong-ton-tai"),
    ).resolves.toEqual({
      status: "topic_unavailable",
      course: { slug: course.slug, title: course.title },
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "courses",
      "chapters",
      "topics",
    ]);
  });

  it("returns exact learner-safe content and history within the three-query budget", async () => {
    const from = mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters: rowsQuery([chapter]),
        topics: singleQuery(topic),
      },
    });

    const result = await getLearningWorkspace(course.slug, topic.slug);

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.currentTopic.slug).toBe(topic.slug);
    expect(result.data.syllabus[0].topics[0].slug).toBe(topic.slug);
    expect(result.data.answers).toEqual({ [ids.question]: ids.option });
    expect(result.data.progress?.isFlashcardCompleted).toBe(true);
    expect(result.data.exercises[0].groups[0].questions[0].options[0]).toEqual({
      id: ids.option,
      content: "Đáp án A",
      label: "A",
      order_index: 1,
    });
    expect(
      result.data.exercises[0].groups[0].questions[0].options[0],
    ).not.toHaveProperty("is_correct");
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "courses",
      "chapters",
      "topics",
    ]);
  });

  it("rejects a mismatched parent chain without serializing content", async () => {
    const from = mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters: rowsQuery([chapter]),
        topics: singleQuery({
          ...topic,
          chapter: { ...topic.chapter, course_id: ids.topic },
        }),
      },
    });

    await expect(
      getLearningWorkspace(course.slug, topic.slug),
    ).resolves.toEqual({
      status: "topic_unavailable",
      course: { slug: course.slug, title: course.title },
    });
    expect(from).toHaveBeenCalledTimes(3);
  });
});
