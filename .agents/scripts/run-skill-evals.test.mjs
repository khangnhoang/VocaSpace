// Test plan:
// - Mục tiêu: kiểm tra PR 3A validation và PR 3B synthetic packaging/report contract.
// - Loại test: Node unit/CLI black-box.
// - Đối tượng: `.agents/scripts/run-skill-evals.mjs` và suite schema v1 được CLI sử dụng.
// - Case thành công: validation, current-tree/ref prepare, blind variants, provenance và deterministic report.
// - Case thất bại: usage/schema/identity/integrity/path/reparse/overwrite và ignored-input refusal.
// - Bảo mật/phân quyền: evaluator-only tách namespace; runner không claim hoặc enforce model/tool isolation.
// - Ổn định/resilience: deterministic hashes/order, source immutability và incomplete-to-complete report lifecycle.
// - Invariant cần giữ: missing evidence có thể incomplete; invalid/tampered evidence phải fail loud.
// - Kết quả verify gần nhất: not run; cập nhật sau PR 3B cumulative verification.
// - Ghi chú: reparse test được skip với lý do cụ thể nếu OS policy không cho tạo fixture link.
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("./run-skill-evals.mjs", import.meta.url));
const temporaryRoots = [];

test.after(() => {
  for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

test("help documents validation and synthetic preparation without isolation claims", () => {
  const result = runCli(process.cwd(), ["--help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /validate --all/);
  assert.match(result.stdout, /validate --skill <skill>/);
  assert.match(result.stdout, /prepare --skill <skill>/);
  assert.doesNotMatch(result.stdout, /^\s*report\b/m);
  assert.match(result.stdout, /not enforced isolation/i);
  assert.equal(result.stderr, "");
});

test("usage errors exit 2 without accepting deferred commands or path overrides", () => {
  for (const args of [
    [],
    ["prepare"],
    ["prepare", "--skill", "example-skill", "--isolation", "synthetic"],
    ["report"],
    ["validate"],
    ["validate", "--all", "--root", "."],
    ["validate", "--skill", "Not-Kebab"],
  ]) {
    const result = runCli(process.cwd(), args);
    assert.equal(result.status, 2, args.join(" "));
    assert.equal(result.stdout, "", args.join(" "));
    assert.notEqual(result.stderr, "", args.join(" "));
  }
});

test("an existing skill without an eval directory is not_configured", () => {
  const root = createRepository();
  createSkill(root, "example-skill");

  const result = runJson(root, ["validate", "--skill", "example-skill"]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.output.status, "not_configured");
  assert.deepEqual(result.output.summary, {
    configured_skills: 0,
    suite_files: 0,
    cases: 0,
    errors: 0,
    warnings: 0,
  });
});

test("validate --all succeeds with zero configured suites", () => {
  const root = createRepository();
  createSkill(root, "example-skill");

  const result = runJson(root, ["validate", "--all"]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.output.status, "valid");
  assert.equal(result.output.summary.configured_skills, 0);
});

test("a nonexistent skill is invalid", () => {
  const root = createRepository();
  const result = runJson(root, ["validate", "--skill", "missing-skill"]);

  assert.equal(result.exitCode, 1);
  assert.equal(result.output.status, "invalid");
  assert.deepEqual(codes(result.output), ["SKILL_NOT_FOUND"]);
});

test("a complete schema-v1 suite set validates with matching identities", () => {
  const root = createConfiguredRepository();

  const result = runJson(root, ["validate", "--skill", "example-skill"]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.output.status, "valid");
  assert.deepEqual(result.output.summary, {
    configured_skills: 1,
    suite_files: 3,
    cases: 3,
    errors: 0,
    warnings: 0,
  });
  assert.deepEqual(result.output.diagnostics, []);
});

test("schema v1 permits an empty case array without imposing an arbitrary minimum", () => {
  const root = createConfiguredRepository();
  for (const suite of ["regression", "routing", "fresh-reader"]) {
    mutateSuite(root, suite, (definition) => {
      definition.cases = [];
    });
  }

  const result = runJson(root, ["validate", "--skill", "example-skill"]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.output.status, "valid");
  assert.equal(result.output.summary.cases, 0);
});

test("configured suite sets must contain exactly the three v1 files", async (t) => {
  await t.test("partial suite set", () => {
    const root = createConfiguredRepository();
    rmSync(join(root, ".agents/evals/example-skill/routing.json"));

    const result = runJson(root, ["validate", "--skill", "example-skill"]);
    assert.equal(result.exitCode, 1);
    assert.equal(result.output.status, "invalid");
    assert.ok(codes(result.output).includes("SUITE_SET_INCOMPLETE"));
  });

  await t.test("extra file", () => {
    const root = createConfiguredRepository();
    writeText(join(root, ".agents/evals/example-skill/notes.txt"), "unsupported\n");

    const result = runJson(root, ["validate", "--skill", "example-skill"]);
    assert.equal(result.exitCode, 1);
    assert.ok(codes(result.output).includes("SUITE_ENTRY_UNSUPPORTED"));
  });

  await t.test("directory without corresponding skill", () => {
    const root = createConfiguredRepository();
    rmSync(join(root, ".agents/skills/example-skill"), { recursive: true });

    const result = runJson(root, ["validate", "--all"]);
    assert.equal(result.exitCode, 1);
    assert.ok(codes(result.output).includes("EVAL_SKILL_NOT_FOUND"));
    assert.equal(codes(result.output).includes("SKILL_NAME_INVALID"), false);
  });

  await t.test("invalid eval directory identity", () => {
    const root = createConfiguredRepository();
    renameSync(
      join(root, ".agents/evals/example-skill"),
      join(root, ".agents/evals/Not-Kebab"),
    );

    const result = runJson(root, ["validate", "--all"]);
    assert.equal(result.exitCode, 1);
    assert.ok(codes(result.output).includes("SKILL_NAME_INVALID"));
    assert.equal(codes(result.output).includes("EVAL_SKILL_NOT_FOUND"), false);
  });
});

test("suite files require valid UTF-8, JSON, and a final newline", async (t) => {
  await t.test("missing final newline", () => {
    const root = createConfiguredRepository();
    const target = suitePath(root, "regression");
    writeFileSync(target, readFileSync(target, "utf8").trimEnd());

    const result = runJson(root, ["validate", "--skill", "example-skill"]);
    assert.equal(result.exitCode, 1);
    assert.ok(codes(result.output).includes("SUITE_FINAL_NEWLINE_MISSING"));
  });

  await t.test("invalid UTF-8", () => {
    const root = createConfiguredRepository();
    writeFileSync(suitePath(root, "regression"), Buffer.from([0xc3, 0x28, 0x0a]));

    const result = runJson(root, ["validate", "--skill", "example-skill"]);
    assert.equal(result.exitCode, 1);
    assert.ok(codes(result.output).includes("SUITE_FILE_ENCODING_INVALID"));
  });

  await t.test("invalid JSON", () => {
    const root = createConfiguredRepository();
    writeText(suitePath(root, "regression"), "{invalid}\n");

    const result = runJson(root, ["validate", "--skill", "example-skill"]);
    assert.equal(result.exitCode, 1);
    assert.ok(codes(result.output).includes("SUITE_JSON_INVALID"));
  });
});

test("strict schema rejects unknown fields, missing fields, and identity mismatches", async (t) => {
  await t.test("unknown nested field", () => {
    const root = createConfiguredRepository();
    mutateSuite(root, "regression", (suite) => {
      suite.cases[0].executor_input.answer_key = "must stay hidden";
    });

    const result = runJson(root, ["validate", "--skill", "example-skill"]);
    assert.equal(result.exitCode, 1);
    assert.ok(codes(result.output).includes("SCHEMA_FIELD_UNSUPPORTED"));
  });

  await t.test("missing field", () => {
    const root = createConfiguredRepository();
    mutateSuite(root, "regression", (suite) => {
      delete suite.cases[0].evaluator_only;
    });

    const result = runJson(root, ["validate", "--skill", "example-skill"]);
    assert.equal(result.exitCode, 1);
    assert.ok(codes(result.output).includes("SCHEMA_FIELD_MISSING"));
  });

  await t.test("directory identity", () => {
    const root = createConfiguredRepository();
    mutateSuite(root, "regression", (suite) => {
      suite.skill = "other-skill";
    });

    const result = runJson(root, ["validate", "--skill", "example-skill"]);
    assert.equal(result.exitCode, 1);
    assert.ok(codes(result.output).includes("SUITE_IDENTITY_MISMATCH"));
  });

  await t.test("filename identity", () => {
    const root = createConfiguredRepository();
    mutateSuite(root, "regression", (suite) => {
      suite.suite = "routing";
    });

    const result = runJson(root, ["validate", "--skill", "example-skill"]);
    assert.equal(result.exitCode, 1);
    assert.ok(codes(result.output).includes("SUITE_IDENTITY_MISMATCH"));
  });
});

test("unsupported integer schema versions use the dedicated status and exit code", () => {
  const root = createConfiguredRepository();
  mutateSuite(root, "regression", (suite) => {
    suite.schema_version = 2;
  });

  const result = runJson(root, ["validate", "--skill", "example-skill"]);

  assert.equal(result.exitCode, 2);
  assert.equal(result.output.status, "unsupported_schema");
  assert.ok(codes(result.output).includes("SCHEMA_VERSION_UNSUPPORTED"));
});

test("case, context, criterion, and safety-veto identities are unique", async (t) => {
  for (const fixture of [
    {
      name: "case",
      code: "CASE_ID_DUPLICATE",
      mutate(suite) {
        suite.cases.push(structuredClone(suite.cases[0]));
      },
    },
    {
      name: "context",
      code: "CONTEXT_ID_DUPLICATE",
      mutate(suite) {
        suite.cases[0].executor_input.context.push(
          structuredClone(suite.cases[0].executor_input.context[0]),
        );
      },
    },
    {
      name: "criterion",
      code: "CRITERION_ID_DUPLICATE",
      mutate(suite) {
        suite.cases[0].evaluator_only.criteria.push(
          structuredClone(suite.cases[0].evaluator_only.criteria[0]),
        );
      },
    },
    {
      name: "safety veto",
      code: "VETO_ID_DUPLICATE",
      mutate(suite) {
        suite.cases[0].evaluator_only.safety_vetoes.push(
          structuredClone(suite.cases[0].evaluator_only.safety_vetoes[0]),
        );
      },
    },
  ]) {
    await t.test(fixture.name, () => {
      const root = createConfiguredRepository();
      mutateSuite(root, "regression", fixture.mutate);

      const result = runJson(root, ["validate", "--skill", "example-skill"]);
      assert.equal(result.exitCode, 1);
      assert.ok(codes(result.output).includes(fixture.code));
    });
  }
});

test("suite-specific contracts enforce regression, routing, and fresh-reader values", async (t) => {
  for (const behaviorArea of [
    "permission",
    "safety",
    "routing",
    "ownership",
    "correctness",
    "evidence",
    "stop",
    "reporting",
  ]) {
    await t.test(`regression behavior area ${behaviorArea}`, () => {
      const root = createConfiguredRepository();
      mutateSuite(root, "regression", (suite) => {
        suite.cases[0].suite_config.behavior_area = behaviorArea;
      });

      const result = runJson(root, ["validate", "--skill", "example-skill"]);
      assert.equal(result.exitCode, 0);
      assert.equal(result.output.status, "valid");
    });
  }

  await t.test("unsupported regression behavior area", () => {
    const root = createConfiguredRepository();
    mutateSuite(root, "regression", (suite) => {
      suite.cases[0].suite_config.behavior_area = "payment";
    });

    const result = runJson(root, ["validate", "--skill", "example-skill"]);
    assert.equal(result.exitCode, 1);
    assert.ok(codes(result.output).includes("SCHEMA_VALUE_INVALID"));
  });

  await t.test("native-trigger routing", () => {
    const root = createConfiguredRepository();
    mutateSuite(root, "routing", (suite) => {
      suite.cases[0].suite_config.routing_mode = "native-trigger";
    });

    const result = runJson(root, ["validate", "--skill", "example-skill"]);
    assert.equal(result.exitCode, 1);
    assert.ok(codes(result.output).includes("SCHEMA_VALUE_INVALID"));
  });

  await t.test("routing identities must be internally consistent", () => {
    const root = createConfiguredRepository();
    mutateSuite(root, "routing", (suite) => {
      suite.cases[0].evaluator_only.expected_routes = ["missing-candidate"];
      suite.cases[0].evaluator_only.forbidden_routes = ["missing-candidate"];
    });

    const result = runJson(root, ["validate", "--skill", "example-skill"]);
    assert.equal(result.exitCode, 1);
    assert.ok(codes(result.output).includes("ROUTING_IDENTITY_INCONSISTENT"));
  });

  await t.test("near-miss routing may expect no repo-local skill", () => {
    const root = createConfiguredRepository();
    mutateSuite(root, "routing", (suite) => {
      suite.cases[0].suite_config.near_miss = true;
      suite.cases[0].suite_config.candidate_skills = ["example-skill"];
      suite.cases[0].evaluator_only.expected_routes = [];
      suite.cases[0].evaluator_only.forbidden_routes = ["example-skill"];
    });

    const result = runJson(root, ["validate", "--skill", "example-skill"]);
    assert.equal(result.exitCode, 0);
    assert.equal(result.output.status, "valid");
  });

  await t.test("invalid fresh-reader mode", () => {
    const root = createConfiguredRepository();
    mutateSuite(root, "fresh-reader", (suite) => {
      suite.cases[0].suite_config.mode = "native-trigger";
    });

    const result = runJson(root, ["validate", "--skill", "example-skill"]);
    assert.equal(result.exitCode, 1);
    assert.ok(codes(result.output).includes("SCHEMA_VALUE_INVALID"));
  });

  await t.test("empty regression invariants", () => {
    const root = createConfiguredRepository();
    mutateSuite(root, "regression", (suite) => {
      suite.cases[0].suite_config.protected_invariants = [];
    });

    const result = runJson(root, ["validate", "--skill", "example-skill"]);
    assert.equal(result.exitCode, 1);
    assert.ok(codes(result.output).includes("SCHEMA_VALUE_INVALID"));
  });
});

test("execution policy records requested access without accepting unsupported isolation claims", () => {
  const root = createConfiguredRepository();
  mutateSuite(root, "regression", (suite) => {
    suite.cases[0].executor_input.execution_policy.packaging_mode = "sandbox";
    suite.cases[0].executor_input.execution_policy.requested_access.network = "enabled";
  });

  const result = runJson(root, ["validate", "--skill", "example-skill"]);

  assert.equal(result.exitCode, 1);
  assert.ok(codes(result.output).includes("SCHEMA_VALUE_INVALID"));
});

test("execution policy accepts a non-empty requested tool allowlist", () => {
  const root = createConfiguredRepository();
  mutateSuite(root, "regression", (suite) => {
    const access = suite.cases[0].executor_input.execution_policy.requested_access;
    access.tools = "allowlisted";
    access.allowed_tools = ["read_file"];
  });

  const result = runJson(root, ["validate", "--skill", "example-skill"]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.output.status, "valid");
});

test("validation does not mutate committed suite definitions", () => {
  const root = createConfiguredRepository();
  const before = ["regression", "routing", "fresh-reader"].map((suite) =>
    readFileSync(suitePath(root, suite)),
  );

  const result = runJson(root, ["validate", "--all"]);
  const after = ["regression", "routing", "fresh-reader"].map((suite) =>
    readFileSync(suitePath(root, suite)),
  );

  assert.equal(result.exitCode, 0);
  assert.deepEqual(after, before);
});

test("repository context paths refuse unsafe forms and reject malformed forms", async (t) => {
  const refusedPaths = [
    "/absolute/file.md",
    "C:/drive/file.md",
    "//server/share/file.md",
    "folder\\file.md",
    "folder/../file.md",
    "file.md:stream",
    "folder./file.md",
    "NUL/file.md",
  ];
  for (const unsafePath of refusedPaths) {
    await t.test(unsafePath, () => {
      const root = createConfiguredRepository();
      mutateSuite(root, "regression", (suite) => {
        suite.cases[0].executor_input.context[0].path = unsafePath;
      });

      const result = runJson(root, ["validate", "--skill", "example-skill"]);
      assert.equal(result.exitCode, 3);
      assert.equal(result.output.artifact_type, "validation_result");
      assert.equal(result.output.status, "operational_error");
      assert.equal(Object.hasOwn(result.output, "error"), false);
      assert.deepEqual(result.output.summary, {
        configured_skills: 1,
        suite_files: 2,
        cases: 2,
        errors: 1,
        warnings: 0,
      });
      assert.equal(result.output.diagnostics.length, 1);
      assert.equal(result.output.diagnostics[0].code, "CONTEXT_PATH_REFUSED");
      assert.doesNotMatch(
        result.output.diagnostics[0].message,
        new RegExp(escapeRegExp(unsafePath)),
      );
    });
  }

  await t.test("operational summary preserves earlier validation diagnostics", () => {
    const root = createConfiguredRepository();
    mutateSuite(root, "fresh-reader", (suite) => {
      suite.extra = true;
    });
    mutateSuite(root, "regression", (suite) => {
      suite.cases[0].executor_input.context[0].path = "/absolute/file.md";
    });

    const result = runJson(root, ["validate", "--skill", "example-skill"]);
    assert.equal(result.exitCode, 3);
    assert.deepEqual(result.output.summary, {
      configured_skills: 1,
      suite_files: 2,
      cases: 2,
      errors: 2,
      warnings: 0,
    });
    assert.ok(codes(result.output).includes("SCHEMA_FIELD_UNSUPPORTED"));
    assert.ok(codes(result.output).includes("CONTEXT_PATH_REFUSED"));
  });

  for (const malformedPath of ["./file.md", "*.md"]) {
    await t.test(malformedPath, () => {
      const root = createConfiguredRepository();
      mutateSuite(root, "regression", (suite) => {
        suite.cases[0].executor_input.context[0].path = malformedPath;
      });

      const result = runJson(root, ["validate", "--skill", "example-skill"]);
      assert.equal(result.exitCode, 1);
      assert.equal(result.output.status, "invalid");
      assert.ok(codes(result.output).includes("CONTEXT_PATH_INVALID"));
    });
  }

  await t.test("missing file", () => {
    const root = createConfiguredRepository();
    mutateSuite(root, "regression", (suite) => {
      suite.cases[0].executor_input.context[0].path = "missing.md";
    });

    const result = runJson(root, ["validate", "--skill", "example-skill"]);
    assert.equal(result.exitCode, 1);
    assert.ok(codes(result.output).includes("CONTEXT_FILE_MISSING"));
  });

  await t.test("directory instead of regular file", () => {
    const root = createConfiguredRepository();
    mkdirSync(join(root, "context-directory"));
    mutateSuite(root, "regression", (suite) => {
      suite.cases[0].executor_input.context[0].path = "context-directory";
    });

    const result = runJson(root, ["validate", "--skill", "example-skill"]);
    assert.equal(result.exitCode, 1);
    assert.ok(codes(result.output).includes("CONTEXT_FILE_MISSING"));
  });
});

test("repository contexts refuse symbolic-link or junction traversal when the OS permits creation", (t) => {
  const root = createConfiguredRepository();
  mkdirSync(join(root, "real-context"));
  writeText(join(root, "real-context/file.md"), "context\n");
  try {
    symlinkSync(
      join(root, "real-context"),
      join(root, "linked-context"),
      process.platform === "win32" ? "junction" : "dir",
    );
  } catch (error) {
    t.skip(`OS denied link fixture creation: ${error.code ?? "unknown"}`);
    return;
  }
  mutateSuite(root, "regression", (suite) => {
    suite.cases[0].executor_input.context[0].path = "linked-context/file.md";
  });

  const result = runJson(root, ["validate", "--skill", "example-skill"]);

  assert.equal(result.exitCode, 3);
  assert.equal(result.output.status, "operational_error");
  assert.equal(result.output.diagnostics[0].code, "PATH_REPARSE_POINT");
});

test("validation output is deterministic, ordered, and free of absolute fixture paths", () => {
  const root = createConfiguredRepository();
  mutateSuite(root, "regression", (suite) => {
    suite.extra = true;
    suite.cases[0].extra = true;
  });

  const first = runCli(root, ["validate", "--all"]);
  const second = runCli(root, ["validate", "--all"]);

  assert.equal(first.status, 1);
  assert.equal(first.stdout, second.stdout);
  assert.equal(first.stderr, second.stderr);
  assert.doesNotMatch(first.stdout, new RegExp(escapeRegExp(root), "i"));
  const output = JSON.parse(first.stdout);
  assert.deepEqual(
    output.diagnostics,
    [...output.diagnostics].sort(compareDiagnostics),
  );
});

test("prepare snapshots a clean current-tree candidate into a blind fixed-root workspace", () => {
  const root = createConfiguredGitRepository();
  const before = gitStatus(root);

  const result = runJson(root, [
    "prepare",
    "--skill",
    "example-skill",
    "--isolation",
    "synthetic",
    "--candidate-current-tree",
    "--no-baseline",
  ]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.output.artifact_type, "prepare_result");
  assert.equal(result.output.mode, "candidate_only");
  assert.deepEqual(result.output.variants, ["A"]);
  assert.match(result.output.workspace_id, /^ws-[a-f0-9]{32}$/);
  assert.equal(gitStatus(root), before);

  const workspace = workspacePath(result.output.workspace_id);
  temporaryRoots.push(workspace);
  const manifest = readJson(join(workspace, "workspace-manifest.json"));
  assert.equal(manifest.sources.candidate.working_tree_state, "clean");
  assert.deepEqual(manifest.variant_mapping, { A: "candidate" });
  assert.ok(existsSync(join(workspace, "executor/A/bundle/SKILL.md")));
  assert.ok(existsSync(join(workspace, "evaluator/suite-definitions/regression.json")));
  assert.equal(existsSync(join(workspace, "report/generated-report.json")), false);
});

test("prepare records relevant tracked and untracked current-tree bytes without mutating them", () => {
  const root = createConfiguredGitRepository();
  writeText(join(root, ".agents/skills/example-skill/new-resource.md"), "untracked resource\n");
  writeText(join(root, ".agents/skills/example-skill/SKILL.md"), "---\nname: example-skill\n---\nchanged\n");
  const sourceBefore = recursiveFileManifest(join(root, ".agents/skills/example-skill"));

  const result = runJson(root, [
    "prepare",
    "--no-baseline",
    "--candidate-current-tree",
    "--isolation",
    "synthetic",
    "--skill",
    "example-skill",
  ]);

  assert.equal(result.exitCode, 0);
  const workspace = workspacePath(result.output.workspace_id);
  temporaryRoots.push(workspace);
  const manifest = readJson(join(workspace, "workspace-manifest.json"));
  assert.equal(manifest.sources.candidate.working_tree_state, "dirty");
  assert.deepEqual(
    manifest.sources.candidate.files.map((entry) => [entry.path, entry.status]),
    [
      [".agents/skills/example-skill/SKILL.md", "tracked"],
      [".agents/skills/example-skill/new-resource.md", "untracked"],
    ],
  );
  assert.deepEqual(recursiveFileManifest(join(root, ".agents/skills/example-skill")), sourceBefore);
});

test("prepare refuses ignored local artifacts under skill or eval roots", () => {
  const root = createConfiguredGitRepository();
  writeText(join(root, ".gitignore"), ".agents/skills/example-skill/local-secret.txt\n");
  writeText(join(root, ".agents/skills/example-skill/local-secret.txt"), "secret fixture\n");

  const result = runJson(root, [
    "prepare",
    "--skill",
    "example-skill",
    "--isolation",
    "synthetic",
    "--candidate-current-tree",
    "--no-baseline",
  ]);

  assert.equal(result.exitCode, 3);
  assert.equal(result.output.artifact_type, "command_error");
  assert.equal(result.output.code, "IGNORED_INPUT_REFUSED");
  assert.doesNotMatch(result.stdout ?? "", /secret fixture/);
});

test("prepare includes an ignored file only when the validated context graph references it", () => {
  const root = createConfiguredGitRepository();
  writeText(join(root, ".gitignore"), "private-context.txt\n");
  writeText(join(root, "private-context.txt"), "explicit ignored context\n");
  mutateSuite(root, "regression", (suite) => {
    suite.cases[0].executor_input.context[0].path = "private-context.txt";
  });

  const result = runJson(root, [
    "prepare",
    "--skill",
    "example-skill",
    "--isolation",
    "synthetic",
    "--candidate-current-tree",
    "--no-baseline",
  ]);

  assert.equal(result.exitCode, 0);
  const workspace = workspacePath(result.output.workspace_id);
  temporaryRoots.push(workspace);
  const manifest = readJson(join(workspace, "workspace-manifest.json"));
  assert.ok(
    manifest.control_plane.files.some(
      (entry) => entry.path === "private-context.txt" && entry.status === "ignored_explicit",
    ),
  );
});

test("comparison prepare resolves refs without checkout and uses a stable equal-hash tie-breaker", () => {
  const root = createConfiguredGitRepository();
  const headBefore = runGitFixture(root, ["rev-parse", "HEAD"]).stdout.trim();
  const first = runJson(root, [
    "prepare",
    "--skill",
    "example-skill",
    "--isolation",
    "synthetic",
    "--candidate-ref",
    "HEAD",
    "--baseline-ref",
    "HEAD",
  ]);
  const second = runJson(root, [
    "prepare",
    "--baseline-ref",
    "HEAD",
    "--candidate-ref",
    "HEAD",
    "--isolation",
    "synthetic",
    "--skill",
    "example-skill",
  ]);

  assert.equal(first.exitCode, 0);
  assert.equal(second.exitCode, 0);
  const firstWorkspace = workspacePath(first.output.workspace_id);
  const secondWorkspace = workspacePath(second.output.workspace_id);
  temporaryRoots.push(firstWorkspace, secondWorkspace);
  const firstManifest = readJson(join(firstWorkspace, "workspace-manifest.json"));
  const secondManifest = readJson(join(secondWorkspace, "workspace-manifest.json"));
  assert.deepEqual(firstManifest.variant_mapping, { A: "baseline", B: "candidate" });
  assert.deepEqual(secondManifest.variant_mapping, firstManifest.variant_mapping);
  assert.equal(firstManifest.workspace_input_hash, secondManifest.workspace_input_hash);
  assert.equal(runGitFixture(root, ["rev-parse", "HEAD"]).stdout.trim(), headBefore);
});

test("executor packages never contain evaluator-only criteria or source-role mapping", () => {
  const root = createConfiguredGitRepository();
  const result = runJson(root, [
    "prepare",
    "--skill",
    "example-skill",
    "--isolation",
    "synthetic",
    "--candidate-ref",
    "HEAD",
    "--baseline-ref",
    "HEAD",
  ]);
  assert.equal(result.exitCode, 0);
  const workspace = workspacePath(result.output.workspace_id);
  temporaryRoots.push(workspace);
  const executorText = readTreeText(join(workspace, "executor"));
  assert.doesNotMatch(executorText, /preserves-boundary|repository-mutation/);
  assert.doesNotMatch(executorText, /"candidate"|"baseline"/);
  assert.match(readFileSync(join(workspace, "workspace-manifest.json"), "utf8"), /"baseline"/);
});

test("prepare rejects unresolved refs and unsafe public argument combinations deterministically", () => {
  const root = createConfiguredGitRepository();
  const unresolved = runJson(root, [
    "prepare",
    "--skill",
    "example-skill",
    "--isolation",
    "synthetic",
    "--candidate-ref",
    "missing-ref",
    "--no-baseline",
  ]);
  assert.equal(unresolved.exitCode, 3);
  assert.equal(unresolved.output.code, "GIT_REF_UNRESOLVED");

  for (const args of [
    [
      "prepare",
      "--skill",
      "example-skill",
      "--isolation",
      "synthetic",
      "--candidate-current-tree",
      "--candidate-ref",
      "HEAD",
      "--no-baseline",
    ],
    [
      "prepare",
      "--skill",
      "example-skill",
      "--isolation",
      "synthetic",
      "--candidate-current-tree",
      "--baseline-ref",
      "HEAD",
      "--no-baseline",
    ],
  ]) {
    const invalid = runCli(root, args);
    assert.equal(invalid.status, 2);
    assert.equal(invalid.stdout, "");
  }
});

function createRepository() {
  const root = mkdtempSync(join(tmpdir(), "skill-evals-test-"));
  temporaryRoots.push(root);
  mkdirSync(join(root, ".agents/skills"), { recursive: true });
  writeText(join(root, "AGENTS.md"), "# Fixture routing\n");
  return root;
}

function createConfiguredRepository() {
  const root = createRepository();
  createSkill(root, "example-skill");
  const evalDirectory = join(root, ".agents/evals/example-skill");
  mkdirSync(evalDirectory, { recursive: true });
  for (const suite of ["regression", "routing", "fresh-reader"]) {
    writeJson(join(evalDirectory, `${suite}.json`), validSuite(suite));
  }
  return root;
}

function createConfiguredGitRepository() {
  const root = createConfiguredRepository();
  runGitFixture(root, ["init"]);
  runGitFixture(root, ["config", "user.email", "skill-evals@example.test"]);
  runGitFixture(root, ["config", "user.name", "Skill Evals Fixture"]);
  runGitFixture(root, ["add", "."]);
  runGitFixture(root, ["commit", "-m", "fixture"]);
  return root;
}

function createSkill(root, skill) {
  writeText(join(root, `.agents/skills/${skill}/SKILL.md`), `---\nname: ${skill}\n---\n`);
}

function validSuite(suite) {
  const evaluatorOnly = {
    criteria: [
      {
        criterion_id: "preserves-boundary",
        description: "The response preserves the requested boundary.",
        material: true,
      },
    ],
    expected_behavior: ["Explain the observable compliant behavior."],
    forbidden_behavior: ["Do not mutate repository state."],
    safety_vetoes: [
      {
        veto_id: "repository-mutation",
        description: "Any repository mutation invalidates the evidence.",
      },
    ],
  };
  if (suite === "routing") {
    evaluatorOnly.expected_routes = ["example-skill"];
    evaluatorOnly.forbidden_routes = ["unrelated-skill"];
  }

  return {
    schema_version: 1,
    artifact_type: "suite_definition",
    skill: "example-skill",
    suite,
    description: `Fixture ${suite} suite.`,
    cases: [
      {
        case_id: `${suite}-case`,
        title: `Fixture ${suite} case`,
        executor_input: {
          prompt: "Respond to the fixture scenario.",
          context: [
            {
              context_id: "root-routing",
              source_type: "repository_file",
              path: "AGENTS.md",
            },
            {
              context_id: "scenario",
              source_type: "inline_text",
              content: "The task is read-only.",
            },
          ],
          execution_policy: {
            packaging_mode: "synthetic",
            fresh_context_required: true,
            variant_identity: "blind",
            requested_access: {
              filesystem: "package_read_only",
              tools: "none",
              allowed_tools: [],
              network: "disabled",
              credentials: "excluded",
              remote: "disabled",
              mutation: "none",
            },
          },
        },
        evaluator_only: evaluatorOnly,
        suite_config:
          suite === "regression"
            ? {
                behavior_area: "permission",
                protected_invariants: ["review-remains-read-only"],
              }
            : suite === "routing"
              ? {
                  routing_mode: "repository",
                  candidate_skills: ["example-skill", "unrelated-skill"],
                  near_miss: false,
                }
              : {
                  mode: "documentation-comprehension",
                  independence_required: true,
                },
      },
    ],
  };
}

function mutateSuite(root, suite, mutate) {
  const path = suitePath(root, suite);
  const value = JSON.parse(readFileSync(path, "utf8"));
  mutate(value);
  writeJson(path, value);
}

function suitePath(root, suite) {
  return join(root, `.agents/evals/example-skill/${suite}.json`);
}

function writeJson(path, value) {
  writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function runJson(cwd, args) {
  const result = runCli(cwd, args);
  assert.equal(result.stderr, "", result.stderr);
  return { exitCode: result.status, output: JSON.parse(result.stdout) };
}

function runCli(cwd, args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    shell: false,
  });
}

function runGitFixture(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  return result;
}

function gitStatus(root) {
  return runGitFixture(root, ["status", "--porcelain=v1", "--untracked-files=all"]).stdout;
}

function workspacePath(workspaceId) {
  return join(tmpdir(), "vocaspace-agent-skill-evals", "v1", workspaceId);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function recursiveFileManifest(root) {
  const entries = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else entries.push([relative(root, path).replaceAll("\\", "/"), readFileSync(path).toString("hex")]);
    }
  };
  visit(root);
  return entries;
}

function readTreeText(root) {
  return recursiveFileManifest(root)
    .map(([path]) => readFileSync(join(root, ...path.split("/")), "utf8"))
    .join("\n");
}

function codes(output) {
  return output.diagnostics.map((diagnostic) => diagnostic.code);
}

function compareDiagnostics(a, b) {
  const keys = ["severity", "path", "code", "skill", "suite", "case_id", "json_path", "message"];
  for (const key of keys) {
    const left = a[key] ?? "";
    const right = b[key] ?? "";
    if (left < right) return -1;
    if (left > right) return 1;
  }
  return 0;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
