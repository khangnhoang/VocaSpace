import { deflateSync, crc32 } from "node:zlib";
import { createSupabaseAdmin } from "./support/supabase-admin.mjs";
import { ensureWorkerAccount } from "./support/worker-accounts.mjs";
import { assertIsolatedRuntime } from "./support/worker-scope.mjs";

// D8-LUI: synthetic content matrix (vocabulary, TOEIC Part 1-7, memory check, media
// faults) for reviewing the learning workspace. All ids, slugs and storage paths are
// deterministic, so seeding twice replaces the previous rows and cleanup needs no state.
// Nothing here is personal data. The learner is the canonical seeded student.

const ADMIN_ID = "11111111-1111-4111-8111-111111111111";
const IMAGE_BUCKET = "question_group_images";
const AUDIO_BUCKET = "question_group_audios";

export const MATRIX_COURSE_SLUG = "d8-learning-matrix";
export const MATRIX_TOPICS = {
  vocabulary: { slug: "d8-matrix-vocabulary", title: "D8 Từ vựng và thẻ dài" },
  listening: { slug: "d8-matrix-listening", title: "D8 Nghe Part 1-4" },
  reading: { slug: "d8-matrix-reading", title: "D8 Đọc Part 5-7" },
  memory: { slug: "d8-matrix-memory-check", title: "D8 Memory check rồi bài tập" },
  faults: { slug: "d8-matrix-media-faults", title: "D8 Media lỗi hoặc thiếu" },
  // Appended last so the existing topic ids keep their values; ordered first in the chapter.
  full: { slug: "d8-matrix-full-flow", title: "D8 Bài học trọn vẹn" },
  // LF5: cards and a memory check but no exercises, so the memory pass is the last step. Appended last for the same reason.
  memoryOnly: { slug: "d8-matrix-memory-only", title: "D8 Từ vựng và memory check không bài tập" },
};

function legacyId(n) {
  return `d8a00000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

/**
 * Định danh của ma trận. Không có `scope`: bộ ID cố định cũ, học viên và giáo viên seed (dùng cho CLI QA thủ công).
 * Có `scope` (worker Playwright): course, chương, topic, slug, card, giáo viên và học viên đều riêng của worker, nên
 * nhiều worker seed/dọn ma trận song song mà không chạm nhau hay chạm học viên seed.
 */
export function matrixFor(scope) {
  if (!scope) {
    return {
      scoped: false,
      id: legacyId,
      courseId: legacyId(1),
      chapterId: legacyId(2),
      courseSlug: MATRIX_COURSE_SLUG,
      topics: MATRIX_TOPICS,
      teacher: { id: "22222222-2222-4222-8222-222222222222" },
      student: {
        id: "33333333-3333-4333-8333-333333333333",
        email: "student@gmail.com",
        password: "123123",
      },
    };
  }
  const id = (n) => scope.id(`matrix:${n}`);
  return {
    scoped: true,
    id,
    courseId: id(1),
    chapterId: id(2),
    courseSlug: scope.slug(MATRIX_COURSE_SLUG),
    topics: Object.fromEntries(
      Object.entries(MATRIX_TOPICS).map(([key, topic]) => [key, { ...topic, slug: scope.slug(topic.slug) }]),
    ),
    teacher: scope.extraTeacher("matrix"),
    student: scope.student,
  };
}

function assertSyntheticTarget(env, { allowDevDatabase }) {
  const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const loopback = url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
  const isolated = env.E2E_SUPABASE_WORKDIR === ".e2e-runtime" && url.port === "45441";
  const dev = allowDevDatabase && url.port === "45321";
  if (!loopback || !(isolated || dev)) {
    throw new Error(
      "The D8 matrix fixture only writes to the isolated E2E runtime (45441), " +
        "or to the root local dev database (45321) when the Owner passes --allow-dev-db.",
    );
  }
}

// Chế độ worker-scoped (có `scope`) chỉ chạy trên runtime E2E cô lập và không bao giờ nhận cờ ghi vào DB dev;
// chế độ cũ không có `scope` giữ nguyên quyền ghi vào DB dev khi Owner truyền --allow-dev-db.
function assertMatrixTarget(env, options) {
  if (options.scope) {
    if (options.allowDevDatabase === true) {
      throw new Error("A worker-scoped matrix never writes to the dev database; drop allowDevDatabase.");
    }
    assertIsolatedRuntime(env);
    return;
  }
  assertSyntheticTarget(env, { allowDevDatabase: options.allowDevDatabase === true });
}

function checked(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

/** A readable gradient with diagonal bands, so cropping or stretching is visible. */
function makePng(width, height, hue) {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x += 1) {
      const band = Math.floor((x + y) / 48) % 2 === 0;
      const base = band ? 235 : 205;
      const o = 1 + x * 3;
      row[o] = Math.min(255, base - (hue === 0 ? 40 : 0) + Math.floor((x / width) * 20));
      row[o + 1] = Math.min(255, base - (hue === 1 ? 40 : 0) + Math.floor((y / height) * 20));
      row[o + 2] = Math.min(255, base - (hue === 2 ? 40 : 0));
    }
    rows.push(row);
  }
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Quiet 440 Hz tone, long enough to scrub and replay. */
function makeWav(seconds = 8) {
  const rate = 8000;
  const samples = rate * seconds;
  const data = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i += 1) {
    data.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 2500), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const LONG_PASSAGE = Array.from(
  { length: 14 },
  (_, i) =>
    `Đoạn ${i + 1}. The regional sales team reviewed the quarterly report, compared the figures with last year's targets, and agreed that the new scheduling policy should be introduced gradually across all branch offices before the end of the fiscal year.`,
).join("\n\n");

