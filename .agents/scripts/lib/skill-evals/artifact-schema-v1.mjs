import { createHash } from "node:crypto";

export const artifactSchemaVersion = 1;
export const suiteOrder = Object.freeze(["regression", "routing", "fresh-reader"]);
export const caseStatuses = Object.freeze([
  "passed",
  "partially_passed",
  "failed",
  "not_run",
]);
export const comparisonStatuses = Object.freeze([
  "improved",
  "equivalent",
  "regressed",
  "inconclusive",
]);

export class ArtifactError extends Error {
  constructor(code, message, exitCode = 1) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
  }
}

export function canonicalJson(value) {
  return `${JSON.stringify(sortObjectKeys(value), null, 2)}\n`;
}

export function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256Canonical(value) {
  return sha256Bytes(Buffer.from(canonicalJson(value), "utf8"));
}

export function parseStrictJson(bytes, label) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ArtifactError("ARTIFACT_ENCODING_INVALID", `${label} must contain valid UTF-8.`);
  }
  if (!text.endsWith("\n")) {
    throw new ArtifactError("ARTIFACT_FINAL_NEWLINE_MISSING", `${label} must end with a newline.`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new ArtifactError("ARTIFACT_JSON_INVALID", `${label} must contain valid JSON.`);
  }
}

export function assertWorkspaceManifest(value, expectedWorkspaceId) {
  assertRecord(value, "workspace_manifest");
  assertExactKeys(
    value,
    [
      "artifact_inventory",
      "artifact_type",
      "control_plane",
      "mode",
      "schema_version",
      "skill",
      "sources",
      "source_roles",
      "variant_mapping",
      "workspace_id",
      "workspace_input_hash",
    ],
    "workspace_manifest",
  );
  assertVersionAndType(value, "workspace_manifest");
  assertIdentity(value.workspace_id, "workspace_id");
  if (value.workspace_id !== expectedWorkspaceId) {
    throw new ArtifactError(
      "ARTIFACT_IDENTITY_MISMATCH",
      "workspace_manifest workspace_id does not match the requested workspace.",
    );
  }
  assertIdentity(value.skill, "skill");
  assertEnum(value.mode, ["candidate_only", "comparison"], "mode");
  assertHash(value.workspace_input_hash, "workspace_input_hash");
  assertRecord(value.control_plane, "control_plane");
  assertExactKeys(
    value.control_plane,
    ["aggregate_sha256", "files", "resolved_commit", "working_tree_state"],
    "control_plane",
  );
  assertHash(value.control_plane.aggregate_sha256, "control_plane.aggregate_sha256");
  assertCommit(value.control_plane.resolved_commit, "control_plane.resolved_commit");
  assertEnum(
    value.control_plane.working_tree_state,
    ["clean", "dirty"],
    "control_plane.working_tree_state",
  );
  assertArray(value.control_plane.files, "control_plane.files");
  for (const entry of value.control_plane.files) assertManifestEntry(entry, "control_plane entry");
  assertSortedUniquePaths(value.control_plane.files, "control_plane files");
  if (sha256Canonical(value.control_plane.files) !== value.control_plane.aggregate_sha256) {
    throw new ArtifactError(
      "INTEGRITY_MISMATCH",
      "control_plane aggregate hash does not match.",
      3,
    );
  }
  assertRecord(value.sources, "sources");
  assertArray(value.source_roles, "source_roles");
  assertRecord(value.variant_mapping, "variant_mapping");
  assertArray(value.artifact_inventory, "artifact_inventory");
  const expectedRoles = value.mode === "candidate_only" ? ["candidate"] : ["baseline", "candidate"];
  if (!sameArray(value.source_roles, expectedRoles)) {
    throw new ArtifactError(
      "ARTIFACT_RELATIONSHIP_INVALID",
      "workspace_manifest source_roles do not match its mode.",
    );
  }
  assertExactKeys(value.sources, expectedRoles, "sources");
  for (const role of expectedRoles) assertSourceProvenance(value.sources[role], role);
  const variants = Object.keys(value.variant_mapping).sort();
  const expectedVariants = value.mode === "candidate_only" ? ["A"] : ["A", "B"];
  if (!sameArray(variants, expectedVariants)) {
    throw new ArtifactError(
      "ARTIFACT_RELATIONSHIP_INVALID",
      "workspace_manifest variant_mapping does not match its mode.",
    );
  }
  const mappedRoles = variants.map((variant) => value.variant_mapping[variant]).sort();
  if (!sameArray(mappedRoles, expectedRoles)) {
    throw new ArtifactError(
      "ARTIFACT_RELATIONSHIP_INVALID",
      "workspace_manifest variant_mapping must map each source role exactly once.",
    );
  }
  for (const entry of value.artifact_inventory) assertManifestEntry(entry, "artifact_inventory entry");
  assertSortedUniquePaths(value.artifact_inventory, "artifact_inventory");
  const expectedInputHash = sha256Canonical({
    control_plane_hash: value.control_plane.aggregate_sha256,
    control_plane_resolved_commit: value.control_plane.resolved_commit,
    control_plane_working_tree_state: value.control_plane.working_tree_state,
    mode: value.mode,
    skill: value.skill,
    sources: Object.fromEntries(
      expectedRoles.map((role) => [
        role,
        {
          bundle_hash: value.sources[role].bundle_hash,
          requested_ref: value.sources[role].requested_ref,
          resolved_commit: value.sources[role].resolved_commit,
          selector: value.sources[role].selector,
        },
      ]),
    ),
    variant_mapping: value.variant_mapping,
  });
  if (expectedInputHash !== value.workspace_input_hash) {
    throw new ArtifactError("INTEGRITY_MISMATCH", "workspace_input_hash does not match.", 3);
  }
  return value;
}

