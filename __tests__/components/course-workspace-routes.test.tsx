import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CourseOverview from "@/app/(teacher)/courses/[id]/_components/CourseOverview";
import CourseOverviewError from "@/app/(teacher)/courses/[id]/_components/CourseOverviewError";
import ChapterList from "@/app/(teacher)/courses/[id]/_components/ChapterList";
import DashboardIssueNotice from "@/app/(teacher)/courses/[id]/_components/DashboardIssueNotice";
import {
  getCourseOverviewPath,
  getCourseStructurePath,
  getTopicBuilderTab,
  getTopicBuilderPath,
  TOPIC_BUILDER_TABS,
} from "@/lib/course-authoring/routes";
import {
  getCourseStructureIssuePath,
  getCourseStructureIssueUnavailablePath,
  getTopicBuilderIssuePath,
  removeDashboardIssueContextParams,
  parseCourseAuthoringIssueDestination,
  parseCourseAuthoringIssueContext,
  removeCourseStructureIssueFeedbackParam,
  type CourseStructureIssueContext,
  type TopicBuilderIssueContext,
} from "@/lib/course-authoring/issue-context";
import {
  resolveCourseStructureIssueGuidance,
  resolveExerciseIssueGuidance,
  resolveTopicBuilderTopIssueGuidance,
} from "@/lib/course-authoring/issue-guidance";
import type {
  CourseDashboardReadiness,
  CourseReadinessIssue,
} from "@/lib/schemas/course-readiness";
import type { FullExercise } from "@/lib/schemas/exercise";

vi.mock(
  "@/app/(teacher)/courses/[id]/_components/TopicManagementSheet",
  () => ({ default: () => null }),
);

// Test plan:
// - Mục tiêu: kiểm tra route contract PR2/PR4 và checkpoint PR5.1-PR5.4 cho course workspace.
// - Loại test: component static render và source contract trong hạ tầng Vitest hiện có.
// - Đối tượng: CourseOverview, ChapterList, /courses/[id], /courses/[id]/structure, /courses/[id]/topics, shared course-authoring route helpers, CourseStructureRouteFeedback, TopicManagementSheet, SettingsTab.
// - Case thành công: overview render dữ liệu từ readiness contract; dashboard chính hiển thị 5 summary cards; issue giữ nguyên thứ tự/context/action/href; empty course dùng CTA contract; error states có đường retry hoặc thoát an toàn; long dashboard/chapter content không bị cắt khỏi markup; section/action có accessible name; /courses/[id] dùng getCourseDashboardReadiness; destination surfaces nhận dashboard issue context hợp lệ và đánh dấu target hiện có.
// - Case thất bại: overview route không còn query course list/stats cũ; presentation không tự build authoring URL; issue không bị nhóm hoặc sắp xếp lại; /courses/[id]/topics không còn blank; topic builder direct URL bị chặn khi context không active; stale target không được đánh dấu như target hợp lệ.
// - Bảo mật/phân quyền: access check thực tế nằm trong readiness action và topic actions; test này không mock quyền database.
// - Ổn định/resilience: route target touched bởi PR2/PR4/PR5.1 phải render useful content hoặc redirect có chủ đích.
// - Invariant cần giữ: /courses/[id] là overview consuming readiness, /courses/[id]/structure là structure workspace, /topics/[topicId] là topic builder.
// - Kết quả verify gần nhất: passed bằng `npm.cmd run test:run -- __tests__/components/course-workspace-routes.test.tsx`.

const courseId = "11111111-1111-4111-8111-111111111111";

function htmlHref(href: string) {
  return href.replaceAll("&", "&amp;");
}

function searchFromPath(path: string) {
  return path.split("?")[1] ?? "";
}

const structureIssueContexts = [
  {
    issue: "course_has_no_chapters",
    targetType: "course",
    target: courseId,
    expectedPath: `/courses/${courseId}/structure?from=dashboard&issue=course_has_no_chapters&targetType=course&target=${courseId}`,
  },
  {
    issue: "chapter_has_no_topics",
    targetType: "chapter",
    target: "33333333-3333-4333-8333-333333333333",
    expectedPath: `/courses/${courseId}/structure?from=dashboard&issue=chapter_has_no_topics&targetType=chapter&target=33333333-3333-4333-8333-333333333333`,
  },
] satisfies (CourseStructureIssueContext & { expectedPath: string })[];

