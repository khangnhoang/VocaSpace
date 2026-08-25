import { canonicalJson } from "./artifact-schema-v1.mjs";
import { createCodexAppServerStdioTransport } from "./codex-app-server-stdio-transport-v2.mjs";
import { createCodexChatGptAppServerAdapter } from "./codex-chatgpt-app-server-v2.mjs";
import { HarnessError, assertHarnessArtifact } from "./harness-schema-v2.mjs";
import { runSequentialReaderStage } from "./orchestrator-v2.mjs";
import { finalizeEvaluatorStage, runSequentialEvaluatorStage } from "./review-v2.mjs";
import { assertPreparedCp9LiveGrant, assertPreparedCp9LivePlan } from "./cp9-prepare-v2.mjs";
import {
  acquireRunLease,
  listStoredArtifacts,
  loadRunManifest,
  loadTaskManifest,
  readArtifactObject,
  releaseRunLease,
  resolveLiveDispatchAuthority,
} from "./run-store-v2.mjs";

export const cp9CaseIds = Object.freeze([
  "gcw-fresh-dirty-secret-stop",
  "gcw-reg-commit-versus-push",
  "gcw-route-push-remote",
  "ghci-fresh-self-fix-cycle",
  "ghci-reg-explicit-fix-exact-actions",
  "ghci-route-db-risk-stop",
]);

const refs = Object.freeze({
  baseline: "3fa621c86399e5c1a9e43bd9cd7b67f7b3efa52a",
  phase1: "41de1e627479b1feb6bd60eec1073bdd1591d490",
  phase2: "c3a2534b8a0c21a9276e5a6fba34f755daaf8e9e",
});
const affectedPhase2 = Object.freeze([
  "reader-ghci-fresh-self-fix-cycle-candidate",
  "reader-ghci-reg-explicit-fix-exact-actions-candidate",
  "reader-ghci-route-db-risk-stop-candidate",
]);
const canary = Object.freeze([
  "reader-gcw-reg-commit-versus-push-baseline",
  "reader-gcw-reg-commit-versus-push-candidate",
]);

export async function preflightCp9AppServer({ executable, transportFactory = createCodexAppServerStdioTransport } = {}) {
  let transport;
  try {
    transport = transportFactory({ executable });
    return await transport.preflight();
  } catch (error) {
    error.runtimeStatus ??= "runtime_confirmed_not_started";
    throw error;
  } finally {
    await transport?.close?.();
  }
}

