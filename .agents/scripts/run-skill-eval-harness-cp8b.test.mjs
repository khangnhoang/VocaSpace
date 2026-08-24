// Test plan:
// - Mục tiêu: chứng nhận đúng 18 contract CP8B, gồm owner-issued cleanup authority, global retained closure, historical review lineage và legacy boundary.
// - Loại test: Node unit/integration với local store và deterministic mocked App Server/shadow cleanup adapters.
// - Đối tượng: retention-v2, lifecycle/hold authority, shared CAS reachability, exact-plan apply/purge, review/runtime rebuild và v1 inventory.
// - Case thành công: verified issuance/reference, reviewed quarantine/purge, complete retained closure, historical-run rebuild và read-only legacy inventory.
// - Case thất bại: self-issued/future/donor authority, stale CAS/plan, active/held/unknown state, wrong semantic lineage, ambiguous cleanup và v1 promotion.
// - Bảo mật/phân quyền: destructive mutation chỉ nhận exact canonical authority reference sau independently verified issuance; live calls `0`.
// - Ổn định/resilience: append-only hashes/CAS, immutable plans, idempotent reconciliation, quarantine-before-purge và fail-closed drift.
// - Invariant cần giữ: cleanup task A không xóa retained evidence của task B; derived/shadow/legacy state không thể tự cấp semantic authority.
// - Kết quả verify gần nhất: passed 24/24 assertions cho đúng 18 frozen regressions bằng deterministic mocked transport; live calls `0`.
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { canonicalJson, canonicalJsonLine, sha256Bytes, sha256Canonical } from "./lib/skill-evals/artifact-schema-v1.mjs";
import {
  HarnessError,
  assertHarnessArtifact,
  createHarnessArtifact,
  routeArtifactVersion,
} from "./lib/skill-evals/harness-schema-v2.mjs";
import { compileInvocation } from "./lib/skill-evals/readiness-v2.mjs";
import {
  deriveAcceptanceInputIdentity,
  deriveEvaluatorVisibleEvidence,
  deriveReaderInputIdentity,
} from "./lib/skill-evals/logical-identity-v2.mjs";
import {
  acquireRunLease,
  appendAttemptPhase,
  createRunRecord,
  initializeRunStore,
  listStoredArtifacts,
  loadRunManifest,
  loadTaskManifest,
  readAttemptPhases,
  readRuntimeSnapshot,
  recordRuntimeResultView,
  recordRuntimeJournalEvent,
  rebuildRuntimeIndex,
  transitionRun,
  writeArtifactObject,
} from "./lib/skill-evals/run-store-v2.mjs";
import {
  buildRunReviewSummary,
  createAcceptedReport,
  createHumanReviewDecision,
  materializeHumanEvaluations,
  publishRunReview,
  renderReviewRepresentations,
  validateReviewRepresentations,
} from "./lib/skill-evals/review-v2.mjs";
import {
  appendCleanupHoldEvent,
  appendTaskLifecycleEvent,
  applyRetentionPlan,
  createRetentionPlan,
  inventoryLegacyV1,
  issueCleanupAuthority,
  purgeRetentionPlan,
  readCleanupHolds,
  readTaskLifecycle,
  rebuildReviewViews,
  validateReviewViews,
} from "./lib/skill-evals/retention-v2.mjs";
import { createCodexChatGptAppServerAdapter } from "./lib/skill-evals/codex-chatgpt-app-server-v2.mjs";

const timestamp = "2026-08-24T00:00:00.000Z";
const later = "2026-08-24T00:01:00.000Z";
const hashA = "a".repeat(64);
const roots = [];
const cliPath = fileURLToPath(new URL("./run-skill-eval-harness.mjs", import.meta.url));

test.after(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
});

test("CP8B 01 unrelated PR merge cannot close a task", () => {
  const source = createStoreFixture({ pullRequest: "owner/repo#81", suffix: "source" });
  const donor = createStoreFixture({ pullRequest: "owner/repo#82", suffix: "donor" });
  closeByMerge(donor, { pullRequest: "owner/repo#82" });
  assert.equal(readTaskLifecycle(donor.root, donor.task.artifact_id).state, "closed");

  assert.throws(
    () => closeByMerge(source, { pullRequest: "owner/repo#82" }),
    hasCode("TASK_PR_BINDING_INVALID"),
  );
  assert.equal(readTaskLifecycle(source.root, source.task.artifact_id).state, "active");
});

test("CP8B 02 exact task-bound successful PR merge closes active", () => {
  const fixture = createStoreFixture({ pullRequest: "owner/repo#83", suffix: "close" });
  const event = closeByMerge(fixture, { pullRequest: "owner/repo#83" });

  assert.equal(event.prior_state, "active");
  assert.equal(event.next_state, "closed");
  assert.equal(readTaskLifecycle(fixture.root, fixture.task.artifact_id).state, "closed");
  assert.equal(loadTaskManifest(fixture.root, fixture.task.artifact_id).payload.lifecycle, "active");
});

test("CP8B 03 stale lifecycle tail CAS is rejected", () => {
  const fixture = createStoreFixture({ suffix: "stale-life" });
  abandon(fixture);

  assert.throws(
    () => appendTaskLifecycleEvent(fixture.root, {
      authority: taskAuthority(fixture.task.artifact_id, "close_task", "owner", "stale-close"),
      authorityVerifier: () => true,
      basis: "owner_reconciled_close",
      basisIdentity: reconciledBasis("stale-close"),
      expectedPriorEventSha256: null,
      expectedSequence: 1,
      now: later,
      taskId: fixture.task.artifact_id,
    }),
    hasCode("TASK_LIFECYCLE_STALE"),
  );
  assert.equal(readTaskLifecycle(fixture.root, fixture.task.artifact_id).state, "abandoned");
});

test("CP8B 04 abandonment requires independently verified exact owner authority", () => {
  const fixture = createStoreFixture({ suffix: "abandon" });
  const donor = createStoreFixture({ suffix: "abandon-donor" });
  abandon(donor);
  assert.equal(readTaskLifecycle(donor.root, donor.task.artifact_id).state, "abandoned");

  assert.throws(
    () => appendTaskLifecycleEvent(fixture.root, {
      authority: taskAuthority(donor.task.artifact_id, "abandon_task", "owner", "donor-abandon"),
      authorityVerifier: () => true,
      basis: "owner_abandoned",
      basisIdentity: { decision_id: "donor-abandon", reason: "Donor owner stopped donor task." },
      expectedPriorEventSha256: null,
      expectedSequence: 1,
      now: timestamp,
      taskId: fixture.task.artifact_id,
    }),
    hasCode("TASK_AUTHORITY_INVALID"),
  );
  assert.throws(
    () => appendTaskLifecycleEvent(fixture.root, {
      authority: taskAuthority(fixture.task.artifact_id, "abandon_task", "owner", "unverified-abandon"),
      authorityVerifier: () => false,
      basis: "owner_abandoned",
      basisIdentity: { decision_id: "unverified-abandon", reason: "Unverified owner decision." },
      expectedPriorEventSha256: null,
      expectedSequence: 1,
      now: timestamp,
      taskId: fixture.task.artifact_id,
    }),
    hasCode("TASK_AUTHORITY_INVALID"),
  );
  assert.equal(readTaskLifecycle(fixture.root, fixture.task.artifact_id).state, "active");
});

