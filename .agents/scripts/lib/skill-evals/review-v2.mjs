import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { canonicalJson, parseStrictJson, sha256Bytes, sha256Canonical } from "./artifact-schema-v1.mjs";
import {
  HarnessError,
  assertHarnessArtifact,
  createHarnessArtifact,
  deriveAcceptanceInputProjection,
  validateArtifactGraph,
} from "./harness-schema-v2.mjs";
import {
  deriveAcceptanceInputIdentity,
  deriveEvaluatorInputIdentity,
  deriveEvaluatorVisibleEvidence,
} from "./logical-identity-v2.mjs";
import { compileInvocation } from "./readiness-v2.mjs";
import {
  appendAttemptPhase,
  inspectRunState,
  listStoredArtifacts,
  loadRunManifest,
  readRuntimeSnapshot,
  recordRuntimeResultView,
  transitionRun,
  writeArtifactObject,
} from "./run-store-v2.mjs";

const rendererVersion = "review-renderer-v2";
const securityPolicyVersion = "review-security-v1";

export function finalizeEvaluatorStage({
  comparisonMapping,
  protocol,
  requestedPolicy,
  rubric,
  run,
  runtime,
  staticReadiness,
  supportingArtifacts = [],
  task,
  tools = [],
  units,
}) {
  assertHarnessArtifact(run, { artifactType: "run_manifest" });
  assertHarnessArtifact(task, { artifactType: "task_manifest" });
  assertHarnessArtifact(staticReadiness, { artifactType: "readiness_analysis" });
  const evidenceByBinding = new Map();
  for (const artifact of supportingArtifacts) {
    assertHarnessArtifact(artifact);
    evidenceByBinding.set(`${artifact.artifact_id}:${artifact.content_sha256}`, artifact);
  }
  if (staticReadiness.payload.stage !== "evaluator_static" || staticReadiness.payload.status !== "passed") {
    fail("EVALUATOR_STAGE_NOT_READY", "Evaluator static readiness must pass before stage finalization.", 4);
  }
  if (staticReadiness.payload.run_id !== run.artifact_id || !hasExactLink(staticReadiness, "run", run)) {
    fail("EVALUATOR_STAGE_STALE", "Evaluator static readiness is detached from the exact run.", 4);
  }
  const staticInvocation = resolveLinkedArtifact(
    staticReadiness,
    "compiled_invocation",
    "compiled_invocation",
    evidenceByBinding,
  );
  const staticPlan = parseEvaluatorStaticPlan(staticInvocation);
  if (sha256Canonical(runtime) !== runtimeHashForReadiness(staticReadiness, run)) {
    fail("EVALUATOR_STAGE_STALE", "Evaluator runtime does not match the passed static readiness.", 4);
  }
  if (
    staticPlan.comparison_mapping_sha256 !== sha256Canonical(comparisonMapping) ||
    staticPlan.protocol_sha256 !== sha256Canonical(protocol) ||
    staticPlan.rubric_sha256 !== sha256Canonical(rubric) ||
    staticPlan.runtime_config_sha256 !== sha256Canonical(runtime) ||
    canonicalJson(staticInvocation.payload.requested_policy) !== canonicalJson(requestedPolicy) ||
    canonicalJson(staticInvocation.payload.tools) !== canonicalJson(tools)
  ) {
    fail("EVALUATOR_STAGE_STALE", "Evaluator stage inputs do not match the pre-reader static plan.", 4);
  }
  if (!Array.isArray(units) || units.length === 0) fail("EVALUATOR_STAGE_INVALID", "Evaluator units must not be empty.");
  const selectedEvaluators = new Set(run.payload.selected_units.filter((unit) => unit.role === "evaluator").map((unit) => unit.unit_id));
  const selectedReaders = new Set(run.payload.selected_units.filter((unit) => unit.role === "reader").map((unit) => unit.unit_id));
  const plannedEvaluatorIds = units.map((unit) => unit.evaluator_unit_id).sort(compareStrings);
  const plannedReaderIds = units.map((unit) => unit.reader_unit_id).sort(compareStrings);
  if (
    new Set(plannedEvaluatorIds).size !== plannedEvaluatorIds.length ||
    canonicalJson(plannedEvaluatorIds) !== canonicalJson([...selectedEvaluators].sort(compareStrings)) ||
    new Set(plannedReaderIds).size !== plannedReaderIds.length ||
    canonicalJson(plannedReaderIds) !== canonicalJson([...selectedReaders].sort(compareStrings))
  ) {
    fail("EVALUATOR_STAGE_INVALID", "Evaluator finalization requires one exact mapping for every selected unit.", 4);
  }
  const entries = units.map((unit) => {
    if (!selectedEvaluators.has(unit.evaluator_unit_id) || !selectedReaders.has(unit.reader_unit_id)) {
      fail("EVALUATOR_STAGE_INVALID", "Evaluator/reader unit mapping escapes selected scope.");
    }
    assertHarnessArtifact(unit.observation, { artifactType: "observation" });
    if (unit.observation.payload.run_id !== run.artifact_id || unit.observation.payload.unit_id !== unit.reader_unit_id) {
      fail("EVALUATOR_EVIDENCE_INVALID", "Evaluator evidence has stale run or unit lineage.");
    }
    const resources = unit.resource_observations ?? [];
    if (!Array.isArray(resources) || resources.length > 1) {
      fail("EVALUATOR_EVIDENCE_INVALID", "The v2 evaluator projection accepts at most one canonical resource observation per unit.");
    }
    const readerAttempt = resolveLinkedArtifact(unit.observation, "attempt", "execution_attempt", evidenceByBinding);
    const readerInvocation = resolveLinkedArtifact(
      unit.observation,
      "compiled_invocation",
      "compiled_invocation",
      evidenceByBinding,
    );
    assertExactReaderEvidenceLineage({
      observation: unit.observation,
      readerAttempt,
      readerInvocation,
      resources,
      run,
      unitId: unit.reader_unit_id,
    });
    const visible = deriveEvaluatorVisibleEvidence({
      observation: unit.observation,
      resourceObservation: resources[0] ?? null,
    });
    const invocation = compileInvocation({
      artifactId: `evaluator-invocation-${unit.evaluator_unit_id}`,
      messages: [
        {
          content: `EVALUATOR_INPUT_V2\n${canonicalJson({ comparison_mapping: comparisonMapping, evidence: visible.projection, rubric }).trimEnd()}`,
          role: "user",
        },
      ],
      protocol,
      requestedPolicy,
      resources: [],
      role: "evaluator",
      run,
      runtime,
      tools,
      unitId: unit.evaluator_unit_id,
    });
    const identity = deriveEvaluatorInputIdentity({
      comparison_mapping: comparisonMapping,
      compiled_invocation: invocation,
      evidence: [{ observation: unit.observation, resource_observation: resources[0] ?? null }],
      protocol_version: protocol.output_schema,
      rubric,
    });
    return {
      ...unit,
      evaluator_input_id: identity.evaluator_input_id,
      invocation,
      reader_attempt: readerAttempt,
      reader_invocation: readerInvocation,
      resources,
    };
  });
  const evaluatorIds = entries.map((entry) => entry.evaluator_unit_id).sort(compareStrings);
  if (new Set(evaluatorIds).size !== evaluatorIds.length) fail("EVALUATOR_STAGE_INVALID", "Evaluator units must be unique.");
  if (canonicalJson(evaluatorIds) !== canonicalJson([...selectedEvaluators].sort(compareStrings))) {
    fail("EVALUATOR_STAGE_INVALID", "Evaluator finalization requires the complete selected evaluator set.", 4);
  }
  const invocations = entries.map((entry) => entry.invocation).sort(compareArtifacts);
  const readiness = createHarnessArtifact({
    artifactType: "readiness_analysis",
    artifactId: `${run.artifact_id}-evaluator-stage`,
    producer: producer("readiness"),
    links: [link("run", run), ...invocations.map((invocation) => link("compiled_invocation", invocation))].sort(compareLinks),
    payload: {
      correction: staticReadiness.payload.correction,
      field_results: [fieldResult("evaluator-evidence-set"), fieldResult("evaluator-runtime-config")],
      grants: invocations.map((invocation) => ({
        invocation_sha256: invocation.content_sha256,
        nonce: `eval-${invocation.content_sha256.slice(0, 24)}`,
        single_use: true,
        unit_id: invocation.payload.unit_id,
      })),
      helper_attempt_ids: [],
      invocation_hashes: invocations.map((invocation) => invocation.content_sha256).sort(compareStrings),
      round: staticReadiness.payload.round,
      run_id: run.artifact_id,
      stage: "evaluator",
      status: "passed",
    },
  });
  validateArtifactGraph([task, run, ...invocations, readiness]);
  return { entries, invocations, readiness, task };
}

