// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExerciseWorkbench from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/ExerciseWorkbench";

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), refresh: vi.fn() },
  getExercisesByTopicId: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/app/actions/exercise", () => ({
  getExercisesByTopicId: mocks.getExercisesByTopicId,
  deleteExercise: vi.fn(),
  deleteQuestion: vi.fn(),
  updateExerciseBasic: vi.fn(),
  updateQuestionGroup: vi.fn(),
  updateQuestion: vi.fn(),
  deleteQuestionGroupMedia: vi.fn(),
  createExercise: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

window.HTMLElement.prototype.scrollIntoView = vi.fn();

// Test plan:
// - Mục tiêu: danh sách bài tập dài vẫn dễ dùng: mỗi bài là một dòng thu gọn, mở ra khi bấm, tìm được theo mọi cấp.
// - Loại test: component interaction trong jsdom, Server Action được mock (jsdom không có matchMedia nên chạy bố cục rộng).
// - Case thành công: thu gọn mặc định kèm tóm tắt; nút mũi tên mở và đóng mà không mở editor; bấm tên bài mở editor và mở cây.
// - Tìm kiếm: bỏ dấu tiếng Việt; khớp câu thì chỉ giữ câu đó và giữ nguyên số thứ tự; khớp ngữ liệu giữ cả nhóm; khớp tên giữ cả bài;
//   xóa từ khóa thì trở về trạng thái thu gọn; không khớp thì báo rõ.
// - Invariant cần giữ: thu gọn không được giấu vấn đề của nhóm và câu bên trong.

const option = (id: string, is_correct: boolean) => ({ id, content: id, is_correct, label: id, order_index: 1 });
const question = (id: string, content: string, overrides = {}) => ({
  id,
  content,
  explanation: null,
  order_index: 1,
  removed_at: null,
  options: [option(`${id}-a`, true), option(`${id}-b`, false)],
  ...overrides,
});

const partSeven = {
  id: "ex-7",
  title: "Đọc email",
  part_type: "part7",
  order_index: 1,
  removed_at: null,
  questions: [],
  groups: [
    {
      id: "group-1",
      passage_text: "Dear Ms. Lan, the invoice is attached.",
      audio_url: "",
      image_url: "",
      questions: [question("q-1", "When is the payment due?"), question("q-2", "What is attached?")],
    },
  ],
};

const partFive = {
  id: "ex-5",
  title: "Điền từ",
  part_type: "part5",
  order_index: 2,
  removed_at: null,
  groups: [],
  questions: [question("q-3", "He ___ to work."), question("q-4", "They ___ home.", { content: "They ___ home." })],
};

async function renderOutline(exercises: unknown[] = [partSeven, partFive]) {
  mocks.getExercisesByTopicId.mockResolvedValue({ data: exercises });
  render(<ExerciseWorkbench topicId="topic-1" />);
  await waitFor(() => expect(screen.queryByText("Đang tải bài tập…")).toBeNull());
}

const search = (value: string) =>
  fireEvent.change(screen.getByRole("searchbox", { name: "Tìm bài tập" }), { target: { value } });

describe("ExerciseWorkbench outline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts collapsed with a summary and toggles from the arrow without opening an editor", async () => {
    await renderOutline();

    expect(screen.getByText("Part 7 · 1 nhóm · 2 câu")).toBeTruthy();
    expect(screen.getByText("Part 5 · 2 câu")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Câu 1\. When is the payment due/ })).toBeNull();

    const open = screen.getByRole("button", { name: "Mở nội dung bài tập Đọc email" });
    expect(open.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(open);

    const close = screen.getByRole("button", { name: "Thu gọn nội dung bài tập Đọc email" });
    expect(close.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(close.getAttribute("aria-controls")!)?.textContent).toContain("Nhóm 1");
    expect(screen.getByRole("button", { name: /^Câu 2\. What is attached/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Đọc email" })).toBeNull();
    // Bài khác vẫn thu gọn.
    expect(screen.queryByRole("button", { name: /^Câu 1\. He ___ to work/ })).toBeNull();

    fireEvent.click(close);
    expect(screen.queryByRole("button", { name: /^Câu 2\. What is attached/ })).toBeNull();
  });

  it("opens the tree and the editor when the exercise name is clicked", async () => {
    await renderOutline();

    fireEvent.click(screen.getByRole("button", { name: /^Đọc email/ }));

    expect(await screen.findByRole("heading", { name: "Đọc email" })).toBeTruthy();
    expect(await screen.findByRole("button", { name: /^Câu 1\. When is the payment due/ })).toBeTruthy();
  });

  it("keeps nested problems visible on a collapsed row and moves them to their rows once open", async () => {
    await renderOutline([
      {
        ...partFive,
        questions: [question("q-3", ""), question("q-4", "Đủ đáp án"), question("q-5", "Thiếu đáp án", { options: [] })],
      },
    ]);

    expect(screen.getByText("Có 2 mục cần sửa")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Mở nội dung bài tập/ }));
    expect(screen.queryByText("Có 2 mục cần sửa")).toBeNull();
    expect(screen.getByText("Thiếu nội dung câu hỏi")).toBeTruthy();
  });

  it("keeps only the matching question and its real number, ignoring Vietnamese marks", async () => {
    await renderOutline();

    search("attached");
    const tree = screen.getByRole("list", { name: "Cấu trúc bài tập" });
    // Câu 1 không chứa từ này nhưng ngữ liệu của nhóm có, nên cả nhóm vẫn hiện.
    expect(within(tree).getByRole("button", { name: /^Câu 1\. When is the payment due/ })).toBeTruthy();
    expect(within(tree).queryByRole("button", { name: /^Điền từ/ })).toBeNull();

    search("they");
    const narrowed = screen.getByRole("list", { name: "Cấu trúc bài tập" });
    expect(within(narrowed).getByRole("button", { name: /^Câu 2\. They ___ home/ })).toBeTruthy();
    expect(within(narrowed).queryByRole("button", { name: /^Câu 1\. He ___ to work/ })).toBeNull();
    // Đang tìm thì mọi bài khớp đều mở sẵn, không còn nút thu gọn.
    expect(within(narrowed).queryByRole("button", { name: /nội dung bài tập/ })).toBeNull();

    search("dien tu");
    expect(screen.getByRole("button", { name: /^Câu 1\. He ___ to work/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Câu 2\. They ___ home/ })).toBeTruthy();
  });

  it("finds an exercise by Part, reports no match and returns to collapsed when cleared", async () => {
    await renderOutline();

    search("part 7");
    expect(screen.getByRole("button", { name: /^Đọc email/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Điền từ/ })).toBeNull();

    search("không có gì");
    expect(screen.getByText("Không có bài tập nào khớp “không có gì”.")).toBeTruthy();

    search("");
    expect(screen.getByRole("button", { name: "Mở nội dung bài tập Đọc email" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Câu 1\. When is the payment due/ })).toBeNull();
  });

  it("shows no search box when there is nothing to search", async () => {
    await renderOutline([]);

    expect(screen.queryByRole("searchbox", { name: "Tìm bài tập" })).toBeNull();
    expect(screen.getByText("Chưa có bài tập nào")).toBeTruthy();
  });
});
