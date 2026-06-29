---
name: code-commenting-and-maintainability
description: General code-comment quality and maintainability rules for VocaSpace/DevSpace. Use when adding, changing, reviewing, or removing source-code comments, JSDoc/TSDoc, TODO/FIXME notes, test-plan headers, or explanations of non-obvious implementation behavior.
---

# Code Commenting and Maintainability

## Activation scope

Use this skill when a task:

* adds, changes, reviews, or removes source-code comments;
* changes behavior near an existing comment;
* adds or reviews JSDoc/TSDoc, TODO/FIXME notes, test-plan headers, or structured file documentation;
* introduces non-obvious business rules, permissions, security assumptions, ordering, concurrency, rollback, compatibility behavior, or workarounds;
* requires deciding whether code should be simplified instead of commented.

Also follow the relevant domain skill for frontend, validation, database, test, review, and Git rules.

## Core rule

Comments should make non-obvious intent clear. They should not narrate code that is already readable.

Prefer clearer names, smaller functions, or simpler control flow before adding a comment. Add a comment only when a future maintainer would otherwise miss an important reason, boundary, or tradeoff.

## Language

Use plain Vietnamese for comments in project-owned code and tests when comments are needed.

Keep English when required by:

* public API or tooling conventions;
* third-party examples or generated code;
* surrounding file conventions;
* exact identifiers, API names, SQL names, type names, library names, and domain terms such as `SSOT`, `TOEIC`, `MVP`, `Zod`, `Supabase`, `Server Action`, `RPC`, and `RLS`.

Do not mix English and Vietnamese just to make a comment sound more technical.

## Good reasons to comment

Comments are appropriate for:

* non-obvious business rules;
* RLS, security, auth, role, or ownership assumptions;
* migration order, backfill, existing-data safety, and database integrity constraints;
* concurrency, race-condition, idempotency, retry, rollback, or stale-response behavior;
* tricky edge cases where the safe behavior is not obvious from the code;
* external service constraints, such as Supabase, PayOS, Vercel, CI, browser APIs, uploads, or webhooks;
* intentional tradeoffs or compatibility behavior;
* test intent, unusual fixtures, hostile-client simulation, or non-trivial test-plan reasoning.

Useful:

```ts
// Giữ question có group_id hỏng để bước readiness báo lỗi sửa được,
// thay vì lọc mất dữ liệu và làm khóa học trông như hợp lệ.
```

Useful:

```sql
-- Backfill trước khi thêm NOT NULL để migration chạy được trên database đã có dữ liệu.
```

## What not to comment

Do not add comments that merely repeat:

* assignments;
* ordinary `if` conditions;
* clear `map`, `filter`, or `reduce` operations;
* `safeParse` or routine validation calls;
* early returns;
* obvious function calls;
* ordinary database queries;
* self-explanatory issue codes;
* arrange/act/assert test structure;
* syntax that is already clear from nearby names and types.

Avoid:

```ts
// Lọc các chapter còn hoạt động.
const activeChapters = chapters.filter(isActive);
```

The code already says that.

## Comment placement

Prefer the highest useful level:

* Use a short file-level comment only when the file's responsibility is not obvious.
* Use a few phase comments in a long function only when they make the flow easier to scan.
* Use local comments only for unusual decisions or hidden constraints.
* Use one shared comment for adjacent schemas, helpers, or checks that share the same rule.

Do not comment every export, helper, branch, loop, query, or schema field.

## JSDoc and TSDoc

Do not add public API, JSDoc, or TSDoc comments mechanically.

Use them only when:

* an exported or shared utility has a contract callers can easily misuse;
* TypeScript cannot express an important guarantee, limitation, or side effect clearly;
* tooling requires the comment.

Keep routine implementation comments as normal inline comments, not JSDoc.

## TODO and FIXME

A TODO/FIXME must state:

* the concrete missing work or defect;
* why it cannot be completed now;
* the blocker, follow-up, or integration point;
* a searchable task or issue reference when available.

Avoid:

```ts
// TODO: fix later
```

Prefer:

```ts
// TODO: thay adapter mock bằng Server Action khi endpoint review tồn tại;
// hiện tại không được hiển thị success giả.
```

Remove TODO/FIXME notes when the condition no longer exists.

## Test-plan headers

Preserve the `test-quality-strategy` convention: non-trivial test files need a concise Vietnamese test-plan header when that skill requires it.

The header may be longer than ordinary comments because it documents test intent, covered behavior, verification status, and known gaps. Keep it accurate and update it when cases or verification change.

## Review workflow

When reviewing or editing comments:

1. Read the code without the comment and decide what is genuinely hard to infer.
2. Remove comments that repeat names, conditions, issue codes, or syntax.
3. Keep or add comments for hidden constraints, business rules, security boundaries, data integrity, concurrency, external service limits, and meaningful test intent.
4. Rewrite vague or buzzword-heavy prose into plain Vietnamese where possible.
5. Confirm every remaining comment matches the current code and tests.
6. Inspect the final diff for stale, duplicated, contradictory, or overly dense comments.

## Scope control

Update comments directly affected by the task.

Report misleading comments outside scope instead of silently doing a repository-wide cleanup.

Do not introduce unrelated refactors while improving comments.

## Final checklist

* [ ] Comments use Vietnamese where project conventions allow it
* [ ] Comments explain why, boundary, risk, or intent rather than obvious syntax
* [ ] No noisy comments were added
* [ ] JSDoc/TSDoc is limited to genuinely useful exported/shared contracts or tooling needs
* [ ] TODO/FIXME notes are actionable
* [ ] Required test-plan headers remain accurate
* [ ] Comments match current behavior
* [ ] No unrelated cleanup was introduced
