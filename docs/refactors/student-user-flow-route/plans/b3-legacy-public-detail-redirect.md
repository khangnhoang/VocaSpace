---
title: "B3 — Redirect public course detail cũ"
wave: B3
status: Discovery hoàn tất; plan draft chờ duyệt; chưa triển khai
planning_branch: docs/b3-route-plan-reconciliation
proposed_implementation_branch: refactor/legacy-public-course-redirect
base: "origin/main @ 5709eb0 (đã gồm PR #48 và PR #49)"
depends_on: "PR #48 đã merge bằng 00bdadab"
parent: ../plan.md
progress: ../progress.md
problems: ../problems.md
adr: ../../../adr/refactor-student-user-flow-route-adr.md
---

# Kế hoạch triển khai B3 — Redirect public course detail cũ

## 1. Mục tiêu

Thay renderer public detail tạm thời tại `/learn/[course-slug]` bằng temporary redirect sang route canonical `/courses/[course-slug]`, đồng thời giữ `/learn/[course-slug]/[topic-slug]` làm learning workspace.

B3 chỉ là bước chuyển tiếp. C1 sẽ dùng lại `/learn/[course-slug]` cho enrolled-course overview, vì vậy B3 không được tạo permanent redirect hoặc redirect có phạm vi rộng.

## 2. Trạng thái repository đã xác nhận

* PR B1 đã tạo public detail canonical tại `/courses/[course-slug]`.
* PR B2 đã merge qua PR #48 (`00bdadab`), thiết lập dashboard authenticated tại `/learn` và seam khởi tạo workspace theo topic trong URL.
* `origin/main @ 5709eb0` đã chứa PR #48 và PR #49.
* `app/(client)/learn/[course-slug]/page.tsx` vẫn delegate sang `PublicCourseDetailRoute`; B3 chưa được triển khai.
* `app/(client)/learn/[course-slug]/[topic-slug]/page.tsx` là một exact nested route riêng.
* Component test và smoke test hiện tại đang cố ý bảo vệ behavior trước B3; cần rewrite contract cũ thay vì thêm assertion mới gây mâu thuẫn.
* `publicCourseSlugSchema` trim khoảng trắng đầu/cuối trước khi kiểm tra canonical slug dạng chữ thường. Vì vậy contract hiện tại normalize khoảng trắng đầu/cuối, không reject mọi chuỗi có whitespace trước normalization.

## 3. Phạm vi

### Trong phạm vi

1. Thay exact one-segment legacy page bằng page-level temporary redirect.
2. Parse route slug bằng `publicCourseSlugSchema` hiện có trước khi gọi canonical route helper.
3. Đưa slug không hợp lệ sau normalization vào framework not-found boundary.
4. Rewrite focused legacy-route tests theo redirect/not-found behavior quan sát được.
5. Cập nhật public-discovery smoke hiện có để kiểm tra canonical redirect và bổ sung direct nested-route resolution check.
6. Chạy lại workspace initial-topic regression hiện có.
7. Cập nhật evidence B3 trong progress docs nhưng không đóng `STUDENT-002` trước C1.

### Ngoài phạm vi

* C1 enrolled-course overview hoặc C2 URL/sidebar/back-forward synchronization.
* Thay đổi behavior của `/learn/[course-slug]/[topic-slug]` hoặc `LearningWorkspace`.
* Auth guard mới, payment behavior, public-detail UI, metadata, RPC hoặc Server Action.
* Schema, migration, RLS, policy, trigger, view, seed hoặc production data.
* `proxy.ts`, middleware matching, `next.config.ts`, package hoặc dependency.
* Permanent redirect hoặc broad matching `/learn/:path*`.
* Memory check, preview management, completion truth hoặc cleanup không liên quan.

## 4. Hành vi bắt buộc

### Redirect boundary

Chỉ triển khai tại:

```text
app/(client)/learn/[course-slug]/page.tsx
```

Dùng `redirect()` từ `next/navigation`. Không dùng `permanentRedirect()`, proxy/middleware, `next.config.ts` hoặc catch-all rule. Exact nested workspace route phải tiếp tục resolve độc lập.

### Slug contract

Chỉ dùng output đã parse, không dùng raw param:

```text
raw route param
  -> publicCourseSlugSchema.safeParse
     -> invalid after normalization: notFound()
     -> valid: redirect(getPublicCourseDetailPath(parsed.data))
```

