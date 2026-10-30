// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TopicWorkflowPanel from "@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicWorkflowPanel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getCourseStructurePath, type TopicBuilderTab } from "@/lib/course-authoring/routes";

// Radix Tooltip đo kích thước qua ResizeObserver, mà jsdom không có API này.
// Stub tối thiểu để component chạy được; đây không phải hành vi đang được test.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

const mocks = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
  deleteTopic: vi.fn(),
  getTopicDeletePreviewProjection: vi.fn(),
  requestTopicReview: vi.fn(),
  notesSummary: { isVisible: true, count: 2 as number | null, hasReadError: false },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

vi.mock("@/app/actions/topic-review", () => ({
  approveTopicReview: vi.fn(),
  rejectTopicReview: vi.fn(),
  requestTopicReview: mocks.requestTopicReview,
}));

vi.mock("@/app/actions/topic", () => ({
  deleteTopic: mocks.deleteTopic,
  withdrawReviewToDraft: vi.fn(),
}));

vi.mock("@/app/actions/course-preview", () => ({
  getTopicDeletePreviewProjection: mocks.getTopicDeletePreviewProjection,
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicAuthorshipSection", () => ({
  default: () => <p>Nội dung nhóm tác giả</p>,
}));

vi.mock("@/app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicReviewNotes", () => ({
  default: () => <p>Nội dung ghi chú</p>,
  TopicReviewNotesProvider: ({ children }: { children: React.ReactNode }) => children,
  useTopicReviewNotesSummary: () => mocks.notesSummary,
}));

const baseWorkflow = {
  topicId: "11111111-1111-4111-8111-111111111111",
  courseId: "22222222-2222-4222-8222-222222222222",
  chapterId: "33333333-3333-4333-8333-333333333333",
  title: "Bài học kiểm thử",
  status: "draft" as const,
  role: "owner" as const,
  canEdit: true,
  canReview: true,
  canRequestReview: false,
  canWithdrawReview: false,
  canDeleteTopic: true,
  activeFlashcardCount: 0,
  activeExerciseCount: 0,
  activeMemoryCheckQuestionCount: 0,
  isMemoryCheckReady: true,
  isReady: false,
  pendingSubmissionId: null,
  pendingSubmitterId: null,
  isCurrentUserSubmitter: false,
  rejectionCount: 0,
  rejectionHistory: [] as Array<{
    index: number;
    reason: string;
    reviewer: { userId: string; fullName: string | null; email: string | null; avatarUrl: string | null } | null;
    reviewedAt: string;
  }>,
  hasDistinctEligibleReviewer: false,
  originalCreator: { userId: "44444444-4444-4444-8444-444444444444", fullName: "Owner", email: "owner@example.com", avatarUrl: null },
  responsibleAuthor: { userId: "44444444-4444-4444-8444-444444444444", fullName: "Owner", email: "owner@example.com", avatarUrl: null },
  contributors: [],
  canManageAuthorship: true,
  isCurrentUserResponsible: true,
  isCurrentUserContributor: false,
  latestAuthorshipFeedback: null,
};

function rejectionEntry(index: number, reason: string, reviewerFullName: string | null) {
  return {
    index,
    reason,
    reviewer: reviewerFullName === null
      ? null
      : {
          userId: "55555555-5555-4555-8555-555555555555",
          fullName: reviewerFullName,
          email: "reviewer@example.com",
          avatarUrl: null,
        },
    reviewedAt: `2026-09-${String(10 + index).padStart(2, "0")}T06:00:00.000Z`,
  };
}

// `TooltipProvider` là ambient shell ở `app/layout.tsx`, không nằm trong panel.
// Harness này dựng lại đúng môi trường runtime đó cho các case có tooltip.
function Panel(props: Omit<Parameters<typeof TopicWorkflowPanel>[0], "activeTab" | "onOpenTab"> & {
  activeTab?: TopicBuilderTab;
  onOpenTab?: (tab: TopicBuilderTab) => void;
}) {
  return (
    <TooltipProvider>
      <TopicWorkflowPanel activeTab="settings" onOpenTab={vi.fn()} {...props} />
    </TooltipProvider>
  );
}

