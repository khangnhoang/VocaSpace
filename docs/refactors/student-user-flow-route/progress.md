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
- Đang chuẩn bị
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
| Wave C: Enrolled learning routes and workspace hardening | Đã merge/hoàn tất | Wave B stable | C1 PR #75; C2 PR #96, merge `3a95c310` | 2026-09-14 | C1/C2 đã merge; route/workspace gates đạt. |
| PR C1: Enrolled course overview | Đã merge/hoàn tất | PR B3 đã merge | PR #75, merge `3cb7a9f`; branch head `44ee6b9`; CP1 `bff4f9f`; CP2 `bb7fa36`; CP3 `f1234f2`; correction `4eca503` | 2026-08-19 | Exact overview/access states đạt; B2 semantics giữ nguyên; không DB change trong C1. |
| PR C2: Workspace route hardening | Đã merge/hoàn tất | PR C1 đã merge | PR #96; merge `3a95c310`; exact PR head `66e7f318`; implementation branch auto-deleted sau merge | 2026-09-14 | CI và local gates đạt; không DB/schema/RLS/RPC/seed change. |
| PR D1: Topic authoring → review → publication (`FUTURE-PUBLISH-001`) | Đã merge qua PR #98; v3 vẫn deferred, full M17–M28 manual matrix chưa được claim | C2 PR #96 đã merge | PR head `d93385a`, merge `861e7c7`; canonical [plan.md](./implementation-plans/d1/plan.md) + [v4-implementation-reconciliation.md](./implementation-plans/d1/v4-implementation-reconciliation.md) | 2026-09-23 | D1 foundation, authorship, v2/v4 và follow-up đã vào `main`. Focused `43/43`, integration `19/19`, TypeScript, targeted ESLint và `git diff --check` là evidence trước merge; Owner đã kiểm thủ công đúng hai regression. Không suy ra deploy, remote DB mutation hoặc full manual QA. |
| Wave D: Topic/Preview và các workstream tiếp theo | D1 đã merge; Q7 đã rollout production; D2 hoàn tất cục bộ và final independent review `PASS`; D3 là candidate kế tiếp | Stable route/dashboard/workspace contracts | D1 PR #98; Q7 PR #101, merge `65e8481`; D2 local branch `feat/student-flow-d2-public-preview` @ `39feb3a`; working execution order trong [plan.md](./plan.md) | 2026-09-25 | D2 chưa push/PR/merge/deploy; preflight inventory môi trường đích còn là rollout gate. D3 chưa có detail plan/implementation authority từ mốc D2; D6–D9 deferred/open về detailed acceptance. |

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

- Trạng thái: Đã merge/hoàn tất qua PR #96 tại `3a95c310`; exact PR head `66e7f318`. Các bullet checkpoint bên dưới là lịch sử evidence trước delivery.
- Baseline hiện tại: `origin/main @ 3a95c3109b74fc8452625ce1a40ce420179d565c`; C2 historical baseline là `origin/main @ 3cb7a9f9707e805c275bfced1c4e11b489727eb3`, merge commit PR #75/C1.
- Kế hoạch chi tiết: [implementation-plans/c2/plan.md](./implementation-plans/c2/plan.md).
- Owner-review brief: [implementation-plans/c2/owner-review-brief.md](./implementation-plans/c2/owner-review-brief.md).
- Contract đã áp dụng:
  - URL course/topic là source of truth; direct/refresh/sidebar/previous-next/back-forward dùng cùng contract.
  - Explicit parent-before-child auth/course/enrollment/exact-topic/access precedence; invalid/unavailable không fallback hoặc leak child state cho unenrolled.
  - Dedicated strict read DTO, bounded/parallel protected reads và narrow progress/question/review guards; question/card actions không thêm sequential authorization waterfall.
  - `submitQuestionAnswer` giữ `1 auth + 2 DB`; `submitCardReview` target từ `1 auth + 6 DB` xuống `1 auth + 2 DB` (`3 DB` fallback có evidence), đồng thời bỏ auto-enroll/progress-init và false-success writes.
  - Workspace back action về `/learn/[course-slug]`; existing brand/logo giữ homepage affordance.
  - Reuse C1/B2 eligible-content semantics; không thêm migration/RLS/seed theo current evidence.
- Validation verdict:
  - Cả sáu owner decisions: **Confirmed with refinement**; không có rejection/material scope, DB enforcement, review/exercise semantic hoặc dependency-order conflict.
  - Current learner-write RLS/FK không tạo database-wide relation invariant; future `LEARNING-INTEGRITY-001` được ghi riêng, tách `PROGRESS-001` completion semantics.
  - Planning review sau docs reconciliation: `0 Critical`, `0 Required` còn mở; CP1 action tests đã xác minh exact success budget `1 auth + 3 DB`.
- Triển khai:
  - CP1 `bc1cd93`: strict workspace read/result DTO; auth/course/enrollment/topic precedence; exact active parent chain; learner-safe syllabus/content/history aggregate; `1 auth + 3 DB` success budget.
  - CP2 `9682389`: bounded progress/question/card-review context validation; checked mutations; bỏ client `topicId`, review auto-enroll/progress-init và false-success queue advancement.
  - CP3 `a3191b5`: page dùng trusted result; canonical sidebar/previous-next links; route-key remount; accessible loading/unenrolled/unavailable/error states; retire legacy content/history actions.
  - CP4: dedicated seeded workspace smoke, C1 ownership reconciliation, mobile navigation wrap và completion docs.
- Automated evidence:
  - Full Vitest post-review correction: `46 files / 415 tests` pass.
  - TypeScript `npx tsc --noEmit --incremental false`: pass.
  - Targeted ESLint cho toàn bộ C2 TS/TSX + smoke surfaces: pass.
  - Isolated seeded C2 Playwright: `3/3`; C1 regression Playwright: `3/3`.
  - Production `npm run build`: pass sau khi rerun ngoài sandbox để tải existing Google Fonts; không code workaround.
  - Runtime smoke xác nhận PostgREST aggregate chạy với current schema/RLS/seed; navigation không phát sinh `Next-Action` content/history waterfall.
- Browser evidence: direct topic 2, cross-chapter sidebar topic 3, refresh, back, forward, previous, exact active/title/card state, parent-link focus và 375px no horizontal overflow đều đạt. Wrong-course/draft/removed/nonexistent/invalid topic cùng privacy-safe unavailable state; nested unenrolled không lộ protected topic.
- Formal self-review: finding `Required` về canonical seeded FSRS metadata thiếu `learning_steps` đã sửa bằng backward-compatible default + update-path regression; post-correction focused `9/9`, full `415/415`, TypeScript/lint/build đạt. Final còn `0 Critical`, `0 Required` mở; verdict implementation đạt, subjective visual/full-keyboard manual QA còn khuyến nghị.
- Trở ngại: Không còn blocker trong C2 scope. Full subjective visual/keyboard pass vẫn là confidence-building manual QA khuyến nghị, không phải automated gate failure.
- Ghi chú: Không triển khai memory check, final completion truth, exercise correctness policy, preview contract, global 404 hoặc mobile navigation parity trong C2.
- Mục tiêu xác minh direct URL, sidebar route/state và refresh/back: đã đạt bằng dedicated C2 Playwright.

#### Delivery evidence sau merge — 2026-09-14

- PR #96 đã merge vào `main` bằng merge commit `3a95c3109b74fc8452625ce1a40ce420179d565c`, với PR head exact `66e7f3187c5c678a2bea7942f8d4ee1a9291a924`.
- CI exact head đạt: `Test and Build`, `production-gate`, `Vercel` và `Vercel Preview Comments` đều pass.
- Local evidence đã ghi nhận: C2 focused `9 files / 48 tests`, full Vitest `46 files / 415 tests`, TypeScript, targeted ESLint, production build và seeded C1/C2 browser smoke `6/6` đều đạt.
- GitHub đã tự xóa remote feature branch sau merge; không có claim production deployment. Full subjective visual/full-keyboard pass vẫn là manual QA khuyến nghị.

## Wave D: Later backlog

### PR D1: Topic authoring → review → publication (`FUTURE-PUBLISH-001`)

- Trạng thái hiện hành: D1 implementation và hai follow-up correction đã merge qua PR #98 (`861e7c7`, head `d93385a`). Các snapshot canonical/reconciliation trước lượt chỉnh tài liệu này đã review `PASS`; focused automated checks và hai manual regression do Owner chạy đều đạt. Lượt chỉnh tài liệu hiện tại chưa có verdict độc lập cho exact bytes mới. Các đoạn lịch sử bên dưới giữ nguyên trạng thái tại từng checkpoint, gồm `local-only` và verdict v4 `BLOCKED(manual_qa_pending)` trước correction/manual QA; chúng không còn là delivery status hiện hành. Không có bằng chứng deploy hoặc remote `db push`; full M17–M28 manual matrix không được claim.
- Detailed plan: [implementation-plans/d1/plan.md](./implementation-plans/d1/plan.md) là authority hiện hành cho D1 contract; [implementation-plans/d1/v4-implementation-reconciliation.md](./implementation-plans/d1/v4-implementation-reconciliation.md) là historical delta giải thích các điểm implementation supersede frozen v4, không phải một candidate còn chờ canonical rewrite. Hash `8fd072211db3bf4d60846a389e9ecdab41df1e16` và `5b17bd557e64003ee384a0b0bb55138c727612a2` là evidence của các snapshot đã review trước lượt chỉnh tài liệu này, không phải review của bytes hiện tại. [implementation-plans/d1/correction-plan-deepseek-v2.md](./implementation-plans/d1/correction-plan-deepseek-v2.md) và frozen [implementation-plans/d1/correction-plan-deepseek-v4.md](./implementation-plans/d1/correction-plan-deepseek-v4.md) (`9b136bf4f22ae7ae99b159e4f7186fe64fc31322`) là lịch sử/audit trail đã implement, không còn điều phối active work. v3 giữ nguyên deferred/chưa implement nên không được nhập vào canonical contract.
- Dependency: C2 PR #96 đã merge; `origin/main @ 5f43c65f4de2638dcbb6a0994826693d61971999` là baseline lịch sử của D1, không phải current `main` sau PR #98.
- Owner contract: topic mới luôn `draft` và create đi thẳng vào builder; chỉ request review khi có ít nhất một active flashcard và một active exercise; request review không tự publish; submit → `pending` frozen; reviewer hợp lệ approve → `published`; reject cần reason → `draft`; self-review bị cấm. **Amendment v4 (2026-09-19):** quyền duyệt của `owner`/`co_owner` là **role-native** (D41 — `can_review_topics` chỉ có nghĩa với `editor`/`previewer`); mọi hạ tier **tước** grant cũ (D42, enforce hai lớp: RPC `v_new_flag` `else false` + trigger `clear_topic_review_capability_on_role_downgrade`); ba capability tách rời — sửa content (D26) / sửa cấu trúc (D31/D37) / xoá (D33/D35/D36); `withdraw_review_to_draft` là hành động riêng, không phải hệ quả của delete (D34).
- Owner amendment 2026-09-16, theo canonical contract hiện hành: course authoring eligibility không tự là topic authorship. Mỗi topic có immutable original creator, đúng một responsible author, tối đa hai contributors explicit; original creator hoặc current responsible được request/resubmit/withdraw, contributor chỉ edit, outside-group collaborator read-only; reject giữ responsibility; initial-review exclusion áp dụng tới first successful approval; role downgrade giữ authorship, còn remove/self-leave có affected responsibility phải transfer atomic với recipient hợp lệ hoặc fail closed; feedback transfer có topic/course/context; create navigation dùng authoritative newly-created topic id độc lập số lượng draft hiện có. v3 target-attached review-note creation UI, email/push, bulk UI và candidate revision deferred.
- Authority contract: global roles `student|teacher|admin` độc lập với course roles `owner|co_owner|editor|previewer`; normal course creation chỉ global `teacher` và creator thành `owner`; local authoring derive từ active membership cùng topic capability, nên admin/student collaborator không bị global role suppress. Previewer thuộc authoring group vẫn sửa topic content nhưng không reorder structure; previewer ngoài group read-only đối với content. Admin không membership giữ moderation/maintenance, không normal-author/review.
- Reviewer contract: `owner`/`co_owner` có implicit review permission; `editor`/`previewer` cần `course_collaborators.can_review_topics = true`; global `admin` role alone không có review authority; effective permission kiểm tra tại mutation time; collaborator transition không được bỏ reviewer hợp lệ cuối cùng của pending submission.
- Rejection/review-feedback contract (amended 2026-09-18): **không** còn rejection budget 3 lần, hold, escalation, rescue, takeover hay close/abandon. Reject chỉ trả topic về `draft` kèm reason; original creator hoặc current responsible được resubmit không giới hạn số lần theo current authority, không có submission thứ hai hay creation hold. Phản hồi reviewer lưu ở bảng `review_notes`: reviewer-only write, đọc bởi reviewer **và** topic participant còn là course member, author-only edit + soft delete, tombstone vẫn hiển thị. Read model trả `rejectionHistory`/`rejectionCount` theo topic khi chưa published; ở trạng thái `published` trả `[]`/`0` theo visibility contract, không xóa persisted history.
- Admin authority contract: global admin giữ moderation/maintenance authority tách biệt để demote/takedown hoặc invalidate pending review có mandatory moderation audit; không ghi `review_notes`, không approve/reject và không direct-publish. Pending freeze không chặn moderation exception nhưng cấm partial pending edit.
- Published-topic interim contract: trước candidate revision system, content edit cần cảnh báo + explicit confirm và mutation cùng demotion về `draft` trong atomic boundary; published soft-delete cũng demote + soft-delete atomically; pending delete cancel pending submission rồi soft-delete trong cùng transaction; restore đưa removed topic về active `draft`; cancel confirmation không đổi state, không silent demotion.
- Các đoạn discovery và checkpoint theo ngày bên dưới ghi lại before-state của từng thời điểm; các câu `hiện`, `chưa có`, `pending` trong đó không thay thế trạng thái hiện hành ở đầu section này.
- Discovery đã xác nhận: `updateTopic` chưa kiểm tra readiness; `createTopic` truyền status vào `create_topic_ordered`; readiness hiện chỉ báo `topic_has_no_learning_content` khi thiếu đồng thời cả flashcard và exercise; pending/review/rejection/capability topic chưa có storage/action contract; content writes chưa khóa pending/published semantics.
- Supplemental discovery đã xác nhận: create modal vẫn cho chọn status và chưa bắt buộc navigate vào builder; `TopicBuilderTabs` chỉ sở hữu tab/URL issue state, chưa sở hữu lifecycle/readiness; flashcard/exercise child writes có nhiều action/RPC; current RLS/direct Data API cho phép management caller cập nhật topic status và content không qua readiness/review boundary; chưa có DB invariant hoặc concurrency boundary tương ứng.
- Supplemental authority discovery đã xác nhận: `create_course_with_owner` và course INSERT policy hiện cho admin/teacher; middleware chỉ guard authentication; header chỉ link `Khóa học của tôi` cho teacher/admin; `has_course_management_access` yêu cầu global teacher hoặc admin dù membership role đã đủ để suy ra local authoring; media upload/storage còn gate teacher/admin; không có DB constraint buộc collaborator là teacher.
- Kết luận planning: D1 là cross-layer teacher/content workflow, không còn là standalone publish flag validation. Detailed plan amended phải bao phủ global-teacher-only course creation, membership-derived authoring across global roles, topic-level authorship/responsibility, application, DB/RPC/RLS/direct write, lifecycle, delete/restore, collaborator capability, riêng moderation boundary và atomicity; không triển khai candidate revision system, Q7, preview, course publication, memory, completion hoặc exercise correctness.

