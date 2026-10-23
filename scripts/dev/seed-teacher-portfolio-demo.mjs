import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = resolve(import.meta.dirname, "../..");
const actors = {
  admin: "11111111-1111-4111-8111-111111111111",
  teacher: "22222222-2222-4222-8222-222222222222",
  editor: "99999999-9999-4999-8999-999999999991",
  previewer: "99999999-9999-4999-8999-999999999992",
};
const courseNames = [
  "Giao tiếp tiếng Anh trong công việc",
  "Phát âm căn bản — từ âm đơn đến hội thoại tự nhiên",
  "TOEIC 650 — lộ trình cho người học bận rộn",
  "Viết email chuyên nghiệp bằng tiếng Anh",
  "Từ vựng du lịch và tình huống tại sân bay",
  "Luyện nghe qua câu chuyện hằng ngày",
  "Tiếng Anh thuyết trình và phản biện",
  "Hội thoại nâng cao cho giáo viên và cộng tác viên cùng phát triển nội dung bài học thực tế",
];
const id = (kind, index) => `f9200000-0000-4000-8000-${kind}${String(index).padStart(10, "0")}`;
export const portfolioDemoCourseIds = Array.from({ length: 16 }, (_, i) => id("01", i + 1));

export function assertPortfolioDemoTarget(apiUrl) {
  if (new URL(apiUrl).origin !== "http://127.0.0.1:45321") {
    throw new Error("Portfolio demo writes only to root-local API 45321; hosted/E2E targets are refused.");
  }
}

function checked(result, operation) {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
  return result.data;
}

