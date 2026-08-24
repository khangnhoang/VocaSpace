import { canonicalJson, canonicalJsonLine, parseStrictJson, sha256Bytes, sha256Canonical } from "./artifact-schema-v1.mjs";
import {
  assertBehaviorRuntimeProjection,
  behaviorRuntimeProjectionSha256,
  deriveVerificationHelperInputIdentity,
} from "./runtime-identity-v2.mjs";

export const harnessSchemaVersion = 2;
export const harnessArtifactTypes = Object.freeze([
  "task_manifest",
  "run_manifest",
  "compiled_invocation",
  "verification_helper_input",
  "readiness_analysis",
  "execution_attempt",
  "runtime_attestation",
  "runtime_dispatch_request",
  "runtime_event",
  "observation",
  "resource_observation",
  "evaluator_proposal",
  "run_review_summary",
  "human_review_decision",
  "human_evaluation",
  "generated_report",
]);

export const runStates = Object.freeze([
  "created",
  "preflight",
  "readiness",
  "ready",
  "reading",
  "reader_complete",
  "evaluating",
  "review_pending",
  "accepted",
  "reported",
  "completed",
  "rejected",
  "rerun_required",
  "blocked",
  "failed",
  "cancelled",
  "abandoned",
]);

const v1ArtifactTypes = new Set([
  "workspace_manifest",
  "bundle_manifest",
  "execution_context_manifest",
  "baseline_observation",
  "candidate_observation",
  "human_evaluation",
  "generated_report",
  "skill_resource_access",
  "validation_result",
]);

const producerKinds = Object.freeze({
  task_manifest: ["operator", "harness"],
  run_manifest: ["harness"],
  compiled_invocation: ["readiness_compiler"],
  verification_helper_input: ["readiness_compiler"],
  readiness_analysis: ["readiness"],
  execution_attempt: ["orchestrator"],
  runtime_attestation: ["adapter"],
  runtime_dispatch_request: ["adapter"],
  runtime_event: ["adapter"],
  observation: ["adapter"],
  resource_observation: ["adapter"],
  evaluator_proposal: ["evaluator"],
  run_review_summary: ["review_builder"],
  human_review_decision: ["authorized_reviewer"],
  human_evaluation: ["materializer"],
  generated_report: ["reporter"],
});

const linkContracts = Object.freeze({
  task_manifest: {},
  run_manifest: { task: [1, 1, "task_manifest"] },
  compiled_invocation: { run: [1, 1, "run_manifest"] },
  verification_helper_input: {
    run: [1, 1, "run_manifest"],
    compiled_invocation: [1, 1, "compiled_invocation"],
  },
  readiness_analysis: {
    run: [1, 1, "run_manifest"],
    compiled_invocation: [1, Number.POSITIVE_INFINITY, "compiled_invocation"],
    helper_attempt: [0, 2, "execution_attempt"],
    helper_input: [0, 2, "verification_helper_input"],
  },
  execution_attempt: {
    run: [1, 1, "run_manifest"],
    compiled_invocation: [1, 1, "compiled_invocation"],
    readiness: [0, 1, "readiness_analysis"],
    helper_input: [0, 1, "verification_helper_input"],
  },
  runtime_attestation: {
    run: [1, 1, "run_manifest"],
    execution_attempt: [1, 1, "execution_attempt"],
    compiled_invocation: [1, 1, "compiled_invocation"],
    readiness: [0, 1, "readiness_analysis"],
  },
  runtime_dispatch_request: {
    run: [1, 1, "run_manifest"],
    execution_attempt: [1, 1, "execution_attempt"],
    compiled_invocation: [1, 1, "compiled_invocation"],
    readiness: [0, 1, "readiness_analysis"],
    runtime_attestation: [1, 1, "runtime_attestation"],
  },
  runtime_event: {
    run: [1, 1, "run_manifest"],
    execution_attempt: [1, 1, "execution_attempt"],
    runtime_dispatch_request: [1, 1, "runtime_dispatch_request"],
  },
  observation: {
    attempt: [1, 1, "execution_attempt"],
    compiled_invocation: [1, 1, "compiled_invocation"],
  },
  resource_observation: { observation: [1, 1, "observation"] },
  evaluator_proposal: {
    attempt: [1, 1, "execution_attempt"],
    observation: [1, Number.POSITIVE_INFINITY, "observation"],
    resource_observation: [0, Number.POSITIVE_INFINITY, "resource_observation"],
  },
  run_review_summary: {
    run: [1, 1, "run_manifest"],
    evaluator_proposal: [1, Number.POSITIVE_INFINITY, "evaluator_proposal"],
    execution_attempt: [1, Number.POSITIVE_INFINITY, "execution_attempt"],
  },
  human_review_decision: {
    summary: [1, 1, "run_review_summary"],
    evaluator_proposal: [1, Number.POSITIVE_INFINITY, "evaluator_proposal"],
  },
  human_evaluation: {
    decision: [1, 1, "human_review_decision"],
    summary: [1, 1, "run_review_summary"],
    evaluator_proposal: [1, 1, "evaluator_proposal"],
  },
  generated_report: {
    run: [1, 1, "run_manifest"],
    human_evaluation: [1, Number.POSITIVE_INFINITY, "human_evaluation"],
  },
});

export class HarnessError extends Error {
  constructor(code, message, exitCode = 1) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
  }
}

export function parseHarnessJson(bytes, label = "harness artifact") {
  try {
    return parseStrictJson(bytes, label);
  } catch (error) {
    throw new HarnessError(error.code ?? "ARTIFACT_INVALID", error.message, error.exitCode ?? 1);
  }
}

export function createHarnessArtifact({ artifactType, artifactId, producer, links = [], payload }) {
  const envelope = {
    schema_version: harnessSchemaVersion,
    artifact_type: artifactType,
    artifact_id: artifactId,
    producer,
    links,
    payload,
  };
  const artifact = { ...envelope, content_sha256: sha256Canonical(envelope) };
  assertHarnessArtifact(artifact);
  return artifact;
}

export function assertHarnessArtifact(value, expected = {}) {
  assertRecord(value, "artifact");
  assertExactKeys(
    value,
    [
      "artifact_id",
      "artifact_type",
      "content_sha256",
      "links",
      "payload",
      "producer",
      "schema_version",
    ],
    "artifact",
  );
  if (value.schema_version !== harnessSchemaVersion) {
    throw new HarnessError(
      "ARTIFACT_VERSION_UNSUPPORTED",
      `schema_version must be integer ${harnessSchemaVersion}; v1 artifacts require the v1 route.`,
      2,
    );
  }
  assertEnum(value.artifact_type, harnessArtifactTypes, "artifact_type");
  if (expected.artifactType && value.artifact_type !== expected.artifactType) {
    throw new HarnessError(
      "ARTIFACT_TYPE_MISMATCH",
      `Expected artifact_type '${expected.artifactType}', received '${value.artifact_type}'.`,
    );
  }
  assertIdentity(value.artifact_id, "artifact_id");
  if (expected.artifactId && value.artifact_id !== expected.artifactId) {
    throw new HarnessError("ARTIFACT_IDENTITY_MISMATCH", "artifact_id does not match expected identity.");
  }
  assertProducer(value.producer, value.artifact_type);
  assertLinks(value.links, value.artifact_type);
  validatePayload(value.artifact_type, value.payload);
  assertArtifactPayloadIdentity(value);
  assertHash(value.content_sha256, "content_sha256");
  const envelope = { ...value };
  delete envelope.content_sha256;
  if (sha256Canonical(envelope) !== value.content_sha256) {
    throw new HarnessError("INTEGRITY_MISMATCH", "Artifact content_sha256 does not match canonical bytes.", 3);
  }
  return value;
}

export function validateArtifactGraph(values) {
  assertArray(values, "artifacts");
  const artifacts = values.map((value) => assertHarnessArtifact(value));
  const byKey = new Map();
  for (const artifact of artifacts) {
    const key = artifactKey(artifact.artifact_type, artifact.artifact_id);
    if (byKey.has(key)) {
      throw new HarnessError("ARTIFACT_RELATIONSHIP_INVALID", `Duplicate artifact '${key}'.`);
    }
    byKey.set(key, artifact);
  }
  for (const artifact of artifacts) {
    const resolved = new Map();
    for (const link of artifact.links) {
      const target = byKey.get(artifactKey(link.target_artifact_type, link.target_artifact_id));
      if (!target) {
        throw new HarnessError(
          "ARTIFACT_RELATIONSHIP_INVALID",
          `${artifact.artifact_id} link '${link.relationship}' does not resolve.`,
        );
      }
      if (target.content_sha256 !== link.target_content_sha256) {
        throw new HarnessError(
          "INTEGRITY_MISMATCH",
          `${artifact.artifact_id} link '${link.relationship}' has a stale target hash.`,
          3,
        );
      }
      if (!resolved.has(link.relationship)) resolved.set(link.relationship, []);
      resolved.get(link.relationship).push(target);
    }
    validateResolvedRelationships(artifact, resolved, byKey);
  }
  validateRuntimeEventSets(artifacts);
  return artifacts;
}

function validateRuntimeEventSets(artifacts) {
  const groups = new Map();
  for (const artifact of artifacts.filter((candidate) => candidate.artifact_type === "runtime_event")) {
    const requestLink = artifact.links.find((link) => link.relationship === "runtime_dispatch_request");
    const key = `${artifact.payload.attempt_id}:${requestLink.target_content_sha256}`;
    if (!groups.has(key)) groups.set(key, new Map());
    const events = groups.get(key);
    if (events.has(artifact.payload.event_type)) {
      relationshipError("Runtime event chain contains duplicate event types for one exact request.");
    }
    events.set(artifact.payload.event_type, artifact);
  }
  for (const events of groups.values()) {
    const requirePrior = (eventType, priorType) => {
      if (events.has(eventType) && !events.has(priorType)) {
        relationshipError(`Runtime event '${eventType}' lacks required prior '${priorType}'.`);
      }
    };
    requirePrior("turn_start_write_completed", "turn_start_write_intent");
    requirePrior("turn_start_acknowledged", "turn_start_write_completed");
    requirePrior("turn_completed", "turn_start_acknowledged");
    requirePrior("turn_interrupt_requested", "turn_start_acknowledged");
    requirePrior("turn_interrupt_acknowledged", "turn_interrupt_requested");
    requirePrior("turn_lookup_result", "turn_start_write_intent");
    requirePrior("transport_error", "turn_lookup_result");
    const intent = events.get("turn_start_write_intent");
    if (intent && intent.payload.turn_id !== null) {
      relationshipError("turn_start_write_intent cannot claim a turn identity before acknowledgement.");
    }
    const correlated = [...events.values()].filter(
      (event) => !["turn_start_write_intent", "turn_lookup_result", "transport_error"].includes(event.payload.event_type),
    );
    if (correlated.some((event) => event.payload.turn_id === null)) {
      relationshipError("Acknowledged/control/terminal runtime events require an exact turn identity.");
    }
    const turnIds = new Set(correlated.map((event) => event.payload.turn_id));
    if (turnIds.size > 1) relationshipError("Runtime event chain substitutes more than one turn identity.");
    const lookup = events.get("turn_lookup_result");
    const transportError = events.get("transport_error");
    const canonicalTurnId = turnIds.size === 1 ? [...turnIds][0] : null;
    const reconciliation = [lookup, transportError].filter(Boolean);
    const reconciliationTurnIds = new Set(
      reconciliation.map((event) => event.payload.turn_id).filter((turnId) => turnId !== null),
    );
    if (canonicalTurnId === null && reconciliationTurnIds.size > 1) {
      relationshipError("Runtime reconciliation events substitute more than one turn identity.");
    }
    for (const event of reconciliation) {
      if (event.payload.turn_id !== null && canonicalTurnId !== null && event.payload.turn_id !== canonicalTurnId) {
        relationshipError("Runtime reconciliation event substitutes another turn identity.");
      }
    }
    const interruptRequested = events.get("turn_interrupt_requested");
    const interruptAcknowledged = events.get("turn_interrupt_acknowledged");
    if (
      (interruptRequested && interruptRequested.payload.control_request_id === null) ||
      (interruptAcknowledged &&
        interruptAcknowledged.payload.control_request_id !== interruptRequested?.payload.control_request_id)
    ) {
      relationshipError("Runtime interrupt events do not share one exact control request identity.");
    }
  }
}

export function routeArtifactVersion(value) {
  assertRecord(value, "artifact");
  if (value.schema_version === harnessSchemaVersion) {
    assertHarnessArtifact(value);
    return { schemaVersion: harnessSchemaVersion, owner: "harness-v2" };
  }
  if (value.schema_version === 1 && v1ArtifactTypes.has(value.artifact_type)) {
    return { schemaVersion: 1, owner: "eval-foundation-v1" };
  }
  throw new HarnessError(
    "ARTIFACT_VERSION_UNSUPPORTED",
    "Artifact version/type has no explicit compatibility route.",
    2,
  );
}

export function canonicalHarnessJson(value) {
  assertHarnessArtifact(value);
  return canonicalJson(value);
}

