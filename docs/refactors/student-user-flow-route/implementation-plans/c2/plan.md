---
title: "C2 — Workspace Route Hardening"
wave: C2
status: "CP1–CP4 implemented and verified; final checkpoint/push pending"
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

Trạng thái triển khai hiện tại:

- P0 planning package và owner-decision reconciliation được owner duyệt tại `237ad103`.
- CP1 `bc1cd93`, CP2 `9682389` và CP3 `a3191b5` đã hoàn tất theo đúng dependency order; CP4 automated/browser/build gates đã đạt.
- Final self-review/checkpoint/push đang thực hiện trên `feat/workspace-route-hardening`; chưa tạo PR, merge hoặc deploy.
- Không có database schema/RLS/RPC/policy/seed/runtime-production mutation trong C2.

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
10. `user_topic_progress` RLS chỉ ràng buộc `auth.uid() = user_id`; FK chỉ bảo đảm `topic_id` tồn tại. Nó không tự chứng minh topic thuộc active/published course/chapter hoặc user còn access/enroll. C2 application guard đủ cho application-path correctness, nhưng không tạo database-wide invariant hoặc chặn authenticated client gọi Data API trực tiếp.
11. `user_question_answers` cũng chỉ self-own qua RLS. `question_id` và `selected_option_id` có hai FK độc lập, nên database hiện cho phép option của question khác được ghép vào answer row; `is_correct` cũng không được DB derive. C2 phải kiểm tra membership trong application action nhưng không được claim DB-wide answer integrity.
12. `updateStageProgress(topicId, stage)` upsert client-supplied topic ID sau auth nhưng không verify course/topic/access relation. `getTopicLearningHistory(topicId)` đọc answer history toàn user trước khi đọc progress của topic.
13. `submitCardReview(cardId, topicId, rating)` hiện chạy progress upsert → topic read → chapter read → enrollment insert → `user_flashcards` read → FSRS write. Enrollment INSERT không có authenticated INSERT policy và topic read đã cần content access, nên hack này không thể tạo enrollment cho unenrolled learner; với caller đã access, nó chỉ tạo failed/logged write. Không có documented contract phụ thuộc vào behavior này.
14. Progress-row initialization từ card review chỉ tạo default false flags. B2/C1 completion projection không cần row này, ReviewSheet queue dùng `user_flashcards`, và workspace đã có `updateStageProgress`; không có repository evidence rằng review lịch sử/due card phải tạo `user_topic_progress`.
15. `submitQuestionAnswer()` đã đọc question cùng visible options trong một bounded query, nhưng không parse UUID, không kiểm tra selected option thuộc chính question và bỏ qua upsert error. Question/option RLS chứng minh current course-content access, nhưng không chứng minh active exercise/topic/chapter chain; một joined bounded read có thể kiểm tra chain mà không thêm network round trip hoặc client `topicId`.
16. `questions.course_id`, `exercises.course_id`, `topics.course_id` và các parent FK tồn tại riêng lẻ; không có composite constraint chứng minh các denormalized course IDs khớp parent chain. Application aggregate phải reject mismatched chain thay vì tin một course ID riêng lẻ.
17. `supabase/seed.sql` đã có deterministic enrolled courses/topics, draft/removed topic, cross-course topic, cards và an authenticated-but-unenrolled published course. Không có evidence cần thêm seed hoặc migration cho C2 QA.
18. Existing E2E chỉ chứng minh valid nested direct URL khởi tạo đúng topic. Chưa có sidebar URL update, refresh after navigation, back/forward, invalid/unavailable topic, wrong-course topic hoặc nested unenrolled state proof.
19. Không có learner-workspace component/action suite chuyên biệt. `__tests__/components/course-workspace-routes.test.tsx` chủ yếu bảo vệ teacher authoring workspace; `__tests__/utils/learn-navigation.test.ts` chỉ bảo vệ B2 initial fallback helper.
20. Global client header đã có visible clickable `VocaSpace` brand/logo tới `/`. Workspace ArrowLeft hiện cũng trỏ `/` nhưng chỉ có icon, không accessible label; C2 có thể đổi riêng action này về `/learn/[course-slug]` mà không cần thêm Home icon hoặc sửa shared header.

### 3.1 Verdict cho sáu owner decisions

