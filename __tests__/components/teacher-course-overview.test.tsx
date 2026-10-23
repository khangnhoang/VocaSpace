// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CourseOverview from "@/app/(teacher)/teacher/courses/[id]/_components/CourseOverview";
import type { CourseDashboardReadiness, CourseReadinessIssue } from "@/lib/schemas/course-readiness";
import type { TeacherCourseInsights, TeacherCourseInsightsResult } from "@/lib/schemas/teacher-course-insights";
import type { CourseAttentionResult } from "@/lib/course-authoring/portfolio";
import type { TeacherAttentionItem } from "@/lib/schemas/teacher-course-portfolio";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateCourse: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));
vi.mock("@/app/actions/course", () => ({ updateCourse: mocks.updateCourse }));
vi.mock("@/app/actions/course-review", () => ({ submitCourseReview: vi.fn(), withdrawCourseReview: vi.fn() }));
// Các panel tự gọi action khi mount; trả kết quả rỗng để chúng không ảnh hưởng.
vi.mock("@/app/actions/course-collaborator", () => ({
  getCourseCollaboratorMembers: vi.fn().mockResolvedValue({ error: "unavailable" }),
  getCurrentUserGlobalRole: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/app/actions/course-preview", () => ({
  getCoursePreviewAllocation: vi.fn().mockResolvedValue({ data: null }),
  setCourseTopicPreviewMarkers: vi.fn(),
}));

// Test plan:
// - Mục tiêu: trang Tổng quan mới (docs/teacher-course-overview-plan.md r3) render đúng hành động tiếp theo, số liệu và trạng thái lỗi.
// - Loại test: component interaction trong jsdom qua CourseOverview thật; hai read phụ là promise đã resolve/treo.
// - Case thành công: bảng 1.2.1 theo trạng thái × từ chối × việc chặn × vai trò, luôn đúng một nút filled; dialog sửa thông tin lưu
//   thành công thì đóng, refresh và trả focus; số liệu ghi danh/tiến độ có giá trị chính xác và bảng số liệu.
// - Case thất bại: lưu lỗi giữ dialog và dữ liệu đã nhập; read số liệu lỗi không hiện số 0 và có nút thử lại; read portfolio lỗi vẫn giữ việc readiness.
// - Bảo mật/phân quyền: editor không có nút gửi duyệt nhưng vẫn thấy lý do từ chối; việc lọc theo khóa học nằm ở selectCourseAttention (utils test).
// - Ổn định/invariant: chưa có học viên thì không vẽ biểu đồ hay phần trăm; khóa chưa có bài được tính thì không có phân bố.
// - Kết quả verify gần nhất: xem báo cáo checkpoint CP2.
// - Lệnh: `npx vitest run __tests__/components/teacher-course-overview.test.tsx`.

const courseId = "11111111-1111-4111-8111-111111111111";
const pendingRead = new Promise<never>(() => {});

function issue(index: number): CourseReadinessIssue {
  const topicId = `33333333-3333-4333-8333-33333333333${index}`;
  return {
    id: `issue-${index}`,
    code: "topic_has_no_learning_content",
    category: "content",
    severity: "high",
    isBlocking: true,
    context: `Bài học "Bài ${index}" chưa có flashcard hoặc bài tập hoạt động.`,
    actionLabel: "Mở bài học",
    destination: { type: "topic_builder", courseId, topicId, href: `/teacher/courses/${courseId}/topics/${topicId}` },
    entity: { type: "topic", id: topicId, courseId, chapterId: "44444444-4444-4444-8444-444444444444" },
  } as CourseReadinessIssue;
}

function makeReadiness(overrides: {
  role?: CourseDashboardReadiness["role"];
  status?: CourseDashboardReadiness["course"]["status"];
  issues?: CourseReadinessIssue[];
  rejected?: boolean;
  publishedTopicCount?: number;
} = {}): CourseDashboardReadiness {
  const issues = overrides.issues ?? [];
  return {
    role: overrides.role ?? "owner",
    course: {
      id: courseId,
      title: "Giao tiếp tiếng Anh",
      slug: "giao-tiep-tieng-anh",
      description: "Mô tả khóa học",
      thumbnail_url: null,
      price: 199000,
      status: overrides.status ?? "draft",
      order_index: 1,
      reject_message: overrides.rejected ? "Bổ sung mục tiêu đầu ra của khóa học." : null,
      reviewed_at: overrides.rejected ? "2026-10-14T00:00:00.000Z" : null,
    },
    counts: { chapters: 2, topics: 5, flashcards: 40, exercises: 6, questionGroups: 2, questions: 30, answerOptions: 90 },
    publishedTopicCount: overrides.publishedTopicCount ?? 3,
    issues,
    primaryCta: issues.length
      ? { id: `primary:${issues[0].id}`, label: issues[0].actionLabel, destination: issues[0].destination, sourceIssueId: issues[0].id, sourceIssueCode: issues[0].code }
      : { id: "primary:structure", label: "Quản lý cấu trúc", destination: { type: "course_structure", courseId, href: `/teacher/courses/${courseId}/structure` }, sourceIssueId: null, sourceIssueCode: null },
  } as CourseDashboardReadiness;
}