| Input | Kết quả |
| --- | --- |
| `toeic-foundation` | Redirect sang `/courses/toeic-foundation` |
| Slug đúng cú pháp nhưng course không tồn tại | Redirect canonical; canonical page chịu trách nhiệm trả 404 cuối cùng |
| Khoảng trắng đầu/cuối trong decoded param | Normalize bằng schema hiện có rồi redirect canonical |
| Chữ hoa, khoảng trắng ở giữa, dấu `/` hoặc ít hơn ba ký tự | Framework not-found boundary |

Không thay shared slug schema chỉ để legacy compatibility route chặt hơn. Nếu discovery khi triển khai cho thấy product yêu cầu reject khoảng trắng đầu/cuối, phải dừng và xin quyết định contract thay vì âm thầm đổi shared behavior.

### Query string

Legacy page hiện không có `searchParams` contract. B3 không bổ sung query-state hoặc payment parameter forwarding.

## 5. Dependency và thứ tự tạo branch

```text
B1 canonical public detail (merged)
  -> B2 authenticated dashboard (merged)
     -> B3 temporary legacy redirect
        -> C1 enrolled-course overview
           -> C2 workspace URL synchronization
```

Sau khi docs-only plan này merge, tạo implementation branch độc lập theo thứ tự:

1. Xác nhận worktree sạch.
2. Fetch remote.
3. Xác nhận B2 và plan này đã nằm trong `origin/main`.
4. Switch sang local `main`.
5. Pull `origin/main` bằng fast-forward-only và xác nhận local `main` khớp remote.
6. Tạo `refactor/legacy-public-course-redirect` từ local `main` đã cập nhật.
7. Dừng nếu branch khác đã thay cùng route hoặc C1 đã bắt đầu reclaim route này.

Không tạo implementation branch từ local branch cũ hoặc trực tiếp từ remote-tracking ref.

## 6. Các file dự kiến thay đổi

### Chỉnh sửa

```text
app/(client)/learn/[course-slug]/page.tsx
__tests__/components/public-course-detail.test.tsx
e2e/smoke/public-course-discovery.smoke.spec.ts
docs/refactors/student-user-flow-route/progress.md
docs/refactors/student-user-flow-route/problems.md
```

Chỉ cập nhật `plan.md`, B3 plan hoặc ADR khi evidence/status sau triển khai khiến các tài liệu đó không còn chính xác.

### Chỉ đọc và regression, không dự kiến chỉnh sửa

```text
lib/public-courses/routes.ts
lib/schemas/public-course.ts
app/(client)/courses/[course-slug]/page.tsx
app/(client)/learn/[course-slug]/[topic-slug]/page.tsx
app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace.tsx
__tests__/utils/public-course-routes.test.ts
__tests__/components/learn-dashboard.test.tsx
```

### Không được chạm nếu chưa báo blocking conflict mới

```text
next.config.ts
proxy.ts
utils/supabase/middleware.ts
app/actions/*
supabase/*
components/ui/*
package.json
```

## 7. Bước triển khai

Giữ code và direct regression coverage trong cùng một logical increment:

1. Thay legacy renderer bằng schema parsing và exact page-level redirect/not-found.
2. Mock framework navigation controls và assert behavior quan sát được: slug hợp lệ redirect đúng canonical path; output đã parse/normalize được sử dụng; malformed slug gọi `notFound()`; legacy page không gọi public-detail action.
3. Cập nhật test-plan header để phản ánh B3 contract và chỉ ghi verification thực sự đã chạy.
4. Không dùng brittle source-string assertion làm bằng chứng chính cho redirect behavior.
5. Giữ canonical detail tests và workspace initial-topic component regression.
6. Mở rộng smoke test hiện có để một legacy URL đã biết kết thúc tại canonical URL.
7. Thêm direct nested URL assertion để chứng minh browser vẫn ở `/learn/<course>/<topic>` thay vì bị redirect sang `/courses`.
8. Ghi command thực sự đã chạy và kết quả vào `progress.md`; không đánh dấu passed cho check chưa chạy.

## 8. Tiêu chí chấp nhận

