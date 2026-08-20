#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  HarnessError,
  assertHarnessArtifact,
  harnessSchemaVersion,
  parseHarnessJson,
} from "./lib/skill-evals/harness-schema-v2.mjs";

const usage = `Usage:
  node .agents/scripts/run-skill-eval-harness.mjs schema validate --file <artifact.json>

Validates strict schema-v2 harness artifacts without executing a model, helper, evaluator, or provider.
`;

main();

function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ["--help", "-h"].includes(args[0])) {
    process.stdout.write(usage);
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
