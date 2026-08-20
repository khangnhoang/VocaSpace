// Test plan:
// - Mục tiêu: kiểm tra schema/relationship v2 nghiêm ngặt và compatibility routing của eval harness.
// - Loại test: Node schema/unit/CLI black-box.
// - Đối tượng: `harness-schema-v2.mjs` và `run-skill-eval-harness.mjs`.
// - Case thành công: mọi artifact v2, canonical hash/link graph, summary partitions và read-only CLI validation.
// - Case thất bại: wrong version/type/producer/hash/link, unknown field, contradictory totals và unsafe renderer link.
// - Bảo mật/phân quyền: model không được sản xuất `human_evaluation`; review text/link contract fail closed.
// - Ổn định/resilience: version routing không coerce v1 và canonical bytes/hash deterministic.
// - Invariant cần giữ: invalid artifact không thể trở thành valid evidence hoặc che missing evidence thành `not_run`.
// - Kết quả verify gần nhất: passed 42 tests bằng `node --test .agents/scripts/run-skill-eval-harness.test.mjs`.
// - Ghi chú: test chỉ dùng local deterministic fixtures, không có model/provider call.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256Canonical } from "./lib/skill-evals/artifact-schema-v1.mjs";
import {
  HarnessError,
  assertHarnessArtifact,
  canonicalHarnessJson,
  createHarnessArtifact,
  routeArtifactVersion,
  validateArtifactGraph,
} from "./lib/skill-evals/harness-schema-v2.mjs";
import {
  classifyDependencyChanges,
  classifyDependencyPath,
  classifyIdentityImpact,
  deriveAcceptanceInputIdentity,
  deriveEvaluatorInputIdentity,
  deriveReaderInputIdentity,
} from "./lib/skill-evals/logical-identity-v2.mjs";

const cliPath = fileURLToPath(new URL("./run-skill-eval-harness.mjs", import.meta.url));
const roots = [];
const hashA = "a".repeat(64);
const timestamp = "2026-08-20T00:00:00.000Z";

test.after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

test("schema v2 validates every planned artifact and its exact relationship graph", () => {
  const fixture = createGraphFixture();

  const validated = validateArtifactGraph(fixture.artifacts);

  assert.equal(validated.length, 14);
  assert.deepEqual(
    new Set(validated.map((artifact) => artifact.artifact_type)),
    new Set([
      "task_manifest",
      "run_manifest",
      "compiled_invocation",
      "readiness_analysis",
      "execution_attempt",
      "observation",
      "resource_observation",
      "evaluator_proposal",
      "run_review_summary",
      "human_review_decision",
      "human_evaluation",
      "generated_report",
    ]),
  );
  assert.equal(canonicalHarnessJson(fixture.summary), canonicalJson(fixture.summary));
});

test("version routing keeps v1 explicit and never coerces unsupported artifacts", () => {
  assert.deepEqual(routeArtifactVersion({ schema_version: 1, artifact_type: "generated_report" }), {
    schemaVersion: 1,
    owner: "eval-foundation-v1",
  });
  assert.deepEqual(routeArtifactVersion(createGraphFixture().task), {
    schemaVersion: 2,
    owner: "harness-v2",
  });
  assert.throws(
    () => routeArtifactVersion({ schema_version: 3, artifact_type: "generated_report" }),
    hasCode("ARTIFACT_VERSION_UNSUPPORTED"),
  );
  assert.throws(
    () => routeArtifactVersion({ schema_version: 1, artifact_type: "task_manifest" }),
    hasCode("ARTIFACT_VERSION_UNSUPPORTED"),
  );
});

