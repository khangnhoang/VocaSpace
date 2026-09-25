// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TopicManagementSheet from "@/app/(teacher)/teacher/courses/[id]/_components/TopicManagementSheet";
import { getTopicBuilderPath } from "@/lib/course-authoring/routes";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn() },
  createTopic: vi.fn(),
  getTopicsByChapterId: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "11111111-1111-4111-8111-111111111111" }),
  useRouter: () => mocks.router,
}));

vi.mock("@/app/actions/topic", () => ({
  createTopic: mocks.createTopic,
  deleteTopic: vi.fn(),
  getTopicsByChapterId: mocks.getTopicsByChapterId,
  updateTopic: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Test plan:
// - Mục tiêu: chứng minh create topic luôn điều hướng bằng id authoritative trả về từ action.
// - Loại test: component interaction trong jsdom.
// - Đối tượng: TopicManagementSheet create flow và router navigation.
// - Case thành công: chapter có 0, 1 hoặc nhiều draft vẫn push đúng topic id mới tạo.
// - Case thất bại: action trả lỗi giữ dialog mở và không điều hướng.
// - Bảo mật/phân quyền: component chỉ chuyển id từ action, không tự chọn draft từ danh sách.
// - Ổn định/resilience: refresh danh sách sau mutation không thay đổi target đã chọn.
// - Invariant cần giữ: builder target là exact returned topic id.

const courseId = "11111111-1111-4111-8111-111111111111";
const chapterId = "22222222-2222-4222-8222-222222222222";
const createdTopicId = "99999999-9999-4999-8999-999999999999";

function existingTopic(index: number) {
  return {
    id: `33333333-3333-4333-8333-33333333333${index}`,
    chapter_id: chapterId,
    title: `Draft ${index}`,
    status: "draft" as const,
    order_index: index,
    created_at: "2026-09-16T00:00:00.000Z",
    canEditContent: true,
    canManageStructure: true,
    canDeleteTopic: true,
  };
}

describe("TopicManagementSheet create navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createTopic.mockResolvedValue({
      data: { id: createdTopicId },
      message: "Đã tạo bài học.",
    });
  });

  it.each([0, 1, 3])("uses the authoritative id with %s existing draft topic(s)", async (draftCount) => {
    mocks.getTopicsByChapterId.mockResolvedValue({
      data: Array.from({ length: draftCount }, (_, index) => existingTopic(index)),
    });

    render(
      <TopicManagementSheet
        chapter={{
          id: chapterId,
          course_id: courseId,
          title: "Chapter",
          order_index: 1,
          created_at: "2026-09-16T00:00:00.000Z",
          updated_at: "2026-09-16T00:00:00.000Z",
          removed_at: null,
          canManage: true,
        }}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Thêm bài học" }));
    fireEvent.change(screen.getByPlaceholderText("Nhập tên bài học..."), {
      target: { value: "New topic" },
    });
    const form = screen.getByPlaceholderText("Nhập tên bài học...").closest("form");
    if (!form) throw new Error("Create form was not rendered");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mocks.createTopic).toHaveBeenCalledWith({
        courseId,
        chapterId,
        title: "New topic",
      });
      expect(mocks.router.push).toHaveBeenCalledWith(
        getTopicBuilderPath(courseId, createdTopicId),
      );
    });
  });

  it("keeps the create dialog open and does not navigate when creation fails", async () => {
    mocks.getTopicsByChapterId.mockResolvedValue({ data: [] });
    mocks.createTopic.mockResolvedValue({ error: "Không thể tạo bài học." });

    render(
      <TopicManagementSheet
        chapter={{
          id: chapterId,
          course_id: courseId,
          title: "Chapter",
          order_index: 1,
          created_at: "2026-09-16T00:00:00.000Z",
          updated_at: "2026-09-16T00:00:00.000Z",
          removed_at: null,
          canManage: true,
        }}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Thêm bài học" }));
    fireEvent.change(screen.getByPlaceholderText("Nhập tên bài học..."), {
      target: { value: "New topic" },
    });
    const form = screen.getByPlaceholderText("Nhập tên bài học...").closest("form");
    if (!form) throw new Error("Create form was not rendered");
    fireEvent.submit(form);

    await waitFor(() => expect(mocks.createTopic).toHaveBeenCalled());
    expect(mocks.router.push).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("Nhập tên bài học...")).toBeTruthy();
  });

  it("keeps topic-level mutations disabled for an outside-group topic while preserving inspection", async () => {
    mocks.getTopicsByChapterId.mockResolvedValue({
      data: [{
        ...existingTopic(0),
        canEditContent: false,
        canManageStructure: false,
        canDeleteTopic: false,
      }],
    });

    render(
      <TopicManagementSheet
        chapter={{
          id: chapterId,
          course_id: courseId,
          title: "Chapter",
          order_index: 1,
          created_at: "2026-09-16T00:00:00.000Z",
          updated_at: "2026-09-16T00:00:00.000Z",
          removed_at: null,
          canManage: true,
        }}
        onClose={vi.fn()}
        onMoveTopic={vi.fn()}
      />,
    );

    await screen.findByText("Draft 0");
    expect((screen.getByRole("button", { name: "Mở trình soạn nội dung bài học Draft 0" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Mở cài đặt bài học Draft 0" }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Sửa bài học Draft 0" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Xóa bài học Draft 0" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole("button", { name: 'Di chuyển bài học "Draft 0" lên' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getAllByRole("button", { name: 'Di chuyển bài học "Draft 0" xuống' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });

  it("keeps all topic mutations disabled while the topic is pending", async () => {
    mocks.getTopicsByChapterId.mockResolvedValue({
      data: [{ ...existingTopic(0), status: "pending" }],
    });

    render(
      <TopicManagementSheet
        chapter={{
          id: chapterId,
          course_id: courseId,
          title: "Chapter",
          order_index: 1,
          created_at: "2026-09-16T00:00:00.000Z",
          updated_at: "2026-09-16T00:00:00.000Z",
          removed_at: null,
          canManage: true,
        }}
        onClose={vi.fn()}
        onMoveTopic={vi.fn()}
      />,
    );

    await screen.findByText("Draft 0");
    expect((screen.getByRole("button", { name: "Sửa bài học Draft 0" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Xóa bài học Draft 0" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole("button", { name: 'Di chuyển bài học "Draft 0" lên' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getAllByRole("button", { name: 'Di chuyển bài học "Draft 0" xuống' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });

  // D31/D32/D37: the three capabilities are independent, so each gate must be
  // driven by its own field rather than by one shared boolean.
  it("gates rename, reorder and delete on their own capability", async () => {
    mocks.getTopicsByChapterId.mockResolvedValue({
      data: [
        { ...existingTopic(0), canEditContent: false, canManageStructure: true, canDeleteTopic: false },
        { ...existingTopic(1), canEditContent: false, canManageStructure: true, canDeleteTopic: false },
      ],
    });

    render(
      <TopicManagementSheet
        chapter={{
          id: chapterId,
          course_id: courseId,
          title: "Chapter",
          order_index: 1,
          created_at: "2026-09-16T00:00:00.000Z",
          updated_at: "2026-09-16T00:00:00.000Z",
          removed_at: null,
          canManage: true,
        }}
        onClose={vi.fn()}
        onMoveTopic={vi.fn()}
      />,
    );

    await screen.findByText("Draft 0");
    expect((screen.getByRole("button", { name: "Sửa bài học Draft 0" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Xóa bài học Draft 0" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole("button", { name: 'Di chuyển bài học "Draft 0" xuống' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(false);
  });


  it("supports keyboard selection of a second topic and exposes its Preview marker controls", async () => {
    const onPreviewMarkersChange = vi.fn();
    const topic0 = existingTopic(0);
    const topic1 = { ...existingTopic(1), title: "Draft 1" };

    mocks.getTopicsByChapterId.mockResolvedValue({
      data: [topic0, topic1],
    });

    render(
      <TopicManagementSheet
        chapter={{
          id: chapterId,
          course_id: courseId,
          title: "Chapter",
          order_index: 1,
          created_at: "2026-09-16T00:00:00.000Z",
          updated_at: "2026-09-16T00:00:00.000Z",
          removed_at: null,
          canManage: true,
        }}
        onClose={vi.fn()}
        onPreviewMarkersChange={onPreviewMarkersChange}
        canManagePreviewMarkers={true}
        previewAllocation={{
          courseId,
          activeTopicCount: 2,
          markedTopicCount: 1,
          cap: 1,
          remaining: 0,
          excess: 0,
          isSuspended: false,
          causeVerified: null,
          cause: null,
          markedTopics: [{ id: topic1.id, title: "Draft 1", chapterId: chapterId, chapterTitle: "Chapter", chapterOrderIndex: 1, status: "draft" as const }],
        }}
      />,
    );

    await screen.findByText("Draft 0");
    const secondTopicBtn = screen.getByRole("button", {
      name: "Chọn bài học 1. Draft 1",
    });
    expect(secondTopicBtn.getAttribute("aria-pressed")).toBe("false");

    // Keyboard selection (click/Enter)
    fireEvent.click(secondTopicBtn);

    expect(secondTopicBtn.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { level: 3, name: "Draft 1" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Xóa bài học Draft 1" })).not.toBeNull();
    expect(screen.getByRole("checkbox", { name: "Bỏ nhãn xem thử: Draft 1" })).not.toBeNull();
  });

  it("renders reorder error visibly as an accessible alert inside the sheet", async () => {
    mocks.getTopicsByChapterId.mockResolvedValue({
      data: [existingTopic(0)],
    });

    render(
      <TopicManagementSheet
        chapter={{
          id: chapterId,
          course_id: courseId,
          title: "Chapter",
          order_index: 1,
          created_at: "2026-09-16T00:00:00.000Z",
          updated_at: "2026-09-16T00:00:00.000Z",
          removed_at: null,
          canManage: true,
        }}
        onClose={vi.fn()}
        moveError="Không thể thay đổi thứ tự bài học do mạng gián đoạn."
      />,
    );

    await screen.findByText("Draft 0");
    const alert = screen.getByRole("alert");
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain("Không thể thay đổi thứ tự bài học do mạng gián đoạn.");
  });
});
