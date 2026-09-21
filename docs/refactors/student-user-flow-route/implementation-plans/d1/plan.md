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
status: "canonical current contract — v2 and v4 implemented locally; v3 deferred"
---

# D1 Detailed Implementation Plan — Canonical Current Contract

## 1. Vai trò của tài liệu

Đây là canonical detailed plan hiện hành cho D1 sau khi reconcile implementation thực tế. Tài liệu này thay thế vai trò điều phối active của các correction artifact cũ:

- [`correction-plan-deepseek-v2.md`](./correction-plan-deepseek-v2.md) là implemented historical baseline cho review lifecycle/review notes.
- [`correction-plan-deepseek-v4.md`](./correction-plan-deepseek-v4.md) là implemented historical amendment cho topic authority, review authority và lifecycle delete/restore. File frozen giữ nguyên hash `9b136bf4f22ae7ae99b159e4f7186fe64fc31322`.
- [`v4-implementation-reconciliation.md`](./v4-implementation-reconciliation.md) sở hữu disposition mới nhất cho các điểm implementation đã supersede hoặc sửa sai v4 frozen.
- [`correction-plan-deepseek-v3.md`](./correction-plan-deepseek-v3.md) là deferred amendment chưa implement. Không behavior riêng của v3 được mô tả là đã hoàn tất trong tài liệu này.

`progress.md` sở hữu delivery status/evidence lịch sử. File này sở hữu contract, invariant, state transition, scope, exclusions và acceptance hiện hành. Transcript, review-round journal và authority tạm thời không thuộc canonical plan.

## 2. Mục tiêu và trạng thái

D1 cung cấp workflow topic authoring đáng tin cậy:

```text
create
  → draft authoring
  → request review
  → pending frozen
  → approve → published
  └ reject  → draft → sửa và request lại
```

Kết quả hiện tại:

| Phần | Trạng thái |
| --- | --- |
| D1 foundation P0–P4 và authorship amendments P0-A–P4-A | Implemented local |
| v2 P1–P5: bỏ escalation/rescue, thêm `review_notes` và rejection history | Implemented local |
| v4 P11–P18: authority split, delete/restore, read model, UI và tests | Implemented local |
| Follow-up role-only downgrade và Settings delete redirect | Implemented, automated checks + hai manual scenarios đạt |
| v3 target-attached review-note creation UI | Deferred/unimplemented |
| Push/PR/merge/deploy/remote DB | Không thuộc trạng thái hoàn tất local này |

Không tồn tại lifecycle state `authoring`; persisted topic status chỉ là `draft|pending|published`.

## 3. Actor và authority model

### 3.1 Global role và course membership

- Global role và course collaborator role là hai lớp độc lập.
- Normal course creation thuộc global `teacher`; platform `admin` không đi qua normal teacher-create path chỉ vì là admin.
- Authoring trong một course được derive từ active course membership và capability cụ thể, không từ global role thay thế cho membership.
- Global `student` hoặc `admin` vẫn có thể dùng bounded course workspace khi có active collaborator membership; local role/topic authorship quyết định capability của họ.
- Course-list/workspace entry theo membership; create affordance chỉ hiện cho global teacher. Admin không membership không nhận “Khóa học của tôi” chỉ từ platform role.
- Platform moderation là authority riêng, không đồng nghĩa với topic review hoặc normal course authoring.

### 3.2 Topic authorship

Mỗi topic giữ:

- immutable original creator;
- đúng một current responsible author;
- tối đa hai active contributors;
- initial/pre-first-approval exclusion evidence cần thiết cho reviewer independence.

Create topic khởi tạo original creator và responsible author từ caller hợp lệ. Creator/responsible không tiêu contributor slot. Creator không được thêm lại như contributor.

Topic identity chỉ cấp quyền khi actor vẫn là active course collaborator. Profile/course membership đã removed không thể tiếp tục mutation nhờ historical authorship.

### 3.3 Ba capability riêng

