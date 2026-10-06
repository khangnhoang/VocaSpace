import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { getAdminDashboardData } from "@/app/actions/admin-dashboard";
import { updateUserProfile, uploadAvatar } from "@/app/actions/profile";
import { updateUserByAdmin } from "@/app/actions/user";
import {
  createLearningTree,
  deleteLearningTree,
  seedLearnerRows,
  type LearningTree,
} from "./helpers/a5-learning-fixture";

// Test plan:
// - Mục tiêu: bảo vệ AUTH-021 (admin đọc enrollments/user_flashcards của mọi học viên) và AUTH-020 (user chỉ sửa
//   đúng các cột hồ sơ mà /profile dùng, profiles.email bám auth.users.email) trên database thật (A5 CP2).
// - Loại test: integration — PostgREST + RLS + quyền cột + trigger PostgreSQL local thật; Server Action với phiên thật.
// - Đối tượng: policy "Enrollments - Active Admin Select", "User_flashcards - Active Admin Select", quyền UPDATE theo cột
//   của profiles, trigger a5_sync_profile_email, getAdminDashboardData, updateUserProfile, uploadAvatar, updateUserByAdmin.
// - Case thành công: admin đang hoạt động thấy enrollment/flashcard của học viên khác; dashboard liệt kê lượt ghi danh
//   của học viên khác và đếm flashcard bằng đúng tổng service role; học viên xóa mềm vẫn hiện là "Học viên ẩn danh";
//   user vẫn lưu /profile, đặt username một lần, tải avatar, và tự đặt avatar_url; admin vẫn sửa phone qua service role;
//   đổi email qua Auth admin API làm profiles.email đổi theo và không đụng hồ sơ khác; tạo user giữ hai email bằng nhau.
// - Case thất bại: user UPDATE email, phone hoặc removed_at qua REST → 42501 và dòng không đổi, kể cả khi gửi chung với
//   cột hợp lệ.
// - Bảo mật/phân quyền: học viên thường và admin có removed_at chỉ thấy dữ liệu của chính mình; học viên không đọc được
//   hàng của người khác.
// - Ổn định/resilience: cập nhật auth.users không đổi email (đổi metadata) không làm hồ sơ đổi updated_at.
// - Invariant cần giữ: authenticated chỉ còn quyền UPDATE sáu cột username, full_name, avatar_url, dob, gender, updated_at.
// - Kết quả verify gần nhất: xem milestone A5 CP2 trong progress.md (`ALLOW_DB_INTEGRATION_TESTS=true npm run test:integration -- a5-admin-reads-and-profile-owner`).
// - Ghi chú: dùng GET (không HEAD) khi cần mã lỗi; quyền cột kiểm qua has_column_privilege trong R3 production, không ở đây.

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
const trees: LearningTree[] = [];

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

async function createUser(
  { role = "student", fullName = "Người Dùng A5", metadata = {} }: { role?: string; fullName?: string; metadata?: Record<string, unknown> } = {},
): Promise<TestUser> {
  const email = `a5-reads-${randomUUID()}@example.com`;
  const password = `${randomUUID()}aA1!`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, ...metadata },
    app_metadata: { d7_server_created: true },
  });
  expect(error).toBeNull();
  createdUserIds.add(data.user!.id);
  if (role !== "student") {
    expect((await service.from("profiles").update({ role }).eq("id", data.user!.id)).error).toBeNull();
  }
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
    .select("email, phone, full_name, username, avatar_url, gender, removed_at, updated_at")
    .eq("id", id)
    .single();
  expect(error).toBeNull();
  return data!;
}

async function newTree() {
  const tree = await createLearningTree(service);
  trees.push(tree);
  return tree;
}

beforeAll(() => {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error("Chan test DB integration. Set ALLOW_DB_INTEGRATION_TESTS=true cho stack local.");
  }
  if (!["127.0.0.1", "localhost"].includes(new URL(SUPABASE_URL).hostname)) {
    throw new Error("Chan test DB integration vi URL khong phai local.");
  }
});

afterAll(async () => {
  for (const tree of trees) await deleteLearningTree(service, tree);
  for (const id of createdUserIds) {
    const { error } = await service.auth.admin.deleteUser(id);
    expect(error).toBeNull();
  }
});

