---
title: "C2 — Workspace Route Hardening"
wave: C2
status: "Planning complete; awaiting owner approval; implementation not started"
branch: feat/workspace-route-hardening
base: "origin/main @ 3cb7a9f9707e805c275bfced1c4e11b489727eb3"
dependency: "C1 merged through PR #75 @ 3cb7a9f9707e805c275bfced1c4e11b489727eb3"
parent: ../../plan.md
progress: ../../progress.md
problems: ../../problems.md
adr: ../../../../adr/refactor-student-user-flow-route-adr.md
---

# C2 Implementation Plan — Workspace Route Hardening

## 1. Mục tiêu và trạng thái

C2 làm cho `/learn/[course-slug]/[topic-slug]` trở thành learner workspace route đáng tin cậy: URL sở hữu topic đang mở, direct navigation và refresh luôn resolve đúng course/topic/access context, sidebar/previous/next tạo navigation thật, browser back/forward khôi phục đúng topic, và route không còn âm thầm fallback sang topic đầu tiên khi URL không hợp lệ hoặc không khả dụng.

Planning package này được lập trên `feat/workspace-route-hardening` từ synchronized baseline `origin/main @ 3cb7a9f9707e805c275bfced1c4e11b489727eb3`. Commit đó merge PR #75/C1 và chứa toàn bộ C1 branch head `44ee6b9`, nên dependency C1 đã thỏa mãn.

Trạng thái quyền hiện tại:

- Được phép discovery, lập/reconcile planning docs, self-review, commit planning và push branch một lần.
- Không được phép triển khai application code trong phiên planning này.
- C2 implementation chỉ bắt đầu sau khi owner duyệt detailed plan hoặc đưa ra implementation instruction mới đủ rõ.

Kích thước sơ bộ và cuối cùng: **Large/high-risk**. C2 vẫn là một PR, nhưng correctness đi qua route params, auth/enrollment/content access, server DTO, client navigation/history, async topic-local state và progress/review writes. Đây là một dependency chain tuần tự; file count không phải lý do phân loại.

## 2. Nguồn sự thật và dependency

- [Master plan](../../plan.md) sở hữu Wave C scope, dependency order và C2 acceptance criteria ở mức chương trình.
- [ADR](../../../../adr/refactor-student-user-flow-route-adr.md) chốt `[topic-slug]` là source of truth và nêu rủi ro ghi progress cho sai topic.
- [Progress tracker](../../progress.md) sở hữu delivery status/evidence hiện tại.
- [Problems log](../../problems.md) sở hữu `WORKSPACE-001`, `PROGRESS-001`, `PREVIEW-001`, `MEMORY-001`, `STUDENT-005` và các follow-up ngoài C2.
- [B2 plan](../../plans/b2-student-learn-dashboard.md) sở hữu minimal initial-topic seam và phần C2 đã defer: URL update, sidebar sync, back/forward.
- [B3 plan](../b3/plan.md) sở hữu historical exact-route redirect boundary và nested-route preservation.
- [C1 plan](../c1/plan.md) sở hữu overview/access semantics và B2 eligible-content ordering mà C2 phải giữ tương thích.
- Repository code, current schema/RLS và Git history là evidence cuối cùng khi status text cũ mâu thuẫn.
- Next.js App Router `<Link>` mặc định push URL mới vào browser history; `replace` mới thay entry hiện tại. C2 dùng semantics này làm technical basis cho topic navigation: <https://nextjs.org/docs/app/api-reference/components/link>.

Dependency graph:

```text
B2 initial-topic seam (merged)
  -> B3 nested-route preservation (merged)
    -> C1 overview/access contract (merged in PR #75)
      -> C2 CP1 exact route/read contract
        -> C2 CP2 affected progress/review write guards
          -> C2 CP3 URL-owned workspace UI/navigation
            -> C2 CP4 browser/history/manual QA + docs reconciliation
              -> later memory/completion/preview work (separate approval)
```

C2 không chạy song song theo checkpoint: CP2 dùng exact topic/access identity từ CP1; CP3 chỉ an toàn khi read/write boundaries đã ổn định; CP4 cần implementation và fixtures ổn định.

## 3. Sự thật đã xác nhận từ repository

