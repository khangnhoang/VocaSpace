import { canonicalJson, sha256Canonical } from "./artifact-schema-v1.mjs";
import {
  HarnessError,
  assertHarnessArtifact,
  createHarnessArtifact,
  validateArtifactGraph,
} from "./harness-schema-v2.mjs";
import {
  appendAttemptPhase,
  readRuntimeSnapshot,
  recordRuntimeResultView,
  writeArtifactObject,
} from "./run-store-v2.mjs";

const policyFields = Object.freeze([
  "credentials",
  "filesystem",
  "fresh_context",
  "mutation",
  "network",
  "remote_actions",
]);
const authorizedConcreteHelperExecutions = new WeakSet();

export function compileInvocation({
  artifactId,
  messages,
  protocol,
  requestedPolicy,
  resources,
  role,
  run,
  runtime,
  tools,
  unitId,
}) {
  assertHarnessArtifact(run, { artifactType: "run_manifest" });
  const modelVisiblePolicy = structuredClone(requestedPolicy);
  return createHarnessArtifact({
    artifactType: "compiled_invocation",
    artifactId,
    producer: producer("readiness_compiler"),
    links: [link("run", run)],
    payload: {
      messages: [
        { content: executionPolicyMessage(modelVisiblePolicy), role: "developer" },
        ...structuredClone(messages),
      ],
      model_visible_policy: modelVisiblePolicy,
      protocol: structuredClone(protocol),
      requested_policy: structuredClone(requestedPolicy),
      resources: structuredClone(resources),
      role,
      run_id: run.artifact_id,
      runtime: structuredClone(runtime),
      tools: structuredClone(tools),
      unit_id: unitId,
    },
  });
}

export function compileEvaluatorStaticInvocation({ staticPlan, ...invocation }) {
  assertStaticPlan(staticPlan);
  return compileInvocation({
    ...invocation,
    role: "evaluator",
    messages: [
      { content: evaluatorStaticPlanMessage(staticPlan), role: "developer" },
      ...structuredClone(invocation.messages),
    ],
  });
}

export function executeReadiness({
  adapterCapabilities,
  correction = null,
  helper = null,
  helperExecution = null,
  now = new Date().toISOString(),
  rounds,
  run,
  task,
}) {
  assertHarnessArtifact(task, { artifactType: "task_manifest" });
  assertHarnessArtifact(run, { artifactType: "run_manifest" });
  assertCapabilities(adapterCapabilities);
  if (!Array.isArray(rounds) || rounds.length < 1 || rounds.length > 2) {
    fail("READINESS_ROUND_INVALID", "Readiness requires exactly one round or one correction followed by Round 2.");
  }
  for (const round of rounds) assertRoundInput(run, round);
  if (sha256Canonical(rounds[0].runtimeConfig) !== run.payload.runtime_config_sha256) {
    fail("READINESS_RUNTIME_MISMATCH", "Round 1 runtimeConfig must match the initial durable run runtime configuration.");
  }
  if (rounds.length === 2) assertCorrection(rounds[0], rounds[1], correction);
  else if (correction !== null) fail("READINESS_CORRECTION_INVALID", "A correction requires a Round 2 input.");

  const helperResult = helperExecution === null
    ? runFixtureHelpers({ helper, now, run, task })
    : validateConcreteHelperExecution({ helper, helperExecution, run, task });
  const artifacts = [...helperResult.artifacts];
  const analyses = [];
  for (let index = 0; index < rounds.length; index += 1) {
    const roundNumber = index + 1;
    const input = rounds[index];
    const round = analyzeRound(run, input, adapterCapabilities);
    const helperBlocked = helperResult.unresolved;
    const overallPassed = round.readerPassed && round.evaluatorPassed && !helperBlocked;
    if (roundNumber === 1 && rounds.length === 2 && overallPassed) {
      fail("READINESS_CORRECTION_INVALID", "Round 2 is allowed only after Round 1 requires the declared runtime correction.");
    }
    if (roundNumber === 1 && rounds.length === 2) {
      const failedFields = [...round.readerResults, ...round.evaluatorResults]
        .filter((result) => result.status === "failed")
        .map((result) => result.field);
      if (failedFields.length === 0 || failedFields.some((field) => field !== "static-runtime-config")) {
        fail("READINESS_CORRECTION_SCOPE", "Round 2 may correct only the evaluator static runtime-config mismatch.");
      }
    }
    const correctionRecord = roundNumber === 2 ? correctionRecordFor(correction) : null;
    const readerAnalysis = createReadinessAnalysis({
      correction: correctionRecord,
      fieldResults: [
        ...round.readerResults,
        fieldResult(
          "evaluator-static-barrier",
          "passed",
          round.evaluatorPassed ? "passed" : "failed",
          round.evaluatorPassed ? "passed" : "failed",
          round.evaluatorPassed ? null : "Evaluator static plan failed before reader dispatch.",
        ),
        fieldResult(
          "helper-uncertainty",
          "resolved",
          helperBlocked ? "unresolved" : "resolved",
          helperBlocked ? "unresolved" : "resolved",
          helperBlocked ? "Readiness uncertainty remains unresolved." : null,
        ),
      ],
      helperAttempts: roundNumber === 1 ? helperResult.terminalAttempts : [],
      invocations: input.readerInvocations,
      overallPassed,
      round: roundNumber,
      run,
      stage: "reader",
    });
    const evaluatorAnalysis = createReadinessAnalysis({
      correction: correctionRecord,
      fieldResults: round.evaluatorResults,
      helperAttempts: [],
      invocations: [input.evaluatorStatic.invocation],
      overallPassed: round.evaluatorPassed,
      round: roundNumber,
      run,
      stage: "evaluator_static",
    });
    validateArtifactGraph([
      task,
      run,
      ...input.readerInvocations,
      input.evaluatorStatic.invocation,
      ...helperResult.artifacts,
      readerAnalysis,
      evaluatorAnalysis,
    ]);
    artifacts.push(readerAnalysis, evaluatorAnalysis);
    analyses.push({ evaluator_static: evaluatorAnalysis, reader: readerAnalysis });
    if (overallPassed) break;
    if (roundNumber === 1 && rounds.length === 1) break;
  }
  const terminal = analyses.at(-1);
  return {
    analyses,
    artifacts,
    helper: helperResult.audit,
    status: terminal.reader.payload.status === "passed" && terminal.evaluator_static.payload.status === "passed" ? "passed" : "blocked",
  };
}

