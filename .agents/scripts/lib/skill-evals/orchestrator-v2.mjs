import {
  HarnessError,
  assertHarnessArtifact,
  createHarnessArtifact,
} from "./harness-schema-v2.mjs";
import { createDispatchGuard } from "./readiness-v2.mjs";
import {
  appendAttemptPhase,
  inspectRunState,
  listStoredArtifacts,
  loadRunManifest,
  readArtifactObject,
  transitionRun,
  writeArtifactObject,
} from "./run-store-v2.mjs";

export async function runSequentialReaderStage({
  adapter,
  adapterCapabilities,
  evaluatorStatic,
  invalidatedUnitIds = [],
  leaseToken,
  maxDispatches = Number.POSITIVE_INFINITY,
  now = () => new Date().toISOString(),
  readinessSet,
  readerInvocations,
  run,
  storeRoot,
  supportingArtifacts = [],
  task,
}) {
  assertFixtureAdapter(adapter, "reader");
  assertHarnessArtifact(task, { artifactType: "task_manifest" });
  assertHarnessArtifact(run, { artifactType: "run_manifest" });
  assertPositiveLimit(maxDispatches, "maxDispatches");
  const invalidated = new Set(invalidatedUnitIds);
  const selectedReaderIds = run.payload.selected_units
    .filter((unit) => unit.role === "reader")
    .map((unit) => unit.unit_id)
    .sort(compareStrings);
  assertExactInvocationSet(readerInvocations, selectedReaderIds, run.artifact_id, "reader");
  const invocationByUnit = new Map(readerInvocations.map((invocation) => [invocation.payload.unit_id, invocation]));
  const guard = createDispatchGuard({
    adapterCapabilities,
    evaluatorStatic,
    readinessSet,
    readerInvocations,
    run,
    supportingArtifacts,
    task,
  });
  let manifest = enterReaderStage(storeRoot, run.artifact_id, leaseToken, now());
  const result = {
    blocked_unit_ids: [],
    calls: 0,
    failed_unit_ids: [],
    invalidated_unit_ids: [...invalidated].filter((unitId) => selectedReaderIds.includes(unitId)).sort(compareStrings),
    newly_executed_unit_ids: [],
    observations: [],
    resources: [],
    reused_unit_ids: [],
    run_state: manifest.payload.state,
    uncertain_unit_ids: [],
  };

  for (const unitId of selectedReaderIds) {
    const invocation = invocationByUnit.get(unitId);
    const durable = resolveDurableReaderUnit(storeRoot, run.artifact_id, unitId, invocation);
    if (!invalidated.has(unitId) && durable.status === "reusable") {
      result.reused_unit_ids.push(unitId);
      result.observations.push(durable.observation);
      result.resources.push(...durable.resources);
      continue;
    }
    if (["outcome_unknown", "blocked_evidence"].includes(durable.status)) {
      result.newly_executed_unit_ids.push(unitId);
      if (durable.status === "outcome_unknown") result.uncertain_unit_ids.push(unitId);
      else result.failed_unit_ids.push(unitId);
      continue;
    }
    if (result.calls >= maxDispatches) break;

    const sequence = durable.nextSequence;
    const attemptId = `reader-${unitId}-attempt-${sequence}`;
    const startedAt = now();
    const common = {
      attempt_id: attemptId,
      input_sha256: invocation.content_sha256,
      role: "reader",
      run_id: run.artifact_id,
      sequence,
      started_at: startedAt,
      unit_id: unitId,
    };
    const links = attemptLinks(invocation, readinessSet.reader, run);
    appendAttemptPhase(
      storeRoot,
      attemptArtifact(`${attemptId}-prepared`, links, {
        ...common,
        call_certainty: "not_started",
        finished_at: null,
        outcome: null,
        phase: "prepared",
      }),
      { leaseToken, now: startedAt },
    );
    const grant = readinessSet.reader.payload.grants.find((item) => item.unit_id === unitId);
    const request = guard.authorize(invocation, grant?.nonce);
    appendAttemptPhase(
      storeRoot,
      attemptArtifact(`${attemptId}-dispatched`, links, {
        ...common,
        call_certainty: "started",
        finished_at: null,
        outcome: null,
        phase: "dispatched",
      }),
      { leaseToken, now: startedAt },
    );
    result.calls += 1;
    let adapterResult;
    let failure = null;
    try {
      adapterResult = await adapter.invokeReader(structuredClone(request), {
        attempt_id: attemptId,
        sequence,
        unit_id: unitId,
      });
    } catch (error) {
      failure = normalizeAdapterFailure(error);
    }
    const finishedAt = now();
    if (failure) {
      const uncertain = failure.callCertainty === "unknown";
      appendAttemptPhase(
        storeRoot,
        attemptArtifact(`${attemptId}-terminal`, links, {
          ...common,
          call_certainty: uncertain ? "unknown" : "confirmed_finished",
          finished_at: finishedAt,
          outcome: uncertain ? "outcome_unknown" : "error",
          phase: "terminal",
        }),
        { leaseToken, now: finishedAt },
      );
      result.newly_executed_unit_ids.push(unitId);
      if (uncertain) result.uncertain_unit_ids.push(unitId);
      else result.failed_unit_ids.push(unitId);
      continue;
    }

    const successfulTerminal = attemptArtifact(`${attemptId}-terminal`, links, {
      ...common,
      call_certainty: "confirmed_finished",
      finished_at: finishedAt,
      outcome: "success",
      phase: "terminal",
    });
    let evidence;
    try {
      validateReaderAdapterResult(adapterResult);
      evidence = materializeReaderEvidence({
        adapterResult,
        invocation,
        run,
        terminalAttempt: successfulTerminal,
        unitId,
      });
    } catch (error) {
      appendAttemptPhase(
        storeRoot,
        attemptArtifact(`${attemptId}-terminal`, links, {
          ...common,
          call_certainty: "confirmed_finished",
          finished_at: finishedAt,
          outcome: "error",
          phase: "terminal",
        }),
        { leaseToken, now: finishedAt },
      );
      result.newly_executed_unit_ids.push(unitId);
      result.failed_unit_ids.push(unitId);
      continue;
    }
    appendAttemptPhase(storeRoot, successfulTerminal, { leaseToken, now: finishedAt });
    writeArtifactObject(storeRoot, evidence.observation);
    for (const resource of evidence.resources) writeArtifactObject(storeRoot, resource);
    result.newly_executed_unit_ids.push(unitId);
    result.observations.push(evidence.observation);
    result.resources.push(...evidence.resources);
  }

  result.observations.sort(compareArtifacts);
  result.resources.sort(compareArtifacts);
  for (const field of [
    "blocked_unit_ids",
    "failed_unit_ids",
    "newly_executed_unit_ids",
    "reused_unit_ids",
    "uncertain_unit_ids",
  ]) {
    result[field] = [...new Set(result[field])].sort(compareStrings);
  }
  const completed = new Set(result.observations.map((observation) => observation.payload.unit_id));
  const allComplete = selectedReaderIds.every((unitId) => completed.has(unitId));
  if (allComplete) manifest = transitionCurrent(storeRoot, run.artifact_id, "reader_complete", leaseToken, now());
  else if (
    result.blocked_unit_ids.length > 0 ||
    result.failed_unit_ids.length > 0 ||
    result.uncertain_unit_ids.length > 0
  ) {
    manifest = transitionCurrent(storeRoot, run.artifact_id, "blocked", leaseToken, now());
  }
  result.run_state = manifest.payload.state;
  result.first_incomplete_unit_id = selectedReaderIds.find((unitId) => !completed.has(unitId)) ?? null;
  return result;
}

