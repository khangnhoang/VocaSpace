import { existsSync, mkdirSync, openSync, closeSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { availableParallelism } from "node:os";
import { pathToFileURL } from "node:url";
import { ArtifactError, canonicalJson, sha256Canonical } from "./lib/skill-evals/artifact-schema-v1.mjs";
import { prepareSkillEvalWorkspace } from "./run-skill-evals.mjs";
import {
  createCommandSummary,
  createExecutionId,
  defaultConcurrency,
  executePreparedUnit,
  loadAllSelectedWorkspace,
  loadSelectedWorkspace,
  materializePreparedUnits,
  parseUnitSelector,
  preflightCodexCli,
  runBoundedPool,
} from "./lib/skill-evals/codex-cli-runner-v1.mjs";
import {
  assertCliPrepareCommandError,
  assertCliPrepareResult,
  compileCliPlanInputs,
  compileRevisionCliPlan,
  compileStaticCliPlan,
  createCliRunId,
  fixedCliRunRoot,
  publishCliPreparedRun,
  materializePreparedUnitDescriptor,
} from "./lib/skill-evals/cli-execution-plan-v1.mjs";
import { compileEvaluatorPreparedUnitDescriptor } from "./lib/skill-evals/cli-evaluator-proposal-v1.mjs";
import { assessAcceptedReaderReuse } from "./lib/skill-evals/cli-impact-v1.mjs";
import { createCliEvaluationReport } from "./lib/skill-evals/cli-evaluation-report-v1.mjs";
import {
  createInitialUnitStates,
  deriveRevisionRunStatus,
  hasContradictoryLateCliResult,
  projectCliRunToV2,
  projectActiveCliAttemptState,
  publishNextCliRevision,
  readCliRunStore,
  readUnitStates,
  reconcileActiveCliAttempt,
  reconcileLateCliAttemptResult,
  resolveAcceptedReaderEvidence,
  resolveAcceptedEvaluatorEvidence,
  unitClassification,
  upgradeCliRunToV2,
  writeCliRunV2,
  writeCliUnitState,
} from "./lib/skill-evals/cli-run-state-v1.mjs";

const usage = `Usage:
  node .agents/scripts/run-skill-eval-cli.mjs prepare \\
    --skill <kebab-case-skill> --isolation synthetic \\
    (--candidate-current-tree | --candidate-ref <ref>) \\
    (--baseline-ref <ref> | --no-baseline) \\
    [--concurrency <positive-safe-integer>] \\
    [--max-concurrency <positive-safe-integer>] \\
    [--max-attempts <positive-safe-integer>] \\
    [--target-minutes <positive-finite-number>]

  node .agents/scripts/run-skill-eval-cli.mjs prepare --run <run-[a-f0-9]{32}> \\
    --skill <kebab-case-skill> --isolation synthetic \\
    (--candidate-current-tree | --candidate-ref <ref>) \\
    (--baseline-ref <ref> | --no-baseline)

  node .agents/scripts/run-skill-eval-cli.mjs run --run <run-[a-f0-9]{32}>
  node .agents/scripts/run-skill-eval-cli.mjs status --run <run-[a-f0-9]{32}>
  node .agents/scripts/run-skill-eval-cli.mjs report --run <run-[a-f0-9]{32}>
  node .agents/scripts/run-skill-eval-cli.mjs resume --run <run-[a-f0-9]{32}>
  node .agents/scripts/run-skill-eval-cli.mjs retry --run <run-[a-f0-9]{32}> \\
    --unit <reader|evaluator-[a-f0-9]{64}> [--unit <...>]
  node .agents/scripts/run-skill-eval-cli.mjs patch-check --run <run-[a-f0-9]{32}> \\
    --unit <reader|evaluator-[a-f0-9]{64}> [--unit <...>]

  node .agents/scripts/run-skill-eval-cli.mjs execute-prepared \\
    --workspace <ws-[a-f0-9]{32}> \\
    --unit <candidate|baseline>:<regression|routing|fresh-reader>:<case_id> \\
    [--unit <...>] [--concurrency <positive-integer>]

prepare creates revision 1; prepare --run publishes the same-scope next revision.
Both commands execute 0 reader/evaluator calls. Execution uses bounded reader/evaluator dependency waves.

execute-prepared consumes an already prepared v1 workspace and executes reader units only.
Default concurrency is 4. Stage 1 has no durable reuse, retry, evaluator, or report.
Real execution may consume model quota.`;

export async function main(args = process.argv.slice(2), dependencies = {}) {
  if (args.length === 1 && args[0] === "--help") {
    writeOutput(dependencies.stdout, process.stdout, `${usage}\n`);
    return 0;
  }
  const parsed = parseCommand(args);
  if (!parsed) {
    writeOutput(dependencies.stderr, process.stderr, `${usage}\n`);
    return 2;
  }

  if (parsed.command === "prepare") {
    return runPrepare(parsed, dependencies);
  }
  if (parsed.command === "report") return runReport(parsed, dependencies);
  if (["run", "status", "resume", "retry", "patch-check"].includes(parsed.command)) {
    return runStage3Command(parsed, dependencies);
  }

  try {
    const workspace = loadSelectedWorkspace(parsed.workspaceId, parsed.selectors);
    assertNotInterrupted(dependencies.signal);
    const cliVersion = await preflightCodexCli({
      executable: dependencies.executable,
      prefixArgs: dependencies.prefixArgs,
    });
    assertNotInterrupted(dependencies.signal);
    const executionId = dependencies.executionId ?? createExecutionId();
    const preparedUnits = materializePreparedUnits({
      executionId,
      selected: workspace.selected,
      workspacePath: workspace.workspacePath,
    });
    const effectiveConcurrency = Math.min(parsed.concurrency, preparedUnits.length);
    const requests = preparedUnits.map((preparedUnit) => ({
      prepared_unit: preparedUnit,
      attempt_id: `${preparedUnit.unit_id}-attempt-1`,
      attempt_ordinal: 1,
      output_path: join(
        workspace.workspacePath,
        "cli-executions",
        executionId,
        "units",
        preparedUnit.unit_id,
        "attempts",
        "1",
        "output",
      ),
    }));
    const results = await runBoundedPool(requests, effectiveConcurrency, (request) =>
      executePreparedUnit(request, {
        executable: dependencies.executable,
        prefixArgs: dependencies.prefixArgs,
        timeoutMs: dependencies.timeoutMs,
        terminationGraceMs: dependencies.terminationGraceMs,
        hardKillGraceMs: dependencies.hardKillGraceMs,
        signal: dependencies.signal,
        cliVersion,
      }),
    );
    const summary = createCommandSummary({
      executionId,
      workspaceId: parsed.workspaceId,
      requestedConcurrency: parsed.concurrency,
      effectiveConcurrency,
      preparedUnits,
      results,
    });
    const bytes = Buffer.from(canonicalJson(summary), "utf8");
    writeExclusive(
      join(workspace.workspacePath, "cli-executions", executionId, "summary.json"),
      bytes,
    );
    writeOutput(dependencies.stdout, process.stdout, bytes);
    return summary.status === "succeeded" ? 0 : 1;
  } catch (error) {
    const normalized =
      error instanceof ArtifactError
        ? error
        : new ArtifactError(
            "CLI_EXECUTION_OPERATION_FAILED",
            "Stage 1 CLI execution failed before producing a trustworthy result set.",
            3,
          );
    if (normalized.exitCode === 2) {
      writeOutput(
        dependencies.stderr,
        process.stderr,
        `${normalized.message}\n${usage}\n`,
      );
      return 2;
    }
    const output = Buffer.from(
      canonicalJson({
        schema_version: 1,
        artifact_type: "command_error",
        command: "execute-prepared",
        status: "error",
        code: normalized.code,
        message: normalized.message,
      }),
      "utf8",
    );
    writeOutput(dependencies.stdout, process.stdout, output);
    return 3;
  }
}

function runPrepare(parsed, dependencies) {
  let workspaceId = null;
  let runId = parsed.runId;
  let revision = null;
  const localProcessCap = dependencies.localProcessCap ?? Math.max(1, availableParallelism());
  if (
    parsed.concurrency !== null &&
    parsed.concurrency > Math.min(parsed.maxConcurrency, localProcessCap)
  ) {
    writeOutput(dependencies.stderr, process.stderr, `${usage}\n`);
    return 2;
  }
  try {
    const runRoot = dependencies.runRoot ?? fixedCliRunRoot();
    const existing = parsed.runId === null
      ? null
      : upgradeCliRunToV2({
          runRoot,
          runId: parsed.runId,
          afterBootstrap: dependencies.afterBootstrap,
        });
    revision = existing?.run.current_revision ?? null;
    if (existing?.recovered_next_revision === true) {
      const result = createStage3PrepareResult(existing);
      writeOutput(dependencies.stdout, process.stdout, Buffer.from(canonicalJson(result), "utf8"));
      return 0;
    }
    const prepareWorkspace = dependencies.prepareWorkspace ?? prepareSkillEvalWorkspace;
    const prepared = prepareWorkspace(dependencies.repoRoot ?? process.cwd(), {
      skill: parsed.skill,
      candidate: parsed.candidate,
      baseline: parsed.baseline,
    });
    workspaceId = prepared.workspace_id;
    const workspace = (dependencies.loadAllWorkspace ?? loadAllSelectedWorkspace)(workspaceId);
    const compiledInputs = compileCliPlanInputs(workspace);
    runId = existing?.run.run_id ?? dependencies.runId ?? createCliRunId();
    if (existing !== null) {
      const { plan, readerDescriptors } = compileRevisionCliPlan({
        workspace,
        compiledInputs,
        runId,
        revision: existing.run.current_revision + 1,
        processSettings: existing.run.process_settings,
        history: dependencies.history ?? null,
      });
      const published = publishNextCliRevision({ runRoot, runId, plan, readerDescriptors });
      revision = plan.revision;
      const result = createStage3PrepareResult(published);
      writeOutput(dependencies.stdout, process.stdout, Buffer.from(canonicalJson(result), "utf8"));
      return 0;
    }
    const { plan, readerDescriptors } = compileStaticCliPlan({
      workspace,
      compiledInputs,
      runId,
      maxConcurrency: parsed.maxConcurrency,
      localProcessCap,
      maxAttempts: parsed.maxAttempts,
      targetMinutes: parsed.targetMinutes,
      explicitConcurrency: parsed.concurrency,
      history: dependencies.history ?? null,
    });
    (dependencies.publishRun ?? publishCliPreparedRun)({
      runRoot,
      plan,
      readerDescriptors,
    });
    const result = {
      schema_version: 1,
      artifact_type: "cli_prepare_result",
      command: "prepare",
      status: "prepared",
      run_id: plan.run_id,
      revision: 1,
      workspace_id: plan.workspace_id,
      selected_scope: structuredClone(plan.selected_scope),
      process_settings: structuredClone(plan.process_settings),
      run_manifest: "run.json",
      execution_plan: "revisions/1/execution-plan.json",
      counts: structuredClone(plan.counts),
      ready_unit_ids: structuredClone(plan.ready_unit_ids),
      dependency_waves: structuredClone(plan.dependency_waves),
      estimate: structuredClone(plan.estimate),
      dispatch_counts: { reader: 0, evaluator: 0, total: 0 },
    };
    assertCliPrepareResult(result, plan);
    writeOutput(dependencies.stdout, process.stdout, Buffer.from(canonicalJson(result), "utf8"));
    return 0;
  } catch (error) {
    const normalized =
      error instanceof ArtifactError
        ? error
        : new ArtifactError(
            "CLI_PREPARE_OPERATION_FAILED",
            "Stage 2 CLI preparation failed before trustworthy publication.",
            3,
          );
    const result = {
      schema_version: 1,
      artifact_type: "command_error",
      command: "prepare",
      status: "error",
      code: normalized.code,
      message: normalized.message,
      workspace_id: workspaceId,
      run_id: runId,
      revision: runId === null ? null : 1,
      dispatch_counts: { reader: 0, evaluator: 0, total: 0 },
    };
    result.revision = parsed.runId === null ? (runId === null ? null : 1) : revision;
    if (parsed.runId === null) assertCliPrepareCommandError(result);
    writeOutput(dependencies.stdout, process.stdout, Buffer.from(canonicalJson(result), "utf8"));
    return 3;
  }
}

function assertNotInterrupted(signal) {
  if (signal?.aborted) {
    throw new ArtifactError(
      "CLI_EXECUTION_INTERRUPTED",
      "Stage 1 CLI execution was interrupted before reader dispatch.",
      3,
    );
  }
}

function parseCommand(args) {
  if (args[0] === "prepare") return parsePrepareCommand(args.slice(1));
  if (["run", "status", "resume", "report"].includes(args[0])) {
    return args.length === 3 && args[1] === "--run" && /^run-[a-f0-9]{32}$/.test(args[2])
      ? { command: args[0], runId: args[2] }
      : null;
  }
  if (["retry", "patch-check"].includes(args[0])) {
    if (args.length < 5 || args[1] !== "--run" || !/^run-[a-f0-9]{32}$/.test(args[2])) return null;
    const unitIds = [];
    for (let index = 3; index < args.length; index += 2) {
      if (args[index] !== "--unit" || !/^(reader|evaluator)-[a-f0-9]{64}$/.test(args[index + 1] ?? "")) return null;
      unitIds.push(args[index + 1]);
    }
    return { command: args[0], runId: args[2], unitIds };
  }
  if (args[0] !== "execute-prepared") return null;
  let workspaceId;
  let concurrency = defaultConcurrency;
  let concurrencySeen = false;
  const selectors = [];
  const selectorValues = new Set();
  for (let index = 1; index < args.length; index += 1) {
    const flag = args[index];
    if (!["--workspace", "--unit", "--concurrency"].includes(flag)) return null;
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) return null;
    index += 1;
    if (flag === "--workspace") {
      if (workspaceId !== undefined || !/^ws-[a-f0-9]{32}$/.test(value)) return null;
      workspaceId = value;
      continue;
    }
    if (flag === "--concurrency") {
      if (concurrencySeen || !/^[1-9][0-9]*$/.test(value)) return null;
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed)) return null;
      concurrencySeen = true;
      concurrency = parsed;
      continue;
    }
    const selector = parseUnitSelector(value);
    if (!selector || selectorValues.has(value)) return null;
    selectorValues.add(value);
    selectors.push(selector);
  }
  if (workspaceId === undefined || selectors.length === 0) return null;
  return { command: "execute-prepared", workspaceId, selectors, concurrency };
}

