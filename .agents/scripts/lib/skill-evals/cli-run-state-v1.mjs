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
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  ArtifactError,
  canonicalJson,
  parseStrictJson,
  sha256Bytes,
  sha256Canonical,
} from "./artifact-schema-v1.mjs";
import {
  assertCliExecutionPlan,
  assertCliRun,
  publishCliPreparedRevision,
} from "./cli-execution-plan-v1.mjs";

const runStatuses = ["prepared", "running", "paused", "completed", "blocked"];
const runReasons = [
  null,
  "evaluator_dispatch_disabled",
  "retry_required",
  "attempt_budget_exhausted",
  "operational_condition",
  "integrity_failure",
  "outcome_unknown",
];
const unitStatuses = ["pending", "running", "succeeded", "failed", "outcome_unknown", "blocked"];

export function readCliRunStore({ runRoot, runId }) {
  assertRunId(runId);
  const runPath = join(runRoot, runId);
  const runStat = lstatSync(runPath);
  if (!runStat.isDirectory() || runStat.isSymbolicLink()) invalid("Run path must be a regular directory.");
  const marker = readCanonicalAbsolute(join(runPath, "run.json"), "run manifest");
  const revision = marker.value.current_revision;
  if (!Number.isSafeInteger(revision) || revision <= 0) invalid("Run revision is invalid.");
  const plan = readPlan(runPath, revision);
  const run = marker.value.schema_version === 1
    ? assertCliRun(marker.value, plan)
    : assertCliRunV2(marker.value, plan);
  return { runPath, run, plan };
}

export function assertCliAttemptRecord(value) {
  assertExactKeys(value, [
    "artifact_type", "attempt_id", "attempt_ordinal", "execution_result_path",
    "execution_result_sha256", "producer_revision", "recovery_reason", "result_origin",
    "run_id", "schema_version", "structured_output_path", "structured_output_sha256",
    "terminal_status", "unit_id",
  ], "attempt record");
  assertRunId(value.run_id);
  if (!/^(reader|evaluator)-[a-f0-9]{64}$/.test(value.unit_id ?? "")) invalid("Attempt unit_id is invalid.");
  assertAttemptIdentity(value.unit_id, value.attempt_id, value.attempt_ordinal);
  const prefix = `attempts/${value.unit_id}/${value.attempt_ordinal}`;
  if (
    value.schema_version !== 1 || value.artifact_type !== "cli_attempt_record" ||
    !Number.isSafeInteger(value.producer_revision) || value.producer_revision <= 0 ||
    !["succeeded", "failed", "outcome_unknown"].includes(value.terminal_status) ||
    !["worker_result", "recovered_missing_result"].includes(value.result_origin)
  ) invalid("Attempt record identity is invalid.");
  if (value.result_origin === "worker_result") {
    if (
      value.execution_result_path !== `${prefix}/result.json` ||
      !/^[a-f0-9]{64}$/.test(value.execution_result_sha256 ?? "") ||
      value.recovery_reason !== null
    ) invalid("Worker-backed attempt result relationship is invalid.");
  } else if (
    value.terminal_status !== "outcome_unknown" || value.execution_result_path !== null ||
    value.execution_result_sha256 !== null || value.recovery_reason !== "coordinator_restart_without_result"
  ) invalid("Recovery-only attempt relationship is invalid.");
  const succeeded = value.terminal_status === "succeeded";
  if (succeeded) {
    if (
      !isCanonicalRelativePath(value.structured_output_path) ||
      !value.structured_output_path.startsWith(`${prefix}/output/`) ||
      !/^[a-f0-9]{64}$/.test(value.structured_output_sha256 ?? "")
    ) invalid("Successful attempt output relationship is invalid.");
  } else if (value.structured_output_path !== null || value.structured_output_sha256 !== null) {
    invalid("Unsuccessful attempt must use null output path and hash.");
  }
  return value;
}

export function publishCliAttemptRecord({ runPath, record }) {
  assertCliAttemptRecord(record);
  const path = join(runPath, "attempts", record.unit_id, String(record.attempt_ordinal), "attempt.json");
  const bytes = Buffer.from(canonicalJson(record), "utf8");
  if (existsSync(path)) {
    if (!readFileSync(path).equals(bytes)) invalid("Existing attempt record does not exact-replay.");
  } else {
    writeExclusiveAbsolute(path, record);
  }
  return assertCliAttemptRecord(readCanonicalAbsolute(path, "attempt record").value);
}

export function assertCliRunV2(value, plan) {
  assertExactKeys(value, [
    "artifact_type", "current_revision", "mode", "process_settings", "run_id",
    "schema_version", "selected_scope", "status", "status_reason", "unit_ids", "workspace_id",
  ], "Stage 3 run manifest");
  const expectedIds = [...plan.reader_units, ...plan.evaluator_units].map((unit) => unit.unit_id);
  if (
    value.schema_version !== 2 || value.artifact_type !== "cli_run" ||
    value.run_id !== plan.run_id || value.workspace_id !== plan.workspace_id ||
    value.current_revision !== plan.revision || !runStatuses.includes(value.status) ||
    !runReasons.includes(value.status_reason) ||
    !["exact_current", "patch_check_mixed_revision"].includes(value.mode) ||
    canonicalJson(value.selected_scope) !== canonicalJson(plan.selected_scope) ||
    canonicalJson(value.process_settings) !== canonicalJson(plan.process_settings) ||
    canonicalJson(value.unit_ids) !== canonicalJson(expectedIds)
  ) invalid("Stage 3 run manifest relationships are invalid.");
  const reasonValid =
    (["prepared", "running", "completed"].includes(value.status) && value.status_reason === null) ||
    (value.status === "paused" && [
      "evaluator_dispatch_disabled", "retry_required", "attempt_budget_exhausted", "operational_condition",
    ].includes(value.status_reason)) ||
    (value.status === "blocked" && ["integrity_failure", "outcome_unknown"].includes(value.status_reason));
  if (!reasonValid) invalid("Stage 3 run status and reason are inconsistent.");
  return value;
}

