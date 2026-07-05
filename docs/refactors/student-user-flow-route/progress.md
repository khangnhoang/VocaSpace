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
| PR A1: Prepare route helpers and docs | Chưa bắt đầu | Docs branch merged | Chưa có | 2026-07-05 | Centralize route helper, giữ behavior nếu có thể. |
| PR A2: Move canonical teacher route | Chưa bắt đầu | PR A1 | Chưa có | 2026-07-05 | Hard cut sang `/teacher/courses`, không legacy redirect. |
| PR A3: Teacher route tests and proxy hardening | Chưa bắt đầu | PR A2 | Chưa có | 2026-07-05 | Clean stale `/courses` teacher refs. |
| Wave B: Public catalog/detail and student dashboard | Chưa bắt đầu | Wave A stable | Chưa có | 2026-07-05 | Không bắt đầu trước khi `/courses` được giải phóng. |
| PR B1: Public catalog and detail | Chưa bắt đầu | PR A3 | Chưa có | 2026-07-05 | Create `/courses` and `/courses/[course-slug]`. |
| PR B2: Student `/learn` dashboard | Chưa bắt đầu | PR B1 | Chưa có | 2026-07-05 | Enrolled courses, continue learning, progress, pending payment summary. |
| PR B3: Redirect old public detail | Chưa bắt đầu | PR B2 | Chưa có | 2026-07-05 | Redirect `/learn/[course-slug]` to `/courses/[course-slug]`. |
| Wave C: Enrolled learning routes and workspace hardening | Chưa bắt đầu | Wave B stable | Chưa có | 2026-07-05 | Course overview and URL-synced workspace. |
| PR C1: Enrolled course overview | Chưa bắt đầu | PR B3 | Chưa có | 2026-07-05 | `/learn/[course-slug]` no auto redirect. |
| PR C2: Workspace route hardening | Chưa bắt đầu | PR C1 | Chưa có | 2026-07-05 | Use actual `[topic-slug]`; clear invalid/locked/unenrolled states. |
| Wave D: Later backlog | Deferred | Stable route/dashboard/workspace contracts | Chưa có | 2026-07-05 | Topic publish, preview, memory check, completion truth, OAuth, deeper review/payment. |

## Wave A: Teacher route hard cut

### PR A1: Prepare route helpers and docs

- Trạng thái: Chưa bắt đầu.
- Planned:
  - Centralize teacher authoring route helpers around `lib/course-authoring/routes.ts`.
  - Update route contract docs if implementation discovers additional helper boundaries.
  - Keep existing behavior if possible.
- In progress:
  - Chưa có.
- Done:
  - Documentation plan created.
- Blocked:
  - Không có blocker đã biết.
- Notes:
  - Do not move physical route files in A1.
  - Do not create public catalog in A1.
- Verification target:
  - Focused helper tests if helpers change.
  - `git diff --check`.

### PR A2: Move canonical teacher route to `/teacher/courses`

- Trạng thái: Chưa bắt đầu.
- Planned:
  - Move/rename route namespace.
  - Update helper base path.
  - Update header/navigation/breadcrumbs/back links.
  - Update revalidation paths.
  - Update imports affected by route path changes.
- In progress:
  - Chưa có.
- Done:
  - Chưa có.
- Blocked:
  - Chờ PR A1.
- Notes:
  - No public catalog yet.
  - No legacy redirects for old teacher `/courses` routes.
  - No duplicate teacher UI.
- Verification target:
  - TypeScript.
  - Focused route/component/action tests.
  - Manual QA for teacher course list/create/overview/structure/topic builder.

### PR A3: Teacher route tests and proxy hardening

- Trạng thái: Chưa bắt đầu.
- Planned:
  - Update tests to assert `/teacher/courses`.
  - Verify unauthenticated `/teacher/*` goes through `proxy.ts`.
  - Confirm Server Actions/RLS remain real data protection.
  - Clean stale teacher `/courses` references.
- In progress:
  - Chưa có.
- Done:
  - Chưa có.
- Blocked:
  - Chờ PR A2.
- Notes:
  - Do not report middleware missing just because the project uses `proxy.ts`.
- Verification target:
  - Focused route/proxy checks.
  - Relevant tests updated from `/courses` to `/teacher/courses`.

## Wave B: Public catalog/detail and student dashboard

### PR B1: Public catalog and course detail

- Trạng thái: Chưa bắt đầu.
- Planned:
  - Create public `/courses`.
  - Create public `/courses/[course-slug]`.
  - Homepage shows featured/highlighted courses only.
  - Public course cards point to `/courses/[course-slug]`.
- In progress:
  - Chưa có.
- Done:
  - Chưa có.
- Blocked:
  - Chờ Wave A stable.
- Notes:
  - Old public `/learn/[course-slug]` remains temporarily.
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
