// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoryCheckWorkbench from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/MemoryCheckWorkbench";

// Test plan:
// - Mục tiêu: tab Memory check (D3 C2, TFEAT4 AC4) cho teacher tạo bộ, thêm/sửa/xóa câu inline và nói rõ đây là bước tùy chọn.
// - Loại test: component + form interaction, Server Action được mock.
// - Case thành công: thêm câu đầu tiên gửi đúng payload; sửa câu gửi option id cũ; xóa câu thường gọi deleteQuestion; xóa câu cuối gỡ cả bộ.
// - Case thất bại: validation phía client và lỗi server giữ editor cùng dữ liệu đã nhập.
// - Phân quyền: readOnly (pending/không có quyền soạn) không hiện thao tác ghi.
// - Bài học đã xuất bản (TFEAT1 AC5): xóa câu/gỡ memory check hiện cảnh báo ngay trong dialog xóa;
//   sửa câu mà đổi đáp án đúng hoặc bỏ đáp án mở dialog cảnh báo trước khi gọi server, hủy thì không gọi
//   action và giữ dữ liệu đã nhập; thêm câu mới và sửa chữ thuần túy lưu thẳng; bài học nháp không bao giờ hiện cảnh báo.

const mocks = vi.hoisted(() => ({
  getMemoryCheckByTopicId: vi.fn(),
  addMemoryCheckQuestion: vi.fn(),
  updateQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
  deleteExercise: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/app/actions/exercise", () => ({
  getMemoryCheckByTopicId: mocks.getMemoryCheckByTopicId,
  addMemoryCheckQuestion: mocks.addMemoryCheckQuestion,
  updateQuestion: mocks.updateQuestion,
  deleteQuestion: mocks.deleteQuestion,
  deleteExercise: mocks.deleteExercise,
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));

const question = (id: string, content: string) => ({
  id,
  content,
  explanation: "Giải thích",
  options: [
    { id: `${id}-a`, content: "tiến độ", is_correct: true, label: "A" },
    { id: `${id}-b`, content: "tiền lương", is_correct: false, label: "B" },
  ],
});

async function renderSection(props: Partial<React.ComponentProps<typeof MemoryCheckWorkbench>> = {}) {
  const onMutationSuccess = vi.fn();
  render(<MemoryCheckWorkbench topicId="topic-1" onMutationSuccess={onMutationSuccess} {...props} />);
  await waitFor(() => expect(mocks.getMemoryCheckByTopicId).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText("Đang tải memory check…")).toBeNull());
  return { onMutationSuccess };
}

