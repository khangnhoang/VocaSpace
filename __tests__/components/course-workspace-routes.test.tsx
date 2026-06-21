import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CourseOverview from "@/app/(teacher)/courses/[id]/_components/CourseOverview";
import CourseOverviewError from "@/app/(teacher)/courses/[id]/_components/CourseOverviewError";
import {
  getCourseOverviewPath,
  getCourseStructurePath,
  getTopicBuilderTab,
  getTopicBuilderPath,
  TOPIC_BUILDER_TABS,
} from "@/lib/course-authoring/routes";
import type {
  CourseDashboardReadiness,
  CourseReadinessIssue,
} from "@/lib/schemas/course-readiness";

// Test plan:
// - Mục tiêu: kiểm tra route contract PR2/PR4 và checkpoint PR5.1-PR5.3 cho course workspace.
// - Loại test: component static render và source contract trong hạ tầng Vitest hiện có.
// - Đối tượng: CourseOverview, /courses/[id], /courses/[id]/structure, /courses/[id]/topics, shared course-authoring route helpers, CourseStructureRouteFeedback, TopicManagementSheet, SettingsTab.
// - Case thành công: overview render dữ liệu từ readiness contract; dashboard chính hiển thị 5 summary cards; issue giữ nguyên thứ tự/context/action/href; empty course dùng CTA contract; error states có đường retry hoặc thoát an toàn; /courses/[id] dùng getCourseDashboardReadiness; structure route dùng lại workspace.
// - Case thất bại: overview route không còn query course list/stats cũ; presentation không tự build authoring URL; issue không bị nhóm hoặc sắp xếp lại; /courses/[id]/topics không còn blank; topic builder direct URL bị chặn khi context không active.
// - Bảo mật/phân quyền: access check thực tế nằm trong readiness action và topic actions; test này không mock quyền database.
// - Ổn định/resilience: route target touched bởi PR2/PR4/PR5.1 phải render useful content hoặc redirect có chủ đích.
// - Invariant cần giữ: /courses/[id] là overview consuming readiness, /courses/[id]/structure là structure workspace, /topics/[topicId] là topic builder.
// - Kết quả verify gần nhất: passed bằng `npm.cmd run test:run -- __tests__/components/course-workspace-routes.test.tsx`.

const courseId = "11111111-1111-4111-8111-111111111111";

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
      href: getTopicBuilderPath(
        courseId,
        "22222222-2222-4222-8222-222222222222",
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
    expect(html).toContain(`href="${readiness.primaryCta.destination.href}"`);
    expect(html).toContain(readiness.primaryCta.label);
    expect(html).toContain("Tóm tắt nội dung");
    expect(html).toContain("Việc tiếp theo");
    expect(html).toContain("Chưa có việc cần xử lý");
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
    expect(html.indexOf(orderedIssues[0].context)).toBeLessThan(
      html.indexOf(orderedIssues[1].context),
    );

    for (const issue of orderedIssues) {
      expect(html).toContain(issue.context);
      expect(html).toContain(issue.actionLabel);
      expect(html).toContain(`href="${issue.destination.href}"`);
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
            href: getCourseStructurePath(courseId),
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
          href: getCourseStructurePath(courseId),
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
      `href="${emptyReadiness.primaryCta.destination.href}"`,
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
    expect(TOPIC_BUILDER_TABS).toEqual([
      "flashcards",
      "exercises",
      "settings",
    ]);
    expect(getTopicBuilderTab("settings")).toBe("settings");
    expect(getTopicBuilderTab("unknown")).toBe("exercises");
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

    expect(topicsIndexSource).toContain("redirect(getCourseStructurePath");
    expect(topicBuilderPageSource).toContain("verifyTopicAuthoringContext");
    expect(topicBuilderPageSource).toContain('context.reason === "forbidden"');
    expect(topicBuilderPageSource).toContain('redirect("/")');
    expect(topicBuilderPageSource).toContain('context.reason === "error"');
    expect(topicBuilderPageSource).toContain("throw new Error(context.error)");
    expect(topicBuilderPageSource).toContain("?topic_unavailable=1");
    expect(structurePageSource).toContain("CourseStructureRouteFeedback");
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
