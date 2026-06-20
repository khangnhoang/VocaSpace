---

name: code-commenting-and-maintainability
description: General code-comment quality and maintainability rules for VocaSpace/DevSpace. Use when adding, changing, reviewing, or removing source-code comments, JSDoc/TSDoc, TODO/FIXME notes, test-plan headers, or explanations of non-obvious implementation behavior.
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Code Commenting and Maintainability

## Activation scope

Use this skill when a task:

* adds, changes, reviews, or removes comments;
* changes behavior near an existing comment;
* introduces non-obvious business rules, permission checks, ordering, concurrency, rollback, compatibility behavior, or workarounds;
* creates structured file-level documentation required by another skill;
* requires deciding whether code should be simplified instead of commented.

Also follow the relevant domain skill:

* frontend state and interaction: `frontend-workflow`;
* UI/UX intent: `frontend-design`;
* Server Actions, Route Handlers, Zod, FormData, uploads, and webhooks: `nextjs-server-action-zod`;
* SQL migrations, RLS, RPC, triggers, locks, and constraints: `supabase-safe-migration`;
* tests, fixtures, and verification metadata: `test-quality-strategy`.

## Main goal

Comments must help a Vietnamese developer who did not implement the code understand:

* what the file or block is responsible for;
* what data it receives;
* what it removes, retains, or produces;
* why a non-obvious decision exists;
* where the result goes next.

The goal is not maximum comment coverage.

The goal is enough context to understand the code without turning the file into a wall of text.

## Language

Use plain Vietnamese in project-owned source code.

Keep exact identifiers, file paths, API names, SQL names, types, library names, `SSOT`, `TOEIC`, `MVP`, `Zod`, `Supabase`, `Server Action`, `RPC`, and `RLS`.

Keep other English terms only when translating them would make the sentence harder to understand.

Prefer:

* `chốt kiểm tra` or `chốt chặn` instead of `boundary`;
* `cấu trúc dữ liệu` instead of `shape`;
* `bản ghi` instead of `row`;
* `tầng` instead of `layer`;
* `sử dụng` instead of `consume`;
* `trả ra` instead of `expose`;
* `lỗi` or `vấn đề` instead of `issue` in ordinary prose;
* `nút hành động chính` instead of `primary CTA` in ordinary prose;
* `cây dữ liệu` or `gói dữ liệu liên quan` instead of `graph`;
* `bước tính kết quả` instead of `derivation`;
* `khi chương trình chạy` instead of `runtime`;
* `phương án dự phòng` instead of `fallback`;
* `mức độ sẵn sàng của khóa học` instead of `readiness`.

Exact code symbols such as `deriveCourseDashboardReadiness`, `CourseReadinessIssue`, or `primaryCta` must remain unchanged.

Do not mix English and Vietnamese merely to make a comment sound more technical.

Bad:

```ts
// Derive readiness issues từ active graph theo remediation priority.
```

Useful:

```ts
// Tạo danh sách lỗi từ dữ liệu còn hoạt động và sắp theo thứ tự nên sửa.
```

## Comment hierarchy

Prefer comments at the highest useful level.

### 1. File-level overview

Use one short file-level comment when the file’s overall responsibility is not obvious.

Example:

```ts
// File này nhận dữ liệu nội dung của một khóa học và tạo ra:
// - số lượng nội dung còn hoạt động;
// - danh sách lỗi khiến khóa học chưa sẵn sàng;
// - thứ tự nên sửa;
// - đường dẫn tới nơi sửa.
//
// Việc đăng nhập, kiểm tra quyền và đọc Supabase được xử lý ở Server Action.
```

Do not repeat this explanation before every function.

### 2. Section or phase comments

For a long function, use a few comments to mark the main stages.

Prefer roughly 3–6 phase comments, for example:

```ts
// 1. Lọc cây dữ liệu còn hoạt động.
```

```ts
// 2. Gom dữ liệu con theo ID cha để tra cứu nhanh.
```

```ts
// 3. Kiểm tra các điều kiện khiến khóa học chưa sẵn sàng.
```

```ts
// 4. Sắp lỗi và chọn nút hành động chính.
```

Do not add a comment before every query, loop, or `if`.

### 3. Local comments

Inside a function, comment only decisions that are difficult to infer from the code.

Useful:

```ts
// Vẫn giữ question có group_id không hợp lệ để bước sau có thể báo lỗi,
// thay vì loại nó khỏi dữ liệu và làm lỗi biến mất.
```

Usually unnecessary:

```ts
// Course không có chapter thì thêm lỗi.
if (activeChapters.length === 0) {
```

The condition and issue code already explain that behavior.

## Major exports and schema-heavy files

Do not comment every export mechanically.

Add a short comment before a major exported schema, contract, helper, or constant only when its role is not obvious from its name and type.

A reviewer opening the file directly at that symbol should understand, when relevant:

* what data it represents;
* where the data comes from;
* what this schema or contract guarantees;
* what remains the responsibility of another step.

When several adjacent schemas share the same rule, explain that rule once before the group.

Example:

```ts
// Các schema bên dưới chỉ kiểm tra cấu trúc bản ghi lấy từ Supabase.
// Việc kiểm tra quyền, quan hệ cha-con và khóa học còn thiếu gì được xử lý ở bước khác.
```