- Correction bổ sung (2026-09-16): ảnh Owner cung cấp khớp với canonical seed cũ, trong đó `Local TOEIC Test Course` có hai membership `owner`; đây là seed defect và database invariant gap thực tế. Migration `20260916110000_d1_single_course_owner.sql` thêm duplicate preflight fail-closed và partial unique owner index; seed dùng `co_owner` cho membership đặc quyền thứ hai. Supported create RPC vẫn là lower-bound boundary tạo đúng một owner; invitation và normal role RPC không tạo owner. Collaborator role controls được chuyển sang shared `Select` primitive mà không đổi semantics.

- Amended checkpoint P0-A/P1-A/P2-A/P3-A/P4-A (2026-09-16): P0-A thêm topic authorship/provenance foundation; P1-A chuyển topic group, responsibility transfer/leave, reviewer exclusion và membership transitions qua trusted boundary; P2-A áp dụng topic-group authorization cho topic/card/exercise/question-group/question/option/restore/media, đóng legacy RPC arity bypass, re-check group sau course/topic lock cho direct Data API trigger và harden `move_topic_order`; P3-A thêm workflow read DTO/UI cho authorship group, persistent transfer feedback, collaborator summary/leave warnings, responsibility-safe role/removal paths và interaction regression cho create→builder; P4-A thêm focused current-route Playwright smoke cho chapter có `0/1/multiple` draft và sửa thứ tự create→Builder navigation để authoritative returned id không bị refresh/feedback cạnh tranh. Amended P0-A→P4-A đã có local checkpoint evidence; P4 checkpoint commit được tạo sau reconcile tài liệu. Browser smoke `1 passed (40.9s)` bao phủ cả ba cardinalities; focused navigation `1 file / 4 tests`, affected integration `12 files / 127 tests`, full unit `55 files / 463 tests`, TypeScript và targeted ESLint đạt; full lint còn 7 lỗi baseline ngoài phạm vi. Final cleanup reset local Supabase được giữ làm bước cuối sau P4 verification/self-review/commit, không chạy lại residue-producing test sau reset.

- Senior-review correction (2026-09-17, bounded verify → correction): fresh-reader findings `D1-SEC-001`/`D1-AUTH-002`/`D1-SEC-003`/`D1-SEC-004`/`D1-UX-003` đều được tái xác minh trước khi sửa: unresolved escalation có thể bị bypass sau responsibility transfer; management transfer nhận unrelated co_owner/editor; direct topic metadata UPDATE có TOCTOU với contributor removal; Storage DELETE persisted object có thể thắng pending transition; Course Structure chỉ dùng course-level `readOnly`. Correction migration `20260917100000_d1_senior_review_corrections.sql` mở topic-wide escalation hold + terminal pending cancellation, tách recipient semantics management/self-leave, bỏ direct topic UPDATE policies, thêm batch topic-group permission DTO/RPC, khóa persisted media DB-first và thêm lock/reference-aware Storage DELETE policy. Server Actions/UI và regression coverage được cập nhật tương ứng; đây là correction cùng D1 boundary, không mở candidate revision/Q7/D2.
- Senior-review verification evidence: focused action/UI unit `95/95`, focused affected integration `4 files / 62 tests` (media Storage/RLS `18/18`), full unit `55 files / 474 tests`, full integration `15 files / 147 tests`, `npx.cmd tsc --noEmit --incremental false` và targeted ESLint `0 errors`; static probe xác nhận migration head `20260917100000`, không còn direct topic `UPDATE` policy và ACL của `d1_update_question_group` chỉ còn `authenticated`/`service_role`; real local overlap probe đạt `blockedBeforeRelease=true`, request thành công → `topicStatus=pending`, `objectExists=true` sau Storage DELETE attempt. Final cleanup reset chạy sau self-review/commit, apply toàn bộ migration + canonical seed; post-reset sanity ghi nhận `course_count=14`, D1 fixture courses `0`, Storage objects `0`, duplicate active owner courses `0`, published thiếu active exercise `11` và thiếu active flashcard `8`.

- **Amendment thứ hai — bỏ escalation/rescue/review-budget (2026-09-18, planning-only):** Owner chốt bỏ **toàn bộ** interlock escalation/rescue và ngân sách 3 lần từ chối, thay vì sửa nó. `reject_topic_review` chỉ trả topic về `draft`; `topic_review_escalations`, `resolve_topic_review_escalation`, `TOPIC_REVIEW_ESCALATION_HOLD`/`TOPIC_REVIEW_CREATION_HOLD` và cột `rescue_escalation_id` đều bị gỡ. Phản hồi reviewer chuyển sang bảng mới `review_notes` (migration riêng `20260917120000_d1_review_notes.sql`, D11) và read model expose `rejectionHistory` đầy đủ + `rejectionCount` derive, thay cho cặp `latestRejection*` (D13). Không thêm gate chống spam thay hold (D12, quyết định có thời hạn). Lý do hợp lệ để amend thẳng chuỗi migration D1: Owner xác nhận D1 chưa từng lên môi trường chia sẻ (D8). Correction plan `correction-plan-deepseek-v2.md` đã qua một vòng review độc lập (3 blocker C1/C2/C3 được xác nhận và sửa; finding R2 bị **bác bỏ**), Owner pass 2026-09-18. **Chưa implement dòng code/migration/test nào** — đây thuần là planning + reconcile tài liệu. Commit tài liệu local `4a2756e`, `5a9b92e`.
- Reconcile tài liệu của amendment (2026-09-18, phạm vi **chỉ trong D1**): `implementation-plans/d1/plan.md` được cắm marker "stale by decision" ở đầu file với nội dung contract **giữ nguyên byte-for-byte** — Owner chốt reconcile nó chỉ **sau khi v2 implement xong (P1–P5)**, không phải trước (D14). Ba draft correction cũ (`correction-plan.md`, `correction-plan-gemini.md`, `correction-plan-deepseek.md`) được gắn banner STALE ở đầu file, giữ lại làm hồ sơ lịch sử thay vì xoá (chúng untracked → xoá là không hoàn tác được). `problems.md` không có mục nào stale: các nhắc escalation/rescue ở đó là bản ghi lịch sử có ngày + commit hash. Các mục dated trong chính file này cũng giữ nguyên theo cùng lý do — chỉ các **khẳng định contract hiện hành** ở trên được cập nhật.

- Trạng thái: Implementation-ready planning complete; audit toàn bộ backlog và Owner decision reconciliation đã hoàn tất ngày 2026-09-15. D1 P0–P4 và các correction unit đã đạt local; các residual và giới hạn claim được ghi ở checkpoint P4.
- Baseline dependency: C2 PR #96 (`3a95c310`) đã merge; các contract route/dashboard/workspace liên quan là prerequisite hiện tại.

### D1 checkpoint P0 — Contract/schema/fixture foundation

- Kết quả: PASS local.
- Đã triển khai: `can_review_topics` additive boolean với downgrade trigger; topic review submission/escalation storage tối thiểu; membership-only `has_course_authoring_access`; teacher-only `create_course_with_owner`; draft-only `create_topic_ordered`; topic metadata schema không nhận lifecycle status; topic publish-readiness DTO/predicate; cross-role fixture matrix và migration inventory guard.
- Database evidence: `npx.cmd supabase db reset --local --yes` đạt; migration `20260915090000_d1_foundation.sql` và seed áp dụng thành công. Inventory guard không tự remediation dữ liệu. Post-seed read-only inventory hiện ghi nhận 11 active `published` fixture topics thiếu card hoặc exercise (đều `active_exercises = 0`); P1 phải remediate fixture/legacy rows trước khi bật DB invariant, không grandfather.
- Verification: focused Vitest `65 passed`; role/review storage integration `15 passed`; course creation + ordering integration `18 passed`; TypeScript `npx.cmd tsc --noEmit --incremental false` đạt; targeted ESLint `0 errors` (2 pre-existing warnings); `git diff --check` đạt.
- Residual đúng checkpoint: P0 chưa đóng request/approve/reject, pending freeze, direct topic status/content hardening, admin moderation boundary hoặc published mutation atomicity; các mục này thuộc P1/P2/P3.

### D1 checkpoint P1 — Trusted lifecycle boundary

- Kết quả: PASS local sau self-review và correction.
- Đã triển khai: membership-only authoring/RLS/action boundary; draft-only topic creation; trusted request/approve/reject/escalation RPC; effective reviewer capability và no-self-review; rejection threshold/creation hold/rescue/close/abandon; last-reviewer safety cho capability/role/removal; separate global-admin moderation RPC với mandatory reason và moderation audit; pending freeze cho topic/chapter/content/media; direct lifecycle status/course/collaborator writes bị harden.
- Atomicity evidence: review lifecycle lock theo `course_id` và `topic_id`; child mutation trigger dùng cùng topic advisory lock trước khi đọc/giữ readiness; trusted topic status transitions dùng transaction-local guard; pending `create_exercise_with_content` RPC bị chặn trước partial insert.
- Verification: `npx.cmd supabase db reset --local --yes` đạt; topic lifecycle integration `11/11`; affected integration `6 files / 67 tests`; focused action/schema/unit `9 files / 104 tests`; `npx.cmd tsc --noEmit --incremental false` đạt; targeted ESLint `0 errors` và `2 warnings` đã có trước; `git diff --check` đạt.
- Self-review: đã áp dụng `docs/agent-self-review.md`; phát hiện và sửa hai finding material: assertion pending freeze chạy trước request trong test, và readiness lock không cùng key với child mutation. Sau correction, topic/affected verification đều đạt lại.
- Residual: P2 còn sở hữu published edit/delete/restore atomic demotion và full content mutation bridge; P3/P4 còn UI/browser/manual closure. Local seed vẫn tạo `11` active `published` fixture topics thiếu active exercise/card qua `service_role` sau migration inventory guard; không tự remediation vì đây là infrastructure/fixture data và không được cấp production-data authority. Không claim database-wide invariant cho service-role bypass.

### D1 checkpoint P2 — Content mutation safety

- Kết quả: PASS local sau self-review và correction.
- Đã triển khai: topic/card/exercise/question-group/question/question-option mutation từ Server Action đi qua trusted RPC; `pending` tiếp tục bị khóa; published mutation yêu cầu `p_confirm_published = true` và demote topic về `draft` trong cùng transaction; published topic delete là demote + soft-delete atomically; restore content/topic chỉ trở lại active `draft`.
- Database evidence: migration `20260915110000_d1_content_mutation_safety.sql` thêm RPC boundary, giữ legacy RPC arity cho draft và trigger từ chối direct published child writes; parent hierarchy của restore được kiểm tra; content row lock được lấy trước topic lock ở trusted wrappers để giảm deadlock order inversion.
- Verification: `npx.cmd supabase db reset --local --yes` đạt; topic lifecycle integration `17/17`; affected integration `6 files / 73 tests`; focused action tests `4 files / 65 tests`; `npx.cmd tsc --noEmit --incremental false` đạt; targeted ESLint `0 errors`; `git diff --check` đạt, chỉ có line-ending warnings.
- Self-review: đã áp dụng `docs/agent-self-review.md`; phát hiện và sửa overload ambiguity của legacy RPC, thiếu parent check khi restore nested content, và lock-order inconsistency giữa trusted wrappers với legacy row mutation. Không có finding mở ảnh hưởng P2 acceptance sau correction.
- Residual: media upload vẫn là staging artifact chưa gắn vào row; learner-visible media URL chỉ được ghi qua question-group/exercise trusted mutation. Service-role/seed writes vẫn nằm ngoài database-wide guarantee; không có production-data remediation hoặc candidate-revision system trong P2.

### D1 checkpoint P3 — Teacher/admin workflow UX

- Kết quả: PASS local sau self-review và correction; P3 đã đóng, P4 còn lại.
- Đã triển khai: topic workflow DTO/read RPC và Builder lifecycle shell; readiness hiển thị độc lập cho active flashcard/active exercise, CTA request review chỉ bật khi đủ cả hai; pending/rejected/published state và reviewer controls được phản ánh ở UI. Topic create thành công điều hướng thẳng vào builder.
- Đã triển khai: pending khóa các mutation controls ở structure/topic/card/exercise/child; published edit/delete yêu cầu explicit confirmation và truyền trusted demotion contract. Previewer vào được bounded read-only workspace nhưng không có course/chapter/topic/content mutation controls. Course list chỉ hiển thị normal create cho global teacher; collaborator overview là entry point duy nhất và hiển thị role/capability hiện tại.
- Đã triển khai: `getCourseCollaboratorOverview` đọc membership/capability qua action có schema DTO; owner/co_owner có bounded capability/role/removal controls và invitation send/revoke, invitee có persistent accept/reject surface; role downgrade/removal/last-reviewer safety vẫn nằm ở trusted RPC. Admin page hiện vẫn là mock/unimplemented nên không thêm live moderation UI giả; moderation boundary được kiểm chứng ở runtime/RPC/audit.
- Verification trước correction: local reset với migration tới `20260915120000_d1_topic_workflow_read.sql` đạt; topic-review và course-readiness integration `29/29`; focused action/schema/component/unit `9 files / 139 tests`; TypeScript đạt; targeted ESLint đạt với cảnh báo pre-existing đã ghi nhận; `git diff --check` đạt.
- Self-review: đã áp dụng `docs/agent-self-review.md`; kiểm tra lại pending freeze, previewer read-only boundary, create→builder navigation, stale/error classification, cross-course workflow parent, published confirmation và collaborator entry point. Không còn finding material mở ảnh hưởng P3 acceptance sau correction.
- Residual trước P4: browser smoke/manual accessibility/responsive QA, final self-review và closure thuộc P4; admin moderation vẫn chưa có surface live vì current admin page là mock; service-role/seed writes vẫn là giới hạn database-wide guarantee và 11 invalid published seed fixture chưa được tự remediation. Không claim các residual này đã PASS.

