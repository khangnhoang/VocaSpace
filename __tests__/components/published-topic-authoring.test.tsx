// @vitest-environment jsdom

import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExerciseTab from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/ExerciseTab";
import FlashcardTab from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/FlashcardTab";
import SettingsTab from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/SettingsTab";

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), refresh: vi.fn() },
  getExercisesByTopicId: vi.fn(),
  deleteExercise: vi.fn(),
  deleteQuestion: vi.fn(),
  updateExerciseBasic: vi.fn(),
  updateQuestionGroup: vi.fn(),
  updateQuestion: vi.fn(),
  deleteQuestionGroupMedia: vi.fn(),
  createExercise: vi.fn(),
  getCardsByTopicId: vi.fn(),
  deleteCard: vi.fn(),
  createBulkCards: vi.fn(),
  getTopicById: vi.fn(),
  updateTopic: vi.fn(),
  deleteTopic: vi.fn(),
  getTopicDeletePreviewProjection: vi.fn(),
  getCoursePreviewAllocation: vi.fn(),
  setCourseTopicPreviewMarkers: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));

vi.mock("@/app/actions/exercise", () => ({
  getExercisesByTopicId: mocks.getExercisesByTopicId,
  deleteExercise: mocks.deleteExercise,
  deleteQuestion: mocks.deleteQuestion,
  updateExerciseBasic: mocks.updateExerciseBasic,
  updateQuestionGroup: mocks.updateQuestionGroup,
  updateQuestion: mocks.updateQuestion,
  deleteQuestionGroupMedia: mocks.deleteQuestionGroupMedia,
  createExercise: mocks.createExercise,
}));

vi.mock("@/app/actions/card", () => ({
  getCardsByTopicId: mocks.getCardsByTopicId,
  deleteCard: mocks.deleteCard,
  createBulkCards: mocks.createBulkCards,
  createCard: vi.fn(),
  updateCard: vi.fn(),
}));

vi.mock("@/app/actions/topic", () => ({
  getTopicById: mocks.getTopicById,
  updateTopic: mocks.updateTopic,
  deleteTopic: mocks.deleteTopic,
}));