Then add local comments only for important exceptions:

```ts
// Cho phép content rỗng để hệ thống có thể báo lỗi sửa được,
// thay vì làm toàn bộ dữ liệu khóa học không đọc được.
export const courseReadinessQuestionSchema = ...
```

Do not write two or three repeated lines before every simple schema.

## Function comments

Do not automatically comment every function or helper.

A function deserves its own comment when at least one of these is not obvious:

* its responsibility is narrower than its name suggests;
* `success` only means success within that function’s limited check;
* it intentionally skips some cases;
* it changes or preserves an important invariant;
* it performs rollback, deduplication, ordering, permission checks, or race-condition protection;
* callers need to know a non-obvious guarantee or limitation.

Example:

```ts
// Chỉ kiểm tra ngữ liệu của bài tập dạng grouped.
// Dạng standalone không thuộc phạm vi của hàm này nên được bỏ qua.
function validateGroupContext(...) {
```

Do not comment helpers whose behavior is already obvious from the name and implementation, such as a simple text check or route wrapper.

## What not to comment

Do not narrate:

* assignments;
* ordinary conditions;
* clear `map`, `filter`, or `reduce` operations;
* `safeParse`;
* early returns;
* obvious function calls;
* ordinary database queries;
* clear issue codes;
* routine arrange/act/assert test structure;
* syntax that is already self-explanatory.

Bad:

```ts
// Lọc các chapter còn hoạt động.
const chapters = rows.filter(isActive);
```

Useful:

```ts
// Giữ question thuộc exercise còn hoạt động kể cả khi group_id bị hỏng,
// vì bước sau cần dữ liệu này để báo câu hỏi mồ côi.
```

A comment near `map`, `filter`, or `reduce` is valid only when it explains why an unusual class of data is retained, excluded, or classified.

## Comment density

Comments must not dominate implementation code.

Use these checks:

* prefer one comment per phase or unusual decision;
* do not comment every type, helper, branch, loop, query, or schema field;
* keep most comments to one or two short sentences;
* use one shared comment for adjacent blocks with the same responsibility;
* if a comment repeats the function name, condition, or issue code, remove it;
* if comments approach one third of an implementation file, review and reduce them;
* preserve comments about permission checks, unusual data retention, ordering, rollback, concurrency, and responsibility splits.

For implementation files, code should remain visually dominant.

Schema-heavy files may contain more comments, but repeated explanations must be shared rather than copied before every export.

## Comment versus documentation

Use:

* inline comments for local implementation decisions;
* function-level comments for a non-obvious function contract;
* a file-level comment for the file’s overall responsibility;
* JSDoc/TSDoc only when callers need guarantees TypeScript cannot express clearly;
* ADR or repository documentation for cross-module design, alternatives, trade-offs, rollout, or historical decisions.

Do not place an essay inside production code.

## TODO and FIXME

A TODO/FIXME must state:

* the concrete missing work or defect;
* why it cannot be completed now;
* the blocker or integration point;
* a searchable task or issue reference when available.

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

## Domain-specific guidance

* Frontend: explain non-obvious state changes, rollback, stale-response prevention, and synchronization.
* Validation and server logic: explain special normalization, validation/auth order, ignored privileged input, upload/webhook verification, and delayed side effects.
* Database: explain migration order, RLS, RPC atomicity, locks, triggers, partial constraints, and existing-data safety.
* Tests: prefer descriptive test names; comment only unusual fixtures, hostile-client simulation, concurrency setup, permission checks, or regression context.

Structured test-plan headers required by `test-quality-strategy` may be longer than ordinary comments.

## Review workflow

When reviewing comments:

1. Read the file without comments and identify what is genuinely difficult to infer.
2. Keep or add one short file-level explanation when the file’s role is unclear.
3. Keep or add a few phase comments for long functions.
4. Keep local comments only for unusual decisions or hidden constraints.
5. Remove comments that repeat names, conditions, issue codes, or syntax.
6. Combine repeated comments into one shared section comment.
7. Rewrite buzzwords into plain Vietnamese.
8. Confirm every comment is supported by the code and tests.
9. Inspect the final file visually and confirm the code is still easier to see than the comments.
10. Inspect the final diff for stale, duplicated, contradictory, or overly dense comments.

## Scope control

* Update comments directly affected by the task.
* Report misleading comments outside scope instead of silently fixing them.
* Do not perform unrelated refactoring or repository-wide comment cleanup.

## Final checklist

* [ ] Comments use plain Vietnamese where possible
* [ ] Exact identifiers and necessary technical terms remain unchanged
* [ ] A short file-level overview exists when needed
* [ ] Long functions use only a few useful phase comments
* [ ] Local comments explain only unusual decisions
* [ ] Major schemas are understandable without repeating the same explanation
* [ ] Comments do not repeat function names, conditions, or issue codes
* [ ] Code remains visually dominant over comments
* [ ] Comment density does not create a wall of text
* [ ] Comments match current behavior
* [ ] TODO/FIXME notes are actionable
* [ ] Verification claims have evidence
* [ ] No unrelated cleanup was introduced
