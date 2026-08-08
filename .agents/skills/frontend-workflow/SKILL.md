---
name: frontend-workflow
description: "End-to-end frontend engineering workflow for non-trivial React and Next.js tasks: repository discovery, contract inspection, UI/UX planning, implementation, state and async behavior, tests, manual validation, performance review, and final audit."
---

# Frontend Workflow Skill

## Activation scope

Use this skill for non-trivial frontend work involving pages, components, forms, dialogs, tables, dashboards, learning/authoring/admin flows, client/server boundaries, state, async behavior, API/Server Action/Supabase integration, validation, mocks, responsive behavior, accessibility, tests, performance, manual QA, or frontend audits.

Do not use it for pure docs, DB-only work with no frontend impact, generated files, trivial text edits, or an isolated unambiguous class-name change.

## Related skills

Use:

* `frontend-design` for UI hierarchy, layouts, forms, dialogs, responsive behavior, accessibility, motion, and product-facing interaction
* `nextjs-server-action-zod` for schemas, React Hook Form validation, Server Actions, Route Handlers, payloads, FormData, inferred types, and schema/type SSOT
* `test-quality-strategy` for test planning and regression coverage
* `supabase-safe-migration` for DB schema, migrations, RLS, RPC, triggers, constraints, and DB-backed integration
* `code-commenting-and-maintainability` for comments and structured documentation

Read all relevant skills. A frontend task must not silently expand into backend, database, RLS, or migration changes.

## Resource routing

Read every reference whose condition matches before making the affected decision:

| Resource | Read condition |
| --- | --- |
| [references/mock-data.md](references/mock-data.md) | Read before adding or reviewing typed mocks, or when backend behavior is missing and UI-only/prototype scope is considered. |
| [references/async-state-and-forms.md](references/async-state-and-forms.md) | Read before implementing or reviewing an async mutation, optimistic update, form, dynamic field, or complex client-state transition. |
| [references/manual-ui-validation.md](references/manual-ui-validation.md) | Read before planning, running, or reporting browser/manual UI validation; also read its responsive subsection when responsive behavior is material. |

Read all matching references when conditions overlap. Fully integrated work with no mock decision may skip the mock reference; static composition with no async, form, or complex client state may skip the async/form reference; tasks with no browser/manual-QA decision and no material responsive behavior may skip the manual-validation reference.

A generic implementation-handoff field for later manual checks does not by itself trigger the manual-validation reference; read it when task-specific browser/manual QA is actually being planned, run, reported, or decided. A missing backend contract triggers the mock reference only when explicit UI-only, prototype, or unavailable-backend scope is under consideration; do not load it merely to propose that scope after a hard stop.

Rendering or testing several UI state variants does not by itself trigger the async/form reference. Read it only when the task facts establish an async mutation, optimistic update, form, dynamic field, or genuinely complex client-state transition.

For browser/manual UI validation, use the manual-QA state matrix, fixture-readiness gate, and verification-scope rules owned by `test-quality-strategy`; required fixtures and stable focused checks must exist before browser execution.

## Core rules

* Read before writing and understand the business flow, not only visible controls.
* Inspect the repository before proposing paths, components, contracts, or data shapes.
* Use `frontend-design` for visual and interaction direction.
* Do not implement non-trivial work without a concrete approved plan.
* Do not invent behavior, APIs, fields, enums, permissions, or status transitions.
* Prefer repository conventions and make surgical changes.
* Do not modify shared UI for one local screen.
* Do not add route-specific hardcoded toast theme hacks; keep the shared toast light by default until a separate cross-route theme-system PR is approved.
* Do not fake production success.
* Typed mocks are allowed only behind an explicit boundary.
* Implement meaningful loading, empty, error, success, pending, disabled, and permission states.
* Prevent double submission and preserve useful input after recoverable failures.
* Test observable behavior.
* Review real performance risks without speculative optimization.
* Perform or request task-specific manual UI validation.
* Audit the final diff.
* Follow the comment skill for general rules and document frontend-specific correctness constraints when non-obvious.
* Stop on conflicts instead of silently choosing behavior.

## Specialist escalation signals

