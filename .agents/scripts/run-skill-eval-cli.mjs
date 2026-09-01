import { existsSync, mkdirSync, openSync, closeSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { availableParallelism } from "node:os";
import { pathToFileURL } from "node:url";
import { ArtifactError, canonicalJson } from "./lib/skill-evals/artifact-schema-v1.mjs";
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
} from "./lib/skill-evals/cli-execution-plan-v1.mjs";
import { publishNextCliRevision, upgradeCliRunToV2 } from "./lib/skill-evals/cli-run-state-v1.mjs";

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

  node .agents/scripts/run-skill-eval-cli.mjs execute-prepared \\
    --workspace <ws-[a-f0-9]{32}> \\
    --unit <candidate|baseline>:<regression|routing|fresh-reader>:<case_id> \\
    [--unit <...>] [--concurrency <positive-integer>]

prepare creates revision 1; prepare --run publishes the same-scope next revision.
Both commands execute 0 reader/evaluator calls. Stage 3 still provides no evaluator dispatch or report.

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

function createStage3PrepareResult({ run, plan, states }) {
  const unitStatuses = states.map((state) => {
    const kind = state.logical_unit_key.kind;
    const dependencyBlocked = kind === "evaluator" && state.dependency_bindings === null;
    return {
      unit_id: state.unit_id,
      kind,
      persisted_status: state.status,
      effective_status: dependencyBlocked ? "blocked" : state.status,
      block_reason: dependencyBlocked ? "dependency_not_ready" : state.block_reason,
      current_revision: state.current_revision,
      current_behavior_fingerprint: state.current_behavior_fingerprint,
      active_attempt_id: state.active_attempt?.attempt_id ?? null,
      accepted_attempt_id: state.accepted_attempt?.attempt_id ?? null,
      attempt_count: state.attempt_summaries.length + (state.active_attempt === null ? 0 : 1),
    };
  }).sort((left, right) => compareStrings(left.unit_id, right.unit_id));
  const count = (predicate) => unitStatuses.filter(predicate).length;
  return {
    schema_version: 1,
    artifact_type: "cli_run_command_result",
    command: "prepare",
    status: "succeeded",
    run_id: run.run_id,
    workspace_id: run.workspace_id,
    revision: run.current_revision,
    run_status: run.status,
    run_status_reason: run.status_reason,
    mode: run.mode,
    requested_unit_ids: [],
    affected_unit_ids: [],
    dispatched_unit_ids: [],
    reused_unit_ids: [],
    invalidated_unit_ids: [],
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
    dispatch_counts: { reader: 0, evaluator: 0, total: 0 },
  };
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