// Nút xóa chỉ render trong trạng thái `pending` và chỉ khi actor được phép xóa.
// Fixture này dựng đúng tổ hợp đó: người tạo đang có yêu cầu chờ duyệt nhưng
// KHÔNG có quyền hủy gửi duyệt, nên nhãn nút là "Xóa bài học" (D33/U7).
const deletableWorkflow = {
  ...baseWorkflow,
  status: "pending" as const,
  canWithdrawReview: false,
  canDeleteTopic: true,
  pendingSubmissionId: "66666666-6666-4666-8666-666666666666",
  pendingSubmitterId: "44444444-4444-4444-8444-444444444444",
};

// Test plan:
// - Mục tiêu: kiểm tra state projection của readiness, khối lịch sử từ chối topic-scoped, trạng thái chờ duyệt,
//   affordance lý do tại action Gửi duyệt, projection trước xóa và điều hướng sau mutation.
// - Loại test: component interaction trong jsdom.
// - Đối tượng: TopicWorkflowPanel.
// - Case thành công:
//   - thiếu nội dung hiện khung vàng nêu đúng phần thiếu, có nút mở tab cần bổ sung; đủ thì không hiện gì;
//   - nhóm tác giả và ghi chú nằm trong side sheet, mở từ hai nút ở header, đóng thì trả focus về nút đã bấm;
//   - khối lịch sử hiện mục gần nhất mặc định, mở đủ `Lần 1..N` khi bấm "Xem tất cả N lần";
//   - thời gian ra đúng dạng `HH:mm · dd/MM/yyyy` 24 giờ, không có hậu tố 12 giờ;
//   - `reviewer = null` hiện chuỗi thay thế thay vì khoảng trắng;
//   - trạng thái pending không còn action escalation nào;
//   - contributor thấy affordance info ngay cạnh action, mở được bằng keyboard focus và bằng hover,
//     với đúng câu lý do quyền và không có câu "sẵn sàng để gửi";
//   - pending-delete tải projection trước, gửi danh sách gỡ nhãn hiện hành, hủy review rồi điều hướng về course Structure;
//   - xóa thành công không refresh route topic đã xóa;
//   - bài học đã xuất bản mà tác giả có quyền sửa nói chỉnh sửa hiển thị ngay, không còn nhắc "bản nháp" (TFEAT1 AC6).
// - Case thất bại:
//   - `rejectionHistory: []` (kể cả topic published) không render khối lịch sử;
//   - xóa lỗi giữ dialog và route hiện tại, không điều hướng.
// - Bảo mật/phân quyền: chỉ hiển thị action duyệt/từ chối khi workflow đã cấp quyền; affordance lý do
//   biến mất khi `canRequestReview = true` để không hiện lý do chặn sai lúc nút đang bật.
// - Ổn định/resilience: lý do dài 2000 ký tự vẫn wrap trong khối lịch sử.
// - Invariant cần giữ: không còn copy ngân sách `/3`; lịch sử cũ không dùng màu cảnh báo đỏ;
//   câu lý do tại action và câu vòng đời luôn cùng một nguồn.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/components/topic-workflow-panel.test.tsx`.