export async function executeReadinessWithConcreteHelpers({
  adapter,
  adapterCapabilities,
  correction = null,
  helper,
  leaseToken,
  now = () => new Date().toISOString(),
  rounds,
  run,
  storeRoot,
  task,
}) {
  if (adapter?.kind !== "codex_chatgpt_app_server" || typeof adapter.invokeVerificationHelper !== "function") {
    fail("HELPER_AUTHORITY_REQUIRED", "Concrete readiness helpers require the CP8A-certified App Server adapter.", 4);
  }
  const plan = createVerificationHelperPlan({ helper, run });
  const artifacts = [];
  const terminalAttempts = [];
  let unresolved = plan.cluster !== null;
  for (const entry of plan.entries) {
    if (!unresolved) break;
    const startedAt = now();
    const common = {
      attempt_id: entry.attemptId,
      input_sha256: entry.identity.helper_input_hash,
      role: "verification_helper",
      run_id: run.artifact_id,
      sequence: entry.index,
      started_at: startedAt,
      unit_id: null,
    };
    const prepared = helperAttempt(entry.invocation, run, `${entry.attemptId}-prepared`, {
      ...common,
      call_certainty: "not_started",
      finished_at: null,
      outcome: null,
      phase: "prepared",
    });
    writeArtifactObject(storeRoot, entry.invocation);
    appendAttemptPhase(storeRoot, prepared, { leaseToken, now: startedAt });
    let dispatched = null;
    const markDispatched = () => {
      if (dispatched) return dispatched;
      dispatched = helperAttempt(entry.invocation, run, `${entry.attemptId}-dispatched`, {
        ...common,
        call_certainty: "unknown",
        finished_at: null,
        outcome: null,
        phase: "dispatched",
      });
      appendAttemptPhase(storeRoot, dispatched, { leaseToken, now: startedAt });
      return dispatched;
    };
    let output;
    try {
      output = await adapter.invokeVerificationHelper(
        {
          grant_nonce: entry.identity.helper_input_hash,
          invocation_sha256: entry.invocation.content_sha256,
          unit_id: null,
        },
        {
          runtime: {
            attempt: prepared,
            graphArtifacts: [task, run, entry.invocation, prepared],
            helperInputHash: entry.identity.helper_input_hash,
            invocation: entry.invocation,
            leaseToken,
            markDispatched,
            readiness: null,
            run,
            storeRoot,
          },
        },
      );
    } catch (error) {
      const certainty = error?.callCertainty;
      if (!["confirmed_not_started", "confirmed_finished", "unknown"].includes(certainty)) {
        fail("ADAPTER_LIFECYCLE_INVALID", "Concrete helper failure lacks exact call-certainty evidence.", 4);
      }
      if (!dispatched && certainty !== "confirmed_not_started") {
        fail("ADAPTER_LIFECYCLE_INVALID", "Concrete helper failed without dispatch or confirmed-not-started evidence.", 4);
      }
      const finishedAt = now();
      const terminal = helperAttempt(entry.invocation, run, `${entry.attemptId}-terminal`, {
        ...common,
        call_certainty: certainty === "unknown" ? "unknown" : certainty === "confirmed_not_started" ? "confirmed_not_started" : "confirmed_finished",
        finished_at: finishedAt,
        outcome: certainty === "unknown" ? "outcome_unknown" : "error",
        phase: "terminal",
      });
      appendAttemptPhase(storeRoot, terminal, { leaseToken, now: finishedAt });
      recordHelperRuntimeResultIfPresent(storeRoot, run.artifact_id, entry.attemptId, terminal, leaseToken, finishedAt);
      throw error;
    }
    if (!dispatched) fail("ADAPTER_LIFECYCLE_INVALID", "Concrete helper success lacks a dispatched attempt.", 4);
    const resolved = output?.resolved === true;
    const finishedAt = now();
    const terminal = helperAttempt(entry.invocation, run, `${entry.attemptId}-terminal`, {
      ...common,
      call_certainty: "confirmed_finished",
      finished_at: finishedAt,
      outcome: resolved ? "success" : "error",
      phase: "terminal",
    });
    appendAttemptPhase(storeRoot, terminal, { leaseToken, now: finishedAt });
    recordRuntimeResultView(storeRoot, {
      attemptId: entry.attemptId,
      evidence: [],
      leaseToken,
      now: finishedAt,
      runId: run.artifact_id,
      status: resolved ? "success" : "error",
    });
    artifacts.push(entry.invocation, prepared, dispatched, terminal);
    terminalAttempts.push(terminal);
    unresolved = !resolved;
  }
  const helperExecution = {
    artifacts,
    audit: {
      call_count: terminalAttempts.length,
      cluster_id: plan.cluster?.cluster_id ?? null,
      status: plan.cluster === null ? "not_requested" : unresolved ? "unresolved" : "resolved",
    },
    terminalAttempts,
    unresolved,
  };
  authorizedConcreteHelperExecutions.add(helperExecution);
  return executeReadiness({
    adapterCapabilities,
    correction,
    helper,
    helperExecution,
    now: now(),
    rounds,
    run,
    task,
  });
}