test("CP8B 05 active task cannot enter destructive cleanup", () => {
  const fixture = createStoreFixture({ orphan: true, suffix: "active" });
  const before = targetSnapshot(fixture.root);
  const plan = createRetentionPlan(fixture.root, { now: later, taskId: fixture.task.artifact_id });
  const apply = applyRetentionPlan(fixture.root, {
    authorityReference: issueApplyAuthority(fixture.root, plan, []),
    now: later,
    planSha256: plan.plan_sha256,
  });

  assert.ok(plan.items.every((item) => item.classification === "retain"));
  assert.equal(apply.status, "complete");
  assert.deepEqual(targetSnapshot(fixture.root), before);
});

test("CP8B 06 each frozen hold category independently vetoes destructive cleanup", async (t) => {
  for (const category of ["open_review", "open_pr", "expected_correction"]) {
    await t.test(category, () => {
      const fixture = createStoreFixture({ orphan: true, suffix: `hold-${category.replace("_", "-")}` });
      abandon(fixture);
      placeHold(fixture, category);
      const before = targetSnapshot(fixture.root);
      const plan = createRetentionPlan(fixture.root, { now: later, taskId: fixture.task.artifact_id });
      const apply = applyRetentionPlan(fixture.root, {
        authorityReference: issueApplyAuthority(fixture.root, plan, []),
        now: later,
        planSha256: plan.plan_sha256,
      });
      assert.ok(plan.items.every((item) => item.classification === "retain"));
      assert.equal(apply.status, "complete");
      assert.deepEqual(targetSnapshot(fixture.root), before);
    });
  }
});

test("CP8B 07 dry-run publishes only immutable audit plan with zero target mutation", () => {
  const fixture = createStoreFixture({ orphan: true, suffix: "dry-run" });
  abandon(fixture);
  const before = targetSnapshot(fixture.root);

  const plan = createRetentionPlan(fixture.root, { now: later, taskId: fixture.task.artifact_id });

  assert.equal(existsSync(join(fixture.root, "tasks", fixture.task.artifact_id, "cleanup", "plans", `${plan.plan_sha256}.json`)), true);
  assert.deepEqual(targetSnapshot(fixture.root), before);
  assert.deepEqual(listFiles(join(fixture.root, "quarantine")), []);

  const cli = createCliFixture("cli-workflow");
  const cliPlanResult = runCli(cli.repository, ["retention", "plan", "--task", cli.task.artifact_id]);
  assert.equal(cliPlanResult.status, 0, cliPlanResult.stderr);
  const cliPlan = JSON.parse(cliPlanResult.stdout);
  const applyPath = join(cli.repository, "apply-authority.json");
  writeFileSync(
    applyPath,
    canonicalJson(issueApplyAuthority(cli.root, cliPlan, ["local_quarantine"], "cli-apply")),
    "utf8",
  );
  const cliApplyResult = runCli(cli.repository, ["retention", "apply", "--plan", cliPlan.plan_sha256, "--authority", applyPath]);
  assert.equal(cliApplyResult.status, 0, cliApplyResult.stderr);
  const cliApply = JSON.parse(cliApplyResult.stdout);
  const purgePath = join(cli.repository, "purge-authority.json");
  writeFileSync(
    purgePath,
    canonicalJson(issuePurgeAuthority(cli.root, cliPlan, cliApply, {
      authority_id: "authority-cli-purge",
      nonce: "cli-purge",
    })),
    "utf8",
  );
  const cliPurgeResult = runCli(cli.repository, ["retention", "purge", "--apply", cliApply.apply_sha256, "--authority", purgePath]);
  assert.equal(cliPurgeResult.status, 0, cliPurgeResult.stderr);
  assert.equal(JSON.parse(cliPurgeResult.stdout).status, "complete");
});

test("CP8B 08 exact reviewed plan and apply authority affect only listed quarantine actions", () => {
  const source = createStoreFixture({ orphan: true, suffix: "apply-source" });
  const donor = addTaskAndRun(source.root, "task-apply-donor", "run-apply-donor");
  abandon(source);
  abandon(donor);
  const sourcePlan = createRetentionPlan(source.root, { now: later, taskId: source.task.artifact_id });
  const donorPlan = createRetentionPlan(source.root, { now: later, taskId: donor.task.artifact_id });
  const donorReference = issueApplyAuthority(source.root, donorPlan, ["local_quarantine"], "donor-apply");
  const before = targetSnapshot(source.root);

  assert.throws(
    () => applyRetentionPlan(source.root, {
      authorityReference: donorReference,
      now: later,
      planSha256: sourcePlan.plan_sha256,
    }),
    hasCode("CLEANUP_APPLY_AUTHORITY_INVALID"),
  );
  assert.throws(
    () => applyRetentionPlan(source.root, {
      authorityReference: applyAuthority(sourcePlan, ["local_quarantine"], "self-authored"),
      now: later,
      planSha256: sourcePlan.plan_sha256,
    }),
    hasCode("STORE_RECORD_INVALID"),
  );
  const unverified = applyAuthority(sourcePlan, ["local_quarantine"], "unverified");
  assert.throws(
    () => issueAuthority(source.root, "apply", unverified, { verified: false }),
    hasCode("CLEANUP_AUTHORITY_ISSUANCE_INVALID"),
  );
  const futureAuthority = {
    ...applyAuthority(sourcePlan, ["local_quarantine"], "future-issued"),
    expires_at: "2026-08-24T00:03:00.000Z",
    issued_at: "2026-08-24T00:02:00.000Z",
  };
  const futureReference = issueAuthority(source.root, "apply", futureAuthority, {
    now: "2026-08-24T00:02:00.000Z",
  });
  assert.throws(
    () => applyRetentionPlan(source.root, {
      authorityReference: futureReference,
      now: later,
      planSha256: sourcePlan.plan_sha256,
    }),
    hasCode("CLEANUP_APPLY_AUTHORITY_INVALID"),
  );
  assert.deepEqual(targetSnapshot(source.root), before);
  const sourceReference = issueApplyAuthority(source.root, sourcePlan, ["local_quarantine"]);
  const apply = applyRetentionPlan(source.root, {
    authorityReference: sourceReference,
    now: later,
    planSha256: sourcePlan.plan_sha256,
  });
  assert.equal(apply.status, "complete");
  assert.deepEqual(
    apply.results.map((result) => result.item_id).sort(),
    sourcePlan.items.filter((item) => item.classification !== "retain").map((item) => item.item_id).sort(),
  );
  const replay = applyRetentionPlan(source.root, {
    authorityReference: sourceReference,
    now: later,
    planSha256: sourcePlan.plan_sha256,
  });
  assert.equal(replay.apply_sha256, apply.apply_sha256);
  const beforePurge = targetSnapshot(source.root);
  const unverifiedPurge = purgeAuthority(sourcePlan, apply);
  assert.throws(
    () => issueAuthority(source.root, "purge", unverifiedPurge, { verified: false }),
    hasCode("CLEANUP_AUTHORITY_ISSUANCE_INVALID"),
  );
  assert.throws(
    () => purgeRetentionPlan(source.root, {
      applySha256: apply.apply_sha256,
      authorityReference: sourceReference,
      now: later,
    }),
    hasCode("CLEANUP_AUTHORITY_UNRESOLVED"),
  );
  assert.deepEqual(targetSnapshot(source.root), beforePurge);
});

