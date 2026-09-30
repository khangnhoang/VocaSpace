// @vitest-environment jsdom

import React, { useSyncExternalStore } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChapterNavigator, {
  CHAPTER_SEARCH_THRESHOLD,
} from "@/app/(teacher)/teacher/courses/[id]/_components/ChapterNavigator";
import ChapterWorkbench, {
  type MoveErrorState,
} from "@/app/(teacher)/teacher/courses/[id]/_components/ChapterWorkbench";
import CourseStructureWorkspace from "@/app/(teacher)/teacher/courses/[id]/_components/CourseStructureWorkspace";
import type { Chapter, Topic } from "@/app/(teacher)/teacher/courses/[id]/_components/types";
import type { CoursePreviewAllocation } from "@/lib/schemas/course-preview";
import { getTopicBuilderPath } from "@/lib/course-authoring/routes";

// Radix Popper đo kích thước qua ResizeObserver, mà jsdom không có API này.
// Stub tối thiểu để menu chạy được; đây không phải hành vi đang được test.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

// Next.js đồng bộ `history.replaceState` với `useSearchParams`; mock giữ đúng hợp đồng đó
// để việc chọn chương (chỉ ghi URL, không gọi server) được kiểm tra như trên trình duyệt.
const urlListeners = new Set<() => void>();
const nativeReplaceState = window.history.replaceState.bind(window.history);
window.history.replaceState = (...args: Parameters<History["replaceState"]>) => {
  nativeReplaceState(...args);
  urlListeners.forEach((listener) => listener());
};
function subscribeUrl(listener: () => void) {
  urlListeners.add(listener);
  return () => urlListeners.delete(listener);
}

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  createTopic: vi.fn(),
  deleteTopic: vi.fn(),
  getTopicsByChapterId: vi.fn(),
  updateTopic: vi.fn(),
  getCourseStats: vi.fn(),
  moveTopicOrder: vi.fn(),
  verifyCourseAccess: vi.fn(),
  getChaptersByCourseId: vi.fn(),
  getDeletedChaptersByCourseId: vi.fn(),
  getCoursePreviewAllocation: vi.fn(),
  deleteChapter: vi.fn(),
  getChapterHidePreviewProjection: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
  usePathname: () => window.location.pathname,
  useSearchParams: () =>
    new URLSearchParams(
      useSyncExternalStore(subscribeUrl, () => window.location.search, () => ""),
    ),
}));

vi.mock("@/app/actions/topic", () => ({
  createTopic: mocks.createTopic,
  deleteTopic: mocks.deleteTopic,
  getTopicsByChapterId: mocks.getTopicsByChapterId,
  updateTopic: mocks.updateTopic,
  getCourseStats: mocks.getCourseStats,
  moveTopicOrder: mocks.moveTopicOrder,
}));

vi.mock("@/app/actions/course", () => ({
  verifyCourseAccess: mocks.verifyCourseAccess,
}));

vi.mock("@/app/actions/chapter", () => ({
  getChaptersByCourseId: mocks.getChaptersByCourseId,
  getDeletedChaptersByCourseId: mocks.getDeletedChaptersByCourseId,
  createChapter: vi.fn(),
  deleteChapter: mocks.deleteChapter,
  moveChapterOrder: vi.fn(),
  restoreChapter: vi.fn(),
  updateChapter: vi.fn(),
}));

