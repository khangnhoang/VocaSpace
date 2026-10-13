import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  beginLocalPostgresTransaction,
  waitForLocalPostgresQuery,
} from "./helpers/local-postgres-coordination";

// Test plan:
// - Mục tiêu: chứng minh mọi ghi cấu trúc khóa học đi qua app lấy course advisory lock TRƯỚC mọi row lock (STRUCTURE-LOCK-001), nên hai người sửa cùng khóa học chờ nhau thay vì deadlock.
// - Loại test: real local Supabase integration/RPC/concurrency; psql giữ lock, giáo viên gọi qua Supabase client để có backend riêng.
// - Đối tượng: move_topic_order, move_topic_to_position, move_chapter_order, create_chapter_ordered, rename_chapter.
// - Case thành công: mỗi đường ghi bị chặn ở course advisory lock; khi transaction giữ lock commit, lời gọi hoàn tất với kết quả bình thường và dữ liệu đúng.
// - Case thất bại: không áp dụng (các case lỗi/quyền của RPC nằm ở course-structure-ordering-rpc, topic-pending-reorder, chapter-rename-rpc).
// - Bảo mật/phân quyền: giáo viên owner gọi bằng client đã đăng nhập; service role chỉ dựng fixture, đọc hậu điều kiện và dọn dẹp.
// - Ổn định/resilience: transaction giữ lock và lời gọi đang chờ luôn được kết thúc trong finally; chờ bằng pg_locks, không dùng sleep cố định.
// - Invariant cần giữ: khi RPC đang chờ course advisory lock thì nó chưa giữ hàng chapters/courses mà đường ghi này từng khóa trước; lock `nowait` của người giữ phải thành công (không SQLSTATE 55P03).
// - Kết quả verify gần nhất: passed (5/5) sau migration LF7, và 5/5 fail với SQLSTATE 55P03 trên baseline, bằng `ALLOW_DB_INTEGRATION_TESTS=true npm run test:integration -- __tests__/integration/structure-lock-order.test.ts` trên runtime cô lập (API 45441).
// - Ghi chú: trên baseline (trước migration LF7) mỗi test fail vì lock `nowait` trả SQLSTATE 55P03; rename baseline là `update chapters set title` trực tiếp, sau LF7 là RPC `rename_chapter`.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PASSWORD = "123123";

const USERS = {
  admin: { email: "admin@gmail.com", id: "11111111-1111-4111-8111-111111111111" },
  teacher: { email: "teacher@gmail.com", id: "22222222-2222-4222-8222-222222222222" },
} as const;

const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const courseIds = new Set<string>();
let teacher: SupabaseClient;

