import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { run, validateContent, validateThumbnailUrl } from "./apply-free-toeic-vocab-course.mjs";

// Test plan:
// - Mục tiêu: nội dung đủ trường, đáp án duy nhất và chặn apply production khi chưa duyệt.
// - Loại test: unit; đối tượng: validateContent và cổng CLI trước kết nối database.
// - Thành công: 30 thẻ, 39 câu, 156 lựa chọn; thất bại: mất bản dịch, đáp án mơ hồ, từ trùng, media.
// - Phân quyền: thiếu Owner approval thì apply production bị từ chối trước kết nối.
// - Ảnh bìa: URL phải thuộc bucket course_thumbnails đúng môi trường; cấm credentials/query/hash.
// - Invariant: không sửa nội dung gốc; transaction/RPC/rollback cần kiểm chứng trên DB thật riêng.
// - Kết quả: passed bằng `node --test scripts/content/apply-free-toeic-vocab-course.test.mjs`.

const content = JSON.parse(readFileSync(new URL("./free-toeic-vocab-basics.json", import.meta.url), "utf8"));

test("the course supplies 30 complete cards and 39 questions with four distinct options", () => {
  const counts = validateContent(content);
  assert.equal(counts.cards, 30);
  assert.equal(counts.questions, 39);
  assert.equal(counts.question_options, 156);
});

test("a card without its Vietnamese example translation is rejected", () => {
  const candidate = structuredClone(content);
  delete candidate.chapter.topics[0].cards[0].back_content.exampleTranslation;
  assert.throws(() => validateContent(candidate), /exampleTranslation/);
});

test("a question with two correct choices or no correct choice is rejected", () => {
  for (const correctCount of [2, 0]) {
    const candidate = structuredClone(content);
    candidate.chapter.topics[0].exercise.questions[0].options.forEach((option, index) => {
      option.is_correct = index < correctCount;
    });
    assert.throws(() => validateContent(candidate), /đúng một đáp án/);
  }
});

test("duplicate choices and duplicate vocabulary are rejected", () => {
  const choices = structuredClone(content);
  const options = choices.chapter.topics[0].memory_check[0].options;
  options[0].content = options[1].content;
  assert.throws(() => validateContent(choices), /lựa chọn trùng/);
  const words = structuredClone(content);
  words.chapter.topics[1].cards[0].front_content.word = words.chapter.topics[0].cards[0].front_content.word;
  assert.throws(() => validateContent(words), /Từ vựng trùng/);
});

test("media fields and a nonzero price are rejected", () => {
  const media = structuredClone(content);
  media.chapter.topics[0].cards[0].image_url = "https://example.com/image.png";
  assert.throws(() => validateContent(media), /field không hỗ trợ/);
  const paid = structuredClone(content);
  paid.price = 100;
  assert.throws(() => validateContent(paid), /miễn phí/);
});

test("production apply without separate Owner approval stops before any database connection", () => {
  assert.throws(() => run(["--production", "--apply", "--owner", "mrkhang05k@gmail.com",
    "--reviewer", "zindemo00z@gmail.com", "--manifest", "test-results/must-not-be-created.jsonl"]),
  /production apply cần Owner duyệt riêng/);
});

test("course cover URLs accept the correct public bucket and reject cross-environment or credential-bearing URLs", () => {
  const url = "https://zmnfsorjuibfjowmjtxo.supabase.co/storage/v1/object/public/course_thumbnails/create/owner/cover.png";
  assert.doesNotThrow(() => validateThumbnailUrl(url, "production"));
  assert.doesNotThrow(() => validateThumbnailUrl(null, "local"));
  assert.throws(() => validateThumbnailUrl(url, "local"), /đúng môi trường/);
  assert.throws(() => validateThumbnailUrl(url.replace("course_thumbnails", "cards"), "production"), /đúng môi trường/);
  assert.throws(() => validateThumbnailUrl(url + "?token=secret", "production"), /credentials\/query\/hash/);
  assert.throws(() => validateThumbnailUrl(url.replace("https://", "https://user:pass@"), "production"), /credentials\/query\/hash/);
});
