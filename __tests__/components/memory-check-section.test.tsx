// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoryCheckSection from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/MemoryCheckSection";

// Test plan:
// - Mục tiêu: section memory check (D3 C2) cho teacher tạo bộ, thêm/sửa/xóa câu và nói rõ đây là bước tùy chọn.
// - Loại test: component + form interaction, Server Action được mock.
// - Case thành công: thêm câu đầu tiên gửi đúng payload; sửa câu gửi option id cũ; xóa câu thường gọi deleteQuestion; xóa câu cuối gỡ cả bộ.
// - Case thất bại: validation phía client và lỗi server giữ dialog cùng dữ liệu đã nhập.
// - Phân quyền: readOnly (pending/không có quyền soạn) không hiện thao tác ghi.

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

async function renderSection(props: Partial<React.ComponentProps<typeof MemoryCheckSection>> = {}) {
  const onMutationSuccess = vi.fn();
  render(<MemoryCheckSection topicId="topic-1" onMutationSuccess={onMutationSuccess} {...props} />);
  await waitFor(() => expect(mocks.getMemoryCheckByTopicId).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByLabelText("Đang tải memory check")).toBeNull());
  return { onMutationSuccess };
}

describe("MemoryCheckSection", () => {
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
    expect(screen.getByText("Tùy chọn")).toBeTruthy();
  });

  it("creates the first question with the entered options", async () => {
    const { onMutationSuccess } = await renderSection();
    fireEvent.click(screen.getByRole("button", { name: /Thêm câu memory check/ }));

    fireEvent.change(screen.getByLabelText("Nội dung câu hỏi"), { target: { value: "\"progress\" nghĩa là gì?" } });
    fireEvent.change(screen.getByLabelText("Nội dung đáp án A"), { target: { value: "tiến độ" } });
    fireEvent.change(screen.getByLabelText("Nội dung đáp án B"), { target: { value: "tiền lương" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu câu hỏi" }));

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
      false,
    );
    await waitFor(() => expect(onMutationSuccess).toHaveBeenCalled());
    expect(mocks.getMemoryCheckByTopicId).toHaveBeenCalledTimes(2);
  });

  it("keeps the dialog and input when client validation fails", async () => {
    await renderSection();
    fireEvent.click(screen.getByRole("button", { name: /Thêm câu memory check/ }));
    fireEvent.change(screen.getByLabelText("Nội dung câu hỏi"), { target: { value: "Câu chưa đủ đáp án" } });
    fireEvent.change(screen.getByLabelText("Nội dung đáp án A"), { target: { value: "chỉ một" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu câu hỏi" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Phải có ít nhất 2 đáp án");
    expect((screen.getByLabelText("Nội dung câu hỏi") as HTMLInputElement).value).toBe("Câu chưa đủ đáp án");
    expect(mocks.addMemoryCheckQuestion).not.toHaveBeenCalled();
  });

  it("keeps the dialog and input when the server rejects the save", async () => {
    mocks.addMemoryCheckQuestion.mockResolvedValueOnce({ error: "Bài học đang chờ duyệt và tạm thời không nhận thay đổi." });
    const { onMutationSuccess } = await renderSection();
    fireEvent.click(screen.getByRole("button", { name: /Thêm câu memory check/ }));
    fireEvent.change(screen.getByLabelText("Nội dung câu hỏi"), { target: { value: "Câu giữ lại" } });
    fireEvent.change(screen.getByLabelText("Nội dung đáp án A"), { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText("Nội dung đáp án B"), { target: { value: "B" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu câu hỏi" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Bài học đang chờ duyệt và tạm thời không nhận thay đổi.");
    expect((screen.getByLabelText("Nội dung câu hỏi") as HTMLInputElement).value).toBe("Câu giữ lại");
    expect(onMutationSuccess).not.toHaveBeenCalled();
  });

  it("edits an existing question, keeping option ids and moving the correct answer", async () => {
    mocks.getMemoryCheckByTopicId.mockResolvedValue({ data: { id: "memory-1", questions: [question("q1", "Câu 1")] } });
    await renderSection();

    fireEvent.click(screen.getByRole("button", { name: "Sửa câu memory check 1" }));
    fireEvent.click(screen.getByLabelText("Đáp án B là đáp án đúng"));
    fireEvent.click(screen.getByRole("button", { name: "Lưu câu hỏi" }));

    await waitFor(() => expect(mocks.updateQuestion).toHaveBeenCalledTimes(1));
    expect(mocks.updateQuestion).toHaveBeenCalledWith(
      "q1",
      "Câu 1",
      "Giải thích",
      [
        { id: "q1-a", content: "tiến độ", is_correct: false },
        { id: "q1-b", content: "tiền lương", is_correct: true },
      ],
      false,
    );
  });

  it("deletes a question while others remain, and removes the whole set for the last one", async () => {
    mocks.getMemoryCheckByTopicId.mockResolvedValue({
      data: { id: "memory-1", questions: [question("q1", "Câu 1"), question("q2", "Câu 2")] },
    });
    await renderSection();
    // The refetch after deleting q2 returns only q1.
    mocks.getMemoryCheckByTopicId.mockResolvedValue({ data: { id: "memory-1", questions: [question("q1", "Câu 1")] } });

    fireEvent.click(screen.getByRole("button", { name: "Xóa câu memory check 2" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Xóa câu hỏi" }));
    await waitFor(() => expect(mocks.deleteQuestion).toHaveBeenCalledWith("q2", false));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(screen.queryByText("Câu 2")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Xóa câu memory check 1" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/gỡ memory check khỏi bài học/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Gỡ memory check" }));
    await waitFor(() => expect(mocks.deleteExercise).toHaveBeenCalledWith("memory-1", false));
    expect(mocks.deleteQuestion).toHaveBeenCalledTimes(1);
  });

  it("shows no write controls when read-only", async () => {
    mocks.getMemoryCheckByTopicId.mockResolvedValue({ data: { id: "memory-1", questions: [question("q1", "Câu 1")] } });
    await renderSection({ readOnly: true });

    expect(screen.getByText("Câu 1")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Thêm câu memory check/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Sửa câu memory check 1" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xóa câu memory check 1" })).toBeNull();
  });
});
