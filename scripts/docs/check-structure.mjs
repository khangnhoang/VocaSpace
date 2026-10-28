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
import { repoFileIndex } from "./repo-files.mjs";

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
const KINDS = new Set(["delivery", "evergreen"]);

// Ngữ pháp milestone trong template progress: `- YYYY-MM-DD <text> (<ref>)`, dấu chấm cuối là tùy chọn.
const HASH = "(?:`[0-9a-f]{7,40}`|[0-9a-f]{7,40})";
const MILESTONE_PATTERN = new RegExp(
  `^[-*+] \\d{4}-\\d{2}-\\d{2} .+ \\((${HASH}|PR \\d+|PR \\d+, ${HASH}|this commit)\\)\\.?$`,
);
const ID_PATTERN = /\b([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d+)\b/;
const ID_TOKEN = "[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\\d+";
const TRANSFER_PATTERN = new RegExp(
  `^Moved to \\[(${ID_TOKEN})\\](?:\\([^\\n)]+\\)|\\[[^\\n\\]]*\\])?\\.` +
  `(?: Legacy identity: [a-z0-9-]+:${ID_TOKEN}\\.)?(?: <a\\s+id="[^"]+"\\s*><\\/a>)*$`,
);

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

// Có git work tree thì chỉ lấy file tracked hoặc untracked-không-bị-ignore (giống clean checkout trên CI);
// không thì duyệt filesystem (fixture test).
function collectDocsFiles(root, docsRoot) {
  const index = repoFileIndex(root);
  if (!index) return collectMarkdownFiles(docsRoot);
  return index.files
    .filter((rel) => rel.startsWith(`${DOCS_DIR}/`) && rel.endsWith(".md"))
    .filter((rel) => !rel.split("/").some((part) => SKIP_DIRS.has(part)))
    .sort()
    .map((rel) => join(root, rel));
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

// Reference definition: `[label]: destination "title"`. Theo CommonMark, destination có thể nằm ở dòng kế tiếp
// và title (nếu có) ở dòng sau nữa. Dòng definition không phải link; chỉ chỗ dùng nó mới là link.
const DEFINITION_START = /^ {0,3}\[(?!\^)([^\]\n]+)\]:[ \t]*(.*)$/;
const TITLE_LINE = /^[ \t]*(?:"[^"]*"|'[^']*'|\([^)]*\))[ \t]*$/;
const normalizeLabel = (label) => label.trim().replace(/\s+/g, " ").toLowerCase();

function destinationOf(text) {
  const match = /^(<[^>\n]*>|\S+)(?:[ \t]+(?:"[^"]*"|'[^']*'|\([^)]*\)))?[ \t]*$/.exec(text.trim());
  if (!match) return null;
  return { destination: match[1].replace(/^<|>$/g, ""), titled: match[0].length > match[1].length };
}

// Bảng label -> destination và tập số dòng thuộc definition (để không đếm chúng như nội dung hay link).
function parseDefinitions(contentLines) {
  const map = new Map();
  const lines = new Set();
  for (let index = 0; index < contentLines.length; index += 1) {
    const line = contentLines[index];
    const start = DEFINITION_START.exec(line.text);
    if (!start) continue;
    let parsed = destinationOf(start[2]);
    let last = index;
    if (start[2].trim() === "") {
      const next = contentLines[index + 1];
      if (!next || next.n !== line.n + 1 || next.text.trim() === "") continue;
      parsed = destinationOf(next.text);
      if (!parsed) continue;
      last = index + 1;
    } else if (parsed === null) {
      continue;
    }
    const { destination, titled } = parsed;
    // Title ở dòng riêng chỉ được nhận khi definition chưa có title ở dòng label hoặc dòng destination.
    const title = contentLines[last + 1];
    if (
      !titled &&
      title &&
      title.n === contentLines[last].n + 1 &&
      TITLE_LINE.test(title.text) &&
      !DEFINITION_START.test(title.text)
    ) {
      last += 1;
    }
    for (let at = index; at <= last; at += 1) lines.add(contentLines[at].n);
    const label = normalizeLabel(start[1]);
    if (!map.has(label)) map.set(label, destination);
    index = last;
  }
  return { map, lines };
}

// Destination của link được dùng trên một dòng nội dung: inline `[t](d)` và reference `[t][label]` /
// `[label][]` / `[label]` tra qua `definitions.map`. Dòng thuộc một definition không có link nào.
function linkTargets(line, definitions) {
  if (definitions?.lines.has(line.n)) return [];
  const stripped = line.text.replace(/(`+)[^`\n]*?\1/g, "");
  const targets = [...stripped.matchAll(/\]\(<?([^)>\s]+)/g)].map((match) => match[1]);
  if (!definitions) return targets;
  const withoutInline = stripped.replace(/\]\([^)]*\)/g, "]");
  for (const match of withoutInline.matchAll(/\[([^\]\n]*)\](?:\[([^\]\n]*)\])?(?!:)/g)) {
    const label = match[2] === undefined || match[2] === "" ? match[1] : match[2];
    const target = definitions.map.get(normalizeLabel(label));
    if (target) targets.push(target);
  }
  return targets;
}

