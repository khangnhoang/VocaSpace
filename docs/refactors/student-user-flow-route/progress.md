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
| PR D1: Topic authoring → review → publication (`FUTURE-PUBLISH-001`) | Local implementation P0–P4 và fresh-reader corrections đã đạt; chưa push | C2 PR #96 đã merge | `feat/topic-publish-validation`; local-only implementation; latest correction chain `2987794`, `301d0e1`, `e6c4d0e`, `d0d53df`, `0b27b85` | 2026-09-16 | P0 foundation, P1 trusted lifecycle boundary, P2 content mutation safety, P3 workflow UX, P4 closure và các correction findings đã được xử lý local. D1 vẫn sở hữu readiness, review lifecycle, pending freeze, reviewer capability, singular-owner invariant, separate admin moderation boundary và interim published-edit demotion; browser/fixture/service-role và repository-wide lint residual vẫn được ghi rõ. |
| Wave D: Later backlog | Đang chuẩn bị | Stable route/dashboard/workspace contracts | Audit backlog và Owner decision reconciliation hoàn tất; working execution order được ghi trong [plan.md](./plan.md) | 2026-09-15 | Chưa có Wave D implementation commit; order D1 → Q7 → D2 → D3 → D4 → D5 → D6 → D7 → D8 → D9; D6–D9 deferred/open về detailed acceptance. |

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

- Trạng thái: Detailed plan đã hoàn tất; P0 foundation, P1 trusted lifecycle boundary, P2 content mutation safety, P3 workflow UX và P4 closure đã đạt local checkpoint trên `feat/topic-publish-validation`; correction units sau fresh-reader đã commit local `143102e`, `c56f3aa`, `65ed00d`, `6180356`, `43c8fcd`, `2987794`, `301d0e1`, `e6c4d0e`, `d0d53df`, `0b27b85`; chưa push.
- Detailed plan: [implementation-plans/d1/plan.md](./implementation-plans/d1/plan.md); Owner request hiện tại là decision source, không có owner-review brief riêng.
- Dependency: C2 PR #96 đã merge; baseline hiện tại để lập kế hoạch là `origin/main @ 5f43c65f4de2638dcbb6a0994826693d61971999` và route/dashboard/workspace contract liên quan đã ổn định theo evidence hiện tại.
- Owner contract: topic mới luôn `draft` và create đi thẳng vào builder; chỉ request review khi có ít nhất một active flashcard và một active exercise; request review không tự publish; submit → `pending` frozen; reviewer hợp lệ approve → `published`; reject cần reason → `draft`; self-review bị cấm.
- Authority contract: global roles `student|teacher|admin` độc lập với course roles `owner|co_owner|editor|previewer`; normal course creation chỉ global `teacher` và creator thành `owner`; local authoring derive từ membership, nên admin/student collaborator không bị global role suppress; previewer read-only. Admin không membership giữ moderation/maintenance, không normal-author/review.
- Reviewer contract: `owner`/`co_owner` có implicit review permission; `editor`/`previewer` cần `course_collaborators.can_review_topics = true`; global `admin` role alone không có review authority; effective permission kiểm tra tại mutation time; collaborator transition không được bỏ reviewer hợp lệ cuối cùng của pending submission.
- Escalation contract: rejection counter scope `topic + submitted_by`; sau reject lần thứ ba topic về `draft`, escalation unresolved, submitter bị giữ request review topic đó và tạo topic mới trong course; không global account lock. Owner/co_owner là actor `B` khởi tạo rescue, reviewer distinct `C` approve linked submission và là actor được ghi ở `resolved_by_user_id`; close/abandon do owner/co_owner thực hiện, tất cả đều có audit để giải phóng hold.
- Admin authority contract: global admin giữ moderation/maintenance authority tách biệt để demote/takedown hoặc invalidate pending review có mandatory moderation audit; không tăng rejection budget, không approve/reject và không direct-publish. Pending freeze không chặn moderation exception nhưng cấm partial pending edit.
- Published-topic interim contract: trước candidate revision system, content edit cần cảnh báo + explicit confirm và mutation cùng demotion về `draft` trong atomic boundary; published soft-delete cũng demote + soft-delete atomically; restore là active draft; pending delete/restore bị block; cancel không đổi state, không silent demotion.
- Discovery đã xác nhận: `updateTopic` chưa kiểm tra readiness; `createTopic` truyền status vào `create_topic_ordered`; readiness hiện chỉ báo `topic_has_no_learning_content` khi thiếu đồng thời cả flashcard và exercise; pending/review/rejection/capability topic chưa có storage/action contract; content writes chưa khóa pending/published semantics.
- Supplemental discovery đã xác nhận: create modal vẫn cho chọn status và chưa bắt buộc navigate vào builder; `TopicBuilderTabs` chỉ sở hữu tab/URL issue state, chưa sở hữu lifecycle/readiness; flashcard/exercise child writes có nhiều action/RPC; current RLS/direct Data API cho phép management caller cập nhật topic status và content không qua readiness/review boundary; chưa có DB invariant hoặc concurrency boundary tương ứng.
- Supplemental authority discovery đã xác nhận: `create_course_with_owner` và course INSERT policy hiện cho admin/teacher; middleware chỉ guard authentication; header chỉ link `Khóa học của tôi` cho teacher/admin; `has_course_management_access` yêu cầu global teacher hoặc admin dù membership role đã đủ để suy ra local authoring; media upload/storage còn gate teacher/admin; không có DB constraint buộc collaborator là teacher.
- Kết luận planning: D1 là cross-layer teacher/content workflow, không còn là standalone publish flag validation. Detailed plan phải bao phủ global-teacher-only course creation, membership-derived authoring across global roles, application, DB/RPC/RLS/direct write, lifecycle, delete/restore, collaborator capability, riêng moderation boundary và atomicity; không triển khai candidate revision system, Q7, preview, course publication, memory, completion hoặc exercise correctness.

