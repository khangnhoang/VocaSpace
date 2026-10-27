---
name: implementation-planning-and-pr-breakdown
description: Plan non-trivial work from repository discovery and Owner decisions through scope, dependencies, acceptance, verification and implementation handoff. Use for plan authoring/revision, PR breakdown or an implementation brief.
---

# Implementation planning and PR breakdown

## Use when / do not use when

Use for unclear scope, non-trivial/cross-domain work, dependency/PR breakdown, material behavior or permission changes, a plan revision or transferable brief. Do not use for trivial obvious work or implementing a complete approved plan with no new conflict. Planning-only requests remain non-implementation.

docs/agent-loops.md owns sizing, required reviews and the 3-pass self-review cap; AGENTS.md owns authority. repo-docs-system owns document shape and State placement. Domain skills own product/test/Git rules; read every matching one, not every adjacent one.

## Workflow

1. **Route and discover.** Inspect applicable instructions, direct sources/tests, backlog and owning plan/progress/problems when they affect this task. Confirm Git/base/writer ownership when relevant. Do not invent files, APIs or test infrastructure.
2. **Understand the outcome.** Actor, current/expected behavior, state transitions, permissions, scope/non-goals, failure paths and measurable success. Do not reduce the goal to its nearest UI.
3. **Trace reality.** Follow entry → validation/permission → business rule → side effect/persistence → response/UI → evidence. Confirm actual fields, nullable/server-owned values, statuses, dependencies and commands.
4. **Separate evidence.** Confirmed facts, assumptions with evidence/invalidation, conflicts and open questions. Inspect repository-resolvable facts; ask only material Owner-controlled choices before binding the Spec. A reversible wiring choice is a hypothesis, not an approval question.
5. **Write proportionally.** Binding Spec holds observable outcome/acceptance, scope/non-goals, Owner decisions and guardrails whose omission causes a concrete failure. Baseline facts justify the Spec; hypotheses name what may vary while it holds. State records execution truth, not a copy of the plan.
6. **Order and slice.** Use actual hard/soft dependencies and safe rollout order, not numbering. One coherent reviewable outcome per PR/checkpoint; do not separate implementation from direct regression coverage or combine unrelated work. Steps are actions; a Stage exists only for a meaningful integrated gate.
7. **Acceptance and verification.** Actor + action + condition + expected result. Select existing commands and manual QA by risk/test layer; say what cannot be checked. Decide data/role fixture readiness before final QA.
8. **Risks and recovery.** Identify impact, mitigation, earliest exposing checkpoint, stop/rollback and any irreversible or separately granted action. Do not promise precise agent time.
9. **Self-review.** Apply code-review-and-quality Self-review plus plan completeness/dependency/ownership checks, then report the lifecycle evidence block. Required independent review follows lifecycle; no reviewer verdict approves the Owner's decision.

## Approval and implementation

An exact current instruction may settle behavior and authorize implementation together. Otherwise obtain approval of the plan/material decisions and an implementation grant separately. Commit, push, PR, merge, database and model actions remain separate grants.

A plan is not automatically committed. With a commit grant, review the actual uncommitted file/diff first, fix pre-commit findings in place and commit only after required review passes. A later reviewed-commit correction normally gets a new commit.

Implementation may replace bounded hypotheses when outcome, allowed domains, semantic ownership, authority, hard dependencies and required evidence hold. Verify and record the deviation in State. Stop affected work when a material boundary changes; correct/review that contract and obtain the Owner's decision where required. Do not rewrite an approved Spec to disguise drift.

## Resource routing

| Resource | Read condition | Skip when |
| --- | --- | --- |
| [Hierarchy and discovery changes](references/spec-state-and-hierarchy.md) | A durable plan needs checkpoints/resume State or a discovery may change its binding contract. | One small coherent session with no resume boundary. |
| [Tracked sources](references/tracked-program-and-durable-plan.md) | Reconciling an owning program's plan, progress, problems or durable handoff. | Standalone work without program ownership. |
| [PR split and brief](references/pr-breakdown-and-handoff.md) | Splitting PRs/checkpoints, deciding parallel work or writing an implementation brief. | One boundary with no handoff. |
| [Master plan](references/master-plan-workflow.md) | Writing or materially revising a multi-unit master plan. | Detail/chat plan only. |
| [QA readiness](references/qa-fixture-readiness.md) | Planned manual QA depends on data/roles/fixtures. | No data-dependent QA. |

## Stop and report

Stop for missing authority, unclear writer/base, material unresolved decision, conflicting accepted sources, unsupported verification or scope expansion. Report goal/scope, evidence vs assumptions, dependencies, acceptance/checks, risks, pending decisions and self-review; not a transcript or duplicate tracker.
