---
name: test-quality-strategy
description: Repository-specific strategy for unit, schema, component, form interaction, Server Action, Route Handler/API, integration, regression, smoke E2E, and broader browser tests. Use before adding, changing, refactoring, or reviewing tests, and whenever a code change requires test-layer or coverage reasoning.
---

# Test Quality Strategy

## Activation scope

Use this skill when a task touches tests, fixtures, helpers, mocks, test data, coverage, regression risk, permissions, resilience, concurrency, or behavior that should be protected by tests.

Use it before deciding whether a change needs tests.

Do not use it for pure documentation unless the documentation defines test strategy or commands.

## Related skills

Use:

* `nextjs-server-action-zod` for schema, form, payload, Server Action, and API validation tests
* `supabase-safe-migration` for migrations, RLS, RPC, triggers, constraints, Storage, and DB-backed integration tests
* `frontend-workflow` for component/form behavior and manual UI validation
* `frontend-design` for product-facing component/form interaction, accessibility, responsive behavior, and visual UI review
* `code-commenting-and-maintainability` for inline test comments and structured test-plan headers
* `code-review-and-quality` when reviewing test adequacy

Read every relevant skill before editing.

## Resource routing

| Resource | Read condition |
| --- | --- |
| [references/smoke-e2e-and-browser.md](references/smoke-e2e-and-browser.md) | Read before adding, changing, running, or reviewing smoke E2E or browser coverage, including fixture-readiness work for planned browser/manual QA. Skip for unit, schema, action, or integration work that does not use a browser. |
| [references/manual-qa-and-fixtures.md](references/manual-qa-and-fixtures.md) | Read when manual QA depends on authenticated roles, database-backed state, ordering, multiple related records, seeded fixtures, or other data-dependent scenarios. Skip for automated-only work and manual checks with no data-dependent state. |
| [references/test-plan-headers.md](references/test-plan-headers.md) | Read before creating, changing, or reviewing an integration, RPC, RLS, multi-branch Server Action, Route Handler/API, form-interaction, payment, webhook, upload, concurrency, important-regression, or multi-behavior-group test file. Skip for tiny one-case unit tests and other files outside those categories. |
| [references/mocking-and-regression.md](references/mocking-and-regression.md) | Read when the task directly introduces, changes, or reviews a mock boundary; directly designs, adds, or reviews bug-regression protection; or directly designs, adds, or reviews semantic relationship/graph-substitution protection between individually valid graphs. Skip when none of those subjects is requested. |

When multiple conditions match, read all matching resources. Treat each skip condition as meaningful: do not load a resource merely because this skill is active.

An existing test's use of mocks does not by itself trigger the mocking/regression reference when the task only decides header requirements, reports the limits of existing evidence, or selects form/action test layers. Applying the core rule that a form test must not mock away its submit-integration guarantee is also not a direct mock-boundary review. Likewise, choosing a real database integration layer because a database invariant must not be mocked uses the core database rule and does not activate the reference. Use the core rules for those decisions; read the reference only when the mock boundary itself or regression protection is a direct subject of the requested judgment.

Route from the requested judgment, not from incidental files or vocabulary in supplied context. A migration, uniqueness invariant, existing mock, existing test header, or ordinary use of words such as `substitute`, `relationship`, or `regression` does not by itself activate a conditional resource. Semantic substitution requires an explicit test subject where independently valid objects from different valid graphs become invalid only because their relationship or lineage is wrong.

Do not reinterpret an ordinary permission-denied path, uniqueness collision, concurrency race, state transition, or real-database invariant as semantic substitution merely because it contains two actors, rows, requests, or states. The semantic-substitution trigger requires both combinations to be independently allowed and the deliberate cross-graph link itself to be the forbidden condition.

Designing a regression matrix can activate the mocking/regression reference without activating the test-plan-header reference. Read the header reference only when a concrete eligible test file is being created, changed, or directly reviewed for its test-plan documentation. Merely inspecting an existing test to report verification scope or evidence limits is neither header review nor mock-boundary review.

## Core rules

* Test user intent and system guarantees, not only implementation details.
* Cover happy, failure, boundary, invalid-input, permission, and state-transition paths.
* Include hostile or broken-client behavior when server boundaries matter.
* Prefer the smallest test layer that gives strong confidence.
* Do not duplicate the same guarantee across layers without added value.
* Do not mock away the behavior being tested.
* Do not overfit to internal implementation.
* Bug fixes need a regression test when practical.
* Security changes require denied-path coverage.
* Validation changes require invalid and hostile inputs.
* Database guarantees require integration tests rather than mocked DB behavior.
* Form behavior should be tested through user interaction.
* Concurrency-sensitive behavior should cover duplicate or simultaneous actions when practical.
* Test names must describe actor, condition, and expected outcome.
* The repository has working smoke E2E infrastructure; inspect the actual config, scripts, environment requirements, and covered flows before using or extending it.

