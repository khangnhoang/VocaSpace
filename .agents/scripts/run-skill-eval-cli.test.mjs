// Test plan:
// - Mục tiêu: kiểm tra Stage 1 runner, Stage 2 prepare và Stage 3 producer-bound reuse mà không gọi model thật.
// - Loại test: Node unit/CLI integration với child process giả.
// - Đối tượng: parser, compiler, evaluator proposal/lineage, producer evidence, materializer, publication và worker pool.
// - Case thành công:
//   - semantic identity/projection, evaluator descriptor, exact replay, plan publication và Stage 1 execution.
// - Case thất bại:
//   - usage/lineage/manifest/materialization/barrier, spawn/nonzero/structured-output/timeout failure.
// - Bảo mật/phân quyền:
//   - provenance không vào model-visible package; donor lineage bị từ chối; model/evaluator call thật bằng 0.
// - Ổn định/resilience:
//   - timeout/interruption độc lập; exact replay không overwrite; `run.json` chỉ xuất hiện sau barrier.
// - Invariant cần giữ:
//   - Stage 2 dispatch bằng 0; plan/lineage/projection canonical; Stage 1 vẫn giữ concurrency cap.
// - Kết quả verify gần nhất: passed 70 tests bằng `node --test .agents/scripts/run-skill-eval-cli.test.mjs` trên Node v24.11.1.
// - Ghi chú: fake CLI là real child process qua `process.execPath`; POSIX child bỏ qua SIGTERM để buộc hard termination.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  ArtifactError,
  canonicalJson,
  manifestEntry,
  parseStrictJson,
  sha256Bytes,
  sha256Canonical,
} from "./lib/skill-evals/artifact-schema-v1.mjs";
import {
  cliBehaviorOptions,
  createReaderLogicalIdentity,
  executePreparedUnit,
  loadAllSelectedWorkspace,
  loadSelectedWorkspace,
  materializePreparedUnits,
  preflightCodexCli,
  readerOutputSchema,
  runBoundedPool,
} from "./lib/skill-evals/codex-cli-runner-v1.mjs";
import {
  assertCliExecutionPlan,
  compileCliPlanInputs,
  compileConcurrencyEstimate,
  compileRevisionCliPlan,
  compileStaticCliPlan,
  materializePreparedUnitDescriptor,
  publishCliPreparedRun,
} from "./lib/skill-evals/cli-execution-plan-v1.mjs";
import {
  assertEvaluatorProposal,
  compileEvaluatorPreparedUnitDescriptor,
  evaluatorProposalSchema,
} from "./lib/skill-evals/cli-evaluator-proposal-v1.mjs";
import { assessAcceptedReaderReuse } from "./lib/skill-evals/cli-impact-v1.mjs";
import {
  assertCliAttemptRecord,
  assertCliUnitState,
  createInitialUnitStates,
  publishCliAttemptRecord,
  publishNextCliRevision,
  readCliRunStore,
  readUnitStates,
  reconcileActiveCliAttempt,
  resolveAcceptedReaderEvidence,
  upgradeCliRunToV2,
  writeCliUnitState,
} from "./lib/skill-evals/cli-run-state-v1.mjs";
import { fixedWorkspaceRoot } from "./lib/skill-evals/synthetic-workspace-v1.mjs";
import { main } from "./run-skill-eval-cli.mjs";

const roots = [];

test.after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

test("help and malformed Stage 1 commands exit without CLI preflight or dispatch", async () => {
  const help = captureIo();
  assert.equal(await main(["--help"], help.dependencies), 0);
  assert.match(help.stdout(), /already prepared v1 workspace/);
  assert.match(help.stdout(), /Default concurrency is 4/);

  for (const args of [
    [],
    ["execute-prepared"],
    ["execute-prepared", "--workspace", "bad", "--unit", "candidate:regression:case-one"],
    ["execute-prepared", "--workspace", workspaceId(), "--unit", "A:regression:case-one"],
    ["execute-prepared", "--workspace", workspaceId(), "--unit", "candidate:unknown:case-one"],
    ["execute-prepared", "--workspace", workspaceId(), "--unit", "candidate:regression:case-one", "--unit", "candidate:regression:case-one"],
    ["execute-prepared", "--workspace", workspaceId(), "--unit", "candidate:regression:case-one", "--concurrency", "0"],
    ["execute-prepared", "--workspace", workspaceId(), "--workspace", workspaceId(), "--unit", "candidate:regression:case-one"],
    ["execute-prepared", "--workspace", workspaceId(), "--unit", "candidate:regression:case-one", "--concurrency", "2", "--concurrency", "3"],
    ["execute-prepared", "--workspace", workspaceId(), "--unit", "candidate:regression:case-one", "--concurrency", "9007199254740992"],
    ["execute-prepared", "--workspace", workspaceId(), "--unit", "candidate:regression:case-one", "--model", "x"],
  ]) {
    const io = captureIo();
    assert.equal(await main(args, io.dependencies), 2, args.join(" "));
    assert.equal(io.stdout(), "", args.join(" "));
    assert.match(io.stderr(), /Usage:/, args.join(" "));
  }
});

test("semantic reader identity excludes workspace and opaque variant locators", () => {
  const first = createReaderLogicalIdentity({
    skill: "example-skill",
    sourceRole: "candidate",
    suite: "regression",
    caseId: "case-one",
  });
  const second = createReaderLogicalIdentity({
    skill: "example-skill",
    sourceRole: "candidate",
    suite: "regression",
    caseId: "case-one",
  });
  const baseline = createReaderLogicalIdentity({
    skill: "example-skill",
    sourceRole: "baseline",
    suite: "regression",
    caseId: "case-one",
  });
  assert.equal(first.unitId, second.unitId);
  assert.notEqual(first.unitId, baseline.unitId);
  assert.doesNotMatch(canonicalJson(first.logicalUnitKey), /workspace|variant|path/);
});

test("source validation produces blind model input and provenance-independent projection", () => {
  const context = [
    { context_id: "zeta", source_type: "inline_text", content: "zeta context" },
    { context_id: "alpha", source_type: "inline_text", content: "alpha context" },
  ];
  const cases = [
    caseFixture("case-one", "success", 20, context),
    caseFixture("case-two", "success"),
  ];
  const resourceFiles = {
    "references/zeta.md": "zeta resource\n",
    "references/nested/alpha.md": "alpha resource\n",
  };
  const firstId = createWorkspace({ mapping: { A: "candidate", B: "baseline" }, cases, resourceFiles });
  const secondId = createWorkspace({ mapping: { A: "baseline", B: "candidate" }, cases, resourceFiles });
  const selector = [{ sourceRole: "candidate", suite: "regression", caseId: "case-one" }];
  const first = loadSelectedWorkspace(firstId, selector);
  const second = loadSelectedWorkspace(secondId, selector);
  const firstUnit = materializePreparedUnits({
    executionId: executionId(),
    selected: first.selected,
    workspacePath: first.workspacePath,
  })[0];
  const secondUnit = materializePreparedUnits({
    executionId: executionId(),
    selected: second.selected,
    workspacePath: second.workspacePath,
  })[0];

  assert.equal(firstUnit.unit_id, secondUnit.unit_id);
  assert.deepEqual(firstUnit.behavior_projection, secondUnit.behavior_projection);
  const visible = listFiles(firstUnit.invocation.cwd);
  assert.deepEqual(visible, [
    "bundle/SKILL.md",
    "bundle/references/nested/alpha.md",
    "bundle/references/zeta.md",
    "case/context/alpha.txt",
    "case/context/zeta.txt",
    "case/prompt.txt",
    "reader-output-schema.json",
    "stdin.txt",
  ]);
  assert.equal(readFileSync(join(firstUnit.invocation.cwd, "bundle/references/nested/alpha.md"), "utf8"), "alpha resource\n");
  assert.equal(readFileSync(join(firstUnit.invocation.cwd, "case/context/alpha.txt"), "utf8"), "alpha context");
  assert.deepEqual(
    firstUnit.behavior_projection.model_visible_files.map((entry) => entry.relative_path),
    visible.filter((path) => path !== "reader-output-schema.json" && path !== "stdin.txt"),
  );
  assert.ok(!visible.some((path) => path.includes("manifest")));
  assert.ok(!visible.some((path) => path.includes("case-two")));
  const stdin = readFileSync(firstUnit.invocation.stdin_path, "utf8");
  const envelope = parseStrictJson(Buffer.from(stdin, "utf8"), "reader input envelope");
  assert.deepEqual(Object.keys(envelope).sort(), [
    "bundle_files",
    "case_prompt",
    "context_files",
    "identity",
    "instruction",
    "kind",
    "requested_execution_policy",
    "schema_version",
  ]);
  assert.equal(envelope.kind, "fresh_reader_input");
  assert.deepEqual(envelope.identity, {
    skill: "example-skill",
    suite: "regression",
    case_id: "case-one",
  });
  assert.deepEqual(envelope.requested_execution_policy, executionPolicy());
  assert.deepEqual(envelope.bundle_files.map((file) => file.relative_path), [
    "bundle/SKILL.md",
    "bundle/references/nested/alpha.md",
    "bundle/references/zeta.md",
  ]);
  assert.equal(envelope.bundle_files[1].content_utf8, "alpha resource\n");
  assert.equal(envelope.bundle_files[1].sha256, sha256Bytes(Buffer.from("alpha resource\n")));
  assert.equal(envelope.case_prompt.relative_path, "case/prompt.txt");
  assert.equal(envelope.case_prompt.content_utf8, "MODE:success DELAY:20\n");
  assert.deepEqual(envelope.context_files.map((file) => file.relative_path), [
    "case/context/alpha.txt",
    "case/context/zeta.txt",
  ]);
  assert.equal(envelope.context_files[0].content_utf8, "alpha context");
  assert.match(envelope.instruction.tool_use, /Do not invoke any tool or process/);
  assert.equal(stdin, canonicalJson(envelope));
  assert.doesNotMatch(stdin, /Source role:|Variant:|Workspace:|ws-[a-f0-9]{32}/);
  assert.ok(firstUnit.source_locator.bundle_manifest_hash);
  assert.ok(firstUnit.source_locator.execution_context_hash);
});

test("behavior projection binds exact stdin framing, output schema and CLI behavior options", () => {
  const cases = [caseFixture("case-one", "success"), caseFixture("case-two", "success")];
  const id = createWorkspace({ mapping: { A: "candidate" }, cases });
  const loaded = loadSelectedWorkspace(id, cases.map((item) => ({
    sourceRole: "candidate",
    suite: "regression",
    caseId: item.case_id,
  })));
  const units = materializePreparedUnits({
    executionId: executionId(),
    selected: loaded.selected,
    workspacePath: loaded.workspacePath,
  });
  const first = units[0];
  assert.notEqual(first.behavior_projection.stdin_sha256, units[1].behavior_projection.stdin_sha256);
  assert.equal(
    first.behavior_projection.stdin_sha256,
    sha256Bytes(readFileSync(first.invocation.stdin_path)),
  );
  assert.equal(
    first.behavior_projection.output_schema_sha256,
    sha256Bytes(Buffer.from(canonicalJson(readerOutputSchema), "utf8")),
  );
  assert.deepEqual(
    parseStrictJson(readFileSync(first.invocation.output_schema_path), "reader output schema"),
    readerOutputSchema,
  );
  assert.deepEqual(first.behavior_projection.cli_behavior_options, cliBehaviorOptions);
  assert.deepEqual(first.invocation.cli_options, cliBehaviorOptions);
});

test("policy and supplied bundle byte changes alter exact embedded behavior projection dimensions", () => {
  const defaultId = createWorkspace({ mapping: { A: "candidate" } });
  const policy = executionPolicy();
  policy.fresh_context_required = false;
  const policyId = createWorkspace({ mapping: { A: "candidate" }, policy });
  const bundleId = createWorkspace({
    mapping: { A: "candidate" },
    skillContent: "---\nname: example-skill\ndescription: Changed fixture skill.\n---\n\n# Fixture\n",
  });
  const selector = [{ sourceRole: "candidate", suite: "regression", caseId: "case-one" }];
  const prepare = (id) => {
    const loaded = loadSelectedWorkspace(id, selector);
    return materializePreparedUnits({
      executionId: executionId(),
      selected: loaded.selected,
      workspacePath: loaded.workspacePath,
    })[0].behavior_projection;
  };
  const base = prepare(defaultId);
  const changedPolicy = prepare(policyId);
  const changedBundle = prepare(bundleId);
  assert.notEqual(base.stdin_sha256, changedPolicy.stdin_sha256);
  assert.deepEqual(base.model_visible_files, changedPolicy.model_visible_files);
  assert.notEqual(base.stdin_sha256, changedBundle.stdin_sha256);
  assert.notDeepEqual(base.model_visible_files, changedBundle.model_visible_files);
});

test("invalid UTF-8 payload fails before preflight and creates no execution root", async () => {
  const id = createWorkspace({
    mapping: { A: "candidate" },
    resourceFiles: { "references/invalid.md": Buffer.from([0xff]) },
  });
  const io = captureIo();
  const exit = await main(
    ["execute-prepared", "--workspace", id, "--unit", "candidate:regression:case-one"],
    { ...io.dependencies, executable: "definitely-not-used" },
  );
  assert.equal(exit, 3);
  assert.match(io.stdout(), /MODEL_INPUT_TEXT_INVALID/);
  assert.ok(!existsSync(join(fixedWorkspaceRoot(), id, "cli-executions")));
});

test("valid UTF-8 BOM is preserved losslessly in the embedded envelope", () => {
  const bomBytes = Buffer.from([0xef, 0xbb, 0xbf, 0x61, 0x0a]);
  const id = createWorkspace({
    mapping: { A: "candidate" },
    resourceFiles: { "references/bom.md": bomBytes },
  });
  const loaded = loadSelectedWorkspace(id, [
    { sourceRole: "candidate", suite: "regression", caseId: "case-one" },
  ]);
  const prepared = materializePreparedUnits({
    executionId: executionId(),
    selected: loaded.selected,
    workspacePath: loaded.workspacePath,
  })[0];
  const envelope = parseStrictJson(
    readFileSync(prepared.invocation.stdin_path),
    "reader input envelope",
  );
  const embedded = envelope.bundle_files.find(
    (file) => file.relative_path === "bundle/references/bom.md",
  );
  assert.equal(embedded.content_utf8, "\ufeffa\n");
  assert.equal(embedded.sha256, sha256Bytes(bomBytes));
  assert.deepEqual(Buffer.from(embedded.content_utf8, "utf8"), bomBytes);
});

test("attempt package materialization refuses an existing execution destination", () => {
  const id = createWorkspace({ mapping: { A: "candidate" } });
  const selector = [{ sourceRole: "candidate", suite: "regression", caseId: "case-one" }];
  const loaded = loadSelectedWorkspace(id, selector);
  const idempotencyBoundary = executionId();
  materializePreparedUnits({
    executionId: idempotencyBoundary,
    selected: loaded.selected,
    workspacePath: loaded.workspacePath,
  });
  assert.throws(
    () =>
      materializePreparedUnits({
        executionId: idempotencyBoundary,
        selected: loaded.selected,
        workspacePath: loaded.workspacePath,
      }),
    (error) => error.code === "EXECUTION_OVERWRITE_REFUSED",
  );
});

test("tampered selected payload fails before preflight and creates no attempt", async () => {
  const id = createWorkspace({ mapping: { A: "candidate" } });
  writeFile(
    join(fixedWorkspaceRoot(), id, "executor", "A", "cases", "regression", "case-one", "prompt.txt"),
    Buffer.from("tampered\n", "utf8"),
  );
  const io = captureIo();
  const exit = await main(
    ["execute-prepared", "--workspace", id, "--unit", "candidate:regression:case-one"],
    { ...io.dependencies, executable: "definitely-not-used" },
  );
  assert.equal(exit, 3);
  assert.match(io.stdout(), /INTEGRITY_MISMATCH/);
  assert.ok(!existsSync(join(fixedWorkspaceRoot(), id, "cli-executions")));
});