| Capability | Rule |
| --- | --- |
| `canEditContent` | Active collaborator và là original creator, current responsible author hoặc active contributor |
| `canManageStructure` | Active collaborator có course role `owner|co_owner|editor` |
| `canDeleteTopic` | Active collaborator và là `owner|co_owner|original creator|responsible author` |

Hệ quả bắt buộc:

- Editor ngoài authoring group được reorder course structure nhưng không rename/edit/delete topic của nhóm khác.
- Previewer thuộc authoring group vẫn edit topic content nhưng không reorder structure.
- Contributor được edit content nhưng không delete/restore hoặc submit review.
- Rename topic là content mutation; reorder là structure mutation; delete/restore là lifecycle/ownership mutation.
- Mọi supported content writer đi qua topic-group authorization. Structure, delete và review dùng authority riêng, không reuse một boolean `canEdit` overloaded.

State `previewer + contributor` là reachable: một editor đang là contributor có thể bị downgrade xuống previewer, và contributor row phải được giữ nguyên.

### 3.4 Review authority

- `owner`/`co_owner`: review authority role-native.
- `editor`/`previewer`: chỉ có review authority khi `can_review_topics=true`.
- `can_review_topics` trên owner tier không materialize quyền và không tạo toggle riêng.
- Promotion lên owner tier có authority từ role; không cần set flag.
- Downgrade `owner/co_owner → editor/previewer` clear flag cũ.
- Downgrade `editor(flag=true) → previewer` clear flag.
- `previewer(flag=true) → editor` giữ explicit grant.
- Remove khỏi course làm mất toàn bộ review authority.

Effective review permission luôn re-check current role/flag, reviewer exclusion và lifecycle bên trong trusted mutation boundary.

### 3.5 Course ownership và collaborator invitation

- Supported course creation tạo đúng một `owner`; DB partial unique guard chặn owner thứ hai trên cùng course.
- `co_owner` là privileged collaborator role, không phải ownership-transfer mechanism.
- Persisted invitation lifecycle là `pending|accepted|rejected|revoked`; terminal row không được tái sử dụng, re-invite tạo row mới.
- Owner được mời `co_owner|editor|previewer`; co_owner chỉ được mời `editor|previewer`; editor/previewer không quản lý membership.
- Per-role caps hiện hành: `co_owner=2`, `editor=5`, `previewer=10`. Send/accept/role mutation cùng lock course và tính active membership + pending reservation; không persist counter phụ.
- Accepted invitation materialize membership atomically. Invitee identity bind từ trusted Auth identity/email, không từ caller-editable profile email.
- Direct invitation writes bị chặn; invitee chỉ đọc/accept/reject invitation của mình, owner/co_owner chỉ đọc/revoke theo hierarchy.
- Invitation là membership-acquisition relation, không phải reviewer-delegation entity.

## 4. Topic lifecycle

### 4.1 Create

- Topic mới luôn `draft`.
- Create sử dụng authoritative returned topic id; navigation không suy ra từ list/draft cardinality.
- Caller phải có course-structure authoring authority.
- Create khởi tạo immutable creator/responsible provenance.

### 4.2 Draft authoring

- `canEditContent` cho phép topic/card/exercise/question-group/question/option/media mutation qua supported boundaries.
- Readiness chỉ gate request review; không tự publish.
- Readiness yêu cầu ít nhất một active flashcard và một active exercise (`removed_at is null`).

Inner create-exercise boundary phải dùng cùng topic-content authority với outer supported path. `d1_create_exercise_with_content_unchecked` không dùng course-management gate để veto previewer creator; helper vẫn private đối với authenticated caller và outsider vẫn bị chặn.

Normal content mutation trên topic `published` cần explicit confirmation/intent và phải atomically demote topic về `draft` trước hoặc cùng mutation theo canonical boundary. Client flag đơn lẻ không được bypass trực tiếp DB guard. Pending content luôn frozen.

### 4.3 Request review

