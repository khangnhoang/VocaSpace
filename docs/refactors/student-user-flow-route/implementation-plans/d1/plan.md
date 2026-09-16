---
title: "D1 — Topic Authoring, Review và Publication"
wave: D1
branch: feat/topic-publish-validation
base: "origin/main @ 5f43c65f4de2638dcbb6a0994826693d61971999"
dependency: "C2 merged through PR #96; current main also contains the Wave D documentation reconciliation"
parent: ../../plan.md
progress: ../../progress.md
problems: ../../problems.md
adr: ../../../../adr/refactor-student-user-flow-route-adr.md
---

# D1 Detailed Implementation Plan — Topic Authoring, Review và Publication

## 1. Mục tiêu, trạng thái và authority

D1 biến topic authoring hiện tại thành workflow cơ bản đáng tin cậy:

```text
create → draft (Builder/authoring phase) → request review → pending → approve/reject
```

Topic chỉ trở thành `published` sau khi reviewer hợp lệ approve. Request review chỉ được phép khi topic có ít nhất một active flashcard và ít nhất một active exercise, trong đó active nghĩa là `removed_at IS NULL`. `pending` là review state thật và phải đóng băng topic/content mà reviewer đang xem.
`authoring` không phải persisted status; persisted lifecycle của topic chỉ là `draft → pending → published`.

Đây là detailed implementation contract đã được Owner approve cho D1. Branch được tạo từ exact synchronized `origin/main` ở commit `5f43c65f4de2638dcbb6a0994826693d61971999`; correction hiện hành tiếp tục trên branch này. Remote migration, production-data mutation, push, pull request, merge và deploy vẫn ngoài authority.

Owner request hiện tại là source cho D1 decision surface; không tạo owner-review brief trùng lặp. [Master plan](../../plan.md) sở hữu program contract; [progress tracker](../../progress.md) sở hữu delivery status/evidence; [problems log](../../problems.md) sở hữu risk/constraint; file này sở hữu implementation contract, exclusions, checkpoints, acceptance và verification.

Kích thước đề xuất: **Large/high-risk**. Lý do là invariant đi qua Server Actions, teacher UX, nhiều content write surface, review/collaborator permission, Supabase RPC/RLS, migration/data compatibility và concurrency. Large không đồng nghĩa với quyền mở rộng sang Q7, preview hoặc revision system.

## 2. Phân loại evidence

### 2.1 Repository facts đã xác nhận

- `app/actions/topic.ts` có hai logical mutation actions liên quan status: `createTopic` gọi `create_topic_ordered` với caller-supplied `status`; `updateTopic` direct-update `title` và `status`. Không action nào kiểm tra readiness hoặc review transition.
- Teacher có ba entry points hiện tại dẫn tới status write: create/edit trong `TopicManagementSheet` và edit trong `SettingsTab`. Cả hai đều cho chọn `draft`, `pending`, `published`; create chưa bắt buộc navigate vào builder.
- `lib/course-readiness.ts` lọc active content bằng `removed_at == null`, nhưng chỉ phát hiện `topic_has_no_learning_content` khi thiếu đồng thời flashcard và exercise. Card-only hoặc exercise-only hiện không bị coi là thiếu readiness.
- `TopicBuilderTabs` hiện sở hữu tab và dashboard issue URL state, không sở hữu lifecycle/readiness/review state. Builder có các tab flashcard, exercise và settings.
- Flashcard writes nằm ở `app/actions/card.ts` (`createCard`, `updateCard`, `createBulkCards`, `deleteCard`) và `AddFlashcardDialog.tsx`/bulk dialog; exercise và child writes nằm ở `app/actions/exercise.ts`, gồm create/delete/basic update/question/group/option/media paths và RPC cascade/create paths.
- `supabase/migrations/20260609114505_remote_schema.sql` chỉ có `item_status = draft|pending|published`, `topics.status`, `topics.removed_at`, content `removed_at`, và `course_collaborators` với role hiện có. Không có topic review/history, submitted-by, rejection count hay delegated review capability.
- Topic-level authorship hiện chưa được mô hình hóa: `topics` không có immutable original-creator provenance hoặc current responsible-author reference; không có topic authoring-group/contributor relation, responsibility-transfer path, self-leave guard hay topic-authorship notification surface. Current workflow chỉ derive quyền sửa/gửi duyệt từ course membership role.
- `create_topic_ordered` trong `20260630090000_course_structure_ordering_rpc.sql` nhận `p_status`, được grant cho `authenticated` và `service_role`, nhưng không kiểm tra content readiness hoặc review lifecycle.
- Current RLS `Topics - Staff Update`, `Cards - Staff Update`, `Exercises - Staff Update`, child-write policies và `has_course_management_access` bảo vệ membership/management access, không bảo vệ status transition, pending freeze, readiness hoặc reviewer capability. Authenticated management caller có thể dùng Data API để direct-update các rows trong policy boundary.
- Current schema có trigger `set_updated_at_*`, không có trigger cross-table readiness/lifecycle. Không tìm thấy app restore action; direct update của `removed_at` vẫn là database concern.
- Topic review chưa có action/history. Course review metadata ở `courses` và admin review UI hiện là mock/unimplemented, không phải topic review path có thể reuse như supported behavior.
- Global admin hiện có platform-level read/maintenance surfaces riêng: `app/actions/admin-dashboard.ts` chỉ đọc; `app/admin/courses/page.tsx` dùng mock data và accept/reject ném `not implemented`; `app/actions/user.ts` dùng `service_role` cho user maintenance. Ở DB, `is_admin()` làm `has_course_management_access()` trả `true`, nên các staff RLS policy hiện mở direct course/content/collaborator writes cho admin. Chưa có topic moderation action/audit riêng.
- Global role và course collaborator role hiện là hai lớp schema độc lập: `user_role = admin|teacher|student`, `course_member_role = owner|co_owner|editor|previewer`. `course_collaborators` hiện chỉ có role enum, FK tới `profiles`/`courses` và unique `(user_id, course_id)`; không có CHECK/FK/trigger buộc collaborator phải có global role `teacher` hoặc phải có row `teacher_profiles`.
- Normal course creation hiện chưa theo Owner contract mới: `createCourse` gọi `create_course_with_owner`, RPC luôn tạo `draft` + owner row nhưng cho phép global `admin` hoặc `teacher`; policy `Insert courses v3` cũng cho phép hai role này. `student` bị RPC từ chối. Đây là current behavior/test evidence, không phải target D1.
- `/teacher` route middleware hiện chỉ chặn unauthenticated; `components/ui/header.tsx` chỉ hiện `Khóa học của tôi` cho global `teacher|admin`, còn `getCoursesForTeacher` query theo `course_collaborators` và không tự gate global role. `/teacher/courses/new` dùng cùng `createCourse`, và list page hiện luôn render CTA `+ Thêm khóa học`. `getCourseDashboardReadiness` đã kiểm tra local role `owner|co_owner|editor`, nhưng các topic/chapter/content RPC/RLS vẫn đi qua global-role-coupled `has_course_management_access`.
- Global `teacher` requirement ngoài course creation còn nằm trong `has_course_management_access` (sau nhánh admin), question-group media upload route/storage policies (`teacher|admin`), và các RPC/policy/helper content phụ thuộc management helper. Đây là implementation coupling cần tách khỏi course-local authoring; không tìm thấy product constraint độc lập nào yêu cầu `co_owner/editor` phải là global teacher.
- Existing tests cover topic CRUD/order, dashboard readiness (gồm soft-delete filtering), card/exercise CRUD/RPC/RLS và browser authoring smoke. Chưa có matrix cho topic review lifecycle, pending freeze, reviewer delegation, no-self-review, rejection threshold, published demotion hoặc concurrency.
- Create-navigation trace ở HEAD hiện tại không xác nhận list-based target: `create_topic_ordered` insert bằng `RETURNING *`, action trả `result.topic`, và `TopicManagementSheet` dùng `res.data.id` cho `router.push(getTopicBuilderPath(...))`; refresh danh sách chỉ là side effect hiển thị. Tuy vậy component test đang mock toàn bộ `TopicManagementSheet`, còn smoke/route tests chưa chứng minh behavior khi chapter có 0/1/nhiều draft; root cause runtime của bug báo cáo vẫn chưa được tái hiện.
- Không tìm thấy notification/inbox relation hoặc topic-authorship event subsystem hiện hành. Yêu cầu feedback sau transfer vì vậy là một implementation gap, không được ghi nhận như capability đã có.
- Existing course tests đang encode behavior cũ: `course-creation-rls.test.ts` gọi thành công admin create và chỉ từ chối student; fixtures authoring/RPC chủ yếu tạo profile `teacher`; media storage tests cho phép global admin/teacher và từ chối student. Chưa có test admin/student giữ collaborator role rồi đi qua normal authoring, cũng chưa có test navigation theo membership.

### 2.2 Existing approved contract

