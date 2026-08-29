import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { canonicalJson, parseStrictJson, sha256Bytes, sha256Canonical } from "./artifact-schema-v1.mjs";
import { HarnessError, assertHarnessArtifact, validateArtifactGraph } from "./harness-schema-v2.mjs";
import {
  listStoredArtifacts,
  loadRunManifest,
  loadTaskManifest,
  readArtifactObject,
  readAttemptPhases,
  readJournal,
  readRuntimeSnapshot,
  rebuildRuntimeIndex,
  validateRuntimeIndex,
} from "./run-store-v2.mjs";
import {
  assertSummaryRunBinding,
  rebuildReviewRepresentations,
  validateReviewRepresentations,
} from "./review-v2.mjs";

const lifecycleBases = Object.freeze(["owner_abandoned", "owner_reconciled_close", "task_bound_pr_merge"]);
const holdCategories = Object.freeze(["expected_correction", "open_pr", "open_review"]);
const applyActions = Object.freeze(["local_quarantine", "shadow_archive", "shadow_quarantine"]);
const purgeActions = Object.freeze(["local_delete", "shadow_delete"]);
const derivedViewNames = new Set([
  "review/summary.html",
  "review/summary.md",
  "runtime/index.json",
  "runtime/index.md",
]);

export function readTaskLifecycle(root, taskId) {
  const task = loadTaskManifest(root, taskId);
  if (task.payload.lifecycle !== "active") {
    fail("TASK_CREATION_INVALID", "Task creation manifests must remain immutable and active.", 3);
  }
  const path = taskFile(root, taskId, "lifecycle.jsonl");
  const events = readJsonLines(path, "task lifecycle");
  let state = "active";
  let previous = null;
  for (const [index, event] of events.entries()) {
    assertLifecycleEvent(event, { previous, sequence: index + 1, state, task });
    state = event.next_state;
    previous = event.event_sha256;
  }
  return {
    events,
    state,
    tail_sha256: previous,
    task,
  };
}

export function appendTaskLifecycleEvent(
  root,
  {
    authority,
    authorityVerifier,
    basis,
    basisIdentity,
    expectedPriorEventSha256,
    expectedSequence,
    now = new Date().toISOString(),
    taskId,
  },
) {
  const current = readTaskLifecycle(root, taskId);
  if (expectedSequence !== current.events.length + 1 || expectedPriorEventSha256 !== current.tail_sha256) {
    fail("TASK_LIFECYCLE_STALE", "Task lifecycle tail changed; reload before appending.", 4);
  }
  if (current.state !== "active") fail("TASK_LIFECYCLE_TERMINAL", "Task lifecycle cannot reopen or transition twice.", 4);
  assertAuthorityInput(authority, { action: basis === "owner_abandoned" ? "abandon_task" : "close_task", taskId });
  if (typeof authorityVerifier !== "function" || authorityVerifier(structuredClone(authority)) !== true) {
    fail("TASK_AUTHORITY_INVALID", "Task lifecycle transition requires independently verified authority.", 4);
  }
  if (!lifecycleBases.includes(basis)) fail("TASK_LIFECYCLE_INVALID", "Task lifecycle basis is unsupported.");
  assertBasisIdentity(basis, basisIdentity, current.task);
  const requiredKind = basis === "task_bound_pr_merge" ? "task_aware_workflow" : "owner";
  if (authority.kind !== requiredKind) fail("TASK_AUTHORITY_INVALID", "Task lifecycle basis has the wrong authority kind.", 4);
  const envelope = {
    authority: authorityBinding(authority),
    basis,
    basis_identity: structuredClone(basisIdentity),
    next_state: basis === "owner_abandoned" ? "abandoned" : "closed",
    occurred_at: assertTimestamp(now, "lifecycle occurred_at"),
    prior_event_sha256: current.tail_sha256,
    prior_state: current.state,
    sequence: expectedSequence,
    task_id: taskId,
  };
  const event = { ...envelope, event_sha256: sha256Canonical(envelope) };
  const path = taskFile(root, taskId, "lifecycle.jsonl");
  writeAtomic(path, `${eventsBytes(current.events)}${JSON.stringify(event)}\n`);
  return event;
}

export function readCleanupHolds(root, taskId) {
  loadTaskManifest(root, taskId);
  const path = taskFile(root, taskId, "holds.jsonl");
  const events = readJsonLines(path, "cleanup holds");
  const known = new Map();
  let previous = null;
  for (const [index, event] of events.entries()) {
    assertHoldEvent(event, { previous, sequence: index + 1, taskId });
    const prior = known.get(event.hold_id);
    if (event.action === "place") {
      if (prior) fail("CLEANUP_HOLD_CORRUPT", "A cleanup hold cannot be placed twice.", 3);
      known.set(event.hold_id, { active: true, category: event.category, event });
    } else {
      if (!prior?.active || prior.category !== event.category) {
        fail("CLEANUP_HOLD_CORRUPT", "Cleanup hold release does not match one active hold.", 3);
      }
      known.set(event.hold_id, { active: false, category: event.category, event });
    }
    previous = event.event_sha256;
  }
  const active = [...known.entries()]
    .filter(([, value]) => value.active)
    .map(([holdId, value]) => ({ category: value.category, hold_id: holdId }))
    .sort(compareByCanonical);
  return { active, events, tail_sha256: previous };
}

export function appendCleanupHoldEvent(
  root,
  {
    action,
    authority,
    authorityVerifier,
    category,
    expectedPriorEventSha256,
    expectedSequence,
    holdId,
    now = new Date().toISOString(),
    reason,
    taskId,
  },
) {
  const current = readCleanupHolds(root, taskId);
  if (expectedSequence !== current.events.length + 1 || expectedPriorEventSha256 !== current.tail_sha256) {
    fail("CLEANUP_HOLD_STALE", "Cleanup hold tail changed; reload before appending.", 4);
  }
  if (!holdCategories.includes(category) || !["place", "release"].includes(action)) {
    fail("CLEANUP_HOLD_INVALID", "Cleanup hold action or category is unsupported.");
  }
  assertIdentity(holdId, "holdId");
  assertReason(reason, "hold reason");
  assertAuthorityInput(authority, { action: `${action}_hold`, taskId });
  if (authority.kind !== "owner" && authority.kind !== "task_aware_workflow") {
    fail("CLEANUP_HOLD_AUTHORITY_INVALID", "Cleanup holds require owner or exact task-aware authority.", 4);
  }
  if (typeof authorityVerifier !== "function" || authorityVerifier(structuredClone(authority)) !== true) {
    fail("CLEANUP_HOLD_AUTHORITY_INVALID", "Cleanup hold change requires independently verified authority.", 4);
  }
  const priorForHold = current.events.filter((event) => event.hold_id === holdId).at(-1);
  if ((action === "place" && priorForHold) || (action === "release" && (!priorForHold || priorForHold.action !== "place"))) {
    fail("CLEANUP_HOLD_INVALID", "Cleanup hold transition does not match its exact prior state.", 4);
  }
  const envelope = {
    action,
    authority: authorityBinding(authority),
    category,
    hold_id: holdId,
    occurred_at: assertTimestamp(now, "hold occurred_at"),
    prior_event_sha256: current.tail_sha256,
    reason,
    sequence: expectedSequence,
    task_id: taskId,
  };
  const event = { ...envelope, event_sha256: sha256Canonical(envelope) };
  const path = taskFile(root, taskId, "holds.jsonl");
  writeAtomic(path, `${eventsBytes(current.events)}${JSON.stringify(event)}\n`);
  return event;
}

export function createRetentionPlan(root, { now = new Date().toISOString(), taskId, ttlMs = null } = {}) {
  const createdAt = assertTimestamp(now, "cleanup plan created_at");
  const snapshot = buildRetentionSnapshot(root, taskId, { now: createdAt, ttlMs });
  const snapshotSha256 = sha256Canonical(snapshot);
  const planId = `cleanup-${snapshotSha256.slice(0, 24)}`;
  const envelope = {
    canonical_roots: snapshot.canonical_roots,
    created_at: createdAt,
    holds: snapshot.holds,
    items: snapshot.items,
    lifecycle: snapshot.lifecycle,
    plan_id: planId,
    plan_version: "cleanup-plan-v1",
    policy_version: "retention-policy-v2",
    shared_reachability: snapshot.shared_reachability,
    snapshot_sha256: snapshotSha256,
    task_id: taskId,
    task_manifest_sha256: snapshot.task_manifest_sha256,
    runs: snapshot.runs,
    ttl_hint: snapshot.ttl_hint,
  };
  const plan = { ...envelope, plan_sha256: sha256Canonical(envelope) };
  const path = cleanupFile(root, taskId, "plans", `${plan.plan_sha256}.json`);
  writeImmutable(path, canonicalJson(plan));
  return plan;
}

export function loadRetentionPlan(root, planSha256) {
  assertHash(planSha256, "planSha256");
  for (const taskId of listEntityIds(root, "tasks")) {
    const path = cleanupFile(root, taskId, "plans", `${planSha256}.json`);
    if (!existsSync(path)) continue;
    const plan = parseStrictJson(readFileSync(path), "cleanup plan");
    assertCleanupPlan(plan, planSha256);
    return plan;
  }
  fail("CLEANUP_PLAN_NOT_FOUND", "The reviewed cleanup plan does not exist.", 4);
}

export function issueCleanupAuthority(
  root,
  {
    authority,
    authorityVerifier,
    issuanceAuthority,
    kind,
    now = new Date().toISOString(),
  } = {},
) {
  if (!["apply", "purge"].includes(kind)) {
    fail("CLEANUP_AUTHORITY_ISSUANCE_INVALID", "Cleanup authority issuance kind is unsupported.", 4);
  }
  const recordedAt = assertTimestamp(now, "cleanup authority recorded_at");
  const plan = loadRetentionPlan(root, authority?.plan_sha256);
  const apply = kind === "purge" ? loadApplyRecord(root, authority?.apply_sha256) : null;
  validateCleanupAuthority(authority, { apply, kind, now: recordedAt, plan });
  const authoritySha256 = sha256Canonical(authority);
  assertCleanupIssuanceAuthority(issuanceAuthority, {
    action: `issue_cleanup_${kind}_authority`,
    authoritySha256,
    taskId: plan.task_id,
  });
  if (typeof authorityVerifier !== "function" || authorityVerifier(structuredClone(issuanceAuthority)) !== true) {
    fail("CLEANUP_AUTHORITY_ISSUANCE_INVALID", "Cleanup authority issuance requires independently verified owner authority.", 4);
  }
  const envelope = {
    authority: structuredClone(authority),
    authority_kind: kind,
    authority_sha256: authoritySha256,
    issuance_authority: structuredClone(issuanceAuthority),
    record_version: "cleanup-authority-record-v1",
    recorded_at: recordedAt,
    task_id: plan.task_id,
  };
  const record = { ...envelope, record_sha256: sha256Canonical(envelope) };
  const path = cleanupFile(root, plan.task_id, "authorities", `${authority.authority_id}.json`);
  writeImmutable(path, canonicalJson(record));
  return cleanupAuthorityReference(record);
}