export function deriveAcceptanceInputProjection({ acceptedScope, proposals, reviewPolicy, summary }) {
  assertArray(proposals, "acceptance proposals");
  if (proposals.length === 0) relationshipError("Acceptance proposals must not be empty.");
  const canonicalProposals = proposals.map((proposal) =>
    assertHarnessArtifact(proposal, { artifactType: "evaluator_proposal" }),
  );
  canonicalProposals.sort((left, right) => compareStrings(left.artifact_id, right.artifact_id));
  const proposalUnits = canonicalProposals.map((proposal) => proposal.payload.unit_id);
  assertUniqueIdentities(proposalUnits, "acceptance proposal units");
  const canonicalSummary = assertHarnessArtifact(summary, { artifactType: "run_review_summary" });
  const summaryProposalBindings = canonicalSummary.links
    .filter((link) => link.relationship === "evaluator_proposal")
    .map((link) => linkBinding(link));
  assertSameSet(
    canonicalProposals.map((proposal) => artifactBinding(proposal)),
    summaryProposalBindings,
    "acceptance proposal bindings",
  );
  assertSortedUniqueIdentities(acceptedScope, "accepted_scope");
  assertSubset(acceptedScope, canonicalSummary.payload.operations.reader.scope_unit_ids, "accepted_scope");
  assertSubset(acceptedScope, proposalUnits, "accepted_scope proposal coverage");
  assertJsonValue(reviewPolicy, "review_policy");
  return structuredClone({
    identity_schema: "acceptance-input-v2",
    proposal_bindings: canonicalProposals.map((proposal) => ({
      artifact_id: proposal.artifact_id,
      content_sha256: proposal.content_sha256,
    })),
    summary_binding: {
      artifact_id: canonicalSummary.artifact_id,
      content_sha256: canonicalSummary.content_sha256,
    },
    accepted_scope: acceptedScope,
    evidence_bindings: canonicalEvidenceBindings(canonicalProposals),
    review_policy: reviewPolicy,
  });
}

export function deriveRuntimeDispatchSemanticProjection(request) {
  assertRecord(request, "runtime request");
  assertExactKeys(request, ["id", "method", "params"], "runtime request");
  assertLiteral(request.method, "turn/start", "runtime request.method");
  assertIdentity(request.id, "runtime request.id");
  assertRecord(request.params, "runtime request.params");
  assertExactKeys(
    request.params,
    ["approvalPolicy", "cwd", "effort", "input", "model", "outputSchema", "sandboxPolicy", "settings", "threadId"],
    "runtime request.params",
  );
  assertIdentity(request.params.threadId, "runtime request.params.threadId");
  assertTrimmedString(request.params.cwd, "runtime request.params.cwd");
  assertTrimmedString(request.params.model, "runtime request.params.model");
  assertTrimmedString(request.params.effort, "runtime request.params.effort");
  assertTrimmedString(request.params.approvalPolicy, "runtime request.params.approvalPolicy");
  assertRecord(request.params.sandboxPolicy, "runtime request.params.sandboxPolicy");
  assertJsonValue(request.params.sandboxPolicy, "runtime request.params.sandboxPolicy");
  assertArray(request.params.input, "runtime request.params.input");
  if (request.params.input.length === 0) schemaError("runtime request.params.input must not be empty.");
  for (const [index, item] of request.params.input.entries()) {
    const label = `runtime request.params.input[${index}]`;
    assertRecord(item, label);
    assertExactKeys(item, ["text", "type"], label);
    assertLiteral(item.type, "text", `${label}.type`);
    assertString(item.text, `${label}.text`);
  }
  assertRecord(request.params.outputSchema, "runtime request.params.outputSchema");
  assertJsonValue(request.params.outputSchema, "runtime request.params.outputSchema");
  assertRecord(request.params.settings, "runtime request.params.settings");
  assertJsonValue(request.params.settings, "runtime request.params.settings");
  return {
    method: request.method,
    params: {
      approvalPolicy: request.params.approvalPolicy,
      cwd: request.params.cwd,
      effort: request.params.effort,
      input: structuredClone(request.params.input),
      model: request.params.model,
      outputSchema: structuredClone(request.params.outputSchema),
      sandboxPolicy: structuredClone(request.params.sandboxPolicy),
      settings: structuredClone(request.params.settings),
    },
  };
}

export function deriveAppServerSandboxPolicy(value, cwd) {
  if (value === "read-only") return { type: "readOnly" };
  if (value === "workspace-write") return { networkAccess: false, type: "workspaceWrite", writableRoots: [cwd] };
  schemaError("Compiled sandbox policy cannot be represented by the bounded App Server transport.");
}

export function deriveCodexAppServerInput(invocation) {
  assertRecord(invocation, "compiled invocation payload");
  assertArray(invocation.messages, "compiled invocation messages");
  const items = invocation.messages.map((message, index) => ({
    text: `HARNESS_MESSAGE_V1\nINDEX ${index}\nROLE ${message.role}\nBYTES ${Buffer.byteLength(message.content, "utf8")}\n${message.content}`,
    type: "text",
  }));
  const contract = canonicalJson({
    protocol: invocation.protocol,
    resources: invocation.resources,
    tools: invocation.tools,
  }).trimEnd();
  items.push({
    text: `HARNESS_CONTRACT_V1\nBYTES ${Buffer.byteLength(contract, "utf8")}\n${contract}`,
    type: "text",
  });
  return items;
}

export function renderCodexAppServerInput(items) {
  assertArray(items, "Codex App Server input");
  const lines = ["HARNESS_INPUT_V1", `ITEMS ${items.length}`];
  for (const [index, item] of items.entries()) {
    const label = `Codex App Server input[${index}]`;
    assertRecord(item, label);
    assertExactKeys(item, ["text", "type"], label);
    assertLiteral(item.type, "text", `${label}.type`);
    assertString(item.text, `${label}.text`);
    lines.push(`ITEM ${index} ${item.type} ${Buffer.byteLength(item.text, "utf8")}`, item.text, "END_ITEM");
  }
  return `${lines.join("\n")}\n`;
}

export function assertRuntimeCredentialFree(value) {
  const forbiddenKey = /(?:api[_-]?key|authorization|chatgptAuthTokens|access[_-]?token|refresh[_-]?token|password|secret)/i;
  const forbiddenValue = /(?:\bBearer\s+[A-Za-z0-9._~-]{12,}|\bsk-[A-Za-z0-9_-]{12,}|(?:api[_-]?key|access[_-]?token|refresh[_-]?token)\s*[:=]\s*\S{8,})/i;
  const inspect = (entry, path = "runtime value") => {
    if (typeof entry === "string" && forbiddenValue.test(entry)) {
      schemaError(`${path} contains credential-like material.`);
    }
    if (Array.isArray(entry)) entry.forEach((item, index) => inspect(item, `${path}[${index}]`));
    else if (entry && typeof entry === "object") {
      for (const [key, item] of Object.entries(entry)) {
        if (forbiddenKey.test(key)) schemaError(`${path}.${key} is a forbidden credential field.`);
        inspect(item, `${path}.${key}`);
      }
    }
  };
  inspect(value);
  return value;
}

export function assertRuntimeControlPlaneEvent(value, eventType) {
  assertRuntimeCredentialFree(value);
  assertRecord(value, "runtime event");
  switch (eventType) {
    case "turn_start_write_completed":
      assertExactKeys(value, ["bytes_written", "requestId", "threadId", "turnId"], "runtime event");
      if (value.bytes_written !== true) schemaError("runtime event.bytes_written must be true.");
      assertString(value.requestId, "runtime event.requestId");
      assertString(value.threadId, "runtime event.threadId");
      assertString(value.turnId, "runtime event.turnId");
      break;
    case "turn_start_acknowledged":
      assertExactKeys(value, ["requestId", "threadId", "turnId"], "runtime event");
      assertString(value.requestId, "runtime event.requestId");
      assertString(value.threadId, "runtime event.threadId");
      assertString(value.turnId, "runtime event.turnId");
      break;
    case "turn_completed": {
      const hasRequestId = Object.hasOwn(value, "requestId");
      assertExactKeys(value, hasRequestId ? ["requestId", "status", "threadId", "turnId"] : ["status", "threadId", "turnId"], "runtime event");
      if (hasRequestId) assertString(value.requestId, "runtime event.requestId");
      assertEnum(value.status, ["completed", "interrupted"], "runtime event.status");
      assertString(value.threadId, "runtime event.threadId");
      assertString(value.turnId, "runtime event.turnId");
      break;
    }
    case "turn_interrupt_requested":
      assertExactKeys(value, ["id", "method", "params"], "runtime event");
      assertString(value.id, "runtime event.id");
      assertLiteral(value.method, "turn/interrupt", "runtime event.method");
      assertRecord(value.params, "runtime event.params");
      assertExactKeys(value.params, ["threadId", "turnId"], "runtime event.params");
      assertString(value.params.threadId, "runtime event.params.threadId");
      assertString(value.params.turnId, "runtime event.params.turnId");
      break;
    case "turn_interrupt_acknowledged":
      assertExactKeys(value, ["accepted", "requestId", "threadId", "turnId"], "runtime event");
      if (typeof value.accepted !== "boolean") schemaError("runtime event.accepted must be boolean.");
      assertString(value.requestId, "runtime event.requestId");
      assertString(value.threadId, "runtime event.threadId");
      assertString(value.turnId, "runtime event.turnId");
      break;
    case "turn_lookup_result": {
      const completed = value.status === "completed";
      assertExactKeys(value, completed ? ["requestId", "status", "threadId", "turnId"] : ["requestId", "status", "threadId"], "runtime event");
      assertString(value.requestId, "runtime event.requestId");
      assertEnum(value.status, ["completed", "not_started", "unknown"], "runtime event.status");
      assertString(value.threadId, "runtime event.threadId");
      if (completed) assertString(value.turnId, "runtime event.turnId");
      break;
    }
    case "transport_error":
      assertExactKeys(value, ["code", "requestId", "threadId"], "runtime event");
      assertTrimmedString(value.code, "runtime event.code");
      assertString(value.requestId, "runtime event.requestId");
      assertString(value.threadId, "runtime event.threadId");
      break;
    default:
      schemaError(`runtime event type '${eventType}' has no certified retained-body schema.`);
  }
  return value;
}

function validatePayload(artifactType, value) {
  const validator = payloadValidators[artifactType];
  validator(value);
}

