import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { deleteUserByAdmin } from "@/app/actions/user";
import {
  createLearningTree,
  deleteLearningTree,
  seedLearnerRows,
  SEED_TEACHER_ID,
  type LearningTree,
} from "./helpers/a5-learning-fixture";
import { runLocalPsql } from "./helpers/local-psql";
import { beginLocalPostgresTransaction, waitForLocalPostgresQuery } from "./helpers/local-postgres-coordination";

// Test plan:
// - Mục tiêu: bảo vệ AUTH-018 (A5 CP5) — admin xóa được học viên đúng như /privacy hứa, và không bao giờ xóa nhầm người có
//   lịch sử giảng dạy/kiểm duyệt hay đang có giao dịch.
// - Loại test: integration — Server Action + RPC admin_delete_learner + FK/CHECK + Storage + Auth local thật, hai transaction
//   chồng nhau qua psql cho thứ tự khóa.
// - Đối tượng: deleteUserByAdmin, public.admin_delete_learner, payments.user_id (SET NULL + CHECK), handle_payment_success.
// - Case thành công: học viên có enrollment, đơn đã trả, progress, answer, flashcard, avatar tự tải lên được xóa cùng
//   identity, session, dòng G8; đơn còn nguyên mọi cột trừ user_id (null) và updated_at; object của người khác còn dù
//   avatar_url trỏ tới hoặc tên bắt đầu bằng id học viên; webhook trả IDEMPOTENT_SUCCESS với đơn ẩn danh.
// - Case thất bại: giao dịch đang chạy, không phải học viên, mỗi bảng lịch sử nhân sự/kiểm duyệt có dòng liên quan →
//   từ chối bằng thông báo tiếng Việt, không dòng DB hay object Storage nào đổi; lời mời hoặc đổi role commit chen giữa bước
//   kiểm nhanh và RPC vẫn bị RPC từ chối; auth.admin.deleteUser trực tiếp lên học viên có đơn pending lỗi vì CHECK;
//   authenticated và anon không gọi được RPC.
// - Bảo mật/phân quyền: RPC chỉ service_role; action kiểm admin trước mọi thao tác service-role (xem __tests__/actions/user.test.ts).
// - Ổn định/resilience: đổi email trên auth.users và RPC xóa xếp hàng chờ nhau theo cả hai chiều, không deadlock; khi RPC đang đợi khóa profiles do phiên khác giữ, phiên thứ ba dùng FOR UPDATE NOWAIT phải thấy auth.users đã bị RPC khóa (55P03), nên đảo thứ tự khóa làm test fail.
// - Invariant cần giữ: thứ tự khóa auth.users rồi profiles; tên object avatars xóa chỉ gồm object có storage owner_id = học viên.
// - Kết quả verify gần nhất: xem milestone A5 CP5 trong progress.md (`ALLOW_DB_INTEGRATION_TESTS=true npm run test:integration -- a5-learner-deletion`).
// - Ghi chú: hook beforeRpc chỉ chạy một hàm của test ngay trước RPC để dựng lời mời/đổi role "chen giữa"; mọi thứ còn lại thật.