test("schema rejects unknown fields, wrong versions, producers, and content hashes", async (t) => {
  const { task } = createGraphFixture();

  await t.test("unknown field", () => {
    assert.throws(() => assertHarnessArtifact({ ...task, extra: true }), hasCode("ARTIFACT_SCHEMA_INVALID"));
  });

  await t.test("wrong version", () => {
    assert.throws(
      () => assertHarnessArtifact(reseal({ ...task, schema_version: 1 })),
      hasCode("ARTIFACT_VERSION_UNSUPPORTED"),
    );
  });

  await t.test("wrong producer", () => {
    assert.throws(
      () => assertHarnessArtifact(reseal({ ...task, producer: producer("evaluator") })),
      hasCode("ARTIFACT_SCHEMA_INVALID"),
    );
  });

  await t.test("tampered content", () => {
    const tampered = structuredClone(task);
    tampered.payload.lifecycle = "closed";
    assert.throws(() => assertHarnessArtifact(tampered), hasCode("INTEGRITY_MISMATCH"));
  });

  await t.test("artifact id disagrees with payload identity", () => {
    const { run } = createGraphFixture();
    assert.throws(
      () => assertHarnessArtifact(reseal({ ...run, artifact_id: "different-run" })),
      hasCode("ARTIFACT_RELATIONSHIP_INVALID"),
    );
  });
});

test("relationship validation rejects missing targets, stale hashes, and wrong link types", async (t) => {
  const fixture = createGraphFixture();

  await t.test("missing target", () => {
    assert.throws(
      () => validateArtifactGraph(fixture.artifacts.filter((artifact) => artifact !== fixture.task)),
      hasCode("ARTIFACT_RELATIONSHIP_INVALID"),
    );
  });

  await t.test("stale target hash", () => {
    const run = structuredClone(fixture.run);
    run.links[0].target_content_sha256 = "b".repeat(64);
    const resealedRun = reseal(run);
    assert.throws(
      () => validateArtifactGraph(fixture.artifacts.map((artifact) => (artifact === fixture.run ? resealedRun : artifact))),
      hasCode("INTEGRITY_MISMATCH"),
    );
  });

  await t.test("wrong relationship target type", () => {
    assert.throws(
      () =>
        createHarnessArtifact({
          artifactType: "run_manifest",
          artifactId: "run-one",
          producer: producer("harness"),
          links: [link("task", fixture.summary)],
          payload: runPayload(),
        }),
      hasCode("ARTIFACT_SCHEMA_INVALID"),
    );
  });

  await t.test("correct target type with wrong semantic identity", () => {
    const otherTask = createHarnessArtifact({
      artifactType: "task_manifest",
      artifactId: "task-two",
      producer: producer("operator"),
      payload: {
        ...fixture.task.payload,
        task_id: "task-two",
      },
    });
    const wrongRun = createHarnessArtifact({
      artifactType: "run_manifest",
      artifactId: "run-one",
      producer: producer("harness"),
      links: [link("task", otherTask)],
      payload: runPayload(),
    });
    assert.throws(
      () => validateArtifactGraph([fixture.task, otherTask, wrongRun]),
      hasCode("ARTIFACT_RELATIONSHIP_INVALID"),
    );
  });

  await t.test("human decision escapes canonical review scope", () => {
    const wrongDecision = reseal({
      ...fixture.artifacts.find((artifact) => artifact.artifact_type === "human_review_decision"),
      payload: {
        ...fixture.artifacts.find((artifact) => artifact.artifact_type === "human_review_decision").payload,
        accepted_unit_ids: ["unit-three"],
      },
    });
    const graph = fixture.artifacts.filter(
      (artifact) => !["human_review_decision", "human_evaluation", "generated_report"].includes(artifact.artifact_type),
    );
    assert.throws(() => validateArtifactGraph([...graph, wrongDecision]), hasCode("ARTIFACT_RELATIONSHIP_INVALID"));
  });

  await t.test("materialized evaluation disagrees with accepted proposal", () => {
    const wrongEvaluation = reseal({
      ...fixture.evaluation,
      payload: { ...fixture.evaluation.payload, case_status: "failed" },
    });
    const graph = fixture.artifacts.filter(
      (artifact) => !["human_evaluation", "generated_report"].includes(artifact.artifact_type),
    );
    assert.throws(() => validateArtifactGraph([...graph, wrongEvaluation]), hasCode("ARTIFACT_RELATIONSHIP_INVALID"));
  });
});

