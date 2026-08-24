// Test plan:
// - Mục tiêu: kiểm tra schema, identity, durable state, readiness/P0, orchestration/controls và review authority của eval harness v2.
// - Loại test: Node schema/unit/CLI black-box.
// - Đối tượng: schema/identity/store/readiness/orchestrator/review v2 và harness CLI.
// - Case thành công: strict graph, logical hashes, exact resume/reuse, bounded concurrency/retry, evaluator stage, canonical review publication, 21-case summary, safe views và human materialization/report.
// - Case thất bại: corrupt/semantic substitution, static-plan/evidence/attempt-lineage drift, P0/stale grant, invalid output, unknown outcome, timeout/cancel, hostile review text và stale representation.
// - Bảo mật/phân quyền: model không tạo human evidence; helper chỉ là deterministic fixture; P0 failure giữ reader calls `0`.
// - Ổn định/resilience: canonical hashes, CAS/lease/journal, immutable attempts, classified retry, phased timeout/cancel, concurrency, TOCTOU và restart resume.
// - Invariant cần giữ: invalid/uncertain input không thể thành evidence, grant hoặc implicit `not_run`.
// - Kết quả verify gần nhất: passed 132 tests bằng `node --test .agents/scripts/run-skill-eval-harness.test.mjs`.
// - Ghi chú: test chỉ dùng local deterministic fixtures, không có model/provider call.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
import {
  acquireRunLease,
  appendAttemptPhase,
  createRunRecord,
  initializeRunStore,
  inspectRunState,
  listStoredArtifacts,
  loadRunManifest,
  planResume,
  readArtifactObject,
  readAttemptPhases,
  recordAttemptControl,
  recordAttemptRetryClassification,
  recoverRun,
  releaseRunLease,
  resolveHarnessStoreRoot,
  transitionRun,
  writeArtifactObject,
} from "./lib/skill-evals/run-store-v2.mjs";
import {
  compileEvaluatorStaticInvocation,
  compileInvocation,
  createDispatchGuard,
  createPreflightHousekeepingPreview,
  deriveHelperInputIdentity,
  executeReadiness,
} from "./lib/skill-evals/readiness-v2.mjs";
import {
  deriveReaderProgress,
  runControlledFixtureAttempts,
  runSequentialReaderStage,
} from "./lib/skill-evals/orchestrator-v2.mjs";
import {
  buildRunReviewSummary,
  createAcceptedReport,
  createHumanReviewDecision,
  finalizeEvaluatorStage,
  materializeHumanEvaluations,
  publishRunReview,
  renderReviewRepresentations,
  runSequentialEvaluatorStage,
} from "./lib/skill-evals/review-v2.mjs";

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

  assert.equal(validated.length, 15);
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
    tampered.payload.retention_policy_version = "retention-v3";
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

  await t.test("materialized evaluation substitutes a same-status proposal outside the reviewed chain", () => {
    const substitutedProposal = createHarnessArtifact({
      artifactType: "evaluator_proposal",
      artifactId: "proposal-substitute",
      producer: fixture.proposal.producer,
      links: fixture.proposal.links,
      payload: fixture.proposal.payload,
    });
    const substitutedEvaluation = createHarnessArtifact({
      artifactType: "human_evaluation",
      artifactId: fixture.evaluation.artifact_id,
      producer: fixture.evaluation.producer,
      links: fixture.evaluation.links.map((item) =>
        item.relationship === "evaluator_proposal" ? link("evaluator_proposal", substitutedProposal) : item,
      ),
      payload: { ...fixture.evaluation.payload, proposal_id: substitutedProposal.artifact_id },
    });
    const graph = fixture.artifacts.filter(
      (artifact) => !["human_evaluation", "generated_report"].includes(artifact.artifact_type),
    );

    assert.throws(
      () => validateArtifactGraph([...graph, substitutedProposal, substitutedEvaluation]),
      hasCode("ARTIFACT_RELATIONSHIP_INVALID"),
    );
  });

  await t.test("generated report substitutes a run outside the accepted summary lineage", () => {
    const otherRun = createHarnessArtifact({
      artifactType: "run_manifest",
      artifactId: "run-two",
      producer: fixture.run.producer,
      links: [link("task", fixture.task)],
      payload: { ...fixture.run.payload, run_id: "run-two" },
    });
    const wrongReport = createHarnessArtifact({
      artifactType: "generated_report",
      artifactId: "report-two",
      producer: producer("reporter"),
      links: [link("human_evaluation", fixture.evaluation), link("run", otherRun)],
      payload: { ...fixture.artifacts.find((artifact) => artifact.artifact_type === "generated_report").payload, run_id: "run-two" },
    });
    const graph = fixture.artifacts.filter((artifact) => artifact.artifact_type !== "generated_report");

    assert.throws(
      () => validateArtifactGraph([...graph, otherRun, wrongReport]),
      hasCode("ARTIFACT_RELATIONSHIP_INVALID"),
    );
  });

  await t.test("canonical summary substitutes proposals from another run", () => {
    const otherRun = createHarnessArtifact({
      artifactType: "run_manifest",
      artifactId: "run-two",
      producer: fixture.run.producer,
      links: [link("task", fixture.task)],
      payload: { ...fixture.run.payload, run_id: "run-two" },
    });
    const wrongSummary = createHarnessArtifact({
      artifactType: "run_review_summary",
      artifactId: "summary-two",
      producer: fixture.summary.producer,
      links: [
        link("evaluator_proposal", fixture.proposal),
        link("execution_attempt", fixture.readerAttempt),
        link("execution_attempt", fixture.evaluatorAttempt),
        link("run", otherRun),
      ],
      payload: fixture.summary.payload,
    });
    const graph = fixture.artifacts.filter(
      (artifact) => !["run_review_summary", "human_review_decision", "human_evaluation", "generated_report"].includes(artifact.artifact_type),
    );

    assert.throws(
      () => validateArtifactGraph([...graph, otherRun, wrongSummary]),
      hasCode("ARTIFACT_RELATIONSHIP_INVALID"),
    );
  });

  await t.test("accepted evidence substitutes a stale acceptance_input_id", () => {
    const decision = fixture.artifacts.find((artifact) => artifact.artifact_type === "human_review_decision");
    const report = fixture.artifacts.find((artifact) => artifact.artifact_type === "generated_report");
    const staleAcceptanceInputId = "b".repeat(64);
    const staleDecision = createHarnessArtifact({
      ...artifactCreationFields(decision),
      links: decision.links,
      payload: { ...decision.payload, acceptance_input_id: staleAcceptanceInputId },
    });
    const staleEvaluation = createHarnessArtifact({
      ...artifactCreationFields(fixture.evaluation),
      links: fixture.evaluation.links.map((item) =>
        item.relationship === "decision" ? link("decision", staleDecision) : item,
      ),
      payload: { ...fixture.evaluation.payload, acceptance_input_id: staleAcceptanceInputId },
    });
    const staleReport = createHarnessArtifact({
      ...artifactCreationFields(report),
      links: report.links.map((item) =>
        item.relationship === "human_evaluation" ? link("human_evaluation", staleEvaluation) : item,
      ),
      payload: report.payload,
    });
    const graph = fixture.artifacts.filter(
      (artifact) => !["human_review_decision", "human_evaluation", "generated_report"].includes(artifact.artifact_type),
    );

    assert.throws(
      () => validateArtifactGraph([...graph, staleDecision, staleEvaluation, staleReport]),
      hasCode("ARTIFACT_RELATIONSHIP_INVALID"),
    );
    const mismatchedEvaluation = createHarnessArtifact({
      ...artifactCreationFields(fixture.evaluation),
      links: fixture.evaluation.links,
      payload: { ...fixture.evaluation.payload, acceptance_input_id: staleAcceptanceInputId },
    });
    assert.throws(
      () => validateArtifactGraph([...graph, decision, mismatchedEvaluation]),
      hasCode("ARTIFACT_RELATIONSHIP_INVALID"),
    );
  });

  await t.test("evaluator proposal substitutes same-run evidence from another reader unit", () => {
    const substitution = createSameRunCrossUnitProposalGraph();

    assert.throws(
      () => validateArtifactGraph(substitution),
      hasCode("ARTIFACT_RELATIONSHIP_INVALID"),
    );
  });
});

test("accepted evidence persists the exact derived acceptance_input_id", () => {
  const fixture = createGraphFixture();
  const expected = deriveAcceptanceInputIdentity(acceptanceIdentityInput(fixture)).acceptance_input_id;
  const decision = fixture.artifacts.find((artifact) => artifact.artifact_type === "human_review_decision");

  assert.equal(decision.payload.acceptance_input_id, expected);
  assert.equal(fixture.evaluation.payload.acceptance_input_id, expected);
  assert.doesNotThrow(() => validateArtifactGraph(fixture.artifacts));
});

test("generated report accepts one exact decision and acceptance identity for its complete scope", () => {
  const fixture = createReportDecisionLineageFixture();

  assert.doesNotThrow(() =>
    validateArtifactGraph([
      ...fixture.core,
      fixture.completeDecision,
      ...fixture.completeEvaluations,
      fixture.completeReport,
    ]),
  );
});

test("generated report rejects same-summary evaluations from different decisions with one acceptance identity", () => {
  const fixture = createReportDecisionLineageFixture();

  assert.throws(
    () =>
      validateArtifactGraph([
        ...fixture.core,
        fixture.completeDecision,
        fixture.reviewerReplacementDecision,
        ...fixture.mixedDecisionEvaluations,
        fixture.mixedDecisionReport,
      ]),
    hasCode("ARTIFACT_RELATIONSHIP_INVALID"),
  );
});

test("generated report rejects same-summary evaluations with different acceptance identities", () => {
  const fixture = createReportDecisionLineageFixture();

  assert.throws(
    () =>
      validateArtifactGraph([
        ...fixture.core,
        ...fixture.splitDecisions,
        ...fixture.mixedAcceptanceEvaluations,
        fixture.mixedAcceptanceReport,
      ]),
    hasCode("ARTIFACT_RELATIONSHIP_INVALID"),
  );
});

test("generated report rejects an incomplete subset of one decision's accepted scope", () => {
  const fixture = createReportDecisionLineageFixture();

  assert.throws(
    () =>
      validateArtifactGraph([
        ...fixture.core,
        fixture.completeDecision,
        fixture.completeEvaluations[0],
        fixture.incompleteDecisionScopeReport,
      ]),
    hasCode("ARTIFACT_RELATIONSHIP_INVALID"),
  );
});

test("generated report rejects status memberships substituted away from accepted evaluations", () => {
  const fixture = createReportDecisionLineageFixture();
  const report = createHarnessArtifact({
    ...artifactCreationFields(fixture.completeReport),
    payload: {
      ...fixture.completeReport.payload,
      aggregates: {
        ...fixture.completeReport.payload.aggregates,
        case_status: {
          failed: [...fixture.completeReport.payload.accepted_unit_ids],
          not_run: [],
          partially_passed: [],
          passed: [],
        },
      },
    },
  });

  assert.throws(
    () => validateArtifactGraph([...fixture.core, ...fixture.completeEvaluations, report]),
    (error) => error instanceof HarnessError && error.code === "ARTIFACT_RELATIONSHIP_INVALID",
  );
});

test("reviewer audit metadata may change only through a newly bound valid decision chain", () => {
  const fixture = createGraphFixture();
  const decision = fixture.artifacts.find((artifact) => artifact.artifact_type === "human_review_decision");
  const replacementDecision = createHarnessArtifact({
    ...artifactCreationFields(decision),
    links: decision.links,
    payload: {
      ...decision.payload,
      decided_at: "2026-08-21T00:00:00.000Z",
      reviewer: { identity: "second-owner-reviewer", identity_type: "local_named_reviewer" },
    },
  });
  const replacementEvaluation = createHarnessArtifact({
    ...artifactCreationFields(fixture.evaluation),
    links: fixture.evaluation.links.map((item) =>
      item.relationship === "decision" ? link("decision", replacementDecision) : item,
    ),
    payload: fixture.evaluation.payload,
  });
  const graph = fixture.artifacts.filter(
    (artifact) => !["human_review_decision", "human_evaluation", "generated_report"].includes(artifact.artifact_type),
  );

  assert.equal(replacementDecision.payload.acceptance_input_id, decision.payload.acceptance_input_id);
  assert.doesNotThrow(() => validateArtifactGraph([...graph, replacementDecision, replacementEvaluation]));
});

test("only deterministic materializer can produce human_evaluation", () => {
  const fixture = createGraphFixture();
  const modelAuthored = reseal({
    ...fixture.evaluation,
    producer: producer("evaluator"),
  });

  assert.throws(() => assertHarnessArtifact(modelAuthored), hasCode("ARTIFACT_SCHEMA_INVALID"));
});

test("passed reader readiness must grant every exact linked reader invocation", () => {
  const fixture = createGraphFixture();
  const malformed = reseal({ ...fixture.readiness, payload: { ...fixture.readiness.payload, grants: [] } });

  assert.throws(
    () => validateArtifactGraph([fixture.task, fixture.run, fixture.readerInvocation, malformed]),
    hasCode("ARTIFACT_RELATIONSHIP_INVALID"),
  );
});

test("reader readiness graph cannot omit a selected reader unit", () => {
  const fixture = createReadinessFixture({ twoReaders: true });
  const result = executeFixtureReadiness(fixture);
  const readiness = result.analyses[0].reader;
  const retained = fixture.readers[0];
  const malformed = createHarnessArtifact({
    artifactType: "readiness_analysis",
    artifactId: readiness.artifact_id,
    producer: readiness.producer,
    links: readiness.links.filter(
      (item) => item.relationship !== "compiled_invocation" || item.target_artifact_id === retained.artifact_id,
    ),
    payload: {
      ...readiness.payload,
      grants: readiness.payload.grants.filter((grant) => grant.unit_id === retained.payload.unit_id),
      invocation_hashes: [retained.content_sha256],
    },
  });

  assert.throws(
    () => validateArtifactGraph([fixture.task, fixture.run, retained, malformed]),
    hasCode("ARTIFACT_RELATIONSHIP_INVALID"),
  );
});

