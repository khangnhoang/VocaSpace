---

name: test-quality-strategy
description: Unit tests, schema tests, component tests, form interaction tests, React Hook Form tests, Server Action tests, Route Handler/API tests, integration tests, regression tests, smoke tests, future E2E tests, test coverage strategy, user behavior coverage, security/resilience/performance test reasoning, and test placement. Use before adding, changing, refactoring, or reviewing tests.
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Test Quality Strategy Skill

## Activation scope

Use this skill when a task touches tests or should require test reasoning, including:

* unit tests
* schema tests
* utility tests
* component tests
* form interaction tests
* React Hook Form tests
* Server Action tests
* Route Handler/API tests
* integration tests
* regression tests
* smoke tests
* future E2E tests
* test fixtures
* test helpers
* test data setup
* mocking strategy
* coverage gaps
* behavior coverage
* user-flow coverage
* security-sensitive test cases
* resilience and edge-case tests
* performance-sensitive behavior
* race-condition-sensitive behavior
* bug fixes that need regression coverage
* refactors that must preserve behavior

Use this skill before deciding whether a change needs tests.

Do not use this skill for pure documentation-only changes unless the documentation describes test strategy or test commands.

## Related skills

Also use `nextjs-server-action-zod` when tests touch:

* Zod schemas
* form validation
* React Hook Form validation
* Server Action validation
* Route Handler validation
* payload interfaces or DTOs
* schema/type SSOT
* client/server boundary validation

Also use `supabase-safe-migration` when tests touch:

* Supabase/PostgreSQL behavior
* migrations
* RLS policies
* RPC functions
* triggers
* database constraints
* seed data
* integration tests that depend on database state
* race-condition-sensitive database behavior

If a task touches multiple domains, read all relevant skills before editing.

## Core rules

* Tests must verify user intent and system guarantees, not only implementation details.
* Test what the user can do, what the user may accidentally do, and what a malicious or broken client may try to do.
* Cover happy paths, failure paths, boundary cases, invalid input, permission failures, and state transitions.
* Do not only test that code “works once.” Test that it remains stable, safe, predictable, and maintainable.
* Prefer the smallest test type that gives strong confidence.
* Do not add expensive E2E tests when a unit, schema, component, or integration test gives the same confidence.
* Do not mock away the behavior being tested.
* Do not overfit tests to implementation details that should be allowed to change.
* When fixing a bug, add a regression test that would fail before the fix and pass after it.
* When changing security-sensitive behavior, test denied paths, not only allowed paths.
* When changing validation, test invalid and hostile inputs, not only valid payloads.
* When changing database behavior, prefer integration tests over mocked database behavior.
* When changing form behavior, test the user interaction path, not only internal state.
* When changing concurrency-sensitive behavior, test duplicate or simultaneous actions when practical.
* Test names should describe behavior and expected outcome clearly.

## Test taxonomy

Use these test categories consistently.

### Unit tests

Use unit tests for pure functions and isolated logic.

Examples:

* utility functions
* parser helpers
* formatters
* mappers
* pure business-rule helpers
* small deterministic functions

Prefer directory:

```txt
__tests__/utils
```

or the closest existing test folder.

### Schema tests

Use schema tests for Zod validation behavior.

Examples:

* required fields
* optional fields
* transforms
* defaults
* enums
* UUID validation
* string trimming
* max/min limits
* file metadata validation
* invalid payload rejection
* dangerous input rejection

Prefer directory:

```txt
__tests__/schemas
```

### Component tests

Use component tests for React rendering and user interaction behavior.

Examples:

* buttons enabled/disabled
* conditional rendering
* loading state
* error state
* empty state
* dialog open/close
* dynamic list rendering
* accessible labels and roles

Prefer directory:

```txt
__tests__/components
```

Use React Testing Library style: test behavior visible to the user, not internal component implementation.

### Form interaction tests

Use form interaction tests for React Hook Form and complex form behavior.

These are usually component tests, but should be treated as a distinct test concern.

Examples:

