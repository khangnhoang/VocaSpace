import {
  HarnessError,
  assertHarnessArtifact,
  createHarnessArtifact,
  validateArtifactGraph,
} from "./harness-schema-v2.mjs";
import { sha256Canonical } from "./artifact-schema-v1.mjs";
import { createDispatchGuard } from "./readiness-v2.mjs";
import {
  appendAttemptPhase,
  inspectRunState,
  listStoredArtifacts,
  loadRunManifest,
  readArtifactObject,
  recordAttemptControl,
  recordAttemptRetryClassification,
  transitionRun,
  writeArtifactObject,
} from "./run-store-v2.mjs";

export async function runControlledFixtureAttempts({
  adapter,
  adapterConcurrency = 1,
  dispatchContext,
  invocations,
  leaseToken,
  now = () => new Date().toISOString(),
  policyConcurrency = 1,
  readiness,
  requestedConcurrency = 1,
  retryPolicy = { max_attempts: 1, retryable_classes: [] },
  role,
  run,
  signal = null,
  storeRoot,
  timeoutMs = null,
  timeoutPhase = "response",
}) {
  assertHarnessArtifact(run, { artifactType: "run_manifest" });
  assertHarnessArtifact(readiness, { artifactType: "readiness_analysis" });
  if (!["reader", "evaluator"].includes(role)) fail("CONTROL_INPUT_INVALID", "Controlled role is invalid.");
  assertFixtureAdapter(adapter, role);
  for (const value of [requestedConcurrency, adapterConcurrency, policyConcurrency]) {
    if (!Number.isInteger(value) || value < 1) fail("CONTROL_INPUT_INVALID", "Concurrency caps must be positive integers.");
  }
  if (
    !retryPolicy ||
    typeof retryPolicy !== "object" ||
    Array.isArray(retryPolicy) ||
    Object.keys(retryPolicy).sort().join(",") !== "max_attempts,retryable_classes" ||
    !Number.isInteger(retryPolicy.max_attempts) ||
    retryPolicy.max_attempts < 1 ||
    retryPolicy.max_attempts > 3 ||
    !Array.isArray(retryPolicy.retryable_classes)
  ) {
    fail("CONTROL_INPUT_INVALID", "Retry policy is invalid.");
  }
  if (
    retryPolicy.retryable_classes.some(
      (value, index) =>
        typeof value !== "string" ||
        !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value) ||
        (index > 0 && retryPolicy.retryable_classes[index - 1] >= value),
    )
  ) {
    fail("CONTROL_INPUT_INVALID", "Retry classes must be sorted unique identities.");
  }
  if (retryPolicy.retryable_classes.includes("semantic_invalid")) {
    fail("CONTROL_INPUT_INVALID", "Semantic invalid output cannot be retryable.");
  }
  const retryPolicySha256 = sha256Canonical(retryPolicy);
  if (timeoutMs !== null && (!Number.isInteger(timeoutMs) || timeoutMs < 1)) {
    fail("CONTROL_INPUT_INVALID", "Timeout must be a positive integer.");
  }
  if (!["dispatch", "connect", "response"].includes(timeoutPhase)) {
    fail("CONTROL_INPUT_INVALID", "Timeout phase is invalid.");
  }
  const selected = run.payload.selected_units.filter((unit) => unit.role === role).map((unit) => unit.unit_id).sort(compareStrings);
  assertExactInvocationSet(invocations, selected, run.artifact_id, role);
  const expectedStage = role === "reader" ? "reader" : "evaluator";
  if (readiness.payload.status !== "passed" || readiness.payload.stage !== expectedStage) {
    fail("DISPATCH_NOT_AUTHORIZED", "Controlled dispatch requires the exact passed stage readiness.", 4);
  }
  const grants = new Map(readiness.payload.grants.map((grant) => [grant.unit_id, grant]));
  for (const invocation of invocations) {
    assertHarnessArtifact(invocation, { artifactType: "compiled_invocation" });
    if (grants.get(invocation.payload.unit_id)?.invocation_sha256 !== invocation.content_sha256) {
      fail("DISPATCH_GRANT_INVALID", "Controlled dispatch grant is missing or stale.", 4);
    }
  }
  const authorize = createControlledAuthorizer({
    dispatchContext,
    invocations,
    readiness,
    role,
    run,
  });
  const effectiveConcurrency = Math.min(requestedConcurrency, adapterConcurrency, policyConcurrency);
  const queue = [...invocations].sort((left, right) => compareStrings(left.payload.unit_id, right.payload.unit_id));
  const durableState = inspectRunState(storeRoot, run.artifact_id);
  const durableAttempts = durableState.attempts;
  const priorByUnit = new Map();
  for (const record of durableAttempts) {
    const head = record.phases.terminal ?? record.phases.dispatched ?? record.phases.prepared;
    if (head?.payload.role !== role || !head.payload.unit_id) continue;
    const values = priorByUnit.get(head.payload.unit_id) ?? [];
    values.push(head);
    priorByUnit.set(head.payload.unit_id, values);
  }
  for (const values of priorByUnit.values()) values.sort((left, right) => left.payload.sequence - right.payload.sequence);
  const results = [];
  let cursor = 0;
  let calls = 0;
  let active = 0;
  let maximumActive = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      const index = cursor;
      cursor += 1;
      const invocation = queue[index];
      const unitId = invocation.payload.unit_id;
      const prior = priorByUnit.get(unitId) ?? [];
      const latest = prior.at(-1);
      const latestMatchesInput = latest?.payload.input_sha256 === invocation.content_sha256;
      const sameInputTerminals = prior.filter(
        (attempt) => attempt.payload.phase === "terminal" && attempt.payload.input_sha256 === invocation.content_sha256,
      );
      const sameInputTerminalCount = sameInputTerminals.length;
      if (latest?.payload.outcome === "success" && latest.payload.input_sha256 === invocation.content_sha256) {
        results.push({ attempts: [], outcome: "success", reused: true, unit_id: unitId });
        continue;
      }
      if (
        latest?.payload.phase === "dispatched" ||
        latest?.payload.outcome === "outcome_unknown" ||
        latest?.payload.call_certainty === "unknown"
      ) {
        results.push({ attempts: [], outcome: "outcome_unknown", reused: false, unit_id: unitId });
        continue;
      }
      if (latest?.payload.phase === "prepared" && latest.payload.input_sha256 !== invocation.content_sha256) {
        results.push({ attempts: [], outcome: "blocked", reused: false, unit_id: unitId });
        continue;
      }
      if (latestMatchesInput && latest?.payload.phase === "terminal" && latest.payload.outcome !== "error") {
        results.push({ attempts: [], outcome: latest.payload.outcome, reused: false, unit_id: unitId });
        continue;
      }
      if (latestMatchesInput && sameInputTerminalCount > 0) {
        const retrySource = sameInputTerminals.at(-1);
        if (retrySource.payload.outcome !== "error") {
          fail("ATTEMPT_RETRY_INVALID", "A prepared retry may follow only an exact classified terminal error.", 4);
        }
        const classification = durableState.journal.find(
          (event) => event.type === "attempt_retry_classified" && event.details.attempt_id === retrySource.payload.attempt_id,
        );
        if (!classification || classification.details.retryable !== true) {
          results.push({ attempts: [], outcome: "error", reused: false, unit_id: unitId });
          continue;
        }
        if (classification.details.retry_policy_sha256 !== retryPolicySha256) {
          fail("RETRY_POLICY_MISMATCH", "A durable retry requires the exact policy that classified its prior error.", 4);
        }
      }
      if (signal?.aborted) {
        results.push({ attempts: [], outcome: "blocked", reused: false, unit_id: unitId });
        continue;
      }
      const unitAttempts = [];
      const sequenceBase = latest?.payload.phase === "prepared" ? latest.payload.sequence - 1 : latest?.payload.sequence ?? 0;
      let finalOutcome = sameInputTerminalCount >= retryPolicy.max_attempts ? latest?.payload.outcome ?? "error" : "error";
      const request = sameInputTerminalCount < retryPolicy.max_attempts ? authorize(invocation) : null;
      for (let retryOrdinal = sameInputTerminalCount + 1; retryOrdinal <= retryPolicy.max_attempts; retryOrdinal += 1) {
        if (signal?.aborted) break;
        const resumePrepared = retryOrdinal === sameInputTerminalCount + 1 && latest?.payload.phase === "prepared";
        const sequence = sequenceBase + unitAttempts.length + 1;
        const attemptId = `${role}-${unitId}-controlled-${sequence}`;
        const startedAt = resumePrepared ? latest.payload.started_at : now();
        const common = {
          attempt_id: attemptId,
          input_sha256: invocation.content_sha256,
          role,
          run_id: run.artifact_id,
          sequence,
          started_at: startedAt,
          unit_id: unitId,
        };
        const links = attemptLinks(invocation, readiness, run);
        if (resumePrepared) {
          if (
            latest.payload.attempt_id !== attemptId ||
            !hasExactLink(latest, "compiled_invocation", invocation) ||
            !hasExactLink(latest, "readiness", readiness)
          ) {
            fail("ATTEMPT_RESUME_INVALID", "Prepared attempt does not match the current invocation and readiness.", 4);
          }
        } else {
          appendAttemptPhase(storeRoot, attemptArtifact(`${attemptId}-prepared`, links, { ...common, call_certainty: "not_started", finished_at: null, outcome: null, phase: "prepared" }), { leaseToken, now: startedAt });
        }
        assertControlledRequest(request, invocation, readiness);
        const dispatched = attemptArtifact(`${attemptId}-dispatched`, links, { ...common, call_certainty: "started", finished_at: null, outcome: null, phase: "dispatched" });
        appendAttemptPhase(storeRoot, dispatched, { leaseToken, now: startedAt });
        calls += 1;
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        const control = await invokeWithControl({
          adapter,
          context: {
            attempt_id: attemptId,
            grant_nonce: request.grant_nonce,
            invocation_sha256: request.invocation_sha256,
            retry_ordinal: retryOrdinal,
            sequence,
            timeout_phase: timeoutPhase,
            unit_id: unitId,
          },
          invocation: request.invocation,
          role,
          signal,
          timeoutMs,
          timeoutPhase,
        });
        active -= 1;
        if (control.control) {
          recordAttemptControl(storeRoot, {
            attempt: dispatched,
            control: control.control,
            leaseToken,
            now: now(),
            timeoutPhase: control.timeoutPhase,
          });
        }
        const terminal = attemptArtifact(`${attemptId}-terminal`, links, {
          ...common,
          call_certainty: control.certainty,
          finished_at: now(),
          outcome: control.outcome,
          phase: "terminal",
        });
        appendAttemptPhase(storeRoot, terminal, { leaseToken, now: terminal.payload.finished_at });
        if (control.outcome === "error") {
          recordAttemptRetryClassification(storeRoot, {
            attempt: terminal,
            leaseToken,
            now: terminal.payload.finished_at,
            retryClass: control.errorClass,
            retryPolicySha256,
            retryable: retryPolicy.retryable_classes.includes(control.errorClass),
          });
        }
        unitAttempts.push(terminal);
        finalOutcome = control.outcome;
        if (
          control.outcome !== "error" ||
          !retryPolicy.retryable_classes.includes(control.errorClass) ||
          retryOrdinal === retryPolicy.max_attempts
        ) break;
      }
      results.push({ attempts: unitAttempts, outcome: finalOutcome, reused: false, unit_id: unitId });
    }
  };
  const workerCount = Math.min(effectiveConcurrency, queue.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  results.sort((left, right) => compareStrings(left.unit_id, right.unit_id));
  const attempts = inspectRunState(storeRoot, run.artifact_id).attempts
    .map((record) => record.phases.terminal ?? record.phases.dispatched ?? record.phases.prepared)
    .filter((attempt) => attempt?.payload.role === role && selected.includes(attempt.payload.unit_id))
    .sort((left, right) =>
      compareStrings(left.payload.unit_id, right.payload.unit_id) || left.payload.sequence - right.payload.sequence,
    );
  const attemptedUnits = new Set(attempts.map((attempt) => attempt.payload.unit_id));
  return {
    attempts,
    blocked_unit_ids: results.filter((result) => result.outcome === "blocked").map((result) => result.unit_id),
    calls,
    effective_concurrency: effectiveConcurrency,
    maximum_active: maximumActive,
    newly_executed_unit_ids: selected.filter((unitId) => attemptedUnits.has(unitId)),
    outcomes: Object.fromEntries(results.map((result) => [result.unit_id, result.outcome])),
    resumed_unit_ids: results.filter((result) => result.reused).map((result) => result.unit_id),
    reused_unit_ids: selected.filter((unitId) => !attemptedUnits.has(unitId) && results.find((result) => result.unit_id === unitId)?.reused),
  };
}

