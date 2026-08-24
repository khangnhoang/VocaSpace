// Test plan:
// - Mục tiêu: chứng nhận CP8A tại đúng ranh giới Codex App Server `runtime_mediated` mà không gọi model/provider thật.
// - Loại test: Node schema/unit/integration với deterministic mocked App Server transport.
// - Đối tượng: logical runtime identity, positive runtime-event schemas/lineage, durable helper owner, live authority, finder gate và reuse.
// - Case thành công: reader/evaluator/helper tạo fresh thread, exact input/request/event, restart helper graph và canonical grant path hợp lệ.
// - Case thất bại: complete donor owner, unsupported event metadata và post-intent finder tamper đều fail closed trước descendant mới.
// - Bảo mật/phân quyền: chỉ in-memory fake transport; live-kind authority path cũng không mở process/network; turn writes được đếm chính xác.
// - Ổn định/resilience: pre-write là `confirmed_not_started`; post-intent mơ hồ là `outcome_unknown`; không blind retry.
// - Invariant cần giữ: audit-only IDs không đổi identity; semantic owner khác không thể hợp thức hóa runtime/helper/event/representation evidence.
// - Kết quả verify gần nhất: passed `95/95` bằng deterministic mocked/fake App Server transport; live model/provider calls `0`.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalJson, canonicalJsonLine, sha256Bytes, sha256Canonical } from "./lib/skill-evals/artifact-schema-v1.mjs";
import {
  HarnessError,
  assertHarnessArtifact,
  createHarnessArtifact,
  validateArtifactGraph,
} from "./lib/skill-evals/harness-schema-v2.mjs";
import {
  compileEvaluatorStaticInvocation,
  compileInvocation,
  deriveHelperInputIdentity,
  executeReadiness,
  executeReadinessWithConcreteHelpers,
} from "./lib/skill-evals/readiness-v2.mjs";
import { runControlledFixtureAttempts, runSequentialReaderStage } from "./lib/skill-evals/orchestrator-v2.mjs";
import { finalizeEvaluatorStage, runSequentialEvaluatorStage } from "./lib/skill-evals/review-v2.mjs";
import {
  acquireRunLease,
  appendAttemptPhase,
  createRunRecord,
  initializeRunStore,
  issueLiveDispatchAuthority,
  listStoredArtifacts,
  readAttemptPhases,
  readArtifactObject,
  readJournal,
  readRuntimeSnapshot,
  recoverRun,
  reserveLiveDispatchCall,
  resolveLiveDispatchAuthority,
  transitionRun,
  writeArtifactObject,
} from "./lib/skill-evals/run-store-v2.mjs";
import {
  classifyCodexChatGptAppServerReuse,
  createCodexChatGptAppServerAdapter,
  createCodexChatGptAppServerCapabilities,
} from "./lib/skill-evals/codex-chatgpt-app-server-v2.mjs";
import {
  classifyDependencyChanges,
  deriveEvaluatorInputIdentity,
  deriveReaderInputIdentity,
} from "./lib/skill-evals/logical-identity-v2.mjs";
import { behaviorRuntimeProjectionKeys } from "./lib/skill-evals/runtime-identity-v2.mjs";

const timestamp = "2026-08-23T00:00:00.000Z";
const roots = [];

test.after(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
});

test("CP9 canonical live authority issuance/resolution cannot be replaced by a caller-authored grant", () => {
  const limits = { evaluator: 0, reader: 1, total: 1, verification_helper: 0 };
  const fixture = createRuntimeFixture({ liveCallLimits: limits, liveModelCalls: true, role: "reader", transportKind: "codex_app_server_stdio" });
  const grant = ownerLiveGrant(fixture, limits);
  const subject = sha256Canonical(grant);
  const reference = issueLiveDispatchAuthority(fixture.root, {
    authorityVerifier: (authority) => authority.subject_sha256 === subject,
    grant,
    issuanceAuthority: { action: "issue_live_dispatch_authority", kind: "owner", run_id: fixture.run.artifact_id, subject_sha256: subject, task_id: fixture.task.artifact_id },
    now: timestamp,
  });
  assert.deepEqual(resolveLiveDispatchAuthority(fixture.root, reference).grant, grant);
  assert.throws(() => resolveLiveDispatchAuthority(fixture.root, { ...reference, grant_sha256: "f".repeat(64) }), { code: "LIVE_AUTHORITY_UNRESOLVED" });
  assert.equal(fixture.transport.turnWrites, 0);
});

