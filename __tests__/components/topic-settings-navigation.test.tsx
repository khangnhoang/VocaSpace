// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsTab from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/SettingsTab";

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn() },
  getTopicById: vi.fn(),
  updateTopic: vi.fn(),
  deleteTopic: vi.fn(),
  getTopicDeletePreviewProjection: vi.fn(),
  getCoursePreviewAllocation: vi.fn(),
  setCourseTopicPreviewMarkers: vi.fn(),
  confirmPublishedTopicMutation: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/app/actions/topic", () => ({
  getTopicById: mocks.getTopicById,
  updateTopic: mocks.updateTopic,
  deleteTopic: mocks.deleteTopic,
}));

vi.mock("@/app/actions/course-preview", () => ({
  getTopicDeletePreviewProjection: mocks.getTopicDeletePreviewProjection,
  getCoursePreviewAllocation: mocks.getCoursePreviewAllocation,
  setCourseTopicPreviewMarkers: mocks.setCourseTopicPreviewMarkers,
}));

vi.mock("@/lib/course-authoring/topic-workflow", () => ({
  confirmPublishedTopicMutation: mocks.confirmPublishedTopicMutation,
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));

// Test plan:
// - Mục tiêu: xác nhận xóa bài học dùng projection quota trước khi điều hướng khỏi Builder.
// - Loại test: component interaction trong jsdom.
// - Case thành công: projection cho biết không cần gỡ nhãn, action ẩn bài học rồi điều hướng về Structure.
// - Case thất bại: action error giữ dialog mở, hiện lỗi và cho phép thử lại.
// - Bảo mật/phân quyền: action nhận confirmPublished và danh sách gỡ nhãn đã chọn từ dialog.
// - Ổn định/resilience: projection chưa tải xong thì xác nhận bị khóa; danh sách gỡ nhãn rỗng vẫn được gửi tường minh.
// - Invariant cần giữ: Builder chỉ điều hướng sau mutation thành công.

const topicId = "22222222-2222-4222-8222-222222222222";

describe("SettingsTab topic deletion navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTopicById.mockResolvedValue({
      data: { title: "Bài học cần ẩn", status: "draft" },
    });
    mocks.getCoursePreviewAllocation.mockResolvedValue({ data: null });
    mocks.getTopicDeletePreviewProjection.mockResolvedValue({
      data: {
        courseId: "11111111-1111-4111-8111-111111111111",
        topicId,
        currentAllocation: {
          courseId: "11111111-1111-4111-8111-111111111111",
          activeTopicCount: 1,
          markedTopicCount: 0,
          cap: 1,
          remaining: 1,
          excess: 0,
          isSuspended: false,
          causeVerified: null,
          cause: null,
          markedTopics: [],
        },
        projectedActiveTopicCount: 0,
        projectedMarkedTopicCount: 0,
        projectedCap: 0,
        requiredUnmarkCount: 0,
        targetIsPreview: false,
        canManageMarkers: false,
        outsideMarkedTopics: [],
      },
    });
    mocks.deleteTopic.mockResolvedValue({ success: true, message: "Đã ẩn bài học." });
  });

  it("uses the projection and redirects only after a successful delete", async () => {
    render(<SettingsTab topicId={topicId} courseId="11111111-1111-4111-8111-111111111111" topicStatus="draft" canManagePreviewMarkers={false} />);

    await screen.findByDisplayValue("Bài học cần ẩn");
    fireEvent.click(screen.getByRole("button", { name: "Xóa bài học này" }));
    await waitFor(() => expect(mocks.getTopicDeletePreviewProjection).toHaveBeenCalledWith(topicId));
    fireEvent.click(await screen.findByRole("button", { name: "Xóa bài học" }));

    await waitFor(() => expect(mocks.deleteTopic).toHaveBeenCalledWith({
      topicId,
      confirmPublished: false,
      unmarkTopicIds: [],
    }));
    expect(mocks.router.replace).toHaveBeenCalledWith("/teacher/courses/11111111-1111-4111-8111-111111111111/structure");
    expect(mocks.getTopicById).toHaveBeenCalledTimes(1);
  });

  it("stays on the Builder and restores retry state when delete fails", async () => {
    mocks.deleteTopic.mockResolvedValue({ error: "Không thể ẩn bài học." });
    render(<SettingsTab topicId={topicId} courseId="11111111-1111-4111-8111-111111111111" topicStatus="draft" canManagePreviewMarkers={false} />);

    await screen.findByDisplayValue("Bài học cần ẩn");
    fireEvent.click(screen.getByRole("button", { name: "Xóa bài học này" }));
    await waitFor(() => expect(mocks.getTopicDeletePreviewProjection).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: "Xóa bài học" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Không thể ẩn bài học.");
    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Xóa bài học" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
