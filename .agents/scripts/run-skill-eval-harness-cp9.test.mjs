import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { PassThrough, Writable } from "node:stream";
import { canonicalJson, sha256Bytes, sha256Canonical } from "./lib/skill-evals/artifact-schema-v1.mjs";
import { createHarnessArtifact } from "./lib/skill-evals/harness-schema-v2.mjs";
import {
  cp9Admission,
  cp9OutputSchemas,
  cp9PreparationIdentitySha256,
  createPreparedCp9LiveGrant,
  issuePreparedCp9LiveAuthority,
  prepareCp9LivePilot,
  readCp9PreparationRecord,
  resolveCp9Preparation,
} from "./lib/skill-evals/cp9-prepare-v2.mjs";
import { executeCp9LivePlan } from "./lib/skill-evals/cp9-live-v2.mjs";
import {
  cp9AppServerProtocolSchemaSha256,
  createCodexAppServerStdioTransport,
  resolveCodexExecutable,
} from "./lib/skill-evals/codex-app-server-stdio-transport-v2.mjs";
import { appendTaskLifecycleEvent, readTaskLifecycle } from "./lib/skill-evals/retention-v2.mjs";
import { acquireRunLease, createRunRecord, inspectRunState, issueLiveDispatchAuthority, listStoredArtifacts, loadRunManifest, releaseRunLease, resolveLiveDispatchAuthority, transitionRun, writeArtifactObject } from "./lib/skill-evals/run-store-v2.mjs";

const exactExecutable = "C:/Users/khang/.codex/packages/standalone/releases/0.149.1-x86_64-pc-windows-msvc/bin/codex.exe";

// Test plan:
// - Mục tiêu: khóa CP9 preparation/execution identity, issuance và diagnostic evidence tại `thread/start` mà không gọi runtime thật.
// - Loại test: Node unit/integration với local Git/CAS fixtures và fake App Server method ledger.
// - Đối tượng: CP9 App Server transport, canonical preparation, grant issuance và live-authority join.
// - Case thành công:
//   - materialization exact/idempotent, LF/CRLF instruction-source projection, production authority issuance và acknowledged thread markers.
// - Case thất bại:
//   - malformed/cross-run request, hidden-index dirty source, instruction substitution, protocol failure, runtime/workload drift và bad authority.
// - Bảo mật/phân quyền:
//   - caller-authored state và non-preparation authority không thể mở transport hoặc mutation.
// - Ổn định/resilience:
//   - bounded stderr hash/count, ambiguous thread outcome STOP, exact-request replay và blocked-run isolation.
// - Invariant cần giữ:
//   - mỗi run sở hữu closure/authority/accounting riêng; instruction attestation giữ exact path/SHA và preparation không tự dispatch.
// - Kết quả verify gần nhất: focused CP9 runtime-readmission regression `2/2` passed.
// - Ghi chú: focused verification chỉ dùng fake transport/temp store; không có provider/model/reader/evaluator/helper call.

const tests = [];
const test = (name, run) => tests.push({ name, run });

test("unresolved executable fails before process launch", () => {
  assert.throws(() => resolveCodexExecutable("Z:/missing/codex.exe"), { code: "CODEX_EXECUTABLE_UNRESOLVED" });
});

test("access denial remains runtime_confirmed_not_started", async () => {
  let launches = 0;
  const transport = createCodexAppServerStdioTransport({
    executable: process.execPath,
    spawnProcess: () => {
      launches += 1;
      const child = processSkeleton();
      queueMicrotask(() => Object.assign(new Error("Access is denied"), { code: "EACCES" }) && child.emit("error", Object.assign(new Error("Access is denied"), { code: "EACCES" })));
      return child;
    },
  });
  await assert.rejects(transport.preflight(), (error) => error.code === "APP_SERVER_LAUNCH_DENIED" && error.runtimeStatus === "runtime_confirmed_not_started" && error.osCode === "EACCES");
  assert.equal(launches, 1);
  await assert.rejects(transport.preflight(), { code: "APP_SERVER_LAUNCH_DENIED" });
  assert.equal(launches, 1, "denied executable must not be repeatedly launched");
});

test("protocol readiness failure performs zero turn dispatches", async () => {
  const fake = protocolProcess({ failInitialize: true });
  const transport = createCodexAppServerStdioTransport({ executable: process.execPath, spawnProcess: () => fake.child });
  await assert.rejects(transport.preflight(), { code: "APP_SERVER_RPC_ERROR" });
  assert.equal(fake.methods.filter((method) => method === "turn/start").length, 0);
});

test("preflight proves readiness without thread or turn creation", async () => {
  const fake = protocolProcess();
  const transport = createCodexAppServerStdioTransport({ executable: process.execPath, spawnProcess: () => fake.child });
  const result = await transport.preflight();
  assert.equal(result.protocol_readiness, "ready");
  assert.equal(result.model_calls_dispatched, 0);
  assert.deepEqual(fake.methods, ["initialize", "initialized", "account/read", "model/list", "config/read"]);
});

test("App Server wire omits jsonrpc and follows thread/start then turn/start", async () => {
  const fake = protocolProcess();
  const transport = createCodexAppServerStdioTransport({ executable: process.execPath, spawnProcess: () => fake.child });
  const thread = await transport.startThread({ requestBytes: jsonl({ id: "thread-1", method: "thread/start", params: threadParams() }) });
  const events = [];
  const turn = await transport.startTurn({ onEvent: (event) => events.push(event), requestBytes: jsonl({ id: "turn-1", method: "turn/start", params: turnParams(thread.thread_id) }) });
  assert.deepEqual(fake.messages.map((message) => Object.hasOwn(message, "jsonrpc")), Array(fake.messages.length).fill(false));
  assert.deepEqual(fake.methods.slice(-2), ["thread/start", "turn/start"]);
  const threadRequest = fake.messages.find((message) => message.method === "thread/start");
  const turnRequest = fake.messages.find((message) => message.method === "turn/start");
  assert.equal(threadRequest.params.sandbox, undefined, "direct transport preserves already-compiled request bytes");
  assert.equal(turnRequest.params.sandboxPolicy, "read-only", "direct transport does not rewrite adapter-owned request bytes");
  assert.equal(events.filter((event) => event.event_type === "turn_start_write_completed").length, 1);
  assert.deepEqual(turn.output, { observation: "ok" });
});

test("thread/start write failure records no write-completed or response-observed marker", async () => {
  const { error, events } = await failedThreadStart("write_failure");
  assert.equal(error.code, "APP_SERVER_WRITE_FAILED");
  assert.deepEqual(events, []);
  assert.deepEqual(error.threadStartDiagnostic, {
    error_category: "write_failure",
    error_class: "HarnessError",
    error_code: "APP_SERVER_WRITE_FAILED",
    process_exit_code: null,
    process_exit_signal: null,
    process_exit_timing: null,
    response_channel_bytes_observed: false,
    response_bytes_observed: false,
    response_classification: "no_response_observed",
    rpc_error_code: null,
    stderr_byte_count: 0,
    stderr_sha256: sha256Bytes(Buffer.alloc(0)),
  });
});

test("thread/start write completion followed by process exit retains bounded stderr identity", async () => {
  const stderr = Buffer.from("Bearer secret-thread-token\nprivate@example.com\n", "utf8");
  const { error, events } = await failedThreadStart("process_exit", { stderr });
  assert.equal(error.code, "APP_SERVER_PROCESS_EXITED");
  assert.deepEqual(events, ["thread_start_write_completed"]);
  assert.equal(error.threadStartDiagnostic.error_category, "process_exit");
  assert.equal(error.threadStartDiagnostic.process_exit_code, 17);
  assert.equal(error.threadStartDiagnostic.process_exit_signal, "SIGTERM");
  assert.equal(error.threadStartDiagnostic.process_exit_timing, "during_thread_start");
  assert.equal(error.threadStartDiagnostic.response_channel_bytes_observed, false);
  assert.equal(error.threadStartDiagnostic.response_bytes_observed, false);
  assert.equal(error.threadStartDiagnostic.stderr_byte_count, stderr.length);
  assert.equal(error.threadStartDiagnostic.stderr_sha256, sha256Bytes(stderr));
  assert.equal(JSON.stringify(error.threadStartDiagnostic).includes("secret-thread-token"), false);
  assert.equal(Object.hasOwn(error.threadStartDiagnostic, "stderr"), false);
});

test("thread/start framing failure records channel bytes without claiming a matching response", async () => {
  const { error, events } = await failedThreadStart("framing_invalid");
  assert.equal(error.code, "APP_SERVER_PROTOCOL_INVALID");
  assert.deepEqual(events, ["thread_start_write_completed"]);
  assert.equal(error.threadStartDiagnostic.error_category, "protocol_failure");
  assert.equal(error.threadStartDiagnostic.response_channel_bytes_observed, true);
  assert.equal(error.threadStartDiagnostic.response_bytes_observed, false);
  assert.equal(error.threadStartDiagnostic.response_classification, "framing_invalid");
});

test("thread/start JSON decode failure remains distinct from invalid framing", async () => {
  const { error, events } = await failedThreadStart("json_invalid");
  assert.equal(error.code, "APP_SERVER_PROTOCOL_INVALID");
  assert.deepEqual(events, ["thread_start_write_completed"]);
  assert.equal(error.threadStartDiagnostic.error_category, "protocol_failure");
  assert.equal(error.threadStartDiagnostic.response_channel_bytes_observed, true);
  assert.equal(error.threadStartDiagnostic.response_bytes_observed, false);
  assert.equal(error.threadStartDiagnostic.response_classification, "json_invalid");
});

test("thread/start credential-unsafe valid JSON is protocol-invalid rather than JSON-invalid", async () => {
  const { error, events } = await failedThreadStart("credential_invalid");
  assert.equal(error.code, "APP_SERVER_PROTOCOL_INVALID");
  assert.deepEqual(events, ["thread_start_write_completed", "thread_start_response_observed"]);
  assert.equal(error.threadStartDiagnostic.response_channel_bytes_observed, true);
  assert.equal(error.threadStartDiagnostic.response_bytes_observed, true);
  assert.equal(error.threadStartDiagnostic.response_classification, "protocol_invalid");
});

test("thread/start unrelated notification followed by process exit does not claim a matching response", async () => {
  const { error, events } = await failedThreadStart("unrelated_notification_then_exit");
  assert.equal(error.code, "APP_SERVER_PROCESS_EXITED");
  assert.deepEqual(events, ["thread_start_write_completed"]);
  assert.equal(error.threadStartDiagnostic.response_channel_bytes_observed, true);
  assert.equal(error.threadStartDiagnostic.response_bytes_observed, false);
  assert.equal(error.threadStartDiagnostic.response_classification, "unrelated_notification_observed");
  assert.equal(error.threadStartDiagnostic.stderr_byte_count, 0);
  assert.equal(error.threadStartDiagnostic.stderr_sha256, sha256Bytes(Buffer.alloc(0)));
});

