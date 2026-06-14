import { describe, expect, it } from "vitest";
import { deriveCourseDashboardReadiness } from "@/lib/course-readiness";
import type { CourseReadinessGraph } from "@/lib/schemas/course-readiness";

// Test plan:
// - Mục tiêu: kiểm tra derivation readiness thuần cho empty/partial/full course, ordering và primary CTA deterministic.
// - Loại test: unit.
// - Đối tượng: deriveCourseDashboardReadiness.
// - Case thành công: fully populated course không có issue và fallback CTA trỏ topic builder đầu tiên.
// - Case thất bại: empty course, chapter thiếu topic, topic thiếu content, exercise/question/options thiếu cấu trúc.
// - Bảo mật/phân quyền: không áp dụng ở unit; Server Action query boundary kiểm tra auth/access riêng.
// - Ổn định/resilience: issue id không dựa trên index/text, soft-deleted rows bị loại, tie-break cùng severity deterministic.
// - Invariant cần giữ: cùng input luôn sinh cùng counts, issue order và primary CTA.
// - Kết quả verify gần nhất: passed bằng `npm.cmd run test:run -- __tests__/schemas/course-readiness.test.ts __tests__/utils/course-readiness.test.ts __tests__/actions/course-readiness.test.ts`.

const ids = {
  course: "11111111-1111-4111-8111-111111111111",
  chapterA: "22222222-2222-4222-8222-222222222222",
  chapterB: "22222222-2222-4222-8222-222222222223",
  topicA: "33333333-3333-4333-8333-333333333333",
  topicB: "33333333-3333-4333-8333-333333333334",
  card: "44444444-4444-4444-8444-444444444444",
  exerciseA: "55555555-5555-4555-8555-555555555555",
  exerciseB: "55555555-5555-4555-8555-555555555556",
  group: "66666666-6666-4666-8666-666666666666",
  questionA: "77777777-7777-4777-8777-777777777777",
  questionB: "77777777-7777-4777-8777-777777777778",
  optionA: "88888888-8888-4888-8888-888888888888",
  optionB: "99999999-9999-4999-8999-999999999999",
  removedCard: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
};

function baseGraph(): CourseReadinessGraph {
  return {
    role: "owner",
    course: {
      id: ids.course,
      title: "TOEIC Readiness",
      slug: "toeic-readiness",
      description: "Course description",
      thumbnail_url: null,
      price: 0,
      status: "draft",
      order_index: 1,
      removed_at: null,
    },
    chapters: [],
    topics: [],
    flashcards: [],
    exercises: [],
    questionGroups: [],
    questions: [],
    answerOptions: [],
  };
}

function addChapter(
  graph: CourseReadinessGraph,
  id: string,
  order_index: number | null,
  removed_at: string | null = null,
) {
  graph.chapters.push({
    id,
    course_id: ids.course,
    title: id === ids.chapterA ? "Chapter A" : "Chapter B",
    order_index,
    created_at: `2026-06-0${graph.chapters.length + 1}T00:00:00.000Z`,
    removed_at,
  });
}

function addTopic(
  graph: CourseReadinessGraph,
  id: string,
  chapterId: string,
  order_index: number | null,
  removed_at: string | null = null,
) {
  graph.topics.push({
    id,
    course_id: ids.course,
    chapter_id: chapterId,
    title: id === ids.topicA ? "Topic A" : "Topic B",
    slug: id === ids.topicA ? "topic-a" : "topic-b",
    status: "draft",
    order_index,
    created_at: `2026-06-0${graph.topics.length + 1}T00:00:00.000Z`,
    removed_at,
  });
}

function addPart5Exercise(graph: CourseReadinessGraph, topicId = ids.topicA) {
  graph.exercises.push({
    id: ids.exerciseA,
    course_id: ids.course,
    topic_id: topicId,
    title: "Part 5 Practice",
    part_type: "part5",
    order_index: 1,
    created_at: "2026-06-03T00:00:00.000Z",
    removed_at: null,
  });
}