export function createDispatchGuard({
  adapterCapabilities,
  evaluatorStatic,
  readinessSet,
  readerInvocations,
  run,
  supportingArtifacts = [],
  task,
}) {
  assertHarnessArtifact(task, { artifactType: "task_manifest" });
  assertHarnessArtifact(run, { artifactType: "run_manifest" });
  const readiness = readinessSet?.reader;
  const evaluatorReadiness = readinessSet?.evaluator_static;
  assertHarnessArtifact(readiness, { artifactType: "readiness_analysis" });
  assertHarnessArtifact(evaluatorReadiness, { artifactType: "readiness_analysis" });
  assertCapabilities(adapterCapabilities);
  if (
    readiness.payload.stage !== "reader" ||
    evaluatorReadiness.payload.stage !== "evaluator_static" ||
    readiness.payload.status !== "passed" ||
    evaluatorReadiness.payload.status !== "passed" ||
    readiness.payload.round !== evaluatorReadiness.payload.round
  ) {
    fail("DISPATCH_NOT_AUTHORIZED", "Reader dispatch requires one passed reader/evaluator-static readiness set.", 4);
  }
  const current = { evaluatorStatic, readerInvocations, runtimeConfig: readerInvocations[0]?.payload.runtime };
  const analyzed = analyzeRound(run, current, adapterCapabilities);
  if (!analyzed.readerPassed || !analyzed.evaluatorPassed) {
    fail("DISPATCH_ATTESTATION_CHANGED", "Compiled invocation or adapter capability changed after readiness.", 4);
  }
  const currentRuntimeHash = sha256Canonical(current.runtimeConfig);
  const correction = readiness.payload.correction;
  if (
    (readiness.payload.round === 1 &&
      (correction !== null || currentRuntimeHash !== run.payload.runtime_config_sha256)) ||
    (readiness.payload.round === 2 &&
      (correction === null ||
        correction.before_sha256 !== run.payload.runtime_config_sha256 ||
        correction.after_sha256 !== currentRuntimeHash)) ||
    canonicalJson(correction) !== canonicalJson(evaluatorReadiness.payload.correction)
  ) {
    fail("DISPATCH_RUNTIME_MISMATCH", "Dispatch runtime does not match the durable run and terminal readiness correction chain.", 4);
  }
  validateArtifactGraph([
    task,
    run,
    ...readerInvocations,
    evaluatorStatic.invocation,
    ...supportingArtifacts,
    readiness,
    evaluatorReadiness,
  ]);
  const consumed = new Set();
  return {
    authorize(invocation, nonce) {
      assertHarnessArtifact(invocation, { artifactType: "compiled_invocation" });
      const grant = readiness.payload.grants.find((item) => item.nonce === nonce);
      const linked = readiness.links.some(
        (item) =>
          item.relationship === "compiled_invocation" &&
          item.target_artifact_id === invocation.artifact_id &&
          item.target_content_sha256 === invocation.content_sha256,
      );
      if (
        !grant ||
        consumed.has(nonce) ||
        !linked ||
        grant.unit_id !== invocation.payload.unit_id ||
        grant.invocation_sha256 !== invocation.content_sha256
      ) {
        fail("DISPATCH_GRANT_INVALID", "Dispatch grant is missing, stale, mismatched, or already consumed.", 4);
      }
      consumed.add(nonce);
      return {
        grant_nonce: nonce,
        invocation: structuredClone(invocation.payload),
        invocation_sha256: invocation.content_sha256,
        unit_id: invocation.payload.unit_id,
      };
    },
  };
}

export function createPreflightHousekeepingPreview({ runId, taskId }) {
  assertIdentity(runId, "runId");
  assertIdentity(taskId, "taskId");
  return {
    actions: [
      { action: "retain", relative_path: `tasks/${taskId}/task.json`, reason: "active task manifest" },
      { action: "retain", relative_path: `runs/${runId}/manifest.json`, reason: "active run manifest" },
      { action: "retain", relative_path: `runs/${runId}/journal.ndjson`, reason: "active append-only journal" },
      { action: "retain", relative_path: `runs/${runId}/attempts`, reason: "immutable attempt history" },
    ],
    destructive_actions: 0,
    dry_run: true,
    run_id: runId,
    task_id: taskId,
  };
}

export function deriveHelperInputIdentity({ cluster, compiledInvocation, runtimeConfig }) {
  assertHelperCluster(cluster);
  assertHarnessArtifact(compiledInvocation, { artifactType: "compiled_invocation" });
  const canonicalInput = {
    cluster: structuredClone(cluster),
    compiled_invocation_sha256: compiledInvocation.content_sha256,
    runtime_config: structuredClone(runtimeConfig),
  };
  return { canonical_input: canonicalInput, helper_input_hash: sha256Canonical(canonicalInput) };
}

