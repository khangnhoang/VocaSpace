# B3 owner-review brief — Legacy public detail redirect

## Quyết định hiện tại

- Owner đã cấp quyền thực hiện CP1/CP2, tạo checkpoint/final commit và push branch `refactor/legacy-public-course-redirect`.
- CP1/CP2 đã implemented và verified. Không có quyền tạo/update PR, merge hoặc deploy; các hành động đó chưa được thực hiện.
- Detailed contract: [plan.md](./plan.md). Brief này không override plan; mọi thay đổi quyết định tiếp theo phải được reconcile vào plan trước khi hành động.

## Vì sao B3 tồn tại

B1 đã tạo canonical public detail `/courses/[course-slug]`; B2 đã tạo student dashboard `/learn`. Trước CP1, exact route `/learn/[course-slug]` vẫn render public detail cũ, trong khi C1 sẽ dùng route đó cho enrolled-course overview. B3 là compatibility bridge tạm thời để canonicalize public detail trước C1.

## Contract đã triển khai

- Chỉ exact `/learn/[course-slug]` dùng temporary `redirect()` sang `/courses/[course-slug]`.
- `publicCourseSlugSchema.safeParse()` normalize/validate raw slug; invalid gọi `notFound()`.
- Slug hợp lệ nhưng không tồn tại vẫn redirect; canonical route chịu trách nhiệm 404.
- `/learn/[course-slug]/[topic-slug]` giữ nguyên learning workspace.
- Không permanent/broad redirect, query forwarding, C1/C2 behavior, action/database/schema/seed/package change.

## Checkpoint breakdown

| Checkpoint | Outcome | Gate | Quyền hiện tại |
| --- | --- | --- | --- |
| P0 — Planning delivery | Reconciled plan/brief/ownership/links, self-review và planning commit/push | Docs link/stale-source/scope audit, `git diff --check`, full diff review | Hoàn tất — `c30cbc1` |
| CP1 — Exact redirect + focused regression | One-segment redirect/not-found contract và direct tests | `3 files / 39 tests`, TypeScript, targeted lint, diff check | Hoàn tất — `1bfd875` |
| CP2 — Route-tree proof + completion | Guest/authenticated legacy redirect, nested route preservation, build và durable evidence | Isolated Supabase Playwright `2/2`, production build, final review | Hoàn tất trên branch; chưa merge |

## Evidence và fixture readiness

- Baseline: `origin/main @ effb5571955aa09b714e97b7162a6bb3bed0bca4`; branch được tạo từ đúng baseline.
- Pre-implementation discovery xác nhận legacy page, component test và smoke test đều còn behavior trước B3; scoped history sau merge planning `03ad1c5` không có implementation change.
- B1/B2 prerequisites đã merge (`079ad469`, `00bdadab`).
- Public smoke tự chọn canonical course published từ isolated seeded environment. B2 seed có student đã enroll và deterministic nested route `/learn/b2-qa-in-progress/b2-qa-progress-topic-2`; CP2 đăng nhập seeded student qua UI trước authenticated redirect/nested proof. Không cần seed/migration mới.

## Rủi ro và điểm phải dừng

- Không stop condition nào bị kích hoạt: implementation không cần permanent/broad redirect, shared schema, action/data layer hoặc C1 behavior.
- Trước follow-up tiếp theo, re-discover nếu `origin/main` thay route/test liên quan hoặc C1 bắt đầu reclaim route.
- `STUDENT-002` vẫn mở sau B3 cho đến C1; không dùng B3 để tuyên bố semantic collision đã đóng hoàn toàn.

## Decision surface tiếp theo

Implementation delivery dừng sau final commit/push. Tạo/update PR, merge hoặc deploy là các quyền riêng chưa được cấp trong lượt này.
