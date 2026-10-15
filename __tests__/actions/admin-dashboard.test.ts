import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAdminDashboardData } from "@/app/actions/admin-dashboard";
import { adminDashboardSchema } from "@/lib/schemas/admin-dashboard";
import { createClient } from "@/utils/supabase/server";
import { getActiveProfileEmails } from "@/lib/supabase/profile-emails";

// Test plan:
// - Mục tiêu: kiểm tra getAdminDashboardData trả đúng hợp đồng AD4 từ kết quả RPC và giữ thứ tự an toàn (AC3, AC8, AC10, AC11; G1, G3, G6).
// - Loại test: action (Supabase server client và đọc email service role được mock; số liệu thật do integration `ad4-admin-dashboard-summary` kiểm).
// - Đối tượng: `getAdminDashboardData` và `adminDashboardSchema` / `adminDashboardSummaryRpcSchema`.
// - Case thành công:
//   - admin đang hoạt động nhận DTO khớp schema: cùng số liệu RPC, đổi tên trường theo hợp đồng mới, không có trường giá.
//   - chỉ gọi RPC một lần và đọc đúng năm lượt ghi danh mới nhất; email chỉ đọc cho id hồ sơ mà truy vấn ghi danh trả về.
//   - hồ sơ đã gỡ/không còn → nhãn "Học viên ẩn danh" và email null; hồ sơ chưa có email → email null; không bao giờ trả `no-email@vocaspace.com`.
// - Case thất bại:
//   - không có phiên; không phải admin; admin đã gỡ (truy vấn hồ sơ lọc removed_at không trả dòng) bị từ chối.
//   - lỗi RPC, lỗi đọc ghi danh, RPC trả cấu trúc sai, đọc email lỗi → lỗi an toàn, không có dữ liệu một phần và không lộ văn bản lỗi thô.
// - Bảo mật/phân quyền: người bị từ chối không kích hoạt RPC, truy vấn ghi danh hay đọc email service role.
// - Ổn định/resilience: lỗi bất kỳ không để lại số 0 mặc định như dữ liệu thật; console.error được ghi để dò lỗi.
// - Invariant cần giữ: DTO chỉ chứa trường có nguồn thật; kiểm tra admin chạy trước mọi lần đọc số liệu.
// - Kết quả verify gần nhất: passed (17 test) bằng `npx vitest run __tests__/actions/admin-dashboard.test.ts`.

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));
// Đọc email bằng service role được kiểm tra thật trong integration test `profile-private-columns`.
vi.mock("@/lib/supabase/profile-emails", () => ({
  getActiveProfileEmails: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);
const mockedGetActiveProfileEmails = vi.mocked(getActiveProfileEmails);

const ADMIN_ID = "00000000-0000-4000-8000-000000000000";
const STUDENT_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
const COURSE_ID = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
const ENROLLMENT_ID = "a1b2c3d4-e5f6-4a8b-9c0d-1e2f3a4b5c6d";
const RAW_DB_TEXT = "relation \"payments\" does not exist (raw database text)";

const RPC_SUMMARY = {
  generated_at: "2026-10-15T08:00:00.000000+00:00",
  pending: { count: 2, oldest_submitted_at: "2026-10-12T08:00:00+00:00" },
  users: { students: 120, teachers: 7, admins: 2 },
  published_courses: 15,
  flashcards: 45230,
  revenue: {
    total: 6_300_000,
    months: [
      { month: "2026-05", revenue: 0 },
      { month: "2026-06", revenue: 1_000_000 },
      { month: "2026-07", revenue: 0 },
      { month: "2026-08", revenue: 2_000_000 },
      { month: "2026-09", revenue: 3_000_000 },
      { month: "2026-10", revenue: 300_000 },
    ],
  },
  top_courses: [
    { id: COURSE_ID, title: "TOEIC 750+ Cấp tốc", enrollment_count: 1500, revenue: 5_000_000 },
  ],
};

const RAW_ENROLLMENT = {
  id: ENROLLMENT_ID,
  enrolled_at: "2026-10-15T07:30:00+00:00",
  profiles: { id: STUDENT_ID, full_name: "Nguyễn Văn A", avatar_url: "https://example.com/avatar.jpg" },
  courses: { title: "TOEIC 750+ Cấp tốc" },
};

vi.spyOn(console, "error").mockImplementation(() => {});

interface MockOptions {
  user?: { id: string } | null;
  authError?: { message: string } | null;
  profile?: { role: string } | null;
  profileError?: { message: string } | null;
  rpc?: { data: unknown; error: { message: string } | null };
  enrollments?: { data: unknown; error: { message: string } | null };
}

function createMockSupabase(options: MockOptions = {}) {
  const user = "user" in options ? options.user : { id: ADMIN_ID };
  const profile = "profile" in options ? options.profile : { role: "admin" };

  const profileChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: profile, error: options.profileError ?? null }),
  };
  const enrollmentChain = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(options.enrollments ?? { data: [RAW_ENROLLMENT], error: null }),
  };
  const rpc = vi.fn().mockResolvedValue(options.rpc ?? { data: RPC_SUMMARY, error: null });
  const from = vi.fn((table: string) => (table === "profiles" ? profileChain : enrollmentChain));

  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: options.authError ?? null }) },
    from,
    rpc,
  };
  mockedCreateClient.mockResolvedValueOnce(client as unknown as Awaited<ReturnType<typeof createClient>>);
  return { client, profileChain, enrollmentChain, rpc, from };
}

