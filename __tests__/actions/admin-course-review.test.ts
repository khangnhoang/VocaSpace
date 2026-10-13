import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  approveCourseReview,
  rejectCourseReview,
} from "@/app/actions/admin-course-review";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// Test plan:
// - Mục tiêu: kiểm tra Server Actions admin duyệt / từ chối khóa học (AD2 AC9) chỉ validate input, dùng session của người gọi và map lỗi an toàn.
// - Loại test: action/unit với Supabase client giả.
// - Đối tượng: approveCourseReview và rejectCourseReview.
// - Case thành công: gọi đúng RPC (reject truyền lý do đã trim); revalidate overview, structure, danh sách giáo viên và /courses; trả `{ success, data }`.
// - Case thất bại: input sai (id, lý do ngắn hoặc dài) bị chặn trước khi tạo client; chưa đăng nhập không gọi RPC; mỗi mã lỗi RPC ra đúng thông báo tiếng Việt.
// - Bảo mật/phân quyền: action không giữ quyền riêng; quyền admin đang hoạt động do RPC kiểm tra (xem ad2-course-listing-approval integration).
// - Ổn định/resilience: lỗi RPC lạ không lộ nội dung database; lỗi RPC không revalidate.
// - Ghi chú: chưa có màn hình admin gọi các action này, màn hình đến ở AD3.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/actions/admin-course-review.test.ts`.

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);
const mockedRevalidatePath = vi.mocked(revalidatePath);

const courseId = "11111111-1111-4111-8111-111111111111";
const reason = "Nội dung bài 1 còn thiếu phần giải thích.";

function installClient(options: {
  user?: boolean;
  data?: unknown;
  error?: { code?: string; message?: string } | null;
} = {}) {
  const rpc = vi.fn().mockResolvedValue({
    data: options.data ?? { course_id: courseId, status: "published" },
    error: options.error ?? null,
  });
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user === false ? null : { id: "admin-1" } },
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
  {
    name: "approveCourseReview",
    run: () => approveCourseReview({ courseId }),
    rpcName: "approve_course_review",
    rpcArgs: { p_course_id: courseId },
  },
  {
    name: "rejectCourseReview",
    run: () => rejectCourseReview({ courseId, rejectMessage: `  ${reason}  ` }),
    rpcName: "reject_course_review",
    rpcArgs: { p_course_id: courseId, p_reason: reason },
  },
] as const;

describe("admin course review Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid input before creating a client", async () => {
    expect(await approveCourseReview({ courseId: "not-a-uuid" })).toEqual({
      error: "ID khóa học không hợp lệ.",
    });
    expect(
      await rejectCourseReview({ courseId: "not-a-uuid", rejectMessage: reason }),
    ).toEqual({ error: "ID khóa học không hợp lệ." });
    expect(await rejectCourseReview({ courseId, rejectMessage: "ngắn" })).toEqual({
      error: "Lý do từ chối phải có ít nhất 10 ký tự.",
    });
    expect(
      await rejectCourseReview({ courseId, rejectMessage: "a".repeat(1001) }),
    ).toEqual({ error: "Lý do từ chối không được vượt quá 1000 ký tự." });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  describe.each(actions)("$name", ({ run, rpcName, rpcArgs }) => {
    it("rejects a signed-out caller before calling the RPC", async () => {
      const rpc = installClient({ user: false });

      expect(await run()).toEqual({ error: "Vui lòng đăng nhập lại." });
      expect(rpc).not.toHaveBeenCalled();
      expect(mockedRevalidatePath).not.toHaveBeenCalled();
    });

    it("calls its RPC with the parsed input, revalidates and returns the data", async () => {
      const data = { course_id: courseId, status: "published" };
      const rpc = installClient({ data });

      expect(await run()).toEqual({ success: true, data });
      expect(rpc).toHaveBeenCalledWith(rpcName, rpcArgs);
      expect(mockedRevalidatePath).toHaveBeenCalledWith(`/teacher/courses/${courseId}`);
      expect(mockedRevalidatePath).toHaveBeenCalledWith(`/teacher/courses/${courseId}/structure`);
      expect(mockedRevalidatePath).toHaveBeenCalledWith("/(teacher)/teacher/courses");
      expect(mockedRevalidatePath).toHaveBeenCalledWith("/courses");
    });

    it.each([
      ["AUTH_REQUIRED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."],
      ["ADMIN_COURSE_REVIEW_FORBIDDEN", "Bạn không có quyền duyệt khóa học."],
      ["COURSE_NOT_FOUND", "Khóa học không tồn tại hoặc đã bị xóa."],
      ["COURSE_REVIEW_STATE_INVALID", "Khóa học không còn ở trạng thái chờ duyệt. Vui lòng tải lại trang."],
      ["COURSE_SUBMIT_NOT_READY", "Khóa học không còn bài học nào đã xuất bản nên chưa thể duyệt."],
      ["COURSE_REJECT_REASON_INVALID", "Lý do từ chối phải có từ 10 đến 1000 ký tự."],
    ])("maps %s to a safe Vietnamese message without revalidating", async (code, message) => {
      installClient({ error: { code: "P0001", message: `${code}: internal detail` } });

      const result = await run();

      expect(result).toEqual({ error: message });
      expect(JSON.stringify(result)).not.toContain("internal detail");
      expect(mockedRevalidatePath).not.toHaveBeenCalled();
    });

    it("hides an unknown database error behind a generic message", async () => {
      installClient({ error: { code: "XX000", message: "relation secret_table failed" } });

      const result = await run();

      expect(result).toEqual({
        error: "Không thể xử lý duyệt khóa học. Vui lòng thử lại.",
      });
      expect(JSON.stringify(result)).not.toContain("secret_table");
    });
  });
});
