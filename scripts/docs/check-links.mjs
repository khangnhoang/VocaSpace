#!/usr/bin/env node
// Kiểm tra link markdown tương đối trong docs/, .agents/, .claude/, AGENTS.md, README.md.
// Chỉ kiểm tra file/thư mục đích có tồn tại (không kiểm tra anchor). Link hỏng đã ghi trong
// baseline được chấp nhận; link hỏng mới làm lệnh thoát với mã 1.
//
// Dùng: node scripts/docs/check-links.mjs [--root <dir>] [--baseline <file>]
// Exit: 0 không có link hỏng mới | 1 có link hỏng mới | 2 lỗi dùng sai hoặc đọc file.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const SCAN_DIRS = ["docs", ".agents", ".claude"];
const SCAN_FILES = ["AGENTS.md", "README.md"];
const SKIP_DIRS = new Set(["node_modules", ".git"]);
const BASELINE_SEPARATOR = " -> ";

function parseArgs(argv) {
  const options = {
    root: resolve(scriptDir, "..", ".."),
    baseline: join(scriptDir, "link-baseline.txt"),
  };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if ((flag !== "--root" && flag !== "--baseline") || !value) {
      throw new Error("Usage: check-links.mjs [--root <dir>] [--baseline <file>]");
    }
    options[flag.slice(2)] = resolve(value);
  }
  return options;
}

function collectMarkdownFiles(root) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(join(dir, entry.name));
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(join(dir, entry.name));
      }
    }
  };
  for (const dir of SCAN_DIRS) {
    const full = join(root, dir);
    if (existsSync(full) && statSync(full).isDirectory()) walk(full);
  }
  for (const file of SCAN_FILES) {
    const full = join(root, file);
    if (existsSync(full)) files.push(full);
  }
  return files;
}

// Bỏ code fence và inline code để link mẫu trong tài liệu không bị tính là link thật.
function stripCode(text) {
  return text
    .replace(/^ {0,3}(```|~~~)[^\n]*\n[\s\S]*?(?:\n {0,3}\1[^\n]*(?=\n|$)|$)/gm, "")
    .replace(/(`+)[^`\n]*?\1/g, "");
}

function extractTargets(text) {
  const targets = [];
  const inline = /\]\(\s*(<[^>\n]*>|[^\s()]*(?:\([^\s()]*\)[^\s()]*)*)/g;
  for (const match of stripCode(text).matchAll(inline)) {
    targets.push(match[1].replace(/^<|>$/g, ""));
  }
  return targets;
}

function toLocalPath(target) {
  if (!target || target.startsWith("#") || target.startsWith("/")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return null;
  const withoutFragment = target.split(/[#?]/)[0];
  if (!withoutFragment) return null;
  try {
    return decodeURIComponent(withoutFragment);
  } catch {
    return withoutFragment;
  }
}

// Kiểm tra đúng chữ hoa/thường từng đoạn path để kết quả giống nhau trên Windows và Linux.
function existsExactCase(root, absolutePath) {
  if (!existsSync(absolutePath)) return false;
  const parts = relative(root, absolutePath).split(sep).filter(Boolean);
  if (parts[0] === "..") return true;
  let current = root;
  for (const part of parts) {
    if (part === "." || part === "..") {
      current = resolve(current, part);
      continue;
    }
    if (!readdirSync(current).includes(part)) return false;
    current = join(current, part);
  }
  return true;
}

export function findBrokenLinks(root) {
  const broken = new Set();
  for (const file of collectMarkdownFiles(root)) {
    const source = relative(root, file).split(sep).join("/");
    for (const target of extractTargets(readFileSync(file, "utf8"))) {
      const local = toLocalPath(target);
      if (local && !existsExactCase(root, resolve(dirname(file), local))) {
        broken.add(`${source}${BASELINE_SEPARATOR}${target}`);
      }
    }
  }
  return [...broken].sort();
}

function readBaseline(path) {
  return new Set(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")),
  );
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  let baseline;
  try {
    baseline = readBaseline(options.baseline);
  } catch (error) {
    console.error(`Cannot read baseline ${options.baseline}: ${error.message}`);
    return 2;
  }
  const broken = findBrokenLinks(options.root);
  const unlisted = broken.filter((entry) => !baseline.has(entry));
  const accepted = broken.length - unlisted.length;
  const fixed = [...baseline].filter((entry) => !broken.includes(entry));

  for (const entry of unlisted) console.error(`NEW broken link: ${entry}`);
  for (const entry of fixed) console.log(`Baseline entry no longer broken (remove it): ${entry}`);
  console.log(
    `Broken links: ${broken.length} (${accepted} in baseline, ${unlisted.length} new).`,
  );
  return unlisted.length > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