test("canonical manifest, identity, path, hash and policy relationship mismatches dispatch zero", async (t) => {
  const scenarios = [
    {
      name: "non-canonical bundle manifest",
      mutate(id) {
        const path = bundleManifestPath(id);
        const value = JSON.parse(readFileSync(path, "utf8"));
        writeFileSync(path, `${JSON.stringify(value)}\n`);
      },
      code: "ARTIFACT_CANONICAL_INVALID",
    },
    {
      name: "execution-context identity mismatch",
      mutate(id) {
        rewriteHashedManifest(contextManifestPath(id), "execution_context_hash", (value) => {
          value.workspace_id = workspaceId();
        });
      },
      code: "ARTIFACT_IDENTITY_MISMATCH",
    },
    {
      name: "unsafe bundle path",
      mutate(id) {
        rewriteHashedManifest(bundleManifestPath(id), "aggregate_sha256", (value) => {
          value.files[0].path = ".agents/skills/example-skill/../escape.md";
        });
      },
      code: "ARTIFACT_SCHEMA_INVALID",
    },
    {
      name: "bundle aggregate hash mismatch",
      mutate(id) {
        const path = bundleManifestPath(id);
        const value = JSON.parse(readFileSync(path, "utf8"));
        value.aggregate_sha256 = "f".repeat(64);
        writeCanonical(path, value);
      },
      code: "INTEGRITY_MISMATCH",
    },
    {
      name: "policy-to-suite mismatch",
      mutate(id) {
        rewriteHashedManifest(contextManifestPath(id), "execution_context_hash", (value) => {
          value.requested_execution_policy.fresh_context_required = false;
        });
      },
      code: "ARTIFACT_RELATIONSHIP_INVALID",
    },
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.name, async () => {
      const id = createWorkspace({ mapping: { A: "candidate" } });
      scenario.mutate(id);
      const io = captureIo();
      const exit = await main(
        ["execute-prepared", "--workspace", id, "--unit", "candidate:regression:case-one"],
        { ...io.dependencies, executable: "definitely-not-used" },
      );
      assert.equal(exit, 3);
      assert.match(io.stdout(), new RegExp(scenario.code));
      assert.ok(!existsSync(join(fixedWorkspaceRoot(), id, "cli-executions")));
    });
  }
});

test("candidate-only workspace rejects baseline and unknown case selectors before preflight", async () => {
  const id = createWorkspace({ mapping: { A: "candidate" } });
  for (const unit of ["baseline:regression:case-one", "candidate:regression:missing-case"]) {
    const io = captureIo();
    const exit = await main(
      ["execute-prepared", "--workspace", id, "--unit", unit],
      { ...io.dependencies, executable: "definitely-not-used" },
    );
    assert.equal(exit, 2);
    assert.equal(io.stdout(), "");
    assert.match(io.stderr(), /Usage:/);
  }
  assert.ok(!existsSync(join(fixedWorkspaceRoot(), id, "cli-executions")));
});

test("an interruption observed before preflight dispatches zero readers", async () => {
  const id = createWorkspace({ mapping: { A: "candidate" } });
  const io = captureIo();
  const interruption = new AbortController();
  interruption.abort();
  const exit = await main(
    ["execute-prepared", "--workspace", id, "--unit", "candidate:regression:case-one"],
    {
      ...io.dependencies,
      executable: "definitely-not-used",
      signal: interruption.signal,
    },
  );
  assert.equal(exit, 3);
  assert.match(io.stdout(), /CLI_EXECUTION_INTERRUPTED/);
  assert.ok(!existsSync(join(fixedWorkspaceRoot(), id, "cli-executions")));
});

test("preflight refuses a missing required flag before creating attempts", async () => {
  const fake = createFakeCli({ helpOmitsSandbox: true });
  const id = createWorkspace({ mapping: { A: "candidate" } });
  const io = captureIo();
  const exit = await main(
    ["execute-prepared", "--workspace", id, "--unit", "candidate:regression:case-one"],
    { ...io.dependencies, executable: process.execPath, prefixArgs: [fake.path] },
  );
  assert.equal(exit, 3);
  assert.match(io.stdout(), /CODEX_PREFLIGHT_FAILED/);
  assert.ok(!existsSync(join(fixedWorkspaceRoot(), id, "cli-executions")));
  assert.equal(readFakeEvents(fake), "");

  const missingExecutableId = createWorkspace({ mapping: { A: "candidate" } });
  const missingIo = captureIo();
  const missingExit = await main(
    [
      "execute-prepared",
      "--workspace",
      missingExecutableId,
      "--unit",
      "candidate:regression:case-one",
    ],
    { ...missingIo.dependencies, executable: join(tmpdir(), "missing-codex-preflight") },
  );
  assert.equal(missingExit, 3);
  assert.match(missingIo.stdout(), /CODEX_PREFLIGHT_FAILED/);
  assert.ok(
    !existsSync(join(fixedWorkspaceRoot(), missingExecutableId, "cli-executions")),
  );
});

test("one selected unit runs one real fake child and persists an accepted v1 observation", async () => {
  const fake = createFakeCli();
  const id = createWorkspace({ mapping: { A: "candidate" } });
  const io = captureIo();
  const exit = await main(
    [
      "execute-prepared",
      "--workspace",
      id,
      "--unit",
      "candidate:regression:case-one",
    ],
    {
      ...io.dependencies,
      executable: process.execPath,
      prefixArgs: [fake.path],
      executionId: executionId(),
    },
  );
  assert.equal(exit, 0);
  const summary = JSON.parse(io.stdout());
  assert.equal(summary.status, "succeeded");
  assert.equal(summary.requested_concurrency, 4);
  assert.equal(summary.effective_concurrency, 1);
  assert.deepEqual(summary.counts, { failed: 0, outcome_unknown: 0, succeeded: 1 });
  assert.equal(summary.results[0].terminal_status, "succeeded");
  const accepted = parseStrictJson(
    readFileSync(summary.results[0].structured_output_path),
    "accepted observation",
  );
  assert.equal(accepted.artifact_type, "candidate_observation");
  assert.equal(accepted.raw_response, "fake response for case-one");
  const events = parseFakeEvents(fake);
  assert.equal(events.filter((event) => event.event === "start").length, 1);
  const start = events.find((event) => event.event === "start");
  assert.equal(start.cwd, join(fixedWorkspaceRoot(), id, "cli-executions", summary.execution_id, "units", summary.selected_unit_ids[0], "attempts", "1", "input"));
  assert.deepEqual(start.argv.slice(0, 5), [
    "exec",
    "--ignore-user-config",
    "--strict-config",
    "-c",
    'model_reasoning_effort="medium"',
  ]);
  assert.deepEqual(start.argv, [
    "exec",
    "--ignore-user-config",
    "--strict-config",
    "-c",
    'model_reasoning_effort="medium"',
    "--model",
    "gpt-5.6-sol",
    "--sandbox",
    "read-only",
    "--ephemeral",
    "--ignore-rules",
    "--skip-git-repo-check",
    "--color",
    "never",
    "--cd",
    start.cwd,
    "--output-schema",
    join(start.cwd, "reader-output-schema.json"),
    "--output-last-message",
    summary.results[0].structured_output_path.replace(
      "accepted-observation.json",
      "model-last-message.json",
    ),
    "--json",
    "-",
  ]);
  const sentEnvelope = parseStrictJson(Buffer.from(start.stdin, "utf8"), "fake CLI stdin");
  assert.equal(sentEnvelope.identity.case_id, "case-one");
  assert.equal(sentEnvelope.case_prompt.content_utf8, "MODE:success DELAY:20\n");
  assert.doesNotMatch(readFileSync(fake.path, "utf8"), /readFileSync/);
});

test("process adapter preserves cwd, schema and output arguments containing spaces", async () => {
  const fake = createFakeCli();
  const id = createWorkspace({ mapping: { A: "candidate" } });
  const loaded = loadSelectedWorkspace(id, [
    { sourceRole: "candidate", suite: "regression", caseId: "case-one" },
  ]);
  const prepared = materializePreparedUnits({
    executionId: executionId(),
    selected: loaded.selected,
    workspacePath: loaded.workspacePath,
  })[0];
  const spacedRoot = mkdtempSync(join(tmpdir(), "vocaspace cli path with spaces "));
  roots.push(spacedRoot);
  const spacedInput = join(spacedRoot, "attempt input");
  cpSync(prepared.invocation.cwd, spacedInput, { recursive: true });
  const spacedUnit = {
    ...prepared,
    invocation: {
      ...prepared.invocation,
      cwd: spacedInput,
      stdin_path: join(spacedInput, "stdin.txt"),
      output_schema_path: join(spacedInput, "reader-output-schema.json"),
    },
  };
  const result = await executePreparedUnit(requestFor(spacedUnit), {
    executable: process.execPath,
    prefixArgs: [fake.path],
    cliVersion: "codex-cli fake-1",
  });
  assert.equal(result.terminal_status, "succeeded");
  const start = parseFakeEvents(fake).find((event) => event.event === "start");
  assert.equal(start.cwd, spacedInput);
  assert.equal(start.argv[start.argv.indexOf("--cd") + 1], spacedInput);
  assert.match(result.structured_output_path, /path with spaces/);
});

test("spawn, terminal and structured-output failures map to exact terminal results", async () => {
  const id = createWorkspace({
    mapping: { A: "candidate" },
    cases: [
      caseFixture("case-one", "success"),
      caseFixture("case-two", "exit"),
      caseFixture("case-three", "extra"),
      caseFixture("case-four", "missing"),
      caseFixture("case-five", "malformed"),
      caseFixture("case-six", "invalidaccess"),
    ],
  });
  const loaded = loadSelectedWorkspace(id, [
    { sourceRole: "candidate", suite: "regression", caseId: "case-one" },
    { sourceRole: "candidate", suite: "regression", caseId: "case-two" },
    { sourceRole: "candidate", suite: "regression", caseId: "case-three" },
    { sourceRole: "candidate", suite: "regression", caseId: "case-four" },
    { sourceRole: "candidate", suite: "regression", caseId: "case-five" },
    { sourceRole: "candidate", suite: "regression", caseId: "case-six" },
  ]);
  const prepared = materializePreparedUnits({
    executionId: executionId(),
    selected: loaded.selected,
    workspacePath: loaded.workspacePath,
  });
  const fake = createFakeCli();
  const version = await preflightCodexCli({ executable: process.execPath, prefixArgs: [fake.path] });
  const requests = prepared.map(requestFor);
  const spawnFailure = await executePreparedUnit(requests[0], {
    executable: join(tmpdir(), "missing-codex-executable"),
    cliVersion: version,
  });
  const terminal = await executePreparedUnit(requests[1], {
    executable: process.execPath,
    prefixArgs: [fake.path],
    cliVersion: version,
  });
  const structuredFailures = [];
  for (const request of requests.slice(2)) {
    structuredFailures.push(
      await executePreparedUnit(request, {
        executable: process.execPath,
        prefixArgs: [fake.path],
        cliVersion: version,
      }),
    );
  }
  assert.equal(spawnFailure.failure.code, "confirmed_not_started");
  assert.equal(spawnFailure.process_metadata.spawned, false);
  assert.equal(terminal.failure.code, "terminal_process_failure");
  assert.equal(terminal.exit_code, 7);
  assert.match(readFileSync(terminal.process_metadata.stderr_path, "utf8"), /fake terminal failure/);
  for (const result of structuredFailures) {
    assert.equal(result.failure.code, "invalid_structured_output");
    assert.equal(result.exit_code, 0);
  }
});

test("confirmed-not-started stays local while an independent pool unit succeeds", async () => {
  const fake = createFakeCli();
  const id = createWorkspace({
    mapping: { A: "candidate" },
    cases: [caseFixture("case-one", "success"), caseFixture("case-two", "success")],
  });
  const loaded = loadSelectedWorkspace(id, [
    { sourceRole: "candidate", suite: "regression", caseId: "case-one" },
    { sourceRole: "candidate", suite: "regression", caseId: "case-two" },
  ]);
  const prepared = materializePreparedUnits({
    executionId: executionId(),
    selected: loaded.selected,
    workspacePath: loaded.workspacePath,
  });
  const cliVersion = await preflightCodexCli({
    executable: process.execPath,
    prefixArgs: [fake.path],
  });
  const results = await runBoundedPool(prepared.map(requestFor), 2, (request) =>
    executePreparedUnit(request, {
      executable:
        request.prepared_unit.logical_unit_key.case_id === "case-one"
          ? join(tmpdir(), "missing-codex-executable")
          : process.execPath,
      prefixArgs:
        request.prepared_unit.logical_unit_key.case_id === "case-one" ? [] : [fake.path],
      cliVersion,
    }),
  );
  assert.equal(results[0].failure.code, "confirmed_not_started");
  assert.equal(results[1].terminal_status, "succeeded");
  assert.equal(parseFakeEvents(fake).filter((event) => event.event === "start").length, 1);
});

test("four units at cap two overlap in two waves while one failure stays local", async () => {
  const fake = createFakeCli();
  const cases = [
    caseFixture("case-one", "success", 180),
    caseFixture("case-two", "success", 180),
    caseFixture("case-three", "exit", 50),
    caseFixture("case-four", "success", 50),
  ];
  const id = createWorkspace({ mapping: { A: "candidate" }, cases });
  const io = captureIo();
  const args = ["execute-prepared", "--workspace", id];
  for (const item of cases) args.push("--unit", `candidate:regression:${item.case_id}`);
  args.push("--concurrency", "2");
  const exit = await main(args, {
    ...io.dependencies,
    executable: process.execPath,
    prefixArgs: [fake.path],
    executionId: executionId(),
  });
  assert.equal(exit, 1);
  const summary = JSON.parse(io.stdout());
  assert.equal(summary.status, "partial_failure");
  assert.deepEqual(summary.counts, { failed: 1, outcome_unknown: 0, succeeded: 3 });
  assert.deepEqual(
    summary.results.map((result) => result.unit_id),
    summary.selected_unit_ids,
  );
  const intervals = intervalsFromEvents(parseFakeEvents(fake));
  assert.equal(intervals.length, 4);
  assert.equal(maxOverlap(intervals), 2);
  assert.ok(intervals[0].start < intervals[1].end && intervals[1].start < intervals[0].end);
  assert.equal(new Set(intervals.map((interval) => interval.caseId)).size, 4);
});

test("a timed-out spawned unit is outcome_unknown while an independent unit succeeds without redispatch", async () => {
  const fake = createFakeCli();
  const cases = [caseFixture("case-one", "ignoreterm", 10_000), caseFixture("case-two", "success", 20)];
  const id = createWorkspace({ mapping: { A: "candidate" }, cases });
  const io = captureIo();
  const startedAt = Date.now();
  const exit = await main(
    [
      "execute-prepared",
      "--workspace",
      id,
      "--unit",
      "candidate:regression:case-one",
      "--unit",
      "candidate:regression:case-two",
      "--concurrency",
      "2",
    ],
    {
      ...io.dependencies,
      executable: process.execPath,
      prefixArgs: [fake.path],
      timeoutMs: 250,
      terminationGraceMs: 50,
      hardKillGraceMs: 50,
      executionId: executionId(),
    },
  );
  assert.equal(exit, 1);
  const summary = JSON.parse(io.stdout());
  assert.equal(summary.status, "outcome_unknown");
  assert.deepEqual(summary.counts, { failed: 0, outcome_unknown: 1, succeeded: 1 });
  assert.equal(summary.results[0].failure.code, "process_outcome_unknown");
  assert.match(summary.results[0].failure.message, /exceeded its timeout/);
  assert.equal(summary.results[0].process_metadata.spawned, true);
  const events = parseFakeEvents(fake);
  assert.equal(events.filter((event) => event.event === "start").length, 2);
  if (process.platform !== "win32") {
    assert.equal(events.filter((event) => event.event === "sigterm").length, 1);
  }
  assert.ok(Date.now() - startedAt < 2_000);
});

test("explicit interruption settles a spawned unit while a completed independent unit is preserved", async () => {
  const fake = createFakeCli();
  const cases = [caseFixture("case-one", "ignoreterm", 10_000), caseFixture("case-two", "success", 20)];
  const id = createWorkspace({ mapping: { A: "candidate" }, cases });
  const io = captureIo();
  const interruption = new AbortController();
  const abortTimer = setTimeout(() => interruption.abort(), 500);
  const exit = await main(
    [
      "execute-prepared",
      "--workspace",
      id,
      "--unit",
      "candidate:regression:case-one",
      "--unit",
      "candidate:regression:case-two",
      "--concurrency",
      "2",
    ],
    {
      ...io.dependencies,
      executable: process.execPath,
      prefixArgs: [fake.path],
      signal: interruption.signal,
      timeoutMs: 10_000,
      terminationGraceMs: 50,
      hardKillGraceMs: 50,
      executionId: executionId(),
    },
  );
  clearTimeout(abortTimer);
  assert.equal(exit, 1);
  const summary = JSON.parse(io.stdout());
  assert.deepEqual(summary.counts, { failed: 0, outcome_unknown: 1, succeeded: 1 });
  assert.match(summary.results[0].failure.message, /was interrupted/);
  assert.equal(summary.results[1].terminal_status, "succeeded");
  assert.equal(parseFakeEvents(fake).filter((event) => event.event === "start").length, 2);
});

