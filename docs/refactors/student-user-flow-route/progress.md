# Theo dõi tiến độ tái cấu trúc luồng student/user và route

## Tài liệu liên quan

Nguồn plan chính thức: [plan.md](./plan.md).

Nhật ký vấn đề, rủi ro và follow-up chi tiết: [problems.md](./problems.md).

ADR quyết định: [refactor-student-user-flow-route-adr.md](../../adr/refactor-student-user-flow-route-adr.md).

## Chú giải trạng thái

- Chưa bắt đầu
- Đang thực hiện
- Implementation complete
- Automated checks passed
- Manual QA pending
- Manual QA đã đạt
- Sẵn sàng code review
- Đã merge
- Bị chặn
- Deferred
- Post-MVP

## Snapshot ban đầu - 2026-07-05

- Tài liệu plan/progress/problems/ADR đã được tạo để chuẩn bị refactor.
- Chưa có route move trong branch tài liệu này.
- Chưa có public catalog implementation.
- Chưa có migration, RLS/RPC change, hoặc business logic change.
- Quyết định hard cut teacher `/courses` -> `/teacher/courses` đã được ghi nhận là accepted.
- `/courses` public catalog, `/learn` student dashboard, `/profile` account-only direction đã được ghi nhận là accepted.

## Tổng quan tiến độ

| Wave / PR | Trạng thái | Dependency | Branch / PR reference | Cập nhật lần cuối | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| Wave A: Teacher route hard cut | Chưa bắt đầu | Documentation plan | Chưa có | 2026-07-05 | Cần chạy trước khi public `/courses`. |
| PR A1: Prepare route helpers and docs | Automated checks passed | Docs branch merged | `codex-pr-a1-teacher-route-helpers` | 2026-07-07 | Centralized route helper, giữ behavior `/courses`; chưa move route. |
| PR A2: Move canonical teacher route | Automated checks passed | PR A1 | `refactor/teacher-course-authoring-namespace` | 2026-07-08 | Hard cut sang `/teacher/courses`, không legacy redirect. |
| PR A3: Teacher route tests and proxy hardening | Manual QA đã đạt | PR A2 | `codex/test-teacher-route-proxy-hardening` | 2026-07-09 | Added proxy/updateSession coverage and segment-aware teacher guard. |
| Wave B: Public catalog/detail and student dashboard | Chưa bắt đầu | Wave A stable | Chưa có | 2026-07-05 | Không bắt đầu trước khi `/courses` được giải phóng. |
| PR B1: Public catalog and detail | Planning hoàn tất | PR A3 | `feat/public-course-catalog-detail` | 2026-07-10 | Base `main@f536b578`; chưa triển khai product changes. |
| PR B2: Student `/learn` dashboard | Chưa bắt đầu | PR B1 | Chưa có | 2026-07-05 | Enrolled courses, continue learning, progress, pending payment summary. |
| PR B3: Redirect old public detail | Chưa bắt đầu | PR B2 | Chưa có | 2026-07-05 | Redirect `/learn/[course-slug]` to `/courses/[course-slug]`. |
| Wave C: Enrolled learning routes and workspace hardening | Chưa bắt đầu | Wave B stable | Chưa có | 2026-07-05 | Course overview and URL-synced workspace. |
| PR C1: Enrolled course overview | Chưa bắt đầu | PR B3 | Chưa có | 2026-07-05 | `/learn/[course-slug]` no auto redirect. |
| PR C2: Workspace route hardening | Chưa bắt đầu | PR C1 | Chưa có | 2026-07-05 | Use actual `[topic-slug]`; clear invalid/locked/unenrolled states. |
| Wave D: Later backlog | Deferred | Stable route/dashboard/workspace contracts | Chưa có | 2026-07-05 | Topic publish, preview, memory check, completion truth, OAuth, deeper review/payment. |

## Wave A: Teacher route hard cut

