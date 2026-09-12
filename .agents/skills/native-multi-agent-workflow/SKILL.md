---
name: native-multi-agent-workflow
description: Repository-native orchestration contract for VocaSpace managed Codex workflows, including mode routing, fresh roles, Owner-source fidelity, handoffs, review artifacts, correction rounds, blockers, and Main-only transitions.
---

# Native Multi-Agent Workflow

## Activation and ownership

Use this skill when selecting, running, changing, or reviewing `MULTI_AGENT_MASTER_PLAN` or `MULTI_AGENT_E2E`; handling a managed role handoff, review artifact, correction round, Owner steer, or blocker; or deciding that a managed workflow must stop at `OWNER_DECISION_REQUIRED`.

Keep a coherent bounded task in `NORMAL` when one agent can own it reliably. This skill owns managed orchestration semantics, not product behavior, detailed planning, review taxonomy, testing, Git procedure, or remote operations.

## Authority and precedence

Apply exact current Owner input and higher-level safety restrictions first, then `AGENTS.md`, `docs/agent-loops.md`, this skill, and the routed domain/lifecycle skills. Surface conflicts; do not average them.

Main alone selects mode, admits handoffs and review artifacts, updates workflow state, and performs phase/episode transitions. Child roles recommend outcomes but never transition the workflow or expand authority. A profile, sandbox, review verdict, or successful tool call never grants implementation, commit, push, PR, merge, deployment, database, production, destructive, or remote permission.

## Modes and roles

| Mode | Contract |
| --- | --- |
| `NORMAL` | Default for one coherent outcome with stable ownership and proportional verification; managed roles are not required |
| `MULTI_AGENT_MASTER_PLAN` | Fresh Master Planner creates a candidate; fresh Master Plan Reviewer completes mandatory review; workflow ends without implementation |
| `MULTI_AGENT_E2E` | Fresh Planner, Plan Reviewer, Implementor, and Implementation Reviewer operate in dependency order with serialized candidate writers |
| `OWNER_DECISION_REQUIRED` | Main stops when GOAL, scope, ownership, permission, acceptance, baseline, disposition, or exhausted budget cannot be resolved safely |

Reviewer is a mandatory full lifecycle role and owns the exact review artifact plus verdict for its phase. Specialist is optional, advisory, limited to one justified risk cluster, cannot delegate, and cannot own a candidate, verdict, phase, or transition. A Reviewer may consult a currently authorized Specialist but must independently complete every required review dimension and verdict.

## Mandatory core workflow

1. Before substantive work, every managed role echoes exact `owner_input_revision` and the ordered Owner source refs it consumed. Missing, truncated, unreadable, reordered, or coverage-incomplete source returns `BLOCKED(owner_input_unavailable)`. Source that permits materially different semantic interpretations returns `BLOCKED(ambiguous_owner_intent)` and requires an Owner gate.
2. Main fixes workflow, phase, episode, candidate, scope, exclusions, authority snapshot, role action, expected output, budget, and stop conditions before dispatch.
3. Before opening initial review, the candidate author completes the bounded author-side handoff closure defined by the routed reconciliation resource, then Main confirms deterministic pre-review closure for every established machine-decidable expectation; Main or the author runs each check according to existing ownership, without duplicate execution. Failed closure returns to the owning writer without spawning Reviewer or consuming a review/correction round; semantic uncertainty remains Reviewer work.
4. Spawn each initial specialized role with zero inherited task history and the complete bounded package. Reuse the same role session for correction, rereview, blocker resume, and synchronized steer; do not replace continuity with a fresh role. A role finishing its turn, becoming idle or non-running, disappearing from an active-role listing, or completing an individual review episode does not retire its exact stored managed-role session identity. Main retains that identity in the ephemeral ledger until the enclosing managed workflow reaches its terminal state.
5. Main maintains only the minimal ephemeral ledger needed for current orchestration. Do not create a custom runtime, database, durable event log, scheduler, message bus, polling loop, manifest service, fingerprint registry, or review oracle.
6. Serialize candidate writers. During review, the candidate author is quiescent and Reviewer is candidate-read-only.
7. Main preassigns one exact local review artifact path for each logical review round. Reviewer may write only that file; it must remain ignored, untracked, and unstaged. Never select an artifact by `latest`, glob, mtime, or directory order.
8. Main exact-compares candidate path, existence, and bytes at review start and immediately before verdict admission, including tracked, already-dirty, and untracked candidates. The comparison is in-session evidence, not a persisted fingerprint system.
9. Main admits a handoff only when workflow, role, phase, episode, Owner revision, candidate revision, review round, artifact ref, status, and changed-path scope match the open ledger.
10. `PASS` does not mean Owner approval or action permission. `BLOCKED` does not consume a correction round. Only a completed author correction plus same-Reviewer rereview consumes the bounded automatic budget.
11. Authority-sensitive Owner steer to a running role requires interrupt/quiesce, audit of actual state, and same-session resume with exact updated source and authority snapshot before the next affected action. Delivery success alone is insufficient.