export async function runSequentialEvaluatorStage({
  adapter,
  invalidatedUnitIds = [],
  leaseToken,
  liveDispatchGrant = null,
  now = () => new Date().toISOString(),
  run,
  stage,
  storeRoot,
}) {
  if (
    !["deterministic_fixture", "codex_chatgpt_app_server"].includes(adapter?.kind) ||
    typeof adapter.invokeEvaluator !== "function" ||
    (adapter.kind === "codex_chatgpt_app_server" && typeof adapter.validateReuse !== "function")
  ) {
    fail("ADAPTER_NOT_CERTIFIED", "Evaluator execution requires a deterministic fixture or CP8A-certified App Server adapter.", 4);
  }
  assertHarnessArtifact(run, { artifactType: "run_manifest" });
  assertHarnessArtifact(stage?.readiness, { artifactType: "readiness_analysis" });
  if (
    stage.readiness.payload.stage !== "evaluator" ||
    stage.readiness.payload.status !== "passed" ||
    stage.readiness.payload.run_id !== run.artifact_id
  ) {
    fail("EVALUATOR_STAGE_INVALID", "Evaluator execution requires the exact passed finalized stage.", 4);
  }
  const selectedEvaluatorIds = run.payload.selected_units
    .filter((unit) => unit.role === "evaluator")
    .map((unit) => unit.unit_id)
    .sort(compareStrings);
  const entries = [...(stage.entries ?? [])].sort((left, right) =>
    compareStrings(left.evaluator_unit_id, right.evaluator_unit_id),
  );
  if (canonicalJson(entries.map((entry) => entry.evaluator_unit_id)) !== canonicalJson(selectedEvaluatorIds)) {
    fail("EVALUATOR_STAGE_INVALID", "Evaluator execution requires the complete selected unit set.", 4);
  }
  const grants = new Map(stage.readiness.payload.grants.map((grant) => [grant.unit_id, grant]));
  if (grants.size !== entries.length) fail("EVALUATOR_STAGE_INVALID", "Evaluator stage grant set is incomplete.");
  for (const entry of entries) assertEvaluatorEntryAuthority(entry, stage.readiness, run);
  const invalidated = new Set(invalidatedUnitIds);
  let manifest = loadRunManifest(storeRoot, run.artifact_id);
  if (["reader_complete", "blocked"].includes(manifest.payload.state)) {
    manifest = transitionRun(storeRoot, {
      expectedRevision: manifest.payload.revision,
      leaseToken,
      nextState: "evaluating",
      now: now(),
      runId: run.artifact_id,
    });
  }
  if (!["evaluating", "review_pending"].includes(manifest.payload.state)) {
    fail("RUN_STATE_INVALID", "Evaluator stage requires reader_complete, evaluating, blocked, or review_pending state.");
  }
  const result = {
    calls: 0,
    failed_unit_ids: [],
    invalidated_unit_ids: [...invalidated].filter((unitId) => selectedEvaluatorIds.includes(unitId)).sort(compareStrings),
    newly_executed_unit_ids: [],
    proposals: [],
    resumed_unit_ids: [],
    reused_unit_ids: [],
    run_state: manifest.payload.state,
    uncertain_unit_ids: [],
  };
  for (const entry of entries) {
    const durable = resolveDurableEvaluatorUnit(storeRoot, run.artifact_id, entry);
    if (!invalidated.has(entry.evaluator_unit_id) && durable.status === "reusable") {
      let reuse = { classification: "unaffected" };
      if (isConcreteRuntimeAdapter(adapter)) {
        reuse = await adapter.validateReuse({
          attempt: durable.attempt,
          evidence: [durable.proposal],
          invocation: entry.invocation,
          readiness: stage.readiness,
          run,
          storeRoot,
        });
      }
      if (reuse.classification === "unaffected") {
        result.newly_executed_unit_ids.push(entry.evaluator_unit_id);
        result.resumed_unit_ids.push(entry.evaluator_unit_id);
        result.proposals.push(durable.proposal);
        continue;
      }
      if (reuse.classification !== "evaluator_affected") {
        fail("APP_SERVER_REUSE_INVALID", "Concrete evaluator reuse returned an unsafe impact classification.", 4);
      }
      invalidated.add(entry.evaluator_unit_id);
      result.invalidated_unit_ids.push(entry.evaluator_unit_id);
    }
    if (["outcome_unknown", "blocked_evidence"].includes(durable.status)) {
      result.newly_executed_unit_ids.push(entry.evaluator_unit_id);
      if (durable.status === "outcome_unknown") result.uncertain_unit_ids.push(entry.evaluator_unit_id);
      else result.failed_unit_ids.push(entry.evaluator_unit_id);
      continue;
    }
    if (manifest.payload.state === "review_pending") {
      fail("RUN_STATE_INVALID", "A review-pending run cannot dispatch changed or invalidated evaluator work.", 4);
    }
    const grant = grants.get(entry.evaluator_unit_id);
    assertEvaluatorGrant(grant, entry, stage.readiness);
    const sequence = durable.nextSequence;
    const attemptId = durable.prepared?.payload.attempt_id ?? `evaluator-${entry.evaluator_unit_id}-attempt-${sequence}`;
    const startedAt = durable.prepared?.payload.started_at ?? now();
    const common = {
      attempt_id: attemptId,
      input_sha256: entry.invocation.content_sha256,
      role: "evaluator",
      run_id: run.artifact_id,
      sequence,
      started_at: startedAt,
      unit_id: entry.evaluator_unit_id,
    };
    const links = [link("compiled_invocation", entry.invocation), link("readiness", stage.readiness), link("run", run)].sort(compareLinks);
    let prepared = durable.prepared;
    if (durable.prepared) {
      if (
        !hasExactLink(durable.prepared, "compiled_invocation", entry.invocation) ||
        !hasExactLink(durable.prepared, "readiness", stage.readiness)
      ) {
        fail("ATTEMPT_RESUME_INVALID", "Prepared evaluator attempt does not match current stage authority.", 4);
      }
    } else {
      prepared = attempt(`${attemptId}-prepared`, links, common, "prepared", "not_started", null, null);
      appendAttemptPhase(storeRoot, prepared, { leaseToken, now: startedAt });
    }
    assertEvaluatorGrant(grant, entry, stage.readiness);
    let dispatched = null;
    const markDispatched = () => {
      if (dispatched) return dispatched;
      dispatched = attempt(
        `${attemptId}-dispatched`,
        links,
        common,
        "dispatched",
        isConcreteRuntimeAdapter(adapter) ? "unknown" : "started",
        null,
        null,
      );
      appendAttemptPhase(storeRoot, dispatched, { leaseToken, now: startedAt });
      result.calls += 1;
      return dispatched;
    };
    if (!isConcreteRuntimeAdapter(adapter)) markDispatched();
    let adapterResult;
    try {
      adapterResult = await adapter.invokeEvaluator(
        isConcreteRuntimeAdapter(adapter)
          ? {
              grant_nonce: grant.nonce,
              invocation_sha256: entry.invocation.content_sha256,
              unit_id: entry.evaluator_unit_id,
            }
          : structuredClone(entry.invocation.payload),
        {
          evaluator_input_id: entry.evaluator_input_id,
          reader_unit_id: entry.reader_unit_id,
          runtime: isConcreteRuntimeAdapter(adapter)
            ? {
                attempt: prepared,
                graphArtifacts: uniqueArtifacts([stage.task, run, ...stage.invocations, stage.readiness]),
                invocation: entry.invocation,
                leaseToken,
                liveDispatchGrant,
                markDispatched,
                readiness: stage.readiness,
                run,
                storeRoot,
              }
            : undefined,
        },
      );
    } catch (error) {
      const uncertain = error?.callCertainty === "unknown";
      const confirmedNotStarted = error?.callCertainty === "confirmed_not_started";
      if (!dispatched && !confirmedNotStarted) {
        fail("ADAPTER_LIFECYCLE_INVALID", "Evaluator adapter failed without dispatch or confirmed-not-started evidence.", 4);
      }
      const terminal = attempt(
        `${attemptId}-terminal`,
        links,
        common,
        "terminal",
        uncertain ? "unknown" : confirmedNotStarted ? "confirmed_not_started" : "confirmed_finished",
        uncertain ? "outcome_unknown" : "error",
        now(),
      );
      appendAttemptPhase(storeRoot, terminal, { leaseToken, now: terminal.payload.finished_at });
      result.newly_executed_unit_ids.push(entry.evaluator_unit_id);
      if (uncertain) result.uncertain_unit_ids.push(entry.evaluator_unit_id);
      else result.failed_unit_ids.push(entry.evaluator_unit_id);
      if (isConcreteRuntimeAdapter(adapter) && hasRuntimeSnapshot(storeRoot, run.artifact_id, attemptId)) {
        recordRuntimeResultView(storeRoot, {
          attemptId,
          leaseToken,
          now: terminal.payload.finished_at,
          runId: run.artifact_id,
          status: uncertain ? "outcome_unknown" : "error",
        });
      }
      continue;
    }
    if (!dispatched) fail("ADAPTER_LIFECYCLE_INVALID", "Successful evaluator result lacks a dispatched attempt.", 4);
    const terminal = attempt(`${attemptId}-terminal`, links, common, "terminal", "confirmed_finished", "success", now());
    let proposal;
    try {
      proposal = createHarnessArtifact({
        artifactType: "evaluator_proposal",
        artifactId: `proposal-${entry.reader_unit_id}`,
        producer: producer("evaluator"),
        links: [
          link("attempt", terminal),
          link("observation", entry.observation),
          ...entry.resources.map((resource) => link("resource_observation", resource)),
        ].sort(compareLinks),
        payload: { ...structuredClone(adapterResult), unit_id: entry.reader_unit_id },
      });
    } catch {
      const invalid = attempt(`${attemptId}-terminal`, links, common, "terminal", "confirmed_finished", "error", now());
      appendAttemptPhase(storeRoot, invalid, { leaseToken, now: invalid.payload.finished_at });
      result.newly_executed_unit_ids.push(entry.evaluator_unit_id);
      result.failed_unit_ids.push(entry.evaluator_unit_id);
      if (isConcreteRuntimeAdapter(adapter)) {
        recordRuntimeResultView(storeRoot, {
          attemptId,
          leaseToken,
          now: invalid.payload.finished_at,
          runId: run.artifact_id,
          status: "error",
        });
      }
      continue;
    }
    appendAttemptPhase(storeRoot, terminal, { leaseToken, now: terminal.payload.finished_at });
    writeArtifactObject(storeRoot, proposal);
    if (isConcreteRuntimeAdapter(adapter)) {
      recordRuntimeResultView(storeRoot, {
        attemptId,
        evidence: [proposal],
        leaseToken,
        now: terminal.payload.finished_at,
        runId: run.artifact_id,
        status: "success",
      });
    }
    result.newly_executed_unit_ids.push(entry.evaluator_unit_id);
    result.proposals.push(proposal);
  }
  for (const field of [
    "failed_unit_ids",
    "newly_executed_unit_ids",
    "resumed_unit_ids",
    "reused_unit_ids",
    "uncertain_unit_ids",
  ]) {
    result[field] = [...new Set(result[field])].sort(compareStrings);
  }
  result.proposals.sort(compareArtifacts);
  if (result.proposals.length !== entries.length && (result.failed_unit_ids.length > 0 || result.uncertain_unit_ids.length > 0)) {
    if (loadRunManifest(storeRoot, run.artifact_id).payload.state !== "blocked") {
      manifest = transitionRun(storeRoot, {
        expectedRevision: loadRunManifest(storeRoot, run.artifact_id).payload.revision,
        leaseToken,
        nextState: "blocked",
        now: now(),
        runId: run.artifact_id,
      });
    }
  }
  result.run_state = manifest.payload.state;
  return result;
}

