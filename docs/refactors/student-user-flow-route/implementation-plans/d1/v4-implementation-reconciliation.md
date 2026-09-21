---
title: "D1 v4 implementation reconciliation — canonical implemented delta"
wave: D1
branch: feat/topic-publish-validation
baseline: ./correction-plan-deepseek-v2.md
frozen_amendment: ./correction-plan-deepseek-v4.md
canonical_target: ./plan.md
status: "reconciliation candidate — independent review required before canonical plan rewrite"
---

# D1 v4 Implementation Reconciliation

## 1. Mục đích và thứ tự ưu tiên

Tài liệu này đối chiếu contract v4 đã freeze với implementation thực tế sau P11–P18 và các correction phát sinh sau đó. Nó là nguồn chuyển tiếp để viết lại [`plan.md`](./plan.md) thành canonical detailed plan hiện hành.

Thứ tự áp dụng contract cho lần reconcile này:

1. [`correction-plan-deepseek-v2.md`](./correction-plan-deepseek-v2.md) là baseline đã implement cho việc bỏ escalation/rescue/rejection budget, thêm `review_notes` và canonical rejection history.
2. [`correction-plan-deepseek-v4.md`](./correction-plan-deepseek-v4.md) là amendment đã implement cho topic authority, review authority, lifecycle delete/restore và ba capability riêng.
3. Tài liệu này là authority mới nhất **chỉ tại những điểm implementation cuối cùng đã supersede hoặc sửa sai v4 frozen**.
4. Current repository code, migration và test là bằng chứng implementation; `progress.md` sở hữu delivery status/evidence lịch sử.

[`correction-plan-deepseek-v4.md`](./correction-plan-deepseek-v4.md) được giữ nguyên byte như historical frozen artifact:

- Git object: `9b136bf4f22ae7ae99b159e4f7186fe64fc31322`
- Kích thước: `176308` bytes
- Không sửa bốn finding non-blocking đã được Owner disposition khi freeze.

`correction-plan-deepseek-v3.md` **không thuộc lần reconcile này**. v3 chưa implement và không được nhập vào canonical contract như behavior đã hoàn tất.

## 2. Trạng thái thực tế

v2 P1–P5 và v4 P11–P18 đã được implement local. Hai artifact cũ không còn là tài liệu điều phối active:

- v2 là implemented historical baseline, không còn là `planning-only candidate`.
- v4 là implemented historical amendment, không còn là `proposal`, `unreviewed candidate` hoặc `implementation chưa được cấp`.
- `plan.md` phải trở thành SSOT canonical mới sau khi tài liệu reconciliation này được review đạt.

Remote migration, `db push`, push, PR, merge và deploy không nằm trong lần reconcile tài liệu này.

## 3. Contract v2 đã implement và phải giữ

Canonical plan mới phải giữ các outcome sau từ v2:

- Reject đưa topic về `draft`; không còn budget ba lần, escalation, rescue, takeover hoặc creation hold.
- Resubmit đi qua canonical `request_topic_review`; không có đường rescue song song.
- `rejectionCount` và `rejectionHistory` là canonical topic-scoped state, không phụ thuộc caller.
- `review_notes` hỗ trợ note cấp topic hoặc gắn đúng một `card`/`exercise`; reviewer có quyền viết, tác giả note có quyền sửa/xóa mềm, reader hợp lệ vẫn thấy tombstone.
- Lịch sử từ chối hiển thị đầy đủ reason, reviewer và timestamp.
- v3 vẫn sở hữu đề xuất UI tạo note gắn đích tại nội dung; vì chưa implement nên canonical plan hiện tại chỉ ghi đây là deferred amendment, không claim UI đó đã tồn tại.

Các mô tả repository trước v2 trong `plan.md` và v2 — escalation table/RPC, rescue path, rejection budget, caller-scoped rejection state — chỉ còn là historical before-state.

## 4. Contract v4 đã implement và phải giữ

### 4.1 Topic authorship và authoring group

- Original creator là immutable provenance.
- Mỗi topic có đúng một responsible author.
- Tối đa hai active contributor; creator/responsible không tiêu một contributor slot.
- Creator, responsible author và active contributor có topic-content authoring rights khi còn active course membership.
- Creator và responsible author được request/resubmit/withdraw theo lifecycle contract; contributor có thể edit nhưng không submit.
- Reviewer exclusion vẫn áp dụng cho current authoring group và pre-first-approval history theo contract D20/D21.

### 4.2 Ba capability riêng

- `canEditContent`: active course collaborator và thuộc topic authoring group.
- `canManageStructure`: active collaborator với course role `owner|co_owner|editor`.
- `canDeleteTopic`: active collaborator và là `owner|co_owner|original creator|responsible author`.
- Editor ngoài group có thể reorder structure nhưng không edit content hoặc rename/delete topic của nhóm khác.
- Previewer thuộc authoring group có thể edit content nhưng không reorder course structure.

