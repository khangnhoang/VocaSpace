import { execFileSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { hostname } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { canonicalJson, canonicalJsonLine, parseStrictJson, sha256Bytes, sha256Canonical } from "./artifact-schema-v1.mjs";
import {
  HarnessError,
  assertHarnessArtifact,
  assertRuntimeCredentialFree,
  canonicalHarnessJson,
  createHarnessArtifact,
  renderCodexAppServerInput,
  validateArtifactGraph,
} from "./harness-schema-v2.mjs";
import {
  isCodexFailedTurnMessage,
  isCodexFailedTurnReason,
} from "./codex-app-server-failed-turn-reason-v2.mjs";

export const storeDirectoryName = "vocaspace-agent-skill-evals";
export const storeLayoutVersion = "v2";

const stateTransitions = Object.freeze({
  created: ["preflight", "blocked", "failed", "cancelled", "abandoned"],
  preflight: ["readiness", "blocked", "failed", "cancelled", "abandoned"],
  readiness: ["ready", "blocked", "failed", "cancelled", "abandoned"],
  ready: ["reading", "blocked", "failed", "cancelled", "abandoned"],
  reading: ["reader_complete", "blocked", "failed", "cancelled", "abandoned"],
  reader_complete: ["evaluating", "blocked", "failed", "cancelled", "abandoned"],
  evaluating: ["review_pending", "blocked", "failed", "cancelled", "abandoned"],
  review_pending: ["accepted", "rejected", "rerun_required", "blocked", "failed", "cancelled", "abandoned"],
  accepted: ["reported", "blocked", "failed", "cancelled", "abandoned"],
  reported: ["completed", "blocked", "failed", "cancelled", "abandoned"],
  rejected: [],
  rerun_required: ["preflight", "cancelled", "abandoned"],
  blocked: ["preflight", "readiness", "ready", "reading", "evaluating", "review_pending", "cancelled", "abandoned"],
  failed: [],
  cancelled: [],
  abandoned: [],
  completed: [],
});

const runtimeSnapshotFilesystemFailures = new WeakMap();
const leasePublicationFilesystemFailures = new WeakMap();
const runtimeSnapshotPublicationSubsteps = Object.freeze([
  "artifact_object_publication",
  "runtime_attempts_directory_creation",
  "temporary_snapshot_directory_creation",
  "snapshot_file_write",
  "snapshot_directory_rename",
  "temporary_snapshot_directory_cleanup",
  "runtime_index_rebuild",
]);

export function resolveHarnessStoreRoot(repositoryRoot, options = {}) {
  const repository = realpathSync(resolve(repositoryRoot));
  const commonDirValue =
    options.gitCommonDir ??
    execFileSync("git", ["rev-parse", "--git-common-dir"], {
      cwd: repository,
      encoding: "utf8",
      windowsHide: true,
    }).trim();
  const commonDir = realpathSync(isAbsolute(commonDirValue) ? commonDirValue : resolve(repository, commonDirValue));
  return join(commonDir, storeDirectoryName, storeLayoutVersion);
}

export function initializeRunStore(root) {
  const storeRoot = resolve(root);
  for (const directory of [
    "tasks",
    "runs",
    "objects",
    "indexes",
    "quarantine",
    "trash",
  ]) {
    mkdirSync(join(storeRoot, directory), { recursive: true });
  }
  return storeRoot;
}

export function writeArtifactObject(root, artifact, options = {}) {
  const validated = assertHarnessArtifact(artifact);
  validateStoredLinks(root, validated);
  const objectPath = objectFile(root, validated.content_sha256);
  const bytes = canonicalHarnessJson(validated);
  if (existsSync(objectPath)) {
    if (readFileSync(objectPath, "utf8") !== bytes) {
      fail("STORE_OBJECT_COLLISION", "An existing object does not match its content address.", 3);
    }
    return objectPath;
  }
  mkdirSync(dirname(objectPath), { recursive: true });
  writeAtomic(objectPath, bytes, { ...options, namespace: "object", exclusive: true });
  return objectPath;
}

export function readArtifactObject(root, contentSha256) {
  return readArtifactObjectInternal(root, contentSha256, new Set());
}

export function listStoredArtifacts(root, options = {}) {
  const objectsRoot = containedPath(root, "objects");
  if (!existsSync(objectsRoot)) return [];
  const results = [];
  for (const prefix of sortedDirectories(objectsRoot)) {
    const prefixRoot = containedPath(root, "objects", prefix);
    for (const contentSha256 of sortedDirectories(prefixRoot)) {
      const artifact = readArtifactObject(root, contentSha256);
      if (options.artifactType && artifact.artifact_type !== options.artifactType) continue;
      if (options.runId && !artifactBelongsToRun(artifact, options.runId)) continue;
      results.push(artifact);
    }
  }
  return results.sort((left, right) => {
    const leftKey = `${left.artifact_type}:${left.artifact_id}:${left.content_sha256}`;
    const rightKey = `${right.artifact_type}:${right.artifact_id}:${right.content_sha256}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
}

function readArtifactObjectInternal(root, contentSha256, visited) {
  assertHash(contentSha256, "contentSha256");
  const path = objectFile(root, contentSha256);
  if (!existsSync(path)) fail("STORE_OBJECT_MISSING", "A referenced content-addressed object is missing.", 3);
  const artifact = assertHarnessArtifact(parseStrictJson(readFileSync(path), "stored artifact"));
  if (artifact.content_sha256 !== contentSha256) {
    fail("STORE_OBJECT_CORRUPT", "A stored object does not match its object address.", 3);
  }
  if (!visited.has(contentSha256)) {
    visited.add(contentSha256);
    validateStoredLinks(root, artifact, visited);
  }
  return artifact;
}

function artifactBelongsToRun(artifact, runId) {
  if (artifact.payload?.run_id === runId) return true;
  return artifact.links.some(
    (link) => link.relationship === "run" && link.target_artifact_type === "run_manifest" && link.target_artifact_id === runId,
  );
}

export function persistTaskManifest(root, task, options = {}) {
  assertHarnessArtifact(task, { artifactType: "task_manifest" });
  const taskPath = safeEntityFile(root, "tasks", task.artifact_id, "task.json");
  writeArtifactObject(root, task, options);
  writeImmutable(taskPath, canonicalHarnessJson(task), { ...options, namespace: "task" });
  return task;
}

export function loadTaskManifest(root, taskId) {
  const taskPath = safeEntityFile(root, "tasks", taskId, "task.json");
  if (!existsSync(taskPath)) fail("TASK_NOT_FOUND", "The requested task does not exist.");
  return assertHarnessArtifact(parseStrictJson(readFileSync(taskPath), "task manifest"), {
    artifactType: "task_manifest",
    artifactId: taskId,
  });
}

export function createRunRecord(root, task, run, options = {}) {
  assertHarnessArtifact(task, { artifactType: "task_manifest" });
  assertHarnessArtifact(run, { artifactType: "run_manifest" });
  if (run.payload.revision !== 0 || run.payload.state !== "created") {
    fail("RUN_STATE_INVALID", "A new run must start at revision 0 in state 'created'.");
  }
  validateArtifactGraph([task, run]);
  persistTaskManifest(root, task, options);
  writeArtifactObject(root, run, options);
  const manifestPath = safeEntityFile(root, "runs", run.artifact_id, "manifest.json");
  if (existsSync(manifestPath)) fail("RUN_ALREADY_EXISTS", "The run already exists.");
  appendJournalEvent(
    root,
    {
      artifact_id: run.artifact_id,
      artifact_type: "run_manifest",
      details: { kind: "state", state: "created" },
      expected_revision: null,
      next_revision: 0,
      occurred_at: options.now ?? new Date().toISOString(),
      run_id: run.artifact_id,
      target_content_sha256: run.content_sha256,
      type: "run_created",
    },
    options,
  );
  inject(options, "run.after-journal");
  writeAtomic(manifestPath, canonicalHarnessJson(run), { ...options, namespace: "manifest" });
  return run;
}

export function loadRunManifest(root, runId) {
  const manifestPath = safeEntityFile(root, "runs", runId, "manifest.json");
  if (!existsSync(manifestPath)) fail("RUN_NOT_FOUND", "The requested run does not exist.");
  return assertHarnessArtifact(parseStrictJson(readFileSync(manifestPath), "run manifest"), {
    artifactType: "run_manifest",
    artifactId: runId,
  });
}

export function transitionRun(root, { runId, expectedRevision, nextState, now, faultAt, leaseToken }) {
  assertActiveLease(root, runId, leaseToken, now);
  const current = loadRunManifest(root, runId);
  if (current.payload.revision !== expectedRevision) {
    fail("RUN_REVISION_CONFLICT", "Run revision changed; reload state before retrying.", 4);
  }
  const allowed = stateTransitions[current.payload.state] ?? [];
  if (!allowed.includes(nextState)) {
    fail("RUN_TRANSITION_INVALID", `Transition '${current.payload.state}' -> '${nextState}' is not allowed.`);
  }
  const next = createHarnessArtifact({
    artifactType: "run_manifest",
    artifactId: runId,
    producer: current.producer,
    links: current.links,
    payload: { ...current.payload, revision: expectedRevision + 1, state: nextState },
  });
  const options = { faultAt, leaseToken, now };
  writeArtifactObject(root, next, options);
  inject(options, "transition.after-object");
  appendJournalEvent(
    root,
    {
      artifact_id: runId,
      artifact_type: "run_manifest",
      details: { from: current.payload.state, kind: "state", state: nextState },
      expected_revision: expectedRevision,
      next_revision: expectedRevision + 1,
      occurred_at: now ?? new Date().toISOString(),
      run_id: runId,
      target_content_sha256: next.content_sha256,
      type: "run_transitioned",
    },
    options,
  );
  inject(options, "transition.after-journal");
  writeAtomic(safeEntityFile(root, "runs", runId, "manifest.json"), canonicalHarnessJson(next), {
    ...options,
    namespace: "manifest",
  });
  return next;
}

export function appendAttemptPhase(root, artifact, options = {}) {
  assertHarnessArtifact(artifact, { artifactType: "execution_attempt" });
  const { attempt_id: attemptId, phase, run_id: runId } = artifact.payload;
  assertActiveLease(root, runId, options.leaseToken, options.now);
  const run = loadRunManifest(root, runId);
  const runLink = artifact.links.find((link) => link.relationship === "run");
  if (!runLink || runLink.target_artifact_id !== runId) fail("ATTEMPT_RELATIONSHIP_INVALID", "Attempt run link is invalid.");
  if (run.payload.run_id !== runId) fail("ATTEMPT_RELATIONSHIP_INVALID", "Attempt run identity is invalid.");
  if (
    artifact.payload.role !== "verification_helper" &&
    !run.payload.selected_units.some(
      (unit) => unit.unit_id === artifact.payload.unit_id && unit.role === artifact.payload.role,
    )
  ) {
    fail("ATTEMPT_RELATIONSHIP_INVALID", "Attempt unit is not selected for its role in this run.");
  }
  const phasePath = safeAttemptFile(root, runId, attemptId, `${phase}.json`);
  const prior = readAttemptPhases(root, runId, attemptId);
  if (prior[phase]?.content_sha256 === artifact.content_sha256) return artifact;
  if (phase === "prepared") assertNextAttemptSequence(root, artifact);
  assertAttemptTransition(prior, artifact);
  writeArtifactObject(root, artifact, options);
  inject(options, "attempt.after-object");
  writeImmutable(phasePath, canonicalHarnessJson(artifact), { ...options, namespace: "attempt" });
  inject(options, "attempt.after-record");
  appendJournalEvent(
    root,
    {
      artifact_id: artifact.artifact_id,
      artifact_type: "execution_attempt",
      details: { attempt_id: attemptId, kind: "attempt", phase },
      expected_revision: run.payload.revision,
      next_revision: run.payload.revision,
      occurred_at: options.now ?? new Date().toISOString(),
      run_id: runId,
      target_content_sha256: artifact.content_sha256,
      type: "attempt_recorded",
    },
    options,
  );
  return artifact;
}

export function recordAttemptControl(root, { attempt, control, leaseToken, now, timeoutPhase = null }) {
  assertHarnessArtifact(attempt, { artifactType: "execution_attempt" });
  if (attempt.payload.phase !== "dispatched" || !["cancel_requested", "timeout_requested"].includes(control)) {
    fail("ATTEMPT_CONTROL_INVALID", "Attempt controls require an exact dispatched attempt and supported control.");
  }
  if (
    (control === "timeout_requested" && !["dispatch", "connect", "response"].includes(timeoutPhase)) ||
    (control === "cancel_requested" && timeoutPhase !== null)
  ) {
    fail("ATTEMPT_CONTROL_INVALID", "Attempt control timeout phase does not match the requested control.");
  }
  assertActiveLease(root, attempt.payload.run_id, leaseToken, now);
  const stored = readAttemptPhases(root, attempt.payload.run_id, attempt.payload.attempt_id).dispatched;
  if (!stored || stored.content_sha256 !== attempt.content_sha256) {
    fail("ATTEMPT_CONTROL_INVALID", "Attempt control must target the exact persisted dispatched phase.");
  }
  if (
    readJournal(root, attempt.payload.run_id).some(
      (event) => event.type === "attempt_control_requested" && event.details.attempt_id === attempt.payload.attempt_id,
    )
  ) {
    fail("ATTEMPT_CONTROL_INVALID", "An attempt may record only one terminal control request.");
  }
  const run = loadRunManifest(root, attempt.payload.run_id);
  appendJournalEvent(
    root,
    {
      artifact_id: attempt.artifact_id,
      artifact_type: "execution_attempt",
      details: { attempt_id: attempt.payload.attempt_id, control, kind: "control", timeout_phase: timeoutPhase },
      expected_revision: run.payload.revision,
      next_revision: run.payload.revision,
      occurred_at: now ?? new Date().toISOString(),
      run_id: run.artifact_id,
      target_content_sha256: attempt.content_sha256,
      type: "attempt_control_requested",
    },
    { leaseToken, now },
  );
}

export function recordAttemptRetryClassification(
  root,
  { attempt, leaseToken, now, retryClass, retryPolicySha256, retryable },
) {
  assertHarnessArtifact(attempt, { artifactType: "execution_attempt" });
  if (attempt.payload.phase !== "terminal" || attempt.payload.outcome !== "error") {
    fail("ATTEMPT_RETRY_INVALID", "Retry classification requires an exact terminal error attempt.");
  }
  assertIdentity(retryClass, "retryClass");
  assertHash(retryPolicySha256, "retryPolicySha256");
  if (typeof retryable !== "boolean") fail("ATTEMPT_RETRY_INVALID", "Retry classification must be boolean.");
  assertActiveLease(root, attempt.payload.run_id, leaseToken, now);
  const stored = readAttemptPhases(root, attempt.payload.run_id, attempt.payload.attempt_id).terminal;
  if (!stored || stored.content_sha256 !== attempt.content_sha256) {
    fail("ATTEMPT_RETRY_INVALID", "Retry classification must target the exact persisted terminal error.");
  }
  if (
    readJournal(root, attempt.payload.run_id).some(
      (event) => event.type === "attempt_retry_classified" && event.details.attempt_id === attempt.payload.attempt_id,
    )
  ) {
    fail("ATTEMPT_RETRY_INVALID", "An attempt may record only one retry classification.");
  }
  const run = loadRunManifest(root, attempt.payload.run_id);
  appendJournalEvent(
    root,
    {
      artifact_id: attempt.artifact_id,
      artifact_type: "execution_attempt",
      details: {
        attempt_id: attempt.payload.attempt_id,
        kind: "retry_classification",
        retry_class: retryClass,
        retry_policy_sha256: retryPolicySha256,
        retryable,
      },
      expected_revision: run.payload.revision,
      next_revision: run.payload.revision,
      occurred_at: now ?? new Date().toISOString(),
      run_id: run.artifact_id,
      target_content_sha256: attempt.content_sha256,
      type: "attempt_retry_classified",
    },
    { leaseToken, now },
  );
}

function assertNextAttemptSequence(root, artifact) {
  const { attempt_id: attemptId, role, run_id: runId, sequence, unit_id: unitId } = artifact.payload;
  const attemptsRoot = safeRunFile(root, runId, "attempts");
  const existingSequences = [];
  if (existsSync(attemptsRoot)) {
    for (const existingAttemptId of sortedDirectories(attemptsRoot)) {
      if (existingAttemptId === attemptId) continue;
      const phases = readAttemptPhases(root, runId, existingAttemptId);
      const head = phases.terminal ?? phases.dispatched ?? phases.prepared;
      if (head?.payload.role === role && head.payload.unit_id === unitId) {
        existingSequences.push(head.payload.sequence);
      }
    }
  }
  const unique = new Set(existingSequences);
  if (unique.size !== existingSequences.length) {
    fail("ATTEMPT_RECORD_CORRUPT", "Existing attempt sequences are ambiguous for one executable unit.", 3);
  }
  existingSequences.sort((left, right) => left - right);
  if (existingSequences.some((existing, index) => existing !== index + 1)) {
    fail("ATTEMPT_RECORD_CORRUPT", "Existing attempt sequences are discontinuous for one executable unit.", 3);
  }
  const expected = existingSequences.length + 1;
  if (sequence !== expected) {
    fail("ATTEMPT_SEQUENCE_CONFLICT", "A new attempt must use the next sequence for its exact role/unit.");
  }
}

export function readAttemptPhases(root, runId, attemptId) {
  const phases = {};
  const attemptDirectory = safeRunFile(root, runId, "attempts", attemptId);
  if (existsSync(attemptDirectory)) {
    const allowed = new Set(["prepared.json", "dispatched.json", "terminal.json"]);
    for (const entry of readdirSync(attemptDirectory, { withFileTypes: true })) {
      const temporary = entry.isFile() && /^\..+\.tmp$/.test(entry.name);
      if ((!entry.isFile() || !allowed.has(entry.name)) && !temporary) {
        fail("ATTEMPT_RECORD_CORRUPT", "Attempt directory contains an unexpected record.", 3);
      }
    }
  }
  for (const phase of ["prepared", "dispatched", "terminal"]) {
    const path = safeAttemptFile(root, runId, attemptId, `${phase}.json`);
    if (existsSync(path)) {
      const artifact = assertHarnessArtifact(parseStrictJson(readFileSync(path), `${phase} attempt`), {
        artifactType: "execution_attempt",
      });
      if (artifact.payload.run_id !== runId || artifact.payload.attempt_id !== attemptId || artifact.payload.phase !== phase) {
        fail("ATTEMPT_RECORD_CORRUPT", "Attempt phase identity does not match its storage path.", 3);
      }
      readArtifactObject(root, artifact.content_sha256);
      phases[phase] = artifact;
    }
  }
  validateAttemptChain(phases);
  return phases;
}

export function readJournal(root, runId) {
  const path = safeRunFile(root, runId, "journal.ndjson");
  if (!existsSync(path)) return [];
  const text = readFileSync(path, "utf8");
  if (text.length > 0 && !text.endsWith("\n")) fail("JOURNAL_CORRUPT", "Journal is not newline terminated.", 3);
  const events =
    text === ""
      ? []
      : text
          .trimEnd()
          .split("\n")
          .map((line) => parseStrictJson(Buffer.from(`${line}\n`, "utf8"), "journal event"));
  let previous = null;
  let currentRevision = null;
  for (const [index, event] of events.entries()) {
    assertJournalEvent(event, index + 1, previous, runId);
    previous = event.event_sha256;
    const target = readArtifactObject(root, event.target_content_sha256);
    if (target.artifact_type !== event.artifact_type || target.artifact_id !== event.artifact_id) {
      fail("JOURNAL_CORRUPT", "Journal target identity does not match its referenced object.", 3);
    }
    currentRevision = assertJournalContinuity(event, target, currentRevision, index);
  }
  validateRuntimeDiagnosticSequences(events);
  return events;
}

export function recordRuntimeJournalEvent(
  root,
  { attempt, diagnostic = null, event, leaseToken, now, requestId, requestJson = null, requestSha256, sessionId = null, status, threadId = null, turnId = null },
) {
  assertHarnessArtifact(attempt, { artifactType: "execution_attempt" });
  const allowed = new Set([
    "thread_start_write_intent",
    "thread_start_write_completed",
    "thread_start_response_observed",
    "thread_start_failure_diagnostic",
    "thread_start_acknowledged",
    "thread_start_outcome_unknown",
    "predispatch_failure_diagnostic",
    "postdispatch_failure_diagnostic",
    "turn_start_write_intent",
  ]);
  if (!allowed.has(event)) fail("RUNTIME_JOURNAL_INVALID", "Runtime journal event is unsupported.");
  if (
    (event === "thread_start_write_intent" && (attempt.payload.phase !== "prepared" || status !== "intent" || threadId !== null)) ||
    (event === "thread_start_write_completed" && (attempt.payload.phase !== "prepared" || status !== "written" || threadId !== null)) ||
    (event === "thread_start_response_observed" && (attempt.payload.phase !== "prepared" || status !== "observed" || threadId !== null)) ||
    (event === "thread_start_failure_diagnostic" && (attempt.payload.phase !== "prepared" || status !== "error" || threadId !== null)) ||
    (event === "thread_start_acknowledged" && (attempt.payload.phase !== "prepared" || status !== "acknowledged" || threadId === null)) ||
    (event === "thread_start_outcome_unknown" && (attempt.payload.phase !== "prepared" || status !== "unknown")) ||
    (event === "predispatch_failure_diagnostic" && (attempt.payload.phase !== "prepared" || status !== "error" || threadId === null)) ||
    (event === "postdispatch_failure_diagnostic" && (attempt.payload.phase !== "dispatched" || status !== "error" || threadId === null)) ||
    (event === "turn_start_write_intent" && (attempt.payload.phase !== "dispatched" || status !== "intent" || threadId === null))
  ) {
    fail("RUNTIME_JOURNAL_INVALID", "Runtime journal event does not match its exact attempt phase/status.");
  }
  assertIdentity(requestId, "requestId");
  assertHash(requestSha256, "requestSha256");
  if (event === "thread_start_write_intent") {
    if (
      typeof requestJson !== "string" ||
      canonicalJsonLine(parseStrictJson(Buffer.from(requestJson, "utf8"), "thread start request")) !== requestJson ||
      sha256Bytes(Buffer.from(requestJson, "utf8")) !== requestSha256
    ) {
      fail("RUNTIME_JOURNAL_INVALID", "Thread start intent requires its exact canonical request bytes.");
    }
  } else if (requestJson !== null) {
    fail("RUNTIME_JOURNAL_INVALID", "Only thread start intent owns retained bootstrap request bytes.");
  }
  if (event === "thread_start_failure_diagnostic") assertCurrentThreadStartDiagnostic(diagnostic, "RUNTIME_JOURNAL_INVALID");
  else if (event === "predispatch_failure_diagnostic") assertPredispatchFailureDiagnostic(diagnostic, "RUNTIME_JOURNAL_INVALID");
  else if (event === "postdispatch_failure_diagnostic") assertPostdispatchFailureDiagnostic(diagnostic, "RUNTIME_JOURNAL_INVALID");
  else if (diagnostic !== null) fail("RUNTIME_JOURNAL_INVALID", "Only runtime failure diagnostics own diagnostic evidence.");
  if (threadId !== null) assertIdentity(threadId, "threadId");
  if (sessionId !== null) assertIdentity(sessionId, "sessionId");
  if (turnId !== null) assertIdentity(turnId, "turnId");
  assertActiveLease(root, attempt.payload.run_id, leaseToken, now);
  const phases = readAttemptPhases(root, attempt.payload.run_id, attempt.payload.attempt_id);
  const stored = phases[attempt.payload.phase];
  if (!stored || stored.content_sha256 !== attempt.content_sha256) {
    fail("RUNTIME_JOURNAL_INVALID", "Runtime journal event must target the exact persisted attempt phase.");
  }
  const duplicate = readJournal(root, attempt.payload.run_id).some(
    (entry) =>
      entry.type === "runtime_recorded" &&
      entry.details.attempt_id === attempt.payload.attempt_id &&
      entry.details.event === event,
  );
  if (duplicate) fail("RUNTIME_JOURNAL_INVALID", "Runtime journal event already exists for this attempt.");
  const run = loadRunManifest(root, attempt.payload.run_id);
  return appendJournalEvent(
    root,
    {
      artifact_id: attempt.artifact_id,
      artifact_type: "execution_attempt",
      details: {
        attempt_id: attempt.payload.attempt_id,
        event,
        kind: "runtime",
        request_id: requestId,
        request_json: requestJson,
        request_sha256: requestSha256,
        session_id: sessionId,
        status,
        thread_id: threadId,
        turn_id: turnId,
        ...(["thread_start_failure_diagnostic", "predispatch_failure_diagnostic", "postdispatch_failure_diagnostic"].includes(event)
          ? { diagnostic: structuredClone(diagnostic) }
          : {}),
      },
      expected_revision: run.payload.revision,
      next_revision: run.payload.revision,
      occurred_at: now ?? new Date().toISOString(),
      run_id: run.artifact_id,
      target_content_sha256: attempt.content_sha256,
      type: "runtime_recorded",
    },
    { leaseToken, now },
  );
}

export function publishRuntimeSnapshot(
  root,
  { attempt, attestation, dispatchRequest, inputText, leaseToken, now, faultAt },
) {
  assertHarnessArtifact(attempt, { artifactType: "execution_attempt" });
  assertHarnessArtifact(attestation, { artifactType: "runtime_attestation" });
  assertHarnessArtifact(dispatchRequest, { artifactType: "runtime_dispatch_request" });
  if (attempt.payload.phase !== "prepared") fail("RUNTIME_SNAPSHOT_INVALID", "Runtime snapshot requires a prepared attempt.");
  assertActiveLease(root, attempt.payload.run_id, leaseToken, now);
  if (
    !hasExactStoredLink(attestation, "execution_attempt", attempt) ||
    !hasExactStoredLink(dispatchRequest, "execution_attempt", attempt) ||
    !hasExactStoredLink(dispatchRequest, "runtime_attestation", attestation)
  ) {
    fail("RUNTIME_SNAPSHOT_INVALID", "Runtime snapshot artifacts do not bind the exact prepared attempt and attestation.");
  }
  if (typeof inputText !== "string" || !inputText.endsWith("\n")) {
    fail("RUNTIME_SNAPSHOT_INVALID", "Human-readable runtime input must be newline terminated UTF-8 text.");
  }
  if (sha256Bytes(Buffer.from(inputText, "utf8")) !== dispatchRequest.payload.input_sha256) {
    fail("RUNTIME_SNAPSHOT_INVALID", "Human-readable runtime input hash does not match the exact dispatch request.");
  }
  runRuntimeSnapshotPublicationStep(root, "artifact_object_publication", () => {
    writeArtifactObject(root, attestation, { faultAt, leaseToken, now });
    writeArtifactObject(root, dispatchRequest, { faultAt, leaseToken, now });
  });
  const runtimeRoot = safeRunFile(root, attempt.payload.run_id, "runtime");
  const attemptsRoot = containedPath(runtimeRoot, "attempts");
  runRuntimeSnapshotPublicationStep(root, "runtime_attempts_directory_creation", () => {
    mkdirSync(attemptsRoot, { recursive: true });
  });
  const finalDirectory = containedPath(attemptsRoot, attempt.payload.attempt_id);
  const snapshot = {
    attempt_id: attempt.payload.attempt_id,
    input_sha256: dispatchRequest.payload.input_sha256,
    input_view_version: "length-delimited-utf8-v1",
    request_sha256: dispatchRequest.payload.wire_request_sha256,
    request_view_version: "app-server-jsonl-v1",
    runtime_attestation_artifact_id: attestation.artifact_id,
    runtime_attestation_sha256: attestation.content_sha256,
    runtime_dispatch_request_artifact_id: dispatchRequest.artifact_id,
    runtime_dispatch_request_sha256: dispatchRequest.content_sha256,
    snapshot_version: "runtime-snapshot-v1",
  };
  const expectedFiles = new Map([
    ["events.json", canonicalJson([])],
    ["input.txt", inputText],
    ["request.json", dispatchRequest.payload.request_json],
    ["snapshot.json", canonicalJson(snapshot)],
  ]);
  if (existsSync(finalDirectory)) {
    assertRuntimeSnapshotDirectory(finalDirectory, expectedFiles);
  } else {
    const temporary = containedPath(attemptsRoot, `.${attempt.payload.attempt_id}.${process.pid}.${randomUUID()}.tmp`);
    let publicationError = null;
    try {
      runRuntimeSnapshotPublicationStep(root, "temporary_snapshot_directory_creation", () => {
        mkdirSync(temporary);
      });
      for (const [name, bytes] of expectedFiles) {
        runRuntimeSnapshotPublicationStep(root, "snapshot_file_write", () => {
          writeAtomic(containedPath(temporary, name), bytes, { faultAt, namespace: "runtime-snapshot", exclusive: true });
        });
      }
      runRuntimeSnapshotPublicationStep(root, "snapshot_directory_rename", () => {
        inject({ faultAt }, "runtime-snapshot.before-publish");
        renameSync(temporary, finalDirectory);
        inject({ faultAt }, "runtime-snapshot.after-publish");
      });
    } catch (error) {
      publicationError = error;
    }
    let cleanupError = null;
    if (existsSync(temporary)) {
      try {
        runRuntimeSnapshotPublicationStep(root, "temporary_snapshot_directory_cleanup", () => {
          inject({ faultAt }, "runtime-snapshot.before-cleanup");
          rmSync(temporary, { recursive: true });
        });
      } catch (error) {
        cleanupError = error;
      }
    }
    if (publicationError) throw publicationError;
    if (cleanupError) throw cleanupError;
  }
  runRuntimeSnapshotPublicationStep(root, "runtime_index_rebuild", () => {
    rebuildRuntimeIndex(root, attempt.payload.run_id, { faultAt });
  });
  return readRuntimeSnapshot(root, attempt.payload.run_id, attempt.payload.attempt_id);
}

export function recordReaderEvidenceFailureDiagnostic(
  root,
  { attempt, diagnostic, leaseToken, now },
) {
  assertHarnessArtifact(attempt, { artifactType: "execution_attempt" });
  if (
    attempt.payload.phase !== "terminal" ||
    attempt.payload.role !== "reader" ||
    attempt.payload.call_certainty !== "confirmed_finished" ||
    attempt.payload.outcome !== "error"
  ) {
    fail("READER_EVIDENCE_DIAGNOSTIC_INVALID", "Reader evidence failure diagnostic requires the exact confirmed-finished terminal error attempt.");
  }
  assertReaderEvidenceFailureDiagnostic(diagnostic, "READER_EVIDENCE_DIAGNOSTIC_INVALID");
  assertActiveLease(root, attempt.payload.run_id, leaseToken, now);
  const stored = readAttemptPhases(root, attempt.payload.run_id, attempt.payload.attempt_id).terminal;
  if (!stored || stored.content_sha256 !== attempt.content_sha256) {
    fail("READER_EVIDENCE_DIAGNOSTIC_INVALID", "Reader evidence failure diagnostic must target the exact persisted terminal attempt.");
  }
  const snapshot = readRuntimeSnapshot(root, attempt.payload.run_id, attempt.payload.attempt_id);
  if (!snapshot.events.some((event) => event.event_type === "turn_completed" && event.status === "completed")) {
    fail("READER_EVIDENCE_DIAGNOSTIC_INVALID", "Reader evidence failure diagnostic requires exact completed terminal proof.");
  }
  const events = readJournal(root, attempt.payload.run_id);
  if (events.some(
    (event) => event.type === "reader_evidence_failure_recorded" && event.details.attempt_id === attempt.payload.attempt_id,
  )) {
    fail("READER_EVIDENCE_DIAGNOSTIC_INVALID", "Reader evidence failure diagnostic already exists for this attempt.");
  }
  const run = loadRunManifest(root, attempt.payload.run_id);
  return appendJournalEvent(
    root,
    {
      artifact_id: attempt.artifact_id,
      artifact_type: "execution_attempt",
      details: {
        attempt_id: attempt.payload.attempt_id,
        diagnostic: structuredClone(diagnostic),
        kind: "reader_evidence_failure",
      },
      expected_revision: run.payload.revision,
      next_revision: run.payload.revision,
      occurred_at: now ?? new Date().toISOString(),
      run_id: run.artifact_id,
      target_content_sha256: attempt.content_sha256,
      type: "reader_evidence_failure_recorded",
    },
    { leaseToken, now },
  );
}

export function readRuntimeSnapshotFilesystemFailure(error) {
  const failure = error && typeof error === "object" ? runtimeSnapshotFilesystemFailures.get(error) : null;
  return failure ? structuredClone(failure) : null;
}

export function reserveLiveDispatchCall(
  root,
  { attempt, grantSha256, leaseToken, limits, now, role },
) {
  assertHarnessArtifact(attempt, { artifactType: "execution_attempt" });
  if (attempt.payload.phase !== "prepared" || attempt.payload.role !== role) {
    fail("LIVE_DISPATCH_RESERVATION_INVALID", "Live dispatch reservation requires the exact prepared role attempt.", 4);
  }
  assertHash(grantSha256, "grantSha256");
  assertExactKeys(limits, ["evaluator", "reader", "total", "verification_helper"]);
  for (const value of Object.values(limits)) {
    if (!Number.isInteger(value) || value < 0) {
      fail("LIVE_DISPATCH_RESERVATION_INVALID", "Live dispatch limits must be non-negative integers.", 4);
    }
  }
  assertActiveLease(root, attempt.payload.run_id, leaseToken, now);
  const directory = safeRunFile(root, attempt.payload.run_id, "authority", "live-call-reservations");
  mkdirSync(directory, { recursive: true });
  const lockPath = containedPath(directory, ".reservation.lock");
  let lock;
  try {
    lock = openSync(lockPath, "wx", 0o600);
  } catch (error) {
    if (error?.code === "EEXIST") {
      fail("LIVE_DISPATCH_RESERVATION_BUSY", "Live dispatch budget is already being reserved; dispatch remains closed.", 4);
    }
    throw error;
  }
  try {
    const reservations = readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.name !== ".reservation.lock")
      .map((entry) => {
        if (!entry.isFile() || !entry.name.endsWith(".json")) {
          fail("LIVE_DISPATCH_RESERVATION_CORRUPT", "Live dispatch reservation store contains an unexpected entry.", 3);
        }
        const reservation = parseStrictJson(readFileSync(containedPath(directory, entry.name)), "live dispatch reservation");
        assertExactKeys(reservation, ["attempt_id", "grant_sha256", "reserved_at", "role", "run_id"]);
        assertIdentity(reservation.attempt_id, "live dispatch reservation attempt_id");
        assertHash(reservation.grant_sha256, "live dispatch reservation grant_sha256");
        assertIdentity(reservation.run_id, "live dispatch reservation run_id");
        if (!["evaluator", "reader", "verification_helper"].includes(reservation.role)) {
          fail("LIVE_DISPATCH_RESERVATION_CORRUPT", "Live dispatch reservation role is invalid.", 3);
        }
        assertTimestamp(reservation.reserved_at, "live dispatch reservation reserved_at", "LIVE_DISPATCH_RESERVATION_CORRUPT");
        if (reservation.run_id !== attempt.payload.run_id) {
          fail("LIVE_DISPATCH_RESERVATION_CORRUPT", "Live dispatch reservation belongs to another run.", 3);
        }
        return reservation;
      });
    const existing = reservations.find((reservation) => reservation.attempt_id === attempt.payload.attempt_id);
    const next = {
      attempt_id: attempt.payload.attempt_id,
      grant_sha256: grantSha256,
      reserved_at: now,
      role,
      run_id: attempt.payload.run_id,
    };
    if (existing) {
      if (
        existing.grant_sha256 !== grantSha256 ||
        existing.role !== role ||
        existing.run_id !== attempt.payload.run_id
      ) {
        fail("LIVE_DISPATCH_RESERVATION_CONFLICT", "Prepared attempt already has a conflicting live dispatch reservation.", 4);
      }
      return existing;
    }
    const roleCount = reservations.filter((reservation) => reservation.role === role).length;
    if (roleCount >= limits[role] || reservations.length >= limits.total) {
      fail("LIVE_DISPATCH_BUDGET_EXHAUSTED", "Owner-issued live dispatch budget is exhausted for this exact run/role.", 4);
    }
    writeAtomic(containedPath(directory, `${attempt.payload.attempt_id}.json`), canonicalJson(next), {
      exclusive: true,
      namespace: "live-dispatch-reservation",
    });
    return next;
  } finally {
    closeSync(lock);
    rmSync(lockPath);
  }
}

export function issueLiveDispatchAuthority(
  root,
  { grant, issuanceAuthority, authorityVerifier, now = new Date().toISOString() } = {},
) {
  const recordedAt = assertTimestamp(now, "live dispatch authority recorded_at", "LIVE_AUTHORITY_ISSUANCE_INVALID").toISOString();
  const run = loadRunManifest(root, grant?.run_id);
  assertLiveGrantAgainstRun(grant, run, "LIVE_AUTHORITY_ISSUANCE_INVALID");
  const grantSha256 = sha256Canonical(grant);
  assertExactKeys(issuanceAuthority, ["action", "kind", "run_id", "subject_sha256", "task_id"]);
  if (
    issuanceAuthority.action !== "issue_live_dispatch_authority" ||
    issuanceAuthority.kind !== "owner" ||
    issuanceAuthority.run_id !== run.artifact_id ||
    issuanceAuthority.task_id !== run.payload.task_id ||
    issuanceAuthority.subject_sha256 !== grantSha256 ||
    typeof authorityVerifier !== "function" ||
    authorityVerifier(structuredClone(issuanceAuthority)) !== true
  ) {
    fail("LIVE_AUTHORITY_ISSUANCE_INVALID", "Live dispatch authority issuance requires independent exact owner verification.", 4);
  }
  const envelope = {
    grant: structuredClone(grant),
    grant_sha256: grantSha256,
    issuance_authority: structuredClone(issuanceAuthority),
    record_version: "live-dispatch-authority-record-v1",
    recorded_at: recordedAt,
    run_id: run.artifact_id,
    task_id: run.payload.task_id,
  };
  const record = { ...envelope, record_sha256: sha256Canonical(envelope) };
  const directory = safeRunFile(root, run.artifact_id, "authority", "live-dispatch-authorities");
  mkdirSync(directory, { recursive: true });
  writeImmutable(containedPath(directory, `${grant.grant_id}.json`), canonicalJson(record), {
    namespace: "live-dispatch-authority",
  });
  return liveAuthorityReference(record);
}

export function resolveLiveDispatchAuthority(root, reference) {
  assertExactKeys(reference, ["grant_id", "grant_sha256", "record_sha256", "run_id", "task_id"]);
  assertIdentity(reference.grant_id, "live authority reference grant_id");
  assertHash(reference.grant_sha256, "live authority reference grant_sha256");
  assertHash(reference.record_sha256, "live authority reference record_sha256");
  assertIdentity(reference.run_id, "live authority reference run_id");
  assertIdentity(reference.task_id, "live authority reference task_id");
  const path = safeRunFile(root, reference.run_id, "authority", "live-dispatch-authorities", `${reference.grant_id}.json`);
  if (!existsSync(path)) fail("LIVE_AUTHORITY_UNRESOLVED", "Canonical live dispatch authority record does not exist.", 4);
  const record = parseStrictJson(readFileSync(path), "live dispatch authority record");
  assertExactKeys(record, ["grant", "grant_sha256", "issuance_authority", "record_sha256", "record_version", "recorded_at", "run_id", "task_id"]);
  const run = loadRunManifest(root, reference.run_id);
  assertLiveGrantAgainstRun(record.grant, run, "LIVE_AUTHORITY_UNRESOLVED");
  assertTimestamp(record.recorded_at, "live authority recorded_at", "LIVE_AUTHORITY_UNRESOLVED");
  assertExactKeys(record.issuance_authority, ["action", "kind", "run_id", "subject_sha256", "task_id"]);
  const envelope = { ...record };
  delete envelope.record_sha256;
  if (
    record.record_version !== "live-dispatch-authority-record-v1" ||
    record.recorded_at !== new Date(record.recorded_at).toISOString() ||
    record.issuance_authority.action !== "issue_live_dispatch_authority" ||
    record.issuance_authority.kind !== "owner" ||
    record.issuance_authority.run_id !== record.run_id ||
    record.issuance_authority.task_id !== record.task_id ||
    record.issuance_authority.subject_sha256 !== record.grant_sha256 ||
    record.grant_sha256 !== sha256Canonical(record.grant) ||
    record.record_sha256 !== sha256Canonical(envelope) ||
    canonicalJson(liveAuthorityReference(record)) !== canonicalJson(reference)
  ) {
    fail("LIVE_AUTHORITY_UNRESOLVED", "Live dispatch authority reference or record integrity is invalid.", 4);
  }
  return { grant: structuredClone(record.grant), reference: structuredClone(reference) };
}

export function appendRuntimeEvent(root, { event, leaseToken, now, faultAt }) {
  assertHarnessArtifact(event, { artifactType: "runtime_event" });
  assertActiveLease(root, event.payload.run_id, leaseToken, now);
  writeArtifactObject(root, event, { faultAt, leaseToken, now });
  const directory = safeRuntimeAttemptDirectory(root, event.payload.run_id, event.payload.attempt_id);
  if (!existsSync(directory)) fail("RUNTIME_SNAPSHOT_MISSING", "Runtime event requires its published pre-dispatch snapshot.", 3);
  const eventsPath = containedPath(directory, "events.json");
  const prior = parseStrictJson(readFileSync(eventsPath), "runtime event view");
  if (!Array.isArray(prior)) fail("RUNTIME_VIEW_CORRUPT", "Runtime event view must be an array.", 3);
  const binding = {
    artifact_id: event.artifact_id,
    content_sha256: event.content_sha256,
    event_type: event.payload.event_type,
    occurred_at: event.payload.occurred_at,
    status: event.payload.status,
    turn_id: event.payload.turn_id,
  };
  const sameId = prior.find((entry) => entry.artifact_id === binding.artifact_id);
  if (sameId && canonicalJson(sameId) !== canonicalJson(binding)) {
    fail("RUNTIME_VIEW_CORRUPT", "Runtime event view contains a conflicting artifact identity.", 3);
  }
  const next = sameId ? prior : [...prior, binding];
  writeAtomic(eventsPath, canonicalJson(next), { faultAt, namespace: "runtime-events" });
  rebuildRuntimeIndex(root, event.payload.run_id, { faultAt });
  inject({ faultAt }, "runtime-events.after-index-rebuild");
  return event;
}

export function recordRuntimeResultView(
  root,
  { attemptId, evidence = [], leaseToken, now, runId, status, faultAt },
) {
  assertIdentity(attemptId, "attemptId");
  assertIdentity(runId, "runId");
  if (!['success', 'error', 'timeout', 'cancelled', 'outcome_unknown'].includes(status)) {
    fail("RUNTIME_RESULT_INVALID", "Runtime result status is invalid.");
  }
  assertActiveLease(root, runId, leaseToken, now);
  const phases = readAttemptPhases(root, runId, attemptId);
  const terminal = phases.terminal;
  if (!terminal || terminal.payload.outcome !== status) {
    fail("RUNTIME_RESULT_INVALID", "Runtime result must match the exact persisted terminal attempt outcome.");
  }
  const helperResult = terminal.payload.role === "verification_helper";
  if ((helperResult && evidence.length > 0) || (!helperResult && (status === "success") !== (evidence.length > 0))) {
    fail("RUNTIME_RESULT_INVALID", "Semantic success requires evidence, while verification-helper results must remain evidence-free.");
  }
  const bindings = evidence.map((artifact) => {
    const value = assertHarnessArtifact(artifact);
    if (
      !artifactBelongsToRun(value, runId) &&
      !(value.artifact_type === "evaluator_proposal" && hasExactStoredLink(value, "attempt", terminal)) &&
      value.artifact_type !== "resource_observation"
    ) {
      fail("RUNTIME_RESULT_INVALID", "Runtime evidence belongs to another run.");
    }
    const stored = readArtifactObject(root, value.content_sha256);
    if (stored.artifact_id !== value.artifact_id || stored.artifact_type !== value.artifact_type) {
      fail("RUNTIME_RESULT_INVALID", "Runtime evidence is not the exact persisted object.");
    }
    if (["observation", "evaluator_proposal"].includes(value.artifact_type) && !hasExactStoredLink(value, "attempt", terminal)) {
      fail("RUNTIME_RESULT_INVALID", "Runtime semantic evidence is detached from the exact terminal attempt.");
    }
    return { artifact_id: value.artifact_id, artifact_type: value.artifact_type, content_sha256: value.content_sha256 };
  }).sort((left, right) => `${left.artifact_type}:${left.artifact_id}`.localeCompare(`${right.artifact_type}:${right.artifact_id}`));
  if (new Set(bindings.map((binding) => `${binding.artifact_type}:${binding.artifact_id}`)).size !== bindings.length) {
    fail("RUNTIME_RESULT_INVALID", "Runtime result evidence identities must be unique.");
  }
  for (const resource of evidence.filter((artifact) => artifact.artifact_type === "resource_observation")) {
    const observation = evidence.find(
      (artifact) => artifact.artifact_type === "observation" && hasExactStoredLink(resource, "observation", artifact),
    );
    if (!observation) fail("RUNTIME_RESULT_INVALID", "Runtime resource evidence lacks its exact retained observation.");
  }
  const directory = safeRuntimeAttemptDirectory(root, runId, attemptId);
  if (!existsSync(directory)) fail("RUNTIME_SNAPSHOT_MISSING", "Runtime result requires its published snapshot.", 3);
  const resultPath = containedPath(directory, "result.json");
  const resultBytes = canonicalJson({ attempt_id: attemptId, evidence: bindings, status });
  if (existsSync(resultPath) && readFileSync(resultPath, "utf8") !== resultBytes) {
    fail("RUNTIME_RESULT_CONFLICT", "Published runtime result view is immutable for one attempt.", 3);
  }
  if (!existsSync(resultPath)) writeAtomic(resultPath, resultBytes, { faultAt, namespace: "runtime-result" });
  rebuildRuntimeIndex(root, runId, { faultAt });
}

export function recordRuntimeMeasurement(
  root,
  { attemptId, leaseToken, measurement, now, role, runId, faultAt },
) {
  assertIdentity(attemptId, "attemptId");
  assertIdentity(runId, "runId");
  if (!["reader", "evaluator"].includes(role)) fail("RUNTIME_MEASUREMENT_INVALID", "CP9 measurement role is invalid.");
  assertActiveLease(root, runId, leaseToken, now);
  assertExactKeys(measurement, ["dispatch_started_at", "input_bytes", "request_bytes", "semantic_output_bytes", "terminal_at", "token_usage"]);
  for (const key of ["input_bytes", "request_bytes", "semantic_output_bytes"]) {
    if (!Number.isInteger(measurement[key]) || measurement[key] < 0) fail("RUNTIME_MEASUREMENT_INVALID", `CP9 measurement ${key} is invalid.`);
  }
  assertTimestamp(measurement.dispatch_started_at, "measurement dispatch_started_at", "RUNTIME_MEASUREMENT_INVALID");
  assertTimestamp(measurement.terminal_at, "measurement terminal_at", "RUNTIME_MEASUREMENT_INVALID");
  if (measurement.token_usage?.status === "unavailable") {
    assertExactKeys(measurement.token_usage, ["status"]);
  } else if (measurement.token_usage?.status === "observed") {
    assertExactKeys(measurement.token_usage, ["event_count", "event_json", "event_sha256", "status"]);
    if (!Number.isInteger(measurement.token_usage.event_count) || measurement.token_usage.event_count < 1) fail("RUNTIME_MEASUREMENT_INVALID", "Observed usage count is invalid.");
    assertHash(measurement.token_usage.event_sha256, "measurement token usage hash");
    if (sha256Bytes(Buffer.from(measurement.token_usage.event_json, "utf8")) !== measurement.token_usage.event_sha256) fail("RUNTIME_MEASUREMENT_INVALID", "Observed usage bytes do not match their hash.");
    assertRuntimeCredentialFree(parseStrictJson(Buffer.from(measurement.token_usage.event_json, "utf8"), "usage notification"));
  } else fail("RUNTIME_MEASUREMENT_INVALID", "Token usage must be exact observed metadata or unavailable.");
  const value = { attempt_id: attemptId, call_count: 1, measurement_version: "cp9-runtime-measurement-v1", role, ...structuredClone(measurement) };
  assertRuntimeMeasurementValue(value, attemptId);
  const directory = safeRuntimeAttemptDirectory(root, runId, attemptId);
  if (!existsSync(directory)) fail("RUNTIME_SNAPSHOT_MISSING", "Runtime measurement requires its published snapshot.", 3);
  const path = containedPath(directory, "measurement.json");
  const bytes = canonicalJson(value);
  if (existsSync(path) && readFileSync(path, "utf8") !== bytes) fail("RUNTIME_MEASUREMENT_CONFLICT", "Runtime measurement is immutable for one attempt.", 3);
  if (!existsSync(path)) writeAtomic(path, bytes, { faultAt, namespace: "runtime-measurement" });
  rebuildRuntimeIndex(root, runId, { faultAt });
  return value;
}

export function readRuntimeSnapshot(root, runId, attemptId) {
  const directory = safeRuntimeAttemptDirectory(root, runId, attemptId);
  if (!existsSync(directory)) fail("RUNTIME_SNAPSHOT_MISSING", "Runtime snapshot does not exist.", 3);
  const snapshot = parseStrictJson(readFileSync(containedPath(directory, "snapshot.json")), "runtime snapshot");
  const inputText = readFileSync(containedPath(directory, "input.txt"), "utf8");
  const requestJson = readFileSync(containedPath(directory, "request.json"), "utf8");
  const events = parseStrictJson(readFileSync(containedPath(directory, "events.json")), "runtime event view");
  assertExactKeys(snapshot, [
    "attempt_id",
    "input_sha256",
    "input_view_version",
    "request_sha256",
    "request_view_version",
    "runtime_attestation_artifact_id",
    "runtime_attestation_sha256",
    "runtime_dispatch_request_artifact_id",
    "runtime_dispatch_request_sha256",
    "snapshot_version",
  ]);
  if (
    snapshot.attempt_id !== attemptId ||
    snapshot.input_view_version !== "length-delimited-utf8-v1" ||
    snapshot.request_view_version !== "app-server-jsonl-v1" ||
    snapshot.snapshot_version !== "runtime-snapshot-v1" ||
    !Array.isArray(events)
  ) {
    fail("RUNTIME_VIEW_CORRUPT", "Runtime snapshot metadata or event representation is invalid.", 3);
  }
  if (sha256Bytes(Buffer.from(inputText, "utf8")) !== snapshot.input_sha256) {
    fail("RUNTIME_VIEW_CORRUPT", "Runtime input.txt bytes do not match their canonical snapshot owner.", 3);
  }
  if (sha256Bytes(Buffer.from(requestJson, "utf8")) !== snapshot.request_sha256) {
    fail("RUNTIME_VIEW_CORRUPT", "Runtime request.json bytes do not match their canonical snapshot owner.", 3);
  }
  const attestation = readArtifactObject(root, snapshot.runtime_attestation_sha256);
  const dispatchRequest = readArtifactObject(root, snapshot.runtime_dispatch_request_sha256);
  const runtimeRequest = parseStrictJson(Buffer.from(requestJson, "utf8"), "runtime request");
  if (
    attestation.artifact_type !== "runtime_attestation" ||
    attestation.artifact_id !== snapshot.runtime_attestation_artifact_id ||
    dispatchRequest.artifact_type !== "runtime_dispatch_request" ||
    dispatchRequest.artifact_id !== snapshot.runtime_dispatch_request_artifact_id ||
    dispatchRequest.payload.attempt_id !== attemptId ||
    dispatchRequest.payload.runtime_attestation_sha256 !== attestation.content_sha256
  ) {
    fail("RUNTIME_VIEW_CORRUPT", "Runtime snapshot object bindings are stale or mismatched.", 3);
  }
  if (
    dispatchRequest.payload.input_sha256 !== snapshot.input_sha256 ||
    inputText !== renderCodexAppServerInput(runtimeRequest.params?.input)
  ) {
    fail("RUNTIME_VIEW_CORRUPT", "Runtime input.txt is valid text but is bound to another canonical runtime input.", 3);
  }
  if (
    dispatchRequest.payload.wire_request_sha256 !== snapshot.request_sha256 ||
    dispatchRequest.payload.request_json !== requestJson
  ) {
    fail("RUNTIME_VIEW_CORRUPT", "Runtime request.json is valid JSONL but is bound to another canonical dispatch request.", 3);
  }
  const eventIds = new Set();
  const eventPositions = new Map();
  for (const event of events) {
    assertExactKeys(event, ["artifact_id", "content_sha256", "event_type", "occurred_at", "status", "turn_id"]);
    if (eventIds.has(event.artifact_id)) fail("RUNTIME_VIEW_CORRUPT", "Runtime event view contains a duplicate identity.", 3);
    eventIds.add(event.artifact_id);
    if (eventPositions.has(event.event_type)) fail("RUNTIME_VIEW_CORRUPT", "Runtime event view repeats one bounded event type.", 3);
    eventPositions.set(event.event_type, eventPositions.size);
    const stored = readArtifactObject(root, event.content_sha256);
    if (
      stored.artifact_type !== "runtime_event" ||
      stored.artifact_id !== event.artifact_id ||
      stored.payload.attempt_id !== attemptId ||
      stored.payload.event_type !== event.event_type ||
      stored.payload.occurred_at !== event.occurred_at ||
      stored.payload.status !== event.status ||
      stored.payload.turn_id !== event.turn_id ||
      !hasExactStoredLink(stored, "runtime_dispatch_request", dispatchRequest)
    ) {
      fail("RUNTIME_VIEW_CORRUPT", "Runtime event view is detached from its exact immutable artifact.", 3);
    }
  }
  const requireEarlier = (eventType, priorType) => {
    if (eventPositions.has(eventType) && (!eventPositions.has(priorType) || eventPositions.get(priorType) >= eventPositions.get(eventType))) {
      fail("RUNTIME_VIEW_CORRUPT", `Runtime event view orders '${eventType}' before required '${priorType}'.`, 3);
    }
  };
  requireEarlier("turn_start_write_completed", "turn_start_write_intent");
  requireEarlier("turn_start_acknowledged", "turn_start_write_completed");
  requireEarlier("turn_completed", "turn_start_acknowledged");
  requireEarlier("turn_interrupt_requested", "turn_start_acknowledged");
  requireEarlier("turn_interrupt_acknowledged", "turn_interrupt_requested");
  requireEarlier("turn_lookup_result", "turn_start_write_intent");
  requireEarlier("transport_error", "turn_lookup_result");
  const resultPath = containedPath(directory, "result.json");
  const result = existsSync(resultPath) ? parseStrictJson(readFileSync(resultPath), "runtime result view") : null;
  if (result !== null) {
    assertExactKeys(result, ["attempt_id", "evidence", "status"]);
    if (result.attempt_id !== attemptId || !["success", "error", "timeout", "cancelled", "outcome_unknown"].includes(result.status) || !Array.isArray(result.evidence)) {
      fail("RUNTIME_VIEW_CORRUPT", "Runtime result view identity/status is invalid.", 3);
    }
    const terminal = readAttemptPhases(root, runId, attemptId).terminal;
    const helperResult = terminal?.payload.role === "verification_helper";
    if (
      !terminal ||
      terminal.payload.outcome !== result.status ||
      (helperResult && result.evidence.length > 0) ||
      (!helperResult && (result.status === "success") !== (result.evidence.length > 0))
    ) {
      fail("RUNTIME_VIEW_CORRUPT", "Runtime result view contradicts its exact terminal attempt/evidence state.", 3);
    }
    for (const binding of result.evidence) {
      assertExactKeys(binding, ["artifact_id", "artifact_type", "content_sha256"]);
      const stored = readArtifactObject(root, binding.content_sha256);
      if (stored.artifact_id !== binding.artifact_id || stored.artifact_type !== binding.artifact_type) {
        fail("RUNTIME_VIEW_CORRUPT", "Runtime result evidence binding is stale.", 3);
      }
    }
  }
  const measurementPath = containedPath(directory, "measurement.json");
  const measurement = existsSync(measurementPath) ? parseStrictJson(readFileSync(measurementPath), "runtime measurement") : null;
  if (measurement !== null) assertRuntimeMeasurementValue(measurement, attemptId);
  return { events, input_text: inputText, measurement, request_json: requestJson, result, snapshot };
}

export function recoverRun(root, runId, options = {}) {
  assertActiveLease(root, runId, options.leaseToken, options.now);
  let events = readJournal(root, runId);
  const stateEvents = events.filter((event) => event.details.kind === "state");
  if (stateEvents.length === 0) fail("JOURNAL_CORRUPT", "Run journal has no state event.", 3);
  const latest = stateEvents.at(-1);
  const expected = readArtifactObject(root, latest.target_content_sha256);
  let current;
  try {
    current = loadRunManifest(root, runId);
  } catch (error) {
    if (!(error instanceof HarnessError)) throw error;
  }
  if (!current || current.content_sha256 !== expected.content_sha256) {
    writeAtomic(safeEntityFile(root, "runs", runId, "manifest.json"), canonicalHarnessJson(expected), {
      ...options,
      namespace: "manifest",
    });
    current = expected;
  }
  const attemptsRoot = safeRunFile(root, runId, "attempts");
  if (existsSync(attemptsRoot)) {
    for (const entry of sortedDirectories(attemptsRoot)) {
      const phases = readAttemptPhases(root, runId, entry);
      for (const phase of ["prepared", "dispatched", "terminal"]) {
        const artifact = phases[phase];
        if (artifact && !events.some((event) => event.target_content_sha256 === artifact.content_sha256)) {
          appendAttemptJournal(root, current, artifact, options);
          events = readJournal(root, runId);
        }
      }
      const runtimeEvents = events.filter(
        (event) => event.type === "runtime_recorded" && event.details.attempt_id === entry,
      );
      const threadIntent = runtimeEvents.find((event) => event.details.event === "thread_start_write_intent");
      const threadAck = runtimeEvents.find((event) => event.details.event === "thread_start_acknowledged");
      const threadUnknown = runtimeEvents.find((event) => event.details.event === "thread_start_outcome_unknown");
      if (
        current.payload.adapter_id === "codex_chatgpt_app_server" &&
        phases.prepared &&
        !phases.dispatched &&
        !phases.terminal &&
        threadIntent
      ) {
        if (!threadAck && !threadUnknown) {
          recordRuntimeJournalEvent(root, {
            attempt: phases.prepared,
            event: "thread_start_outcome_unknown",
            leaseToken: options.leaseToken,
            now: options.now ?? new Date().toISOString(),
            requestId: threadIntent.details.request_id,
            requestSha256: threadIntent.details.request_sha256,
            status: "unknown",
          });
        }
        const terminal = createHarnessArtifact({
          artifactType: "execution_attempt",
          artifactId: `${phases.prepared.payload.attempt_id}-terminal`,
          producer: phases.prepared.producer,
          links: phases.prepared.links,
          payload: {
            ...phases.prepared.payload,
            call_certainty: "confirmed_not_started",
            finished_at: options.now ?? new Date().toISOString(),
            outcome: "error",
            phase: "terminal",
          },
        });
        appendAttemptPhase(root, terminal, options);
        continue;
      }
      if (phases.dispatched && !phases.terminal) {
        const dispatched = phases.dispatched;
        const hasTurnIntent = runtimeEvents.some((event) => event.details.event === "turn_start_write_intent");
        const concreteAdapter = current.payload.adapter_id === "codex_chatgpt_app_server";
        const runtimeResolution = concreteAdapter
          ? classifyRuntimeRecoveryEvidence(root, runId, dispatched.payload.attempt_id)
          : null;
        const certainty = runtimeResolution?.call_certainty ?? (concreteAdapter && !hasTurnIntent ? "confirmed_not_started" : "unknown");
        const terminal = createHarnessArtifact({
          artifactType: "execution_attempt",
          artifactId: `${dispatched.payload.attempt_id}-terminal`,
          producer: dispatched.producer,
          links: dispatched.links,
          payload: {
            ...dispatched.payload,
            call_certainty: certainty,
            finished_at: options.now ?? new Date().toISOString(),
            outcome: certainty === "unknown" ? "outcome_unknown" : "error",
            phase: "terminal",
          },
        });
        appendAttemptPhase(root, terminal, options);
      }
    }
  }
  return inspectRunState(root, runId);
}

export function inspectRunState(root, runId) {
  const manifest = loadRunManifest(root, runId);
  const journal = readJournal(root, runId);
  const attempts = [];
  const attemptsRoot = safeRunFile(root, runId, "attempts");
  if (existsSync(attemptsRoot)) {
    for (const attemptId of sortedDirectories(attemptsRoot)) {
      attempts.push({ attempt_id: attemptId, phases: readAttemptPhases(root, runId, attemptId) });
    }
  }
  assertStoredAttemptSequences(attempts);
  return { attempts, journal, manifest };
}

function assertStoredAttemptSequences(attempts) {
  const sequencesByUnit = new Map();
  for (const attempt of attempts) {
    const head = attempt.phases.terminal ?? attempt.phases.dispatched ?? attempt.phases.prepared;
    if (!head) continue;
    const key = canonicalJson([head.payload.role, head.payload.unit_id]);
    const sequences = sequencesByUnit.get(key) ?? [];
    sequences.push(head.payload.sequence);
    sequencesByUnit.set(key, sequences);
  }
  for (const sequences of sequencesByUnit.values()) {
    sequences.sort((left, right) => left - right);
    if (sequences.some((sequence, index) => sequence !== index + 1)) {
      fail("ATTEMPT_RECORD_CORRUPT", "Stored attempt sequences are not one contiguous retry history.", 3);
    }
  }
}

export function planResume(root, runId, options = {}) {
  const { attempts, manifest } = inspectRunState(root, runId);
  const invalidated = new Set(options.invalidatedUnitIds ?? []);
  const latestByUnit = new Map();
  for (const attempt of attempts) {
    const head = attempt.phases.terminal ?? attempt.phases.dispatched ?? attempt.phases.prepared;
    if (head?.payload.unit_id) {
      const prior = latestByUnit.get(head.payload.unit_id);
      if (!prior || head.payload.sequence > prior.payload.sequence) latestByUnit.set(head.payload.unit_id, head);
    }
  }
  const result = { blocked_unit_ids: [], incomplete_unit_ids: [], invalidated_unit_ids: [], reusable_unit_ids: [] };
  for (const unit of manifest.payload.selected_units) {
    const head = latestByUnit.get(unit.unit_id);
    if (invalidated.has(unit.unit_id)) result.invalidated_unit_ids.push(unit.unit_id);
    else if (!head) result.incomplete_unit_ids.push(unit.unit_id);
    else if (head.payload.phase === "prepared") result.incomplete_unit_ids.push(unit.unit_id);
    else if (
      head.payload.phase === "dispatched" ||
      head.payload.outcome === "outcome_unknown" ||
      head.payload.call_certainty === "unknown"
    ) {
      result.blocked_unit_ids.push(unit.unit_id);
    } else if (head.payload.outcome !== "success") result.incomplete_unit_ids.push(unit.unit_id);
    else result.reusable_unit_ids.push(unit.unit_id);
  }
  for (const values of Object.values(result)) values.sort();
  return {
    ...result,
    first_incomplete_unit_id:
      [...result.invalidated_unit_ids, ...result.incomplete_unit_ids, ...result.blocked_unit_ids].sort()[0] ?? null,
  };
}

export function acquireRunLease(root, runId, options = {}) {
  assertIdentity(runId, "runId");
  const leaseDirectory = safeRunFile(root, runId, "lease");
  const leasePath = join(leaseDirectory, "lease.json");
  mkdirSync(dirname(leaseDirectory), { recursive: true });
  const now = new Date(options.now ?? Date.now());
  if (!Number.isFinite(now.valueOf())) fail("LEASE_INVALID", "Lease time is invalid.");
  if (existsSync(leaseDirectory)) {
    let existing;
    try {
      existing = readLease(leasePath, runId);
    } catch {
      fail("LEASE_HELD", "Run lease ownership is incomplete or changing; retry after inspection.", 4);
    }
    if (existing.state === "active" && new Date(existing.expires_at) > now) {
      fail("LEASE_HELD", "Run lease is already held.", 4);
    }
    if (existing.state === "active" && isLeaseOwnerActive(existing, options)) {
      fail("LEASE_HELD", "Expired lease owner is still active.", 4);
    }
    const quarantine = containedPath(root, "quarantine", `${runId}-lease-${existing.token}-${randomUUID()}`);
    mkdirSync(dirname(quarantine), { recursive: true });
    try {
      renameSync(leaseDirectory, quarantine);
    } catch {
      fail("LEASE_HELD", "Run lease changed while stale ownership was being reclaimed.", 4);
    }
  }
  const durationMs = options.durationMs ?? 30_000;
  if (!Number.isInteger(durationMs) || durationMs <= 0) fail("LEASE_INVALID", "Lease duration must be a positive integer.");
  const lease = {
    acquired_at: now.toISOString(),
    expires_at: new Date(now.valueOf() + durationMs).toISOString(),
    host: options.host ?? hostname(),
    owner: options.owner ?? "harness",
    pid: options.pid ?? process.pid,
    run_id: runId,
    state: "active",
    token: options.token ?? randomUUID(),
  };
  writeNewLeaseDirectory(root, leaseDirectory, lease, options);
  return lease;
}

export function readLeasePublicationFilesystemFailure(error) {
  const failure = error && typeof error === "object" ? leasePublicationFilesystemFailures.get(error) : null;
  return failure ? structuredClone(failure) : null;
}

export function releaseRunLease(root, runId, token, options = {}) {
  const leasePath = safeRunFile(root, runId, "lease", "lease.json");
  if (!existsSync(leasePath)) fail("LEASE_NOT_FOUND", "Run lease does not exist.");
  const lease = readLease(leasePath, runId);
  if (lease.token !== token || lease.state !== "active") fail("LEASE_TOKEN_MISMATCH", "Run lease token does not match.", 4);
  const released = { ...lease, released_at: options.now ?? new Date().toISOString(), state: "released" };
  writeAtomic(leasePath, canonicalJson(released), { ...options, namespace: "lease" });
  return released;
}

function appendAttemptJournal(root, run, artifact, options) {
  appendJournalEvent(
    root,
    {
      artifact_id: artifact.artifact_id,
      artifact_type: "execution_attempt",
      details: { attempt_id: artifact.payload.attempt_id, kind: "attempt", phase: artifact.payload.phase },
      expected_revision: run.payload.revision,
      next_revision: run.payload.revision,
      occurred_at: options.now ?? new Date().toISOString(),
      run_id: run.artifact_id,
      target_content_sha256: artifact.content_sha256,
      type: "attempt_reconciled",
    },
    options,
  );
}

function appendJournalEvent(root, fields, options = {}) {
  const path = safeRunFile(root, fields.run_id, "journal.ndjson");
  const events = readJournal(root, fields.run_id);
  const envelope = {
    ...fields,
    previous_event_sha256: events.at(-1)?.event_sha256 ?? null,
    sequence: events.length + 1,
  };
  const event = { ...envelope, event_sha256: sha256Canonical(envelope) };
  assertJournalEvent(event, event.sequence, envelope.previous_event_sha256, fields.run_id);
  const prior = existsSync(path) ? readFileSync(path, "utf8") : "";
  writeAtomic(path, `${prior}${JSON.stringify(event)}\n`, { ...options, namespace: "journal" });
  return event;
}

function assertJournalEvent(event, sequence, previous, runId) {
  assertExactKeys(event, [
    "artifact_id",
    "artifact_type",
    "details",
    "event_sha256",
    "expected_revision",
    "next_revision",
    "occurred_at",
    "previous_event_sha256",
    "run_id",
    "sequence",
    "target_content_sha256",
    "type",
  ]);
  if (event.sequence !== sequence || event.run_id !== runId || event.previous_event_sha256 !== previous) {
    fail("JOURNAL_CORRUPT", "Journal sequence or hash-chain continuity is invalid.", 3);
  }
  assertIdentity(event.run_id, "journal run_id");
  assertIdentity(event.artifact_id, "journal artifact_id");
  assertIdentity(event.type, "journal type");
  if (!Number.isInteger(event.expected_revision) && event.expected_revision !== null) {
    fail("JOURNAL_CORRUPT", "Journal expected_revision is invalid.", 3);
  }
  if (!Number.isInteger(event.next_revision) || event.next_revision < 0) {
    fail("JOURNAL_CORRUPT", "Journal next_revision is invalid.", 3);
  }
  assertTimestamp(event.occurred_at, "journal occurred_at", "JOURNAL_CORRUPT");
  if (!event.details || typeof event.details !== "object" || Array.isArray(event.details)) {
    fail("JOURNAL_CORRUPT", "Journal details are invalid.", 3);
  }
  assertHash(event.event_sha256, "event_sha256");
  assertHash(event.target_content_sha256, "target_content_sha256");
  const envelope = { ...event };
  delete envelope.event_sha256;
  if (sha256Canonical(envelope) !== event.event_sha256) fail("JOURNAL_CORRUPT", "Journal event hash is invalid.", 3);
}

function assertJournalContinuity(event, target, currentRevision, index) {
  if (index === 0) {
    if (
      event.type !== "run_created" ||
      event.details.kind !== "state" ||
      event.expected_revision !== null ||
      event.next_revision !== 0 ||
      target.artifact_type !== "run_manifest" ||
      target.payload.revision !== 0 ||
      target.payload.state !== "created"
    ) {
      fail("JOURNAL_CORRUPT", "Journal must begin with the exact revision-zero created run.", 3);
    }
    return 0;
  }
  if (event.type === "run_transitioned") {
    if (
      event.details.kind !== "state" ||
      event.expected_revision !== currentRevision ||
      event.next_revision !== currentRevision + 1 ||
      target.artifact_type !== "run_manifest" ||
      target.payload.revision !== event.next_revision ||
      target.payload.state !== event.details.state
    ) {
      fail("JOURNAL_CORRUPT", "Run transition journal revisions or target state are discontinuous.", 3);
    }
    return event.next_revision;
  }
  if (["attempt_recorded", "attempt_reconciled"].includes(event.type)) {
    if (
      event.details.kind !== "attempt" ||
      event.expected_revision !== currentRevision ||
      event.next_revision !== currentRevision ||
      target.artifact_type !== "execution_attempt" ||
      target.payload.attempt_id !== event.details.attempt_id ||
      target.payload.phase !== event.details.phase
    ) {
      fail("JOURNAL_CORRUPT", "Attempt journal event is not bound to the current run revision and exact phase.", 3);
    }
    return currentRevision;
  }
  if (event.type === "attempt_control_requested") {
    if (
      event.details.kind !== "control" ||
      !["cancel_requested", "timeout_requested"].includes(event.details.control) ||
      (event.details.control === "timeout_requested" && !["dispatch", "connect", "response"].includes(event.details.timeout_phase)) ||
      (event.details.control === "cancel_requested" && event.details.timeout_phase !== null) ||
      event.expected_revision !== currentRevision ||
      event.next_revision !== currentRevision ||
      target.artifact_type !== "execution_attempt" ||
      target.payload.phase !== "dispatched" ||
      target.payload.attempt_id !== event.details.attempt_id
    ) {
      fail("JOURNAL_CORRUPT", "Attempt control event is not bound to the exact dispatched call.", 3);
    }
    return currentRevision;
  }
  if (event.type === "attempt_retry_classified") {
    if (
      event.details.kind !== "retry_classification" ||
      typeof event.details.retry_class !== "string" ||
      !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(event.details.retry_class) ||
      typeof event.details.retryable !== "boolean" ||
      typeof event.details.retry_policy_sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(event.details.retry_policy_sha256) ||
      event.expected_revision !== currentRevision ||
      event.next_revision !== currentRevision ||
      target.artifact_type !== "execution_attempt" ||
      target.payload.phase !== "terminal" ||
      target.payload.outcome !== "error" ||
      target.payload.attempt_id !== event.details.attempt_id
    ) {
      fail("JOURNAL_CORRUPT", "Attempt retry classification is not bound to the exact terminal error.", 3);
    }
    return currentRevision;
  }
  if (event.type === "runtime_recorded") {
    const details = event.details;
    const detailKeys = [
      "attempt_id",
      "event",
      "kind",
      "request_id",
      "request_json",
      "request_sha256",
      "session_id",
      "status",
      "thread_id",
      "turn_id",
    ];
    if (["thread_start_failure_diagnostic", "predispatch_failure_diagnostic", "postdispatch_failure_diagnostic"].includes(details.event)) detailKeys.push("diagnostic");
    assertExactKeys(details, detailKeys);
    const allowedEvents = [
      "thread_start_write_intent",
      "thread_start_write_completed",
      "thread_start_response_observed",
      "thread_start_failure_diagnostic",
      "thread_start_acknowledged",
      "thread_start_outcome_unknown",
      "predispatch_failure_diagnostic",
      "postdispatch_failure_diagnostic",
      "turn_start_write_intent",
    ];
    if (
      details.kind !== "runtime" ||
      !allowedEvents.includes(details.event) ||
      typeof details.request_id !== "string" ||
      !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(details.request_id) ||
      typeof details.request_sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(details.request_sha256) ||
      (details.event === "thread_start_write_intent"
        ? typeof details.request_json !== "string" ||
          canonicalJsonLine(parseStrictJson(Buffer.from(details.request_json, "utf8"), "thread start request")) !== details.request_json ||
          sha256Bytes(Buffer.from(details.request_json, "utf8")) !== details.request_sha256
        : details.request_json !== null) ||
      (details.session_id !== null && (typeof details.session_id !== "string" || !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(details.session_id))) ||
      (details.event === "thread_start_acknowledged" ? false : details.session_id !== null) ||
      !["intent", "written", "observed", "error", "acknowledged", "unknown"].includes(details.status) ||
      (details.event === "thread_start_write_completed" && details.status !== "written") ||
      (details.event === "thread_start_response_observed" && details.status !== "observed") ||
      (details.event === "thread_start_failure_diagnostic" && details.status !== "error") ||
      (details.event === "predispatch_failure_diagnostic" && details.status !== "error") ||
      (details.event === "postdispatch_failure_diagnostic" && details.status !== "error") ||
      (details.thread_id !== null && (typeof details.thread_id !== "string" || !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(details.thread_id))) ||
      (details.turn_id !== null && (typeof details.turn_id !== "string" || !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(details.turn_id))) ||
      event.expected_revision !== currentRevision ||
      event.next_revision !== currentRevision ||
      target.artifact_type !== "execution_attempt" ||
      target.payload.attempt_id !== details.attempt_id ||
      (details.event === "predispatch_failure_diagnostic" && target.payload.phase !== "prepared") ||
      (details.event === "postdispatch_failure_diagnostic" && target.payload.phase !== "dispatched") ||
      (details.event.startsWith("thread_start") && target.payload.phase !== "prepared") ||
      (details.event === "turn_start_write_intent" && target.payload.phase !== "dispatched")
    ) {
      fail("JOURNAL_CORRUPT", "Runtime journal event is not bound to its exact attempt and request state.", 3);
    }
    if (details.event === "thread_start_failure_diagnostic") assertStoredThreadStartDiagnostic(details.diagnostic, "JOURNAL_CORRUPT");
    if (details.event === "predispatch_failure_diagnostic") assertPredispatchFailureDiagnostic(details.diagnostic, "JOURNAL_CORRUPT");
    if (details.event === "postdispatch_failure_diagnostic") assertPostdispatchFailureDiagnostic(details.diagnostic, "JOURNAL_CORRUPT");
    return currentRevision;
  }
  if (event.type === "reader_evidence_failure_recorded") {
    assertExactKeys(event.details, ["attempt_id", "diagnostic", "kind"]);
    if (
      event.details.kind !== "reader_evidence_failure" ||
      event.expected_revision !== currentRevision ||
      event.next_revision !== currentRevision ||
      target.artifact_type !== "execution_attempt" ||
      target.payload.phase !== "terminal" ||
      target.payload.role !== "reader" ||
      target.payload.call_certainty !== "confirmed_finished" ||
      target.payload.outcome !== "error" ||
      target.payload.attempt_id !== event.details.attempt_id
    ) {
      fail("JOURNAL_CORRUPT", "Reader evidence failure diagnostic is not bound to its exact terminal error attempt.", 3);
    }
    assertReaderEvidenceFailureDiagnostic(event.details.diagnostic, "JOURNAL_CORRUPT");
    return currentRevision;
  }
  fail("JOURNAL_CORRUPT", "Journal contains an unsupported event type.", 3);
}

function assertAttemptTransition(prior, next) {
  const phase = next.payload.phase;
  if (prior[phase]) {
    if (prior[phase].content_sha256 === next.content_sha256) return;
    fail("ATTEMPT_IMMUTABLE", `Attempt phase '${phase}' already exists with different content.`, 3);
  }
  if (phase === "prepared" && (prior.dispatched || prior.terminal)) fail("ATTEMPT_TRANSITION_INVALID", "Prepared must be the first attempt phase.");
  if (phase === "dispatched" && (!prior.prepared || prior.terminal)) fail("ATTEMPT_TRANSITION_INVALID", "Dispatched requires prepared and no terminal phase.");
  if (
    phase === "terminal" &&
    !prior.dispatched &&
    (!prior.prepared || next.payload.call_certainty !== "confirmed_not_started")
  ) {
    fail("ATTEMPT_TRANSITION_INVALID", "Terminal requires dispatch or an exact confirmed-not-started prepared attempt.");
  }
  const baseline = prior.prepared ?? prior.dispatched;
  if (baseline) {
    for (const field of ["attempt_id", "input_sha256", "role", "run_id", "sequence", "started_at", "unit_id"]) {
      if (baseline.payload[field] !== next.payload[field]) fail("ATTEMPT_TRANSITION_INVALID", `Attempt field '${field}' changed across phases.`);
    }
    if (canonicalJson(baseline.links) !== canonicalJson(next.links)) fail("ATTEMPT_TRANSITION_INVALID", "Attempt links changed across phases.");
  }
}

function validateRuntimeDiagnosticSequences(events) {
  const readerEvidenceDiagnostics = new Set();
  for (const [diagnosticIndex, diagnosticEvent] of events.entries()) {
    if (diagnosticEvent.type !== "reader_evidence_failure_recorded") continue;
    const attemptId = diagnosticEvent.details.attempt_id;
    const terminalIndex = events.findIndex(
      (event) => event.type === "attempt_recorded" &&
        event.details.attempt_id === attemptId && event.details.phase === "terminal",
    );
    if (terminalIndex < 0 || terminalIndex >= diagnosticIndex || readerEvidenceDiagnostics.has(attemptId)) {
      fail("JOURNAL_CORRUPT", "Reader evidence failure diagnostic is not uniquely bound after its exact terminal attempt.", 3);
    }
    readerEvidenceDiagnostics.add(attemptId);
  }
  const byAttempt = new Map();
  for (const event of events) {
    if (event.type !== "runtime_recorded" || !event.details.event.startsWith("thread_start")) continue;
    const values = byAttempt.get(event.details.attempt_id) ?? [];
    values.push(event.details);
    byAttempt.set(event.details.attempt_id, values);
  }
  for (const values of byAttempt.values()) {
    const position = (name) => values.findIndex((details) => details.event === name);
    const intent = position("thread_start_write_intent");
    const written = position("thread_start_write_completed");
    const observed = position("thread_start_response_observed");
    const diagnostic = position("thread_start_failure_diagnostic");
    const acknowledged = position("thread_start_acknowledged");
    const unknown = position("thread_start_outcome_unknown");
    for (const current of [written, observed, diagnostic]) {
      if (current >= 0 && (intent < 0 || current <= intent)) {
        fail("JOURNAL_CORRUPT", "Thread-start diagnostic evidence precedes its exact write intent.", 3);
      }
    }
    if (diagnostic >= 0) {
      const responseObserved = values[diagnostic].diagnostic.response_bytes_observed;
      if (responseObserved !== (observed >= 0 && observed < diagnostic)) {
        fail("JOURNAL_CORRUPT", "Thread-start response marker and failure diagnostic disagree.", 3);
      }
      if (unknown >= 0 && unknown <= diagnostic) {
        fail("JOURNAL_CORRUPT", "Thread-start outcome-unknown precedes its failure diagnostic.", 3);
      }
    }
    if (acknowledged >= 0 && (written >= 0 || observed >= 0)) {
      if (written < 0 || observed < 0 || acknowledged <= written || acknowledged <= observed || diagnostic >= 0 || unknown >= 0) {
        fail("JOURNAL_CORRUPT", "Thread-start acknowledgement lacks its complete diagnostic marker sequence.", 3);
      }
    }
  }
  for (const [diagnosticIndex, diagnosticEvent] of events.entries()) {
    if (diagnosticEvent.type !== "runtime_recorded" || diagnosticEvent.details.event !== "predispatch_failure_diagnostic") continue;
    const diagnostic = diagnosticEvent.details;
    const acknowledgedIndex = events.findIndex(
      (event) => event.type === "runtime_recorded" &&
        event.details.attempt_id === diagnostic.attempt_id && event.details.event === "thread_start_acknowledged",
    );
    const acknowledged = events[acknowledgedIndex]?.details;
    const turnIntentIndex = events.findIndex(
      (event) => event.type === "runtime_recorded" &&
        event.details.attempt_id === diagnostic.attempt_id && event.details.event === "turn_start_write_intent",
    );
    const terminalIndex = events.findIndex(
      (event) => event.type === "attempt_recorded" &&
        event.details.attempt_id === diagnostic.attempt_id && event.details.phase === "terminal",
    );
    if (
      acknowledgedIndex < 0 ||
      acknowledgedIndex >= diagnosticIndex ||
      acknowledged.request_id !== diagnostic.request_id ||
      acknowledged.request_sha256 !== diagnostic.request_sha256 ||
      acknowledged.thread_id !== diagnostic.thread_id ||
      turnIntentIndex >= 0 ||
      (terminalIndex >= 0 && terminalIndex <= diagnosticIndex)
    ) {
      fail("JOURNAL_CORRUPT", "Predispatch failure diagnostic is not bound after the exact thread acknowledgement and before turn intent.", 3);
    }
  }
  for (const [diagnosticIndex, diagnosticEvent] of events.entries()) {
    if (diagnosticEvent.type !== "runtime_recorded" || diagnosticEvent.details.event !== "postdispatch_failure_diagnostic") continue;
    const diagnostic = diagnosticEvent.details;
    const turnIntentIndex = events.findIndex(
      (event) => event.type === "runtime_recorded" &&
        event.details.attempt_id === diagnostic.attempt_id && event.details.event === "turn_start_write_intent",
    );
    const turnIntent = events[turnIntentIndex]?.details;
    const terminalIndex = events.findIndex(
      (event) => event.type === "attempt_recorded" &&
        event.details.attempt_id === diagnostic.attempt_id && event.details.phase === "terminal",
    );
    if (
      turnIntentIndex < 0 ||
      turnIntentIndex >= diagnosticIndex ||
      turnIntent.request_id !== diagnostic.request_id ||
      turnIntent.request_sha256 !== diagnostic.request_sha256 ||
      turnIntent.thread_id !== diagnostic.thread_id ||
      (terminalIndex >= 0 && terminalIndex <= diagnosticIndex)
    ) {
      fail("JOURNAL_CORRUPT", "Post-dispatch failure diagnostic is not bound after the exact turn intent and before terminalization.", 3);
    }
  }
}

function assertPredispatchFailureDiagnostic(value, code) {
  const steps = [
    "authority_revalidation",
    "dispatch_request_construction",
    "instruction_source_validation",
    "live_call_reservation",
    "runtime_reinspection",
    "runtime_snapshot_publication",
    "snapshot_recheck",
  ];
  const hasFilesystemFailure = value !== null && typeof value === "object" && Object.hasOwn(value, "filesystem_failure");
  try {
    assertExactKeys(value, ["error_code", "predispatch_step", "retry_class", ...(hasFilesystemFailure ? ["filesystem_failure"] : [])]);
  } catch {
    fail(code, "Predispatch failure diagnostic fields are invalid.", 3);
  }
  if (
    !steps.includes(value.predispatch_step) ||
    typeof value.error_code !== "string" ||
    !/^[A-Z0-9_]+$/.test(value.error_code) ||
    typeof value.retry_class !== "string" ||
    !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value.retry_class)
  ) {
    fail(code, "Predispatch failure diagnostic projection is invalid.", 3);
  }
  if (hasFilesystemFailure) {
    if (value.predispatch_step !== "runtime_snapshot_publication") {
      fail(code, "Filesystem failure diagnostics are only valid for runtime snapshot publication.", 3);
    }
    assertRuntimeSnapshotFilesystemFailure(value.filesystem_failure, code);
  }
}

function assertReaderEvidenceFailureDiagnostic(value, code) {
  try {
    assertExactKeys(value, ["boundary", "error_class", "error_code", "message"]);
  } catch {
    fail(code, "Reader evidence failure diagnostic fields are invalid.", 3);
  }
  if (
    !["reader_adapter_result_validation", "reader_evidence_materialization"].includes(value.boundary) ||
    typeof value.error_class !== "string" ||
    !/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(value.error_class) ||
    typeof value.error_code !== "string" ||
    !/^[A-Z0-9_]+$/.test(value.error_code) ||
    typeof value.message !== "string" ||
    value.message.length === 0 ||
    value.message.length > 256 ||
    /[\r\n]/.test(value.message)
  ) {
    fail(code, "Reader evidence failure diagnostic projection is invalid.", 3);
  }
  try {
    assertRuntimeCredentialFree(value);
  } catch {
    fail(code, "Reader evidence failure diagnostic contains credential material.", 3);
  }
}

function assertRuntimeSnapshotFilesystemFailure(value, code) {
  try {
    assertExactKeys(value, ["code", "dest", "errno", "message", "path", "publication_substep", "syscall"]);
  } catch {
    fail(code, "Runtime snapshot filesystem diagnostic fields are invalid.", 3);
  }
  if (
    typeof value.code !== "string" || !/^E[A-Z0-9]{1,31}$/.test(value.code) ||
    !runtimeSnapshotPublicationSubsteps.includes(value.publication_substep) ||
    !(value.errno === null || Number.isSafeInteger(value.errno)) ||
    !(value.syscall === null || (typeof value.syscall === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(value.syscall))) ||
    !(value.message === null || (typeof value.message === "string" && value.message.length <= 512 && !/[\r\n]/.test(value.message))) ||
    !isNormalizedStoreRelativeDiagnosticPath(value.path) ||
    !isNormalizedStoreRelativeDiagnosticPath(value.dest)
  ) {
    fail(code, "Runtime snapshot filesystem diagnostic projection is invalid.", 3);
  }
  try {
    assertRuntimeCredentialFree(value);
  } catch {
    fail(code, "Runtime snapshot filesystem diagnostic contains credential material.", 3);
  }
}

function isNormalizedStoreRelativeDiagnosticPath(value) {
  return value === null || (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    !value.includes("\\") &&
    !isAbsolute(value) &&
    !value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  );
}

function assertPostdispatchFailureDiagnostic(value, code) {
  const stages = [
    "semantic_output_validation",
    "terminal_result_validation",
    "terminal_status_validation",
    "turn_completion_wait",
    "turn_event_validation",
    "turn_start_acknowledgement",
  ];
  const keys = [
    "error_code",
    "failure_stage",
    "process_exit_code",
    "process_exit_signal",
    "retry_class",
    "stderr_byte_count",
    "stderr_sha256",
  ];
  const hasTurnFailureReason = value !== null && typeof value === "object" && Object.hasOwn(value, "turn_failure_reason");
  const hasTurnFailureMessage = value !== null && typeof value === "object" && Object.hasOwn(value, "turn_failure_message");
  try {
    assertExactKeys(value, [
      ...keys,
      ...(hasTurnFailureMessage ? ["turn_failure_message"] : []),
      ...(hasTurnFailureReason ? ["turn_failure_reason"] : []),
    ]);
  } catch {
    fail(code, "Post-dispatch failure diagnostic fields are invalid.", 3);
  }
  const processExit = value.error_code === "APP_SERVER_PROCESS_EXITED";
  const exitCodeValid = value.process_exit_code === null || Number.isInteger(value.process_exit_code);
  const exitSignalValid = value.process_exit_signal === null ||
    (typeof value.process_exit_signal === "string" && /^[A-Z0-9]+$/.test(value.process_exit_signal));
  const hasExitIdentity = Number.isInteger(value.process_exit_code) ||
    (typeof value.process_exit_signal === "string" && /^[A-Z0-9]+$/.test(value.process_exit_signal));
  const hasStderrIdentity = Number.isInteger(value.stderr_byte_count) && value.stderr_byte_count >= 0 &&
    typeof value.stderr_sha256 === "string" && /^[a-f0-9]{64}$/.test(value.stderr_sha256);
  if (
    typeof value.error_code !== "string" ||
    !/^[A-Z0-9_]+$/.test(value.error_code) ||
    !stages.includes(value.failure_stage) ||
    typeof value.retry_class !== "string" ||
    !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(value.retry_class) ||
    !exitCodeValid ||
    !exitSignalValid ||
    (hasTurnFailureReason && (
      value.error_code !== "APP_SERVER_TURN_FAILED" ||
      !isCodexFailedTurnReason(value.turn_failure_reason)
    )) ||
    (hasTurnFailureMessage && (
      value.error_code !== "APP_SERVER_TURN_FAILED" ||
      !isCodexFailedTurnMessage(value.turn_failure_message)
    )) ||
    (processExit && (!hasExitIdentity || !hasStderrIdentity)) ||
    (!processExit && (
      value.process_exit_code !== null ||
      value.process_exit_signal !== null ||
      value.stderr_byte_count !== null ||
      value.stderr_sha256 !== null
    ))
  ) {
    fail(code, "Post-dispatch failure diagnostic projection is invalid.", 3);
  }
}

function assertStoredThreadStartDiagnostic(value, code) {
  if (value !== null && typeof value === "object" && Object.hasOwn(value, "response_channel_bytes_observed")) {
    assertCurrentThreadStartDiagnostic(value, code);
    return;
  }
  assertLegacyThreadStartDiagnostic(value, code);
}

function assertLegacyThreadStartDiagnostic(value, code) {
  try {
    assertExactKeys(value, [
      "error_category",
      "error_class",
      "error_code",
      "process_exit_code",
      "process_exit_signal",
      "process_exit_timing",
      "response_bytes_observed",
      "response_classification",
      "rpc_error_code",
      "stderr_byte_count",
      "stderr_sha256",
    ]);
  } catch {
    fail(code, "Legacy thread-start failure diagnostic fields are invalid.", 3);
  }
  const categories = ["invalid_acknowledgement", "other_transport_error", "process_exit", "protocol_failure", "rpc_error", "write_failure"];
  const responseClassifications = [
    "framing_invalid",
    "invalid_thread_acknowledgement",
    "json_invalid",
    "no_response_observed",
    "protocol_invalid",
    "response_bytes_observed",
    "rpc_error",
    "rpc_success",
  ];
  const rpcCodeValid = value.rpc_error_code === null || Number.isSafeInteger(value.rpc_error_code) ||
    (typeof value.rpc_error_code === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(value.rpc_error_code));
  const processCodeValid = value.process_exit_code === null || Number.isInteger(value.process_exit_code);
  const processSignalValid = value.process_exit_signal === null ||
    (typeof value.process_exit_signal === "string" && /^[A-Z0-9]+$/.test(value.process_exit_signal));
  if (
    !categories.includes(value.error_category) ||
    !["Error", "HarnessError"].includes(value.error_class) ||
    typeof value.error_code !== "string" || !/^[A-Z0-9_]+$/.test(value.error_code) ||
    !processCodeValid || !processSignalValid ||
    ![null, "during_thread_start"].includes(value.process_exit_timing) ||
    typeof value.response_bytes_observed !== "boolean" ||
    !responseClassifications.includes(value.response_classification) ||
    !rpcCodeValid ||
    !Number.isInteger(value.stderr_byte_count) || value.stderr_byte_count < 0 ||
    typeof value.stderr_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.stderr_sha256) ||
    (value.response_bytes_observed === (value.response_classification === "no_response_observed")) ||
    (value.error_category === "process_exit"
      ? value.process_exit_timing !== "during_thread_start" || (value.process_exit_code === null && value.process_exit_signal === null)
      : value.process_exit_code !== null || value.process_exit_signal !== null || value.process_exit_timing !== null) ||
    (value.error_category === "rpc_error" && value.response_classification !== "rpc_error") ||
    (value.error_category === "invalid_acknowledgement" && value.response_classification !== "invalid_thread_acknowledgement")
  ) {
    fail(code, "Legacy thread-start failure diagnostic projection is invalid.", 3);
  }
}

function assertCurrentThreadStartDiagnostic(value, code) {
  try {
    assertExactKeys(value, [
      "error_category",
      "error_class",
      "error_code",
      "process_exit_code",
      "process_exit_signal",
      "process_exit_timing",
      "response_channel_bytes_observed",
      "response_bytes_observed",
      "response_classification",
      "rpc_error_code",
      "stderr_byte_count",
      "stderr_sha256",
    ]);
  } catch {
    fail(code, "Thread-start failure diagnostic fields are invalid.", 3);
  }
  const categories = ["invalid_acknowledgement", "other_transport_error", "process_exit", "protocol_failure", "rpc_error", "write_failure"];
  const responseClassifications = [
    "framing_invalid",
    "invalid_thread_acknowledgement",
    "json_invalid",
    "no_response_observed",
    "protocol_invalid",
    "response_channel_bytes_observed",
    "response_bytes_observed",
    "rpc_error",
    "rpc_success",
    "unrelated_notification_observed",
  ];
  const rpcCodeValid = value.rpc_error_code === null || Number.isSafeInteger(value.rpc_error_code) ||
    (typeof value.rpc_error_code === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(value.rpc_error_code));
  const processCodeValid = value.process_exit_code === null || Number.isInteger(value.process_exit_code);
  const processSignalValid = value.process_exit_signal === null ||
    (typeof value.process_exit_signal === "string" && /^[A-Z0-9]+$/.test(value.process_exit_signal));
  const stderrValid = (value.stderr_byte_count === null && value.stderr_sha256 === null) ||
    (Number.isInteger(value.stderr_byte_count) && value.stderr_byte_count >= 0 &&
      typeof value.stderr_sha256 === "string" && /^[a-f0-9]{64}$/.test(value.stderr_sha256));
  if (
    !categories.includes(value.error_category) ||
    !["Error", "HarnessError"].includes(value.error_class) ||
    typeof value.error_code !== "string" || !/^[A-Z0-9_]+$/.test(value.error_code) ||
    !processCodeValid || !processSignalValid ||
    ![null, "during_thread_start"].includes(value.process_exit_timing) ||
    typeof value.response_channel_bytes_observed !== "boolean" ||
    typeof value.response_bytes_observed !== "boolean" ||
    !responseClassifications.includes(value.response_classification) ||
    !rpcCodeValid ||
    !stderrValid ||
    (value.response_channel_bytes_observed === (value.response_classification === "no_response_observed")) ||
    (value.response_bytes_observed && !value.response_channel_bytes_observed) ||
    (["framing_invalid", "json_invalid", "response_channel_bytes_observed", "unrelated_notification_observed"].includes(value.response_classification) &&
      value.response_bytes_observed) ||
    (["response_bytes_observed", "rpc_error", "rpc_success", "invalid_thread_acknowledgement"].includes(value.response_classification) &&
      !value.response_bytes_observed) ||
    (value.error_category === "process_exit"
      ? value.process_exit_timing !== "during_thread_start" || (value.process_exit_code === null && value.process_exit_signal === null)
      : value.process_exit_code !== null || value.process_exit_signal !== null || value.process_exit_timing !== null) ||
    (value.error_category === "rpc_error" && value.response_classification !== "rpc_error") ||
    (value.error_category === "invalid_acknowledgement" && value.response_classification !== "invalid_thread_acknowledgement")
  ) {
    fail(code, "Thread-start failure diagnostic projection is invalid.", 3);
  }
}

function validateAttemptChain(phases) {
  if (phases.dispatched && !phases.prepared) fail("ATTEMPT_RECORD_CORRUPT", "Dispatched attempt lacks prepared phase.", 3);
  if (
    phases.terminal &&
    !phases.dispatched &&
    (!phases.prepared || phases.terminal.payload.call_certainty !== "confirmed_not_started")
  ) {
    fail("ATTEMPT_RECORD_CORRUPT", "Terminal attempt lacks dispatch or confirmed-not-started evidence.", 3);
  }
  for (const phase of ["dispatched", "terminal"]) {
    if (phases[phase]) {
      assertAttemptTransition(
        { prepared: phases.prepared, dispatched: phase === "terminal" ? phases.dispatched : undefined },
        phases[phase],
      );
    }
  }
}

function assertRuntimeSnapshotDirectory(directory, expectedFiles) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const allowed = new Set([...expectedFiles.keys(), "measurement.json", "result.json"]);
  if (entries.some((entry) => !entry.isFile() || !allowed.has(entry.name))) {
    fail("RUNTIME_VIEW_CORRUPT", "Runtime snapshot directory contains an unexpected entry.", 3);
  }
  for (const [name, bytes] of expectedFiles) {
    const path = containedPath(directory, name);
    if (!existsSync(path) || readFileSync(path, "utf8") !== bytes) {
      fail("RUNTIME_SNAPSHOT_CONFLICT", "Published runtime snapshot differs from the exact requested representation.", 3);
    }
  }
}

export function validateRuntimeIndex(root, runId) {
  const runtimeRoot = safeRunFile(root, runId, "runtime");
  const expected = buildRuntimeIndexViews(root, runId);
  for (const [name, bytes] of [["index.json", expected.json], ["index.md", expected.markdown]]) {
    const path = containedPath(runtimeRoot, name);
    if (!existsSync(path) || readFileSync(path, "utf8") !== bytes) {
      fail("RUNTIME_INDEX_CORRUPT", `Runtime finder '${name}' is missing, stale, or mismatched.`, 3);
    }
  }
  return expected;
}

export function rebuildRuntimeIndex(root, runId, options = {}) {
  const runtimeRoot = safeRunFile(root, runId, "runtime");
  const views = buildRuntimeIndexViews(root, runId);
  writeAtomic(containedPath(runtimeRoot, "index.json"), views.json, { ...options, namespace: "runtime-index" });
  writeAtomic(containedPath(runtimeRoot, "index.md"), views.markdown, { ...options, namespace: "runtime-index" });
}

function buildRuntimeIndexViews(root, runId) {
  const run = loadRunManifest(root, runId);
  const runtimeRoot = safeRunFile(root, runId, "runtime");
  const attemptsRoot = containedPath(runtimeRoot, "attempts");
  mkdirSync(attemptsRoot, { recursive: true });
  const attempts = [];
  for (const entry of readdirSync(attemptsRoot, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name.endsWith(".tmp")) continue;
    if (!entry.isDirectory()) fail("RUNTIME_VIEW_CORRUPT", "Runtime attempts root contains a non-directory entry.", 3);
    const view = readRuntimeSnapshot(root, runId, entry.name);
    attempts.push({
      attempt_id: entry.name,
      call_certainty: deriveRuntimeCallCertainty(root, view.events),
      evidence: view.result?.evidence ?? [],
      input_path: `attempts/${entry.name}/input.txt`,
      request_path: `attempts/${entry.name}/request.json`,
      result_status: view.result?.status ?? null,
      runtime_attestation_artifact_id: view.snapshot.runtime_attestation_artifact_id,
      runtime_attestation_sha256: view.snapshot.runtime_attestation_sha256,
      runtime_dispatch_request_artifact_id: view.snapshot.runtime_dispatch_request_artifact_id,
      runtime_dispatch_request_sha256: view.snapshot.runtime_dispatch_request_sha256,
      thread_id: runtimeThreadId(root, view.snapshot.runtime_attestation_sha256),
      turn_id: view.events.map((event) => event.turn_id).filter(Boolean).at(-1) ?? null,
    });
  }
  attempts.sort((left, right) => left.attempt_id.localeCompare(right.attempt_id));
  const intent = run.payload.intent ?? null;
  const index = {
    attempts,
    intent,
    run_id: runId,
    task_id: run.payload.task_id,
    view_version: "runtime-index-v1",
  };
  const why = intent ? `${intent.purpose} — ${intent.selection_reason}` : "Historical run without CP8A intent";
  const lines = [
    "# Runtime evidence index",
    "",
    `- Run: \`${escapeMarkdown(runId)}\``,
    `- Why: ${escapeMarkdown(why)}`,
    "",
    "| Attempt | Intended input | Exact App Server request | Runtime | Thread/turn | Certainty/outcome | Evidence |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...attempts.map((entry) => {
      const runtime = `${entry.runtime_attestation_artifact_id}@${entry.runtime_attestation_sha256}`;
      const correlation = `${entry.thread_id}/${entry.turn_id ?? "pending"}`;
      const result = entry.result_status ?? "pending";
      const evidence = entry.evidence.length === 0
        ? "none"
        : entry.evidence.map((item) => `${item.artifact_type}:${item.artifact_id}@${item.content_sha256}`).join("; ");
      return `| \`${escapeMarkdown(entry.attempt_id)}\` | [input](${entry.input_path}) | [request](${entry.request_path}) | \`${escapeMarkdown(runtime)}\` | \`${escapeMarkdown(correlation)}\` | \`${escapeMarkdown(`${entry.call_certainty}/${result}`)}\` | ${escapeMarkdown(evidence)} |`;
    }),
    "",
  ];
  return { json: canonicalJson(index), markdown: lines.join("\n") };
}

