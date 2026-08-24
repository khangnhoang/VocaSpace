#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  HarnessError,
  assertHarnessArtifact,
  harnessSchemaVersion,
  parseHarnessJson,
} from "./lib/skill-evals/harness-schema-v2.mjs";
import { inspectRunState, planResume, resolveHarnessStoreRoot } from "./lib/skill-evals/run-store-v2.mjs";
import { deriveReaderProgress } from "./lib/skill-evals/orchestrator-v2.mjs";
import { executeCp9LivePlan, preflightCp9AppServer } from "./lib/skill-evals/cp9-live-v2.mjs";
import {
  applyRetentionPlan,
  createRetentionPlan,
  inventoryLegacyV1,
  purgeRetentionPlan,
} from "./lib/skill-evals/retention-v2.mjs";

const usage = `Usage:
  node .agents/scripts/run-skill-eval-harness.mjs schema validate --file <artifact.json>
  node .agents/scripts/run-skill-eval-harness.mjs store root
  node .agents/scripts/run-skill-eval-harness.mjs state inspect --run <run-id>
  node .agents/scripts/run-skill-eval-harness.mjs reader progress --run <run-id>
  node .agents/scripts/run-skill-eval-harness.mjs reader resume-plan --run <run-id>
  node .agents/scripts/run-skill-eval-harness.mjs retention plan --task <task-id>
  node .agents/scripts/run-skill-eval-harness.mjs retention apply --plan <plan-sha256> --authority <authority.json>
  node .agents/scripts/run-skill-eval-harness.mjs retention purge --apply <apply-sha256> --authority <authority.json>
  node .agents/scripts/run-skill-eval-harness.mjs legacy inventory --root <legacy-root>
  node .agents/scripts/run-skill-eval-harness.mjs cp9 preflight --executable <path-or-name>
  node .agents/scripts/run-skill-eval-harness.mjs cp9 live --plan <cp9-plan.json> --authority <authority-reference.json> --executable <path-or-name>

The explicitly named CP9 live command alone can dispatch the frozen CP9 reader/evaluator workload after canonical authority resolution. Preflight never creates a thread or model turn. No helper or arbitrary-prompt command exists.
`;