1. `app/(client)/learn/[course-slug]/[topic-slug]/page.tsx` đọc cả hai route params nhưng chỉ truyền `topicSlug` thành `initialTopicSlug`; page không parse params, không auth/enrollment-classify và render raw error string khi `getCourseSyllabus()` thất bại.
2. `resolveInitialLesson()` trả topic đầu tiên nếu requested slug không tìm thấy. Unit test hiện bảo vệ fallback này; C2 phải đổi contract/test thay vì giữ compatibility sai với accepted direction.
3. `LearningWorkspace` sở hữu `currentLessonSlug` bằng local state. Sidebar, `Bài trước` và `Bài sau` chỉ gọi state setters; URL không đổi, history không có topic entry mới và route params không còn phản ánh topic đang thấy.
4. `initialTopicSlug` chỉ ảnh hưởng initializer của `useState`. Component không reconcile current topic khi route prop đổi qua browser history/client navigation, và topic-local queue/exercise/history state có nguy cơ stale giữa các topic.
5. `getCourseSyllabus(courseSlug)` chỉ resolve course basic identity và nested syllabus. Nó không explicit auth/enrollment-check; unenrolled/guest có thể nhận empty syllabus do RLS thay vì một classified state.
6. `getTopicContent(topicSlug)` resolve bằng topic slug độc lập, không ràng buộc `course_id`, `status = published`, `removed_at IS NULL` hoặc active chapter trong application query. Topic slugs đang unique toàn database, nhưng uniqueness không chứng minh topic thuộc course URL.
7. C1 đã thiết lập pattern đáng tin cậy: parse raw slug, `getUser()`, resolve published active course, explicit enrollment check, dừng protected reads cho `unenrolled`, strict discriminated result và safe recoverable errors.
8. B2/C1 eligible content chỉ gồm active chapter và published active topic, theo `chapter.order_index`, `topic.order_index`, rồi stable ID tie-break. C2 không được tạo ordering/visibility semantics khác.
9. `has_course_content_read_access(course_id)` và content SELECT policies hiện cho authenticated enrolled learner, admin và course collaborator đọc active content; C1 learner overview vẫn yêu cầu enrollment rõ ràng. Target route contract ở master plan là learner enrolled; preview/collaborator behavior chưa được duyệt cho C2.
10. `user_topic_progress` RLS chỉ ràng buộc `auth.uid() = user_id`; nó không tự chứng minh client-supplied `topic_id` thuộc active route/course. Application write boundary vì vậy phải resolve/validate topic context trước write.
11. `updateStageProgress(topicId, stage)` upsert client-supplied topic ID sau auth nhưng không verify course/topic/access relation. `getTopicLearningHistory(topicId)` đọc answer history toàn user trước khi đọc progress của topic.
12. `submitCardReview(cardId, topicId, rating)` hiện có thể khởi tạo progress bằng client-supplied topic ID trước khi verify card/topic relation và chứa legacy auto-enrollment side effect. Behavior này xung đột với C1/C2 explicit enrollment prerequisite và không được giữ trong workspace trust boundary.
13. `submitQuestionAnswer()` có exercise correctness/option behavior riêng; owner đã loại exercise correctness policy khỏi C2. C2 chỉ được chạm phần này nếu exact route-topic authorization không thể đạt bằng boundary hẹp hơn và phải dừng nếu cần đổi correctness semantics.
14. `supabase/seed.sql` đã có deterministic enrolled courses/topics, draft/removed topic, cross-course topic, cards và an authenticated-but-unenrolled published course. Không có evidence cần thêm seed hoặc migration cho C2 QA.
15. Existing E2E chỉ chứng minh valid nested direct URL khởi tạo đúng topic. Chưa có sidebar URL update, refresh after navigation, back/forward, invalid/unavailable topic, wrong-course topic hoặc nested unenrolled state proof.
16. Không có learner-workspace component/action suite chuyên biệt. `__tests__/components/course-workspace-routes.test.tsx` chủ yếu bảo vệ teacher authoring workspace; `__tests__/utils/learn-navigation.test.ts` chỉ bảo vệ B2 initial fallback helper.

## 4. Contract C2 đã reconcile

### 4.1 URL và topic-state ownership

- Cặp canonical `(courseSlug, topicSlug)` từ route là source of truth duy nhất cho navigable current topic.
- `LearningWorkspace` không giữ một current-topic slug độc lập có thể lệch URL.
- Sidebar, previous và next navigation tạo canonical `/learn/[course]/[topic]` destination và dùng history-pushing navigation. Không dùng `replace` cho ordinary topic selection.
- Direct URL, refresh, shared link, browser back và browser forward đều đi qua cùng page/action contract và render đúng topic của URL.
- Mọi topic-local state (stage, card queue, exercises, selected answer, explanation, cached history, loading/pending flags) phải reset hoặc được thay bằng data mới khi route topic đổi. Không được hiển thị content cũ dưới URL mới.
- Nếu implementation giữ client fetch thay vì server-loaded current-topic payload, nó phải chống stale/out-of-order response rõ ràng. Preferred plan là server-owned current-topic payload để route render và content identity cùng một contract.

