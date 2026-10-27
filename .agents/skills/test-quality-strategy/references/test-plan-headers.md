# Test-plan headers

Read when the parent routes a concrete non-trivial test file here. Skip tiny one-case units and merely selecting layers/reporting existing evidence.

Keep a concise Vietnamese header near the top:
~~~ts
// Test plan:
// - Mục tiêu: <observable guarantee>.
// - Loại test và đối tượng: <layer and subject>.
// - Thành công / thất bại: <meaningful case groups>.
// - Phân quyền / resilience: <denied paths, retry or concurrency when applicable>.
// - Invariant và cleanup: <what stays true and how fixtures are restored>.
// - Khoảng trống đã biết: <pending coverage or none>.
~~~

Update when the test's promised behavior/cases change. Do not store a last-run result, count or timestamp in the header: it becomes stale; commands/results belong in the current report. Inline comments explain only non-obvious setup, hostile-client simulation, permission, timing or safe mock boundaries under code-commenting-and-maintainability.
