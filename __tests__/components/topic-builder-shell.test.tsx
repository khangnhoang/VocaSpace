// @vitest-environment jsdom

import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TopicBuilderTabs from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicBuilderTabs";
import { TooltipProvider } from "@/components/ui/tooltip";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
window.HTMLElement.prototype.scrollIntoView = vi.fn();

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  search: "",
  getCardsByTopicId: vi.fn(),
  updateCard: vi.fn(),
  getMemoryCheckByTopicId: vi.fn(),
  getExercisesByTopicId: vi.fn(),
  requestTopicReview: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
  usePathname: () => "/teacher/courses/c/topics/t",
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock("@/app/actions/card", () => ({
  getCardsByTopicId: mocks.getCardsByTopicId,
  createCard: vi.fn(),
  updateCard: mocks.updateCard,
  deleteCard: vi.fn(),
}));

vi.mock("@/app/actions/exercise", () => ({
  getMemoryCheckByTopicId: mocks.getMemoryCheckByTopicId,
  getExercisesByTopicId: mocks.getExercisesByTopicId,
  addMemoryCheckQuestion: vi.fn(),
  updateQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
  deleteExercise: vi.fn(),
  updateExerciseBasic: vi.fn(),
  updateQuestionGroup: vi.fn(),
  deleteQuestionGroupMedia: vi.fn(),
  createExercise: vi.fn(),
}));

vi.mock("@/app/actions/topic", () => ({
  getTopicById: vi.fn().mockResolvedValue({ data: { title: "Bài học kiểm thử", status: "draft" } }),
  updateTopic: vi.fn(),
  deleteTopic: vi.fn(),
  withdrawReviewToDraft: vi.fn(),
}));

vi.mock("@/app/actions/topic-review", () => ({
  approveTopicReview: vi.fn(),
  rejectTopicReview: vi.fn(),
  requestTopicReview: mocks.requestTopicReview,
}));