export async function executeCp9LivePlan({
  authorityReference,
  executable,
  plan,
  storeRoot,
  transportFactory = createCodexAppServerStdioTransport,
} = {}) {
  assertPlan(plan);
  const prepared = assertPreparedCp9LivePlan(storeRoot, plan);
  const run = prepared.run;
  const currentRun = loadRunManifest(storeRoot, plan.run_id);
  const task = loadTaskManifest(storeRoot, plan.task_id);
  if (run.payload.task_id !== task.artifact_id || run.artifact_id !== plan.run_id || currentRun.payload.runtime_config_sha256 !== run.payload.runtime_config_sha256) fail("CP9_PLAN_LINEAGE_INVALID", "CP9 plan does not own the exact task/run.");
  assertCp9RunScope(run);
  assertNoAutomaticRetry(storeRoot, run.artifact_id);
  const { grant } = resolveLiveDispatchAuthority(storeRoot, authorityReference);
  assertPreparedCp9LiveGrant(prepared, grant);
  if (grant.live_call_limits.reader !== 15 || grant.live_call_limits.evaluator !== 12 || grant.live_call_limits.verification_helper !== 0 || grant.live_call_limits.total !== 27) {
    fail("CP9_BUDGET_INVALID", "CP9 requires exact admitted reader/evaluator/helper/total limits.");
  }
  const readerInvocations = plan.reader_invocation_sha256s.map((hash) => readExact(storeRoot, hash, "compiled_invocation"));
  const evaluatorStaticInvocation = readExact(storeRoot, plan.evaluator_static_invocation_sha256, "compiled_invocation");
  const readinessSet = {
    evaluator_static: readExact(storeRoot, plan.evaluator_static_readiness_sha256, "readiness_analysis"),
    reader: readExact(storeRoot, plan.reader_readiness_sha256, "readiness_analysis"),
  };
  const supportingArtifacts = plan.supporting_artifact_sha256s.map((hash) => readArtifactObject(storeRoot, hash));
  const expectedRuntime = readerInvocations[0]?.payload.runtime.behavior_runtime;
  if (!expectedRuntime || readerInvocations.some((artifact) => canonicalJson(artifact.payload.runtime.behavior_runtime) !== canonicalJson(expectedRuntime))) {
    fail("CP9_RUNTIME_INVALID", "All CP9 reader invocations must bind one exact compiled behavior runtime.");
  }
  if (expectedRuntime.model !== "gpt-5.6-sol" || expectedRuntime.effort !== "medium") {
    fail("CP9_RUNTIME_INVALID", "CP9 runtime must be exact model gpt-5.6-sol with effort medium.");
  }
  assertStagePrerequisites(storeRoot, run.artifact_id, plan.stage);
  const transport = transportFactory({ executable, expectedRuntime });
  const adapter = createCodexChatGptAppServerAdapter({
    liveAuthorityVerifier: (candidate) => canonicalJson(candidate) === canonicalJson(grant),
    outputSchemas: {
      "evaluator-proposal-v2": { additionalProperties: true, type: "object" },
      "observation-v2": { additionalProperties: true, type: "object" },
      "verification-helper-v2": { additionalProperties: false, type: "object" },
    },
    transport,
  });
  const lease = acquireRunLease(storeRoot, run.artifact_id, { durationMs: 7_200_000, owner: "cp9-live-cli" });
  try {
    if (plan.stage !== "evaluator") {
      const scope = plan.stage === "reader-canary" ? canary : plan.stage === "reader-phase2" ? affectedPhase2 : expectedReaderIds();
      const invalidated = plan.stage === "reader-phase2" ? affectedPhase2 : [];
      return await runSequentialReaderStage({
        adapter,
        adapterCapabilities: adapter.capabilities,
        dispatchUnitIds: scope,
        evaluatorStatic: { invocation: evaluatorStaticInvocation, readiness: readinessSet.evaluator_static },
        invalidatedUnitIds: invalidated,
        leaseToken: lease.token,
        liveDispatchGrant: grant,
        maxDispatches: plan.stage === "reader-canary" ? 2 : plan.stage === "reader-phase2" ? 3 : 10,
        readinessSet,
        readerInvocations,
        requireUnscopedReuse: plan.stage === "reader-phase2",
        run,
        storeRoot,
        supportingArtifacts,
        stopOnFailure: true,
        task,
      });
    }
    const evaluator = plan.evaluator;
    const invocationByUnit = new Map(readerInvocations.map((item) => [item.payload.unit_id, item]));
    const currentObservations = listStoredArtifacts(storeRoot, { artifactType: "observation" }).filter((item) => {
      const invocation = invocationByUnit.get(item.payload.unit_id);
      return item.payload.run_id === run.artifact_id && invocation && item.links.some(
        (link) => link.relationship === "compiled_invocation" && link.target_content_sha256 === invocation.content_sha256,
      );
    });
    const observations = new Map();
    for (const observation of currentObservations) {
      if (observations.has(observation.payload.unit_id)) fail("CP9_EVIDENCE_AMBIGUOUS", "Current CP9 reader evidence is ambiguous for one selected unit.");
      observations.set(observation.payload.unit_id, observation);
    }
    const observationHashes = new Set([...observations.values()].map((item) => item.content_sha256));
    const resources = listStoredArtifacts(storeRoot, { artifactType: "resource_observation" }).filter((item) =>
      item.links.some((link) => link.relationship === "observation" && observationHashes.has(link.target_content_sha256)),
    );
    const stage = finalizeEvaluatorStage({
      comparisonMapping: evaluator.comparison_mapping,
      protocol: evaluator.protocol,
      requestedPolicy: evaluator.requested_policy,
      rubric: evaluator.rubric,
      run,
      runtime: evaluator.runtime,
      staticReadiness: readinessSet.evaluator_static,
      supportingArtifacts: [...supportingArtifacts, ...readerInvocations, evaluatorStaticInvocation, ...observations.values(), ...resources],
      task,
      tools: evaluator.tools,
      units: expectedReaderIds().map((readerId) => ({
        evaluator_unit_id: readerId.replace(/^reader-/, "evaluator-"),
        observation: observations.get(readerId),
        reader_unit_id: readerId,
        resource_observations: resources.filter((item) => item.links.some(
          (link) => link.relationship === "observation" && link.target_content_sha256 === observations.get(readerId)?.content_sha256,
        )),
      })),
    });
    return await runSequentialEvaluatorStage({ adapter, leaseToken: lease.token, liveDispatchGrant: grant, run, stage, stopOnFailure: true, storeRoot });
  } finally {
    await transport.close?.();
    releaseRunLease(storeRoot, run.artifact_id, lease.token);
  }
}