- Topic mới luôn `draft`; create UI chỉ nhận metadata cần thiết và CTA tiếp tục vào builder.
- Readiness chỉ gates request review: `>=1` active flashcard **và** `>=1` active exercise. Readiness không trực tiếp publish.
- `pending` là state review bị frozen; approve của reviewer hợp lệ mới chuyển `published`; reject bắt buộc reason và quay về `draft`.
- Không có role mới tên `reviewer`: `owner`/`co_owner` có implicit course-scoped review capability; `editor`/`previewer` chỉ có nếu được delegated capability.
- Submitter không được approve/reject submission của chính mình. Approve/reject kiểm tra effective permission tại mutation time.
- Collaborator role/membership transition không được làm pending submission mất reviewer hợp lệ cuối cùng.
- Rejection counter có scope `topic + submitted_by`. Sau lần reject thứ ba cho cùng submitter/topic, topic về `draft`, escalation vẫn unresolved, submitter bị chặn request review topic đó và bị chặn tạo topic mới trong course đó; không khóa account toàn cục và không khóa sửa content hiện có. Hold được derive từ escalation unresolved; owner/co_owner chỉ được initiate rescue hoặc thực hiện close/abandon, còn rescue hợp lệ chỉ được hoàn tất khi reviewer distinct approve.
- Rescue do owner/co_owner takeover tạo lifecycle mới với owner/co_owner là submitter `B`; submitter gốc `A` không được takeover, và reviewer `C` phải khác cả `A` lẫn `B` rồi mới approve. Rescue submission liên kết với đúng escalation và ghi `submitted_by_user_id = B`; chỉ approve submission liên kết đó mới resolve escalation. Với rescue, `resolved_by_user_id` là actor `C` hoàn tất terminal transition, còn initiator `B` được derive từ submitter của linked rescue submission. Close/abandon do owner/co_owner xác nhận, bắt buộc reason/audit, dùng semantics close/archive/soft-delete hiện hành và giải phóng hold. Submitter gốc không thể tự rename/delete/clone để né hold; delegated reviewer không initiate hoặc resolve escalation.
- Global `admin` không có implicit topic-review authority; admin phải có active course membership và effective course-scoped review capability như user khác.
- Global roles và course roles là độc lập. Normal course creation chỉ dành cho global `teacher`, tạo course `draft` và owner membership; global `admin` hoặc `student` không được dùng normal teacher flow để tạo course. Admin create-on-behalf là operation tương lai, ngoài D1.
- Course-local authoring derive từ active membership: `owner`, `co_owner`, `editor` được author; `previewer` không author và chỉ internal preview/read-only. Global `teacher`, `student` hoặc `admin` không tự cấp authoring, nhưng cũng không được suppress quyền local của membership hợp lệ.
- Global `student` có thể là collaborator `co_owner`, `editor` hoặc `previewer` và nhận đúng local authority; student `co_owner` author + implicit review, student `editor` author + review khi có flag, student `previewer` không author + review khi có flag. Global `admin` có membership cũng behave đúng role local; admin không membership không normal-author.
- Delegated topic review lưu bằng `course_collaborators.can_review_topics boolean NOT NULL DEFAULT false`; owner/co_owner derive từ role, editor/previewer cần flag `true`, flag không override role. Downgrade co_owner phải clear flag atomically; removal xóa membership row và capability biến mất.
- Ba authority phải tách biệt: course authoring authority theo membership role; course-scoped topic review authority theo effective reviewer capability; global admin moderation/maintenance authority theo platform role. Admin moderation không phải review, không tăng rejection counter/budget, không phát ra approve/reject event và phải có audit riêng gồm actor, target, action, reason, previous state và time.
- Admin không thuộc course không được request review, approve/reject, tính là eligible reviewer hoặc dùng global role để bypass no-self-review, pending freeze hay readiness. Admin vẫn được trusted moderation/takedown/maintenance theo schema hiện có: demote `published` course/topic về `draft` có reason, soft-delete/takedown topic/course/chapter qua `removed_at`, và invalidate/cancel pending review khi moderation làm candidate không còn hợp lệ. `chapters` hiện không có `status`, nên takedown chapter không được mô hình hóa thành lifecycle transition mới.
- Pending freeze chỉ chặn normal authoring/content/lifecycle mutation; moderation exception được phép qua trusted boundary. Moderation không được sửa lắt nhắt pending content rồi để review tiếp tục; nếu thay đổi semantics thì phải invalidate/cancel submission có audit. Admin không được direct-set `published`; maintenance edit published phải atomic demotion/approved maintenance result để learner không thấy content chưa approve như vẫn approved.
- Khi admin takedown topic đang có escalation mở, topic phải về `draft` + `removed_at`, pending/rescue submission bị cancel, escalation được resolve với action moderation và moderation audit riêng. Admin có thể cancel escalation/rescue về active `draft` bằng action moderation riêng, giữ lịch sử và không phát ra approve/reject event.

### 2.4 Correction owner steer đã materialize

- R1: global `admin` không được lấy privilege từ việc tự sửa `profiles.role`; authenticated direct update trên cột `role` bị revoke. Course creation và moderation vẫn kiểm tra role từ trusted profile state.
- R2: rescue có identity tuple `A` (submitter gốc), `B` (owner/co_owner initiate takeover), `C` (reviewer approve); `A != B`, `C != A`, `C != B`. Linked rescue submission ghi `submitted_by_user_id = B`; `resolved_by_user_id` trên escalation ghi actor `C` hoàn tất approval, không phải actor khởi tạo rescue. Ordinary approval không resolve escalation. Moderation resolution dùng `resolution_action = 'moderation'` và audit action riêng.
- R3: mọi mutation thành công trong Builder có thể làm thay đổi count/readiness/lifecycle đều refresh parent Server Component state, không chỉ create hoặc dashboard-context path.
- Request review bị chặn nếu không còn reviewer hợp lệ khác submitter; UI giải thích nguyên nhân và dẫn tới collaborator management.
- D1 có minimal persisted collaborator invitation flow: `pending|accepted|rejected|revoked`, accepted materializes membership, rejected/revoked terminal và re-invite tạo row mới; owner/co_owner gửi theo hierarchy, editor/previewer có thể mang `can_review_topics`, còn co_owner derive theo role. Cap `co_owner=2`, `editor=5`, `previewer=10`; pending invite là reservation trong cùng course lock, không persist counter; mọi role mutation làm tăng occupancy cũng dùng cùng cap và lock.
- Trước candidate revision system, published content mutation phải cảnh báo, yêu cầu explicit confirm, và content mutation + demotion về `draft` phải atomic. Published-topic soft-delete cũng cần explicit confirmation và atomic soft-delete + demotion về `draft`; restore luôn là active `draft`, phải request review + approve lại để publish. `pending` không cho delete/restore; draft delete/restore vẫn là draft.

### 2.3 Implementation implications and residual risk

- `authoring` là UX/workflow phase trên persisted `draft`, theo Owner contract; không thêm enum `authoring`.
- Application-only enforcement chỉ bảo vệ caller đi qua Server Actions. Với current RPC grants, direct Data API policies và service-role capability, nó không chứng minh database-wide guarantee.
- Published edit demotion là compatibility bridge trước future candidate revisions; không được thiết kế API khiến learner đọc draft mới thay cho published content.
- Current admin course page is mock/unimplemented, nên không được dùng làm bằng chứng moderation đã tồn tại. Nếu hardening RLS loại direct admin lifecycle writes, D1 phải cung cấp hoặc chỉ rõ trusted admin moderation/maintenance boundary tương ứng trong cùng implementation closure; không âm thầm làm mất platform maintenance authority.
- Không được dùng `has_course_management_access` làm semantic SSOT cho course authoring, topic review và admin moderation cùng lúc. D1 phải tách ba boundary; exact helper/function naming và migration ordering là P0 design, nhưng semantics membership-only authoring đã binding.
- Nếu media upload là một phần của normal exercise authoring (current route là một content write surface), `app/api/question-group-media/upload/route.ts` và storage policies không thể giữ global-role-only gate. Implementation phải truyền đủ trusted course/content context để kiểm tra membership; không cấp upload blanket cho admin không membership. Đây là affected closure/design risk, không phải lý do invent admin authoring.
- Route access và navigation phải phân biệt global role với local membership: global teacher có create affordance; admin/student chỉ vào normal workspace khi có active collaborator membership; admin không membership không có “Khóa học của tôi” chỉ vì role. Previewer có thể vào bounded read-only/internal-preview surface nhưng không nhận authoring controls.

## 3. Pre-D1 discovery snapshot: publish/write architecture

Các mục trong phần này là baseline discovery trước khi triển khai D1, dùng để giải thích vì sao các boundary bên dưới là cần thiết. Sau correction, supported end-user mutation đi qua trusted RPC/RLS boundary được mô tả ở các section implementation và không còn dựa vào direct lifecycle update.

### 3.1 Current supported publish-capable paths

Đếm theo logical application action là **2**; đếm theo teacher UI entry point là **3**:

| Path hiện tại | Entry point | Write boundary | Có thể set `published`? |
| --- | --- | --- | --- |
| Create topic | `TopicManagementSheet` create | `createTopic` → `create_topic_ordered(p_status)` | Có |
| Edit topic từ structure | `TopicManagementSheet` edit | `updateTopic` → direct `topics.update` | Có |
| Edit topic trong builder | `SettingsTab` | `updateTopic` → direct `topics.update` | Có |

Không tìm thấy topic publish action riêng, topic approve/reject action, hoặc supported admin topic-review action. `app/admin/courses/page.tsx` chỉ có mock course review handlers và ném `not implemented`; cũng chưa có topic moderation action/audit boundary. Seed/integration/E2E helpers dùng service-role hoặc admin client để tạo fixture, nhưng đó là test infrastructure, không phải supported end-user publish path; service-role về bản chất vẫn bypass RLS và không thể được dùng làm bằng chứng cho DB invariant.

Ở database boundary hiện có thêm hai cơ chế caller có thể dùng: authenticated được execute `create_topic_ordered`, và authenticated management caller được direct-update `topics` qua RLS. Hai cơ chế này không funnel qua một trusted lifecycle boundary. Đây là confirmed bypass, không phải giả định.

### 3.2 Read model và downstream consequence

Public read model và learner queries lọc topic `status = 'published'` + active. Vì vậy một invalid published topic có thể trở thành learner-visible dù thiếu một loại content; ngược lại, soft-delete content sau khi publish có thể làm published topic mất readiness mà current public read model không tự loại bỏ.

### 3.3 Current course-authority surfaces

| Surface | Current repository behavior | D1 target impact |
| --- | --- | --- |
| Normal course creation | `create_course_with_owner` và `Insert courses v3` cho `admin|teacher`; RPC tạo `draft` + owner | Chỉ global `teacher` được normal create; `admin`/`student` bị từ chối; admin on-behalf tách khỏi D1 |
| Teacher namespace guard | Middleware chỉ yêu cầu auth; header hiện link `teacher/courses` cho `teacher|admin`; list action đọc theo collaborator membership | Route/workspace access derive membership; create CTA chỉ global teacher; valid admin/student collaborator vẫn có entry; admin không membership không được masquerade teacher |
| Course overview/readiness | `getCourseDashboardReadiness` lọc local `owner|co_owner|editor`; previewer bị loại | Giữ local-role boundary, không thêm global teacher gate; admin/student collaborator phải hoạt động như cùng local role |
| Topic/chapter/content writes | RLS/RPC/helper dùng `has_course_management_access`; helper admin=true, non-admin yêu cầu global teacher + local role | Tách membership-only authoring boundary khỏi review và moderation; audit toàn bộ RPC/policy/action closure |
| Media upload | Route và storage policies cho global `teacher|admin`, không nhận course context | Nếu thuộc authoring closure, chuyển sang trusted course-scoped context; admin không membership chỉ moderation, không normal upload |

## 4. Final D1 lifecycle contract

