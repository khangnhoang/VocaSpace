# Theo dõi tiến độ tái cấu trúc luồng student/user và route

## Tài liệu liên quan

Nguồn plan chính thức: [plan.md](./plan.md).

Nhật ký vấn đề, rủi ro và follow-up chi tiết: [problems.md](./problems.md).

ADR quyết định: [refactor-student-user-flow-route-adr.md](../../adr/refactor-student-user-flow-route-adr.md).

Chỉ mục implementation plan và quy tắc ownership: [implementation-plans/README.md](./implementation-plans/README.md).

Bảng [Tổng quan tiến độ](#tổng-quan-tiến-độ) là trạng thái workflow hiện được ghi nhận trong tài liệu, không thay thế repository evidence. Các section chi tiết bên dưới giữ evidence theo thời điểm và có thể chứa wording trước merge; luôn đọc status line cùng historical note của từng PR trước khi xem evidence cũ.

## Chú giải trạng thái

- Chưa bắt đầu
- Đang thực hiện
- Đã triển khai
- Automated checks đã đạt
- Chờ manual QA
- Manual QA đã đạt
- Sẵn sàng review
- Đã merge/hoàn tất
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
| Wave A: Teacher route hard cut | Đã hoàn tất | Documentation plan | PR #42–#44, merged to `main` | 2026-07-11 | Teacher authoring ở `/teacher/courses`; public `/courses` đã được giải phóng. |
| PR A1: Prepare route helpers and docs | Đã merge/hoàn tất | Docs branch merged | PR #42, merge `d800d648` | 2026-07-08 | Helper centralization commit `cce28c9`; giữ behavior cũ trước hard cut. |
| PR A2: Move canonical teacher route | Đã merge/hoàn tất | PR A1 | PR #43, merge `59680afb` | 2026-07-08 | Implementation `701054b`; hard cut sang `/teacher/courses`, không legacy redirect. |
| PR A3: Teacher route tests and proxy hardening | Đã merge/hoàn tất; manual QA đạt | PR A2 | PR #44, merge `6a639d5e` | 2026-07-09 | Segment-aware guard, negative boundary tests và manual route QA. |
| Wave B: Public catalog/detail and student dashboard | Đã merge/hoàn tất | Wave A stable | PR #46, #48 và #74 merged; B3 merge `59d0810` | 2026-08-18 | B1/B2/B3 đã merge; public detail, student dashboard và temporary legacy bridge đều ổn định cho C1. |
| PR B1: Public catalog and detail | Đã merge/hoàn tất | PR A3 | PR #46, merge `079ad46` | 2026-07-12 | B1.1–B1.7 complete; merged to `main`. |
| PR B2: Student `/learn` dashboard | Đã merge/hoàn tất | PR B1 | PR #48, merge `00bdadab` | 2026-07-13 | Phần triển khai, automated gates và manual QA theo kế hoạch đã hoàn tất. |
| PR B3: Redirect public detail cũ | Đã merge/hoàn tất | PR B2 đã merge | PR #74; merge `59d0810`; CP1 `1bfd875`; CP2 `f0cc59b` | 2026-08-18 | Exact-page redirect, invalid not-found và nested-route preservation đã đạt; 404 UI gap tiếp tục ở `STUDENT-005`. |
| Wave C: Enrolled learning routes and workspace hardening | Đang triển khai | Wave B stable | C1 PR #75 merged; C2 `feat/workspace-route-hardening` | 2026-08-19 | C1 đã merge; C2 planning hoàn tất, implementation chưa bắt đầu. |
| PR C1: Enrolled course overview | Đã merge/hoàn tất | PR B3 đã merge | PR #75, merge `3cb7a9f`; branch head `44ee6b9`; CP1 `bff4f9f`; CP2 `bb7fa36`; CP3 `f1234f2`; correction `4eca503` | 2026-08-19 | Exact overview/access states đạt; B2 semantics giữ nguyên; không DB change trong C1. |
| PR C2: Workspace route hardening | Planning hoàn tất; chờ owner duyệt; implementation chưa bắt đầu | PR C1 đã merge | `feat/workspace-route-hardening`, base `3cb7a9f` | 2026-08-19 | Detailed plan/brief đã reconcile URL ownership, direct/history behavior, access states và progress-write boundary. |
| Wave D: Later backlog | Deferred | Stable route/dashboard/workspace contracts | Chưa có | 2026-07-05 | Topic publish, preview, memory check, completion truth, OAuth, deeper review/payment. |

## Wave A: Teacher route hard cut

- Merge evidence verified 2026-07-11: GitHub PR #42, #43 và #44 đều `MERGED` vào
  `main`; merge commits lần lượt là `d800d648`, `59680afb`, `6a639d5e`. GitHub check
  rollups ghi `Test and Build`, `production-gate` và Vercel success cho cả ba PR.

### PR A1: Prepare route helpers and docs

- Trạng thái: Đã merge/hoàn tất qua PR #42 (`d800d648`), implementation `cce28c9`.
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

- Trạng thái: Đã merge/hoàn tất qua PR #43 (`59680afb`), implementation `701054b`.
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

- Trạng thái: Đã merge/hoàn tất qua PR #44 (`6a639d5e`); automated và manual QA đã đạt.
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

- Trạng thái: Đã merge/hoàn tất qua PR #46 (`079ad46`) ngày 2026-07-12.
- Kế hoạch chi tiết:
  - [pr-b1-public-catalog-detail-plan.md](./pr-b1-public-catalog-detail-plan.md).
- Base/branch:
  - Base: `main@f536b578879ea11b131a0b6d66bb032868fcb150`.
  - Branch: `feat/public-course-catalog-detail`.
- Lưu ý lịch sử: Các mục evidence, gap và blocker bên dưới phản ánh checkpoint trước merge; chúng không phải current blockers của PR B1.
- Phạm vi đã lên kế hoạch:
  - Create public `/courses`.
  - Create public `/courses/[course-slug]`.
  - Homepage shows at most four courses by valid enrollment count with paid/free
    quota, fallback fill and deterministic tie-break.
  - Expose guest-safe syllabus metadata without protected content.
  - Keep first-topic preview as temporary compatibility metadata.
  - Fix payment cancel transition to canonical slug route.
  - Reconcile Wave A documentation in an isolated checkpoint.
  - Public course cards point to `/courses/[course-slug]`.
- Evidence và gap trước merge:
  - B1.3 retry-button error-state manual QA còn pending; homepage và `/courses`
    desktop/mobile layout smoke QA đã đạt theo evidence được cung cấp ngày 2026-07-11.
  - B1.4 manual QA đã xác nhận free enrollment row được tạo và enrollment overlay
    cập nhật đúng; đồng thời phát hiện modal không đóng và vẫn dùng payment/coupon copy.
  - B1.4 free-modal correction manual retest đã đạt: modal đóng sau đăng ký thành công
    và copy/UI miễn phí hiển thị đúng; close-button visual retest cũng đã đạt, không còn
    pill dọc. Guest detail desktop/mobile đầy đủ, signed-in/enrolled và paid-flow manual
    QA khác vẫn chưa hoàn tất.
  - B1.5 PayOS sandbox/manual cancellation QA chưa chạy vì task không xác nhận sẵn
    credential/môi trường sandbox; automated contract đã đạt.
  - B1.7 final release gate ngày 2026-07-11 đã chạy full test, TypeScript, targeted lint,
    production build, local integration và guest browser/E2E matrix. Heading hierarchy
    đã được sửa; repository-wide lint baseline được tách thành `QUALITY-001` vì toàn bộ
    finding nằm ngoài B1 diff. Signed-in/enrolled, retry-error fixture và PayOS sandbox
    QA chưa chạy.
- Đã hoàn tất:
  - B1.1: thêm public catalog/detail RPC với metadata whitelist, explicit grants,
    stable ordering và giữ nguyên direct-table RLS cho syllabus/content/enrollment.
  - B1.1: thêm index `idx_enrollments_course_id` cho aggregate theo course.
  - B1.2: thêm strict Zod RPC/DTO boundary, public catalog/detail actions, canonical
    route helpers, temporary first-topic preview mapping và pure homepage selector.
  - B1.3: thêm `/courses`, homepage top-four, shared public course card/grid,
    loading/empty/error states và xóa `PublicCourseList`/`getPublishedCourses` cũ.
  - B1.3 corrections: card title dùng contextual `h3` trên homepage và `h2` trong
    catalog; recoverable error dùng retry refresh với pending/disabled state, còn
    empty state giữ navigation link.
  - B1.4: thêm canonical `/courses/[course-slug]` với request-scoped detail read,
    safe metadata/canonical path, loading và exact success/not-found/error mapping.
  - B1.4: canonical và legacy `/learn/[course-slug]` dùng chung public detail renderer;
    public stats chỉ có chapter/topic/enrollment, instructor DTO public-safe, syllabus
    presentation-only và temporary preview không mở content/workspace link.
  - B1.4 cleanup: xóa old `getCourseDetail`, legacy course-detail schema/test và các
    duplicate legacy detail components sau khi production caller audit về 0; payment
    presentation được chuyển sang canonical public-course ownership, B1.5 cancel URL
    chưa thay đổi.
  - B1.4 manual-QA correction: free course dùng confirmation-only modal, chặn submit
    lặp, đóng/xóa stale state trước refresh/first-topic navigation; paid flow giữ
    coupon/PayOS presentation và close control dùng shadcn icon button.
  - B1.4 review correction: CTA đứng trước các section dài trong mobile document order;
    paid modal stage không hoạt động bị loại khỏi accessibility/focus tree; local-IP
    image optimization chỉ bật bằng explicit server-side opt-in cho QA Supabase local.
  - B1.5: PayOS `cancelUrl` chuyển từ `/learn/${courseId}` sang canonical absolute
    `/courses/[course-slug]`; slug được resolve từ trusted published/non-removed course
    row, client không thể cung cấp redirect, và success `returnUrl` giữ nguyên.
  - B1.6: đối soát Wave A PR #42–#44 là merged vào `main`; đóng `ROUTE-001`,
    `ROUTE-002`, `AUTH-001` bằng route/helper/proxy/test evidence; giữ `AUTH-003` deferred
    và đồng bộ checkpoint B1.1–B1.5 với commit/verification đã ghi.
  - `npx.cmd supabase db reset --local` - passed ngày 2026-07-11.
  - `npm.cmd run test:integration -- __tests__/integration/public-course-read-model.test.ts`
    - passed, 1 file / 10 tests.
  - `npm.cmd run test:run -- __tests__/schemas/public-course.test.ts __tests__/utils/public-course-routes.test.ts __tests__/utils/public-course-selector.test.ts __tests__/actions/public-course.test.ts`
    - passed; B1.2 hiện có 39 focused tests sau correction coverage.
  - Targeted ESLint cho 8 file TypeScript B1.2 - passed.
  - Focused B1.3/B1.2 regression command ngày 2026-07-11
    - passed sau corrections, 6 files / 56 tests; riêng B1.3 là 1 file / 8 tests.
  - Targeted ESLint cho 7 file TypeScript/TSX thuộc B1.3 corrections - passed.
  - Focused B1.4/B1.3/action/schema/route/workspace regression command ngày 2026-07-11
    - passed sau free-modal correction, 6 files / 98 tests; riêng B1.4 là 1 file / 16 tests.
  - Targeted ESLint cho 13 file TypeScript/TSX thuộc B1.4 - passed.
  - Focused B1.4/B1.3/action/schema/route/workspace regression rerun sau review
    corrections ngày 2026-07-11 - passed, 6 files / 100 tests; riêng B1.4 là
    1 file / 18 tests.
  - Targeted ESLint cho 4 file TypeScript/TSX/config thuộc B1.4 review corrections
    - passed.
  - Focused regression rerun sau khi đồng bộ loading document order ngày 2026-07-11
    - passed, 6 files / 100 tests; targeted ESLint cho loading/test correction - passed.
  - `npx.cmd tsc --noEmit --incremental false` sau B1.4 final corrections và clean
    generated `.next` cache - passed trước commit `765a9b2`.
  - Focused B1.5 payment/route/detail regression command ngày 2026-07-11
    - passed, 3 files / 31 tests; payment action riêng 1 file / 10 tests.
  - `npx.cmd tsc --noEmit --incremental false` sau B1.5 - passed.
  - Targeted ESLint cho 3 file TypeScript/TSX thay đổi trong B1.5 - passed.
  - `git diff --check` sau B1.5 - passed.
  - B1.6 documentation audit ngày 2026-07-11: PR #42–#44 GitHub merge/check metadata,
    cited commit objects, current route/helper/proxy/test evidence và relative links đã
    được kiểm tra; stale-status search và `git diff --check` passed.
  - Public-course integration rerun trên local Supabase ngày 2026-07-11
    - passed, 1 file / 10 tests; lần chạy sandbox đầu tiên có 8/10 pass và 2 metadata
      query bị `EPERM` khi Supabase CLI ghi telemetry, rerun ngoài sandbox đã pass 10/10.
  - Local metadata audit xác nhận hai RPC là `STABLE SECURITY DEFINER`,
    `search_path = ''`, chỉ grant `anon`/`authenticated`/`service_role`, và index có
    leading column `course_id`.
  - B1.7 `npm.cmd run test:run` - passed, 30 files / 315 tests / 0 failures;
    `npx.cmd tsc --noEmit --incremental false` - passed.
  - B1.7 `npm.cmd run build` - passed ngoài sandbox sau khi lần chạy sandbox bị chặn
    network khi tải Google Fonts; compile, type-check và generate 17/17 static pages đạt.
  - B1.7 local Supabase reset - passed; `npm.cmd run test:integration` với gate local
    - passed, 9 files / 65 tests / 0 failures. Public read-model matrix tiếp tục đạt 10/10.
  - B1.7 guest browser QA - homepage/catalog/canonical detail/legacy adapter/unknown-slug,
    mobile overflow, mobile CTA/loading order và free-modal presentation đã đạt trên local
    fixtures. Legacy detail giữ URL `/learn/[course-slug]` và không sinh canonical cạnh tranh.
  - B1.7 heading correction: shared header brand và mobile account name không còn là
    heading; mobile sheet có accessible title; homepage giữ đúng một primary hero `<h1>`.
    Focused hierarchy/catalog/detail regression - passed, 3 files / 28 tests.
  - B1.7 final `npm.cmd run test:run` - passed, 31 files / 317 tests / 0 failures;
    targeted ESLint cho 4 TypeScript/TSX/test files - passed; final TypeScript - passed.
  - B1.7 public guest-discovery Playwright smoke - passed, 1 spec / 1 test. Test xác minh
    homepage có tối đa bốn highlighted cards, canonical detail/public preview boundary,
    catalog, public 404, mobile heading contract và legacy route không redirect.
  - B1.7 final production build - passed ngoài sandbox để tải Google Fonts; compile,
    type-check và generate 17/17 static pages đạt. `git diff --check` - passed.
- Trở ngại tại checkpoint trước merge:
  - Không còn B1-scoped Critical/Required finding. Repository-wide `npm.cmd run lint`
    baseline vẫn có 13 errors và 12 warnings trong file ngoài B1 diff; được theo dõi riêng
    tại `QUALITY-001` và không được ghi nhận là full-lint pass.
- Ghi chú lịch sử:
  - Old public `/learn/[course-slug]` remains temporarily.
  - Không thêm `is_featured`, enrollment-status rule hoặc final preview management.
  - B1.4 correction không chạy full suite, full lint, production build, E2E hoặc
    browser automation; manual evidence đã xác nhận free enrollment backend/database,
    corrected free-modal UX và close-button visual. Guest detail desktop/mobile đầy đủ,
    signed-in/enrolled và paid flow vẫn pending.
  - B1.5 không chạy PayOS sandbox/manual cancellation QA; `PAYMENT-002` được đóng theo
    automated evidence, còn manual provider verification được ghi rõ là chưa chạy.
  - B1.7 E2E stability correction ngày 2026-07-12: runner tự reset đúng isolated local
    Supabase workdir sau loopback validation, nên mỗi run đều apply migration và seed sạch;
    public guest-discovery smoke chạy liên tiếp hai lần không reset thủ công và đều đạt 1/1.
    Smoke chờ canonical course link đầu tiên visible trước khi đọc số lượng Suspense grid;
    targeted lint cho runner/spec và `git diff --check` đều đạt.
  - Catalog recoverable-error retry manual QA, signed-in unenrolled/enrolled matrix và
    paid-flow browser QA chưa chạy vì không có stable local fixture/session tương ứng.
  - PayOS sandbox cancellation QA: not run.
  - Tại checkpoint trước khi tạo PR, CI chưa chạy và tài liệu không suy diễn PayOS sandbox hoặc các manual scenario còn thiếu là passed. PR #46 sau đó đã merge; current status nằm ở đầu section.
- Mục tiêu xác minh tại thời điểm B1:
  - Public catalog/detail action/component tests.
  - Manual QA for guest navigation.

### PR B2: Student `/learn` dashboard

- Trạng thái: Đã merge/hoàn tất qua PR #48 (`00bdadab`) ngày 2026-07-13.
- Implementation branch (historical): `feat/student-learn-dashboard`.
- Branch base (historical): `origin/main @ c70ed20` (post-PR #47, includes B1 merge).
- Kế hoạch chi tiết: [plans/b2-student-learn-dashboard.md](./plans/b2-student-learn-dashboard.md).
- Tài liệu deferred features: [future-features.md](./future-features.md).
- Phạm vi đã lên kế hoạch:
  - Replace placeholder `/learn`.
  - Show enrolled courses.
  - Show continue learning and next topic.
  - Show course progress.
  - Show due flashcards summary.
  - Show pending payment reminder if any.
  - Move dashboard responsibility away from `/profile`.
  - Minimal workspace initial-topic route support.
- Triển khai:
  - Không còn công việc B2 đang mở.
- Đã hoàn tất:
  - Dashboard contract/action dùng strict Zod DTO, authenticated grouped reads và không N+1.
  - Course visibility chỉ gồm enrollment của user trên course `published` chưa soft-delete.
  - Eligible topic chỉ gồm topic `published` chưa soft-delete trong chapter chưa soft-delete;
    progress, next topic và last topic dùng đúng full course order.
  - `/learn` có review summary, payment reminders, course progress/CTA, loading/error/empty
    states và responsive presentation; không thêm unpublished collaborator tab.
  - Active payment dùng `creating`/`pending`, newest-first, mặc định tối đa ba item, có view-all,
    dismiss độc lập theo `paymentId` trong `sessionStorage`, và tiếp tục qua `/courses/[slug]`.
  - Workspace nhận initial route topic slug, fallback an toàn nếu invalid/empty, không mở rộng
    sang full C2 URL synchronization.
  - `/profile` trở về account responsibility; review entry/component được chuyển hẹp sang
    `/learn`; authenticated desktop/mobile navigation có entry `/learn`.
  - Branch checkpoints: `f491873`, `05e2355`, `f3ca302`, `5155c55`, `951c030`, `86d1035`, `164d70d`, `fa8179f`, `9790b65`, `aa506da`, `9541e23`, `0d2ba92`.
  - PR #48 merged toàn bộ B2 vào `main` bằng merge commit `00bdadab`.
  - Focused dashboard/workspace/profile/header tests: passed.
  - `npm run test:run`: passed, 36 files / 347 tests sau final review corrections.
  - `npm run test:integration`: passed ngoài sandbox, 9 files / 65 tests; sandbox run trước đó
    chỉ fail vì Supabase CLI không ghi được telemetry dưới user profile.
  - `npx tsc --noEmit --incremental false`: passed.
  - Targeted ESLint cho toàn bộ TypeScript/TSX thay đổi: passed.
  - `npm run build`: passed ngoài sandbox; sandbox run trước đó chỉ fail do không fetch được
    Google Fonts hiện hữu.
  - Authenticated browser smoke QA: `/learn` empty state, `/profile` cleanup, header menu link,
    unauthenticated `/learn` redirect và browser console đều đạt.
  - Final independent review correction: paginate/chunk toàn bộ dashboard reads, bổ sung
    query-error/invalid-output/ordering regression tests, đóng mobile Sheet khi điều hướng và
    dùng accessible Dialog primitive cho review flow.
  - Canonical local seed bổ sung 3 learner-course state, 3 excluded enrollment state,
    3 flashcard state, 4 active payment và 1 inactive payment với ID/timestamp deterministic;
    `npx.cmd supabase db reset --local` đã apply toàn bộ migration và seed thành công.
  - Read-only local SQL fixture audit: in-progress 2/4 với next
    `b2-qa-progress-topic-2`; completed 3/3 với final
    `b2-qa-completed-final-topic`; no-content 0 eligible topic; flashcard 3 total/2 due/2
    learning/1 future; payment active đúng 4 và newest-first, row `paid` bị loại.
  - Authenticated browser QA với seeded learner: đúng 3 course hiển thị; draft/pending/removed
    bị ẩn; next/final CTA mở đúng topic; no-content không có CTA; review dialog có queue 2 card;
    default payment 3 item, view-all 4 item, dismiss độc lập và phục hồi sau reload cùng session;
    canonical payment link mở `/courses/b2-qa-payment-3`.
  - Browser viewport thật 375 × 812: `window.innerWidth = 375`, mobile account navigation xuất
    hiện, không horizontal overflow và không có browser warning/error log.
  - Focused B2 dashboard tests sau seed: passed, 5 files / 30 tests.
  - `npm.cmd run test:integration` sau reseed: passed, 9 files / 65 tests.
- Trở ngại:
  - Không còn blocked bởi B1 (PR #46 đã merge).
- Ghi chú:
  - Dashboard reminder leads to course detail, not direct payment modal.
  - Dismiss uses `sessionStorage` keyed by `paymentId`.
  - Chapter table không có `status` field; "chapter published" = `removed_at IS NULL`.
  - Column completion thực tế trong schema là `is_topic_completed`; implementation dùng tên
    cột này thay cho shorthand `topic_completed` trong yêu cầu handoff.
  - Không có migration, RLS/policy, RPC, function, trigger hoặc view change.
- Kết quả xác minh:
  - Automated data-state coverage đã đạt cho auth, visibility, progress/ordering, payments,
    review summary và initial-topic route seam.
  - Manual data-rich QA cho enrolled/progress/completed/no-content/pending-payment, review flow,
    session dismissal và viewport mobile thật đã đạt ngày 2026-07-13.

### PR B3: Redirect public detail cũ tại `/learn/[course-slug]`

- Trạng thái: Đã merge qua PR #74 tại `59d0810`; CP1/CP2 implementation, automated verification và manual QA đã hoàn tất trước merge. Không deploy trong workflow này.
- Kế hoạch chi tiết: [implementation-plans/b3/plan.md](./implementation-plans/b3/plan.md).
- Owner-review brief: [implementation-plans/b3/owner-review-brief.md](./implementation-plans/b3/owner-review-brief.md).
- Đã lên kế hoạch:
  - CP1: exact one-segment temporary redirect, invalid-slug handling và focused regression.
  - CP2: real route-tree smoke, nested workspace preservation, build gate và completion docs/audit.
- Triển khai: Hoàn tất trên branch; legacy exact page parse bằng `publicCourseSlugSchema.safeParse()`, invalid gọi `notFound()`, valid dùng temporary `redirect()` sang helper canonical.
- Đã hoàn tất:
  - CP1 commit `1bfd875`: route implementation và focused regression; `3` files / `39` tests passed, TypeScript/targeted lint/diff check đạt.
  - CP2: Playwright isolated local Supabase `2/2` scenario passed cho guest/authenticated redirect và deterministic nested route; production build đạt.
  - Smoke correction dựa trên failure evidence: dùng canonical href qua `page.goto()` thay hydration-sensitive client click và poll `window.location.pathname` cho streaming redirect observation.
  - Build trong sandbox ban đầu không tải được Google Fonts; cùng command rerun ngoài sandbox compiled, TypeScript và static generation thành công.
- Manual QA ngày 2026-08-17:
  - Legacy URL của course hiện có redirect đúng sang canonical `/courses/<slug>`.
  - Slug hợp lệ nhưng không tồn tại redirect sang canonical `/courses/<slug>` rồi đi vào trạng thái 404 hiện tại.
  - Invalid legacy slug `/learn/UPPERCASE` đi thẳng vào framework not-found boundary, không redirect và không runtime crash.
  - Nested learner route vẫn giữ nguyên, không bị exact one-segment redirect bắt nhầm.
  - Ứng dụng chưa có custom 404/not-found UI, nên trạng thái not-found có thể chỉ hiển thị header với vùng nội dung trống; invalid legacy slug cũng có thể giữ browser-tab title trước đó. Đây là UX gap `STUDENT-005`, không phải B3 failure.
- Trở ngại: Không còn blocker B3 đã biết; UX gap 404 là non-blocking follow-up `STUDENT-005` và không được kéo vào C1.
- Ghi chú: Không chờ memory check hoặc completion hardening; giữ `STUDENT-002` mở đến C1 và theo dõi 404 UX riêng ở `STUDENT-005`.
- Kết quả xác minh: focused route tests, TypeScript/lint, isolated local Supabase public-discovery smoke, nested workspace route, build, final diff audit và manual QA route matrix đều đạt.

## Wave C: Enrolled learning routes và workspace hardening

### PR C1: Enrolled course overview

- Trạng thái: Đã merge/hoàn tất qua PR #75 tại `3cb7a9f`; implementation branch head `44ee6b9` đã nằm trong `main`.
- Kế hoạch chi tiết: [implementation-plans/c1/plan.md](./implementation-plans/c1/plan.md).
- Owner-review brief: [implementation-plans/c1/owner-review-brief.md](./implementation-plans/c1/owner-review-brief.md).
- Triển khai:
  - CP1 `bff4f9f`: `getEnrolledCourseOverview`, strict result DTO, explicit auth/not-found/unenrolled/success/error classification, protected-read stop và narrow B2 progress/pagination reuse.
  - CP2 `bb7fa36`: thay B3 redirect bằng overview success states, persistent unenrolled/error surfaces, route-local loading và focused component/route regressions.
  - CP3 `f1234f2`: sửa `AuthSessionMissingError` thành `auth_required`, thêm seeded C1 smoke và trả public-discovery smoke về canonical public ownership.
- Behavior đạt:
  - In-progress giữ exact URL, hiện ordered completed/incomplete topics, percentage/count và CTA tới first incomplete topic.
  - Completed hiện 100% và CTA ôn final eligible topic; no-content không render progressbar/learning CTA giả.
  - Authenticated unenrolled ở same route, chỉ nhận public-safe identity; primary `/courses/[slug]`, secondary `/learn`, không expose protected syllabus/progress.
  - Invalid và nonexistent/non-visible dùng safe framework not-found; query/contract failures có recoverable retry state riêng; guest redirect `/login`.
- Verification:
  - Final full Vitest `39 files / 383 tests`; TypeScript, targeted lint và diff check đạt.
  - Isolated seeded C1 Playwright `3/3`; canonical public smoke `1/1`; nested initial-topic behavior đạt.
  - Production build đạt sau khi rerun ngoài sandbox để tải Google Fonts; không có code workaround.
  - Visual/manual QA đạt trên mobile `375x812` và desktop `1280x900` cho success/no-content/unenrolled, gồm wrapping, CTA hierarchy và no horizontal overflow.
- Trở ngại: Không còn blocker hoặc in-scope finding của C1; dependency C2 đã được thỏa mãn.
- Ghi chú: Không chạm C2 URL/sidebar, memory/final-completion truth, `STUDENT-005`, database/schema/RLS/RPC/seed, package hoặc shared primitives.

### PR C2: Workspace route hardening

- Trạng thái: Planning package hoàn tất trên `feat/workspace-route-hardening`; chờ owner duyệt; implementation chưa bắt đầu.
- Baseline: `origin/main @ 3cb7a9f9707e805c275bfced1c4e11b489727eb3`, là merge commit PR #75/C1.
- Kế hoạch chi tiết: [implementation-plans/c2/plan.md](./implementation-plans/c2/plan.md).
- Owner-review brief: [implementation-plans/c2/owner-review-brief.md](./implementation-plans/c2/owner-review-brief.md).
- Đã lên kế hoạch:
  - URL course/topic là source of truth; direct/refresh/sidebar/previous-next/back-forward dùng cùng contract.
  - Explicit auth/course/enrollment/exact-topic/access result states; invalid/unavailable không fallback.
  - Dedicated strict read DTO và narrow progress/review write guards để client topic state không thể chọn sai progress row.
  - Reuse C1/B2 eligible-content semantics; không thêm migration/RLS/seed theo current evidence.
- Triển khai: Chưa bắt đầu.
- Đã hoàn tất: P0 discovery và planning docs; chưa có application checkpoint.
- Trở ngại: Không còn dependency merge blocker; implementation permission vẫn chưa được cấp.
- Ghi chú: Không triển khai memory check, final completion truth, exercise correctness policy, preview contract, global 404 hoặc mobile navigation parity trong C2.
- Mục tiêu xác minh:
  - Direct topic URL mở đúng topic.
  - Sidebar đồng bộ route/state.
  - Behavior khi refresh/back.

## Wave D: Later backlog

- Trạng thái: Deferred.
- Hạng mục:
  - Validation khi publish topic.
  - Contract preview topic.
  - Thiết kế và triển khai memory check.
  - Khả năng tương thích với question-category analytics sau này.
  - Server truth cho topic completion.
  - Route FSRS review hoặc review UX sâu hơn.
  - Google OAuth hoặc ẩn CTA giả.
  - Profile cleanup và polish.
  - Payment history/dashboard sâu hơn nếu cần.
- Ghi chú:
  - Mỗi hạng mục cần implementation audit riêng trước khi coding.
  - Không kéo các hạng mục này vào Wave A route migration.

## Quy tắc cập nhật

1. Chỉ cập nhật summary row và section của PR đang active.
2. Ghi exact commands và actual outcomes.
3. Ghi manual QA tách biệt với automated checks.
4. Ghi rủi ro dài vào [problems.md](./problems.md).
5. Không đổi finalized decisions nếu chưa có explicit amendment.
6. Sau khi merge, ghi PR reference hoặc merge commit nếu có.
7. Giữ timestamp dạng `YYYY-MM-DD`.
8. Không dùng tracker này thay cho commit history hoặc PR description.
9. Sau khi merge, cập nhật summary row và status line đầu section; giữ evidence cũ dưới nhãn lịch sử thay vì để `In progress` hoặc `Blocked` trông như trạng thái hiện tại.