export function applyRetentionPlan(
  root,
  { authorityReference, now = new Date().toISOString(), planSha256, shadowAdapter = null } = {},
) {
  const plan = loadRetentionPlan(root, planSha256);
  const operationTime = assertTimestamp(now, "cleanup apply time");
  const { authority, reference } = resolveCleanupAuthority(root, authorityReference, "apply");
  validateCleanupAuthority(authority, { kind: "apply", now: operationTime, plan });
  const actionable = plan.items.filter((item) => item.classification !== "retain");
  const applyId = `apply-${sha256Canonical({ authority_id: authority.authority_id, nonce: authority.nonce, plan_sha256: plan.plan_sha256 }).slice(0, 24)}`;
  const path = cleanupFile(root, plan.task_id, "applies", `${applyId}.json`);
  if (existsSync(path)) {
    const existing = readApplyRecord(path);
    assertSameAuthority(existing.authority, authority);
    assertSameAuthority(existing.authority_reference, reference);
    if (existing.status === "complete") return existing;
    assertApplyContinuationFresh(root, plan, existing);
    assertShadowCapability(actionable, shadowAdapter);
    preflightShadowOwnership(actionable, shadowAdapter);
    return reconcileApply(root, plan, existing, path, shadowAdapter);
  }
  assertNoDifferentApply(root, plan, applyId);
  assertCleanupNonceAvailable(root, authority);
  assertPlanFresh(root, plan);
  const requiredActions = new Set();
  for (const item of actionable) requiredActions.add(item.kind === "shadow" ? "shadow_archive" : "local_quarantine");
  assertAllowedActions(authority.allowed_actions, requiredActions, "CLEANUP_APPLY_AUTHORITY_INVALID");
  assertShadowCapability(actionable, shadowAdapter);
  preflightShadowOwnership(actionable, shadowAdapter);
  let record = sealRecord({
    apply_id: applyId,
    apply_version: "cleanup-apply-v1",
    authority: structuredClone(authority),
    authority_reference: structuredClone(reference),
    created_at: operationTime,
    plan_sha256: plan.plan_sha256,
    results: [],
    status: "in_progress",
    task_id: plan.task_id,
  }, "apply_sha256");
  writeAtomic(path, canonicalJson(record));
  return continueApply(root, plan, record, path, shadowAdapter);
}

export function purgeRetentionPlan(
  root,
  { applySha256, authorityReference, now = new Date().toISOString(), shadowAdapter = null } = {},
) {
  const apply = loadApplyRecord(root, applySha256);
  const plan = loadRetentionPlan(root, apply.plan_sha256);
  const operationTime = assertTimestamp(now, "cleanup purge time");
  const { authority, reference } = resolveCleanupAuthority(root, authorityReference, "purge");
  validateCleanupAuthority(authority, { apply, kind: "purge", now: operationTime, plan });
  if (apply.status !== "complete") fail("CLEANUP_APPLY_INCOMPLETE", "Purge requires one completed exact apply.", 4);
  const purgeItems = plan.items.filter((item) => item.classification === "purge_eligible");
  const purgeIds = purgeItems.map((item) => item.item_id).sort(compareStrings);
  if (canonicalJson(authority.purge_item_ids) !== canonicalJson(purgeIds)) {
    fail("CLEANUP_PURGE_AUTHORITY_INVALID", "Purge authority must bind the exact eligible membership.", 4);
  }
  const requiredActions = new Set(purgeItems.map((item) => item.kind === "shadow" ? "shadow_delete" : "local_delete"));
  assertAllowedActions(authority.allowed_actions, requiredActions, "CLEANUP_PURGE_AUTHORITY_INVALID");
  assertShadowCapability(purgeItems, shadowAdapter);
  const purgeId = `purge-${sha256Canonical({ apply_sha256: apply.apply_sha256, authority_id: authority.authority_id, nonce: authority.nonce }).slice(0, 24)}`;
  const path = cleanupFile(root, plan.task_id, "purges", `${purgeId}.json`);
  if (existsSync(path)) {
    const existing = readPurgeRecord(path);
    assertSameAuthority(existing.authority, authority);
    assertSameAuthority(existing.authority_reference, reference);
    if (existing.status === "complete") return existing;
    assertPurgeContinuationFresh(root, plan, apply, existing);
    preflightShadowOwnership(purgeItems, shadowAdapter);
    return reconcilePurge(root, plan, apply, existing, path, shadowAdapter);
  }
  assertNoDifferentPurge(root, plan, apply, purgeId);
  assertCleanupNonceAvailable(root, authority);
  assertPostApplyFresh(root, plan, apply);
  preflightShadowOwnership(purgeItems, shadowAdapter);
  let record = sealRecord({
    apply_sha256: apply.apply_sha256,
    authority: structuredClone(authority),
    authority_reference: structuredClone(reference),
    created_at: operationTime,
    plan_sha256: plan.plan_sha256,
    purge_id: purgeId,
    purge_version: "cleanup-purge-v1",
    results: [],
    status: "in_progress",
    task_id: plan.task_id,
  }, "purge_sha256");
  writeAtomic(path, canonicalJson(record));
  return continuePurge(root, plan, apply, record, path, shadowAdapter);
}

export function inventoryLegacyV1(root) {
  const sourceRoot = realpathSync(resolve(root));
  const entries = [];
  walkLegacy(sourceRoot, sourceRoot, entries);
  entries.sort((left, right) => compareStrings(left.relative_path, right.relative_path));
  return {
    artifact_type: "legacy_v1_inventory",
    entries,
    inventory_version: "legacy-v1-inventory-v1",
    limitations: [
      "catalog_reference_only",
      "cannot_satisfy_v2_authority",
      "source_files_not_rewritten",
    ],
    source_root: sourceRoot,
    source_root_sha256: sha256Bytes(Buffer.from(sourceRoot, "utf8")),
  };
}

export function rebuildReviewViews(root, runId, summary) {
  const before = summary.content_sha256;
  const metadata = rebuildReviewRepresentations(root, runId, summary);
  if (summary.content_sha256 !== before) fail("REVIEW_AUTHORITY_CHANGED", "Derived rebuild changed canonical review authority.", 4);
  return metadata;
}

export function validateReviewViews(root, runId, summary) {
  return validateReviewRepresentations(root, runId, summary);
}

export function rebuildRuntimeViews(root, runId) {
  rebuildRuntimeIndex(root, runId);
  return validateRuntimeIndex(root, runId);
}

function buildRetentionSnapshot(root, taskId, { now, ttlMs }) {
  const lifecycle = readTaskLifecycle(root, taskId);
  const holds = readCleanupHolds(root, taskId);
  const taskRunIds = listEntityIds(root, "runs").filter((runId) => loadRunManifest(root, runId).payload.task_id === taskId);
  const runs = taskRunIds.map((runId) => {
    const manifest = loadRunManifest(root, runId);
    const journal = readJournal(root, runId);
    return {
      journal_tail_sha256: journal.at(-1)?.event_sha256 ?? null,
      manifest_sha256: manifest.content_sha256,
      revision: manifest.payload.revision,
      run_id: runId,
    };
  }).sort(compareByCanonical);
  const global = buildGlobalReachability(root);
  const canonicalRoots = collectCanonicalRoots(root, taskId, taskRunIds);
  const destructiveAllowed = lifecycle.state !== "active" && holds.active.length === 0;
  const items = [];
  for (const artifact of global.artifacts) {
    const objectPath = objectRelativePath(artifact.content_sha256);
    const reachable = global.reachable.has(artifact.content_sha256);
    items.push(itemRecord({
      artifactSha256: artifact.content_sha256,
      classification: destructiveAllowed && !reachable ? "purge_eligible" : "retain",
      contentSha256: hashFile(containedPath(root, ...objectPath.split("/"))),
      dependencyArtifactSha256: artifact.links.map((link) => link.target_content_sha256).sort(compareStrings),
      kind: "object",
      reason: !destructiveAllowed ? lifecycle.state === "active" ? "task_active" : "cleanup_hold_active" : reachable ? "globally_reachable" : "globally_unreferenced",
      relativePath: objectPath,
    }));
  }
  for (const runId of taskRunIds) {
    for (const name of [...derivedViewNames].sort(compareStrings)) {
      const relativePath = `runs/${runId}/${name}`;
      const path = containedPath(root, ...relativePath.split("/"));
      if (!existsSync(path)) continue;
      assertRegularFile(path, "derived view");
      items.push(itemRecord({
        classification: destructiveAllowed ? "quarantine" : "retain",
        contentSha256: hashFile(path),
        kind: "derived_view",
        reason: destructiveAllowed ? "terminal_derived_view" : lifecycle.state === "active" ? "task_active" : "cleanup_hold_active",
        relativePath,
        runId,
      }));
    }
    items.push(...shadowItemsForRun(root, runId, lifecycle, holds, destructiveAllowed));
  }
  items.sort((left, right) => compareStrings(left.item_id, right.item_id));
  const ageMs = Date.parse(now) - Date.parse(lifecycle.task.payload.created_at);
  return {
    canonical_roots: canonicalRoots,
    holds: { active: holds.active, tail_sha256: holds.tail_sha256 },
    items,
    lifecycle: { state: lifecycle.state, tail_sha256: lifecycle.tail_sha256 },
    runs,
    shared_reachability: {
      object_count: global.artifacts.length,
      reachable_sha256: [...global.reachable].sort(compareStrings),
      root_sha256: [...global.roots].sort(compareStrings),
      status: "complete",
    },
    task_manifest_sha256: lifecycle.task.content_sha256,
    ttl_hint: {
      destructive_authority: false,
      review_recommended: Number.isInteger(ttlMs) && ttlMs >= 0 ? ageMs >= ttlMs : false,
      threshold_ms: Number.isInteger(ttlMs) && ttlMs >= 0 ? ttlMs : null,
    },
  };
}