function validateResolvedRelationships(artifact, resolved, byKey) {
  const one = (relationship) => resolved.get(relationship)?.[0];
  const many = (relationship) => resolved.get(relationship) ?? [];
  const payload = artifact.payload;
  switch (artifact.artifact_type) {
    case "run_manifest": {
      if (payload.task_id !== one("task").payload.task_id) relationshipError("run_manifest task_id does not match its task link.");
      break;
    }
    case "compiled_invocation": {
      if (payload.run_id !== one("run").payload.run_id) relationshipError("compiled_invocation run_id does not match its run link.");
      break;
    }
    case "verification_helper_input": {
      const run = one("run");
      const invocation = one("compiled_invocation");
      const identity = deriveVerificationHelperInputIdentity({
        cluster: payload.cluster,
        compiledInvocationSha256: invocation.content_sha256,
        helperIndex: payload.helper_index,
      });
      if (
        payload.run_id !== run.payload.run_id ||
        invocation.payload.run_id !== payload.run_id ||
        invocation.payload.role !== "verification_helper" ||
        invocation.payload.unit_id !== `${payload.cluster.cluster_id}-helper-${payload.helper_index}` ||
        payload.compiled_invocation_sha256 !== invocation.content_sha256 ||
        payload.helper_input_hash !== identity.helper_input_hash ||
        payload.uncertainty_cluster_id !== payload.cluster.cluster_id ||
        canonicalJson(invocation.payload.runtime) !== canonicalJson(payload.cluster.runtime) ||
        canonicalJson(invocation.payload.protocol) !== canonicalJson(payload.cluster.protocol) ||
        canonicalJson(invocation.payload.requested_policy) !== canonicalJson(payload.cluster.requested_policy) ||
        canonicalJson(invocation.payload.resources) !== canonicalJson(payload.cluster.resources) ||
        canonicalJson(invocation.payload.messages.filter((message) => message.role === "user")) !==
          canonicalJson([{ content: payload.cluster.question, role: "user" }]) ||
        artifact.artifact_id !== `${payload.cluster.cluster_id}-helper-${payload.helper_index}-input`
      ) {
        relationshipError("verification_helper_input does not own the exact cluster/invocation/runtime identity for this run.");
      }
      break;
    }
    case "readiness_analysis": {
      const run = one("run");
      const invocations = many("compiled_invocation");
      if (payload.run_id !== run.payload.run_id || invocations.some((item) => item.payload.run_id !== payload.run_id)) {
        relationshipError("readiness_analysis and compiled invocations must bind the same run_id.");
      }
      assertSameSet(
        payload.invocation_hashes,
        invocations.map((item) => item.content_sha256),
        "readiness invocation hashes",
      );
      const runtimeHashes = [...new Set(invocations.map((item) => sha256Canonical(item.payload.runtime)))];
      if (runtimeHashes.length !== 1) {
        relationshipError("readiness_analysis invocations must use one exact runtime configuration.");
      }
      if (payload.round === 1) {
        if (payload.correction !== null || runtimeHashes[0] !== run.payload.runtime_config_sha256) {
          relationshipError("Round 1 readiness must bind the initial durable run runtime configuration without a correction.");
        }
      } else if (
        payload.correction === null ||
        payload.correction.before_sha256 !== run.payload.runtime_config_sha256 ||
        payload.correction.after_sha256 !== runtimeHashes[0]
      ) {
        relationshipError("Round 2 readiness must bind its ephemeral correction from the durable run runtime to the exact dispatch runtime.");
      }
      const invocationByUnit = new Map(invocations.map((item) => [item.payload.unit_id, item]));
      for (const grant of payload.grants) {
        const invocation = invocationByUnit.get(grant.unit_id);
        if (!invocation || grant.invocation_sha256 !== invocation.content_sha256) {
          relationshipError("Dispatch grant does not bind an exact linked compiled invocation.");
        }
      }
      if (payload.stage === "reader") {
        if (invocations.some((item) => item.payload.role !== "reader")) {
          relationshipError("Reader readiness may link only reader invocations.");
        }
        assertSameSet(
          invocations.map((item) => item.payload.unit_id),
          run.payload.selected_units.filter((unit) => unit.role === "reader").map((unit) => unit.unit_id),
          "reader readiness selected units",
        );
        if (payload.status === "passed") {
          assertSameSet(
            payload.grants.map((grant) => grant.unit_id),
            invocations.map((item) => item.payload.unit_id),
            "passed reader readiness grants",
          );
        }
      } else if (payload.stage === "evaluator_static") {
        if (
          invocations.length !== 1 ||
          invocations.some((item) => item.payload.role !== "evaluator") ||
          payload.grants.length !== 0
        ) {
          relationshipError("Evaluator-static readiness may link only evaluator invocations and cannot issue dispatch grants.");
        }
        assertSubset(
          invocations.map((item) => item.payload.unit_id),
          run.payload.selected_units.filter((unit) => unit.role === "evaluator").map((unit) => unit.unit_id),
          "evaluator-static readiness selected units",
        );
      } else {
        if (invocations.some((item) => item.payload.role !== "evaluator")) {
          relationshipError("Evaluator-stage readiness may link only evaluator invocations.");
        }
        assertSubset(
          invocations.map((item) => item.payload.unit_id),
          run.payload.selected_units.filter((unit) => unit.role === "evaluator").map((unit) => unit.unit_id),
          "evaluator-stage readiness selected units",
        );
        if (payload.status === "passed") {
          assertSameSet(
            payload.grants.map((grant) => grant.unit_id),
            invocations.map((item) => item.payload.unit_id),
            "passed evaluator-stage readiness grants",
          );
        }
      }
      const helperAttempts = many("helper_attempt");
      const helperInputs = many("helper_input");
      if (
        helperAttempts.some(
          (attempt) =>
            attempt.payload.role !== "verification_helper" ||
            attempt.payload.phase !== "terminal" ||
            attempt.payload.run_id !== payload.run_id,
        )
      ) {
        relationshipError("Readiness helper links must target terminal verification-helper attempts in the same run.");
      }
      assertSameSet(
        payload.helper_attempt_ids,
        helperAttempts.map((attempt) => attempt.payload.attempt_id),
        "readiness helper attempts",
      );
      assertSameSet(
        helperAttempts.map((attempt) => attempt.links.find((item) => item.relationship === "helper_input")?.target_content_sha256),
        helperInputs.map((input) => input.content_sha256),
        "readiness helper inputs",
      );
      break;
    }
    case "execution_attempt": {
      const run = one("run");
      const invocation = one("compiled_invocation");
      const readiness = one("readiness");
      if (
        payload.run_id !== run.payload.run_id ||
        invocation.payload.run_id !== payload.run_id ||
        (readiness && readiness.payload.run_id !== payload.run_id)
      ) {
        relationshipError("execution_attempt run identity does not match linked artifacts.");
      }
      if (payload.role !== invocation.payload.role) relationshipError("execution_attempt role does not match compiled invocation role.");
      if (payload.role === "verification_helper") {
        const helperInput = one("helper_input");
        if (readiness || !helperInput) {
          relationshipError("A readiness helper attempt requires its durable helper input and cannot depend on the analysis it helps produce.");
        }
        if (
          payload.input_sha256 !== helperInput.payload.helper_input_hash ||
          payload.sequence !== helperInput.payload.helper_index ||
          payload.attempt_id !== `${helperInput.payload.cluster.cluster_id}-helper-${helperInput.payload.helper_index}` ||
          helperInput.payload.compiled_invocation_sha256 !== invocation.content_sha256 ||
          helperInput.payload.run_id !== payload.run_id
        ) {
          relationshipError("verification_helper execution_attempt substitutes another cluster/input owner.");
        }
      } else {
        if (!readiness) relationshipError("Reader/evaluator attempts require a readiness link.");
        if (payload.input_sha256 !== invocation.content_sha256 || !readiness.payload.invocation_hashes.includes(invocation.content_sha256)) {
          relationshipError("execution_attempt input is not covered by the linked readiness analysis.");
        }
        if (payload.unit_id !== invocation.payload.unit_id) {
          relationshipError("execution_attempt unit_id does not match compiled invocation unit_id.");
        }
      }
      break;
    }
    case "runtime_attestation": {
      const run = one("run");
      const attempt = one("execution_attempt");
      const invocation = one("compiled_invocation");
      const readiness = one("readiness");
      const helper = payload.role === "verification_helper";
      if (
        payload.run_id !== run.payload.run_id ||
        payload.attempt_id !== attempt.payload.attempt_id ||
        payload.role !== attempt.payload.role ||
        payload.role !== invocation.payload.role ||
        !hasExactArtifactLink(attempt, "run", run) ||
        !hasExactArtifactLink(attempt, "compiled_invocation", invocation) ||
        payload.unit_id !== attempt.payload.unit_id ||
        (!helper && payload.unit_id !== invocation.payload.unit_id) ||
        attempt.payload.phase !== "prepared" ||
        (!helper && attempt.payload.input_sha256 !== invocation.content_sha256) ||
        (helper && readiness !== undefined) ||
        (!helper &&
          (!readiness ||
            !hasExactArtifactLink(attempt, "readiness", readiness) ||
            readiness.payload.run_id !== payload.run_id ||
            !readiness.payload.invocation_hashes.includes(invocation.content_sha256))) ||
        payload.adapter_id !== run.payload.adapter_id ||
        payload.intent_sha256 !== sha256Canonical(run.payload.intent) ||
        payload.model !== invocation.payload.runtime.model ||
        payload.effort !== invocation.payload.runtime.parameters.effort ||
        payload.output_schema_name !== invocation.payload.protocol.output_schema ||
        payload.effective_policy_sha256 !== sha256Canonical(payload.effective_policy) ||
        canonicalJson(payload.effective_policy) !== canonicalJson(invocation.payload.requested_policy) ||
        payload.behavior_runtime_sha256 !== behaviorRuntimeProjectionSha256(invocation.payload.runtime.behavior_runtime) ||
        canonicalJson(behaviorRuntimeProjectionFromAttestation(payload)) !==
          canonicalJson(invocation.payload.runtime.behavior_runtime)
      ) {
        relationshipError("runtime_attestation does not bind the exact prepared attempt/invocation/readiness/run lineage.");
      }
      if (run.payload.intent === undefined) {
        relationshipError("Concrete runtime attestation requires an immutable run_manifest.intent.");
      }
      break;
    }
    case "runtime_dispatch_request": {
      const run = one("run");
      const attempt = one("execution_attempt");
      const invocation = one("compiled_invocation");
      const readiness = one("readiness");
      const attestation = one("runtime_attestation");
      const helper = payload.role === "verification_helper";
      if (
        payload.run_id !== run.payload.run_id ||
        payload.attempt_id !== attempt.payload.attempt_id ||
        payload.role !== attempt.payload.role ||
        payload.role !== invocation.payload.role ||
        !hasExactArtifactLink(attempt, "run", run) ||
        !hasExactArtifactLink(attempt, "compiled_invocation", invocation) ||
        payload.unit_id !== attempt.payload.unit_id ||
        (!helper && payload.unit_id !== invocation.payload.unit_id) ||
        attempt.payload.phase !== "prepared" ||
        (!helper && attempt.payload.input_sha256 !== invocation.content_sha256) ||
        (helper && attempt.payload.input_sha256 !== payload.grant_nonce) ||
        (helper && readiness !== undefined) ||
        (!helper &&
          (!readiness ||
            !hasExactArtifactLink(attempt, "readiness", readiness) ||
            readiness.payload.run_id !== payload.run_id ||
            !readiness.payload.invocation_hashes.includes(invocation.content_sha256))) ||
        attestation.payload.attempt_id !== payload.attempt_id ||
        attestation.payload.run_id !== payload.run_id ||
        attestation.payload.thread_id !== payload.thread_id ||
        attestation.payload.role !== payload.role ||
        attestation.payload.unit_id !== payload.unit_id ||
        payload.invocation_sha256 !== invocation.content_sha256 ||
        payload.readiness_sha256 !== (readiness?.content_sha256 ?? null) ||
        payload.runtime_attestation_sha256 !== attestation.content_sha256
      ) {
        relationshipError("runtime_dispatch_request does not bind the exact runtime/attempt/invocation/readiness lineage.");
      }
      const request = parseStrictJson(Buffer.from(payload.request_json, "utf8"), "runtime dispatch request");
      const canonicalRequest = canonicalJsonLine(request);
      const grant = readiness?.payload.grants.find((candidate) => candidate.unit_id === payload.unit_id);
      const expectedInput = deriveCodexAppServerInput(invocation.payload);
      const expectedInputText = renderCodexAppServerInput(expectedInput);
      if (
        canonicalRequest !== payload.request_json ||
        sha256Bytes(Buffer.from(payload.request_json, "utf8")) !== payload.wire_request_sha256 ||
        sha256Canonical(deriveRuntimeDispatchSemanticProjection(request)) !== payload.semantic_dispatch_sha256 ||
        canonicalJson(request.params.input) !== canonicalJson(expectedInput) ||
        sha256Bytes(Buffer.from(expectedInputText, "utf8")) !== payload.input_sha256 ||
        sha256Canonical(request.params.outputSchema) !== payload.output_schema_sha256 ||
        payload.output_schema_sha256 !== attestation.payload.output_schema_sha256 ||
        request.id !== payload.request_id ||
        request.params.threadId !== payload.thread_id ||
        request.params.model !== attestation.payload.model ||
        request.params.model !== invocation.payload.runtime.model ||
        request.params.effort !== attestation.payload.effort ||
        request.params.effort !== invocation.payload.runtime.parameters.effort ||
        canonicalJson(request.params.approvalPolicy) !== canonicalJson(invocation.payload.runtime.parameters.approval_policy) ||
        request.params.cwd !== invocation.payload.runtime.parameters.cwd ||
        canonicalJson(request.params.sandboxPolicy) !== canonicalJson(deriveAppServerSandboxPolicy(
          invocation.payload.runtime.parameters.sandbox_policy,
          invocation.payload.runtime.parameters.cwd,
        )) ||
        canonicalJson(request.params.settings) !== canonicalJson(invocation.payload.runtime.parameters.settings ?? {}) ||
        canonicalJson(attestation.payload.effective_policy) !== canonicalJson(invocation.payload.requested_policy) ||
        (!helper && payload.grant_nonce !== grant?.nonce)
      ) {
        relationshipError("runtime_dispatch_request hashes or request identity do not match its exact canonical wire bytes.");
      }
      break;
    }
    case "runtime_event": {
      const run = one("run");
      const attempt = one("execution_attempt");
      const request = one("runtime_dispatch_request");
      if (
        payload.run_id !== run.payload.run_id ||
        payload.attempt_id !== attempt.payload.attempt_id ||
        payload.attempt_id !== request.payload.attempt_id ||
        payload.role !== attempt.payload.role ||
        payload.role !== request.payload.role ||
        payload.unit_id !== attempt.payload.unit_id ||
        payload.unit_id !== request.payload.unit_id ||
        payload.request_id !== request.payload.request_id ||
        payload.thread_id !== request.payload.thread_id ||
        attempt.payload.phase !== "dispatched" ||
        artifact.artifact_id !== `${payload.event_type.replaceAll("_", "-")}-${payload.attempt_id}`
      ) {
        relationshipError("runtime_event does not bind the exact dispatched attempt/request/run lineage.");
      }
      if (
        (["turn_interrupt_requested", "turn_interrupt_acknowledged"].includes(payload.event_type)) !==
          (payload.control_request_id !== null)
      ) {
        relationshipError("runtime_event control_request_id ownership does not match its event type.");
      }
      if (
        (payload.event_json === null) !== (payload.event_json_sha256 === null) ||
        (payload.event_json !== null &&
          sha256Bytes(Buffer.from(payload.event_json, "utf8")) !== payload.event_json_sha256)
      ) {
        relationshipError("runtime_event exact JSON hash does not match its retained event bytes.");
      }
      if (payload.event_json !== null) {
        assertRuntimeEventBodyLineage(payload, parseStrictJson(Buffer.from(payload.event_json, "utf8"), "runtime event"));
      }
      break;
    }
    case "observation": {
      const attempt = one("attempt");
      const invocation = one("compiled_invocation");
      if (attempt.payload.role !== "reader") relationshipError("observation must link to a reader attempt.");
      if (
        payload.attempt_id !== attempt.payload.attempt_id ||
        payload.run_id !== attempt.payload.run_id ||
        payload.unit_id !== attempt.payload.unit_id ||
        attempt.payload.input_sha256 !== invocation.content_sha256
      ) {
        relationshipError("observation identity does not match its attempt/invocation links.");
      }
      break;
    }
    case "resource_observation": {
      if (payload.observation_id !== one("observation").artifact_id) {
        relationshipError("resource_observation observation_id does not match its link.");
      }
      break;
    }
    case "evaluator_proposal": {
      const attempt = one("attempt");
      const observations = many("observation");
      const resources = many("resource_observation");
      if (attempt.payload.role !== "evaluator") relationshipError("evaluator_proposal must link to an evaluator attempt.");
      const evaluatorRunLink = attempt.links.find((link) => link.relationship === "run");
      for (const observation of observations) {
        const observationAttemptLink = observation.links.find((link) => link.relationship === "attempt");
        const observationAttempt = byKey.get(
          artifactKey(observationAttemptLink.target_artifact_type, observationAttemptLink.target_artifact_id),
        );
        const observationRunLink = observationAttempt.links.find((link) => link.relationship === "run");
        if (
          observation.payload.run_id !== attempt.payload.run_id ||
          observation.payload.unit_id !== payload.unit_id ||
          linkBinding(observationRunLink) !== linkBinding(evaluatorRunLink)
        ) {
          relationshipError("evaluator_proposal evidence must share the proposal's exact unit and run lineage.");
        }
      }
      const observationBindings = new Set(observations.map((observation) => artifactBinding(observation)));
      for (const resource of resources) {
        const observationLink = resource.links.find((link) => link.relationship === "observation");
        if (!observationBindings.has(linkBinding(observationLink))) {
          relationshipError("evaluator_proposal resource evidence must bind one of its exact linked observations.");
        }
      }
      const evidenceIds = new Set([...observations, ...resources].map((item) => item.artifact_id));
      if (evidenceIds.size !== observations.length + resources.length) {
        relationshipError("evaluator_proposal evidence artifact_ids must be unambiguous across linked evidence types.");
      }
      if (payload.citations.some((citation) => !evidenceIds.has(citation.artifact_id))) {
        relationshipError("evaluator_proposal citations must reference exact linked evidence.");
      }
      break;
    }
    case "run_review_summary": {
      const run = one("run");
      const proposals = many("evaluator_proposal");
      const attempts = many("execution_attempt");
      const proposalUnits = many("evaluator_proposal").map((item) => item.payload.unit_id);
      assertUniqueIdentities(proposalUnits, "summary proposal units");
      assertSubset(proposalUnits, payload.operations.reader.scope_unit_ids, "summary proposal units");
      assertSameSet(
        payload.operations.reader.scope_unit_ids,
        run.payload.selected_units.filter((unit) => unit.role === "reader").map((unit) => unit.unit_id),
        "summary reader operation units",
      );
      assertSameSet(
        payload.operations.evaluator.scope_unit_ids,
        run.payload.selected_units.filter((unit) => unit.role === "evaluator").map((unit) => unit.unit_id),
        "summary evaluator operation units",
      );
      for (const proposal of proposals) {
        const attemptLink = proposal.links.find((link) => link.relationship === "attempt");
        const attempt = byKey.get(artifactKey(attemptLink.target_artifact_type, attemptLink.target_artifact_id));
        if (!hasExactArtifactLink(attempt, "run", run)) {
          relationshipError("run_review_summary proposals must share the summary's exact run lineage.");
        }
      }
      if (
        attempts.some(
          (attempt) =>
            !["reader", "evaluator"].includes(attempt.payload.role) || !hasExactArtifactLink(attempt, "run", run),
        )
      ) {
        relationshipError("run_review_summary attempts must share the summary's exact run lineage.");
      }
      assertSummaryOperationAttempts(payload.operations.reader, attempts, "reader");
      assertSummaryOperationAttempts(payload.operations.evaluator, attempts, "evaluator");
      break;
    }
    case "human_review_decision": {
      const summary = one("summary");
      if (payload.summary_sha256 !== summary.content_sha256) {
        relationshipError("human_review_decision summary_sha256 does not match its summary link.");
      }
      assertSubset(payload.accepted_unit_ids, summary.payload.operations.reader.scope_unit_ids, "human decision accepted units");
      if (payload.action === "accept" && payload.accepted_unit_ids.length === 0) {
        relationshipError("An accept decision requires a non-empty dependency-closed scope.");
      }
      if (payload.action !== "accept" && payload.accepted_unit_ids.length !== 0) {
        relationshipError("Reject/rerun decisions cannot materialize accepted units.");
      }
      const decisionProposals = many("evaluator_proposal");
      const summaryProposalLinks = summary.links.filter((link) => link.relationship === "evaluator_proposal");
      assertSameSet(
        decisionProposals.map((proposal) => artifactBinding(proposal)),
        summaryProposalLinks.map((link) => linkBinding(link)),
        "human decision canonical proposals",
      );
      assertSubset(
        payload.accepted_unit_ids,
        decisionProposals.map((proposal) => proposal.payload.unit_id),
        "human decision accepted proposal units",
      );
      const acceptanceInputId = sha256Canonical(
        deriveAcceptanceInputProjection({
          acceptedScope: payload.accepted_unit_ids,
          proposals: decisionProposals,
          reviewPolicy: payload.review_policy,
          summary,
        }),
      );
      if (payload.acceptance_input_id !== acceptanceInputId) {
        relationshipError("human_review_decision acceptance_input_id does not match its exact canonical review input.");
      }
      break;
    }
    case "human_evaluation": {
      const decision = one("decision");
      const proposal = one("evaluator_proposal");
      const summary = one("summary");
      const decisionSummaryLink = decision.links.find((link) => link.relationship === "summary");
      if (
        payload.decision_id !== decision.artifact_id ||
        payload.proposal_id !== proposal.artifact_id ||
        payload.acceptance_input_id !== decision.payload.acceptance_input_id ||
        payload.unit_id !== proposal.payload.unit_id ||
        decision.payload.action !== "accept" ||
        !decision.payload.accepted_unit_ids.includes(payload.unit_id) ||
        payload.case_status !== proposal.payload.case_status ||
        payload.comparison_status !== proposal.payload.comparison_status ||
        decisionSummaryLink.target_artifact_id !== summary.artifact_id ||
        decisionSummaryLink.target_content_sha256 !== summary.content_sha256 ||
        !hasExactArtifactLink(decision, "evaluator_proposal", proposal) ||
        !hasExactArtifactLink(summary, "evaluator_proposal", proposal)
      ) {
        relationshipError("human_evaluation does not match its accepted decision/proposal/summary chain.");
      }
      break;
    }
    case "generated_report": {
      const run = one("run");
      if (payload.run_id !== run.payload.run_id) relationshipError("generated_report run_id does not match its run link.");
      const evaluations = many("human_evaluation");
      assertSameSet(payload.accepted_unit_ids, evaluations.map((item) => item.payload.unit_id), "generated_report accepted units");
      const decisions = evaluations.map((evaluation) => {
        const decisionLink = evaluation.links.find((link) => link.relationship === "decision");
        return byKey.get(artifactKey(decisionLink.target_artifact_type, decisionLink.target_artifact_id));
      });
      const decision = decisions[0];
      if (
        decisions.some((item) => artifactBinding(item) !== artifactBinding(decision)) ||
        decisions.some((item) => item.payload.acceptance_input_id !== payload.acceptance_input_id) ||
        evaluations.some(
          (evaluation) =>
            evaluation.payload.decision_id !== payload.decision_id ||
            evaluation.payload.acceptance_input_id !== payload.acceptance_input_id,
        ) ||
        payload.decision_id !== decision.artifact_id
      ) {
        relationshipError("generated_report evaluations must share one exact decision and acceptance identity.");
      }
      assertSameSet(
        payload.accepted_unit_ids,
        decision.payload.accepted_unit_ids,
        "generated_report decision-authorized accepted units",
      );
      const summaries = evaluations.map((evaluation) => {
        const summaryLink = evaluation.links.find((link) => link.relationship === "summary");
        return byKey.get(artifactKey(summaryLink.target_artifact_type, summaryLink.target_artifact_id));
      });
      if (summaries.some((summary) => summary.content_sha256 !== payload.summary_sha256)) {
        relationshipError("generated_report summary_sha256 does not match accepted evaluations.");
      }
      if (summaries.some((summary) => !hasExactArtifactLink(summary, "run", run))) {
        relationshipError("generated_report evaluations do not share the report's exact run lineage.");
      }
      const caseStatuses = ["failed", "not_run", "partially_passed", "passed"];
      const comparisonStatuses = ["equivalent", "improved", "inconclusive", "not_applicable", "regressed"];
      for (const status of caseStatuses) {
        assertSameSet(
          payload.aggregates.case_status[status],
          evaluations.filter((evaluation) => evaluation.payload.case_status === status).map((evaluation) => evaluation.payload.unit_id),
          `generated_report case_status.${status}`,
        );
      }
      for (const status of comparisonStatuses) {
        assertSameSet(
          payload.aggregates.comparison_status[status],
          evaluations
            .filter((evaluation) => (evaluation.payload.comparison_status ?? "not_applicable") === status)
            .map((evaluation) => evaluation.payload.unit_id),
          `generated_report comparison_status.${status}`,
        );
      }
      break;
    }
  }
}