| Request | Kết quả mong đợi |
| --- | --- |
| Guest mở `/learn/<course>` với course hợp lệ đã biết | Temporary redirect; URL cuối là `/courses/<course>` |
| Authenticated user mở cùng legacy URL | Redirect canonical tương tự |
| User mở slug đúng cú pháp nhưng không tồn tại | Redirect canonical rồi canonical page trả 404 |
| User mở slug không hợp lệ sau normalization | Framework 404 an toàn, không có uncaught validation error |
| Learner mở `/learn/<course>/<topic>` | URL giữ ở nested workspace và khởi tạo đúng topic hợp lệ được yêu cầu |
| User mở `/learn` | Dashboard/auth behavior của B2 không đổi |
| Source và config audit | Không có permanent/broad redirect; legacy page không còn render public detail |
| Data boundary | Không đổi action, migration, RLS, RPC, seed hoặc dependency |

## 9. Xác minh

### Focused tests

```bash
npm run test:run -- \
  __tests__/components/public-course-detail.test.tsx \
  __tests__/components/learn-dashboard.test.tsx \
  __tests__/utils/public-course-routes.test.ts
```

### Static checks

```bash
npx tsc --noEmit --incremental false
npm run lint -- \
  "app/(client)/learn/[course-slug]/page.tsx" \
  "__tests__/components/public-course-detail.test.tsx" \
  "e2e/smoke/public-course-discovery.smoke.spec.ts"
git diff --check
```

### Browser và build

```bash
npm run test:e2e -- e2e/smoke/public-course-discovery.smoke.spec.ts
npm run build
```

Browser smoke cần thiết vì behavior đi qua Next.js route tree và phải chứng minh cả redirect navigation lẫn nested-route coexistence. Full integration suite, database reset riêng cho B3, remote database check và repository-wide lint không phải yêu cầu mặc định, trừ khi check hẹp hơn phát hiện rủi ro rộng hoặc CI yêu cầu.

## 10. Manual QA và fixture readiness

Dùng B1 public-course seed và B2 learner fixtures hiện có; không dự kiến thêm fixture.

1. Legacy URL của course đã biết kết thúc tại canonical public detail với heading và syllabus đúng.
2. Legacy URL có slug đúng cú pháp nhưng không tồn tại kết thúc tại canonical 404.
3. Slug có chữ hoa hoặc khoảng trắng ở giữa trả safe 404.
4. Nested learner route đã biết vẫn ở `/learn` và mở đúng topic được yêu cầu.
5. `/learn` vẫn hiển thị B2 dashboard cho seeded learner và xử lý unauthenticated user theo contract hiện có.
6. Không có permanent redirect configuration mới.

Browser QA chỉ bắt đầu sau khi focused tests, TypeScript và build đạt, đồng thời local fixtures hiện có sẵn sàng.

## 11. Rủi ro và biện pháp giảm thiểu

* **Permanent redirect còn ảnh hưởng sau C1:** chỉ dùng page-level `redirect()`.
* **Broad matching bắt nhầm workspace:** chỉ thay exact one-segment page và thêm nested browser coverage.
* **Malformed slug làm canonical helper throw:** gọi `safeParse()` trước và chỉ truyền parsed data.
* **Tests tiếp tục giữ B1 compatibility contract:** rewrite có chủ đích các legacy assertions cũ trong cùng increment.
* **Docs đóng route collision quá sớm:** giữ `STUDENT-002` mở đến C1.
* **Scope lan sang enrolled overview:** B3 không query enrollment hoặc progress.

## 12. Điều kiện hoàn tất và bàn giao

B3 chỉ được xem là implemented khi redirect, invalid-slug handling, nested-route preservation, focused checks, build và smoke evidence đã hoàn tất hoặc được ghi rõ là pending, đồng thời final diff không có unrelated work hoặc blocking review finding.

Tại implementation checkpoint:

* Ghi B3 là implemented hoặc manual-QA pending đúng thực tế; không ghi merged trước khi merge tồn tại.
* Giữ Wave B ở trạng thái đang triển khai cho đến khi B3 thực sự merge.
* Ghi rõ C1 chỉ được unblocked sau khi B3 merge.
* Giữ `STUDENT-002` mở đến khi C1 reclaim `/learn/[course-slug]`.
* Báo changed files, verification thực tế, gaps và recommended English Conventional Commit.
* Không commit, push hoặc tạo PR nếu chưa có approval tương ứng từ owner.