test("thread/start valid RPC error retains only its stable RPC code", async () => {
  const { error, events } = await failedThreadStart("rpc_error");
  assert.equal(error.code, "APP_SERVER_RPC_ERROR");
  assert.deepEqual(events, ["thread_start_write_completed", "thread_start_response_observed"]);
  assert.equal(error.threadStartDiagnostic.error_category, "rpc_error");
  assert.equal(error.threadStartDiagnostic.response_classification, "rpc_error");
  assert.equal(error.threadStartDiagnostic.rpc_error_code, -32_042);
});

test("thread/start invalid acknowledgement remains distinct from an acknowledged thread", async () => {
  const { error, events } = await failedThreadStart("invalid_acknowledgement");
  assert.equal(error.code, "APP_SERVER_THREAD_INVALID");
  assert.deepEqual(events, ["thread_start_write_completed", "thread_start_response_observed"]);
  assert.equal(error.threadStartDiagnostic.error_category, "invalid_acknowledgement");
  assert.equal(error.threadStartDiagnostic.response_classification, "invalid_thread_acknowledgement");
});

test("thread/start successful acknowledgement emits write and response markers before returning", async () => {
  const fake = protocolProcess({ threadStartMode: "acknowledged" });
  const transport = createCodexAppServerStdioTransport({ executable: process.execPath, spawnProcess: () => fake.child });
  const events = [];
  const thread = await transport.startThread({
    onEvent: ({ event_type: eventType }) => events.push(eventType),
    requestBytes: jsonl({ id: "thread-success-markers", method: "thread/start", params: threadParams() }),
  });
  assert.deepEqual(events, ["thread_start_write_completed", "thread_start_response_observed"]);
  assert.equal(thread.thread_id, "server-thread-success-markers");
});

test("instructionSources paths are locally hash-bound before turn dispatch", async () => {
  const fake = protocolProcess({ instructionSourcePath: process.execPath });
  const transport = createCodexAppServerStdioTransport({ executable: process.execPath, spawnProcess: () => fake.child });
  const thread = await transport.startThread({ requestBytes: jsonl({ id: "thread-sources", method: "thread/start", params: threadParams() }) });
  assert.equal(thread.instruction_sources[0].path.replaceAll("\\", "/"), process.execPath.replaceAll("\\", "/"));
  assert.match(thread.instruction_sources[0].sha256, /^[a-f0-9]{64}$/);
});

test("early notifications retain exact observed usage", async () => {
  const fake = protocolProcess({ usage: { inputTokens: 11, outputTokens: 7 } });
  const transport = createCodexAppServerStdioTransport({ executable: process.execPath, spawnProcess: () => fake.child });
  const thread = await transport.startThread({ requestBytes: jsonl({ id: "thread-usage", method: "thread/start", params: threadParams() }) });
  const turn = await transport.startTurn({ onEvent: () => {}, requestBytes: jsonl({ id: "turn-usage", method: "turn/start", params: turnParams(thread.thread_id) }) });
  assert.equal(turn.measurement.token_usage.status, "observed");
  assert.equal(turn.measurement.token_usage.event_count, 1);
  assert.match(turn.measurement.token_usage.event_json, /inputTokens/);
});

test("missing usage is reported unavailable", async () => {
  const fake = protocolProcess();
  const transport = createCodexAppServerStdioTransport({ executable: process.execPath, spawnProcess: () => fake.child });
  const thread = await transport.startThread({ requestBytes: jsonl({ id: "thread-no-usage", method: "thread/start", params: threadParams() }) });
  const turn = await transport.startTurn({ onEvent: () => {}, requestBytes: jsonl({ id: "turn-no-usage", method: "turn/start", params: turnParams(thread.thread_id) }) });
  assert.deepEqual(turn.measurement.token_usage, { status: "unavailable" });
});

test("turn completion may exceed the 15 second control-plane timeout without becoming outcome_unknown", async () => {
  const fake = protocolProcess({ turnCompletionDelayMs: 15_100 });
  const transport = createCodexAppServerStdioTransport({
    executable: process.execPath,
    requestTimeoutMs: 15_000,
    spawnProcess: () => fake.child,
    turnCompletionTimeoutMs: 16_000,
  });
  const thread = await transport.startThread({ requestBytes: jsonl({ id: "thread-delayed", method: "thread/start", params: threadParams() }) });
  const turn = await transport.startTurn({ onEvent: () => {}, requestBytes: jsonl({ id: "turn-delayed", method: "turn/start", params: turnParams(thread.thread_id) }) });
  assert.deepEqual(turn.output, { observation: "ok" });
  assert.equal(turn.terminal_status, "completed");
});

test("mismatched early notification ownership fails closed", async () => {
  const fake = protocolProcess({ wrongThread: true });
  const transport = createCodexAppServerStdioTransport({ executable: process.execPath, spawnProcess: () => fake.child });
  const thread = await transport.startThread({ requestBytes: jsonl({ id: "thread-owner", method: "thread/start", params: threadParams() }) });
  await assert.rejects(
    transport.startTurn({ onEvent: () => {}, requestBytes: jsonl({ id: "turn-owner", method: "turn/start", params: turnParams(thread.thread_id) }) }),
    { code: "APP_SERVER_PROTOCOL_OWNERSHIP_INVALID" },
  );
  assert.equal(fake.methods.filter((method) => method === "turn/start").length, 1);
});

test("wire messages carrying jsonrpc are rejected before write", async () => {
  const fake = protocolProcess();
  const transport = createCodexAppServerStdioTransport({ executable: process.execPath, spawnProcess: () => fake.child });
  await assert.rejects(transport.startThread({ requestBytes: jsonl({ id: "bad", jsonrpc: "2.0", method: "thread/start", params: threadParams() }) }), { code: "APP_SERVER_PROTOCOL_INVALID" });
  assert.equal(fake.methods.includes("thread/start"), false);
});

test("protocol identity is a stable SHA-256", () => assert.match(cp9AppServerProtocolSchemaSha256, /^[a-f0-9]{64}$/));

test("admitted preparation materializes exact task run readiness and four plans with zero dispatch", async () => {
  const fixture = createPreparationFixture("valid");
  try {
    const result = await prepareFixture(fixture, { protocolLedger: true });
    assert.equal(fixture.probeCalls, 1);
    assert.deepEqual(fixture.protocolMethods, ["initialize", "initialized", "account/read", "model/list", "config/read"]);
    assert.equal(result.reference.task_id, "cp9-live-5dfe3a01315ef048a5c7d000");
    assert.equal(result.reference.run_id, `cp9-live-5dfe3a01315ef048a5c7d000-run-${sha256Canonical(cp9ExecutionRequest("execution-default")).slice(0, 24)}`);
    assert.equal(result.preparation.preparation_version, "cp9-live-preparation-v2");
    assert.equal(result.preparation.preparation_identity_sha256, cp9PreparationIdentitySha256());
    assert.deepEqual(result.preparation.execution_request, cp9ExecutionRequest("execution-default"));
    assert.equal(result.plans.length, 4);
    assert.deepEqual(result.plans.map((item) => item.plan.stage), ["reader-canary", "reader-phase1", "reader-phase2", "evaluator"]);
    assert.equal(result.preparation.live_call_limits.reader, 15);
    assert.equal(result.preparation.live_call_limits.evaluator, 12);
    assert.equal(result.preparation.live_call_limits.verification_helper, 0);
    assert.equal(result.preparation.live_call_limits.total, 27);
    assert.equal(result.preparation.turn_completion_timeout_ms, 120_000);
    assert.deepEqual(result.preparation.output_schema_sha256s, cp9Admission.output_schema_sha256s);
    for (const { plan } of result.plans) {
      assert.equal(plan.reader_invocation_sha256s.length, 12);
      assert.match(plan.reader_readiness_sha256, /^[a-f0-9]{64}$/);
      assert.match(plan.evaluator_static_readiness_sha256, /^[a-f0-9]{64}$/);
    }
    const phase1 = result.plans.find((item) => item.plan.stage === "reader-phase1").plan;
    const phase2 = result.plans.find((item) => item.plan.stage === "reader-phase2").plan;
    const phase1ByUnit = invocationHashesByUnit(fixture.storeRoot, phase1);
    const phase2ByUnit = invocationHashesByUnit(fixture.storeRoot, phase2);
    assert.deepEqual([...phase1ByUnit].filter(([unitId, hash]) => phase2ByUnit.get(unitId) !== hash).map(([unitId]) => unitId), [
      "reader-ghci-fresh-self-fix-cycle-candidate",
      "reader-ghci-reg-explicit-fix-exact-actions-candidate",
      "reader-ghci-route-db-risk-stop-candidate",
    ]);
    for (const hash of phase1.reader_invocation_sha256s) {
      const invocation = readStoredArtifact(fixture.storeRoot, hash);
      const packageMessage = invocation.payload.messages.find((message) => message.role === "user").content;
      assert.doesNotMatch(packageMessage, /"(?:source_ref|variant)":/, "reader package keeps baseline/candidate identity blind");
    }
    assertNoExecutionDescendants(fixture.storeRoot, result.reference.run_id);
    assertNoLiveAuthority(fixture.storeRoot, result.reference.run_id);
  } finally {
    fixture.close();
  }
});

test("prepared grant is issued only through the existing exact production authority owner", async () => {
  const fixture = createPreparationFixture("authority");
  try {
    const prepared = await prepareFixture(fixture);
    const issuedAt = "2026-08-25T02:00:00.000Z";
    const grant = createPreparedCp9LiveGrant(fixture.storeRoot, prepared.reference, { now: issuedAt });
    const issuanceAuthority = {
      action: "issue_live_dispatch_authority",
      kind: "owner",
      run_id: prepared.reference.run_id,
      subject_sha256: sha256Canonical(grant),
      task_id: prepared.reference.task_id,
    };
    const reference = issuePreparedCp9LiveAuthority(fixture.storeRoot, {
      authorityVerifier: (candidate) => candidate.subject_sha256 === issuanceAuthority.subject_sha256,
      issuanceAuthority,
      now: issuedAt,
      preparationReference: prepared.reference,
    });
    assert.deepEqual(resolveLiveDispatchAuthority(fixture.storeRoot, reference).grant, grant);
  } finally {
    fixture.close();
  }
});

test("identical preparation is idempotent and does not repeat preflight or dispatch", async () => {
  const fixture = createPreparationFixture("idempotent");
  try {
    const first = await prepareFixture(fixture);
    const second = await prepareFixture(fixture);
    assert.deepEqual(second, first);
    assert.equal(fixture.probeCalls, 2, "repeated preparation may repeat only the admitted zero-dispatch preflight");
    assertNoExecutionDescendants(fixture.storeRoot, first.reference.run_id);
  } finally {
    fixture.close();
  }
});

