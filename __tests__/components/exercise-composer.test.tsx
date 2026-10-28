// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExerciseComposer from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/ExerciseComposer";

const mocks = vi.hoisted(() => ({
  createExercise: vi.fn(),
  deleteQuestionGroupMedia: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/app/actions/exercise", () => ({
  createExercise: mocks.createExercise,
  deleteQuestionGroupMedia: mocks.deleteQuestionGroupMedia,
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));

window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Test plan:
// - Mục tiêu: composer tạo bài tập TOEIC inline (TFEAT4 AC5) chọn Part bằng thẻ rồi lưu nguyên khối qua
//   createExercise với đúng payload cho nhóm câu hỏi (Part 7) và câu hỏi đơn (Part 5).
// - Loại test: component/form interaction, Server Action createExercise được mock.
// - Đối tượng: ExerciseComposer (React Hook Form, useFieldArray, useWatch cho media của từng nhóm).
// - Case thành công: lưu Part 7 và Part 5 với nhánh không dùng vắng mặt trong payload; form trống lại sau khi lưu;
//   URL ảnh của nhóm hiện đúng trong field và không lẫn sang nhóm thêm sau đó.
// - Case thất bại: thiếu đoạn văn Part 7 thì không gọi action và báo lỗi cạnh field; server từ chối thì giữ dữ liệu,
//   báo lỗi ở đầu editor và không gọi onCreated.
// - Invariant cần giữ: payload chỉ chứa nhánh groups hoặc questions đang dùng; không còn chế độ nhập hàng loạt.

const topicId = "topic-1111-2222-3333";

function renderComposer() {
  const onCreated = vi.fn();
  const onCancel = vi.fn();
  render(<ExerciseComposer topicId={topicId} onCreated={onCreated} onCancel={onCancel} />);
  return { onCreated, onCancel };
}

function choosePart(name: RegExp) {
  fireEvent.click(screen.getByRole("radio", { name }));
}

describe("ExerciseComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createExercise.mockResolvedValue({ data: { id: "exercise-1" }, message: "Tạo bài tập thành công." });
  });

  it("asks for a TOEIC Part first, stating which context each Part needs, with no bulk import", () => {
    renderComposer();
    expect(screen.getAllByRole("radio")).toHaveLength(7);
    expect(screen.getByText("Mỗi nhóm cần 1 hình ảnh và 1 audio.")).toBeTruthy();
    expect(screen.queryByText(/hàng loạt/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Lưu bài tập" })).toBeNull();
  });

  it("saves a Part 7 (grouped) exercise with the standalone branch absent", async () => {
    const { onCreated } = renderComposer();
    choosePart(/Part 7/);
    fireEvent.change(screen.getByLabelText(/^Tên bài tập/), {
      target: { value: "TOEIC Part 7 Reading Comprehension" },
    });
    fireEvent.change(screen.getByLabelText("Đoạn văn"), {
      target: { value: "The marketing department announced a new campaign starting next Monday." },
    });
    fireEvent.change(screen.getByLabelText("Câu 1"), { target: { value: "When will the campaign start?" } });
    fireEvent.change(screen.getByLabelText("Đáp án A của câu 1 nhóm 1"), { target: { value: "Next Monday" } });
    fireEvent.change(screen.getByLabelText("Đáp án B của câu 1 nhóm 1"), { target: { value: "Next Month" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu bài tập" }));

    await waitFor(() => expect(mocks.createExercise).toHaveBeenCalledTimes(1));
    const [calledTopicId, payload] = mocks.createExercise.mock.calls[0];
    expect(calledTopicId).toBe(topicId);
    expect(payload.part_type).toBe("part7");
    expect(payload.groups).toHaveLength(1);
    expect(payload.groups[0].passage_text).toBe(
      "The marketing department announced a new campaign starting next Monday.",
    );
    expect(payload.groups[0].questions[0]).toEqual({
      content: "When will the campaign start?",
      explanation: undefined,
      options: [
        { id: undefined, content: "Next Monday", is_correct: true },
        { id: undefined, content: "Next Month", is_correct: false },
      ],
    });
    expect(payload.questions).toBeUndefined();
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  });

  it("saves a Part 5 (standalone) exercise with the grouped branch absent", async () => {
    renderComposer();
    choosePart(/Part 5/);
    fireEvent.change(screen.getByLabelText(/^Tên bài tập/), {
      target: { value: "TOEIC Part 5 Incomplete Sentences" },
    });
    fireEvent.change(await screen.findByLabelText("Nội dung câu hỏi"), {
      target: { value: "The committee decided to _______ the recommended security measures." },
    });
    fireEvent.change(screen.getByLabelText("Đáp án A của câu 1"), { target: { value: "implement" } });
    fireEvent.change(screen.getByLabelText("Đáp án B của câu 1"), { target: { value: "implementation" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu bài tập" }));

    await waitFor(() => expect(mocks.createExercise).toHaveBeenCalledTimes(1));
    const payload = mocks.createExercise.mock.calls[0][1];
    expect(payload.part_type).toBe("part5");
    expect(payload.questions).toHaveLength(1);
    expect(payload.groups).toBeUndefined();
  });

  it("blocks a Part 7 save without a passage and names the field", async () => {
    renderComposer();
    choosePart(/Part 7/);
    fireEvent.change(screen.getByLabelText(/^Tên bài tập/), { target: { value: "Missing passage" } });
    fireEvent.change(screen.getByLabelText("Câu 1"), { target: { value: "Question?" } });
    fireEvent.change(screen.getByLabelText("Đáp án A của câu 1 nhóm 1"), { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText("Đáp án B của câu 1 nhóm 1"), { target: { value: "B" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu bài tập" }));

    expect(await screen.findByText("Vui lòng nhập đoạn văn cho Part này.")).toBeTruthy();
    expect(mocks.createExercise).not.toHaveBeenCalled();
  });

  it("keeps every typed value and shows the server error when the save fails", async () => {
    mocks.createExercise.mockResolvedValueOnce({ error: "Không thể tạo bài tập lúc này." });
    const { onCreated } = renderComposer();
    choosePart(/Part 5/);
    fireEvent.change(screen.getByLabelText(/^Tên bài tập/), { target: { value: "Giữ lại tên" } });
    fireEvent.change(await screen.findByLabelText("Nội dung câu hỏi"), { target: { value: "Giữ lại câu" } });
    fireEvent.change(screen.getByLabelText("Đáp án A của câu 1"), { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText("Đáp án B của câu 1"), { target: { value: "B" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu bài tập" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Không thể tạo bài tập lúc này.");
    expect((screen.getByLabelText(/^Tên bài tập/) as HTMLInputElement).value).toBe("Giữ lại tên");
    expect((screen.getByLabelText("Nội dung câu hỏi") as HTMLInputElement).value).toBe("Giữ lại câu");
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("shows the group image URL typed into its media field and keeps it out of a group added afterwards", async () => {
    const { container } = render(
      <ExerciseComposer topicId={topicId} onCreated={vi.fn()} onCancel={vi.fn()} />,
    );
    choosePart(/Part 7/);
    const imageInput = () =>
      container.ownerDocument.querySelector<HTMLInputElement>('input[name="groups.0.image_url"]');
    fireEvent.change(imageInput()!, { target: { value: "https://example.com/group-one.png" } });
    await waitFor(() => expect(imageInput()!.value).toBe("https://example.com/group-one.png"));

    fireEvent.click(screen.getByRole("button", { name: /Thêm nhóm câu hỏi/ }));
    await waitFor(() =>
      expect(
        container.ownerDocument.querySelector<HTMLInputElement>('input[name="groups.1.image_url"]')?.value,
      ).toBe(""),
    );
    expect(imageInput()!.value).toBe("https://example.com/group-one.png");
  });
});