function analyzeRound(run, input, capabilities) {
  assertRoundInput(run, input);
  const readerResults = input.readerInvocations.flatMap((invocation) =>
    analyzeInvocation(invocation, capabilities, run.payload.adapter_id).map((result) => ({
      ...result,
      field: `${invocation.payload.unit_id}-${result.field}`,
    })),
  );
  const evaluatorResults = [
    ...analyzeInvocation(input.evaluatorStatic.invocation, capabilities, run.payload.adapter_id),
    ...analyzeEvaluatorStatic(input.evaluatorStatic),
  ];
  return {
    evaluatorPassed: evaluatorResults.every((result) => result.status === "passed"),
    evaluatorResults,
    readerPassed: readerResults.every((result) => result.status === "passed"),
    readerResults,
  };
}

function analyzeInvocation(invocation, capabilities, adapterId) {
  assertHarnessArtifact(invocation, { artifactType: "compiled_invocation" });
  const payload = invocation.payload;
  const results = [];
  results.push(compareField("adapter-id", adapterId, adapterId, capabilities.adapter_id, capabilities.adapter_id === adapterId));
  results.push(
    compareField(
      "role",
      payload.role,
      payload.role,
      capabilities.roles,
      capabilities.roles.includes(payload.role),
    ),
  );
  results.push(
    compareField(
      "runtime-class",
      payload.runtime.runtime_class,
      payload.runtime.runtime_class,
      capabilities.runtime_classes,
      capabilities.runtime_classes.includes(payload.runtime.runtime_class),
    ),
  );
  const policyMessagePresent = payload.messages.some(
    (message) => message.role === "developer" && message.content === executionPolicyMessage(payload.model_visible_policy),
  );
  results.push(
    compareField(
      "model-visible-policy",
      payload.requested_policy,
      payload.model_visible_policy,
      capabilities.exposes.model_visible_policy,
      canonicalJson(payload.requested_policy) === canonicalJson(payload.model_visible_policy) &&
        capabilities.exposes.model_visible_policy &&
        policyMessagePresent,
    ),
  );
  for (const field of policyFields) {
    const requested = payload.requested_policy[field];
    const compiled = payload.model_visible_policy[field];
    const attested = capabilities.policy[field];
    const supported = field === "fresh_context" ? attested === true && requested === true : attested.includes(requested);
    results.push(compareField(`policy-${field.replaceAll("_", "-")}`, requested, compiled, attested, requested === compiled && supported));
  }
  const toolNames = payload.tools.map((tool) => tool.name);
  results.push(
    compareField(
      "policy-tools",
      payload.requested_policy.tools,
      toolNames,
      capabilities.exposes.tool_allowlist,
      capabilities.exposes.tool_allowlist && canonicalJson(payload.requested_policy.tools) === canonicalJson(toolNames),
    ),
  );
  const resourcePaths = payload.resources.map((resource) => resource.path);
  results.push(
    compareField(
      "policy-supplied-resources",
      payload.requested_policy.supplied_resources,
      resourcePaths,
      capabilities.exposes.supplied_resources,
      capabilities.exposes.supplied_resources &&
        canonicalJson(payload.requested_policy.supplied_resources) === canonicalJson(resourcePaths),
    ),
  );
  results.push(
    compareField(
      "protocol-observation-instructions",
      true,
      payload.protocol.observation_instructions,
      capabilities.exposes.observation_protocol,
      capabilities.exposes.observation_protocol,
    ),
  );
  results.push(
    compareField(
      "protocol-output-schema",
      payload.protocol.output_schema,
      payload.protocol.output_schema,
      capabilities.output_schemas,
      capabilities.output_schemas.includes(payload.protocol.output_schema),
    ),
  );
  return results.sort((left, right) => compareStrings(left.field, right.field));
}

function analyzeEvaluatorStatic({ invocation, staticPlan }) {
  assertStaticPlan(staticPlan);
  const exactMessage = invocation.payload.messages.some(
    (message) => message.role === "developer" && message.content === evaluatorStaticPlanMessage(staticPlan),
  );
  const results = [
    compareField("static-comparison-mapping", staticPlan.comparison_mapping_sha256, exactMessage, exactMessage, exactMessage),
    compareField("static-protocol", staticPlan.protocol_sha256, exactMessage, exactMessage, exactMessage),
    compareField("static-rubric", staticPlan.rubric_sha256, exactMessage, exactMessage, exactMessage),
    compareField(
      "static-runtime-config",
      staticPlan.runtime_config_sha256,
      sha256Canonical(invocation.payload.runtime),
      staticPlan.runtime_config_sha256,
      staticPlan.runtime_config_sha256 === sha256Canonical(invocation.payload.runtime),
    ),
  ];
  return results.sort((left, right) => compareStrings(left.field, right.field));
}

