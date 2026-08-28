import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { canonicalJson, parseStrictJson, sha256Bytes, sha256Canonical } from "./artifact-schema-v1.mjs";
import { cp9AppServerProtocolSchemaSha256, createCodexAppServerStdioTransport } from "./codex-app-server-stdio-transport-v2.mjs";
import {
  codexChatGptAppServerAdapterId,
  codexChatGptAppServerAssuranceProfile,
  createCodexChatGptAppServerCapabilities,
} from "./codex-chatgpt-app-server-v2.mjs";
import { HarnessError, assertHarnessArtifact, createHarnessArtifact, validateArtifactGraph } from "./harness-schema-v2.mjs";
import { compileEvaluatorStaticInvocation, compileInvocation, executeReadiness } from "./readiness-v2.mjs";
import { readTaskLifecycle } from "./retention-v2.mjs";
import {
  acquireRunLease,
  createRunRecord,
  initializeRunStore,
  issueLiveDispatchAuthority,
  loadRunManifest,
  loadTaskManifest,
  readArtifactObject,
  releaseRunLease,
  transitionRun,
  writeArtifactObject,
} from "./run-store-v2.mjs";

export const cp9OutputSchemas = Object.freeze({
  "evaluator-proposal-v2": {
    additionalProperties: false,
    properties: {
      case_status: { enum: ["passed", "partially_passed", "failed", "not_run", null], type: ["string", "null"] },
      citations: {
        items: {
          additionalProperties: false,
          properties: { artifact_id: { pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$", type: "string" }, label: { type: "string" } },
          required: ["artifact_id", "label"],
          type: "object",
        },
        type: "array",
      },
      comparison_status: { enum: ["improved", "equivalent", "regressed", "inconclusive", null], type: ["string", "null"] },
      rationale: { type: "string" },
      recommendation: { enum: ["accept", "reject", "rerun"], type: "string" },
      uncertainty: { type: "string" },
    },
    required: ["case_status", "citations", "comparison_status", "rationale", "recommendation", "uncertainty"],
    type: "object",
  },
  "observation-v2": {
    additionalProperties: false,
    properties: {
      observation: {
        additionalProperties: false,
        properties: {
          execution_status: { enum: ["completed"], type: "string" },
          observed_access: {
            additionalProperties: false,
            properties: Object.fromEntries(
              ["credentials", "filesystem", "mutation", "network", "remote_actions", "tools"].map((field) => [
                field,
                { enum: ["observed", "not_observed", "unknown"], type: "string" },
              ]),
            ),
            required: ["credentials", "filesystem", "mutation", "network", "remote_actions", "tools"],
            type: "object",
          },
          raw_text: { type: "string" },
        },
        required: ["execution_status", "observed_access", "raw_text"],
        type: "object",
      },
      resources: { items: { additionalProperties: false, type: "object" }, maxItems: 0, type: "array" },
    },
    required: ["observation", "resources"],
    type: "object",
  },
  "verification-helper-v2": { additionalProperties: false, type: "object" },
});

export const cp9Admission = Object.freeze({
  adapter: codexChatGptAppServerAdapterId,
  authentication_boundary: "chatgpt_subscription",
  baseline_ref: "3fa621c86399e5c1a9e43bd9cd7b67f7b3efa52a",
  effort: "medium",
  executable_path: "C:/Users/khang/.codex/packages/standalone/releases/0.149.1-x86_64-pc-windows-msvc/bin/codex.exe",
  executable_sha256: "a395030b56b126f608f2403036dddb654a9c063213e9c2b5f85d954cf490ebe6",
  executable_version: "Codex Desktop/0.149.1 (Windows 10.0.26200; x86_64) dumb (vocaspace_skill_eval_harness; 2)",
  limits: Object.freeze({ evaluator: 12, reader: 15, total: 27, verification_helper: 0 }),
  model: "gpt-5.6-sol",
  output_schema_sha256s: Object.freeze(Object.fromEntries(
    Object.entries(cp9OutputSchemas).map(([name, schema]) => [name, sha256Canonical(schema)]),
  )),
  phase1_ref: "41de1e627479b1feb6bd60eec1073bdd1591d490",
  phase2_ref: "c3a2534b8a0c21a9276e5a6fba34f755daaf8e9e",
  turn_completion_timeout_ms: 120_000,
});

const caseDefinitions = Object.freeze([
  ["gcw-fresh-dirty-secret-stop", ".agents/evals/git-checkpoint-workflow/fresh-reader.json", "git-checkpoint-workflow"],
  ["gcw-reg-commit-versus-push", ".agents/evals/git-checkpoint-workflow/regression.json", "git-checkpoint-workflow"],
  ["gcw-route-push-remote", ".agents/evals/git-checkpoint-workflow/routing.json", "git-checkpoint-workflow"],
  ["ghci-fresh-self-fix-cycle", ".agents/evals/github-pr-ci-workflow/fresh-reader.json", "github-pr-ci-workflow"],
  ["ghci-reg-explicit-fix-exact-actions", ".agents/evals/github-pr-ci-workflow/regression.json", "github-pr-ci-workflow"],
  ["ghci-route-db-risk-stop", ".agents/evals/github-pr-ci-workflow/routing.json", "github-pr-ci-workflow"],
]);

const admittedCaseHashes = Object.freeze({
  "gcw-fresh-dirty-secret-stop": "103ceaaeb8721a973ad2626e571546f433006107cd37e8e8389674c3c4427b87",
  "gcw-reg-commit-versus-push": "13a45ece98d2693ab5f5db11d11b54af510e5117211be8866c730ef7777287de",
  "gcw-route-push-remote": "5e80db53b4031c038d5df8ca281ab83240bec29a5a33cc73d27e3699a8b00112",
  "ghci-fresh-self-fix-cycle": "baa29fb03d189bc742ebaf95c59a0437f244a4cc2a5f424a051283d6ce52f6f3",
  "ghci-reg-explicit-fix-exact-actions": "e80cc3865ffe22fc69e1be93f973145959bdde2a8eb1f4e38731b9a29920b967",
  "ghci-route-db-risk-stop": "ae6db186c7e98cf035dad904ce43b4d24c9828acac3c45a46fb94bc3163d5292",
});

const admittedSemanticSources = Object.freeze({
  ".github/workflows/ci.yml": "02142fd3015bec9529278bf749061b8cb26b187b27f5a4da32b5a3381faf0689",
  "AGENTS.md": "8dae1611da26be455a18e0016a9531b407cb93f2226b652700b55e31a2e8790f",
  "docs/agent-loops.md": "37ae354c2fe5f465131b565ba7b2e5db244ec9fcd4c98fb458dec589f6b2acc0",
});

const bundlePaths = Object.freeze({
  "git-checkpoint-workflow": Object.freeze({
    baseline: [".agents/skills/git-checkpoint-workflow/SKILL.md"],
    candidate: [
      ".agents/skills/git-checkpoint-workflow/SKILL.md",
      ".agents/skills/git-checkpoint-workflow/references/branch-start-and-sync.md",
      ".agents/skills/git-checkpoint-workflow/references/commit-and-staging.md",
      ".agents/skills/git-checkpoint-workflow/references/corrections-and-history.md",
      ".agents/skills/git-checkpoint-workflow/references/push-and-remote.md",
    ],
  }),
  "github-pr-ci-workflow": Object.freeze({
    baseline: [".agents/skills/github-pr-ci-workflow/SKILL.md"],
    candidate: [
      ".agents/skills/github-pr-ci-workflow/SKILL.md",
      ".agents/skills/github-pr-ci-workflow/references/ci-self-fix.md",
      ".agents/skills/github-pr-ci-workflow/references/ci-watch-and-triage.md",
      ".agents/skills/github-pr-ci-workflow/references/merge-and-auto-merge.md",
      ".agents/skills/github-pr-ci-workflow/references/pr-create-update.md",
    ],
  }),
});

const requestedPolicy = Object.freeze({
  credentials: "excluded",
  filesystem: "read_only",
  fresh_context: true,
  mutation: "denied",
  network: "denied",
  remote_actions: "denied",
  supplied_resources: [],
  tools: [],
});
const readerProtocol = Object.freeze({
  observation_instructions: "Return only a structured independent judgment grounded in the supplied CP9 package; do not perform actions or claim unavailable evidence.",
  output_schema: "observation-v2",
});
const evaluatorProtocol = Object.freeze({
  observation_instructions: "Evaluate only the supplied retained reader evidence against the hidden admitted rubric and return a structured proposal.",
  output_schema: "evaluator-proposal-v2",
});
const stageNames = Object.freeze(["reader-canary", "reader-phase1", "reader-phase2", "evaluator"]);

// Giữ schema v1 theo đúng contract đã emit; admission mới không được âm thầm đổi cách đọc evidence lịch sử.
const legacyPreparationV1Contract = Object.freeze({
  case_ids: Object.freeze([
    "gcw-fresh-dirty-secret-stop",
    "gcw-reg-commit-versus-push",
    "gcw-route-push-remote",
    "ghci-fresh-self-fix-cycle",
    "ghci-reg-explicit-fix-exact-actions",
    "ghci-route-db-risk-stop",
  ]),
  effort: "medium",
  executable_path: "C:/Users/khang/.codex/packages/standalone/releases/0.149.1-x86_64-pc-windows-msvc/bin/codex.exe",
  executable_sha256: "a395030b56b126f608f2403036dddb654a9c063213e9c2b5f85d954cf490ebe6",
  limits: Object.freeze({ evaluator: 12, reader: 15, total: 27, verification_helper: 0 }),
  model: "gpt-5.6-sol",
  output_schema_sha256s: Object.freeze({
    "evaluator-proposal-v2": "3802c40475cd063a67f8a4af976f2d6e0caa268f6f6939b73a9339a3ef62a649",
    "observation-v2": "443e315eb5299b66330fe5d3bc2c5d16a1d5bade82ffe50e5e54d908337410d2",
    "verification-helper-v2": "f2eebb2416e1fa287b579842e9f781464c0dddd21fb9b996db7e417f963e8b60",
  }),
  turn_completion_timeout_ms: 120_000,
});

export async function prepareCp9LivePilot({
  executable,
  executionRequest,
  now = new Date().toISOString(),
  repositoryRoot = process.cwd(),
  runtimeProbe = runPreparationPreflight,
  storeRoot,
} = {}) {
  const repository = resolve(repositoryRoot);
  assertTimestamp(now);
  const identitySha256 = cp9PreparationIdentitySha256();
  assertExecutionRequest(executionRequest, identitySha256);
  const executionRequestSha256 = sha256Canonical(executionRequest);
  const root = initializeRunStore(storeRoot ?? fail("CP9_PREPARATION_INVALID", "A canonical harness store root is required."));
  const repositoryHead = git(repository, ["rev-parse", "HEAD"]);
  assertCleanAdmittedInputs(repository);
  const cases = loadAdmittedCases(repository, repositoryHead);
  const executableArgument = normalizePath(executable);
  if (executableArgument !== cp9Admission.executable_path) {
    fail("CP9_ADMISSION_MISMATCH", "CP9 preparation requires the exact admitted standalone executable path.");
  }
  const preflight = await runtimeProbe({ executable: executableArgument });
  assertAdmittedPreflight(preflight, executableArgument);
  const runtime = createRuntime(repository, repositoryHead, preflight);
  const contract = {
    admission: cp9Admission,
    case_hashes: admittedCaseHashes,
    case_ids: caseDefinitions.map(([caseId]) => caseId),
    semantic_sources: admittedSemanticSources,
    runtime,
    workload_version: "cp9-tier1-v1",
  };
  const contractSha256 = sha256Canonical(contract);
  const taskId = `cp9-live-${identitySha256.slice(0, 24)}`;
  const runId = `${taskId}-run-${executionRequestSha256.slice(0, 24)}`;
  const preparationPath = contained(root, "runs", runId, "cp9", "preparation.json");
  if (existsSync(preparationPath)) {
    const existing = resolveCp9Preparation(root, readPreparationReference(preparationPath));
    if (
      existing.preparation.admission_contract_sha256 !== contractSha256 ||
      existing.preparation.execution_request_sha256 !== executionRequestSha256 ||
      canonicalJson(existing.preparation.execution_request) !== canonicalJson(executionRequest)
    ) {
      fail("CP9_PREPARATION_STALE", "Existing CP9 preparation differs from the current admitted runtime contract.");
    }
    return existing;
  }
  if (existsSync(contained(root, "runs", runId, "manifest.json"))) {
    fail("CP9_PREPARATION_CONFLICT", "Existing CP9 task/run state lacks the exact canonical preparation record.");
  }

  const task = loadOrCreateTask(root, { now, repository, repositoryHead, taskId });
  const selectedUnits = selectedCp9Units();
  const intent = {
    assurance_profile: codexChatGptAppServerAssuranceProfile,
    authentication_boundary: cp9Admission.authentication_boundary,
    authority_record: {
      authorized_roles: ["evaluator", "reader"],
      basis: "owner_explicit",
      live_call_limits: cp9Admission.limits,
      live_model_calls: true,
      recorded_at: now,
      scope: "Admitted CP9 Tier 1 reader/evaluator pilot only; no helper or automatic retry.",
    },
    purpose: "Measure the admitted CP9 Tier 1 skill-evaluation migration pilot.",
    selection_reason: "Frozen six-case baseline/phase1/phase2 workload admitted by the durable CP9 plan.",
  };
  const createdRun = createHarnessArtifact({
    artifactId: runId,
    artifactType: "run_manifest",
    links: [link("task", task)],
    payload: {
      adapter_id: cp9Admission.adapter,
      created_at: now,
      intent,
      revision: 0,
      run_id: runId,
      runtime_config_sha256: sha256Canonical(runtime),
      selected_units: selectedUnits,
      state: "created",
      task_id: taskId,
    },
    producer: producer("harness"),
  });
  createRunRecord(root, task, createdRun, { now });
  const lease = acquireRunLease(root, runId, { durationMs: 300_000, now, owner: "cp9-preparation" });
  let run = createdRun;
  try {
    for (const nextState of ["preflight", "readiness", "ready"]) {
      run = transitionRun(root, { expectedRevision: run.payload.revision, leaseToken: lease.token, nextState, now, runId });
    }
  } finally {
    releaseRunLease(root, runId, lease.token, { now });
  }

  const phase1 = compileWorkload({ cases, repository, repositoryHead, run, runtime, phase: "phase1" });
  const phase2 = compileWorkload({ cases, repository, repositoryHead, run, runtime, phase: "phase2" });
  const rubric = createRubric(cases);
  const comparisonMapping = createComparisonMapping();
  const staticPlan = {
    comparison_mapping_sha256: sha256Canonical(comparisonMapping),
    protocol_sha256: sha256Canonical(evaluatorProtocol),
    rubric_sha256: sha256Canonical(rubric),
    runtime_config_sha256: sha256Canonical(runtime),
  };
  const evaluatorStatic = compileEvaluatorStaticInvocation({
    artifactId: `evaluator-static-${runId}`,
    messages: [{ content: "Prepare to evaluate the admitted CP9 reader evidence only after all reader stages complete.", role: "user" }],
    protocol: evaluatorProtocol,
    requestedPolicy,
    resources: [],
    run,
    runtime,
    staticPlan,
    tools: [],
    unitId: "evaluator-gcw-fresh-dirty-secret-stop-baseline",
  });
  const readiness1 = readinessFor({ evaluatorStatic, invocations: phase1, now, run, runtime, task });
  const readiness2 = readinessFor({ evaluatorStatic, invocations: phase2, now, run, runtime, task });
  const artifacts = [...phase1, ...phase2, evaluatorStatic, ...readiness1.artifacts, ...readiness2.artifacts];
  for (const artifact of uniqueArtifacts(artifacts)) writeArtifactObject(root, artifact);

  const common = {
    baseline_ref: cp9Admission.baseline_ref,
    case_ids: caseDefinitions.map(([caseId]) => caseId),
    evaluator_static_invocation_sha256: evaluatorStatic.content_sha256,
    evaluator_static_readiness_sha256: readiness1.analyses.at(-1).evaluator_static.content_sha256,
    phase1_ref: cp9Admission.phase1_ref,
    phase2_ref: cp9Admission.phase2_ref,
    plan_version: "cp9-live-plan-v1",
    run_id: runId,
    supporting_artifact_sha256s: [],
    task_id: taskId,
  };
  const plans = stageNames.map((stage) => {
    const finalPhase = ["reader-phase2", "evaluator"].includes(stage);
    const ready = finalPhase ? readiness2 : readiness1;
    return {
      ...common,
      evaluator: stage === "evaluator" ? {
        comparison_mapping: comparisonMapping,
        protocol: evaluatorProtocol,
        requested_policy: requestedPolicy,
        rubric,
        runtime,
        tools: [],
      } : null,
      evaluator_static_readiness_sha256: ready.analyses.at(-1).evaluator_static.content_sha256,
      reader_invocation_sha256s: (finalPhase ? phase2 : phase1).map((item) => item.content_sha256).sort(),
      reader_readiness_sha256: ready.analyses.at(-1).reader.content_sha256,
      stage,
    };
  });
  const planEntries = plans.map((plan) => {
    const relativePath = `runs/${runId}/cp9/plans/${plan.stage}.json`;
    writeImmutableJson(contained(root, ...relativePath.split("/")), plan);
    return { content_sha256: sha256Canonical(plan), relative_path: relativePath, stage: plan.stage };
  });
  const grantTemplate = grantTemplateFor(run, contractSha256);
  const envelope = {
    admission_contract_sha256: contractSha256,
    case_ids: caseDefinitions.map(([caseId]) => caseId),
    executable_path: executableArgument,
    executable_sha256: cp9Admission.executable_sha256,
    execution_request: structuredClone(executionRequest),
    execution_request_sha256: executionRequestSha256,
    live_call_limits: cp9Admission.limits,
    model: cp9Admission.model,
    output_schema_sha256s: cp9Admission.output_schema_sha256s,
    effort: cp9Admission.effort,
    plan_entries: planEntries,
    preparation_identity_sha256: identitySha256,
    preparation_version: "cp9-live-preparation-v2",
    prepared_at: now,
    repository_head: repositoryHead,
    run_content_sha256: run.content_sha256,
    run_id: runId,
    runtime_config_sha256: run.payload.runtime_config_sha256,
    task_id: taskId,
    turn_completion_timeout_ms: cp9Admission.turn_completion_timeout_ms,
    grant_template_sha256: sha256Canonical(grantTemplate),
  };
  const preparation = { ...envelope, preparation_sha256: sha256Canonical(envelope) };
  writeImmutableJson(preparationPath, preparation);
  return resolvedPreparation(root, preparation);
}

async function runPreparationPreflight({ executable }) {
  const transport = createCodexAppServerStdioTransport({ executable });
  try {
    return await transport.preflight();
  } finally {
    await transport.close();
  }
}

export function resolveCp9Preparation(root, reference) {
  const preparation = readCp9PreparationRecord(root, reference);
  assertCurrentPreparationContract(preparation);
  const task = loadTaskManifest(root, preparation.task_id);
  const currentRun = loadRunManifest(root, preparation.run_id);
  const preparedRun = readArtifactObject(root, preparation.run_content_sha256);
  if (
    task.content_sha256 !== currentRun.links.find((item) => item.relationship === "task")?.target_content_sha256 ||
    preparedRun.artifact_id !== currentRun.artifact_id ||
    canonicalJson(runSemanticProjection(preparedRun)) !== canonicalJson(runSemanticProjection(currentRun)) ||
    preparation.runtime_config_sha256 !== currentRun.payload.runtime_config_sha256 ||
    preparedRun.payload.state !== "ready" ||
    preparedRun.payload.revision !== 3 ||
    canonicalJson(preparedRun.payload.selected_units) !== canonicalJson(selectedCp9Units()) ||
    canonicalJson(preparedRun.payload.intent?.authority_record?.live_call_limits) !== canonicalJson(cp9Admission.limits) ||
    canonicalJson(preparedRun.payload.intent?.authority_record?.authorized_roles) !== canonicalJson(["evaluator", "reader"])
  ) fail("CP9_PREPARATION_STALE", "Canonical CP9 task/run state no longer matches its prepared semantic identity.");
  const plans = preparation.plan_entries.map((entry) => {
    const planPath = contained(root, ...entry.relative_path.split("/"));
    const plan = parseStrictJson(readFileSync(planPath), `CP9 ${entry.stage} plan`);
    if (
      sha256Canonical(plan) !== entry.content_sha256 ||
      plan.stage !== entry.stage ||
      plan.run_id !== preparation.run_id ||
      plan.task_id !== preparation.task_id ||
      plan.baseline_ref !== cp9Admission.baseline_ref ||
      plan.phase1_ref !== cp9Admission.phase1_ref ||
      plan.phase2_ref !== cp9Admission.phase2_ref ||
      canonicalJson(plan.case_ids) !== canonicalJson(caseDefinitions.map(([caseId]) => caseId))
    ) {
      fail("CP9_PREPARATION_STALE", "Canonical CP9 plan bytes differ from the preparation record.");
    }
    return { entry, path: planPath, plan };
  });
  for (const item of plans) validatePreparedPlanClosure(root, { plan: item.plan, preparedRun, task });
  return { plans, preparation: structuredClone(preparation), reference: preparationReference(preparation) };
}

export function readCp9PreparationRecord(root, reference) {
  assertPreparationReference(reference);
  const path = contained(root, "runs", reference.run_id, "cp9", "preparation.json");
  if (!existsSync(path)) fail("CP9_PREPARATION_UNRESOLVED", "Canonical CP9 preparation record does not exist.");
  const preparation = parseStrictJson(readFileSync(path), "CP9 preparation record");
  assertPreparationRecord(preparation);
  const envelope = { ...preparation };
  delete envelope.preparation_sha256;
  if (
    sha256Canonical(envelope) !== preparation.preparation_sha256 ||
    canonicalJson(preparationReference(preparation)) !== canonicalJson(reference)
  ) fail("CP9_PREPARATION_UNRESOLVED", "CP9 preparation record or reference integrity is invalid.");
  return structuredClone(preparation);
}

export function assertPreparedCp9LivePlan(root, plan) {
  const reference = { preparation_sha256: null, run_id: plan?.run_id, task_id: plan?.task_id };
  const path = contained(root, "runs", reference.run_id, "cp9", "preparation.json");
  if (!existsSync(path)) fail("CP9_PREPARATION_REQUIRED", "CP9 live requires canonical prepared plan and authority inputs.");
  reference.preparation_sha256 = parseStrictJson(readFileSync(path), "CP9 preparation record").preparation_sha256;
  const resolved = resolveCp9Preparation(root, reference);
  const match = resolved.plans.find((item) => item.plan.stage === plan.stage);
  if (!match || canonicalJson(match.plan) !== canonicalJson(plan)) {
    fail("CP9_PLAN_NOT_PREPARED", "CP9 live plan is not the exact canonical prepared stage plan.");
  }
  return { preparation: resolved.preparation, run: readArtifactObject(root, resolved.preparation.run_content_sha256) };
}

export function createPreparedCp9LiveGrant(root, preparationReferenceValue, { now = new Date().toISOString() } = {}) {
  assertTimestamp(now);
  const resolved = resolveCp9Preparation(root, preparationReferenceValue);
  const run = loadRunManifest(root, resolved.preparation.run_id);
  const template = grantTemplateFor(run, resolved.preparation.admission_contract_sha256);
  if (sha256Canonical(template) !== resolved.preparation.grant_template_sha256) {
    fail("CP9_PREPARATION_STALE", "Prepared CP9 grant template no longer matches canonical run intent.");
  }
  return { ...template, issued_at: now };
}

export function assertPreparedCp9LiveGrant(prepared, grant) {
  const template = grantTemplateFor(prepared.run, prepared.preparation.admission_contract_sha256);
  const candidate = grant && typeof grant === "object" ? { ...grant, issued_at: null } : grant;
  if (
    sha256Canonical(template) !== prepared.preparation.grant_template_sha256 ||
    canonicalJson(candidate) !== canonicalJson(template)
  ) {
    fail("CP9_AUTHORITY_NOT_PREPARED", "Resolved live authority is not the exact grant owned by the canonical CP9 preparation.");
  }
  return grant;
}

export function issuePreparedCp9LiveAuthority(root, {
  authorityVerifier,
  issuanceAuthority,
  now = new Date().toISOString(),
  preparationReference: preparationReferenceValue,
} = {}) {
  const grant = createPreparedCp9LiveGrant(root, preparationReferenceValue, { now });
  return issueLiveDispatchAuthority(root, { authorityVerifier, grant, issuanceAuthority, now });
}

function compileWorkload({ cases, repository, repositoryHead, run, runtime, phase }) {
  return cases.flatMap(({ caseDefinition, caseId, skill }) => ["baseline", "candidate"].map((variant) => {
    const ref = variant === "baseline"
      ? cp9Admission.baseline_ref
      : skill === "git-checkpoint-workflow" || phase === "phase1"
        ? cp9Admission.phase1_ref
        : cp9Admission.phase2_ref;
    const bundleKind = variant === "candidate" && (skill === "git-checkpoint-workflow" || phase === "phase2") ? "candidate" : "baseline";
    const bundle = bundlePaths[skill][bundleKind].map((path) => ({ content: gitShow(repository, ref, path), path, sha256: sha256Bytes(Buffer.from(gitShow(repository, ref, path), "utf8")) }));
    const context = caseDefinition.executor_input.context.map((entry) => entry.source_type === "repository_file"
      ? { ...entry, content: gitShow(repository, repositoryHead, entry.path), sha256: sha256Bytes(Buffer.from(gitShow(repository, repositoryHead, entry.path), "utf8")) }
      : structuredClone(entry));
    const content = `CP9_EXECUTOR_PACKAGE_V1\n${canonicalJson({ bundle, case_id: caseId, context, prompt: caseDefinition.executor_input.prompt, skill }).trimEnd()}`;
    return compileInvocation({
      artifactId: `reader-${caseId}-${variant}`,
      messages: [{ content, role: "user" }],
      protocol: readerProtocol,
      requestedPolicy,
      resources: [],
      role: "reader",
      run,
      runtime,
      tools: [],
      unitId: `reader-${caseId}-${variant}`,
    });
  })).sort((left, right) => left.payload.unit_id.localeCompare(right.payload.unit_id));
}

function readinessFor({ evaluatorStatic, invocations, now, run, runtime, task }) {
  const result = executeReadiness({
    adapterCapabilities: createCodexChatGptAppServerCapabilities(),
    now,
    rounds: [{ evaluatorStatic: { invocation: evaluatorStatic, staticPlan: parseCp9StaticPlan(evaluatorStatic) }, readerInvocations: invocations, runtimeConfig: runtime }],
    run,
    task,
  });
  if (result.status !== "passed" || result.helper.call_count !== 0) fail("CP9_READINESS_BLOCKED", "Prepared CP9 readiness did not pass without helpers.");
  return result;
}

function createRuntime(repository, head, preflight) {
  const instructionPath = realpathSync(resolve(repository, "AGENTS.md"));
  if (!statSync(instructionPath).isFile()) fail("CP9_ADMISSION_MISMATCH", "CP9 instruction source must be a regular working-tree file.");
  const instructionBytes = readFileSync(instructionPath);
  assertAdmittedInstructionSourceBytes(repository, head, instructionBytes);
  assertCleanAdmittedInputs(repository);
  const behaviorRuntime = {
    adapter_id: cp9Admission.adapter,
    adapter_version: "2",
    assurance_profile: codexChatGptAppServerAssuranceProfile,
    auth_mode: "chatgpt",
    capability_limitations: [
      "complete-model-visible-envelope-opaque",
      "provider-request-identity-opaque",
      "provider-side-idempotency-opaque",
      "turn-outcome-lookup-unsupported",
      "upstream-provider-envelope-opaque",
    ],
    codex_version: preflight.codex_version,
    config_sha256: preflight.config_sha256,
    effective_policy: requestedPolicy,
    effort: cp9Admission.effort,
    executable_path: normalizePath(preflight.executable_path),
    executable_sha256: preflight.executable_sha256,
    fresh_context_method: "new-app-server-thread",
    instruction_sources: [{ path: normalizePath(instructionPath), sha256: sha256Bytes(instructionBytes) }],
    model: cp9Admission.model,
    platform: preflight.platform,
    protocol_schema_sha256: cp9AppServerProtocolSchemaSha256,
    runtime_identity: `codex-app-server-${preflight.executable_sha256.slice(0, 24)}`,
    transport: "stdio-jsonl",
  };
  return {
    behavior_runtime: behaviorRuntime,
    model: cp9Admission.model,
    parameters: { approval_policy: "never", cwd: normalizePath(repository), effort: cp9Admission.effort, sandbox_policy: "read-only", settings: { personality: "none" } },
    provider: "codex-chatgpt",
    runtime_class: "codex-app-server",
  };
}

function loadAdmittedCases(repository, head) {
  const cases = caseDefinitions.map(([caseId, suitePath, skill]) => {
    const suite = parseStrictJson(Buffer.from(gitShow(repository, head, suitePath), "utf8"), suitePath);
    const caseDefinition = suite.cases?.find((entry) => entry.case_id === caseId);
    if (!caseDefinition || sha256Canonical(caseDefinition) !== admittedCaseHashes[caseId]) {
      fail("CP9_ADMISSION_MISMATCH", `Admitted CP9 case '${caseId}' is missing or changed.`);
    }
    return { caseDefinition, caseId, skill };
  });
  const observedSources = Object.fromEntries([...new Set(cases.flatMap(({ caseDefinition }) =>
    caseDefinition.executor_input.context.filter((entry) => entry.source_type === "repository_file").map((entry) => entry.path),
  ))].sort().map((path) => [path, sha256Bytes(Buffer.from(gitShow(repository, head, path), "utf8"))]));
  if (canonicalJson(observedSources) !== canonicalJson(admittedSemanticSources)) {
    fail("CP9_ADMISSION_MISMATCH", "Committed CP9 repository-file context differs from the admitted semantic source manifest.");
  }
  return cases;
}

function assertCleanAdmittedInputs(repository) {
  const protectedPaths = ["AGENTS.md", ...new Set(caseDefinitions.map((entry) => entry[1])), ...Object.values(bundlePaths).flatMap((entry) => [...entry.baseline, ...entry.candidate])];
  const dirty = git(repository, ["status", "--porcelain=v1", "--", ...protectedPaths]);
  if (dirty) fail("CP9_ADMISSION_MISMATCH", "Admitted CP9 suite, context, or bundle inputs have uncommitted changes.");
}

function assertAdmittedInstructionSourceBytes(repository, head, workingTreeBytes) {
  const committedBytes = gitShowBytes(repository, head, "AGENTS.md");
  const crlfBytes = expandBareLfToCrLf(committedBytes);
  if (!workingTreeBytes.equals(committedBytes) && !workingTreeBytes.equals(crlfBytes)) {
    fail("CP9_ADMISSION_MISMATCH", "CP9 instruction source bytes differ from the exact admitted commit.");
  }
}

function expandBareLfToCrLf(bytes) {
  const expanded = [];
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] === 10 && (index === 0 || bytes[index - 1] !== 13)) expanded.push(13);
    expanded.push(bytes[index]);
  }
  return Buffer.from(expanded);
}

