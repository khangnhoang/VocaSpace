> ⛔ **STALE — KHÔNG DÙNG LÀM CONTRACT.**
> Tài liệu này mô tả mô hình escalation / rescue / review-budget đã bị **bỏ hoàn toàn** theo quyết định của Owner.
> Contract hiện hành: [`correction-plan-deepseek-v2.md`](./correction-plan-deepseek-v2.md).
> Giữ lại chỉ để làm hồ sơ lịch sử. Mọi câu trong tài liệu này mô tả "rescue", "escalation", "takeover"
> hoặc ngưỡng từ chối 3 lần đều **không còn đúng**.

# D1 correction plan: rescue responsibility contract

## 1. Trạng thái tài liệu và phạm vi

- Đây là correction plan thuộc cùng D1; không phải workstream mới.
- Tài liệu này chỉ lập kế hoạch. Trong checkpoint hiện tại không sửa implementation, migration, test, generated type, commit, push, PR, CI hoặc merge.
- Nguồn sự thật cần dùng khi triển khai: Owner contract trong yêu cầu hiện tại, schema/RPC đang có trong repository, và dữ liệu production/staging được kiểm kê tại thời điểm migration. `plan.md` hiện tại là kế hoạch D1 cũ; các câu mô tả rescue trong đó phải được xem là contract drift cần hiệu chỉnh, không phải lý do để giữ hành vi cũ.

### Mục tiêu quan sát được

Một topic phải luôn biểu diễn đúng hai vai trò độc lập:

- `creator`: người tạo topic, bất biến.
- `responsible`: người đang chịu trách nhiệm chỉnh sửa và submit topic ở workflow hiện tại.

Rescue phải là chuyển `responsible` từ A sang B trong cùng một held episode. Việc B trở thành người chịu trách nhiệm không được bị biểu diễn bằng cách giả lập B là người submit thay A, và không được tự động submit topic.

### Phạm vi bao gồm

- state machine và persistence của ordinary review, held topic, rescue, rescue review, restore và delete;
- RPC, authorization/RLS, lock/concurrency và stale-action handling;
- canonical read model, Server Actions/schema và frontend state/actions;
- migration/data reconciliation cho dữ liệu đã chịu ảnh hưởng của contract cũ;
- test unit/integration/RLS/RPC/component và manual QA cần thay đổi hoặc bổ sung.

### Phạm vi loại trừ

- không đổi semantics của responsibility transfer thông thường nếu không cần để bảo toàn invariant của rescue;
- không mở rộng sang các workflow không liên quan đến topic review;
- không thêm audit/provenance framework mới nếu bảng lịch sử hiện có đủ để ghi nhận transition;
- không cho phép UI, test hoặc read model tự định nghĩa contract riêng.

## 2. Discovery hiện tại và root mismatch

### 2.1. Contract hiện tại trong repository

Discovery đã kiểm tra các nguồn trực tiếp sau:

- `supabase/migrations/20260915090000_d1_foundation.sql`
- `supabase/migrations/20260915130000_d1_correction_security_rescue.sql`
- `supabase/migrations/20260916120000_d1_topic_authorship_foundation.sql`
- `supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql`
- `supabase/migrations/20260916150000_d1_topic_authorship_workflow_read.sql`
- `supabase/migrations/20260917100000_d1_senior_review_corrections.sql`
- `supabase/migrations/20260917110000_d1_manual_qa_corrections.sql`
- `app/actions/topic-review.ts`
- `lib/schemas/topic-workflow.ts`
- `app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicWorkflowPanel.tsx`
- `__tests__/integration/topic-review-lifecycle.test.ts`
- `__tests__/components/topic-workflow-panel.test.tsx`

Các facts đã xác nhận:

1. `topics` đã có `original_creator_user_id`, `responsible_author_user_id` và `first_approved_at`. Trigger authorship bảo vệ creator bất biến và chỉ cho phép trusted RPC đổi responsible.
2. `topic_review_submissions.submitted_by_user_id` đang mang nghĩa người gửi submission; đây không phải field thay thế cho `responsible_author_user_id`.
3. `resolve_topic_review_escalation(..., p_action = 'rescue', ...)` hiện kiểm tra owner/co-owner và điều kiện readiness, nhưng tạo pending submission mới với `submitted_by_user_id = auth.uid()` và `rescue_escalation_id`, rồi đưa topic vào trạng thái pending. RPC này không chuyển `topics.responsible_author_user_id` từ A sang B.
4. Vì vậy khi B rescue, trạng thái thực tế trở thành `creator = A`, `responsible = A`, `submitted_by = B`; đó chính là drift được nêu trong discovery, và đã được xác nhận bằng repository code chứ không chỉ dựa trên báo cáo cũ.
5. `reject_topic_review` đếm rejected submissions theo `topic_id + submitted_by_user_id` kể từ episode gần nhất. Khi rescue submission được ghi cho B, rejection của B bị diễn giải thành một episode/submitter mới; không có state riêng cho rescue rejection budget.
6. `get_topic_workflow_state` lọc `rejectionCount` theo caller (`submitted_by_user_id = auth.uid()`). Do đó cùng một topic có thể trả count khác nhau cho các caller, trái với canonical workflow state.
7. `d1_topic_group_member` hiện ưu tiên `responsible_author_user_id` và contributor; creator không tự động được thêm vào. Điều này không đủ cho rescue contract, vì trong rescue cả A, B và contributor hiện tại đều phải editable.
8. Reviewer exclusion hiện có logic creator/current responsible và lịch sử exclusion trước first approval, nhưng cần bảo đảm contributor hiện tại cũng bị loại trong suốt rescue, đồng thời không làm yếu invariant lịch sử mạnh hơn.
9. UI đang diễn giải `pendingSubmissionIsRescue` như B đã gửi bài, hiển thị rejection budget theo caller, và dùng các action `rescue|close|abandon` chưa phân biệt responsibility takeover, restore và delete. Test lifecycle hiện cũng assert B là `submitted_by_user_id` sau rescue.

### 2.2. Chuỗi lỗi có cùng một nguyên nhân

Không tách các triệu chứng sau thành các bug độc lập:

`rescue ghi B vào submitted_by` nhưng `responsible vẫn A`
→ edit permission của A/B sai
→ request/resubmit sau rescue bị suy ra từ submitter thay vì responsible/rescue state
→ rejection count trở thành actor-relative và rescue 3/3 có thể mở escalation mới
→ read model và UI hiển thị khác nhau theo caller
→ restore không có transition `B → A`
→ hệ thống không có invariant ngăn rescuer thứ hai/rescue chain.

Root correction vì vậy phải là một state-machine/authorship fix xuyên suốt database, authorization, read model và frontend.

## 3. Target contract và state machine

### 3.1. Identity invariant

Với A là creator/responsible ban đầu, C1/C2 là contributors và B là owner/co-owner rescue:

```text
initial:       creator=A, responsible=A, contributors=C1/C2
ordinary hold: creator=A, responsible=A, ordinary rejection_count=3/3
rescue active: creator=A, responsible=B, contributors=C1/C2
rescue restore: creator=A, responsible=A, topic=draft, rescue inactive
```

`submitted_by_user_id` chỉ là actor gửi một submission cụ thể. Nó không được dùng để suy ra người responsible, rescue owner, rescue count hoặc quyền edit.

### 3.2. Ordinary review

- Chỉ responsible hiện tại được request review cho ordinary workflow.
- Mỗi rejection làm tăng canonical ordinary rejection count của active ordinary episode.
- Ở `3/3`, topic chuyển sang held/unresolved; ordinary responsible không được submit tiếp trong episode đó.
- Owner/co-owner có thể bắt đầu tối đa một rescue cho held episode.
- Reviewer độc lập với creator, responsible hiện tại, contributors hiện tại và các exclusion lịch sử bắt buộc trước first approval.
- Ordinary reviewer UI không hiển thị rejection budget. Capability của owner/responsible có thể khác, nhưng count/latest rejection trong workflow state là cùng một giá trị cho mọi caller.

