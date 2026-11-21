import assert from "node:assert/strict";
import test from "node:test";
import { decideDatabaseReset, e2eProjectId } from "./reset-decision.mjs";

const job = { GITHUB_RUN_ID: "42", GITHUB_RUN_ATTEMPT: "1" };
const evidencePath = "/runner/temp/e2e-fresh-stack-evidence.json";

function freshEvidence(overrides = {}) {
  return {
    version: 1,
    projectId: e2eProjectId,
    dataVolume: `supabase_db_${e2eProjectId}`,
    volumeBeforeStart: "absent",
    volumeAfterStart: "present",
    startExitCode: 0,
    runId: "42",
    runAttempt: "1",
    ...overrides,
  };
}

function decide(evidence, input = {}) {
  return decideDatabaseReset({
    evidencePath,
    evidenceText: evidence === null ? null : typeof evidence === "string" ? evidence : JSON.stringify(evidence),
    job,
    ...input,
  });
}

test("skips the reset only when this job started the stack on an empty volume", () => {
  const decision = decide(freshEvidence());
  assert.equal(decision.reset, false);
});

test("resets when the opt-in flag is not set, even with valid evidence", () => {
  assert.equal(decide(freshEvidence(), { evidencePath: undefined }).reset, true);
  assert.equal(decide(freshEvidence(), { evidencePath: "" }).reset, true);
});

test("resets when the evidence file is missing, unreadable or malformed", () => {
  assert.equal(decide(null).reset, true);
  assert.equal(decide("not json").reset, true);
  assert.equal(decide("null").reset, true);
  assert.equal(decide("[]").reset, true);
});

test("resets when the stack belongs to another project or data volume", () => {
  assert.equal(decide(freshEvidence({ projectId: "voca_space" })).reset, true);
  assert.equal(decide(freshEvidence({ dataVolume: "supabase_db_voca_space" })).reset, true);
});

test("resets when the data volume existed before the start (reused stack)", () => {
  assert.equal(decide(freshEvidence({ volumeBeforeStart: "present" })).reset, true);
  assert.equal(decide(freshEvidence({ volumeBeforeStart: "unknown" })).reset, true);
});

test("resets when the volume was not seen after a successful start", () => {
  assert.equal(decide(freshEvidence({ volumeAfterStart: "absent" })).reset, true);
  assert.equal(decide(freshEvidence({ volumeAfterStart: "unknown" })).reset, true);
});

test("resets when the start did not succeed or the evidence version is unknown", () => {
  assert.equal(decide(freshEvidence({ startExitCode: 1 })).reset, true);
  assert.equal(decide(freshEvidence({ version: 2 })).reset, true);
});

test("resets when the evidence comes from another job run or the job is unknown", () => {
  assert.equal(decide(freshEvidence({ runId: "41" })).reset, true);
  assert.equal(decide(freshEvidence({ runAttempt: "2" })).reset, true);
  assert.equal(decide(freshEvidence(), { job: {} }).reset, true);
});

test("always explains the decision", () => {
  assert.match(decide(freshEvidence()).reason, /empty data volume/);
  assert.match(decide(freshEvidence(), { evidencePath: undefined }).reason, /E2E_SKIP_DB_RESET_EVIDENCE/);
});
