import { canonicalJson, canonicalJsonLine, sha256Bytes, sha256Canonical } from "./artifact-schema-v1.mjs";
import {
  HarnessError,
  assertRuntimeControlPlaneEvent,
  assertRuntimeCredentialFree,
  assertHarnessArtifact,
  createHarnessArtifact,
  deriveCodexAppServerInput,
  deriveRuntimeDispatchSemanticProjection,
  parseHarnessJson,
  renderCodexAppServerInput,
  validateArtifactGraph,
} from "./harness-schema-v2.mjs";
import {
  appendRuntimeEvent,
  loadRunManifest,
  publishRuntimeSnapshot,
  readArtifactObject,
  readRuntimeSnapshot,
  recordRuntimeJournalEvent,
  reserveLiveDispatchCall,
  validateRuntimeIndex,
} from "./run-store-v2.mjs";
import {
  behaviorRuntimeProjectionSha256,
  deriveBehaviorRuntimeProjection,
} from "./runtime-identity-v2.mjs";

export const codexChatGptAppServerAdapterId = "codex_chatgpt_app_server";
export const codexChatGptAppServerAssuranceProfile = "runtime_mediated";

const opaqueLimitations = Object.freeze([
  "complete-model-visible-envelope-opaque",
  "provider-request-identity-opaque",
  "provider-side-idempotency-opaque",
  "upstream-provider-envelope-opaque",
]);

