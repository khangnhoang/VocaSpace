import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import CourseOverview from "@/app/(teacher)/courses/[id]/_components/CourseOverview";
import {
  getCourseOverviewPath,
  getCourseStructurePath,
  getTopicBuilderTab,
  getTopicBuilderPath,
  TOPIC_BUILDER_TABS,
} from "@/lib/course-authoring/routes";
import type { TeacherCourse } from "@/lib/schemas/course";

// Test plan:
// - Mục tiêu: kiểm tra route contract PR2/PR4 cho course workspace, topic builder guard, route feedback, và copy/accessibility cục bộ của structure UI.
// - Loại test: component static render và source contract trong hạ tầng Vitest hiện có.
// - Đối tượng: CourseOverview, /courses/[id], /courses/[id]/structure, /courses/[id]/topics, shared course-authoring route helpers, CourseStructureRouteFeedback, TopicManagementSheet, SettingsTab.
// - Case thành công: overview render title/status/metadata/link structure; structure route dùng lại workspace; topic builder path giữ courseId/topicId; route feedback consume topic_unavailable bằng replace; topic dialog có description; delete copy không mô tả cascade.
// - Case thất bại: route /courses/[id]/topics không còn blank; topic builder direct URL bị chặn khi topic/parent chapter không active; learner bị redirect về client home; back/delete navigation không phụ thuộc browser history sau refresh trực tiếp.
// - Bảo mật/phân quyền: access check thực tế vẫn nằm trong action/query hiện có; test này không mock quyền database.
// - Ổn định/resilience: route target touched bởi PR2 phải render useful content hoặc redirect có chủ đích.
// - Invariant cần giữ: /courses/[id] là overview, /courses/[id]/structure là structure workspace, /topics/[topicId] là topic builder.
// - Kết quả verify gần nhất: passed bằng `npm.cmd run test:run -- __tests__/components/course-workspace-routes.test.tsx __tests__/components/course-authoring-trust.test.tsx`.

const course: TeacherCourse = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "TOEIC Workspace Course",
  slug: "toeic-workspace-course",
  description: "Course overview fixture for route ownership tests.",
  thumbnail_url: null,
  price: 0,
  status: "draft",
  order_index: 3,
  my_role: "owner",
  reject_message: null,
  reviewed_at: null,
};

describe("course workspace route contract", () => {
  it("renders a minimal useful overview with course metadata and structure navigation", () => {
    const html = renderToStaticMarkup(
      <CourseOverview
        course={course}
        stats={{ chapters: 2, topics: 5, cards: 12, exercises: 3 }}
      />,
    );

    expect(html).toContain("TOEIC Workspace Course");
    expect(html).toContain("Bản nháp");
    expect(html).toContain("toeic-workspace-course");
    expect(html).toContain("Miễn phí");
    expect(html).toContain('href="/courses"');
    expect(html).toContain(
      `href="${getCourseStructurePath(course.id)}"`,
    );
    expect(html).toContain("Quản lý cấu trúc");
    expect(html).toContain("Mở structure workspace");
    expect(html).toContain('aria-label="Mở structure workspace"');
    expect(html).toContain("Tóm tắt nội dung");
  });

  it("keeps route helpers aligned with the approved workspace contract", () => {
    const topicId = "22222222-2222-4222-8222-222222222222";

    expect(getCourseOverviewPath(course.id)).toBe(`/courses/${course.id}`);
    expect(getCourseStructurePath(course.id)).toBe(
      `/courses/${course.id}/structure`,
    );
    expect(getTopicBuilderPath(course.id, topicId)).toBe(
      `/courses/${course.id}/topics/${topicId}`,
    );
    expect(getTopicBuilderPath(course.id, topicId, "settings")).toBe(
      `/courses/${course.id}/topics/${topicId}?tab=settings`,
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
    const structurePageSource = readFileSync(
      join(process.cwd(), "app/(teacher)/courses/[id]/structure/page.tsx"),
      "utf8",
    );

    expect(overviewPageSource).toContain("CourseOverview");
    expect(overviewPageSource).not.toContain("ChapterList");
    expect(overviewPageSource).not.toContain("createChapter");
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
    expect(structureFeedbackSource).toContain("nextSearch ? `${pathname}?${nextSearch}` : pathname");
    expect(structureFeedbackSource).toContain("params.delete(\"topic_unavailable\")");
    expect(structureFeedbackSource).toContain("scroll: false");
    expect(topicBuilderPageSource).toContain("BackButton courseId={resolvedParams.id}");
    expect(topicBuilderPageSource).toContain("courseId={resolvedParams.id}");
    expect(backButtonSource).toContain("href={getCourseStructurePath(courseId)}");
    expect(settingsTabSource).toContain("router.push(getCourseStructurePath(courseId))");
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