export function createInitialUnitStates(plan) {
  assertCliExecutionPlan(plan);
  const readers = plan.reader_units.map((unit) => ({
    schema_version: 1,
    run_id: plan.run_id,
    unit_id: unit.unit_id,
    logical_unit_key: structuredClone(unit.logical_unit_key),
    current_revision: plan.revision,
    current_behavior_fingerprint: sha256Canonical(unit.behavior_projection),
    dependency_bindings: [],
    status: "pending",
    block_reason: null,
    active_attempt: null,
    accepted_attempt: null,
    attempt_summaries: [],
  }));
  const evaluators = plan.evaluator_units.map((unit) => ({
    schema_version: 1,
    run_id: plan.run_id,
    unit_id: unit.unit_id,
    logical_unit_key: structuredClone(unit.logical_unit_key),
    current_revision: plan.revision,
    current_behavior_fingerprint: null,
    dependency_bindings: null,
    status: "pending",
    block_reason: null,
    active_attempt: null,
    accepted_attempt: null,
    attempt_summaries: [],
  }));
  return [...readers, ...evaluators].map((state) => assertCliUnitState(state, plan));
}

export function assertCliUnitState(value, plan) {
  assertExactKeys(value, [
    "accepted_attempt", "active_attempt", "attempt_summaries", "block_reason",
    "current_behavior_fingerprint", "current_revision", "dependency_bindings",
    "logical_unit_key", "run_id", "schema_version", "status", "unit_id",
  ], "CLI unit state");
  const planUnit = [...plan.reader_units, ...plan.evaluator_units]
    .find((unit) => unit.unit_id === value.unit_id);
  if (
    value.schema_version !== 1 || value.run_id !== plan.run_id || !planUnit ||
    canonicalJson(value.logical_unit_key) !== canonicalJson(planUnit.logical_unit_key) ||
    value.current_revision !== plan.revision || !unitStatuses.includes(value.status) ||
    !Array.isArray(value.attempt_summaries)
  ) invalid("CLI unit state identity is invalid.");
  if (planUnit.kind === "reader") {
    if (
      value.current_behavior_fingerprint !== sha256Canonical(planUnit.behavior_projection) ||
      canonicalJson(value.dependency_bindings) !== canonicalJson([])
    ) invalid("Reader fingerprint or dependency bindings are invalid.");
  } else {
    if (
      (value.current_behavior_fingerprint === null) !== (value.dependency_bindings === null) ||
      (value.current_behavior_fingerprint !== null && !/^[a-f0-9]{64}$/.test(value.current_behavior_fingerprint))
    ) invalid("Evaluator fingerprint nullability is invalid.");
    if (value.dependency_bindings !== null) {
      if (!Array.isArray(value.dependency_bindings)) invalid("Evaluator dependency bindings must be an array.");
      const expected = planUnit.dependencies;
      value.dependency_bindings.forEach((binding, index) => {
        assertExactKeys(binding, [
          "producer_behavior_fingerprint", "source_role", "structured_output_sha256", "unit_id",
        ], "dependency binding");
        if (
          binding.source_role !== expected[index]?.source_role || binding.unit_id !== expected[index]?.unit_id ||
          !/^[a-f0-9]{64}$/.test(binding.producer_behavior_fingerprint ?? "") ||
          !/^[a-f0-9]{64}$/.test(binding.structured_output_sha256 ?? "")
        ) invalid("Evaluator dependency binding membership is invalid.");
      });
      if (value.dependency_bindings.length !== expected.length) invalid("Evaluator dependency binding count is invalid.");
    }
  }
  assertUnitStatusRelationships(value);
  assertAttemptSequence(value);
  return value;
}

export function upgradeCliRunToV2({
  runRoot,
  runId,
  afterBootstrap = null,
  mode = "exact_current",
  clearOperationalCondition = false,
}) {
  if (!["exact_current", "patch_check_mixed_revision"].includes(mode)) invalid("Requested run mode is invalid.");
  const loaded = readCliRunStore({ runRoot, runId });
  if (loaded.run.schema_version === 2) {
    try {
      readUnitStates(loaded.runPath, loaded.plan);
      return loaded;
    } catch (currentError) {
      if (loaded.run.mode === "patch_check_mixed_revision") {
        if (loaded.run.current_revision === 1) {
          const states = createInitialUnitStates(loaded.plan);
          publishUnitBootstrap(loaded.runPath, states, loaded.plan);
          return { ...loaded, states, recovered_mixed_transition: true };
        }
        const previousPlan = readPlan(loaded.runPath, loaded.run.current_revision - 1);
        if (
          previousPlan.revision !== loaded.run.current_revision - 1 || previousPlan.run_id !== runId ||
          canonicalJson(previousPlan.selected_scope) !== canonicalJson(loaded.run.selected_scope) ||
          canonicalJson(previousPlan.process_settings) !== canonicalJson(loaded.run.process_settings)
        ) throw currentError;
        assertPreparedRevision(loaded.runPath, loaded.plan);
        const states = recoverNextUnitStates(loaded.runPath, previousPlan, loaded.plan);
        return { ...loaded, states, recovered_mixed_transition: true };
      }
      const nextRevision = loaded.run.current_revision + 1;
      const nextPlanPath = join(loaded.runPath, "revisions", String(nextRevision), "execution-plan.json");
      if (!existsSync(nextPlanPath)) throw currentError;
      const nextPlan = readPlan(loaded.runPath, nextRevision);
      if (
        nextPlan.run_id !== runId ||
        canonicalJson(nextPlan.selected_scope) !== canonicalJson(loaded.run.selected_scope) ||
        canonicalJson(nextPlan.process_settings) !== canonicalJson(loaded.run.process_settings)
      ) throw currentError;
      assertPreparedRevision(loaded.runPath, nextPlan);
      const states = recoverNextUnitStates(loaded.runPath, loaded.plan, nextPlan);
      const previousRun = clearOperationalCondition
        ? { ...loaded.run, status: "prepared", status_reason: null }
        : loaded.run;
      const run = { ...nextRevisionRun(previousRun, nextPlan, states), mode };
      replaceCanonical(join(loaded.runPath, "run.json"), run);
      return { runPath: loaded.runPath, run, plan: nextPlan, states, recovered_next_revision: true };
    }
  }
  const states = createInitialUnitStates(loaded.plan);
  publishUnitBootstrap(loaded.runPath, states, loaded.plan);
  afterBootstrap?.();
  const run = {
    ...loaded.run,
    schema_version: 2,
    mode,
    status: states.length === 0 ? "completed" : "prepared",
    status_reason: null,
  };
  replaceCanonical(join(loaded.runPath, "run.json"), run);
  assertCliRunV2(readCanonicalAbsolute(join(loaded.runPath, "run.json"), "run manifest").value, loaded.plan);
  return { ...loaded, run, recovered_next_revision: false };
}