### 3.3. Rescue

`start rescue` là một transition responsibility takeover, không tạo submission và không submit tự động:

```text
held:         responsible=A, rescue=inactive
start rescue: responsible=A → B, rescue=active, topic=draft
```

Trong rescue:

- editable authors là A + B + current contributors;
- B phải edit topic, sau đó B mới request review;
- submission có thể ghi `submitted_by_user_id = B`, nhưng đồng thời persisted state bắt buộc phải có `responsible_author_user_id = B` và active rescue identity trỏ tới B;
- chỉ owner/co-owner có quyền start rescue, restore hoặc delete rescue; B không được tự cứu tiếp hoặc tạo rescue chain;
- held episode có một rescuer duy nhất; không có second rescuer.

### 3.4. Rescue rejection budget

Rescue có budget riêng, tách khỏi ordinary count và tách khỏi việc tạo escalation mới:

```text
rescue active, no submission yet: 0/3
rejected once:                  1/3 → B edits → resubmit
rejected twice:                 2/3 → B edits → resubmit
rejected thrice:                3/3 → rescue failed
```

Ba lần này là các resubmission bên trong cùng một rescue, không phải ba rescue. Khi rescue đạt `3/3`, state là terminal failed rescue đối với held episode: không submit thêm và không rescue thêm; chỉ còn `Khôi phục về bản nháp` hoặc `Xóa bài học`.

### 3.5. Reviewer exclusion

Reviewer candidate trong rescue phải bị loại nếu là:

- creator A;
- responsible B;
- bất kỳ contributor hiện tại nào;
- bất kỳ user nào bị loại bởi invariant lịch sử trước first approval.

Eligibility phải được tính tại thời điểm request/review, không chỉ snapshot lúc bắt đầu rescue. Nếu contributor được thêm hoặc removed trong giới hạn cho phép của workflow, reviewer safety vẫn phải fail closed.

### 3.6. Restore và delete

`Khôi phục về bản nháp` là Ctrl+Z của active rescue:

```text
responsible: B → A
topic:       rescue/pending/held state → draft
rescue:      active → restored/inactive
B:           rời active workflow
history:     giữ nguyên
```

`Xóa bài học` là wording người dùng nhìn thấy. Backend có thể soft-delete/hide theo convention hiện tại, nhưng transition phải được audit là delete trong rescue và phải làm rescue không còn actionable.

Sau rescue `3/3`, hai action trên là toàn bộ action còn lại. Không có submit, approve/reject mới, rescue mới hoặc close action mơ hồ.

**Quyết định Owner cần chốt trước implementation:** sau `Khôi phục về bản nháp`, ordinary held episode có được reset để A request một ordinary episode mới hay vẫn giữ hold cũ ở trạng thái không-actionable? Kế hoạch này mặc định đề xuất restore kết thúc active rescue và reset current topic workflow về draft, nhưng phải ghi rõ trong migration/RPC contract trước khi code. Lịch sử rejection/rescue cũ vẫn giữ nguyên dù current episode được reset.

Kế hoạch này cũng mặc định “một rescue” là một rescue cho mỗi held episode; nếu Owner muốn cấm rescue vĩnh viễn trên toàn đời topic, cần thay unique invariant theo `topic_id` thay vì theo held episode và xác nhận tác động với các ordinary episode sau này.

## 4. Thiết kế correction theo lớp

### 4.1. Database/state persistence

Giữ `topic_review_submissions.submitted_by_user_id` là actor của submission; không đổi nghĩa field để chữa drift. Bổ sung một state/history model có semantic owner rõ ràng, ưu tiên bảng rescue riêng thay vì nhồi thêm cột caller-relative vào escalation:

```text
topic_review_rescues
- id
- topic_id
- source_escalation_id / held_episode_id
- rescuer_user_id                 -- B, immutable
- status                          -- active|failed|approved|restored|deleted
- rejection_count                 -- canonical 0..3
- latest_rejection_submission_id
- started_at / completed_at
- completed_by_user_id
- completion_reason
- timestamps
```

Tên field có thể điều chỉnh theo convention hiện tại, nhưng phải giữ các invariant sau:

- một held episode có tối đa một rescue;
- một rescue có đúng một `rescuer_user_id` bất biến;
- `rejection_count` của rescue chỉ tăng theo committed rejection, không lấy theo caller;
- `rejection_count <= 3`; ở 3 rescue terminal failed;
- active rescue duy nhất của topic/held episode được bảo vệ bằng unique partial index;
- rescue submission phải link tới rescue id; ordinary submission không được link rescue;
- topic `responsible_author_user_id` phải đồng bộ với active rescue `rescuer_user_id` khi rescue active;
- rescue completion/restore/delete không làm mất audit/history.

Escalation hiện tại cần được mở rộng hoặc liên kết để biểu diễn held episode rõ ràng. Không dùng `escalation.submitted_by_user_id` làm source of truth cho rescuer; field cũ phải được giữ cho backward compatibility/audit hoặc rename trong một migration được kiểm soát, nhưng RPC/read model mới chỉ đọc semantic field mới.

### 4.2. RPC/state transition boundaries

Thay vì để một RPC rescue vừa takeover vừa submit, tách transition theo ý nghĩa nghiệp vụ:

1. `start_topic_rescue(p_topic_id, p_escalation_id)`
   - lock topic + active held episode;
   - kiểm tra caller owner/co-owner, topic held, no pending submission, no active rescue, no prior rescue cho held episode;
   - chọn B = caller;
   - update responsible A→B bằng trusted internal helper;
   - create active rescue với count 0;
   - giữ topic draft/editable; không create pending submission.

2. `request_topic_review(p_topic_id)`
   - xác định responsible từ topic/rescue state hiện tại;
   - ordinary: caller phải là responsible A;
   - active rescue: caller phải là rescuer B; A/contributors được edit nhưng không được submit thay B;
   - verify readiness, no pending, reviewer eligibility và budget còn lại;
   - create submission với actor thực tế, link rescue nếu active.

3. `reject_topic_review(...)`
   - lock pending submission + canonical state;
   - ordinary: tăng ordinary episode count; tại 3 tạo/giữ held escalation;
   - rescue: tăng đúng rescue count; tại 3 chuyển rescue failed; không insert escalation/rescue mới;
   - update latest rejection trong canonical state.

4. `approve_topic_review(...)`
   - lock và re-check submission/state;
   - chỉ reviewer hợp lệ, khác creator/responsible/contributors và historical exclusions;
   - ordinary approval kết thúc ordinary episode;
   - rescue approval kết thúc rescue, giữ B là responsible nếu Owner contract yêu cầu; không được suy ra status từ submitter;
   - xác nhận rõ trạng thái held escalation sau approval.

5. `restore_topic_rescue(...)`
   - owner/co-owner only, lock rescue/topic;
   - cho phép từ mọi active rescue state, kể cả pending/held/failed;
   - cancel pending submission nếu có theo audit reason;
   - B→A, topic→draft, rescue→restored; invalidate rescue action;
   - áp dụng quyết định Owner về ordinary hold/current episode.

6. `delete_topic_from_rescue(...)` hoặc nhánh được bảo vệ trong `d1_delete_topic`
   - owner/co-owner only, lock rescue/topic;
   - soft-delete/hide theo convention hiện tại;
   - cancel/invalidate pending state; rescue→deleted; không cho restore/rescue/submit qua stale state;
   - UI wording vẫn là `Xóa bài học`.