export async function seedLearningWorkspaceMatrix(env = process.env, options = {}) {
  assertMatrixTarget(env, options);
  const m = matrixFor(options.scope);
  const supabase = createSupabaseAdmin(env);
  if (m.scoped) {
    await ensureWorkerAccount(supabase, m.teacher, "teacher");
    await ensureWorkerAccount(supabase, m.student, "student");
  }
  await cleanupLearningWorkspaceMatrix(env, options);

  let counter = 100;
  const next = () => m.id(++counter);
  const uploaded = [];
  const topicIds = Object.fromEntries(Object.keys(m.topics).map((key, index) => [key, m.id(10 + index)]));

  async function upload(bucket, name, bytes, contentType, topicKey) {
    const path = `${m.courseId}/${topicIds[topicKey]}/${m.teacher.id}/${name}`;
    // The storage gateway can answer 502 right after a database reset, so retry for up to a minute.
    let result;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      result = await supabase.storage.from(bucket).upload(path, new Blob([bytes], { type: contentType }), {
        contentType,
        upsert: true,
      });
      if (!result.error) break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    checked(result, `Upload ${name}`);
    uploaded.push([bucket, path]);
    return `storage://${bucket}/${path}`;
  }

  checked(
    await supabase.from("courses").insert({
      id: m.courseId,
      title: "D8 Learning matrix (synthetic)",
      slug: m.courseSlug,
      description: "Synthetic content for reviewing the learning workspace layouts.",
      price: 0,
      status: "published",
      removed_at: null,
    }),
    "Create course",
  );
  checked(
    await supabase.from("course_collaborators").insert({
      course_id: m.courseId,
      user_id: m.teacher.id,
      role: "owner",
      added_by: ADMIN_ID,
      can_review_topics: false,
    }),
    "Add course owner",
  );
  checked(
    await supabase.from("chapters").insert({
      id: m.chapterId,
      course_id: m.courseId,
      created_by_user_id: m.teacher.id,
      title: "D8 Ma trận nội dung",
      order_index: 1,
      removed_at: null,
    }),
    "Create chapter",
  );
  checked(
    await supabase.from("topics").insert(
      Object.entries(m.topics).map(([key, topic], index) => ({
        id: topicIds[key],
        course_id: m.courseId,
        chapter_id: m.chapterId,
        title: topic.title,
        slug: topic.slug,
        status: "published",
        order_index: key === "full" ? 0 : index + 1,
        original_creator_user_id: m.teacher.id,
        responsible_author_user_id: m.teacher.id,
        first_approved_at: "2026-01-10T12:00:00.000Z",
        removed_at: null,
        is_preview: key === "full",
      })),
    ),
    "Create topics",
  );
  checked(
    await supabase.from("enrollments").insert({ user_id: m.student.id, course_id: m.courseId }),
    "Enroll learner",
  );

  checked(
    await supabase.from("cards").insert([
      {
        id: next(),
        topic_id: topicIds.vocabulary,
        front_content: { word: "reliable", pos: "adj", phonetic: "/rɪˈlaɪəbl/" },
        back_content: { translation: "đáng tin cậy", example: "A reliable partner always replies on time.", exampleTranslation: "Một đối tác đáng tin cậy luôn trả lời đúng hạn." },
        order_index: 0,
        removed_at: null,
      },
      {
        id: next(),
        topic_id: topicIds.vocabulary,
        front_content: { word: "incomprehensibilities", pos: "noun", phonetic: "/ˌɪnkɒmprɪˌhensɪˈbɪlɪtiz/" },
        back_content: {
          translation: "những điều không thể hiểu nổi",
          example: "The contract was full of incomprehensibilities that nobody could explain. ".repeat(3),
          exampleTranslation: "Bản hợp đồng đầy những điều không thể hiểu nổi mà không ai giải thích được. ".repeat(3),
          explanation: "Danh từ số nhiều, hiếm gặp. Nội dung dài này kiểm tra việc thẻ tự mở rộng chiều cao thay vì cắt chữ. ".repeat(4),
          hint: "Tách thành in-com-prehens-ibilities để nhớ.",
        },
        order_index: 1,
        removed_at: null,
      },
      {
        id: next(),
        topic_id: topicIds.vocabulary,
        front_content: { word: "improve" },
        back_content: { translation: "cải thiện" },
        order_index: 2,
        removed_at: null,
      },
    ]),
    "Create cards",
  );

  async function addExercise(topicKey, order, title, partType, stage = "exercise") {
    const exerciseId = next();
    checked(
      await supabase.from("exercises").insert({
        id: exerciseId,
        course_id: m.courseId,
        topic_id: topicIds[topicKey],
        title,
        part_type: partType,
        activity_stage: stage,
        order_index: order,
        removed_at: null,
      }),
      `Create exercise ${title}`,
    );
    return exerciseId;
  }

  async function addGroup(exerciseId, order, media) {
    const groupId = next();
    checked(
      await supabase.from("question_groups").insert({
        id: groupId,
        exercise_id: exerciseId,
        passage_text: media.passage ?? null,
        audio_url: media.audio ?? null,
        image_url: media.image ?? null,
        order_index: order,
        removed_at: null,
      }),
      "Create group",
    );
    return groupId;
  }

  // The first option is always the correct one so the fixture is easy to drive in a browser.
  async function addQuestion(exerciseId, groupId, order, content, options, explanation = "Giải thích: đáp án A phù hợp với ngữ cảnh.") {
    const questionId = next();
    checked(
      await supabase.from("questions").insert({
        id: questionId,
        course_id: m.courseId,
        exercise_id: exerciseId,
        group_id: groupId,
        content,
        explanation,
        order_index: order,
        removed_at: null,
      }),
      "Create question",
    );
    checked(
      await supabase.from("question_options").insert(
        options.map((optionContent, index) => ({
          id: next(),
          question_id: questionId,
          content: optionContent,
          label: String.fromCharCode(65 + index),
          order_index: index,
          is_correct: index === 0,
          removed_at: null,
        })),
      ),
      "Create options",
    );
  }

  const portrait = makePng(480, 720, 0);
  const landscape = makePng(960, 540, 2);
  const wav = makeWav();
  const shortOptions = ["Đáp án đúng", "Đáp án khác", "Đáp án thứ ba", "Đáp án thứ tư"];

  // Listening: Part 1 (picture first), Part 2 (audio band), Part 3 (dialogue, 3 questions), Part 4 (talk + picture).
  const part1 = await addExercise("listening", 1, "Part 1 - Mô tả tranh", "part1");
  const part1Group = await addGroup(part1, 0, {
    image: await upload(IMAGE_BUCKET, "part1-portrait.png", portrait, "image/png", "listening"),
    audio: await upload(AUDIO_BUCKET, "part1.wav", wav, "audio/wav", "listening"),
  });
  await addQuestion(part1, part1Group, 0, "Chọn câu mô tả đúng bức tranh.", ["The man is holding a document.", "The man is closing a door.", "The woman is crossing a street.", "The woman is watering plants."]);
  const part2 = await addExercise("listening", 2, "Part 2 - Hỏi đáp", "part2");
  const part2Group = await addGroup(part2, 0, { audio: await upload(AUDIO_BUCKET, "part2.wav", wav, "audio/wav", "listening") });
  await addQuestion(part2, part2Group, 0, "Chọn câu trả lời phù hợp nhất.", ["On the second floor.", "Yes, it was yesterday.", "Because of the weather."]);
  const part3 = await addExercise("listening", 3, "Part 3 - Hội thoại", "part3");
  const part3Group = await addGroup(part3, 0, { audio: await upload(AUDIO_BUCKET, "part3.wav", wav, "audio/wav", "listening") });
  for (let i = 0; i < 3; i += 1) {
    await addQuestion(part3, part3Group, i, `Câu ${i + 1} về cuộc hội thoại: người nói đang bàn về điều gì?`, ["A delayed shipment", "A new office layout", "A training schedule", "A budget approval"]);
  }
  const part4 = await addExercise("listening", 4, "Part 4 - Bài nói", "part4");
  const part4Group = await addGroup(part4, 0, {
    audio: await upload(AUDIO_BUCKET, "part4.wav", wav, "audio/wav", "listening"),
    image: await upload(IMAGE_BUCKET, "part4-landscape.png", landscape, "image/png", "listening"),
  });
  await addQuestion(part4, part4Group, 0, "Theo biểu đồ, bộ phận nào cần thêm nhân sự?", ["Marketing", "Logistics", "Finance"]);
  await addQuestion(part4, part4Group, 1, "Người nói đề nghị điều gì?", ["Hold a meeting", "Hire a consultant", "Postpone the launch"]);

  // Reading: Part 5 (standalone, long options), Part 6 (passage + gap), Part 7 (long passage + image).
  const part5 = await addExercise("reading", 1, "Part 5 - Điền từ vào câu", "part5");
  await addQuestion(part5, null, 0, "The manager asked us to ______ the report before Friday afternoon so that the committee could review it.", ["submit", "submitting", "submission", "submitted by the end of the working week without any further delay"]);
  await addQuestion(part5, null, 1, "Employees are encouraged to ______ their requests through the online portal.", ["send", "sending", "sender"]);
  const part6 = await addExercise("reading", 2, "Part 6 - Hoàn thành đoạn văn", "part6");
  const part6Group = await addGroup(part6, 0, {
    passage: "To: All staff\nFrom: Human Resources\n\nStarting next month, the company will [1] a flexible work program.\nPlease confirm your preference by the end of this week.\n\nThank you,\nHR Team",
  });
  await addQuestion(part6, part6Group, 0, "Chọn từ phù hợp cho chỗ trống [1].", ["introduce", "introducing", "introduction", "introduced"]);
  await addQuestion(part6, part6Group, 1, "Chọn câu thích hợp để kết thúc thông báo.", ["Contact us if you have questions.", "The parking lot is closed.", "Lunch will be served."]);
  const part7 = await addExercise("reading", 3, "Part 7 - Đọc hiểu", "part7");
  const part7Group = await addGroup(part7, 0, {
    passage: LONG_PASSAGE,
    image: await upload(IMAGE_BUCKET, "part7-landscape.png", landscape, "image/png", "reading"),
  });
  await addQuestion(part7, part7Group, 0, "What is the main purpose of the report?", ["To describe a new policy", "To announce a merger", "To request a refund", "To advertise a product", "To list open positions"]);
  await addQuestion(part7, part7Group, 1, "What will happen before the end of the fiscal year?", ["The policy will be rolled out", "A branch will close", "Targets will be cut"]);

  // Memory check, then an exercise it gates.
  const memoryCheck = await addExercise("memory", 0, "Memory check", null, "memory_check");
  await addQuestion(memoryCheck, null, 0, "Nghĩa của \"reliable\" là gì?", ["đáng tin cậy", "nhanh chóng", "đắt đỏ"], "reliable nghĩa là đáng tin cậy.");
  await addQuestion(memoryCheck, null, 1, "Chọn từ đồng nghĩa với \"improve\".", ["enhance", "ignore", "delay"], "enhance cùng nghĩa với improve.");
  const gated = await addExercise("memory", 1, "Part 5 sau memory check", "part5");
  await addQuestion(gated, null, 0, "Please ______ the form by Monday.", ["return", "returning", "returns"]);

  // Full flow: vocabulary -> memory check on those words -> listening and reading exercises.
  checked(
    await supabase.from("cards").insert(
      [
        ["schedule", "noun", "/ˈʃedjuːl/", "lịch trình", "The schedule changed at the last minute.", "Lịch trình thay đổi vào phút chót."],
        ["deadline", "noun", "/ˈdedlaɪn/", "hạn chót", "The deadline for the report is Friday.", "Hạn chót nộp báo cáo là thứ Sáu."],
        ["approve", "verb", "/əˈpruːv/", "phê duyệt", "The manager approved the budget.", "Quản lý đã phê duyệt ngân sách."],
        ["available", "adj", "/əˈveɪləbl/", "có sẵn, rảnh", "Is the meeting room available now?", "Phòng họp bây giờ có trống không?"],
      ].map(([word, pos, phonetic, translation, example, exampleTranslation], index) => ({
        id: next(),
        topic_id: topicIds.full,
        front_content: { word, pos, phonetic },
        back_content: { translation, example, exampleTranslation },
        order_index: index,
        removed_at: null,
      })),
    ),
    "Create full-flow cards",
  );
  const fullMemory = await addExercise("full", 0, "Memory check", null, "memory_check");
  await addQuestion(fullMemory, null, 0, "Nghĩa của \"deadline\" là gì?", ["hạn chót", "lịch trình", "ngân sách"], "deadline nghĩa là hạn chót.");
  await addQuestion(fullMemory, null, 1, "\"The manager ______ the budget.\" Chọn từ đúng.", ["approved", "available", "schedule"], "approve (phê duyệt) chia quá khứ là approved.");
  await addQuestion(fullMemory, null, 2, "Nghĩa của \"available\" là gì?", ["có sẵn, rảnh", "đáng tin cậy", "hạn chót"], "available nghĩa là có sẵn hoặc rảnh.");
  const fullPart1 = await addExercise("full", 1, "Part 1 - Mô tả tranh", "part1");
  const fullPart1Group = await addGroup(fullPart1, 0, {
    image: await upload(IMAGE_BUCKET, "full-part1.png", landscape, "image/png", "full"),
    audio: await upload(AUDIO_BUCKET, "full-part1.wav", wav, "audio/wav", "full"),
  });
  await addQuestion(fullPart1, fullPart1Group, 0, "Chọn câu mô tả đúng bức tranh.", ["People are reviewing a schedule.", "A man is painting a wall.", "Chairs are stacked in a corner.", "A woman is opening a window."]);
  const fullPart3 = await addExercise("full", 2, "Part 3 - Hội thoại", "part3");
  const fullPart3Group = await addGroup(fullPart3, 0, { audio: await upload(AUDIO_BUCKET, "full-part3.wav", wav, "audio/wav", "full") });
  await addQuestion(fullPart3, fullPart3Group, 0, "Người nói đang bàn về điều gì?", ["A project deadline", "A holiday trip", "A new printer"]);
  await addQuestion(fullPart3, fullPart3Group, 1, "Người phụ nữ đề nghị làm gì?", ["Change the schedule", "Cancel the order", "Call a client"]);
  const fullPart5 = await addExercise("full", 3, "Part 5 - Điền từ vào câu", "part5");
  await addQuestion(fullPart5, null, 0, "The room is ______ for the meeting this afternoon.", ["available", "availability", "avail"]);
  await addQuestion(fullPart5, null, 1, "All requests must be ______ by the director.", ["approved", "approving", "approval"]);
  const fullPart6 = await addExercise("full", 4, "Part 6 - Hoàn thành đoạn văn", "part6");
  const fullPart6Group = await addGroup(fullPart6, 0, {
    passage: "To: Project team\nFrom: Operations\n\nThe [1] for the quarterly report has moved to next Monday.\nPlease update your schedule and share drafts by Friday.\n\nThanks,\nOperations",
  });
  await addQuestion(fullPart6, fullPart6Group, 0, "Chọn từ phù hợp cho chỗ trống [1].", ["deadline", "dead", "deadly", "deadlines are"]);

  // Memory-only: vocabulary and a memory check on it, no exercises (the pass is the last step of the topic).
  checked(
    await supabase.from("cards").insert(
      [
        ["invoice", "noun", "/ˈɪnvɔɪs/", "hóa đơn", "Please send the invoice by email.", "Vui lòng gửi hóa đơn qua email."],
        ["supplier", "noun", "/səˈplaɪər/", "nhà cung cấp", "Our supplier delivers every Monday.", "Nhà cung cấp của chúng tôi giao hàng vào mỗi thứ Hai."],
      ].map(([word, pos, phonetic, translation, example, exampleTranslation], index) => ({
        id: next(),
        topic_id: topicIds.memoryOnly,
        front_content: { word, pos, phonetic },
        back_content: { translation, example, exampleTranslation },
        order_index: index,
        removed_at: null,
      })),
    ),
    "Create memory-only cards",
  );
  const onlyMemory = await addExercise("memoryOnly", 0, "Memory check", null, "memory_check");
  await addQuestion(onlyMemory, null, 0, "Nghĩa của \"invoice\" là gì?", ["hóa đơn", "nhà cung cấp", "hạn chót"], "invoice nghĩa là hóa đơn.");
  await addQuestion(onlyMemory, null, 1, "Nghĩa của \"supplier\" là gì?", ["nhà cung cấp", "hóa đơn", "lịch trình"], "supplier nghĩa là nhà cung cấp.");

  // Media faults: a missing object behind a valid reference, and a group without required audio.
  const faultPart1 = await addExercise("faults", 1, "Part 1 - Ảnh không tải được", "part1");
  const faultGroup = await addGroup(faultPart1, 0, {
    image: `storage://${IMAGE_BUCKET}/${m.courseId}/${topicIds.faults}/${m.teacher.id}/does-not-exist.png`,
    audio: await upload(AUDIO_BUCKET, "fault-part1.wav", wav, "audio/wav", "faults"),
  });
  await addQuestion(faultPart1, faultGroup, 0, "Câu hỏi vẫn làm được khi ảnh lỗi.", shortOptions.slice(0, 3));
  const faultPart2 = await addExercise("faults", 2, "Part 2 - Thiếu âm thanh", "part2");
  const faultGroup2 = await addGroup(faultPart2, 0, {});
  await addQuestion(faultPart2, faultGroup2, 0, "Nhóm này thiếu âm thanh bắt buộc.", shortOptions.slice(0, 3));

  return { courseSlug: m.courseSlug, topics: m.topics, uploaded, student: m.student };
}