| Transition | Điều kiện authoritative | Kết quả và side effects |
| --- | --- | --- |
| Create → `draft` | Authenticated creator có active course membership với role `owner`/`co_owner`/`editor`; `previewer` và admin/student không membership bị từ chối; input không có status lifecycle | Tạo topic draft; trả id; UI điều hướng trực tiếp tới builder |
| `draft`/authoring → request review | Topic active; caller có authoring permission; có ít nhất 1 active card và 1 active exercise; chưa bị rejection lock | Ghi submission/audit metadata; chuyển `pending`; freeze topic và toàn bộ content liên quan |
| `pending` → approve | Submission còn pending; actor có effective review capability hiện tại; actor khác submitter; state/row version vẫn hợp lệ; nếu có escalation thì submission phải liên kết đúng escalation và reviewer/takeover identities hợp lệ | Ghi reviewer/time/audit; chuyển `published`; chỉ linked rescue approval resolve escalation; learner đọc approved content |
| `pending` → reject | Submission còn pending; actor có effective review capability hiện tại; actor khác submitter; reason hợp lệ | Ghi reason/reviewer/time/audit; tăng rejection count; chuyển `draft` và mở authoring |
| `draft` sau reject → request review | Không vượt rejection threshold; readiness vẫn đạt; không bị lifecycle lock hoặc unresolved escalation hold | Tạo/refresh submission theo policy; chuyển `pending` và freeze lại |
| Reject lần thứ ba cùng `topic + submitted_by` | Submission còn pending; reject hợp lệ và counter đạt 3 | Topic về `draft`; escalation unresolved; submitter bị khóa request review topic đó và tạo topic mới trong course; existing content vẫn editable |
| Unresolved escalation → rescue | `owner`/`co_owner` là actor `B` khởi tạo; `B != A`; takeover được ghi nhận trong linked submission; tồn tại reviewer `C` khác cả `A` và `B` | Tạo submission mới có `rescue_escalation_id` và `submitted_by_user_id = B`; chỉ reviewer `C` approve thì hoàn tất rescue và xóa hold của submitter gốc; escalation ghi `resolved_by_user_id = C` |
| Request review không có reviewer khác | Caller có authoring capability/readiness nhưng không tồn tại active eligible reviewer khác submitter | Reject không đổi state/submission; UI dẫn tới collaborator management |
| Unresolved escalation → close/abandon | Chỉ `owner`/`co_owner`; reason bắt buộc; semantics close/archive/soft-delete hiện hành | Ghi audit, đóng escalation và xóa course-scoped creation hold |
| `published` → content/metadata edit | User xác nhận cảnh báo; mutation được phép; topic lock giữ ổn định | Trong cùng atomic boundary: demote `draft` + áp dụng mutation; không để mutation thành published silently |
| `published` → soft-delete topic | Explicit confirmation; topic lock giữ ổn định | Trong cùng atomic boundary: demote `draft` + set `removed_at`; không giữ hidden published state |
| Active deleted topic → restore | Restore được phép theo current role/parent semantics; không có pending freeze | Set active và giữ `draft`; không restore trực tiếp thành `published`; republish phải request review + approve |
| `pending` → content/status mutation | Không có | Reject transaction; không partial child write, status write, soft-delete hoặc restore |
| direct status input → `pending`/`published` | Không có | Reject ở schema/action và DB boundary; only request-review/approve transitions own publication writes. Admin demotion/takedown đi qua moderation boundary riêng, không phải direct publication input |
| Global admin moderation → published topic/course hoặc active chapter | Admin có platform moderation authority; không dùng review capability | Trusted moderation action có mandatory reason; demote topic/course theo `status`, takedown chapter/topic/course theo `removed_at`; audit riêng, không tăng rejection counter |
| Global admin moderation → pending topic | Admin có platform moderation authority; pending freeze không loại trừ takedown/invalidation | Trusted moderation action có thể invalidate/cancel pending review; không sửa child content lắt nhắt và không để submission tiếp tục như chưa bị ảnh hưởng |
| Global admin maintenance edit → published content | Admin action được phép theo maintenance policy; phải giữ learner approved-view invariant | Một atomic approved maintenance boundary demotes/updates as required; không direct-set `published`, không masquerade thành approve |

`authoring` không phải status enum mới trong D1 theo Owner contract: Builder mở trên topic `draft` và hiển thị workflow phase/readiness. Không được để client tự gửi `pending` hoặc `published` như CRUD field.

## 4.1 Topic-level authorship và responsibility contract (Owner steer 2026-09-16)

### Accepted contract

- Course-level authoring eligibility không đồng nghĩa với topic-level authorship/responsibility. Mỗi topic có immutable original creator provenance, đúng một current responsible author và tối đa hai contributor; course collaborator có quyền authoring nhưng không nằm trong topic authoring group chỉ được đọc topic draft.
- Topic mới gắn original creator làm responsible author ban đầu. Contributor chỉ được thêm qua trusted topic-authorship boundary; không tự động đưa toàn bộ course collaborators vào group. Responsible author được edit khi lifecycle cho phép và là người duy nhất được request/resubmit review. Contributor được edit khi lifecycle cho phép nhưng không được request/resubmit.
- Reject giữ nguyên responsible author; feedback được gắn với topic authoring group để contributor có thể hỗ trợ; chỉ responsible author resubmit. `pending` freeze và mọi readiness/publication rule hiện hữu vẫn áp dụng.
- Trước successful approval đầu tiên, reviewer exclusion áp dụng cho original creator, responsible author hiện tại, mọi contributor thuộc initial authoring group và mọi user từng giữ responsibility qua transfer trước lần approve đầu tiên. Remove/transfer không được dùng để né exclusion. Sau successful approval đầu tiên, exclusion này kết thúc; các vòng review sau chỉ áp dụng rule hiện hành, không có permanent historical ban.
- Owner/co_owner phải xử lý responsibility trước khi remove/downgrade một responsible author đang có topic chưa được approve. Recipient hợp lệ chỉ là owner/co_owner actor tự nhận hoặc contributor hiện hữu; không assign cho editor/collaborator bất kỳ. Membership mutation và transfer phải atomic, không để topic thiếu responsible author. Không invent owner-transfer feature mới.
- Khi responsible author tự leave course và còn topic chưa được approve, phải cảnh báo số lượng topic. Mỗi topic chỉ được giao cho contributor hiện hữu hoặc owner/co_owner; nếu không có recipient hợp lệ thì block leave. Bulk UI là optional follow-up, không thay đổi invariant.
- Responsibility transfer phải để lại feedback/notification có topic, course và context đủ để recipient biết việc cần xử lý; actor tự nhận không tự gửi notification cho chính mình. Kênh visual/animation cụ thể chưa thuộc contract.
- Contributor cap là tối đa 2 contributor/topic; responsible author không chiếm slot. Mọi add/remove/change path, kể cả invitation hoặc membership mutation có ảnh hưởng trực tiếp, phải đi qua trusted boundary.

### Baseline implementation and gap before amended checkpoints

- Before P0-A/P1-A, `get_topic_workflow_state` tính `canEdit` từ course role và `canRequestReview` từ `canEdit + draft + readiness`; `request_topic_review` cũng kiểm tra course authoring access, không kiểm tra responsible author. Baseline D1 khi đó chưa đáp ứng topic-level group, submitter restriction, initial-review exclusion hoặc transfer/leave invariant.
- Before P0-A/P1-A, `course_collaborators` role/capability RPC chỉ bảo vệ reviewer capability, role cap, last-reviewer safety và singular owner; removal/downgrade chưa transfer topic responsibility. Khi đó chưa có self-leave action, topic-authorship storage, append-only pre-approval responsibility evidence hoặc feedback surface.
- `topics` có một `id` authoritative và lifecycle/review history hiện có, nhưng review history không đủ để suy ra toàn bộ initial authoring group hoặc mọi pre-approval responsible user sau khi membership thay đổi. Đây là lý do authorship history tối thiểu là correctness data, khác với reviewer delegation history vốn không cần trong D1 cũ.

P0-A đã cung cấp schema/provenance, P1-A đã chuyển group/request/transfer/leave/reviewer-exclusion qua trusted boundary, và P2-A đã áp dụng cùng predicate cho toàn bộ content mutation closure.

### Minimal implementation boundary for reconciliation

- P0 phải chốt schema tối thiểu: immutable creator provenance; exactly-one current responsible author; active contributor rows tối đa hai; và immutable/pre-approval evidence đủ để enforce exclusion trước first approval. Exact table/column names là engineering gate, không phải Owner decision mới. Không dùng `course_collaborators.can_review_topics` để thay thế topic authorship.
- P1 phải đưa create, contributor mutation, responsibility transfer, self-leave validation, request/resubmit và reviewer exclusion vào trusted transaction/RPC boundary. Membership remove/downgrade và responsibility transfer dùng cùng course/topic lock; không direct Data API write được các field này.
- P2 đã áp dụng topic authoring group cho mọi content mutation đã nằm trong D1 closure: responsible author và contributor được edit khi lifecycle cho phép; user ngoài group bị từ chối dù role course có authoring capability; `pending`, published-confirm và restore/delete semantics không đổi. Direct Data API content triggers re-check group membership after the course/topic lock; legacy RPC arities are trusted wrappers rather than bypasses; topic ordering uses the requested topic group boundary.
- P3 phải expose group membership, responsible author, contributor cap, transfer/leave warnings, reject feedback và discoverable transfer feedback; create navigation phải luôn dùng authoritative newly-created topic id. Không mở full collaborator redesign, reviewer-preview workspace, animation hoặc visual polish.
- P4 phải chứng minh cả current lifecycle invariant và amendment này bằng action/RPC/RLS/concurrency/browser evidence; các PASS cũ chỉ được giữ như historical evidence cho contract trước amendment.

## 5. Readiness contract

Readiness là pure derivation dùng chung cho display và server precondition, nhưng server/DB transition boundary là authority cuối cùng. Chỉ đếm parent rows active:

```text
ready(topic) = active_cards(topic) >= 1 AND active_exercises(topic) >= 1
active(row) = row.removed_at IS NULL
```

| Active flashcards | Active exercises | Request review |
| ---: | ---: | --- |
| 0 | 0 | Reject, no state change |
| 1+ | 0 | Reject, no state change |
| 0 | 1+ | Reject, no state change |
| 1+ | 1+ | Allow request review; remain pending, not published |

Soft-deleted cards/exercises không tính. Nếu active cuối cùng bị soft-delete hoặc restore xảy ra gần transition, readiness phải được đọc lại trong cùng lock/transaction boundary; kết quả hiển thị ở UI chỉ là advisory.