// Chỉ thay adapter session của Next.js; thêm hook chạy ngay trước RPC xóa để dựng tình huống chen giữa.
const boundary = vi.hoisted(() => ({
  clients: [] as unknown[],
  beforeRpc: null as null | (() => Promise<void>),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => boundary.clients.shift()!,
}));
vi.mock("@supabase/supabase-js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@supabase/supabase-js")>();
  return {
    ...actual,
    createClient: (...args: Parameters<typeof actual.createClient>) => {
      const real = actual.createClient(...args);
      return new Proxy(real, {
        get(target, prop) {
          if (prop === "rpc") {
            return async (fn: string, ...rest: unknown[]) => {
              if (fn === "admin_delete_learner" && boundary.beforeRpc) {
                const hook = boundary.beforeRpc;
                boundary.beforeRpc = null;
                await hook();
              }
              return (target.rpc as (...args: unknown[]) => unknown)(fn, ...rest);
            };
          }
          const value = Reflect.get(target, prop, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    },
  };
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const createdUserIds = new Set<string>();
const trees: LearningTree[] = [];
const storageNames = new Set<string>();

const NOT_STUDENT = "Chỉ xóa được tài khoản học viên. Tài khoản giáo viên hoặc quản trị viên cần xử lý thủ công.";
const ACTIVE_PAYMENT = "Học viên đang có giao dịch thanh toán chưa hoàn tất. Hãy đợi giao dịch hoàn tất hoặc hết hạn rồi thử lại.";
const STAFF_HISTORY = "Tài khoản này có lịch sử cộng tác hoặc kiểm duyệt khóa học nên không thể xóa tại đây. Hãy báo Owner xử lý thủ công.";

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

async function createUser(role: "student" | "teacher" | "admin" = "student"): Promise<TestUser> {
  const email = `a5-del-${randomUUID()}@example.com`;
  const password = `${randomUUID()}aA1!`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Người Dùng A5" },
    app_metadata: { d7_server_created: true },
  });
  expect(error).toBeNull();
  createdUserIds.add(data.user!.id);
  if (role !== "student") expect((await service.from("profiles").update({ role }).eq("id", data.user!.id)).error).toBeNull();
  return { id: data.user!.id, email, password };
}

async function signIn(user: TestUser): Promise<SupabaseClient> {
  const session = client();
  expect((await session.auth.signInWithPassword({ email: user.email, password: user.password })).error).toBeNull();
  return session;
}

let adminSession: SupabaseClient;

async function deleteAsAdmin(targetId: string) {
  boundary.clients.push(adminSession);
  return deleteUserByAdmin(targetId);
}

async function newTree(price = 0) {
  const tree = await createLearningTree(service, price);
  trees.push(tree);
  return tree;
}

async function insertPayment(userId: string, courseId: string, status: string, extra: Record<string, unknown> = {}) {
  const row = {
    user_id: userId,
    course_id: courseId,
    amount_original: 100000,
    amount_discount: 0,
    amount_final: 100000,
    status,
    gateway: "payos",
    gateway_order_id: `a5-${randomUUID()}`,
    gateway_metadata: { orderCode: 424242, checkoutUrl: "https://pay.example/checkout", qrCode: "qr-data" },
    ...extra,
  };
  const { data, error } = await service.from("payments").insert(row).select("*").single();
  expect(error).toBeNull();
  return data as Record<string, unknown>;
}

async function uploadAvatarAs(session: SupabaseClient, name: string) {
  storageNames.add(name);
  const { error } = await session.storage.from("avatars").upload(name, new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }), {
    contentType: "image/png",
  });
  expect(error).toBeNull();
}

function objectOwners(...names: string[]) {
  const list = names.map((name) => `'${name}'`).join(", ");
  return runLocalPsql(
    `select coalesce(string_agg(name || '=' || coalesce(owner_id, ''), ';' order by name), '') from storage.objects where bucket_id = 'avatars' and name in (${list});`,
  );
}

// Một dòng mô tả toàn bộ dữ liệu của học viên; hai lần chụp bằng nhau nghĩa là không có gì đổi.
function snapshot(id: string) {
  return runLocalPsql(`
    select json_build_object(
      'auth', (select count(*) from auth.users where id = '${id}'),
      'profile', (select row_to_json(p) from public.profiles p where p.id = '${id}'),
      'enrollments', (select count(*) from public.enrollments where user_id = '${id}'),
      'flashcards', (select count(*) from public.user_flashcards where user_id = '${id}'),
      'progress', (select count(*) from public.user_topic_progress where user_id = '${id}'),
      'answers', (select count(*) from public.user_question_answers where user_id = '${id}'),
      'payments', (select coalesce(json_agg(pay order by pay.id), '[]'::json) from public.payments pay where pay.user_id = '${id}'),
      'objects', (select coalesce(json_agg(o.name order by o.name), '[]'::json) from storage.objects o where o.bucket_id = 'avatars' and o.owner_id = '${id}')
    )::text;`);
}

async function learnerWithRows(tree: LearningTree) {
  const learner = await createUser();
  await seedLearnerRows(service, learner.id, tree);
  return learner;
}

beforeAll(async () => {
  if (process.env.ALLOW_DB_INTEGRATION_TESTS !== "true") {
    throw new Error("Chan test DB integration. Set ALLOW_DB_INTEGRATION_TESTS=true cho stack local.");
  }
  if (!["127.0.0.1", "localhost"].includes(new URL(SUPABASE_URL).hostname)) {
    throw new Error("Chan test DB integration vi URL khong phai local.");
  }
  adminSession = await signIn(await createUser("admin"));
});

