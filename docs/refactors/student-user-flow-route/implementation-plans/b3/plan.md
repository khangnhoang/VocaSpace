---
title: "B3 — Redirect public course detail cũ"
wave: B3
status: "Đã merge qua PR #74 tại 59d08104f78a4eb744c2420c8ec5db7ab712e1e3"
branch: refactor/legacy-public-course-redirect
baseline: "origin/main @ effb5571955aa09b714e97b7162a6bb3bed0bca4"
depends_on: "PR #48 đã merge bằng 00bdadab"
planning_date: 2026-08-17
implementation_date: 2026-08-17
parent: ../../plan.md
progress: ../../progress.md
problems: ../../problems.md
adr: ../../../../adr/refactor-student-user-flow-route-adr.md
owner_review: ./owner-review-brief.md
---

# Kế hoạch triển khai B3 — Redirect public course detail cũ

## 1. Mục tiêu và trạng thái thực tế

Thay renderer public detail tạm thời tại exact route `/learn/[course-slug]` bằng temporary redirect sang canonical route `/courses/[course-slug]`, đồng thời giữ `/learn/[course-slug]/[topic-slug]` làm learning workspace.

B3 là bước chuyển tiếp trước C1. C1 sẽ reclaim `/learn/[course-slug]` cho enrolled-course overview, vì vậy B3 không được tạo permanent redirect hoặc redirect rule có phạm vi rộng.

Discovery ngày 2026-08-17 được thực hiện sau khi đồng bộ local `main` với `origin/main` tại `effb5571955aa09b714e97b7162a6bb3bed0bca4` và tạo branch `refactor/legacy-public-course-redirect` từ commit đó. Kết luận historical tại thời điểm discovery: **B3 chưa được triển khai**. Sau đó CP1/CP2 được triển khai, verified và merge qua PR #74 tại `59d08104f78a4eb744c2420c8ec5db7ab712e1e3` ngày 2026-08-18. Evidence ngay dưới đây là snapshot trước implementation, được giữ để giải thích decision trail.

Evidence:

- `app/(client)/learn/[course-slug]/page.tsx` vẫn import và return `PublicCourseDetailRoute`; không dùng `redirect()` hoặc `notFound()`.
- `__tests__/components/public-course-detail.test.tsx` vẫn assert legacy page render cùng canonical view, chứa `PublicCourseDetailRoute` và không chứa `redirect(`.
- `e2e/smoke/public-course-discovery.smoke.spec.ts` vẫn assert browser ở `/learn/<slug>` và thấy public detail.
- `app/(client)/learn/[course-slug]/[topic-slug]/page.tsx` là nested route riêng và truyền `initialTopicSlug` vào `LearningWorkspace`; prerequisite B2 đã có.
- Scoped Git history từ B3 planning merge `03ad1c5` đến baseline hiện tại không có commit thay các route/test B3 nêu trên.
- Không có remote implementation branch B3 trước khi branch hiện tại được tạo; B1 đã merge qua PR #46 (`079ad469`), B2 qua PR #48 (`00bdadab`), còn B3 chỉ có planning docs qua PR #50 (`03ad1c5`, planning commit `dc66539`).

Owner đã cấp quyền implementation, checkpoint commit và push ngày 2026-08-17. Quyền đó không bao gồm tạo/update PR, merge hoặc deploy; các hành động này không được thực hiện trong B3 delivery hiện tại.

## 2. Nguồn sự thật

- [Master plan](../../plan.md) sở hữu program scope, dependency order và high-level B3 outcome.
- [Progress tracker](../../progress.md) sở hữu current delivery status và verification evidence.
- [Problems log](../../problems.md) sở hữu `STUDENT-002` cùng risk/follow-up còn mở.
- [ADR](../../../../adr/refactor-student-user-flow-route-adr.md) sở hữu durable route decisions.
- File này là nguồn duy nhất cho detailed B3 implementation contract.
- [Owner-review brief](./owner-review-brief.md) tóm tắt decision surface và quyền hiện tại; nó không được override file này.
- Repository code và Git history là evidence cuối cùng khi tài liệu trạng thái mâu thuẫn.