function assertAdmittedPreflight(value, executable) {
  if (!value || value.model_calls_dispatched !== 0 || value.thread_creation !== "not_started" || value.turn_dispatch !== "not_started" || value.protocol_readiness !== "ready" || value.account_type !== "chatgpt" || value.model !== cp9Admission.model || value.effort !== cp9Admission.effort || !/^[a-f0-9]{64}$/.test(value.config_sha256 ?? "") || normalizePath(value.executable_path) !== executable || value.executable_sha256 !== cp9Admission.executable_sha256 || value.codex_version !== cp9Admission.executable_version) {
    fail("CP9_ADMISSION_MISMATCH", "CP9 non-model preflight differs from the admitted runtime contract.");
  }
}

function selectedCp9Units() {
  return caseDefinitions.flatMap(([caseId, suitePath]) => ["baseline", "candidate"].flatMap((variant) => ["evaluator", "reader"].map((role) => ({
    case_id: caseId,
    role,
    suite: suitePath.split("/").at(-1).replace(".json", ""),
    unit_id: `${role}-${caseId}-${variant}`,
    variant,
  })))).sort((left, right) => left.unit_id.localeCompare(right.unit_id));
}

function createRubric(cases) {
  return { cases: cases.map(({ caseDefinition, caseId }) => ({ case_id: caseId, ...structuredClone(caseDefinition.evaluator_only) })), rubric_version: "cp9-tier1-rubric-v1" };
}