vi.mock("@/app/actions/course-preview", () => ({
  getTopicDeletePreviewProjection: vi.fn(),
  getCoursePreviewAllocation: vi.fn().mockResolvedValue({ data: null }),
  setCourseTopicPreviewMarkers: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));

vi.mock("@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicAuthorshipSection", () => ({
  default: () => null,
}));

vi.mock("@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicReviewNotes", () => ({
  default: () => null,
  TopicReviewNotesProvider: ({ children }: { children: React.ReactNode }) => children,
  useTopicReviewNotesSummary: () => ({ isVisible: false, count: null, hasReadError: false }),
}));

// Test plan:
// - Mục tiêu: shell topic builder TFEAT4 (AC1, AC2, AC6, AC12 ở mức component): một header với tên bài học, bốn tab theo
//   đúng thứ tự, `?tab=` và deep link dashboard mở đúng tab; editor còn thay đổi chưa lưu thì đổi tab hoặc `Gửi duyệt`
//   phải hỏi Lưu / Bỏ thay đổi / Tiếp tục sửa; URL tab chỉ được ghi khi không còn server action chờ (G8).
// - Loại test: component interaction trong jsdom; Server Action được mock; server action đang chờ được giả lập bằng một
//   request `fetch` có header `Next-Action` như Next gửi.
// - Case thành công: Bỏ thay đổi rồi đổi tab; Lưu thành công rồi mới gửi duyệt; ghi URL sau khi action xong.
// - Case thất bại: Tiếp tục sửa giữ tab và dữ liệu; lưu thất bại thì không gửi duyệt và vẫn giữ dữ liệu.
// - Guard còn chặn: đổi sang thẻ khác trong cùng tab, rời trang qua link trong trang (chỉ điều hướng sau lựa chọn),
//   Esc trong editor (Tiếp tục sửa giữ focus ở field), và bản nháp bài tập không mất khi cửa sổ vượt mốc `lg`.
// - Ngoài phạm vi: bản production build và Next router thật (smoke `topic-builder-tabs` chịu trách nhiệm).

const topicId = "11111111-1111-4111-8111-111111111111";
const courseId = "22222222-2222-4222-8222-222222222222";
const questionId = "77777777-7777-4777-8777-777777777777";

const workflow = {
  topicId,
  courseId,
  chapterId: "33333333-3333-4333-8333-333333333333",
  title: "Đàm phán hợp đồng",
  status: "draft" as const,
  role: "owner" as const,
  canEdit: true,
  canReview: true,
  canRequestReview: true,
  canWithdrawReview: false,
  canDeleteTopic: true,
  activeFlashcardCount: 1,
  activeExerciseCount: 1,
  activeMemoryCheckQuestionCount: 0,
  isMemoryCheckReady: true,
  isReady: true,
  pendingSubmissionId: null,
  pendingSubmitterId: null,
  isCurrentUserSubmitter: false,
  rejectionCount: 0,
  rejectionHistory: [],
  hasDistinctEligibleReviewer: true,
  originalCreator: { userId: "44444444-4444-4444-8444-444444444444", fullName: "An Nguyễn", email: "an@example.com", avatarUrl: null },
  responsibleAuthor: { userId: "44444444-4444-4444-8444-444444444444", fullName: "An Nguyễn", email: "an@example.com", avatarUrl: null },
  contributors: [],
  canManageAuthorship: true,
  isCurrentUserResponsible: true,
  isCurrentUserContributor: false,
  latestAuthorshipFeedback: null,
};

const card = {
  id: "card-1",
  topic_id: topicId,
  front_content: { word: "negotiate", pos: "v", phonetic: "/x/" },
  back_content: { translation: "đàm phán", example: "We negotiate." },
  order_index: 1,
  created_at: "2026-10-01T00:00:00.000Z",
};

function renderShell(search: string) {
  mocks.search = search;
  return render(
    <TooltipProvider>
      <TopicBuilderTabs
        courseId={courseId}
        topicId={topicId}
        parentChapterId={workflow.chapterId}
        initialSearch={search}
        workflow={workflow}
      />
    </TooltipProvider>,
  );
}

async function openCardAndEdit() {
  fireEvent.click(await screen.findByRole("button", { name: /negotiate/ }));
  fireEvent.change(screen.getByRole("textbox", { name: "Từ vựng" }), { target: { value: "negotiate (đang sửa)" } });
}

const tab = (name: RegExp) => screen.getByRole("tab", { name });

describe("TopicBuilderTabs shell", () => {
  let replaceStateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    replaceStateSpy = vi.spyOn(window.history, "replaceState");
    mocks.getCardsByTopicId.mockResolvedValue({ data: [card] });
    mocks.getMemoryCheckByTopicId.mockResolvedValue({ data: null });
    mocks.getExercisesByTopicId.mockResolvedValue({ data: [] });
    mocks.updateCard.mockResolvedValue({ success: true, message: "Cập nhật thành công!" });
    mocks.requestTopicReview.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    replaceStateSpy.mockRestore();
  });

  it("shows one header with the topic title, status, author and back link, then four tabs in order", async () => {
    renderShell("");
    expect(screen.getByRole("heading", { level: 1, name: "Đàm phán hợp đồng" })).toBeTruthy();
    expect(screen.getByText("Bản nháp")).toBeTruthy();
    expect(screen.getByText("An Nguyễn")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Cấu trúc khóa học" }).getAttribute("href")).toBe(
      `/teacher/courses/${courseId}/structure?chapter=${workflow.chapterId}`,
    );
    const names = screen.getAllByRole("tab").map((item) => item.textContent?.replace(/[:\d\s]+$/, ""));
    expect(names).toEqual(["Từ vựng", "Memory check", "Bài tập", "Cài đặt"]);
    expect(tab(/^Bài tập/).getAttribute("aria-selected")).toBe("true");
    await waitFor(() => expect(mocks.getExercisesByTopicId).toHaveBeenCalled());
    // Tab chưa mở thì chưa tải dữ liệu (không phát server action thừa).
    expect(mocks.getCardsByTopicId).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Thêm hàng loạt/ })).toBeNull();
  });

  it("opens Memory check from ?tab=memory-check and falls back to Bài tập for an unknown tab", async () => {
    const { unmount } = renderShell("tab=memory-check");
    expect(tab(/^Memory check/).getAttribute("aria-selected")).toBe("true");
    await waitFor(() => expect(mocks.getMemoryCheckByTopicId).toHaveBeenCalled());
    unmount();

    renderShell("tab=khong-ton-tai");
    expect(tab(/^Bài tập/).getAttribute("aria-selected")).toBe("true");
  });

  it("asks before switching tab with a dirty editor: keep editing stays, discard switches", async () => {
    renderShell("tab=flashcards");
    await openCardAndEdit();

    fireEvent.mouseDown(tab(/^Memory check/));
    const prompt = await screen.findByRole("dialog", { name: "Lưu thay đổi trước khi rời đi?" });
    fireEvent.click(within(prompt).getByRole("button", { name: "Tiếp tục sửa" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(tab(/^Từ vựng/).getAttribute("aria-selected")).toBe("true");
    expect((screen.getByRole("textbox", { name: "Từ vựng" }) as HTMLInputElement).value).toBe("negotiate (đang sửa)");

    fireEvent.mouseDown(tab(/^Memory check/));
    fireEvent.click(
      within(await screen.findByRole("dialog", { name: "Lưu thay đổi trước khi rời đi?" })).getByRole("button", {
        name: "Bỏ thay đổi",
      }),
    );
    await waitFor(() => expect(tab(/^Memory check/).getAttribute("aria-selected")).toBe("true"));
    expect(mocks.updateCard).not.toHaveBeenCalled();
  });

  it("saves a dirty editor before Gửi duyệt and sends for review only after the save succeeds", async () => {
    renderShell("tab=flashcards");
    await openCardAndEdit();

    fireEvent.click(screen.getByRole("button", { name: "Gửi duyệt" }));
    const prompt = await screen.findByRole("dialog", { name: "Lưu thay đổi trước khi rời đi?" });
    expect(mocks.requestTopicReview).not.toHaveBeenCalled();
    fireEvent.click(within(prompt).getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(mocks.updateCard).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.requestTopicReview).toHaveBeenCalledWith({ topicId }));
    expect(mocks.updateCard.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.requestTopicReview.mock.invocationCallOrder[0],
    );
  });

  it("does not send for review when saving the dirty editor fails, and keeps the typed value", async () => {
    mocks.updateCard.mockResolvedValueOnce({ error: "Không thể cập nhật thẻ này." });
    renderShell("tab=flashcards");
    await openCardAndEdit();

    fireEvent.click(screen.getByRole("button", { name: "Gửi duyệt" }));
    fireEvent.click(
      within(await screen.findByRole("dialog", { name: "Lưu thay đổi trước khi rời đi?" })).getByRole("button", {
        name: "Lưu",
      }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain("Không thể cập nhật thẻ này.");
    expect(mocks.requestTopicReview).not.toHaveBeenCalled();
    expect((screen.getByRole("textbox", { name: "Từ vựng" }) as HTMLInputElement).value).toBe("negotiate (đang sửa)");
  });

  it("waits for an in-flight save instead of prompting or saving twice when the tab changes", async () => {
    let finishSave: (value: { success: boolean; message: string }) => void = () => undefined;
    mocks.updateCard.mockImplementationOnce(
      () => new Promise((resolve) => (finishSave = resolve)),
    );
    renderShell("tab=flashcards");
    await openCardAndEdit();

    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    fireEvent.mouseDown(tab(/^Memory check/));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(tab(/^Từ vựng/).getAttribute("aria-selected")).toBe("true");

    await act(async () => finishSave({ success: true, message: "Cập nhật thành công!" }));
    await waitFor(() => expect(tab(/^Memory check/).getAttribute("aria-selected")).toBe("true"));
    expect(mocks.updateCard).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("asks before switching to another card in the same tab and keeps the draft on Tiếp tục sửa", async () => {
    mocks.getCardsByTopicId.mockResolvedValue({
      data: [card, { ...card, id: "card-2", front_content: { word: "invoice" }, back_content: { translation: "hóa đơn" } }],
    });
    renderShell("tab=flashcards");
    await openCardAndEdit();

    fireEvent.click(screen.getByRole("button", { name: /invoice/ }));
    const prompt = await screen.findByRole("dialog", { name: "Lưu thay đổi trước khi rời đi?" });
    fireEvent.click(within(prompt).getByRole("button", { name: "Tiếp tục sửa" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect((screen.getByRole("textbox", { name: "Từ vựng" }) as HTMLInputElement).value).toBe("negotiate (đang sửa)");
  });

  it("asks before leaving through an in-page link and navigates only after the choice", async () => {
    renderShell("tab=flashcards");
    await openCardAndEdit();

    fireEvent.click(screen.getByRole("link", { name: "Cấu trúc khóa học" }));
    const prompt = await screen.findByRole("dialog", { name: "Lưu thay đổi trước khi rời đi?" });
    expect(mocks.router.push).not.toHaveBeenCalled();
    fireEvent.click(within(prompt).getByRole("button", { name: "Bỏ thay đổi" }));

    await waitFor(() =>
      expect(mocks.router.push).toHaveBeenCalledWith(
        `/teacher/courses/${courseId}/structure?chapter=${workflow.chapterId}`,
      ),
    );
    expect(mocks.updateCard).not.toHaveBeenCalled();
  });

  it("asks on Esc in the editor and keeps focus in the field when the author keeps editing", async () => {
    renderShell("tab=flashcards");
    await openCardAndEdit();
    const word = screen.getByRole("textbox", { name: "Từ vựng" });
    word.focus();

    fireEvent.keyDown(word, { key: "Escape" });
    const prompt = await screen.findByRole("dialog", { name: "Lưu thay đổi trước khi rời đi?" });
    fireEvent.click(within(prompt).getByRole("button", { name: "Tiếp tục sửa" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("heading", { name: "negotiate" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Từ vựng" }));
  });

  it("keeps an unsaved exercise draft when the window crosses the lg breakpoint", async () => {
    let matches = true;
    const listeners = new Set<() => void>();
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) => ({
      get matches() {
        return matches;
      },
      media: query,
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    })) as unknown as typeof window.matchMedia;
    try {
      renderShell("tab=exercises");
      fireEvent.click((await screen.findAllByRole("button", { name: "Thêm bài tập" }))[0]);
      fireEvent.click(screen.getByRole("button", { name: /^Part 5 ·/ }));
      fireEvent.change(screen.getByLabelText(/^Tên bài tập/), { target: { value: "Bài đang soạn dở" } });

      act(() => {
        matches = false;
        listeners.forEach((listener) => listener());
      });

      expect((screen.getByLabelText(/^Tên bài tập/) as HTMLInputElement).value).toBe("Bài đang soạn dở");
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("writes ?tab= only after the pending server action settles (ACTION-QUEUE-001)", async () => {
    let settle: (value: Response) => void = () => undefined;
    const baseFetch = vi.fn(() => new Promise<Response>((resolve) => (settle = resolve)));
    const originalFetch = window.fetch;
    window.fetch = baseFetch as unknown as typeof fetch;
    try {
      renderShell("tab=flashcards");
      await screen.findByRole("button", { name: /negotiate/ });

      let pending!: Promise<Response>;
      act(() => {
        pending = window.fetch("/teacher", { method: "POST", headers: { "Next-Action": "abc" } });
      });
      fireEvent.mouseDown(tab(/^Cài đặt/));
      expect(tab(/^Cài đặt/).getAttribute("aria-selected")).toBe("true");
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(replaceStateSpy).not.toHaveBeenCalled();

      await act(async () => {
        settle(new Response("ok"));
        await pending;
      });
      await waitFor(() =>
        expect(replaceStateSpy).toHaveBeenCalledWith(null, "", expect.stringMatching(/\?tab=settings$/)),
      );
    } finally {
      window.fetch = originalFetch;
    }
  });

  it("keeps the dashboard deep link tab and opens the flagged question with its guidance", async () => {
    mocks.getExercisesByTopicId.mockResolvedValue({
      data: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          title: "Part 5 luyện tập",
          part_type: "part5",
          groups: [],
          questions: [
            {
              id: questionId,
              content: "",
              explanation: null,
              options: [
                { id: "o-a", content: "go", is_correct: true },
                { id: "o-b", content: "goes", is_correct: false },
              ],
            },
          ],
        },
      ],
    });
    renderShell(
      `from=dashboard&issue=question_missing_content&targetType=question&target=${questionId}&tab=exercises`,
    );

    expect(tab(/^Bài tập/).getAttribute("aria-selected")).toBe("true");
    expect(await screen.findByText(/cần được chỉnh sửa trước khi khóa học sẵn sàng/)).toBeTruthy();
    expect(await screen.findByRole("heading", { name: "Câu 1" })).toBeTruthy();
    expect(screen.getAllByText("Được dashboard đánh dấu").length).toBeGreaterThan(0);
  });
});
