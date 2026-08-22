// Test plan:
// - Mục tiêu: chứng nhận CP8A tại đúng ranh giới Codex App Server `runtime_mediated` mà không gọi model/provider thật.
// - Loại test: Node schema/unit/integration với deterministic mocked App Server transport.
// - Đối tượng: adapter serialization, runtime lineage, atomic snapshot/index, auth, call-certainty, lookup, interrupt và reuse.
// - Case thành công: reader/evaluator/helper tạo fresh thread, exact input/request, runtime events và graph hợp lệ.
// - Case thất bại: snapshot fault, runtime drift, forbidden auth/credential, unresolved dispatch và semantic substitution fail closed.
// - Bảo mật/phân quyền: chỉ `mock_codex_app_server`; `live_model_calls: false`; turn writes được đếm chính xác.
// - Ổn định/resilience: pre-write là `confirmed_not_started`; post-intent mơ hồ là `outcome_unknown`; không blind retry.
// - Invariant cần giữ: runtime artifact khác attempt/grant/request hoặc representation stale không thể hợp thức hóa evidence.
// - Kết quả verify gần nhất: passed `38/38` bằng deterministic mocked App Server transport; model/provider calls `0`.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, sha256Bytes, sha256Canonical } from "./lib/skill-evals/artifact-schema-v1.mjs";
import {
  HarnessError,
  createHarnessArtifact,
  deriveRuntimeDispatchSemanticProjection,
  validateArtifactGraph,
} from "./lib/skill-evals/harness-schema-v2.mjs";
import {
  compileEvaluatorStaticInvocation,
  compileInvocation,
  executeReadiness,
} from "./lib/skill-evals/readiness-v2.mjs";
import { runControlledFixtureAttempts, runSequentialReaderStage } from "./lib/skill-evals/orchestrator-v2.mjs";
import { finalizeEvaluatorStage, runSequentialEvaluatorStage } from "./lib/skill-evals/review-v2.mjs";
import {
  acquireRunLease,
  appendAttemptPhase,
  createRunRecord,
  initializeRunStore,
  listStoredArtifacts,
  readAttemptPhases,
  readJournal,
  readRuntimeSnapshot,
  recoverRun,
  transitionRun,
  writeArtifactObject,
} from "./lib/skill-evals/run-store-v2.mjs";
import {
  classifyCodexChatGptAppServerReuse,
  createCodexChatGptAppServerAdapter,
  createCodexChatGptAppServerCapabilities,
  renderHumanReadableInput,
} from "./lib/skill-evals/codex-chatgpt-app-server-v2.mjs";

const timestamp = "2026-08-23T00:00:00.000Z";
const roots = [];

test.after(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
});

for (const role of ["reader", "evaluator", "verification_helper"]) {
  test(`CP8A mocked App Server preserves exact ${role} input/request and complete runtime lineage`, async () => {
    const fixture = createRuntimeFixture({ role });

    const output = await invokeFixture(fixture);
    const snapshot = readRuntimeSnapshot(fixture.root, fixture.run.artifact_id, fixture.attempt.payload.attempt_id);
    const artifacts = listStoredArtifacts(fixture.root, fixture.run.artifact_id);
    const runtimeArtifacts = artifacts.filter((artifact) =>
      ["runtime_attestation", "runtime_dispatch_request", "runtime_event"].includes(artifact.artifact_type),
    );

    assert.deepEqual(output, fixture.output);
    assert.equal(fixture.transport.turnWrites, 1);
    assert.match(snapshot.input_text, /^HARNESS_INPUT_V1\n/);
    assert.equal(JSON.parse(snapshot.request_json).method, "turn/start");
    assert.deepEqual(
      snapshot.events.map((event) => event.event_type),
      [
        "turn_start_write_intent",
        "turn_start_write_completed",
        "turn_start_acknowledged",
        "turn_completed",
      ],
    );
    assert.equal(runtimeArtifacts.filter((artifact) => artifact.artifact_type === "runtime_attestation").length, 1);
    assert.equal(runtimeArtifacts.filter((artifact) => artifact.artifact_type === "runtime_dispatch_request").length, 1);
    validateArtifactGraph(uniqueArtifacts([fixture.task, fixture.run, ...artifacts]));
    const index = readFileSync(join(fixture.root, "runs", fixture.run.artifact_id, "runtime", "index.md"), "utf8");
    assert.match(index, /- Why: Certify the bounded CP8A App Server adapter contract\./);
    assert.match(index, /\| Attempt \| Intended input \| Exact App Server request \| Runtime \| Thread\/turn \|/);
  });
}

test("CP8A attestation records unsupported outcome lookup as an explicit capability limitation", async () => {
  const fixture = createRuntimeFixture({ lookupSupported: false });

  await invokeFixture(fixture);
  const attestation = listStoredArtifacts(fixture.root, fixture.run.artifact_id).find(
    (artifact) => artifact.artifact_type === "runtime_attestation",
  );
  assert.ok(attestation.payload.capability_limitations.includes("turn-outcome-lookup-unsupported"));
});

