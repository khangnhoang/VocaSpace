// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GroupEditor } from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/ExerciseNodeEditors";

const mocks = vi.hoisted(() => ({
  updateQuestionGroup: vi.fn(),
  deleteQuestionGroupMedia: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/app/actions/exercise", () => ({
  updateQuestionGroup: mocks.updateQuestionGroup,
  deleteQuestionGroupMedia: mocks.deleteQuestionGroupMedia,
  updateExerciseBasic: vi.fn(),
  updateQuestion: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));

window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Test plan:
// - Mục tiêu: editor nhóm ngữ liệu trong tab Bài tập (TFEAT4 AC5, AC6) lưu qua `updateQuestionGroup` với đúng payload
//   như trước, chạy cùng rule ngữ liệu TOEIC theo Part, và khi lưu lỗi thì giữ dữ liệu đang gõ, báo lỗi tại chỗ.
// - Loại test: component interaction trong jsdom, Server Action được mock.
// - Case thành công: sửa đoạn văn Part 7 gửi (groupId, passage, audio, image) và báo cho dashboard feedback.
// - Case thất bại: bỏ trống đoạn văn bắt buộc thì không gọi action và báo cạnh field; server từ chối thì giữ đoạn văn
//   đang gõ, hiện lỗi ở đầu editor và cạnh field, không gọi onSaved.

const exercise = {
  id: "ex-7",
  title: "Part 7 đọc email",
  part_type: "part7",
  order_index: 1,
  groups: [],
  questions: [],
};

const group = {
  id: "group-1",
  passage_text: "Dear Ms. Lan, the invoice is attached.",
  audio_url: "",
  image_url: "",
  questions: [],
};

function renderEditor() {
  const onSaved = vi.fn();
  const onAuthoringSuccess = vi.fn(() => false);
  render(
    <GroupEditor
      topicId="topic-1"
      exercise={exercise}
      group={group}
      groupIndex={0}
      readOnly={false}
      onSaved={onSaved}
      onAuthoringSuccess={onAuthoringSuccess}
    />,
  );
  return { onSaved, onAuthoringSuccess };
}

describe("GroupEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateQuestionGroup.mockResolvedValue({ success: true, message: "Đã cập nhật nhóm câu hỏi" });
  });

  it("saves a Part 7 passage edit through updateQuestionGroup with the unchanged media fields", async () => {
    const { onSaved, onAuthoringSuccess } = renderEditor();
    fireEvent.change(screen.getByLabelText("Đoạn văn"), { target: { value: "Dear Ms. Lan, payment is due Friday." } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() =>
      expect(mocks.updateQuestionGroup).toHaveBeenCalledWith("group-1", "Dear Ms. Lan, payment is due Friday.", "", ""),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onAuthoringSuccess).toHaveBeenCalledWith({ type: "question_group_updated", questionGroupId: "group-1" });
    expect(await screen.findByText("Đã lưu")).toBeTruthy();
  });

  it("blocks a save without the passage this Part requires and names it next to the field", async () => {
    renderEditor();
    fireEvent.change(screen.getByLabelText("Đoạn văn"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    expect(await screen.findByText("Vui lòng nhập đoạn văn cho Part này.")).toBeTruthy();
    expect(screen.getByLabelText("Đoạn văn").getAttribute("aria-invalid")).toBe("true");
    expect(mocks.updateQuestionGroup).not.toHaveBeenCalled();
  });

  it("keeps the typed passage and shows the server error when the save fails", async () => {
    mocks.updateQuestionGroup.mockResolvedValueOnce({ error: "Đoạn văn quá dài cho nhóm này." });
    const { onSaved } = renderEditor();
    fireEvent.change(screen.getByLabelText("Đoạn văn"), { target: { value: "Bản nháp chưa lưu" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Đoạn văn quá dài cho nhóm này.");
    expect((screen.getByLabelText("Đoạn văn") as HTMLTextAreaElement).value).toBe("Bản nháp chưa lưu");
    expect(screen.getByLabelText("Đoạn văn").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Chưa lưu")).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
