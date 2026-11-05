import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { DEMO_COVERS } from "./seed-homepage-demo.mjs";

// U2: thêm khoảng 30 khóa công khai vào DB local để xem /courses với phân trang, học thử, số chủ đề/thẻ và lượt ghi danh.
// Chỉ ghi vào root-local API 45321, trong namespace id f9300000-…; --revert gỡ đúng các hàng này cùng dữ liệu học viên trên đó.
const root = resolve(import.meta.dirname, "../..");
const TEACHER_ID = "22222222-2222-4222-8222-222222222222";
const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const LOCAL_STUDENT_ID = "33333333-3333-4333-8333-333333333333";
const DAY = 24 * 60 * 60 * 1000;
const id = (kind, index) => `f9300000-0000-4000-8000-${kind}${String(index).padStart(10, "0")}`;

// [title, price, daysAgo, enrolled, recent30, topics, cardsPerTopic, preview, hasCover, hasOwner, description]
const COURSES = [
  ["TOEIC 600+ cấp tốc trong 8 tuần", 499000, 12, 58, 24, 8, 12, true, true, true, "Lộ trình từ vựng theo 7 phần thi, mỗi tuần một nhóm chủ đề kèm đề luyện ngắn."],
  ["3000 từ vựng tiếng Anh thông dụng nhất", 0, 200, 60, 9, 8, 12, true, true, true, "Những từ xuất hiện nhiều nhất trong hội thoại và văn bản, chia theo tần suất."],
  ["Giao tiếp công sở: email và cuộc họp", 349000, 45, 41, 18, 6, 10, true, true, true, "Cụm từ dùng ngay cho email, cuộc họp và báo cáo tiến độ."],
  ["IELTS Vocabulary Band 6.5–7.0", 590000, 90, 47, 7, 8, 12, true, true, true, "Từ vựng học thuật theo 12 chủ đề thường gặp trong IELTS."],
  ["Tiếng Anh du lịch: sân bay, khách sạn, nhà hàng", 0, 20, 30, 15, 4, 10, true, true, true, "Mẫu câu và từ vựng cho từng bước chuyến đi."],
  ["Phrasal verbs qua tình huống đời thường", 199000, 150, 22, 2, 5, 8, false, true, true, "300 cụm động từ hay dùng nhất, học qua đoạn hội thoại ngắn."],
  ["Từ vựng IT cho lập trình viên", 299000, 5, 12, 12, 5, 9, true, true, true, "Thuật ngữ trong tài liệu kỹ thuật, code review và họp sprint."],
  ["Tiếng Anh cho người mới bắt đầu", 0, 300, 59, 8, 6, 10, true, true, true, "Bắt đầu từ chào hỏi, số đếm và đồ vật quanh nhà."],
  ["Collocations nâng cao cho bài viết học thuật", 450000, 60, 14, 3, 7, 8, true, true, true, "Kết hợp từ tự nhiên cho essay và báo cáo."],
  ["Tiếng Nhật N5: 800 từ đầu tiên", 390000, 33, 20, 6, 6, 12, true, true, true, "Từ vựng N5 kèm hiragana, kanji và câu ví dụ."],
  ["Thành ngữ tiếng Anh thường gặp trong phim", 0, 120, 36, 4, 4, 6, false, true, true, "Thành ngữ và cách nói xuất hiện nhiều trong phim và series."],
  ["Từ vựng y khoa cơ bản cho điều dưỡng", 520000, 75, 5, 1, 6, 10, true, false, false, null],
  ["TOEIC Listening Part 1–4: từ khóa thường gặp", 279000, 110, 27, 3, 4, 12, true, true, true, "Từ khóa và bẫy nghe thường gặp trong bốn phần nghe TOEIC."],
  ["Tiếng Hàn sơ cấp: gia đình và trường học", 0, 25, 18, 10, 3, 10, true, true, true, "Từ vựng tiếng Hàn sơ cấp theo chủ đề gần gũi."],
  ["Business English: đàm phán và thuyết trình", 690000, 180, 19, 1, 7, 10, true, true, true, "Ngôn ngữ đàm phán, trình bày số liệu và trả lời câu hỏi khó."],
  ["Từ vựng IELTS Speaking theo chủ đề", 350000, 40, 33, 11, 8, 10, true, true, true, "Ý tưởng và từ vựng cho các chủ đề Speaking Part 1–3."],
  ["Tiếng Anh cho trẻ em: con vật và màu sắc", 0, 95, 25, 2, 3, 6, true, true, true, "Thẻ hình minh họa giúp bé học từ qua hình ảnh và âm thanh."],
  ["Từ vựng kinh tế – tài chính", 420000, 140, 10, 1, 6, 10, false, false, true, "Thuật ngữ báo cáo tài chính, thị trường và ngân hàng."],
  ["Ngữ âm và những từ dễ đọc sai", 0, 70, 44, 5, 4, 7, true, true, true, "Những từ người Việt hay phát âm sai, luyện qua audio."],
  ["Tiếng Trung HSK 1: 150 từ nền tảng", 250000, 55, 16, 4, 4, 9, true, true, true, "Từ vựng HSK 1 kèm pinyin, nét chữ và câu ví dụ ngắn."],
  ["Từ vựng marketing và mạng xã hội", 330000, 18, 9, 9, 5, 9, true, true, true, "Thuật ngữ quảng cáo số, nội dung và chỉ số đo lường."],
  ["Tiếng Anh khách sạn – nhà hàng", 0, 160, 21, 1, 5, 8, true, true, true, "Mẫu câu phục vụ khách và xử lý phàn nàn."],
  ["Từ đồng nghĩa – trái nghĩa cho bài thi", 180000, 210, 13, 0, 5, 8, false, true, true, "Nhóm từ đồng nghĩa và trái nghĩa hay xuất hiện trong đề thi."],
  ["TOEIC Reading: từ vựng Part 5–7", 320000, 85, 26, 3, 6, 10, true, true, true, "Từ vựng và cấu trúc hay gặp trong Part 5–7."],
  ["Tiếng Anh pháp lý nhập môn: hợp đồng, điều khoản và thuật ngữ tố tụng thường gặp", 750000, 240, 3, 0, 8, 10, true, true, true, "Thuật ngữ hợp đồng và tố tụng cơ bản cho sinh viên luật và người làm pháp chế, kèm ví dụ trích từ hợp đồng mẫu và giải thích từng điều khoản thường gặp để người học đọc hiểu văn bản pháp lý tiếng Anh mà không phải tra từ liên tục."],
  ["Học từ qua tin tức hằng tuần", 0, 8, 12, 12, 2, 8, true, true, true, "Mỗi tuần một chủ đề thời sự, chọn lọc từ mới đáng nhớ nhất."],
  ["IELTS Writing Task 1: mô tả biểu đồ", 299000, 65, 23, 7, 4, 9, true, true, true, "Động từ và cấu trúc mô tả xu hướng, so sánh số liệu."],
  ["Tiếng Anh phỏng vấn xin việc", 240000, 35, 31, 13, 4, 8, true, true, true, "Cách giới thiệu bản thân và trả lời câu hỏi hành vi."],
  ["Động từ bất quy tắc qua thẻ ghi nhớ", 0, 260, 55, 3, 3, 12, true, true, true, "180 động từ bất quy tắc chia thành nhóm có quy luật."],
  ["Tiếng Anh giao tiếp hằng ngày trong 30 ngày", 0, 3, 6, 6, 4, 6, true, true, true, "Mỗi ngày một chủ đề giao tiếp ngắn để duy trì thói quen."],
];