vi.mock("@/app/actions/course-preview", () => ({
  getTopicDeletePreviewProjection: mocks.getTopicDeletePreviewProjection,
  getCoursePreviewAllocation: mocks.getCoursePreviewAllocation,
  setCourseTopicPreviewMarkers: mocks.setCourseTopicPreviewMarkers,
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));

// Test plan:
// - Mục tiêu: trên bài học đã xuất bản (TFEAT1 AC5, G4) chỉ xóa nội dung, ẩn bài học và lưu câu hỏi đổi/bỏ đáp án
//   mới hiện cảnh báo bằng dialog của app; mọi chỉnh sửa khác lưu thẳng; hủy thì không có request nào.
// - Loại test: component interaction trong jsdom, Server Action được mock.
// - Đối tượng: ExerciseTab, FlashcardTab, SettingsTab (MemoryCheckSection có file test riêng).
// - Case thành công:
//   - lưu câu hỏi đổi đáp án đúng mở dialog, xác nhận mới gọi updateQuestion một lần;
//   - lưu câu hỏi đang có hai đáp án đúng mà chỉ giữ một đáp án đúng cũng mở cảnh báo (hủy thì không gọi action);
//   - lưu câu hỏi chỉ sửa chữ, đổi tên bài tập và đổi tên bài học gọi action ngay, không dialog;
//   - dialog xóa bài tập/câu hỏi/thẻ có ghi chú ảnh hưởng học viên và chỉ một bước xác nhận;
//   - ẩn bài học đã xuất bản hiện ghi chú ảnh hưởng và gửi cờ xác nhận mà server yêu cầu cho d1_delete_topic.
// - Case thất bại/hủy: hủy cảnh báo đáp án không gọi updateQuestion, giữ nguyên dữ liệu đang sửa.
// - Bảo mật/phân quyền: không dùng window.confirm; bài học nháp không bao giờ hiện cảnh báo đã xuất bản.
// - Invariant cần giữ: action nội dung không còn nhận cờ confirmPublished (server bỏ qua), riêng xóa bài học vẫn gửi.

window.HTMLElement.prototype.scrollIntoView = vi.fn();

const topicId = "22222222-2222-4222-8222-222222222222";
const courseId = "11111111-1111-4111-8111-111111111111";
const CORRECT_TITLE = "Đổi đáp án đúng?";
// Cả hai tiêu đề cảnh báo đáp án; dùng cho các case khẳng định "không có cảnh báo" hoặc hủy.
const WARNING_TITLE = /^(Đổi đáp án đúng\?|Lưu thay đổi đáp án\?)$/;

const exerciseWithQuestion = {
  id: "ex-1",
  title: "Part 5 bài 1",
  part_type: "part5",
  order_index: 1,
  removed_at: null,
  groups: [],
  questions: [
    {
      id: "q-1",
      content: "He ___ to work.",
      explanation: null,
      order_index: 1,
      removed_at: null,
      options: [
        { id: "o-a", content: "go", is_correct: true, label: "A", order_index: 1 },
        { id: "o-b", content: "goes", is_correct: false, label: "B", order_index: 2 },
        { id: "o-c", content: "going", is_correct: false, label: "C", order_index: 3 },
      ],
    },
  ],
};

describe("ExerciseTab on a published topic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm");
    mocks.getExercisesByTopicId.mockResolvedValue({ data: [exerciseWithQuestion] });
    mocks.updateQuestion.mockResolvedValue({ success: true, message: "Đã cập nhật câu hỏi" });
    mocks.updateExerciseBasic.mockResolvedValue({ success: true, message: "Đã cập nhật thông tin bài tập!" });
    mocks.deleteExercise.mockResolvedValue({ success: true, message: "Đã xóa bài tập thành công!" });
    mocks.deleteQuestion.mockResolvedValue({ success: true, message: "Đã xóa câu hỏi!" });
  });

  const renderTab = async (isPublished: boolean) => {
    render(<ExerciseTab topicId={topicId} isPublished={isPublished} />);
    await screen.findByText("He ___ to work.");
  };

  const openQuestionEditor = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Sửa câu hỏi 1" }));
    return screen.findByRole("dialog", { name: "Sửa Câu hỏi & Đáp án" });
  };

  it("asks before saving a changed correct answer and calls the action once after confirm", async () => {
    await renderTab(true);
    const editor = await openQuestionEditor();
    fireEvent.click(within(editor).getAllByRole("radio")[1]);
    fireEvent.click(within(editor).getByRole("button", { name: "Lưu dữ liệu" }));

    const warning = await screen.findByRole("dialog", { name: CORRECT_TITLE });
    expect(within(warning).getByText(/sẽ phải làm lại câu này/)).toBeTruthy();
    expect(mocks.updateQuestion).not.toHaveBeenCalled();

    fireEvent.click(within(warning).getByRole("button", { name: "Vẫn lưu thay đổi" }));

    await waitFor(() => expect(mocks.updateQuestion).toHaveBeenCalledTimes(1));
    expect(mocks.updateQuestion).toHaveBeenCalledWith("q-1", "He ___ to work.", null, [
      { id: "o-a", content: "go", is_correct: false },
      { id: "o-b", content: "goes", is_correct: true },
      { id: "o-c", content: "going", is_correct: false },
    ]);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("makes no request and keeps the editor open when the owner cancels the answer warning", async () => {
    await renderTab(true);
    const editor = await openQuestionEditor();
    fireEvent.click(within(editor).getAllByRole("radio")[1]);
    fireEvent.click(within(editor).getByRole("button", { name: "Lưu dữ liệu" }));

    const warning = await screen.findByRole("dialog", { name: WARNING_TITLE });
    fireEvent.click(within(warning).getByRole("button", { name: "Hủy bỏ" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: WARNING_TITLE })).toBeNull());
    expect(mocks.updateQuestion).not.toHaveBeenCalled();
    const stillOpen = screen.getByRole("dialog", { name: "Sửa Câu hỏi & Đáp án" });
    expect((within(stillOpen).getAllByRole("radio")[1] as HTMLInputElement).checked).toBe(true);
  });

  it("warns when a question with two saved correct options is saved with only one, and cancel makes no request", async () => {
    mocks.getExercisesByTopicId.mockResolvedValue({
      data: [
        {
          ...exerciseWithQuestion,
          questions: [
            {
              ...exerciseWithQuestion.questions[0],
              options: [
                { id: "o-a", content: "go", is_correct: true, label: "A", order_index: 1 },
                { id: "o-b", content: "goes", is_correct: true, label: "B", order_index: 2 },
                { id: "o-c", content: "going", is_correct: false, label: "C", order_index: 3 },
              ],
            },
          ],
        },
      ],
    });
    await renderTab(true);
    const editor = await openQuestionEditor();
    // Hai đáp án đúng đã lưu không sửa trực tiếp được qua nhóm radio (chỉ một nút hiện đã chọn), nên chọn C rồi chọn lại A
    // để còn đúng một mình A. Bản cũ chỉ so đáp án đúng đầu tiên (A) nên bỏ sót ca này.
    fireEvent.click(within(editor).getAllByRole("radio")[2]);
    fireEvent.click(within(editor).getAllByRole("radio")[0]);
    fireEvent.click(within(editor).getByRole("button", { name: "Lưu dữ liệu" }));

    const warning = await screen.findByRole("dialog", { name: WARNING_TITLE });
    fireEvent.click(within(warning).getByRole("button", { name: "Hủy bỏ" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: WARNING_TITLE })).toBeNull());
    expect(mocks.updateQuestion).not.toHaveBeenCalled();
  });

  it("saves a wording-only question edit at once with no warning", async () => {
    await renderTab(true);
    const editor = await openQuestionEditor();
    fireEvent.change(within(editor).getByDisplayValue("He ___ to work."), {
      target: { value: "She ___ to work." },
    });
    fireEvent.click(within(editor).getByRole("button", { name: "Lưu dữ liệu" }));

    await waitFor(() => expect(mocks.updateQuestion).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog", { name: WARNING_TITLE })).toBeNull();
  });

  it("renames an exercise at once with no warning", async () => {
    await renderTab(true);
    fireEvent.click(screen.getByRole("button", { name: /Sửa thông tin chung/ }));
    const dialog = await screen.findByRole("dialog", { name: "Sửa thông tin chung" });
    fireEvent.change(within(dialog).getByDisplayValue("Part 5 bài 1"), {
      target: { value: "Part 5 bài 1 đã đổi tên" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() =>
      expect(mocks.updateExerciseBasic).toHaveBeenCalledWith("ex-1", "Part 5 bài 1 đã đổi tên", "part5"),
    );
    expect(screen.queryByRole("dialog", { name: WARNING_TITLE })).toBeNull();
  });

  it("explains the learner impact inside the delete-exercise dialog and deletes on that single confirm", async () => {
    await renderTab(true);
    fireEvent.click(screen.getByRole("button", { name: /Xóa bài/ }));
    const dialog = await screen.findByRole("dialog", { name: "Xác nhận xóa bài tập" });
    expect(within(dialog).getByRole("note").textContent).toContain("không còn thấy bài tập");

    fireEvent.click(within(dialog).getByRole("button", { name: "Xóa bài" }));

    await waitFor(() => expect(mocks.deleteExercise).toHaveBeenCalledWith("ex-1"));
    expect(mocks.deleteExercise).toHaveBeenCalledTimes(1);
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("explains the learner impact inside the delete-question dialog", async () => {
    await renderTab(true);
    fireEvent.click(screen.getByRole("button", { name: "Xóa câu hỏi 1" }));
    const dialog = await screen.findByRole("dialog", { name: "Xóa câu hỏi" });
    expect(within(dialog).getByRole("note").textContent).toContain("không còn thấy câu hỏi này");

    fireEvent.click(within(dialog).getByRole("button", { name: "Xóa câu hỏi" }));
    await waitFor(() => expect(mocks.deleteQuestion).toHaveBeenCalledWith("q-1"));
  });

  it("shows no published warning anywhere on a draft topic", async () => {
    await renderTab(false);
    const editor = await openQuestionEditor();
    fireEvent.click(within(editor).getAllByRole("radio")[1]);
    fireEvent.click(within(editor).getByRole("button", { name: "Lưu dữ liệu" }));
    await waitFor(() => expect(mocks.updateQuestion).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog", { name: WARNING_TITLE })).toBeNull();

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /Xóa bài/ }));
    const dialog = await screen.findByRole("dialog", { name: "Xác nhận xóa bài tập" });
    expect(within(dialog).queryByRole("note")).toBeNull();
  });
});

describe("FlashcardTab on a published topic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm");
    mocks.getCardsByTopicId.mockResolvedValue({
      data: [
        {
          id: "card-1",
          front_content: { word: "progress", pos: "noun", phonetic: "/x/" },
          back_content: { translation: "tiến độ" },
        },
      ],
    });
    mocks.deleteCard.mockResolvedValue({ success: true, message: "Đã xóa từ vựng thành công!" });
  });

  it("explains the learner impact inside the delete dialog and deletes on that single confirm", async () => {
    render(<FlashcardTab topicId={topicId} isPublished />);
    fireEvent.click(await screen.findByRole("button", { name: "Xóa thẻ từ vựng" }));
    const dialog = await screen.findByRole("dialog", { name: "Xóa từ vựng" });
    expect(within(dialog).getByRole("note").textContent).toContain("không còn thấy thẻ này");

    fireEvent.click(within(dialog).getByRole("button", { name: "Xóa vĩnh viễn" }));

    await waitFor(() => expect(mocks.deleteCard).toHaveBeenCalledWith("card-1"));
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("keeps the delete dialog free of the published note on a draft topic", async () => {
    render(<FlashcardTab topicId={topicId} />);
    fireEvent.click(await screen.findByRole("button", { name: "Xóa thẻ từ vựng" }));
    const dialog = await screen.findByRole("dialog", { name: "Xóa từ vựng" });

    expect(within(dialog).queryByRole("note")).toBeNull();
  });
});