### 4.2 Access và result-state matrix

Dedicated workspace read contract nhận raw course/topic slugs và trả strict discriminated result:

| Result | Điều kiện | Page behavior | Privacy boundary |
| --- | --- | --- | --- |
| `auth_required` | Không có authenticated user/session | `redirect("/login")` | Không query protected content |
| `course_not_found` | Course slug invalid hoặc published active course không visible/exist | `notFound()` theo C1 | Không phân biệt invalid/nonexistent/hidden |
| `unenrolled` | Course public-safe tồn tại nhưng current user không enroll | Same-route persistent access state; primary `/courses/[course]`, secondary `/learn` | Dừng trước syllabus/topic/content/progress reads |
| `topic_unavailable` | Topic slug invalid, nonexistent, draft, removed, active chapter không hợp lệ hoặc topic thuộc course khác | Same-route route-local state; primary `/learn/[course]`, secondary `/learn` | Không tiết lộ topic có tồn tại hay exact lock reason |
| `success` | Enrolled user + exact published active topic thuộc exact published active course | Render strict syllabus/current-topic content DTO | Chỉ serialize learner-safe fields |
| `error` | Auth/query/contract failure không phải expected absence | Recoverable route-local alert + refresh retry | Không leak Supabase/Zod/raw error |

`topic_unavailable` là cách C2 reconcile wording “invalid/locked” với deferred preview contract: route cho feedback rõ, nhưng không invent preview lock, `is_preview`, 30% cap hoặc collaborator-preview UX. Khi preview contract được duyệt sau, nó có thể tách “locked preview” khỏi privacy-safe unavailable state.

### 4.3 Read contract và query order

Expected server order:

```text
parse courseSlug + topicSlug
  -> create client + getUser
  -> resolve published active course basic identity
  -> explicit current-user enrollment
  -> read active chapters + published active topics in B2/C1 order
  -> match exact route topic inside exact course syllabus
  -> only then read cards/exercises/questions/options and topic-scoped history/progress
  -> sort nested content deterministically
  -> strict output validation
  -> safe result
```

Rules:

- Parse and classify both route slugs before database reads; course-param failure maps `course_not_found`, topic-param failure maps `topic_unavailable`. Use reusable workspace route-param schemas/types rather than raw strings across modules.
- Course/topic relationship must be explicit in application filters/derived trusted rows; global topic-slug uniqueness is not authorization.
- `unenrolled` must stop before protected syllabus/content/progress serialization, matching C1.
- Draft, removed, wrong-course and nonexistent topics converge to `topic_unavailable`; no fallback.
- Read model must reuse or narrow-extract B2/C1 eligible ordering rather than create a third contradictory rule. Any shared extraction must keep B2 dashboard and C1 output byte-for-byte/semantically compatible through regression tests.
- Current-topic content DTO excludes `is_correct`, raw removed/status/access rows, enrollment/user IDs and internal error details.
- Remove/retire `getCourseSyllabus()` and `getTopicContent()` from workspace after all callers migrate; do not leave parallel production contracts with different access semantics. Discovery found no other application callers.

### 4.4 Affected write boundaries

C2 does not redefine completion or exercise correctness. It must nevertheless prevent route/local-state drift from writing progress to the wrong topic:

- `updateStageProgress` parses a schema-owned input and verifies the topic is an active published topic accessible to the authenticated user before select/upsert. It retains current flashcard/exercise flags and current completion calculation; final truth remains deferred.
- Workspace history reads are scoped to trusted current topic/question IDs; they do not fetch every answer for the user.
- Card review derives trusted topic/card relationship server-side before initializing progress or writing FSRS state. Client-supplied `topicId` cannot select the progress row independently of `cardId`.
- Remove the legacy auto-enrollment side effect from `submitCardReview`; learner enrollment is an explicit prerequisite owned by public course enrollment/payment flow and C1/C2 access contracts.
- Shared `ReviewSheet` compatibility must be preserved with focused regression. If removing auto-enrollment or deriving topic breaks a documented review contract, stop and surface the concrete dependency instead of restoring implicit enrollment.
- Do not change “all questions/exercises correct” semantics, memory-check stage, `is_topic_completed` final target, option correctness policy or the visible inert `Hoàn thành bài học` control as part of C2.

### 4.5 UI/UX direction