function createComparisonMapping() {
  return {
    interpretation: "Historical baselines are contextual only; this run is a single-observation migration pilot, not a live A/B benchmark.",
    mapping_version: "cp9-tier1-comparison-v1",
    pairs: caseDefinitions.flatMap(([caseId]) => ["baseline", "candidate"].map((variant) => ({ evaluator_unit_id: `evaluator-${caseId}-${variant}`, reader_unit_id: `reader-${caseId}-${variant}` }))),
  };
}

function grantTemplateFor(run, contractSha256) {
  return {
    assurance_profile: run.payload.intent.assurance_profile,
    authentication_boundary: run.payload.intent.authentication_boundary,
    authorized_roles: run.payload.intent.authority_record.authorized_roles,
    grant_id: `cp9-live-${contractSha256.slice(0, 24)}`,
    issued_at: null,
    issuer: "cp9-preparation-owner",
    live_call_limits: run.payload.intent.authority_record.live_call_limits,
    run_id: run.artifact_id,
    runtime_config_sha256: run.payload.runtime_config_sha256,
    task_id: run.payload.task_id,
  };
}

export function parseCp9StaticPlan(invocation) {
  const message = invocation.payload.messages.find((entry) => entry.content.startsWith("EVALUATOR_STATIC_PLAN_V2\n"));
  try {
    return JSON.parse(message.content.slice("EVALUATOR_STATIC_PLAN_V2\n".length));
  } catch {
    fail("CP9_READINESS_BLOCKED", "Evaluator static plan bytes are malformed.");
  }
}