test("CP8A sequential reader/evaluator paths materialize evidence and finder results on the existing Stage 2 boundaries", async () => {
  const fixture = createSequentialWorkflowFixture();

  const reader = await runSequentialReaderStage({
    adapter: fixture.adapter,
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: fixture.evaluatorStatic,
    leaseToken: fixture.lease.token,
    readinessSet: fixture.readiness,
    readerInvocations: [fixture.readerInvocation],
    run: fixture.run,
    storeRoot: fixture.root,
    task: fixture.task,
  });
  assert.equal(reader.calls, 1);
  assert.equal(reader.observations.length, 1);
  const reusedReader = await runSequentialReaderStage({
    adapter: fixture.adapter,
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: fixture.evaluatorStatic,
    leaseToken: fixture.lease.token,
    readinessSet: fixture.readiness,
    readerInvocations: [fixture.readerInvocation],
    run: fixture.run,
    storeRoot: fixture.root,
    task: fixture.task,
  });
  assert.equal(reusedReader.calls, 0);
  assert.equal(fixture.transport.turnWrites, 1);
  const storedAfterReader = listStoredArtifacts(fixture.root, fixture.run.artifact_id);
  const readerTerminal = storedAfterReader.find(
    (artifact) =>
      artifact.artifact_type === "execution_attempt" &&
      artifact.payload.role === "reader" &&
      artifact.payload.phase === "terminal",
  );
  const stage = finalizeEvaluatorStage({
    comparisonMapping: fixture.comparisonMapping,
    protocol: fixture.evaluatorProtocol,
    requestedPolicy: fixture.policy,
    rubric: fixture.rubric,
    run: fixture.run,
    runtime: fixture.runtime,
    staticReadiness: fixture.readiness.evaluator_static,
    supportingArtifacts: storedAfterReader,
    task: fixture.task,
    units: [
      {
        evaluator_unit_id: "evaluator-one",
        observation: reader.observations[0],
        reader_unit_id: "reader-one",
        resource_observations: [],
      },
    ],
  });
  for (const artifact of [...stage.invocations, stage.readiness]) writeArtifactObject(fixture.root, artifact);
  const evaluator = await runSequentialEvaluatorStage({
    adapter: fixture.adapter,
    leaseToken: fixture.lease.token,
    run: fixture.run,
    stage,
    storeRoot: fixture.root,
  });

  assert.equal(evaluator.calls, 1);
  assert.equal(evaluator.proposals.length, 1);
  const reusedEvaluator = await runSequentialEvaluatorStage({
    adapter: fixture.adapter,
    leaseToken: fixture.lease.token,
    run: fixture.run,
    stage,
    storeRoot: fixture.root,
  });
  assert.equal(reusedEvaluator.calls, 0);
  assert.equal(fixture.transport.turnWrites, 2);
  const readerView = readRuntimeSnapshot(fixture.root, fixture.run.artifact_id, readerTerminal.payload.attempt_id);
  const evaluatorTerminal = listStoredArtifacts(fixture.root, fixture.run.artifact_id).find(
    (artifact) =>
      artifact.artifact_type === "execution_attempt" &&
      artifact.payload.role === "evaluator" &&
      artifact.payload.phase === "terminal",
  );
  const evaluatorView = readRuntimeSnapshot(fixture.root, fixture.run.artifact_id, evaluatorTerminal.payload.attempt_id);
  assert.deepEqual(readerView.result, {
    attempt_id: readerTerminal.payload.attempt_id,
    evidence: [
      {
        artifact_id: reader.observations[0].artifact_id,
        artifact_type: "observation",
        content_sha256: reader.observations[0].content_sha256,
      },
    ],
    status: "success",
  });
  assert.equal(evaluatorView.result.status, "success");
  assert.equal(evaluatorView.result.evidence[0].artifact_id, evaluator.proposals[0].artifact_id);
});

test("CP8A same-run reuse fails closed when its exact runtime representation becomes stale", async () => {
  const fixture = createSequentialWorkflowFixture();
  await runSequentialReaderStage({
    adapter: fixture.adapter,
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: fixture.evaluatorStatic,
    leaseToken: fixture.lease.token,
    readinessSet: fixture.readiness,
    readerInvocations: [fixture.readerInvocation],
    run: fixture.run,
    storeRoot: fixture.root,
    task: fixture.task,
  });
  const readerTerminal = listStoredArtifacts(fixture.root, fixture.run.artifact_id).find(
    (artifact) =>
      artifact.artifact_type === "execution_attempt" &&
      artifact.payload.role === "reader" &&
      artifact.payload.phase === "terminal",
  );
  const inputPath = join(
    fixture.root,
    "runs",
    fixture.run.artifact_id,
    "runtime",
    "attempts",
    readerTerminal.payload.attempt_id,
    "input.txt",
  );
  writeFileSync(inputPath, `${readFileSync(inputPath, "utf8")}stale`, "utf8");

  await assert.rejects(
    () => runSequentialReaderStage({
      adapter: fixture.adapter,
      adapterCapabilities: fixture.capabilities,
      evaluatorStatic: fixture.evaluatorStatic,
      leaseToken: fixture.lease.token,
      readinessSet: fixture.readiness,
      readerInvocations: [fixture.readerInvocation],
      run: fixture.run,
      storeRoot: fixture.root,
      task: fixture.task,
    }),
    hasCode("RUNTIME_VIEW_CORRUPT"),
  );
  assert.equal(fixture.transport.turnWrites, 1);
});

test("CP8A atomically fails before turn/start when snapshot publication fails", async () => {
  const fixture = createRuntimeFixture({ faultAt: "runtime-snapshot.before-publish" });

  await assert.rejects(() => invokeFixture(fixture), hasCertainty("confirmed_not_started"));
  assert.equal(fixture.transport.turnWrites, 0);
  assert.throws(
    () => readRuntimeSnapshot(fixture.root, fixture.run.artifact_id, fixture.attempt.payload.attempt_id),
    hasCode("RUNTIME_SNAPSHOT_MISSING"),
  );
});

test("CP8A rechecks runtime identity after the atomic snapshot and keeps drift at zero writes", async () => {
  const fixture = createRuntimeFixture({ driftOnSecondInspection: true });

  await assert.rejects(() => invokeFixture(fixture), hasCodeAndCertainty("APP_SERVER_RUNTIME_DRIFT", "confirmed_not_started"));
  assert.equal(fixture.transport.turnWrites, 0);
  assert.ok(readRuntimeSnapshot(fixture.root, fixture.run.artifact_id, fixture.attempt.payload.attempt_id));
});

test("CP8A rejects a stale single-use grant before thread/start and turn/start", async () => {
  const fixture = createRuntimeFixture();

  await assert.rejects(
    () => invokeFixture(fixture, { grant_nonce: "grant-from-another-readiness" }),
    hasCertainty("confirmed_not_started"),
  );
  assert.equal(fixture.transport.threadWrites, 0);
  assert.equal(fixture.transport.turnWrites, 0);
});

test("CP8A accepts ChatGPT auth and rejects API-key auth before any runtime thread or turn write", async () => {
  const fixture = createRuntimeFixture({ authMode: "apikey" });

  await assert.rejects(() => invokeFixture(fixture), hasCodeAndCertainty("APP_SERVER_CONFIRMED_NOT_STARTED", "confirmed_not_started"));
  assert.equal(fixture.transport.threadWrites, 0);
  assert.equal(fixture.transport.turnWrites, 0);
});

test("CP8A rejects a live transport kind without separate live-call authority before runtime inspection", async () => {
  const fixture = createRuntimeFixture();
  fixture.transport.kind = "codex_app_server_stdio";

  await assert.rejects(
    () => invokeFixture(fixture),
    (error) =>
      error?.code === "APP_SERVER_CONFIRMED_NOT_STARTED" &&
      error?.callCertainty === "confirmed_not_started" &&
      error?.cause?.code === "APP_SERVER_AUTHORITY_INVALID",
  );
  assert.equal(fixture.transport.inspectionCalls, 0);
  assert.equal(fixture.transport.threadWrites, 0);
  assert.equal(fixture.transport.turnWrites, 0);
});