vi.mock("@/app/actions/course-preview", () => ({
  getCoursePreviewAllocation: mocks.getCoursePreviewAllocation,
  setCourseTopicPreviewMarkers: vi.fn(),
  getChapterHidePreviewProjection: mocks.getChapterHidePreviewProjection,
  getTopicDeletePreviewProjection: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Test plan:
// - Mục tiêu: chứng minh Structure workspace (danh sách chương + khu làm việc của chương) giữ đúng hợp đồng UI-4: chọn chương qua URL, tìm chương, đổi tên tại chỗ, thao tác theo quyền, di chuyển qua Server Action và điều hướng tạo bài học.
// - Loại test: component interaction trong jsdom; Server Action được mock ở ranh giới module.
// - Đối tượng: ChapterNavigator, ChapterWorkbench (kể cả TopicRow và InlineRename) và CourseStructureWorkspace.
// - Case thành công: tạo bài học điều hướng bằng id authoritative với 0/1/3 bản nháp; đổi tên chương/bài học bằng Enter hoặc "Lưu tên"; di chuyển bài học tải lại danh sách và thông báo vị trí mới; chọn chương cập nhật `aria-current` và `?chapter=`; ô tìm chương chỉ hiện từ 8 chương.
// - Case thất bại: tạo lỗi giữ hộp thoại và không điều hướng; đổi tên lỗi giữ ô nhập và giá trị; hủy xác nhận bài đã xuất bản không gọi action; lỗi di chuyển hiện `role="alert"` với "Thử lại" chạy lại đúng yêu cầu; chương trên URL không còn thì về chương mặc định kèm thông báo.
// - Bảo mật/phân quyền: rename/reorder/delete bài học đi theo từng capability riêng; bài chờ duyệt bị khóa kèm lý do; previewer không thấy thao tác sửa. Quyền thật ở DB/Server Action được kiểm tra bằng action test và Supabase integration.
// - Ổn định/resilience: danh sách không reorder cục bộ; thứ tự chỉ đổi sau khi tải lại dữ liệu từ server; xóa chương chọn thẳng chương kế tiếp, không nhảy tạm về chương đầu trong lúc tải lại.
// - Invariant cần giữ: builder target là exact returned topic id; Server Action hiện có là writer duy nhất.

const courseId = "11111111-1111-4111-8111-111111111111";
const chapterId = "22222222-2222-4222-8222-222222222222";
const createdTopicId = "99999999-9999-4999-8999-999999999999";

function makeChapter(index: number, overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: `44444444-4444-4444-8444-4444444444${String(index).padStart(2, "0")}`,
    course_id: courseId,
    title: `Chương mẫu ${index}`,
    order_index: index * 10,
    created_at: "2026-09-16T00:00:00.000Z",
    updated_at: "2026-09-16T00:00:00.000Z",
    removed_at: null,
    canManage: true,
    ...overrides,
  };
}

const baseChapter = makeChapter(0, { id: chapterId, title: "Chapter" });

function makeTopic(index: number, overrides: Partial<Topic> = {}): Topic {
  return {
    id: `33333333-3333-4333-8333-33333333333${index}`,
    chapter_id: chapterId,
    title: `Draft ${index}`,
    status: "draft",
    order_index: index,
    created_at: "2026-09-16T00:00:00.000Z",
    canEditContent: true,
    canManageStructure: true,
    canDeleteTopic: true,
    ...overrides,
  };
}

function exhaustedAllocation(markedTopic: Topic): CoursePreviewAllocation {
  return {
    courseId,
    activeTopicCount: 2,
    markedTopicCount: 1,
    cap: 1,
    remaining: 0,
    excess: 0,
    isSuspended: false,
    causeVerified: null,
    cause: null,
    markedTopics: [
      {
        id: markedTopic.id,
        title: markedTopic.title,
        chapterId,
        chapterTitle: "Chapter",
        chapterOrderIndex: 0,
        status: "draft",
      },
    ],
  };
}

type WorkbenchProps = React.ComponentProps<typeof ChapterWorkbench>;

function renderWorkbench(overrides: Partial<WorkbenchProps> = {}) {
  const props: WorkbenchProps = {
    courseId,
    chapter: baseChapter,
    position: 1,
    total: 1,
    readOnly: false,
    pendingMove: null,
    moveError: null,
    onMoveTopic: vi.fn().mockResolvedValue(true),
    onRenameChapter: vi.fn().mockResolvedValue(undefined),
    onDeleteChapter: vi.fn(),
    onTopicsChanged: vi.fn(),
    onTopicCreated: vi.fn(),
    onBack: vi.fn(),
    announce: vi.fn(),
    previewAllocation: null,
    canManagePreviewMarkers: false,
    isPreviewMarkerUpdating: false,
    onPreviewMarkersChange: vi.fn().mockResolvedValue(undefined),
    onFocusPreviewMarkers: vi.fn(),
    onPreviewAllocationRefresh: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<ChapterWorkbench {...props} />) };
}

function openTopicMenu(title: string) {
  fireEvent.keyDown(
    screen.getByRole("button", { name: `Thao tác khác cho bài học ${title}` }),
    { key: "Enter" },
  );
  return screen.findByRole("menu");
}

function isDisabled(element: HTMLElement) {
  return (
    (element as HTMLButtonElement).disabled === true ||
    element.getAttribute("aria-disabled") === "true" ||
    element.hasAttribute("data-disabled")
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  mocks.createTopic.mockResolvedValue({
    data: { id: createdTopicId },
    message: "Đã tạo bài học.",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChapterWorkbench topic creation", () => {
  it.each([0, 1, 3])("navigates with the authoritative id with %s existing draft topic(s)", async (draftCount) => {
    mocks.getTopicsByChapterId.mockResolvedValue({
      data: Array.from({ length: draftCount }, (_, index) => makeTopic(index)),
    });
    const { props } = renderWorkbench();

    await waitFor(() =>
      expect(screen.queryByText("Đang tải bài học…")).toBeNull(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Thêm bài học" }));
    fireEvent.change(screen.getByPlaceholderText("Nhập tên bài học..."), {
      target: { value: "New topic" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tạo và tiếp tục" }));

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
    expect(props.onPreviewAllocationRefresh).toHaveBeenCalled();
    // Workspace được báo id vừa tạo trước khi rời trang, để kịp dọn ngữ cảnh dashboard.
    expect(props.onTopicCreated).toHaveBeenCalledWith(createdTopicId);
    expect(vi.mocked(props.onTopicCreated).mock.invocationCallOrder[0]).toBeLessThan(
      mocks.router.push.mock.invocationCallOrder[0],
    );
  });

  it("returns focus to the add-topic control when the dialog is cancelled", async () => {
    mocks.getTopicsByChapterId.mockResolvedValue({ data: [] });
    renderWorkbench();

    const addTopic = screen.getByRole("button", { name: "Thêm bài học" });
    addTopic.focus();
    fireEvent.click(addTopic);
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(addTopic);
  });

  it("keeps the create dialog open and does not navigate when creation fails", async () => {
    mocks.getTopicsByChapterId.mockResolvedValue({ data: [] });
    mocks.createTopic.mockResolvedValue({ error: "Không thể tạo bài học." });
    const { props } = renderWorkbench();

    await screen.findByText("Chương này chưa có bài học");
    fireEvent.click(screen.getByRole("button", { name: "Thêm bài học" }));
    fireEvent.change(screen.getByPlaceholderText("Nhập tên bài học..."), {
      target: { value: "New topic" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tạo và tiếp tục" }));

    await waitFor(() => expect(mocks.createTopic).toHaveBeenCalled());
    expect(mocks.router.push).not.toHaveBeenCalled();
    expect(props.onTopicCreated).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Thêm bài học" })).toBeTruthy();
    expect(screen.getByPlaceholderText("Nhập tên bài học...")).toBeTruthy();
  });
});

describe("ChapterWorkbench topic capabilities", () => {
  it("keeps an outside-group topic inspectable without offering mutations", async () => {
    mocks.getTopicsByChapterId.mockResolvedValue({
      data: [makeTopic(0, { canEditContent: false, canManageStructure: false, canDeleteTopic: false })],
    });
    renderWorkbench();

    await screen.findByText("Draft 0");
    expect(screen.getByRole("link", { name: "Mở bài học Draft 0" }).getAttribute("href")).toBe(
      getTopicBuilderPath(courseId, makeTopic(0).id),
    );
    expect(screen.queryByRole("button", { name: 'Di chuyển bài học "Draft 0" lên' })).toBeNull();

    const menu = await openTopicMenu("Draft 0");
    expect(within(menu).getByRole("menuitem", { name: "Cài đặt" })).toBeTruthy();
    expect(within(menu).queryByRole("menuitem", { name: /Đổi tên/ })).toBeNull();
    expect(within(menu).queryByRole("menuitem", { name: /Xóa bài học/ })).toBeNull();
  });

  it("locks every mutation of a pending topic and explains why", async () => {
    mocks.getTopicsByChapterId.mockResolvedValue({
      data: [makeTopic(0, { status: "pending" }), makeTopic(1)],
    });
    renderWorkbench();

    await screen.findByText("Draft 0");
    const moveDown = screen.getByRole("button", { name: 'Di chuyển bài học "Draft 0" xuống' });
    expect(isDisabled(moveDown)).toBe(true);
    expect(moveDown.getAttribute("aria-describedby")).toBeTruthy();
    expect(document.getElementById(moveDown.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
      "Bài học đang chờ duyệt",
    );

    const menu = await openTopicMenu("Draft 0");
    const renameItem = within(menu).getByRole("menuitem", { name: /Đổi tên/ });
    const deleteItem = within(menu).getByRole("menuitem", { name: /Xóa bài học/ });
    expect(isDisabled(renameItem)).toBe(true);
    expect(isDisabled(deleteItem)).toBe(true);
    expect(renameItem.textContent).toContain("Bài học đang chờ duyệt");
  });

  // move_topic_order từ chối đổi chỗ với bài kế bên đang chờ duyệt (TOPIC_PENDING_FROZEN).
  it("blocks swapping into a pending neighbour but keeps the other direction", async () => {
    mocks.getTopicsByChapterId.mockResolvedValue({
      data: [makeTopic(0), makeTopic(1), makeTopic(2, { status: "pending" })],
    });
    const { props } = renderWorkbench();

    await screen.findByText("Draft 1");
    const moveDown = screen.getByRole("button", { name: 'Di chuyển bài học "Draft 1" xuống' });
    expect(isDisabled(moveDown)).toBe(true);
    expect(document.getElementById(moveDown.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
      "Bài học kế bên đang chờ duyệt",
    );

    fireEvent.click(screen.getByRole("button", { name: 'Di chuyển bài học "Draft 1" lên' }));
    await waitFor(() =>
      expect(props.onMoveTopic).toHaveBeenCalledWith({ topicId: makeTopic(1).id, direction: "up" }),
    );
  });

  // D31/D32/D37: ba capability độc lập, mỗi thao tác phải đi theo đúng trường của nó.
  it("gates rename, reorder and delete on their own capability", async () => {
    mocks.getTopicsByChapterId.mockResolvedValue({
      data: [
        makeTopic(0, { canEditContent: false, canDeleteTopic: false }),
        makeTopic(1, { canEditContent: false, canDeleteTopic: false }),
      ],
    });
    renderWorkbench();

    await screen.findByText("Draft 0");
    expect(isDisabled(screen.getByRole("button", { name: 'Di chuyển bài học "Draft 0" xuống' }))).toBe(false);
    expect(isDisabled(screen.getByRole("button", { name: 'Di chuyển bài học "Draft 0" lên' }))).toBe(true);

    const menu = await openTopicMenu("Draft 0");
    expect(within(menu).queryByRole("menuitem", { name: /Đổi tên/ })).toBeNull();
    expect(within(menu).queryByRole("menuitem", { name: /Xóa bài học/ })).toBeNull();
  });

  it("hides authoring controls from a read-only previewer", async () => {
    mocks.getTopicsByChapterId.mockResolvedValue({ data: [makeTopic(0)] });
    renderWorkbench({ readOnly: true });

    await screen.findByText("Draft 0");
    expect(screen.queryByRole("button", { name: "Thêm bài học" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Đổi tên chương/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Di chuyển/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Thao tác khác/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Mở bài học Draft 0" })).toBeTruthy();
  });

  it("offers the allocation view when the Preview quota is used up", async () => {
    const marked = makeTopic(1, { title: "Draft 1" });
    mocks.getTopicsByChapterId.mockResolvedValue({ data: [makeTopic(0), marked] });
    const { props } = renderWorkbench({
      canManagePreviewMarkers: true,
      previewAllocation: exhaustedAllocation(marked),
    });

    await screen.findByText("Draft 0");
    expect(screen.getAllByText("Xem thử")).toHaveLength(1);

    const menu = await openTopicMenu("Draft 0");
    const markItem = within(menu).getByRole("menuitem", { name: /Đánh dấu xem thử/ });
    expect(isDisabled(markItem)).toBe(true);
    expect(markItem.textContent).toContain("Đã dùng hết lượt xem thử");

    fireEvent.click(within(menu).getByRole("menuitem", { name: "Xem phân bổ" }));
    await waitFor(() => expect(props.onFocusPreviewMarkers).toHaveBeenCalled());
  });
  it("explains what preview marking does inside the menu item", async () => {
    const published = makeTopic(0, { title: "Published 0", status: "published" });
    const marked = makeTopic(1, { title: "Draft 1" });
    mocks.getTopicsByChapterId.mockResolvedValue({ data: [published, marked, makeTopic(2)] });
    renderWorkbench({
      canManagePreviewMarkers: true,
      previewAllocation: { ...exhaustedAllocation(marked), remaining: 2 },
    });

    await screen.findByText("Published 0");
    let menu = await openTopicMenu("Published 0");
    expect(within(menu).getByRole("menuitem", { name: /Đánh dấu xem thử/ }).textContent).toContain(
      "Ai cũng xem được, không cần ghi danh",
    );
    fireEvent.keyDown(menu, { key: "Escape" });

    menu = await openTopicMenu("Draft 2");
    expect(within(menu).getByRole("menuitem", { name: /Đánh dấu xem thử/ }).textContent).toContain(
      "Ai cũng xem được khi đã xuất bản",
    );
    fireEvent.keyDown(menu, { key: "Escape" });

    menu = await openTopicMenu("Draft 1");
    expect(within(menu).getByRole("menuitem", { name: /Bỏ xem thử/ }).textContent).toContain(
      "Chỉ học viên đã ghi danh mới xem được",
    );
  });
});

describe("ChapterWorkbench inline rename", () => {
  it("renames a topic with Enter and announces the new title", async () => {
    mocks.getTopicsByChapterId.mockResolvedValue({ data: [makeTopic(0)] });
    mocks.updateTopic.mockResolvedValue({ message: "ok" });
    const { props } = renderWorkbench();

    await screen.findByText("Draft 0");
    const menu = await openTopicMenu("Draft 0");
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Đổi tên/ }));

    const input = (await screen.findByRole("textbox", { name: "Tên bài học" })) as HTMLInputElement;
    expect(input.value).toBe("Draft 0");
    fireEvent.change(input, { target: { value: "Renamed topic" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() =>
      expect(mocks.updateTopic).toHaveBeenCalledWith({
        topicId: makeTopic(0).id,
        title: "Renamed topic",
        confirmPublished: false,
      }),
    );
    await waitFor(() => expect(props.announce).toHaveBeenCalledWith('Đã đổi tên bài học thành "Renamed topic"'));
    expect(props.onTopicsChanged).toHaveBeenCalledWith(chapterId);
    expect(screen.queryByRole("textbox", { name: "Tên bài học" })).toBeNull();
  });

  it("keeps the input and typed value when the rename fails", async () => {
    mocks.getTopicsByChapterId.mockResolvedValue({ data: [makeTopic(0)] });
    mocks.updateTopic.mockResolvedValue({ error: "Không thể cập nhật bài học." });
    renderWorkbench();

    await screen.findByText("Draft 0");
    const menu = await openTopicMenu("Draft 0");
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Đổi tên/ }));
    const input = (await screen.findByRole("textbox", { name: "Tên bài học" })) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Renamed topic" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu tên" }));

    expect(await screen.findByText("Không thể cập nhật bài học.")).toBeTruthy();
    const stillEditing = screen.getByRole("textbox", { name: "Tên bài học" }) as HTMLInputElement;
    expect(stillEditing.value).toBe("Renamed topic");
    expect(stillEditing.getAttribute("aria-invalid")).toBe("true");
  });

  it("does not rename a published topic when the owner cancels the confirmation", async () => {
    mocks.getTopicsByChapterId.mockResolvedValue({ data: [makeTopic(0, { status: "published" })] });
    vi.mocked(window.confirm).mockReturnValue(false);
    renderWorkbench();

    await screen.findByText("Draft 0");
    const menu = await openTopicMenu("Draft 0");
    fireEvent.click(within(menu).getByRole("menuitem", { name: /Đổi tên/ }));
    const input = await screen.findByRole("textbox", { name: "Tên bài học" });
    fireEvent.change(input, { target: { value: "Renamed topic" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(window.confirm).toHaveBeenCalled());
    expect(mocks.updateTopic).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Tên bài học" })).toBeTruthy();
  });

  it("renames the chapter in place, cancels with Escape and exits when focus leaves", async () => {
    mocks.getTopicsByChapterId.mockResolvedValue({ data: [] });
    const { props } = renderWorkbench();

    await screen.findByText("Chương này chưa có bài học");
    fireEvent.click(screen.getByRole("button", { name: "Đổi tên chương Chapter" }));
    let input = (await screen.findByRole("textbox", { name: "Tên chương" })) as HTMLInputElement;
    expect(input.value).toBe("Chapter");

    fireEvent.change(input, { target: { value: "Discarded" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "Tên chương" })).toBeNull();
    expect(props.onRenameChapter).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Đổi tên chương Chapter" }));
    input = (await screen.findByRole("textbox", { name: "Tên chương" })) as HTMLInputElement;
    fireEvent.blur(input, { relatedTarget: document.body });
    expect(screen.queryByRole("textbox", { name: "Tên chương" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Đổi tên chương Chapter" }));
    input = (await screen.findByRole("textbox", { name: "Tên chương" })) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Chương mới" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu tên" }));
    await waitFor(() => expect(props.onRenameChapter).toHaveBeenCalledWith("Chương mới"));
  });
});

describe("ChapterWorkbench ordering", () => {
  it("reloads topics from the server after a move and announces the new position", async () => {
    mocks.getTopicsByChapterId
      .mockResolvedValueOnce({ data: [makeTopic(0), makeTopic(1)] })
      .mockResolvedValueOnce({ data: [makeTopic(1), makeTopic(0)] });
    const { props } = renderWorkbench();

    await screen.findByText("Draft 0");
    fireEvent.click(screen.getByRole("button", { name: 'Di chuyển bài học "Draft 0" xuống' }));

    await waitFor(() =>
      expect(props.announce).toHaveBeenCalledWith('Đã chuyển "Draft 0" xuống vị trí 2'),
    );
    expect(props.onMoveTopic).toHaveBeenCalledWith({ topicId: makeTopic(0).id, direction: "down" });
    expect(mocks.getTopicsByChapterId).toHaveBeenCalledTimes(2);
  });

  it("keeps focus on the moved topic's control, or its other control at an edge", async () => {
    mocks.getTopicsByChapterId
      .mockResolvedValueOnce({ data: [makeTopic(0), makeTopic(1)] })
      .mockResolvedValueOnce({ data: [makeTopic(1), makeTopic(0)] });
    renderWorkbench();

    await screen.findByText("Draft 0");
    const moveDown = screen.getByRole("button", { name: 'Di chuyển bài học "Draft 0" xuống' });
    moveDown.focus();
    fireEvent.click(moveDown);

    // "Draft 0" giờ ở cuối nên nút xuống bị khóa; focus sang nút lên của chính bài đó.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: 'Di chuyển bài học "Draft 0" lên' }),
      ),
    );
  });

  it("keeps the server order when a move fails", async () => {
    mocks.getTopicsByChapterId.mockResolvedValue({ data: [makeTopic(0), makeTopic(1)] });
    const { props } = renderWorkbench({ onMoveTopic: vi.fn().mockResolvedValue(false) });

    await screen.findByText("Draft 0");
    fireEvent.click(screen.getByRole("button", { name: 'Di chuyển bài học "Draft 0" xuống' }));

    await waitFor(() => expect(props.onMoveTopic).toHaveBeenCalled());
    expect(mocks.getTopicsByChapterId).toHaveBeenCalledTimes(1);
    const rows = within(screen.getByRole("list", { name: "Bài học trong Chapter" })).getAllByRole("listitem");
    expect(rows[0].textContent).toContain("Draft 0");
    expect(props.announce).not.toHaveBeenCalled();
  });

  it("shows a move failure as an alert whose retry repeats the same request", async () => {
    mocks.getTopicsByChapterId.mockResolvedValue({ data: [makeTopic(0), makeTopic(1)] });
    const moveError: MoveErrorState = {
      type: "topic",
      message: "Không thể thay đổi thứ tự bài học do mạng gián đoạn.",
      request: { topicId: makeTopic(0).id, direction: "down" },
    };
    const { props } = renderWorkbench({ moveError });

    await screen.findByText("Draft 0");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Không thể thay đổi thứ tự bài học do mạng gián đoạn.");
    fireEvent.click(within(alert).getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(props.onMoveTopic).toHaveBeenCalledWith(moveError.request));
  });

  it("returns to the chapter list from the narrow layout", async () => {
    mocks.getTopicsByChapterId.mockResolvedValue({ data: [] });
    const { props } = renderWorkbench();

    fireEvent.click(screen.getByRole("button", { name: "Tất cả chương" }));
    expect(props.onBack).toHaveBeenCalled();
  });
});

describe("ChapterNavigator", () => {
  const navigatorDefaults = {
    onSelect: vi.fn(),
    announce: vi.fn(),
    canReorder: false,
    pendingMove: null,
    moveErrorMessage: null,
    onMove: vi.fn().mockResolvedValue(undefined),
    onRetryMove: vi.fn(),
  };

  it("moves any chapter from its row, disabling the list edges with a spoken reason", async () => {
    const chapters = [makeChapter(1), makeChapter(2), makeChapter(3)];
    const onMove = vi.fn().mockResolvedValue(undefined);
    render(
      <ChapterNavigator
        {...navigatorDefaults}
        chapters={chapters}
        selectedChapterId={chapters[0].id}
        canReorder
        onMove={onMove}
      />,
    );

    const firstUp = screen.getByRole("button", { name: `Di chuyển chương "${chapters[0].title}" lên` });
    expect(isDisabled(firstUp)).toBe(true);
    expect(document.getElementById(firstUp.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
      "Đã ở đầu danh sách",
    );
    expect(
      isDisabled(screen.getByRole("button", { name: `Di chuyển chương "${chapters[2].title}" xuống` })),
    ).toBe(true);

    // Chương không được chọn vẫn sắp xếp được ngay trong danh sách.
    fireEvent.click(screen.getByRole("button", { name: `Di chuyển chương "${chapters[1].title}" lên` }));
    await waitFor(() =>
      expect(onMove).toHaveBeenCalledWith({ chapterId: chapters[1].id, direction: "up" }),
    );
  });

  it("hides chapter moves while filtering and shows a retryable move error", () => {
    const chapters = Array.from({ length: CHAPTER_SEARCH_THRESHOLD }, (_, index) => makeChapter(index));
    const onRetryMove = vi.fn();
    render(
      <ChapterNavigator
        {...navigatorDefaults}
        chapters={chapters}
        selectedChapterId={null}
        canReorder
        moveErrorMessage="Không thể cập nhật thứ tự chương. Vui lòng thử lại."
        onRetryMove={onRetryMove}
      />,
    );

    fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Thử lại" }));
    expect(onRetryMove).toHaveBeenCalled();

    fireEvent.change(screen.getByRole("searchbox", { name: "Tìm chương" }), {
      target: { value: chapters[0].title },
    });
    expect(screen.queryByRole("button", { name: /^Di chuyển chương/ })).toBeNull();
  });

  it("numbers chapters by position, marks the selection and omits an unknown topic count", () => {
    const chapters = [
      makeChapter(1, { topicCount: 3 }),
      makeChapter(2, { order_index: 80, topicCount: 0 }),
      makeChapter(3),
    ];
    const onSelect = vi.fn();
    render(
      <ChapterNavigator
        chapters={chapters}
        {...navigatorDefaults}
        selectedChapterId={chapters[1].id}
        onSelect={onSelect}
      />,
    );

    const rows = within(screen.getByRole("navigation", { name: "Chương" })).getAllByRole("button");
    expect(rows.map((row) => row.getAttribute("aria-current"))).toEqual([null, "true", null]);
    expect(rows[1].textContent).toContain("2");
    expect(rows[1].textContent).toContain("0 bài học");
    expect(rows[0].textContent).toContain("3 bài học");
    expect(rows[2].textContent).not.toContain("bài học");

    fireEvent.click(rows[2]);
    expect(onSelect).toHaveBeenCalledWith(chapters[2].id);
  });

  it("offers chapter search only from the threshold and announces the result count", () => {
    const announce = vi.fn();
    const fewChapters = Array.from({ length: CHAPTER_SEARCH_THRESHOLD - 1 }, (_, index) => makeChapter(index));
    const { rerender } = render(
      <ChapterNavigator {...navigatorDefaults} chapters={fewChapters} selectedChapterId={null} announce={announce} />,
    );
    expect(screen.queryByRole("searchbox", { name: "Tìm chương" })).toBeNull();

    const manyChapters = [
      ...Array.from({ length: CHAPTER_SEARCH_THRESHOLD }, (_, index) => makeChapter(index)),
      makeChapter(20, { title: "Luyện nghe Part 3" }),
    ];
    rerender(
      <ChapterNavigator {...navigatorDefaults} chapters={manyChapters} selectedChapterId={null} announce={announce} />,
    );
    const search = screen.getByRole("searchbox", { name: "Tìm chương" });

    fireEvent.change(search, { target: { value: "LUYỆN NGHE" } });
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(announce).toHaveBeenLastCalledWith("Tìm thấy 1 chương");

    fireEvent.change(search, { target: { value: "không tồn tại" } });
    expect(screen.getByText("Không tìm thấy chương phù hợp.")).toBeTruthy();
    expect(announce).toHaveBeenLastCalledWith("Không tìm thấy chương phù hợp");

    fireEvent.click(screen.getByRole("button", { name: "Xóa tìm kiếm" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(manyChapters.length);
  });
});

describe("CourseStructureWorkspace chapter selection", () => {
  const chapters = [makeChapter(1, { topicCount: 0 }), makeChapter(2, { topicCount: 0 })];

  function setUrl(search: string) {
    nativeReplaceState(null, "", `/teacher/courses/${courseId}/structure${search}`);
  }

  beforeEach(() => {
    mocks.verifyCourseAccess.mockResolvedValue({ isValid: true, role: "owner" });
    mocks.getChaptersByCourseId.mockResolvedValue({ data: chapters });
    mocks.getDeletedChaptersByCourseId.mockResolvedValue({ data: [] });
    mocks.getCourseStats.mockResolvedValue({ chapters: 2, topics: 0, cards: 0, exercises: 0 });
    mocks.getTopicsByChapterId.mockResolvedValue({ data: [] });
    mocks.getCoursePreviewAllocation.mockResolvedValue({ error: "Không có dữ liệu xem thử trong test." });
  });

  function renderWorkspace() {
    return render(
      <CourseStructureWorkspace courseId={courseId} initialIssueFeedback={null} />,
    );
  }

  it("selects the first chapter by default and switches chapters through the URL only", async () => {
    setUrl("");
    renderWorkspace();

    expect(await screen.findByRole("heading", { level: 2, name: "Chương mẫu 1" })).toBeTruthy();
    expect(screen.getByText("2 chương · 0 bài học · 0 thẻ từ vựng · 0 bài tập")).toBeTruthy();

    const navigator = screen.getByRole("navigation", { name: "Chương" });
    fireEvent.click(within(navigator).getByRole("button", { name: /^(?!Di chuyển).*Chương mẫu 2/ }));

    expect(await screen.findByRole("heading", { level: 2, name: "Chương mẫu 2" })).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get("chapter")).toBe(chapters[1].id);
    expect(
      within(navigator).getByRole("button", { name: /^(?!Di chuyển).*Chương mẫu 2/ }).getAttribute("aria-current"),
    ).toBe("true");
    expect(mocks.router.push).not.toHaveBeenCalled();
    expect(mocks.getChaptersByCourseId).toHaveBeenCalledTimes(1);
  });

  it("opens the chapter named in the URL", async () => {
    setUrl(`?chapter=${chapters[1].id}`);
    renderWorkspace();

    expect(await screen.findByRole("heading", { level: 2, name: "Chương mẫu 2" })).toBeTruthy();
    expect(screen.getByText("Chương 2 / 2")).toBeTruthy();
  });

  it("falls back to the first chapter and explains when the URL chapter is gone", async () => {
    setUrl("?chapter=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    renderWorkspace();

    expect(await screen.findByRole("heading", { level: 2, name: "Chương mẫu 1" })).toBeTruthy();
    expect(await screen.findByText("Nội dung không còn khả dụng")).toBeTruthy();
    await waitFor(() => expect(window.location.search).toBe(""));
  });

  it("shows a retryable error instead of an empty course when chapters fail to load", async () => {
    setUrl("");
    mocks.getChaptersByCourseId
      .mockResolvedValueOnce({ error: "Không thể tải dữ liệu chương. Vui lòng thử lại." })
      .mockResolvedValueOnce({ data: chapters });
    renderWorkspace();

    expect(await screen.findByText("Không thể tải dữ liệu chương. Vui lòng thử lại.")).toBeTruthy();
    expect(screen.queryByText("Khóa học chưa có chương")).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    });
    expect(await screen.findByRole("heading", { level: 2, name: "Chương mẫu 1" })).toBeTruthy();
  });
  it("selects the next chapter after a delete without passing through the first chapter", async () => {
    const three = [...chapters, makeChapter(3, { topicCount: 0 })];
    setUrl(`?chapter=${three[1].id}`);
    mocks.getChaptersByCourseId.mockResolvedValue({ data: three });
    mocks.getChapterHidePreviewProjection.mockResolvedValue({
      data: {
        courseId,
        chapterId: three[1].id,
        projectedActiveTopicCount: 0,
        projectedMarkedTopicCount: 0,
        projectedCap: 0,
        requiredUnmarkCount: 0,
        internalActiveTopicCount: 0,
        internalMarkedTopicCount: 0,
        outsideMarkedTopics: [],
        canManageMarkers: true,
      },
    });
    mocks.deleteChapter.mockResolvedValue({ success: true, message: "Đã xóa chương." });
    renderWorkspace();

    expect(await screen.findByRole("heading", { level: 2, name: "Chương mẫu 2" })).toBeTruthy();
    mocks.getChaptersByCourseId.mockResolvedValue({ data: [three[0], three[2]] });
    // Giữ phần tải lại phân bổ xem thử để có khoảng chương đã đổi mà URL vẫn là chương vừa xóa.
    let releasePreview: (value: unknown) => void = () => {};
    mocks.getCoursePreviewAllocation.mockImplementationOnce(
      () => new Promise((resolve) => { releasePreview = resolve; }),
    );
    mocks.getTopicsByChapterId.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Xóa chương Chương mẫu 2" }));
    const dialog = await screen.findByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Xóa chương" });
    await waitFor(() => expect(confirm.hasAttribute("disabled")).toBe(false));
    await act(async () => {
      fireEvent.click(confirm);
    });

    // Hộp thoại vẫn mở (đang chờ) nên phần còn lại của trang bị ẩn khỏi cây trợ năng.
    expect(
      await screen.findByRole("heading", { level: 2, name: "Chương mẫu 3", hidden: true }),
    ).toBeTruthy();
    expect(new URLSearchParams(window.location.search).get("chapter")).toBe(three[1].id);
    await act(async () => {
      releasePreview({ error: "Không có dữ liệu xem thử trong test." });
    });
    expect(new URLSearchParams(window.location.search).get("chapter")).toBe(three[2].id);
    // Khu làm việc của chương đầu chưa từng được mở trong lúc tải lại.
    expect(mocks.getTopicsByChapterId).not.toHaveBeenCalledWith(three[0].id);
    expect(screen.queryByText("Nội dung không còn khả dụng")).toBeNull();
  });
});