## 6. Reviewer capability và collaborator boundary

### 6.1 Effective permission matrix

| Current course role | Review mặc định | Cần delegation | Ghi chú |
| --- | --- | --- | --- |
| `owner` | Có | Không | Derive từ role; raw flag không override |
| `co_owner` | Có | Không | Derive từ role; raw flag không override |
| `editor` | Chỉ khi `can_review_topics = true` | Có | Course-scoped boolean trên membership row |
| `previewer` | Chỉ khi `can_review_topics = true` | Có | Course-scoped boolean trên membership row |
| submitter của submission | Không cho submission đó | Không override | No self-review |
| global `admin` | Không mặc định | Chỉ nếu có membership + effective capability | Global moderation authority tách riêng; không có review bypass |

Effective permission phải derive từ current membership row + role + `can_review_topics` tại thời điểm approve/reject. `owner`/`co_owner` luôn có implicit capability; editor/previewer chỉ có khi flag `true`; flag `true` trên role khác không được cấp quyền. Role downgrade `co_owner → editor/previewer` phải clear flag atomically; explicit re-enable cần authorized delegation. Remove collaborator xóa membership row và mất capability ngay. Approve/reject phải re-check effective permission bên trong trusted mutation boundary.

Global profile role không phải là điều kiện bổ sung cho local capability sau khi membership hợp lệ tồn tại:

| Global profile role | Không có membership | Membership `owner`/`co_owner`/`editor` | Membership `previewer` |
| --- | --- | --- | --- |
| `teacher` | Không author/review; vẫn được normal course create | Local authoring; review theo local capability | Read-only/internal preview; không author |
| `student` | Không author/review; không normal course create | Local authoring/review đúng role và flag | Read-only/internal preview; review nếu flag |
| `admin` | Không normal author/review; moderation riêng | Local authoring/review đúng role và flag, không blanket privilege | Read-only/internal preview; review nếu flag |

Admin moderation không làm thay đổi bảng này: admin không membership chỉ có platform moderation/maintenance, không trở thành author/reviewer.

Review authority không đồng nghĩa moderation authority: admin không có course membership không được request/approve/reject, không là eligible reviewer và không được chạm no-self-review/pending/readiness guards bằng global role. Admin moderation phải đi qua boundary riêng, target đúng entity/status/`removed_at`, mandatory reason và moderation audit; event này không được ghi như rejection hoặc làm tiêu rejection budget.

### 6.2 Current gap và minimal D1 boundary

Current `course_collaborators` có một active membership row duy nhất theo `course_id + user_id`, nhưng trước correction chưa có `can_review_topics`; `addCollaborator` application action trả unsupported và `CourseForm` collaborator UI disabled, trong khi current RLS cho owner/co_owner/admin direct insert/update/delete. D1 correction bổ sung minimal persisted invitation boundary vì sole-owner dead-end cần một supported path để tạo reviewer hợp lệ; đây không phải independent delegation entity. Final D1 closure thêm partial unique index `course_collaborators_one_owner_idx` để enforce tối đa một `owner` cho mỗi course; supported course creation RPC là boundary tạo đúng một owner, còn `co_owner` là role dành cho membership đặc quyền bổ sung. Migration có duplicate preflight fail-closed và canonical seed không tạo owner thứ hai.

**Owner-approved minimal model:** thêm `can_review_topics boolean NOT NULL DEFAULT false` trực tiếp trên `course_collaborators`. Derive `owner`/`co_owner` từ role; chỉ editor/previewer dùng flag. Không thêm `course_reviewer_delegations`, grant/revoke history fields, expiry, per-topic scope hoặc generalized capability entity trong D1 vì chưa có requirement cần independent lifecycle. Role downgrade phải clear flag trong cùng transaction; removal xóa row. Course overview là UI entry point: compact collaborator summary + CTA mở management dialog/sheet; không tạo dedicated route/page và không biến `CourseForm` thành entry point thứ hai.

Collaborator role/delete/delegation mutation phải lock hoặc dùng cùng transactional boundary với pending submission để không xoá/hạ role reviewer cuối cùng ngoài submitter. Nếu chỉ còn submitter hoặc không còn reviewer hợp lệ, mutation collaborator phải reject. Không tự động chuyển ownership hoặc invent transfer. Safety check và flag clear phải là một transaction với role mutation.

Invitation lifecycle tối thiểu gồm `pending`, `accepted`, `rejected`, `revoked`; accepted insert membership trong cùng transaction, terminal rows không bị tái sử dụng và re-invite tạo row mới. Owner được mời `co_owner|editor|previewer`; co_owner chỉ được mời `editor|previewer`; editor/previewer không quản lý. Cap được tập trung ở một helper theo role (`co_owner=2`, `editor=5`, `previewer=10`); send và accept đều lock course, tính active membership + pending invitation, và không thêm `reservation_count`. Direct invitation writes bị revoke; authenticated invitee chỉ SELECT/accept/reject lời mời của mình, owner/co_owner SELECT/revoke lời mời thuộc course.

Invitation target resolution phải dùng email hiện tại của `auth.users` làm trusted identity source; `profiles.email` không được dùng để bind invitee vì profile row còn có thể bị caller chỉnh sửa. Invitee discovery đi qua bounded RPC chỉ trả lời lời mời của `auth.uid()` và kèm course title/slug cho UI. Normal course thumbnail upload dùng `create/<auth.uid>/<uuid>` staging path trước khi course tồn tại và `course/<course_id>/<uuid>` sau đó; Storage policy kiểm tra cùng global-teacher/course-membership authority với DB, còn Server Action phải preflight create authorization và cleanup object nếu mutation kế tiếp thất bại.

Reviewer delegation và topic authorship là hai relation khác nhau. `can_review_topics` chỉ trả lời “ai có thể review course-scoped”; nó không xác định “ai chịu trách nhiệm topic”, không lưu contributor group và không đủ để thực thi initial-review exclusion. Topic authorship phải có boundary/storage riêng tối thiểu, nhưng không biến thành generalized reviewer delegation entity.

## 7. Mutation matrix cho topic/content lifecycle

| Mutation family | `draft` | `pending` | `published` trước revision system |
| --- | --- | --- | --- |
| Topic title/metadata thay đổi | Cho phép | Block | Explicit confirm + atomic demotion nếu thay đổi làm approval semantics khác |
| Card create/update/bulk/delete | Cho phép | Block | Explicit confirm + atomic demotion |
| Exercise create/basic update/delete | Cho phép | Block | Explicit confirm + atomic demotion |
| Question/group/option/media mutation | Cho phép | Block | Explicit confirm + atomic demotion |
| Topic status CRUD input | Chỉ giữ draft | Block | Không cho direct status choice |
| Topic soft-delete | Explicit confirmation; soft-delete giữ draft | Block | Nếu published: atomic demotion về draft + soft-delete; không hidden published |
| Content/topic restore (`removed_at = NULL`) | Cho phép nếu permission/parent hợp lệ; topic restore thành draft | Block | Không restore published state; republish phải qua review/readiness |
| Topic authoring-group mutation | Responsible author/contributor theo group và lifecycle | Block | Group member được edit khi lifecycle cho phép; ngoài group read-only; mọi add/change/transfer giữ cap và exactly-one responsible author |
| Collaborator remove/downgrade/self-leave có topic chưa approve | Chỉ trusted transfer trước membership mutation | Moderation exception không thay đổi authorship semantics | Atomic transfer tới owner/co_owner hợp lệ hoặc contributor hiện hữu; không recipient thì block mutation/leave |

D1 phải audit mọi action/RPC trong các hàng trên, không chỉ last-card/last-exercise delete. Content mutation trên published phải có server-side confirmation token/intent; client flag đơn lẻ không đủ để bypass trực tiếp. Admin moderation/maintenance là boundary riêng với review event và không được làm yếu publication invariant.

Delete/restore của topic không được silently dùng như unpublish. Published soft-delete phải có explicit confirmation và atomic demotion; restore chỉ đưa topic về active draft. Pending delete/restore bị block; draft delete/restore giữ draft.

## 8. Unified authoring UX boundary

### 8.1 Create flow

- `TopicManagementSheet` bỏ status selector khỏi create/edit CRUD surface; create chỉ nhận metadata cần thiết và server luôn tạo `draft`.
- CTA chuyển thành dạng `Tạo và tiếp tục` hoặc tương đương, sau success push tới `getTopicBuilderPath(courseId, topicId)`.
- Không để dashboard feedback callback nuốt mất builder navigation. Error phải giữ modal và cho retry; success không cần user tự tìm topic trong structure.
- Discovery contract: target sau create phải là đúng `topicId` từ authoritative create result trong cả trường hợp chapter có 0, 1 hoặc nhiều draft. Không derive target từ `topics`, `topics[0]`, “current draft” hoặc thứ tự reload. `refreshTopics`, parent revalidation và dashboard feedback không được thay thế hoặc cạnh tranh với navigation này.
- Current evidence: RPC/action/component chain truyền exact returned id và không có draft selection code. Bounded Playwright smoke hiện đã kiểm chứng route arrival cho chapter có 0, 1 và nhiều draft; trong môi trường dev, việc refresh/feedback cạnh tranh với navigation tạo assertion-timing flake, nên create path đã return ngay sau authoritative `router.push` trước các side effect đó. Không claim đây là redirect product bug ngoài evidence smoke.
- Edit metadata của topic phải hiển thị lifecycle state và không expose pending/published as free-form select.

### 8.2 Builder shell

Builder cần sở hữu một shared topic lifecycle/readiness view bên trên các tab hiện tại:

- current state (`draft`, `pending`, `published`) và workflow phase/next action;
- readiness counts/checklist cho active flashcard và active exercise;
- CTA request review chỉ enabled khi ready, có pending/permission/error feedback;
- rejection reason/count và resubmission lock nếu có;
- reviewer panel chỉ hiện action approve/reject cho effective reviewer không phải submitter;
- pending frozen state giải thích vì sao add/edit/delete controls disabled;
- published mutation warning, explicit confirm và cancel no-op;
- loading, stale refresh, permission denied, mutation failure và retry states.

Tabs vẫn có thể giữ `flashcards`, `exercises`, `settings`, nhưng không được là ba CRUD island không biết lifecycle của nhau. `TopicBuilderTabs` hoặc parent server/client boundary phải nhận stable lifecycle/readiness DTO; exact split cần match existing async ownership sau khi implementation bắt đầu.

