import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { buildSql } from "./apply-free-toeic-vocab-course.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROJECT = "zmnfsorjuibfjowmjtxo";
const OWNER = "mrkhang05k@gmail.com";
const REVIEWER = "zindemo00z@gmail.com";
const RECEIPT = resolve(ROOT, "test-results/free-toeic-production-apply.jsonl");
const ASSET_RECEIPT = resolve(ROOT, "test-results/free-toeic-production-cover.json");
const CONTENT = JSON.parse(readFileSync(new URL("./free-toeic-vocab-basics.json", import.meta.url), "utf8"));

function cli(args) {
  const result = spawnSync(process.execPath, [resolve(ROOT, "node_modules/supabase/dist/supabase.js"), ...args], {
    cwd: ROOT, encoding: "utf8", windowsHide: true, timeout: 120_000,
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: "1" }, maxBuffer: 4 * 1024 * 1024,
  });
  assert(!result.error && result.status === 0, `Supabase CLI thất bại; không retry: ${result.error?.message ?? result.stderr}`);
  // Không đưa stdout vào lỗi: kết quả api-keys có chứa secret, chỉ giữ trong bộ nhớ.
  try { return JSON.parse(result.stdout.trim()); } catch { throw new Error("Supabase CLI không trả JSON hợp lệ; không retry"); }
}

function query(mode, thumbnailUrl = null, manifest) {
  const path = resolve(ROOT, `test-results/free-toeic-production-${mode}.sql`);
  writeFileSync(path, buildSql({ data: CONTENT, owner: OWNER, reviewer: REVIEWER, mode,
    environment: "production", thumbnailUrl, manifest, receiptAfterCommit: true }), "utf8");
  const output = cli(["db", "query", "--linked", "--file", path, "--output", "json"]);
  const result = output.rows?.[0]?.result;
  assert(result && result.mode === mode && result.environment === "production", "CLI receipt thiếu hoặc sai môi trường; đối soát chỉ đọc trước khi làm tiếp");
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];
  assert(["--dry-run", "--apply", "--postflight"].includes(mode), "Chọn --dry-run|--apply|--postflight");
  assert(args.length === (mode === "--apply" ? 2 : 1), "Tham số không hợp lệ");
  if (mode === "--apply") assert(args[1] === "--owner-approved-production", "Apply cần Khang duyệt riêng trong chat");
  assert(readFileSync(resolve(ROOT, "supabase/.temp/project-ref"), "utf8").trim() === PROJECT, "Linked project sai target");
  mkdirSync(resolve(ROOT, "test-results"), { recursive: true });
  if (mode === "--dry-run") {
    console.log(JSON.stringify(query("dry-run"), null, 2));
    return;
  }
  if (mode === "--postflight") {
    const entries = readFileSync(RECEIPT, "utf8").trim().split(/\r?\n/).map(JSON.parse);
    assert(entries.at(-1)?.outcome === "committed", "Receipt không có marker COMMIT");
    const result = query("postflight", entries[0].thumbnail_url, entries[0]);
    console.log(JSON.stringify({ course_id: result.course_id, thumbnail_url: result.thumbnail_url,
      counts: result.counts, l1_invalid_rows: result.l1_invalid_rows, outcome: result.outcome }, null, 2));
    return;
  }

  const pendingFd = openSync(RECEIPT, "wx", 0o600);
  closeSync(pendingFd);
  // Không tự chạy lại apply khi receipt đã tồn tại, kể cả khi kết nối mất quanh COMMIT.
  const preflight = query("dry-run");
  const asset = readFileSync(new URL("./free-toeic-vocab-cover.png", import.meta.url));
  assert(asset.length <= 2 * 1024 * 1024 && asset.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])), "Ảnh phải là PNG <=2MB");
  const apiKeys = cli(["projects", "api-keys", "--project-ref", PROJECT, "--output", "json"]);
  const keys = Array.isArray(apiKeys) ? apiKeys : apiKeys.rows;
  assert(Array.isArray(keys), "CLI không trả danh sách API keys; không in response chứa secret");
  const serviceKey = keys.find((entry) => entry.name === "service_role")?.api_key;
  assert(typeof serviceKey === "string" && serviceKey.length > 0, "Không có service_role key");
  const client = createClient(`https://${PROJECT}.supabase.co`, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const objectPath = `create/${preflight.owner_id}/${randomUUID()}.png`;
  const bucket = client.storage.from("course_thumbnails");
  const { data: uploaded, error } = await bucket.upload(objectPath, asset, { contentType: "image/png", upsert: false, cacheControl: "3600" });
  assert(!error, `Upload ảnh thất bại: ${error?.message}; không retry`);
  const thumbnailUrl = bucket.getPublicUrl(objectPath).data.publicUrl;
  const coverReceipt = { project: PROJECT, bucket: "course_thumbnails", object_path: objectPath,
    thumbnail_url: thumbnailUrl, storage_object_id: uploaded?.id, bytes: asset.length, owner_id: preflight.owner_id };
  writeFileSync(ASSET_RECEIPT, JSON.stringify(coverReceipt, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  const response = await fetch(thumbnailUrl, { signal: AbortSignal.timeout(30_000) });
  assert(response.ok && Buffer.from(await response.arrayBuffer()).equals(asset), "Ảnh public không khớp asset; dừng trước apply course");

  const result = query("apply", thumbnailUrl);
  assert(result.outcome === "committed", "COMMIT chưa xác định; chỉ đối soát, không apply lại");
  const { outcome, ...manifest } = result;
  writeFileSync(RECEIPT, JSON.stringify(manifest) + "\n" + JSON.stringify({ outcome }) + "\n", { mode: 0o600 });
  console.log(JSON.stringify({ course_id: manifest.course_id, thumbnail_url: thumbnailUrl,
    counts: manifest.counts, l1_invalid_rows: manifest.l1_invalid_rows, outcome, receipt: RECEIPT }, null, 2));
}

main().catch((error) => {
  console.error(`${error.message}\nKhông tự retry. Đối soát course theo slug và asset receipt nếu có; lỗi quanh COMMIT là trạng thái chưa xác định.`);
  process.exitCode = 1;
});