await main();

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    process.stdout.write(usage);
    return;
  }
  if (args.length === 2 && args[0] === "store" && args[1] === "root") {
    try {
      process.stdout.write(`${resolveHarnessStoreRoot(process.cwd())}\n`);
    } catch {
      process.stderr.write("HARNESS_STORE_ERROR: Unable to resolve the repository harness store.\n");
      process.exitCode = 1;
    }
    return;
  }
  if (args.length === 4 && args[0] === "state" && args[1] === "inspect" && args[2] === "--run") {
    try {
      const state = inspectRunState(resolveHarnessStoreRoot(process.cwd()), args[3]);
      process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
    } catch (error) {
      const failure =
        error instanceof HarnessError
          ? error
          : new HarnessError("HARNESS_STORE_ERROR", "Unable to inspect the requested harness run.");
      process.stderr.write(`${failure.code}: ${failure.message}\n`);
      process.exitCode = failure.exitCode;
    }
    return;
  }
  if (
    args.length === 4 &&
    args[0] === "reader" &&
    ["progress", "resume-plan"].includes(args[1]) &&
    args[2] === "--run"
  ) {
    try {
      const root = resolveHarnessStoreRoot(process.cwd());
      const value = args[1] === "progress" ? deriveReaderProgress(root, args[3]) : planResume(root, args[3]);
      process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    } catch (error) {
      const failure =
        error instanceof HarnessError
          ? error
          : new HarnessError("HARNESS_STORE_ERROR", "Unable to inspect reader orchestration state.");
      process.stderr.write(`${failure.code}: ${failure.message}\n`);
      process.exitCode = failure.exitCode;
    }
    return;
  }
  if (args.length === 4 && args[0] === "retention" && args[1] === "plan" && args[2] === "--task") {
    runLocalCommand(() => createRetentionPlan(resolveHarnessStoreRoot(process.cwd()), { taskId: args[3] }));
    return;
  }
  if (
    args.length === 6 &&
    args[0] === "retention" &&
    ["apply", "purge"].includes(args[1]) &&
    args[2] === (args[1] === "apply" ? "--plan" : "--apply") &&
    args[4] === "--authority"
  ) {
    runLocalCommand(() => {
      const root = resolveHarnessStoreRoot(process.cwd());
      const authorityReference = parseHarnessJson(
        readFileSync(resolve(process.cwd(), args[5])),
        "cleanup authority reference",
      );
      return args[1] === "apply"
        ? applyRetentionPlan(root, { authorityReference, planSha256: args[3] })
        : purgeRetentionPlan(root, { applySha256: args[3], authorityReference });
    });
    return;
  }
  if (args.length === 4 && args[0] === "legacy" && args[1] === "inventory" && args[2] === "--root") {
    runLocalCommand(() => inventoryLegacyV1(resolve(process.cwd(), args[3])));
    return;
  }
  if (args.length === 4 && args[0] === "cp9" && args[1] === "preflight" && args[2] === "--executable") {
    await runAsyncCommand(() => preflightCp9AppServer({ executable: args[3] }), "CP9_PREFLIGHT_ERROR");
    return;
  }
  if (
    args.length === 8 && args[0] === "cp9" && args[1] === "live" &&
    args[2] === "--plan" && args[4] === "--authority" && args[6] === "--executable"
  ) {
    await runAsyncCommand(() => {
      const plan = parseHarnessJson(readFileSync(resolve(process.cwd(), args[3])), "CP9 live plan");
      const authorityReference = parseHarnessJson(readFileSync(resolve(process.cwd(), args[5])), "live authority reference");
      return executeCp9LivePlan({
        authorityReference,
        executable: args[7],
        plan,
        storeRoot: resolveHarnessStoreRoot(process.cwd()),
      });
    }, "CP9_LIVE_ERROR");
    return;
  }
  if (args.length !== 4 || args[0] !== "schema" || args[1] !== "validate" || args[2] !== "--file") {
    process.stderr.write(usage);
    process.exitCode = 2;
    return;
  }
  try {
    const artifactPath = resolve(process.cwd(), args[3]);
    const value = parseHarnessJson(readFileSync(artifactPath), "harness artifact");
    const artifact = assertHarnessArtifact(value);
    process.stdout.write(
      `${JSON.stringify(
        {
          schema_version: harnessSchemaVersion,
          artifact_type: "validation_result",
          status: "valid",
          validated_artifact_type: artifact.artifact_type,
          artifact_id: artifact.artifact_id,
          content_sha256: artifact.content_sha256,
        },
        null,
        2,
      )}\n`,
    );
  } catch (error) {
    const failure =
      error instanceof HarnessError
        ? error
        : new HarnessError("HARNESS_IO_ERROR", "Unable to read the requested harness artifact.");
    process.stderr.write(`${failure.code}: ${failure.message}\n`);
    process.exitCode = failure.exitCode;
  }
}

async function runAsyncCommand(operation, fallbackCode) {
  try {
    process.stdout.write(`${JSON.stringify(await operation(), null, 2)}\n`);
  } catch (error) {
    const failure = error instanceof HarnessError ? error : new HarnessError(fallbackCode, "Unable to complete the bounded CP9 operation.");
    const status = typeof error?.runtimeStatus === "string" ? ` status=${error.runtimeStatus}` : "";
    process.stderr.write(`${failure.code}: ${failure.message}${status}\n`);
    process.exitCode = failure.exitCode;
  }
}

function runLocalCommand(operation) {
  try {
    process.stdout.write(`${JSON.stringify(operation(), null, 2)}\n`);
  } catch (error) {
    const failure =
      error instanceof HarnessError
        ? error
        : new HarnessError("HARNESS_STORE_ERROR", "Unable to complete the requested local harness operation.");
    process.stderr.write(`${failure.code}: ${failure.message}\n`);
    process.exitCode = failure.exitCode;
  }
}