export function createCodexChatGptAppServerAdapter({
  adapterVersion = "2",
  faultAt = null,
  liveAuthorityVerifier = null,
  now = () => new Date().toISOString(),
  outputSchemas,
  transport,
}) {
  assertTransport(transport);
  assertOutputSchemas(outputSchemas);
  const pending = new Map();

  const invoke = async (role, request, context) => {
    let turnWriteIntentPersisted = false;
    try {
      const execution = assertExecutionContext(role, request, context, transport);
    const {
      attempt,
      invocation,
      leaseToken,
      markDispatched,
      readiness,
      run,
      storeRoot,
    } = execution;
    const activeState = {
      aborted: false,
      attempt,
      dispatchRequest: null,
      dispatched: null,
      eventTypes: new Set(),
      leaseToken,
      run,
      stage: "connect",
      storeRoot,
      threadId: null,
      threadOutcomeRecorded: false,
      threadRequest: null,
      turnId: null,
      turnWriteIntent: false,
    };
    pending.set(attempt.payload.attempt_id, activeState);
    const liveAuthority = assertRuntimeAuthorization(
      run,
      role,
      transport.kind,
      execution.liveDispatchGrant,
      liveAuthorityVerifier,
    );
    const inspection = sanitizeInspection(await transport.inspectRuntime());
    assertActiveExecution(activeState);
    assertRuntimeMatchesInvocation({ adapterVersion, inspection, invocation, transport });

    const threadRequest = createThreadStartRequest({ attempt, inspection, invocation });
    assertCredentialFree(threadRequest);
    const threadRequestJson = canonicalJsonLine(threadRequest);
    const threadRequestSha256 = sha256Bytes(Buffer.from(threadRequestJson, "utf8"));
    recordRuntimeJournalEvent(storeRoot, {
      attempt,
      event: "thread_start_write_intent",
      leaseToken,
      now: now(),
      requestId: threadRequest.id,
      requestJson: threadRequestJson,
      requestSha256: threadRequestSha256,
      status: "intent",
    });
    activeState.threadRequest = { id: threadRequest.id, sha256: threadRequestSha256 };
    activeState.stage = "thread_start";

    let thread;
    try {
      thread = assertThreadStartResult(
        await transport.startThread({ requestBytes: Buffer.from(threadRequestJson, "utf8") }),
        threadRequest.id,
      );
      assertActiveExecution(activeState);
    } catch (error) {
      if (!activeState.threadOutcomeRecorded) {
        recordRuntimeJournalEvent(storeRoot, {
          attempt,
          event: "thread_start_outcome_unknown",
          leaseToken,
          now: now(),
          requestId: threadRequest.id,
          requestSha256: threadRequestSha256,
          status: "unknown",
        });
        activeState.threadOutcomeRecorded = true;
      }
      throw runtimeFailure("APP_SERVER_THREAD_OUTCOME_UNKNOWN", "Fresh App Server thread outcome is unknown.", {
        callCertainty: "confirmed_not_started",
        cause: error,
        retryClass: "thread_outcome_unknown",
        shadowThreadOutcomeUnknown: true,
      });
    }
    recordRuntimeJournalEvent(storeRoot, {
      attempt,
      event: "thread_start_acknowledged",
      leaseToken,
      now: now(),
      requestId: threadRequest.id,
      requestSha256: threadRequestSha256,
      sessionId: thread.session_id,
      status: "acknowledged",
      threadId: thread.thread_id,
    });
    activeState.stage = "predispatch";
    activeState.threadId = thread.thread_id;
    if (canonicalJson(thread.instruction_sources) !== canonicalJson(inspection.instruction_sources)) {
      throw runtimeFailure("APP_SERVER_INSTRUCTION_SOURCE_MISMATCH", "Fresh thread instruction sources do not match runtime inspection.", {
        callCertainty: "confirmed_not_started",
        retryClass: "instruction_source_mismatch",
      });
    }

    const outputSchemaName = invocation.payload.protocol.output_schema;
    const outputSchema = structuredClone(outputSchemas[outputSchemaName]);
    const attestation = createRuntimeAttestation({
      adapterVersion,
      attempt,
      inspection,
      invocation,
      outputSchema,
      outputSchemaName,
      readiness,
      run,
      thread,
      transport,
    });
    const input = compileAppServerInput(invocation.payload);
    const inputText = renderHumanReadableInput(input);
    const turnRequest = createTurnStartRequest({ attempt, inspection, input, invocation, outputSchema, thread });
    const requestJson = canonicalJsonLine(turnRequest);
    assertCredentialFree(turnRequest);
    const dispatchRequest = createRuntimeDispatchRequest({
      attempt,
      attestation,
      inputText,
      invocation,
      readiness,
      request: turnRequest,
      requestJson,
      requestEnvelope: request,
      run,
    });
    validateRuntimeGraph([...context.runtime.graphArtifacts, attempt], [attestation, dispatchRequest]);
    publishRuntimeSnapshot(storeRoot, {
      attempt,
      attestation,
      dispatchRequest,
      inputText,
      faultAt,
      leaseToken,
      now: now(),
    });
    recheckBeforeDispatch({
      attempt,
      attestation,
      dispatchRequest,
      inputText,
      invocation,
      readiness,
      run,
      storeRoot,
    });
    const secondInspection = sanitizeInspection(await transport.inspectRuntime());
    assertActiveExecution(activeState);
    if (
      behaviorRuntimeProjectionSha256(
        concreteBehaviorRuntimeProjection({ adapterVersion, inspection: secondInspection, transport }),
      ) !==
      behaviorRuntimeProjectionSha256(
        concreteBehaviorRuntimeProjection({ adapterVersion, inspection, transport }),
      )
    ) {
      throw runtimeFailure("APP_SERVER_RUNTIME_DRIFT", "App Server runtime identity changed after snapshot publication.", {
        callCertainty: "confirmed_not_started",
        retryClass: "runtime_drift",
      });
    }
    recheckBeforeDispatch({
      attempt,
      attestation,
      dispatchRequest,
      inputText,
      invocation,
      readiness,
      run,
      storeRoot,
    });

    if (liveAuthority !== null) {
      const revalidated = assertOwnerIssuedLiveGrant({
        grant: execution.liveDispatchGrant,
        liveAuthorityVerifier,
        role,
        run,
      });
      if (revalidated.grantSha256 !== liveAuthority.grantSha256) {
        fail("APP_SERVER_AUTHORITY_INVALID", "Owner-issued live dispatch grant changed before reservation.", 4);
      }
      reserveLiveDispatchCall(storeRoot, {
        attempt,
        grantSha256: revalidated.grantSha256,
        leaseToken,
        limits: revalidated.limits,
        now: now(),
        role,
      });
    }

    const dispatched = markDispatched();
    assertHarnessArtifact(dispatched, { artifactType: "execution_attempt" });
    if (
      dispatched.payload.phase !== "dispatched" ||
      dispatched.payload.attempt_id !== attempt.payload.attempt_id ||
      dispatched.payload.call_certainty !== "unknown"
    ) {
      throw runtimeFailure("APP_SERVER_DISPATCH_PHASE_INVALID", "Runtime dispatch callback returned the wrong attempt phase.", {
        callCertainty: "confirmed_not_started",
        retryClass: "runtime_contract_invalid",
      });
    }
    recordRuntimeJournalEvent(storeRoot, {
      attempt: dispatched,
      event: "turn_start_write_intent",
      leaseToken,
      now: now(),
      requestId: turnRequest.id,
      requestSha256: dispatchRequest.payload.wire_request_sha256,
      status: "intent",
      threadId: thread.thread_id,
    });
    const intentEvent = runtimeEvent({
      attempt: dispatched,
      dispatchRequest,
      eventBytes: null,
      eventType: "turn_start_write_intent",
      now: now(),
      run,
      status: "intent",
      turnId: null,
    });
    appendRuntimeEvent(storeRoot, {
      event: intentEvent,
      faultAt,
      leaseToken,
      now: intentEvent.payload.occurred_at,
    });
    turnWriteIntentPersisted = true;
    Object.assign(activeState, {
      dispatchRequest,
      dispatched,
      eventTypes: new Set(["turn_start_write_intent"]),
      stage: "turn",
      turnWriteIntent: true,
    });
    let turn;
    try {
      validateRuntimeIndex(storeRoot, run.artifact_id);
      turn = assertTurnResult(
        await transport.startTurn({
          onEvent: (transportEvent) => persistTransportEvent(pending, attempt.payload.attempt_id, transportEvent, now),
          requestBytes: Buffer.from(requestJson, "utf8"),
        }),
        turnRequest,
        requestJson,
      );
    } catch (error) {
      const resolution = await conservativeLookup(transport, thread.thread_id, turnRequest.id);
      const terminalRecorded = pending.get(attempt.payload.attempt_id)?.eventTypes.has("turn_completed") === true;
      const callCertainty = terminalRecorded || resolution.status === "completed"
        ? "confirmed_finished"
        : resolution.status === "not_started"
          ? "confirmed_not_started"
          : "unknown";
      const lookup = runtimeEvent({
        attempt: dispatched,
        dispatchRequest,
        eventBytes: resolution.eventBytes,
        eventType: "turn_lookup_result",
        now: now(),
        run,
        status: ["completed", "not_started"].includes(resolution.status) ? "completed" : "unknown",
        turnId: resolution.turn_id,
      });
      appendRuntimeEvent(storeRoot, { event: lookup, leaseToken, now: lookup.payload.occurred_at });
      const event = runtimeEvent({
        attempt: dispatched,
        dispatchRequest,
        eventBytes: optionalInboundEventBytes(error?.event_bytes, "transport error"),
        eventType: "transport_error",
        now: now(),
        run,
        status: callCertainty === "unknown" ? "unknown" : "error",
        turnId: resolution.turn_id,
      });
      appendRuntimeEvent(storeRoot, { event, leaseToken, now: event.payload.occurred_at });
      pending.delete(attempt.payload.attempt_id);
      throw runtimeFailure("APP_SERVER_TURN_OUTCOME_UNKNOWN", "App Server turn outcome is not safely reusable.", {
        callCertainty,
        cause: error,
        retryClass:
          callCertainty === "confirmed_finished"
            ? "transport_finished_without_output"
            : callCertainty === "confirmed_not_started"
              ? "transport_not_started"
              : "outcome_unknown",
      });
    }

    const active = pending.get(attempt.payload.attempt_id);
    active.turnId = turn.turn_id;
    for (const transportEvent of [
      { event_bytes: turn.write_event_bytes, event_type: "turn_start_write_completed", status: "written", turn_id: turn.turn_id },
      { event_bytes: turn.ack_event_bytes, event_type: "turn_start_acknowledged", status: "acknowledged", turn_id: turn.turn_id },
      { event_bytes: turn.completed_event_bytes, event_type: "turn_completed", status: "completed", turn_id: turn.turn_id },
    ]) {
      if (!active.eventTypes.has(transportEvent.event_type)) {
        persistTransportEvent(pending, attempt.payload.attempt_id, transportEvent, now);
      }
    }
    pending.delete(attempt.payload.attempt_id);
    return structuredClone(turn.output);
    } catch (error) {
      pending.delete(context?.runtime?.attempt?.payload?.attempt_id);
      if (["confirmed_not_started", "unknown", "confirmed_finished"].includes(error?.callCertainty)) throw error;
      throw runtimeFailure(
        turnWriteIntentPersisted ? "APP_SERVER_OUTCOME_UNKNOWN" : "APP_SERVER_CONFIRMED_NOT_STARTED",
        turnWriteIntentPersisted
          ? "App Server dispatch failed after durable turn write intent."
          : "App Server dispatch failed before durable turn write intent.",
        {
          callCertainty: turnWriteIntentPersisted ? "unknown" : "confirmed_not_started",
          cause: error,
          retryClass: turnWriteIntentPersisted ? "outcome_unknown" : "pre_dispatch_failure",
        },
      );
    }
  };

  return Object.freeze({
    assurance_profile: codexChatGptAppServerAssuranceProfile,
    capabilities: createCodexChatGptAppServerCapabilities(),
    cancel: async (context, control) => {
      const active = pending.get(context.attempt_id);
      if (!active || !["cancel_requested", "timeout_requested"].includes(control)) return { confirmed: false };
      if (!active.turnWriteIntent) {
        let stopped;
        try {
          stopped = await transport.abortAttempt({
            attemptId: context.attempt_id,
            control,
            threadId: active.threadId,
          });
        } catch {
          return { confirmed: false };
        }
        if (stopped?.confirmed_not_started !== true) return { confirmed: false };
        active.aborted = true;
        if (active.stage === "thread_start" && active.threadRequest && !active.threadOutcomeRecorded) {
          recordRuntimeJournalEvent(active.storeRoot, {
            attempt: active.attempt,
            event: "thread_start_outcome_unknown",
            leaseToken: active.leaseToken,
            now: now(),
            requestId: active.threadRequest.id,
            requestSha256: active.threadRequest.sha256,
            status: "unknown",
          });
          active.threadOutcomeRecorded = true;
        }
        pending.delete(context.attempt_id);
        return { callCertainty: "confirmed_not_started", confirmed: true };
      }
      if (!active.turnId) return { confirmed: false };
      const request = {
        id: `interrupt-${context.attempt_id}`,
        jsonrpc: "2.0",
        method: "turn/interrupt",
        params: { threadId: active.threadId, turnId: active.turnId },
      };
      assertCredentialFree(request);
      const requestJson = canonicalJsonLine(request);
      const requested = runtimeEvent({
        attempt: active.dispatched,
        controlRequestId: request.id,
        dispatchRequest: active.dispatchRequest,
        eventBytes: Buffer.from(requestJson, "utf8"),
        eventType: "turn_interrupt_requested",
        now: now(),
        run: active.run,
        status: "requested",
        turnId: active.turnId,
      });
      appendRuntimeEvent(active.storeRoot, { event: requested, leaseToken: active.leaseToken, now: requested.payload.occurred_at });
      let result;
      try {
        result = await transport.interruptTurn({ requestBytes: Buffer.from(requestJson, "utf8") });
      } catch (error) {
        const unknown = runtimeEvent({
          attempt: active.dispatched,
          controlRequestId: request.id,
          dispatchRequest: active.dispatchRequest,
          eventBytes: optionalInboundEventBytes(error?.event_bytes, "interrupt error"),
          eventType: "turn_interrupt_acknowledged",
          now: now(),
          run: active.run,
          status: "unknown",
          turnId: active.turnId,
        });
        appendRuntimeEvent(active.storeRoot, { event: unknown, leaseToken: active.leaseToken, now: unknown.payload.occurred_at });
        return { confirmed: false };
      }
      const acknowledged = runtimeEvent({
        attempt: active.dispatched,
        controlRequestId: request.id,
        dispatchRequest: active.dispatchRequest,
        eventBytes: requireInboundEventBytes(result?.ack_event_bytes, "turn/interrupt acknowledgement"),
        eventType: "turn_interrupt_acknowledged",
        now: now(),
        run: active.run,
        status: result?.accepted === true ? "accepted" : "unknown",
        turnId: active.turnId,
      });
      appendRuntimeEvent(active.storeRoot, {
        event: acknowledged,
        leaseToken: active.leaseToken,
        now: acknowledged.payload.occurred_at,
      });
      if (result?.terminal_status === "interrupted" && result?.terminal_event_bytes) {
        persistTransportEvent(
          pending,
          context.attempt_id,
          { event_bytes: result.terminal_event_bytes, event_type: "turn_completed", status: "completed", turn_id: active.turnId },
          now,
        );
        return { callCertainty: "confirmed_finished", confirmed: true };
      }
      return { confirmed: false };
    },
    invokeEvaluator: (request, context) => invoke("evaluator", request, context),
    invokeReader: (request, context) => invoke("reader", request, context),
    invokeVerificationHelper: (request, context) => invoke("verification_helper", request, context),
    kind: codexChatGptAppServerAdapterId,
    validateReuse: (context) => validateSameRunReuse({ ...context, adapterVersion, transport }),
  });
}