/**
 * LF3: a teacher adds a flashcard to the full-flow topic after a learner has loaded it. The id is fixed and the card
 * belongs to the matrix topic, so `cleanupLearningWorkspaceMatrix` removes it (and any learner row on it) with the rest.
 */
export const FULL_FLOW_ADDED_CARD = { word: "negotiate", translation: "đàm phán" };

export async function addFullFlowCard(env = process.env, options = {}) {
  assertMatrixTarget(env, options);
  const m = matrixFor(options.scope);
  const supabase = createSupabaseAdmin(env);
  checked(
    await supabase.from("cards").insert({
      id: m.id(900),
      topic_id: m.id(10 + Object.keys(m.topics).indexOf("full")),
      front_content: { word: FULL_FLOW_ADDED_CARD.word, pos: "verb", phonetic: "/nɪˈɡoʊʃieɪt/" },
      back_content: { translation: FULL_FLOW_ADDED_CARD.translation, example: "They negotiate the price.", exampleTranslation: "Họ thương lượng giá." },
      order_index: 4,
      removed_at: null,
    }),
    "Add full-flow card",
  );
}

export async function cleanupLearningWorkspaceMatrix(env = process.env, options = {}) {
  assertMatrixTarget(env, options);
  const m = matrixFor(options.scope);
  const supabase = createSupabaseAdmin(env);

  const topics = checked(await supabase.from("topics").select("id").eq("course_id", m.courseId), "Read topics");
  const topicIds = topics.map((row) => row.id);
  const questions = checked(await supabase.from("questions").select("id").eq("course_id", m.courseId), "Read questions");
  const questionIds = questions.map((row) => row.id);
  const exercises = checked(await supabase.from("exercises").select("id").eq("course_id", m.courseId), "Read exercises");
  const exerciseIds = exercises.map((row) => row.id);
  const cards = topicIds.length
    ? checked(await supabase.from("cards").select("id").in("topic_id", topicIds), "Read cards")
    : [];
  const cardIds = cards.map((row) => row.id);

  // Gỡ ghi danh trước tiên: trang học vừa đóng vẫn có thể còn request đang chạy (sync tiến độ khi mở bài, lưu thẻ/đáp án).
  // Các RPC đó đều đòi ghi danh, nên sau bước này chúng bị từ chối thay vì tạo lại user_topic_progress giữa lúc dọn,
  // làm bước xóa topics hỏng vì khóa ngoại utp_topic_id_fkey.
  checked(await supabase.from("enrollments").delete().eq("course_id", m.courseId), "Clean enrollment");
  if (questionIds.length) {
    checked(await supabase.from("user_question_answers").delete().in("question_id", questionIds), "Clean answers");
    checked(await supabase.from("question_options").delete().in("question_id", questionIds), "Clean options");
    checked(await supabase.from("questions").delete().in("id", questionIds), "Clean questions");
  }
  if (cardIds.length) checked(await supabase.from("user_flashcards").delete().in("card_id", cardIds), "Clean card state");
  if (topicIds.length) checked(await supabase.from("user_topic_progress").delete().in("topic_id", topicIds), "Clean progress");
  if (exerciseIds.length) {
    checked(await supabase.from("question_groups").delete().in("exercise_id", exerciseIds), "Clean groups");
    checked(await supabase.from("exercises").delete().in("id", exerciseIds), "Clean exercises");
  }
  if (cardIds.length) checked(await supabase.from("cards").delete().in("id", cardIds), "Clean cards");
  checked(await supabase.from("topics").delete().eq("course_id", m.courseId), "Clean topics");
  checked(await supabase.from("chapters").delete().eq("course_id", m.courseId), "Clean chapter");
  checked(await supabase.from("course_collaborators").delete().eq("course_id", m.courseId), "Clean owner");
  checked(await supabase.from("courses").delete().eq("id", m.courseId), "Clean course");

  for (const bucket of [IMAGE_BUCKET, AUDIO_BUCKET]) {
    for (const topicKey of Object.keys(m.topics)) {
      const topicId = m.id(10 + Object.keys(m.topics).indexOf(topicKey));
      const folder = `${m.courseId}/${topicId}/${m.teacher.id}`;
      const { data } = await supabase.storage.from(bucket).list(folder);
      if (data?.length) {
        checked(await supabase.storage.from(bucket).remove(data.map((file) => `${folder}/${file.name}`)), "Clean media");
      }
    }
  }
}