test("only deterministic materializer can produce human_evaluation", () => {
  const fixture = createGraphFixture();
  const modelAuthored = reseal({
    ...fixture.evaluation,
    producer: producer("evaluator"),
  });

  assert.throws(() => assertHarnessArtifact(modelAuthored), hasCode("ARTIFACT_SCHEMA_INVALID"));
});

test("run review summary enforces exact arithmetic and untrusted renderer contracts", async (t) => {
  const fixture = createGraphFixture();

  await t.test("count mismatch", () => {
    const payload = structuredClone(fixture.summary.payload);
    payload.candidate.counts.passed = 2;
    assert.throws(() => createSummary(fixture, payload), hasCode("ARTIFACT_RELATIONSHIP_INVALID"));
  });

  await t.test("duplicate membership", () => {
    const payload = structuredClone(fixture.summary.payload);
    payload.operations.reader.reused_unit_ids = ["unit-one"];
    assert.throws(() => createSummary(fixture, payload), hasCode("ARTIFACT_RELATIONSHIP_INVALID"));
  });

  await t.test("incomplete evidence disguised as not_run", () => {
    const payload = structuredClone(fixture.summary.payload);
    payload.candidate.evidence.complete_case_ids = [];
    payload.candidate.evidence.incomplete_case_ids = ["case-one"];
    payload.candidate.status_members.not_run = ["case-one"];
    payload.candidate.status_members.passed = [];
    payload.candidate.counts.not_run = 1;
    payload.candidate.counts.passed = 0;
    payload.candidate.counts.unassessed = 1;
    assert.throws(() => createSummary(fixture, payload), hasCode("ARTIFACT_RELATIONSHIP_INVALID"));
  });

  for (const unsafePath of [
    "../outside.html",
    "/absolute/report.html",
    "//remote.example/report.html",
    "C:/temp/report.html",
    "https://remote.example/report.html",
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "runs\\run-one\\report.html",
    "runs/run-one/../report.html",
    "runs/CON/report.html",
    "runs/run-one/report.",
    "runs/run-one/*.html",
  ]) {
    await t.test(`unsafe local link ${unsafePath}`, () => {
      const payload = structuredClone(fixture.summary.payload);
      payload.drill_down_links[0].relative_path = unsafePath;
      assert.throws(() => createSummary(fixture, payload), hasCode("ARTIFACT_SCHEMA_INVALID"));
    });
  }

  await t.test("renderer does not default to untrusted text", () => {
    const payload = structuredClone(fixture.summary.payload);
    payload.renderer_contract.untrusted_text = false;
    assert.throws(() => createSummary(fixture, payload), hasCode("ARTIFACT_RELATIONSHIP_INVALID"));
  });
});

