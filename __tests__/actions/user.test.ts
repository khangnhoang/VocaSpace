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
//   - Admin xóa học viên: kiểm nhanh (role, giao dịch, lịch sử) rồi gọi RPC admin_delete_learner; chỉ sau khi RPC thành công
//     mới xóa các object avatars RPC trả về; lỗi Storage chỉ thành cảnh báo (A5, AUTH-018).
//   - Admin hợp lệ đọc danh sách user (có email/phone) qua service role, chỉ hồ sơ đang hoạt động (A4a, AUTH-019).
// - Case thất bại:
//   - User thường hoặc dữ liệu sai không tạo được user; tạo user lỗi thì không gửi mail; gửi mail lỗi giữ tài khoản và
//     báo admin nhờ người dùng dùng "Quên mật khẩu?"; gán role lỗi báo rõ và không gửi mail.
//     Hai lỗi sau khi tài khoản đã tạo kèm accountCreated: true để form đóng lại; lỗi trước khi tạo thì không có cờ này.
//   - User thường, unauthenticated hoặc admin target chính mình không được gọi RPC xóa.
//   - Mục tiêu không phải học viên, có giao dịch đang chạy hoặc có lịch sử nhân sự/kiểm duyệt bị từ chối ở bước kiểm nhanh,
//     RPC từ chối thì không có thao tác Storage nào.
//   - User thường gọi getAllUsers bị từ chối trước khi tạo service-role client.
// - Bảo mật/phân quyền:
//   - Caller phải có active profile với role admin; service-role client không tự thay thế bước kiểm tra caller.
// - Ổn định/resilience:
//   - Không áp dụng.
// - Invariant cần giữ:
//   - Không có end-user path nào tự gọi hard-delete user/profile qua admin action.
// - Kết quả verify gần nhất: xem milestone A5 CP5 trong progress.md (`npx vitest run __tests__/actions/user.test.ts`).
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

type QueryResult = { data: unknown; error: unknown };

// Query builder tối thiểu cho các bước kiểm nhanh: mọi phương thức lọc trả lại chính nó, kết quả đến từ maybeSingle hoặc await.
function queryReturning(result: QueryResult) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    or: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };
  return query;
}