export const catalogDemoCourseIds = COURSES.map((_, index) => id("01", index + 1));
// Hai khóa cho QA nhãn "Đang học" của tài khoản student@gmail.com.
const LOCAL_STUDENT_COURSES = new Set([3, 8]);

export function assertCatalogDemoTarget(apiUrl) {
  if (new URL(apiUrl).origin !== "http://127.0.0.1:45321") {
    throw new Error("Catalog demo writes only to root-local API 45321; hosted/E2E targets are refused.");
  }
}

function checked(result, operation) {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
  return result.data;
}

function iso(daysAgo) {
  return new Date(Date.now() - daysAgo * DAY).toISOString();
}

export function buildCatalogDemoRows(demoStudentIds) {
  const rows = { courses: [], collaborators: [], chapters: [], topics: [], cards: [], enrollments: [] };
  COURSES.forEach(([title, price, daysAgo, enrolled, recent, topicCount, cardsPerTopic, preview, hasCover, hasOwner, description], courseIndex) => {
    const n = courseIndex + 1;
    const courseId = id("01", n);
    rows.courses.push({
      id: courseId,
      title,
      slug: `u2-demo-${n}`,
      description,
      thumbnail_url: hasCover ? DEMO_COVERS[courseIndex % DEMO_COVERS.length] : null,
      price,
      status: "published",
      order_index: 200 + n,
      created_at: iso(daysAgo),
    });
    if (hasOwner) {
      rows.collaborators.push({ id: id("05", n), course_id: courseId, user_id: TEACHER_ID, role: "owner", added_by: ADMIN_ID });
    }
    const chapterIds = [id("02", n * 10 + 1), id("02", n * 10 + 2)];
    chapterIds.forEach((chapterId, chapterIndex) => {
      rows.chapters.push({ id: chapterId, course_id: courseId, created_by_user_id: TEACHER_ID, title: `Chương ${chapterIndex + 1}`, order_index: chapterIndex + 1 });
    });
    for (let t = 1; t <= topicCount; t++) {
      const topicId = id("03", n * 100 + t);
      const chapterIndex = t <= Math.ceil(topicCount / 2) ? 0 : 1;
      rows.topics.push({
        id: topicId,
        course_id: courseId,
        chapter_id: chapterIds[chapterIndex],
        title: `Chủ đề ${t}`,
        slug: `u2-demo-${n}-topic-${t}`,
        status: "published",
        order_index: t,
        is_preview: preview && t === 1,
        original_creator_user_id: TEACHER_ID,
        responsible_author_user_id: TEACHER_ID,
        first_approved_at: iso(daysAgo),
      });
      for (let c = 1; c <= cardsPerTopic; c++) {
        rows.cards.push({
          id: id("04", n * 10000 + t * 100 + c),
          topic_id: topicId,
          front_content: { word: `word ${t}.${c}` },
          back_content: { meaning: `nghĩa ${t}.${c}` },
          order_index: c,
        });
      }
    }
    // Lượt ghi danh lấy lần lượt từ học viên demo; `recent` lượt đầu nằm trong 30 ngày, phần còn lại cũ hơn.
    const learners = Array.from({ length: Math.min(enrolled, demoStudentIds.length) }, (_, i) => demoStudentIds[(courseIndex * 7 + i) % demoStudentIds.length]);
    if (LOCAL_STUDENT_COURSES.has(n)) learners.push(LOCAL_STUDENT_ID);
    [...new Set(learners)].forEach((userId, i) => {
      rows.enrollments.push({ user_id: userId, course_id: courseId, enrolled_at: iso(i < recent ? (i % 28) + 1 : 40 + ((i * 11) % 160)) });
    });
  });
  return rows;
}

