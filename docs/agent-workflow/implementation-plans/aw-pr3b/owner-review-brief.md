# AW-PR3B — Owner review brief

This brief summarizes the material decisions in [plan.md](./plan.md). It does not silently redefine that plan or grant implementation permission.

## Current state

- Planning branch: `feat/agent-workflow-aw-pr3b`.
- Branch continuity: planning and implementation use this same branch; plan approval, implementation permission, and CP0 revalidation passed before behavior edits, and no separate planning-PR merge gate applies.
- Base: synchronized `main == origin/main == 71f62365ef24eac75e31ff2bc4e3ad46682a11ee`.
- Dependency: AW-PR3A [PR #60](https://github.com/khangnhoang/VocaSpace/pull/60) is merged.
- Current behavior state: CP0–CP6 implemented and delivered through `698ff973f58686c2567064c357d347de8e7c4fd7`; post-delivery record correction `f6c019f6e61aa4228a739208e451a8482a98d0cd` was normal-pushed and audited with `0 Critical / 0 Required`. This factual pre-PR record is a supporting-record-only delta on that audited head.
- Planning task: authorized and completed on this branch.
- Detailed plan decision: `approved` by owner instruction on 2026-07-24, including the exact 12-file scope, three global amendments, six domain contracts, clustering/deduplication model, CP0–CP6, and checkpoint-commit amendment.
- Current implementation permission: `consumed`; no standing implementation authority remains.
- Historical planning checkpoint Git permission: consumed by commit `115ef6bfa4b9f92a655b8326c63af26c6b8f7b26` and its successful initial normal push.
- Historical CP0–CP6 Git/remote permission: consumed by the recorded normal pushes through `698ff973f58686c2567064c357d347de8e7c4fd7`; it created no standing authority.
- Historical specialist/fresh-reader permission: the bounded implementation-stage grant produced `0` specialist actions and `1` fresh-reader action; it is consumed and does not create standing execution permission.
- Current post-delivery permission: supported in-scope audit corrections, additive local correction/factual-record commits, normal push, one PR to `main` after the audit passes, initial CI/check watching, and at most one qualifying `branch-caused-small-safe` CI fix attempt with its focused commit, normal push, and re-watch.
- Still not granted: merge, force-push, amend/squash/history rewrite, branch deletion, deployment, production, credential, remote-database, product/runtime/eval-runner/CI-behavior expansion, or a second CI fix attempt.
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

## Approved exact implementation scope

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

Total approved implementation scope: 12 files.

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

## Implementation checkpoint evidence

- CP0 planning amendment: commit `9b753389589ba1d3bc859e029d809dae2b871b2d`.
- CP1 global orchestration: independently coherent commit `f31768fc4d525b985ede4c66aa7410114fd874cc`; targeted global assertions and checkpoint review passed with `0 Critical / 0 Required`.
- CP2 six domain contracts: commit `b9cd507c9c97de7e7314f741de58405df6092a8d`; D01–D06 and domain permission/overlap assertions passed with `0 Critical / 0 Required`.
- CP3 cumulative verification: validator `valid` with the unchanged four warning codes; structural-validator tests `37/37`; G01–G11, D01–D06, F01–F02 contract assertions, stale wording, `git diff --check`, exact-scope, structural, UTF-8/EOL/Markdown/link/conflict/zero-width/secret audits all pass.
- Scope evidence: exactly 12 implementation files differ from planning baseline `115ef6bfa4b9f92a655b8326c63af26c6b8f7b26`; exactly 14 cumulative branch files differ from `origin/main`, adding only the historical planning master/index artifacts.
- Application tests/build/browser/Supabase/database/model-eval/CI/deployment/manual product QA: `not_run` because no product, runtime, database, runner, or CI behavior changed.
- Specialist actions through CP3: `0`; no unresolved material hard-risk cluster remained after main review and deterministic evidence.
- CP4 cumulative integration review found one `Required` record-truth cluster: stale “later/future implementation” and `not implemented` wording in current-state records. The three supporting owners now describe implemented/verified local behavior and pending CP5/CP6 state. Behavior review found no blocker; final after correction is `0 Critical / 0 Required`.
- CP4 specialist actions: `0`; main review and deterministic evidence resolved the record cluster without an unresolved material evidence gap.
- CP4 additive correction commit: `e1a852462f313fafa4afc1fc0731f3e7ac5b5400` (`fix(agent-workflow): reconcile AW-PR3B checkpoint status`).
- CP5 manual fresh-reader: `partially_passed`. A separate no-history session using the fixed eight-file package correctly determined same-invariant clustering, the independent Git cluster, bounded permission coverage, `not_run`/`Blocked`, main-agent ownership, and non-triggers. It once mislabeled the authorized count as quota.
- CP5 correction: `code-review-and-quality` now distinguishes risk clusters, permission coverage, quota, and deduplication in the section heading and explicitly states that a granted count/class is a permission boundary, not quota/entitlement/target.
- CP5 evidence limitation: instruction-bounded but not filesystem-isolated, not runner-produced, not model-independent, and not proof of native routing or automatic spawn. A second case was not run because repeating the same question would not be independent.
- CP5 verification/review: validator `valid` with four unchanged warning codes; structural-validator tests `37/37`; affected source/hygiene checks pass; final `0 Critical / 0 Required`. Specialist actions `0`; fresh-reader actions `1`.

## CP6 delivery summary

- Revalidated base and remote state before delivery: `main == origin/main == 71f62365ef24eac75e31ff2bc4e3ad46682a11ee`; remote branch started at planning head `115ef6bfa4b9f92a655b8326c63af26c6b8f7b26`.
- Final cumulative checks pass: validator `valid` with the same four approved warnings and no errors; structural-validator tests `37/37`; 25 contract assertions; exact 12-file implementation and 14-file cumulative scopes; `git diff --check`; UTF-8/newline/whitespace/zero-width/Markdown/ancestry/worktree/commit audits.
- Normal push succeeded from `115ef6bfa4b9f92a655b8326c63af26c6b8f7b26` to implementation head `7a74133367aa4f38630a1610950f2d591abd6885`; local `HEAD`, upstream, and read-only remote HEAD matched after the push.
- Commit boundaries remained additive and reviewable: CP1 and CP2 are separate coherent implementation commits; CP3 is a meaningful verification record; CP4 and CP5 are additive corrections. No amend, squash, force-push, or history rewrite occurred.
- CP6 final review: `0 Critical / 0 Required`. No PR, CI watch/fix, merge, production, deployment, credential, or remote-database action occurred.

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

The owner approved the exact 12-file scope, three global amendments, six domain contracts, threatened-invariant clustering/deduplication model, CP0–CP6, and the partially accepted checkpoint-commit model on 2026-07-24. Those implementation and delivery permissions were consumed. A later explicit instruction separately authorizes the current post-delivery audit, supported in-scope corrections, PR creation, initial CI watching, and at most one qualifying CI fix attempt without reopening the approved behavior design.

## Decision record

- Owner decisions supplied before this draft: recorded in “Owner direction already recorded.”
- Detailed plan decision: `approved` on 2026-07-24.
- Historical implementation and in-scope correction permission: granted for CP0–CP6 and consumed by the recorded delivery.
- Historical specialist permission: up to three actions, each separately justified, bounded, read-only, and admitted only by the existing hard-risk/evidence/benefit gates; consumed with `0` specialist actions used.
- Historical fresh-reader permission: granted after implementation and main review; consumed by the one recorded bounded case.
- Historical local Git permission: granted for coherent CP0–CP6 checkpoint, correction, verification-record, and factual delivery-record commits; consumed.
- Historical remote permission: granted for the completed implementation sequence and factual delivery-record normal pushes; consumed.
- Current post-delivery audit/PR/CI permission: exactly as recorded in “Current state”; it does not revive general implementation, specialist, fresh-reader, merge, production, database, deployment, or history-rewrite authority.
- Historical planning stage/local commit/initial push: consumed by `115ef6bfa4b9f92a655b8326c63af26c6b8f7b26`.
- Merge/force/history rewrite/branch deletion/production/DB/deployment/credential/other remote mutation: `not granted`.

## Post-delivery audit finding

- Audited remote baseline: `698ff973f58686c2567064c357d347de8e7c4fd7`; `main` baseline: `71f62365ef24eac75e31ff2bc4e3ad46682a11ee`.
- New cumulative review finding: one `Required` record-truth cluster. The brief mixed consumed permission at the top with stale `current ... granted` entries below and stopped current branch state at `7a74133` instead of delivery head `698ff97`.
- Correction: current and historical permission scopes are now separated, the live delivery head is recorded, and the exact current PR/CI authority is stated without granting merge or implementation expansion.
- All behavior-contract findings remain resolved. The correction touches only the three approved supporting records and must be re-audited on its pushed remote HEAD before PR creation.
- Correction delivery and re-audit: `f6c019f6e61aa4228a739208e451a8482a98d0cd` is local/upstream/read-only remote HEAD; worktree/staging are clean; validator/tests/assertions, exact scope, hygiene, ancestry/history, cumulative diff, and record-truth checks pass. Final post-correction verdict is `0 Critical / 0 Required`.
- This factual record does not change behavior or claim PR/CI state. After its normal push, only ref equality, clean state, exact scope, and `git diff --check` need final confirmation before checking for an existing PR.