function addCompleteQuestion(graph: CourseReadinessGraph) {
  graph.questions.push({
    id: ids.questionA,
    course_id: ids.course,
    exercise_id: ids.exerciseA,
    group_id: null,
    content: "Choose the answer.",
    order_index: 1,
    created_at: "2026-06-04T00:00:00.000Z",
    removed_at: null,
  });
  graph.answerOptions.push(
    {
      id: ids.optionA,
      question_id: ids.questionA,
      content: "Correct",
      label: "A",
      is_correct: true,
      order_index: 0,
      removed_at: null,
    },
    {
      id: ids.optionB,
      question_id: ids.questionA,
      content: "Wrong",
      label: "B",
      is_correct: false,
      order_index: 1,
      removed_at: null,
    },
  );
}

describe("deriveCourseDashboardReadiness", () => {
  it("creates a blocking structure issue for a completely empty course", () => {
    const readiness = deriveCourseDashboardReadiness(baseGraph());

    expect(readiness.counts).toMatchObject({
      chapters: 0,
      topics: 0,
      flashcards: 0,
      exercises: 0,
    });
    expect(readiness.issues[0]).toMatchObject({
      id: `course_has_no_chapters:course:${ids.course}`,
      code: "course_has_no_chapters",
      isBlocking: true,
      destination: {
        type: "course_structure",
        href: `/courses/${ids.course}/structure`,
      },
    });
    expect(readiness.primaryCta.sourceIssueId).toBe(readiness.issues[0].id);
  });

  it("reports chapters without active topics while excluding soft-deleted topics", () => {
    const graph = baseGraph();
    addChapter(graph, ids.chapterA, 1);
    addTopic(graph, ids.topicA, ids.chapterA, 1, "2026-06-05T00:00:00.000Z");

    const readiness = deriveCourseDashboardReadiness(graph);

    expect(readiness.counts.topics).toBe(0);
    expect(readiness.issues.map((issue) => issue.code)).toContain(
      "chapter_has_no_topics",
    );
  });

  it("reports active topics that have no supported learning content", () => {
    const graph = baseGraph();
    addChapter(graph, ids.chapterA, 1);
    addTopic(graph, ids.topicA, ids.chapterA, 1);

    const readiness = deriveCourseDashboardReadiness(graph);

    expect(readiness.issues[0]).toMatchObject({
      code: "topic_has_no_learning_content",
      entity: { type: "topic", id: ids.topicA },
      destination: {
        type: "topic_builder",
        href: `/courses/${ids.course}/topics/${ids.topicA}`,
      },
    });
  });

  it("returns no issues for a fully populated Part 5 course and selects the first topic fallback CTA", () => {
    const graph = baseGraph();
    addChapter(graph, ids.chapterA, 1);
    addTopic(graph, ids.topicA, ids.chapterA, 1);
    graph.flashcards.push({
      id: ids.card,
      topic_id: ids.topicA,
      order_index: 1,
      removed_at: null,
    });
    addPart5Exercise(graph);
    addCompleteQuestion(graph);

    const readiness = deriveCourseDashboardReadiness(graph);

    expect(readiness.issues).toEqual([]);
    expect(readiness.counts).toMatchObject({
      chapters: 1,
      topics: 1,
      flashcards: 1,
      exercises: 1,
      questions: 1,
      answerOptions: 2,
    });
    expect(readiness.primaryCta).toMatchObject({
      label: "Tiếp tục soạn bài học",
      sourceIssueId: null,
      destination: {
        type: "topic_builder",
        topicId: ids.topicA,
      },
    });
  });

  it("detects incomplete grouped exercise context and question option rules", () => {
    const graph = baseGraph();
    addChapter(graph, ids.chapterA, 1);
    addTopic(graph, ids.topicA, ids.chapterA, 1);
    graph.exercises.push({
      id: ids.exerciseA,
      course_id: ids.course,
      topic_id: ids.topicA,
      title: "Part 1 Practice",
      part_type: "part1",
      order_index: 1,
      created_at: "2026-06-03T00:00:00.000Z",
      removed_at: null,
    });
    graph.questionGroups.push({
      id: ids.group,
      exercise_id: ids.exerciseA,
      passage_text: null,
      audio_url: null,
      image_url: null,
      order_index: 1,
      created_at: "2026-06-04T00:00:00.000Z",
      removed_at: null,
    });
    graph.questions.push({
      id: ids.questionA,
      course_id: ids.course,
      exercise_id: ids.exerciseA,
      group_id: ids.group,
      content: "What is happening?",
      order_index: 1,
      created_at: "2026-06-05T00:00:00.000Z",
      removed_at: null,
    });
    graph.answerOptions.push({
      id: ids.optionA,
      question_id: ids.questionA,
      content: "Only option",
      label: "A",
      is_correct: false,
      order_index: 0,
      removed_at: null,
    });

    const readiness = deriveCourseDashboardReadiness(graph);

    expect(readiness.issues.map((issue) => issue.code)).toEqual([
      "question_has_no_correct_option",
      "question_has_too_few_options",
      "exercise_group_missing_context",
      "exercise_group_missing_context",
    ]);
    expect(readiness.issues.every((issue) => issue.isBlocking)).toBe(true);
  });

  it("uses stable entity IDs instead of indexes or translated text for issue identity", () => {
    const graph = baseGraph();
    addChapter(graph, ids.chapterA, 1);
    addTopic(graph, ids.topicA, ids.chapterA, 1);

    const first = deriveCourseDashboardReadiness(graph);
    graph.topics[0] = { ...graph.topics[0], title: "Tên bài học đã đổi" };
    const second = deriveCourseDashboardReadiness(graph);

    expect(first.issues[0].id).toBe(
      `topic_has_no_learning_content:topic:${ids.topicA}`,
    );
    expect(second.issues[0].id).toBe(first.issues[0].id);
  });

  it("orders equal-severity issues by category, structure order, and stable IDs", () => {
    const graph = baseGraph();
    addChapter(graph, ids.chapterB, 2);
    addChapter(graph, ids.chapterA, 1);
    addTopic(graph, ids.topicB, ids.chapterB, 1);
    addTopic(graph, ids.topicA, ids.chapterA, 1);

    const readiness = deriveCourseDashboardReadiness(graph);

    expect(readiness.issues.map((issue) => issue.entity.id)).toEqual([
      ids.topicA,
      ids.topicB,
    ]);
  });

  it("excludes soft-deleted flashcards from counts and content readiness", () => {
    const graph = baseGraph();
    addChapter(graph, ids.chapterA, 1);
    addTopic(graph, ids.topicA, ids.chapterA, 1);
    graph.flashcards.push({
      id: ids.removedCard,
      topic_id: ids.topicA,
      order_index: 1,
      removed_at: "2026-06-05T00:00:00.000Z",
    });

    const readiness = deriveCourseDashboardReadiness(graph);

    expect(readiness.counts.flashcards).toBe(0);
    expect(readiness.issues.map((issue) => issue.code)).toContain(
      "topic_has_no_learning_content",
    );
  });

  it("chooses the highest-priority actionable issue as the primary CTA", () => {
    const graph = baseGraph();
    addChapter(graph, ids.chapterA, 1);
    addTopic(graph, ids.topicA, ids.chapterA, 1);
    addPart5Exercise(graph);

    const readiness = deriveCourseDashboardReadiness(graph);

    expect(readiness.issues[0].code).toBe(
      "exercise_requires_standalone_question",
    );
    expect(readiness.primaryCta).toMatchObject({
      sourceIssueCode: "exercise_requires_standalone_question",
      destination: {
        type: "topic_builder",
        topicId: ids.topicA,
      },
    });
  });
});