test("fresh execution requests create isolated runs while blocked history stays immutable", async () => {
  const fixture = createPreparationFixture("fresh-execution");
  try {
    const preparedA = await prepareFixture(fixture, { executionRequest: cp9ExecutionRequest("owner-pilot-a") });
    const replayA = await prepareFixture(fixture, { executionRequest: cp9ExecutionRequest("owner-pilot-a") });
    assert.deepEqual(replayA, preparedA);
    assert.equal(runCount(fixture.storeRoot), 1, "exact replay must not allocate another run generation");
    const authorityA = issuePreparedAuthority(fixture.storeRoot, preparedA);
    const canaryA = preparedA.plans.find((item) => item.plan.stage === "reader-canary").plan;
    const ledgerA = [];
    const resultA = await executeCp9LivePlan({
      authorityReference: authorityA,
      executable: exactExecutable,
      plan: canaryA,
      storeRoot: fixture.storeRoot,
      transportFactory: liveFakeTransportFactory(ledgerA),
    });
    assert.equal(resultA.calls, 2);

    blockRun(fixture.storeRoot, preparedA.reference.run_id);
    const runARoot = join(fixture.storeRoot, "runs", preparedA.reference.run_id);
    const blockedA = snapshotTree(runARoot);
    let blockedTransports = 0;
    await assert.rejects(executeCp9LivePlan({
      authorityReference: authorityA,
      executable: exactExecutable,
      plan: canaryA,
      storeRoot: fixture.storeRoot,
      transportFactory: () => { blockedTransports += 1; throw new Error("blocked run must stop before transport"); },
    }), { code: "CP9_PILOT_STOPPED" });
    assert.equal(blockedTransports, 0);

    const preparedB = await prepareFixture(fixture, { executionRequest: cp9ExecutionRequest("owner-pilot-b") });
    assert.equal(preparedB.preparation.preparation_identity_sha256, preparedA.preparation.preparation_identity_sha256);
    assert.equal(preparedB.reference.task_id, preparedA.reference.task_id);
    assert.notEqual(preparedB.reference.run_id, preparedA.reference.run_id);
    assert.equal(runCount(fixture.storeRoot), 2);
    assert.deepEqual(snapshotTree(runARoot), blockedA, "fresh materialization must not mutate blocked run A");
    assertNoExecutionDescendants(fixture.storeRoot, preparedB.reference.run_id);
    assertNoLiveAuthority(fixture.storeRoot, preparedB.reference.run_id);

    const canaryB = preparedB.plans.find((item) => item.plan.stage === "reader-canary").plan;
    assertPreparedClosureOwnsRun(fixture.storeRoot, preparedB, canaryB);
    let crossRunTransports = 0;
    await assert.rejects(executeCp9LivePlan({
      authorityReference: authorityA,
      executable: exactExecutable,
      plan: canaryB,
      storeRoot: fixture.storeRoot,
      transportFactory: () => { crossRunTransports += 1; throw new Error("cross-run authority must stop before transport"); },
    }), { code: "CP9_AUTHORITY_NOT_PREPARED" });
    assert.equal(crossRunTransports, 0);

    const authorityB = issuePreparedAuthority(fixture.storeRoot, preparedB);
    const ledgerB = [];
    const resultB = await executeCp9LivePlan({
      authorityReference: authorityB,
      executable: exactExecutable,
      plan: canaryB,
      storeRoot: fixture.storeRoot,
      transportFactory: liveFakeTransportFactory(ledgerB),
    });
    assert.equal(resultB.calls, 2, "run B must not reuse run A observations");
    const attemptsA = inspectRunState(fixture.storeRoot, preparedA.reference.run_id).attempts;
    const attemptsB = inspectRunState(fixture.storeRoot, preparedB.reference.run_id).attempts;
    assert.equal(attemptsA.length, 2);
    assert.equal(attemptsB.length, 2);
    assert(attemptsA.every((attempt) => attempt.phases.terminal?.payload.run_id === preparedA.reference.run_id));
    assert(attemptsB.every((attempt) => attempt.phases.terminal?.payload.run_id === preparedB.reference.run_id));
    assert.equal(reservationCount(fixture.storeRoot, preparedA.reference.run_id), 2);
    assert.equal(reservationCount(fixture.storeRoot, preparedB.reference.run_id), 2);
    assert.deepEqual(snapshotTree(runARoot), blockedA, "run B execution must not mutate run A accounting or evidence");
  } finally {
    fixture.close();
  }
});

test("fresh execution requires the canonical task lifecycle to remain active", async () => {
  const active = createPreparationFixture("fresh-execution-active-lifecycle");
  try {
    const prepared = await prepareFixture(active, { executionRequest: cp9ExecutionRequest("owner-active-a") });
    const fresh = await prepareFixture(active, { executionRequest: cp9ExecutionRequest("owner-active-b") });
    assert.equal(readTaskLifecycle(active.storeRoot, prepared.reference.task_id).state, "active");
    assert.equal(runCount(active.storeRoot), 2);
    assert.notEqual(fresh.reference.run_id, prepared.reference.run_id);
  } finally {
    active.close();
  }

  for (const terminalState of ["closed", "abandoned"]) {
    const fixture = createPreparationFixture(`fresh-execution-${terminalState}-lifecycle`);
    try {
      const prepared = await prepareFixture(fixture, { executionRequest: cp9ExecutionRequest(`owner-${terminalState}-a`) });
      transitionPreparationTaskLifecycle(fixture.storeRoot, prepared.reference.task_id, terminalState);
      assert.equal(readTaskLifecycle(fixture.storeRoot, prepared.reference.task_id).state, terminalState);
      const before = snapshotTree(fixture.storeRoot);

      await assert.rejects(
        prepareFixture(fixture, { executionRequest: cp9ExecutionRequest(`owner-${terminalState}-b`) }),
        { code: "CP9_PREPARATION_CONFLICT" },
      );

      assert.equal(runCount(fixture.storeRoot), 1, `${terminalState} task must reject before fresh run materialization`);
      assert.deepEqual(snapshotTree(fixture.storeRoot), before, `${terminalState} task/history/tree must remain unchanged`);
    } finally {
      fixture.close();
    }
  }
});

test("malformed and cross-preparation execution requests fail before materialization", async () => {
  const fixture = createPreparationFixture("execution-request-invalid");
  try {
    await assert.rejects(prepareFixture(fixture, { executionRequest: undefined }), { code: "CP9_EXECUTION_REQUEST_INVALID" });
    assert.equal(existsSync(fixture.storeRoot), false);
    await assert.rejects(prepareFixture(fixture, { executionRequest: { ...cp9ExecutionRequest("duplicate-shape"), duplicate: true } }), { code: "CP9_EXECUTION_REQUEST_INVALID" });
    assert.equal(existsSync(fixture.storeRoot), false);
    await assert.rejects(prepareFixture(fixture, { executionRequest: { ...cp9ExecutionRequest("wrong-preparation"), preparation_identity_sha256: "8".repeat(64) } }), { code: "CP9_EXECUTION_REQUEST_INVALID" });
    assert.equal(existsSync(fixture.storeRoot), false);
  } finally {
    fixture.close();
  }
});

test("legacy preparation v1 record remains readable without implicit migration", () => {
  const fixture = createPreparationFixture("legacy-preparation-v1");
  try {
    const legacy = retainedLegacyPreparationV1();
    const path = join(fixture.storeRoot, "runs", legacy.run_id, "cp9", "preparation.json");
    mkdirSync(join(fixture.storeRoot, "runs", legacy.run_id, "cp9"), { recursive: true });
    writeFileSync(path, canonicalJson(legacy), "utf8");
    const before = readFileSync(path, "utf8");
    const read = readCp9PreparationRecord(fixture.storeRoot, {
      preparation_sha256: legacy.preparation_sha256,
      run_id: legacy.run_id,
      task_id: legacy.task_id,
    });
    assert.deepEqual(read, legacy);
    assert.equal(Object.hasOwn(read, "execution_request"), false);
    assert.equal(Object.hasOwn(read, "preparation_identity_sha256"), false);
    assert.equal(readFileSync(path, "utf8"), before);
    const malformed = { ...legacy, execution_request: {} };
    delete malformed.preparation_sha256;
    malformed.preparation_sha256 = sha256Canonical(malformed);
    writeFileSync(path, canonicalJson(malformed), "utf8");
    assert.throws(() => readCp9PreparationRecord(fixture.storeRoot, {
      preparation_sha256: malformed.preparation_sha256,
      run_id: malformed.run_id,
      task_id: malformed.task_id,
    }), { code: "CP9_PREPARATION_UNRESOLVED" });
  } finally {
    fixture.close();
  }
});

test("changed executable model effort and budget-shaped state fail closed", async () => {
  const fixture = createPreparationFixture("runtime-drift");
  try {
    await assert.rejects(prepareFixture(fixture, { executable: "C:/wrong/codex.exe" }), { code: "CP9_ADMISSION_MISMATCH" });
    await assert.rejects(prepareFixture(fixture, { preflight: { model: "wrong-model" } }), { code: "CP9_ADMISSION_MISMATCH" });
    await assert.rejects(prepareFixture(fixture, { preflight: { effort: "high" } }), { code: "CP9_ADMISSION_MISMATCH" });
    const prepared = await prepareFixture(fixture);
    await assert.rejects(prepareFixture(fixture, { preflight: { config_sha256: "8".repeat(64) } }), { code: "CP9_ADMISSION_MISMATCH" });
    const preparationPath = join(fixture.storeRoot, "runs", prepared.reference.run_id, "cp9", "preparation.json");
    const record = JSON.parse(readFileSync(preparationPath, "utf8"));
    record.live_call_limits.reader = 14;
    writeFileSync(preparationPath, canonicalJson(record), "utf8");
    assert.throws(() => resolveCp9Preparation(fixture.storeRoot, prepared.reference), { code: "CP9_PREPARATION_UNRESOLVED" });
  } finally {
    fixture.close();
  }
});

test("changed admitted workload fails closed before materialization", async () => {
  const fixture = createPreparationFixture("workload-drift");
  try {
    const suitePath = join(fixture.repository, ".agents", "evals", "git-checkpoint-workflow", "routing.json");
    const suite = JSON.parse(readFileSync(suitePath, "utf8"));
    suite.cases.find((entry) => entry.case_id === "gcw-route-push-remote").executor_input.prompt += " changed";
    writeFileSync(suitePath, JSON.stringify(suite, null, 2), "utf8");
    await assert.rejects(prepareFixture(fixture), { code: "CP9_ADMISSION_MISMATCH" });
  } finally {
    fixture.close();
  }
});

