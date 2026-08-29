import { canonicalJson, sha256Canonical } from "./artifact-schema-v1.mjs";
import {
  HarnessError,
  assertHarnessArtifact,
  deriveAcceptanceInputProjection,
} from "./harness-schema-v2.mjs";

const impactOrder = Object.freeze([
  "unaffected",
  "acceptance_affected",
  "evaluator_affected",
  "reader_affected",
  "unknown",
]);

const dependencyPrefixes = Object.freeze({
  unaffected: [
    "audit.",
    "attempt.timestamp",
    "provenance.branch",
    "provenance.git",
    "provenance.pull_request",
    "storage.",
  ],
  reader_affected: [
    "bundle.",
    "case.context",
    "case.prompt",
    "compiled_reader.",
    "reader_attestation.",
    "reader_protocol.",
    "reader_runtime.",
  ],
  evaluator_affected: [
    "comparison_mapping.",
    "compiled_evaluator.",
    "evaluator_protocol.",
    "evaluator_runtime.",
    "evaluator_visible_projection.",
    "observation.behavior.",
    "resource_observation.behavior.",
    "rubric.",
  ],
  acceptance_affected: [
    "accepted_scope.",
    "evidence_binding.",
    "proposal.",
    "review_policy.",
    "summary.",
  ],
});

export function deriveReaderInputIdentity(input) {
  assertRecord(input, "reader identity input");
  assertExactKeys(
    input,
    [
      "attestation",
      "bundle",
      "compiled_invocation",
      "context",
      "fresh_context_method",
      "prompt",
      "protocol_version",
      "provenance",
    ],
    "reader identity input",
  );
  const invocation = assertHarnessArtifact(input.compiled_invocation, {
    artifactType: "compiled_invocation",
  });
  if (invocation.payload.role !== "reader") identityError("reader identity requires a reader compiled_invocation.");
  assertString(input.prompt, "reader prompt");
  assertContext(input.context, "reader context");
  assertBundle(input.bundle);
  assertAttestation(input.attestation);
  if (input.attestation.runtime_config_sha256 !== sha256Canonical(invocation.payload.runtime)) {
    identityError("reader attestation runtime_config_sha256 does not match the exact compiled invocation runtime.");
  }
  assertIdentity(input.fresh_context_method, "fresh_context_method");
  assertIdentity(input.protocol_version, "protocol_version");
  assertRecord(input.provenance, "reader provenance");
  assertJsonValue(input.provenance, "reader provenance");

  const canonical_input = structuredClone({
    identity_schema: "reader-input-v2",
    prompt: input.prompt,
    context: input.context,
    bundle: input.bundle,
    compiled_invocation: compiledInvocationProjection(invocation),
    attestation: input.attestation,
    fresh_context_method: input.fresh_context_method,
    protocol_version: input.protocol_version,
  });
  return {
    reader_input_id: sha256Canonical(canonical_input),
    canonical_input,
    provenance: structuredClone(input.provenance),
  };
}

export function deriveEvaluatorVisibleEvidence({ observation, resourceObservation = null }) {
  const observationArtifact = assertHarnessArtifact(observation, { artifactType: "observation" });
  let resource = null;
  if (resourceObservation !== null) {
    resource = assertHarnessArtifact(resourceObservation, { artifactType: "resource_observation" });
    const observationLink = resource.links.find((link) => link.relationship === "observation");
    if (
      observationLink.target_artifact_id !== observationArtifact.artifact_id ||
      observationLink.target_content_sha256 !== observationArtifact.content_sha256 ||
      resource.payload.observation_id !== observationArtifact.artifact_id
    ) {
      identityError("resource observation does not bind the supplied observation artifact.");
    }
  }
  return {
    projection: {
      unit_id: observationArtifact.payload.unit_id,
      execution_status: observationArtifact.payload.execution_status,
      raw_text: observationArtifact.payload.raw_text,
      observed_access: observationArtifact.payload.observed_access,
      resource_access:
        resource === null
          ? { status: "unknown" }
          : {
              status: resource.payload.basis === "unavailable" ? "unknown" : "present",
              basis: resource.payload.basis,
              supplied: resource.payload.supplied,
              read: resource.payload.read,
              denied: resource.payload.denied,
              limitations: resource.payload.limitations,
            },
    },
    source_bindings: {
      observation: {
        artifact_id: observationArtifact.artifact_id,
        content_sha256: observationArtifact.content_sha256,
      },
      resource_observation:
        resource === null
          ? null
          : { artifact_id: resource.artifact_id, content_sha256: resource.content_sha256 },
    },
  };
}