afterAll(async () => {
  if (storageNames.size > 0) await service.storage.from("avatars").remove([...storageNames]);
  for (const tree of trees) await deleteLearningTree(service, tree);
  for (const id of createdUserIds) {
    await service.auth.admin.deleteUser(id);
  }
});

describe("A5 admin deletes a learner", () => {
  it("removes the account, learning rows and own avatars, keeps the payment as an anonymous record and leaves other users' objects", async () => {
    const tree = await newTree();
    const learner = await learnerWithRows(tree);
    const learnerSession = await signIn(learner);
    const other = await createUser();
    const otherSession = await signIn(other);

    expect((await service.from("user_password_setups").insert({ user_id: learner.id })).error).toBeNull();
    expect((await service.from("user_password_recoveries").insert({ user_id: learner.id, session_id: randomUUID() })).error).toBeNull();
    const payment = await insertPayment(learner.id, tree.courseId, "paid");

    const ownName = `${learner.id}-${randomUUID().slice(0, 8)}.png`;
    const victimByUrl = `${other.id}-${randomUUID().slice(0, 8)}.png`;
    const victimByPrefix = `${learner.id}-victim-${randomUUID().slice(0, 8)}.png`;
    await uploadAvatarAs(learnerSession, ownName);
    await uploadAvatarAs(otherSession, victimByUrl);
    await uploadAvatarAs(otherSession, victimByPrefix);
    // avatar_url của học viên trỏ tới object của người khác: không phải bằng chứng sở hữu.
    expect((await service.from("profiles").update({ avatar_url: `${SUPABASE_URL}/storage/v1/object/public/avatars/${victimByUrl}` }).eq("id", learner.id)).error).toBeNull();
    expect(objectOwners(ownName, victimByUrl, victimByPrefix)).toBe(
      [`${ownName}=${learner.id}`, `${victimByPrefix}=${other.id}`, `${victimByUrl}=${other.id}`].sort().join(";"),
    );
    expect(runLocalPsql(`select (select count(*) from auth.identities where user_id = '${learner.id}')::text || ',' || (select count(*) from auth.sessions where user_id = '${learner.id}')::text;`)).toBe("1,1");

    const result = await deleteAsAdmin(learner.id);

    expect(result).toEqual({ success: true, message: "Xóa tài khoản thành công!" });
    expect(JSON.parse(snapshot(learner.id))).toMatchObject({
      auth: 0,
      profile: null,
      enrollments: 0,
      flashcards: 0,
      progress: 0,
      answers: 0,
      payments: [],
      objects: [],
    });
    expect(runLocalPsql(
      `select (select count(*) from auth.identities where user_id = '${learner.id}')::text || ',' || (select count(*) from auth.sessions where user_id = '${learner.id}')::text || ',' || (select count(*) from auth.refresh_tokens where user_id = '${learner.id}'::text)::text || ',' || (select count(*) from public.user_password_setups where user_id = '${learner.id}')::text || ',' || (select count(*) from public.user_password_recoveries where user_id = '${learner.id}')::text;`,
    )).toBe("0,0,0,0,0");

    // Đơn ở lại: mọi cột còn nguyên trừ user_id (null) và updated_at (trigger set_updated_at_payments).
    const { data: after } = await service.from("payments").select("*").eq("id", payment.id as string).single();
    expect(after).toMatchObject({ ...payment, user_id: null, updated_at: after!.updated_at });
    expect(after!.updated_at).not.toBe(payment.updated_at);
    expect(after!.gateway_metadata).toEqual(payment.gateway_metadata);

    // Chỉ object do chính học viên tải lên bị xóa.
    expect(objectOwners(ownName, victimByUrl, victimByPrefix)).toBe(
      [`${victimByPrefix}=${other.id}`, `${victimByUrl}=${other.id}`].sort().join(";"),
    );

    // Webhook đến muộn với đơn ẩn danh đã trả: idempotent, không đụng user_id.
    const webhook = await service.rpc("handle_payment_success", {
      p_gateway: payment.gateway as string,
      p_gateway_order_id: payment.gateway_order_id as string,
      p_gateway_transaction_id: "late-webhook",
    });
    expect(webhook.error).toBeNull();
    expect(webhook.data).toBe("IDEMPOTENT_SUCCESS");
    const { data: unchanged } = await service.from("payments").select("*").eq("id", payment.id as string).single();
    expect(unchanged).toEqual(after);
  });

  it("refuses a learner with a creating or pending payment and changes nothing", async () => {
    const tree = await newTree();
    const learner = await learnerWithRows(tree);
    await insertPayment(learner.id, tree.courseId, "pending");
    const before = snapshot(learner.id);

    expect(await deleteAsAdmin(learner.id)).toEqual({ error: ACTIVE_PAYMENT });
    expect(snapshot(learner.id)).toBe(before);

    const direct = await service.rpc("admin_delete_learner", { target: learner.id });
    expect(direct.error?.message).toContain("LEARNER_HAS_ACTIVE_PAYMENT");
    expect(snapshot(learner.id)).toBe(before);
  });

  it("makes a direct auth.admin.deleteUser fail on the payments CHECK when an active payment would lose its user", async () => {
    const tree = await newTree();
    const learner = await createUser();
    await insertPayment(learner.id, tree.courseId, "pending");

    const direct = await service.auth.admin.deleteUser(learner.id);

    expect(direct.error).not.toBeNull();
    expect(runLocalPsql(`select count(*) from auth.users where id = '${learner.id}';`)).toBe("1");
    expect(runLocalPsql(`select count(*) from public.payments where user_id = '${learner.id}' and status = 'pending';`)).toBe("1");
    // Dọn để afterAll xóa được user: chuyển đơn sang hết hạn trước.
    expect((await service.from("payments").update({ status: "expired" }).eq("user_id", learner.id)).error).toBeNull();
  });

  it("refuses a teacher or admin target", async () => {
    const teacher = await createUser("teacher");
    const tree = await newTree();
    expect((await service.from("course_collaborators").insert({ course_id: tree.courseId, user_id: teacher.id, role: "co_owner", added_by: SEED_TEACHER_ID })).error).toBeNull();
    const before = snapshot(teacher.id);

    expect(await deleteAsAdmin(teacher.id)).toEqual({ error: NOT_STUDENT });
    expect(snapshot(teacher.id)).toBe(before);
    const direct = await service.rpc("admin_delete_learner", { target: teacher.id });
    expect(direct.error?.message).toContain("LEARNER_NOT_STUDENT");
    expect(runLocalPsql(`select count(*) from auth.users where id = '${teacher.id}';`)).toBe("1");
  });

  // Mỗi dòng dựng đúng một dấu vết nhân sự/kiểm duyệt gắn với một học viên (không có tác giả nào khác ngoài seed teacher).
  const historyCases: Array<{
    name: string;
    seed: (learnerId: string, tree: LearningTree) => Promise<() => Promise<void>>;
  }> = [
    {
      name: "course_collaborators (collaborator)",
      seed: async (id, tree) => {
        const { data, error } = await service.from("course_collaborators").insert({ course_id: tree.courseId, user_id: id, role: "previewer", added_by: SEED_TEACHER_ID }).select("id").single();
        expect(error).toBeNull();
        return async () => { await service.from("course_collaborators").delete().eq("id", data!.id); };
      },
    },
    {
      name: "course_collaborator_invitations (invitee)",
      seed: async (id, tree) => {
        const { data, error } = await service.from("course_collaborator_invitations").insert({ course_id: tree.courseId, invited_by_user_id: SEED_TEACHER_ID, invitee_user_id: id, role: "editor", status: "pending" }).select("id").single();
        expect(error).toBeNull();
        return async () => { await service.from("course_collaborator_invitations").delete().eq("id", data!.id); };
      },
    },
    {
      name: "topic_review_submissions (reviewer only)",
      seed: async (id, tree) => {
        const { data, error } = await service.from("topic_review_submissions").insert({ topic_id: tree.topicId, submitted_by_user_id: SEED_TEACHER_ID, reviewed_by_user_id: id }).select("id").single();
        expect(error).toBeNull();
        return async () => { await service.from("topic_review_submissions").delete().eq("id", data!.id); };
      },
    },
    {
      name: "review_notes (author)",
      seed: async (id, tree) => {
        const { data, error } = await service.from("review_notes").insert({ topic_id: tree.topicId, author_user_id: id, body: "A5 note" }).select("id").single();
        expect(error).toBeNull();
        return async () => { await service.from("review_notes").delete().eq("id", data!.id); };
      },
    },
    {
      name: "topic_authorship_feedback (recipient)",
      seed: async (id, tree) => {
        const { data, error } = await service.from("topic_authorship_feedback").insert({ topic_id: tree.topicId, recipient_user_id: id, feedback_type: "responsibility_transfer" }).select("id").single();
        expect(error).toBeNull();
        return async () => { await service.from("topic_authorship_feedback").delete().eq("id", data!.id); };
      },
    },
    {
      name: "topic_contributors",
      seed: async (id, tree) => {
        const { data, error } = await service.from("topic_contributors").insert({ topic_id: tree.topicId, user_id: id, added_by_user_id: SEED_TEACHER_ID }).select("id").single();
        expect(error).toBeNull();
        return async () => { await service.from("topic_contributors").delete().eq("id", data!.id); };
      },
    },
    {
      name: "topic_author_review_exclusions",
      seed: async (id, tree) => {
        const { data, error } = await service.from("topic_author_review_exclusions").insert({ topic_id: tree.topicId, user_id: id, exclusion_type: "initial_contributor" }).select("id").single();
        expect(error).toBeNull();
        return async () => { await service.from("topic_author_review_exclusions").delete().eq("id", data!.id); };
      },
    },
    {
      name: "platform_moderation_audits (actor)",
      seed: async (id, tree) => {
        const { data, error } = await service.from("platform_moderation_audits").insert({ actor_user_id: id, target_type: "course", target_id: tree.courseId, action: "demote", reason: "A5 audit" }).select("id").single();
        expect(error).toBeNull();
        return async () => { await service.from("platform_moderation_audits").delete().eq("id", data!.id); };
      },
    },
    {
      name: "courses.reviewed_by",
      seed: async (id, tree) => {
        expect((await service.from("courses").update({ reviewed_by: id }).eq("id", tree.courseId)).error).toBeNull();
        return async () => { await service.from("courses").update({ reviewed_by: null }).eq("id", tree.courseId); };
      },
    },
    {
      name: "chapters.created_by_user_id",
      seed: async (id, tree) => {
        expect((await service.from("chapters").update({ created_by_user_id: id }).eq("id", tree.chapterId)).error).toBeNull();
        return async () => { await service.from("chapters").update({ created_by_user_id: SEED_TEACHER_ID }).eq("id", tree.chapterId); };
      },
    },
    {
      name: "topics.original_creator_user_id",
      seed: async (id, tree) => {
        // original_creator_user_id bất biến sau khi tạo (trigger), nên dựng một topic nháp mới do học viên khởi tạo.
        const topicId = randomUUID();
        const { error } = await service.from("topics").insert({
          id: topicId,
          course_id: tree.courseId,
          chapter_id: tree.chapterId,
          title: "A5 draft by learner",
          slug: `a5-draft-${topicId}`,
          order_index: 5,
          status: "draft",
          original_creator_user_id: id,
          responsible_author_user_id: SEED_TEACHER_ID,
        });
        expect(error).toBeNull();
        return async () => { await service.from("topics").delete().eq("id", topicId); };
      },
    },
    {
      name: "topics.responsible_author_user_id",
      seed: async (id, tree) => {
        expect((await service.from("topics").update({ responsible_author_user_id: id }).eq("id", tree.topicId)).error).toBeNull();
        return async () => { await service.from("topics").update({ responsible_author_user_id: SEED_TEACHER_ID }).eq("id", tree.topicId); };
      },
    },
  ];

  it.each(historyCases)("refuses a student who appears in $name and changes nothing", async ({ seed }) => {
    const tree = await newTree();
    const learner = await learnerWithRows(tree);
    const session = await signIn(learner);
    const ownName = `${learner.id}-${randomUUID().slice(0, 8)}.png`;
    await uploadAvatarAs(session, ownName);
    const cleanup = await seed(learner.id, tree);
    try {
      const before = snapshot(learner.id);

      expect(await deleteAsAdmin(learner.id)).toEqual({ error: STAFF_HISTORY });
      expect(snapshot(learner.id)).toBe(before);

      const direct = await service.rpc("admin_delete_learner", { target: learner.id });
      expect(direct.error?.message).toContain("LEARNER_HAS_STAFF_HISTORY");
      expect(snapshot(learner.id)).toBe(before);
      expect(objectOwners(ownName)).toBe(`${ownName}=${learner.id}`);
    } finally {
      await cleanup();
    }
  });

  it("refuses when an invitation for the learner commits after the early check and before the RPC", async () => {
    const tree = await newTree();
    const learner = await learnerWithRows(tree);
    const before = snapshot(learner.id);
    let invitationId = "";
    boundary.beforeRpc = async () => {
      const { data, error } = await service.from("course_collaborator_invitations").insert({ course_id: tree.courseId, invited_by_user_id: SEED_TEACHER_ID, invitee_user_id: learner.id, role: "editor", status: "pending" }).select("id").single();
      expect(error).toBeNull();
      invitationId = data!.id;
    };

    const result = await deleteAsAdmin(learner.id);

    expect(boundary.beforeRpc).toBeNull();
    expect(result).toEqual({ error: STAFF_HISTORY });
    expect(invitationId).not.toBe("");
    expect(snapshot(learner.id)).toBe(before);
    expect(runLocalPsql(`select count(*) from public.course_collaborator_invitations where id = '${invitationId}';`)).toBe("1");
    await service.from("course_collaborator_invitations").delete().eq("id", invitationId);
  });

  it("refuses when the learner's role changes to teacher after the early check and before the RPC", async () => {
    const tree = await newTree();
    const learner = await learnerWithRows(tree);
    boundary.beforeRpc = async () => {
      expect((await service.from("profiles").update({ role: "teacher" }).eq("id", learner.id)).error).toBeNull();
    };

    const result = await deleteAsAdmin(learner.id);

    expect(boundary.beforeRpc).toBeNull();
    expect(result).toEqual({ error: NOT_STUDENT });
    const state = JSON.parse(snapshot(learner.id));
    expect(state.auth).toBe(1);
    expect(state.profile.role).toBe("teacher");
    expect(state.enrollments).toBe(1);
  });

  it("refuses when an active payment appears after the early check and before the RPC", async () => {
    const tree = await newTree();
    const learner = await learnerWithRows(tree);
    boundary.beforeRpc = async () => {
      await insertPayment(learner.id, tree.courseId, "pending");
    };

    const result = await deleteAsAdmin(learner.id);

    expect(result).toEqual({ error: ACTIVE_PAYMENT });
    expect(runLocalPsql(`select count(*) from auth.users where id = '${learner.id}';`)).toBe("1");
    expect(runLocalPsql(`select count(*) from public.payments where user_id = '${learner.id}';`)).toBe("1");
  });

  it("does not let authenticated or anon sessions execute the RPC", async () => {
    const learner = await createUser();
    const victim = await createUser();
    const session = await signIn(learner);

    for (const caller of [session, client()]) {
      const result = await caller.rpc("admin_delete_learner", { target: victim.id });
      expect(result.error?.code).toBe("42501");
    }
    expect(runLocalPsql(`select count(*) from auth.users where id = '${victim.id}';`)).toBe("1");
    expect(runLocalPsql(
      `select has_function_privilege('authenticated', 'public.admin_delete_learner(uuid)', 'EXECUTE')::text || ',' || has_function_privilege('anon', 'public.admin_delete_learner(uuid)', 'EXECUTE')::text || ',' || has_function_privilege('service_role', 'public.admin_delete_learner(uuid)', 'EXECUTE')::text;`,
    )).toBe("false,false,true");
  });
});

