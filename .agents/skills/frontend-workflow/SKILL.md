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

## Mock data

Typed mock data is allowed only for explicit UI-only, prototype, or unavailable-backend scope.

It must be:

* typed, deterministic, isolated, and clearly named
* easy to replace
* representative of complete, empty, error, long, null, and status variants

Do not scatter hardcoded mocks through production components.

When a production mutation is missing:

* do not show fake success
* do not deceptively update production state
* do not use local storage as a hidden backend

Use a typed callback/adapter, view-only implementation, clearly disabled action, explicit integration TODO, or stop and ask whether backend scope should be added.

## Implementation rules

### Scope and components

Do not refactor unrelated modules, redesign adjacent screens, rename unrelated files, alter DB/RLS/migrations from a frontend-only task, install packages, run shadcn CLI, replace libraries, or add speculative abstractions.

Prefer existing components, wrappers, helpers, schemas, toasts, and route structure.

Classify components as page-specific, feature-specific, feature-reusable, cross-product reusable, or global primitive.

Do not put business-specific behavior in `components/ui/*` or create a global abstraction from superficial markup similarity.

### Async behavior

For async operations:

* disable affected controls and prevent duplicate submission
* show pending, success, and safe error feedback
* preserve useful input after failure
* wait for server confirmation unless an approved optimistic strategy exists
* update/revalidate data using repository conventions
* handle overlapping/stale responses
* clean up subscriptions, timers, and aborted requests when relevant

For optimistic updates, define optimistic state, confirmation, rollback, duplicate handling, and failure feedback.

### Forms

Use existing schemas when appropriate.

* normalize values consistently
* keep field errors near fields
* distinguish required/optional fields
* handle server errors separately
* preserve values after recoverable failures
* avoid exposing server-owned fields
* ensure keyboard and mobile usability

For dynamic fields, use stable keys, preserve values, handle add/remove/reorder safely, prevent accidental deletion, keep derived values synchronized, and submit the intended order.

### UI states and edge cases

Implement all meaningful planned states and remain safe with null/undefined values, long text, missing images, slow/failed requests, empty results, restricted permissions, repeated actions, stale data, and partial data.

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

## Manual UI validation

Browser QA begins only after the relevant implementation is stable, focused automated checks are green, required fixtures exist, and the local environment is ready. Use the manual-QA state matrix, fixture-readiness gate, and verification-scope rules owned by `test-quality-strategy` rather than redefining them here.

Prepare and execute browser QA as one deliberate pass:

1. Define the exact observable checks first.
2. Reuse the existing deterministic fixture.
3. Reuse the current local server and browser session when healthy.
4. Perform the planned viewport and interaction matrix.
5. Record observed results.
6. Stop rather than expanding into unrelated visual polish.

Do not start browser QA before required data exists; repeatedly reset or recreate seed data; restart Supabase or the dev server when a healthy process can be reused; open multiple browser-QA phases for the same unchanged implementation; reread database, migration, or backend documentation for a focused frontend composition task; or reopen broad discovery during visual refinement.

For focused UI refinement, browser QA may be explicitly deferred to the owner. Respect instructions such as `no browser QA`, `no tests`, `targeted tests only`, or `implement and stop for owner manual QA`; report the deferred checks as pending without converting them into success claims.

Create a task-specific checklist with exact actions and expected results.

Cover as applicable:

* required role/data and route
* required responsive viewports
* primary and destructive flows
* loading/pending and failure recovery
* long, null, missing, and empty data
* permission/status variants
* keyboard, focus, labels, and dialog accessibility

Execute available checks. Mark visual or environment-dependent checks pending and request user confirmation.

Do not claim full UI validation while required checks remain pending.

Do not ask the owner to repeatedly run smoke/E2E checks for ordinary refactor checkpoints. Request smoke/E2E only when the change touches a critical browser workflow, crosses client/server/auth/persistence boundaries, or lower-level verification cannot prove the risk.

### Responsive QA matrix

For responsive interfaces, verify the repository-defined minimum supported width, 375px mobile, tablet or narrow desktop where relevant, and normal desktop. If the repository defines no minimum, verify both 320px and 375px; one successful 375px screenshot does not prove smaller supported widths are safe.

At each relevant viewport, verify interaction and layout behavior, not only screenshots:

* no horizontal page overflow, including `document.documentElement.scrollWidth <= document.documentElement.clientWidth`
* flex/grid children can shrink and relevant containers use safe wrapping or `min-width: 0` where needed
* text and CTA labels do not escape cards
* section ordering matches the approved mobile hierarchy
* dialogs, sheets, menus, cards, and payment/course rows remain usable
* desktop-only composition does not clip content at small widths

For focused UI refinement, keep verification limited to the affected composition, viewports, and interactions unless observed evidence shows broader risk.

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
