import { lstatSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  ArtifactError,
  canonicalJson,
  parseStrictJson,
  sha256Bytes,
  sha256Canonical,
} from "./artifact-schema-v1.mjs";
import { assertCliExecutionPlan } from "./cli-execution-plan-v1.mjs";

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