describe("TopicWorkflowPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notesSummary = { isVisible: true, count: 2, hasReadError: false };
    mocks.deleteTopic.mockResolvedValue({ success: true, message: "Đã xóa bài học khỏi khóa học." });
    mocks.getTopicDeletePreviewProjection.mockResolvedValue({
      data: {
        courseId: baseWorkflow.courseId,
        topicId: baseWorkflow.topicId,
        currentAllocation: {
          courseId: baseWorkflow.courseId,
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
        canManageMarkers: true,
        outsideMarkedTopics: [],
      },
    });
  });

  it("names only what is missing and opens the tab that needs it", () => {
    const onOpenTab = vi.fn();
    render(<Panel workflow={baseWorkflow} onRefresh={vi.fn()} onOpenTab={onOpenTab} />);

    // Thiếu nội dung là trạng thái cần bổ sung (amber), không phải lỗi (đỏ).
    const notice = screen.getByText("Còn thiếu 1 flashcard và 1 bài tập để gửi duyệt.");
    expect(notice.closest("div.rounded-xl")?.className).toContain("border-attention-line");
    expect(notice.closest("div.rounded-xl")?.className).not.toContain("border-correction-line");
    // Câu lý do chỉ còn ở association của nút gửi duyệt, không lặp lại cạnh khung cảnh báo.
    const reason = "Bổ sung đủ ít nhất một flashcard và một bài tập để gửi duyệt.";
    expect(screen.getAllByText(reason)).toHaveLength(1);
    const submit = screen.getByRole("button", { name: "Gửi duyệt" });
    expect(document.getElementById(submit.getAttribute("aria-describedby")!)?.textContent).toBe(reason);

    fireEvent.click(screen.getByRole("button", { name: "Mở tab Từ vựng" }));
    expect(onOpenTab).toHaveBeenCalledWith("flashcards");
    fireEvent.click(screen.getByRole("button", { name: "Mở tab Bài tập" }));
    expect(onOpenTab).toHaveBeenCalledWith("exercises");
  });

  it("names just the missing part and offers no button for the tab already open", () => {
    render(
      <Panel
        workflow={{ ...baseWorkflow, activeFlashcardCount: 3 }}
        onRefresh={vi.fn()}
        activeTab="exercises"
      />,
    );

    expect(screen.getByText("Còn thiếu 1 bài tập để gửi duyệt.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mở tab Bài tập" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mở tab Từ vựng" })).toBeNull();
  });

  it("shows no readiness notice or sentence once the topic has everything", () => {
    const ready = "Bài học đã sẵn sàng để gửi người duyệt kiểm tra.";
    render(
      <Panel
        workflow={{
          ...baseWorkflow,
          canRequestReview: true,
          isReady: true,
          activeFlashcardCount: 3,
          activeExerciseCount: 2,
          hasDistinctEligibleReviewer: true,
        }}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.queryByText(/Còn thiếu/)).toBeNull();
    expect(screen.queryByText("Flashcard hoạt động")).toBeNull();
    expect(screen.queryByText("Bài tập hoạt động")).toBeNull();
    // Chỉ còn câu ẩn cho trình đọc màn hình của nút Gửi duyệt.
    expect(screen.getByText(ready).className).toContain("sr-only");
  });

  it("keeps the missing-content notice away from people who cannot act on it", () => {
    const { rerender } = render(<Panel workflow={{ ...baseWorkflow, canEdit: false }} onRefresh={vi.fn()} />);
    expect(screen.queryByText(/Còn thiếu/)).toBeNull();

    rerender(<Panel workflow={{ ...baseWorkflow, status: "published" as const }} onRefresh={vi.fn()} />);
    expect(screen.queryByText(/Còn thiếu/)).toBeNull();

    rerender(<Panel workflow={{ ...deletableWorkflow }} onRefresh={vi.fn()} />);
    expect(screen.queryByText(/Còn thiếu/)).toBeNull();
  });

  it("opens the team and notes sheet from either header button and returns focus on close", async () => {
    render(<Panel workflow={baseWorkflow} onRefresh={vi.fn()} />);
    expect(screen.queryByText("Nội dung nhóm tác giả")).toBeNull();

    const notesButton = screen.getByRole("button", { name: /^Ghi chú\s*:\s*2$/ });
    fireEvent.click(notesButton);
    const sheet = await screen.findByRole("dialog", { name: "Nhóm tác giả và ghi chú" });
    expect(within(sheet).getByText("Nội dung nhóm tác giả")).toBeTruthy();
    const notes = within(sheet).getByText("Nội dung ghi chú");
    await waitFor(() => expect(document.activeElement).toBe(notes.parentElement));

    fireEvent.click(within(sheet).getByRole("button", { name: "Đóng" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(notesButton));

    fireEvent.click(screen.getByRole("button", { name: /^Nhóm tác giả\s*,\s*1 người$/ }));
    const reopened = await screen.findByRole("dialog");
    const team = within(reopened).getByText("Nội dung nhóm tác giả");
    await waitFor(() => expect(document.activeElement).toBe(team.parentElement));
  });

  it("signals a pending responsibility update and unreadable notes on the buttons", () => {
    mocks.notesSummary = { isVisible: true, count: null, hasReadError: true };
    render(
      <Panel
        workflow={{
          ...baseWorkflow,
          latestAuthorshipFeedback: {
            id: "77777777-7777-4777-8777-777777777777",
            actorUserId: null,
            previousResponsibleUserId: null,
            newResponsibleUserId: null,
            feedbackType: "responsibility_transfer" as const,
            createdAt: "2026-09-17T06:00:00.000Z",
          },
        }}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Nhóm tác giả.*có cập nhật cần xử lý/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Ghi chú.*chưa tải được/ })).toBeTruthy();
  });

  it("hides the notes button from someone who cannot read notes", () => {
    mocks.notesSummary = { isVisible: false, count: null, hasReadError: false };
    render(<Panel workflow={baseWorkflow} onRefresh={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /Ghi chú/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Nhóm tác giả/ })).toBeTruthy();
  });

  it("renders the topic-scoped rejection history with the latest item open by default", () => {
    const workflow = {
      ...baseWorkflow,
      rejectionCount: 3,
      rejectionHistory: [
        rejectionEntry(1, "Cần bổ sung ví dụ.", "Reviewer cũ"),
        rejectionEntry(2, "Thiếu giải thích đáp án.", "Reviewer cũ"),
        rejectionEntry(3, "Sai phiên âm của flashcard.", "Reviewer"),
      ],
    };
    render(<Panel workflow={workflow} onRefresh={vi.fn()} />);

    expect(screen.getByText("Đã bị từ chối duyệt: 3 lần")).toBeTruthy();
    const list = screen.getByRole("list", { name: "Lịch sử từ chối duyệt" });
    expect(within(list).getByText("Lần 3")).toBeTruthy();
    expect(within(list).getByText("Sai phiên âm của flashcard.")).toBeTruthy();
    expect(within(list).queryByText("Lần 1")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Xem tất cả 3 lần" }));
    const expanded = screen.getByRole("list", { name: "Lịch sử từ chối duyệt" });
    expect(within(expanded).getByText("Lần 1")).toBeTruthy();
    expect(within(expanded).getByText("Lần 2")).toBeTruthy();
    expect(within(expanded).getByText("Lần 3")).toBeTruthy();
    expect(within(expanded).getAllByText("Người đánh giá: Reviewer cũ")).toHaveLength(2);
  });

  it("formats the review moment as a 24-hour HH:mm · dd/MM/yyyy string", () => {
    const workflow = {
      ...baseWorkflow,
      rejectionCount: 1,
      rejectionHistory: [rejectionEntry(1, "Cần chỉnh lại tiêu đề.", "Reviewer")],
    };
    const { container } = render(<Panel workflow={workflow} onRefresh={vi.fn()} />);

    expect(container.textContent).toMatch(/\d{2}:\d{2} · \d{2}\/\d{2}\/\d{4}/);
    expect(container.textContent).not.toMatch(/CH|SA/);
    expect(container.textContent).not.toContain("/3");
    expect(container.textContent).not.toContain("lần phản hồi trong lượt gửi");
  });

  it("falls back to an explicit label when the reviewer profile is gone", () => {
    const workflow = {
      ...baseWorkflow,
      rejectionCount: 1,
      rejectionHistory: [rejectionEntry(1, "Cần bổ sung ví dụ.", null)],
    };
    render(<Panel workflow={workflow} onRefresh={vi.fn()} />);

    expect(screen.getByText("Người đánh giá: không còn trong hệ thống")).toBeTruthy();
  });

  it("wraps a 2000-character reason without dropping it and skips the block when history is empty", () => {
    const longReason = "x".repeat(2000);
    const { container, rerender } = render(
      <Panel
        workflow={{ ...baseWorkflow, rejectionCount: 1, rejectionHistory: [rejectionEntry(1, longReason, "Reviewer")] }}
        onRefresh={vi.fn()}
      />,
    );
    expect(container.textContent).toContain(longReason);

    rerender(<Panel workflow={{ ...baseWorkflow, rejectionCount: 0, rejectionHistory: [] }} onRefresh={vi.fn()} />);
    expect(screen.queryByText(/Đã bị từ chối duyệt/)).toBeNull();

    rerender(
      <Panel
        workflow={{
          ...baseWorkflow,
          status: "published" as const,
          rejectionCount: 0,
          rejectionHistory: [],
        }}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Đã bị từ chối duyệt/)).toBeNull();
  });

  it("tells an author of a published topic that edits go live at once, with no draft wording", () => {
    const { container } = render(
      <Panel workflow={{ ...baseWorkflow, status: "published" as const, isReady: true }} onRefresh={vi.fn()} />,
    );

    expect(container.textContent).toContain("chỉnh sửa được lưu và hiển thị cho học viên ngay");
    expect(container.textContent).not.toContain("bản nháp");
    expect(container.textContent).not.toContain("chuyển về");
  });

  it("keeps the pending state free of any escalation action", () => {
    const pending = {
      ...baseWorkflow,
      status: "pending" as const,
      activeFlashcardCount: 1,
      activeExerciseCount: 1,
      isReady: true,
      canWithdrawReview: true,
      pendingSubmissionId: "66666666-6666-4666-8666-666666666666",
      pendingSubmitterId: "44444444-4444-4444-8444-444444444444",
      isCurrentUserSubmitter: true,
    };
    render(<Panel workflow={pending} onRefresh={vi.fn()} />);

    // Ba assertion cũ ở đây query các nhãn chưa từng tồn tại trong panel, nên
    // luôn xanh mà không pin gì. Thay bằng chính các action thật của trạng thái
    // pending: submitter không còn nút gửi duyệt và không có action duyệt/từ chối.
    expect(screen.queryByRole("button", { name: "Gửi duyệt" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Duyệt" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Từ chối" })).toBeNull();
    expect(screen.getByText("Chờ một người duyệt khác xử lý yêu cầu này. Nội dung đang bị đóng băng.")).toBeTruthy();
  });

  // D28: an action inside the actor's own workflow is shown and disabled; an
  // action outside their role is hidden entirely.
  it("shows a disabled submit action and no delete affordance to a contributor", () => {
    const contributor = {
      ...baseWorkflow,
      role: "editor" as const,
      canReview: false,
      canRequestReview: false,
      canDeleteTopic: false,
      isCurrentUserResponsible: false,
      isCurrentUserContributor: true,
      isReady: true,
      activeFlashcardCount: 1,
      activeExerciseCount: 1,
      hasDistinctEligibleReviewer: true,
    };
    render(<Panel workflow={contributor} onRefresh={vi.fn()} />);

    const submit = screen.getByRole("button", { name: "Gửi duyệt" });
    expect(submit).toHaveProperty("disabled", true);
    expect(screen.queryByRole("button", { name: /Xóa bài học/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Quay về chỉnh sửa/ })).toBeNull();
    // M18: cùng một câu lý do ở câu vòng đời và ở association của nút gửi duyệt.
    const reason = "Chỉ người tạo hoặc người phụ trách có thể gửi bài học để duyệt.";
    expect(screen.getAllByText(reason).length).toBeGreaterThan(0);
    expect(document.getElementById(submit.getAttribute("aria-describedby")!)?.textContent).toBe(reason);
  });

  // M18: nút Gửi duyệt bị chặn vì quyền phải mang lý do ngay tại action. Nút
  // `disabled` không nhận pointer/focus event, nên affordance phải là một control
  // thật liền kề — và cùng dùng đúng câu lý do với association của chính nút.
  it("puts the permission reason at the submit action for a contributor", async () => {
    const contributor = {
      ...baseWorkflow,
      role: "editor" as const,
      canReview: false,
      canRequestReview: false,
      canDeleteTopic: false,
      isCurrentUserResponsible: false,
      isCurrentUserContributor: true,
      isReady: true,
      activeFlashcardCount: 1,
      activeExerciseCount: 1,
      hasDistinctEligibleReviewer: true,
    };
    const reason = "Chỉ người tạo hoặc người phụ trách có thể gửi bài học để duyệt.";
    const { container } = render(<Panel workflow={contributor} onRefresh={vi.fn()} />);

    const submit = screen.getByRole("button", { name: "Gửi duyệt" });
    const describedBy = submit.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe(reason);

    // Affordance ngay cạnh action: mở được bằng keyboard focus, không cần hover.
    const infoTrigger = screen.getByRole("button", { name: "Vì sao chưa gửi duyệt được" });
    fireEvent.focus(infoTrigger);
    await waitFor(() => expect(screen.queryAllByRole("tooltip")).toHaveLength(1));
    expect(screen.getByRole("tooltip").textContent).toBe(reason);

    // Không bao giờ nói bài học sẵn sàng gửi duyệt khi `canRequestReview = false`.
    expect(container.textContent).not.toContain("Bài học đã sẵn sàng để gửi người duyệt kiểm tra.");
  });

  it("opens the submit reason tooltip on hover for a contributor", async () => {
    const contributor = {
      ...baseWorkflow,
      role: "editor" as const,
      canReview: false,
      canRequestReview: false,
      canDeleteTopic: false,
      isCurrentUserResponsible: false,
      isCurrentUserContributor: true,
      isReady: true,
      activeFlashcardCount: 1,
      activeExerciseCount: 1,
      hasDistinctEligibleReviewer: true,
    };
    render(<Panel workflow={contributor} onRefresh={vi.fn()} />);

    fireEvent.pointerMove(screen.getByRole("button", { name: "Vì sao chưa gửi duyệt được" }), {
      pointerType: "mouse",
    });
    await waitFor(() => expect(screen.queryAllByRole("tooltip")).toHaveLength(1));
    expect(screen.getByRole("tooltip").textContent)
      .toBe("Chỉ người tạo hoặc người phụ trách có thể gửi bài học để duyệt.");
  });

  // F9 (D22/A25): the creator keeps submit rights after transferring
  // responsibility, so a creator who is not the responsible author and not the
  // submitter must NOT be told they are outside the submitting group. The only
  // actor forbidden to submit is a contributor. This is the actor the suite
  // had never rendered.
  it("gives the content reason, not the contributor reason, to a creator who transferred responsibility", () => {
    render(
      <Panel
        workflow={{
          ...baseWorkflow,
          canEdit: true,
          canRequestReview: false,
          isCurrentUserResponsible: false,
          isCurrentUserSubmitter: false,
          isCurrentUserContributor: false,
          isReady: false,
          activeFlashcardCount: 0,
          activeExerciseCount: 0,
          originalCreator: { userId: baseWorkflow.topicId, fullName: "Creator", email: "creator@example.com", avatarUrl: null },
        }}
        onRefresh={vi.fn()}
      />,
    );

    // The missing-content notice replaces the lifecycle sentence, so the content
    // reason stays only in the action-side `sr-only` span.
    expect(screen.getAllByText("Bổ sung đủ ít nhất một flashcard và một bài tập để gửi duyệt.").length).toBeGreaterThan(0);
    expect(screen.queryByText("Chỉ người tạo hoặc người phụ trách có thể gửi bài học để duyệt.")).toBeNull();
    expect(screen.queryAllByText("Chỉ người tạo hoặc người phụ trách có thể gửi bài học để duyệt.")).toEqual([]);
  });

  // D3 G4: memory check chưa trả lời được thì lý do chặn nói đúng phần cần sửa,
  // không quy về thiếu flashcard/bài tập.
  it("names the memory check when it blocks review readiness", () => {
    render(
      <Panel
        workflow={{
          ...baseWorkflow,
          canEdit: true,
          canRequestReview: false,
          isReady: false,
          isMemoryCheckReady: false,
          activeMemoryCheckQuestionCount: 2,
          activeFlashcardCount: 1,
          activeExerciseCount: 1,
        }}
        onRefresh={vi.fn()}
      />,
    );

    expect(
      screen.getAllByText("Mỗi câu memory check cần ít nhất 2 đáp án và 1 đáp án đúng trước khi gửi duyệt.").length,
    ).toBeGreaterThan(0);
    expect(screen.queryAllByText("Bổ sung đủ ít nhất một flashcard và một bài tập để gửi duyệt.")).toEqual([]);
  });

  // Negative control cho M18: khi action thật sự khả dụng thì không được hiện
  // affordance lý do chặn, để copy không mâu thuẫn với trạng thái nút.
  it("hides the submit reason affordance when the action is available", () => {
    render(
      <Panel
        workflow={{
          ...baseWorkflow,
          canRequestReview: true,
          isReady: true,
          activeFlashcardCount: 1,
          activeExerciseCount: 1,
          hasDistinctEligibleReviewer: true,
        }}
        onRefresh={vi.fn()}
      />,
    );

    expect((screen.getByRole("button", { name: "Gửi duyệt" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("button", { name: "Vì sao chưa gửi duyệt được" })).toBeNull();
  });

  // M27: `router.refresh()` trên route topic vừa xóa sẽ đọc lại topic đã mất.
  // Xóa thành công phải rời route đó về course Structure.
  it("navigates to the course Structure after a successful delete", async () => {
    const onRefresh = vi.fn();
    render(<Panel workflow={deletableWorkflow} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole("button", { name: "Xóa bài học" }));
    await waitFor(() => expect(mocks.getTopicDeletePreviewProjection).toHaveBeenCalledWith(baseWorkflow.topicId));
    fireEvent.click(await screen.findByRole("button", { name: "Xóa bài học" }));

    await waitFor(() => expect(mocks.deleteTopic).toHaveBeenCalledWith({
      topicId: baseWorkflow.topicId,
      unmarkTopicIds: [],
    }));
    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledWith(
      getCourseStructurePath(baseWorkflow.courseId),
    ));
    expect(mocks.router.refresh).not.toHaveBeenCalled();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("stays on the deleted topic route and does not navigate when delete fails", async () => {
    mocks.deleteTopic.mockResolvedValue({ error: "Không thể xóa bài học." });
    render(<Panel workflow={deletableWorkflow} onRefresh={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Xóa bài học" }));
    await waitFor(() => expect(mocks.getTopicDeletePreviewProjection).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: "Xóa bài học" }));

    await waitFor(() => expect(mocks.deleteTopic).toHaveBeenCalled());
    expect((await screen.findByRole("alert")).textContent).toContain("Không thể xóa bài học.");
    expect(mocks.router.push).not.toHaveBeenCalled();
    expect(mocks.router.refresh).not.toHaveBeenCalled();
  });

  // D28/U6: while frozen, a contributor keeps the withdraw action visible but
  // disabled, with the Owner's verbatim reason reachable — a disabled button
  // cannot take focus, so the reason must be real text, not a `title`.
  it("shows the withdraw action disabled with the U6 reason to a contributor while pending", () => {
    const contributorPending = {
      ...baseWorkflow,
      status: "pending" as const,
      role: "editor" as const,
      canEdit: true,
      canReview: false,
      canRequestReview: false,
      canWithdrawReview: false,
      canDeleteTopic: false,
      isCurrentUserResponsible: false,
      isCurrentUserContributor: true,
      isCurrentUserSubmitter: false,
      pendingSubmissionId: "66666666-6666-4666-8666-666666666666",
      pendingSubmitterId: "44444444-4444-4444-8444-444444444444",
    };
    render(<Panel workflow={contributorPending} onRefresh={vi.fn()} />);

    const withdraw = screen.getByRole("button", { name: /Quay về chỉnh sửa/ });
    expect(withdraw).toHaveProperty("disabled", true);
    // The reason must be wired to the button, not merely present in the DOM.
    const describedBy = withdraw.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent)
      .toBe("Chỉ người tạo hoặc người phụ trách có thể hủy yêu cầu duyệt.");
    // D28: the delete affordance stays hidden for a contributor.
    expect(screen.queryByRole("button", { name: /Xóa bài học/ })).toBeNull();
  });

  it("offers reviewer actions but no withdraw to an owner outside the group while pending", () => {
    const outsideGroup = {
      ...baseWorkflow,
      status: "pending" as const,
      role: "co_owner" as const,
      canEdit: false,
      canReview: true,
      canRequestReview: false,
      canWithdrawReview: false,
      canDeleteTopic: true,
      isCurrentUserResponsible: false,
      pendingSubmissionId: "66666666-6666-4666-8666-666666666666",
      pendingSubmitterId: "44444444-4444-4444-8444-444444444444",
      isCurrentUserSubmitter: false,
    };
    render(<Panel workflow={outsideGroup} onRefresh={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Duyệt" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Từ chối" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Quay về chỉnh sửa/ })).toBeNull();
    // D33/U7: the same RPC, a different label for an actor who cannot withdraw.
    expect(screen.getByRole("button", { name: "Xóa bài học" })).toBeTruthy();
  });

  it("labels the pending delete action for a creator who can also withdraw", () => {
    const creatorPending = {
      ...baseWorkflow,
      status: "pending" as const,
      canWithdrawReview: true,
      canDeleteTopic: true,
      pendingSubmissionId: "66666666-6666-4666-8666-666666666666",
      pendingSubmitterId: "44444444-4444-4444-8444-444444444444",
      isCurrentUserSubmitter: true,
    };
    render(<Panel workflow={creatorPending} onRefresh={vi.fn()} />);

    expect(screen.getByRole("button", { name: /Quay về chỉnh sửa/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Hủy gửi duyệt và xóa bài học/ })).toBeTruthy();
  });

  it("only offers reviewer actions to a reviewer who is not the submitter", () => {
    const reviewerView = {
      ...baseWorkflow,
      status: "pending" as const,
      pendingSubmissionId: "66666666-6666-4666-8666-666666666666",
      pendingSubmitterId: "44444444-4444-4444-8444-444444444444",
    };
    const { rerender } = render(<Panel workflow={reviewerView} onRefresh={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Duyệt" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Từ chối" })).toBeTruthy();

    rerender(
      <Panel
        workflow={{ ...reviewerView, canReview: false }}
        onRefresh={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Duyệt" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Từ chối" })).toBeNull();
  });
});