function assertControlledRequest(request, invocation, readiness) {
  const grant = readiness.payload.grants.find((item) => item.unit_id === invocation.payload.unit_id);
  if (
    !request ||
    request.unit_id !== invocation.payload.unit_id ||
    request.invocation_sha256 !== invocation.content_sha256 ||
    request.grant_nonce !== grant?.nonce ||
    grant.invocation_sha256 !== invocation.content_sha256
  ) {
    fail("DISPATCH_GRANT_INVALID", "Controlled request changed after its stage authorization.", 4);
  }
}

function createControlledAuthorizer({ dispatchContext, invocations, readiness, role, run }) {
  if (!dispatchContext || typeof dispatchContext !== "object") {
    fail("DISPATCH_CONTEXT_INVALID", "Controlled dispatch requires its complete stage authority.", 4);
  }
  if (role === "reader") {
    if (dispatchContext.readinessSet?.reader?.content_sha256 !== readiness.content_sha256) {
      fail("DISPATCH_CONTEXT_INVALID", "Controlled reader readiness does not match its complete readiness set.", 4);
    }
    const guard = createDispatchGuard({
      adapterCapabilities: dispatchContext.adapterCapabilities,
      evaluatorStatic: dispatchContext.evaluatorStatic,
      readinessSet: dispatchContext.readinessSet,
      readerInvocations: invocations,
      run,
      supportingArtifacts: dispatchContext.supportingArtifacts ?? [],
      task: dispatchContext.task,
    });
    return (invocation) => {
      const grant = readiness.payload.grants.find((item) => item.unit_id === invocation.payload.unit_id);
      return guard.authorize(invocation, grant?.nonce);
    };
  }
  assertHarnessArtifact(dispatchContext.task, { artifactType: "task_manifest" });
  validateArtifactGraph([dispatchContext.task, run, ...invocations, readiness]);
  const consumed = new Set();
  return (invocation) => {
    const grant = readiness.payload.grants.find((item) => item.unit_id === invocation.payload.unit_id);
    const linked = hasExactLink(readiness, "compiled_invocation", invocation);
    if (
      !grant ||
      !linked ||
      consumed.has(grant.nonce) ||
      grant.single_use !== true ||
      grant.invocation_sha256 !== invocation.content_sha256
    ) {
      fail("DISPATCH_GRANT_INVALID", "Controlled evaluator grant is missing, stale, mismatched, or already consumed.", 4);
    }
    consumed.add(grant.nonce);
    return {
      grant_nonce: grant.nonce,
      invocation: structuredClone(invocation.payload),
      invocation_sha256: invocation.content_sha256,
      unit_id: invocation.payload.unit_id,
    };
  };
}

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
    const attemptId = durable.prepared?.payload.attempt_id ?? `reader-${unitId}-attempt-${sequence}`;
    const startedAt = durable.prepared?.payload.started_at ?? now();
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
    if (durable.prepared) {
      if (
        !hasExactLink(durable.prepared, "compiled_invocation", invocation) ||
        !hasExactLink(durable.prepared, "readiness", readinessSet.reader)
      ) {
        fail("ATTEMPT_RESUME_INVALID", "Prepared reader attempt does not match current dispatch authority.", 4);
      }
    } else {
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
    }
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
  const nextSequence = latest?.payload.phase === "prepared" ? latest.payload.sequence : (latest?.payload.sequence ?? 0) + 1;
  if (
    latest?.payload.phase === "dispatched" ||
    latest?.payload.outcome === "outcome_unknown" ||
    latest?.payload.call_certainty === "unknown"
  ) {
    return { nextSequence, status: "outcome_unknown" };
  }
  if (latest?.payload.phase === "prepared") {
    if (latest.payload.input_sha256 !== invocation.content_sha256) return { nextSequence, status: "blocked_evidence" };
    return { nextSequence, prepared: latest, status: "incomplete" };
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

async function invokeWithControl({ adapter, context, invocation, role, signal, timeoutMs, timeoutPhase }) {
  const method = role === "reader" ? "invokeReader" : "invokeEvaluator";
  const call = Promise.resolve()
    .then(() => adapter[method](structuredClone(invocation), context))
    .then(
      (value) => ({ kind: "result", value }),
      (error) => ({ error, kind: "error" }),
    );
  let timer = null;
  let removeAbort = null;
  const races = [call];
  if (timeoutMs !== null) {
    races.push(new Promise((resolveValue) => {
      timer = setTimeout(() => resolveValue({ kind: "timeout" }), timeoutMs);
    }));
  }
  if (signal) {
    races.push(new Promise((resolveValue) => {
      const abort = () => resolveValue({ kind: "cancel" });
      if (signal.aborted) abort();
      else {
        signal.addEventListener("abort", abort, { once: true });
        removeAbort = () => signal.removeEventListener("abort", abort);
      }
    }));
  }
  const winner = await Promise.race(races);
  if (timer !== null) clearTimeout(timer);
  removeAbort?.();
  if (winner.kind === "result") {
    if (winner.value?.outcome === "success") {
      return { certainty: "confirmed_finished", errorClass: null, outcome: "success" };
    }
    if (
      winner.value?.outcome === "error" &&
      typeof winner.value.retryClass === "string" &&
      /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(winner.value.retryClass)
    ) {
      return { certainty: "confirmed_finished", errorClass: winner.value.retryClass, outcome: "error" };
    }
    return { certainty: "confirmed_finished", errorClass: "semantic_invalid", outcome: "error" };
  }
  if (winner.kind === "error") {
    return { certainty: "confirmed_finished", errorClass: winner.error?.retryClass ?? "unknown", outcome: "error" };
  }
  const control = winner.kind === "cancel" ? "cancel_requested" : "timeout_requested";
  let confirmed = false;
  if (typeof adapter.cancel === "function") {
    try {
      confirmed = (await adapter.cancel(context, control))?.confirmed === true;
    } catch {
      confirmed = false;
    }
  }
  return confirmed
    ? {
        certainty: "confirmed_finished",
        control,
        errorClass: null,
        outcome: winner.kind === "cancel" ? "cancelled" : "timeout",
        timeoutPhase: winner.kind === "timeout" ? timeoutPhase : null,
      }
    : {
        certainty: "unknown",
        control,
        errorClass: null,
        outcome: "outcome_unknown",
        timeoutPhase: winner.kind === "timeout" ? timeoutPhase : null,
      };
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