test("CP8A retains exact secret-safe thread/start intent and recovers shadow_thread_outcome_unknown without a model turn", async () => {
  const fixture = createRuntimeFixture({ startThreadError: true });

  await assert.rejects(
    () => invokeFixture(fixture),
    hasCodeAndCertainty("APP_SERVER_THREAD_OUTCOME_UNKNOWN", "confirmed_not_started"),
  );
  const runtimeJournal = readJournal(fixture.root, fixture.run.artifact_id).filter((event) => event.type === "runtime_recorded");
  assert.deepEqual(runtimeJournal.map((event) => event.details.event), [
    "thread_start_write_intent",
    "thread_start_outcome_unknown",
  ]);
  assert.equal(
    sha256Canonical(JSON.parse(runtimeJournal[0].details.request_json)),
    runtimeJournal[0].details.request_sha256,
  );
  recoverRun(fixture.root, fixture.run.artifact_id, { leaseToken: fixture.lease.token, now: timestamp });
  const terminal = readAttemptPhases(fixture.root, fixture.run.artifact_id, fixture.attempt.payload.attempt_id).terminal;
  assert.equal(terminal.payload.call_certainty, "confirmed_not_started");
  assert.equal(fixture.transport.turnWrites, 0);
});

test("CP8A rejects fresh-thread instruction-source substitution before turn/start", async () => {
  const fixture = createRuntimeFixture({ threadInstructionSha256: "b".repeat(64) });

  await assert.rejects(
    () => invokeFixture(fixture),
    hasCodeAndCertainty("APP_SERVER_INSTRUCTION_SOURCE_MISMATCH", "confirmed_not_started"),
  );
  assert.equal(fixture.transport.turnWrites, 0);
});

test("CP8A rejects credential-bearing request settings with zero turn/start writes", async () => {
  const fixture = createRuntimeFixture({ settings: { api_key: "sk-example-credential-material" } });

  await assert.rejects(() => invokeFixture(fixture), hasCertainty("confirmed_not_started"));
  assert.equal(fixture.transport.turnWrites, 0);
});

test("CP8A maps unresolved post-intent transport failure to outcome_unknown and persists lookup/error events", async () => {
  const fixture = createRuntimeFixture({ startTurnError: true });

  await assert.rejects(() => invokeFixture(fixture), hasCertainty("unknown"));
  const snapshot = readRuntimeSnapshot(fixture.root, fixture.run.artifact_id, fixture.attempt.payload.attempt_id);
  assert.equal(fixture.transport.turnWrites, 1);
  assert.deepEqual(snapshot.events.slice(-2).map((event) => event.event_type), ["turn_lookup_result", "transport_error"]);
});

test("CP8A accepts exact lookup proof of not-started without pretending a completed call", async () => {
  const fixture = createRuntimeFixture({ lookupStatus: "not_started", startTurnError: true });

  await assert.rejects(
    () => invokeFixture(fixture),
    hasCodeAndCertainty("APP_SERVER_TURN_OUTCOME_UNKNOWN", "confirmed_not_started"),
  );
  assert.equal(fixture.transport.turnWrites, 1);
});

test("CP8A maps exact lookup proof of a completed turn to confirmed_finished without semantic success", async () => {
  const fixture = createRuntimeFixture({ lookupStatus: "completed", startTurnError: true });

  await assert.rejects(
    () => invokeFixture(fixture),
    hasCodeAndCertainty("APP_SERVER_TURN_OUTCOME_UNKNOWN", "confirmed_finished"),
  );
  recoverRun(fixture.root, fixture.run.artifact_id, { leaseToken: fixture.lease.token, now: timestamp });
  const terminal = readAttemptPhases(fixture.root, fixture.run.artifact_id, fixture.attempt.payload.attempt_id).terminal;
  assert.equal(terminal.payload.call_certainty, "confirmed_finished");
  assert.equal(terminal.payload.outcome, "error");
});

test("CP8A preserves a durable completed event when output delivery fails afterward", async () => {
  const fixture = createRuntimeFixture({ startTurnCompletedThenError: true });

  await assert.rejects(() => invokeFixture(fixture), hasCertainty("confirmed_finished"));
  recoverRun(fixture.root, fixture.run.artifact_id, { leaseToken: fixture.lease.token, now: timestamp });
  const terminal = readAttemptPhases(fixture.root, fixture.run.artifact_id, fixture.attempt.payload.attempt_id).terminal;
  assert.equal(terminal.payload.call_certainty, "confirmed_finished");
  assert.equal(terminal.payload.outcome, "error");
});

test("CP8A restart closes an acknowledged thread bootstrap as confirmed_not_started without redispatch", async () => {
  const fixture = createRuntimeFixture({ threadInstructionSha256: "b".repeat(64) });

  await assert.rejects(
    () => invokeFixture(fixture),
    hasCodeAndCertainty("APP_SERVER_INSTRUCTION_SOURCE_MISMATCH", "confirmed_not_started"),
  );
  assert.equal(fixture.transport.threadWrites, 1);
  assert.equal(fixture.transport.turnWrites, 0);
  recoverRun(fixture.root, fixture.run.artifact_id, { leaseToken: fixture.lease.token, now: timestamp });

  const phases = readAttemptPhases(fixture.root, fixture.run.artifact_id, fixture.attempt.payload.attempt_id);
  assert.equal(phases.terminal.payload.call_certainty, "confirmed_not_started");
  assert.equal(phases.terminal.payload.outcome, "error");
  assert.equal(fixture.transport.turnWrites, 0);
});

test("CP8A restart recognizes exact completed-turn evidence without redispatch", async () => {
  const fixture = createRuntimeFixture();

  await invokeFixture(fixture);
  assert.equal(fixture.transport.turnWrites, 1);
  recoverRun(fixture.root, fixture.run.artifact_id, { leaseToken: fixture.lease.token, now: timestamp });

  const phases = readAttemptPhases(fixture.root, fixture.run.artifact_id, fixture.attempt.payload.attempt_id);
  assert.equal(phases.terminal.payload.call_certainty, "confirmed_finished");
  assert.equal(phases.terminal.payload.outcome, "error");
  assert.equal(fixture.transport.turnWrites, 1);
});