test("runtime readmission accepts the current 8f8805b6 config", async () => {
  const fixture = createPreparationFixture("runtime-readmission-current");
  try {
    const prepared = await prepareFixture(fixture, {
      preflight: { config_sha256: "8f8805b61bb5d3515307012b094ebe195bd9fc6e14afac072715ec470752c25f" },
    });
    assert.equal(prepared.preparation.execution_request.request_version, "cp9-live-execution-request-v1");
    assert.equal(existsSync(join(fixture.storeRoot, "tasks", prepared.reference.task_id, "task.json")), true);
    assert.equal(existsSync(join(fixture.storeRoot, "runs", prepared.reference.run_id, "manifest.json")), true);
    assert.equal(fixture.probeCalls, 1);
  } finally {
    fixture.close();
  }
});

test("runtime readmission rejects the old 400ceb4e config before materialization", async () => {
  const fixture = createPreparationFixture("runtime-readmission-old");
  try {
    await assert.rejects(prepareFixture(fixture, {
      preflight: { config_sha256: "400ceb4e253cb32522daf656974d92970c8ba1ed244b94e76d41d92ed974f2e8" },
    }), { code: "CP9_ADMISSION_MISMATCH" });
    assert.deepEqual(readdirSync(join(fixture.storeRoot, "tasks")), []);
    assert.deepEqual(readdirSync(join(fixture.storeRoot, "runs")), []);
    assert.equal(fixture.probeCalls, 1);
  } finally {
    fixture.close();
  }
});

test("clean CRLF instruction-source checkout matches production thread projection", async () => {
  const fixture = createPreparationFixture("instruction-source-crlf");
  try {
    const { blob, workingTree } = checkoutInstructionSource(fixture, "crlf");
    assert.equal(countCrLf(blob), 0);
    assert.equal(countCrLf(workingTree) > 0, true);
    assert.notEqual(sha256Bytes(blob), sha256Bytes(workingTree));
    await assertPreparedInstructionSourceMatchesThread(fixture);
  } finally {
    fixture.close();
  }
});

test("clean LF instruction-source checkout matches production thread projection", async () => {
  const fixture = createPreparationFixture("instruction-source-lf");
  try {
    const { blob, workingTree } = checkoutInstructionSource(fixture, "lf");
    assert.equal(countCrLf(blob), 0);
    assert.equal(countCrLf(workingTree), 0);
    assert.equal(sha256Bytes(blob), sha256Bytes(workingTree));
    await assertPreparedInstructionSourceMatchesThread(fixture);
  } finally {
    fixture.close();
  }
});

test("genuine instruction-source substitution fails before turn/start", async () => {
  const fixture = createPreparationFixture("instruction-source-substitution");
  try {
    checkoutInstructionSource(fixture, "lf");
    const prepared = await prepareFixture(fixture);
    const authorityReference = issuePreparedAuthority(fixture.storeRoot, prepared);
    const instructionPath = join(fixture.repository, "AGENTS.md");
    writeFileSync(instructionPath, `${readFileSync(instructionPath, "utf8")}\nsubstituted instruction\n`, "utf8");
    const ledger = [];
    const plan = prepared.plans.find(({ plan: candidate }) => candidate.stage === "reader-canary").plan;

    const result = await executeCp9LivePlan({
      authorityReference,
      executable: exactExecutable,
      plan,
      storeRoot: fixture.storeRoot,
      transportFactory: liveFakeTransportFactory(ledger, { instructionSourcePath: instructionPath }),
    });

    assert.equal(result.run_state, "blocked");
    assert.equal(result.calls, 0);
    assert.equal(ledger.filter((message) => message.method === "thread/start").length, 1);
    assert.equal(ledger.filter((message) => message.method === "turn/start").length, 0);
    const diagnostic = readPredispatchDiagnostic(fixture.storeRoot, prepared.reference.run_id);
    assert.deepEqual(diagnostic, {
      error_code: "APP_SERVER_INSTRUCTION_SOURCE_MISMATCH",
      predispatch_step: "instruction_source_validation",
      retry_class: "instruction_source_mismatch",
    });
  } finally {
    fixture.close();
  }
});

test("dirty instruction-source checkout is rejected before materialization", async () => {
  const fixture = createPreparationFixture("instruction-source-dirty");
  try {
    const path = join(fixture.repository, "AGENTS.md");
    assert.equal(gitFixture(fixture, ["status", "--porcelain=v1", "--", "AGENTS.md"]), "");

    await assert.rejects(prepareFixture(fixture, {
      onRuntimeProbe: () => writeFileSync(path, `${readFileSync(path, "utf8")}\ndirty instruction\n`, "utf8"),
    }), { code: "CP9_ADMISSION_MISMATCH" });
    assert.notEqual(gitFixture(fixture, ["status", "--porcelain=v1", "--", "AGENTS.md"]), "");
    assert.deepEqual(readdirSync(join(fixture.storeRoot, "tasks")), []);
    assert.deepEqual(readdirSync(join(fixture.storeRoot, "runs")), []);
  } finally {
    fixture.close();
  }
});

test("assume-unchanged cannot hide a modified instruction-source from admission", async () => {
  const fixture = createPreparationFixture("instruction-source-assume-unchanged");
  try {
    await assertHiddenInstructionSourceRejected(fixture, "--assume-unchanged");
  } finally {
    fixture.close();
  }
});

test("skip-worktree cannot hide a modified instruction-source from admission", async () => {
  const fixture = createPreparationFixture("instruction-source-skip-worktree");
  try {
    await assertHiddenInstructionSourceRejected(fixture, "--skip-worktree");
  } finally {
    fixture.close();
  }
});

test("first preparation rejects committed behavior-relevant context drift without materialization", async () => {
  const fixture = createPreparationFixture("committed-context-drift");
  try {
    const contextPath = join(fixture.repository, "docs", "agent-loops.md");
    writeFileSync(contextPath, `${readFileSync(contextPath, "utf8")}\ncommitted drift\n`, "utf8");
    execFileSync("git", ["add", "docs/agent-loops.md"], { cwd: fixture.repository, windowsHide: true });
    execFileSync("git", ["-c", "user.name=CP9 Test", "-c", "user.email=cp9@example.invalid", "commit", "--quiet", "-m", "test: drift admitted context"], { cwd: fixture.repository, windowsHide: true });
    await assert.rejects(prepareFixture(fixture), { code: "CP9_ADMISSION_MISMATCH" });
    assert.deepEqual(readdirSync(join(fixture.storeRoot, "tasks")), []);
    assert.deepEqual(readdirSync(join(fixture.storeRoot, "runs")), []);
  } finally {
    fixture.close();
  }
});

test("first preparation rejects runtime config drift without materialization or dispatch", async () => {
  const fixture = createPreparationFixture("first-config-drift");
  try {
    await assert.rejects(prepareFixture(fixture, { preflight: { config_sha256: "8".repeat(64) }, protocolLedger: true }), { code: "CP9_ADMISSION_MISMATCH" });
    assert.deepEqual(readdirSync(join(fixture.storeRoot, "tasks")), []);
    assert.deepEqual(readdirSync(join(fixture.storeRoot, "runs")), []);
    assert.equal(fixture.probeCalls, 1);
    assert.deepEqual(fixture.protocolMethods, ["initialize", "initialized", "account/read", "model/list", "config/read"]);
  } finally {
    fixture.close();
  }
});

test("first preparation rejects the superseded high-effort runtime admission without materialization", async () => {
  const fixture = createPreparationFixture("superseded-runtime");
  try {
    await assert.rejects(prepareFixture(fixture, {
      preflight: {
        config_sha256: "349a383d4d348c48288cea738b61f2dbcebb0bb32ba5cc1c55150aa38934b60d",
        effort: "high",
      },
      protocolLedger: true,
    }), { code: "CP9_ADMISSION_MISMATCH" });
    assert.deepEqual(readdirSync(join(fixture.storeRoot, "tasks")), []);
    assert.deepEqual(readdirSync(join(fixture.storeRoot, "runs")), []);
    assert.deepEqual(fixture.protocolMethods, ["initialize", "initialized", "account/read", "model/list", "config/read"]);
  } finally {
    fixture.close();
  }
});

test("first preparation rejects the superseded medium config admission without materialization", async () => {
  const fixture = createPreparationFixture("superseded-medium-config");
  try {
    await assert.rejects(prepareFixture(fixture, {
      preflight: {
        config_sha256: "6f38a9f22d10b5fa430637ce5be6a586f5728c000727141afb20be2a4f79bcf4",
      },
      protocolLedger: true,
    }), { code: "CP9_ADMISSION_MISMATCH" });
    assert.deepEqual(readdirSync(join(fixture.storeRoot, "tasks")), []);
    assert.deepEqual(readdirSync(join(fixture.storeRoot, "runs")), []);
    assert.equal(fixture.probeCalls, 1);
    assert.deepEqual(fixture.protocolMethods, ["initialize", "initialized", "account/read", "model/list", "config/read"]);
  } finally {
    fixture.close();
  }
});

test("first preparation rejects the superseded 4d043050 config admission without materialization", async () => {
  const fixture = createPreparationFixture("superseded-4d043050-config");
  try {
    await assert.rejects(prepareFixture(fixture, {
      preflight: {
        config_sha256: "4d04305014de339dcafe3902c3446e22e977fcf003250d4156017bd98fd2412a",
      },
      protocolLedger: true,
    }), { code: "CP9_ADMISSION_MISMATCH" });
    assert.deepEqual(readdirSync(join(fixture.storeRoot, "tasks")), []);
    assert.deepEqual(readdirSync(join(fixture.storeRoot, "runs")), []);
    assert.equal(fixture.probeCalls, 1);
    assert.deepEqual(fixture.protocolMethods, ["initialize", "initialized", "account/read", "model/list", "config/read"]);
  } finally {
    fixture.close();
  }
});

test("first preparation rejects the superseded f4ba64aa config admission without materialization", async () => {
  const fixture = createPreparationFixture("superseded-f4ba64aa-config");
  try {
    await assert.rejects(prepareFixture(fixture, {
      preflight: {
        config_sha256: "f4ba64aa2d899e1633786a7ae3c8616adaad5e5b82e5c0f7f16dd0c78a0aabc4",
      },
      protocolLedger: true,
    }), { code: "CP9_ADMISSION_MISMATCH" });
    assert.deepEqual(readdirSync(join(fixture.storeRoot, "tasks")), []);
    assert.deepEqual(readdirSync(join(fixture.storeRoot, "runs")), []);
    assert.equal(fixture.probeCalls, 1);
    assert.deepEqual(fixture.protocolMethods, ["initialize", "initialized", "account/read", "model/list", "config/read"]);
  } finally {
    fixture.close();
  }
});

