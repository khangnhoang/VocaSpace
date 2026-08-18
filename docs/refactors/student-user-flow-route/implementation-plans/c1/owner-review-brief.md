# C1 owner-review brief — Enrolled Course Overview

## Quyết định đã chốt

- `/learn/[course-slug]` trở thành enrolled-course overview; enrolled learner không bị auto-redirect sang topic.
- Authenticated nhưng unenrolled learner ở lại same route và thấy clear access state.
- Unenrolled state không expose protected syllabus/progress, primary CTA đi `/courses/[slug]`, secondary có thể về `/learn`, không toast-only.
- Invalid slug dùng safe `notFound()`; valid nonexistent/non-visible course cũng dùng safe not-found behavior.
- Query/contract failure là recoverable error state riêng.
- Completed/in-progress/no-content giữ B2 semantics hiện hành; không kéo final completion truth vào C1.
- Detailed contract: [plan.md](./plan.md). Brief này không override plan.

## Baseline và dependency

- Branch: `feat/enrolled-course-overview`.
- Baseline: `origin/main @ 59d08104f78a4eb744c2420c8ec5db7ab712e1e3`.
- PR #74/B3 đã merge bằng chính commit baseline; exact route hiện là temporary B3 redirect và sẵn sàng được C1 reclaim.
- B2 đã merge qua PR #48 (`00bdadab`) và sở hữu visibility/progress/topic-ordering/next-topic semantics cần reuse.
- Planning finalized; C1 implementation chưa bắt đầu.

## Contract implementation

`getEnrolledCourseOverview(rawCourseSlug)` phải:

1. Parse bằng existing `publicCourseSlugSchema`; invalid trả `not_found` trước DB client.
2. Auth bằng `getUser()`; no-user là `auth_required`, còn auth service/query error là recoverable `QUERY_FAILED`.
3. Resolve only published active course basic identity.
4. Check current-user enrollment rõ ràng.
5. Dừng protected reads và trả public-safe `unenrolled` result khi enrollment không tồn tại.
6. Chỉ sau enrollment mới đọc active chapters, published active topics và current-user completed progress.
7. Reuse shared B2 progress projection; không duplicate ordering/status/next-topic.
8. Validate strict result DTO; query/contract errors trả safe recoverable state.

Result states:

| State | Page behavior |
| --- | --- |
| `auth_required` | `redirect("/login")` |
| `not_found` | `notFound()` |
| `unenrolled` | Same-route access state; primary public detail, secondary `/learn`; no protected course path |
| `success` | Overview với progress, ordered topics và state-specific CTA |
| `error` | Recoverable alert + `router.refresh()` |

## Checkpoints và gates

| Checkpoint | Outcome | Required gate |
| --- | --- | --- |
| CP1 — Data contract + shared projection | Action/schema, explicit access classification, B2 pure projection/pagination reuse | Focused action/helper/B2 regressions, TypeScript, targeted lint, diff check |
| CP2 — Route/UI states | Replace B3 redirect; success/completed/no-content/unenrolled/error/loading UI; route regressions | Focused component/public/B2 regressions, TypeScript, targeted lint, diff check |
| CP3 — Browser/manual + docs | Isolated seeded smoke, responsive/access matrix, final regression/build and evidence reconciliation | Full Vitest, TypeScript, focused E2E, build, diff/final audit |

Thứ tự là CP1 -> CP2 -> CP3. Không parallel vì shared contract và route tests overlap. C1 phù hợp một PR mức `Medium`.

## Fixture readiness

Existing `supabase/seed.sql` đủ:

- in-progress: `b2-qa-in-progress`;
- completed: `b2-qa-completed`;
- no-content: `b2-qa-no-content`;
- published course có protected topic nhưng seeded student chưa enroll: `local-toeic-test-course`;
- invalid/nonexistent dùng deterministic URL, không cần row.

Không thêm migration, RLS, RPC, view, trigger, index, seed hoặc service role. Focused E2E runner tự reset isolated local Supabase trước browser QA.

## UI direction

- Learning Experience, medium latitude; single job là cho learner biết vị trí hiện tại và hành động tiếp theo.
- Reuse slate/blue/cyan, typography, radius và surfaces của B2; không đổi shared primitives/tokens.
- Signature là ordered learning path theo chapter với completed/current/upcoming state language.
- Mobile order: identity -> progress/next CTA -> topic path; desktop giữ learning path chính và progress/action hỗ trợ.
- Unenrolled/error/no-content là persistent semantic surfaces, không toast; error có retry, unenrolled có exact CTA hierarchy.

## Scope cấm và stop conditions

Không chạm C2 nested workspace URL/sidebar/back-forward, memory check, final completion truth, preview, `STUDENT-005`, payment/public-detail redesign, shared UI primitives, packages hoặc database.

Dừng nếu cần policy/migration/RPC/seed, collaborator preview behavior, nested workspace change, global 404, broad B2 refactor hoặc nếu B2 output/order/status không thể giữ nguyên sau shared extraction.

## Planning review và quyền

- Main-agent self-review: không còn `Critical`/`Required`; `0 specialist` vì không còn material unresolved hard-risk cluster.
- Planning verdict: **Approved for implementation review**.
- Owner đã cấp quyền planning/status documentation, planning commit và push branch trong lượt này.
- Owner **chưa cấp quyền** implement application/test/data code, tạo/update PR, merge hoặc deploy.
- Sau planning commit/push, dừng và chờ explicit implementation authorization.
