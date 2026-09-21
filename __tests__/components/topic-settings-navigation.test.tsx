// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsTab from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/SettingsTab";

const mocks = vi.hoisted(() => ({
  getTopicById: vi.fn(),
  updateTopic: vi.fn(),
  deleteTopicFromBuilder: vi.fn(),
  confirmPublishedTopicMutation: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/app/actions/topic", () => ({
  getTopicById: mocks.getTopicById,
  updateTopic: mocks.updateTopic,
  deleteTopicFromBuilder: mocks.deleteTopicFromBuilder,
}));

vi.mock("@/lib/course-authoring/topic-workflow", () => ({
  confirmPublishedTopicMutation: mocks.confirmPublishedTopicMutation,
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));

vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: ({ isOpen, onConfirm, confirmText, description }: {
    isOpen: boolean;
    onConfirm: () => void;
    confirmText: string;
    description: string;
  }) => isOpen ? (
    <div role="dialog">
      <p>{description}</p>
      <button type="button" onClick={onConfirm}>{confirmText}</button>
    </div>
  ) : null,
}));

// Test plan:
// - Mục tiêu: xác nhận xóa bài học điều hướng khỏi Builder trước khi effect đọc lại workflow của bài học đã ẩn.
// - Loại test: component interaction trong jsdom.
// - Case thành công: mutation Builder dùng action redirect server-side và chỉ đọc topic một lần ở client.
// - Case thất bại: action error giữ nguyên route, hiện toast và cho phép retry.
// - Bảo mật/phân quyền: component vẫn truyền confirmPublished theo quyền/trạng thái hiện tại, không tự bypass action boundary.
// - Ổn định/resilience: route transition không phụ thuộc vào một lần đọc lại topic đã bị xóa khỏi cấu trúc.
// - Invariant cần giữ: không còn stale workflow read sau khi delete thành công.

const topicId = "22222222-2222-4222-8222-222222222222";

describe("SettingsTab topic deletion navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTopicById.mockResolvedValue({
      data: { title: "Bài học cần ẩn", status: "draft" },
    });
    mocks.deleteTopicFromBuilder.mockResolvedValue(undefined);
  });

  it("delegates successful delete navigation to the Builder-specific Server Action", async () => {
    render(<SettingsTab topicId={topicId} />);

    await screen.findByDisplayValue("Bài học cần ẩn");
    fireEvent.click(screen.getByRole("button", { name: "Ẩn bài học này" }));
    fireEvent.click(screen.getByRole("button", { name: "Ẩn bài học" }));

    await waitFor(() => expect(mocks.deleteTopicFromBuilder).toHaveBeenCalledWith({
      topicId,
      confirmPublished: false,
    }));
    expect(mocks.getTopicById).toHaveBeenCalledTimes(1);
  });

  it("stays on the Builder and restores retry state when delete fails", async () => {
    mocks.deleteTopicFromBuilder.mockResolvedValue({ error: "Không thể ẩn bài học." });
    render(<SettingsTab topicId={topicId} />);

    await screen.findByDisplayValue("Bài học cần ẩn");
    fireEvent.click(screen.getByRole("button", { name: "Ẩn bài học này" }));
    fireEvent.click(screen.getByRole("button", { name: "Ẩn bài học" }));

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("Không thể ẩn bài học."));
    expect((screen.getByRole("button", { name: "Ẩn bài học này" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