function assertArtifactPayloadIdentity(artifact) {
  const identityField = {
    task_manifest: "task_id",
    run_manifest: "run_id",
  }[artifact.artifact_type];
  if (identityField && artifact.artifact_id !== artifact.payload[identityField]) {
    relationshipError(`${artifact.artifact_type} artifact_id must equal payload.${identityField}.`);
  }
}

function artifactBinding(artifact) {
  return `${artifact.artifact_type}:${artifact.artifact_id}:${artifact.content_sha256}`;
}

function linkBinding(link) {
  return `${link.target_artifact_type}:${link.target_artifact_id}:${link.target_content_sha256}`;
}

function hasExactArtifactLink(source, relationship, target) {
  return source.links.some(
    (link) => relationship === link.relationship && linkBinding(link) === artifactBinding(target),
  );
}

function canonicalEvidenceBindings(proposals) {
  const byArtifact = new Map();
  for (const proposal of proposals) {
    for (const link of proposal.links) {
      if (!["observation", "resource_observation"].includes(link.relationship)) continue;
      const key = `${link.target_artifact_type}:${link.target_artifact_id}`;
      const binding = {
        artifact_id: link.target_artifact_id,
        artifact_type: link.target_artifact_type,
        content_sha256: link.target_content_sha256,
      };
      const existing = byArtifact.get(key);
      if (existing && existing.content_sha256 !== binding.content_sha256) {
        relationshipError("Canonical evaluator proposals bind conflicting hashes for one evidence artifact.");
      }
      byArtifact.set(key, binding);
    }
  }
  return [...byArtifact.values()].sort((left, right) =>
    compareStrings(`${left.artifact_type}:${left.artifact_id}`, `${right.artifact_type}:${right.artifact_id}`),
  );
}

const payloadValidators = Object.freeze({
  task_manifest: validateTaskManifest,
  run_manifest: validateRunManifest,
  compiled_invocation: validateCompiledInvocation,
  verification_helper_input: validateVerificationHelperInput,
  readiness_analysis: validateReadinessAnalysis,
  execution_attempt: validateExecutionAttempt,
  runtime_attestation: validateRuntimeAttestation,
  runtime_dispatch_request: validateRuntimeDispatchRequest,
  runtime_event: validateRuntimeEvent,
  observation: validateObservation,
  resource_observation: validateResourceObservation,
  evaluator_proposal: validateEvaluatorProposal,
  run_review_summary: validateRunReviewSummary,
  human_review_decision: validateHumanReviewDecision,
  human_evaluation: validateHumanEvaluation,
  generated_report: validateGeneratedReport,
});

function validateTaskManifest(value) {
  assertRecord(value, "task_manifest payload");
  assertExactKeys(
    value,
    ["created_at", "lifecycle", "provenance", "retention_policy_version", "task_id"],
    "task_manifest payload",
  );
  assertIdentity(value.task_id, "task_id");
  assertLiteral(value.lifecycle, "active", "lifecycle");
  assertTimestamp(value.created_at, "created_at");
  assertIdentity(value.retention_policy_version, "retention_policy_version");
  assertRecord(value.provenance, "provenance");
  assertExactKeys(value.provenance, ["branch", "commit", "pull_request"], "provenance");
  assertNullableString(value.provenance.branch, "provenance.branch");
  assertNullableHash(value.provenance.commit, "provenance.commit");
  assertNullableString(value.provenance.pull_request, "provenance.pull_request");
}

function validateRunManifest(value) {
  assertRecord(value, "run_manifest payload");
  const keys = [
    "adapter_id",
    "created_at",
    "revision",
    "run_id",
    "runtime_config_sha256",
    "selected_units",
    "state",
    "task_id",
  ];
  if (Object.hasOwn(value, "intent")) keys.push("intent");
  assertExactKeys(
    value,
    keys,
    "run_manifest payload",
  );
  assertIdentity(value.run_id, "run_id");
  assertIdentity(value.task_id, "task_id");
  assertNonNegativeInteger(value.revision, "revision");
  assertEnum(value.state, runStates, "state");
  assertRuntimeIdentity(value.adapter_id, "adapter_id");
  assertHash(value.runtime_config_sha256, "runtime_config_sha256");
  assertTimestamp(value.created_at, "created_at");
  if (Object.hasOwn(value, "intent")) assertRunIntent(value.intent);
  assertArray(value.selected_units, "selected_units");
  const unitIds = [];
  for (const [index, unit] of value.selected_units.entries()) {
    const label = `selected_units[${index}]`;
    assertRecord(unit, label);
    assertExactKeys(unit, ["case_id", "role", "suite", "unit_id", "variant"], label);
    assertIdentity(unit.unit_id, `${label}.unit_id`);
    assertIdentity(unit.case_id, `${label}.case_id`);
    assertIdentity(unit.suite, `${label}.suite`);
    assertIdentity(unit.variant, `${label}.variant`);
    assertEnum(unit.role, ["reader", "evaluator"], `${label}.role`);
    unitIds.push(unit.unit_id);
  }
  assertSortedUniqueStrings(unitIds, "selected_units unit_id");
}