test("CP8B 09 lifecycle, hold, root or revision drift makes plan stale before mutation", async (t) => {
  for (const drift of ["hold", "root", "revision"]) {
    await t.test(drift, () => {
      const fixture = createStoreFixture({ orphan: true, suffix: `drift-${drift}` });
      abandon(fixture);
      const plan = createRetentionPlan(fixture.root, { now: later, taskId: fixture.task.artifact_id });
      if (drift === "hold") placeHold(fixture, "open_review");
      if (drift === "root") writeArtifactObject(fixture.root, standaloneArtifact(`new-root-${drift}`));
      if (drift === "revision") mutateRunRevision(fixture);
      const before = targetSnapshot(fixture.root);
      assert.throws(
        () => applyRetentionPlan(fixture.root, {
          authorityReference: issueApplyAuthority(fixture.root, plan, ["local_quarantine"]),
          now: later,
          planSha256: plan.plan_sha256,
        }),
        hasCode("CLEANUP_PLAN_STALE"),
      );
      assert.deepEqual(targetSnapshot(fixture.root), before);
    });
  }
});

test("CP8B 10 retained roots and complete required semantic audit closure survive cleanup", async () => {
  const retained = await createShadowFixture("closure-retained");
  const semantic = publishAcceptedReviewFixture(retained, "closure-retained");
  abandon(retained);
  const cleanup = addTaskAndRun(retained.root, "task-closure-cleanup", "run-closure-cleanup");
  const orphan = standaloneArtifact("orphan-closure-cleanup");
  writeArtifactObject(retained.root, orphan);
  abandon(cleanup);
  const plan = createRetentionPlan(retained.root, { now: later, taskId: cleanup.task.artifact_id });
  const runtime = readRuntimeSnapshot(retained.root, retained.run.artifact_id, retained.terminal.payload.attempt_id);
  const closureHashes = [...new Set([
    ...semantic.closure.map((artifact) => artifact.content_sha256),
    runtime.snapshot.runtime_attestation_sha256,
    runtime.snapshot.runtime_dispatch_request_sha256,
    ...runtime.events.map((event) => event.content_sha256),
    ...runtime.result.evidence.map((evidence) => evidence.content_sha256),
  ])].sort();
  for (const hash of closureHashes) {
    const item = plan.items.find((candidate) => candidate.artifact_sha256 === hash);
    assert.equal(item?.classification, "retain", `retained semantic/runtime closure ${hash}`);
    assert.equal(item?.reason, "globally_reachable", `retained semantic/runtime closure ${hash}`);
  }
  assert.equal(
    plan.items.find((item) => item.artifact_sha256 === orphan.content_sha256)?.classification,
    "purge_eligible",
  );
  const apply = applyRetentionPlan(retained.root, {
    authorityReference: issueApplyAuthority(retained.root, plan, ["local_quarantine"]),
    now: later,
    planSha256: plan.plan_sha256,
  });
  const purge = purgeRetentionPlan(retained.root, {
    applySha256: apply.apply_sha256,
    authorityReference: issuePurgeAuthority(retained.root, plan, apply),
    now: later,
  });

  assert.equal(purge.status, "complete");
  const remaining = new Set(listStoredArtifacts(retained.root).map((artifact) => artifact.content_sha256));
  assert.ok(closureHashes.every((hash) => remaining.has(hash)));
  assert.equal(remaining.has(orphan.content_sha256), false);
  assert.equal(readTaskLifecycle(retained.root, retained.task.artifact_id).state, "abandoned");
  assert.equal(existsSync(join(retained.root, "runs", retained.run.artifact_id, "review", "summary.json")), true);
});

test("CP8B 11 shared object reachable from another retained graph cannot be purged", () => {
  const root = initializeRunStore(temporaryDirectory("shared"));
  const source = addTaskAndRun(root, "task-shared-source", "run-shared-source");
  const retained = addTaskAndRun(root, "task-shared-retained", "run-shared-retained");
  abandon(source);

  const plan = createRetentionPlan(root, { now: later, taskId: source.task.artifact_id });
  const retainedRunItem = plan.items.find((item) => item.artifact_sha256 === retained.run.content_sha256);

  assert.equal(retainedRunItem.classification, "retain");
  assert.equal(retainedRunItem.reason, "globally_reachable");
  assert.ok(plan.shared_reachability.reachable_sha256.includes(retained.run.content_sha256));
});

test("CP8B 12 deterministic orphan becomes purge eligible only through complete reviewed plan", () => {
  const fixture = createStoreFixture({ orphan: true, suffix: "orphan" });
  abandon(fixture);
  const orphanHash = fixture.orphan.content_sha256;
  const plan = createRetentionPlan(fixture.root, { now: later, taskId: fixture.task.artifact_id });
  const item = plan.items.find((entry) => entry.artifact_sha256 === orphanHash);

  assert.equal(item.classification, "purge_eligible");
  assert.equal(item.reason, "globally_unreferenced");
  const apply = applyRetentionPlan(fixture.root, {
    authorityReference: issueApplyAuthority(fixture.root, plan, ["local_quarantine"]),
    now: later,
    planSha256: plan.plan_sha256,
  });
  assert.equal(apply.status, "complete");
  assert.equal(listStoredArtifacts(fixture.root).some((artifact) => artifact.content_sha256 === orphanHash), false);
  assert.equal(existsSync(quarantineFile(fixture.root, plan, item)), true);
});

test("CP8B 13 apply and purge cannot exceed plan membership and purge needs separate authority", () => {
  const fixture = createStoreFixture({ orphan: true, suffix: "membership" });
  abandon(fixture);
  rebuildRuntimeIndex(fixture.root, fixture.run.artifact_id);
  const plan = createRetentionPlan(fixture.root, { now: later, taskId: fixture.task.artifact_id });
  const apply = applyRetentionPlan(fixture.root, {
    authorityReference: issueApplyAuthority(fixture.root, plan, ["local_quarantine"]),
    now: later,
    planSha256: plan.plan_sha256,
  });
  const purgeItems = plan.items.filter((item) => item.classification === "purge_eligible");
  const quarantineItem = plan.items.find((item) => item.classification === "quarantine");
  const before = targetSnapshot(fixture.root);

  assert.throws(
    () => purgeRetentionPlan(fixture.root, {
      applySha256: apply.apply_sha256,
      authorityReference: issuePurgeAuthority(fixture.root, plan, apply, {
        authority_id: "authority-invalid-membership",
        nonce: "invalid-membership",
        purge_item_ids: [...purgeItems.map((item) => item.item_id), ...(quarantineItem ? [quarantineItem.item_id] : [])].sort(),
      }),
      now: later,
    }),
    hasCode("CLEANUP_PURGE_AUTHORITY_INVALID"),
  );
  assert.deepEqual(targetSnapshot(fixture.root), before);
  const purge = purgeRetentionPlan(fixture.root, {
    applySha256: apply.apply_sha256,
    authorityReference: issuePurgeAuthority(fixture.root, plan, apply),
    now: later,
  });
  assert.equal(purge.status, "complete");
  if (quarantineItem) assert.equal(existsSync(quarantineFile(fixture.root, plan, quarantineItem)), true);
});