test("different child completion orders preserve selected/result ordering and counts", async () => {
  const run = async (delays) => {
    const fake = createFakeCli();
    const cases = [
      caseFixture("case-one", "success", delays[0]),
      caseFixture("case-two", "success", delays[1]),
      caseFixture("case-three", "exit", delays[2]),
      caseFixture("case-four", "success", delays[3]),
    ];
    const id = createWorkspace({ mapping: { A: "candidate" }, cases });
    const io = captureIo();
    const args = ["execute-prepared", "--workspace", id];
    for (const item of cases) args.push("--unit", `candidate:regression:${item.case_id}`);
    args.push("--concurrency", "4");
    assert.equal(await main(args, {
      ...io.dependencies,
      executable: process.execPath,
      prefixArgs: [fake.path],
      executionId: executionId(),
    }), 1);
    const summary = JSON.parse(io.stdout());
    return {
      completionOrder: parseFakeEvents(fake)
        .filter((event) => event.event === "end")
        .map((event) => event.caseId),
      stable: {
        status: summary.status,
        counts: summary.counts,
        selected: summary.selected_unit_ids,
        results: summary.results.map((result) => ({
          unit_id: result.unit_id,
          terminal_status: result.terminal_status,
          failure_code: result.failure?.code ?? null,
        })),
      },
    };
  };

  const forward = await run([40, 80, 120, 160]);
  const reverse = await run([160, 120, 80, 40]);
  assert.notDeepEqual(forward.completionOrder, reverse.completionOrder);
  assert.deepEqual(forward.stable, reverse.stable);
});

test("Stage 2 all-scope compilation preserves empty suites and deterministic semantic order", () => {
  const id = createWorkspace({
    mapping: { A: "candidate", B: "baseline" },
    cases: [caseFixture("case-zeta", "success"), caseFixture("case-alpha", "success")],
  });
  const workspace = loadAllSelectedWorkspace(id);
  assert.deepEqual(workspace.selectedScope, {
    skill: "example-skill",
    mode: "comparison",
    source_roles: ["baseline", "candidate"],
    suites: [
      { suite: "regression", case_ids: ["case-alpha", "case-zeta"] },
      { suite: "routing", case_ids: [] },
      { suite: "fresh-reader", case_ids: [] },
    ],
  });
  const compiled = compileCliPlanInputs(workspace);
  assert.deepEqual(
    compiled.readerDescriptors.map((item) => [
      item.logical_unit_key.case_id,
      item.logical_unit_key.source_role,
    ]),
    [
      ["case-alpha", "baseline"],
      ["case-alpha", "candidate"],
      ["case-zeta", "baseline"],
      ["case-zeta", "candidate"],
    ],
  );
  assert.equal(compiled.evaluatorUnits.length, 2);
  assert.deepEqual(compiled.evaluatorUnits[0].dependencies.map((item) => item.source_role), [
    "baseline",
    "candidate",
  ]);
});

test("evaluator-proposal-v1 accepts exact advisory findings and rejects authoritative or misordered data", () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const staticPlan = compileCliPlanInputs(workspace).evaluatorUnits[0];
  const valid = {
    schema_version: 1,
    output_type: "evaluator_proposal",
    criterion_findings: [{
      criterion_id: "fixture-criterion",
      assessment: "satisfied",
      rationale: "The observation satisfies the criterion.",
    }],
    safety_veto_findings: [],
    comparison_findings: null,
    summary: "The candidate satisfies the fixture rubric.",
  };
  assert.equal(assertEvaluatorProposal(valid, staticPlan), valid);
  assert.throws(
    () => assertEvaluatorProposal({ ...valid, recommendation: "accept" }, staticPlan),
    /fields are invalid/,
  );
  assert.throws(
    () => assertEvaluatorProposal({ ...valid, comparison_findings: { material_differences: [], uncertainties: [] } }, staticPlan),
    /Candidate-only/,
  );
  assert.throws(
    () => assertEvaluatorProposal({ ...valid, summary: " padded " }, staticPlan),
    /trimmed/,
  );
  assert.equal(evaluatorProposalSchema.additionalProperties, false);
});

test("producer-bound evaluator compilation accepts provenance-only workspace changes", () => {
  const firstWorkspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const donorWorkspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const firstStatic = compileCliPlanInputs(firstWorkspace).evaluatorUnits[0];
  const donorStatic = compileCliPlanInputs(donorWorkspace).evaluatorUnits[0];
  const donorBinding = acceptedBinding(donorStatic.dependencies[0], donorStatic);
  const donorDescriptor = compileEvaluatorPreparedUnitDescriptor({
    staticPlan: donorStatic,
    bindings: [donorBinding],
    cliOptions: cliBehaviorOptions,
  });
  assert.equal(donorDescriptor.kind, "evaluator");
  assert.deepEqual(donorDescriptor.dependencies, [donorStatic.dependencies[0].unit_id]);
  assert.doesNotMatch(
    donorDescriptor.invocation_content.stdin_bytes.toString("utf8"),
    /workspace_id|variant_id|execution_context_hash/,
  );
  const crossRevisionDescriptor = compileEvaluatorPreparedUnitDescriptor({
    staticPlan: firstStatic,
    bindings: [donorBinding],
    cliOptions: cliBehaviorOptions,
  });
  assert.equal(
    crossRevisionDescriptor.behavior_projection.stdin_sha256,
    donorDescriptor.behavior_projection.stdin_sha256,
  );
  assert.deepEqual(
    crossRevisionDescriptor.source_locator.accepted_results[0].producer_locator,
    donorBinding.producer_locator,
  );
  const substitutedBinding = {
    ...donorBinding,
    producer_locator: structuredClone(donorBinding.producer_locator),
  };
  substitutedBinding.producer_locator = structuredClone(firstStatic.dependencies[0].source_locator);
  assert.throws(
    () => compileEvaluatorPreparedUnitDescriptor({
      staticPlan: firstStatic,
      bindings: [substitutedBinding],
      cliOptions: cliBehaviorOptions,
    }),
    /workspace_id|prepared case/,
  );
});

test("evaluator descriptor rejects a valid reader unit substituted into another semantic role", () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate", B: "baseline" } }));
  const compiled = compileCliPlanInputs(workspace);
  const staticPlan = compiled.evaluatorUnits[0];
  const bindings = staticPlan.dependencies.map((dependency) => acceptedBinding(dependency, staticPlan));
  const descriptor = compileEvaluatorPreparedUnitDescriptor({
    staticPlan,
    bindings,
    cliOptions: cliBehaviorOptions,
  });
  const substituted = {
    ...descriptor,
    source_locator: structuredClone(descriptor.source_locator),
  };
  const [first, second] = substituted.source_locator.accepted_results;
  first.unit_id = second.unit_id;
  first.attempt_id = `${second.unit_id}-attempt-1`;
  first.structured_output_path = `attempts/${second.unit_id}/1/output/observation.json`;
  const preparedRoot = mkdtempSync(join(tmpdir(), "vocaspace-cli-evaluator-substitution-"));
  roots.push(preparedRoot);
  assert.throws(
    () => materializePreparedUnitDescriptor({ preparedRoot, descriptor: substituted }),
    /do not match evaluator dependencies/,
  );
  assert.deepEqual(listFiles(preparedRoot), []);
});

test("accepted reader evidence traverses producer state, impact, and compiler without rewriting observation bytes", () => {
  const producingWorkspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate", B: "baseline" } }));
  const currentWorkspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "baseline", B: "candidate" } }));
  const producing = compileStaticCliPlan({
    workspace: producingWorkspace,
    runId: `run-${"4".repeat(32)}`,
    localProcessCap: 2,
  });
  const current = compileStaticCliPlan({
    workspace: currentWorkspace,
    runId: `run-${"5".repeat(32)}`,
    localProcessCap: 2,
  });
  const graph = publishAcceptedReaderGraph(producing, "candidate");
  const baselineGraph = publishAcceptedReaderGraph(producing, "baseline");
  const before = listFiles(graph.runRoot).map((path) => [path, readFileSync(join(graph.runRoot, ...path.split("/")))]);
  const evidence = resolveAcceptedReaderEvidence({
    runRoot: graph.runRoot,
    runId: producing.plan.run_id,
    unitState: graph.unitState,
    sourceRole: "candidate",
  });
  const currentReader = current.readerDescriptors.find((descriptor) =>
    descriptor.logical_unit_key.source_role === "candidate");
  const baselineEvidence = resolveAcceptedReaderEvidence({
    runRoot: baselineGraph.runRoot,
    runId: producing.plan.run_id,
    unitState: baselineGraph.unitState,
    sourceRole: "baseline",
  });
  assert.equal(evidence.unit_id, currentReader.unit_id);
  assert.equal(assessAcceptedReaderReuse({ acceptedEvidence: evidence, currentDescriptor: currentReader }).status, "reusable");
  const descriptor = compileEvaluatorPreparedUnitDescriptor({
    staticPlan: current.plan.evaluator_units[0],
    bindings: [evidence, baselineEvidence],
    cliOptions: cliBehaviorOptions,
  });
  assert.equal(descriptor.dependencies.includes(currentReader.unit_id), true);
  assert.deepEqual(evidence.observation_bytes, graph.observationBytes);
  assert.deepEqual(
    listFiles(graph.runRoot).map((path) => [path, readFileSync(join(graph.runRoot, ...path.split("/")))]),
    before,
  );
});

test("mutable current fingerprint cannot launder a different producing descriptor", () => {
  const producingWorkspace = loadAllSelectedWorkspace(createWorkspace({
    mapping: { A: "candidate", B: "baseline" },
    skillContent: "---\nname: example-skill\ndescription: Old fixture.\n---\n\n# Old\n",
  }));
  const currentWorkspace = loadAllSelectedWorkspace(createWorkspace({
    mapping: { A: "baseline", B: "candidate" },
    skillContent: "---\nname: example-skill\ndescription: New fixture.\n---\n\n# New\n",
  }));
  const producing = compileStaticCliPlan({ workspace: producingWorkspace, runId: `run-${"6".repeat(32)}`, localProcessCap: 2 });
  const current = compileStaticCliPlan({ workspace: currentWorkspace, runId: `run-${"7".repeat(32)}`, localProcessCap: 2 });
  const graph = publishAcceptedReaderGraph(producing, "candidate");
  const currentReader = current.readerDescriptors.find((descriptor) =>
    descriptor.logical_unit_key.source_role === "candidate");
  graph.unitState.current_behavior_fingerprint = sha256Canonical(currentReader.behavior_projection);
  const evidence = resolveAcceptedReaderEvidence({
    runRoot: graph.runRoot,
    runId: producing.plan.run_id,
    unitState: graph.unitState,
    sourceRole: "candidate",
  });
  assert.equal(
    assessAcceptedReaderReuse({ acceptedEvidence: evidence, currentDescriptor: currentReader }).status,
    "invalidated",
  );
});

test("producer revision substitution rejects before evaluator materialization and preserves the store", () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const producing = compileStaticCliPlan({ workspace, runId: `run-${"8".repeat(32)}`, localProcessCap: 2 });
  const graph = publishAcceptedReaderGraph(producing);
  const attemptPath = join(graph.runRoot, ...graph.unitState.accepted_attempt.attempt_record_path.split("/"));
  const substituted = parseStrictJson(readFileSync(attemptPath), "attempt record");
  substituted.producer_revision = 2;
  writeCanonical(attemptPath, substituted);
  graph.unitState.accepted_attempt.attempt_record_sha256 = sha256Bytes(readFileSync(attemptPath));
  const before = listFiles(graph.runRoot).map((path) => [path, readFileSync(join(graph.runRoot, ...path.split("/")))]);
  assert.throws(
    () => resolveAcceptedReaderEvidence({
      runRoot: graph.runRoot,
      runId: producing.plan.run_id,
      unitState: graph.unitState,
      sourceRole: "candidate",
    }),
    /producing execution plan|ENOENT/,
  );
  assert.deepEqual(
    listFiles(graph.runRoot).map((path) => [path, readFileSync(join(graph.runRoot, ...path.split("/")))]),
    before,
  );
  assert.equal(existsSync(join(graph.runRoot, "revisions", "2", "prepared")), false);
});

test("accepted evidence rejects symbolic-link traversal without changing canonical state", (context) => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const producing = compileStaticCliPlan({ workspace, runId: `run-${"b".repeat(32)}`, localProcessCap: 2 });
  const graph = publishAcceptedReaderGraph(producing);
  const outputDirectory = join(
    graph.runRoot,
    "attempts",
    graph.unitState.unit_id,
    "1",
    "output",
  );
  const donorDirectory = mkdtempSync(join(tmpdir(), "vocaspace-cli-output-donor-"));
  roots.push(donorDirectory);
  writeFile(join(donorDirectory, "accepted-observation.json"), graph.observationBytes);
  rmSync(outputDirectory, { recursive: true });
  try {
    symlinkSync(donorDirectory, outputDirectory, "junction");
  } catch (error) {
    if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) {
      context.skip(`symbolic-link creation unavailable: ${error.code}`);
      return;
    }
    throw error;
  }
  const statePaths = [
    "run.json",
    `units/${graph.unitState.unit_id}.json`,
    `attempts/${graph.unitState.unit_id}/1/attempt.json`,
    `attempts/${graph.unitState.unit_id}/1/result.json`,
    "revisions/1/execution-plan.json",
  ];
  const before = statePaths.map((path) => readFileSync(join(graph.runRoot, ...path.split("/"))));
  assert.throws(
    () => resolveAcceptedReaderEvidence({
      runRoot: graph.runRoot,
      runId: producing.plan.run_id,
      unitState: graph.unitState,
      sourceRole: "candidate",
    }),
    /symbolic link/,
  );
  assert.deepEqual(
    statePaths.map((path) => readFileSync(join(graph.runRoot, ...path.split("/")))),
    before,
  );
});

test("replay-safe materializer publishes exact two-file inputs and refuses altered targets", () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const descriptor = compileCliPlanInputs(workspace).readerDescriptors[0];
  const root = mkdtempSync(join(tmpdir(), "vocaspace-cli-materializer-"));
  roots.push(root);
  const first = materializePreparedUnitDescriptor({ preparedRoot: root, descriptor });
  const snapshot = readFileSync(first.invocation.stdin_path);
  const replay = materializePreparedUnitDescriptor({ preparedRoot: root, descriptor });
  assert.deepEqual(replay, first);
  assert.deepEqual(listFiles(join(root, descriptor.unit_id)), [
    "input/output-schema.json",
    "input/stdin.txt",
  ]);
  assert.deepEqual(readFileSync(first.invocation.stdin_path), snapshot);
  writeFileSync(first.invocation.stdin_path, Buffer.from("altered\n", "utf8"));
  assert.throws(
    () => materializePreparedUnitDescriptor({ preparedRoot: root, descriptor }),
    /do not match/,
  );
  assert.equal(readFileSync(first.invocation.stdin_path, "utf8"), "altered\n");
});

test("rename failure with no final target preserves the original publication error", () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const descriptor = compileCliPlanInputs(workspace).readerDescriptors[0];
  const root = mkdtempSync(join(tmpdir(), "vocaspace-cli-rename-"));
  roots.push(root);
  const failure = new Error("injected rename failure");
  assert.throws(
    () => materializePreparedUnitDescriptor({
      preparedRoot: root,
      descriptor,
      rename: () => { throw failure; },
    }),
    (error) => error === failure,
  );
  assert.equal(existsSync(join(root, descriptor.unit_id)), false);
});