function validatePreparedPlanClosure(root, { plan, preparedRun, task }) {
  const readerInvocations = plan.reader_invocation_sha256s.map((hash) => readPreparedArtifact(root, hash, "compiled_invocation"));
  const evaluatorStatic = readPreparedArtifact(root, plan.evaluator_static_invocation_sha256, "compiled_invocation");
  const readerReadiness = readPreparedArtifact(root, plan.reader_readiness_sha256, "readiness_analysis");
  const evaluatorReadiness = readPreparedArtifact(root, plan.evaluator_static_readiness_sha256, "readiness_analysis");
  const supporting = plan.supporting_artifact_sha256s.map((hash) => readPreparedArtifact(root, hash));
  const expectedReaderIds = selectedCp9Units().filter((unit) => unit.role === "reader").map((unit) => unit.unit_id).sort();
  const actualReaderIds = readerInvocations.map((artifact) => artifact.payload.unit_id).sort();
  if (
    canonicalJson(actualReaderIds) !== canonicalJson(expectedReaderIds) ||
    readerInvocations.some((artifact) => artifact.payload.role !== "reader" || artifact.payload.run_id !== preparedRun.artifact_id) ||
    evaluatorStatic.payload.role !== "evaluator" ||
    evaluatorStatic.payload.run_id !== preparedRun.artifact_id ||
    readerReadiness.payload.run_id !== preparedRun.artifact_id ||
    readerReadiness.payload.stage !== "reader" ||
    readerReadiness.payload.status !== "passed" ||
    evaluatorReadiness.payload.run_id !== preparedRun.artifact_id ||
    evaluatorReadiness.payload.stage !== "evaluator_static" ||
    evaluatorReadiness.payload.status !== "passed" ||
    canonicalJson(readerReadiness.payload.invocation_hashes) !== canonicalJson([...plan.reader_invocation_sha256s].sort()) ||
    canonicalJson(evaluatorReadiness.payload.invocation_hashes) !== canonicalJson([plan.evaluator_static_invocation_sha256])
  ) {
    fail("CP9_PREPARATION_STALE", "Canonical CP9 invocation/readiness closure differs from the prepared run and workload.");
  }
  try {
    validateArtifactGraph([task, preparedRun, ...readerInvocations, evaluatorStatic, readerReadiness, evaluatorReadiness, ...supporting]);
  } catch {
    fail("CP9_PREPARATION_STALE", "Canonical CP9 plan artifact graph is missing, stale, or owned by another run.");
  }
}