describe("AUTH-021 admin reads of learner rows", () => {
  it("lets an active admin read another learner's enrollment and flashcard, and no one else but that learner", async () => {
    const tree = await newTree();
    const learner = await createUser();
    const stranger = await createUser();
    const admin = await createUser({ role: "admin" });
    await seedLearnerRows(service, learner.id, tree);

    for (const table of ["enrollments", "user_flashcards"] as const) {
      const asAdmin = await (await signIn(admin)).from(table).select("user_id").eq("user_id", learner.id);
      expect(asAdmin.error, `${table} as admin`).toBeNull();
      expect(asAdmin.data, `${table} as admin`).toEqual([{ user_id: learner.id }]);

      const asLearner = await (await signIn(learner)).from(table).select("user_id").eq("user_id", learner.id);
      expect(asLearner.data, `${table} as the learner`).toEqual([{ user_id: learner.id }]);

      const asStranger = await (await signIn(stranger)).from(table).select("user_id").eq("user_id", learner.id);
      expect(asStranger.error, `${table} as another student`).toBeNull();
      expect(asStranger.data, `${table} as another student`).toEqual([]);
    }
  });

  it("does not extend the admin read to a teacher or to an admin whose profile is soft-deleted", async () => {
    const tree = await newTree();
    const learner = await createUser();
    const teacher = await createUser({ role: "teacher" });
    const removedAdmin = await createUser({ role: "admin" });
    await seedLearnerRows(service, learner.id, tree);
    expect((await service.from("profiles").update({ removed_at: new Date().toISOString() }).eq("id", removedAdmin.id)).error).toBeNull();

    for (const actor of [teacher, removedAdmin]) {
      const session = await signIn(actor);
      for (const table of ["enrollments", "user_flashcards"] as const) {
        const result = await session.from(table).select("user_id").eq("user_id", learner.id);
        expect(result.error, `${table} as ${actor.id}`).toBeNull();
        expect(result.data, `${table} as ${actor.id}`).toEqual([]);
      }
    }
  });

  it("makes the admin dashboard count other learners' flashcards and list their recent enrollments", async () => {
    const tree = await newTree();
    const learner = await createUser({ fullName: `Học viên A5 ${randomUUID().slice(0, 8)}` });
    const admin = await createUser({ role: "admin" });
    await seedLearnerRows(service, learner.id, tree);
    const flashcards = await service.from("user_flashcards").select("id", { count: "exact", head: true });
    expect(flashcards.error).toBeNull();

    sessionBoundary.clients.push(await signIn(admin));
    const dashboard = await getAdminDashboardData();

    expect(dashboard.error).toBeUndefined();
    expect(dashboard.data!.metrics.totalFlashcardReviews).toBe(flashcards.count);
    expect(dashboard.data!.recentEnrollments).toEqual(expect.arrayContaining([
      expect.objectContaining({ studentEmail: learner.email, courseTitle: expect.stringContaining("A5 fixture") }),
    ]));
  });

  it("counts enrollments of every learner per course and still shows a soft-deleted learner as a missing learner", async () => {
    const tree = await newTree();
    const removedLearner = await createUser();
    const admin = await createUser({ role: "admin" });
    await seedLearnerRows(service, removedLearner.id, tree);
    expect((await service.from("profiles").update({ removed_at: new Date().toISOString() }).eq("id", removedLearner.id)).error).toBeNull();

    sessionBoundary.clients.push(await signIn(admin));
    const dashboard = await getAdminDashboardData();

    expect(dashboard.error).toBeUndefined();
    // Học viên xóa mềm vẫn được đếm trong enrollment nhưng hiển thị như học viên không còn hồ sơ (A4a AC6b).
    expect(dashboard.data!.recentEnrollments).toEqual(expect.arrayContaining([
      expect.objectContaining({ studentName: "Học viên ẩn danh", studentEmail: "no-email@vocaspace.com" }),
    ]));
    const adminSession = await signIn(admin);
    const perCourse = await adminSession.from("courses").select("id, enrollments(id)").eq("id", tree.courseId).single();
    expect(perCourse.error).toBeNull();
    expect(perCourse.data!.enrollments).toHaveLength(1);
  });
});

