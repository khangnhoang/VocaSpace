import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteUserByAdmin, getAllUsers } from "@/app/actions/user";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

// Test plan:
// - Mục tiêu: bảo vệ trusted admin boundary của user-maintenance action.
// - Loại test: action/unit.
// - Đối tượng: deleteUserByAdmin, getAllUsers.
// - Case thành công:
//   - Admin hợp lệ được gọi service-role delete cho user mục tiêu.
//   - Admin hợp lệ đọc danh sách user (có email/phone) qua service role, chỉ hồ sơ đang hoạt động (A4a, AUTH-019).
// - Case thất bại:
//   - User thường, unauthenticated hoặc admin target chính mình không được gọi service-role delete.
//   - User thường gọi getAllUsers bị từ chối trước khi tạo service-role client.
// - Bảo mật/phân quyền:
//   - Caller phải có active profile với role admin; service-role client không tự thay thế bước kiểm tra caller.
// - Ổn định/resilience:
//   - Không áp dụng.
// - Invariant cần giữ:
//   - Không có end-user path nào tự gọi hard-delete user/profile qua admin action.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/actions/user.test.ts` (A4a CP1).
// - Ghi chú: RLS/profile delete capability được kiểm tra bằng real local Supabase integration test.

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);
const mockedCreateSupabaseAdmin = vi.mocked(createSupabaseAdmin);

function installRequester(options: { userId?: string; role?: string } = {}) {
  const profileQuery = {
    select: vi.fn(() => profileQuery),
    eq: vi.fn(() => profileQuery),
    is: vi.fn(() => profileQuery),
    single: vi.fn().mockResolvedValue({
      data: options.role ? { role: options.role } : null,
      error: options.role ? null : { message: "PROFILE_NOT_FOUND" },
    }),
  };
  const requester = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.userId ? { id: options.userId } : null },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue(profileQuery),
  };

  mockedCreateClient.mockResolvedValueOnce(requester as unknown as Awaited<ReturnType<typeof createClient>>);
  return requester;
}

function installAdminClient() {
  const deleteUser = vi.fn().mockResolvedValue({ error: null });
  mockedCreateSupabaseAdmin.mockReturnValue({
    auth: { admin: { deleteUser } },
  } as never);
  return deleteUser;
}

describe("user maintenance Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows an authenticated admin to use the existing trusted maintenance path", async () => {
    installRequester({ userId: "admin-user", role: "admin" });
    const deleteUser = installAdminClient();

    const result = await deleteUserByAdmin("target-user");

    expect(result).toEqual({ success: true, message: "Xóa tài khoản thành công!" });
    expect(deleteUser).toHaveBeenCalledWith("target-user");
  });

  it("does not let an admin delete the account that is currently signed in", async () => {
    installRequester({ userId: "admin-user", role: "admin" });
    const deleteUser = installAdminClient();

    const result = await deleteUserByAdmin("admin-user");

    expect(result).toEqual({ error: "Không thể tự xóa tài khoản đang đăng nhập." });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("does not expose the service-role delete path to an ordinary authenticated user", async () => {
    installRequester({ userId: "student-user", role: "student" });
    const deleteUser = installAdminClient();

    const result = await deleteUserByAdmin("target-user");

    expect(result).toEqual({ error: "Từ chối truy cập. Bạn không có quyền hạn quản trị viên." });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated maintenance calls before creating a service-role client", async () => {
    installRequester();
    const deleteUser = installAdminClient();

    const result = await deleteUserByAdmin("target-user");

    expect(result).toEqual({ error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(mockedCreateSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("lists active profiles with private fields through the service role only after the admin check", async () => {
    installRequester({ userId: "admin-user", role: "admin" });
    const rows = [{ id: "u1", email: "u1@example.com", phone: "0900000001" }];
    const listQuery = {
      select: vi.fn(() => listQuery),
      is: vi.fn(() => listQuery),
      order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    };
    const from = vi.fn(() => listQuery);
    mockedCreateSupabaseAdmin.mockReturnValue({ from } as never);

    expect(await getAllUsers()).toEqual({ data: rows });
    expect(from).toHaveBeenCalledWith("profiles");
    expect(listQuery.is).toHaveBeenCalledWith("removed_at", null);
  });

  it("refuses the user list to an ordinary user before creating a service-role client", async () => {
    installRequester({ userId: "student-user", role: "student" });

    expect(await getAllUsers()).toEqual({ error: "Từ chối truy cập. Bạn không có quyền hạn quản trị viên." });
    expect(mockedCreateSupabaseAdmin).not.toHaveBeenCalled();
  });
});
