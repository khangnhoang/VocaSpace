// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@/__tests__/support/intl";
import { afterEach, describe, expect, it } from "vitest";
import CourseRow from "@/app/(client)/learn/_components/CourseRow";
import type { LearnDashboardCourse } from "@/lib/schemas/learn-dashboard";

// Test plan:
// - Mục tiêu: English localization U3 - nút "Review the last lesson" dài hơn "Xem lại bài học cuối" nên cột nút của CourseRow rộng hơn ở en;
//   cột của vi giữ nguyên 10rem như trước U3.
// - Loại test: component render với provider next-intl và catalog thật.
// - Case chính: cột chứa nút CTA có class chiều rộng theo ngôn ngữ; nhãn CTA lấy từ catalog của ngôn ngữ đó.
// - Giới hạn: jsdom không đo bố cục; việc nhãn vừa nút được kiểm bằng ảnh chụp trình duyệt ở 1440, 768 và 375 px (ghi trong State).

afterEach(() => cleanup());

const completed: LearnDashboardCourse = {
  enrollmentId: "e-1",
  courseId: "c-1",
  courseSlug: "c-1",
  courseTitle: "Khóa 1",
  courseThumbnailUrl: null,
  totalTopicCount: 4,
  completedTopicCount: 4,
  progressPercentage: 100,
  status: "completed",
  nextTopic: null,
  lastTopic: { slug: "t9", title: "Bài cuối", chapterTitle: "Chương cuối" },
};

describe("CourseRow action column", () => {
  it("is 13rem wide in English and keeps 10rem in Vietnamese", () => {
    const en = render(<CourseRow course={completed} />, { locale: "en" });
    const enColumn = screen.getByRole("link", { name: /Review the last lesson/ }).parentElement as HTMLElement;
    expect(enColumn.className).toContain("md:w-52");
    expect(enColumn.className).not.toContain("md:w-40");
    en.unmount();

    render(<CourseRow course={completed} />, { locale: "vi" });
    const viColumn = screen.getByRole("link", { name: /Xem lại bài học cuối/ }).parentElement as HTMLElement;
    expect(viColumn.className).toContain("md:w-40");
    expect(viColumn.className).not.toContain("md:w-52");
  });
});