test("CP8A restart accepts exact lookup not_started evidence without redispatch", async () => {
  const fixture = createRuntimeFixture({ lookupStatus: "not_started", startTurnError: true });

  await assert.rejects(() => invokeFixture(fixture), hasCertainty("confirmed_not_started"));
  assert.equal(fixture.transport.turnWrites, 1);
  recoverRun(fixture.root, fixture.run.artifact_id, { leaseToken: fixture.lease.token, now: timestamp });

  const phases = readAttemptPhases(fixture.root, fixture.run.artifact_id, fixture.attempt.payload.attempt_id);
  assert.equal(phases.terminal.payload.call_certainty, "confirmed_not_started");
  assert.equal(phases.terminal.payload.outcome, "error");
  assert.equal(fixture.transport.turnWrites, 1);
});

test("CP8A restart preserves unresolved post-intent uncertainty without redispatch", async () => {
  const fixture = createRuntimeFixture({ startTurnError: true });

  await assert.rejects(() => invokeFixture(fixture), hasCertainty("unknown"));
  assert.equal(fixture.transport.turnWrites, 1);
  recoverRun(fixture.root, fixture.run.artifact_id, { leaseToken: fixture.lease.token, now: timestamp });

  const phases = readAttemptPhases(fixture.root, fixture.run.artifact_id, fixture.attempt.payload.attempt_id);
  assert.equal(phases.terminal.payload.call_certainty, "unknown");
  assert.equal(phases.terminal.payload.outcome, "outcome_unknown");
  assert.equal(fixture.transport.turnWrites, 1);
});

test("CP8A interrupt acknowledgement alone is insufficient; terminal interrupted evidence confirms cancellation", async () => {
  let release;
  const fixture = createRuntimeFixture({
    interruptResult: {
      accepted: true,
      ack_event: { id: "interrupt-ack" },
      terminal_event: { status: "interrupted" },
      terminal_status: "interrupted",
    },
    startTurnGate: new Promise((resolve) => {
      release = resolve;
    }),
  });
  const invocation = invokeFixture(fixture);
  await fixture.transport.acknowledged;

  const cancelled = await fixture.adapter.cancel({ attempt_id: fixture.attempt.payload.attempt_id }, "cancel_requested");
  assert.deepEqual(cancelled, { callCertainty: "confirmed_finished", confirmed: true });
  release();
  await assert.rejects(() => invocation, hasCertainty("confirmed_finished"));
  const snapshot = readRuntimeSnapshot(fixture.root, fixture.run.artifact_id, fixture.attempt.payload.attempt_id);
  assert.deepEqual(
    snapshot.events.filter((event) => event.event_type.startsWith("turn_interrupt")).map((event) => event.event_type),
    ["turn_interrupt_requested", "turn_interrupt_acknowledged"],
  );
});

test("CP8A integrates the CP7 connect/dispatch/response timeout certainty matrix", async (t) => {
  const cases = [
    {
      expected: { certainty: "confirmed_not_started", outcome: "timeout", turnWrites: 0 },
      options: { inspectGate: new Promise(() => {}) },
      phase: "connect",
    },
    {
      expected: { certainty: "unknown", outcome: "outcome_unknown", turnWrites: 1 },
      options: { startTurnBeforeAckGate: new Promise(() => {}) },
      phase: "dispatch",
    },
    {
      expected: { certainty: "unknown", outcome: "outcome_unknown", turnWrites: 1 },
      options: { startTurnGate: new Promise(() => {}) },
      phase: "response",
    },
  ];
  for (const testCase of cases) {
    await t.test(testCase.phase, async () => {
      const fixture = createRuntimeFixture({ ...testCase.options, persistPrepared: false, role: "evaluator" });
      const result = await runControlledFixtureAttempts({
        adapter: fixture.adapter,
        controlConfirmationMs: 20,
        dispatchContext: { task: fixture.task },
        invocations: [fixture.invocation],
        leaseToken: fixture.lease.token,
        readiness: fixture.readiness,
        retryPolicy: { max_attempts: 1, retryable_classes: [] },
        role: "evaluator",
        run: fixture.run,
        storeRoot: fixture.root,
        timeoutMs: 10,
        timeoutPhase: testCase.phase,
      });
      const terminal = result.attempts[0];
      assert.equal(terminal.payload.call_certainty, testCase.expected.certainty);
      assert.equal(terminal.payload.outcome, testCase.expected.outcome);
      assert.equal(fixture.transport.turnWrites, testCase.expected.turnWrites);
    });
  }
});

test("CP8A cross-run opaque provider-envelope reuse remains unknown", () => {
  assert.deepEqual(classifyCodexChatGptAppServerReuse({ sourceRunId: "run-one", targetRunId: "run-one" }), {
    classification: "unaffected",
    reason: "same-run exact runtime lineage remains eligible for validation",
  });
  assert.equal(
    classifyCodexChatGptAppServerReuse({ sourceRunId: "run-one", targetRunId: "run-two" }).classification,
    "unknown",
  );
});