test("materializer refuses partial, unexpected, and non-regular final inventories without repair", () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const descriptor = compileCliPlanInputs(workspace).readerDescriptors[0];
  for (const scenario of ["partial", "unexpected", "non-regular"]) {
    const root = mkdtempSync(join(tmpdir(), `vocaspace-cli-${scenario}-`));
    roots.push(root);
    const inputRoot = join(root, descriptor.unit_id, "input");
    mkdirSync(inputRoot, { recursive: true });
    if (scenario === "non-regular") {
      mkdirSync(join(inputRoot, "stdin.txt"));
      writeFileSync(join(inputRoot, "output-schema.json"), descriptor.invocation_content.output_schema_bytes);
    } else {
      writeFileSync(join(inputRoot, "stdin.txt"), descriptor.invocation_content.stdin_bytes);
      if (scenario === "unexpected") {
        writeFileSync(join(inputRoot, "output-schema.json"), descriptor.invocation_content.output_schema_bytes);
        writeFileSync(join(inputRoot, "extra.txt"), Buffer.from("extra\n", "utf8"));
      }
    }
    const before = listFiles(join(root, descriptor.unit_id));
    assert.throws(
      () => materializePreparedUnitDescriptor({ preparedRoot: root, descriptor }),
      /inventory is invalid/,
      scenario,
    );
    assert.deepEqual(listFiles(join(root, descriptor.unit_id)), before, scenario);
  }
});

test("Stage 2 run upgrades through a replayable unit bootstrap with run.json replaced last", () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const fixture = publishStage2Run(workspace, `run-${"c".repeat(32)}`);
  const originalMarker = readFileSync(join(fixture.runPath, "run.json"));
  assert.throws(
    () => upgradeCliRunToV2({
      runRoot: fixture.runRoot,
      runId: fixture.plan.run_id,
      afterBootstrap: () => { throw new Error("injected crash before marker replacement"); },
    }),
    /injected crash/,
  );
  assert.deepEqual(readFileSync(join(fixture.runPath, "run.json")), originalMarker);
  assert.equal(readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id }).run.schema_version, 1);
  assert.equal(readUnitStates(fixture.runPath, fixture.plan).length, fixture.plan.counts.total_units);
  const upgraded = upgradeCliRunToV2({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  assert.equal(upgraded.run.schema_version, 2);
  assert.equal(upgraded.run.mode, "exact_current");
  assert.equal(upgradeCliRunToV2({ runRoot: fixture.runRoot, runId: fixture.plan.run_id }).run.schema_version, 2);
  assert.equal(existsSync(join(fixture.runPath, "attempts")), false);
});

test("partial or semantically substituted unit bootstrap cannot promote a Stage 2 marker", () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate", B: "baseline" } }));
  const fixture = publishStage2Run(workspace, `run-${"d".repeat(32)}`);
  const states = createInitialUnitStates(fixture.plan);
  mkdirSync(join(fixture.runPath, "units"));
  states.forEach((state, index) => {
    const value = structuredClone(state);
    if (index === 0) value.logical_unit_key = structuredClone(states[1].logical_unit_key);
    writeCanonical(join(fixture.runPath, "units", `${value.unit_id}.json`), value);
  });
  const before = readFileSync(join(fixture.runPath, "run.json"));
  assert.throws(
    () => upgradeCliRunToV2({ runRoot: fixture.runRoot, runId: fixture.plan.run_id }),
    /identity/,
  );
  assert.deepEqual(readFileSync(join(fixture.runPath, "run.json")), before);
});

test("unknown v1 fields and orphan temp bytes never become a Stage 3 publication marker", () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const fixture = publishStage2Run(workspace, `run-${"a".repeat(32)}`);
  writeFile(join(fixture.runPath, ".tmp-orphan"), Buffer.from("partial", "utf8"));
  const markerPath = join(fixture.runPath, "run.json");
  const invalidMarker = JSON.parse(readFileSync(markerPath, "utf8"));
  invalidMarker.unexpected = true;
  writeCanonical(markerPath, invalidMarker);
  const before = readFileSync(markerPath);
  assert.throws(
    () => upgradeCliRunToV2({ runRoot: fixture.runRoot, runId: fixture.plan.run_id }),
    /fields are invalid/,
  );
  assert.deepEqual(readFileSync(markerPath), before);
  assert.equal(existsSync(join(fixture.runPath, "units")), false);
});

test("immutable attempt publication enforces terminal output nullability and exact replay", () => {
  const runPath = mkdtempSync(join(tmpdir(), "vocaspace-cli-attempt-record-"));
  roots.push(runPath);
  const unitId = `reader-${"1".repeat(64)}`;
  const failed = {
    schema_version: 1,
    artifact_type: "cli_attempt_record",
    run_id: `run-${"2".repeat(32)}`,
    unit_id: unitId,
    attempt_id: `${unitId}-attempt-1`,
    attempt_ordinal: 1,
    producer_revision: 1,
    terminal_status: "failed",
    result_origin: "worker_result",
    execution_result_path: `attempts/${unitId}/1/result.json`,
    execution_result_sha256: "3".repeat(64),
    structured_output_path: null,
    structured_output_sha256: null,
    recovery_reason: null,
  };
  assert.equal(assertCliAttemptRecord(failed), failed);
  assert.deepEqual(publishCliAttemptRecord({ runPath, record: failed }), failed);
  assert.deepEqual(publishCliAttemptRecord({ runPath, record: failed }), failed);
  const substituted = { ...failed, structured_output_path: `attempts/${unitId}/1/output/observation.json` };
  assert.throws(() => assertCliAttemptRecord(substituted), /null output/);
  assert.throws(
    () => publishCliAttemptRecord({ runPath, record: { ...failed, terminal_status: "outcome_unknown" } }),
    /exact-replay/,
  );
});

test("same-scope next revision preserves revision 1 and zero-attempt history", () => {
  const firstWorkspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const secondWorkspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const fixture = publishStage2Run(firstWorkspace, `run-${"e".repeat(32)}`);
  const revisionOne = readFileSync(join(fixture.runPath, "revisions", "1", "execution-plan.json"));
  const upgraded = upgradeCliRunToV2({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  const revision = compileRevisionCliPlan({
    workspace: secondWorkspace,
    runId: fixture.plan.run_id,
    revision: 2,
    processSettings: upgraded.run.process_settings,
  });
  const published = publishNextCliRevision({
    runRoot: fixture.runRoot,
    runId: fixture.plan.run_id,
    ...revision,
  });
  assert.equal(published.run.current_revision, 2);
  assert.equal(published.plan.schema_version, 2);
  assert.deepEqual(readFileSync(join(fixture.runPath, "revisions", "1", "execution-plan.json")), revisionOne);
  assert.equal(published.states.every((state) => state.current_revision === 2 && state.attempt_summaries.length === 0), true);
  assert.equal(existsSync(join(fixture.runPath, "attempts")), false);
});

test("next-revision crash before marker replacement recovers only from the exact published graph", () => {
  const firstWorkspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const secondWorkspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const fixture = publishStage2Run(firstWorkspace, `run-${"9".repeat(32)}`);
  const upgraded = upgradeCliRunToV2({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  const revision = compileRevisionCliPlan({
    workspace: secondWorkspace,
    runId: fixture.plan.run_id,
    revision: 2,
    processSettings: upgraded.run.process_settings,
  });
  assert.throws(
    () => publishNextCliRevision({
      runRoot: fixture.runRoot,
      runId: fixture.plan.run_id,
      ...revision,
      beforeMarkerReplace: () => { throw new Error("injected crash before revision marker"); },
    }),
    /injected crash/,
  );
  assert.equal(readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id }).run.current_revision, 1);
  const recovered = upgradeCliRunToV2({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  assert.equal(recovered.recovered_next_revision, true);
  assert.equal(recovered.run.current_revision, 2);
  assert.equal(recovered.states.every((state) => state.current_revision === 2), true);
});

test("next-revision recovery deterministically completes mixed old and new unit files", () => {
  const firstWorkspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate", B: "baseline" } }));
  const secondWorkspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "baseline", B: "candidate" } }));
  const fixture = publishStage2Run(firstWorkspace, `run-${"7".repeat(32)}`);
  const upgraded = upgradeCliRunToV2({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  const revision = compileRevisionCliPlan({
    workspace: secondWorkspace,
    runId: fixture.plan.run_id,
    revision: 2,
    processSettings: upgraded.run.process_settings,
  });
  assert.throws(
    () => publishNextCliRevision({
      runRoot: fixture.runRoot,
      runId: fixture.plan.run_id,
      ...revision,
      afterUnitWrite: (index) => {
        if (index === 0) throw new Error("injected crash during unit reclassification");
      },
    }),
    /injected crash/,
  );
  assert.equal(readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id }).run.current_revision, 1);
  const recovered = upgradeCliRunToV2({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  assert.equal(recovered.run.current_revision, 2);
  assert.equal(recovered.states.every((state) => state.current_revision === 2), true);
});

test("prepare --run emits the canonical zero-dispatch Stage 3 result and refuses scope substitution", async () => {
  const firstId = createWorkspace({ mapping: { A: "candidate" } });
  const secondId = createWorkspace({ mapping: { A: "candidate" } });
  const changedId = createWorkspace({
    mapping: { A: "candidate" },
    cases: [caseFixture("different-case", "success")],
  });
  const runRoot = mkdtempSync(join(tmpdir(), "vocaspace-cli-revision-command-"));
  roots.push(runRoot);
  const runId = `run-${"f".repeat(32)}`;
  const args = [
    "prepare", "--skill", "example-skill", "--isolation", "synthetic",
    "--candidate-current-tree", "--no-baseline",
  ];
  const first = captureIo();
  assert.equal(await main(args, {
    ...first.dependencies,
    runId,
    runRoot,
    prepareWorkspace: () => ({ workspace_id: firstId }),
    loadAllWorkspace: loadAllSelectedWorkspace,
  }), 0);
  const next = captureIo();
  assert.equal(await main([...args, "--run", runId], {
    ...next.dependencies,
    runRoot,
    prepareWorkspace: () => ({ workspace_id: secondId }),
    loadAllWorkspace: loadAllSelectedWorkspace,
  }), 0);
  const result = JSON.parse(next.stdout());
  assert.equal(result.artifact_type, "cli_run_command_result");
  assert.equal(result.revision, 2);
  assert.deepEqual(result.dispatch_counts, { reader: 0, evaluator: 0, total: 0 });
  const markerBefore = readFileSync(join(runRoot, runId, "run.json"));
  const rejected = captureIo();
  assert.equal(await main([...args, "--run", runId], {
    ...rejected.dependencies,
    runRoot,
    prepareWorkspace: () => ({ workspace_id: changedId }),
    loadAllWorkspace: loadAllSelectedWorkspace,
  }), 3);
  assert.match(rejected.stdout(), /CLI_STATE_INVALID/);
  assert.deepEqual(readFileSync(join(runRoot, runId, "run.json")), markerBefore);
  assert.equal(existsSync(join(runRoot, runId, "revisions", "3")), false);
});

test("status derives a canonical v1 zero-attempt snapshot without changing any run bytes", async () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const fixture = publishStage2Run(workspace, `run-${"6".repeat(32)}`);
  writeFile(join(fixture.runPath, ".units-stage-orphan"), Buffer.from("orphan", "utf8"));
  const before = listFiles(fixture.runPath).map((path) => [path, readFileSync(join(fixture.runPath, ...path.split("/")))]);
  const io = captureIo();
  assert.equal(await main(["status", "--run", fixture.plan.run_id], {
    ...io.dependencies,
    runRoot: fixture.runRoot,
  }), 0);
  const result = JSON.parse(io.stdout());
  assert.equal(result.command, "status");
  assert.deepEqual(result.dispatched_unit_ids, []);
  assert.equal(result.counts.pending, fixture.plan.reader_units.length);
  assert.equal(result.counts.dependency_blocked, fixture.plan.evaluator_units.length);
  assert.deepEqual(
    listFiles(fixture.runPath).map((path) => [path, readFileSync(join(fixture.runPath, ...path.split("/")))]),
    before,
  );
  assert.equal(existsSync(join(fixture.runPath, "units")), false);
});

test("run persists reader attempts, isolates failure, prepares ready evaluators, and reuses success", async () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({
    mapping: { A: "candidate" },
    cases: [caseFixture("case-one", "success"), caseFixture("case-two", "success")],
  }));
  const fixture = publishStage2Run(workspace, `run-${"5".repeat(32)}`);
  const executeUnit = durableFakeWorker({ failedCaseId: "case-two" });
  const first = captureIo();
  assert.equal(await main(["run", "--run", fixture.plan.run_id], {
    ...first.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => "fake-cli",
    executeUnit,
  }), 1);
  const firstResult = JSON.parse(first.stdout());
  assert.equal(firstResult.dispatch_counts.reader, 2);
  assert.equal(firstResult.dispatch_counts.evaluator, 0);
  assert.equal(firstResult.counts.succeeded, 1);
  assert.equal(firstResult.counts.failed, 1);
  assert.equal(firstResult.counts.dependency_blocked, 1);
  assert.equal(firstResult.counts.pending, 1);
  const states = readUnitStates(fixture.runPath, readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id }).plan);
  assert.equal(states.filter((state) => state.logical_unit_key.kind === "reader" && state.attempt_summaries.length === 1).length, 2);
  assert.equal(listFiles(join(fixture.runPath, "attempts")).filter((path) => path.endsWith("attempt.json")).length, 2);
  assert.equal(listFiles(join(fixture.runPath, "revisions", "1", "prepared"))
    .filter((path) => path.includes("evaluator-")).length > 0, true);

  const second = captureIo();
  let preflightCalls = 0;
  assert.equal(await main(["run", "--run", fixture.plan.run_id], {
    ...second.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => { preflightCalls += 1; },
    executeUnit,
  }), 1);
  const secondResult = JSON.parse(second.stdout());
  assert.equal(preflightCalls, 0);
  assert.deepEqual(secondResult.dispatched_unit_ids, []);
  assert.equal(secondResult.reused_unit_ids.length, 1);

  const succeeded = readUnitStates(fixture.runPath, readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id }).plan)
    .find((state) => state.status === "succeeded");
  const recordPath = join(fixture.runPath, ...succeeded.accepted_attempt.attempt_record_path.split("/"));
  const record = JSON.parse(readFileSync(recordPath, "utf8"));
  record.unit_id = fixture.plan.reader_units.find((unit) => unit.unit_id !== succeeded.unit_id).unit_id;
  writeCanonical(recordPath, record);
  succeeded.accepted_attempt.attempt_record_sha256 = sha256Bytes(readFileSync(recordPath));
  writeCanonical(join(fixture.runPath, "units", `${succeeded.unit_id}.json`), succeeded);
  const before = listFiles(fixture.runPath).map((path) => [path, readFileSync(join(fixture.runPath, ...path.split("/")))]);
  const rejected = captureIo();
  assert.equal(await main(["run", "--run", fixture.plan.run_id], {
    ...rejected.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => { throw new Error("must not preflight"); },
    executeUnit,
  }), 3);
  assert.deepEqual(
    listFiles(fixture.runPath).map((path) => [path, readFileSync(join(fixture.runPath, ...path.split("/")))]),
    before,
  );
});

