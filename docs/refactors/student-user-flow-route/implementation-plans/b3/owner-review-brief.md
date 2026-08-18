# B3 owner-review brief — Legacy public detail redirect

## Trạng thái hoàn tất

- CP1/CP2 đã implemented, verified và merge qua PR #74 tại `59d08104f78a4eb744c2420c8ec5db7ab712e1e3`.
- B3 không deploy trong workflow này. C1 planning đã finalized trên branch riêng; application implementation chưa bắt đầu.
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
| CP2 — Route-tree proof + completion | Guest/authenticated legacy redirect, nested route preservation, build và durable evidence | Isolated Supabase Playwright `2/2`, production build, final review | Hoàn tất; PR #74 đã merge tại `59d0810` |

## Evidence và fixture readiness

- Baseline: `origin/main @ effb5571955aa09b714e97b7162a6bb3bed0bca4`; branch được tạo từ đúng baseline.
- Pre-implementation discovery xác nhận legacy page, component test và smoke test đều còn behavior trước B3; scoped history sau merge planning `03ad1c5` không có implementation change.
- B1/B2 prerequisites đã merge (`079ad469`, `00bdadab`).
- Public smoke tự chọn canonical course published từ isolated seeded environment. B2 seed có student đã enroll và deterministic nested route `/learn/b2-qa-in-progress/b2-qa-progress-topic-2`; CP2 đăng nhập seeded student qua UI trước authenticated redirect/nested proof. Không cần seed/migration mới.

## Rủi ro và điểm phải dừng

- Không stop condition nào bị kích hoạt: implementation không cần permanent/broad redirect, shared schema, action/data layer hoặc C1 behavior.
- Trước follow-up tiếp theo, re-discover nếu `origin/main` thay route/test liên quan hoặc C1 bắt đầu reclaim route.
- `STUDENT-002` vẫn mở sau B3 cho đến C1; không dùng B3 để tuyên bố semantic collision đã đóng hoàn toàn.

## Handoff sang C1

B3 dependency đã thỏa mãn. C1 detailed plan tại [../c1/plan.md](../c1/plan.md) sở hữu contract tiếp theo; B3 brief này chỉ còn là historical completion record. C1 implementation, PR, merge và deploy vẫn cần authorization riêng.