function deriveRuntimeCallCertainty(root, events) {
  if (events.some((event) => event.event_type === "turn_completed")) return "confirmed_finished";
  const lookupBinding = events.find((event) => event.event_type === "turn_lookup_result");
  if (lookupBinding) {
    const lookup = readArtifactObject(root, lookupBinding.content_sha256);
    const payload = lookup.payload.event_json === null
      ? null
      : parseStrictJson(Buffer.from(lookup.payload.event_json, "utf8"), "turn lookup result");
    if (payload?.status === "completed") return "confirmed_finished";
    if (payload?.status === "not_started") return "confirmed_not_started";
  }
  if (events.some((event) => event.event_type === "turn_start_acknowledged")) return "started";
  if (events.some((event) => event.event_type === "turn_start_write_intent")) return "unknown";
  return "confirmed_not_started";
}

function classifyRuntimeRecoveryEvidence(root, runId, attemptId) {
  let view;
  try {
    view = readRuntimeSnapshot(root, runId, attemptId);
  } catch (error) {
    if (error instanceof HarnessError && error.code === "RUNTIME_SNAPSHOT_MISSING") return null;
    throw error;
  }
  if (view.events.some((event) => event.event_type === "turn_completed")) {
    return { call_certainty: "confirmed_finished" };
  }
  const lookupBinding = view.events.find((event) => event.event_type === "turn_lookup_result");
  if (lookupBinding) {
    const lookup = readArtifactObject(root, lookupBinding.content_sha256);
    const payload = lookup.payload.event_json === null
      ? null
      : parseStrictJson(Buffer.from(lookup.payload.event_json, "utf8"), "turn lookup result");
    if (payload?.status === "not_started") return { call_certainty: "confirmed_not_started" };
    if (payload?.status === "completed") return { call_certainty: "confirmed_finished" };
  }
  return null;
}

