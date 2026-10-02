import { beforeEach, describe, expect, it, vi } from "vitest";
import { getLearningWorkspace } from "@/app/actions/learning-workspace";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: bảo vệ precedence, protected-read boundary, exact topic relation và query budget C2.
// - Loại test: Server Action với Supabase boundary mock.
// - Đối tượng: getLearningWorkspace.
// - Case thành công: enrolled learner nhận ordered syllabus, exact content, topic-scoped history và private managed-media delivery.
// - Case thất bại: malformed/missing route, query failure và malformed aggregate trả state an toàn.
// - Bảo mật/phân quyền: guest/unenrolled dừng trước protected syllabus/topic reads.
// - Ổn định/resilience: wrong-course topic không fallback; output không chứa option correctness.
// - Invariant cần giữ: success path dùng một auth và đúng ba DB requests, không client waterfall.
// - D3: memory check đi trong cùng topic query; "đã đúng" theo option đang đúng, không theo is_correct đã lưu; option không lộ is_correct.
// - D4: câu standalone (không group) có trong DTO; `answers` của câu exercise cũng theo option đang đúng (G3);
//   câu exercise không gửi `explanation` (lộ đáp án) trước khi trả lời;
//   topic chưa hoàn thành thì gọi RPC `d4_sync_topic_progress` đúng một lần, đã hoàn thành thì không gọi;
//   RPC lỗi lúc tải trang vẫn trả success với progress đã lưu;
//   syllabus đánh dấu `isCompleted` chỉ theo dòng progress đã hoàn thành của chính learner.
// - Kết quả verify gần nhất: 14/14 passed (2026-10-02) bằng `npx vitest run __tests__/actions/learning-workspace.test.ts`.

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
  standalone: "12121212-1212-4212-8212-121212121212",
  standaloneRight: "13131313-1313-4313-8313-131313131313",
  standaloneWrong: "14141414-1414-4414-8414-141414141414",
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
      activity_stage: "exercise",
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
              group_id: ids.group,
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
              answers: [{ selected_option_id: ids.option }],
            },
          ],
        },
      ],
    },
  ],
};
// PostgREST embed `exercises.questions` trả cả câu thuộc group; DTO chỉ giữ câu group_id = null.
const standaloneQuestion = {
  id: ids.standalone,
  exercise_id: ids.exercise,
  group_id: null,
  course_id: ids.course,
  content: "Câu Part 5",
  explanation: "Đáp án đúng là A",
  order_index: 1,
  removed_at: null,
  options: [
    { id: ids.standaloneRight, question_id: ids.standalone, content: "Đúng", label: "A", is_correct: true, order_index: 1, removed_at: null },
    { id: ids.standaloneWrong, question_id: ids.standalone, content: "Sai", label: "B", is_correct: false, order_index: 2, removed_at: null },
  ],
  // Learner chọn option sai: không được tính vào `answers`.
  answers: [{ selected_option_id: ids.standaloneWrong }],
};
Object.assign(topic.exercises[0], {
  questions: [standaloneQuestion, topic.exercises[0].groups[0].questions[0]],
});
const syncedProgress = {
  is_flashcard_completed: true,
  is_memory_check_passed: true,
  is_exercise_completed: false,
  is_topic_completed: false,
  newly_completed: false,
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
  rpc = vi.fn().mockResolvedValue({ data: syncedProgress, error: null }),
}: {
  currentUser?: typeof user | null;
  authError?: unknown;
  queries?: Record<string, Record<string, unknown>>;
  rpc?: ReturnType<typeof vi.fn>;
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
    rpc,
  } as never);
  return Object.assign(from, { rpc });
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
    expect(result.data.exercises[0].questions).toEqual([
      {
        id: ids.standalone,
        content: "Câu Part 5",
        order_index: 1,
        options: [
          { id: ids.standaloneRight, content: "Đúng", label: "A", order_index: 1 },
          { id: ids.standaloneWrong, content: "Sai", label: "B", order_index: 2 },
        ],
      },
    ]);
    expect(result.data.progress).toEqual({
      isFlashcardCompleted: true,
      isExerciseCompleted: false,
      isTopicCompleted: false,
    });
    expect(from.rpc).toHaveBeenCalledTimes(1);
    expect(from.rpc).toHaveBeenCalledWith("d4_sync_topic_progress", { p_topic_id: ids.topic });
    expect(result.data.exercises[0].groups[0].questions[0].options[0]).toEqual({
      id: ids.option,
      content: "Đáp án A",
      label: "A",
      order_index: 1,
    });
    expect(
      result.data.exercises[0].groups[0].questions[0].options[0],
    ).not.toHaveProperty("is_correct");
    // Explanation lộ đáp án nên không gửi trước khi trả lời, kể cả khi DB có giá trị.
    expect(result.data.exercises[0].questions[0]).not.toHaveProperty("explanation");
    expect(result.data.exercises[0].groups[0].questions[0]).not.toHaveProperty("explanation");
    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "courses",
      "chapters",
      "topics",
    ]);
  });

  it("returns the memory check separately and derives passed answers from the current answer key", async () => {
    const memory = {
      exercise: "abababab-abab-4bab-8bab-abababababab",
      first: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd",
      second: "efefefef-efef-4fef-8fef-efefefefefef",
    };
    const option = (questionId: string, suffix: string, isCorrect: boolean) => ({
      id: `${questionId.slice(0, 35)}${suffix}`,
      question_id: questionId,
      content: `Đáp án ${suffix}`,
      label: suffix === "1" ? "A" : "B",
      is_correct: isCorrect,
      order_index: Number(suffix),
      removed_at: null,
    });
    const memoryQuestion = (id: string, order: number, selectedSuffix: string) => ({
      id,
      exercise_id: memory.exercise,
      group_id: null,
      content: `Câu nhớ ${order}`,
      explanation: null,
      order_index: order,
      removed_at: null,
      options: [option(id, "1", true), option(id, "2", false)],
      answers: [{ user_id: user.id, selected_option_id: `${id.slice(0, 35)}${selectedSuffix}` }],
    });
    const memoryTopic = {
      ...topic,
      exercises: [
        ...topic.exercises,
        { ...topic.exercises[0], id: memory.exercise, activity_stage: "memory_check", part_type: null, groups: [] },
      ],
      memory_checks: [{
        id: memory.exercise,
        topic_id: ids.topic,
        activity_stage: "memory_check",
        removed_at: null,
        // Câu 1 chọn option đang đúng; câu 2 chọn option sai (dù learner có tự ghi is_correct).
        questions: [memoryQuestion(memory.first, 1, "1"), memoryQuestion(memory.second, 2, "2")],
      }],
    };
    const from = mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters: rowsQuery([chapter]),
        topics: singleQuery(memoryTopic),
      },
    });

    const result = await getLearningWorkspace(course.slug, topic.slug);

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.exercises.map((exercise) => exercise.id)).toEqual([ids.exercise]);
    expect(result.data.memoryCheck?.questions.map((question) => question.id)).toEqual([memory.first, memory.second]);
    expect(result.data.memoryCheck?.questions[0].options[0]).not.toHaveProperty("is_correct");
    expect(result.data.isMemoryCheckPassed).toBe(false);
    expect(result.data.answers).toEqual({
      [ids.question]: ids.option,
      [memory.first]: `${memory.first.slice(0, 35)}1`,
    });
    expect(from.mock.calls.map(([table]) => table)).toEqual(["courses", "chapters", "topics"]);
  });

  it("counts an exercise answer only while its selected option is currently correct", async () => {
    // Learner đã chọn option đúng, sau đó teacher đổi đáp án: câu không còn tính là đúng.
    const changedKey = {
      ...topic,
      exercises: [{
        ...topic.exercises[0],
        questions: [{ ...standaloneQuestion, answers: [{ selected_option_id: ids.standaloneRight }] }],
        groups: [{
          ...topic.exercises[0].groups[0],
          questions: [{
            ...topic.exercises[0].groups[0].questions[0],
            options: [{ ...topic.exercises[0].groups[0].questions[0].options[0], is_correct: false }],
          }],
        }],
      }],
    };
    mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters: rowsQuery([chapter]),
        topics: singleQuery(changedKey),
      },
    });

    const result = await getLearningWorkspace(course.slug, topic.slug);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.answers).toEqual({ [ids.standalone]: ids.standaloneRight });
  });

  it("marks syllabus topics completed only from the learner's own completed progress", async () => {
    const doneTopic = {
      ...chapter.topics[0],
      id: "15151515-1515-4515-8515-151515151515",
      slug: "bai-2",
      order_index: 2,
      progress: [{ user_id: user.id, is_topic_completed: true }],
    };
    const otherLearnerTopic = {
      ...chapter.topics[0],
      id: "16161616-1616-4616-8616-161616161616",
      slug: "bai-3",
      order_index: 3,
      progress: [{ user_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", is_topic_completed: true }],
    };
    const chapters = rowsQuery([
      {
        ...chapter,
        topics: [
          { ...chapter.topics[0], progress: [{ user_id: user.id, is_topic_completed: false }] },
          doneTopic,
          otherLearnerTopic,
        ],
      },
    ]);
    mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters,
        topics: singleQuery(topic),
      },
    });

    const result = await getLearningWorkspace(course.slug, topic.slug);

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(
      result.data.syllabus[0].topics.map(({ slug, isCompleted }) => ({ slug, isCompleted })),
    ).toEqual([
      { slug: "bai-1", isCompleted: false },
      { slug: "bai-2", isCompleted: true },
      { slug: "bai-3", isCompleted: false },
    ]);
    expect(chapters.eq).toHaveBeenCalledWith("topics.progress.user_id", user.id);
    expect(result.data.currentTopic).not.toHaveProperty("isCompleted");
  });

  it("skips the progress sync for a topic already completed", async () => {
    const from = mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters: rowsQuery([chapter]),
        topics: singleQuery({
          ...topic,
          progress: [{ ...topic.progress[0], is_exercise_completed: true, is_topic_completed: true }],
        }),
      },
    });

    const result = await getLearningWorkspace(course.slug, topic.slug);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.progress?.isTopicCompleted).toBe(true);
    expect(from.rpc).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(3);
  });

  it("uses the synced completion and keeps stored progress when the sync fails", async () => {
    let from = mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters: rowsQuery([chapter]),
        topics: singleQuery(topic),
      },
      rpc: vi.fn().mockResolvedValue({
        data: { ...syncedProgress, is_exercise_completed: true, is_topic_completed: true, newly_completed: true },
        error: null,
      }),
    });
    let result = await getLearningWorkspace(course.slug, topic.slug);
    expect(result.status === "success" && result.data.progress).toEqual({
      isFlashcardCompleted: true,
      isExerciseCompleted: true,
      isTopicCompleted: true,
    });
    expect(from.rpc).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    from = mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters: rowsQuery([chapter]),
        topics: singleQuery(topic),
      },
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "sensitive sql" } }),
    });
    result = await getLearningWorkspace(course.slug, topic.slug);
    expect(result.status === "success" && result.data.progress).toEqual({
      isFlashcardCompleted: true,
      isExerciseCompleted: false,
      isTopicCompleted: false,
    });
    expect(JSON.stringify(result)).not.toContain("sensitive");
    expect(from.rpc).toHaveBeenCalledTimes(1);
  });

  it("treats a topic without a memory check as passed", async () => {
    mockSupabase({
      queries: {
        courses: singleQuery(course),
        chapters: rowsQuery([chapter]),
        topics: singleQuery({ ...topic, memory_checks: [] }),
      },
    });

    const result = await getLearningWorkspace(course.slug, topic.slug);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.data.memoryCheck).toBeNull();
    expect(result.data.isMemoryCheckPassed).toBe(true);
  });

  it("maps managed group media to authenticated GET while preserving external URLs", async () => {
    const oldOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:45321";
    try {
      const path = `${ids.course}/${ids.topic}/${user.id}/media.png`;
      const mediaTopic = {
        ...topic,
        exercises: [{
          ...topic.exercises[0],
          groups: [{
            ...topic.exercises[0].groups[0],
            image_url: `storage://question_group_images/${path}`,
            audio_url: "https://cdn.example.com/sound.mp3",
          }],
        }],
      };
      mockSupabase({
        queries: {
          courses: singleQuery(course),
          chapters: rowsQuery([chapter]),
          topics: singleQuery(mediaTopic),
        },
      });
      const result = await getLearningWorkspace(course.slug, topic.slug);
      expect(result.status).toBe("success");
      if (result.status !== "success") return;
      expect(result.data.exercises[0].groups[0].image_url)
        .toBe(`/api/question-group-media/${ids.group}/image`);
      expect(result.data.exercises[0].groups[0].audio_url)
        .toBe("https://cdn.example.com/sound.mp3");
    } finally {
      if (oldOrigin === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      else process.env.NEXT_PUBLIC_SUPABASE_URL = oldOrigin;
    }
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
    expect(from.rpc).not.toHaveBeenCalled();
  });
});