- Screen type: Learning Experience; medium design latitude, but C2 is interaction hardening rather than a workspace redesign.
- Single job: learner luôn biết đang học topic nào, có thể đi topic khác qua navigation đáng tin cậy và hiểu cách quay lại khi route không khả dụng.
- Reuse current workspace surfaces/components and C1 blue/slate/cyan access-state language where practical; no new tokens, fonts, packages, global primitive changes or ornamental redesign.
- Signature is route-visible lesson continuity: active sidebar item, title/content and URL always agree.
- Deliberate restraint: no new motion system; pending/loading affordance may clarify route transition but cannot hide stale content under a new URL.
- Feedback states are persistent semantic surfaces, not toast-only. `unenrolled` matches C1 CTA hierarchy; `topic_unavailable` points to course overview first; recoverable error has retry.
- Sidebar topic controls must be semantic links or controls with correct accessible current-state indication (`aria-current` when applicable), visible focus and usable hit target.
- Mobile QA focuses on topic navigation discoverability, wrapping, no horizontal overflow and route-local feedback at 375px; full mobile navigation parity remains `NAVIGATION-001` outside C2.

### 4.6 Alternatives và trade-offs

- Giữ `currentLessonSlug` local rồi đồng bộ URL bằng `useEffect`: rejected vì tạo hai owners, có transient mismatch và làm back/forward/stale async khó chứng minh.
- Dùng `router.replace` hoặc `<Link replace>` cho topic selection: rejected vì xóa history entry mà C2 cần cho back/forward. Ordinary topic navigation dùng default push.
- Giữ invalid-topic fallback của B2: rejected vì shared/direct URL có thể mở sai topic và ghi progress sai context.
- Dùng global 404 cho mọi topic issue: rejected vì không phân biệt course-not-found với privacy-safe route-local unavailable state và kéo `STUDENT-005` vào C2.
- Gọi trực tiếp C1 overview action rồi fetch content riêng trên client: rejected làm default vì tạo hai read contracts/time windows; C2 cần một exact course-topic workspace result. Narrow shared pure helpers vẫn được reuse khi output không đổi.
- Thêm RLS migration ngay để bind progress row với topic access: chưa justified bởi approved C2 direction/current evidence. CP2 dùng application guard; implementation phải dừng xin owner decision nếu DB enforcement là điều kiện bắt buộc.

## 5. Expected implementation and test surface

### Expected application/schema files

```text
app/(client)/learn/[course-slug]/[topic-slug]/page.tsx
app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace.tsx
app/(client)/learn/[course-slug]/[topic-slug]/_components/ChapterSidebar.tsx
app/(client)/learn/[course-slug]/[topic-slug]/_components/<route-local feedback/retry component>.tsx
app/actions/learn.ts OR app/actions/learning-workspace.ts
app/actions/progress.ts
app/actions/review.ts
lib/schemas/learn.ts OR lib/schemas/learning-workspace.ts
lib/learn-navigation.ts
```

Preferred ownership follows C1: dedicated `learning-workspace` action/schema for reusable boundary/result DTO, while topic-local render props stay local. Exact filenames may adjust to nearby conventions, but implementation must not duplicate old/new production access contracts.

### Expected tests

```text
__tests__/actions/learning-workspace.test.ts
__tests__/actions/progress.test.ts
__tests__/actions/review.test.ts
__tests__/components/learning-workspace.test.tsx
__tests__/schemas/learning-workspace.test.ts
__tests__/utils/learn-navigation.test.ts
e2e/smoke/learning-workspace.smoke.spec.ts
e2e/smoke/enrolled-course-overview.smoke.spec.ts (only if ownership assertion is narrowed/reconciled)
```

Use actual discovered need: a schema test file is required only if new reusable validation has meaningful cases beyond action tests. New non-trivial action/component/smoke files require concise Vietnamese test-plan headers and current verify status.

### Direct regression surfaces

```text
__tests__/actions/enrolled-course-overview.test.ts
__tests__/components/enrolled-course-overview.test.tsx
__tests__/components/learn-dashboard.test.tsx
__tests__/utils/learn-dashboard.test.ts
e2e/smoke/enrolled-course-overview.smoke.spec.ts
```

### Files/domains không được chạm nếu không có blocking evidence

```text
supabase/migrations/**
supabase/seed.sql
types/database.ts
app/actions/enrolled-course-overview.ts
lib/learn-dashboard.ts
lib/schemas/enrolled-course-overview.ts
components/ui/**
proxy.ts
utils/supabase/middleware.ts
package.json
package-lock.json
```

