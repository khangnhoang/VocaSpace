import { canonicalJson, parseStrictJson, sha256Canonical } from "./artifact-schema-v1.mjs";

export const harnessSchemaVersion = 2;
export const harnessArtifactTypes = Object.freeze([
  "task_manifest",
  "run_manifest",
  "compiled_invocation",
  "readiness_analysis",
  "execution_attempt",
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
  readiness_analysis: ["readiness"],
  execution_attempt: ["orchestrator"],
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
  readiness_analysis: {
    run: [1, 1, "run_manifest"],
    compiled_invocation: [1, Number.POSITIVE_INFINITY, "compiled_invocation"],
    helper_attempt: [0, 2, "execution_attempt"],
  },
  execution_attempt: {
    run: [1, 1, "run_manifest"],
    compiled_invocation: [1, 1, "compiled_invocation"],
    readiness: [0, 1, "readiness_analysis"],
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
  return artifacts;
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
      } else {
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
      }
      const helperAttempts = many("helper_attempt");
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
        if (readiness) relationshipError("A readiness helper attempt cannot depend on the analysis it helps produce.");
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
  readiness_analysis: validateReadinessAnalysis,
  execution_attempt: validateExecutionAttempt,
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
  assertEnum(value.lifecycle, ["active", "closed", "abandoned"], "lifecycle");
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
  assertExactKeys(
    value,
    [
      "adapter_id",
      "created_at",
      "revision",
      "run_id",
      "runtime_config_sha256",
      "selected_units",
      "state",
      "task_id",
    ],
    "run_manifest payload",
  );
  assertIdentity(value.run_id, "run_id");
  assertIdentity(value.task_id, "task_id");
  assertNonNegativeInteger(value.revision, "revision");
  assertEnum(value.state, runStates, "state");
  assertIdentity(value.adapter_id, "adapter_id");
  assertHash(value.runtime_config_sha256, "runtime_config_sha256");
  assertTimestamp(value.created_at, "created_at");
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
  assertEnum(value.stage, ["reader", "evaluator_static"], "readiness_analysis.stage");
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
  if (value.phase === "terminal" && !["confirmed_finished", "unknown"].includes(value.call_certainty)) {
    relationshipError("A terminal attempt requires confirmed_finished or unknown call certainty.");
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
  if (value.role === "verification_helper" && value.unit_id !== null) {
    relationshipError("verification_helper attempts must not claim a case unit_id.");
  }
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
  assertExactKeys(value, ["accepted_unit_ids", "run_id", "status", "summary_sha256"], "generated_report payload");
  assertIdentity(value.run_id, "generated_report.run_id");
  assertEnum(value.status, ["complete", "incomplete", "review_pending", "rejected", "rerun_required"], "generated_report.status");
  assertSortedUniqueIdentities(value.accepted_unit_ids, "generated_report.accepted_unit_ids");
  assertHash(value.summary_sha256, "generated_report.summary_sha256");
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

function assertRuntime(value, label) {
  assertRecord(value, label);
  assertExactKeys(value, ["model", "parameters", "provider", "runtime_class"], label);
  assertTrimmedString(value.provider, `${label}.provider`);
  assertTrimmedString(value.model, `${label}.model`);
  assertIdentity(value.runtime_class, `${label}.runtime_class`);
  assertRecord(value.parameters, `${label}.parameters`);
  assertJsonValue(value.parameters, `${label}.parameters`);
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