A hard-risk signal exists when observable frontend facts expose a potentially material unresolved uncertainty about an async race or stale response; optimistic update and rollback for persisted state; permission-sensitive action or data visibility; a critical multi-step state transition with a destructive or irreversible effect; or a complex accessibility interaction that blocks safe completion of a critical flow.

Several loading, error, or retry states; a new form or dialog; responsive work; shared-component use; and an ordinary client/server contract trace are conditional review signals unless a material invariant remains unresolved. Cosmetic or local styling, copy changes, simple rendering from an established contract, frontend activation, component count, and manual-QA need alone are ordinary non-triggers.

Route a hard-risk candidate through the global specialist gates only after applicable main or integration review. Group frontend, backend, database, and test symptoms into one cluster when they threaten the same user-visible or persisted invariant. The main agent retains integration review and final readiness.

## Modes

### Discovery

For analysis, inspection, planning, SOP review, or explicit no-code work:

* do not edit or create patches
* inspect instructions, repository flow, contracts, tests, and UI conventions
* identify conflicts and missing requirements
* produce a concrete plan and transferable brief
* stop before implementation

### Implementation

Begin only after explicit approval, an approved SOP/brief, or a trivial unambiguous task.

Recheck the approved plan against the repository. Stop on conflict.

### Review

For diffs, audits, regressions, or completion checks:

* inspect implementation and call sites
* compare against approved behavior
* review states, boundaries, and failure paths
* run relevant checks
* identify missing automated/manual validation
* avoid unrelated redesign

## Required workflow

### 1. Understand the task

Identify:

* target user and goal
* current and expected behavior
* business rules and state transitions
* scope and exclusions
* success criteria and failure paths
* permission-sensitive behavior
* data required by the UI

Trace the wider workflow for context, but implement only approved scope.

### 2. Inspect repository and contracts

Read as relevant:

* `AGENTS.md`, skills, package scripts, and test config
* target route/page, layout, feature folder, components, and similar screens
* shared UI usages and existing responsive/toast/icon/animation conventions
* DB/generated types, relationships, nullable/server-owned/status/permission fields
* Zod schemas, inferred types, resolvers, normalization, and error helpers
* actual Server Action/Route Handler/API/Supabase/RPC signatures and result shapes
* existing tests, fixtures, ADRs, SOPs, and progress docs

Search relevant sections of large generated files; never edit generated DB types manually.

Do not invent a missing contract. Report it.

Before changing `components/ui/*`, inspect usages and prefer props, `className`, composition, or a feature wrapper.

### 3. Inspect integration behavior

Confirm:

* input payload and output shape
* success and error result
* auth/permission assumptions
* cache/revalidation behavior
* pagination, filtering, sorting, retry, and duplicate-submission behavior
* notifications, realtime, audit metadata, or activity logs when relevant

Do not add adjacent systems unless they are in scope.

### 4. Plan UI/UX

Classify the screen with `frontend-design`.

Define:

* hierarchy and main interaction
* primary, secondary, and destructive actions
* component boundaries and density
* dialog context and consequence
* responsive and mobile behavior
* accessibility
* useful versus unnecessary motion
* loading, empty, error, success, pending, and disabled feedback

Important confirmations normally identify the object, action, consequence, and reversibility.

For substantial dashboard or page-composition work, define hierarchy before coding. A compact proposal is sufficient:

```txt
Desktop:
- primary learning/action area
- secondary review area
- utility/payment area

Mobile:
- first priority
- second priority
- deferred utility content
```

Use the actual product areas for the task. The goal is to prevent incorrect section order, excessive empty space, or secondary utility content dominating the first viewport. Do not create a new design-discovery phase for small focused adjustments.

### 5. Plan state and transitions

Consider only meaningful states:

```txt
initial loading loaded empty error submitting success disabled
permission denied stale data partial data missing optional data
```

Decide whether each value belongs to local, form, derived, URL, server, cached, or shared state.

Prefer derived state over duplication. Avoid independent booleans that allow impossible combinations.

For complex flows, define transitions explicitly and use a reducer, hook, or state machine only when simpler state is unsafe.

Do not add a state library without repository precedent or approval.

### 6. Produce a plan and brief

For non-trivial tasks, plan:

```txt
Task understanding
Repository context and contracts
UI/UX direction
Proposed solution
Files to create/modify
Files and domains not to touch
Risks and open questions
Automated verification
Manual UI checks
```

At the end of Discovery mode, produce:

```txt
Approved goal and business rules
Confirmed UI behavior
Relevant files and contracts
Files/domains not to touch
Required states and transitions
Data integration and mock strategy
Automated verification
Manual UI validation
Known limitations
```

Ask only focused questions the repository cannot answer.

## Implementation rules

### Scope and components

Do not refactor unrelated modules, redesign adjacent screens, rename unrelated files, alter DB/RLS/migrations from a frontend-only task, install packages, run shadcn CLI, replace libraries, or add speculative abstractions.

Prefer existing components, wrappers, helpers, schemas, toasts, and route structure.

Classify components as page-specific, feature-specific, feature-reusable, cross-product reusable, or global primitive.

Do not put business-specific behavior in `components/ui/*` or create a global abstraction from superficial markup similarity.

## Testing

Use `test-quality-strategy` and the smallest layer that proves the behavior.

Add component/form tests for conditional rendering, status/permission actions, dialogs, validation, loading/error/empty/success/pending states, dynamic fields, and regression-prone interaction.

Extract pure logic tests for state transitions, filtering/sorting, stage progression, answer evaluation, permissions, normalization, reducers, and optimistic rollback.

Test observable outcomes, valid/invalid transitions, retries, reset, failure recovery, and invariants. Avoid testing internal React state without user-visible value.

## Performance review

Inspect realistic risks:

* client/server component boundaries
* request waterfalls and duplicate work
* unnecessary state/effects/rerenders
* unstable keys or identities
* expensive render work
* large lists, payloads, images, or bundles
* pagination/virtualization needs
* frequent realtime events
* heavy animation

Do not add `useMemo`, `useCallback`, `React.memo`, virtualization, state libraries, or caching without a concrete reason and repository fit.

Do not claim improvement without evidence.

## Final audit

After implementation and verification, confirm:

* approved scope and behavior
* no unrelated changes
* contracts and boundaries are accurate
* meaningful states and failure paths are safe
* duplicate/impossible state is avoided
* permissions and mocks are truthful
* shared components remain safe
* responsive and accessibility behavior were reviewed
* realistic performance risks were reviewed
* comments document only non-obvious frontend correctness constraints
* temporary logs, dead code, and unused imports are removed
* tests protect meaningful behavior

Rerun affected checks if the audit required edits.

## Frontend-specific comments

Follow `code-commenting-and-maintainability`.

Document only non-obvious correctness constraints such as reducer/state-machine transitions, optimistic rollback, request races, stale responses, form/URL/local/server synchronization, permission/status visibility, mock/real adapter boundaries, cleanup preventing stale updates, or measured memoization.

Explain why the behavior exists; do not narrate rendering syntax.

## Hard stops

Stop when:

* business, API, status, permission, or transition behavior is unclear
* SOP and repository conflict
* required data or contract is missing
* backend/DB work is outside approved scope
* shared-component impact is uncertain
* mock data could enter a production path
* tests conflict with approved behavior
* a server-owned field would be exposed
* an optimistic update lacks safe rollback

Never invent product behavior, APIs, fields, enums, or success.

## Definition of done

A frontend task is complete only when:

* approved behavior is implemented
* `frontend-design` is followed
* relevant DB/domain, Zod, and integration contracts were inspected
* mocks are isolated and explicit
* meaningful states and transitions are safe
* component and shared-UI boundaries are appropriate
* responsive, accessibility, and performance risks were reviewed
* relevant automated checks passed
* required manual QA is complete or explicitly pending
* final diff and comments were audited
* limitations and excluded work are documented

## Final response

Report:

```txt
Implemented behavior and design direction
Files changed and why
Contracts/schemas/integration inspected or changed
Mocks and shared components used
UI states and permission behavior
Responsive, accessibility, and performance review
Tests and verification commands/results
Manual UI checks completed or pending
Known limitations and intentionally excluded work
```

Use exact file paths, skill identifiers, contract names, verification commands, and pending manual checks when that evidence is available; do not replace them with generic categories.