export function projectCliRunToV2({ runRoot, runId }) {
  const loaded = readCliRunStore({ runRoot, runId });
  if (loaded.run.schema_version === 1) {
    const states = createInitialUnitStates(loaded.plan);
    return {
      ...loaded,
      states,
      run: {
        ...loaded.run,
        schema_version: 2,
        mode: "exact_current",
        status: states.length === 0 ? "completed" : "prepared",
        status_reason: null,
      },
      projected_next_revision: false,
    };
  }
  try {
    return { ...loaded, states: readUnitStates(loaded.runPath, loaded.plan), projected_next_revision: false };
  } catch (currentError) {
    const nextRevision = loaded.run.current_revision + 1;
    const nextPlanPath = join(loaded.runPath, "revisions", String(nextRevision), "execution-plan.json");
    if (!existsSync(nextPlanPath)) throw currentError;
    const nextPlan = readPlan(loaded.runPath, nextRevision);
    if (
      nextPlan.run_id !== runId ||
      canonicalJson(nextPlan.selected_scope) !== canonicalJson(loaded.run.selected_scope) ||
      canonicalJson(nextPlan.process_settings) !== canonicalJson(loaded.run.process_settings)
    ) throw currentError;
    assertPreparedRevision(loaded.runPath, nextPlan);
    const states = projectNextUnitStates(loaded.runPath, loaded.plan, nextPlan);
    return {
      runPath: loaded.runPath,
      plan: nextPlan,
      states,
      run: nextRevisionRun(loaded.run, nextPlan, states),
      projected_next_revision: true,
    };
  }
}

export function publishNextCliRevision({
  runRoot,
  runId,
  plan,
  readerDescriptors,
  beforeMarkerReplace = null,
  afterUnitWrite = null,
}) {
  const loaded = upgradeCliRunToV2({ runRoot, runId });
  if (
    plan.schema_version !== 2 || plan.revision !== loaded.run.current_revision + 1 ||
    plan.run_id !== runId || canonicalJson(plan.selected_scope) !== canonicalJson(loaded.run.selected_scope) ||
    canonicalJson(plan.process_settings) !== canonicalJson(loaded.run.process_settings)
  ) invalid("Next revision does not preserve the frozen run scope and settings.");
  const previousStates = readUnitStates(loaded.runPath, loaded.plan);
  const nextById = new Map([...plan.reader_units, ...plan.evaluator_units].map((unit) => [unit.unit_id, unit]));
  if (previousStates.length !== nextById.size || previousStates.some((state) => !nextById.has(state.unit_id))) {
    invalid("Next revision unit membership does not match the frozen run scope.");
  }
  const nextStates = previousStates.map((state) => rebaseUnitState(state, plan, loaded.runPath));
  const previousById = new Map(previousStates.map((state) => [state.unit_id, state]));
  const affected = [];
  const invalidated = [];
  const reused = [];
  for (const state of nextStates) {
    const previous = previousById.get(state.unit_id);
    const classificationChanged = canonicalJson(unitClassification(previous)) !== canonicalJson(unitClassification(state));
    if (classificationChanged) {
      affected.push(state.unit_id);
    }
    if (
      (previous.status === "succeeded" && state.status === "pending") ||
      (state.logical_unit_key.kind === "evaluator" && classificationChanged)
    ) invalidated.push(state.unit_id);
    if (
      previous.logical_unit_key.kind === "reader" && previous.status === "succeeded" &&
      state.status === "succeeded" &&
      previous.current_behavior_fingerprint === state.current_behavior_fingerprint
    ) reused.push(state.unit_id);
  }
  publishCliPreparedRevision({ runPath: loaded.runPath, plan, readerDescriptors });
  for (const [index, state] of nextStates.entries()) {
    replaceCanonical(join(loaded.runPath, "units", `${state.unit_id}.json`), state);
    afterUnitWrite?.(index, state);
  }
  beforeMarkerReplace?.();
  const run = nextRevisionRun(loaded.run, plan, nextStates);
  replaceCanonical(join(loaded.runPath, "run.json"), run);
  assertCliRunV2(run, plan);
  return { runPath: loaded.runPath, run, plan, states: nextStates, affected, invalidated, reused };
}

export function unitClassification(state) {
  return {
    accepted_attempt: state.accepted_attempt,
    block_reason: state.block_reason,
    current_behavior_fingerprint: state.current_behavior_fingerprint,
    dependency_bindings: state.dependency_bindings,
    status: state.status,
  };
}

