// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FlashcardWorkbench from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/FlashcardWorkbench";

const mocks = vi.hoisted(() => ({
  getCardsByTopicId: vi.fn(),
  createCard: vi.fn(),
  updateCard: vi.fn(),
  deleteCard: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/app/actions/card", () => ({
  getCardsByTopicId: mocks.getCardsByTopicId,
  createCard: mocks.createCard,
  updateCard: mocks.updateCard,
  deleteCard: mocks.deleteCard,
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));

// Test plan:
// - Mục tiêu: tab Từ vựng dạng workbench (TFEAT4 AC3, AC6, AC7): danh sách tìm được, editor inline cùng field và
//   validation như cũ, `Lưu & thêm tiếp`, Ctrl/Cmd+S, preview cập nhật theo từng ký tự, lỗi lưu giữ nguyên dữ liệu.
// - Loại test: component interaction trong jsdom, Server Action được mock (jsdom không có matchMedia nên chạy bố cục rộng).
// - Case thành công: thêm thẻ rồi `Lưu & thêm tiếp` để editor trống và focus ô từ vựng; sửa thẻ gọi updateCard với ID cũ;
//   Ctrl+S lưu; tìm kiếm bỏ dấu tiếng Việt.
// - Case thất bại: thiếu từ vựng/nghĩa không gọi action và báo cạnh field; server từ chối thì giữ dữ liệu và hiện lỗi + thử lại.
// - Phân quyền: chỉ xem thì không có nút thêm/lưu/xóa và field bị khóa nhưng vẫn xem được nội dung.

const topicId = "22222222-2222-4222-8222-222222222222";
const savedCard = {
  id: "card-1",
  topic_id: topicId,
  front_content: { word: "negotiate", pos: "v", phonetic: "/nɪˈɡoʊʃieɪt/" },
  back_content: { translation: "đàm phán", example: "We negotiate prices." },
  order_index: 1,
  created_at: "2026-10-01T00:00:00.000Z",
};

async function renderWorkbench(props: Partial<React.ComponentProps<typeof FlashcardWorkbench>> = {}) {
  const onMutationSuccess = vi.fn();
  render(<FlashcardWorkbench topicId={topicId} onMutationSuccess={onMutationSuccess} {...props} />);
  await waitFor(() => expect(screen.queryByText("Đang tải thẻ từ vựng…")).toBeNull());
  return { onMutationSuccess };
}

describe("FlashcardWorkbench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCardsByTopicId.mockResolvedValue({ data: [savedCard] });
    mocks.createCard.mockResolvedValue({ success: true, message: "Thêm từ vựng thành công!" });
    mocks.updateCard.mockResolvedValue({ success: true, message: "Cập nhật thành công!" });
  });

  it("creates a card and keeps an empty editor open with the word field focused after save & add next", async () => {
    const { onMutationSuccess } = await renderWorkbench();
    fireEvent.click(screen.getAllByRole("button", { name: "Thêm thẻ" })[0]);
    fireEvent.change(screen.getByLabelText(/^Từ vựng/), { target: { value: "deadline" } });
    fireEvent.change(screen.getByLabelText(/^Nghĩa/), { target: { value: "hạn chót" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu & thêm tiếp" }));

    await waitFor(() => expect(mocks.createCard).toHaveBeenCalledTimes(1));
    expect(mocks.createCard).toHaveBeenCalledWith(
      topicId,
      expect.objectContaining({ word: "deadline", translation: "hạn chót" }),
    );
    await waitFor(() => expect(onMutationSuccess).toHaveBeenCalled());
    expect(screen.getByRole("heading", { name: "Thẻ từ vựng mới" })).toBeTruthy();
    expect((screen.getByLabelText(/^Từ vựng/) as HTMLInputElement).value).toBe("");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText(/^Từ vựng/)));
  });

  it("updates the learner preview on every keystroke", async () => {
    await renderWorkbench();
    fireEvent.click(screen.getByRole("button", { name: /negotiate/ }));
    const preview = screen.getByRole("region", { name: "Bản xem trước cho học viên" });
    expect(preview.textContent).toContain("negotiate");

    fireEvent.change(screen.getByLabelText(/^Từ vựng/), { target: { value: "negotiation" } });
    await waitFor(() => expect(preview.textContent).toContain("negotiation"));
    fireEvent.click(screen.getByRole("button", { name: "Lật thẻ xem mặt sau" }));
    expect(preview.textContent).toContain("đàm phán");
  });

  it("saves an edit with Ctrl+S and keeps the saved card id", async () => {
    await renderWorkbench();
    fireEvent.click(screen.getByRole("button", { name: /negotiate/ }));
    const word = screen.getByLabelText(/^Từ vựng/);
    fireEvent.change(word, { target: { value: "negotiate (formal)" } });
    fireEvent.keyDown(word, { key: "s", ctrlKey: true });

    await waitFor(() => expect(mocks.updateCard).toHaveBeenCalledTimes(1));
    expect(mocks.updateCard).toHaveBeenCalledWith(
      "card-1",
      expect.objectContaining({ word: "negotiate (formal)", translation: "đàm phán" }),
    );
    expect(await screen.findByText("Đã lưu")).toBeTruthy();
  });

  it("blocks a save with a missing required field and names it next to the field", async () => {
    await renderWorkbench();
    fireEvent.click(screen.getAllByRole("button", { name: "Thêm thẻ" })[0]);
    fireEvent.change(screen.getByLabelText(/^Nghĩa/), { target: { value: "chỉ có nghĩa" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    expect(await screen.findByText("Vui lòng nhập từ vựng")).toBeTruthy();
    expect(screen.getByLabelText(/^Từ vựng/).getAttribute("aria-invalid")).toBe("true");
    expect(mocks.createCard).not.toHaveBeenCalled();
  });

  it("keeps every typed value and offers retry when the server rejects the save", async () => {
    mocks.updateCard.mockResolvedValueOnce({ error: "Bài học đang chờ duyệt và tạm thời không nhận thay đổi." });
    const { onMutationSuccess } = await renderWorkbench();
    fireEvent.click(screen.getByRole("button", { name: /negotiate/ }));
    fireEvent.change(screen.getByLabelText(/^Câu ví dụ/), { target: { value: "Ví dụ mới chưa lưu" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Bài học đang chờ duyệt và tạm thời không nhận thay đổi.");
    expect((screen.getByLabelText(/^Câu ví dụ/) as HTMLTextAreaElement).value).toBe("Ví dụ mới chưa lưu");
    expect(screen.getByText("Chưa lưu")).toBeTruthy();
    expect(onMutationSuccess).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(mocks.updateCard).toHaveBeenCalledTimes(2));
  });

  it("filters the card list without Vietnamese diacritics", async () => {
    mocks.getCardsByTopicId.mockResolvedValue({
      data: [savedCard, { ...savedCard, id: "card-2", front_content: { word: "budget" }, back_content: { translation: "ngân sách" } }],
    });
    await renderWorkbench();
    fireEvent.change(screen.getByLabelText("Tìm thẻ từ vựng"), { target: { value: "dam phan" } });

    expect(screen.getByRole("button", { name: /negotiate/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /budget/ })).toBeNull();
  });

  it("lets a read-only viewer read cards without any write control", async () => {
    await renderWorkbench({ readOnly: true });
    expect(screen.queryByRole("button", { name: "Thêm thẻ" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /negotiate/ }));

    expect((screen.getByLabelText(/^Từ vựng/) as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Lưu" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xóa thẻ từ vựng" })).toBeNull();
    expect(screen.getByRole("region", { name: "Bản xem trước cho học viên" }).textContent).toContain("negotiate");
  });
});