export function deriveReaderProgress(storeRoot, runId) {
  const manifest = loadRunManifest(storeRoot, runId);
  const selected = manifest.payload.selected_units.filter((unit) => unit.role === "reader").map((unit) => unit.unit_id);
  const state = inspectRunState(storeRoot, runId);
  const latest = latestAttemptsByUnit(state.attempts, "reader");
  const progress = { blocked: 0, complete: 0, incomplete: 0, requested: selected.length };
  for (const unitId of selected) {
    const attempt = latest.get(unitId);
    if (!attempt) progress.incomplete += 1;
    else if (attempt.payload.outcome === "success") {
      const invocation = readArtifactObject(storeRoot, attempt.payload.input_sha256);
      const durable = resolveDurableReaderUnit(storeRoot, runId, unitId, invocation);
      if (durable.status === "reusable") progress.complete += 1;
      else progress.blocked += 1;
    }
    else if (attempt.payload.outcome === "outcome_unknown" || attempt.payload.call_certainty === "unknown") progress.blocked += 1;
    else progress.incomplete += 1;
  }
  return progress;
}

function resolveDurableReaderUnit(root, runId, unitId, invocation) {
  const state = inspectRunState(root, runId);
  const attempts = state.attempts
    .map((record) => record.phases.terminal ?? record.phases.dispatched ?? record.phases.prepared)
    .filter((attempt) => attempt?.payload.role === "reader" && attempt.payload.unit_id === unitId)
    .sort((left, right) => left.payload.sequence - right.payload.sequence);
  const latest = attempts.at(-1);
  const nextSequence = (latest?.payload.sequence ?? 0) + 1;
  if (latest?.payload.outcome === "outcome_unknown" || latest?.payload.call_certainty === "unknown") {
    return { nextSequence, status: "outcome_unknown" };
  }
  const successful =
    latest?.payload.outcome === "success" && latest.payload.input_sha256 === invocation.content_sha256 ? latest : null;
  if (!successful) return { nextSequence, status: "incomplete" };
  const observations = listStoredArtifacts(root, { artifactType: "observation", runId }).filter(
    (observation) =>
      observation.payload.unit_id === unitId &&
      observation.payload.attempt_id === successful.payload.attempt_id &&
      hasExactLink(observation, "compiled_invocation", invocation) &&
      hasExactLinkByHash(observation, "attempt", successful.content_sha256),
  );
  if (observations.length !== 1) return { nextSequence, status: "blocked_evidence" };
  assertObservationContract(observations[0], invocation);
  const resources = listStoredArtifacts(root, { artifactType: "resource_observation" }).filter((resource) =>
    hasExactLink(resource, "observation", observations[0]),
  );
  return { nextSequence, observation: observations[0], resources, status: "reusable" };
}