describe("SettingsTab on a published topic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm");
    mocks.getTopicById.mockResolvedValue({ data: { title: "Bài học đã xuất bản", status: "published" } });
    mocks.getCoursePreviewAllocation.mockResolvedValue({ data: null });
    mocks.updateTopic.mockResolvedValue({ success: true, message: "Đã cập nhật bài học." });
    mocks.deleteTopic.mockResolvedValue({ success: true, message: "Đã ẩn bài học khỏi khóa học." });
    mocks.getTopicDeletePreviewProjection.mockResolvedValue({
      data: {
        courseId,
        topicId,
        currentAllocation: {
          courseId,
          activeTopicCount: 1,
          markedTopicCount: 0,
          cap: 1,
          remaining: 1,
          excess: 0,
          isSuspended: false,
          causeVerified: null,
          cause: null,
          markedTopics: [],
        },
        projectedActiveTopicCount: 0,
        projectedMarkedTopicCount: 0,
        projectedCap: 0,
        requiredUnmarkCount: 0,
        targetIsPreview: false,
        canManageMarkers: false,
        outsideMarkedTopics: [],
      },
    });
  });

  const renderSettings = () =>
    render(
      <SettingsTab
        topicId={topicId}
        courseId={courseId}
        topicStatus="published"
        canManagePreviewMarkers={false}
        isPublished
      />,
    );

  it("renames the topic at once without a confirmation or a demotion flag", async () => {
    renderSettings();
    fireEvent.change(await screen.findByDisplayValue("Bài học đã xuất bản"), {
      target: { value: "Bài học đổi tên" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu cài đặt" }));

    await waitFor(() =>
      expect(mocks.updateTopic).toHaveBeenCalledWith({ topicId, title: "Bài học đổi tên" }),
    );
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it("shows the learner impact in the hide dialog and sends the confirmation flag the server still requires", async () => {
    renderSettings();
    await screen.findByDisplayValue("Bài học đã xuất bản");
    fireEvent.click(screen.getByRole("button", { name: "Xóa bài học này" }));
    await waitFor(() => expect(mocks.getTopicDeletePreviewProjection).toHaveBeenCalledWith(topicId));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("note").textContent).toContain("không còn thấy bài học này");

    fireEvent.click(within(dialog).getByRole("button", { name: "Xóa bài học" }));

    await waitFor(() =>
      expect(mocks.deleteTopic).toHaveBeenCalledWith({
        topicId,
        confirmPublished: true,
        unmarkTopicIds: [],
      }),
    );
    expect(window.confirm).not.toHaveBeenCalled();
  });
});