function parseEvaluatorStaticPlan(invocation) {
  const messages = invocation.payload.messages.filter(
    (message) => message.role === "developer" && message.content.startsWith("EVALUATOR_STATIC_PLAN_V2\n"),
  );
  if (messages.length !== 1) fail("EVALUATOR_STAGE_STALE", "Evaluator static plan is missing or ambiguous.", 4);
  let value;
  try {
    value = JSON.parse(messages[0].content.slice("EVALUATOR_STATIC_PLAN_V2\n".length));
  } catch {
    fail("EVALUATOR_STAGE_STALE", "Evaluator static plan is not valid JSON.", 4);
  }
  const keys = [
    "comparison_mapping_sha256",
    "protocol_sha256",
    "rubric_sha256",
    "runtime_config_sha256",
  ];
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    canonicalJson(Object.keys(value).sort(compareStrings)) !== canonicalJson(keys) ||
    keys.some((key) => typeof value[key] !== "string" || !/^[a-f0-9]{64}$/.test(value[key]))
  ) {
    fail("EVALUATOR_STAGE_STALE", "Evaluator static plan fields are invalid.", 4);
  }
  return value;
}

function resolveLinkedArtifact(source, relationship, artifactType, artifactsByBinding) {
  const linkValue = source.links.find((candidate) => candidate.relationship === relationship);
  const target = linkValue
    ? artifactsByBinding.get(`${linkValue.target_artifact_id}:${linkValue.target_content_sha256}`)
    : null;
  if (!target || target.artifact_type !== artifactType) {
    fail("EVALUATOR_EVIDENCE_INVALID", `Evaluator evidence cannot resolve its exact ${relationship} lineage.`, 4);
  }
  return target;
}

