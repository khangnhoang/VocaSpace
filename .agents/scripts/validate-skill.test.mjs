// Test plan:
// - Mục tiêu: kiểm tra CLI structural validator giữ đúng frontmatter, path, resource, route và evidence boundary.
// - Loại test: Node unit/CLI black-box.
// - Đối tượng: `.agents/scripts/validate-skill.mjs`.
// - Case thành công: current repository, description/line-ending hợp lệ, route punctuation và resource target canonical.
// - Case thất bại: usage, invalid metadata/encoding/newline, hostile route token, resource target/path/reparse không hợp lệ.
// - Bảo mật/phân quyền: path escape và symlink/junction không được đi ra ngoài skill bundle.
// - Ổn định/resilience: output sort ổn định, không leak absolute fixture path, operational error tách khỏi invalid structure.
// - Invariant cần giữ: validator chỉ report deterministic structure và không sửa fixture.
// - Kết quả verify gần nhất: passed 37 tests bằng `node --test .agents/scripts/validate-skill.test.mjs` trên Node v24.11.1.
// - Ghi chú: reparse test được skip với lý do cụ thể nếu OS policy không cho tạo fixture link.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./validate-skill.mjs", import.meta.url));
const repoRoot = resolve(dirname(scriptPath), "..", "..");
const legacyCoreLengthSignalAllowlist = new Set([
  "code-review-and-quality",
  "implementation-planning-and-pr-breakdown",
  "nextjs-server-action-zod",
]);

