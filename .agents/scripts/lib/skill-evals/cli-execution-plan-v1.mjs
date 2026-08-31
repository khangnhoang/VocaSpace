import { randomUUID } from "node:crypto";
import {
  closeSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  ArtifactError,
  canonicalJson,
  parseStrictJson,
  sha256Bytes,
  sha256Canonical,
  suiteOrder,
} from "./artifact-schema-v1.mjs";
import {
  cliBehaviorOptions,
  compileReaderPreparedUnitDescriptor,
  readerOutputSchema,
} from "./codex-cli-runner-v1.mjs";
import {
  assertEvaluatorStaticPlan,
  createEvaluatorStaticPlan,
  evaluatorProposalSchema,
} from "./cli-evaluator-proposal-v1.mjs";

export function fixedCliRunRoot() {
  return join(tmpdir(), "vocaspace-agent-skill-evals", "cli-v1");
}

export function createCliRunId() {
  return `run-${randomUUID().replaceAll("-", "")}`;
}

export function compileStaticCliPlan({
  workspace,
  compiledInputs = compileCliPlanInputs(workspace),
  runId,
  maxConcurrency = 4,
  localProcessCap = Math.max(1, availableParallelism()),
  maxAttempts = 2,
  targetMinutes = null,
  explicitConcurrency = null,
  history = null,
}) {
  assertRunId(runId);
  for (const value of [maxConcurrency, localProcessCap, maxAttempts]) assertPositiveSafe(value);
  if (targetMinutes !== null && (!Number.isFinite(targetMinutes) || targetMinutes <= 0)) {
    invalid("target_minutes must be a positive finite number.");
  }
  const { readerDescriptors, evaluatorUnits } = compiledInputs;
  const allUnitIds = [
    ...readerDescriptors.map((descriptor) => descriptor.unit_id),
    ...evaluatorUnits.map((unit) => unit.unit_id),
  ];
  const estimate = compileConcurrencyEstimate({
    unitIds: allUnitIds,
    evaluatorUnits,
    maxConcurrency,
    localProcessCap,
    targetMinutes,
    explicitConcurrency,
    history,
  });
  const plannedConcurrency = estimate.planned_concurrency;
  const readerUnits = readerDescriptors.map((descriptor) => serializeReaderDescriptor(descriptor));
  const readyUnitIds = readerDescriptors.map((descriptor) => descriptor.unit_id);
  const totalUnits = allUnitIds.length;
  const ceiling = totalUnits * maxAttempts;
  if (!Number.isSafeInteger(ceiling)) invalid("max attempt call ceiling is not a safe integer.");
  const dependencyWaves = [
    wave(1, "reader", readyUnitIds, plannedConcurrency),
    wave(2, "evaluator", evaluatorUnits.map((unit) => unit.unit_id), plannedConcurrency),
  ];
  const processSettings = {
    planned_concurrency: plannedConcurrency,
    max_concurrency: maxConcurrency,
    local_process_cap: localProcessCap,
    max_attempts: maxAttempts,
    target_minutes: targetMinutes,
  };
  const counts = {
    reader_units: readerUnits.length,
    evaluator_units: evaluatorUnits.length,
    total_units: totalUnits,
    ready_units: readyUnitIds.length,
    blocked_on_dependencies: evaluatorUnits.length,
    expected_calls_without_retry: totalUnits,
    automatic_retry_calls: 0,
    max_attempt_call_ceiling: ceiling,
  };
  const plan = {
    schema_version: 1,
    artifact_type: "cli_execution_plan",
    run_id: runId,
    revision: 1,
    workspace_id: workspace.manifest.workspace_id,
    selected_scope: structuredClone(workspace.selectedScope),
    cli_behavior_options: structuredClone(cliBehaviorOptions),
    process_settings: processSettings,
    counts,
    ready_unit_ids: readyUnitIds,
    reader_units: readerUnits,
    evaluator_units: structuredClone(evaluatorUnits),
    dependency_waves: dependencyWaves,
    estimate,
  };
  assertCliExecutionPlan(plan);
  return { plan, readerDescriptors };
}

export function compileCliPlanInputs(workspace) {
  const readerDescriptors = workspace.selected.map(compileReaderPreparedUnitDescriptor);
  const readersByCase = new Map();
  for (const descriptor of readerDescriptors) {
    const key = `${descriptor.logical_unit_key.suite}:${descriptor.logical_unit_key.case_id}`;
    const values = readersByCase.get(key) ?? [];
    values.push(descriptor);
    readersByCase.set(key, values);
  }
  const evaluatorUnits = [];
  for (const { suite, cases } of workspace.suites) {
    for (const selectedCase of cases) {
      evaluatorUnits.push(
        createEvaluatorStaticPlan({
          skill: workspace.manifest.skill,
          suite,
          selectedCase,
          readerDescriptors: readersByCase.get(`${suite}:${selectedCase.case_id}`) ?? [],
          mode: workspace.selectedScope.mode,
        }),
      );
    }
  }
  return { readerDescriptors, evaluatorUnits };
}