function validateReaderAdapterResult(adapterResult) {
  assertExactKeys(adapterResult, ["observation", "resources"], "reader adapter result");
  assertExactKeys(
    adapterResult.observation,
    ["execution_status", "observed_access", "raw_text"],
    "reader adapter observation",
  );
  if (adapterResult.observation.execution_status !== "completed") {
    fail("READER_OUTPUT_INVALID", "A successful reader call must return a completed observation.");
  }
  if (!Array.isArray(adapterResult.resources)) fail("READER_OUTPUT_INVALID", "Reader resources must be an array.");
}

function materializeReaderEvidence({ adapterResult, invocation, run, terminalAttempt, unitId }) {
  const observation = createHarnessArtifact({
    artifactType: "observation",
    artifactId: `observation-${terminalAttempt.payload.attempt_id}`,
    producer: producer("adapter"),
    links: [link("attempt", terminalAttempt), link("compiled_invocation", invocation)].sort(compareLinks),
    payload: {
      attempt_id: terminalAttempt.payload.attempt_id,
      execution_status: "completed",
      observed_access: structuredClone(adapterResult.observation.observed_access),
      raw_text: adapterResult.observation.raw_text,
      run_id: run.artifact_id,
      unit_id: unitId,
    },
  });
  assertObservationContract(observation, invocation);
  const resources = adapterResult.resources.map((resource, index) =>
    createHarnessArtifact({
      artifactType: "resource_observation",
      artifactId: `resource-${terminalAttempt.payload.attempt_id}-${index + 1}`,
      producer: producer("adapter"),
      links: [link("observation", observation)],
      payload: { ...structuredClone(resource), observation_id: observation.artifact_id },
    }),
  );
  return { observation, resources };
}

function assertObservationContract(observation, invocation) {
  assertHarnessArtifact(observation, { artifactType: "observation" });
  const requested = invocation.payload.requested_policy;
  const observed = observation.payload.observed_access;
  const forbidden = [
    ["credentials", requested.credentials === "excluded"],
    ["network", requested.network === "denied"],
    ["remote_actions", requested.remote_actions === "denied"],
    ["mutation", requested.mutation === "denied"],
    ["filesystem", requested.filesystem === "none"],
    ["tools", requested.tools.length === 0],
  ];
  if (forbidden.some(([field, denied]) => denied && observed[field] === "observed")) {
    fail("OBSERVED_ACCESS_CONTRADICTION", "Observed reader access contradicts the pre-dispatch attestation.");
  }
}

function enterReaderStage(root, runId, leaseToken, now) {
  const manifest = loadRunManifest(root, runId);
  if (manifest.payload.state === "reading" || manifest.payload.state === "reader_complete") return manifest;
  if (!["ready", "blocked"].includes(manifest.payload.state)) {
    fail("RUN_STATE_INVALID", "Reader orchestration requires ready, reading, blocked, or reader_complete state.");
  }
  return transitionCurrent(root, runId, "reading", leaseToken, now);
}