function validateCompiledInvocation(value) {
  assertRecord(value, "compiled_invocation payload");
  assertExactKeys(
    value,
    [
      "messages",
      "model_visible_policy",
      "protocol",
      "requested_policy",
      "resources",
      "role",
      "run_id",
      "runtime",
      "tools",
      "unit_id",
    ],
    "compiled_invocation payload",
  );
  assertIdentity(value.run_id, "compiled_invocation.run_id");
  assertIdentity(value.unit_id, "compiled_invocation.unit_id");
  assertEnum(value.role, ["reader", "evaluator", "verification_helper"], "compiled_invocation.role");
  assertArray(value.messages, "compiled_invocation.messages");
  if (value.messages.length === 0) schemaError("compiled_invocation.messages must not be empty.");
  for (const [index, message] of value.messages.entries()) {
    const label = `compiled_invocation.messages[${index}]`;
    assertRecord(message, label);
    assertExactKeys(message, ["content", "role"], label);
    assertEnum(message.role, ["system", "developer", "user", "assistant"], `${label}.role`);
    assertTrimmedString(message.content, `${label}.content`);
  }
  assertNamedEntries(value.tools, "compiled_invocation.tools", ["description", "name"]);
  assertResourceEntries(value.resources, "compiled_invocation.resources");
  assertExecutionPolicy(value.requested_policy, "requested_policy");
  assertExecutionPolicy(value.model_visible_policy, "model_visible_policy");
  assertRuntime(value.runtime, "runtime");
  if (
    value.runtime.runtime_class === "codex-app-server" &&
    canonicalJson(value.runtime.behavior_runtime.effective_policy) !== canonicalJson(value.requested_policy)
  ) {
    relationshipError("runtime.behavior_runtime must bind the exact requested execution policy.");
  }
  assertRecord(value.protocol, "protocol");
  assertExactKeys(value.protocol, ["observation_instructions", "output_schema"], "protocol");
  assertTrimmedString(value.protocol.observation_instructions, "protocol.observation_instructions");
  assertIdentity(value.protocol.output_schema, "protocol.output_schema");
}

function validateReadinessAnalysis(value) {
  assertRecord(value, "readiness_analysis payload");
  assertExactKeys(
    value,
    [
      "correction",
      "field_results",
      "grants",
      "helper_attempt_ids",
      "invocation_hashes",
      "round",
      "run_id",
      "stage",
      "status",
    ],
    "readiness_analysis payload",
  );
  assertIdentity(value.run_id, "readiness_analysis.run_id");
  assertEnum(value.round, [1, 2], "readiness_analysis.round");
  assertEnum(value.stage, ["reader", "evaluator", "evaluator_static"], "readiness_analysis.stage");
  assertEnum(value.status, ["passed", "failed", "blocked"], "readiness_analysis.status");
  assertArray(value.field_results, "field_results");
  const fieldNames = [];
  for (const [index, result] of value.field_results.entries()) {
    const label = `field_results[${index}]`;
    assertRecord(result, label);
    assertExactKeys(result, ["attested", "compiled", "field", "reason", "requested", "status"], label);
    assertIdentity(result.field, `${label}.field`);
    assertJsonValue(result.requested, `${label}.requested`);
    assertJsonValue(result.compiled, `${label}.compiled`);
    assertJsonValue(result.attested, `${label}.attested`);
    assertEnum(result.status, ["passed", "failed"], `${label}.status`);
    assertNullableString(result.reason, `${label}.reason`);
    if ((result.status === "passed") !== (result.reason === null)) {
      relationshipError(`${label} must use null reason only for passed results.`);
    }
    fieldNames.push(result.field);
  }
  assertSortedUniqueStrings(fieldNames, "field_results fields");
  assertSortedUniqueHashes(value.invocation_hashes, "invocation_hashes");
  assertSortedUniqueIdentities(value.helper_attempt_ids, "helper_attempt_ids");
  if (value.correction !== null) {
    assertRecord(value.correction, "correction");
    assertExactKeys(value.correction, ["after_sha256", "before_sha256", "changed_fields"], "correction");
    assertHash(value.correction.before_sha256, "correction.before_sha256");
    assertHash(value.correction.after_sha256, "correction.after_sha256");
    assertSortedUniqueIdentities(value.correction.changed_fields, "correction.changed_fields");
    if (
      value.correction.before_sha256 === value.correction.after_sha256 ||
      value.correction.changed_fields.length === 0 ||
      value.correction.changed_fields.some(
        (field) => !/^runtime-parameters-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(field),
      )
    ) {
      relationshipError("Readiness correction must describe a non-empty ephemeral runtime-parameter change.");
    }
  }
  if ((value.round === 1) !== (value.correction === null)) {
    relationshipError("Only Round 2 may carry one readiness correction.");
  }
  assertArray(value.grants, "grants");
  const grantUnits = [];
  const grantNonces = [];
  for (const [index, grant] of value.grants.entries()) {
    const label = `grants[${index}]`;
    assertRecord(grant, label);
    assertExactKeys(grant, ["invocation_sha256", "nonce", "single_use", "unit_id"], label);
    assertIdentity(grant.unit_id, `${label}.unit_id`);
    assertHash(grant.invocation_sha256, `${label}.invocation_sha256`);
    assertIdentity(grant.nonce, `${label}.nonce`);
    if (grant.single_use !== true) schemaError(`${label}.single_use must be true.`);
    grantUnits.push(grant.unit_id);
    grantNonces.push(grant.nonce);
  }
  assertSortedUniqueStrings(grantUnits, "grant unit_id");
  if (new Set(grantNonces).size !== grantNonces.length) relationshipError("Dispatch grant nonces must be unique.");
  if (value.status !== "passed" && value.grants.length !== 0) {
    relationshipError("Failed or blocked readiness cannot issue dispatch grants.");
  }
}

function validateVerificationHelperInput(value) {
  assertRecord(value, "verification_helper_input payload");
  assertExactKeys(
    value,
    ["cluster", "compiled_invocation_sha256", "helper_index", "helper_input_hash", "run_id", "uncertainty_cluster_id"],
    "verification_helper_input payload",
  );
  assertVerificationHelperCluster(value.cluster);
  assertHash(value.compiled_invocation_sha256, "verification_helper_input.compiled_invocation_sha256");
  assertEnum(value.helper_index, [1, 2], "verification_helper_input.helper_index");
  assertHash(value.helper_input_hash, "verification_helper_input.helper_input_hash");
  assertIdentity(value.run_id, "verification_helper_input.run_id");
  assertIdentity(value.uncertainty_cluster_id, "verification_helper_input.uncertainty_cluster_id");
}

function assertVerificationHelperCluster(value) {
  const label = "verification_helper_input.cluster";
  assertRecord(value, label);
  assertExactKeys(
    value,
    ["category", "cluster_id", "context", "protocol", "question", "requested_policy", "resources", "runtime"],
    label,
  );
  assertLiteral(value.category, "non_p0", `${label}.category`);
  assertIdentity(value.cluster_id, `${label}.cluster_id`);
  assertTrimmedString(value.question, `${label}.question`);
  assertArray(value.context, `${label}.context`);
  const contextLabels = [];
  for (const [index, entry] of value.context.entries()) {
    const entryLabel = `${label}.context[${index}]`;
    assertRecord(entry, entryLabel);
    assertExactKeys(entry, ["label", "sha256"], entryLabel);
    assertIdentity(entry.label, `${entryLabel}.label`);
    assertHash(entry.sha256, `${entryLabel}.sha256`);
    contextLabels.push(entry.label);
  }
  assertSortedUniqueStrings(contextLabels, `${label}.context labels`);
  assertRecord(value.protocol, `${label}.protocol`);
  assertExactKeys(value.protocol, ["observation_instructions", "output_schema"], `${label}.protocol`);
  assertTrimmedString(value.protocol.observation_instructions, `${label}.protocol.observation_instructions`);
  assertIdentity(value.protocol.output_schema, `${label}.protocol.output_schema`);
  assertExecutionPolicy(value.requested_policy, `${label}.requested_policy`);
  assertResourceEntries(value.resources, `${label}.resources`);
  assertRuntime(value.runtime, `${label}.runtime`);
}

function validateExecutionAttempt(value) {
  assertRecord(value, "execution_attempt payload");
  assertExactKeys(
    value,
    [
      "attempt_id",
      "call_certainty",
      "finished_at",
      "input_sha256",
      "outcome",
      "phase",
      "role",
      "run_id",
      "sequence",
      "started_at",
      "unit_id",
    ],
    "execution_attempt payload",
  );
  assertIdentity(value.attempt_id, "attempt_id");
  assertIdentity(value.run_id, "execution_attempt.run_id");
  assertNullableIdentity(value.unit_id, "execution_attempt.unit_id");
  assertEnum(value.role, ["reader", "evaluator", "verification_helper"], "execution_attempt.role");
  assertHash(value.input_sha256, "execution_attempt.input_sha256");
  assertPositiveInteger(value.sequence, "execution_attempt.sequence");
  assertEnum(value.phase, ["prepared", "dispatched", "terminal"], "execution_attempt.phase");
  assertEnum(
    value.call_certainty,
    ["not_started", "confirmed_not_started", "started", "confirmed_finished", "unknown"],
    "execution_attempt.call_certainty",
  );
  assertNullableEnum(
    value.outcome,
    ["success", "error", "timeout", "cancelled", "outcome_unknown"],
    "execution_attempt.outcome",
  );
  assertTimestamp(value.started_at, "execution_attempt.started_at");
  assertNullableTimestamp(value.finished_at, "execution_attempt.finished_at");
  if (value.phase === "terminal" && (value.outcome === null || value.finished_at === null)) {
    relationshipError("A terminal attempt requires outcome and finished_at.");
  }
  if (value.phase !== "terminal" && (value.outcome !== null || value.finished_at !== null)) {
    relationshipError("A nonterminal attempt cannot have outcome or finished_at.");
  }
  if (value.phase === "prepared" && !["not_started", "confirmed_not_started"].includes(value.call_certainty)) {
    relationshipError("A prepared attempt cannot claim that dispatch started.");
  }
  if (value.phase === "dispatched" && !["started", "unknown"].includes(value.call_certainty)) {
    relationshipError("A dispatched attempt requires started or unknown call certainty.");
  }
  if (value.phase === "terminal" && !["confirmed_not_started", "confirmed_finished", "unknown"].includes(value.call_certainty)) {
    relationshipError("A terminal attempt requires confirmed_not_started, confirmed_finished, or unknown call certainty.");
  }
  if (value.outcome === "outcome_unknown" && value.call_certainty !== "unknown") {
    relationshipError("outcome_unknown requires unknown call certainty.");
  }
  if (value.phase === "terminal" && value.call_certainty === "unknown" && value.outcome !== "outcome_unknown") {
    relationshipError("A terminal attempt with unknown call certainty must preserve outcome_unknown.");
  }
  if (value.outcome === "success" && value.call_certainty !== "confirmed_finished") {
    relationshipError("A successful attempt requires confirmed_finished call certainty.");
  }
  if (value.call_certainty === "confirmed_not_started" && !["error", "timeout", "cancelled"].includes(value.outcome)) {
    relationshipError("confirmed_not_started terminal attempts require an explicit non-success outcome.");
  }
  if (value.role === "verification_helper" && value.unit_id !== null) {
    relationshipError("verification_helper attempts must not claim a case unit_id.");
  }
}