function buildGlobalReachability(root) {
  const artifacts = listReachabilityArtifacts(root);
  const byHash = new Map(artifacts.map((artifact) => [artifact.content_sha256, artifact]));
  const roots = new Set();
  const fullyRetainedRunIds = new Set();
  const runIds = listEntityIds(root, "runs");
  for (const taskId of listEntityIds(root, "tasks")) {
    roots.add(loadTaskManifest(root, taskId).content_sha256);
    const lifecycle = readTaskLifecycle(root, taskId);
    const holds = readCleanupHolds(root, taskId);
    if (lifecycle.state === "active" || holds.active.length > 0) {
      for (const runId of runIds) {
        if (loadRunManifest(root, runId).payload.task_id === taskId) fullyRetainedRunIds.add(runId);
      }
    }
    collectPendingCleanupRoots(root, taskId, roots, byHash);
  }
  for (const runId of runIds) {
    const run = loadRunManifest(root, runId);
    const journal = readReachabilityJournal(root, runId);
    roots.add(run.content_sha256);
    for (const event of journal) roots.add(event.target_content_sha256);
    collectRuntimeRoots(root, runId, roots);
    collectCanonicalReviewRoot(root, runId, roots, artifacts, journal);
  }
  for (const artifact of artifacts) {
    if (["generated_report", "human_evaluation", "human_review_decision"].includes(artifact.artifact_type)) {
      validateArtifactGraph(exactArtifactClosure(artifact, byHash));
      roots.add(artifact.content_sha256);
    }
    if (artifactClosureBelongsToRetainedRun(artifact, fullyRetainedRunIds, byHash)) {
      roots.add(artifact.content_sha256);
    }
  }
  const reachable = new Set();
  const visit = (hash) => {
    if (reachable.has(hash)) return;
    const artifact = byHash.get(hash);
    if (!artifact) fail("REACHABILITY_UNCERTAIN", "A retained root or link is missing from the shared object store.", 4);
    reachable.add(hash);
    for (const link of artifact.links) visit(link.target_content_sha256);
  };
  for (const hash of roots) visit(hash);
  return { artifacts, reachable, roots };
}

function listReachabilityArtifacts(root) {
  try {
    return listStoredArtifacts(root);
  } catch (error) {
    if (error instanceof HarnessError) {
      fail("REACHABILITY_UNCERTAIN", "The shared object store cannot establish complete retained-root reachability.", 4);
    }
    throw error;
  }
}

function readReachabilityJournal(root, runId) {
  try {
    return readJournal(root, runId);
  } catch (error) {
    if (error instanceof HarnessError) {
      fail("REACHABILITY_UNCERTAIN", "A retained run has invalid or incomplete durable journal lineage.", 4);
    }
    throw error;
  }
}

function collectRuntimeRoots(root, runId, roots) {
  const directory = containedPath(root, "runs", runId, "runtime", "attempts");
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => compareStrings(left.name, right.name))) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) {
      fail("REACHABILITY_UNCERTAIN", "Runtime canonical roots contain an unsupported filesystem entry.", 4);
    }
    const runtime = readRuntimeSnapshot(root, runId, entry.name);
    roots.add(runtime.snapshot.runtime_attestation_sha256);
    roots.add(runtime.snapshot.runtime_dispatch_request_sha256);
    for (const event of runtime.events) roots.add(event.content_sha256);
    for (const evidence of runtime.result?.evidence ?? []) roots.add(evidence.content_sha256);
  }
}

function collectCanonicalReviewRoot(root, runId, roots, artifacts, journal) {
  const reviewPublished = journal.some(
    (event) => event.type === "run_transitioned" && event.details.kind === "state" && event.details.state === "review_pending",
  );
  if (!reviewPublished) return;
  const summaries = artifacts.filter(
    (artifact) =>
      artifact.artifact_type === "run_review_summary" &&
      artifact.links.some(
        (link) =>
          link.relationship === "run" &&
          link.target_artifact_type === "run_manifest" &&
          link.target_artifact_id === runId,
      ),
  );
  if (summaries.length !== 1) {
    fail("REACHABILITY_UNCERTAIN", "Canonical review ownership is missing, conflicting, or ambiguous.", 4);
  }
  try {
    assertSummaryRunBinding(root, runId, summaries[0]);
  } catch (error) {
    if (error instanceof HarnessError) {
      fail("REACHABILITY_UNCERTAIN", "Canonical review ownership has invalid historical run lineage.", 4);
    }
    throw error;
  }
  roots.add(summaries[0].content_sha256);
}

function collectPendingCleanupRoots(root, taskId, roots, byHash) {
  const directory = cleanupFile(root, taskId, "plans");
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => compareStrings(left.name, right.name))) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      fail("REACHABILITY_UNCERTAIN", "Cleanup plan roots contain an unsupported filesystem entry.", 4);
    }
    const planSha256 = entry.name.slice(0, -5);
    const plan = parseStrictJson(readFileSync(containedPath(directory, entry.name)), "pending cleanup plan");
    assertCleanupPlan(plan, planSha256);
    for (const hash of plan.shared_reachability.root_sha256) {
      if (!byHash.has(hash)) {
        fail("REACHABILITY_UNCERTAIN", "A pending cleanup record retains a missing shared object.", 4);
      }
      roots.add(hash);
    }
  }
}

function exactArtifactClosure(rootArtifact, byHash) {
  const closure = [];
  const visited = new Set();
  const visit = (artifact) => {
    if (visited.has(artifact.content_sha256)) return;
    visited.add(artifact.content_sha256);
    for (const link of artifact.links) {
      const target = byHash.get(link.target_content_sha256);
      if (!target) fail("REACHABILITY_UNCERTAIN", "Accepted semantic authority has a missing dependency.", 4);
      visit(target);
    }
    closure.push(artifact);
  };
  visit(rootArtifact);
  return closure;
}

function artifactClosureBelongsToRetainedRun(artifact, retainedRunIds, byHash, visited = new Set()) {
  if (retainedRunIds.size === 0 || visited.has(artifact.content_sha256)) return false;
  visited.add(artifact.content_sha256);
  if (retainedRunIds.has(artifact.payload?.run_id)) return true;
  for (const link of artifact.links) {
    if (
      link.relationship === "run" &&
      link.target_artifact_type === "run_manifest" &&
      retainedRunIds.has(link.target_artifact_id)
    ) return true;
    const target = byHash.get(link.target_content_sha256);
    if (!target) fail("REACHABILITY_UNCERTAIN", "A retained artifact closure has a missing dependency.", 4);
    if (artifactClosureBelongsToRetainedRun(target, retainedRunIds, byHash, visited)) return true;
  }
  return false;
}

function collectCanonicalRoots(root, taskId, runIds) {
  const roots = [];
  const add = (relativePath) => {
    const path = containedPath(root, ...relativePath.split("/"));
    if (!existsSync(path)) return;
    assertRegularFile(path, "canonical root");
    roots.push({ relative_path: relativePath, sha256: hashFile(path) });
  };
  add(`tasks/${taskId}/task.json`);
  add(`tasks/${taskId}/lifecycle.jsonl`);
  add(`tasks/${taskId}/holds.jsonl`);
  for (const runId of runIds) {
    add(`runs/${runId}/manifest.json`);
    add(`runs/${runId}/journal.ndjson`);
    collectFiles(root, `runs/${runId}`, roots, (relativePath) => !derivedViewNames.has(relativePath.slice(`runs/${runId}/`.length)));
  }
  const unique = new Map(roots.map((entry) => [entry.relative_path, entry]));
  return [...unique.values()].sort((left, right) => compareStrings(left.relative_path, right.relative_path));
}

function collectFiles(root, relativeRoot, output, include) {
  const directory = containedPath(root, ...relativeRoot.split("/"));
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => compareStrings(a.name, b.name))) {
    const relativePath = `${relativeRoot}/${entry.name}`;
    const path = containedPath(root, ...relativePath.split("/"));
    if (entry.isSymbolicLink()) fail("REACHABILITY_UNCERTAIN", "Canonical roots cannot include symbolic links.", 4);
    if (entry.isDirectory()) collectFiles(root, relativePath, output, include);
    else if (entry.isFile() && include(relativePath)) output.push({ relative_path: relativePath, sha256: hashFile(path) });
    else if (!entry.isFile()) fail("REACHABILITY_UNCERTAIN", "Canonical roots contain an unsupported filesystem entry.", 4);
  }
}

function shadowItemsForRun(root, runId, lifecycle, holds, destructiveAllowed) {
  const journal = readJournal(root, runId);
  const byAttempt = new Map();
  for (const event of journal.filter((entry) => entry.type === "runtime_recorded")) {
    const values = byAttempt.get(event.details.attempt_id) ?? [];
    values.push(event.details);
    byAttempt.set(event.details.attempt_id, values);
  }
  const items = [];
  for (const [attemptId, events] of byAttempt) {
    const acknowledged = events.find((event) => event.event === "thread_start_acknowledged");
    const unknownBootstrap = events.some((event) => event.event === "thread_start_outcome_unknown");
    if (!acknowledged && !unknownBootstrap) continue;
    const terminal = readAttemptPhases(root, runId, attemptId).terminal;
    const terminalCertain = terminal && terminal.payload.call_certainty !== "unknown" && terminal.payload.outcome !== "outcome_unknown";
    if (acknowledged) {
      const runtimeViews = validateRuntimeIndex(root, runId);
      const runtimeIndex = parseStrictJson(Buffer.from(runtimeViews.json, "utf8"), "runtime index");
      const runtimeAttempt = runtimeIndex.attempts.find((entry) => entry.attempt_id === attemptId);
      if (!runtimeAttempt || runtimeAttempt.thread_id !== acknowledged.thread_id) {
        fail("SHADOW_OWNERSHIP_INVALID", "Shadow acknowledgement is not bound by the exact validated runtime index.", 4);
      }
    }
    const eligible = destructiveAllowed && acknowledged && terminalCertain && !unknownBootstrap;
    const identity = {
      attempt_id: attemptId,
      run_id: runId,
      task_id: lifecycle.task.artifact_id,
      thread_id: acknowledged?.thread_id ?? null,
    };
    items.push(itemRecord({
      classification: eligible ? "purge_eligible" : "retain",
      contentSha256: sha256Canonical(identity),
      kind: "shadow",
      reason: !destructiveAllowed
        ? lifecycle.state === "active" ? "task_active" : "cleanup_hold_active"
        : unknownBootstrap ? "shadow_thread_outcome_unknown"
          : !acknowledged ? "shadow_thread_unacknowledged"
            : !terminalCertain ? "attempt_outcome_unknown" : "terminal_acknowledged_shadow",
      shadow: identity,
    }));
  }
  return items;
}

