---
name: implementation-planning-and-pr-breakdown
description: Repository-specific planning workflow for non-trivial implementation, refactor, migration, UI, validation, testing, and multi-PR work. Use when repository discovery, dependency ordering, PR breakdown, implementation prompts, verification strategy, or durable plan/progress documentation is needed before coding.
---

# Implementation Planning and PR Breakdown

## Activation scope

Use this skill when a task:

* is non-trivial or spans multiple files or domains
* needs repository discovery before implementation
* requires dependency or PR ordering
* may need multiple PRs, prompts, branches, or sessions
* contains assumptions, conflicts, missing requirements, or architecture choices
* changes business behavior, permissions, validation, database behavior, or state transitions
* needs acceptance criteria, verification, manual QA, an implementation brief, or progress tracking

Do not use it for trivial, obvious, single-purpose changes with unambiguous scope and verification, pure text corrections, generated-file updates, or implementation already covered by a complete approved brief with no new conflict.

Planning-only and read-only requests remain non-implementation work. An agent-authored durable plan or material revision requires owner approval before implementation. When the exact current instruction already states sufficiently clear behavior and scope and grants implementation permission, it may satisfy that gate without a separate approval turn.

## Ownership

This skill owns:

* repository-grounded discovery
* confirmed facts, assumptions, conflicts, and open questions
* current versus expected behavior
* scope and explicit exclusions
* dependency graphs and PR order
* slicing strategy and prompt boundaries
* acceptance criteria
* verification and manual QA planning
* risks, trade-offs, and progress tracking
* transferable implementation briefs

Domain skills own detailed frontend, validation, database, testing, commenting, Git, and review rules.

## Related skills

Read every skill relevant to the planned domains:

* frontend behavior: `frontend-workflow`
* UI/UX: `frontend-design`
* Server Actions, Route Handlers, Zod, FormData, payloads, and schema/type SSOT: `nextjs-server-action-zod`
* Supabase/PostgreSQL, migrations, RLS, RPC, triggers, constraints, storage, and DB integration: `supabase-safe-migration`
* test strategy and regression coverage: `test-quality-strategy`
* comments and structured documentation: `code-commenting-and-maintainability`
* bounded specialist package and reviewer contract: `code-review-and-quality`, but read it for planning only when a specialist plan-review decision is being considered or executed

Reconcile multiple domain skills before proposing order or scope.

## Resource routing

Read only the references whose conditions match:

| Resource | Read condition | Skip when |
| --- | --- | --- |
| [`references/tracked-program-and-durable-plan.md`](references/tracked-program-and-durable-plan.md) | Work belongs to a tracked multi-session/multi-PR program or needs durable plan/progress ownership | Standalone small/medium work has no tracked program |
| [`references/pr-breakdown-and-handoff.md`](references/pr-breakdown-and-handoff.md) | Splitting work into PRs/phases/prompts or producing a transferable implementation brief | Discovery needs no PR split or handoff artifact |
| [`references/qa-fixture-readiness.md`](references/qa-fixture-readiness.md) | A plan contains data-dependent manual QA or fixture/seed readiness decisions | The plan has no data-dependent manual QA |
| [`references/specialist-plan-review.md`](references/specialist-plan-review.md) | After main plan self-review, the concise core gate leaves a materially viable specialist candidate; read before deciding, packaging, executing, or reconciling that action | Default `0 specialist`, or no candidate passes the core gate |

Do not preload references merely because this skill is active. The specialist reference supplies detailed plan-specific procedure; `code-review-and-quality` owns the reusable bounded package, reviewer behavior and claim-label contract.

## Core rules

* Read before planning.
* Plan against the real repository, not only the prompt.
* Do not invent files, APIs, fields, statuses, permissions, scripts, or test infrastructure.
* Separate confirmed facts from assumptions.
* Surface conflicts instead of averaging them.
* Inspect the repository before asking questions.
* Ask only focused questions the repository cannot answer safely.
* Define success, scope, exclusions, and verification before implementation.
* Identify dependencies before choosing PR order.
* Prefer the smallest coherent unit, not the smallest file count.
* File and line counts are signals, not hard limits.
* Use vertical, foundation-first, contract-first, migration-first, risk-first, or documentation-first slicing as the dependency graph requires.
* Every planned unit must be coherent, reviewable, and verifiable.
* Do not invent smoke/E2E/Playwright/Cypress/browser automation.
* Do not make precise agent-time promises.
* Do not implement an agent-authored durable plan or material revision before owner approval. A clear current instruction may establish the applicable behavior/scope and grant implementation permission in the same turn.