1. **C2 guarantee boundary — Confirmed with refinement.** C2 giữ application-path guards và không thêm migration/RLS/RPC. Plan phải nói rõ self-owner RLS + FK hiện tại không tạo DB-wide learner-write invariant; follow-up `LEARNING-INTEGRITY-001` tách khỏi completion semantics của `PROGRESS-001`.
2. **`submitQuestionAnswer` narrow hardening — Confirmed with refinement.** UUID parse, selected-option membership và checked upsert nằm trong cùng current question/options read cost. Vì content RLS chỉ course-bound, bounded read phải join/verify active parent chain và denormalized course consistency trong cùng request; không nhận client topic ID và không đổi first-correct-option semantics.
3. **`submitCardReview` / ReviewSheet hardening — Confirmed with refinement.** Bỏ client `topicId`, progress initialization và auto-enrollment. Một bounded card-context read derive trusted topic/current FSRS row dưới current content RLS; caller queue dùng cùng eligibility và không claim/dequeue success irreversibly khi write fail. FSRS algorithm không đổi.
4. **Lightweight performance constraint — Confirmed with refinement.** Dùng source/action-mock query-count evidence + focused Playwright request/trace evidence; không thêm Lighthouse target/framework benchmark. Browser chứng minh navigation requests/duplicate client calls, còn Supabase round trips được chứng minh ở action tests hoặc optional local REST/DB logs khi cần.
5. **Workspace parent navigation — Confirmed with refinement.** Workspace back action tới `/learn/[course-slug]`, có accessible label; existing global `VocaSpace` brand tiếp tục là homepage affordance. Không thêm Home icon hoặc sửa shared header.
6. **Access/error precedence — Confirmed with refinement.** Course syntax giữ C1 immediate not-found. Topic syntax được parse sớm nhưng classification được defer cho tới sau auth → published active course → enrollment, nên guest/parent/access state thắng child existence while invalid topic vẫn không tạo topic/content query. Không có sequential topic locking.

Không verdict nào yêu cầu đổi C2 scope, database enforcement, FSRS/review algorithm, exercise-correctness semantics hoặc dependency order; vì vậy pass này được reconcile docs thay vì kích hoạt material-conflict stop.

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

Deterministic precedence:

| Input/actor state | Result | Query boundary |
| --- | --- | --- |
| Course syntax invalid, kể cả topic cũng invalid | `course_not_found` | Không tạo DB client, giống C1 |
| Course syntax valid, topic syntax invalid, guest | `auth_required` | Parse topic sớm nhưng dừng sau auth; không course/topic/content query |
| Course syntax valid, topic syntax invalid, authenticated + course missing | `course_not_found` | Course resolve thắng child classification |
| Course syntax valid, topic syntax invalid, authenticated + course visible nhưng unenrolled | `unenrolled` | Enrollment resolve thắng child classification; không topic/content query |
| Course syntax valid, topic syntax invalid, enrolled | `topic_unavailable` | Không topic/content query |
| Both syntax valid, course missing | `course_not_found` | Không inspect topic |
| Both syntax valid, course visible nhưng unenrolled + topic nonexistent/wrong/draft/removed | `unenrolled` | Không inspect topic existence/status/course ownership |
| Both syntax valid, enrolled + topic unavailable | `topic_unavailable` | Exact protected topic query sau enrollment, reason privacy-safe |

### 4.3 Read contract và query order

Expected logical server order:

```text
parse courseSlug; parse-and-record topicSlug result
  -> create client + getUser
  -> resolve published active course basic identity
  -> explicit current-user enrollment
  -> if recorded topic syntax is invalid: topic_unavailable without topic/content read
  -> read active chapters + published active topics in B2/C1 order
  -> match exact route topic inside exact course syllabus
  -> only then read cards/exercises/questions/options and topic-scoped history/progress
  -> sort nested content deterministically
  -> strict output validation
  -> safe result
```

Rules:

- Parse both slugs before using them. Course-param failure returns `course_not_found` before client creation; topic-param failure is recorded but returns only after auth/course/enrollment precedence as specified above. Use reusable workspace route-param schemas/types rather than raw strings across modules.
- Course/topic/chapter relationship and every denormalized course ID must be explicit in application filters/derived trusted rows; global topic-slug uniqueness and independent FKs are not authorization/integrity proof.
- `unenrolled` must stop before protected syllabus/content/progress serialization, matching C1.
- Draft, removed, wrong-course and nonexistent topics converge to `topic_unavailable`; no fallback.
- Read model must reuse or narrow-extract B2/C1 eligible ordering rather than create a third contradictory rule. Any shared extraction must keep B2 dashboard and C1 output byte-for-byte/semantically compatible through regression tests.
- Current-topic content DTO excludes `is_correct`, raw removed/status/access rows, enrollment/user IDs and internal error details.
- Remove/retire `getCourseSyllabus()` and `getTopicContent()` from workspace after all callers migrate; do not leave parallel production contracts with different access semantics. Discovery found no other application callers.
- After enrollment, syllabus and exact current-topic aggregate may run in parallel. Preferred bounded shape combines course identity + current-user enrollment where the query can still classify errors safely, then uses one syllabus read and one exact topic/content/history aggregate; do not force a sequential table-by-table waterfall merely to mirror logical precedence.

### 4.4 Affected write boundaries

C2 does not redefine completion or exercise correctness. It must nevertheless prevent untrusted/stale client identity from selecting unrelated learning rows:

- `updateStageProgress` parses a schema-owned input and uses one bounded active published topic/active chapter read under content RLS to derive access and current user's progress state before upsert. It retains current flashcard/exercise flags and current completion calculation; final truth remains deferred.
- Workspace history reads are scoped to question IDs from the trusted exact current-topic aggregate; they do not fetch every answer for the user.
- `submitQuestionAnswer` parses both UUIDs before client creation. Its existing question + options read is enriched with the active exercise/topic/chapter chain and course-ID consistency; selected option must be one of that question's returned active options before one checked upsert. No client topic ID, extra sequential authorization query or answer-correctness change.
- Multiple correct options remain current semantics: the first returned correct option remains scoring truth for C2. This known correctness policy is not silently fixed here.
- `submitCardReview` changes contract to trusted `cardId + rating`; client `topicId` is removed. One bounded card-context read derives topic/active parent chain/current content access and preferably embeds the current user's optional `user_flashcards` row; then exactly one checked FSRS update/insert runs.
- Remove both legacy auto-enrollment and `user_topic_progress` initialization from `submitCardReview`. Topic-stage progress remains owned by `updateStageProgress`.
- `getDeckReviewCards`/ReviewSheet queue selection must use the same reviewable-card eligibility as the mutation so stale/deleted/inaccessible items are not offered and then rejected. Current content RLS remains the access gate; do not add a separate enrollment query.
- Workspace/ReviewSheet callers must wait for confirmed success or implement an explicit rollback. They must not permanently dequeue a card, mark a queue complete or show success after a failed FSRS write; safe error feedback remains required.
- Every action write error returns a stable safe result; no action may return success after an ignored upsert/update/insert failure.
- Shared `ReviewSheet` FSRS/queue compatibility must be preserved with focused regression. If current content RLS must be replaced by learner-only enrollment, historical-card eligibility changes beyond active/published parent filtering, or FSRS scheduling semantics must change, stop and surface the concrete dependency.
- Do not change “all questions/exercises correct” semantics, memory-check stage, `is_topic_completed` final target, option correctness policy or the visible inert `Hoàn thành bài học` control as part of C2.

### 4.5 UI/UX direction

- Screen type: Learning Experience; medium design latitude, but C2 is interaction hardening rather than a workspace redesign.
- Single job: learner luôn biết đang học topic nào, có thể đi topic khác qua navigation đáng tin cậy và hiểu cách quay lại khi route không khả dụng.
- Reuse current workspace surfaces/components and C1 blue/slate/cyan access-state language where practical; no new tokens, fonts, packages, global primitive changes or ornamental redesign.
- Signature is route-visible lesson continuity: active sidebar item, title/content and URL always agree.
- Deliberate restraint: no new motion system; pending/loading affordance may clarify route transition but cannot hide stale content under a new URL.
- Feedback states are persistent semantic surfaces, not toast-only. `unenrolled` matches C1 CTA hierarchy; `topic_unavailable` points to course overview first; recoverable error has retry.
- Workspace parent/back action points to `/learn/[course-slug]` and has an accessible name such as `Về tổng quan khóa học`; global `VocaSpace` brand/logo remains the `/` affordance.
- Sidebar topic controls must be semantic links or controls with correct accessible current-state indication (`aria-current` when applicable), visible focus and usable hit target.
- Mobile QA focuses on topic navigation discoverability, wrapping, no horizontal overflow and route-local feedback at 375px; full mobile navigation parity remains `NAVIGATION-001` outside C2.