function itemRecord({ artifactSha256 = null, classification, contentSha256 = null, dependencyArtifactSha256 = [], kind, reason, relativePath = null, runId = null, shadow = null }) {
  const identity = {
    artifact_sha256: artifactSha256,
    content_sha256: contentSha256,
    dependency_artifact_sha256: dependencyArtifactSha256,
    kind,
    relative_path: relativePath,
    run_id: runId,
    shadow,
  };
  return {
    artifact_sha256: artifactSha256,
    classification,
    content_sha256: contentSha256,
    dependency_artifact_sha256: dependencyArtifactSha256,
    item_id: `item-${sha256Canonical(identity).slice(0, 24)}`,
    kind,
    reason,
    relative_path: relativePath,
    run_id: runId,
    shadow,
  };
}

function assertPlanFresh(root, plan) {
  const snapshot = buildRetentionSnapshot(root, plan.task_id, {
    now: plan.created_at,
    ttlMs: plan.ttl_hint.threshold_ms,
  });
  if (sha256Canonical(snapshot) !== plan.snapshot_sha256) {
    fail("CLEANUP_PLAN_STALE", "Lifecycle, holds, roots, reachability, or shadow ownership changed after review.", 4);
  }
}

function assertPostApplyFresh(root, plan, apply) {
  assertStableCleanupState(root, plan);
  assertCanonicalRootsFresh(root, plan);
  assertCurrentObjectSet(root, plan, apply);
  for (const item of plan.items.filter((entry) => entry.classification === "purge_eligible" && entry.kind !== "shadow")) {
    const quarantine = quarantinePath(root, plan, item);
    if (!existsSync(quarantine) || hashFile(quarantine) !== item.content_sha256) {
      fail("CLEANUP_PLAN_STALE", "Quarantined purge candidate no longer matches the reviewed item.", 4);
    }
  }
}

function assertApplyContinuationFresh(root, plan, apply) {
  assertStableCleanupState(root, plan);
  assertCanonicalRootsFresh(root, plan);
  assertCurrentObjectSet(root, plan, apply, { allowUnrecordedQuarantine: true });
  const results = new Map(apply.results.map((result) => [result.item_id, result]));
  for (const item of plan.items.filter((entry) => entry.classification !== "retain" && entry.kind !== "shadow")) {
    const result = results.get(item.item_id);
    const source = containedPath(root, ...item.relative_path.split("/"));
    const quarantine = quarantinePath(root, plan, item);
    if (result?.status === "acknowledged") {
      if (existsSync(source) || !existsSync(quarantine) || hashFile(quarantine) !== item.content_sha256) {
        fail("CLEANUP_PLAN_STALE", "Acknowledged quarantine state changed before reconciliation.", 4);
      }
      continue;
    }
    const sourceValid = existsSync(source) && hashFile(source) === item.content_sha256;
    const quarantineValid = existsSync(quarantine) && hashFile(quarantine) === item.content_sha256;
    if (sourceValid === quarantineValid) fail("CLEANUP_PLAN_STALE", "Unresolved local apply state is missing or ambiguous.", 4);
  }
}

function assertPurgeContinuationFresh(root, plan, apply, purge) {
  assertStableCleanupState(root, plan);
  assertCanonicalRootsFresh(root, plan);
  assertCurrentObjectSet(root, plan, apply);
  const results = new Map(purge.results.map((result) => [result.item_id, result]));
  for (const item of plan.items.filter((entry) => entry.classification === "purge_eligible" && entry.kind !== "shadow")) {
    const result = results.get(item.item_id);
    const quarantine = quarantinePath(root, plan, item);
    if (result?.status === "acknowledged") {
      if (existsSync(quarantine)) {
        fail("CLEANUP_PLAN_STALE", "Acknowledged purge state changed before reconciliation.", 4);
      }
    } else if (!existsSync(quarantine) || hashFile(quarantine) !== item.content_sha256) {
      fail("CLEANUP_PLAN_STALE", "Unresolved purge candidate no longer matches quarantine.", 4);
    }
  }
}

function assertStableCleanupState(root, plan) {
  const lifecycle = readTaskLifecycle(root, plan.task_id);
  const holds = readCleanupHolds(root, plan.task_id);
  if (
    lifecycle.state !== plan.lifecycle.state ||
    lifecycle.tail_sha256 !== plan.lifecycle.tail_sha256 ||
    canonicalJson(holds.active) !== canonicalJson(plan.holds.active) ||
    holds.tail_sha256 !== plan.holds.tail_sha256
  ) fail("CLEANUP_PLAN_STALE", "Lifecycle or hold state changed after apply.", 4);
  const currentRuns = plan.runs.map((expected) => {
    const manifest = loadRunManifest(root, expected.run_id);
    const journal = readJournal(root, expected.run_id);
    return {
      journal_tail_sha256: journal.at(-1)?.event_sha256 ?? null,
      manifest_sha256: manifest.content_sha256,
      revision: manifest.payload.revision,
      run_id: expected.run_id,
    };
  });
  if (canonicalJson(currentRuns) !== canonicalJson(plan.runs)) fail("CLEANUP_PLAN_STALE", "Run state changed after apply.", 4);
}

function assertCanonicalRootsFresh(root, plan) {
  for (const rootEntry of plan.canonical_roots) {
    const path = containedPath(root, ...rootEntry.relative_path.split("/"));
    if (!existsSync(path) || hashFile(path) !== rootEntry.sha256) {
      fail("CLEANUP_PLAN_STALE", "A retained canonical root changed after review.", 4);
    }
  }
}

function assertCurrentObjectSet(root, plan, apply, { allowUnrecordedQuarantine = false } = {}) {
  const applied = new Map(apply.results.map((result) => [result.item_id, result]));
  const currentObjects = listStoredArtifacts(root).map((artifact) => artifact.content_sha256).sort(compareStrings);
  const expectedObjects = plan.items
    .filter((item) => {
      if (item.kind !== "object") return false;
      if (applied.get(item.item_id)?.status === "acknowledged") return false;
      if (!allowUnrecordedQuarantine) return true;
      const source = containedPath(root, ...item.relative_path.split("/"));
      const quarantine = quarantinePath(root, plan, item);
      return existsSync(source) || !existsSync(quarantine) || hashFile(quarantine) !== item.content_sha256;
    })
    .map((item) => item.artifact_sha256)
    .sort(compareStrings);
  if (canonicalJson(currentObjects) !== canonicalJson(expectedObjects)) {
    fail("CLEANUP_PLAN_STALE", "Shared object roots changed after apply.", 4);
  }
}

function quarantineLocalItem(root, plan, item) {
  const source = containedPath(root, ...item.relative_path.split("/"));
  const target = quarantinePath(root, plan, item);
  if (existsSync(target)) {
    if (existsSync(source) || hashFile(target) !== item.content_sha256) return { status: "ambiguous" };
    return { quarantine_path: relativeStorePath(root, target), status: "acknowledged" };
  }
  if (!existsSync(source) || hashFile(source) !== item.content_sha256) return { status: "ambiguous" };
  mkdirSync(dirname(target), { recursive: true });
  renameSync(source, target);
  removeEmptyObjectDirectories(root, item, source);
  return { quarantine_path: relativeStorePath(root, target), status: "acknowledged" };
}

function removeEmptyObjectDirectories(root, item, source) {
  if (item.kind !== "object") return;
  const hashDirectory = dirname(source);
  const prefixDirectory = dirname(hashDirectory);
  const objectsDirectory = containedPath(root, "objects");
  if (readdirSync(hashDirectory).length === 0) rmdirSync(hashDirectory);
  if (prefixDirectory !== objectsDirectory && readdirSync(prefixDirectory).length === 0) rmdirSync(prefixDirectory);
}

function purgeLocalItem(root, plan, apply, item) {
  const applied = apply.results.find((result) => result.item_id === item.item_id);
  if (applied?.status !== "acknowledged") return { status: "failed" };
  const path = quarantinePath(root, plan, item);
  if (!existsSync(path)) return { status: "ambiguous" };
  if (hashFile(path) !== item.content_sha256) return { status: "ambiguous" };
  rmSync(path);
  return { status: "acknowledged" };
}

function performShadowAction({ action, adapter, idempotencyKey, item }) {
  const inspected = adapter.inspect(structuredClone(item.shadow));
  if (
    inspected?.status !== "present" ||
    inspected.thread_id !== item.shadow.thread_id ||
    inspected.task_id !== item.shadow.task_id ||
    inspected.run_id !== item.shadow.run_id ||
    inspected.attempt_id !== item.shadow.attempt_id
  ) fail("SHADOW_OWNERSHIP_INVALID", "Shadow inspection does not match exact canonical ownership.", 4);
  const result = adapter.apply({ action, idempotency_key: idempotencyKey, ...structuredClone(item.shadow) });
  assertShadowResult(result);
  return { operation_id: result.operation_id ?? null, status: result.status };
}

function assertShadowResult(result) {
  if (!result || !["acknowledged", "ambiguous", "failed"].includes(result.status)) {
    fail("SHADOW_RESULT_INVALID", "Shadow cleanup adapter returned an invalid result.", 4);
  }
}

function preflightShadowOwnership(items, adapter) {
  for (const item of items.filter((entry) => entry.kind === "shadow")) {
    const inspected = adapter.inspect(structuredClone(item.shadow));
    if (
      inspected?.status !== "present" ||
      inspected.thread_id !== item.shadow.thread_id ||
      inspected.task_id !== item.shadow.task_id ||
      inspected.run_id !== item.shadow.run_id ||
      inspected.attempt_id !== item.shadow.attempt_id
    ) fail("SHADOW_OWNERSHIP_INVALID", "Shadow inspection does not match exact canonical ownership.", 4);
  }
}

function assertNoDifferentApply(root, plan, applyId) {
  const directory = cleanupFile(root, plan.task_id, "applies");
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const record = readApplyRecord(containedPath(directory, entry.name));
    if (record.plan_sha256 !== plan.plan_sha256 || record.apply_id === applyId) continue;
    if (record.status !== "complete") {
      fail("CLEANUP_APPLY_UNRESOLVED", "An unresolved apply cannot be retried under another authority identity.", 4);
    }
    fail("CLEANUP_APPLY_ALREADY_RECORDED", "A reviewed plan can be applied only through its exact recorded operation identity.", 4);
  }
}

function assertNoDifferentPurge(root, plan, apply, purgeId) {
  const directory = cleanupFile(root, plan.task_id, "purges");
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const record = readPurgeRecord(containedPath(directory, entry.name));
    if (record.apply_sha256 !== apply.apply_sha256 || record.purge_id === purgeId) continue;
    if (record.status !== "complete") fail("CLEANUP_PURGE_UNRESOLVED", "An unresolved purge cannot be retried under another authority identity.", 4);
    fail("CLEANUP_PURGE_ALREADY_RECORDED", "An applied plan can be purged only through its exact recorded operation identity.", 4);
  }
}

