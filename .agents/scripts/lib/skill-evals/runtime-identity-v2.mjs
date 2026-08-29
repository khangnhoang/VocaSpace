import { canonicalJson, sha256Canonical } from "./artifact-schema-v1.mjs";

export const behaviorRuntimeProjectionKeys = Object.freeze([
  "adapter_id",
  "adapter_version",
  "assurance_profile",
  "auth_mode",
  "capability_limitations",
  "codex_version",
  "config_sha256",
  "effective_policy",
  "effort",
  "executable_path",
  "executable_sha256",
  "fresh_context_method",
  "instruction_sources",
  "model",
  "platform",
  "protocol_schema_sha256",
  "runtime_identity",
  "transport",
]);

export function assertBehaviorRuntimeProjection(value, label = "behavior runtime projection") {
  assertRecord(value, label);
  assertExactKeys(value, behaviorRuntimeProjectionKeys, label);
  for (const field of [
    "adapter_id",
    "adapter_version",
    "assurance_profile",
    "auth_mode",
    "codex_version",
    "effort",
    "executable_path",
    "fresh_context_method",
    "model",
    "platform",
    "runtime_identity",
    "transport",
  ]) {
    assertNonEmptyString(value[field], `${label}.${field}`);
  }
  for (const field of ["config_sha256", "executable_sha256", "protocol_schema_sha256"]) {
    assertHash(value[field], `${label}.${field}`);
  }
  assertJsonValue(value.effective_policy, `${label}.effective_policy`);
  assertSortedUniqueStrings(value.capability_limitations, `${label}.capability_limitations`);
  if (!Array.isArray(value.instruction_sources)) fail(`${label}.instruction_sources must be an array.`);
  const paths = [];
  for (const [index, source] of value.instruction_sources.entries()) {
    const sourceLabel = `${label}.instruction_sources[${index}]`;
    assertRecord(source, sourceLabel);
    assertExactKeys(source, ["path", "sha256"], sourceLabel);
    assertNonEmptyString(source.path, `${sourceLabel}.path`);
    assertHash(source.sha256, `${sourceLabel}.sha256`);
    paths.push(source.path);
  }
  assertSortedUniqueStrings(paths, `${label}.instruction_sources paths`);
  return structuredClone(value);
}

export function deriveBehaviorRuntimeProjection(value, label) {
  return assertBehaviorRuntimeProjection(value, label);
}

export function behaviorRuntimeProjectionSha256(value) {
  return sha256Canonical(assertBehaviorRuntimeProjection(value));
}

export function deriveVerificationHelperInputIdentity({ cluster, compiledInvocationSha256, helperIndex }) {
  assertRecord(cluster, "verification helper cluster");
  assertHash(compiledInvocationSha256, "verification helper compiled invocation hash");
  if (!Number.isInteger(helperIndex) || helperIndex < 1 || helperIndex > 2) {
    fail("verification helper index must be 1 or 2.");
  }
  const canonical_input = structuredClone({
    cluster,
    compiled_invocation_sha256: compiledInvocationSha256,
    runtime_config: cluster.runtime,
  });
  assertJsonValue(canonical_input, "verification helper canonical input");
  return {
    canonical_input,
    helper_index: helperIndex,
    helper_input_hash: sha256Canonical(canonical_input),
  };
}

function assertRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object.`);
}

function assertExactKeys(value, keys, label) {
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail(`${label} has unexpected or missing fields.`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    fail(`${label} must be a non-empty exact string.`);
  }
}

function assertHash(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail(`${label} must be a SHA-256 hash.`);
}

function assertSortedUniqueStrings(value, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) fail(`${label} must contain strings.`);
  const sorted = [...value].sort();
  if (canonicalJson(sorted) !== canonicalJson(value) || new Set(value).size !== value.length) {
    fail(`${label} must be sorted and unique.`);
  }
}

function assertJsonValue(value, label) {
  try {
    canonicalJson(value);
  } catch {
    fail(`${label} must be canonical JSON data.`);
  }
}

function fail(message) {
  const error = new Error(message);
  error.code = "RUNTIME_IDENTITY_INVALID";
  error.exitCode = 4;
  throw error;
}