function transitionCurrent(root, runId, nextState, leaseToken, now) {
  const current = loadRunManifest(root, runId);
  if (current.payload.state === nextState) return current;
  return transitionRun(root, {
    expectedRevision: current.payload.revision,
    leaseToken,
    nextState,
    now,
    runId,
  });
}

function latestAttemptsByUnit(records, role) {
  const latest = new Map();
  for (const record of records) {
    const head = record.phases.terminal ?? record.phases.dispatched ?? record.phases.prepared;
    if (head?.payload.role !== role || !head.payload.unit_id) continue;
    const prior = latest.get(head.payload.unit_id);
    if (!prior || prior.payload.sequence < head.payload.sequence) latest.set(head.payload.unit_id, head);
  }
  return latest;
}

function attemptArtifact(artifactId, links, payload) {
  return createHarnessArtifact({
    artifactType: "execution_attempt",
    artifactId,
    producer: producer("orchestrator"),
    links,
    payload,
  });
}

function attemptLinks(invocation, readiness, run) {
  return [link("compiled_invocation", invocation), link("readiness", readiness), link("run", run)].sort(compareLinks);
}

function assertExactInvocationSet(invocations, expectedUnitIds, runId, role) {
  if (!Array.isArray(invocations)) fail("ORCHESTRATION_INPUT_INVALID", "Invocation set must be an array.");
  const actual = invocations.map((invocation) => {
    assertHarnessArtifact(invocation, { artifactType: "compiled_invocation" });
    if (invocation.payload.role !== role || invocation.payload.run_id !== runId) {
      fail("ORCHESTRATION_INPUT_INVALID", "Invocation role or run identity is invalid.");
    }
    return invocation.payload.unit_id;
  });
  if (JSON.stringify([...actual].sort(compareStrings)) !== JSON.stringify(expectedUnitIds)) {
    fail("ORCHESTRATION_SET_INCOMPLETE", "Orchestration requires the complete selected unit set.");
  }
}

function assertFixtureAdapter(adapter, role) {
  const method = role === "reader" ? "invokeReader" : "invokeEvaluator";
  if (adapter?.kind !== "deterministic_fixture" || typeof adapter[method] !== "function") {
    fail("ADAPTER_NOT_CERTIFIED", "Stage 2 accepts only an explicit deterministic fixture adapter.", 4);
  }
}

function assertPositiveLimit(value, label) {
  if (value !== Number.POSITIVE_INFINITY && (!Number.isInteger(value) || value < 0)) {
    fail("ORCHESTRATION_INPUT_INVALID", `${label} must be a non-negative integer or Infinity.`);
  }
}

function normalizeAdapterFailure(error) {
  return { callCertainty: error?.callCertainty === "unknown" ? "unknown" : "confirmed_finished" };
}

function assertExactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("READER_OUTPUT_INVALID", `${label} must be an object.`);
  const actual = Object.keys(value).sort(compareStrings);
  const expected = [...keys].sort(compareStrings);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail("READER_OUTPUT_INVALID", `${label} fields are invalid.`);
}

function producer(kind) {
  return { kind, name: `${kind.replaceAll("_", "-")}-v2`, version: "2" };
}

function link(relationship, target) {
  return {
    relationship,
    target_artifact_id: target.artifact_id,
    target_artifact_type: target.artifact_type,
    target_content_sha256: target.content_sha256,
  };
}

function hasExactLink(source, relationship, target) {
  return source.links.some(
    (item) =>
      item.relationship === relationship &&
      item.target_artifact_id === target.artifact_id &&
      item.target_artifact_type === target.artifact_type &&
      item.target_content_sha256 === target.content_sha256,
  );
}

function hasExactLinkByHash(source, relationship, hash) {
  return source.links.some((item) => item.relationship === relationship && item.target_content_sha256 === hash);
}

function compareArtifacts(left, right) {
  return compareStrings(`${left.artifact_type}:${left.artifact_id}`, `${right.artifact_type}:${right.artifact_id}`);
}

function compareLinks(left, right) {
  return compareStrings(`${left.relationship}:${left.target_artifact_id}`, `${right.relationship}:${right.target_artifact_id}`);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(code, message, exitCode = 1) {
  throw new HarnessError(code, message, exitCode);
}
