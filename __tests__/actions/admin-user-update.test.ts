import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/utils/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createUserByAdmin, deleteUserByAdmin, getAllUsers, updateUserByAdmin } from "@/app/actions/user";

// Test plan:
// - Mục tiêu: AD7 chặn tự đổi vai trò ở server, giữ sửa thông tin cá nhân và quyền sửa tài khoản khác.
// - Loại test: action, mock adapter Supabase; RLS/Storage được kiểm trong integration riêng.
// - Đối tượng: updateUserByAdmin và active-admin gate của các user action.
// - Case thành công: tự sửa cùng role admin, đổi role người khác; UUID chuẩn hóa, trường lạ bị bỏ.
// - Case thất bại: self-demotion (kể cả UUID chữ hoa), UUID/payload sai, target thiếu/removed, lỗi provider.
// - Bảo mật/phân quyền: chưa đăng nhập, sai role, hồ sơ removed không có privileged side effect.
// - Ổn định/resilience: không báo thành công khi không có target, không lộ lỗi provider.
// - Invariant cần giữ: role của chính caller không đổi, chỉ các trường whitelist được ghi.
// - Kết quả verify gần nhất: passed (17 test), npx vitest run __tests__/actions/admin-user-update.test.ts.

vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

const ACTOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TARGET = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const input = { email: "admin@example.com", full_name: "Admin mới", username: "admin_new", phone: "0912345678", role: "admin" as const };

function installActor(kind: "admin" | "student" | "removed" | "anonymous" | "error" = "admin") {
  const profile = {
    select: vi.fn(() => profile), eq: vi.fn(() => profile), is: vi.fn(() => profile),
    single: vi.fn().mockResolvedValue({ data: kind === "removed" || kind === "error" ? null : { role: kind }, error: kind === "error" ? { code: "error" } : null }),
  };
  vi.mocked(createClient).mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: kind === "anonymous" ? null : { id: ACTOR } }, error: null }) }, from: vi.fn(() => profile) } as never);
  return profile;
}

function installWrite(result: { data: { id: string } | null; error: { message: string; code: string } | null } = { data: { id: TARGET }, error: null }) {
  const update = vi.fn<(fields: Record<string, unknown>) => unknown>();
  const query = {
    update, eq: vi.fn(() => query), is: vi.fn(() => query), select: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  update.mockReturnValue(query);
  const from = vi.fn(() => query);
  vi.mocked(createAdminClient).mockReturnValue({ from } as never);
  return { query, from };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:45441");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "ad7-test-key");
  installActor();
});

describe("AD7 admin user update", () => {
  it.each([ACTOR, ACTOR.toUpperCase()])("refuses self-demotion for UUID %s before creating a privileged client", async (id) => {
    const write = installWrite();
    const result = await updateUserByAdmin(id, { ...input, role: "student" });
    expect(result).toEqual({ error: "Không thể tự thay đổi vai trò của tài khoản đang đăng nhập." });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(write.query.update).not.toHaveBeenCalled();
  });

  it("allows a self-edit that preserves the admin role", async () => {
    const { query } = installWrite({ data: { id: ACTOR }, error: null });
    expect(await updateUserByAdmin(ACTOR, input)).toEqual({ success: true, message: "Cập nhật thành công!" });
    expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ full_name: input.full_name, username: input.username, phone: input.phone, role: "admin" }));
    expect(query.eq).toHaveBeenCalledWith("id", ACTOR);
    expect(query.is).toHaveBeenCalledWith("removed_at", null);
  });

  it("normalizes another target UUID and strips immutable and forged fields", async () => {
    const { query } = installWrite();
    const hostileInput = { ...input, role: "teacher" as const, removed_at: "2020-01-01", actorId: TARGET };
    const result = await updateUserByAdmin(TARGET.toUpperCase(), hostileInput);
    expect(result).toHaveProperty("success", true);
    expect(query.eq).toHaveBeenCalledWith("id", TARGET);
    const written = query.update.mock.calls[0][0];
    expect(written).not.toHaveProperty("email");
    expect(written).not.toHaveProperty("removed_at");
    expect(written).not.toHaveProperty("actorId");
    expect(written).toHaveProperty("role", "teacher");
  });

  it.each(["invalid", "", `${TARGET} trailing`])("rejects invalid target %s without mutation", async (id) => {
    installWrite();
    expect(await updateUserByAdmin(id, input)).toHaveProperty("error");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rejects an invalid payload without mutation", async () => {
    installWrite();
    expect(await updateUserByAdmin(TARGET, { ...input, role: "root" } as never)).toHaveProperty("error");
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("does not report success for a missing or removed target", async () => {
    installWrite({ data: null, error: null });
    expect(await updateUserByAdmin(TARGET, input)).toEqual({ error: "Không tìm thấy tài khoản đang hoạt động." });
  });

  it("returns a safe provider failure without internal details", async () => {
    installWrite({ data: null, error: { code: "23505", message: "private SQL detail" } });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try { expect(await updateUserByAdmin(TARGET, input)).toEqual({ error: "Không thể cập nhật tài khoản, vui lòng thử lại." }); }
    finally { log.mockRestore(); }
  });

  it.each(["anonymous", "student", "removed", "error"] as const)("denies %s before a privileged update", async (kind) => {
    const profile = installActor(kind);
    installWrite();
    expect(await updateUserByAdmin(TARGET, input)).toHaveProperty("error");
    expect(createAdminClient).not.toHaveBeenCalled();
    if (kind !== "anonymous") expect(profile.is).toHaveBeenCalledWith("removed_at", null);
  });

  it.each([getAllUsers, () => createUserByAdmin(input), () => deleteUserByAdmin(TARGET)])("denies a removed admin for the other user-management actions", async (action) => {
    installActor("removed");
    expect(await action()).toHaveProperty("error");
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