## Planning modes

### Discovery mode

Use for analysis, inspection, architecture discussion, PR splitting, risk/dependency discovery, or explicit no-code requests.

In this mode:

* do not edit implementation files
* do not create patches, branches, commits, or remote actions
* inspect repository instructions, code, contracts, tests, and docs
* map current behavior and dependencies
* identify conflicts and missing requirements
* produce a concrete plan and implementation brief
* stop before implementation

“Analyze,” “inspect,” “plan,” or “review the approach” is not permission to code.

### Approved implementation handoff

Implementation may begin only when:

* the applicable plan or material decision is owner-approved, or the exact current instruction itself states sufficiently clear behavior/scope and grants implementation permission
* repository state still matches the applicable plan, brief or exact current instruction
* prerequisites are satisfied
* no new conflict invalidates the authorized behavior

For a tracked program, also load and reconcile the exact per-PR plan and recorded owner decision when they exist. A pending decision grants no implementation permission. A material conflict between those artifacts is a stop condition; an owner decision that changes material implementation behavior must be reflected in the detailed plan and re-reviewed before implementation.

Keep master-program approval, per-PR plan decision, implementation permission, commit, push, PR, merge, specialist, production and other remote permissions separate. One exact owner instruction may grant several of them without requiring another conversation turn, but never infer an action that was not stated. Plan approval and review verdicts do not grant implementation or Git/remote actions.

Stop and report any repository conflict. Do not silently reinterpret approved behavior.

## Required planning workflow

### 1. Understand the request

Identify:

* target actor and goal
* current and expected behavior
* business rules and state transitions
* permission-sensitive behavior
* data needed
* explicit scope and exclusions
* success criteria
* failure paths and constraints
* requested deliverables

Do not reduce a business task to only its nearest UI or function.

### 2. Inspect repository instructions and conventions

Read as relevant:

* applicable `AGENTS.md`
* domain skills
* package scripts and test configs
* existing plans, ADRs, progress docs, and SOPs
* related migrations, schemas, actions, components, helpers, and tests
* similar existing features

Do not apply generic framework habits over repository-specific patterns.

#### Minimum routing preflight

Before choosing discovery depth:

1. identify current owner intent, action permissions and exact exclusions;
2. apply root and nested `AGENTS.md` for the target path;
3. identify the target artifact or behavior and inspect its direct repository evidence;
4. activate and read every skill whose stated condition matches;
5. determine whether a tracked program, master/per-PR plan, owner decision, ADR, problem or deferred source owns part of the task;
6. inspect Git state when files, branches, dependencies, ownership or remote actions matter;
7. record preliminary size and the planned discovery depth.

For the exact source-routing table, tracked-program reconciliation procedure, and durable status/document ownership rules, read [`references/tracked-program-and-durable-plan.md`](references/tracked-program-and-durable-plan.md) when its routing condition matches.

### 3. Inspect the current flow

Trace the real behavior across affected layers:

```txt
entry point
→ validation and permission
→ business rule
→ mutation or side effect
→ persisted state
→ response
→ frontend feedback
→ tests and documentation
```

Confirm actual:

* paths and symbols
* payloads and result shapes
* nullable and server-owned fields
* enums, statuses, relationships, and ownership
* permission and RLS behavior
* loading, empty, error, success, pending, and disabled states
* verification commands
* branch or PR prerequisites when documented

Search relevant sections of generated files; do not read them blindly.

### 4. Classify evidence

#### Confirmed facts

Verified from code, docs, types, migrations, tests, approved requirements, or primary external documentation.

#### Assumptions

Reasonable but unverified beliefs that affect the plan.

#### Conflicts

Incompatible requirements, repository behavior, skills, or documentation.

#### Open questions

Material questions remaining after repository inspection.

Never present assumptions as facts or hide conflicts inside the proposed solution.

#### Two-pass sizing and adaptive plan depth

Record preliminary size after routing. Re-evaluate during discovery after ownership, dependencies, risk and verification are understood, and before implementation.

Use observable signals:

* **Small:** one clear owner and outcome; no material behavior, permission, status or dependency change; local rollback and verification are obvious. Use a micro-plan in the action or response.
* **Medium:** several files may serve one bounded contract; ownership is stable, no material decision is missing, and targeted verification/rollback remain coherent. Use a concise response plan or approved brief.
* **Large/high-risk:** multiple owners or dependency chains; governance, permission, security, DB/auth/concurrency or deferred-scope risk; a material decision; or complex verification/rollback. Use an authoritative durable plan and plan self-review.

Escalate depth when discovery finds another source of truth, a repository/approved-source conflict, a material behavior/permission/architecture/dependency decision, deferred scope, an unclear base or ownership boundary, a new hard-risk domain, more complex verification/rollback, an indistinguishable safe/unsafe scenario, or a structural/tooling prerequisite outside scope.

File count alone never determines size. Escalation changes discovery, planning and review depth; it does not grant implementation, specialist, Git, remote, production or destructive permission.

### 5. Build the dependency graph

For each dependency, record:

* prerequisite
* dependent work
* reason
* hard or soft dependency
* merge order
* parallelization safety

A common flow is:

```txt
database invariant or migration
→ generated/database types
→ schema and payload contract
→ action/handler/RPC wrapper
→ frontend integration and UI
→ tests and manual QA
```

Use the real graph. PR numbering does not prove implementation order.

### 6. Choose a slicing strategy

* **Vertical slice:** one complete, safe user behavior across required layers.
* **Foundation-first:** shared prerequisite needed by later changes.
* **Contract-first:** stable schema/interface/RPC needed for parallel work.
* **Migration-first:** DB/RLS/RPC/backfill must exist before consumers.
* **Risk-first:** prove a high-uncertainty assumption early.
* **Documentation-first:** establish plans, ADRs, or repository workflow before product work.

Prefer vertical delivery when coherent. Do not force it across unsafe prerequisites or unrelated risks.

### 7. Define PR or phase boundaries

Each PR or phase must represent one coherent, reviewable outcome. Do not combine independent product changes, opportunistic cleanup, unrelated refactors, or different dependency chains. Read [`references/pr-breakdown-and-handoff.md`](references/pr-breakdown-and-handoff.md) for the full boundary record when this work needs a split or transferable handoff.

### 8. Define implementation prompts

Split a PR into prompts only when useful. Every prompt must complete a coherent logical increment with exact and forbidden scope, acceptance criteria, relevant verification, required progress updates, and a coherent reviewable repository state. Do not separate required implementation and direct regression coverage merely to create more prompts. Use [`references/pr-breakdown-and-handoff.md`](references/pr-breakdown-and-handoff.md) for the detailed procedure.

### 9. Write acceptance criteria

Acceptance criteria describe observable behavior or enforceable guarantees:

```txt
Actor + action + condition + expected result
```

Good:

```txt
A teacher cannot submit a course when readiness checks fail.
Duplicate payment webhooks consume a reservation at most once.
```

Avoid “the feature works,” “the UI is improved,” or “the code is clean.”

### 10. Plan verification and manual QA

Derive checks from repository scripts, configs, existing tests, and domain skills.

For each unit identify:

* targeted tests
* broader regression checks when shared behavior changes
* lint/typecheck/build when applicable
* DB reset or integration checks when applicable
* manual UI/behavior checks
* checks the agent cannot perform
* completion evidence

Use the smallest set that gives strong confidence. Do not invent unavailable infrastructure.

Manual QA may remain pending for a local checkpoint, but completion criteria must state when it blocks approval or merge.

For data-dependent QA, decide fixture readiness before implementation reaches final UI or browser QA. Read [`references/qa-fixture-readiness.md`](references/qa-fixture-readiness.md) for the exact outcome record and compact planning template. Do not require fixture readiness for tasks without meaningful data-dependent QA.

### 11. Analyze risk and trade-offs

For each meaningful risk record:

* risk and uncertainty
* impact
* mitigation
* earliest phase that exposes it

Typical risks include schema compatibility, RLS/authorization, status transitions, concurrency/idempotency, stale UI state, shared-component regressions, migration safety, incomplete contracts, and missing test infrastructure.

Mandatory prerequisites come first; within valid order, expose high-risk assumptions early.

### 12. Plan documentation and progress tracking

