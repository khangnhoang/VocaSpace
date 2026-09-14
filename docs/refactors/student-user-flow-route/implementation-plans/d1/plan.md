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
create → draft → authoring → request review → pending → approve/reject
```

Topic chỉ trở thành `published` sau khi reviewer hợp lệ approve. Request review chỉ được phép khi topic có ít nhất một active flashcard và ít nhất một active exercise, trong đó active nghĩa là `removed_at IS NULL`. `pending` là review state thật và phải đóng băng topic/content mà reviewer đang xem.

Đây là detailed implementation plan, không phải implementation approval. Branch được tạo từ exact synchronized `origin/main` ở commit `5f43c65f4de2638dcbb6a0994826693d61971999`. Không có production code, migration, database mutation, push, pull request, merge hoặc deploy trong checkpoint này.

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
- `create_topic_ordered` trong `20260630090000_course_structure_ordering_rpc.sql` nhận `p_status`, được grant cho `authenticated` và `service_role`, nhưng không kiểm tra content readiness hoặc review lifecycle.
- Current RLS `Topics - Staff Update`, `Cards - Staff Update`, `Exercises - Staff Update`, child-write policies và `has_course_management_access` bảo vệ membership/management access, không bảo vệ status transition, pending freeze, readiness hoặc reviewer capability. Authenticated management caller có thể dùng Data API để direct-update các rows trong policy boundary.
- Current schema có trigger `set_updated_at_*`, không có trigger cross-table readiness/lifecycle. Không tìm thấy app restore action; direct update của `removed_at` vẫn là database concern.
- Topic review chưa có action/history. Course review metadata ở `courses` và admin review UI hiện là mock/unimplemented, không phải topic review path có thể reuse như supported behavior.
- Existing tests cover topic CRUD/order, dashboard readiness (gồm soft-delete filtering), card/exercise CRUD/RPC/RLS và browser authoring smoke. Chưa có matrix cho topic review lifecycle, pending freeze, reviewer delegation, no-self-review, rejection threshold, published demotion hoặc concurrency.

### 2.2 Existing approved contract

- Topic mới luôn `draft`; create UI chỉ nhận metadata cần thiết và CTA tiếp tục vào builder.
- Readiness chỉ gates request review: `>=1` active flashcard **và** `>=1` active exercise. Readiness không trực tiếp publish.
- `pending` là state review bị frozen; approve của reviewer hợp lệ mới chuyển `published`; reject bắt buộc reason và quay về `draft`.
- Không có role mới tên `reviewer`: `owner`/`co_owner` có implicit course-scoped review capability; `editor`/`previewer` chỉ có nếu được delegated capability.
- Submitter không được approve/reject submission của chính mình. Approve/reject kiểm tra effective permission tại mutation time.
- Collaborator role/membership transition không được làm pending submission mất reviewer hợp lệ cuối cùng.
- Cùng một author/submission lifecycle bị reject tối đa ba lần; sau ngưỡng submitter không được resubmit trong workflow đó. Audit và escalation phải được giữ lại; không tự phát minh owner transfer.
- Trước candidate revision system, published content mutation phải cảnh báo, yêu cầu explicit confirm, và content mutation + demotion về `draft` phải atomic. Cancel không đổi state; không silent demotion.

### 2.3 Inference/risk cần giữ nguyên trong plan

- `authoring` được hiểu là UX/workflow phase trên persisted `draft`, vì current enum không có `authoring`. Đây là agent recommendation để tránh thêm enum không cần thiết; nếu Owner muốn persisted state riêng thì phải mở decision trước implementation.
- Application-only enforcement chỉ bảo vệ caller đi qua Server Actions. Với current RPC grants, direct Data API policies và service-role capability, nó không chứng minh database-wide guarantee.
- Published edit demotion là compatibility bridge trước future candidate revisions; không được thiết kế API khiến learner đọc draft mới thay cho published content.

## 3. Exact current publish/write architecture

### 3.1 Current supported publish-capable paths

Đếm theo logical application action là **2**; đếm theo teacher UI entry point là **3**:

| Path hiện tại | Entry point | Write boundary | Có thể set `published`? |
| --- | --- | --- | --- |
| Create topic | `TopicManagementSheet` create | `createTopic` → `create_topic_ordered(p_status)` | Có |
| Edit topic từ structure | `TopicManagementSheet` edit | `updateTopic` → direct `topics.update` | Có |
| Edit topic trong builder | `SettingsTab` | `updateTopic` → direct `topics.update` | Có |

Không tìm thấy topic publish action riêng, topic approve/reject action, hoặc supported admin topic-review action. `app/admin/courses/page.tsx` chỉ có mock course review handlers và ném `not implemented`. Seed/integration/E2E helpers dùng service-role hoặc admin client để tạo fixture, nhưng đó là test infrastructure, không phải supported end-user publish path; service-role về bản chất vẫn bypass RLS và không thể được dùng làm bằng chứng cho DB invariant.

Ở database boundary hiện có thêm hai cơ chế caller có thể dùng: authenticated được execute `create_topic_ordered`, và authenticated management caller được direct-update `topics` qua RLS. Hai cơ chế này không funnel qua một trusted lifecycle boundary. Đây là confirmed bypass, không phải giả định.

### 3.2 Read model và downstream consequence

Public read model và learner queries lọc topic `status = 'published'` + active. Vì vậy một invalid published topic có thể trở thành learner-visible dù thiếu một loại content; ngược lại, soft-delete content sau khi publish có thể làm published topic mất readiness mà current public read model không tự loại bỏ.

## 4. Final D1 lifecycle contract

| Transition | Điều kiện authoritative | Kết quả và side effects |
| --- | --- | --- |
| Create → `draft` | Authenticated creator có course management access; input không có status lifecycle | Tạo topic draft; trả id; UI điều hướng trực tiếp tới builder |
| `draft`/authoring → request review | Topic active; caller có authoring permission; có ít nhất 1 active card và 1 active exercise; chưa bị rejection lock | Ghi submission/audit metadata; chuyển `pending`; freeze topic và toàn bộ content liên quan |
| `pending` → approve | Submission còn pending; actor có effective review capability hiện tại; actor khác submitter; state/row version vẫn hợp lệ | Ghi reviewer/time/audit; chuyển `published`; learner đọc approved content |
| `pending` → reject | Submission còn pending; actor có effective review capability hiện tại; actor khác submitter; reason hợp lệ | Ghi reason/reviewer/time/audit; tăng rejection count; chuyển `draft` và mở authoring |
| `draft` sau reject → request review | Không vượt rejection threshold; readiness vẫn đạt; không bị lifecycle lock | Tạo/refresh submission theo policy; chuyển `pending` và freeze lại |
| `published` → content/metadata edit | User xác nhận cảnh báo; mutation được phép; topic lock giữ ổn định | Trong cùng atomic boundary: demote `draft` + áp dụng mutation; không để mutation thành published silently |
| `pending` → content/status mutation | Không có | Reject transaction; không partial child write, status write, soft-delete hoặc restore |
| direct status input → `pending`/`published` | Không có | Reject ở schema/action và DB boundary; only request-review/approve transitions own these writes |

`authoring` không phải status enum mới trong D1 theo recommendation hiện tại: Builder mở trên topic `draft` và hiển thị workflow phase/readiness. Không được để client tự gửi `pending` hoặc `published` như CRUD field.

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
| `owner` | Có | Không | Implicit, không persist default `true` |
| `co_owner` | Có | Không | Implicit, không persist default `true` |
| `editor` | Không | Có | Explicit course-scoped delegation |
| `previewer` | Không | Có | Explicit course-scoped delegation |
| submitter của submission | Không cho submission đó | Không override | No self-review |
| global `admin` | Chưa chốt | Chưa chốt | Owner decision cần thiết; plan mặc định không thêm ngoài role/capability contract |

Effective permission phải derive từ active current membership + role + explicit delegation tại thời điểm approve/reject. Role downgrade `co_owner → editor/previewer` mất implicit capability và không tự inherit delegation nếu chưa có explicit grant; remove collaborator mất capability ngay.

### 6.2 Current gap và minimal D1 boundary

Current `course_collaborators` chưa có active/removed/invite/delegation model; `addCollaborator` application action trả unsupported và `CourseForm` collaborator UI disabled, trong khi current RLS cho owner/co_owner/admin direct insert/update/delete. D1 không triển khai toàn bộ invite/ownership system, nhưng phải có minimal persisted/read/mutation boundary đủ cho review capability và last-reviewer safety.

**Agent recommendation:** dùng relation riêng kiểu `course_reviewer_delegations` keyed by `course_id + user_id`, có grant actor/time và active/revoked semantics; derive owner/co_owner implicit từ current membership thay vì persist boolean `true` trên collaborator row. Relation riêng tránh giữ nhầm capability khi role bị hạ. Tên bảng/cột và exact UI ownership vẫn cần implementation review.

Collaborator role/delete/delegation mutation phải lock hoặc dùng cùng transactional boundary với pending submission để không xoá/hạ role reviewer cuối cùng ngoài submitter. Nếu chỉ còn submitter hoặc không còn reviewer hợp lệ, mutation collaborator phải reject hoặc yêu cầu xử lý đã được owner contract chốt; không tự động chuyển ownership hoặc invent transfer.

## 7. Mutation matrix cho topic/content lifecycle

| Mutation family | `draft` | `pending` | `published` trước revision system |
| --- | --- | --- | --- |
| Topic title/metadata thay đổi | Cho phép | Block | Explicit confirm + atomic demotion nếu thay đổi làm approval semantics khác |
| Card create/update/bulk/delete | Cho phép | Block | Explicit confirm + atomic demotion |
| Exercise create/basic update/delete | Cho phép | Block | Explicit confirm + atomic demotion |
| Question/group/option/media mutation | Cho phép | Block | Explicit confirm + atomic demotion |
| Topic status CRUD input | Chỉ giữ draft | Block | Không cho direct status choice |
| Topic soft-delete | Cần giữ current confirmation; pending behavior phải block | Block theo frozen contract | Delete/restore semantics cần Owner decision nếu ảnh hưởng approved visibility |
| Content/topic restore (`removed_at = NULL`) | Cho phép nếu permission/parent hợp lệ | Block | Phải qua same guard; không restore published state thiếu readiness |

D1 phải audit mọi action/RPC trong các hàng trên, không chỉ last-card/last-exercise delete. Content mutation trên published phải có server-side confirmation token/intent; client flag đơn lẻ không đủ để bypass trực tiếp.

Delete/restore của topic không được silently dùng như unpublish. Vì Owner contract mới nói rõ atomic demotion cho content mutation nhưng chưa chốt toàn bộ topic soft-delete/restore semantics, exact handling của published-topic delete/restore là `BLOCKED/Owner decision` nếu implementation cần thay đổi current behavior.

## 8. Unified authoring UX boundary

### 8.1 Create flow

- `TopicManagementSheet` bỏ status selector khỏi create/edit CRUD surface; create chỉ nhận metadata cần thiết và server luôn tạo `draft`.
- CTA chuyển thành dạng `Tạo và tiếp tục` hoặc tương đương, sau success push tới `getTopicBuilderPath(courseId, topicId)`.
- Không để dashboard feedback callback nuốt mất builder navigation. Error phải giữ modal và cho retry; success không cần user tự tìm topic trong structure.
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

## 9. Trusted boundary, DB/RPC/RLS và atomicity

### 9.1 Recommendation

**Recommendation: hybrid, DB-backed lifecycle authority.** Application UX nên dùng shared readiness derivation để hiển thị sớm và Server Actions để map stable result/error; các stateful transition và cross-table invariants phải đi qua DB transaction/RPC hoặc equivalent locked database boundary. RLS phải ngăn direct Data API bypass. Application-only không đủ vì repository đã xác nhận direct `topics` update và callable RPC có thể set/retain invalid status.

### 9.2 Minimal viable DB design cần plan cho implementation

Tên cụ thể có thể thay đổi sau schema review, nhưng boundary tối thiểu phải bao gồm:

1. Additive topic review submission/history storage: topic, submitter, submission lifecycle, submitted/reviewed timestamps, reviewer, rejection reason, rejection count/lock và audit event. Thiết kế phải cho phép future candidate revision attach vào submission/review identity mà không triển khai candidate revision ở D1.
2. Additive course-scoped delegated-review relation hoặc equivalent explicit capability storage, với current membership/role checks và revoke semantics.
3. Trusted transitions tương đương `request_topic_review`, `approve_topic_review`, `reject_topic_review`; mỗi transition lock topic/submission, re-read current state, effective permission, self-review condition, readiness/reason and rejection threshold before commit.
4. A single atomic boundary for published content mutation + demotion to draft. It must cover card, exercise, question/group/option/media and metadata mutation families, or a common transaction primitive that all supported callers use.
5. RLS/policy hardening so authenticated direct updates cannot set lifecycle-owned `status`, mutate pending content, restore invalid published rows, or bypass the reviewer/readiness checks. `service_role` remains an infrastructure bypass; supported application code must not expose it as an end-user mutation route.
6. Trigger, RPC, or equivalent DB guard for child soft-delete/restore and direct writes where RLS cannot express the cross-table invariant safely. The choice between trigger and RPC is an implementation design decision, not current repository fact; row/advisory locking is required wherever readiness is checked against concurrent content mutation.

### 9.3 Required transaction/race guarantees

| Race | Required final guarantee |
| --- | --- |
| Request review vs delete last card/exercise | Either review sees committed ready content and freezes it, or delete commits first and review rejects; never pending with missing required content |
| Approve vs content/status mutation | One state transition wins under lock; approve cannot publish stale/unfrozen content |
| Published edit vs concurrent edit | One atomic demotion/mutation result; no partial content write while status remains published |
| Pending write vs child direct Data API/RPC | Child write rejected; no partial soft-delete/restore or question mutation |
| Approve/reject vs reviewer role removal | Effective permission rechecked under current lock; removed/downgraded actor cannot finish mutation |
| Collaborator change vs pending reviewer safety | Commit only if another valid reviewer remains, or reject change per approved policy |
| Double submit/approve/reject retry | Idempotent/stale-state-safe result; no duplicate submission or second terminal transition |

If a DB-backed solution cannot close a race, the plan must label the exact residual guarantee instead of claiming the invariant is absolute.

## 10. Migration and compatibility boundary

- Existing `item_status` enum may remain `draft|pending|published`; no `authoring` enum is required by this plan unless Owner explicitly decides otherwise.
- Existing published rows may already be invalid under the new readiness rule. D1 must inventory them and define whether to fail migration, quarantine, preserve with an explicit legacy marker, or remediate through an approved operator path. No silent production demotion/backfill is authorized.
- Existing course-level review metadata and mock admin review are not a topic review migration shortcut.
- Existing test fixtures that directly insert published topics remain useful for public-read/content tests, but D1 fixtures must distinguish valid published topics from intentionally invalid/legacy rows and must not hide RLS gaps through service-role-only setup.
- Public learner reads must continue to use the last approved published content. D1 must not introduce a read path where draft/pending authoring content replaces published learner content.
- Future candidate revisions remain architecture direction only: published immutable learner view, separate editable candidate, pending/frozen candidate, reject editable, approve candidate publish + old revision retirement. Exact data model, migration and rollout are not decided and receive no D1 implementation.

## 11. Affected domains and likely files

| Domain | Current owners to inspect/change in implementation | D1 boundary |
| --- | --- | --- |
| Topic actions/schemas | `app/actions/topic.ts`, `lib/schemas/topic.ts`, `lib/course-authoring/routes.ts` | Remove client-owned lifecycle input; expose request/approve/reject and stable result errors |
| Readiness | `lib/course-readiness.ts`, `app/actions/course-readiness.ts` | Shared active-card + active-exercise derivation; topic builder DTO/action precondition |
| Teacher create/structure | `app/(teacher)/teacher/courses/[id]/_components/TopicManagementSheet.tsx`, `CourseStructureWorkspace.tsx` | Metadata-only create, direct builder navigation, state feedback |
| Topic builder | `app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicBuilderTabs.tsx`, `SettingsTab.tsx`, `FlashcardTab.tsx`, `ExerciseTab.tsx` | Shared lifecycle/readiness shell, pending locks, review actions, published warnings |
| Flashcards | `app/actions/card.ts`, `AddFlashcardDialog.tsx`, `BulkAddFlashcardDialog.tsx` | Pending/published mutation behavior and focused UX redesign |
| Exercises and children | `app/actions/exercise.ts`, `AddExerciseDialog.tsx` and media/question/group components | Pending/published guards and atomic mutation boundary; narrow polish |
| Collaborators | `app/actions/course.ts`, `CourseForm.tsx`, `types/database.ts`, collaborator migrations | Minimal delegated review capability/current-role safety; no broad invite redesign |
| Database | `supabase/migrations/20260609114505_remote_schema.sql`, `20260630090000_course_structure_ordering_rpc.sql`, exercise RPC migrations, new additive migration(s) | Readiness/lifecycle/review/history/RLS/locking/triggers/RPC as approved |
| Tests/fixtures | `__tests__/actions`, `__tests__/schemas`, `__tests__/components`, `__tests__/integration`, `e2e/smoke`, `scripts/e2e` | Unit/action/component/real DB/RLS/concurrency/smoke evidence |

The table is an affected-domain map, not permission to edit every listed file. Implementation must touch only the closure required by the accepted contract.

## 12. Test and acceptance strategy

### 12.1 Schema and action tests

- Create schema/action rejects or ignores client `status`; create always supplies draft semantics.
- Update schema/action no longer accepts direct `pending`/`published` CRUD transitions.
- Request review matrix: `0/0`, `1+/0`, `0/1+` reject with no status/submission/content mutation; `1+/1+` enters pending and never published directly.
- Soft-deleted cards/exercises do not satisfy readiness; restored active rows do satisfy it only through an authorized valid transition.
- Approve/reject reject stale state, wrong course, no permission, removed collaborator, delegated capability absent, and self-review.
- Reject requires the existing reason contract or an approved topic-specific equivalent; reason is persisted and visible after return to draft.
- Rejection count/lock enforces at most three rejects/resubmissions for the same lifecycle; post-threshold path is explicit and auditable.

### 12.2 Component/form tests

- Create modal has no status selector, uses metadata-only fields, and successful create navigates to exact `getTopicBuilderPath`.
- Builder displays status/readiness/next action and handles loading, empty, error, pending, rejected and permission-denied states.
- Request-review CTA is disabled with actionable explanation for all three not-ready matrices and enabled only for both-content matrix.
- Pending disables all topic/card/exercise/question/group/media mutation controls and displays frozen explanation.
- Eligible reviewer sees approve/reject; submitter and ineligible collaborator do not; rejection dialog requires reason and preserves error state.
- Published edit shows explicit warning/confirm; cancel leaves state untouched; failed mutation does not silently demote.
- Flashcard fields remain present after redesign; exercise polish does not change authoring semantics.

### 12.3 Real DB/RPC/RLS/integration tests

Use real local Supabase migrations and authenticated clients, not only mocked action clients:

- Direct authenticated Data API attempts to set topic `published`, `pending`, restore invalid published rows, mutate pending content, or soft-delete the last required content are denied or routed through an approved atomic guard.
- Valid request/approve/reject transitions enforce RLS, current effective reviewer role, no-self-review, reason, rejection threshold and audit history.
- Owner/co_owner implicit review and editor/previewer explicit delegation matrix covers grant, revoke, role downgrade, collaborator removal and last-reviewer safety.
- Card and exercise soft-delete/restore paths update/read readiness correctly without leaving an invalid published/pending final state.
- RPC permissions, `search_path`, caller identity and `service_role` separation are verified; fixture setup does not accidentally prove only admin behavior.
- Concurrent integration tests cover the race table in §9.3. If deterministic concurrency is unavailable in the test harness, document the exact unverified race instead of marking it pass.

### 12.4 Browser smoke/manual QA

Critical seeded path, if fixture/config readiness is completed:

1. Teacher creates topic from structure, sees draft builder directly, adds content, sees readiness transition, requests review.
2. Pending author cannot edit content; eligible non-submitter reviewer opens the same topic, sees frozen content, approves or rejects with reason.
3. Rejected topic returns to authoring with reason; valid correction and resubmission work until rejection threshold behavior is shown.
4. Published topic learner read remains approved; teacher published edit warns, cancel is no-op, confirm demotes atomically and content is not silently published.

Required fixture roles: owner, co_owner, editor, previewer, at least one delegated reviewer, submitter distinct from reviewer, and a second valid reviewer for last-reviewer mutation cases. Required content fixtures cover all four readiness states, soft-deleted last content, pending, rejected and valid published states. Current fixtures do not provide this complete D1 matrix; fixture preparation is an implementation dependency, not existing evidence.

## 13. Implementation breakdown and checkpoints

The following are D1 implementation checkpoints, not future revision scheduling:

- **P0 — Contract/schema/fixture foundation:** finalize unresolved Owner decisions, schema/type SSOT, review/history and delegation model, readiness DTO/predicate, deterministic fixture matrix, and migration compatibility policy.
- **P1 — Trusted lifecycle boundary:** implement request/approve/reject transaction/RPC, pending freeze, effective reviewer/no-self-review/rejection rules, RLS/direct-write hardening, and real DB integration/concurrency tests.
- **P2 — Content mutation safety:** route every supported topic/card/exercise/child mutation through pending guard and published confirm + atomic demotion; cover soft-delete/restore and rollback behavior.
- **P3 — Teacher workflow UX:** create→builder navigation, Builder lifecycle/readiness/review shell, frozen/rejected/published states, flashcard redesign and narrow exercise polish.
- **P4 — Closure:** focused/unit/component/integration/browser verification, accessibility/responsive/manual QA, self-review, docs/progress reconciliation and exact-head checkpoint report.

No checkpoint authorizes push, PR, merge, deploy or remote database migration by itself. Migration execution, if accepted later, must follow `supabase-safe-migration`; test changes must follow `test-quality-strategy`; Server Action/schema changes must follow `nextjs-server-action-zod`; UI changes must follow `frontend-workflow` and `frontend-design`.

## 14. Completion acceptance matrix

| Contract | Required observable evidence |
| --- | --- |
| New topic starts draft | Schema/action/DB tests prove client cannot create pending/published; browser create lands in builder |
| Readiness gates request review | Four-case action + derivation + real DB matrix; only `1+/1+` enters pending |
| Request does not publish | State transition and learner-read assertions show pending is not published |
| Pending is immutable | Every listed topic/content mutation denied in action and direct DB/RPC tests; UI locked |
| Approve/reject is trusted | Effective permission, no-self-review, stale state, reason and audit assertions |
| Reviewer safety | Role/delegation/revoke/downgrade/removal and last-reviewer transaction tests |
| Rejection policy | Three-rejection cap, visible audit/reason and explicit locked/escalation behavior |
| Published edit bridge | Confirmed atomic demotion+mutation; cancel/error rollback; no silent demotion |
| Unified authoring UX | Create navigation, builder status/readiness/next action and flashcard/exercise state tests + manual QA |
| DB guarantee | Direct Data API/RPC/RLS and concurrency evidence; residual service-role/infrastructure boundary explicitly reported |
| Future compatibility | No candidate revision implementation; learner remains on approved published view; future direction remains model/timing-agnostic |

## 15. `BLOCKED/Owner decision` items before implementation

These are real decision boundaries, not reasons to guess inside implementation:

1. After the third rejection, who may unlock/reset or create a new submission lifecycle, what state is shown, and whether any escalation actor exists. D1 must not invent transfer/ownership semantics.
2. Whether global `admin` is an eligible topic reviewer. The current Owner contract names course roles/capabilities only; this plan defaults to exclude admin until explicitly expanded.
3. Exact delegated-capability representation and its grant/revoke UI owner. Recommendation is a separate course-scoped relation, but current collaborator persistence/UI is disabled.
4. Whether published-topic soft-delete/restore is allowed unchanged, must demote, or requires a separate explicit workflow; the content-edit demotion rule is clear, topic deletion semantics are not.
5. Treatment of existing invalid `published` topics during migration/backfill: preserve, remediate, quarantine or block migration. No silent demotion is allowed.
6. Whether `authoring` must become a persisted status or remains the Builder phase over `draft`; recommendation is the latter to preserve the current enum.

Until these decisions are resolved, the document is planning-complete but implementation-handoff readiness is **BLOCKED/Owner decision** for the affected decisions. The readiness-only and review-boundary findings remain valid and are not to be weakened to keep D1 small.

## 16. Debt and follow-up outside D1

- Candidate/published revision system remains deferred architecture direction with no phase/workstream/timing/merge order. D1 must avoid hard-coding in-place published edits as a permanent product model.
- Broad collaborator invite, ownership transfer, caps and full role-management UX remain outside D1; only the minimal review-capability closure belongs here.
- Q7 internal previewer authorization, D2 public preview, course publication, memory check, completion truth, exercise correctness and analytics remain outside D1.
- Current service-role fixture/admin direct writes are a continuing DB-guarantee limitation. They may be retained for setup, but supported application behavior must not confuse fixture authority with end-user enforcement.
- Existing mock course review is separate technical debt; do not claim it as topic review evidence or silently turn it into D1 admin workflow.

## 17. Implementation handoff summary

Implement only after the Owner decision list is resolved or explicitly narrowed. The accepted D1 boundary is the smallest one that can make `published` the result of a trusted new-topic authoring→review workflow while closing the confirmed direct-write and concurrency holes. Application-only validation is not an acceptable final guarantee under the current repository architecture; a hybrid DB-backed boundary is recommended, with exact trigger/RPC/locking choice validated during P0.