export function deriveEvaluatorInputIdentity(input) {
  assertRecord(input, "evaluator identity input");
  assertExactKeys(
    input,
    ["comparison_mapping", "compiled_invocation", "evidence", "protocol_version", "rubric"],
    "evaluator identity input",
  );
  const invocation = assertHarnessArtifact(input.compiled_invocation, {
    artifactType: "compiled_invocation",
  });
  if (invocation.payload.role !== "evaluator") identityError("evaluator identity requires an evaluator compiled_invocation.");
  assertArray(input.evidence, "evaluator evidence");
  if (input.evidence.length === 0) identityError("evaluator evidence must not be empty.");
  const projections = [];
  const source_bindings = [];
  for (const [index, evidence] of input.evidence.entries()) {
    assertRecord(evidence, `evaluator evidence[${index}]`);
    assertExactKeys(evidence, ["observation", "resource_observation"], `evaluator evidence[${index}]`);
    const result = deriveEvaluatorVisibleEvidence({
      observation: evidence.observation,
      resourceObservation: evidence.resource_observation,
    });
    projections.push(result.projection);
    source_bindings.push(result.source_bindings);
  }
  assertUniqueProjectionUnits(projections);
  projections.sort((left, right) => compareStrings(left.unit_id, right.unit_id));
  source_bindings.sort((left, right) => compareStrings(left.observation.artifact_id, right.observation.artifact_id));
  assertJsonValue(input.rubric, "evaluator rubric");
  assertJsonValue(input.comparison_mapping, "comparison_mapping");
  assertIdentity(input.protocol_version, "evaluator protocol_version");

  const canonical_input = structuredClone({
    identity_schema: "evaluator-input-v2",
    evidence: projections,
    rubric: input.rubric,
    comparison_mapping: input.comparison_mapping,
    compiled_invocation: compiledInvocationProjection(invocation),
    protocol_version: input.protocol_version,
  });
  return {
    evaluator_input_id: sha256Canonical(canonical_input),
    canonical_input,
    source_bindings,
  };
}

export function deriveAcceptanceInputIdentity(input) {
  assertRecord(input, "acceptance identity input");
  assertExactKeys(
    input,
    ["accepted_scope", "evidence_bindings", "proposals", "review_policy", "summary"],
    "acceptance identity input",
  );
  assertArray(input.proposals, "acceptance proposals");
  if (input.proposals.length === 0) identityError("acceptance proposals must not be empty.");
  assertArray(input.evidence_bindings, "evidence_bindings");
  const suppliedEvidenceBindings = input.evidence_bindings.map((binding, index) => {
    assertRecord(binding, `evidence_bindings[${index}]`);
    assertExactKeys(binding, ["artifact_id", "artifact_type", "content_sha256"], `evidence_bindings[${index}]`);
    assertIdentity(binding.artifact_id, `evidence_bindings[${index}].artifact_id`);
    if (!["observation", "resource_observation"].includes(binding.artifact_type)) {
      identityError(`evidence_bindings[${index}].artifact_type is not canonical evaluator evidence.`);
    }
    assertHash(binding.content_sha256, `evidence_bindings[${index}].content_sha256`);
    return structuredClone(binding);
  });
  assertSortedUniqueBy(
    suppliedEvidenceBindings,
    (item) => `${item.artifact_type}:${item.artifact_id}`,
    "evidence_bindings",
  );
  let canonical_input;
  try {
    canonical_input = deriveAcceptanceInputProjection({
      acceptedScope: input.accepted_scope,
      proposals: input.proposals,
      reviewPolicy: input.review_policy,
      summary: input.summary,
    });
  } catch (error) {
    if (error instanceof HarnessError) identityError(error.message);
    throw error;
  }
  if (canonicalJson(suppliedEvidenceBindings) !== canonicalJson(canonical_input.evidence_bindings)) {
    identityError("evidence_bindings do not match the exact evidence linked by the canonical evaluator proposals.");
  }
  return {
    acceptance_input_id: sha256Canonical(canonical_input),
    canonical_input,
  };
}

export function classifyIdentityImpact(before, after, options = {}) {
  assertIdentitySnapshot(before, "before identity snapshot");
  assertIdentitySnapshot(after, "after identity snapshot");
  if (options.unknownChange === true) return "unknown";
  if (before.reader_input_id !== after.reader_input_id) return "reader_affected";
  if (before.evaluator_input_id !== after.evaluator_input_id) return "evaluator_affected";
  if (before.acceptance_input_id !== after.acceptance_input_id) return "acceptance_affected";
  return "unaffected";
}

export function classifyDependencyChanges(paths) {
  assertArray(paths, "changed dependency paths");
  if (paths.length === 0) return "unaffected";
  let classification = "unaffected";
  for (const [index, path] of paths.entries()) {
    assertTrimmedString(path, `changed dependency paths[${index}]`);
    const current = classifyDependencyPath(path);
    if (impactOrder.indexOf(current) > impactOrder.indexOf(classification)) classification = current;
  }
  return classification;
}