test("restart reconciles a persisted intent from worker result or records outcome_unknown without redispatch", async () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));

  const completed = publishStage2Run(workspace, `run-${"4".repeat(32)}`);
  const completedStore = upgradeCliRunToV2({ runRoot: completed.runRoot, runId: completed.plan.run_id });
  const completedState = activeAttemptState(readUnitStates(completed.runPath, completedStore.plan)
    .find((state) => state.logical_unit_key.kind === "reader"));
  writeCliUnitState({ runPath: completed.runPath, plan: completedStore.plan, state: completedState });
  await durableFakeWorker()({
    prepared_unit: preparedReaderFixture(completed.runPath, completedStore.plan.reader_units[0]),
    attempt_id: completedState.active_attempt.attempt_id,
    attempt_ordinal: 1,
    output_path: join(completed.runPath, "attempts", completedState.unit_id, "1", "output"),
  });
  const completedIo = captureIo();
  const completedCode = await main(["run", "--run", completed.plan.run_id], {
    ...completedIo.dependencies,
    runRoot: completed.runRoot,
    preflight: async () => { throw new Error("must not preflight"); },
  });
  assert.equal(completedCode, 0, completedIo.stdout());
  const recovered = readUnitStates(completed.runPath, completedStore.plan)
    .find((state) => state.logical_unit_key.kind === "reader");
  assert.equal(recovered.status, "succeeded");
  assert.equal(recovered.attempt_summaries[0].result_origin, "worker_result");
  assert.deepEqual(JSON.parse(completedIo.stdout()).dispatched_unit_ids, []);

  const recorded = publishStage2Run(workspace, `run-${"1".repeat(32)}`);
  const recordedStore = upgradeCliRunToV2({ runRoot: recorded.runRoot, runId: recorded.plan.run_id });
  const recordedState = activeAttemptState(readUnitStates(recorded.runPath, recordedStore.plan)
    .find((state) => state.logical_unit_key.kind === "reader"));
  writeCliUnitState({ runPath: recorded.runPath, plan: recordedStore.plan, state: recordedState });
  const recordedRequest = {
    prepared_unit: preparedReaderFixture(recorded.runPath, recordedStore.plan.reader_units[0]),
    attempt_id: recordedState.active_attempt.attempt_id,
    attempt_ordinal: 1,
    output_path: join(recorded.runPath, "attempts", recordedState.unit_id, "1", "output"),
  };
  const recordedResult = await durableFakeWorker()(recordedRequest);
  const recordedResultBytes = readFileSync(join(recorded.runPath, ...recordedState.active_attempt.execution_result_path.split("/")));
  publishCliAttemptRecord({
    runPath: recorded.runPath,
    record: {
      schema_version: 1,
      artifact_type: "cli_attempt_record",
      run_id: recorded.plan.run_id,
      unit_id: recordedState.unit_id,
      attempt_id: recordedState.active_attempt.attempt_id,
      attempt_ordinal: 1,
      producer_revision: 1,
      terminal_status: "succeeded",
      result_origin: "worker_result",
      execution_result_path: recordedState.active_attempt.execution_result_path,
      execution_result_sha256: sha256Bytes(recordedResultBytes),
      structured_output_path: `attempts/${recordedState.unit_id}/1/output/observation.json`,
      structured_output_sha256: recordedResult.structured_output_sha256,
      recovery_reason: null,
    },
  });
  const recordedIo = captureIo();
  assert.equal(await main(["run", "--run", recorded.plan.run_id], {
    ...recordedIo.dependencies,
    runRoot: recorded.runRoot,
    preflight: async () => { throw new Error("must not preflight"); },
  }), 0);
  const replayed = readUnitStates(recorded.runPath, recordedStore.plan)
    .find((state) => state.logical_unit_key.kind === "reader");
  assert.equal(replayed.status, "succeeded");
  assert.equal(replayed.attempt_summaries.length, 1);

  const missing = publishStage2Run(workspace, `run-${"3".repeat(32)}`);
  const missingStore = upgradeCliRunToV2({ runRoot: missing.runRoot, runId: missing.plan.run_id });
  const missingState = activeAttemptState(readUnitStates(missing.runPath, missingStore.plan)
    .find((state) => state.logical_unit_key.kind === "reader"));
  writeCliUnitState({ runPath: missing.runPath, plan: missingStore.plan, state: missingState });
  const missingIo = captureIo();
  assert.equal(await main(["run", "--run", missing.plan.run_id], {
    ...missingIo.dependencies,
    runRoot: missing.runRoot,
    preflight: async () => { throw new Error("must not preflight"); },
  }), 1);
  const unknown = readUnitStates(missing.runPath, missingStore.plan)
    .find((state) => state.logical_unit_key.kind === "reader");
  assert.equal(unknown.status, "outcome_unknown");
  assert.equal(unknown.attempt_summaries[0].result_origin, "recovered_missing_result");
  assert.equal(JSON.parse(missingIo.stdout()).run_status_reason, "outcome_unknown");
});

test("restart blocks a result whose persisted unit-attempt relationship was substituted", async () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const fixture = publishStage2Run(workspace, `run-${"2".repeat(32)}`);
  const store = upgradeCliRunToV2({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  const state = activeAttemptState(readUnitStates(fixture.runPath, store.plan)
    .find((item) => item.logical_unit_key.kind === "reader"));
  writeCliUnitState({ runPath: fixture.runPath, plan: store.plan, state });
  const resultPath = join(fixture.runPath, ...state.active_attempt.execution_result_path.split("/"));
  writeCanonical(resultPath, {
    schema_version: 1,
    unit_id: `reader-${"f".repeat(64)}`,
    attempt_id: state.active_attempt.attempt_id,
    terminal_status: "failed",
    exit_code: 1,
    structured_output_path: null,
    structured_output_sha256: null,
    process_metadata: {},
    failure: { code: "terminal_process_failure", message: "Substituted unit." },
  });
  const io = captureIo();
  assert.equal(await main(["run", "--run", fixture.plan.run_id], {
    ...io.dependencies,
    runRoot: fixture.runRoot,
  }), 3);
  const blocked = readUnitStates(fixture.runPath, store.plan)
    .find((item) => item.logical_unit_key.kind === "reader");
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.block_reason, "integrity_failure");
  assert.equal(blocked.active_attempt.attempt_id, state.active_attempt.attempt_id);
  assert.deepEqual(JSON.parse(io.stdout()).dispatch_counts, { reader: 0, evaluator: 0, total: 0 });
});

test("a late worker result after recovery-only settlement integrity-blocks the exact unit", async () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const fixture = publishStage2Run(workspace, `run-${"0".repeat(32)}`);
  const store = upgradeCliRunToV2({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  const active = activeAttemptState(readUnitStates(fixture.runPath, store.plan)
    .find((state) => state.logical_unit_key.kind === "reader"));
  writeCliUnitState({ runPath: fixture.runPath, plan: store.plan, state: active });
  const unknown = reconcileActiveCliAttempt({ runPath: fixture.runPath, plan: store.plan, state: active });
  assert.equal(unknown.status, "outcome_unknown");
  writeCanonical(join(fixture.runPath, ...active.active_attempt.execution_result_path.split("/")), {
    schema_version: 1,
    unit_id: active.unit_id,
    attempt_id: active.active_attempt.attempt_id,
    terminal_status: "failed",
    exit_code: 1,
    structured_output_path: null,
    structured_output_sha256: null,
    process_metadata: {},
    failure: { code: "terminal_process_failure", message: "Late terminal result." },
  });
  const io = captureIo();
  assert.equal(await main(["run", "--run", fixture.plan.run_id], {
    ...io.dependencies,
    runRoot: fixture.runRoot,
  }), 3);
  const blocked = readUnitStates(fixture.runPath, store.plan)
    .find((state) => state.logical_unit_key.kind === "reader");
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.block_reason, "integrity_failure");
  assert.equal(blocked.attempt_summaries[0].result_origin, "recovered_missing_result");
  assert.deepEqual(JSON.parse(io.stdout()).dispatch_counts, { reader: 0, evaluator: 0, total: 0 });
});

test("resume preserves failed and unknown attempts while explicit retry alone allocates the next ordinal", async () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const fixture = publishStage2Run(workspace, `run-${"a".repeat(32)}`);
  const failedWorker = durableFakeWorker({ failedCaseId: "case-one" });
  const first = captureIo();
  assert.equal(await main(["run", "--run", fixture.plan.run_id], {
    ...first.dependencies, runRoot: fixture.runRoot, preflight: async () => "fake", executeUnit: failedWorker,
  }), 1);
  const failed = readUnitStates(fixture.runPath, readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id }).plan)
    .find((state) => state.logical_unit_key.kind === "reader");
  assert.equal(failed.status, "failed");
  assert.equal(failed.attempt_summaries.length, 1);

  const resumed = captureIo();
  assert.equal(await main(["resume", "--run", fixture.plan.run_id], {
    ...resumed.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => { throw new Error("must not preflight"); },
    executeUnit: async () => { throw new Error("must not dispatch"); },
  }), 1);
  assert.deepEqual(JSON.parse(resumed.stdout()).dispatched_unit_ids, []);

  const retried = captureIo();
  assert.equal(await main(["retry", "--run", fixture.plan.run_id, "--unit", failed.unit_id], {
    ...retried.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => "fake",
    executeUnit: durableFakeWorker(),
  }), 0);
  const retryResult = JSON.parse(retried.stdout());
  assert.deepEqual(retryResult.requested_unit_ids, [failed.unit_id]);
  assert.deepEqual(retryResult.dispatched_unit_ids, [failed.unit_id]);
  assert.equal(retryResult.affected_unit_ids.includes(failed.unit_id), true);
  assert.equal(retryResult.affected_unit_ids.some((unitId) => unitId.startsWith("evaluator-")), true);
  assert.equal(retryResult.dispatch_counts.reader, 1);
  assert.equal(retryResult.run_status_reason, "evaluator_dispatch_disabled");
  const succeeded = readUnitStates(fixture.runPath, readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id }).plan)
    .find((state) => state.unit_id === failed.unit_id);
  assert.equal(succeeded.status, "succeeded");
  assert.deepEqual(succeeded.attempt_summaries.map((summary) => summary.attempt_ordinal), [1, 2]);
  const exactResume = captureIo();
  assert.equal(await main(["resume", "--run", fixture.plan.run_id], {
    ...exactResume.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => { throw new Error("must not preflight"); },
    executeUnit: async () => { throw new Error("must not dispatch"); },
  }), 0);
  assert.deepEqual(JSON.parse(exactResume.stdout()).dispatched_unit_ids, []);

  const unknownFixture = publishStage2Run(workspace, `run-${"d".repeat(32)}`);
  const unknownStore = upgradeCliRunToV2({ runRoot: unknownFixture.runRoot, runId: unknownFixture.plan.run_id });
  const unknownActive = activeAttemptState(readUnitStates(unknownFixture.runPath, unknownStore.plan)
    .find((state) => state.logical_unit_key.kind === "reader"));
  writeCliUnitState({ runPath: unknownFixture.runPath, plan: unknownStore.plan, state: unknownActive });
  reconcileActiveCliAttempt({ runPath: unknownFixture.runPath, plan: unknownStore.plan, state: unknownActive });
  const unknownResume = captureIo();
  assert.equal(await main(["resume", "--run", unknownFixture.plan.run_id], {
    ...unknownResume.dependencies,
    runRoot: unknownFixture.runRoot,
    preflight: async () => { throw new Error("must not preflight"); },
    executeUnit: async () => { throw new Error("must not dispatch"); },
  }), 1);
  assert.deepEqual(JSON.parse(unknownResume.stdout()).dispatched_unit_ids, []);

  const before = listFiles(fixture.runPath).map((path) => [path, readFileSync(join(fixture.runPath, ...path.split("/")))]);
  const rejected = captureIo();
  assert.equal(await main(["retry", "--run", fixture.plan.run_id, "--unit", failed.unit_id], {
    ...rejected.dependencies, runRoot: fixture.runRoot,
  }), 3);
  assert.deepEqual(listFiles(fixture.runPath).map((path) => [path, readFileSync(join(fixture.runPath, ...path.split("/")))]), before);
  assert.deepEqual(JSON.parse(rejected.stdout()).dispatch_counts, { reader: 0, evaluator: 0, total: 0 });
});

test("retry validates duplicate and exhausted selections atomically before mutation", async () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const fixture = publishStage2Run(workspace, `run-${"b".repeat(32)}`);
  const worker = durableFakeWorker({ failedCaseId: "case-one" });
  const first = captureIo();
  assert.equal(await main(["run", "--run", fixture.plan.run_id], {
    ...first.dependencies, runRoot: fixture.runRoot, preflight: async () => "fake", executeUnit: worker,
  }), 1);
  let state = readUnitStates(fixture.runPath, readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id }).plan)
    .find((item) => item.logical_unit_key.kind === "reader");
  const duplicateBefore = listFiles(fixture.runPath).map((path) => [path, readFileSync(join(fixture.runPath, ...path.split("/")))]);
  const duplicate = captureIo();
  assert.equal(await main([
    "retry", "--run", fixture.plan.run_id, "--unit", state.unit_id, "--unit", state.unit_id,
  ], { ...duplicate.dependencies, runRoot: fixture.runRoot }), 3);
  assert.deepEqual(listFiles(fixture.runPath).map((path) => [path, readFileSync(join(fixture.runPath, ...path.split("/")))]), duplicateBefore);

  const second = captureIo();
  assert.equal(await main(["retry", "--run", fixture.plan.run_id, "--unit", state.unit_id], {
    ...second.dependencies, runRoot: fixture.runRoot, preflight: async () => "fake", executeUnit: worker,
  }), 1);
  state = readUnitStates(fixture.runPath, readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id }).plan)
    .find((item) => item.unit_id === state.unit_id);
  assert.equal(state.attempt_summaries.length, 2);
  const exhaustedBefore = listFiles(fixture.runPath).map((path) => [path, readFileSync(join(fixture.runPath, ...path.split("/")))]);
  const exhausted = captureIo();
  assert.equal(await main(["retry", "--run", fixture.plan.run_id, "--unit", state.unit_id], {
    ...exhausted.dependencies, runRoot: fixture.runRoot,
  }), 3);
  assert.deepEqual(listFiles(fixture.runPath).map((path) => [path, readFileSync(join(fixture.runPath, ...path.split("/")))]), exhaustedBefore);
  assert.deepEqual(JSON.parse(exhausted.stdout()).dispatch_counts, { reader: 0, evaluator: 0, total: 0 });
});

test("multi-unit retry rejects one ineligible semantic member without applying the valid subset", async () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({
    mapping: { A: "candidate" },
    cases: [caseFixture("case-one", "success"), caseFixture("case-two", "success")],
  }));
  const fixture = publishStage2Run(workspace, `run-${"6".repeat(32)}`);
  const first = captureIo();
  assert.equal(await main(["run", "--run", fixture.plan.run_id], {
    ...first.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => "fake",
    executeUnit: durableFakeWorker({ failedCaseId: "case-one" }),
  }), 1);
  const states = readUnitStates(fixture.runPath, readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id }).plan)
    .filter((state) => state.logical_unit_key.kind === "reader");
  const failed = states.find((state) => state.status === "failed");
  const succeeded = states.find((state) => state.status === "succeeded");
  const before = listFiles(fixture.runPath).map((path) => [path, readFileSync(join(fixture.runPath, ...path.split("/")))]);
  const retry = captureIo();
  assert.equal(await main([
    "retry", "--run", fixture.plan.run_id, "--unit", failed.unit_id, "--unit", succeeded.unit_id,
  ], {
    ...retry.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => { throw new Error("must not preflight"); },
    executeUnit: async () => { throw new Error("must not dispatch"); },
  }), 3);
  assert.deepEqual(listFiles(fixture.runPath).map((path) => [path, readFileSync(join(fixture.runPath, ...path.split("/")))]), before);
  assert.deepEqual(JSON.parse(retry.stdout()).dispatch_counts, { reader: 0, evaluator: 0, total: 0 });
});

test("operational preflight latch persists at zero dispatch and clears only after a passing preflight", async () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const fixture = publishStage2Run(workspace, `run-${"c".repeat(32)}`);
  const failed = captureIo();
  assert.equal(await main(["run", "--run", fixture.plan.run_id], {
    ...failed.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => { throw new ArtifactError("CLI_PREFLIGHT_FAILED", "Fixture preflight failure.", 3); },
  }), 3);
  const failedResult = JSON.parse(failed.stdout());
  assert.deepEqual(failedResult.dispatch_counts, { reader: 0, evaluator: 0, total: 0 });
  let store = readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  assert.equal(store.run.status, "paused");
  assert.equal(store.run.status_reason, "operational_condition");
  assert.equal(readUnitStates(store.runPath, store.plan).some((state) => state.active_attempt !== null), false);

  const status = captureIo();
  assert.equal(await main(["status", "--run", fixture.plan.run_id], { ...status.dependencies, runRoot: fixture.runRoot }), 0);
  assert.equal(JSON.parse(status.stdout()).run_status_reason, "operational_condition");
  store = readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  assert.equal(store.run.status_reason, "operational_condition");

  const nextWorkspaceId = createWorkspace({ mapping: { A: "candidate" } });
  const prepared = captureIo();
  assert.equal(await main([
    "prepare", "--skill", "example-skill", "--isolation", "synthetic",
    "--candidate-current-tree", "--no-baseline", "--run", fixture.plan.run_id,
  ], {
    ...prepared.dependencies,
    runRoot: fixture.runRoot,
    prepareWorkspace: () => ({ workspace_id: nextWorkspaceId }),
    loadAllWorkspace: loadAllSelectedWorkspace,
  }), 0);
  store = readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  assert.equal(store.run.current_revision, 2);
  assert.equal(store.run.status_reason, "operational_condition");
  assert.equal(store.run.mode, "exact_current");

  const passed = captureIo();
  assert.equal(await main(["resume", "--run", fixture.plan.run_id], {
    ...passed.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => "fake",
    executeUnit: durableFakeWorker(),
  }), 0);
  const passedResult = JSON.parse(passed.stdout());
  assert.equal(passedResult.dispatch_counts.reader, 1);
  assert.equal(passedResult.run_status_reason, "evaluator_dispatch_disabled");
});