C1/B2 shared extraction chỉ được chạm nếu implementation chứng minh không thể giữ one ordering SSOT theo cách hẹp hơn; khi đó phải giữ all existing outputs và chạy direct regressions.

## 6. Checkpoint breakdown

### P0 — Planning package delivery

Outcome của phiên hiện tại:

- Synchronized `main`/`origin/main`, xác nhận C1 merge và tạo `feat/workspace-route-hardening` từ exact C1 merge baseline.
- Discovery/reconcile ADR, master plan, progress/problems, B2/B3/C1, current route/actions/RLS/tests/fixtures/history và Next.js navigation semantics.
- Tạo detailed plan + owner-review brief; cập nhật current status docs từ C1 pending sang merged và C2 planning ready.
- Self-review docs, commit planning package và push branch đúng một lần.

Gate:

- Link/path/stale-status audit.
- Scope/exclusion/dependency/permission consistency audit.
- `git diff --check`, staged diff, secret/artifact audit và clean post-commit state.
- Không application code/test/seed/migration change.

### CP1 — Exact route/read/access contract

Outcome:

- Reusable route-param + strict result DTO.
- Dedicated action theo order tại §4.3.
- Explicit states `auth_required`, `course_not_found`, `unenrolled`, `topic_unavailable`, `success`, `error`.
- Exact course-topic binding, no invalid fallback, B2/C1 ordering reuse và current-topic content/history payload.
- CP1 thêm contract mới và tests trong khi page vẫn dùng contract cũ nguyên vẹn; CP3 chuyển caller rồi retire old workspace read actions atomically. Không để page dùng half-old/half-new data path.

Acceptance:

1. Invalid params fail before DB client.
2. Guest stops before protected queries.
3. Unenrolled stops before syllabus/topic/content/progress reads.
4. Wrong-course, draft, removed và nonexistent topic không return success hoặc content.
5. Query/strict-output failure returns safe recoverable state.
6. Success DTO contains exact route topic and deterministic learner-safe content.
7. B2/C1 ordering/visibility output remains unchanged.

Verification:

```text
npm run test:run -- __tests__/actions/learning-workspace.test.ts __tests__/schemas/learning-workspace.test.ts __tests__/actions/enrolled-course-overview.test.ts __tests__/utils/learn-dashboard.test.ts
npx tsc --noEmit --incremental false
npx eslint <CP1 changed TS/TSX files>
git diff --check
```

Only run the schema file if created. Stop if trustworthy classification requires preview semantics, migration/RLS change, service-role bypass or protected reads before enrollment.

### CP2 — Progress/review write-context hardening

Outcome:

- Schema-owned, parsed write inputs.
- Topic/card/question context needed by workspace is derived or verified server-side before mutation.
- `updateStageProgress` cannot upsert an unavailable/wrong topic through client-supplied ID.
- `submitCardReview` validates card-topic-access relation before progress/FSRS write and no longer auto-enrolls.
- Topic history is narrow to active topic; `ReviewSheet` remains behavior-compatible.
- Completion flags, exercise scoring and FSRS algorithm remain unchanged except necessary authorization/order corrections.

Acceptance:

1. Missing auth, malformed IDs, inaccessible topic/card and mismatched relation cause no mutation.
2. Valid enrolled workspace review/progress still succeeds.
3. Review dashboard flow still submits the current queued card successfully.
4. No enrollment INSERT occurs from card review.
5. No raw Supabase/Zod details reach client results.
6. No final completion/memory/exercise-correctness behavior is added.

Verification:

```text
npm run test:run -- __tests__/actions/progress.test.ts __tests__/actions/review.test.ts __tests__/components/learn-dashboard.test.tsx
npx tsc --noEmit --incremental false
npx eslint <CP2 changed TS/TSX files>
git diff --check
```

Stop if safe write context requires a new DB invariant/RLS policy or broad review/exercise refactor. Record that dependency for owner decision rather than adding a migration silently.

### CP3 — URL-owned workspace navigation và visible states

Outcome:

- Page consumes CP1 result and maps states theo §4.2.
- Workspace renders route-owned current topic/content; sidebar/previous/next navigate canonical topic URLs with push history.
- Topic-local state resets on route change; stale content cannot remain visible.
- Invalid/unavailable/unenrolled/error feedback surfaces and route-transition loading are accessible and responsive.
- Existing learning flow remains usable without redesign or final completion changes.

Acceptance:

1. Direct valid URL và refresh show the exact requested topic.
2. Sidebar click changes URL, active item, heading/content and chapter expansion consistently.
3. Previous/next change URL to exact ordered sibling topic and disabled endpoints remain correct.
4. Back/forward restore exact prior/next topic and reset topic-local state.
5. Invalid/unavailable route never opens first topic silently.
6. Unenrolled route exposes no protected syllabus/content.
7. Feedback actions lead to canonical course overview/public detail/dashboard as defined.
8. Keyboard/focus/current-state semantics and 375px layout remain usable.

Verification:

```text
npm run test:run -- __tests__/components/learning-workspace.test.tsx __tests__/utils/learn-navigation.test.ts __tests__/components/enrolled-course-overview.test.tsx
npx tsc --noEmit --incremental false
npx eslint <CP3 changed TS/TSX files>
git diff --check
```

Component tests prove observable render/destination/reset behavior. They do not claim browser-history completion; that belongs CP4.

### CP4 — Seed-backed browser/history QA + completion docs

Outcome:

- Dedicated C2 smoke owns direct/sidebar/previous-next/refresh/back-forward and inaccessible route matrix on isolated seeded Supabase.
- C1 smoke retains only C1 ownership; duplicate nested assertions are reconciled deliberately.
- Responsive/accessibility/manual checks and production gates run after focused suites are green.
- Progress/problems/master/ADR/C2 plan/brief record actual implementation evidence and remaining exclusions.

Verification sequence:

```text
npm run test:run
npx tsc --noEmit --incremental false
npx eslint <all C2 changed TS/TSX files>
npm run test:e2e -- e2e/smoke/learning-workspace.smoke.spec.ts
npm run build
git diff --check
```

Broader Vitest/build are justified at final gate because C2 changes shared route/action boundaries and a critical authenticated browser workflow. If sandbox/network blocks the existing Google Font build, report the exact failure and rerun only with approved escalation; do not add a code workaround.

## 7. QA fixture readiness và manual matrix

### QA fixture readiness

- QA type: authenticated data-dependent browser/history/manual QA trên isolated local Supabase.
- Canonical fixture source: existing `supabase/seed.sql` + current E2E runner reset flow.
- Existing covered states:
  - enrolled ordered course: `/learn/b2-qa-in-progress` với four published topics;
  - direct valid card-backed topic: `b2-qa-progress-topic-2`;
  - cross-course valid topic: `b2-qa-completed-final-topic` dưới wrong course URL;
  - draft/removed topics: `b2-qa-no-content-draft-topic`, `b2-qa-no-content-removed-topic`;
  - unenrolled published course/topic: `/learn/local-toeic-test-course/local-test-topic`;
  - invalid/nonexistent: deterministic URL only.
- Missing states: không có required route/history state thiếu. Exercise-rich completion fixture không cần vì completion/correctness ngoài C2.
- Required fixture additions: none theo discovery hiện tại.
- Reset/setup command: existing `npm run test:e2e -- <focused spec>` isolated runner; không chạy remote DB.
- Fixture checkpoint: CP4 bắt đầu sau CP1–CP3 focused automated gates xanh.
- Browser QA may begin when: local isolated Supabase reset/seed và app server từ runner healthy; exact matrix routes reproducible.

Manual/browser matrix:

| Actor/state | Action | Expected visible/URL result |
| --- | --- | --- |
| Guest | Mở valid nested URL | Redirect `/login`; không protected content |
| Seeded enrolled learner | Direct mở topic 2 | URL giữ exact topic 2; sidebar/title/content active topic 2 |
| Seeded enrolled learner | Click topic 3 trong sidebar | URL push topic 3; active/title/content cùng topic 3 |
| Seeded enrolled learner | Refresh topic 3 | Vẫn topic 3, không fallback/stale content |
| Seeded enrolled learner | Browser back rồi forward | Back về topic 2; forward topic 3; mỗi lần active/title/content khớp URL |
| Seeded enrolled learner | Previous/next | Exact ordered destinations; endpoints disabled đúng |
| Seeded enrolled learner | Wrong-course topic URL | Same URL, privacy-safe unavailable state; không content/fallback |
| Seeded enrolled learner | Draft/removed/nonexistent/invalid topic URL | Same URL; route-local unavailable state, không content/fallback |
| Seeded unenrolled learner | Mở `local-test-topic` | Same-route unenrolled state; public detail + `/learn`; không syllabus/content |
| Seeded enrolled learner | Mobile 375px + keyboard | Sidebar/actions/focus usable, text wraps, no horizontal overflow |

Manual QA completion requires every matrix row reproduced/observed. Static source assertion hoặc component test không được mô tả là browser-history proof.

## 8. Rủi ro và mitigation