## Status and correction boundary

Use `BASELINE_READY`, `PASS`, `BLOCKING_FINDINGS`, `BLOCKED`, `PLAN_CONTRACT_MISMATCH`, `MASTER_PLAN_CONTRACT_MISMATCH`, and `OWNER_DECISION_REQUIRED` only for their defined lifecycle meaning. Review round `0` is initial review; rounds `1` and `2` follow correction rounds `1` and `2`. There is no automatic round `3`. After rereview round `2` still returns blocking findings, Main stops at `OWNER_DECISION_REQUIRED` unless the Owner explicitly authorizes another round.

Apply one materiality bar to every artifact type. A `Required` finding needs a causal path to authority, routing/state transition, ownership/source of truth, candidate identity, acceptance/verification, or completion truth; cosmetic or historical wording without such impact is non-blocking. Group findings by causal family: the author corrects the governing invariant and scans the full candidate for every same-family manifestation. Same-Reviewer rereview may use the previous findings, dispositions, correction diff, affected evidence, and a narrow regression scan while the full candidate remains available; repeat the full review when Owner revision, scope, authority, semantics, or the affected boundary materially changes.

Candidate movement returns `BLOCKED(candidate_moved)`. Reviewer writes outside the exact artifact returns `BLOCKED(reviewer_scope_violation)`. A tracked or staged review artifact returns `BLOCKED(review_artifact_git_scope_violation)`. Stale/crossed identity returns `BLOCKED(stale_handoff)`. Main may return `BLOCKED(session_unavailable)` only after using the exact stored managed-role session identity and establishing that the identity genuinely cannot be recovered or retrieved, or after native same-session resume/follow-up against that exact identity is actually attempted and the runtime explicitly rejects it as unavailable. Absence from an active listing is not availability evidence. Required model/session/config absence returns the matching specific `BLOCKED(...)`; never substitute a model, session, backend, or custom fallback silently.

An authority-sensitive steer that cannot establish quiescence, actual-state audit, and same-session resume returns `BLOCKED(owner_steer_not_synchronized)`.

## Resource routing

| Resource | Read condition |
| --- | --- |
| [Owner source and steering](references/owner-source-and-steering.md) | Read before packaging Owner source, applying later Owner input, handling materially ambiguous input, or changing scope, authority, acceptance, prior-work disposition, or a running role's instruction |
| [Review artifact and reconciliation](references/review-artifact-and-reconciliation.md) | Read before completing bounded author-side handoff closure, opening or admitting a review round, routing findings or correction, resuming a blocker, checking candidate/artifact identity, or reporting correction-budget exhaustion |
| [Verification scenarios](references/verification-scenarios.md) | Read when implementing, changing, reviewing, or verifying this skill or project role configuration, and before any native smoke |

Every resource path is relative and contained in this bundle. Mandatory authority, permission, ownership, evidence, stop, and reporting invariants remain in core.

## Related skills

Use `implementation-planning-and-pr-breakdown` for Master Plans, detailed plans, dependency order, and plan mismatch; `code-review-and-quality` for review dimensions, findings, verdicts, and report content; `maintain-repo-skills` when this skill or its resources change; `test-quality-strategy` for verification-layer choices; `git-checkpoint-workflow` for staging/commit boundaries; and every product-domain skill activated by the candidate.

## Stop conditions

Stop and report instead of dispatching, admitting, correcting, or transitioning when exact Owner source or permission is unavailable; a material source conflict remains; candidate/artifact identity or writer scope is invalid; required evidence is skipped, stale, or unavailable; a required model/session/config cannot be used; review artifacts would enter Git scope; correction budget is exhausted; or the next action requires ungranted implementation, Git, remote, production, database, destructive, or deployment authority.

## Reporting contract

Report exact mode, workflow/phase/episode, role/session reuse, Owner revision and ordered refs, candidate revision, review round/artifact, authority snapshot, observed status, changed-path scope, verification and claim limits, blockers, correction budget, and recommended next route. Distinguish observed native behavior from deterministic structure checks and from unsupported isolation or future-platform claims.

Keep durable progress closure stable: after admitted `PASS`, commit the reviewed implementation first, then use a progress-only commit to record stable observed facts and the implementation hash. The tracker never records its own commit hash or a transient self-reference such as `pending this checkpoint`; Git history owns the progress-only commit identity.
