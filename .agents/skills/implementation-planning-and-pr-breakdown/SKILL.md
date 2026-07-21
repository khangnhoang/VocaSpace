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

Planning is read-only until the user approves implementation.

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

Reconcile multiple domain skills before proposing order or scope.

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
* Do not implement before the user approves the plan.

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

* the user approves the plan or provides an approved brief
* repository state still matches the plan
* prerequisites are satisfied
* no new conflict invalidates the approved behavior

For a tracked program, also load and reconcile the exact per-PR plan and recorded owner decision when they exist. A pending decision grants no implementation permission. A material conflict between those artifacts is a stop condition; an owner decision that changes material implementation behavior must be reflected in the detailed plan and re-reviewed before implementation.

Keep master-program approval, per-PR plan decision, implementation permission, commit, push, PR, merge, specialist, production and other remote permissions separate. One exact owner instruction may grant several of them, but never infer an action that was not stated. Plan approval and review verdicts do not grant implementation or Git/remote actions.

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

Use these source conditions instead of broad-reading the repository:

| Source | Read when | Do not read merely because |
| --- | --- | --- |
| Root/nested `AGENTS.md` | It applies to the target path | Never skip an applicable instruction file |
| Activated skill | Its activation or discovered-scope condition matches | Its name sounds adjacent |
| Direct repository evidence | The target or its consumer is needed to understand the contract | More context feels safer without an ownership signal |
| Master plan | The task belongs to the program or can change intended scope, dependency or approved direction | An unrelated small edit exists in the same repository |
| Progress/problem source | The tracked task can change current status/evidence or addresses a recorded problem | A tracker exists but has no matching consumer |
| ADR or deferred source | The task can change its owned decision or pull deferred behavior into scope | A local correction does not affect that decision |
| Per-PR plan and owner record | Implementing, fixing or reviewing that exact unit and the artifacts exist | The task belongs to another unit or no artifact exists |
| Git state | A file/branch/checkpoint/remote mutation or baseline/ownership decision is involved | A pure explanation is independent of repository state |

Open additional context only when a direct link, shared contract consumer, source conflict, changed ownership/dependency, deferred-scope signal, verification gap, unclear Git state or activated-skill route makes it relevant. Record the source, triggering evidence, question to answer and whether it may change. Do not broad-read a bundle to search for possible relevance.

Record `not applicable` only when the absent/inapplicable source affects a decision or gives the owner useful audit evidence. Do not force small tasks to enumerate irrelevant categories or create a file to make a taxonomy complete.

#### Tracked-program reconciliation

When direct evidence shows that a task belongs to a tracked program:

1. read the authoritative program scope, current progress/problem sources and the program-owned artifact convention when present;
2. load the exact per-PR detailed plan and owner decision record when they exist;
3. reconcile behavior, scope, ownership, dependency, acceptance criteria, verification and permission across them;
4. treat a pending owner record as no implementation permission and stop on a material conflict;
5. update the detailed plan within planning permission and re-review it when an explicit owner decision materially changes the implementation contract;
6. do not create empty, retrospective or duplicate per-PR artifacts without a current consumer.

The tracked program owns its artifact layout. This skill owns the generic reading and reconciliation procedure and must not hard-code one program's paths.

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

Each PR or phase must represent one coherent, reviewable outcome.

It may span several files or layers when they serve one behavior or contract.

Do not combine independent product changes, opportunistic cleanup, unrelated refactors, or different dependency chains.

For each PR define:

```txt
Title:
Goal and outcome:
Priority:
Depends on:
Must merge before:
Can run in parallel:
Branch baseline:
Required sync:
Reason for order:
Scope:
Out of scope:
Expected files/domains:
Files/domains not to touch:
Implementation approach:
Acceptance criteria:
Automated verification:
Manual QA:
Risks and mitigations:
Completion criteria:
```

Use the same structure for phases when only one PR is needed.

### 8. Define implementation prompts

Split a PR into prompts only when useful.

Each prompt must:

* complete one coherent logical increment
* state exact and forbidden scope
* identify likely files or domains
* include acceptance criteria and relevant verification
* update required progress documentation
* leave the repository coherent and reviewable

Do not separate required implementation and direct regression coverage merely to create more prompts.

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

For data-dependent QA, decide fixture readiness before implementation reaches final UI or browser QA. Use `test-quality-strategy` for the state matrix, canonical fixture assessment, deterministic fixture rules, verification scope, evidence, and manual-QA completion criteria; use `frontend-workflow` for browser timing, responsive checks, and interaction/visual validation.

Record exactly one outcome:

* existing canonical fixture is sufficient
* canonical fixture requires the following narrow additions
* manual QA does not require seeded data
* fixture preparation is blocked and requires owner input

Use this compact section when the task has meaningful data-dependent QA:

```txt
### QA fixture readiness

- QA type:
- Canonical fixture source:
- Existing covered states:
- Missing states:
- Required fixture additions:
- Reset/setup command:
- Fixture checkpoint:
- Browser QA may begin when:
```

Do not require this section for tasks without meaningful data-dependent QA. Do not postpone the decision until final manual QA, and do not reproduce the owning skills' detailed fixture or browser rules in the plan.

### 11. Analyze risk and trade-offs

For each meaningful risk record:

* risk and uncertainty
* impact
* mitigation
* earliest phase that exposes it

Typical risks include schema compatibility, RLS/authorization, status transitions, concurrency/idempotency, stale UI state, shared-component regressions, migration safety, incomplete contracts, and missing test infrastructure.

Mandatory prerequisites come first; within valid order, expose high-risk assumptions early.

### 12. Plan documentation and progress tracking

For multi-PR or multi-session work, inspect repository conventions and define:

* plan and progress paths
* status vocabulary
* update points
* verification evidence to record
* how deviations are documented

Useful statuses:

```txt
not started
in progress
blocked
implemented
automated checks passed
manual QA pending
completed
```

Do not invent paths or mark work complete before its criteria are satisfied.

#### Durable-plan decision and self-review

A durable plan is required when large/high-risk work needs continuity across sessions or agents, spans multiple owners or dependencies, defines an exact permission contract, requires a material owner decision, has ordered phases, or needs an auditable rollback boundary.

Do not create a plan file for small clear work, bounded medium work already covered by a concise approved brief, or work already owned by a complete authoritative plan. Update the owning source when permitted; do not duplicate master plans, trackers, ADRs or problem records.

After a durable draft stabilizes, the main agent must review it against:

* owner-confirmed goal, exclusions and permissions;
* current repository behavior and direct implementation evidence;
* owning master plan, ADR, per-PR owner record and progress/problem sources;
* source ownership, dependency/order and branch baseline;
* observable acceptance criteria and proportional verification/manual QA;
* expected and forbidden files/domains;
* permission, stop and rollback boundaries;
* self-contradiction, stale claims, invented contracts and hidden scope expansion.

Correct supported findings within current planning permission and re-review. Self-review cannot approve a material agent-authored decision or grant implementation, commit, push, PR, merge or remote permission.

#### External feedback reconciliation

Treat each feedback item as a claim and classify it as exactly one of:

```txt
đúng trong scope (correct in scope)
đúng nhưng cần scope/decision mới (correct but requires new scope or decision)
sai (incorrect)
stale
xung đột (conflicting)
không đủ evidence (insufficient evidence)
```

Evaluate claims using higher-level safety and exact current owner decisions first, then repository routing and owning domain skills, approved master/ADR/per-PR contracts, actual repository/Git facts, and finally progress/problem sources within their status ownership. Reviewer assertions remain claims until verified.

Fix only claims that are correct and within current correction permission. Stop for material scope, decision or permission changes. Do not use majority vote, and do not treat a review verdict or confidence label as action permission. Formal implementation-review and specialist orchestration remain owned by their review workflows.

## Planning output

Adapt this template to task size:

```txt
# Implementation Plan: <name>

## Goal
## Current Repository State
## Confirmed Requirements and Facts
## Assumptions
## Conflicts and Open Questions
## Explicit Scope
## Out of Scope
## Relevant Skills and Instructions
## Current Architecture and Data Flow
## Proposed Solution
## Alternatives and Trade-offs
## Dependency Graph
## PR Dependency Order
## PR Breakdown
## Implementation Prompt Breakdown
## Verification Strategy
## Manual QA Strategy
## QA Fixture Readiness (when data-dependent)
## Documentation and Progress Tracking
## Known Limitations
```

Do not omit dependencies, exclusions, verification, or completion criteria merely to shorten a non-trivial plan.

## Implementation brief

End Discovery mode with a concise handoff:

```txt
## Approved Goal
## Confirmed Business Rules and Repository Behavior
## Dependencies and Required Order
## Approved PR or Prompt Scope
## Relevant Existing Files and Contracts
## Files and Domains Not to Touch
## Required State Transitions
## Data and Integration Strategy
## Automated Verification
## Manual QA
## QA Fixture Readiness (when data-dependent)
## Progress Documentation
## Known Risks and Limitations
```

A later implementation session follows this brief and stops on conflicts rather than silently changing it.

## Sizing and parallelization

Evaluate size by independent outcomes, domains, dependency chains, migration/permission/concurrency risk, verification complexity, and rollback needs—not only file or line count.

Work may run in parallel only when:

* prerequisites are satisfied
* contracts are stable
* file and state ownership will not conflict
* integration order is known
* each stream has independent criteria

Migrations, shared contracts, permission/status models, and overlapping shared components normally require sequential work.

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
* [ ] The implementation brief is transferable
* [ ] The user approved the plan before implementation; a pending decision remains read-only
* [ ] Plan decision, implementation permission and Git/remote permissions are explicit and not inferred from one another
