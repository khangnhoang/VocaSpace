---

name: frontend-workflow
description: End-to-end frontend engineering workflow for React and Next.js tasks: task analysis, repository discovery, UI/UX planning, database and Zod contract inspection, API integration, typed mock data, implementation, state management, performance review, automated tests, manual UI validation, final code audit, and documentation of non-obvious logic. Use before implementing, changing, or reviewing non-trivial frontend behavior.
---

# Frontend Workflow Skill

## Activation scope

Use this skill when a task touches non-trivial frontend engineering work, including:

* pages and layouts
* React components
* client and server component boundaries
* forms and dialogs
* tables, lists, cards, dashboards
* learning experiences
* flashcard and exercise flows
* teacher authoring interfaces
* admin workflows
* frontend state management
* asynchronous UI behavior
* Server Action integration
* Route Handler/API integration
* REST API integration
* Supabase query or RPC integration
* Zod validation used by frontend flows
* loading, empty, error, success, and pending states
* mock data and frontend fixtures
* responsive behavior
* accessibility
* frontend performance
* component/render tests
* form interaction tests
* frontend regression reviews
* manual UI validation
* final frontend code audits

Use this skill before implementing or reviewing a frontend task whose behavior cannot be completed safely through an obvious one-line or purely visual change.

Do not use this skill for:

* pure documentation-only changes
* database-only changes with no frontend impact
* trivial text corrections
* an isolated class name correction whose expected result is unambiguous
* generated file updates

## Related skills

Always also use `frontend-design` when a task touches:

* visual design
* UI hierarchy
* layouts
* forms
* dialogs
* tables
* responsive behavior
* accessibility
* animation
* product-facing interaction
* client, learning, teacher, or admin screens

Read:

```txt
.agents/skills/frontend-design/SKILL.md
```

Also use `nextjs-server-action-zod` when the task touches:

* Zod schemas
* React Hook Form validation
* Server Actions
* Route Handlers
* API payloads
* FormData
* DTOs/interfaces
* inferred schema types
* client/server validation boundaries
* schema/type SSOT

Also use `test-quality-strategy` when the task:

* adds or changes tests
* fixes a bug that needs regression coverage
* introduces form interaction behavior
* introduces status-dependent rendering
* introduces complex state transitions
* introduces async success/failure behavior
* should require test reasoning before implementation

Also use `supabase-safe-migration` when the task touches:

* database schema behavior
* migrations
* RLS policies
* RPC functions
* triggers
* SQL functions
* database constraints
* database-backed integration tests
* race-condition-sensitive database behavior

If a task touches multiple domains, read all relevant skills before editing.

A frontend task must not silently expand into database, RLS, migration, or backend behavior without explicit approval.

## Core rules

* Read before writing.
* Understand the business flow, not only the visible UI request.
* Inspect the real repository before proposing file paths, components, schemas, APIs, or data shapes.
* Use `frontend-design` to decide how the interface should look and behave.
* Do not begin a non-trivial implementation before the task has a concrete plan.
* Do not invent business behavior.
* Do not invent API signatures.
* Do not invent database fields, enum values, permissions, or status transitions.
* Prefer existing repository conventions over personal preference.
* Make surgical changes.
* Do not refactor unrelated code.
* Do not modify shared UI components to fix one local screen.
* Do not fake production success when backend behavior does not exist.
* Typed mock data is allowed only when its purpose and boundary are explicit.
* Implement relevant loading, empty, error, success, pending, and disabled states.
* Prevent double submissions.
* Preserve useful user input after recoverable failures.
* Test observable behavior and business intent.
* Review performance risks, but do not add speculative optimization.
* Manually validate non-trivial UI behavior or clearly ask the user to validate what the agent cannot.
* Audit the final diff after testing.
* Add comments for non-obvious business logic and state flow, not obvious syntax.
* Fail loudly when repository behavior conflicts with the task or SOP.

## Workflow modes

This skill supports three workflow modes.

### Discovery mode

Use Discovery mode when the user asks to:

* analyze a task
* inspect the repository
* discuss a solution
* review an SOP
* create an implementation plan
* identify missing context
* explicitly avoid coding
* prepare work for a later implementation session

In Discovery mode:

* do not edit files
* do not generate implementation patches
* inspect the repository
* map the current business and data flow
* identify relevant contracts and conventions
* surface conflicts and missing requirements
* propose a concrete implementation plan
* produce a transferable implementation brief
* stop after the brief

