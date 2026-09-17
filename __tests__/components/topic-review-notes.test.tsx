// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TopicReviewNotes, {
  TopicReviewNotesProvider,
} from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicReviewNotes";
import type { TopicReviewNote } from "@/lib/schemas/review-notes";

const mocks = vi.hoisted(() => ({
  createReviewNote: vi.fn(),
  updateReviewNote: vi.fn(),
  removeReviewNote: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/app/actions/review-notes", () => ({
  createReviewNote: mocks.createReviewNote,
  updateReviewNote: mocks.updateReviewNote,
  removeReviewNote: mocks.removeReviewNote,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

// Test plan:
// - Mục tiêu: kiểm tra mục ghi chú phản hồi — composer theo quyền, quyền sở hữu nút Sửa/Xóa, tombstone và trạng thái bất đồng bộ.
// - Loại test: component interaction trong jsdom (RTL).
// - Đối tượng: TopicReviewNotes + TopicReviewNotesProvider.
// - Case thành công:
//   - reviewer thấy composer, gửi được ghi chú và giữ nội dung khi submit lỗi;
//   - chủ ghi chú thấy nút Sửa/Xóa, sửa xong gọi action rồi refresh;
//   - nhãn đích hiện "Flashcard: <từ>" / "Bài tập: <tiêu đề>" khi có;
//   - nhãn "đã chỉnh sửa" hiện khi `isEdited`.
// - Case thất bại:
//   - người không có quyền review chỉ đọc, KHÔNG thấy composer;
//   - người không phải reader VÀ không có lỗi đọc thì không render mục này;
//   - lỗi đường đọc hiện thông báo lỗi (không phải danh sách rỗng) ở ĐÚNG tổ hợp
//     `canRead=false` + `readError` mà `page.tsx` tạo ra khi đọc lỗi — đây là
//     regression guard cho việc state `error` từng không thể tới được.
// - Bảo mật/phân quyền: nút Sửa/Xóa chỉ hiện với note của chính mình; xoá là xoá mềm có xác nhận nêu hậu quả.
// - Ổn định/resilience: body 2000 ký tự vẫn render; tombstone không hiện body.
// - Invariant cần giữ: ghi chú không mang verdict — component không hiển thị trạng thái duyệt nào.
// - Kết quả verify gần nhất: passed (12 test) bằng `npx vitest run __tests__/components/topic-review-notes.test.tsx`.

const topicId = "11111111-1111-4111-8111-111111111111";
const currentUserId = "22222222-2222-4222-8222-222222222222";
const otherUserId = "33333333-3333-4333-8333-333333333333";
const readErrorText = "Không thể tải ghi chú của bài học. Vui lòng thử lại.";

function note(overrides: Partial<TopicReviewNote> = {}): TopicReviewNote {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    topicId,
    cardId: null,
    exerciseId: null,
    author: { userId: currentUserId, fullName: "Reviewer", email: "reviewer@example.com", avatarUrl: null },
    body: "Cần thêm ví dụ cho flashcard này.",
    createdAt: "2026-09-17T06:00:00.000Z",
    updatedAt: "2026-09-17T06:00:00.000Z",
    isEdited: false,
    removedAt: null,
    removedBy: null,
    cardTitle: null,
    exerciseTitle: null,
    ...overrides,
  };
}

function renderNotes(overrides: {
  notes?: TopicReviewNote[] | null;
  readError?: string | null;
  canRead?: boolean;
  canReview?: boolean;
} = {}) {
  return render(
    <TopicReviewNotesProvider
      topicId={topicId}
      notes={overrides.notes === undefined ? [note()] : overrides.notes}
      readError={overrides.readError ?? null}
      currentUserId={currentUserId}
      canRead={overrides.canRead ?? true}
      canReview={overrides.canReview ?? true}
    >
      <TopicReviewNotes />
    </TopicReviewNotesProvider>,
  );
}

describe("TopicReviewNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createReviewNote.mockResolvedValue({ success: true });
    mocks.updateReviewNote.mockResolvedValue({ success: true });
    mocks.removeReviewNote.mockResolvedValue({ success: true });
  });

  it("does not render for a user who cannot read notes", () => {
    const { container } = renderNotes({ canRead: false });

    expect(container.textContent).toBe("");
  });

  it("hides the composer from a reader without review capability", () => {
    renderNotes({ canReview: false });

    expect(screen.getByText("Ghi chú phản hồi (1)")).toBeTruthy();
    expect(screen.getByText("Cần thêm ví dụ cho flashcard này.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Gửi ghi chú" })).toBeNull();
    expect(screen.queryByLabelText("Nội dung ghi chú")).toBeNull();
  });

  it("shows an empty state when the topic has no notes", () => {
    renderNotes({ notes: [] });

    expect(screen.getByText("Chưa có ghi chú nào cho bài học này.")).toBeTruthy();
  });

  // Tổ hợp `canRead=false` + `readError` là tổ hợp `page.tsx` THẬT SỰ tạo ra khi
  // đường đọc lỗi (`canRead` phụ thuộc payload đọc được). Trước đây case này chỉ
  // dùng `canRead` mặc định `true` nên không bắt được việc state `error` chết
  // trong production. Đây là regression guard cho đúng lỗi đó.
  it("shows the read error in the reviewer state that page.tsx actually produces", () => {
    renderNotes({ notes: null, readError: readErrorText, canRead: false, canReview: true });

    expect(screen.getByRole("alert").textContent).toBe(readErrorText);
    expect(screen.queryByText("Chưa có ghi chú nào cho bài học này.")).toBeNull();
    expect(screen.queryByText("Ghi chú phản hồi (0)")).toBeNull();
  });

  it("still shows the read error to a reader without review capability", () => {
    renderNotes({ notes: null, readError: readErrorText, canRead: false, canReview: false });

    expect(screen.getByRole("alert").textContent).toBe(readErrorText);
    expect(screen.queryByLabelText("Nội dung ghi chú")).toBeNull();
  });

  it("submits a note and refreshes the server component", async () => {
    renderNotes({ notes: [] });

    fireEvent.change(screen.getByLabelText("Nội dung ghi chú"), {
      target: { value: "  Bổ sung phiên âm.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Gửi ghi chú" }));

    await waitFor(() => expect(mocks.createReviewNote).toHaveBeenCalledWith({
      topicId,
      body: "  Bổ sung phiên âm.  ",
    }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("keeps the typed content and surfaces the error when submit fails", async () => {
    mocks.createReviewNote.mockResolvedValue({ error: "Bạn không có quyền ghi chú cho bài học này." });
    renderNotes({ notes: [] });

    const textarea = screen.getByLabelText("Nội dung ghi chú") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "Nội dung còn giữ." } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi ghi chú" }));

    await waitFor(() => expect(mocks.toastError)
      .toHaveBeenCalledWith("Bạn không có quyền ghi chú cho bài học này."));
    expect(textarea.value).toBe("Nội dung còn giữ.");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("only offers edit and delete on notes authored by the current user", () => {
    renderNotes({ notes: [note({ author: { userId: otherUserId, fullName: "Editor", email: null, avatarUrl: null } })] });

    expect(screen.getByText("Editor")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sửa/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Xóa/ })).toBeNull();
  });

  it("edits own note body through the update action", async () => {
    renderNotes();

    fireEvent.click(screen.getByRole("button", { name: /Sửa/ }));
    fireEvent.change(screen.getByLabelText("Nội dung ghi chú đang sửa"), {
      target: { value: "Đã sửa lại nội dung." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(mocks.updateReviewNote).toHaveBeenCalledWith({
      noteId: "44444444-4444-4444-8444-444444444444",
      body: "Đã sửa lại nội dung.",
    }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it("confirms the soft delete with object, consequence and irreversibility", async () => {
    renderNotes();

    fireEvent.click(screen.getByRole("button", { name: /Xóa/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Ghi chú sẽ được đánh dấu đã xóa và vẫn hiển thị với người xem. Không thể hoàn tác.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Xóa ghi chú" }));
    await waitFor(() => expect(mocks.removeReviewNote).toHaveBeenCalledWith({
      noteId: "44444444-4444-4444-8444-444444444444",
    }));
  });

  it("renders the target label and the edited badge", () => {
    renderNotes({
      notes: [
        note({ cardId: "55555555-5555-4555-8555-555555555555", cardTitle: "resilient", isEdited: true }),
        note({ id: "66666666-6666-4666-8666-666666666666", exerciseId: "77777777-7777-4777-8777-777777777777", exerciseTitle: "Bài tập 5" }),
      ],
    });

    expect(screen.getByText("Flashcard: resilient")).toBeTruthy();
    expect(screen.getByText("Bài tập: Bài tập 5")).toBeTruthy();
    expect(screen.getAllByText("đã chỉnh sửa")).toHaveLength(1);
  });

  it("renders a tombstone without the body and keeps long bodies intact", () => {
    renderNotes({
      notes: [
        note({ removedAt: "2026-09-17T08:00:00.000Z", removedBy: { userId: otherUserId, fullName: "Editor", email: null, avatarUrl: null } }),
        note({ id: "88888888-8888-4888-8888-888888888888", body: "y".repeat(2000) }),
      ],
    });

    expect(screen.getByText("Ghi chú đã bị xóa bởi Editor")).toBeTruthy();
    expect(screen.queryByText("Cần thêm ví dụ cho flashcard này.")).toBeNull();
    expect(screen.getByText("y".repeat(2000))).toBeTruthy();
    // Tombstone không có nút Sửa/Xóa dù là note của mình.
    expect(screen.getAllByRole("button", { name: /Xóa/ })).toHaveLength(1);
  });
});