function installAdminClient(options: {
  targetRole?: string | null;
  profileError?: unknown;
  activePayments?: unknown[];
  historyTable?: string;
  rpcData?: unknown;
  rpcError?: { message: string; code?: string };
  removeError?: { message: string };
} = {}) {
  const calls: string[] = [];
  const rpc = vi.fn(async () => {
    calls.push("rpc");
    return options.rpcError ? { data: null, error: options.rpcError } : { data: options.rpcData ?? [], error: null };
  });
  const remove = vi.fn(async () => {
    calls.push("remove");
    return { data: null, error: options.removeError ?? null };
  });
  const storageFrom = vi.fn(() => ({ remove }));
  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      const role = options.targetRole === undefined ? "student" : options.targetRole;
      return queryReturning({
        data: role ? { role } : null,
        error: options.profileError ?? null,
      });
    }
    if (table === "payments") return queryReturning({ data: options.activePayments ?? [], error: null });
    return queryReturning({ data: table === options.historyTable ? [{ id: "x" }] : [], error: null });
  });
  mockedCreateSupabaseAdmin.mockReturnValue({ from, rpc, storage: { from: storageFrom } } as never);
  return { from, rpc, remove, storageFrom, calls };
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
        accountCreated: true,
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
      expect(result).toHaveProperty("accountCreated", true);
      expect(clients.resetPasswordForEmail).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe("deleteUserByAdmin", () => {
    it("runs the early checks, then the RPC, then removes the avatar objects the RPC returned", async () => {
      installRequester({ userId: "admin-user", role: "admin" });
      const admin = installAdminClient({ rpcData: ["a.png", "b.png"] });

      const result = await deleteUserByAdmin("target-user");

      expect(result).toEqual({ success: true, message: "Xóa tài khoản thành công!" });
      expect(admin.rpc).toHaveBeenCalledWith("admin_delete_learner", { target: "target-user" });
      expect(admin.storageFrom).toHaveBeenCalledWith("avatars");
      expect(admin.remove).toHaveBeenCalledWith(["a.png", "b.png"]);
      expect(admin.calls).toEqual(["rpc", "remove"]);
      // Mọi bảng lịch sử đều được kiểm nhanh trước RPC.
      const checkedTables = admin.from.mock.calls.map(([table]) => table);
      for (const table of ["profiles", "payments", "course_collaborators", "course_collaborator_invitations", "topic_review_submissions", "review_notes", "topic_authorship_feedback", "topic_contributors", "topic_author_review_exclusions", "platform_moderation_audits", "courses", "chapters", "topics"]) {
        expect(checkedTables).toContain(table);
      }
      const lastEarlyCheck = Math.max(...admin.from.mock.invocationCallOrder);
      expect(lastEarlyCheck).toBeLessThan(admin.rpc.mock.invocationCallOrder[0]);
    });

    it("does not touch Storage when the learner has no avatar objects", async () => {
      installRequester({ userId: "admin-user", role: "admin" });
      const admin = installAdminClient({ rpcData: [] });

      expect(await deleteUserByAdmin("target-user")).toEqual({ success: true, message: "Xóa tài khoản thành công!" });
      expect(admin.storageFrom).not.toHaveBeenCalled();
    });

    it("keeps the deletion and warns the admin when removing avatar objects fails", async () => {
      installRequester({ userId: "admin-user", role: "admin" });
      installAdminClient({ rpcData: ["a.png"], removeError: { message: "storage down" } });
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await deleteUserByAdmin("target-user");

      expect(result).toMatchObject({ success: true, message: "Xóa tài khoản thành công!" });
      expect(result).toHaveProperty("warning", "Đã xóa tài khoản nhưng chưa xóa được 1 ảnh đại diện trong kho lưu trữ.");
      consoleError.mockRestore();
    });

    it("does not let an admin delete the account that is currently signed in", async () => {
      installRequester({ userId: "admin-user", role: "admin" });
      const admin = installAdminClient();

      const result = await deleteUserByAdmin("admin-user");

      expect(result).toEqual({ error: "Không thể tự xóa tài khoản đang đăng nhập." });
      expect(admin.rpc).not.toHaveBeenCalled();
    });

    it("does not expose the delete path to an ordinary authenticated user", async () => {
      installRequester({ userId: "student-user", role: "student" });
      const admin = installAdminClient();

      const result = await deleteUserByAdmin("target-user");

      expect(result).toEqual({ error: "Từ chối truy cập. Bạn không có quyền hạn quản trị viên." });
      expect(admin.rpc).not.toHaveBeenCalled();
    });

    it("rejects unauthenticated calls before creating a service-role client", async () => {
      installRequester();
      const admin = installAdminClient();

      const result = await deleteUserByAdmin("target-user");

      expect(result).toEqual({ error: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." });
      expect(admin.rpc).not.toHaveBeenCalled();
      expect(mockedCreateSupabaseAdmin).not.toHaveBeenCalled();
    });

    it.each([
      ["a teacher or admin target", { targetRole: "teacher" }, "Chỉ xóa được tài khoản học viên. Tài khoản giáo viên hoặc quản trị viên cần xử lý thủ công."],
      ["a missing target", { targetRole: null }, "Không tìm thấy tài khoản."],
      ["a learner with an active payment", { activePayments: [{ id: "p1" }] }, "Học viên đang có giao dịch thanh toán chưa hoàn tất. Hãy đợi giao dịch hoàn tất hoặc hết hạn rồi thử lại."],
      ["a learner in review history", { historyTable: "review_notes" }, "Tài khoản này có lịch sử cộng tác hoặc kiểm duyệt khóa học nên không thể xóa tại đây. Hãy báo Owner xử lý thủ công."],
    ])("refuses %s before the RPC and without any Storage call", async (_label, options, message) => {
      installRequester({ userId: "admin-user", role: "admin" });
      const admin = installAdminClient(options);

      expect(await deleteUserByAdmin("target-user")).toEqual({ error: message });
      expect(admin.rpc).not.toHaveBeenCalled();
      expect(admin.storageFrom).not.toHaveBeenCalled();
    });

    it("returns a generic message when the early check cannot read the profile", async () => {
      installRequester({ userId: "admin-user", role: "admin" });
      const admin = installAdminClient({ profileError: { message: "boom" } });

      expect(await deleteUserByAdmin("target-user")).toEqual({ error: "Không thể xóa tài khoản, vui lòng thử lại." });
      expect(admin.rpc).not.toHaveBeenCalled();
    });

    it.each([
      ["LEARNER_HAS_STAFF_HISTORY", "Tài khoản này có lịch sử cộng tác hoặc kiểm duyệt khóa học nên không thể xóa tại đây. Hãy báo Owner xử lý thủ công."],
      ["LEARNER_HAS_ACTIVE_PAYMENT", "Học viên đang có giao dịch thanh toán chưa hoàn tất. Hãy đợi giao dịch hoàn tất hoặc hết hạn rồi thử lại."],
      ["LEARNER_NOT_STUDENT", "Chỉ xóa được tài khoản học viên. Tài khoản giáo viên hoặc quản trị viên cần xử lý thủ công."],
    ])("maps the RPC refusal %s to its Vietnamese message and makes no Storage call", async (code, message) => {
      installRequester({ userId: "admin-user", role: "admin" });
      const admin = installAdminClient({ rpcError: { message: code, code: "P0001" } });

      expect(await deleteUserByAdmin("target-user")).toEqual({ error: message });
      expect(admin.storageFrom).not.toHaveBeenCalled();
    });

    it("returns a generic message for an unexpected RPC error and makes no Storage call", async () => {
      installRequester({ userId: "admin-user", role: "admin" });
      const admin = installAdminClient({ rpcError: { message: "connection reset", code: "08006" } });
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      expect(await deleteUserByAdmin("target-user")).toEqual({ error: "Không thể xóa tài khoản, vui lòng thử lại." });
      expect(admin.storageFrom).not.toHaveBeenCalled();
      consoleError.mockRestore();
    });
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