### 8.3 Flashcard redesign

`app/(teacher)/teacher/courses/[id]/_components/AddFlashcardDialog.tsx` cần được audit/redesign như một phần unified builder workflow, bảo toàn toàn bộ functional fields và validation. Mục tiêu là hierarchy/grouping/spacing/action continuity, visible validation, pending lock và published warning; không xoá field hoặc biến thành cleanup unrelated.

### 8.4 Exercise polish

`ExerciseTab`/`AddExerciseDialog` hiện cơ bản hoạt động. D1 chỉ polish các điểm cần cho lifecycle: disabled/frozen controls, readiness feedback, error/retry, consistent destructive copy và published confirmation. Không redesign exercise authoring hoặc thay exercise correctness semantics.

### 8.5 Collaborator review-capability surface

- Course overview là entry point duy nhất cho collaborator management trong D1. Hiện `CourseOverview` là server-rendered readiness surface; implementation cần bổ sung summary compact (avatar stack/count hoặc role counts) và CTA `Quản lý cộng tác viên`.
- CTA mở wide management dialog/sheet theo design system hiện tại, không tạo dedicated route/page. Row cần có avatar, name, email/identity, role, review capability và allowed actions.
- `owner`/`co_owner` hiển thị review capability là `theo vai trò`, không toggle. Owner/co_owner có thể toggle `Có thể duyệt topic` cho editor/previewer; raw flag không thể nâng role hoặc cấp quyền ngoài role.
- Role controls phải phản ánh hierarchy và hiển thị warning/block khi downgrade/remove gây mất reviewer hợp lệ cuối cùng. Management dialog gửi/revoke invitation, hiển thị trạng thái và cap policy; invitee có persistent discoverable panel để accept/reject. Không làm ownership transfer, email delivery, expiry/reminder hoặc broad collaborator redesign.
- Exact layout/component composition phải follow bounded audit bằng `frontend-design`/`frontend-workflow` khi implementation bắt đầu; plan không khóa visual details ngoài entry point, state và permission semantics.

### 8.6 Global/course route and navigation boundary

- `/teacher/...` là normal course authoring workspace. `/admin/...` là platform moderation/maintenance surface, không clone teacher authoring UI.
- `/teacher/courses/new` và normal `+ Thêm khóa học` CTA chỉ dành cho global `teacher`; create success luôn là course `draft` với creator là `owner`. Admin/student không được mở admin-on-behalf qua đường này.
- `/teacher/courses` có thể liệt kê các course mà authenticated user là active collaborator; valid admin/student collaborator đi vào cùng workspace theo local role. Admin/student không membership không được coi là author chỉ vì có global role; admin không membership cũng không nhận “Khóa học của tôi” chỉ từ role.
- Navigation cần có một entry hợp lệ cho collaborator không phải teacher mà không tạo namespace/UI thứ hai. Exact implementation có thể dùng membership-aware header/list affordance, nhưng server action/RPC/route access vẫn là authority cuối cùng.
- `previewer` không nhận authoring controls; nếu cần vào `/teacher/...`, chỉ trả read-only/internal-preview state theo current product surface, không mở content mutation.

## 9. Trusted boundary, DB/RPC/RLS và atomicity

### 9.1 Recommendation

**Recommendation: hybrid, DB-backed lifecycle authority.** Application UX nên dùng shared readiness derivation để hiển thị sớm và Server Actions để map stable result/error; các stateful transition và cross-table invariants phải đi qua DB transaction/RPC hoặc equivalent locked database boundary. RLS phải ngăn direct Data API bypass. Application-only không đủ vì repository đã xác nhận direct `topics` update và callable RPC có thể set/retain invalid status.

### 9.2 Minimal viable DB design cần plan cho implementation

Tên cụ thể có thể thay đổi sau schema review, nhưng boundary tối thiểu phải bao gồm:

1. Additive topic review submission/history storage: topic, submitter, submission lifecycle, submitted/reviewed timestamps, reviewer, rejection reason, rejection count keyed by `topic + submitted_by`, unresolved escalation/closure reason and audit actor/time. This is the minimum needed for the third-rejection hold, rescue and close/abandon; do not add candidate-revision machinery.
2. Additive `course_collaborators.can_review_topics boolean NOT NULL DEFAULT false`. Effective capability derives from current membership + role + flag; owner/co_owner are implicit, editor/previewer require `true`, and global role has no implicit review bypass. A partial unique index on `course_id WHERE role = 'owner'` enforces at most one owner; the trusted course-creation RPC supplies the lower-bound guarantee for supported course creation. Migration preflight must fail closed on existing duplicate owners. No independent delegation relation or grant/revoke history is required by the current contract.
3. Additive `course_collaborator_invitations` with terminal status history and a partial unique pending index per `course_id + invitee_user_id`. Send/accept/reject/revoke are trusted RPCs; accepted invitation inserts membership transactionally. Role caps come from one helper (`co_owner=2`, `editor=5`, `previewer=10`), and send/accept re-check active membership + pending reservations under a course advisory lock. No persisted reservation counter, expiry, email delivery or independent delegation relation.
4. Trusted transitions equivalent to `request_topic_review`, `approve_topic_review`, `reject_topic_review`, `resolve_topic_review_escalation` and the required collaborator mutation boundary, plus a separate `moderate_topic`/equivalent maintenance boundary for global admin. Rescue submission stores the exact unresolved escalation id; approval clears only that linked escalation and requires distinct `A/B/C` identities. Moderation transitions validate admin authority, target/current state and mandatory reason, can demote/takedown or invalidate pending review, resolve affected escalation as moderation, and write a distinct moderation audit event without touching reviewer rejection counters. Any unresolved escalation holds ordinary request/approval for the whole topic, including after responsibility transfer; close/abandon must cancel pending submissions before releasing the hold. Topic creation must derive unresolved escalation holds by `course_id + submitted_by_user_id`; do not persist a global `can_create_topic = false` flag.
5. Additive topic-authorship storage/boundary: immutable original creator provenance, exactly one current responsible author, at most two active contributors, and immutable evidence for the initial authoring group plus every pre-first-approval responsible author. Create initializes the group; trusted add/remove/transfer/self-leave paths enforce active course membership, role eligibility, cap and no-orphan responsibility. The current responsible author is the only request/resubmit actor; reviewers are separately governed by `can_review_topics`. Do not reuse reviewer delegation storage for topic authorship.
6. Replace the broad authoring gate with a membership-only course-authoring boundary for `owner`/`co_owner`/`editor`; `previewer` is read-only. This boundary must be shared by topic/chapter/content RPCs, RLS and Server Actions, and must not be inferred from global `teacher` or `admin`. Normal course creation remains a separate global-`teacher` boundary that creates `draft` + owner membership. Authenticated direct profile role update must not be able to elevate the global role used by those checks.
7. A single atomic boundary for published content mutation + demotion to draft and published-topic soft-delete + demotion + soft-delete. It must cover card, exercise, question/group/option/media and metadata mutation families, or a common transaction primitive that all supported callers use. The same boundary must apply topic-group membership checks before content writes. Persisted question-group media replacement/clear is DB-first under the topic lock; old Storage objects are cleanup after commit, and cleanup failure may leave an orphan but never a broken persisted reference.
8. RLS/policy hardening so authenticated generic direct updates cannot mutate lifecycle-owned `status`, mutate pending content, restore invalid published rows, bypass reviewer/readiness/authorship checks, mutate collaborator capability outside the authorized role boundary, or elevate `profiles.role`. Global admin moderation/maintenance must remain possible through an explicit trusted boundary for supported platform actions, including demotion/takedown, pending-review invalidation and escalation cancellation; that boundary may demote `published` to `draft` but must not publish. `service_role` remains an infrastructure bypass; supported application code must not expose it as an end-user mutation route.
9. Trigger, RPC, or equivalent DB guard for child soft-delete/restore, topic-authorship fields and direct writes where RLS cannot express the cross-table invariant safely. The choice between trigger and RPC is an implementation design decision, not an Owner blocker; row/advisory locking is required wherever readiness, reviewer safety, authorship transfer, invitation capacity or escalation hold is checked against concurrent mutation.

### 9.3 Required transaction/race guarantees

| Race | Required final guarantee |
| --- | --- |
| Request review vs delete last card/exercise | Either review sees committed ready content and freezes it, or delete commits first and review rejects; never pending with missing required content |
| Approve vs content/status mutation | One state transition wins under lock; approve cannot publish stale/unfrozen content |
| Published edit vs concurrent edit | One atomic demotion/mutation result; no partial content write while status remains published |
| Published topic delete/restore vs review/content mutation | Delete cannot leave hidden published state; restore cannot publish directly; one locked final state |
| Pending write vs child direct Data API/RPC | Child write rejected; no partial soft-delete/restore or question mutation |
| Admin moderation vs pending freeze | Moderation may takedown/invalidate, but cannot perform partial pending edits; affected submission is explicitly invalidated/cancelled and audited |
| Admin moderation vs open escalation/rescue | Topic takedown or escalation cancellation cancels active pending/rescue submission as needed, resolves escalation with moderation action and reason, and writes a separate moderation audit |
| Admin maintenance vs publication | Admin can demote/takedown or make approved maintenance edits, but cannot direct-set `published` or emit review approval |
| Approve/reject vs reviewer role removal | Effective permission rechecked under current lock; removed/downgraded actor cannot finish mutation |
| Collaborator change vs pending reviewer safety | Commit only if another valid reviewer remains, or reject change per approved policy |
| Third reject vs new topic creation/rescue/close | Hold and escalation resolution are serialized; original submitter cannot create a new topic until owner/co_owner rescue or close/abandon resolves it |
| Rescue identity vs approve | Rescue stores the exact escalation; original submitter `A` cannot rescue, takeover actor `B` cannot approve, and reviewer `C` must differ from both `A` and `B`; ordinary approval cannot resolve an escalation |
| Invitation send/accept vs collaborator capacity | Course advisory lock serializes active membership plus pending invitation reservation; accept rechecks the same cap before materializing membership and no reservation counter is persisted |
| Double submit/approve/reject retry | Idempotent/stale-state-safe result; no duplicate submission or second terminal transition |
| Global-role change vs existing membership | Local authoring/review follows membership; global role change must not silently grant/suppress local capability except normal course-create and platform moderation boundaries |
| Content mutation vs topic-group change | Group membership and content mutation use a consistent course/topic lock; an outside-group actor cannot commit content after losing membership |
| Ordinary media DELETE vs pending/reference change | A normal Storage DELETE uses the same course/topic lock and is denied for pending/removed/non-draft topics or persisted references; trusted DB-first clear/replace may clean the old object after commit, while global admin moderation remains a separate exception |
| Responsibility transfer vs collaborator remove/downgrade | Transfer and membership mutation commit together, or both roll back; every active topic retains exactly one responsible author |
| Self-leave vs unapproved topics | Leave is blocked unless each affected topic has a valid recipient; no random assignment or partial leave |
| Contributor add/change vs concurrent add/transfer | Topic lock and cap check serialize writes; active contributor count never exceeds two and responsible author does not consume a slot |
| First approval vs initial-review exclusion | Approval and exclusion-state transition are ordered in one trusted transaction; after first successful approval only future-cycle reviewer rules apply |