test("CP8B 14 independently valid wrong task run attempt thread donor cannot authorize shadow action", async () => {
  const source = await createShadowFixture("shadow-source");
  const donor = await createShadowFixture("shadow-donor");
  abandon(source);
  abandon(donor);
  const sourcePlan = createRetentionPlan(source.root, { now: later, taskId: source.task.artifact_id });
  const donorPlan = createRetentionPlan(donor.root, { now: later, taskId: donor.task.artifact_id });
  const sourceItem = sourcePlan.items.find((item) => item.kind === "shadow");
  const donorItem = donorPlan.items.find((item) => item.kind === "shadow");
  assert.equal(sourceItem.classification, "purge_eligible");
  assert.equal(donorItem.classification, "purge_eligible");
  const adapter = mockShadowAdapter({
    inspectIdentity: donorItem.shadow,
    result: "acknowledged",
  });
  const before = targetSnapshot(source.root);

  assert.throws(
    () => applyRetentionPlan(source.root, {
      authorityReference: issueApplyAuthority(source.root, sourcePlan, ["local_quarantine", "shadow_archive"]),
      now: later,
      planSha256: sourcePlan.plan_sha256,
      shadowAdapter: adapter,
    }),
    hasCode("SHADOW_OWNERSHIP_INVALID"),
  );
  assert.equal(adapter.applyCalls, 0);
  assert.deepEqual(targetSnapshot(source.root).objects, before.objects);

  const sourceAdapter = mockShadowAdapter({ inspectIdentity: sourceItem.shadow, result: "acknowledged" });
  const apply = applyRetentionPlan(source.root, {
    authorityReference: issueApplyAuthority(
      source.root,
      sourcePlan,
      ["local_quarantine", "shadow_archive"],
      "source-shadow-apply",
    ),
    now: later,
    planSha256: sourcePlan.plan_sha256,
    shadowAdapter: sourceAdapter,
  });
  assert.equal(apply.status, "complete");
  const purge = purgeRetentionPlan(source.root, {
    applySha256: apply.apply_sha256,
    authorityReference: issuePurgeAuthority(source.root, sourcePlan, apply, {
      allowed_actions: ["local_delete", "shadow_delete"],
      authority_id: "authority-source-shadow-purge",
      nonce: "source-shadow-purge",
    }),
    now: later,
    shadowAdapter: sourceAdapter,
  });
  assert.equal(purge.status, "complete");
  assert.equal(sourceAdapter.applyCalls, 2);
  assert.equal(existsSync(join(source.root, "tasks", source.task.artifact_id, "cleanup", "tombstones", `${sourceItem.item_id}.json`)), true);
});

test("CP8B 15 TTL and unknown state cannot close release delete or establish certainty", () => {
  const fixture = createUnknownShadowFixture("ttl-unknown");
  abandon(fixture);
  placeHold(fixture, "expected_correction");
  const lifecycleBefore = readTaskLifecycle(fixture.root, fixture.task.artifact_id);
  const holdsBefore = readCleanupHolds(fixture.root, fixture.task.artifact_id);

  const plan = createRetentionPlan(fixture.root, {
    now: "2027-08-24T00:00:00.000Z",
    taskId: fixture.task.artifact_id,
    ttlMs: 1,
  });
  const shadow = plan.items.find((item) => item.kind === "shadow");
  assert.equal(plan.ttl_hint.review_recommended, true);
  assert.equal(shadow.classification, "retain");
  assert.equal(shadow.reason, "cleanup_hold_active");
  assert.equal(readTaskLifecycle(fixture.root, fixture.task.artifact_id).state, lifecycleBefore.state);
  assert.deepEqual(readCleanupHolds(fixture.root, fixture.task.artifact_id).active, holdsBefore.active);
  assert.equal(readAttemptPhases(fixture.root, fixture.run.artifact_id, fixture.attempt.payload.attempt_id).terminal, undefined);
});

test("CP8B 16 ambiguous shadow action stays explicit and rejects a different retry identity", async () => {
  const fixture = await createShadowFixture("ambiguous");
  abandon(fixture);
  const plan = createRetentionPlan(fixture.root, { now: later, taskId: fixture.task.artifact_id });
  const shadow = plan.items.find((item) => item.kind === "shadow");
  const adapter = mockShadowAdapter({ inspectIdentity: shadow.shadow, result: "ambiguous" });
  const firstAuthority = issueApplyAuthority(fixture.root, plan, ["local_quarantine", "shadow_archive"]);
  const apply = applyRetentionPlan(fixture.root, {
    authorityReference: firstAuthority,
    now: later,
    planSha256: plan.plan_sha256,
    shadowAdapter: adapter,
  });
  assert.equal(apply.status, "ambiguous");
  assert.equal(adapter.applyCalls, 1);

  assert.throws(
    () => applyRetentionPlan(fixture.root, {
      authorityReference: issueApplyAuthority(
        fixture.root,
        plan,
        ["local_quarantine", "shadow_archive"],
        "different-retry",
      ),
      now: later,
      planSha256: plan.plan_sha256,
      shadowAdapter: adapter,
    }),
    hasCode("CLEANUP_APPLY_UNRESOLVED"),
  );
  assert.equal(adapter.applyCalls, 1);
  assert.equal(existsSync(join(fixture.root, "tasks", fixture.task.artifact_id, "cleanup", "tombstones")), false);
  adapter.resultStatus = "acknowledged";
  const reconciled = applyRetentionPlan(fixture.root, {
    authorityReference: firstAuthority,
    now: later,
    planSha256: plan.plan_sha256,
    shadowAdapter: adapter,
  });
  assert.equal(reconciled.status, "complete");
  assert.equal(adapter.applyCalls, 1);
  assert.equal(adapter.reconcileCalls, 1);
});

test("CP8B 17 stale review and runtime views rebuild without changing canonical semantic authority", async () => {
  const fixture = await createShadowFixture("representations");
  const semantic = publishAcceptedReviewFixture(fixture, "representations");
  const summaryBefore = canonicalJson(semantic.summary);
  const decisionBefore = canonicalJson(semantic.decision);
  const currentRun = loadRunManifest(fixture.root, fixture.run.artifact_id);
  assert.equal(currentRun.payload.state, "review_pending");
  assert.notEqual(currentRun.content_sha256, fixture.run.content_sha256);
  writeFileSync(join(fixture.root, "runs", fixture.run.artifact_id, "review", "summary.md"), "stale\n", "utf8");

  assert.throws(
    () => validateReviewViews(fixture.root, fixture.run.artifact_id, semantic.summary),
    hasCode("REVIEW_REPRESENTATION_STALE"),
  );
  rebuildReviewViews(fixture.root, fixture.run.artifact_id, semantic.summary);
  validateReviewRepresentations(fixture.root, fixture.run.artifact_id, semantic.summary);
  assert.equal(canonicalJson(semantic.summary), summaryBefore);
  assert.equal(canonicalJson(semantic.decision), decisionBefore);
});