function readPreparedArtifact(root, hash, artifactType) {
  try {
    return assertHarnessArtifact(readArtifactObject(root, hash), artifactType ? { artifactType } : {});
  } catch {
    fail("CP9_PREPARATION_STALE", "Canonical CP9 plan artifact closure is missing or corrupt.");
  }
}

function resolvedPreparation(root, preparation) {
  return resolveCp9Preparation(root, preparationReference(preparation));
}

function preparationReference(value) {
  return { preparation_sha256: value.preparation_sha256, run_id: value.run_id, task_id: value.task_id };
}

function readPreparationReference(path) {
  return preparationReference(parseStrictJson(readFileSync(path), "CP9 preparation record"));
}

function assertPreparationReference(value) {
  if (!value || canonicalJson(Object.keys(value).sort()) !== canonicalJson(["preparation_sha256", "run_id", "task_id"]) || !/^[a-f0-9]{64}$/.test(value.preparation_sha256 ?? "")) {
    fail("CP9_PREPARATION_UNRESOLVED", "CP9 preparation reference has an invalid exact schema.");
  }
}

function assertPreparationRecord(value) {
  const commonKeys = [
    "admission_contract_sha256", "case_ids", "effort", "executable_path", "executable_sha256",
    "grant_template_sha256", "live_call_limits", "model", "output_schema_sha256s", "plan_entries", "preparation_sha256",
    "preparation_version", "prepared_at", "repository_head", "run_content_sha256", "run_id",
    "runtime_config_sha256", "task_id", "turn_completion_timeout_ms",
  ];
  const version = value?.preparation_version;
  const recordContract = version === "cp9-live-preparation-v1"
    ? legacyPreparationV1Contract
    : currentPreparationRecordContract();
  const keys = version === "cp9-live-preparation-v1"
    ? commonKeys
    : version === "cp9-live-preparation-v2"
      ? [...commonKeys, "execution_request", "execution_request_sha256", "preparation_identity_sha256"]
      : [];
  if (
    !value ||
    canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort()) ||
    value.executable_path !== recordContract.executable_path ||
    value.executable_sha256 !== recordContract.executable_sha256 ||
    value.model !== recordContract.model ||
    value.effort !== recordContract.effort ||
    canonicalJson(value.output_schema_sha256s) !== canonicalJson(recordContract.output_schema_sha256s) ||
    value.turn_completion_timeout_ms !== recordContract.turn_completion_timeout_ms ||
    canonicalJson(value.live_call_limits) !== canonicalJson(recordContract.limits) ||
    canonicalJson(value.case_ids) !== canonicalJson(recordContract.case_ids) ||
    !/^[a-f0-9]{40}$/.test(value.repository_head ?? "") ||
    !/^[a-f0-9]{64}$/.test(value.admission_contract_sha256 ?? "") ||
    (version === "cp9-live-preparation-v1"
      ? !/^cp9-live-[a-f0-9]{24}$/.test(value.task_id ?? "")
      : value.task_id !== recordContract.task_id) ||
    !/^[a-f0-9]{64}$/.test(value.run_content_sha256 ?? "") ||
    !/^[a-f0-9]{64}$/.test(value.runtime_config_sha256 ?? "") ||
    !/^[a-f0-9]{64}$/.test(value.grant_template_sha256 ?? "") ||
    !Array.isArray(value.plan_entries) ||
    canonicalJson(value.plan_entries.map((entry) => entry.stage)) !== canonicalJson(stageNames) ||
    value.plan_entries.some((entry) =>
      !entry ||
      canonicalJson(Object.keys(entry).sort()) !== canonicalJson(["content_sha256", "relative_path", "stage"]) ||
      entry.relative_path !== `runs/${value.run_id}/cp9/plans/${entry.stage}.json` ||
      !/^[a-f0-9]{64}$/.test(entry.content_sha256 ?? "")
    )
  ) fail("CP9_PREPARATION_UNRESOLVED", "CP9 preparation record does not match the exact admitted contract.");
  if (version === "cp9-live-preparation-v1") {
    if (value.run_id !== `${value.task_id}-run`) {
      fail("CP9_PREPARATION_UNRESOLVED", "Legacy CP9 preparation does not match its historical single-run identity.");
    }
  } else {
    const identitySha256 = cp9PreparationIdentitySha256();
    assertExecutionRequest(value.execution_request, identitySha256);
    const executionRequestSha256 = sha256Canonical(value.execution_request);
    if (
      value.preparation_identity_sha256 !== identitySha256 ||
      value.execution_request_sha256 !== executionRequestSha256 ||
      value.run_id !== `${value.task_id}-run-${executionRequestSha256.slice(0, 24)}`
    ) {
      fail("CP9_PREPARATION_UNRESOLVED", "CP9 preparation does not match its exact execution-request identity.");
    }
  }
  assertTimestamp(value.prepared_at);
}

