# Managed Lifecycle Review

Read this reference only for a `MULTI_AGENT_E2E` Plan Reviewer or Implementation Reviewer round. The parent skill owns review judgment, finding severity, verification status, and human-facing verdicts. [`native-multi-agent-workflow`](../../native-multi-agent-workflow/SKILL.md) exclusively owns role/session identity, exact artifact destination, candidate stability, review rounds, correction budget, blocker recovery, handoff admission, and Main-only transitions. [`implementation-planning-and-pr-breakdown`](../../implementation-planning-and-pr-breakdown/SKILL.md), [`test-quality-strategy`](../../test-quality-strategy/SKILL.md), and [`git-checkpoint-workflow`](../../git-checkpoint-workflow/SKILL.md) retain accepted-plan, evidence-layer, and Git boundaries.

## Shared review procedure

1. Admit the exact Owner Source Package and echo the dispatched revision and ordered refs before substantive work. Confirm the workflow, role, phase, episode, candidate ref/revision, review round, exact artifact ref, candidate-read-only boundary, and current authority package.
2. Review the exact full subject against Owner intent, approved plan hierarchy, repository owners, scope/exclusions, acceptance, verification, permissions, and stop conditions. Do not derive the standard from Main's summary or an expected answer in the payload.
3. Apply the parent skill's formal and integration dimensions plus every domain dimension selected by the actual change. Optional Specialist consultation defaults to `0`, requires its separate gates and current authority, and never replaces a required dimension, finding, or verdict.
4. Write only the exact artifact assigned by Main. Keep detailed findings and the human-facing verdict in that artifact; return only their concise identity-preserving projection in the conversational handoff.
5. Preserve unavailable, skipped, stale, partial, manual, and environment-limited evidence truthfully. Artifact presence, a passing command, or absence of discovered defects is not by itself lifecycle `PASS`.

## Plan Reviewer dimensions

Disposition every item for the exact detailed-plan candidate:

- exact Owner-source and approved Master Plan/workstream fidelity, including material ambiguity and Phase/scope exclusions;
- current repository reality, semantic ownership, activated skills, and absence of a competing source of truth;
- task-local lineage, dependencies, assumption evidence/invalidation, and positive blast-radius dispositions;
- exact and forbidden paths, serialized writer boundaries, branch/base/prerequisites, and implementability without downstream material invention;
- observable acceptance mapped to deterministic, native/runtime, manual, and external evidence with truthful claim limits;
- action permissions, progress ownership, detailed-plan drift, open/closed Master Plan mismatch, rollback, stop, and Owner-decision routes;
- consumer-to-owner, acceptance-to-evidence, and prompt-leakage closure so reusable semantics are repository-owned rather than payload-only.

Plan Reviewer does not implement, approve the Owner's semantic decision, or make an action grant. A material candidate defect within the Planner's current authority is a blocking finding; missing external evidence/permission or material Owner ambiguity is a blocker with the exact resolver.

## Implementation Reviewer dimensions

Disposition every item for the exact implementation candidate and cumulative range:

- fidelity to the admitted detailed plan, Owner source, current authority, exact changed-path allowlist, and explicit exclusions;
- observable behavior and state transitions at canonical owners, including failure, stale, retry, rollback, permission, and partial-state paths selected by the actual contract;
- proportional deterministic, native/runtime, manual, and external evidence, with later edits and evidence currentness accounted for;
- candidate and review-artifact stability, Reviewer write scope, untracked/staged state, and implementation/progress truth without action-authority leakage;
- cross-owner integration, compatibility with unaffected `NORMAL` and Master Plan behavior, rollback/readiness, and absence of unnecessary custom mechanisms.

Use domain dimensions only where the actual diff requires them. For an uncommitted managed candidate, review its exact logical revision, correction diff, current evidence, and stability; do not require a local commit when commit authority is absent or intentionally waits for final admitted review.

## Artifact content and handoff projection

Use the parent report shape for findings and verification, adding these managed fields without creating a second taxonomy:

```text
Review Identity
  workflow_id, mode, role, phase, episode_id
  owner_input_revision and ordered refs
  candidate_ref and candidate_revision
  review_round and review_artifact_ref

Owner Summary
  concise outcome
  finding IDs/counts or blocker
  recommended_next_route

Mandatory Dimension Dispositions
Findings
Verification and claim limits
Open Questions / Blocker
Human-facing Verdict
Lifecycle Status
```

The artifact is the detailed source; the handoff echoes exact identity and projects only the Owner Summary, finding IDs/counts or blocker, verification, status, and recommended route. Main validates and admits this projection but does not rewrite or adjudicate findings.

## Verdict-to-status mapping

| Review evidence and human-facing verdict | Managed lifecycle status |
| --- | --- |
| Every required dimension and current mandatory evidence is complete; `0 Critical / 0 Required`; no mandatory manual QA remains; `Approved` | `PASS` |
| Material defect is within the current author/plan authority; normally `Changes required` | `BLOCKING_FINDINGS` |
| External evidence, environment, permission, or mandatory manual QA is unavailable or pending; `Blocked` or `Implementation review passed; manual QA pending` as applicable | `BLOCKED` with resolver and smallest required state change |
| Material correction requires a different accepted plan, Master Plan, GOAL, scope, or authority | Record the evidence; author returns the applicable mismatch or Main opens `OWNER_DECISION_REQUIRED`; never weaken to `PASS` |
| `Rejected approach` | Route blocking correction or the applicable plan/Owner mismatch according to the semantic owner of the smallest valid correction |

`Approved` projects to `PASS` only under the first row. `Changes required` projects to `BLOCKING_FINDINGS`. `Implementation review passed; manual QA pending` never projects to `PASS` in managed E2E. Skipped, unavailable, stale, or partial evidence that is mandatory for acceptance also prevents `PASS`.

## Correction and rereview boundary

The candidate author independently verifies and dispositions every detailed blocking finding, corrects the governing causal invariant, and scans the full candidate for same-family manifestations. The same Reviewer rereviews the corrected logical candidate using the prior findings, dispositions, correction diff, affected evidence, and a narrow regression scan while retaining access to the full candidate. Repeat full review when Owner revision, scope, authority, semantics, or the affected boundary materially changes. Session continuity, round accounting, blocker non-consumption, and exhausted-budget routing remain in `native-multi-agent-workflow`.

Return `BLOCKED` with the exact resolver when a trustworthy verdict depends on unavailable mandatory evidence or manual QA. Do not manufacture a defect, Specialist call, Owner steer, test result, or live observation to complete a lifecycle path.