export function compileConcurrencyEstimate({
  unitIds,
  evaluatorUnits,
  maxConcurrency,
  localProcessCap,
  targetMinutes,
  explicitConcurrency,
  history,
}) {
  const targetSeconds = targetMinutes === null ? null : targetMinutes * 60;
  if (targetSeconds !== null && (!Number.isFinite(targetSeconds) || targetSeconds <= 0)) {
    invalid("target wall time is not finite.");
  }
  let recommendation;
  let durationSeconds = null;
  let totalWork = null;
  let criticalPath = null;
  let rateLimit = null;
  let concurrencyForTarget = null;
  let estimated = null;
  let historyStatus = "unknown";
  if (history !== null) {
    assertExactKeys(history, ["duration_seconds", "observed_rate_limit_cap"], "history");
    assertPositiveSafe(history.observed_rate_limit_cap);
    if (!Array.isArray(history.duration_seconds) || history.duration_seconds.length !== unitIds.length) {
      invalid("Complete history must cover every unit.");
    }
    history.duration_seconds.forEach((entry, index) => {
      assertExactKeys(entry, ["seconds", "unit_id"], "duration entry");
      if (entry.unit_id !== unitIds[index] || !Number.isFinite(entry.seconds) || entry.seconds <= 0) {
        invalid("Duration history membership or value is invalid.");
      }
    });
    durationSeconds = structuredClone(history.duration_seconds);
    rateLimit = history.observed_rate_limit_cap;
    totalWork = durationSeconds.reduce((sum, entry) => sum + entry.seconds, 0);
    const durationById = new Map(durationSeconds.map((entry) => [entry.unit_id, entry.seconds]));
    criticalPath = evaluatorUnits.reduce((largest, evaluator) => {
      const readerSeconds = evaluator.dependencies.map((item) => durationById.get(item.unit_id));
      const candidate = Math.max(0, ...readerSeconds) + durationById.get(evaluator.unit_id);
      return Math.max(largest, candidate);
    }, 0);
    if (![totalWork, criticalPath].every(Number.isFinite)) invalid("History arithmetic is not finite.");
    concurrencyForTarget = targetSeconds === null ? null : Math.ceil(totalWork / targetSeconds);
    recommendation = Math.min(
      targetSeconds === null ? 4 : Math.max(1, concurrencyForTarget),
      maxConcurrency,
      localProcessCap,
      rateLimit,
    );
    estimated = Math.max(totalWork / recommendation, criticalPath);
    historyStatus = "complete";
  } else {
    recommendation = Math.min(4, maxConcurrency, localProcessCap);
  }
  if (explicitConcurrency !== null) {
    assertPositiveSafe(explicitConcurrency);
    if (explicitConcurrency > Math.min(maxConcurrency, localProcessCap)) {
      invalid("Explicit concurrency exceeds the configured or local cap.", 2);
    }
  }
  return {
    schema_version: 1,
    history_status: historyStatus,
    target_status: targetSeconds === null ? "absent" : "provided",
    target_wall_time_seconds: targetSeconds,
    duration_seconds: durationSeconds,
    total_work_seconds: totalWork,
    dependency_critical_path_seconds: criticalPath,
    observed_rate_limit_cap: rateLimit,
    concurrency_for_target: concurrencyForTarget,
    recommended_concurrency: recommendation,
    planned_concurrency: explicitConcurrency ?? recommendation,
    estimated_wall_time_seconds: estimated,
  };
}

export function materializePreparedUnitDescriptor({
  preparedRoot,
  descriptor,
  rename = renameSync,
}) {
  assertDescriptor(descriptor);
  mkdirSync(preparedRoot, { recursive: true });
  const finalRoot = contained(preparedRoot, descriptor.unit_id);
  if (existsSync(finalRoot)) return validateFinal(finalRoot, descriptor);
  const stagingRoot = contained(
    preparedRoot,
    `.staging-${descriptor.unit_id}-${randomUUID().replaceAll("-", "")}`,
  );
  let published = false;
  try {
    const inputRoot = join(stagingRoot, "input");
    mkdirSync(inputRoot, { recursive: true });
    writeExclusive(join(inputRoot, "stdin.txt"), descriptor.invocation_content.stdin_bytes);
    writeExclusive(
      join(inputRoot, "output-schema.json"),
      descriptor.invocation_content.output_schema_bytes,
    );
    validateFinal(stagingRoot, descriptor);
    if (existsSync(finalRoot)) return validateFinal(finalRoot, descriptor);
    try {
      rename(stagingRoot, finalRoot);
      published = true;
    } catch (error) {
      if (existsSync(finalRoot)) return validateFinal(finalRoot, descriptor);
      throw error;
    }
    return validateFinal(finalRoot, descriptor);
  } finally {
    if (!published && existsSync(stagingRoot)) rmSync(stagingRoot, { recursive: true, force: true });
  }
}

