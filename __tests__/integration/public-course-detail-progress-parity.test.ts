import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getEnrolledCourseOverview } from "@/app/actions/enrolled-course-overview";
import { getPublicCourseDetail } from "@/app/actions/public-course";

// Test plan:
// - Mục tiêu: LF3 CP7 (AC10) - trang chi tiết khóa học và tổng quan khóa học `/learn/<course>` cho cùng một học viên
//   cùng một trạng thái: tập chủ đề hiển thị, tập đã hoàn thành và chủ đề "Học tiếp".
// - Loại: integration Server Action thật trên DB local, không mock database (chỉ thay createClient bằng client đã đăng nhập).
// - Fixture: chủ đề draft và đã gỡ, chương đã gỡ, hàng hoàn thành trên chủ đề đã gỡ và chủ đề của chương đã gỡ,
//   Preview bị tạm ngưng, order_index trùng nhau (hàng đã gỡ trùng hàng đang hoạt động, chủ đề khác chương cùng order_index;
//   unique index active không cho trùng trong cùng chương/khóa học).
// - Case thành công: không tiến độ, tiến độ một phần, hoàn thành hết; học viên là admin chỉ thấy hàng tiến độ của chính mình.
// - Case thất bại / ranh giới: học viên chưa ghi danh và khách không có learner_progress.
// - Invariant: cùng một projection (`buildLearnCourseProgressProjection`) là chủ sở hữu duy nhất của quy tắc chủ đề tiếp theo.
// - Ghi chú: chạy bằng `npm run test:integration -- __tests__/integration/public-course-detail-progress-parity.test.ts`;
//   cần ALLOW_DB_INTEGRATION_TESTS=true và Supabase local (guard 45321, giống public-course-read-model).

const authenticated = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => authenticated.client,
}));

const api = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (
  process.env.ALLOW_DB_INTEGRATION_TESTS !== "true" ||
  !api.startsWith("http://127.0.0.1:45321")
) {
  throw new Error(
    "Chặn test DB integration: cần ALLOW_DB_INTEGRATION_TESTS=true và Supabase local",
  );
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(api, process.env.SUPABASE_SERVICE_ROLE_KEY!, opts);
const adminId = "11111111-1111-4111-8111-111111111111";
const teacherId = "22222222-2222-4222-8222-222222222222";
const studentId = "33333333-3333-4333-8333-333333333333";

type Fixture = {
  courseId: string;
  slug: string;
  chapterIds: string[];
  // Chủ đề học được (published, chưa gỡ, trong chương chưa gỡ) theo tên.
  visible: Record<string, string>;
  // Chủ đề không được hiển thị: draft, đã gỡ, thuộc chương đã gỡ.
  hidden: Record<string, string>;
};

let student: SupabaseClient;
let adminLearner: SupabaseClient;
let fixture: Fixture;

async function signIn(email: string) {
  const client = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
  const r = await client.auth.signInWithPassword({ email, password: "123123" });
  if (r.error) throw r.error;
  return client;
}

async function insert(table: string, rows: Record<string, unknown> | Record<string, unknown>[]) {
  const r = await service.from(table).insert(rows as never);
  if (r.error) throw new Error(`${table}: ${r.error.message}`);
}

function topicRow(
  courseId: string,
  chapterId: string,
  id: string,
  key: string,
  order: number,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    course_id: courseId,
    chapter_id: chapterId,
    title: `CP7 ${key}`,
    slug: `cp7-${key}-${id}`,
    status: "published",
    order_index: order,
    original_creator_user_id: teacherId,
    responsible_author_user_id: teacherId,
    first_approved_at: "2026-01-10T12:00:00.000Z",
    removed_at: null,
    is_preview: false,
    ...extra,
  };
}