// Đích là đúng file `progress.md` (bỏ fragment hoặc query); `progress.md.bak` không tính.
function isProgressTarget(target) {
  return /(^|\/)progress\.md$/.test(target.split(/[#?]/)[0]);
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
      report(line.n, "milestone-format", "a milestone must be one line; do not wrap it onto another line");
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
    let intro = false;
    for (const line of sectionLines(doc, resolved, 2)) {
      if (line.text.trim() === "") continue;
      if (/^[-*+] /.test(line.text)) {
        started = true;
        const id = /^[-*+]\s+\**([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d+)/.exec(line.text)?.[1];
        if (id) noteId(id, line.n);
        else report(line.n, "problems-shape", "a resolved entry must start with its ID, such as `- PREFIX-001 — ...`");
      } else if (!started && !intro && /^One line each\b/.test(line.text)) {
        intro = true;
      } else {
        report(
          line.n,
          "problems-shape",
          'Resolved holds only one-line list entries after the template intro "One line each ..."; this line must be one list line',
        );
      }
    }
  }
}

function checkPlan(doc, kind, report, owner) {
  const definitions = parseDefinitions(doc.content);
  for (const heading of doc.headings) {
    const title = heading.title.replace(/^\d+(?:\.\d+)*\.?\s+/, "").toLowerCase();
    if (title !== "state" && title !== "current state") continue;
    const body = sectionLines(doc, heading, heading.level).filter(
      (line) => line.text.trim() !== "" && !definitions.lines.has(line.n),
    );
    const isPointer =
      body.length === 1 && linkTargets(body[0], definitions).some((target) => isProgressTarget(target));
    if (!isPointer) {
      report(
        heading.n,
        "no-state-in-plan",
        `plan has a "${heading.title}" section; State lives only in progress.md (a one-line pointer is allowed)`,
      );
    }
  }
  const progressLinks = doc.content.flatMap((line) => linkTargets(line, definitions)).filter(isProgressTarget);
  if (kind === "detail" && progressLinks.length === 0) {
    report(1, "no-state-in-plan", "detail plan must link to progress.md");
  }
  if (owner && progressLinks.length && !progressLinks.some((target) => resolveLink(doc, target)?.file === `${owner}/progress.md`)) {
    report(1, "plan-owner", "plan must link to its own program's progress.md");
  }
}

const headingName = (heading) => heading.title.replace(/^\d+(?:\.\d+)*\.?\s+/, "").toLowerCase();
const headingAnchor = (title) => title.toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, "").replace(/\s/g, "-");
const withoutInlineCode = (text) => text.replace(/(`+)[^`\n]*?\1/g, "");
const htmlAnchors = (lines) => lines.flatMap((line) =>
  [...withoutInlineCode(line.text).matchAll(/<a\s+id="([^"]+)"\s*><\/a>/g)].map((match) => match[1]),
);
const anchorOnly = (line) => htmlAnchors([line]).length > 0 &&
  withoutInlineCode(line.text).replace(/<a\s+id="[^"]+"\s*><\/a>/g, "").trim() === "";

// Anchor đứng ngay trước heading thuộc entry sau, không thuộc body của entry trước.
function leadingAnchorLines(doc, n) {
  const lines = [];
  for (const line of doc.content.filter((line) => line.n < n).reverse()) {
    if (line.text.trim() && !anchorOnly(line)) break;
    lines.unshift(line);
  }
  return lines;
}

function entryBody(doc, heading) {
  const lines = sectionLines(doc, heading, heading.level);
  const next = doc.headings.find((item) => item.n === sectionRange(doc, heading, heading.level).to);
  const nextId = next && ID_PATTERN.exec(next.title);
  if (next?.level === heading.level && nextId?.index === 0) {
    while (lines.length && (!lines.at(-1).text.trim() || anchorOnly(lines.at(-1)))) lines.pop();
  }
  return lines;
}

function resolveLink(doc, target) {
  if (/^[a-z][a-z\d+.-]*:|^\//i.test(target)) return null;
  const [path, fragment = ""] = target.split("#");
  try {
    return { file: path ? posix.normalize(posix.join(posix.dirname(doc.rel), decodeURIComponent(path.split("?")[0]))) : doc.rel,
      fragment: decodeURIComponent(fragment) };
  } catch { return null; }
}

function usedLinks(doc, lines = doc.content) {
  const definitions = parseDefinitions(doc.content);
  return lines.flatMap((line) => linkTargets(line, definitions)).map((target) => resolveLink(doc, target)).filter(Boolean);
}

function checkCharter(dir, docs, reportFor) {
  const path = `${dir}/README.md`;
  const doc = docs.get(path);
  const report = reportFor(path);
  if (!doc || doc.bannered) {
    report(1, "charter-shape", "evergreen requires an unbannered README.md charter");
    return;
  }
  if (docs.has(`${dir}/plan.md`)) reportFor(`${dir}/plan.md`)(1, "charter-shape", "evergreen cannot have a competing root plan.md, even bannered");
  for (const name of ["capability and boundary", "owner decisions", "invariants", "initiatives", "opening an initiative"]) {
    if (!doc.headings.some((h) => h.level === 2 && headingName(h) === name)) report(1, "charter-shape", `charter is missing section "${name}"`);
  }
  if (!usedLinks(doc).some((link) => link.file === `${dir}/progress.md`)) report(1, "charter-shape", "charter must link to its own progress.md");
  checkPlan(doc, "charter", report, dir);
  if (doc.headings.some((h) => ["state", "current state"].includes(headingName(h)))) report(1, "charter-shape", "charter cannot contain a State section, even a pointer");
  const section = doc.headings.find((h) => h.level === 2 && headingName(h) === "initiatives");
  const rows = section ? sectionLines(doc, section, 2).filter((l) => /^\s*\|/.test(l.text)) : [];
  const cells = (line) => line.text.trim().replace(/^\||\|$/g, "").split("|").map((s) => s.trim());
  const column = rows.length ? cells(rows[0]).findIndex((c) => c.toLowerCase() === "plan") : -1;
  if (column < 0) report(section?.n ?? 1, "initiative-plan", "Initiatives table requires a Plan column (an empty table is valid)");
  const registered = new Set();
  for (const row of rows.slice(2)) {
    const cell = cells(row)[column] ?? "";
    const links = usedLinks(doc, [{ ...row, text: cell }]);
    if (links.length !== 1 || !links[0].file.startsWith(`${dir}/implementation-plans/`) || !/^implementation-plans\/[^/]+\/plan\.md$/.test(links[0].file.slice(dir.length + 1)) || !docs.has(links[0].file)) {
      report(row.n, "initiative-plan", "initiative Plan cell must link to one existing plan in this evergreen home");
      continue;
    }
    if (registered.has(links[0].file)) report(row.n, "initiative-plan", "initiative plan is registered more than once");
    registered.add(links[0].file);
  }
  for (const path of docs.keys()) {
    if (path.startsWith(`${dir}/implementation-plans/`) && /^implementation-plans\/[^/]+\/plan\.md$/.test(path.slice(dir.length + 1)) && !registered.has(path)) report(1, "initiative-plan", `${path} is not registered in Initiatives`);
  }
}

// Chỉ entry canonical tham gia kiểm tra ID. Pointer phải là một dòng và trỏ thẳng tới entry canonical,
// để alias lịch sử không trở thành cách bỏ qua kiểm tra trùng ID hoặc giữ hai bản nội dung.
function trackerEntries(docs, reportFor) {
  const entries = [];
  const transfers = [];
  const featureIds = new Map();
  for (const doc of docs.values()) {
    if (!/\/(future-features|problems)\.md$/.test(doc.rel)) continue;
    const feature = doc.rel.endsWith("/future-features.md");
    const definitions = parseDefinitions(doc.content);
    const note = (id, line, title, lines) => {
      const anchors = title ? [headingAnchor(title)] : [];
      anchors.push(...htmlAnchors([...leadingAnchorLines(doc, line), ...lines]));
      const entry = { id, doc, n: line, anchors, lines };
      entries.push(entry);
      if (feature) {
        const prior = featureIds.get(id);
        if (prior) reportFor(doc.rel)(line, "feature-id", `${id} is already declared at ${prior.doc.rel}:${prior.n}`);
        else featureIds.set(id, entry);
      }
    };
    const pointer = (line, text) => {
      const normalized = text.replace(new RegExp(`^[-*+]\\s+${ID_TOKEN}\\s+[—–-]\\s+`), "");
      const match = TRANSFER_PATTERN.exec(normalized);
      if (!match) {
        reportFor(doc.rel)(line, "entry-transfer", "pointer permits only a canonical-ID link, optional Legacy identity and preserved HTML anchors");
        return;
      }
      const targets = usedLinks(doc, [{ n: line, text }]);
      transfers.push({ doc, n: line, targets, id: match[1] });
    };
    for (const heading of doc.headings.filter((h) => h.level === (feature ? 2 : 3))) {
      const id = /^([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d+)\b/.exec(heading.title)?.[1];
      const lines = entryBody(doc, heading);
      const body = lines.filter((line) => line.text.trim() && !anchorOnly(line) && !definitions.lines.has(line.n));
      if (body.some((l) => /^Moved to \[/.test(l.text))) {
        if (body.length !== 1 || !/^Moved to \[/.test(body[0].text)) reportFor(doc.rel)(heading.n, "entry-transfer", "a moved entry must contain only its one-line Moved to pointer");
        else pointer(body[0].n, body[0].text);
      } else if (id) note(id, heading.n, heading.title, lines);
    }
    const closedSections = doc.headings.filter((h) => h.level === 2 && h.title === (feature ? "Closed" : "Resolved"));
    for (const closed of closedSections) {
      let movedLine = false;
      for (const line of sectionLines(doc, closed, 2)) {
        const match = /^[-*+]\s+([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\d+)\s+[—–-]\s+(.+)/.exec(line.text);
        if (!match) {
          if (movedLine && line.text.trim() && !definitions.lines.has(line.n)) {
            reportFor(doc.rel)(line.n, "entry-transfer", "a closed transfer must be one list line, without copied entry fields");
          }
          continue;
        }
        movedLine = /^Moved to \[/.test(match[2]);
        if (movedLine) pointer(line.n, line.text);
        else note(match[1], line.n, null, [line]);
      }
    }
  }
  for (const transfer of transfers) {
    if (transfer.targets.length !== 1 || !entries.some((entry) => entry.id === transfer.id && entry.doc.rel === transfer.targets[0].file && entry.anchors.includes(transfer.targets[0].fragment))) {
      reportFor(transfer.doc.rel)(transfer.n, "entry-transfer", "Moved to pointer must resolve directly to one canonical tracker entry and anchor");
    }
  }
  return entries;
}

function checkEntryPlans(docs, entries, reportFor, programOf, kindOf) {
  for (const doc of docs.values()) {
    const match = /\/implementation-plans\/([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*-\d+)-[^/]+\/plan\.md$/i.exec(doc.rel);
    if (!match || doc.bannered) continue;
    const owner = programOf(doc.rel);
    if (kindOf.get(owner) !== "delivery") continue;
    const entry = entries.find((e) => e.id === match[1].toUpperCase() && posix.dirname(e.doc.rel) === owner);
    const forward = entry && usedLinks(entry.doc, entry.lines).some((l) => l.file === doc.rel);
    const back = entry && usedLinks(doc).some((l) => l.file === entry.doc.rel && entry.anchors.includes(l.fragment));
    if (!forward || !back) reportFor(doc.rel)(1, "entry-plan", "ID-prefixed entry plan needs reciprocal links to the exact owning tracker entry");
  }
}

// Vai trò file trong chương trình, theo đường dẫn tương đối so với thư mục chương trình.
function roleOf(relInProgram, kind) {
  if (relInProgram === "README.md" && kind === "evergreen") return "charter";
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
  let kindColumn = -1;
  for (const line of sectionLines(readme, heading, 2)) {
    if (!/^\s*\|/.test(line.text)) continue;
    const cells = line.text.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
    if (pathColumn === -1) {
      pathColumn = cells.findIndex((cell) => cell.toLowerCase() === "path");
      lifecycleColumn = cells.findIndex((cell) => cell.toLowerCase() === "lifecycle");
      kindColumn = cells.findIndex((cell) => cell.toLowerCase() === "kind");
      if (pathColumn === -1 || lifecycleColumn === -1 || kindColumn === -1) {
        report("docs/README.md", line.n, "programs-index", "Programs table needs Path, Kind and Lifecycle columns");
        return { rows, line: heading.n };
      }
      continue;
    }
    if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
    const path = (cells[pathColumn] ?? "").replace(/`/g, "").replace(/\/+$/, "");
    const lifecycle = (cells[lifecycleColumn] ?? "").replace(/[`*]/g, "").toLowerCase();
    const kind = (cells[kindColumn] ?? "").replace(/[`*]/g, "").toLowerCase();
    rows.push({ n: line.n, path: posix.join(DOCS_DIR, path), lifecycle, kind });
  }
  return { rows, line: heading.n };
}

export function checkStructure(root) {
  const violations = [];
  const docsRoot = join(root, DOCS_DIR);
  if (!existsSync(docsRoot) || !statSync(docsRoot).isDirectory()) return violations;

  const docs = new Map();
  for (const file of collectDocsFiles(root, docsRoot)) {
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

  const readme = docs.get("docs/README.md");
  const index = readme ? parseProgramsTable(readme, (file, n, rule, message) => reportFor(file)(n, rule, message)) : { rows: [], line: 1 };
  const kindOf = new Map(index.rows.map((row) => [row.path, row.kind]));

  for (const doc of docs.values()) {
    if (doc.rel.startsWith("docs/backlog/")) {
      if (!["docs/backlog/problems.md", "docs/backlog/future-features.md"].includes(doc.rel)) reportFor(doc.rel)(1, "backlog-shape", "backlog holds only problems.md and future-features.md; it is not a program");
      else if (doc.rel.endsWith("/problems.md")) checkProblems(doc, reportFor(doc.rel));
      continue;
    }
    const dir = programOf(doc.rel);
    if (!dir || exempt.has(dir) || doc.bannered) continue;
    const report = reportFor(doc.rel);
    const role = roleOf(doc.rel.slice(dir.length + 1), kindOf.get(dir));
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
      const rootDetail = role === "plan" && doc.headings.some((h) => headingName(h) === "binding spec");
      checkPlan(doc, rootDetail ? "detail" : role, report, dir);
    }
  }

  const programs = programDirs.filter((dir) => dir !== DOCS_DIR);
  if (readme) {
    const report = (file, n, rule, message) => reportFor(file)(n, rule, message);
    const { rows, line } = index;
    const byPath = new Map();
    for (const row of rows) {
      if (byPath.has(row.path)) {
        report("docs/README.md", row.n, "programs-index", `program ${row.path} has more than one row`);
      }
      byPath.set(row.path, row);
      if (!KINDS.has(row.kind)) report("docs/README.md", row.n, "programs-index", `kind "${row.kind}" must be delivery or evergreen`);
      if (row.path === "docs/backlog") report("docs/README.md", row.n, "backlog-shape", "backlog cannot have a Programs row");
      if (row.kind === "evergreen") checkCharter(row.path, docs, reportFor);
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

  const entries = trackerEntries(docs, reportFor);
  checkEntryPlans(docs, entries, reportFor, programOf, kindOf);

  const adrFiles = [...docs.keys()].filter(
    (rel) => posix.dirname(rel) === "docs/adr" && posix.basename(rel) !== "README.md",
  );
  if (adrFiles.length > 0) {
    const adrReadme = docs.get("docs/adr/README.md");
    const adrDefinitions = parseDefinitions(adrReadme?.content ?? []);
    const linked = new Set(
      (adrReadme?.content ?? []).flatMap((line) =>
        linkTargets(line, adrDefinitions).map((target) => posix.normalize(posix.join("docs/adr", target.split(/[#?]/)[0]))),
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
    const targets = body.length === 2 ? linkTargets(body[1]) : [];
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