test("CP8B 18 v1 inventory reference is read-only and cannot satisfy any v2 relationship", async () => {
  const fixture = await createShadowFixture("legacy-boundary");
  const semantic = publishAcceptedReviewFixture(fixture, "legacy-boundary");
  const legacy = reseal({ ...semantic.report, schema_version: 1 });
  const legacyRoot = temporaryDirectory("legacy");
  const legacyPath = join(legacyRoot, "report.json");
  writeFileSync(legacyPath, canonicalJson(legacy), "utf8");
  const bytesBefore = readFileSync(legacyPath);
  const inventory = inventoryLegacyV1(legacyRoot);
  assert.equal(inventory.entries[0].status, "readable");
  assert.equal(inventory.entries[0].artifact_type, "generated_report");
  assert.deepEqual(readFileSync(legacyPath), bytesBefore);
  assert.deepEqual(routeArtifactVersion(legacy), { schemaVersion: 1, owner: "eval-foundation-v1" });
  const cliInventory = runCli(legacyRoot, ["legacy", "inventory", "--root", legacyRoot]);
  assert.equal(cliInventory.status, 0, cliInventory.stderr);
  assert.equal(JSON.parse(cliInventory.stdout).inventory_version, "legacy-v1-inventory-v1");

  const beforeObjects = listStoredArtifacts(fixture.root).map((artifact) => artifact.content_sha256);
  const runtimeResultPath = join(
    fixture.root,
    "runs",
    fixture.run.artifact_id,
    "runtime",
    "attempts",
    fixture.terminal.payload.attempt_id,
    "result.json",
  );
  const runtimeResultBefore = readFileSync(runtimeResultPath);
  const boundaries = [
    ["readiness", "ARTIFACT_VERSION_UNSUPPORTED", () => compileInvocation({
      artifactId: "legacy-readiness-substitution",
      messages: [{ content: "Legacy must not compile.", role: "user" }],
      protocol: { observation_instructions: "Return one object.", output_schema: "observation-v2" },
      requestedPolicy: executionPolicy(),
      resources: [],
      role: "reader",
      run: legacy,
      runtime: runtimeConfig(),
      tools: [],
      unitId: "unit-one",
    })],
    ["reuse", "ARTIFACT_VERSION_UNSUPPORTED", () => deriveReaderInputIdentity({
      attestation: {},
      bundle: {},
      compiled_invocation: legacy,
      context: {},
      fresh_context_method: "new-thread",
      prompt: "Legacy must not satisfy reuse.",
      protocol_version: "reader-v2",
      provenance: {},
    })],
    ["runtime evidence", "ARTIFACT_VERSION_UNSUPPORTED", () => recordRuntimeResultView(fixture.root, {
      attemptId: fixture.terminal.payload.attempt_id,
      evidence: [legacy],
      leaseToken: fixture.lease.token,
      now: timestamp,
      runId: fixture.run.artifact_id,
      status: "success",
    })],
    ["evaluation", "ARTIFACT_VERSION_UNSUPPORTED", () => deriveEvaluatorVisibleEvidence({ observation: legacy })],
    ["acceptance", "IDENTITY_INPUT_INVALID", () => deriveAcceptanceInputIdentity({
      accepted_scope: [],
      evidence_bindings: [],
      proposals: [legacy],
      review_policy: { version: "review-policy-v2" },
      summary: legacy,
    })],
    ["report", "ARTIFACT_VERSION_UNSUPPORTED", () => createAcceptedReport({
      artifactId: "legacy-report-substitution",
      decision: legacy,
      evaluations: semantic.evaluations,
      run: fixture.run,
      summary: semantic.summary,
      supportingArtifacts: semantic.closure.filter(
        (artifact) => !["generated_report", "human_evaluation", "human_review_decision", "run_review_summary"].includes(artifact.artifact_type),
      ),
    })],
  ];
  for (const [boundary, expectedCode, invoke] of boundaries) {
    assert.throws(invoke, hasCode(expectedCode), boundary);
    assert.deepEqual(
      listStoredArtifacts(fixture.root).map((artifact) => artifact.content_sha256),
      beforeObjects,
      `${boundary} produced an unauthorized semantic descendant`,
    );
  }
  assert.deepEqual(readFileSync(runtimeResultPath), runtimeResultBefore);
  assert.deepEqual(readFileSync(legacyPath), bytesBefore);
});

function createStoreFixture({ orphan = false, pullRequest = null, suffix }) {
  const root = initializeRunStore(temporaryDirectory(suffix));
  const fixture = addTaskAndRun(root, `task-${suffix}`, `run-${suffix}`, pullRequest);
  const orphanArtifact = orphan ? standaloneArtifact(`orphan-${suffix}`) : null;
  if (orphanArtifact) writeArtifactObject(root, orphanArtifact);
  return { ...fixture, orphan: orphanArtifact, root };
}

function createCliFixture(suffix) {
  const repository = temporaryDirectory(suffix);
  const initialized = spawnSync("git", ["init", "--quiet"], { cwd: repository, encoding: "utf8", windowsHide: true });
  assert.equal(initialized.status, 0, initialized.stderr);
  const root = initializeRunStore(join(repository, ".git", "vocaspace-agent-skill-evals", "v2"));
  const fixture = addTaskAndRun(root, `task-${suffix}`, `run-${suffix}`);
  writeArtifactObject(root, standaloneArtifact(`orphan-${suffix}`));
  abandon(fixture);
  return { ...fixture, repository, root };
}

function runCli(cwd, args) {
  return spawnSync(process.execPath, [cliPath, ...args], { cwd, encoding: "utf8", windowsHide: true });
}

function addTaskAndRun(root, taskId, runId, pullRequest = null) {
  const task = createHarnessArtifact({
    artifactId: taskId,
    artifactType: "task_manifest",
    payload: {
      created_at: timestamp,
      lifecycle: "active",
      provenance: {
        branch: "refactor/agent-skill-eval-harness",
        commit: "8".repeat(64),
        pull_request: pullRequest,
      },
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
      adapter_id: "fixture-adapter",
      created_at: timestamp,
      revision: 0,
      run_id: runId,
      runtime_config_sha256: hashA,
      selected_units: [
        { case_id: "case-one", role: "evaluator", suite: "regression", unit_id: "evaluator-one", variant: "candidate" },
        { case_id: "case-one", role: "reader", suite: "regression", unit_id: "reader-one", variant: "candidate" },
      ],
      state: "created",
      task_id: taskId,
    },
    producer: producer("harness"),
  });
  createRunRecord(root, task, run, { now: timestamp });
  return { root, run, task };
}

function standaloneArtifact(artifactId) {
  return createHarnessArtifact({
    artifactId,
    artifactType: "task_manifest",
    payload: {
      created_at: timestamp,
      lifecycle: "active",
      provenance: { branch: null, commit: null, pull_request: null },
      retention_policy_version: "retention-v2",
      task_id: artifactId,
    },
    producer: producer("operator"),
  });
}

function closeByMerge(fixture, { pullRequest }) {
  return appendTaskLifecycleEvent(fixture.root, {
    authority: taskAuthority(fixture.task.artifact_id, "close_task", "task_aware_workflow", `merge-${fixture.task.artifact_id}`),
    authorityVerifier: () => true,
    basis: "task_bound_pr_merge",
    basisIdentity: {
      event_id: `merge-event-${fixture.task.artifact_id}`,
      merge_commit: "b".repeat(40),
      merge_result: "successful",
      merged_at: timestamp,
      merged_head_commit: "c".repeat(40),
      pull_request: pullRequest,
      repository: "owner/repo",
    },
    expectedPriorEventSha256: null,
    expectedSequence: 1,
    now: timestamp,
    taskId: fixture.task.artifact_id,
  });
}

function abandon(fixture) {
  return appendTaskLifecycleEvent(fixture.root, {
    authority: taskAuthority(fixture.task.artifact_id, "abandon_task", "owner", `abandon-${fixture.task.artifact_id}`),
    authorityVerifier: () => true,
    basis: "owner_abandoned",
    basisIdentity: { decision_id: `abandon-${fixture.task.artifact_id}`, reason: "Owner explicitly abandoned this fixture task." },
    expectedPriorEventSha256: null,
    expectedSequence: 1,
    now: timestamp,
    taskId: fixture.task.artifact_id,
  });
}

function reconciledBasis(decisionId) {
  return {
    decision_id: decisionId,
    merge_commit: "d".repeat(40),
    merged_head_commit: "e".repeat(40),
    pull_request: "owner/repo#90",
    reason: "Owner reconciled an externally merged task.",
    repository: "owner/repo",
  };
}

function taskAuthority(taskId, action, kind, authorityId) {
  return {
    action,
    authority_id: authorityId,
    issued_at: timestamp,
    issuer: "repository-owner",
    kind,
    task_id: taskId,
  };
}

function placeHold(fixture, category) {
  const current = readCleanupHolds(fixture.root, fixture.task.artifact_id);
  return appendCleanupHoldEvent(fixture.root, {
    action: "place",
    authority: taskAuthority(fixture.task.artifact_id, "place_hold", "owner", `hold-${category}-${fixture.task.artifact_id}`),
    authorityVerifier: () => true,
    category,
    expectedPriorEventSha256: current.tail_sha256,
    expectedSequence: current.events.length + 1,
    holdId: `${category.replaceAll("_", "-")}-${fixture.task.artifact_id}`,
    now: timestamp,
    reason: `The ${category} work remains explicit and open.`,
    taskId: fixture.task.artifact_id,
  });
}