function assertExactReaderEvidenceLineage({ observation, readerAttempt, readerInvocation, resources, run, unitId }) {
  assertHarnessArtifact(readerAttempt, { artifactType: "execution_attempt" });
  assertHarnessArtifact(readerInvocation, { artifactType: "compiled_invocation" });
  if (
    readerAttempt.payload.phase !== "terminal" ||
    readerAttempt.payload.outcome !== "success" ||
    readerAttempt.payload.call_certainty !== "confirmed_finished" ||
    readerAttempt.payload.role !== "reader" ||
    readerAttempt.payload.run_id !== run.artifact_id ||
    readerAttempt.payload.unit_id !== unitId ||
    readerAttempt.payload.input_sha256 !== readerInvocation.content_sha256 ||
    readerInvocation.payload.role !== "reader" ||
    readerInvocation.payload.run_id !== run.artifact_id ||
    readerInvocation.payload.unit_id !== unitId ||
    !hasExactLink(readerAttempt, "compiled_invocation", readerInvocation) ||
    !hasExactLink(readerAttempt, "run", run) ||
    !hasExactLink(observation, "attempt", readerAttempt) ||
    !hasExactLink(observation, "compiled_invocation", readerInvocation)
  ) {
    fail("EVALUATOR_EVIDENCE_INVALID", "Evaluator evidence is not bound to an exact successful reader execution.", 4);
  }
  for (const resource of resources) {
    assertHarnessArtifact(resource, { artifactType: "resource_observation" });
    if (!hasExactLink(resource, "observation", observation)) {
      fail("EVALUATOR_EVIDENCE_INVALID", "Evaluator resource does not descend from its exact observation.", 4);
    }
  }
}

function assertEvaluatorEntryAuthority(entry, readiness, run) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    fail("EVALUATOR_STAGE_INVALID", "Evaluator stage entry is invalid.", 4);
  }
  assertHarnessArtifact(entry.invocation, { artifactType: "compiled_invocation" });
  assertHarnessArtifact(entry.observation, { artifactType: "observation" });
  if (
    entry.invocation.payload.role !== "evaluator" ||
    entry.invocation.payload.run_id !== run.artifact_id ||
    entry.invocation.payload.unit_id !== entry.evaluator_unit_id ||
    entry.observation.payload.run_id !== run.artifact_id ||
    entry.observation.payload.unit_id !== entry.reader_unit_id ||
    !Array.isArray(entry.resources) ||
    entry.resources.length > 1
  ) {
    fail("EVALUATOR_STAGE_INVALID", "Evaluator stage entry escapes its exact run/unit authority.", 4);
  }
  assertExactReaderEvidenceLineage({
    observation: entry.observation,
    readerAttempt: entry.reader_attempt,
    readerInvocation: entry.reader_invocation,
    resources: entry.resources,
    run,
    unitId: entry.reader_unit_id,
  });
  const messages = entry.invocation.payload.messages.filter(
    (message) => message.role === "user" && message.content.startsWith("EVALUATOR_INPUT_V2\n"),
  );
  if (messages.length !== 1) fail("EVALUATOR_STAGE_INVALID", "Evaluator invocation has no unique canonical input.", 4);
  let canonicalInput;
  try {
    canonicalInput = JSON.parse(messages[0].content.slice("EVALUATOR_INPUT_V2\n".length));
  } catch {
    fail("EVALUATOR_STAGE_INVALID", "Evaluator canonical input is not valid JSON.", 4);
  }
  if (
    !canonicalInput ||
    typeof canonicalInput !== "object" ||
    Array.isArray(canonicalInput) ||
    canonicalJson(Object.keys(canonicalInput).sort(compareStrings)) !==
      canonicalJson(["comparison_mapping", "evidence", "rubric"])
  ) {
    fail("EVALUATOR_STAGE_INVALID", "Evaluator canonical input fields are invalid.", 4);
  }
  const visible = deriveEvaluatorVisibleEvidence({
    observation: entry.observation,
    resourceObservation: entry.resources[0] ?? null,
  });
  if (canonicalJson(canonicalInput.evidence) !== canonicalJson(visible.projection)) {
    fail("EVALUATOR_EVIDENCE_INVALID", "Evaluator invocation and exact evidence projection diverged.", 4);
  }
  const identity = deriveEvaluatorInputIdentity({
    comparison_mapping: canonicalInput.comparison_mapping,
    compiled_invocation: entry.invocation,
    evidence: [{ observation: entry.observation, resource_observation: entry.resources[0] ?? null }],
    protocol_version: entry.invocation.payload.protocol.output_schema,
    rubric: canonicalInput.rubric,
  });
  if (identity.evaluator_input_id !== entry.evaluator_input_id) {
    fail("EVALUATOR_EVIDENCE_INVALID", "Evaluator input identity does not match its exact invocation/evidence graph.", 4);
  }
  assertEvaluatorGrant(readiness.payload.grants.find((grant) => grant.unit_id === entry.evaluator_unit_id), entry, readiness);
}

function assertEvaluatorGrant(grant, entry, readiness) {
  if (
    !grant ||
    grant.single_use !== true ||
    grant.invocation_sha256 !== entry.invocation.content_sha256 ||
    !hasExactLink(readiness, "compiled_invocation", entry.invocation)
  ) {
    fail("EVALUATOR_GRANT_INVALID", "Evaluator grant is missing, stale, or detached from its invocation.", 4);
  }
}

function resolveDurableEvaluatorUnit(root, runId, entry) {
  const attempts = inspectRunState(root, runId).attempts
    .map((record) => record.phases.terminal ?? record.phases.dispatched ?? record.phases.prepared)
    .filter(
      (attemptValue) =>
        attemptValue?.payload.role === "evaluator" && attemptValue.payload.unit_id === entry.evaluator_unit_id,
    )
    .sort((left, right) => left.payload.sequence - right.payload.sequence);
  const latest = attempts.at(-1);
  const nextSequence = latest?.payload.phase === "prepared" ? latest.payload.sequence : (latest?.payload.sequence ?? 0) + 1;
  if (
    latest?.payload.phase === "dispatched" ||
    latest?.payload.outcome === "outcome_unknown" ||
    latest?.payload.call_certainty === "unknown"
  ) {
    return { nextSequence, status: "outcome_unknown" };
  }
  if (latest?.payload.phase === "prepared") {
    if (latest.payload.input_sha256 !== entry.invocation.content_sha256) {
      return { nextSequence, status: "blocked_evidence" };
    }
    return { nextSequence, prepared: latest, status: "incomplete" };
  }
  const successful = attempts
    .filter(
      (attemptValue) =>
        attemptValue.payload.phase === "terminal" &&
        attemptValue.payload.outcome === "success" &&
        attemptValue.payload.input_sha256 === entry.invocation.content_sha256,
    )
    .at(-1);
  if (!successful) return { nextSequence, status: "incomplete" };
  const proposals = listStoredArtifacts(root, { artifactType: "evaluator_proposal" }).filter((proposal) => {
    const linkedResources = proposal.links.filter((linkValue) => linkValue.relationship === "resource_observation");
    return (
      proposal.payload.unit_id === entry.reader_unit_id &&
      hasExactLink(proposal, "attempt", successful) &&
      hasExactLink(proposal, "observation", entry.observation) &&
      linkedResources.length === entry.resources.length &&
      entry.resources.every((resource) => hasExactLink(proposal, "resource_observation", resource))
    );
  });
  if (proposals.length !== 1) return { nextSequence, status: "blocked_evidence" };
  return { attempt: successful, nextSequence, proposal: proposals[0], status: "reusable" };
}