export function publishCliPreparedRun({ runRoot, plan, readerDescriptors }) {
  assertCliExecutionPlan(plan);
  const runPath = contained(runRoot, plan.run_id);
  const revisionRoot = contained(runPath, "revisions/1");
  const preparedRoot = contained(revisionRoot, "prepared");
  mkdirSync(preparedRoot, { recursive: true });
  const units = readerDescriptors.map((descriptor) =>
    materializePreparedUnitDescriptor({ preparedRoot, descriptor }),
  );
  const planBytes = Buffer.from(canonicalJson(plan), "utf8");
  const planPath = join(revisionRoot, "execution-plan.json");
  writeExclusive(planPath, planBytes);
  assertCanonicalArtifact(planPath, assertCliExecutionPlan);
  const run = {
    schema_version: 1,
    artifact_type: "cli_run",
    run_id: plan.run_id,
    workspace_id: plan.workspace_id,
    selected_scope: structuredClone(plan.selected_scope),
    current_revision: 1,
    status: "prepared",
    unit_ids: [
      ...plan.reader_units.map((unit) => unit.unit_id),
      ...plan.evaluator_units.map((unit) => unit.unit_id),
    ],
    process_settings: structuredClone(plan.process_settings),
  };
  assertCliRun(run, plan);
  const runManifestPath = join(runPath, "run.json");
  writeExclusive(runManifestPath, Buffer.from(canonicalJson(run), "utf8"));
  assertCanonicalArtifact(runManifestPath, (value) => assertCliRun(value, plan));
  return { run, units, runPath };
}

export function assertCliExecutionPlan(value) {
  assertExactKeys(value, [
    "artifact_type", "cli_behavior_options", "counts", "dependency_waves", "estimate",
    "evaluator_units", "process_settings", "reader_units", "ready_unit_ids", "revision",
    "run_id", "schema_version", "selected_scope", "workspace_id",
  ], "execution plan");
  if (value.schema_version !== 1 || value.artifact_type !== "cli_execution_plan" || value.revision !== 1) {
    invalid("Execution plan identity is invalid.");
  }
  assertRunId(value.run_id);
  if (!/^ws-[a-f0-9]{32}$/.test(value.workspace_id ?? "")) invalid("workspace_id is invalid.");
  assertSelectedScope(value.selected_scope);
  assertExactKeys(value.process_settings, [
    "local_process_cap", "max_attempts", "max_concurrency", "planned_concurrency", "target_minutes",
  ], "process settings");
  for (const setting of [
    value.process_settings.local_process_cap,
    value.process_settings.max_attempts,
    value.process_settings.max_concurrency,
    value.process_settings.planned_concurrency,
  ]) assertPositiveSafe(setting);
  if (value.process_settings.planned_concurrency > Math.min(
    value.process_settings.max_concurrency,
    value.process_settings.local_process_cap,
  )) invalid("Planned concurrency exceeds its caps.");
  const readerIds = value.reader_units.map((unit) => unit.unit_id);
  const evaluatorIds = value.evaluator_units.map((unit) => unit.unit_id);
  if (canonicalJson(value.ready_unit_ids) !== canonicalJson(readerIds)) invalid("Ready units are invalid.");
  const total = readerIds.length + evaluatorIds.length;
  const expectedCounts = {
    reader_units: readerIds.length,
    evaluator_units: evaluatorIds.length,
    total_units: total,
    ready_units: readerIds.length,
    blocked_on_dependencies: evaluatorIds.length,
    expected_calls_without_retry: total,
    automatic_retry_calls: 0,
    max_attempt_call_ceiling: total * value.process_settings.max_attempts,
  };
  if (canonicalJson(value.counts) !== canonicalJson(expectedCounts)) invalid("Execution plan counts are invalid.");
  const expectedWaves = [
    wave(1, "reader", readerIds, value.process_settings.planned_concurrency),
    wave(2, "evaluator", evaluatorIds, value.process_settings.planned_concurrency),
  ];
  if (canonicalJson(value.dependency_waves) !== canonicalJson(expectedWaves)) invalid("Dependency waves are invalid.");
  if (
    canonicalJson(value.cli_behavior_options) !== canonicalJson(cliBehaviorOptions) ||
    value.estimate.planned_concurrency !== value.process_settings.planned_concurrency
  ) invalid("Execution plan options are invalid.");
  for (const unit of value.reader_units) assertSerializedReader(unit);
  for (const unit of value.evaluator_units) assertEvaluatorUnit(unit, value);
  const expectedReaderKeys = [];
  const expectedEvaluatorKeys = [];
  for (const suiteEntry of value.selected_scope.suites) {
    for (const caseId of suiteEntry.case_ids) {
      for (const sourceRole of value.selected_scope.source_roles) {
        expectedReaderKeys.push(`${suiteEntry.suite}:${caseId}:${sourceRole}`);
      }
      expectedEvaluatorKeys.push(`${suiteEntry.suite}:${caseId}`);
    }
  }
  const actualReaderKeys = value.reader_units.map((unit) =>
    `${unit.logical_unit_key.suite}:${unit.logical_unit_key.case_id}:${unit.logical_unit_key.source_role}`,
  );
  const actualEvaluatorKeys = value.evaluator_units.map((unit) =>
    `${unit.logical_unit_key.suite}:${unit.logical_unit_key.case_id}`,
  );
  if (
    canonicalJson(actualReaderKeys) !== canonicalJson(expectedReaderKeys) ||
    canonicalJson(actualEvaluatorKeys) !== canonicalJson(expectedEvaluatorKeys)
  ) invalid("Execution plan unit ordering or selected membership is invalid.");
  const history = value.estimate.history_status === "complete"
    ? {
        duration_seconds: value.estimate.duration_seconds,
        observed_rate_limit_cap: value.estimate.observed_rate_limit_cap,
      }
    : null;
  const expectedEstimate = compileConcurrencyEstimate({
    unitIds: [...readerIds, ...evaluatorIds],
    evaluatorUnits: value.evaluator_units,
    maxConcurrency: value.process_settings.max_concurrency,
    localProcessCap: value.process_settings.local_process_cap,
    targetMinutes: value.process_settings.target_minutes,
    explicitConcurrency: value.process_settings.planned_concurrency,
    history,
  });
  if (
    expectedEstimate.recommended_concurrency !== value.estimate.recommended_concurrency ||
    canonicalJson({ ...expectedEstimate, planned_concurrency: value.estimate.planned_concurrency }) !==
      canonicalJson(value.estimate)
  ) invalid("Execution plan estimate is invalid.");
  return value;
}

