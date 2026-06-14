---
name: code-commenting-and-maintainability
description: General code-comment quality and maintainability rules for VocaSpace/DevSpace. Use when adding, changing, reviewing, or removing inline comments, function-level comments, JSDoc/TSDoc, TODO/FIXME notes, structured file-level documentation, or explanations of non-obvious implementation behavior. Domain-specific skills may add stricter requirements.
---

# Code Commenting and Maintainability

## Activation scope

Use this skill when a task:

* adds, changes, reviews, or removes comments
* adds function-level documentation or JSDoc/TSDoc
* adds TODO/FIXME notes
* changes behavior near an existing comment
* introduces non-obvious business rules, invariants, trust boundaries, ordering, concurrency, compatibility behavior, or workarounds
* creates structured file-level documentation required by another skill
* requires deciding whether code should be simplified instead of commented

This skill owns general comment quality. Domain skills own domain-specific comment subjects and structured documentation.

## Related skills

Also follow the relevant domain skill:

* frontend state and interaction: `frontend-workflow`
* UI/UX intent: `frontend-design`
* Server Actions, Route Handlers, Zod, FormData, uploads, and webhooks: `nextjs-server-action-zod`
* SQL migrations, RLS, RPC, triggers, locks, and constraints: `supabase-safe-migration`
* tests, test-plan headers, fixtures, and verification metadata: `test-quality-strategy`

A structured file-level comment required by a domain skill is intentional and may be longer than an ordinary code comment.

## Core rules

* Use Vietnamese comments in project-owned source code unless the surrounding file has a strong existing language convention.
* Keep identifiers, API names, SQL names, types, and established technical terms unchanged.
* Explain information that cannot be understood reliably from names, types, tests, and structure.
* Prefer the smallest useful comment.
* Keep comments synchronized with behavior.
* Review nearby comments whenever behavior changes.
* Do not use comments to hide code that can reasonably be clarified.
* Do not expand scope into repository-wide comment cleanup unless explicitly requested.

## Comment types

### Explanatory comments

Use inline, function-level, stage, or SQL comments for non-obvious:

* intent or business rules
* invariants and correctness constraints
* trust, validation, auth, or permission boundaries
* ordering requirements
* race-condition, idempotency, optimistic update, or rollback reasoning
* compatibility constraints and workarounds
* intentional behavior that appears removable
* limitations imposed by external systems

### API and contract documentation

Use JSDoc/TSDoc only when callers need information that TypeScript cannot express clearly, such as:

* guarantees and important preconditions
* side effects
* non-obvious return or error behavior
* lifecycle or ownership constraints

Do not repeat the signature, parameter types, or obvious function behavior.

### Structured file-level documentation

A domain skill may require a header summarizing a test plan, migration strategy, generated boundary, or other complex artifact.

Structured metadata may include time-sensitive information such as the latest verification result when the owning skill requires it. Update it whenever the file or verification state changes.

## Decision order

Before adding an explanatory comment:

1. Improve naming if that makes the behavior clear.
2. Simplify control flow or use early returns.
3. Extract a well-named helper when useful.
4. Reduce duplicated or tangled logic when safely in scope.
5. Add a comment only if a non-obvious reason or invariant remains.

Do not perform unrelated refactoring merely to avoid one small comment.

## What not to comment

Do not narrate:

* assignments or ordinary conditions
* `map`, `filter`, or `reduce`
* self-explanatory function calls
* `safeParse`
* early returns
* ordinary auth lookup or database mutation
* obvious assertions
* routine arrange/act/assert structure

Bad:

```ts
// Lọc các course.
const pendingCourses = courses.filter(isPendingCourse);
```

Useful:

```ts
// Giữ course trong danh sách pending đến khi server xác nhận để rollback
// có thể khôi phục đúng vị trí nếu request thất bại.
```

## Function-level and stage comments

Do not automatically comment every exported or non-trivial function.

Add a function-level comment only when the contract, reason for existence, trust boundary, side effect, ordering, or invariant is not clear from the name, types, schema, module, and structure.

Function length alone does not require stage comments. Prefer clear names, whitespace grouping, early returns, and helpers first.

Avoid:

```ts
// Validate input.
// Check auth.
// Update database.
// Return response.
```

Use a stage comment when it explains why a stage exists or must occur in that position.

## TODO and FIXME

A TODO/FIXME must state:

* the concrete missing work or defect
* why it cannot be completed now
* the blocker or integration boundary
* a searchable task or issue reference when available

Avoid:

```ts
// TODO: fix later
```

Prefer:

```ts
// TODO: thay adapter mock bằng Server Action khi endpoint lời mời tồn tại;
// hiện tại không được hiển thị success giả.
```

Remove TODO/FIXME notes when the condition no longer exists.

## Comment versus documentation

Use:

* inline comment for a local implementation decision
* JSDoc/TSDoc for a caller-facing contract
* structured file header when a domain skill requires a map of the file
* ADR or repository documentation for cross-module architecture, alternatives, trade-offs, rollout, migration plans, or historical context

Do not place an essay inside production code.

## Domain-specific guidance

* Frontend: document non-obvious state transitions, optimistic rollback, stale-response prevention, synchronization, and interaction correctness.
* Validation/server boundaries: document special normalization, validation/auth ordering, ignored privileged input, upload/webhook verification, and delayed side effects.
* Database: document migration order, RLS boundaries, RPC atomicity, locks, triggers, partial constraints/indexes, and existing-data safety.
* Tests: prefer descriptive test names; comment only non-obvious fixtures, hostile-client simulation, concurrency setup, permission boundaries, or regression context.

The test-plan header required by `test-quality-strategy` is structured file-level documentation and must not be removed merely because individual test names are descriptive.

## Review workflow

When reviewing a changed file:

1. Inspect comments near changed behavior.
2. Update or remove stale comments.
3. Check whether new non-obvious intent or invariants need explanation.
4. Prefer clearer code over a redundant explanatory comment.
5. Apply domain-specific structured documentation requirements.
6. Reject claims unsupported by code, tests, types, or primary documentation.
7. Reject verification claims when the command was not actually run.
8. Inspect the final diff for duplicated or contradictory comments.

## Scope control

* Update comments directly affected by the task.
* Report misleading comments outside scope instead of silently fixing them.
* Use a dedicated cleanup task for broader comment work.

## Final checklist

* [ ] Language follows repository convention
* [ ] Comments explain non-obvious reasons, not syntax
* [ ] Naming and structure were considered first
* [ ] Function-level and stage comments are justified
* [ ] Required structured documentation is present
* [ ] Domain-specific guidance was followed
* [ ] Nearby comments still match behavior
* [ ] TODO/FIXME notes are actionable
* [ ] Verification claims have evidence
* [ ] No unrelated cleanup was introduced