export function createCodexChatGptAppServerCapabilities() {
  return {
    adapter_id: codexChatGptAppServerAdapterId,
    exposes: {
      model_visible_policy: true,
      observation_protocol: true,
      supplied_resources: true,
      tool_allowlist: true,
    },
    output_schemas: ["evaluator-proposal-v2", "observation-v2", "verification-helper-v2"],
    policy: {
      credentials: ["excluded"],
      filesystem: ["none", "read_only", "write"],
      fresh_context: true,
      mutation: ["allowed", "denied"],
      network: ["denied", "required"],
      remote_actions: ["allowed", "denied"],
    },
    roles: ["evaluator", "reader", "verification_helper"],
    runtime_classes: ["codex-app-server"],
  };
}

export function classifyCodexChatGptAppServerReuse({ sourceRunId, targetRunId }) {
  assertNormalizedIdentity(sourceRunId, "sourceRunId");
  assertNormalizedIdentity(targetRunId, "targetRunId");
  return sourceRunId === targetRunId
    ? { classification: "unaffected", reason: "same-run exact runtime lineage remains eligible for validation" }
    : { classification: "unknown", reason: "opaque provider-envelope equivalence is not certified across runs" };
}

async function validateSameRunReuse({ adapterVersion, attempt, evidence, invocation, readiness, run, storeRoot, transport }) {
  assertHarnessArtifact(attempt, { artifactType: "execution_attempt" });
  assertHarnessArtifact(invocation, { artifactType: "compiled_invocation" });
  assertHarnessArtifact(readiness, { artifactType: "readiness_analysis" });
  assertHarnessArtifact(run, { artifactType: "run_manifest" });
  if (
    attempt.payload.phase !== "terminal" ||
    attempt.payload.outcome !== "success" ||
    attempt.payload.call_certainty !== "confirmed_finished" ||
    attempt.payload.run_id !== run.artifact_id ||
    invocation.payload.run_id !== run.artifact_id ||
    readiness.payload.run_id !== run.artifact_id ||
    !Array.isArray(evidence) ||
    evidence.length === 0
  ) {
    fail("APP_SERVER_REUSE_INVALID", "Same-run reuse requires exact successful terminal evidence and current authority.", 4);
  }
  const view = readRuntimeSnapshot(storeRoot, run.artifact_id, attempt.payload.attempt_id);
  const expectedEvidence = evidence
    .map((artifact) => {
      const value = assertHarnessArtifact(artifact);
      return { artifact_id: value.artifact_id, artifact_type: value.artifact_type, content_sha256: value.content_sha256 };
    })
    .sort(compareEvidenceBindings);
  if (
    view.result?.status !== "success" ||
    canonicalJson(view.result.evidence) !== canonicalJson(expectedEvidence) ||
    !view.events.some((event) => event.event_type === "turn_completed" && event.status === "completed")
  ) {
    fail("APP_SERVER_REUSE_INVALID", "Same-run reuse runtime result, terminal event, or evidence binding is incomplete.", 4);
  }
  const roots = [
    attempt,
    ...evidence,
    readArtifactObject(storeRoot, view.snapshot.runtime_attestation_sha256),
    readArtifactObject(storeRoot, view.snapshot.runtime_dispatch_request_sha256),
    ...view.events.map((event) => readArtifactObject(storeRoot, event.content_sha256)),
  ];
  const closure = collectArtifactClosure(storeRoot, roots);
  validateArtifactGraph(closure);
  const linkedRun = closure.find(
    (artifact) => artifact.artifact_type === "run_manifest" && artifact.artifact_id === run.artifact_id,
  );
  const linkedInvocation = closure.find(
    (artifact) => artifact.artifact_type === "compiled_invocation" && artifact.artifact_id === invocation.artifact_id,
  );
  const linkedReadiness = closure.find(
    (artifact) => artifact.artifact_type === "readiness_analysis" && artifact.artifact_id === readiness.artifact_id,
  );
  if (
    !linkedRun ||
    !linkedInvocation ||
    !linkedReadiness ||
    linkedInvocation.content_sha256 !== invocation.content_sha256 ||
    linkedReadiness.content_sha256 !== readiness.content_sha256 ||
    linkedRun.payload.adapter_id !== run.payload.adapter_id ||
    linkedRun.payload.runtime_config_sha256 !== run.payload.runtime_config_sha256 ||
    sha256Canonical(linkedRun.payload.intent) !== sha256Canonical(run.payload.intent)
  ) {
    fail("APP_SERVER_REUSE_INVALID", "Same-run reuse is detached from current invocation/readiness/runtime intent.", 4);
  }
  const historicalAttestation = roots.find((artifact) => artifact.artifact_type === "runtime_attestation");
  const currentInspection = sanitizeInspection(await transport.inspectRuntime());
  const currentLimitations = [
    ...opaqueLimitations,
    ...(typeof transport.lookupTurn === "function" ? [] : ["turn-outcome-lookup-unsupported"]),
  ].sort();
  if (
    !historicalAttestation ||
    historicalAttestation.payload.adapter_version !== adapterVersion ||
    canonicalJson(historicalAttestation.payload.capability_limitations) !== canonicalJson(currentLimitations) ||
    behaviorRuntimeProjectionSha256(
      concreteBehaviorRuntimeProjection({ adapterVersion, inspection: currentInspection, transport }),
    ) !== historicalAttestation.payload.behavior_runtime_sha256
  ) {
    return {
      classification: invocation.payload.role === "evaluator" ? "evaluator_affected" : "reader_affected",
      reason: "current concrete runtime/config/instruction-source fingerprint drifted from the completed attempt",
    };
  }
  validateRuntimeIndex(storeRoot, run.artifact_id);
  return { classification: "unaffected", reason: "same-run runtime and representation lineage remains exact" };
}