function assertPlan(plan) {
  const keys = ["baseline_ref", "case_ids", "evaluator", "evaluator_static_invocation_sha256", "evaluator_static_readiness_sha256", "phase1_ref", "phase2_ref", "plan_version", "reader_invocation_sha256s", "reader_readiness_sha256", "run_id", "stage", "supporting_artifact_sha256s", "task_id"];
  if (!plan || Array.isArray(plan) || canonicalJson(Object.keys(plan).sort()) !== canonicalJson(keys)) fail("CP9_PLAN_INVALID", "CP9 live plan has an invalid exact schema.");
  if (plan.plan_version !== "cp9-live-plan-v1" || !["reader-canary", "reader-phase1", "reader-phase2", "evaluator"].includes(plan.stage)) fail("CP9_PLAN_INVALID", "CP9 plan version or stage is invalid.");
  if (plan.baseline_ref !== refs.baseline || plan.phase1_ref !== refs.phase1 || plan.phase2_ref !== refs.phase2 || canonicalJson(plan.case_ids) !== canonicalJson(cp9CaseIds)) fail("CP9_SCOPE_INVALID", "CP9 plan escaped the frozen refs/case scope.");
  if (!Array.isArray(plan.reader_invocation_sha256s) || plan.reader_invocation_sha256s.length !== 12 || new Set(plan.reader_invocation_sha256s).size !== 12 || !Array.isArray(plan.supporting_artifact_sha256s)) fail("CP9_PLAN_INVALID", "CP9 plan artifact bindings are incomplete.");
  if ((plan.stage === "evaluator") !== (plan.evaluator !== null)) fail("CP9_PLAN_INVALID", "Only the evaluator stage may carry evaluator finalization input.");
}

function assertCp9RunScope(run) {
  const actual = run.payload.selected_units.map((unit) => `${unit.role}:${unit.unit_id}`).sort();
  const expected = [...expectedReaderIds().map((id) => `reader:${id}`), ...expectedReaderIds().map((id) => `evaluator:${id.replace(/^reader-/, "evaluator-")}`)].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) fail("CP9_SCOPE_INVALID", "Run selected units differ from the frozen CP9 workload.");
  const authority = run.payload.intent?.authority_record;
  if (!authority || authority.live_model_calls !== true || canonicalJson(authority.authorized_roles) !== canonicalJson(["evaluator", "reader"]) || authority.live_call_limits.verification_helper !== 0) fail("CP9_AUTHORITY_INVALID", "Run intent does not enforce exact CP9 live/helper scope.");
}

function assertNoAutomaticRetry(root, runId) {
  const terminal = listStoredArtifacts(root, { artifactType: "execution_attempt" }).filter((item) => item.payload.run_id === runId && item.payload.phase === "terminal");
  if (terminal.some((item) => item.payload.outcome !== "success")) fail("CP9_AUTOMATIC_RETRY_FORBIDDEN", "A prior non-success model attempt requires separate readmission; automatic redispatch is forbidden.");
}

function assertStagePrerequisites(root, runId, stage) {
  if (stage === "reader-canary") return;
  const completed = new Set(listStoredArtifacts(root, { artifactType: "observation" }).filter((item) => item.payload.run_id === runId).map((item) => item.payload.unit_id));
  const required = stage === "reader-phase1" ? canary : expectedReaderIds();
  if (required.some((unitId) => !completed.has(unitId))) {
    fail("CP9_STAGE_PREREQUISITE_MISSING", "CP9 stage prerequisite observations are incomplete; no later-stage dispatch is allowed.");
  }
}

function expectedReaderIds() {
  return cp9CaseIds.flatMap((caseId) => [`reader-${caseId}-baseline`, `reader-${caseId}-candidate`]).sort();
}

function readExact(root, hash, type) {
  return assertHarnessArtifact(readArtifactObject(root, hash), { artifactType: type });
}

function fail(code, message) {
  throw new HarnessError(code, message, 4);
}
