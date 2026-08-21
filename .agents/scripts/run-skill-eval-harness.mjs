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

const usage = `Usage:
  node .agents/scripts/run-skill-eval-harness.mjs schema validate --file <artifact.json>
  node .agents/scripts/run-skill-eval-harness.mjs store root
  node .agents/scripts/run-skill-eval-harness.mjs state inspect --run <run-id>
  node .agents/scripts/run-skill-eval-harness.mjs reader progress --run <run-id>
  node .agents/scripts/run-skill-eval-harness.mjs reader resume-plan --run <run-id>

Validates schema-v2 artifacts and inspects durable local state without executing a model, helper, evaluator, or provider.
`;

main();

function main() {
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