function collectArtifactClosure(storeRoot, roots) {
  const closure = new Map();
  const pendingArtifacts = [...roots];
  while (pendingArtifacts.length > 0) {
    const artifact = assertHarnessArtifact(pendingArtifacts.pop());
    const key = `${artifact.artifact_type}:${artifact.artifact_id}`;
    const prior = closure.get(key);
    if (prior && prior.content_sha256 !== artifact.content_sha256) {
      fail("APP_SERVER_REUSE_INVALID", "Runtime reuse closure contains conflicting artifact identity.", 4);
    }
    if (prior) continue;
    closure.set(key, artifact);
    for (const linkValue of artifact.links) {
      pendingArtifacts.push(readArtifactObject(storeRoot, linkValue.target_content_sha256));
    }
  }
  return [...closure.values()];
}

function compareEvidenceBindings(left, right) {
  return `${left.artifact_type}:${left.artifact_id}`.localeCompare(`${right.artifact_type}:${right.artifact_id}`);
}

export function compileAppServerInput(invocation) {
  return deriveCodexAppServerInput(invocation);
}

export function renderHumanReadableInput(items) {
  return renderCodexAppServerInput(items);
}

function assertExecutionContext(role, request, context, transport) {
  if (!request || typeof request !== "object" || !context?.runtime) {
    fail("APP_SERVER_CONTEXT_INVALID", "Concrete adapter requires its exact runtime dispatch context.", 4);
  }
  const runtime = context.runtime;
  if (canonicalJson(Object.keys(request).sort()) !== canonicalJson(["grant_nonce", "invocation_sha256", "unit_id"])) {
    fail("APP_SERVER_CONTEXT_INVALID", "Concrete adapter request envelope contains unexpected fields.", 4);
  }
  for (const field of ["attempt", "invocation", "run"]) assertHarnessArtifact(runtime[field]);
  assertHarnessArtifact(runtime.attempt, { artifactType: "execution_attempt" });
  assertHarnessArtifact(runtime.invocation, { artifactType: "compiled_invocation" });
  if (role === "verification_helper") {
    if (runtime.readiness !== null || typeof runtime.helperInputHash !== "string") {
      fail("APP_SERVER_CONTEXT_INVALID", "Verification helper runtime requires its exact helper input hash and no readiness dependency.", 4);
    }
  } else {
    assertHarnessArtifact(runtime.readiness, { artifactType: "readiness_analysis" });
  }
  assertHarnessArtifact(runtime.run, { artifactType: "run_manifest" });
  if (
    runtime.attempt.payload.phase !== "prepared" ||
    runtime.attempt.payload.role !== role ||
    runtime.invocation.payload.role !== role ||
    runtime.run.payload.adapter_id !== codexChatGptAppServerAdapterId ||
    runtime.attempt.payload.run_id !== runtime.run.artifact_id ||
    runtime.invocation.payload.run_id !== runtime.run.artifact_id ||
    (role !== "verification_helper" && runtime.readiness.payload.run_id !== runtime.run.artifact_id) ||
    request.invocation_sha256 !== runtime.invocation.content_sha256 ||
    (role === "verification_helper"
      ? request.grant_nonce !== runtime.attempt.payload.input_sha256
      : request.invocation_sha256 !== runtime.attempt.payload.input_sha256) ||
    (role === "verification_helper" ? request.unit_id !== null : request.unit_id !== runtime.invocation.payload.unit_id) ||
    (role === "verification_helper"
      ? request.grant_nonce !== runtime.helperInputHash
      : request.grant_nonce !== runtime.readiness.payload.grants.find((grant) => grant.unit_id === request.unit_id)?.nonce) ||
    typeof runtime.storeRoot !== "string" ||
    typeof runtime.leaseToken !== "string" ||
    typeof runtime.markDispatched !== "function"
  ) {
    fail("APP_SERVER_CONTEXT_INVALID", "Concrete adapter context does not match its exact run/attempt/invocation/grant lineage.", 4);
  }
  if (!Array.isArray(runtime.graphArtifacts)) fail("APP_SERVER_CONTEXT_INVALID", "Runtime graph artifacts are required.", 4);
  validateRuntimeGraph(runtime.graphArtifacts, [runtime.attempt]);
  if (transport.kind === "mock_codex_app_server" && runtime.run.payload.intent?.authority_record?.live_model_calls !== false) {
    fail("APP_SERVER_AUTHORITY_INVALID", "Mock transport requires a no-live-call run intent.", 4);
  }
  return runtime;
}