function validateRuntimeAttestation(value) {
  assertRecord(value, "runtime_attestation payload");
  assertExactKeys(
    value,
    [
      "adapter_id",
      "adapter_version",
      "assurance_profile",
      "attempt_id",
      "auth_mode",
      "behavior_runtime_sha256",
      "capability_limitations",
      "codex_version",
      "config_sha256",
      "effective_policy",
      "effective_policy_sha256",
      "effort",
      "executable_path",
      "executable_sha256",
      "fresh_context_method",
      "instruction_sources",
      "intent_sha256",
      "model",
      "output_schema_name",
      "output_schema_sha256",
      "platform",
      "protocol_schema_sha256",
      "role",
      "run_id",
      "runtime_identity",
      "session_id",
      "thread_id",
      "transport",
      "unit_id",
    ],
    "runtime_attestation payload",
  );
  assertLiteral(value.adapter_id, "codex_chatgpt_app_server", "runtime_attestation.adapter_id");
  assertTrimmedString(value.adapter_version, "runtime_attestation.adapter_version");
  assertLiteral(value.assurance_profile, "runtime_mediated", "runtime_attestation.assurance_profile");
  assertIdentity(value.attempt_id, "runtime_attestation.attempt_id");
  assertLiteral(value.auth_mode, "chatgpt", "runtime_attestation.auth_mode");
  assertHash(value.behavior_runtime_sha256, "runtime_attestation.behavior_runtime_sha256");
  assertSortedUniqueStrings(value.capability_limitations, "runtime_attestation.capability_limitations");
  for (const [index, limitation] of value.capability_limitations.entries()) {
    assertTrimmedString(limitation, `runtime_attestation.capability_limitations[${index}]`);
  }
  for (const [field, entry] of Object.entries({
    adapter_version: value.adapter_version,
    codex_version: value.codex_version,
    effort: value.effort,
    executable_path: value.executable_path,
    fresh_context_method: value.fresh_context_method,
    model: value.model,
    platform: value.platform,
    runtime_identity: value.runtime_identity,
  })) {
    assertTrimmedString(entry, `runtime_attestation.${field}`);
  }
  assertHash(value.config_sha256, "runtime_attestation.config_sha256");
  assertHash(value.intent_sha256, "runtime_attestation.intent_sha256");
  assertHash(value.executable_sha256, "runtime_attestation.executable_sha256");
  assertHash(value.protocol_schema_sha256, "runtime_attestation.protocol_schema_sha256");
  assertHash(value.output_schema_sha256, "runtime_attestation.output_schema_sha256");
  assertIdentity(value.output_schema_name, "runtime_attestation.output_schema_name");
  assertExecutionPolicy(value.effective_policy, "runtime_attestation.effective_policy");
  assertHash(value.effective_policy_sha256, "runtime_attestation.effective_policy_sha256");
  if (value.effective_policy_sha256 !== sha256Canonical(value.effective_policy)) {
    schemaError("runtime_attestation.effective_policy_sha256 does not match effective_policy.");
  }
  assertEnum(value.role, ["reader", "evaluator", "verification_helper"], "runtime_attestation.role");
  assertIdentity(value.run_id, "runtime_attestation.run_id");
  assertNullableIdentity(value.unit_id, "runtime_attestation.unit_id");
  assertIdentity(value.thread_id, "runtime_attestation.thread_id");
  assertNullableIdentity(value.session_id, "runtime_attestation.session_id");
  assertLiteral(value.transport, "stdio-jsonl", "runtime_attestation.transport");
  assertArray(value.instruction_sources, "runtime_attestation.instruction_sources");
  const sourcePaths = [];
  for (const [index, source] of value.instruction_sources.entries()) {
    const label = `runtime_attestation.instruction_sources[${index}]`;
    assertRecord(source, label);
    assertExactKeys(source, ["path", "sha256"], label);
    assertRuntimePath(source.path, `${label}.path`);
    assertHash(source.sha256, `${label}.sha256`);
    sourcePaths.push(source.path);
  }
  assertSortedUniqueStrings(sourcePaths, "runtime_attestation instruction source paths");
}

function validateRuntimeDispatchRequest(value) {
  assertRecord(value, "runtime_dispatch_request payload");
  assertExactKeys(
    value,
    [
      "attempt_id",
      "credential_free",
      "grant_nonce",
      "input_sha256",
      "invocation_sha256",
      "output_schema_sha256",
      "readiness_sha256",
      "request_id",
      "request_json",
      "role",
      "run_id",
      "runtime_attestation_sha256",
      "semantic_dispatch_sha256",
      "thread_id",
      "unit_id",
      "wire_request_sha256",
    ],
    "runtime_dispatch_request payload",
  );
  assertIdentity(value.attempt_id, "runtime_dispatch_request.attempt_id");
  if (value.credential_free !== true) schemaError("runtime_dispatch_request.credential_free must be true.");
  assertIdentity(value.grant_nonce, "runtime_dispatch_request.grant_nonce");
  for (const field of ["input_sha256", "invocation_sha256", "output_schema_sha256", "runtime_attestation_sha256", "semantic_dispatch_sha256", "wire_request_sha256"]) {
    assertHash(value[field], `runtime_dispatch_request.${field}`);
  }
  assertNullableHash(value.readiness_sha256, "runtime_dispatch_request.readiness_sha256");
  assertIdentity(value.request_id, "runtime_dispatch_request.request_id");
  assertString(value.request_json, "runtime_dispatch_request.request_json");
  if (!value.request_json.endsWith("\n")) schemaError("runtime_dispatch_request.request_json must be newline terminated.");
  assertRuntimeCredentialFree(parseStrictJson(Buffer.from(value.request_json, "utf8"), "runtime dispatch request"));
  assertEnum(value.role, ["reader", "evaluator", "verification_helper"], "runtime_dispatch_request.role");
  assertIdentity(value.run_id, "runtime_dispatch_request.run_id");
  assertIdentity(value.thread_id, "runtime_dispatch_request.thread_id");
  assertNullableIdentity(value.unit_id, "runtime_dispatch_request.unit_id");
}

function validateRuntimeEvent(value) {
  assertRecord(value, "runtime_event payload");
  assertExactKeys(
    value,
    [
      "attempt_id",
      "control_request_id",
      "event_json",
      "event_json_sha256",
      "event_type",
      "occurred_at",
      "request_id",
      "role",
      "run_id",
      "status",
      "thread_id",
      "turn_id",
      "unit_id",
    ],
    "runtime_event payload",
  );
  assertIdentity(value.attempt_id, "runtime_event.attempt_id");
  assertNullableIdentity(value.control_request_id, "runtime_event.control_request_id");
  assertEnum(
    value.event_type,
    [
      "turn_start_write_intent",
      "turn_start_write_completed",
      "turn_start_acknowledged",
      "turn_completed",
      "turn_interrupt_requested",
      "turn_interrupt_acknowledged",
      "turn_lookup_result",
      "transport_error",
    ],
    "runtime_event.event_type",
  );
  if (value.event_json !== null) {
    assertString(value.event_json, "runtime_event.event_json");
    if (!value.event_json.endsWith("\n") || value.event_json.slice(0, -1).includes("\n")) {
      schemaError("runtime_event.event_json must retain exactly one newline-terminated JSONL record.");
    }
    if (Buffer.byteLength(value.event_json, "utf8") > 262_144) {
      schemaError("runtime_event.event_json exceeds the bounded control-plane retention limit.");
    }
    assertRuntimeControlPlaneEvent(
      parseStrictJson(Buffer.from(value.event_json, "utf8"), "runtime event"),
      value.event_type,
    );
  }
  assertNullableHash(value.event_json_sha256, "runtime_event.event_json_sha256");
  assertTimestamp(value.occurred_at, "runtime_event.occurred_at");
  assertIdentity(value.request_id, "runtime_event.request_id");
  assertEnum(value.role, ["reader", "evaluator", "verification_helper"], "runtime_event.role");
  assertIdentity(value.run_id, "runtime_event.run_id");
  assertEnum(value.status, ["intent", "written", "acknowledged", "completed", "requested", "accepted", "error", "unknown"], "runtime_event.status");
  const expectedStatuses = {
    transport_error: ["error", "unknown"],
    turn_completed: ["completed"],
    turn_interrupt_acknowledged: ["accepted", "unknown"],
    turn_interrupt_requested: ["requested"],
    turn_lookup_result: ["completed", "unknown"],
    turn_start_acknowledged: ["acknowledged"],
    turn_start_write_completed: ["written"],
    turn_start_write_intent: ["intent"],
  };
  if (!expectedStatuses[value.event_type].includes(value.status)) {
    schemaError("runtime_event event_type/status combination is invalid.");
  }
  assertIdentity(value.thread_id, "runtime_event.thread_id");
  assertNullableIdentity(value.turn_id, "runtime_event.turn_id");
  assertNullableIdentity(value.unit_id, "runtime_event.unit_id");
}

function validateObservation(value) {
  assertRecord(value, "observation payload");
  assertExactKeys(
    value,
    ["attempt_id", "execution_status", "observed_access", "raw_text", "run_id", "unit_id"],
    "observation payload",
  );
  assertIdentity(value.attempt_id, "observation.attempt_id");
  assertIdentity(value.run_id, "observation.run_id");
  assertIdentity(value.unit_id, "observation.unit_id");
  assertEnum(value.execution_status, ["completed", "not_run"], "observation.execution_status");
  assertString(value.raw_text, "observation.raw_text");
  assertRecord(value.observed_access, "observation.observed_access");
  assertExactKeys(
    value.observed_access,
    ["credentials", "filesystem", "mutation", "network", "remote_actions", "tools"],
    "observation.observed_access",
  );
  for (const field of Object.keys(value.observed_access)) {
    assertEnum(value.observed_access[field], ["observed", "not_observed", "unknown"], `observed_access.${field}`);
  }
}

function validateResourceObservation(value) {
  assertRecord(value, "resource_observation payload");
  assertExactKeys(
    value,
    ["basis", "denied", "limitations", "observation_id", "read", "supplied"],
    "resource_observation payload",
  );
  assertIdentity(value.observation_id, "resource_observation.observation_id");
  assertEnum(value.basis, ["runtime_observation", "operator_observation", "executor_self_report", "unavailable"], "resource_observation.basis");
  assertString(value.limitations, "resource_observation.limitations");
  for (const field of ["supplied", "read", "denied"]) {
    if (value[field] === null) continue;
    assertResourceEntries(value[field], `resource_observation.${field}`);
  }
  if (value.basis === "unavailable" && [value.supplied, value.read, value.denied].some((entry) => entry !== null)) {
    relationshipError("Unavailable resource evidence requires null supplied/read/denied dimensions.");
  }
}

function validateEvaluatorProposal(value) {
  assertRecord(value, "evaluator_proposal payload");
  assertExactKeys(
    value,
    ["case_status", "citations", "comparison_status", "rationale", "recommendation", "uncertainty", "unit_id"],
    "evaluator_proposal payload",
  );
  assertIdentity(value.unit_id, "evaluator_proposal.unit_id");
  assertNullableEnum(value.case_status, ["passed", "partially_passed", "failed", "not_run"], "case_status");
  assertNullableEnum(value.comparison_status, ["improved", "equivalent", "regressed", "inconclusive"], "comparison_status");
  assertString(value.rationale, "evaluator_proposal.rationale");
  assertString(value.uncertainty, "evaluator_proposal.uncertainty");
  assertEnum(value.recommendation, ["accept", "reject", "rerun"], "evaluator_proposal.recommendation");
  assertArray(value.citations, "evaluator_proposal.citations");
  for (const [index, citation] of value.citations.entries()) {
    const label = `evaluator_proposal.citations[${index}]`;
    assertRecord(citation, label);
    assertExactKeys(citation, ["artifact_id", "label"], label);
    assertIdentity(citation.artifact_id, `${label}.artifact_id`);
    assertString(citation.label, `${label}.label`);
  }
}

function validateRunReviewSummary(value) {
  assertRecord(value, "run_review_summary payload");
  assertExactKeys(
    value,
    [
      "anomalies",
      "baseline",
      "candidate",
      "comparison",
      "drill_down_links",
      "exceptions",
      "limitations",
      "operations",
      "proposed_action",
      "readiness",
      "recommendation",
      "renderer_contract",
      "scope",
    ],
    "run_review_summary payload",
  );
  assertRecord(value.scope, "summary.scope");
  assertExactKeys(
    value.scope,
    ["baseline_case_ids", "candidate_case_ids", "comparable_unit_ids", "selected_case_ids"],
    "summary.scope",
  );
  for (const field of Object.keys(value.scope)) assertSortedUniqueIdentities(value.scope[field], `scope.${field}`);
  assertSubset(value.scope.baseline_case_ids, value.scope.selected_case_ids, "baseline_case_ids");
  assertSubset(value.scope.candidate_case_ids, value.scope.selected_case_ids, "candidate_case_ids");
  validateCaseAggregate(value.baseline, value.scope.baseline_case_ids, "baseline");
  validateCaseAggregate(value.candidate, value.scope.candidate_case_ids, "candidate");
  validateComparisonAggregate(value.comparison, value.scope.comparable_unit_ids);
  assertRecord(value.operations, "summary.operations");
  assertExactKeys(value.operations, ["evaluator", "reader"], "summary.operations");
  validateOperationalAggregate(value.operations.reader, "reader");
  validateOperationalAggregate(value.operations.evaluator, "evaluator");
  assertRecord(value.readiness, "summary.readiness");
  assertExactKeys(value.readiness, ["helper_call_count", "status"], "summary.readiness");
  assertEnum(value.readiness.status, ["passed", "failed", "blocked"], "summary.readiness.status");
  assertNonNegativeInteger(value.readiness.helper_call_count, "summary.readiness.helper_call_count");
  assertStringArray(value.exceptions, "summary.exceptions");
  assertStringArray(value.anomalies, "summary.anomalies");
  assertStringArray(value.limitations, "summary.limitations");
  assertString(value.recommendation, "summary.recommendation");
  assertString(value.proposed_action, "summary.proposed_action");
  assertRecord(value.renderer_contract, "renderer_contract");
  assertExactKeys(
    value.renderer_contract,
    ["html_mode", "link_policy", "markdown_mode", "security_policy_version", "untrusted_text"],
    "renderer_contract",
  );
  if (value.renderer_contract.untrusted_text !== true) relationshipError("Renderer contract must default to untrusted text.");
  assertLiteral(value.renderer_contract.markdown_mode, "context-escaped-text", "renderer_contract.markdown_mode");
  assertLiteral(value.renderer_contract.html_mode, "static-escaped-no-javascript", "renderer_contract.html_mode");
  assertLiteral(value.renderer_contract.link_policy, "typed-contained-local-only", "renderer_contract.link_policy");
  assertIdentity(value.renderer_contract.security_policy_version, "renderer_contract.security_policy_version");
  assertArray(value.drill_down_links, "drill_down_links");
  for (const [index, link] of value.drill_down_links.entries()) {
    const label = `drill_down_links[${index}]`;
    assertRecord(link, label);
    assertExactKeys(link, ["kind", "label", "relative_path", "sha256"], label);
    assertLiteral(link.kind, "task_artifact", `${label}.kind`);
    assertString(link.label, `${label}.label`);
    assertNormalizedPath(link.relative_path, `${label}.relative_path`);
    assertHash(link.sha256, `${label}.sha256`);
  }
}