async function build(): Promise<Fixture> {
  const courseId = randomUUID();
  const slug = `cp7-parity-${courseId}`;
  const [chA, chB, chD, chGone] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const ids = Object.fromEntries(
    ["a1", "a2", "b1", "b2", "d1", "aDraft", "aRemoved", "goneTopic"].map((k) => [k, randomUUID()]),
  );
  const removedAt = new Date().toISOString();

  await insert("courses", { id: courseId, title: "CP7 parity", slug, price: 0, status: "published" });
  await insert("course_collaborators", { course_id: courseId, user_id: teacherId, role: "owner", added_by: teacherId });
  await insert("chapters", [
    { id: chA, course_id: courseId, title: "A", created_by_user_id: teacherId, order_index: 0 },
    { id: chB, course_id: courseId, title: "B", created_by_user_id: teacherId, order_index: 1 },
    { id: chD, course_id: courseId, title: "D", created_by_user_id: teacherId, order_index: 2 },
    // Chương đã gỡ trùng order_index với chương B (unique index chỉ áp dụng cho chương chưa gỡ).
    { id: chGone, course_id: courseId, title: "Gone", created_by_user_id: teacherId, order_index: 1, removed_at: removedAt },
  ]);
  await insert("topics", [
    topicRow(courseId, chA, ids.a1, "a1", 0, { is_preview: true }),
    topicRow(courseId, chA, ids.a2, "a2", 1),
    topicRow(courseId, chA, ids.aDraft, "adraft", 2, { status: "draft", first_approved_at: null }),
    // Chủ đề đã gỡ trùng order_index với a1; chủ đề các chương khác nhau đều bắt đầu từ order_index 0.
    topicRow(courseId, chA, ids.aRemoved, "aremoved", 0, { removed_at: removedAt }),
    topicRow(courseId, chB, ids.b1, "b1", 0),
    topicRow(courseId, chB, ids.b2, "b2", 1),
    topicRow(courseId, chD, ids.d1, "d1", 0),
    topicRow(courseId, chGone, ids.goneTopic, "gone", 0),
  ]);
  await insert("enrollments", [
    { course_id: courseId, user_id: studentId },
    { course_id: courseId, user_id: adminId },
  ]);

  return {
    courseId,
    slug,
    chapterIds: [chA, chB, chD, chGone],
    visible: { a1: ids.a1, a2: ids.a2, b1: ids.b1, b2: ids.b2, d1: ids.d1 },
    hidden: { aDraft: ids.aDraft, aRemoved: ids.aRemoved, goneTopic: ids.goneTopic },
  };
}

async function cleanup() {
  if (!fixture) return;
  const topicIds = [...Object.values(fixture.visible), ...Object.values(fixture.hidden)];
  for (const [table, column, values] of [
    ["user_topic_progress", "topic_id", topicIds],
    ["enrollments", "course_id", [fixture.courseId]],
    ["topics", "id", topicIds],
    ["chapters", "id", fixture.chapterIds],
    ["course_collaborators", "course_id", [fixture.courseId]],
    ["courses", "id", [fixture.courseId]],
  ] as const) {
    const r = await service.from(table).delete().in(column, [...values]);
    if (r.error) throw r.error;
  }
}

async function setProgress(userId: string, topicIds: string[]) {
  const del = await service
    .from("user_topic_progress")
    .delete()
    .eq("user_id", userId)
    .in("topic_id", [...Object.values(fixture.visible), ...Object.values(fixture.hidden)]);
  if (del.error) throw del.error;
  if (topicIds.length === 0) return;
  await insert(
    "user_topic_progress",
    topicIds.map((topic_id) => ({
      user_id: userId,
      topic_id,
      is_topic_completed: true,
      completed_at: new Date().toISOString(),
    })),
  );
}

async function compare(client: SupabaseClient) {
  authenticated.client = client;
  const detail = await getPublicCourseDetail(fixture.slug);
  const overview = await getEnrolledCourseOverview(fixture.slug);
  if (detail.status !== "success") throw new Error(`detail: ${JSON.stringify(detail)}`);
  if (overview.status !== "success") throw new Error(`overview: ${JSON.stringify(overview)}`);

  const overviewTopics = overview.data.chapters.flatMap((chapter) => chapter.topics);
  const detailTopics = detail.data.syllabus.flatMap((chapter) => chapter.topics);
  return { detail: detail.data, overview: overview.data, overviewTopics, detailTopics };
}

const sorted = (values: string[]) => [...values].sort();