test("CP8A rejects one-dimension semantic substitutions at the runtime relationship owner", async (t) => {
  const fixture = createRuntimeFixture({ role: "reader" });
  await invokeFixture(fixture);
  const artifacts = listStoredArtifacts(fixture.root, fixture.run.artifact_id);
  const attestation = artifacts.find((artifact) => artifact.artifact_type === "runtime_attestation");
  const request = artifacts.find((artifact) => artifact.artifact_type === "runtime_dispatch_request");
  const dispatched = artifacts.find(
    (artifact) => artifact.artifact_type === "execution_attempt" && artifact.payload.phase === "dispatched",
  );
  const event = artifacts.find((artifact) => artifact.artifact_type === "runtime_event");
  const base = [fixture.task, fixture.run, fixture.invocation, fixture.readiness, fixture.attempt, dispatched];

  await t.test("same invocation/request rebound to another valid intent/run", () => {
    const substitutedRun = recreate(fixture.run, {
      payload: {
        ...fixture.run.payload,
        intent: { ...fixture.run.payload.intent, purpose: "Different independently valid owner purpose." },
      },
    });
    assert.throws(
      () => validateArtifactGraph([fixture.task, substitutedRun, fixture.invocation, fixture.readiness, fixture.attempt, dispatched, attestation, request, event]),
      hasAnyCode("ARTIFACT_RELATIONSHIP_INVALID", "INTEGRITY_MISMATCH"),
    );
  });

  await t.test("attestation substituted from another attempt/thread", () => {
    const substituted = recreate(attestation, {
      payload: { ...attestation.payload, attempt_id: "another-attempt", thread_id: "thread-other" },
    });
    assert.throws(() => validateArtifactGraph([...base, substituted]), hasCode("ARTIFACT_RELATIONSHIP_INVALID"));
  });

  await t.test("request model changes despite internally consistent wire/semantic hashes", () => {
    const wire = JSON.parse(request.payload.request_json);
    wire.params.model = "different-model";
    const requestJson = canonicalJson(wire);
    const substituted = recreate(request, {
      payload: {
        ...request.payload,
        request_json: requestJson,
        semantic_dispatch_sha256: sha256Canonical(deriveRuntimeDispatchSemanticProjection(wire)),
        wire_request_sha256: sha256Bytes(Buffer.from(requestJson, "utf8")),
      },
    });
    assert.throws(() => validateArtifactGraph([...base, attestation, substituted]), hasCode("ARTIFACT_RELATIONSHIP_INVALID"));
  });

  await t.test("request outputSchema changes under the same attestation", () => {
    const wire = JSON.parse(request.payload.request_json);
    wire.params.outputSchema = { additionalProperties: false, type: "object" };
    const requestJson = canonicalJson(wire);
    const substituted = recreate(request, {
      payload: {
        ...request.payload,
        output_schema_sha256: sha256Canonical(wire.params.outputSchema),
        request_json: requestJson,
        semantic_dispatch_sha256: sha256Canonical(deriveRuntimeDispatchSemanticProjection(wire)),
        wire_request_sha256: sha256Bytes(Buffer.from(requestJson, "utf8")),
      },
    });
    assert.throws(() => validateArtifactGraph([...base, attestation, substituted]), hasCode("ARTIFACT_RELATIONSHIP_INVALID"));
  });

  await t.test("request input changes despite internally consistent wire/view/semantic hashes", () => {
    const wire = JSON.parse(request.payload.request_json);
    wire.params.input[0] = { ...wire.params.input[0], text: `${wire.params.input[0].text}\nsubstituted` };
    const requestJson = canonicalJson(wire);
    const substituted = recreate(request, {
      payload: {
        ...request.payload,
        input_sha256: sha256Bytes(Buffer.from(renderHumanReadableInput(wire.params.input), "utf8")),
        request_json: requestJson,
        semantic_dispatch_sha256: sha256Canonical(deriveRuntimeDispatchSemanticProjection(wire)),
        wire_request_sha256: sha256Bytes(Buffer.from(requestJson, "utf8")),
      },
    });
    assert.throws(() => validateArtifactGraph([...base, attestation, substituted]), hasCode("ARTIFACT_RELATIONSHIP_INVALID"));
  });

  await t.test("request cannot substitute another valid readiness/grant under the same prepared attempt", () => {
    const alternativeReadiness = recreate(fixture.readiness, {
      artifactId: "reader-readiness-cp8a-alternative",
      payload: {
        ...fixture.readiness.payload,
        grants: [{ ...fixture.readiness.payload.grants[0], nonce: "grant-cp8a-alternative" }],
      },
    });
    const alternativeAttestation = recreate(attestation, {
      links: attestation.links
        .filter((linkValue) => linkValue.relationship !== "readiness")
        .concat(link("readiness", alternativeReadiness))
        .sort(compareLinks),
    });
    const alternativeRequest = recreate(request, {
      links: request.links
        .filter((linkValue) => !["readiness", "runtime_attestation"].includes(linkValue.relationship))
        .concat(link("readiness", alternativeReadiness), link("runtime_attestation", alternativeAttestation))
        .sort(compareLinks),
      payload: {
        ...request.payload,
        grant_nonce: "grant-cp8a-alternative",
        readiness_sha256: alternativeReadiness.content_sha256,
        runtime_attestation_sha256: alternativeAttestation.content_sha256,
      },
    });
    assert.throws(
      () => validateArtifactGraph([
        fixture.task,
        fixture.run,
        fixture.invocation,
        alternativeReadiness,
        fixture.attempt,
        alternativeAttestation,
        alternativeRequest,
      ]),
      hasCode("ARTIFACT_RELATIONSHIP_INVALID"),
    );
  });

  await t.test("JSON-RPC id variation stays audit-only through a newly canonical request", () => {
    const wire = JSON.parse(request.payload.request_json);
    wire.id = "turn-audit-variation";
    const requestJson = canonicalJson(wire);
    const varied = recreate(request, {
      artifactId: "runtime-request-audit-variation",
      payload: {
        ...request.payload,
        request_id: wire.id,
        request_json: requestJson,
        wire_request_sha256: sha256Bytes(Buffer.from(requestJson, "utf8")),
      },
    });
    assert.equal(varied.payload.semantic_dispatch_sha256, request.payload.semantic_dispatch_sha256);
    assert.doesNotThrow(() => validateArtifactGraph([...base, attestation, varied]));
  });

  await t.test("runtime event substituted from another request/turn", () => {
    const substituted = recreate(event, { payload: { ...event.payload, turn_id: "turn-other" } });
    assert.throws(
      () => validateArtifactGraph([...base, attestation, request, substituted]),
      hasCode("ARTIFACT_RELATIONSHIP_INVALID"),
    );
  });
});

test("CP8A stale input.txt representation fails closed and is never reconstructed", async () => {
  const fixture = createRuntimeFixture();
  await invokeFixture(fixture);
  const path = join(
    fixture.root,
    "runs",
    fixture.run.artifact_id,
    "runtime",
    "attempts",
    fixture.attempt.payload.attempt_id,
    "input.txt",
  );
  writeFileSync(path, "tampered\n", "utf8");

  assert.throws(
    () => readRuntimeSnapshot(fixture.root, fixture.run.artifact_id, fixture.attempt.payload.attempt_id),
    hasCode("RUNTIME_VIEW_CORRUPT"),
  );
});