### 4.6 Alternatives và trade-offs

- Giữ `currentLessonSlug` local rồi đồng bộ URL bằng `useEffect`: rejected vì tạo hai owners, có transient mismatch và làm back/forward/stale async khó chứng minh.
- Dùng `router.replace` hoặc `<Link replace>` cho topic selection: rejected vì xóa history entry mà C2 cần cho back/forward. Ordinary topic navigation dùng default push.
- Giữ invalid-topic fallback của B2: rejected vì shared/direct URL có thể mở sai topic và ghi progress sai context.
- Dùng global 404 cho mọi topic issue: rejected vì không phân biệt course-not-found với privacy-safe route-local unavailable state và kéo `STUDENT-005` vào C2.
- Gọi trực tiếp C1 overview action rồi fetch content riêng trên client: rejected làm default vì tạo hai read contracts/time windows; C2 cần một exact course-topic workspace result. Narrow shared pure helpers vẫn được reuse khi output không đổi.
- Thêm RLS migration ngay để bind progress row với topic access: chưa justified bởi approved C2 direction/current evidence. CP2 dùng application guard; implementation phải dừng xin owner decision nếu DB enforcement là điều kiện bắt buộc.

### 4.7 Lightweight performance contract

C2 không đặt Lighthouse score hoặc xây benchmark framework. Query/network verification tập trung vào bounded work và duplicate/waterfall regressions.

| Hot path | Current path từ source | Reconciled target |
| --- | --- | --- |
| Initial workspace | Server: course + syllabus (`2` DB requests). Client waterfall: `getTopicContent` topic → cards → exercises (`3` DB), rồi `getTopicLearningHistory` auth → all-user answers → progress (`1` auth + `2` DB); hai Server Action browser round trips sau render | Một RSC/navigation contract; auth, bounded parent resolution, rồi syllabus + exact topic/content/topic-scoped history aggregate. Không client duplicate content/history fetch, không all-user answer scan, không N+1. Prefer khoảng `3` DB requests sau auth; nếu aggregate phải tách, các protected reads chạy bounded/parallel và actual count phải được ghi |
| Topic navigation/back-forward | Local state đổi rồi lặp hai client action round trips; URL/history không đổi | Một canonical route navigation per user action. Syllabus có thể refetch một lần trong RSC payload nếu total DB/network phases vẫn không tăng rõ rệt; không được thêm một client syllabus/content/history refetch thứ hai. Back/forward có thể dùng Next cache hoặc một RSC fetch, nhưng không duplicate actions |
| `submitQuestionAnswer` | Auth + one question/options read + one unchecked upsert (`1` auth + `2` DB) | UUID parse trước client; auth + one richer bounded question/options/parent read + one checked upsert. **Zero additional DB/network round trips** |
| `submitCardReview` | Auth + progress upsert + topic read + chapter read + enrollment insert + `user_flashcards` read + unchecked FSRS mutation (`1` auth + `6` DB) | UUID/rating parse; auth + one card/parent/current-FSRS aggregate + one checked FSRS mutation (`1` auth + target `2` DB). A separate current-FSRS read is acceptable fallback only if embedding is not reliable, yielding at most `3` DB; never card → topic → chapter → enrollment waterfall |

Verification approach:

- Action tests mock Supabase boundary and assert ordered table/query calls, invalid-input no-client behavior, no enrollment/progress side effects, and exact current/target query budgets above.
- Focused Playwright records request/response or trace evidence around direct load, sidebar, next/previous, refresh, back and forward; assert one canonical navigation and absence of duplicate `getTopicContent`/history action calls. Account for framework prefetch rather than treating every request as user-triggered work.
- Browser/CDP cannot prove server-to-Supabase query count. If action-mock/source evidence is disputed, inspect isolated local PostgREST/DB request logs for the focused scenario; do not add production instrumentation, a generic query framework or arbitrary timing threshold solely for C2.
- Compare payload/request shape and count, not unstable wall-clock timings. Record actual evidence in CP4 instead of claiming a performance improvement from design alone.

## 5. Expected implementation and test surface

### Expected application/schema files