test("prints help without starting validation", () => {
  const result = runValidator(repoRoot, ["--help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^Usage:/);
  assert.equal(result.stderr, "");
});

test("rejects unsupported CLI arguments with the usage exit code", () => {
  const result = runValidator(repoRoot, ["--root", "elsewhere"]);

  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unsupported argument/);
  assert.equal(result.stdout, "");
});

test("reports a missing skills root as a structured operational failure", (t) => {
  const root = createFixture(t, { createSkillsRoot: false });
  const result = runValidator(root);
  const output = parseOutput(result);

  assert.equal(result.status, 3);
  assert.equal(output.status, "operational_error");
  assert.equal(output.error.code, "SKILLS_ROOT_UNAVAILABLE");
  assert.equal(result.stdout.includes(root), false);
});

test("validates the current repository with only allowlisted legacy length warnings", () => {
  const result = runValidator(repoRoot);
  const output = parseOutput(result);

  assert.equal(result.status, 0);
  assert.equal(output.status, "valid");
  assert.equal(output.summary.errors, 0);
  assert.equal(
    new Set(output.diagnostics.map(({ skill }) => skill)).size,
    output.diagnostics.length,
  );
  for (const { skill, code } of output.diagnostics) {
    assert.equal(code, "CORE_LENGTH_SIGNAL");
    assert.equal(legacyCoreLengthSignalAllowlist.has(skill), true);
  }
});

test("accepts supported descriptions, line endings, routed resources, and Windows route separators", (t) => {
  const root = createFixture(t);
  writeSkill(root, "plain-skill", {
    description: "Plain repository workflow.",
    body: resourceRouting("references/guide.md", "Read before using the guide."),
    resources: { "references/guide.md": "# Guide\n" },
  });
  writeSkill(root, "quoted-skill", {
    description: '"Workflow: use JSON-compatible quoted text."',
    lineEnding: "\r\n",
  });
  writeAgents(
    root,
    ".agents/skills/plain-skill/SKILL.md\n.agents\\skills\\quoted-skill\\SKILL.md\n",
  );

  const result = runValidator(root);
  const output = parseOutput(result);

  assert.equal(result.status, 0);
  assert.equal(output.status, "valid");
  assert.deepEqual(output.diagnostics, []);
});

test("reports missing core files and unsupported frontmatter fields without semantic claims", async (t) => {
  await t.test("missing SKILL.md", (subtest) => {
    const root = createFixture(subtest);
    mkdirSync(join(root, ".agents", "skills", "missing-core"), { recursive: true });
    writeAgents(root, ".agents/skills/missing-core/SKILL.md\n");

    assertDiagnostic(runValidator(root), 1, "SKILL_FILE_MISSING");
  });

  await t.test("duplicate, extra, and missing fields", (subtest) => {
    const root = createFixture(subtest);
    writeRawSkill(
      root,
      "field-errors",
      "---\nname: field-errors\nname: field-errors\nowner: agent\n---\n\n# Field errors\n",
    );
    writeAgents(root, ".agents/skills/field-errors/SKILL.md\n");

    const output = assertInvalid(runValidator(root));
    assertDiagnosticCode(output, "FRONTMATTER_FIELD_DUPLICATE");
    assertDiagnosticCode(output, "FRONTMATTER_FIELD_UNSUPPORTED");
    assertDiagnosticCode(output, "FRONTMATTER_FIELD_MISSING");
    assert.equal(output.diagnostics.some((item) => /YAML/.test(item.message)), false);
  });

  await t.test("single-quoted description", (subtest) => {
    const root = createFixture(subtest);
    writeSkill(root, "quoted-wrong", { description: "'Unsupported quoted text.'" });
    writeAgents(root, ".agents/skills/quoted-wrong/SKILL.md\n");

    assertDiagnostic(runValidator(root), 1, "FRONTMATTER_UNSUPPORTED");
  });

  await t.test("inline frontmatter comment", (subtest) => {
    const root = createFixture(subtest);
    writeSkill(root, "inline-comment", { name: "inline-comment # unsupported" });
    writeAgents(root, ".agents/skills/inline-comment/SKILL.md\n");

    assertDiagnostic(runValidator(root), 1, "FRONTMATTER_UNSUPPORTED");
  });

  await t.test("independent unsupported name and description syntax", (subtest) => {
    const root = createFixture(subtest);
    writeSkill(root, "two-syntax-errors", {
      name: "'two-syntax-errors'",
      description: "'Unsupported description.'",
    });
    writeAgents(root, ".agents/skills/two-syntax-errors/SKILL.md\n");

    const output = assertInvalid(runValidator(root));
    assert.equal(
      output.diagnostics.filter((item) => item.code === "FRONTMATTER_UNSUPPORTED").length,
      2,
    );
  });
});

test("reports invalid, mismatched, and duplicate repo-local names", (t) => {
  const root = createFixture(t);
  writeSkill(root, "invalid-folder", { name: "Invalid_Name" });
  writeSkill(root, "first-folder", { name: "shared-name" });
  writeSkill(root, "second-folder", { name: "shared-name" });
  writeAgents(
    root,
    [
      ".agents/skills/invalid-folder/SKILL.md",
      ".agents/skills/first-folder/SKILL.md",
      ".agents/skills/second-folder/SKILL.md",
      "",
    ].join("\n"),
  );

  const output = assertInvalid(runValidator(root));
  assertDiagnosticCode(output, "SKILL_NAME_INVALID");
  assertDiagnosticCode(output, "SKILL_NAME_MISMATCH");
  assert.equal(
    output.diagnostics.filter((item) => item.code === "SKILL_NAME_DUPLICATE").length,
    2,
  );
});

test("reports invalid UTF-8 and missing final newlines", (t) => {
  const root = createFixture(t);
  writeRawSkill(root, "bad-encoding", Buffer.from([0xff, 0x0a]));
  writeRawSkill(
    root,
    "missing-newline",
    "---\nname: missing-newline\ndescription: Missing final newline.\n---\n\n# Missing newline",
  );
  writeAgents(
    root,
    ".agents/skills/bad-encoding/SKILL.md\n.agents/skills/missing-newline/SKILL.md\n",
  );

  const output = assertInvalid(runValidator(root));
  assertDiagnosticCode(output, "FILE_ENCODING_INVALID");
  assertDiagnosticCode(output, "FINAL_NEWLINE_MISSING");
});

test("separates missing, escaped, and malformed resource structures", (t) => {
  const root = createFixture(t);
  writeSkill(root, "missing-resource", {
    body: resourceRouting("references/missing.md", "Read before missing work."),
  });
  writeSkill(root, "escaped-resource", {
    body: resourceRouting("../outside.md", "Read before escaping."),
  });
  writeSkill(root, "malformed-routing", {
    body: [
      "## Resource routing",
      "",
      "| Resource | Read condition |",
      "| --- | --- |",
      "| [references/guide.md](references/guide.md) | |",
      "",
    ].join("\n"),
    resources: { "references/guide.md": "# Guide\n" },
  });
  writeAgents(
    root,
    [
      ".agents/skills/missing-resource/SKILL.md",
      ".agents/skills/escaped-resource/SKILL.md",
      ".agents/skills/malformed-routing/SKILL.md",
      "",
    ].join("\n"),
  );

  const output = assertInvalid(runValidator(root));
  assertDiagnosticCode(output, "RESOURCE_MISSING");
  assertDiagnosticCode(output, "RESOURCE_PATH_ESCAPE");
  assertDiagnosticCode(output, "RESOURCE_ROUTING_ENTRY_INVALID");
});

test("keeps unrouted resources and long cores as non-blocking warnings", (t) => {
  const root = createFixture(t);
  const longBody = Array.from({ length: 500 }, (_, index) => `Line ${index + 1}`).join("\n");
  writeSkill(root, "warning-skill", {
    body: longBody,
    resources: { "references/unlisted.md": "# Unlisted\n" },
  });
  writeAgents(root, ".agents/skills/warning-skill/SKILL.md\n");

  const result = runValidator(root);
  const output = parseOutput(result);

  assert.equal(result.status, 0);
  assert.equal(output.status, "valid");
  assert.deepEqual(
    output.diagnostics.map((item) => item.code),
    ["CORE_LENGTH_SIGNAL", "RESOURCE_NOT_ROUTED"],
  );
});

test("reports missing explicit route targets and warns about existing unrouted skills", (t) => {
  const root = createFixture(t);
  writeSkill(root, "existing-skill");
  writeAgents(root, ".agents/skills/missing-skill/SKILL.md\n");

  const output = assertInvalid(runValidator(root));
  assertDiagnosticCode(output, "EXPLICIT_ROUTE_MISSING");
  assertDiagnosticCode(output, "SKILL_NOT_EXPLICITLY_ROUTED");
});

test("reports an explicit route through a regular file as invalid structure", (t) => {
  const root = createFixture(t);
  writeFileSync(join(root, ".agents", "skills", "not-a-directory"), "regular file\n", "utf8");
  writeAgents(root, ".agents/skills/not-a-directory/SKILL.md\n");

  const output = assertInvalid(runValidator(root));
  assertDiagnosticCode(output, "EXPLICIT_ROUTE_MISSING");
});

test("parses complete explicit route tokens before validating their target", async (t) => {
  await t.test("invalid-name missing route", (subtest) => {
    const root = createFixture(subtest);
    writeAgents(root, ".agents/skills/bad_name/SKILL.md\n");

    const output = assertInvalid(runValidator(root));
    const diagnostic = output.diagnostics.find((item) => item.code === "EXPLICIT_ROUTE_MISSING");
    assert.equal(diagnostic?.skill, "bad_name");
    assert.equal(diagnostic?.path, ".agents/skills/bad_name/SKILL.md");
  });

  await t.test("space-containing invalid-name missing route", (subtest) => {
    const root = createFixture(subtest);
    writeAgents(root, ".agents/skills/bad name/SKILL.md\n");

    const output = assertInvalid(runValidator(root));
    const diagnostic = output.diagnostics.find((item) => item.code === "EXPLICIT_ROUTE_MISSING");
    assert.equal(diagnostic?.skill, "bad name");
    assert.equal(diagnostic?.path, ".agents/skills/bad name/SKILL.md");
  });

  await t.test("SKILL.md backup suffix is not a route token", (subtest) => {
    const root = createFixture(subtest);
    writeSkill(root, "example");
    writeAgents(root, ".agents/skills/example/SKILL.md.backup\n");

    const result = runValidator(root);
    const output = parseOutput(result);
    assert.equal(result.status, 0);
    assertDiagnosticCode(output, "SKILL_NOT_EXPLICITLY_ROUTED");
    assert.equal(output.diagnostics.some((item) => item.code === "EXPLICIT_ROUTE_MISSING"), false);
  });

  await t.test("canonical route followed by Markdown punctuation", (subtest) => {
    const root = createFixture(subtest);
    writeSkill(root, "example");
    writeAgents(root, "Use `.agents/skills/example/SKILL.md`, then continue.\n");

    const result = runValidator(root);
    const output = parseOutput(result);
    assert.equal(result.status, 0);
    assert.deepEqual(output.diagnostics, []);
  });
});

test("rejects non-local standardized resource-routing targets", async (t) => {
  const targets = [
    "https://example.com/guide",
    "mailto:owner@example.com",
    "#usage",
    "/tmp/guide.md",
    "C:\\temp\\guide.md",
  ];

  for (const target of targets) {
    await t.test(target, (subtest) => {
      const root = createFixture(subtest);
      writeSkill(root, "invalid-resource-route", {
        body: resourceRouting(target, "Read before work."),
      });
      writeAgents(root, ".agents/skills/invalid-resource-route/SKILL.md\n");

      const output = assertDiagnostic(runValidator(root), 1, "RESOURCE_ROUTING_ENTRY_INVALID");
      const diagnostic = output.diagnostics.find(
        (item) => item.code === "RESOURCE_ROUTING_ENTRY_INVALID",
      );
      assert.match(diagnostic?.message ?? "", new RegExp(escapeRegExp(target)));
    });
  }
});

test("canonicalizes local resource-routing targets before bundle comparison", async (t) => {
  const cases = [
    { target: "references/guide.md#usage", resource: "references/guide.md" },
    { target: "references/guide.md?mode=full", resource: "references/guide.md" },
    { target: "./references/guide.md", resource: "references/guide.md" },
    { target: "references/./guide.md", resource: "references/guide.md" },
    { target: "references/../guide.md", resource: "guide.md" },
  ];

  for (const { target, resource } of cases) {
    await t.test(target, (subtest) => {
      const root = createFixture(subtest);
      writeSkill(root, "canonical-resource-route", {
        body: resourceRouting(target, "Read before work."),
        resources: { [resource]: "# Guide\n" },
      });
      writeAgents(root, ".agents/skills/canonical-resource-route/SKILL.md\n");

      const result = runValidator(root);
      const output = parseOutput(result);
      assert.equal(result.status, 0);
      assert.deepEqual(output.diagnostics, []);
    });
  }
});

test("reports a resource target through a regular file as invalid structure", (t) => {
  const root = createFixture(t);
  writeSkill(root, "invalid-resource-path", {
    body: "[Guide](references/guide.md)",
  });
  writeFileSync(
    join(root, ".agents", "skills", "invalid-resource-path", "references"),
    "regular file\n",
    "utf8",
  );
  writeAgents(root, ".agents/skills/invalid-resource-path/SKILL.md\n");

  const output = assertInvalid(runValidator(root));
  assertDiagnosticCode(output, "RESOURCE_MISSING");
});

test("rejects resource traversal through a symlink or junction when the environment supports it", (t) => {
  const root = createFixture(t);
  const outside = join(root, "outside");
  mkdirSync(outside, { recursive: true });
  writeFileSync(join(outside, "guide.md"), "# Outside\n", "utf8");
  writeSkill(root, "linked-resource", {
    body: resourceRouting("references/guide.md", "Read before using the guide."),
  });
  const link = join(root, ".agents", "skills", "linked-resource", "references");

  try {
    symlinkSync(outside, link, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if (error && typeof error === "object" && ["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
      t.skip(`OS policy does not allow the reparse fixture: ${error.code}`);
      return;
    }
    throw error;
  }

  writeAgents(root, ".agents/skills/linked-resource/SKILL.md\n");
  const output = assertDiagnostic(runValidator(root), 1, "PATH_REPARSE_POINT");
  assert.equal(
    output.diagnostics.filter((item) => item.code === "PATH_REPARSE_POINT").length,
    1,
  );
});

test("keeps JSON output stable and does not leak the absolute fixture path", (t) => {
  const root = createFixture(t);
  writeSkill(root, "stable-output", {
    body: resourceRouting("../escape.md", "Read before escaping."),
  });
  writeAgents(root, ".agents/skills/missing-route/SKILL.md\n");

  const first = runValidator(root);
  const second = runValidator(root);

  assert.equal(first.status, 1);
  assert.equal(first.stdout, second.stdout);
  assert.equal(first.stdout.includes(root), false);
  const output = parseOutput(first);
  assert.deepEqual(
    output.diagnostics.map((item) => item.severity),
    [...output.diagnostics.map((item) => item.severity)].sort(),
  );
});

function createFixture(t, options = {}) {
  const root = mkdtempSync(join(tmpdir(), "vocaspace-skill-validator-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  if (options.createSkillsRoot !== false) {
    mkdirSync(join(root, ".agents", "skills"), { recursive: true });
  }
  writeAgents(root, "");
  return root;
}

function writeSkill(root, folderName, options = {}) {
  const name = options.name ?? folderName;
  const description = options.description ?? "Repository skill fixture.";
  const lineEnding = options.lineEnding ?? "\n";
  const body = options.body ?? `# ${folderName}`;
  const source = [
    "---",
    `name: ${name}`,
    `description: ${description}`,
    "---",
    "",
    body,
    "",
  ].join(lineEnding);
  writeRawSkill(root, folderName, source);

  for (const [path, content] of Object.entries(options.resources ?? {})) {
    const absolutePath = join(root, ".agents", "skills", folderName, ...path.split("/"));
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content, "utf8");
  }
}

function writeRawSkill(root, folderName, source) {
  const directory = join(root, ".agents", "skills", folderName);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "SKILL.md"), source);
}

function writeAgents(root, source) {
  writeFileSync(join(root, "AGENTS.md"), source, "utf8");
}

function resourceRouting(path, condition) {
  return [
    "## Resource routing",
    "",
    "| Resource | Read condition |",
    "| --- | --- |",
    `| [${path}](${path}) | ${condition} |`,
  ].join("\n");
}

function runValidator(cwd, args = []) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: "utf8",
    shell: false,
  });
}

function parseOutput(result) {
  assert.equal(result.signal, null);
  assert.equal(result.error, undefined);
  return JSON.parse(result.stdout);
}

function assertInvalid(result) {
  const output = parseOutput(result);
  assert.equal(result.status, 1);
  assert.equal(output.status, "invalid");
  return output;
}

function assertDiagnostic(result, expectedStatus, code) {
  const output = parseOutput(result);
  assert.equal(result.status, expectedStatus);
  assertDiagnosticCode(output, code);
  return output;
}

function assertDiagnosticCode(output, code) {
  assert.ok(
    output.diagnostics.some((item) => item.code === code),
    `Expected diagnostic ${code}, received ${JSON.stringify(output.diagnostics)}`,
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