function assertRuntimeAuthorization(run, role, transportKind, liveDispatchGrant, liveAuthorityVerifier) {
  const intent = run.payload.intent;
  if (
    !intent ||
    intent.assurance_profile !== codexChatGptAppServerAssuranceProfile ||
    intent.authentication_boundary !== "chatgpt_subscription" ||
    !intent.authority_record.authorized_roles.includes(role)
  ) {
    fail("APP_SERVER_AUTHORITY_INVALID", "Run intent does not authorize this runtime role/profile/auth boundary.", 4);
  }
  assertCredentialFree(intent);
  if (transportKind === "mock_codex_app_server") return null;
  if (!intent.authority_record.live_model_calls) {
    fail("APP_SERVER_AUTHORITY_INVALID", "A live App Server transport requires separate live-call authority.", 4);
  }
  return assertOwnerIssuedLiveGrant({ grant: liveDispatchGrant, liveAuthorityVerifier, role, run });
}

function assertOwnerIssuedLiveGrant({ grant, liveAuthorityVerifier, role, run }) {
  const expectedKeys = [
    "assurance_profile",
    "authentication_boundary",
    "authorized_roles",
    "grant_id",
    "issued_at",
    "issuer",
    "live_call_limits",
    "run_id",
    "runtime_config_sha256",
    "task_id",
  ];
  if (
    !grant ||
    typeof grant !== "object" ||
    Array.isArray(grant) ||
    canonicalJson(Object.keys(grant).sort()) !== canonicalJson(expectedKeys) ||
    typeof liveAuthorityVerifier !== "function"
  ) {
    fail("APP_SERVER_AUTHORITY_INVALID", "Live dispatch requires an independent owner-issued grant and verifier.", 4);
  }
  assertCredentialFree(grant);
  assertNormalizedIdentity(grant.grant_id, "live dispatch grant_id");
  assertNormalizedIdentity(grant.issuer, "live dispatch issuer");
  if (Number.isNaN(Date.parse(grant.issued_at)) || new Date(grant.issued_at).toISOString() !== grant.issued_at) {
    fail("APP_SERVER_AUTHORITY_INVALID", "Live dispatch grant issued_at must be an exact timestamp.", 4);
  }
  const intentAuthority = run.payload.intent.authority_record;
  if (
    grant.assurance_profile !== codexChatGptAppServerAssuranceProfile ||
    grant.authentication_boundary !== "chatgpt_subscription" ||
    grant.run_id !== run.artifact_id ||
    grant.task_id !== run.payload.task_id ||
    grant.runtime_config_sha256 !== run.payload.runtime_config_sha256 ||
    canonicalJson(grant.authorized_roles) !== canonicalJson(intentAuthority.authorized_roles) ||
    canonicalJson(grant.live_call_limits) !== canonicalJson(intentAuthority.live_call_limits) ||
    !grant.authorized_roles.includes(role) ||
    liveAuthorityVerifier(structuredClone(grant), { role, run: structuredClone(run) }) !== true
  ) {
    fail("APP_SERVER_AUTHORITY_INVALID", "Owner-issued live dispatch grant does not match current external authority/run scope.", 4);
  }
  return { grantSha256: sha256Canonical(grant), limits: structuredClone(grant.live_call_limits) };
}

function sanitizeInspection(value) {
  if (!value || typeof value !== "object") fail("APP_SERVER_ATTESTATION_INVALID", "Runtime inspection is missing.", 4);
  const instructionSources = [...(value.instructionSources ?? [])]
    .map((source) => ({ path: normalizeRuntimePath(source.path), sha256: source.sha256 }))
    .sort((left, right) => left.path.localeCompare(right.path));
  const inspection = {
    auth_mode: value.authMode,
    codex_version: value.codexVersion,
    config_sha256: value.configSha256,
    effective_policy: structuredClone(value.effectivePolicy),
    effort: value.effort,
    executable_path: normalizeRuntimePath(value.executablePath),
    executable_sha256: value.executableSha256,
    instruction_sources: instructionSources,
    model: value.model,
    platform: value.platform,
    protocol_schema_sha256: value.protocolSchemaSha256,
    runtime_identity: value.runtimeIdentity,
  };
  if (inspection.auth_mode !== "chatgpt") {
    fail("APP_SERVER_AUTH_MODE_FORBIDDEN", "Concrete adapter accepts only ChatGPT-managed authentication.", 4);
  }
  assertHashFields(inspection, ["config_sha256", "executable_sha256", "protocol_schema_sha256"]);
  for (const source of inspection.instruction_sources) assertHashFields(source, ["sha256"]);
  assertCredentialFree(inspection);
  return inspection;
}

