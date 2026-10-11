import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Test plan:
// - Mục tiêu: helper cổng database local chỉ chấp nhận hai runtime đã biết và `runLocalPsql` không spawn psql cho đích lạ.
// - Loại test: unit (spawnSync được mock; không có kết nối database nào).
// - Đối tượng: resolveLocalDatabasePort, runLocalPsql.
// - Case thành công: API 45321 -> DB 45322, API 45441 -> DB 45442 (127.0.0.1 và localhost); runLocalPsql truyền đúng cổng cho psql.
// - Case thất bại: cổng lạ (kể cả cổng DB 45322), host không phải loopback, giao thức https, URL hỏng, URL không cổng đều ném lỗi;
//   với đích bị từ chối, spawnSync không được gọi lần nào.
// - Bảo mật/phân quyền: không áp dụng.
// - Ổn định/resilience: khi NEXT_PUBLIC_SUPABASE_URL chưa đặt, mapping rơi về runtime gốc như `local-postgres-coordination.ts` đã làm.
// - Invariant cần giữ: một mapping duy nhất cho cả hai helper; đích lạ không bao giờ chạm tới database.
// - Kết quả verify gần nhất: passed bằng `npx vitest run __tests__/utils/local-database-port.test.ts`.
// - Ghi chú: không cần psql thật vì spawnSync bị thay.

const spawnSync = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawnSync, spawn: vi.fn() }));

import { resolveLocalDatabasePort } from "../integration/helpers/local-database-port";
import { runLocalPsql } from "../integration/helpers/local-psql";

describe("resolveLocalDatabasePort", () => {
  it.each([
    ["http://127.0.0.1:45321", "45322"],
    ["http://127.0.0.1:45441", "45442"],
    ["http://localhost:45321", "45322"],
    ["http://localhost:45441/", "45442"],
  ])("maps the API %s to database port %s", (apiUrl, databasePort) => {
    expect(resolveLocalDatabasePort(apiUrl)).toBe(databasePort);
  });

  it.each([
    ["an unknown API port", "http://127.0.0.1:54321"],
    ["a database port used as API port", "http://127.0.0.1:45322"],
    ["a missing port", "http://127.0.0.1"],
    ["a non-loopback host", "http://example.com:45441"],
    ["a LAN address", "http://192.168.1.10:45321"],
    ["the https protocol", "https://127.0.0.1:45441"],
    ["a malformed URL", "not a url"],
    ["an empty URL", ""],
  ])("rejects %s", (_name, apiUrl) => {
    expect(() => resolveLocalDatabasePort(apiUrl)).toThrow(/local Supabase/);
  });
});

describe("resolveLocalDatabasePort default", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to the root runtime when NEXT_PUBLIC_SUPABASE_URL is not set, as the coordination helper did", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    expect(resolveLocalDatabasePort()).toBe("45322");
  });
});

describe("runLocalPsql target", () => {
  beforeEach(() => {
    spawnSync.mockReset();
    spawnSync.mockReturnValue({ status: 0, stdout: " ok \n", stderr: "" });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends the SQL to the database of the isolated runtime", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:45441");
    expect(runLocalPsql("select 1")).toBe("ok");
    const [command, args, options] = spawnSync.mock.calls[0];
    expect(command).toBe("psql");
    expect(args.slice(args.indexOf("-p"), args.indexOf("-p") + 2)).toEqual(["-p", "45442"]);
    expect(options.input).toBe("select 1");
  });

  it("sends the SQL to the root database when the API is the root runtime", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:45321");
    runLocalPsql("select 1");
    const args = spawnSync.mock.calls[0][1];
    expect(args[args.indexOf("-p") + 1]).toBe("45322");
  });

  it.each([
    ["an unknown port", "http://127.0.0.1:54321"],
    ["a non-loopback host", "http://example.com:45441"],
    ["the https protocol", "https://127.0.0.1:45441"],
    ["a malformed URL", "::::"],
  ])("never spawns psql for %s", (_name, apiUrl) => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", apiUrl);
    expect(() => runLocalPsql("delete from profiles")).toThrow(/local Supabase/);
    expect(spawnSync).not.toHaveBeenCalled();
  });
});
