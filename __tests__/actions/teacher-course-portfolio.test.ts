import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTeacherCoursePortfolio } from "@/app/actions/teacher-course-portfolio";
import { createClient } from "@/utils/supabase/server";

// Test plan:
// - Mục tiêu: kiểm tra wrapper server của portfolio giáo viên không nhận danh tính từ client, parse payload và trả lỗi an toàn.
// - Loại test: Server Action với Supabase boundary mock (RPC thật được kiểm ở integration test).
// - Đối tượng: getTeacherCoursePortfolio.
// - Case thành công: payload rỗng hợp lệ được parse và trả về; RPC được gọi không đối số.
// - Case thất bại: AUTH_REQUIRED, TEACHER_PORTFOLIO_FORBIDDEN, lỗi RPC khác, payload sai shape, client ném lỗi.
// - Bảo mật/phân quyền: action không có tham số và gọi RPC không đối số; lỗi thô không rò ra result.
// - Ổn định/resilience: mọi lỗi thành kết quả `success: false` thay vì throw.
// - Invariant cần giữ: UI chỉ nhận dữ liệu đã qua schema.
// - Kết quả verify gần nhất: passed bằng `npm run test:run -- __tests__/actions/teacher-course-portfolio.test.ts` (TPORT1 CP1).

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);

function mockRpc(result: { data: unknown; error: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(result);
  mockedCreateClient.mockResolvedValueOnce({ rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
  return rpc;
}

describe("getTeacherCoursePortfolio", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("calls the RPC without arguments, so the caller identity comes only from the database session", async () => {
    const rpc = mockRpc({ data: { can_create_course: false, courses: [], attention: [] }, error: null });

    const result = await getTeacherCoursePortfolio();

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("get_teacher_course_portfolio");
    expect(getTeacherCoursePortfolio.length).toBe(0);
    expect(result).toEqual({
      success: true,
      data: { can_create_course: false, courses: [], attention: [] },
    });
  });

  it.each([
    ["AUTH_REQUIRED", "AUTH_REQUIRED"],
    ["TEACHER_PORTFOLIO_FORBIDDEN", "FORBIDDEN"],
    ["connection reset by peer: select * from topic_review_submissions", "UNAVAILABLE"],
  ])("maps RPC error %s to %s without leaking the raw message", async (message, errorCode) => {
    mockRpc({ data: null, error: { message } });

    const result = await getTeacherCoursePortfolio();

    expect(result).toMatchObject({ success: false, errorCode });
    expect(JSON.stringify(result)).not.toContain("topic_review_submissions");
  });

  it("returns UNAVAILABLE instead of partial data when the payload drifts from the schema", async () => {
    mockRpc({ data: { can_create_course: true, courses: [], attention: [], extra: 1 }, error: null });

    expect(await getTeacherCoursePortfolio()).toMatchObject({ success: false, errorCode: "UNAVAILABLE" });
  });

  it("never throws when the Supabase client cannot be created", async () => {
    mockedCreateClient.mockRejectedValueOnce(new Error("cookies unavailable"));

    expect(await getTeacherCoursePortfolio()).toMatchObject({ success: false, errorCode: "UNAVAILABLE" });
  });
});