## 3. Phạm vi

### Trong phạm vi implementation B3 đã thực hiện

1. Thay exact one-segment legacy page bằng page-level temporary redirect.
2. Parse raw route slug bằng `publicCourseSlugSchema.safeParse()` trước khi gọi canonical route helper.
3. Đưa slug không hợp lệ sau normalization vào framework not-found boundary.
4. Rewrite focused legacy-route tests theo redirect/not-found behavior quan sát được; bỏ contract cũ đang khẳng định không redirect.
5. Cập nhật public-discovery smoke hiện có để kiểm tra canonical redirect và direct nested-route preservation.
6. Chạy lại workspace initial-topic regression hiện có.
7. Cập nhật progress/problem evidence theo kết quả thực sự; không đóng `STUDENT-002` trước C1.

### Ngoài phạm vi

- C1 enrolled-course overview hoặc C2 URL/sidebar/back-forward synchronization.
- Thay đổi behavior của `/learn/[course-slug]/[topic-slug]` hoặc `LearningWorkspace`.
- Auth guard mới, payment behavior, public-detail UI/metadata, RPC, Server Action hoặc Route Handler.
- Schema, migration, RLS, policy, trigger, view, seed hoặc production data.
- `proxy.ts`, middleware matching, `next.config.ts`, package hoặc dependency.
- Permanent redirect, broad matching `/learn/:path*`, query-state/payment forwarding.
- Memory check, preview management, completion truth hoặc cleanup không liên quan.
- PR creation/update, merge hoặc deploy nếu chưa được owner cấp quyền riêng.

## 4. Hành vi bắt buộc

### Exact redirect boundary

Chỉ thay:

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
| `toeic-foundation` | Temporary redirect sang `/courses/toeic-foundation` |
| Slug đúng cú pháp nhưng course không tồn tại | Redirect canonical; canonical page chịu trách nhiệm trả 404 cuối cùng |
| Khoảng trắng đầu/cuối trong decoded param | Normalize bằng shared schema hiện có rồi redirect canonical |
| Chữ hoa, khoảng trắng ở giữa, dấu `/` hoặc ít hơn ba ký tự | Framework not-found boundary |

Không thay shared slug schema chỉ để legacy compatibility route chặt hơn. Nếu implementation discovery cho thấy product muốn reject khoảng trắng đầu/cuối, dừng và xin quyết định contract thay vì âm thầm đổi shared behavior.

Legacy page hiện không có `searchParams` contract. B3 không bổ sung query forwarding.

## 5. File contract

### Đã chỉnh trong implementation

```text
app/(client)/learn/[course-slug]/page.tsx
__tests__/components/public-course-detail.test.tsx
e2e/smoke/public-course-discovery.smoke.spec.ts
docs/refactors/student-user-flow-route/progress.md
docs/refactors/student-user-flow-route/problems.md
```

Chỉ cập nhật master plan, detailed plan, owner brief hoặc ADR khi evidence/status mới khiến chúng không còn chính xác.

### Chỉ đọc và regression, không dự kiến chỉnh

```text
lib/public-courses/routes.ts
lib/schemas/public-course.ts
app/(client)/courses/[course-slug]/page.tsx
app/(client)/learn/[course-slug]/[topic-slug]/page.tsx
app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace.tsx
__tests__/utils/public-course-routes.test.ts
__tests__/components/learn-dashboard.test.tsx
```

### Dừng nếu cần chạm mà chưa có conflict được owner duyệt

```text
next.config.ts
proxy.ts
utils/supabase/middleware.ts
app/actions/*
supabase/*
components/ui/*
package.json
```