Do not interpret “analyze,” “discuss,” “inspect,” or “plan” as permission to implement.

### Implementation mode

Use Implementation mode when:

* the user explicitly approves a plan
* the user says to proceed or implement
* the user provides an approved SOP
* the user provides an approved implementation brief
* the task is trivial and fully unambiguous

Before coding, verify that the approved plan still matches the actual repository.

If the plan conflicts with repository behavior, stop and report the conflict.

Do not silently reinterpret approved business behavior.

### Review mode

Use Review mode when the user asks to:

* review an existing implementation
* inspect a diff
* audit frontend code
* inspect state management
* evaluate UI behavior
* identify regressions
* prepare a PR
* verify whether a task is complete

In Review mode:

* inspect the implementation and related call sites
* compare behavior against the task or SOP
* inspect component boundaries
* inspect business states and failure paths
* run relevant checks when possible
* identify missing automated or manual validation
* avoid unrelated redesign or refactoring

## Required workflow

### Phase 1: Understand the task

Before opening implementation files, identify:

* target user
* user goal
* current behavior
* expected behavior
* business rules
* state transitions
* explicit scope
* explicit exclusions
* success criteria
* likely failure paths
* permission-sensitive behavior
* data needed by the UI

Do not reduce a business task to only the visible controls.

For example, a course review task is not only:

```txt
Add Accept and Reject buttons.
```

It may involve:

```txt
Teacher submits a course
→ server validates permission and course readiness
→ course becomes pending
→ admin sees pending courses
→ admin inspects course information
→ admin accepts or rejects
→ status and review metadata change
→ teacher sees the result
→ rejection feedback remains available
→ notification or realtime behavior may apply if already supported
```

Inspect the wider flow to understand the frontend behavior.

Do not automatically implement every adjacent part of the wider flow.

### Phase 2: Read repository instructions

Before editing, read:

* applicable `AGENTS.md`
* `.agents/skills/frontend-design/SKILL.md`
* other relevant skills
* existing project conventions
* relevant test strategy
* relevant package scripts

Do not rely only on the user prompt when the repository contains more specific conventions.

### Phase 3: Inspect the current frontend

Find and inspect:

* target route or page
* parent layout
* feature folder
* related components
* similar existing screens
* shared UI primitives used by the feature
* current responsive conventions
* current toast/notification convention
* current formatting helpers
* current icons and animation libraries
* loading, empty, error, and success components
* test files for similar behavior

Search shared component usages before modifying shared code.

Do not modify `components/ui/*` for a screen-specific requirement unless the task explicitly requires a global design-system change.

For a local difference, prefer:

* props
* `className`
* composition
* a feature-level wrapper
* a feature-specific component

### Phase 4: Inspect database and domain contracts

Read the relevant sections of:

* `types/database.ts`
* generated database types
* domain interfaces
* database schema definitions when generated types are insufficient
* enums
* table relationships
* nullable fields
* ownership fields
* permission-related fields
* status fields
* timestamps
* audit metadata

Do not read a large generated file blindly. Locate and inspect the relevant table, row, insert, update, relationship, and enum definitions.

Confirm:

* identifiers
* required fields
* nullable fields
* status values
* relationships
* server-owned fields
* frontend-editable fields
* permission-relevant fields
* fields needed to render the UI safely

Do not manually edit generated database types.

Do not invent a field because the proposed UI would benefit from it.

If the UI needs unavailable data, report the missing contract.

### Phase 5: Inspect Zod and validation contracts

Search for:

* existing Zod schemas
* schema folder conventions
* reusable field schemas
* client validation
* server validation
* React Hook Form resolvers
* validation error helpers
* inferred types
* normalization and transformation logic
* action/API payload schemas

Reuse an existing schema when it represents the same contract.

Avoid maintaining multiple manually synchronized definitions for the same payload.

Client validation improves UX but does not replace server validation.

Do not expose server-owned fields as editable form inputs unless explicitly required.

If validation behavior changes, also use `nextjs-server-action-zod`.

### Phase 6: Inspect data integration

Identify whether the feature uses:

* Server Components
* Client Components
* Server Actions
* Route Handlers
* REST APIs
* Supabase client queries
* Supabase RPC functions
* React Query
* SWR
* URL search parameters
* realtime subscriptions
* parent callbacks
* local fixtures
* mock adapters

Read actual signatures and result shapes before wiring the UI.