function currentPreparationRecordContract() {
  return {
    case_ids: caseDefinitions.map(([caseId]) => caseId),
    effort: cp9Admission.effort,
    executable_path: cp9Admission.executable_path,
    executable_sha256: cp9Admission.executable_sha256,
    limits: cp9Admission.limits,
    model: cp9Admission.model,
    output_schema_sha256s: cp9Admission.output_schema_sha256s,
    task_id: `cp9-live-${cp9PreparationIdentitySha256().slice(0, 24)}`,
    turn_completion_timeout_ms: cp9Admission.turn_completion_timeout_ms,
  };
}

function assertCurrentPreparationContract(value) {
  const current = currentPreparationRecordContract();
  if (
    value.task_id !== current.task_id ||
    value.executable_path !== current.executable_path ||
    value.executable_sha256 !== current.executable_sha256 ||
    value.model !== current.model ||
    value.effort !== current.effort ||
    canonicalJson(value.output_schema_sha256s) !== canonicalJson(current.output_schema_sha256s) ||
    value.turn_completion_timeout_ms !== current.turn_completion_timeout_ms ||
    canonicalJson(value.live_call_limits) !== canonicalJson(current.limits) ||
    canonicalJson(value.case_ids) !== canonicalJson(current.case_ids)
  ) {
    fail("CP9_PREPARATION_STALE", "Historical CP9 preparation is readable but does not authorize the current execution contract.");
  }
}