test("first preparation rejects the superseded 46e8fbee config admission without materialization", async () => {
  const fixture = createPreparationFixture("superseded-46e8fbee-config");
  try {
    await assert.rejects(prepareFixture(fixture, {
      preflight: {
        config_sha256: "46e8fbeee8a3fedb0ceea326818c28f7dc695753a8e3ac12c69ecabf94fc73ad",
      },
      protocolLedger: true,
    }), { code: "CP9_ADMISSION_MISMATCH" });
    assert.deepEqual(readdirSync(join(fixture.storeRoot, "tasks")), []);
    assert.deepEqual(readdirSync(join(fixture.storeRoot, "runs")), []);
    assert.equal(fixture.probeCalls, 1);
    assert.deepEqual(fixture.protocolMethods, ["initialize", "initialized", "account/read", "model/list", "config/read"]);
  } finally {
    fixture.close();
  }
});

test("caller cannot replace canonical plan run or grant state", async () => {
  const fixture = createPreparationFixture("replacement");
  try {
    const prepared = await prepareFixture(fixture);
    const changedPlan = structuredClone(prepared.plans[0].plan);
    changedPlan.reader_invocation_sha256s.reverse();
    await assert.rejects(executeCp9LivePlan({
      authorityReference: {},
      executable: exactExecutable,
      plan: changedPlan,
      storeRoot: fixture.storeRoot,
      transportFactory: () => { throw new Error("transport must not be created"); },
    }), { code: "CP9_PLAN_NOT_PREPARED" });
    assert.throws(() => issuePreparedCp9LiveAuthority(fixture.storeRoot, {
      authorityVerifier: () => true,
      issuanceAuthority: { arbitrary: true },
      preparationReference: prepared.reference,
    }), { code: "STORE_RECORD_INVALID" });
  } finally {
    fixture.close();
  }
});

test("grant issuance rejects missing prepared CAS closure before authority creation", async () => {
  const fixture = createPreparationFixture("missing-closure");
  try {
    const prepared = await prepareFixture(fixture);
    const missingHash = prepared.plans[0].plan.reader_invocation_sha256s[0];
    rmSync(join(fixture.storeRoot, "objects", missingHash.slice(0, 2), missingHash), { force: true, recursive: true });
    assert.throws(() => createPreparedCp9LiveGrant(fixture.storeRoot, prepared.reference), { code: "CP9_PREPARATION_STALE" });
    assert.equal(existsSync(join(fixture.storeRoot, "runs", prepared.reference.run_id, "authority", "live-dispatch.json")), false);
  } finally {
    fixture.close();
  }
});

test("grant issuance rejects an independently valid donor invocation graph", async () => {
  const source = createPreparationFixture("source-closure");
  const donor = createPreparationFixture("donor-closure");
  try {
    const sourcePrepared = await prepareFixture(source);
    const donorPrepared = await prepareFixture(donor);
    assert.doesNotThrow(() => createPreparedCp9LiveGrant(source.storeRoot, sourcePrepared.reference));
    assert.doesNotThrow(() => createPreparedCp9LiveGrant(donor.storeRoot, donorPrepared.reference));
    const sourcePlanItem = sourcePrepared.plans[0];
    const sourceHash = sourcePlanItem.plan.reader_invocation_sha256s[0];
    const sourceInvocation = readStoredArtifact(source.storeRoot, sourceHash);
    const donorHash = invocationHashesByUnit(donor.storeRoot, donorPrepared.plans[0].plan).get(sourceInvocation.payload.unit_id);
    const donorRun = readStoredArtifact(donor.storeRoot, donorPrepared.preparation.run_content_sha256);
    const donorTaskHash = donorRun.links.find((link) => link.relationship === "task").target_content_sha256;
    const donorInvocation = readStoredArtifact(donor.storeRoot, donorHash);
    writeArtifactObject(source.storeRoot, readStoredArtifact(donor.storeRoot, donorTaskHash));
    writeArtifactObject(source.storeRoot, donorRun);
    writeArtifactObject(source.storeRoot, donorInvocation);

    const sourceReadiness = readStoredArtifact(source.storeRoot, sourcePlanItem.plan.reader_readiness_sha256);
    const reboundReadiness = rebindReaderReadiness(sourceReadiness, sourceHash, donorInvocation);
    writeArtifactObject(source.storeRoot, reboundReadiness);
    const changedPlan = structuredClone(sourcePlanItem.plan);
    changedPlan.reader_invocation_sha256s[0] = donorHash;
    changedPlan.reader_invocation_sha256s.sort();
    changedPlan.reader_readiness_sha256 = reboundReadiness.content_sha256;
    writeFileSync(sourcePlanItem.path, canonicalJson(changedPlan), "utf8");
    const preparationPath = join(source.storeRoot, "runs", sourcePrepared.reference.run_id, "cp9", "preparation.json");
    const preparation = JSON.parse(readFileSync(preparationPath, "utf8"));
    preparation.plan_entries.find((entry) => entry.stage === changedPlan.stage).content_sha256 = sha256Canonical(changedPlan);
    const envelope = { ...preparation };
    delete envelope.preparation_sha256;
    preparation.preparation_sha256 = sha256Canonical(envelope);
    writeFileSync(preparationPath, canonicalJson(preparation), "utf8");
    const changedReference = {
      preparation_sha256: preparation.preparation_sha256,
      run_id: preparation.run_id,
      task_id: preparation.task_id,
    };
    const before = snapshotTree(join(source.storeRoot, "runs", preparation.run_id));
    assert.throws(() => createPreparedCp9LiveGrant(source.storeRoot, changedReference), { code: "CP9_PREPARATION_STALE" });
    assert.deepEqual(snapshotTree(join(source.storeRoot, "runs", preparation.run_id)), before);
    assertNoExecutionDescendants(source.storeRoot, preparation.run_id);
    assertNoLiveAuthority(source.storeRoot, preparation.run_id);
  } finally {
    source.close();
    donor.close();
  }
});

test("grant issuance rejects an independently valid donor readiness relationship", async () => {
  const source = createPreparationFixture("source-readiness");
  const donor = createPreparationFixture("donor-readiness");
  try {
    const sourcePrepared = await prepareFixture(source);
    const donorPrepared = await prepareFixture(donor);
    assert.doesNotThrow(() => createPreparedCp9LiveGrant(source.storeRoot, sourcePrepared.reference));
    assert.doesNotThrow(() => createPreparedCp9LiveGrant(donor.storeRoot, donorPrepared.reference));
    const sourcePlanItem = sourcePrepared.plans[0];
    const donorPlan = donorPrepared.plans[0].plan;
    const donorRun = readStoredArtifact(donor.storeRoot, donorPrepared.preparation.run_content_sha256);
    const donorTaskHash = donorRun.links.find((link) => link.relationship === "task").target_content_sha256;
    writeArtifactObject(source.storeRoot, readStoredArtifact(donor.storeRoot, donorTaskHash));
    writeArtifactObject(source.storeRoot, donorRun);
    for (const hash of donorPlan.reader_invocation_sha256s) writeArtifactObject(source.storeRoot, readStoredArtifact(donor.storeRoot, hash));
    const donorReadiness = readStoredArtifact(donor.storeRoot, donorPlan.reader_readiness_sha256);
    writeArtifactObject(source.storeRoot, donorReadiness);

    const changedPlan = structuredClone(sourcePlanItem.plan);
    changedPlan.reader_readiness_sha256 = donorReadiness.content_sha256;
    writeFileSync(sourcePlanItem.path, canonicalJson(changedPlan), "utf8");
    const preparationPath = join(source.storeRoot, "runs", sourcePrepared.reference.run_id, "cp9", "preparation.json");
    const preparation = JSON.parse(readFileSync(preparationPath, "utf8"));
    preparation.plan_entries.find((entry) => entry.stage === changedPlan.stage).content_sha256 = sha256Canonical(changedPlan);
    const envelope = { ...preparation };
    delete envelope.preparation_sha256;
    preparation.preparation_sha256 = sha256Canonical(envelope);
    writeFileSync(preparationPath, canonicalJson(preparation), "utf8");

    const changedReference = { preparation_sha256: preparation.preparation_sha256, run_id: preparation.run_id, task_id: preparation.task_id };
    const before = snapshotTree(join(source.storeRoot, "runs", preparation.run_id));
    assert.throws(() => createPreparedCp9LiveGrant(source.storeRoot, changedReference), { code: "CP9_PREPARATION_STALE" });
    assert.deepEqual(snapshotTree(join(source.storeRoot, "runs", preparation.run_id)), before);
    assertNoExecutionDescendants(source.storeRoot, preparation.run_id);
    assertNoLiveAuthority(source.storeRoot, preparation.run_id);
  } finally {
    source.close();
    donor.close();
  }
});

test("live rejects donor-run and alternate same-run authorities before target mutation", async () => {
  const fixture = createPreparationFixture("authority-cross-bind");
  try {
    const prepared = await prepareFixture(fixture);
    const plan = prepared.plans[0].plan;
    const sourceRun = readStoredArtifact(fixture.storeRoot, prepared.preparation.run_content_sha256);
    const donorTask = createHarnessArtifact({
      artifactId: "cp9-donor-task",
      artifactType: "task_manifest",
      payload: { ...JSON.parse(readFileSync(join(fixture.storeRoot, "tasks", prepared.reference.task_id, "task.json"), "utf8")).payload, task_id: "cp9-donor-task" },
      producer: { kind: "harness", name: "cp9-test", version: "2" },
    });
    const donorRun = createHarnessArtifact({
      artifactId: "cp9-donor-run",
      artifactType: "run_manifest",
      links: [{ relationship: "task", target_artifact_id: donorTask.artifact_id, target_artifact_type: donorTask.artifact_type, target_content_sha256: donorTask.content_sha256 }],
      payload: { ...sourceRun.payload, revision: 0, run_id: "cp9-donor-run", state: "created", task_id: "cp9-donor-task" },
      producer: { kind: "harness", name: "cp9-test", version: "2" },
    });
    createRunRecord(fixture.storeRoot, donorTask, donorRun, { now: "2026-08-25T02:00:00.000Z" });
    const donorGrant = grantForRun(donorRun, "cp9-donor-grant");
    const donorReference = issueExactAuthority(fixture.storeRoot, donorGrant);
    const sourceGrant = { ...grantForRun(sourceRun, "cp9-alternate-same-run"), issuer: "cp9-preparation-owner" };
    const alternateReference = issueExactAuthority(fixture.storeRoot, sourceGrant);
    const targetRunRoot = join(fixture.storeRoot, "runs", prepared.reference.run_id);
    const reservationPath = join(targetRunRoot, "authority", "live-call-reservations");
    let transports = 0;
    for (const authorityReference of [donorReference, alternateReference]) {
      const before = snapshotTree(targetRunRoot);
      await assert.rejects(executeCp9LivePlan({
        authorityReference,
        executable: exactExecutable,
        plan,
        storeRoot: fixture.storeRoot,
        transportFactory: () => { transports += 1; return {}; },
      }), { code: "CP9_AUTHORITY_NOT_PREPARED" });
      assert.deepEqual(snapshotTree(targetRunRoot), before);
    }
    assert.equal(transports, 0);
    assert.equal(existsSync(reservationPath), false);
    assertNoExecutionDescendants(fixture.storeRoot, prepared.reference.run_id);
  } finally {
    fixture.close();
  }
});