test("retry projects an unpublished next revision without mutation before rejecting the full selection", async () => {
  const firstWorkspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const secondWorkspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const fixture = publishStage2Run(firstWorkspace, `run-${"8".repeat(32)}`);
  const upgraded = upgradeCliRunToV2({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  const revision = compileRevisionCliPlan({
    workspace: secondWorkspace,
    runId: fixture.plan.run_id,
    revision: 2,
    processSettings: upgraded.run.process_settings,
  });
  assert.throws(() => publishNextCliRevision({
    runRoot: fixture.runRoot,
    runId: fixture.plan.run_id,
    ...revision,
    beforeMarkerReplace: () => { throw new Error("injected revision crash"); },
  }), /injected revision crash/);
  const before = listFiles(fixture.runPath).map((path) => [path, readFileSync(join(fixture.runPath, ...path.split("/")))]);
  const retry = captureIo();
  assert.equal(await main([
    "retry", "--run", fixture.plan.run_id, "--unit", revision.plan.reader_units[0].unit_id,
  ], { ...retry.dependencies, runRoot: fixture.runRoot }), 3);
  assert.deepEqual(listFiles(fixture.runPath).map((path) => [path, readFileSync(join(fixture.runPath, ...path.split("/")))]), before);
  assert.equal(readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id }).run.current_revision, 1);

  const resume = captureIo();
  assert.equal(await main(["resume", "--run", fixture.plan.run_id], {
    ...resume.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => "fake",
    executeUnit: durableFakeWorker(),
  }), 0);
  assert.equal(JSON.parse(resume.stdout()).revision, 2);
});

test("retry projects a stale running attempt's exact failed result before allocating its next ordinal", async () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const fixture = publishStage2Run(workspace, `run-${"7".repeat(32)}`);
  const store = upgradeCliRunToV2({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  const active = activeAttemptState(readUnitStates(fixture.runPath, store.plan)
    .find((state) => state.logical_unit_key.kind === "reader"));
  writeCliUnitState({ runPath: fixture.runPath, plan: store.plan, state: active });
  await durableFakeWorker({ failedCaseId: "case-one" })({
    prepared_unit: preparedReaderFixture(fixture.runPath, store.plan.reader_units[0]),
    attempt_id: active.active_attempt.attempt_id,
    attempt_ordinal: 1,
    output_path: join(fixture.runPath, "attempts", active.unit_id, "1", "output"),
  });
  const io = captureIo();
  assert.equal(await main(["retry", "--run", fixture.plan.run_id, "--unit", active.unit_id], {
    ...io.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => "fake",
    executeUnit: durableFakeWorker(),
  }), 0);
  const state = readUnitStates(fixture.runPath, store.plan).find((item) => item.unit_id === active.unit_id);
  assert.equal(state.status, "succeeded");
  assert.deepEqual(state.attempt_summaries.map((summary) => [summary.attempt_ordinal, summary.terminal_status]), [
    [1, "failed"], [2, "succeeded"],
  ]);
  assert.deepEqual(JSON.parse(io.stdout()).dispatched_unit_ids, [active.unit_id]);
});

test("patch-check reruns one case-local reader closure, preserves untouched history, and latches mixed mode", async () => {
  const firstId = createWorkspace({
    mapping: { A: "candidate" },
    cases: [caseFixture("case-one", "success"), caseFixture("case-two", "success")],
  });
  const firstWorkspace = loadAllSelectedWorkspace(firstId);
  const fixture = publishStage2Run(firstWorkspace, `run-${"5".repeat(32)}`);
  const first = captureIo();
  assert.equal(await main(["run", "--run", fixture.plan.run_id], {
    ...first.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => "fake",
    executeUnit: durableFakeWorker(),
  }), 0);
  const secondId = createWorkspace({
    mapping: { A: "candidate" },
    cases: [caseFixture("case-one", "changed"), caseFixture("case-two", "success")],
  });
  const prepare = captureIo();
  assert.equal(await main([
    "prepare", "--skill", "example-skill", "--isolation", "synthetic",
    "--candidate-current-tree", "--no-baseline", "--run", fixture.plan.run_id,
  ], {
    ...prepare.dependencies,
    runRoot: fixture.runRoot,
    prepareWorkspace: () => ({ workspace_id: secondId }),
    loadAllWorkspace: loadAllSelectedWorkspace,
  }), 0);
  let store = readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  const changed = store.plan.reader_units.find((unit) => unit.logical_unit_key.case_id === "case-one");
  const untouched = store.plan.reader_units.find((unit) => unit.logical_unit_key.case_id === "case-two");
  const beforeInvalid = listFiles(fixture.runPath).map((path) => [path, readFileSync(join(fixture.runPath, ...path.split("/")))]);
  const invalid = captureIo();
  assert.equal(await main([
    "patch-check", "--run", fixture.plan.run_id,
    "--unit", changed.unit_id, "--unit", untouched.unit_id,
  ], { ...invalid.dependencies, runRoot: fixture.runRoot }), 3);
  assert.deepEqual(listFiles(fixture.runPath).map((path) => [path, readFileSync(join(fixture.runPath, ...path.split("/")))]), beforeInvalid);

  const patch = captureIo();
  assert.equal(await main(["patch-check", "--run", fixture.plan.run_id, "--unit", changed.unit_id], {
    ...patch.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => "fake",
    executeUnit: durableFakeWorker(),
  }), 0);
  const result = JSON.parse(patch.stdout());
  const evaluator = store.plan.evaluator_units.find((unit) => unit.logical_unit_key.case_id === "case-one");
  assert.equal(result.mode, "patch_check_mixed_revision");
  assert.deepEqual(result.requested_unit_ids, [changed.unit_id]);
  assert.deepEqual(result.affected_unit_ids, [changed.unit_id, evaluator.unit_id].sort());
  assert.deepEqual(result.dispatched_unit_ids, [changed.unit_id]);
  store = readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  assert.equal(store.run.mode, "patch_check_mixed_revision");
  const states = readUnitStates(store.runPath, store.plan);
  assert.equal(states.find((state) => state.unit_id === changed.unit_id).attempt_summaries.length, 2);
  assert.equal(states.find((state) => state.unit_id === untouched.unit_id).attempt_summaries.length, 1);

  const resume = captureIo();
  assert.equal(await main(["resume", "--run", fixture.plan.run_id], {
    ...resume.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => { throw new Error("must not preflight"); },
    executeUnit: async () => { throw new Error("must not dispatch"); },
  }), 0);
  assert.equal(JSON.parse(resume.stdout()).mode, "patch_check_mixed_revision");
  for (const command of ["status", "run"]) {
    const sameRevision = captureIo();
    assert.equal(await main([command, "--run", fixture.plan.run_id], {
      ...sameRevision.dependencies,
      runRoot: fixture.runRoot,
      preflight: async () => { throw new Error("must not preflight"); },
      executeUnit: async () => { throw new Error("must not dispatch"); },
    }), 0);
    assert.equal(JSON.parse(sameRevision.stdout()).mode, "patch_check_mixed_revision");
  }

  const thirdId = createWorkspace({
    mapping: { A: "candidate" },
    cases: [caseFixture("case-one", "changed-again"), caseFixture("case-two", "success")],
  });
  const next = captureIo();
  assert.equal(await main([
    "prepare", "--skill", "example-skill", "--isolation", "synthetic",
    "--candidate-current-tree", "--no-baseline", "--run", fixture.plan.run_id,
  ], {
    ...next.dependencies,
    runRoot: fixture.runRoot,
    prepareWorkspace: () => ({ workspace_id: thirdId }),
    loadAllWorkspace: loadAllSelectedWorkspace,
  }), 0);
  store = readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  assert.equal(store.run.mode, "exact_current");
  const beforeBudget = listFiles(fixture.runPath).map((path) => [path, readFileSync(join(fixture.runPath, ...path.split("/")))]);
  const exhausted = captureIo();
  assert.equal(await main(["patch-check", "--run", fixture.plan.run_id, "--unit", changed.unit_id], {
    ...exhausted.dependencies,
    runRoot: fixture.runRoot,
  }), 3);
  assert.equal(JSON.parse(exhausted.stdout()).code, "CLI_ATTEMPT_BUDGET_EXHAUSTED");
  assert.deepEqual(listFiles(fixture.runPath).map((path) => [path, readFileSync(join(fixture.runPath, ...path.split("/")))]), beforeBudget);
});

test("evaluator-only patch-check recompiles its package without rerunning an exact reader", async () => {
  const firstId = createWorkspace({ mapping: { A: "candidate" } });
  const fixture = publishStage2Run(loadAllSelectedWorkspace(firstId), `run-${"4".repeat(32)}`);
  const first = captureIo();
  assert.equal(await main(["run", "--run", fixture.plan.run_id], {
    ...first.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => "fake",
    executeUnit: durableFakeWorker(),
  }), 0);
  const secondId = createWorkspace({
    mapping: { A: "candidate" },
    criterionDescription: "Changed evaluator-only criterion.",
  });
  const prepare = captureIo();
  assert.equal(await main([
    "prepare", "--skill", "example-skill", "--isolation", "synthetic",
    "--candidate-current-tree", "--no-baseline", "--run", fixture.plan.run_id,
  ], {
    ...prepare.dependencies,
    runRoot: fixture.runRoot,
    prepareWorkspace: () => ({ workspace_id: secondId }),
    loadAllWorkspace: loadAllSelectedWorkspace,
  }), 0);
  const store = readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  const evaluatorId = store.plan.evaluator_units[0].unit_id;
  const patch = captureIo();
  assert.equal(await main(["patch-check", "--run", fixture.plan.run_id, "--unit", evaluatorId], {
    ...patch.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => { throw new Error("no reader preflight expected"); },
    executeUnit: async () => { throw new Error("no reader dispatch expected"); },
  }), 0);
  const result = JSON.parse(patch.stdout());
  assert.deepEqual(result.affected_unit_ids, [evaluatorId]);
  assert.deepEqual(result.invalidated_unit_ids, [evaluatorId]);
  assert.deepEqual(result.dispatched_unit_ids, []);
  assert.equal(result.dispatch_counts.evaluator, 0);
  const states = readUnitStates(store.runPath, store.plan);
  assert.equal(states.find((state) => state.logical_unit_key.kind === "reader").attempt_summaries.length, 1);
  assert.notEqual(states.find((state) => state.unit_id === evaluatorId).current_behavior_fingerprint, null);
});

test("shared model-visible skill change invalidates every explicitly covered reader and downstream evaluator", async () => {
  const cases = [caseFixture("case-one", "success"), caseFixture("case-two", "success")];
  const firstId = createWorkspace({ mapping: { A: "candidate" }, cases });
  const fixture = publishStage2Run(loadAllSelectedWorkspace(firstId), `run-${"3".repeat(32)}`);
  const first = captureIo();
  assert.equal(await main(["run", "--run", fixture.plan.run_id], {
    ...first.dependencies, runRoot: fixture.runRoot, preflight: async () => "fake", executeUnit: durableFakeWorker(),
  }), 0);
  const secondId = createWorkspace({
    mapping: { A: "candidate" },
    cases,
    skillContent: "---\nname: example-skill\ndescription: Changed fixture skill.\n---\n\n# Changed shared behavior\n",
  });
  const prepare = captureIo();
  assert.equal(await main([
    "prepare", "--skill", "example-skill", "--isolation", "synthetic",
    "--candidate-current-tree", "--no-baseline", "--run", fixture.plan.run_id,
  ], {
    ...prepare.dependencies,
    runRoot: fixture.runRoot,
    prepareWorkspace: () => ({ workspace_id: secondId }),
    loadAllWorkspace: loadAllSelectedWorkspace,
  }), 0);
  const store = readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  const readerIds = store.plan.reader_units.map((unit) => unit.unit_id).sort();
  const args = ["patch-check", "--run", fixture.plan.run_id];
  readerIds.forEach((unitId) => args.push("--unit", unitId));
  const patch = captureIo();
  assert.equal(await main(args, {
    ...patch.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => "fake",
    executeUnit: durableFakeWorker(),
  }), 0);
  const result = JSON.parse(patch.stdout());
  const affectedIds = [
    ...readerIds, ...store.plan.evaluator_units.map((unit) => unit.unit_id),
  ].sort();
  assert.deepEqual(result.invalidated_unit_ids, affectedIds);
  assert.deepEqual(result.dispatched_unit_ids, readerIds);
  assert.deepEqual(result.affected_unit_ids, affectedIds);
});

test("patch-check cannot act as retry or recovery for failed, unknown, running, or integrity-blocked readers", async () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  for (const status of ["failed", "outcome_unknown", "running", "blocked"]) {
    const fixture = publishStage2Run(workspace, `run-${sha256Bytes(Buffer.from(`patch-${status}`)).slice(0, 32)}`);
    const store = upgradeCliRunToV2({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
    let state = readUnitStates(fixture.runPath, store.plan)
      .find((item) => item.logical_unit_key.kind === "reader");
    if (status === "failed") {
      const run = captureIo();
      assert.equal(await main(["run", "--run", fixture.plan.run_id], {
        ...run.dependencies,
        runRoot: fixture.runRoot,
        preflight: async () => "fake",
        executeUnit: durableFakeWorker({ failedCaseId: "case-one" }),
      }), 1);
      state = readUnitStates(fixture.runPath, store.plan).find((item) => item.unit_id === state.unit_id);
    } else {
      const active = activeAttemptState(state);
      writeCliUnitState({ runPath: fixture.runPath, plan: store.plan, state: active });
      if (status === "outcome_unknown") {
        state = reconcileActiveCliAttempt({ runPath: fixture.runPath, plan: store.plan, state: active });
      } else if (status === "blocked") {
        state = { ...active, status: "blocked", block_reason: "integrity_failure" };
        writeCliUnitState({ runPath: fixture.runPath, plan: store.plan, state });
      } else {
        state = active;
      }
    }
    const before = listFiles(fixture.runPath).map((path) => [path, readFileSync(join(fixture.runPath, ...path.split("/")))]);
    const patch = captureIo();
    assert.equal(await main(["patch-check", "--run", fixture.plan.run_id, "--unit", state.unit_id], {
      ...patch.dependencies,
      runRoot: fixture.runRoot,
      preflight: async () => { throw new Error("must not preflight"); },
      executeUnit: async () => { throw new Error("must not dispatch"); },
    }), 3, status);
    assert.deepEqual(
      listFiles(fixture.runPath).map((path) => [path, readFileSync(join(fixture.runPath, ...path.split("/")))]),
      before,
      status,
    );
    assert.deepEqual(JSON.parse(patch.stdout()).dispatch_counts, { reader: 0, evaluator: 0, total: 0 });
  }
});

test("valid patch selection persists only an unrelated in-flight integrity contradiction before mixed mode", async () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({
    mapping: { A: "candidate" },
    cases: [caseFixture("case-one", "success"), caseFixture("case-two", "success")],
  }));
  const fixture = publishStage2Run(workspace, `run-${"2".repeat(32)}`);
  const store = upgradeCliRunToV2({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  const states = readUnitStates(fixture.runPath, store.plan).filter((state) => state.logical_unit_key.kind === "reader");
  const selected = states.find((state) => state.logical_unit_key.case_id === "case-one");
  const unrelated = activeAttemptState(states.find((state) => state.logical_unit_key.case_id === "case-two"));
  writeCliUnitState({ runPath: fixture.runPath, plan: store.plan, state: unrelated });
  writeCanonical(join(fixture.runPath, ...unrelated.active_attempt.execution_result_path.split("/")), {
    schema_version: 1,
    unit_id: selected.unit_id,
    attempt_id: unrelated.active_attempt.attempt_id,
    terminal_status: "failed",
    exit_code: 1,
    structured_output_path: null,
    structured_output_sha256: null,
    process_metadata: {},
    failure: { code: "terminal_process_failure", message: "Cross-unit substitution." },
  });
  const selectedBefore = readFileSync(join(fixture.runPath, "units", `${selected.unit_id}.json`));
  const markerBefore = readFileSync(join(fixture.runPath, "run.json"));
  const patch = captureIo();
  assert.equal(await main(["patch-check", "--run", fixture.plan.run_id, "--unit", selected.unit_id], {
    ...patch.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => { throw new Error("must not preflight"); },
  }), 3);
  assert.deepEqual(readFileSync(join(fixture.runPath, "units", `${selected.unit_id}.json`)), selectedBefore);
  assert.deepEqual(readFileSync(join(fixture.runPath, "run.json")), markerBefore);
  const blocked = readUnitStates(fixture.runPath, store.plan).find((state) => state.unit_id === unrelated.unit_id);
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.block_reason, "integrity_failure");
  assert.equal(readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id }).run.mode, "exact_current");
});