### PR A1: Prepare route helpers and docs

- Trạng thái: Automated checks passed.
- Planned:
  - Centralize teacher authoring route helpers around `lib/course-authoring/routes.ts`.
  - Update route contract docs if implementation discovers additional helper boundaries.
  - Keep existing behavior if possible.
- In progress:
  - Không còn.
- Done:
  - Documentation plan created.
  - Centralized current teacher authoring browser URL helpers around `lib/course-authoring/routes.ts` with current base `/courses`.
  - Replaced clear teacher-authoring hardcoded links and browser-visible revalidation paths in header, teacher course pages/components, and chapter/topic actions.
  - Wrapped internal `/(teacher)/courses` route-file revalidation separately from browser URL helpers.
- Blocked:
  - Không có blocker đã biết.
- Notes:
  - Do not move physical route files in A1.
  - Do not create public catalog in A1.
- Verification latest:
  - `npm.cmd run test:run -- __tests__/components/course-workspace-routes.test.tsx __tests__/components/course-authoring-trust.test.tsx __tests__/actions/course-structure.test.ts __tests__/utils/course-readiness.test.ts __tests__/schemas/course-readiness.test.ts` - passed, 5 files / 105 tests.
  - `npm.cmd run lint -- "lib/course-authoring/routes.ts" "components/ui/header.tsx" "app/(teacher)/courses/page.tsx" "app/(teacher)/courses/new/page.tsx" "app/(teacher)/courses/_components/CourseList.tsx" "app/(teacher)/courses/[id]/_components/CourseOverview.tsx" "app/(teacher)/courses/[id]/_components/CourseOverviewError.tsx" "app/(teacher)/courses/[id]/_components/EmptyCourseDashboard.tsx" "app/(teacher)/courses/[id]/_components/CourseStructureWorkspace.tsx" "app/actions/chapter.ts" "app/actions/topic.ts"` - passed.
  - `npm.cmd run lint -- "app/actions/course.ts"` - passed.
  - `git diff --check` - passed with line-ending warnings only.

### PR A2: Move canonical teacher route to `/teacher/courses`

- Trạng thái: Automated checks passed.
- Planned:
  - Move/rename route namespace.
  - Update helper base path.
  - Update header/navigation/breadcrumbs/back links.
  - Update revalidation paths.
  - Update imports affected by route path changes.
- In progress:
  - Không còn.
- Done:
  - Moved physical route namespace from `app/(teacher)/courses` to `app/(teacher)/teacher/courses`.
  - Updated teacher authoring browser helper base from `/courses` to `/teacher/courses`.
  - Updated internal route-file revalidation helper from `/(teacher)/courses` to `/(teacher)/teacher/courses`.
  - Updated focused imports and tests for the new physical route path and browser URLs.
- Blocked:
  - Không có blocker đã biết.
- Notes:
  - No public catalog yet.
  - No legacy redirects for old teacher `/courses` routes.
  - No duplicate teacher UI.
- Verification target:
  - TypeScript.
  - Focused route/component/action tests.
  - Manual QA for teacher course list/create/overview/structure/topic builder.
- Verification latest:
  - `npm.cmd run test:run -- __tests__/components/course-workspace-routes.test.tsx __tests__/components/course-authoring-trust.test.tsx __tests__/actions/course-structure.test.ts __tests__/utils/course-readiness.test.ts __tests__/schemas/course-readiness.test.ts` - passed, 5 files / 105 tests.
  - `npm.cmd run typecheck --if-present` - passed; no typecheck script output was emitted.
  - `npm.cmd run lint -- "app/(teacher)/teacher/courses" "lib/course-authoring/routes.ts" "lib/course-authoring/issue-guidance.ts" "__tests__/components/course-workspace-routes.test.tsx" "__tests__/components/course-authoring-trust.test.tsx" "__tests__/components/question-group-media-field.test.tsx" "__tests__/actions/course-structure.test.ts" "__tests__/utils/course-readiness.test.ts" "__tests__/schemas/course-readiness.test.ts"` - passed with existing warnings only.
  - `git diff --check` - passed with line-ending warnings only.