### D1 amended checkpoint P3-A — Authorship workflow và navigation UX

- Kết quả: PASS local sau bounded discovery, affected verification và self-review; local checkpoint commit được tạo sau khi reconcile tài liệu này.
- Đã triển khai: trusted workflow read RPC/DTO trả original creator, responsible author, contributors, server-derived authorship flags và recipient-scoped transfer feedback; Builder hiển thị authorship/read-only/pending states và owner/co_owner có bounded group management qua RPC P1. Course overview/empty dashboard trở thành collaborator entry point cho mọi membership, có compact summary và non-owner leave flow với responsibility recipient warning. Role/removal mutations hiện gọi trusted responsibility-safe actions; create CTA giữ authoritative returned topic id và có interaction coverage cho `0/1/multiple` existing drafts.
- Verification: focused UI/action/schema `5 files / 63 tests` đạt; full unit `55 files / 463 tests` đạt; affected integration `12 files / 127 tests` đạt sau rerun ngoài sandbox; TypeScript và targeted ESLint đạt; `git diff --check` không có lỗi nội dung, chỉ còn line-ending warnings. Sandbox lần đầu có 2 lỗi Supabase CLI telemetry `EPERM`, đã xác nhận không tái hiện ngoài sandbox.
- Self-review: đã áp dụng `docs/agent-self-review.md`; kiểm tra authoritative create target, strict DTO/read boundary, pending/group freeze, membership-scoped leave/transfer, SSR/static-render safety và scope visual. Không còn finding material mở ảnh hưởng P3-A acceptance.
- Residual cho P4-A: browser smoke/manual accessibility/responsive QA, final invariant/concurrency evidence và closure report; admin moderation vẫn chưa có live UI vì current admin page là mock; service-role/seed writes và invalid published fixtures vẫn là giới hạn database-wide claim đã ghi nhận.

### D1 amended checkpoint P4-A — Verification, browser smoke và closure

- Kết quả: PASS local sau bounded verification, self-review và correction; không mở thêm product scope. Candidate P4 gồm production correction trong `TopicManagementSheet.tsx` và focused browser smoke/fixture mới, không tạo migration.
- Browser evidence: `npm.cmd run test:e2e -- e2e/smoke/topic-create-navigation.smoke.spec.ts` đạt `1 passed (40.9s)`. Smoke dùng current `/teacher/courses/:courseId/structure` và tạo topic trong ba chapter fixture có lần lượt `0`, `1` và `3` existing draft; sau create kiểm tra topic vừa persist thuộc đúng chapter, luôn `draft`, URL đúng `getTopicBuilderPath(courseId, createdTopic.id)` và heading `Topic Builder`. Existing `course-structure` smoke stale hard-coded legacy route nên không dùng làm product evidence và không sửa trong D1.
- Correction: sau `createTopic` thành công, create path push thẳng tới Builder bằng id authoritative rồi return; các refresh/feedback/close side effects không còn cạnh tranh với navigation. Đây là correction cho observed dev-runtime assertion timing, không phải product redirect semantics mới.
- Verification: focused navigation `1 file / 4 tests` đạt; full unit `55 files / 463 tests` đạt; affected integration `12 files / 127 tests` đạt; `npx.cmd tsc --noEmit --incremental false`, targeted ESLint trên changed TS/TSX và `git diff --check` đạt. Intermediate local Supabase resets được dùng để áp dụng canonical migrations/seed cho integration evidence; final cleanup reset được giữ riêng sau self-review. Media-delete correction và final cleanup reset được ghi nhận ở checkpoint P4 bên dưới.
- Self-review: đã áp dụng `docs/agent-self-review.md`, anchor vào amended Owner contract và P4 acceptance; đã falsify exact-id navigation, `0/1/multiple` coverage, current-route scope, fixture authority, pending/readiness boundaries, stale-test exclusion và absence of unrelated framework refactor. Không có finding material mới.
- Residual: 11 active `published` canonical seed fixtures thiếu active exercise vẫn tồn tại qua service-role/seed path và không được remediation; admin moderation surface hiện vẫn mock; full accessibility/responsive và cross-role browser QA chưa claim; repository-wide lint còn baseline `QUALITY-001`; stale legacy-route smoke follow-up riêng. Các residual này không phủ định bounded P4 acceptance.

### D1 checkpoint P4 — Closure

- Kết quả: PASS local sau fresh-reader verification, correction và self-review; correction commit mới nhất `6779f93` đã đóng recipient UI mismatch trên branch hiện tại; chưa push.
- Correction đã đóng: profile role escalation bị chặn ở grant/RLS; ordinary approval không thể resolve rescue escalation; rescue giữ identity `A/B/C` với attribution B/C rõ ràng; request review chặn sole-owner không có reviewer khác; Builder refresh parent readiness sau mọi card/exercise mutation thành công; invitation lifecycle tối thiểu đã có persistence, cap reservation và invitee discoverability; authenticated self-delete profile và admin self-target bị chặn; role promotion/downgrade enforce fixed cap và pending reservation dưới course lock; canonical seed không còn tạo hai owner, DB partial unique guard chặn owner thứ hai, supported create vẫn tạo đúng một owner và collaborator role controls dùng shared Select.
- Correction tiếp theo đã đóng fresh-reader finding `D1-MEDIA-DELETE-001` trong commit `98879ec`: ordinary question-group media DELETE giờ validate bucket/path server-generated, resolve `course_id → topic_id`, yêu cầu đúng uploader còn trong topic group và topic active `draft`; pending/published/removed/outside-group direct DELETE không còn bypass được Storage RLS, còn global admin delete giữ nguyên moderation exception. `deleteQuestionGroupMedia` áp dụng cùng boundary ở Server Action.
- Admin boundary: moderation topic takedown/cancel escalation cancel pending/rescue đúng boundary, resolve escalation với action `moderation`, ghi audit riêng và không tăng rejection counter/budget; global admin không có review/publication authority nếu không có membership/capability.
- Fresh-reader findings đã verify độc lập và confirmed: D1-SEC-001 do invite RPC resolve bằng mutable `profiles.email`; D1-AUTH-002 do thumbnail Storage policy lệch với course-local DB authoring và upload đứng trước authoritative create; D1-UX-003 do invite DTO/UI thiếu course identity và accept không refresh parent course list. Corrections tương ứng dùng `auth.users` resolver + invitee-only course identity RPC, create/course-scoped thumbnail paths với preflight/policy/cleanup, và parent `fetchMyCourses` callback sau accept.
- Follow-up fresh-reader finding về recipient UI đã được verify/tái hiện trước correction: `CollaboratorManagementDialog` auto-pick owner/co-owner đầu tiên cho role downgrade/removal dù recipient có thể không là contributor của affected topic; `TopicAuthorshipSection` expose toàn bộ owner/co-owner. Commit `6779f93` thêm read-only candidate resolver tính giao recipient hợp lệ trên mọi affected unapproved topic, yêu cầu chọn tường minh, chặn không có recipient chung với feedback actionable, và lọc direct transfer còn actor owner/co-owner hoặc contributor hiện hữu; self-leave không đổi.
- Verification sau correction: full Vitest `52 files / 453 tests` passed; full integration run đạt `119/121`, hai test dùng `supabase db query` bị lỗi sandbox EPERM khi CLI ghi telemetry và không phải product assertion failure; focused invitation integration `1 file / 8 tests`, course creation/Storage integration `1 file / 9 tests`, action + collaborator UI unit `2 files / 18 tests` passed; migration/index read-only probe passed; TypeScript `npx.cmd tsc --noEmit --incremental false` passed; targeted ESLint trên toàn bộ changed TS/TSX `0 errors / 0 warnings`; `npm.cmd run build` passed sau quyền local phù hợp; `git diff --check` không có lỗi nội dung. Final local reset và canonical-seed verification được ghi nhận ở correction media-delete bên dưới.
- Repository-wide lint chưa được dùng làm gate cho correction vì baseline ngoài D1 còn lỗi đã theo dõi tại `QUALITY-001`; targeted lint cho toàn bộ changed TS/TSX đã pass.
- Self-review: đã áp dụng `docs/agent-self-review.md` sau correction hiện tại; đã falsify lại role escalation, ordinary/rescue/multiple-escalation resolution, sole-owner reviewer, moderation-vs-review audit, invitation identity/capacity/RLS, thumbnail path/authorization/cleanup, pending freeze, published demotion, parent course refresh, singular-owner DB/create/invitation/role boundaries, trusted recipient intersection, unrelated-recipient exclusion và self-leave preservation. Không còn finding material mở ảnh hưởng D1 acceptance trong local evidence.
- Verification bổ sung cho `D1-MEDIA-DELETE-001`: focused action `15/15`, media Storage/RLS `17/17`, affected topic-group/authorship/review `41/41`, full unit `55 files / 470 tests`, full integration `15 files / 143 tests`, TypeScript `--noEmit --incremental false`, targeted ESLint và migration reset đều đạt. Storage denial được kiểm tra bằng object persistence vì local Storage API trả success/no-op khi DELETE row bị RLS lọc; không dùng response error đơn độc làm security evidence.
- Self-review bổ sung: đã kiểm tra exact draft equality trong cả hai Storage DELETE policies, admin moderation branch tách khỏi ordinary authoring, path/topic ownership resolution, contributor removal và removed/pending/published lifecycle cases; không có finding material mới.
- Final cleanup: `npx.cmd supabase db reset --local --yes` áp dụng tới migration `20260916153007_d1_media_delete_lifecycle.sql` và canonical seed; sanity query ghi nhận `course_count=14`, `D1 review courses=0`, media-test courses `0`, duplicate active owner courses `0`, hai DELETE policies có draft guard. Known canonical `published_missing_active_exercise=11` vẫn được giữ nguyên theo authority boundary.
- Residual không phải Owner blocker: 11 active `published` seed fixture topics thiếu active exercise chưa được remediation vì không có production-data authority; `service_role` vẫn là infrastructure bypass; admin moderation boundary có runtime/RPC/audit nhưng current admin page vẫn mock; full accessibility/responsive và cross-role browser QA chưa hoàn tất; stale smoke tests cần follow-up riêng.
- Follow-up verification: focused component/action `16/16`, full unit `56 files / 479 tests`, focused responsibility integration `3/3`, full integration `15 files / 148 tests`, TypeScript `npx.cmd tsc --noEmit --incremental false`, targeted ESLint và `git diff --check` đạt. Full integration lần đầu trong sandbox có `2` Supabase CLI telemetry `EPERM`; rerun ngoài sandbox đạt đủ `148/148`. Local final reset sau test đạt migration head `20260917100000` + canonical seed; sanity `course_count=14`, fixture residue `0`, duplicate owner `0`. Không chạy integration/E2E sau final reset.
- Closure: P0→P4 base và corrections đã có local checkpoint commits; handoff implementation READY cho fresh-reader review/push/PR riêng theo authority hiện tại, không claim merge readiness cho browser/manual QA residual chưa verified.

### D1 correction closure — browser visual/state sanity (2026-09-17)

- Kết quả: PASS local sau commit `ed3f925` (`fix(d1): close manual QA lifecycle gaps`), không mở rộng product scope. Browser sanity đã kiểm tra từng rendered state theo bốn câu hỏi: backend/UI state, user need, actionable controls và relevance/copy/severity; không đánh giá PASS chỉ từ layout.
- Positive/negative variants đã kiểm tra: leave có/không có affected topic; escalation chưa có rescue / rescue đang pending ở submitter / rescue đang pending ở reviewer; readiness thiếu/đủ; creator = responsible / khác responsible; self/other collaborator; `co_owner`/`editor`/`previewer`; published settings. Không có material visual finding mở.
- Bounded polish đã áp dụng: loading collaborator counts hiển thị `…` thay vì số `0` giả; leave dialog giữ loading state tối giản, không hiển thị handoff mechanics trước khi biết có affected topic, rồi hiển thị đúng dialog `Rời khóa học?` khi không cần handoff.
- Verification sau correction: focused collaborator/leave `3 files / 18 tests`, focused re-run sau loading correction `2 files / 8 tests`, full unit `59 files / 491 tests`, focused lifecycle integration `32/32`, full integration `15 files / 149 tests`, Playwright leave navigation `1 passed`, TypeScript, targeted ESLint và `git diff --check` đạt. Browser smoke đóng functional redirect; browser visual sanity là evidence riêng trên touched manual-QA surfaces.
- Final local cleanup: `npx.cmd supabase db reset --local --yes` thành công, áp dụng migration head `20260917110000_d1_manual_qa_corrections.sql` và canonical seed. Read-only sanity: `14` courses, `0` D1 review/fixture-named courses, `0` Storage objects, `0` duplicate-owner courses; canonical residual còn `11` active published topics thiếu exercise và `8` thiếu flashcard. Không chạy lại test tạo residue sau reset.
- Self-review theo `docs/agent-self-review.md` đã reapply sau visual correction; không còn finding material. Không push/PR/merge/deploy.

### D1 correction v2 — implementation closure (2026-09-18)