function applyAuthority(plan, allowedActions, nonce = "apply-once") {
  return {
    allowed_actions: allowedActions,
    authority_id: `authority-${nonce}`,
    expires_at: "2026-08-25T00:00:00.000Z",
    issued_at: timestamp,
    issuer: "repository-owner",
    nonce,
    plan_sha256: plan.plan_sha256,
    task_id: plan.task_id,
  };
}

function purgeAuthority(plan, apply) {
  return {
    allowed_actions: ["local_delete"],
    apply_sha256: apply.apply_sha256,
    authority_id: "authority-purge-once",
    expires_at: "2026-08-25T00:00:00.000Z",
    issued_at: timestamp,
    issuer: "repository-owner",
    nonce: "purge-once",
    plan_sha256: plan.plan_sha256,
    purge_item_ids: plan.items.filter((item) => item.classification === "purge_eligible").map((item) => item.item_id).sort(),
    task_id: plan.task_id,
  };
}

function cleanupIssuanceAuthority(authority, kind, suffix = authority.authority_id) {
  return {
    action: `issue_cleanup_${kind}_authority`,
    authority_id: `issuance-${suffix}`,
    issued_at: authority.issued_at,
    issuer: "repository-owner",
    kind: "owner",
    subject_sha256: sha256Canonical(authority),
    task_id: authority.task_id,
  };
}

function issueAuthority(root, kind, authority, { now = later, verified = true } = {}) {
  return issueCleanupAuthority(root, {
    authority,
    authorityVerifier: () => verified,
    issuanceAuthority: cleanupIssuanceAuthority(authority, kind),
    kind,
    now,
  });
}

function issueApplyAuthority(root, plan, allowedActions, nonce = "apply-once") {
  return issueAuthority(root, "apply", applyAuthority(plan, allowedActions, nonce));
}

function issuePurgeAuthority(root, plan, apply, overrides = {}) {
  const authority = { ...purgeAuthority(plan, apply), ...overrides };
  return issueAuthority(root, "purge", authority);
}

function mutateRunRevision(fixture) {
  const lease = acquireRunLease(fixture.root, fixture.run.artifact_id, {
    durationMs: 60_000,
    host: "cp8b-fixture",
    now: timestamp,
    owner: "cp8b-test",
    pid: 808,
    token: `lease-${fixture.run.artifact_id}`,
  });
  transitionRun(fixture.root, {
    expectedRevision: 0,
    leaseToken: lease.token,
    nextState: "preflight",
    now: timestamp,
    runId: fixture.run.artifact_id,
  });
}

function targetSnapshot(root) {
  return {
    objects: listStoredArtifacts(root).map((artifact) => artifact.content_sha256).sort(),
    quarantine: listFiles(join(root, "quarantine")),
  };
}

function listFiles(directory, base = directory) {
  if (!existsSync(directory)) return [];
  const output = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...listFiles(path, base));
    else output.push(path.slice(base.length + 1).replaceAll("\\", "/"));
  }
  return output.sort();
}

function quarantineFile(root, plan, item) {
  return join(root, "quarantine", plan.task_id, plan.plan_sha256, item.item_id, item.relative_path.split("/").at(-1));
}

function objectPath(root, hash) {
  return join(root, "objects", hash.slice(0, 2), hash, "artifact.json");
}

async function createShadowFixture(suffix) {
  const root = initializeRunStore(temporaryDirectory(suffix));
  const taskId = `task-${suffix}`;
  const runId = `run-${suffix}`;
  const runtime = runtimeConfig();
  const policy = executionPolicy();
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
          authorized_roles: ["reader"],
          basis: "owner_explicit",
          live_call_limits: { evaluator: 0, reader: 0, total: 0, verification_helper: 0 },
          live_model_calls: false,
          recorded_at: timestamp,
          scope: "Deterministic CP8B mocked shadow fixture only.",
        },
        purpose: "Certify exact CP8B shadow cleanup ownership.",
        selection_reason: "This fixture produces one exact acknowledged mock thread.",
      },
      revision: 0,
      run_id: runId,
      runtime_config_sha256: sha256Canonical(runtime),
      selected_units: [
        { case_id: "case-one", role: "evaluator", suite: "regression", unit_id: "evaluator-one", variant: "candidate" },
        { case_id: "case-one", role: "reader", suite: "regression", unit_id: "unit-one", variant: "candidate" },
      ],
      state: "created",
      task_id: taskId,
    },
    producer: producer("harness"),
  });
  const invocation = compileInvocation({
    artifactId: `reader-invocation-${suffix}`,
    messages: [
      { content: "Follow the frozen deterministic fixture contract.", role: "developer" },
      { content: "Return one deterministic object.", role: "user" },
    ],
    protocol: { observation_instructions: "Return exact structured output.", output_schema: "observation-v2" },
    requestedPolicy: policy,
    resources: [],
    role: "reader",
    run,
    runtime,
    tools: [],
    unitId: "unit-one",
  });
  const readiness = createHarnessArtifact({
    artifactId: `reader-readiness-${suffix}`,
    artifactType: "readiness_analysis",
    links: [link("compiled_invocation", invocation), link("run", run)].sort(compareLinks),
    payload: {
      correction: null,
      field_results: [],
      grants: [{ invocation_sha256: invocation.content_sha256, nonce: `grant-${suffix}`, single_use: true, unit_id: "unit-one" }],
      helper_attempt_ids: [],
      invocation_hashes: [invocation.content_sha256],
      round: 1,
      run_id: runId,
      stage: "reader",
      status: "passed",
    },
    producer: producer("readiness"),
  });
  const attemptId = `reader-attempt-${suffix}`;
  const prepared = createHarnessArtifact({
    artifactId: `${attemptId}-prepared`,
    artifactType: "execution_attempt",
    links: [link("compiled_invocation", invocation), link("readiness", readiness), link("run", run)].sort(compareLinks),
    payload: {
      attempt_id: attemptId,
      call_certainty: "not_started",
      finished_at: null,
      input_sha256: invocation.content_sha256,
      outcome: null,
      phase: "prepared",
      role: "reader",
      run_id: runId,
      sequence: 1,
      started_at: timestamp,
      unit_id: "unit-one",
    },
    producer: producer("orchestrator"),
  });
  createRunRecord(root, task, run, { now: timestamp });
  writeArtifactObject(root, invocation);
  writeArtifactObject(root, readiness);
  const lease = acquireRunLease(root, runId, {
    durationMs: 86_400_000,
    host: "cp8b-fixture",
    now: timestamp,
    owner: "cp8b-test",
    pid: 808,
    token: `lease-${suffix}`,
  });
  appendAttemptPhase(root, prepared, { leaseToken: lease.token, now: timestamp });
  let dispatched;
  const adapter = createCodexChatGptAppServerAdapter({
    now: () => timestamp,
    outputSchemas: {
      "evaluator-proposal-v2": { additionalProperties: true, type: "object" },
      "observation-v2": { additionalProperties: true, type: "object" },
      "verification-helper-v2": { additionalProperties: true, type: "object" },
    },
    transport: mockAppServerTransport({ policy, runtime, suffix }),
  });
  await adapter.invokeReader(
    { grant_nonce: readiness.payload.grants[0].nonce, invocation_sha256: invocation.content_sha256, unit_id: "unit-one" },
    {
      runtime: {
        attempt: prepared,
        graphArtifacts: [task, run, invocation, readiness, prepared],
        invocation,
        leaseToken: lease.token,
        markDispatched: () => {
          if (dispatched) return dispatched;
          dispatched = recreate(prepared, {
            artifactId: `${attemptId}-dispatched`,
            payload: { ...prepared.payload, call_certainty: "unknown", phase: "dispatched" },
          });
          appendAttemptPhase(root, dispatched, { leaseToken: lease.token, now: timestamp });
          return dispatched;
        },
        readiness,
        run,
        storeRoot: root,
      },
    },
  );
  const terminal = recreate(prepared, {
    artifactId: `${attemptId}-terminal`,
    payload: {
      ...prepared.payload,
      call_certainty: "confirmed_finished",
      finished_at: timestamp,
      outcome: "success",
      phase: "terminal",
    },
  });
  appendAttemptPhase(root, terminal, { leaseToken: lease.token, now: timestamp });
  rebuildRuntimeIndex(root, runId);
  return { attempt: prepared, invocation, lease, readiness, root, run, task, terminal };
}

