// Test plan:
// - Mục tiêu: kiểm tra structure checker chỉ chặn các luật hình dạng tài liệu đã nêu trong skill `repo-docs-system` và cho qua tài liệu đúng template.
// - Loại test: Node CLI black-box với fixture tạm, dựng từ template `repo-docs-system`.
// - Đối tượng: `scripts/docs/check-structure.mjs`.
// - Case thành công: cây fixture đúng template thoát 0; file có banner (cả sau YAML front matter) bị bỏ qua bởi luật hình dạng; chương trình có progress.md đặt banner được miễn luật file; heading `State transitions` và pointer `State` một dòng hợp lệ; mọi dạng ref milestone hợp lệ; trường `Hosted state` tùy chọn.
// - Case thất bại: mỗi luật (legacy-banner, file-role, progress-state, no-state-in-plan, milestone-format, this-commit, problems-shape, programs-index, adr-index, redirect-only) có một fixture vi phạm, thoát 1 và nêu đúng `file:line [rule-id]`; chương trình ở thư mục bất kỳ được tìm bằng progress.md; usage sai hoặc root không tồn tại thoát 2.
// - Invariant cần giữ: kết quả chỉ phụ thuộc vào cây fixture, không phụ thuộc docs/ thật; checker không tự đặt luật ngoài §1.5 của plan PR2.
// - Kết quả verify gần nhất: `node --test scripts/docs/check-structure.test.mjs`.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./check-structure.mjs", import.meta.url));
const BANNER =
  "> Legacy format — do not use as a template. Use the templates in .agents/skills/repo-docs-system/.";

const STATE_ROWS = [
  "Spec revision",
  "Current unit / checkpoint",
  "Status",
  "Completed evidence",
  "Accepted deviations",
  "Blockers / Owner decisions",
  "Next action",
  "Current authority",
];

function progress({ fields = STATE_ROWS, milestones = ["- 2026-01-01 Started (abc1234)."], extra = "" } = {}) {
  return [
    "# Progress — Alpha",
    "",
    "Plan: [plan.md](plan.md). Problems: [problems.md](problems.md).",
    "",
    "## State",
    "",
    "| Field | Value |",
    "| --- | --- |",
    ...fields.map((field) => `| ${field} | value |`),
    "",
    extra,
    "## Milestones",
    "",
    "One line each, newest last.",
    "",
    ...milestones,
    "",
  ].join("\n");
}

function problems(open, resolved) {
  return [
    "# Problems — Alpha",
    "",
    "## Open",
    "",
    open,
    "",
    "## Resolved",
    "",
    "One line each.",
    "",
    resolved,
    "",
  ].join("\n");
}

const OPEN_ENTRY = (id) =>
  [
    `### ${id}: Something`,
    "",
    "- Status: Open (2026-01-01).",
    "- Problem: p.",
    "- Evidence: e.",
    "- Direction: d.",
    "- Exit condition: x.",
  ].join("\n");

const README = (rows) =>
  ["# Docs", "", "## Programs", "", "| Path | Lifecycle | Purpose |", "| --- | --- | --- |", ...rows, ""].join("\n");

function baseTree() {
  return {
    "docs/README.md": README(["| `programs/alpha/` | active | Alpha |"]),
    "docs/programs/alpha/plan.md": "# Master plan — Alpha\n\n## 1. Goal\n\n- Goal: g.\n",
    "docs/programs/alpha/progress.md": progress(),
    "docs/programs/alpha/problems.md": problems(OPEN_ENTRY("ALPHA-001"), "- ALPHA-000 — Resolved 2026-01-01: done (abc1234)."),
    "docs/programs/alpha/implementation-plans/u1/plan.md":
      "# U1 detail plan\n\n## 1. Binding Spec\n\n## 6. Progress\n\nCurrent State and milestones: [progress.md](../../progress.md).\n",
    "docs/programs/alpha/future-features.md": "# Future\n",
    "docs/programs/alpha/sources/input.md": "# Source\n",
    "docs/adr/README.md": "# ADRs\n\n- [one](one.md)\n",
    "docs/adr/one.md": "# One\n",
  };
}

function run(overrides = {}) {
  const files = { ...baseTree(), ...overrides };
  const root = mkdtempSync(join(tmpdir(), "check-structure-"));
  try {
    for (const [path, content] of Object.entries(files)) {
      if (content === null) continue;
      const full = join(root, path);
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, content);
    }
    const result = spawnSync(process.execPath, [scriptPath, "--root", root], { encoding: "utf8" });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function assertViolation(result, file, rule, line) {
  assert.equal(result.status, 1, result.stderr);
  const pattern = new RegExp(`^${file.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}:${line ?? "\\d+"} \\[${rule}\\] `, "m");
  assert.match(result.stderr, pattern);
}

test("a tree that follows the templates exits 0", () => {
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Docs structure violations: 0\./);
});