Confirm:

* input payload
* response shape
* success result
* error result
* auth and permission assumptions
* cache or revalidation behavior
* pagination behavior
* filtering behavior
* sorting behavior
* retry behavior
* duplicate-submission behavior

Do not guess an API or action signature.

For cross-user workflows such as review, moderation, assignment, or approval, inspect whether the repository already supports:

* notifications
* realtime updates
* audit records
* activity logs
* review metadata

Report related systems in the plan.

Do not automatically add them unless included in scope.

### Phase 7: Analyze UI/UX

Apply `.agents/skills/frontend-design/SKILL.md`.

Classify the screen as:

1. Client / Marketing
2. Learning Experience
3. Teacher Authoring
4. Admin / Business Operations
5. Shared Design System Component

Then identify:

* visual direction
* information hierarchy
* primary action
* secondary actions
* destructive actions
* component structure
* content density
* dialog requirements
* responsive behavior
* mobile behavior
* accessibility requirements
* useful motion
* unnecessary motion
* loading feedback
* empty-state guidance
* error feedback
* success feedback

For dialogs, determine what information the user needs before making the decision.

A confirmation should normally identify:

* the affected object
* the action
* the consequence
* whether the action is reversible

Do not use generic confirmation text when business context matters.

### Phase 8: Plan state and business behavior

List the UI states that can occur.

Consider:

```txt
initial
loading
loaded
empty
error
submitting
success
disabled
permission denied
stale data
partial data
missing optional data
```

Not every task requires every state.

Identify where each value belongs:

* local component state
* form state
* derived state
* URL state
* server state
* cached state
* shared state

Prefer derived state over duplicated state.

Do not store data in state when it can be calculated reliably from existing props or state.

Avoid independent booleans that can create impossible combinations.

Bad:

```txt
isLoading = true
isSuccess = true
isError = true
```

For complex flows, define transitions explicitly.

Example:

```txt
idle
→ validating
→ submitting
→ success

idle
→ validating
→ validation error

submitting
→ server error
→ editable state restored
```

Use a reducer, dedicated hook, or state machine pattern when multiple state transitions are difficult to reason about with independent state variables.

Do not introduce a state-management library unless the repository already uses it or the user approves it.

### Phase 9: Produce an implementation plan

For non-trivial tasks, provide this plan before editing:

```txt
## Task Understanding

- User:
- Goal:
- Current behavior:
- Expected behavior:
- Business rules:
- Explicit exclusions:

## Repository Context

- Target route/page:
- Related components:
- Database/domain types:
- Zod schemas:
- Data integration:
- Permissions:
- Notifications/realtime:
- Existing test coverage:

## UI/UX Direction

- Screen type:
- Visual direction:
- Information hierarchy:
- Main interaction:
- Required states:
- Responsive behavior:
- Accessibility considerations:

## Proposed Solution

1. ...
2. ...
3. ...

## Files to Create or Modify

- path: reason

## Files and Domains Not to Modify

- path/domain: reason

## Risks and Open Questions

- ...

## Verification Plan

- Automated checks:
- Component/render behavior:
- State/business logic:
- Performance review:
- Manual UI checks:
```

Do not ask the user questions that can be answered by inspecting the repository.

If critical business behavior remains unclear after repository inspection, stop and ask focused questions.

### Phase 10: Produce an approved implementation brief

At the end of Discovery mode, produce a brief suitable for a new implementation session.

Use:

```txt
## Approved Goal

## Confirmed Business Rules

## Confirmed UI Behavior

## Relevant Existing Files and Contracts

## Files to Create or Modify

## Files and Domains Not to Touch

## Required UI States

## State Transition Rules

## Data Integration Strategy

## Mock Data Strategy

## Automated Verification

## Manual UI Validation

## Known Limitations
```

The implementation session must follow this brief.

It may report repository conflicts, but it must not silently change approved business behavior.

## Mock data rules

### When typed mock data is allowed

Typed mock data may be created when:

* the task is explicitly UI-only
* the task is a prototype
* no real API/action/query currently exists
* backend work is explicitly outside scope
* visual and interaction states need representative data

Mock data must be:

* strongly typed
* deterministic
* isolated from production data access
* clearly named as mock, fixture, demo, or prototype data
* easy to replace
* representative of realistic edge cases

Include useful cases such as:

* complete data
* missing optional values
* missing image
* long text
* multiple statuses
* empty data
* loading simulation
* error simulation