function assertSourceProvenance(value, role) {
  assertRecord(value, `${role} source`);
  assertExactKeys(
    value,
    [
      "bundle_hash",
      "files",
      "requested_ref",
      "resolved_commit",
      "selector",
      "working_tree_state",
    ],
    `${role} source`,
  );
  assertEnum(value.selector, ["current_tree", "ref"], `${role}.selector`);
  if (value.selector === "current_tree") {
    if (value.requested_ref !== null) {
      throw new ArtifactError(
        "ARTIFACT_RELATIONSHIP_INVALID",
        `${role}.requested_ref must be null for current_tree.`,
      );
    }
    assertEnum(value.working_tree_state, ["clean", "dirty"], `${role}.working_tree_state`);
  } else {
    assertTrimmedString(value.requested_ref, `${role}.requested_ref`);
    if (value.working_tree_state !== "not_applicable") {
      throw new ArtifactError(
        "ARTIFACT_RELATIONSHIP_INVALID",
        `${role}.working_tree_state must be not_applicable for ref sources.`,
      );
    }
  }
  assertCommit(value.resolved_commit, `${role}.resolved_commit`);
  assertHash(value.bundle_hash, `${role}.bundle_hash`);
  assertArray(value.files, `${role}.files`);
  for (const entry of value.files) assertManifestEntry(entry, `${role} source entry`);
  assertSortedUniquePaths(value.files, `${role} source files`);
  if (sha256Canonical(value.files) !== value.bundle_hash) {
    throw new ArtifactError("INTEGRITY_MISMATCH", `${role} bundle hash does not match.`, 3);
  }
}

export function assertBundleManifest(value, expected) {
  assertRecord(value, "bundle_manifest");
  assertExactKeys(
    value,
    [
      "aggregate_sha256",
      "artifact_type",
      "files",
      "schema_version",
      "skill",
      "variant_id",
      "workspace_id",
    ],
    "bundle_manifest",
  );
  assertVersionAndType(value, "bundle_manifest");
  assertCommonIdentity(value, expected);
  assertEnum(value.variant_id, ["A", "B"], "variant_id");
  assertHash(value.aggregate_sha256, "aggregate_sha256");
  assertArray(value.files, "files");
  for (const entry of value.files) assertManifestEntry(entry, "bundle manifest entry");
  assertSortedUniquePaths(value.files, "bundle manifest");
  const envelope = { ...value };
  delete envelope.aggregate_sha256;
  if (sha256Canonical(envelope) !== value.aggregate_sha256) {
    throw new ArtifactError("INTEGRITY_MISMATCH", "bundle_manifest aggregate hash does not match.", 3);
  }
  return value;
}