function validateHumanReviewDecision(value) {
  assertRecord(value, "human_review_decision payload");
  assertExactKeys(
    value,
    [
      "acceptance_input_id",
      "accepted_unit_ids",
      "action",
      "decided_at",
      "rationale",
      "review_policy",
      "reviewer",
      "summary_sha256",
    ],
    "human_review_decision payload",
  );
  assertEnum(value.action, ["accept", "reject", "rerun"], "human_review_decision.action");
  assertHash(value.acceptance_input_id, "human_review_decision.acceptance_input_id");
  assertSortedUniqueIdentities(value.accepted_unit_ids, "accepted_unit_ids");
  assertJsonValue(value.review_policy, "human_review_decision.review_policy");
  assertHash(value.summary_sha256, "summary_sha256");
  assertString(value.rationale, "human_review_decision.rationale");
  assertTimestamp(value.decided_at, "human_review_decision.decided_at");
  assertRecord(value.reviewer, "human_review_decision.reviewer");
  assertExactKeys(value.reviewer, ["identity", "identity_type"], "human_review_decision.reviewer");
  assertIdentity(value.reviewer.identity, "reviewer.identity");
  assertEnum(value.reviewer.identity_type, ["local_named_reviewer", "signed_identity"], "reviewer.identity_type");
}

function validateHumanEvaluation(value) {
  assertRecord(value, "human_evaluation payload");
  assertExactKeys(
    value,
    ["acceptance_input_id", "case_status", "comparison_status", "decision_id", "proposal_id", "unit_id"],
    "human_evaluation payload",
  );
  assertIdentity(value.unit_id, "human_evaluation.unit_id");
  assertHash(value.acceptance_input_id, "human_evaluation.acceptance_input_id");
  assertIdentity(value.decision_id, "human_evaluation.decision_id");
  assertIdentity(value.proposal_id, "human_evaluation.proposal_id");
  assertEnum(value.case_status, ["passed", "partially_passed", "failed", "not_run"], "human_evaluation.case_status");
  assertNullableEnum(value.comparison_status, ["improved", "equivalent", "regressed", "inconclusive"], "human_evaluation.comparison_status");
}

function validateGeneratedReport(value) {
  assertRecord(value, "generated_report payload");
  assertExactKeys(
    value,
    ["acceptance_input_id", "accepted_unit_ids", "aggregates", "decision_id", "run_id", "status", "summary_sha256"],
    "generated_report payload",
  );
  assertHash(value.acceptance_input_id, "generated_report.acceptance_input_id");
  assertIdentity(value.decision_id, "generated_report.decision_id");
  assertIdentity(value.run_id, "generated_report.run_id");
  assertEnum(value.status, ["complete", "incomplete", "review_pending", "rejected", "rerun_required"], "generated_report.status");
  assertSortedUniqueIdentities(value.accepted_unit_ids, "generated_report.accepted_unit_ids");
  assertHash(value.summary_sha256, "generated_report.summary_sha256");
  assertRecord(value.aggregates, "generated_report.aggregates");
  assertExactKeys(value.aggregates, ["case_status", "comparison_status"], "generated_report.aggregates");
  assertStatusMemberships(
    value.aggregates.case_status,
    ["failed", "not_run", "partially_passed", "passed"],
    value.accepted_unit_ids,
    "generated_report.aggregates.case_status",
  );
  assertStatusMemberships(
    value.aggregates.comparison_status,
    ["equivalent", "improved", "inconclusive", "not_applicable", "regressed"],
    value.accepted_unit_ids,
    "generated_report.aggregates.comparison_status",
  );
}

function assertStatusMemberships(value, statuses, scope, label) {
  assertRecord(value, label);
  assertExactKeys(value, statuses, label);
  for (const status of statuses) assertSortedUniqueIdentities(value[status], `${label}.${status}`);
  assertExactPartition(scope, statuses.map((status) => value[status]), label);
}

function validateCaseAggregate(value, expectedScope, label) {
  assertRecord(value, label);
  assertExactKeys(value, ["counts", "evidence", "scope_case_ids", "status_members"], label);
  assertSortedUniqueIdentities(value.scope_case_ids, `${label}.scope_case_ids`);
  assertSameSet(value.scope_case_ids, expectedScope, `${label} scope`);
  assertRecord(value.evidence, `${label}.evidence`);
  assertExactKeys(value.evidence, ["complete_case_ids", "incomplete_case_ids"], `${label}.evidence`);
  assertSortedUniqueIdentities(value.evidence.complete_case_ids, `${label}.evidence.complete_case_ids`);
  assertSortedUniqueIdentities(value.evidence.incomplete_case_ids, `${label}.evidence.incomplete_case_ids`);
  assertExactPartition(
    value.scope_case_ids,
    [value.evidence.complete_case_ids, value.evidence.incomplete_case_ids],
    `${label} evidence`,
  );
  const statuses = ["failed", "not_run", "partially_passed", "passed"];
  assertRecord(value.status_members, `${label}.status_members`);
  assertExactKeys(value.status_members, statuses, `${label}.status_members`);
  for (const status of statuses) assertSortedUniqueIdentities(value.status_members[status], `${label}.${status}`);
  assertExactPartition(
    value.evidence.complete_case_ids,
    statuses.map((status) => value.status_members[status]),
    `${label} assessed statuses`,
  );
  assertRecord(value.counts, `${label}.counts`);
  assertExactKeys(value.counts, [...statuses, "unassessed"], `${label}.counts`);
  for (const status of statuses) assertCount(value.counts[status], value.status_members[status], `${label}.counts.${status}`);
  assertCount(value.counts.unassessed, value.evidence.incomplete_case_ids, `${label}.counts.unassessed`);
}

function validateComparisonAggregate(value, expectedScope) {
  const label = "comparison";
  assertRecord(value, label);
  assertExactKeys(value, ["counts", "evidence", "scope_unit_ids", "status_members"], label);
  assertSortedUniqueIdentities(value.scope_unit_ids, `${label}.scope_unit_ids`);
  assertSameSet(value.scope_unit_ids, expectedScope, `${label} scope`);
  assertRecord(value.evidence, `${label}.evidence`);
  assertExactKeys(value.evidence, ["assessed_unit_ids", "unassessed_unit_ids"], `${label}.evidence`);
  assertSortedUniqueIdentities(value.evidence.assessed_unit_ids, `${label}.evidence.assessed_unit_ids`);
  assertSortedUniqueIdentities(value.evidence.unassessed_unit_ids, `${label}.evidence.unassessed_unit_ids`);
  assertExactPartition(value.scope_unit_ids, [value.evidence.assessed_unit_ids, value.evidence.unassessed_unit_ids], `${label} evidence`);
  const statuses = ["equivalent", "improved", "inconclusive", "regressed"];
  assertRecord(value.status_members, `${label}.status_members`);
  assertExactKeys(value.status_members, statuses, `${label}.status_members`);
  for (const status of statuses) assertSortedUniqueIdentities(value.status_members[status], `${label}.${status}`);
  assertExactPartition(
    value.evidence.assessed_unit_ids,
    statuses.map((status) => value.status_members[status]),
    `${label} assessed statuses`,
  );
  assertRecord(value.counts, `${label}.counts`);
  assertExactKeys(value.counts, [...statuses, "unassessed"], `${label}.counts`);
  for (const status of statuses) assertCount(value.counts[status], value.status_members[status], `${label}.counts.${status}`);
  assertCount(value.counts.unassessed, value.evidence.unassessed_unit_ids, `${label}.counts.unassessed`);
}

function validateOperationalAggregate(value, label) {
  assertRecord(value, `${label} operations`);
  assertExactKeys(
    value,
    ["attempts", "blocked_unit_ids", "newly_executed_unit_ids", "reused_unit_ids", "scope_unit_ids"],
    `${label} operations`,
  );
  for (const field of ["scope_unit_ids", "reused_unit_ids", "newly_executed_unit_ids", "blocked_unit_ids"]) {
    assertSortedUniqueIdentities(value[field], `${label}.${field}`);
  }
  assertExactPartition(
    value.scope_unit_ids,
    [value.reused_unit_ids, value.newly_executed_unit_ids, value.blocked_unit_ids],
    `${label} logical units`,
  );
  const attempts = value.attempts;
  assertRecord(attempts, `${label}.attempts`);
  assertExactKeys(attempts, ["initial_attempt_ids", "nonterminal_attempt_ids", "retry_attempt_ids", "terminal"], `${label}.attempts`);
  assertSortedUniqueIdentities(attempts.initial_attempt_ids, `${label}.initial_attempt_ids`);
  assertSortedUniqueIdentities(attempts.retry_attempt_ids, `${label}.retry_attempt_ids`);
  assertDisjoint([attempts.initial_attempt_ids, attempts.retry_attempt_ids], `${label} initial/retry attempts`);
  assertSortedUniqueIdentities(attempts.nonterminal_attempt_ids, `${label}.nonterminal_attempt_ids`);
  assertRecord(attempts.terminal, `${label}.terminal`);
  const outcomes = ["cancelled", "error", "outcome_unknown", "success", "timeout"];
  assertExactKeys(attempts.terminal, outcomes, `${label}.terminal`);
  for (const outcome of outcomes) assertSortedUniqueIdentities(attempts.terminal[outcome], `${label}.terminal.${outcome}`);
  const recorded = [...attempts.initial_attempt_ids, ...attempts.retry_attempt_ids].sort(compareStrings);
  const terminal = outcomes.flatMap((outcome) => attempts.terminal[outcome]);
  assertExactPartition(recorded, [terminal, attempts.nonterminal_attempt_ids], `${label} terminal/nonterminal attempts`);
}

function assertProducer(value, artifactType) {
  assertRecord(value, "producer");
  assertExactKeys(value, ["kind", "name", "version"], "producer");
  assertEnum(value.kind, producerKinds[artifactType], "producer.kind");
  assertIdentity(value.name, "producer.name");
  assertIdentity(value.version, "producer.version");
}

function assertLinks(value, artifactType) {
  assertArray(value, "links");
  const contracts = linkContracts[artifactType];
  const counts = new Map();
  const keys = [];
  for (const [index, link] of value.entries()) {
    const label = `links[${index}]`;
    assertRecord(link, label);
    assertExactKeys(
      link,
      ["relationship", "target_artifact_id", "target_artifact_type", "target_content_sha256"],
      label,
    );
    assertRelationship(link.relationship, `${label}.relationship`);
    const contract = contracts[link.relationship];
    if (!contract) relationshipError(`${artifactType} does not allow relationship '${link.relationship}'.`);
    assertLiteral(link.target_artifact_type, contract[2], `${label}.target_artifact_type`);
    assertIdentity(link.target_artifact_id, `${label}.target_artifact_id`);
    assertHash(link.target_content_sha256, `${label}.target_content_sha256`);
    counts.set(link.relationship, (counts.get(link.relationship) ?? 0) + 1);
    keys.push(`${link.relationship}:${link.target_artifact_type}:${link.target_artifact_id}`);
  }
  assertSortedUniqueStrings(keys, "links");
  for (const [relationship, [minimum, maximum]] of Object.entries(contracts)) {
    const count = counts.get(relationship) ?? 0;
    if (count < minimum || count > maximum) {
      relationshipError(`${artifactType} relationship '${relationship}' requires ${minimum}..${maximum} links.`);
    }
  }
}

function assertExecutionPolicy(value, label) {
  assertRecord(value, label);
  assertExactKeys(
    value,
    ["credentials", "filesystem", "fresh_context", "mutation", "network", "remote_actions", "supplied_resources", "tools"],
    label,
  );
  assertEnum(value.filesystem, ["none", "read_only", "write"], `${label}.filesystem`);
  assertSortedUniqueIdentities(value.tools, `${label}.tools`);
  assertEnum(value.network, ["denied", "required"], `${label}.network`);
  assertEnum(value.credentials, ["excluded", "required"], `${label}.credentials`);
  assertEnum(value.remote_actions, ["denied", "allowed"], `${label}.remote_actions`);
  assertEnum(value.mutation, ["denied", "allowed"], `${label}.mutation`);
  if (typeof value.fresh_context !== "boolean") schemaError(`${label}.fresh_context must be boolean.`);
  assertSortedUniquePaths(value.supplied_resources, `${label}.supplied_resources`);
}