function recoverNextUnitStates(runPath, currentPlan, nextPlan) {
  const states = projectNextUnitStates(runPath, currentPlan, nextPlan);
  for (const state of states) replaceCanonical(join(runPath, "units", `${state.unit_id}.json`), state);
  return states;
}

function projectNextUnitStates(runPath, currentPlan, nextPlan) {
  const unitsPath = join(runPath, "units");
  const expectedNames = [...nextPlan.reader_units, ...nextPlan.evaluator_units]
    .map((unit) => `${unit.unit_id}.json`).sort(compareStrings);
  const entries = readdirSync(unitsPath, { withFileTypes: true }).sort((left, right) => compareStrings(left.name, right.name));
  if (
    canonicalJson(entries.map((entry) => entry.name)) !== canonicalJson(expectedNames) ||
    entries.some((entry) => !entry.isFile() || entry.isSymbolicLink())
  ) invalid("Pending next-revision unit inventory is invalid.");
  const states = entries.map((entry) => {
    const value = readCanonicalAbsolute(join(unitsPath, entry.name), "unit state").value;
    try {
      return assertCliUnitState(value, nextPlan);
    } catch {
      const current = assertCliUnitState(value, currentPlan);
      return rebaseUnitState(current, nextPlan, runPath);
    }
  });
  return states;
}

function rebaseUnitState(state, plan, runPath = null) {
  const unit = [...plan.reader_units, ...plan.evaluator_units].find((item) => item.unit_id === state.unit_id);
  if (!unit) invalid("Next revision is missing a prior logical unit.");
  const reader = unit.kind === "reader";
  let rebased = {
    ...state,
    current_revision: plan.revision,
    current_behavior_fingerprint: reader ? sha256Canonical(unit.behavior_projection) : null,
    dependency_bindings: reader ? [] : null,
    status: state.attempt_summaries.length === 0 ? "pending" : state.status,
  };
  if (reader && state.status === "succeeded" && runPath !== null) {
    const evidence = resolveAcceptedReaderEvidence({
      runRoot: runPath,
      runId: plan.run_id,
      unitState: state,
      sourceRole: state.logical_unit_key.source_role,
    });
    if (evidence.producer_behavior_fingerprint !== sha256Canonical(unit.behavior_projection)) {
      rebased = { ...rebased, status: "pending", accepted_attempt: null };
    }
  }
  return assertCliUnitState(rebased, plan);
}

function nextRevisionRun(previousRun, plan, states) {
  const [status, statusReason] = deriveRevisionRunStatus(previousRun, plan, states);
  return {
    ...previousRun,
    workspace_id: plan.workspace_id,
    current_revision: plan.revision,
    mode: "exact_current",
    unit_ids: [...plan.reader_units, ...plan.evaluator_units].map((unit) => unit.unit_id),
    status,
    status_reason: statusReason,
  };
}

function deriveRevisionRunStatus(previousRun, plan, states) {
  if (states.some((state) => state.status === "blocked")) return ["blocked", "integrity_failure"];
  if (previousRun.status_reason === "operational_condition") return ["paused", "operational_condition"];
  if (states.some((state) => state.status === "running")) return ["running", null];
  if (states.some((state) =>
    state.logical_unit_key.kind === "reader" && state.status === "pending" &&
    state.attempt_summaries.length < plan.process_settings.max_attempts)) return ["prepared", null];
  if (states.some((state) => state.status === "outcome_unknown")) return ["blocked", "outcome_unknown"];
  if (states.some((state) =>
    state.status === "failed" && state.attempt_summaries.length < plan.process_settings.max_attempts)) {
    return ["paused", "retry_required"];
  }
  if (states.some((state) =>
    state.logical_unit_key.kind === "reader" && ["pending", "failed"].includes(state.status) &&
    state.attempt_summaries.length >= plan.process_settings.max_attempts)) {
    return ["paused", "attempt_budget_exhausted"];
  }
  const byId = new Map(states.map((state) => [state.unit_id, state]));
  if (plan.evaluator_units.some((unit) =>
    byId.get(unit.unit_id)?.status !== "succeeded" &&
    unit.dependencies.every((dependency) => byId.get(dependency.unit_id)?.status === "succeeded"))) {
    return ["paused", "evaluator_dispatch_disabled"];
  }
  return ["completed", null];
}

export function readUnitStates(runPath, plan) {
  const unitsPath = join(runPath, "units");
  if (!existsSync(unitsPath) || !lstatSync(unitsPath).isDirectory()) invalid("Unit state directory is missing.");
  const expectedNames = [...plan.reader_units, ...plan.evaluator_units]
    .map((unit) => `${unit.unit_id}.json`).sort(compareStrings);
  const entries = readdirSync(unitsPath, { withFileTypes: true }).sort((a, b) => compareStrings(a.name, b.name));
  if (
    canonicalJson(entries.map((entry) => entry.name)) !== canonicalJson(expectedNames) ||
    entries.some((entry) => !entry.isFile() || lstatSync(join(unitsPath, entry.name)).isSymbolicLink())
  ) invalid("Unit state inventory is invalid.");
  return entries.map((entry) =>
    assertCliUnitState(readCanonicalAbsolute(join(unitsPath, entry.name), "unit state").value, plan));
}

export function writeCliUnitState({ runPath, plan, state }) {
  assertCliUnitState(state, plan);
  replaceCanonical(join(runPath, "units", `${state.unit_id}.json`), state);
  return state;
}

export function writeCliRunV2({ runPath, plan, run }) {
  assertCliRunV2(run, plan);
  replaceCanonical(join(runPath, "run.json"), run);
  return run;
}