export function assertExecutionContextManifest(value, expected) {
  assertRecord(value, "execution_context_manifest");
  assertExactKeys(
    value,
    [
      "artifact_type",
      "case_id",
      "context",
      "execution_context_hash",
      "prompt_sha256",
      "requested_execution_policy",
      "schema_version",
      "skill",
      "suite",
      "variant_id",
      "workspace_id",
    ],
    "execution_context_manifest",
  );
  assertVersionAndType(value, "execution_context_manifest");
  assertCommonIdentity(value, expected);
  assertIdentity(value.case_id, "case_id");
  assertEnum(value.suite, suiteOrder, "suite");
  assertEnum(value.variant_id, ["A", "B"], "variant_id");
  assertHash(value.prompt_sha256, "prompt_sha256");
  assertHash(value.execution_context_hash, "execution_context_hash");
  assertArray(value.context, "context");
  for (const entry of value.context) assertManifestEntry(entry, "execution context entry");
  assertSortedUniquePaths(value.context, "execution context");
  assertRecord(value.requested_execution_policy, "requested_execution_policy");
  const envelope = { ...value };
  delete envelope.execution_context_hash;
  if (sha256Canonical(envelope) !== value.execution_context_hash) {
    throw new ArtifactError(
      "INTEGRITY_MISMATCH",
      "execution_context_manifest aggregate hash does not match.",
      3,
    );
  }
  return value;
}

export function assertObservation(value, expected) {
  assertRecord(value, "observation");
  assertExactKeys(
    value,
    [
      "artifact_type",
      "case_id",
      "execution_context_hash",
      "execution_reason",
      "execution_status",
      "observed_access",
      "raw_response",
      "schema_version",
      "skill",
      "suite",
      "variant_id",
      "workspace_id",
    ],
    "observation",
  );
  const expectedType =
    expected.role === "candidate" ? "candidate_observation" : "baseline_observation";
  assertVersionAndType(value, expectedType);
  assertCommonIdentity(value, expected);
  assertIdentity(value.case_id, "case_id");
  assertEnum(value.suite, suiteOrder, "suite");
  assertEnum(value.variant_id, ["A", "B"], "variant_id");
  assertHash(value.execution_context_hash, "execution_context_hash");
  if (value.execution_context_hash !== expected.executionContextHash) {
    throw new ArtifactError(
      "ARTIFACT_IDENTITY_MISMATCH",
      "Observation execution_context_hash does not match the prepared case.",
    );
  }
  assertEnum(value.execution_status, ["completed", "not_run"], "execution_status");
  if (value.execution_status === "not_run") {
    assertTrimmedString(value.execution_reason, "execution_reason");
  } else if (value.execution_reason !== null) {
    throw new ArtifactError(
      "ARTIFACT_RELATIONSHIP_INVALID",
      "A completed observation must use execution_reason: null.",
    );
  }
  if (typeof value.raw_response !== "string") {
    throw new ArtifactError("ARTIFACT_SCHEMA_INVALID", "raw_response must be a string.");
  }
  assertObservedAccess(value.observed_access);
  return value;
}