const topicBuilderIssueContexts = [
  {
    issue: "topic_has_no_learning_content",
    targetType: "topic",
    target: "22222222-2222-4222-8222-222222222222",
    tab: "exercises",
    expectedPath: `/courses/${courseId}/topics/22222222-2222-4222-8222-222222222222?from=dashboard&issue=topic_has_no_learning_content&targetType=topic&target=22222222-2222-4222-8222-222222222222&tab=exercises`,
  },
  {
    issue: "exercise_requires_group",
    targetType: "exercise",
    target: "55555555-5555-4555-8555-555555555555",
    tab: "exercises",
    expectedPath: `/courses/${courseId}/topics/22222222-2222-4222-8222-222222222222?from=dashboard&issue=exercise_requires_group&targetType=exercise&target=55555555-5555-4555-8555-555555555555&tab=exercises`,
  },
  {
    issue: "question_group_has_no_active_questions",
    targetType: "question_group",
    target: "66666666-6666-4666-8666-666666666666",
    tab: "exercises",
    expectedPath: `/courses/${courseId}/topics/22222222-2222-4222-8222-222222222222?from=dashboard&issue=question_group_has_no_active_questions&targetType=question_group&target=66666666-6666-4666-8666-666666666666&tab=exercises`,
  },
  {
    issue: "exercise_requires_standalone_question",
    targetType: "exercise",
    target: "55555555-5555-4555-8555-555555555555",
    tab: "exercises",
    expectedPath: `/courses/${courseId}/topics/22222222-2222-4222-8222-222222222222?from=dashboard&issue=exercise_requires_standalone_question&targetType=exercise&target=55555555-5555-4555-8555-555555555555&tab=exercises`,
  },
  {
    issue: "exercise_has_orphan_questions",
    targetType: "exercise",
    target: "55555555-5555-4555-8555-555555555555",
    tab: "exercises",
    expectedPath: `/courses/${courseId}/topics/22222222-2222-4222-8222-222222222222?from=dashboard&issue=exercise_has_orphan_questions&targetType=exercise&target=55555555-5555-4555-8555-555555555555&tab=exercises`,
  },
  {
    issue: "exercise_group_missing_context",
    targetType: "question_group",
    target: "66666666-6666-4666-8666-666666666666",
    tab: "exercises",
    expectedPath: `/courses/${courseId}/topics/22222222-2222-4222-8222-222222222222?from=dashboard&issue=exercise_group_missing_context&targetType=question_group&target=66666666-6666-4666-8666-666666666666&tab=exercises`,
  },
  {
    issue: "question_missing_content",
    targetType: "question",
    target: "44444444-4444-4444-8444-444444444444",
    tab: "exercises",
    expectedPath: `/courses/${courseId}/topics/22222222-2222-4222-8222-222222222222?from=dashboard&issue=question_missing_content&targetType=question&target=44444444-4444-4444-8444-444444444444&tab=exercises`,
  },
  {
    issue: "question_has_too_few_options",
    targetType: "question",
    target: "44444444-4444-4444-8444-444444444444",
    tab: "exercises",
    expectedPath: `/courses/${courseId}/topics/22222222-2222-4222-8222-222222222222?from=dashboard&issue=question_has_too_few_options&targetType=question&target=44444444-4444-4444-8444-444444444444&tab=exercises`,
  },
  {
    issue: "question_has_no_correct_option",
    targetType: "question",
    target: "44444444-4444-4444-8444-444444444444",
    tab: "exercises",
    expectedPath: `/courses/${courseId}/topics/22222222-2222-4222-8222-222222222222?from=dashboard&issue=question_has_no_correct_option&targetType=question&target=44444444-4444-4444-8444-444444444444&tab=exercises`,
  },
] satisfies (TopicBuilderIssueContext & { expectedPath: string })[];

const readiness: CourseDashboardReadiness = {
  role: "owner",
  course: {
    id: courseId,
    title: "TOEIC Workspace Course",
    slug: "toeic-workspace-course",
    description: "Course overview fixture for route ownership tests.",
    thumbnail_url: null,
    price: 0,
    status: "draft",
    order_index: 3,
  },
  counts: {
    chapters: 2,
    topics: 5,
    flashcards: 12,
    exercises: 3,
    questionGroups: 1,
    questions: 8,
    answerOptions: 24,
  },
  issues: [],
  primaryCta: {
    id: `primary:course:${courseId}:structure`,
    label: "Quản lý cấu trúc",
    destination: {
      type: "course_structure",
      courseId,
      href: getCourseStructurePath(courseId),
    },
    sourceIssueId: null,
    sourceIssueCode: null,
  },
};

const chapterFixture = {
  id: "33333333-3333-4333-8333-333333333333",
  course_id: courseId,
  title: "Nền tảng",
  order_index: 1,
  created_at: "2026-06-21T00:00:00.000Z",
  updated_at: "2026-06-21T00:00:00.000Z",
  removed_at: null,
};

const exerciseFixture: FullExercise = {
  id: "55555555-5555-4555-8555-555555555555",
  title: "Part 7 Practice",
  part_type: "part7",
  order_index: 1,
  groups: [
    {
      id: "66666666-6666-4666-8666-666666666666",
      passage_text: "",
      audio_url: "",
      image_url: "",
      questions: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          content: "",
          explanation: "",
          options: [
            {
              id: "77777777-7777-4777-8777-777777777777",
              content: "A",
              is_correct: true,
              label: "A",
              order_index: 1,
            },
            {
              id: "88888888-8888-4888-8888-888888888888",
              content: "B",
              is_correct: false,
              label: "B",
              order_index: 2,
            },
          ],
        },
      ],
    },
  ],
  questions: [
    {
      id: "99999999-9999-4999-8999-999999999999",
      content: "Standalone question",
      explanation: "",
      options: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          content: "A",
          is_correct: true,
          label: "A",
          order_index: 1,
        },
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          content: "B",
          is_correct: false,
          label: "B",
          order_index: 2,
        },
      ],
    },
  ],
};