- Chỉ original creator hoặc current responsible author được request/resubmit.
- Actor phải còn active course membership.
- Topic phải là `draft` và đạt readiness tại transaction time.
- Request tạo pending submission và chuyển topic sang `pending` atomically.
- Contributor có submit action disabled cùng reason gắn trực tiếp tại action; contributor không submit được.

### 4.4 Pending freeze

- Pending freeze mọi normal content/structure mutation.
- Approve/reject/withdraw/delete là các lifecycle transition riêng, không phải generic edit.
- UI/read DTO phản ánh server-derived capability; client không tự suy ra quyền từ role labels.

### 4.5 Approve và reject

- Approve/reject chỉ cho effective reviewer không bị exclusion.
- Approve re-check pending submission, readiness, permission và reviewer independence dưới lock; success chuyển topic thành `published` và ghi review evidence.
- Reject bắt buộc reason, đóng submission và đưa topic về `draft`.
- Reject không đổi responsible author.
- Không có rejection budget, third-rejection hold, escalation, rescue, takeover hoặc course creation hold.
- Sau reject, creator/responsible có thể sửa và request lại không giới hạn theo canonical path.

### 4.6 Withdraw

- Original creator hoặc current responsible author có thể `withdraw_review_to_draft` khi có pending submission hợp lệ.
- Contributor, unrelated collaborator hoặc removed creator không được withdraw.
- Withdraw cancel pending submission và đưa topic về `draft`; đây không phải delete alias.

### 4.7 Delete và restore

Canonical `d1_delete_topic` giữ:

- `removed_at is not null` → `TOPIC_NOT_FOUND`;
- `published` chưa confirm → `TOPIC_PUBLISHED_CONFIRM_REQUIRED`;
- `pending` → cancel pending submission rồi soft-delete trong cùng transaction;
- mọi successful delete đặt `status='draft'` và `removed_at` trong cùng statement/transactional transition.

Delete authority thuộc owner/co_owner/original creator/responsible. Restore mirror cùng authority và luôn phục hồi về `draft`. Contributor và unrelated editor không delete/restore.

Invariant:

```text
removed_at is not null ⇒ status = 'draft'
```

## 5. Authorship transition và collaborator membership

### 5.1 Explicit responsibility transfer

- Responsibility transfer là topic operation riêng.
- Recipient hợp lệ theo operation contract; không random assignment.
- Transfer giữ đúng một responsible author, contributor cap và pre-first-approval exclusion history.
- Transfer feedback ghi course/topic/context; actor tự nhận không tự notify chính mình.

### 5.2 Role downgrade — role-only

`co_owner|editor → previewer` chỉ thay đổi course role và review-capability semantics:

- không chạy responsibility candidate resolver;
- không transfer topic responsibility;
- giữ nguyên original creator;
- giữ nguyên responsible author;
- giữ nguyên mọi active contributor row.

Canonical RPC là `update_course_collaborator_role`. RPC `update_course_collaborator_role_with_responsibility` đã bị drop.

Downgrade vẫn phải clear review grant theo §3.4 và giữ last-reviewer safety, nhưng reviewer safety không được biến thành authorship transfer.

### 5.3 Remove và self-leave

Remove/leave là membership-loss path nên vẫn fail closed:

- nếu target còn responsible topic chưa approved, phải resolve valid recipient trước mutation;
- missing/invalid recipient block toàn bộ operation;
- transfer và membership mutation commit atomically;
- self-leave giữ recipient semantics riêng;
- không để topic thiếu responsible author hoặc partial leave.

Candidate resolution/transfer machinery chỉ thuộc remove/leave, không thuộc role downgrade.

## 6. Review notes và rejection history

### 6.1 Canonical rejection state

- `rejectionCount` và `rejectionHistory` derive theo topic, giống nhau cho mọi caller được phép đọc.
- Mỗi history entry giữ reason, reviewer identity và timestamp.
- Chỉ capability fields phụ thuộc caller.

### 6.2 `review_notes`

