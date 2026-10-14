// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminCoursesClient from "@/app/admin/courses/_components/admin-courses-client";
import type {
  AdminCourseFilter,
  AdminCourseListData,
  AdminCourseListRow,
  AdminCourseSummary,
} from "@/lib/schemas/admin-course";

const mocks = vi.hoisted(() => ({
  approveCourseReview: vi.fn(),
  rejectCourseReview: vi.fn(),
  moderateCourse: vi.fn(),
  getAdminCourseSummary: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/actions/admin-course-review", () => ({
  approveCourseReview: mocks.approveCourseReview,
  rejectCourseReview: mocks.rejectCourseReview,
}));
vi.mock("@/app/actions/admin-course-moderation", () => ({
  moderateCourse: mocks.moderateCourse,
  getAdminCourseSummary: mocks.getAdminCourseSummary,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: mocks.push, replace: mocks.replace }),
}));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

// Test plan:
// - Mục tiêu: kiểm tra màn hình /admin/courses (AD3 AC2-AC7, AC9) qua client root `AdminCoursesClient` với Server Action giả.
// - Loại test: component interaction trong jsdom (RTL); dữ liệu danh sách dựng sẵn như server trả về, quyền thật nằm ở RPC/integration test.
// - Đối tượng: AdminCoursesClient và các con (toolbar, bảng, phân trang, panel tóm tắt, dialog hành động).
// - Case thành công:
//   - hàng hiện tên, slug, chủ sở hữu, giá, trạng thái, mốc thời gian; "—" khi thiếu; lý do từ chối chỉ trên bản nháp; tab Đã gỡ không có nút.
//   - tab là liên kết giữ `q`, có số đếm và aria-current; phân trang theo liên kết.
//   - tìm kiếm trực tiếp: gõ cập nhật `q` bằng router.replace sau 300 ms (một lần, đúng cụm cuối, về trang 1, giữ tab); Enter áp ngay; ô trống bỏ `q`; cùng cụm thì không điều hướng; ô nhập giữ giá trị và focus khi URL về muộn, đồng bộ theo URL khi đổi từ bên ngoài; timer bị hủy khi đổi tab hoặc unmount.
//   - panel tóm tắt tải dàn bài qua getAdminCourseSummary, hiện chương, bài học, trạng thái từng bài và số bài đã xuất bản.
//   - duyệt, từ chối, hạ, gỡ gọi đúng action với đúng tham số, toast thành công, đóng dialog, làm mới danh sách.
// - Case thất bại: empty từng tab, empty khi tìm kiếm có nút xóa, trang vượt quá trang cuối, lỗi tải danh sách có thử lại, lỗi tải panel có thử lại,
//   lý do thiếu/ngắn báo lỗi ngay dưới ô nhập và không gọi action, server từ chối giữ nguyên dialog và lý do, làm mới danh sách.
// - Bảo mật/phân quyền: nút chỉ theo trạng thái (pending: duyệt/từ chối; published: hạ/gỡ; draft/đã gỡ: không có); kết quả cuối luôn do server quyết định.
// - Ổn định/resilience: nút xác nhận hiện nhãn đang xử lý và chỉ gửi một lần dù bấm hai lần; không thể đóng dialog khi đang gửi.
// - Invariant cần giữ: không giá trị nào trên màn hình là dữ liệu giả; hành động hủy bỏ không thể hoàn tác (gỡ) luôn nêu hậu quả trước khi xác nhận.
// - Kết quả verify gần nhất: xem milestone AD3 CP3 trong progress.md (`npx vitest run __tests__/components/admin-courses-screen.test.tsx`).
// - Focus (AC9): hủy dialog trả focus về nút đã mở (cả khi mở từ panel), đóng panel trả về nút tóm tắt, nút đã mất thì về tiêu đề danh sách, sau thành công về tiêu đề danh sách.
// - Ghi chú: bố cục 375/1280 px, tương phản và thứ tự focus trên màn hình thật nằm ở QA thủ công của Owner (plan §4.1).

function makeRow(overrides: Partial<AdminCourseListRow> = {}): AdminCourseListRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Khóa học TOEIC cơ bản",
    slug: "toeic-co-ban",
    status: "pending",
    price: 0,
    ownerName: "Cô Lan",
    submittedAt: "2026-10-01T03:30:00.000Z",
    reviewedAt: null,
    rejectMessage: null,
    removedAt: null,
    ...overrides,
  };
}