export function assertCliRun(value, plan) {
  assertExactKeys(value, [
    "artifact_type", "current_revision", "process_settings", "run_id", "schema_version",
    "selected_scope", "status", "unit_ids", "workspace_id",
  ], "run manifest");
  if (
    value.schema_version !== 1 || value.artifact_type !== "cli_run" || value.current_revision !== 1 ||
    value.status !== "prepared" || value.run_id !== plan.run_id || value.workspace_id !== plan.workspace_id
  ) invalid("Run manifest identity is invalid.");
  const expectedIds = [...plan.reader_units, ...plan.evaluator_units].map((unit) => unit.unit_id);
  if (
    canonicalJson(value.selected_scope) !== canonicalJson(plan.selected_scope) ||
    canonicalJson(value.process_settings) !== canonicalJson(plan.process_settings) ||
    canonicalJson(value.unit_ids) !== canonicalJson(expectedIds)
  ) invalid("Run manifest relationships are invalid.");
  return value;
}

export function assertCliPrepareResult(value, plan) {
  assertExactKeys(value, [
    "artifact_type", "command", "counts", "dependency_waves", "dispatch_counts", "estimate",
    "execution_plan", "process_settings", "ready_unit_ids", "revision", "run_id", "run_manifest",
    "schema_version", "selected_scope", "status", "workspace_id",
  ], "CLI prepare result");
  if (
    value?.schema_version !== 1 || value?.artifact_type !== "cli_prepare_result" ||
    value.command !== "prepare" || value.status !== "prepared" || value.run_id !== plan.run_id ||
    value.workspace_id !== plan.workspace_id || value.revision !== 1 ||
    canonicalJson(value.selected_scope) !== canonicalJson(plan.selected_scope) ||
    canonicalJson(value.process_settings) !== canonicalJson(plan.process_settings) ||
    canonicalJson(value.counts) !== canonicalJson(plan.counts) ||
    canonicalJson(value.ready_unit_ids) !== canonicalJson(plan.ready_unit_ids) ||
    canonicalJson(value.dependency_waves) !== canonicalJson(plan.dependency_waves) ||
    canonicalJson(value.estimate) !== canonicalJson(plan.estimate) ||
    canonicalJson(value.dispatch_counts) !== canonicalJson({ reader: 0, evaluator: 0, total: 0 }) ||
    value.run_manifest !== "run.json" ||
    value.execution_plan !== "revisions/1/execution-plan.json"
  ) invalid("CLI prepare result does not match its execution plan.");
  return value;
}

