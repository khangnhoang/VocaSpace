# PR breakdown and implementation handoff

Read this reference when splitting work into PRs, phases, or prompts, or when producing a transferable implementation brief. Skip it for discovery answers that need no PR split or handoff artifact.

## Define PR or phase boundaries

Each PR or phase must represent one coherent, reviewable outcome. A phase is not automatically a Stage; use the hierarchy procedure in `spec-state-and-hierarchy.md` when a durable plan needs multiple Checkpoints, any Stage, or cross-session State.

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
Binding guardrails:
Bounded implementation hypotheses:
Acceptance criteria:
Automated verification:
Manual QA:
Risks and mitigations:
Completion criteria:
```

Use the same structure for phases when only one PR is needed.

## Define implementation prompts

Split a PR into prompts only when useful.

Each prompt must:

* complete one coherent logical increment
* state binding allowed and forbidden scope
* distinguish required domains from likely file/wiring hypotheses
* include acceptance criteria and relevant verification
* update required State or progress documentation without duplicating their owners
* leave the repository coherent and reviewable

Do not separate required implementation and direct regression coverage merely to create more prompts.

## Planning output

Adapt this template to task size:

```txt
# Implementation Plan: <name>

## Status and Authority
## Binding Spec
### Outcome and Acceptance
### Explicit Scope and Non-goals
### Necessary Execution Guardrails
### Owner Decisions and Unresolved Material Ambiguity
## Current Repository Facts
## Assumptions and Bounded Implementation Hypotheses
## Conflicts and Open Evidence
## Relevant Skills and Instructions
## Current Architecture and Data Flow
## Proposed Solution
## Alternatives and Trade-offs
## Dependency Graph
## PR Dependency Order
## PR Breakdown
## Steps / Checkpoints / Stages (use the shallowest meaningful hierarchy)
## Verification Strategy
## Integration and Final Cumulative Review (only when justified)
## Manual QA Strategy
## QA Fixture Readiness (when data-dependent)
## Documentation and Progress Tracking
## Known Limitations
## Specialist Review Decision (when relevant)
## State — Current Resume Projection
```

Do not omit dependencies, exclusions, verification, or completion criteria merely to shorten a non-trivial plan.

## Implementation brief

End Discovery mode with a concise handoff:

```txt
## Approved Goal
## Confirmed Business Rules and Repository Behavior
## Binding Spec and Necessary Execution Guardrails
## Bounded Implementation Hypotheses
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
## Current State and Resume Point
```

A later implementation session follows the binding Spec and guardrails, may replace a bounded hypothesis with an evidenced equivalent, records the deviation in State, and stops when repository evidence challenges the binding contract.

## Sizing and parallelization

Evaluate size by independent outcomes, domains, dependency chains, migration/permission/concurrency risk, verification complexity, and rollback needs—not only file or line count.

Work may run in parallel only when:

* prerequisites are satisfied
* contracts are stable
* file and state ownership will not conflict
* integration order is known
* each stream has independent criteria

Migrations, shared contracts, permission/status models, and overlapping shared components normally require sequential work.
