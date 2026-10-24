import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTeacherCourseInsights } from "@/app/actions/teacher-course-insights";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: kiểm tra wrapper server của số liệu khóa học parse courseId trước khi gọi RPC, parse payload và trả lỗi an toàn.
// - Loại test: Server Action với Supabase boundary mock (RPC thật được kiểm ở integration test).
// - Đối tượng: getTeacherCourseInsights.
// - Case thành công: payload hợp lệ được parse và trả về; RPC nhận đúng courseId đã parse và không đối số nào khác.
// - Case thất bại: courseId không phải UUID/không phải chuỗi (INVALID_INPUT, không tạo client, không gọi RPC), không có session (AUTH_REQUIRED, không gọi RPC), lỗi quyền 42501 của người đã đăng nhập, AUTH_REQUIRED và TEACHER_INSIGHTS_FORBIDDEN từ RPC, lỗi RPC khác, payload sai shape, client ném lỗi.
// - Bảo mật/phân quyền: input thù địch bị chặn trước Supabase; lỗi thô không rò ra result.
// - Ổn định/resilience: mọi lỗi thành kết quả `success: false` thay vì throw.
// - Invariant cần giữ: UI chỉ nhận dữ liệu đã qua schema.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/actions/teacher-course-insights.test.ts` (TOV1 CP1).

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);
const courseId = "11111111-1111-4111-8111-111111111111";

const payload = {
  enrollment_total: 3,
  enrollments_by_month: [
    { month: "2026-05", count: 0 },
    { month: "2026-06", count: 0 },
    { month: "2026-07", count: 1 },
    { month: "2026-08", count: 0 },
    { month: "2026-09", count: 1 },
    { month: "2026-10", count: 1 },
  ],
  counted_topic_total: 2,
  progress: { not_started: 1, in_progress: 1, completed: 1 },
};

type RpcError = { message: string; code?: string } | null;

function mockRpc(result: { data: unknown; error: RpcError }, user: { id: string } | null = { id: "teacher-1" }) {
  const rpc = vi.fn().mockResolvedValue(result);
  const getUser = vi.fn().mockResolvedValue({ data: { user } });
  mockedCreateClient.mockResolvedValueOnce({
    rpc,
    auth: { getUser },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return rpc;
}

describe("getTeacherCourseInsights", () => {
  beforeEach(() => {
    mockedCreateClient.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("calls the RPC with only the parsed course id and returns the parsed figures", async () => {
    const rpc = mockRpc({ data: payload, error: null });

    const result = await getTeacherCourseInsights(courseId);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_teacher_course_insights", { p_course_id: courseId });
    expect(result).toEqual({ success: true, data: payload });
  });

  it.each([
    ["a non-UUID string", "not-a-uuid"],
    ["an SQL fragment", "' or 1=1 --"],
    ["an empty string", ""],
    ["an object carrying another course id", { id: courseId }],
    ["undefined", undefined],
  ])("rejects %s as INVALID_INPUT before touching Supabase", async (_name, hostile) => {
    expect(await getTeacherCourseInsights(hostile as unknown as string)).toMatchObject({
      success: false,
      errorCode: "INVALID_INPUT",
    });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("returns AUTH_REQUIRED without calling the RPC when there is no session", async () => {
    const rpc = mockRpc(
      { data: null, error: { code: "42501", message: "permission denied for function get_teacher_course_insights" } },
      null,
    );

    expect(await getTeacherCourseInsights(courseId)).toMatchObject({ success: false, errorCode: "AUTH_REQUIRED" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reports a permission error for a signed-in caller as UNAVAILABLE, not AUTH_REQUIRED", async () => {
    mockRpc({
      data: null,
      error: { code: "42501", message: "permission denied for function get_teacher_course_insights" },
    });

    expect(await getTeacherCourseInsights(courseId)).toMatchObject({ success: false, errorCode: "UNAVAILABLE" });
  });

  it.each([
    ["AUTH_REQUIRED", "AUTH_REQUIRED"],
    ["TEACHER_INSIGHTS_FORBIDDEN", "FORBIDDEN"],
    ["canceling statement due to statement timeout: select from user_topic_progress", "UNAVAILABLE"],
  ])("maps RPC error %s to %s without leaking the raw message", async (message, errorCode) => {
    mockRpc({ data: null, error: { message } });

    const result = await getTeacherCourseInsights(courseId);

    expect(result).toMatchObject({ success: false, errorCode });
    expect(JSON.stringify(result)).not.toMatch(/TEACHER_INSIGHTS_FORBIDDEN|user_topic_progress/);
  });

  it("returns UNAVAILABLE instead of partial data when the payload drifts from the schema", async () => {
    mockRpc({ data: { ...payload, learner_ids: [courseId] }, error: null });

    expect(await getTeacherCourseInsights(courseId)).toMatchObject({ success: false, errorCode: "UNAVAILABLE" });
  });

  it("never throws when the Supabase client cannot be created", async () => {
    mockedCreateClient.mockRejectedValueOnce(new Error("cookies unavailable"));

    expect(await getTeacherCourseInsights(courseId)).toMatchObject({ success: false, errorCode: "UNAVAILABLE" });
  });
});
