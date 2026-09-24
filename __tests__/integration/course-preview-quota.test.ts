import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

// Test plan:
// - Mục tiêu: kiểm chứng quota Preview, quyền marker, column privacy, lifecycle topic/chapter và ngoại lệ moderation trên PostgreSQL local thật.
// - Loại test: real local Supabase integration/RLS/RPC; service role chỉ dựng trạng thái fixture và đọc hậu điều kiện.
// - Case thành công: mark/unmark dưới cap, delete tự gỡ marker đích, restore/create tăng mẫu số không tăng marker, hide dọn marker trong chương, moderation tạo causal audit cả khi demote/invalidate_review kích hoạt lại row đã ẩn.
// - Case thất bại: quá quota, chọn stale/trùng ID, direct marker/lifecycle DML, member previewer hoặc admin ngoài membership, pending freeze, unmark đơn lẻ khi còn suspended, moderation sai state không ghi dở.
// - Bảo mật/phân quyền: marker chỉ owner/co_owner/editor; giá trị is_preview không đọc trực tiếp qua Data API; cột topic an toàn vẫn đọc được.
// - Ổn định/resilience: hai mark cạnh tranh slot quota cuối chỉ để một request thành công; batch recovery và denominator growth xoá causal pointer khi hợp lệ, gồm mốc A=21→20→21/M=5.
// - Invariant: A = active topics có parent chapter active; M = marker trong A; cap = ceil(A/5); mọi non-moderation commit kết thúc trong cap hoặc là marker-free, non-worsening denominator growth của audit-bound episode.
// - Kết quả verify gần nhất: passed (8 files / 137 tests) trong C6 integration suite bằng `$env:ALLOW_DB_INTEGRATION_TESTS='true'; npm.cmd run test:integration -- __tests__/integration/course-authoring-role-matrix.test.ts __tests__/integration/course-structure-ordering-rpc.test.ts __tests__/integration/course-preview-quota.test.ts __tests__/integration/topic-authorship-boundary.test.ts __tests__/integration/topic-review-lifecycle.test.ts __tests__/integration/public-course-read-model.test.ts __tests__/integration/public-course-preview-service.test.ts __tests__/integration/question-group-media-storage.test.ts`.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = "123123";

const USERS = {
  admin: { email: "admin@gmail.com", id: "11111111-1111-4111-8111-111111111111" },
  teacher: { email: "teacher@gmail.com", id: "22222222-2222-4222-8222-222222222222" },
  student: { email: "student@gmail.com", id: "33333333-3333-4333-8333-333333333333" },
} as const;

const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const courseIds = new Set<string>();
const moderationAuditIds = new Set<string>();
let clients: Record<keyof typeof USERS, SupabaseClient>;

function assertSafeEnvironment() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error("Set ALLOW_DB_INTEGRATION_TESTS=true for local integration tests.");
  }
  if (!SUPABASE_URL.startsWith("http://127.0.0.1:45321")) {
    throw new Error(`Refusing non-local Supabase URL: ${SUPABASE_URL}`);
  }
}

