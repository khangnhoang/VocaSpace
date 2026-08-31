// Test plan:
// - Mục tiêu: kiểm tra Stage 1 reader runner và Stage 2 prepare barrier mà không gọi model thật.
// - Loại test: Node unit/CLI integration với child process giả.
// - Đối tượng: parser, compiler, evaluator proposal/lineage, materializer, publication và Stage 1 worker pool.
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
// - Kết quả verify gần nhất: passed 38 tests bằng `node --test .agents/scripts/run-skill-eval-cli.test.mjs` trên Node v24.11.1.
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
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
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
  compileStaticCliPlan,
  materializePreparedUnitDescriptor,
  publishCliPreparedRun,
} from "./lib/skill-evals/cli-execution-plan-v1.mjs";
import {
  assertEvaluatorProposal,
  compileEvaluatorPreparedUnitDescriptor,
  evaluatorProposalSchema,
} from "./lib/skill-evals/cli-evaluator-proposal-v1.mjs";
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

test("evaluator compiler rejects one-dimension donor lineage while the donor graph remains valid", () => {
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
  assert.throws(
    () => compileEvaluatorPreparedUnitDescriptor({
      staticPlan: firstStatic,
      bindings: [donorBinding],
      cliOptions: cliBehaviorOptions,
    }),
    /different semantic lineage|workspace_id/,
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
    terminal_status: "succeeded",
    structured_output_path: `attempts/${dependency.unit_id}/1/output/observation.json`,
    structured_output_sha256: sha256Bytes(bytes),
    observation_bytes: bytes,
  };
}

function createWorkspace({
  mapping,
  cases = [caseFixture("case-one", "success")],
  policy = executionPolicy(),
  skillContent = "---\nname: example-skill\ndescription: Fixture skill.\n---\n\n# Fixture\n",
  resourceFiles = {},
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
  const suite = suiteFixture(skill, cases.map((item) => ({ ...item, policy })));
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

function suiteFixture(skill, cases) {
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
        criteria: [{ criterion_id: "fixture-criterion", description: "Return fixture output.", material: true }],
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