function assertExecutionRequest(value, preparationIdentitySha256Value) {
  if (
    !value ||
    canonicalJson(Object.keys(value).sort()) !== canonicalJson(["execution_request_id", "preparation_identity_sha256", "request_version"]) ||
    value.request_version !== "cp9-live-execution-request-v1" ||
    value.preparation_identity_sha256 !== preparationIdentitySha256Value ||
    typeof value.execution_request_id !== "string" ||
    value.execution_request_id.length > 128 ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.execution_request_id)
  ) {
    fail("CP9_EXECUTION_REQUEST_INVALID", "CP9 preparation requires an exact execution request bound to the current preparation identity.");
  }
}

export function cp9PreparationIdentitySha256() {
  return sha256Canonical({
    admission: cp9Admission,
    case_hashes: admittedCaseHashes,
    case_ids: caseDefinitions.map(([caseId]) => caseId),
    semantic_sources: admittedSemanticSources,
    workload_version: "cp9-tier1-v1",
  });
}

function runSemanticProjection(run) {
  return { adapter_id: run.payload.adapter_id, intent: run.payload.intent, run_id: run.payload.run_id, runtime_config_sha256: run.payload.runtime_config_sha256, selected_units: run.payload.selected_units, task_id: run.payload.task_id };
}

function uniqueArtifacts(values) {
  return [...new Map(values.map((item) => [item.content_sha256, item])).values()];
}

