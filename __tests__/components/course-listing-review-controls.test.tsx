// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CourseOverview from "@/app/(teacher)/teacher/courses/[id]/_components/CourseOverview";
import type { CourseDashboardReadiness } from "@/lib/schemas/course-readiness";

const mocks = vi.hoisted(() => ({
  submitCourseReview: vi.fn(),
  withdrawCourseReview: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/actions/course-review", () => ({
  submitCourseReview: mocks.submitCourseReview,
  withdrawCourseReview: mocks.withdrawCourseReview,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));
// Các panel khác trong dashboard tự gọi action khi mount; trả kết quả rỗng để chúng không ảnh hưởng.
vi.mock("@/app/actions/course-collaborator", () => ({
  getCourseCollaboratorMembers: vi.fn().mockResolvedValue({ error: "unavailable" }),
  getCurrentUserGlobalRole: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/app/actions/course-preview", () => ({
  getCoursePreviewAllocation: vi.fn().mockResolvedValue({ data: null }),
  setCourseTopicPreviewMarkers: vi.fn(),
}));

// Test plan:
// - Mục tiêu: kiểm tra giáo viên gửi duyệt / rút yêu cầu duyệt khóa học (AD2 AC8) qua màn hình tổng quan thật.
// - Loại test: component interaction trong jsdom, render qua CourseOverview cho cả hai nhánh (đủ chương và chưa có chương).
// - Case thành công: owner/co_owner gửi duyệt khi có bài đã xuất bản; rút yêu cầu duyệt sau khi xác nhận; toast thành công rồi refresh.
// - Case thất bại: chưa có bài đã xuất bản thì nút bị khóa kèm gợi ý; Server Action trả lỗi thì hiện toast lỗi và không refresh; hủy dialog không gọi action.
// - Bảo mật/phân quyền: course đã xuất bản và editor không thấy nút nào; quyền thật nằm ở RPC (integration test).
// - Hiển thị: lý do từ chối chỉ hiện trên bản nháp đã bị admin từ chối, ở cả hai nhánh.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/components/course-listing-review-controls.test.tsx`.

const courseId = "11111111-1111-4111-8111-111111111111";
// Hai read phụ của Tổng quan để treo: suite này chỉ kiểm phần render từ readiness, không kiểm số liệu.
const pendingRead = new Promise<never>(() => {});


function makeReadiness(
  overrides: {
    role?: CourseDashboardReadiness["role"];
    status?: CourseDashboardReadiness["course"]["status"];
    publishedTopicCount?: number;
    chapters?: number;
    rejectMessage?: string | null;
    reviewedAt?: string | null;
  } = {},
): CourseDashboardReadiness {
  return {
    role: overrides.role ?? "owner",
    course: {
      id: courseId,
      title: "Khóa học TOEIC",
      slug: "khoa-hoc-toeic",
      description: "Mô tả",
      thumbnail_url: null,
      price: 0,
      status: overrides.status ?? "draft",
      order_index: 1,
      reject_message: overrides.rejectMessage ?? null,
      reviewed_at: overrides.reviewedAt ?? null,
    },
    counts: {
      chapters: overrides.chapters ?? 2,
      topics: 3,
      flashcards: 4,
      exercises: 2,
      questionGroups: 0,
      questions: 5,
      answerOptions: 10,
    },
    publishedTopicCount: overrides.publishedTopicCount ?? 1,
    issues: [],
    primaryCta: {
      id: `primary:course:${courseId}:structure`,
      label: "Quản lý cấu trúc",
      destination: {
        type: "course_structure",
        courseId,
        href: `/teacher/courses/${courseId}/structure`,
      },
      sourceIssueId: null,
      sourceIssueCode: null,
    },
  };
}

const branches = [
  { name: "full dashboard", chapters: 2 },
  { name: "no-chapter dashboard", chapters: 0 },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe.each(branches)("course listing review controls on the $name", ({ chapters }) => {
  it.each(["owner", "co_owner"] as const)(
    "lets the %s submit a draft that has a published topic",
    async (role) => {
      mocks.submitCourseReview.mockResolvedValueOnce({
        success: true,
        data: { course_id: courseId, status: "pending" },
      });
      render(<CourseOverview insights={pendingRead} portfolio={pendingRead} readiness={makeReadiness({ role, chapters })} />);

      const button = screen.getByRole("button", { name: "Gửi duyệt" });
      expect((button as HTMLButtonElement).disabled).toBe(false);
      expect(
        screen.queryByText("Cần ít nhất 1 bài học đã xuất bản để gửi duyệt."),
      ).toBeNull();

      fireEvent.click(button);

      await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
      expect(mocks.submitCourseReview).toHaveBeenCalledWith({ courseId });
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Đã gửi khóa học để duyệt.");
      expect(mocks.toastError).not.toHaveBeenCalled();
    },
  );

  it("shows a busy label and blocks a second submit while the request is pending", async () => {
    let resolveSubmit: (value: unknown) => void = () => {};
    mocks.submitCourseReview.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      }),
    );
    render(<CourseOverview insights={pendingRead} portfolio={pendingRead} readiness={makeReadiness({ chapters })} />);

    fireEvent.click(screen.getByRole("button", { name: "Gửi duyệt" }));

    const busy = (await screen.findByRole("button", {
      name: "Đang gửi duyệt...",
    })) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(busy.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(busy);
    expect(mocks.submitCourseReview).toHaveBeenCalledTimes(1);

    resolveSubmit({ success: true, data: { course_id: courseId, status: "pending" } });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });

  it("disables submit with a hint while no topic is published", () => {
    render(
      <CourseOverview insights={pendingRead} portfolio={pendingRead}
        readiness={makeReadiness({ publishedTopicCount: 0, chapters })}
      />,
    );

    expect(
      (screen.getByRole("button", { name: "Gửi duyệt" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      screen.getByText("Cần ít nhất 1 bài học đã xuất bản để gửi duyệt."),
    ).toBeTruthy();
    expect(mocks.submitCourseReview).not.toHaveBeenCalled();
  });

  it("shows the mapped error toast and keeps the page when submit fails", async () => {
    mocks.submitCourseReview.mockResolvedValueOnce({
      error: "Trạng thái khóa học đã thay đổi. Vui lòng tải lại trang.",
    });
    render(<CourseOverview insights={pendingRead} portfolio={pendingRead} readiness={makeReadiness({ chapters })} />);

    fireEvent.click(screen.getByRole("button", { name: "Gửi duyệt" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Trạng thái khóa học đã thay đổi. Vui lòng tải lại trang.",
      ),
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("withdraws a pending course only after the confirm dialog", async () => {
    mocks.withdrawCourseReview.mockResolvedValueOnce({
      success: true,
      data: { course_id: courseId, status: "draft" },
    });
    render(
      <CourseOverview insights={pendingRead} portfolio={pendingRead} readiness={makeReadiness({ status: "pending", chapters })} />,
    );

    expect(screen.queryByRole("button", { name: "Gửi duyệt" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Rút yêu cầu duyệt" }));
    expect(mocks.withdrawCourseReview).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole("button", { name: "Rút yêu cầu" }));

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(mocks.withdrawCourseReview).toHaveBeenCalledWith({ courseId });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Đã rút yêu cầu duyệt.");
  });

  it("shows a busy label in the confirm dialog while the withdraw is pending", async () => {
    let resolveWithdraw: (value: unknown) => void = () => {};
    mocks.withdrawCourseReview.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveWithdraw = resolve;
      }),
    );
    render(
      <CourseOverview insights={pendingRead} portfolio={pendingRead} readiness={makeReadiness({ status: "pending", chapters })} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rút yêu cầu duyệt" }));
    fireEvent.click(await screen.findByRole("button", { name: "Rút yêu cầu" }));

    const busy = (await screen.findByRole("button", {
      name: "Đang rút...",
    })) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(busy.getAttribute("aria-busy")).toBe("true");

    resolveWithdraw({ success: true, data: { course_id: courseId, status: "draft" } });
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });

  it("does not withdraw when the confirm dialog is cancelled", async () => {
    render(
      <CourseOverview insights={pendingRead} portfolio={pendingRead} readiness={makeReadiness({ status: "pending", chapters })} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rút yêu cầu duyệt" }));
    fireEvent.click(await screen.findByRole("button", { name: "Hủy bỏ" }));

    expect(mocks.withdrawCourseReview).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("shows the error toast and does not refresh when withdraw fails", async () => {
    mocks.withdrawCourseReview.mockResolvedValueOnce({
      error: "Trạng thái khóa học đã thay đổi. Vui lòng tải lại trang.",
    });
    render(
      <CourseOverview insights={pendingRead} portfolio={pendingRead} readiness={makeReadiness({ status: "pending", chapters })} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rút yêu cầu duyệt" }));
    fireEvent.click(await screen.findByRole("button", { name: "Rút yêu cầu" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("shows no review control on a published course", () => {
    render(
      <CourseOverview insights={pendingRead} portfolio={pendingRead}
        readiness={makeReadiness({ status: "published", chapters })}
      />,
    );

    expect(screen.queryByRole("button", { name: "Gửi duyệt" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rút yêu cầu duyệt" })).toBeNull();
    expect(screen.getAllByText("Đã xuất bản").length).toBeGreaterThan(0);
  });

  it.each(["draft", "pending"] as const)(
    "shows an editor the %s badge but no review control",
    (status) => {
      render(
        <CourseOverview insights={pendingRead} portfolio={pendingRead}
          readiness={makeReadiness({ role: "editor", status, chapters })}
        />,
      );

      expect(screen.queryByRole("button", { name: "Gửi duyệt" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Rút yêu cầu duyệt" })).toBeNull();
      expect(
        screen.getAllByText(status === "draft" ? "Bản nháp" : "Chờ duyệt").length,
      ).toBeGreaterThan(0);
    },
  );

  it("shows the rejection reason on a rejected draft", () => {
    render(
      <CourseOverview insights={pendingRead} portfolio={pendingRead}
        readiness={makeReadiness({
          chapters,
          rejectMessage: "Nội dung bài 1 còn thiếu phần giải thích.",
          reviewedAt: "2026-10-14T00:00:00.000Z",
        })}
      />,
    );

    expect(screen.getByText("Yêu cầu duyệt bị từ chối")).toBeTruthy();
    expect(
      screen.getByText("Nội dung bài 1 còn thiếu phần giải thích."),
    ).toBeTruthy();
  });

  it.each([
    ["a draft that was never reviewed", { rejectMessage: null, reviewedAt: null }],
    [
      "a pending course",
      {
        status: "pending" as const,
        rejectMessage: "Lý do cũ.",
        reviewedAt: "2026-10-14T00:00:00.000Z",
      },
    ],
  ])("hides the rejection reason for %s", (_label, overrides) => {
    render(
      <CourseOverview insights={pendingRead} portfolio={pendingRead} readiness={makeReadiness({ chapters, ...overrides })} />,
    );

    expect(screen.queryByText("Yêu cầu duyệt bị từ chối")).toBeNull();
  });
});