export function assertCliPrepareCommandError(value) {
  assertExactKeys(value, [
    "artifact_type", "code", "command", "dispatch_counts", "message", "revision", "run_id",
    "schema_version", "status", "workspace_id",
  ], "CLI prepare command error");
  if (
    value?.schema_version !== 1 || value?.artifact_type !== "command_error" ||
    value.command !== "prepare" || value.status !== "error" ||
    typeof value.code !== "string" || !/^[A-Z][A-Z0-9_]*$/.test(value.code) ||
    typeof value.message !== "string" || value.message.length === 0 ||
    canonicalJson(value.dispatch_counts) !== canonicalJson({ reader: 0, evaluator: 0, total: 0 }) ||
    (value.workspace_id !== null && !/^ws-[a-f0-9]{32}$/.test(value.workspace_id)) ||
    (value.run_id === null
      ? value.revision !== null
      : !/^run-[a-f0-9]{32}$/.test(value.run_id) || value.revision !== 1 || value.workspace_id === null)
  ) invalid("CLI prepare command error is invalid.");
  return value;
}

function serializeReaderDescriptor(descriptor) {
  const prefix = `revisions/1/prepared/${descriptor.unit_id}/input`;
  return {
    schema_version: descriptor.schema_version,
    unit_id: descriptor.unit_id,
    logical_unit_key: structuredClone(descriptor.logical_unit_key),
    kind: descriptor.kind,
    dependencies: [],
    invocation_content: {
      stdin_utf8: decodeExactUtf8(descriptor.invocation_content.stdin_bytes),
      output_schema_utf8: decodeExactUtf8(descriptor.invocation_content.output_schema_bytes),
      cli_options: structuredClone(descriptor.invocation_content.cli_options),
    },
    behavior_projection: structuredClone(descriptor.behavior_projection),
    source_locator: structuredClone(descriptor.source_locator),
    prepared_input: {
      stdin_path: `${prefix}/stdin.txt`,
      output_schema_path: `${prefix}/output-schema.json`,
      cwd: prefix,
    },
  };
}

function assertSerializedReader(unit) {
  assertExactKeys(unit, [
    "behavior_projection", "dependencies", "invocation_content", "kind", "logical_unit_key",
    "prepared_input", "schema_version", "source_locator", "unit_id",
  ], "serialized reader");
  assertExactKeys(unit.invocation_content, ["cli_options", "output_schema_utf8", "stdin_utf8"], "reader invocation content");
  assertExactKeys(unit.prepared_input, ["cwd", "output_schema_path", "stdin_path"], "prepared input");
  const descriptor = {
    schema_version: unit.schema_version,
    unit_id: unit.unit_id,
    logical_unit_key: unit.logical_unit_key,
    kind: unit.kind,
    dependencies: unit.dependencies,
    invocation_content: {
      stdin_bytes: Buffer.from(unit.invocation_content.stdin_utf8, "utf8"),
      output_schema_bytes: Buffer.from(unit.invocation_content.output_schema_utf8, "utf8"),
      cli_options: unit.invocation_content.cli_options,
    },
    behavior_projection: unit.behavior_projection,
    source_locator: unit.source_locator,
  };
  assertDescriptor(descriptor);
  const prefix = `revisions/1/prepared/${unit.unit_id}/input`;
  if (canonicalJson(unit.prepared_input) !== canonicalJson({
    stdin_path: `${prefix}/stdin.txt`, output_schema_path: `${prefix}/output-schema.json`, cwd: prefix,
  })) invalid("Serialized prepared input paths are invalid.");
}