export function assertHumanEvaluation(value, expected) {
  assertRecord(value, "human_evaluation");
  assertExactKeys(
    value,
    [
      "artifact_type",
      "case_id",
      "case_status",
      "comparison_status",
      "observation_hashes",
      "rationale",
      "schema_version",
      "skill",
      "suite",
      "workspace_id",
    ],
    "human_evaluation",
  );
  assertVersionAndType(value, "human_evaluation");
  assertCommonIdentity(value, expected);
  assertIdentity(value.case_id, "case_id");
  assertEnum(value.suite, suiteOrder, "suite");
  assertEnum(value.case_status, caseStatuses, "case_status");
  assertTrimmedString(value.rationale, "rationale");
  assertRecord(value.observation_hashes, "observation_hashes");
  const expectedHashKeys =
    expected.mode === "candidate_only" ? ["candidate"] : ["baseline", "candidate"];
  assertExactKeys(value.observation_hashes, expectedHashKeys, "observation_hashes");
  for (const role of expectedHashKeys) {
    assertHash(value.observation_hashes[role], `observation_hashes.${role}`);
    if (value.observation_hashes[role] !== expected.observationHashes[role]) {
      throw new ArtifactError(
        "ARTIFACT_IDENTITY_MISMATCH",
        `human_evaluation ${role} observation hash does not match.`,
      );
    }
  }
  if (expected.mode === "candidate_only") {
    if (value.comparison_status !== null) {
      throw new ArtifactError(
        "ARTIFACT_RELATIONSHIP_INVALID",
        "Candidate-only human_evaluation must use comparison_status: null.",
      );
    }
  } else {
    assertEnum(value.comparison_status, comparisonStatuses, "comparison_status");
    if (
      Object.values(expected.executionStatuses).includes("not_run") &&
      value.comparison_status !== "inconclusive"
    ) {
      throw new ArtifactError(
        "ARTIFACT_RELATIONSHIP_INVALID",
        "A comparison containing not_run evidence must remain inconclusive.",
      );
    }
  }
  if (expected.candidateExecutionStatus === "not_run" && value.case_status !== "not_run") {
    throw new ArtifactError(
      "ARTIFACT_RELATIONSHIP_INVALID",
      "A candidate not_run observation requires human case_status: not_run.",
    );
  }
  if (expected.candidateExecutionStatus === "completed" && value.case_status === "not_run") {
    throw new ArtifactError(
      "ARTIFACT_RELATIONSHIP_INVALID",
      "Human case_status not_run requires a candidate not_run observation.",
    );
  }
  return value;
}

export function manifestEntry(path, bytes, extra = {}) {
  return {
    path,
    byte_count: bytes.length,
    git_status: null,
    line_count: countTextLines(bytes),
    sha256: sha256Bytes(bytes),
    ...extra,
  };
}

function assertObservedAccess(value) {
  assertRecord(value, "observed_access");
  const keys = [
    "basis",
    "credentials",
    "filesystem",
    "model_runtime",
    "mutation",
    "network",
    "process",
    "remote",
    "tools",
  ];
  assertExactKeys(value, keys, "observed_access");
  assertTrimmedString(value.basis, "observed_access.basis");
  for (const key of keys.filter((item) => item !== "basis")) {
    assertEnum(value[key], ["observed", "not_observed", "unknown"], `observed_access.${key}`);
  }
}

function assertManifestEntry(value, label) {
  assertRecord(value, label);
  const allowed = [
    "byte_count",
    "git_status",
    "line_count",
    "path",
    "present",
    "sha256",
    "status",
  ];
  const required =
    value.present === false
      ? ["git_status", "path", "present", "status"]
      : ["byte_count", "git_status", "line_count", "path", "sha256"];
  assertAllowedAndRequiredKeys(value, allowed, required, label);
  assertNormalizedPath(value.path, `${label}.path`);
  assertGitStatus(value.git_status, `${label}.git_status`);
  if (value.present === false) {
    assertEnum(value.status, ["deleted"], `${label}.status`);
    return;
  }
  if (!Number.isSafeInteger(value.byte_count) || value.byte_count < 0) {
    throw new ArtifactError("ARTIFACT_SCHEMA_INVALID", `${label}.byte_count must be a non-negative integer.`);
  }
  if (
    value.line_count !== null &&
    (!Number.isSafeInteger(value.line_count) || value.line_count < 0)
  ) {
    throw new ArtifactError(
      "ARTIFACT_SCHEMA_INVALID",
      `${label}.line_count must be a non-negative integer or null.`,
    );
  }
  assertHash(value.sha256, `${label}.sha256`);
  if (Object.hasOwn(value, "status")) {
    assertEnum(value.status, ["tracked", "untracked", "ignored_explicit"], `${label}.status`);
  }
}

function assertGitStatus(value, label) {
  if (
    value !== null &&
    (typeof value !== "string" || !/^(?:[ MADRCU?!]{2})$/.test(value))
  ) {
    throw new ArtifactError(
      "ARTIFACT_SCHEMA_INVALID",
      `${label} must be a two-character porcelain status or null.`,
    );
  }
}

