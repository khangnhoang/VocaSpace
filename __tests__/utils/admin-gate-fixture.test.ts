import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import {
  assertIsolatedAdminGateTargets,
  prepareRevocableAdmin,
  removeRevocableAdmin,
  revokeAdminRole,
} from "../../scripts/e2e/admin-gate-fixture.mjs";

// Test plan:
// - Mục tiêu: AD1 G5 — fixture và script kiểm tra production của admin gate chỉ chạy với runtime E2E cô lập (HTTP loopback :45441) và app :3100.
// - Loại test: unit trên guard của scripts/e2e/admin-gate-fixture.mjs; mock @supabase/supabase-js để chứng minh không tạo client (không có lời gọi ghi).
// - Case thành công: env cô lập hợp lệ được chấp nhận và tạo đúng một client; app loopback :3100 được chấp nhận.
// - Case thất bại: root dev :45321, URL hosted, thiếu/sai E2E_SUPABASE_WORKDIR, URL không hợp lệ, https, app không phải :3100 hay không phải loopback.
// - Bảo mật/phân quyền: cả prepare, revoke và remove đều từ chối trước khi tạo Supabase client.
// - Ghi chú: hành vi ghi thật được kiểm bằng smoke E2E admin-gate trên runtime cô lập.

const isolated = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:45441",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  E2E_SUPABASE_WORKDIR: ".e2e-runtime",
} as unknown as NodeJS.ProcessEnv;

const refused = [
  ["the root dev database :45321", { ...isolated, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:45321" }],
  ["a hosted URL", { ...isolated, NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co" }],
  ["https on the isolated port", { ...isolated, NEXT_PUBLIC_SUPABASE_URL: "https://127.0.0.1:45441" }],
  ["a non-loopback host on the isolated port", { ...isolated, NEXT_PUBLIC_SUPABASE_URL: "http://db.example.com:45441" }],
  ["a missing URL", { ...isolated, NEXT_PUBLIC_SUPABASE_URL: undefined }],
  ["a wrong workdir", { ...isolated, E2E_SUPABASE_WORKDIR: "supabase" }],
] as const;

beforeEach(() => {
  createClient.mockReset();
  createClient.mockReturnValue({});
});

describe.each(refused)("admin gate fixture against %s", (_label, env) => {
  it("refuses prepare, revoke and remove before creating any Supabase client", async () => {
    await expect(prepareRevocableAdmin(env as never)).rejects.toThrow(/isolated/);
    await expect(revokeAdminRole(env as never)).rejects.toThrow(/isolated/);
    await expect(removeRevocableAdmin(env as never)).rejects.toThrow(/isolated/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("refuses the production status check", () => {
    expect(() => assertIsolatedAdminGateTargets(env as never, "http://127.0.0.1:3100")).toThrow(/isolated/);
  });
});

describe("admin gate status check targets", () => {
  it("accepts the isolated runtime with the e2e app on loopback :3100", () => {
    expect(() => assertIsolatedAdminGateTargets(isolated, "http://127.0.0.1:3100")).not.toThrow();
    expect(() => assertIsolatedAdminGateTargets(isolated, "http://localhost:3100")).not.toThrow();
  });

  it.each(["http://127.0.0.1:3000", "https://vocaspace.example", "http://app.example.com:3100", "not a url"])(
    "refuses the app base URL %s",
    (baseURL) => {
      expect(() => assertIsolatedAdminGateTargets(isolated, baseURL)).toThrow();
    },
  );

  it("deletes the fixture user through the service-role client of the isolated runtime", async () => {
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    createClient.mockReturnValue({ auth: { admin: { deleteUser } } });

    await removeRevocableAdmin(isolated);

    expect(createClient).toHaveBeenCalledTimes(1);
    expect(deleteUser).toHaveBeenCalledTimes(1);
  });

  it("ignores only the user_not_found error of a user that was never created", async () => {
    const deleteUser = vi
      .fn()
      .mockResolvedValue({ error: { status: 404, code: "user_not_found", message: "User not found" } });
    createClient.mockReturnValue({ auth: { admin: { deleteUser } } });

    await expect(removeRevocableAdmin(isolated)).resolves.toBeUndefined();
  });

  it.each([
    ["a 500 whose message mentions not found", { status: 500, code: "unexpected_failure", message: "Required database object not found" }],
    ["a 404 without the user_not_found code", { status: 404, code: "not_found", message: "User not found" }],
    ["a 404 with no code", { status: 404, message: "User not found" }],
    ["a plain delete failure", { status: 500, code: "unexpected_failure", message: "database down" }],
  ])("fails the cleanup on %s", async (_label, error) => {
    const deleteUser = vi.fn().mockResolvedValue({ error });
    createClient.mockReturnValue({ auth: { admin: { deleteUser } } });

    await expect(removeRevocableAdmin(isolated)).rejects.toThrow(/Cannot delete the admin gate fixture user/);
  });
});