function assertDescriptor(descriptor) {
  assertExactKeys(descriptor, [
    "behavior_projection", "dependencies", "invocation_content", "kind", "logical_unit_key",
    "schema_version", "source_locator", "unit_id",
  ], "prepared unit descriptor");
  if (!descriptor || !["reader", "evaluator"].includes(descriptor.kind)) invalid("Descriptor kind is invalid.");
  const prefix = descriptor.kind === "reader" ? "reader" : "evaluator";
  if (!new RegExp(`^${prefix}-[a-f0-9]{64}$`).test(descriptor.unit_id)) invalid("Descriptor unit_id is invalid.");
  const input = descriptor.invocation_content;
  if (!Buffer.isBuffer(input?.stdin_bytes) || !Buffer.isBuffer(input?.output_schema_bytes)) {
    invalid("Descriptor invocation bytes are invalid.");
  }
  if (
    sha256Bytes(input.stdin_bytes) !== descriptor.behavior_projection.stdin_sha256 ||
    sha256Bytes(input.output_schema_bytes) !== descriptor.behavior_projection.output_schema_sha256 ||
    canonicalJson(input.cli_options) !== canonicalJson(descriptor.behavior_projection.cli_behavior_options)
  ) invalid("Descriptor hashes or CLI options are inconsistent.");
  const stdin = parseStrictJson(input.stdin_bytes, `${descriptor.kind} stdin`);
  const schema = parseStrictJson(input.output_schema_bytes, `${descriptor.kind} output schema`);
  if (
    !Buffer.from(canonicalJson(stdin), "utf8").equals(input.stdin_bytes) ||
    !Buffer.from(canonicalJson(schema), "utf8").equals(input.output_schema_bytes)
  ) invalid("Descriptor JSON bytes must be canonical.");
  if (descriptor.schema_version !== 1 || descriptor.logical_unit_key?.kind !== descriptor.kind) {
    invalid("Descriptor logical identity is invalid.");
  }
  const expectedUnitId = `${prefix}-${sha256Canonical(descriptor.logical_unit_key)}`;
  if (descriptor.unit_id !== expectedUnitId) invalid("Descriptor unit_id does not match its logical key.");
  const logicalKeys = descriptor.kind === "reader"
    ? ["case_id", "kind", "schema_version", "skill", "source_role", "suite"]
    : ["case_id", "kind", "schema_version", "skill", "suite"];
  assertExactKeys(descriptor.logical_unit_key, logicalKeys, "descriptor logical key");
  if (!Array.isArray(descriptor.dependencies)) invalid("Descriptor dependencies must be an array.");
  if (canonicalJson(input.cli_options) !== canonicalJson(cliBehaviorOptions)) {
    invalid("Descriptor CLI options do not match the frozen Stage 2 options.");
  }
  if (descriptor.kind === "reader") {
    if (descriptor.dependencies.length !== 0) invalid("Reader descriptor dependencies must be empty.");
    assertExactKeys(descriptor.source_locator, [
      "bundle_manifest_hash", "bundle_manifest_path", "context_paths", "execution_context_hash",
      "execution_context_manifest_path", "prompt_path", "variant_id", "workspace_id", "workspace_path",
    ], "reader source locator");
  } else {
    assertExactKeys(descriptor.source_locator, ["accepted_results"], "evaluator source locator");
    if (!Array.isArray(descriptor.source_locator.accepted_results)) invalid("Accepted results must be an array.");
    for (const result of descriptor.source_locator.accepted_results) {
      assertExactKeys(result, [
        "source_role", "structured_output_path", "structured_output_sha256", "unit_id",
      ], "accepted result locator");
    }
  }
  assertExactKeys(descriptor.behavior_projection, [
    "cli_behavior_options", "kind", "model_visible_files", "output_schema_sha256",
    "schema_version", "stdin_sha256",
  ], "behavior projection");
  if (
    descriptor.behavior_projection.schema_version !== 1 ||
    descriptor.behavior_projection.kind !== descriptor.kind
  ) invalid("Descriptor behavior projection identity is invalid.");
  const visible = descriptor.kind === "reader" ? readerVisible(stdin) : evaluatorVisible(stdin);
  if (descriptor.kind === "reader" && canonicalJson(schema) !== canonicalJson(readerOutputSchema)) {
    invalid("Reader output schema is not the frozen reader schema.");
  }
  if (descriptor.kind === "evaluator" && canonicalJson(schema) !== canonicalJson(evaluatorProposalSchema)) {
    invalid("Evaluator output schema is not evaluator-proposal-v1.");
  }
  if (canonicalJson(visible) !== canonicalJson(descriptor.behavior_projection.model_visible_files)) {
    invalid("Descriptor model-visible inventory is inconsistent.");
  }
  return descriptor;
}

function readerVisible(stdin) {
  if (stdin.kind !== "fresh_reader_input") invalid("Reader stdin kind is invalid.");
  assertExactKeys(stdin, [
    "bundle_files", "case_prompt", "context_files", "identity", "instruction", "kind",
    "requested_execution_policy", "schema_version",
  ], "reader stdin");
  if (stdin.schema_version !== 1 || !Array.isArray(stdin.bundle_files) || !Array.isArray(stdin.context_files)) {
    invalid("Reader stdin shape is invalid.");
  }
  const visible = [...stdin.bundle_files, stdin.case_prompt, ...stdin.context_files]
    .map(({ relative_path, sha256 }) => ({ relative_path, sha256 }))
    .sort((left, right) => compareStrings(left.relative_path, right.relative_path));
  assertVisibleInventory(visible);
  return visible;
}

