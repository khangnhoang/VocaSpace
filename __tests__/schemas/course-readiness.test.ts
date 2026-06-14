import { describe, expect, it } from "vitest";
import {
  courseReadinessGraphSchema,
  courseReadinessResultSchema,
} from "@/lib/schemas/course-readiness";

// Test plan:
// - Mục tiêu: kiểm tra runtime schema cho dashboard readiness chặn dữ liệu Supabase sai shape trước khi derive contract.
// - Loại test: schema.
// - Đối tượng: courseReadinessGraphSchema, courseReadinessResultSchema.
// - Case thành công: graph đầy đủ, graph rỗng có relations empty arrays, nullable supported fields.
// - Case thất bại: thiếu required field, nested row malformed, status enum sai, result error shape sai.
// - Bảo mật/phân quyền: schema không thay auth; action vẫn kiểm tra auth/access riêng.
// - Ổn định/resilience: unexpected query shape phải fail loud thay vì được cast/default im lặng.
// - Invariant cần giữ: chỉ graph đã validate mới được đưa vào derivation.
// - Kết quả verify gần nhất: passed bằng `npm.cmd run test:run -- __tests__/schemas/course-readiness.test.ts __tests__/utils/course-readiness.test.ts __tests__/actions/course-readiness.test.ts`.

const ids = {
  course: "11111111-1111-4111-8111-111111111111",
  chapter: "22222222-2222-4222-8222-222222222222",
  topic: "33333333-3333-4333-8333-333333333333",
  card: "44444444-4444-4444-8444-444444444444",
  exercise: "55555555-5555-4555-8555-555555555555",
  group: "66666666-6666-4666-8666-666666666666",
  question: "77777777-7777-4777-8777-777777777777",
  optionA: "88888888-8888-4888-8888-888888888888",
  optionB: "99999999-9999-4999-8999-999999999999",
};

function validGraph() {
  return {
    role: "owner",
    course: {
      id: ids.course,
      title: "TOEIC Readiness",
      slug: "toeic-readiness",
      description: null,
      thumbnail_url: null,
      price: null,
      status: null,
      order_index: null,
      removed_at: null,
    },
    chapters: [
      {
        id: ids.chapter,
        course_id: ids.course,
        title: "Listening",
        order_index: 1,
        created_at: "2026-06-01T00:00:00.000Z",
        removed_at: null,
      },
    ],
    topics: [
      {
        id: ids.topic,
        course_id: ids.course,
        chapter_id: ids.chapter,
        title: "Photographs",
        slug: "photographs",
        status: "draft",
        order_index: 1,
        created_at: "2026-06-01T00:00:00.000Z",
        removed_at: null,
      },
    ],
    flashcards: [
      {
        id: ids.card,
        topic_id: ids.topic,
        order_index: 1,
        removed_at: null,
      },
    ],
    exercises: [
      {
        id: ids.exercise,
        course_id: ids.course,
        topic_id: ids.topic,
        title: "Part 1 Practice",
        part_type: "part1",
        order_index: 1,
        created_at: "2026-06-01T00:00:00.000Z",
        removed_at: null,
      },
    ],
    questionGroups: [
      {
        id: ids.group,
        exercise_id: ids.exercise,
        passage_text: null,
        audio_url: "https://example.com/audio.mp3",
        image_url: "https://example.com/image.png",
        order_index: 1,
        created_at: "2026-06-01T00:00:00.000Z",
        removed_at: null,
      },
    ],
    questions: [
      {
        id: ids.question,
        course_id: ids.course,
        exercise_id: ids.exercise,
        group_id: ids.group,
        content: "What is happening?",
        order_index: 1,
        created_at: "2026-06-01T00:00:00.000Z",
        removed_at: null,
      },
    ],
    answerOptions: [
      {
        id: ids.optionA,
        question_id: ids.question,
        content: "A person is reading.",
        label: "A",
        is_correct: true,
        order_index: 0,
        removed_at: null,
      },
      {
        id: ids.optionB,
        question_id: ids.question,
        content: "A person is cooking.",
        label: "B",
        is_correct: false,
        order_index: 1,
        removed_at: null,
      },
    ],
  };
}

describe("courseReadinessGraphSchema", () => {
  it("accepts a complete validated content graph", () => {
    expect(courseReadinessGraphSchema.safeParse(validGraph()).success).toBe(true);
  });

  it("accepts empty relations and nullable supported course fields", () => {
    const graph = validGraph();
    graph.chapters = [];
    graph.topics = [];
    graph.flashcards = [];
    graph.exercises = [];
    graph.questionGroups = [];
    graph.questions = [];
    graph.answerOptions = [];

    expect(courseReadinessGraphSchema.safeParse(graph).success).toBe(true);
  });

  it("rejects missing required course identity fields", () => {
    const graph = validGraph();
    const { title: _title, ...courseWithoutTitle } = graph.course;

    const result = courseReadinessGraphSchema.safeParse({
      ...graph,
      course: courseWithoutTitle,
    });

    expect(result.success).toBe(false);
  });

  it("rejects malformed nested rows", () => {
    const graph = validGraph();
    graph.questions[0] = {
      ...graph.questions[0],
      exercise_id: "not-a-uuid",
    };

    const result = courseReadinessGraphSchema.safeParse(graph);

    expect(result.success).toBe(false);
  });

  it("rejects invalid course or topic status values", () => {
    const graph = validGraph();
    graph.topics[0] = {
      ...graph.topics[0],
      status: "archived",
    };

    const result = courseReadinessGraphSchema.safeParse(graph);

    expect(result.success).toBe(false);
  });

  it("rejects invalid TOEIC part values at the runtime boundary", () => {
    const graph = validGraph();
    graph.exercises[0] = {
      ...graph.exercises[0],
      part_type: "part9",
    };

    const result = courseReadinessGraphSchema.safeParse(graph);

    expect(result.success).toBe(false);
  });

  it("rejects unexpected result shapes", () => {
    const result = courseReadinessResultSchema.safeParse({
      success: false,
      error: {
        code: "QUERY_FAILED",
      },
    });

    expect(result.success).toBe(false);
  });
});