function assertCleanupNonceAvailable(root, authority) {
  for (const taskId of listEntityIds(root, "tasks")) {
    for (const [kind, reader] of [["applies", readApplyRecord], ["purges", readPurgeRecord]]) {
      const directory = cleanupFile(root, taskId, kind);
      if (!existsSync(directory)) continue;
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const record = reader(containedPath(directory, entry.name));
        if (record.authority.issuer === authority.issuer && record.authority.nonce === authority.nonce) {
          fail("CLEANUP_AUTHORITY_NONCE_REUSED", "A cleanup nonce cannot authorize a different operation identity.", 4);
        }
      }
    }
  }
}

function reconcileApply(root, plan, record, path, shadowAdapter) {
  return record.status === "complete" ? record : continueApply(root, plan, record, path, shadowAdapter);
}

function reconcilePurge(root, plan, apply, record, path, shadowAdapter) {
  return record.status === "complete" ? record : continuePurge(root, plan, apply, record, path, shadowAdapter);
}

function continueApply(root, plan, initialRecord, path, shadowAdapter) {
  const actionable = orderCleanupItems(plan.items.filter((item) => item.classification !== "retain"));
  let record = initialRecord;
  for (const item of actionable) {
    const action = item.kind === "shadow" ? "shadow_archive" : "local_quarantine";
    const idempotencyKey = sha256Canonical({ action, item_id: item.item_id, plan_sha256: plan.plan_sha256 });
    const prior = record.results.find((result) => result.item_id === item.item_id);
    if (prior?.status === "acknowledged") continue;
    if (prior?.status === "failed") break;
    if (!prior) {
      record = updateApplyResult(path, record, { action, idempotency_key: idempotencyKey, item_id: item.item_id, status: "intent" });
      if (item.kind === "shadow") recordShadowCleanupEvent(root, plan, record, item, action, idempotencyKey, "intent", null);
    }
    const result = item.kind === "shadow"
      ? prior
        ? shadowAdapter.reconcile({ action: "archive", idempotency_key: idempotencyKey, ...structuredClone(item.shadow) })
        : performShadowAction({ action: "archive", adapter: shadowAdapter, idempotencyKey, item })
      : quarantineLocalItem(root, plan, item);
    if (item.kind === "shadow") assertShadowResult(result);
    record = updateApplyResult(path, record, {
      action,
      idempotency_key: idempotencyKey,
      item_id: item.item_id,
      operation_id: result.operation_id ?? null,
      status: result.status,
      ...(result.quarantine_path ? { quarantine_path: result.quarantine_path } : {}),
    });
    if (item.kind === "shadow") {
      recordShadowCleanupEvent(root, plan, record, item, action, idempotencyKey, result.status, result.operation_id ?? null);
    }
    if (result.status !== "acknowledged") break;
  }
  return finalizeApply(path, record, actionable);
}

function continuePurge(root, plan, apply, initialRecord, path, shadowAdapter) {
  const purgeItems = orderCleanupItems(plan.items.filter((item) => item.classification === "purge_eligible"));
  let record = initialRecord;
  for (const item of purgeItems) {
    const action = item.kind === "shadow" ? "shadow_delete" : "local_delete";
    const idempotencyKey = sha256Canonical({ action, apply_sha256: apply.apply_sha256, item_id: item.item_id });
    const prior = record.results.find((result) => result.item_id === item.item_id);
    if (prior?.status === "acknowledged") {
      writeTombstone(root, plan, apply, record.authority, record.authority_reference, item, prior, record.created_at);
      continue;
    }
    if (prior?.status === "failed") break;
    if (!prior) {
      record = updatePurgeResult(path, record, { action, idempotency_key: idempotencyKey, item_id: item.item_id, status: "intent" });
      if (item.kind === "shadow") recordShadowCleanupEvent(root, plan, record, item, action, idempotencyKey, "intent", null);
    }
    const result = item.kind === "shadow"
      ? prior
        ? shadowAdapter.reconcile({ action: "delete", idempotency_key: idempotencyKey, ...structuredClone(item.shadow) })
        : performShadowAction({ action: "delete", adapter: shadowAdapter, idempotencyKey, item })
      : purgeLocalItem(root, plan, apply, item);
    if (item.kind === "shadow") assertShadowResult(result);
    record = updatePurgeResult(path, record, {
      action,
      idempotency_key: idempotencyKey,
      item_id: item.item_id,
      operation_id: result.operation_id ?? null,
      status: result.status,
    });
    if (item.kind === "shadow") {
      recordShadowCleanupEvent(root, plan, record, item, action, idempotencyKey, result.status, result.operation_id ?? null);
    }
    if (result.status !== "acknowledged") break;
    writeTombstone(root, plan, apply, record.authority, record.authority_reference, item, result, record.created_at);
  }
  return finalizePurge(path, record, purgeItems);
}

function recordShadowCleanupEvent(root, plan, record, item, action, idempotencyKey, status, operationId) {
  const path = cleanupFile(root, plan.task_id, "shadow-events", `${idempotencyKey}.jsonl`);
  const events = readJsonLines(path, "shadow cleanup events");
  let previous = null;
  for (const [index, event] of events.entries()) {
    assertExactKeys(event, [
      "action", "authority_id", "cleanup_operation_id", "event_sha256", "event_version", "idempotency_key",
      "item_id", "occurred_at", "operation_id", "phase", "prior_event_sha256", "sequence", "status", "task_id",
      "thread_id",
    ], "shadow cleanup event");
    if (
      event.event_version !== "shadow-cleanup-event-v1" ||
      event.sequence !== index + 1 ||
      event.prior_event_sha256 !== previous ||
      event.idempotency_key !== idempotencyKey
    ) fail("SHADOW_EVENT_CORRUPT", "Shadow cleanup event sequence or identity is invalid.", 3);
    assertSelfHash(event, "event_sha256", "SHADOW_EVENT_CORRUPT");
    previous = event.event_sha256;
  }
  const cleanupOperationId = record.apply_id ?? record.purge_id;
  const phase = record.apply_id ? "apply" : "purge";
  const last = events.at(-1);
  if (last?.status === status && last.operation_id === operationId) return last;
  const envelope = {
    action,
    authority_id: record.authority.authority_id,
    cleanup_operation_id: cleanupOperationId,
    event_version: "shadow-cleanup-event-v1",
    idempotency_key: idempotencyKey,
    item_id: item.item_id,
    occurred_at: record.created_at,
    operation_id: operationId,
    phase,
    prior_event_sha256: previous,
    sequence: events.length + 1,
    status,
    task_id: plan.task_id,
    thread_id: item.shadow.thread_id,
  };
  const event = { ...envelope, event_sha256: sha256Canonical(envelope) };
  writeAtomic(path, `${eventsBytes(events)}${JSON.stringify(event)}\n`);
  return event;
}

function updateApplyResult(path, record, result) {
  const next = replaceResult(record, result.item_id, result, "apply_sha256");
  writeAtomic(path, canonicalJson(next));
  return next;
}

function updatePurgeResult(path, record, result) {
  const next = replaceResult(record, result.item_id, result, "purge_sha256");
  writeAtomic(path, canonicalJson(next));
  return next;
}

function replaceResult(record, itemId, result, hashField) {
  const results = record.results.filter((entry) => entry.item_id !== itemId);
  results.push(result);
  results.sort((left, right) => compareStrings(left.item_id, right.item_id));
  const envelope = { ...record, results };
  delete envelope[hashField];
  return sealRecord(envelope, hashField);
}

function finalizeApply(path, record, actionable) {
  const status = resultStatus(record.results, actionable);
  const envelope = { ...record, status };
  delete envelope.apply_sha256;
  const next = sealRecord(envelope, "apply_sha256");
  writeAtomic(path, canonicalJson(next));
  return next;
}

function finalizePurge(path, record, items) {
  const status = resultStatus(record.results, items);
  const envelope = { ...record, status };
  delete envelope.purge_sha256;
  const next = sealRecord(envelope, "purge_sha256");
  writeAtomic(path, canonicalJson(next));
  return next;
}

function resultStatus(results, items) {
  if (results.some((result) => result.status === "ambiguous")) return "ambiguous";
  if (results.some((result) => result.status === "failed")) return "failed";
  return items.every((item) => results.some((result) => result.item_id === item.item_id && result.status === "acknowledged"))
    ? "complete" : "in_progress";
}

function orderCleanupItems(items) {
  const shadow = items.filter((item) => item.kind === "shadow").sort((left, right) => compareStrings(left.item_id, right.item_id));
  const derived = items.filter((item) => item.kind === "derived_view").sort((left, right) => compareStrings(left.item_id, right.item_id));
  const objects = items.filter((item) => item.kind === "object");
  const byHash = new Map(objects.map((item) => [item.artifact_sha256, item]));
  const incoming = new Map(objects.map((item) => [item.artifact_sha256, 0]));
  for (const item of objects) {
    for (const dependency of item.dependency_artifact_sha256) {
      if (byHash.has(dependency)) incoming.set(dependency, incoming.get(dependency) + 1);
    }
  }
  const ready = objects.filter((item) => incoming.get(item.artifact_sha256) === 0).sort((left, right) => compareStrings(left.item_id, right.item_id));
  const orderedObjects = [];
  while (ready.length > 0) {
    const item = ready.shift();
    orderedObjects.push(item);
    for (const dependency of item.dependency_artifact_sha256) {
      if (!byHash.has(dependency)) continue;
      incoming.set(dependency, incoming.get(dependency) - 1);
      if (incoming.get(dependency) === 0) {
        ready.push(byHash.get(dependency));
        ready.sort((left, right) => compareStrings(left.item_id, right.item_id));
      }
    }
  }
  if (orderedObjects.length !== objects.length) fail("REACHABILITY_UNCERTAIN", "Unreferenced object cleanup contains a dependency cycle.", 4);
  return [...shadow, ...derived, ...orderedObjects];
}

function loadApplyRecord(root, applySha256) {
  assertHash(applySha256, "applySha256");
  for (const taskId of listEntityIds(root, "tasks")) {
    const directory = cleanupFile(root, taskId, "applies");
    if (!existsSync(directory)) continue;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      const record = readApplyRecord(containedPath(directory, entry.name));
      if (record.apply_sha256 === applySha256) return record;
    }
  }
  fail("CLEANUP_APPLY_NOT_FOUND", "The exact cleanup apply record does not exist.", 4);
}