test("cp9 live refuses syntactically valid unprepared inputs before transport creation", async () => {
  const fixture = createPreparationFixture("unprepared");
  try {
    const prepared = await prepareFixture(fixture);
    const plan = prepared.plans[0].plan;
    const emptyStore = join(fixture.directory, "empty-store");
    let transports = 0;
    await assert.rejects(executeCp9LivePlan({
      authorityReference: {},
      executable: exactExecutable,
      plan,
      storeRoot: emptyStore,
      transportFactory: () => { transports += 1; return {}; },
    }), { code: "CP9_PREPARATION_REQUIRED" });
    assert.equal(transports, 0);
  } finally {
    fixture.close();
  }
});

test("CP9 fake App Server topology exposes exact contracts and reuses nine unchanged phase2 readers", async () => {
  const fixture = createPreparationFixture("topology");
  try {
    const prepared = await prepareFixture(fixture);
    const authorityReference = issuePreparedAuthority(fixture.storeRoot, prepared);
    const ledger = [];
    const plans = new Map(prepared.plans.map(({ plan }) => [plan.stage, plan]));
    const results = [];
    for (const stage of ["reader-canary", "reader-phase1"]) {
      const result = await executeCp9LivePlan({
        authorityReference,
        executable: exactExecutable,
        plan: plans.get(stage),
        storeRoot: fixture.storeRoot,
        transportFactory: liveFakeTransportFactory(ledger),
      });
      assert.notEqual(result.run_state, "blocked", canonicalJson(result));
      results.push(result);
    }
    const blockedStore = join(fixture.directory, "blocked-store");
    cpSync(fixture.storeRoot, blockedStore, { recursive: true });
    const phase2 = await executeCp9LivePlan({
      authorityReference,
      executable: exactExecutable,
      plan: plans.get("reader-phase2"),
      storeRoot: fixture.storeRoot,
      transportFactory: liveFakeTransportFactory(ledger),
    });
    assert.notEqual(phase2.run_state, "blocked", canonicalJson(phase2));
    results.push(phase2);
    assert.deepEqual(results.map((result) => result.calls), [2, 10, 3]);
    const unchanged = expectedPhase2UnchangedReaderIds();
    assert.deepEqual(results[2].resumed_unit_ids, unchanged);
    assert.deepEqual(results[2].invalidated_unit_ids, [
      "reader-ghci-fresh-self-fix-cycle-candidate",
      "reader-ghci-reg-explicit-fix-exact-actions-candidate",
      "reader-ghci-route-db-risk-stop-candidate",
    ]);
    const readerAttempts = inspectRunState(fixture.storeRoot, prepared.reference.run_id).attempts
      .map((record) => record.phases.terminal ?? record.phases.dispatched ?? record.phases.prepared)
      .filter((attempt) => attempt.payload.role === "reader");
    const reruns = readerAttempts.filter((attempt) => attempt.payload.sequence > 1);
    assert.equal(reruns.length, 3);
    for (const rerun of reruns) {
      const previous = readerAttempts.find((attempt) =>
        attempt.payload.unit_id === rerun.payload.unit_id && attempt.payload.sequence === rerun.payload.sequence - 1
      );
      assert.notEqual(rerun.payload.input_sha256, previous.payload.input_sha256);
    }

    const evaluator = await executeCp9LivePlan({
      authorityReference,
      executable: exactExecutable,
      plan: plans.get("evaluator"),
      storeRoot: fixture.storeRoot,
      transportFactory: liveFakeTransportFactory(ledger, { failThreadStartAfter: 1 }),
    });
    assert.equal(evaluator.calls, 1);
    assert.equal(evaluator.failed_unit_ids.length, 1);
    const turns = ledger.filter((message) => message.method === "turn/start");
    assert.equal(turns.length, 16);
    assert.equal(turns.filter((message) => message.params.outputSchema.required.includes("observation")).length, 15);
    assert.equal(turns.filter((message) => message.params.outputSchema.required.includes("case_status")).length, 1);
    for (const message of turns) {
      const renderedInput = message.params.input.map((item) => item.text).join("\n");
      assert.match(renderedInput, /HARNESS_CONTRACT_V1/);
      assert.match(renderedInput, /observation_instructions/);
      assert.equal(message.params.outputSchema.additionalProperties, false);
    }
    assert.deepEqual(turns.find((message) => message.params.outputSchema.required.includes("observation")).params.outputSchema, cp9OutputSchemas["observation-v2"]);
    assert.deepEqual(turns.find((message) => message.params.outputSchema.required.includes("case_status")).params.outputSchema, cp9OutputSchemas["evaluator-proposal-v2"]);
    const phase2ReaderTurns = turns.slice(12, 15).map((message) => message.id.replace(/^turn-reader-/, "").replace(/-attempt-\d+$/, "")).sort();
    assert.deepEqual(phase2ReaderTurns, [
      "reader-ghci-fresh-self-fix-cycle-candidate",
      "reader-ghci-reg-explicit-fix-exact-actions-candidate",
      "reader-ghci-route-db-risk-stop-candidate",
    ]);
    const blockedLedger = [];
    const blocked = await executeCp9LivePlan({
      authorityReference,
      executable: exactExecutable,
      plan: plans.get("reader-phase2"),
      storeRoot: blockedStore,
      transportFactory: liveFakeTransportFactory(blockedLedger, { driftRuntime: true }),
    });
    assert.equal(blocked.run_state, "blocked");
    assert.equal(blocked.calls, 0);
    assert.equal(blocked.blocked_unit_ids.length, 1);
    const runRoot = join(blockedStore, "runs", prepared.reference.run_id);
    const before = snapshotTree(runRoot);
    const turnCount = blockedLedger.filter((message) => message.method === "turn/start").length;
    let transports = 0;
    await assert.rejects(executeCp9LivePlan({
      authorityReference,
      executable: exactExecutable,
      plan: plans.get("reader-phase2"),
      storeRoot: blockedStore,
      transportFactory: () => { transports += 1; throw new Error("blocked state must fail before transport"); },
    }), { code: "CP9_PILOT_STOPPED" });
    assert.equal(transports, 0);
    assert.equal(blockedLedger.filter((message) => message.method === "turn/start").length, turnCount);
    assert.deepEqual(snapshotTree(runRoot), before);
  } finally {
    fixture.close();
  }
});

const selectedTestName = process.env.CP9_TEST_NAME_CONTAINS ?? null;
const selectedTests = selectedTestName === null
  ? tests
  : tests.filter((entry) => entry.name.includes(selectedTestName));
if (selectedTests.length === 0) throw new Error("CP9_TEST_NAME_CONTAINS selected no deterministic tests.");
for (const entry of selectedTests) {
  try {
    await entry.run();
    process.stdout.write(`ok - ${entry.name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${entry.name}\n${error.stack}\n`);
    process.exitCode = 1;
  }
}

function createPreparationFixture(suffix) {
  const directory = mkdtempSync(join(tmpdir(), `cp9-prepare-${suffix}-`));
  const repository = join(directory, "repository");
  execFileSync("git", ["clone", "--quiet", "--no-hardlinks", resolve("."), repository], { windowsHide: true });
  const storeRoot = join(directory, "store");
  const fixture = {
    close: () => rmSync(directory, { force: true, recursive: true }),
    directory,
    probeCalls: 0,
    protocolMethods: [],
    repository,
    storeRoot,
  };
  return fixture;
}

function gitFixture(fixture, args) {
  return execFileSync("git", args, { cwd: fixture.repository, encoding: "utf8", windowsHide: true }).trim();
}

function checkoutInstructionSource(fixture, eol) {
  assert.ok(["crlf", "lf"].includes(eol));
  gitFixture(fixture, ["config", "core.autocrlf", "true"]);
  if (eol === "lf") {
    writeFileSync(join(fixture.repository, ".git", "info", "attributes"), "AGENTS.md -text\n", "utf8");
  }
  const blob = execFileSync("git", ["show", "HEAD:AGENTS.md"], { cwd: fixture.repository, windowsHide: true });
  const bytes = eol === "crlf"
    ? Buffer.from(blob.toString("utf8").replaceAll("\n", "\r\n"), "utf8")
    : blob;
  writeFileSync(join(fixture.repository, "AGENTS.md"), bytes);
  gitFixture(fixture, ["add", "AGENTS.md"]);
  assert.equal(gitFixture(fixture, ["diff", "--cached", "--name-only", "--", "AGENTS.md"]), "");
  assert.equal(gitFixture(fixture, ["status", "--porcelain=v1", "--", "AGENTS.md"]), "");
  return { blob, workingTree: bytes };
}

function countCrLf(bytes) {
  let count = 0;
  for (let index = 0; index < bytes.length - 1; index += 1) {
    if (bytes[index] === 13 && bytes[index + 1] === 10) count += 1;
  }
  return count;
}

async function assertPreparedInstructionSourceMatchesThread(fixture) {
  const prepared = await prepareFixture(fixture);
  const runtime = prepared.plans.find(({ plan }) => plan.stage === "evaluator").plan.evaluator.runtime.behavior_runtime;
  const instructionPath = join(fixture.repository, "AGENTS.md");
  const fake = protocolProcess({ instructionSourcePath: instructionPath });
  const transport = createCodexAppServerStdioTransport({ executable: process.execPath, spawnProcess: () => fake.child });
  try {
    const thread = await transport.startThread({ requestBytes: jsonl({ id: "thread-instruction-projection", method: "thread/start", params: threadParams() }) });
    assert.deepEqual(runtime.instruction_sources, thread.instruction_sources);
    assert.equal(runtime.instruction_sources[0].sha256, sha256Bytes(readFileSync(instructionPath)));
  } finally {
    await transport.close();
  }
}