## 6. Checkpoint breakdown cuối cùng

P0, CP1 và CP2 là ba checkpoint đã hoàn tất; chúng không tự cấp quyền PR, merge hoặc deploy.

### P0 — Planning package delivery

- Trạng thái: Hoàn tất qua planning commit `c30cbc1`.
- Outcome: remote-synchronized discovery, hierarchy/ownership được reconcile, detailed plan và owner brief tự review không còn blocking finding.
- File: chỉ tài liệu trong `docs/refactors/student-user-flow-route/**`.
- Gate đã đạt: link/stale-source/scope audit, `git diff --check` và full planning diff review.

### CP1 — Exact redirect contract và focused regression

- Trạng thái: Hoàn tất qua commit `1bfd875`.
- Thay exact legacy page bằng `safeParse()` + `notFound()`/temporary `redirect()`.
- Rewrite focused test để assert valid, normalized, invalid và no-public-detail-action behavior quan sát được.
- Giữ canonical detail, `/learn` dashboard và initial-topic regressions xanh.
- Gate đã đạt: focused Vitest `3 files / 39 tests`, TypeScript, targeted lint và `git diff --check`.
- Dừng nếu cần broad redirect, shared schema change, action/data change hoặc C1 behavior.

### CP2 — Route-tree proof và completion audit (chỉ sau CP1)

- Trạng thái: Hoàn tất; evidence và status được checkpoint trong final implementation commit chứa cập nhật này.
- Rewrite public-discovery smoke để legacy one-segment URL kết thúc tại canonical URL.
- Dùng seeded student và deterministic B2 fixture để kiểm tra authenticated legacy redirect, sau đó mở `/learn/b2-qa-in-progress/b2-qa-progress-topic-2` và chứng minh URL không bị redirect sang `/courses` cùng requested topic được chọn.
- Gate đã đạt: isolated local Supabase smoke `2/2` và production build; fixture hiện có đủ, không thêm seed.
- Reconcile progress/problems/detailed-plan evidence, formal final review và handoff.
- Không tạo PR, merge hoặc deploy nếu chưa có quyền tương ứng.

Các checkpoint là quality gates, không tự động cấp quyền commit/push và không yêu cầu empty commit. Nếu CP1/CP2 phải gộp để giữ repository coherent, báo owner trước khi đổi breakdown.

## 7. Tiêu chí chấp nhận implementation

| Request | Kết quả mong đợi |
| --- | --- |
| Guest hoặc authenticated user mở `/learn/<course>` với course hợp lệ | Temporary redirect; URL cuối là `/courses/<course>` |
| User mở slug đúng cú pháp nhưng không tồn tại | Redirect canonical rồi canonical page trả 404 |
| User mở slug không hợp lệ sau normalization | Framework 404 an toàn, không có uncaught validation error |
| Learner mở `/learn/<course>/<topic>` | URL giữ ở nested workspace và khởi tạo đúng topic hợp lệ được yêu cầu |
| User mở `/learn` | Dashboard/auth behavior B2 không đổi |
| Source/config audit | Không có permanent/broad redirect; legacy page không còn render public detail |
| Data boundary | Không đổi action, migration, RLS, RPC, seed hoặc dependency |

## 8. Verification strategy

### Focused tests — CP1

```bash
npm run test:run -- \
  __tests__/components/public-course-detail.test.tsx \
  __tests__/components/learn-dashboard.test.tsx \
  __tests__/utils/public-course-routes.test.ts
```

Kết quả: đạt, `3` test files / `39` tests.

Test plan phải dùng framework navigation mocks theo convention hiện có và assert control-flow observable. Source-string checks chỉ được dùng như secondary boundary guard, không phải bằng chứng chính cho redirect behavior.

### Static gates — CP1