function readApplyRecord(path) {
  const record = parseStrictJson(readFileSync(path), "cleanup apply record");
  assertSealedRecord(record, "apply_sha256", "cleanup-apply-v1");
  return record;
}

function readPurgeRecord(path) {
  const record = parseStrictJson(readFileSync(path), "cleanup purge record");
  assertSealedRecord(record, "purge_sha256", "cleanup-purge-v1");
  return record;
}

function writeTombstone(root, plan, apply, authority, authorityReference, item, result, occurredAt) {
  const envelope = {
    action_result: result.status,
    apply_sha256: apply.apply_sha256,
    authority_id: authority.authority_id,
    authority_record_sha256: authorityReference.record_sha256,
    classification: item.classification,
    item_id: item.item_id,
    occurred_at: occurredAt,
    plan_sha256: plan.plan_sha256,
    prior_sha256: item.content_sha256,
    reason: item.reason,
    task_id: plan.task_id,
    tombstone_version: "cleanup-tombstone-v1",
  };
  const tombstone = { ...envelope, tombstone_sha256: sha256Canonical(envelope) };
  writeImmutable(tombstonePath(root, plan, item), canonicalJson(tombstone));
}

function tombstonePath(root, plan, item) {
  return cleanupFile(root, plan.task_id, "tombstones", `${item.item_id}.json`);
}

function validateCleanupAuthority(authority, { apply = null, kind, now, plan }) {
  const common = ["allowed_actions", "authority_id", "expires_at", "issued_at", "issuer", "nonce", "plan_sha256", "task_id"];
  const expected = kind === "apply" ? common : [...common, "apply_sha256", "purge_item_ids"];
  assertExactKeys(authority, expected, "cleanup authority");
  assertIdentity(authority.authority_id, "authority_id");
  assertIdentity(authority.issuer, "authority issuer");
  assertIdentity(authority.nonce, "authority nonce");
  if (authority.task_id !== plan.task_id || authority.plan_sha256 !== plan.plan_sha256) {
    fail(`CLEANUP_${kind.toUpperCase()}_AUTHORITY_INVALID`, "Cleanup authority is bound to another task or plan.", 4);
  }
  const issued = Date.parse(assertTimestamp(authority.issued_at, "authority issued_at"));
  const expires = Date.parse(assertTimestamp(authority.expires_at, "authority expires_at"));
  const operationTime = Date.parse(now);
  if (expires <= issued || operationTime < issued || operationTime > expires) {
    fail(`CLEANUP_${kind.toUpperCase()}_AUTHORITY_INVALID`, "Cleanup authority is expired or has an invalid lifetime.", 4);
  }
  assertSortedUnique(authority.allowed_actions, kind === "apply" ? applyActions : purgeActions, "allowed_actions");
  if (kind === "purge") {
    if (authority.apply_sha256 !== apply.apply_sha256) {
      fail("CLEANUP_PURGE_AUTHORITY_INVALID", "Purge authority is bound to another apply.", 4);
    }
    assertSortedUnique(authority.purge_item_ids, null, "purge_item_ids");
  }
}

function assertCleanupIssuanceAuthority(authority, { action, authoritySha256, taskId }) {
  assertExactKeys(
    authority,
    ["action", "authority_id", "issued_at", "issuer", "kind", "subject_sha256", "task_id"],
    "cleanup authority issuance",
  );
  assertIdentity(authority.action, "cleanup issuance action");
  assertIdentity(authority.authority_id, "cleanup issuance authority_id");
  assertTimestamp(authority.issued_at, "cleanup issuance issued_at");
  assertIdentity(authority.issuer, "cleanup issuance issuer");
  assertIdentity(authority.kind, "cleanup issuance kind");
  assertHash(authority.subject_sha256, "cleanup issuance subject_sha256");
  if (
    authority.action !== action ||
    authority.kind !== "owner" ||
    authority.subject_sha256 !== authoritySha256 ||
    authority.task_id !== taskId
  ) {
    fail("CLEANUP_AUTHORITY_ISSUANCE_INVALID", "Cleanup authority issuance does not bind the exact owner-authorized subject.", 4);
  }
}

function cleanupAuthorityReference(record) {
  return {
    authority_id: record.authority.authority_id,
    authority_sha256: record.authority_sha256,
    record_sha256: record.record_sha256,
    task_id: record.task_id,
  };
}

function resolveCleanupAuthority(root, reference, expectedKind) {
  assertExactKeys(
    reference,
    ["authority_id", "authority_sha256", "record_sha256", "task_id"],
    "cleanup authority reference",
  );
  assertIdentity(reference.authority_id, "cleanup authority reference authority_id");
  assertHash(reference.authority_sha256, "cleanup authority reference authority_sha256");
  assertHash(reference.record_sha256, "cleanup authority reference record_sha256");
  assertIdentity(reference.task_id, "cleanup authority reference task_id");
  const path = cleanupFile(root, reference.task_id, "authorities", `${reference.authority_id}.json`);
  if (!existsSync(path)) {
    fail("CLEANUP_AUTHORITY_UNRESOLVED", "The referenced cleanup authority record does not exist in canonical trusted state.", 4);
  }
  const record = parseStrictJson(readFileSync(path), "cleanup authority record");
  assertExactKeys(record, [
    "authority",
    "authority_kind",
    "authority_sha256",
    "issuance_authority",
    "record_sha256",
    "record_version",
    "recorded_at",
    "task_id",
  ], "cleanup authority record");
  if (record.record_version !== "cleanup-authority-record-v1" || record.authority_kind !== expectedKind) {
    fail("CLEANUP_AUTHORITY_UNRESOLVED", "The referenced cleanup authority has the wrong canonical kind or version.", 4);
  }
  assertTimestamp(record.recorded_at, "cleanup authority recorded_at");
  assertHash(record.authority_sha256, "cleanup authority_sha256");
  assertHash(record.record_sha256, "cleanup authority record_sha256");
  if (sha256Canonical(record.authority) !== record.authority_sha256) {
    fail("CLEANUP_AUTHORITY_UNRESOLVED", "The canonical cleanup authority payload hash is invalid.", 4);
  }
  assertCleanupIssuanceAuthority(record.issuance_authority, {
    action: `issue_cleanup_${record.authority_kind}_authority`,
    authoritySha256: record.authority_sha256,
    taskId: record.task_id,
  });
  assertSelfHash(record, "record_sha256", "CLEANUP_AUTHORITY_UNRESOLVED");
  const resolvedReference = cleanupAuthorityReference(record);
  if (canonicalJson(resolvedReference) !== canonicalJson(reference)) {
    fail("CLEANUP_AUTHORITY_UNRESOLVED", "Cleanup authority reference does not match the exact canonical record.", 4);
  }
  return { authority: structuredClone(record.authority), reference: resolvedReference };
}

function assertCleanupPlan(plan, expectedSha256) {
  assertExactKeys(plan, [
    "canonical_roots", "created_at", "holds", "items", "lifecycle", "plan_id", "plan_sha256", "plan_version",
    "policy_version", "runs", "shared_reachability", "snapshot_sha256", "task_id", "task_manifest_sha256", "ttl_hint",
  ], "cleanup plan");
  if (plan.plan_version !== "cleanup-plan-v1" || plan.plan_sha256 !== expectedSha256) {
    fail("CLEANUP_PLAN_INVALID", "Cleanup plan version or identity is invalid.", 3);
  }
  assertIdentity(plan.task_id, "cleanup plan task_id");
  assertHash(plan.task_manifest_sha256, "task_manifest_sha256");
  assertHash(plan.snapshot_sha256, "snapshot_sha256");
  if (plan.policy_version !== "retention-policy-v2" || plan.plan_id !== `cleanup-${plan.snapshot_sha256.slice(0, 24)}`) {
    fail("CLEANUP_PLAN_INVALID", "Cleanup plan policy or snapshot identity is invalid.", 3);
  }
  assertTimestamp(plan.created_at, "cleanup plan created_at");
  assertExactKeys(plan.lifecycle, ["state", "tail_sha256"], "cleanup plan lifecycle");
  if (!["active", "closed", "abandoned"].includes(plan.lifecycle.state)) fail("CLEANUP_PLAN_INVALID", "Cleanup lifecycle state is invalid.", 3);
  assertNullableHash(plan.lifecycle.tail_sha256, "lifecycle tail_sha256");
  assertExactKeys(plan.holds, ["active", "tail_sha256"], "cleanup plan holds");
  assertNullableHash(plan.holds.tail_sha256, "hold tail_sha256");
  if (!Array.isArray(plan.holds.active)) fail("CLEANUP_PLAN_INVALID", "Cleanup active holds are invalid.", 3);
  for (const hold of plan.holds.active) {
    assertExactKeys(hold, ["category", "hold_id"], "cleanup plan active hold");
    if (!holdCategories.includes(hold.category)) fail("CLEANUP_PLAN_INVALID", "Cleanup hold category is invalid.", 3);
    assertIdentity(hold.hold_id, "cleanup plan hold_id");
  }
  assertCanonicalOrder(plan.holds.active, "cleanup plan active holds");
  if (!Array.isArray(plan.runs)) fail("CLEANUP_PLAN_INVALID", "Cleanup plan runs are invalid.", 3);
  for (const run of plan.runs) {
    assertExactKeys(run, ["journal_tail_sha256", "manifest_sha256", "revision", "run_id"], "cleanup plan run");
    assertNullableHash(run.journal_tail_sha256, "run journal tail_sha256");
    assertHash(run.manifest_sha256, "run manifest_sha256");
    assertIdentity(run.run_id, "cleanup plan run_id");
    if (!Number.isInteger(run.revision) || run.revision < 0) fail("CLEANUP_PLAN_INVALID", "Cleanup run revision is invalid.", 3);
  }
  assertCanonicalOrder(plan.runs, "cleanup plan runs");
  assertPlanRoots(plan.canonical_roots);
  assertPlanItems(plan);
  assertExactKeys(plan.shared_reachability, ["object_count", "reachable_sha256", "root_sha256", "status"], "shared reachability");
  if (!Number.isInteger(plan.shared_reachability.object_count) || plan.shared_reachability.object_count < 0 || plan.shared_reachability.status !== "complete") {
    fail("CLEANUP_PLAN_INVALID", "Shared reachability status or object count is invalid.", 3);
  }
  for (const field of ["reachable_sha256", "root_sha256"]) {
    assertHashSet(plan.shared_reachability[field], `shared reachability ${field}`);
  }
  const objectHashes = plan.items.filter((item) => item.kind === "object").map((item) => item.artifact_sha256).sort(compareStrings);
  if (
    objectHashes.length !== plan.shared_reachability.object_count ||
    new Set(objectHashes).size !== objectHashes.length ||
    plan.shared_reachability.reachable_sha256.some((hash) => !objectHashes.includes(hash)) ||
    plan.shared_reachability.root_sha256.some((hash) => !plan.shared_reachability.reachable_sha256.includes(hash))
  ) fail("CLEANUP_PLAN_INVALID", "Shared reachability membership does not match the exact object inventory.", 3);
  const destructiveAllowed = plan.lifecycle.state !== "active" && plan.holds.active.length === 0;
  const reachable = new Set(plan.shared_reachability.reachable_sha256);
  for (const item of plan.items.filter((entry) => entry.kind === "object")) {
    const expected = destructiveAllowed && !reachable.has(item.artifact_sha256) ? "purge_eligible" : "retain";
    if (item.classification !== expected) fail("CLEANUP_PLAN_INVALID", "Object classification disagrees with retained-root reachability.", 3);
  }
  assertExactKeys(plan.ttl_hint, ["destructive_authority", "review_recommended", "threshold_ms"], "cleanup TTL hint");
  if (
    plan.ttl_hint.destructive_authority !== false ||
    typeof plan.ttl_hint.review_recommended !== "boolean" ||
    (plan.ttl_hint.threshold_ms !== null && (!Number.isInteger(plan.ttl_hint.threshold_ms) || plan.ttl_hint.threshold_ms < 0))
  ) fail("CLEANUP_PLAN_INVALID", "Cleanup TTL hint is invalid.", 3);
  const snapshot = {
    canonical_roots: plan.canonical_roots,
    holds: plan.holds,
    items: plan.items,
    lifecycle: plan.lifecycle,
    runs: plan.runs,
    shared_reachability: plan.shared_reachability,
    task_manifest_sha256: plan.task_manifest_sha256,
    ttl_hint: plan.ttl_hint,
  };
  if (sha256Canonical(snapshot) !== plan.snapshot_sha256) fail("CLEANUP_PLAN_INVALID", "Cleanup snapshot hash is invalid.", 3);
  const envelope = { ...plan };
  delete envelope.plan_sha256;
  if (sha256Canonical(envelope) !== plan.plan_sha256) fail("CLEANUP_PLAN_INVALID", "Cleanup plan hash is invalid.", 3);
}

