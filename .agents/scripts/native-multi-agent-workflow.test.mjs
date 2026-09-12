// Test plan:
// - Mục tiêu: khóa Owner admission, session continuity, managed E2E, durable ownership và author-side closure.
// - Loại test: Node static contract test trên các skill/reference sở hữu hành vi.
// - Case thành công:
//   - Admission, session reuse, bốn role E2E và durable owner partition giữ đúng canonical source.
// - Case thất bại:
//   - Chặn unavailable suy diễn, plan drift sai route, duplicate live state và handoff thiếu semantic closure.
// - Bảo mật/phân quyền:
//   - Owner giữ GOAL Revision; Reviewer PASS không cấp approval, implementation hoặc Git authority.
// - Ổn định/resilience:
//   - Giữ correction budget riêng cho plan/implementation/drift, running-role synchronization và stable progress.
// - Invariant cần giữ:
//   - Không tạo durable package registry, competing review/state-machine owner hay custom orchestration runtime.
// - Kết quả verify gần nhất: passed 28 tests bằng `node --test .agents/scripts/native-multi-agent-workflow.test.mjs` trên Node v24.11.1.
// - Ghi chú: static contract test không phải native rehearsal, manual QA hay bằng chứng model behavior.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..", "..");
const rootInstructions = readFileSync(resolve(repositoryRoot, "AGENTS.md"), "utf8");
const lifecycleLoops = readFileSync(resolve(repositoryRoot, "docs", "agent-loops.md"), "utf8");
const bundleRoot = resolve(scriptDirectory, "..", "skills", "native-multi-agent-workflow");
const core = readFileSync(resolve(bundleRoot, "SKILL.md"), "utf8");
const ownerSource = readFileSync(
  resolve(bundleRoot, "references", "owner-source-and-steering.md"),
  "utf8",
);
const reconciliation = readFileSync(
  resolve(bundleRoot, "references", "review-artifact-and-reconciliation.md"),
  "utf8",
);
const scenarios = readFileSync(resolve(bundleRoot, "references", "verification-scenarios.md"), "utf8");
const nativeMasterPlan = readFileSync(resolve(repositoryRoot, "docs", "native-multi-agent", "plan.md"), "utf8");
const nativeProgress = readFileSync(resolve(repositoryRoot, "docs", "native-multi-agent", "progress.md"), "utf8");
const implementationPlanIndex = readFileSync(
  resolve(repositoryRoot, "docs", "native-multi-agent", "implementation-plans", "README.md"),
  "utf8",
);
const planningRoot = resolve(
  repositoryRoot,
  ".agents",
  "skills",
  "implementation-planning-and-pr-breakdown",
);
const planningCore = readFileSync(resolve(planningRoot, "SKILL.md"), "utf8");
const e2ePlanning = readFileSync(
  resolve(planningRoot, "references", "multi-agent-e2e-workflow.md"),
  "utf8",
);
const trackedProgram = readFileSync(
  resolve(planningRoot, "references", "tracked-program-and-durable-plan.md"),
  "utf8",
);
const masterPlanWorkflow = readFileSync(
  resolve(planningRoot, "references", "master-plan-workflow.md"),
  "utf8",
);
const maintainCore = readFileSync(
  resolve(repositoryRoot, ".agents", "skills", "maintain-repo-skills", "SKILL.md"),
  "utf8",
);
const reviewRoot = resolve(repositoryRoot, ".agents", "skills", "code-review-and-quality");
const reviewCore = readFileSync(resolve(reviewRoot, "SKILL.md"), "utf8");
const managedReview = readFileSync(
  resolve(reviewRoot, "references", "managed-lifecycle-review.md"),
  "utf8",
);
const testCore = readFileSync(
  resolve(repositoryRoot, ".agents", "skills", "test-quality-strategy", "SKILL.md"),
  "utf8",
);
const gitCore = readFileSync(
  resolve(repositoryRoot, ".agents", "skills", "git-checkpoint-workflow", "SKILL.md"),
  "utf8",
);