const orderedIssues: CourseReadinessIssue[] = [
  {
    id: "chapter_has_no_topics:chapter:33333333-3333-4333-8333-333333333333",
    code: "chapter_has_no_topics",
    category: "structure",
    severity: "high",
    isBlocking: true,
    context: "Chương Nền tảng chưa có bài học hoạt động nào.",
    actionLabel: "Thêm bài học",
    destination: {
      type: "course_structure",
      courseId,
      href: getCourseStructurePath(courseId),
    },
    entity: {
      type: "chapter",
      id: "33333333-3333-4333-8333-333333333333",
      courseId,
    },
  },
  {
    id: "topic_has_no_learning_content:topic:22222222-2222-4222-8222-222222222222",
    code: "topic_has_no_learning_content",
    category: "content",
    severity: "high",
    isBlocking: true,
    context: "Bài học Từ vựng chưa có flashcard hoặc bài tập hoạt động.",
    actionLabel: "Thêm nội dung",
    destination: {
      type: "topic_builder",
      courseId,
      topicId: "22222222-2222-4222-8222-222222222222",
      href: getTopicBuilderIssuePath(
        courseId,
        "22222222-2222-4222-8222-222222222222",
        {
          issue: "topic_has_no_learning_content",
          targetType: "topic",
          target: "22222222-2222-4222-8222-222222222222",
          tab: "exercises",
        },
      ),
    },
    entity: {
      type: "topic",
      id: "22222222-2222-4222-8222-222222222222",
      courseId,
      chapterId: "33333333-3333-4333-8333-333333333333",
    },
  },
];