function runtimeThreadId(root, attestationSha256) {
  const attestation = readArtifactObject(root, attestationSha256);
  if (attestation.artifact_type !== "runtime_attestation") {
    fail("RUNTIME_VIEW_CORRUPT", "Runtime index attestation binding has the wrong artifact type.", 3);
  }
  return attestation.payload.thread_id;
}

function safeRuntimeAttemptDirectory(root, runId, attemptId) {
  assertIdentity(runId, "runId");
  assertIdentity(attemptId, "attemptId");
  return containedPath(root, "runs", runId, "runtime", "attempts", attemptId);
}

function hasExactStoredLink(source, relationship, target) {
  return source.links.some(
    (link) =>
      link.relationship === relationship &&
      link.target_artifact_type === target.artifact_type &&
      link.target_artifact_id === target.artifact_id &&
      link.target_content_sha256 === target.content_sha256,
  );
}

function escapeMarkdown(value) {
  return String(value).replace(/[\\`*_[\]<>|]/g, "\\$&").replace(/[\r\n]+/g, " ");
}

function writeImmutable(path, bytes, options) {
  if (existsSync(path)) {
    if (readFileSync(path, "utf8") !== bytes) fail("STORE_RECORD_IMMUTABLE", "Immutable record already exists with different content.", 3);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeAtomic(path, bytes, { ...options, exclusive: true });
}

function writeAtomic(path, bytes, options = {}) {
  mkdirSync(dirname(path), { recursive: true });
  if (options.exclusive && existsSync(path)) fail("STORE_RECORD_EXISTS", "Exclusive record already exists.", 3);
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
  let descriptor;
  try {
    descriptor = openSync(temporary, "wx");
    inject(options, `${options.namespace}.before-write`);
    writeFileSync(descriptor, bytes, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    inject(options, `${options.namespace}.after-temp`);
    if (options.exclusive && existsSync(path)) fail("STORE_RECORD_EXISTS", "Exclusive record already exists.", 3);
    renameSync(temporary, path);
    inject(options, `${options.namespace}.after-rename`);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    if (existsSync(temporary)) rmSync(temporary);
  }
}

function readLease(path, runId) {
  const lease = parseStrictJson(readFileSync(path), "run lease");
  const keys = lease.state === "released"
    ? ["acquired_at", "expires_at", "host", "owner", "pid", "released_at", "run_id", "state", "token"]
    : ["acquired_at", "expires_at", "host", "owner", "pid", "run_id", "state", "token"];
  assertExactKeys(lease, keys);
  if (lease.run_id !== runId || !["active", "released"].includes(lease.state)) fail("LEASE_CORRUPT", "Stored lease is invalid.", 3);
  assertIdentity(lease.run_id, "lease run_id");
  assertIdentity(lease.token, "lease token");
  assertBoundedString(lease.host, "lease host");
  assertBoundedString(lease.owner, "lease owner");
  if (!Number.isInteger(lease.pid) || lease.pid <= 0) fail("LEASE_CORRUPT", "Lease pid is invalid.", 3);
  const acquired = assertTimestamp(lease.acquired_at, "lease acquired_at", "LEASE_CORRUPT");
  const expires = assertTimestamp(lease.expires_at, "lease expires_at", "LEASE_CORRUPT");
  if (expires <= acquired) fail("LEASE_CORRUPT", "Lease expiry must follow acquisition.", 3);
  if (lease.state === "released") assertTimestamp(lease.released_at, "lease released_at", "LEASE_CORRUPT");
  return lease;
}

function assertActiveLease(root, runId, token, nowValue) {
  const leasePath = safeRunFile(root, runId, "lease", "lease.json");
  if (!existsSync(leasePath) || typeof token !== "string") {
    fail("LEASE_REQUIRED", "Mutable run operations require the active lease token.", 4);
  }
  const lease = readLease(leasePath, runId);
  const now = new Date(nowValue ?? Date.now());
  if (lease.state !== "active" || lease.token !== token || new Date(lease.expires_at) <= now) {
    fail("LEASE_TOKEN_MISMATCH", "Run lease is missing, stale, or owned by another writer.", 4);
  }
}

function writeNewLeaseDirectory(root, leaseDirectory, lease, options) {
  const temporary = join(dirname(leaseDirectory), `.${basename(leaseDirectory)}.${process.pid}.${randomUUID()}.tmp`);
  let publicationError = null;
  try {
    mkdirSync(temporary);
    writeAtomic(join(temporary, "lease.json"), canonicalJson(lease), { ...options, namespace: "lease" });
    try {
      inject(options, "lease-directory.before-publish", { dest: leaseDirectory, path: temporary });
      renameSync(temporary, leaseDirectory);
    } catch (error) {
      publicationError = hasActiveCompetingLease(join(leaseDirectory, "lease.json"), lease, options.now)
        ? new HarnessError("LEASE_HELD", "Another writer acquired the run lease first.", 4)
        : leasePublicationFailure(root, error, "lease_directory_rename");
    }
  } catch (error) {
    publicationError = error;
  }
  let cleanupError = null;
  if (existsSync(temporary)) {
    try {
      inject(options, "lease-directory.before-cleanup", { path: temporary });
      rmSync(temporary, { recursive: true });
    } catch (error) {
      cleanupError = leasePublicationFailure(root, error, "lease_temporary_directory_cleanup");
    }
  }
  if (publicationError) throw publicationError;
  if (cleanupError) throw cleanupError;
}

function hasActiveCompetingLease(leasePath, attemptedLease, nowValue) {
  if (!existsSync(leasePath)) return false;
  try {
    const existing = readLease(leasePath, attemptedLease.run_id);
    const now = new Date(nowValue ?? Date.now());
    return existing.state === "active" && existing.token !== attemptedLease.token && new Date(existing.expires_at) > now;
  } catch {
    return false;
  }
}

function leasePublicationFailure(root, error, substep) {
  const diagnostic = projectLeasePublicationFilesystemFailure(root, error, substep);
  const failure = new HarnessError(
    "LEASE_PUBLICATION_FAILED",
    `Lease filesystem operation failed: ${canonicalJson(diagnostic).trimEnd()}`,
    4,
  );
  leasePublicationFilesystemFailures.set(failure, diagnostic);
  return failure;
}

function projectLeasePublicationFilesystemFailure(root, error, substep) {
  const projectedPath = normalizeStoreRelativeDiagnosticPath(root, error?.path);
  const projectedDest = normalizeStoreRelativeDiagnosticPath(root, error?.dest);
  const diagnostic = {
    code: typeof error?.code === "string" && /^E[A-Z0-9]{1,31}$/.test(error.code) ? error.code : null,
    dest: projectedDest,
    errno: Number.isSafeInteger(error?.errno) ? error.errno : null,
    message: sanitizeFilesystemFailureMessage(error?.message, [
      [error?.path, projectedPath],
      [error?.dest, projectedDest],
    ]),
    path: projectedPath,
    publication_substep: substep,
    syscall: typeof error?.syscall === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(error.syscall)
      ? error.syscall
      : null,
  };
  try {
    assertRuntimeCredentialFree(diagnostic);
  } catch {
    diagnostic.message = null;
  }
  assertRuntimeCredentialFree(diagnostic);
  return diagnostic;
}

function isLeaseOwnerActive(lease, options) {
  if (lease.state !== "active") return false;
  if (lease.host !== (options.host ?? hostname())) return false;
  if (options.isPidActive) return options.isPidActive(lease.pid);
  try {
    process.kill(lease.pid, 0);
    return true;
  } catch {
    return false;
  }
}

function objectFile(root, hash) {
  assertHash(hash, "object hash");
  return containedPath(root, "objects", hash.slice(0, 2), hash, "artifact.json");
}

function safeEntityFile(root, kind, id, file) {
  assertIdentity(id, `${kind} id`);
  return containedPath(root, kind, id, file);
}

function safeAttemptFile(root, runId, attemptId, file) {
  assertIdentity(runId, "runId");
  assertIdentity(attemptId, "attemptId");
  return containedPath(root, "runs", runId, "attempts", attemptId, file);
}

function runRuntimeSnapshotPublicationStep(root, publicationSubstep, operation) {
  try {
    return operation();
  } catch (error) {
    captureRuntimeSnapshotFilesystemFailure(root, publicationSubstep, error);
    throw error;
  }
}

function captureRuntimeSnapshotFilesystemFailure(root, publicationSubstep, error) {
  if (
    !error ||
    typeof error !== "object" ||
    runtimeSnapshotFilesystemFailures.has(error) ||
    typeof error.code !== "string" ||
    !/^E[A-Z0-9]{1,31}$/.test(error.code) ||
    (
      !Number.isSafeInteger(error.errno) &&
      typeof error.syscall !== "string" &&
      typeof error.path !== "string" &&
      typeof error.dest !== "string"
    ) ||
    !runtimeSnapshotPublicationSubsteps.includes(publicationSubstep)
  ) {
    return;
  }
  const projectedPath = normalizeStoreRelativeDiagnosticPath(root, error.path);
  const projectedDest = normalizeStoreRelativeDiagnosticPath(root, error.dest);
  runtimeSnapshotFilesystemFailures.set(error, {
    code: error.code,
    dest: projectedDest,
    errno: Number.isSafeInteger(error.errno) ? error.errno : null,
    message: sanitizeFilesystemFailureMessage(error.message, [
      [error.path, projectedPath],
      [error.dest, projectedDest],
    ]),
    path: projectedPath,
    publication_substep: publicationSubstep,
    syscall: typeof error.syscall === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(error.syscall)
      ? error.syscall
      : null,
  });
}

function normalizeStoreRelativeDiagnosticPath(root, value) {
  if (typeof value !== "string" || value.length === 0) return null;
  const storeRoot = resolve(root);
  const candidate = resolve(value);
  const storeRelative = relative(storeRoot, candidate);
  if (storeRelative === "" || isAbsolute(storeRelative) || storeRelative === ".." || storeRelative.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    return null;
  }
  const normalized = storeRelative.replaceAll("\\", "/");
  return normalized.length <= 512 ? normalized : null;
}

function sanitizeFilesystemFailureMessage(value, pathReplacements) {
  if (typeof value !== "string" || value.length === 0) return null;
  let message = value.replace(/[\r\n]+/g, " ");
  for (const [rawPath, projectedPath] of pathReplacements) {
    if (typeof rawPath === "string" && rawPath.length > 0) {
      message = message.replaceAll(rawPath, projectedPath ?? "[outside-store-path]");
    }
  }
  if (/[A-Za-z]:[\\/]|\\\\|(?:^|[\s'"(])\/[A-Za-z0-9._-]/.test(message)) return null;
  return message.slice(0, 512);
}

function liveAuthorityReference(record) {
  return {
    grant_id: record.grant.grant_id,
    grant_sha256: record.grant_sha256,
    record_sha256: record.record_sha256,
    run_id: record.run_id,
    task_id: record.task_id,
  };
}

function assertRuntimeMeasurementValue(value, attemptId) {
  assertExactKeys(value, ["attempt_id", "call_count", "dispatch_started_at", "input_bytes", "measurement_version", "request_bytes", "role", "semantic_output_bytes", "terminal_at", "token_usage"]);
  if (value.attempt_id !== attemptId || value.call_count !== 1 || value.measurement_version !== "cp9-runtime-measurement-v1" || !["reader", "evaluator"].includes(value.role)) {
    fail("RUNTIME_MEASUREMENT_INVALID", "Runtime measurement identity, version, call count, or role is invalid.", 3);
  }
  const started = assertTimestamp(value.dispatch_started_at, "measurement dispatch_started_at", "RUNTIME_MEASUREMENT_INVALID");
  const terminal = assertTimestamp(value.terminal_at, "measurement terminal_at", "RUNTIME_MEASUREMENT_INVALID");
  if (terminal < started) fail("RUNTIME_MEASUREMENT_INVALID", "Runtime measurement terminal time precedes dispatch.", 3);
  for (const key of ["input_bytes", "request_bytes", "semantic_output_bytes"]) {
    if (!Number.isInteger(value[key]) || value[key] < 0) fail("RUNTIME_MEASUREMENT_INVALID", `Runtime measurement ${key} is invalid.`, 3);
  }
  if (value.token_usage?.status === "unavailable") {
    assertExactKeys(value.token_usage, ["status"]);
    return;
  }
  if (value.token_usage?.status !== "observed") fail("RUNTIME_MEASUREMENT_INVALID", "Runtime token usage status is invalid.", 3);
  assertExactKeys(value.token_usage, ["event_count", "event_json", "event_sha256", "status"]);
  if (!Number.isInteger(value.token_usage.event_count) || value.token_usage.event_count < 1) fail("RUNTIME_MEASUREMENT_INVALID", "Runtime usage event count is invalid.", 3);
  assertHash(value.token_usage.event_sha256, "runtime usage event hash");
  if (sha256Bytes(Buffer.from(value.token_usage.event_json, "utf8")) !== value.token_usage.event_sha256) fail("RUNTIME_MEASUREMENT_INVALID", "Runtime usage event bytes do not match their hash.", 3);
  assertRuntimeCredentialFree(parseStrictJson(Buffer.from(value.token_usage.event_json, "utf8"), "runtime usage event"));
}

function assertLiveGrantAgainstRun(grant, run, code) {
  assertExactKeys(grant, [
    "assurance_profile", "authentication_boundary", "authorized_roles", "grant_id", "issued_at", "issuer",
    "live_call_limits", "run_id", "runtime_config_sha256", "task_id",
  ]);
  assertIdentity(grant.grant_id, "live grant_id");
  assertIdentity(grant.issuer, "live grant issuer");
  assertTimestamp(grant.issued_at, "live grant issued_at", code);
  const intent = run.payload.intent;
  if (
    !intent || intent.assurance_profile !== "runtime_mediated" ||
    intent.authentication_boundary !== "chatgpt_subscription" ||
    intent.authority_record?.live_model_calls !== true ||
    grant.assurance_profile !== intent.assurance_profile ||
    grant.authentication_boundary !== intent.authentication_boundary ||
    grant.run_id !== run.artifact_id || grant.task_id !== run.payload.task_id ||
    grant.runtime_config_sha256 !== run.payload.runtime_config_sha256 ||
    canonicalJson(grant.authorized_roles) !== canonicalJson(intent.authority_record.authorized_roles) ||
    canonicalJson(grant.live_call_limits) !== canonicalJson(intent.authority_record.live_call_limits)
  ) fail(code, "Live dispatch grant does not match the exact canonical run intent.", 4);
  assertRuntimeCredentialFree(grant);
}

function safeRunFile(root, runId, ...segments) {
  assertIdentity(runId, "runId");
  return containedPath(root, "runs", runId, ...segments);
}

function validateStoredLinks(root, artifact, visited = new Set()) {
  for (const link of artifact.links) {
    const target = readArtifactObjectInternal(root, link.target_content_sha256, visited);
    if (target.artifact_type !== link.target_artifact_type || target.artifact_id !== link.target_artifact_id) {
      fail("STORE_LINK_CORRUPT", "Stored artifact link identity does not match its content-addressed target.", 3);
    }
  }
}

function containedPath(root, ...segments) {
  const base = resolve(root);
  const candidate = resolve(base, ...segments);
  const relation = relative(base, candidate);
  if (relation === "" || relation.startsWith("..") || isAbsolute(relation)) fail("STORE_PATH_INVALID", "Store path escaped its root.");
  return candidate;
}

function sortedDirectories(root) {
  const entries = readdirSync(root, { withFileTypes: true });
  if (entries.some((entry) => !entry.isDirectory())) {
    fail("ATTEMPT_RECORD_CORRUPT", "Attempt root contains a non-directory record.", 3);
  }
  return entries.map((entry) => entry.name).sort();
}

function assertIdentity(value, label) {
  if (typeof value !== "string" || !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(value)) {
    fail("STORE_IDENTITY_INVALID", `${label} must be a normalized identity.`);
  }
}

function assertHash(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail("STORE_HASH_INVALID", `${label} must be lowercase sha256.`);
}

function assertBoundedString(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.length > 255 || /[\u0000-\u001f\u007f]/.test(value)) {
    fail("LEASE_CORRUPT", `${label} is invalid.`, 3);
  }
}

function assertTimestamp(value, label, code) {
  const parsed = typeof value === "string" ? new Date(value) : new Date(Number.NaN);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) fail(code, `${label} is invalid.`, 3);
  return parsed;
}

function assertExactKeys(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("STORE_RECORD_INVALID", "Stored record must be an object.");
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) fail("STORE_RECORD_INVALID", "Stored record fields are invalid.");
}

function inject(options, point, context = undefined) {
  if (options.faultAt === point) fail("INJECTED_FAULT", `Injected fault at '${point}'.`, 90);
  if (typeof options.faultAt === "function") options.faultAt(point, context);
}

function fail(code, message, exitCode = 1) {
  throw new HarnessError(code, message, exitCode);
}
