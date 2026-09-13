# Multi-Agent E2E Detailed Planning

Read this reference only when the parent skill routes a `MULTI_AGENT_E2E` detailed-plan candidate, accepted-plan implementation handoff, active detailed-plan drift, or upstream Master Plan mismatch. [`native-multi-agent-workflow`](../../native-multi-agent-workflow/SKILL.md) remains the sole owner of role/session identity, review artifacts, review rounds, correction budgets, admission, blockers, and Main-only transitions. The parent skill remains authoritative for planning ownership and permissions; [`code-review-and-quality`](../../code-review-and-quality/SKILL.md), [`test-quality-strategy`](../../test-quality-strategy/SKILL.md), and [`git-checkpoint-workflow`](../../git-checkpoint-workflow/SKILL.md) retain their review, evidence-layer, and Git boundaries.

## Detailed-plan authoring procedure

1. Admit the exact current Owner Source Package before substantive work. Echo its `owner_input_revision` and declared ordered refs, then derive the bounded outcome and plan contract from the included whole entries rather than Main's routing summary or a durable document's historical source identity.
2. Read the approved Master Plan/workstream, current progress and problem owners, applicable artifact convention, repository evidence, and every domain skill selected by the actual scope. Separate repository-confirmed facts, Owner decisions, assumptions, conflicts, and open evidence. Stop rather than invent a material behavior, owner, dependency, permission, or acceptance rule.
3. Reference the exact Master Plan ID/workstream and record only the task-local lineage delta. For each local node record `owner`, `depends_on`, `consumes`, `produces`, assumption evidence/invalidation, and a positively supported `affected`, `unaffected`, or `needs_review` disposition. Missing an edge is not evidence of `unaffected`.
4. Define exact and forbidden paths/domains, branch/base/dependencies, serialized writer boundaries, relevant skills and semantic owners, state transitions, progress owner, action permissions, rollback/stop conditions, and the smallest coherent implementation checkpoints. Do not copy the Master Plan graph or native lifecycle state machine into the candidate.
5. Make acceptance observable. Map each criterion to deterministic, native/runtime, manual, or external evidence; name skipped/unavailable evidence and the claim it blocks. Static source or link checks do not prove live orchestration or semantic review quality.
6. Complete author-side consumer-to-owner, acceptance-to-evidence, and prompt-leakage closure through the native reconciliation owner. A fresh downstream role must be able to recover every reusable material semantic from repository-owned sources without the planning prompt supplying expected answers.

## Accepted-plan implementation handoff

The handoff must identify the exact accepted candidate and revision, approved Master Plan/workstream, current Owner package and authority snapshot, branch/base, prerequisites, exact and forbidden paths, task-local lineage, checkpoints, acceptance/evidence requirements, progress owner, mismatch routes, rollback/stop conditions, and known limitations.

Plan Reviewer `PASS` is necessary but not sufficient to start implementation. Main admits the matching review artifact/handoff, revalidates candidate currentness and repository state, then separately confirms current implementation authority before dispatching a fresh Implementor. The Implementor writes only the assigned implementation paths, preserves partial and unrelated work, and never edits the plan or interprets review success as commit or remote permission.

## Drift and upstream mismatch

- On `PLAN_CONTRACT_MISMATCH`, the Implementor stops dependent mutation, preserves actual partial state, and returns the smallest repository evidence that challenges the accepted detailed plan. Main resumes the exact original Planner. If the claim is supported, that Planner makes the smallest goal-preserving plan correction, updates affected lineage/evidence, and returns the new candidate to the exact original Plan Reviewer before the same Implementor can resume.
- If the resumed Planner verifies that the conflict reaches the upstream contract, it returns `MASTER_PLAN_CONTRACT_MISMATCH` and lower work pauses. If the upstream managed workflow remains open, Main reuses its exact original Master Planner and Reviewer. If the Master Plan is closed, Main routes a fresh read-only Master Plan Correction recommendation and then stops at `OWNER_DECISION_REQUIRED`; the correction role does not edit the canonical plan or resume implementation.
- A later independent plan-drift cause may open its own reconciliation episode only when repository evidence distinguishes it from the existing causal family. Renaming an episode or finding cannot reset a correction budget. Episode identity, session continuity, review artifacts, counters, and admission stay with `native-multi-agent-workflow`.
- Later Owner input is first classified by the native Owner-source owner. A clarification, detailed-plan change, authority-only delta, GOAL/invariant/scope change, or prior-work disposition follows every applicable route and the most restrictive stop. Planning does not reinterpret an authority-only delta as a semantic candidate revision.

## Compact detailed-plan candidate

Keep live Owner-package membership, role/session IDs, review round/counter, temporary artifact identity, and current admission state in Main's ephemeral ledger and dispatch package rather than this durable candidate.

```text
# Detailed Implementation Plan — <bounded outcome>

## Stable source, approval, and authority interpretation
approved Master Plan/workstream:
material Owner decision/approval reference:
implementation conditions and excluded Git/remote/production actions:

## Goal and observable outcome
## Repository facts and Owner decisions
## Assumptions, conflicts, and open evidence
## Exact scope and forbidden scope
## Relevant skills and semantic owners
## Branch, base, prerequisites, and dependency order
## Task-local lineage delta
| ID | owner | depends_on | consumes | produces | evidence/invalidation | disposition |
## Serialized checkpoints and writer boundaries
## Acceptance criteria and evidence mapping
## Deterministic, native/runtime, manual, and external verification
## Progress ownership and truthful status rules
## Detailed-plan and Master Plan mismatch routing
## Rollback, stop conditions, permissions, and claim limits
## Accepted-plan implementation handoff
```

## Completion boundary

A detailed-plan candidate is handoff-ready only when it is executable without material downstream invention, all mandatory semantics resolve to canonical owners, exact scope and permissions are explicit, acceptance maps to current obtainable evidence, and unresolved conflict has an exact mismatch, blocker, or Owner route. Ordinary `NORMAL`, Master Plan-only, standalone PR-breakdown, and generic handoff work skip this reference and retain their existing behavior.