function createReadinessAnalysis({
  correction,
  fieldResults,
  helperAttempts,
  invocations,
  overallPassed,
  round,
  run,
  stage,
}) {
  const sortedInvocations = [...invocations].sort((left, right) => compareStrings(left.artifact_id, right.artifact_id));
  const hashes = sortedInvocations.map((item) => item.content_sha256).sort(compareStrings);
  return createHarnessArtifact({
    artifactType: "readiness_analysis",
    artifactId: `${run.artifact_id}-${stage.replaceAll("_", "-")}-round-${round}`,
    producer: producer("readiness"),
    links: [
      link("run", run),
      ...sortedInvocations.map((item) => link("compiled_invocation", item)),
      ...helperAttempts.map((item) => link("helper_attempt", item)),
    ].sort(compareLinks),
    payload: {
      correction,
      field_results: [...fieldResults].sort((left, right) => compareStrings(left.field, right.field)),
      grants:
        overallPassed && stage === "reader"
          ? sortedInvocations
              .map((invocation) => ({
                invocation_sha256: invocation.content_sha256,
                nonce: `grant-${sha256Canonical({ hash: invocation.content_sha256, round }).slice(0, 24)}`,
                single_use: true,
                unit_id: invocation.payload.unit_id,
              }))
              .sort((left, right) => compareStrings(left.unit_id, right.unit_id))
          : [],
      helper_attempt_ids: helperAttempts.map((item) => item.payload.attempt_id).sort(compareStrings),
      invocation_hashes: hashes,
      round,
      run_id: run.artifact_id,
      stage,
      status: overallPassed ? "passed" : "blocked",
    },
  });
}

function runFixtureHelpers({ helper, now, run, task }) {
  if (helper === null || helper === undefined) {
    return {
      artifacts: [],
      attemptIds: [],
      audit: { call_count: 0, cluster_id: null, status: "not_requested" },
      terminalAttempts: [],
      unresolved: false,
    };
  }
  const { fixtureAdapter = null } = helper;
  const plan = createVerificationHelperPlan({ helper, run });
  if (plan.cluster === null || plan.maxCalls === 0) {
    return {
      artifacts: [],
      attemptIds: [],
      audit: { call_count: 0, cluster_id: plan.cluster?.cluster_id ?? null, status: plan.cluster === null ? "not_requested" : "unresolved" },
      terminalAttempts: [],
      unresolved: plan.cluster !== null,
    };
  }
  if (!fixtureAdapter || fixtureAdapter.kind !== "deterministic_fixture" || typeof fixtureAdapter.resolve !== "function") {
    fail("HELPER_AUTHORITY_REQUIRED", "CP4 can invoke only an explicit deterministic fixture helper.", 4);
  }
  const cluster = plan.cluster;
  const artifacts = [];
  const attemptIds = [];
  const terminalAttempts = [];
  let unresolved = true;
  for (const entry of plan.entries) {
    if (!unresolved) break;
    const { attemptId, identity, index, invocation } = entry;
    const common = {
      attempt_id: attemptId,
      input_sha256: identity.helper_input_hash,
      role: "verification_helper",
      run_id: run.artifact_id,
      sequence: index,
      started_at: now,
      unit_id: null,
    };
    const prepared = helperAttempt(invocation, run, `${attemptId}-prepared`, {
      ...common,
      call_certainty: "not_started",
      finished_at: null,
      outcome: null,
      phase: "prepared",
    });
    const dispatched = helperAttempt(invocation, run, `${attemptId}-dispatched`, {
      ...common,
      call_certainty: "started",
      finished_at: null,
      outcome: null,
      phase: "dispatched",
    });
    let result;
    try {
      result = fixtureAdapter.resolve(structuredClone(identity.canonical_input), index);
    } catch {
      result = { resolved: false };
    }
    const terminal = helperAttempt(invocation, run, `${attemptId}-terminal`, {
        ...common,
        call_certainty: "confirmed_finished",
        finished_at: now,
        outcome: result?.resolved === true ? "success" : "error",
        phase: "terminal",
      });
    const attempts = [prepared, dispatched, terminal];
    validateArtifactGraph([task, run, invocation, ...attempts]);
    artifacts.push(invocation, ...attempts);
    attemptIds.push(attemptId);
    terminalAttempts.push(attempts.at(-1));
    unresolved = result?.resolved !== true;
  }
  return {
    artifacts,
    attemptIds,
    audit: { call_count: attemptIds.length, cluster_id: cluster.cluster_id, status: unresolved ? "unresolved" : "resolved" },
    terminalAttempts,
    unresolved,
  };
}

function createVerificationHelperPlan({ helper, run }) {
  if (!helper || typeof helper !== "object" || Array.isArray(helper)) {
    fail("HELPER_CLUSTER_INVALID", "Readiness helper configuration is invalid.");
  }
  const { clusters = [], contract = {} } = helper;
  if (!Array.isArray(clusters) || clusters.length > 1) {
    fail("HELPER_CLUSTER_LIMIT", "Readiness helpers may address at most one uncertainty cluster.");
  }
  assertExactKeys(contract, Object.hasOwn(contract, "max_calls") ? ["max_calls"] : []);
  const maxCalls = contract.max_calls ?? 0;
  if (!Number.isInteger(maxCalls) || maxCalls < 0 || maxCalls > 2) {
    fail("HELPER_CALL_LIMIT", "Readiness helper call limit must be between 0 and 2.");
  }
  const cluster = clusters[0] ?? null;
  if (cluster === null) return { cluster, entries: [], maxCalls };
  assertHelperCluster(cluster);
  if (cluster.category !== "non_p0") fail("HELPER_P0_BYPASS", "Verification helpers cannot resolve a P0 enforcement failure.");
  const entries = [];
  for (let index = 1; index <= maxCalls; index += 1) {
    const invocation = compileInvocation({
      artifactId: `${cluster.cluster_id}-helper-${index}-invocation`,
      messages: [{ content: cluster.question, role: "user" }],
      protocol: cluster.protocol,
      requestedPolicy: cluster.requested_policy,
      resources: cluster.resources,
      role: "verification_helper",
      run,
      runtime: cluster.runtime,
      tools: [],
      unitId: `${cluster.cluster_id}-helper-${index}`,
    });
    entries.push({
      attemptId: `${cluster.cluster_id}-helper-${index}`,
      identity: deriveHelperInputIdentity({ cluster, compiledInvocation: invocation, runtimeConfig: cluster.runtime }),
      index,
      invocation,
    });
  }
  return { cluster, entries, maxCalls };
}