function makeData(rows: AdminCourseListRow[], overrides: Partial<AdminCourseListData> = {}): AdminCourseListData {
  return {
    rows,
    counts: { pending: rows.length, published: 4, draft: 2, all: rows.length + 6, removed: 1 },
    total: rows.length,
    page: 1,
    pageSize: 20,
    totalPages: 1,
    ...overrides,
  };
}

const searchbox = () => screen.getByRole("searchbox", { name: "Tìm khóa học theo tên hoặc slug" });

const defaultFilter: AdminCourseFilter = { status: "pending", q: "", page: 1 };

function renderScreen(
  data: AdminCourseListData | null,
  options: { filter?: Partial<AdminCourseFilter>; error?: string | null } = {},
) {
  return render(
    <AdminCoursesClient
      filter={{ ...defaultFilter, ...options.filter }}
      data={data}
      error={options.error ?? null}
    />,
  );
}

const outline: AdminCourseSummary = {
  course: {
    ...makeRow(),
    description: "Mô tả khóa học TOEIC",
    thumbnailUrl: null,
  },
  chapters: [
    {
      id: "c1",
      title: "Nghe hiểu",
      topics: [
        { id: "t1", title: "Bài 1", status: "published" },
        { id: "t2", title: "Bài 2", status: "draft" },
      ],
    },
    { id: "c2", title: "Đọc hiểu", topics: [] },
  ],
  publishedTopicCount: 1,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAdminCourseSummary.mockResolvedValue({ success: true, data: outline });
});

afterEach(cleanup);

describe("course list rows", () => {
  it("shows real fields for each course and a dash when the database holds no value", () => {
    renderScreen(
      makeData([
        makeRow({ ownerName: null, price: 250000 }),
        makeRow({ id: "22222222-2222-4222-8222-222222222222", title: "Khóa miễn phí", slug: "mien-phi" }),
      ]),
    );

    const table = screen.getByRole("table", { name: "Danh sách khóa học" });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("toeic-co-ban")).toBeTruthy();
    expect(within(rows[0]).getByText(/250\.000/)).toBeTruthy();
    // Không có chủ sở hữu thì hiện "—", không bịa tên.
    expect(within(rows[0]).getByText("—", { selector: "td" })).toBeTruthy();
    expect(within(rows[1]).getByText("Cô Lan")).toBeTruthy();
    expect(within(rows[1]).getByText("Miễn phí")).toBeTruthy();
    // 03:30 UTC = 10:30 giờ Việt Nam, cố định theo múi giờ Việt Nam bất kể máy chạy test.
    expect(within(rows[1]).getByText(/10:30/)).toBeTruthy();
  });

  it("shows the rejection reason on a rejected draft and nothing extra on a pending row", () => {
    renderScreen(
      makeData([
        makeRow({
          status: "draft",
          title: "Khóa bị từ chối",
          rejectMessage: "Ảnh bìa mờ, cần bổ sung.",
          reviewedAt: "2026-10-02T00:00:00.000Z",
        }),
        makeRow({ id: "22222222-2222-4222-8222-222222222222", title: "Khóa chờ duyệt" }),
      ]),
      { filter: { status: "draft" } },
    );

    expect(screen.getAllByText(/Lý do từ chối:/)).toHaveLength(1);
    expect(screen.getByText("Ảnh bìa mờ, cần bổ sung.")).toBeTruthy();
  });

  it("labels status in words and offers only the actions that fit each status", () => {
    renderScreen(
      makeData([
        makeRow({ title: "Khóa A", status: "pending" }),
        makeRow({ id: "22222222-2222-4222-8222-222222222222", title: "Khóa B", status: "published" }),
        makeRow({ id: "33333333-3333-4333-8333-333333333333", title: "Khóa C", status: "draft" }),
        makeRow({
          id: "44444444-4444-4444-8444-444444444444",
          title: "Khóa D",
          status: "published",
          removedAt: "2026-10-03T00:00:00.000Z",
        }),
      ]),
      { filter: { status: "all" } },
    );

    const rows = screen.getAllByRole("row").slice(1);
    const labels = (row: HTMLElement) =>
      within(row)
        .queryAllByRole("button")
        .map((button) => button.getAttribute("aria-label"))
        // Nút tên khóa học (mở tóm tắt) không có aria-label; chỉ giữ nút hành động.
        .filter((label): label is string => label !== null);

    expect(within(rows[0]).getByText("Chờ duyệt")).toBeTruthy();
    expect(labels(rows[0])).toEqual(["Duyệt khóa học Khóa A", "Từ chối khóa học Khóa A"]);
    expect(within(rows[1]).getByText("Đã xuất bản")).toBeTruthy();
    expect(labels(rows[1])).toEqual(["Hạ về bản nháp: Khóa B", "Gỡ khóa học Khóa B"]);
    expect(within(rows[2]).getByText("Bản nháp")).toBeTruthy();
    expect(labels(rows[2])).toEqual([]);
    // Course có removed_at luôn là "Đã gỡ" và read-only, dù cột status còn là published.
    expect(within(rows[3]).getByText("Đã gỡ", { selector: "span" })).toBeTruthy();
    expect(within(rows[3]).queryByRole("button", { name: /Duyệt|Từ chối|Hạ|Gỡ khóa học/ })).toBeNull();
  });
});

