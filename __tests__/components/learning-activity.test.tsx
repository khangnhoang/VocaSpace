/**
 * @vitest-environment jsdom
 */

import React from "react";
import { screen, within } from "@testing-library/react";
import { render } from "@/__tests__/support/intl";
import { describe, expect, it } from "vitest";
import LearningStreakCard from "@/app/(client)/learn/_components/LearningStreakCard";
import CourseStreakChip from "@/app/(client)/learn/[course-slug]/[topic-slug]/_components/CourseStreakChip";
import CourseLearningActivity from "@/components/learning-activity/CourseLearningActivity";
import {
  dayMonthLabel,
  formatRelativeDay,
  formatStudyDuration,
  weekdayLabel,
} from "@/lib/learning-activity-format";
import type {
  CourseLearningSummary,
  OverallLearningSummary,
} from "@/lib/schemas/learning-activity";

// Test plan:
// - Mục tiêu: FEAT3 CP2 - các khối trình bày chuỗi ngày học (AC5, AC6, AC7) và các trạng thái lặng lẽ khi chưa tải được (AC10, gồm cả chip header).
// - Loại test: component render thuần từ kết quả đã có; không gọi action hay database. Dữ liệu và quy tắc ngày do SQL sở hữu
//   (đã kiểm ở integration), nên ở đây chỉ kiểm cách trình bày kết quả.
// - Đối tượng: LearningStreakCard (/learn), CourseLearningActivity (trang khóa học và tổng quan), CourseStreakChip (header workspace)
//   và các hàm định dạng.
// - Case thành công: thẻ /learn có đủ 4 trạng thái (chưa có chuỗi, đã học hôm nay, mới học hôm qua, chưa tải được), dải 7 ngày đọc được
//   bằng chữ, thời gian học có "khoảng"/ước tính; khối khóa học có tối đa 3 chủ đề kèm ngày tương đối và liên kết vào workspace.
// - Case thất bại: kết quả `success: false` chỉ hiện dòng "chưa tải được" (role status), không ném lỗi; chip header hiện một dòng status lặng lẽ.
// - Ổn định/resilience: chip không hiện khi streak 0; chuỗi hôm qua có lời nhắc giữ chuỗi; định dạng không dựa đồng hồ trình duyệt.
// - Invariant cần giữ: khối chỉ trình bày dữ liệu server đưa vào; không tự tính ngày hay streak.
// - Kết quả verify gần nhất: xem milestone FEAT3 CP2 trong progress.md.

const week = (studiedFlags: boolean[]): OverallLearningSummary["days"] =>
  studiedFlags.map((studied, index) => ({ date: `2026-03-${String(5 + index).padStart(2, "0")}`, studied }));

const overall = (overrides: Partial<OverallLearningSummary> = {}): OverallLearningSummary => ({
  streak: 0,
  studiedToday: false,
  days: week([false, false, false, false, false, false, false]),
  weekStudyMinutes: 0,
  ...overrides,
});

const course = (overrides: Partial<CourseLearningSummary> = {}): CourseLearningSummary => ({
  streak: 0,
  studiedToday: false,
  recentTopics: [],
  ...overrides,
});
const topic = (index: number, daysAgo: number) => ({
  topicId: `d0d0d0d0-0000-4000-8000-00000000000${index}`,
  slug: `topic-${index}`,
  title: `Chủ đề ${index}`,
  lastActivityAt: "2026-03-11T01:04:00+00:00",
  daysAgo,
});

describe("formatters", () => {
  it("names relative days from the server day offset", () => {
    expect([0, 1, 2, 9].map(formatRelativeDay)).toEqual(["Hôm nay", "Hôm qua", "2 ngày trước", "9 ngày trước"]);
  });

  it("always labels study time as an estimate and splits hours", () => {
    expect([0, 25, 59, 60, 80, 120, 125].map(formatStudyDuration)).toEqual([
      "khoảng 0 phút",
      "khoảng 25 phút",
      "khoảng 59 phút",
      "khoảng 1 giờ",
      "khoảng 1 giờ 20 phút",
      "khoảng 2 giờ",
      "khoảng 2 giờ 5 phút",
    ]);
  });

  it("labels a plain calendar date without using the browser time zone", () => {
    // 2026-03-09 là thứ Hai, 2026-03-15 là Chủ nhật.
    expect(weekdayLabel("2026-03-09")).toBe("T2");
    expect(weekdayLabel("2026-03-15")).toBe("CN");
    expect(dayMonthLabel("2026-03-09")).toBe("09/03");
  });
});