If a DB-backed solution cannot close a race, the plan must label the exact residual guarantee instead of claiming the invariant is absolute.

## 10. Migration and compatibility boundary

- Existing `item_status` enum remains `draft|pending|published`; `authoring` is only the Builder/workflow phase over `draft`, so no enum change is required.
- Before adding/enforcing a DB readiness invariant, run a deterministic inventory of every active published topic and its active card/exercise counts. If the inventory is empty, migration proceeds normally. If any invalid rows exist, there is no grandfather/legacy bypass: the migration contract requires remediation to `draft` so no invalid published row remains after the invariant is active. The exact rows must be reported before any destructive production remediation; this planning task grants no remote migration or production-data execution authority.
- The collaborator migration is additive: `can_review_topics` defaults to `false`; owner/co_owner capability is derived from role, not backfilled as a persisted `true` flag. Role downgrade and membership removal must clear/remove capability atomically.
- Topic authorship migration is additive and must preserve provenance. Existing topics need an explicit backfill/preflight policy for original creator, responsible author, initial group and pre-approval responsibility evidence; do not silently claim old topics satisfy the new exclusion invariant. If authoritative provenance is unavailable, fail closed or record the exact compatibility gap for Owner review before enabling the boundary.
- Existing course-level review metadata and mock admin review are not a topic review migration shortcut.
- Existing test fixtures that directly insert published topics remain useful for public-read/content tests, but D1 fixtures must distinguish valid published topics from intentionally invalid pre-migration rows and must not hide RLS gaps through service-role-only setup.
- Public learner reads must continue to use the last approved published content. D1 must not introduce a read path where draft/pending authoring content replaces published learner content.
- Future candidate revisions remain architecture direction only: published immutable learner view, separate editable candidate, pending/frozen candidate, reject editable, approve candidate publish + old revision retirement. Exact data model, migration and rollout are not decided and receive no D1 implementation.

## 11. Affected domains and likely files

| Domain | Current owners to inspect/change in implementation | D1 boundary |
| --- | --- | --- |
| Course creation and route access | `app/actions/course.ts`, `supabase/migrations/20260612100000_create_course_with_owner_rpc.sql`, `supabase/migrations/20260609114505_remote_schema.sql`, `app/(teacher)/teacher/courses/page.tsx`, `app/(teacher)/teacher/courses/new/page.tsx`, `components/ui/header.tsx`, `utils/supabase/middleware.ts` | Normal create: global `teacher` only, always `draft` + owner. Existing course list/workspace access follows active collaborator membership; global admin/student do not get blanket authoring, while valid admin/student collaborators retain local access. No admin on-behalf flow |
| Topic actions/schemas | `app/actions/topic.ts`, `lib/schemas/topic.ts`, `lib/course-authoring/routes.ts` | Remove client-owned lifecycle input; expose request/approve/reject and stable result errors |
| Readiness | `lib/course-readiness.ts`, `app/actions/course-readiness.ts` | Shared active-card + active-exercise derivation; topic builder DTO/action precondition |
| Teacher create/structure | `app/(teacher)/teacher/courses/[id]/_components/TopicManagementSheet.tsx`, `CourseStructureWorkspace.tsx` | Metadata-only create, direct builder navigation, state feedback |
| Topic builder | `app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicBuilderTabs.tsx`, `SettingsTab.tsx`, `FlashcardTab.tsx`, `ExerciseTab.tsx` | Shared lifecycle/readiness shell, pending locks, review actions, published warnings |
| Flashcards | `app/actions/card.ts`, `AddFlashcardDialog.tsx`, `BulkAddFlashcardDialog.tsx` | Pending/published mutation behavior and focused UX redesign |
| Exercises and children | `app/actions/exercise.ts`, `AddExerciseDialog.tsx` and media/question/group components | Pending/published guards and atomic mutation boundary; narrow polish |
| Authoring media boundary | `app/api/question-group-media/upload/route.ts`, `supabase/migrations/20260611162000_create_question_group_media_buckets.sql`, `20260611143005_sync_storage_bucket_policies.sql` | Replace global-role-only upload assumption with trusted course-scoped context if media remains part of editor/co_owner authoring; preserve admin moderation/delete semantics separately |
| Course thumbnail boundary | `app/actions/course.ts`, `supabase/migrations/20260916100000_d1_course_thumbnail_authorization.sql`, `__tests__/integration/course-creation-rls.test.ts` | Create upload is teacher-only staging; update upload is course-local owner/co_owner/editor; admin keeps maintenance/delete authority but no normal upload; failed DB mutation cleans up the new object |
| Collaborators | `app/actions/course.ts`, `app/actions/course-collaborator.ts`, `app/(teacher)/teacher/courses/[id]/_components/CourseOverview.tsx`, `CollaboratorManagementDialog.tsx`, `app/(teacher)/teacher/courses/_components/CollaboratorInvitationPanel.tsx`, `components/ui/header.tsx`, `components/ui/mobile-account-sheet.tsx`, `types/database.ts`, invitation migration, `20260916110000_d1_single_course_owner.sql`, `supabase/seed.sql` | `can_review_topics` boolean, effective capability/current-role safety, persisted invitation send/accept/reject/revoke, role caps, exactly one supported owner plus DB at-most-one-owner guard, and discoverable invitee surface; role controls use the shared Select primitive; no ownership transfer/email delivery |
| Topic authorship/responsibility | `app/actions/topic.ts`, `app/actions/topic-review.ts`, `app/actions/course-collaborator.ts`, `app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicWorkflowPanel.tsx`, `TopicBuilderTabs.tsx`, collaborator management/leave surfaces, new additive migration/RPC as required | Immutable creator, one responsible author, max two contributors, group-scoped edit/submit, initial-review exclusion, atomic transfer/self-leave and discoverable transfer feedback; exact schema name remains P0 design |
| Topic create navigation | `app/(teacher)/teacher/courses/[id]/_components/TopicManagementSheet.tsx`, `ChapterList.tsx`, `CourseStructureWorkspace.tsx`, `app/actions/topic.ts`, `__tests__/components/course-workspace-routes.test.tsx`, bounded browser smoke | Preserve authoritative returned topic id; test 0/1/multiple draft behavior and competing refresh/feedback navigation; do not derive target from draft list |
| Topic-authorship feedback | Existing course/topic workflow feedback components plus minimal action/DTO/read model; no current notification table found | Provide topic/course/context feedback after transfer; no email/push/visual redesign unless separately accepted |
| Admin moderation | `app/actions/topic-review.ts`, `app/admin/courses/page.tsx`, bounded admin moderation action/component(s), moderation/audit migration or trusted RPC as required | Preserve platform moderation/maintenance authority separately from review; mandatory reason/audit, demotion/takedown/pending invalidation/escalation cancellation; no full admin product redesign |
| Database | `supabase/migrations/20260609114505_remote_schema.sql`, `20260630090000_course_structure_ordering_rpc.sql`, exercise RPC migrations, new additive migration(s) | Readiness/lifecycle/review/history/RLS/locking/triggers/RPC as approved |
| Tests/fixtures | `__tests__/actions`, `__tests__/schemas`, `__tests__/components`, `__tests__/integration`, `e2e/smoke`, `scripts/e2e` | Unit/action/component/real DB/RLS/concurrency/smoke evidence |

The table is an affected-domain map, not permission to edit every listed file. Implementation must touch only the closure required by the accepted contract.

## 12. Test and acceptance strategy

### 12.1 Schema and action tests

- Create schema/action rejects or ignores client `status`; create always supplies draft semantics.
- Normal course creation matrix is explicit: global `teacher` allowed and becomes `owner`; global `admin`-only and `student`-only denied; no admin create-on-behalf path.
- Course ownership invariant tests prove supported creation leaves exactly one owner, authenticated Data API and role RPC cannot create a second owner, the DB partial unique index rejects a service-boundary duplicate, and `co_owner` remains valid. Invitation tests prove owner cannot be invited.
- Update schema/action no longer accepts direct `pending`/`published` CRUD transitions.
- Course-local authoring matrix is explicit: `teacher|student|admin` with active `owner|co_owner|editor` membership allowed; any global role with `previewer` has no authoring; admin/student without membership denied.
- Request review matrix: `0/0`, `1+/0`, `0/1+` reject with no status/submission/content mutation; `1+/1+` enters pending and never published directly.
- Soft-deleted cards/exercises do not satisfy readiness; restored active rows do satisfy it only through an authorized valid transition.
- Approve/reject reject stale state, wrong course, no permission, removed collaborator, delegated capability absent, and self-review.
- Reject requires the existing reason contract or an approved topic-specific equivalent; reason is persisted and visible after return to draft.
- Rejection count/lock is keyed by `topic + submitted_by`; after the third reject the topic is draft with unresolved escalation, ordinary review request is blocked for the whole topic even after responsibility transfer, and creation of new topics by that submitter in the course is held. Rescue initiation and close/abandon are owner/co_owner-only; terminal close/abandon cancels pending submissions before returning the topic to a releasable state. Rescue approval belongs to an effective distinct reviewer, and the escalation is resolved only as the consequence of that linked approval.
- Rescue tests prove the exact `A` original submitter / `B` owner-or-co_owner takeover / `C` reviewer identity contract, linked escalation id, ordinary approval rejection while an escalation is unresolved, and moderation cancellation/takedown resolution as a separate action.
- Invitation and role-mutation tests prove pending/accepted/rejected/revoked lifecycle, terminal-row re-invite, owner/co_owner hierarchy, editor/previewer capability flag, accepted membership materialization, global student/admin local membership acceptance, pending duplicate prevention, per-role caps, role promotion/downgrade capacity release and course-locked active-plus-pending reservation accounting.
- Invitation identity tests prove a mutable `profiles.email` cannot hijack an invite: send resolves only an active unique Auth identity, while invitee DTO/action/UI receives course title/slug from an invitee-only RPC.
- Topic-authorship action/schema tests prove create initializes immutable creator + one responsible author, contributor membership is explicit and capped at two, responsible author alone can request/resubmit, contributors can edit but cannot submit, and outside-group course collaborators are read-only.
- Topic-authorship lifecycle tests prove reject preserves responsibility, initial-review exclusion includes original creator/initial contributors/pre-approval responsible users even after remove/transfer, exclusion ends after first successful approval, and no permanent historical ban leaks into later review cycles.
- Transfer/leave tests prove owner/co_owner removal or downgrade transfers responsibility atomically to the actor or an existing contributor, or blocks the mutation; self-leave retains its separately accepted owner/co_owner recipient semantics, warns per-topic, rejects missing recipients, and never randomly assigns. Transfer feedback includes course/topic context and self-take does not notify the actor.
- Course thumbnail tests prove authorization is checked before create upload, global admin cannot use normal thumbnail Storage upload, course-local editor can align DB update with Storage upload, and failed create/update mutations remove newly uploaded objects.
- Question-group media tests prove persisted reference changes use the locked DB-first RPC, direct Storage DELETE cannot remove a referenced object or win after pending, and cleanup occurs only after a committed reference change; cleanup failure is orphan-safe.
- Admin reviewer tests prove profile `admin` alone is insufficient; active course membership plus effective course-scoped capability is required.
- Admin moderation tests prove an admin without course membership can use only the separate approved moderation boundary: mandatory reason, published demotion/takedown or pending-review invalidation, distinct moderation audit, no rejection-count/budget change, and no approve/reject/publication success.
- Global-role regression tests prove `admin`/`student` collaborators retain local authoring, while a global role alone does not create course-local author/reviewer authority.