function loadOrCreateTask(root, { now, repository, repositoryHead, taskId }) {
  const taskPath = contained(root, "tasks", taskId, "task.json");
  if (existsSync(taskPath)) {
    const lifecycle = readTaskLifecycle(root, taskId);
    if (lifecycle.state !== "active") {
      fail("CP9_PREPARATION_CONFLICT", "Fresh CP9 execution requires the existing preparation task to remain active.");
    }
    return lifecycle.task;
  }
  return createHarnessArtifact({
    artifactId: taskId,
    artifactType: "task_manifest",
    payload: {
      created_at: now,
      lifecycle: "active",
      provenance: { branch: git(repository, ["branch", "--show-current"]) || null, commit: sha256Canonical({ git_commit: repositoryHead }), pull_request: null },
      retention_policy_version: "retention-v2",
      task_id: taskId,
    },
    producer: producer("operator"),
  });
}

function writeImmutableJson(path, value) {
  const bytes = canonicalJson(value);
  mkdirSync(dirname(path), { recursive: true });
  if (existsSync(path)) {
    if (readFileSync(path, "utf8") !== bytes) fail("CP9_PREPARATION_CONFLICT", "Existing canonical CP9 preparation bytes conflict.");
    return;
  }
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = openSync(temporary, "wx");
    writeFileSync(handle, bytes, "utf8");
    fsyncSync(handle);
    closeSync(handle);
    handle = undefined;
    if (existsSync(path)) {
      if (readFileSync(path, "utf8") === bytes) return;
      fail("CP9_PREPARATION_CONFLICT", "Existing canonical CP9 preparation bytes conflict.");
    }
    renameSync(temporary, path);
  } catch (error) {
    if (error?.code === "EEXIST" && existsSync(path) && readFileSync(path, "utf8") === bytes) return;
    throw error;
  } finally {
    if (handle !== undefined) closeSync(handle);
    if (existsSync(temporary)) rmSync(temporary);
  }
}

function contained(root, ...segments) {
  const base = resolve(root);
  const candidate = resolve(base, ...segments);
  const relation = relative(base, candidate);
  if (relation === "" || relation.startsWith("..") || isAbsolute(relation)) fail("CP9_PREPARATION_INVALID", "CP9 preparation path escaped the store root.");
  return candidate;
}

function git(repository, args) {
  try {
    return execFileSync("git", args, { cwd: repository, encoding: "utf8", windowsHide: true }).trim();
  } catch {
    fail("CP9_REPOSITORY_INVALID", "Unable to resolve exact CP9 repository state.");
  }
}

function gitShow(repository, ref, path) {
  try {
    return execFileSync("git", ["show", `${ref}:${path}`], { cwd: repository, encoding: "utf8", maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  } catch {
    fail("CP9_ADMISSION_MISMATCH", `Required admitted CP9 source '${ref}:${path}' is unavailable.`);
  }
}

function gitShowBytes(repository, ref, path) {
  try {
    return execFileSync("git", ["show", `${ref}:${path}`], { cwd: repository, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  } catch {
    fail("CP9_ADMISSION_MISMATCH", `Required admitted CP9 source '${ref}:${path}' is unavailable.`);
  }
}

function normalizePath(value) {
  if (typeof value !== "string" || value.length === 0) fail("CP9_ADMISSION_MISMATCH", "CP9 executable path is required.");
  return value.replaceAll("\\", "/");
}

function assertTimestamp(value) {
  const parsed = typeof value === "string" ? new Date(value) : new Date(Number.NaN);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) fail("CP9_PREPARATION_INVALID", "CP9 preparation timestamp is invalid.");
}

function producer(name) {
  return { kind: "harness", name, version: "2" };
}

function link(relationship, artifact) {
  return { relationship, target_artifact_id: artifact.artifact_id, target_artifact_type: artifact.artifact_type, target_content_sha256: artifact.content_sha256 };
}

function fail(code, message) {
  throw new HarnessError(code, message, 4);
}
