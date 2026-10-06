import { beforeEach, describe, expect, it, vi } from "vitest";
import { createUserByAdmin, deleteUserByAdmin, getAllUsers } from "@/app/actions/user";
import { createClient } from "@/utils/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

// Test plan:
// - Mục tiêu: bảo vệ trusted admin boundary của user-maintenance action.
// - Loại test: action/unit.
// - Đối tượng: createUserByAdmin, deleteUserByAdmin, getAllUsers.
// - Case thành công:
//   - Admin tạo user: không gửi password, có marker d7_server_created, gán role đã chọn, yêu cầu mail đặt mật khẩu bằng
//     client anon không lưu session (A5, AUTH-004).
//   - Admin hợp lệ được gọi service-role delete cho user mục tiêu.
//   - Admin hợp lệ đọc danh sách user (có email/phone) qua service role, chỉ hồ sơ đang hoạt động (A4a, AUTH-019).
// - Case thất bại:
//   - User thường hoặc dữ liệu sai không tạo được user; tạo user lỗi thì không gửi mail; gửi mail lỗi giữ tài khoản và
//     báo admin nhờ người dùng dùng "Quên mật khẩu?"; gán role lỗi báo rõ và không gửi mail.
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

const SERVICE_KEY = "service-role-key-for-test";
const ANON_KEY = "anon-key-for-test";

// Mô phỏng hai client tạo từ cùng một module: service-role (createUser, update profiles) và anon (resetPasswordForEmail).
function installCreateClients(options: {
  createError?: { message: string };
  roleError?: { code: string };
  mailError?: { code: string };
} = {}) {
  const createUser = vi.fn().mockResolvedValue(
    options.createError
      ? { data: { user: null }, error: options.createError }
      : { data: { user: { id: "new-user-id" } }, error: null },
  );
  const eq = vi.fn().mockResolvedValue({ error: options.roleError ?? null });
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: options.mailError ?? null });
  mockedCreateSupabaseAdmin.mockImplementation(((_url: string, key: string) =>
    key === SERVICE_KEY
      ? { auth: { admin: { createUser } }, from }
      : { auth: { resetPasswordForEmail } }) as never);
  return { createUser, from, update, eq, resetPasswordForEmail };
}

const NEW_USER_INPUT = {
  email: "new.user@example.com",
  username: "new_user",
  full_name: "Người Dùng Mới",
  phone: "0912345678",
  role: "teacher" as const,
};

describe("user maintenance Server Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:45321");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON_KEY);
  });

  describe("createUserByAdmin", () => {
    it("creates the user without a password, with the server marker and role, then requests the password email", async () => {
      installRequester({ userId: "admin-user", role: "admin" });
      const clients = installCreateClients();

      const result = await createUserByAdmin(NEW_USER_INPUT);

      expect(result).toEqual({ success: true, message: "Đã tạo tài khoản và gửi email đặt mật khẩu" });
      const payload = clients.createUser.mock.calls[0][0];
      expect(payload).not.toHaveProperty("password");
      expect(payload).toMatchObject({
        email: "new.user@example.com",
        email_confirm: true,
        app_metadata: { d7_server_created: true },
        user_metadata: { username: "new_user", full_name: "Người Dùng Mới", phone: "0912345678" },
      });
      expect(clients.from).toHaveBeenCalledWith("profiles");
      expect(clients.update).toHaveBeenCalledWith({ role: "teacher" });
      expect(clients.eq).toHaveBeenCalledWith("id", "new-user-id");
      expect(clients.resetPasswordForEmail).toHaveBeenCalledWith("new.user@example.com");
    });

    it("refuses an ordinary user before creating any client or account", async () => {
      installRequester({ userId: "student-user", role: "student" });
      const clients = installCreateClients();

      expect(await createUserByAdmin(NEW_USER_INPUT)).toEqual({
        error: "Từ chối truy cập. Bạn không có quyền hạn quản trị viên.",
      });
      expect(mockedCreateSupabaseAdmin).not.toHaveBeenCalled();
      expect(clients.createUser).not.toHaveBeenCalled();
      expect(clients.resetPasswordForEmail).not.toHaveBeenCalled();
    });

    it("refuses invalid input without creating an account or sending mail", async () => {
      installRequester({ userId: "admin-user", role: "admin" });
      const clients = installCreateClients();

      expect(await createUserByAdmin({ ...NEW_USER_INPUT, email: "not-an-email" })).toEqual({ error: "Dữ liệu không hợp lệ!" });
      expect(clients.createUser).not.toHaveBeenCalled();
      expect(clients.resetPasswordForEmail).not.toHaveBeenCalled();
    });

    it("returns the create error and sends no mail when the account cannot be created", async () => {
      installRequester({ userId: "admin-user", role: "admin" });
      const clients = installCreateClients({ createError: { message: "Database error creating new user" } });

      expect(await createUserByAdmin(NEW_USER_INPUT)).toEqual({ error: "Database error creating new user" });
      expect(clients.update).not.toHaveBeenCalled();
      expect(clients.resetPasswordForEmail).not.toHaveBeenCalled();
    });

    it("keeps the account and tells the admin to use the forgot-password link when the mail fails", async () => {
      installRequester({ userId: "admin-user", role: "admin" });
      const clients = installCreateClients({ mailError: { code: "over_email_send_rate_limit" } });
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await createUserByAdmin(NEW_USER_INPUT);

      expect(result).toEqual({
        error: 'Đã tạo tài khoản nhưng chưa gửi được email đặt mật khẩu. Hãy nhờ người dùng chọn "Quên mật khẩu?" ở trang đăng nhập.',
      });
      expect(clients.createUser).toHaveBeenCalledTimes(1);
      consoleError.mockRestore();
    });

    it("reports a failed role assignment instead of silently leaving a student and sends no mail", async () => {
      installRequester({ userId: "admin-user", role: "admin" });
      const clients = installCreateClients({ roleError: { code: "XX000" } });
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await createUserByAdmin(NEW_USER_INPUT);

      expect(result.error).toContain("chưa gán được vai trò");
      expect(clients.resetPasswordForEmail).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
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