* default values
* field validation messages
* required fields
* invalid input
* dynamic options
* add/remove/reorder fields
* submit payload shape
* disabled submit while invalid
* successful submit calls the correct action/API
* failed submit shows safe user-facing error
* form reset behavior
* preserving user input after validation failure

Prefer directory:

```txt
__tests__/components
```

If the repo later grows many form tests, use:

```txt
__tests__/forms
```

Do not create `__tests__/forms` unless the project actually needs a separate form-test namespace.

### Server Action tests

Use Server Action tests when server-side branching matters.

Examples:

* valid payload
* invalid payload
* auth missing
* permission denied
* successful mutation
* validation failure returns before mutation
* safe error shape
* business-rule failure

Prefer directory:

```txt
__tests__/actions
```

### Route Handler/API tests

Use API tests for `app/api/**/route.ts` behavior.

Examples:

* valid request
* invalid body
* invalid FormData
* invalid query/route/search params
* missing auth
* permission denied
* upload validation
* safe error response
* success response shape

Prefer directory:

```txt
__tests__/api
```

If the repo currently has no `__tests__/api`, use the closest existing pattern or create it only when API tests become common.

### Integration tests

Use integration tests when behavior depends on multiple layers working together.

Examples:

* Supabase queries
* RLS behavior
* RPC behavior
* migrations
* triggers
* database constraints
* storage policies
* payment state transitions
* server action + database behavior
* route handler + database/storage behavior
* race-condition-sensitive behavior

Prefer directory:

```txt
__tests__/integration
```

Integration tests should use realistic data and should not mock away the database behavior being verified.

### Smoke tests

Use smoke tests for broad “critical flow still works” coverage.

Examples:

* core course creation flow
* login-required admin flow
* payment happy path
* exercise authoring happy path
* upload happy path

Smoke tests should be few, stable, and high-value.

### Future E2E tests

E2E tests are not required immediately.

When added later, use E2E tests for critical browser-level flows that cannot be confidently covered by unit, component, schema, action, API, or integration tests.

Future E2E candidates:

* login and role-gated navigation
* course authoring happy path
* exercise/question authoring happy path
* payment/enrollment happy path
* media upload happy path
* student learning flow

Do not add E2E tests casually. E2E tests are expensive and should protect critical user journeys.

## Required workflow

### Before writing tests

Before adding or changing tests:

1. Identify the user behavior or system guarantee being protected.
2. Identify the layer where the behavior should be tested:

   * schema
   * utility
   * component
   * form interaction
   * Server Action
   * Route Handler/API
   * integration
   * smoke
   * future E2E
3. Inspect existing tests in:

   * `__tests__/actions`
   * `__tests__/components`
   * `__tests__/integration`
   * `__tests__/schemas`
   * `__tests__/utils`
4. Reuse existing test helpers, fixtures, mocks, and setup patterns.
5. Identify all meaningful user actions and system states.
6. Identify negative paths, edge cases, permission cases, and security-sensitive cases.
7. Choose the smallest useful test set that gives strong confidence.
8. Avoid adding duplicate tests that verify the same behavior at multiple layers without extra value.

Do not start writing tests until the test layer and coverage goal are clear.

### While writing tests

When writing tests:

1. Use descriptive test names.
2. Arrange test data clearly.
3. Act like a real user when testing UI.
4. Assert visible behavior, returned result, persisted state, or side effect.
5. Keep each test focused on one behavior.
6. Avoid brittle assertions tied to implementation details.
7. Use stable fixtures and deterministic data.
8. Test failure paths explicitly.
9. Test security/permission boundaries explicitly when relevant.
10. Add comments only when setup or behavior is non-obvious.

### After writing tests

After writing tests:

1. Verify the test fails before the fix when writing a regression test, if practical.
2. Run the smallest relevant test command.
3. Run broader tests only when the change affects shared behavior.
4. Report which behavior is covered.
5. Report which commands were run.
6. Report skipped tests or commands with the reason.

## Behavior coverage checklist

When deciding test cases, consider everything the user can or may do.

### User happy paths

Test the intended normal flow.

Examples:

* user fills valid form and submits
* teacher creates valid content
* admin updates valid settings
* student opens available content
* upload succeeds with valid file
* payment/webhook flow completes correctly