- Implementation commit local: `0cdcec4` — `fix(d1): replace review escalation with topic review notes`, 32 path (8 file mới + 24 file sửa), đúng allowed-writer list của plan §9. Commit này **chưa push** và **chưa** có PR.
- Nguồn contract: `implementation-plans/d1/correction-plan-deepseek-v2.md` (đã pass Owner review 2026-09-18). Episode `MULTI_AGENT_E2E` `nma-d1-v2-correction` / `v2-implementation`: fresh Implementor → mandatory Implementation Reviewer, correction round 1, rereview round 1. Authority: implementation local + `npx supabase db reset` local; **không** commit/push/PR/merge, **không** `npx supabase db push`, **không** đụng remote/production DB.
- Kết quả implementation: toàn bộ **P1–P5** đạt; candidate 32 path (8 file mới + 24 file sửa), khớp chính xác allowed-writer list của plan §9 (đối chiếu hai chiều rỗng ⇒ A11 đạt). `npx supabase db reset` đạt; `npx tsc --noEmit` exit 0; `npm.cmd run test:run` `62 files / 525 tests` đạt; `npm.cmd run test:integration` `16 files / 162 tests` đạt; lưới literal §10.1 **9/9 lệnh = 0 hit**; `git diff --check` exit 0.
- **Review verdict: `PASS`, `0 Critical / 0 Required`** (`d1v2-impl-r1-review-r1.md`). Round 0 trả `BLOCKING_FINDINGS` với **1 Required**: trạng thái read-error của `review_notes` bất khả đạt — `page.tsx` fold lỗi đọc thành `notesPayload=null` ⇒ `canRead=false` ⇒ guard component `return null` **trước** nhánh `readError`. Correction round 1 sửa ở component thành `if (!value || (!value.canRead && !value.readError)) return null;` (đặt ở component vì `canRead` không tính thuần từ capability — nhánh `originalCreator.userId === currentUserId` cần `currentUserId`, nguồn duy nhất là payload đọc), và thay case test bất khả thi bằng đúng tổ hợp production tạo ra. Test được chứng minh là regression guard thật: revert guard ⇒ `2 failed | 10 passed`, phục hồi ⇒ `12 passed`.
- **Thay đổi phát sinh sau `PASS` (chưa qua review) — verdict trên không còn bao trùm bytes hiện tại:** (1) Owner sửa Tailwind important-modifier trong `TopicBuilderTabs.tsx` (`!h-auto` → `h-auto!`, đúng cho Tailwind v4) và **cố ý tách khỏi candidate này** — file này không tính vào 32 path; (2) Main sửa một literal trong `supabase/seed.sql`: fixture `Local review notes exercise` ghi `'part_5'` → `'part5'`. Vì (2) **là** file candidate, `PASS` của rereview round 1 áp cho snapshot `r1` không còn áp cho working tree; **đang nợ một correction round + same-Reviewer rereview** trước khi commit/merge readiness. Defect gốc: seed ghi `'part_5'` trong khi `TOEIC_PART_TYPES` là `part1..part7` (không gạch dưới); bảng `exercises` không có CHECK constraint nên seed ghi được, rồi `courseReadinessGraphSchema` chết ở `safeParse` khiến course overview của course seed `44444444-4444-4444-8444-444444444444` trả `INVALID_READINESS_DATA`. Bằng chứng sửa: enum sweep `exercises.part_type bad=0` (`values=part5`); probe chạy chính `courseReadinessGraphSchema` trên toàn bộ course đã seed cho `ok=13 failed=0`. Cùng họ lỗi nhưng **chưa** sửa (ghi làm follow-up riêng): 3 file test còn dùng `'part_5'` — `topic-authorship-boundary.test.ts:93` có sẵn từ HEAD và ngoài candidate, `topic-review-lifecycle.test.ts:128` và `topic-review-notes.test.ts:146` thuộc candidate — và cột `exercises.part_type` thiếu CHECK constraint nên không có gì chặn lớp lỗi này tái diễn.
- **Owner quyết định (2026-09-18) về round correction đang nợ:** hoãn cho tới khi Owner manual QA xong, để giữ nguyên round tự động cuối (round 2) thay vì tiêu vào một sửa đổi một literal; khi đó một round duy nhất gộp seed fix với mọi finding từ manual QA. Phạm vi round đã chốt: sửa `'part_5'` → `'part5'` ở **cả hai** file test thuộc candidate (`topic-review-lifecycle.test.ts:128`, `topic-review-notes.test.ts:146`). Trong lúc chờ, candidate ở trạng thái **đã đổi nhưng chưa review**: không commit, không push, không claim merge readiness.
- **Browser automation M1–M11: `11/11 pass`, `0 not run`** — nhãn bằng chứng là **`browser automation`**, không phải manual QA. Chạy trên production bundle (`next build` + `next start`) trên root local Supabase. Đối chiếu DB độc lập với DOM: `topics.status=pending`; `4` submission (`attempt 1–3 rejected`, `attempt 4 pending`); `review_notes=2` (1 đã xoá mềm). Cặp M7/M8 là đối chứng biên sở hữu: admin thấy 2 note của previewer với tổng nút Sửa/Xóa `0`, trong khi chính previewer **có** 2 nút — phân biệt được "không có quyền" với "nút chưa render". Evidence: `docs/native-multi-agent/reviews/nma-d1-v2-correction/v2-implementation/qa-browser-automation-r1.md` (ignored, untracked).
- **Manual QA `pending Owner`** — Owner đã disposition: Owner tự thực hiện sau, và báo lại nếu có finding. Vì vậy các tiêu chí sau **chỉ** có bằng chứng automation/RTL/integration, **chưa** có bằng chứng tay: `A3b`, `A7`, `A8`, `A9` và `P4(f)`. Trạng thái `PASS` ở trên **không** bao hàm manual QA đã xong.
- **Ranh giới trạng thái:** pending manual QA **không** chặn local commit nhưng **chặn** merge readiness. Candidate hiện **chưa** được commit, chưa push, chưa có PR; chưa có claim merge-ready.
- **Claim bị hạ cấp thành giả thuyết (không phải fact repo):** lượt chạy automation đầu tiên fail toàn bộ do harness, và báo cáo ban đầu giải thích cơ chế là *"dev server không hydrate: `webpack.js`/`polyfills.js` bị stream xuống cuối `<body>`"*. Main **đã tự kiểm và không tái hiện được**: dựng lại dev server bằng chính đường của repo (Next.js `16.2.6 (webpack)`) và curl trọn vẹn HTML của `/` và `/login` cho thấy `webpack.js` nằm trong `<head>`, số script ở đuôi tài liệu `0` ở cả hai trang — kể cả `/login`, đúng trang harness fail. Kết luận "fail do harness" có thể vẫn đúng, nhưng **cơ chế nêu ra chưa được chứng minh**; giả thuyết thay thế là race phía harness khi đọc stream HTML. Bằng chứng được chấp nhận là **kết quả M1–M11**, không phải lời giải thích cơ chế; `npm run dev` **không** hỏng.
- **Plan defect còn nợ reconcile** (thuộc `./plan.md` và chính `correction-plan-deepseek-v2.md`, không phải lỗi candidate — ghi lại để không phải phát hiện lại): (1) `M1` trong state matrix §11.3.3 **bất khả thi như đã viết** — bảng ghi `admin (owner)` cho cả "gửi duyệt → từ chối", nhưng `request_topic_review` buộc `responsible_author_user_id = auth.uid()` (`20260917100000:216`) và `reject_topic_review` chặn self-review (`20260917110000:34`), nên chỉ đường "teacher gửi + admin từ chối" mới đạt được kỳ vọng của chính M1; (2) §11.2 dòng 1002/1004 **trùng byte-identical**; (3) §6.5 nói `card.title` trong khi `cards` **không có** cột đó (nhãn lấy từ `front_content.word`); (4) §14.2 **S2 phát biểu sai** — `d1_transfer_topic_responsibility_locked` **có** ghi `topic_contributors` (`20260917100000:78-83`); (5) §6.5 (truyền prop xuống `TopicWorkflowPanel`) và §9 P4 (không đụng `TopicBuilderTabs.tsx`) **không thể cùng đúng** vì file đó là nơi duy nhất render panel (`TopicBuilderTabs.tsx:270`) — đã xử lý bằng provider trong scope, được Reviewer phán là deviation hợp lệ **không** phải `PLAN_CONTRACT_MISMATCH`; (6) §6.5 "thêm vào cả hai mapper" tự mâu thuẫn với chính câu cha của nó, Main phán **không binding** (thêm sẽ tạo hai nhánh chết vĩnh viễn, trái Rule 2 + §16.1). Cũng còn nợ: `./plan.md` reconcile theo **D14** (§13.1) — điều kiện "sau khi v2 implement xong (P1–P5)" nay **đã thoả**; và ghi lại thủ tục hashing snapshot cho evidence candidate.

### D1 correction v3 — planning (2026-09-18)

- **Defect được phát hiện:** contract DB cho phép ghi chú gắn vào một flashcard/bài tập cụ thể (`review_notes.card_id` / `exercise_id`), nhưng **UI chỉ tạo được note cấp topic** — `TopicReviewNotes.tsx:105` luôn gọi `createReviewNote({ topicId, body })`. Owner kết luận đây là **lỗi contract**: plan v2 đặc tả đường *ghi* và đường *hiển thị* cho note gắn đích nhưng không đặc tả đường *tạo* trên UI, rồi tự khoá cửa bằng `§9 P4` ("`TopicBuilderTabs.tsx` — chốt: KHÔNG sửa"). Đây chính là khoản nợ mục (5) ở mục v2 phía trên.
- **Owner decision (2026-09-18):** **D15** ghi chú gắn đích tạo **ngay trên nội dung** (card/bài tập) là đường chính, không qua bộ chọn đích; **D16** chọn hướng **sửa contract**; **D17** UI ghi chú hiện tại bị đánh giá **"giống CRUD, không phải prod UI"** — đây là **tiêu chí nghiệm thu**; **D18** đích **chỉ** `card` + `exercise`, **không** mở rộng xuống câu hỏi/nhóm ngữ liệu ⇒ **không cần migration nào**; **D19** note gắn đích hiện ở **cả hai chỗ** (badge tại nội dung + panel tổng hợp cấp topic).
- **Nguồn contract đề xuất:** `implementation-plans/d1/correction-plan-deepseek-v3.md` — **amendment** cho v2, không thay thế: v2 vẫn là baseline cho mọi mục không bị liệt kê trong bảng delta §6 của v3. Episode `MULTI_AGENT_E2E` `nma-d1-v3-correction` / `v3-plan`, `review_round=0`; artifact `6b35b2ceaa6176fd5301d517c996673efa1ad3ed-review-r0.md`, **verdict `PASS`** (`0 Critical / 0 Required`; 5 Suggestion + 3 Nit đều non-blocking).
- **Trạng thái:** v3 là **đề xuất chờ Owner approve**; **chưa** cấp implementation authority cho P6–P10. `PASS` của Plan Reviewer **không** phải Owner approval và không cấp Git/remote authority.
- **Phạm vi v3 nếu được duyệt:** thuần **UI + test** — không migration, không RLS, không action, không schema (đường ghi đã đủ end to end; integration test đã chứng minh insert gắn `card_id`/`exercise_id` chạy thật). Phase P6–P10.
- **Findings non-blocking chưa đóng** (Owner quyết định có tiêu một review round để sửa hay không): S1 `D17` gọi là "tiêu chí nghiệm thu" nhưng không có mục A/evidence tương ứng; S2 `M10` của v2 §11.3.3 mâu thuẫn với §5.1/A19 của v3 nhưng chưa reconcile; S3 delta §9 chưa nêu tên `course-workspace-routes.test.tsx` dù A22 đòi; S4 P9 ("không phơi nút Sửa/Xóa") sẽ vỡ test tương tác `topic-review-notes.test.tsx:174-208`; S5 kế hoạch commit trong v3 không nhắc khoản nợ "bytes đổi sau PASS" của v2. Nit: `:1416-1419` thực tế là `1417-1419`; `app/layout.tsx:8` là dòng import (mount ở `:40`); dải evidence `:15-38` không phủ guard trigger (`:49-100`).

- **Owner chốt 4 việc (2026-09-18), CHƯA thực thi việc nào:**

| # | Việc | Quyết định | Ghi chú |
| --- | --- | --- | --- |
| 1 | 8 finding non-blocking của v3 | **Sửa** | Sửa bytes ⇒ `PASS` trên `6b35b2ce` hết hiệu lực ⇒ cần review round mới. Sửa cả S2 (`M10` của v2 mâu thuẫn §5.1/A19) |
| 2 | Correction round cho v2 | **Chờ** | Chờ Manual QA của Owner xong rồi gộp, giữ trần round tự động. Đây sẽ là **round tự động cuối** (rereview round 2) |
| 3 | Reconcile `plan.md` | **Hai tầng: v2 trước** | Tầng 1: reconcile theo v2 **ngay**, không chờ v3. Tầng 2: reconcile tiếp v3 vào chỉ sau khi v3 đi hết *correction → rereview pass → implement xong → implementation review pass* |
| 4 | `'part_5'` ở file thứ 3 | **Sửa**, **chưa** thêm CHECK | `topic-authorship-boundary.test.ts:93` (có từ HEAD, ngoài candidate v2 ⇒ scope mở rộng). `exercises.part_type` **vẫn không có CHECK constraint** — Owner chốt chưa thêm ở lượt này |

- **Ranh giới đã xác minh cho việc 3:** lưới literal §10.1 của v2 (A13) chỉ quét `supabase/migrations/` + `app/ lib/ types/`, **không** quét `docs/`. Reconcile `plan.md` cần lưới riêng trên đường dẫn docs. `plan.md` hiện 542 dòng / 98 KB, **31 hit** `escalation|rescue|takeover` trải trên ~32 vị trí (contract, state transition, yêu cầu P0/P1/P3, bảng rủi ro, manual QA flow, bảng tóm tắt contract, đoạn handoff readiness).
- **Trần ngân sách của việc 2:** implementation v2 đã dùng round 0 → correction 1 → rereview 1 (`PASS`). Round đang nợ là **correction 2 + rereview 2 = round tự động cuối cùng**; nếu vẫn còn blocking sau đó thì dừng ở `OWNER_DECISION_REQUIRED`. Hai literal cần sửa vẫn còn: `topic-review-lifecycle.test.ts:128`, `topic-review-notes.test.ts:146`. Điểm **chưa kiểm**: chưa xác minh hai literal đó có gây fail thật không (file thứ ba đã có `'part_5'` từ HEAD mà suite vẫn được báo đạt ⇒ nhiều khả năng vô hại, nhưng **chưa** chạy integration suite để chứng minh).

### D1 correction v4 — planning, plan **PASS** + Owner freeze (2026-09-19)