function parsePrepareCommand(args) {
  const valueFlags = new Set([
    "--skill", "--isolation", "--candidate-ref", "--baseline-ref", "--concurrency",
    "--max-concurrency", "--max-attempts", "--run", "--target-minutes",
  ]);
  const booleanFlags = new Set(["--candidate-current-tree", "--no-baseline"]);
  const values = new Map();
  const booleans = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (valueFlags.has(flag)) {
      const value = args[index + 1];
      if (values.has(flag) || value === undefined || value.startsWith("--")) return null;
      values.set(flag, value);
      index += 1;
    } else if (booleanFlags.has(flag)) {
      if (booleans.has(flag)) return null;
      booleans.add(flag);
    } else return null;
  }
  const skill = values.get("--skill");
  const hasCurrentTree = booleans.has("--candidate-current-tree");
  const candidateRef = values.get("--candidate-ref");
  const hasNoBaseline = booleans.has("--no-baseline");
  const baselineRef = values.get("--baseline-ref");
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill ?? "") ||
    values.get("--isolation") !== "synthetic" ||
    Number(hasCurrentTree) + Number(candidateRef !== undefined) !== 1 ||
    Number(hasNoBaseline) + Number(baselineRef !== undefined) !== 1
  ) return null;
  const concurrency = optionalPositiveInteger(values.get("--concurrency"));
  const maxConcurrency = optionalPositiveInteger(values.get("--max-concurrency"), 4);
  const maxAttempts = optionalPositiveInteger(values.get("--max-attempts"), 2);
  const targetMinutes = optionalPositiveNumber(values.get("--target-minutes"));
  const runId = values.get("--run") ?? null;
  if (runId !== null && !/^run-[a-f0-9]{32}$/.test(runId)) return null;
  if ([concurrency, maxConcurrency, maxAttempts, targetMinutes].includes(undefined)) return null;
  if (
    runId !== null &&
    ["--concurrency", "--max-concurrency", "--max-attempts", "--target-minutes"]
      .some((flag) => values.has(flag))
  ) return null;
  return {
    command: "prepare",
    runId,
    skill,
    candidate: hasCurrentTree ? { kind: "current_tree" } : { kind: "ref", ref: candidateRef },
    baseline: hasNoBaseline ? null : baselineRef,
    concurrency,
    maxConcurrency,
    maxAttempts,
    targetMinutes,
  };
}