test("CP9 runtime measurement persists exact observed usage and fails on view tampering", async () => {
  const usageJson = canonicalJsonLine({ method: "thread/tokenUsage/updated", params: { tokenUsage: { inputTokens: 5, outputTokens: 3 } } });
  const fixture = createRuntimeFixture({
    role: "reader",
    turnMeasurement: {
      dispatch_started_at: timestamp,
      input_bytes: 17,
      request_bytes: 31,
      semantic_output_bytes: 23,
      terminal_at: timestamp,
      token_usage: { event_count: 1, event_json: usageJson, event_sha256: sha256Bytes(Buffer.from(usageJson, "utf8")), status: "observed" },
    },
  });
  await invokeFixture(fixture);
  const snapshot = readRuntimeSnapshot(fixture.root, fixture.run.artifact_id, fixture.attempt.payload.attempt_id);
  assert.equal(snapshot.measurement.call_count, 1);
  assert.equal(snapshot.measurement.token_usage.event_json, usageJson);
  const path = join(fixture.root, "runs", fixture.run.artifact_id, "runtime", "attempts", fixture.attempt.payload.attempt_id, "measurement.json");
  writeFileSync(path, canonicalJson({ ...snapshot.measurement, request_bytes: -1 }), "utf8");
  assert.throws(() => readRuntimeSnapshot(fixture.root, fixture.run.artifact_id, fixture.attempt.payload.attempt_id), { code: "RUNTIME_MEASUREMENT_INVALID" });
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
    const threadRequest = JSON.parse(fixture.transport.threadWriteBytes[0].toString("utf8"));
    assert.equal(threadRequest.params.sandbox, "readOnly");
    assert.equal(Object.hasOwn(threadRequest.params, "sandboxPolicy"), false);
    assert.equal(fixture.transport.turnWriteBytes[0].toString("utf8"), snapshot.request_json);
    assert.equal(
      sha256Bytes(fixture.transport.turnWriteBytes[0]),
      artifacts.find((artifact) => artifact.artifact_type === "runtime_dispatch_request").payload.wire_request_sha256,
    );
    assert.equal([...snapshot.request_json].filter((character) => character === "\n").length, 1);
    assert.match(snapshot.input_text, /^HARNESS_INPUT_V1\n/);
    assert.equal(JSON.parse(snapshot.request_json).method, "turn/start");
    assert.deepEqual(JSON.parse(snapshot.request_json).params.sandboxPolicy, { type: "readOnly" });
    assert.deepEqual(
      snapshot.events.map((event) => event.event_type),
      [
        "turn_start_write_intent",
        "turn_start_write_completed",
        "turn_start_acknowledged",
        "turn_completed",
      ],
    );
    assert.equal(
      runtimeArtifacts.find(
        (artifact) => artifact.artifact_type === "runtime_event" && artifact.payload.event_type === "turn_start_write_completed",
      ).payload.event_json,
      fixture.transport.runtimeEventBytes[0].toString("utf8"),
    );
    assert.ok(fixture.transport.runtimeEventBytes[0].toString("utf8").startsWith(" "));
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

test("CP8A concrete verification_helper is integrated through canonical readiness with bounded non-semantic evidence", async () => {
  const fixture = createSequentialWorkflowFixture({
    authorizedRoles: ["evaluator", "reader", "verification_helper"],
    deferReadiness: true,
    liveAuthorityVerifier: () => true,
    liveCallLimits: { evaluator: 0, reader: 0, total: 1, verification_helper: 1 },
    liveModelCalls: true,
    transportKind: "codex_app_server_stdio",
  });
  const helper = {
    clusters: [{
      category: "non_p0",
      cluster_id: "cluster-cp8a",
      context: [{ label: "runtime", sha256: sha256Canonical(fixture.runtime) }],
      protocol: { observation_instructions: "Resolve only this uncertainty.", output_schema: "verification-helper-v2" },
      question: "Is the deterministic CP8A uncertainty resolved?",
      requested_policy: fixture.policy,
      resources: [],
      runtime: fixture.runtime,
    }],
    contract: { max_calls: 1 },
  };

  const readiness = await executeReadinessWithConcreteHelpers({
    adapter: fixture.adapter,
    adapterCapabilities: fixture.capabilities,
    helper,
    leaseToken: fixture.lease.token,
    liveDispatchGrant: ownerLiveGrant(fixture, fixture.run.payload.intent.authority_record.live_call_limits),
    now: () => timestamp,
    rounds: fixture.rounds,
    run: fixture.run,
    storeRoot: fixture.root,
    task: fixture.task,
  });

  assert.equal(readiness.status, "passed");
  assert.deepEqual(readiness.helper, { call_count: 1, cluster_id: "cluster-cp8a", status: "resolved" });
  assert.equal(readiness.analyses[0].reader.payload.helper_attempt_ids.length, 1);
  const helperTerminal = readiness.artifacts.find(
    (artifact) => artifact.artifact_type === "execution_attempt" && artifact.payload.phase === "terminal",
  );
  assert.equal(helperTerminal.payload.role, "verification_helper");
  const runtimeView = readRuntimeSnapshot(fixture.root, fixture.run.artifact_id, helperTerminal.payload.attempt_id);
  assert.deepEqual(runtimeView.result.evidence, []);
  assert.equal(runtimeView.result.status, "success");
  assert.equal(fixture.transport.turnWrites, 1);
  for (const artifact of readiness.artifacts) writeArtifactObject(fixture.root, artifact);
  const restartedGraph = uniqueArtifacts([
    readArtifactObject(fixture.root, fixture.task.content_sha256),
    readArtifactObject(fixture.root, fixture.run.content_sha256),
    readArtifactObject(fixture.root, fixture.readerInvocation.content_sha256),
    readArtifactObject(fixture.root, fixture.evaluatorStatic.invocation.content_sha256),
    ...readiness.artifacts.map((artifact) => readArtifactObject(fixture.root, artifact.content_sha256)),
  ]);
  validateArtifactGraph(restartedGraph);
  assert.equal(
    restartedGraph.filter((artifact) => artifact.artifact_type === "verification_helper_input").length,
    1,
  );
  const helperArtifacts = readiness.artifacts.filter((artifact) =>
    artifact.artifact_type === "execution_attempt" ||
    artifact.artifact_type === "verification_helper_input" ||
    (artifact.artifact_type === "compiled_invocation" && artifact.payload.role === "verification_helper"),
  );
  const restarted = executeReadiness({
      adapterCapabilities: fixture.capabilities,
      helper,
      helperExecution: {
        artifacts: helperArtifacts.map((artifact) => readArtifactObject(fixture.root, artifact.content_sha256)),
        audit: readiness.helper,
        terminalAttempts: [readArtifactObject(fixture.root, helperTerminal.content_sha256)],
        unresolved: false,
      },
      now: timestamp,
      rounds: fixture.rounds,
      run: fixture.run,
      task: fixture.task,
    });
  assert.equal(restarted.status, "passed");
  assert.equal(fixture.transport.turnWrites, 1);
});

test("CP8A canonical concrete-helper API rejects absent live authority before inspection or dispatch", async () => {
  const limits = { evaluator: 0, reader: 0, total: 1, verification_helper: 1 };
  const fixture = createSequentialWorkflowFixture({
    authorizedRoles: ["evaluator", "reader", "verification_helper"],
    deferReadiness: true,
    liveAuthorityVerifier: () => true,
    liveCallLimits: limits,
    liveModelCalls: true,
    transportKind: "codex_app_server_stdio",
  });
  const helper = {
    clusters: [{
      category: "non_p0",
      cluster_id: "cluster-helper-authority",
      context: [{ label: "runtime", sha256: sha256Canonical(fixture.runtime) }],
      protocol: { observation_instructions: "Resolve only this uncertainty.", output_schema: "verification-helper-v2" },
      question: "Can this helper run without explicit live authority?",
      requested_policy: fixture.policy,
      resources: [],
      runtime: fixture.runtime,
    }],
    contract: { max_calls: 1 },
  };

  await assert.rejects(
    () => executeReadinessWithConcreteHelpers({
      adapter: fixture.adapter,
      adapterCapabilities: fixture.capabilities,
      helper,
      leaseToken: fixture.lease.token,
      now: () => timestamp,
      rounds: fixture.rounds,
      run: fixture.run,
      storeRoot: fixture.root,
      task: fixture.task,
    }),
    (error) =>
      error?.callCertainty === "confirmed_not_started" &&
      error?.cause?.code === "APP_SERVER_AUTHORITY_INVALID",
  );
  assert.equal(fixture.transport.inspectionCalls, 0);
  assert.equal(fixture.transport.turnWrites, 0);
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

test("CP8A current concrete runtime fingerprint drift fails closed before reader redispatch", async () => {
  const fixture = createSequentialWorkflowFixture();
  const input = {
    adapter: fixture.adapter,
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: fixture.evaluatorStatic,
    leaseToken: fixture.lease.token,
    readinessSet: fixture.readiness,
    readerInvocations: [fixture.readerInvocation],
    run: fixture.run,
    storeRoot: fixture.root,
    task: fixture.task,
  };
  await runSequentialReaderStage(input);
  const reused = await runSequentialReaderStage(input);
  assert.equal(reused.calls, 0);
  assert.deepEqual(reused.invalidated_unit_ids, []);

  fixture.transport.runtimeFingerprint.configSha256 = "d".repeat(64);
  const rerun = await runSequentialReaderStage(input);
  assert.equal(rerun.calls, 0);
  assert.deepEqual(rerun.invalidated_unit_ids, ["reader-one"]);
  assert.deepEqual(rerun.failed_unit_ids, ["reader-one"]);
  assert.equal(fixture.transport.turnWrites, 1);
});

test("CP8A current concrete runtime fingerprint drift fails closed before evaluator redispatch", async () => {
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
  const stage = finalizeEvaluatorStage({
    comparisonMapping: fixture.comparisonMapping,
    protocol: fixture.evaluatorProtocol,
    requestedPolicy: fixture.policy,
    rubric: fixture.rubric,
    run: fixture.run,
    runtime: fixture.runtime,
    staticReadiness: fixture.readiness.evaluator_static,
    supportingArtifacts: listStoredArtifacts(fixture.root, fixture.run.artifact_id),
    task: fixture.task,
    units: [{
      evaluator_unit_id: "evaluator-one",
      observation: reader.observations[0],
      reader_unit_id: "reader-one",
      resource_observations: [],
    }],
  });
  for (const artifact of [...stage.invocations, stage.readiness]) writeArtifactObject(fixture.root, artifact);
  const input = {
    adapter: fixture.adapter,
    leaseToken: fixture.lease.token,
    run: fixture.run,
    stage,
    storeRoot: fixture.root,
  };
  await runSequentialEvaluatorStage(input);
  const reused = await runSequentialEvaluatorStage(input);
  assert.equal(reused.calls, 0);

  fixture.transport.runtimeFingerprint.instructionSources = [
    { path: "C:/VocaSpace/AGENTS.md", sha256: "b".repeat(64) },
  ];
  fixture.transport.threadInstructionSha256 = "b".repeat(64);
  const rerun = await runSequentialEvaluatorStage(input);
  assert.equal(rerun.calls, 0);
  assert.deepEqual(rerun.invalidated_unit_ids, ["evaluator-one"]);
  assert.deepEqual(rerun.failed_unit_ids, ["evaluator-one"]);
  assert.equal(fixture.transport.turnWrites, 2);
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

test("CP8A final predispatch recheck rejects runtime index tampering after initial publication", async (t) => {
  for (const file of ["index.json", "index.md"]) {
    await t.test(file, async () => {
      let fixture;
      let inspections = 0;
      fixture = createRuntimeFixture({
        inspectGate: async () => {
          inspections += 1;
          if (inspections === 2) {
            writeFileSync(join(fixture.root, "runs", fixture.run.artifact_id, "runtime", file), "tampered\n", "utf8");
          }
        },
      });

      await assert.rejects(
        () => invokeFixture(fixture),
        (error) =>
          error?.callCertainty === "confirmed_not_started" &&
          error?.cause?.code === "RUNTIME_INDEX_CORRUPT",
      );
      assert.equal(fixture.transport.turnWrites, 0);
    });
  }
});

test("CP8A final prewire finder gate rejects tampering after intent append and index rebuild", async () => {
  let fixture;
  fixture = createRuntimeFixture({
    faultAt: (point) => {
      if (point === "runtime-events.after-index-rebuild") {
        writeFileSync(join(fixture.root, "runs", fixture.run.artifact_id, "runtime", "index.md"), "tampered after intent\n", "utf8");
      }
    },
  });

  await assert.rejects(
    () => invokeFixture(fixture),
    (error) => error?.cause?.code === "RUNTIME_INDEX_CORRUPT",
  );
  assert.equal(fixture.transport.turnWrites, 0);
  assert.equal(
    listStoredArtifacts(fixture.root, fixture.run.artifact_id).filter((artifact) =>
      ["observation", "evaluator_proposal", "human_evaluation", "generated_report"].includes(artifact.artifact_type),
    ).length,
    0,
  );
});

test("CP8A final prewire finder gate independently rejects missing, malformed, stale, mixed, and extra navigation views", async (t) => {
  const donorA = createRuntimeFixture({ threadIdPrefix: "thread-donor-a" });
  const donorB = createRuntimeFixture({ threadIdPrefix: "thread-donor-b" });
  await invokeFixture(donorA);
  await invokeFixture(donorB);
  const donorPath = (donor, file) => join(donor.root, "runs", donor.run.artifact_id, "runtime", file);
  const cases = [
    {
      name: "missing both independent views",
      mutate: (runtimeRoot) => {
        rmSync(join(runtimeRoot, "index.json"));
        rmSync(join(runtimeRoot, "index.md"));
      },
    },
    {
      name: "malformed JSON view",
      mutate: (runtimeRoot) => writeFileSync(join(runtimeRoot, "index.json"), "{malformed\n", "utf8"),
    },
    {
      name: "stale JSON with current Markdown",
      mutate: (runtimeRoot) => writeFileSync(
        join(runtimeRoot, "index.json"),
        readFileSync(donorPath(donorA, "index.json"), "utf8"),
        "utf8",
      ),
    },
    {
      name: "stale Markdown with current JSON",
      mutate: (runtimeRoot) => writeFileSync(
        join(runtimeRoot, "index.md"),
        readFileSync(donorPath(donorA, "index.md"), "utf8"),
        "utf8",
      ),
    },
    {
      name: "mixed donor generations",
      mutate: (runtimeRoot) => {
        writeFileSync(join(runtimeRoot, "index.json"), readFileSync(donorPath(donorA, "index.json"), "utf8"), "utf8");
        writeFileSync(join(runtimeRoot, "index.md"), readFileSync(donorPath(donorB, "index.md"), "utf8"), "utf8");
      },
    },
    {
      name: "mutually consistent but stale donor views",
      mutate: (runtimeRoot) => {
        writeFileSync(join(runtimeRoot, "index.json"), readFileSync(donorPath(donorA, "index.json"), "utf8"), "utf8");
        writeFileSync(join(runtimeRoot, "index.md"), readFileSync(donorPath(donorA, "index.md"), "utf8"), "utf8");
      },
    },
    {
      name: "incorrect extra Markdown navigation",
      mutate: (runtimeRoot) => {
        const path = join(runtimeRoot, "index.md");
        writeFileSync(path, `${readFileSync(path, "utf8")}\n- extra/donor-navigation\n`, "utf8");
      },
    },
  ];

  for (const [caseIndex, entry] of cases.entries()) {
    await t.test(entry.name, async () => {
      let fixture;
      let inspections = 0;
      fixture = createRuntimeFixture({
        inspectGate: async () => {
          inspections += 1;
          if (inspections === 2) {
            entry.mutate(join(fixture.root, "runs", fixture.run.artifact_id, "runtime"));
          }
        },
        threadIdPrefix: `thread-source-${caseIndex + 1}`,
      });

      await assert.rejects(
        () => invokeFixture(fixture),
        (error) => error?.callCertainty === "confirmed_not_started" && error?.cause?.code === "RUNTIME_INDEX_CORRUPT",
      );
      assert.equal(fixture.transport.turnWrites, 0);
      assert.equal(
        listStoredArtifacts(fixture.root, fixture.run.artifact_id).filter((artifact) =>
          ["observation", "evaluator_proposal", "human_evaluation", "generated_report"].includes(artifact.artifact_type),
        ).length,
        0,
      );
    });
  }
});

test("CP8A final predispatch recheck rejects exact input/request replacement with zero descendants", async (t) => {
  for (const file of ["input.txt", "request.json"]) {
    await t.test(file, async () => {
      let fixture;
      let inspections = 0;
      fixture = createRuntimeFixture({
        inspectGate: async () => {
          inspections += 1;
          if (inspections === 2) {
            writeFileSync(join(
              fixture.root,
              "runs",
              fixture.run.artifact_id,
              "runtime",
              "attempts",
              fixture.attempt.payload.attempt_id,
              file,
            ), "independently-valid-looking replacement\n", "utf8");
          }
        },
      });

      await assert.rejects(
        () => invokeFixture(fixture),
        (error) =>
          error?.callCertainty === "confirmed_not_started" &&
          error?.cause?.code === "RUNTIME_VIEW_CORRUPT",
      );
      assert.equal(fixture.transport.turnWrites, 0);
      assert.equal(
        listStoredArtifacts(fixture.root, fixture.run.artifact_id)
          .filter((artifact) => ["observation", "evaluator_proposal", "human_evaluation", "generated_report"].includes(artifact.artifact_type))
          .length,
        0,
      );
    });
  }
});

test("CP8A prewire representation owner rejects complete valid donor input/request bindings with zero descendants", async (t) => {
  const inputDonor = createRuntimeFixture({ inputSuffix: " Independent valid donor input.", threadIdPrefix: "thread-view-input-donor" });
  const requestDonor = createRuntimeFixture({ identityPrefix: "request-view-donor", threadIdPrefix: "thread-view-request-donor" });
  await invokeFixture(inputDonor);
  await invokeFixture(requestDonor);
  for (const file of ["input.txt", "request.json"]) {
    await t.test(file, async () => {
      const donor = file === "input.txt" ? inputDonor : requestDonor;
      let fixture;
      let inspections = 0;
      fixture = createRuntimeFixture({
        inspectGate: async () => {
          inspections += 1;
          if (inspections === 2) {
            const donorFile = join(
              donor.root,
              "runs",
              donor.run.artifact_id,
              "runtime",
              "attempts",
              donor.attempt.payload.attempt_id,
              file,
            );
            const sourceFile = join(
              fixture.root,
              "runs",
              fixture.run.artifact_id,
              "runtime",
              "attempts",
              fixture.attempt.payload.attempt_id,
              file,
            );
            writeFileSync(sourceFile, readFileSync(donorFile));
            const snapshotPath = join(
              fixture.root,
              "runs",
              fixture.run.artifact_id,
              "runtime",
              "attempts",
              fixture.attempt.payload.attempt_id,
              "snapshot.json",
            );
            const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
            snapshot[file === "input.txt" ? "input_sha256" : "request_sha256"] = sha256Bytes(readFileSync(donorFile));
            writeFileSync(snapshotPath, canonicalJson(snapshot), "utf8");
          }
        },
        threadIdPrefix: `thread-view-source-${file === "input.txt" ? "input" : "request"}`,
      });

      await assert.rejects(
        () => invokeFixture(fixture),
        (error) =>
          error?.callCertainty === "confirmed_not_started" &&
          error?.cause?.code === "RUNTIME_VIEW_CORRUPT" &&
          error.cause.message.includes(file === "input.txt" ? "another canonical runtime input" : "another canonical dispatch request"),
      );
      assert.equal(fixture.transport.turnWrites, 0);
      assert.equal(
        listStoredArtifacts(fixture.root, fixture.run.artifact_id).filter((artifact) =>
          ["observation", "evaluator_proposal", "human_evaluation", "generated_report"].includes(artifact.artifact_type),
        ).length,
        0,
      );
      assert.equal(donor.transport.turnWrites, 1);
    });
  }
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

test("CP8A run intent cannot substitute for an independent owner-issued live dispatch grant", async () => {
  const limits = { evaluator: 0, reader: 1, total: 1, verification_helper: 0 };
  const fixture = createRuntimeFixture({
    liveAuthorityVerifier: () => true,
    liveCallLimits: limits,
    liveModelCalls: true,
    transportKind: "codex_app_server_stdio",
  });

  await assert.rejects(() => invokeFixture(fixture), hasCertainty("confirmed_not_started"));
  assert.equal(fixture.transport.inspectionCalls, 0);
  assert.equal(fixture.transport.turnWrites, 0);
});

test("CP8A reserves an independently verified live-call budget before the exact turn write", async () => {
  const limits = { evaluator: 0, reader: 1, total: 1, verification_helper: 0 };
  let verificationCalls = 0;
  const fixture = createRuntimeFixture({
    liveAuthorityVerifier: () => {
      verificationCalls += 1;
      return true;
    },
    liveCallLimits: limits,
    liveModelCalls: true,
    transportKind: "codex_app_server_stdio",
  });
  fixture.liveDispatchGrant = ownerLiveGrant(fixture, limits);

  await invokeFixture(fixture);
  const reservation = JSON.parse(readFileSync(join(
    fixture.root,
    "runs",
    fixture.run.artifact_id,
    "authority",
    "live-call-reservations",
    `${fixture.attempt.payload.attempt_id}.json`,
  ), "utf8"));
  assert.equal(reservation.attempt_id, fixture.attempt.payload.attempt_id);
  assert.equal(reservation.role, "reader");
  assert.equal(verificationCalls, 2);
  assert.equal(fixture.transport.turnWrites, 1);
  const secondPrepared = recreate(fixture.attempt, {
    artifactId: "reader-attempt-cp8a-2-prepared",
    payload: { ...fixture.attempt.payload, attempt_id: "reader-attempt-cp8a-2", sequence: 2 },
  });
  appendAttemptPhase(fixture.root, secondPrepared, { leaseToken: fixture.lease.token, now: timestamp });
  assert.throws(
    () => reserveLiveDispatchCall(fixture.root, {
      attempt: secondPrepared,
      grantSha256: sha256Canonical(fixture.liveDispatchGrant),
      leaseToken: fixture.lease.token,
      limits,
      now: timestamp,
      role: "reader",
    }),
    hasCode("LIVE_DISPATCH_BUDGET_EXHAUSTED"),
  );
});

test("CP8A rejects an independently valid donor grant bound to another complete task/run", async () => {
  const limits = { evaluator: 0, reader: 1, total: 1, verification_helper: 0 };
  const donor = createRuntimeFixture({
    identityPrefix: "donor-authority",
    liveAuthorityVerifier: () => true,
    liveCallLimits: limits,
    liveModelCalls: true,
    transportKind: "codex_app_server_stdio",
  });
  donor.liveDispatchGrant = ownerLiveGrant(donor, limits);
  validateArtifactGraph([donor.task, donor.run]);
  await invokeFixture(donor);

  const source = createRuntimeFixture({
    identityPrefix: "source-authority",
    liveAuthorityVerifier: () => true,
    liveCallLimits: limits,
    liveModelCalls: true,
    transportKind: "codex_app_server_stdio",
  });
  source.liveDispatchGrant = donor.liveDispatchGrant;
  validateArtifactGraph([source.task, source.run]);

  await assert.rejects(
    () => invokeFixture(source),
    (error) =>
      error?.callCertainty === "confirmed_not_started" &&
      error?.cause?.code === "APP_SERVER_AUTHORITY_INVALID" &&
      error.cause.message.includes("current external authority/run scope"),
  );
  assert.equal(donor.transport.turnWrites, 1);
  assert.equal(source.transport.inspectionCalls, 0);
  assert.equal(source.transport.turnWrites, 0);
});

test("CP8A fails closed on atomic live-budget reservation contention with zero turn writes", async () => {
  const limits = { evaluator: 0, reader: 1, total: 1, verification_helper: 0 };
  const fixture = createRuntimeFixture({
    liveAuthorityVerifier: () => true,
    liveCallLimits: limits,
    liveModelCalls: true,
    transportKind: "codex_app_server_stdio",
  });
  fixture.liveDispatchGrant = ownerLiveGrant(fixture, limits);
  const reservationDirectory = join(
    fixture.root,
    "runs",
    fixture.run.artifact_id,
    "authority",
    "live-call-reservations",
  );
  mkdirSync(reservationDirectory, { recursive: true });
  writeFileSync(join(reservationDirectory, ".reservation.lock"), "held\n", "utf8");

  await assert.rejects(() => invokeFixture(fixture), hasCertainty("confirmed_not_started"));
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
    sha256Bytes(Buffer.from(runtimeJournal[0].details.request_json, "utf8")),
    runtimeJournal[0].details.request_sha256,
  );
  assert.equal(fixture.transport.threadWriteBytes[0].toString("utf8"), runtimeJournal[0].details.request_json);
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

test("CP8A canonical reader and evaluator APIs pass one owner grant unchanged to the live adapter boundary", async () => {
  const limits = { evaluator: 1, reader: 1, total: 2, verification_helper: 0 };
  const verifiedGrants = [];
  const fixture = createSequentialWorkflowFixture({
    liveAuthorityVerifier: (grant) => {
      verifiedGrants.push(grant);
      return true;
    },
    liveCallLimits: limits,
    liveModelCalls: true,
    transportKind: "codex_app_server_stdio",
  });
  const liveDispatchGrant = ownerLiveGrant(fixture, limits);
  const reader = await runSequentialReaderStage({
    adapter: fixture.adapter,
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: fixture.evaluatorStatic,
    leaseToken: fixture.lease.token,
    liveDispatchGrant,
    readinessSet: fixture.readiness,
    readerInvocations: [fixture.readerInvocation],
    run: fixture.run,
    storeRoot: fixture.root,
    task: fixture.task,
  });
  const stage = finalizeEvaluatorStage({
    comparisonMapping: fixture.comparisonMapping,
    protocol: fixture.evaluatorProtocol,
    requestedPolicy: fixture.policy,
    rubric: fixture.rubric,
    run: fixture.run,
    runtime: fixture.runtime,
    staticReadiness: fixture.readiness.evaluator_static,
    supportingArtifacts: listStoredArtifacts(fixture.root, fixture.run.artifact_id),
    task: fixture.task,
    units: [{
      evaluator_unit_id: "evaluator-one",
      observation: reader.observations[0],
      reader_unit_id: "reader-one",
      resource_observations: [],
    }],
  });
  for (const artifact of [...stage.invocations, stage.readiness]) writeArtifactObject(fixture.root, artifact);
  const evaluator = await runSequentialEvaluatorStage({
    adapter: fixture.adapter,
    leaseToken: fixture.lease.token,
    liveDispatchGrant,
    run: fixture.run,
    stage,
    storeRoot: fixture.root,
  });

  assert.equal(reader.calls, 1);
  assert.equal(evaluator.calls, 1);
  assert.equal(fixture.transport.turnWrites, 2);
  assert.ok(verifiedGrants.length >= 4);
  assert.ok(verifiedGrants.every((grant) => canonicalJson(grant) === canonicalJson(liveDispatchGrant)));
});

test("CP8A canonical reader/evaluator APIs reject absent or substituted live authority before the next wire write", async (t) => {
  const limits = { evaluator: 1, reader: 1, total: 2, verification_helper: 0 };
  for (const authorityCase of ["absent", "substituted"]) {
    await t.test(`reader ${authorityCase}`, async () => {
      const fixture = createSequentialWorkflowFixture({
        liveAuthorityVerifier: () => true,
        liveCallLimits: limits,
        liveModelCalls: true,
        transportKind: "codex_app_server_stdio",
      });
      const valid = ownerLiveGrant(fixture, limits);
      const liveDispatchGrant = authorityCase === "absent" ? null : { ...valid, run_id: "run-substituted" };
      const reader = await runSequentialReaderStage({
        adapter: fixture.adapter,
        adapterCapabilities: fixture.capabilities,
        evaluatorStatic: fixture.evaluatorStatic,
        leaseToken: fixture.lease.token,
        liveDispatchGrant,
        readinessSet: fixture.readiness,
        readerInvocations: [fixture.readerInvocation],
        run: fixture.run,
        storeRoot: fixture.root,
        task: fixture.task,
      });

      assert.equal(reader.calls, 0);
      assert.deepEqual(reader.failed_unit_ids, ["reader-one"]);
      assert.equal(fixture.transport.inspectionCalls, 0);
      assert.equal(fixture.transport.turnWrites, 0);
    });
  }

  await t.test("evaluator absent after one authorized reader", async () => {
    const fixture = createSequentialWorkflowFixture({
      liveAuthorityVerifier: () => true,
      liveCallLimits: limits,
      liveModelCalls: true,
      transportKind: "codex_app_server_stdio",
    });
    const grant = ownerLiveGrant(fixture, limits);
    const reader = await runSequentialReaderStage({
      adapter: fixture.adapter,
      adapterCapabilities: fixture.capabilities,
      evaluatorStatic: fixture.evaluatorStatic,
      leaseToken: fixture.lease.token,
      liveDispatchGrant: grant,
      readinessSet: fixture.readiness,
      readerInvocations: [fixture.readerInvocation],
      run: fixture.run,
      storeRoot: fixture.root,
      task: fixture.task,
    });
    const stage = finalizeEvaluatorStage({
      comparisonMapping: fixture.comparisonMapping,
      protocol: fixture.evaluatorProtocol,
      requestedPolicy: fixture.policy,
      rubric: fixture.rubric,
      run: fixture.run,
      runtime: fixture.runtime,
      staticReadiness: fixture.readiness.evaluator_static,
      supportingArtifacts: listStoredArtifacts(fixture.root, fixture.run.artifact_id),
      task: fixture.task,
      units: [{
        evaluator_unit_id: "evaluator-one",
        observation: reader.observations[0],
        reader_unit_id: "reader-one",
        resource_observations: [],
      }],
    });
    for (const artifact of [...stage.invocations, stage.readiness]) writeArtifactObject(fixture.root, artifact);
    const evaluator = await runSequentialEvaluatorStage({
      adapter: fixture.adapter,
      leaseToken: fixture.lease.token,
      run: fixture.run,
      stage,
      storeRoot: fixture.root,
    });

    assert.equal(evaluator.calls, 0);
    assert.deepEqual(evaluator.failed_unit_ids, ["evaluator-one"]);
    assert.equal(fixture.transport.turnWrites, 1);
  });
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

test("CP8A reconciliation requires one canonical turnId across lookup and error evidence before acknowledgement", async () => {
  const fixture = createRuntimeFixture({ lookupStatus: "completed", startTurnError: true });
  await assert.rejects(() => invokeFixture(fixture), hasCertainty("confirmed_finished"));
  const sourceGraph = uniqueArtifacts([fixture.task, fixture.run, ...listStoredArtifacts(fixture.root, fixture.run.artifact_id)]);
  validateArtifactGraph(sourceGraph);
  const errorEvent = sourceGraph.find(
    (artifact) => artifact.artifact_type === "runtime_event" && artifact.payload.event_type === "transport_error",
  );
  const substituted = recreate(errorEvent, {
    payload: { ...errorEvent.payload, turn_id: "turn-conflicting-reconciliation" },
  });
  const beforeWrites = fixture.transport.turnWrites;
  const beforeArtifacts = listStoredArtifacts(fixture.root, fixture.run.artifact_id).length;

  assert.throws(
    () => validateArtifactGraph(sourceGraph.map((artifact) => artifact.content_sha256 === errorEvent.content_sha256 ? substituted : artifact)),
    hasCode("ARTIFACT_RELATIONSHIP_INVALID"),
  );
  assert.equal(fixture.transport.turnWrites, beforeWrites);
  assert.equal(listStoredArtifacts(fixture.root, fixture.run.artifact_id).length, beforeArtifacts);
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
  const interruptRequest = listStoredArtifacts(fixture.root, fixture.run.artifact_id).find(
    (artifact) => artifact.artifact_type === "runtime_event" && artifact.payload.event_type === "turn_interrupt_requested",
  );
  assert.equal(fixture.transport.interruptWriteBytes[0].toString("utf8"), interruptRequest.payload.event_json);
  assert.equal(sha256Bytes(fixture.transport.interruptWriteBytes[0]), interruptRequest.payload.event_json_sha256);
  validateArtifactGraph(uniqueArtifacts([
    fixture.task,
    fixture.run,
    ...listStoredArtifacts(fixture.root, fixture.run.artifact_id),
  ]));
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

test("CP8A every concrete behavior-runtime dimension changes reader identity and classifies as reader-affected", () => {
  const fixture = createRuntimeFixture();
  const baseInput = readerIdentityInputForRuntimeFixture(fixture);
  const baseline = deriveReaderInputIdentity(baseInput).reader_input_id;
  assert.equal(deriveReaderInputIdentity(structuredClone(baseInput)).reader_input_id, baseline);

  for (const field of behaviorRuntimeProjectionKeys) {
    const runtime = structuredClone(fixture.invocation.payload.runtime);
    runtime.behavior_runtime = mutateBehaviorRuntimeDimension(runtime.behavior_runtime, field);
    const payload = { ...fixture.invocation.payload, runtime };
    if (field === "model") runtime.model = runtime.behavior_runtime.model;
    if (field === "effort") runtime.parameters.effort = runtime.behavior_runtime.effort;
    if (field === "effective_policy") {
      payload.requested_policy = structuredClone(runtime.behavior_runtime.effective_policy);
      payload.model_visible_policy = structuredClone(runtime.behavior_runtime.effective_policy);
    }
    const invocation = recreate(fixture.invocation, { payload });
    const identity = deriveReaderInputIdentity({
      ...baseInput,
      attestation: {
        ...baseInput.attestation,
        runtime_config_sha256: sha256Canonical(invocation.payload.runtime),
      },
      compiled_invocation: invocation,
    });

    assert.notEqual(identity.reader_input_id, baseline, field);
    assert.equal(classifyDependencyChanges([`reader_runtime.behavior_runtime.${field}`]), "reader_affected", field);
  }

  const auditOnly = deriveReaderInputIdentity({
    ...baseInput,
    provenance: {
      attempt_id: "attempt-audit-other",
      request_id: "request-audit-other",
      session_id: "session-audit-other",
      thread_id: "thread-audit-other",
    },
  });
  assert.equal(auditOnly.reader_input_id, baseline);
});

test("CP8A every concrete behavior-runtime dimension changes evaluator identity and classifies as evaluator-affected", async () => {
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
  const stage = finalizeEvaluatorStage({
    comparisonMapping: fixture.comparisonMapping,
    protocol: fixture.evaluatorProtocol,
    requestedPolicy: fixture.policy,
    rubric: fixture.rubric,
    run: fixture.run,
    runtime: fixture.runtime,
    staticReadiness: fixture.readiness.evaluator_static,
    supportingArtifacts: listStoredArtifacts(fixture.root, fixture.run.artifact_id),
    task: fixture.task,
    units: [{
      evaluator_unit_id: "evaluator-one",
      observation: reader.observations[0],
      reader_unit_id: "reader-one",
      resource_observations: [],
    }],
  });
  const invocation = stage.invocations[0];
  const input = {
    comparison_mapping: fixture.comparisonMapping,
    compiled_invocation: invocation,
    evidence: [{ observation: reader.observations[0], resource_observation: null }],
    protocol_version: "evaluator-protocol-v2",
    rubric: fixture.rubric,
  };
  const baseline = deriveEvaluatorInputIdentity(input).evaluator_input_id;
  assert.equal(deriveEvaluatorInputIdentity(structuredClone(input)).evaluator_input_id, baseline);

  for (const field of behaviorRuntimeProjectionKeys) {
    const runtime = structuredClone(invocation.payload.runtime);
    runtime.behavior_runtime = mutateBehaviorRuntimeDimension(runtime.behavior_runtime, field);
    const payload = { ...invocation.payload, runtime };
    if (field === "model") runtime.model = runtime.behavior_runtime.model;
    if (field === "effort") runtime.parameters.effort = runtime.behavior_runtime.effort;
    if (field === "effective_policy") {
      payload.requested_policy = structuredClone(runtime.behavior_runtime.effective_policy);
      payload.model_visible_policy = structuredClone(runtime.behavior_runtime.effective_policy);
    }
    const changed = recreate(invocation, { payload });

    assert.notEqual(
      deriveEvaluatorInputIdentity({ ...input, compiled_invocation: changed }).evaluator_input_id,
      baseline,
      field,
    );
    assert.equal(classifyDependencyChanges([`evaluator_runtime.behavior_runtime.${field}`]), "evaluator_affected", field);
  }
});

test("CP8A rejects one-dimension semantic substitutions at the runtime relationship owner", async (t) => {
  const source = await createCompleteRuntimeGraph();
  const sourceRequest = graphArtifact(source, "runtime_dispatch_request");

  await t.test("same invocation/request rebound to another complete valid intent/run graph", async () => {
    const donor = await createCompleteRuntimeGraph({ intentPurpose: "Different independently valid owner purpose." });
    assertSemanticSubstitution({
      donor,
      expectedMessage: "runtime_attestation does not bind the exact prepared attempt/invocation/readiness/run lineage",
      replacement: graphArtifact(donor, "run_manifest"),
      source,
      targetType: "run_manifest",
    });
  });

  await t.test("attestation substituted from another complete valid runtime fingerprint graph", async () => {
    const donor = await createCompleteRuntimeGraph({ threadIdPrefix: "thread-attestation-donor" });
    assertSemanticSubstitution({
      donor,
      expectedMessage: "runtime_dispatch_request does not bind the exact runtime/attempt/invocation/readiness lineage",
      replacement: graphArtifact(donor, "runtime_attestation"),
      source,
      targetType: "runtime_attestation",
    });
  });

  await t.test("request model substituted from another complete valid runtime graph", async () => {
    const donor = await createCompleteRuntimeGraph({ runtimeModel: "gpt-5.6-test" });
    assertSemanticSubstitution({
      donor,
      expectedMessage: "runtime_dispatch_request hashes or request identity do not match its exact canonical wire bytes",
      replacement: graphArtifact(donor, "runtime_dispatch_request"),
      source,
      targetType: "runtime_dispatch_request",
    });
  });

  await t.test("request outputSchema substituted from another complete valid graph", async () => {
    const donor = await createCompleteRuntimeGraph({ outputSchemaDefinition: { additionalProperties: false, type: "object" } });
    assertSemanticSubstitution({
      donor,
      expectedMessage: "runtime_dispatch_request hashes or request identity do not match its exact canonical wire bytes",
      replacement: graphArtifact(donor, "runtime_dispatch_request"),
      source,
      targetType: "runtime_dispatch_request",
    });
  });

  await t.test("request input substituted from another complete valid graph", async () => {
    const donor = await createCompleteRuntimeGraph({ inputSuffix: " Donor input." });
    assertSemanticSubstitution({
      donor,
      expectedMessage: "runtime_dispatch_request hashes or request identity do not match its exact canonical wire bytes",
      replacement: graphArtifact(donor, "runtime_dispatch_request"),
      source,
      targetType: "runtime_dispatch_request",
    });
  });

  await t.test("readiness/grant substituted from another complete valid graph", async () => {
    const donor = await createCompleteRuntimeGraph({
      readinessArtifactId: "reader-readiness-cp8a-donor",
      readinessNonce: "grant-cp8a-donor",
    });
    const donorReadiness = graphArtifact(donor, "readiness_analysis");
    const substituted = recreate(sourceRequest, {
      links: sourceRequest.links
        .filter((value) => value.relationship !== "readiness")
        .concat(link("readiness", donorReadiness))
        .sort(compareLinks),
      payload: {
        ...sourceRequest.payload,
        grant_nonce: donorReadiness.payload.grants[0].nonce,
        readiness_sha256: donorReadiness.content_sha256,
      },
    });
    assertSemanticSubstitution({
      donor,
      expectedMessage: "runtime_dispatch_request does not bind the exact runtime/attempt/invocation/readiness lineage",
      extraArtifacts: [donorReadiness],
      replacement: substituted,
      source,
      targetType: "runtime_dispatch_request",
    });
  });

  await t.test("App Server request id variation stays audit-only through a newly canonical request", () => {
    const wire = JSON.parse(sourceRequest.payload.request_json);
    wire.id = "turn-audit-variation";
    const requestJson = canonicalJsonLine(wire);
    const varied = recreate(sourceRequest, {
      artifactId: "runtime-request-audit-variation",
      payload: {
        ...sourceRequest.payload,
        request_id: wire.id,
        request_json: requestJson,
        wire_request_sha256: sha256Bytes(Buffer.from(requestJson, "utf8")),
      },
    });
    assert.equal(varied.payload.semantic_dispatch_sha256, sourceRequest.payload.semantic_dispatch_sha256);
    const requestOnlyGraph = source.graph.filter((artifact) => artifact.artifact_type !== "runtime_event")
      .map((artifact) => artifact.content_sha256 === sourceRequest.content_sha256 ? varied : artifact);
    assert.doesNotThrow(() => validateArtifactGraph(requestOnlyGraph));
    assertNoNewRuntimeActivity(source);
  });

  await t.test("runtime event turnId substituted with one independently valid donor dimension", async () => {
    const donor = await createCompleteRuntimeGraph({ threadIdPrefix: "thread-donor" });
    const sourceEvent = source.graph.find(
      (artifact) => artifact.artifact_type === "runtime_event" && artifact.payload.event_type === "turn_start_acknowledged",
    );
    const donorEvent = donor.graph.find(
      (artifact) => artifact.artifact_type === "runtime_event" && artifact.payload.event_type === "turn_start_acknowledged",
    );
    const substituted = recreate(sourceEvent, { payload: { ...sourceEvent.payload, turn_id: donorEvent.payload.turn_id } });
    assertSemanticSubstitution({
      donor,
      expectedMessage: "substitutes the outer turn_id owner",
      replacement: substituted,
      source,
      targetArtifact: sourceEvent,
    });
  });
});

test("CP8A runtime-event body identifiers cannot substitute their exact outer lineage owners", async (t) => {
  for (const [field, outer] of [["requestId", "request_id"], ["threadId", "thread_id"], ["turnId", "turn_id"]]) {
    await t.test(field, async () => {
      const graph = await createCompleteRuntimeGraph({ threadIdPrefix: `thread-body-${field.toLowerCase()}` });
      const event = graph.graph.find(
        (artifact) => artifact.artifact_type === "runtime_event" && artifact.payload.event_type === "turn_start_acknowledged",
      );
      const body = JSON.parse(event.payload.event_json);
      body[field] = `${event.payload[outer]}-donor`;
      const eventJson = `${JSON.stringify(body)}\n`;
      const substituted = recreate(event, {
        payload: {
          ...event.payload,
          event_json: eventJson,
          event_json_sha256: sha256Bytes(Buffer.from(eventJson, "utf8")),
        },
      });
      const artifacts = graph.graph.map((artifact) =>
        artifact.artifact_type === event.artifact_type && artifact.artifact_id === event.artifact_id
          ? substituted
          : artifact,
      );

      assert.throws(
        () => validateArtifactGraph(artifacts),
        (error) => error?.code === "ARTIFACT_RELATIONSHIP_INVALID" && error.message.includes(`outer ${outer} owner`),
      );
      assert.equal(graph.fixture.transport.turnWrites, 1);
    });
  }
});

test("CP8A certifies every retained runtime-event shape and rejects non-attestation metadata before persistence", async (t) => {
  const successful = await createCompleteRuntimeGraph({ identityPrefix: "event-success" });
  const interrupted = await createCompleteInterruptGraph({ identityPrefix: "event-interrupt" });
  const failed = await createFailedRuntimeGraph({ identityPrefix: "event-failure" });
  const runtimeEvents = [...successful.graph, ...interrupted.graph, ...failed.graph]
    .filter((artifact) => artifact.artifact_type === "runtime_event");
  assert.deepEqual(
    [...new Set(runtimeEvents.map((artifact) => artifact.payload.event_type))].sort(),
    [
      "transport_error",
      "turn_completed",
      "turn_interrupt_acknowledged",
      "turn_interrupt_requested",
      "turn_lookup_result",
      "turn_start_acknowledged",
      "turn_start_write_completed",
      "turn_start_write_intent",
    ],
  );
  for (const event of runtimeEvents) assertHarnessArtifact(event, { artifactType: "runtime_event" });

  for (const eventType of [...new Set(runtimeEvents.map((artifact) => artifact.payload.event_type))].sort()) {
    await t.test(`rejects unsupported message for ${eventType}`, () => {
      const event = runtimeEvents.find((artifact) => artifact.payload.event_type === eventType);
      const body = event.payload.event_json === null ? {} : JSON.parse(event.payload.event_json);
      body.message = "unsupported retained message";
      const eventJson = canonicalJsonLine(body);
      assert.throws(
        () => recreate(event, {
          payload: {
            ...event.payload,
            event_json: eventJson,
            event_json_sha256: sha256Bytes(Buffer.from(eventJson, "utf8")),
          },
        }),
        hasCode("ARTIFACT_SCHEMA_INVALID"),
      );
    });
  }

  const sourceEvent = successful.graph.find(
    (artifact) => artifact.artifact_type === "runtime_event" && artifact.payload.event_type === "turn_start_acknowledged",
  );
  const before = listStoredArtifacts(successful.fixture.root, successful.fixture.run.artifact_id).length;
  for (const field of ["account", "email", "config", "environment", "settings", "metadata"]) {
    await t.test(`rejects ${field}`, () => {
      const body = JSON.parse(sourceEvent.payload.event_json);
      body[field] = field === "metadata" ? { arbitrary: true } : `forbidden-${field}`;
      const eventJson = canonicalJsonLine(body);
      assert.throws(
        () => recreate(sourceEvent, {
          payload: {
            ...sourceEvent.payload,
            event_json: eventJson,
            event_json_sha256: sha256Bytes(Buffer.from(eventJson, "utf8")),
          },
        }),
        hasCode("ARTIFACT_SCHEMA_INVALID"),
      );
      assert.equal(listStoredArtifacts(successful.fixture.root, successful.fixture.run.artifact_id).length, before);
    });
  }
  assertNoNewRuntimeActivity(successful);
  assertNoNewRuntimeActivity(interrupted);
  assertNoNewRuntimeActivity(failed);
});

test("CP8A interrupt request binds its App Server request id to the exact outer control owner", async () => {
  const source = await createCompleteInterruptGraph({ identityPrefix: "interrupt-source" });
  const donor = await createCompleteInterruptGraph({ identityPrefix: "interrupt-donor" });
  const sourceEvent = source.graph.find(
    (artifact) => artifact.artifact_type === "runtime_event" && artifact.payload.event_type === "turn_interrupt_requested",
  );
  const donorEvent = donor.graph.find(
    (artifact) => artifact.artifact_type === "runtime_event" && artifact.payload.event_type === "turn_interrupt_requested",
  );
  const body = JSON.parse(sourceEvent.payload.event_json);
  body.id = JSON.parse(donorEvent.payload.event_json).id;
  const eventJson = canonicalJsonLine(body);
  const substituted = recreate(sourceEvent, {
    payload: {
      ...sourceEvent.payload,
      event_json: eventJson,
      event_json_sha256: sha256Bytes(Buffer.from(eventJson, "utf8")),
    },
  });
  const negative = source.graph.map((artifact) => artifact.content_sha256 === sourceEvent.content_sha256 ? substituted : artifact);

  assert.throws(
    () => validateArtifactGraph(negative),
    (error) =>
      error?.code === "ARTIFACT_RELATIONSHIP_INVALID" &&
      error.message.includes("outer control_request_id owner"),
  );
  assertNoNewRuntimeActivity(source);
  assertNoNewRuntimeActivity(donor);
});

test("CP8A complete durable helper graphs reject one independently valid donor cluster owner", async () => {
  const limits = { evaluator: 0, reader: 0, total: 1, verification_helper: 1 };
  const source = createSequentialWorkflowFixture({
    authorizedRoles: ["evaluator", "reader", "verification_helper"],
    deferReadiness: true,
    liveAuthorityVerifier: () => true,
    liveCallLimits: limits,
    liveModelCalls: true,
    transportKind: "codex_app_server_stdio",
  });
  const donor = createSequentialWorkflowFixture({
    authorizedRoles: ["evaluator", "reader", "verification_helper"],
    deferReadiness: true,
    liveAuthorityVerifier: () => true,
    liveCallLimits: limits,
    liveModelCalls: true,
    transportKind: "codex_app_server_stdio",
  });
  const sourceHelper = concreteHelperConfig(source, "cluster-helper-source");
  const donorHelper = concreteHelperConfig(donor, "cluster-helper-donor");
  const sourceReadiness = await executeReadinessWithConcreteHelpers({
    adapter: source.adapter,
    adapterCapabilities: source.capabilities,
    helper: sourceHelper,
    leaseToken: source.lease.token,
    liveDispatchGrant: ownerLiveGrant(source, limits),
    now: () => timestamp,
    rounds: source.rounds,
    run: source.run,
    storeRoot: source.root,
    task: source.task,
  });
  const donorReadiness = await executeReadinessWithConcreteHelpers({
    adapter: donor.adapter,
    adapterCapabilities: donor.capabilities,
    helper: donorHelper,
    leaseToken: donor.lease.token,
    liveDispatchGrant: ownerLiveGrant(donor, limits),
    now: () => timestamp,
    rounds: donor.rounds,
    run: donor.run,
    storeRoot: donor.root,
    task: donor.task,
  });
  assert.equal(sourceReadiness.status, "passed");
  assert.equal(donorReadiness.status, "passed");
  const donorExecution = concreteHelperExecution(donorReadiness);

  assert.throws(
    () => executeReadiness({
      adapterCapabilities: source.capabilities,
      helper: sourceHelper,
      helperExecution: donorExecution,
      now: timestamp,
      rounds: source.rounds,
      run: source.run,
      task: source.task,
    }),
    (error) =>
      error?.code === "HELPER_EXECUTION_INVALID" &&
      error.message.includes("exact planned identity"),
  );
  assert.equal(source.transport.turnWrites, 1);
  assert.equal(donor.transport.turnWrites, 1);
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

async function createCompleteRuntimeGraph(options = {}) {
  const fixture = createRuntimeFixture({ role: "reader", ...options });
  await invokeFixture(fixture);
  const graph = uniqueArtifacts([fixture.task, fixture.run, ...listStoredArtifacts(fixture.root, fixture.run.artifact_id)]);
  validateArtifactGraph(graph);
  return {
    artifactCount: listStoredArtifacts(fixture.root, fixture.run.artifact_id).length,
    fixture,
    graph,
    turnWrites: fixture.transport.turnWrites,
  };
}

async function createCompleteInterruptGraph(options = {}) {
  let release;
  const fixture = createRuntimeFixture({
    ...options,
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
  assert.deepEqual(
    await fixture.adapter.cancel({ attempt_id: fixture.attempt.payload.attempt_id }, "cancel_requested"),
    { callCertainty: "confirmed_finished", confirmed: true },
  );
  release();
  await assert.rejects(() => invocation, hasCertainty("confirmed_finished"));
  const graph = uniqueArtifacts([fixture.task, fixture.run, ...listStoredArtifacts(fixture.root, fixture.run.artifact_id)]);
  validateArtifactGraph(graph);
  return {
    artifactCount: listStoredArtifacts(fixture.root, fixture.run.artifact_id).length,
    fixture,
    graph,
    turnWrites: fixture.transport.turnWrites,
  };
}

async function createFailedRuntimeGraph(options = {}) {
  const fixture = createRuntimeFixture({ ...options, startTurnError: true });
  await assert.rejects(() => invokeFixture(fixture), hasCertainty("unknown"));
  const graph = uniqueArtifacts([fixture.task, fixture.run, ...listStoredArtifacts(fixture.root, fixture.run.artifact_id)]);
  validateArtifactGraph(graph);
  return {
    artifactCount: listStoredArtifacts(fixture.root, fixture.run.artifact_id).length,
    fixture,
    graph,
    turnWrites: fixture.transport.turnWrites,
  };
}

function graphArtifact(graphFixture, artifactType) {
  const matches = graphFixture.graph.filter((artifact) => artifact.artifact_type === artifactType);
  assert.equal(matches.length, 1, `Expected one ${artifactType} in the complete runtime graph.`);
  return matches[0];
}

function concreteHelperConfig(fixture, clusterId) {
  return {
    clusters: [{
      category: "non_p0",
      cluster_id: clusterId,
      context: [{ label: "runtime", sha256: sha256Canonical(fixture.runtime) }],
      protocol: { observation_instructions: "Resolve only this uncertainty.", output_schema: "verification-helper-v2" },
      question: "Is the deterministic CP8A uncertainty resolved?",
      requested_policy: fixture.policy,
      resources: [],
      runtime: fixture.runtime,
    }],
    contract: { max_calls: 1 },
  };
}

function concreteHelperExecution(readiness) {
  const artifacts = readiness.artifacts.filter((artifact) =>
    artifact.artifact_type === "execution_attempt" ||
    artifact.artifact_type === "verification_helper_input" ||
    (artifact.artifact_type === "compiled_invocation" && artifact.payload.role === "verification_helper"),
  );
  return {
    artifacts,
    audit: readiness.helper,
    terminalAttempts: artifacts.filter(
      (artifact) => artifact.artifact_type === "execution_attempt" && artifact.payload.phase === "terminal",
    ),
    unresolved: readiness.helper.status === "unresolved",
  };
}

function assertSemanticSubstitution({
  donor,
  expectedMessage,
  extraArtifacts = [],
  replacement,
  source,
  targetArtifact = null,
  targetType = null,
}) {
  validateArtifactGraph(source.graph);
  validateArtifactGraph(donor.graph);
  assertHarnessArtifact(replacement);
  const target = targetArtifact ?? graphArtifact(source, targetType);
  assert.equal(replacement.artifact_type, target.artifact_type);
  assert.equal(replacement.artifact_id, target.artifact_id);
  assert.notEqual(replacement.content_sha256, target.content_sha256);
  const negative = rebindSubstitutedGraph(source.graph, target, replacement, extraArtifacts);
  assert.throws(
    () => validateArtifactGraph(negative),
    (error) => error?.code === "ARTIFACT_RELATIONSHIP_INVALID" && error.message.includes(expectedMessage),
  );
  assertNoNewRuntimeActivity(source);
  assertNoNewRuntimeActivity(donor);
}

function rebindSubstitutedGraph(sourceGraph, target, replacement, extraArtifacts) {
  const byIdentity = new Map(
    [...sourceGraph, ...extraArtifacts].map((artifact) => [`${artifact.artifact_type}:${artifact.artifact_id}`, artifact]),
  );
  byIdentity.set(`${target.artifact_type}:${target.artifact_id}`, replacement);
  for (let pass = 0; pass < sourceGraph.length + extraArtifacts.length + 2; pass += 1) {
    let changed = false;
    for (const [identity, artifact] of [...byIdentity.entries()]) {
      const rebound = rebindArtifact(artifact, byIdentity);
      if (rebound.content_sha256 !== artifact.content_sha256) {
        byIdentity.set(identity, rebound);
        changed = true;
      }
    }
    if (!changed) return [...byIdentity.values()];
  }
  assert.fail("Semantic substitution graph did not reach a stable exact-binding closure.");
}

function rebindArtifact(artifact, byIdentity) {
  const links = artifact.links.map((value) => {
    const target = byIdentity.get(`${value.target_artifact_type}:${value.target_artifact_id}`);
    return target ? { ...value, target_content_sha256: target.content_sha256 } : value;
  });
  const linked = (relationship) => {
    const value = links.find((candidate) => candidate.relationship === relationship);
    return value ? byIdentity.get(`${value.target_artifact_type}:${value.target_artifact_id}`) : null;
  };
  const payload = structuredClone(artifact.payload);
  if (artifact.artifact_type === "readiness_analysis") {
    const invocations = links
      .filter((value) => value.relationship === "compiled_invocation")
      .map((value) => byIdentity.get(`${value.target_artifact_type}:${value.target_artifact_id}`));
    payload.invocation_hashes = invocations.map((value) => value.content_sha256).sort();
    payload.grants = payload.grants.map((grant) => ({
      ...grant,
      invocation_sha256: invocations.find((value) => value.payload.unit_id === grant.unit_id)?.content_sha256 ?? grant.invocation_sha256,
    }));
  }
  if (artifact.artifact_type === "execution_attempt" && payload.role !== "verification_helper") {
    payload.input_sha256 = linked("compiled_invocation")?.content_sha256 ?? payload.input_sha256;
  }
  if (artifact.artifact_type === "runtime_dispatch_request") {
    const invocation = linked("compiled_invocation");
    const readiness = linked("readiness");
    const attestation = linked("runtime_attestation");
    payload.invocation_sha256 = invocation?.content_sha256 ?? payload.invocation_sha256;
    payload.readiness_sha256 = readiness?.content_sha256 ?? null;
    payload.runtime_attestation_sha256 = attestation?.content_sha256 ?? payload.runtime_attestation_sha256;
    if (readiness) {
      payload.grant_nonce = readiness.payload.grants.find((grant) => grant.unit_id === payload.unit_id)?.nonce ?? payload.grant_nonce;
    }
  }
  return recreate(artifact, { links: links.sort(compareLinks), payload });
}

function assertNoNewRuntimeActivity(graphFixture) {
  assert.equal(graphFixture.fixture.transport.turnWrites, graphFixture.turnWrites);
  const artifacts = listStoredArtifacts(graphFixture.fixture.root, graphFixture.fixture.run.artifact_id);
  assert.equal(artifacts.length, graphFixture.artifactCount);
  assert.equal(
    artifacts.filter((artifact) =>
      ["observation", "evaluator_proposal", "human_evaluation", "generated_report"].includes(artifact.artifact_type),
    ).length,
    0,
  );
}

function createSequentialWorkflowFixture({
  authorizedRoles = ["evaluator", "reader"],
  deferReadiness = false,
  liveAuthorityVerifier = null,
  liveCallLimits = { evaluator: 0, reader: 0, total: 0, verification_helper: 0 },
  liveModelCalls = false,
  transportKind = "mock_codex_app_server",
} = {}) {
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
  runtime.behavior_runtime = createBehaviorRuntimeProjection({ policy, runtime });
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
          authorized_roles: authorizedRoles,
          basis: "owner_explicit",
          live_call_limits: liveCallLimits,
          live_model_calls: liveModelCalls,
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
  const rounds = [{ evaluatorStatic, readerInvocations: [readerInvocation], runtimeConfig: runtime }];
  const readinessResult = deferReadiness
    ? null
    : executeReadiness({ adapterCapabilities: capabilities, now: timestamp, rounds, run, task });
  const readiness = readinessResult?.analyses.at(-1) ?? null;
  createRunRecord(root, task, run, { now: timestamp });
  for (const artifact of [
    readerInvocation,
    evaluatorStatic.invocation,
    ...(readiness ? [readiness.reader, readiness.evaluator_static] : []),
  ]) {
    writeArtifactObject(root, artifact);
  }
  const lease = acquireRunLease(root, run.artifact_id, {
    durationMs: 3_153_600_000_000,
    host: "cp8a-fixture",
    now: timestamp,
    owner: "cp8a-workflow-test",
    pid: 809,
    token: "lease-cp8a-workflow",
  });
  let revision = 0;
  for (const state of deferReadiness ? ["preflight"] : ["preflight", "readiness", "ready"]) {
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
        : request.params.outputSchema.title === "helper"
          ? { resolved: true }
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
    liveAuthorityVerifier,
    now: () => timestamp,
    outputSchemas: {
      "evaluator-proposal-v2": { additionalProperties: true, title: "evaluator", type: "object" },
      "observation-v2": { additionalProperties: true, title: "reader", type: "object" },
      "verification-helper-v2": { additionalProperties: true, title: "helper", type: "object" },
    },
    transport,
  });
  transport.kind = transportKind;
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
    rounds,
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
  identityPrefix = "",
  inputSuffix = "",
  interruptResult = { accepted: true, ack_event: { id: "interrupt-ack" }, terminal_status: "accepted" },
  intentPurpose = "Certify the bounded CP8A App Server adapter contract.",
  inspectGate = null,
  lookupStatus = "unknown",
  lookupSupported = true,
  liveAuthorityVerifier = null,
  liveCallLimits = { evaluator: 0, reader: 0, total: 0, verification_helper: 0 },
  liveDispatchGrant = null,
  liveModelCalls = false,
  role = "reader",
  persistPrepared = true,
  readinessArtifactId = null,
  readinessNonce = "grant-cp8a",
  runtimeConfigFingerprint = "c".repeat(64),
  runtimeInstructionSha256 = "a".repeat(64),
  runtimeModel = "gpt-5.4",
  settings = { personality: "none" },
  startTurnError = false,
  startTurnBeforeAckGate = null,
  startTurnCompletedThenError = false,
  startTurnGate = null,
  startThreadError = false,
  threadInstructionSha256 = "a".repeat(64),
  threadIdPrefix = "thread-cp8a",
  transportKind = "mock_codex_app_server",
  turnMeasurement = null,
  outputSchemaDefinition = { additionalProperties: true, type: "object" },
} = {}) {
  const root = initializeRunStore(temporaryDirectory());
  const identitySuffix = identityPrefix === "" ? "" : `-${identityPrefix}`;
  const taskId = `task-cp8a${identitySuffix}`;
  const runId = `run-cp8a${identitySuffix}`;
  const unitId = role === "verification_helper" ? "cluster-one-helper-1" : "unit-one";
  const attemptUnitId = role === "verification_helper" ? null : unitId;
  const runtime = {
    model: runtimeModel,
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
  runtime.behavior_runtime = createBehaviorRuntimeProjection({
    lookupSupported,
    policy,
    runtime,
    runtimeConfigFingerprint,
    runtimeInstructionSha256,
  });
  const task = createHarnessArtifact({
    artifactId: taskId,
    artifactType: "task_manifest",
    payload: {
      created_at: timestamp,
      lifecycle: "active",
      provenance: { branch: "refactor/agent-skill-eval-harness", commit: null, pull_request: null },
      retention_policy_version: "retention-v2",
      task_id: taskId,
    },
    producer: producer("operator"),
  });
  const run = createHarnessArtifact({
    artifactId: runId,
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
          live_call_limits: liveCallLimits,
          live_model_calls: liveModelCalls,
          recorded_at: timestamp,
          scope: "Deterministic CP8A mocked transport certification only.",
        },
        purpose: intentPurpose,
        selection_reason: "This fixture proves one exact runtime-mediated role path.",
      },
      revision: 0,
      run_id: runId,
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
    artifactId: `${role.replaceAll("_", "-")}-invocation-cp8a${identitySuffix}`,
    messages: [
      { content: "Follow the frozen runtime contract.", role: "developer" },
      { content: `Return the exact deterministic fixture output.${inputSuffix}`, role: "user" },
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
  const helperCluster = role === "verification_helper"
    ? {
        category: "non_p0",
        cluster_id: "cluster-one",
        context: [{ label: "bounded-context", sha256: "b".repeat(64) }],
        protocol: { observation_instructions: "Return exact structured output.", output_schema: outputSchemaName },
        question: `Return the exact deterministic fixture output.${inputSuffix}`,
        requested_policy: policy,
        resources: [],
        runtime,
      }
    : null;
  const helperIdentity = role === "verification_helper"
    ? deriveHelperInputIdentity({ cluster: helperCluster, compiledInvocation: invocation, runtimeConfig: runtime })
    : null;
  const helperInputHash = helperIdentity?.helper_input_hash ?? null;
  const helperInputArtifact = role === "verification_helper"
    ? createHarnessArtifact({
        artifactId: `cluster-one-helper-1-input${identitySuffix}`,
        artifactType: "verification_helper_input",
        links: [link("compiled_invocation", invocation), link("run", run)].sort(compareLinks),
        payload: {
          cluster: helperCluster,
          compiled_invocation_sha256: invocation.content_sha256,
          helper_index: 1,
          helper_input_hash: helperInputHash,
          run_id: run.artifact_id,
          uncertainty_cluster_id: helperCluster.cluster_id,
        },
        producer: producer("readiness_compiler"),
      })
    : null;
  const readiness =
    role === "verification_helper"
      ? null
      : createHarnessArtifact({
          artifactId: readinessArtifactId ?? `${role}-readiness-cp8a${identitySuffix}`,
          artifactType: "readiness_analysis",
          links: [link("compiled_invocation", invocation), link("run", run)].sort(compareLinks),
          payload: {
            correction: null,
            field_results: [],
            grants: [{ invocation_sha256: invocation.content_sha256, nonce: readinessNonce, single_use: true, unit_id: unitId }],
            helper_attempt_ids: [],
            invocation_hashes: [invocation.content_sha256],
            round: 1,
            run_id: run.artifact_id,
            stage: role,
            status: "passed",
          },
          producer: producer("readiness"),
        });
  const attemptId = role === "verification_helper"
    ? `cluster-one-helper-1${identitySuffix}`
    : `${role.replaceAll("_", "-")}-attempt-cp8a${identitySuffix}`;
  const attemptLinks = [link("compiled_invocation", invocation), link("run", run)];
  if (readiness) attemptLinks.push(link("readiness", readiness));
  if (helperInputArtifact) attemptLinks.push(link("helper_input", helperInputArtifact));
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
  if (helperInputArtifact) writeArtifactObject(root, helperInputArtifact);
  if (readiness) writeArtifactObject(root, readiness);
  const lease = acquireRunLease(root, run.artifact_id, {
    durationMs: 3_153_600_000_000,
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
    runtimeConfigFingerprint,
    runtimeInstructionSha256,
    startTurnError,
    startTurnBeforeAckGate,
    startTurnCompletedThenError,
    startTurnGate,
    startThreadError,
    threadInstructionSha256,
    threadIdPrefix,
    turnMeasurement,
  });
  transport.kind = transportKind;
  if (!lookupSupported) delete transport.lookupTurn;
  const adapter = createCodexChatGptAppServerAdapter({
    faultAt,
    liveAuthorityVerifier,
    now: () => timestamp,
    outputSchemas: {
      "evaluator-proposal-v2": outputSchemaDefinition,
      "observation-v2": outputSchemaDefinition,
      "verification-helper-v2": outputSchemaDefinition,
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
    helperInputArtifact,
    invocation,
    lease,
    liveDispatchGrant,
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
      graphArtifacts: [
        fixture.task,
        fixture.run,
        fixture.invocation,
        ...(fixture.helperInputArtifact ? [fixture.helperInputArtifact] : []),
        ...(fixture.readiness ? [fixture.readiness] : []),
        fixture.attempt,
      ],
      helperInputHash: role === "verification_helper" ? fixture.helperInputHash : undefined,
      invocation: fixture.invocation,
        leaseToken: fixture.lease.token,
        liveDispatchGrant: fixture.liveDispatchGrant,
      markDispatched: fixture.markDispatched,
      readiness: fixture.readiness,
      run: fixture.run,
      storeRoot: fixture.root,
    },
  });
}

function createBehaviorRuntimeProjection({
  lookupSupported = true,
  policy,
  runtime,
  runtimeConfigFingerprint = "c".repeat(64),
  runtimeInstructionSha256 = "a".repeat(64),
}) {
  return {
    adapter_id: "codex_chatgpt_app_server",
    adapter_version: "2",
    assurance_profile: "runtime_mediated",
    auth_mode: "chatgpt",
    capability_limitations: [
      "complete-model-visible-envelope-opaque",
      "provider-request-identity-opaque",
      "provider-side-idempotency-opaque",
      ...(lookupSupported ? [] : ["turn-outcome-lookup-unsupported"]),
      "upstream-provider-envelope-opaque",
    ].sort(),
    codex_version: "0.1.0-test",
    config_sha256: runtimeConfigFingerprint,
    effective_policy: structuredClone(policy),
    effort: runtime.parameters.effort,
    executable_path: "C:/tools/codex.exe",
    executable_sha256: "e".repeat(64),
    fresh_context_method: "new-app-server-thread",
    instruction_sources: [{ path: "C:/VocaSpace/AGENTS.md", sha256: runtimeInstructionSha256 }],
    model: runtime.model,
    platform: "win32-x64",
    protocol_schema_sha256: "f".repeat(64),
    runtime_identity: "codex-app-server-test",
    transport: "stdio-jsonl",
  };
}

function readerIdentityInputForRuntimeFixture(fixture) {
  return {
    attestation: {
      adapter_capabilities: createCodexChatGptAppServerCapabilities(),
      enforced_policy: fixture.invocation.payload.requested_policy,
      runtime_config_sha256: sha256Canonical(fixture.invocation.payload.runtime),
    },
    bundle: { bundle_sha256: "a".repeat(64), reader_visible_variant: "candidate" },
    compiled_invocation: fixture.invocation,
    context: [{ label: "runtime-context", sha256: "b".repeat(64) }],
    fresh_context_method: "new-app-server-thread",
    prompt: "Inspect the exact concrete runtime behavior.",
    protocol_version: "reader-protocol-v2",
    provenance: {
      attempt_id: "attempt-audit",
      request_id: "request-audit",
      session_id: "session-audit",
      thread_id: "thread-audit",
    },
  };
}

function mutateBehaviorRuntimeDimension(projection, field) {
  const changed = structuredClone(projection);
  if (["config_sha256", "executable_sha256", "protocol_schema_sha256"].includes(field)) {
    changed[field] = changed[field] === "d".repeat(64) ? "c".repeat(64) : "d".repeat(64);
  } else if (field === "capability_limitations") {
    changed[field] = [...changed[field], "zz-runtime-dimension-drift"].sort();
  } else if (field === "instruction_sources") {
    changed[field] = changed[field].map((source) => ({ ...source, sha256: "d".repeat(64) }));
  } else if (field === "effective_policy") {
    changed[field] = { ...changed[field], tools: ["runtime-dimension-tool"] };
  } else {
    changed[field] = `${changed[field]}-drift`;
  }
  return changed;
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
  runtimeConfigFingerprint = "c".repeat(64),
  runtimeInstructionSha256 = "a".repeat(64),
  startTurnError,
  startTurnBeforeAckGate,
  startTurnCompletedThenError,
  startTurnGate,
  startThreadError,
  threadInstructionSha256,
  threadIdPrefix = "thread-cp8a",
  turnMeasurement = null,
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
    runtimeFingerprint: {
      configSha256: runtimeConfigFingerprint,
      instructionSources: [{ path: "C:/VocaSpace/AGENTS.md", sha256: runtimeInstructionSha256 }],
    },
    interruptWriteBytes: [],
    runtimeEventBytes: [],
    threadWriteBytes: [],
    threadInstructionSha256,
    threadWrites: 0,
    turnWriteBytes: [],
    turnWrites: 0,
    async inspectRuntime() {
      if (typeof inspectGate === "function") await inspectGate();
      else if (inspectGate) await inspectGate;
      inspections += 1;
      this.inspectionCalls += 1;
      return {
        authMode,
        codexVersion: "0.1.0-test",
        configSha256: driftOnSecondInspection && inspections > 1 ? "d".repeat(64) : this.runtimeFingerprint.configSha256,
        effectivePolicy: policy,
        effort: runtime.parameters.effort,
        executablePath: "C:/tools/codex.exe",
        executableSha256: "e".repeat(64),
        instructionSources: structuredClone(this.runtimeFingerprint.instructionSources),
        model: runtime.model,
        platform: "win32-x64",
        protocolSchemaSha256: "f".repeat(64),
        runtimeIdentity: "codex-app-server-test",
      };
    },
    async interruptTurn({ requestBytes }) {
      this.interruptWriteBytes.push(Buffer.from(requestBytes));
      const request = parseJsonlRequest(requestBytes);
      return {
        ...structuredClone(interruptResult),
        ack_event_bytes: jsonlBytes({
          accepted: interruptResult.accepted === true,
          requestId: request.id,
          threadId: request.params.threadId,
          turnId: request.params.turnId,
        }),
        terminal_event_bytes: interruptResult.terminal_event
          ? jsonlBytes({ status: "interrupted", threadId: request.params.threadId, turnId: request.params.turnId })
          : undefined,
      };
    },
    async lookupTurn({ requestId, threadId }) {
      const turnId = lookupStatus === "completed" ? `turn-${threadIdPrefix}-1` : null;
      return lookupStatus === "completed"
        ? {
            event_bytes: jsonlBytes({ requestId, status: lookupStatus, threadId, turnId }),
            status: lookupStatus,
            turn_id: turnId,
          }
        : { event_bytes: jsonlBytes({ requestId, status: lookupStatus, threadId }), status: lookupStatus };
    },
    async startThread({ requestBytes }) {
      const request = parseJsonlRequest(requestBytes);
      this.threadWriteBytes.push(Buffer.from(requestBytes));
      this.threadWrites += 1;
      if (startThreadError) throw new Error("mock thread bootstrap acknowledgement lost");
      threads += 1;
      return {
        instruction_sources: [{ path: "C:/VocaSpace/AGENTS.md", sha256: this.threadInstructionSha256 }],
        request_id: request.id,
        session_id: `session-cp8a-${threads}`,
        thread_id: `${threadIdPrefix}-${threads}`,
      };
    },
    async startTurn({ onEvent, requestBytes }) {
      const request = parseJsonlRequest(requestBytes);
      this.turnWriteBytes.push(Buffer.from(requestBytes));
      this.turnWrites += 1;
      const turnId = `turn-${request.params.threadId}`;
      if (startTurnError) {
        const error = new Error("mock transport failure");
        error.event_bytes = jsonlBytes({
          code: "mock_transport_failure",
          requestId: request.id,
          threadId: request.params.threadId,
        });
        throw error;
      }
      if (startTurnBeforeAckGate) await startTurnBeforeAckGate;
      const writeEventBytes = jsonlBytes(
        { bytes_written: true, requestId: request.id, threadId: request.params.threadId, turnId },
        { leadingWhitespace: true },
      );
      const ackEventBytes = jsonlBytes({ requestId: request.id, threadId: request.params.threadId, turnId });
      const completedEventBytes = jsonlBytes({ requestId: request.id, status: "completed", threadId: request.params.threadId, turnId });
      this.runtimeEventBytes.push(writeEventBytes, ackEventBytes, completedEventBytes);
      onEvent({ event_bytes: writeEventBytes, event_type: "turn_start_write_completed", status: "written", turn_id: turnId });
      onEvent({ event_bytes: ackEventBytes, event_type: "turn_start_acknowledged", status: "acknowledged", turn_id: turnId });
      acknowledge();
      if (startTurnCompletedThenError) {
        onEvent({ event_bytes: completedEventBytes, event_type: "turn_completed", status: "completed", turn_id: turnId });
        throw new Error("mock output delivery failed after terminal event");
      }
      if (startTurnGate) {
        await startTurnGate;
        throw new Error("mock interrupted turn closed without a normal completion response");
      }
      return {
        ack_event_bytes: ackEventBytes,
        completed_event_bytes: completedEventBytes,
        ...(turnMeasurement === null ? {} : { measurement: structuredClone(turnMeasurement) }),
        output: typeof output === "function" ? output(request) : output,
        request_id: request.id,
        terminal_status: "completed",
        thread_id: request.params.threadId,
        turn_id: turnId,
        wire_request_sha256: sha256Bytes(requestBytes),
        write_event_bytes: writeEventBytes,
      };
    },
  };
}

function parseJsonlRequest(requestBytes) {
  assert.ok(Buffer.isBuffer(requestBytes));
  const text = requestBytes.toString("utf8");
  assert.ok(text.endsWith("\n"));
  assert.equal([...text].filter((character) => character === "\n").length, 1);
  return JSON.parse(text);
}

function jsonlBytes(value, { leadingWhitespace = false } = {}) {
  return Buffer.from(`${leadingWhitespace ? " " : ""}${JSON.stringify(value)}\n`, "utf8");
}

function ownerLiveGrant(fixture, limits) {
  return {
    assurance_profile: "runtime_mediated",
    authentication_boundary: "chatgpt_subscription",
    authorized_roles: structuredClone(fixture.run.payload.intent.authority_record.authorized_roles),
    grant_id: "owner-grant-cp8a",
    issued_at: timestamp,
    issuer: "repository-owner",
    live_call_limits: limits,
    run_id: fixture.run.artifact_id,
    runtime_config_sha256: fixture.run.payload.runtime_config_sha256,
    task_id: fixture.task.artifact_id,
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

function hasCertainty(callCertainty) {
  return (error) => error?.callCertainty === callCertainty;
}

function hasCodeAndCertainty(code, callCertainty) {
  return (error) => error instanceof HarnessError && error.code === code && error.callCertainty === callCertainty;
}