const insightsData: TeacherCourseInsights = {
  enrollment_total: 24,
  enrollments_by_month: [
    { month: "2026-05", count: 2 },
    { month: "2026-06", count: 3 },
    { month: "2026-07", count: 4 },
    { month: "2026-08", count: 5 },
    { month: "2026-09", count: 6 },
    { month: "2026-10", count: 4 },
  ],
  counted_topic_total: 3,
  progress: { not_started: 10, in_progress: 10, completed: 4 },
};

function attentionItem(kind: TeacherAttentionItem["kind"], course = courseId, title = "Gọi món"): TeacherAttentionItem {
  return {
    kind,
    course_id: course,
    course_title: "Khóa học",
    topic_id: kind === "course_rejection" ? null : "55555555-5555-4555-8555-555555555555",
    topic_title: kind === "course_rejection" ? null : title,
    reason: kind === "topic_review" ? null : "Cần thêm ví dụ.",
    ordering_at: "2026-10-20T00:00:00.000Z",
  };
}

function renderOverview(
  readiness: CourseDashboardReadiness,
  reads: { insights?: Promise<TeacherCourseInsightsResult>; attention?: Promise<CourseAttentionResult> } = {},
) {
  return render(<CourseOverview readiness={readiness} insights={reads.insights ?? pendingRead} attention={reads.attention ?? pendingRead} />);
}

function nextActionRegion() {
  return screen.getByRole("region", { name: (_name, element) => element.getAttribute("aria-labelledby") === "next-action-title" });
}