test("closes established deterministic failures before Reviewer dispatch", () => {
  assert.match(core, /deterministic pre-review closure/);
  assert.match(core, /without duplicate execution/);
  assert.match(reconciliation, /encoding, consistent EOL, final newline, exact status literals/);
  assert.match(reconciliation, /do not rerun an unchanged passing check merely to duplicate evidence/);
  assert.match(scenarios, /Return to the owning writer before Reviewer dispatch; no review\/correction round consumed/);
});

test("blocks findings by material impact instead of artifact type", () => {
  const materialBoundary = /authority, routing\/state transition, ownership\/source of truth, candidate identity, acceptance\/verification, or completion truth/;
  assert.match(core, materialBoundary);
  assert.match(reconciliation, /Finding severity is artifact-neutral/);
  assert.match(scenarios, /Cosmetic or historical wording has no material causal path/);
});

test("requires root-cause closure and bounds focused rereview", () => {
  assert.match(core, /corrects the governing invariant and scans the full candidate/);
  assert.match(reconciliation, /previous findings, per-finding dispositions, the exact correction diff/);
  assert.match(scenarios, /Repeat the full review package/);
});

test("records completion without a self-staling progress reference", () => {
  assert.match(core, /tracker never records its own commit hash/);
  assert.match(reconciliation, /Git history supplies the progress-only commit identity/);
  assert.match(scenarios, /never its own hash or `pending this checkpoint`/);
});

test("retains exact role-session continuity after the role leaves the active listing", () => {
  assert.match(core, /disappearing from an active-role listing/);
  assert.match(core, /completing an individual review episode does not retire/);
  assert.match(core, /until the enclosing managed workflow reaches its terminal state/);
  assert.match(reconciliation, /finished, completed, idle, non-running, or absent from `list_agents`/);
  assert.match(reconciliation, /episode `PASS`\/completion describes only/);
  assert.match(reconciliation, /same-session resume or follow-up succeeds/);
  assert.match(scenarios, /MUST NOT emit `BLOCKED\(session_unavailable\)`/);
  assert.match(scenarios, /through managed-workflow terminal state/);
  assert.match(scenarios, /Implementor reports `PLAN_CONTRACT_MISMATCH`/);
  assert.match(scenarios, /Main resumes the exact original Planner/);
  assert.match(scenarios, /exact original Plan Reviewer/);
  assert.match(nativeMasterPlan, /Main giữ working tree, không revert, và gửi mismatch tới same Planner session/);
  assert.match(nativeMasterPlan, /Main gửi corrected candidate tới same Plan Reviewer session/);
  assert.match(nativeMasterPlan, /managed_role_session_ids/);
  assert.match(reconciliation, /managed_role_session_ids/);
  assert.doesNotMatch(reconciliation, /active_role_thread_ids|managed_role_session_identities/);
  assert.doesNotMatch(nativeMasterPlan, /active_role_thread_ids/);
  assert.doesNotMatch(core, /workflow or episode reaches its terminal state/);
});

test("blocks for session unavailability only after exact identity recovery or native rejection", () => {
  assert.match(core, /exact stored managed-role session identity/);
  assert.match(reconciliation, /genuinely cannot be recovered or retrieved/);
  assert.match(reconciliation, /runtime explicitly rejects.*as unavailable/);
  assert.match(scenarios, /Only then may Main emit `BLOCKED\(session_unavailable\)`/);
  assert.match(scenarios, /usage quota.*different exact blocker/);
});