describe("MemoryCheckWorkbench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMemoryCheckByTopicId.mockResolvedValue({ data: null });
    mocks.addMemoryCheckQuestion.mockResolvedValue({ success: true, message: "Đã thêm câu memory check!" });
    mocks.updateQuestion.mockResolvedValue({ success: true, message: "Đã cập nhật" });
    mocks.deleteQuestion.mockResolvedValue({ success: true, message: "Đã xóa câu hỏi!" });
    mocks.deleteExercise.mockResolvedValue({ success: true, message: "Đã xóa bài tập thành công!" });
  });

  it("explains that the stage is optional when the topic has no memory check", async () => {
    await renderSection();
    expect(screen.getByText("Bài học chưa có memory check")).toBeTruthy();
    expect(screen.getByText(/^Tùy chọn/)).toBeTruthy();
  });

  it("creates the first question with the entered options", async () => {
    const { onMutationSuccess } = await renderSection();
    fireEvent.click(screen.getAllByRole("button", { name: "Thêm câu" })[0]);

    fireEvent.change(screen.getByLabelText(/^Nội dung câu hỏi/), { target: { value: "\"progress\" nghĩa là gì?" } });
    fireEvent.change(screen.getByLabelText("Nội dung đáp án A"), { target: { value: "tiến độ" } });
    fireEvent.change(screen.getByLabelText("Nội dung đáp án B"), { target: { value: "tiền lương" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(mocks.addMemoryCheckQuestion).toHaveBeenCalledTimes(1));
    expect(mocks.addMemoryCheckQuestion).toHaveBeenCalledWith(
      "topic-1",
      {
        content: "\"progress\" nghĩa là gì?",
        options: [
          { content: "tiến độ", is_correct: true },
          { content: "tiền lương", is_correct: false },
          { content: "", is_correct: false },
        ],
      },
    );
    await waitFor(() => expect(onMutationSuccess).toHaveBeenCalled());
    expect(mocks.getMemoryCheckByTopicId).toHaveBeenCalledTimes(2);
  });

  it("keeps the dialog and input when client validation fails", async () => {
    await renderSection();
    fireEvent.click(screen.getAllByRole("button", { name: "Thêm câu" })[0]);
    fireEvent.change(screen.getByLabelText(/^Nội dung câu hỏi/), { target: { value: "Câu chưa đủ đáp án" } });
    fireEvent.change(screen.getByLabelText("Nội dung đáp án A"), { target: { value: "chỉ một" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    expect(await screen.findByText("Phải có ít nhất 2 đáp án")).toBeTruthy();
    expect((screen.getByLabelText(/^Nội dung câu hỏi/) as HTMLInputElement).value).toBe("Câu chưa đủ đáp án");
    expect(mocks.addMemoryCheckQuestion).not.toHaveBeenCalled();
  });

  it("keeps the dialog and input when the server rejects the save", async () => {
    mocks.addMemoryCheckQuestion.mockResolvedValueOnce({ error: "Bài học đang chờ duyệt và tạm thời không nhận thay đổi." });
    const { onMutationSuccess } = await renderSection();
    fireEvent.click(screen.getAllByRole("button", { name: "Thêm câu" })[0]);
    fireEvent.change(screen.getByLabelText(/^Nội dung câu hỏi/), { target: { value: "Câu giữ lại" } });
    fireEvent.change(screen.getByLabelText("Nội dung đáp án A"), { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText("Nội dung đáp án B"), { target: { value: "B" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Bài học đang chờ duyệt và tạm thời không nhận thay đổi.");
    expect((screen.getByLabelText(/^Nội dung câu hỏi/) as HTMLInputElement).value).toBe("Câu giữ lại");
    expect(onMutationSuccess).not.toHaveBeenCalled();
  });

  it("edits an existing question, keeping option ids and moving the correct answer", async () => {
    mocks.getMemoryCheckByTopicId.mockResolvedValue({ data: { id: "memory-1", questions: [question("q1", "Câu 1")] } });
    await renderSection();

    fireEvent.click(screen.getByRole("button", { name: /^Câu 1 ·/ }));
    fireEvent.click(screen.getByLabelText("Đáp án B là đáp án đúng"));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(mocks.updateQuestion).toHaveBeenCalledTimes(1));
    expect(mocks.updateQuestion).toHaveBeenCalledWith(
      "q1",
      "Câu 1",
      "Giải thích",
      [
        { id: "q1-a", content: "tiến độ", is_correct: false },
        { id: "q1-b", content: "tiền lương", is_correct: true },
      ],
    );
  });

  it("deletes a question while others remain, and removes the whole set for the last one", async () => {
    mocks.getMemoryCheckByTopicId.mockResolvedValue({
      data: { id: "memory-1", questions: [question("q1", "Câu 1"), question("q2", "Câu 2")] },
    });
    await renderSection();
    // The refetch after deleting q2 returns only q1.
    mocks.getMemoryCheckByTopicId.mockResolvedValue({ data: { id: "memory-1", questions: [question("q1", "Câu 1")] } });

    fireEvent.click(screen.getByRole("button", { name: /^Câu 2 ·/ }));
    fireEvent.click(screen.getByRole("button", { name: "Xóa câu hỏi" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xóa câu hỏi" }));
    await waitFor(() => expect(mocks.deleteQuestion).toHaveBeenCalledWith("q2"));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Câu 2 ·/ })).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: /^Câu 1 ·/ }));
    fireEvent.click(screen.getByRole("button", { name: "Gỡ memory check" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/gỡ memory check khỏi bài học/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Gỡ memory check" }));
    await waitFor(() => expect(mocks.deleteExercise).toHaveBeenCalledWith("memory-1"));
    expect(mocks.deleteQuestion).toHaveBeenCalledTimes(1);
  });

  describe("on a published topic", () => {
    const openEditAndPickB = async () => {
      mocks.getMemoryCheckByTopicId.mockResolvedValue({
        data: { id: "memory-1", questions: [question("q1", "Câu 1"), question("q2", "Câu 2")] },
      });
      await renderSection({ isPublished: true });
      fireEvent.click(screen.getByRole("button", { name: /^Câu 1 ·/ }));
      fireEvent.click(screen.getByLabelText("Đáp án B là đáp án đúng"));
      fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    };

    it("opens the warning before saving a changed correct answer and saves only after confirm", async () => {
      await openEditAndPickB();

      const warning = await screen.findByRole("dialog", { name: "Đổi đáp án đúng?" });
      expect(within(warning).getByText(/sẽ phải làm lại câu này/)).toBeTruthy();
      expect(mocks.updateQuestion).not.toHaveBeenCalled();

      fireEvent.click(within(warning).getByRole("button", { name: "Vẫn lưu thay đổi" }));

      await waitFor(() => expect(mocks.updateQuestion).toHaveBeenCalledTimes(1));
      expect(mocks.updateQuestion).toHaveBeenCalledWith("q1", "Câu 1", "Giải thích", [
        { id: "q1-a", content: "tiến độ", is_correct: false },
        { id: "q1-b", content: "tiền lương", is_correct: true },
      ]);
    });

    it("makes no request and keeps the typed values when the owner cancels the warning", async () => {
      await openEditAndPickB();

      const warning = await screen.findByRole("dialog", { name: "Đổi đáp án đúng?" });
      fireEvent.click(within(warning).getByRole("button", { name: "Hủy bỏ" }));

      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: /^(Đổi đáp án đúng\?|Lưu thay đổi đáp án\?)$/ })).toBeNull(),
      );
      expect(mocks.updateQuestion).not.toHaveBeenCalled();
      expect((screen.getByLabelText("Đáp án B là đáp án đúng") as HTMLInputElement).checked).toBe(true);
    });

    it("warns when an option is removed even if the correct answer stays", async () => {
      mocks.getMemoryCheckByTopicId.mockResolvedValue({
        data: {
          id: "memory-1",
          questions: [
            {
              ...question("q1", "Câu 1"),
              options: [
                { id: "q1-a", content: "tiến độ", is_correct: true, label: "A" },
                { id: "q1-b", content: "tiền lương", is_correct: false, label: "B" },
                { id: "q1-c", content: "tiền thưởng", is_correct: false, label: "C" },
              ],
            },
          ],
        },
      });
      await renderSection({ isPublished: true });

      fireEvent.click(screen.getByRole("button", { name: /^Câu 1 ·/ }));
      fireEvent.click(screen.getByRole("button", { name: "Bỏ đáp án C" }));
      fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

      const warning = await screen.findByRole("dialog", { name: "Lưu thay đổi đáp án?" });
      expect(within(warning).getByText(/không còn hiện cho học viên/)).toBeTruthy();
      expect(mocks.updateQuestion).not.toHaveBeenCalled();
    });

    it("saves wording-only edits and new questions at once with no warning", async () => {
      mocks.getMemoryCheckByTopicId.mockResolvedValue({ data: { id: "memory-1", questions: [question("q1", "Câu 1")] } });
      await renderSection({ isPublished: true });

      fireEvent.click(screen.getByRole("button", { name: /^Câu 1 ·/ }));
      fireEvent.change(screen.getByLabelText(/^Nội dung câu hỏi/), { target: { value: "Câu 1 đã sửa chữ" } });
      fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
      await waitFor(() => expect(mocks.updateQuestion).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      fireEvent.click(screen.getAllByRole("button", { name: "Thêm câu" })[0]);
      fireEvent.change(screen.getByLabelText(/^Nội dung câu hỏi/), { target: { value: "Câu mới" } });
      fireEvent.change(screen.getByLabelText("Nội dung đáp án A"), { target: { value: "A" } });
      fireEvent.change(screen.getByLabelText("Nội dung đáp án B"), { target: { value: "B" } });
      fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
      await waitFor(() => expect(mocks.addMemoryCheckQuestion).toHaveBeenCalledTimes(1));
      expect(screen.queryByRole("dialog", { name: /^(Đổi đáp án đúng\?|Lưu thay đổi đáp án\?)$/ })).toBeNull();
    });

    it("explains the learner impact inside the delete dialog and deletes on its single confirm", async () => {
      mocks.getMemoryCheckByTopicId.mockResolvedValue({
        data: { id: "memory-1", questions: [question("q1", "Câu 1"), question("q2", "Câu 2")] },
      });
      await renderSection({ isPublished: true });

      fireEvent.click(screen.getByRole("button", { name: /^Câu 2 ·/ }));
    fireEvent.click(screen.getByRole("button", { name: "Xóa câu hỏi" }));
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByRole("note").textContent).toContain("học viên sẽ không còn thấy câu memory check này");
      expect(mocks.deleteQuestion).not.toHaveBeenCalled();

      fireEvent.click(within(dialog).getByRole("button", { name: "Xóa câu hỏi" }));
      await waitFor(() => expect(mocks.deleteQuestion).toHaveBeenCalledWith("q2"));
      expect(mocks.deleteQuestion).toHaveBeenCalledTimes(1);
    });

    it("says learners skip straight to the exercises when the last question removes the whole check", async () => {
      mocks.getMemoryCheckByTopicId.mockResolvedValue({ data: { id: "memory-1", questions: [question("q1", "Câu 1")] } });
      await renderSection({ isPublished: true });

      fireEvent.click(screen.getByRole("button", { name: /^Câu 1 ·/ }));
      fireEvent.click(screen.getByRole("button", { name: "Gỡ memory check" }));
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByRole("note").textContent).toContain("đi thẳng từ flashcard sang bài tập");
      fireEvent.click(within(dialog).getByRole("button", { name: "Gỡ memory check" }));

      await waitFor(() => expect(mocks.deleteExercise).toHaveBeenCalledWith("memory-1"));
    });
  });

  it("never shows the published warning on a draft topic", async () => {
    mocks.getMemoryCheckByTopicId.mockResolvedValue({ data: { id: "memory-1", questions: [question("q1", "Câu 1")] } });
    await renderSection({ isPublished: false });

    fireEvent.click(screen.getByRole("button", { name: /^Câu 1 ·/ }));
    fireEvent.click(screen.getByLabelText("Đáp án B là đáp án đúng"));
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(mocks.updateQuestion).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog", { name: /^(Đổi đáp án đúng\?|Lưu thay đổi đáp án\?)$/ })).toBeNull();

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Gỡ memory check" }));
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("shows no write controls when read-only", async () => {
    mocks.getMemoryCheckByTopicId.mockResolvedValue({ data: { id: "memory-1", questions: [question("q1", "Câu 1")] } });
    await renderSection({ readOnly: true });

    expect(screen.getByText("Câu 1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Thêm câu" })).toBeNull();
    // Người chỉ xem vẫn mở được câu để đọc, nhưng field bị khóa và không có nút ghi.
    fireEvent.click(screen.getByRole("button", { name: /^Câu 1 ·/ }));
    expect((screen.getByLabelText(/^Nội dung câu hỏi/) as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Lưu" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Gỡ memory check" })).toBeNull();
  });
});