describe("tabs, search and paging", () => {
  it("renders tabs as links with per-tab counts, keeps the search term and marks the current tab", () => {
    renderScreen(makeData([makeRow()]), { filter: { status: "published", q: "toeic" } });

    const nav = screen.getByRole("navigation", { name: "Lọc khóa học theo trạng thái" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/admin/courses?q=toeic",
      "/admin/courses?status=published&q=toeic",
      "/admin/courses?status=draft&q=toeic",
      "/admin/courses?status=all&q=toeic",
      "/admin/courses?status=removed&q=toeic",
    ]);
    expect(links.map((link) => link.textContent)).toEqual([
      "Chờ duyệt1",
      "Đã xuất bản4",
      "Bản nháp2",
      "Tất cả7",
      "Đã gỡ1",
    ]);
    expect(links.filter((link) => link.getAttribute("aria-current") === "page").map((link) => link.textContent)).toEqual([
      "Đã xuất bản4",
    ]);
  });

  it("applies a trimmed search on Enter to page 1 of the current tab at once, with replace and no history entry", () => {
    renderScreen(makeData([makeRow()], { page: 3, totalPages: 3 }), { filter: { status: "draft", page: 3 } });

    fireEvent.change(searchbox(), { target: { value: "  100% off  " } });
    fireEvent.click(screen.getByRole("button", { name: "Tìm kiếm" }));

    expect(mocks.replace).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledWith("/admin/courses?status=draft&q=100%25+off");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("offers a clear-search link only while a search is active", () => {
    const { unmount } = renderScreen(makeData([makeRow()]));
    expect(screen.queryByRole("link", { name: "Xóa tìm kiếm" })).toBeNull();
    unmount();

    renderScreen(makeData([makeRow()]), { filter: { status: "all", q: "toeic" } });
    expect(screen.getByRole("link", { name: "Xóa tìm kiếm" }).getAttribute("href")).toBe("/admin/courses?status=all");
  });

  it("pages with real links and reports the visible range", () => {
    const rows = Array.from({ length: 20 }, (_, index) =>
      makeRow({ id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, title: `Khóa ${index}` }),
    );
    renderScreen(makeData(rows, { page: 2, totalPages: 3, total: 55 }), {
      filter: { status: "pending", q: "toeic", page: 2 },
    });

    const pager = screen.getByRole("navigation", { name: "Phân trang" });
    expect(pager.textContent).toContain("Hiển thị 21–40 trong tổng số 55 khóa học");
    expect(pager.textContent).toContain("Trang 2 / 3");
    expect(within(pager).getByRole("link", { name: /Trước/ }).getAttribute("href")).toBe("/admin/courses?q=toeic");
    expect(within(pager).getByRole("link", { name: /Sau/ }).getAttribute("href")).toBe("/admin/courses?q=toeic&page=3");
  });
});

describe("empty and error states", () => {
  it.each([
    ["pending", "Không có khóa học nào đang chờ duyệt."],
    ["published", "Chưa có khóa học nào được xuất bản."],
    ["draft", "Không có khóa học nào ở bản nháp."],
    ["all", "Chưa có khóa học nào."],
    ["removed", "Chưa có khóa học nào bị gỡ."],
  ] as const)("shows the %s tab empty message", (status, message) => {
    renderScreen(makeData([], { total: 0 }), { filter: { status } });

    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("explains an empty search and clears it with a link", () => {
    renderScreen(makeData([], { total: 0 }), { filter: { status: "published", q: "xyz" } });

    expect(screen.getByText("Không tìm thấy khóa học phù hợp.")).toBeTruthy();
    const clear = screen.getAllByRole("link", { name: "Xóa tìm kiếm" });
    expect(clear.length).toBeGreaterThan(0);
    for (const link of clear) expect(link.getAttribute("href")).toBe("/admin/courses?status=published");
  });

  it("sends the admin back to page 1 when the page is beyond the last", () => {
    renderScreen(makeData([], { total: 25, page: 9, totalPages: 2 }), { filter: { status: "all", page: 9 } });

    expect(screen.getByText("Trang này không có khóa học nào.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Về trang 1" }).getAttribute("href")).toBe("/admin/courses?status=all");
  });

  it("shows a list load error with a retry that refreshes the page and hides tab counts", () => {
    renderScreen(null, { error: "Không thể tải danh sách khóa học. Vui lòng thử lại." });

    expect(screen.getByRole("alert").textContent).toContain("Không thể tải danh sách khóa học.");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("table")).toBeNull();
    const tabs = within(screen.getByRole("navigation", { name: "Lọc khóa học theo trạng thái" }));
    expect(tabs.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Chờ duyệt",
      "Đã xuất bản",
      "Bản nháp",
      "Tất cả",
      "Đã gỡ",
    ]);
  });
});

describe("summary panel", () => {
  it("loads and shows the metadata, the chapter and topic outline with a status per topic", async () => {
    renderScreen(makeData([makeRow()]));

    fireEvent.click(screen.getByRole("button", { name: "Khóa học TOEIC cơ bản, xem tóm tắt" }));

    const panel = await screen.findByRole("dialog", { name: "Khóa học TOEIC cơ bản" });
    expect(mocks.getAdminCourseSummary).toHaveBeenCalledWith({ courseId: makeRow().id });
    expect(await within(panel).findByText("Chương 1: Nghe hiểu")).toBeTruthy();
    expect(within(panel).getByText("Chương 2: Đọc hiểu")).toBeTruthy();
    expect(within(panel).getByText("Mô tả khóa học TOEIC")).toBeTruthy();
    expect(within(panel).getByText("Bài 1")).toBeTruthy();
    expect(within(panel).getByText("Đã xuất bản", { selector: "li span" })).toBeTruthy();
    expect(within(panel).getByText("Bản nháp", { selector: "li span" })).toBeTruthy();
    expect(panel.textContent).toContain("1 / 2 bài học đã xuất bản");
    // Không có ảnh bìa thì hiện chỗ giữ chỗ trung tính, không ảnh giả.
    expect(within(panel).getByText("Chưa có ảnh bìa")).toBeTruthy();
    expect(within(panel).queryByRole("img")).toBeNull();
  });

  it("shows a load error with a retry instead of an empty outline", async () => {
    mocks.getAdminCourseSummary
      .mockResolvedValueOnce({ error: "Không thể tải tóm tắt khóa học. Vui lòng thử lại." })
      .mockResolvedValueOnce({ success: true, data: outline });
    renderScreen(makeData([makeRow()]));

    fireEvent.click(screen.getByRole("button", { name: "Khóa học TOEIC cơ bản, xem tóm tắt" }));
    const panel = await screen.findByRole("dialog");
    const alert = await within(panel).findByRole("alert");
    expect(alert.textContent).toContain("Không thể tải tóm tắt khóa học.");
    expect(within(panel).queryByText("Chương 1: Nghe hiểu")).toBeNull();

    fireEvent.click(within(panel).getByRole("button", { name: "Thử lại" }));
    expect(await within(panel).findByText("Chương 1: Nghe hiểu")).toBeTruthy();
    expect(mocks.getAdminCourseSummary).toHaveBeenCalledTimes(2);
  });

  it("treats a rejected request as a load error", async () => {
    mocks.getAdminCourseSummary.mockRejectedValueOnce(new Error("network"));
    renderScreen(makeData([makeRow()]));

    fireEvent.click(screen.getByRole("button", { name: "Khóa học TOEIC cơ bản, xem tóm tắt" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Không thể tải tóm tắt khóa học.");
  });

  it("offers the row's actions inside the panel and opens the same dialog", async () => {
    renderScreen(makeData([makeRow()]));

    fireEvent.click(screen.getByRole("button", { name: "Khóa học TOEIC cơ bản, xem tóm tắt" }));
    const panel = await screen.findByRole("dialog", { name: "Khóa học TOEIC cơ bản" });
    fireEvent.click(within(panel).getByRole("button", { name: "Duyệt khóa học Khóa học TOEIC cơ bản" }));

    expect(await screen.findByRole("dialog", { name: "Duyệt khóa học này?" })).toBeTruthy();
  });
});

describe("approve", () => {
  it("names the course and the consequence, then approves, toasts and refreshes", async () => {
    mocks.approveCourseReview.mockResolvedValue({ success: true, data: {} });
    renderScreen(makeData([makeRow()]));

    fireEvent.click(screen.getByRole("button", { name: "Duyệt khóa học Khóa học TOEIC cơ bản" }));
    const dialog = await screen.findByRole("dialog", { name: "Duyệt khóa học này?" });
    expect(dialog.textContent).toContain("Khóa học TOEIC cơ bản");
    expect(dialog.textContent).toContain("hiển thị công khai trong danh mục khóa học");

    fireEvent.click(within(dialog).getByRole("button", { name: "Duyệt khóa học" }));

    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("Đã duyệt khóa học."));
    expect(mocks.approveCourseReview).toHaveBeenCalledWith({ courseId: makeRow().id });
    expect(mocks.refresh).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps the dialog with the server message and refreshes the list when the course is no longer pending", async () => {
    mocks.approveCourseReview.mockResolvedValue({
      error: "Khóa học không còn ở trạng thái chờ duyệt. Vui lòng tải lại trang.",
    });
    renderScreen(makeData([makeRow()]));

    fireEvent.click(screen.getByRole("button", { name: "Duyệt khóa học Khóa học TOEIC cơ bản" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Duyệt khóa học" }));

    expect((await within(dialog).findByRole("alert")).textContent).toContain("không còn ở trạng thái chờ duyệt");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("closes without calling the action when cancelled", async () => {
    renderScreen(makeData([makeRow()]));

    fireEvent.click(screen.getByRole("button", { name: "Duyệt khóa học Khóa học TOEIC cơ bản" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy bỏ" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mocks.approveCourseReview).not.toHaveBeenCalled();
  });
});

describe("reject", () => {
  async function openReject() {
    renderScreen(makeData([makeRow()]));
    fireEvent.click(screen.getByRole("button", { name: "Từ chối khóa học Khóa học TOEIC cơ bản" }));
    const dialog = await screen.findByRole("dialog", { name: "Từ chối khóa học" });
    return { dialog, reason: within(dialog).getByLabelText("Lý do từ chối") as HTMLTextAreaElement };
  }

  it("requires a reason of at least 10 characters, with a live count and the error under the field", async () => {
    const { dialog, reason } = await openReject();
    expect(dialog.textContent).toContain("Giáo viên sẽ thấy lý do này");
    expect(dialog.textContent).toContain("0/1000");

    fireEvent.change(reason, { target: { value: "  ngắn  " } });
    expect(dialog.textContent).toContain("4/1000");
    fireEvent.click(within(dialog).getByRole("button", { name: "Từ chối khóa học" }));

    expect(within(dialog).getByText("Lý do từ chối phải có ít nhất 10 ký tự.")).toBeTruthy();
    expect(reason.getAttribute("aria-invalid")).toBe("true");
    expect(reason.getAttribute("aria-describedby")).toContain("error");
    expect(mocks.rejectCourseReview).not.toHaveBeenCalled();
  });

  it("rejects the over-long reason before calling the action", async () => {
    const { dialog, reason } = await openReject();

    fireEvent.change(reason, { target: { value: "a".repeat(1001) } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Từ chối khóa học" }));

    expect(within(dialog).getByText("Lý do từ chối không được vượt quá 1000 ký tự.")).toBeTruthy();
    expect(mocks.rejectCourseReview).not.toHaveBeenCalled();
  });

  it("sends the reason, toasts, closes and refreshes on success", async () => {
    mocks.rejectCourseReview.mockResolvedValue({ success: true, data: {} });
    const { dialog, reason } = await openReject();

    fireEvent.change(reason, { target: { value: "Ảnh bìa mờ, cần bổ sung ảnh rõ nét." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Từ chối khóa học" }));

    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("Đã từ chối khóa học."));
    expect(mocks.rejectCourseReview).toHaveBeenCalledWith({
      courseId: makeRow().id,
      rejectMessage: "Ảnh bìa mờ, cần bổ sung ảnh rõ nét.",
    });
    expect(mocks.refresh).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps the typed reason when the server refuses", async () => {
    mocks.rejectCourseReview.mockResolvedValue({ error: "Không thể xử lý duyệt khóa học. Vui lòng thử lại." });
    const { dialog, reason } = await openReject();

    fireEvent.change(reason, { target: { value: "Ảnh bìa mờ, cần bổ sung ảnh rõ nét." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Từ chối khóa học" }));

    expect((await within(dialog).findByRole("alert")).textContent).toContain("Không thể xử lý duyệt khóa học");
    expect(reason.value).toBe("Ảnh bìa mờ, cần bổ sung ảnh rõ nét.");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});

describe("demote and takedown", () => {
  const publishedRow = makeRow({ status: "published", title: "Khóa đang bán" });

  async function openDialog(buttonName: string, dialogName: string) {
    renderScreen(makeData([publishedRow]), { filter: { status: "published" } });
    fireEvent.click(screen.getByRole("button", { name: buttonName }));
    return screen.findByRole("dialog", { name: dialogName });
  }

  it("demotes with a trimmed reason through moderateCourse", async () => {
    mocks.moderateCourse.mockResolvedValue({ success: true, data: {} });
    const dialog = await openDialog("Hạ về bản nháp: Khóa đang bán", "Hạ khóa học về bản nháp");
    expect(dialog.textContent).toContain("rời khỏi danh mục công khai");

    fireEvent.change(within(dialog).getByLabelText("Lý do hạ khóa học"), {
      target: { value: "  Nội dung bài 1 chưa đạt yêu cầu.  " },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hạ về bản nháp" }));

    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("Đã hạ khóa học về bản nháp."));
    expect(mocks.moderateCourse).toHaveBeenCalledWith({
      courseId: publishedRow.id,
      action: "demote",
      reason: "  Nội dung bài 1 chưa đạt yêu cầu.  ",
    });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("states that a takedown cannot be undone here, then takes the course down", async () => {
    mocks.moderateCourse.mockResolvedValue({ success: true, data: {} });
    const dialog = await openDialog("Gỡ khóa học Khóa đang bán", "Gỡ khóa học");
    expect(dialog.textContent).toContain("không có chức năng khôi phục");
    expect(dialog.textContent).toContain("tab Đã gỡ");

    fireEvent.change(within(dialog).getByLabelText("Lý do gỡ khóa học"), {
      target: { value: "Vi phạm bản quyền nội dung." },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Gỡ khóa học" }));

    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("Đã gỡ khóa học."));
    expect(mocks.moderateCourse).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: publishedRow.id, action: "takedown" }),
    );
  });

  it("requires a reason of at least 10 characters before calling the action", async () => {
    const dialog = await openDialog("Gỡ khóa học Khóa đang bán", "Gỡ khóa học");

    fireEvent.click(within(dialog).getByRole("button", { name: "Gỡ khóa học" }));

    expect(within(dialog).getByText(/ít nhất 10 ký tự/)).toBeTruthy();
    expect(mocks.moderateCourse).not.toHaveBeenCalled();
  });

  it("keeps the reason and shows the server message when the course is no longer published", async () => {
    mocks.moderateCourse.mockResolvedValue({
      error: "Khóa học không còn ở trạng thái đã xuất bản. Vui lòng tải lại trang.",
    });
    const dialog = await openDialog("Hạ về bản nháp: Khóa đang bán", "Hạ khóa học về bản nháp");
    const reason = within(dialog).getByLabelText("Lý do hạ khóa học") as HTMLTextAreaElement;

    fireEvent.change(reason, { target: { value: "Nội dung bài 1 chưa đạt yêu cầu." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hạ về bản nháp" }));

    expect((await within(dialog).findByRole("alert")).textContent).toContain("không còn ở trạng thái đã xuất bản");
    expect(reason.value).toBe("Nội dung bài 1 chưa đạt yêu cầu.");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows a busy label, blocks a second submit and ignores closing while the request is in flight", async () => {
    let resolveAction: (value: unknown) => void = () => {};
    mocks.moderateCourse.mockReturnValue(new Promise((resolve) => (resolveAction = resolve)));
    const dialog = await openDialog("Gỡ khóa học Khóa đang bán", "Gỡ khóa học");

    fireEvent.change(within(dialog).getByLabelText("Lý do gỡ khóa học"), {
      target: { value: "Vi phạm bản quyền nội dung." },
    });
    const confirm = within(dialog).getByRole("button", { name: "Gỡ khóa học" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    const busy = await within(dialog).findByRole("button", { name: "Đang gỡ..." });
    expect(busy.hasAttribute("disabled")).toBe(true);
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect(within(dialog).getByRole("button", { name: "Hủy bỏ" }).hasAttribute("disabled")).toBe(true);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(mocks.moderateCourse).toHaveBeenCalledTimes(1);

    resolveAction({ success: true, data: {} });
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith("Đã gỡ khóa học."));
  });

  it("does not carry the previous reason into the next dialog", async () => {
    renderScreen(makeData([publishedRow]), { filter: { status: "published" } });

    fireEvent.click(screen.getByRole("button", { name: "Gỡ khóa học Khóa đang bán" }));
    let dialog = await screen.findByRole("dialog", { name: "Gỡ khóa học" });
    fireEvent.change(within(dialog).getByLabelText("Lý do gỡ khóa học"), { target: { value: "Lý do dở dang" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy bỏ" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    fireEvent.click(screen.getByRole("button", { name: "Gỡ khóa học Khóa đang bán" }));
    dialog = await screen.findByRole("dialog", { name: "Gỡ khóa học" });
    expect((within(dialog).getByLabelText("Lý do gỡ khóa học") as HTMLTextAreaElement).value).toBe("");
  });
});

describe("live search", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const type = (value: string) => fireEvent.change(searchbox(), { target: { value } });
  const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms));

  it("does not navigate before 300 ms, then replaces the URL once with q and no page", () => {
    renderScreen(makeData([makeRow()]), { filter: { page: 2 } });

    type("toeic");
    wait(299);
    expect(mocks.replace).not.toHaveBeenCalled();

    wait(1);
    expect(mocks.replace).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledWith("/admin/courses?q=toeic");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("turns rapid typing into one navigation with the final term", () => {
    renderScreen(makeData([makeRow()]));

    for (const value of ["t", "to", "toe", "toeic"]) {
      type(value);
      wait(100);
    }
    wait(300);

    expect(mocks.replace).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledWith("/admin/courses?q=toeic");
  });

  it("applies Enter immediately and cancels the pending debounce", () => {
    renderScreen(makeData([makeRow()]));

    type("toeic");
    fireEvent.submit(searchbox().closest("form")!);
    expect(mocks.replace).toHaveBeenCalledTimes(1);

    wait(1000);
    expect(mocks.replace).toHaveBeenCalledTimes(1);
  });

  it("removes q when the input is cleared, and keeps the status tab", () => {
    renderScreen(makeData([makeRow()]), { filter: { status: "published", q: "toeic" } });

    type("   ");
    wait(300);

    expect(mocks.replace).toHaveBeenCalledWith("/admin/courses?status=published");
  });

  it("keeps the status tab when applying a term", () => {
    renderScreen(makeData([makeRow()]), { filter: { status: "removed" } });

    type("abc");
    wait(300);

    expect(mocks.replace).toHaveBeenCalledWith("/admin/courses?status=removed&q=abc");
  });

  it("does not navigate when the trimmed term equals the current q", () => {
    renderScreen(makeData([makeRow()]), { filter: { q: "toeic" } });

    type("  toeic ");
    wait(300);
    fireEvent.submit(searchbox().closest("form")!);

    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("does not navigate again for the same term typed back after an applied one", () => {
    renderScreen(makeData([makeRow()]));

    type("ab");
    wait(300);
    type("abc");
    type("ab");
    wait(300);

    // "ab" đã được yêu cầu rồi (URL có thể chưa kịp đổi), nên gõ lại đúng cụm đó không điều hướng thêm.
    expect(mocks.replace).toHaveBeenCalledTimes(1);
  });

  it("keeps the typed value and the focus when the URL catches up with the debounced term", () => {
    const view = renderScreen(makeData([makeRow()]));
    const input = searchbox();
    input.focus();

    type("toe");
    wait(300);
    // Gõ tiếp trong lúc URL chưa kịp về, rồi URL về với cụm cũ "toe".
    type("toeic ");
    view.rerender(<AdminCoursesClient filter={{ ...defaultFilter, q: "toe" }} data={makeData([makeRow()])} error={null} />);

    expect(searchbox()).toBe(input);
    expect((input as HTMLInputElement).value).toBe("toeic ");
    expect(document.activeElement).toBe(input);

    wait(300);
    expect(mocks.replace).toHaveBeenLastCalledWith("/admin/courses?q=toeic");
  });

  it("follows the URL when it changes from outside, such as the clear-search link or Back", () => {
    const view = renderScreen(makeData([makeRow()]), { filter: { q: "toeic" } });
    expect((searchbox() as HTMLInputElement).value).toBe("toeic");

    view.rerender(<AdminCoursesClient filter={{ ...defaultFilter, q: "" }} data={makeData([makeRow()])} error={null} />);
    expect((searchbox() as HTMLInputElement).value).toBe("");

    view.rerender(<AdminCoursesClient filter={{ ...defaultFilter, q: "ielts" }} data={makeData([makeRow()])} error={null} />);
    expect((searchbox() as HTMLInputElement).value).toBe("ielts");
  });

  it("drops a pending term when the tab changes, so a stale timer cannot navigate", () => {
    renderScreen(makeData([makeRow()]));

    type("toeic");
    fireEvent.click(screen.getByRole("link", { name: /^Đã xuất bản/ }));
    wait(1000);

    expect(mocks.replace).not.toHaveBeenCalled();
    expect((searchbox() as HTMLInputElement).value).toBe("");
  });

  it("does not navigate after the screen unmounts", () => {
    const view = renderScreen(makeData([makeRow()]));

    type("toeic");
    view.unmount();
    wait(1000);

    expect(mocks.replace).not.toHaveBeenCalled();
  });
});

describe("focus return after closing a panel or dialog (AC9)", () => {
  const summaryName = "Khóa học TOEIC cơ bản, xem tóm tắt";
  const approveName = "Duyệt khóa học Khóa học TOEIC cơ bản";

  it("returns focus to the row button when a dialog is cancelled", async () => {
    renderScreen(makeData([makeRow()]));
    const opener = screen.getByRole("button", { name: approveName });

    fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog", { name: "Duyệt khóa học này?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy bỏ" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("returns focus to the summary button when the panel is closed", async () => {
    renderScreen(makeData([makeRow()]));
    const opener = screen.getByRole("button", { name: summaryName });

    fireEvent.click(opener);
    const panel = await screen.findByRole("dialog", { name: "Khóa học TOEIC cơ bản" });
    fireEvent.keyDown(panel, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("returns focus to the panel button when a dialog opened from the panel is cancelled", async () => {
    renderScreen(makeData([makeRow()]));

    fireEvent.click(screen.getByRole("button", { name: summaryName }));
    const panel = await screen.findByRole("dialog", { name: "Khóa học TOEIC cơ bản" });
    const panelButton = within(panel).getByRole("button", { name: approveName });
    fireEvent.click(panelButton);
    const dialog = await screen.findByRole("dialog", { name: "Duyệt khóa học này?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy bỏ" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Duyệt khóa học này?" })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(panelButton));
    expect(screen.getByRole("dialog", { name: "Khóa học TOEIC cơ bản" })).toBeTruthy();
  });

  it("keeps focus inside the open panel when its action button disappears after the summary loads", async () => {
    let resolveSummary: (value: unknown) => void = () => undefined;
    mocks.getAdminCourseSummary.mockReturnValue(new Promise((resolve) => (resolveSummary = resolve)));
    renderScreen(makeData([makeRow()]));

    fireEvent.click(screen.getByRole("button", { name: summaryName }));
    const panel = await screen.findByRole("dialog", { name: "Khóa học TOEIC cơ bản" });
    fireEvent.click(within(panel).getByRole("button", { name: approveName }));
    const dialog = await screen.findByRole("dialog", { name: "Duyệt khóa học này?" });

    // Phản hồi muộn cho thấy khóa học đã là bản nháp: panel không còn nút duyệt (nút đã mở dialog biến mất).
    resolveSummary({ success: true, data: { ...outline, course: { ...outline.course, status: "draft" } } });
    await waitFor(() => expect(within(panel).queryByRole("button", { name: approveName })).toBeNull());

    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy bỏ" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Duyệt khóa học này?" })).toBeNull());
    await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));
    expect(document.getElementById("admin-course-results")).not.toBe(document.activeElement);
  });

  it("falls back to the results heading when the opener left the list while the dialog was open", async () => {
    const { rerender } = renderScreen(makeData([makeRow()]));

    fireEvent.click(screen.getByRole("button", { name: approveName }));
    const dialog = await screen.findByRole("dialog", { name: "Duyệt khóa học này?" });
    rerender(<AdminCoursesClient filter={defaultFilter} data={makeData([])} error={null} />);
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy bỏ" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2 })));
  });

  it("moves focus to the results heading after a confirmed action instead of the button that opened it", async () => {
    mocks.approveCourseReview.mockResolvedValue({ success: true, data: {} });
    renderScreen(makeData([makeRow()]));

    fireEvent.click(screen.getByRole("button", { name: approveName }));
    const dialog = await screen.findByRole("dialog", { name: "Duyệt khóa học này?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Duyệt khóa học" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2 })));
  });
});