function publishAcceptedReviewFixture(fixture, suffix) {
  const runtime = runtimeConfig();
  const policy = executionPolicy();
  const evaluatorInvocation = compileInvocation({
    artifactId: `evaluator-invocation-${suffix}`,
    messages: [
      { content: "Apply the deterministic evaluator rubric.", role: "developer" },
      { content: "Evaluate unit-one.", role: "user" },
    ],
    protocol: { observation_instructions: "Return one proposal.", output_schema: "evaluator-proposal-v2" },
    requestedPolicy: policy,
    resources: [],
    role: "evaluator",
    run: fixture.run,
    runtime,
    tools: [],
    unitId: "evaluator-one",
  });
  const evaluatorReadiness = createHarnessArtifact({
    artifactId: `evaluator-readiness-${suffix}`,
    artifactType: "readiness_analysis",
    links: [link("compiled_invocation", evaluatorInvocation), link("run", fixture.run)].sort(compareLinks),
    payload: {
      correction: null,
      field_results: [],
      grants: [],
      helper_attempt_ids: [],
      invocation_hashes: [evaluatorInvocation.content_sha256],
      round: 1,
      run_id: fixture.run.artifact_id,
      stage: "evaluator_static",
      status: "passed",
    },
    producer: producer("readiness"),
  });
  const evaluatorAttemptId = `evaluator-attempt-${suffix}`;
  const evaluatorAttempt = createHarnessArtifact({
    artifactId: `${evaluatorAttemptId}-terminal`,
    artifactType: "execution_attempt",
    links: [
      link("compiled_invocation", evaluatorInvocation),
      link("readiness", evaluatorReadiness),
      link("run", fixture.run),
    ].sort(compareLinks),
    payload: {
      attempt_id: evaluatorAttemptId,
      call_certainty: "confirmed_finished",
      finished_at: timestamp,
      input_sha256: evaluatorInvocation.content_sha256,
      outcome: "success",
      phase: "terminal",
      role: "evaluator",
      run_id: fixture.run.artifact_id,
      sequence: 1,
      started_at: timestamp,
      unit_id: "evaluator-one",
    },
    producer: producer("orchestrator"),
  });
  const observation = createHarnessArtifact({
    artifactId: `observation-${suffix}`,
    artifactType: "observation",
    links: [link("attempt", fixture.terminal), link("compiled_invocation", fixture.invocation)].sort(compareLinks),
    payload: {
      attempt_id: fixture.terminal.payload.attempt_id,
      execution_status: "completed",
      observed_access: {
        credentials: "not_observed",
        filesystem: "observed",
        mutation: "not_observed",
        network: "not_observed",
        remote_actions: "not_observed",
        tools: "observed",
      },
      raw_text: "Deterministic retained reader evidence.",
      run_id: fixture.run.artifact_id,
      unit_id: "unit-one",
    },
    producer: producer("adapter"),
  });
  const resource = createHarnessArtifact({
    artifactId: `resource-${suffix}`,
    artifactType: "resource_observation",
    links: [link("observation", observation)],
    payload: {
      basis: "unavailable",
      denied: null,
      limitations: "Exact resource access was unavailable.",
      observation_id: observation.artifact_id,
      read: null,
      supplied: null,
    },
    producer: producer("adapter"),
  });
  for (const artifact of [evaluatorInvocation, evaluatorReadiness, evaluatorAttempt, observation, resource]) {
    writeArtifactObject(fixture.root, artifact);
  }
  recordRuntimeResultView(fixture.root, {
    attemptId: fixture.terminal.payload.attempt_id,
    evidence: [observation, resource],
    leaseToken: fixture.lease.token,
    now: timestamp,
    runId: fixture.run.artifact_id,
    status: "success",
  });
  const proposal = createHarnessArtifact({
    artifactId: `proposal-${suffix}`,
    artifactType: "evaluator_proposal",
    links: [
      link("attempt", evaluatorAttempt),
      link("observation", observation),
      link("resource_observation", resource),
    ].sort(compareLinks),
    payload: {
      case_status: "passed",
      citations: [{ artifact_id: observation.artifact_id, label: "Retained reader evidence" }],
      comparison_status: null,
      rationale: "The deterministic retained evidence satisfies the case.",
      recommendation: "accept",
      uncertainty: "",
      unit_id: "unit-one",
    },
    producer: producer("evaluator"),
  });
  writeArtifactObject(fixture.root, proposal);
  for (const nextState of ["preflight", "readiness", "ready", "reading", "reader_complete", "evaluating"]) {
    const current = loadRunManifest(fixture.root, fixture.run.artifact_id);
    transitionRun(fixture.root, {
      expectedRevision: current.payload.revision,
      leaseToken: fixture.lease.token,
      nextState,
      now: timestamp,
      runId: fixture.run.artifact_id,
    });
  }
  const summary = buildRunReviewSummary({
    attempts: [fixture.terminal, evaluatorAttempt],
    proposedAction: "Accept unit-one.",
    proposals: [proposal],
    recommendation: "accept",
    run: fixture.run,
  });
  const representations = renderReviewRepresentations(summary);
  const supporting = [
    fixture.task,
    fixture.run,
    fixture.invocation,
    fixture.readiness,
    fixture.terminal,
    evaluatorInvocation,
    evaluatorReadiness,
    evaluatorAttempt,
    observation,
    resource,
  ];
  publishRunReview({
    leaseToken: fixture.lease.token,
    representations,
    storeRoot: fixture.root,
    summary,
    supportingArtifacts: [...supporting, proposal],
  });
  const decision = createHumanReviewDecision({
    acceptedUnitIds: ["unit-one"],
    action: "accept",
    artifactId: `decision-${suffix}`,
    decidedAt: timestamp,
    proposals: [proposal],
    rationale: "Owner accepted the exact retained semantic scope.",
    representations,
    reviewPolicy: { version: "review-policy-v2" },
    reviewer: { identity: "owner-reviewer", identity_type: "local_named_reviewer" },
    summary,
    supportingArtifacts: supporting,
  });
  const evaluations = materializeHumanEvaluations({
    decision,
    proposals: [proposal],
    summary,
    supportingArtifacts: supporting,
  });
  const report = createAcceptedReport({
    artifactId: `report-${suffix}`,
    decision,
    evaluations,
    run: fixture.run,
    summary,
    supportingArtifacts: [...supporting, proposal],
  });
  for (const artifact of [decision, ...evaluations, report]) writeArtifactObject(fixture.root, artifact);
  return {
    closure: [...supporting, proposal, summary, decision, ...evaluations, report],
    decision,
    evaluations,
    proposal,
    report,
    representations,
    summary,
  };
}