```text
app/(client)/learn/[course-slug]/[topic-slug]/page.tsx
app/(client)/learn/[course-slug]/[topic-slug]/_components/LearningWorkspace.tsx
app/(client)/learn/[course-slug]/[topic-slug]/_components/ChapterSidebar.tsx
app/(client)/learn/[course-slug]/[topic-slug]/_components/QuizSidebar.tsx
app/(client)/learn/[course-slug]/[topic-slug]/_components/<route-local feedback/retry component>.tsx
app/(client)/learn/_components/ReviewSheet.tsx
app/actions/learn.ts OR app/actions/learning-workspace.ts
app/actions/progress.ts
app/actions/review.ts
app/actions/profile.ts
lib/schemas/learn.ts OR lib/schemas/learning-workspace.ts
lib/schemas/profile.ts (only if ReviewSheet DTO loses client-owned topic identity)
lib/learn-navigation.ts
```

Preferred ownership follows C1: dedicated `learning-workspace` action/schema for reusable boundary/result DTO, while topic-local render props stay local. Exact filenames may adjust to nearby conventions, but implementation must not duplicate old/new production access contracts.

### Expected tests

```text
__tests__/actions/learning-workspace.test.ts
__tests__/actions/progress.test.ts
__tests__/actions/review.test.ts
__tests__/actions/profile.test.ts (only for queue/mutation eligibility compatibility)
__tests__/components/learning-workspace.test.tsx
__tests__/components/review-sheet.test.tsx (only if optimistic failure behavior changes)
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

1. Invalid course syntax fails before DB client; invalid topic syntax follows the deterministic parent/access precedence matrix and never creates a topic/content query.
2. Guest with syntactically valid course stops before course/protected queries, including when topic syntax is invalid.
3. Unenrolled stops before syllabus/topic/content/progress reads regardless of topic existence/status/ownership.
4. Wrong-course, draft, removed và nonexistent topic không return success hoặc content.
5. Query/strict-output failure returns safe recoverable state.
6. Success DTO contains exact route topic and deterministic learner-safe content.
7. Course/topic/chapter and denormalized course IDs all match the trusted parent chain.
8. B2/C1 ordering/visibility output remains unchanged.
9. Success path has no N+1 or duplicate client content/history fetch; actual action/query count is asserted and recorded.

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
- Topic/card/question context needed by workspace is derived or verified in bounded server reads before mutation.
- `updateStageProgress` cannot upsert an unavailable/wrong topic through client-supplied ID.
- `submitQuestionAnswer` rejects malformed IDs, cross-question/stale option and inactive/mismatched parent chain without adding a query round trip; failed upsert is not success.
- `submitCardReview` no longer accepts client `topicId`, initializes progress or attempts enrollment; it derives current accessible card context and checks the FSRS mutation result.
- Topic history is narrow to trusted current-topic questions; ReviewSheet queue/mutation eligibility and failure behavior remain coherent.
- Completion flags, exercise scoring and FSRS algorithm remain unchanged except necessary authorization/order corrections.

Acceptance:

1. Missing auth, malformed IDs, inaccessible topic/card/question and mismatched parent relation cause no mutation.
2. Selected option must belong to the submitted question's active returned options; separate DB FKs are not treated as membership proof.
3. Valid enrolled workspace answer/review/progress still succeeds and current first-correct-option, completion flags and FSRS scheduling remain unchanged.
4. Review dashboard flow still submits the current queued card successfully; stale/deleted/inaccessible queue items are excluded or fail visibly without false completion.
5. No enrollment INSERT or `user_topic_progress` write occurs from card review.
6. Card review hot path uses target `2` DB requests after auth, or at most `3` only when optional current-FSRS embedding is proven unreliable; question answer remains `2` DB requests after auth.
7. Every upsert/update/insert error returns safe failure, and callers do not permanently advance/claim completion without confirmation or rollback.
8. No raw Supabase/Zod details reach client results.
9. No final completion/memory/exercise-correctness behavior is added.

Verification:

```text
npm run test:run -- __tests__/actions/progress.test.ts __tests__/actions/review.test.ts __tests__/actions/profile.test.ts __tests__/components/review-sheet.test.tsx __tests__/components/learn-dashboard.test.tsx
npx tsc --noEmit --incremental false
npx eslint <CP2 changed TS/TSX files>
git diff --check
```

Run only conditional profile/ReviewSheet files that implementation creates. Stop if safe application-path write context requires a new DB invariant/RLS policy, learner-only review access instead of current content RLS, historical-card semantic redesign or broad review/exercise refactor. Record that dependency for owner decision rather than adding a migration silently.

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
8. Workspace back action points to exact `/learn/[course-slug]`, is keyboard/focus accessible, and global brand remains the only homepage affordance needed.
9. Keyboard/focus/current-state semantics and 375px layout remain usable.

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
- Focused browser trace/request evidence records one canonical navigation per action and no duplicate legacy content/history Server Action waterfall; server-to-Supabase query count remains action-test/log evidence.
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
| Seeded enrolled learner | Workspace back action | Đi `/learn/[course-slug]`; global `VocaSpace` brand vẫn đi `/` |
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
| Separate FK/RLS self-ownership bị hiểu nhầm là relational integrity | Cross-question option hoặc inaccessible topic write vẫn lọt direct Data API | CP2 application guards + `LEARNING-INTEGRITY-001`; không claim DB-wide invariant |
| Course-level content RLS không kiểm tra full active parent chain | Draft/orphan/mismatched content có thể được action nhận dù UI không expose | One bounded joined read + equality/status checks; không thêm sequential round trip |
| Optimistic review queue không rollback | Failed write vẫn dequeue/show completion | Wait for confirmation hoặc explicit rollback; focused caller regression |
| Server-owned route payload refetch syllabus mỗi navigation | Correctness fix tạo extra work | Bounded aggregate/parallel reads, one RSC navigation, query/request evidence ở CP1/CP4 |
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
- Database-wide rejection of invalid learner-write relations (`LEARNING-INTEGRITY-001`); C2 chỉ bảo đảm approved application actions.
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
5. Current content RLS cannot safely gate question/card writes without changing learner/collaborator or historical-card eligibility semantics.
6. Removing auto-enrollment/progress initialization conflicts with a current documented enrollment/progress contract or requires payment/enrollment flow redesign.
7. Route trust cannot be achieved without changing final completion, multiple-correct-option or other exercise correctness semantics.
8. Shared B2/C1 projection reuse changes dashboard/overview output, ordering, pagination or status semantics.
9. Required browser state is not reproducible from canonical fixtures and a seed change would exceed narrow local/test-only scope.
10. Implementation needs `components/ui/**`, proxy/middleware, package changes, global 404, broad mobile navigation or unrelated workspace redesign.
11. Focused tests expose a pre-existing blocker whose ownership cannot be separated from C2.

Rollback cho implementation sau này là revert CP4→CP1 commits như một coherent C2 PR. Theo plan hiện tại không có database rollback vì không có migration/RLS/seed change.

## 11. Documentation và progress ownership

- `implementation-plans/c2/plan.md`: exact C2 contract, checkpoints, verification, outcome evidence và deviations.
- `implementation-plans/c2/owner-review-brief.md`: decision surface/quyền ngắn gọn; không override detailed plan.
- `implementation-plans/README.md`: định tuyến C2 thành active implementation plan sau P0.
- `progress.md`: C1 merge status, C2 planning/implementation/checkpoint/verification status.
- `problems.md`: close `WORKSPACE-001` chỉ sau CP4; giữ `PROGRESS-001`, `PREVIEW-001`, `MEMORY-001`, `STUDENT-005`, `NAVIGATION-001` đúng ownership; `LEARNING-INTEGRITY-001` sở hữu future DB-wide write relation enforcement tách khỏi completion semantics.
- `plan.md`/ADR: chỉ cập nhật current orientation và durable C2 clarification; không rewrite accepted history.

Mọi deviation material về access, result states, DB enforcement, write boundary, scope hoặc verification phải được reconcile vào detailed plan và re-reviewed trước implementation tiếp theo.

## 12. Completion criteria

C2 chỉ hoàn tất khi:

1. Cả course/topic route params được parse và exact route-access-content relation được server chứng minh.
2. URL là source of truth; sidebar/previous/next/direct/refresh/back/forward cùng một contract.
3. Invalid/unavailable/unenrolled/error không fallback và có feedback/CTA rõ, privacy-safe.
4. Topic-local state không stale qua route changes.
5. Affected progress/review writes không dùng client topic identity trước authorization/relation validation; question-option membership được kiểm tra; card review không còn auto-enrollment hoặc progress initialization; write failure không bị báo success.
6. B2 dashboard và C1 overview semantics/regressions giữ nguyên.
7. Question answer giữ current correctness semantics và query cost; card review query/write path đạt bounded budget, không N+1/sequential relation waterfall.
8. Focused action/schema/component/helper tests, TypeScript, targeted lint và diff checks đạt.
9. Full Vitest, focused seeded C2 Playwright, production build và manual state matrix đạt hoặc remaining environment limitation được ghi rõ và verdict bị giới hạn tương ứng.
10. Docs/status/problems phản ánh evidence thực tế; không close deferred issues hoặc claim DB-wide invariant.
11. Formal self-review không còn `Critical`/`Required`; specialist default `0` trừ khi main review còn một hard-risk cluster đủ điều kiện và có explicit permission.

## 13. Implementation handoff

### Approved goal

Biến nested learner workspace thành route URL-owned, exact-access, history-correct và no-fallback, giữ nguyên C1/B2 semantics và deferred feature boundaries.

### Dependencies and required order

`C1 merged @ 3cb7a9f` → CP1 read/access → CP2 writes → CP3 UI/navigation → CP4 browser/docs. Không parallel.

### Relevant contracts

- C1 explicit auth/enrollment/result pattern.
- B2/C1 active published topic ordering.
- Existing `has_course_content_read_access` content RLS as defense layer, không thay explicit learner enrollment check.
- Existing learner-write RLS chỉ self-own; application guard không được mô tả thành DB-wide integrity.
- Question/card bounded reads verify active parent chain and denormalized course consistency without client topic identity or sequential relation queries.
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
- Application write guards do not claim a new database-wide progress/answer invariant; `LEARNING-INTEGRITY-001` owns that future decision.
- Existing content RLS intentionally also permits admin/collaborator access. C2 route remains enrolled-learner-only; shared answer/review actions retain current content-access gate unless implementation evidence proves learner-only writes are required, which is a stop condition.

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

Verdict lịch sử: **Pass — không còn finding `Critical` hoặc `Required` trong planning scope C2**. Owner sau đó đã phê duyệt implementation tại plan commit `237ad103`; verdict planning không tự cấp PR, merge, deploy hoặc database permission.

Specialist decision mặc định: **0 specialist**. Discovery có security-sensitive route/write facts, nhưng repository evidence và main-agent integration review đủ để define bounded checkpoints và explicit DB/preview stop conditions. Không còn một unresolved hard-risk question cần specialist để planning package trở nên trustworthy; implementation review sẽ đánh giá lại từ actual diff/evidence.

## 15. Owner-decision validation review — 2026-08-19

Pass này re-investigate sáu intended directions bằng current actions/callers, schema/FKs, RLS/helper, migrations, fixtures, tests, Git history và browser harness. Main integration review tìm thấy các plan gaps sau và đã reconcile trong planning permission:

- **Bắt buộc (`Required`) — resolved:** topic syntax từng được classify trước auth/course/enrollment, trái parent-before-child/access-aware precedence. §4.2–4.3 nay defer child classification nhưng vẫn tránh topic DB read.
- **Bắt buộc (`Required`) — resolved:** CP2 chưa explicitly sở hữu `submitQuestionAnswer` option membership, parent-chain consistency và failed-upsert handling. §4.4/CP2 nay giữ one-read cost và current scoring semantics.
- **Bắt buộc (`Required`) — resolved:** card plan còn cho phép progress initialization và chưa yêu cầu ReviewSheet rollback/confirmation. §4.4/CP2 nay remove progress/enrollment writes, client topic identity và false-success behavior.
- **Bắt buộc (`Required`) — resolved:** plan chưa tách application-path guarantee khỏi current DB/RLS limitations. `LEARNING-INTEGRITY-001` được tạo làm future owner; C2 không thêm migration hoặc claim direct-Data-API protection.
- **Đề xuất (`Suggestion`) — resolved:** performance requirement chưa có current/target query paths hoặc evidence method. §4.7 thêm bounded budgets và browser-vs-server evidence boundary, không tạo benchmark framework.
- **Đề xuất (`Suggestion`) — resolved:** workspace back action chưa được chốt theo C1 overview/accessibility. §4.5/CP3/QA matrix nay chốt `/learn/[course-slug]` + accessible label; existing brand giữ `/`.

Review verdict lịch sử: **Pass — `0 Critical`, `0 Required` còn mở trong planning package sau reconciliation; Suggestions đã được áp dụng.** CP1 action tests sau đó chứng minh final PostgREST success composition `1 auth + 3 DB`, và CP4 isolated seeded runtime xác nhận aggregate tương thích current schema/RLS. Docs-only validation gates được giữ làm historical evidence; implementation gates được ghi tại §16.

## 16. Implementation outcome — 2026-08-19

### Checkpoint evidence

| Checkpoint | Commit/evidence | Outcome |
| --- | --- | --- |
| CP1 | `bc1cd93` | Strict `getLearningWorkspace` result/DTO; parent-before-child access precedence; exact course-topic-chapter/content relation; learner-safe aggregate; success budget `1 auth + 3 DB`. |
| CP2 | `9682389` | Parsed and bounded progress/question/review writes; selected-option membership; checked mutations; review `cardId + rating`; no auto-enroll/progress-init; caller failure behavior coherent. |
| CP3 | `a3191b5` | Page consumes trusted result; URL owns topic; canonical sidebar/previous/next; route-key resets local state; accessible loading/feedback; legacy read/history paths retired. |
| CP4 | Working completion checkpoint | Dedicated C2 smoke, narrowed C1 smoke ownership, 375px navigation wrap, status/problem/ADR/master-plan reconciliation and final gates. |

### Final automated/runtime evidence

- Focused CP1: `36/36`; focused CP2: `27/27`; focused CP3/integration regressions: `43/43`.
- Full Vitest post-review: `46 files / 415 tests` pass.
- `npx tsc --noEmit --incremental false`: pass.
- Targeted ESLint across all C2 TS/TSX and smoke files: pass.
- Isolated seeded Playwright: C2 `3/3`; C1 regression `3/3`.
- `npm run build`: pass after approved network rerun fetched the repository's existing Google Fonts; no code workaround.
- Runtime proved direct topic 2, cross-chapter sidebar topic 3, refresh, back, forward, previous, active/title/card coherence, parent focus and 375px no-overflow. Wrong-course/draft/removed/nonexistent/invalid topics share the privacy-safe unavailable state; nested unenrolled exposes no protected topic.
- Browser request evidence after login recorded zero `Next-Action` calls across ordinary topic navigation/history, confirming removal of the legacy client content/history Server Action waterfall. Action mocks own Supabase query-budget evidence.

### Scope reconciliation

Implementation matched the approved product/access semantics. The only narrow implementation refinements were naming the C1-compatible course absence literal `not_found` and wrapping the existing bottom navigation at 375px; neither changes business semantics. No stop condition fired, and no migration, RLS/RPC/policy, seed, generated database type, shared primitive, package, proxy or middleware change was required.

Remaining exclusions stay owned by their existing follow-ups: final completion/inert completion control, memory check, exercise correctness policy, preview/lock semantics, global 404, mobile account navigation and DB-wide learner-write integrity.

## 17. Formal implementation self-review — 2026-08-19

Review range dùng exact C1 merge baseline `3cb7a9f` tới cumulative C2 working state và kiểm tra intent/scope, validation/access, schema/RLS evidence, bounded queries, UI state/history, tests, comments/docs, Git ancestry và forbidden-file surface.

- Finding `Required` đã resolve: canonical seeded/historical `fsrs_meta` rows không có `learning_steps`, trong khi new parser từng bắt buộc field này và sẽ reject existing review cards. Parser nay default input thiếu field về `0`, write kế tiếp persist current FSRS shape; regression chứng minh existing-card update vẫn giữ two-request budget. Không migration hoặc algorithm change.
- Re-review evidence: focused review/profile/ReviewSheet `9/9`; full Vitest `46 files / 415 tests`; TypeScript; targeted lint; post-correction production build; C2/C1 seeded browser `3/3 + 3/3`; diff/link/stale/conflict/secret/forbidden-surface audits đạt.
- Final findings còn mở: `0 Critical`, `0 Required`, `0 Suggestion` trong C2 scope. Specialist `0`; không còn hard-risk evidence gap.
- Verdict: **Implementation review passed; manual QA pending**. Observable route/history/access/mobile-overflow/focus behavior đã được browser automation xác minh; subjective visual polish và full keyboard walkthrough là confidence-building QA còn khuyến nghị, không phải blocker theo owner instruction/current risk.