export function reconcileActiveCliAttempt({ runPath, plan, state }) {
  assertCliUnitState(state, plan);
  if (state.status !== "running" || state.active_attempt === null) return state;
  try {
    const projected = projectActiveAttempt(runPath, state);
    if (!projected.recordExists) publishCliAttemptRecord({ runPath, record: projected.record });
    return writeCliUnitState({ runPath, plan, state: projected.state });
  } catch (error) {
    const blocked = { ...state, status: "blocked", block_reason: "integrity_failure" };
    writeCliUnitState({ runPath, plan, state: blocked });
    throw error;
  }
}

export function projectActiveCliAttemptState({ runPath, plan, state }) {
  assertCliUnitState(state, plan);
  if (state.status !== "running" || state.active_attempt === null) return state;
  return assertCliUnitState(projectActiveAttempt(runPath, state).state, plan);
}

export function reconcileLateCliAttemptResult({ runPath, plan, state }) {
  assertCliUnitState(state, plan);
  const recovery = state.attempt_summaries.findLast((summary) =>
    summary.result_origin === "recovered_missing_result");
  if (recovery === undefined) return state;
  const resultPath = join(runPath, "attempts", state.unit_id, String(recovery.attempt_ordinal), "result.json");
  if (!existsSync(resultPath)) return state;
  const blocked = { ...state, status: "blocked", block_reason: "integrity_failure", accepted_attempt: null };
  writeCliUnitState({ runPath, plan, state: blocked });
  invalid("Recovery-only attempt has a contradictory late result.");
}

export function hasContradictoryLateCliResult({ runPath, plan, state }) {
  assertCliUnitState(state, plan);
  const recovery = state.attempt_summaries.findLast((summary) =>
    summary.result_origin === "recovered_missing_result");
  if (recovery === undefined) return false;
  return existsSync(join(runPath, "attempts", state.unit_id, String(recovery.attempt_ordinal), "result.json"));
}

export function resolveAcceptedReaderEvidence({ runRoot, runId, unitState, sourceRole }) {
  assertRunId(runId);
  if (
    !unitState || unitState.run_id !== runId || unitState.status !== "succeeded" ||
    !/^reader-[a-f0-9]{64}$/.test(unitState.unit_id ?? "")
  ) {
    invalid("Accepted reader unit state is invalid.");
  }
  if (!/^(candidate|baseline)$/.test(sourceRole ?? "")) invalid("Accepted source role is invalid.");
  const accepted = unitState.accepted_attempt;
  assertExactKeys(accepted, ["attempt_id", "attempt_record_path", "attempt_record_sha256"], "accepted attempt");
  assertHash(accepted.attempt_record_sha256, "accepted attempt record hash");

  const recordFile = readCanonicalFile(
    runRoot,
    accepted.attempt_record_path,
    `attempts/${unitState.unit_id}/`,
    "accepted attempt record",
  );
  if (sha256Bytes(recordFile.bytes) !== accepted.attempt_record_sha256) {
    invalid("Accepted attempt record hash does not match.");
  }
  const record = recordFile.value;
  assertExactKeys(record, [
    "artifact_type", "attempt_id", "attempt_ordinal", "execution_result_path",
    "execution_result_sha256", "producer_revision", "recovery_reason", "result_origin",
    "run_id", "schema_version", "structured_output_path", "structured_output_sha256",
    "terminal_status", "unit_id",
  ], "attempt record");
  const expectedAttemptId = `${unitState.unit_id}-attempt-${record.attempt_ordinal}`;
  const expectedRecordPath = `attempts/${unitState.unit_id}/${record.attempt_ordinal}/attempt.json`;
  const expectedResultPath = `attempts/${unitState.unit_id}/${record.attempt_ordinal}/result.json`;
  if (
    record.schema_version !== 1 || record.artifact_type !== "cli_attempt_record" ||
    record.run_id !== runId || record.unit_id !== unitState.unit_id ||
    !Number.isSafeInteger(record.attempt_ordinal) || record.attempt_ordinal <= 0 ||
    record.attempt_id !== expectedAttemptId || accepted.attempt_id !== expectedAttemptId ||
    accepted.attempt_record_path !== expectedRecordPath ||
    record.execution_result_path !== expectedResultPath ||
    !Number.isSafeInteger(record.producer_revision) || record.producer_revision <= 0 ||
    record.terminal_status !== "succeeded" || record.result_origin !== "worker_result" ||
    record.recovery_reason !== null
  ) invalid("Accepted attempt record relationship is invalid.");
  assertHash(record.execution_result_sha256, "execution result hash");
  assertHash(record.structured_output_sha256, "structured output hash");

  const attemptPrefix = `attempts/${unitState.unit_id}/${record.attempt_ordinal}/`;
  const resultFile = readCanonicalFile(
    runRoot,
    record.execution_result_path,
    attemptPrefix,
    "execution result",
  );
  if (sha256Bytes(resultFile.bytes) !== record.execution_result_sha256) {
    invalid("Execution result hash does not match its attempt record.");
  }
  const result = resultFile.value;
  assertExactKeys(result, [
    "attempt_id", "exit_code", "failure", "process_metadata", "schema_version",
    "structured_output_path", "structured_output_sha256", "terminal_status", "unit_id",
  ], "execution result");
  const outputFile = readContainedFile(
    runRoot,
    record.structured_output_path,
    `${attemptPrefix}output/`,
    "structured output",
  );
  if (
    result.schema_version !== 1 || result.unit_id !== unitState.unit_id ||
    result.attempt_id !== record.attempt_id || result.terminal_status !== "succeeded" ||
    result.exit_code !== 0 || result.failure !== null ||
    result.structured_output_sha256 !== record.structured_output_sha256 ||
    normalizeWorkerOutputPath(runRoot, result.structured_output_path) !== outputFile.path ||
    sha256Bytes(outputFile.bytes) !== record.structured_output_sha256
  ) invalid("Execution result does not match its accepted attempt record.");

  const planRelative = `revisions/${record.producer_revision}/execution-plan.json`;
  const planFile = readCanonicalFile(runRoot, planRelative, `revisions/${record.producer_revision}/`, "producing execution plan");
  const plan = assertCliExecutionPlan(planFile.value);
  if (plan.run_id !== runId || plan.revision !== record.producer_revision) {
    invalid("Producing execution plan relationship is invalid.");
  }
  const readers = plan.reader_units.filter((descriptor) => descriptor.unit_id === unitState.unit_id);
  if (readers.length !== 1 || readers[0].logical_unit_key.source_role !== sourceRole) {
    invalid("Producing reader descriptor membership is invalid.");
  }
  const descriptor = readers[0];
  const producerLocator = {
    workspace_id: descriptor.source_locator.workspace_id,
    variant_id: descriptor.source_locator.variant_id,
    execution_context_hash: descriptor.source_locator.execution_context_hash,
  };
  return {
    source_role: sourceRole,
    unit_id: unitState.unit_id,
    attempt_id: record.attempt_id,
    producer_revision: record.producer_revision,
    producer_behavior_fingerprint: sha256Canonical(descriptor.behavior_projection),
    producer_locator: producerLocator,
    terminal_status: "succeeded",
    structured_output_path: record.structured_output_path,
    structured_output_sha256: record.structured_output_sha256,
    observation_bytes: outputFile.bytes,
  };
}