- Correction bổ sung (2026-09-16): ảnh Owner cung cấp khớp với canonical seed cũ, trong đó `Local TOEIC Test Course` có hai membership `owner`; đây là seed defect và database invariant gap thực tế. Migration `20260916110000_d1_single_course_owner.sql` thêm duplicate preflight fail-closed và partial unique owner index; seed dùng `co_owner` cho membership đặc quyền thứ hai. Supported create RPC vẫn là lower-bound boundary tạo đúng một owner; invitation và normal role RPC không tạo owner. Collaborator role controls được chuyển sang shared `Select` primitive mà không đổi semantics.

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

### D1 checkpoint P4 — Closure

- Kết quả: PASS local sau fresh-reader verification, correction và self-review; correction commit mới nhất `0b27b85` đã đóng singular-owner invariant và collaborator role-control polish; chưa push.
- Correction đã đóng: profile role escalation bị chặn ở grant/RLS; ordinary approval không thể resolve rescue escalation; rescue giữ identity `A/B/C` với attribution B/C rõ ràng; request review chặn sole-owner không có reviewer khác; Builder refresh parent readiness sau mọi card/exercise mutation thành công; invitation lifecycle tối thiểu đã có persistence, cap reservation và invitee discoverability; authenticated self-delete profile và admin self-target bị chặn; role promotion/downgrade enforce fixed cap và pending reservation dưới course lock; canonical seed không còn tạo hai owner, DB partial unique guard chặn owner thứ hai, supported create vẫn tạo đúng một owner và collaborator role controls dùng shared Select.
- Admin boundary: moderation topic takedown/cancel escalation cancel pending/rescue đúng boundary, resolve escalation với action `moderation`, ghi audit riêng và không tăng rejection counter/budget; global admin không có review/publication authority nếu không có membership/capability.
- Fresh-reader findings đã verify độc lập và confirmed: D1-SEC-001 do invite RPC resolve bằng mutable `profiles.email`; D1-AUTH-002 do thumbnail Storage policy lệch với course-local DB authoring và upload đứng trước authoritative create; D1-UX-003 do invite DTO/UI thiếu course identity và accept không refresh parent course list. Corrections tương ứng dùng `auth.users` resolver + invitee-only course identity RPC, create/course-scoped thumbnail paths với preflight/policy/cleanup, và parent `fetchMyCourses` callback sau accept.
- Verification sau correction: full Vitest `52 files / 453 tests` passed; full integration run đạt `119/121`, hai test dùng `supabase db query` bị lỗi sandbox EPERM khi CLI ghi telemetry và không phải product assertion failure; focused invitation integration `1 file / 8 tests`, course creation/Storage integration `1 file / 9 tests`, action + collaborator UI unit `2 files / 18 tests` passed; migration/index read-only probe passed; TypeScript `npx.cmd tsc --noEmit --incremental false` passed; targeted ESLint trên toàn bộ changed TS/TSX `0 errors / 0 warnings`; `npm.cmd run build` passed sau quyền local phù hợp; `git diff --check` không có lỗi nội dung. Final local reset và canonical-seed verification sẽ là bước bàn giao cuối.
- Repository-wide lint chưa được dùng làm gate cho correction vì baseline ngoài D1 còn lỗi đã theo dõi tại `QUALITY-001`; targeted lint cho toàn bộ changed TS/TSX đã pass.
- Self-review: đã áp dụng `docs/agent-self-review.md` sau các correction hiện tại; đã falsify lại role escalation, ordinary/rescue/multiple-escalation resolution, sole-owner reviewer, moderation-vs-review audit, invitation identity/capacity/RLS, thumbnail path/authorization/cleanup, pending freeze, published demotion, parent course refresh, singular-owner DB/create/invitation/role boundaries và collaborator Select semantics. Không còn finding material mở ảnh hưởng D1 acceptance trong local evidence.
- Residual không phải Owner blocker: 11 active `published` seed fixture topics thiếu active exercise chưa được remediation vì không có production-data authority; `service_role` vẫn là infrastructure bypass; admin moderation boundary có runtime/RPC/audit nhưng current admin page vẫn mock; full accessibility/responsive và cross-role browser QA chưa hoàn tất; stale smoke tests cần follow-up riêng.
- Closure: P0→P4 base và correction đã có local checkpoint commits; handoff implementation READY cho fresh-reader review/push/PR riêng theo authority hiện tại, không claim merge readiness cho browser/fixture residual chưa verified.

