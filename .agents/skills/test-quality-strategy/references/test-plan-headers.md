# Test-plan Headers

Read this resource only after `../SKILL.md` routes the task here. The core skill remains authoritative for test intent, coverage, verification, and reporting.

## Test-plan header

For non-trivial test files, add a concise Vietnamese header near the top.

Required for:

* integration, RPC, and RLS tests
* multi-branch Server Action tests
* Route Handler/API tests
* form interaction tests
* payment, webhook, upload, and concurrency tests
* important regression tests
* files with more than one meaningful behavior group

This is structured file-level documentation and remains required even when individual test names are descriptive.

Use:

```ts
// Test plan:
// - Mục tiêu: kiểm tra <behavior/user flow/invariant>.
// - Loại test: <schema/component/form/action/API/integration/smoke>.
// - Đối tượng: <function/action/route/RPC/component/schema>.
// - Case thành công:
//   - <case>
// - Case thất bại:
//   - <case>
// - Bảo mật/phân quyền:
//   - <case hoặc "không áp dụng">
// - Ổn định/resilience:
//   - <retry/double submit/race/rollback/idempotency hoặc "không áp dụng">
// - Invariant cần giữ:
//   - <final guarantee>
// - Kết quả verify gần nhất: <passed/failed/not run> bằng `<command>`.
// - Ghi chú: <reason if skipped, future note, or follow-up>.
```

Rules:

* Keep it concise and aligned with actual test groups.
* Update it whenever cases or verification state change.
* Never write `passed` unless the command ran.
* For an unrun file, use `not run` with a reason.
* For smoke E2E coverage, record the actual scenario and verification command. If the browser check cannot run in the current environment, use `not run` with the concrete reason instead of describing E2E as future tooling.
* Tiny one-case unit tests do not need a large header.
