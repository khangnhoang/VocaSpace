import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { getUserProfile } from "@/app/actions/profile";
import { getActiveProfileEmails } from "@/lib/supabase/profile-emails";
import { getAllUsers } from "@/app/actions/user";
import { getAdminDashboardData } from "@/app/actions/admin-dashboard";
import {
  getCourseCollaboratorMembers,
  getCourseCollaboratorOverview,
} from "@/app/actions/course-collaborator";

// Test plan:
// - Mục tiêu: bảo vệ AUTH-019 (A4a) — không ai đọc được email/phone/dob/gender của `profiles` qua Data API,
//   trong khi các cột công khai, đường đọc của chính user và tra email bằng service role vẫn chạy.
// - Loại test: integration — PostgREST + RLS + quyền cột PostgreSQL local thật; Server Action với phiên thật.
// - Đối tượng: migration `20261005100000_a4a_profiles_private_columns`, getUserProfile, getActiveProfileEmails,
//   getAllUsers, getAdminDashboardData, getCourseCollaboratorOverview, getCourseCollaboratorMembers.
// - Case thành công: anon và user đăng nhập đọc được 8 cột công khai; getUserProfile trả đủ trường riêng tư của
//   chính mình; getActiveProfileEmails trả email cho id đang hoạt động; RPC catalog công khai và đọc `courses`
//   (policy có tra `profiles`) vẫn chạy cho anon và user thường; admin thật thấy email/phone trong danh sách user
//   và email ở lượt ghi danh gần đây (của chính admin, do RLS `enrollments`); chủ khoá học thấy email cộng tác viên đang hoạt động.
// - Case thất bại: chọn hoặc lọc theo từng cột riêng tư, và `select=*`, đều bị từ chối với mã `42501`
//   (không phải 0 dòng) cho anon, cho user đọc hồ sơ người khác và cho chính dòng của mình.
// - Bảo mật/phân quyền: hồ sơ đã xoá mềm không có email trong kết quả service role, getUserProfile của user đó
//   vẫn báo không tìm thấy, và không xuất hiện (cũng không lộ email) trong danh sách user của admin hay
//   danh sách cộng tác viên.
// - Ổn định/resilience: không áp dụng.
// - Invariant cần giữ: quyền SELECT của anon/authenticated trên `profiles` chỉ gồm id, username, full_name,
//   avatar_url, role, created_at, updated_at, removed_at.
// - Kết quả verify gần nhất: passed bằng `ALLOW_DB_INTEGRATION_TESTS=true npm run test:integration -- profile-private-columns` (A4a CP1).
// - Ghi chú: dùng GET (không HEAD) vì response HEAD không có body nên SDK không có mã lỗi để kiểm.

// Chỉ thay adapter cookies của Next.js bằng client phiên thật; service role đọc stack local thật.
const sessionBoundary = vi.hoisted(() => ({ clients: [] as unknown[] }));
vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => sessionBoundary.clients.shift()!,
}));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PRIVATE_COLUMNS = ["email", "phone", "dob", "gender"] as const;
const PUBLIC_COLUMNS = "id, username, full_name, avatar_url, role, created_at, updated_at, removed_at";
const createdUserIds = new Set<string>();
const createdCourseIds = new Set<string>();

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

async function createUser(fullName = "Người Dùng A4a"): Promise<TestUser> {
  const email = `a4a-private-${randomUUID()}@example.com`;
  const password = `${randomUUID()}aA1!`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      username: `a4a_${randomUUID().slice(0, 8)}`,
      phone: "0900000000",
      dob: "2000-01-01",
      gender: "male",
    },
    app_metadata: { d7_server_created: true },
  });
  expect(error).toBeNull();
  createdUserIds.add(data.user!.id);
  // Đảm bảo cả 4 cột riêng tư có giá trị để phép lọc `not.is.null` có dòng để lộ nếu quyền còn mở.
  expect(
    (await service.from("profiles").update({ phone: "0900000000", dob: "2000-01-01", gender: "male" }).eq("id", data.user!.id)).error,
  ).toBeNull();
  return { id: data.user!.id, email, password };
}

