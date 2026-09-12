// Test plan:
// - Mục tiêu: khóa refinement review, Owner-package admission và Master Plan Only contract.
// - Loại test: Node static contract test trên các skill/reference sở hữu hành vi.
// - Case thành công:
//   - Admission dùng declared synthetic non-contiguous refs; Master Plan handoff giữ review/permission boundary.
// - Case thất bại:
//   - Chặn source lỗi, supersession-only exclusion, GOAL/lineage lỗi, ambiguity và closed-plan mismatch.
// - Bảo mật/phân quyền:
//   - Owner giữ GOAL Revision; Reviewer PASS không cấp approval, implementation hoặc Git authority.
// - Ổn định/resilience:
//   - Giữ deterministic closure, root-cause/focused rereview và stable progress.
// - Invariant cần giữ:
//   - Không tạo durable package registry hay competing Master Plan review/state-machine owner.
// - Kết quả verify gần nhất: passed 14 tests bằng `node --test .agents/scripts/native-multi-agent-workflow.test.mjs` trên Node v24.11.1.
// - Ghi chú: static contract test không phải native rehearsal hay bằng chứng model behavior.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..", "..");
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
const planningRoot = resolve(
  repositoryRoot,
  ".agents",
  "skills",
  "implementation-planning-and-pr-breakdown",
);
const planningCore = readFileSync(resolve(planningRoot, "SKILL.md"), "utf8");
const masterPlanWorkflow = readFileSync(
  resolve(planningRoot, "references", "master-plan-workflow.md"),
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
