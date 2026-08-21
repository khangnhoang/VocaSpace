// Test plan:
// - Mục tiêu: kiểm tra schema, identity, durable state và exact readiness/P0 contracts của eval harness v2.
// - Loại test: Node schema/unit/CLI black-box.
// - Đối tượng: schema/identity/store/readiness v2 và read-only harness CLI.
// - Case thành công: strict graph, logical hashes, crash recovery, bounded helpers và complete-set readiness grants.
// - Case thất bại: corrupt state/link, semantic-lineage substitution, unsafe path, P0/capability/static-plan mismatch, stale grant và invalid correction.
// - Bảo mật/phân quyền: model không tạo human evidence; helper chỉ là deterministic fixture; P0 failure giữ reader calls `0`.
// - Ổn định/resilience: canonical hashes, CAS/lease/journal, immutable attempts, two-round cap và TOCTOU recheck.
// - Invariant cần giữ: invalid/uncertain input không thể thành evidence, grant hoặc implicit `not_run`.
// - Kết quả verify gần nhất: passed 111 tests bằng `node --test .agents/scripts/run-skill-eval-harness.test.mjs`.
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
  loadRunManifest,
  planResume,
  readArtifactObject,
  readAttemptPhases,
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
      links: [link("evaluator_proposal", fixture.proposal), link("run", otherRun)],
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
  const storeRoot = spawnSync(process.execPath, [cliPath, "store", "root"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(JSON.parse(valid.stdout).status, "valid");
  assert.equal(help.status, 0);
  assert.match(help.stdout, /without executing a model, helper, evaluator, or provider/);
  assert.match(help.stdout, /state inspect --run/);
  assert.doesNotMatch(help.stdout, /\brun\b.*model/i);
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

  assert.equal(first.acceptance_input_id, "eb0acc74a93b7debe4cac2ccfcc892a40e7aa61face93d9e9cc3fabcb0a30d04");
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
    links: [link("evaluator_proposal", duplicate), link("evaluator_proposal", fixture.proposal), link("run", fixture.run)],
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

  assert.equal(reloaded.length, 8);
  assert.equal(reloaded.filter((item) => item.artifact_type === "readiness_analysis").length, 2);
  assert.equal(readAttemptPhases(store.root, "run-one", "cluster-one-helper-1").terminal.payload.outcome, "success");
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
  const staticPlan = {
    comparison_mapping_sha256: "b".repeat(64),
    protocol_sha256: "c".repeat(64),
    rubric_sha256: "d".repeat(64),
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
    protocol: { observation_instructions: "Return the exact proposal contract.", output_schema: "proposal-v2" },
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
    links: [link("evaluator_proposal", proposal), link("run", run)],
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
    links: [...proposals.map((proposal) => link("evaluator_proposal", proposal)), link("run", run)],
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