export function classifyDependencyPath(path) {
  assertTrimmedString(path, "changed dependency path");
  for (const classification of ["unaffected", "reader_affected", "evaluator_affected", "acceptance_affected"]) {
    if (
      dependencyPrefixes[classification].some((prefix) => {
        const root = prefix.endsWith(".") ? prefix.slice(0, -1) : prefix;
        return path === root || path.startsWith(`${root}.`);
      })
    ) {
      return classification;
    }
  }
  return "unknown";
}

function compiledInvocationProjection(artifact) {
  const payload = artifact.payload;
  return {
    role: payload.role,
    messages: payload.messages,
    tools: payload.tools,
    resources: payload.resources,
    requested_policy: payload.requested_policy,
    model_visible_policy: payload.model_visible_policy,
    runtime: payload.runtime,
    protocol: payload.protocol,
  };
}

function assertBundle(value) {
  assertRecord(value, "reader bundle");
  assertExactKeys(value, ["bundle_sha256", "reader_visible_variant"], "reader bundle");
  assertHash(value.bundle_sha256, "reader bundle.bundle_sha256");
  assertIdentity(value.reader_visible_variant, "reader bundle.reader_visible_variant");
}

function assertContext(value, label) {
  assertArray(value, label);
  for (const [index, entry] of value.entries()) {
    assertRecord(entry, `${label}[${index}]`);
    assertExactKeys(entry, ["label", "sha256"], `${label}[${index}]`);
    assertTrimmedString(entry.label, `${label}[${index}].label`);
    assertHash(entry.sha256, `${label}[${index}].sha256`);
  }
  assertSortedUniqueBy(value, (entry) => entry.label, label);
}

function assertAttestation(value) {
  assertRecord(value, "reader attestation");
  assertExactKeys(
    value,
    ["adapter_capabilities", "enforced_policy", "runtime_config_sha256"],
    "reader attestation",
  );
  assertHash(value.runtime_config_sha256, "reader attestation.runtime_config_sha256");
  assertJsonValue(value.adapter_capabilities, "reader attestation.adapter_capabilities");
  assertJsonValue(value.enforced_policy, "reader attestation.enforced_policy");
}

function assertIdentitySnapshot(value, label) {
  assertRecord(value, label);
  assertExactKeys(value, ["acceptance_input_id", "evaluator_input_id", "reader_input_id"], label);
  assertHash(value.reader_input_id, `${label}.reader_input_id`);
  assertHash(value.evaluator_input_id, `${label}.evaluator_input_id`);
  assertHash(value.acceptance_input_id, `${label}.acceptance_input_id`);
}

function assertUniqueProjectionUnits(projections) {
  const unitIds = projections.map((projection) => projection.unit_id);
  if (new Set(unitIds).size !== unitIds.length) identityError("Evaluator evidence contains duplicate unit_id projections.");
}

function assertSortedUniqueBy(value, select, label) {
  for (let index = 1; index < value.length; index += 1) {
    if (compareStrings(select(value[index - 1]), select(value[index])) >= 0) {
      identityError(`${label} must be duplicate-free and lexicographically sorted.`);
    }
  }
}

function assertExactKeys(value, keys, label) {
  const expected = [...keys].sort(compareStrings);
  const actual = Object.keys(value).sort(compareStrings);
  if (expected.length !== actual.length || expected.some((key, index) => key !== actual[index])) {
    identityError(`${label} fields must be exactly: ${expected.join(", ")}.`);
  }
}

function assertRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) identityError(`${label} must be a JSON object.`);
}

function assertArray(value, label) {
  if (!Array.isArray(value)) identityError(`${label} must be an array.`);
}

function assertString(value, label) {
  if (typeof value !== "string") identityError(`${label} must be a string.`);
}

function assertTrimmedString(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    identityError(`${label} must be a non-empty trimmed string.`);
  }
}

function assertIdentity(value, label) {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    identityError(`${label} must be kebab-case.`);
  }
}

function assertHash(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) identityError(`${label} must be a lowercase SHA-256 hash.`);
}

function assertJsonValue(value, label) {
  if (value === undefined || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    identityError(`${label} must be JSON-compatible.`);
  }
  if (typeof value === "number" && !Number.isFinite(value)) identityError(`${label} must contain finite numbers.`);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertJsonValue(entry, `${label}[${index}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) identityError(`${label} must contain plain JSON objects.`);
    for (const [key, entry] of Object.entries(value)) assertJsonValue(entry, `${label}.${key}`);
  }
}

function identityError(message) {
  throw new HarnessError("IDENTITY_INPUT_INVALID", message);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