test("patch-check preflight failure retains exact mode and its first passing marker clears the latch into mixed mode", async () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const fixture = publishStage2Run(workspace, `run-${"1".repeat(32)}`);
  const readerId = fixture.plan.reader_units[0].unit_id;
  const failed = captureIo();
  assert.equal(await main(["patch-check", "--run", fixture.plan.run_id, "--unit", readerId], {
    ...failed.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => { throw new ArtifactError("CLI_PREFLIGHT_FAILED", "Fixture failure.", 3); },
  }), 3);
  let store = readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  assert.equal(store.run.mode, "exact_current");
  assert.equal(store.run.status_reason, "operational_condition");
  assert.equal(readUnitStates(store.runPath, store.plan).find((state) => state.unit_id === readerId).attempt_summaries.length, 0);

  const passed = captureIo();
  assert.equal(await main(["patch-check", "--run", fixture.plan.run_id, "--unit", readerId], {
    ...passed.dependencies,
    runRoot: fixture.runRoot,
    preflight: async () => "fake",
    executeUnit: durableFakeWorker(),
  }), 0);
  store = readCliRunStore({ runRoot: fixture.runRoot, runId: fixture.plan.run_id });
  assert.equal(store.run.mode, "patch_check_mixed_revision");
  assert.notEqual(store.run.status_reason, "operational_condition");
  assert.equal(JSON.parse(passed.stdout()).mode, "patch_check_mixed_revision");
});

test("Stage 2 prepare publishes run.json last with zero dispatch and exact plan links", async () => {
  const id = createWorkspace({ mapping: { A: "candidate" } });
  const runRoot = mkdtempSync(join(tmpdir(), "vocaspace-cli-run-"));
  roots.push(runRoot);
  const runId = `run-${"a".repeat(32)}`;
  const io = captureIo();
  const code = await main([
    "prepare",
    "--skill", "example-skill",
    "--isolation", "synthetic",
    "--candidate-current-tree",
    "--no-baseline",
    "--max-concurrency", "3",
    "--target-minutes", "2.5",
  ], {
    ...io.dependencies,
    prepareWorkspace: () => ({ workspace_id: id }),
    runRoot,
    runId,
    localProcessCap: 2,
  });
  assert.equal(code, 0);
  const result = JSON.parse(io.stdout());
  assert.deepEqual(result.dispatch_counts, { reader: 0, evaluator: 0, total: 0 });
  assert.equal(result.process_settings.planned_concurrency, 2);
  assert.equal(result.estimate.history_status, "unknown");
  assert.equal(result.estimate.estimated_wall_time_seconds, null);
  const plan = JSON.parse(readFileSync(join(runRoot, runId, result.execution_plan), "utf8"));
  const run = JSON.parse(readFileSync(join(runRoot, runId, result.run_manifest), "utf8"));
  assert.equal(plan.counts.reader_units, 1);
  assert.equal(plan.counts.evaluator_units, 1);
  assert.deepEqual(run.unit_ids, [...plan.reader_units, ...plan.evaluator_units].map((item) => item.unit_id));
  assert.deepEqual(listFiles(join(runRoot, runId)), [
    "revisions/1/execution-plan.json",
    `revisions/1/prepared/${plan.reader_units[0].unit_id}/input/output-schema.json`,
    `revisions/1/prepared/${plan.reader_units[0].unit_id}/input/stdin.txt`,
    "run.json",
  ]);
});

test("Stage 2 usage errors allocate no workspace/run and operational errors keep truthful locators", async () => {
  let prepareCalls = 0;
  const usage = captureIo();
  assert.equal(await main([
    "prepare", "--skill", "example-skill", "--isolation", "synthetic",
    "--candidate-current-tree", "--no-baseline", "--concurrency", "3", "--max-concurrency", "2",
  ], { ...usage.dependencies, prepareWorkspace: () => { prepareCalls += 1; } }), 2);
  assert.equal(prepareCalls, 0);
  assert.equal(usage.stdout(), "");

  const failed = captureIo();
  assert.equal(await main([
    "prepare", "--skill", "example-skill", "--isolation", "synthetic",
    "--candidate-current-tree", "--no-baseline",
  ], {
    ...failed.dependencies,
    prepareWorkspace: () => { throw new Error("fixture failure"); },
  }), 3);
  const error = JSON.parse(failed.stdout());
  assert.equal(error.workspace_id, null);
  assert.equal(error.run_id, null);
  assert.equal(error.revision, null);
  assert.deepEqual(error.dispatch_counts, { reader: 0, evaluator: 0, total: 0 });
});

test("zero-unit complete history keeps aggregate time zero and positive planned concurrency", () => {
  const estimate = compileConcurrencyEstimate({
    unitIds: [],
    evaluatorUnits: [],
    maxConcurrency: 4,
    localProcessCap: 8,
    targetMinutes: 1,
    explicitConcurrency: null,
    history: { duration_seconds: [], observed_rate_limit_cap: 3 },
  });
  assert.equal(estimate.history_status, "complete");
  assert.equal(estimate.total_work_seconds, 0);
  assert.equal(estimate.dependency_critical_path_seconds, 0);
  assert.equal(estimate.concurrency_for_target, 0);
  assert.equal(estimate.recommended_concurrency, 1);
  assert.equal(estimate.planned_concurrency, 1);
  assert.equal(estimate.estimated_wall_time_seconds, 0);
});

test("all-empty Stage 2 scope publishes fixed empty waves without synthesizing work", async () => {
  const id = createWorkspace({ mapping: { A: "candidate" }, cases: [] });
  const runRoot = mkdtempSync(join(tmpdir(), "vocaspace-cli-empty-run-"));
  roots.push(runRoot);
  const runId = `run-${"b".repeat(32)}`;
  const io = captureIo();
  assert.equal(await main([
    "prepare", "--skill", "example-skill", "--isolation", "synthetic",
    "--candidate-current-tree", "--no-baseline",
  ], {
    ...io.dependencies,
    prepareWorkspace: () => ({ workspace_id: id }),
    runRoot,
    runId,
    localProcessCap: 3,
  }), 0);
  const result = JSON.parse(io.stdout());
  assert.deepEqual(result.counts, {
    automatic_retry_calls: 0,
    blocked_on_dependencies: 0,
    evaluator_units: 0,
    expected_calls_without_retry: 0,
    max_attempt_call_ceiling: 0,
    reader_units: 0,
    ready_units: 0,
    total_units: 0,
  });
  assert.deepEqual(result.dependency_waves, [
    { wave: 1, kind: "reader", unit_ids: [], unit_count: 0, scheduling_waves: 0 },
    { wave: 2, kind: "evaluator", unit_ids: [], unit_count: 0, scheduling_waves: 0 },
  ]);
  assert.deepEqual(result.selected_scope.suites.map((item) => item.case_ids), [[], [], []]);
});

test("reader barrier failure leaves no execution plan or run publication marker", () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({
    mapping: { A: "candidate" },
    cases: [caseFixture("case-one", "success"), caseFixture("case-two", "success")],
  }));
  const runId = `run-${"c".repeat(32)}`;
  const { plan, readerDescriptors } = compileStaticCliPlan({
    workspace,
    runId,
    localProcessCap: 2,
  });
  const invalidDescriptor = {
    ...readerDescriptors[1],
    behavior_projection: {
      ...readerDescriptors[1].behavior_projection,
      stdin_sha256: "0".repeat(64),
    },
  };
  const runRoot = mkdtempSync(join(tmpdir(), "vocaspace-cli-barrier-"));
  roots.push(runRoot);
  assert.throws(
    () => publishCliPreparedRun({
      runRoot,
      plan,
      readerDescriptors: [readerDescriptors[0], invalidDescriptor],
    }),
    /hashes or CLI options/,
  );
  assert.equal(existsSync(join(runRoot, runId, "run.json")), false);
  assert.equal(existsSync(join(runRoot, runId, "revisions", "1", "execution-plan.json")), false);
});

test("reader publication rejects missing, reordered, and cross-workspace descriptor sets before artifacts", () => {
  const firstWorkspace = loadAllSelectedWorkspace(createWorkspace({
    mapping: { A: "candidate" },
    cases: [caseFixture("case-one", "success"), caseFixture("case-two", "success")],
  }));
  const donorWorkspace = loadAllSelectedWorkspace(createWorkspace({
    mapping: { A: "candidate" },
    cases: [caseFixture("case-one", "success"), caseFixture("case-two", "success")],
  }));
  const first = compileStaticCliPlan({
    workspace: firstWorkspace,
    runId: `run-${"e".repeat(32)}`,
    localProcessCap: 2,
  });
  const donor = compileStaticCliPlan({
    workspace: donorWorkspace,
    runId: `run-${"f".repeat(32)}`,
    localProcessCap: 2,
  });
  assertCliExecutionPlan(first.plan);
  assertCliExecutionPlan(donor.plan);

  for (const [label, readerDescriptors] of [
    ["missing", []],
    ["reordered", [...first.readerDescriptors].reverse()],
    ["cross-workspace", donor.readerDescriptors],
  ]) {
    const runRoot = mkdtempSync(join(tmpdir(), `vocaspace-cli-${label}-`));
    roots.push(runRoot);
    assert.throws(
      () => publishCliPreparedRun({ runRoot, plan: first.plan, readerDescriptors }),
      /exactly cover|order, content, or lineage/,
      label,
    );
    assert.deepEqual(listFiles(runRoot), [], label);
  }
});

test("execution-plan loader rejects cross-reader locator substitution and unknown fields", () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({
    mapping: { A: "candidate", B: "baseline" },
  }));
  const { plan } = compileStaticCliPlan({
    workspace,
    runId: `run-${"d".repeat(32)}`,
    localProcessCap: 2,
  });
  const substituted = structuredClone(plan);
  substituted.evaluator_units[0].dependencies[0].source_locator = structuredClone(
    substituted.evaluator_units[0].dependencies[1].source_locator,
  );
  assert.throws(() => assertCliExecutionPlan(substituted), /locator does not match/);

  const withUnknown = structuredClone(plan);
  withUnknown.reader_units[0].unexpected = true;
  assert.throws(() => assertCliExecutionPlan(withUnknown), /fields are invalid/);
});

test("execution-plan loader derives reader payload hashes and rejects unknown nested fields", () => {
  const workspace = loadAllSelectedWorkspace(createWorkspace({ mapping: { A: "candidate" } }));
  const { plan } = compileStaticCliPlan({
    workspace,
    runId: `run-${"9".repeat(32)}`,
    localProcessCap: 2,
  });

  const substituted = structuredClone(plan);
  const substitutedReader = substituted.reader_units[0];
  const substitutedInput = JSON.parse(substitutedReader.invocation_content.stdin_utf8);
  substitutedInput.bundle_files[0].content_utf8 += "\nsubstituted";
  substitutedReader.invocation_content.stdin_utf8 = canonicalJson(substitutedInput);
  substitutedReader.behavior_projection.stdin_sha256 = sha256Bytes(
    Buffer.from(substitutedReader.invocation_content.stdin_utf8, "utf8"),
  );
  assert.throws(() => assertCliExecutionPlan(substituted), /content hash is invalid/);

  const withUnknownPayloadField = structuredClone(plan);
  const unknownReader = withUnknownPayloadField.reader_units[0];
  const unknownInput = JSON.parse(unknownReader.invocation_content.stdin_utf8);
  unknownInput.bundle_files[0].unexpected = true;
  unknownReader.invocation_content.stdin_utf8 = canonicalJson(unknownInput);
  unknownReader.behavior_projection.stdin_sha256 = sha256Bytes(
    Buffer.from(unknownReader.invocation_content.stdin_utf8, "utf8"),
  );
  assert.throws(() => assertCliExecutionPlan(withUnknownPayloadField), /fields are invalid/);
});

function acceptedBinding(dependency, staticPlan) {
  const observation = {
    schema_version: 1,
    artifact_type: `${dependency.source_role}_observation`,
    workspace_id: dependency.source_locator.workspace_id,
    skill: staticPlan.logical_unit_key.skill,
    suite: staticPlan.logical_unit_key.suite,
    case_id: staticPlan.logical_unit_key.case_id,
    variant_id: dependency.source_locator.variant_id,
    execution_context_hash: dependency.source_locator.execution_context_hash,
    execution_status: "completed",
    execution_reason: null,
    raw_response: "Deterministic accepted reader output.",
    observed_access: {
      basis: "Deterministic fixture.",
      credentials: "not_observed",
      filesystem: "observed",
      model_runtime: "unknown",
      mutation: "not_observed",
      network: "not_observed",
      process: "not_observed",
      remote: "not_observed",
      tools: "not_observed",
    },
  };
  const bytes = Buffer.from(canonicalJson(observation), "utf8");
  return {
    source_role: dependency.source_role,
    unit_id: dependency.unit_id,
    attempt_id: `${dependency.unit_id}-attempt-1`,
    producer_revision: 1,
    producer_behavior_fingerprint: "a".repeat(64),
    producer_locator: structuredClone(dependency.source_locator),
    terminal_status: "succeeded",
    structured_output_path: `attempts/${dependency.unit_id}/1/output/observation.json`,
    structured_output_sha256: sha256Bytes(bytes),
    observation_bytes: bytes,
  };
}

function durableFakeWorker({ failedCaseId = null } = {}) {
  return async (request) => {
    const prepared = request.prepared_unit;
    const failed = prepared.logical_unit_key.case_id === failedCaseId;
    let outputPath = null;
    let outputHash = null;
    if (!failed) {
      const locator = prepared.source_locator;
      const observation = {
        schema_version: 1,
        artifact_type: `${prepared.logical_unit_key.source_role}_observation`,
        workspace_id: locator.workspace_id,
        skill: prepared.logical_unit_key.skill,
        suite: prepared.logical_unit_key.suite,
        case_id: prepared.logical_unit_key.case_id,
        variant_id: locator.variant_id,
        execution_context_hash: locator.execution_context_hash,
        execution_status: "completed",
        execution_reason: null,
        raw_response: "Deterministic Stage 3 fixture output.",
        observed_access: {
          basis: "Deterministic fixture.",
          credentials: "not_observed",
          filesystem: "observed",
          model_runtime: "unknown",
          mutation: "not_observed",
          network: "not_observed",
          process: "not_observed",
          remote: "not_observed",
          tools: "not_observed",
        },
      };
      outputPath = join(request.output_path, "observation.json");
      writeCanonical(outputPath, observation);
      outputHash = sha256Bytes(readFileSync(outputPath));
    }
    const result = {
      schema_version: 1,
      unit_id: prepared.unit_id,
      attempt_id: request.attempt_id,
      terminal_status: failed ? "failed" : "succeeded",
      exit_code: failed ? 1 : 0,
      structured_output_path: outputPath,
      structured_output_sha256: outputHash,
      process_metadata: {},
      failure: failed ? { code: "terminal_process_failure", message: "Deterministic fixture failure." } : null,
    };
    writeCanonical(join(dirname(request.output_path), "result.json"), result);
    return result;
  };
}

function activeAttemptState(state) {
  const ordinal = state.attempt_summaries.length + 1;
  const prefix = `attempts/${state.unit_id}/${ordinal}`;
  return {
    ...state,
    status: "running",
    active_attempt: {
      attempt_id: `${state.unit_id}-attempt-${ordinal}`,
      attempt_ordinal: ordinal,
      producer_revision: state.current_revision,
      attempt_record_path: `${prefix}/attempt.json`,
      execution_result_path: `${prefix}/result.json`,
      output_directory_path: `${prefix}/output`,
    },
  };
}

function preparedReaderFixture(runPath, unit) {
  return {
    schema_version: 1,
    unit_id: unit.unit_id,
    logical_unit_key: structuredClone(unit.logical_unit_key),
    kind: "reader",
    dependencies: [],
    invocation: {
      stdin_path: join(runPath, ...unit.prepared_input.stdin_path.split("/")),
      output_schema_path: join(runPath, ...unit.prepared_input.output_schema_path.split("/")),
      cwd: join(runPath, ...unit.prepared_input.cwd.split("/")),
      cli_options: structuredClone(unit.invocation_content.cli_options),
    },
    behavior_projection: structuredClone(unit.behavior_projection),
    source_locator: structuredClone(unit.source_locator),
  };
}

