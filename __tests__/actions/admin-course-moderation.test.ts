import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/admin/course-list", () => ({ getAdminCourseSummaryData: vi.fn() }));

import { getAdminCourseSummary, moderateCourse } from "@/app/actions/admin-course-moderation";
import { getAdminCourseSummaryData } from "@/lib/admin/course-list";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// Test plan:
// - Mục tiêu: kiểm tra hai Server Action của màn hình /admin/courses (AD3 AC4, AC7, AC8, G1, G2): hạ/gỡ khóa học và tải tóm tắt.
// - Loại test: action/unit với Supabase client giả; helper active-admin chạy thật trên client giả.
// - Đối tượng: moderateCourse và getAdminCourseSummary.
// - Case thành công: moderateCourse gọi moderate_platform_content với target cố định 'course', action và lý do đã trim,
//   rồi revalidate /admin/courses, overview, structure, danh sách giáo viên và /courses; getAdminCourseSummary trả `{ success, data }`.
// - Case thất bại: input sai (id, action lạ, lý do ngắn/dài) chặn trước khi tạo client; chưa đăng nhập, không phải admin và admin đã bị gỡ
//   (không có dòng profile hoạt động) không gọi RPC và không chạy truy vấn courses/chapters/topics; mỗi mã lỗi RPC ra đúng thông báo; lỗi đọc và course không tồn tại.
// - Bảo mật/phân quyền: client không chọn được target type; trường lạ (targetType, targetId) bị bỏ; quyền admin kiểm tra trong chính request của action.
// - Ổn định/resilience: lỗi RPC lạ không lộ nội dung database và không revalidate.
// - Invariant cần giữ: không lời gọi RPC hay truy vấn dữ liệu course nào chạy trước khi biết người gọi là admin đang hoạt động.
// - Kết quả verify gần nhất: xem milestone AD3 CP2 trong progress.md (`npx vitest run __tests__/actions/admin-course-moderation.test.ts`).

const mockedCreateClient = vi.mocked(createClient);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedSummaryData = vi.mocked(getAdminCourseSummaryData);

const courseId = "11111111-1111-4111-8111-111111111111";
const reason = "Nội dung bài 1 vi phạm quy định.";

type Caller = "admin" | "student" | "removed-admin" | "signed-out";

