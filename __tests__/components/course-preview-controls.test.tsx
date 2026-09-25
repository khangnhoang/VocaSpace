// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type {
  ChapterHidePreviewProjection,
  CoursePreviewAllocation,
  TopicDeletePreviewProjection,
} from "@/lib/schemas/course-preview";
import {
  CoursePreviewAllocationCard,
  CoursePreviewOverviewNotice,
  PreviewSuspensionNotice,
  TopicPreviewMarkerToggle,
} from "@/app/(teacher)/teacher/courses/[id]/_components/course-preview-controls";
import PreviewQuotaResolutionDialog from "@/app/(teacher)/teacher/courses/[id]/_components/PreviewQuotaResolutionDialog";

const actionMocks = vi.hoisted(() => ({ getCoursePreviewAllocation: vi.fn(), setCourseTopicPreviewMarkers: vi.fn() }));

vi.mock("@/app/actions/course-preview", () => ({
  getCoursePreviewAllocation: actionMocks.getCoursePreviewAllocation,
  setCourseTopicPreviewMarkers: actionMocks.setCourseTopicPreviewMarkers,
}));

// Test plan:
// - Mục tiêu: xác minh quyền xem thử, quota và batch recovery qua hành vi UI thật.
// - Loại test: component interaction trong jsdom.
// - Thành công: người quản lý xem M/cap, gỡ đủ nhãn trong một mutation, thấy marker nội bộ tự gỡ khi ẩn chương và dùng toggle từ Settings/list.
// - Thất bại/biên: quota đầy khóa lựa chọn mới; thiếu quyền không thấy audit detail hoặc không thể gỡ nhãn ngoài mục; hủy dialog không chạy mutation.
// - Bảo mật/phân quyền: `canManage` quyết định chi tiết kiểm duyệt và thao tác marker; action vẫn nhận đúng ID đã chọn.
// - Ổn định/resilience: projected count phản ánh lựa chọn trước khi xác nhận; không có mutation trước thao tác xác nhận.
// - Invariant cần giữ: UI gửi đúng danh sách chọn, còn RPC là authority cuối cùng cho quota và quyền.

const courseId = "11111111-1111-4111-8111-111111111111";
const topicIds = [
  "22222222-2222-4222-8222-222222222221",
  "22222222-2222-4222-8222-222222222222",
  "22222222-2222-4222-8222-222222222223",
  "22222222-2222-4222-8222-222222222224",
  "22222222-2222-4222-8222-222222222225",
];
const deleteTargetId = "66666666-6666-4666-8666-666666666666";

function suspendedAllocation(): CoursePreviewAllocation {
  const markedTopics = topicIds.map((id, index) => ({
    id,
    title: `Bài học ${index + 1}`,
    status: (index === 0 ? "pending" : "published") as "pending" | "published",
    chapterId: "33333333-3333-4333-8333-333333333333",
    chapterTitle: "Chương 1",
    chapterOrderIndex: 1,
  }));
  return {
    courseId,
    activeTopicCount: 20,
    markedTopicCount: 5,
    cap: 4,
    remaining: 0,
    excess: 1,
    isSuspended: true,
    causeVerified: true,
    cause: {
      action: "takedown",
      reason: "Nội dung cần được rà soát.",
      targetType: "topic",
      targetLabel: "Bài học liên quan",
    },
    markedTopics,
  };
}

function deleteProjection(canManageMarkers: boolean): TopicDeletePreviewProjection {
  const allocation = suspendedAllocation();
  return {
    courseId,
    topicId: deleteTargetId,
    currentAllocation: allocation,
    projectedActiveTopicCount: 15,
    projectedMarkedTopicCount: 5,
    projectedCap: 3,
    requiredUnmarkCount: 2,
    targetIsPreview: false,
    canManageMarkers,
    outsideMarkedTopics: allocation.markedTopics.slice(0, 5),
  };
}

function chapterProjection(): ChapterHidePreviewProjection {
  const allocation = suspendedAllocation();
  return {
    courseId,
    chapterId: "33333333-3333-4333-8333-333333333333",
    currentAllocation: allocation,
    projectedActiveTopicCount: 15,
    projectedMarkedTopicCount: 3,
    projectedCap: 3,
    requiredUnmarkCount: 0,
    internalActiveTopicCount: 2,
    internalMarkedTopicCount: 2,
    outsideMarkedTopics: [],
    canManageMarkers: false,
  };
}