function assertPlanRoots(roots) {
  if (!Array.isArray(roots)) fail("CLEANUP_PLAN_INVALID", "Cleanup canonical roots are invalid.", 3);
  const paths = [];
  for (const root of roots) {
    assertExactKeys(root, ["relative_path", "sha256"], "cleanup canonical root");
    assertRelativePath(root.relative_path, "cleanup canonical root path");
    assertHash(root.sha256, "cleanup canonical root sha256");
    paths.push(root.relative_path);
  }
  assertSortedUnique(paths, null, "cleanup canonical root paths");
}

function assertPlanItems(plan) {
  if (!Array.isArray(plan.items)) fail("CLEANUP_PLAN_INVALID", "Cleanup plan items are invalid.", 3);
  const ids = [];
  for (const item of plan.items) {
    assertExactKeys(item, [
      "artifact_sha256", "classification", "content_sha256", "dependency_artifact_sha256", "item_id", "kind", "reason", "relative_path", "run_id", "shadow",
    ], "cleanup plan item");
    if (!["retain", "quarantine", "purge_eligible"].includes(item.classification) || !["derived_view", "object", "shadow"].includes(item.kind)) {
      fail("CLEANUP_PLAN_INVALID", "Cleanup item classification or kind is invalid.", 3);
    }
    assertIdentity(item.item_id, "cleanup item_id");
    assertIdentity(item.reason, "cleanup item reason");
    if (item.artifact_sha256 !== null) assertHash(item.artifact_sha256, "cleanup artifact_sha256");
    if (item.content_sha256 !== null) assertHash(item.content_sha256, "cleanup content_sha256");
    assertHashSet(item.dependency_artifact_sha256, "cleanup item dependency hashes");
    if (item.kind !== "object" && item.dependency_artifact_sha256.length !== 0) {
      fail("CLEANUP_PLAN_INVALID", "Only object items may bind artifact dependencies.", 3);
    }
    if (item.relative_path !== null) assertRelativePath(item.relative_path, "cleanup item relative_path");
    if (item.run_id !== null) assertIdentity(item.run_id, "cleanup item run_id");
    if (item.kind === "shadow") {
      assertExactKeys(item.shadow, ["attempt_id", "run_id", "task_id", "thread_id"], "cleanup shadow identity");
      for (const field of ["attempt_id", "run_id", "task_id"]) assertIdentity(item.shadow[field], `cleanup shadow ${field}`);
      if (item.shadow.thread_id !== null) assertIdentity(item.shadow.thread_id, "cleanup shadow thread_id");
      if (item.shadow.task_id !== plan.task_id || !plan.runs.some((run) => run.run_id === item.shadow.run_id)) {
        fail("CLEANUP_PLAN_INVALID", "Cleanup shadow identity is outside the exact task/run scope.", 3);
      }
    } else if (item.shadow !== null) fail("CLEANUP_PLAN_INVALID", "Only shadow items may carry shadow identity.", 3);
    const identity = {
      artifact_sha256: item.artifact_sha256,
      content_sha256: item.content_sha256,
      dependency_artifact_sha256: item.dependency_artifact_sha256,
      kind: item.kind,
      relative_path: item.relative_path,
      run_id: item.run_id,
      shadow: item.shadow,
    };
    if (item.item_id !== `item-${sha256Canonical(identity).slice(0, 24)}`) fail("CLEANUP_PLAN_INVALID", "Cleanup item identity is invalid.", 3);
    ids.push(item.item_id);
  }
  assertSortedUnique(ids, null, "cleanup item ids");
  if ((plan.lifecycle.state === "active" || plan.holds.active.length > 0) && plan.items.some((item) => item.classification !== "retain")) {
    fail("CLEANUP_PLAN_INVALID", "Active or held tasks cannot contain destructive classifications.", 3);
  }
  orderCleanupItems(plan.items.filter((item) => item.classification !== "retain"));
}

function assertLifecycleEvent(event, { previous, sequence, state, task }) {
  assertExactKeys(event, [
    "authority", "basis", "basis_identity", "event_sha256", "next_state", "occurred_at", "prior_event_sha256",
    "prior_state", "sequence", "task_id",
  ], "lifecycle event");
  if (event.task_id !== task.artifact_id || event.sequence !== sequence || event.prior_event_sha256 !== previous || event.prior_state !== state) {
    fail("TASK_LIFECYCLE_CORRUPT", "Task lifecycle sequence, prior state, or ownership is invalid.", 3);
  }
  if (state !== "active" || !["closed", "abandoned"].includes(event.next_state)) {
    fail("TASK_LIFECYCLE_CORRUPT", "Task lifecycle contains an invalid transition.", 3);
  }
  if (!lifecycleBases.includes(event.basis) || (event.basis === "owner_abandoned") !== (event.next_state === "abandoned")) {
    fail("TASK_LIFECYCLE_CORRUPT", "Task lifecycle basis does not match its transition.", 3);
  }
  assertAuthorityBinding(event.authority);
  const requiredAuthorityKind = event.basis === "task_bound_pr_merge" ? "task_aware_workflow" : "owner";
  if (event.authority.kind !== requiredAuthorityKind) fail("TASK_LIFECYCLE_CORRUPT", "Lifecycle authority kind does not match its basis.", 3);
  assertBasisIdentity(event.basis, event.basis_identity, task);
  assertTimestamp(event.occurred_at, "lifecycle occurred_at");
  assertSelfHash(event, "event_sha256", "TASK_LIFECYCLE_CORRUPT");
}

function assertHoldEvent(event, { previous, sequence, taskId }) {
  assertExactKeys(event, [
    "action", "authority", "category", "event_sha256", "hold_id", "occurred_at", "prior_event_sha256", "reason",
    "sequence", "task_id",
  ], "hold event");
  if (event.task_id !== taskId || event.sequence !== sequence || event.prior_event_sha256 !== previous) {
    fail("CLEANUP_HOLD_CORRUPT", "Cleanup hold sequence or ownership is invalid.", 3);
  }
  if (!["place", "release"].includes(event.action) || !holdCategories.includes(event.category)) {
    fail("CLEANUP_HOLD_CORRUPT", "Cleanup hold action or category is invalid.", 3);
  }
  assertIdentity(event.hold_id, "hold_id");
  assertReason(event.reason, "hold reason");
  assertAuthorityBinding(event.authority);
  if (!["owner", "task_aware_workflow"].includes(event.authority.kind)) {
    fail("CLEANUP_HOLD_CORRUPT", "Cleanup hold authority kind is invalid.", 3);
  }
  assertTimestamp(event.occurred_at, "hold occurred_at");
  assertSelfHash(event, "event_sha256", "CLEANUP_HOLD_CORRUPT");
}

function assertBasisIdentity(basis, identity, task) {
  if (basis === "task_bound_pr_merge") {
    assertExactKeys(identity, ["event_id", "merge_commit", "merge_result", "merged_at", "merged_head_commit", "pull_request", "repository"], "merge basis");
    assertIdentity(identity.event_id, "merge event_id");
    assertCommit(identity.merge_commit, "merge_commit");
    assertCommit(identity.merged_head_commit, "merged_head_commit");
    if (identity.merge_result !== "successful") fail("TASK_LIFECYCLE_INVALID", "Automatic close requires a successful merge.", 4);
    assertTimestamp(identity.merged_at, "merged_at");
    assertBoundedText(identity.pull_request, "pull_request");
    assertBoundedText(identity.repository, "repository");
    if (task.payload.provenance.pull_request !== null && task.payload.provenance.pull_request !== identity.pull_request) {
      fail("TASK_PR_BINDING_INVALID", "Task-aware merge does not match immutable task PR provenance.", 4);
    }
    return;
  }
  if (basis === "owner_reconciled_close") {
    assertExactKeys(identity, ["decision_id", "merge_commit", "merged_head_commit", "pull_request", "reason", "repository"], "reconciled close basis");
    assertIdentity(identity.decision_id, "decision_id");
    assertCommit(identity.merge_commit, "merge_commit");
    assertCommit(identity.merged_head_commit, "merged_head_commit");
    assertBoundedText(identity.pull_request, "pull_request");
    assertBoundedText(identity.repository, "repository");
    assertReason(identity.reason, "reconciliation reason");
    return;
  }
  if (basis === "owner_abandoned") {
    assertExactKeys(identity, ["decision_id", "reason"], "abandon basis");
    assertIdentity(identity.decision_id, "decision_id");
    assertReason(identity.reason, "abandon reason");
    return;
  }
  fail("TASK_LIFECYCLE_INVALID", "Task lifecycle basis is unsupported.");
}

