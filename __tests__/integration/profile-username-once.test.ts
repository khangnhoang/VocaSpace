import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { updateUserProfile } from "@/app/actions/profile";

// Test plan:
// - Mục tiêu: bảo vệ luật "username chỉ đặt một lần" và việc lưu hồ sơ với dob/gender trống trên DB thật (A3).
// - Loại test: integration — Server Action + Auth + PostgREST + RLS + PostgreSQL local thật.
// - Đối tượng: updateUserProfile.
// - Case thành công: user null-username đặt username + lưu dob/gender trống thành null; để trống username thì vẫn
//   lưu các trường khác; user đã có username lưu trường khác và bỏ qua username gửi lên; request đến muộn sau khi
//   username được đặt đi nhánh không đặt.
// - Case thất bại: username trùng user khác không đổi trường nào; hai lần đặt song song (barrier sau bước đọc)
//   chỉ một bên ghi, bên thua nhận thông báo tải lại và dòng không đổi; profile có removed_at nhận lỗi hệ thống và
//   không đổi.
// - Bảo mật/phân quyền: payload tự chế đổi username đã có không có hiệu lực; chỉ dòng của chính user bị ghi (RLS).
// - Ổn định/resilience: hai request cùng đọc username = null trước khi cả hai cùng UPDATE.
// - Invariant cần giữ: username đã có không bao giờ bị action đổi; mỗi lần ghi hoặc đủ mọi trường hoặc không trường nào.
// - Kết quả verify gần nhất: passed bằng `ALLOW_DB_INTEGRATION_TESTS=true npm run test:integration -- profile-username-once`.
// - Ghi chú: không kiểm chặn đổi username qua Data API trực tiếp (giới hạn G7 của master plan, cần migration).

// Chỉ thay adapter cookies của Next.js bằng client phiên thật; mọi truy vấn, RLS và UPDATE chạy trên stack local.
const sessionBoundary = vi.hoisted(() => ({ clients: [] as unknown[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => sessionBoundary.clients.shift()!,
}));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const createdUserIds = new Set<string>();

function client(key = SUPABASE_ANON_KEY) {
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

const service = client(SUPABASE_SERVICE_ROLE_KEY);

interface TestUser {
  id: string;
  email: string;
  password: string;
}

// Giống user Google/admin tạo: không có metadata username/dob/gender nên profile có username null.
async function createUser(metadata: Record<string, unknown> = {}): Promise<TestUser> {
  const email = `a3-profile-${randomUUID()}@example.com`;
  const password = `${randomUUID()}aA1!`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Người Dùng A3", ...metadata },
    app_metadata: { d7_server_created: true },
  });
  expect(error).toBeNull();
  createdUserIds.add(data.user!.id);
  return { id: data.user!.id, email, password };
}

async function signIn(user: TestUser): Promise<SupabaseClient> {
  const session = client();
  expect((await session.auth.signInWithPassword({ email: user.email, password: user.password })).error).toBeNull();
  return session;
}

async function readProfile(id: string) {
  const { data, error } = await service
    .from("profiles")
    .select("full_name, username, dob, gender, removed_at, updated_at")
    .eq("id", id)
    .single();
  expect(error).toBeNull();
  return data!;
}

// Chạy action bằng phiên của user; `barrier` (nếu có) chặn ngay sau bước đọc username để hai request cùng đọc null.
async function saveAs(session: SupabaseClient, input: unknown, barrier?: () => Promise<void>) {
  sessionBoundary.clients.push(barrier ? withBarrierAfterUsernameRead(session, barrier) : session);
  return updateUserProfile(input);
}

function withBarrierAfterUsernameRead(session: SupabaseClient, barrier: () => Promise<void>) {
  return {
    auth: session.auth,
    from: (table: string) => {
      const query = session.from(table);
      return {
        update: query.update.bind(query),
        select: (columns: string) => ({
          eq: (column: string, value: string) => ({
            single: async () => {
              const result = await query.select(columns).eq(column, value).single();
              if (columns === "username") await barrier();
              return result;
            },
          }),
        }),
      };
    },
  };
}

function makeBarrier(parties: number) {
  let arrived = 0;
  let release!: () => void;
  const opened = new Promise<void>((resolve) => (release = resolve));
  return async () => {
    arrived += 1;
    if (arrived === parties) release();
    await opened;
  };
}

const uniqueName = (prefix: string) => `${prefix}_${randomUUID().slice(0, 8)}`;

beforeAll(() => {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error("Chan test DB integration. Set ALLOW_DB_INTEGRATION_TESTS=true cho stack local.");
  }
  if (!["127.0.0.1", "localhost"].includes(new URL(SUPABASE_URL).hostname)) {
    throw new Error("Chan test DB integration vi URL khong phai local.");
  }
});

afterAll(async () => {
  for (const id of createdUserIds) {
    const { error } = await service.auth.admin.deleteUser(id);
    expect(error).toBeNull();
  }
});