describe("course preview controls", () => {
  it("does not fetch moderation details for a previewer and loads the authorized overview warning", async () => {
    actionMocks.getCoursePreviewAllocation.mockResolvedValue({ data: suspendedAllocation() });
    const { container, rerender } = render(
      <CoursePreviewOverviewNotice courseId={courseId} canManage={false} />,
    );
    expect(container.firstChild).toBeNull();
    expect(actionMocks.getCoursePreviewAllocation).not.toHaveBeenCalled();

    rerender(<CoursePreviewOverviewNotice courseId={courseId} canManage />);
    expect(await screen.findByText("Xem trước bài học đang tạm thời bị vô hiệu hóa")).toBeTruthy();
    expect(screen.getByText(/Lý do: Nội dung cần được rà soát\./)).toBeTruthy();
    expect(actionMocks.getCoursePreviewAllocation).toHaveBeenCalledWith(courseId);
    expect(screen.getByRole("link", { name: "Điều chỉnh bài học xem thử" }).getAttribute("href"))
      .toBe("/teacher/courses/11111111-1111-4111-8111-111111111111/structure");
  });

  it("keeps the quota-full marker discoverable but blocks an additional selection", () => {
    const onChange = vi.fn();
    const onShowAllocation = vi.fn();
    render(
      <TopicPreviewMarkerToggle
        topicId={"44444444-4444-4444-8444-444444444444"}
        title="Bài học mới"
        status="pending"
        allocation={suspendedAllocation()}
        canManage
        isUpdating={false}
        onChange={onChange}
        onShowAllocation={onShowAllocation}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Đánh dấu xem thử: Bài học mới" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Bài học chưa xuất bản vẫn tính vào giới hạn nhưng chưa mở công khai.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xem danh sách đã chọn" }));
    expect(onShowAllocation).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps an existing pending marker removable because preview status is not a content edit", () => {
    const onChange = vi.fn().mockResolvedValue({ success: true });
    const allocation = suspendedAllocation();
    render(
      <TopicPreviewMarkerToggle
        topicId={topicIds[0]}
        title="Bài học 1"
        status="pending"
        allocation={allocation}
        canManage
        isUpdating={false}
        onChange={onChange}
      />,
    );

    const checkbox = screen.getByRole("checkbox", { name: "Bỏ nhãn xem thử: Bài học 1" });
    expect((checkbox as HTMLInputElement).disabled).toBe(false);
    fireEvent.click(checkbox);
    expect(onChange).toHaveBeenCalledWith({ unmarkTopicIds: [topicIds[0]] });
  });

  it("shows moderation cause only to managers and applies selected marker removals as one batch", async () => {
    const allocation = suspendedAllocation();
    const onChange = vi.fn().mockResolvedValue({ success: true, allocation: { ...allocation, markedTopicCount: 4, excess: 0, isSuspended: false } });

    const { rerender } = render(<PreviewSuspensionNotice allocation={allocation} canManage={false} />);
    expect(screen.queryByText("Nội dung cần được rà soát.")).toBeNull();

    rerender(<PreviewSuspensionNotice allocation={allocation} canManage />);
    expect(screen.getByText(/Lý do: Nội dung cần được rà soát\./)).toBeTruthy();
    expect(screen.getByText(/quản trị viên nền tảng/)).toBeTruthy();

    render(
      <CoursePreviewAllocationCard
        allocation={allocation}
        isLoading={false}
        isUpdating={false}
        error={null}
        canManage
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Xem bài học đã chọn" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Bỏ nhãn xem thử cho Bài học 1" }));
    expect(screen.getByText("Dự kiến sau khi bỏ nhãn: 4/4 · Cần bỏ ít nhất 1")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Bỏ nhãn đã chọn" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ unmarkTopicIds: [topicIds[0]] }));
  });

  it("requires enough outside selections and sends no deletion before confirmation", async () => {
    const onConfirm = vi.fn().mockResolvedValue({ success: true });
    render(
      <PreviewQuotaResolutionDialog
        open
        setOpen={vi.fn()}
        targetType="topic"
        targetId={deleteTargetId}
        targetTitle="Bài học cần ẩn"
        description="Nội dung sẽ được giữ lại."
        confirmText="Ẩn bài học"
        loadingText="Đang ẩn…"
        getProjection={async () => ({ data: deleteProjection(true) })}
        onConfirm={onConfirm}
      />,
    );

    await screen.findByText("Cần chọn bài học xem thử để gỡ nhãn");
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("checkbox", { name: "Bỏ nhãn xem thử cho Bài học 1" }),
      );
    });
    expect((screen.getByRole("button", { name: "Ẩn bài học" }) as HTMLButtonElement).disabled).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: "Bỏ nhãn xem thử cho Bài học 1" }));
    expect((screen.getByRole("button", { name: "Ẩn bài học" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "Bỏ nhãn xem thử cho Bài học 2" }));
    expect(screen.getByText("Đã chọn 2/2 · Dự kiến còn 3/3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ẩn bài học" }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith([topicIds[0], topicIds[1]]));
  });

  it("explains automatic internal marker cleanup and cancellation does not mutate", async () => {
    const onConfirm = vi.fn();
    const setOpen = vi.fn();
    render(
      <PreviewQuotaResolutionDialog
        open
        setOpen={setOpen}
        targetType="chapter"
        targetId="33333333-3333-4333-8333-333333333333"
        targetTitle="Chương có bài xem thử"
        description="Chương sẽ được ẩn."
        confirmText="Ẩn chương"
        loadingText="Đang ẩn…"
        getProjection={async () => ({ data: chapterProjection() })}
        onConfirm={onConfirm}
      />,
    );

    expect(await screen.findByText("2 nhãn xem thử trong chương sẽ được gỡ tự động.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Ẩn chương" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Hủy bỏ" }));

    expect(setOpen).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("retains still-valid selections when a stale mutation returns a fresh projection", async () => {
    const freshProjection = {
      ...deleteProjection(true),
      projectedActiveTopicCount: 20,
      projectedMarkedTopicCount: 5,
      projectedCap: 4,
      requiredUnmarkCount: 1,
    };
    const onConfirm = vi.fn().mockResolvedValue({
      error: "Phân bổ bài học xem thử đã thay đổi. Hãy tải lại và chọn đủ bài học cần bỏ xem thử.",
      previewProjection: freshProjection,
    });
    render(
      <PreviewQuotaResolutionDialog
        open
        setOpen={vi.fn()}
        targetType="topic"
        targetId={deleteTargetId}
        targetTitle="Bài học cần ẩn"
        description="Nội dung sẽ được giữ lại."
        confirmText="Ẩn bài học"
        loadingText="Đang ẩn…"
        getProjection={async () => ({ data: deleteProjection(true) })}
        onConfirm={onConfirm}
      />,
    );

    await screen.findByText("Cần chọn bài học xem thử để gỡ nhãn");
    fireEvent.click(screen.getByRole("checkbox", { name: "Bỏ nhãn xem thử cho Bài học 1" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Bỏ nhãn xem thử cho Bài học 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Ẩn bài học" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Phân bổ bài học xem thử đã thay đổi");
    expect((screen.getByRole("checkbox", { name: "Bỏ nhãn xem thử cho Bài học 1" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: "Bỏ nhãn xem thử cho Bài học 2" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText("Đã chọn 2/1 · Dự kiến còn 3/4")).toBeTruthy();
  });

  it("offers a handoff and blocks resolution when the actor cannot unmark outside topics", async () => {
    const onConfirm = vi.fn();
    render(
      <PreviewQuotaResolutionDialog
        open
        setOpen={vi.fn()}
        targetType="topic"
        targetId={deleteTargetId}
        targetTitle="Bài học cần ẩn"
        description="Nội dung sẽ được giữ lại."
        confirmText="Ẩn bài học"
        loadingText="Đang ẩn…"
        getProjection={async () => ({ data: deleteProjection(false) })}
        onConfirm={onConfirm}
      />,
    );

    expect((await screen.findByRole("alert")).textContent).toContain("Hãy nhờ chủ khóa học");
    expect((screen.getByRole("button", { name: "Ẩn bài học" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("checkbox", { name: "Bỏ nhãn xem thử cho Bài học 1" })).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("honors the pending-child freeze before opening a chapter hide mutation", async () => {
    const onConfirm = vi.fn();
    render(
      <PreviewQuotaResolutionDialog
        open
        setOpen={vi.fn()}
        targetType="chapter"
        targetId="33333333-3333-4333-8333-333333333333"
        targetTitle="Chương đang chờ duyệt"
        description="Chương sẽ được ẩn."
        confirmText="Ẩn chương"
        loadingText="Đang ẩn…"
        getProjection={async () => ({ error: "Chương có bài học đang chờ duyệt; hãy xử lý quy trình duyệt trước khi ẩn chương." })}
        onConfirm={onConfirm}
      />,
    );

    expect((await screen.findByRole("alert")).textContent).toContain("đang chờ duyệt");
    expect((screen.getByRole("button", { name: "Ẩn chương" }) as HTMLButtonElement).disabled).toBe(true);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