function validateConcreteHelperExecution({ helper, helperExecution, run, task }) {
  const plan = createVerificationHelperPlan({ helper, run });
  if (
    !helperExecution ||
    !authorizedConcreteHelperExecutions.delete(helperExecution) ||
    !Array.isArray(helperExecution.artifacts) ||
    !Array.isArray(helperExecution.terminalAttempts) ||
    typeof helperExecution.unresolved !== "boolean"
  ) {
    fail("HELPER_EXECUTION_INVALID", "Concrete helper execution evidence is incomplete.", 4);
  }
  const expectedEntries = plan.entries.slice(0, helperExecution.terminalAttempts.length);
  if (helperExecution.terminalAttempts.length > plan.maxCalls) {
    fail("HELPER_CALL_LIMIT", "Concrete helper execution exceeded its frozen call limit.", 4);
  }
  for (const [index, terminal] of helperExecution.terminalAttempts.entries()) {
    const expected = expectedEntries[index];
    assertHarnessArtifact(terminal, { artifactType: "execution_attempt" });
    if (
      !expected ||
      terminal.payload.role !== "verification_helper" ||
      terminal.payload.unit_id !== null ||
      terminal.payload.attempt_id !== expected.attemptId ||
      terminal.payload.input_sha256 !== expected.identity.helper_input_hash ||
      terminal.payload.phase !== "terminal" ||
      !terminal.links.some(
        (item) =>
          item.relationship === "compiled_invocation" &&
          item.target_content_sha256 === expected.invocation.content_sha256,
      )
    ) {
      fail("HELPER_EXECUTION_INVALID", "Concrete helper terminal evidence does not match its exact planned identity.", 4);
    }
  }
  const successful = helperExecution.terminalAttempts.some((attempt) => attempt.payload.outcome === "success");
  if (
    (plan.cluster === null && helperExecution.unresolved !== false) ||
    (plan.cluster !== null && successful === helperExecution.unresolved)
  ) {
    fail("HELPER_EXECUTION_INVALID", "Concrete helper resolved/unresolved state contradicts terminal evidence.", 4);
  }
  const audit = {
    call_count: helperExecution.terminalAttempts.length,
    cluster_id: plan.cluster?.cluster_id ?? null,
    status: plan.cluster === null ? "not_requested" : helperExecution.unresolved ? "unresolved" : "resolved",
  };
  if (canonicalJson(helperExecution.audit) !== canonicalJson(audit)) {
    fail("HELPER_EXECUTION_INVALID", "Concrete helper audit does not match exact terminal evidence.", 4);
  }
  validateArtifactGraph([task, run, ...helperExecution.artifacts]);
  return {
    artifacts: helperExecution.artifacts,
    attemptIds: helperExecution.terminalAttempts.map((attempt) => attempt.payload.attempt_id),
    audit,
    terminalAttempts: helperExecution.terminalAttempts,
    unresolved: helperExecution.unresolved,
  };
}

function recordHelperRuntimeResultIfPresent(storeRoot, runId, attemptId, terminal, leaseToken, now) {
  try {
    readRuntimeSnapshot(storeRoot, runId, attemptId);
  } catch (error) {
    if (error instanceof HarnessError && error.code === "RUNTIME_SNAPSHOT_MISSING") return;
    throw error;
  }
  recordRuntimeResultView(storeRoot, {
    attemptId,
    evidence: [],
    leaseToken,
    now,
    runId,
    status: terminal.payload.outcome === "outcome_unknown" ? "outcome_unknown" : "error",
  });
}

function helperAttempt(invocation, run, artifactId, payload) {
  return createHarnessArtifact({
    artifactType: "execution_attempt",
    artifactId,
    producer: producer("orchestrator"),
    links: [link("compiled_invocation", invocation), link("run", run)],
    payload,
  });
}