Các transition phải trả lỗi domain ổn định cho stale action (`rescue_already_started`, `rescue_terminal`, `rescue_not_active`, `responsible_changed`, `pending_submission_exists`, `reviewer_no_longer_eligible`) thay vì trả trạng thái thành công giả.

### 4.3. Authorization/RLS

- Giữ direct table writes bị revoke/deny; mọi mutation đi qua trusted RPC với `auth.uid()` làm actor.
- Bổ sung helper predicate phân biệt `can_edit_topic` và `can_submit_topic`:
  - rescue active: A/B/contributors có thể edit theo Owner contract; chỉ B được request/resubmit;
  - rescue failed: không ai được edit/submit qua rescue; chỉ owner/co-owner restore/delete;
  - restored draft: quyền theo ordinary draft/responsible contract sau khi B đã rời workflow.
- Không cho client truyền `responsible_author_user_id`, `rescuer_user_id`, rejection count, latest rejection hoặc rescue status để tự cấp quyền.
- `transfer_topic_responsibility` thông thường phải reject hoặc phối hợp rõ ràng với active rescue; không cho một transfer ngoài rescue tạo second rescuer hoặc làm lệch topic/rescue state.
- Reviewer access phải dùng cùng exclusion helper với `d1_has_eligible_topic_reviewer`; helper phải đọc creator, current responsible, current contributors và historical exclusions trong một snapshot transaction.
- RLS/read policy không được expose data khiến caller có thể thay đổi canonical count bằng cách lọc theo auth user.

### 4.4. Canonical read model

`get_topic_workflow_state` phải trả một canonical workflow snapshot, không actor-relative:

```text
creator
responsible
contributors
topicStatus
held / escalation state
ordinaryRejectionCount
rescueId
rescueRescuer
rescueStatus
rescueRejectionCount
latestRejection
pendingSubmission
allowed next transitions
```

Các field state/count/latest rejection phải giống nhau cho mọi caller có quyền đọc. Chỉ capability flags được tính theo caller, ví dụ:

```text
canEdit
canSubmit
canStartRescue
canRestoreRescue
canDeleteTopic
canReview
isCurrentUserCreator
isCurrentUserResponsible
isCurrentUserRescuer
isCurrentUserContributor
```

Không để `isCurrentUserSubmitter` quyết định responsible/rescue state. Nếu vẫn cần field này cho UI/audit, chỉ dùng để mô tả pending submission actor và đặt tên rõ nghĩa.

Ordinary reviewer UI không được render rejection budget. Quy tắc này phải là capability/presentation contract được test, không phụ thuộc caller có phải reviewer hay không trong SQL read model.

### 4.5. Server Actions, schemas và frontend

`app/actions/topic-review.ts` và `lib/schemas/topic-workflow.ts` cần đổi theo transition mới:

- action `start rescue` riêng, không dùng `resolve(... action='rescue')` để submit;
- action `request review` dùng responsible/rescuer contract;
- action `restore rescue` riêng;
- action `delete topic` giữ user-facing wording `Xóa bài học`, backend error/state có semantic delete;
- action approve/reject đọc canonical state và translate stale/domain errors;
- payload không nhận actor/role/count từ client;
- revalidation bao phủ workflow panel, topic builder, course structure/overview và các read boundary đang cache.

`TopicWorkflowPanel.tsx` phải chuyển từ `pendingSubmissionIsRescue`/`isCurrentUserSubmitter` sang `rescueStatus`, `rescueRescuer`, `canSubmit`, `canRestoreRescue`, `canDeleteTopic` và canonical counts:

- held ordinary: owner/co-owner thấy `Giải cứu trách nhiệm`;
- rescue active draft: B thấy `Gửi duyệt`; A/contributors thấy edit nếu allowed nhưng không thấy submit;
- rescue pending: B không thể submit lần nữa; reviewer thấy review action nếu eligible;
- rescue 1/3 hoặc 2/3 rejected: B thấy edit/resubmit; reviewer UI không thấy budget;
- rescue failed 3/3: chỉ `Khôi phục về bản nháp` và `Xóa bài học`;
- restore/delete phải có confirm và giải thích hậu quả; không hiển thị action stale sau mutation;
- ordinary reviewer không được hiển thị `x/3`, kể cả read model có canonical count.

`TopicAuthorshipSection.tsx` và các editor boundary phải dùng `canEdit`/author set từ canonical state. Không tự tính A/B/contributors bằng dữ liệu cục bộ hoặc chỉ current `responsible`.

## 5. Migration và data reconciliation

### 5.1. Inventory trước khi viết migration

Trước migration cần query/read-only inventory cho:

- mọi topic có unresolved escalation;
- mọi pending submission có `rescue_escalation_id`;
- mọi submission rescue mà `submitted_by_user_id != topics.responsible_author_user_id`;
- các topic có nhiều rejected submission sau escalation/rescue cũ;
- topic có nhiều open escalation, rescue-like submission hoặc topic/status mismatch;
- deleted/removed/published topic liên quan rescue;
- lịch sử reviewer, exclusion và contributor tại thời điểm submission.

Inventory phải xuất ra số lượng và primary keys/hash-safe identifiers cần reconciliation; không sửa dữ liệu trong bước này.

### 5.2. Additive schema/data migration

- Tạo rescue state/history với foreign keys, check constraints, partial unique indexes và indexes cho read/RPC.
- Backfill rescue records từ dữ liệu cũ chỉ khi mapping là xác định: linked `rescue_escalation_id`, topic, submitter B, timestamp và escalation context nhất quán.
- Với case cũ có `submitted_by=B` nhưng `responsible=A`, không silently coi đó là hợp lệ. Reconcile thành `responsible=B` chỉ khi evidence đủ chứng minh đó là rescue takeover; nếu không đủ, đánh dấu migration ambiguity/quarantine để Owner quyết định.
- Pending rescue cũ phải được chuyển sang state tương ứng mà không tự động tạo thêm rescue hoặc reset rejection history.
- Count ordinary/rescue được tính từ submission history theo episode, không theo caller và không gộp B rescue vào ordinary count của A.
- Giữ audit/history cũ; không rewrite actor lịch sử để làm dữ liệu “đẹp”. Nếu cần canonical projection mới, lưu nguồn/backfill version và evidence reference.
- Migration fail closed khi có duplicate active rescue, nhiều candidate rescuer, missing topic/escalation hoặc status conflict; in ra danh sách cần xử lý, không chọn tùy tiện.

### 5.3. Validation sau migration

Chạy deterministic assertions:

- creator không đổi;
- mỗi active rescue có đúng một rescuer và topic responsible trùng rescuer;
- không có second rescue/chain trong cùng held episode;
- rescue count trong `[0,3]`, count 3 không pending/actionable;
- mọi rescue submission link đúng rescue;
- không còn current-state case hợp lệ kiểu `rescue active + responsible=A + rescuer=B`;
- restore/delete không xóa history;
- read model trả cùng canonical state cho nhiều role fixture.

Chỉ sau khi inventory, backfill và assertions xác định được dữ liệu hiện tại mới chọn migration path cuối cùng. Không commit migration khi còn ambiguity Owner chưa giải quyết.

## 6. Race condition và stale-action handling

Mỗi mutation cần transaction và row locks theo thứ tự ổn định, tối thiểu topic → held escalation/rescue → pending submission liên quan. Các invariant phải được bảo vệ bởi cả database constraint lẫn RPC check; check ở frontend không có giá trị bảo vệ.

Các race cần test và xử lý:

- hai owner/co-owner cùng start rescue: chỉ một transaction thắng; transaction còn lại nhận `rescue_already_started`;
- rescue start cạnh request review: request chỉ thành công sau snapshot đã xác định B là responsible; không để A submit sau takeover;
- B request cạnh restore/delete: một transition thắng; transition còn lại stale và không được tạo pending orphan;
- reviewer reject cạnh restore/delete: lock/recheck rescue active trước khi tăng count;
- hai reject/review trên cùng pending submission: idempotent/unique transition, count chỉ tăng một lần;
- rejection thứ ba cạnh resubmit: 3/3 terminal wins theo commit order, không có submission thứ tư;
- transfer responsibility thông thường cạnh rescue: một invariant owner duy nhất, không overwrite âm thầm;
- contributor thay đổi cạnh reviewer eligibility: reviewer check lại tại request/approve, fail closed nếu mất độc lập;
- cached read sau mutation: revalidate/invalidate đúng boundary; stale UI không được làm mutation thành công giả.

RPC nên trả state version/updated timestamp hoặc transition result đủ để client nhận biết stale snapshot. Nếu cần optimistic token, token phải được kiểm tra trong RPC và không thay thế row lock/constraint.

## 7. Implementation phases và dependency order

### P0-C — Contract freeze và data inventory

- Chốt hai Owner decisions ở mục 3.6: restore có reset ordinary hold hay không; một rescue tính theo held episode hay toàn đời topic.
- Lập state transition table và error catalogue.
- Inventory dữ liệu drift hiện tại; phân loại reconcile tự động, quarantine và cần Owner review.
- Acceptance: không còn ambiguity làm thay đổi schema/RPC semantics; có số liệu cụ thể cho migration.

### P1-C — Schema, state machine, migration và RPC

- Thêm rescue persistence/constraints/history projection.
- Sửa RPC theo tách takeover → edit → request → review → restore/delete.
- Bảo vệ count/terminal state/one-rescue invariant bằng transaction + constraint.
- Viết migration/backfill/reconciliation và post-migration assertions.
- Acceptance: state transition đúng contract với fixture A/B/C; không còn rescue active drift.

### P2-C — Authorization/RLS và canonical read model

- Tách edit/submit/rescue/restore/delete capability.
- Cập nhật reviewer exclusion động và historical exclusion.
- Sửa `get_topic_workflow_state` để canonical state không phụ thuộc caller; chỉ capability flags phụ thuộc caller.
- Acceptance: cùng topic/state/count/latest rejection cho owner, responsible, contributor, reviewer và non-actor có quyền đọc; quyền mutation fail closed.

### P3-C — Server Actions/schema/frontend

- Cập nhật action/schema/error mapping/revalidation.
- Đổi workflow panel/authorship/editor theo canonical state và action semantics.
- Bổ sung confirm/feedback cho restore/delete và stale action.
- Acceptance: UI không còn nút rescue lặp, không auto-submit khi rescue, B mới submit sau edit, failed rescue chỉ còn hai action; ordinary reviewer không thấy budget.

### P4-C — Test, manual QA và evidence checkpoint

- Cập nhật test cũ đã encode `submitted_by=B` nhưng `responsible=A`.
- Bổ sung lifecycle, RLS, race, migration/reconciliation, canonical-read và component/manual QA.
- Chạy deterministic checks, integration/RPC với database phù hợp và manual QA qua role matrix.
- Báo cáo pass/failed/skipped/unavailable riêng; không gọi canary/prepare hoặc test tĩnh là product pass.
- Dừng tại review checkpoint; commit/PR/CI/merge là authority riêng.

## 8. Test plan bắt buộc

### Database/RPC/integration