### 12.2 Component/form tests

- Create modal has no status selector, uses metadata-only fields, and successful create navigates to exact `getTopicBuilderPath`.
- Create navigation interaction tests cover 0, 1 and multiple existing draft topics and assert the builder route contains exactly the new RPC/action result id; existing draft order/list refresh/dashboard feedback cannot change the target. Current route suite mocks `TopicManagementSheet`, so this is a missing regression layer, not existing evidence.
- Builder displays status/readiness/next action and handles loading, empty, error, pending, rejected and permission-denied states.
- Topic builder/structure UI tests show responsible-author and contributor roles, server-derived topic-group `canEdit`, read-only outside-group collaborators, pending freeze, transfer/leave warnings, rejection feedback, cap errors and discoverable transfer context without requiring visual redesign.
- Request-review CTA is disabled with actionable explanation for all three not-ready matrices and enabled only for both-content matrix.
- Pending disables all topic/card/exercise/question/group/media mutation controls and displays frozen explanation.
- Eligible reviewer sees approve/reject; submitter and ineligible collaborator do not; rejection dialog requires reason and preserves error state.
- Published edit shows explicit warning/confirm; cancel leaves state untouched; failed mutation does not silently demote.
- Normal pending UI remains frozen for admin-as-reviewer without membership; a separate admin moderation surface can show explicit takedown/invalidation affordance without exposing ordinary content edit or review controls.
- Course list/navigation tests prove global teacher gets normal create affordance, admin without membership does not get “Khóa học của tôi” solely from role, and valid admin/student collaborators can reach the same normal workspace without duplicate admin authoring UI.
- Collaborator invitation UI tests prove a useful course identity is rendered and successful accept calls the parent course-list refresh; failed accept does not refresh parent state.
- Collaborator role controls use the shared Select primitive with the same role options and capability semantics; owner remains display-only and no second owner control is exposed.
- Flashcard fields remain present after redesign; exercise polish does not change authoring semantics.
- Every successful card/exercise create, update, delete, restore or nested mutation refreshes the parent workflow/readiness DTO, including operations without dashboard issue context.

### 12.3 Real DB/RPC/RLS/integration tests

Use real local Supabase migrations and authenticated clients, not only mocked action clients:

- Direct authenticated Data API attempts to set topic `published`, `pending`, restore invalid published rows, mutate pending content, or soft-delete the last required content are denied or routed through an approved atomic guard.
- Valid request/approve/reject transitions enforce RLS, current effective reviewer role, no-self-review, reason, rejection threshold and audit history.
- Owner/co_owner implicit review and editor/previewer `can_review_topics` boolean matrix covers grant, revoke, role downgrade, collaborator removal and last-reviewer safety; no independent delegation entity is part of D1.
- Invitation table/RLS/RPC tests cover direct-write denial, invitee-only accept/reject, owner/co_owner send/revoke, terminal history, role caps and transaction-safe acceptance reservations; no independent delegation entity or persisted reservation counter is part of D1.
- Card and exercise soft-delete/restore paths update/read readiness correctly without leaving an invalid published/pending final state; published-topic soft-delete is atomic demotion + soft-delete and restore is active draft only.
- Admin without membership is denied request/approve/reject and direct publication, but an authorized admin moderation boundary can demote/takedown and invalidate affected pending review with a distinct audit event and mandatory reason. Moderation does not change rejection counters or masquerade as review rejection.
- Admin moderation tests cover open escalation during topic takedown and explicit escalation cancellation back to active draft; both retain review history while recording moderation separately.
- Authenticated Data API/RPC calls from admin/student collaborators prove membership-only authoring for topic/chapter/content; `previewer` remains denied, including direct topic metadata UPDATE which is no longer a supported RLS path. Media upload tests cover the course-scoped context required by authoring and deny admin-without-membership normal uploads. Ordinary question-group media DELETE is re-resolved through `course_id → topic_id`, the shared topic lock, uploader ownership, active topic-group membership and absence of a persisted reference; pending/published/removed/outside-group/referenced objects remain protected while the existing admin moderation exception remains available. Persisted replacement/clear returns old references from the trusted DB-first RPC for post-commit cleanup.
- Course thumbnail Storage tests cover teacher-only create staging, course-local owner/co_owner/editor update paths, admin denial for normal upload, and action cleanup after a later DB failure.
- Invitation RPC/RLS tests cover Auth identity binding and invitee-only course identity reads; profile email is not an invitation trust boundary.
- Topic-authorship RPC/RLS tests cover direct-write denial, immutable provenance, exactly-one current responsible author, two-contributor cap, initial-review exclusion, responsible-only submit/resubmit and atomic transfer/self-leave across owner/co_owner/contributor/outside-group roles.
- RPC permissions, `search_path`, caller identity and `service_role` separation are verified; fixture setup does not accidentally prove only admin behavior.
- Topic create/navigation browser smoke uses chapters with zero, one and multiple existing drafts and confirms the newly created topic builder opens. If the reported intermittent failure cannot be deterministically reproduced, record it as unverified and retain the authoritative-id regression as the acceptance evidence; do not mark a suspected root cause as confirmed.
- Concurrent integration/probe evidence covers the race table in §9.3, including real overlapping request-vs-media-DELETE sessions. If deterministic concurrency is unavailable in the test harness, document the exact unverified race instead of marking it pass.

### 12.4 Browser smoke/manual QA

Critical seeded path, if fixture/config readiness is completed:

1. Teacher creates topic from structure, sees draft builder directly, adds content, sees readiness transition, requests review.
2. Pending author cannot edit content; eligible non-submitter reviewer opens the same topic, sees frozen content, approves or rejects with reason.
3. Rejected topic returns to the Builder/draft phase with reason; valid correction and resubmission work until the third-rejection escalation hold is shown, then owner/co_owner initiates rescue or performs close/abandon; a distinct eligible reviewer approves the rescue before the hold is resolved.
4. Published topic learner read remains approved; teacher published edit warns, cancel is no-op, confirm demotes atomically; published topic delete confirms demotion+soft-delete and restore returns active draft.

Required fixture roles: global `teacher` owner, global `admin` without membership, global `admin` collaborator, global `student` collaborator, global `student` without membership, editor, previewer, editor/previewer with `can_review_topics = true`, submitter distinct from reviewer, and a second valid reviewer for last-reviewer mutation cases. Required content fixtures cover all four readiness states, soft-deleted last content, pending, rejected, third-rejection escalation/creation hold, valid published, published delete/restore and pre-migration invalid published inventory. Current fixtures do not provide this complete D1 matrix; fixture preparation is an implementation dependency, not existing evidence.

## 13. Implementation breakdown and checkpoints

The following are D1 implementation checkpoints, not future revision scheduling:

- **P0 — Contract/schema/fixture foundation:** encode the global-vs-course role contract in schema/type SSOT, normal teacher-only course creation, membership-only authoring boundary, topic authorship/provenance/group model, initial-review exclusion state, minimal review/escalation audit model, membership boolean capability, readiness DTO/predicate, deterministic cross-role fixture matrix, and migration inventory/remediation contract. Ordinary trigger/RPC/locking design review remains part of P0, not an unresolved product decision.
- **P1 — Trusted lifecycle boundary:** implement membership-only and topic-group authoring RPC/RLS/action boundary, request/approve/reject/escalation transaction/RPC, responsible-only request/resubmit, initial-review exclusion, atomic responsibility transfer/self-leave, separate admin moderation/maintenance boundary, pending freeze with moderation exception, effective reviewer/no-self-review/rejection rules, RLS/direct-write hardening, audit separation, and real DB integration/concurrency tests.
- **P2 — Content mutation safety:** route every supported topic/card/exercise/child mutation through topic-group authorization, pending guard and published confirm + atomic demotion; constrain ordinary question-group media DELETE to the shared course/topic lock, active draft topic-group uploader ownership and non-persisted references while preserving the approved admin moderation exception; persist question-group media replacement/clear through the trusted DB-first boundary and cleanup old objects after commit; preserve admin approved maintenance/takedown semantics; cover soft-delete/restore, pending invalidation and rollback behavior without allowing outside-group course collaborators to edit.
- **P3 — Teacher/admin workflow UX:** role-aware course-list/create navigation, authoritative create→builder navigation for 0/1/multiple drafts, Builder lifecycle/readiness/review and authorship-group shell, collaborator overview transfer/leave warnings, persistent reject feedback, discoverable transfer feedback, frozen/rejected/published/escalation states, bounded moderation/takedown affordances if current admin surface is extended, flashcard refresh wiring and narrow exercise polish. Full visual redesign remains deferred.
- **P4 — Closure:** focused/unit/component/integration/browser verification for the amended contract, accessibility/responsive/manual QA bounded to affected flows, singular-owner and topic-authorship invariant verification, self-review, docs/progress reconciliation and exact-head checkpoint report. The amended P4 browser evidence uses a new current-route smoke because the existing `course-structure` smoke hard-codes legacy routes; that stale suite remains follow-up debt and is not product evidence.