- **Nguồn contract đề xuất:** `implementation-plans/d1/correction-plan-deepseek-v4.md` — viết lại theo contract **D23 đảo + D41 + D42** (quyền duyệt là **role-native** cho `owner`/`co_owner`; `can_review_topics` chỉ có nghĩa với `editor`/`previewer`; transition contract D42: hạ tier ⇒ tước grant, không để cờ cũ resurrect). Episode `MULTI_AGENT_E2E` `nma-d1-v4-correction` / `v4-plan`.
- **Vòng review:** **8 round liên tiếp**, tất cả `FAIL` (round 0–7) trừ round cuối. Round 3–8 là round Owner cấp thêm ngoài budget tự động. Round 8: artifact `9b136bf4f22ae7ae99b159e4f7186fe64fc31322-review-r8.md`, **verdict `PASS`** (`0 Critical / 0 Required / 0 Medium`; 2 Low + 2 Nit đều non-blocking). Reviewer artifact nằm dưới `docs/native-multi-agent/reviews/` (ignored, untracked, unstaged).
- **Revision đã freeze:** `git hash-object` ⇒ `9b136bf4f22ae7ae99b159e4f7186fe64fc31322` · `2127` dòng / `176308` bytes · CR `0` · newline cuối `0a`. Candidate **untracked**, **chưa** commit.
- **Owner chốt freeze 2026-09-19 — hướng A, giữ nguyên trạng:** *không* sửa 4 finding non-blocking còn lại (`L-F19` Appendix B đếm top-level 1 vs 0; `L-F20` `§5.5:804` còn *"`A60` giữ nguyên"* mâu thuẫn `§3.14:532`, lỗi **tự triệt tiêu** vì `A60` đổi đúng hướng câu đó mô tả; `N-F16` `§13:1602` còn *"bốn lần liên tiếp"*; `N-F17` `§14` self-check chưa xác nhận tiền đề *enum bốn giá trị*). Lý do: sửa bytes sau `PASS` làm `PASS` hết hiệu lực (`review-artifact-and-reconciliation.md:139`, tiền lệ v3 `6b35b2ce` ở mục "Owner chốt 4 việc" phía trên); cả 4 mục là cosmetic/historical nên non-blocking theo taxonomy.
- **Chuỗi lỗi đã bắt được — chưa dừng:** lớp *"câu stale ở biên đối diện của một sửa"* xuất hiện **bảy lần liên tiếp** (`M-F4` r3 → `B-F5` r4 → `B-F6`/`B-F7` r5 → `B-F8`/`B-F9` r6 → `B-F10` r7 → `L-F20` r8). Mức suy giảm đơn điệu và đo được (r7 = một mệnh đề quy nguồn contract → r8 = **một từ** trong câu lịch sử), nhưng **chưa** kết thúc. Bài học đã kiểm chứng: **grep theo chuỗi không đủ** — `B-F8` là lỗi ngữ nghĩa, `L-F20` thuộc trục *trạng thái thay đổi của tài liệu*, cả hai đều không chứa từ khoá bị supersede.
- **Ranh giới của `PASS` này:** **không** phải Owner approval; **không** cấp authority implementation P11–P18, Git, remote, DB, deploy. Reviewer **chưa** chạy `test:run`, `tsc --noEmit`, integration suite hay `db reset`; **không** kết nối DB. Không được suy ra từ artifact: test đang xanh; `§7.3`/`§7.4` đã kiểm trên browser thật; fixture v2 đủ cho browser QA; `plan.md` đã reconcile.
- **Kết quả audit chuyển tiếp then chốt (đã đối chiếu source):** `D42` **có** enforcement hai lớp độc lập — RPC `v_new_flag` với `else false` (`20260916130000:601-605`) **và** trigger `clear_topic_review_capability_on_role_downgrade` (`20260915100000:13-30`) với **ba nhánh** phủ **vét cạn** bốn giá trị enum `course_member_role` (`20260609114505:55-60`). Ba reviewer helper **không** sửa. `§3.14` vế 4 là defense-in-depth, **không** phải nguồn sức mạnh.
- **Chưa được cấp:** implementation P11–P18; commit/push/PR/merge; migration, `db reset`, `db push`; reconcile `plan.md` (vẫn nợ hai tầng theo mục "Owner chốt 4 việc" phía trên). Bước kế tiếp **thuộc Owner**.

### D1 correction v4 — implementation P11–P18, verdict `BLOCKED(manual_qa_pending)` (2026-09-19)

- **Authority đã cấp cho episode này:** implementation P11–P18; sửa `app/actions/topic-authorship.ts` + `lib/schemas/topic.ts` (mở rộng writer boundary); DB mutation **local only**; ghi `progress.md` + `memory/**`. **Chưa** cấp: commit/push/PR/merge/deploy/`db push`, reconcile `plan.md`/`problems.md`. Episode `MULTI_AGENT_E2E` `nma-d1-v4-correction` / `v4-implementation`.
- **Frozen revision kiểm ở đầu và cuối lượt:** `git hash-object` ⇒ `9b136bf4f22ae7ae99b159e4f7186fe64fc31322` (khớp, không đổi byte). Candidate plan **không** bị sửa. `HEAD` vẫn `30e517f`; `git diff --cached` rỗng.
- **Candidate:** **23 path** = 20 file sửa + 2 migration mới + 1 plan untracked. Phần implementation (không tính plan): `20 files changed, 902 insertions(+), 47 deletions(-)`; hai migration mới `20260919100000_d1_topic_authority_split.sql` (392 dòng) + `20260919120000_d1_topic_lifecycle_delete.sql` (343 dòng). Content fingerprint theo **byte** (23 entry, `git hash-object` từng file rồi băm danh sách) ⇒ `9cc03ca21b2fe98fedce81d3c9e855d7`, đo lại cuối lượt **khớp**.
- **Phases:** P11 → P13 → P14 → P15 → P16 → P17 → P18 đúng thứ tự dependency của v4 §9 (**P12 đã xoá, số không tái sử dụng**).
- **Verification tự chạy trong lượt này (exact commands + actual outcomes):** `npx.cmd tsc --noEmit --incremental false` ⇒ exit `0`; `npm.cmd run test:run` ⇒ `62 files / 533 tests` passed; `ALLOW_DB_INTEGRATION_TESTS=true npm.cmd run test:integration` ⇒ `16 files / 178 tests` passed; `git diff --check` ⇒ exit `0`; `npx.cmd supabase db reset --local --yes` ⇒ exit `0`, áp đủ hai migration mới rồi `Seeding data from supabase/seed.sql`. Mọi lệnh resolve về loopback; **không** `db push`, **không** `--linked`, **không** `supabase link`.
- **Review verdict: `BLOCKED(manual_qa_pending)` — `0 Critical / 0 Required`** (`docs/native-multi-agent/reviews/nma-d1-v4-correction/v4-implementation/d1v4-impl-r3-review-r1.md`). Round 0 trả `BLOCKING_FINDINGS` với **1 `Required`** (`F1` — chuỗi U6 verbatim thiếu, `grep` = 0 hit); correction round 1 đóng `F1` **thật** và `F3`/`F5`, không regression. **Lý do duy nhất** của `BLOCKED` là manual QA M17–M28 chưa chạy; **không** còn `Required`. Reviewer tự chạy lại `tsc`/unit/integration và 8 probe `psql` trong transaction có `rollback`. Artifact **ignored** (`.gitignore:20`), untracked, unstaged.
- **`F2` — nợ tầng reconcile, KHÔNG sửa ở candidate:** plan §5.6 viết `returns public.topics%rowtype`, **không hợp lệ** trong mệnh đề `RETURNS` (`%rowtype` chỉ là dạng khai báo `DECLARE` của PL/pgSQL) ⇒ `ERROR: syntax error at or near "rowtype" (SQLSTATE 42601)`. Migration dùng `returns public.topics` (composite type tương đương) kèm comment giải thích; `DECLARE` bên trong **giữ** `%rowtype` hợp lệ. **Đây là defect của plan, không phải của implementation** — 8 round review plan **không** bắt được vì không round nào **thực thi** SQL. Ghi nhận là deviation do Owner uỷ quyền, không tự vá contract.
- **`F7` — refute một câu của contract:** plan §3.13 khẳng định actor `previewer + contributor` **bất khả** (vì `add_topic_contributor` chặn `previewer`), và §7.3/A45 dựa vào đó để bỏ qua dòng này. Probe trong transaction `rollback` trên seed sạch **bác** câu đó: hạ `editor → previewer` **không** đóng hàng `topic_contributors` ⇒ `role=previewer` **và** `contributor_rows=1` cùng tồn tại. Rào `add_topic_contributor` chỉ chặn **đường thêm mới**, không chặn **đường hạ role**. Hành vi UI vẫn đúng §7.4 (dòng Contributor), nhưng câu *reachability* trong contract sai ⇒ `Suggestion`, thuộc tầng reconcile §3.13/§7.3.
- **Fixture v2 §11.3.1 đã READY — câu `NOT READY` là stale (mục thứ tám của chuỗi):** đo lại trên seed sạch sau reset ⇒ `courses=14`, `topics=14`, `users=6`, `topic_contributors active=1`, `course_collaborators flag=true=1`, **5/5** actor fixture có `encrypted_password` + email confirmed + không banned (mật khẩu `123123`). Năm actor: `admin@gmail.com` (`owner`, cờ `false`) · `teacher@gmail.com` (`co_owner`, cờ `false`, **responsible** của topic draft) · `editor@gmail.com` (`editor`, cờ `false`, **creator** của topic draft) · `previewer@gmail.com` (`previewer`, cờ `true`) · `contributor@gmail.com` (`editor`, cờ `false`, **contributor** của topic draft). Topic draft fixture `66666666-6666-4666-8666-666666666667` có 1 card + 1 exercise hoạt động. Reviewer round 1 vẫn ghi `NOT READY` (kế thừa v4 §10.4); **resolver của `BLOCKED` vì thế đổi**: không còn là "chờ dựng fixture" mà là "Owner chạy M17–M28 trên browser".
- **Điểm cần lưu khi chạy QA:** M22/M20/M21 cần một topic `pending` mà seed **không** có sẵn ⇒ phải submit trực tiếp trên browser (M22 trước, rồi M20, rồi submit lại cho M21). M24/M27 cần "creator bị hạ xuống `previewer`" — thao tác **live**, seed không dựng sẵn. M28 cần mời `co_owner` mới — thao tác **live**. Theo **F7**, dòng `previewer + contributor` **đạt tới được** (bằng hạ role) nên **không** được bỏ qua như §3.13 nói. `M23`/`M25` đã **XOÁ** theo D41, không chạy.
- **Residue:** integration suite để lại dữ liệu test (`courses=103`, `topics=108`); đã `db reset --local` về seed sạch sau đó. **Không** chạy lại integration/E2E sau reset cuối.
- **Ranh giới trạng thái:** pending manual QA **không** chặn local commit nhưng **chặn** merge readiness. Candidate **chưa** commit, chưa push, chưa có PR; **không** có claim merge-ready. Commit là authority **riêng**, chưa cấp.

### D1 canonical reconciliation và regression closure (2026-09-22)

- **Status-only reconciliation:** `plan.md` đã trở thành canonical D1 contract từ baseline v2 đã implement, amendment v4 đã implement, reconciliation cuối và implementation/test evidence hiện tại. `v4-implementation-reconciliation.md` ghi rõ những điểm implementation cuối supersede frozen v4; v2/v4 vẫn được giữ nguyên byte như historical artifacts, còn v3 vẫn deferred/chưa implement.
- **Reviewed documents:** canonical `plan.md` review `PASS`, hash `8fd072211db3bf4d60846a389e9ecdab41df1e16`; `v4-implementation-reconciliation.md` review `PASS`, hash `5b17bd557e64003ee384a0b0bb55138c727612a2`; frozen v4 hash vẫn là `9b136bf4f22ae7ae99b159e4f7186fe64fc31322`.
- **Correction sau frozen v4:** downgrade `co_owner/editor → previewer` là role-only, không resolve/transfer responsibility và giữ nguyên creator/responsible/contributor rows; resolver/transfer chỉ còn cho remove/leave. Topic Builder Settings dùng action riêng để hide/delete, revalidate các surface cần thiết và server-side redirect về Course Structure; delete từ Structure vẫn giữ hành vi tại trang hiện hữu.
- **Local implementation checkpoint:** `5607c24` (`fix(d1): complete topic authority and lifecycle corrections`) gồm D1 code, regression tests và bốn migration của v4/follow-up; không gồm canonical/reconciliation docs hoặc thay đổi ngoài D1.
- **Verification hiện tại:** focused component/action tests `43/43`, relevant Supabase integration tests `19/19`, TypeScript, targeted ESLint và `git diff --check` đều đạt. Owner đã manual QA đúng hai regression trên và báo cả hai `PASS`. Đây **không** phải claim đã chạy đủ M17–M28; verdict `BLOCKED(manual_qa_pending)` ở checkpoint 2026-09-19 vẫn là lịch sử đúng tại thời điểm đó, nhưng không còn mô tả trạng thái closure hiện tại của hai regression đã sửa và kiểm lại.
- **Ranh giới:** không mở D1 contract mới, không nhập v3, không reconcile D1 vào Q7/D2, không push/PR/merge/deploy/`db push`. Các commit local của closure được ghi ở Git history; tài liệu này không tự cấp remote authority.

### D1 delivery reconciliation (2026-09-23)

- `git fetch origin --prune` và `git pull --ff-only origin main` xác nhận `main = origin/main = d20296f4cca2bb504c9edf9124c46a0873c1bd17`; cây Git sạch trước lượt reconcile tài liệu. D1 branch head `d93385a` là ancestor của `main`, đi qua merge commit PR #98 `861e7c7`.
- Các câu `local-only`, `chưa push/PR/merge` trong checkpoint 2026-09-22 ở trên là lịch sử đúng tại thời điểm ghi, không phải status hiện hành. PR merge xác nhận delivery vào `main`, không xác nhận deploy, remote DB mutation hoặc full manual M17–M28.
- Canonical D1 detail plan vẫn là contract hành vi; v3 target-attached review-note creation UI deferred. Master plan đã được reconcile theo contract hiện hành, không mở lại P0-A–P4-A hoặc nhập Q7/D2.