function assertSafeEnvironment() {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error("Set ALLOW_DB_INTEGRATION_TESTS=true for local integration tests.");
  }
  const url = new URL(SUPABASE_URL);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || !["45321", "45441"].includes(url.port)) {
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

function must<T>(result: { data: T; error: { message?: string } | null }, step: string): NonNullable<T> {
  if (result.error || result.data === null || result.data === undefined) {
    throw new Error(`Fixture step failed (${step}): ${result.error?.message ?? "no data"}`);
  }
  return result.data as NonNullable<T>;
}

async function createFixture(options: { chapterCount: number; topicsInFirstChapter: number }) {
  const suffix = randomUUID();
  const course = must(
    await service.from("courses").insert({
      title: `LF7 lock order course ${suffix}`,
      slug: `lf7-lock-order-${suffix}`,
      description: "LF7 structure lock order integration fixture",
      status: "draft",
      price: 0,
    }).select("id").single(),
    "course",
  );
  courseIds.add(course.id);

  const collaborator = await service.from("course_collaborators").insert({
    course_id: course.id,
    user_id: USERS.teacher.id,
    role: "owner",
    added_by: USERS.admin.id,
    can_review_topics: false,
  });
  if (collaborator.error) throw new Error(`Fixture step failed (collaborator): ${collaborator.error.message}`);

  const chapterIds: string[] = [];
  for (let index = 0; index < options.chapterCount; index += 1) {
    const chapter = must(
      await service.from("chapters").insert({
        course_id: course.id,
        created_by_user_id: USERS.teacher.id,
        title: `LF7 chapter ${index + 1}`,
        order_index: index + 1,
      }).select("id").single(),
      `chapter ${index + 1}`,
    );
    chapterIds.push(chapter.id as string);
  }

  const topicIds: string[] = [];
  for (let index = 0; index < options.topicsInFirstChapter; index += 1) {
    const topic = must(
      await service.from("topics").insert({
        course_id: course.id,
        chapter_id: chapterIds[0],
        title: `LF7 topic ${index + 1}`,
        status: "draft",
        order_index: index + 1,
        original_creator_user_id: USERS.teacher.id,
        responsible_author_user_id: USERS.teacher.id,
      }).select("id").single(),
      `topic ${index + 1}`,
    );
    topicIds.push(topic.id as string);
  }

  return { courseId: course.id as string, chapterIds, topicIds };
}

async function cleanup() {
  const ids = [...courseIds];
  courseIds.clear();
  if (ids.length === 0) return;
  const topics = await service.from("topics").delete().in("course_id", ids);
  if (topics.error) throw new Error(`Fixture topic cleanup failed: ${topics.error.message}`);
  const chapters = await service.from("chapters").delete().in("course_id", ids);
  if (chapters.error) throw new Error(`Fixture chapter cleanup failed: ${chapters.error.message}`);
  const collaborators = await service.from("course_collaborators").delete().in("course_id", ids);
  if (collaborators.error) throw new Error(`Fixture collaborator cleanup failed: ${collaborators.error.message}`);
  const courses = await service.from("courses").delete().in("id", ids);
  if (courses.error) throw new Error(`Fixture course cleanup failed: ${courses.error.message}`);
}

// Giữ course advisory lock trong một transaction psql, gọi `call` như giáo viên, đợi backend của lời gọi đó
// chờ đúng course advisory lock, rồi từ transaction giữ lock thử khóa `nowait` hàng mà đường ghi này
// từng khóa trước lock. `sqlstate` null nghĩa là lời gọi chưa giữ hàng đó (đúng course order);
// 55P03 nghĩa là nó đang giữ hàng đó trong khi chờ lock (thứ tự ngược).
async function probeLockOrder<T>(options: {
  courseId: string;
  waitingQueryPattern: string;
  row: { table: "chapters" | "courses"; id: string };
  call: () => PromiseLike<T>;
}) {
  let holder: Awaited<ReturnType<typeof beginLocalPostgresTransaction>> | undefined;
  let pending: Promise<T> | undefined;
  try {
    holder = await beginLocalPostgresTransaction(
      `begin;
       select pg_advisory_xact_lock(hashtext('${options.courseId}'::text));
       select 'LF7_COURSE_ADVISORY_LOCK_HELD|' || pg_backend_pid();`,
      "LF7_COURSE_ADVISORY_LOCK_HELD|",
    );

    pending = Promise.resolve(options.call());
    const waitState = await Promise.race([
      waitForLocalPostgresQuery(
        `select waiting.pid::text
         from pg_stat_activity as waiting
         join pg_locks as waiting_lock
           on waiting_lock.pid = waiting.pid
          and waiting_lock.locktype = 'advisory'
          and not waiting_lock.granted
         where waiting.wait_event_type = 'Lock'
           and waiting.wait_event = 'advisory'
           and ${holder.pid} = any(pg_blocking_pids(waiting.pid))
           and waiting.query ilike '%${options.waitingQueryPattern}%'
           and waiting_lock.classid = ((hashtext('${options.courseId}'::text)::bigint >> 32) & 4294967295)::oid
           and waiting_lock.objid = (hashtext('${options.courseId}'::text)::bigint & 4294967295)::oid
         limit 1`,
        `the ${options.waitingQueryPattern} call to wait on the course advisory lock`,
      ).then(() => ({ type: "waiting" as const }), (error: unknown) => ({ type: "observer-error" as const, error })),
      pending.then((result) => ({ type: "returned" as const, result })),
    ]);
    if (waitState.type === "observer-error") throw waitState.error;
    if (waitState.type === "returned") {
      throw new Error(`The ${options.waitingQueryPattern} call returned before its course advisory-lock wait was observed: ${JSON.stringify(waitState.result)}`);
    }

    const probe = await holder.run(
      `select 1 from public.${options.row.table} where id = '${options.row.id}' for update nowait`,
    );

    await holder.finish("COMMIT");
    holder = undefined;
    const result = await pending;
    return { sqlstate: probe.sqlstate, result };
  } finally {
    await holder?.finish("ROLLBACK");
    if (pending) await Promise.allSettled([pending]);
  }
}

async function readTopicOrder(chapterId: string) {
  const { data, error } = await service.from("topics")
    .select("id")
    .eq("chapter_id", chapterId)
    .is("removed_at", null)
    .order("order_index");
  if (error) throw new Error(`Topic order read failed: ${error.message}`);
  return (data ?? []).map((topic) => topic.id as string);
}

describe("LF7 structure writes take the course advisory lock before any row lock", () => {
  beforeAll(async () => {
    assertSafeEnvironment();
    teacher = await signIn(USERS.teacher.email);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("moves a topic down for a teacher without holding the chapter row while it waits for the course lock", async () => {
    const fixture = await createFixture({ chapterCount: 1, topicsInFirstChapter: 2 });
    const probe = await probeLockOrder({
      courseId: fixture.courseId,
      waitingQueryPattern: "move_topic_order",
      row: { table: "chapters", id: fixture.chapterIds[0] },
      call: () => teacher.rpc("move_topic_order", { p_topic_id: fixture.topicIds[0], p_direction: "down" }),
    });

    expect(probe.sqlstate).toBeNull();
    expect(probe.result.error).toBeNull();
    expect(probe.result.data).toMatchObject({ status: "moved", direction: "down" });
    expect(await readTopicOrder(fixture.chapterIds[0])).toEqual([fixture.topicIds[1], fixture.topicIds[0]]);
  }, 30_000);

  it("moves a topic to a position for a teacher without holding the chapter row while it waits for the course lock", async () => {
    const fixture = await createFixture({ chapterCount: 1, topicsInFirstChapter: 3 });
    const [first, second, third] = fixture.topicIds;
    const probe = await probeLockOrder({
      courseId: fixture.courseId,
      waitingQueryPattern: "move_topic_to_position",
      row: { table: "chapters", id: fixture.chapterIds[0] },
      call: () => teacher.rpc("move_topic_to_position", {
        p_topic_id: third,
        p_before_topic_id: first,
        p_expected_topic_ids: [first, second, third],
      }),
    });

    expect(probe.sqlstate).toBeNull();
    expect(probe.result.error).toBeNull();
    expect(probe.result.data).toMatchObject({ status: "moved" });
    expect(await readTopicOrder(fixture.chapterIds[0])).toEqual([third, first, second]);
  }, 30_000);

  it("moves a chapter up for a teacher without holding the courses row while it waits for the course lock", async () => {
    // Có chương lân cận để lời gọi đi tới UPDATE (và trigger lấy course lock) thay vì trả noop.
    const fixture = await createFixture({ chapterCount: 2, topicsInFirstChapter: 0 });
    const probe = await probeLockOrder({
      courseId: fixture.courseId,
      waitingQueryPattern: "move_chapter_order",
      row: { table: "courses", id: fixture.courseId },
      call: () => teacher.rpc("move_chapter_order", { p_chapter_id: fixture.chapterIds[1], p_direction: "up" }),
    });

    expect(probe.sqlstate).toBeNull();
    expect(probe.result.error).toBeNull();
    expect(probe.result.data).toMatchObject({ status: "moved", direction: "up" });
    const { data } = await service.from("chapters").select("id").eq("course_id", fixture.courseId).order("order_index");
    expect((data ?? []).map((chapter) => chapter.id)).toEqual([fixture.chapterIds[1], fixture.chapterIds[0]]);
  }, 30_000);

  it("creates a chapter for a teacher without holding the courses row while it waits for the course lock", async () => {
    const fixture = await createFixture({ chapterCount: 1, topicsInFirstChapter: 0 });
    const probe = await probeLockOrder({
      courseId: fixture.courseId,
      waitingQueryPattern: "create_chapter_ordered",
      row: { table: "courses", id: fixture.courseId },
      call: () => teacher.rpc("create_chapter_ordered", { p_course_id: fixture.courseId, p_title: "LF7 created chapter" }),
    });

    expect(probe.sqlstate).toBeNull();
    expect(probe.result.error).toBeNull();
    expect(probe.result.data).toMatchObject({ status: "created", chapter: { title: "LF7 created chapter", order_index: 2 } });
  }, 30_000);

  // Baseline (trước LF7) gọi trực tiếp `update chapters set title`; sau LF7 gọi RPC `rename_chapter`.
  it("renames a chapter through rename_chapter for a teacher without holding the chapter row while it waits for the course lock", async () => {
    const fixture = await createFixture({ chapterCount: 1, topicsInFirstChapter: 0 });
    const probe = await probeLockOrder({
      courseId: fixture.courseId,
      waitingQueryPattern: "rename_chapter",
      row: { table: "chapters", id: fixture.chapterIds[0] },
      call: () => teacher.rpc("rename_chapter", { p_chapter_id: fixture.chapterIds[0], p_title: "LF7 renamed chapter" }),
    });

    expect(probe.sqlstate).toBeNull();
    expect(probe.result.error).toBeNull();
    expect(probe.result.data).toMatchObject({ status: "renamed", chapter: { id: fixture.chapterIds[0], title: "LF7 renamed chapter" } });
    const { data } = await service.from("chapters").select("title").eq("id", fixture.chapterIds[0]).single();
    expect(data?.title).toBe("LF7 renamed chapter");
  }, 30_000);
});