function evaluatorVisible(stdin) {
  if (stdin.kind !== "evaluator_input" || stdin.delivery_mode !== "stdin_embedded_evaluator_input_v1") {
    invalid("Evaluator stdin kind or delivery mode is invalid.");
  }
  assertExactKeys(stdin, [
    "delivery_mode", "dependencies", "evaluator_only", "identity", "instruction", "kind", "mode",
    "schema_version", "suite_config",
  ], "evaluator stdin");
  if (stdin.schema_version !== 1 || !["candidate_only", "comparison"].includes(stdin.mode) || !Array.isArray(stdin.dependencies)) {
    invalid("Evaluator stdin shape is invalid.");
  }
  const roles = stdin.dependencies.map((dependency) => {
    assertExactKeys(dependency, [
      "execution_reason", "execution_status", "observed_access", "raw_response", "source_role",
    ], "evaluator dependency projection");
    return dependency.source_role;
  });
  const expectedRoles = stdin.mode === "comparison" ? ["baseline", "candidate"] : ["candidate"];
  if (canonicalJson(roles) !== canonicalJson(expectedRoles)) invalid("Evaluator dependency roles are invalid.");
  const visible = [
    { relative_path: "evaluator/evaluator-only.json", sha256: sha256Bytes(Buffer.from(canonicalJson(stdin.evaluator_only), "utf8")) },
    { relative_path: "evaluator/suite-config.json", sha256: sha256Bytes(Buffer.from(canonicalJson(stdin.suite_config), "utf8")) },
    ...stdin.dependencies.map((dependency) => ({
      relative_path: `dependencies/${dependency.source_role}/observation.json`,
      sha256: sha256Bytes(Buffer.from(canonicalJson(dependency), "utf8")),
    })),
  ].sort((left, right) => compareStrings(left.relative_path, right.relative_path));
  assertVisibleInventory(visible);
  return visible;
}

function assertEvaluatorUnit(unit, plan) {
  assertEvaluatorStaticPlan(unit);
  if (
    unit.schema_version !== 1 || unit.kind !== "evaluator" ||
    unit.unit_id !== `evaluator-${sha256Canonical(unit.logical_unit_key)}` ||
    unit.logical_unit_key.kind !== "evaluator" ||
    unit.logical_unit_key.skill !== plan.selected_scope.skill ||
    unit.mode !== plan.selected_scope.mode
  ) invalid("Evaluator unit identity is invalid.");
  const roles = unit.dependencies.map((dependency) => {
    assertExactKeys(dependency, ["source_locator", "source_role", "unit_id"], "evaluator dependency");
    assertExactKeys(dependency.source_locator, [
      "execution_context_hash", "variant_id", "workspace_id",
    ], "evaluator dependency locator");
    if (dependency.source_locator.workspace_id !== plan.workspace_id) invalid("Evaluator dependency workspace is invalid.");
    return dependency.source_role;
  });
  if (canonicalJson(roles) !== canonicalJson(plan.selected_scope.source_roles)) {
    invalid("Evaluator dependency roles are invalid.");
  }
  const readers = plan.reader_units.filter((reader) =>
    reader.logical_unit_key.suite === unit.logical_unit_key.suite &&
    reader.logical_unit_key.case_id === unit.logical_unit_key.case_id,
  );
  if (canonicalJson(unit.dependencies.map((item) => item.unit_id)) !== canonicalJson(readers.map((item) => item.unit_id))) {
    invalid("Evaluator dependency membership is invalid.");
  }
  unit.dependencies.forEach((dependency, index) => {
    const reader = readers[index];
    const expectedLocator = {
      workspace_id: reader.source_locator.workspace_id,
      variant_id: reader.source_locator.variant_id,
      execution_context_hash: reader.source_locator.execution_context_hash,
    };
    if (
      dependency.source_role !== reader.logical_unit_key.source_role ||
      canonicalJson(dependency.source_locator) !== canonicalJson(expectedLocator)
    ) invalid("Evaluator dependency locator does not match its reader descriptor.");
  });
  if (
    canonicalJson(unit.criterion_ids) !== canonicalJson(unit.evaluator_only.criteria.map((item) => item.criterion_id)) ||
    canonicalJson(unit.veto_ids) !== canonicalJson(unit.evaluator_only.safety_vetoes.map((item) => item.veto_id))
  ) invalid("Evaluator rubric IDs are invalid.");
}

function assertSelectedScope(scope) {
  assertExactKeys(scope, ["mode", "skill", "source_roles", "suites"], "selected scope");
  const expectedRoles = scope.mode === "comparison" ? ["baseline", "candidate"] : ["candidate"];
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scope.skill ?? "") ||
    canonicalJson(scope.source_roles) !== canonicalJson(expectedRoles) ||
    !Array.isArray(scope.suites) ||
    canonicalJson(scope.suites.map((item) => item.suite)) !== canonicalJson(suiteOrder)
  ) invalid("Selected scope is invalid.");
  for (const suite of scope.suites) {
    assertExactKeys(suite, ["case_ids", "suite"], "selected suite");
    if (
      !Array.isArray(suite.case_ids) ||
      canonicalJson(suite.case_ids) !== canonicalJson([...new Set(suite.case_ids)].sort(compareStrings))
    ) invalid("Selected case IDs are invalid.");
  }
}

