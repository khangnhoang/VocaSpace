import { randomUUID } from "node:crypto";
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { ArtifactError, canonicalJson, parseStrictJson, sha256Bytes, sha256Canonical } from "./artifact-schema-v1.mjs";
import { cliBehaviorOptions, readerOutputSchema } from "./codex-cli-runner-v1.mjs";
import { evaluatorProposalSchema } from "./cli-evaluator-proposal-v1.mjs";

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