describe("LearningStreakCard (/learn)", () => {
  it("invites a learner with no activity to start instead of showing an error", () => {
    render(<LearningStreakCard result={{ success: true, data: overall() }} />);

    expect(screen.getByRole("heading", { name: "Bắt đầu chuỗi ngày học" })).toBeTruthy();
    expect(screen.getByText(/Làm một câu hỏi hoặc ôn một thẻ hôm nay/)).toBeTruthy();
    expect(screen.getByText("Tuần này chưa có thời gian học được ghi nhận.")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the streak, the seven days in words and the estimated study time when the learner studied today", () => {
    render(
      <LearningStreakCard
        result={{
          success: true,
          data: overall({
            streak: 3,
            studiedToday: true,
            days: week([false, false, false, false, true, true, true]),
            weekStudyMinutes: 80,
          }),
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "3 ngày liên tiếp" })).toBeTruthy();
    expect(screen.getByText(/Hôm nay bạn đã học/)).toBeTruthy();
    const strip = screen.getByRole("list", { name: "7 ngày gần nhất" });
    const items = within(strip).getAllByRole("listitem");
    expect(items).toHaveLength(7);
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("05/03: chưa học"),
      expect.stringContaining("06/03: chưa học"),
      expect.stringContaining("07/03: chưa học"),
      expect.stringContaining("08/03: chưa học"),
      expect.stringContaining("09/03: đã học"),
      expect.stringContaining("10/03: đã học"),
      expect.stringContaining("Hôm nay 11/03: đã học"),
    ]);
    expect(items[6].getAttribute("aria-current")).toBe("date");
    expect(screen.getByText("Tuần này bạn đã học khoảng 1 giờ 20 phút (ước tính).")).toBeTruthy();
  });

  it("keeps the streak up to yesterday and prompts the learner to study today", () => {
    render(
      <LearningStreakCard
        result={{
          success: true,
          data: overall({
            streak: 2,
            studiedToday: false,
            days: week([false, false, false, false, false, true, false]),
            weekStudyMinutes: 25,
          }),
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "2 ngày liên tiếp" })).toBeTruthy();
    expect(screen.getByText(/Hôm nay bạn chưa học\. Làm một câu hỏi hoặc ôn một thẻ để giữ chuỗi/)).toBeTruthy();
    expect(screen.getByText("Tuần này bạn đã học khoảng 25 phút (ước tính).")).toBeTruthy();
  });

  it("shows a quiet unavailable state when the summary could not be read", () => {
    render(<LearningStreakCard result={{ success: false, error: "Không thể tải chuỗi ngày học lúc này." }} />);

    const status = screen.getByRole("status");
    expect(within(status).getByRole("heading", { name: "Chưa tải được chuỗi ngày học" })).toBeTruthy();
    expect(status.textContent).toContain("Bạn vẫn học và ôn tập bình thường");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("CourseLearningActivity (course pages)", () => {
  it("lists up to three recent topics with relative days and links into the workspace", () => {
    render(
      <CourseLearningActivity
        courseSlug="toeic-nen-tang"
        result={{
          success: true,
          data: course({ streak: 4, studiedToday: true, recentTopics: [topic(1, 0), topic(2, 1), topic(3, 5)] }),
        }}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Chuỗi 4 ngày học khóa này" })).toBeTruthy();
    expect(screen.getByText("Hôm nay bạn đã học khóa này.")).toBeTruthy();
    const links = within(screen.getByRole("list")).getAllByRole("link");
    expect(links.map((link) => [link.getAttribute("href"), link.textContent])).toEqual([
      ["/learn/toeic-nen-tang/topic-1", "Chủ đề 1Hôm nay"],
      ["/learn/toeic-nen-tang/topic-2", "Chủ đề 2Hôm qua"],
      ["/learn/toeic-nen-tang/topic-3", "Chủ đề 35 ngày trước"],
    ]);
  });

  it("prompts to keep the streak when the last study day was yesterday", () => {
    render(
      <CourseLearningActivity
        courseSlug="toeic-nen-tang"
        result={{ success: true, data: course({ streak: 2, studiedToday: false, recentTopics: [topic(1, 1)] }) }}
      />,
    );

    expect(screen.getByText(/Hôm nay bạn chưa học khóa này\. Học một chút để giữ chuỗi/)).toBeTruthy();
  });

  it("invites the learner to start and shows no topic list when nothing was studied", () => {
    render(<CourseLearningActivity courseSlug="toeic-nen-tang" result={{ success: true, data: course() }} />);

    expect(screen.getByRole("heading", { name: "Chưa có chuỗi ngày học khóa này" })).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByText("HỌC GẦN ĐÂY")).toBeNull();
  });

  it("shows a quiet unavailable state without links when the summary could not be read", () => {
    render(<CourseLearningActivity courseSlug="toeic-nen-tang" result={{ success: false, error: "x" }} />);

    expect(screen.getByRole("status").textContent).toContain("Chưa tải được chuỗi ngày học của khóa này");
    expect(screen.queryByRole("link")).toBeNull();
  });
});

describe("CourseStreakChip (workspace header)", () => {
  it("shows the course streak", () => {
    render(<CourseStreakChip summary={{ success: true, data: course({ streak: 5, studiedToday: true }) }} />);

    expect(screen.getByRole("status").textContent).toContain("Chuỗi 5 ngày");
  });

  it("adds a keep-the-streak cue when the learner has not studied today", () => {
    render(<CourseStreakChip summary={{ success: true, data: course({ streak: 5, studiedToday: false }) }} />);

    expect(screen.getByRole("status").textContent).toContain("Học hôm nay để giữ chuỗi");
  });

  it("shows a quiet unavailable status when the summary could not be read", () => {
    render(<CourseStreakChip summary={{ success: false, error: "x" }} />);

    expect(screen.getByRole("status").textContent).toBe("Chưa tải được chuỗi ngày học");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    ["no streak", { success: true as const, data: course() }],
    ["no summary at all", undefined],
  ])("renders nothing for %s", (_name, summary) => {
    const { container } = render(<CourseStreakChip summary={summary} />);

    expect(container.firstChild).toBeNull();
  });
});