- Note gắn topic hoặc đúng một `card`/`exercise` cùng topic.
- Reviewer hợp lệ được tạo note.
- Reviewer và current topic participant còn course membership được đọc.
- Chỉ note author được sửa body hoặc soft-delete.
- Soft-deleted note vẫn hiện tombstone cùng author/removal identity cần thiết.
- Hard delete không phải supported end-user behavior.

v3 đề xuất UI tạo note gắn đích trực tiếp tại card/exercise và visual redesign tương ứng. Vì v3 chưa implement, current contract chỉ bảo đảm storage/action/read support và UI hiện hành đã triển khai từ v2; không claim v3 interaction đã có.

## 7. Read model và frontend surfaces

### 7.1 Topic workflow read model

Trusted workflow DTO trả:

- lifecycle/readiness;
- original creator, responsible author, contributors;
- `canEditContent`, `canManageStructure`, `canDeleteTopic`;
- `canRequestReview`, `canWithdrawReview`, `canReview`;
- rejection history và review-note data theo reader boundary;
- transfer feedback khi caller là recipient hợp lệ.

UI dùng DTO server-derived; không duplicate permission rules bằng role checks cục bộ.

### 7.2 Course Structure

- Row action dùng capability đúng semantic: edit content, manage structure, delete.
- Reorder chỉ theo `canManageStructure` và lifecycle.
- Open/edit topic content theo `canEditContent`; outside-group collaborator không sửa Builder content. Editor ngoài group vẫn có thể manage/reorder structure theo `canManageStructure`.

### 7.3 Delete surfaces

Ba surface phải được phân biệt:

1. `SettingsTab`: gọi `deleteTopicFromBuilder`; success revalidate course overview + Course Structure rồi server-side `redirect(..., RedirectType.replace)`. Không client `push|replace|refresh` để sửa race.
2. `TopicWorkflowPanel`: gọi `deleteTopic`; success dùng `router.push(getCourseStructurePath(...))` và không `router.refresh()` deleted-topic route.
3. Structure page: tiếp tục dùng `deleteTopic`, ở lại Course Structure và refresh danh sách/state tại chỗ theo response contract hiện hành.

Hai Builder surface phải rời deleted-topic route thành công và không reread topic đã xóa. Structure surface vốn không ở topic route nên giữ hành vi tại chỗ; ba navigation mechanism không bị đồng nhất giả tạo.

## 8. Database và trust boundary

### 8.1 Canonical migrations

Các migration D1 đã triển khai foundation và correction; phần reconcile mới nhất cần đọc đặc biệt:

- `20260917120000_d1_review_notes.sql`: review-notes DDL/helper/RLS.
- `20260919100000_d1_topic_authority_split.sql`: topic/content/structure/delete authority split.
- `20260919120000_d1_topic_lifecycle_delete.sql`: delete/restore/read-model cleanup.
- `20260919130000_d1_inner_create_authority.sql`: inner exercise create theo topic-content authority.
- `20260921100000_d1_role_downgrade_preserves_authorship.sql`: role-only downgrade và drop obsolete with-responsibility RPC.

V4 planning syntax `RETURNS public.topics%rowtype` là plan defect. SQL function return type đúng là `RETURNS public.topics`; `%rowtype` chỉ dùng cho PL/pgSQL variable declaration.

### 8.2 Security/locking rules

- Supported app mutations dùng trusted RPC/action boundary; generic authenticated direct writes không được bypass lifecycle/authorship/reviewer checks.
- Lock course/topic/membership rows theo established order trước khi re-check mutable permission/state.
- RLS/trigger là defense-in-depth cho direct Data API paths; application checks không thay thế DB invariant.
- Internal unchecked/helper functions giữ private khi không có client use case.
- `service_role` là infrastructure bypass, không được expose như end-user mutation route.
- Platform admin moderation dùng explicit boundary/audit riêng; admin identity không tự cấp review/publish authority.

### 8.3 Media và Storage integrity