| Hạng mục | Current repository truth | Disposition sau audit |
| --- | --- | --- |
| D1 — Topic authoring → review → publication | Foundation, authorship amendment, v2/v4 và follow-up đã merge qua PR #98 (`861e7c7`). | Giữ canonical detail plan cho invariant, v3 deferred và manual evidence đúng phạm vi; không mở lại handoff trước merge hoặc gộp Q7/D2/candidate revision. |
| Q7 — Internal previewer access correction | Independent correction review `PASS` tại `da59c69` (`0 Critical / 0 Required`); PR #101 head `00477f8` merge tại `65e8481`. Inventory, ba migration Q7, deployment đúng SHA và post-deploy checks đã hoàn tất trên production; xem mục rollout bên dưới. | Sau D1 và trước D2; giữ DB-wide relation/correctness invariants khác trong `LEARNING-INTEGRITY-001`. |
| D2 — Preview topic contract | `C1–C6` và các correction đã hoàn tất cục bộ; final independent review `PASS` tại `39feb3aa761dec4128d2b82e600ea1764649ebcb`. Chưa push/PR/merge/deploy. | [D2 detail plan](./implementation-plans/d2/plan.md) và [thiết kế](./implementation-plans/d2/design.md) giữ frozen contract; mốc review cuối và rollout boundary ở mục D2 bên dưới. |
| D3 — Memory check | Chưa có stage/action/field riêng; stage hiện chỉ `flashcard`/`exercise`, `part_type` là TOEIC part. | Standalone learning-stage PR; prerequisite D4, soft prerequisite D5. |
| D4 — Topic completion server truth | Completion hiện derive từ hai flags; question answer chưa tham gia completion. | Standalone progress/completion PR sau D3 và exercise-attempt semantics; tách `LEARNING-INTEGRITY-001`. |
| D5 — Question-category analytics | Chưa có category/skill field hoặc analytics query; không dùng `part_type` làm category. | Standalone analytics contract/data PR sau category/stage/format SSOT. |
| D6 — FSRS review route/deeper UX | Review đang ở `ReviewSheet`; chưa có `/learn/review`. | Tách route decision khỏi UX polish; không gộp scope. |
| D7 — Google OAuth hoặc hide fake CTA | Google buttons là static; auth actions chưa có OAuth/callback. | Standalone auth PR; Owner chọn hide/disable hoặc OAuth đầy đủ. |
| D8 — Profile/dashboard polish | `/profile` đã là account surface; learning dashboard ownership đã chuyển sang `/learn`. | Giữ các follow-up UI riêng (`STUDENT-003`/`STUDENT-004`), không mở cleanup tổng hợp. |
| D9 — Deeper payment history/dashboard | Current dashboard chỉ có pending-payment reminder; chưa có history contract/query. | Standalone payment PR sau product need và data boundary rõ. |

- Working execution order đã chốt ở mức program: D1 → Q7 → D2 → D3 → D4 → D5 → D6 → D7 → D8 → D9. Đây là thứ tự triển khai tuần tự để dễ đọc và điều phối, không khẳng định mọi mũi tên là hard dependency. Chi tiết dependency/gates thuộc [plan.md](./plan.md).
- D1 đã merge qua PR #98; Q7 đã merge và rollout theo bằng chứng bên dưới. D2 C1–C6 cùng các correction đã hoàn tất cục bộ và qua final independent review `PASS` tại `39feb3a`; chưa push/PR/merge/deploy. Trước rollout cần kiểm tra lại creator và managed-media inventory trên môi trường đích. D3 là candidate kế tiếp nhưng còn semantic decisions và authority riêng; D4–D5 tiếp tục chờ contract tương ứng, D6–D9 giữ deferred/open về detailed acceptance.
- Không kéo vào các PR này: phần relation/correctness integrity ngoài Q7 enrollment gate của `LEARNING-INTEGRITY-001`, `FUTURE-OWNERSHIP-001`, `AUTH-003`, `QUALITY-001`, `FEAT-001`/`FEAT-002`/`FEAT-003`, `STUDENT-005` và `NAVIGATION-001`.

### Q7 P0 — local contract freeze (2026-09-23)

- Local Supabase `voca_space` tại `127.0.0.1:45321` đã được kiểm tra; không reset hoặc mutate remote. Probe dưới `authenticated` role trong transaction `ROLLBACK` xác nhận previewer-only thấy active draft topic khi tạm bỏ review grant và phục hồi fixture draft đã soft-delete; cùng actor chưa enroll đã insert được `user_topic_progress` qua upsert statement. Đây là baseline SQL/RLS evidence, **chưa** chứng minh conflict-update path hay thay direct Data API integration test của P1/P2.
- Source/local inventory: upload route hiện trả public URL; `question_groups.audio_url|image_url` lưu URL đó; D1 persisted-object DELETE guard và Action cleanup parse public URL; authoring UI có URL/Upload mode; learner/teacher consumers render URL. Local DB hiện có `0` question-group media rows và `0` card media rows; kết quả này không chứng minh môi trường remote trống. P0 freeze canonical `storage://<bucket>/<path>` trong Q7 plan §4.4 trước khi sửa Storage/DTO/UI; known legacy managed public URL và external URL giữ classification riêng.
- P1–P3, media fixture/test, local reset và deployed-data preflight **chưa chạy**. Pre-deploy managed-media inventory/remediation cần authority riêng; không claim Q7 rollout complete.

### Q7 P1 — topic read và private managed media local checkpoint (2026-09-23)

- Candidate migration đổi topic/child SELECT sang topic-effective read, bọc hai D1 read RPC bằng cùng gate, chuyển hai question-group media buckets sang private và thêm authenticated Storage SELECT theo topic; D1 DELETE guard nhận canonical lẫn known legacy persisted reference. Upload mới lưu `storage://<bucket>/<path>`; GET theo group ID/type qua user-scoped RLS phục vụ ảnh/âm thanh, không nhận arbitrary object path, trả `private, no-store` và hỗ trợ audio Range. Authoring UI có browser-local preview trước khi lưu và note phân biệt external URL.
- Local `npx.cmd supabase db reset --local --yes` áp migration Q7 và seed thành công. Focused integration gồm media 21/21 + hai D1 files 54/54 = 75/75, chứng minh bucket private, public URL cũ bị từ chối, previewer-only draft/pending content/media/RPC bị từ chối, published topic được đọc, canonical/legacy persisted object không bị xóa trực tiếp và external URL được giữ nguyên. Focused media/learning-workspace Action, Route, Schema, Component 46/46 qua. TypeScript đạt; targeted ESLint 0 errors, 2 warnings có sẵn ở `AddExerciseDialog.tsx` ngoài diff Q7; `git diff --check` đạt.
- Self-review theo `docs/agent-self-review.md`: trace upload → canonical persisted value → private GET/Storage RLS, direct content/RPC read, D1 DELETE guard và legacy/external cases; không còn finding blocking trong P1. Manual browser QA và readiness/consumer closure thuộc P3, nên local P1 pass không phải toàn Q7 pass.
- Pre-deploy inventory procedure đã ghi ở Q7 plan §4.4; **chưa chạy trên môi trường đích**, không có quyền remote/deploy. Card media vẫn cần inventory môi trường đích: nếu có managed card media thì private delivery của card là stop gate trước rollout. P2 enrollment write và P3 readiness/consumer/manual QA còn nợ; đây không phải claim Q7 hoàn tất.

### Q7 P2 — learner-state enrollment gate local checkpoint (2026-09-23)

- Migration `20260923150243_q7_learning_target_enrollment.sql` thay đúng sáu `INSERT`/`UPDATE` policies của `user_topic_progress`, `user_question_answers`, `user_flashcards`; một helper private `SECURITY DEFINER` tra course qua topic/question/card target rồi tìm enrollment của `auth.uid()`. `UPDATE USING` bảo vệ target cũ và `WITH CHECK` bảo vệ target mới; `SELECT` self-owner giữ nguyên. Không thêm cột/index, không kéo relation-integrity rộng của `LEARNING-INTEGRITY-001` vào Q7.
- Ba Actions kiểm enrollment của actor sau khi resolve trusted target/parent course và trước mutation; không dùng collaborator/previewer role làm quyền ghi. Focused Action tests 14/14; real Data API integration 3/3 chứng minh previewer-only bị deny, previewer+enrollment và enrolled user với draft content bị RLS ẩn vẫn ghi được, other-user ID bị deny, target swap bị deny, conflict upsert và direct UPDATE sau revoke không đổi row, historical self SELECT còn hoạt động, private helper không exposed public RPC. Hai Q7 integration files chạy lại 24/24. TypeScript, targeted ESLint (`0` errors/warnings) và `git diff --check` đạt.
- `db reset --local --yes` áp P2 và canonical seed thành công. Ngay sau reset, Storage gateway local có upstream stale (`An invalid response was received from the upstream server`); restart **chỉ** `supabase_kong_voca_space` khôi phục `getBucket`, rồi hai Q7 integration files chạy lại đạt 24/24. Lỗi hạ tầng ban đầu không được tính là test pass. Không động tới remote/e2e instance. Self-review theo `docs/agent-self-review.md` không còn finding blocking trong P2; P3 và pre-deploy gate vẫn chưa đạt.

### Q7 P3 — consumer và local browser QA checkpoint (2026-09-23)

- `getCourseDashboardReadiness` trả safe `PREVIEWER_STRUCTURE_ONLY` sau course-local access check và trước khi đọc graph cho course role `previewer`, kể cả actor có D1 reviewer grant; graph RLS có thể chỉ là một phần nên không báo readiness sai. Overview dẫn tới Structure. Structure hiển thị nhãn thống kê “có thể xem”, giải thích phạm vi số liệu và không đặt breadcrumb quay lại Overview cho previewer; owner/editor vẫn giữ overview/readiness cũ. Builder vẫn dùng topic-scoped D1 capability, không khóa bằng course role trần.
- Automated: focused readiness/schema/route tests `66/66`; full Vitest `63 files / 553 tests`; targeted ESLint `0` errors/warnings; `npx.cmd tsc --noEmit --incremental false` đạt. Lệnh TypeScript mặc định vướng `TS5033 EPERM` khi ghi `tsconfig.tsbuildinfo`; đây là giới hạn ghi cache của môi trường, lượt không ghi cache đạt.
- Manual browser local qua Playwright CLI: previewer có reviewer grant thấy Structure gồm draft theo D1; khi bỏ grant trong fixture tạm, previewer-only thấy đúng một published topic, không mở được draft Builder, published Builder vẫn read-only. Overview hiện CTA Structure thay readiness; Structure gắn “có thể xem” cho số liệu một phần. Giáo viên mở draft Builder, thấy note phân biệt upload riêng tư và external URL, upload ảnh PNG thử nghiệm, thấy preview trước lưu và ảnh persisted sau lưu; authenticated GET cùng group trả `200` cho giáo viên và `404` cho previewer-only. Browser không kiểm audio trực quan; Range/audio được kiểm ở focused Route/Storage tests P1.
- Sau QA, đóng trình duyệt và dev server; chạy `npx.cmd supabase db reset --local --yes` trên project local `voca_space` thành công. Read-only sanity qua local Postgres trả reviewer seed `true`, group QA `0`, Storage object question-group `0`, và cả hai bucket private `true`. Không chạy test sinh residue sau reset; không động tới remote/e2e instance.
- Self-review theo `docs/agent-self-review.md` đạt ở thời điểm P3: truy đường access check → graph read → route CTA, partial Structure stats, Builder D1 capability và persisted media GET theo actor; kiểm tra diff không có thay đổi ngoài P3, `git diff --check` đạt. P3 đã commit `f39c49b`; independent review tiếp theo phát hiện legacy-origin DELETE guard và stale status docs cần correction riêng. Pre-deploy managed-media inventory/remediation ở môi trường đích vẫn là stop gate riêng, chưa được cấp authority. Local Q7 pass không đồng nghĩa rollout/deploy pass.

### Q7 independent implementation review — correction (2026-09-23)

- Reviewer độc lập `gpt-6-sol medium` review `03028a8..f39c49b` theo master plan + Q7 detail plan: `BLOCKING_FINDINGS`, `0 Critical / 2 Required`. Main tự xác minh cả hai là `CONFIRMED`: D1 DELETE guard cũ so pathname nên URL ngoài cùng path giữ nhầm object; master/progress ghi Q7/P3 chưa triển khai/chưa commit dù Git đã có `f39c49b`.
- Regression mới trên local schema cũ: Storage integration `21 passed / 1 failed`, ca external lookalike nhận `guard.data=false` thay vì `true`. Migration correction mới `20260923160456_q7_trusted_legacy_media_delete_guard.sql` so full legacy URL với origin suy từ `iss` của authenticated Supabase JWT; nếu issuer không có dạng được hỗ trợ thì fail closed. Local `db reset --local --yes` áp toàn bộ migrations thành công; Storage integration sau correction `22/22` đạt. Pre-deploy phải so issuer origin với configured Supabase origin của target nếu còn managed legacy URL; mismatch là stop gate, không suy đoán.
- Master plan/current progress đã được cập nhật đúng mức local implementation, không claim remote rollout. Correction self-review theo `docs/agent-self-review.md` đạt: SQL giữ nguyên lock/group/lifecycle/denied paths, chỉ thay pathname heuristic bằng full trusted-origin reference; regression đỏ trên baseline, xanh trên candidate, TypeScript/lint/`git diff --check` đạt. Reset local sau tests thành công; sanity trả integration-course `0`, question-group Storage object `0`, hai bucket private và migration correction đã áp. Phase 2 chỉ mở sau same-reviewer PASS và authority đúng cấp.

### Q7 delivery và production rollout (2026-09-24)

- Cùng reviewer độc lập `gpt-6-sol medium` đã kiểm lại correction tại `da59c69`: `PASS`, `0 Critical / 0 Required`. PR #101 head `00477f8` chỉ sửa assertion integration readiness đã stale; focused integration `6/6`, targeted ESLint và `git diff --check` đạt. GitHub Actions run `35891232109` tại head này: `Test and Build` và `production-gate` đều `SUCCESS`; Vercel preview và Vercel Preview Comments cũng `SUCCESS`. PR #101 merge vào `main` tại `65e8481f8aa3816486d9dce43ea1f96fcdeda2a4`.
- Pre-deploy inventory trên Supabase production `zmnfsorjuibfjowmjtxo`: `question_groups = 0`; `cards = 48` với `audio_url = 0`, `image_url = 0`; hai question-group media buckets có `0` object. Managed media cần remediation = `0`, nên remediation `N/A`; không có persisted media để thử legacy-object delivery thực tế. Trước apply, migration history remote khớp tới D1 và dry-run liệt kê đúng ba migration Q7.
- Sau apply, migration history remote khớp local gồm cả ba migration Q7. Kiểm tra production xác nhận hai media buckets đã private, public SELECT policies cũ bị bỏ, authenticated media SELECT policy và topic/child read gates hiện diện; sáu learner-state INSERT/UPDATE policies yêu cầu enrollment. Vercel production deployment `dpl_G46vQga4jMCocUYKc2kkv4GhD9uh` ở trạng thái `READY`, gắn đúng merge SHA `65e8481` và alias `vocaspace.vercel.app`.
- Post-deploy: HTTP smoke `/` và `/courses` trả `200` và không thấy server error; production DB/RLS checks xác nhận policy/role boundary. Các transaction QA có `ROLLBACK`; kiểm tra lại cho thấy reviewer grant gốc và không có enrollment/learning-state residue. Role, Server Action, Data API, Builder/readiness và private media delivery có bằng chứng local/CI ở các checkpoint trên; **không chạy lại browser đăng nhập hoặc toàn bộ matrix đó trên production**.
- Q7 được ghi `ROLLED OUT` trong đúng phạm vi bằng chứng trên. Advisory còn lại: audio chưa kiểm trực quan ở browser, external host URL nằm ngoài confidentiality guarantee và media đã tải/cache không thể thu hồi hồi tố; D2 public preview và phần relation/correctness integrity ngoài enrollment gate thuộc unit riêng.