function publishStage2Run(workspace, runId) {
  const runRoot = mkdtempSync(join(tmpdir(), "vocaspace-cli-stage2-run-"));
  roots.push(runRoot);
  const compiled = compileStaticCliPlan({ workspace, runId, localProcessCap: 2 });
  const published = publishCliPreparedRun({ runRoot, ...compiled });
  return { runRoot, ...compiled, ...published };
}

function publishAcceptedReaderGraph(compiled, sourceRole = "candidate") {
  const runRoot = mkdtempSync(join(tmpdir(), "vocaspace-cli-accepted-"));
  roots.push(runRoot);
  const descriptor = compiled.readerDescriptors.find((item) =>
    item.logical_unit_key.source_role === sourceRole);
  const unitId = descriptor.unit_id;
  const attemptId = `${unitId}-attempt-1`;
  const outputRelative = `attempts/${unitId}/1/output/accepted-observation.json`;
  const resultRelative = `attempts/${unitId}/1/result.json`;
  const recordRelative = `attempts/${unitId}/1/attempt.json`;
  const dependency = compiled.plan.evaluator_units[0].dependencies.find((item) =>
    item.source_role === sourceRole);
  const binding = acceptedBinding(dependency, compiled.plan.evaluator_units[0]);
  const observationBytes = binding.observation_bytes;
  const outputPath = join(runRoot, ...outputRelative.split("/"));
  writeFile(outputPath, observationBytes);
  const result = {
    schema_version: 1,
    unit_id: unitId,
    attempt_id: attemptId,
    terminal_status: "succeeded",
    exit_code: 0,
    structured_output_path: outputPath,
    structured_output_sha256: sha256Bytes(observationBytes),
    process_metadata: {},
    failure: null,
  };
  writeCanonical(join(runRoot, ...resultRelative.split("/")), result);
  const resultBytes = readFileSync(join(runRoot, ...resultRelative.split("/")));
  const record = {
    schema_version: 1,
    artifact_type: "cli_attempt_record",
    run_id: compiled.plan.run_id,
    unit_id: unitId,
    attempt_id: attemptId,
    attempt_ordinal: 1,
    producer_revision: 1,
    terminal_status: "succeeded",
    result_origin: "worker_result",
    execution_result_path: resultRelative,
    execution_result_sha256: sha256Bytes(resultBytes),
    structured_output_path: outputRelative,
    structured_output_sha256: sha256Bytes(observationBytes),
    recovery_reason: null,
  };
  writeCanonical(join(runRoot, ...recordRelative.split("/")), record);
  const recordBytes = readFileSync(join(runRoot, ...recordRelative.split("/")));
  writeCanonical(join(runRoot, "revisions", "1", "execution-plan.json"), compiled.plan);
  writeCanonical(join(runRoot, "run.json"), {
    schema_version: 1,
    artifact_type: "cli_run",
    run_id: compiled.plan.run_id,
    workspace_id: compiled.plan.workspace_id,
    selected_scope: compiled.plan.selected_scope,
    current_revision: 1,
    status: "prepared",
    unit_ids: [...compiled.plan.reader_units, ...compiled.plan.evaluator_units].map((unit) => unit.unit_id),
    process_settings: compiled.plan.process_settings,
  });
  const unitState = {
    schema_version: 1,
    run_id: compiled.plan.run_id,
    unit_id: unitId,
    logical_unit_key: descriptor.logical_unit_key,
    current_revision: 1,
    current_behavior_fingerprint: sha256Canonical(descriptor.behavior_projection),
    dependency_bindings: [],
    status: "succeeded",
    block_reason: null,
    active_attempt: null,
    accepted_attempt: {
      attempt_id: attemptId,
      attempt_record_path: recordRelative,
      attempt_record_sha256: sha256Bytes(recordBytes),
    },
    attempt_summaries: [{
      attempt_id: attemptId,
      attempt_ordinal: 1,
      producer_revision: 1,
      terminal_status: "succeeded",
      result_origin: "worker_result",
      attempt_record_path: recordRelative,
      attempt_record_sha256: sha256Bytes(recordBytes),
    }],
  };
  writeCanonical(join(runRoot, "units", `${unitId}.json`), unitState);
  return {
    runRoot,
    observationBytes,
    unitState,
  };
}

function createWorkspace({
  mapping,
  cases = [caseFixture("case-one", "success")],
  policy = executionPolicy(),
  skillContent = "---\nname: example-skill\ndescription: Fixture skill.\n---\n\n# Fixture\n",
  resourceFiles = {},
  criterionDescription = "Return fixture output.",
}) {
  const id = workspaceId();
  const root = join(fixedWorkspaceRoot(), id);
  mkdirSync(root, { recursive: true });
  roots.push(root);
  const skill = "example-skill";
  const skillBytes = Buffer.from(skillContent, "utf8");
  const bundleFiles = [
    { relativePath: "SKILL.md", bytes: skillBytes },
    ...Object.entries(resourceFiles).map(([relativePath, content]) => ({
      relativePath,
      bytes: Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8"),
    })),
  ].sort((left, right) => left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0);
  const bundleEntries = bundleFiles.map(({ relativePath, bytes }) =>
    manifestEntry(`.agents/skills/${skill}/${relativePath}`, bytes));
  const suite = suiteFixture(skill, cases.map((item) => ({ ...item, policy })), criterionDescription);
  writeCanonical(join(root, "evaluator", "suite-definitions", "regression.json"), suite);
  for (const suiteName of ["routing", "fresh-reader"]) {
    writeCanonical(join(root, "evaluator", "suite-definitions", `${suiteName}.json`), {
      schema_version: 1,
      artifact_type: "suite_definition",
      skill,
      suite: suiteName,
      description: `Empty ${suiteName} fixture suite.`,
      cases: [],
    });
  }

  const sourceRoles = [...new Set(Object.values(mapping))].sort();
  const sources = Object.fromEntries(
    sourceRoles.map((role) => [
      role,
      {
        selector: "current_tree",
        requested_ref: null,
        resolved_commit: "0".repeat(40),
        working_tree_state: "clean",
        files: bundleEntries,
        bundle_hash: sha256Canonical(bundleEntries),
      },
    ]),
  );
  for (const [variantId] of Object.entries(mapping)) {
    const variantRoot = join(root, "executor", variantId);
    for (const file of bundleFiles) {
      writeFile(join(variantRoot, "bundle", ...file.relativePath.split("/")), file.bytes);
    }
    const bundleEnvelope = {
      schema_version: 1,
      artifact_type: "bundle_manifest",
      workspace_id: id,
      skill,
      variant_id: variantId,
      files: bundleEntries,
    };
    writeCanonical(join(variantRoot, "bundle-manifest.json"), {
      ...bundleEnvelope,
      aggregate_sha256: sha256Canonical(bundleEnvelope),
    });
    for (const caseValue of cases) {
      const promptBytes = Buffer.from(`${caseValue.prompt}\n`, "utf8");
      const contextFiles = (caseValue.context ?? [])
        .map((item) => ({
          bytes: Buffer.from(item.content, "utf8"),
          path: `context/${item.context_id}.txt`,
        }))
        .sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
      const contextEnvelope = {
        schema_version: 1,
        artifact_type: "execution_context_manifest",
        workspace_id: id,
        skill,
        suite: "regression",
        case_id: caseValue.case_id,
        variant_id: variantId,
        prompt_sha256: sha256Bytes(promptBytes),
        context: contextFiles.map((file) => manifestEntry(file.path, file.bytes)),
        requested_execution_policy: policy,
      };
      const caseRoot = join(variantRoot, "cases", "regression", caseValue.case_id);
      writeFile(join(caseRoot, "prompt.txt"), promptBytes);
      for (const file of contextFiles) writeFile(join(caseRoot, ...file.path.split("/")), file.bytes);
      writeCanonical(join(caseRoot, "execution-context-manifest.json"), {
        ...contextEnvelope,
        execution_context_hash: sha256Canonical(contextEnvelope),
      });
    }
  }

  const controlPlane = {
    aggregate_sha256: sha256Canonical([]),
    files: [],
    resolved_commit: "0".repeat(40),
    working_tree_state: "clean",
  };
  const mode = sourceRoles.includes("baseline") ? "comparison" : "candidate_only";
  const workspaceInputHash = sha256Canonical({
    control_plane_hash: controlPlane.aggregate_sha256,
    control_plane_resolved_commit: controlPlane.resolved_commit,
    control_plane_working_tree_state: controlPlane.working_tree_state,
    mode,
    skill,
    sources: Object.fromEntries(
      sourceRoles.map((role) => [
        role,
        {
          bundle_hash: sources[role].bundle_hash,
          requested_ref: sources[role].requested_ref,
          resolved_commit: sources[role].resolved_commit,
          selector: sources[role].selector,
        },
      ]),
    ),
    variant_mapping: mapping,
  });
  writeCanonical(join(root, "workspace-manifest.json"), {
    schema_version: 1,
    artifact_type: "workspace_manifest",
    workspace_id: id,
    skill,
    mode,
    source_roles: sourceRoles,
    variant_mapping: mapping,
    control_plane: controlPlane,
    sources,
    workspace_input_hash: workspaceInputHash,
    artifact_inventory: [],
  });
  return id;
}

function suiteFixture(skill, cases, criterionDescription = "Return fixture output.") {
  return {
    schema_version: 1,
    artifact_type: "suite_definition",
    skill,
    suite: "regression",
    description: "Deterministic Stage 1 fixture suite.",
    cases: cases.map((item) => ({
      case_id: item.case_id,
      title: `Fixture ${item.case_id}`,
      executor_input: {
        prompt: item.prompt,
        context: item.context ?? [],
        execution_policy: item.policy,
      },
      evaluator_only: {
        criteria: [{ criterion_id: "fixture-criterion", description: criterionDescription, material: true }],
        expected_behavior: ["Return fixture output."],
        forbidden_behavior: [],
        safety_vetoes: [],
      },
      suite_config: { behavior_area: "correctness", protected_invariants: ["fixture-output"] },
    })),
  };
}

function caseFixture(caseId, mode, delay = 20, context = []) {
  return { case_id: caseId, prompt: `MODE:${mode} DELAY:${delay}`, context };
}

function executionPolicy() {
  return {
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
  };
}

function createFakeCli({ helpOmitsSandbox = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), "vocaspace-cli-fake-"));
  roots.push(root);
  const path = join(root, "fake codex.mjs");
  const eventPath = join(root, "events.jsonl");
  const script = `import { appendFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
if (args[0] === "--version") { console.log("codex-cli fake-1"); process.exit(0); }
if (args[0] === "exec" && args[1] === "--help") {
  console.log(${JSON.stringify(helpOmitsSandbox ? "--ignore-user-config --strict-config -c --model --ephemeral --ignore-rules --skip-git-repo-check --color --cd --output-schema --output-last-message --json read-only" : "--ignore-user-config --strict-config -c --model --sandbox read-only --ephemeral --ignore-rules --skip-git-repo-check --color --cd --output-schema --output-last-message --json")});
  process.exit(0);
}
let stdin = "";
for await (const chunk of process.stdin) stdin += chunk;
const envelope = JSON.parse(stdin);
const prompt = envelope.case_prompt.content_utf8;
const mode = /MODE:([a-z]+)/.exec(prompt)?.[1] ?? "success";
const delay = Number(/DELAY:([0-9]+)/.exec(prompt)?.[1] ?? 20);
const caseId = envelope.identity.case_id;
if (mode === "ignoreterm" && process.platform !== "win32") {
  process.on("SIGTERM", () => {
    appendFileSync(${JSON.stringify(eventPath)}, JSON.stringify({ event: "sigterm", caseId, time: Date.now() }) + "\\n");
  });
}
appendFileSync(${JSON.stringify(eventPath)}, JSON.stringify({ event: "start", caseId, time: Date.now(), cwd: process.cwd(), argv: args, stdin }) + "\\n");
await new Promise((resolve) => setTimeout(resolve, delay));
if (mode === "exit") {
  console.error("fake terminal failure");
  appendFileSync(${JSON.stringify(eventPath)}, JSON.stringify({ event: "end", caseId, time: Date.now() }) + "\\n");
  process.exit(7);
}
const outputIndex = args.indexOf("--output-last-message");
const outputPath = args[outputIndex + 1];
const access = { basis: "fake child process", credentials: "unknown", filesystem: "observed", model_runtime: "unknown", mutation: "not_observed", network: "not_observed", process: "observed", remote: "not_observed", tools: "not_observed" };
if (mode === "missing") {
  appendFileSync(${JSON.stringify(eventPath)}, JSON.stringify({ event: "end", caseId, time: Date.now() }) + "\\n");
  process.exit(0);
}
if (mode === "malformed") writeFileSync(outputPath, "{");
else {
  const output = mode === "extra"
    ? { raw_response: "bad", observed_access: access, extra: true }
    : mode === "invalidaccess"
      ? { raw_response: "bad", observed_access: { ...access, basis: "" } }
      : { raw_response: "fake response for " + caseId, observed_access: access };
  writeFileSync(outputPath, JSON.stringify(output));
}
appendFileSync(${JSON.stringify(eventPath)}, JSON.stringify({ event: "end", caseId, time: Date.now() }) + "\\n");
console.log(JSON.stringify({ type: "fake_event", caseId }));
`;
  writeFile(path, Buffer.from(script, "utf8"));
  return { path, eventPath };
}

function captureIo() {
  let stdout = "";
  let stderr = "";
  return {
    dependencies: {
      stdout: { write: (value) => { stdout += Buffer.isBuffer(value) ? value.toString("utf8") : value; } },
      stderr: { write: (value) => { stderr += Buffer.isBuffer(value) ? value.toString("utf8") : value; } },
    },
    stdout: () => stdout,
    stderr: () => stderr,
  };
}

function requestFor(preparedUnit) {
  return {
    prepared_unit: preparedUnit,
    attempt_id: `${preparedUnit.unit_id}-attempt-1`,
    attempt_ordinal: 1,
    output_path: join(preparedUnit.invocation.cwd, "..", "output"),
  };
}

function parseFakeEvents(fake) {
  const text = readFakeEvents(fake);
  return text ? text.trim().split("\n").map((line) => JSON.parse(line)) : [];
}

function readFakeEvents(fake) {
  return existsSync(fake.eventPath) ? readFileSync(fake.eventPath, "utf8") : "";
}

function intervalsFromEvents(events) {
  const starts = new Map();
  const intervals = [];
  for (const event of events) {
    if (event.event === "start") starts.set(event.caseId, event.time);
    if (event.event === "end" && starts.has(event.caseId)) {
      intervals.push({ caseId: event.caseId, start: starts.get(event.caseId), end: event.time });
    }
  }
  return intervals;
}

function maxOverlap(intervals) {
  const points = intervals.flatMap((interval) => [
    { time: interval.start, delta: 1 },
    { time: interval.end, delta: -1 },
  ]).sort((left, right) => left.time - right.time || left.delta - right.delta);
  let active = 0;
  let maximum = 0;
  for (const point of points) {
    active += point.delta;
    maximum = Math.max(maximum, active);
  }
  return maximum;
}

function listFiles(root) {
  const files = [];
  const visit = (directory, prefix = "") => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) visit(join(directory, entry.name), relative);
      else files.push(relative);
    }
  };
  visit(root);
  return files.sort();
}

function writeCanonical(path, value) {
  writeFile(path, Buffer.from(canonicalJson(value), "utf8"));
}

function rewriteHashedManifest(path, hashField, mutate) {
  const value = JSON.parse(readFileSync(path, "utf8"));
  mutate(value);
  const envelope = { ...value };
  delete envelope[hashField];
  value[hashField] = sha256Canonical(envelope);
  writeCanonical(path, value);
}

function bundleManifestPath(id) {
  return join(fixedWorkspaceRoot(), id, "executor", "A", "bundle-manifest.json");
}

function contextManifestPath(id) {
  return join(
    fixedWorkspaceRoot(),
    id,
    "executor",
    "A",
    "cases",
    "regression",
    "case-one",
    "execution-context-manifest.json",
  );
}

function writeFile(path, bytes) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}

function workspaceId() {
  return `ws-${randomUUID().replaceAll("-", "")}`;
}

function executionId() {
  return `exec-${randomUUID().replaceAll("-", "")}`;
}