### User mistakes

Test common mistakes.

Examples:

* required field missing
* whitespace-only input
* invalid email/phone/slug
* too long text
* wrong file type
* too large file
* duplicate option labels
* no correct answer selected
* invalid number input
* double submit
* stale form data

### Malicious or broken client behavior

Test behavior that UI would normally prevent but API/server must still reject.

Examples:

* client submits forbidden role/status
* client submits another user’s ID
* client submits invalid UUID
* client bypasses disabled button
* client sends extra unknown fields
* client sends malformed FormData
* client sends invalid enum value
* client submits price/discount/payment status directly
* unauthenticated request
* unauthorized role
* missing permission
* unsafe filename/path/bucket

### Boundary and edge cases

Test limits and transitions.

Examples:

* min/max length
* min/max numeric values
* empty arrays
* maximum options
* duplicate values
* existing soft-deleted rows
* draft vs published content
* pending vs paid vs cancelled payment state
* first item / last item ordering
* retrying same action
* simultaneous requests when practical

### Stability and resilience

Test that behavior is stable under realistic failure.

Examples:

* validation failure returns early before mutation
* failed upload does not persist partial state
* failed database call returns safe error
* retryable webhook is idempotent
* duplicate submit does not duplicate data
* integration flow leaves consistent state
* missing optional field is handled intentionally

### Security and authorization

Test permission boundaries.

Examples:

* unauthenticated user is rejected
* wrong role is rejected
* owner-only action rejects non-owner
* admin-only action rejects non-admin
* teacher-only action rejects student
* RLS-protected data is not visible to unauthorized user
* client-submitted privileged fields are ignored or rejected
* internal errors are not exposed to the client

### Performance and efficiency

Do not micro-benchmark normal UI logic unless needed.

But when performance matters, test or inspect:

* no obvious repeated expensive query
* no unnecessary duplicate mutation
* no unbounded loop over user input
* pagination/limit behavior
* file size limits
* large form arrays when relevant

Prefer code review and integration coverage over fragile performance tests unless the repo has established performance test tooling.

## Test placement rules

Use existing folders first.

Current preferred folders:

```txt
__tests__/actions
__tests__/components
__tests__/integration
__tests__/schemas
__tests__/utils
```

Suggested future folders only when needed:

```txt
__tests__/api
__tests__/forms
__tests__/e2e
```

Do not create a new test folder when an existing folder already clearly fits.

Use `__tests__/components` for React Hook Form tests unless form tests become large enough to deserve `__tests__/forms`.

Use `__tests__/schemas` for pure Zod validation tests.

Use `__tests__/integration` for Supabase-backed behavior.

Use `__tests__/actions` for Server Action behavior.

Use `__tests__/utils` for pure helpers.

Use `__tests__/api` only when Route Handler tests become common enough to justify a dedicated folder.

Use `__tests__/e2e` later when real E2E tooling is introduced.

## Test naming rules

Test names should describe behavior, not implementation.

Good:

```ts
it("rejects whitespace-only course titles before creating a course", async () => {});
```

Good:

```ts
it("does not upload question group media when the user is not teacher or admin", async () => {});
```

Good:

```ts
it("keeps only one payment transition when duplicate webhook events arrive", async () => {});
```

Bad:

```ts
it("calls safeParse", async () => {});
```

Bad:

```ts
it("sets state", async () => {});
```

Prefer names that mention:

* actor
* action
* condition
* expected outcome

## Test file header rules

For non-trivial test files, add a Vietnamese test plan comment near the top of the file.

This is required for:

* integration tests
* RPC tests
* RLS tests
* Server Action tests with multiple branches
* Route Handler/API tests
* form interaction tests
* payment/webhook tests
* upload tests
* race-condition-sensitive tests
* regression tests for important bugs
* any test file with more than one meaningful behavior group

The header must explain:

* what behavior or user flow is being tested
* test category: unit, schema, component, form interaction, action, API, integration, smoke, or future E2E note
* main success cases
* main failure cases
* security/permission cases when relevant
* stability/resilience/race-condition cases when relevant
* expected final invariant
* latest verification result if the test was run
* related function/action/route/RPC name when applicable