async function signIn(user: TestUser): Promise<SupabaseClient> {
  const session = client();
  expect((await session.auth.signInWithPassword({ email: user.email, password: user.password })).error).toBeNull();
  return session;
}

async function softDelete(user: TestUser) {
  expect(
    (await service.from("profiles").update({ removed_at: new Date().toISOString() }).eq("id", user.id)).error,
  ).toBeNull();
}

async function createAdmin(): Promise<TestUser> {
  const admin = await createUser("Quản Trị A4a");
  expect((await service.from("profiles").update({ role: "admin" }).eq("id", admin.id)).error).toBeNull();
  return admin;
}

async function createCourse(ownerId: string): Promise<string> {
  const { data, error } = await service.from("courses").insert({
    title: `A4a private columns ${randomUUID()}`,
    slug: `a4a-private-${randomUUID()}`,
    description: "A4a private profile columns integration fixture",
    status: "draft",
    price: 0,
  }).select("id").single();
  expect(error).toBeNull();
  createdCourseIds.add(data!.id);
  expect((await service.from("course_collaborators").insert({
    course_id: data!.id,
    user_id: ownerId,
    role: "owner",
    added_by: ownerId,
    can_review_topics: false,
  })).error).toBeNull();
  return data!.id as string;
}

async function expectPrivateColumnsDenied(reader: SupabaseClient, targetId: string) {
  for (const column of PRIVATE_COLUMNS) {
    const selected = await reader.from("profiles").select(column).eq("id", targetId);
    expect(selected.error?.code, `select ${column}`).toBe("42501");
    expect(selected.data).toBeNull();

    const filtered = await reader.from("profiles").select("id").eq("id", targetId).not(column, "is", null);
    expect(filtered.error?.code, `filter ${column}`).toBe("42501");
    expect(filtered.data).toBeNull();
  }

  const all = await reader.from("profiles").select("*").eq("id", targetId);
  expect(all.error?.code, "select *").toBe("42501");
}

async function expectPublicColumnsReadable(reader: SupabaseClient, target: TestUser) {
  const { data, error } = await reader.from("profiles").select(PUBLIC_COLUMNS).eq("id", target.id).single();
  expect(error).toBeNull();
  expect(data).toMatchObject({ id: target.id, full_name: "Người Dùng A4a", role: "student", removed_at: null });
}

let owner: TestUser;
let other: TestUser;

beforeAll(async () => {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error("Chan test DB integration. Set ALLOW_DB_INTEGRATION_TESTS=true cho stack local.");
  }
  if (!["127.0.0.1", "localhost"].includes(new URL(SUPABASE_URL).hostname)) {
    throw new Error("Chan test DB integration vi URL khong phai local.");
  }
  owner = await createUser();
  other = await createUser();
});

afterAll(async () => {
  if (createdCourseIds.size > 0) {
    expect((await service.from("enrollments").delete().in("course_id", [...createdCourseIds])).error).toBeNull();
    expect((await service.from("courses").delete().in("id", [...createdCourseIds])).error).toBeNull();
  }
  for (const id of createdUserIds) {
    const { error } = await service.auth.admin.deleteUser(id);
    expect(error).toBeNull();
  }
});