async function signIn(email: string) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Sign-in failed: ${error.message}`);
  return client;
}

async function createFixture(options: {
  activeTopicCount?: number;
  markedIndices?: number[];
  pendingIndices?: number[];
  studentRole?: "editor" | "previewer";
  studentCreatorIndex?: number;
  courseStatus?: "draft" | "published";
} = {}) {
  const suffix = randomUUID();
  const activeTopicCount = options.activeTopicCount ?? 6;
  const { data: course, error: courseError } = await service.from("courses").insert({
    title: `D2 preview course ${suffix}`,
    slug: `d2-preview-${suffix}`,
    description: "D2 preview quota integration fixture",
    status: options.courseStatus ?? "draft",
    price: 0,
  }).select("id").single();
  if (courseError || !course) throw new Error(`Course fixture failed: ${courseError?.message}`);
  courseIds.add(course.id);

  const collaborators = [
    { course_id: course.id, user_id: USERS.teacher.id, role: "owner", added_by: USERS.admin.id, can_review_topics: false },
  ];
  if (options.studentRole) {
    collaborators.push({
      course_id: course.id,
      user_id: USERS.student.id,
      role: options.studentRole,
      added_by: USERS.admin.id,
      can_review_topics: true,
    } as unknown as (typeof collaborators)[number]);
  }
  const { error: collaboratorError } = await service.from("course_collaborators").insert(collaborators);
  if (collaboratorError) throw new Error(`Collaborator fixture failed: ${collaboratorError.message}`);

  const { data: chapter, error: chapterError } = await service.from("chapters").insert({
    course_id: course.id,
    created_by_user_id: USERS.teacher.id,
    title: "D2 preview chapter",
    order_index: 1,
  }).select("id").single();
  if (chapterError || !chapter) throw new Error(`Chapter fixture failed: ${chapterError?.message}`);

  const pending = new Set(options.pendingIndices ?? []);
  const marked = new Set(options.markedIndices ?? []);
  const rows = Array.from({ length: activeTopicCount }, (_, index) => ({
    course_id: course.id,
    chapter_id: chapter.id,
    title: `D2 topic ${index + 1}`,
    status: pending.has(index) ? "pending" : "draft",
    order_index: index + 1,
    original_creator_user_id: index === options.studentCreatorIndex ? USERS.student.id : USERS.teacher.id,
    responsible_author_user_id: index === options.studentCreatorIndex ? USERS.student.id : USERS.teacher.id,
    is_preview: marked.has(index),
  }));
  const { data: topics, error: topicError } = await service.from("topics").insert(rows).select("id, title");
  if (topicError || !topics) throw new Error(`Topic fixture failed: ${topicError?.message}`);
  const pendingSubmissions = topics
    .filter((_, index) => pending.has(index))
    .map((topic) => ({
      topic_id: topic.id,
      submitted_by_user_id: USERS.teacher.id,
      status: "pending",
      attempt_number: 1,
    }));
  if (pendingSubmissions.length > 0) {
    const { error: submissionError } = await service.from("topic_review_submissions").insert(pendingSubmissions);
    if (submissionError) throw new Error(`Pending submission fixture failed: ${submissionError.message}`);
  }
  return {
    courseId: course.id as string,
    chapterId: chapter.id as string,
    topicIds: topics.map((topic) => topic.id as string),
  };
}

async function addChapter(courseId: string, orderIndex: number, removedAt: string | null = null) {
  const { data, error } = await service.from("chapters").insert({
    course_id: courseId,
    created_by_user_id: USERS.teacher.id,
    title: `D2 chapter ${orderIndex}`,
    order_index: orderIndex,
    removed_at: removedAt,
  }).select("id").single();
  if (error || !data) throw new Error(`Additional chapter fixture failed: ${error?.message}`);
  return data.id as string;
}

async function addTopic(courseId: string, chapterId: string, orderIndex: number, options: { removedAt?: string | null; marked?: boolean; status?: string } = {}) {
  const status = options.status ?? "draft";
  const { data, error } = await service.from("topics").insert({
    course_id: courseId,
    chapter_id: chapterId,
    title: `D2 extra topic ${randomUUID()}`,
    status,
    order_index: orderIndex,
    original_creator_user_id: USERS.teacher.id,
    responsible_author_user_id: USERS.teacher.id,
    ...(status === "published" ? { first_approved_at: new Date().toISOString() } : {}),
    removed_at: options.removedAt ?? null,
    is_preview: options.marked ?? false,
  }).select("id").single();
  if (error || !data) throw new Error(`Additional topic fixture failed: ${error?.message}`);
  return data.id as string;
}

async function cleanup() {
  const ids = [...courseIds];
  const auditIds = [...moderationAuditIds];
  courseIds.clear();
  moderationAuditIds.clear();
  if (ids.length > 0) {
    const { error: topicsError } = await service.from("topics").delete().in("course_id", ids);
    if (topicsError) throw new Error(`Fixture topic cleanup failed: ${topicsError.message}`);
    const { error: chaptersError } = await service.from("chapters").delete().in("course_id", ids);
    if (chaptersError) throw new Error(`Fixture chapter cleanup failed: ${chaptersError.message}`);
    const { error: collaboratorsError } = await service.from("course_collaborators").delete().in("course_id", ids);
    if (collaboratorsError) throw new Error(`Fixture collaborator cleanup failed: ${collaboratorsError.message}`);
    const { error } = await service.from("courses").delete().in("id", ids);
    if (error) throw new Error(`Fixture cleanup failed: ${error.message}`);
  }
  if (auditIds.length > 0) {
    const { error } = await service.from("platform_moderation_audits").delete().in("id", auditIds);
    if (error) throw new Error(`Fixture moderation audit cleanup failed: ${error.message}`);
  }
}

async function moderatePlatformContent(input: {
  p_target_type: "course" | "chapter" | "topic";
  p_target_id: string;
  p_action: string;
  p_reason: string;
}) {
  const result = await clients.admin.rpc("moderate_platform_content", input);
  const auditId = result.data?.audit_id;
  if (typeof auditId === "string") moderationAuditIds.add(auditId);
  return result;
}

async function getQuota(courseId: string) {
  const { data: topics, error: topicError } = await service.from("topics")
    .select("chapter_id, removed_at, is_preview")
    .eq("course_id", courseId);
  if (topicError) throw new Error(`Quota topic read failed: ${topicError.message}`);
  const chapterIds = [...new Set((topics ?? []).map((topic) => topic.chapter_id))];
  const { data: chapters, error: chapterError } = await service.from("chapters")
    .select("id, removed_at")
    .in("id", chapterIds);
  if (chapterError) throw new Error(`Quota chapter read failed: ${chapterError.message}`);
  const activeChapterIds = new Set((chapters ?? [])
    .filter((chapter) => chapter.removed_at === null)
    .map((chapter) => chapter.id));
  const activeTopics = (topics ?? []).filter((topic) =>
    topic.removed_at === null && activeChapterIds.has(topic.chapter_id));
  const active_topic_count = activeTopics.length;
  const marked_topic_count = activeTopics.filter((topic) => topic.is_preview).length;
  return { active_topic_count, marked_topic_count, quota_cap: Math.ceil(active_topic_count / 5) };
}

async function getMarker(topicId: string) {
  const { data, error } = await service.from("topics").select("is_preview, status, removed_at").eq("id", topicId).single();
  if (error || !data) throw new Error(`Topic marker read failed: ${error?.message}`);
  return data;
}

function expectRpcError(result: { error: { message?: string } | null }, code: string) {
  expect(result.error).not.toBeNull();
  expect(result.error?.message).toContain(code);
}

describe.sequential("D2 Preview marker quota and lifecycle", () => {
  beforeAll(async () => {
    assertSafeEnvironment();
    clients = {
      admin: await signIn(USERS.admin.email),
      teacher: await signIn(USERS.teacher.email),
      student: await signIn(USERS.student.email),
    };
  });

  afterEach(cleanup);

  it("uses cap zero with no active topics and cap one through five", async () => {
    for (const activeTopicCount of [0, 1, 5]) {
      const fixture = await createFixture({ activeTopicCount });
      const allocation = await clients.teacher.rpc("get_course_preview_allocation", {
        p_course_id: fixture.courseId,
      });
      expect(allocation.error).toBeNull();
      expect(allocation.data).toMatchObject({
        activeTopicCount,
        markedTopicCount: 0,
        cap: Math.ceil(activeTopicCount / 5),
      });
    }
  });

  it("enforces ceil(A/5), counts pending topics, and hides marker reads/writes from Data API", async () => {
    const fixture = await createFixture({ activeTopicCount: 6, pendingIndices: [5], studentRole: "previewer" });
    const marked = await clients.teacher.rpc("set_course_topic_preview_markers", {
      p_course_id: fixture.courseId,
      p_mark_topic_ids: [fixture.topicIds[5]],
    });
    expect(marked.error).toBeNull();
    expect(marked.data).toMatchObject({ activeTopicCount: 6, markedTopicCount: 1, cap: 2 });

    const over = await clients.teacher.rpc("set_course_topic_preview_markers", {
      p_course_id: fixture.courseId,
      p_mark_topic_ids: [fixture.topicIds[0], fixture.topicIds[1]],
    });
    expectRpcError(over, "PREVIEW_QUOTA_RESOLUTION_REQUIRED");
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 6, marked_topic_count: 1, quota_cap: 2 });

    const previewer = await clients.student.rpc("set_course_topic_preview_markers", {
      p_course_id: fixture.courseId,
      p_mark_topic_ids: [fixture.topicIds[0]],
    });
    expectRpcError(previewer, "COURSE_PREVIEW_FORBIDDEN");
    const outsideAdmin = await clients.admin.rpc("set_course_topic_preview_markers", {
      p_course_id: fixture.courseId,
      p_mark_topic_ids: [fixture.topicIds[0]],
    });
    expectRpcError(outsideAdmin, "COURSE_PREVIEW_FORBIDDEN");

    const markerRead = await clients.teacher.from("topics").select("is_preview").eq("id", fixture.topicIds[5]);
    expect(markerRead.error).not.toBeNull();
    expect(["42501", "PGRST204"]).toContain(markerRead.error?.code);
    const safeRead = await clients.teacher.from("topics").select("id, status").eq("id", fixture.topicIds[5]);
    expect(safeRead.error).toBeNull();
    expect(safeRead.data).toHaveLength(1);
    const directMarkerWrite = await clients.teacher.from("topics").update({ is_preview: false }).eq("id", fixture.topicIds[5]);
    expect(directMarkerWrite.error).not.toBeNull();
    const directLifecycleWrite = await clients.teacher.from("topics")
      .update({ removed_at: new Date().toISOString() }).eq("id", fixture.topicIds[0]);
    expect(directLifecycleWrite.error).not.toBeNull();
  });

  it("allows editor marker management and rejects duplicate, stale and overlapping IDs", async () => {
    const fixture = await createFixture({ activeTopicCount: 5, studentRole: "editor" });
    const markedByEditor = await clients.student.rpc("set_course_topic_preview_markers", {
      p_course_id: fixture.courseId,
      p_mark_topic_ids: [fixture.topicIds[0]],
    });
    expect(markedByEditor.error).toBeNull();
    expect(markedByEditor.data).toMatchObject({ markedTopicCount: 1, cap: 1 });

    const duplicate = await clients.teacher.rpc("set_course_topic_preview_markers", {
      p_course_id: fixture.courseId,
      p_unmark_topic_ids: [fixture.topicIds[0], fixture.topicIds[0]],
    });
    expectRpcError(duplicate, "PREVIEW_SELECTION_INVALID");
    const overlap = await clients.teacher.rpc("set_course_topic_preview_markers", {
      p_course_id: fixture.courseId,
      p_mark_topic_ids: [fixture.topicIds[1]],
      p_unmark_topic_ids: [fixture.topicIds[1]],
    });
    expectRpcError(overlap, "PREVIEW_SELECTION_INVALID");
    const stale = await clients.teacher.rpc("set_course_topic_preview_markers", {
      p_course_id: fixture.courseId,
      p_unmark_topic_ids: [randomUUID()],
    });
    expectRpcError(stale, "PREVIEW_SELECTION_STALE");
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 5, marked_topic_count: 1, quota_cap: 1 });
  });

  it("rolls back a topic delete that needs resolution, then batch-clears outside markers atomically", async () => {
    const fixture = await createFixture({ activeTopicCount: 6, markedIndices: [0, 1] });
    const projection = await clients.teacher.rpc("get_topic_delete_preview_projection", {
      p_topic_id: fixture.topicIds[5],
    });
    expect(projection.error).toBeNull();
    expect(projection.data).toMatchObject({
      projectedActiveTopicCount: 5,
      projectedMarkedTopicCount: 2,
      projectedCap: 1,
      requiredUnmarkCount: 1,
      canManageMarkers: true,
    });
    const blocked = await clients.teacher.rpc("d1_delete_topic", {
      p_topic_id: fixture.topicIds[5],
      p_confirm_published: false,
      p_unmark_topic_ids: [],
    });
    expectRpcError(blocked, "PREVIEW_QUOTA_RESOLUTION_REQUIRED");
    expect(await getMarker(fixture.topicIds[5])).toMatchObject({ removed_at: null, status: "draft" });
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 6, marked_topic_count: 2, quota_cap: 2 });

    const deleted = await clients.teacher.rpc("d1_delete_topic", {
      p_topic_id: fixture.topicIds[5],
      p_confirm_published: false,
      p_unmark_topic_ids: [fixture.topicIds[0]],
    });
    expect(deleted.error).toBeNull();
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 5, marked_topic_count: 1, quota_cap: 1 });
    expect(await getMarker(fixture.topicIds[0])).toMatchObject({ is_preview: false });
    const restored = await clients.teacher.rpc("d1_restore_topic", { p_topic_id: fixture.topicIds[5] });
    expect(restored.error).toBeNull();
    expect(await getMarker(fixture.topicIds[5])).toMatchObject({ is_preview: false, status: "draft", removed_at: null });
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 6, marked_topic_count: 1, quota_cap: 2 });
    const remarked = await clients.teacher.rpc("set_course_topic_preview_markers", {
      p_course_id: fixture.courseId,
      p_mark_topic_ids: [fixture.topicIds[5]],
    });
    expect(remarked.error).toBeNull();
    expect(remarked.data).toMatchObject({ activeTopicCount: 6, markedTopicCount: 2, cap: 2 });
  });

  it("rejects a delete projection after the target has already been removed", async () => {
    const fixture = await createFixture({ activeTopicCount: 5 });
    const deleted = await clients.teacher.rpc("d1_delete_topic", {
      p_topic_id: fixture.topicIds[0],
      p_confirm_published: false,
      p_unmark_topic_ids: [],
    });
    expect(deleted.error).toBeNull();

    const projection = await clients.teacher.rpc("get_topic_delete_preview_projection", {
      p_topic_id: fixture.topicIds[0],
    });
    expectRpcError(projection, "TOPIC_NOT_FOUND");
  });

  it("clears target markers for a D1-authorized delete without borrowing course-wide marker authority", async () => {
    const fixture = await createFixture({ activeTopicCount: 5, markedIndices: [0], studentRole: "editor", studentCreatorIndex: 0 });
    const { error: demoteError } = await service.from("course_collaborators")
      .update({ role: "previewer" }).eq("course_id", fixture.courseId).eq("user_id", USERS.student.id);
    expect(demoteError).toBeNull();
    const projection = await clients.student.rpc("get_topic_delete_preview_projection", {
      p_topic_id: fixture.topicIds[0],
    });
    expect(projection.error).toBeNull();
    expect(projection.data).toMatchObject({
      canManageMarkers: false,
      currentAllocation: { cause: null, markedTopics: [] },
      outsideMarkedTopics: [],
    });
    const deleted = await clients.student.rpc("d1_delete_topic", {
      p_topic_id: fixture.topicIds[0],
      p_confirm_published: false,
      p_unmark_topic_ids: [],
    });
    expect(deleted.error).toBeNull();
    expect(await getMarker(fixture.topicIds[0])).toMatchObject({ is_preview: false, removed_at: expect.any(String) });
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 4, marked_topic_count: 0, quota_cap: 1 });
  });

  it("freezes ordinary chapter hide on active pending children before marker resolution", async () => {
    const fixture = await createFixture({ activeTopicCount: 6, markedIndices: [0], pendingIndices: [5] });
    const hide = await clients.teacher.rpc("hide_chapter", {
      p_chapter_id: fixture.chapterId,
      p_unmark_topic_ids: [],
    });
    expectRpcError(hide, "TOPIC_PENDING_FROZEN");
    expect(await getMarker(fixture.topicIds[0])).toMatchObject({ is_preview: true });
    const { data: chapter } = await service.from("chapters").select("removed_at").eq("id", fixture.chapterId).single();
    expect(chapter?.removed_at).toBeNull();
    expect(await getMarker(fixture.topicIds[5])).toMatchObject({ status: "pending" });
    const { data: submission } = await service.from("topic_review_submissions")
      .select("status").eq("topic_id", fixture.topicIds[5]).single();
    expect(submission?.status).toBe("pending");
  });

  it("cancels pending submissions and atomically takes down the chapter under moderation", async () => {
    const fixture = await createFixture({ activeTopicCount: 6, markedIndices: [0], pendingIndices: [5] });
    const outsideChapterId = await addChapter(fixture.courseId, 2);
    const outsideTopicIds: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      outsideTopicIds.push(await addTopic(fixture.courseId, outsideChapterId, index + 1, { marked: index < 2 }));
    }
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 11, marked_topic_count: 3, quota_cap: 3 });

    const reason = `D2 pending chapter takedown ${randomUUID()}`;
    const moderation = await moderatePlatformContent({
      p_target_type: "chapter",
      p_target_id: fixture.chapterId,
      p_action: "takedown",
      p_reason: reason,
    });
    expect(moderation.error).toBeNull();
    expect(moderation.data.cancelled_reviews).toBe(1);

    const { data: chapter } = await service.from("chapters").select("removed_at").eq("id", fixture.chapterId).single();
    expect(chapter?.removed_at).not.toBeNull();
    expect(await getMarker(fixture.topicIds[5])).toMatchObject({ status: "draft", removed_at: null, is_preview: false });
    const { data: submission } = await service.from("topic_review_submissions")
      .select("status, cancelled_by_user_id, cancellation_reason")
      .eq("topic_id", fixture.topicIds[5]).single();
    expect(submission).toMatchObject({
      status: "cancelled",
      cancelled_by_user_id: USERS.admin.id,
      cancellation_reason: reason,
    });
    expect(await getMarker(fixture.topicIds[0])).toMatchObject({ is_preview: false });
    for (const [index, topicId] of outsideTopicIds.entries()) {
      expect(await getMarker(topicId)).toMatchObject({ is_preview: index < 2 });
    }
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 5, marked_topic_count: 2, quota_cap: 1 });
    const allocation = await clients.teacher.rpc("get_course_preview_allocation", { p_course_id: fixture.courseId });
    expect(allocation.error).toBeNull();
    expect(allocation.data).toMatchObject({
      isSuspended: true,
      causeVerified: true,
      cause: { reason, targetType: "chapter", targetLabel: "D2 preview chapter" },
    });
  });

  it("hides a chapter only after atomically unmarking selected outside markers and clears all its child markers", async () => {
    const fixture = await createFixture({ activeTopicCount: 5, markedIndices: [0] });
    const outsideChapterId = await addChapter(fixture.courseId, 2);
    const outsideIds: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      outsideIds.push(await addTopic(fixture.courseId, outsideChapterId, index + 1, { marked: index < 2 }));
    }
    const removedChildId = await addTopic(fixture.courseId, fixture.chapterId, 99, {
      removedAt: new Date().toISOString(),
      marked: true,
    });

    const projection = await clients.teacher.rpc("get_chapter_hide_preview_projection", {
      p_chapter_id: fixture.chapterId,
    });
    expect(projection.error).toBeNull();
    expect(projection.data).toMatchObject({
      projectedActiveTopicCount: 5,
      projectedMarkedTopicCount: 2,
      projectedCap: 1,
      requiredUnmarkCount: 1,
      internalMarkedTopicCount: 1,
      outsideMarkedTopics: expect.arrayContaining([
        expect.objectContaining({ id: outsideIds[0] }),
        expect.objectContaining({ id: outsideIds[1] }),
      ]),
    });

    const blocked = await clients.teacher.rpc("hide_chapter", {
      p_chapter_id: fixture.chapterId,
      p_unmark_topic_ids: [],
    });
    expectRpcError(blocked, "PREVIEW_QUOTA_RESOLUTION_REQUIRED");
    expect(await getMarker(fixture.topicIds[0])).toMatchObject({ is_preview: true });

    const hidden = await clients.teacher.rpc("hide_chapter", {
      p_chapter_id: fixture.chapterId,
      p_unmark_topic_ids: [outsideIds[0]],
    });
    expect(hidden.error).toBeNull();
    expect(await getMarker(fixture.topicIds[0])).toMatchObject({ is_preview: false });
    expect(await getMarker(removedChildId)).toMatchObject({ is_preview: false });
    expect(await getMarker(outsideIds[0])).toMatchObject({ is_preview: false });
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 5, marked_topic_count: 1, quota_cap: 1 });

    const restored = await clients.teacher.rpc("restore_chapter_ordered", { p_chapter_id: fixture.chapterId });
    expect(restored.error).toBeNull();
    expect(await getMarker(fixture.topicIds[0])).toMatchObject({ is_preview: false });
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 10, marked_topic_count: 1, quota_cap: 2 });
    const remarked = await clients.teacher.rpc("set_course_topic_preview_markers", {
      p_course_id: fixture.courseId,
      p_mark_topic_ids: [fixture.topicIds[0]],
    });
    expect(remarked.error).toBeNull();
    expect(remarked.data).toMatchObject({ activeTopicCount: 10, markedTopicCount: 2, cap: 2 });
  });

  it("binds moderation suspension to its exact audit and recovers through denominator growth", async () => {
    const fixture = await createFixture({ activeTopicCount: 6, markedIndices: [0, 1] });
    const reason = `D2 quota audit ${randomUUID()}`;
    const moderation = await moderatePlatformContent({
      p_target_type: "topic",
      p_target_id: fixture.topicIds[5],
      p_action: "takedown",
      p_reason: reason,
    });
    expect(moderation.error).toBeNull();
    expect(moderation.data.audit_id).toEqual(expect.any(String));
    expect(await getMarker(fixture.topicIds[5])).toMatchObject({ is_preview: false, removed_at: expect.any(String) });
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 5, marked_topic_count: 2, quota_cap: 1 });

    const suspended = await clients.teacher.rpc("get_course_preview_allocation", { p_course_id: fixture.courseId });
    expect(suspended.error).toBeNull();
    expect(suspended.data).toMatchObject({
      isSuspended: true,
      causeVerified: true,
      cause: { action: "takedown", reason, targetType: "topic", targetLabel: "D2 topic 6" },
    });

    const secondReason = `D2 subsequent moderation ${randomUUID()}`;
    const secondModeration = await moderatePlatformContent({
      p_target_type: "topic",
      p_target_id: fixture.topicIds[4],
      p_action: "takedown",
      p_reason: secondReason,
    });
    expect(secondModeration.error).toBeNull();
    const stillSuspended = await clients.teacher.rpc("get_course_preview_allocation", { p_course_id: fixture.courseId });
    expect(stillSuspended.data).toMatchObject({ cause: { reason, targetLabel: "D2 topic 6" } });

    const restoredFirst = await clients.teacher.rpc("d1_restore_topic", { p_topic_id: fixture.topicIds[5] });
    expect(restoredFirst.error).toBeNull();
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 5, marked_topic_count: 2, quota_cap: 1 });
    const restoredSecond = await clients.teacher.rpc("d1_restore_topic", { p_topic_id: fixture.topicIds[4] });
    expect(restoredSecond.error).toBeNull();
    const restoredAllocation = await clients.teacher.rpc("get_course_preview_allocation", { p_course_id: fixture.courseId });
    expect(restoredAllocation.data).toMatchObject({ activeTopicCount: 6, markedTopicCount: 2, cap: 2, isSuspended: false, cause: null });

    const thirdModeration = await moderatePlatformContent({
      p_target_type: "topic",
      p_target_id: fixture.topicIds[3],
      p_action: "takedown",
      p_reason: "create denominator recovery episode",
    });
    expect(thirdModeration.error).toBeNull();
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 5, marked_topic_count: 2, quota_cap: 1 });
    const created = await clients.teacher.rpc("create_topic_ordered", {
      p_course_id: fixture.courseId,
      p_chapter_id: fixture.chapterId,
      p_title: "Denominator recovery topic",
    });
    expect(created.error).toBeNull();
    const recovered = await clients.teacher.rpc("get_course_preview_allocation", { p_course_id: fixture.courseId });
    expect(recovered.error).toBeNull();
    expect(recovered.data).toMatchObject({ activeTopicCount: 6, markedTopicCount: 2, cap: 2, isSuspended: false, cause: null });
  });

  it("recovers the exact 21-to-20-to-21 denominator episode without changing five markers", async () => {
    const fixture = await createFixture({ activeTopicCount: 21, markedIndices: [0, 1, 2, 3, 4] });
    expect(await getQuota(fixture.courseId)).toEqual({
      active_topic_count: 21,
      marked_topic_count: 5,
      quota_cap: 5,
    });

    const reason = `D2 exact denominator recovery ${randomUUID()}`;
    const moderation = await moderatePlatformContent({
      p_target_type: "topic",
      p_target_id: fixture.topicIds[5],
      p_action: "takedown",
      p_reason: reason,
    });
    expect(moderation.error).toBeNull();
    expect(await getQuota(fixture.courseId)).toEqual({
      active_topic_count: 20,
      marked_topic_count: 5,
      quota_cap: 4,
    });

    const suspended = await clients.teacher.rpc("get_course_preview_allocation", {
      p_course_id: fixture.courseId,
    });
    expect(suspended.error).toBeNull();
    expect(suspended.data).toMatchObject({
      activeTopicCount: 20,
      markedTopicCount: 5,
      cap: 4,
      isSuspended: true,
      causeVerified: true,
      cause: { reason, targetType: "topic" },
    });

    const restored = await clients.teacher.rpc("d1_restore_topic", {
      p_topic_id: fixture.topicIds[5],
    });
    expect(restored.error).toBeNull();
    expect(await getQuota(fixture.courseId)).toEqual({
      active_topic_count: 21,
      marked_topic_count: 5,
      quota_cap: 5,
    });

    const restoredTopic = await service.from("topics")
      .select("status, removed_at, is_preview")
      .eq("id", fixture.topicIds[5])
      .single();
    expect(restoredTopic.error).toBeNull();
    expect(restoredTopic.data).toMatchObject({
      status: "draft",
      removed_at: null,
      is_preview: false,
    });

    const recovered = await clients.teacher.rpc("get_course_preview_allocation", {
      p_course_id: fixture.courseId,
    });
    expect(recovered.error).toBeNull();
    expect(recovered.data).toMatchObject({
      activeTopicCount: 21,
      markedTopicCount: 5,
      cap: 5,
      isSuspended: false,
      cause: null,
    });
  });

  it("chapter takedown clears every target marker and binds the over-cap episode to its audit", async () => {
    const fixture = await createFixture({ activeTopicCount: 10, markedIndices: [0, 1, 2] });
    const targetChapterId = await addChapter(fixture.courseId, 2);
    const targetTopicId = await addTopic(fixture.courseId, targetChapterId, 1);
    const removedChildId = await addTopic(fixture.courseId, targetChapterId, 2, {
      removedAt: new Date().toISOString(),
      marked: true,
    });
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 11, marked_topic_count: 3, quota_cap: 3 });

    const reason = `D2 chapter takedown ${randomUUID()}`;
    const moderation = await moderatePlatformContent({
      p_target_type: "chapter",
      p_target_id: targetChapterId,
      p_action: "takedown",
      p_reason: reason,
    });
    expect(moderation.error).toBeNull();
    expect(await getMarker(targetTopicId)).toMatchObject({ is_preview: false });
    expect(await getMarker(removedChildId)).toMatchObject({ is_preview: false });
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 10, marked_topic_count: 3, quota_cap: 2 });
    const allocation = await clients.teacher.rpc("get_course_preview_allocation", { p_course_id: fixture.courseId });
    expect(allocation.error).toBeNull();
    expect(allocation.data).toMatchObject({
      isSuspended: true,
      causeVerified: true,
      cause: { reason, targetType: "chapter", targetLabel: "D2 chapter 2" },
    });
  });

  it("course takedown clears all course markers, including removed and hidden descendants", async () => {
    const fixture = await createFixture({ activeTopicCount: 6, markedIndices: [0, 1] });
    const removedChapterId = await addChapter(fixture.courseId, 2, new Date().toISOString());
    const hiddenChildId = await addTopic(fixture.courseId, removedChapterId, 1, { marked: true });
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 6, marked_topic_count: 2, quota_cap: 2 });

    const moderation = await moderatePlatformContent({
      p_target_type: "course",
      p_target_id: fixture.courseId,
      p_action: "takedown",
      p_reason: "remove all Preview links",
    });
    expect(moderation.error).toBeNull();
    for (const topicId of [...fixture.topicIds.slice(0, 2), hiddenChildId]) {
      expect(await getMarker(topicId)).toMatchObject({ is_preview: false });
    }
  });

  it("keeps the first verified cause through partial chapter-restore recovery and clears it at validity", async () => {
    const fixture = await createFixture({ activeTopicCount: 10, markedIndices: [0, 1, 2, 3, 4] });
    const moderationChapterId = await addChapter(fixture.courseId, 2);
    for (let index = 0; index < 11; index += 1) {
      await addTopic(fixture.courseId, moderationChapterId, index + 1);
    }
    const hiddenChapterIds = [
      await addChapter(fixture.courseId, 3, new Date().toISOString()),
      await addChapter(fixture.courseId, 4, new Date().toISOString()),
      await addChapter(fixture.courseId, 5, new Date().toISOString()),
    ];
    for (let index = 0; index < 5; index += 1) {
      await addTopic(fixture.courseId, hiddenChapterIds[0], index + 1);
      await addTopic(fixture.courseId, hiddenChapterIds[1], index + 1);
    }
    await addTopic(fixture.courseId, hiddenChapterIds[2], 1);
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 21, marked_topic_count: 5, quota_cap: 5 });

    const reason = `restore episode ${randomUUID()}`;
    const takedown = await moderatePlatformContent({
      p_target_type: "chapter",
      p_target_id: moderationChapterId,
      p_action: "takedown",
      p_reason: reason,
    });
    expect(takedown.error).toBeNull();
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 10, marked_topic_count: 5, quota_cap: 2 });

    for (const [index, chapterId] of hiddenChapterIds.entries()) {
      const restored = await clients.teacher.rpc("restore_chapter_ordered", { p_chapter_id: chapterId });
      expect(restored.error).toBeNull();
      const allocation = await clients.teacher.rpc("get_course_preview_allocation", { p_course_id: fixture.courseId });
      expect(allocation.error).toBeNull();
      if (index < 2) {
        expect(allocation.data).toMatchObject({
          isSuspended: true,
          causeVerified: true,
          cause: { reason, targetType: "chapter" },
        });
      } else {
        expect(allocation.data).toMatchObject({
          activeTopicCount: 21,
          markedTopicCount: 5,
          cap: 5,
          isSuspended: false,
          cause: null,
        });
      }
    }
  });

  it("suppresses an unverified moderation cause instead of showing an unrelated audit", async () => {
    const fixture = await createFixture({ activeTopicCount: 6, markedIndices: [0, 1] });
    const takedown = await moderatePlatformContent({
      p_target_type: "topic",
      p_target_id: fixture.topicIds[5],
      p_action: "takedown",
      p_reason: "verified first cause",
    });
    expect(takedown.error).toBeNull();

    const unrelated = await createFixture({ courseStatus: "published" });
    const demote = await moderatePlatformContent({
      p_target_type: "course",
      p_target_id: unrelated.courseId,
      p_action: "demote",
      p_reason: "unrelated course audit",
    });
    expect(demote.error).toBeNull();
    const { error: pointerError } = await service.from("course_preview_moderation_causes")
      .update({ audit_id: demote.data.audit_id }).eq("course_id", fixture.courseId);
    expect(pointerError).toBeNull();

    const allocation = await clients.teacher.rpc("get_course_preview_allocation", { p_course_id: fixture.courseId });
    expect(allocation.error).toBeNull();
    expect(allocation.data).toMatchObject({ isSuspended: true, causeVerified: false, cause: null });
  });

  it("recomputes quota and binds the audit when demote reactivates a removed marked topic", async () => {
    const fixture = await createFixture({ activeTopicCount: 4, markedIndices: [0] });
    const removedAt = new Date(Date.now() - 60_000).toISOString();
    const targetId = await addTopic(fixture.courseId, fixture.chapterId, 5, {
      removedAt,
      marked: true,
      status: "published",
    });
    const reason = `D2 removed topic demotion ${randomUUID()}`;
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 4, marked_topic_count: 1, quota_cap: 1 });
    const removedTopic = await getMarker(targetId);
    expect(removedTopic).toMatchObject({ status: "published", removed_at: expect.any(String), is_preview: true });
    expect(Date.parse(removedTopic.removed_at!)).toBe(Date.parse(removedAt));

    const moderation = await moderatePlatformContent({
      p_target_type: "topic",
      p_target_id: targetId,
      p_action: "demote",
      p_reason: reason,
    });
    expect(moderation.error).toBeNull();
    expect(moderation.data).toMatchObject({ status: "draft", target_id: targetId, audit_id: expect.any(String) });
    expect(await getMarker(targetId)).toMatchObject({ status: "draft", removed_at: null, is_preview: true });
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 5, marked_topic_count: 2, quota_cap: 1 });

    const cause = await service.from("course_preview_moderation_causes")
      .select("audit_id").eq("course_id", fixture.courseId).single();
    expect(cause.error).toBeNull();
    expect(cause.data?.audit_id).toBe(moderation.data.audit_id);
    const audit = await service.from("platform_moderation_audits")
      .select("target_type, target_id, action, reason, previous_status, previous_removed_at")
      .eq("id", moderation.data.audit_id).single();
    expect(audit.error).toBeNull();
    expect(audit.data).toMatchObject({
      target_type: "topic",
      target_id: targetId,
      action: "demote",
      reason,
      previous_status: "published",
      previous_removed_at: expect.any(String),
    });
    expect(Date.parse(audit.data!.previous_removed_at!)).toBe(Date.parse(removedAt));
    const allocation = await clients.teacher.rpc("get_course_preview_allocation", { p_course_id: fixture.courseId });
    expect(allocation.error).toBeNull();
    expect(allocation.data).toMatchObject({
      activeTopicCount: 5,
      markedTopicCount: 2,
      cap: 1,
      isSuspended: true,
      causeVerified: true,
      cause: { action: "demote", reason, targetType: "topic" },
    });

    const rejected = await moderatePlatformContent({
      p_target_type: "topic",
      p_target_id: targetId,
      p_action: "demote",
      p_reason: "demote is invalid after draft transition",
    });
    expectRpcError(rejected, "MODERATION_TARGET_STATE_INVALID");
    expect(rejected.data).toBeNull();
    expect(await getMarker(targetId)).toMatchObject({ status: "draft", removed_at: null, is_preview: true });
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 5, marked_topic_count: 2, quota_cap: 1 });
    const unchangedCause = await service.from("course_preview_moderation_causes")
      .select("audit_id").eq("course_id", fixture.courseId).single();
    expect(unchangedCause.data?.audit_id).toBe(moderation.data.audit_id);
    const targetAudits = await service.from("platform_moderation_audits")
      .select("id").eq("target_id", targetId).eq("action", "demote");
    expect(targetAudits.error).toBeNull();
    expect(targetAudits.data).toHaveLength(1);
  });

  it("recomputes quota and cancels review when invalidate_review reactivates a removed pending topic", async () => {
    const fixture = await createFixture({ activeTopicCount: 4, markedIndices: [0] });
    const removedAt = new Date(Date.now() - 60_000).toISOString();
    const targetId = await addTopic(fixture.courseId, fixture.chapterId, 5, {
      removedAt,
      marked: true,
      status: "pending",
    });
    const reason = `D2 removed pending invalidation ${randomUUID()}`;
    const { error: submissionError } = await service.from("topic_review_submissions").insert({
      topic_id: targetId,
      submitted_by_user_id: USERS.teacher.id,
      status: "pending",
      attempt_number: 1,
    });
    expect(submissionError).toBeNull();
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 4, marked_topic_count: 1, quota_cap: 1 });
    const removedTopic = await getMarker(targetId);
    expect(removedTopic).toMatchObject({ status: "pending", removed_at: expect.any(String), is_preview: true });
    expect(Date.parse(removedTopic.removed_at!)).toBe(Date.parse(removedAt));

    const moderation = await moderatePlatformContent({
      p_target_type: "topic",
      p_target_id: targetId,
      p_action: "invalidate_review",
      p_reason: reason,
    });
    expect(moderation.error).toBeNull();
    expect(moderation.data).toMatchObject({
      status: "draft",
      target_id: targetId,
      audit_id: expect.any(String),
      cancelled_reviews: 1,
    });
    expect(await getMarker(targetId)).toMatchObject({ status: "draft", removed_at: null, is_preview: true });
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 5, marked_topic_count: 2, quota_cap: 1 });

    const { data: submission, error: cancelledError } = await service.from("topic_review_submissions")
      .select("status, cancellation_reason, cancelled_by_user_id")
      .eq("topic_id", targetId).single();
    expect(cancelledError).toBeNull();
    expect(submission).toMatchObject({
      status: "cancelled",
      cancellation_reason: reason,
      cancelled_by_user_id: USERS.admin.id,
    });
    const cause = await service.from("course_preview_moderation_causes")
      .select("audit_id").eq("course_id", fixture.courseId).single();
    expect(cause.error).toBeNull();
    expect(cause.data?.audit_id).toBe(moderation.data.audit_id);
    const audit = await service.from("platform_moderation_audits")
      .select("target_type, target_id, action, reason, previous_status, previous_removed_at")
      .eq("id", moderation.data.audit_id).single();
    expect(audit.error).toBeNull();
    expect(audit.data).toMatchObject({
      target_type: "topic",
      target_id: targetId,
      action: "invalidate_review",
      reason,
      previous_status: "pending",
      previous_removed_at: expect.any(String),
    });
    expect(Date.parse(audit.data!.previous_removed_at!)).toBe(Date.parse(removedAt));
    const allocation = await clients.teacher.rpc("get_course_preview_allocation", { p_course_id: fixture.courseId });
    expect(allocation.error).toBeNull();
    expect(allocation.data).toMatchObject({
      activeTopicCount: 5,
      markedTopicCount: 2,
      cap: 1,
      isSuspended: true,
      causeVerified: true,
      cause: { action: "invalidate_review", reason, targetType: "topic" },
    });

    const rejected = await moderatePlatformContent({
      p_target_type: "topic",
      p_target_id: targetId,
      p_action: "invalidate_review",
      p_reason: "invalidation is invalid after draft transition",
    });
    expectRpcError(rejected, "MODERATION_TARGET_STATE_INVALID");
    expect(rejected.data).toBeNull();
    expect(await getMarker(targetId)).toMatchObject({ status: "draft", removed_at: null, is_preview: true });
    expect(await getQuota(fixture.courseId)).toEqual({ active_topic_count: 5, marked_topic_count: 2, quota_cap: 1 });
    const unchangedCause = await service.from("course_preview_moderation_causes")
      .select("audit_id").eq("course_id", fixture.courseId).single();
    expect(unchangedCause.data?.audit_id).toBe(moderation.data.audit_id);
    const targetAudits = await service.from("platform_moderation_audits")
      .select("id").eq("target_id", targetId).eq("action", "invalidate_review");
    expect(targetAudits.error).toBeNull();
    expect(targetAudits.data).toHaveLength(1);
  });

  it("requires a single batch recovery while suspended", async () => {
    const recoveryFixture = await createFixture({ activeTopicCount: 6, markedIndices: [0, 1, 2] });
    const moderation = await moderatePlatformContent({
      p_target_type: "topic",
      p_target_id: recoveryFixture.topicIds[5],
      p_action: "takedown",
      p_reason: "reduce active denominator",
    });
    expect(moderation.error).toBeNull();
    const oneAtATime = await clients.teacher.rpc("set_course_topic_preview_markers", {
      p_course_id: recoveryFixture.courseId,
      p_unmark_topic_ids: [recoveryFixture.topicIds[0]],
    });
    expectRpcError(oneAtATime, "PREVIEW_QUOTA_RESOLUTION_REQUIRED");
    const batch = await clients.teacher.rpc("set_course_topic_preview_markers", {
      p_course_id: recoveryFixture.courseId,
      p_unmark_topic_ids: [recoveryFixture.topicIds[0], recoveryFixture.topicIds[1]],
    });
    expect(batch.error).toBeNull();
    expect(batch.data).toMatchObject({ activeTopicCount: 5, markedTopicCount: 1, cap: 1, isSuspended: false, cause: null });
  });

  it("admits only one of two concurrent marks for the final Preview quota slot", async () => {
    const concurrentFixture = await createFixture({ activeTopicCount: 10, markedIndices: [0] });
    expect(await getQuota(concurrentFixture.courseId)).toEqual({
      active_topic_count: 10,
      marked_topic_count: 1,
      quota_cap: 2,
    });

    const [first, second] = await Promise.all([
      clients.teacher.rpc("set_course_topic_preview_markers", {
        p_course_id: concurrentFixture.courseId,
        p_mark_topic_ids: [concurrentFixture.topicIds[1]],
      }),
      clients.teacher.rpc("set_course_topic_preview_markers", {
        p_course_id: concurrentFixture.courseId,
        p_mark_topic_ids: [concurrentFixture.topicIds[2]],
      }),
    ]);

    const successes = [first, second].filter((result) => result.error === null);
    const rejections = [first, second].filter((result) => result.error !== null);
    expect(successes).toHaveLength(1);
    expect(successes[0].data).toMatchObject({ activeTopicCount: 10, markedTopicCount: 2, cap: 2 });
    expect(rejections).toHaveLength(1);
    expectRpcError(rejections[0], "PREVIEW_QUOTA_RESOLUTION_REQUIRED");
    expect(await getQuota(concurrentFixture.courseId)).toEqual({ active_topic_count: 10, marked_topic_count: 2, quota_cap: 2 });

    const contestedMarkers = await Promise.all([
      getMarker(concurrentFixture.topicIds[1]),
      getMarker(concurrentFixture.topicIds[2]),
    ]);
    expect(contestedMarkers.filter((topic) => topic.is_preview)).toHaveLength(1);
    expect(contestedMarkers.filter((topic) => !topic.is_preview)).toHaveLength(1);
  });
});