- Question-group media upload/mutation dùng trusted course/topic context và topic-content authority; global role một mình không cấp normal upload.
- Persisted media replace/clear là DB-first dưới course/topic lock; old object chỉ cleanup sau commit.
- Ordinary Storage DELETE phải re-resolve course/topic, active membership/group authority, lifecycle và persisted reference. Pending/published/removed/outside-group/referenced object không được xóa bằng ordinary path.
- Cleanup failure sau committed reference change tạo orphan có thể dọn sau, không rollback DB về stale reference.
- Course thumbnail create dùng teacher-only staging path trước khi course tồn tại; update dùng course-local owner/co_owner/editor authority. Nếu DB mutation sau upload thất bại, action cleanup object mới.
- Admin maintenance/delete là explicit exception riêng, không biến admin thành normal author/uploader.

### 8.4 Platform moderation

- Global admin không membership không request/approve/reject topic và không được tính là eligible reviewer.
- Trusted moderation có thể demote/takedown supported course/topic target hoặc invalidate/cancel pending review khi moderation làm candidate không còn hợp lệ.
- Moderation bắt buộc reason và distinct audit gồm actor, target, action, previous state và timestamp.
- Moderation không publish, không masquerade thành approve/reject và không thay đổi rejection history như một review verdict.
- Full admin moderation product/UI không được suy ra từ trusted backend boundary hiện hành.

## 9. Verification và bằng chứng

### 9.1 Historical v2 closure

- Local implementation commit `0cdcec4`.
- `npx supabase db reset` đạt.
- TypeScript đạt.
- Unit: `62 files / 525 tests`.
- Integration: `16 files / 162 tests`.
- Literal removal grid: `9/9` đạt.
- Browser automation M1–M11: `11/11 pass`.

Browser automation là automation evidence, không tự đổi nhãn thành manual QA.

### 9.2 Historical v4 closure

- TypeScript exit `0`.
- Unit: `62 files / 533 tests`.
- Integration: `16 files / 178 tests`.
- Local `db reset` đạt.
- Implementation review đạt `0 Critical / 0 Required` nhưng từng giữ verdict `BLOCKED(manual_qa_pending)` cho M17–M28.
- Fixture v2 đã được xác minh `READY`; statement `NOT READY` trong v4 frozen là stale.

### 9.3 Follow-up correction closure

- Focused component/action: `4 files / 43 tests` đạt.
- Topic-authorship integration: `1 file / 19 tests` đạt.
- TypeScript, targeted ESLint và `git diff --check` đạt.
- Owner manual QA: Settings Builder delete **PASS**; downgrade `test@gmail.com` từ `co_owner` xuống `previewer` **PASS**.

Hai manual checks trên chỉ chứng minh đúng hai scenario đó; không phải bằng chứng toàn bộ M17–M28 đã được rerun.

### 9.4 Regression owners

Các file sau là canonical automated-coverage owners cho contract hiện hành; danh sách này định vị coverage, không tuyên bố chúng vừa được rerun sau mọi docs edit:

- `course-creation-rls.test.ts`: normal teacher creation, singular owner và authorization boundary.
- `course-collaborator-invitations.test.ts`: invitation lifecycle, hierarchy, role caps và trusted invitee behavior.
- `topic-review-lifecycle.test.ts`: request/approve/reject, reviewer authority, readiness, pending/published lifecycle và moderation boundary.
- `topic-authorship-foundation.test.ts` + `topic-authorship-boundary.test.ts`: creator/responsible/contributor invariants, role-only downgrade, remove/leave transfer và concurrency.
- `topic-group-content-boundary.test.ts`: content authority closure, M24 inner exercise-create path và negative controls.
- `question-group-media-storage.test.ts`: Storage/reference/lifecycle boundary.
- Focused action/component tests: trusted DTO/action wiring, M18/M27, Settings delete server redirect và collaborator resolver routing.

## 10. Acceptance invariants hiện hành