function assertRoundInput(run, input) {
  if (!input || !Array.isArray(input.readerInvocations) || !input.evaluatorStatic) {
    fail("READINESS_INPUT_INVALID", "Round input is incomplete.");
  }
  const selectedReaders = run.payload.selected_units.filter((unit) => unit.role === "reader").map((unit) => unit.unit_id).sort(compareStrings);
  const actualReaders = input.readerInvocations.map((item) => item.payload.unit_id).sort(compareStrings);
  if (canonicalJson(selectedReaders) !== canonicalJson(actualReaders)) {
    fail("READINESS_SET_INCOMPLETE", "Reader readiness must cover the complete selected reader set.");
  }
  for (const invocation of input.readerInvocations) {
    assertHarnessArtifact(invocation, { artifactType: "compiled_invocation" });
    if (invocation.payload.role !== "reader" || invocation.payload.run_id !== run.artifact_id) {
      fail("READINESS_INPUT_INVALID", "Reader invocation role or run identity is invalid.");
    }
  }
  assertHarnessArtifact(input.evaluatorStatic.invocation, { artifactType: "compiled_invocation" });
  const selectedEvaluators = run.payload.selected_units
    .filter((unit) => unit.role === "evaluator")
    .map((unit) => unit.unit_id);
  if (
    input.evaluatorStatic.invocation.payload.role !== "evaluator" ||
    input.evaluatorStatic.invocation.payload.run_id !== run.artifact_id ||
    !selectedEvaluators.includes(input.evaluatorStatic.invocation.payload.unit_id)
  ) {
    fail("EVALUATOR_STATIC_INVALID", "Evaluator static invocation must bind a selected evaluator unit in this run.");
  }
  assertStaticPlan(input.evaluatorStatic.staticPlan);
  if (!input.runtimeConfig || typeof input.runtimeConfig !== "object" || Array.isArray(input.runtimeConfig)) {
    fail("READINESS_INPUT_INVALID", "Round runtimeConfig must be an object.");
  }
  const runtimeHash = sha256Canonical(input.runtimeConfig);
  for (const invocation of [...input.readerInvocations, input.evaluatorStatic.invocation]) {
    if (sha256Canonical(invocation.payload.runtime) !== runtimeHash) {
      fail("READINESS_RUNTIME_MISMATCH", "Round runtimeConfig does not bind every exact compiled invocation.");
    }
  }
  const runLink = [...input.readerInvocations, input.evaluatorStatic.invocation].every((invocation) =>
    invocation.links.some(
      (item) => item.relationship === "run" && item.target_artifact_id === run.artifact_id && item.target_content_sha256 === run.content_sha256,
    ),
  );
  if (!runLink) fail("READINESS_INPUT_INVALID", "Compiled invocation run link is stale or missing.");
}

function assertCorrection(first, second, correction) {
  assertExactKeys(correction, ["after_sha256", "before_sha256", "changed_fields"]);
  if (
    !assertCorrectionHashes(correction.before_sha256) ||
    !assertCorrectionHashes(correction.after_sha256) ||
    !Array.isArray(correction.changed_fields) ||
    correction.changed_fields.length === 0
  ) {
    fail("READINESS_CORRECTION_INVALID", "Round 2 requires one explicit ephemeral correction diff.");
  }
  assertSortedIdentities(correction.changed_fields, "changed_fields");
  if (correction.changed_fields.some((field) => !/^runtime-parameters-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(field))) {
    fail("READINESS_CORRECTION_SCOPE", "Only ephemeral runtime.parameters fields may change before Round 2.");
  }
  if (sha256Canonical(first.runtimeConfig) !== correction.before_sha256 || sha256Canonical(second.runtimeConfig) !== correction.after_sha256) {
    fail("READINESS_CORRECTION_INVALID", "Correction hashes do not bind the two exact runtime configurations.");
  }
  const actualChangedFields = diffRuntimeParameters(first.runtimeConfig.parameters, second.runtimeConfig.parameters);
  if (canonicalJson(actualChangedFields) !== canonicalJson(correction.changed_fields)) {
    fail("READINESS_CORRECTION_INVALID", "Correction changed_fields do not match the exact runtime parameter diff.");
  }
  const firstProjection = roundDurableProjection(first);
  const secondProjection = roundDurableProjection(second);
  if (canonicalJson(firstProjection) !== canonicalJson(secondProjection)) {
    fail("READINESS_DURABLE_MUTATION", "Round 2 cannot mutate durable policy, protocol, tools, resources, rubric, or mapping.");
  }
}

function diffRuntimeParameters(before, after, prefix = "runtime-parameters") {
  const beforeRecord = before && typeof before === "object" && !Array.isArray(before);
  const afterRecord = after && typeof after === "object" && !Array.isArray(after);
  if (!beforeRecord || !afterRecord) return canonicalJson(before) === canonicalJson(after) ? [] : [prefix];
  const changed = [];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort(compareStrings);
  for (const key of keys) {
    if (!/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/.test(key)) {
      fail("READINESS_CORRECTION_INVALID", "Runtime parameter keys must map to stable kebab-case audit fields.");
    }
    const field = `${prefix}-${key.replaceAll("_", "-")}`;
    if (!Object.hasOwn(before, key) || !Object.hasOwn(after, key)) changed.push(field);
    else if (
      before[key] &&
      after[key] &&
      typeof before[key] === "object" &&
      typeof after[key] === "object" &&
      !Array.isArray(before[key]) &&
      !Array.isArray(after[key])
    ) {
      changed.push(...diffRuntimeParameters(before[key], after[key], field));
    } else if (canonicalJson(before[key]) !== canonicalJson(after[key])) changed.push(field);
  }
  return changed.sort(compareStrings);
}

function roundDurableProjection(round) {
  const project = (invocation) => ({
    ...invocation.payload,
    messages: invocation.payload.messages.map((message) => ({
      ...message,
      content: message.content.startsWith("EVALUATOR_STATIC_PLAN_V2\n") ? "EVALUATOR_STATIC_PLAN_V2\n<runtime-config-normalized>" : message.content,
    })),
    runtime: { ...invocation.payload.runtime, parameters: null },
  });
  return {
    evaluator: { invocation: project(round.evaluatorStatic.invocation), staticPlan: { ...round.evaluatorStatic.staticPlan, runtime_config_sha256: null } },
    readers: [...round.readerInvocations]
      .sort((left, right) => compareStrings(left.payload.unit_id, right.payload.unit_id))
      .map(project),
  };
}