export async function applyCatalogDemo(env, mode) {
  assertCatalogDemoTarget(env.NEXT_PUBLIC_SUPABASE_URL);
  const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const existing = checked(await service.from("courses").select("id, slug").in("id", catalogDemoCourseIds), "Inspect demo courses");
  if (existing.some((row) => !row.slug.startsWith("u2-demo-"))) {
    throw new Error("A demo course ID is occupied by another course; refusing to touch it.");
  }

  if (mode === "revert") {
    if (existing.length === 0) return { reverted: 0 };
    const ids = existing.map((row) => row.id);
    // Không xóa lịch sử thanh toán hay mã giảm giá: nếu QA đã tạo chúng trên khóa demo thì dừng để người dùng tự quyết.
    for (const table of ["payments", "discounts"]) {
      const rows = checked(await service.from(table).select("id").in("course_id", ids).limit(1), `Inspect ${table}`);
      if (rows.length) throw new Error(`Demo courses have ${table}; remove them manually before --revert.`);
    }
    const topicIds = checked(await service.from("topics").select("id").in("course_id", ids), "Read demo topics").map((row) => row.id);
    for (let i = 0; i < topicIds.length; i += 100) {
      checked(await service.from("user_topic_progress").delete().in("topic_id", topicIds.slice(i, i + 100)), "Delete demo progress");
    }
    checked(await service.from("questions").delete().in("course_id", ids), "Delete demo questions");
    checked(await service.from("exercises").delete().in("course_id", ids), "Delete demo exercises");
    checked(await service.from("enrollments").delete().in("course_id", ids), "Delete demo enrollments");
    // Chương xóa kéo theo chủ đề, thẻ, thẻ của học viên và hoạt động học (FK cascade).
    checked(await service.from("chapters").delete().in("course_id", ids), "Delete demo chapters");
    const removed = checked(await service.from("courses").delete().in("id", ids).select("id"), "Delete demo courses");
    return { reverted: removed.length };
  }

  if (existing.length === catalogDemoCourseIds.length) return { applied: 0, alreadyPresent: existing.length };
  if (existing.length > 0) throw new Error("Demo courses are partially present; run --revert first.");
  const demoStudentIds = checked(
    await service
      .from("profiles")
      .select("id")
      .gte("id", "f9200000-0000-4000-8000-000000000000")
      .lte("id", "f9200000-0000-4000-8000-ffffffffffff")
      .eq("role", "student")
      .is("removed_at", null)
      .order("id"),
    "Read demo students",
  ).map((row) => row.id);
  if (demoStudentIds.length < 60) throw new Error("Expected at least 60 local demo students (f9200000-…); run the teacher portfolio demo first.");

  const rows = buildCatalogDemoRows(demoStudentIds);
  checked(await service.from("courses").insert(rows.courses), "Insert demo courses");
  checked(await service.from("course_collaborators").insert(rows.collaborators), "Insert demo owners");
  checked(await service.from("chapters").insert(rows.chapters), "Insert demo chapters");
  checked(await service.from("topics").insert(rows.topics), "Insert demo topics");
  for (let i = 0; i < rows.cards.length; i += 500) {
    checked(await service.from("cards").insert(rows.cards.slice(i, i + 500)), "Insert demo cards");
  }
  checked(await service.from("enrollments").insert(rows.enrollments), "Insert demo enrollments");
  return { applied: rows.courses.length, topics: rows.topics.length, cards: rows.cards.length, enrollments: rows.enrollments.length };
}

async function main() {
  const mode = process.argv.includes("--apply") ? "apply" : process.argv.includes("--revert") ? "revert" : null;
  if (!mode) throw new Error("Use --apply to add the catalog demo courses or --revert to remove them.");
  const config = readFileSync(resolve(root, "supabase/config.toml"), "utf8");
  if (!/^project_id\s*=\s*"voca_space"/m.test(config)) throw new Error("Expected root project voca_space.");
  const command = process.platform === "win32" ? "cmd.exe" : "npx";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npx --no-install supabase status -o env"]
      : ["--no-install", "supabase", "status", "-o", "env"];
  const status = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" },
  });
  if (status.status !== 0) throw new Error("Root Supabase status is unavailable; start the existing local runtime first.");
  const values = Object.fromEntries(
    status.stdout.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^([A-Z0-9_]+)="(.*)"$/);
      return match ? [[match[1], match[2]]] : [];
    }),
  );
  const result = await applyCatalogDemo(
    { NEXT_PUBLIC_SUPABASE_URL: values.API_URL, SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY },
    mode,
  );
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
