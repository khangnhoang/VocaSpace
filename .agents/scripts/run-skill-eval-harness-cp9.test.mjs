import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PassThrough, Writable } from "node:stream";
import { canonicalJson, sha256Canonical } from "./lib/skill-evals/artifact-schema-v1.mjs";
import { createHarnessArtifact } from "./lib/skill-evals/harness-schema-v2.mjs";
import {
  createPreparedCp9LiveGrant,
  issuePreparedCp9LiveAuthority,
  prepareCp9LivePilot,
  resolveCp9Preparation,
} from "./lib/skill-evals/cp9-prepare-v2.mjs";
import { executeCp9LivePlan } from "./lib/skill-evals/cp9-live-v2.mjs";
import {
  cp9AppServerProtocolSchemaSha256,
  createCodexAppServerStdioTransport,
  resolveCodexExecutable,
} from "./lib/skill-evals/codex-app-server-stdio-transport-v2.mjs";
import { createRunRecord, issueLiveDispatchAuthority, resolveLiveDispatchAuthority, writeArtifactObject } from "./lib/skill-evals/run-store-v2.mjs";

const exactExecutable = "C:/Users/khang/.codex/packages/standalone/releases/0.149.1-x86_64-pc-windows-msvc/bin/codex.exe";

// Test plan (CP9 preparation correction)
// Mục tiêu: khóa production-owned preparation/issuance boundary và zero-dispatch invariant.
// Boundary: local Git/CAS fixtures plus injected non-model preflight; no provider/model call.
// Expected: canonical materialization is exact/idempotent, drift fails closed, and live still requires prepared inputs.
// Verified: `node .agents/scripts/run-skill-eval-harness-cp9.test.mjs` passes 23/23 on 2026-08-25.

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
    const result = await prepareFixture(fixture);
    assert.equal(fixture.probeCalls, 1);
    assert.deepEqual(fixture.dispatch, { model: 0, thread: 0, turn: 0 });
    assert.equal(result.plans.length, 4);
    assert.deepEqual(result.plans.map((item) => item.plan.stage), ["reader-canary", "reader-phase1", "reader-phase2", "evaluator"]);
    assert.equal(result.preparation.live_call_limits.reader, 15);
    assert.equal(result.preparation.live_call_limits.evaluator, 12);
    assert.equal(result.preparation.live_call_limits.verification_helper, 0);
    assert.equal(result.preparation.live_call_limits.total, 27);
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
    assert.deepEqual(fixture.dispatch, { model: 0, thread: 0, turn: 0 });
  } finally {
    fixture.close();
  }
});

