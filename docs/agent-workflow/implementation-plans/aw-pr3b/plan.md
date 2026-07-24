# AW-PR3B — Detailed implementation plan

## Status and authority

- Artifact state: `approved` by owner instruction on 2026-07-24.
- Planning branch: `feat/agent-workflow-aw-pr3b`.
- Branch continuity: planning and implementation use this same branch; owner approval, implementation permission, and CP0 revalidation passed before behavior edits, and no separate planning-PR merge gate applies to AW-PR3B.
- Planning baseline: synchronized `main == origin/main == 71f62365ef24eac75e31ff2bc4e3ad46682a11ee`.
- Dependency: AW-PR3A [PR #60](https://github.com/khangnhoang/VocaSpace/pull/60) is merged; head `c29e9bf2dd141329003b11db0ffbe6c55a74739e`, merge commit `71f62365ef24eac75e31ff2bc4e3ad46682a11ee`.
- Historical planning-delivery permission: the exact five-file planning checkpoint, one local planning commit, and initial normal push of `feat/agent-workflow-aw-pr3b` were granted and consumed by planning commit `115ef6bfa4b9f92a655b8326c63af26c6b8f7b26` and its successful normal push.
- Historical implementation and delivery permission: granted for CP0–CP6 across the exact 12-file scope, in-scope corrections, repository-approved verification, up to three separately justified bounded specialist actions, the required bounded post-CP4 fresh-reader case when a qualified uncontaminated executor/context is available, coherent local checkpoint/correction/verification/delivery commits, normal push of the completed sequence, and one additional factual delivery-record commit and normal push when needed. CP0–CP6 used that authority only as recorded below; successful normal delivery of the factual record consumes the remaining bounded Git/remote permission and creates no standing authority.
- Explicit exclusions remain: no PR creation/update, CI watch/fix, merge, force-push, amend/squash/history rewrite, branch deletion, production/deployment/credential/remote-database mutation, or product/runtime/eval-runner/CI behavior expansion.

Read this plan together with:

- the [master plan](../../plan.md);
- the [progress tracker](../../progress.md);
- the [owner-review brief](./owner-review-brief.md);
- the merged [AW-PR3A detailed plan](../aw-pr3a/plan.md) and [owner record](../aw-pr3a/owner-review-brief.md);
- [`docs/agent-loops.md`](../../../agent-loops.md);
- the global planning and review skills;
- all six domain skills listed in the future scope below.

If these sources materially conflict during implementation, stop and reconcile the owning source. The owner approval above covers the current exact plan and amendment; it does not authorize a material scope or behavior change outside them.

## Repository facts, owner decisions, and planning conclusions

### Verified repository facts

1. AW-PR3A owns the reusable specialist gates, bounded package, reviewer behavior, integration ownership, claim labels, `not_run`/`Blocked` behavior, and permission separation.
2. Current global wording defaults to `0 specialist`, rejects task size/file count/domain activation as triggers, and requires applicable main review depth before specialist consideration.
3. Current global wording also imposes a task-wide default cap of one specialist per plan or implementation checkpoint and requires explicit owner permission for a second reviewer.
4. None of the six domain skills currently owns an explicit hard/conditional/non-trigger specialist-signal section.
5. Existing domain procedures already own most underlying safety invariants and hard stops. AW-PR3B must classify signals without copying or weakening those procedures.
6. The stale AW-PR3A tracker row and pre-PR delivery wording did not reflect merged PR #60 before this planning checkpoint.

### Material owner decisions already confirmed by the current instruction

1. Correctness and safety take priority over token efficiency.
2. Default remains `0 specialist`.
3. Task size, file count, domain activation, or owner request alone is not sufficient specialist execution permission.
4. There is no hard one-specialist-per-task limit.
5. Multiple specialists, commonly 2–3, may be justified only for multiple genuinely independent unresolved material risk clusters.
6. Deduplication is by threatened invariant/risk cluster, not by skill, domain, file, or symptom.
7. Each specialist is bounded, advisory, separately justified, covered by current explicit permission, and limited to one risk cluster. One owner instruction may authorize a bounded count or class; a new owner round-trip is needed only when execution would exceed its count, domain, access, package, or action boundary.
8. The main agent owns integration review and the final verdict.
9. No fresh-reader ran during planning. CP5 occurs only after implementation and main review; at least one bounded governance-comprehension case is expected when a qualified executor/context is available, absence of a valid executor is `not_run`, and additional cases require independent comprehension/evidence questions rather than one reader per skill or specialist cluster.

### Planning conclusion requiring global scope

The multi-cluster decision cannot be implemented only in the six domain skills. It materially supersedes the current AW-PR3A task-wide one-specialist cap, so future implementation must amend the three existing global orchestration owners:

- lifecycle routing in `docs/agent-loops.md`;
- plan-specific decision and reconciliation in `implementation-planning-and-pr-breakdown`;
- reusable activation, quota, deduplication, package, reviewer, and integration semantics in `code-review-and-quality`.

These amendments must remain orchestration-only. Exact Supabase, trust-boundary, frontend, test, Git, and repo-skill signals remain in their owning domain skills.

## Goal

Make domain-owned escalation signals observable and deterministic enough that the main agent can distinguish:

- a concrete hard-risk signal that may activate specialist consideration after all global gates;
- a conditional or near-miss signal that deepens main-agent review or verification only;
- an ordinary case that does not escalate.

The result must also support one-cluster versus multiple-independent-cluster decisions without duplicating lifecycle/review ownership.

## Non-goals

- automatic specialist or sub-agent spawning;
- a model evaluation, benchmark, synthetic executor, or the separate agent-skills PR3B eval runner;
- product, runtime, database, migration, CI workflow, deployment, or remote behavior;
- changing the domain implementation procedures beyond the smallest signal-classification sections;
- creating, splitting, renaming, or moving skill references;
- a task-wide specialist minimum or maximum;
- a mandatory owner round-trip for each specialist action already covered by one explicit bounded permission;
- using an owner request, domain activation, task size, file count, formal-review route, or confidence label as sufficient execution permission;
- replacing main-agent review, verification, integration, or final verdict with specialist output or majority vote.

## Exact future implementation scope

### Behavior owners — required

| File | Smallest future change | Ownership boundary |
| --- | --- | --- |
| `docs/agent-loops.md` | Replace singular/task-wide implication with independent-cluster routing and current-permission coverage for multiple-specialist behavior | High-level lifecycle route only |
| `.agents/skills/implementation-planning-and-pr-breakdown/SKILL.md` | Replace plan-wide one-specialist cap; define plan-specific cluster mapping, independence test, package justification, reconciliation, and plan `not_run`/`Blocked` outcome | Plan-specific orchestration only |
| `.agents/skills/code-review-and-quality/SKILL.md` | Own reusable per-cluster gates, no task-wide cap, deduplication, package/reviewer behavior, integration review, repeat-review, permission, and final-verdict rules | Reusable review orchestration only |
| `.agents/skills/supabase-safe-migration/SKILL.md` | Add concise hard/conditional/non-trigger signal section | Database invariant signals only |
| `.agents/skills/nextjs-server-action-zod/SKILL.md` | Add concise hard/conditional/non-trigger signal section | Trust-boundary and contract signals only |
| `.agents/skills/frontend-workflow/SKILL.md` | Add concise hard/conditional/non-trigger signal section | Frontend state/interaction signals only |
| `.agents/skills/test-quality-strategy/SKILL.md` | Add concise hard/conditional/non-trigger signal section | Evidence/test-layer signals only |
| `.agents/skills/git-checkpoint-workflow/SKILL.md` | Add concise hard/conditional/non-trigger signal section while preserving existing hard stops and Git permissions | Local Git/checkpoint risk signals only |
| `.agents/skills/maintain-repo-skills/SKILL.md` | Add concise hard/conditional/non-trigger signal section while preserving governance authority and resource routing | Repo-skill governance signals only |

### Supporting records — required

| File | Future use |
| --- | --- |
| `docs/agent-workflow/progress.md` | Record actual implementation, verification, review, fresh-reader, permission, and delivery state |
| `docs/agent-workflow/implementation-plans/aw-pr3b/plan.md` | Reconcile only evidence-backed material amendments and checkpoint results |
| `docs/agent-workflow/implementation-plans/aw-pr3b/owner-review-brief.md` | Record owner decisions and consumed permissions without silently changing the detailed plan |

The exact anticipated future implementation set is therefore 12 files: 9 behavior owners and 3 supporting records.

### Audit-only or conditional-stop sources

- `AGENTS.md`, the master plan, `problems.md`, the implementation-plan index, AW-PR3A artifacts, bundled references, validator implementation, validator tests, eval sources, CI, product, and database files remain audit-only.
- `.agents/scripts/validate-skill.test.mjs` is not planned. If concise edits create a new validator warning or invalidate the approved warning snapshot, stop and request a test-support scope amendment rather than silently expanding.
- Any need to change `AGENTS.md`, add a reference, alter validator/runner behavior, or change a product/runtime source is a material scope expansion and stop condition.

## Shared signal semantics

### Hard-risk signal

A domain hard-risk signal exists when observable repository facts expose a concrete, potentially material domain-owned threat to correctness, safety, integrity, authorization, recoverability, or readiness. It activates deeper main-agent review and may later activate specialist consideration only if the threat remains materially unresolved and every global AW-PR3A gate passes. The signal does not authorize execution.

### Conditional or near-miss signal

A conditional signal requires deeper main-agent inspection, targeted verification, or a hard stop already owned by the domain procedure, but the currently observed facts do not establish a concrete material threat. It becomes hard-risk only if that work exposes such a threat. Conditional does not mean “spawn later by default.”

### Ordinary non-trigger

An ordinary case follows existing domain procedure and proportional verification. Domain activation, a long checklist, several files, multiple test layers, a formal review, or an owner request does not convert it into a specialist trigger.

### Permission boundary

Every candidate cluster must independently satisfy:

1. owning domain hard-risk signal;
2. unresolved material uncertainty;
3. insufficient repository evidence and applicable main review/verification;
4. one bounded cluster with 1–3 exact questions and fixed sources;
5. expected benefit that justifies the initial context cost, with correctness/safety precedence described below;
6. current explicit permission whose count/class, domain, access, package, and action boundary covers that specialist action.

No signal grants edit, implementation, test execution, Git, remote, database, production, deployment, credential, destructive, or history-rewrite authority.

Permission coverage is evaluated per action, not necessarily per owner conversation. One exact owner instruction may authorize a bounded number or class of specialist actions, such as up to three justified independent clusters. A new owner round-trip is required only when the next action would exceed a granted count, domain, access, package, or action boundary. Permission coverage never substitutes for hard risk, material uncertainty, evidence gap, bounded context, or expected benefit.

Quota controls initial package width, deduplication, low-value calls, and unnecessary repetition. When unresolved material correctness/safety risk prevents a trustworthy main verdict and a bounded specialist could materially resolve it, that safety benefit satisfies the expected-benefit gate; token cost alone must not veto the evidence. If current permission or a valid executor/package is missing, record `not_run` and use `Blocked` when main evidence cannot establish trustworthy readiness.

## Risk-cluster construction and deduplication

For each hard-risk candidate, record:

- threatened invariant;
- concrete failure mode and material impact;
- unresolved question;
- evidence already inspected and why it is insufficient;
- source owners and bounded sources required;
- permission coverage and remaining count/class boundary.

Place two signals in one cluster when they threaten the same invariant or causal chain and a single bounded answer could resolve both. Separate them only when:

1. the threatened invariants are independent;
2. resolving one question would not resolve or materially reduce the other;
3. each has its own material impact and evidence gap;
4. each fits its own bounded package and 1–3 exact questions;
5. each independently passes benefit and current-permission coverage.

Examples:

- RLS policy, privileged request fields, permission-sensitive UI, and authorization tests for the same “only course owners may publish” invariant form one authorization cluster.
- A separate Git history-integrity uncertainty can form a second cluster because resolving application authorization does not resolve branch ancestry or recoverability.
- Three failing tests that all result from one stale fixture form one evidence-integrity cluster, not three clusters.
- Supabase concurrency and frontend optimistic rollback remain one cluster when both concern the same duplicate enrollment invariant; they may be separate only if each leaves a different independently material unresolved invariant.

There is no hard task-wide cap. A task with 2–3 genuinely independent clusters may justify 2–3 specialists, but the count is an outcome of the cluster test, never a target or default. One bounded owner authorization may cover all of them; only boundary excess requires another owner round-trip.

## Draft domain contract wording

The future implementation should preserve each skill's voice and use the smallest wording equivalent to the following. Exact prose may be tightened without changing semantics.

### Supabase / PostgreSQL

> **Specialist escalation signals**
>
> A hard-risk signal exists when observable database facts expose a potentially material uncertainty about an RLS/permission boundary, `SECURITY DEFINER`/`search_path`, destructive or compatibility-sensitive migration/backfill/constraint on existing data, transaction/lock/concurrency/idempotency invariant, trigger side effect, or permission-sensitive RPC. Group signals by the threatened data or authorization invariant.
>
> Additive migrations with known compatibility, mechanical generated-type updates, reuse of an established policy/RPC pattern, or ordinary local reset/drift checks are conditional review signals unless evidence exposes unresolved material risk. Documentation-only changes, file count, Supabase activation, or a request to “double-check” are non-triggers.
>
> Route a hard-risk candidate through the global specialist gates only after applicable main review. Existing migration, RLS, remote-DB, destructive-action, verification, and stop rules remain authoritative; no specialist signal grants database or remote permission.

Existing wording that must remain unchanged includes: never edit published migrations; never weaken RLS or constraints; surface schema/permission/data-model conflicts; never run `db push` or modify remote DB without explicit permission.

### Trust boundary / Zod

> **Specialist escalation signals**
>
> A hard-risk signal exists when observable boundary facts expose a potentially material uncertainty about authorization or privileged client fields, source authenticity for webhook/payment/upload input, validation/auth/side-effect ordering or partial failure, or a cross-module request/result contract whose mismatch can cause an unsafe side effect or materially incorrect response.
>
> Schema placement, create/update composition, FormData normalization, nullable/default semantics, and safe error-shape decisions are conditional review signals when normal source tracing and focused tests can decide them. Pure local UI types, mechanical schema composition, routine valid/invalid cases, domain activation, or payload/file count are non-triggers.
>
> Route a hard-risk candidate through the global specialist gates only after applicable main review. Validation never substitutes for auth, authenticity, RLS, constraints, or business-state checks. A signal does not authorize a side effect, implementation, or remote action.

Existing validation/auth/side-effect ordering, privileged-field, authenticity, schema SSOT, and safe-error rules remain unchanged.

### Frontend

> **Specialist escalation signals**
>
> A hard-risk signal exists when observable frontend facts expose a potentially material uncertainty about an async race or stale response, optimistic update/rollback for persisted state, permission-sensitive action/data visibility, a critical multi-step state transition with destructive or irreversible effect, or a complex accessibility interaction that blocks safe completion of a critical flow.
>
> Several loading/error/retry states, a new form or dialog, responsive work, shared-component use, or an ordinary client/server contract trace are conditional review signals unless a material invariant remains unresolved. Cosmetic/local styling, copy changes, simple rendering from an established contract, frontend activation, component count, or manual-QA need alone are non-triggers.
>
> Route a hard-risk candidate through the global specialist gates only after applicable main/integration review. Group frontend, backend, database, and test symptoms into one cluster when they threaten the same user-visible or persisted invariant. The main agent retains integration review and final readiness.

Existing hard stops for unclear business/API/status/permission/transition behavior, out-of-scope backend/DB work, and mocks entering production remain unchanged.

### Test quality

> **Specialist escalation signals**
>
> A hard-risk signal exists when observable verification facts expose a potentially material evidence gap because mocks obscure the real guarantee, the required test layer cannot establish a cross-boundary auth/persistence/concurrency invariant, nondeterministic or stale fixtures invalidate the result, or a material regression cannot be reproduced or bounded with trustworthy evidence.
>
> Choosing among otherwise adequate test layers, adding ordinary failure/boundary cases, broadening a focused suite for a known shared boundary, or preparing deterministic local fixtures are conditional review signals. Test count, coverage percentage alone, multiple available layers, a routine regression test, test-skill activation, or owner request alone are non-triggers.
>
> Route a hard-risk candidate through the global specialist gates only after applicable main review. If required safety evidence cannot be obtained, report the verification as `not_run` and use `Blocked` when the main agent cannot reach a trustworthy verdict. A specialist cannot replace required test execution or grant environment, data, browser, database, or remote permission.

Existing observable-behavior, deterministic-fixture, proportional-layer, permission-path, coverage-claim, and remote-data rules remain unchanged.

### Git checkpoint

> **Specialist escalation signals**
>
> Existing dirty-tree, base/dependency, divergence, conflict, history-rewrite, and remote-permission stop rules execute first. A hard-risk signal exists when, after that stop, observable Git facts still expose a potentially material uncertainty about change ownership, ancestry/dependency, recoverability, or history integrity that bounded read-only analysis could help resolve.
>
> A known clean base, ordinary ahead/behind inspection, a coherent correction commit, branch naming, or a non-destructive local checkpoint is a conditional or ordinary main-agent case. Dirty state, commit count, diff size, branch existence, owner commit/push request, or Git-skill activation alone is not a specialist trigger or permission.
>
> Route a hard-risk candidate through the global specialist gates only after applicable main review. Specialist advice never authorizes staging, commit, switch, merge, rebase, amend, squash, push, force-push, branch deletion, PR action, or destructive recovery.

Existing branch provenance, dirty-tree ownership, staging, correction-commit default, no-amend/squash default, force-push prohibition, and local/remote permission boundaries remain unchanged.

### Repo-skill governance

> **Specialist escalation signals**
>
> A hard-risk signal exists when observable governance facts expose a potentially material uncertainty about authority/precedence, approval or permission, activation/routing, source-of-truth ownership, lifecycle/status interpretation, safety stop behavior, evidence claims, or material fresh-reader behavior. Group wording in several skills into one cluster when it governs the same invariant.
>
> Clarifying an already-owned rule, adding a deterministic structural check within approved scope, or updating metadata/resource routing with an exact consumer is conditional unless semantic conflict remains. Typo/style-only edits, line count, validator warning alone, skill activation, or owner request alone are non-triggers.
>
> Route a hard-risk candidate through the global specialist gates only after applicable main review. Existing authority, safety veto, approval/implementation separation, resource read conditions, evaluation claim boundaries, and stop conditions remain authoritative. Every specialist or fresh-reader action must be covered by current explicit permission; one bounded instruction may cover multiple in-scope actions, and none can approve the skill change.

Existing `fresh-reader-testing.md` routing remains unchanged. The future implementation must read it because the changed governance text affects ownership, permission, lifecycle/status, and fresh-reader reporting.

## Checkpoint structure

### Approved checkpoint-commit amendment — 2026-07-24

- CP1 receives a local checkpoint commit only when its global contract is coherent, safe, valid, and non-misleading without CP2; otherwise CP1 and CP2 form one coherent implementation commit.
- When CP1 is committed independently, CP2 receives one separate commit containing all six domain contracts.
- CP3 does not require a separate commit unless its factual verification/tracker evidence is meaningful as a standalone recovery or review boundary.
- Verified CP4 or CP5 source corrections use additive commits. Do not amend, squash, or rewrite an earlier checkpoint.
- Every checkpoint commit requires targeted verification, checkpoint self-review with `0 Critical` and `0 Required`, a coherent intent, a valid intermediate repository state, and real recovery, review, or rollback value.
- CP6 performs the cumulative `base..HEAD` audit and normal-pushes the completed commit sequence. A second factual delivery-record commit and normal push are allowed only when needed to record actual hashes, remote state, and consumed permissions.
- A local checkpoint is not PR or merge readiness. Do not create empty or ceremonial commits.

### CP0 — Revalidation and permission gate

- Confirm branch/base/dependency, clean or owned worktree, current owner decision, and exact 12-file future scope.
- Re-read current global owners, six domain skills, master/per-PR records, and required fresh-reader reference.
- Record the approved plan, permissions, and checkpoint-commit amendment in the required AW-PR3B planning/tracker owners before behavior implementation.
- Stop if approval or implementation permission no longer covers the work, main moved incompatibly, or a new conflict changes ownership/scope.

### CP1 — Global multi-cluster orchestration amendment

- Update lifecycle, planning, and review owners first.
- Preserve default `0`, applicable-main-review-first, owner-request non-bypass, bounded package, one-turn/no-delegation reviewer, advisory output, integration review, `not_run`/`Blocked`, and all permission boundaries.
- Replace only the task-wide cap and same-plan second-review rule with independent-cluster semantics.
- Clarify that each action must be covered by current explicit permission, while one owner instruction may authorize a bounded count/class and only boundary excess requires a new round-trip.
- Keep quota as a package/deduplication/repetition control, never the decisive veto when bounded specialist evidence could materially resolve correctness/safety risk blocking a trustworthy verdict.
- Run targeted global source scenarios before domain edits.
- Perform a checkpoint self-review and create a local CP1 commit only if the global contract is independently coherent, safe, valid, and non-misleading without the domain sections. Otherwise continue through CP2 and commit the combined outcome.

### CP2 — Six domain signal contracts

- Add the smallest hard/conditional/non-trigger section to each domain skill.
- Reuse existing invariant and hard-stop wording rather than duplicating procedure.
- Confirm every signal routes to the global consumer and no domain section grants execution.
- Run all domain matrix and overlap scenarios.
- Perform a checkpoint self-review and, when CP1 was independently committed, create one CP2 commit containing all six domain contracts.

### CP3 — Deterministic verification and supporting records

- Run validator, structural-validator tests, source-level scenario assertions, Markdown/link/encoding/diff/scope audits, and exact changed-file accounting.
- Update progress and per-PR artifacts with actual evidence only.
- Create a separate verification-record commit only when these records contain meaningful standalone factual evidence; otherwise include them in the nearest coherent checkpoint or final delivery record.
- If validator warning snapshot changes, stop for owner scope amendment before editing test support.

### CP4 — Main integration review and corrections

- Perform adversarial formal main review across lifecycle → planning/review → six domain owners → permission and evidence boundaries.
- Verify 0 Critical and 0 Required findings remain before any external review.
- Apply only owner-authorized in-scope corrections and rerun affected checks.
- Record verified source corrections as additive commits; do not amend or squash prior checkpoints.

### CP5 — Bounded fresh-reader comprehension evidence

- This checkpoint occurs only after CP4.
- For this material governance change, prepare at least one bounded read-only case under `fresh-reader-testing.md` when a qualified executor and valid uncontaminated context are available. The case asks whether a reader without the authoring narrative can determine ownership, permission, routing, lifecycle/status, stop, or reporting behavior; it is not a specialist residual-risk review.
- Current owner direction authorizes this future checkpoint only after implementation and main self-review. Record actual package/access and `passed`, `partially_passed`, `failed`, or `not_run`; do not claim isolation or runner evidence without actual enforcement.
- If no qualified executor or valid context is available, record `fresh-reader: not_run` with the reason. Do not replace the observation with self-review or a contaminated reader.
- Add another case only for an independent material comprehension/evidence question that the first case does not cover. Do not call one reader per skill, domain, file, or specialist cluster.
- A failed/partial observation triggers main reconciliation. Missing valid executor/context is `not_run`; use `Blocked` only if the missing evidence is necessary for trustworthy delivery.
- Record any verified source correction as an additive commit and rerun affected verification plus cumulative main review.

### CP6 — Final delivery checkpoint

- Reconcile all findings, exact Git diff, tracker truth, permission consumption, rollback boundary, and remaining gaps.
- Audit the complete `base..HEAD` commit sequence and normal-push it to `origin/feat/agent-workflow-aw-pr3b` under the current explicit permission.
- Create and normal-push one additional factual delivery-record commit only when needed to record actual hashes, remote HEAD, pushed state, and consumed permissions.
- Do not create/update a PR, watch/fix CI, merge, force-push, amend/squash, rewrite history, or delete a branch.
- The main agent issues the final verdict; specialist/fresh-reader count or majority never decides readiness.

## Minimal deterministic source-level scenarios

Static source scenarios verify contract presence and ownership; they are not model behavior, native routing, fresh-reader, or isolation evidence.

| ID | Scenario | Required observable result |
| --- | --- | --- |
| G01 | Small/low-risk ordinary task | `0 specialist`; no decision evaluation unless late evidence reclassifies risk |
| G02 | Task is large, touches many files/domains, or owner asks for a specialist, but no unresolved material hard risk remains | No specialist execution; owner request only activates consideration |
| G03 | One authorization invariant appears as RLS, privileged field, UI visibility, and tests | One risk cluster and at most one default specialist package, not four |
| G04 | Authorization invariant and unrelated Git history-integrity invariant both remain unresolved and material | Two independent clusters may justify two specialists when both actions fit current explicit permission |
| G05 | Three symptoms share one stale fixture root cause | One evidence-integrity cluster |
| G06 | A cluster meets hard-risk/evidence gates but specialist permission is absent | `not_run`; `Blocked` only if main review cannot reach a trustworthy result |
| G07 | A specialist is permitted for one cluster | Read-only, one turn, 1–3 questions, fixed sources, no delegation or action authority |
| G08 | Two specialist reports disagree or overlap | Main agent verifies against sources, deduplicates by invariant, and owns final verdict; no majority vote |
| G09 | Implementation repeats a plan-stage specialist for continuity | No re-entry unless residual hard risk, insufficient main evidence, fresh package, benefit, and permission all pass |
| G10 | One owner instruction authorizes up to three bounded specialists for justified independent clusters | No per-spawn owner round-trip while count, domain, access, package, and action remain inside the grant; all non-permission gates still apply |
| G11 | Material safety risk blocks a trustworthy verdict and a bounded specialist could materially resolve it, but the call has non-zero token cost | Quota narrows/deduplicates the package but does not veto necessary evidence; missing permission/executor is `not_run`, and unresolved readiness is `Blocked` |
| D01 | Unresolved RLS/`SECURITY DEFINER` or concurrency invariant versus additive known-compatible migration versus docs/type-only DB case | Supabase hard / conditional / non-trigger distinction |
| D02 | Unresolved privileged-field/authenticity/side-effect boundary versus ordinary schema composition versus pure local UI type | Trust-boundary hard / conditional / non-trigger distinction |
| D03 | Unresolved optimistic rollback/permission/critical-flow invariant versus multi-state normal UI work versus cosmetic local change | Frontend hard / conditional / non-trigger distinction |
| D04 | Mocks/fixtures make a material guarantee untrustworthy versus ordinary layer choice versus test count/coverage alone | Test hard / conditional / non-trigger distinction |
| D05 | Stopped unresolved ancestry/ownership/history-integrity ambiguity versus clean checkpoint mechanics versus commit/push request alone | Git hard / conditional / non-trigger distinction and permission preservation |
| D06 | Material routing/permission/source/evidence conflict versus clarification of an owned rule versus typo/length warning | Governance hard / conditional / non-trigger distinction |
| F01 | Planning checkpoint before implementation/main review | Fresh-reader `not_run`; no substitute claim from self-review |
| F02 | Post-CP4 material governance contract has a qualified uncontaminated reader/context, or none is valid | At least one bounded comprehension case when available; otherwise truthful `not_run`; additional cases only for independent comprehension/evidence questions |

Scenario implementation should use deterministic assertions over exact owning sections and forbidden competing wording. Do not add a model runner or claim that static text checks prove native execution.

## Acceptance criteria

1. All nine behavior owners express one compatible contract with no duplicated domain checklist in global sources.
2. Every domain distinguishes hard, conditional, and ordinary non-trigger cases through observable source facts.
3. Default is `0 specialist`; task size, file count, domain activation, formal review, confidence, or owner request alone is insufficient.
4. No task-wide one-specialist cap remains.
5. Multiple specialists require multiple genuinely independent unresolved material risk clusters; each is separately justified, bounded, benefit-checked, and covered by current explicit permission.
6. Overlap is deduplicated by threatened invariant, causal chain, and resolvable question, not by domain/file/symptom.
7. Existing domain procedures, hard stops, permission boundaries, and remote/database/Git authority remain unchanged.
8. Missing necessary specialist evidence produces truthful `not_run` and, only when the main agent cannot reach a trustworthy result, `Blocked`.
9. Specialist output remains advisory; main-agent integration review and final verdict are explicit.
10. One owner instruction may authorize a bounded count/class of specialist actions; a new owner round-trip is required only for count, domain, access, package, or action-boundary excess.
11. Quota controls width, deduplication, low-value calls, and repetition but does not veto bounded evidence that could materially resolve correctness/safety risk blocking a trustworthy verdict.
12. After implementation and main self-review, at least one bounded fresh-reader comprehension case is expected when a qualified executor/context is available; otherwise status is `not_run`, and additional cases require independent comprehension/evidence questions.
13. Validator and deterministic source scenarios pass with no unapproved warning snapshot change.
14. Exact Git scope contains only the approved behavior and supporting record files.
15. Every checkpoint commit satisfies its targeted verification, `0 Critical / 0 Required` self-review, intermediate-state validity, and recovery/review/rollback-value gate.
16. Commit history preserves CP1/CP2 dependency, uses additive CP4/CP5 corrections, avoids ceremonial commits, and receives a final cumulative `base..HEAD` audit before normal push.

## Verification plan

Run from repository root during future implementation:

```text
node .agents/scripts/validate-skill.mjs
node --test .agents/scripts/validate-skill.test.mjs
git diff --check
```

Also run:

- deterministic G01–G11, D01–D06, and F01–F02 source assertions;
- strict UTF-8, final newline, trailing whitespace, EOL consistency, Markdown heading/fence/table, and relative-link checks;
- conflict-marker, zero-width, secret-oriented diff, reference/symlink/reparse-point, and exact changed-file audits;
- stale wording search for task-wide `at most one specialist for a plan`, `second reviewer for the same plan/checkpoint`, and domain-signal placeholder wording;
- cumulative formal main integration review with 0 Critical and 0 Required findings;
- bounded fresh-reader comprehension evidence only after CP4 and under the expected/`not_run` boundary above.

Application tests, build, browser, Supabase reset/push, database mutation, model eval runner, CI watch, and deployment are `not_run` unless future evidence and separate owner permission make one necessary. Governance-source assertions do not substitute for product or environment checks when those later become applicable.

## Rollback boundary

- Global orchestration amendment can be reverted as one coherent unit without reverting domain implementation procedure.
- Each domain signal section is independently revertible, but a domain section must not remain if its global consumer contract is removed.
- Supporting progress/decision records are corrected to describe the actual rollback; historical evidence is preserved rather than rewritten.
- No rollback may restore stale AW-PR3A merge status or claim that a reverted behavior remains implemented.
- Do not use amend, squash, force-push, destructive reset, remote mutation, or database action as a rollback mechanism without separate explicit permission.

## Stop conditions

Stop before mutation or delivery if:

- the owner has not approved this detailed plan and future implementation scope;
- implementation permission is absent;
- current `main`, AW-PR3A contract, master plan, or an owning domain skill materially conflicts with the approved plan;
- safe behavior requires an owner outside the exact 12-file future scope;
- a new validator warning requires test-support changes;
- implementation would create/move a reference or alter validator/eval/runner/CI/product/runtime/database behavior;
- a domain signal would duplicate or weaken an existing hard stop, permission rule, or implementation procedure;
- cluster independence cannot be established from threatened invariants and evidence paths;
- specialist/fresh-reader execution is proposed before applicable main review or without a bounded package and current permission;
- Git scope/ownership is unclear, the worktree contains unrelated unowned changes, or the base cannot be safely reconciled;
- any requested action requires ungranted stage, commit, push, PR, CI, merge, deployment, production, database, credential, destructive, or history-rewrite authority.

## Planning self-review record

Adversarial main-agent review is required before this planning checkpoint is reported. Record findings and corrections here; self-review is not fresh-reader evidence.

- Finding 1 — `Required`, corrected: the merged AW-PR3A task-wide one-specialist cap conflicted with the current owner decision. The master intended scope and this future implementation scope now include the minimum three global-owner amendment while preserving domain ownership.
- Finding 2 — `Required`, corrected: the first domain wording draft repeated the global applicable-main-review gate inside every domain's hard-risk definition. The draft now defines observable domain signals locally and routes candidates to the unchanged global gate, avoiding lifecycle/review duplication.
- Finding 3 — `Required`, corrected: the master summary omitted the explicit specialist-permission bullet and a historical reviewer-second gate could be read as current. The permission bullet is explicit and the historical record now points to the AW-PR3B superseding amendment.
- Stale-status reconciliation — corrected: AW-PR3A progress now records merged PR #60, merge commit, terminal checks, deleted remote feature branch, and completed AW-PR3B dependency while preserving historical pre-PR evidence.
- RQ1 — `confirmed`: `progress.md` owns current permission state, while AW-PR1/AW-PR2 are merged and their detailed records show completed/consumed historical grants. Their current permission rows are now `no`; historical evidence remains in place.
- RQ2 — `partially confirmed`: the planning-branch prohibition was located under AW-PR2's historical delivery subsection, but its final sentence was unqualified. The master, detailed plan, brief, and tracker now state that AW-PR3B reuses `feat/agent-workflow-aw-pr3b` and waits for plan approval, implementation permission, and CP0—not a separate planning-PR merge.
- RQ3 — `confirmed`: `fresh-reader-testing.md` owns narrative-independent comprehension of ownership/permission/routing/lifecycle/status/stop/reporting, and the master already expects a manual check for material governance changes. CP5 now expects at least one bounded comprehension case when a qualified uncontaminated executor/context is available, uses truthful `not_run` otherwise, and allows extra cases only for independent comprehension/evidence questions.
- RQ4 — `confirmed`: the planning owner explicitly allows one instruction to grant several permissions, so per-action coverage does not imply one owner round-trip per spawn. The plan now supports bounded count/class permission and stops only at count/domain/access/package/action-boundary excess.
- RQ5 — `confirmed`: the absolute quota sentence could conflict with the existing safety `not_run`/`Blocked` contract. Quota now controls package width, deduplication, low-value calls, and repetition; it cannot veto bounded evidence that could materially resolve correctness/safety risk blocking a trustworthy verdict.
- Cumulative correction review found and removed one residual `separately permissioned` phrase in the governance draft so it cannot recreate RQ4 ambiguity.
- Final result: `0 Critical`, `0 Required` remaining in planning scope.
- Deterministic planning checks: skill validator `valid` with the same four approved `CORE_LENGTH_SIGNAL` warnings; structural-validator tests `37/37` pass; RQ1–RQ5 semantic assertions, document hygiene, relative links, exact five-file planning scope, and `git diff --check` pass.
- Fresh-reader: `not_run` by current owner instruction.
- Approved checkpoint-commit amendment review — 2026-07-24: one `Required` tracker finding was corrected before the CP0 commit. The initial amendment advanced AW-PR3B `committed`/`pushed` from the historical planning delivery even though the program row tracks behavior delivery; both values remain `no` until implementation evidence exists.
- CP0 revalidation: fetched `origin`; branch and upstream were clean at `115ef6bfa4b9f92a655b8326c63af26c6b8f7b26`; `main == origin/main == 71f62365ef24eac75e31ff2bc4e3ad46682a11ee`; AW-PR3A head and merge commit remain ancestors of `origin/main`; exact future scope remains 12 files.
- CP0 amendment verification: validator `valid` with the unchanged four approved warnings; structural-validator tests `37/37` pass; semantic approval/permission/checkpoint assertions, strict UTF-8, final newline, trailing whitespace, balanced fences, exact three-record amendment scope, and `git diff --check` pass.
- CP0 amendment self-review result: `0 Critical`, `0 Required` remaining.
- CP0 planning-amendment commit: `9b753389589ba1d3bc859e029d809dae2b871b2d` (`docs(agent-workflow): approve AW-PR3B execution plan`); local only at the CP1 decision point.
- CP1 implementation: lifecycle, planning, and review owners now support threatened-invariant clustering, multiple independent clusters without a task-wide cap, bounded count/class permission coverage, quota safety precedence, per-cluster package evidence, and truthful `not_run`/`Blocked` outcomes without copying domain signal lists.
- CP1 targeted verification: validator `valid` with the same four warning codes and no snapshot expansion; structural-validator tests `37/37` pass; G01–G11 global source assertions and stale task-wide-cap/second-reviewer wording checks pass; `git diff --check` passes.
- CP1 checkpoint self-review: one `Required` consistency gap was corrected by adding the quota safety rule directly to the planning owner. Final result is `0 Critical`, `0 Required`.
- CP1 independence decision: the global contract is coherent, safe, valid, and non-misleading without CP2 because it preserves default `0`, requires a domain-owned hard-risk signal that does not yet exist or an owner consideration route plus every remaining gate, grants no execution authority, and makes no claim that the six domain sections are already implemented. CP1 therefore qualifies for an independent local checkpoint commit.
- CP1 specialist decision: `0 specialist`; main review and deterministic source evidence resolved the global ownership questions, so no unresolved material hard-risk cluster remained.
- CP1 implementation commit: `f31768fc4d525b985ede4c66aa7410114fd874cc` (`feat(agent-workflow): support independent specialist risk clusters`); local only at the CP2 decision point.
- CP2 implementation: all six domain owners now contain one concise `Specialist escalation signals` section with observable hard-risk, conditional-review, and ordinary non-trigger distinctions plus the applicable global route and preserved permission/procedure boundary.
- CP2 targeted verification: validator `valid` with the unchanged four warning codes and no snapshot expansion; structural-validator tests `37/37` pass; D01–D06 domain matrix, overlap, permission, and `not_run`/`Blocked` source assertions pass; `git diff --check` passes.
- CP2 checkpoint self-review: one `Required` deterministic-distinction finding was corrected by replacing the Git section's ambiguous “conditional or ordinary” phrase with explicit `conditional review signals`. The six domain diffs only add their owned signal sections and do not alter existing implementation procedures. Final result is `0 Critical`, `0 Required`.
- CP2 specialist decision: `0 specialist`; main domain review and deterministic evidence resolved the classification and ownership questions, so no genuinely independent unresolved material hard-risk cluster remained.
- CP2 implementation commit: `b9cd507c9c97de7e7314f741de58405df6092a8d` (`feat(agent-workflow): add domain escalation signals`); local only at CP3.
- CP3 cumulative verification: validator `valid` with exactly the same four `CORE_LENGTH_SIGNAL` warning codes; structural-validator tests `37/37` pass; G01–G11, D01–D06, and F01–F02 contract assertions pass; stale orchestration wording is absent; `git diff --check origin/main..HEAD` passes.
- CP3 scope audit: implementation from planning baseline `115ef6bfa4b9f92a655b8326c63af26c6b8f7b26` is exactly the approved 12 files. Cumulative branch scope from `origin/main` is exactly 14 files because it also contains the historical planning-only master plan and implementation-plan index. No skill resource, rename, move, copy, or structural change exists.
- CP3 hygiene correction: the first audit found mixed working-tree EOL caused by patch insertion into CRLF checkouts. The exact 12 implementation files were mechanically normalized to consistent CRLF without semantic changes; strict UTF-8, final newline, trailing whitespace, EOL consistency, Markdown H1/fence/table, relative-link, conflict-marker, zero-width, and secret-oriented cumulative checks then pass.
- CP3 evidence boundary: application tests, build, browser, Supabase, database mutation, model eval runner, CI, deployment, and product manual QA are `not_run` because the changed sources are governance contracts and deterministic repository checks cover the approved behavior. Static assertions remain source-contract evidence, not native routing, automatic spawn, isolated execution, or model-evaluation proof.
- CP3 checkpoint review: `0 Critical`, `0 Required`; the factual verification and scope record has standalone audit and recovery value and therefore qualifies for a local verification-record commit.
- CP4 adversarial cumulative review: reviewed `origin/main..1f715565c1cf391cf53f038ea0e9569876702530` across lifecycle, planning/review orchestration, all six domain owners, permission/evidence boundaries, checkpoint history, and supporting records.
- CP4 finding — `Required`, corrected: current-state records still used “later/future implementation” and `not implemented` wording after CP1–CP3 completed. The top-level plan, brief, and tracker now state the actual branch continuity, implemented/verified local behavior, and pending CP5/remote delivery state.
- CP4 behavior review: no duplicated domain checklist in global owners; every domain routes hard-risk candidates without granting execution; threatened-invariant deduplication, independent-cluster tests, bounded count/class permission, quota safety, advisory output, integration ownership, and `not_run`/`Blocked` behavior remain compatible.
- CP4 specialist decision: `0 specialist`; the main integration review and current deterministic evidence resolved the only material record-truth cluster. No independent unresolved hard-risk cluster remained to justify a specialist action.
- CP4 final result after correction: `0 Critical`, `0 Required`.

## CP5 fresh-reader observation

### Raw observation

```text
evidence_type: manual fresh-reader
status: partially_passed
date: 2026-07-24
scenario: One publish-authorization invariant appears across RLS, a privileged request field, permission-sensitive UI, and authorization tests; an unrelated Git ancestry/recoverability uncertainty also remains after applicable main integration review. Current permission covers up to three bounded read-only specialist actions.
bounded_prompt: Explain cluster/specialist consideration, owner round-trip behavior, unavailable executor/package status, integration/final-verdict ownership, and facts that do not independently activate execution.
supplied_context: AGENTS.md; docs/agent-loops.md; code-review-and-quality/SKILL.md; supabase-safe-migration/SKILL.md; nextjs-server-action-zod/SKILL.md; frontend-workflow/SKILL.md; test-quality-strategy/SKILL.md; git-checkpoint-workflow/SKILL.md.
executor_context: separate subagent session /root/aw_pr3b_fresh_reader with fork_turns=none; no authoring turns, expected answer, author conclusion, suspected defect, or prior observation supplied.
actual_access_and_enforcement: prompt-limited read-only package; the executor retained ordinary workspace filesystem/tool access, so source and mutation boundaries were not technically isolated. No edit, Git, remote, database, model, or delegated action was reported.
observation: The reader grouped the four authorization signals into one cluster, separated the Git invariant into a second cluster, kept every non-permission gate, recognized bounded permission coverage without a per-action round-trip, used not_run/Blocked correctly, retained main-agent integration/final-verdict ownership, and rejected task/domain/file/review/count facts as automatic triggers.
missing_or_incorrect_behavior: The reader once called the authorized count of up to three actions a quota, although the later permission explanation was correct. This blurred permission-count coverage with the separate quota controls.
known_variance: same platform/model family may have been used; no claim of model independence, filesystem isolation, runner execution, or baseline equivalence.
claim_limitations: one instruction-bounded manual comprehension case; it does not prove native routing, automatic spawn, wider domain behavior, or model-evaluation performance.
```

### Main reconciliation

- The observation's substantive clustering, permission, status, ownership, and non-trigger conclusions are supported by current sources.
- The permission-count versus quota wording is a supported comprehension finding: the reusable review owner placed count/class permission bullets under a `Quota and deduplication` heading. The smallest correction renames that section to include risk clusters and permission coverage and states that a granted count/class is a permission boundary, not quota, entitlement, target, or reason to call that many specialists.
- A second fresh-reader case was not run because repeating the same comprehension question would not be an independent evidence question. The affected validator/tests, permission-versus-quota source assertions, hygiene, and cumulative main review were rerun instead.
- CP4 additive correction commit: `e1a852462f313fafa4afc1fc0731f3e7ac5b5400` (`fix(agent-workflow): reconcile AW-PR3B checkpoint status`).
- CP5 verification after correction: validator `valid` with the unchanged four warning codes; structural-validator tests `37/37` pass; permission-versus-quota source assertions and `git diff --check` pass.
- CP5 final main review: the fresh-reader finding is corrected; `0 Critical`, `0 Required` remain. Specialist actions remain `0`; fresh-reader actions total `1`.

## CP6 delivery evidence

- CP6 fetched `origin` again before delivery. `main == origin/main == 71f62365ef24eac75e31ff2bc4e3ad46682a11ee`; `origin/feat/agent-workflow-aw-pr3b` remained at planning head `115ef6bfa4b9f92a655b8326c63af26c6b8f7b26`; local `HEAD` was six commits ahead at `7a74133367aa4f38630a1610950f2d591abd6885`.
- The cumulative audit passed before push: validator `valid` with the same four approved `CORE_LENGTH_SIGNAL` warnings and `0` errors; structural-validator tests `37/37`; 25 global/domain/fresh-reader source assertions; `git diff --check origin/main..HEAD`; exact 12-file implementation scope from planning baseline; exact 14-file cumulative branch scope from `origin/main`; strict UTF-8, final-newline, trailing-whitespace, zero-width, Markdown H1/fence, ancestry, worktree, and commit-sequence checks.
- The implementation sequence was normal-pushed successfully from remote planning head `115ef6bfa4b9f92a655b8326c63af26c6b8f7b26` to `7a74133367aa4f38630a1610950f2d591abd6885`. Post-push `HEAD`, upstream, and read-only `ls-remote` all resolved to `7a74133367aa4f38630a1610950f2d591abd6885`.
- Actual sequence after the historical planning commit: `9b753389589ba1d3bc859e029d809dae2b871b2d` CP0 plan amendment; `f31768fc4d525b985ede4c66aa7410114fd874cc` CP1 global contract; `b9cd507c9c97de7e7314f741de58405df6092a8d` CP2 six domain contracts; `1f715565c1cf391cf53f038ea0e9569876702530` CP3 verification record; `e1a852462f313fafa4afc1fc0731f3e7ac5b5400` CP4 record-truth correction; `7a74133367aa4f38630a1610950f2d591abd6885` CP5 permission-versus-quota correction.
- CP6 final review has `0 Critical`, `0 Required`. Specialist actions total `0`; the single bounded fresh-reader action and its `partially_passed` limitation remain recorded truthfully. Application/runtime/database/model-eval/CI/deployment/manual-product checks remain `not_run` for the recorded governance-only reason.
- This three-record factual update uses the separately approved delivery-record boundary. Its successful normal push consumes the remaining AW-PR3B local-commit and remote-push permission; no PR, CI watch/fix, merge, force-push, amend, squash, history rewrite, branch deletion, production, deployment, credential, or remote-database action occurred.