function createSequentialWorkflowFixture() {
  const root = initializeRunStore(temporaryDirectory());
  const runtime = {
    model: "gpt-5.4",
    parameters: {
      approval_policy: "never",
      cwd: "C:/VocaSpace",
      effort: "medium",
      sandbox_policy: "read-only",
      settings: { personality: "none" },
    },
    provider: "codex-chatgpt",
    runtime_class: "codex-app-server",
  };
  const policy = {
    credentials: "excluded",
    filesystem: "read_only",
    fresh_context: true,
    mutation: "denied",
    network: "denied",
    remote_actions: "denied",
    supplied_resources: [],
    tools: [],
  };
  const task = createHarnessArtifact({
    artifactId: "task-cp8a-workflow",
    artifactType: "task_manifest",
    payload: {
      created_at: timestamp,
      lifecycle: "active",
      provenance: { branch: "refactor/agent-skill-eval-harness", commit: null, pull_request: null },
      retention_policy_version: "retention-v2",
      task_id: "task-cp8a-workflow",
    },
    producer: producer("operator"),
  });
  const run = createHarnessArtifact({
    artifactId: "run-cp8a-workflow",
    artifactType: "run_manifest",
    links: [link("task", task)],
    payload: {
      adapter_id: "codex_chatgpt_app_server",
      created_at: timestamp,
      intent: {
        assurance_profile: "runtime_mediated",
        authentication_boundary: "chatgpt_subscription",
        authority_record: {
          authorized_roles: ["evaluator", "reader"],
          basis: "owner_explicit",
          live_call_limits: { evaluator: 0, reader: 0, total: 0, verification_helper: 0 },
          live_model_calls: false,
          recorded_at: timestamp,
          scope: "Deterministic CP8A sequential Stage 2 integration only.",
        },
        purpose: "Certify concrete runtime integration at reader and evaluator ownership boundaries.",
        selection_reason: "The exact two-role path proves durable evidence materialization.",
      },
      revision: 0,
      run_id: "run-cp8a-workflow",
      runtime_config_sha256: sha256Canonical(runtime),
      selected_units: [
        { case_id: "case-one", role: "evaluator", suite: "regression", unit_id: "evaluator-one", variant: "candidate" },
        { case_id: "case-one", role: "reader", suite: "regression", unit_id: "reader-one", variant: "candidate" },
      ],
      state: "created",
      task_id: task.artifact_id,
    },
    producer: producer("harness"),
  });
  const comparisonMapping = { candidate: "candidate" };
  const evaluatorProtocol = {
    observation_instructions: "Return one exact advisory evaluator proposal.",
    output_schema: "evaluator-proposal-v2",
  };
  const rubric = { material: ["observable behavior"] };
  const readerInvocation = compileInvocation({
    artifactId: "reader-invocation-cp8a-workflow",
    messages: [{ content: "Return one deterministic reader observation.", role: "user" }],
    protocol: { observation_instructions: "Return exact reader evidence.", output_schema: "observation-v2" },
    requestedPolicy: policy,
    resources: [],
    role: "reader",
    run,
    runtime,
    tools: [],
    unitId: "reader-one",
  });
  const staticPlan = {
    comparison_mapping_sha256: sha256Canonical(comparisonMapping),
    protocol_sha256: sha256Canonical(evaluatorProtocol),
    rubric_sha256: sha256Canonical(rubric),
    runtime_config_sha256: sha256Canonical(runtime),
  };
  const evaluatorStatic = {
    invocation: compileEvaluatorStaticInvocation({
      artifactId: "evaluator-static-cp8a-workflow",
      messages: [{ content: "Prepare the exact evaluator stage.", role: "user" }],
      protocol: evaluatorProtocol,
      requestedPolicy: policy,
      resources: [],
      run,
      runtime,
      staticPlan,
      tools: [],
      unitId: "evaluator-one",
    }),
    staticPlan,
  };
  const capabilities = createCodexChatGptAppServerCapabilities();
  const readinessResult = executeReadiness({
    adapterCapabilities: capabilities,
    now: timestamp,
    rounds: [{ evaluatorStatic, readerInvocations: [readerInvocation], runtimeConfig: runtime }],
    run,
    task,
  });
  const readiness = readinessResult.analyses.at(-1);
  createRunRecord(root, task, run, { now: timestamp });
  for (const artifact of [
    readerInvocation,
    evaluatorStatic.invocation,
    readiness.reader,
    readiness.evaluator_static,
  ]) {
    writeArtifactObject(root, artifact);
  }
  const lease = acquireRunLease(root, run.artifact_id, {
    durationMs: 86_400_000,
    host: "cp8a-fixture",
    now: timestamp,
    owner: "cp8a-workflow-test",
    pid: 809,
    token: "lease-cp8a-workflow",
  });
  let revision = 0;
  for (const state of ["preflight", "readiness", "ready"]) {
    transitionRun(root, {
      expectedRevision: revision,
      leaseToken: lease.token,
      nextState: state,
      now: timestamp,
      runId: run.artifact_id,
    });
    revision += 1;
  }
  const transport = createMockTransport({
    authMode: "chatgpt",
    driftOnSecondInspection: false,
    interruptResult: { accepted: true, ack_event: { id: "interrupt-ack" }, terminal_status: "accepted" },
    lookupStatus: "unknown",
    output: (request) =>
      request.params.outputSchema.title === "reader"
        ? {
            observation: {
              execution_status: "completed",
              observed_access: {
                credentials: "not_observed",
                filesystem: "observed",
                mutation: "not_observed",
                network: "not_observed",
                remote_actions: "not_observed",
                tools: "not_observed",
              },
              raw_text: "deterministic reader evidence",
            },
            resources: [],
          }
        : {
            case_status: "passed",
            citations: [{ artifact_id: "observation-reader-reader-one-attempt-1", label: "Reader evidence" }],
            comparison_status: "equivalent",
            rationale: "Deterministic evaluator proposal.",
            recommendation: "accept",
            uncertainty: "",
          },
    policy,
    runtime,
    startTurnError: false,
    startTurnGate: null,
    threadInstructionSha256: "a".repeat(64),
  });
  const adapter = createCodexChatGptAppServerAdapter({
    now: () => timestamp,
    outputSchemas: {
      "evaluator-proposal-v2": { additionalProperties: true, title: "evaluator", type: "object" },
      "observation-v2": { additionalProperties: true, title: "reader", type: "object" },
      "verification-helper-v2": { additionalProperties: true, title: "helper", type: "object" },
    },
    transport,
  });
  return {
    adapter,
    capabilities,
    comparisonMapping,
    evaluatorProtocol,
    evaluatorStatic,
    lease,
    policy,
    readerInvocation,
    readiness,
    root,
    rubric,
    run,
    runtime,
    task,
    transport,
  };
}

