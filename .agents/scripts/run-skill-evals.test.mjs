// Test plan:
// - Mục tiêu: kiểm tra public PR 3A CLI giữ đúng suite schema, discovery, path safety và evidence boundary.
// - Loại test: Node unit/CLI black-box.
// - Đối tượng: `.agents/scripts/run-skill-evals.mjs` và suite schema v1 được CLI sử dụng.
// - Case thành công: help, zero-suite state, unconfigured skill, complete trio và empty case array.
// - Case thất bại: usage, partial/extra suite, strict schema, encoding/newline, identity và path/reparse refusal.
// - Bảo mật/phân quyền: evaluator-only tách namespace; unsafe path và symlink/junction không được resolve/follow.
// - Ổn định/resilience: fixtures deterministic, output sorted, không leak absolute path, unsupported/operational status tách biệt.
// - Invariant cần giữ: CLI chỉ validate read-only; không Git/model/workspace/prepare/report hoặc source mutation.
// - Kết quả verify gần nhất: passed 61 tests bằng `node --test .agents/scripts/run-skill-evals.test.mjs` trên Node v24.11.1.
// - Ghi chú: reparse test được skip với lý do cụ thể nếu OS policy không cho tạo fixture link.
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("./run-skill-evals.mjs", import.meta.url));
const temporaryRoots = [];

test.after(() => {
  for (const root of temporaryRoots) rmSync(root, { recursive: true, force: true });
});

test("help documents only the PR 3A commands", () => {
  const result = runCli(process.cwd(), ["--help"]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /validate --all/);
  assert.match(result.stdout, /validate --skill <skill>/);
  assert.doesNotMatch(result.stdout, /^\s*(prepare|report)\b/m);
  assert.equal(result.stderr, "");
});

test("usage errors exit 2 without accepting deferred commands or path overrides", () => {
  for (const args of [
    [],
    ["prepare"],
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