export function buildRunReviewSummary({
  anomalies = [],
  attempts,
  blockedUnitIds = { evaluator: [], reader: [] },
  drillDownLinks = [],
  helperCallCount = 0,
  limitations = [],
  proposedAction,
  proposals,
  readinessStatus = "passed",
  recommendation,
  reusedUnitIds = { evaluator: [], reader: [] },
  run,
}) {
  assertHarnessArtifact(run, { artifactType: "run_manifest" });
  const proposalByUnit = new Map();
  const attemptByBinding = new Map(
    attempts
      .map((record) => record.phases?.terminal ?? record.phases?.dispatched ?? record.phases?.prepared ?? record)
      .filter(Boolean)
      .map((attemptValue) => [`${attemptValue.artifact_id}:${attemptValue.content_sha256}`, attemptValue]),
  );
  for (const proposal of proposals) {
    assertHarnessArtifact(proposal, { artifactType: "evaluator_proposal" });
    if (proposalByUnit.has(proposal.payload.unit_id)) fail("SUMMARY_INPUT_INVALID", "Summary proposal units must be unique.");
    const attemptLink = proposal.links.find((linkValue) => linkValue.relationship === "attempt");
    const proposalAttempt = attemptByBinding.get(`${attemptLink.target_artifact_id}:${attemptLink.target_content_sha256}`);
    if (
      !proposalAttempt ||
      !proposalAttempt.links.some(
        (linkValue) =>
          linkValue.relationship === "run" &&
          linkValue.target_artifact_id === run.artifact_id &&
          linkValue.target_content_sha256 === run.content_sha256,
      )
    ) {
      fail("SUMMARY_INPUT_INVALID", "Summary proposals must bind an exact evaluator attempt in the same run.");
    }
    proposalByUnit.set(proposal.payload.unit_id, proposal);
  }
  const readers = run.payload.selected_units.filter((unit) => unit.role === "reader");
  const baselineUnits = readers.filter((unit) => unit.variant === "baseline");
  const candidateUnits = readers.filter((unit) => unit.variant !== "baseline");
  const baseline = caseAggregate(baselineUnits, proposalByUnit);
  const candidate = caseAggregate(candidateUnits, proposalByUnit);
  const baselineCases = new Set(baselineUnits.map((unit) => unit.case_id));
  const comparable = candidateUnits.filter((unit) => baselineCases.has(unit.case_id));
  const comparison = comparisonAggregate(comparable, proposalByUnit);
  const attemptList = attempts.map(
    (record) => record.phases?.terminal ?? record.phases?.dispatched ?? record.phases?.prepared ?? record,
  );
  for (const attemptValue of attemptList) assertHarnessArtifact(attemptValue, { artifactType: "execution_attempt" });
  const summary = createHarnessArtifact({
    artifactType: "run_review_summary",
    artifactId: `${run.artifact_id}-summary`,
    producer: producer("review_builder"),
    links: [
      link("run", run),
      ...proposals.map((proposal) => link("evaluator_proposal", proposal)),
      ...attemptList.map((attemptValue) => link("execution_attempt", attemptValue)),
    ].sort(compareLinks),
    payload: {
      anomalies: [...anomalies],
      baseline,
      candidate,
      comparison,
      drill_down_links: structuredClone(drillDownLinks),
      exceptions: proposals
        .filter((proposal) =>
          proposal.payload.case_status !== "passed" ||
          ["regressed", "inconclusive"].includes(proposal.payload.comparison_status) ||
          proposal.payload.recommendation !== "accept",
        )
        .map((proposal) => `${proposal.payload.unit_id}: ${proposal.payload.rationale}`),
      limitations: [...limitations],
      operations: {
        evaluator: operationalAggregate(run, "evaluator", attemptList, reusedUnitIds.evaluator, blockedUnitIds.evaluator),
        reader: operationalAggregate(run, "reader", attemptList, reusedUnitIds.reader, blockedUnitIds.reader),
      },
      proposed_action: proposedAction,
      readiness: { helper_call_count: helperCallCount, status: readinessStatus },
      recommendation,
      renderer_contract: {
        html_mode: "static-escaped-no-javascript",
        link_policy: "typed-contained-local-only",
        markdown_mode: "context-escaped-text",
        security_policy_version: securityPolicyVersion,
        untrusted_text: true,
      },
      scope: {
        baseline_case_ids: baseline.scope_case_ids,
        candidate_case_ids: candidate.scope_case_ids,
        comparable_unit_ids: comparable.map((unit) => unit.unit_id).sort(compareStrings),
        selected_case_ids: [...new Set(readers.map((unit) => unit.case_id))].sort(compareStrings),
      },
    },
  });
  return summary;
}

export function renderReviewRepresentations(summary) {
  assertHarnessArtifact(summary, { artifactType: "run_review_summary" });
  const json = canonicalJson(summary);
  const md = renderMarkdown(summary.payload);
  const html = renderHtml(summary.payload);
  const representations = {
    canonical_sha256: summary.content_sha256,
    renderer_version: rendererVersion,
    security_policy_version: securityPolicyVersion,
    summary_html: { bytes: html, sha256: sha256Bytes(Buffer.from(html, "utf8")) },
    summary_json: { bytes: json, sha256: sha256Bytes(Buffer.from(json, "utf8")) },
    summary_md: { bytes: md, sha256: sha256Bytes(Buffer.from(md, "utf8")) },
  };
  return { ...representations, metadata: buildRepresentationMetadata(summary, representations) };
}

export function persistReviewRepresentations(storeRoot, runId, representations) {
  assertRepresentations(representations, representations.canonical_sha256);
  if (typeof runId !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(runId)) {
    fail("REVIEW_PATH_INVALID", "Review run identity must be contained and normalized.");
  }
  const directory = resolve(storeRoot, "runs", runId, "review");
  mkdirSync(directory, { recursive: true });
  for (const [file, bytes] of [
    ["summary.json", representations.summary_json.bytes],
    ["summary.md", representations.summary_md.bytes],
    ["summary.html", representations.summary_html.bytes],
    ["representations.json", canonicalJson(representations.metadata)],
  ]) {
    const target = join(directory, file);
    const temporary = join(dirname(target), `.${file}.${randomUUID()}.tmp`);
    writeFileSync(temporary, bytes, { encoding: "utf8", flag: "wx" });
    renameSync(temporary, target);
  }
  return directory;
}