test("execution-attempt certainty cannot contradict its phase or successful outcome", () => {
  const fixture = createGraphFixture();
  const malformed = reseal({
    ...fixture.readerAttempt,
    payload: { ...fixture.readerAttempt.payload, call_certainty: "unknown" },
  });

  assert.throws(() => assertHarnessArtifact(malformed), hasCode("ARTIFACT_RELATIONSHIP_INVALID"));
  const uncertainError = reseal({
    ...fixture.readerAttempt,
    payload: {
      ...fixture.readerAttempt.payload,
      call_certainty: "unknown",
      outcome: "error",
    },
  });
  assert.throws(() => assertHarnessArtifact(uncertainError), hasCode("ARTIFACT_RELATIONSHIP_INVALID"));
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

  await t.test("attempt identity substituted across reader and evaluator partitions", () => {
    const payload = structuredClone(fixture.summary.payload);
    payload.operations.reader.attempts.initial_attempt_ids = [fixture.evaluatorAttempt.payload.attempt_id];
    payload.operations.reader.attempts.terminal.success = [fixture.evaluatorAttempt.payload.attempt_id];
    const substituted = createSummary(fixture, payload);
    const supporting = fixture.artifacts.filter(
      (artifact) =>
        !["run_review_summary", "human_review_decision", "human_evaluation", "generated_report"].includes(
          artifact.artifact_type,
        ),
    );
    assert.throws(
      () => validateArtifactGraph([...supporting, substituted]),
      hasCode("ARTIFACT_RELATIONSHIP_INVALID"),
    );
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

test("schema CLI validates canonical v2 files while live execution remains explicit and CP9-scoped", () => {
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
  const storeRoot = spawnSync(process.execPath, [cliPath, "store", "root"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(JSON.parse(valid.stdout).status, "valid");
  assert.equal(help.status, 0);
  assert.match(help.stdout, /cp9 live --plan .* --authority .* --executable/);
  assert.match(help.stdout, /Preflight never creates a thread or model turn/);
  assert.match(help.stdout, /No helper or arbitrary-prompt command exists/);
  assert.match(help.stdout, /state inspect --run/);
  assert.doesNotMatch(help.stdout, /--prompt|verification-helper (?:run|dispatch)/i);
  assert.equal(storeRoot.status, 0, storeRoot.stderr);
  assert.match(storeRoot.stdout, /vocaspace-agent-skill-evals[\\/]v2/);
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

  assert.equal(first.reader_input_id, "76b32d1be41630b289804a224550dfa37fb5c0d2d4d045f42ca94629f4d7c35f");
  assert.equal(moved.reader_input_id, first.reader_input_id);
  assert.notDeepEqual(moved.provenance, first.provenance);
  assert.equal(Object.hasOwn(first.canonical_input, "provenance"), false);
  input.context[0].label = "mutated-after-hash";
  assert.equal(first.canonical_input.context[0].label, "context-one");
});

test("reader identity changes for visible inputs and rejects a mismatched runtime attestation", () => {
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
  ];

  for (const mutation of mutations) {
    assert.notEqual(deriveReaderInputIdentity(mutation).reader_input_id, baseline);
  }
  assert.throws(
    () =>
      deriveReaderInputIdentity({
        ...input,
        attestation: { ...input.attestation, runtime_config_sha256: "b".repeat(64) },
      }),
    hasCode("IDENTITY_INPUT_INVALID"),
  );
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

test("evaluator evidence rejects a resource payload rebound away from its exact observation", () => {
  const fixture = createGraphFixture();
  const input = evaluatorIdentityInput(fixture);
  const resource = input.evidence[0].resource_observation;
  const rebound = recreateArtifact(resource, { ...resource.payload, observation_id: "observation-other" });

  assert.throws(
    () =>
      deriveEvaluatorInputIdentity({
        ...input,
        evidence: [{ ...input.evidence[0], resource_observation: rebound }],
      }),
    hasCode("IDENTITY_INPUT_INVALID"),
  );
});

test("acceptance identity binds proposal, canonical summary, evidence scope, and review policy", () => {
  const fixture = createGraphFixture();
  const input = acceptanceIdentityInput(fixture);
  const first = deriveAcceptanceInputIdentity(input);

  assert.equal(first.acceptance_input_id, "c5c8732c72d86f2f40e16126ba4064c8037a55f43d7042082193a3cb0a3474d9");
  assert.notEqual(
    deriveAcceptanceInputIdentity({ ...input, review_policy: { version: "review-policy-v3" } }).acceptance_input_id,
    first.acceptance_input_id,
  );
  assert.throws(
    () =>
      deriveAcceptanceInputIdentity({
        ...input,
        evidence_bindings: input.evidence_bindings.map((binding, index) =>
          index === 0 ? { ...binding, content_sha256: "b".repeat(64) } : binding,
        ),
      }),
    hasCode("IDENTITY_INPUT_INVALID"),
  );
  assert.throws(
    () => deriveAcceptanceInputIdentity({ ...input, evidence_bindings: input.evidence_bindings.slice(0, 1) }),
    hasCode("IDENTITY_INPUT_INVALID"),
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

test("acceptance identity rejects evidence bindings that substitute an artifact type", () => {
  const fixture = createGraphFixture();
  const input = acceptanceIdentityInput(fixture);
  const substituted = input.evidence_bindings.map((binding) =>
    binding.artifact_type === "observation" ? { ...binding, artifact_type: "resource_observation" } : binding,
  );

  assert.throws(
    () => deriveAcceptanceInputIdentity({ ...input, evidence_bindings: substituted }),
    hasCode("IDENTITY_INPUT_INVALID"),
  );
});

test("acceptance identity canonicalizes binding object key order", () => {
  const fixture = createGraphFixture();
  const input = acceptanceIdentityInput(fixture);
  const reordered = input.evidence_bindings.map(({ artifact_id, artifact_type, content_sha256 }) => ({
    content_sha256,
    artifact_type,
    artifact_id,
  }));

  assert.equal(
    deriveAcceptanceInputIdentity({ ...input, evidence_bindings: reordered }).acceptance_input_id,
    deriveAcceptanceInputIdentity(input).acceptance_input_id,
  );
});

test("acceptance identity rejects duplicate canonical proposals for one unit", () => {
  const fixture = createGraphFixture();
  const duplicate = createHarnessArtifact({
    artifactType: "evaluator_proposal",
    artifactId: "proposal-duplicate",
    producer: fixture.proposal.producer,
    links: fixture.proposal.links,
    payload: fixture.proposal.payload,
  });
  const summary = createHarnessArtifact({
    artifactType: "run_review_summary",
    artifactId: "summary-duplicate-proposal",
    producer: fixture.summary.producer,
    links: [
      link("evaluator_proposal", duplicate),
      link("evaluator_proposal", fixture.proposal),
      link("execution_attempt", fixture.readerAttempt),
      link("execution_attempt", fixture.evaluatorAttempt),
      link("run", fixture.run),
    ],
    payload: fixture.summary.payload,
  });
  const input = acceptanceIdentityInput(fixture);

  assert.throws(
    () => deriveAcceptanceInputIdentity({ ...input, proposals: [duplicate, fixture.proposal], summary }),
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

test("CP3 store root is fixed under git-common-dir and independent of worktree provenance", () => {
  const repository = temporaryDirectory("harness-repository-");
  const common = temporaryDirectory("harness-common-");

  const first = resolveHarnessStoreRoot(repository, { gitCommonDir: common });
  const second = resolveHarnessStoreRoot(repository, { gitCommonDir: common });

  assert.equal(first, join(common, "vocaspace-agent-skill-evals", "v2"));
  assert.equal(second, first);
});

test("CP3 content-addressed objects are immutable and detect address corruption", () => {
  const { root, task } = createStoreFixture();
  const path = writeArtifactObject(root, task);

  assert.equal(readArtifactObject(root, task.content_sha256).artifact_id, "task-one");
  assert.equal(writeArtifactObject(root, task), path);
  writeFileSync(path, `${canonicalJson({ corrupted: true })}\n`);
  assert.throws(() => readArtifactObject(root, task.content_sha256), hasCode("ARTIFACT_SCHEMA_INVALID"));
});

test("CP3 run state uses guarded transitions and compare-and-swap revisions", () => {
  const fixture = createStoreFixture();
  const { root } = fixture;

  const preflight = transitionRun(root, transitionOptions(fixture, 0, "preflight"));

  assert.equal(preflight.payload.revision, 1);
  assert.equal(preflight.payload.state, "preflight");
  assert.throws(
    () => transitionRun(root, { runId: "run-one", expectedRevision: 1, nextState: "readiness", now: timestamp }),
    hasCode("LEASE_REQUIRED"),
  );
  assert.throws(
    () => transitionRun(root, transitionOptions(fixture, 0, "readiness")),
    hasCode("RUN_REVISION_CONFLICT"),
  );
  assert.throws(
    () => transitionRun(root, transitionOptions(fixture, 1, "completed")),
    hasCode("RUN_TRANSITION_INVALID"),
  );
});

test("CP3 rerun_required must return through preflight before readiness", () => {
  const fixture = createStoreFixture();
  const states = ["preflight", "readiness", "ready", "reading", "reader_complete", "evaluating", "review_pending", "rerun_required"];
  states.forEach((state, index) => transitionRun(fixture.root, transitionOptions(fixture, index, state)));

  assert.throws(
    () => transitionRun(fixture.root, transitionOptions(fixture, 8, "readiness")),
    hasCode("RUN_TRANSITION_INVALID"),
  );
  assert.equal(transitionRun(fixture.root, transitionOptions(fixture, 8, "preflight")).payload.state, "preflight");
});

test("CP3 recovery completes a journaled state transition after a manifest-boundary fault", () => {
  const fixture = createStoreFixture();
  const { root } = fixture;
  assert.throws(
    () =>
      transitionRun(root, {
        ...transitionOptions(fixture, 0, "preflight"),
        faultAt: "transition.after-journal",
      }),
    hasCode("INJECTED_FAULT"),
  );
  assert.equal(loadRunManifest(root, "run-one").payload.revision, 0);

  const recovered = recoverRun(root, "run-one", mutationOptions(fixture));

  assert.equal(recovered.manifest.payload.revision, 1);
  assert.equal(recovered.manifest.payload.state, "preflight");
});

test("CP3 immutable attempt phases preserve one logical attempt without overwrites", () => {
  const fixture = createStoreFixture();
  const phases = createAttemptPhaseFixture(fixture, "attempt-store-one", "unit-one");

  appendAttemptPhase(fixture.root, phases.prepared, mutationOptions(fixture));
  appendAttemptPhase(fixture.root, phases.dispatched, mutationOptions(fixture));
  appendAttemptPhase(fixture.root, phases.terminal, mutationOptions(fixture));

  const stored = readAttemptPhases(fixture.root, "run-one", "attempt-store-one");
  assert.deepEqual(Object.keys(stored), ["prepared", "dispatched", "terminal"]);
  assert.equal(new Set(Object.values(stored).map((item) => item.payload.attempt_id)).size, 1);
  assert.equal(new Set(Object.values(stored).map((item) => item.artifact_id)).size, 3);
  assert.throws(
    () =>
      appendAttemptPhase(
        fixture.root,
        reseal({ ...phases.terminal, payload: { ...phases.terminal.payload, outcome: "error" } }),
        mutationOptions(fixture),
      ),
    hasCode("ATTEMPT_IMMUTABLE"),
  );
});

test("CP3 attempt transition guards reject skipped phases and changed logical fields", () => {
  const fixture = createStoreFixture();
  const phases = createAttemptPhaseFixture(fixture, "attempt-store-two", "unit-one");
  assert.throws(
    () => appendAttemptPhase(fixture.root, phases.dispatched, mutationOptions(fixture)),
    hasCode("ATTEMPT_TRANSITION_INVALID"),
  );
  appendAttemptPhase(fixture.root, phases.prepared, mutationOptions(fixture));
  const changed = createHarnessArtifact({
    ...artifactCreationFields(phases.dispatched),
    payload: { ...phases.dispatched.payload, input_sha256: "b".repeat(64) },
  });
  assert.throws(
    () => appendAttemptPhase(fixture.root, changed, mutationOptions(fixture)),
    hasCode("ATTEMPT_TRANSITION_INVALID"),
  );
});

test("CP3 attempt readers fail loud on unexpected records", () => {
  const fixture = createStoreFixture();
  const phases = createAttemptPhaseFixture(fixture, "attempt-extra-record", "unit-one");
  appendAttemptPhase(fixture.root, phases.prepared, mutationOptions(fixture));
  writeFileSync(join(fixture.root, "runs", "run-one", "attempts", "attempt-extra-record", "unexpected.json"), "{}\n");

  assert.throws(
    () => readAttemptPhases(fixture.root, "run-one", "attempt-extra-record"),
    hasCode("ATTEMPT_RECORD_CORRUPT"),
  );
});

test("CP3 recovery converts a persisted dispatched call into terminal outcome_unknown without retry", () => {
  const fixture = createStoreFixture();
  const phases = createAttemptPhaseFixture(fixture, "attempt-crash", "unit-one");
  appendAttemptPhase(fixture.root, phases.prepared, mutationOptions(fixture));
  appendAttemptPhase(fixture.root, phases.dispatched, mutationOptions(fixture));

  const recovered = recoverRun(
    fixture.root,
    "run-one",
    mutationOptions(fixture, { now: "2026-08-20T00:00:01.000Z" }),
  );
  const attempt = recovered.attempts.find((item) => item.attempt_id === "attempt-crash");

  assert.equal(attempt.phases.terminal.payload.outcome, "outcome_unknown");
  assert.equal(attempt.phases.terminal.payload.call_certainty, "unknown");
  assert.equal(recovered.attempts.length, 1);
  const resume = planResume(fixture.root, "run-one");
  assert.deepEqual(resume.blocked_unit_ids, ["unit-one"]);
  assert.deepEqual(resume.incomplete_unit_ids, ["unit-two"]);
  assert.equal(resume.first_incomplete_unit_id, "unit-one");
});

test("CP3 recovery reconciles an attempt record persisted before its journal event", () => {
  const fixture = createStoreFixture();
  const phases = createAttemptPhaseFixture(fixture, "attempt-journal-fault", "unit-one");
  assert.throws(
    () =>
      appendAttemptPhase(
        fixture.root,
        phases.prepared,
        mutationOptions(fixture, { faultAt: "attempt.after-record" }),
      ),
    hasCode("INJECTED_FAULT"),
  );

  const recovered = recoverRun(fixture.root, "run-one", mutationOptions(fixture));

  assert.ok(recovered.journal.some((event) => event.details.attempt_id === "attempt-journal-fault"));
  assert.equal(recovered.attempts[0].phases.prepared.content_sha256, phases.prepared.content_sha256);
});

test("CP3 journal fails loud on corruption instead of accepting partial history", () => {
  const { root } = createStoreFixture();
  const journalPath = join(root, "runs", "run-one", "journal.ndjson");
  const journal = readFileSync(journalPath, "utf8");
  writeFileSync(journalPath, journal.replace("run_created", "run_corrupt"));

  assert.throws(() => inspectRunState(root, "run-one"), hasCode("JOURNAL_CORRUPT"));
});

test("CP3 journal rejects a rehashed event with discontinuous revision semantics", () => {
  const { root } = createStoreFixture();
  const journalPath = join(root, "runs", "run-one", "journal.ndjson");
  const event = JSON.parse(readFileSync(journalPath, "utf8"));
  event.next_revision = 1;
  const envelope = { ...event };
  delete envelope.event_sha256;
  event.event_sha256 = sha256Canonical(envelope);
  writeFileSync(journalPath, `${JSON.stringify(event)}\n`);

  assert.throws(() => inspectRunState(root, "run-one"), hasCode("JOURNAL_CORRUPT"));
});

test("CP3 store rejects a link whose declared identity disagrees with its exact object", () => {
  const fixture = createStoreFixture();
  const phases = createAttemptPhaseFixture(fixture, "attempt-bad-link", "unit-one");
  const links = phases.prepared.links.map((item) =>
    item.relationship === "compiled_invocation"
      ? {
          ...item,
          target_content_sha256: fixture.evaluatorInvocation.content_sha256,
          target_artifact_id: fixture.readerInvocation.artifact_id,
        }
      : item,
  );
  const malformed = createHarnessArtifact({ ...artifactCreationFields(phases.prepared), links, payload: phases.prepared.payload });

  assert.throws(
    () => appendAttemptPhase(fixture.root, malformed, mutationOptions(fixture)),
    hasCode("STORE_LINK_CORRUPT"),
  );
});

test("CP3 leases reject live contention and recover only stale inactive ownership", () => {
  const { root } = createStoreFixture({ acquireLease: false });
  const lease = acquireRunLease(root, "run-one", {
    durationMs: 1000,
    host: "fixture-host",
    isPidActive: () => true,
    now: "2026-08-20T00:00:00.000Z",
    owner: "owner-one",
    pid: 101,
    token: "lease-one",
  });
  assert.throws(
    () =>
      acquireRunLease(root, "run-one", {
        host: "fixture-host",
        isPidActive: () => true,
        now: "2026-08-20T00:00:00.500Z",
      }),
    hasCode("LEASE_HELD"),
  );
  assert.throws(
    () =>
      acquireRunLease(root, "run-one", {
        host: "fixture-host",
        isPidActive: () => true,
        now: "2026-08-20T00:00:02.000Z",
      }),
    hasCode("LEASE_HELD"),
  );
  const replacement = acquireRunLease(root, "run-one", {
    host: "fixture-host",
    isPidActive: () => false,
    now: "2026-08-20T00:00:02.000Z",
    owner: "owner-two",
    pid: 202,
    token: "lease-two",
  });
  assert.equal(replacement.token, "lease-two");
  assert.equal(releaseRunLease(root, "run-one", replacement.token, { now: timestamp }).state, "released");
  assert.equal(lease.token, "lease-one");
});

test("CP3 resume planning reuses only successful units and stops at uncertain calls", () => {
  const fixture = createStoreFixture();
  const successful = createAttemptPhaseFixture(fixture, "attempt-success", "unit-one");
  const uncertain = createAttemptPhaseFixture(fixture, "attempt-uncertain", "unit-two");
  for (const artifact of Object.values(successful)) {
    appendAttemptPhase(fixture.root, artifact, mutationOptions(fixture));
  }
  appendAttemptPhase(fixture.root, uncertain.prepared, mutationOptions(fixture));
  appendAttemptPhase(fixture.root, uncertain.dispatched, mutationOptions(fixture));

  const plan = planResume(fixture.root, "run-one");

  assert.deepEqual(plan.reusable_unit_ids, ["unit-one"]);
  assert.deepEqual(plan.blocked_unit_ids, ["unit-two"]);
  assert.equal(plan.first_incomplete_unit_id, "unit-two");
});

test("CP3 resume planning retries a prepared call that is confirmed not started", () => {
  const fixture = createStoreFixture();
  const phases = createAttemptPhaseFixture(fixture, "attempt-prepared", "unit-one");
  appendAttemptPhase(fixture.root, phases.prepared, mutationOptions(fixture));

  const plan = planResume(fixture.root, "run-one");

  assert.deepEqual(plan.blocked_unit_ids, []);
  assert.deepEqual(plan.incomplete_unit_ids, ["unit-one", "unit-two"]);
  assert.equal(plan.first_incomplete_unit_id, "unit-one");
});

test("CP3 rejects duplicate or skipped retry sequence numbers for one unit", () => {
  const fixture = createStoreFixture();
  const first = createAttemptPhaseFixture(fixture, "attempt-sequence-one", "unit-one");
  const duplicate = createAttemptPhaseFixture(fixture, "attempt-sequence-duplicate", "unit-one");
  appendAttemptPhase(fixture.root, first.prepared, mutationOptions(fixture));

  assert.throws(
    () => appendAttemptPhase(fixture.root, duplicate.prepared, mutationOptions(fixture)),
    hasCode("ATTEMPT_SEQUENCE_CONFLICT"),
  );
  const skipped = createHarnessArtifact({
    ...artifactCreationFields(duplicate.prepared),
    artifactId: "attempt-sequence-skipped-prepared",
    payload: {
      ...duplicate.prepared.payload,
      attempt_id: "attempt-sequence-skipped",
      sequence: 3,
    },
  });
  assert.throws(
    () => appendAttemptPhase(fixture.root, skipped, mutationOptions(fixture)),
    hasCode("ATTEMPT_SEQUENCE_CONFLICT"),
  );
});

test("CP3 rejects a discontinuous retry history already present in the durable store", () => {
  const fixture = createStoreFixture();
  const first = createAttemptPhaseFixture(fixture, "attempt-sequence-stored-one", "unit-one");
  appendAttemptPhase(fixture.root, first.prepared, mutationOptions(fixture));
  const skipped = createHarnessArtifact({
    ...artifactCreationFields(first.prepared),
    artifactId: "attempt-sequence-stored-three-prepared",
    payload: {
      ...first.prepared.payload,
      attempt_id: "attempt-sequence-stored-three",
      sequence: 3,
    },
  });
  writeArtifactObject(fixture.root, skipped);
  const skippedDirectory = join(
    fixture.root,
    "runs",
    "run-one",
    "attempts",
    "attempt-sequence-stored-three",
  );
  mkdirSync(skippedDirectory, { recursive: true });
  writeFileSync(join(skippedDirectory, "prepared.json"), canonicalHarnessJson(skipped));

  assert.throws(() => inspectRunState(fixture.root, "run-one"), hasCode("ATTEMPT_RECORD_CORRUPT"));
});

test("CP4 compiler exposes the exact policy and complete readiness issues single-use grants", () => {
  const fixture = createReadinessFixture();

  const result = executeFixtureReadiness(fixture);

  assert.equal(result.status, "passed");
  assert.equal(result.analyses.length, 1);
  assert.equal(result.analyses[0].reader.payload.grants.length, 1);
  assert.match(fixture.reader.payload.messages[0].content, /^EXECUTION_POLICY_V2\n/);
  const grant = result.analyses[0].reader.payload.grants[0];
  const guard = createDispatchGuard({
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: fixture.evaluatorStatic,
    readinessSet: result.analyses[0],
    readerInvocations: [fixture.reader],
    run: fixture.run,
    task: fixture.task,
  });
  const authorized = guard.authorize(fixture.reader, grant.nonce);
  assert.equal(authorized.invocation_sha256, fixture.reader.content_sha256);
  assert.throws(() => guard.authorize(fixture.reader, grant.nonce), hasCode("DISPATCH_GRANT_INVALID"));
});

test("CP4 historical P0 mismatch blocks the complete reader set before adapter call zero", () => {
  const fixture = createReadinessFixture();
  fixture.reader = reseal({ ...fixture.reader, payload: { ...fixture.reader.payload, messages: fixture.reader.payload.messages.slice(1) } });
  fixture.readers = [fixture.reader];
  let adapterCalls = 0;

  const result = executeFixtureReadiness(fixture);
  for (const ignored of result.analyses.at(-1).reader.payload.grants) adapterCalls += ignored ? 1 : 0;

  assert.equal(result.status, "blocked");
  assert.equal(adapterCalls, 0);
  assert.equal(result.analyses[0].reader.payload.grants.length, 0);
  assert.ok(result.analyses[0].reader.payload.field_results.some((item) => item.field.endsWith("model-visible-policy") && item.status === "failed"));
});

test("CP4 unsupported enforcement fails closed with zero reader grants", () => {
  const fixture = createReadinessFixture();
  fixture.capabilities = structuredClone(fixture.capabilities);
  fixture.capabilities.policy.filesystem = ["none"];

  const result = executeFixtureReadiness(fixture);

  assert.equal(result.status, "blocked");
  assert.equal(result.analyses[0].reader.payload.grants.length, 0);
  assert.ok(result.analyses[0].reader.payload.field_results.some((item) => item.field.endsWith("policy-filesystem") && item.status === "failed"));
});

test("CP4 every mandatory policy dimension is capability-attested", async (t) => {
  for (const field of ["credentials", "filesystem", "fresh_context", "mutation", "network", "remote_actions"]) {
    await t.test(field, () => {
      const fixture = createReadinessFixture();
      fixture.capabilities = structuredClone(fixture.capabilities);
      fixture.capabilities.policy[field] = field === "fresh_context" ? false : [];
      const result = executeFixtureReadiness(fixture);
      assert.equal(result.status, "blocked");
      assert.equal(result.analyses[0].reader.payload.grants.length, 0);
    });
  }
});

test("CP4 model-visible/tool/resource/protocol exposure and output schema all fail closed", async (t) => {
  for (const exposure of ["model_visible_policy", "observation_protocol", "supplied_resources", "tool_allowlist"]) {
    await t.test(exposure, () => {
      const fixture = createReadinessFixture();
      fixture.capabilities = structuredClone(fixture.capabilities);
      fixture.capabilities.exposes[exposure] = false;
      const result = executeFixtureReadiness(fixture);
      assert.equal(result.status, "blocked");
      assert.equal(result.analyses[0].reader.payload.grants.length, 0);
    });
  }
  await t.test("output_schema", () => {
    const fixture = createReadinessFixture();
    fixture.capabilities = structuredClone(fixture.capabilities);
    fixture.capabilities.output_schemas = ["proposal-v2"];
    const result = executeFixtureReadiness(fixture);
    assert.equal(result.status, "blocked");
    assert.equal(result.analyses[0].reader.payload.grants.length, 0);
  });
});

test("CP4 one failing reader blocks grants for every otherwise-valid reader in the planned set", () => {
  const fixture = createReadinessFixture({ twoReaders: true });
  fixture.readers[1] = reseal({
    ...fixture.readers[1],
    payload: { ...fixture.readers[1].payload, messages: fixture.readers[1].payload.messages.slice(1) },
  });

  const result = executeFixtureReadiness(fixture);

  assert.equal(result.status, "blocked");
  assert.equal(result.analyses[0].reader.payload.grants.length, 0);
  assert.ok(result.analyses[0].reader.payload.field_results.some((item) => item.field.startsWith("unit-three-") && item.status === "failed"));
});

test("CP4 evaluator static rubric/protocol/runtime binding is part of the pre-reader barrier", () => {
  const fixture = createReadinessFixture();
  fixture.evaluatorStatic.invocation = reseal({
    ...fixture.evaluatorStatic.invocation,
    payload: {
      ...fixture.evaluatorStatic.invocation.payload,
      messages: fixture.evaluatorStatic.invocation.payload.messages.filter(
        (message) => !message.content.startsWith("EVALUATOR_STATIC_PLAN_V2\n"),
      ),
    },
  });

  const result = executeFixtureReadiness(fixture);

  assert.equal(result.status, "blocked");
  assert.equal(result.analyses[0].reader.payload.grants.length, 0);
  assert.ok(result.analyses[0].evaluator_static.payload.field_results.some((item) => item.field === "static-rubric" && item.status === "failed"));
});

test("CP4 Round 1 runtime must match the initial durable run runtime configuration", () => {
  const fixture = createReadinessFixture();
  const mismatched = createReadinessFixture({ run: fixture.run, temperature: 1 });

  assert.throws(
    () =>
      executeReadiness({
        adapterCapabilities: fixture.capabilities,
        rounds: [readinessRound(mismatched)],
        run: fixture.run,
        task: fixture.task,
      }),
    hasCode("READINESS_RUNTIME_MISMATCH"),
  );
});

test("CP4 rejects an unnecessary Round 2 after Round 1 already passes", () => {
  const fixture = createReadinessFixture();
  const corrected = createReadinessFixture({ run: fixture.run, temperature: 1 });
  const correction = {
    after_sha256: sha256Canonical(corrected.runtime),
    before_sha256: sha256Canonical(fixture.runtime),
    changed_fields: ["runtime-parameters-temperature"],
  };

  assert.throws(
    () =>
      executeReadiness({
        adapterCapabilities: fixture.capabilities,
        correction,
        rounds: [readinessRound(fixture), readinessRound(corrected)],
        run: fixture.run,
        task: fixture.task,
      }),
    hasCode("READINESS_CORRECTION_INVALID"),
  );
});

test("CP4 refuses to use Round 2 to repair a non-runtime P0 failure", () => {
  const fixture = createReadinessFixture();
  const corrected = createReadinessFixture({ run: fixture.run, temperature: 1 });
  const first = readinessRound(fixture);
  first.readerInvocations[0] = reseal({
    ...first.readerInvocations[0],
    payload: {
      ...first.readerInvocations[0].payload,
      messages: first.readerInvocations[0].payload.messages.slice(1),
    },
  });
  corrected.reader = reseal({
    ...corrected.reader,
    payload: {
      ...corrected.reader.payload,
      messages: corrected.reader.payload.messages.slice(1),
    },
  });
  corrected.readers = [corrected.reader];
  const correction = {
    after_sha256: sha256Canonical(corrected.runtime),
    before_sha256: sha256Canonical(fixture.runtime),
    changed_fields: ["runtime-parameters-temperature"],
  };

  assert.throws(
    () =>
      executeReadiness({
        adapterCapabilities: fixture.capabilities,
        correction,
        rounds: [first, readinessRound(corrected)],
        run: fixture.run,
        task: fixture.task,
      }),
    hasCode("READINESS_CORRECTION_SCOPE"),
  );
});

test("CP4 permits exactly one ephemeral runtime-parameter correction and no Round 3", () => {
  const fixture = createReadinessFixture();
  const first = readinessRound(fixture);
  const corrected = createReadinessFixture({ run: fixture.run, temperature: 1 });
  const second = readinessRound(corrected);
  first.evaluatorStatic.staticPlan = {
    ...first.evaluatorStatic.staticPlan,
    runtime_config_sha256: second.evaluatorStatic.staticPlan.runtime_config_sha256,
  };
  first.evaluatorStatic.invocation = compileEvaluatorStaticInvocation({
    ...evaluatorCompileInput(fixture, first.evaluatorStatic.staticPlan),
  });
  const correction = {
    after_sha256: sha256Canonical(second.runtimeConfig),
    before_sha256: sha256Canonical(first.runtimeConfig),
    changed_fields: ["runtime-parameters-temperature"],
  };

  const result = executeReadiness({
    adapterCapabilities: fixture.capabilities,
    correction,
    rounds: [first, second],
    run: fixture.run,
    task: fixture.task,
  });

  assert.equal(result.status, "passed");
  assert.deepEqual(result.analyses.map((item) => item.reader.payload.round), [1, 2]);
  const terminal = result.analyses.at(-1);
  const guard = createDispatchGuard({
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: corrected.evaluatorStatic,
    readinessSet: terminal,
    readerInvocations: corrected.readers,
    run: fixture.run,
    task: fixture.task,
  });
  assert.equal(
    guard.authorize(corrected.reader, terminal.reader.payload.grants[0].nonce).invocation_sha256,
    corrected.reader.content_sha256,
  );
  assert.throws(
    () =>
      executeReadiness({
        adapterCapabilities: fixture.capabilities,
        correction,
        rounds: [first, second, second],
        run: fixture.run,
        task: fixture.task,
      }),
    hasCode("READINESS_ROUND_INVALID"),
  );
});

test("CP4 rejects a Round 2 correction that mutates a durable contract", () => {
  const fixture = createReadinessFixture();
  const first = readinessRound(fixture);
  const corrected = createReadinessFixture({ run: fixture.run, temperature: 1 });
  const second = readinessRound(corrected);
  second.readerInvocations[0] = reseal({
    ...second.readerInvocations[0],
    payload: { ...second.readerInvocations[0].payload, protocol: { ...second.readerInvocations[0].payload.protocol, output_schema: "changed-v2" } },
  });
  const correction = {
    after_sha256: sha256Canonical(second.runtimeConfig),
    before_sha256: sha256Canonical(first.runtimeConfig),
    changed_fields: ["runtime-parameters-temperature"],
  };

  assert.throws(
    () => executeReadiness({ adapterCapabilities: fixture.capabilities, correction, rounds: [first, second], run: fixture.run, task: fixture.task }),
    hasCode("READINESS_DURABLE_MUTATION"),
  );
});

test("CP4 correction audit must enumerate the exact runtime-parameter diff", () => {
  const firstFixture = createReadinessFixture();
  const secondFixture = createReadinessFixture({
    run: firstFixture.run,
    runtimeParameters: { top_p: 0.5 },
    temperature: 1,
  });
  const first = readinessRound(firstFixture);
  const second = readinessRound(secondFixture);
  const correction = {
    after_sha256: sha256Canonical(second.runtimeConfig),
    before_sha256: sha256Canonical(first.runtimeConfig),
    changed_fields: ["runtime-parameters-temperature"],
  };

  assert.throws(
    () =>
      executeReadiness({
        adapterCapabilities: firstFixture.capabilities,
        correction,
        rounds: [first, second],
        run: firstFixture.run,
        task: firstFixture.task,
      }),
    hasCode("READINESS_CORRECTION_INVALID"),
  );
});

test("CP4 helper defaults to zero calls and cannot open multiple clusters or exceed two calls", () => {
  const fixture = createReadinessFixture();
  const defaultResult = executeFixtureReadiness(fixture);
  const cluster = helperCluster(fixture);

  assert.deepEqual(defaultResult.helper, { call_count: 0, cluster_id: null, status: "not_requested" });
  assert.throws(
    () => executeFixtureReadiness(fixture, { helper: { clusters: [cluster, { ...cluster, cluster_id: "cluster-two" }], contract: { max_calls: 1 } } }),
    hasCode("HELPER_CLUSTER_LIMIT"),
  );
  assert.throws(
    () => executeFixtureReadiness(fixture, { helper: { clusters: [cluster], contract: { max_calls: 3 } } }),
    hasCode("HELPER_CALL_LIMIT"),
  );
});

test("CP4 deterministic fixture helpers are bounded, separately audited, and non-semantic", () => {
  const fixture = createReadinessFixture();
  const cluster = helperCluster(fixture);
  const result = executeFixtureReadiness(fixture, {
    helper: {
      clusters: [cluster],
      contract: { max_calls: 2 },
      fixtureAdapter: { kind: "deterministic_fixture", resolve: (_input, index) => ({ resolved: index === 2 }) },
    },
  });

  assert.equal(result.status, "passed");
  assert.deepEqual(result.helper, { call_count: 2, cluster_id: "cluster-one", status: "resolved" });
  const helperAttempts = result.artifacts.filter((item) => item.artifact_type === "execution_attempt");
  assert.equal(helperAttempts.length, 6);
  assert.ok(helperAttempts.every((item) => item.payload.role === "verification_helper" && item.payload.unit_id === null));
  assert.equal(result.analyses[0].reader.payload.helper_attempt_ids.length, 2);
  const support = result.artifacts.filter(
    (item) =>
      item.artifact_type === "execution_attempt" ||
      item.artifact_type === "verification_helper_input" ||
      (item.artifact_type === "compiled_invocation" && item.payload.role === "verification_helper"),
  );
  const guard = createDispatchGuard({
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: fixture.evaluatorStatic,
    readinessSet: result.analyses[0],
    readerInvocations: fixture.readers,
    run: fixture.run,
    supportingArtifacts: support,
    task: fixture.task,
  });
  assert.equal(
    guard.authorize(fixture.reader, result.analyses[0].reader.payload.grants[0].nonce).unit_id,
    "unit-one",
  );
});

test("CP4 readiness cannot claim helper audit IDs without exact terminal helper links", () => {
  const fixture = createReadinessFixture();
  const result = executeFixtureReadiness(fixture, {
    helper: {
      clusters: [helperCluster(fixture)],
      contract: { max_calls: 1 },
      fixtureAdapter: { kind: "deterministic_fixture", resolve: () => ({ resolved: true }) },
    },
  });
  const reader = result.analyses[0].reader;
  const malformed = reseal({
    ...reader,
    links: reader.links.filter((item) => item.relationship !== "helper_attempt"),
  });
  const support = result.artifacts.filter(
    (item) => !["readiness_analysis"].includes(item.artifact_type),
  );

  assert.throws(
    () => validateArtifactGraph([fixture.task, fixture.run, fixture.reader, fixture.evaluatorStatic.invocation, ...support, malformed]),
    hasCode("ARTIFACT_RELATIONSHIP_INVALID"),
  );
});

test("CP4 helpers cannot bypass P0 or run without the deterministic fixture authority", () => {
  const fixture = createReadinessFixture();
  const cluster = helperCluster(fixture);
  assert.throws(
    () => executeFixtureReadiness(fixture, { helper: { clusters: [{ ...cluster, category: "p0" }], contract: { max_calls: 1 }, fixtureAdapter: { kind: "deterministic_fixture", resolve: () => ({ resolved: true }) } } }),
    hasCode("HELPER_P0_BYPASS"),
  );
  assert.throws(
    () => executeFixtureReadiness(fixture, { helper: { clusters: [cluster], contract: { max_calls: 1 }, fixtureAdapter: { kind: "provider", resolve: () => ({ resolved: true }) } } }),
    hasCode("HELPER_AUTHORITY_REQUIRED"),
  );
});

test("CP4 unresolved helper uncertainty remains blocked and cannot disappear in Round 2", () => {
  const firstFixture = createReadinessFixture();
  const secondFixture = createReadinessFixture({ run: firstFixture.run, temperature: 1 });
  const first = readinessRound(firstFixture);
  const second = readinessRound(secondFixture);
  first.evaluatorStatic.staticPlan = {
    ...first.evaluatorStatic.staticPlan,
    runtime_config_sha256: second.evaluatorStatic.staticPlan.runtime_config_sha256,
  };
  first.evaluatorStatic.invocation = compileEvaluatorStaticInvocation({
    ...evaluatorCompileInput(firstFixture, first.evaluatorStatic.staticPlan),
  });
  const correction = {
    after_sha256: sha256Canonical(second.runtimeConfig),
    before_sha256: sha256Canonical(first.runtimeConfig),
    changed_fields: ["runtime-parameters-temperature"],
  };
  const result = executeReadiness({
    adapterCapabilities: firstFixture.capabilities,
    correction,
    helper: { clusters: [helperCluster(firstFixture)], contract: { max_calls: 0 } },
    rounds: [first, second],
    run: firstFixture.run,
    task: firstFixture.task,
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.analyses.at(-1).reader.payload.grants.length, 0);
});

test("CP4 dispatch guard rejects TOCTOU invocation changes before a fake adapter call", () => {
  const fixture = createReadinessFixture();
  const result = executeFixtureReadiness(fixture);
  const changed = reseal({
    ...fixture.reader,
    payload: { ...fixture.reader.payload, messages: [...fixture.reader.payload.messages, { content: "changed", role: "user" }] },
  });
  let calls = 0;

  assert.throws(
    () => {
      const guard = createDispatchGuard({
        adapterCapabilities: fixture.capabilities,
        evaluatorStatic: fixture.evaluatorStatic,
        readinessSet: result.analyses[0],
        readerInvocations: [changed],
        run: fixture.run,
        task: fixture.task,
      });
      guard.authorize(changed, result.analyses[0].reader.payload.grants[0].nonce);
      calls += 1;
    },
  );
  assert.equal(calls, 0);
});

test("CP4 preflight housekeeping is a deterministic non-destructive preview", () => {
  const preview = createPreflightHousekeepingPreview({ runId: "run-one", taskId: "task-one" });

  assert.equal(preview.dry_run, true);
  assert.equal(preview.destructive_actions, 0);
  assert.deepEqual(preview.actions.map((item) => item.action), ["retain", "retain", "retain", "retain"]);
});

test("CP4 helper identity binds cluster, exact compiled invocation, and runtime config", () => {
  const fixture = createReadinessFixture();
  const cluster = helperCluster(fixture);
  const first = deriveHelperInputIdentity({ cluster, compiledInvocation: fixture.reader, runtimeConfig: fixture.reader.payload.runtime });
  const changed = deriveHelperInputIdentity({
    cluster: { ...cluster, question: "Changed question" },
    compiledInvocation: fixture.reader,
    runtimeConfig: fixture.reader.payload.runtime,
  });

  assert.notEqual(first.helper_input_hash, changed.helper_input_hash);
  assert.equal(Object.hasOwn(first.canonical_input, "run_id"), false);
});

test("Stage 1 persists and reloads the complete CP4 helper/readiness graph through the CP3 store", () => {
  const store = createStoreFixture();
  const readiness = createReadinessFixture();
  const result = executeFixtureReadiness(readiness, {
    helper: {
      clusters: [helperCluster(readiness)],
      contract: { max_calls: 1 },
      fixtureAdapter: { kind: "deterministic_fixture", resolve: () => ({ resolved: true }) },
    },
  });
  writeArtifactObject(store.root, readiness.reader);
  writeArtifactObject(store.root, readiness.evaluatorStatic.invocation);
  for (const artifact of result.artifacts.filter((item) => item.artifact_type === "compiled_invocation")) {
    writeArtifactObject(store.root, artifact);
  }
  for (const artifact of result.artifacts.filter((item) => item.artifact_type === "verification_helper_input")) {
    writeArtifactObject(store.root, artifact);
  }
  for (const artifact of result.artifacts.filter((item) => item.artifact_type === "execution_attempt")) {
    appendAttemptPhase(store.root, artifact, mutationOptions(store));
  }
  for (const artifact of result.artifacts.filter((item) => item.artifact_type === "readiness_analysis")) {
    writeArtifactObject(store.root, artifact);
  }

  initializeRunStore(store.root);
  const reloaded = [
    readiness.reader,
    readiness.evaluatorStatic.invocation,
    ...result.artifacts,
  ].map((artifact) => readArtifactObject(store.root, artifact.content_sha256));

  assert.equal(reloaded.length, 9);
  assert.equal(reloaded.filter((item) => item.artifact_type === "readiness_analysis").length, 2);
  assert.equal(readAttemptPhases(store.root, "run-one", "cluster-one-helper-1").terminal.payload.outcome, "success");
});

test("CP5 sequential reader persists validated evidence and reaches reader_complete", async () => {
  const fixture = createReadinessFixture();
  const readiness = executeFixtureReadiness(fixture).analyses.at(-1);
  const workflow = createWorkflowStore(fixture, readiness);
  const calls = [];

  const result = await runSequentialReaderStage({
    adapter: fixtureReaderAdapter(calls),
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: fixture.evaluatorStatic,
    leaseToken: workflow.lease.token,
    readinessSet: readiness,
    readerInvocations: fixture.readers,
    run: fixture.run,
    storeRoot: workflow.root,
    task: fixture.task,
  });

  assert.equal(result.run_state, "reader_complete");
  assert.deepEqual(result.newly_executed_unit_ids, ["unit-one"]);
  assert.deepEqual(result.reused_unit_ids, []);
  assert.equal(result.calls, 1);
  assert.equal(calls.length, 1);
  assert.equal(listStoredArtifacts(workflow.root, { artifactType: "observation", runId: "run-one" }).length, 1);
  assert.deepEqual(deriveReaderProgress(workflow.root, "run-one"), {
    blocked: 0,
    complete: 1,
    incomplete: 0,
    requested: 1,
  });
});

test("CP5 restart reuses exact completed readers and resumes only the incomplete unit", async () => {
  const fixture = createReadinessFixture({ twoReaders: true });
  const readiness = executeFixtureReadiness(fixture).analyses.at(-1);
  const workflow = createWorkflowStore(fixture, readiness);
  const calls = [];
  const adapter = fixtureReaderAdapter(calls);

  const partial = await runSequentialReaderStage({
    adapter,
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: fixture.evaluatorStatic,
    leaseToken: workflow.lease.token,
    maxDispatches: 1,
    readinessSet: readiness,
    readerInvocations: fixture.readers,
    run: fixture.run,
    storeRoot: workflow.root,
    task: fixture.task,
  });
  const resumed = await runSequentialReaderStage({
    adapter,
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: fixture.evaluatorStatic,
    leaseToken: workflow.lease.token,
    readinessSet: readiness,
    readerInvocations: fixture.readers,
    run: fixture.run,
    storeRoot: workflow.root,
    task: fixture.task,
  });

  assert.equal(partial.run_state, "reading");
  assert.equal(partial.first_incomplete_unit_id, "unit-three");
  assert.equal(resumed.run_state, "reader_complete");
  assert.deepEqual(resumed.resumed_unit_ids, ["unit-one"]);
  assert.deepEqual(resumed.reused_unit_ids, []);
  assert.deepEqual(resumed.newly_executed_unit_ids, ["unit-one", "unit-three"]);
  assert.deepEqual(calls, ["unit-one", "unit-three"]);
});

test("CP5 reader identity change reruns only the exact affected unit and preserves its history", async () => {
  const fixture = createReadinessFixture({ twoReaders: true });
  const readiness = executeFixtureReadiness(fixture).analyses.at(-1);
  const workflow = createWorkflowStore(fixture, readiness);
  await runSequentialReaderStage({
    adapter: fixtureReaderAdapter([]),
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: fixture.evaluatorStatic,
    leaseToken: workflow.lease.token,
    readinessSet: readiness,
    readerInvocations: fixture.readers,
    run: fixture.run,
    storeRoot: workflow.root,
    task: fixture.task,
  });
  const changed = compileInvocation({
    artifactId: "cp5-reader-invocation-two-changed",
    messages: [{ content: "Read the changed second fixture and return an observation.", role: "user" }],
    protocol: fixture.readers[1].payload.protocol,
    requestedPolicy: fixture.readers[1].payload.requested_policy,
    resources: [],
    role: "reader",
    run: fixture.run,
    runtime: fixture.runtime,
    tools: [],
    unitId: "unit-three",
  });
  const changedReaders = [fixture.reader, changed];
  const changedReadiness = executeReadiness({
    adapterCapabilities: fixture.capabilities,
    rounds: [{ evaluatorStatic: fixture.evaluatorStatic, readerInvocations: changedReaders, runtimeConfig: fixture.runtime }],
    run: fixture.run,
    task: fixture.task,
  }).analyses.at(-1);
  for (const artifact of [changed, changedReadiness.reader, changedReadiness.evaluator_static]) {
    writeArtifactObject(workflow.root, artifact);
  }
  const current = loadRunManifest(workflow.root, "run-one");
  transitionRun(workflow.root, {
    expectedRevision: current.payload.revision,
    leaseToken: workflow.lease.token,
    nextState: "blocked",
    now: timestamp,
    runId: "run-one",
  });
  const calls = [];

  const corrected = await runSequentialReaderStage({
    adapter: fixtureReaderAdapter(calls),
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: fixture.evaluatorStatic,
    invalidatedUnitIds: ["unit-three"],
    leaseToken: workflow.lease.token,
    readinessSet: changedReadiness,
    readerInvocations: changedReaders,
    run: fixture.run,
    storeRoot: workflow.root,
    task: fixture.task,
  });

  assert.deepEqual(corrected.resumed_unit_ids, ["unit-one"]);
  assert.deepEqual(corrected.reused_unit_ids, []);
  assert.deepEqual(corrected.newly_executed_unit_ids, ["unit-one", "unit-three"]);
  assert.deepEqual(calls, ["unit-three"]);
  const unitThreeAttempts = inspectRunState(workflow.root, "run-one").attempts.filter(
    (record) => (record.phases.terminal ?? record.phases.dispatched ?? record.phases.prepared).payload.unit_id === "unit-three",
  );
  assert.deepEqual(unitThreeAttempts.map((record) => record.phases.terminal.payload.sequence), [1, 2]);

  const restoredCalls = [];
  const restored = await runSequentialReaderStage({
    adapter: fixtureReaderAdapter(restoredCalls),
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: fixture.evaluatorStatic,
    leaseToken: workflow.lease.token,
    readinessSet: readiness,
    readerInvocations: fixture.readers,
    run: fixture.run,
    storeRoot: workflow.root,
    task: fixture.task,
  });
  assert.deepEqual(restoredCalls, []);
  assert.deepEqual(restored.resumed_unit_ids, ["unit-one", "unit-three"]);
  assert.deepEqual(restored.reused_unit_ids, []);
  assert.deepEqual(restored.newly_executed_unit_ids, ["unit-one", "unit-three"]);
  assert.equal(inspectRunState(workflow.root, "run-one").attempts.length, 3);
});

test("CP5 invalid reader output becomes no evidence and blocks the exact unit", async () => {
  const fixture = createReadinessFixture();
  const readiness = executeFixtureReadiness(fixture).analyses.at(-1);
  const workflow = createWorkflowStore(fixture, readiness);
  const adapter = {
    kind: "deterministic_fixture",
    async invokeReader() {
      return { observation: { execution_status: "completed", raw_text: "missing access" }, resources: [] };
    },
  };

  const result = await runSequentialReaderStage({
    adapter,
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: fixture.evaluatorStatic,
    leaseToken: workflow.lease.token,
    readinessSet: readiness,
    readerInvocations: fixture.readers,
    run: fixture.run,
    storeRoot: workflow.root,
    task: fixture.task,
  });

  assert.equal(result.run_state, "blocked");
  assert.deepEqual(result.blocked_unit_ids, []);
  assert.deepEqual(result.failed_unit_ids, ["unit-one"]);
  assert.equal(listStoredArtifacts(workflow.root, { artifactType: "observation", runId: "run-one" }).length, 0);
  assert.equal(inspectRunState(workflow.root, "run-one").attempts[0].phases.terminal.payload.outcome, "error");
});

test("CP5 outcome_unknown blocks resume without duplicate dispatch", async () => {
  const fixture = createReadinessFixture();
  const readiness = executeFixtureReadiness(fixture).analyses.at(-1);
  const workflow = createWorkflowStore(fixture, readiness);
  let calls = 0;
  const adapter = {
    kind: "deterministic_fixture",
    async invokeReader() {
      calls += 1;
      const error = new Error("fixture lost call outcome");
      error.callCertainty = "unknown";
      throw error;
    },
  };

  const first = await runSequentialReaderStage({
    adapter,
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: fixture.evaluatorStatic,
    leaseToken: workflow.lease.token,
    readinessSet: readiness,
    readerInvocations: fixture.readers,
    run: fixture.run,
    storeRoot: workflow.root,
    task: fixture.task,
  });
  const second = await runSequentialReaderStage({
    adapter,
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: fixture.evaluatorStatic,
    leaseToken: workflow.lease.token,
    readinessSet: readiness,
    readerInvocations: fixture.readers,
    run: fixture.run,
    storeRoot: workflow.root,
    task: fixture.task,
  });

  assert.equal(first.run_state, "blocked");
  assert.equal(second.run_state, "blocked");
  assert.deepEqual(second.blocked_unit_ids, []);
  assert.deepEqual(second.uncertain_unit_ids, ["unit-one"]);
  assert.equal(calls, 1);
});

test("CP5 restart resumes a prepared reader attempt and never redispatches an unresolved call", async () => {
  const preparedFixture = createReadinessFixture();
  const preparedReadiness = executeFixtureReadiness(preparedFixture).analyses.at(-1);
  const preparedStore = createWorkflowStore(preparedFixture, preparedReadiness);
  appendAttemptPhase(
    preparedStore.root,
    createControlledAttemptPhase({
      attemptId: "reader-unit-one-attempt-1",
      fixture: preparedFixture,
      phase: "prepared",
      readiness: preparedReadiness.reader,
    }),
    { leaseToken: preparedStore.lease.token, now: timestamp },
  );
  const preparedCalls = [];
  const resumed = await runSequentialReaderStage({
    adapter: fixtureReaderAdapter(preparedCalls),
    adapterCapabilities: preparedFixture.capabilities,
    evaluatorStatic: preparedFixture.evaluatorStatic,
    leaseToken: preparedStore.lease.token,
    readinessSet: preparedReadiness,
    readerInvocations: preparedFixture.readers,
    run: preparedFixture.run,
    storeRoot: preparedStore.root,
    task: preparedFixture.task,
  });
  assert.deepEqual(preparedCalls, ["unit-one"]);
  assert.deepEqual(resumed.newly_executed_unit_ids, ["unit-one"]);
  assert.equal(inspectRunState(preparedStore.root, "run-one").attempts.length, 1);

  const dispatchedFixture = createReadinessFixture();
  const dispatchedReadiness = executeFixtureReadiness(dispatchedFixture).analyses.at(-1);
  const dispatchedStore = createWorkflowStore(dispatchedFixture, dispatchedReadiness);
  for (const phase of ["prepared", "dispatched"]) {
    appendAttemptPhase(
      dispatchedStore.root,
      createControlledAttemptPhase({
        attemptId: "reader-unit-one-attempt-1",
        fixture: dispatchedFixture,
        phase,
        readiness: dispatchedReadiness.reader,
      }),
      { leaseToken: dispatchedStore.lease.token, now: timestamp },
    );
  }
  const duplicateCalls = [];
  const blocked = await runSequentialReaderStage({
    adapter: fixtureReaderAdapter(duplicateCalls),
    adapterCapabilities: dispatchedFixture.capabilities,
    evaluatorStatic: dispatchedFixture.evaluatorStatic,
    leaseToken: dispatchedStore.lease.token,
    readinessSet: dispatchedReadiness,
    readerInvocations: dispatchedFixture.readers,
    run: dispatchedFixture.run,
    storeRoot: dispatchedStore.root,
    task: dispatchedFixture.task,
  });
  assert.deepEqual(duplicateCalls, []);
  assert.deepEqual(blocked.uncertain_unit_ids, ["unit-one"]);
});

test("CP6 evaluator finalization binds the exact evidence set and issues complete stage grants", async () => {
  const fixture = createReadinessFixture();
  const readiness = executeFixtureReadiness(fixture).analyses.at(-1);
  const workflow = createWorkflowStore(fixture, readiness);
  const readers = await runSequentialReaderStage({
    adapter: fixtureReaderAdapter([]),
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: fixture.evaluatorStatic,
    leaseToken: workflow.lease.token,
    readinessSet: readiness,
    readerInvocations: fixture.readers,
    run: fixture.run,
    storeRoot: workflow.root,
    task: fixture.task,
  });
  const readerAttempts = inspectRunState(workflow.root, fixture.run.artifact_id).attempts.map(
    (record) => record.phases.terminal ?? record.phases.dispatched ?? record.phases.prepared,
  );
  const supportingArtifacts = [fixture.evaluatorStatic.invocation, ...fixture.readers, ...readerAttempts];
  const stage = finalizeEvaluatorStage({
    comparisonMapping: fixture.evaluatorContract.comparisonMapping,
    protocol: fixture.evaluatorContract.protocol,
    requestedPolicy: fixture.reader.payload.requested_policy,
    rubric: fixture.evaluatorContract.rubric,
    run: fixture.run,
    runtime: fixture.runtime,
    staticReadiness: readiness.evaluator_static,
    supportingArtifacts,
    task: fixture.task,
    units: [
      {
        evaluator_unit_id: "unit-two",
        observation: readers.observations[0],
        reader_unit_id: "unit-one",
      },
    ],
  });

  assert.equal(stage.readiness.payload.stage, "evaluator");
  assert.equal(stage.readiness.payload.grants.length, 1);
  assert.equal(stage.entries[0].reader_unit_id, "unit-one");
  assert.match(stage.entries[0].evaluator_input_id, /^[a-f0-9]{64}$/);

  for (const substitution of [
    { comparisonMapping: { candidate: "different" } },
    { protocol: { ...fixture.evaluatorContract.protocol, observation_instructions: "Different protocol." } },
    { rubric: { material: ["different rubric"] } },
  ]) {
    assert.throws(
      () =>
        finalizeEvaluatorStage({
          comparisonMapping: fixture.evaluatorContract.comparisonMapping,
          protocol: fixture.evaluatorContract.protocol,
          requestedPolicy: fixture.reader.payload.requested_policy,
          rubric: fixture.evaluatorContract.rubric,
          run: fixture.run,
          runtime: fixture.runtime,
          staticReadiness: readiness.evaluator_static,
          supportingArtifacts,
          task: fixture.task,
          units: [{ evaluator_unit_id: "unit-two", observation: readers.observations[0], reader_unit_id: "unit-one" }],
          ...substitution,
        }),
      hasCode("EVALUATOR_STAGE_STALE"),
    );
  }

  const observation = readers.observations[0];
  const evaluatorAttempt = createHarnessArtifact({
    artifactType: "execution_attempt",
    artifactId: "same-run-wrong-role-attempt",
    producer: producer("orchestrator"),
    links: [
      link("compiled_invocation", fixture.evaluatorStatic.invocation),
      link("readiness", readiness.evaluator_static),
      link("run", fixture.run),
    ].sort((left, right) => `${left.relationship}:${left.target_artifact_id}`.localeCompare(`${right.relationship}:${right.target_artifact_id}`)),
    payload: {
      ...attemptPayload(
        "same-run-wrong-role-attempt",
        "evaluator",
        "unit-two",
        fixture.evaluatorStatic.invocation.content_sha256,
      ),
    },
  });
  const sameRunWrongAttempt = createHarnessArtifact({
    ...artifactCreationFields(observation),
    links: observation.links
      .map((linkValue) => (linkValue.relationship === "attempt" ? link("attempt", evaluatorAttempt) : linkValue))
      .sort((left, right) => `${left.relationship}:${left.target_artifact_id}`.localeCompare(`${right.relationship}:${right.target_artifact_id}`)),
    payload: observation.payload,
  });
  assert.throws(
    () =>
      finalizeEvaluatorStage({
        comparisonMapping: fixture.evaluatorContract.comparisonMapping,
        protocol: fixture.evaluatorContract.protocol,
        requestedPolicy: fixture.reader.payload.requested_policy,
        rubric: fixture.evaluatorContract.rubric,
        run: fixture.run,
        runtime: fixture.runtime,
        staticReadiness: readiness.evaluator_static,
        supportingArtifacts: [...supportingArtifacts, evaluatorAttempt],
        task: fixture.task,
        units: [
          {
            evaluator_unit_id: "unit-two",
            observation: sameRunWrongAttempt,
            reader_unit_id: "unit-one",
            resource_observations: [],
          },
        ],
      }),
    hasCode("EVALUATOR_EVIDENCE_INVALID"),
  );

  const incomplete = createReadinessFixture({ twoReaders: true });
  const incompleteReadiness = executeFixtureReadiness(incomplete).analyses.at(-1);
  assert.throws(
    () =>
      finalizeEvaluatorStage({
        comparisonMapping: incomplete.evaluatorContract.comparisonMapping,
        protocol: incomplete.evaluatorContract.protocol,
        requestedPolicy: incomplete.reader.payload.requested_policy,
        rubric: incomplete.evaluatorContract.rubric,
        run: incomplete.run,
        runtime: incomplete.runtime,
        staticReadiness: incompleteReadiness.evaluator_static,
        supportingArtifacts: [incomplete.evaluatorStatic.invocation],
        task: incomplete.task,
        units: [
          {
            evaluator_unit_id: "unit-two",
            observation: incomplete.artifacts.find((artifact) => artifact.artifact_type === "observation"),
            reader_unit_id: "unit-one",
          },
        ],
      }),
    hasCode("EVALUATOR_STAGE_INVALID"),
  );
});

test("CP6 stale evaluator runtime fails before any adapter call", () => {
  const fixture = createReadinessFixture();
  const readiness = executeFixtureReadiness(fixture).analyses.at(-1);
  let calls = 0;

  assert.throws(
    () => {
      finalizeEvaluatorStage({
        comparisonMapping: {},
        protocol: { observation_instructions: "Return proposal.", output_schema: "proposal-v2" },
        requestedPolicy: fixture.reader.payload.requested_policy,
        rubric: {},
        run: fixture.run,
        runtime: { ...fixtureRuntime(), model: "stale-model" },
        staticReadiness: readiness.evaluator_static,
        supportingArtifacts: [fixture.evaluatorStatic.invocation],
        task: fixture.task,
        units: [],
      });
      calls += 1;
    },
    (error) => error instanceof HarnessError && error.code === "EVALUATOR_STAGE_STALE",
  );
  assert.equal(calls, 0);
});

test("CP6 deterministic evaluator executes only after the exact stage guard", async () => {
  const fixture = createReadinessFixture();
  const readiness = executeFixtureReadiness(fixture).analyses.at(-1);
  const workflow = createWorkflowStore(fixture, readiness);
  const readers = await runSequentialReaderStage({
    adapter: fixtureReaderAdapter([]),
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: fixture.evaluatorStatic,
    leaseToken: workflow.lease.token,
    readinessSet: readiness,
    readerInvocations: fixture.readers,
    run: fixture.run,
    storeRoot: workflow.root,
    task: fixture.task,
  });
  const stage = finalizeEvaluatorStage({
    comparisonMapping: fixture.evaluatorContract.comparisonMapping,
    protocol: fixture.evaluatorContract.protocol,
    requestedPolicy: fixture.reader.payload.requested_policy,
    rubric: fixture.evaluatorContract.rubric,
    run: fixture.run,
    runtime: fixture.runtime,
    staticReadiness: readiness.evaluator_static,
    supportingArtifacts: [
      fixture.evaluatorStatic.invocation,
      ...fixture.readers,
      ...inspectRunState(workflow.root, fixture.run.artifact_id).attempts.map(
        (record) => record.phases.terminal ?? record.phases.dispatched ?? record.phases.prepared,
      ),
    ],
    task: fixture.task,
    units: [{ evaluator_unit_id: "unit-two", observation: readers.observations[0], reader_unit_id: "unit-one" }],
  });
  for (const artifact of [...stage.invocations, stage.readiness]) writeArtifactObject(workflow.root, artifact);
  let calls = 0;
  const result = await runSequentialEvaluatorStage({
    adapter: {
      kind: "deterministic_fixture",
      async invokeEvaluator(_request, context) {
        calls += 1;
        return {
          case_status: "passed",
          citations: [{ artifact_id: readers.observations[0].artifact_id, label: "Reader evidence" }],
          comparison_status: null,
          rationale: `proposal for ${context.reader_unit_id}`,
          recommendation: "accept",
          uncertainty: "",
        };
      },
    },
    leaseToken: workflow.lease.token,
    run: fixture.run,
    stage,
    storeRoot: workflow.root,
  });

  assert.equal(calls, 1);
  assert.equal(result.calls, 1);
  assert.equal(result.proposals[0].payload.unit_id, "unit-one");
  assert.equal(result.run_state, "evaluating");
  assert.equal(loadRunManifest(workflow.root, "run-one").payload.state, "evaluating");

  const resumed = await runSequentialEvaluatorStage({
    adapter: {
      kind: "deterministic_fixture",
      async invokeEvaluator() {
        calls += 1;
        throw new Error("completed evaluator must not be redispatched");
      },
    },
    leaseToken: workflow.lease.token,
    run: fixture.run,
    stage,
    storeRoot: workflow.root,
  });
  assert.equal(calls, 1);
  assert.equal(resumed.calls, 0);
  assert.deepEqual(resumed.resumed_unit_ids, ["unit-two"]);
  assert.deepEqual(resumed.newly_executed_unit_ids, ["unit-two"]);
  assert.deepEqual(resumed.reused_unit_ids, []);
  assert.equal(resumed.proposals[0].content_sha256, result.proposals[0].content_sha256);

  const substitutedObservation = createHarnessArtifact({
    ...artifactCreationFields(stage.entries[0].observation),
    payload: { ...stage.entries[0].observation.payload, raw_text: "same run and unit, different evidence" },
  });
  let substitutedCalls = 0;
  await assert.rejects(
    () =>
      runSequentialEvaluatorStage({
        adapter: {
          kind: "deterministic_fixture",
          async invokeEvaluator() {
            substitutedCalls += 1;
            return {};
          },
        },
        leaseToken: workflow.lease.token,
        run: fixture.run,
        stage: { ...stage, entries: [{ ...stage.entries[0], observation: substitutedObservation }] },
        storeRoot: workflow.root,
      }),
    hasCode("EVALUATOR_EVIDENCE_INVALID"),
  );
  assert.equal(substitutedCalls, 0);

  const summary = buildRunReviewSummary({
    attempts: inspectRunState(workflow.root, fixture.run.artifact_id).attempts,
    proposedAction: "review exact completed scope",
    proposals: result.proposals,
    recommendation: "accept",
    run: fixture.run,
  });
  const representations = renderReviewRepresentations(summary);
  const published = publishRunReview({
    leaseToken: workflow.lease.token,
    representations,
    storeRoot: workflow.root,
    summary,
    supportingArtifacts: listStoredArtifacts(workflow.root),
  });
  assert.equal(published.run_state, "review_pending");
  assert.equal(loadRunManifest(workflow.root, "run-one").payload.state, "review_pending");

  let reviewPendingCalls = 0;
  await assert.rejects(
    () =>
      runSequentialEvaluatorStage({
        adapter: {
          kind: "deterministic_fixture",
          async invokeEvaluator() {
            reviewPendingCalls += 1;
            return {};
          },
        },
        invalidatedUnitIds: ["unit-two"],
        leaseToken: workflow.lease.token,
        run: fixture.run,
        stage,
        storeRoot: workflow.root,
      }),
    hasCode("RUN_STATE_INVALID"),
  );
  assert.equal(reviewPendingCalls, 0);
});

test("CP6 canonical summary, safe views, human decision, materialization, and report share one authority chain", () => {
  const fixture = createGraphFixture();
  const hostileProposal = createHarnessArtifact({
    ...artifactCreationFields(fixture.proposal),
    payload: {
      ...fixture.proposal.payload,
      comparison_status: null,
      rationale: '<script>alert(1)</script> [remote](https://example.com) ![image](data:text/html,x)',
    },
  });
  const summary = buildRunReviewSummary({
    anomalies: ["<script>alert(1)</script>", "<img src=x onerror=alert(1)>"],
    attempts: [fixture.readerAttempt, fixture.evaluatorAttempt],
    limitations: ["javascript:alert(1)"],
    proposedAction: "accept unit-one",
    proposals: [hostileProposal],
    recommendation: "accept",
    run: fixture.run,
  });
  const views = renderReviewRepresentations(summary);
  const supporting = fixture.artifacts.filter(
    (artifact) => !["evaluator_proposal", "run_review_summary", "human_review_decision", "human_evaluation", "generated_report"].includes(artifact.artifact_type),
  );

  assert.doesNotMatch(views.summary_html.bytes, /<script[\s>]|<img[\s>]/i);
  assert.match(views.summary_html.bytes, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(views.summary_md.bytes, /\[remote\]\(https:\/\//);
  assert.match(views.summary_html.bytes, /Content-Security-Policy/);
  const decision = createHumanReviewDecision({
    acceptedUnitIds: ["unit-one"],
    action: "accept",
    artifactId: "decision-cp6",
    decidedAt: timestamp,
    proposals: [hostileProposal],
    rationale: "Owner accepted exact scope.",
    representations: views,
    reviewPolicy: { version: "review-policy-v2" },
    reviewer: { identity: "owner-reviewer", identity_type: "local_named_reviewer" },
    summary,
    supportingArtifacts: supporting,
  });
  const evaluations = materializeHumanEvaluations({
    decision,
    proposals: [hostileProposal],
    summary,
    supportingArtifacts: supporting,
  });
  const report = createAcceptedReport({
    artifactId: "report-cp6",
    decision,
    evaluations,
    run: fixture.run,
    summary,
    supportingArtifacts: [...supporting, hostileProposal],
  });

  assert.doesNotThrow(() => validateArtifactGraph([...supporting, hostileProposal, summary, decision, ...evaluations, report]));
  assert.deepEqual(report.payload.aggregates.case_status.passed, ["unit-one"]);
  assert.deepEqual(report.payload.aggregates.comparison_status.not_applicable, ["unit-one"]);
  const staleViews = structuredClone(views);
  staleViews.summary_md.bytes += "stale";
  assert.throws(
    () =>
      createHumanReviewDecision({
        acceptedUnitIds: ["unit-one"],
        action: "accept",
        artifactId: "decision-stale-view",
        decidedAt: timestamp,
        proposals: [hostileProposal],
        rationale: "Must fail.",
        representations: staleViews,
        reviewPolicy: { version: "review-policy-v2" },
        reviewer: { identity: "owner-reviewer", identity_type: "local_named_reviewer" },
        summary,
        supportingArtifacts: supporting,
      }),
    (error) => error instanceof HarnessError && error.code === "REVIEW_REPRESENTATION_INVALID",
  );
});

test("CP6 normal 21-case summary derives exact candidate partitions and every exception", () => {
  const fixture = createGraphFixture();
  const selectedUnits = [];
  let proposals = [];
  const attempts = [];
  const statuses = ["partially_passed", "failed", "not_run", ...Array(18).fill("passed")];
  for (let index = 1; index <= 21; index += 1) {
    const suffix = String(index).padStart(2, "0");
    const readerUnitId = `reader-unit-${suffix}`;
    const evaluatorUnitId = `evaluator-unit-${suffix}`;
    selectedUnits.push(
      { case_id: `case-${suffix}`, role: "evaluator", suite: "regression", unit_id: evaluatorUnitId, variant: "candidate" },
      { case_id: `case-${suffix}`, role: "reader", suite: "regression", unit_id: readerUnitId, variant: "candidate" },
    );
    const readerAttempt = createHarnessArtifact({
      ...artifactCreationFields(fixture.readerAttempt),
      artifactId: `reader-attempt-${suffix}`,
      payload: { ...fixture.readerAttempt.payload, attempt_id: `reader-attempt-${suffix}`, unit_id: readerUnitId },
    });
    const evaluatorAttempt = createHarnessArtifact({
      ...artifactCreationFields(fixture.evaluatorAttempt),
      artifactId: `evaluator-attempt-${suffix}`,
      payload: { ...fixture.evaluatorAttempt.payload, attempt_id: `evaluator-attempt-${suffix}`, unit_id: evaluatorUnitId },
    });
    proposals.push(
      createHarnessArtifact({
        artifactType: "evaluator_proposal",
        artifactId: `proposal-${suffix}`,
        producer: fixture.proposal.producer,
        links: fixture.proposal.links
          .map((linkValue) => (linkValue.relationship === "attempt" ? link("attempt", evaluatorAttempt) : linkValue))
          .sort((left, right) => `${left.relationship}:${left.target_artifact_id}`.localeCompare(`${right.relationship}:${right.target_artifact_id}`)),
        payload: {
          ...fixture.proposal.payload,
          case_status: statuses[index - 1],
          comparison_status: null,
          rationale: `case ${suffix} result`,
          recommendation: statuses[index - 1] === "passed" ? "accept" : "rerun",
          unit_id: readerUnitId,
        },
      }),
    );
    attempts.push(readerAttempt, evaluatorAttempt);
  }
  selectedUnits.sort((left, right) => (left.unit_id < right.unit_id ? -1 : left.unit_id > right.unit_id ? 1 : 0));
  const run = createHarnessArtifact({
    ...artifactCreationFields(fixture.run),
    payload: { ...fixture.run.payload, selected_units: selectedUnits },
  });
  const reboundAttempts = attempts.map((attemptValue) =>
    createHarnessArtifact({
      ...artifactCreationFields(attemptValue),
      links: attemptValue.links.map((linkValue) => (linkValue.relationship === "run" ? link("run", run) : linkValue)).sort(
        (left, right) => `${left.relationship}:${left.target_artifact_id}`.localeCompare(`${right.relationship}:${right.target_artifact_id}`),
      ),
      payload: attemptValue.payload,
    }),
  );
  const evaluatorAttempts = new Map(
    reboundAttempts.filter((attemptValue) => attemptValue.payload.role === "evaluator").map((attemptValue) => [attemptValue.payload.unit_id, attemptValue]),
  );
  proposals = proposals.map((proposal, index) => {
    const evaluatorAttempt = evaluatorAttempts.get(`evaluator-unit-${String(index + 1).padStart(2, "0")}`);
    return createHarnessArtifact({
      ...artifactCreationFields(proposal),
      links: proposal.links.map((linkValue) => (linkValue.relationship === "attempt" ? link("attempt", evaluatorAttempt) : linkValue)).sort(
        (left, right) => `${left.relationship}:${left.target_artifact_id}`.localeCompare(`${right.relationship}:${right.target_artifact_id}`),
      ),
      payload: proposal.payload,
    });
  });
  const summary = buildRunReviewSummary({
    attempts: reboundAttempts,
    proposedAction: "rerun exceptions",
    proposals,
    recommendation: "rerun",
    run,
  });

  assert.deepEqual(summary.payload.candidate.counts, {
    failed: 1,
    not_run: 1,
    partially_passed: 1,
    passed: 18,
    unassessed: 0,
  });
  assert.equal(summary.payload.scope.selected_case_ids.length, 21);
  assert.equal(summary.payload.exceptions.length, 3);
  assert.equal(summary.payload.operations.reader.newly_executed_unit_ids.length, 21);
  assert.equal(summary.payload.operations.evaluator.newly_executed_unit_ids.length, 21);
});

test("CP7 classified retry and bounded concurrency append durable attempts without duplicate units", async () => {
  const fixture = createReadinessFixture({ twoReaders: true });
  const readiness = executeFixtureReadiness(fixture).analyses.at(-1);
  const workflow = createWorkflowStore(fixture, readiness);
  const seen = new Map();
  const controlled = await runControlledFixtureAttempts({
    adapter: {
      kind: "deterministic_fixture",
      async invokeReader(_request, context) {
        seen.set(context.unit_id, (seen.get(context.unit_id) ?? 0) + 1);
        await new Promise((resolveValue) => setTimeout(resolveValue, 15));
        if (context.unit_id === "unit-one" && context.sequence === 1) {
          const error = new Error("transient fixture failure");
          error.retryClass = "transient";
          throw error;
        }
        return { outcome: "success" };
      },
    },
    adapterConcurrency: 2,
    dispatchContext: readerControlContext(fixture, readiness),
    invocations: fixture.readers,
    leaseToken: workflow.lease.token,
    policyConcurrency: 3,
    readiness: readiness.reader,
    requestedConcurrency: 4,
    retryPolicy: { max_attempts: 2, retryable_classes: ["transient"] },
    role: "reader",
    run: fixture.run,
    storeRoot: workflow.root,
  });

  assert.equal(controlled.effective_concurrency, 2);
  assert.equal(controlled.maximum_active, 2);
  assert.equal(controlled.calls, 3);
  assert.deepEqual(controlled.outcomes, { "unit-one": "success", "unit-three": "success" });
  assert.deepEqual(controlled.attempts.filter((attemptValue) => attemptValue.payload.unit_id === "unit-one").map((attemptValue) => attemptValue.payload.sequence), [1, 2]);
  assert.equal(inspectRunState(workflow.root, "run-one").attempts.length, 3);
  let restartCalls = 0;
  const resumed = await runControlledFixtureAttempts({
    adapter: {
      kind: "deterministic_fixture",
      async invokeReader() {
        restartCalls += 1;
        return { outcome: "success" };
      },
    },
    adapterConcurrency: 2,
    dispatchContext: readerControlContext(fixture, readiness),
    invocations: fixture.readers,
    leaseToken: workflow.lease.token,
    policyConcurrency: 2,
    readiness: readiness.reader,
    requestedConcurrency: 2,
    retryPolicy: { max_attempts: 2, retryable_classes: ["transient"] },
    role: "reader",
    run: fixture.run,
    storeRoot: workflow.root,
  });
  assert.equal(restartCalls, 0);
  assert.deepEqual(resumed.resumed_unit_ids, ["unit-one", "unit-three"]);
  assert.deepEqual(resumed.reused_unit_ids, []);
  assert.deepEqual(resumed.newly_executed_unit_ids, ["unit-one", "unit-three"]);

  const invalidFixture = createReadinessFixture();
  const invalidReadiness = executeFixtureReadiness(invalidFixture).analyses.at(-1);
  const invalidStore = createWorkflowStore(invalidFixture, invalidReadiness);
  let invalidCalls = 0;
  const invalid = await runControlledFixtureAttempts({
    adapter: {
      kind: "deterministic_fixture",
      async invokeReader() {
        invalidCalls += 1;
        return {};
      },
    },
    dispatchContext: readerControlContext(invalidFixture, invalidReadiness),
    invocations: invalidFixture.readers,
    leaseToken: invalidStore.lease.token,
    readiness: invalidReadiness.reader,
    retryPolicy: { max_attempts: 3, retryable_classes: ["transient"] },
    role: "reader",
    run: invalidFixture.run,
    storeRoot: invalidStore.root,
  });
  assert.equal(invalidCalls, 1);
  assert.equal(invalid.outcomes["unit-one"], "error");
  const invalidClassification = inspectRunState(invalidStore.root, "run-one").journal.find(
    (event) => event.type === "attempt_retry_classified",
  );
  assert.equal(invalidClassification.details.retry_class, "semantic_invalid");
  assert.equal(invalidClassification.details.retryable, false);

  const malformedFixture = createReadinessFixture();
  const malformedReadiness = executeFixtureReadiness(malformedFixture).analyses.at(-1);
  const malformedStore = createWorkflowStore(malformedFixture, malformedReadiness);
  const malformed = await runControlledFixtureAttempts({
    adapter: {
      kind: "deterministic_fixture",
      async invokeReader() {
        const error = new Error("fixture supplied malformed retry metadata");
        error.retryClass = "not valid";
        throw error;
      },
    },
    dispatchContext: readerControlContext(malformedFixture, malformedReadiness),
    invocations: malformedFixture.readers,
    leaseToken: malformedStore.lease.token,
    readiness: malformedReadiness.reader,
    retryPolicy: { max_attempts: 3, retryable_classes: ["transient"] },
    role: "reader",
    run: malformedFixture.run,
    storeRoot: malformedStore.root,
  });
  assert.equal(malformed.calls, 1);
  assert.equal(malformed.outcomes["unit-one"], "error");
  assert.equal(
    inspectRunState(malformedStore.root, "run-one").journal.find(
      (event) => event.type === "attempt_retry_classified",
    ).details.retry_class,
    "unknown",
  );
});

test("CP7 restart resumes an exact prepared attempt and blocks an unresolved dispatched call", async () => {
  const preparedFixture = createReadinessFixture();
  const preparedReadiness = executeFixtureReadiness(preparedFixture).analyses.at(-1);
  const preparedStore = createWorkflowStore(preparedFixture, preparedReadiness);
  const prepared = createControlledAttemptPhase({
    fixture: preparedFixture,
    phase: "prepared",
    readiness: preparedReadiness.reader,
  });
  appendAttemptPhase(preparedStore.root, prepared, {
    leaseToken: preparedStore.lease.token,
    now: timestamp,
  });
  let preparedCalls = 0;
  const resumed = await runControlledFixtureAttempts({
    adapter: {
      kind: "deterministic_fixture",
      async invokeReader() {
        preparedCalls += 1;
        return { outcome: "success" };
      },
    },
    dispatchContext: readerControlContext(preparedFixture, preparedReadiness),
    invocations: preparedFixture.readers,
    leaseToken: preparedStore.lease.token,
    readiness: preparedReadiness.reader,
    role: "reader",
    run: preparedFixture.run,
    storeRoot: preparedStore.root,
  });
  assert.equal(preparedCalls, 1);
  assert.equal(resumed.attempts[0].payload.sequence, 1);
  assert.deepEqual(Object.keys(readAttemptPhases(preparedStore.root, "run-one", "reader-unit-one-controlled-1")), [
    "prepared",
    "dispatched",
    "terminal",
  ]);

  const dispatchedFixture = createReadinessFixture();
  const dispatchedReadiness = executeFixtureReadiness(dispatchedFixture).analyses.at(-1);
  const dispatchedStore = createWorkflowStore(dispatchedFixture, dispatchedReadiness);
  for (const phase of ["prepared", "dispatched"]) {
    appendAttemptPhase(
      dispatchedStore.root,
      createControlledAttemptPhase({ fixture: dispatchedFixture, phase, readiness: dispatchedReadiness.reader }),
      { leaseToken: dispatchedStore.lease.token, now: timestamp },
    );
  }
  let duplicateCalls = 0;
  const blocked = await runControlledFixtureAttempts({
    adapter: {
      kind: "deterministic_fixture",
      async invokeReader() {
        duplicateCalls += 1;
        return { outcome: "success" };
      },
    },
    dispatchContext: readerControlContext(dispatchedFixture, dispatchedReadiness),
    invocations: dispatchedFixture.readers,
    leaseToken: dispatchedStore.lease.token,
    readiness: dispatchedReadiness.reader,
    role: "reader",
    run: dispatchedFixture.run,
    storeRoot: dispatchedStore.root,
  });
  assert.equal(duplicateCalls, 0);
  assert.equal(blocked.outcomes["unit-one"], "outcome_unknown");
});

test("CP7 controlled reader rechecks the complete CP4 authority before every newly dispatchable set", async () => {
  const fixture = createReadinessFixture();
  const readiness = executeFixtureReadiness(fixture).analyses.at(-1);
  const workflow = createWorkflowStore(fixture, readiness);
  const staleCapabilities = structuredClone(fixture.capabilities);
  staleCapabilities.policy.network = ["required"];
  let calls = 0;

  await assert.rejects(
    () =>
      runControlledFixtureAttempts({
        adapter: {
          kind: "deterministic_fixture",
          async invokeReader() {
            calls += 1;
            return { outcome: "success" };
          },
        },
        dispatchContext: {
          ...readerControlContext(fixture, readiness),
          adapterCapabilities: staleCapabilities,
        },
        invocations: fixture.readers,
        leaseToken: workflow.lease.token,
        readiness: readiness.reader,
        role: "reader",
        run: fixture.run,
        storeRoot: workflow.root,
      }),
    hasCode("DISPATCH_ATTESTATION_CHANGED"),
  );
  assert.equal(calls, 0);
  assert.equal(inspectRunState(workflow.root, "run-one").attempts.length, 0);
});

test("CP7 restart retries only an error with an exact durable class and policy", async () => {
  const retryPolicy = { max_attempts: 2, retryable_classes: ["transient"] };
  const unclassifiedFixture = createReadinessFixture();
  const unclassifiedReadiness = executeFixtureReadiness(unclassifiedFixture).analyses.at(-1);
  const unclassifiedStore = createWorkflowStore(unclassifiedFixture, unclassifiedReadiness);
  for (const phase of ["prepared", "dispatched", "terminal"]) {
    appendAttemptPhase(
      unclassifiedStore.root,
      createControlledAttemptPhase({ fixture: unclassifiedFixture, phase, readiness: unclassifiedReadiness.reader }),
      { leaseToken: unclassifiedStore.lease.token, now: timestamp },
    );
  }
  appendAttemptPhase(
    unclassifiedStore.root,
    createControlledAttemptPhase({
      fixture: unclassifiedFixture,
      phase: "prepared",
      readiness: unclassifiedReadiness.reader,
      sequence: 2,
    }),
    { leaseToken: unclassifiedStore.lease.token, now: timestamp },
  );
  let unclassifiedCalls = 0;
  const unclassified = await runControlledFixtureAttempts({
    adapter: {
      kind: "deterministic_fixture",
      async invokeReader() {
        unclassifiedCalls += 1;
        return { outcome: "success" };
      },
    },
    dispatchContext: readerControlContext(unclassifiedFixture, unclassifiedReadiness),
    invocations: unclassifiedFixture.readers,
    leaseToken: unclassifiedStore.lease.token,
    readiness: unclassifiedReadiness.reader,
    retryPolicy,
    role: "reader",
    run: unclassifiedFixture.run,
    storeRoot: unclassifiedStore.root,
  });
  assert.equal(unclassifiedCalls, 0);
  assert.equal(unclassified.outcomes["unit-one"], "error");

  const fixture = createReadinessFixture();
  const readiness = executeFixtureReadiness(fixture).analyses.at(-1);
  const workflow = createWorkflowStore(fixture, readiness);
  let terminal;
  for (const phase of ["prepared", "dispatched", "terminal"]) {
    terminal = createControlledAttemptPhase({ fixture, phase, readiness: readiness.reader });
    appendAttemptPhase(workflow.root, terminal, { leaseToken: workflow.lease.token, now: timestamp });
  }
  recordAttemptRetryClassification(workflow.root, {
    attempt: terminal,
    leaseToken: workflow.lease.token,
    now: timestamp,
    retryClass: "transient",
    retryPolicySha256: sha256Canonical(retryPolicy),
    retryable: true,
  });
  appendAttemptPhase(
    workflow.root,
    createControlledAttemptPhase({ fixture, phase: "prepared", readiness: readiness.reader, sequence: 2 }),
    { leaseToken: workflow.lease.token, now: timestamp },
  );
  let mismatchedPolicyCalls = 0;
  await assert.rejects(
    () =>
      runControlledFixtureAttempts({
        adapter: {
          kind: "deterministic_fixture",
          async invokeReader() {
            mismatchedPolicyCalls += 1;
            return { outcome: "success" };
          },
        },
        dispatchContext: readerControlContext(fixture, readiness),
        invocations: fixture.readers,
        leaseToken: workflow.lease.token,
        readiness: readiness.reader,
        retryPolicy: { max_attempts: 2, retryable_classes: ["transient", "transport"] },
        role: "reader",
        run: fixture.run,
        storeRoot: workflow.root,
      }),
    hasCode("RETRY_POLICY_MISMATCH"),
  );
  assert.equal(mismatchedPolicyCalls, 0);
  let calls = 0;
  const resumed = await runControlledFixtureAttempts({
    adapter: {
      kind: "deterministic_fixture",
      async invokeReader() {
        calls += 1;
        return { outcome: "success" };
      },
    },
    dispatchContext: readerControlContext(fixture, readiness),
    invocations: fixture.readers,
    leaseToken: workflow.lease.token,
    readiness: readiness.reader,
    retryPolicy,
    role: "reader",
    run: fixture.run,
    storeRoot: workflow.root,
  });
  assert.equal(calls, 1);
  assert.deepEqual(resumed.attempts.map((attemptValue) => attemptValue.payload.sequence), [1, 2]);
  assert.equal(resumed.outcomes["unit-one"], "success");
});

test("CP7 logical input change reruns only the affected unit and keeps contiguous history", async () => {
  const fixture = createReadinessFixture({ twoReaders: true });
  const readiness = executeFixtureReadiness(fixture).analyses.at(-1);
  const workflow = createWorkflowStore(fixture, readiness);
  await runControlledFixtureAttempts({
    adapter: {
      kind: "deterministic_fixture",
      async invokeReader() {
        return { outcome: "success" };
      },
    },
    adapterConcurrency: 2,
    dispatchContext: readerControlContext(fixture, readiness),
    invocations: fixture.readers,
    leaseToken: workflow.lease.token,
    policyConcurrency: 2,
    readiness: readiness.reader,
    requestedConcurrency: 2,
    role: "reader",
    run: fixture.run,
    storeRoot: workflow.root,
  });
  const changed = compileInvocation({
    artifactId: "cp7-reader-invocation-two-changed",
    messages: [{ content: "Read the changed second fixture and return an observation.", role: "user" }],
    protocol: fixture.readers[1].payload.protocol,
    requestedPolicy: fixture.readers[1].payload.requested_policy,
    resources: [],
    role: "reader",
    run: fixture.run,
    runtime: fixture.runtime,
    tools: [],
    unitId: "unit-three",
  });
  const changedReaders = [fixture.reader, changed];
  const changedReadiness = executeReadiness({
    adapterCapabilities: fixture.capabilities,
    rounds: [{ evaluatorStatic: fixture.evaluatorStatic, readerInvocations: changedReaders, runtimeConfig: fixture.runtime }],
    run: fixture.run,
    task: fixture.task,
  }).analyses.at(-1);
  for (const artifact of [changed, changedReadiness.reader, changedReadiness.evaluator_static]) {
    writeArtifactObject(workflow.root, artifact);
  }
  const calls = [];
  const rerun = await runControlledFixtureAttempts({
    adapter: {
      kind: "deterministic_fixture",
      async invokeReader(_request, context) {
        calls.push(context.unit_id);
        return { outcome: "success" };
      },
    },
    adapterConcurrency: 2,
    dispatchContext: {
      adapterCapabilities: fixture.capabilities,
      evaluatorStatic: fixture.evaluatorStatic,
      readinessSet: changedReadiness,
      task: fixture.task,
    },
    invocations: changedReaders,
    leaseToken: workflow.lease.token,
    policyConcurrency: 2,
    readiness: changedReadiness.reader,
    requestedConcurrency: 2,
    role: "reader",
    run: fixture.run,
    storeRoot: workflow.root,
  });
  assert.deepEqual(calls, ["unit-three"]);
  assert.deepEqual(rerun.resumed_unit_ids, ["unit-one"]);
  assert.deepEqual(
    rerun.attempts.filter((attemptValue) => attemptValue.payload.unit_id === "unit-three").map((attemptValue) => attemptValue.payload.sequence),
    [1, 2],
  );

  let restoredCalls = 0;
  const restored = await runControlledFixtureAttempts({
    adapter: {
      kind: "deterministic_fixture",
      async invokeReader() {
        restoredCalls += 1;
        return { outcome: "success" };
      },
    },
    adapterConcurrency: 2,
    dispatchContext: readerControlContext(fixture, readiness),
    invocations: fixture.readers,
    leaseToken: workflow.lease.token,
    policyConcurrency: 2,
    readiness: readiness.reader,
    requestedConcurrency: 2,
    role: "reader",
    run: fixture.run,
    storeRoot: workflow.root,
  });
  assert.equal(restoredCalls, 0);
  assert.deepEqual(restored.resumed_unit_ids, ["unit-one", "unit-three"]);
  assert.equal(restored.attempts.length, 3);
});

test("CP7 controlled evaluator uses the exact finalized CP6 stage authority", async () => {
  const fixture = createReadinessFixture();
  const readiness = executeFixtureReadiness(fixture).analyses.at(-1);
  const workflow = createWorkflowStore(fixture, readiness);
  const readers = await runSequentialReaderStage({
    adapter: fixtureReaderAdapter([]),
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: fixture.evaluatorStatic,
    leaseToken: workflow.lease.token,
    readinessSet: readiness,
    readerInvocations: fixture.readers,
    run: fixture.run,
    storeRoot: workflow.root,
    task: fixture.task,
  });
  const stage = finalizeEvaluatorStage({
    comparisonMapping: fixture.evaluatorContract.comparisonMapping,
    protocol: fixture.evaluatorContract.protocol,
    requestedPolicy: fixture.reader.payload.requested_policy,
    rubric: fixture.evaluatorContract.rubric,
    run: fixture.run,
    runtime: fixture.runtime,
    staticReadiness: readiness.evaluator_static,
    supportingArtifacts: [
      fixture.evaluatorStatic.invocation,
      ...fixture.readers,
      ...inspectRunState(workflow.root, fixture.run.artifact_id).attempts.map(
        (record) => record.phases.terminal ?? record.phases.dispatched ?? record.phases.prepared,
      ),
    ],
    task: fixture.task,
    units: [
      {
        evaluator_unit_id: "unit-two",
        observation: readers.observations[0],
        reader_unit_id: "unit-one",
        resource_observations: readers.resources,
      },
    ],
  });
  for (const artifact of [...stage.invocations, stage.readiness]) writeArtifactObject(workflow.root, artifact);
  let calls = 0;
  const controlled = await runControlledFixtureAttempts({
    adapter: {
      kind: "deterministic_fixture",
      async invokeEvaluator() {
        calls += 1;
        return { outcome: "success" };
      },
    },
    dispatchContext: { task: fixture.task },
    invocations: stage.invocations,
    leaseToken: workflow.lease.token,
    readiness: stage.readiness,
    role: "evaluator",
    run: fixture.run,
    storeRoot: workflow.root,
  });
  assert.equal(calls, 1);
  assert.equal(controlled.attempts[0].payload.role, "evaluator");
  assert.deepEqual(controlled.newly_executed_unit_ids, ["unit-two"]);
});

test("CP7 timeout and cancellation preserve call certainty and durable control requests", async () => {
  const timeoutFixture = createReadinessFixture();
  const timeoutReadiness = executeFixtureReadiness(timeoutFixture).analyses.at(-1);
  const timeoutStore = createWorkflowStore(timeoutFixture, timeoutReadiness);
  const timeout = await runControlledFixtureAttempts({
    adapter: {
      kind: "deterministic_fixture",
      async cancel() {
        return { confirmed: true };
      },
      async invokeReader() {
        return new Promise(() => {});
      },
    },
    dispatchContext: readerControlContext(timeoutFixture, timeoutReadiness),
    invocations: timeoutFixture.readers,
    leaseToken: timeoutStore.lease.token,
    readiness: timeoutReadiness.reader,
    role: "reader",
    run: timeoutFixture.run,
    storeRoot: timeoutStore.root,
    timeoutMs: 10,
    timeoutPhase: "connect",
  });
  assert.equal(timeout.outcomes["unit-one"], "timeout");
  assert.equal(timeout.attempts[0].payload.call_certainty, "confirmed_finished");
  const timeoutEvent = inspectRunState(timeoutStore.root, "run-one").journal.find((event) => event.details.control === "timeout_requested");
  assert.equal(timeoutEvent.details.timeout_phase, "connect");
  const foreignFixture = createReadinessFixture({ runtimeParameters: { seed: 1 } });
  const foreignReadiness = executeFixtureReadiness(foreignFixture).analyses.at(-1);
  const foreignDispatched = createControlledAttemptPhase({
    fixture: foreignFixture,
    phase: "dispatched",
    readiness: foreignReadiness.reader,
  });
  assert.throws(
    () =>
      recordAttemptControl(timeoutStore.root, {
        attempt: foreignDispatched,
        control: "timeout_requested",
        leaseToken: timeoutStore.lease.token,
        now: timestamp,
        timeoutPhase: "connect",
      }),
    hasCode("ATTEMPT_CONTROL_INVALID"),
  );
  let timeoutRestartCalls = 0;
  const timeoutRestart = await runControlledFixtureAttempts({
    adapter: {
      kind: "deterministic_fixture",
      async invokeReader() {
        timeoutRestartCalls += 1;
        return { outcome: "success" };
      },
    },
    dispatchContext: readerControlContext(timeoutFixture, timeoutReadiness),
    invocations: timeoutFixture.readers,
    leaseToken: timeoutStore.lease.token,
    readiness: timeoutReadiness.reader,
    role: "reader",
    run: timeoutFixture.run,
    storeRoot: timeoutStore.root,
  });
  assert.equal(timeoutRestartCalls, 0);
  assert.equal(timeoutRestart.outcomes["unit-one"], "timeout");

  const cancelFixture = createReadinessFixture();
  const cancelReadiness = executeFixtureReadiness(cancelFixture).analyses.at(-1);
  const cancelStore = createWorkflowStore(cancelFixture, cancelReadiness);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 10);
  const cancelled = await runControlledFixtureAttempts({
    adapter: {
      kind: "deterministic_fixture",
      async cancel() {
        return { confirmed: false };
      },
      async invokeReader() {
        return new Promise(() => {});
      },
    },
    dispatchContext: readerControlContext(cancelFixture, cancelReadiness),
    invocations: cancelFixture.readers,
    leaseToken: cancelStore.lease.token,
    readiness: cancelReadiness.reader,
    role: "reader",
    run: cancelFixture.run,
    signal: controller.signal,
    storeRoot: cancelStore.root,
  });
  assert.equal(cancelled.outcomes["unit-one"], "outcome_unknown");
  assert.equal(cancelled.attempts[0].payload.call_certainty, "unknown");
  assert.ok(inspectRunState(cancelStore.root, "run-one").journal.some((event) => event.details.control === "cancel_requested"));
  let cancelRestartCalls = 0;
  const cancelRestart = await runControlledFixtureAttempts({
    adapter: {
      kind: "deterministic_fixture",
      async invokeReader() {
        cancelRestartCalls += 1;
        return { outcome: "success" };
      },
    },
    dispatchContext: readerControlContext(cancelFixture, cancelReadiness),
    invocations: cancelFixture.readers,
    leaseToken: cancelStore.lease.token,
    readiness: cancelReadiness.reader,
    role: "reader",
    run: cancelFixture.run,
    storeRoot: cancelStore.root,
  });
  assert.equal(cancelRestartCalls, 0);
  assert.equal(cancelRestart.outcomes["unit-one"], "outcome_unknown");

  const hangingControlFixture = createReadinessFixture();
  const hangingControlReadiness = executeFixtureReadiness(hangingControlFixture).analyses.at(-1);
  const hangingControlStore = createWorkflowStore(hangingControlFixture, hangingControlReadiness);
  const hangingControl = await runControlledFixtureAttempts({
    adapter: {
      kind: "deterministic_fixture",
      async cancel() {
        return new Promise(() => {});
      },
      async invokeReader() {
        return new Promise(() => {});
      },
    },
    controlConfirmationMs: 5,
    dispatchContext: readerControlContext(hangingControlFixture, hangingControlReadiness),
    invocations: hangingControlFixture.readers,
    leaseToken: hangingControlStore.lease.token,
    readiness: hangingControlReadiness.reader,
    role: "reader",
    run: hangingControlFixture.run,
    storeRoot: hangingControlStore.root,
    timeoutMs: 5,
  });
  assert.equal(hangingControl.outcomes["unit-one"], "outcome_unknown");
  assert.equal(hangingControl.attempts[0].payload.call_certainty, "unknown");

  const preCancelledFixture = createReadinessFixture();
  const preCancelledReadiness = executeFixtureReadiness(preCancelledFixture).analyses.at(-1);
  const preCancelledStore = createWorkflowStore(preCancelledFixture, preCancelledReadiness);
  const preCancelledController = new AbortController();
  preCancelledController.abort();
  let preCancelledCalls = 0;
  const preCancelled = await runControlledFixtureAttempts({
    adapter: {
      kind: "deterministic_fixture",
      async invokeReader() {
        preCancelledCalls += 1;
        return { outcome: "success" };
      },
    },
    dispatchContext: readerControlContext(preCancelledFixture, preCancelledReadiness),
    invocations: preCancelledFixture.readers,
    leaseToken: preCancelledStore.lease.token,
    readiness: preCancelledReadiness.reader,
    role: "reader",
    run: preCancelledFixture.run,
    signal: preCancelledController.signal,
    storeRoot: preCancelledStore.root,
  });
  assert.equal(preCancelledCalls, 0);
  assert.deepEqual(preCancelled.blocked_unit_ids, ["unit-one"]);
});

test("CP7 durable retry outcomes rebuild the frozen CP6 operational partitions independent of completion order", async () => {
  const fixture = createReadinessFixture({ twoReaders: true });
  const readiness = executeFixtureReadiness(fixture).analyses.at(-1);
  const workflow = createWorkflowStore(fixture, readiness);
  const controlled = await runControlledFixtureAttempts({
    adapter: {
      kind: "deterministic_fixture",
      async invokeReader(_request, context) {
        if (context.unit_id === "unit-one" && context.sequence === 1) {
          const error = new Error("retry once");
          error.retryClass = "transient";
          throw error;
        }
        return { outcome: "success" };
      },
    },
    adapterConcurrency: 2,
    dispatchContext: readerControlContext(fixture, readiness),
    invocations: fixture.readers,
    leaseToken: workflow.lease.token,
    policyConcurrency: 2,
    readiness: readiness.reader,
    requestedConcurrency: 2,
    retryPolicy: { max_attempts: 2, retryable_classes: ["transient"] },
    role: "reader",
    run: fixture.run,
    storeRoot: workflow.root,
  });
  const evaluatorAttempt = createHarnessArtifact({
    ...artifactCreationFields(fixture.evaluatorAttempt),
    links: fixture.evaluatorAttempt.links.map((linkValue) => (linkValue.relationship === "run" ? link("run", fixture.run) : linkValue)).sort(
      (left, right) => `${left.relationship}:${left.target_artifact_id}`.localeCompare(`${right.relationship}:${right.target_artifact_id}`),
    ),
    payload: fixture.evaluatorAttempt.payload,
  });
  const proposal = createHarnessArtifact({
    ...artifactCreationFields(fixture.proposal),
    links: fixture.proposal.links.map((linkValue) => (linkValue.relationship === "attempt" ? link("attempt", evaluatorAttempt) : linkValue)).sort(
      (left, right) => `${left.relationship}:${left.target_artifact_id}`.localeCompare(`${right.relationship}:${right.target_artifact_id}`),
    ),
    payload: { ...fixture.proposal.payload, comparison_status: null },
  });
  const summaryInput = {
    attempts: [...controlled.attempts, evaluatorAttempt],
    blockedUnitIds: { evaluator: [], reader: [] },
    proposedAction: "accept completed scope",
    proposals: [proposal],
    recommendation: "accept",
    reusedUnitIds: { evaluator: [], reader: [] },
    run: fixture.run,
  };
  const summary = buildRunReviewSummary(summaryInput);
  const reversed = buildRunReviewSummary({ ...summaryInput, attempts: [...summaryInput.attempts].reverse() });
  let restartCalls = 0;
  const resumed = await runControlledFixtureAttempts({
    adapter: {
      kind: "deterministic_fixture",
      async invokeReader() {
        restartCalls += 1;
        return { outcome: "success" };
      },
    },
    adapterConcurrency: 2,
    dispatchContext: readerControlContext(fixture, readiness),
    invocations: fixture.readers,
    leaseToken: workflow.lease.token,
    policyConcurrency: 2,
    readiness: readiness.reader,
    requestedConcurrency: 2,
    retryPolicy: { max_attempts: 2, retryable_classes: ["transient"] },
    role: "reader",
    run: fixture.run,
    storeRoot: workflow.root,
  });
  const resumedSummary = buildRunReviewSummary({
    ...summaryInput,
    attempts: [...resumed.attempts, evaluatorAttempt],
    reusedUnitIds: { evaluator: [], reader: resumed.reused_unit_ids },
  });

  assert.deepEqual(summary.payload.operations.reader.attempts.retry_attempt_ids, ["reader-unit-one-controlled-2"]);
  assert.deepEqual(summary.payload.operations.reader.attempts.terminal.error, ["reader-unit-one-controlled-1"]);
  assert.deepEqual(summary.payload.operations.reader.newly_executed_unit_ids, ["unit-one", "unit-three"]);
  assert.equal(restartCalls, 0);
  assert.equal(summary.content_sha256, reversed.content_sha256);
  assert.equal(summary.content_sha256, resumedSummary.content_sha256);
  assert.throws(
    () =>
      buildRunReviewSummary({
        ...summaryInput,
        reusedUnitIds: { evaluator: [], reader: ["unit-one"] },
      }),
    hasCode("SUMMARY_OPERATION_INVALID"),
  );
});

function createReadinessFixture(options = {}) {
  const graph = createGraphFixture();
  const runtime = {
    model: "fixture-model",
    parameters: {
      ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
      ...(options.runtimeParameters ?? {}),
    },
    provider: "fixture",
    runtime_class: "fixture-runtime",
  };
  const selectedUnits =
    options.twoReaders === true
      ? [
          ...graph.run.payload.selected_units,
          { case_id: "case-two", role: "reader", suite: "regression", unit_id: "unit-three", variant: "candidate" },
        ].sort((left, right) => (left.unit_id < right.unit_id ? -1 : left.unit_id > right.unit_id ? 1 : 0))
      : graph.run.payload.selected_units;
  const run =
    options.run ??
    createHarnessArtifact({
      artifactType: "run_manifest",
      artifactId: graph.run.artifact_id,
      producer: graph.run.producer,
      links: graph.run.links,
      payload: {
        ...graph.run.payload,
        runtime_config_sha256: sha256Canonical(runtime),
        selected_units: selectedUnits,
      },
    });
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
  const reader = compileInvocation({
    artifactId: "cp4-reader-invocation",
    messages: [{ content: "Read the fixture and return an observation.", role: "user" }],
    protocol: { observation_instructions: "Return the exact observation contract.", output_schema: "observation-v2" },
    requestedPolicy: policy,
    resources: [],
    role: "reader",
    run,
    runtime,
    tools: [],
    unitId: "unit-one",
  });
  const evaluatorContract = options.evaluatorContract ?? {
    comparisonMapping: { candidate: "candidate" },
    protocol: { observation_instructions: "Return one advisory proposal.", output_schema: "proposal-v2" },
    rubric: { material: ["observable behavior"] },
  };
  const staticPlan = {
    comparison_mapping_sha256: sha256Canonical(evaluatorContract.comparisonMapping),
    protocol_sha256: sha256Canonical(evaluatorContract.protocol),
    rubric_sha256: sha256Canonical(evaluatorContract.rubric),
    runtime_config_sha256: sha256Canonical(runtime),
  };
  const readers = [reader];
  if (options.twoReaders === true) {
    readers.push(
      compileInvocation({
        artifactId: "cp4-reader-invocation-two",
        messages: [{ content: "Read the second fixture and return an observation.", role: "user" }],
        protocol: { observation_instructions: "Return the exact observation contract.", output_schema: "observation-v2" },
        requestedPolicy: policy,
        resources: [],
        role: "reader",
        run,
        runtime,
        tools: [],
        unitId: "unit-three",
      }),
    );
  }
  const fixture = {
    ...graph,
    run,
    capabilities: {
      adapter_id: "fixture-adapter",
      exposes: {
        model_visible_policy: true,
        observation_protocol: true,
        supplied_resources: true,
        tool_allowlist: true,
      },
      output_schemas: ["observation-v2", "proposal-v2"],
      policy: {
        credentials: ["excluded"],
        filesystem: ["none", "read_only"],
        fresh_context: true,
        mutation: ["denied"],
        network: ["denied"],
        remote_actions: ["denied"],
      },
      roles: ["evaluator", "reader", "verification_helper"],
      runtime_classes: ["fixture-runtime"],
    },
    evaluatorContract,
    reader,
    readers,
    runtime,
    staticPlan,
  };
  fixture.evaluatorStatic = {
    invocation: compileEvaluatorStaticInvocation(evaluatorCompileInput(fixture, staticPlan)),
    staticPlan,
  };
  return fixture;
}

function evaluatorCompileInput(fixture, staticPlan) {
  return {
    artifactId: "cp4-evaluator-static-invocation",
    messages: [{ content: "Prepare the evaluator stage without reader evidence.", role: "user" }],
    protocol: fixture.evaluatorContract.protocol,
    requestedPolicy: fixture.reader.payload.requested_policy,
    resources: [],
    run: fixture.run,
    runtime: fixture.runtime,
    staticPlan,
    tools: [],
    unitId: "unit-two",
  };
}

function readinessRound(fixture) {
  return {
    evaluatorStatic: fixture.evaluatorStatic,
    readerInvocations: fixture.readers,
    runtimeConfig: fixture.runtime,
  };
}

function executeFixtureReadiness(fixture, options = {}) {
  return executeReadiness({
    adapterCapabilities: fixture.capabilities,
    rounds: [readinessRound(fixture)],
    run: fixture.run,
    task: fixture.task,
    ...options,
  });
}

function createWorkflowStore(fixture, readiness) {
  const root = initializeRunStore(temporaryDirectory("harness-workflow-"));
  createRunRecord(root, fixture.task, fixture.run, { now: timestamp });
  for (const artifact of [
    ...fixture.readers,
    fixture.evaluatorStatic.invocation,
    readiness.reader,
    readiness.evaluator_static,
  ]) {
    writeArtifactObject(root, artifact);
  }
  const lease = acquireRunLease(root, fixture.run.artifact_id, {
    durationMs: 315_360_000_000,
    host: "fixture-host",
    now: timestamp,
    owner: "fixture-workflow",
    pid: 101,
    token: `workflow-${fixture.run.artifact_id}`,
  });
  let revision = 0;
  for (const state of ["preflight", "readiness", "ready"]) {
    transitionRun(root, {
      expectedRevision: revision,
      leaseToken: lease.token,
      nextState: state,
      now: timestamp,
      runId: fixture.run.artifact_id,
    });
    revision += 1;
  }
  return { lease, root };
}

function readerControlContext(fixture, readiness) {
  return {
    adapterCapabilities: fixture.capabilities,
    evaluatorStatic: fixture.evaluatorStatic,
    readinessSet: readiness,
    task: fixture.task,
  };
}

function createControlledAttemptPhase({ attemptId = null, fixture, phase, readiness, sequence = 1 }) {
  const fields = {
    dispatched: { call_certainty: "started", finished_at: null, outcome: null },
    prepared: { call_certainty: "not_started", finished_at: null, outcome: null },
    terminal: { call_certainty: "confirmed_finished", finished_at: timestamp, outcome: "error" },
  }[phase];
  const invocation = fixture.readers[0];
  const logicalAttemptId = attemptId ?? `reader-${invocation.payload.unit_id}-controlled-${sequence}`;
  return createHarnessArtifact({
    artifactType: "execution_attempt",
    artifactId: `${logicalAttemptId}-${phase}`,
    producer: producer("orchestrator"),
    links: [link("compiled_invocation", invocation), link("readiness", readiness), link("run", fixture.run)].sort(
      (left, right) => `${left.relationship}:${left.target_artifact_id}`.localeCompare(`${right.relationship}:${right.target_artifact_id}`),
    ),
    payload: {
      attempt_id: logicalAttemptId,
      ...fields,
      input_sha256: invocation.content_sha256,
      phase,
      role: "reader",
      run_id: fixture.run.artifact_id,
      sequence,
      started_at: timestamp,
      unit_id: invocation.payload.unit_id,
    },
  });
}

function fixtureReaderAdapter(calls = []) {
  return {
    kind: "deterministic_fixture",
    async invokeReader(request) {
      calls.push(request.unit_id);
      return {
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
          raw_text: `fixture observation for ${request.unit_id}`,
        },
        resources: [],
      };
    },
  };
}

function helperCluster(fixture) {
  return {
    category: "non_p0",
    cluster_id: "cluster-one",
    context: [{ label: "fixture", sha256: hashA }],
    protocol: { observation_instructions: "Resolve only the named uncertainty.", output_schema: "observation-v2" },
    question: "Is this deterministic fixture uncertainty resolved?",
    requested_policy: fixture.reader.payload.requested_policy,
    resources: [],
    runtime: fixture.runtime,
  };
}

function createStoreFixture(options = {}) {
  const root = initializeRunStore(temporaryDirectory("harness-store-"));
  const graph = createGraphFixture();
  createRunRecord(root, graph.task, graph.run, { now: timestamp });
  writeArtifactObject(root, graph.readerInvocation);
  writeArtifactObject(root, graph.evaluatorInvocation);
  writeArtifactObject(root, graph.readiness);
  writeArtifactObject(root, graph.evaluatorReadiness);
  const lease =
    options.acquireLease === false
      ? null
      : acquireRunLease(root, "run-one", {
          durationMs: 86_400_000,
          host: "fixture-host",
          now: timestamp,
          owner: "fixture-owner",
          pid: 100,
          token: "fixture-lease",
        });
  return { ...graph, lease, root };
}

function mutationOptions(fixture, overrides = {}) {
  return { leaseToken: fixture.lease.token, now: timestamp, ...overrides };
}

function transitionOptions(fixture, expectedRevision, nextState) {
  return { ...mutationOptions(fixture), expectedRevision, nextState, runId: "run-one" };
}

function createAttemptPhaseFixture(fixture, attemptId, unitId) {
  const base = unitId === fixture.evaluatorAttempt.payload.unit_id ? fixture.evaluatorAttempt : fixture.readerAttempt;
  const values = {
    prepared: { call_certainty: "not_started", finished_at: null, outcome: null },
    dispatched: { call_certainty: "started", finished_at: null, outcome: null },
    terminal: { call_certainty: "confirmed_finished", finished_at: timestamp, outcome: "success" },
  };
  return Object.fromEntries(
    Object.entries(values).map(([phase, fields]) => [
      phase,
      createHarnessArtifact({
        artifactType: "execution_attempt",
        artifactId: `${attemptId}-${phase}`,
        producer: base.producer,
        links: base.links,
        payload: {
          ...base.payload,
          ...fields,
          attempt_id: attemptId,
          phase,
          unit_id: unitId,
        },
      }),
    ]),
  );
}

function artifactCreationFields(artifact) {
  return {
    artifactId: artifact.artifact_id,
    artifactType: artifact.artifact_type,
    links: artifact.links,
    producer: artifact.producer,
  };
}

function temporaryDirectory(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

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
      link("compiled_invocation", readerInvocation),
      link("run", run),
    ],
    payload: {
      run_id: "run-one",
      round: 1,
      stage: "reader",
      status: "passed",
      field_results: [],
      invocation_hashes: [readerInvocation.content_sha256],
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
  const evaluatorReadiness = createHarnessArtifact({
    artifactType: "readiness_analysis",
    artifactId: "readiness-evaluator-one",
    producer: producer("readiness"),
    links: [link("compiled_invocation", evaluatorInvocation), link("run", run)],
    payload: {
      run_id: "run-one",
      round: 1,
      stage: "evaluator_static",
      status: "passed",
      field_results: [],
      invocation_hashes: [evaluatorInvocation.content_sha256],
      helper_attempt_ids: [],
      correction: null,
      grants: [],
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
      link("readiness", evaluatorReadiness),
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
    links: [
      link("evaluator_proposal", proposal),
      link("execution_attempt", readerAttempt),
      link("execution_attempt", evaluatorAttempt),
      link("run", run),
    ],
    payload: summaryPayload(),
  });
  const reviewPolicy = { version: "review-policy-v2" };
  const acceptanceInputId = deriveAcceptanceInputIdentity({
    accepted_scope: ["unit-one"],
    evidence_bindings: [
      {
        artifact_id: observation.artifact_id,
        artifact_type: observation.artifact_type,
        content_sha256: observation.content_sha256,
      },
      {
        artifact_id: resourceObservation.artifact_id,
        artifact_type: resourceObservation.artifact_type,
        content_sha256: resourceObservation.content_sha256,
      },
    ],
    proposals: [proposal],
    review_policy: reviewPolicy,
    summary,
  }).acceptance_input_id;
  const decision = createHarnessArtifact({
    artifactType: "human_review_decision",
    artifactId: "decision-one",
    producer: producer("authorized_reviewer"),
    links: [link("evaluator_proposal", proposal), link("summary", summary)],
    payload: {
      acceptance_input_id: acceptanceInputId,
      accepted_unit_ids: ["unit-one"],
      action: "accept",
      decided_at: timestamp,
      rationale: "Accepted after human review.",
      review_policy: reviewPolicy,
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
      acceptance_input_id: acceptanceInputId,
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
      acceptance_input_id: acceptanceInputId,
      accepted_unit_ids: ["unit-one"],
      aggregates: reportAggregates(["unit-one"]),
      decision_id: decision.artifact_id,
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
      evaluatorReadiness,
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
    readerAttempt,
    evaluatorAttempt,
    readiness,
    evaluatorReadiness,
    readerInvocation,
    evaluatorInvocation,
    summary,
    evaluation,
    proposal,
  };
}

function createReportDecisionLineageFixture() {
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
    payload: {
      ...runPayload(),
      selected_units: [
        { case_id: "case-one", role: "reader", suite: "regression", unit_id: "unit-one", variant: "candidate" },
        { case_id: "case-three", role: "reader", suite: "regression", unit_id: "unit-three", variant: "candidate" },
        { case_id: "case-one", role: "evaluator", suite: "regression", unit_id: "unit-two", variant: "candidate" },
      ],
    },
  });
  const readerInvocations = ["unit-one", "unit-three"].map((unitId) =>
    createHarnessArtifact({
      artifactType: "compiled_invocation",
      artifactId: `reader-invocation-${unitId.slice("unit-".length)}`,
      producer: producer("readiness_compiler"),
      links: [link("run", run)],
      payload: invocationPayload("reader", unitId),
    }),
  );
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
    links: [...readerInvocations.map((invocation) => link("compiled_invocation", invocation)), link("run", run)],
    payload: {
      run_id: "run-one",
      round: 1,
      stage: "reader",
      status: "passed",
      field_results: [],
      invocation_hashes: readerInvocations.map((invocation) => invocation.content_sha256).sort(),
      helper_attempt_ids: [],
      correction: null,
      grants: readerInvocations.map((invocation) => ({
        unit_id: invocation.payload.unit_id,
        invocation_sha256: invocation.content_sha256,
        nonce: `grant-${invocation.payload.unit_id}`,
        single_use: true,
      })),
    },
  });
  const evaluatorReadiness = createHarnessArtifact({
    artifactType: "readiness_analysis",
    artifactId: "readiness-evaluator-one",
    producer: producer("readiness"),
    links: [link("compiled_invocation", evaluatorInvocation), link("run", run)],
    payload: {
      run_id: "run-one",
      round: 1,
      stage: "evaluator_static",
      status: "passed",
      field_results: [],
      invocation_hashes: [evaluatorInvocation.content_sha256],
      helper_attempt_ids: [],
      correction: null,
      grants: [],
    },
  });
  const readerAttempts = readerInvocations.map((invocation) => {
    const suffix = invocation.payload.unit_id.slice("unit-".length);
    return createHarnessArtifact({
      artifactType: "execution_attempt",
      artifactId: `attempt-${suffix}`,
      producer: producer("orchestrator"),
      links: [link("compiled_invocation", invocation), link("readiness", readiness), link("run", run)],
      payload: attemptPayload(`attempt-${suffix}`, "reader", invocation.payload.unit_id, invocation.content_sha256),
    });
  });
  const evaluatorAttempt = createHarnessArtifact({
    artifactType: "execution_attempt",
    artifactId: "attempt-two",
    producer: producer("orchestrator"),
    links: [link("compiled_invocation", evaluatorInvocation), link("readiness", evaluatorReadiness), link("run", run)],
    payload: attemptPayload("attempt-two", "evaluator", "unit-two", evaluatorInvocation.content_sha256),
  });
  const observations = readerAttempts.map((attempt, index) => {
    const invocation = readerInvocations[index];
    const suffix = attempt.payload.unit_id.slice("unit-".length);
    return createHarnessArtifact({
      artifactType: "observation",
      artifactId: `observation-${suffix}`,
      producer: producer("adapter"),
      links: [link("attempt", attempt), link("compiled_invocation", invocation)],
      payload: {
        attempt_id: attempt.payload.attempt_id,
        execution_status: "completed",
        observed_access: {
          credentials: "not_observed",
          filesystem: "observed",
          mutation: "not_observed",
          network: "not_observed",
          remote_actions: "not_observed",
          tools: "observed",
        },
        raw_text: `Reader output for ${attempt.payload.unit_id}.`,
        run_id: "run-one",
        unit_id: attempt.payload.unit_id,
      },
    });
  });
  const proposals = observations.map((observation) => {
    const suffix = observation.payload.unit_id.slice("unit-".length);
    return createHarnessArtifact({
      artifactType: "evaluator_proposal",
      artifactId: `proposal-${suffix}`,
      producer: producer("evaluator"),
      links: [link("attempt", evaluatorAttempt), link("observation", observation)],
      payload: {
        case_status: "passed",
        citations: [{ artifact_id: observation.artifact_id, label: "Observed behavior" }],
        comparison_status: "equivalent",
        rationale: `Proposal for ${observation.payload.unit_id}.`,
        recommendation: "accept",
        uncertainty: "",
        unit_id: observation.payload.unit_id,
      },
    });
  });
  const summary = createHarnessArtifact({
    artifactType: "run_review_summary",
    artifactId: "summary-one",
    producer: producer("review_builder"),
    links: [
      ...proposals.map((proposal) => link("evaluator_proposal", proposal)),
      ...readerAttempts.map((attemptValue) => link("execution_attempt", attemptValue)),
      link("execution_attempt", evaluatorAttempt),
      link("run", run),
    ],
    payload: twoUnitSummaryPayload(),
  });
  const evidenceBindings = observations.map((observation) => ({
    artifact_id: observation.artifact_id,
    artifact_type: observation.artifact_type,
    content_sha256: observation.content_sha256,
  }));
  const reviewPolicy = { version: "review-policy-v2" };
  const createDecision = ({ acceptedUnitIds, artifactId, reviewer }) => {
    const acceptanceInputId = deriveAcceptanceInputIdentity({
      accepted_scope: acceptedUnitIds,
      evidence_bindings: evidenceBindings,
      proposals,
      review_policy: reviewPolicy,
      summary,
    }).acceptance_input_id;
    return createHarnessArtifact({
      artifactType: "human_review_decision",
      artifactId,
      producer: producer("authorized_reviewer"),
      links: [...proposals.map((proposal) => link("evaluator_proposal", proposal)), link("summary", summary)],
      payload: {
        acceptance_input_id: acceptanceInputId,
        accepted_unit_ids: acceptedUnitIds,
        action: "accept",
        decided_at: timestamp,
        rationale: `Accepted ${acceptedUnitIds.join(", ")}.`,
        review_policy: reviewPolicy,
        reviewer: { identity: reviewer, identity_type: "local_named_reviewer" },
        summary_sha256: summary.content_sha256,
      },
    });
  };
  const completeDecision = createDecision({
    acceptedUnitIds: ["unit-one", "unit-three"],
    artifactId: "decision-complete",
    reviewer: "owner-reviewer",
  });
  const reviewerReplacementDecision = createDecision({
    acceptedUnitIds: ["unit-one", "unit-three"],
    artifactId: "decision-reviewer-replacement",
    reviewer: "second-owner-reviewer",
  });
  const splitDecisions = [
    createDecision({ acceptedUnitIds: ["unit-one"], artifactId: "decision-one", reviewer: "owner-reviewer" }),
    createDecision({ acceptedUnitIds: ["unit-three"], artifactId: "decision-three", reviewer: "owner-reviewer" }),
  ];
  const createEvaluation = (proposal, decision, artifactId) =>
    createHarnessArtifact({
      artifactType: "human_evaluation",
      artifactId,
      producer: producer("materializer"),
      links: [link("decision", decision), link("evaluator_proposal", proposal), link("summary", summary)],
      payload: {
        acceptance_input_id: decision.payload.acceptance_input_id,
        case_status: proposal.payload.case_status,
        comparison_status: proposal.payload.comparison_status,
        decision_id: decision.artifact_id,
        proposal_id: proposal.artifact_id,
        unit_id: proposal.payload.unit_id,
      },
    });
  const completeEvaluations = proposals.map((proposal) =>
    createEvaluation(proposal, completeDecision, `evaluation-complete-${proposal.payload.unit_id}`),
  );
  const mixedDecisionEvaluations = [
    createEvaluation(proposals[0], completeDecision, "evaluation-mixed-decision-one"),
    createEvaluation(proposals[1], reviewerReplacementDecision, "evaluation-mixed-decision-three"),
  ];
  const mixedAcceptanceEvaluations = proposals.map((proposal, index) =>
    createEvaluation(proposal, splitDecisions[index], `evaluation-mixed-acceptance-${proposal.payload.unit_id}`),
  );
  const createReport = (evaluations, artifactId, decision, acceptedUnitIds = ["unit-one", "unit-three"]) =>
    createHarnessArtifact({
      artifactType: "generated_report",
      artifactId,
      producer: producer("reporter"),
      links: [...evaluations.map((evaluation) => link("human_evaluation", evaluation)), link("run", run)],
      payload: {
        acceptance_input_id: decision.payload.acceptance_input_id,
        accepted_unit_ids: acceptedUnitIds,
        aggregates: reportAggregates(acceptedUnitIds),
        decision_id: decision.artifact_id,
        run_id: "run-one",
        status: "complete",
        summary_sha256: summary.content_sha256,
      },
    });
  return {
    completeDecision,
    completeEvaluations,
    completeReport: createReport(completeEvaluations, "report-complete", completeDecision),
    core: [
      task,
      run,
      ...readerInvocations,
      evaluatorInvocation,
      readiness,
      evaluatorReadiness,
      ...readerAttempts,
      evaluatorAttempt,
      ...observations,
      ...proposals,
      summary,
    ],
    incompleteDecisionScopeReport: createReport(
      [completeEvaluations[0]],
      "report-incomplete-decision-scope",
      completeDecision,
      ["unit-one"],
    ),
    mixedAcceptanceEvaluations,
    mixedAcceptanceReport: createReport(mixedAcceptanceEvaluations, "report-mixed-acceptance", splitDecisions[0]),
    mixedDecisionEvaluations,
    mixedDecisionReport: createReport(mixedDecisionEvaluations, "report-mixed-decision", completeDecision),
    reviewerReplacementDecision,
    splitDecisions,
  };
}

function createSameRunCrossUnitProposalGraph() {
  const task = createHarnessArtifact({
    artifactType: "task_manifest",
    artifactId: "task-cross-unit",
    producer: producer("operator"),
    payload: {
      task_id: "task-cross-unit",
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
    payload: {
      ...runPayload(),
      task_id: task.artifact_id,
      selected_units: [
        { case_id: "case-one", role: "reader", suite: "regression", unit_id: "unit-one", variant: "candidate" },
        { case_id: "case-three", role: "reader", suite: "regression", unit_id: "unit-three", variant: "candidate" },
        { case_id: "case-one", role: "evaluator", suite: "regression", unit_id: "unit-two", variant: "candidate" },
      ],
    },
  });
  const readerOne = createHarnessArtifact({
    artifactType: "compiled_invocation",
    artifactId: "reader-invocation-one",
    producer: producer("readiness_compiler"),
    links: [link("run", run)],
    payload: invocationPayload("reader", "unit-one"),
  });
  const readerThree = createHarnessArtifact({
    artifactType: "compiled_invocation",
    artifactId: "reader-invocation-three",
    producer: producer("readiness_compiler"),
    links: [link("run", run)],
    payload: invocationPayload("reader", "unit-three"),
  });
  const evaluator = createHarnessArtifact({
    artifactType: "compiled_invocation",
    artifactId: "evaluator-invocation-cross-unit",
    producer: producer("readiness_compiler"),
    links: [link("run", run)],
    payload: invocationPayload("evaluator", "unit-two"),
  });
  const readiness = createHarnessArtifact({
    artifactType: "readiness_analysis",
    artifactId: "readiness-cross-unit",
    producer: producer("readiness"),
    links: [link("compiled_invocation", readerOne), link("compiled_invocation", readerThree), link("run", run)],
    payload: {
      run_id: run.artifact_id,
      round: 1,
      stage: "reader",
      status: "passed",
      field_results: [],
      invocation_hashes: [readerOne.content_sha256, readerThree.content_sha256].sort(),
      helper_attempt_ids: [],
      correction: null,
      grants: [
        {
          unit_id: "unit-one",
          invocation_sha256: readerOne.content_sha256,
          nonce: "grant-cross-unit-one",
          single_use: true,
        },
        {
          unit_id: "unit-three",
          invocation_sha256: readerThree.content_sha256,
          nonce: "grant-cross-unit-three",
          single_use: true,
        },
      ],
    },
  });
  const evaluatorReadiness = createHarnessArtifact({
    artifactType: "readiness_analysis",
    artifactId: "readiness-evaluator-cross-unit",
    producer: producer("readiness"),
    links: [link("compiled_invocation", evaluator), link("run", run)],
    payload: {
      run_id: run.artifact_id,
      round: 1,
      stage: "evaluator_static",
      status: "passed",
      field_results: [],
      invocation_hashes: [evaluator.content_sha256],
      helper_attempt_ids: [],
      correction: null,
      grants: [],
    },
  });
  const readerAttempt = createHarnessArtifact({
    artifactType: "execution_attempt",
    artifactId: "attempt-reader-three",
    producer: producer("orchestrator"),
    links: [link("compiled_invocation", readerThree), link("readiness", readiness), link("run", run)],
    payload: attemptPayload("attempt-reader-three", "reader", "unit-three", readerThree.content_sha256),
  });
  const evaluatorAttempt = createHarnessArtifact({
    artifactType: "execution_attempt",
    artifactId: "attempt-evaluator-cross-unit",
    producer: producer("orchestrator"),
    links: [link("compiled_invocation", evaluator), link("readiness", evaluatorReadiness), link("run", run)],
    payload: attemptPayload("attempt-evaluator-cross-unit", "evaluator", "unit-two", evaluator.content_sha256),
  });
  const observation = createHarnessArtifact({
    artifactType: "observation",
    artifactId: "observation-unit-three",
    producer: producer("adapter"),
    links: [link("attempt", readerAttempt), link("compiled_invocation", readerThree)],
    payload: {
      attempt_id: readerAttempt.payload.attempt_id,
      execution_status: "completed",
      observed_access: {
        credentials: "not_observed",
        filesystem: "observed",
        mutation: "not_observed",
        network: "not_observed",
        remote_actions: "not_observed",
        tools: "observed",
      },
      raw_text: "Valid evidence for another selected reader unit.",
      run_id: run.artifact_id,
      unit_id: "unit-three",
    },
  });
  const resourceObservation = createHarnessArtifact({
    artifactType: "resource_observation",
    artifactId: "resource-unit-three",
    producer: producer("adapter"),
    links: [link("observation", observation)],
    payload: {
      basis: "unavailable",
      denied: null,
      limitations: "Exact resource access was unavailable.",
      observation_id: observation.artifact_id,
      read: null,
      supplied: null,
    },
  });
  const proposal = createHarnessArtifact({
    artifactType: "evaluator_proposal",
    artifactId: "proposal-unit-one-with-unit-three-evidence",
    producer: producer("evaluator"),
    links: [
      link("attempt", evaluatorAttempt),
      link("observation", observation),
      link("resource_observation", resourceObservation),
    ],
    payload: {
      case_status: "passed",
      citations: [{ artifact_id: observation.artifact_id, label: "Wrong-unit evidence" }],
      comparison_status: "equivalent",
      rationale: "Individually valid evidence from another unit.",
      recommendation: "accept",
      uncertainty: "",
      unit_id: "unit-one",
    },
  });
  return [
    task,
    run,
    readerOne,
    readerThree,
    evaluator,
    readiness,
    evaluatorReadiness,
    readerAttempt,
    evaluatorAttempt,
    observation,
    resourceObservation,
    proposal,
  ];
}

function runPayload() {
  return {
    adapter_id: "fixture-adapter",
    created_at: timestamp,
    revision: 0,
    run_id: "run-one",
    runtime_config_sha256: sha256Canonical(fixtureRuntime()),
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
    runtime: fixtureRuntime(),
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

function twoUnitSummaryPayload() {
  const caseIds = ["case-one", "case-three"];
  const unitIds = ["unit-one", "unit-three"];
  return {
    ...summaryPayload(),
    baseline: twoCaseAggregate(caseIds),
    candidate: twoCaseAggregate(caseIds),
    comparison: {
      counts: { equivalent: 2, improved: 0, inconclusive: 0, regressed: 0, unassessed: 0 },
      evidence: { assessed_unit_ids: unitIds, unassessed_unit_ids: [] },
      scope_unit_ids: unitIds,
      status_members: { equivalent: unitIds, improved: [], inconclusive: [], regressed: [] },
    },
    operations: {
      evaluator: operationalAggregate("unit-two", "attempt-two"),
      reader: {
        attempts: {
          initial_attempt_ids: ["attempt-one", "attempt-three"],
          nonterminal_attempt_ids: [],
          retry_attempt_ids: [],
          terminal: {
            cancelled: [],
            error: [],
            outcome_unknown: [],
            success: ["attempt-one", "attempt-three"],
            timeout: [],
          },
        },
        blocked_unit_ids: [],
        newly_executed_unit_ids: unitIds,
        reused_unit_ids: [],
        scope_unit_ids: unitIds,
      },
    },
    proposed_action: "accept unit-one and unit-three",
    scope: {
      baseline_case_ids: caseIds,
      candidate_case_ids: caseIds,
      comparable_unit_ids: unitIds,
      selected_case_ids: caseIds,
    },
  };
}

function twoCaseAggregate(caseIds) {
  return {
    counts: { failed: 0, not_run: 0, partially_passed: 0, passed: 2, unassessed: 0 },
    evidence: { complete_case_ids: caseIds, incomplete_case_ids: [] },
    scope_case_ids: caseIds,
    status_members: { failed: [], not_run: [], partially_passed: [], passed: caseIds },
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

function reportAggregates(unitIds) {
  return {
    case_status: { failed: [], not_run: [], partially_passed: [], passed: [...unitIds].sort() },
    comparison_status: { equivalent: [...unitIds].sort(), improved: [], inconclusive: [], not_applicable: [], regressed: [] },
  };
}

function createSummary(fixture, payload) {
  return createHarnessArtifact({
    artifactType: "run_review_summary",
    artifactId: "summary-invalid",
    producer: producer("review_builder"),
    links: [
      link("evaluator_proposal", fixture.proposal),
      link("execution_attempt", fixture.readerAttempt),
      link("execution_attempt", fixture.evaluatorAttempt),
      link("run", fixture.run),
    ],
    payload,
  });
}

function readerIdentityInput(fixture) {
  return {
    attestation: {
      adapter_capabilities: { filesystem: "read_only", network: "denied" },
      enforced_policy: { filesystem: "read_only", network: "denied" },
      runtime_config_sha256: sha256Canonical(
        fixture.artifacts.find(
          (artifact) => artifact.artifact_type === "compiled_invocation" && artifact.payload.role === "reader",
        ).payload.runtime,
      ),
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
  const resourceObservation = fixture.artifacts.find(
    (artifact) => artifact.artifact_type === "resource_observation",
  );
  return {
    accepted_scope: ["unit-one"],
    evidence_bindings: [
      {
        artifact_id: observation.artifact_id,
        artifact_type: observation.artifact_type,
        content_sha256: observation.content_sha256,
      },
      {
        artifact_id: resourceObservation.artifact_id,
        artifact_type: resourceObservation.artifact_type,
        content_sha256: resourceObservation.content_sha256,
      },
    ],
    proposals: [fixture.proposal],
    review_policy: { version: "review-policy-v2" },
    summary: fixture.summary,
  };
}

function fixtureRuntime(parameters = {}) {
  return {
    model: "fixture-model",
    parameters,
    provider: "fixture",
    runtime_class: "fixture-runtime",
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
