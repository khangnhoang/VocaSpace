#!/usr/bin/env node
// Kiểm tra hình dạng tài liệu chương trình trong docs/ theo các luật cơ học của skill `repo-docs-system`
// (file role, State chỉ ở progress.md, milestone, problems, banner legacy, Programs index, ADR index,
// redirect). Chỉ kiểm tra luật đã được skill hoặc template nêu; không phán đoán State có đúng hay không.
//
// Dùng: node scripts/docs/check-structure.mjs [--root <dir>]
// Exit: 0 không có vi phạm | 1 có vi phạm (`file:line [rule-id] message` trên stderr) | 2 lỗi dùng sai hoặc đọc file.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = "docs";
const SKIP_DIRS = new Set(["node_modules", ".git"]);

export const LEGACY_BANNER =
  "> Legacy format — do not use as a template. Use the templates in .agents/skills/repo-docs-system/.";

// Các field bắt buộc của bảng State trong template progress ("Hosted state" là tùy chọn).
const REQUIRED_STATE_FIELDS = [
  "Spec revision",
  "Current unit / checkpoint",
  "Status",
  "Completed evidence",
  "Accepted deviations",
  "Blockers / Owner decisions",
  "Next action",
  "Current authority",
];
const OPEN_ENTRY_FIELDS = ["Status", "Problem", "Evidence", "Direction", "Exit condition"];
const LIFECYCLES = new Set(["active", "closed", "legacy"]);

// Ngữ pháp milestone trong template progress: `- YYYY-MM-DD <text> (<ref>)`, dấu chấm cuối là tùy chọn.
const HASH = "(?:`[0-9a-f]{7,40}`|[0-9a-f]{7,40})";
const MILESTONE_PATTERN = new RegExp(
  `^[-*+] \\d{4}-\\d{2}-\\d{2} .+ \\((${HASH}|PR \\d+|PR \\d+, ${HASH}|this commit)\\)\\.?$`,
);
const ID_PATTERN = /\b([A-Z][A-Z0-9]*-\d+)\b/;

function parseArgs(argv) {
  const options = { root: resolve(scriptDir, "..", "..") };
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag !== "--root" || !value) {
      throw new Error("Usage: check-structure.mjs [--root <dir>]");
    }
    options.root = resolve(value);
  }
  return options;
}

function collectMarkdownFiles(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collectMarkdownFiles(join(dir, entry.name), found);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      found.push(join(dir, entry.name));
    }
  }
  return found;
}

// Tách file thành từng dòng, đánh dấu dòng thuộc YAML front matter hoặc code fence để heading, banner
// và list mẫu trong code không bị tính là nội dung thật.
function parseDocument(rel, text) {
  const raw = text.split(/\r?\n/);
  let frontMatterEnd = -1;
  if (raw[0]?.trim() === "---") {
    const close = raw.findIndex((line, index) => index > 0 && line.trim() === "---");
    if (close !== -1) frontMatterEnd = close;
  }
  let fence = null;
  const lines = raw.map((content, index) => {
    const line = { n: index + 1, text: content, frontMatter: index <= frontMatterEnd, code: false };
    if (line.frontMatter) return line;
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(content);
    if (fence) {
      line.code = true;
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length) fence = null;
    } else if (marker) {
      line.code = true;
      fence = { char: marker[1][0], length: marker[1].length };
    }
    return line;
  });
  const content = lines.filter((line) => !line.frontMatter && !line.code);
  const headings = content
    .map((line) => {
      const match = /^(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/.exec(line.text);
      return match ? { n: line.n, level: match[1].length, title: match[2].trim() } : null;
    })
    .filter(Boolean);

  const bannerLines = content.filter((line) => line.text.trim() === LEGACY_BANNER);
  const firstNonBlank = lines.find((line) => !line.frontMatter && line.text.trim() !== "");
  const bannerOk = bannerLines.length > 0 && firstNonBlank?.text.trim() === LEGACY_BANNER;
  return { rel, lines, content, headings, bannerLines, bannered: bannerOk };
}

// Bỏ inline code trước khi tìm link; chỉ dùng cho dòng nội dung (không nằm trong fence).
function linkTargets(line) {
  const stripped = line.replace(/(`+)[^`\n]*?\1/g, "");
  return [...stripped.matchAll(/\]\(<?([^)>\s]+)/g)].map((match) => match[1]);
}