export function validateReviewRepresentations(storeRoot, runId, summary) {
  assertHarnessArtifact(summary, { artifactType: "run_review_summary" });
  assertSummaryRunBinding(storeRoot, runId, summary);
  const expected = renderReviewRepresentations(summary);
  const directory = resolve(storeRoot, "runs", runId, "review");
  const expectedFiles = [
    ["summary.json", expected.summary_json.bytes],
    ["summary.md", expected.summary_md.bytes],
    ["summary.html", expected.summary_html.bytes],
    ["representations.json", canonicalJson(expected.metadata)],
  ];
  for (const [file, bytes] of expectedFiles) {
    const path = join(directory, file);
    if (!existsSync(path) || readFileSync(path, "utf8") !== bytes) {
      fail("REVIEW_REPRESENTATION_STALE", `Review representation '${file}' is missing, stale, or corrupt.`, 4);
    }
  }
  const metadata = parseStrictJson(readFileSync(join(directory, "representations.json")), "review representation metadata");
  if (canonicalJson(metadata) !== canonicalJson(expected.metadata)) {
    fail("REVIEW_REPRESENTATION_STALE", "Review representation metadata is detached from canonical review authority.", 4);
  }
  return expected.metadata;
}

export function rebuildReviewRepresentations(storeRoot, runId, summary) {
  assertHarnessArtifact(summary, { artifactType: "run_review_summary" });
  assertSummaryRunBinding(storeRoot, runId, summary);
  const representations = renderReviewRepresentations(summary);
  persistReviewRepresentations(storeRoot, runId, representations);
  validateReviewRepresentations(storeRoot, runId, summary);
  return representations.metadata;
}

export function publishRunReview({
  leaseToken,
  now = new Date().toISOString(),
  representations,
  storeRoot,
  summary,
  supportingArtifacts = [],
}) {
  assertHarnessArtifact(summary, { artifactType: "run_review_summary" });
  assertRepresentations(representations, summary.content_sha256);
  validateArtifactGraph(exactDependencyClosure(summary, supportingArtifacts));
  const runLink = summary.links.find((linkValue) => linkValue.relationship === "run");
  const manifest = loadRunManifest(storeRoot, runLink.target_artifact_id);
  if (manifest.payload.state !== "evaluating") {
    fail("RUN_STATE_INVALID", "A canonical review may publish only from the evaluating state.", 4);
  }
  writeArtifactObject(storeRoot, summary);
  const directory = persistReviewRepresentations(storeRoot, manifest.artifact_id, representations);
  const transitioned = transitionRun(storeRoot, {
    expectedRevision: manifest.payload.revision,
    leaseToken,
    nextState: "review_pending",
    now,
    runId: manifest.artifact_id,
  });
  return { directory, run_state: transitioned.payload.state, summary_sha256: summary.content_sha256 };
}

function exactDependencyClosure(root, supportingArtifacts) {
  const byBinding = new Map();
  for (const artifact of supportingArtifacts) {
    assertHarnessArtifact(artifact);
    byBinding.set(`${artifact.artifact_type}:${artifact.artifact_id}:${artifact.content_sha256}`, artifact);
  }
  const closure = [];
  const visited = new Set();
  const visit = (artifact) => {
    const key = `${artifact.artifact_type}:${artifact.artifact_id}:${artifact.content_sha256}`;
    if (visited.has(key)) return;
    visited.add(key);
    for (const linkValue of artifact.links) {
      const target = byBinding.get(
        `${linkValue.target_artifact_type}:${linkValue.target_artifact_id}:${linkValue.target_content_sha256}`,
      );
      if (!target) fail("REVIEW_GRAPH_INVALID", "Canonical review dependency closure is incomplete.", 4);
      visit(target);
    }
    closure.push(artifact);
  };
  visit(root);
  return closure;
}

export function createHumanReviewDecision({
  acceptedUnitIds,
  action,
  artifactId,
  decidedAt,
  proposals,
  rationale,
  representations,
  reviewPolicy,
  reviewer,
  summary,
  supportingArtifacts,
}) {
  validateArtifactGraph([...supportingArtifacts, ...proposals, summary]);
  assertRepresentations(representations, summary.content_sha256);
  if (!summaryAcceptable(summary) && action === "accept") fail("SUMMARY_NOT_ACCEPTABLE", "Incomplete or uncertain summary cannot be accepted.", 4);
  const accepted = action === "accept" ? [...acceptedUnitIds].sort(compareStrings) : [];
  const identity = deriveAcceptanceInputIdentity({
    accepted_scope: accepted,
    evidence_bindings: deriveAcceptanceInputProjection({ acceptedScope: accepted, proposals, reviewPolicy, summary }).evidence_bindings,
    proposals,
    review_policy: reviewPolicy,
    summary,
  });
  return createHarnessArtifact({
    artifactType: "human_review_decision",
    artifactId,
    producer: producer("authorized_reviewer"),
    links: [link("summary", summary), ...proposals.map((proposal) => link("evaluator_proposal", proposal))].sort(compareLinks),
    payload: {
      acceptance_input_id: identity.acceptance_input_id,
      accepted_unit_ids: accepted,
      action,
      decided_at: decidedAt,
      rationale,
      review_policy: structuredClone(reviewPolicy),
      reviewer: structuredClone(reviewer),
      summary_sha256: summary.content_sha256,
    },
  });
}

export function materializeHumanEvaluations({ decision, proposals, summary, supportingArtifacts }) {
  if (decision.payload.action !== "accept") fail("DECISION_NOT_ACCEPTED", "Only an accept decision can materialize evidence.", 4);
  validateArtifactGraph([...supportingArtifacts, ...proposals, summary, decision]);
  const evaluations = proposals
    .filter((proposal) => decision.payload.accepted_unit_ids.includes(proposal.payload.unit_id))
    .map((proposal) =>
      createHarnessArtifact({
        artifactType: "human_evaluation",
        artifactId: `evaluation-${decision.artifact_id}-${proposal.payload.unit_id}`,
        producer: producer("materializer"),
        links: [link("decision", decision), link("evaluator_proposal", proposal), link("summary", summary)].sort(compareLinks),
        payload: {
          acceptance_input_id: decision.payload.acceptance_input_id,
          case_status: proposal.payload.case_status,
          comparison_status: proposal.payload.comparison_status,
          decision_id: decision.artifact_id,
          proposal_id: proposal.artifact_id,
          unit_id: proposal.payload.unit_id,
        },
      }),
    )
    .sort(compareArtifacts);
  validateArtifactGraph([...supportingArtifacts, ...proposals, summary, decision, ...evaluations]);
  return evaluations;
}