function optionalPositiveInteger(value, fallback = null) {
  if (value === undefined) return fallback;
  if (!/^[1-9][0-9]*$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

function optionalPositiveNumber(value) {
  if (value === undefined) return null;
  const parsed = Number(value);
  return value.trim() === value && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function validateRetrySelection(unitIds, states, maxAttempts, plan) {
  const unique = new Set(unitIds);
  if (unique.size !== unitIds.length) {
    throw new ArtifactError("CLI_RETRY_SELECTION_INVALID", "Retry unit selection contains duplicates.", 3);
  }
  const byId = new Map(states.map((state) => [state.unit_id, state]));
  for (const unitId of unitIds) {
    const state = byId.get(unitId);
    const evaluator = plan.evaluator_units.find((unit) => unit.unit_id === unitId);
    if (!state || state.status !== "failed" || (evaluator &&
      evaluator.dependencies.some((dependency) => byId.get(dependency.unit_id)?.status !== "succeeded"))) {
      throw new ArtifactError(
        "CLI_RETRY_SELECTION_INVALID",
        "Retry requires exact failed units with current successful dependencies.",
        3,
      );
    }
  }
  if (unitIds.some((unitId) => byId.get(unitId).attempt_summaries.length + 1 > maxAttempts)) {
    throw new ArtifactError(
      "CLI_ATTEMPT_BUDGET_EXHAUSTED",
      "Retry unit attempt budget is exhausted.",
      3,
    );
  }
}

function validateAcceptedStates(runPath, runId, plan, states) {
  const readers = new Map(plan.reader_units.map((unit) => [unit.unit_id, unit]));
  const invalidated = [];
  for (const state of states) {
    if (state.logical_unit_key.kind !== "reader" || state.status !== "succeeded") continue;
    const evidence = resolveAcceptedReaderEvidence({
      runRoot: runPath,
      runId,
      unitState: state,
      sourceRole: state.logical_unit_key.source_role,
    });
    const decision = assessAcceptedReaderReuse({
      acceptedEvidence: evidence,
      currentDescriptor: serializedReaderDescriptor(readers.get(state.unit_id)),
    });
    if (decision.status === "rejected") {
      throw new ArtifactError("CLI_ACCEPTED_EVIDENCE_INVALID", "Accepted reader lineage is invalid.", 3);
    }
    if (decision.status === "invalidated") invalidated.push(state.unit_id);
  }
  const byId = new Map(states.map((state) => [state.unit_id, state]));
  for (const evaluator of plan.evaluator_units) {
    const state = byId.get(evaluator.unit_id);
    if (state.status !== "succeeded") continue;
    const accepted = resolveAcceptedEvaluatorEvidence({ runRoot: runPath, runId, unitState: state });
    if (state.current_behavior_fingerprint !== accepted.producer_behavior_fingerprint) {
      throw new ArtifactError("CLI_ACCEPTED_EVIDENCE_INVALID", "Succeeded evaluator fingerprint differs from its producing input.", 3);
    }
    if (evaluator.dependencies.some((dependency) => invalidated.includes(dependency.unit_id) ||
      byId.get(dependency.unit_id)?.status !== "succeeded")) {
      invalidated.push(state.unit_id);
      continue;
    }
    const bindings = evaluator.dependencies.map((dependency) => resolveAcceptedReaderEvidence({
      runRoot: runPath, runId, unitState: byId.get(dependency.unit_id), sourceRole: dependency.source_role,
    }));
    const descriptor = compileEvaluatorPreparedUnitDescriptor({ staticPlan: evaluator, bindings, cliOptions: plan.cli_behavior_options });
    const dependencyBindings = bindings.map(({ source_role, unit_id, producer_behavior_fingerprint, structured_output_sha256 }) =>
      ({ source_role, unit_id, producer_behavior_fingerprint, structured_output_sha256 }));
    if (accepted.producer_behavior_fingerprint !== sha256Canonical(descriptor.behavior_projection) ||
      canonicalJson(state.dependency_bindings) !== canonicalJson(dependencyBindings)) invalidated.push(state.unit_id);
  }
  return invalidated;
}

function projectPatchCheck({ runPath, runId, plan, states, unitIds, maxAttempts }) {
  const unique = new Set(unitIds);
  if (unique.size !== unitIds.length) {
    throw new ArtifactError("CLI_PATCH_SELECTION_INVALID", "Patch-check unit selection contains duplicates.", 3);
  }
  const invalidated = new Set(validateAcceptedStates(runPath, runId, plan, states));
  for (const state of states) {
    if (
      state.status === "pending" &&
      state.attempt_summaries.length > 0 && state.accepted_attempt === null
    ) invalidated.add(state.unit_id);
  }
  const originalById = new Map(states.map((state) => [state.unit_id, state]));
  for (const evaluator of plan.evaluator_units) {
    const state = originalById.get(evaluator.unit_id);
    if (!["pending", "succeeded"].includes(state.status)) continue;
    if (evaluator.dependencies.some((dependency) => invalidated.has(dependency.unit_id))) {
      invalidated.add(evaluator.unit_id);
      continue;
    }
    const dependencies = evaluator.dependencies.map((dependency) => originalById.get(dependency.unit_id));
    if (state.current_behavior_fingerprint === null || !dependencies.every((dependency) => dependency.status === "succeeded")) {
      continue;
    }
    const bindings = evaluator.dependencies.map((dependency, index) => resolveAcceptedReaderEvidence({
      runRoot: runPath,
      runId,
      unitState: dependencies[index],
      sourceRole: dependency.source_role,
    }));
    const descriptor = compileEvaluatorPreparedUnitDescriptor({
      staticPlan: evaluator,
      bindings,
      cliOptions: plan.cli_behavior_options,
    });
    const dependencyBindings = bindings.map((binding) => ({
      source_role: binding.source_role,
      unit_id: binding.unit_id,
      producer_behavior_fingerprint: binding.producer_behavior_fingerprint,
      structured_output_sha256: binding.structured_output_sha256,
    })).sort((left, right) => compareStrings(left.source_role, right.source_role));
    if (
      state.current_behavior_fingerprint !== sha256Canonical(descriptor.behavior_projection) ||
      canonicalJson(state.dependency_bindings) !== canonicalJson(dependencyBindings)
    ) invalidated.add(evaluator.unit_id);
  }
  const contradictions = [];
  const projected = states.map((state) => {
    let recovered = state;
    if (state.status === "running") {
      try {
        recovered = projectActiveCliAttemptState({ runPath, plan, state });
      } catch {
        contradictions.push(state);
      }
    } else if (hasContradictoryLateCliResult({ runPath, plan, state })) {
      contradictions.push(state);
    }
    return invalidated.has(recovered.unit_id)
      ? { ...recovered, status: "pending", accepted_attempt: null }
      : recovered;
  });
  const byId = new Map(projected.map((state) => [state.unit_id, state]));
  for (const unitId of unitIds) {
    if (!byId.has(unitId)) {
      throw new ArtifactError("CLI_PATCH_SELECTION_INVALID", "Patch-check unit is outside the run scope.", 3);
    }
  }
  const closure = new Set(unitIds);
  for (const unitId of unitIds) {
    const state = byId.get(unitId);
    if (state.logical_unit_key.kind !== "reader") continue;
    for (const evaluator of plan.evaluator_units) {
      if (evaluator.dependencies.some((dependency) => dependency.unit_id === unitId)) closure.add(evaluator.unit_id);
    }
  }
  for (const unitId of closure) {
    const state = byId.get(unitId);
    if (state.status === "blocked") {
      throw new ArtifactError("CLI_RUN_INTEGRITY_BLOCKED", "Patch-check closure contains an integrity-blocked unit.", 3);
    }
    if (state.logical_unit_key.kind === "reader") {
      if (state.status !== "pending") {
        throw new ArtifactError("CLI_PATCH_SELECTION_INVALID", "Patch-check reader is not impact-eligible pending work.", 3);
      }
      if (state.attempt_summaries.length + 1 > maxAttempts) {
        throw new ArtifactError("CLI_ATTEMPT_BUDGET_EXHAUSTED", "Patch-check reader attempt budget is exhausted.", 3);
      }
      continue;
    }
    if (state.status !== "pending") {
      throw new ArtifactError("CLI_PATCH_SELECTION_INVALID", "Patch-check evaluator is not pending.", 3);
    }
    if (state.attempt_summaries.length + 1 > maxAttempts) {
      throw new ArtifactError("CLI_ATTEMPT_BUDGET_EXHAUSTED", "Patch-check evaluator attempt budget is exhausted.", 3);
    }
    const evaluator = plan.evaluator_units.find((unit) => unit.unit_id === unitId);
    const ready = evaluator.dependencies.every((dependency) => {
      const dependencyState = byId.get(dependency.unit_id);
      return dependencyState.status === "succeeded" ||
        (closure.has(dependency.unit_id) && dependencyState.status === "pending" &&
          dependencyState.attempt_summaries.length + 1 <= maxAttempts);
    });
    if (!ready) {
      throw new ArtifactError("CLI_PATCH_SELECTION_INVALID", "Patch-check evaluator dependencies are not eligible.", 3);
    }
  }
  const invalidatedInClosure = new Set([...invalidated].filter((unitId) => closure.has(unitId)));
  for (const unitId of closure) {
    const state = originalById.get(unitId);
    if (state.logical_unit_key.kind === "evaluator" && state.current_behavior_fingerprint === null) {
      invalidatedInClosure.add(unitId);
    }
  }
  return {
    closure: [...closure].sort(compareStrings),
    invalidated: [...invalidatedInClosure].sort(compareStrings),
    projected,
    contradictions,
  };
}

async function runStage3Command(parsed, dependencies) {
  const runRoot = dependencies.runRoot ?? fixedCliRunRoot();
  let workspaceId = null;
  let revision = null;
  const dispatched = [];
  let patchContext = null;
  let preflightPassedBeforeUpgrade = false;
  try {
    if (parsed.command === "status") {
      const loaded = readCliRunStore({ runRoot, runId: parsed.runId });
      workspaceId = loaded.run.workspace_id;
      revision = loaded.run.current_revision;
      let states = loaded.run.schema_version === 1
        ? createInitialUnitStates(loaded.plan)
        : readUnitStates(loaded.runPath, loaded.plan);
      const invalidated = validateAcceptedStates(loaded.runPath, parsed.runId, loaded.plan, states);
      states = states.map((state) => invalidated.includes(state.unit_id)
        ? { ...state, status: "pending", accepted_attempt: null } : state);
      const run = derivedRun(loaded.run, loaded.plan, states);
      const result = createStage3Result({ command: "status", run, plan: loaded.plan, states });
      writeOutput(dependencies.stdout, process.stdout, Buffer.from(canonicalJson(result), "utf8"));
      return 0;
    }

    if (parsed.command === "patch-check") {
      const authoritative = readCliRunStore({ runRoot, runId: parsed.runId });
      const initial = projectCliRunToV2({ runRoot, runId: parsed.runId });
      workspaceId = authoritative.run.workspace_id;
      revision = authoritative.run.current_revision;
      patchContext = projectPatchCheck({
        runPath: initial.runPath,
        runId: initial.run.run_id,
        plan: initial.plan,
        states: initial.states,
        unitIds: parsed.unitIds,
        maxAttempts: initial.run.process_settings.max_attempts,
      });
      if (patchContext.contradictions.length > 0) {
        const writable = initial.projected_next_revision
          ? upgradeCliRunToV2({ runRoot, runId: parsed.runId })
          : initial;
        const writableStates = initial.projected_next_revision
          ? readUnitStates(writable.runPath, writable.plan)
          : initial.states;
        for (const contradiction of patchContext.contradictions) {
          const current = writableStates.find((state) => state.unit_id === contradiction.unit_id);
          writeCliUnitState({
            runPath: writable.runPath,
            plan: writable.plan,
            state: { ...current, status: "blocked", block_reason: "integrity_failure", accepted_attempt: null },
          });
        }
        throw new ArtifactError("CLI_RUN_INTEGRITY_BLOCKED", "Patch-check found contradictory attempt evidence.", 3);
      }
      try {
        await (dependencies.preflight ?? preflightCodexCli)({
          executable: dependencies.executable,
          prefixArgs: dependencies.prefixArgs,
        });
      } catch (error) {
        persistOperationalCondition({ runRoot, runId: parsed.runId, authoritative });
        throw error;
      }
      const mixedRun = derivedRun({
        ...initial.run,
        mode: "patch_check_mixed_revision",
        status: "prepared",
        status_reason: null,
      }, initial.plan, patchContext.projected);
      writeCliRunV2({ runPath: initial.runPath, plan: initial.plan, run: mixedRun });
      dependencies.afterPatchMarker?.();
    } else if (parsed.command === "retry") {
      const authoritative = readCliRunStore({ runRoot, runId: parsed.runId });
      const initial = projectCliRunToV2({ runRoot, runId: parsed.runId });
      workspaceId = authoritative.run.workspace_id;
      revision = authoritative.run.current_revision;
      const invalid = validateAcceptedStates(initial.runPath, initial.run.run_id, initial.plan, initial.states);
      const projectedStates = initial.states.map((state) => state.status === "running"
        ? projectActiveCliAttemptState({ runPath: initial.runPath, plan: initial.plan, state })
        : state);
      if (projectedStates.some((state) => state.status === "blocked" && state.block_reason === "integrity_failure")) {
        throw new ArtifactError("CLI_RUN_INTEGRITY_BLOCKED", "Run contains an integrity-blocked unit.", 3);
      }
      validateRetrySelection(parsed.unitIds, projectedStates.map((state) => invalid.includes(state.unit_id)
        ? { ...state, status: "pending", accepted_attempt: null } : state), initial.run.process_settings.max_attempts, initial.plan);
      try {
        await (dependencies.preflight ?? preflightCodexCli)({
          executable: dependencies.executable,
          prefixArgs: dependencies.prefixArgs,
        });
        preflightPassedBeforeUpgrade = true;
      } catch (error) {
        persistOperationalCondition({ runRoot, runId: parsed.runId, authoritative });
        throw error;
      }
    }

    const loaded = upgradeCliRunToV2({
      runRoot,
      runId: parsed.runId,
      mode: parsed.command === "patch-check" ? "patch_check_mixed_revision" : "exact_current",
      clearOperationalCondition: parsed.command === "patch-check",
    });
    if (parsed.command === "patch-check" &&
      (loaded.run.mode !== "patch_check_mixed_revision" || loaded.run.status_reason === "operational_condition")) {
      loaded.run = derivedRun({
        ...loaded.run,
        mode: "patch_check_mixed_revision",
        status: "prepared",
        status_reason: null,
      }, loaded.plan, patchContext.projected);
      writeCliRunV2({ runPath: loaded.runPath, plan: loaded.plan, run: loaded.run });
    }
    workspaceId = loaded.run.workspace_id;
    revision = loaded.run.current_revision;
    const persistedStates = readUnitStates(loaded.runPath, loaded.plan);
    if (persistedStates.some((state) => state.status === "blocked" && state.block_reason === "integrity_failure")) {
      throw new ArtifactError("CLI_RUN_INTEGRITY_BLOCKED", "Run contains an integrity-blocked unit.", 3);
    }
    const readerById = new Map(loaded.plan.reader_units.map((unit) => [unit.unit_id, unit]));
    const preflightStates = persistedStates.map((state) => {
      if (state.status !== "running") return state;
      try { return projectActiveCliAttemptState({ runPath: loaded.runPath, plan: loaded.plan, state }); }
      catch { return state; }
    });
    const preflightInvalidated = validateAcceptedStates(
      loaded.runPath, parsed.runId, loaded.plan, persistedStates,
    );
    const retrySet = new Set(parsed.unitIds ?? []);
    const needsPreflight = parsed.command !== "patch-check" && !preflightPassedBeforeUpgrade &&
      (loaded.run.status_reason === "operational_condition" || preflightStates.some((state) =>
      ((["run", "resume"].includes(parsed.command) && effectiveUnitStatus(state, loaded.plan, preflightStates).effective_status === "pending") ||
        (parsed.command === "retry" && retrySet.has(state.unit_id)) ||
        preflightInvalidated.includes(state.unit_id)) &&
      state.attempt_summaries.length < loaded.run.process_settings.max_attempts));
    if (needsPreflight) {
      try {
        await (dependencies.preflight ?? preflightCodexCli)({
          executable: dependencies.executable,
          prefixArgs: dependencies.prefixArgs,
        });
      } catch (error) {
        writeCliRunV2({
          runPath: loaded.runPath,
          plan: loaded.plan,
          run: { ...loaded.run, status: "paused", status_reason: "operational_condition" },
        });
        throw error;
      }
    }
    if ((needsPreflight || preflightPassedBeforeUpgrade) && loaded.run.status_reason === "operational_condition") {
      loaded.run = derivedRun(
        { ...loaded.run, status: "prepared", status_reason: null },
        loaded.plan,
        persistedStates,
      );
      writeCliRunV2({ runPath: loaded.runPath, plan: loaded.plan, run: loaded.run });
    }
    const states = persistedStates.map((state) => {
      if (state.status === "running") {
        return reconcileActiveCliAttempt({ runPath: loaded.runPath, plan: loaded.plan, state });
      }
      return reconcileLateCliAttemptResult({ runPath: loaded.runPath, plan: loaded.plan, state });
    });
    const reconciledInvalidated = validateAcceptedStates(loaded.runPath, parsed.runId, loaded.plan, states);
    const projected = [];
    const reused = [];
    const invalidated = parsed.command === "patch-check"
      ? [...patchContext.invalidated]
      : [];
    for (const state of states) {
      if (state.status !== "succeeded") {
        projected.push(state);
        continue;
      }
      if (state.logical_unit_key.kind === "evaluator") {
        if (reconciledInvalidated.includes(state.unit_id) &&
          (parsed.command !== "patch-check" || patchContext.closure.includes(state.unit_id))) {
          invalidated.push(state.unit_id);
          projected.push({ ...state, status: "pending", accepted_attempt: null });
        } else {
          if (!reconciledInvalidated.includes(state.unit_id)) reused.push(state.unit_id);
          projected.push(state);
        }
        continue;
      }
      const evidence = resolveAcceptedReaderEvidence({
        runRoot: loaded.runPath,
        runId: parsed.runId,
        unitState: state,
        sourceRole: state.logical_unit_key.source_role,
      });
      const decision = assessAcceptedReaderReuse({
        acceptedEvidence: evidence,
        currentDescriptor: serializedReaderDescriptor(readerById.get(state.unit_id)),
      });
      if (decision.status === "reusable") {
        reused.push(state.unit_id);
        projected.push(state);
      } else if (decision.status === "invalidated" &&
        (parsed.command !== "patch-check" || patchContext.closure.includes(state.unit_id))) {
        invalidated.push(state.unit_id);
        projected.push({ ...state, status: "pending", accepted_attempt: null });
      } else if (decision.status === "invalidated") {
        projected.push(state);
      } else {
        throw new ArtifactError("CLI_ACCEPTED_EVIDENCE_INVALID", "Accepted reader lineage is invalid.", 3);
      }
    }
    if (parsed.command === "retry") {
      projected.forEach((state, index) => {
        if (retrySet.has(state.unit_id)) projected[index] = { ...state, status: "pending" };
      });
    }
    for (const state of projected) {
      const previous = states.find((item) => item.unit_id === state.unit_id);
      if (canonicalJson(previous) !== canonicalJson(state)) {
        writeCliUnitState({ runPath: loaded.runPath, plan: loaded.plan, state });
      }
    }
    const byId = new Map(projected.map((state) => [state.unit_id, state]));
    const evaluatorScope = parsed.command === "patch-check" ? new Set(patchContext.closure)
      : parsed.command === "retry" ? new Set([
          ...retrySet,
          ...loaded.plan.evaluator_units.filter((unit) => unit.dependencies.some((dependency) => retrySet.has(dependency.unit_id)))
            .map((unit) => unit.unit_id),
        ]) : null;
    while (true) {
      const evaluatorPrepared = await finalizeReadyEvaluators({
        loaded, statesById: byId,
        allowedIds: evaluatorScope,
      });
      const runnable = [...byId.values()].filter((state) =>
        state.status === "pending" &&
        (state.logical_unit_key.kind === "reader" || evaluatorPrepared.has(state.unit_id)) &&
        (parsed.command !== "retry" || state.logical_unit_key.kind === "evaluator" || retrySet.has(state.unit_id)) &&
        (parsed.command !== "patch-check" || patchContext.closure.includes(state.unit_id)) &&
        state.attempt_summaries.length < loaded.run.process_settings.max_attempts)
        .sort((left, right) => compareStrings(left.unit_id, right.unit_id));
      if (runnable.length === 0) break;
      const settled = await runBoundedPool(
        runnable,
        Math.min(loaded.run.process_settings.planned_concurrency, runnable.length),
        async (state) => {
          let active = state;
          let spawned = false;
          try {
            const ordinal = state.attempt_summaries.length + 1;
            const attemptId = `${state.unit_id}-attempt-${ordinal}`;
            const prefix = `attempts/${state.unit_id}/${ordinal}`;
            active = {
              ...state,
              status: "running",
              active_attempt: {
                attempt_id: attemptId,
                attempt_ordinal: ordinal,
                producer_revision: loaded.plan.revision,
                attempt_record_path: `${prefix}/attempt.json`,
                execution_result_path: `${prefix}/result.json`,
                output_directory_path: `${prefix}/output`,
              },
            };
            writeCliUnitState({ runPath: loaded.runPath, plan: loaded.plan, state: active });
            const preparedUnit = state.logical_unit_key.kind === "reader"
              ? preparedReaderFromPlan(loaded.runPath, readerById.get(state.unit_id))
              : evaluatorPrepared.get(state.unit_id);
            const execute = dependencies.executeUnit ?? executePreparedUnit;
            const workerOptions = {
              ...(dependencies.workerOptions ?? {
                executable: dependencies.executable,
                prefixArgs: dependencies.prefixArgs,
                timeoutMs: dependencies.timeoutMs,
                terminationGraceMs: dependencies.terminationGraceMs,
                hardKillGraceMs: dependencies.hardKillGraceMs,
                signal: dependencies.signal,
              }),
              onSpawn: () => { spawned = true; },
            };
            const executionResult = await execute({
              prepared_unit: preparedUnit,
              attempt_id: attemptId,
              attempt_ordinal: ordinal,
              output_path: join(loaded.runPath, ...`${prefix}/output`.split("/")),
            }, workerOptions);
            if (executionResult?.process_metadata?.spawned === true) spawned = true;
            return {
              error: null,
              spawned,
              state: reconcileActiveCliAttempt({ runPath: loaded.runPath, plan: loaded.plan, state: active }),
            };
          } catch (error) {
            if (active.active_attempt !== null && existsSync(
              join(loaded.runPath, ...active.active_attempt.execution_result_path.split("/")),
            )) {
              try {
                return {
                  error: null,
                  spawned,
                  state: reconcileActiveCliAttempt({ runPath: loaded.runPath, plan: loaded.plan, state: active }),
                };
              } catch (reconcileError) {
                return { error: reconcileError, spawned, state: active };
              }
            }
            return { error, spawned, state: active };
          }
        },
      );
      dispatched.push(...settled.filter((outcome) => outcome.spawned).map((outcome) => outcome.state.unit_id));
      const settlementError = settled.find((outcome) => outcome.error !== null)?.error;
      if (settlementError !== undefined) throw settlementError;
      settled.forEach((outcome) => byId.set(outcome.state.unit_id, outcome.state));
    }
    const finalStates = readUnitStates(loaded.runPath, loaded.plan);
    const run = derivedRun(loaded.run, loaded.plan, finalStates);
    writeCliRunV2({ runPath: loaded.runPath, plan: loaded.plan, run });
    const result = createStage3Result({
      command: parsed.command,
      run,
      plan: loaded.plan,
      states: finalStates,
      dispatched,
      reused,
      invalidated,
      affected: parsed.command === "patch-check"
        ? patchContext.closure
        : changedUnitIds(persistedStates, finalStates),
      requested: parsed.unitIds ?? [],
    });
    writeOutput(dependencies.stdout, process.stdout, Buffer.from(canonicalJson(result), "utf8"));
    return result.status === "succeeded" ? 0 : 1;
  } catch (error) {
    const normalized = error instanceof ArtifactError
      ? error
      : new ArtifactError("CLI_RUN_OPERATION_FAILED", "Stage 3 command failed before a trustworthy result.", 3);
    const result = {
      schema_version: 1,
      artifact_type: "command_error",
      command: parsed.command,
      status: "error",
      code: normalized.code,
      message: normalized.message,
      workspace_id: workspaceId,
      run_id: parsed.runId,
      revision,
      dispatch_counts: {
        reader: dispatched.filter((id) => id.startsWith("reader-")).length,
        evaluator: dispatched.filter((id) => id.startsWith("evaluator-")).length,
        total: dispatched.length,
      },
    };
    writeOutput(dependencies.stdout, process.stdout, Buffer.from(canonicalJson(result), "utf8"));
    return 3;
  }
}

function runReport(parsed, dependencies) {
  let loaded;
  try {
    loaded = readCliRunStore({ runRoot: dependencies.runRoot ?? fixedCliRunRoot(), runId: parsed.runId });
    const { plan, runPath, run } = loaded;
    const states = run.schema_version === 1 ? createInitialUnitStates(plan) : readUnitStates(runPath, plan);
    const byId = new Map(states.map((state) => [state.unit_id, state]));
    const accepted = new Map();
    const currentReaders = new Map();
    for (const state of states) {
      if (state.status === "blocked") continue;
      if (hasContradictoryLateCliResult({ runPath, plan, state })) {
        throw new ArtifactError("CLI_REPORT_EVIDENCE_INVALID", "Report found contradictory late attempt evidence.", 3);
      }
      if (state.status !== "succeeded") continue;
      const evidence = state.logical_unit_key.kind === "reader"
        ? resolveAcceptedReaderEvidence({ runRoot: runPath, runId: run.run_id, unitState: state, sourceRole: state.logical_unit_key.source_role })
        : resolveAcceptedEvaluatorEvidence({ runRoot: runPath, runId: run.run_id, unitState: state });
      accepted.set(state.unit_id, evidence);
      if (state.logical_unit_key.kind === "reader") {
        const descriptor = plan.reader_units.find((unit) => unit.unit_id === state.unit_id);
        const current = assessAcceptedReaderReuse({ acceptedEvidence: evidence, currentDescriptor: descriptor }).status === "reusable";
        if (!current && (run.mode ?? "exact_current") === "exact_current") reportCoverageInvalid();
        currentReaders.set(state.unit_id, current);
      } else if (state.current_behavior_fingerprint !== evidence.producer_behavior_fingerprint) {
        throw new ArtifactError("CLI_REPORT_EVIDENCE_INVALID", "Succeeded evaluator fingerprint contradicts its producing input.", 3);
      }
    }
    const cases = plan.evaluator_units.map((evaluator) => {
      const evaluatorState = byId.get(evaluator.unit_id);
      const readerStates = evaluator.dependencies.map((dependency) => byId.get(dependency.unit_id));
      const evaluatorEvidence = accepted.get(evaluator.unit_id);
      const currentBindings = evaluator.dependencies.map((dependency) => accepted.get(dependency.unit_id));
      let exact = false;
      if (evaluatorEvidence && evaluator.dependencies.every((dependency) => currentReaders.get(dependency.unit_id))) {
        const descriptor = compileEvaluatorPreparedUnitDescriptor({ staticPlan: evaluator, bindings: currentBindings, cliOptions: plan.cli_behavior_options });
        const bindings = currentBindings.map(({ source_role, unit_id, producer_behavior_fingerprint, structured_output_sha256 }) =>
          ({ source_role, unit_id, producer_behavior_fingerprint, structured_output_sha256 }));
        exact = sha256Canonical(descriptor.behavior_projection) === evaluatorEvidence.producer_behavior_fingerprint &&
          canonicalJson(evaluatorState.dependency_bindings) === canonicalJson(bindings);
      }
      if (evaluatorEvidence && !exact && !readerStates.some((state) => state.status === "blocked") &&
        (run.mode ?? "exact_current") === "exact_current") reportCoverageInvalid();
      let graph = exact ? { evaluator: evaluatorEvidence, readers: currentBindings } : null;
      if (!graph && run.mode === "patch_check_mixed_revision" &&
        ![...readerStates, evaluatorState].some((state) => state.status === "blocked")) {
        graph = resolveHistoricalReportGraph({ runPath, plan, evaluator, evaluatorState, readerStates });
      }
      const readers = readerStates.map((state, index) => reportUnitResult({
        state, plan, states, evidence: graph?.readers[index] ?? null,
        current: exact || (graph?.readers[index]?.attempt_id === state.accepted_attempt?.attempt_id && currentReaders.get(state.unit_id)),
        sourceRole: evaluator.dependencies[index].source_role,
      }));
      const result = reportUnitResult({ state: evaluatorState, plan, states, evidence: graph?.evaluator ?? null, current: exact });
      const incomplete = [...readers, result].some((item) =>
        ["failed", "outcome_unknown", "running"].includes(item.unit_status) ||
        ["integrity_failure", "attempt_budget_exhausted"].includes(item.block_reason));
      return {
        suite: evaluator.logical_unit_key.suite, case_id: evaluator.logical_unit_key.case_id,
        evaluator_unit_id: evaluator.unit_id,
        coverage_status: !graph || incomplete ? "incomplete" : exact ? "current" : "retained_reference",
        reader_results: readers, evaluator_result: result,
      };
    });
    const report = createCliEvaluationReport({ run, plan, cases });
    writeOutput(dependencies.stdout, process.stdout, Buffer.from(canonicalJson(report), "utf8"));
    return report.counts.incomplete > 0 ? 1 : 0;
  } catch (error) {
    const normalized = error instanceof ArtifactError ? error
      : new ArtifactError("CLI_REPORT_EVIDENCE_INVALID", "Report could not validate its selected evidence.", 3);
    writeOutput(dependencies.stdout, process.stdout, Buffer.from(canonicalJson({
      schema_version: 1, artifact_type: "command_error", command: "report", status: "error",
      code: normalized.code, message: normalized.message,
      workspace_id: loaded?.run.workspace_id ?? null, run_id: parsed.runId, revision: loaded?.run.current_revision ?? null,
      dispatch_counts: { reader: 0, evaluator: 0, total: 0 },
    }), "utf8"));
    return 3;
  }
}

function resolveHistoricalReportGraph({ runPath, plan, evaluator, evaluatorState, readerStates }) {
  const summary = evaluatorState.attempt_summaries.findLast((item) => item.terminal_status === "succeeded");
  if (!summary) return null;
  const evaluatorEvidence = resolveAcceptedEvaluatorEvidence({
    runRoot: runPath, runId: plan.run_id, unitState: historicalReportState(evaluatorState, summary),
  });
  const readers = [];
  for (const [index, state] of readerStates.entries()) {
    const role = evaluator.dependencies[index].source_role;
    const expected = evaluatorEvidence.projections.find((projection) => projection.source_role === role);
    let matched = null;
    for (const candidate of [...state.attempt_summaries].reverse()) {
      if (candidate.terminal_status !== "succeeded") continue;
      const evidence = resolveAcceptedReaderEvidence({
        runRoot: runPath, runId: plan.run_id, unitState: historicalReportState(state, candidate), sourceRole: role,
      });
      const observation = JSON.parse(evidence.observation_bytes.toString("utf8"));
      const projection = { source_role: role, execution_status: observation.execution_status,
        execution_reason: observation.execution_reason, raw_response: observation.raw_response, observed_access: observation.observed_access };
      if (canonicalJson(projection) === canonicalJson(expected)) { matched = evidence; break; }
    }
    if (!matched) return null;
    readers.push(matched);
  }
  return { evaluator: evaluatorEvidence, readers };
}

function historicalReportState(state, summary) {
  // Bản chiếu chỉ dành cho resolver; không khôi phục acceptance hay suy ra exact producing reader attempt.
  return { ...state, status: "succeeded", block_reason: null, active_attempt: null,
    accepted_attempt: { attempt_id: summary.attempt_id, attempt_record_path: summary.attempt_record_path,
      attempt_record_sha256: summary.attempt_record_sha256 } };
}

function reportUnitResult({ state, plan, states, evidence, current, sourceRole }) {
  const effective = effectiveUnitStatus(state, plan, states);
  return {
    ...(sourceRole ? { source_role: sourceRole } : {}), unit_id: state.unit_id, unit_status: state.status,
    effective_status: effective.effective_status, block_reason: effective.block_reason,
    relation: evidence ? (current ? "current" : "retained_reference") : "unavailable",
    attempt_id: evidence?.attempt_id ?? null, producer_revision: evidence?.producer_revision ?? null,
    structured_output_sha256: evidence?.structured_output_sha256 ?? null,
    ...(sourceRole ? {} : { proposal: evidence?.proposal ?? null }),
  };
}

function reportCoverageInvalid() {
  throw new ArtifactError("CLI_REPORT_COVERAGE_INVALID", "Accepted evidence claims current coverage but differs from the current graph.", 3);
}

function changedUnitIds(before, after) {
  const beforeById = new Map(before.map((state) => [state.unit_id, state]));
  return after
    .filter((state) => canonicalJson(unitClassification(beforeById.get(state.unit_id))) !==
      canonicalJson(unitClassification(state)))
    .map((state) => state.unit_id);
}

function persistOperationalCondition({ runRoot, runId, authoritative }) {
  const writable = authoritative.run.schema_version === 2
    ? authoritative
    : upgradeCliRunToV2({ runRoot, runId });
  writeCliRunV2({
    runPath: writable.runPath,
    plan: writable.plan,
    run: { ...writable.run, status: "paused", status_reason: "operational_condition" },
  });
}

function createStage3PrepareResult({
  run,
  plan,
  states,
  affected = [],
  invalidated = [],
  reused = [],
}) {
  return createStage3Result({
    command: "prepare",
    run,
    plan,
    states,
    affected,
    invalidated,
    reused,
  });
}

function createStage3Result({
  command,
  run,
  plan,
  states,
  affected = [],
  dispatched = [],
  reused = [],
  invalidated = [],
  requested = [],
}) {
  const unitStatuses = states.map((state) => effectiveUnitStatus(state, plan, states))
    .sort((left, right) => compareStrings(left.unit_id, right.unit_id));
  const count = (predicate) => unitStatuses.filter(predicate).length;
  const incomplete = ["failed", "outcome_unknown"].some((status) =>
    unitStatuses.some((item) => item.effective_status === status)) ||
    unitStatuses.some((item) => item.block_reason === "attempt_budget_exhausted");
  return {
    schema_version: 1,
    artifact_type: "cli_run_command_result",
    command,
    status: incomplete && !["prepare", "status"].includes(command) ? "incomplete" : "succeeded",
    run_id: run.run_id,
    workspace_id: run.workspace_id,
    revision: run.current_revision,
    run_status: run.status,
    run_status_reason: run.status_reason,
    mode: run.mode ?? "exact_current",
    requested_unit_ids: sortedUnique(requested),
    affected_unit_ids: sortedUnique(affected),
    dispatched_unit_ids: sortedUnique(dispatched),
    reused_unit_ids: sortedUnique(reused),
    invalidated_unit_ids: sortedUnique(invalidated),
    unit_statuses: unitStatuses,
    counts: {
      reader_units: plan.reader_units.length,
      evaluator_units: plan.evaluator_units.length,
      total_units: unitStatuses.length,
      pending: count((item) => item.effective_status === "pending"),
      running: count((item) => item.effective_status === "running"),
      succeeded: count((item) => item.effective_status === "succeeded"),
      failed: count((item) => item.effective_status === "failed"),
      outcome_unknown: count((item) => item.effective_status === "outcome_unknown"),
      integrity_blocked: count((item) => item.block_reason === "integrity_failure"),
      dependency_blocked: count((item) => item.block_reason === "dependency_not_ready"),
      attempt_budget_blocked: count((item) => item.block_reason === "attempt_budget_exhausted"),
    },
    dispatch_counts: {
      reader: dispatched.filter((id) => id.startsWith("reader-")).length,
      evaluator: dispatched.filter((id) => id.startsWith("evaluator-")).length,
      total: dispatched.length,
    },
  };
}

function effectiveUnitStatus(state, plan, states) {
  const kind = state.logical_unit_key.kind;
  const planUnit = [...plan.reader_units, ...plan.evaluator_units].find((unit) => unit.unit_id === state.unit_id);
  const byId = new Map(states.map((item) => [item.unit_id, item]));
  const dependencyBlocked = kind === "evaluator" && state.status === "pending" &&
    planUnit.dependencies.some((dependency) => byId.get(dependency.unit_id)?.status !== "succeeded");
  const budgetBlocked = ["pending", "failed"].includes(state.status) &&
    state.attempt_summaries.length >= plan.process_settings.max_attempts;
  return {
    unit_id: state.unit_id,
    kind,
    persisted_status: state.status,
    effective_status: dependencyBlocked || budgetBlocked ? "blocked" : state.status,
    block_reason: budgetBlocked
      ? "attempt_budget_exhausted"
      : dependencyBlocked ? "dependency_not_ready" : state.block_reason,
    current_revision: state.current_revision,
    current_behavior_fingerprint: state.current_behavior_fingerprint,
    active_attempt_id: state.active_attempt?.attempt_id ?? null,
    accepted_attempt_id: state.accepted_attempt?.attempt_id ?? null,
    attempt_count: state.attempt_summaries.length + (state.active_attempt === null ? 0 : 1),
  };
}

function derivedRun(previousRun, plan, states) {
  const [status, statusReason] = deriveRevisionRunStatus(previousRun, plan, states);
  return { ...previousRun, status, status_reason: statusReason };
}

async function finalizeReadyEvaluators({ loaded, statesById, allowedIds = null }) {
  const prepared = new Map();
  for (const evaluator of loaded.plan.evaluator_units) {
    if (allowedIds !== null && !allowedIds.has(evaluator.unit_id)) continue;
    const state = statesById.get(evaluator.unit_id);
    if (state.status !== "pending" || state.attempt_summaries.length >= loaded.plan.process_settings.max_attempts) continue;
    const dependencies = evaluator.dependencies.map((dependency) => statesById.get(dependency.unit_id));
    if (!dependencies.every((dependency) => dependency?.status === "succeeded")) continue;
    const bindings = evaluator.dependencies.map((dependency, index) =>
      resolveAcceptedReaderEvidence({
        runRoot: loaded.runPath,
        runId: loaded.run.run_id,
        unitState: dependencies[index],
        sourceRole: dependency.source_role,
      }));
    const descriptor = compileEvaluatorPreparedUnitDescriptor({
      staticPlan: evaluator,
      bindings,
      cliOptions: loaded.plan.cli_behavior_options,
    });
    const preparedUnit = materializePreparedUnitDescriptor({
      preparedRoot: join(loaded.runPath, "revisions", String(loaded.plan.revision), "prepared"),
      descriptor,
    });
    const dependencyBindings = bindings.map((binding) => ({
      source_role: binding.source_role,
      unit_id: binding.unit_id,
      producer_behavior_fingerprint: binding.producer_behavior_fingerprint,
      structured_output_sha256: binding.structured_output_sha256,
    })).sort((left, right) => compareStrings(left.source_role, right.source_role));
    const next = {
      ...state,
      current_behavior_fingerprint: sha256Canonical(descriptor.behavior_projection),
      dependency_bindings: dependencyBindings,
      status: "pending",
    };
    if (canonicalJson(state) !== canonicalJson(next)) writeCliUnitState({ runPath: loaded.runPath, plan: loaded.plan, state: next });
    statesById.set(next.unit_id, next);
    prepared.set(next.unit_id, preparedUnit);
  }
  return prepared;
}

function serializedReaderDescriptor(unit) {
  return {
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
}

function preparedReaderFromPlan(runPath, unit) {
  const descriptor = serializedReaderDescriptor(unit);
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

function sortedUnique(values) {
  return [...new Set(values)].sort(compareStrings);
}

function writeExclusive(path, bytes) {
  mkdirSync(dirname(path), { recursive: true });
  let descriptor;
  try {
    if (existsSync(path)) throw new Error("exists");
    descriptor = openSync(path, "wx");
    writeFileSync(descriptor, bytes);
  } catch {
    throw new ArtifactError(
      "EXECUTION_OVERWRITE_REFUSED",
      "Refused to overwrite the Stage 1 command summary.",
      3,
    );
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function writeOutput(injected, fallback, value) {
  if (injected?.write) injected.write(value);
  else fallback.write(value);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const interruption = new AbortController();
  const abort = () => interruption.abort();
  process.once("SIGINT", abort);
  process.once("SIGTERM", abort);
  try {
    process.exitCode = await main(process.argv.slice(2), { signal: interruption.signal });
  } finally {
    process.removeListener("SIGINT", abort);
    process.removeListener("SIGTERM", abort);
  }
}