test("schema CLI validates canonical v2 files without exposing execution commands", () => {
  const root = mkdtempSync(join(tmpdir(), "vocaspace-harness-cp1-"));
  roots.push(root);
  const artifactPath = join(root, "task.json");
  const { task } = createGraphFixture();
  writeFileSync(artifactPath, canonicalHarnessJson(task), "utf8");

  const valid = spawnSync(process.execPath, [cliPath, "schema", "validate", "--file", artifactPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  const help = spawnSync(process.execPath, [cliPath, "--help"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(JSON.parse(valid.stdout).status, "valid");
  assert.equal(help.status, 0);
  assert.match(help.stdout, /without executing a model, helper, evaluator, or provider/);
  assert.doesNotMatch(help.stdout, /\brun\b.*model/i);
});

test("schema CLI reports file failures without leaking the absolute local path", () => {
  const root = mkdtempSync(join(tmpdir(), "vocaspace-harness-missing-"));
  roots.push(root);
  const missingPath = join(root, "missing.json");

  const result = spawnSync(process.execPath, [cliPath, "schema", "validate", "--file", missingPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /^HARNESS_IO_ERROR:/);
  assert.doesNotMatch(result.stderr, new RegExp(escapeRegex(root), "i"));
});

test("reader input identity has a stable golden hash and excludes Git/storage provenance", () => {
  const fixture = createGraphFixture();
  const input = readerIdentityInput(fixture);

  const first = deriveReaderInputIdentity(input);
  const moved = deriveReaderInputIdentity({
    ...input,
    provenance: {
      branch: "another-branch",
      commit: "f".repeat(40),
      storage_path: "another/worktree/run-one",
    },
  });

  assert.equal(first.reader_input_id, "11343818566391106f4f0d68f0b02b406303999148aac21c04596e74203dc2d1");
  assert.equal(moved.reader_input_id, first.reader_input_id);
  assert.notDeepEqual(moved.provenance, first.provenance);
  assert.equal(Object.hasOwn(first.canonical_input, "provenance"), false);
  input.context[0].label = "mutated-after-hash";
  assert.equal(first.canonical_input.context[0].label, "context-one");
});

test("reader identity changes for prompt, context, invocation, and pre-dispatch attestation", () => {
  const fixture = createGraphFixture();
  const input = readerIdentityInput(fixture);
  const baseline = deriveReaderInputIdentity(input).reader_input_id;
  const mutations = [
    { ...input, prompt: "Changed prompt" },
    { ...input, context: [{ label: "context-one", sha256: "b".repeat(64) }] },
    {
      ...input,
      compiled_invocation: recreateArtifact(input.compiled_invocation, {
        ...input.compiled_invocation.payload,
        messages: [{ content: "Changed model-visible instruction.", role: "developer" }],
      }),
    },
    {
      ...input,
      attestation: { ...input.attestation, runtime_config_sha256: "b".repeat(64) },
    },
  ];

  for (const mutation of mutations) {
    assert.notEqual(deriveReaderInputIdentity(mutation).reader_input_id, baseline);
  }
});

test("evaluator identity hashes behavior projection but keeps full source bindings outside reuse key", () => {
  const fixture = createGraphFixture();
  const input = evaluatorIdentityInput(fixture);
  const first = deriveEvaluatorInputIdentity(input);
  const observation = input.evidence[0].observation;
  const reboundObservation = createHarnessArtifact({
    artifactType: "observation",
    artifactId: "observation-rebound",
    producer: { ...observation.producer, name: "other-fixture-adapter" },
    links: observation.links,
    payload: observation.payload,
  });
  const resource = input.evidence[0].resource_observation;
  const reboundResource = createHarnessArtifact({
    artifactType: "resource_observation",
    artifactId: "resource-rebound",
    producer: resource.producer,
    links: [link("observation", reboundObservation)],
    payload: { ...resource.payload, observation_id: "observation-rebound" },
  });
  const rebound = deriveEvaluatorInputIdentity({
    ...input,
    evidence: [{ observation: reboundObservation, resource_observation: reboundResource }],
  });

  assert.equal(first.evaluator_input_id, "e5b3ac437b27b02a3511568bcf632588499c2251872865311faee112f562b6cf");
  assert.equal(rebound.evaluator_input_id, first.evaluator_input_id);
  assert.notDeepEqual(rebound.source_bindings, first.source_bindings);
  assert.equal(Object.hasOwn(first.canonical_input.evidence[0], "artifact_id"), false);
});

test("evaluator identity changes for visible evidence, rubric, and evaluator protocol", () => {
  const fixture = createGraphFixture();
  const input = evaluatorIdentityInput(fixture);
  const baseline = deriveEvaluatorInputIdentity(input).evaluator_input_id;
  const observation = input.evidence[0].observation;
  const changedObservation = recreateArtifact(observation, {
    ...observation.payload,
    raw_text: "Behavior changed",
  });
  const changedEvidence = {
    ...input,
    evidence: [{ observation: changedObservation, resource_observation: null }],
  };

  assert.notEqual(deriveEvaluatorInputIdentity(changedEvidence).evaluator_input_id, baseline);
  assert.notEqual(
    deriveEvaluatorInputIdentity({ ...input, rubric: { criteria: ["changed"] } }).evaluator_input_id,
    baseline,
  );
  assert.notEqual(
    deriveEvaluatorInputIdentity({ ...input, protocol_version: "evaluator-protocol-v3" }).evaluator_input_id,
    baseline,
  );
});

test("acceptance identity binds proposal, canonical summary, evidence scope, and review policy", () => {
  const fixture = createGraphFixture();
  const input = acceptanceIdentityInput(fixture);
  const first = deriveAcceptanceInputIdentity(input);

  assert.equal(first.acceptance_input_id, "4d4088c47f6253147c1d04d7cb7068a409d45c2aa09c7da35cf79895d875f66c");
  assert.notEqual(
    deriveAcceptanceInputIdentity({ ...input, review_policy: { version: "review-policy-v3" } }).acceptance_input_id,
    first.acceptance_input_id,
  );
  assert.notEqual(
    deriveAcceptanceInputIdentity({
      ...input,
      evidence_bindings: [{ artifact_id: "observation-one", content_sha256: "b".repeat(64) }],
    }).acceptance_input_id,
    first.acceptance_input_id,
  );
  assert.throws(
    () => deriveAcceptanceInputIdentity({ ...input, accepted_scope: ["unit-three"] }),
    hasCode("IDENTITY_INPUT_INVALID"),
  );
  const unrelatedProposal = createHarnessArtifact({
    artifactType: "evaluator_proposal",
    artifactId: "proposal-two",
    producer: fixture.proposal.producer,
    links: fixture.proposal.links,
    payload: fixture.proposal.payload,
  });
  assert.throws(
    () => deriveAcceptanceInputIdentity({ ...input, proposals: [unrelatedProposal] }),
    hasCode("IDENTITY_INPUT_INVALID"),
  );
});

test("identity impact preserves the earliest affected dependency layer and fails closed", () => {
  const before = {
    reader_input_id: "a".repeat(64),
    evaluator_input_id: "b".repeat(64),
    acceptance_input_id: "c".repeat(64),
  };

  assert.equal(classifyIdentityImpact(before, before), "unaffected");
  assert.equal(
    classifyIdentityImpact(before, { ...before, acceptance_input_id: "d".repeat(64) }),
    "acceptance_affected",
  );
  assert.equal(
    classifyIdentityImpact(before, { ...before, evaluator_input_id: "d".repeat(64) }),
    "evaluator_affected",
  );
  assert.equal(
    classifyIdentityImpact(before, { ...before, reader_input_id: "d".repeat(64) }),
    "reader_affected",
  );
  assert.equal(classifyIdentityImpact(before, before, { unknownChange: true }), "unknown");
});

test("dependency field classifier maps known ownership and treats unknown paths conservatively", () => {
  assert.equal(classifyDependencyPath("provenance.git.commit"), "unaffected");
  assert.equal(classifyDependencyPath("case.prompt"), "reader_affected");
  assert.equal(classifyDependencyPath("observation.behavior.raw_text"), "evaluator_affected");
  assert.equal(classifyDependencyPath("review_policy.version"), "acceptance_affected");
  assert.equal(classifyDependencyPath("new_contract.unmapped"), "unknown");
  assert.equal(classifyDependencyPath("case.prompted"), "unknown");
  assert.equal(classifyDependencyPath("attempt.timestamp-corruption"), "unknown");
  assert.equal(
    classifyDependencyChanges(["provenance.branch", "review_policy.version", "rubric.criteria"]),
    "evaluator_affected",
  );
  assert.equal(classifyDependencyChanges(["case.prompt", "new_contract.unmapped"]), "unknown");
});

function createGraphFixture() {
  const task = createHarnessArtifact({
    artifactType: "task_manifest",
    artifactId: "task-one",
    producer: producer("operator"),
    payload: {
      task_id: "task-one",
      lifecycle: "active",
      created_at: timestamp,
      provenance: { branch: "refactor/agent-skill-eval-harness", commit: null, pull_request: null },
      retention_policy_version: "retention-v2",
    },
  });
  const run = createHarnessArtifact({
    artifactType: "run_manifest",
    artifactId: "run-one",
    producer: producer("harness"),
    links: [link("task", task)],
    payload: runPayload(),
  });
  const readerInvocation = createHarnessArtifact({
    artifactType: "compiled_invocation",
    artifactId: "reader-invocation",
    producer: producer("readiness_compiler"),
    links: [link("run", run)],
    payload: invocationPayload("reader", "unit-one"),
  });
  const evaluatorInvocation = createHarnessArtifact({
    artifactType: "compiled_invocation",
    artifactId: "evaluator-invocation",
    producer: producer("readiness_compiler"),
    links: [link("run", run)],
    payload: invocationPayload("evaluator", "unit-two"),
  });
  const readiness = createHarnessArtifact({
    artifactType: "readiness_analysis",
    artifactId: "readiness-one",
    producer: producer("readiness"),
    links: [
      link("compiled_invocation", evaluatorInvocation),
      link("compiled_invocation", readerInvocation),
      link("run", run),
    ],
    payload: {
      run_id: "run-one",
      round: 1,
      stage: "reader",
      status: "passed",
      field_results: [],
      invocation_hashes: [evaluatorInvocation.content_sha256, readerInvocation.content_sha256].sort(),
      helper_attempt_ids: [],
      correction: null,
      grants: [
        {
          unit_id: "unit-one",
          invocation_sha256: readerInvocation.content_sha256,
          nonce: "grant-one",
          single_use: true,
        },
      ],
    },
  });
  const readerAttempt = createHarnessArtifact({
    artifactType: "execution_attempt",
    artifactId: "attempt-one",
    producer: producer("orchestrator"),
    links: [
      link("compiled_invocation", readerInvocation),
      link("readiness", readiness),
      link("run", run),
    ],
    payload: attemptPayload("attempt-one", "reader", "unit-one", readerInvocation.content_sha256),
  });
  const evaluatorAttempt = createHarnessArtifact({
    artifactType: "execution_attempt",
    artifactId: "attempt-two",
    producer: producer("orchestrator"),
    links: [
      link("compiled_invocation", evaluatorInvocation),
      link("readiness", readiness),
      link("run", run),
    ],
    payload: attemptPayload("attempt-two", "evaluator", "unit-two", evaluatorInvocation.content_sha256),
  });
  const observation = createHarnessArtifact({
    artifactType: "observation",
    artifactId: "observation-one",
    producer: producer("adapter"),
    links: [link("attempt", readerAttempt), link("compiled_invocation", readerInvocation)],
    payload: {
      attempt_id: "attempt-one",
      execution_status: "completed",
      observed_access: {
        credentials: "not_observed",
        filesystem: "observed",
        mutation: "not_observed",
        network: "not_observed",
        remote_actions: "not_observed",
        tools: "observed",
      },
      raw_text: "Reader output",
      run_id: "run-one",
      unit_id: "unit-one",
    },
  });
  const resourceObservation = createHarnessArtifact({
    artifactType: "resource_observation",
    artifactId: "resource-one",
    producer: producer("adapter"),
    links: [link("observation", observation)],
    payload: {
      basis: "unavailable",
      denied: null,
      limitations: "Exact resource access was unavailable.",
      observation_id: "observation-one",
      read: null,
      supplied: null,
    },
  });
  const proposal = createHarnessArtifact({
    artifactType: "evaluator_proposal",
    artifactId: "proposal-one",
    producer: producer("evaluator"),
    links: [
      link("attempt", evaluatorAttempt),
      link("observation", observation),
      link("resource_observation", resourceObservation),
    ],
    payload: {
      case_status: "passed",
      citations: [{ artifact_id: "observation-one", label: "Observed behavior" }],
      comparison_status: "equivalent",
      rationale: "Proposal only.",
      recommendation: "accept",
      uncertainty: "",
      unit_id: "unit-one",
    },
  });
  const summary = createHarnessArtifact({
    artifactType: "run_review_summary",
    artifactId: "summary-one",
    producer: producer("review_builder"),
    links: [link("evaluator_proposal", proposal), link("run", run)],
    payload: summaryPayload(),
  });
  const decision = createHarnessArtifact({
    artifactType: "human_review_decision",
    artifactId: "decision-one",
    producer: producer("authorized_reviewer"),
    links: [link("evaluator_proposal", proposal), link("summary", summary)],
    payload: {
      accepted_unit_ids: ["unit-one"],
      action: "accept",
      decided_at: timestamp,
      rationale: "Accepted after human review.",
      reviewer: { identity: "owner-reviewer", identity_type: "local_named_reviewer" },
      summary_sha256: summary.content_sha256,
    },
  });
  const evaluation = createHarnessArtifact({
    artifactType: "human_evaluation",
    artifactId: "evaluation-one",
    producer: producer("materializer"),
    links: [link("decision", decision), link("evaluator_proposal", proposal), link("summary", summary)],
    payload: {
      case_status: "passed",
      comparison_status: "equivalent",
      decision_id: "decision-one",
      proposal_id: "proposal-one",
      unit_id: "unit-one",
    },
  });
  const report = createHarnessArtifact({
    artifactType: "generated_report",
    artifactId: "report-one",
    producer: producer("reporter"),
    links: [link("human_evaluation", evaluation), link("run", run)],
    payload: {
      accepted_unit_ids: ["unit-one"],
      run_id: "run-one",
      status: "complete",
      summary_sha256: summary.content_sha256,
    },
  });
  return {
    artifacts: [
      task,
      run,
      readerInvocation,
      evaluatorInvocation,
      readiness,
      readerAttempt,
      evaluatorAttempt,
      observation,
      resourceObservation,
      proposal,
      summary,
      decision,
      evaluation,
      report,
    ],
    task,
    run,
    summary,
    evaluation,
    proposal,
  };
}

function runPayload() {
  return {
    adapter_id: "fixture-adapter",
    created_at: timestamp,
    revision: 0,
    run_id: "run-one",
    runtime_config_sha256: hashA,
    selected_units: [
      { case_id: "case-one", role: "reader", suite: "regression", unit_id: "unit-one", variant: "candidate" },
      { case_id: "case-one", role: "evaluator", suite: "regression", unit_id: "unit-two", variant: "candidate" },
    ],
    state: "created",
    task_id: "task-one",
  };
}

function invocationPayload(role, unitId) {
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
  return {
    messages: [{ content: "Follow the supplied execution contract.", role: "developer" }],
    model_visible_policy: policy,
    protocol: { observation_instructions: "Return the exact observation schema.", output_schema: "observation-v2" },
    requested_policy: policy,
    resources: [],
    role,
    run_id: "run-one",
    runtime: { model: "fixture-model", parameters: {}, provider: "fixture", runtime_class: "fixture-runtime" },
    tools: [],
    unit_id: unitId,
  };
}

function attemptPayload(attemptId, role, unitId, inputHash) {
  return {
    attempt_id: attemptId,
    call_certainty: "confirmed_finished",
    finished_at: timestamp,
    input_sha256: inputHash,
    outcome: "success",
    phase: "terminal",
    role,
    run_id: "run-one",
    sequence: 1,
    started_at: timestamp,
    unit_id: unitId,
  };
}

function summaryPayload() {
  return {
    anomalies: [],
    baseline: caseAggregate(),
    candidate: caseAggregate(),
    comparison: {
      counts: { equivalent: 1, improved: 0, inconclusive: 0, regressed: 0, unassessed: 0 },
      evidence: { assessed_unit_ids: ["unit-one"], unassessed_unit_ids: [] },
      scope_unit_ids: ["unit-one"],
      status_members: { equivalent: ["unit-one"], improved: [], inconclusive: [], regressed: [] },
    },
    drill_down_links: [{ kind: "task_artifact", label: "Observation", relative_path: "runs/run-one/attempts/attempt-one.json", sha256: hashA }],
    exceptions: [],
    limitations: [],
    operations: {
      evaluator: operationalAggregate("unit-two", "attempt-two"),
      reader: operationalAggregate("unit-one", "attempt-one"),
    },
    proposed_action: "accept unit-one",
    readiness: { helper_call_count: 0, status: "passed" },
    recommendation: "accept",
    renderer_contract: {
      html_mode: "static-escaped-no-javascript",
      link_policy: "typed-contained-local-only",
      markdown_mode: "context-escaped-text",
      security_policy_version: "review-security-v1",
      untrusted_text: true,
    },
    scope: {
      baseline_case_ids: ["case-one"],
      candidate_case_ids: ["case-one"],
      comparable_unit_ids: ["unit-one"],
      selected_case_ids: ["case-one"],
    },
  };
}

function caseAggregate() {
  return {
    counts: { failed: 0, not_run: 0, partially_passed: 0, passed: 1, unassessed: 0 },
    evidence: { complete_case_ids: ["case-one"], incomplete_case_ids: [] },
    scope_case_ids: ["case-one"],
    status_members: { failed: [], not_run: [], partially_passed: [], passed: ["case-one"] },
  };
}

function operationalAggregate(unitId, attemptId) {
  return {
    attempts: {
      initial_attempt_ids: [attemptId],
      nonterminal_attempt_ids: [],
      retry_attempt_ids: [],
      terminal: { cancelled: [], error: [], outcome_unknown: [], success: [attemptId], timeout: [] },
    },
    blocked_unit_ids: [],
    newly_executed_unit_ids: [unitId],
    reused_unit_ids: [],
    scope_unit_ids: [unitId],
  };
}

function createSummary(fixture, payload) {
  return createHarnessArtifact({
    artifactType: "run_review_summary",
    artifactId: "summary-invalid",
    producer: producer("review_builder"),
    links: [link("evaluator_proposal", fixture.proposal), link("run", fixture.run)],
    payload,
  });
}

function readerIdentityInput(fixture) {
  return {
    attestation: {
      adapter_capabilities: { filesystem: "read_only", network: "denied" },
      enforced_policy: { filesystem: "read_only", network: "denied" },
      runtime_config_sha256: hashA,
    },
    bundle: { bundle_sha256: hashA, reader_visible_variant: "candidate" },
    compiled_invocation: fixture.artifacts.find(
      (artifact) => artifact.artifact_type === "compiled_invocation" && artifact.payload.role === "reader",
    ),
    context: [{ label: "context-one", sha256: hashA }],
    fresh_context_method: "new-process",
    prompt: "Review the supplied skill behavior.",
    protocol_version: "reader-protocol-v2",
    provenance: {
      branch: "refactor/agent-skill-eval-harness",
      commit: "a".repeat(40),
      storage_path: "worktree/run-one",
    },
  };
}

function evaluatorIdentityInput(fixture) {
  return {
    comparison_mapping: { baseline: "variant-a", candidate: "variant-b" },
    compiled_invocation: fixture.artifacts.find(
      (artifact) => artifact.artifact_type === "compiled_invocation" && artifact.payload.role === "evaluator",
    ),
    evidence: [
      {
        observation: fixture.artifacts.find((artifact) => artifact.artifact_type === "observation"),
        resource_observation: fixture.artifacts.find(
          (artifact) => artifact.artifact_type === "resource_observation",
        ),
      },
    ],
    protocol_version: "evaluator-protocol-v2",
    rubric: { criteria: ["correctness", "authority"] },
  };
}

function acceptanceIdentityInput(fixture) {
  const observation = fixture.artifacts.find((artifact) => artifact.artifact_type === "observation");
  return {
    accepted_scope: ["unit-one"],
    evidence_bindings: [
      { artifact_id: observation.artifact_id, content_sha256: observation.content_sha256 },
    ],
    proposals: [fixture.proposal],
    review_policy: { version: "review-policy-v2" },
    summary: fixture.summary,
  };
}

function recreateArtifact(artifact, payload) {
  return createHarnessArtifact({
    artifactType: artifact.artifact_type,
    artifactId: artifact.artifact_id,
    producer: artifact.producer,
    links: artifact.links,
    payload,
  });
}

function producer(kind) {
  return { kind, name: `${kind.replaceAll("_", "-")}-fixture`, version: "v-one" };
}

function link(relationship, target) {
  return {
    relationship,
    target_artifact_id: target.artifact_id,
    target_artifact_type: target.artifact_type,
    target_content_sha256: target.content_sha256,
  };
}

function reseal(value) {
  const envelope = structuredClone(value);
  delete envelope.content_sha256;
  return { ...envelope, content_sha256: sha256Canonical(envelope) };
}

function hasCode(code) {
  return (error) => error instanceof HarnessError && error.code === code;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
