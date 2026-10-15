import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { updateUserByAdmin } from "@/app/actions/user";
import { createLearningTree, deleteLearningTree, type LearningTree, SEED_TEACHER_ID } from "./helpers/a5-learning-fixture";

// Test plan:
// - Mục tiêu: AD7 mất đặc quyền admin sau removed_at, không phụ thuộc JWT hết hạn; self-edit không tự hạ role.
// - Loại test: integration, PostgreSQL/PostgREST/RLS/Storage thật và action với session thật.
// - Đối tượng: is_admin, can_view_course_basic, has_course_content_read_access, moderate_platform_content,
//   policies payments/discounts/thumbnail/media và updateUserByAdmin.
// - Case thành công: admin active, tác giả/member và uploader hợp lệ giữ quyền; tự sửa cùng role, sửa role người khác.
// - Case thất bại: removed admin còn JWT, student/teacher/anon/missing profile không có admin override;
//   moderation bị từ chối không đổi dữ liệu, xóa object bị từ chối vẫn giữ file.
// - Bảo mật/phân quyền: service chỉ dựng fixture/readback/cleanup; Next cookie adapter trả client đã đăng nhập thật.
// - Ổn định/resilience: UUID khác letter case không vượt self guard; cleanup không sửa tài khoản seed.
// - Invariant cần giữ: không mở lại quyền ghi role/removed_at trực tiếp; ordinary membership không bị thay đổi.
// - Kết quả verify gần nhất: passed (14 test) trên 45441; ALLOW_DB_INTEGRATION_TESTS=true npm run test:integration -- ad7-admin-hardening.

const boundary = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({ createClient: async () => boundary.client }));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
const users: string[] = [];
const trees: LearningTree[] = [];
const objects: Array<{ bucket: string; name: string }> = [];
type Actor = { id: string; client: SupabaseClient };
let active: Actor;
let removed: Actor;
let student: Actor;
let missing: Actor;
let teacher: SupabaseClient;
let anonymous: SupabaseClient;
let draft: LearningTree;
let deleted: LearningTree;
let memberTree: LearningTree;
let paymentId: string;
let discountId: string;

function client() { return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }); }

async function actor(role: "admin" | "student", deletedProfile = false): Promise<Actor> {
  const email = `ad7-${randomUUID()}@example.com`;
  const password = `${randomUUID()}aA1!`;
  const made = await service.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { d7_server_created: true }, user_metadata: { full_name: "AD7 Test", username: `ad7_${randomUUID()}` } });
  expect(made.error).toBeNull();
  const id = made.data.user!.id;
  users.push(id);
  expect((await service.from("profiles").update({ role }).eq("id", id)).error).toBeNull();
  const session = client();
  expect((await session.auth.signInWithPassword({ email, password })).error).toBeNull();
  if (deletedProfile) expect((await service.from("profiles").update({ removed_at: new Date().toISOString() }).eq("id", id)).error).toBeNull();
  return { id, client: session };
}

async function tree() {
  const value = await createLearningTree(service, 100000);
  trees.push(value);
  return value;
}

function coupon(courseId: string) { return { code: `AD7-${randomUUID()}`, course_id: courseId, type: "fixed", value: 1000 }; }

async function snapshot(value: LearningTree) {
  const ids = [value.courseId, value.chapterId, value.topicId];
  const result = await Promise.all([
    service.from("courses").select("status,removed_at").eq("id", value.courseId).single(),
    service.from("chapters").select("removed_at").eq("id", value.chapterId).single(),
    service.from("topics").select("status,removed_at,is_preview").eq("id", value.topicId).single(),
    service.from("topic_review_submissions").select("*").eq("topic_id", value.topicId),
    service.from("platform_moderation_audits").select("*").in("target_id", ids),
  ]);
  result.forEach((r) => expect(r.error).toBeNull());
  return result.map((r) => r.data);
}

beforeAll(async () => {
  const target = new URL(url);
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true" || target.protocol !== "http:" || target.hostname !== "127.0.0.1" || target.port !== "45441") throw new Error("AD7 tests require isolated loopback Supabase on port 45441.");
  anonymous = client();
  active = await actor("admin");
  removed = await actor("admin", true);
  student = await actor("student");
  missing = await actor("admin");
  expect((await service.from("profiles").delete().eq("id", missing.id)).error).toBeNull();
  teacher = client();
  expect((await teacher.auth.signInWithPassword({ email: "teacher@gmail.com", password: "123123" })).error).toBeNull();
  draft = await tree();
  deleted = await tree();
  memberTree = await tree();
  expect((await service.from("courses").update({ status: "draft" }).eq("id", draft.courseId)).error).toBeNull();
  expect((await service.from("courses").update({ removed_at: new Date().toISOString() }).eq("id", deleted.courseId)).error).toBeNull();
  expect((await service.from("course_collaborators").insert({ course_id: memberTree.courseId, user_id: removed.id, role: "co_owner", added_by: SEED_TEACHER_ID })).error).toBeNull();
  const payment = await service.from("payments").insert({ user_id: student.id, course_id: draft.courseId, amount_original: 100000, amount_final: 100000, gateway: "payos", gateway_order_id: `ad7-${randomUUID()}`, status: "paid" }).select("id").single();
  expect(payment.error).toBeNull(); paymentId = payment.data!.id;
  const discount = await service.from("discounts").insert(coupon(draft.courseId)).select("id").single();
  expect(discount.error).toBeNull(); discountId = discount.data!.id;
}, 60000);