function assertActiveRecordRelationship(state, record) {
  const active = state.active_attempt;
  if (
    record.run_id !== state.run_id || record.unit_id !== state.unit_id ||
    record.attempt_id !== active.attempt_id || record.attempt_ordinal !== active.attempt_ordinal ||
    record.producer_revision !== active.producer_revision ||
    record.execution_result_path !== (record.result_origin === "worker_result" ? active.execution_result_path : null)
  ) invalid("Active attempt record does not match its persisted intent.");
}

function projectActiveAttempt(runPath, state) {
  const active = state.active_attempt;
  const prefix = `attempts/${state.unit_id}/${active.attempt_ordinal}`;
  const recordPath = join(runPath, ...active.attempt_record_path.split("/"));
  const resultPath = join(runPath, ...active.execution_result_path.split("/"));
  const recordExists = existsSync(recordPath);
  let record;
  let recordBytes;
  if (recordExists) {
    const file = readCanonicalFile(runPath, active.attempt_record_path, `${prefix}/`, "active attempt record");
    record = assertCliAttemptRecord(file.value);
    recordBytes = file.bytes;
    assertActiveRecordRelationship(state, record);
    if (record.result_origin === "worker_result") validateWorkerResult(runPath, state, record);
    else if (existsSync(resultPath)) invalid("Recovery-only attempt has a contradictory late result.");
  } else if (existsSync(resultPath)) {
    const result = validateWorkerResult(runPath, state, null);
    record = workerAttemptRecord(state, result.file.bytes, result.value, result.outputRelative);
    recordBytes = Buffer.from(canonicalJson(record), "utf8");
  } else {
    record = {
      schema_version: 1,
      artifact_type: "cli_attempt_record",
      run_id: state.run_id,
      unit_id: state.unit_id,
      attempt_id: active.attempt_id,
      attempt_ordinal: active.attempt_ordinal,
      producer_revision: active.producer_revision,
      terminal_status: "outcome_unknown",
      result_origin: "recovered_missing_result",
      execution_result_path: null,
      execution_result_sha256: null,
      structured_output_path: null,
      structured_output_sha256: null,
      recovery_reason: "coordinator_restart_without_result",
    };
    recordBytes = Buffer.from(canonicalJson(record), "utf8");
  }
  const summary = {
    attempt_id: record.attempt_id,
    attempt_ordinal: record.attempt_ordinal,
    producer_revision: record.producer_revision,
    terminal_status: record.terminal_status,
    result_origin: record.result_origin,
    attempt_record_path: active.attempt_record_path,
    attempt_record_sha256: sha256Bytes(recordBytes),
  };
  return {
    record,
    recordExists,
    state: {
      ...state,
      status: record.terminal_status,
      block_reason: null,
      active_attempt: null,
      accepted_attempt: record.terminal_status === "succeeded"
        ? {
            attempt_id: record.attempt_id,
            attempt_record_path: active.attempt_record_path,
            attempt_record_sha256: summary.attempt_record_sha256,
          }
        : null,
      attempt_summaries: [...state.attempt_summaries, summary],
    },
  };
}

function validateWorkerResult(runPath, state, record) {
  const active = state.active_attempt;
  const prefix = `attempts/${state.unit_id}/${active.attempt_ordinal}`;
  const file = readCanonicalFile(runPath, active.execution_result_path, `${prefix}/`, "active execution result");
  const value = file.value;
  assertExactKeys(value, [
    "attempt_id", "exit_code", "failure", "process_metadata", "schema_version",
    "structured_output_path", "structured_output_sha256", "terminal_status", "unit_id",
  ], "execution result");
  if (
    value.schema_version !== 1 || value.unit_id !== state.unit_id || value.attempt_id !== active.attempt_id ||
    !["succeeded", "failed", "outcome_unknown"].includes(value.terminal_status) ||
    !value.process_metadata || typeof value.process_metadata !== "object" || Array.isArray(value.process_metadata)
  ) invalid("Execution result identity is invalid.");
  let outputRelative = null;
  if (value.terminal_status === "succeeded") {
    if (value.exit_code !== 0 || value.failure !== null) invalid("Successful execution result is inconsistent.");
    assertHash(value.structured_output_sha256, "execution output hash");
    const absolute = normalizeWorkerOutputPath(runPath, value.structured_output_path);
    outputRelative = relative(resolve(runPath), absolute).replaceAll("\\", "/");
    const output = readContainedFile(runPath, outputRelative, `${prefix}/output/`, "active structured output");
    if (sha256Bytes(output.bytes) !== value.structured_output_sha256) invalid("Execution output hash does not match.");
  } else if (
    value.structured_output_path !== null || value.structured_output_sha256 !== null ||
    !value.failure || typeof value.failure !== "object" || Array.isArray(value.failure)
  ) invalid("Unsuccessful execution result is inconsistent.");
  if (record !== null && (
    record.terminal_status !== value.terminal_status ||
    record.execution_result_sha256 !== sha256Bytes(file.bytes) ||
    record.structured_output_path !== outputRelative ||
    record.structured_output_sha256 !== value.structured_output_sha256
  )) invalid("Execution result does not match its active attempt record.");
  return { file, value, outputRelative };
}