1. Topic mới luôn `draft`, có immutable creator và đúng một responsible author.
2. Topic chỉ request review khi có ít nhất một active card và một active exercise.
3. Chỉ creator/responsible request, resubmit hoặc withdraw; contributor edit nhưng không submit.
4. Pending freeze content/structure; approve/reject/delete/withdraw đi qua transition riêng.
5. Reviewer authority đúng role/flag và luôn áp exclusion/no-self-review/current-state check.
6. Reject về `draft`, lưu history đầy đủ và không tạo budget/hold/escalation/rescue.
7. Ba capability content/structure/delete không bị collapse.
8. Previewer creator/contributor còn active membership vẫn edit content; không reorder structure.
9. M24 inner create-exercise không táiintroduce course-management veto hoặc public unchecked helper.
10. Delete pending cancel submission atomically; delete published cần confirm; restore về draft.
11. Role downgrade chỉ đổi role/review semantics và giữ mọi topic authorship position.
12. Remove/leave có affected responsibility vẫn yêu cầu transfer recipient hợp lệ, atomic và fail closed.
13. Settings delete server redirect, WorkflowPanel push/no-refresh và Structure delete ở lại trang + refresh danh sách giữ đúng từng surface contract.
14. `review_notes` authorization, target integrity, author-only mutation và tombstone semantics giữ ở DB/application/UI boundary.
15. Supported course creation/invitation giữ singular owner, hierarchy, role caps, pending reservation và trusted invitee identity.
16. Media/thumbnail mutation giữ course/topic authority, DB-first reference integrity và post-failure cleanup.
17. Admin moderation tách khỏi review, có mandatory reason/audit và không publish.
18. Current docs không trình bày v2/v4 là future candidate hoặc v3 là implemented.

## 11. Deferred và ngoài phạm vi

### 11.1 Deferred D1 amendment

- v3 target-attached review-note creation UI, visual productionization và các acceptance riêng của v3.

### 11.2 Ngoài D1 reconciliation

- Q7 internal preview/access correction.
- D2 preview-topic contract.
- Candidate/published revision system.
- Course publication, learner memory/completion/exercise-correctness.
- Broad collaborator redesign, bulk responsibility transfer UI.
- Email/push delivery, expiry/reminder, ownership-transfer feature.
- Generalized capability/delegation entity.
- Skill/routing/browser-infrastructure correction.
- Remote migration, production mutation, deploy và remote delivery.

## 12. Known limitations và truthful status

- v2/v4 frozen artifacts chứa planning-time metadata và repository snapshots đã stale; chúng chỉ còn historical/audit value.
- v4 còn các non-blocking frozen findings theo Owner disposition; không sửa byte chỉ để làm đẹp lịch sử.
- Owner flow có nhắc `E9`, nhưng repository không có canonical criterion/test identifier đó. Không invent behavior; dùng concrete contract/test evidence.
- Full repository lint và mọi manual matrix không được claim từ các focused checks mới nhất.
- Current working tree có nhiều thay đổi D1 đồng thời; Git history/delivery status phải đọc từ `progress.md` và actual Git state, không suy ra từ plan.

## 13. Future change và handoff rules

- Fresh implementer dùng file này làm D1 contract hiện hành; chỉ mở historical v2/v4 khi cần audit rationale.
- Nếu current code mâu thuẫn với invariant ở đây, dừng và route plan-contract mismatch; không silently sửa plan hoặc code.
- v3 chỉ được nhập vào canonical contract sau khi được Owner approve, implement và review theo authority riêng.
- Mọi thay đổi product/permission mới phải cập nhật canonical owner thay vì tạo thêm correction artifact chồng lấn nếu không cần thiết.
- Commit, push, PR, merge, deploy và DB remote mutation luôn là authority riêng.

## 14. Completion boundary của lần reconcile

Lần reconcile documentation hoàn tất khi:

- reconciliation v4 được independent reviewer chấp nhận;
- canonical plan phản ánh v2 + v4 + implementation reconciliation và loại v3 khỏi implemented scope;
- v4 frozen hash không đổi;
- deterministic docs/source checks đạt;
- fresh reviewer không còn `Critical` hoặc `Required` finding;
- không có code/test/migration/progress/problem/skill/remote change ngoài scope.