export async function seedTeacherPortfolioDemo(env) {
  assertPortfolioDemoTarget(env.NEXT_PUBLIC_SUPABASE_URL);
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, options);
  const clients = {};
  for (const actor of Object.keys(actors)) {
    clients[actor] = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
    const signedIn = checked(await clients[actor].auth.signInWithPassword({ email: `${actor}@gmail.com`, password: "123123" }), `Sign in ${actor}`);
    if (signedIn.user.id !== actors[actor]) throw new Error(`Unexpected seeded actor: ${actor}`);
  }

  // Chỉ thêm record còn thiếu trong namespace riêng; chạy lại không khôi phục lời mời đã xử lý hay ghi đè dữ liệu Owner.
  async function ensure(table, row, identity = { id: row.id }) {
    let query = service.from(table).select("*");
    for (const [column, value] of Object.entries(identity)) query = query.eq(column, value);
    const existing = checked(await query.maybeSingle(), `Inspect ${table}`);
    if (existing) {
      if (table === "courses" && existing.slug !== row.slug) throw new Error("Demo course ID is occupied or was edited; refusing to overwrite it.");
      return existing;
    }
    return checked(await service.from(table).insert(row).select("*").single(), `Insert ${table}`);
  }
  async function rpc(client, name, args) {
    return checked(await client.rpc(name, args), name);
  }

  for (let index = 1; index <= 16; index++) {
    const invitation = index > 8;
    const courseId = portfolioDemoCourseIds[index - 1];
    await ensure("courses", {
      id: courseId,
      title: `[UI demo] ${invitation ? "Cộng tác — " : ""}${courseNames[(index - 1) % 8]}`,
      slug: `ui-demo-portfolio-${index}`,
      description: "Dữ liệu local để kiểm tra danh sách dày, phản hồi và lời mời cộng tác. Không phải khóa học thật.",
      status: "draft",
      price: 0,
      order_index: index + 100,
      ...(index <= 4 ? {
        reject_message: "Bổ sung mục tiêu đầu ra, mô tả đối tượng học và ví dụ thực hành trước khi gửi lại khóa học để xét duyệt.",
        reviewed_at: `2026-10-${String(index + 10).padStart(2, "0")}T08:00:00Z`,
      } : {}),
    });
    const members = invitation ? [["admin", "owner", false]] : [
      ["admin", "owner", false],
      ["teacher", index === 8 ? "previewer" : index === 7 ? "editor" : "co_owner", true],
      ["editor", "editor", false],
      ["previewer", "previewer", true],
    ];
    for (const [actor, role, review] of members) {
      await ensure("course_collaborators", { course_id: courseId, user_id: actors[actor], role, can_review_topics: review, added_by: actors.admin }, { course_id: courseId, user_id: actors[actor] });
    }
    if (!invitation) {
      await ensure("chapters", { id: id("02", index), course_id: courseId, created_by_user_id: actors.admin, title: "Nền tảng và thực hành", order_index: 1 });
    } else {
      const existing = checked(await service.from("course_collaborator_invitations").select("id").eq("course_id", courseId).eq("invitee_user_id", actors.teacher).limit(1), "Inspect invitation");
      if (!existing.length) await rpc(clients.admin, "send_course_collaborator_invitation", {
        p_course_id: courseId,
        p_email: "teacher@gmail.com",
        p_role: index % 3 === 0 ? "previewer" : index % 3 === 1 ? "editor" : "co_owner",
        p_can_review_topics: index % 3 === 0,
      });
    }
  }

  for (let index = 1; index <= 16; index++) {
    const correction = index > 10;
    const courseIndex = correction ? index - 10 : (index - 1) % 8 + 1;
    const courseId = portfolioDemoCourseIds[courseIndex - 1];
    const topicId = id("03", index);
    const creator = correction ? "teacher" : "editor";
    const topic = await ensure("topics", {
      id: topicId, course_id: courseId, chapter_id: id("02", courseIndex),
      title: correction ? `[UI demo] Bài ${index - 10} — bổ sung ví dụ và giải thích đáp án` : `[UI demo] Bài ${index} — hội thoại, từ vựng và bài tập thực hành`,
      status: "draft", order_index: index,
      original_creator_user_id: actors[creator], responsible_author_user_id: actors[creator],
    });
    const latest = checked(await service.from("topic_review_submissions").select("id,status").eq("topic_id", topicId).order("submitted_at", { ascending: false }).order("id", { ascending: false }).limit(1), "Inspect submission")[0];
    if (latest && latest.status !== "pending") continue;
    if (topic.status === "draft" && !latest) {
      await ensure("cards", { id: id("04", index), topic_id: topicId, front_content: { word: "conversation", phonetic: "/ˌkɒnvəˈseɪʃən/" }, back_content: { translation: "Cuộc hội thoại" }, order_index: 0 });
      await ensure("exercises", { id: id("05", index), topic_id: topicId, course_id: courseId, title: "Chọn cách diễn đạt phù hợp", part_type: "part5", order_index: 0 });
      await rpc(clients[creator], "request_topic_review", { p_topic_id: topicId });
    }
    if (correction) {
      const pending = checked(await service.from("topic_review_submissions").select("id").eq("topic_id", topicId).eq("status", "pending").single(), "Inspect pending correction");
      await rpc(clients.previewer, "reject_topic_review", { p_submission_id: pending.id, p_reason: "Cần thêm ví dụ ngữ cảnh, giải thích đáp án và kiểm tra dấu tiếng Việt. Giữ lại phần nội dung đã tốt rồi gửi lại khi hoàn tất." });
    }
  }

  // Trang Tổng quan (TOV1): khóa 6 có bài đã xuất bản, học viên ghi danh rải trong 6 tháng và tiến độ đủ ba nhóm;
  // khóa 2 giữ nguyên không có học viên. Bài được xuất bản qua đúng luồng gửi duyệt/duyệt, không ghi thẳng trạng thái.
  const insightsCourseIndex = 6;
  const insightsCourseId = portfolioDemoCourseIds[insightsCourseIndex - 1];
  const publishedTopicIds = [];
  for (let index = 1; index <= 3; index++) {
    const topicId = id("06", index);
    publishedTopicIds.push(topicId);
    const topic = await ensure("topics", {
      id: topicId, course_id: insightsCourseId, chapter_id: id("02", insightsCourseIndex),
      title: `[UI demo] Bài đã xuất bản ${index} — chào hỏi và giới thiệu`, status: "draft", order_index: 100 + index,
      original_creator_user_id: actors.editor, responsible_author_user_id: actors.editor,
    });
    if (topic.status === "published") continue;
    const latest = checked(await service.from("topic_review_submissions").select("id,status").eq("topic_id", topicId).order("submitted_at", { ascending: false }).order("id", { ascending: false }).limit(1), "Inspect insights submission")[0];
    if (!latest) {
      await ensure("cards", { id: id("10", index), topic_id: topicId, front_content: { word: "greeting", phonetic: "/ˈɡriːtɪŋ/" }, back_content: { translation: "Lời chào" }, order_index: 0 });
      await ensure("exercises", { id: id("11", index), topic_id: topicId, course_id: insightsCourseId, title: "Chọn lời chào phù hợp", part_type: "part5", order_index: 0 });
      await rpc(clients.editor, "request_topic_review", { p_topic_id: topicId });
    }
    const pending = checked(await service.from("topic_review_submissions").select("id").eq("topic_id", topicId).eq("status", "pending").maybeSingle(), "Inspect insights pending");
    if (pending) await rpc(clients.previewer, "approve_topic_review", { p_submission_id: pending.id });
  }

  // 24 học viên giả: số ghi danh theo tháng (cũ → mới) và nhóm tiến độ cố định; tháng tính lùi từ hôm nay khi tạo lần đầu.
  const monthlyEnrollments = [2, 3, 4, 5, 6, 4];
  const now = new Date();
  let learnerIndex = 0;
  for (const [offset, count] of monthlyEnrollments.entries()) {
    for (let slot = 0; slot < count; slot++) {
      learnerIndex += 1;
      const learnerId = id("07", learnerIndex);
      const existingUser = await service.auth.admin.getUserById(learnerId);
      if (existingUser.error || !existingUser.data?.user) {
        checked(await service.auth.admin.createUser({
          id: learnerId,
          email: `ui-demo-learner-${learnerIndex}@example.test`,
          password: `${randomUUID()}aA1!`,
          email_confirm: true,
          user_metadata: { full_name: `Học viên demo ${learnerIndex}` },
          app_metadata: { d7_server_created: true },
        }), `Create learner ${learnerIndex}`);
      }
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (monthlyEnrollments.length - 1 - offset), 1, 3));
      const enrolledAt = new Date(Math.min(monthStart.getTime() + slot * 86_400_000, now.getTime()));
      await ensure("enrollments", { id: id("08", learnerIndex), user_id: learnerId, course_id: insightsCourseId, enrolled_at: enrolledAt.toISOString() }, { user_id: learnerId, course_id: insightsCourseId });
      // 1–6: chưa học; 7–10: có dòng tiến độ nhưng chưa xong bài nào (vẫn "Chưa bắt đầu"); 11–20: xong 1–2 bài; 21–24: xong cả 3.
      const completedTopics = learnerIndex <= 10 ? 0 : learnerIndex <= 20 ? 1 + (learnerIndex % 2) : 3;
      const progressTopics = learnerIndex <= 6 ? [] : publishedTopicIds.slice(0, Math.max(1, completedTopics));
      for (const [topicOrder, topicId] of progressTopics.entries()) {
        const completed = topicOrder < completedTopics;
        await ensure("user_topic_progress", {
          user_id: learnerId, topic_id: topicId, is_flashcard_completed: completed, is_exercise_completed: completed,
          is_topic_completed: completed, completed_at: completed ? enrolledAt.toISOString() : null,
        }, { user_id: learnerId, topic_id: topicId });
      }
    }
  }

  const portfolio = await rpc(clients.teacher, "get_teacher_course_portfolio");
  const insights = await rpc(clients.teacher, "get_teacher_course_insights", { p_course_id: insightsCourseId });
  const demoItems = portfolio.attention.filter(item => portfolioDemoCourseIds.includes(item.course_id));
  const invitations = checked(await service.from("course_collaborator_invitations").select("id").in("course_id", portfolioDemoCourseIds).eq("invitee_user_id", actors.teacher).eq("status", "pending"), "Count invitations");
  return {
    actor: "teacher@gmail.com",
    demoCourses: portfolio.courses.filter(course => portfolioDemoCourseIds.includes(course.id)).length,
    demoAttention: demoItems.length,
    review: demoItems.filter(item => item.kind === "topic_review").length,
    topicCorrection: demoItems.filter(item => item.kind === "topic_correction").length,
    courseCorrection: demoItems.filter(item => item.kind === "course_rejection").length,
    pendingInvitations: invitations.length,
    totalVisibleCourses: portfolio.courses.length,
    insightsCourseId,
    insightsEnrollments: insights.enrollment_total,
    insightsProgress: insights.progress,
    emptyInsightsCourseId: portfolioDemoCourseIds[1],
  };
}

async function main() {
  if (!process.argv.includes("--apply")) throw new Error("Use --apply to add the local demo. Existing records and actioned invitations are preserved.");
  const config = readFileSync(resolve(root, "supabase/config.toml"), "utf8");
  if (!/^project_id\s*=\s*"voca_space"/m.test(config)) throw new Error("Expected root project voca_space.");
  const command = process.platform === "win32" ? "cmd.exe" : "npx";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", "npx --no-install supabase status -o env"] : ["--no-install", "supabase", "status", "-o", "env"];
  const status = spawnSync(command, args, { cwd: root, encoding: "utf8", env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" } });
  if (status.status !== 0) throw new Error("Root Supabase status is unavailable; start the existing local runtime first.");
  const values = Object.fromEntries(status.stdout.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^([A-Z0-9_]+)="(.*)"$/);
    return match ? [[match[1], match[2]]] : [];
  }));
  const result = await seedTeacherPortfolioDemo({ NEXT_PUBLIC_SUPABASE_URL: values.API_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: values.ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