export function createAcceptedReport({ artifactId, decision, evaluations, run, summary, supportingArtifacts }) {
  const acceptedUnitIds = evaluations.map((evaluation) => evaluation.payload.unit_id).sort(compareStrings);
  const statusMembers = (field, statuses, nullStatus = null) =>
    Object.fromEntries(statuses.map((status) => [status, evaluations.filter((evaluation) => (evaluation.payload[field] ?? nullStatus) === status).map((evaluation) => evaluation.payload.unit_id).sort(compareStrings)]));
  const report = createHarnessArtifact({
    artifactType: "generated_report",
    artifactId,
    producer: producer("reporter"),
    links: [link("run", run), ...evaluations.map((evaluation) => link("human_evaluation", evaluation))].sort(compareLinks),
    payload: {
      acceptance_input_id: decision.payload.acceptance_input_id,
      accepted_unit_ids: acceptedUnitIds,
      aggregates: {
        case_status: statusMembers("case_status", ["failed", "not_run", "partially_passed", "passed"]),
        comparison_status: statusMembers("comparison_status", ["equivalent", "improved", "inconclusive", "not_applicable", "regressed"], "not_applicable"),
      },
      decision_id: decision.artifact_id,
      run_id: run.artifact_id,
      status: "complete",
      summary_sha256: summary.content_sha256,
    },
  });
  validateArtifactGraph([...supportingArtifacts, summary, decision, ...evaluations, report]);
  return report;
}

function caseAggregate(units, proposals) {
  const scope = [...new Set(units.map((unit) => unit.case_id))].sort(compareStrings);
  if (scope.length !== units.length) fail("SUMMARY_INPUT_INVALID", "A role aggregate requires one selected unit per case.");
  const complete = [];
  const incomplete = [];
  const members = { failed: [], not_run: [], partially_passed: [], passed: [] };
  for (const unit of units) {
    const proposal = proposals.get(unit.unit_id);
    if (!proposal || proposal.payload.case_status === null) incomplete.push(unit.case_id);
    else {
      complete.push(unit.case_id);
      members[proposal.payload.case_status].push(unit.case_id);
    }
  }
  for (const values of Object.values(members)) values.sort(compareStrings);
  return {
    counts: Object.fromEntries([...Object.entries(members).map(([status, values]) => [status, values.length]), ["unassessed", incomplete.length]]),
    evidence: { complete_case_ids: complete.sort(compareStrings), incomplete_case_ids: incomplete.sort(compareStrings) },
    scope_case_ids: scope,
    status_members: members,
  };
}

function comparisonAggregate(units, proposals) {
  const scope = units.map((unit) => unit.unit_id).sort(compareStrings);
  const assessed = [];
  const unassessed = [];
  const members = { equivalent: [], improved: [], inconclusive: [], regressed: [] };
  for (const unit of units) {
    const status = proposals.get(unit.unit_id)?.payload.comparison_status;
    if (status === null || status === undefined) unassessed.push(unit.unit_id);
    else {
      assessed.push(unit.unit_id);
      members[status].push(unit.unit_id);
    }
  }
  for (const values of Object.values(members)) values.sort(compareStrings);
  return {
    counts: Object.fromEntries([...Object.entries(members).map(([status, values]) => [status, values.length]), ["unassessed", unassessed.length]]),
    evidence: { assessed_unit_ids: assessed.sort(compareStrings), unassessed_unit_ids: unassessed.sort(compareStrings) },
    scope_unit_ids: scope,
    status_members: members,
  };
}

function operationalAggregate(run, role, attempts, reused = [], blocked = []) {
  const scope = run.payload.selected_units.filter((unit) => unit.role === role).map((unit) => unit.unit_id).sort(compareStrings);
  const roleAttempts = attempts.filter((attemptValue) => attemptValue?.payload.role === role);
  const attemptedUnits = new Set(roleAttempts.map((attemptValue) => attemptValue.payload.unit_id));
  if ([...reused, ...blocked].some((unitId) => attemptedUnits.has(unitId))) {
    fail("SUMMARY_OPERATION_INVALID", `${role} reused or pre-dispatch blocked units cannot have attempts in this run.`);
  }
  const newly = scope.filter((unitId) => attemptedUnits.has(unitId));
  const classified = [...new Set([...reused, ...blocked, ...newly])].sort(compareStrings);
  if (canonicalJson(classified) !== canonicalJson(scope)) fail("SUMMARY_OPERATION_INCOMPLETE", `${role} logical operation scope is incomplete.`);
  const initial = roleAttempts.filter((value) => value.payload.sequence === 1).map((value) => value.payload.attempt_id).sort(compareStrings);
  const retry = roleAttempts.filter((value) => value.payload.sequence > 1).map((value) => value.payload.attempt_id).sort(compareStrings);
  const terminal = { cancelled: [], error: [], outcome_unknown: [], success: [], timeout: [] };
  const nonterminal = [];
  for (const attemptValue of roleAttempts) {
    if (attemptValue.payload.phase === "terminal") terminal[attemptValue.payload.outcome].push(attemptValue.payload.attempt_id);
    else nonterminal.push(attemptValue.payload.attempt_id);
  }
  for (const values of Object.values(terminal)) values.sort(compareStrings);
  return {
    attempts: { initial_attempt_ids: initial, nonterminal_attempt_ids: nonterminal.sort(compareStrings), retry_attempt_ids: retry, terminal },
    blocked_unit_ids: [...blocked].sort(compareStrings),
    newly_executed_unit_ids: newly,
    reused_unit_ids: [...reused].sort(compareStrings),
    scope_unit_ids: scope,
  };
}

function summaryAcceptable(summary) {
  const payload = summary.payload;
  return (
    payload.readiness.status === "passed" &&
    payload.baseline.counts.unassessed === 0 &&
    payload.candidate.counts.unassessed === 0 &&
    payload.comparison.counts.unassessed === 0 &&
    [payload.operations.reader, payload.operations.evaluator].every(
      (operation) => operation.attempts.nonterminal_attempt_ids.length === 0 && operation.attempts.terminal.outcome_unknown.length === 0,
    )
  );
}

function renderMarkdown(payload) {
  const lines = [
    "# Eval harness review",
    "",
    `Recommendation: ${markdownText(payload.recommendation)}`,
    `Proposed action: ${markdownText(payload.proposed_action)}`,
    "",
    "## Counts",
    "",
    `Baseline: ${markdownText(JSON.stringify(payload.baseline.counts))}`,
    `Candidate: ${markdownText(JSON.stringify(payload.candidate.counts))}`,
    `Comparison: ${markdownText(JSON.stringify(payload.comparison.counts))}`,
    "",
    "## Exceptions",
    "",
    ...payload.exceptions.map((value) => `- ${markdownText(value)}`),
    "",
    "## Anomalies and limitations",
    "",
    ...[...payload.anomalies, ...payload.limitations].map((value) => `- ${markdownText(value)}`),
    "",
    "## Evidence",
    "",
    ...payload.drill_down_links.map((linkValue) => `- [${markdownText(linkValue.label)}](${safeLocalHref(linkValue.relative_path)})`),
  ];
  return `${lines.join("\n")}\n`;
}

function renderHtml(payload) {
  const csp = "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; connect-src 'none'; script-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
  const list = (values) => `<ul>${values.map((value) => `<li>${htmlText(value)}</li>`).join("")}</ul>`;
  const links = `<ul>${payload.drill_down_links.map((linkValue) => `<li><a href="${safeLocalHref(linkValue.relative_path)}">${htmlText(linkValue.label)}</a></li>`).join("")}</ul>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><style>body{font-family:system-ui,sans-serif;max-width:72rem;margin:2rem auto;padding:0 1rem}code{white-space:pre-wrap}</style><title>Eval harness review</title></head><body><h1>Eval harness review</h1><p><strong>Recommendation:</strong> ${htmlText(payload.recommendation)}</p><p><strong>Proposed action:</strong> ${htmlText(payload.proposed_action)}</p><h2>Counts</h2><code>${htmlText(JSON.stringify({ baseline: payload.baseline.counts, candidate: payload.candidate.counts, comparison: payload.comparison.counts }))}</code><h2>Exceptions</h2>${list(payload.exceptions)}<h2>Anomalies and limitations</h2>${list([...payload.anomalies, ...payload.limitations])}<h2>Evidence</h2>${links}</body></html>\n`;
}