## Specialist escalation signals

A hard-risk signal exists when observable verification facts expose a potentially material unresolved evidence gap because mocks obscure the real guarantee, the required test layer cannot establish a cross-boundary authorization, persistence, or concurrency invariant, nondeterministic or stale fixtures invalidate the result, or a material regression cannot be reproduced or bounded with trustworthy evidence.

Choosing among otherwise adequate test layers, adding ordinary failure or boundary cases, broadening a focused suite for a known shared boundary, and preparing deterministic local fixtures are conditional review signals. Test count, coverage percentage alone, multiple available layers, a routine regression test, test-skill activation, and owner request alone are ordinary non-triggers.

Route a hard-risk candidate through the global specialist gates only after applicable main review. If required safety evidence cannot be obtained, report verification as `not_run` and use `Blocked` when the main agent cannot reach a trustworthy verdict. A specialist cannot replace required test execution or grant environment, data, browser, database, or remote permission.

## Test taxonomy

### Unit

Use for pure deterministic helpers, parsers, formatters, mappers, reducers, and business-rule functions.

Preferred existing location:

```txt
__tests__/utils
```

### Schema

Use for Zod rules, transforms, defaults, enums, UUIDs, strings, arrays, file metadata, and invalid payload rejection.

```txt
__tests__/schemas
```

### Component

Use React Testing Library style for visible rendering and interactions:

* conditional actions
* dialogs
* loading/error/empty/success/pending states
* accessible labels and roles
* dynamic lists

```txt
__tests__/components
```

### Form interaction

Usually component tests covering:

* defaults and field errors
* required/invalid input
* add/remove/reorder
* submit payload
* disabled/pending state
* failed-submit input preservation

Keep them in the existing component-test location unless the repository later establishes a dedicated forms folder.

### Server Action

Use for server-side branching:

* valid/invalid payload
* missing auth
* denied permission
* validation before mutation
* business-rule failure
* stable safe result shapes

```txt
__tests__/actions
```

### Route Handler/API

Use for request parsing, body/FormData/query/params validation, auth, permissions, uploads, and safe response shapes.

Use the closest existing pattern. Create a dedicated API folder only when justified by repository conventions.

### Integration

Use for real database behavior:

* Supabase queries
* RLS
* RPC
* migrations
* triggers
* constraints
* Storage
* payment/state transitions
* action/handler + DB behavior
* concurrency

```txt
__tests__/integration
```

Do not mock the database guarantee under test.

## Required workflow

### Before writing

1. Identify the behavior or invariant.
2. Choose the lowest useful test layer.
3. Inspect existing tests, helpers, fixtures, setup, and scripts.
4. List meaningful success, failure, boundary, permission, resilience, and concurrency cases.
5. Reuse existing patterns.
6. Avoid duplicate coverage without extra value.
7. Decide whether a structured test-plan header is required.

### While writing

* Use descriptive test names.
* Arrange data clearly and deterministically.
* Act like a real user in UI tests.
* Assert visible behavior, result, persisted state, or side effect.
* Keep each test focused.
* Test negative and permission paths explicitly.
* Use inline comments only for non-obvious setup or reasoning.

### After writing

* For regression tests, prove failure before the fix when practical.
* Run the smallest relevant command.
* Run broader checks only when shared behavior changed.
* Report covered behavior, commands, results, and skipped checks.

## Verification scope selection

Targeted verification is the default. Select the narrowest verification capable of detecting regressions introduced by the actual diff.

### Focused UI composition or CSS change

Run only, as applicable:

* directly related component or interaction tests
* targeted TypeScript when changed TS/TSX requires it
* targeted lint for changed files
* `git diff --check`
* focused manual visual QA when requested or materially necessary

Do not automatically run the full unit-test suite, all integration tests, a production build, database reset/reseed, repository-wide lint, or unrelated route tests.

### Local behavior or domain-logic change

Run directly affected unit, action, or component tests plus relevant TypeScript and lint. Broaden only when the modified boundary is shared or cross-cutting.

### Cross-cutting change

A wider suite or build may be justified for shared primitives, routing, schema, build, configuration, or other cross-cutting infrastructure. State why the broader verification is necessary before running it.

Full-suite verification is appropriate only when the change affects a shared or cross-cutting boundary, repository policy explicitly requires it, narrower checks reveal wider regression risk, final PR verification requires it, or the owner explicitly requests it. Being careful does not mean running every available check.

## Coverage model

Consider these groups as applicable.

### Intended use

* valid form or payload
* successful mutation
* correct rendering and state transition
* expected persisted result

### User mistakes

* missing or whitespace-only fields
* invalid format or length
* invalid number
* duplicate values
* wrong file type/size
* double submit
* stale form data

### Hostile or broken client