For multi-PR or multi-session work, define the owning plan/progress paths, truthful status vocabulary, update points, evidence, and deviation handling. Do not invent paths or mark work complete before its criteria are satisfied. Read [`references/tracked-program-and-durable-plan.md`](references/tracked-program-and-durable-plan.md) for the detailed durable-plan decision, status ownership, and self-review procedure.

#### Specialist plan-review decision

Main-agent self-review comes first. Default to `0 specialist`; small tasks use `0 specialist`, and a domain skill being activated, several files changing, or a plan being large does not itself justify another reviewer.

Consider a specialist for each candidate risk cluster only when all of these are true:

* an already-activated owning domain skill supplies a concrete hard-risk signal, or the owner explicitly requests a specialist perspective;
* the remaining uncertainty can materially invalidate the plan;
* repository evidence and main review are insufficient;
* the uncertainty can be expressed as 1–3 exact questions with fixed context;
* expected benefit justifies the initial context/quota cost;
* current permission explicitly allows the specialist action.

Do not invent a hard-risk signal from a subjective sense that work is “large” or “complex.” Use only an observable hard-risk signal supplied by an activated owning domain skill, or an explicit owner request that activates consideration while leaving every other gate in force.

When a candidate passes every core condition, read [`references/specialist-plan-review.md`](references/specialist-plan-review.md) before deciding, packaging, executing, or reconciling the specialist action, and read `code-review-and-quality` for the reusable bounded package, reviewer behavior, and claim-label contract. The main agent retains plan integration, correction decisions, reconciliation ownership, and the final recommendation.

## Planning output

Scale the output to task size, but keep goals, facts and assumptions, conflicts, scope and exclusions, dependencies, acceptance criteria, verification/manual QA, risks, stop conditions, and completion criteria directly visible. Read [`references/pr-breakdown-and-handoff.md`](references/pr-breakdown-and-handoff.md) when the work needs the full plan template, PR/prompt breakdown, parallelization decision, or transferable implementation brief. A later implementation session follows the approved brief and stops on conflicts rather than silently changing it.

## Scope control

Classify adjacent issues as:

```txt
required for current scope
recommended follow-up
out of scope
blocking conflict
```

List expected and forbidden domains. Separate product work, refactors, infrastructure, and optional polish.

Planning checkpoints are approval boundaries, not Git operations. `git-checkpoint-workflow` owns commit history.

## Red flags

* implementation starts during Discovery mode
* file paths or contracts are proposed before inspection
* assumptions are presented as facts
* conflicts are hidden
* PR order follows numbering instead of dependencies
* scope or exclusions are missing
* verification is missing or invented
* file count is treated as a hard limit
* unrelated outcomes share one PR
* manual QA is omitted for non-trivial UI
* data-dependent QA reaches final browser validation without an explicit fixture-readiness outcome
* progress is marked complete before verification
* parallel work starts before contracts stabilize

## Final checklist

* [ ] Relevant instructions and skills were read
* [ ] Minimum routing preflight and context-expansion reasons were recorded at the depth the task requires
* [ ] Preliminary and final sizing were completed without using file count as the sole rule
* [ ] Tracked-program plan, status/problem and owner-decision artifacts were reconciled when they exist
* [ ] Current repository behavior was inspected
* [ ] Facts, assumptions, conflicts, and questions are separated
* [ ] Scope and exclusions are explicit
* [ ] Dependency graph and PR order are justified
* [ ] Slicing strategy fits the dependencies
* [ ] Every PR/prompt has acceptance criteria and verification
* [ ] Manual QA and forbidden scope are explicit
* [ ] Data-dependent QA records one fixture-readiness outcome before final browser QA
* [ ] Risks and progress tracking are defined
* [ ] Any durable plan received main self-review and required corrections
* [ ] Any specialist plan-review decision defaults to 0, uses a concrete hard-risk/owner trigger, records permission and quota benefit, and routes to the bounded review contract
* [ ] Multiple specialists, delegation, broad whole-plan review or unbounded context were not inferred from domain/file/symptom count; every action has an independent cluster justification and current permission coverage
* [ ] The implementation brief is transferable
* [ ] Any agent-authored durable plan or material revision was owner-approved before implementation; otherwise the exact current instruction clearly established behavior/scope and implementation permission
* [ ] Plan decision, implementation permission and Git/remote permissions are explicit and not inferred from one another