| Hạng mục | Current repository truth | Disposition sau audit |
| --- | --- | --- |
| D1 — Topic authoring → review → publication | P0–P4 đã có readiness/review foundation, trusted lifecycle boundary, content mutation safety, workflow UX và closure local; browser matrix đầy đủ/stale baseline còn residual. | Handoff review/push/PR riêng với residual đã nêu; không mở rộng sang Q7/D2/candidate revision. |
| Q7 — Internal previewer access correction | `has_course_content_read_access` hiện chưa lọc topic `published`; progress/answer/review write paths cũng chưa yêu cầu enrollment. | Bounded collaborator/access candidate sau D1 và trước D2; sửa read boundary và persistent learning-write authorization gap. |
| D2 — Preview topic contract | Chưa có `topics.is_preview`; temporary flag chỉ nằm trong DTO, không cấp content access. | Standalone cross-boundary PR sau D1 và Q7; goal-level decisions về published/active gates, full readonly content, transient correctness, quota 20% và inline over-cap đã chốt. |
| D3 — Memory check | Chưa có stage/action/field riêng; stage hiện chỉ `flashcard`/`exercise`, `part_type` là TOEIC part. | Standalone learning-stage PR; prerequisite D4, soft prerequisite D5. |
| D4 — Topic completion server truth | Completion hiện derive từ hai flags; question answer chưa tham gia completion. | Standalone progress/completion PR sau D3 và exercise-attempt semantics; tách `LEARNING-INTEGRITY-001`. |
| D5 — Question-category analytics | Chưa có category/skill field hoặc analytics query; không dùng `part_type` làm category. | Standalone analytics contract/data PR sau category/stage/format SSOT. |
| D6 — FSRS review route/deeper UX | Review đang ở `ReviewSheet`; chưa có `/learn/review`. | Tách route decision khỏi UX polish; không gộp scope. |
| D7 — Google OAuth hoặc hide fake CTA | Google buttons là static; auth actions chưa có OAuth/callback. | Standalone auth PR; Owner chọn hide/disable hoặc OAuth đầy đủ. |
| D8 — Profile/dashboard polish | `/profile` đã là account surface; learning dashboard ownership đã chuyển sang `/learn`. | Giữ các follow-up UI riêng (`STUDENT-003`/`STUDENT-004`), không mở cleanup tổng hợp. |
| D9 — Deeper payment history/dashboard | Current dashboard chỉ có pending-payment reminder; chưa có history contract/query. | Standalone payment PR sau product need và data boundary rõ. |

- Working execution order đã chốt ở mức program: D1 → Q7 → D2 → D3 → D4 → D5 → D6 → D7 → D8 → D9. Đây là thứ tự triển khai tuần tự để dễ đọc và điều phối, không khẳng định mọi mũi tên là hard dependency. Chi tiết dependency/gates thuộc [plan.md](./plan.md).
- D1/Q7/D2 goal-level decisions đã chốt; D1 detailed plan đã reconcile các Owner steer, sẵn sàng cho một checkpoint cấp implementation authority riêng nhưng chưa cấp authority đó. D3–D5 vẫn còn semantic decisions riêng, còn D6–D9 giữ deferred/open về detailed acceptance và sẽ quyết định khi làm tới.
- Không kéo vào các PR này: `LEARNING-INTEGRITY-001`, `FUTURE-OWNERSHIP-001`, `AUTH-003`, `QUALITY-001`, `FEAT-001`/`FEAT-002`/`FEAT-003`, `STUDENT-005` và `NAVIGATION-001`.

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