function assertAuthorityInput(authority, { action, taskId }) {
  assertExactKeys(authority, ["action", "authority_id", "issued_at", "issuer", "kind", "task_id"], "task authority");
  assertIdentity(authority.action, "authority action");
  assertIdentity(authority.authority_id, "authority_id");
  assertIdentity(authority.issuer, "authority issuer");
  assertIdentity(authority.kind, "authority kind");
  assertTimestamp(authority.issued_at, "authority issued_at");
  if (authority.action !== action || authority.task_id !== taskId) fail("TASK_AUTHORITY_INVALID", "Task authority scope is invalid.", 4);
}

function authorityBinding(authority) {
  return {
    authority_id: authority.authority_id,
    authority_sha256: sha256Canonical(authority),
    issuer: authority.issuer,
    kind: authority.kind,
  };
}

function assertAuthorityBinding(authority) {
  assertExactKeys(authority, ["authority_id", "authority_sha256", "issuer", "kind"], "authority binding");
  assertIdentity(authority.authority_id, "authority_id");
  assertHash(authority.authority_sha256, "authority_sha256");
  assertIdentity(authority.issuer, "authority issuer");
  assertIdentity(authority.kind, "authority kind");
}

function walkLegacy(root, directory, output) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => compareStrings(a.name, b.name))) {
    const path = resolve(directory, entry.name);
    const relativePath = relative(root, path).split(sep).join("/");
    if (entry.isSymbolicLink()) {
      output.push({ artifact_type: null, bytes_sha256: null, relative_path: relativePath, status: "unsupported" });
      continue;
    }
    if (entry.isDirectory()) {
      walkLegacy(root, path, output);
      continue;
    }
    if (!entry.isFile()) {
      output.push({ artifact_type: null, bytes_sha256: null, relative_path: relativePath, status: "unsupported" });
      continue;
    }
    let bytes;
    try {
      bytes = readFileSync(path);
    } catch {
      output.push({ artifact_type: null, bytes_sha256: null, relative_path: relativePath, status: "unreadable" });
      continue;
    }
    let artifactType = null;
    let status = "unsupported";
    if (entry.name.endsWith(".json")) {
      try {
        const value = parseStrictJson(bytes, "legacy v1 artifact");
        if (value?.schema_version === 1 && typeof value.artifact_type === "string") {
          artifactType = value.artifact_type;
          status = "readable";
        }
      } catch {
        status = "unreadable";
      }
    }
    output.push({ artifact_type: artifactType, bytes_sha256: sha256Bytes(bytes), relative_path: relativePath, status });
  }
}

function assertShadowCapability(items, adapter) {
  if (!items.some((item) => item.kind === "shadow")) return;
  if (
    adapter?.kind !== "deterministic_mock_shadow_cleanup" ||
    typeof adapter.inspect !== "function" ||
    typeof adapter.apply !== "function" ||
    typeof adapter.reconcile !== "function"
  ) fail("SHADOW_CAPABILITY_UNAVAILABLE", "CP8B permits only an injected deterministic mock shadow cleanup adapter.", 4);
}

function assertAllowedActions(actual, required, code) {
  for (const action of required) if (!actual.includes(action)) fail(code, `Cleanup authority does not allow '${action}'.`, 4);
}

function assertSameAuthority(left, right) {
  if (canonicalJson(left) !== canonicalJson(right)) fail("CLEANUP_AUTHORITY_CONFLICT", "Operation identity cannot adopt another authority.", 4);
}

function assertSealedRecord(record, hashField, version) {
  const versionField = hashField === "apply_sha256" ? "apply_version" : "purge_version";
  if (record?.[versionField] !== version) fail("CLEANUP_RECORD_CORRUPT", "Cleanup record version is invalid.", 3);
  assertSelfHash(record, hashField, "CLEANUP_RECORD_CORRUPT");
}

function sealRecord(envelope, hashField) {
  return { ...envelope, [hashField]: sha256Canonical(envelope) };
}

function assertSelfHash(record, field, code) {
  assertHash(record[field], field);
  const envelope = { ...record };
  delete envelope[field];
  if (sha256Canonical(envelope) !== record[field]) fail(code, `${field} does not match canonical record bytes.`, 3);
}

function assertSortedUnique(values, allowed, label) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) fail("CLEANUP_AUTHORITY_INVALID", `${label} must be strings.`);
  const sorted = [...values].sort(compareStrings);
  if (canonicalJson(values) !== canonicalJson(sorted) || new Set(values).size !== values.length) {
    fail("CLEANUP_AUTHORITY_INVALID", `${label} must be sorted and unique.`);
  }
  if (allowed && values.some((value) => !allowed.includes(value))) fail("CLEANUP_AUTHORITY_INVALID", `${label} contains an unsupported action.`);
}

function readJsonLines(path, label) {
  if (!existsSync(path)) return [];
  const bytes = readFileSync(path, "utf8");
  if (bytes.length === 0 || !bytes.endsWith("\n")) fail("STORE_RECORD_CORRUPT", `${label} is not newline-terminated.`, 3);
  return bytes.trimEnd().split("\n").map((line) => parseStrictJson(Buffer.from(`${line}\n`, "utf8"), label));
}

function eventsBytes(events) {
  return events.map((event) => `${JSON.stringify(event)}\n`).join("");
}

function writeImmutable(path, bytes) {
  if (existsSync(path)) {
    if (readFileSync(path, "utf8") !== bytes) fail("STORE_RECORD_IMMUTABLE", "Immutable cleanup record conflicts with existing bytes.", 3);
    return;
  }
  writeAtomic(path, bytes, { exclusive: true });
}

function writeAtomic(path, bytes, options = {}) {
  mkdirSync(dirname(path), { recursive: true });
  if (options.exclusive && existsSync(path)) fail("STORE_RECORD_EXISTS", "Exclusive cleanup record already exists.", 3);
  const temporary = resolve(dirname(path), `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`);
  let descriptor;
  try {
    descriptor = openSync(temporary, "wx");
    writeFileSync(descriptor, bytes, "utf8");
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    if (options.exclusive && existsSync(path)) fail("STORE_RECORD_EXISTS", "Exclusive cleanup record already exists.", 3);
    renameSync(temporary, path);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
    if (existsSync(temporary)) rmSync(temporary);
  }
}

function hashFile(path) {
  assertRegularFile(path, "cleanup item");
  return sha256Bytes(readFileSync(path));
}

function assertRegularFile(path, label) {
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) fail("STORE_PATH_INVALID", `${label} must be a regular file.`, 3);
}

function listEntityIds(root, kind) {
  const directory = containedPath(root, kind);
  if (!existsSync(directory)) return [];
  const entries = readdirSync(directory, { withFileTypes: true });
  if (entries.some((entry) => !entry.isDirectory() || entry.isSymbolicLink())) fail("STORE_LAYOUT_INVALID", `${kind} contains a non-directory entry.`, 3);
  return entries.map((entry) => entry.name).sort(compareStrings);
}

function taskFile(root, taskId, ...segments) {
  assertIdentity(taskId, "taskId");
  return containedPath(root, "tasks", taskId, ...segments);
}

function cleanupFile(root, taskId, ...segments) {
  return taskFile(root, taskId, "cleanup", ...segments);
}

function quarantinePath(root, plan, item) {
  return containedPath(root, "quarantine", plan.task_id, plan.plan_sha256, item.item_id, basename(item.relative_path));
}

function objectRelativePath(hash) {
  return `objects/${hash.slice(0, 2)}/${hash}/artifact.json`;
}

function relativeStorePath(root, path) {
  return relative(resolve(root), resolve(path)).split(sep).join("/");
}

function containedPath(root, ...segments) {
  const base = resolve(root);
  const candidate = resolve(base, ...segments);
  const relation = relative(base, candidate);
  if (relation === "" || relation.startsWith("..") || isAbsolute(relation)) fail("STORE_PATH_INVALID", "Retention path escaped its store root.");
  return candidate;
}

function assertExactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("STORE_RECORD_INVALID", `${label} must be an object.`);
  if (canonicalJson(Object.keys(value).sort()) !== canonicalJson([...keys].sort())) {
    fail("STORE_RECORD_INVALID", `${label} fields are invalid.`);
  }
}

function assertIdentity(value, label) {
  if (typeof value !== "string" || !/^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/.test(value)) {
    fail("STORE_IDENTITY_INVALID", `${label} must be a normalized identity.`);
  }
}

function assertHash(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail("STORE_HASH_INVALID", `${label} must be lowercase sha256.`);
}

function assertNullableHash(value, label) {
  if (value !== null) assertHash(value, label);
}

function assertCanonicalOrder(values, label) {
  if (canonicalJson(values) !== canonicalJson([...values].sort(compareByCanonical))) {
    fail("CLEANUP_PLAN_INVALID", `${label} must be canonically sorted.`, 3);
  }
}

function assertHashSet(values, label) {
  if (!Array.isArray(values)) fail("CLEANUP_PLAN_INVALID", `${label} must be an array.`, 3);
  for (const value of values) assertHash(value, label);
  if (canonicalJson(values) !== canonicalJson([...new Set(values)].sort(compareStrings))) {
    fail("CLEANUP_PLAN_INVALID", `${label} must be sorted and unique.`, 3);
  }
}

function assertRelativePath(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\\") ||
    value.includes(":") ||
    value.split("/").some((segment) => segment === "" || segment === "." || segment === "..") ||
    isAbsolute(value)
  ) fail("CLEANUP_PLAN_INVALID", `${label} must be a normalized contained relative path.`, 3);
}

function assertCommit(value, label) {
  if (typeof value !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value)) fail("TASK_LIFECYCLE_INVALID", `${label} must be an exact commit hash.`);
}

function assertTimestamp(value, label) {
  const parsed = typeof value === "string" ? new Date(value) : new Date(Number.NaN);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) fail("STORE_TIMESTAMP_INVALID", `${label} is invalid.`);
  return value;
}

function assertBoundedText(value, label) {
  if (typeof value !== "string" || value.length === 0 || value.length > 512 || /[\u0000-\u001f\u007f]/.test(value)) {
    fail("TASK_LIFECYCLE_INVALID", `${label} is invalid.`);
  }
}

function assertReason(value, label) {
  assertBoundedText(value, label);
}

function compareByCanonical(left, right) {
  return compareStrings(canonicalJson(left), canonicalJson(right));
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(code, message, exitCode = 1) {
  throw new HarnessError(code, message, exitCode);
}
