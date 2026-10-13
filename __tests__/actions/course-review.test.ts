import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  submitCourseReview,
  withdrawCourseReview,
} from "@/app/actions/course-review";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// Test plan:
// - Mục tiêu: kiểm tra Server Actions gửi duyệt / rút yêu cầu duyệt khóa học (AD2) chỉ validate input, gọi đúng RPC và map lỗi an toàn.
// - Loại test: action/unit với Supabase client giả.
// - Đối tượng: submitCourseReview và withdrawCourseReview.
// - Case thành công: gọi đúng RPC với courseId đã parse; revalidate overview, structure, danh sách của giáo viên và /courses; trả `{ success, data }`.
// - Case thất bại: input sai bị chặn trước khi tạo client; chưa đăng nhập không gọi RPC; mỗi mã lỗi RPC ra đúng thông báo tiếng Việt.
// - Bảo mật/phân quyền: action không tự cấp quyền; owner/co_owner, trạng thái và bài đã xuất bản do RPC kiểm tra (xem ad2-course-listing-approval integration).
// - Ổn định/resilience: lỗi RPC lạ không lộ nội dung database; lỗi RPC không revalidate.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/actions/course-review.test.ts`.

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const courseId = "11111111-1111-4111-8111-111111111111";

function installClient(options: {
  user?: boolean;
  data?: unknown;
  error?: { code?: string; message?: string } | null;
} = {}) {
  const rpc = vi.fn().mockResolvedValue({
    data: options.data ?? { course_id: courseId, status: "pending" },
    error: options.error ?? null,
  });
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user === false ? null : { id: "user-1" } },
      }),
    },
    rpc,
  };

  mockedCreateClient.mockResolvedValueOnce(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );
  return rpc;
}

const actions = [
  { name: "submitCourseReview", run: submitCourseReview, rpcName: "submit_course_review" },
  { name: "withdrawCourseReview", run: withdrawCourseReview, rpcName: "withdraw_course_review" },
] as const;

describe.each(actions)("$name", ({ run, rpcName }) => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an invalid course id before creating a client", async () => {
    const result = await run({ courseId: "not-a-uuid" });

    expect(result).toEqual({ error: "ID khóa học không hợp lệ." });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("rejects a signed-out caller before calling the RPC", async () => {
    const rpc = installClient({ user: false });

    const result = await run({ courseId });

    expect(result).toEqual({ error: "Vui lòng đăng nhập lại." });
    expect(rpc).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it("calls its RPC, revalidates the course pages and returns the data", async () => {
    const data = { course_id: courseId, status: "pending" };
    const rpc = installClient({ data });

    const result = await run({ courseId });

    expect(result).toEqual({ success: true, data });
    expect(rpc).toHaveBeenCalledWith(rpcName, { p_course_id: courseId });
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/teacher/courses/${courseId}`);
    expect(mockedRevalidatePath).toHaveBeenCalledWith(`/teacher/courses/${courseId}/structure`);
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/(teacher)/teacher/courses");
    expect(mockedRevalidatePath).toHaveBeenCalledWith("/courses");
  });

  it.each([
    ["AUTH_REQUIRED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."],
    ["COURSE_SUBMIT_FORBIDDEN", "Chỉ chủ sở hữu hoặc đồng sở hữu mới được gửi duyệt hoặc rút yêu cầu duyệt khóa học."],
    ["COURSE_NOT_FOUND", "Khóa học không tồn tại hoặc đã bị xóa."],
    ["COURSE_REVIEW_STATE_INVALID", "Trạng thái khóa học đã thay đổi. Vui lòng tải lại trang."],
    ["COURSE_SUBMIT_NOT_READY", "Cần ít nhất 1 bài học đã xuất bản để gửi duyệt."],
  ])("maps %s to a safe Vietnamese message without revalidating", async (code, message) => {
    installClient({ error: { code: "P0001", message: `${code}: internal detail` } });

    const result = await run({ courseId });

    expect(result).toEqual({ error: message });
    expect(JSON.stringify(result)).not.toContain("internal detail");
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it("hides an unknown database error behind a generic message", async () => {
    installClient({ error: { code: "XX000", message: "relation secret_table failed" } });

    const result = await run({ courseId });

    expect(result).toEqual({
      error: "Không thể xử lý yêu cầu duyệt khóa học. Vui lòng thử lại.",
    });
    expect(JSON.stringify(result)).not.toContain("secret_table");
  });
});