describe("public course detail and enrolled overview parity (LF3 AC10)", () => {
  beforeAll(async () => {
    student = await signIn("student@gmail.com");
    adminLearner = await signIn("admin@gmail.com");
    fixture = await build();
  });
  afterAll(async () => {
    await cleanup();
  });

  it("shows the same topic set, completed set and next topic as the overview for no, partial and full progress", async () => {
    const visibleIds = Object.values(fixture.visible);
    const scenarios: [string, string[]][] = [
      ["no progress", []],
      // Hoàn thành thêm hàng trên chủ đề đã gỡ, draft và chủ đề của chương đã gỡ: không được tính.
      [
        "partial progress",
        [fixture.visible.a1, fixture.hidden.aRemoved, fixture.hidden.goneTopic, fixture.hidden.aDraft],
      ],
      ["partial progress across chapters with equal topic order_index", [fixture.visible.a1, fixture.visible.a2, fixture.visible.b1]],
      ["all completed", visibleIds],
    ];

    for (const [label, completed] of scenarios) {
      await setProgress(studentId, completed);
      const { detail, overview, overviewTopics, detailTopics } = await compare(student);

      expect(sorted(detailTopics.map((t) => t.id)), `${label}: topic set`).toEqual(
        sorted(overviewTopics.map((t) => t.id)),
      );
      expect(sorted(detailTopics.map((t) => t.id)), `${label}: only visible topics`).toEqual(
        sorted(visibleIds),
      );
      expect(
        sorted(detail.learner_progress!.completed_topic_ids),
        `${label}: completed set`,
      ).toEqual(sorted(overviewTopics.filter((t) => t.isCompleted).map((t) => t.id)));
      expect(detail.learner_progress!.next_topic_slug, `${label}: next topic`).toBe(
        overview.nextTopic?.slug ?? null,
      );
    }

    // Hoàn thành hết: không có chủ đề tiếp theo ở cả hai trang.
    await setProgress(studentId, visibleIds);
    const done = await compare(student);
    expect(done.detail.learner_progress!.next_topic_slug).toBeNull();
    expect(done.overview.nextTopic).toBeNull();

    // Không tiến độ: chủ đề "Học tiếp" là chủ đề đầu theo projection (chủ đề đầu mỗi chương đều có order_index 0).
    await setProgress(studentId, []);
    const none = await compare(student);
    expect(none.detail.learner_progress!.next_topic_slug).toBe(none.overview.nextTopic?.slug);
    expect(none.detail.learner_progress!.next_topic_slug).not.toBeNull();
  });

  it("keeps the parity when Preview is suspended and shows no draft, removed or removed-chapter topic", async () => {
    // Quota: 6 chủ đề hoạt động (kể cả draft) cho cap 2; a1 đã đánh dấu, đánh dấu thêm a2 và b1 để vượt cap.
    const mark = await service
      .from("topics")
      .update({ is_preview: true })
      .in("id", [fixture.visible.a2, fixture.visible.b1]);
    if (mark.error) throw mark.error;

    await setProgress(studentId, [fixture.visible.a1]);
    const { detail, overview, overviewTopics, detailTopics } = await compare(student);

    expect(detail.is_preview_suspended).toBe(true);
    expect(detailTopics.every((topic) => topic.is_preview === false)).toBe(true);
    expect(sorted(detailTopics.map((t) => t.id))).toEqual(sorted(overviewTopics.map((t) => t.id)));
    expect(detail.learner_progress!.next_topic_slug).toBe(overview.nextTopic?.slug ?? null);
    for (const hiddenId of Object.values(fixture.hidden)) {
      expect(detailTopics.map((t) => t.id)).not.toContain(hiddenId);
    }
  });

  it("gives an admin learner only their own progress rows", async () => {
    await setProgress(studentId, Object.values(fixture.visible));
    await setProgress(adminId, []);

    const { detail, overview } = await compare(adminLearner);

    // Hàng hoàn thành của học viên khác không lọt sang admin.
    expect(detail.learner_progress!.completed_topic_ids).toEqual([]);
    expect(overview.completedTopicCount).toBe(0);
    expect(detail.learner_progress!.next_topic_slug).toBe(overview.nextTopic?.slug);
  });

  it("returns no learner progress to a visitor or a not-enrolled learner", async () => {
    const otherCourse = randomUUID();
    await insert("courses", {
      id: otherCourse,
      title: "CP7 not enrolled",
      slug: `cp7-other-${otherCourse}`,
      price: 0,
      status: "published",
    });
    try {
      authenticated.client = student;
      const notEnrolled = await getPublicCourseDetail(`cp7-other-${otherCourse}`);
      expect(notEnrolled).toMatchObject({
        status: "success",
        data: { is_enrolled: false, learner_progress: null },
      });

      authenticated.client = createClient(api, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, opts);
      const visitor = await getPublicCourseDetail(fixture.slug);
      expect(visitor).toMatchObject({
        status: "success",
        data: { is_enrolled: false, learner_progress: null },
      });
    } finally {
      await service.from("courses").delete().eq("id", otherCourse);
    }
  });
});