function expectNoDashboardRead(mock: ReturnType<typeof createMockSupabase>) {
  expect(mock.rpc).not.toHaveBeenCalled();
  expect(mock.from).not.toHaveBeenCalledWith("enrollments");
  expect(mockedGetActiveProfileEmails).not.toHaveBeenCalled();
}

describe("getAdminDashboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetActiveProfileEmails.mockResolvedValue(new Map([[STUDENT_ID, "nva@gmail.com"]]));
  });

  it("returns the summary for an active admin in the new DTO shape", async () => {
    const mock = createMockSupabase();

    const result = await getAdminDashboardData();

    expect(result.error).toBeUndefined();
    expect(adminDashboardSchema.safeParse(result.data).success).toBe(true);
    expect(result.data).toEqual({
      generatedAt: RPC_SUMMARY.generated_at,
      pending: { count: 2, oldestSubmittedAt: "2026-10-12T08:00:00+00:00" },
      metrics: { revenue: 6_300_000, students: 120, publishedCourses: 15, learningCards: 45230 },
      revenueMonths: RPC_SUMMARY.revenue.months,
      userDistribution: { students: 120, teachers: 7, admins: 2 },
      topCourses: [{ id: COURSE_ID, title: "TOEIC 750+ Cấp tốc", enrollmentCount: 1500, revenue: 5_000_000 }],
      recentEnrollments: [
        {
          id: ENROLLMENT_ID,
          studentName: "Nguyễn Văn A",
          studentEmail: "nva@gmail.com",
          studentAvatar: "https://example.com/avatar.jpg",
          courseTitle: "TOEIC 750+ Cấp tốc",
          enrolledAt: "2026-10-15T07:30:00+00:00",
        },
      ],
    });
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.rpc).toHaveBeenCalledWith("admin_dashboard_summary");
    expect(mock.enrollmentChain.order).toHaveBeenCalledWith("enrolled_at", { ascending: false });
    expect(mock.enrollmentChain.limit).toHaveBeenCalledWith(5);
  });

  it("returns a pending queue with no submission time as null instead of inventing a wait", async () => {
    createMockSupabase({
      rpc: { data: { ...RPC_SUMMARY, pending: { count: 0, oldest_submitted_at: null } }, error: null },
    });

    const result = await getAdminDashboardData();

    expect(result.data?.pending).toEqual({ count: 0, oldestSubmittedAt: null });
  });

  it("checks the active admin before the summary, the enrollment read or the email read", async () => {
    const order: string[] = [];
    const mock = createMockSupabase();
    mock.profileChain.single.mockImplementation(async () => {
      order.push("profile-check");
      return { data: { role: "admin" }, error: null };
    });
    mock.rpc.mockImplementation(async () => {
      order.push("rpc");
      return { data: RPC_SUMMARY, error: null };
    });
    mockedGetActiveProfileEmails.mockImplementation(async () => {
      order.push("email-read");
      return new Map();
    });

    await getAdminDashboardData();

    expect(order).toEqual(["profile-check", "rpc", "email-read"]);
    expect(mock.profileChain.is).toHaveBeenCalledWith("removed_at", null);
  });

  it("reads emails only for the learner ids the enrollment query returned", async () => {
    createMockSupabase();

    await getAdminDashboardData();

    expect(mockedGetActiveProfileEmails).toHaveBeenCalledTimes(1);
    expect(mockedGetActiveProfileEmails).toHaveBeenCalledWith([STUDENT_ID]);
  });

  it("refuses a signed-out visitor before any dashboard read", async () => {
    const mock = createMockSupabase({ user: null });

    const result = await getAdminDashboardData();

    expect(result.data).toBeUndefined();
    expect(result.error).toBe("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    expectNoDashboardRead(mock);
  });

  it("refuses a student before any dashboard read", async () => {
    const mock = createMockSupabase({ profile: { role: "student" } });

    const result = await getAdminDashboardData();

    expect(result.data).toBeUndefined();
    expect(result.error).toBe("Từ chối truy cập. Bạn không có quyền hạn quản trị viên.");
    expectNoDashboardRead(mock);
  });

  it("refuses a removed admin whose profile query returns no active row", async () => {
    const mock = createMockSupabase({ profile: null, profileError: { message: "JSON object requested, multiple (or no) rows returned" } });

    const result = await getAdminDashboardData();

    expect(result.data).toBeUndefined();
    expect(result.error).toBe("Từ chối truy cập. Bạn không có quyền hạn quản trị viên.");
    expect(mock.profileChain.is).toHaveBeenCalledWith("removed_at", null);
    expectNoDashboardRead(mock);
  });

  it("returns a safe error without partial numbers when the summary RPC fails", async () => {
    createMockSupabase({ rpc: { data: null, error: { message: RAW_DB_TEXT } } });

    const result = await getAdminDashboardData();

    expect(result.data).toBeUndefined();
    expect(result.error).toBe("Gặp sự cố hệ thống khi tải báo cáo dữ liệu quản trị.");
    expect(result.error).not.toContain("payments");
    expect(mockedGetActiveProfileEmails).not.toHaveBeenCalled();
  });

  it("returns a safe error when the recent enrollment read fails", async () => {
    createMockSupabase({ enrollments: { data: null, error: { message: RAW_DB_TEXT } } });

    const result = await getAdminDashboardData();

    expect(result.data).toBeUndefined();
    expect(result.error).toBe("Gặp sự cố hệ thống khi tải báo cáo dữ liệu quản trị.");
  });

  it.each([
    ["a negative revenue month", { ...RPC_SUMMARY, revenue: { total: 1, months: RPC_SUMMARY.revenue.months.map((m, i) => (i === 0 ? { ...m, revenue: -1 } : m)) } }],
    ["five revenue months instead of six", { ...RPC_SUMMARY, revenue: { ...RPC_SUMMARY.revenue, months: RPC_SUMMARY.revenue.months.slice(1) } }],
    ["a missing role count", { ...RPC_SUMMARY, users: { students: 1, teachers: 1 } }],
    ["a non-object payload", null],
  ])("returns the invalid-structure error and no data for %s", async (_label, payload) => {
    createMockSupabase({ rpc: { data: payload, error: null } });

    const result = await getAdminDashboardData();

    expect(result.data).toBeUndefined();
    expect(result.error).toBe("Cấu trúc dữ liệu tổng hợp không hợp lệ.");
  });

  it("shows a removed or missing learner with the existing label, no email and no fetched email", async () => {
    createMockSupabase({ enrollments: { data: [{ ...RAW_ENROLLMENT, profiles: null }], error: null } });

    const result = await getAdminDashboardData();

    expect(mockedGetActiveProfileEmails).toHaveBeenCalledWith([]);
    expect(result.data?.recentEnrollments[0]).toMatchObject({
      studentName: "Học viên ẩn danh",
      studentEmail: null,
      studentAvatar: null,
    });
  });

  it("shows no email for an active learner without a stored email and never invents one", async () => {
    mockedGetActiveProfileEmails.mockResolvedValue(new Map([[STUDENT_ID, null]]));
    createMockSupabase();

    const result = await getAdminDashboardData();

    expect(result.data?.recentEnrollments[0].studentEmail).toBeNull();
    expect(JSON.stringify(result.data)).not.toContain("no-email@vocaspace.com");
  });

  it("carries no price field for recent enrollments", async () => {
    createMockSupabase({
      enrollments: { data: [{ ...RAW_ENROLLMENT, courses: { title: "TOEIC 750+ Cấp tốc", price: 500000 } }], error: null },
    });

    const result = await getAdminDashboardData();

    expect(result.data?.recentEnrollments[0]).not.toHaveProperty("price");
  });

  it("returns the system error when the learner email lookup fails", async () => {
    mockedGetActiveProfileEmails.mockResolvedValue(null);
    createMockSupabase();

    const result = await getAdminDashboardData();

    expect(result.data).toBeUndefined();
    expect(result.error).toBe("Gặp sự cố hệ thống khi tải báo cáo dữ liệu quản trị.");
  });
});
