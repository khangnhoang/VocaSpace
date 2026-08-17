# B3 owner-review brief — Legacy public detail redirect

## Quyết định hiện tại

- Planning package B3 được phép hoàn thiện, tự review, commit và push trên branch `refactor/legacy-public-course-redirect`.
- Application implementation **chưa được phép bắt đầu**. Không có quyền tạo/update PR, merge, deploy hoặc tự chuyển sang CP1/CP2.
- Detailed contract: [plan.md](./plan.md). Brief này không override plan; mọi thay đổi quyết định phải được reconcile vào plan trước implementation.

## Vì sao B3 tồn tại

B1 đã tạo canonical public detail `/courses/[course-slug]`; B2 đã tạo student dashboard `/learn`. Exact route `/learn/[course-slug]` vẫn render public detail cũ, trong khi C1 sẽ dùng route đó cho enrolled-course overview. B3 là compatibility bridge tạm thời để canonicalize public detail trước C1.

## Contract cần owner cấp quyền riêng để triển khai

- Chỉ exact `/learn/[course-slug]` dùng temporary `redirect()` sang `/courses/[course-slug]`.
- `publicCourseSlugSchema.safeParse()` normalize/validate raw slug; invalid gọi `notFound()`.
- Slug hợp lệ nhưng không tồn tại vẫn redirect; canonical route chịu trách nhiệm 404.
- `/learn/[course-slug]/[topic-slug]` giữ nguyên learning workspace.
- Không permanent/broad redirect, query forwarding, C1/C2 behavior, action/database/schema/seed/package change.

## Checkpoint breakdown

| Checkpoint | Outcome | Gate | Quyền hiện tại |
| --- | --- | --- | --- |
| P0 — Planning delivery | Reconciled plan/brief/ownership/links, self-review và planning commit/push | Docs link/stale-source/scope audit, `git diff --check`, full diff review | Được phép |
| CP1 — Exact redirect + focused regression | One-segment redirect/not-found contract và direct tests | Focused Vitest, TypeScript, targeted lint, diff check | Chưa được phép |
| CP2 — Route-tree proof + completion | Legacy browser redirect, nested route preservation, build và durable evidence | Isolated Supabase Playwright smoke, build, final review | Chưa được phép |

## Evidence và fixture readiness

- Baseline: `origin/main @ effb5571955aa09b714e97b7162a6bb3bed0bca4`; branch được tạo từ đúng baseline.
- B3 chưa implemented: legacy page, component test và smoke test đều còn behavior trước B3; scoped history sau merge planning `03ad1c5` không có implementation change.
- B1/B2 prerequisites đã merge (`079ad469`, `00bdadab`).
- Public smoke tự chọn canonical course published từ isolated seeded environment. B2 seed có student đã enroll và deterministic nested route `/learn/b2-qa-in-progress/b2-qa-progress-topic-2`; CP2 đăng nhập seeded student qua UI trước authenticated redirect/nested proof. Không cần seed/migration mới.

## Rủi ro và điểm phải dừng

- Dừng nếu implementation cần permanent/broad redirect, sửa shared schema, chạm action/data layer hoặc thêm C1 behavior.
- Dừng và re-discover nếu `origin/main` thay route/test liên quan hoặc C1 bắt đầu trước khi CP1 được cấp quyền.
- `STUDENT-002` vẫn mở sau B3 cho đến C1; không dùng B3 để tuyên bố semantic collision đã đóng hoàn toàn.

## Decision surface cho lần cấp quyền implementation sau

Owner chọn một trong ba hướng sau khi đọc brief và detailed plan:

1. Cấp quyền bắt đầu CP1 theo plan hiện tại.
2. Yêu cầu chỉnh plan/contract trước implementation.
3. Hoãn hoặc hủy B3.

Planning commit/push hiện tại không ngầm chọn hướng 1.