* forbidden role/status/owner fields
* another user’s ID
* invalid UUID/enum
* bypassed disabled UI
* unknown fields
* malformed FormData
* unauthenticated or unauthorized actor
* unsafe path, filename, or bucket

### Boundaries and transitions

* min/max values
* empty arrays and maximum items
* duplicate ordering
* soft-deleted data
* draft/pending/published states
* payment state transitions
* first/last ordering
* retry or simultaneous requests

### Resilience

* mutation does not run after validation failure
* partial failure leaves consistent state
* safe errors
* retryable operations are idempotent
* failed submit preserves input
* missing optional data is intentional

### Permission

* unauthenticated rejected
* wrong role rejected
* ownership enforced
* RLS hides protected data
* privileged client fields ignored or rejected
* internal errors not leaked

Performance is usually reviewed rather than micro-benchmarked unless established tooling exists.

## Placement

Use existing folders first:

```txt
__tests__/actions
__tests__/components
__tests__/integration
__tests__/schemas
__tests__/utils
```

Create new namespaces such as `__tests__/api`, `__tests__/forms`, or `__tests__/e2e` only when repository scale and tooling justify them.

## Naming

Prefer:

```ts
it("rejects whitespace-only course titles before creating a course", async () => {});
it("denies media upload when the user is not teacher or admin", async () => {});
it("consumes a payment reservation only once for duplicate webhooks", async () => {});
```

Avoid:

```ts
it("calls safeParse", async () => {});
it("sets state", async () => {});
```

Test names should communicate actor, action, condition, and result.

## Inline comments

Follow `code-commenting-and-maintainability`.

Comment only non-obvious:

* fixture/harness setup
* malicious-client simulation
* permission boundary
* concurrency timing
* intentionally invalid data
* regression condition
* why a mock is safe

Prefer descriptive names over arrange/act/assert narration.

## Verification

Inspect `package.json`, Vitest config, and DB tooling before selecting commands.

Follow **Verification scope selection**. Prefer the smallest relevant command and explain any broader check before running it. Do not repeat discovery or a successful command when no relevant code changed afterward.

Possible repository commands may include:

```bash
npm run test
npm run test:integration
npm run typecheck
npm run lint
npm run build
npx supabase db reset
```

Do not invent scripts.

For DB integration changes, also follow `supabase-safe-migration`.

## Evidence and coverage claims

Final reports must distinguish:

* automated coverage
* browser/manual QA
* static or source-level checks
* states verified through deterministic fixtures
* states still pending
* environment-limited verification

Do not claim interaction coverage from static source assertions, mobile visual QA from a desktop screenshot, data-rich QA from an empty-state account, full-suite success when only targeted tests ran, or browser-QA completion when required fixture states were absent. Pending manual QA remains explicitly pending rather than becoming a broad success claim.

Manual QA is complete only when the required state matrix was reproducible, every planned observable check was performed, results were recorded, and no required state remains pending. Environment-limited checks must name the limitation and the unverified behavior.

## Efficient QA execution

* Read only the skills and repository context owned by the current task.
* Do not reload unrelated documentation during focused QA.
* Do not spawn subagents for ordinary focused QA.
* Do not repeat discovery already recorded in an authoritative plan.
* Combine fixture preparation with the implementation checkpoint that first needs it.
* Do not create a second full project phase merely because fixture needs were discovered late.
* Prefer one stable implementation session and one final planned QA pass.
* Use broader review or multi-agent review only for large, high-risk, or explicitly requested changes.

Efficiency never weakens correctness, safety, or required verification.

## Anti-patterns

Do not:

* test only happy paths
* assert internal React state without user value
* duplicate the same guarantee at every layer
* mock away the subject
* use random or time-sensitive data without control
* hide permission failures
* claim smoke E2E passed or covers a flow without current repository evidence
* claim manual QA coverage for fixture states that were unavailable or not observed
* describe targeted verification as full-suite verification
* add expensive integration/E2E tests for pure schema behavior
* leave stale test-plan headers
* mark verification passed without evidence
* keep tests that no longer protect meaningful behavior

## Final checklist

* [ ] Behavior or invariant is explicit
* [ ] The lowest useful test layer was chosen
* [ ] Existing helpers and placement conventions were reused
* [ ] Success, failure, boundary, permission, and resilience paths were considered
* [ ] Bug fixes have regression coverage when practical
* [ ] Mocks preserve the real guarantee
* [ ] Test data is deterministic
* [ ] Required test-plan header is current
* [ ] Relevant command passed
* [ ] Skipped or unavailable checks are explained
* [ ] Smoke E2E claims match existing tooling, covered flows, and current run evidence
* [ ] Fixture-dependent manual QA used reproducible canonical data or is explicitly pending
* [ ] Verification scope matches the actual diff and broader checks are justified
* [ ] Automated, manual, static, fixture-backed, pending, and environment-limited evidence are distinguished
* [ ] Covered behavior and limitations were reported