test("partitions durable documents without duplicating live workflow state", () => {
  for (const source of [maintainCore, trackedProgram]) {
    assert.match(source, /Master Plan.*semantic architecture/);
    assert.match(source, /phase.*plan.*stable.*execution contract/i);
    assert.match(source, /owner-review brief.*material Owner decisions.*approval identity/i);
    assert.match(source, /progress.*concise.*current truth.*stable completion evidence/i);
    assert.match(source, /ephemeral.*Owner Source Package.*role\/session.*review round/i);
  }
  assert.match(implementationPlanIndex, /không sở hữu live lifecycle status/i);
  assert.match(nativeMasterPlan, /baseline findings.*historical rationale/i);
  assert.doesNotMatch(nativeProgress, /owner_input_revision|review_round|SHA-256|\/reviews\/|thread `01/);
});

test("requires bounded author-side closure before cumulative review", () => {
  assert.match(core, /bounded author-side handoff closure/);
  assert.match(reconciliation, /## Author-side handoff closure/);
  assert.match(reconciliation, /Consumer → owner closure/);
  assert.match(reconciliation, /Acceptance → evidence closure/);
  assert.match(reconciliation, /Prompt-leakage check/);
  assert.match(reconciliation, /does not create another Reviewer, role, session, lifecycle, or verdict/);
  assert.match(masterPlanWorkflow, /delegated canonical owner actually contains the required contract/);
  assert.match(scenarios, /phase-specific prompt supplies semantics that the reusable repository contract must own/);
});

test("admits a synthetic non-contiguous Owner package by its declared membership", () => {
  assert.match(scenarios, /record revision `7` declares non-contiguous `\[fixture-owner-2, fixture-owner-5\]`/);
  assert.match(ownerSource, /does not imply contiguous `owner-1\.\.N` membership/);
  assert.match(ownerSource, /exact-compares that echo with the declared set/);
  assert.match(scenarios, /excluded ended entries are not required/);
});

test("blocks missing, truncated, reordered, unreadable, or incomplete included entries", () => {
  assert.match(ownerSource, /declared included entry that is missing, truncated, reordered, unreadable, or coverage-incomplete returns `BLOCKED\(owner_input_unavailable\)`/);
  assert.match(scenarios, /Declared included entry missing, truncated, reordered, unreadable, or coverage-incomplete/);
});

test("rejects supersession-only exclusion of an interpretively relevant Owner entry", () => {
  assert.match(ownerSource, /supersession alone is insufficient/);
  assert.match(scenarios, /Reject the projection; retain the entry needed to understand/);
  assert.match(ownerSource, /Never persist the inclusion\/exclusion decision as a manifest, registry, database, or provenance service/);
});

test("rejects vague GOALs and implementation mechanisms inside the GOAL", () => {
  assert.match(masterPlanWorkflow, /Write the GOAL before mechanisms/);
  assert.match(masterPlanWorkflow, /Reject vague acceptance/);
  assert.match(masterPlanWorkflow, /no implementation mechanism leaks into GOAL/);
});

test("treats a missing lineage edge as blocking rather than unaffected", () => {
  assert.match(masterPlanWorkflow, /Missing an edge is not evidence of `unaffected`/);
  assert.match(masterPlanWorkflow, /Every Owner requirement has a forward trace/);
  assert.match(masterPlanWorkflow, /every material mechanism has a necessary backward trace/);
});

test("requires positive evidence before claiming a lineage node is unaffected", () => {
  assert.match(masterPlanWorkflow, /use `unaffected` only with positive evidence, otherwise keep `needs_review`/);
  assert.match(masterPlanWorkflow, /`unaffected` claim.*current evidence or remains visibly `needs_review`/);
});

test("reserves semantic GOAL changes and GOAL Revision for the Owner", () => {
  assert.match(masterPlanWorkflow, /Only the Owner may approve a semantic change/);
  assert.match(masterPlanWorkflow, /increment `GOAL Revision`/);
  assert.match(masterPlanWorkflow, /returns `OWNER_DECISION_REQUIRED`; it does not rewrite the GOAL/);
});

test("routes materially ambiguous Owner input through the Main-owned Owner gate", () => {
  assert.match(masterPlanWorkflow, /`BLOCKED\(ambiguous_owner_intent\)` and Main opens the Owner gate/);
  assert.match(ownerSource, /opens the Owner gate instead of selecting an interpretation/);
});

test("pauses lower work and recommends read-only correction for a closed Master Plan mismatch", () => {
  assert.match(planningCore, /closed Master Plan routes through read-only Master Plan Correction and Owner disposition/);
  assert.match(masterPlanWorkflow, /lower work pauses/);
  assert.match(masterPlanWorkflow, /does not edit the canonical plan or resume implementation; the Owner decides disposition/);
});

test("operationalizes staged Master Plan review in the native reconciliation owner", () => {
  assert.match(planningCore, /Master Plan Reviewer `PASS` ends reviewed planning only/);
  assert.match(masterPlanWorkflow, /Stage R-A\/R-B, the six canonical review dimensions/);
  assert.match(reconciliation, /Stage R-A — independent baseline/);
  assert.match(reconciliation, /withholding the candidate content and candidate ref from the model-visible payload/);
  assert.match(reconciliation, /Owner outcome, protected invariants, explicit exclusions, authority boundaries, material ambiguities/);
  assert.match(reconciliation, /expected ownership and lifecycle properties, and relevant repository facts or source conflicts/);
  assert.match(reconciliation, /exact status `BASELINE_READY`/);
  assert.match(reconciliation, /`BLOCKED\(review_baseline_contaminated\)`/);
  assert.match(reconciliation, /do not claim strict filesystem isolation/);
  assert.match(reconciliation, /same Reviewer session receives the exact candidate ref, content, and revision/);
  for (const dimension of [
    "Owner-intent fidelity",
    "Repository reality and ownership",
    "Bidirectional traceability and necessity",
    "Lifecycle integrity",
    "Correctness, liveness and boundedness",
    "Implementability, phase verification and simplicity",
  ]) {
    assert.match(reconciliation, new RegExp(dimension));
  }
  assert.match(reconciliation, /`PASS` only when all six dimensions are complete/);
  assert.match(reconciliation, /`BLOCKING_FINDINGS` when a material defect is within candidate\/author control/);
  assert.match(reconciliation, /`BLOCKED` when external context or evidence is unavailable/);
  assert.match(reconciliation, /`BLOCKED\(ambiguous_owner_intent\)`; Main alone opens `OWNER_DECISION_REQUIRED`/);
  assert.match(reconciliation, /violated source or contract → triggering scenario → exact failed transition or claim/);
  assert.match(reconciliation, /Preference, reversible implementation detail, an out-of-scope theoretical threat/);
  assert.match(reconciliation, /Master Plan Reviewer `PASS` ends reviewed planning only/);
  assert.match(reconciliation, /not Owner approval and grants no implementation, Git, remote/);
});

test("routes fresh readers from root to the serialized four-role E2E owners", () => {
  assert.match(rootInstructions, /native-multi-agent-workflow\/SKILL\.md.*`MULTI_AGENT_E2E`/s);
  assert.match(lifecycleLoops, /When either managed mode is selected, read `native-multi-agent-workflow`/);
  assert.match(core, /Fresh Planner, Plan Reviewer, Implementor, and Implementation Reviewer/);
  assert.match(planningCore, /references\/multi-agent-e2e-workflow\.md/);
  assert.match(reviewCore, /references\/managed-lifecycle-review\.md/);
  assert.match(testCore, /Test user intent and system guarantees/);
  assert.match(gitCore, /Commit only after the owner explicitly asks for or approves a commit/);
});

test("makes managed detailed planning directly routed and transferable", () => {
  assert.match(planningCore, /When `MULTI_AGENT_E2E` is selected/);
  assert.match(planningCore, /mandatory Plan Reviewer.*admitted `PASS`/s);
  assert.match(planningCore, /current implementation authority/);
  assert.match(e2ePlanning, /task-local lineage delta/);
  assert.match(e2ePlanning, /exact and forbidden paths\/domains/);
  assert.match(e2ePlanning, /Acceptance criteria and evidence mapping/);
  assert.match(e2ePlanning, /Accepted-plan implementation handoff/);
  assert.match(e2ePlanning, /never edits the plan/);
  assert.match(e2ePlanning, /Static source or link checks do not prove live orchestration/);
});

test("routes detailed-plan and closed Master Plan mismatches without lower-layer repair", () => {
  assert.match(e2ePlanning, /On `PLAN_CONTRACT_MISMATCH`/);
  assert.match(e2ePlanning, /resumes the exact original Planner/);
  assert.match(e2ePlanning, /exact original Plan Reviewer/);
  assert.match(e2ePlanning, /Planner verifies that the conflict reaches the upstream contract.*`MASTER_PLAN_CONTRACT_MISMATCH`/s);
  assert.match(e2ePlanning, /fresh read-only Master Plan Correction recommendation/);
  assert.match(e2ePlanning, /does not edit the canonical plan or resume implementation/);
  assert.match(reconciliation, /no lower role edits the canonical semantic root/);
});

test("keeps Plan Reviewer and Implementation Reviewer mandatory and independent from Specialist", () => {
  assert.match(reviewCore, /Plan Reviewer and Implementation Reviewer are mandatory lifecycle roles/);
  assert.match(reviewCore, /regardless of whether any Specialist is justified/);
  assert.match(managedReview, /Optional Specialist consultation defaults to `0`/);
  assert.match(managedReview, /never replaces a required dimension, finding, or verdict/);
  assert.match(managedReview, /## Plan Reviewer dimensions/);
  assert.match(managedReview, /## Implementation Reviewer dimensions/);
});

test("maps managed review results without weakening evidence or manual QA", () => {
  assert.match(managedReview, /Artifact presence, a passing command, or absence of discovered defects is not by itself lifecycle `PASS`/);
  assert.match(managedReview, /unavailable, skipped, stale, partial, manual, and environment-limited evidence/);
  assert.match(scenarios, /Human verdict is `Implementation review passed; manual QA pending`/);
  assert.match(scenarios, /Never map to managed `PASS`/);
  assert.match(scenarios, /Human verdict is `Approved` with all mandatory dimensions\/evidence complete/);
  assert.match(scenarios, /Main still separately checks authority/);
});

test("separates plan, implementation, and independent drift correction episodes", () => {
  assert.match(reconciliation, /Detailed-plan candidate.*Same Planner and same Plan Reviewer/s);
  assert.match(reconciliation, /Implementation candidate.*Same Implementor and same Implementation Reviewer/s);
  assert.match(reconciliation, /Independent later plan drift.*distinct causal issue family/s);
  assert.match(reconciliation, /same root cause cannot reset by renaming/);
  assert.match(scenarios, /rounds `1` and `2` are bounded independently from implementation/);
  assert.match(scenarios, /rounds `1` and `2` do not consume or reset the plan budget/);
  assert.match(scenarios, /no automatic round `3` or replacement Reviewer/);
});

test("composes all Owner change classes with the most restrictive stop", () => {
  for (const label of [
    "clarification",
    "detailed-plan change",
    "authority-only change",
    "GOAL/invariant/scope change",
    "prior-work disposition",
  ]) {
    assert.match(scenarios, new RegExp(`Later Owner ${label}`, "i"));
  }
  assert.match(scenarios, /One Owner entry spans multiple classes/);
  assert.match(scenarios, /Apply every route and the most restrictive stop/);
  assert.match(reconciliation, /Classify every later Owner entry through the Owner-source-and-steering owner/);
});

test("requires running Implementor grants and revocations to cross the hard synchronization boundary", () => {
  assert.match(scenarios, /Running Implementor receives a new grant/);
  assert.match(scenarios, /Grant is non-retroactive and unusable until interrupt\/quiesce/);
  assert.match(scenarios, /completed\/in-flight\/partial\/unacknowledged state audit/);
  assert.match(scenarios, /Running Implementor receives a revocation/);
  assert.match(scenarios, /revocation does not undo it/);
  assert.match(scenarios, /live message or follow-up reports successful delivery/);
  assert.match(scenarios, /protected action remains blocked/);
  assert.match(reconciliation, /Live delivery alone never closes this boundary/);
});

test("keeps exact review artifacts and uncommitted managed candidates current", () => {
  assert.match(managedReview, /Write only the exact artifact assigned by Main/);
  assert.match(managedReview, /For an uncommitted managed candidate/);
  assert.match(managedReview, /do not require a local commit/);
  assert.match(reconciliation, /candidate path\/existence\/bytes/);
  assert.match(reconciliation, /author independently verifies and dispositions every finding/i);
  assert.match(scenarios, /artifact or candidate identity does not match the exact open ledger/);
});

test("rejects competing E2E infrastructure and preserves ordinary workflow behavior", () => {
  assert.match(e2ePlanning, /Ordinary `NORMAL`, Master Plan-only, standalone PR-breakdown, and generic handoff work skip this reference/);
  assert.match(reviewCore, /Ordinary checkpoint\/PR review, small documentation review, Specialist consultation/);
  assert.match(core, /Do not create a custom runtime, database, durable event log, scheduler, message bus, polling loop, manifest service, fingerprint registry, or review oracle/);
  for (const source of [e2ePlanning, managedReview]) {
    assert.doesNotMatch(source, /create (?:a )?(?:database|scheduler|polling loop|fingerprint registry|provenance service|review oracle)/i);
  }
});