describe("A5 lock order between an email update and the delete RPC", () => {
  async function waitUntilBlockedBy(pid: number, pending: Promise<unknown>, description: string) {
    const state = await Promise.race([
      waitForLocalPostgresQuery(
        `select pid::text from pg_stat_activity where ${pid} = any(pg_blocking_pids(pid)) limit 1`,
        description,
      ).then((blocked) => ({ type: "waiting" as const, blocked }), (error: unknown) => ({ type: "observer-error" as const, error })),
      pending.then((result) => ({ type: "returned" as const, result })),
    ]);
    if (state.type === "observer-error") throw state.error;
    if (state.type === "returned") throw new Error(`${description}: the request returned before it was seen waiting: ${JSON.stringify(state.result)}`);
  }

  it("makes the RPC wait for an open email update on the learner and then complete without a deadlock", async () => {
    const learner = await createUser();
    const newEmail = `a5-lock-${randomUUID()}@example.com`;
    let tx: Awaited<ReturnType<typeof beginLocalPostgresTransaction>> | undefined;
    try {
      tx = await beginLocalPostgresTransaction(
        `begin;
         update auth.users set email = '${newEmail}' where id = '${learner.id}';
         select 'A5_EMAIL_LOCK_HELD|' || pg_backend_pid();`,
        "A5_EMAIL_LOCK_HELD|",
      );
      const pending = Promise.resolve(service.rpc("admin_delete_learner", { target: learner.id }));
      await waitUntilBlockedBy(tx.pid, pending, "the delete RPC to wait for the open email update");

      await tx.finish("COMMIT");
      tx = undefined;
      const result = await pending;

      expect(result.error).toBeNull();
      expect(runLocalPsql(`select count(*) from auth.users where id = '${learner.id}';`)).toBe("0");
      expect(runLocalPsql(`select count(*) from public.profiles where id = '${learner.id}';`)).toBe("0");
    } finally {
      if (tx) await tx.finish("ROLLBACK").catch(() => {});
    }
  });

  it("takes the auth.users lock before it waits for the profiles lock", async () => {
    // Chỉ khi RPC khóa auth.users TRƯỚC profiles thì phiên C mới thấy auth.users đã bị khóa khi RPC còn đang đợi A giữ profiles.
    // Nếu thứ tự khóa bị đảo (profiles trước), RPC đợi mà chưa giữ auth.users nên NOWAIT bên dưới sẽ thành công và test fail.
    const learner = await createUser();
    let tx: Awaited<ReturnType<typeof beginLocalPostgresTransaction>> | undefined;
    try {
      tx = await beginLocalPostgresTransaction(
        `begin;
         select 1 from public.profiles where id = '${learner.id}' for update;
         select 'A5_PROFILE_LOCK_HELD|' || pg_backend_pid();`,
        "A5_PROFILE_LOCK_HELD|",
      );
      const pending = Promise.resolve(service.rpc("admin_delete_learner", { target: learner.id }));
      await waitUntilBlockedBy(tx.pid, pending, "the delete RPC to wait for the open profiles lock");

      // Phiên C: khóa auth.users của học viên phải đã do RPC giữ (55P03 = lock_not_available).
      expect(() =>
        runLocalPsql(
          [
            "\\set VERBOSITY verbose",
            `select 1 from auth.users where id = '${learner.id}' for update nowait;`,
          ].join("\n"),
        ),
      ).toThrow(/55P03/);

      await tx.finish("COMMIT");
      tx = undefined;
      const result = await pending;

      expect(result.error).toBeNull();
      expect(runLocalPsql(`select count(*) from auth.users where id = '${learner.id}';`)).toBe("0");
      expect(runLocalPsql(`select count(*) from public.profiles where id = '${learner.id}';`)).toBe("0");
    } finally {
      if (tx) await tx.finish("ROLLBACK").catch(() => {});
    }
  });

  it("makes an email update wait for an open delete RPC and then complete without a deadlock", async () => {
    const learner = await createUser();
    const newEmail = `a5-lock-${randomUUID()}@example.com`;
    let tx: Awaited<ReturnType<typeof beginLocalPostgresTransaction>> | undefined;
    try {
      tx = await beginLocalPostgresTransaction(
        `begin;
         select public.admin_delete_learner('${learner.id}'::uuid);
         select 'A5_RPC_LOCK_HELD|' || pg_backend_pid();`,
        "A5_RPC_LOCK_HELD|",
      );
      const pending = Promise.resolve(service.auth.admin.updateUserById(learner.id, { email: newEmail, email_confirm: true }));
      await waitUntilBlockedBy(tx.pid, pending, "the email update to wait for the open delete RPC");

      await tx.finish("ROLLBACK");
      tx = undefined;
      const result = await pending;

      expect(result.error?.message ?? "").not.toMatch(/deadlock/i);
      expect(result.error).toBeNull();
      expect(runLocalPsql(`select email from public.profiles where id = '${learner.id}';`)).toBe(newEmail);
      expect(runLocalPsql(`select count(*) from auth.users where id = '${learner.id}';`)).toBe("1");
    } finally {
      if (tx) await tx.finish("ROLLBACK").catch(() => {});
    }
  });
});