| Rủi ro | Ảnh hưởng | Mitigation sớm nhất |
| --- | --- | --- |
| Local topic state lệch URL | Wrong content/history/progress | CP1 route DTO + CP3 remove independent navigable slug |
| Invalid slug fallback | Shared/deep link mở sai bài | CP1 `topic_unavailable`, remove fallback unit contract |
| Wrong-course/global slug lookup | Content/progress bound sai course | CP1 exact course-topic relation in trusted query |
| Out-of-order async content response | URL mới hiển thị content cũ | Server-owned payload hoặc explicit stale-response guard in CP3 |
| Progress/review accepts client topic ID | Wrong topic progress/data pollution | CP2 derive/verify relation before any mutation |
| Legacy card review auto-enroll | Access model bị bypass/implicit | CP2 remove side effect + ReviewSheet regression |
| C1/B2 ordering drift | Dashboard/overview/workspace disagree | Reuse/narrow extraction + direct regressions in CP1 |
| “Locked” kéo preview vào C2 | Scope creep/RLS leak | One privacy-safe unavailable state; preview remains `PREVIEW-001` |
| Global 404 gap che feedback | User khó hiểu invalid route | Route-local topic unavailable state only; do not redesign global 404 |
| Existing workspace UI/state complexity | Broad rewrite/regression | Surgical page/action/navigation changes; retain stage semantics |
| Existing RLS only self-owns progress | Direct-client invariant broader than app route | CP2 application guard; stop for owner if DB enforcement proves required |

## 9. Explicit exclusions

- Memory check/activity-stage design or implementation.
- Final topic/course completion truth, all-exercise/all-question correctness and `is_topic_completed` redesign.
- Exercise answer correctness/option policy except a narrowly necessary route-topic authorization check; stop before semantic change.
- Preview marker, 30% cap, collaborator preview, public/locked content RLS expansion.
- Global `not-found.tsx`, metadata/title redesign hoặc `STUDENT-005`.
- Mobile account-menu parity (`NAVIGATION-001`).
- Dashboard/review visual polish (`STUDENT-003`, `STUDENT-004`).
- Dedicated `/learn/review`, FSRS algorithm redesign or review queue semantics.
- Payment/history/profile/teacher authoring/Wave D work.
- Migration, RLS/RPC/view/trigger/index/generated DB type/seed change unless new blocking evidence is surfaced and owner separately approves scope.
- Shared UI primitive, package, font, theme or global navigation redesign.
- Production DB mutation, deploy, PR creation or merge in the planning session.

## 10. Stop conditions

Stop implementation and report instead of silently redefining C2 when:

1. Current `origin/main` no longer contains C1 merge or another branch changed overlapping route/action contracts after plan approval.
2. Product requires previewer/collaborator/guest topic access, a distinct lock state or preview percentage before `PREVIEW-001` is decided.
3. Exact inaccessible-state copy must reveal draft/removed/nonexistent distinctions that would leak protected content state.
4. Safe progress/card review writes require a migration/RLS/RPC change rather than the planned application guard.
5. Removing auto-enrollment conflicts with a current documented enrollment contract or requires payment/enrollment flow redesign.
6. Route trust cannot be achieved without changing final completion or exercise correctness semantics.
7. Shared B2/C1 projection reuse changes dashboard/overview output, ordering, pagination or status semantics.
8. Required browser state is not reproducible from canonical fixtures and a seed change would exceed narrow local/test-only scope.
9. Implementation needs `components/ui/**`, proxy/middleware, package changes, global 404, broad mobile navigation or unrelated workspace redesign.
10. Focused tests expose a pre-existing blocker whose ownership cannot be separated from C2.

Rollback cho implementation sau này là revert CP4→CP1 commits như một coherent C2 PR. Theo plan hiện tại không có database rollback vì không có migration/RLS/seed change.

## 11. Documentation và progress ownership

- `implementation-plans/c2/plan.md`: exact C2 contract, checkpoints, verification, outcome evidence và deviations.
- `implementation-plans/c2/owner-review-brief.md`: decision surface/quyền ngắn gọn; không override detailed plan.
- `implementation-plans/README.md`: định tuyến C2 thành active implementation plan sau P0.
- `progress.md`: C1 merge status, C2 planning/implementation/checkpoint/verification status.
- `problems.md`: close `WORKSPACE-001` chỉ sau CP4; giữ `PROGRESS-001`, `PREVIEW-001`, `MEMORY-001`, `STUDENT-005`, `NAVIGATION-001` đúng ownership.
- `plan.md`/ADR: chỉ cập nhật current orientation và durable C2 clarification; không rewrite accepted history.