function filledActions(region: HTMLElement) {
  return [...region.querySelectorAll('[data-variant="default"]')].map((element) => element.textContent?.trim());
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("course overview next action (plan section 1.2.1)", () => {
  it("makes the first readiness issue the only filled action and demotes submit for an owner", () => {
    renderOverview(makeReadiness({ issues: [issue(1), issue(2)] }));
    const region = nextActionRegion();
    expect(within(region).getByText(/còn 2 việc cần xử lý/)).toBeTruthy();
    expect(filledActions(region)).toEqual(["Mở bài học"]);
    expect(within(region).getByRole("heading", { level: 2, name: issue(1).context })).toBeTruthy();
    expect(within(region).getByRole("link", { name: "Mở bài học" }).getAttribute("href")).toBe(issue(1).destination.href);
    expect(within(region).getByRole("button", { name: /Gửi duyệt/ }).getAttribute("data-variant")).toBe("outline");
    expect(within(region).queryByText(/không thể gửi duyệt|chặn niêm yết/i)).toBeNull();
  });

  it("gives an editor the issue action without any listing control", () => {
    renderOverview(makeReadiness({ role: "editor", issues: [issue(1)] }));
    const region = nextActionRegion();
    expect(filledActions(region)).toEqual(["Mở bài học"]);
    expect(within(region).queryByRole("button", { name: /Gửi duyệt|Rút yêu cầu/ })).toBeNull();
  });

  it.each(["owner", "co_owner"] as const)("lets a %s submit a clean draft with a published topic as the primary action", (role) => {
    renderOverview(makeReadiness({ role }));
    const region = nextActionRegion();
    expect(within(region).getByText("Sẵn sàng gửi duyệt niêm yết")).toBeTruthy();
    expect(filledActions(region)).toEqual(["Gửi duyệt"]);
  });

  it("falls back to Structure and a disabled outline submit when no topic is published", () => {
    renderOverview(makeReadiness({ publishedTopicCount: 0 }));
    const region = nextActionRegion();
    expect(filledActions(region)).toEqual(["Mở cấu trúc"]);
    const submit = within(region).getByRole("button", { name: /Gửi duyệt/ });
    expect(submit.getAttribute("data-variant")).toBe("outline");
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(within(region).getByText("Cần ít nhất 1 bài học đã xuất bản để gửi duyệt.")).toBeTruthy();
  });

  it("tells an editor on a clean draft that an owner submits for listing", () => {
    renderOverview(makeReadiness({ role: "editor" }));
    const region = nextActionRegion();
    expect(filledActions(region)).toEqual(["Mở cấu trúc"]);
    expect(within(region).getByText(/Chủ sở hữu hoặc đồng sở hữu gửi duyệt niêm yết/)).toBeTruthy();
  });

  it.each(["owner", "editor"] as const)("shows a %s the rejection reason and the edit action on a rejected draft without issues", (role) => {
    renderOverview(makeReadiness({ role, rejected: true }));
    const region = nextActionRegion();
    expect(within(region).getByText("Yêu cầu duyệt bị từ chối")).toBeTruthy();
    expect(within(region).getByText("Bổ sung mục tiêu đầu ra của khóa học.")).toBeTruthy();
    expect(filledActions(region)).toEqual(["Sửa thông tin khóa học"]);
    expect(screen.getAllByText("Bị từ chối niêm yết").length).toBeGreaterThan(0);
  });

  it("keeps the issue primary and demotes edit and submit on a rejected draft with issues", () => {
    renderOverview(makeReadiness({ rejected: true, issues: [issue(1)] }));
    const region = nextActionRegion();
    expect(filledActions(region)).toEqual(["Mở bài học"]);
    expect(within(region).getByRole("button", { name: "Sửa thông tin khóa học" }).getAttribute("data-variant")).toBe("outline");
    expect(within(region).getByRole("button", { name: /Gửi duyệt/ }).getAttribute("data-variant")).toBe("outline");
  });

  it("offers withdraw beside Structure on a pending course", () => {
    renderOverview(makeReadiness({ status: "pending" }));
    const region = nextActionRegion();
    expect(within(region).getByText("Quản trị viên đang xem xét khóa học")).toBeTruthy();
    expect(filledActions(region)).toEqual(["Mở cấu trúc"]);
    expect(within(region).getByRole("button", { name: /Rút yêu cầu duyệt/ })).toBeTruthy();
  });

  it("shows no listing control on a published course", () => {
    renderOverview(makeReadiness({ status: "published" }));
    const region = nextActionRegion();
    expect(filledActions(region)).toEqual(["Mở cấu trúc"]);
    expect(within(region).queryByRole("button", { name: /Gửi duyệt|Rút yêu cầu/ })).toBeNull();
  });
});

describe("course overview identity and summary", () => {
  it("shows course facts without technical keys and a compact content summary", () => {
    renderOverview(makeReadiness());
    expect(screen.getByRole("heading", { level: 1, name: "Giao tiếp tiếng Anh" })).toBeTruthy();
    expect(screen.getByText("3 / 5 bài")).toBeTruthy();
    expect(screen.queryByText("giao-tiep-tieng-anh")).toBeNull();
    expect(screen.getByText("5 · 3 đã xuất bản")).toBeTruthy();
    expect(screen.getByText("6 · 30")).toBeTruthy();
  });
});

describe("course overview rejected-course edit dialog", () => {
  async function openDialog() {
    renderOverview(makeReadiness({ rejected: true }));
    fireEvent.click(screen.getByRole("button", { name: "Sửa thông tin khóa học" }));
    return screen.findByRole("dialog");
  }

  it("keeps the dialog and the typed input when saving fails", async () => {
    mocks.updateCourse.mockResolvedValueOnce({ error: "Slug đã tồn tại." });
    const dialog = await openDialog();
    const title = within(dialog).getByLabelText("Tên khóa học") as HTMLInputElement;
    fireEvent.change(title, { target: { value: "Tên mới cho khóa học" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith("Slug đã tồn tại."));
    // Toast bị ẩn khỏi trình đọc màn hình khi dialog modal mở, nên lỗi phải có ngay trong dialog.
    expect(within(screen.getByRole("dialog")).getByRole("alert").textContent).toBe("Slug đã tồn tại.");
    expect((screen.getByLabelText("Tên khóa học") as HTMLInputElement).value).toBe("Tên mới cho khóa học");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("closes, refreshes and returns focus to the trigger after a successful save, sending one request", async () => {
    let resolveSave!: (value: unknown) => void;
    mocks.updateCourse.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
    const dialog = await openDialog();
    const save = within(dialog).getByRole("button", { name: "Lưu thay đổi" });
    fireEvent.click(save);
    await waitFor(() => expect(mocks.updateCourse).toHaveBeenCalledTimes(1));
    fireEvent.click(within(dialog).getByRole("button", { name: /Đang lưu/ }));
    expect(mocks.updateCourse).toHaveBeenCalledTimes(1);
    const [, payload] = mocks.updateCourse.mock.calls[0] as [string, FormData];
    expect(payload.get("title")).toBe("Giao tiếp tiếng Anh");
    expect(payload.get("price")).toBe("199000");

    await act(async () => resolveSave({ message: "Đã lưu khóa học." }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Đã lưu khóa học.");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(document.activeElement?.textContent).toContain("Sửa thông tin khóa học"));
  });
});

describe("course overview other work list (AC5, AC6)", () => {
  it("lists remaining issues while review and correction items load", () => {
    renderOverview(makeReadiness({ issues: [issue(1), issue(2)] }));
    expect(screen.getByText(issue(2).context)).toBeTruthy();
    expect(screen.getByText("Đang tải bài chờ duyệt và bài cần sửa…")).toBeTruthy();
  });

  it("renders the course's review and correction items with their own actions", async () => {
    const attention = Promise.resolve({
      success: true as const,
      items: [attentionItem("topic_correction", courseId, "Hỏi đường"), attentionItem("topic_review", courseId, "Gọi món")],
    });
    renderOverview(makeReadiness({ issues: [issue(1), issue(2)] }), { attention });

    expect(await screen.findByText("Gọi món")).toBeTruthy();
    expect(screen.getByText("Việc khác trong khóa học · 3")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Duyệt bài học: Gọi món" }).getAttribute("href")).toBe(`/teacher/courses/${courseId}/topics/55555555-5555-4555-8555-555555555555`);
    expect(screen.getByRole("link", { name: "Xem và chỉnh sửa: Hỏi đường" })).toBeTruthy();
  });

  it("keeps readiness work and offers retry when the portfolio read fails", async () => {
    renderOverview(makeReadiness({ issues: [issue(1), issue(2)] }), { attention: Promise.resolve({ success: false as const }) });

    expect(await screen.findByText("Chưa tải được bài chờ duyệt và bài cần sửa.")).toBeTruthy();
    expect(screen.getByText(issue(2).context)).toBeTruthy();
    expect(filledActions(nextActionRegion())).toEqual(["Mở bài học"]);
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("course overview insights (AC7–AC10)", () => {
  it("shows exact enrollment values, the month comparison and a table on demand", async () => {
    renderOverview(makeReadiness(), { insights: Promise.resolve({ success: true as const, data: insightsData }) });

    expect(await screen.findByText("học viên đã ghi danh")).toBeTruthy();
    expect(screen.getByText("24")).toBeTruthy();
    expect(screen.getByText(/Tháng 10\/2026 \(tính đến hôm nay\)/)).toBeTruthy();
    expect(screen.getByText(/−2 so với tháng 9\/2026/)).toBeTruthy();
    expect(screen.getByRole("img", { name: /Tháng 5\/2026 2, Tháng 6\/2026 3, Tháng 7\/2026 4, Tháng 8\/2026 5, Tháng 9\/2026 6, Tháng 10\/2026 4/ })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Xem bảng số liệu/ }));
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(7);
  });

  it("shows the progress split with percentages summing to 100", async () => {
    renderOverview(makeReadiness(), { insights: Promise.resolve({ success: true as const, data: insightsData }) });

    expect(await screen.findByText("Chưa bắt đầu · 10 học viên")).toBeTruthy();
    expect(screen.getByText("Đang học · 10 học viên")).toBeTruthy();
    expect(screen.getByText("Hoàn thành · 4 học viên")).toBeTruthy();
    expect(screen.getAllByText("42%")).toHaveLength(2);
    expect(screen.getByText("16%")).toBeTruthy();
  });

  it("draws no chart or percentage when nobody has enrolled", async () => {
    const empty: TeacherCourseInsights = { ...insightsData, enrollment_total: 0, enrollments_by_month: insightsData.enrollments_by_month.map((month) => ({ ...month, count: 0 })), progress: { not_started: 0, in_progress: 0, completed: 0 } };
    renderOverview(makeReadiness(), { insights: Promise.resolve({ success: true as const, data: empty }) });

    expect(await screen.findByText("Chưa có học viên ghi danh")).toBeTruthy();
    expect(screen.queryByRole("img", { name: /Ghi danh mới/ })).toBeNull();
    expect(screen.queryByText(/%$/)).toBeNull();
  });

  it("explains a course without counted topics instead of a distribution", async () => {
    const noTopics: TeacherCourseInsights = { ...insightsData, counted_topic_total: 0, progress: null };
    renderOverview(makeReadiness(), { insights: Promise.resolve({ success: true as const, data: noTopics }) });

    expect(await screen.findByText("Chưa có bài học đã xuất bản.")).toBeTruthy();
    expect(screen.queryByText(/học viên$/, { selector: "li p" })).toBeNull();
  });

  it("never shows zero after a failed read and keeps the next action usable", async () => {
    renderOverview(makeReadiness({ issues: [issue(1)] }), {
      insights: Promise.resolve({ success: false as const, errorCode: "UNAVAILABLE" as const, error: "Không thể tải số liệu khóa học lúc này." }),
    });

    expect(await screen.findByText("Chưa tải được số liệu học viên")).toBeTruthy();
    expect(screen.queryByText("học viên đã ghi danh")).toBeNull();
    expect(filledActions(nextActionRegion())).toEqual(["Mở bài học"]);
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("labels the loading insights without blocking the rest of the page", () => {
    renderOverview(makeReadiness());
    expect(screen.getByLabelText("Đang tải số liệu ghi danh")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(filledActions(nextActionRegion())).toEqual(["Gửi duyệt"]);
  });
});