describe("course workspace route contract", () => {
  it("renders a task-first overview from the readiness contract", () => {
    const html = renderToStaticMarkup(<CourseOverview readiness={readiness} />);

    expect(html).toContain("TOEIC Workspace Course");
    expect(html).toContain("Bản nháp");
    expect(html).toContain("toeic-workspace-course");
    expect(html).toContain("Miễn phí");
    expect(html).toContain('href="/courses"');
    expect(html).toContain(`href="${htmlHref(readiness.primaryCta.destination.href)}"`);
    expect(html).toContain(readiness.primaryCta.label);
    expect(html).toContain("Tóm tắt nội dung");
    expect(html).toContain('aria-labelledby="content-summary-title"');
    expect(html).toContain("Việc tiếp theo");
    expect(html).toContain("Chưa có việc cần xử lý");
    expect(html).toContain('aria-labelledby="ready-state-title"');
    expect(html).toContain("Chương");
    expect(html).toContain("Bài học");
    expect(html).toContain("Flashcards");
    expect(html).toContain("Bài tập");
    expect(html).toContain("Câu hỏi");
    expect(html).toContain(`${readiness.counts.chapters}`);
    expect(html).toContain(`${readiness.counts.topics}`);
    expect(html).toContain(`${readiness.counts.flashcards}`);
    expect(html).toContain(`${readiness.counts.exercises}`);
    expect(html).toContain(`${readiness.counts.questions}`);
    expect(html).not.toContain("Nhóm câu hỏi");
    expect(html).not.toContain("Đáp án");
  });

  it("renders readiness issues in contract order with their existing actions", () => {
    const issueReadiness: CourseDashboardReadiness = {
      ...readiness,
      issues: orderedIssues,
      primaryCta: {
        id: `primary:${orderedIssues[0].id}`,
        label: orderedIssues[0].actionLabel,
        destination: orderedIssues[0].destination,
        sourceIssueId: orderedIssues[0].id,
        sourceIssueCode: orderedIssues[0].code,
      },
    };
    const html = renderToStaticMarkup(
      <CourseOverview readiness={issueReadiness} />,
    );

    expect(html).toContain("Các việc cần xử lý");
    expect(html).toContain('aria-labelledby="readiness-issues-title"');
    expect(html.indexOf(orderedIssues[0].context)).toBeLessThan(
      html.indexOf(orderedIssues[1].context),
    );

    for (const issue of orderedIssues) {
      expect(html).toContain(issue.context);
      expect(html).toContain(issue.actionLabel);
      expect(html).toContain(`href="${htmlHref(issue.destination.href)}"`);
      expect(html).toContain(
        `aria-label="${issue.actionLabel}: ${issue.context}"`,
      );
    }

    expect(html).not.toContain("Gợi ý");
    expect(html).not.toContain("Nghiêm trọng");
  });

  it("renders a dedicated empty-course state using the contract CTA", () => {
    const emptyReadiness: CourseDashboardReadiness = {
      ...readiness,
      counts: {
        chapters: 0,
        topics: 0,
        flashcards: 0,
        exercises: 0,
        questionGroups: 0,
        questions: 0,
        answerOptions: 0,
      },
      issues: [
        {
          id: `course_has_no_chapters:course:${courseId}`,
          code: "course_has_no_chapters",
          category: "structure",
          severity: "critical",
          isBlocking: true,
          context: "Khóa học chưa có chương hoạt động nào.",
          actionLabel: "Thêm chương",
          destination: {
            type: "course_structure",
            courseId,
            href: getCourseStructureIssuePath(courseId, {
              issue: "course_has_no_chapters",
              targetType: "course",
              target: courseId,
            }),
          },
          entity: { type: "course", id: courseId },
        },
      ],
      primaryCta: {
        id: `primary:course_has_no_chapters:course:${courseId}`,
        label: "Thêm chương",
        destination: {
          type: "course_structure",
          courseId,
          href: getCourseStructureIssuePath(courseId, {
            issue: "course_has_no_chapters",
            targetType: "course",
            target: courseId,
          }),
        },
        sourceIssueId: `course_has_no_chapters:course:${courseId}`,
        sourceIssueCode: "course_has_no_chapters",
      },
    };
    const html = renderToStaticMarkup(
      <CourseOverview readiness={emptyReadiness} />,
    );

    expect(html).toContain("Khóa học chưa có chương nào");
    expect(html).toContain(emptyReadiness.primaryCta.label);
    expect(html).toContain(
      `href="${htmlHref(emptyReadiness.primaryCta.destination.href)}"`,
    );
    expect(html).not.toContain("Tóm tắt nội dung");
  });

  it("renders safe recovery actions for every readiness error code", () => {
    const retryHref = getCourseOverviewPath(courseId);
    const authHtml = renderToStaticMarkup(
      <CourseOverviewError
        code="AUTH_REQUIRED"
        message="Phiên đăng nhập đã hết hạn."
        retryHref={retryHref}
      />,
    );
    const forbiddenHtml = renderToStaticMarkup(
      <CourseOverviewError
        code="COURSE_NOT_FOUND_OR_FORBIDDEN"
        message="Khóa học không khả dụng hoặc bạn không có quyền truy cập."
        retryHref={retryHref}
      />,
    );
    const queryHtml = renderToStaticMarkup(
      <CourseOverviewError
        code="QUERY_FAILED"
        message="Không thể tải dữ liệu."
        retryHref={retryHref}
      />,
    );
    const invalidDataHtml = renderToStaticMarkup(
      <CourseOverviewError
        code="INVALID_READINESS_DATA"
        message="Dữ liệu tổng quan chưa hợp lệ."
        retryHref={retryHref}
      />,
    );
    const invalidIdHtml = renderToStaticMarkup(
      <CourseOverviewError
        code="INVALID_COURSE_ID"
        message="ID khóa học không hợp lệ."
        retryHref={retryHref}
      />,
    );

    expect(authHtml).toContain('href="/login"');
    expect(forbiddenHtml).toContain("Không thể mở tổng quan khóa học");
    expect(forbiddenHtml).toContain('href="/courses"');
    expect(queryHtml).toContain("Thử tải lại");
    expect(queryHtml).toContain(`href="${retryHref}"`);
    expect(invalidDataHtml).toContain("Thử tải lại");
    expect(invalidDataHtml).toContain(`href="${retryHref}"`);
    expect(invalidIdHtml).toContain("Đường dẫn khóa học không hợp lệ");
    expect(invalidIdHtml).toContain('href="/courses"');
  });

  it("keeps long dashboard content and action labels available in the markup", () => {
    const longTitle =
      "Khóa học luyện thi TOEIC chuyên sâu dành cho giáo viên cần xây dựng lộ trình nhiều giai đoạn";
    const longDescription =
      "Mô tả dài giải thích mục tiêu, đối tượng học viên, phạm vi kiến thức và cách tổ chức nội dung để kiểm tra khả năng hiển thị trên nhiều kích thước màn hình.";
    const longContext =
      "Bài học luyện nghe hội thoại trong môi trường công sở chưa có flashcard hoặc bài tập hoạt động và cần được bổ sung nội dung trước khi tiếp tục.";
    const longActionLabel =
      "Mở bài học và bổ sung nội dung luyện tập còn thiếu";
    const longIssue: CourseReadinessIssue = {
      ...orderedIssues[1],
      id: "topic_has_no_learning_content:topic:44444444-4444-4444-8444-444444444444",
      context: longContext,
      actionLabel: longActionLabel,
    };
    const longReadiness: CourseDashboardReadiness = {
      ...readiness,
      course: {
        ...readiness.course,
        title: longTitle,
        description: longDescription,
      },
      issues: [longIssue],
      primaryCta: {
        id: `primary:${longIssue.id}`,
        label: longActionLabel,
        destination: longIssue.destination,
        sourceIssueId: longIssue.id,
        sourceIssueCode: longIssue.code,
      },
    };
    const html = renderToStaticMarkup(
      <CourseOverview readiness={longReadiness} />,
    );

    expect(html).toContain(longTitle);
    expect(html).toContain(longDescription);
    expect(html).toContain(longContext);
    expect(html).toContain(longActionLabel);
    expect(html).toContain(`aria-label="${longActionLabel}: ${longContext}"`);
  });

  it("keeps a long chapter title and every chapter action available", () => {
    const longChapterTitle =
      "Chương luyện nghe hội thoại công sở chuyên sâu với tiêu đề rất dài dành cho nhiều giai đoạn học tập";
    const html = renderToStaticMarkup(
      <ChapterList
        chapters={[
          {
            id: "33333333-3333-4333-8333-333333333333",
            course_id: courseId,
            title: longChapterTitle,
            order_index: 1,
            created_at: "2026-06-21T00:00:00.000Z",
            updated_at: "2026-06-21T00:00:00.000Z",
            removed_at: null,
          },
        ]}
        isLoading={false}
        setChapterToDelete={() => undefined}
        onEditChapter={() => undefined}
      />,
    );

    expect(html).toContain(longChapterTitle);
    expect(html).toContain("Quản lý bài học");
    expect(html).toContain(`aria-label="Sửa chương ${longChapterTitle}"`);
    expect(html).toContain(`aria-label="Ẩn chương ${longChapterTitle}"`);
  });

  it("keeps route helpers aligned with the approved workspace contract", () => {
    const topicId = "22222222-2222-4222-8222-222222222222";

    expect(getCourseOverviewPath(readiness.course.id)).toBe(
      `/courses/${readiness.course.id}`,
    );
    expect(getCourseStructurePath(readiness.course.id)).toBe(
      `/courses/${readiness.course.id}/structure`,
    );
    expect(getTopicBuilderPath(readiness.course.id, topicId)).toBe(
      `/courses/${readiness.course.id}/topics/${topicId}`,
    );
    expect(getTopicBuilderPath(readiness.course.id, topicId, "settings")).toBe(
      `/courses/${readiness.course.id}/topics/${topicId}?tab=settings`,
    );
    expect(getTopicBuilderPath(readiness.course.id, topicId, "exercises")).toBe(
      `/courses/${readiness.course.id}/topics/${topicId}?tab=exercises`,
    );
    expect(getCourseStructurePath(readiness.course.id)).not.toContain(
      "from=dashboard",
    );
    expect(getTopicBuilderPath(readiness.course.id, topicId)).not.toContain(
      "from=dashboard",
    );
    expect(TOPIC_BUILDER_TABS).toEqual([
      "flashcards",
      "exercises",
      "settings",
    ]);
    expect(getTopicBuilderTab("settings")).toBe("settings");
    expect(getTopicBuilderTab("unknown")).toBe("exercises");
  });

  it("builds deterministic dashboard issue destinations that parse back into valid context", () => {
    const topicId = "22222222-2222-4222-8222-222222222222";

    for (const context of structureIssueContexts) {
      const { expectedPath, ...issueContext } = context;
      const path = getCourseStructureIssuePath(readiness.course.id, issueContext);

      expect(path).toBe(expectedPath);
      expect(parseCourseAuthoringIssueContext(searchFromPath(path))).toEqual({
        from: "dashboard",
        ...issueContext,
      });
    }

    for (const context of topicBuilderIssueContexts) {
      const { expectedPath, ...issueContext } = context;
      const path = getTopicBuilderIssuePath(
        readiness.course.id,
        topicId,
        issueContext,
      );

      expect(path).toBe(expectedPath);
      expect(parseCourseAuthoringIssueContext(searchFromPath(path))).toEqual({
        from: "dashboard",
        ...issueContext,
      });
    }
  });

  it.each([
    [
      "course issue with question target",
      "from=dashboard&issue=course_has_no_chapters&targetType=question&target=44444444-4444-4444-8444-444444444444",
    ],
    [
      "chapter issue with course target",
      `from=dashboard&issue=chapter_has_no_topics&targetType=course&target=${courseId}`,
    ],
    [
      "structure issue with topic builder tab",
      `from=dashboard&issue=course_has_no_chapters&targetType=course&target=${courseId}&tab=exercises`,
    ],
    [
      "question issue with exercise target",
      "from=dashboard&issue=question_missing_content&targetType=exercise&target=55555555-5555-4555-8555-555555555555&tab=exercises",
    ],
    [
      "topic builder issue with settings tab",
      "from=dashboard&issue=topic_has_no_learning_content&targetType=topic&target=22222222-2222-4222-8222-222222222222&tab=settings",
    ],
    [
      "unknown issue code",
      "from=dashboard&issue=unknown&targetType=question&target=44444444-4444-4444-8444-444444444444&tab=exercises",
    ],
    [
      "invalid target UUID",
      "from=dashboard&issue=question_missing_content&targetType=question&target=not-a-uuid&tab=exercises",
    ],
    [
      "missing dashboard source",
      "issue=question_missing_content&targetType=question&target=44444444-4444-4444-8444-444444444444&tab=exercises",
    ],
    [
      "wrong dashboard source",
      "from=course-list&issue=question_missing_content&targetType=question&target=44444444-4444-4444-8444-444444444444&tab=exercises",
    ],
  ])("rejects invalid dashboard issue context: %s", (_name, search) => {
    expect(parseCourseAuthoringIssueContext(search)).toBeNull();
  });

  it("removes only dashboard issue params when a destination explanation is dismissed", () => {
    expect(
      removeDashboardIssueContextParams(
        `/courses/${courseId}/topics/22222222-2222-4222-8222-222222222222`,
        `from=dashboard&issue=question_missing_content&targetType=question&target=44444444-4444-4444-8444-444444444444&tab=exercises&preview=1`,
      ),
    ).toBe(
      `/courses/${courseId}/topics/22222222-2222-4222-8222-222222222222?tab=exercises&preview=1`,
    );
  });

  it("renders a banner close control that clearly dismisses the whole notice", () => {
    const html = renderToStaticMarkup(
      <DashboardIssueNotice
        guidance={{
          tone: "info",
          title: "Bài học chưa có nội dung học tập",
          description:
            "Bạn có thể thêm flashcard hoặc tạo bài tập để hoàn thiện nội dung.",
        }}
        onDismiss={() => undefined}
      />,
    );

    expect(html).toContain('aria-label="Đóng thông báo"');
    expect(html).not.toContain("Mở thẻ từ vựng");
    expect(html).not.toContain("Mở bài tập TOEIC");
    expect(html).toContain("right-3 top-3 size-10");
  });

  it("parses topic-builder dashboard issue URLs without treating an invalid tab as a stale target", () => {
    const validFlashcardTab = parseCourseAuthoringIssueDestination(
      "from=dashboard&issue=topic_has_no_learning_content&targetType=topic&target=22222222-2222-4222-8222-222222222222&tab=flashcards",
    );
    expect(validFlashcardTab).toMatchObject({
      kind: "valid",
      context: {
        issue: "topic_has_no_learning_content",
        tab: "flashcards",
      },
    });

    const invalidTab = parseCourseAuthoringIssueDestination(
      "from=dashboard&issue=topic_has_no_learning_content&targetType=topic&target=22222222-2222-4222-8222-222222222222&tab=settings",
    );
    expect(invalidTab).toMatchObject({
      kind: "invalid_tab",
      context: {
        issue: "topic_has_no_learning_content",
        tab: "exercises",
      },
      receivedTab: "settings",
    });

    expect(
      parseCourseAuthoringIssueDestination(
        "from=dashboard&issue=question_missing_content&targetType=question&target=not-a-uuid&tab=exercises",
      ),
    ).toEqual({ kind: "invalid_context" });
  });

  it("builds and consumes structure feedback for stale topic-builder targets", () => {
    const chapterId = chapterFixture.id;
    const path = getCourseStructureIssueUnavailablePath(courseId, chapterId);

    expect(path).toBe(
      `/courses/${courseId}/structure?issue_unavailable=1&chapter=${chapterId}`,
    );
    expect(
      removeCourseStructureIssueFeedbackParam(
        `/courses/${courseId}/structure`,
        `issue_unavailable=1&chapter=${chapterId}&preview=1`,
      ),
    ).toBe(`/courses/${courseId}/structure?chapter=${chapterId}&preview=1`);
  });

  it("resolves structure dashboard issues without trusting unrelated targets", () => {
    expect(
      resolveCourseStructureIssueGuidance({
        courseId,
        chapters: [],
        context: {
          issue: "course_has_no_chapters",
          targetType: "course",
          target: courseId,
        },
      }),
    ).toMatchObject({
      tone: "info",
      title: "Khóa học chưa có chương",
      actionLabel: "Thêm chương",
    });

    expect(
      resolveCourseStructureIssueGuidance({
        courseId,
        chapters: [chapterFixture],
        context: {
          issue: "chapter_has_no_topics",
          targetType: "chapter",
          target: chapterFixture.id,
        },
      }),
    ).toMatchObject({
      tone: "info",
      title: "Chương chưa có bài học",
      targetChapterId: chapterFixture.id,
    });

    const missingChapterGuidance = resolveCourseStructureIssueGuidance({
      courseId,
      chapters: [chapterFixture],
      context: {
        issue: "chapter_has_no_topics",
        targetType: "chapter",
        target: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      },
    });

    expect(missingChapterGuidance).toMatchObject({
      tone: "warning",
      title: "Chương được yêu cầu không còn khả dụng",
    });
    expect(missingChapterGuidance).not.toHaveProperty("targetChapterId");
  });

  it("keeps a dashboard-targeted chapter visible without opening the topic sheet", () => {
    const html = renderToStaticMarkup(
      <ChapterList
        chapters={[chapterFixture]}
        isLoading={false}
        setChapterToDelete={() => undefined}
        onEditChapter={() => undefined}
        highlightedChapterId={chapterFixture.id}
      />,
    );

    expect(html).toContain(`id="dashboard-chapter-${chapterFixture.id}"`);
    expect(html).toContain("Dashboard đang đánh dấu chương này.");
    expect(html).not.toContain("Quản lý bài học</h2>");
  });

  it("resolves topic-builder issue guidance for valid and stale targets", () => {
    expect(
      resolveTopicBuilderTopIssueGuidance({
        topicId: "22222222-2222-4222-8222-222222222222",
        context: {
          issue: "topic_has_no_learning_content",
          targetType: "topic",
          target: "22222222-2222-4222-8222-222222222222",
          tab: "exercises",
        },
      }),
    ).toMatchObject({
      tone: "info",
      title: "Bài học chưa có nội dung học tập",
      description:
        "Bài học này chưa có flashcard hoặc bài tập hoạt động. Bạn có thể thêm flashcard hoặc tạo bài tập để hoàn thiện nội dung.",
    });

    expect(
      resolveExerciseIssueGuidance({
        exercises: [exerciseFixture],
        context: {
          issue: "exercise_requires_group",
          targetType: "exercise",
          target: exerciseFixture.id,
          tab: "exercises",
        },
      }),
    ).toMatchObject({
      tone: "info",
      targetExerciseId: exerciseFixture.id,
    });

    expect(
      resolveExerciseIssueGuidance({
        exercises: [exerciseFixture],
        context: {
          issue: "exercise_group_missing_context",
          targetType: "question_group",
          target: exerciseFixture.groups[0].id,
          tab: "exercises",
        },
      }),
    ).toMatchObject({
      tone: "info",
      targetExerciseId: exerciseFixture.id,
      targetGroupId: exerciseFixture.groups[0].id,
    });

    expect(
      resolveExerciseIssueGuidance({
        exercises: [exerciseFixture],
        context: {
          issue: "question_has_no_correct_option",
          targetType: "question",
          target: exerciseFixture.groups[0].questions[0].id,
          tab: "exercises",
        },
      }),
    ).toMatchObject({
      tone: "info",
      targetExerciseId: exerciseFixture.id,
      targetGroupId: exerciseFixture.groups[0].id,
      targetQuestionId: exerciseFixture.groups[0].questions[0].id,
    });

    const missingQuestionGuidance = resolveExerciseIssueGuidance({
      exercises: [exerciseFixture],
      context: {
        issue: "question_missing_content",
        targetType: "question",
        target: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        tab: "exercises",
      },
    });

    expect(missingQuestionGuidance).toMatchObject({
      tone: "warning",
      title: "Câu hỏi được yêu cầu không còn khả dụng",
    });
    expect(missingQuestionGuidance).not.toHaveProperty("targetQuestionId");
  });

  it("moves structure ownership out of the overview route without duplicating the workspace", () => {
    const overviewPageSource = readFileSync(
      join(process.cwd(), "app/(teacher)/courses/[id]/page.tsx"),
      "utf8",
    );
    const overviewComponentSource = readFileSync(
      join(
        process.cwd(),
        "app/(teacher)/courses/[id]/_components/CourseOverview.tsx",
      ),
      "utf8",
    );
    const structurePageSource = readFileSync(
      join(process.cwd(), "app/(teacher)/courses/[id]/structure/page.tsx"),
      "utf8",
    );

    expect(overviewPageSource).toContain("CourseOverview");
    expect(overviewPageSource).toContain("getCourseDashboardReadiness");
    expect(overviewPageSource).not.toContain("getCoursesForTeacher");
    expect(overviewPageSource).not.toContain("getCourseStats");
    expect(overviewPageSource).not.toContain("useEffect");
    expect(overviewPageSource).not.toContain("ChapterList");
    expect(overviewPageSource).not.toContain("createChapter");
    expect(overviewComponentSource).toContain("primaryCta.destination.href");
    expect(overviewComponentSource).not.toContain("getCourseStructurePath");
    expect(structurePageSource).toContain("CourseStructureWorkspace");
  });

  it("redirects the obsolete topics index and keeps topic builder navigation course-aware", () => {
    const topicsIndexSource = readFileSync(
      join(process.cwd(), "app/(teacher)/courses/[id]/topics/page.tsx"),
      "utf8",
    );
    const topicBuilderPageSource = readFileSync(
      join(process.cwd(), "app/(teacher)/courses/[id]/topics/[topicId]/page.tsx"),
      "utf8",
    );
    const structurePageSource = readFileSync(
      join(process.cwd(), "app/(teacher)/courses/[id]/structure/page.tsx"),
      "utf8",
    );
    const structureFeedbackSource = readFileSync(
      join(
        process.cwd(),
        "app/(teacher)/courses/[id]/_components/CourseStructureRouteFeedback.tsx",
      ),
      "utf8",
    );
    const backButtonSource = readFileSync(
      join(
        process.cwd(),
        "app/(teacher)/courses/[id]/topics/[topicId]/_components/BackButton.tsx",
      ),
      "utf8",
    );
    const settingsTabSource = readFileSync(
      join(
        process.cwd(),
        "app/(teacher)/courses/[id]/topics/[topicId]/_components/SettingsTab.tsx",
      ),
      "utf8",
    );
    const structureWorkspaceSource = readFileSync(
      join(
        process.cwd(),
        "app/(teacher)/courses/[id]/_components/CourseStructureWorkspace.tsx",
      ),
      "utf8",
    );
    const chapterListSource = readFileSync(
      join(
        process.cwd(),
        "app/(teacher)/courses/[id]/_components/ChapterList.tsx",
      ),
      "utf8",
    );
    const topicSheetSource = readFileSync(
      join(
        process.cwd(),
        "app/(teacher)/courses/[id]/_components/TopicManagementSheet.tsx",
      ),
      "utf8",
    );
    const topicBuilderTabsSource = readFileSync(
      join(
        process.cwd(),
        "app/(teacher)/courses/[id]/topics/[topicId]/_components/TopicBuilderTabs.tsx",
      ),
      "utf8",
    );
    const exerciseTabSource = readFileSync(
      join(
        process.cwd(),
        "app/(teacher)/courses/[id]/topics/[topicId]/_components/ExerciseTab.tsx",
      ),
      "utf8",
    );

    expect(topicsIndexSource).toContain("redirect(getCourseStructurePath");
    expect(topicBuilderPageSource).toContain("verifyTopicAuthoringContext");
    expect(topicBuilderPageSource).toContain("searchParams");
    expect(topicBuilderPageSource).toContain(
      "parseCourseAuthoringIssueDestination",
    );
    expect(topicBuilderPageSource).toContain(
      "getCourseStructureIssueUnavailablePath",
    );
    expect(topicBuilderPageSource).toContain('context.reason === "forbidden"');
    expect(topicBuilderPageSource).toContain('redirect("/")');
    expect(topicBuilderPageSource).toContain('context.reason === "error"');
    expect(topicBuilderPageSource).toContain("throw new Error(context.error)");
    expect(topicBuilderPageSource).toContain("?topic_unavailable=1");
    expect(structurePageSource).toContain("CourseStructureRouteFeedback");
    expect(structurePageSource).toContain("parseCourseStructureIssueFeedback");
    expect(structureWorkspaceSource).toContain(
      "removeCourseStructureIssueFeedbackParam",
    );
    expect(structureWorkspaceSource).toContain(
      "Nội dung bạn muốn mở không còn khả dụng",
    );
    expect(structureFeedbackSource).toContain("topic_unavailable");
    expect(structureFeedbackSource).toContain("Bài học không còn khả dụng");
    expect(structureFeedbackSource).toContain("toast.error");
    expect(structureFeedbackSource).toContain("queueMicrotask");
    expect(structureFeedbackSource).toContain("router.replace");
    expect(structureFeedbackSource).toContain("new URLSearchParams(search)");
    expect(structureFeedbackSource).toContain(
      "nextSearch ? `${pathname}?${nextSearch}` : pathname",
    );
    expect(structureFeedbackSource).toContain(
      'params.delete("topic_unavailable")',
    );
    expect(structureFeedbackSource).toContain("scroll: false");
    expect(topicBuilderPageSource).toContain(
      "BackButton courseId={resolvedParams.id}",
    );
    expect(topicBuilderPageSource).toContain("courseId={resolvedParams.id}");
    expect(backButtonSource).toContain("href={getCourseStructurePath(courseId)}");
    expect(settingsTabSource).toContain(
      "router.push(getCourseStructurePath(courseId))",
    );
    expect(structureWorkspaceSource).toContain(
      "parseCourseAuthoringIssueContext(search)",
    );
    expect(structureWorkspaceSource).toContain(
      "resolveCourseStructureIssueGuidance",
    );
    expect(structureWorkspaceSource).toContain(
      "removeDashboardIssueContextParams(pathname, search)",
    );
    expect(chapterListSource).toContain("highlightedChapterId");
    expect(chapterListSource).toContain("onTopicsChanged");
    expect(chapterListSource).toContain("scrollIntoView");
    expect(topicBuilderTabsSource).toContain("value={activeTab}");
    expect(topicBuilderTabsSource).toContain("onValueChange={handleTabChange}");
    expect(topicBuilderTabsSource).toContain("initialSearch");
    expect(topicBuilderTabsSource).toContain("useSyncExternalStore");
    expect(topicBuilderTabsSource).not.toContain("Mở thẻ từ vựng");
    expect(topicBuilderTabsSource).not.toContain("Mở bài tập TOEIC");
    expect(topicBuilderTabsSource).toContain(
      "resolveTopicBuilderTopIssueGuidance",
    );
    expect(topicBuilderTabsSource).toContain(
      "removeDashboardIssueContextParams(pathname, search)",
    );
    expect(topicBuilderTabsSource).not.toContain("defaultValue={");
    expect(exerciseTabSource).toContain("resolveExerciseIssueGuidance");
    expect(exerciseTabSource).toContain("dashboardIssueContext");
    expect(exerciseTabSource).toContain("staleTargetRedirectHref");
    expect(exerciseTabSource).toContain("scrollIntoView");
    expect(topicSheetSource).toContain("onTopicsChanged");
    expect(structureWorkspaceSource).toContain("handleTopicsChanged");
    expect(structureWorkspaceSource).toContain("router.refresh()");
    expect(topicsIndexSource).not.toContain("return null");
  });

  it("keeps structure dialog accessibility and non-cascading soft-delete copy explicit", () => {
    const topicSheetSource = readFileSync(
      join(
        process.cwd(),
        "app/(teacher)/courses/[id]/_components/TopicManagementSheet.tsx",
      ),
      "utf8",
    );
    const settingsTabSource = readFileSync(
      join(
        process.cwd(),
        "app/(teacher)/courses/[id]/topics/[topicId]/_components/SettingsTab.tsx",
      ),
      "utf8",
    );

    expect(topicSheetSource).toContain("DialogDescription");
    expect(topicSheetSource).toContain(
      "Nhập tên và trạng thái hiển thị cho bài học trong chương này.",
    );
    expect(settingsTabSource).toContain(
      "Bài học sẽ được ẩn khỏi cấu trúc khóa học",
    );
    expect(settingsTabSource).toContain(
      "Học viên sẽ không thể truy cập bài học này",
    );
    expect(settingsTabSource).not.toContain("soft-delete");
    expect(settingsTabSource).not.toContain(
      "đưa toàn bộ nội dung vào trạng thái thùng rác",
    );
  });
});