function workerAttemptRecord(state, resultBytes, result, outputRelative) {
  const active = state.active_attempt;
  return {
    schema_version: 1,
    artifact_type: "cli_attempt_record",
    run_id: state.run_id,
    unit_id: state.unit_id,
    attempt_id: active.attempt_id,
    attempt_ordinal: active.attempt_ordinal,
    producer_revision: active.producer_revision,
    terminal_status: result.terminal_status,
    result_origin: "worker_result",
    execution_result_path: active.execution_result_path,
    execution_result_sha256: sha256Bytes(resultBytes),
    structured_output_path: outputRelative,
    structured_output_sha256: result.structured_output_sha256,
    recovery_reason: null,
  };
}

function assertUnitStatusRelationships(value) {
  if (value.status === "running") {
    if (value.active_attempt === null) invalid("Running unit requires active_attempt.");
  } else if (value.status === "blocked") {
    if (value.block_reason !== "integrity_failure") invalid("Blocked unit requires integrity_failure.");
  } else if (value.active_attempt !== null) {
    invalid("Only running or integrity-blocked units may retain active_attempt.");
  }
  if (value.status !== "blocked" && value.block_reason !== null) invalid("Non-blocked unit cannot persist a block reason.");
  if ((value.status === "succeeded") !== (value.accepted_attempt !== null)) {
    invalid("Accepted attempt must exist exactly for succeeded unit state.");
  }
  if (value.active_attempt !== null) {
    assertExactKeys(value.active_attempt, [
      "attempt_id", "attempt_ordinal", "attempt_record_path", "execution_result_path",
      "output_directory_path", "producer_revision",
    ], "active attempt");
    assertAttemptIdentity(value.unit_id, value.active_attempt.attempt_id, value.active_attempt.attempt_ordinal);
    const prefix = `attempts/${value.unit_id}/${value.active_attempt.attempt_ordinal}`;
    if (
      value.active_attempt.producer_revision !== value.current_revision ||
      value.active_attempt.attempt_record_path !== `${prefix}/attempt.json` ||
      value.active_attempt.execution_result_path !== `${prefix}/result.json` ||
      value.active_attempt.output_directory_path !== `${prefix}/output`
    ) invalid("Active attempt paths or producer revision are invalid.");
  }
  if (value.accepted_attempt !== null) {
    assertExactKeys(value.accepted_attempt, [
      "attempt_id", "attempt_record_path", "attempt_record_sha256",
    ], "accepted attempt");
    assertHash(value.accepted_attempt.attempt_record_sha256, "accepted attempt record hash");
  }
}

function assertAttemptSequence(value) {
  value.attempt_summaries.forEach((summary, index) => {
    assertExactKeys(summary, [
      "attempt_id", "attempt_ordinal", "attempt_record_path", "attempt_record_sha256",
      "producer_revision", "result_origin", "terminal_status",
    ], "attempt summary");
    assertAttemptIdentity(value.unit_id, summary.attempt_id, summary.attempt_ordinal);
    if (
      summary.attempt_ordinal !== index + 1 ||
      !Number.isSafeInteger(summary.producer_revision) || summary.producer_revision <= 0 ||
      summary.producer_revision > value.current_revision ||
      !["succeeded", "failed", "outcome_unknown"].includes(summary.terminal_status) ||
      !["worker_result", "recovered_missing_result"].includes(summary.result_origin) ||
      (summary.result_origin === "recovered_missing_result" && summary.terminal_status !== "outcome_unknown")
    ) invalid("Attempt summary sequence is invalid.");
    assertHash(summary.attempt_record_sha256, "attempt summary record hash");
    if (summary.attempt_record_path !== `attempts/${value.unit_id}/${summary.attempt_ordinal}/attempt.json`) {
      invalid("Attempt summary record path is invalid.");
    }
  });
  if (value.active_attempt !== null && value.active_attempt.attempt_ordinal !== value.attempt_summaries.length + 1) {
    invalid("Active attempt ordinal is not contiguous.");
  }
  if (value.accepted_attempt !== null) {
    const accepted = value.attempt_summaries.find((summary) => summary.attempt_id === value.accepted_attempt.attempt_id);
    if (
      !accepted || accepted.terminal_status !== "succeeded" ||
      accepted.attempt_record_path !== value.accepted_attempt.attempt_record_path ||
      accepted.attempt_record_sha256 !== value.accepted_attempt.attempt_record_sha256
    ) invalid("Accepted attempt does not match an exact successful summary.");
  }
}

function assertAttemptIdentity(unitId, attemptId, ordinal) {
  if (!Number.isSafeInteger(ordinal) || ordinal <= 0 || attemptId !== `${unitId}-attempt-${ordinal}`) {
    invalid("Attempt identity is invalid.");
  }
}