function correctionRecordFor(correction) {
  return {
    after_sha256: correction.after_sha256,
    before_sha256: correction.before_sha256,
    changed_fields: [...correction.changed_fields].sort(compareStrings),
  };
}

function assertCorrectionHashes(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function assertCapabilities(value) {
  assertExactKeys(value, ["adapter_id", "exposes", "output_schemas", "policy", "roles", "runtime_classes"]);
  assertIdentity(value.adapter_id, "adapter_id");
  assertSortedIdentities(value.roles, "roles");
  if (value.roles.some((role) => !["evaluator", "reader", "verification_helper"].includes(role))) {
    fail("CAPABILITY_INVALID", "Adapter roles contain an unsupported role.");
  }
  assertSortedIdentities(value.runtime_classes, "runtime_classes");
  assertSortedIdentities(value.output_schemas, "output_schemas");
  assertExactKeys(value.exposes, ["model_visible_policy", "observation_protocol", "supplied_resources", "tool_allowlist"]);
  for (const enabled of Object.values(value.exposes)) if (typeof enabled !== "boolean") fail("CAPABILITY_INVALID", "Exposure capabilities must be boolean.");
  assertExactKeys(value.policy, policyFields);
  for (const field of policyFields) {
    if (field === "fresh_context") {
      if (typeof value.policy[field] !== "boolean") fail("CAPABILITY_INVALID", "fresh_context capability must be boolean.");
    } else {
      assertSortedValues(value.policy[field], `policy.${field}`);
      const allowed = {
        credentials: ["excluded", "required"],
        filesystem: ["none", "read_only", "write"],
        mutation: ["allowed", "denied"],
        network: ["denied", "required"],
        remote_actions: ["allowed", "denied"],
      }[field];
      if (value.policy[field].some((entry) => !allowed.includes(entry))) {
        fail("CAPABILITY_INVALID", `policy.${field} contains an unsupported value.`);
      }
    }
  }
}

function assertStaticPlan(value) {
  assertExactKeys(value, ["comparison_mapping_sha256", "protocol_sha256", "rubric_sha256", "runtime_config_sha256"]);
  for (const [field, hash] of Object.entries(value)) {
    if (!assertCorrectionHashes(hash)) fail("EVALUATOR_STATIC_INVALID", `${field} must be lowercase sha256.`);
  }
}

function assertHelperCluster(value) {
  assertExactKeys(value, ["category", "cluster_id", "context", "protocol", "question", "requested_policy", "resources", "runtime"]);
  assertIdentity(value.cluster_id, "cluster_id");
  if (!['non_p0', 'p0'].includes(value.category) || typeof value.question !== "string" || value.question.length === 0) {
    fail("HELPER_CLUSTER_INVALID", "Helper cluster category or question is invalid.");
  }
  if (!Array.isArray(value.context)) fail("HELPER_CLUSTER_INVALID", "Helper cluster context must be an array.");
  const labels = [];
  for (const entry of value.context) {
    assertExactKeys(entry, ["label", "sha256"]);
    assertIdentity(entry.label, "helper context label");
    if (!assertCorrectionHashes(entry.sha256)) fail("HELPER_CLUSTER_INVALID", "Helper context sha256 is invalid.");
    labels.push(entry.label);
  }
  assertSortedValues(labels, "helper context labels");
}

function compareField(field, requested, compiled, attested, passed) {
  return fieldResult(field, requested, compiled, attested, passed ? null : "Requested, compiled, and attested values do not establish the exact contract.");
}

function fieldResult(field, requested, compiled, attested, reason) {
  return { attested, compiled, field, reason, requested, status: reason === null ? "passed" : "failed" };
}

function executionPolicyMessage(policy) {
  return `EXECUTION_POLICY_V2\n${canonicalJson(policy).trimEnd()}`;
}

function evaluatorStaticPlanMessage(staticPlan) {
  return `EVALUATOR_STATIC_PLAN_V2\n${canonicalJson(staticPlan).trimEnd()}`;
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
  return compareStrings(
    `${left.relationship}:${left.target_artifact_type}:${left.target_artifact_id}`,
    `${right.relationship}:${right.target_artifact_type}:${right.target_artifact_id}`,
  );
}

function assertExactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("READINESS_INPUT_INVALID", "Expected a strict object.");
  const actual = Object.keys(value).sort(compareStrings);
  const sortedExpected = [...expected].sort(compareStrings);
  if (canonicalJson(actual) !== canonicalJson(sortedExpected)) fail("READINESS_INPUT_INVALID", "Object fields do not match the readiness contract.");
}

function assertSortedIdentities(value, label) {
  if (!Array.isArray(value)) fail("CAPABILITY_INVALID", `${label} must be an array.`);
  for (const entry of value) assertIdentity(entry, label);
  assertSortedValues(value, label);
}

function assertSortedValues(value, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) fail("CAPABILITY_INVALID", `${label} must contain strings.`);
  for (let index = 1; index < value.length; index += 1) {
    if (compareStrings(value[index - 1], value[index]) >= 0) fail("CAPABILITY_INVALID", `${label} must be sorted and unique.`);
  }
}

function assertIdentity(value, label) {
  if (typeof value !== "string" || !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(value)) {
    fail("READINESS_INPUT_INVALID", `${label} must be a normalized identity.`);
  }
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(code, message, exitCode = 1) {
  throw new HarnessError(code, message, exitCode);
}