### D2 C1 — chapter ownership và Structure local checkpoint (2026-09-24)

- Migration `20260924100000_d2_chapter_creator_authority.sql` thêm creator bất biến, gán legacy row theo thứ tự owner → co-owner → editor với UUID ổn định và dừng nếu thiếu ứng viên hợp lệ. RPC tạo chương ghi `auth.uid()`; RLS/RPC/Data API giới hạn editor vào chương do mình được gán, cấm editor reorder, giữ reorder cho owner/co-owner, và giữ D1 pending-child freeze. Hide/restore dùng đường tin cậy; restore nối cuối danh sách chương active. Migration không đổi authority của Q7 hoặc đường moderation D1.
- Server Action tính `canManage` theo membership hiện tại và bỏ creator UUID khỏi DTO UI. Structure chỉ hiện thao tác phù hợp theo role, ghi `Chương {position}` từ danh sách active, và có khu vực khôi phục chương bị ẩn. Seed cùng integration fixtures D1/Q7 được cập nhật để dùng actor hợp lệ. C1 chưa thêm marker, quota hoặc giao diện Preview.
- Local `npx.cmd supabase db reset --local --yes` áp toàn bộ migration và seed thành công. Lượt đầu bị chặn trước reset do Supabase CLI không ghi được telemetry trong sandbox; lần chạy được cấp quyền cho đúng thao tác local reset đã hoàn tất. Không đụng tới hosted DB.
- Automated evidence: `npm.cmd run test:run -- __tests__/actions/course-structure.test.ts __tests__/components/course-workspace-routes.test.tsx __tests__/components/topic-management-navigation.test.tsx __tests__/schemas/course-structure.test.ts` — 4 files / 86 tests passed. `ALLOW_DB_INTEGRATION_TESTS=true npm.cmd run test:integration -- __tests__/integration/card-rls.test.ts __tests__/integration/course-authoring-role-matrix.test.ts __tests__/integration/course-readiness.test.ts __tests__/integration/course-structure-ordering-rpc.test.ts __tests__/integration/exercise-authoring-rpc.test.ts __tests__/integration/public-course-read-model.test.ts __tests__/integration/question-group-media-storage.test.ts __tests__/integration/topic-authorship-boundary.test.ts __tests__/integration/topic-authorship-foundation.test.ts __tests__/integration/topic-group-content-boundary.test.ts __tests__/integration/topic-review-lifecycle.test.ts __tests__/integration/topic-review-notes.test.ts` — 12 files / 167 tests passed trên Supabase local. Lượt thử trước của public read-model CLI query bị telemetry `EPERM` trong sandbox; suite đó và lượt 12-file cuối đều đạt khi chạy với quyền local đã được cấp.
- Static checks: `npx.cmd tsc --noEmit --tsBuildInfoFile .tsbuildinfo.d2.tmp` — passed; file cache tạm đã xóa. Targeted ESLint — passed:
  ```powershell
  npm.cmd run lint -- __tests__/actions/course-structure.test.ts __tests__/components/course-workspace-routes.test.tsx __tests__/components/topic-management-navigation.test.tsx __tests__/integration/card-rls.test.ts __tests__/integration/course-authoring-role-matrix.test.ts __tests__/integration/course-readiness.test.ts __tests__/integration/course-structure-ordering-rpc.test.ts __tests__/integration/exercise-authoring-rpc.test.ts __tests__/integration/public-course-read-model.test.ts __tests__/integration/question-group-media-storage.test.ts __tests__/integration/topic-authorship-boundary.test.ts __tests__/integration/topic-authorship-foundation.test.ts __tests__/integration/topic-group-content-boundary.test.ts __tests__/integration/topic-review-lifecycle.test.ts __tests__/integration/topic-review-notes.test.ts 'app/(teacher)/teacher/courses/[id]/_components/ChapterList.tsx' 'app/(teacher)/teacher/courses/[id]/_components/CourseStructureWorkspace.tsx' 'app/(teacher)/teacher/courses/[id]/_components/types.ts' app/actions/chapter.ts lib/schemas/chapter.ts types/database.ts
  ```
- `git diff --check` — passed, có cảnh báo chuyển LF sang CRLF từ Git nhưng không có whitespace error. Self-review theo `docs/agent-self-review.md` đạt `PASS` trên plan/design, migration/RLS/RPC, Action DTO, UI role matrix, seed và test evidence.
- Manual browser QA chưa chạy; thuộc integrated acceptance C6. C2–C6 chưa được xác minh, do đó C1 pass không phải D2 acceptance hoặc rollout pass. Trước rollout vẫn cần đối chiếu lại inventory creator và managed media trên môi trường đích theo D2 plan.

### D2 C2 — preview quota và lifecycle local checkpoint (2026-09-24)

- Migration `20260924110000_d2_preview_quota_lifecycle.sql` thêm `topics.is_preview`, giữ cột ngoài direct Data API read/write, và áp quota `ceil(A/5)` trên các topic cùng chapter còn active, bất kể status. Các mutation marker serialize theo khóa course; trigger/RPC giữ invariant trước các thay đổi denominator. Private cause table gắn over-cap recovery với đúng moderation audit; cùng episode giữ nguyên cause đầu tiên, cause bị xoá khi allocation hợp lệ.
- Topic soft-delete, chapter hide/restore và moderation topic/chapter/course dọn marker theo target contract; chapter hide yêu cầu chọn rõ ràng marker ngoài chương khi cần, giữ D1 pending freeze, và trả projection để Action có thể yêu cầu xác nhận lại khi selection/quota stale. Topic restore vẫn draft/unmarked. Chapter/topic Actions, Zod schemas và các integration fixtures dùng RPC lifecycle mới; topic safe-read chọn explicit cột, không đọc marker.
- `npx.cmd supabase db reset --local --yes` — thành công trên Supabase local, áp toàn bộ migrations và seed; không đụng hosted DB.
- `ALLOW_DB_INTEGRATION_TESTS=true npx.cmd vitest run --config vitest.integration.config.ts --reporter=dot` — 18 files / 204 tests passed trên Supabase local, gồm 15 test quota/lifecycle D2 và regression D1/Q7 liên quan. Các ca D2 có cap 0/1/5/6, pending normal hide và pending moderation cancellation/takedown, delete/restore/re-mark, target-only cleanup, stale projection, batch/concurrent mutation và cả hai kiểu recovery.
- `npm.cmd run test:run -- __tests__/schemas/course-preview.test.ts __tests__/actions/course-preview.test.ts __tests__/actions/course-structure.test.ts` — 3 files / 33 tests passed.
- `npm.cmd run test:run` — 65 files / 564 tests passed.
- `npx.cmd tsc --noEmit --tsBuildInfoFile .tsbuildinfo.d2.tmp` — passed; cache tạm đã xoá. Targeted ESLint trên các Actions, schemas và D2/D1/Q7 tests — passed. `git diff --check` — passed; Git có cảnh báo chuyển LF sang CRLF, không có whitespace error.
- Self-review đối chiếu D2 plan/design §§4, 6–8 với SQL/RLS/RPC, Action error refresh, schema invariants, regression fixtures và exact cause privacy; không còn finding blocking trong C2. Manual browser QA, public preview read path và UI chưa chạy/triển khai; chúng thuộc C3–C6, nên C2 không phải D2 acceptance hoặc rollout.

### D2 C3 — teacher Preview management local checkpoint (2026-09-24)

- Structure có allocation panel, batch recovery và marker toggle theo topic; Builder Settings có cùng quota và marker hiện tại. Overview/Structure chỉ tải recovery warning cho owner/co-owner/editor; previewer không gọi allocation read hoặc thấy cause kiểm duyệt. Bài học draft/pending vẫn được giải thích là tính quota nhưng chưa công khai. Tạo bài học mới và khôi phục chương refresh allocation để cập nhật cả recovery warning khi mẫu số tăng.
- Ẩn chương/topic tải projection trước khi xác nhận. Dialog phân biệt marker nội bộ tự gỡ với marker ngoài mục cần chọn tường minh; nếu actor thiếu marker authority thì chặn mutation và đưa hướng handoff. D1 freeze của chương pending chặn trước xác nhận; pending topic delete vẫn đi qua quy trình hủy review hiện có. Stale projection giữ lựa chọn còn hợp lệ và yêu cầu xác nhận lại; hủy không mutation. Dialog có focus ban đầu ở tiêu đề và chuyển focus tới lựa chọn đầu tiên khi cần resolution. Không thay đổi migration/DB trong C3.
- `npm.cmd run test:run -- __tests__/components/course-preview-controls.test.tsx __tests__/components/course-workspace-routes.test.tsx __tests__/components/topic-settings-navigation.test.tsx __tests__/components/topic-management-navigation.test.tsx __tests__/components/topic-workflow-panel.test.tsx` — 5 files / 82 tests passed; gồm role privacy, quota, batch selection, internal cleanup, cancellation, handoff, stale projection và pending chapter freeze.
- `npx.cmd tsc --noEmit --tsBuildInfoFile .tsbuildinfo.d2.tmp` — passed; cache tạm đã xoá. Targeted ESLint cho 15 file C3 (5 test và 10 component) — passed. `git diff --check` — passed; Git chỉ cảnh báo LF sẽ chuyển CRLF, không có whitespace error.
- Self-review theo `docs/agent-self-review.md`, đối chiếu D2 plan C3/design §§2, 3, 5, 6 và exact current diff: quyền đọc cause không vượt role, không mutation trước confirm, target marker cleanup tách khỏi unmark ngoài mục, lỗi/stale không hạ điều kiện quota, D1 pending freeze giữ nguyên. Verdict `PASS`, không còn finding blocking trong phạm vi C3. Manual browser QA cho mobile, keyboard/focus, dialog scrolling và Structure responsive order được dành cho integrated matrix C6; C3 không phải D2 acceptance hoặc rollout.

### D2 C4 — guarded public service local checkpoint (2026-09-24)

- Migration `20260924120000_d2_guarded_public_preview_service.sql` mở rộng public detail bằng hai cờ an toàn từ marker/quota persisted; tạo service-role-only RPC cho nội dung whitelist, stateless answer và resolve media theo persisted question-group. Server Actions validate slug/UUID và DTO strict, không gọi persistent learning Actions; route media xác minh group, eligibility, stored reference và course/topic path trước khi tải object private, hỗ trợ byte Range và `private, no-store`. Q7 route, bucket policy và enrollment/payment/Continue Learning paths không đổi.
- Nội dung ban đầu bỏ đáp án đúng/explanation của quiz; answer chỉ trả qua RPC riêng sau kiểm tra parent chain. Integration chứng minh cả guest lẫn enrolled actor đọc được Preview, anon/authenticated không thể gọi privileged RPC hoặc đọc thẳng private object, revoke/takedown/removed parent/over-cap đóng read-answer-media ở request kế tiếp, cross-parent option bị từ chối và ba bảng learner-state của enrolled actor không đổi. Race read/mutation có thể được serialize trước hoặc sau commit; request mới sau commit thấy trạng thái mới.
- C4 giữ media card ngoài tuyến private: trong **local inventory** có 174 card và 0 managed question-group private-storage reference ở card; không tìm thấy card-media writer cần một route theo persisted parent. Action không trả known private question-group reference từ card. Đây không phải inventory của production; môi trường đích vẫn cần preflight trước rollout theo D2 plan.
- `npx.cmd supabase db reset --local --yes` — đạt, áp toàn bộ migration/seed trên Supabase local. `$env:ALLOW_DB_INTEGRATION_TESTS='true'; npm.cmd run test:integration -- __tests__/integration/public-course-preview-service.test.ts __tests__/integration/public-course-read-model.test.ts __tests__/integration/question-group-media-storage.test.ts` — 3 files / 37 tests đạt, gồm media image, audio Range, direct Storage denial, stateless answer, zero learning-state delta và Q7 regression. `npm.cmd run test:run -- __tests__/actions/question-group-media-read.test.ts __tests__/actions/public-course-preview.test.ts __tests__/schemas/public-course-preview.test.ts __tests__/schemas/public-course.test.ts __tests__/actions/public-course.test.ts __tests__/components/public-course-detail.test.tsx` — 6 files / 59 tests đạt. `npx.cmd tsc --noEmit --tsBuildInfoFile .tsbuildinfo.d2.tmp` — đạt; cache tạm đã xoá. Targeted ESLint — đạt, 0 warning/error. `git diff --check` — đạt; Git chỉ báo LF sẽ chuyển CRLF. Browser/manual QA của trải nghiệm Preview thuộc C5/C6 và chưa được claim ở C4.
- Self-review theo `docs/agent-self-review.md` đối chiếu D2 plan C4/design §§3–5 và D1/Q7 media contracts: mọi request public được gate lại, answer không xuất hiện trong initial DTO, parent chain ràng buộc question-option, media chỉ lấy object reference đã lưu và Q7 route giữ nguyên. Verdict `PASS`, không còn finding blocking trong C4. Chỉ local DB được reset; không có thao tác hosted/remote.
- Correction review trước C5 phát hiện và đóng một URL edge: Action nay loại mọi `storage://` reference và mọi Supabase Storage object URL khỏi card media khi chưa có route theo persisted card parent; `npm.cmd run test:run -- __tests__/actions/public-course-preview.test.ts` đạt 1 file / 8 tests, xác nhận signed URL/token không lọt vào DTO. TypeScript, targeted ESLint trên Action/test và `git diff --check` đạt. Đây chỉ siết fail-closed ở payload public, không đổi media route, schema hay dữ liệu.