Prefer a dedicated location following repository conventions, such as:

```txt
__fixtures__/
mocks/
features/<feature>/fixtures/
components/<feature>/__fixtures__/
```

Do not scatter hardcoded mock objects throughout production components.

### When mock success is forbidden

If the UI is intended to be a real production feature but the mutation API does not exist:

* do not return fake success
* do not show a success toast as though data changed
* do not update production state deceptively
* do not silently persist to local storage as a replacement backend

Use one of these approaches:

* receive a typed callback from the parent
* define a clear adapter interface
* implement only the view layer
* render the unavailable action as disabled with a clear integration boundary
* stop and ask whether backend work should be added
* add an explicit TODO at the integration boundary

Mock data may support rendering and interaction review, but it must not masquerade as completed production integration.

## Implementation rules

### Change scope

Make surgical changes.

Do not:

* refactor unrelated modules
* redesign unrelated screens
* rename unrelated files
* change database behavior from a frontend-only task
* modify migrations or RLS without explicit scope
* manually edit generated database types
* install packages without permission
* run shadcn CLI without permission
* replace existing libraries without approval
* modify global shared UI for one local requirement
* add speculative abstractions
* add future functionality outside the approved task

Prefer:

* existing project components
* existing shadcn/ui wrappers
* existing helpers
* existing schemas
* existing toast conventions
* existing route structure
* feature-level composition
* usage-site customization

### Component boundaries

Before creating or modifying a component, identify whether it is:

* page-specific
* feature-specific
* reusable within one feature
* reusable across multiple product areas
* a global design-system primitive

Do not move business-specific behavior into `components/ui/*`.

Do not create a global abstraction merely because two pieces of markup look similar.

A global shared component should represent a genuinely reusable contract, not one screen’s convenience.

### Async behavior

For asynchronous operations:

* prevent double submission
* disable affected controls while pending
* preserve useful input after failure
* show clear pending feedback
* show clear success feedback
* show safe error feedback
* do not show success before server confirmation unless an approved optimistic strategy exists
* update or revalidate data using repository conventions
* handle stale responses when multiple requests may overlap
* clean up subscriptions, timers, and aborted requests
* avoid state updates after unmount when relevant

If using an optimistic update, define:

* optimistic state
* confirmation behavior
* rollback behavior
* duplicate request handling
* failure feedback

### Forms

For forms:

* use existing schemas when appropriate
* normalize values consistently
* display field errors near the affected fields
* preserve values after recoverable failures
* distinguish required and optional fields
* disable submission while pending
* prevent invalid submission
* handle server errors separately from client validation
* avoid exposing server-owned fields
* ensure keyboard usability
* ensure mobile usability

For dynamic fields:

* use stable keys
* preserve user-entered values
* handle add/remove/reorder safely
* keep derived values synchronized
* prevent accidental destructive removal
* test empty and populated states
* ensure submitted payload order is correct

### UI states

Implement all meaningful states identified in the plan.

Do not implement only the happy path.

The UI should remain safe with:

* null values
* undefined optional values
* long text
* missing images
* slow requests
* failed requests
* empty results
* restricted permissions
* repeated actions
* stale data
* partial data

## UI review workflow

After implementation, compare the rendered result against:

* the original task or SOP
* the approved implementation brief
* `.agents/skills/frontend-design/SKILL.md`
* nearby existing screens
* the product’s visual conventions

Review:

* Is the correct screen type used?
* Is the primary action obvious?
* Are secondary actions visually subordinate?
* Are destructive actions clearly separated?
* Are buttons large enough to use comfortably?
* Are several actions incorrectly given equal visual weight?
* Are button radius and padding consistent?
* Does the interface resemble unrelated pill-shaped controls?
* Does the dialog contain enough context?
* Is dialog width suitable for its content?
* Are object name, image, status, and consequence shown when needed?
* Are loading, empty, error, success, pending, and disabled states clear?
* Does long text break the layout?
* Does missing data break the layout?
* Does the layout work around 375px?
* Do buttons wrap safely?
* Are critical mobile actions still discoverable?
* Is animation useful?
* Is accessibility preserved?
* Were shared components modified unnecessarily?

Do not consider a frontend task complete merely because TypeScript compiles.

## Test workflow

Use `.agents/skills/test-quality-strategy/SKILL.md` before deciding test coverage.

Prefer the smallest test layer that provides strong confidence.

Frontend tasks may require:

* schema tests
* pure business logic tests
* component render tests
* form interaction tests
* Server Action tests
* API tests
* integration tests
* regression tests
* future E2E notes

### Render and behavior tests

Add or update component tests when behavior includes:

* conditional rendering
* status-based actions
* dialog open/close behavior
* validation feedback
* loading states
* error states
* empty states
* success states
* pending/disabled states
* permission-dependent rendering
* dynamic fields
* regression-prone interactions

Test observable behavior.

Good:

```txt
A pending course shows Accept and Reject actions.
A published course does not show review actions.
An invalid rejection reason blocks submission.
A pending request disables the confirmation action.
A failed request preserves the rejection message.
```

Avoid tests that assert internal React state or implementation structure without user-visible value.

### State and business logic tests

Extract and test pure logic when it contains:

* status transitions
* filtering
* sorting
* stage progression
* exercise answer evaluation
* derived permissions
* data normalization
* reducer transitions
* optimistic rollback logic

For reducers or explicit state machines, test:

* valid transitions
* invalid transitions
* retry behavior
* reset behavior
* failure recovery
* final invariants

## Performance review

Review realistic performance risks.

Inspect:

* Client Component boundaries
* Server Component boundaries
* request waterfalls
* duplicate fetching
* duplicate mutations
* unnecessary state
* avoidable effects
* unstable list keys
* expensive work during render
* large lists
* pagination needs
* virtualization needs
* image sizing and loading
* heavy animation
* large client bundles
* frequent realtime events
* unnecessary rerenders
* unstable callback or object identities passed to expensive children

Do not automatically add:

* `useMemo`
* `useCallback`
* `React.memo`
* virtualization
* state libraries
* caching layers

Only add an optimization when:

* a real risk exists
* the repository already uses the pattern appropriately
* profiling or code structure provides a concrete reason
* the optimization does not make correctness harder to understand

Do not claim a performance improvement without evidence.

When no performance issue is found, report that the relevant risks were reviewed and no additional optimization was justified.

## Manual UI validation

For every non-trivial frontend task, create a task-specific manual test checklist.

Combine:

1. general frontend checks
2. business-specific behavior
3. repository-specific edge cases
4. responsive behavior
5. accessibility behavior
6. loading and failure paths

If browser tooling is available, execute as much as possible.

If visual judgment or user-controlled data is required, ask the user to perform the remaining checks.

Use:

```txt
## Manual UI Test

Environment:
- route:
- required role:
- required data:

Desktop:
1. Action:
   Expected:
2. Action:
   Expected:

Mobile — approximately 375px:
1. Action:
   Expected:

Business behavior:
1. Action:
   Expected:

Loading and failure:
1. Action:
   Expected:

Edge data:
1. Action:
   Expected:

Accessibility:
1. Action:
   Expected:
```

Manual checks must describe exact actions and expected outcomes.

Bad:

```txt
Test the dialog.
```

Good:

```txt
1. Open a pending course.
2. Click Accept.
3. Confirm that the dialog shows the correct course title and thumbnail.
4. Confirm that Cancel closes the dialog without changing the course.
5. Confirm publication.
6. Verify that the confirm action is disabled and displays “Publishing...” while pending.
7. Simulate a failed request.
8. Verify that the course remains pending and an error message is displayed.
```

If the agent cannot complete a required visual check, mark it as pending and request user confirmation.

Do not claim full UI validation before required manual checks are complete.

## Final code audit

After implementation and verification, inspect the final diff again.

Check:

* approved scope was followed
* no unrelated files changed
* shared components were not changed for a local need
* database and API contracts are accurate
* nullable values are handled
* client and server boundaries are appropriate
* state is not duplicated unnecessarily
* impossible state combinations are avoided
* async failure paths are safe
* double submission is prevented
* permission-sensitive actions are rendered appropriately
* mock data cannot be mistaken for production data
* temporary logging is removed
* dead code is removed
* imports are necessary
* tests protect meaningful behavior
* UI matches the task and design skill
* comments explain non-obvious logic
* TODO comments have a clear reason and integration boundary

Run the smallest relevant verification commands again if the audit required code changes.

## Commenting rules

Use Vietnamese comments in project source code when comments are necessary.

Comments should explain:

* business intent
* state flow
* invariants
* trust boundaries
* permission assumptions
* validation boundaries
* ordering requirements
* race-condition handling
* optimistic update behavior
* rollback behavior
* compatibility behavior
* non-obvious performance decisions
* integration boundaries