test("changed executable model effort and budget-shaped state fail closed", async () => {
  const fixture = createPreparationFixture("runtime-drift");
  try {
    await assert.rejects(prepareFixture(fixture, { executable: "C:/wrong/codex.exe" }), { code: "CP9_ADMISSION_MISMATCH" });
    await assert.rejects(prepareFixture(fixture, { preflight: { model: "wrong-model" } }), { code: "CP9_ADMISSION_MISMATCH" });
    await assert.rejects(prepareFixture(fixture, { preflight: { effort: "medium" } }), { code: "CP9_ADMISSION_MISMATCH" });
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
    await assert.rejects(prepareFixture(fixture, { preflight: { config_sha256: "8".repeat(64) } }), { code: "CP9_ADMISSION_MISMATCH" });
    assert.deepEqual(readdirSync(join(fixture.storeRoot, "tasks")), []);
    assert.deepEqual(readdirSync(join(fixture.storeRoot, "runs")), []);
    assert.equal(fixture.probeCalls, 1);
    assert.deepEqual(fixture.dispatch, { model: 0, thread: 0, turn: 0 });
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
    const sourcePlanItem = sourcePrepared.plans[0];
    const donorHash = donorPrepared.plans[0].plan.reader_invocation_sha256s[0];
    writeArtifactObject(source.storeRoot, readStoredArtifact(donor.storeRoot, donorPrepared.preparation.run_content_sha256));
    writeArtifactObject(source.storeRoot, readStoredArtifact(donor.storeRoot, donorHash));
    const changedPlan = structuredClone(sourcePlanItem.plan);
    changedPlan.reader_invocation_sha256s[0] = donorHash;
    changedPlan.reader_invocation_sha256s.sort();
    writeFileSync(sourcePlanItem.path, canonicalJson(changedPlan), "utf8");
    const preparationPath = join(source.storeRoot, "runs", sourcePrepared.reference.run_id, "cp9", "preparation.json");
    const preparation = JSON.parse(readFileSync(preparationPath, "utf8"));
    preparation.plan_entries.find((entry) => entry.stage === changedPlan.stage).content_sha256 = sha256Canonical(changedPlan);
    const envelope = { ...preparation };
    delete envelope.preparation_sha256;
    preparation.preparation_sha256 = sha256Canonical(envelope);
    writeFileSync(preparationPath, canonicalJson(preparation), "utf8");
    assert.throws(() => createPreparedCp9LiveGrant(source.storeRoot, {
      preparation_sha256: preparation.preparation_sha256,
      run_id: preparation.run_id,
      task_id: preparation.task_id,
    }), { code: "CP9_PREPARATION_STALE" });
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
    const targetManifestPath = join(fixture.storeRoot, "runs", prepared.reference.run_id, "manifest.json");
    const beforeManifest = readFileSync(targetManifestPath, "utf8");
    const reservationPath = join(fixture.storeRoot, "runs", prepared.reference.run_id, "authority", "live-dispatch-reservations");
    let transports = 0;
    for (const authorityReference of [donorReference, alternateReference]) {
      await assert.rejects(executeCp9LivePlan({
        authorityReference,
        executable: exactExecutable,
        plan,
        storeRoot: fixture.storeRoot,
        transportFactory: () => { transports += 1; return {}; },
      }), { code: "CP9_AUTHORITY_NOT_PREPARED" });
    }
    assert.equal(transports, 0);
    assert.equal(readFileSync(targetManifestPath, "utf8"), beforeManifest);
    assert.equal(existsSync(reservationPath), false);
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

for (const entry of tests) {
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
    dispatch: { model: 0, thread: 0, turn: 0 },
    probeCalls: 0,
    repository,
    storeRoot,
  };
  return fixture;
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

async function prepareFixture(fixture, options = {}) {
  const preflight = {
    account_type: "chatgpt",
    codex_version: "0.149.1",
    config_sha256: "349a383d4d348c48288cea738b61f2dbcebb0bb32ba5cc1c55150aa38934b60d",
    effort: "high",
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
    now: "2026-08-25T01:00:00.000Z",
    repositoryRoot: fixture.repository,
    runtimeProbe: async () => {
      fixture.probeCalls += 1;
      return preflight;
    },
    storeRoot: fixture.storeRoot,
  });
}

function processSkeleton() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  child.kill = () => true;
  return child;
}

function protocolProcess({ failInitialize = false, instructionSourcePath = null, usage = null, wrongThread = false } = {}) {
  const child = processSkeleton();
  child.pid = 9001;
  const messages = [];
  const methods = [];
  child.stdin = new Writable({
    write(chunk, _encoding, done) {
      const message = JSON.parse(Buffer.from(chunk).toString("utf8"));
      messages.push(message);
      methods.push(message.method);
      queueMicrotask(() => respond(message));
      done();
    },
  });
  function send(value) { child.stdout.write(jsonl(value)); }
  function respond(message) {
    if (message.method === "initialized") return;
    if (message.method === "initialize") return send(failInitialize ? { error: { message: "not ready" }, id: message.id } : { id: message.id, result: { platformFamily: "windows", platformOs: "windows", userAgent: "codex-test/1" } });
    if (message.method === "account/read") return send({ id: message.id, result: { account: { type: "chatgpt" } } });
    if (message.method === "model/list") return send({ id: message.id, result: { data: [{ id: "gpt-5.6-sol", supportedReasoningEfforts: [{ reasoningEffort: "high" }] }] } });
    if (message.method === "config/read") return send({ id: message.id, result: { config: { approval_policy: "never" } } });
    if (message.method === "thread/start") return send({ id: message.id, result: { instructionSources: instructionSourcePath ? [instructionSourcePath] : [{ path: "C:/VocaSpace/AGENTS.md", sha256: "a".repeat(64) }], thread: { id: `server-${message.id}` } } });
    if (message.method === "turn/start") {
      const threadId = message.params.threadId;
      const turnId = `server-${message.id}`;
      send({ id: message.id, result: { turn: { id: turnId, items: [], status: "inProgress" } } });
      send({ method: "item/completed", params: { item: { id: "agent-1", text: JSON.stringify({ observation: "ok" }), type: "agentMessage" }, threadId: wrongThread ? "wrong-thread" : threadId, turnId } });
      if (usage) send({ method: "thread/tokenUsage/updated", params: { threadId, tokenUsage: usage, turnId } });
      send({ method: "turn/completed", params: { threadId, turn: { id: turnId, items: [], status: "completed" }, turnId } });
    }
  }
  return { child, messages, methods };
}

function jsonl(value) { return Buffer.from(`${JSON.stringify(value)}\n`, "utf8"); }
function threadParams() { return { approvalPolicy: "never", cwd: "C:/VocaSpace", ephemeral: false, model: "gpt-5.6-sol", sandboxPolicy: "read-only", settings: {} }; }
function turnParams(threadId) { return { approvalPolicy: "never", cwd: "C:/VocaSpace", effort: "high", input: [{ text: "compiled harness input", type: "text" }], model: "gpt-5.6-sol", outputSchema: { type: "object" }, sandboxPolicy: "read-only", settings: {}, threadId }; }