function assertRuntimeMatchesInvocation({ adapterVersion, inspection, invocation, transport }) {
  const actual = concreteBehaviorRuntimeProjection({ adapterVersion, inspection, transport });
  if (canonicalJson(actual) !== canonicalJson(invocation.payload.runtime.behavior_runtime)) {
    fail(
      "APP_SERVER_RUNTIME_MISMATCH",
      "Concrete behavior runtime does not match the immutable compiled invocation identity.",
      4,
    );
  }
}

function createThreadStartRequest({ attempt, inspection, invocation }) {
  return {
    id: `thread-${attempt.payload.attempt_id}`,
    jsonrpc: "2.0",
    method: "thread/start",
    params: {
      approvalPolicy: invocation.payload.runtime.parameters.approval_policy,
      cwd: invocation.payload.runtime.parameters.cwd,
      ephemeral: false,
      model: inspection.model,
      sandboxPolicy: invocation.payload.runtime.parameters.sandbox_policy,
      settings: structuredClone(invocation.payload.runtime.parameters.settings ?? {}),
    },
  };
}

function createTurnStartRequest({ attempt, inspection, input, invocation, outputSchema, thread }) {
  return {
    id: `turn-${attempt.payload.attempt_id}`,
    jsonrpc: "2.0",
    method: "turn/start",
    params: {
      approvalPolicy: invocation.payload.runtime.parameters.approval_policy,
      cwd: invocation.payload.runtime.parameters.cwd,
      effort: inspection.effort,
      input,
      model: inspection.model,
      outputSchema,
      sandboxPolicy: invocation.payload.runtime.parameters.sandbox_policy,
      settings: structuredClone(invocation.payload.runtime.parameters.settings ?? {}),
      threadId: thread.thread_id,
    },
  };
}

function createRuntimeAttestation({ adapterVersion, attempt, inspection, invocation, outputSchema, outputSchemaName, readiness, run, thread, transport }) {
  const behaviorRuntime = concreteBehaviorRuntimeProjection({ adapterVersion, inspection, transport });
  const links = [
    link("compiled_invocation", invocation),
    link("execution_attempt", attempt),
    link("run", run),
  ];
  if (readiness) links.push(link("readiness", readiness));
  return createHarnessArtifact({
    artifactType: "runtime_attestation",
    artifactId: `runtime-attestation-${attempt.payload.attempt_id}`,
    producer: producer(),
    links: links.sort(compareLinks),
    payload: {
      adapter_id: codexChatGptAppServerAdapterId,
      adapter_version: adapterVersion,
      assurance_profile: codexChatGptAppServerAssuranceProfile,
      attempt_id: attempt.payload.attempt_id,
      auth_mode: inspection.auth_mode,
      behavior_runtime_sha256: behaviorRuntimeProjectionSha256(behaviorRuntime),
      capability_limitations: behaviorRuntime.capability_limitations,
      codex_version: inspection.codex_version,
      config_sha256: inspection.config_sha256,
      effective_policy: inspection.effective_policy,
      effective_policy_sha256: sha256Canonical(inspection.effective_policy),
      effort: inspection.effort,
      executable_path: inspection.executable_path,
      executable_sha256: inspection.executable_sha256,
      fresh_context_method: "new-app-server-thread",
      instruction_sources: behaviorRuntime.instruction_sources,
      intent_sha256: sha256Canonical(run.payload.intent),
      model: inspection.model,
      output_schema_name: outputSchemaName,
      output_schema_sha256: sha256Canonical(outputSchema),
      platform: inspection.platform,
      protocol_schema_sha256: inspection.protocol_schema_sha256,
      role: invocation.payload.role,
      run_id: run.artifact_id,
      runtime_identity: inspection.runtime_identity,
      session_id: thread.session_id,
      thread_id: thread.thread_id,
      transport: "stdio-jsonl",
      unit_id: attempt.payload.unit_id,
    },
  });
}

function createRuntimeDispatchRequest({
  attempt,
  attestation,
  inputText,
  invocation,
  readiness,
  request,
  requestEnvelope,
  requestJson,
  run,
}) {
  const links = [
    link("compiled_invocation", invocation),
    link("execution_attempt", attempt),
    link("run", run),
    link("runtime_attestation", attestation),
  ];
  if (readiness) links.push(link("readiness", readiness));
  return createHarnessArtifact({
    artifactType: "runtime_dispatch_request",
    artifactId: `runtime-request-${attempt.payload.attempt_id}`,
    producer: producer(),
    links: links.sort(compareLinks),
    payload: {
      attempt_id: attempt.payload.attempt_id,
      credential_free: true,
      grant_nonce: requestEnvelope.grant_nonce,
      input_sha256: sha256Bytes(Buffer.from(inputText, "utf8")),
      invocation_sha256: invocation.content_sha256,
      output_schema_sha256: sha256Canonical(request.params.outputSchema),
      readiness_sha256: readiness?.content_sha256 ?? null,
      request_id: request.id,
      request_json: requestJson,
      role: invocation.payload.role,
      run_id: run.artifact_id,
      runtime_attestation_sha256: attestation.content_sha256,
      semantic_dispatch_sha256: sha256Canonical(deriveRuntimeDispatchSemanticProjection(request)),
      thread_id: request.params.threadId,
      unit_id: attempt.payload.unit_id,
      wire_request_sha256: sha256Bytes(Buffer.from(requestJson, "utf8")),
    },
  });
}