function countTextLines(bytes) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  if (text.length === 0) return 0;
  const newlineCount = [...text].filter((character) => character === "\n").length;
  return text.endsWith("\n") ? newlineCount : newlineCount + 1;
}

function assertSortedUniquePaths(entries, label) {
  const paths = entries.map((entry) => entry.path);
  const sorted = [...paths].sort(compareStrings);
  if (!sameArray(paths, sorted) || new Set(paths).size !== paths.length) {
    throw new ArtifactError(
      "ARTIFACT_RELATIONSHIP_INVALID",
      `${label} paths must be unique and lexicographically sorted.`,
    );
  }
}

function assertCommonIdentity(value, expected) {
  if (value.workspace_id !== expected.workspaceId || value.skill !== expected.skill) {
    throw new ArtifactError(
      "ARTIFACT_IDENTITY_MISMATCH",
      "Artifact workspace_id or skill does not match the workspace.",
    );
  }
}

function assertVersionAndType(value, artifactType) {
  if (Number.isInteger(value.schema_version) && value.schema_version !== artifactSchemaVersion) {
    throw new ArtifactError(
      "ARTIFACT_VERSION_UNSUPPORTED",
      `Artifact schema version ${value.schema_version} is unsupported.`,
      2,
    );
  }
  if (value.schema_version !== artifactSchemaVersion) {
    throw new ArtifactError(
      "ARTIFACT_SCHEMA_INVALID",
      `schema_version must be integer ${artifactSchemaVersion}.`,
    );
  }
  if (value.artifact_type !== artifactType) {
    throw new ArtifactError(
      "ARTIFACT_SCHEMA_INVALID",
      `artifact_type must be '${artifactType}'.`,
    );
  }
}

function assertRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ArtifactError("ARTIFACT_SCHEMA_INVALID", `${label} must be a JSON object.`);
  }
}

function assertArray(value, label) {
  if (!Array.isArray(value)) {
    throw new ArtifactError("ARTIFACT_SCHEMA_INVALID", `${label} must be an array.`);
  }
}

function assertExactKeys(value, keys, label) {
  assertAllowedAndRequiredKeys(value, keys, keys, label);
}

function assertAllowedAndRequiredKeys(value, allowed, required, label) {
  const allowedSet = new Set(allowed);
  for (const key of required) {
    if (!Object.hasOwn(value, key)) {
      throw new ArtifactError(
        "ARTIFACT_SCHEMA_INVALID",
        `${label} is missing required field '${key}'.`,
      );
    }
  }
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) {
      throw new ArtifactError(
        "ARTIFACT_SCHEMA_INVALID",
        `${label} contains unsupported field '${key}'.`,
      );
    }
  }
}

function assertIdentity(value, label) {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new ArtifactError("ARTIFACT_SCHEMA_INVALID", `${label} must be kebab-case.`);
  }
}

function assertTrimmedString(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new ArtifactError(
      "ARTIFACT_SCHEMA_INVALID",
      `${label} must be a non-empty trimmed string.`,
    );
  }
}

function assertEnum(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new ArtifactError(
      "ARTIFACT_SCHEMA_INVALID",
      `${label} must be one of: ${allowed.join(", ")}.`,
    );
  }
}

function assertHash(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) {
    throw new ArtifactError(
      "ARTIFACT_SCHEMA_INVALID",
      `${label} must be a lowercase SHA-256 hash.`,
    );
  }
}

function assertCommit(value, label) {
  if (typeof value !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value)) {
    throw new ArtifactError(
      "ARTIFACT_SCHEMA_INVALID",
      `${label} must be a full hexadecimal commit id.`,
    );
  }
}

function assertNormalizedPath(value, label) {
  const segments = typeof value === "string" ? value.split("/") : [];
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    value.includes("\\") ||
    value.includes(":") ||
    value.startsWith("/") ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    /[*?[\]{}]/.test(value) ||
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.endsWith(".") ||
        segment.endsWith(" ") ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(segment),
    )
  ) {
    throw new ArtifactError(
      "ARTIFACT_SCHEMA_INVALID",
      `${label} must be a normalized relative path.`,
    );
  }
}

function sortObjectKeys(value) {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort(compareStrings)
      .map((key) => [key, sortObjectKeys(value[key])]),
  );
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