function sectionRange(doc, heading, level) {
  const next = doc.headings.find((item) => item.n > heading.n && item.level <= level);
  return { from: heading.n, to: next ? next.n : Infinity };
}

function sectionLines(doc, heading, level) {
  const range = sectionRange(doc, heading, level);
  return doc.content.filter((line) => line.n > range.from && line.n < range.to);
}

function checkProgress(doc, report) {
  const h2 = doc.headings.filter((heading) => heading.level === 2);
  const names = h2.map((heading) => heading.title);
  if (names.length !== 2 || names[0] !== "State" || names[1] !== "Milestones") {
    const found = names.length ? names.join(", ") : "none";
    report(
      h2[2]?.n ?? h2[0]?.n ?? 1,
      "progress-state",
      `progress.md must have exactly two "##" headings, State then Milestones; found: ${found}`,
    );
  }

  const state = h2.find((heading) => heading.title === "State");
  if (state) {
    const fields = new Set();
    for (const line of sectionLines(doc, state, 2)) {
      const row = /^\s*\|([^|]*)\|/.exec(line.text);
      if (row) fields.add(row[1].trim());
    }
    for (const field of REQUIRED_STATE_FIELDS) {
      if (!fields.has(field)) {
        report(state.n, "progress-state", `State table is missing the field "${field}"`);
      }
    }
  }

  const milestones = h2.find((heading) => heading.title === "Milestones");
  if (!milestones) return;
  const items = [];
  let current = null;
  for (const line of sectionLines(doc, milestones, 2)) {
    if (line.text.trim() === "") {
      current = null;
    } else if (/^[-*+] /.test(line.text)) {
      current = { n: line.n, text: line.text.trimEnd() };
      items.push(current);
    } else if (current) {
      current.text += ` ${line.text.trim()}`;
    }
  }
  const refs = [];
  for (const item of items) {
    const match = MILESTONE_PATTERN.exec(item.text);
    if (!match) {
      report(
        item.n,
        "milestone-format",
        "milestone must match `- YYYY-MM-DD <text> (<short hash> | PR <n> | PR <n>, <hash> | this commit)`",
      );
    }
    refs.push(match?.[1] ?? null);
  }
  const thisCommit = refs.flatMap((ref, index) => (ref === "this commit" ? [index] : []));
  if (thisCommit.length > 1) {
    report(items[thisCommit[1]].n, "this-commit", 'at most one milestone may cite "(this commit)"');
  } else if (thisCommit.length === 1 && thisCommit[0] !== items.length - 1) {
    report(items[thisCommit[0]].n, "this-commit", 'the "(this commit)" milestone must be the last one');
  }
}

function checkProblems(doc, report) {
  const h2 = doc.headings.filter((heading) => heading.level === 2);
  const open = h2.find((heading) => heading.title === "Open");
  const resolved = h2.find((heading) => heading.title === "Resolved");
  if (!open) report(1, "problems-shape", 'problems.md is missing the "## Open" section');
  if (!resolved) report(1, "problems-shape", 'problems.md is missing the "## Resolved" section');

  const seen = new Map();
  const noteId = (id, n) => {
    if (seen.has(id)) {
      report(n, "problems-shape", `ID ${id} is not unique (first used at line ${seen.get(id)})`);
    } else {
      seen.set(id, n);
    }
  };

  if (open) {
    const range = sectionRange(doc, open, 2);
    const entries = doc.headings.filter(
      (heading) => heading.level === 3 && heading.n > range.from && heading.n < range.to,
    );
    for (const entry of entries) {
      const id = ID_PATTERN.exec(entry.title)?.[1];
      if (id) noteId(id, entry.n);
      else report(entry.n, "problems-shape", "open entry heading has no ID such as `PREFIX-001`");
      const body = sectionLines(doc, entry, 3);
      for (const field of OPEN_ENTRY_FIELDS) {
        const present = body.some((line) =>
          new RegExp(`^\\s*[-*]\\s+\\**${field}:`).test(line.text),
        );
        if (!present) {
          report(entry.n, "problems-shape", `open entry ${id ?? entry.title} is missing "${field}"`);
        }
      }
    }
  }

  if (resolved) {
    let started = false;
    for (const line of sectionLines(doc, resolved, 2)) {
      if (line.text.trim() === "") continue;
      if (/^[-*+] /.test(line.text)) {
        started = true;
        const id = /^[-*+]\s+\**([A-Z][A-Z0-9]*-\d+)/.exec(line.text)?.[1];
        if (id) noteId(id, line.n);
      } else if (started || /^#{3,6}\s/.test(line.text)) {
        report(line.n, "problems-shape", "a resolved entry must be one list line");
      }
    }
  }
}