function runtimeEvent({ attempt, controlRequestId = null, dispatchRequest, eventBytes, eventType, now, run, status, turnId }) {
  const exact = eventBytes === null ? null : exactJsonlRecord(eventBytes, "runtime event", eventType).toString("utf8");
  return createHarnessArtifact({
    artifactType: "runtime_event",
    artifactId: `${eventType.replaceAll("_", "-")}-${attempt.payload.attempt_id}`,
    producer: producer(),
    links: [
      link("execution_attempt", attempt),
      link("run", run),
      link("runtime_dispatch_request", dispatchRequest),
    ].sort(compareLinks),
    payload: {
      attempt_id: attempt.payload.attempt_id,
      control_request_id: controlRequestId,
      event_json: exact,
      event_json_sha256: exact === null ? null : sha256Bytes(eventBytes),
      event_type: eventType,
      occurred_at: now,
      request_id: dispatchRequest.payload.request_id,
      role: attempt.payload.role,
      run_id: run.artifact_id,
      status,
      thread_id: dispatchRequest.payload.thread_id,
      turn_id: turnId,
      unit_id: attempt.payload.unit_id,
    },
  });
}

function persistTransportEvent(pending, attemptId, transportEvent, now) {
  const active = pending.get(attemptId);
  if (!active) fail("APP_SERVER_EVENT_INVALID", "Runtime event arrived without an active exact attempt.", 4);
  const allowed = {
    turn_completed: "completed",
    turn_start_acknowledged: "acknowledged",
    turn_start_write_completed: "written",
  };
  if (
    !transportEvent ||
    allowed[transportEvent.event_type] !== transportEvent.status ||
    typeof transportEvent.turn_id !== "string" ||
    !Buffer.isBuffer(transportEvent.event_bytes) ||
    active.eventTypes.has(transportEvent.event_type)
  ) {
    fail("APP_SERVER_EVENT_INVALID", "App Server event order/type/status is invalid or duplicated.", 4);
  }
  if (transportEvent.event_type !== "turn_start_write_completed" && !active.eventTypes.has("turn_start_write_completed")) {
    fail("APP_SERVER_EVENT_INVALID", "App Server acknowledgement/terminal event preceded complete request write.", 4);
  }
  if (transportEvent.event_type === "turn_completed" && !active.eventTypes.has("turn_start_acknowledged")) {
    fail("APP_SERVER_EVENT_INVALID", "App Server terminal event preceded turn acknowledgement.", 4);
  }
  if (active.turnId !== null && active.turnId !== transportEvent.turn_id) {
    fail("APP_SERVER_EVENT_INVALID", "App Server event substituted a different turn identity.", 4);
  }
  active.turnId = transportEvent.turn_id;
  const event = runtimeEvent({
    attempt: active.dispatched,
    dispatchRequest: active.dispatchRequest,
    eventBytes: requireInboundEventBytes(transportEvent.event_bytes, transportEvent.event_type),
    eventType: transportEvent.event_type,
    now: now(),
    run: active.run,
    status: transportEvent.status,
    turnId: transportEvent.turn_id,
  });
  appendRuntimeEvent(active.storeRoot, { event, leaseToken: active.leaseToken, now: event.payload.occurred_at });
  active.eventTypes.add(transportEvent.event_type);
}

function recheckBeforeDispatch({ attempt, attestation, dispatchRequest, inputText, invocation, readiness, run, storeRoot }) {
  const current = loadRunManifest(storeRoot, run.artifact_id);
  if (
    current.artifact_id !== run.artifact_id ||
    current.payload.task_id !== run.payload.task_id ||
    current.payload.adapter_id !== run.payload.adapter_id ||
    current.payload.runtime_config_sha256 !== run.payload.runtime_config_sha256 ||
    canonicalJson(current.payload.selected_units) !== canonicalJson(run.payload.selected_units) ||
    sha256Canonical(current.payload.intent) !== sha256Canonical(run.payload.intent) ||
    readArtifactObject(storeRoot, attempt.content_sha256).content_sha256 !== attempt.content_sha256 ||
    readArtifactObject(storeRoot, invocation.content_sha256).content_sha256 !== invocation.content_sha256 ||
    (readiness !== null && readArtifactObject(storeRoot, readiness.content_sha256).content_sha256 !== readiness.content_sha256) ||
    readArtifactObject(storeRoot, attestation.content_sha256).content_sha256 !== attestation.content_sha256 ||
    readArtifactObject(storeRoot, dispatchRequest.content_sha256).content_sha256 !== dispatchRequest.content_sha256
  ) {
    fail("APP_SERVER_PREDISPATCH_DRIFT", "Runtime graph changed after snapshot publication.", 4);
  }
  const view = readRuntimeSnapshot(storeRoot, run.artifact_id, attempt.payload.attempt_id);
  if (view.input_text !== inputText || view.request_json !== dispatchRequest.payload.request_json) {
    fail("APP_SERVER_PREDISPATCH_DRIFT", "Runtime snapshot changed before turn/start.", 4);
  }
  validateRuntimeIndex(storeRoot, run.artifact_id);
}

function validateRuntimeGraph(baseArtifacts, runtimeArtifacts) {
  const graph = new Map();
  for (const artifact of [...baseArtifacts, ...runtimeArtifacts]) {
    assertHarnessArtifact(artifact);
    const key = `${artifact.artifact_type}:${artifact.artifact_id}`;
    const prior = graph.get(key);
    if (prior && prior.content_sha256 !== artifact.content_sha256) {
      fail("APP_SERVER_GRAPH_INVALID", "Runtime graph contains one artifact identity with conflicting content.", 4);
    }
    graph.set(key, artifact);
  }
  validateArtifactGraph([...graph.values()]);
}

function assertThreadStartResult(value, requestId) {
  if (
    !value ||
    value.request_id !== requestId ||
    typeof value.thread_id !== "string" ||
    !Array.isArray(value.instruction_sources) ||
    (value.session_id !== null && typeof value.session_id !== "string")
  ) {
    fail("APP_SERVER_THREAD_INVALID", "App Server thread/start acknowledgement is invalid.", 4);
  }
  const instructionSources = value.instruction_sources.map((source) => {
    const normalized = { path: normalizeRuntimePath(source.path), sha256: source.sha256 };
    assertHashFields(normalized, ["sha256"]);
    return normalized;
  }).sort((left, right) => left.path.localeCompare(right.path));
  const paths = [];
  for (const source of instructionSources) {
    assertHashFields(source, ["sha256"]);
    paths.push(source.path);
  }
  if (new Set(paths).size !== paths.length) {
    fail("APP_SERVER_THREAD_INVALID", "Instruction sources must be unique and hash-bound after normalization.", 4);
  }
  return { ...value, instruction_sources: instructionSources };
}

