---
title: "Q7 — Internal previewer access correction"
wave: Q7
branch: docs/student-user-flow-q7-plan
base: "origin/main @ 5e0cbc3fc11ee7de58d510f24b09ac543b695657"
dependency: "D1 merged through PR #98; D1 documentation reconciled through PR #100"
parent: ../../plan.md
progress: ../../progress.md
problems: ../../problems.md
---

# Q7 Implementation Plan — Internal previewer access correction

## 1. Mục tiêu và ranh giới quyết định

Q7 đóng quyền **internal previewer-only** đọc topic chưa publish (gồm media) và ghi persistent learning state khi chưa enroll, ở cả Server Action lẫn RLS/Data API. Một collaborator hợp lệ vẫn có thể xem course active ở `draft|pending|published`; previewer-only chỉ đọc nội dung topic active `published`. Enrollment là quyền học tập độc lập, không được suy ra từ course membership; previewer/collaborator đồng thời đã enroll vẫn ghi bình thường nhờ enrollment. Đây là bounded authorization correction sau D1, trước D2 public preview, không phải rollout toàn bộ collaborator hoặc preview feature.

Owner đã chốt ba quyết định Q7 ở §3. Đây là canonical Q7 detail-plan contract, không cấp quyền triển khai, migration, `db push`, push hay merge. Implementation phải dừng nếu P0 phát hiện existing media/exposure không thể đưa về bảo vệ theo contract mà không cần thêm quyết định hoặc phạm vi ngoài Q7.

Kích thước sau discovery: **large/high-risk** do read boundary đi qua RLS, `SECURITY DEFINER` RPC, Server Actions, Storage và persisted URL consumers; write boundary đi qua learner Actions và ba learner-table RLS policies. Ưu tiên một Q7 vertical PR vì read/write cùng một authorization outcome; nếu P0 media inventory chứng minh cần migration dữ liệu/tài sản ngoài repo hoặc remediation không thể hoàn tất trong một PR an toàn, tách prerequisite có acceptance rõ, nhưng không claim Q7 hoàn tất trước khi media được khóa.

## 2. Nguồn sự thật và sự thật đã xác nhận