function installClient(options: {
  caller?: Caller;
  rpcData?: unknown;
  rpcError?: { code?: string; message?: string } | null;
} = {}) {
  const caller = options.caller ?? "admin";
  const rpc = vi.fn().mockResolvedValue({
    data: options.rpcData ?? { status: "draft", course_id: courseId },
    error: options.rpcError ?? null,
  });
  // Admin đã bị gỡ không có dòng profile hoạt động (lọc removed_at is null) nên `.single()` trả lỗi như PostgREST.
  const profile =
    caller === "admin"
      ? { data: { role: "admin" }, error: null }
      : caller === "student"
        ? { data: { role: "student" }, error: null }
        : { data: null, error: { message: "0 rows" } };
  const single = vi.fn().mockResolvedValue(profile);
  const from = vi.fn().mockReturnValue({
    select: () => ({ eq: () => ({ is: () => ({ single }) }) }),
  });
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: caller === "signed-out" ? null : { id: "user-1" } },
        error: null,
      }),
    },
    from,
    rpc,
  };
  mockedCreateClient.mockResolvedValueOnce(client as unknown as Awaited<ReturnType<typeof createClient>>);
  return { rpc, from };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("moderateCourse", () => {
  it.each([
    ["a bad course id", { courseId: "not-a-uuid", action: "demote", reason }],
    ["an unsupported action", { courseId, action: "invalidate_review", reason }],
    ["a reason shorter than 10 characters", { courseId, action: "takedown", reason: "ngắn" }],
    ["a reason longer than 2000 characters", { courseId, action: "takedown", reason: "a".repeat(2001) }],
  ])("rejects %s before creating a client", async (_label, input) => {
    const result = await moderateCourse(input as Parameters<typeof moderateCourse>[0]);

    expect(result).toHaveProperty("error");
    expect(mockedCreateClient).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it.each<[string, Caller]>([
    ["a signed-out caller", "signed-out"],
    ["a student", "student"],
    ["a removed admin", "removed-admin"],
  ])("refuses %s without calling the RPC", async (_label, caller) => {
    const { rpc, from } = installClient({ caller });

    const result = await moderateCourse({ courseId, action: "takedown", reason });

    expect(result).toEqual({ error: "Bạn cần đăng nhập bằng tài khoản quản trị viên đang hoạt động." });
    expect(rpc).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
    for (const [table] of from.mock.calls) expect(table).toBe("profiles");
  });

  it.each(["demote", "takedown"] as const)(
    "calls the RPC with the target fixed to 'course' for %s and revalidates every affected path",
    async (action) => {
      const data = { status: action === "demote" ? "draft" : "removed", course_id: courseId };
      const { rpc } = installClient({ rpcData: data });

      const result = await moderateCourse({ courseId, action, reason: `  ${reason}  ` });

      expect(result).toEqual({ success: true, data });
      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith("moderate_platform_content", {
        p_target_type: "course",
        p_target_id: courseId,
        p_action: action,
        p_reason: reason,
      });
      const paths = mockedRevalidatePath.mock.calls.map(([path]) => path);
      expect(paths).toEqual([
        "/admin/courses",
        `/teacher/courses/${courseId}`,
        `/teacher/courses/${courseId}/structure`,
        "/(teacher)/teacher/courses",
        "/courses",
      ]);
    },
  );

  it("ignores a client-sent target type and id", async () => {
    const { rpc } = installClient();

    await moderateCourse({
      courseId,
      action: "demote",
      reason,
      targetType: "topic",
      targetId: "22222222-2222-4222-8222-222222222222",
    } as unknown as Parameters<typeof moderateCourse>[0]);

    expect(rpc).toHaveBeenCalledWith("moderate_platform_content", {
      p_target_type: "course",
      p_target_id: courseId,
      p_action: "demote",
      p_reason: reason,
    });
  });

  it.each([
    ["AUTH_REQUIRED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."],
    ["ADMIN_MODERATION_FORBIDDEN", "Bạn không có quyền xử lý nội dung nền tảng."],
    ["MODERATION_REASON_REQUIRED", "Vui lòng nhập lý do."],
    ["MODERATION_REASON_TOO_LONG", "Lý do không được vượt quá 2000 ký tự."],
    ["MODERATION_TARGET_NOT_FOUND", "Khóa học không tồn tại hoặc đã bị xóa."],
    ["MODERATION_TARGET_STATE_INVALID", "Khóa học không còn ở trạng thái đã xuất bản. Vui lòng tải lại trang."],
    ["MODERATION_TARGET_ALREADY_REMOVED", "Khóa học đã bị gỡ trước đó. Vui lòng tải lại trang."],
  ])("maps %s to a safe Vietnamese message without revalidating", async (code, message) => {
    installClient({ rpcError: { code: "P0001", message: `${code}: internal detail` } });

    const result = await moderateCourse({ courseId, action: "demote", reason });

    expect(result).toEqual({ error: message });
    expect(JSON.stringify(result)).not.toContain("internal detail");
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it("hides an unknown database error behind a generic message", async () => {
    installClient({ rpcError: { code: "XX000", message: "relation secret_table failed" } });

    const result = await moderateCourse({ courseId, action: "demote", reason });

    expect(result).toEqual({ error: "Không thể xử lý khóa học. Vui lòng thử lại." });
    expect(JSON.stringify(result)).not.toContain("secret_table");
  });
});

describe("getAdminCourseSummary", () => {
  it.each([
    ["a bad course id", { courseId: "not-a-uuid" }],
    ["a missing course id", {}],
  ])("rejects %s before creating a client", async (_label, input) => {
    const result = await getAdminCourseSummary(input as Parameters<typeof getAdminCourseSummary>[0]);

    expect(result).toHaveProperty("error");
    expect(mockedCreateClient).not.toHaveBeenCalled();
    expect(mockedSummaryData).not.toHaveBeenCalled();
  });

  it.each<[string, Caller]>([
    ["a signed-out caller", "signed-out"],
    ["a student", "student"],
    ["a removed admin", "removed-admin"],
  ])("refuses %s and runs no course, chapter or topic query", async (_label, caller) => {
    const { from } = installClient({ caller });

    const result = await getAdminCourseSummary({ courseId });

    expect(result).toEqual({ error: "Bạn cần đăng nhập bằng tài khoản quản trị viên đang hoạt động." });
    expect(mockedSummaryData).not.toHaveBeenCalled();
    for (const [table] of from.mock.calls) expect(table).toBe("profiles");
  });

  it("returns the summary for an active admin using that admin's own client", async () => {
    const summary = {
      course: { id: courseId, title: "Khóa học" },
      chapters: [],
      publishedTopicCount: 0,
    };
    installClient();
    mockedSummaryData.mockResolvedValueOnce({ data: summary as never, error: null });

    const result = await getAdminCourseSummary({ courseId });

    expect(result).toEqual({ success: true, data: summary });
    expect(mockedSummaryData).toHaveBeenCalledWith(expect.anything(), courseId);
  });

  it("returns a retryable error when the read fails and a not-found error for a missing course", async () => {
    installClient();
    mockedSummaryData.mockResolvedValueOnce({ data: null, error: "Không thể tải tóm tắt khóa học. Vui lòng thử lại." });
    expect(await getAdminCourseSummary({ courseId })).toEqual({
      error: "Không thể tải tóm tắt khóa học. Vui lòng thử lại.",
    });

    installClient();
    mockedSummaryData.mockResolvedValueOnce({ data: null, error: null });
    expect(await getAdminCourseSummary({ courseId })).toEqual({
      error: "Khóa học không tồn tại hoặc đã bị xóa.",
    });
  });
});