function checkPlan(doc, kind, report) {
  for (const heading of doc.headings) {
    const title = heading.title.replace(/^\d+(?:\.\d+)*\.?\s+/, "").toLowerCase();
    if (title !== "state" && title !== "current state") continue;
    const body = sectionLines(doc, heading, heading.level).filter((line) => line.text.trim() !== "");
    const isPointer =
      body.length === 1 && linkTargets(body[0].text).some((target) => /(^|\/)progress\.md/.test(target));
    if (!isPointer) {
      report(
        heading.n,
        "no-state-in-plan",
        `plan has a "${heading.title}" section; State lives only in progress.md (a one-line pointer is allowed)`,
      );
    }
  }
  if (kind === "detail") {
    const linksProgress = doc.content.some((line) =>
      linkTargets(line.text).some((target) => /(^|\/)progress\.md/.test(target)),
    );
    if (!linksProgress) report(1, "no-state-in-plan", "detail plan must link to progress.md");
  }
}

// Vai trò file trong chương trình, theo đường dẫn tương đối so với thư mục chương trình.
function roleOf(relInProgram) {
  if (["plan.md", "progress.md", "problems.md"].includes(relInProgram)) {
    return relInProgram.slice(0, -3);
  }
  if (relInProgram === "future-features.md" || relInProgram.startsWith("sources/")) return "scope";
  if (/^implementation-plans\/[^/]+\/plan\.md$/.test(relInProgram)) return "detail";
  return null;
}

function parseProgramsTable(readme, report) {
  const heading = readme.headings.find((item) => item.level === 2 && item.title === "Programs");
  if (!heading) {
    report("docs/README.md", 1, "programs-index", 'docs/README.md has no "## Programs" section');
    return { rows: [], line: 1 };
  }
  const rows = [];
  let pathColumn = -1;
  let lifecycleColumn = -1;
  for (const line of sectionLines(readme, heading, 2)) {
    if (!/^\s*\|/.test(line.text)) continue;
    const cells = line.text.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
    if (pathColumn === -1) {
      pathColumn = cells.findIndex((cell) => cell.toLowerCase() === "path");
      lifecycleColumn = cells.findIndex((cell) => cell.toLowerCase() === "lifecycle");
      if (pathColumn === -1 || lifecycleColumn === -1) {
        report("docs/README.md", line.n, "programs-index", "Programs table needs Path and Lifecycle columns");
        return { rows, line: heading.n };
      }
      continue;
    }
    if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
    const path = (cells[pathColumn] ?? "").replace(/`/g, "").replace(/\/+$/, "");
    const lifecycle = (cells[lifecycleColumn] ?? "").replace(/[`*]/g, "").toLowerCase();
    rows.push({ n: line.n, path: posix.join(DOCS_DIR, path), lifecycle });
  }
  return { rows, line: heading.n };
}