function createUnknownShadowFixture(suffix) {
  const fixture = createPreparedFixture(suffix);
  const requestJson = canonicalJsonLine({ id: `thread-request-${suffix}`, method: "thread/start", params: {} });
  const requestSha256 = sha256Bytes(Buffer.from(requestJson, "utf8"));
  recordRuntimeJournalEvent(fixture.root, {
    attempt: fixture.attempt,
    event: "thread_start_write_intent",
    leaseToken: fixture.lease.token,
    now: timestamp,
    requestId: `thread-request-${suffix}`,
    requestJson,
    requestSha256,
    status: "intent",
  });
  recordRuntimeJournalEvent(fixture.root, {
    attempt: fixture.attempt,
    event: "thread_start_outcome_unknown",
    leaseToken: fixture.lease.token,
    now: timestamp,
    requestId: `thread-request-${suffix}`,
    requestSha256,
    status: "unknown",
  });
  return fixture;
}

function createPreparedFixture(suffix) {
  const root = initializeRunStore(temporaryDirectory(suffix));
  const base = addTaskAndRun(root, `task-${suffix}`, `run-${suffix}`);
  const invocation = createHarnessArtifact({
    artifactId: `invocation-${suffix}`,
    artifactType: "compiled_invocation",
    links: [link("run", base.run)],
    payload: {
      messages: [{ content: "Deterministic fixture.", role: "developer" }],
      model_visible_policy: executionPolicy(),
      protocol: { observation_instructions: "Return fixture output.", output_schema: "observation-v2" },
      requested_policy: executionPolicy(),
      resources: [],
      role: "reader",
      run_id: base.run.artifact_id,
      runtime: runtimeConfig(),
      tools: [],
      unit_id: "reader-one",
    },
    producer: producer("readiness_compiler"),
  });
  const attempt = createHarnessArtifact({
    artifactId: `attempt-${suffix}-prepared`,
    artifactType: "execution_attempt",
    links: [link("compiled_invocation", invocation), link("run", base.run)].sort(compareLinks),
    payload: {
      attempt_id: `attempt-${suffix}`,
      call_certainty: "not_started",
      finished_at: null,
      input_sha256: invocation.content_sha256,
      outcome: null,
      phase: "prepared",
      role: "reader",
      run_id: base.run.artifact_id,
      sequence: 1,
      started_at: timestamp,
      unit_id: "reader-one",
    },
    producer: producer("orchestrator"),
  });
  writeArtifactObject(root, invocation);
  const lease = acquireRunLease(root, base.run.artifact_id, {
    durationMs: 86_400_000,
    host: "cp8b-fixture",
    now: timestamp,
    owner: "cp8b-test",
    pid: 808,
    token: `lease-${suffix}`,
  });
  appendAttemptPhase(root, attempt, { leaseToken: lease.token, now: timestamp });
  return { ...base, attempt, invocation, lease, root };
}

function mockAppServerTransport({ policy, runtime, suffix }) {
  const threadId = `thread-${suffix}`;
  return {
    kind: "mock_codex_app_server",
    async abortAttempt() {
      return { confirmed_not_started: true };
    },
    async inspectRuntime() {
      return {
        authMode: "chatgpt",
        codexVersion: "0.1.0-test",
        configSha256: "c".repeat(64),
        effectivePolicy: policy,
        effort: runtime.parameters.effort,
        executablePath: "C:/tools/codex.exe",
        executableSha256: "e".repeat(64),
        instructionSources: [{ path: "C:/VocaSpace/AGENTS.md", sha256: "a".repeat(64) }],
        model: runtime.model,
        platform: "win32-x64",
        protocolSchemaSha256: "f".repeat(64),
        runtimeIdentity: "codex-app-server-test",
      };
    },
    async startThread({ requestBytes }) {
      const request = JSON.parse(requestBytes.toString("utf8"));
      return {
        instruction_sources: [{ path: "C:/VocaSpace/AGENTS.md", sha256: "a".repeat(64) }],
        request_id: request.id,
        session_id: `session-${suffix}`,
        thread_id: threadId,
      };
    },
    async interruptTurn() {
      return { accepted: true, terminal_status: "accepted" };
    },
    async startTurn({ onEvent, requestBytes }) {
      const request = JSON.parse(requestBytes.toString("utf8"));
      const turnId = `turn-${suffix}`;
      const write = jsonlBytes({ bytes_written: true, requestId: request.id, threadId, turnId });
      const ack = jsonlBytes({ requestId: request.id, threadId, turnId });
      const complete = jsonlBytes({ requestId: request.id, status: "completed", threadId, turnId });
      onEvent({ event_bytes: write, event_type: "turn_start_write_completed", status: "written", turn_id: turnId });
      onEvent({ event_bytes: ack, event_type: "turn_start_acknowledged", status: "acknowledged", turn_id: turnId });
      return {
        ack_event_bytes: ack,
        completed_event_bytes: complete,
        output: { value: "deterministic" },
        request_id: request.id,
        terminal_status: "completed",
        thread_id: threadId,
        turn_id: turnId,
        wire_request_sha256: sha256Bytes(requestBytes),
        write_event_bytes: write,
      };
    },
  };
}

function runtimeConfig() {
  const policy = executionPolicy();
  return {
    behavior_runtime: {
      adapter_id: "codex_chatgpt_app_server",
      adapter_version: "2",
      assurance_profile: "runtime_mediated",
      auth_mode: "chatgpt",
      capability_limitations: [
        "complete-model-visible-envelope-opaque",
        "provider-request-identity-opaque",
        "provider-side-idempotency-opaque",
        "turn-outcome-lookup-unsupported",
        "upstream-provider-envelope-opaque",
      ],
      codex_version: "0.1.0-test",
      config_sha256: "c".repeat(64),
      effective_policy: policy,
      effort: "medium",
      executable_path: "C:/tools/codex.exe",
      executable_sha256: "e".repeat(64),
      fresh_context_method: "new-app-server-thread",
      instruction_sources: [{ path: "C:/VocaSpace/AGENTS.md", sha256: "a".repeat(64) }],
      model: "gpt-5.4",
      platform: "win32-x64",
      protocol_schema_sha256: "f".repeat(64),
      runtime_identity: "codex-app-server-test",
      transport: "stdio-jsonl",
    },
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
}

function executionPolicy() {
  return {
    credentials: "excluded",
    filesystem: "read_only",
    fresh_context: true,
    mutation: "denied",
    network: "denied",
    remote_actions: "denied",
    supplied_resources: [],
    tools: [],
  };
}

function mockShadowAdapter({ inspectIdentity, result }) {
  return {
    applyCalls: 0,
    kind: "deterministic_mock_shadow_cleanup",
    reconcileCalls: 0,
    resultStatus: result,
    apply() {
      this.applyCalls += 1;
      return { operation_id: `shadow-operation-${this.applyCalls}`, status: this.resultStatus };
    },
    inspect() {
      return { ...inspectIdentity, status: "present" };
    },
    reconcile() {
      this.reconcileCalls += 1;
      return { operation_id: `shadow-reconciliation-${this.reconcileCalls}`, status: this.resultStatus };
    },
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

function reseal(value) {
  const envelope = structuredClone(value);
  delete envelope.content_sha256;
  return { ...envelope, content_sha256: sha256Canonical(envelope) };
}

function temporaryDirectory(label) {
  const root = mkdtempSync(join(tmpdir(), `skill-eval-cp8b-${label}-`));
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

function jsonlBytes(value) {
  return Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
}

function hasCode(code) {
  return (error) => error instanceof HarnessError && error.code === code;
}