### Magic-box comments

A “magic box” is logic whose correctness cannot be understood safely from naming and structure alone.

Add comments around:

* complex reducer transitions
* multiple related state variables
* state machines
* optimistic updates and rollback
* request race prevention
* stale response protection
* synchronization between form, URL, local, and server state
* business-specific filter or transformation order
* non-obvious permission rules
* non-obvious status visibility rules
* fallback between real and mock adapters
* cleanup that prevents stale updates
* intentional behavior that appears removable
* unusual memoization required for correctness or measured performance

Comments must explain why the behavior exists.

Good:

```ts
// Giữ course trong danh sách pending cho đến khi server xác nhận.
// Nếu xóa optimistic ngay, request thất bại sẽ khiến UI khó khôi phục đúng trạng thái.
```

Good:

```ts
// Quyền resubmit phụ thuộc vào status draft do server trả về.
// Không suy ra quyền chỉ từ rejectMessage vì message cũ có thể vẫn tồn tại.
```

Bad:

```ts
// Lọc các course.
const pendingCourses = courses.filter(...);
```

Bad:

```ts
// Map các phần tử.
items.map(...);
```

Do not comment basic `map`, `filter`, or `reduce` usage.

When a transformation chain contains business logic:

1. extract well-named intermediate variables
2. extract a helper function when useful
3. simplify the expression
4. add a comment only if the business reason remains non-obvious

Prefer:

```ts
const reviewableCourses = courses.filter(canAdminReviewCourse);
```

over:

```ts
// Lọc course có thể review.
const result = courses.filter(...);
```

Do not use comments to compensate for confusing code that can be clarified through naming and structure.

Comments must be updated when the behavior changes.

## Phase checkpoints

After each meaningful phase, report briefly:

```txt
- What was inspected or completed
- What was learned
- What remains
- Whether a blocker or conflict exists
```

Do not repeatedly ask for approval after every small code edit.

Approval is required at the planning gate for non-trivial tasks. After approval, continue through implementation and verification unless a new conflict or ambiguity appears.

## Hard stop rules

Stop and ask before continuing when:

* business behavior is ambiguous
* the SOP conflicts with the repository
* an expected API or action does not exist
* an API signature is unclear
* a status transition is unclear
* permission behavior is unclear
* the task requires database changes outside approved scope
* a shared component change may affect unrelated screens
* mock data may enter a production path
* the requested UI cannot be implemented safely with available context
* tests reveal behavior that conflicts with the approved task
* the implementation would expose a server-owned field
* required data is missing from the current contract
* an optimistic update lacks a safe rollback strategy

Do not:

* invent product behavior
* invent API signatures
* invent database fields
* invent enum values
* manually edit generated database types
* modify migrations or RLS from a frontend-only task
* fake production success
* present mock data as real data
* modify global shared UI for a local need
* install dependencies without permission
* refactor unrelated code
* ignore relevant UI states
* ignore mobile behavior
* claim tests passed when they were not run
* comment obvious syntax while leaving complex logic unexplained
* begin non-trivial implementation before the planning gate is satisfied

## Definition of done

A frontend task is complete only when:

* implemented behavior matches the approved task
* UI follows `frontend-design`
* relevant database and domain contracts were inspected
* relevant Zod and API contracts were inspected
* mock data, if used, is isolated and explicit
* meaningful UI states are implemented
* state transitions are safe
* component boundaries are appropriate
* shared components remain safe
* responsive behavior was reviewed
* accessibility was reviewed
* realistic performance risks were reviewed
* relevant automated checks passed
* required manual UI behavior was validated or clearly marked pending
* the final diff was audited
* non-obvious logic contains useful Vietnamese comments
* remaining limitations and out-of-scope work are documented

## Final response checklist

When finished, report:

* task behavior implemented
* screen type and design direction
* files created or changed
* reason for each file change
* database/domain contracts inspected
* Zod schemas inspected or changed
* API/action integration used
* mock data used and why
* shared components touched: yes/no
* loading state
* empty state
* error state
* success state
* pending/disabled state
* permission-sensitive behavior
* responsive considerations
* accessibility considerations
* performance risks reviewed
* tests created or changed
* verification commands run
* failed or skipped commands and reasons
* manual UI checks completed
* manual UI checks still requiring user confirmation
* non-obvious logic documented
* known limitations
* intentionally excluded work