test("legacy-banner: a banner below other text is a violation, front matter and blank lines are allowed", () => {
  const misplaced = run({ "docs/adr/one.md": `# One\n\n${BANNER}\n` });
  assertViolation(misplaced, "docs/adr/one.md", "legacy-banner", 3);

  const afterFrontMatter = run({
    "docs/adr/one.md": `---\ntitle: One\n---\n\n${BANNER}\n\n# One\n`,
  });
  assert.equal(afterFrontMatter.status, 0, afterFrontMatter.stderr);

  const inFence = run({ "docs/adr/one.md": `# One\n\n\`\`\`text\n${BANNER}\n\`\`\`\n` });
  assert.equal(inFence.status, 0, inFence.stderr);
});

test("a bannered file is skipped by shape rules", () => {
  const result = run({
    "docs/programs/alpha/notes.md": `${BANNER}\n\n# Free-form notes\n`,
    "docs/programs/alpha/implementation-plans/u1/plan.md": `${BANNER}\n\n# Old\n\n## State\n\nlots of state\n`,
    "docs/programs/alpha/problems.md": `${BANNER}\n\nnot a problems file\n`,
  });
  assert.equal(result.status, 0, result.stderr);
});

test("a program whose progress.md is bannered has the legacy-format exemption but still needs an index row", () => {
  const tree = {
    "docs/other/deep/progress.md": `${BANNER}\n\nanything\n`,
    "docs/other/deep/random.md": "# Not a role file\n\n## State\n",
  };
  const missingRow = run(tree);
  assertViolation(missingRow, "docs/README.md", "programs-index");
  assert.match(missingRow.stderr, /docs\/other\/deep has no row/);

  const closed = run({
    ...tree,
    "docs/README.md": README(["| `programs/alpha/` | active | Alpha |", "| `other/deep/` | closed | Old |"]),
  });
  assert.equal(closed.status, 0, closed.stderr);

  const legacy = run({
    ...tree,
    "docs/README.md": README(["| `programs/alpha/` | active | Alpha |", "| `other/deep/` | legacy | Old |"]),
  });
  assert.equal(legacy.status, 0, legacy.stderr);
});

test("file-role: a non-role file in a program fails, role files and sources pass", () => {
  const result = run({ "docs/programs/alpha/review-notes.md": "# Notes\n" });
  assertViolation(result, "docs/programs/alpha/review-notes.md", "file-role", 1);

  const nested = run({ "docs/programs/alpha/implementation-plans/README.md": "# Units\n" });
  assertViolation(nested, "docs/programs/alpha/implementation-plans/README.md", "file-role", 1);

  const detailExtra = run({ "docs/programs/alpha/implementation-plans/u1/correction.md": "# Fix\n" });
  assertViolation(detailExtra, "docs/programs/alpha/implementation-plans/u1/correction.md", "file-role", 1);
});

test("a program is found by its progress.md in any folder, not by folder name", () => {
  const result = run({
    "docs/anywhere/else/progress.md": progress(),
    "docs/anywhere/else/stray.md": "# Stray\n",
  });
  assertViolation(result, "docs/anywhere/else/stray.md", "file-role", 1);
  assert.match(result.stderr, /docs\/anywhere\/else has no row/);
});

test("progress-state: only State then Milestones, with every required State field", () => {
  const extraSection = run({
    "docs/programs/alpha/progress.md": progress().replace("## Milestones", "## A2 local verification\n\nlog\n\n## Milestones"),
  });
  assertViolation(extraSection, "docs/programs/alpha/progress.md", "progress-state");

  const wrongOrder = run({
    "docs/programs/alpha/progress.md": "# P\n\n## Milestones\n\n- 2026-01-01 x (abc1234)\n\n## State\n",
  });
  assertViolation(wrongOrder, "docs/programs/alpha/progress.md", "progress-state");

  const missingField = run({
    "docs/programs/alpha/progress.md": progress({ fields: STATE_ROWS.filter((f) => f !== "Next action") }),
  });
  assertViolation(missingField, "docs/programs/alpha/progress.md", "progress-state", 5);
  assert.match(missingField.stderr, /missing the field "Next action"/);

  const withHosted = run({
    "docs/programs/alpha/progress.md": progress({ fields: [...STATE_ROWS, "Hosted state"] }),
  });
  assert.equal(withHosted.status, 0, withHosted.stderr);
});