Use concise Vietnamese comments. Multi-line comments are allowed.

Preferred format:

```ts
// Test plan:
// - Mục tiêu: kiểm tra <behavior/user flow/system guarantee>.
// - Loại test: <unit/schema/component/form interaction/action/API/integration/smoke>.
// - Đối tượng: <function/action/route/RPC/component/schema>.
// - Case thành công:
//   - <success case 1>
//   - <success case 2>
// - Case thất bại:
//   - <failure case 1>
//   - <failure case 2>
// - Bảo mật/phân quyền:
//   - <security or permission case, nếu có>
// - Ổn định/resilience:
//   - <retry/double submit/race/rollback/idempotency case, nếu có>
// - Invariant cần giữ:
//   - <system state that must always be true>
// - Kết quả verify gần nhất: <passed/failed/skipped> bằng `<command>`.
// - Ghi chú: <reason if skipped, flaky, future E2E, or follow-up needed>.
```

Example for RPC/integration tests:

```ts
// Test plan:
// - Mục tiêu: kiểm tra RPC tạo course kèm dữ liệu con giữ đúng tính toàn vẹn giao dịch.
// - Loại test: integration/RPC.
// - Đối tượng: public.create_course_with_content.
// - Case thành công:
//   - insert course, topics, exercises, questions, options đầy đủ trong cùng một flow.
//   - dữ liệu cha/con liên kết đúng khóa ngoại sau khi RPC hoàn tất.
// - Case thất bại:
//   - payload không hợp lệ bị reject trước khi tạo dữ liệu.
//   - lỗi giữa chừng không để lại dữ liệu rác.
//   - không tồn tại course cha không có topic con nếu flow yêu cầu tạo đủ.
//   - không tồn tại topic/question/option con mồ côi.
// - Bảo mật/phân quyền:
//   - user không đủ quyền không thể tạo course/content.
// - Ổn định/resilience:
//   - retry hoặc lỗi giữa chừng không tạo duplicate ngoài ý muốn.
// - Invariant cần giữ:
//   - RPC thành công thì toàn bộ graph dữ liệu hợp lệ; RPC thất bại thì rollback sạch.
// - Kết quả verify gần nhất: passed bằng `npm run test:integration`.
```

Example for React Hook Form/form interaction tests:

```ts
// Test plan:
// - Mục tiêu: kiểm tra form tạo câu hỏi phản ánh đúng hành vi người dùng và submit payload.
// - Loại test: component/form interaction.
// - Đối tượng: QuestionEditorForm.
// - Case thành công:
//   - user nhập dữ liệu hợp lệ và submit đúng payload.
//   - user thêm/xóa option thì payload cập nhật đúng thứ tự.
// - Case thất bại:
//   - thiếu nội dung câu hỏi thì hiển thị lỗi.
//   - không chọn đáp án đúng thì không cho submit.
//   - option rỗng hoặc trùng label bị báo lỗi.
// - Bảo mật/phân quyền:
//   - không áp dụng ở component test; server action/API vẫn phải tự validate lại.
// - Ổn định/resilience:
//   - submit thất bại giữ lại input để user sửa.
// - Invariant cần giữ:
//   - UI không tạo payload sai shape so với schema server.
// - Kết quả verify gần nhất: passed bằng `npm run test`.
```

Example for API/upload tests:

```ts
// Test plan:
// - Mục tiêu: kiểm tra upload media chỉ nhận file hợp lệ và không leak lỗi nội bộ.
// - Loại test: API/Route Handler.
// - Đối tượng: POST /api/question-group-media.
// - Case thành công:
//   - teacher/admin upload image/audio hợp lệ và nhận bucket/path/publicUrl.
// - Case thất bại:
//   - thiếu file bị reject.
//   - type không hợp lệ bị reject.
//   - file quá dung lượng bị reject.
//   - Storage upload lỗi trả safe error cho client.
// - Bảo mật/phân quyền:
//   - unauthenticated user bị reject.
//   - user không phải teacher/admin bị reject.
//   - không tin client-provided filename/path/bucket.
// - Ổn định/resilience:
//   - upload lỗi không trả raw Storage error ra client.
// - Invariant cần giữ:
//   - chỉ file đã validate và user đủ quyền mới được upload.
// - Kết quả verify gần nhất: skipped; chưa có API test command riêng.
```