function assertVisibleInventory(entries) {
  const paths = entries.map((entry) => entry.relative_path);
  if (
    entries.some((entry) => !/^[a-f0-9]{64}$/.test(entry.sha256 ?? "")) ||
    canonicalJson(paths) !== canonicalJson([...new Set(paths)].sort(compareStrings))
  ) invalid("Model-visible inventory is invalid.");
}

function validateFinal(root, descriptor) {
  if (!lstatSync(root).isDirectory()) invalid("Prepared unit root must be a directory.");
  const rootEntries = readdirSync(root, { withFileTypes: true });
  if (rootEntries.length !== 1 || rootEntries[0].name !== "input" || !rootEntries[0].isDirectory()) {
    invalid("Prepared unit inventory is invalid.");
  }
  const inputRoot = join(root, "input");
  const entries = readdirSync(inputRoot, { withFileTypes: true })
    .sort((left, right) => compareStrings(left.name, right.name));
  const expected = ["output-schema.json", "stdin.txt"];
  if (
    entries.length !== expected.length ||
    entries.some((entry, index) => entry.name !== expected[index] || !entry.isFile() || !lstatSync(join(inputRoot, entry.name)).isFile())
  ) invalid("Prepared input inventory is invalid.");
  const stdinPath = join(inputRoot, "stdin.txt");
  const schemaPath = join(inputRoot, "output-schema.json");
  if (
    !readFileSync(stdinPath).equals(descriptor.invocation_content.stdin_bytes) ||
    !readFileSync(schemaPath).equals(descriptor.invocation_content.output_schema_bytes)
  ) invalid("Prepared input bytes do not match the descriptor.");
  return {
    schema_version: descriptor.schema_version,
    unit_id: descriptor.unit_id,
    logical_unit_key: structuredClone(descriptor.logical_unit_key),
    kind: descriptor.kind,
    dependencies: structuredClone(descriptor.dependencies),
    invocation: {
      stdin_path: stdinPath,
      output_schema_path: schemaPath,
      cwd: inputRoot,
      cli_options: structuredClone(descriptor.invocation_content.cli_options),
    },
    behavior_projection: structuredClone(descriptor.behavior_projection),
    source_locator: structuredClone(descriptor.source_locator),
  };
}

function wave(number, kind, unitIds, concurrency) {
  return { wave: number, kind, unit_ids: [...unitIds], unit_count: unitIds.length, scheduling_waves: Math.ceil(unitIds.length / concurrency) };
}

function assertCanonicalArtifact(path, validator) {
  const bytes = readFileSync(path);
  const value = parseStrictJson(bytes, path);
  if (!Buffer.from(canonicalJson(value), "utf8").equals(bytes)) invalid("Published artifact is not canonical.");
  validator(value);
}

function writeExclusive(path, bytes) {
  mkdirSync(dirname(path), { recursive: true });
  let descriptor;
  try {
    descriptor = openSync(path, "wx");
    writeFileSync(descriptor, bytes);
  } catch (error) {
    throw new ArtifactError("CLI_PUBLICATION_REFUSED", "Refused to overwrite a CLI prepare artifact.", 3, { cause: error });
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function contained(root, child) {
  if (isAbsolute(child)) invalid("Prepared path must be relative.");
  const result = resolve(root, ...child.split("/"));
  const relation = relative(resolve(root), result);
  if (relation === "" || relation === ".." || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    invalid("Prepared path escapes its root.");
  }
  return result;
}

function decodeExactUtf8(bytes) {
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  if (!Buffer.from(text, "utf8").equals(bytes)) invalid("Descriptor bytes do not round-trip through UTF-8.");
  return text;
}

function assertRunId(value) {
  if (typeof value !== "string" || !/^run-[a-f0-9]{32}$/.test(value)) invalid("run_id is invalid.");
}

function assertPositiveSafe(value) {
  if (!Number.isSafeInteger(value) || value <= 0) invalid("Expected a positive safe integer.", 2);
}

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(`${label} must be an object.`);
  const actual = Object.keys(value).sort(compareStrings);
  const sorted = [...expected].sort(compareStrings);
  if (actual.length !== sorted.length || actual.some((key, index) => key !== sorted[index])) {
    invalid(`${label} fields are invalid.`);
  }
}

function invalid(message, exitCode = 3) {
  throw new ArtifactError("CLI_PLAN_INVALID", message, exitCode);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
