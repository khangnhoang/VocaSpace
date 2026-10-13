import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const NOT_FOUND = "NEXT_NOT_FOUND";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import { requireAdminPage } from "@/lib/auth/admin-access";

// Test plan:
// - Mục tiêu: AD1 AC2/AC3/G1 — helper requireAdminPage chỉ cho admin đang hoạt động đi tiếp, mọi trường hợp khác gọi notFound().
// - Loại test: unit trên helper server; mock Supabase client và notFound() (notFound thật ném lỗi để dừng render).
// - Đối tượng: requireAdminPage trong lib/auth/admin-access.ts.
// - Case thành công: admin đang hoạt động trả về user id.
// - Case thất bại (đều notFound): không có user, lỗi auth, lỗi đọc profile, không có dòng profile còn hoạt động
//   (admin đã bị gỡ: removed_at khác null nên không khớp bộ lọc), student, teacher.
// - Bảo mật/phân quyền: truy vấn profiles lọc theo id = user.id và removed_at is null; dùng getUser() chứ không getSession().
// - Ổn định/resilience: lỗi bất kỳ không bao giờ mở cổng (fail closed).
// - Ghi chú: status 404 trên bản build và điều hướng client của admin bị thu quyền được kiểm bằng smoke E2E admin-gate
//   và script kiểm tra build production, không nằm trong test này.

type ProfileResult = { data: { role: string } | null; error: { message: string } | null };

function mockSupabase(options: {
  user?: { id: string } | null;
  authError?: { message: string } | null;
  profile?: ProfileResult;
}) {
  const single = vi.fn().mockResolvedValue(options.profile ?? { data: null, error: null });
  const is = vi.fn().mockReturnValue({ single });
  const eq = vi.fn().mockReturnValue({ is });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const getUser = vi.fn().mockResolvedValue({
    data: { user: options.user === undefined ? { id: "user-1" } : options.user },
    error: options.authError ?? null,
  });
  const getSession = vi.fn();
  mocks.createClient.mockResolvedValue({ auth: { getUser, getSession }, from });
  return { from, select, eq, is, getUser, getSession };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.notFound.mockImplementation(() => {
    throw new Error(NOT_FOUND);
  });
});

// React cache() ngoài môi trường RSC không memoize, nên mỗi lần gọi chạy lại như một request mới.
describe("requireAdminPage", () => {
  it("returns the user id for an active admin and filters the profile by id and removed_at", async () => {
    const supabase = mockSupabase({ profile: { data: { role: "admin" }, error: null } });

    await expect(requireAdminPage()).resolves.toBe("user-1");

    expect(supabase.getUser).toHaveBeenCalledTimes(1);
    expect(supabase.getSession).not.toHaveBeenCalled();
    expect(supabase.from).toHaveBeenCalledWith("profiles");
    expect(supabase.select).toHaveBeenCalledWith("role");
    expect(supabase.eq).toHaveBeenCalledWith("id", "user-1");
    expect(supabase.is).toHaveBeenCalledWith("removed_at", null);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it.each([
    ["a signed-out visitor", { user: null }],
    ["an auth error even when a user is returned", { authError: { message: "invalid JWT" } }],
    ["a profile read error", { profile: { data: null, error: { message: "boom" } } }],
    ["a missing active profile row (removed admin)", { profile: { data: null, error: { message: "0 rows" } } }],
    ["a student", { profile: { data: { role: "student" }, error: null } }],
    ["a teacher", { profile: { data: { role: "teacher" }, error: null } }],
  ] as const)("calls notFound for %s", async (_label, options) => {
    mockSupabase(options);

    await expect(requireAdminPage()).rejects.toThrow(NOT_FOUND);

    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });

  it("does not query profiles when there is no authenticated user", async () => {
    const supabase = mockSupabase({ user: null });

    await expect(requireAdminPage()).rejects.toThrow(NOT_FOUND);

    expect(supabase.from).not.toHaveBeenCalled();
  });
});