afterAll(async () => {
  for (const object of objects) expect((await service.storage.from(object.bucket).remove([object.name])).error).toBeNull();
  for (const value of trees.reverse()) {
    expect((await service.from("platform_moderation_audits").delete().in("target_id", [value.courseId, value.chapterId, value.topicId])).error).toBeNull();
    expect((await service.from("discounts").delete().eq("course_id", value.courseId)).error).toBeNull();
    await deleteLearningTree(service, value);
    expect((await service.from("courses").select("id").eq("id", value.courseId)).data).toEqual([]);
  }
  for (const id of users.reverse()) expect((await service.auth.admin.deleteUser(id)).error).toBeNull();
}, 60000);

describe("AD7 real admin boundaries", () => {
  it("denies the admin predicate to removed, missing, anonymous and ordinary profiles", async () => {
    for (const [session, expected] of [[active.client, true], [removed.client, false], [student.client, false], [teacher, false], [missing.client, false], [anonymous, false]] as const) {
      const result = await session.rpc("is_admin");
      expect(result.error).toBeNull(); expect(result.data).toBe(expected);
    }
    expect((await removed.client.auth.getUser()).data.user?.id).toBe(removed.id);
  });

  it("protects draft/removed courses and their chapters without revoking ordinary owners", async () => {
    for (const value of [draft, deleted]) {
      for (const session of [removed.client, student.client, missing.client, anonymous]) {
        const view = await session.rpc("can_view_course_basic", { target_course_id: value.courseId });
        expect(view.error).toBeNull(); expect(view.data).toBe(false);
        const content = await session.rpc("has_course_content_read_access", { target_course_id: value.courseId });
        expect(content.error).toBeNull(); expect(content.data).toBe(false);
        expect((await session.from("courses").select("id").eq("id", value.courseId)).data).toEqual([]);
        expect((await session.from("chapters").select("id").eq("id", value.chapterId)).data).toEqual([]);
      }
      expect((await active.client.from("courses").select("id").eq("id", value.courseId)).data).toEqual([{ id: value.courseId }]);
      expect((await active.client.from("chapters").select("id").eq("id", value.chapterId)).data).toEqual([{ id: value.chapterId }]);
    }
    expect((await teacher.from("courses").select("id").eq("id", draft.courseId)).data).toEqual([{ id: draft.courseId }]);
    expect((await teacher.from("chapters").select("id").eq("id", draft.chapterId)).data).toEqual([{ id: draft.chapterId }]);
    expect((await removed.client.rpc("can_view_course_basic", { target_course_id: memberTree.courseId })).data).toBe(true);
  });

  it("removes cross-user payment access but preserves the payer and active admin", async () => {
    expect((await removed.client.from("payments").select("id").eq("id", paymentId)).data).toEqual([]);
    for (const session of [active.client, student.client, teacher]) expect((await session.from("payments").select("id").eq("id", paymentId)).data).toEqual([{ id: paymentId }]);
  });

  it("enforces discount INSERT and UPDATE policies and preserves owner writes", async () => {
    const denied = coupon(draft.courseId);
    expect((await removed.client.from("discounts").insert(denied)).error).not.toBeNull();
    expect((await service.from("discounts").select("id").eq("code", denied.code)).data).toEqual([]);
    await removed.client.from("discounts").update({ value: 4000 }).eq("id", discountId);
    expect((await service.from("discounts").select("value").eq("id", discountId).single()).data?.value).toBe(1000);
    expect((await active.client.from("discounts").update({ value: 2000 }).eq("id", discountId)).error).toBeNull();
    expect((await service.from("discounts").select("value").eq("id", discountId).single()).data?.value).toBe(2000);
    expect((await teacher.from("discounts").update({ value: 3000 }).eq("id", discountId)).error).toBeNull();
    const allowed = await removed.client.from("discounts").insert(coupon(memberTree.courseId)).select("id").single();
    expect(allowed.error).toBeNull();
    // USING cho phép co_owner trên hàng cũ; WITH CHECK vẫn phải từ chối chuyển sang khóa không có membership.
    expect((await removed.client.from("discounts").update({ course_id: draft.courseId }).eq("id", allowed.data!.id)).error).not.toBeNull();
    expect((await service.from("discounts").select("course_id").eq("id", allowed.data!.id).single()).data?.course_id).toBe(memberTree.courseId);
    const inserted = await active.client.from("discounts").insert(coupon(draft.courseId)).select("id").single();
    expect(inserted.error).toBeNull();
  });

  it.each(["course", "chapter", "topic"] as const)("refuses removed-admin %s moderation without any transactional side effect", async (targetType) => {
    const before = await snapshot(draft);
    const targetId = targetType === "course" ? draft.courseId : targetType === "chapter" ? draft.chapterId : draft.topicId;
    for (const session of [removed.client, student.client, teacher, missing.client]) {
      const result = await session.rpc("moderate_platform_content", { p_target_type: targetType, p_target_id: targetId, p_action: "takedown", p_reason: "AD7 denied moderation test" });
      expect(result.error?.message).toContain("ADMIN_MODERATION_FORBIDDEN");
      expect(await snapshot(draft)).toEqual(before);
    }
  });

  it.each(["course", "chapter", "topic"] as const)("preserves active-admin %s moderation and its audit", async (targetType) => {
    const value = await tree();
    const targetId = targetType === "course" ? value.courseId : targetType === "chapter" ? value.chapterId : value.topicId;
    const result = await active.client.rpc("moderate_platform_content", { p_target_type: targetType, p_target_id: targetId, p_action: "takedown", p_reason: "AD7 active moderation test" });
    expect(result.error).toBeNull(); expect(result.data).toMatchObject({ status: "removed", target_id: targetId });
    const table = targetType === "course" ? "courses" : targetType === "chapter" ? "chapters" : "topics";
    expect((await service.from(table).select("removed_at").eq("id", targetId).single()).data?.removed_at).not.toBeNull();
    expect((await service.from("platform_moderation_audits").select("actor_user_id,reason").eq("id", result.data.audit_id).single()).data).toEqual({ actor_user_id: active.id, reason: "AD7 active moderation test" });
  });

  it.each(["course_thumbnails", "question_group_images", "question_group_audios"])("denies removed-admin deletion of another uploader's %s object", async (bucket) => {
    const audio = bucket === "question_group_audios";
    const name = `${draft.courseId}/${draft.topicId}/${SEED_TEACHER_ID}/${randomUUID()}.${audio ? "mp3" : "png"}`;
    const contentType = audio ? "audio/mpeg" : "image/png";
    const data = audio ? new Uint8Array([0x49, 0x44, 0x33]) : new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect((await service.storage.from(bucket).upload(name, new Blob([data], { type: contentType }), { contentType })).error).toBeNull();
    objects.push({ bucket, name });
    await removed.client.storage.from(bucket).remove([name]);
    expect((await service.storage.from(bucket).download(name)).error).toBeNull();
    expect((await active.client.storage.from(bucket).remove([name])).error).toBeNull();
    expect((await service.storage.from(bucket).download(name)).error).not.toBeNull();
  });

  it("blocks direct profile role/removal writes and real-session self-demotion while allowing self-edit", async () => {
    expect((await active.client.from("profiles").update({ role: "student", removed_at: null }).eq("id", active.id)).error?.code).toBe("42501");
    boundary.client = active.client;
    const input = { full_name: "AD7 Updated", username: `ad7_${randomUUID()}`, phone: "0912345678", role: "admin" as const };
    expect(await updateUserByAdmin(active.id.toUpperCase(), { ...input, role: "student" })).toHaveProperty("error");
    expect((await service.from("profiles").select("role").eq("id", active.id).single()).data?.role).toBe("admin");
    expect(await updateUserByAdmin(active.id, input)).toHaveProperty("success", true);
    expect((await service.from("profiles").select("full_name,username,phone,role").eq("id", active.id).single()).data).toEqual(input);
    expect(await updateUserByAdmin(student.id, { ...input, username: `ad7_${randomUUID()}`, role: "teacher" })).toHaveProperty("success", true);
    expect((await service.from("profiles").select("role").eq("id", student.id).single()).data?.role).toBe("teacher");
    expect(await updateUserByAdmin(removed.id, input)).toEqual({ error: "Không tìm thấy tài khoản đang hoạt động." });
    expect((await service.from("profiles").select("full_name,role").eq("id", removed.id).single()).data).toEqual({ full_name: "AD7 Test", role: "admin" });
    boundary.client = removed.client;
    expect(await updateUserByAdmin(active.id, input)).toHaveProperty("error");
  });
});