Mọi deviation material về access, result states, DB enforcement, write boundary, scope hoặc verification phải được reconcile vào detailed plan và re-reviewed trước implementation tiếp theo.

## 12. Completion criteria

C2 chỉ hoàn tất khi:

1. Cả course/topic route params được parse và exact route-access-content relation được server chứng minh.
2. URL là source of truth; sidebar/previous/next/direct/refresh/back/forward cùng một contract.
3. Invalid/unavailable/unenrolled/error không fallback và có feedback/CTA rõ, privacy-safe.
4. Topic-local state không stale qua route changes.
5. Affected progress/review writes không dùng client topic identity trước authorization/relation validation; auto-enrollment đã bị loại.
6. B2 dashboard và C1 overview semantics/regressions giữ nguyên.
7. Focused action/schema/component/helper tests, TypeScript, targeted lint và diff checks đạt.
8. Full Vitest, focused seeded C2 Playwright, production build và manual state matrix đạt hoặc remaining environment limitation được ghi rõ và verdict bị giới hạn tương ứng.
9. Docs/status/problems phản ánh evidence thực tế; không close deferred issues.
10. Formal self-review không còn `Critical`/`Required`; specialist default `0` trừ khi main review còn một hard-risk cluster đủ điều kiện và có explicit permission.

## 13. Implementation handoff

### Approved goal

Biến nested learner workspace thành route URL-owned, exact-access, history-correct và no-fallback, giữ nguyên C1/B2 semantics và deferred feature boundaries.

### Dependencies and required order

`C1 merged @ 3cb7a9f` → CP1 read/access → CP2 writes → CP3 UI/navigation → CP4 browser/docs. Không parallel.

### Relevant contracts

- C1 explicit auth/enrollment/result pattern.
- B2/C1 active published topic ordering.
- Existing `has_course_content_read_access` content RLS as defense layer, không thay explicit learner enrollment check.
- Next.js `<Link>` default history push.

### Forbidden scope

Memory/final completion/exercise correctness/preview/global 404/mobile menu/Wave D/database/shared primitive/package changes như §9.

### Automated verification

Run checkpoint-focused tests first; final full Vitest/TypeScript/targeted lint/focused E2E/build only at CP4 as defined.

### Manual QA

Use existing deterministic seed and exact route/history matrix in §7; do not add seed unless a required state is proven missing.

### Known limitations

- Existing final completion semantics and inert completion control are intentionally not solved by C2.
- Route-local unavailable state does not define future preview lock semantics.
- Application write guards do not claim a new database-wide progress invariant; DB enforcement is a stop/owner-decision boundary if later required.

## 14. Planning self-review

P0 main-agent self-review đã hoàn tất ngày 2026-08-19 đối với current code, C1 merge ancestry, scope/exclusions, exact result matrix, read/write dependency order, fixture truth, verification commands, stop conditions và stale status claims.

Corrections từ self-review:

- Sửa CP1/CP3 handoff để old read actions chỉ retire atomically khi page caller chuyển ở CP3; không mô tả retire sớm rồi để half-migrated data path.
- Sửa manual matrix để mọi invalid/unavailable topic giữ same URL và route-local state, khớp result matrix; không còn wording “hoặc framework behavior” mơ hồ.
- Bổ sung alternatives/trade-offs và phân loại course-param/topic-param failure trước DB reads.

Evidence:

- Branch/ancestry: `feat/workspace-route-hardening @ 3cb7a9f`, `HEAD == origin/main` tại baseline và C1 head `44ee6b9` là ancestor.
- Local-link audit: đạt cho toàn bộ modified docs và riêng hai C2 artifacts.
- Stale-status audit: không còn claim PR #75 open/merge pending trong Student/User Flow sources.
- Whitespace/conflict/scope audit: trailing whitespace không có; `git diff --check` đạt; tracked diff chỉ thuộc `docs/**`; không có application/test/seed/migration change.
- Application tests/build/browser QA: không chạy vì P0 là docs-only planning package; commands tương lai được xác định theo checkpoint, không được ghi là đã đạt.

Verdict: **Pass — không còn finding `Critical` hoặc `Required` trong planning scope C2**. Implementation vẫn chờ owner approval; verdict này không cấp implementation, PR, merge, deploy hoặc database permission.

Specialist decision mặc định: **0 specialist**. Discovery có security-sensitive route/write facts, nhưng repository evidence và main-agent integration review đủ để define bounded checkpoints và explicit DB/preview stop conditions. Không còn một unresolved hard-risk question cần specialist để planning package trở nên trustworthy; implementation review sẽ đánh giá lại từ actual diff/evidence.