function createRuntimeFixture({
  authMode = "chatgpt",
  driftOnSecondInspection = false,
  faultAt = null,
  interruptResult = { accepted: true, ack_event: { id: "interrupt-ack" }, terminal_status: "accepted" },
  inspectGate = null,
  lookupStatus = "unknown",
  lookupSupported = true,
  role = "reader",
  persistPrepared = true,
  settings = { personality: "none" },
  startTurnError = false,
  startTurnBeforeAckGate = null,
  startTurnCompletedThenError = false,
  startTurnGate = null,
  startThreadError = false,
  threadInstructionSha256 = "a".repeat(64),
} = {}) {
  const root = initializeRunStore(temporaryDirectory());
  const unitId = role === "verification_helper" ? "helper-one" : "unit-one";
  const attemptUnitId = role === "verification_helper" ? null : unitId;
  const runtime = {
    model: "gpt-5.4",
    parameters: {
      approval_policy: "never",
      cwd: "C:/VocaSpace",
      effort: "medium",
      sandbox_policy: "read-only",
      settings,
    },
    provider: "codex-chatgpt",
    runtime_class: "codex-app-server",
  };
  const policy = {
    credentials: "excluded",
    filesystem: "read_only",
    fresh_context: true,
    mutation: "denied",
    network: "denied",
    remote_actions: "denied",
    supplied_resources: [],
    tools: [],
  };
  const task = createHarnessArtifact({
    artifactId: "task-cp8a",
    artifactType: "task_manifest",
    payload: {
      created_at: timestamp,
      lifecycle: "active",
      provenance: { branch: "refactor/agent-skill-eval-harness", commit: null, pull_request: null },
      retention_policy_version: "retention-v2",
      task_id: "task-cp8a",
    },
    producer: producer("operator"),
  });
  const run = createHarnessArtifact({
    artifactId: "run-cp8a",
    artifactType: "run_manifest",
    links: [link("task", task)],
    payload: {
      adapter_id: "codex_chatgpt_app_server",
      created_at: timestamp,
      intent: {
        assurance_profile: "runtime_mediated",
        authentication_boundary: "chatgpt_subscription",
        authority_record: {
          authorized_roles: [role],
          basis: "owner_explicit",
          live_call_limits: { evaluator: 0, reader: 0, total: 0, verification_helper: 0 },
          live_model_calls: false,
          recorded_at: timestamp,
          scope: "Deterministic CP8A mocked transport certification only.",
        },
        purpose: "Certify the bounded CP8A App Server adapter contract.",
        selection_reason: "This fixture proves one exact runtime-mediated role path.",
      },
      revision: 0,
      run_id: "run-cp8a",
      runtime_config_sha256: sha256Canonical(runtime),
      selected_units: [{ case_id: "case-one", role: role === "verification_helper" ? "reader" : role, suite: "regression", unit_id: "unit-one", variant: "candidate" }],
      state: "created",
      task_id: task.artifact_id,
    },
    producer: producer("harness"),
  });
  const outputSchemaName = {
    evaluator: "evaluator-proposal-v2",
    reader: "observation-v2",
    verification_helper: "verification-helper-v2",
  }[role];
  const invocation = compileInvocation({
    artifactId: `${role.replaceAll("_", "-")}-invocation-cp8a`,
    messages: [
      { content: "Follow the frozen runtime contract.", role: "developer" },
      { content: "Return the exact deterministic fixture output.", role: "user" },
    ],
    protocol: { observation_instructions: "Return exact structured output.", output_schema: outputSchemaName },
    requestedPolicy: policy,
    resources: [],
    role,
    run,
    runtime,
    tools: [],
    unitId,
  });
  const helperInputHash = sha256Canonical({ cluster: "helper-one", invocation_sha256: invocation.content_sha256 });
  const readiness =
    role === "verification_helper"
      ? null
      : createHarnessArtifact({
          artifactId: `${role}-readiness-cp8a`,
          artifactType: "readiness_analysis",
          links: [link("compiled_invocation", invocation), link("run", run)].sort(compareLinks),
          payload: {
            correction: null,
            field_results: [],
            grants: [{ invocation_sha256: invocation.content_sha256, nonce: "grant-cp8a", single_use: true, unit_id: unitId }],
            helper_attempt_ids: [],
            invocation_hashes: [invocation.content_sha256],
            round: 1,
            run_id: run.artifact_id,
            stage: role,
            status: "passed",
          },
          producer: producer("readiness"),
        });
  const attemptId = `${role.replaceAll("_", "-")}-attempt-cp8a`;
  const attemptLinks = [link("compiled_invocation", invocation), link("run", run)];
  if (readiness) attemptLinks.push(link("readiness", readiness));
  const attempt = createHarnessArtifact({
    artifactId: `${attemptId}-prepared`,
    artifactType: "execution_attempt",
    links: attemptLinks.sort(compareLinks),
    payload: {
      attempt_id: attemptId,
      call_certainty: "not_started",
      finished_at: null,
      input_sha256: role === "verification_helper" ? helperInputHash : invocation.content_sha256,
      outcome: null,
      phase: "prepared",
      role,
      run_id: run.artifact_id,
      sequence: 1,
      started_at: timestamp,
      unit_id: attemptUnitId,
    },
    producer: producer("orchestrator"),
  });
  createRunRecord(root, task, run, { now: timestamp });
  writeArtifactObject(root, invocation);
  if (readiness) writeArtifactObject(root, readiness);
  const lease = acquireRunLease(root, run.artifact_id, {
    durationMs: 86_400_000,
    host: "cp8a-fixture",
    now: timestamp,
    owner: "cp8a-test",
    pid: 808,
    token: `lease-${role.replaceAll("_", "-")}`,
  });
  if (persistPrepared) appendAttemptPhase(root, attempt, { leaseToken: lease.token, now: timestamp });
  const output = { role, value: "deterministic" };
  const transport = createMockTransport({
    authMode,
    driftOnSecondInspection,
    interruptResult,
    inspectGate,
    lookupStatus,
    output,
    policy,
    runtime,
    startTurnError,
    startTurnBeforeAckGate,
    startTurnCompletedThenError,
    startTurnGate,
    startThreadError,
    threadInstructionSha256,
  });
  if (!lookupSupported) delete transport.lookupTurn;
  const adapter = createCodexChatGptAppServerAdapter({
    faultAt,
    now: () => timestamp,
    outputSchemas: {
      "evaluator-proposal-v2": { additionalProperties: true, type: "object" },
      "observation-v2": { additionalProperties: true, type: "object" },
      "verification-helper-v2": { additionalProperties: true, type: "object" },
    },
    transport,
  });
  let dispatched = null;
  const markDispatched = () => {
    if (dispatched) return dispatched;
    dispatched = recreate(attempt, {
      artifactId: `${attemptId}-dispatched`,
      payload: { ...attempt.payload, call_certainty: "unknown", phase: "dispatched" },
    });
    appendAttemptPhase(root, dispatched, { leaseToken: lease.token, now: timestamp });
    return dispatched;
  };
  return {
    adapter,
    attempt,
    helperInputHash,
    invocation,
    lease,
    markDispatched,
    output,
    readiness,
    root,
    run,
    task,
    transport,
  };
}