async function assertHiddenInstructionSourceRejected(fixture, flag) {
  checkoutInstructionSource(fixture, "lf");
  const path = join(fixture.repository, "AGENTS.md");
  gitFixture(fixture, ["update-index", flag, "--", "AGENTS.md"]);
  writeFileSync(path, `${readFileSync(path, "utf8")}\nhidden dirty instruction\n`, "utf8");
  assert.equal(gitFixture(fixture, ["status", "--porcelain=v1", "--", "AGENTS.md"]), "");

  await assert.rejects(prepareFixture(fixture), { code: "CP9_ADMISSION_MISMATCH" });
  assert.deepEqual(readdirSync(join(fixture.storeRoot, "tasks")), []);
  assert.deepEqual(readdirSync(join(fixture.storeRoot, "runs")), []);
}

function readPredispatchDiagnostic(storeRoot, runId) {
  const events = readFileSync(join(storeRoot, "runs", runId, "journal.ndjson"), "utf8")
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line));
  return events.find((event) => event.type === "runtime_recorded" && event.details.event === "predispatch_failure_diagnostic")?.details.diagnostic;
}

function invocationHashesByUnit(storeRoot, plan) {
  return new Map(plan.reader_invocation_sha256s.map((hash) => {
    const artifact = readStoredArtifact(storeRoot, hash);
    return [artifact.payload.unit_id, hash];
  }).sort(([left], [right]) => left.localeCompare(right)));
}

function readStoredArtifact(storeRoot, hash) {
  return JSON.parse(readFileSync(join(storeRoot, "objects", hash.slice(0, 2), hash, "artifact.json"), "utf8"));
}

function grantForRun(run, grantId) {
  return {
    assurance_profile: run.payload.intent.assurance_profile,
    authentication_boundary: run.payload.intent.authentication_boundary,
    authorized_roles: run.payload.intent.authority_record.authorized_roles,
    grant_id: grantId,
    issued_at: "2026-08-25T02:00:00.000Z",
    issuer: "cp9-test-owner",
    live_call_limits: run.payload.intent.authority_record.live_call_limits,
    run_id: run.artifact_id,
    runtime_config_sha256: run.payload.runtime_config_sha256,
    task_id: run.payload.task_id,
  };
}

function issueExactAuthority(storeRoot, grant) {
  const issuanceAuthority = {
    action: "issue_live_dispatch_authority",
    kind: "owner",
    run_id: grant.run_id,
    subject_sha256: sha256Canonical(grant),
    task_id: grant.task_id,
  };
  return issueLiveDispatchAuthority(storeRoot, {
    authorityVerifier: (candidate) => canonicalJson(candidate) === canonicalJson(issuanceAuthority),
    grant,
    issuanceAuthority,
    now: grant.issued_at,
  });
}

function issuePreparedAuthority(storeRoot, prepared) {
  const issuedAt = "2026-08-25T02:00:00.000Z";
  const grant = createPreparedCp9LiveGrant(storeRoot, prepared.reference, { now: issuedAt });
  const issuanceAuthority = {
    action: "issue_live_dispatch_authority",
    kind: "owner",
    run_id: prepared.reference.run_id,
    subject_sha256: sha256Canonical(grant),
    task_id: prepared.reference.task_id,
  };
  return issuePreparedCp9LiveAuthority(storeRoot, {
    authorityVerifier: (candidate) => canonicalJson(candidate) === canonicalJson(issuanceAuthority),
    issuanceAuthority,
    now: issuedAt,
    preparationReference: prepared.reference,
  });
}

function liveFakeTransportFactory(ledger, { driftRuntime = false, failThreadStartAfter = null, instructionSourcePath = null } = {}) {
  return ({ executable, expectedRuntime, turnCompletionTimeoutMs }) => {
    assert.equal(turnCompletionTimeoutMs, 120_000);
    assert.equal(expectedRuntime.config_sha256, cp9Admission.config_sha256);
    const fake = protocolProcess({ expectedRuntime, failThreadStartAfter, instructionSourcePath, ledger, structuredOutput: true });
    const fakeConfigSha256 = sha256Canonical({ approval_policy: "never" });
    const transport = createCodexAppServerStdioTransport({
      executable,
      expectedRuntime: { ...expectedRuntime, config_sha256: fakeConfigSha256 },
      spawnProcess: () => fake.child,
      turnCompletionTimeoutMs,
    });
    const inspectRuntime = transport.inspectRuntime.bind(transport);
    return {
      ...transport,
      async inspectRuntime() {
        const inspection = await inspectRuntime();
        return { ...inspection, configSha256: driftRuntime ? "8".repeat(64) : expectedRuntime.config_sha256 };
      },
    };
  };
}

function expectedPhase2UnchangedReaderIds() {
  const affected = new Set([
    "reader-ghci-fresh-self-fix-cycle-candidate",
    "reader-ghci-reg-explicit-fix-exact-actions-candidate",
    "reader-ghci-route-db-risk-stop-candidate",
  ]);
  return [
    ...new Set(cp9CaseIdsForTest().flatMap((caseId) => [`reader-${caseId}-baseline`, `reader-${caseId}-candidate`])),
  ].filter((unitId) => !affected.has(unitId)).sort();
}

function cp9CaseIdsForTest() {
  return [
    "gcw-fresh-dirty-secret-stop",
    "gcw-reg-commit-versus-push",
    "gcw-route-push-remote",
    "ghci-fresh-self-fix-cycle",
    "ghci-reg-explicit-fix-exact-actions",
    "ghci-route-db-risk-stop",
  ];
}

async function prepareFixture(fixture, options = {}) {
  const preflight = {
    account_type: "chatgpt",
    codex_version: "Codex Desktop/0.149.1 (Windows 10.0.26200; x86_64) dumb (vocaspace_skill_eval_harness; 2)",
    config_sha256: "8f8805b61bb5d3515307012b094ebe195bd9fc6e14afac072715ec470752c25f",
    effort: "medium",
    executable_path: exactExecutable,
    executable_resolution: "resolved",
    executable_sha256: "a395030b56b126f608f2403036dddb654a9c063213e9c2b5f85d954cf490ebe6",
    model: "gpt-5.6-sol",
    model_calls_dispatched: 0,
    platform: "x86_64-pc-windows-msvc",
    process_launch: "ready",
    protocol_readiness: "ready",
    thread_creation: "not_started",
    turn_dispatch: "not_started",
    ...options.preflight,
  };
  return prepareCp9LivePilot({
    executable: options.executable ?? exactExecutable,
    executionRequest: Object.hasOwn(options, "executionRequest") ? options.executionRequest : cp9ExecutionRequest("execution-default"),
    now: "2026-08-25T01:00:00.000Z",
    repositoryRoot: fixture.repository,
    runtimeProbe: async () => {
      fixture.probeCalls += 1;
      options.onRuntimeProbe?.();
      if (options.protocolLedger) {
        const fake = protocolProcess();
        const transport = createCodexAppServerStdioTransport({ executable: process.execPath, spawnProcess: () => fake.child });
        try {
          await transport.preflight();
        } finally {
          await transport.close();
        }
        fixture.protocolMethods.push(...fake.methods);
      }
      return preflight;
    },
    storeRoot: fixture.storeRoot,
  });
}

function cp9ExecutionRequest(executionRequestId) {
  return {
    execution_request_id: executionRequestId,
    preparation_identity_sha256: cp9PreparationIdentitySha256(),
    request_version: "cp9-live-execution-request-v1",
  };
}

function blockRun(storeRoot, runId) {
  const now = new Date().toISOString();
  const lease = acquireRunLease(storeRoot, runId, { durationMs: 60_000, now, owner: "cp9-test-block" });
  try {
    const run = loadRunManifest(storeRoot, runId);
    transitionRun(storeRoot, { expectedRevision: run.payload.revision, leaseToken: lease.token, nextState: "blocked", now, runId });
  } finally {
    releaseRunLease(storeRoot, runId, lease.token, { now });
  }
}

function transitionPreparationTaskLifecycle(storeRoot, taskId, nextState) {
  const abandoned = nextState === "abandoned";
  const action = abandoned ? "abandon_task" : "close_task";
  const authorityId = `cp9-${nextState}-${taskId}`;
  appendTaskLifecycleEvent(storeRoot, {
    authority: {
      action,
      authority_id: authorityId,
      issued_at: "2026-08-25T01:30:00.000Z",
      issuer: "repository-owner",
      kind: "owner",
      task_id: taskId,
    },
    authorityVerifier: () => true,
    basis: abandoned ? "owner_abandoned" : "owner_reconciled_close",
    basisIdentity: abandoned
      ? { decision_id: authorityId, reason: "Owner explicitly abandoned this CP9 preparation task." }
      : {
          decision_id: authorityId,
          merge_commit: "d".repeat(40),
          merged_head_commit: "e".repeat(40),
          pull_request: "owner/repo#90",
          reason: "Owner reconciled this CP9 preparation task after merge.",
          repository: "owner/repo",
        },
    expectedPriorEventSha256: null,
    expectedSequence: 1,
    now: "2026-08-25T01:30:00.000Z",
    taskId,
  });
}

function assertPreparedClosureOwnsRun(storeRoot, prepared, plan) {
  const hashes = [
    ...plan.reader_invocation_sha256s,
    plan.evaluator_static_invocation_sha256,
    plan.reader_readiness_sha256,
    plan.evaluator_static_readiness_sha256,
  ];
  for (const hash of hashes) {
    assert.equal(readStoredArtifact(storeRoot, hash).payload.run_id, prepared.reference.run_id);
  }
  assert(prepared.plans.every((item) => item.plan.run_id === prepared.reference.run_id));
}

function reservationCount(storeRoot, runId) {
  const directory = join(storeRoot, "runs", runId, "authority", "live-call-reservations");
  return existsSync(directory) ? readdirSync(directory).filter((name) => name.endsWith(".json")).length : 0;
}