function assertTurnResult(value, request, requestJson) {
  if (
    !value ||
    value.request_id !== request.id ||
    value.thread_id !== request.params.threadId ||
    value.wire_request_sha256 !== sha256Bytes(Buffer.from(requestJson, "utf8")) ||
    typeof value.turn_id !== "string" ||
    value.terminal_status !== "completed" ||
    value.output === undefined ||
    !Buffer.isBuffer(value.write_event_bytes) ||
    !Buffer.isBuffer(value.ack_event_bytes) ||
    !Buffer.isBuffer(value.completed_event_bytes)
  ) {
    fail("APP_SERVER_TURN_INVALID", "App Server turn result is incomplete or mismatched.", 4);
  }
  return value;
}

async function conservativeLookup(transport, threadId, requestId) {
  if (typeof transport.lookupTurn !== "function") return { eventBytes: null, status: "unknown", turn_id: null };
  let result;
  try {
    result = await transport.lookupTurn({ requestId, threadId });
  } catch {
    return { eventBytes: null, status: "unknown", turn_id: null };
  }
  const eventBytes = requireInboundEventBytes(result?.event_bytes, "turn lookup result");
  if (result?.status === "not_started") return { eventBytes, status: "not_started", turn_id: null };
  if (result?.status === "completed" && typeof result.turn_id === "string") {
    return { eventBytes, status: "completed", turn_id: result.turn_id };
  }
  return { eventBytes, status: "unknown", turn_id: typeof result?.turn_id === "string" ? result.turn_id : null };
}

function concreteBehaviorRuntimeProjection({ adapterVersion, inspection, transport }) {
  return deriveBehaviorRuntimeProjection({
    adapter_id: codexChatGptAppServerAdapterId,
    adapter_version: adapterVersion,
    assurance_profile: codexChatGptAppServerAssuranceProfile,
    auth_mode: inspection.auth_mode,
    capability_limitations: [
      ...opaqueLimitations,
      ...(typeof transport.lookupTurn === "function" ? [] : ["turn-outcome-lookup-unsupported"]),
    ].sort(),
    codex_version: inspection.codex_version,
    config_sha256: inspection.config_sha256,
    effective_policy: inspection.effective_policy,
    effort: inspection.effort,
    executable_path: inspection.executable_path,
    executable_sha256: inspection.executable_sha256,
    fresh_context_method: "new-app-server-thread",
    instruction_sources: inspection.instruction_sources,
    model: inspection.model,
    platform: inspection.platform,
    protocol_schema_sha256: inspection.protocol_schema_sha256,
    runtime_identity: inspection.runtime_identity,
    transport: "stdio-jsonl",
  });
}

function assertActiveExecution(active) {
  if (active.aborted) {
    throw runtimeFailure("APP_SERVER_CONFIRMED_NOT_STARTED", "App Server attempt was stopped before turn write intent.", {
      callCertainty: "confirmed_not_started",
      retryClass: "control_confirmed_not_started",
    });
  }
}

function assertTransport(value) {
  if (
    !value ||
    !["mock_codex_app_server", "codex_app_server_stdio"].includes(value.kind) ||
    ["abortAttempt", "inspectRuntime", "startThread", "startTurn", "interruptTurn"].some((method) => typeof value[method] !== "function")
  ) {
    fail("APP_SERVER_TRANSPORT_INVALID", "Adapter requires an explicit App Server JSONL transport boundary.");
  }
}

function assertOutputSchemas(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("APP_SERVER_SCHEMA_INVALID", "Output schemas are required.");
  const required = ["evaluator-proposal-v2", "observation-v2", "verification-helper-v2"];
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson(required)) {
    fail("APP_SERVER_SCHEMA_INVALID", "Adapter output schemas must cover the exact certified role set.");
  }
  for (const [name, schema] of Object.entries(value)) {
    assertNormalizedIdentity(name, "output schema name");
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) fail("APP_SERVER_SCHEMA_INVALID", "Output schema must be an object.");
  }
}

function assertCredentialFree(value) {
  assertRuntimeCredentialFree(value);
}

function exactJsonlRecord(value, label, eventType = null) {
  if (
    !Buffer.isBuffer(value) ||
    value.length === 0 ||
    value.length > 262_144 ||
    value.at(-1) !== 0x0a ||
    value.subarray(0, -1).includes(0x0a)
  ) {
    fail("APP_SERVER_EVENT_INVALID", `${label} must provide exactly one newline-terminated JSONL byte record.`, 4);
  }
  const parsed = parseHarnessJson(value, label);
  if (eventType !== null) assertRuntimeControlPlaneEvent(parsed, eventType);
  return value;
}

function requireInboundEventBytes(value, label) {
  return exactJsonlRecord(value, label);
}

function optionalInboundEventBytes(value, label) {
  return value === null || value === undefined ? null : requireInboundEventBytes(value, label);
}

function normalizeRuntimePath(value) {
  if (typeof value !== "string" || value.length === 0) fail("APP_SERVER_ATTESTATION_INVALID", "Runtime path is missing.", 4);
  const normalized = value.replaceAll("\\", "/");
  if (normalized.includes("//") || normalized.split("/").some((segment) => segment === "." || segment === "..")) {
    fail("APP_SERVER_ATTESTATION_INVALID", "Runtime path is not normalized.", 4);
  }
  return normalized;
}

function assertHashFields(value, fields) {
  for (const field of fields) {
    if (typeof value[field] !== "string" || !/^[a-f0-9]{64}$/.test(value[field])) {
      fail("APP_SERVER_ATTESTATION_INVALID", `${field} must be lowercase SHA-256.`, 4);
    }
  }
}

function assertNormalizedIdentity(value, label) {
  if (typeof value !== "string" || !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(value)) {
    fail("APP_SERVER_IDENTITY_INVALID", `${label} must be a normalized identity.`);
  }
}

function producer() {
  return { kind: "adapter", name: "codex-chatgpt-app-server-v2", version: "2" };
}

function link(relationship, target) {
  return {
    relationship,
    target_artifact_id: target.artifact_id,
    target_artifact_type: target.artifact_type,
    target_content_sha256: target.content_sha256,
  };
}

function compareLinks(left, right) {
  return `${left.relationship}:${left.target_artifact_id}`.localeCompare(`${right.relationship}:${right.target_artifact_id}`);
}

function runtimeFailure(code, message, fields = {}) {
  const error = new HarnessError(code, message, 4);
  Object.assign(error, fields);
  return error;
}

function fail(code, message, exitCode = 1) {
  throw new HarnessError(code, message, exitCode);
}
