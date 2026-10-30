// @vitest-environment jsdom

import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TopicTitleEditor from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicTitleEditor";
import { AuthoringGuardProvider, useAuthoringGuard } from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/authoring-guard";

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  updateTopic: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/app/actions/topic", () => ({ updateTopic: mocks.updateTopic }));
vi.mock("sonner", () => ({ toast: mocks.toast }));

// Test plan:
// - Mục tiêu: sửa tên bài học ngay trên tiêu đề, thay cho ô tên ở tab Cài đặt đã bỏ.
// - Loại test: component interaction trong jsdom, Server Action được mock.
// - Case thành công: Enter và rời ô nhập đều lưu đúng một lần, tên mới hiện ngay, báo cho trang refresh;
//   bài học đã xuất bản dùng cùng luồng, không có bước xác nhận.
// - Case thất bại: tên quá ngắn không gọi action và báo ngay dưới ô nhập; server từ chối thì giữ chữ đang gõ.
// - Hủy: Esc bỏ thay đổi, không gọi action, không lưu lại khi ô nhập biến mất; không đổi gì thì không gọi action.
// - Phân quyền: không có quyền sửa thì tên là chữ thường, không có nút.
// - Guard (AC6): tên đang gõ dở tính là thay đổi chưa lưu; bỏ thay đổi trả về tên cũ.

const topicId = "22222222-2222-4222-8222-222222222222";
const title = "Bài học gốc";

function renderEditor(canEdit = true) {
  const onSaved = vi.fn();
  render(<TopicTitleEditor id="topic-title" topicId={topicId} title={title} canEdit={canEdit} onSaved={onSaved} />);
  return { onSaved };
}

function startEditing() {
  fireEvent.click(screen.getByRole("button", { name: title }));
  return screen.getByRole("textbox", { name: "Tên bài học" }) as HTMLInputElement;
}

describe("TopicTitleEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateTopic.mockResolvedValue({ success: true, message: "Đã cập nhật bài học." });
  });

  it("saves on Enter, shows the new name at once and asks the page to refresh", async () => {
    const { onSaved } = renderEditor();
    const input = startEditing();
    expect(input.value).toBe(title);
    fireEvent.change(input, { target: { value: "  Bài học đổi tên  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(mocks.updateTopic).toHaveBeenCalledTimes(1);
    expect(mocks.updateTopic).toHaveBeenCalledWith({ topicId, title: "Bài học đổi tên" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Bài học đổi tên");
    expect(screen.queryByRole("textbox", { name: "Tên bài học" })).toBeNull();
    expect(mocks.toast.success).toHaveBeenCalledWith("Đã cập nhật bài học.");
  });

  it("saves once when the field loses focus", async () => {
    const { onSaved } = renderEditor();
    const input = startEditing();
    fireEvent.change(input, { target: { value: "Bài học đổi tên" } });
    fireEvent.blur(input);

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(mocks.updateTopic).toHaveBeenCalledTimes(1);
  });

  it("does not call the server when the name did not change", async () => {
    const { onSaved } = renderEditor();
    fireEvent.keyDown(startEditing(), { key: "Enter" });

    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Tên bài học" })).toBeNull());
    expect(mocks.updateTopic).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("discards on Escape without saving", async () => {
    renderEditor();
    const input = startEditing();
    fireEvent.change(input, { target: { value: "Tên bỏ đi" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);

    expect(await screen.findByRole("button", { name: title })).toBeTruthy();
    expect(mocks.updateTopic).not.toHaveBeenCalled();
  });

  it("names a too-short title under the field and keeps editing", async () => {
    renderEditor();
    const input = startEditing();
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect((await screen.findByRole("alert")).textContent).toBe("Tên bài học phải dài hơn 3 ký tự");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(mocks.updateTopic).not.toHaveBeenCalled();
  });

  it("keeps the typed name and shows the server error when the save fails", async () => {
    mocks.updateTopic.mockResolvedValue({ error: "Bài học đang chờ duyệt." });
    const { onSaved } = renderEditor();
    const input = startEditing();
    fireEvent.change(input, { target: { value: "Bài học đổi tên" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect((await screen.findByRole("alert")).textContent).toBe("Bài học đang chờ duyệt.");
    expect((screen.getByRole("textbox", { name: "Tên bài học" }) as HTMLInputElement).value).toBe("Bài học đổi tên");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("renders plain text for someone who cannot edit", () => {
    renderEditor(false);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(title);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("counts a half-typed name as an unsaved change for the leave guard", async () => {
    function GuardProbe() {
      const guard = useAuthoringGuard();
      const [isDirty, setIsDirty] = useState(false);
      return <button onClick={() => setIsDirty(guard.hasDirtyEditor())}>{isDirty ? "có thay đổi" : "không đổi"}</button>;
    }
    render(
      <AuthoringGuardProvider>
        <GuardProbe />
        <TopicTitleEditor id="topic-title" topicId={topicId} title={title} canEdit onSaved={vi.fn()} />
      </AuthoringGuardProvider>,
    );

    fireEvent.change(startEditing(), { target: { value: "Tên đang gõ" } });
    fireEvent.click(screen.getByRole("button", { name: "không đổi" }));
    expect(await screen.findByRole("button", { name: "có thay đổi" })).toBeTruthy();
  });
});