### 4.3 Review authority

- `owner`/`co_owner` có review authority từ role.
- `editor`/`previewer` chỉ có review authority khi `can_review_topics=true`.
- Hạ tier phải clear review grant cũ; promotion vào owner tier không cần materialize flag.
- Reviewer authority vẫn đi qua reviewer-exclusion và last-reviewer safety tại trusted boundary.

### 4.4 Lifecycle delete/restore

- Một canonical `d1_delete_topic` xử lý `draft`, `pending` và `published`.
- Delete pending atomically cancel pending submission rồi soft-delete.
- Delete published cần explicit confirmation.
- Delete/restore giữ invariant `removed_at is not null => status='draft'`.
- Restore mirror delete authority; contributor hoặc unrelated editor không được restore.
- `withdraw_review_to_draft` là action riêng của creator/responsible, không phải delete alias.

## 5. Những điểm implementation supersede v4 frozen

### 5.1 Role downgrade là role-only

Contract cuối cùng:

- `co_owner|editor -> previewer` chỉ đổi `course_collaborators.role` và review-capability semantics.
- Downgrade **không** resolve responsibility candidate và **không** transfer topic responsibility.
- Original creator, responsible author và mọi active contributor row giữ nguyên.
- `update_course_collaborator_role` là RPC role-only canonical.
- `update_course_collaborator_role_with_responsibility` đã bị drop và không còn là enforcement boundary.
- Resolver/transfer machinery chỉ còn cho collaborator remove và responsible-author self-leave, nơi missing recipient vẫn fail closed.

Điểm này supersede:

- v4 §3.14/§5.5 và các handoff statement quy D42 enforcement cho `update_course_collaborator_role_with_responsibility`;
- `plan.md` cũ tại các đoạn nói downgrade responsible author phải transfer hoặc block.

D42 outcome vẫn giữ: downgrade clear review grant cũ. Chỉ responsibility-transfer side effect bị loại khỏi downgrade.

### 5.2 Hai delete surface trong Topic Builder

Hai surface hiện hành cùng tránh reread route topic đã xóa, nhưng không dùng cùng navigation mechanism:

- `SettingsTab` dùng dedicated `deleteTopicFromBuilder`. Sau successful mutation, Server Action revalidate course overview + Course Structure rồi `redirect(..., RedirectType.replace)` về Course Structure. Surface này không dùng client `push`, `replace`, `refresh` hoặc client guard để sửa race.
- `TopicWorkflowPanel` tiếp tục gọi `deleteTopic`, rồi dùng `router.push(getCourseStructurePath(...))`. Correction M27 ở surface này bỏ `router.refresh()` vì refresh sẽ render lại chính route topic vừa bị xóa.
- Structure-page delete tiếp tục dùng `deleteTopic` với response contract cũ.

Canonical plan không được khái quát correction riêng của `SettingsTab` thành invariant rằng mọi Topic Builder delete đều dùng server-side redirect hoặc không có client navigation.

### 5.3 M18/M24/M27 và follow-up browser correction

- M18: contributor thấy submit action disabled và có affordance tooltip/focusable giải thích reason; contributor không được submit.
- M24: inner create-exercise path `d1_create_exercise_with_content_unchecked` dùng topic-content authority thay vì course-management gate. Vì vậy creator bị hạ xuống `previewer` vẫn tạo exercise qua supported outer RPC; outsider và authenticated direct call vào unchecked helper vẫn bị chặn.
- M27: `TopicWorkflowPanel` sau successful delete dùng `router.push` về Course Structure và không gọi `router.refresh()` trên deleted-topic route.
- Follow-up role correction xác nhận downgrade xuống `previewer` không mở responsibility resolver và không đổi creator/responsible/contributor rows.
- Follow-up `SettingsTab` correction xác nhận nút Ẩn bài học dùng dedicated server-side redirect về Course Structure mà không phát `[TOPIC WORKFLOW READ ERROR]`.

Owner flow có nhắc nhãn `E9`, nhưng repository hiện không có canonical criterion/test identifier `E9`. Reconciliation không tự phát minh behavior mới cho nhãn này; behavior quan sát được được ghi bằng các contract/test cụ thể ở trên.

## 6. Plan defects và stale facts phải sửa trong canonical plan

### 6.1 F2 — invalid SQL return syntax

V4 đề xuất `RETURNS public.topics%rowtype`; cú pháp đó không hợp lệ trong `RETURNS`. Implementation đúng dùng `RETURNS public.topics`. `%rowtype` chỉ hợp lệ cho PL/pgSQL variable declaration.

### 6.2 F7 — `previewer + contributor` là reachable

V4 nói actor `previewer + contributor` bất khả vì add-contributor chặn previewer. Thực tế editor đang là contributor có thể bị downgrade thành previewer mà contributor row vẫn giữ nguyên. Canonical plan phải coi state này hợp lệ và áp:

- content edit theo topic authorship;
- không structure reorder theo course role;
- role downgrade không xóa contributor row.

### 6.3 A1 và repository-currentness

V4 dùng assumption A1 để đóng coverage về content writers. Canonical plan không giữ assumption như evidence hiện hành; nó ghi contract trực tiếp: mọi supported content mutation phải đi qua topic-group authorization, còn structure/delete/review dùng authority riêng. Current migration/tests là evidence, không phải lời khẳng định planning-time.

### 6.4 Status và verification

Canonical plan không được giữ các statement sau như current truth:

- v2/v4 chưa approve hoặc chưa implement;
- P1–P5/P11–P18 còn là future work;
- fixture v2 `NOT READY`;
- unit/typecheck/integration chưa chạy;
- responsibility resolver thuộc role downgrade;
- v4 frozen là active execution contract.

## 7. Evidence hiện tại

### 7.1 v2 evidence

- Local implementation commit: `0cdcec4` (`fix(d1): replace review escalation with topic review notes`).
- Historical closure: `npx supabase db reset`, TypeScript, `62 files / 525 tests` unit, `16 files / 162 tests` integration, literal grid `9/9`, reviewer `PASS`.
- Browser automation M1–M11: `11/11 pass`; đây là automation evidence, không tự đổi nhãn thành manual QA.

### 7.2 v4 evidence

- `20260919100000_d1_topic_authority_split.sql` triển khai authority split.
- `20260919120000_d1_topic_lifecycle_delete.sql` triển khai lifecycle delete/restore và read model cleanup.
- `20260919130000_d1_inner_create_authority.sql` đóng M24 tại inner create-exercise boundary; `topic-group-content-boundary.test.ts` giữ positive/negative controls.
- `TopicWorkflowPanel.tsx` và `topic-workflow-panel.test.tsx` giữ M18/M27 ở đúng UI/navigation surface.
- Historical verification: TypeScript exit `0`, unit `62/533`, integration `16/178`, local `db reset` đạt.
- Implementation review từng ở `BLOCKED(manual_qa_pending)` với `0 Critical / 0 Required`; canonical plan chỉ claim manual scenarios nào có Owner evidence cụ thể.

### 7.3 Follow-up correction evidence

- Focused component/action tests: `4 files / 43 tests` đạt.
- Topic-authorship integration: `1 file / 19 tests` đạt.
- TypeScript, targeted ESLint và `git diff --check` đạt.
- Owner manual QA: Builder delete **PASS**; downgrade `test@gmail.com` từ `co_owner` xuống `previewer` **PASS**.

Không suy rộng hai manual checks này thành bằng chứng rằng toàn bộ M17–M28 đã được rerun.

## 8. Canonical `plan.md` rewrite contract

Sau khi reconciliation này được reviewer chấp nhận, `plan.md` phải được viết lại như current SSOT, không vá line-by-line. Bản mới phải:

1. Ghi v2 là implemented historical baseline.
2. Ghi v4 là implemented historical amendment.
3. Dùng §5–§6 của tài liệu này làm authority mới nhất cho các điểm đã supersede.
4. Giữ v3 là deferred/unimplemented amendment, không nhập behavior v3 vào current implementation.
5. Mô tả current architecture/invariants/state transitions thay vì before-state repository facts.
6. Tách implemented evidence khỏi remaining/deferred work.
7. Không copy transcript, review-round journal hoặc ephemeral workflow state vào canonical plan.
8. Giữ explicit exclusions: Q7, D2, candidate revision system, broad redesign, remote DB/deploy và v3 implementation.

## 9. Acceptance cho lần reconcile

Reconciliation đạt khi:

- v4 frozen hash vẫn là `9b136bf4f22ae7ae99b159e4f7186fe64fc31322`;
- v3 không bị sửa và không được mô tả là implemented;
- current role downgrade contract là role-only và preserves authorship;
- remove/leave vẫn giữ fail-closed transfer behavior;
- `SettingsTab` server-side redirect, `TopicWorkflowPanel` client `push` không-refresh và Structure delete được phân biệt đúng;
- M24 inner create-exercise authority không bị rút gọn thành quyền edit tổng quát;
- F2/F7/A1 được disposition rõ;
- evidence không overclaim manual QA;
- canonical rewrite có đủ thông tin để fresh reader không cần v2/v4 transcript mới hiểu current contract.

## 10. Permission và stop conditions

Lần này chỉ sửa tài liệu reconciliation và canonical `plan.md`. Không sửa code, migration, test, v2/v3/v4 frozen artifact, `progress.md`, `problems.md`, skill/routing, fixture hoặc Git history.

Dừng nếu reviewer phát hiện:

- current implementation mâu thuẫn với contract trên;
- cần quyết định product mới ngoài các Owner decision đã có;
- v3 behavior bị kéo vào như current implementation;
- canonical rewrite cần thay đổi code để trở nên đúng;
- frozen v4 bytes thay đổi.