function publishUnitBootstrap(runPath, states, plan) {
  const target = join(runPath, "units");
  if (existsSync(target)) {
    const actual = readUnitStates(runPath, plan);
    const expectedStates = [...states].sort((left, right) => compareStrings(left.unit_id, right.unit_id));
    if (canonicalJson(actual) !== canonicalJson(expectedStates)) invalid("Existing unit bootstrap does not exact-replay.");
    return;
  }
  const staging = join(runPath, `.units-stage-${randomUUID()}`);
  mkdirSync(staging);
  for (const state of states) writeExclusiveAbsolute(join(staging, `${state.unit_id}.json`), state);
  const names = readdirSync(staging).sort(compareStrings);
  const expected = states.map((state) => `${state.unit_id}.json`).sort(compareStrings);
  if (canonicalJson(names) !== canonicalJson(expected)) invalid("Unit bootstrap staging inventory is invalid.");
  renameSync(staging, target);
  readUnitStates(runPath, plan);
}

function readPlan(runPath, revision) {
  const relativePath = `revisions/${revision}/execution-plan.json`;
  const value = readCanonicalFile(runPath, relativePath, `revisions/${revision}/`, "execution plan").value;
  return assertCliExecutionPlan(value);
}

function assertPreparedRevision(runPath, plan) {
  for (const unit of plan.reader_units) {
    const prefix = `revisions/${plan.revision}/prepared/${unit.unit_id}/input/`;
    const stdin = readContainedFile(runPath, unit.prepared_input.stdin_path, prefix, "prepared stdin");
    const schema = readContainedFile(runPath, unit.prepared_input.output_schema_path, prefix, "prepared output schema");
    if (
      !stdin.bytes.equals(Buffer.from(unit.invocation_content.stdin_utf8, "utf8")) ||
      !schema.bytes.equals(Buffer.from(unit.invocation_content.output_schema_utf8, "utf8")) ||
      unit.prepared_input.cwd !== prefix.slice(0, -1)
    ) invalid("Prepared revision bytes or paths do not match its plan.");
    const inputPath = join(runPath, ...prefix.slice(0, -1).split("/"));
    const entries = readdirSync(inputPath, { withFileTypes: true })
      .sort((left, right) => compareStrings(left.name, right.name));
    if (
      canonicalJson(entries.map((entry) => entry.name)) !== canonicalJson(["output-schema.json", "stdin.txt"]) ||
      entries.some((entry) => !entry.isFile() || entry.isSymbolicLink())
    ) invalid("Prepared revision inventory is invalid.");
  }
}

function readCanonicalAbsolute(path, label) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) invalid(`${label} must be a regular file.`);
  const bytes = readFileSync(path);
  const value = parseStrictJson(bytes, label);
  if (!Buffer.from(canonicalJson(value), "utf8").equals(bytes)) invalid(`${label} must use canonical JSON bytes.`);
  return { bytes, value };
}

function replaceCanonical(path, value) {
  const temp = join(dirname(path), `.tmp-${randomUUID()}`);
  writeExclusiveAbsolute(temp, value);
  renameSync(temp, path);
}

function writeExclusiveAbsolute(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  let descriptor;
  try {
    descriptor = openSync(path, "wx");
    writeFileSync(descriptor, Buffer.from(canonicalJson(value), "utf8"));
  } catch (error) {
    throw new ArtifactError("CLI_STATE_PUBLICATION_REFUSED", "Refused to overwrite CLI state.", 3, { cause: error });
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function readCanonicalFile(root, relativePath, requiredPrefix, label) {
  const file = readContainedFile(root, relativePath, requiredPrefix, label);
  const value = parseStrictJson(file.bytes, label);
  if (!Buffer.from(canonicalJson(value), "utf8").equals(file.bytes)) {
    invalid(`${label} must use canonical JSON bytes.`);
  }
  return { ...file, value };
}

function readContainedFile(root, relativePath, requiredPrefix, label) {
  if (!isCanonicalRelativePath(relativePath) || !relativePath.startsWith(requiredPrefix)) {
    invalid(`${label} path is not canonical or contained.`);
  }
  const rootPath = resolve(root);
  const path = resolve(rootPath, ...relativePath.split("/"));
  const relation = relative(rootPath, path);
  if (relation === "" || relation === ".." || relation.startsWith(`..${sep}`) || isAbsolute(relation)) {
    invalid(`${label} path escapes the run root.`);
  }
  let cursor = rootPath;
  const segments = relativePath.split("/");
  segments.forEach((segment, index) => {
    cursor = join(cursor, segment);
    const stat = lstatSync(cursor);
    if (stat.isSymbolicLink()) invalid(`${label} path traverses a symbolic link.`);
    if (index < segments.length - 1 && !stat.isDirectory()) {
      invalid(`${label} path traverses a non-directory entry.`);
    }
    if (index === segments.length - 1 && !stat.isFile()) {
      invalid(`${label} must be a regular file.`);
    }
  });
  return { path, bytes: readFileSync(path) };
}

function normalizeWorkerOutputPath(root, value) {
  if (typeof value !== "string" || value.length === 0) invalid("Worker output path is invalid.");
  return isAbsolute(value) ? resolve(value) : resolve(root, ...value.split("/"));
}

function isCanonicalRelativePath(value) {
  return typeof value === "string" && value.length > 0 && !isAbsolute(value) &&
    !value.includes("\\") && !value.includes("\0") &&
    value.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

function assertRunId(value) {
  if (typeof value !== "string" || !/^run-[a-f0-9]{32}$/.test(value)) invalid("run_id is invalid.");
}

function assertHash(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) invalid(`${label} is invalid.`);
}

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(`${label} must be an object.`);
  const actual = Object.keys(value).sort(compareStrings);
  const sorted = [...expected].sort(compareStrings);
  if (actual.length !== sorted.length || actual.some((key, index) => key !== sorted[index])) {
    invalid(`${label} fields are invalid.`);
  }
}

function invalid(message) {
  throw new ArtifactError("CLI_STATE_INVALID", message, 3);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