test("no-state-in-plan: State sections fail, similar headings and a one-line pointer pass", () => {
  const master = run({ "docs/programs/alpha/plan.md": "# Master\n\n## 10. State\n\nStatus: in progress\n" });
  assertViolation(master, "docs/programs/alpha/plan.md", "no-state-in-plan", 3);

  const current = run({ "docs/programs/alpha/plan.md": "# Master\n\n### Current State\n\nNext: merge\n" });
  assertViolation(current, "docs/programs/alpha/plan.md", "no-state-in-plan", 3);

  const similar = run({
    "docs/programs/alpha/plan.md": "# Master\n\n## State transitions\n\nrules\n\n## 2. State transitions\n\nrules\n",
  });
  assert.equal(similar.status, 0, similar.stderr);

  const pointer = run({
    "docs/programs/alpha/implementation-plans/u1/plan.md":
      "# U1\n\n## 8. State\n\nCurrent State and milestones: [progress.md](../../progress.md).\n",
  });
  assert.equal(pointer.status, 0, pointer.stderr);

  const noLink = run({ "docs/programs/alpha/implementation-plans/u1/plan.md": "# U1\n\n## 1. Binding Spec\n" });
  assertViolation(noLink, "docs/programs/alpha/implementation-plans/u1/plan.md", "no-state-in-plan", 1);
});

test("milestone-format: date, text and a final reference in the stated grammar", () => {
  const valid = run({
    "docs/programs/alpha/progress.md": progress({
      milestones: [
        "- 2026-01-01 Short hash (abc1234).",
        "- 2026-01-02 Backticked hash (`abc1234`)",
        "- 2026-01-03 A PR (PR 12).",
        "- 2026-01-04 A PR and hash (PR 12, abc1234).",
        "- 2026-01-05 Wrapped text that continues",
        "  on the next line (PR 13, `abc1234`).",
        "- 2026-01-06 Latest (this commit).",
      ],
    }),
  });
  assert.equal(valid.status, 0, valid.stderr);

  const bad = run({
    "docs/programs/alpha/progress.md": progress({
      milestones: ["- 2026-01-01 Good (abc1234).", "- Started without a date (abc1234).", "- 2026-01-03 No reference."],
    }),
  });
  assertViolation(bad, "docs/programs/alpha/progress.md", "milestone-format");
  assert.equal((bad.stderr.match(/\[milestone-format\]/g) ?? []).length, 2);
});

test("this-commit: at most one, and it must be the last milestone", () => {
  const two = run({
    "docs/programs/alpha/progress.md": progress({
      milestones: ["- 2026-01-01 A (this commit).", "- 2026-01-02 B (this commit)."],
    }),
  });
  assertViolation(two, "docs/programs/alpha/progress.md", "this-commit");

  const notLast = run({
    "docs/programs/alpha/progress.md": progress({
      milestones: ["- 2026-01-01 A (this commit).", "- 2026-01-02 B (abc1234)."],
    }),
  });
  assertViolation(notLast, "docs/programs/alpha/progress.md", "this-commit");
});