**Amendment checkpoint rule:** P0–P4 evidence recorded before the 2026-09-16 authorship/navigation steer remains historical evidence for the earlier contract. The implementation handoff must reopen as `P0-A → P1-A → P2-A → P3-A → P4-A`; no later phase may be treated as closed until the prior amended phase passes. P2 is included because topic-group membership changes the authorization predicate for content writes.

No checkpoint authorizes push, PR, merge, deploy or remote database migration by itself. Migration execution, if accepted later, must follow `supabase-safe-migration`; test changes must follow `test-quality-strategy`; Server Action/schema changes must follow `nextjs-server-action-zod`; UI changes must follow `frontend-workflow` and `frontend-design`.

## 14. Completion acceptance matrix

| Contract | Required observable evidence |
| --- | --- |
| New topic starts draft | Schema/action/DB tests prove client cannot create pending/published; browser create lands in builder |
| Course authority split | Teacher-only normal creation; creator becomes owner; admin/student valid collaborators author by local role; no-membership admin/student cannot normal-author; previewer remains read-only |
| Readiness gates request review | Four-case action + derivation + real DB matrix; only `1+/1+` enters pending |
| Request does not publish | State transition and learner-read assertions show pending is not published |
| Pending is immutable | Every listed topic/content mutation denied in action and direct DB/RPC tests; UI locked |
| Approve/reject is trusted | Effective permission, no-self-review, stale state, reason and audit assertions |
| Reviewer safety | Role/boolean-capability/revoke/downgrade/removal and last-reviewer transaction tests; sole-owner request is blocked with actionable collaborator path |
| Topic authorship | Immutable creator provenance, exactly one responsible author, explicit max-two contributor group, responsible-only request/resubmit, outside-group read-only, rejection preservation, initial-review exclusion and post-first-approval reset |
| Responsibility transfer/leave | Owner/co_owner mutation and self-leave are atomic with per-topic valid recipient or fail closed; no orphan topic; transfer feedback has course/topic context and self-take has no self-notification |
| Collaborator invitation | Persisted pending/accepted/rejected/revoked flow, accepted membership, hierarchy, per-role cap reservation and invitee discoverability |
| Rejection policy | Three-rejection cap, visible audit/reason, submitter/topic creation hold and explicit locked/escalation behavior |
| Admin authority separation | Admin role alone cannot review/publish or self-escalate through `profiles.role`; trusted moderation can demote/takedown/invalidate/cancel escalation with mandatory distinct audit and no rejection-budget effect |
| Published edit bridge | Confirmed atomic demotion+mutation; cancel/error rollback; no silent demotion |
| Unified authoring UX | Create navigation, builder status/readiness/next action and flashcard/exercise state tests + manual QA |
| Create target identity | For 0/1/multiple existing drafts, successful create opens exactly the new authoritative topic id; list refresh, dashboard feedback and stale state cannot retarget navigation |
| DB guarantee | Direct Data API/RPC/RLS and concurrency evidence; residual service-role/infrastructure boundary explicitly reported |
| Future compatibility | No candidate revision implementation; learner remains on approved published view; future direction remains model/timing-agnostic |

## 15. Resolved Owner decisions and implementation gates

The following decisions are closed by the Owner steers recorded on `2026-09-15` and `2026-09-16` and are binding for implementation:

| Decision surface | Accepted contract |
| --- | --- |
| Global vs course roles | `student|teacher|admin` and `owner|co_owner|editor|previewer` are independent layers. Local authoring/review follows valid membership; global role does not suppress or add local authority except the separate normal-course-create and admin-moderation boundaries. |
| Normal course creation | Global `teacher` creates `draft` through the normal teacher workflow and becomes `owner`; global `admin`-only and `student`-only are denied. Admin create-on-behalf is future work outside D1. |
| Collaborator authoring | Any global role may hold valid `co_owner`/`editor` authoring membership, including `student` and `admin`; `previewer` is read-only. Admin membership follows local role and receives no blanket privilege; no-membership admin has moderation only. |
| Third rejection | Scope is `topic + submitted_by`; topic returns `draft`, escalation remains unresolved, submitter cannot review that topic or create new topics in that course, existing content remains editable; no global account lock. Owner/co_owner initiates rescue or performs close/abandon with required audit; only distinct reviewer approval of the linked rescue resolves the hold. |
| Review vs moderation | Global `admin` role alone never grants request/approve/reject or reviewer eligibility. Admin retains separate platform moderation/maintenance authority through trusted actions with mandatory distinct audit, including demotion/takedown and pending-review invalidation when needed. |
| Delegated review model | `course_collaborators.can_review_topics boolean NOT NULL DEFAULT false`; role derives owner/co_owner capability, flag grants editor/previewer capability only, downgrade clears flag atomically, removal deletes membership row. No separate delegation entity/history/expiry/per-topic scope in D1. Invitation lifecycle is a separate membership-acquisition relation, not a review-capability relation. |
| Published delete/restore | Published delete requires confirmation and atomic demotion + soft-delete; restore is active draft; pending delete/restore is blocked; draft delete/restore remains draft; republish requires review. |
| Existing invalid published rows | Inventory before DB invariant; no invalid post-migration published row and no grandfather bypass; invalid rows remediate to draft only through separately authorized execution after exact-row report. |
| Persisted lifecycle | Only `draft → pending → published`; `authoring` remains Builder phase over draft. |
| Topic authorship/responsibility | Each topic has immutable original creator provenance, exactly one current responsible author and at most two explicit contributors. Responsible author alone requests/resubmits; contributors may edit but not submit; outside-group course collaborators are read-only. Reject preserves responsibility. |
| Initial review exclusion | Before first successful approval, original creator, current responsible author, initial contributors and every pre-approval responsible author are excluded as reviewers; remove/transfer cannot bypass it. After first approval, exclusion ends and later cycles use normal rules. |
| Responsibility transfer/leave | Owner/co_owner remove/downgrade and responsible-author self-leave must atomically transfer each affected unapproved topic to an allowed owner/co_owner or existing contributor, or fail closed. No random assignment and no new owner-transfer feature. |
| Contributor cap/feedback | Maximum two contributors per topic, responsible author excluded from count. Transfer feedback must include topic/course/context; self-take does not notify the actor. Visual design/channel is an engineering gate, not a new product scope. |
| Create navigation target | Successful create always navigates to the authoritative newly-created topic id, independent of existing draft count/list order. Current source already follows this path; the intermittent runtime premise remains unverified until interaction coverage reproduces it. |

No unresolved Owner-decision blocker remains for the amended D1 contract. P0 still requires ordinary implementation design review for exact authorship schema/history representation, notification storage/channel, schema naming, RPC/trigger choice, lock scope, moderation action surface and migration ordering; these are engineering gates, not permission to silently change the accepted behavior. The current repository has no notification subsystem, so the minimal in-product/discoverable feedback mechanism must be chosen during P0 without adding email/push or visual redesign by default. Remote migration/production-data execution, code implementation, commit, push and PR remain separate authorities.

## 16. Debt and follow-up outside D1

- Candidate/published revision system remains deferred architecture direction with no phase/workstream/timing/merge order. D1 must avoid hard-coding in-place published edits as a permanent product model.
- Ownership transfer, email delivery, expiry/reminder and broad role-management UX remain outside D1. Minimal persisted collaborator invitations, role caps and accept/reject/revoke UI are inside D1 because they close the confirmed sole-owner reviewer dead-end; this does not create a separate delegation entity.
- Q7 internal previewer authorization, D2 public preview, course publication, memory check, completion truth, exercise correctness and analytics remain outside D1.
- Current service-role fixture/admin direct writes are a continuing DB-guarantee limitation. They may be retained for setup, but supported application behavior must not confuse fixture authority with end-user enforcement.
- Existing mock course review is separate technical debt; do not claim it as topic review evidence. If D1 must harden generic admin writes, provide only the bounded moderation/maintenance path needed to preserve current platform authority; a full admin moderation product remains separate.
- Existing broad `is_admin()` use in content-read/management helpers remains an architectural coupling risk. D1 now separates normal course-thumbnail and question-group-media authoring/deletion from global admin moderation through course-scoped Storage/RPC checks; ordinary question-group media DELETE is draft-only and cannot bypass pending/published/removed/group membership boundaries. Any future media surface still needs bounded course context for student/admin collaborators. Do not solve unrelated Q7/public access behavior or admin create-on-behalf in D1.
- Full collaborator/authoring-group visual redesign, animation, reviewer-preview workspace, email/push notification delivery, bulk responsibility-transfer UI and candidate/published revision remain deferred. D1 still must implement the minimum trusted/data/feedback boundary required by the amended authorship contract; deferral applies to presentation and broader product expansion, not to the invariant.

## 17. Implementation handoff summary

Implementation handoff readiness: **PASS local; senior-review correction verified, self-reviewed and committed**. Local correction commit `6a6f577` remains unpushed. This bounded correction preserves the accepted D1 boundary while closing the five confirmed senior-review findings: topic-wide unresolved escalation hold and terminal pending cancellation; operation-specific responsibility recipients; direct topic metadata RLS bypass; Storage DELETE/reference/lifecycle race; and Course Structure topic-level mutation projection. The new migration adds the trusted locked boundaries and Storage policies, while Server Actions/DTO/UI and focused regression coverage consume them. Full unit `55 files / 474 tests`, full integration `15 files / 147 tests`, TypeScript, targeted ESLint, static policy/ACL probes and a real Storage/request overlap probe passed. Final local cleanup reset applied migration head `20260917100000` plus canonical seed; post-reset sanity found `14` courses, `0` D1 fixture courses, `0` Storage objects, `0` duplicate-owner courses, and the known `11` published topics missing active exercises / `8` missing active flashcards. The 2026-09-16 authorship/navigation amendment remains unchanged: no candidate-revision system, Q7/D2, course publication, memory/completion or broad collaborator redesign. Existing legacy-route smoke, full manual accessibility/responsive QA, admin mock UI and service-role/seed guarantee limits remain explicit residuals.