```bash
npx tsc --noEmit --incremental false
npm run lint -- \
  "app/(client)/learn/[course-slug]/page.tsx" \
  "__tests__/components/public-course-detail.test.tsx" \
  "e2e/smoke/public-course-discovery.smoke.spec.ts"
git diff --check
```

Kết quả: TypeScript, targeted ESLint và `git diff --check` đều đạt.

### Browser/build gates — CP2

```bash
npm run test:e2e -- e2e/smoke/public-course-discovery.smoke.spec.ts
npm run build
```

Kết quả: Playwright đạt `2/2` scenario sau khi sửa test timing/URL observation dựa trên failure evidence. Build lần đầu trong sandbox không tải được Google Fonts; rerun cùng command ngoài sandbox compiled, TypeScript và static generation thành công.

Browser smoke là bắt buộc vì behavior đi qua Next.js route tree và phải chứng minh redirect navigation coexist với nested route. Runner `scripts/e2e/run-e2e.mjs` từ chối non-local Supabase, reset isolated workdir và dùng repository seed trước Playwright. Full integration suite hoặc repository-wide lint chỉ được mở rộng khi check hẹp phát hiện rủi ro rộng hoặc CI yêu cầu.

## 9. Fixture readiness và manual QA

Smoke hiện chọn course published đầu tiên từ homepage canonical link, nên B1 public-course seed hiện có đủ cho guest redirect proof. Seed hiện có cũng cung cấp student đã enroll cùng deterministic course/topic `/learn/b2-qa-in-progress/b2-qa-progress-topic-2`; CP2 phải đăng nhập qua UI bằng seeded student trước khi dùng fixture này cho authenticated redirect và nested-route proof. B3 không cần fixture, seed hay migration mới.

Manual QA/automation cần chứng minh:

1. Legacy URL của course đã biết kết thúc tại canonical detail với heading/syllabus đúng.
2. Slug đúng cú pháp nhưng không tồn tại kết thúc tại canonical 404.
3. Slug có chữ hoa hoặc khoảng trắng ở giữa trả safe 404.
4. Seeded learner mở `/learn/b2-qa-in-progress/b2-qa-progress-topic-2` vẫn ở đúng nested URL và chọn `Topic 2 - Bước tiếp theo`.
5. `/learn` vẫn giữ B2 dashboard/auth contract.
6. Không có permanent/broad redirect configuration mới.

## 10. Rủi ro, stop conditions và rollback

- Permanent redirect còn ảnh hưởng sau C1: chỉ dùng page-level `redirect()`.
- Broad matching bắt nhầm workspace: chỉ thay exact one-segment page và giữ nested browser proof.
- Malformed slug làm helper throw: `safeParse()` trước và chỉ truyền parsed output.
- Test cũ phủ định B3: rewrite contract cũ trong cùng CP1, không chồng assertion mâu thuẫn.
- Scope tràn sang enrolled overview/data: dừng nếu cần query enrollment/progress hoặc chạm action/database.
- C1 đã bắt đầu reclaim cùng route hoặc baseline thay đổi sau planning push: fetch/re-discover và reconcile trước implementation.
- Rollback B3 là revert exact page/test/smoke/docs increment; không có database rollback vì B3 không đổi data layer.

## 11. Điều kiện hoàn tất và handoff

B3 được ghi **đã merge qua PR #74** vì merge commit `59d08104f78a4eb744c2420c8ec5db7ab712e1e3` đã tồn tại trên `main`. C1 dependency đã thỏa mãn.

Handoff hiện tại:

- `STUDENT-002` đã được C1 xử lý trên `feat/enrolled-course-overview`; thay đổi C1 chưa merge vào `main`.
- C1 đã implemented/verified trên branch riêng; exact route không còn B3 redirect trên branch đó.
- Báo changed files, verification thực tế, gaps/risks và recommended English Conventional Commit.
- B3 implementation delivery đã kết thúc; C1 đã được owner authorize/implement trên branch riêng, còn PR/merge/deploy không thuộc workflow này.