describe("profiles private columns on a real database", () => {
  it("refuses every private column to a signed-out visitor, as a select and as a filter", async () => {
    const anon = client();

    await expectPrivateColumnsDenied(anon, other.id);
    await expectPublicColumnsReadable(anon, other);
  });

  it("refuses every private column to a signed-in user for another user's row and for their own row", async () => {
    const session = await signIn(owner);

    await expectPrivateColumnsDenied(session, other.id);
    await expectPrivateColumnsDenied(session, owner.id);
    await expectPublicColumnsReadable(session, other);
  });

  it("still returns the signed-in user's own private fields through getUserProfile", async () => {
    sessionBoundary.clients.push(await signIn(owner));

    const result = await getUserProfile();

    expect(result).toEqual({
      data: expect.objectContaining({
        id: owner.id,
        email: owner.email,
        phone: "0900000000",
        dob: "2000-01-01",
        gender: "male",
      }),
    });
  });

  it("looks up emails only for active profiles through the service role", async () => {
    const removed = await createUser();
    const removedSession = await signIn(removed);
    expect(
      (await service.from("profiles").update({ removed_at: new Date().toISOString() }).eq("id", removed.id)).error,
    ).toBeNull();

    const emails = await getActiveProfileEmails([owner.id, other.id, removed.id]);

    expect(emails).toEqual(new Map([[owner.id, owner.email], [other.id, other.email]]));

    sessionBoundary.clients.push(removedSession);
    expect(await getUserProfile()).toEqual({ error: "Không tìm thấy hồ sơ người dùng" });
  });

  it("keeps public course reads that depend on profiles working for anon and signed-in users", async () => {
    const anon = client();
    const session = await signIn(owner);

    for (const reader of [anon, session]) {
      expect((await reader.rpc("get_public_course_catalog")).error).toBeNull();
      expect((await reader.from("courses").select("id").limit(1)).error).toBeNull();
    }
  });

  it("shows private fields of active profiles to a real admin in the user list and recent enrollments", async () => {
    const admin = await createAdmin();
    const student = await createUser();
    const removedStudent = await createUser();
    await softDelete(removedStudent);

    sessionBoundary.clients.push(await signIn(admin));
    const users = await getAllUsers();

    expect(users.error).toBeUndefined();
    expect(users.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: student.id, email: student.email, phone: "0900000000" }),
    ]));
    expect(users.data!.some((row) => row.id === removedStudent.id)).toBe(false);

    // RLS hiện tại của `enrollments` chỉ cho mỗi người đọc lượt ghi danh của chính mình (kể cả admin),
    // nên lượt ghi danh dùng để kiểm email là của chính admin.
    const courseId = await createCourse(admin.id);
    expect((await service.from("enrollments").insert({ user_id: admin.id, course_id: courseId })).error).toBeNull();

    sessionBoundary.clients.push(await signIn(admin));
    const dashboard = await getAdminDashboardData();

    expect(dashboard.error).toBeUndefined();
    expect(dashboard.data!.recentEnrollments).toEqual(expect.arrayContaining([
      expect.objectContaining({ studentName: "Quản Trị A4a", studentEmail: admin.email }),
    ]));
  });

  it("lists only active collaborators with their emails to a course owner", async () => {
    const courseOwner = await createUser("Chủ Khoá A4a");
    const activeMember = await createUser("Cộng Tác A4a");
    const removedMember = await createUser("Cộng Tác Đã Xoá A4a");
    const courseId = await createCourse(courseOwner.id);
    for (const member of [activeMember, removedMember]) {
      expect((await service.from("course_collaborators").insert({
        course_id: courseId,
        user_id: member.id,
        role: "editor",
        added_by: courseOwner.id,
        can_review_topics: false,
      })).error).toBeNull();
    }
    await softDelete(removedMember);

    sessionBoundary.clients.push(await signIn(courseOwner));
    const overview = await getCourseCollaboratorOverview({ courseId });
    sessionBoundary.clients.push(await signIn(courseOwner));
    const members = await getCourseCollaboratorMembers({ courseId });

    const expectedRows = [
      expect.objectContaining({ userId: courseOwner.id, email: courseOwner.email }),
      expect.objectContaining({ userId: activeMember.id, email: activeMember.email }),
    ];
    expect(overview).toEqual({ data: expectedRows });
    expect(members).toEqual({ data: expect.objectContaining({ members: expectedRows }) });
  });
});