export function checkStructure(root) {
  const violations = [];
  const docsRoot = join(root, DOCS_DIR);
  if (!existsSync(docsRoot) || !statSync(docsRoot).isDirectory()) return violations;

  const docs = new Map();
  for (const file of collectMarkdownFiles(docsRoot)) {
    const rel = relative(root, file).split(sep).join("/");
    docs.set(rel, parseDocument(rel, readFileSync(file, "utf8")));
  }
  const reportFor = (rel) => (n, rule, message) => violations.push({ file: rel, line: n, rule, message });

  for (const doc of docs.values()) {
    const first = doc.bannerLines[0];
    if (first && !doc.bannered) {
      reportFor(doc.rel)(
        first.n,
        "legacy-banner",
        "the legacy banner must be the first non-blank line (or the first after YAML front matter)",
      );
    }
  }

  const programDirs = [...docs.keys()]
    .filter((rel) => posix.basename(rel) === "progress.md")
    .map((rel) => posix.dirname(rel));
  const programOf = (rel) =>
    programDirs.filter((dir) => rel.startsWith(`${dir}/`)).sort((a, b) => b.length - a.length)[0];
  const exempt = new Set(
    programDirs.filter((dir) => docs.get(`${dir}/progress.md`).bannered),
  );

  for (const doc of docs.values()) {
    const dir = programOf(doc.rel);
    if (!dir || exempt.has(dir) || doc.bannered) continue;
    const report = reportFor(doc.rel);
    const role = roleOf(doc.rel.slice(dir.length + 1));
    if (!role) {
      report(
        1,
        "file-role",
        "file is not a program role (plan, progress, problems, future-features, sources/**, implementation-plans/<unit>/plan.md); remove it or add the legacy banner",
      );
    } else if (role === "progress") {
      checkProgress(doc, report);
    } else if (role === "problems") {
      checkProblems(doc, report);
    } else if (role === "plan" || role === "detail") {
      checkPlan(doc, role, report);
    }
  }

  const readme = docs.get("docs/README.md");
  const programs = programDirs.filter((dir) => dir !== DOCS_DIR);
  if (readme) {
    const report = (file, n, rule, message) => reportFor(file)(n, rule, message);
    const { rows, line } = parseProgramsTable(readme, report);
    const byPath = new Map();
    for (const row of rows) {
      if (byPath.has(row.path)) {
        report("docs/README.md", row.n, "programs-index", `program ${row.path} has more than one row`);
      }
      byPath.set(row.path, row);
      if (!programs.includes(row.path)) {
        report("docs/README.md", row.n, "programs-index", `row ${row.path} does not point to a program (a folder with progress.md)`);
      }
      if (!LIFECYCLES.has(row.lifecycle)) {
        report("docs/README.md", row.n, "programs-index", `lifecycle "${row.lifecycle}" must be active, closed or legacy`);
      }
    }
    for (const dir of programs) {
      const row = byPath.get(dir);
      const isBannered = docs.get(`${dir}/progress.md`).bannered;
      if (!row) {
        report("docs/README.md", line, "programs-index", `program ${dir} has no row in the Programs table`);
      } else if (row.lifecycle === "active" && isBannered) {
        report("docs/README.md", row.n, "programs-index", `${dir} has a bannered progress.md, so it cannot be active`);
      }
    }
  } else if (programs.length > 0) {
    reportFor("docs/README.md")(1, "programs-index", "docs/README.md is missing, so programs have no index");
  }

  const adrFiles = [...docs.keys()].filter(
    (rel) => posix.dirname(rel) === "docs/adr" && posix.basename(rel) !== "README.md",
  );
  if (adrFiles.length > 0) {
    const adrReadme = docs.get("docs/adr/README.md");
    const linked = new Set(
      (adrReadme?.content ?? []).flatMap((line) =>
        linkTargets(line.text).map((target) => posix.normalize(posix.join("docs/adr", target.split(/[#?]/)[0]))),
      ),
    );
    for (const rel of adrFiles) {
      if (!linked.has(rel)) {
        reportFor(adrReadme ? "docs/adr/README.md" : rel)(
          1,
          "adr-index",
          `${rel} is not linked from docs/adr/README.md`,
        );
      }
    }
  }

  for (const doc of docs.values()) {
    if (!doc.rel.startsWith("docs/refactors/")) continue;
    const body = doc.content.filter((line) => line.text.trim() !== "");
    const targets = body.length === 2 ? linkTargets(body[1].text) : [];
    const resolved = targets.map((target) =>
      posix.normalize(posix.join(posix.dirname(doc.rel), target.split(/[#?]/)[0])),
    );
    const ok =
      body.length === 2 &&
      /^#\s/.test(body[0].text) &&
      resolved.length > 0 &&
      resolved.every((target) => target.startsWith("docs/programs/"));
    if (!ok) {
      reportFor(doc.rel)(
        1,
        "redirect-only",
        "files under docs/refactors/ must be redirects: one heading and one line linking under docs/programs/",
      );
    }
  }

  return violations.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule),
  );
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
    if (!existsSync(options.root) || !statSync(options.root).isDirectory()) {
      throw new Error(`Root is not a directory: ${options.root}`);
    }
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  let violations;
  try {
    violations = checkStructure(options.root);
  } catch (error) {
    console.error(`Cannot check docs structure: ${error.message}`);
    return 2;
  }
  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line} [${violation.rule}] ${violation.message}`);
  }
  console.log(`Docs structure violations: ${violations.length}.`);
  return violations.length > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