describe("updateUserProfile on a real database", () => {
  it("sets the first username and stores blank dob and gender as null for a user without a username", async () => {
    const user = await createUser();
    const username = uniqueName("first");
    expect((await readProfile(user.id)).username).toBeNull();

    const result = await saveAs(await signIn(user), { full_name: "Tên Mới", username, dob: "", gender: "" });

    expect(result).toEqual({ success: true });
    expect(await readProfile(user.id)).toMatchObject({ full_name: "Tên Mới", username, dob: null, gender: null });
  });

  it("saves other fields and keeps the username null when a null-username user leaves it blank", async () => {
    const user = await createUser();

    const result = await saveAs(await signIn(user), {
      full_name: "Tên Khác",
      username: "   ",
      dob: "2000-01-31",
      gender: "female",
    });

    expect(result).toEqual({ success: true });
    expect(await readProfile(user.id)).toMatchObject({
      full_name: "Tên Khác",
      username: null,
      dob: "2000-01-31",
      gender: "female",
    });
  });

  it("ignores a different username for a user who already has one and still saves other fields", async () => {
    const existing = uniqueName("keep");
    const user = await createUser({ username: existing });
    const session = await signIn(user);

    const crafted = await saveAs(session, {
      full_name: "Đã Có Username",
      username: uniqueName("hijack"),
      dob: "1999-12-31",
      gender: "male",
    });
    expect(crafted).toEqual({ success: true });
    expect(await readProfile(user.id)).toMatchObject({
      full_name: "Đã Có Username",
      username: existing,
      dob: "1999-12-31",
      gender: "male",
    });

    // Gửi username trống cũng không xóa username đã có.
    expect(await saveAs(session, { full_name: "Đã Có Username", username: "", dob: "", gender: "" })).toEqual({
      success: true,
    });
    expect(await readProfile(user.id)).toMatchObject({ username: existing, dob: null, gender: null });
  });

  it("takes the non-set branch for a request that arrives after the username was set", async () => {
    const user = await createUser();
    const session = await signIn(user);
    const winner = uniqueName("early");

    expect(await saveAs(session, { full_name: "Lần Một", username: winner })).toEqual({ success: true });
    expect(await saveAs(session, { full_name: "Lần Hai", username: uniqueName("late") })).toEqual({ success: true });

    expect(await readProfile(user.id)).toMatchObject({ full_name: "Lần Hai", username: winner });
  });

  it("rejects a username another profile uses and changes no field of the caller", async () => {
    const taken = uniqueName("taken");
    await createUser({ username: taken });
    const user = await createUser();
    const before = await readProfile(user.id);

    const result = await saveAs(await signIn(user), {
      full_name: "Không Được Lưu",
      username: taken,
      dob: "2001-02-03",
      gender: "other",
    });

    expect(result).toEqual({ error: "Tên người dùng (Username) đã tồn tại!" });
    expect(await readProfile(user.id)).toEqual(before);
  });

  it("lets exactly one of two concurrent first-username saves write and leaves the loser's fields out", async () => {
    const user = await createUser();
    const sessionA = await signIn(user);
    const sessionB = await signIn(user);
    const requestA = { full_name: "Bên A", username: uniqueName("raceA"), dob: "2000-01-01", gender: "male" };
    const requestB = { full_name: "Bên B", username: uniqueName("raceB"), dob: "2002-02-02", gender: "female" };
    const barrier = makeBarrier(2);

    // Cả hai gọi createClient đồng bộ theo thứ tự đẩy vào hàng đợi, rồi cùng đọc null trước khi bên nào UPDATE.
    const [resultA, resultB] = await Promise.all([
      saveAs(sessionA, requestA, barrier),
      saveAs(sessionB, requestB, barrier),
    ]);

    const results = [resultA, resultB];
    expect(results.filter((r) => "success" in r)).toHaveLength(1);
    expect(results.filter((r) => "error" in r)).toEqual([
      { error: "Username đã được thiết lập, vui lòng tải lại trang." },
    ]);
    const winner = "success" in resultA ? requestA : requestB;
    expect(await readProfile(user.id)).toMatchObject({
      full_name: winner.full_name,
      username: winner.username,
      dob: winner.dob,
      gender: winner.gender,
    });
  });

  it("returns the system error and changes nothing when the profile row is hidden by removed_at", async () => {
    const user = await createUser();
    const session = await signIn(user);
    const removedAt = new Date().toISOString();
    expect((await service.from("profiles").update({ removed_at: removedAt }).eq("id", user.id)).error).toBeNull();
    const before = await readProfile(user.id);

    const withUsername = await saveAs(session, { full_name: "Đã Xóa", username: uniqueName("gone") });
    const withoutUsername = await saveAs(session, { full_name: "Đã Xóa", username: "" });

    expect(withUsername).toEqual({ error: "Lỗi hệ thống khi cập nhật hồ sơ." });
    expect(withoutUsername).toEqual({ error: "Lỗi hệ thống khi cập nhật hồ sơ." });
    expect(await readProfile(user.id)).toEqual(before);
  });
});