function invokeFixture(fixture, requestOverrides = {}) {
  const role = fixture.invocation.payload.role;
  const method = {
    evaluator: "invokeEvaluator",
    reader: "invokeReader",
    verification_helper: "invokeVerificationHelper",
  }[role];
  const request = {
    grant_nonce: role === "verification_helper" ? fixture.helperInputHash : fixture.readiness.payload.grants[0].nonce,
    invocation_sha256: fixture.invocation.content_sha256,
    unit_id: role === "verification_helper" ? null : fixture.invocation.payload.unit_id,
    ...requestOverrides,
  };
  return fixture.adapter[method](request, {
    runtime: {
      attempt: fixture.attempt,
      graphArtifacts: [fixture.task, fixture.run, fixture.invocation, ...(fixture.readiness ? [fixture.readiness] : []), fixture.attempt],
      helperInputHash: role === "verification_helper" ? fixture.helperInputHash : undefined,
      invocation: fixture.invocation,
      leaseToken: fixture.lease.token,
      markDispatched: fixture.markDispatched,
      readiness: fixture.readiness,
      run: fixture.run,
      storeRoot: fixture.root,
    },
  });
}

function createMockTransport({
  authMode,
  driftOnSecondInspection,
  interruptResult,
  inspectGate,
  lookupStatus,
  output,
  policy,
  runtime,
  startTurnError,
  startTurnBeforeAckGate,
  startTurnCompletedThenError,
  startTurnGate,
  startThreadError,
  threadInstructionSha256,
}) {
  let inspections = 0;
  let threads = 0;
  let acknowledge;
  const acknowledged = new Promise((resolve) => {
    acknowledge = resolve;
  });
  return {
    acknowledged,
    async abortAttempt() {
      return { confirmed_not_started: true };
    },
    kind: "mock_codex_app_server",
    inspectionCalls: 0,
    threadWrites: 0,
    turnWrites: 0,
    async inspectRuntime() {
      if (inspectGate) await inspectGate;
      inspections += 1;
      this.inspectionCalls += 1;
      return {
        authMode,
        codexVersion: "0.1.0-test",
        configSha256: (driftOnSecondInspection && inspections > 1 ? "d" : "c").repeat(64),
        effectivePolicy: policy,
        effort: runtime.parameters.effort,
        executablePath: "C:/tools/codex.exe",
        executableSha256: "e".repeat(64),
        instructionSources: [{ path: "C:/VocaSpace/AGENTS.md", sha256: "a".repeat(64) }],
        model: runtime.model,
        platform: "win32-x64",
        protocolSchemaSha256: "f".repeat(64),
        runtimeIdentity: "codex-app-server-test",
      };
    },
    async interruptTurn() {
      return structuredClone(interruptResult);
    },
    async lookupTurn() {
      return lookupStatus === "completed"
        ? { status: lookupStatus, turn_id: "turn-thread-cp8a-1" }
        : { status: lookupStatus };
    },
    async startThread({ request }) {
      this.threadWrites += 1;
      if (startThreadError) throw new Error("mock thread bootstrap acknowledgement lost");
      threads += 1;
      return {
        instruction_sources: [{ path: "C:/VocaSpace/AGENTS.md", sha256: threadInstructionSha256 }],
        request_id: request.id,
        session_id: `session-cp8a-${threads}`,
        thread_id: `thread-cp8a-${threads}`,
      };
    },
    async startTurn({ onEvent, request }) {
      this.turnWrites += 1;
      const turnId = `turn-${request.params.threadId}`;
      if (startTurnError) {
        const error = new Error("mock transport failure");
        error.event = { code: "mock_transport_failure" };
        throw error;
      }
      if (startTurnBeforeAckGate) await startTurnBeforeAckGate;
      onEvent({ event: { bytes_written: true }, event_type: "turn_start_write_completed", status: "written", turn_id: turnId });
      onEvent({ event: { turn: { id: turnId } }, event_type: "turn_start_acknowledged", status: "acknowledged", turn_id: turnId });
      acknowledge();
      if (startTurnCompletedThenError) {
        onEvent({ event: { status: "completed" }, event_type: "turn_completed", status: "completed", turn_id: turnId });
        throw new Error("mock output delivery failed after terminal event");
      }
      if (startTurnGate) {
        await startTurnGate;
        throw new Error("mock interrupted turn closed without a normal completion response");
      }
      return {
        ack_event: { turn: { id: turnId } },
        completed_event: { status: "completed" },
        output: typeof output === "function" ? output(request) : output,
        request_id: request.id,
        terminal_status: "completed",
        thread_id: request.params.threadId,
        turn_id: turnId,
        write_event: { bytes_written: true },
      };
    },
  };
}

function recreate(artifact, overrides) {
  return createHarnessArtifact({
    artifactId: overrides.artifactId ?? artifact.artifact_id,
    artifactType: artifact.artifact_type,
    links: overrides.links ?? artifact.links,
    payload: overrides.payload ?? artifact.payload,
    producer: artifact.producer,
  });
}

function uniqueArtifacts(artifacts) {
  return [...new Map(artifacts.map((artifact) => [`${artifact.artifact_type}:${artifact.artifact_id}`, artifact])).values()];
}

function temporaryDirectory() {
  const root = mkdtempSync(join(tmpdir(), "skill-eval-cp8a-"));
  roots.push(root);
  return root;
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

function compareLinks(left, right) {
  return `${left.relationship}:${left.target_artifact_id}`.localeCompare(`${right.relationship}:${right.target_artifact_id}`);
}

function hasCode(code) {
  return (error) => error instanceof HarnessError && error.code === code;
}

function hasAnyCode(...codes) {
  return (error) => error instanceof HarnessError && codes.includes(error.code);
}

function hasCertainty(callCertainty) {
  return (error) => error?.callCertainty === callCertainty;
}

function hasCodeAndCertainty(code, callCertainty) {
  return (error) => error instanceof HarnessError && error.code === code && error.callCertainty === callCertainty;
}
