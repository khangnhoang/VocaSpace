import { existsSync, mkdirSync, openSync, closeSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { ArtifactError, canonicalJson } from "./lib/skill-evals/artifact-schema-v1.mjs";
import {
  createCommandSummary,
  createExecutionId,
  defaultConcurrency,
  executePreparedUnit,
  loadSelectedWorkspace,
  materializePreparedUnits,
  parseUnitSelector,
  preflightCodexCli,
  runBoundedPool,
} from "./lib/skill-evals/codex-cli-runner-v1.mjs";

const usage = `Usage:
  node .agents/scripts/run-skill-eval-cli.mjs execute-prepared \\
    --workspace <ws-[a-f0-9]{32}> \\
    --unit <candidate|baseline>:<regression|routing|fresh-reader>:<case_id> \\
    [--unit <...>] [--concurrency <positive-integer>]

Consumes an already prepared v1 workspace and executes reader units only.
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
  return { workspaceId, selectors, concurrency };
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