function assertRunIntent(value) {
  assertRecord(value, "run_manifest.intent");
  assertExactKeys(
    value,
    ["assurance_profile", "authentication_boundary", "authority_record", "purpose", "selection_reason"],
    "run_manifest.intent",
  );
  assertBoundedText(value.purpose, "run_manifest.intent.purpose");
  assertBoundedText(value.selection_reason, "run_manifest.intent.selection_reason");
  assertLiteral(value.assurance_profile, "runtime_mediated", "run_manifest.intent.assurance_profile");
  assertLiteral(value.authentication_boundary, "chatgpt_subscription", "run_manifest.intent.authentication_boundary");
  const authority = value.authority_record;
  assertRecord(authority, "run_manifest.intent.authority_record");
  assertExactKeys(
    authority,
    ["authorized_roles", "basis", "live_call_limits", "live_model_calls", "recorded_at", "scope"],
    "run_manifest.intent.authority_record",
  );
  assertLiteral(authority.basis, "owner_explicit", "run_manifest.intent.authority_record.basis");
  assertTimestamp(authority.recorded_at, "run_manifest.intent.authority_record.recorded_at");
  assertBoundedText(authority.scope, "run_manifest.intent.authority_record.scope");
  assertArray(authority.authorized_roles, "run_manifest.intent.authority_record.authorized_roles");
  for (const [index, role] of authority.authorized_roles.entries()) {
    assertEnum(role, ["reader", "evaluator", "verification_helper"], `run_manifest.intent.authority_record.authorized_roles[${index}]`);
  }
  assertSortedUniqueStrings(authority.authorized_roles, "run_manifest.intent.authority_record.authorized_roles");
  if (typeof authority.live_model_calls !== "boolean") {
    schemaError("run_manifest.intent.authority_record.live_model_calls must be boolean.");
  }
  assertRecord(authority.live_call_limits, "run_manifest.intent.authority_record.live_call_limits");
  assertExactKeys(
    authority.live_call_limits,
    ["evaluator", "reader", "total", "verification_helper"],
    "run_manifest.intent.authority_record.live_call_limits",
  );
  for (const [field, limit] of Object.entries(authority.live_call_limits)) {
    assertNonNegativeInteger(limit, `run_manifest.intent.authority_record.live_call_limits.${field}`);
  }
  if (
    authority.live_call_limits.total !==
    authority.live_call_limits.reader + authority.live_call_limits.evaluator + authority.live_call_limits.verification_helper
  ) {
    relationshipError("run_manifest intent live-call total must equal its exact role limits.");
  }
  if (!authority.live_model_calls && Object.values(authority.live_call_limits).some((limit) => limit !== 0)) {
    relationshipError("A no-live-call run intent requires every live-call limit to be zero.");
  }
}

function assertRuntime(value, label) {
  assertRecord(value, label);
  const concrete = value.runtime_class === "codex-app-server";
  assertExactKeys(value, concrete ? ["behavior_runtime", "model", "parameters", "provider", "runtime_class"] : ["model", "parameters", "provider", "runtime_class"], label);
  assertTrimmedString(value.provider, `${label}.provider`);
  assertTrimmedString(value.model, `${label}.model`);
  assertIdentity(value.runtime_class, `${label}.runtime_class`);
  assertRecord(value.parameters, `${label}.parameters`);
  assertJsonValue(value.parameters, `${label}.parameters`);
  if (concrete) {
    assertBehaviorRuntimeProjection(value.behavior_runtime, `${label}.behavior_runtime`);
    if (
      value.behavior_runtime.model !== value.model ||
      value.behavior_runtime.effort !== value.parameters.effort
    ) {
      relationshipError(`${label}.behavior_runtime must bind the exact model and effort.`);
    }
  }
}

function behaviorRuntimeProjectionFromAttestation(value) {
  return assertBehaviorRuntimeProjection({
    adapter_id: value.adapter_id,
    adapter_version: value.adapter_version,
    assurance_profile: value.assurance_profile,
    auth_mode: value.auth_mode,
    capability_limitations: value.capability_limitations,
    codex_version: value.codex_version,
    config_sha256: value.config_sha256,
    effective_policy: value.effective_policy,
    effort: value.effort,
    executable_path: value.executable_path,
    executable_sha256: value.executable_sha256,
    fresh_context_method: value.fresh_context_method,
    instruction_sources: value.instruction_sources,
    model: value.model,
    platform: value.platform,
    protocol_schema_sha256: value.protocol_schema_sha256,
    runtime_identity: value.runtime_identity,
    transport: value.transport,
  });
}

function assertRuntimeEventBodyLineage(payload, body) {
  if (payload.event_type === "turn_interrupt_requested" && body.id !== payload.control_request_id) {
    relationshipError("runtime_event body event.id substitutes the outer control_request_id owner.");
  }
  const fields = new Map([
    ["requestId", [payload.control_request_id === null ? "request_id" : "control_request_id", payload.control_request_id ?? payload.request_id]],
    ["request_id", [payload.control_request_id === null ? "request_id" : "control_request_id", payload.control_request_id ?? payload.request_id]],
    ["threadId", ["thread_id", payload.thread_id]],
    ["thread_id", ["thread_id", payload.thread_id]],
    ["turnId", ["turn_id", payload.turn_id]],
    ["turn_id", ["turn_id", payload.turn_id]],
  ]);
  const inspect = (value, path) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((entry, index) => inspect(entry, `${path}[${index}]`));
      return;
    }
    for (const [key, entry] of Object.entries(value)) {
      const binding = fields.get(key) ?? null;
      if (binding) {
        const [owner, expected] = binding;
        if ((entry !== null && typeof entry !== "string") || entry !== expected) {
          relationshipError(`runtime_event body ${path}.${key} substitutes the outer ${owner} owner.`);
        }
      }
      inspect(entry, `${path}.${key}`);
    }
  };
  inspect(body, "event");
}

function assertNamedEntries(value, label, keys) {
  assertArray(value, label);
  const names = [];
  for (const [index, entry] of value.entries()) {
    const entryLabel = `${label}[${index}]`;
    assertRecord(entry, entryLabel);
    assertExactKeys(entry, keys, entryLabel);
    assertIdentity(entry.name, `${entryLabel}.name`);
    if (Object.hasOwn(entry, "description")) assertTrimmedString(entry.description, `${entryLabel}.description`);
    names.push(entry.name);
  }
  assertSortedUniqueStrings(names, `${label} names`);
}

function assertResourceEntries(value, label) {
  assertArray(value, label);
  const paths = [];
  for (const [index, entry] of value.entries()) {
    const entryLabel = `${label}[${index}]`;
    assertRecord(entry, entryLabel);
    assertExactKeys(entry, ["path", "sha256"], entryLabel);
    assertNormalizedPath(entry.path, `${entryLabel}.path`);
    assertHash(entry.sha256, `${entryLabel}.sha256`);
    paths.push(entry.path);
  }
  assertSortedUniqueStrings(paths, `${label} paths`);
}

function assertExactPartition(scope, groups, label) {
  assertDisjoint(groups, label);
  const union = groups.flat().sort(compareStrings);
  assertSameSet(union, scope, label);
}

function assertDisjoint(groups, label) {
  const seen = new Set();
  for (const value of groups.flat()) {
    if (seen.has(value)) relationshipError(`${label} contains duplicate membership '${value}'.`);
    seen.add(value);
  }
}

function assertSummaryOperationAttempts(operation, attempts, role) {
  const roleAttempts = attempts.filter((attempt) => attempt.payload.role === role);
  const attemptIds = roleAttempts.map((attempt) => attempt.payload.attempt_id);
  assertUniqueIdentities(attemptIds, `${role} summary attempt links`);
  assertSameSet(
    [...operation.attempts.initial_attempt_ids, ...operation.attempts.retry_attempt_ids],
    attemptIds,
    `${role} summary attempt partition`,
  );
  assertSameSet(
    operation.attempts.initial_attempt_ids,
    roleAttempts.filter((attempt) => attempt.payload.sequence === 1).map((attempt) => attempt.payload.attempt_id),
    `${role} summary initial attempts`,
  );
  assertSameSet(
    operation.attempts.retry_attempt_ids,
    roleAttempts.filter((attempt) => attempt.payload.sequence > 1).map((attempt) => attempt.payload.attempt_id),
    `${role} summary retry attempts`,
  );
  assertSameSet(
    operation.attempts.nonterminal_attempt_ids,
    roleAttempts.filter((attempt) => attempt.payload.phase !== "terminal").map((attempt) => attempt.payload.attempt_id),
    `${role} summary nonterminal attempts`,
  );
  for (const outcome of ["cancelled", "error", "outcome_unknown", "success", "timeout"]) {
    assertSameSet(
      operation.attempts.terminal[outcome],
      roleAttempts
        .filter((attempt) => attempt.payload.phase === "terminal" && attempt.payload.outcome === outcome)
        .map((attempt) => attempt.payload.attempt_id),
      `${role} summary ${outcome} attempts`,
    );
  }
  assertSameSet(
    operation.newly_executed_unit_ids,
    [...new Set(roleAttempts.map((attempt) => attempt.payload.unit_id))],
    `${role} summary newly executed units`,
  );
}

function assertSameSet(actual, expected, label) {
  const left = [...actual].sort(compareStrings);
  const right = [...expected].sort(compareStrings);
  if (left.length !== right.length || left.some((value, index) => value !== right[index])) {
    relationshipError(`${label} does not match its declared scope.`);
  }
}

function assertSubset(values, scope, label) {
  const scopeSet = new Set(scope);
  if (values.some((value) => !scopeSet.has(value))) relationshipError(`${label} is not contained in selected scope.`);
}

function assertCount(value, members, label) {
  assertNonNegativeInteger(value, label);
  if (value !== members.length) relationshipError(`${label} does not match exact membership count.`);
}

function assertExactKeys(value, keys, label) {
  const expected = [...keys].sort(compareStrings);
  const actual = Object.keys(value).sort(compareStrings);
  if (expected.length !== actual.length || expected.some((key, index) => key !== actual[index])) {
    schemaError(`${label} fields must be exactly: ${expected.join(", ")}.`);
  }
}

function assertRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) schemaError(`${label} must be a JSON object.`);
}

function assertArray(value, label) {
  if (!Array.isArray(value)) schemaError(`${label} must be an array.`);
}

function assertString(value, label) {
  if (typeof value !== "string") schemaError(`${label} must be a string.`);
}

function assertBoundedText(value, label) {
  assertTrimmedString(value, label);
  if (value.length > 2_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    schemaError(`${label} must be bounded text without unsafe control characters.`);
  }
}

function assertTrimmedString(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    schemaError(`${label} must be a non-empty trimmed string.`);
  }
}

function assertNullableString(value, label) {
  if (value !== null) assertTrimmedString(value, label);
}

function assertStringArray(value, label) {
  assertArray(value, label);
  for (const [index, entry] of value.entries()) assertString(entry, `${label}[${index}]`);
}

function assertIdentity(value, label) {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    schemaError(`${label} must be kebab-case.`);
  }
}

function assertRuntimeIdentity(value, label) {
  if (typeof value !== "string" || !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(value)) {
    schemaError(`${label} must be a normalized runtime identity.`);
  }
}

function assertRelationship(value, label) {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(value)) {
    schemaError(`${label} must be snake_case.`);
  }
}

function assertNullableIdentity(value, label) {
  if (value !== null) assertIdentity(value, label);
}

function assertHash(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) schemaError(`${label} must be a lowercase SHA-256 hash.`);
}

function assertNullableHash(value, label) {
  if (value !== null) assertHash(value, label);
}

function assertEnum(value, allowed, label) {
  if (!allowed.includes(value)) schemaError(`${label} must be one of: ${allowed.join(", ")}.`);
}

function assertNullableEnum(value, allowed, label) {
  if (value !== null) assertEnum(value, allowed, label);
}

function assertLiteral(value, expected, label) {
  if (value !== expected) schemaError(`${label} must be '${expected}'.`);
}

function assertTimestamp(value, label) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || Number.isNaN(Date.parse(value))) {
    schemaError(`${label} must be an ISO-8601 UTC timestamp.`);
  }
}

function assertNullableTimestamp(value, label) {
  if (value !== null) assertTimestamp(value, label);
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) schemaError(`${label} must be a non-negative integer.`);
}

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) schemaError(`${label} must be a positive integer.`);
}

function assertSortedUniqueIdentities(value, label) {
  assertArray(value, label);
  for (const [index, entry] of value.entries()) assertIdentity(entry, `${label}[${index}]`);
  assertSortedUniqueStrings(value, label);
}

function assertUniqueIdentities(value, label) {
  assertArray(value, label);
  for (const [index, entry] of value.entries()) assertIdentity(entry, `${label}[${index}]`);
  if (new Set(value).size !== value.length) relationshipError(`${label} must be duplicate-free.`);
}

function assertSortedUniqueHashes(value, label) {
  assertArray(value, label);
  for (const [index, entry] of value.entries()) assertHash(entry, `${label}[${index}]`);
  assertSortedUniqueStrings(value, label);
}

function assertSortedUniquePaths(value, label) {
  assertArray(value, label);
  for (const [index, entry] of value.entries()) assertNormalizedPath(entry, `${label}[${index}]`);
  assertSortedUniqueStrings(value, label);
}

function assertSortedUniqueStrings(value, label) {
  for (let index = 1; index < value.length; index += 1) {
    if (compareStrings(value[index - 1], value[index]) >= 0) {
      relationshipError(`${label} must be duplicate-free and lexicographically sorted.`);
    }
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
    schemaError(`${label} must be a normalized contained relative path.`);
  }
}

function assertRuntimePath(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value) ||
    value.includes("//") ||
    value.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    schemaError(`${label} must be a normalized forward-slash runtime path.`);
  }
}

function assertJsonValue(value, label) {
  if (value === undefined || typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    schemaError(`${label} must be JSON-compatible.`);
  }
  if (typeof value === "number" && !Number.isFinite(value)) schemaError(`${label} must contain finite numbers.`);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertJsonValue(entry, `${label}[${index}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) assertJsonValue(entry, `${label}.${key}`);
  }
}

function artifactKey(type, id) {
  return `${type}:${id}`;
}

function schemaError(message) {
  throw new HarnessError("ARTIFACT_SCHEMA_INVALID", message);
}

function relationshipError(message) {
  throw new HarnessError("ARTIFACT_RELATIONSHIP_INVALID", message);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
