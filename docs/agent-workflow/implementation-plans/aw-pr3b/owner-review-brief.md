# AW-PR3B — Owner review brief

This brief summarizes the material decisions in [plan.md](./plan.md). It does not silently redefine that plan or grant implementation permission.

## Current state

- Planning branch: `feat/agent-workflow-aw-pr3b`.
- Branch continuity: later implementation uses this same branch after plan approval, implementation permission, and CP0 revalidation; no separate planning-PR merge gate applies.
- Base: synchronized `main == origin/main == 71f62365ef24eac75e31ff2bc4e3ad46682a11ee`.
- Dependency: AW-PR3A [PR #60](https://github.com/khangnhoang/VocaSpace/pull/60) is merged.
- Planning task: authorized and completed on this branch.
- Detailed plan decision: `approved` by owner instruction on 2026-07-24, including the exact 12-file scope, three global amendments, six domain contracts, clustering/deduplication model, CP0–CP6, and checkpoint-commit amendment.
- Current implementation permission: `granted` for the exact approved scope, verification, reviews, and in-scope corrections.
- Historical planning checkpoint Git permission: consumed by commit `115ef6bfa4b9f92a655b8326c63af26c6b8f7b26` and its successful initial normal push.
- Current Git/remote permission: coherent local checkpoint/correction/verification/delivery commits, normal push of the completed sequence, and one additional factual delivery-record commit and normal push when needed.
- Specialist/fresh-reader permission: up to three separately justified bounded specialist actions under the existing gates; one required bounded post-CP4 fresh-reader case when a qualified uncontaminated executor/context is available.
- PR/CI watch-fix/merge/force/history-rewrite/branch-deletion/production/deployment/credential/remote-database permission: `not granted`.
- Planning fresh-reader: `not_run` by explicit instruction.

## Owner direction already recorded

The current owner instruction establishes these non-negotiable invariants:

1. AW-PR3A retains global specialist gates; AW-PR3B owns domain signals and the minimum global amendment required by the multi-cluster decision.
2. Correctness and safety outrank token efficiency.
3. Default is `0 specialist`.
4. Task size, file count, domain activation, or owner request alone does not justify specialist execution.
5. There is no hard one-specialist-per-task limit.
6. Multiple specialists, commonly 2–3, require multiple genuinely independent unresolved material risk clusters.
7. Deduplication is by threatened invariant/risk cluster, not domain skill, file, or symptom.
8. Each specialist is bounded, advisory, separately justified, and covered by current explicit permission. One instruction may authorize a bounded count/class; another owner round-trip is needed only when execution exceeds its count, domain, access, package, or action boundary.
9. The main agent owns integration review and the final verdict.
10. No fresh-reader runs during planning. After implementation and main self-review, at least one bounded governance-comprehension case is expected when a qualified uncontaminated executor/context is available; absence is `not_run`, and additional cases require independent comprehension/evidence questions rather than one reader per skill or specialist cluster.
11. Quota controls package width, deduplication, low-value calls, and repetition; it does not veto bounded specialist evidence that could materially resolve unresolved correctness/safety risk blocking a trustworthy verdict.

These decisions and the current owner approval authorize the exact detailed plan and bounded actions above. They do not authorize material scope expansion or any excluded action.

## Proposed exact future scope

### Nine behavior owners

1. `docs/agent-loops.md`
2. `.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md`
3. `.agents/skills/code-review-and-quality/SKILL.md`
4. `.agents/skills/supabase-safe-migration/SKILL.md`
5. `.agents/skills/nextjs-server-action-zod/SKILL.md`
6. `.agents/skills/frontend-workflow/SKILL.md`
7. `.agents/skills/test-quality-strategy/SKILL.md`
8. `.agents/skills/git-checkpoint-workflow/SKILL.md`
9. `.agents/skills/maintain-repo-skills/SKILL.md`

### Three supporting records

1. `docs/agent-workflow/progress.md`
2. `docs/agent-workflow/implementation-plans/aw-pr3b/plan.md`
3. `docs/agent-workflow/implementation-plans/aw-pr3b/owner-review-brief.md`

Total anticipated future implementation scope: 12 files.

`AGENTS.md`, master plan, problems tracker, index, AW-PR3A artifacts, bundled references, validator/test support, eval/runner, CI, product, runtime, and database sources remain audit-only. A validator warning snapshot change is a stop for a separate scope decision.

## Why global orchestration changes are required

Current merged AW-PR3A wording says one specialist per plan/checkpoint by default and requires owner permission for a second reviewer. That conflicts with the new owner-approved multi-cluster direction.

The smallest safe amendment is:

- lifecycle: route one or more independent clusters without adding domain checklists;
- planning: own plan-specific cluster mapping, independence, package justification, permission coverage, and feedback reconciliation;
- review: own reusable per-cluster gates, bounded count/class permission coverage, quota safety precedence, deduplication, package/reviewer behavior, integration, `not_run`/`Blocked`, and final-verdict boundaries.

The six domain skills still own the actual hard/conditional/non-trigger lists. No additional root route or new reference is proposed.

## Proposed domain decision matrix

| Domain | Hard-risk consideration | Conditional/main review only | Ordinary non-trigger |
| --- | --- | --- | --- |
| Supabase | unresolved RLS/permission, `SECURITY DEFINER`, destructive/backfill/constraint compatibility, transaction/lock/concurrency/idempotency, trigger/RPC invariant | additive known-compatible migration, established policy/RPC pattern, mechanical generated types, ordinary drift/reset | docs/comment, file count, activation, generic double-check request |
| Trust boundary/Zod | unresolved auth/privileged field, webhook/payment/upload authenticity, validation/auth/side-effect ordering, material cross-module request/result mismatch | schema placement/composition, FormData normalization, nullable/default/error-shape decisions with adequate focused evidence | local UI type, mechanical composition, routine valid/invalid cases, payload count |
| Frontend | unresolved race/stale response, optimistic rollback, permission visibility, critical destructive multi-step flow, critical accessibility blocker | normal multi-state UI, form/dialog, responsive work, established client/server trace | cosmetic/local CSS, copy, simple established rendering, component count |
| Tests | mocks hide material guarantee, untrustworthy nondeterministic fixture, insufficient layer for cross-boundary auth/persistence/concurrency, material regression cannot be bounded | normal layer selection, ordinary edge cases, justified suite broadening, deterministic local fixture prep | test count, coverage alone, multiple layers, routine regression, owner request |
| Git | after existing stop, unresolved ownership/ancestry/dependency/recoverability/history-integrity ambiguity that bounded read-only analysis could resolve | clean base/ahead-behind inspection, coherent correction commit, branch naming, non-destructive local checkpoint | dirty/diff/commit count alone, branch existence, commit/push request, activation |
| Repo-skill governance | unresolved authority, permission, routing, source hierarchy, lifecycle/status, stop, evidence-claim, or material fresh-reader semantics | clarification of owned rule, approved deterministic structural check, exact-consumer metadata/resource routing | typo/style, length warning alone, activation, owner request |

All existing domain implementation, hard-stop, safety, and permission wording remains authoritative unless the exact plan identifies a direct contradictory sentence.

## Cluster decision

One cluster:

- signals threaten the same invariant or causal chain;
- one bounded answer can resolve them;
- shared evidence and one final readiness decision cover the concern.

Multiple independent clusters:

- invariants and material failure modes are independent;
- resolving one does not materially resolve the other;
- each retains its own evidence gap, 1–3 bounded questions, expected benefit, and coverage under current explicit permission.

There is no task-wide hard cap. “Commonly 2–3” is descriptive, not a target, entitlement, or default. One owner instruction may cover a bounded count/class such as up to three justified independent clusters; a new round-trip is required only for boundary excess.

## Planned checkpoints

1. CP0 — revalidate base, dependency, exact scope, approval, permissions, and record this amendment before behavior implementation.
2. CP1 — amend the three global orchestration owners; commit locally only if the intermediate global contract is independently coherent, safe, valid, and non-misleading without CP2.
3. CP2 — add all six domain signal sections; use one separate domain-contract commit when CP1 stands independently, otherwise commit CP1+CP2 as one coherent outcome.
4. CP3 — deterministic validation, source scenarios, exact-scope audit, and factual record updates; create a standalone commit only when the evidence is a meaningful recovery/review boundary.
5. CP4 — adversarial main integration review and in-scope corrections; verified source corrections use additive commits.
6. CP5 — only after CP4, run at least one bounded fresh-reader governance-comprehension case when a qualified uncontaminated executor/context is available; otherwise record `not_run`. Reconcile verified findings through additive corrections and rerun affected checks.
7. CP6 — cumulative `base..HEAD` audit, normal push of the completed sequence, and an optional additional factual delivery-record commit/push only when actual remote evidence needs recording.

No checkpoint commit is ceremonial or implies PR/merge readiness. Every commit requires targeted verification, checkpoint self-review with `0 Critical / 0 Required`, a valid non-misleading intermediate repository state, and real recovery, review, or rollback value.

## Acceptance and evidence boundary

The implementation is ready for final delivery only when:

- all global and domain source scenarios pass;
- default `0`, non-trigger cases, independent-cluster behavior, deduplication, permissions, and `not_run`/`Blocked` semantics are traceable;
- current permission may cover a bounded count/class without one owner round-trip per spawn, while boundary excess still stops;
- quota cannot veto bounded evidence that could materially resolve correctness/safety risk blocking a trustworthy verdict;
- validator and structural-validator tests pass without unapproved snapshot change;
- main integration review has 0 Critical and 0 Required findings;
- any fresh-reader evidence is labeled from actual context/access, never substituted by self-review or static assertions;
- exact Git scope and tracker state are truthful.

Static source assertions do not prove native model routing, automatic spawning, independent review, isolation, or runner behavior.

## Feedback claim reconciliation

| Claim | Disposition | Evidence-backed correction |
| --- | --- | --- |
| RQ1 — current permission rows | `confirmed` | AW-PR1/AW-PR2 current rows are `no`; completed/consumed grants remain historical |
| RQ2 — same planning/implementation branch | `partially confirmed` | AW-PR2 history remains unchanged in substance; unqualified wording now excludes AW-PR3B, which reuses the current branch |
| RQ3 — fresh-reader activation | `confirmed` | CP5 expects one bounded governance-comprehension case when a qualified uncontaminated executor/context is available; otherwise `not_run`; extras use independent comprehension/evidence questions |
| RQ4 — permission versus round-trip | `confirmed` | Each action needs current permission coverage, but one instruction may grant a bounded count/class; only boundary excess needs another owner round-trip |
| RQ5 — safety versus quota | `confirmed` | Quota limits width/deduplication/low-value repetition and cannot veto evidence that could materially resolve safety/correctness risk blocking a trustworthy verdict |

No feedback claim was accepted without checking the current five-file diff and the relevant repository owner. Cumulative main-agent re-review has `0 Critical` and `0 Required` remaining; fresh-reader execution remains `not_run` for this planning task.

## Approved execution decision

The owner approved the exact 12-file scope, three global amendments, six domain contracts, threatened-invariant clustering/deduplication model, CP0–CP6, and the partially accepted checkpoint-commit model on 2026-07-24. Implementation, bounded in-scope correction, required local commits, and normal delivery push permissions are current. No new material owner decision is open at CP0.

## Decision record

- Owner decisions supplied before this draft: recorded in “Owner direction already recorded.”
- Detailed plan decision: `approved` on 2026-07-24.
- Current implementation and in-scope correction permission: `granted` for CP0–CP6 and the exact 12-file scope.
- Specialist permission: up to three actions, each separately justified, bounded, read-only, and admitted only by the existing hard-risk/evidence/benefit gates.
- Fresh-reader permission: `granted after implementation and main review`; at least one bounded governance-comprehension case is required when a qualified uncontaminated executor/context is available, otherwise record `not_run`.
- Local Git permission: `granted` for coherent checkpoint, correction, meaningful verification-record, and required factual delivery-record commits.
- Remote permission: `granted` for normal push of the completed sequence and one additional factual delivery-record normal push when needed.
- Historical planning stage/local commit/initial push: consumed by `115ef6bfa4b9f92a655b8326c63af26c6b8f7b26`.
- PR/CI watch-fix/merge/force/history rewrite/branch deletion/production/DB/deployment/credential/other remote mutation: `not granted`.