test("problems-shape: sections, open-entry fields, one-line resolved entries and unique IDs", () => {
  const missingField = run({
    "docs/programs/alpha/problems.md": problems(OPEN_ENTRY("ALPHA-001").replace("- Exit condition: x.\n", "").replace("- Exit condition: x.", ""), ""),
  });
  assertViolation(missingField, "docs/programs/alpha/problems.md", "problems-shape", 5);
  assert.match(missingField.stderr, /missing "Exit condition"/);

  const missingSection = run({ "docs/programs/alpha/problems.md": "# Problems\n\n## Open\n\nNone.\n" });
  assertViolation(missingSection, "docs/programs/alpha/problems.md", "problems-shape", 1);

  const longResolved = run({
    "docs/programs/alpha/problems.md": problems("None.", "- ALPHA-002 — Resolved: first line\n  and a second line"),
  });
  assertViolation(longResolved, "docs/programs/alpha/problems.md", "problems-shape");

  const heading = run({
    "docs/programs/alpha/problems.md": problems("None.", "### ALPHA-002: still a full entry\n\n- Status: x"),
  });
  assertViolation(heading, "docs/programs/alpha/problems.md", "problems-shape");

  const duplicate = run({
    "docs/programs/alpha/problems.md": problems(OPEN_ENTRY("ALPHA-001"), "- ALPHA-001 — Resolved: dup (abc1234)."),
  });
  assertViolation(duplicate, "docs/programs/alpha/problems.md", "problems-shape");
  assert.match(duplicate.stderr, /ID ALPHA-001 is not unique/);

  const none = run({ "docs/programs/alpha/problems.md": problems("None.", "- ALPHA-002 — Resolved: ok (abc1234).") });
  assert.equal(none.status, 0, none.stderr);

  // ID nhiều đoạn như FUTURE-PAYMENT-001 là một ID đầy đủ, không trùng với PAYMENT-001.
  const multiSegment = run({
    "docs/programs/alpha/problems.md": problems(OPEN_ENTRY("FUTURE-PAYMENT-001"), "- PAYMENT-001 — Resolved: ok (abc1234)."),
  });
  assert.equal(multiSegment.status, 0, multiSegment.stderr);

  const multiSegmentDuplicate = run({
    "docs/programs/alpha/problems.md": problems(OPEN_ENTRY("FUTURE-PAYMENT-001"), "- FUTURE-PAYMENT-001 — Resolved: dup (abc1234)."),
  });
  assertViolation(multiSegmentDuplicate, "docs/programs/alpha/problems.md", "problems-shape");
  assert.match(multiSegmentDuplicate.stderr, /ID FUTURE-PAYMENT-001 is not unique/);
});

test("programs-index: one row per program, rows point to programs, lifecycle and banner agree", () => {
  const noRow = run({ "docs/README.md": README([]) });
  assertViolation(noRow, "docs/README.md", "programs-index");

  const ghost = run({
    "docs/README.md": README(["| `programs/alpha/` | active | A |", "| `programs/ghost/` | closed | G |"]),
  });
  assertViolation(ghost, "docs/README.md", "programs-index", 8);
  assert.match(ghost.stderr, /does not point to a program/);

  const duplicate = run({
    "docs/README.md": README(["| `programs/alpha/` | active | A |", "| `programs/alpha/` | active | A |"]),
  });
  assertViolation(duplicate, "docs/README.md", "programs-index", 8);

  const badLifecycle = run({ "docs/README.md": README(["| `programs/alpha/` | paused | A |"]) });
  assertViolation(badLifecycle, "docs/README.md", "programs-index", 7);

  const bannerButActive = run({
    "docs/README.md": README(["| `programs/alpha/` | active | A |"]),
    "docs/programs/alpha/progress.md": `${BANNER}\n\nold\n`,
  });
  assertViolation(bannerButActive, "docs/README.md", "programs-index", 7);
  assert.match(bannerButActive.stderr, /cannot be active/);

  const noReadme = run({ "docs/README.md": null });
  assertViolation(noReadme, "docs/README.md", "programs-index", 1);
});

test("adr-index: every ADR file is linked from docs/adr/README.md", () => {
  const result = run({ "docs/adr/two.md": "# Two\n" });
  assertViolation(result, "docs/adr/README.md", "adr-index", 1);
  assert.match(result.stderr, /docs\/adr\/two\.md is not linked/);

  const linked = run({
    "docs/adr/README.md": "# ADRs\n\n- [one](one.md)\n- [two](./two.md#top)\n",
    "docs/adr/two.md": "# Two\n",
  });
  assert.equal(linked.status, 0, linked.stderr);
});

test("redirect-only: files under docs/refactors are one heading and one link under docs/programs", () => {
  const good = run({
    "docs/refactors/alpha/plan.md": "# Moved\n\nMoved to [docs/programs/alpha/plan.md](../../programs/alpha/plan.md).\n",
  });
  assert.equal(good.status, 0, good.stderr);

  const content = run({ "docs/refactors/alpha/plan.md": "# Old plan\n\nSome real content.\n\nMore.\n" });
  assertViolation(content, "docs/refactors/alpha/plan.md", "redirect-only", 1);

  const wrongTarget = run({
    "docs/refactors/alpha/plan.md": "# Moved\n\nSee [adr](../../adr/one.md).\n",
  });
  assertViolation(wrongTarget, "docs/refactors/alpha/plan.md", "redirect-only", 1);
});

test("unknown arguments and a missing root exit 2", () => {
  const bogus = spawnSync(process.execPath, [scriptPath, "--bogus", "x"], { encoding: "utf8" });
  assert.equal(bogus.status, 2);

  const missing = spawnSync(process.execPath, [scriptPath, "--root", join(tmpdir(), "check-structure-does-not-exist")], {
    encoding: "utf8",
  });
  assert.equal(missing.status, 2);
});