### D2 C5 — public Preview experience local checkpoint (2026-09-24)

- Syllabus giờ liên kết đúng topic persisted `is_preview` qua `/courses/[course-slug]/preview/[topic-slug]`; khóa over-cap ẩn mọi link và chỉ hiện một thông báo chung, không lộ quota/moderation. Public course detail, enrollment/payment CTA và đường học hiện có giữ nguyên.
- Trang Preview đọc lại nội dung bằng C4 no-store Action; hiển thị flashcard, media group, câu hỏi và lựa chọn. `FlashcardStage` chỉ nhận callback cục bộ (Lại/Khó xếp cuối hàng, Ổn/Dễ bỏ khỏi hàng); quiz gọi stateless answer Action riêng. Error giữ lựa chọn để thử lại; response unavailable từ answer hoặc sau khi guarded media lỗi sẽ xóa nội dung đang hiển thị. Cuối lượt mới hiện `Tiếp tục học`, và chỉ khi public detail Action xác nhận actor đã enroll; CTA dùng lại `getFirstTopicSlugByCourseSlug`. Không gọi `submitCardReview`, `updateStageProgress` hoặc `submitQuestionAnswer`.
- `npm.cmd run test:run -- __tests__/components/public-course-detail.test.tsx __tests__/components/public-course-preview.test.tsx __tests__/utils/public-course-routes.test.ts __tests__/actions/public-course-preview.test.ts --reporter=dot` — 4 files / 35 tests đạt, gồm syllabus gating, queue local, correct/error/unavailable/pending, revalidation khi media route lỗi và enrolled-only continuation. `npx.cmd tsc --noEmit --tsBuildInfoFile .tsbuildinfo.c5.tmp` — đạt; cache tạm đã xoá. Targeted ESLint trên 10 file C5 cùng Preview Action regression surface — đạt, 0 warning/error. `git diff --check` — đạt, chỉ có cảnh báo LF→CRLF.
- Self-review theo `docs/agent-self-review.md` và D2 plan C5/design §§4–5: persisted eligibility quyết định link, fresh read/answer/media giữ C4 gate, unavailable response unmount protected content, client state không ghi learner rows và continuation CTA không đổi Preview sang learning trước khi actor chọn. Verdict `PASS`, không còn finding blocking trong C5. Browser/manual QA được gộp vào một lượt integrated C6 để dùng cùng fixture và không lặp một lượt browser trên UI chưa đổi; C5 automated evidence không được trình bày như full browser QA. Chưa có DB/schema/migration change, hosted access hoặc remote action.

### D2 C6 — integrated acceptance local checkpoint (2026-09-24)

- Thêm regression episode đúng `A=21/M=5/cap=5 → A=20/M=5/cap=4 → A=21/M=5/cap=5`; moderation audit giữ causal pointer khi over-cap, valid draft/topic restore không đổi năm marker và xóa pointer khi quota hợp lệ.
- Integration chạy trên Supabase local chính:
  ```powershell
  $env:ALLOW_DB_INTEGRATION_TESTS='true'; npm.cmd run test:integration -- __tests__/integration/course-authoring-role-matrix.test.ts __tests__/integration/course-structure-ordering-rpc.test.ts __tests__/integration/course-preview-quota.test.ts __tests__/integration/topic-authorship-boundary.test.ts __tests__/integration/topic-review-lifecycle.test.ts __tests__/integration/public-course-read-model.test.ts __tests__/integration/public-course-preview-service.test.ts __tests__/integration/question-group-media-storage.test.ts
  ```
  — 8 files / 137 tests đạt, gồm quyền owner/co-owner/editor, pending freeze/cancellation, quota/cause recovery, public read/answer/media và Q7 regression. Quota suite cũng xác nhận chapter restore từng bước giữ nguyên cause và suspension tại `A=15/M=5/cap=3`, `A=20/M=5/cap=4`, rồi xóa pointer khi tới `A=21/M=5/cap=5`.
- `npm.cmd run test:e2e -- e2e/d2/public-course-preview.spec.ts` — 1 scenario đạt trên runtime Supabase E2E cô lập do runner dựng/reset. Browser xác nhận guest và enrolled Preview, ảnh riêng tư, hàng đợi card, quiz bằng bàn phím, không đổi `user_flashcards`/`user_question_answers`/`user_topic_progress`, focus/Escape khi hủy ẩn bài, takedown moderation `A20/M5/cap4` với public notice chung và teacher reason khớp audit, rồi tạo draft không đánh dấu qua Structure để phục hồi `A21/M5/cap5`, xóa warning/pointer và mở lại read/answer/media. Kiểm tra tràn ngang đạt ở 320/375/768/1280 px.
- Browser QA phát hiện hai vấn đề trong chính lượt chấp nhận và đã sửa trong scope: hai nút `w-full shrink-0` tràn ở 768 px được chuyển sang bề rộng theo nội dung trong dải 640–1023 px; E2E chờ URL Structure sai khi luồng tạo topic điều hướng sang `/teacher/courses/[id]/topics/[topicId]`. Fixture upload media chuyển sang `Blob` như integration helper để kiểm tra đúng private-media path.
- `npx.cmd tsc --noEmit --tsBuildInfoFile .tsbuildinfo.c6.tmp` — đạt. `npx.cmd eslint --no-cache '__tests__/integration/course-preview-quota.test.ts' 'app/(teacher)/teacher/courses/[id]/_components/CourseOverview.tsx' 'e2e/d2/public-course-preview.spec.ts' 'e2e/support/d2-preview-fixture.ts'` — đạt, 0 warning/error. `git diff --check` — đạt; Git chỉ báo LF sẽ chuyển CRLF, không có whitespace error.
- Đã thử `npx.cmd supabase db reset --local --yes` để dọn Supabase local chính sau các kiểm tra residue-producing. Auto-review từ chối destructive reset vì chưa có ủy quyền trực tiếp cho thao tác trên đúng instance; không retry hoặc dùng workaround. Reset không chạy nên không có post-reset sanity. Read-only sanity sau test cho thấy `D2 preview course` fixtures = 0, `D2 browser Preview` fixtures = 0, D2 private storage objects = 0 và cause pointers = 0. Còn một audit do regression quota tạo: ID `2e0c8c9a-1ac5-43d1-8bd3-e6ee24501a90`, target topic `a63a8287-3973-48ff-80c4-23a3eeb79de0`, reason `D2 exact denominator recovery 1c5dfe2e-45db-42be-9234-55c04a35395e`, thời điểm `2026-09-24 14:50:03.358812+00`. Không xóa row này. Fixture cleanup của E2E đạt; runtime Supabase E2E cô lập đã được dừng và cache/screenshot tạm đã xóa.
- Browser verification là Playwright automation; không claim lượt manual QA độc lập. Self-review tích lũy cuối trên toàn diff D2 từ baseline `805039321333575b490630d976fdc554c106393d` qua C6, đối chiếu plan/design, D1/Q7, authority, quota/cause recovery, public privacy, learner-state delta và responsive/browser evidence: `FINAL SELF-REVIEW PASS`, không còn finding blocking cục bộ.
- Chưa xác minh/không thực hiện production creator hoặc managed-media inventory, hosted mutation, push, PR, CI, merge hay deployment. D2 local acceptance không thay preflight môi trường đích hoặc rollout gate.

### D2 independent Sol findings — correction review (2026-09-25)

- Đã đối chiếu lại năm finding bắt buộc với [D2 plan](./implementation-plans/d2/plan.md) và [design](./implementation-plans/d2/design.md) đã chốt; không thay đổi hành vi sản phẩm hay semantics của migration.
- **C1 — CONFIRMED:** fixture tích hợp trước đây chỉ tạo chapter sau migration. Thêm `test:supabase:d2-chapter-creator-upgrade`: tạo legacy rows trước rồi chạy migration C1 thật trên scratch project cô lập. Test xác nhận thứ tự `owner → co-owner → editor`, tie-break editor theo UUID nhỏ nhất, và rollback với `D2_CHAPTER_CREATOR_BACKFILL_NO_CANDIDATE`; không tác động DB local chính.
- **C2 quota race — CONFIRMED:** concurrency test cũ bắt đầu khi còn hơn một slot. Test mới bắt đầu ở `M=cap-1`; hai RPC thật chạy đồng thời cho đúng một request thành công và một request `PREVIEW_QUOTA_RESOLUTION_REQUIRED`, cuối cùng `M=cap` và chỉ một target tranh chấp được mark.
- **C3 moderation branches — PARTIALLY CONFIRMED:** lifecycle thông thường đã có coverage, nhưng target đã xóa và còn marker chưa được kiểm tra với quota/cause. Thêm case `demote` và `invalidate_review`, xác nhận topic/review state, `A`/`M`/cap, causal audit pointer, và retry sai state không để lại đổi trạng thái hoặc audit, theo plan §7.
- **C4 guarded read assertion — PARTIALLY CONFIRMED:** race assertion chấp nhận mọi kết quả null/object, dù các check tuần tự gần đó đã kiểm tra denial sau commit. Thay bằng revocation UPDATE có `await`, trả về và xác nhận `is_preview=false`, rồi mới chạy read, answer, media request mới; cả ba đều bị từ chối. Sửa metadata test header ghi sai “not run”; real Server Action assertions vốn đã nằm trong candidate C4 và được tính trong lần chạy 3 file / 37 test.
- **C6 enrolled Preview — CONFIRMED:** snapshot cũ chỉ lấy ID và learner state bắt đầu rỗng. Fixture nay seed hai FSRS flashcard rows, một answer sai đã lưu và topic progress một phần cho learner đã enroll. E2E xác nhận cả ba tập baseline không rỗng, rồi so sánh mọi cột của toàn bộ hàng fixture liên quan trước/sau Preview.
- **Advisory — CONFIRMED:** C4 header nói sai rằng real Server Action assertions chưa được chạy; metadata đã được sửa theo checkpoint C4 và lần rerun correction.
- Verification tập trung và hồi quy: `npm.cmd run test:supabase:d2-chapter-creator-upgrade` — cả nhánh upgrade lẫn rollback khi thiếu candidate đều đạt trên project cô lập; `$env:ALLOW_DB_INTEGRATION_TESTS='true'; npm.cmd run test:integration -- __tests__/integration/course-preview-quota.test.ts --reporter=dot` — 1 file / 19 test đạt; `$env:ALLOW_DB_INTEGRATION_TESTS='true'; npm.cmd run test:integration -- __tests__/integration/public-course-preview-service.test.ts __tests__/integration/public-course-read-model.test.ts __tests__/integration/question-group-media-storage.test.ts --reporter=dot` — 3 file / 37 test đạt; `npm.cmd run test:e2e -- e2e/d2/public-course-preview.spec.ts --timeout=120000` — 1 browser scenario đạt trong 52.2s. Lượt browser đầu hết timeout cấu hình 60s ở cuối scenario; rerun với timeout 120s đạt. Lượt integration 3 file đầu tiên trong sandbox đạt 34/37 vì ba câu lệnh Supabase CLI chỉ đọc bị chặn khi ghi file telemetry; chạy lại cùng suite với quyền truy cập CLI cục bộ đạt 37/37.
- ESLint có mục tiêu, `tsc --noEmit` và `git diff --check` đều đạt. Correction chỉ đổi test, runner C1 cô lập và evidence log; không sửa product code hoặc migration. E2E chỉ reset rồi dừng `.e2e-runtime`; C1 chỉ dùng rồi xóa scratch project riêng. DB local chính `voca_space` không bị reset; không truy cập hosted/production.
- Ngày 2026-09-25, xác nhận `supabase/config.toml` trỏ tới `voca_space`, CLI status chỉ trả loopback `127.0.0.1:45321/45322`. Audit UUID được Owner cho phép xử lý `2e0c8c9a-1ac5-43d1-8bd3-e6ee24501a90` đã vắng mặt ở cả preflight lẫn final read-only SELECT sau toàn bộ test DB correction; vì vậy không gửi DELETE. Không có DB operation nào sau sanity check cuối.
- Cumulative self-review trên toàn correction diff và D2 plan/design không thấy xung đột semantics; không có production-code change và mọi Required findings đã đóng. Browser evidence là Playwright automation, không phải manual QA độc lập. Không push, tạo/cập nhật PR, chạy CI, merge, mutate hosted DB hoặc deploy.

### D2 final independent review và local delivery reconciliation (2026-09-25)

- Sau các checkpoint C1–C6, commit `a7f8949` bổ sung bằng chứng deterministic cho khóa course/quota và thứ tự request so với marker revocation đang trong transaction. UI integration `1eb938d` được rà soát độc lập; review ghi 5 Required và 2 Advisory. Correction `0609c61` đóng các lỗi validation, keyboard/focus, reorder feedback, deletion copy và kết thúc Preview sau câu trả lời sai. Finding Required còn lại là tràn ngang 320px ở Structure; correction cuối `39feb3aa761dec4128d2b82e600ea1764649ebcb` xếp lại action buttons, giữ heading Topic Management và thêm 320px vào E2E ba trạng thái xóa chương.
- Final independent rereview tại đúng HEAD `39feb3aa761dec4128d2b82e600ea1764649ebcb`: **PASS**, 0 Required còn mở và không phát hiện regression trực tiếp từ correction cuối. Reviewer chạy `npm.cmd run test:e2e -- e2e/d2/public-course-preview.spec.ts --timeout=120000` trên Supabase E2E cô lập: **3/3 scenario đạt**. Kịch bản hiện hữu qua 320/375/768/1280px, gồm Topic Management 320px; kịch bản ba trạng thái xóa chương qua 320/375/1280px; browser evidence là Playwright automation, không phải manual QA độc lập. `npx.cmd tsc --noEmit --incremental false` và `git diff --check` cũng đạt tại HEAD này. Focused component tests 5 file / 30 test đạt ở correction `0609c61`, trước correction responsive cuối.
- Review local không xác nhận production inventory, CI/PR, remote DB migration hay deployment. Tại audit này branch D2 không có upstream được cấu hình và không có evidence D2 đã push/PR-update/merge/deploy; creator và managed-media inventory trên môi trường đích vẫn là pre-rollout gate. D3 là candidate kế tiếp theo working order, chưa được plan hoặc cấp implementation authority bởi D2 PASS.

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