### PR A3: Teacher route tests and proxy hardening

- Trạng thái: Manual QA đã đạt.
- Planned:
  - Update tests to assert `/teacher/courses`.
  - Verify unauthenticated `/teacher/*` goes through `proxy.ts`.
  - Confirm Server Actions/RLS remain real data protection.
  - Clean stale teacher `/courses` references.
- In progress:
  - Không còn.
- Done:
  - Added focused `proxy.ts` wiring coverage.
  - Added direct `updateSession` coverage for unauthenticated `/teacher`, `/teacher/courses`, `/teacher/courses/new`, and `/teacher/courses/[id]`.
  - Hardened teacher route matching so only `/teacher` and `/teacher/...` are treated as teacher namespace routes.
  - Covered lookalike/non-teacher paths such as `/teacherish` and old `/courses/*` so they do not become teacher redirects.
  - Removed the stale login redirect comment that suggested `/teacher/courses` as an alternate post-login destination.
- Blocked:
  - Không có blocker đã biết.
- Notes:
  - Do not report middleware missing just because the project uses `proxy.ts`.
  - No public `/courses` catalog/detail.
  - No legacy redirects for old teacher `/courses` routes.
  - Server Actions/RLS remain the real data protection layer.
- Verification latest:
  - `npm.cmd run test:run -- __tests__/proxy.test.ts __tests__/utils/supabase-middleware.test.ts` - passed, 2 files / 8 tests.
  - `npm.cmd run test:run -- __tests__/components/course-workspace-routes.test.tsx __tests__/components/course-authoring-trust.test.tsx __tests__/actions/course-structure.test.ts __tests__/utils/course-readiness.test.ts __tests__/schemas/course-readiness.test.ts` - passed, 5 files / 105 tests.
  - `npm.cmd run lint -- proxy.ts utils/supabase/middleware.ts __tests__/utils/supabase-middleware.test.ts __tests__/proxy.test.ts` - passed.
  - `git diff --check` - passed with line-ending warnings only.
- Manual QA latest:
  - Unauthenticated `/teacher/courses` redirects to `/login` - passed.
  - Unauthenticated `/teacher/courses/new` redirects to `/login` - passed.
  - Unauthenticated `/teacher/courses/<id>` redirects to `/login` - passed.
  - `/teacherish` is not treated as teacher route - passed.
  - Teacher/admin navigation still points to `/teacher/courses` - passed.
  - Old `/courses/*` does not redirect to teacher authoring - passed.
  - UX follow-up recorded in `problems.md`: redirect has no visible explanation/toast.

## Wave B: Public catalog/detail and student dashboard

### PR B1: Public catalog and course detail

- Trạng thái: Planning hoàn tất; chưa triển khai.
- Kế hoạch chi tiết:
  - [pr-b1-public-catalog-detail-plan.md](./pr-b1-public-catalog-detail-plan.md).
- Base/branch:
  - Base: `main@f536b578879ea11b131a0b6d66bb032868fcb150`.
  - Branch: `feat/public-course-catalog-detail`.
- Planned:
  - Create public `/courses`.
  - Create public `/courses/[course-slug]`.
  - Homepage shows at most four courses by valid enrollment count with paid/free
    quota, fallback fill and deterministic tie-break.
  - Expose guest-safe syllabus metadata without protected content.
  - Keep first-topic preview as temporary compatibility metadata.
  - Fix payment cancel transition to canonical slug route.
  - Reconcile Wave A documentation in an isolated checkpoint.
  - Public course cards point to `/courses/[course-slug]`.
- In progress:
  - Chưa có.
- Done:
  - Chưa có.
- Blocked:
  - Không có blocker đã biết tại thời điểm hoàn tất planning.