function runCount(storeRoot) {
  const directory = join(storeRoot, "runs");
  return existsSync(directory) ? readdirSync(directory, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length : 0;
}

function retainedLegacyPreparationV1() {
  return {
    admission_contract_sha256: "b2076980f69a25b2b2e3b5563f2dcdb3eb1f7a57234e46cf12b56b4b12ccc294",
    case_ids: cp9CaseIdsForTest(),
    effort: "medium",
    executable_path: exactExecutable,
    executable_sha256: "a395030b56b126f608f2403036dddb654a9c063213e9c2b5f85d954cf490ebe6",
    grant_template_sha256: "83e064eae33152d18d80d837af6279b4966f072c0d17b000c796f953bc93fe20",
    live_call_limits: { evaluator: 12, reader: 15, total: 27, verification_helper: 0 },
    model: "gpt-5.6-sol",
    output_schema_sha256s: cp9Admission.output_schema_sha256s,
    plan_entries: [
      ["reader-canary", "f20fe32e6927ebc941734c4b56e4ed790a68c4154bdc8004c52e1bab1170b501"],
      ["reader-phase1", "010dcc960ee2e782fef5940d48b4994af0699608286dd2780735c2208a6fd782"],
      ["reader-phase2", "e32768b71ae6734b3ea8f0696669077522df9151ef1d1e87de581746e9612b27"],
      ["evaluator", "075a77f962b29b22c5a77cb8709fefc7e78a72cbb945c97e4c8e133c50d16da9"],
    ].map(([stage, content_sha256]) => ({
      content_sha256,
      relative_path: `runs/cp9-live-20accbc8ecf85b369847bca3-run/cp9/plans/${stage}.json`,
      stage,
    })),
    preparation_sha256: "58ed19fad5829d79881ed98f2910aad4942efb6fd0b9d137e559aa85bb4b8cd7",
    preparation_version: "cp9-live-preparation-v1",
    prepared_at: "2026-08-27T14:20:37.050Z",
    repository_head: "bfec7c34bb382227696a3289532c34630dfa970f",
    run_content_sha256: "c21663514ea598e847fc4db3722c065f06d62835b16e4e848d96cec117e9387a",
    run_id: "cp9-live-20accbc8ecf85b369847bca3-run",
    runtime_config_sha256: "774bb7ece17a94ab9351b8f692c2c7feb28146b58521b72a3c843e1e027ff3ce",
    task_id: "cp9-live-20accbc8ecf85b369847bca3",
    turn_completion_timeout_ms: 120_000,
  };
}

function rebindReaderReadiness(sourceReadiness, sourceInvocationHash, donorInvocation) {
  const payload = structuredClone(sourceReadiness.payload);
  payload.invocation_hashes = payload.invocation_hashes.map((hash) => hash === sourceInvocationHash ? donorInvocation.content_sha256 : hash).sort();
  payload.grants = payload.grants.map((grant) => grant.invocation_sha256 === sourceInvocationHash ? {
    ...grant,
    invocation_sha256: donorInvocation.content_sha256,
    nonce: `grant-${sha256Canonical({ hash: donorInvocation.content_sha256, round: payload.round }).slice(0, 24)}`,
  } : grant).sort((left, right) => left.unit_id < right.unit_id ? -1 : left.unit_id > right.unit_id ? 1 : 0);
  const links = sourceReadiness.links.map((link) =>
    link.relationship === "compiled_invocation" && link.target_content_sha256 === sourceInvocationHash
      ? {
          relationship: "compiled_invocation",
          target_artifact_id: donorInvocation.artifact_id,
          target_artifact_type: donorInvocation.artifact_type,
          target_content_sha256: donorInvocation.content_sha256,
        }
      : link
  ).sort((left, right) => {
    const leftKey = `${left.relationship}:${left.target_artifact_type}:${left.target_artifact_id}`;
    const rightKey = `${right.relationship}:${right.target_artifact_type}:${right.target_artifact_id}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  return createHarnessArtifact({
    artifactId: sourceReadiness.artifact_id,
    artifactType: sourceReadiness.artifact_type,
    links,
    payload,
    producer: sourceReadiness.producer,
  });
}

function assertNoExecutionDescendants(storeRoot, runId) {
  const forbiddenTypes = new Set([
    "evaluator_proposal",
    "execution_attempt",
    "generated_report",
    "human_evaluation",
    "human_review_decision",
    "observation",
    "resource_observation",
    "run_review_summary",
    "runtime_attestation",
    "runtime_dispatch_request",
    "runtime_event",
    "verification_helper_input",
  ]);
  const forbidden = listStoredArtifacts(storeRoot, { runId }).filter((artifact) => forbiddenTypes.has(artifact.artifact_type));
  assert.deepEqual(forbidden.map((artifact) => `${artifact.artifact_type}:${artifact.artifact_id}`), []);
  const runRoot = join(storeRoot, "runs", runId);
  assert.equal(existsSync(join(runRoot, "attempts")), false);
  assert.equal(existsSync(join(runRoot, "runtime")), false);
  const lease = JSON.parse(readFileSync(join(runRoot, "lease", "lease.json"), "utf8"));
  assert.equal(lease.state, "released");
  assert.equal(existsSync(join(runRoot, "authority", "live-call-reservations")), false);
}

function assertNoLiveAuthority(storeRoot, runId) {
  assert.equal(existsSync(join(storeRoot, "runs", runId, "authority", "live-dispatch-authorities")), false);
}

function snapshotTree(root) {
  if (!existsSync(root)) return [];
  const entries = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(directory, entry.name);
      const name = relative(root, path).replaceAll("\\", "/");
      if (entry.isDirectory()) {
        entries.push({ kind: "directory", name });
        visit(path);
      } else {
        entries.push({ kind: "file", name, sha256: sha256Bytes(readFileSync(path)) });
      }
    }
  };
  visit(root);
  return entries;
}

function processSkeleton() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  child.kill = () => true;
  return child;
}

function protocolProcess({ expectedRuntime = null, failInitialize = false, failThreadStartAfter = null, instructionSourcePath = null, ledger = null, stderr = null, structuredOutput = false, threadStartMode = "acknowledged", turnCompletionDelayMs = 0, usage = null, wrongThread = false } = {}) {
  const child = processSkeleton();
  child.pid = 9001;
  const messages = [];
  const methods = [];
  let threadStarts = 0;
  child.stdin = new Writable({
    write(chunk, _encoding, done) {
      const message = JSON.parse(Buffer.from(chunk).toString("utf8"));
      messages.push(message);
      ledger?.push(message);
      methods.push(message.method);
      if (message.method === "thread/start" && threadStartMode === "write_failure") {
        done(new Error("deterministic fake pipe failure"));
        return;
      }
      setImmediate(() => respond(message));
      done();
    },
  });
  function send(value) { child.stdout.write(jsonl(value)); }
  function respond(message) {
    if (message.method === "initialized") return;
    if (message.method === "initialize") return send(failInitialize
      ? { error: { message: "not ready" }, id: message.id }
      : {
          id: message.id,
          result: {
            platformFamily: expectedRuntime ? "x86_64-pc" : "windows",
            platformOs: expectedRuntime ? "windows-msvc" : "windows",
            userAgent: expectedRuntime?.codex_version ?? "codex-test/1",
          },
        });
    if (message.method === "account/read") return send({ id: message.id, result: { account: { type: "chatgpt" } } });
    if (message.method === "model/list") return send({ id: message.id, result: { data: [{ id: "gpt-5.6-sol", supportedReasoningEfforts: [{ reasoningEffort: "medium" }] }] } });
    if (message.method === "config/read") return send({ id: message.id, result: { config: { approval_policy: "never" } } });
    if (message.method === "thread/start") {
      threadStarts += 1;
      if (threadStartMode === "process_exit") {
        if (stderr) child.stderr.write(stderr);
        child.emit("exit", 17, "SIGTERM");
        return;
      }
      if (threadStartMode === "framing_invalid") {
        child.stdout.write(Buffer.from("\n", "utf8"));
        return;
      }
      if (threadStartMode === "json_invalid") {
        child.stdout.write(Buffer.from("{not-json}\n", "utf8"));
        return;
      }
      if (threadStartMode === "credential_invalid") {
        return send({ id: message.id, result: { secret: "Bearer deterministic-secret-value" } });
      }
      if (threadStartMode === "unrelated_notification_then_exit") {
        send({ method: "account/updated", params: { reason: "deterministic-test" } });
        setImmediate(() => child.emit("exit", 18, null));
        return;
      }
      if (threadStartMode === "rpc_error") {
        return send({ error: { code: -32_042, message: "deterministic sensitive server detail" }, id: message.id });
      }
      if (threadStartMode === "invalid_acknowledgement") {
        return send({ id: message.id, result: { thread: { unexpected: true } } });
      }
      if (failThreadStartAfter !== null && threadStarts > failThreadStartAfter) {
        return send({ error: { message: "bounded fake stop" }, id: message.id });
      }
      return send({ id: message.id, result: { instructionSources: instructionSourcePath ? [instructionSourcePath] : expectedRuntime?.instruction_sources ?? [{ path: "C:/VocaSpace/AGENTS.md", sha256: "a".repeat(64) }], thread: { id: `server-${message.id}` } } });
    }
    if (message.method === "turn/start") {
      const threadId = message.params.threadId;
      const turnId = `server-${message.id}`;
      send({ id: message.id, result: { turn: { id: turnId, items: [], status: "inProgress" } } });
      const complete = () => {
        const evaluator = message.params.outputSchema?.required?.includes("case_status");
        const output = structuredOutput
          ? evaluator
            ? { case_status: "passed", citations: [], comparison_status: "equivalent", rationale: "fake deterministic evaluation", recommendation: "accept", uncertainty: "none" }
            : { observation: { execution_status: "completed", observed_access: Object.fromEntries(["credentials", "filesystem", "mutation", "network", "remote_actions", "tools"].map((field) => [field, "not_observed"])), raw_text: "fake deterministic observation" }, resources: [] }
          : { observation: "ok" };
        send({ method: "item/completed", params: { item: { id: "agent-1", text: JSON.stringify(output), type: "agentMessage" }, threadId: wrongThread ? "wrong-thread" : threadId, turnId } });
        if (usage) send({ method: "thread/tokenUsage/updated", params: { threadId, tokenUsage: usage, turnId } });
        send({ method: "turn/completed", params: { threadId, turn: { id: turnId, items: [], status: "completed" }, turnId } });
      };
      if (turnCompletionDelayMs > 0) setTimeout(complete, turnCompletionDelayMs);
      else complete();
    }
  }
  return { child, messages, methods };
}

async function failedThreadStart(threadStartMode, options = {}) {
  const fake = protocolProcess({ ...options, threadStartMode });
  const transport = createCodexAppServerStdioTransport({ executable: process.execPath, spawnProcess: () => fake.child });
  const events = [];
  let error;
  try {
    await transport.startThread({
      onEvent: ({ event_type: eventType }) => events.push(eventType),
      requestBytes: jsonl({ id: `thread-${threadStartMode.replaceAll("_", "-")}`, method: "thread/start", params: threadParams() }),
    });
  } catch (caught) {
    error = caught;
  }
  assert(error, `Expected ${threadStartMode} to fail.`);
  return { error, events };
}

function jsonl(value) { return Buffer.from(`${JSON.stringify(value)}\n`, "utf8"); }
function threadParams() { return { approvalPolicy: "never", cwd: "C:/VocaSpace", ephemeral: false, model: "gpt-5.6-sol", sandboxPolicy: "read-only", settings: {} }; }
function turnParams(threadId) { return { approvalPolicy: "never", cwd: "C:/VocaSpace", effort: "medium", input: [{ text: "compiled harness input", type: "text" }], model: "gpt-5.6-sol", outputSchema: { type: "object" }, sandboxPolicy: "read-only", settings: {}, threadId }; }