function safeLocalHref(value) {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`))
    .join("/");
}

function markdownText(value) {
  assertDisplayText(value);
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replace(/([\\`*_{}\[\]()#+.!|~-])/g, "\\$1");
}

function htmlText(value) {
  assertDisplayText(value);
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function assertDisplayText(value) {
  if (typeof value !== "string" || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
    fail("RENDERER_TEXT_INVALID", "Review text contains invalid control data.");
  }
}

function buildRepresentationMetadata(summary, representations) {
  const identity = {
    canonical_artifact_id: summary.artifact_id,
    canonical_sha256: representations.canonical_sha256,
    metadata_version: "review-representations-v1",
    renderer_version: representations.renderer_version,
    security_policy_version: representations.security_policy_version,
    summary_html_sha256: representations.summary_html.sha256,
    summary_json_sha256: representations.summary_json.sha256,
    summary_md_sha256: representations.summary_md.sha256,
  };
  return { ...identity, freshness_id: sha256Canonical(identity) };
}

function assertRepresentations(value, canonicalSha256) {
  if (
    value?.canonical_sha256 !== canonicalSha256 ||
    value.renderer_version !== rendererVersion ||
    value.security_policy_version !== securityPolicyVersion
  ) fail("REVIEW_REPRESENTATION_STALE", "Review representations are stale or use an unsupported policy.", 4);
  for (const key of ["summary_json", "summary_md", "summary_html"]) {
    if (sha256Bytes(Buffer.from(value[key]?.bytes ?? "", "utf8")) !== value[key]?.sha256) {
      fail("REVIEW_REPRESENTATION_INVALID", "Review representation integrity failed.", 4);
    }
  }
  const canonicalSummary = parseStrictJson(Buffer.from(value.summary_json.bytes, "utf8"), "canonical review representation");
  assertHarnessArtifact(canonicalSummary, { artifactType: "run_review_summary" });
  if (canonicalSummary.content_sha256 !== canonicalSha256) {
    fail("REVIEW_REPRESENTATION_INVALID", "JSON representation does not contain the exact canonical summary.", 4);
  }
  const metadata = value.metadata;
  const metadataKeys = [
    "canonical_artifact_id",
    "canonical_sha256",
    "freshness_id",
    "metadata_version",
    "renderer_version",
    "security_policy_version",
    "summary_html_sha256",
    "summary_json_sha256",
    "summary_md_sha256",
  ];
  const identity = metadata && { ...metadata };
  if (
    !identity ||
    typeof identity !== "object" ||
    Array.isArray(identity) ||
    JSON.stringify(Object.keys(identity).sort()) !== JSON.stringify(metadataKeys)
  ) {
    fail("REVIEW_REPRESENTATION_INVALID", "Review representation metadata is missing.", 4);
  }
  delete identity.freshness_id;
  if (
    metadata.metadata_version !== "review-representations-v1" ||
    metadata.canonical_artifact_id !== canonicalSummary.artifact_id ||
    metadata.canonical_sha256 !== value.canonical_sha256 ||
    metadata.renderer_version !== value.renderer_version ||
    metadata.security_policy_version !== value.security_policy_version ||
    metadata.summary_json_sha256 !== value.summary_json.sha256 ||
    metadata.summary_md_sha256 !== value.summary_md.sha256 ||
    metadata.summary_html_sha256 !== value.summary_html.sha256 ||
    metadata.freshness_id !== sha256Canonical(identity)
  ) {
    fail("REVIEW_REPRESENTATION_INVALID", "Review representation metadata does not bind the exact current views.", 4);
  }
}

function assertSummaryRunBinding(storeRoot, runId, summary) {
  const run = loadRunManifest(storeRoot, runId);
  const runLinks = summary.links.filter((linkValue) => linkValue.relationship === "run");
  if (
    runLinks.length !== 1 ||
    runLinks[0].target_artifact_id !== run.artifact_id ||
    runLinks[0].target_content_sha256 !== run.content_sha256
  ) {
    fail("REVIEW_GRAPH_INVALID", "Review representations must bind the exact owning run manifest.", 4);
  }
}

function runtimeHashForReadiness(readiness, run) {
  return readiness.payload.round === 1 ? run.payload.runtime_config_sha256 : readiness.payload.correction.after_sha256;
}

function fieldResult(field) {
  return { attested: true, compiled: true, field, reason: null, requested: true, status: "passed" };
}

function attempt(artifactId, links, common, phase, callCertainty, outcome, finishedAt) {
  return createHarnessArtifact({
    artifactType: "execution_attempt",
    artifactId,
    producer: producer("orchestrator"),
    links,
    payload: { ...common, call_certainty: callCertainty, finished_at: finishedAt, outcome, phase },
  });
}

function producer(kind) {
  return { kind, name: `${kind.replaceAll("_", "-")}-v2`, version: "2" };
}

function link(relationship, target) {
  return { relationship, target_artifact_id: target.artifact_id, target_artifact_type: target.artifact_type, target_content_sha256: target.content_sha256 };
}

function hasExactLink(source, relationship, target) {
  return source.links.some(
    (linkValue) =>
      linkValue.relationship === relationship &&
      linkValue.target_artifact_id === target.artifact_id &&
      linkValue.target_artifact_type === target.artifact_type &&
      linkValue.target_content_sha256 === target.content_sha256,
  );
}

function isConcreteRuntimeAdapter(adapter) {
  return adapter?.kind === "codex_chatgpt_app_server";
}

function hasRuntimeSnapshot(storeRoot, runId, attemptId) {
  try {
    readRuntimeSnapshot(storeRoot, runId, attemptId);
    return true;
  } catch (error) {
    if (error instanceof HarnessError && error.code === "RUNTIME_SNAPSHOT_MISSING") return false;
    throw error;
  }
}

function uniqueArtifacts(artifacts) {
  const values = new Map();
  for (const artifact of artifacts) {
    assertHarnessArtifact(artifact);
    const key = `${artifact.artifact_type}:${artifact.artifact_id}`;
    const existing = values.get(key);
    if (existing && existing.content_sha256 !== artifact.content_sha256) {
      fail("ARTIFACT_GRAPH_INVALID", `Artifact identity '${key}' resolves to conflicting content.`, 4);
    }
    values.set(key, artifact);
  }
  return [...values.values()];
}

function compareArtifacts(left, right) {
  return compareStrings(`${left.artifact_type}:${left.artifact_id}`, `${right.artifact_type}:${right.artifact_id}`);
}

function compareLinks(left, right) {
  return compareStrings(`${left.relationship}:${left.target_artifact_type}:${left.target_artifact_id}`, `${right.relationship}:${right.target_artifact_type}:${right.target_artifact_id}`);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(code, message, exitCode = 1) {
  throw new HarnessError(code, message, exitCode);
}