- Notes:
  - Old public `/learn/[course-slug]` remains temporarily.
  - Không thêm `is_featured`, enrollment-status rule hoặc final preview management.
- Verification target:
  - Public catalog/detail action/component tests.
  - Manual QA for guest navigation.

### PR B2: Student `/learn` dashboard

- Trạng thái: Chưa bắt đầu.
- Planned:
  - Replace placeholder `/learn`.
  - Show enrolled courses.
  - Show continue learning and next topic.
  - Show course progress.
  - Show due flashcards summary.
  - Show pending payment reminder if any.
  - Move dashboard responsibility away from `/profile`.
- In progress:
  - Chưa có.
- Done:
  - Chưa có.
- Blocked:
  - Chờ PR B1.
- Notes:
  - Dashboard reminder leads to course detail, not direct payment modal.
  - Dismiss uses `sessionStorage` keyed by `paymentId`.
- Verification target:
  - Data-state tests for empty/enrolled/pending payment.
  - Manual QA for student dashboard states.

### PR B3: Redirect old public `/learn/[course-slug]`

- Trạng thái: Chưa bắt đầu.
- Planned:
  - Redirect old public detail to `/courses/[course-slug]`.
  - Keep learning workspace route `/learn/[course-slug]/[topic-slug]`.
- In progress:
  - Chưa có.
- Done:
  - Chưa có.
- Blocked:
  - Chờ PR B2.
- Notes:
  - Does not wait for memory check or completion hardening.
- Verification target:
  - Route tests/manual QA for redirect and workspace path.

## Wave C: Enrolled learning routes and workspace hardening

### PR C1: Enrolled course overview

- Trạng thái: Chưa bắt đầu.
- Planned:
  - `/learn/[course-slug]` shows course progress.
  - Shows completed/incomplete topics.
  - Shows next topic.
  - Main CTA `Tiếp tục học`.
  - No auto redirect.
- In progress:
  - Chưa có.
- Done:
  - Chưa có.
- Blocked:
  - Chờ Wave B stable.
- Notes:
  - Public detail must already be canonical at `/courses/[course-slug]`.
- Verification target:
  - Enrolled/unenrolled/invalid/empty states.

### PR C2: Workspace route hardening

- Trạng thái: Chưa bắt đầu.
- Planned:
  - Workspace uses actual topic slug from URL.
  - Sidebar syncs with URL.
  - Invalid/locked/unenrolled states are clear.
  - Prepare for memory check and server-side completion later.
- In progress:
  - Chưa có.
- Done:
  - Chưa có.
- Blocked:
  - Chờ PR C1.
- Notes:
  - Do not implement memory check in C2 unless a separate approved contract exists.
- Verification target:
  - Direct topic URL opens correct topic.
  - Sidebar route/state sync.
  - Refresh/back behavior.

## Wave D: Later backlog

- Trạng thái: Deferred.
- Items:
  - Topic publish validation.
  - Preview topic contract.
  - Memory check design/implementation.
  - Future question-category analytics compatibility.
  - Topic completion server truth.
  - FSRS review route or deeper review UX.
  - Google OAuth or hide fake CTA.
  - Profile cleanup and polish.
  - Deeper payment history/dashboard if needed.
- Notes:
  - Each item needs its own implementation audit before coding.
  - Do not pull these into Wave A route migration.

## Quy tắc cập nhật

1. Chỉ cập nhật summary row và section của PR đang active.
2. Ghi exact commands và actual outcomes.
3. Ghi manual QA tách biệt với automated checks.
4. Ghi rủi ro dài vào [problems.md](./problems.md).
5. Không đổi finalized decisions nếu chưa có explicit amendment.
6. Sau khi merge, ghi PR reference hoặc merge commit nếu có.
7. Giữ timestamp dạng `YYYY-MM-DD`.
8. Không dùng tracker này thay cho commit history hoặc PR description.
