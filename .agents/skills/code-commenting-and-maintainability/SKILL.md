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
* introduces non-obvious business rules, invariants, permission checks, ordering, concurrency, compatibility behavior, or workarounds
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
* Keep identifiers, API names, SQL names, types, library names, and technical terms unchanged only when translating them would make the comment harder to understand.
* Prefer plain Vietnamese over architecture jargon and buzzwords.
* Explain information that cannot be understood reliably from names, types, tests, and structure.
* Also explain where data comes from, where it goes next, and which layer owns the remaining responsibility when that is not obvious.
* Prefer the smallest useful comment, but do not remove context that a reviewer needs to reconstruct the dataflow.
* Keep comments synchronized with behavior.
* Review nearby comments whenever behavior changes.
* Do not use comments to hide code that can reasonably be clarified.
* Do not expand scope into repository-wide comment cleanup unless explicitly requested.

## Plain-language rule

Comments and reports must be understandable to a Vietnamese developer who did not participate in the implementation.

Use the simplest wording that preserves the technical meaning.

Prefer:

* `chốt kiểm tra`, `chốt chặn`, or `ranh giới trách nhiệm` instead of `boundary`
* `cấu trúc dữ liệu` instead of `shape`
* `bản ghi` instead of `row`
* `tầng` instead of `layer`
* `sử dụng` or `nhận để hiển thị` instead of `consume`
* `trả ra` or `công khai` instead of `expose`
* `thứ tự phụ thuộc` instead of `dependency order`
* `mức độ nghiêm trọng để hiển thị` instead of `presentation severity`
* `nội dung thực` instead of `meaningful content`
* `dữ liệu còn hoạt động` instead of `active entity`

Keep English when it is the real identifier or the clearer established term, for example:

* `Zod`
* `Supabase`
* `Server Action`
* `soft-delete`
* `issue`
* `CTA`
* `RPC`
* `RLS`
* `schema`
* `derivation`

Do not mix English and Vietnamese merely to make a comment sound more formal.

Bad:

```ts
// Derive semantic remediation outcome tại runtime boundary.
```

Useful:

```ts
// Chuyển graph đã được Zod kiểm tra thành danh sách issue, counts và CTA.
```

A comment fails this rule if a reviewer must translate it into simpler Vietnamese before understanding it.

## Reviewability for agent-generated code

When an AI agent adds or substantially changes domain-heavy code, comments must support a reviewer who did not participate in the implementation.

Names and types may describe the data structure without explaining:

* where the data comes from
* where the data goes next
* which layer owns the current responsibility
* what the current layer guarantees
* what the current layer intentionally does not guarantee
* which business rule the code represents
* why apparently invalid data is retained or excluded

Add concise orientation comments when a reviewer would otherwise need to reconstruct those facts from multiple files.

Do not rely on one umbrella comment for a long sequence of exported domain contracts when reviewers may jump directly to an individual symbol.

Do not comment every export mechanically. Major exported domain schemas, contracts, helpers, and constants need comments only when their source, destination, guarantees, limits, or role in the dataflow are not obvious.

Review comments as if the reader opens the file at an arbitrary exported symbol rather than reading from the first line.

## Schema-heavy domain files

In schema-heavy domain files, distinguish clearly between:

* route or external input validation
* raw database record validation
* assembled graph validation
* authentication and permission checks
* relationship validation
* business-rule derivation
* public output contracts
* safe result and error contracts

A reviewer should be able to jump directly to a major exported schema and understand:

1. what data it represents
2. where the data comes from
3. what the schema guarantees
4. what it intentionally does not guarantee
5. which layer handles the remaining responsibility

A shared umbrella comment is insufficient when multiple exported schemas have different roles or deferred responsibilities.

Keep comments short when several schemas share the same rule. Put the shared rule in one file-level or section comment, then give each schema only the detail unique to it.

## Comment types

### Explanatory comments

Use inline, function-level, stage, or SQL comments for non-obvious:

* intent or business rules
* invariants and correctness constraints
* validation, authentication, or permission checks
* ordering requirements
* race-condition, idempotency, optimistic update, or rollback reasoning
* compatibility constraints and workarounds
* intentional behavior that appears removable
* limitations imposed by external systems
* data intentionally retained for later error reporting
* data intentionally excluded from counts, lookup maps, or public output

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
5. Add a comment when a non-obvious reason, responsibility, or invariant remains.

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
* business conditions already fully expressed by a clear identifier and issue code

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

A comment near `map`, `filter`, or `reduce` is still useful when it explains why a non-obvious class of data is intentionally retained, excluded, or classified.

Useful:

```ts
// Giữ question thuộc exercise còn hoạt động kể cả khi group_id không hợp lệ
// để bước sau có thể báo câu hỏi mồ côi thay vì làm dữ liệu lỗi biến mất.
const activeQuestions = ...
```

## Function-level and stage comments

Do not comment every exported or non-trivial function mechanically.

Add a function-level comment when the contract, reason for existence, permission check, side effect, ordering, or invariant is not clear from the name, types, schema, module, and structure.

Function length alone does not require stage comments.

A function with multiple semantic stages should expose those stages when a reviewer would otherwise need to reverse-engineer the dataflow.

Typical stages that may deserve comments include:

* kiểm tra input
* xác thực người dùng
* kiểm tra quyền
* đọc dữ liệu theo từng tầng
* kiểm tra dữ liệu bằng Zod
* dựng cây dữ liệu còn hoạt động
* tạo các bảng tra cứu quan hệ
* phân loại dữ liệu hợp lệ và dữ liệu lỗi
* sinh issue
* sắp xếp issue
* chọn CTA
* loại metadata nội bộ trước khi trả kết quả

Prefer 4–6 clear stage comments over comments before every branch.

Avoid:

```ts
// Validate input.
// Check auth.
// Update database.
// Return response.
```

Use a stage comment when it explains why a stage exists, what responsibility it owns, or why it must occur before another stage.

## Comment-density control

Comments must improve navigation rather than turn a file into a wall of text.

Use these rules:

* Prefer one comment per phase or non-obvious invariant.
* Do not add a comment before every `if`, loop, schema field, or helper.
* In implementation files, avoid comments that merely repeat a clear condition or issue code.
* In schema-heavy files, major exports may each need a short comment because reviewers often jump directly to one symbol.
* When several adjacent blocks share the same rule, use one section comment and only add local comments for exceptions.
* Keep most comments to one or two short sentences.
* If comments occupy roughly one third of an implementation file, review them for repetition and remove comments that only restate the code.
* Preserve comments that explain unusual data retention, permission checks, ordering, rollback, race conditions, or responsibility splits.

The goal is not maximum comment coverage. The goal is enough context for a reviewer to understand the code without reading an essay between every block.

## TODO and FIXME

A TODO/FIXME must state:

* the concrete missing work or defect
* why it cannot be completed now
* the blocker or integration point
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
* Validation/server logic: document special normalization, validation/auth ordering, ignored privileged input, upload/webhook verification, delayed side effects, and which checks belong to Zod versus business logic.
* Database: document migration order, RLS boundaries, RPC atomicity, locks, triggers, partial constraints/indexes, and existing-data safety.
* Tests: prefer descriptive test names; comment only non-obvious fixtures, hostile-client simulation, concurrency setup, permission checks, or regression context.

The test-plan header required by `test-quality-strategy` is structured file-level documentation and must not be removed merely because individual test names are descriptive.

## Review workflow

When reviewing a changed file:

1. Inspect comments near changed behavior.
2. Update or remove stale comments.
3. Check whether a reviewer who did not implement the code can identify the dataflow and responsibility of each major block.
4. Check whether major exported domain schemas and contracts are understandable when opened directly.
5. Remove comments that merely restate names, conditions, issue codes, or collection operations.
6. Keep comments that explain permission checks, unusual data retention, ordering, failure handling, or responsibility splits.
7. Prefer plain Vietnamese over architecture jargon.
8. Apply domain-specific structured documentation requirements.
9. Reject claims unsupported by code, tests, types, or primary documentation.
10. Reject verification claims when the command was not actually run.
11. Inspect the final diff for duplicated, contradictory, or overly dense comments.

## Scope control

* Update comments directly affected by the task.
* Report misleading comments outside scope instead of silently fixing them.
* Use a dedicated cleanup task for broader comment work.

## Final checklist

* [ ] Comments use plain Vietnamese where possible
* [ ] Identifiers and necessary technical terms remain unchanged
* [ ] Comments explain reasons, responsibility, or invariants rather than syntax
* [ ] A reviewer who did not implement the code can follow the main dataflow
* [ ] Major exported domain contracts are understandable when opened directly
* [ ] Schema comments distinguish structure validation from permission and business validation
* [ ] Stage comments expose semantic phases without commenting every branch
* [ ] Comment density does not turn the file into a wall of text
* [ ] Naming and structure were considered first
* [ ] Required structured documentation is present
* [ ] Domain-specific guidance was followed
* [ ] Nearby comments still match behavior
* [ ] TODO/FIXME notes are actionable
* [ ] Verification claims have evidence
* [ ] No unrelated cleanup was introduced