- [Master plan](../../plan.md) §Wave D và [progress](../../progress.md) đặt Q7 sau D1, trước D2; Owner chốt Q7 enforce enrollment cho persistent learning-write ở cả Action và RLS/Data API. [Problems](../../problems.md) `LEARNING-INTEGRITY-001` giữ các DB-wide relation/correctness invariants **ngoài** lookup `target -> course_id -> enrollment`; `PREVIEW-001` giữ public preview, marker và quota.
- [D1 canonical plan](../d1/plan.md) §3.3–3.4 cấp `previewer` thuộc authoring group quyền edit topic content và cấp reviewer có `can_review_topics` quyền review; course role không đồng nhất với topic authoring/review capability. Q7 không được xóa những quyền này bằng một predicate `role <> previewer` toàn cục.
- `has_course_content_read_access(course_id)` trong `20260609114505_remote_schema.sql` trả `true` cho mọi course collaborator (gồm previewer) trước khi xét enrollment, không nhận topic ID hoặc xét topic status. `SELECT` policies của `topics`, `cards`, `exercises`, `question_groups`, `questions`, `question_options` dựa vào helper cấp course; chapter SELECT cũng dùng helper đó. Không thấy migration sau đó thay các policy hoặc helper này trong source tree tại baseline.
- `has_course_topic_read_access(course_id)` và `get_topic_workflow_state(topic_id)` là `SECURITY DEFINER` riêng của D1. RPC workflow chấp nhận mọi active collaborator trên active course/topic; nó trả title, status, readiness, authorship/review metadata. `d1_topic_structure_capabilities(topic_ids)` cũng dùng course-level topic read helper. Vì vậy chỉ đổi content-table RLS sẽ không khép các đường đọc D1 này.
- `getChaptersByCourseId`, `getTopicsByChapterId`, `getCardsByTopicId`, `getExercisesByTopicId` đọc qua RLS; `getCourseDashboardReadiness` hiện chủ ý cho previewer vào dashboard và truy vấn cả draft/pending topic, card/exercise/question graph. `CourseStructureWorkspace` đặt `isReadOnly` theo course role `previewer`, trong khi Builder lấy topic-scoped `canEdit` từ D1. Plan phải giữ hai capability khác nhau và kiểm tra tác động tới dashboard/Builder.
- `updateStageProgress`, `submitQuestionAnswer`, `submitCardReview` parse input và kiểm tra auth/active published parent chain, nhưng không kiểm tra enrollment trước mutation. Learning workspace route có cổng enrollment riêng, song gọi Action trực tiếp không đi qua cổng này. RLS `user_topic_progress`, `user_question_answers`, `user_flashcards` chỉ kiểm tra `auth.uid() = user_id` cho INSERT/UPDATE; Data API trực tiếp hiện bypass enrollment và thuộc Q7 theo quyết định Owner mới.
- `user_topic_progress.topic_id -> topics.course_id`, `user_question_answers.question_id -> questions.course_id`, `user_flashcards.card_id -> cards.topic_id -> topics.course_id` đều có FK/PK point lookup; `enrollments(user_id, course_id)` có unique constraint và thêm index cùng cặp cột. Không có `course_id` trên learner-state tables hoặc `cards`; không cần thêm để enforce Q7. `enrollments` hiện không có cột trạng thái: existence của row là enrollment theo schema hiện hành.
- Bucket `question_group_images` và `question_group_audios` đang `public=true`, với Storage SELECT policy `TO public` theo bucket; upload route và UI lưu/render public URL. [Supabase Storage docs](https://supabase.com/docs/guides/storage/buckets/fundamentals) xác nhận public bucket cho phép người biết URL tải object mà không qua read RLS. Ngoài ra `isValidQuestionGroupMediaUrl` chấp nhận HTTPS ngoài Storage nếu đuôi file hợp lệ; private bucket không thể bảo vệ các external URL đã lưu. P0 phải inventory persisted URLs và CDN/cache trước migration. [Supabase docs](https://supabase.com/docs/guides/storage/cdn/smart-cdn) cũng nêu signed URL/cached response không phải cơ chế thu hồi tức thời.
- `supabase/seed.sql` đã có previewer có review grant, draft topic của D1 và enrolled/unenrolled learner fixtures, nhưng chưa chứng minh đủ matrix `previewer-only`/authoring-group/reviewer/enrollment trên các course status. Integration tests hiện có cho D1 authorship/role và C2 learner actions; Q7 cần regression DB thật riêng.

## 3. Quyết định Owner đã chốt và ranh giới còn mở

1. **Media confidentiality:** Có; Q7 phải bảo vệ cả image/audio gắn với draft/pending trước người chỉ biết public URL. Không thể chỉ sửa content-table RLS hoặc phát signed URL dài hạn rồi claim revocation. Existing external URL/previously distributed copies và cache có thể không thu hồi được hồi tố; P0 phải inventory, nêu giới hạn vật lý này và dừng nếu rollout không thể đạt quyền truy cập tương lai theo contract.
2. **D1 independent capabilities:** Có; `previewer` còn là original creator/responsible/contributor hoặc reviewer được grant giữ quyền D1 trên draft/pending đúng topic scope. Chỉ `previewer-only` bị giới hạn published topic; không dùng predicate `role <> previewer` toàn cục.
3. **Direct Data API learner-write:** Có; Q7 phải enforce enrollment trên cả ba Server Actions và `INSERT`/`UPDATE` RLS của ba learner-state tables. Chỉ chứng minh `target learning object -> course_id -> enrollments(user_id, course_id)`; không nhập option ownership, server-derived correctness, toàn parent-chain consistency, active/content relation hoặc completion semantics từ `LEARNING-INTEGRITY-001`.

Contract còn điều kiện dữ liệu: không có inventory persisted media trong repository đủ để kết luận mọi URL đã lưu đều do Storage kiểm soát. P0 implementation phải kiểm tra dữ liệu ở môi trường được cấp quyền trước khi chọn migration/remediation; không tự vận hành trên remote DB theo plan này.

## 4. Contract Q7

### 4.1 Ma trận read theo tư cách, không chỉ role

| Actor và trạng thái | Course basic/structure | Topic content/media | Ghi learning state qua Actions và Data API |
| --- | --- | --- | --- |
| Guest hoặc authenticated outsider, course draft/pending | Không có protected read | Không | Không |
| Active previewer-only, course active `draft|pending|published` | Có course/structure cần thiết cho internal preview | Chỉ topic active `published` cùng active chapter/course | Chỉ khi **cũng** có enrollment hợp lệ theo learner contract; membership không cấp quyền ghi |
| Previewer có topic authorship/review capability D1 | Giữ đúng scope D1 | Topic draft/pending chỉ theo capability được giữ, không mở toàn course | Vẫn cần enrollment độc lập |
| `owner|co_owner|editor` active | Giữ authoring/read boundary D1 | Giữ quyền D1, không dùng Q7 để thu hẹp nhầm | Chỉ khi cũng có enrollment hợp lệ |
| Enrolled learner ở published active course | Giữ C1/C2 learner path | Published active topic | Có, theo existing learner contract |
| Removed course/chapter/topic, removed profile hoặc revoked membership | Không cấp quyền mới | Không qua Q7 | Không cấp quyền mới |

Course status không được thay topic status. `can_review_topics` cũng không phải enrollment. Preserve admin moderation/maintenance boundary của D1, nhưng không dùng global `admin` để tạo learner-write authorization. Không mở public/anonymous content read; đó là D2.

### 4.2 Database read boundary

- Bổ sung migration mới (không sửa migration đã publish) để biểu đạt **topic-scoped effective read** cho từng row topic/child. Kiểm tra active course, chapter, topic, profile/membership và đúng status/capability; không thay `has_course_content_read_access(course_id)` thành một boolean cấm toàn course vì chapter/basic course readers và D1 callers cần semantics khác.
- Audit `USING` của `topics`, `cards`, `exercises`, `question_groups`, `questions`, `question_options`; join qua đúng parent topic, không tin `course_id` denormalized độc lập khi quyết định quyền. Xem cả policy SELECT bổ sung: RLS policy `OR` có thể mở lại row bị policy mới hạn chế. Giữ staff/learner paths hợp lệ và removed-row semantics; kiểm tra UPDATE cần SELECT policy còn thấy row được phép sửa.
- Audit `has_course_topic_read_access`, `get_topic_workflow_state`, `d1_topic_structure_capabilities` và các `SECURITY DEFINER` read RPC có thể bỏ qua RLS. Với previewer-only, trả đúng metadata tối thiểu của published topic hoặc từ chối ở nguồn; với D1 exceptions, giữ contract đã được Owner xác nhận. Rà `EXECUTE`, `search_path`, auth/permission và return shape, không thêm public RPC chung để che policy thiếu.
- Audit `getCourseDashboardReadiness` và các teacher read Actions cho previewer: khi row draft bị RLS ẩn, dashboard phải biểu đạt trạng thái không có quyền hoặc reduced summary đúng contract, không báo sai readiness do partial graph. Đánh giá cache/DTO/UI chỉ sau khi DB read shape ổn định.

### 4.3 Learning-write boundary — cùng invariant ở hai lớp

- Tại cả ba Actions `updateStageProgress`, `submitQuestionAnswer`, `submitCardReview`, sau parse/auth và trusted target/course resolution phải kiểm tra `enrollments` của **cùng actor và course** trước upsert/insert/update; denied path không có mutation và dùng safe result shape hiện tại. Không suy ra enrollment từ previewer/author/reviewer/admin capability. Giữ các parent-chain/status checks hiện có của Actions, nhưng không mang chúng vào Q7 write RLS.
- Migration mới thay **đúng sáu** permissive `INSERT`/`UPDATE` policies của `user_topic_progress`, `user_question_answers`, `user_flashcards` (không chỉ thêm một permissive policy vì chúng OR với nhau). Mỗi `INSERT WITH CHECK` và `UPDATE USING`/`WITH CHECK` đòi `auth.uid() = user_id` **và** enrollment của course suy ra từ **row target ID**; `UPDATE USING` kiểm tra old target, `WITH CHECK` kiểm tra new target để không thể đổi `topic_id`/`question_id`/`card_id` sang course không enroll. Giữ `SELECT` self-owner hiện hữu để không làm biến mất historical rows khi unenroll; không tạo `DELETE` permission mới. Test cả `upsert` conflict-update path.
- Ưu tiên một helper predicate hẹp, ví dụ `private.q7_has_learning_target_enrollment(target_kind, target_id)`, với ba nhánh hằng `topic|question|card`, trả `false` cho kind/ID không hợp lệ; helper dùng `auth.uid()` nội bộ và lookup PK/FK như §2 rồi `enrollments(user_id, course_id)`. Không nhận caller-supplied `user_id`, không dùng dynamic SQL, `STABLE SECURITY DEFINER SET search_path = ''`, mọi object reference schema-qualified, revoke default `PUBLIC` execute, chỉ grant schema usage/function execute cho `authenticated`. `private` không nằm trong `supabase/config.toml` exposed schemas. [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security) nêu chính mẫu unexposed definer helper này cho policy cần đọc bảng khác mà không bị RLS của bảng đó lọc/recursion. Không tạo public RPC hoặc ba bản sao logic enrollment.
- Lý do không dùng inline policy join qua `topics`/`questions`/`cards`: các bảng đích có read RLS riêng và Q7 sẽ đổi visibility; một `SELECT` invoker trong learner-write policy có thể bị ẩn dù enrollment có thật, vô tình gắn write authorization vào content-read/status policy. Helper trên bỏ coupling đó nhưng chỉ trả boolean cho chính authenticated actor. Không thêm `course_id` vào learner-state tables/`cards`, index mới hoặc cache enrollment khi PK và unique `(user_id, course_id)` đã có; nếu local `EXPLAIN`/integration cho thấy vấn đề thật thì dừng đánh giá lại đúng path.
- Existing answer `questions.course_id` có thể không khớp toàn parent chain; Q7 chỉ dùng field đó làm course của target theo schema hiện có. Parent-course mismatch, option-question relation, client-supplied `is_correct`, active/content relation và direct Data API writes **của actor đã enroll** nhưng sai các invariant rộng hơn vẫn thuộc `LEARNING-INTEGRITY-001`. Q7 không báo chúng là đã an toàn. Enrollment revoke đã commit trước statement mới phải deny; không claim ngăn mọi concurrent snapshot race nếu không có transaction/lock contract riêng.

### 4.4 Storage/media boundary

- P0 inventory mọi persisted `question_groups.audio_url|image_url` **và** `cards.audio_url|image_url` (bucket URL, HTTPS ngoài Storage, path/reference, topic status, removed state) ở môi trường được cấp quyền và các code consumers. Card media columns hiện có trong schema/read model nhưng không thấy current authoring Action ghi chúng; phải xác nhận dữ liệu thực trước khi loại khỏi migration. New upload/validation phải ngừng phát/lưu public URL cho media cần bảo vệ; external URL không thể biến thành private chỉ bằng proxy, nên existing external media phải được copy/verify vào managed private storage trước rollout. Nếu nguồn không thể lấy/migrate an toàn, dừng và xin quyết định remediation; không tự xóa/clear hay âm thầm phá D1 content.
- Hai bucket question-group media phải chuyển sang private và bỏ public SELECT policies; dùng authenticated Storage read policy theo **topic effective read** đã chốt ở §4.2, đồng thời một authenticated server-mediated GET cho browser image/audio thay public URL trong read DTO. GET nhận group ID + media type, đọc persisted reference qua user-scoped RLS rồi derive bucket/path; không nhận arbitrary path/URL từ caller, trả private/no-store, và xử lý audio Range nếu current UI cần. Kiểm tra media của previewer-only draft/pending bị deny, D1 topic-author/reviewer và published learner vẫn đọc được. Tránh signed URL làm authority bền vì URL bearer và cache có thể sống qua revoke. Upload/replace/delete D1 phải tiếp tục hoạt động theo policy hiện hữu. Nếu card media thực tế tồn tại, cần cùng private-delivery boundary theo card/topic trước khi claim full topic-media confidentiality.
- Persisted legacy public URL cần được parse/normalize sang object path hoặc tham chiếu private trong các read/write consumers; old public URLs sau switch phải không còn serve từ Storage theo test thực tế. Không claim thu hồi được bản đã tải/cached ở client hoặc mọi edge cache hồi tố; kiểm tra cache behavior và tuyên bố residual giới hạn này trung thực. D2 public preview sau này phải tạo read delivery riêng theo D2 marker/gates, không mở lại bucket public vì Q7.

## 5. Phạm vi và thứ tự thực hiện đề xuất

Một Q7 PR, các checkpoint tuần tự (không song song trên shared permission model):

1. **P0 — Inventory/contract lock:** đối chiếu D1, C1/C2, D2; reproduce read/write bypass bằng authenticated client trên local DB. Chốt policy/helper/RPC inventory, permissive-policy OR audit, media URL/reference inventory và legacy migration strategy. Nếu external media không thể đưa vào private boundary hoặc old public URL không thể ngừng serve theo test, dừng trước rollout, báo đúng blocker; không làm migration/data cleanup mù.
2. **P1 — Read/media correction:** new migration cho topic/child SELECT và exposed read RPC; private Storage/read delivery cùng legacy URL compatibility. Preservation tests cho D1 authoring/review, published internal preview, enrolled learner và admin moderation. Không báo P1 đạt trước known-old-URL, external URL và media consumer tests.
3. **P2 — Persistent-write correction:** new migration thay đúng sáu learner-table write policies bằng self-owner + private enrollment helper; Action guards cho progress/answer/FSRS dùng trusted course/enrollment. Test direct Action, direct Data API và upsert/update chuyển target; giữ dual-role enrolled behavior.
4. **P3 — Consumer/QA closure:** reconcile readiness/structure/Builder và media DTO/UI với visibility mới; thêm focused UI tests khi output thay đổi, local reset/integration, manual role/state matrix; cập nhật progress/problem theo bằng chứng thực chạy.

Expected areas: new `supabase/migrations/*.sql`, `app/actions/progress.ts`, `app/actions/review.ts`, `app/api/question-group-media/upload/route.ts`, media GET route/schema/DTO/UI consumers cần cho private delivery, teacher read Actions/DTO/UI **chỉ khi** read-shape thay đổi, `__tests__/actions/*`, `__tests__/integration/*`, focused route/component tests, optional deterministic `supabase/seed.sql` fixture additions đã chứng minh thiếu, và current progress/problem records. Không sửa v2/v4 historical D1 plans, không mở public preview marker/quota, completion semantics, broad invitation/ownership, hay payment/auth routing.

## 6. Acceptance và verification chưa chạy

| ID | Observable acceptance | Lớp chứng minh nhỏ nhất |
| --- | --- | --- |
| Q7-A1 | Previewer-only thấy course active `draft|pending|published` và published active topic của course đó; không thấy structured content của draft/pending/removed topic qua Data API, direct Actions và D1 read RPC. | Local DB/RLS integration + Action tests |
| Q7-A2 | D1 actor có independent authoring/review capability không mất quyền đã chốt; previewer-only không thừa hưởng capability đó. | D1 integration regressions + focused Builder/read tests |
| Q7-A3 | Previewer-only không enroll gọi trực tiếp cả ba learning-write Actions đều bị từ chối và ba learner tables không đổi. Previewer/collaborator **đã enroll** vẫn ghi được. | Action tests + local DB persistence checks |
| Q7-A4 | Authenticated client gọi Data API trực tiếp không đọc được draft/pending topic content ở tư cách previewer-only; cùng client không thể `INSERT`/`UPDATE` ba learner tables khi target course không có enrollment, kể cả upsert conflict hoặc đổi target ID. Enrolled self-owner được ghi kể cả khi target read RLS ẩn row (chứng minh write helper không coupling với content visibility); other-user ID bị deny, helper không exposed làm public RPC. | Real read/write RLS integration, allowed/denied actors + exposed-schema check |
| Q7-A5 | Removed/revoked course, topic, chapter hoặc membership không mở lại content read; enrollment bị revoke trước statement mới chặn cả Actions lẫn Data API write, không sửa row cũ. `SELECT` own historical row vẫn theo contract hiện hữu. | Read/write RLS + Action regression |
| Q7-A6 | Public URL cũ của managed media draft/pending không còn serve sau private switch; biết path/URL không vượt quyền; external URL tồn đọng đã được xử lý trước release; authorized D1/published readers vẫn xem image/audio. Không claim thu hồi bản đã tải/cached. | Storage/GET integration + known-URL test + manual browser media QA |
| Q7-A7 | `getCourseDashboardReadiness`/structure/Builder không trả partial graph thành success sai, không làm hỏng D1 previewer authoring/reviewer flow. | Focused Action/component tests + manual role QA |

Verification implementation dự kiến: `npx supabase db reset --local --yes` trên local test instance sau khi kiểm tra config/đích; focused `npm run test:integration -- <Q7 and affected D1 files>` với guard `ALLOW_DB_INTEGRATION_TESTS=true`/local URL; direct authenticated Data API `INSERT`/`UPDATE`/upsert cases, Storage public/private URL checks, focused Vitest Action/route/component; local `EXPLAIN` nếu point-lookup cost có dấu hiệu bất thường; TypeScript `npx tsc --noEmit --incremental false`; targeted ESLint; `git diff --check`. Không dùng mocked DB để claim RLS đạt. Sau reset cuối, ghi residue sanity trước khi kết luận; không tự chạy `db push` hoặc dùng remote DB. Full suite/build khi diff shared boundary hoặc focused checks cho thấy cần. Đây đều là **planned**, chưa chạy trong planning branch.

### QA fixture readiness

- QA type: manual internal collaborator/learner role-and-status matrix; không phải visual redesign.
- Canonical fixture source: `supabase/seed.sql` và integration fixture helpers hiện có.
- Existing covered states: D1 reviewer previewer, D1 draft authoring, C2 enrolled/unenrolled và published/removed learner topics.
- Missing states: previewer-only trên course draft/pending/published với published/draft/pending topic cùng course; previewer + author/reviewer capability và previewer + enrollment; three learner-table insert/update/upsert/target-swap matrix; known public media URL, external URL và private GET.
- Required fixture additions: chỉ thêm deterministic local/test-only rows còn thiếu sau P0 inventory; ưu tiên integration per-test fixture, thêm canonical seed khi manual QA không tái lập được bằng seed hiện hữu.
- Reset/setup command: xác nhận local Supabase target rồi dùng documented local reset; không chạy trước khi implementation/fixtures được duyệt.
- Fixture checkpoint: P0/P1, trước browser/manual QA.
- Browser QA may begin when: focused automated checks xanh, fixture đủ matrix và app/local DB ổn định. Kiểm tra course/structure/Builder ở previewer-only, D1 dual-capability và enrolled actor; network/direct calls kiểm tra riêng qua integration, không suy từ UI ẩn nút.

## 7. Rủi ro, stop và handoff

- **Policy composition:** một permissive SELECT cũ có thể vô hiệu hóa restriction mới; inspect/drop/replace đúng policy, không chỉ thêm policy `AND` tưởng tượng. D1 `SECURITY DEFINER` có thể bypass table RLS.
- **D1 regression:** previewer course role vẫn có thể là topic author hoặc reviewer. Việc cấm theo role trần có thể làm hỏng D1; actor/capability matrix và D1 regression là bắt buộc.
- **Media URL:** public bucket và external HTTPS URLs hiện hữu khiến RLS không đủ bảo mật. Private bucket + server-mediated GET và kiểm soát new inputs là bắt buộc; P0 existing-data audit/compatibility là stop gate. Bản đã tải, client cache và edge cache cũ không thể bị xóa hồi tố chỉ bằng Q7.
- **Helper boundary:** inline join qua target tables trong write RLS tạo coupling với content-read RLS; private `SECURITY DEFINER` helper phải dùng caller identity nội bộ, fixed branches, pinned search path, không exposed RPC. Nếu thiếu grants hoặc owner không bypass RLS như dự kiến, migration test phải fail loud; không mở public helper để chữa lỗi.
- **Enrollment revocation:** Action precheck không thay DB enforcement. Test denied Action và direct Data API update row đã tồn tại sau revoke. Concurrent snapshot race không được hứa giải quyết nếu không có transaction/lock contract riêng.
- **Historical data:** chặn write mới không đồng nghĩa xóa historical learner rows; giữ self-owner SELECT, không cleanup hoặc đổi read retention nếu không có contract.
- **Q7 vs LEARNING-INTEGRITY-001:** Q7 đóng *cả* Action và Data API enrollment gate cho ba learner tables, nhưng không claim toàn bộ answer relation/correctness, parent-chain consistency, active/content relation hoặc final topic completion.

Implementation handoff chỉ hợp lệ khi plan được self-review/review theo lifecycle và Owner cấp quyền thực hiện riêng. Khi P0 phát hiện existing media URL không thể bảo vệ bằng giải pháp bounded, hoặc code/repo khác với những facts trên, dừng tại ownership/contract boundary; không tự nới Q7 sang D2 hoặc broad integrity. Local plan commit không phải implementation approval, push, PR, CI, migration apply remote hoặc merge permission.