Do not add huge headers for tiny one-case tests.

For simple unit tests, a one-line purpose comment is enough when the test name already explains the behavior.

Do not mark “passed” unless the command was actually run.

If the command was not run, write:

```ts
// - Kết quả verify gần nhất: not run; lý do: <reason>.
```

If the test is intentionally a future E2E placeholder, write:

```ts
// - Kết quả verify gần nhất: future E2E note only; chưa thêm tooling E2E.
```

Do not let the header become stale. When adding/removing test cases, update the header in the same edit.


## Mocking rules

Mock only what is outside the behavior under test.

Good mocks:

* network boundary not relevant to the test
* email provider
* payment provider response when testing local webhook logic
* browser APIs unavailable in test environment
* storage upload result when route behavior is the focus

Avoid mocks that remove the actual behavior being tested.

Bad:

* mocking the schema while testing validation
* mocking the database while testing RLS/RPC behavior
* mocking the Server Action while testing form submit behavior unless the test only covers UI response to action result
* mocking the permission check while testing authorization behavior

## Regression test rules

For bug fixes:

1. Reproduce the bug as a failing test when practical.
2. Apply the fix.
3. Verify the test passes.
4. Keep the test focused on the bug’s user-visible or system-visible behavior.
5. Include the previous failure condition in the test name or setup.

If reproducing the exact bug is too expensive, add the closest stable test that protects against the same regression.

## Test data rules

Test data should be:

* minimal
* realistic enough to cover behavior
* deterministic
* isolated from other tests
* named clearly
* cleaned up or reset by existing test setup

Do not rely on accidental seed data unless the integration test setup intentionally uses it.

For database tests, follow existing seed and reset conventions.

## Commenting rules

Use Vietnamese comments when comments are needed in test code.

Comments should explain non-obvious setup, business rules, security boundaries, or why a case exists.

Good:

```ts
// Case này giả lập client bypass UI disabled state để đảm bảo server vẫn chặn role không hợp lệ.
```

Bad:

```ts
// Expect false.
```

Do not comment every assertion when the test name and assertion are already clear.

## Verification workflow

After test changes, inspect `package.json` and run the smallest relevant command.

Common commands:

```bash
npm run test
npm run test:integration
npm run typecheck
npm run lint
npm run build
```

For database-dependent integration tests, also follow the Supabase safe migration skill.

Common database verification:

```bash
npx supabase db reset
npm run test:integration
```

For pure schema/unit/component changes, do not run expensive integration tests unless the change affects shared behavior.

For broad shared changes, run broader tests.

If a command does not exist, inspect `package.json` and use the closest existing script.

## Anti-patterns

Do not:

* test only the happy path
* test implementation details instead of behavior
* mock away the behavior under test
* add E2E tests for every small change
* create duplicate tests at multiple layers without extra confidence
* skip permission-denied tests for security-sensitive behavior
* skip invalid input tests for validation changes
* skip regression tests for bug fixes
* rely only on UI tests for server-side security
* rely only on server tests for complex form interaction behavior
* create new test folders without checking existing structure
* write vague test names
* make tests depend on execution order
* leave flaky timing-based tests
* hide unrelated refactors inside test changes
* broaden production code just to make tests easier unless the design improves

## Final response checklist

When finished, report:

* test files created or changed
* test category used: unit, schema, component, form interaction, action, API, integration, smoke, or future E2E note
* user behaviors covered
* invalid/malicious inputs covered
* permission/security cases covered
* stability/resilience cases covered
* performance/efficiency concerns considered when relevant
* mocks used and why
* fixtures/test helpers reused or added
* verification commands run
* any failed command and the exact reason
* any skipped command and why it was skipped
* any coverage gap that still needs follow-up approval
* test plan header added or updated for non-trivial test files
* latest verification result recorded in the test file header when applicable
* skipped/not-run verification documented with reason