describe("AUTH-020 profile column grants and email sync", () => {
  it.each([
    ["email", { email: "attacker@example.com" }],
    ["phone", { phone: "0999999999" }],
    ["removed_at", { removed_at: new Date().toISOString() }],
    ["email together with a column /profile may write", { full_name: "Đã Bị Đổi", email: "attacker@example.com" }],
  ])("refuses a signed-in user's own UPDATE of %s with 42501 and leaves the row unchanged", async (_label, patch) => {
    const user = await createUser({ metadata: { phone: "0900000000" } });
    const before = await readProfile(user.id);
    const session = await signIn(user);

    // Không chain `.select()`: RETURNING trên dòng đã xóa mềm tự bị RLS chặn và che mất việc quyền cột có thật sự từ chối.
    const result = await session.from("profiles").update(patch).eq("id", user.id);

    expect(result.error?.code).toBe("42501");
    // Phải là từ chối quyền cột; riêng removed_at còn bị RLS (SELECT policy trên dòng mới) chặn với cùng mã 42501.
    expect(result.error?.message).toContain("permission denied");
    expect(await readProfile(user.id)).toEqual(before);
  });

  it("still lets the user save /profile, set the username once, set avatar_url and upload an avatar", async () => {
    const user = await createUser();
    const session = await signIn(user);

    sessionBoundary.clients.push(session);
    const saved = await updateUserProfile({
      full_name: "Nguyễn Văn A5",
      username: `a5_${randomUUID().slice(0, 8)}`,
      dob: "2000-01-01",
      gender: "male",
    });
    expect(saved).toEqual({ success: true });
    expect(await readProfile(user.id)).toMatchObject({ full_name: "Nguyễn Văn A5", gender: "male" });

    const own = await session.from("profiles").update({ avatar_url: "https://example.com/own.png" }).eq("id", user.id).select("id");
    expect(own.error).toBeNull();
    expect(own.data).toHaveLength(1);

    const form = new FormData();
    form.set("avatar", new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" }));
    sessionBoundary.clients.push(session);
    const uploaded = await uploadAvatar(form);
    expect(uploaded).toMatchObject({ success: true });
    const objects = await service.from("profiles").select("avatar_url").eq("id", user.id).single();
    expect(objects.data!.avatar_url).toContain(user.id);
  });

  it("still lets an admin change another user's phone through the service-role action", async () => {
    const admin = await createUser({ role: "admin" });
    const target = await createUser({ metadata: { username: `a5_${randomUUID().slice(0, 8)}` } });
    const before = await readProfile(target.id);

    sessionBoundary.clients.push(await signIn(admin));
    const result = await updateUserByAdmin(target.id, {
      email: target.email,
      username: before.username ?? `a5_${randomUUID().slice(0, 8)}`,
      full_name: "Người Dùng A5",
      phone: "0987654321",
      role: "student",
    });

    expect(result).toEqual({ success: true, message: "Cập nhật thành công!" });
    expect((await readProfile(target.id)).phone).toBe("0987654321");
  });

  it("keeps profiles.email equal to auth.users.email after creation and after an Auth email change", async () => {
    const user = await createUser();
    const bystander = await createUser();
    const bystanderBefore = await readProfile(bystander.id);
    expect((await readProfile(user.id)).email).toBe(user.email);

    const changed = `a5-changed-${randomUUID()}@example.com`;
    const updated = await service.auth.admin.updateUserById(user.id, { email: changed, email_confirm: true });
    expect(updated.error).toBeNull();

    expect((await readProfile(user.id)).email).toBe(changed);
    expect(await readProfile(bystander.id)).toEqual(bystanderBefore);
    // Đăng nhập bằng email mới vẫn chạy: trigger không chặn ghi của GoTrue.
    expect((await client().auth.signInWithPassword({ email: changed, password: user.password })).error).toBeNull();
  });

  it("does not touch the profile when an Auth update leaves the email unchanged", async () => {
    const user = await createUser();
    const before = await readProfile(user.id);

    const updated = await service.auth.admin.updateUserById(user.id, { user_metadata: { note: "x" } });
    expect(updated.error).toBeNull();

    expect(await readProfile(user.id)).toEqual(before);
  });
});