- initial A/A và contributors C1/C2;
- ordinary 1/3, 2/3, 3/3 → held, không submit thứ tư;
- owner B start rescue → responsible B, không pending submission, topic editable;
- B edit rồi request → submission actor B và responsible B;
- A/C1/C2 edit được trong rescue nhưng không request thay B;
- second owner start rescue bị reject; không rescue chain;
- rescue 1/3 và 2/3 cho phép B edit/resubmit trong cùng rescue;
- rescue 3/3 terminal, không submit/rescue tiếp;
- rescue reject không mở ordinary escalation mới và không gộp vào ordinary count;
- approve rescue không suy ra state từ submitter;
- restore từ draft/pending/held/failed: B→A, topic draft, B inactive, history giữ;
- delete ở mọi rescue phase: user-facing action là `Xóa bài học`, soft-delete/hide theo backend convention, không action tiếp;
- reviewer creator/responsible/rescuer/contributor/historical excluded đều bị loại; reviewer hợp lệ vẫn hoạt động;
- ordinary reviewer read không có budget capability/field UI tương ứng.

### Canonical read model

Với cùng fixture, gọi `get_topic_workflow_state` bằng A, B, contributor, owner/co-owner và reviewer:

- state, responsible, rescue status, rejection counts, latest rejection, pending submission metadata giống nhau nếu caller có quyền đọc;
- chỉ capability flags/identity booleans khác theo caller;
- không có count dựa trên `auth.uid()`;
- failed rescue trả đúng hai remaining actions.

### Authorization/RLS

- direct table insert/update/delete bị chặn;
- giả mạo `responsible`, `rescuer`, `count`, `latest rejection`, `submitted_by` trong payload bị bỏ qua hoặc reject;
- contributor không tự submit/rescue/restore/delete;
- A không submit thay B trong rescue;
- B không tự tạo second rescue hoặc thay đổi rescuer;
- owner/co-owner restore/delete hợp lệ từ stale-safe state.

### Race/concurrency

Chạy hai transaction/session cho từng cặp race ở mục 6 và assert final state, số submission, số count và audit rows. Đặc biệt assert rejection count không vượt 3 và không có orphan pending submission.

### Frontend/component/manual QA

- draft ordinary, ordinary held, rescue active draft, rescue pending, rescue 1/3, rescue 2/3, rescue failed 3/3, restored draft, deleted topic;
- role matrix owner, co-owner, A, B, contributor, independent reviewer;
- refresh/multiple tabs sau start rescue, reject, restore, delete;
- stale confirmation sau actor khác đã restore/delete;
- ordinary reviewer không nhìn thấy rejection budget;
- wording `Xóa bài học` nhất quán; không còn wording mơ hồ “submit hộ” hoặc nút rescue lần hai.

## 9. Self-review của correction plan

Đã tự rà theo bốn tiêu chí trước khi dừng:

- Contract completeness: đã bao phủ identity, one-rescue, separate 3/3 budget, reviewer exclusion, restore/delete, canonical state và reviewer UI.
- Architecture/race safety: đã tách takeover khỏi submit, giữ `submitted_by` đúng nghĩa, thêm state owner/invariant, row lock, unique constraint, stale errors và race matrix.
- Migration safety: đã bổ sung inventory, evidence-based backfill, ambiguity quarantine, fail-closed rule và post-migration assertions; không rewrite lịch sử.
- Test coverage: đã bao phủ RPC/database, read model, RLS, race, migration và UI/manual role matrix; các test cũ encode drift được đánh dấu phải sửa.

Trong lúc self-review đã bổ sung hai điểm dễ bị bỏ sót: reconciliation của pending rescue drift cũ và decision boundary về semantics sau restore. Không phát hiện thiếu sót nào khác làm thay đổi root correction; hai Owner decisions ở mục 3.6 vẫn là điều kiện cần trước implementation.

## 10. Acceptance và stop condition

Correction chỉ được xem là sẵn sàng implementation khi:

1. Owner chốt hai unresolved decisions ở mục 3.6.
2. State transition table, migration mapping và error contract được review.
3. Không còn invariant nào dùng `submitted_by_user_id` để thay thế `responsible_author_user_id`.
4. Mọi phase P1-C đến P4-C có test/evidence tương ứng.

Sau tài liệu này không thực hiện code, migration, test, commit hoặc remote action trong checkpoint hiện tại.
