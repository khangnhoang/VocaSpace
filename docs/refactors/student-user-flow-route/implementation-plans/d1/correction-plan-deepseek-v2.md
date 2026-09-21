---
title: "D1 Correction Plan v2 (deepseek) — Bỏ review budget/hold/rescue, thêm review_notes"
wave: D1
branch: feat/topic-publish-validation
parent: ./plan.md
supersedes: "./correction-plan.md, ./correction-plan-gemini.md, ./correction-plan-deepseek.md (cả ba đã STALE — xem §13)"
status: "planning-only candidate — chưa được Owner approve để implement"
relationship: "candidate correction delta; KHÔNG tuyên bố thay thế ./plan.md. Việc artifact nào trở thành chuẩn là quyết định của Owner sau khi approve."
related_artifacts:
  - "./plan.md (D1 implementation contract — vẫn là nguồn chuẩn cho tới khi Owner approve merge)"
---

# D1 Correction Plan v2 — Bỏ review budget/hold/rescue, thêm `review_notes` + lịch sử từ chối

> Tài liệu này là **planning-only**: không thay đổi code, migration, test hay commit. Nó thuộc D1, không phải workstream mới.

## 0. Phân loại nguồn (evidence classification)

| Loại | Nội dung trong tài liệu |
| --- | --- |
| **Repository fact** | Đọc trực tiếp từ migration/action/component/test hiện tại, có `file:line`. |
| **Owner decision** | Contract đã chốt trong các lượt trao đổi hiện tại (bỏ budget/hold/rescue/takeover; `review_notes`; quyền theo role; RLS thay vì trusted RPC; sửa thẳng chuỗi D1; chỉ tác giả xóa note; note sửa được). |
| **D1 plan decision** | Contract D1 đã approve trước đó trong `./plan.md` (P2 pending freeze, published demotion, moderation boundary, topic authorship…). |
| **Proposal (engineering gate)** | Tên bảng/cột/trigger/policy/helper, hình dạng DTO — do tài liệu này đề xuất, không phải Owner decision. |
| **Assumption** | Điều chưa chứng minh được bằng repository. |
| **Unresolved decision** | Cần Owner chốt trước khi implement (mục 14). |

---

## 1. Mục tiêu và authority

### 1.1 Kết quả quan sát được sau correction

1. Một topic bị **từ chối** chỉ đơn giản quay về `draft` và **luôn gửi duyệt lại được** qua đúng một đường: `request_topic_review`. Không còn ngưỡng 3 lần từ chối, không còn khóa topic, không còn trạng thái kết thúc 3/3.
2. Không còn khái niệm **escalation**, **rescue**, **takeover**. Không còn bảng `topic_review_escalations`, không còn cột `topic_review_submissions.rescue_escalation_id`, không còn 2 RPC escalation.
3. `get_topic_workflow_state` trả **cùng một canonical state cho mọi caller**: `rejectionCount` và **toàn bộ lịch sử từ chối** tính theo **topic**, không theo người gửi. Chỉ các field **capability** (`canEdit`, `canReview`, `canRequestReview`, `canManageAuthorship`…) mới được phép phụ thuộc caller.
4. Reviewer có một kênh phản hồi mới: **`review_notes`** — ghi chú gắn vào topic, hoặc gắn vào đúng một `card`/`exercise` của topic đó.
5. Ghi chú **chỉ người có quyền review** (`has_topic_review_access`) được viết. Người đọc gồm **reviewer** và **người tham gia topic** (creator, responsible, contributor đang hoạt động), miễn còn là thành viên khoá học.
6. Ghi chú **chỉ tác giả** được sửa nội dung và được xóa mềm. Ghi chú đã xóa **vẫn hiển thị** dạng tombstone: `Ghi chú đã bị xóa bởi <tên reviewer>`. Danh tính tác giả **công khai**, không private.
7. **Lịch sử từ chối duyệt được hiển thị đầy đủ** cho mọi người đọc được workflow state: từng lần một, theo thứ tự thời gian, kèm **lý do**, **người đánh giá** và **thời điểm**. Không còn câu đếm ngân sách kiểu "X/3 lần phản hồi" (§5.5).
8. Thông báo cho owner ("topic X đã được duyệt thành công với n lần từ chối…") **không nằm trong D1 correction** — để lại thành tính năng nhỏ làm sau. Dữ liệu để làm nó (`rejectionCount` theo topic) vẫn được giữ.

### 1.2 Authority

* Chỉ **planning**. Không implementation, không chạy migration, không sửa test, không commit/push/PR.
* Remote migration / production-data mutation vẫn ngoài authority (bao gồm mọi bước reconciliation).
* `./plan.md` vẫn sở hữu D1 implementation contract; tài liệu này sở hữu **correction delta** và phải được merge ngược vào `./plan.md` khi Owner approve (§13).

---

## 2. Root mismatch

**D1 đã dựng một interlock gồm hai thứ mà chỉ cần một thứ là đủ:**

`reject_topic_review` đếm số lần từ chối **theo người gửi** (`submitted_by_user_id`) và khi đạt 3 thì `insert into topic_review_escalations` → tạo **khóa ở cấp topic** (`TOPIC_REVIEW_ESCALATION_HOLD`). Khóa này chặn `request_topic_review`, nên cần một **đường thoát thứ hai**: `resolve_topic_review_escalation(p_action => 'rescue')`.

Chính đường thoát thứ hai đó là nguồn drift:

* Rescue **tự submit** ngay (`insert into topic_review_submissions … status 'pending'`) chứ không đi qua `request_topic_review`.
* Rescue **không hề đặt lại `responsible_author_user_id`**.
* Hệ quả: `creator = A`, `responsible = A`, `submitted_by = B` — một trạng thái mà contract "người phụ trách mới gửi duyệt" không hề cho phép, nhưng lại tồn tại được vì rescue dùng trusted GUC `voca.d1_trusted_topic_lifecycle` để đi vòng qua guard trigger.

Root mismatch là **kiến trúc, không phải bug**: `TOPIC_REVIEW_ESCALATION_HOLD` là **cơ chế chặn duy nhất trong toàn hệ thống** (repository fact — §3.1), và chính nó tạo ra nhu cầu về một đường gửi duyệt thứ hai không bị ràng buộc bởi `responsible_author_user_id`.

Hệ quả kèm theo, cũng từ cùng một gốc: vì "episode" được định nghĩa theo người gửi, `get_topic_workflow_state` phải lọc `rejectionCount` / `latestRejection` theo `submitted_by_user_id = v_user_id` → **canonical state đổi theo caller**.

**Vì vậy correction không phải là "sửa rescue cho đúng", mà là gỡ cả interlock:** bỏ khóa → không cần rescue → không còn đường thứ hai nào đi vòng qua `responsible_author_user_id`. Drift trở thành **bất khả thi về cấu trúc**, không phải được vá.

Nhu cầu thật sự phía sau escalation — "reviewer muốn nói điều gì đó với tác giả" — được đáp bằng `review_notes`, một tính năng **không mang verdict**, nên không tạo khóa và không tạo đường gửi duyệt thứ hai.

---

## 3. Repository fact (đã kiểm chứng)

### 3.1 Khóa và đường vòng

| # | Fact | Evidence |
| --- | --- | --- |
| F1 | `TOPIC_REVIEW_ESCALATION_HOLD` là cơ chế chặn **duy nhất**; không có gate nào khác chặn gửi duyệt ngoài readiness/role/`responsible_author`. | `20260917100000_d1_senior_review_corrections.sql:193-252` (`request_topic_review`) |
| F2 | Rescue nhánh `'rescue'` set `submitted_by_user_id = v_user_id`, insert submission `pending` ngay, **không** đụng `responsible_author_user_id`. | `20260915130000_d1_correction_security_rescue.sql:782-844` |
| F3 | Rescue set trusted GUC trước khi ghi, nên **đi qua được** guard trigger. | `20260915130000_d1_correction_security_rescue.sql:308` |
| F4 | `reject_topic_review` set topic về `draft` và **không** loại trừ reviewer vừa từ chối. | `20260917110000_d1_manual_qa_corrections.sql:16-88` |
| F5 | `reject_topic_review` tái dựng "episode" theo `submitted_by_user_id` rồi mới đếm. | `20260917110000:66-84` |
| F6 | `get_topic_workflow_state` lọc `rejectionCount` / `latestRejection` / `episode_resolved_at` theo `submitted_by_user_id = v_user_id`. | `20260917110000:140-183`, `:247-251` |
| F7 | `rejectionCount` là dữ liệu **dẫn xuất** từ `topic_review_submissions.status = 'rejected'`; không có cột đếm nào. | `20260917110000:176-183` |
| F7b | **`TOPIC_REVIEW_CREATION_HOLD` cũng ghép escalation**: nó chặn `create_topic_ordered` khi người gọi đang có escalation chưa giải quyết trong khoá học. Đọc trực tiếp `topic_review_escalations`, nên khi bảng bị gỡ thì khối này **phải gỡ cùng** — không phải "giữ lại". | `20260915100000_d1_trusted_lifecycle.sql:1276-1284`, `20260916120000_d1_topic_authorship_foundation.sql:243-251` |
| F7c | Literal `TOPIC_REVIEW_CREATION_HOLD` **không chứa** chuỗi `escalation` hay `rescue`, nên lưới quét cũ mù hoàn toàn với nó. Nó sống ở 2 migration + 2 file TS + 1 test. | `20260915100000:1282`, `20260916120000:249`, `app/actions/topic-review.ts:35`, `app/actions/topic.ts:128`, `__tests__/integration/topic-review-lifecycle.test.ts:432` |

### 3.2 Bề mặt cần gỡ (đo được)

**Hai phép đo, cố ý trình bày cả hai — vì độ lệch giữa chúng chính là một defect:**

| Mẫu quét | SQL | TS nguồn | Test |
| --- | --- | --- | --- |
| `escalation\|rescue` (**mù** với `CREATION_HOLD`) | **220 dòng / 9 file** | **53 hit / 5 file** | **122 hit / 6 file** |
| `escalation\|rescue\|CREATION_HOLD` (**đã sửa**) | **222 dòng / 9 file** | **54 hit / 6 file** | **123 hit / 6 file** |
| **Chênh lệch** | +2 | +1 | +1 |

Mọi chênh lệch **đúng bằng** literal bị mù — không có gì khác:

* `+2` SQL = `20260915100000:1282` và `20260916120000:249` (mỗi file +1).
* `+1` TS = `app/actions/topic.ts:128` → **đây là file thứ 6 mà plan bản trước không hề nêu tên.**
* `+1` test = `__tests__/integration/topic-review-lifecycle.test.ts:432`.

Bảng chi tiết theo mẫu **đã sửa**:

| Bề mặt | Số lượng | Chi tiết |
| --- | --- | --- |
| SQL | **222 dòng / 9 file** | `20260915090000` (16), `20260915100000` (28), `20260915120000` (5), `20260915130000` (85), `20260916120000` (2), `20260916130000` (33), `20260916150000` (8), `20260917100000` (28), `20260917110000` (17) |
| Hàm phải **gỡ hẳn** | 2 | `resolve_topic_review_escalation`, `d1_resolve_topic_escalations_for_moderation` |
| Hàm phải **gỡ nhánh** | 7 | `reject_topic_review`, `request_topic_review`, `approve_topic_review`, `get_topic_workflow_state`, `create_topic_ordered` (**gỡ `CREATION_HOLD`**, F7b), `moderate_platform_content`, `get_topic_workflow` (TS — bỏ DTO field, §6.5) |
| Bảng | 1 | `topic_review_escalations` (`20260915090000:105`) |
| Cột + index | 2 | `topic_review_submissions.rescue_escalation_id` + `topic_review_submissions_rescue_escalation_idx` (`20260915130000:15-20`) |
| Ràng buộc | 2 | `topic_review_escalations_resolution_action_check`, `platform_moderation_audits_action_check` (bỏ giá trị `cancel_escalation` — **không** để lại giá trị chết, xem §6.4 ghi chú R2) |
| Literal phải biến mất | **2** | `TOPIC_REVIEW_ESCALATION_HOLD`, `TOPIC_REVIEW_CREATION_HOLD` — cả hai đều ghép escalation (F1, F7b) |
| TS nguồn | **6 file / 54 hit** | `app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicWorkflowPanel.tsx` (25), `app/actions/topic-review.ts` (11), `app/actions/topic.ts` (1), `lib/schemas/topic-review.ts` (7), `lib/schemas/topic-workflow.ts` (5), `types/database.ts` (5) |
| Test | **6 file / 123 hit** | `topic-review-lifecycle.test.ts` (1.191 dòng, 25 `it(`, 83 hit), `topic-workflow-panel.test.tsx` (16), `topic-review.test.ts` (9), `course-structure.test.ts` (5), `topic-authorship-section.test.tsx` (5), `topic-workflow.test.ts` (5) |

### 3.3 Những gì ĐÃ đúng và phải giữ

| # | Fact | Evidence |
| --- | --- | --- |
| F8 | `request_topic_review` đã ép đúng: `draft` + `has_course_authoring_access` + `responsible_author_user_id = v_user_id`. Đây là gate duy nhất cần thiết. | `20260917100000:193-252` |
| F9 | `topic_review_submissions` giữ **toàn bộ lịch sử** từ chối; `rejection_reason` có `check` không rỗng khi `status='rejected'`. | `20260915090000:69-99` |
| F10 | Readiness gate (`>=1` card hoạt động AND `>=1` exercise hoạt động) được kiểm ở cả `request_topic_review` lẫn `approve_topic_review`. | `20260915130000:270-276` |
| F11 | Reviewer independence: `d1_is_topic_reviewer_excluded` + `has_topic_review_access`. | `20260916130000:97-195` |
| F12 | `handle_updated_at()` là helper updated-at dùng chung, 19 usage. Dùng lại, **không** tạo helper mới. | `20260609114505_remote_schema.sql:484` |
| F13 | Convention soft-delete toàn repo: `removed_at` + `removed_by_user_id` (`topic_contributors`, `cards`…). | `20260916120000:39-54` |
| F14 | Pattern policy gọi helper `security definer`: `cards` dùng `can_modify_content_by_topic(topic_id)`. | `20260609114505_remote_schema.sql:1399-1407` |
| F15 | Convention D1 cho bảng nội bộ là **service_role-only** (`revoke all … from authenticated`). | `20260916120000:192-198` |

### 3.4 Schema nền dùng cho `review_notes`

| # | Fact | Evidence |
| --- | --- | --- |
| F16 | `cards(id, topic_id)` — `topic_id` NOT NULL; **không** có `unique (id, topic_id)`. | `20260609114505_remote_schema.sql:704-716` |
| F17 | `exercises(id, topic_id, course_id)` — `topic_id` NOT NULL. | `20260609114505_remote_schema.sql:807-819` |
| F18 | `item_status` = `draft` / `pending` / `published`. | `20260609114505_remote_schema.sql:75-79` |
| F19 | `types/database.ts` là file **viết tay** (có comment tiếng Việt), không generate. | `types/database.ts:1-8` |
| F20 | `d1_topic_group_member` **không** bao gồm creator — chỉ `responsible_author_user_id` hoặc contributor. | `20260916130000:56-92` |
| F21 | `has_topic_review_access` = owner/co_owner OR (editor/previewer AND `can_review_topics`), trừ người bị exclusion. | `20260916130000:165-190` |
| F22 | `platform_moderation_audits.action` là **check constraint**, không phải enum. | `20260915130000:32-38` |
| F23 | Prod có **0 bảng D1** (17 bảng gốc) → toàn bộ D1 chưa từng lên production. | **Owner-supplied — KHÔNG phải Repository fact** (xem ghi chú dưới bảng) |

**Ghi chú về F23 (sửa phân loại):** §0 định nghĩa *Repository fact* = "đọc trực tiếp từ migration/action/component/test hiện tại, có `file:line`". F23 **không** thoả định nghĩa đó — nguồn của nó là xác nhận của Owner kèm git verify độc lập, không phải một dòng trong repo. Đúng lớp là **Owner-supplied / Owner decision**.

Owner xác nhận **2026-09-17**: D1 chưa từng lên bất kỳ môi trường chia sẻ nào. Bằng chứng git verify: `origin/main` có 16 migration với **0 file D1** (mới nhất `20260710182617_public_course_read_model.sql`); không nhánh remote nào trong 73 nhánh khớp `d1`/`topic-publish`; `feat/topic-publish-validation` **không có upstream**; GitHub code search cho `20260915090000_d1_foundation.sql` trả 0.

**Caveat mang theo:** trạng thái git **không** chứng minh được rằng project Supabase *đã link* (`zmnfsorjuibfjowmjtxo`, theo `supabase/.temp/linked-project.json`) chưa từng nhận SQL bằng tay. Nửa đó là kiến thức của Owner, không phải bằng chứng repo. Đây là điều kiện hợp lệ của D8 (§7) — nếu caveat này sai thì D8 mất hiệu lực (§16.2).
---

## 4. Owner decision (đã chốt trong lượt này)

| # | Quyết định | Ghi chú |
| --- | --- | --- |
| D1 | Bỏ **toàn bộ** review budget 3+3, topic lock, rescue, takeover, terminal state 3/3. | Rejection chỉ trả topic về `draft`. |
| D2 | Thêm `review_notes`; **chỉ người có quyền review** được viết. | Không có chat hai chiều — để dành cho group chat sau. |
| D3 | Người đọc note = participant của topic (creator + responsible + contributor đang hoạt động) **và** mọi reviewer. | "2 ưu tiên: ít phức tạp, dễ bảo trì, dễ mở rộng về sau". |
| D4 | Note xóa mềm; tombstone vẫn hiển thị: `Ghi chú đã bị xóa bởi <reviewer>`. Danh tính tác giả **công khai**. | |
| D5 | Quyền theo role là sạch: **mất role = mất quyền**. Contributor bị gỡ thì mất quyền thấy note. | Đây là lý do predicate đọc phải kèm điều kiện còn là thành viên khoá học (§6.3). |
| D6 | Ghi chú qua **RLS trực tiếp**, không qua trusted RPC. | Ưu tiên đơn giản/dễ mở rộng; đánh đổi được ghi ở §6.3 và §14.1. |
| D7 | Thông báo owner **hoãn** sang tính năng nhỏ làm sau. | Không thuộc D1 correction. |
| D8 | **Sửa thẳng chuỗi D1** (amend) để gỡ escalation, không thêm migration gỡ xuôi. | Hợp lệ vì D1 chưa từng lên prod (F23) và Owner đã cho phép sửa unpublished local work. Hệ quả ở §7. |
| D9 | **Chỉ tác giả note** được xóa mềm note của mình. | |
| D10 | Note **sửa được** sau khi tạo. | Giữ `updated_at` + trigger `handle_updated_at`. |
| D11 | `review_notes` **tách thành một migration mới**; lần amend chuỗi D1 chỉ dùng để **gỡ** escalation. | Chốt U1 (cũ): "tách ra". Giữ được dấu vết thời điểm tính năng ra đời; migration mới: `20260917120000_d1_review_notes.sql` (§7, §9 P2). |
| D12 | **Không** thêm cơ chế chống spam gửi duyệt sau khi bỏ khóa. | Chốt U2 (cũ): "tạm thời thì không". Ghi rõ là quyết định **có thời hạn** — nếu sau này cần, đó là tính năng riêng, không phải gate tái dựng. |
| D13 | `rejectionCount` **không ẩn** khỏi bất kỳ ai, **và** expose **toàn bộ lịch sử từ chối** (lý do + người đánh giá + thời điểm), đánh số "Lần N" theo thứ tự thời gian. | Chốt U3 (cũ): "không ẩn: ghi luôn lịch sử lý do bị reject, người reject càng tốt". Chi tiết read model ở §5.5, UI ở §6.6a. |
| D14 | `plan.md` của D1 **giữ nguyên stale có chủ đích**; v2 là contract hiện hành, và `plan.md` chỉ được reconcile **sau khi v2 implement xong**. Trong lúc đó `plan.md` chỉ nhận một marker "stale by decision" ở đầu file — **nội dung contract không bị sửa**. | Chốt của Owner 2026-09-18. Phạm vi durable docs của bước này **chỉ trong D1**: `plan.md` (marker) + 3 draft correction (banner, §13.2). Không đụng `progress.md`, `problems.md` hay `plan.md` cấp program — các mục escalation/rescue ở đó là bản ghi lịch sử có ngày + commit hash. Thứ tự reconcile ở §13.1. |

---

## 5. Target contract

### 5.1 Từ chối duyệt

```txt
update topic_review_submissions → status 'rejected', reviewed_by_user_id, reviewed_at, rejection_reason
update topics                   → status 'draft'   (qua trusted GUC voca.d1_trusted_topic_lifecycle)
```

* **Không** đếm, **không** so ngưỡng, **không** dựng episode, **không** insert escalation.
* Sau từ chối, topic ở `draft`; `responsible_author_user_id` có thể gọi `request_topic_review` **ngay**, không bị chặn.
* Reviewer vừa từ chối **không** bị loại trừ: lần gửi sau họ vẫn thấy và vẫn duyệt được (giữ nguyên F4 — đây là hành vi đúng, không phải bug).
* Lịch sử từ chối còn nguyên trong `topic_review_submissions`.
* `rejection_reason` (≥10, ≤2000 ký tự) vẫn bắt buộc — không đổi.

### 5.2 `request_topic_review`

Giữ nguyên toàn bộ precondition hiện có (F8) **trừ** `TOPIC_REVIEW_ESCALATION_HOLD`:

```txt
AUTH_REQUIRED
COURSE_EDIT_FORBIDDEN        (has_course_authoring_access)
TOPIC_RESPONSIBLE_AUTHOR_REQUIRED
TOPIC_NOT_DRAFT
TOPIC_REVIEW_ALREADY_PENDING
TOPIC_REVIEW_NOT_READY       (>=1 active card AND >=1 active exercise)
TOPIC_REVIEW_NO_ELIGIBLE_REVIEWER  (d1_has_eligible_topic_reviewer)
```

Đây là **đường gửi duyệt duy nhất** sau correction. Không còn đường thứ hai.

### 5.3 `approve_topic_review`

Gỡ **toàn bộ** khối escalation (F2/F3 tương ứng ở nhánh approve) và bước finalize rescue:

* Bỏ `v_escalation public.topic_review_escalations%rowtype`.
* Bỏ `if exists (… topic_review_escalations …)` với `TOPIC_REVIEW_ESCALATION_HOLD` / `TOPIC_REVIEW_RESCUE_FORBIDDEN` / `TOPIC_REVIEW_RESCUE_STALE`.
* Bỏ `update public.topic_review_escalations … resolution_action` ở nhánh thắng.
* Giữ: lock ladder, stale check, self-review check, `has_topic_review_access`, readiness re-check, `first_approved_at` set, `topics.status = 'published'`.

### 5.4 Canonical read model

`get_topic_workflow_state` trở thành **topic-scoped** cho state, **caller-scoped** chỉ cho capability:

| Field | Sau correction |
| --- | --- |
| `rejectionCount` | **Topic-scoped**: `count(*) where topic_id = … and status = 'rejected'` — mọi caller thấy cùng số |
| `rejectionHistory` | **Topic-scoped**: toàn bộ lần từ chối của topic, cũ → mới (§5.5). **Thay thế** bộ `latestRejectionReason` / `latestRejectionReviewer` / `latestRejectionAt` |
| `canRequestReview` | Caller-scoped (đúng): `canEdit AND responsible = caller AND status='draft' AND ready AND hasDistinctEligibleReviewer` — **bỏ** `and not escalation.unresolved` |
| `canEdit`, `canReview`, `canManageAuthorship`, `isCurrentUser*` | Caller-scoped (đúng), không đổi |
| `pendingSubmissionIsRescue` | **Bỏ** |
| `escalationUnresolved`, `escalationId`, `escalationSubmitterId`, `canResolveEscalation` | **Bỏ** |
| `hasDistinctEligibleReviewer` | Giữ |
| `originalCreator`, `responsibleAuthor`, `contributors`, `latestAuthorshipFeedback` | Giữ nguyên |
| Ẩn rejection khi `status='published'` | Giữ nguyên hành vi hiện có: `rejectionHistory` trả `[]` và `rejectionCount` trả `0` |

`rejectionCount` vẫn được expose (canonical) vì đây là dữ liệu cho tính năng thông báo owner đã hoãn (D7). Nó **không** còn là budget và **không** chặn gì.

**Về việc bỏ bộ `latestRejection*` (proposal, engineering gate — không phải Owner decision):** giữ cả `latestRejection*` **và** `rejectionHistory` nghĩa là hai cách biểu diễn cùng một dữ liệu, có thể lệch nhau, và UI sẽ phải chọn một trong hai. `rejectionHistory` là **superset** — phần tử cuối chính là "latest". Nên bỏ bộ ba cũ và để UI đọc `rejectionHistory.at(-1)` khi cần. Nếu Owner muốn giữ để tránh churn ở consumer khác, đây là điểm duy nhất phải đổi lại trong plan.

### 5.5 Lịch sử từ chối duyệt (canonical read model)

Đây là nội dung Owner yêu cầu bổ sung ở D13. Hình dạng dữ liệu:

```ts
rejectionCount: number                       // = rejectionHistory.length, luôn khớp
rejectionHistory: Array<{
  index: number          // 1-based, theo thứ tự thời gian: Lần 1, Lần 2, …
  reason: string         // topic_review_submissions.rejection_reason (không null với status='rejected')
  reviewer: TopicAuthorIdentity | null   // người từ chối; null nếu profile đã bị xoá cứng
  reviewedAt: string     // ISO; = reviewed_at của submission bị từ chối
}>
```

Truy vấn (topic-scoped — đây chính là chỗ sửa F6):

```sql
select coalesce(jsonb_agg(jsonb_build_object(
         'index', r.rn,
         'reason', r.rejection_reason,
         'reviewer', r.reviewer,
         'reviewedAt', r.reviewed_at
       ) order by r.rn), '[]'::jsonb)
into v_rejection_history
from (
  select s.rejection_reason, s.reviewed_at,
         row_number() over (order by s.reviewed_at asc, s.id asc) as rn,
         case when s.reviewed_by_user_id is null then null else (
           select jsonb_build_object(
             'userId', p.id, 'fullName', p.full_name, 'email', p.email, 'avatarUrl', p.avatar_url
           ) from public.profiles p where p.id = s.reviewed_by_user_id
         ) end as reviewer
  from public.topic_review_submissions s
  where s.topic_id = v_topic.id and s.status = 'rejected'
) r;
```

Bất biến:

* **Không lọc theo `submitted_by_user_id`** — đây là toàn bộ nội dung của bản sửa canonical-state.
* **Không lọc theo `v_episode_resolved_at`** — khái niệm "episode" biến mất cùng escalation. Lịch sử là **toàn bộ** topic.
* `rejectionCount` phải bằng `jsonb_array_length(rejectionHistory)`; nên tính count **từ** mảng để hai field không thể lệch.
* `index` do server cấp, không để client tự đánh số — tránh lệch khi có lần từ chối bị ẩn/không đọc được.
* `reviewed_at` của submission `rejected` do `reject_topic_review` set (`now()`), nên không null trên thực tế; truy vấn vẫn `nulls last`-an toàn qua secondary sort `s.id`.

Hình thức hiển thị Owner đã chốt (nguồn cho §6.6a):

```txt
Đã bị từ chối duyệt: 3 lần

Lần 1
"Card X thiếu ví dụ sử dụng."
Người đánh giá: A
14:32 · 17/09/2026

Lần 2
"Exercise 2 có hai đáp án hợp lệ."
Người đánh giá: B
16:08 · 17/09/2026

Lần 3
"Đã sửa phần exercise, còn card 4 chưa đạt."
Người đánh giá: C
19:41 · 17/09/2026
```

Ngữ nghĩa thị giác: **một khối gấp được** khi có ≥3 lần (mặc định chỉ mở lần gần nhất + nút "Xem tất cả N lần"), mỗi lần là một mục có ranh giới rõ, **không** mang màu cảnh báo đỏ cho lần cũ (chúng là lịch sử, không phải lỗi đang hoạt động). Lần gần nhất giữ nguyên trọng lượng như khối hiện tại.

Ba câu copy **phải bị xoá** khỏi codebase vì chúng là ngôn ngữ ngân sách:

* `"Bạn đã nhận {n}/3 lần phản hồi trong lượt gửi hiện tại."` ([TopicWorkflowPanel.tsx:215](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicWorkflowPanel.tsx#L215>))
* `"Lý do cần chỉnh sửa gần nhất"` ([:211](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicWorkflowPanel.tsx#L211>)) — thay bằng tiêu đề lịch sử
* `"Người phản hồi"` / `"Thời điểm phản hồi"` ([:213-214](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicWorkflowPanel.tsx#L213-L214>)) — thay bằng `"Người đánh giá"` + định dạng `HH:mm · dd/MM/yyyy`

### 5.6 `review_notes` — contract

| Khía cạnh | Contract |
| --- | --- |
| Đối tượng | `topic_id` (bắt buộc) + tối đa **một** trong `card_id` / `exercise_id` (có thể không gắn gì → note cấp topic) |
| Ai viết | `has_topic_review_access(topic_id)` — owner/co-owner luôn có; editor/previewer cần `can_review_topics`; người bị exclusion **không** viết được |
| Ai đọc | Reviewer (như trên) **hoặc** participant của topic (creator / responsible / contributor đang hoạt động) — cả hai đều phải **còn là thành viên khoá học** |
| Ai sửa | Chỉ tác giả (`author_user_id = auth.uid()`), chỉ `body` |
| Ai xóa | Chỉ tác giả, **xóa mềm** (`removed_at` + `removed_by_user_id`). Không có hard delete cho `authenticated` |
| Tombstone | Note `removed_at is not null` **vẫn** trả về cho người đọc, kèm danh tính người xóa để render `Ghi chú đã bị xóa bởi <tên>` |
| Bất biến | `topic_id`, `author_user_id`, `card_id`, `exercise_id`, `created_at` **bất biến** sau insert |
| Nội dung | `body` không rỗng sau `btrim`, ≤ 2000 ký tự (khớp `rejection_reason`) |
| Verdict | **Không có.** Note không duyệt, không từ chối, không chặn, không đổi `status` của topic |

Vì note không mang verdict, toàn bộ lớp race của thiết kế cũ (thứ tự note so với verdict, note của reviewer đã bị thay) **biến mất** — không cần `order_index`, không cần ràng buộc thứ tự.

---

## 6. Thiết kế chi tiết

### 6.1 DDL `review_notes`

```sql
create table public.review_notes (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  card_id uuid references public.cards(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete cascade,
  -- Server-owned: default auth.uid() để client không bao giờ gửi field này.
  author_user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  removed_at timestamptz,
  removed_by_user_id uuid references public.profiles(id) on delete set null,
  -- Note gắn tối đa một đối tượng: card HOẶC exercise HOẶC không gắn gì (note cấp topic).
  constraint review_notes_single_target_check check (num_nonnulls(card_id, exercise_id) <= 1),
  constraint review_notes_body_not_blank_check check (nullif(btrim(body), '') is not null),
  constraint review_notes_body_length_check check (length(body) <= 2000)
);

create index if not exists review_notes_topic_created_idx
  on public.review_notes (topic_id, created_at desc, id desc);

create index if not exists review_notes_card_idx
  on public.review_notes (card_id) where card_id is not null;

create index if not exists review_notes_exercise_idx
  on public.review_notes (exercise_id) where exercise_id is not null;

create trigger set_updated_at_review_notes
before update on public.review_notes
for each row execute function public.handle_updated_at();
```

Ghi chú thiết kế (giữ lại trong migration dưới dạng comment tiếng Việt):

* **`card_id` không phải `flashcard_id`** — convention repo là `cardId`/`card_id` (12/4 lần), `flashcardId` không tồn tại. Bảng `user_flashcards` là khái niệm khác (tiến độ học của student), không liên quan.
* **`topic_id NOT NULL`** là quyết định có chủ đích: quyền **luôn** suy trực tiếp từ `topic_id`, không bao giờ suy ngược qua `cards`/`exercises`. Đây chính là chỗ đã sinh ra drift ở thiết kế cũ (quyền suy qua "ai đang giữ trách nhiệm").
* **Trigger dùng lại `handle_updated_at()`** (F12) — không tạo helper updated-at mới.
* Index `(topic_id, created_at desc, id desc)` khớp đúng query đọc note của một topic (mới nhất trước).

### 6.2 Guard trigger — cách B (Owner đã chọn cách B)

Ép invariant "note chỉ trỏ content thuộc đúng `topic_id`" ở tầng DB, **không** dùng composite FK (tránh thêm `unique (id, topic_id)` lên `cards`/`exercises` — 2 b-tree thừa trên 2 bảng nóng nhất repo).

```sql
create or replace function public.d1_guard_review_note_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- UPDATE: các cột định danh bất biến. Chỉ body / updated_at / removed_at được đổi.
  if tg_op = 'UPDATE' and (
    new.topic_id is distinct from old.topic_id
    or new.author_user_id is distinct from old.author_user_id
    or new.card_id is distinct from old.card_id
    or new.exercise_id is distinct from old.exercise_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'REVIEW_NOTE_IDENTITY_IMMUTABLE' using errcode = '42501';
  end if;

  -- Chỉ kiểm tra đích khi INSERT. Cố ý KHÔNG kiểm lại khi UPDATE:
  -- một card/exercise có thể bị xóa mềm sau khi note được viết, và tác giả
  -- vẫn phải sửa được nội dung note của mình.
  if tg_op = 'INSERT' then
    if not exists (
      select 1 from public.topics t
      where t.id = new.topic_id and t.removed_at is null
    ) then
      raise exception 'TOPIC_NOT_FOUND';
    end if;

    if new.card_id is not null and not exists (
      select 1 from public.cards c
      where c.id = new.card_id and c.topic_id = new.topic_id and c.removed_at is null
    ) then
      raise exception 'REVIEW_NOTE_TARGET_TOPIC_MISMATCH';
    end if;

    if new.exercise_id is not null and not exists (
      select 1 from public.exercises e
      where e.id = new.exercise_id and e.topic_id = new.topic_id and e.removed_at is null
    ) then
      raise exception 'REVIEW_NOTE_TARGET_TOPIC_MISMATCH';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists d1_guard_review_note_mutation on public.review_notes;
create trigger d1_guard_review_note_mutation
before insert or update on public.review_notes
for each row execute function public.d1_guard_review_note_mutation();

revoke all on function public.d1_guard_review_note_mutation() from public, anon, authenticated;
```

**Hai điểm cố ý, không được "đơn giản hóa" khi implement:**

1. Kiểm tra đích **chỉ ở INSERT**. Nếu kiểm ở cả UPDATE, việc sửa `body` của một note trỏ vào card đã bị xóa mềm sẽ **luôn thất bại** — đó là bug, không phải siết chặt.
2. `security definer` + `search_path = public` theo đúng convention guard trigger hiện có (`d1_guard_topic_contributor_mutation`, F13).

Trigger này ép được cả khi ghi bằng `service_role` — đúng bài học từ drift: **ép invariant bằng DB, không bằng code application.**

### 6.3 Helper + RLS

**Helper mới — có justification (bắt buộc theo `supabase-safe-migration` "Permission helper rules"):**

Hai helper sẵn có đều **không** diễn đạt được biên này, đã chứng minh bằng repository fact:

* `has_topic_review_access` (F21): **loại trừ** creator/responsible/contributor → creator không thấy được note của topic mình.
* `d1_topic_group_member` (F20): **không** bao gồm creator, chỉ nhận role `owner`/`co_owner`/`editor` (trượt `previewer` có `can_review_topics`), và **bỏ qua** reviewer không thuộc nhóm tác giả.

```sql
create or replace function public.d1_can_read_topic_review_notes(p_topic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    -- Nhánh reviewer: đã gồm owner/co-owner và editor/previewer có can_review_topics.
    public.has_topic_review_access(p_topic_id)
    -- Nhánh participant: creator / responsible / contributor đang hoạt động,
    -- nhưng BẮT BUỘC còn là thành viên khoá học (Owner decision D5: mất role = mất quyền).
    or exists (
      select 1
      from public.topics t
      join public.chapters ch on ch.id = t.chapter_id
      join public.courses c on c.id = t.course_id
      join public.course_collaborators cc
        on cc.course_id = t.course_id and cc.user_id = auth.uid()
      join public.profiles p on p.id = auth.uid()
      where t.id = p_topic_id
        and t.removed_at is null
        and ch.removed_at is null
        and ch.course_id = t.course_id
        and c.removed_at is null
        and p.removed_at is null
        and cc.role in (
          'owner'::public.course_member_role,
          'co_owner'::public.course_member_role,
          'editor'::public.course_member_role,
          'previewer'::public.course_member_role
        )
        and (
          t.original_creator_user_id = auth.uid()
          or t.responsible_author_user_id = auth.uid()
          or exists (
            select 1 from public.topic_contributors tc
            where tc.topic_id = t.id and tc.user_id = auth.uid() and tc.removed_at is null
          )
        )
    )
  )
$$;

revoke all on function public.d1_can_read_topic_review_notes(uuid) from public, anon;
grant execute on function public.d1_can_read_topic_review_notes(uuid) to authenticated, service_role;
```

Điều kiện "còn là thành viên khoá học" ở nhánh participant là **compensating control** cho một gap đã phát hiện: `remove_course_collaborator` / `leave_course_collaboration` **không** dọn `topic_contributors` (chúng chỉ chuyển `responsible_author`). Xem §14.2.

**RLS:**

```sql
alter table public.review_notes enable row level security;

-- Đây là bảng D1 DUY NHẤT cấp quyền cho `authenticated` thay vì service_role-only (F15).
-- Owner decision D6 chọn RLS trực tiếp để ít phức tạp và dễ mở rộng.
-- Bù lại: guard trigger ép đích + bất biến, và WITH CHECK ép quyền sở hữu.
revoke all on table public.review_notes from public, anon;
grant select, insert, update on table public.review_notes to authenticated;
grant all on table public.review_notes to service_role;
-- Không grant DELETE: hard delete là bất khả thi với `authenticated`.

create policy "Review notes - Reader select" on public.review_notes
for select to authenticated
using (public.d1_can_read_topic_review_notes(topic_id));

create policy "Review notes - Reviewer insert" on public.review_notes
for insert to authenticated
with check (
  author_user_id = auth.uid()
  and public.has_topic_review_access(topic_id)
  and removed_at is null
  and removed_by_user_id is null
);

create policy "Review notes - Author update" on public.review_notes
for update to authenticated
using (author_user_id = auth.uid())
with check (
  author_user_id = auth.uid()
  and public.has_topic_review_access(topic_id)
  and (
    (removed_at is null and removed_by_user_id is null)
    or (removed_at is not null and removed_by_user_id = auth.uid())
  )
);
```

Policy `select` **cố ý không** lọc `removed_at`: tombstone phải hiển thị được (D4).

Hệ quả cần biết: reviewer mất quyền review (bị gỡ khỏi khoá học / bị exclusion) thì **không sửa và không xóa mềm** được note cũ của mình nữa — nhất quán với D5 "mất role = mất quyền", nhưng là hành vi cần Owner biết (§14.3).

### 6.4 RPC boundaries sau correction

| RPC | Hành động |
| --- | --- |
| `request_topic_review` | Gỡ `TOPIC_REVIEW_ESCALATION_HOLD`. Giữ toàn bộ precondition còn lại (§5.2). |
| `approve_topic_review` | Gỡ toàn bộ khối escalation + finalize rescue (§5.3). |
| `reject_topic_review` | Gỡ episode reconstruction, `v_rejection_count`, insert escalation. Trả `jsonb` gọn: `{status, course_id, topic_id, submission_id}` — **bỏ** `rejection_count` và `escalated` khỏi return shape. |
| `get_topic_workflow_state` | Gỡ 4 field escalation; `rejectionCount` / `rejectionHistory` chuyển sang topic-scoped, bỏ bộ `latestRejection*` (§5.4, §5.5). |
| `create_topic_ordered` | Gỡ kiểm tra `topic_review_escalations` → literal `TOPIC_REVIEW_CREATION_HOLD` biến mất (F7b). |
| `moderate_platform_content` | Gỡ 4 lời gọi `d1_resolve_topic_escalations_for_moderation` (nhánh topic, chapter, và 2 nhánh course); gỡ `cancel_escalation` khỏi check constraint **và** khỏi guard `p_action not in (...)` (`20260915130000:415`). |
| `resolve_topic_review_escalation` | **Gỡ hẳn** (drop function). |
| `d1_resolve_topic_escalations_for_moderation` | **Gỡ hẳn** (drop function). |
| `d1_has_eligible_topic_reviewer`, `d1_has_distinct_topic_reviewer`, `d1_is_topic_reviewer_excluded`, `has_topic_review_access`, `d1_topic_group_member`, `can_modify_content_by_topic` | **Không đổi.** |

Không thêm RPC nào cho `review_notes` (D6).

**Ghi chú R2 — đã kiểm chứng và BÁC BỎ, kèm một quan sát thật:**

Một reviewer nghi rằng sau khi bỏ `cancel_escalation`, check constraint còn nhận "một giá trị không code nào sinh ra". **Đã đo và bác bỏ.** DDL cuối cùng là `20260915130000:36` với 4 giá trị; bỏ `cancel_escalation` còn `{demote, takedown, invalidate_review}` — **cả ba** đều qua được guard `p_action not in (...)` và đều tới được `insert into platform_moderation_audits` (`:493-497`). Không có giá trị chết. Miền constraint **bằng** miền giá trị sinh ra.

Quan sát thật nằm ở chỗ khác, và **không phải** defect cần sửa: `invalidate_review` **không có hiệu ứng trạng thái riêng**. Trên topic `pending`, nhánh `invalidate_review` (`:433`) chỉ là **precondition chặt hơn**; thân cập nhật (`:446-448`) dùng chung cho cả `demote`:

```sql
update public.topics
set status = 'draft', removed_at = case when p_action = 'takedown' then now() else null end
```

nên `demote` và `invalidate_review` trên cùng một topic `pending` cho **cùng** kết quả trạng thái. Khác biệt duy nhất: nhãn `action` trong audit và precondition. Đây là **chủ ý và có test bảo vệ** (`supports distinct admin demotion and pending invalidation audit`, `topic-review-lifecycle.test.ts:734`). Vì vậy: **giữ nguyên, ngoài scope** — đổi nó là đổi ngữ nghĩa moderation, không thuộc correction này.

### 6.5 Server Actions / Zod / DTO

**Module schema mới: `lib/schemas/review-notes.ts`** (không nhồi vào `topic-review.ts`).

Lý do tách: note sẽ phát triển tiếp (group chat sau này), và `topic-review.ts` đang sở hữu contract của **vòng duyệt** — note không mang verdict nên không thuộc cùng một boundary.

```ts
import { z } from "zod";

const topicIdSchema = z.uuid("ID bài học không hợp lệ.");
const noteIdSchema = z.uuid("ID ghi chú không hợp lệ.");

// Khớp `review_notes_body_length_check` và độ dài `rejection_reason` hiện có.
export const reviewNoteBodySchema = z
  .string()
  .trim()
  .min(1, "Nội dung ghi chú không được để trống.")
  .max(2000, "Ghi chú không được vượt quá 2000 ký tự.");

// Cố ý KHÔNG có `authorUserId`: đây là field server-owned, lấy từ auth.uid()
// (cột có default auth.uid() và policy WITH CHECK ép lại).
export const createReviewNoteSchema = z
  .strictObject({
    topicId: topicIdSchema,
    cardId: z.uuid().nullable().optional(),
    exerciseId: z.uuid().nullable().optional(),
    body: reviewNoteBodySchema,
  })
  .refine((v) => !(v.cardId && v.exerciseId), {
    message: "Ghi chú chỉ được gắn vào một flashcard hoặc một bài tập.",
  });

export const updateReviewNoteSchema = z.strictObject({
  noteId: noteIdSchema,
  body: reviewNoteBodySchema,
});

export const removeReviewNoteSchema = z.strictObject({ noteId: noteIdSchema });

export type CreateReviewNoteInput = z.infer<typeof createReviewNoteSchema>;
export type UpdateReviewNoteInput = z.infer<typeof updateReviewNoteSchema>;
export type RemoveReviewNoteInput = z.infer<typeof removeReviewNoteSchema>;
```

**Action mới: `app/actions/review-notes.ts`.**

**Bốn** action, mỗi action theo đúng thứ tự boundary của `server-actions-and-route-handlers`: parse → `requireUser()` → gọi Supabase bằng **parsed data** → `revalidatePath` → trả shape `{success}` / `{error}` ổn định.

| Action | Loại | Ghi chú |
| --- | --- | --- |
| `getTopicReviewNotes` | **đọc** | Bắt buộc — xem "Đường đọc" ngay dưới |
| `createReviewNote` | ghi | |
| `updateReviewNote` | ghi | |
| `removeReviewNote` | ghi | xoá mềm |

Điểm quan trọng phải phản ánh trung thực trong plan: **action này không tự kiểm tra authorization**; authorization do **RLS** ép (D6). Action chỉ parse + lấy session + revalidate. Vì vậy test phân quyền phải chạy ở **tầng integration** (RLS thật), không phải chỉ ở tầng action. Điều này áp cho cả action **đọc**: `getTopicReviewNotes` không tự lọc theo quyền — nó trả về đúng những gì policy `select` cho phép.

#### Đường đọc `review_notes` (quyết định thiết kế — proposal của engineering gate)

**Vấn đề:** bản plan trước định nghĩa **chỉ 3 action ghi**. Nhưng §9 P4 (b)/(c) đòi UI "thấy ghi chú hiện ra", và §11.2 đòi component test có `loading`/`empty`/`error`. Không có đường đọc nào thì A4–A9 và A11 không thể cùng đúng. Repository **không có thư viện fetch dữ liệu** (không `react-query`/`swr`/`tRPC` trong `package.json`), nên đường đọc phải đi qua server action hoặc server component.

**Đã chọn: một action đọc riêng `getTopicReviewNotes`, gọi trong server component `page.tsx`, truyền xuống `TopicWorkflowPanel` dưới dạng prop.**

Ba lý do, theo thứ tự sức nặng:

1. **Payload note cần dữ liệu mà workflow RPC không có.** UI phải render nhãn đích `"Flashcard: <từ>"` / `"Bài tập: <tiêu đề>"`, tức cần `cards.title`/`exercises.title`. `get_topic_workflow_state` không trả các title đó và **không nên** trả — nó là DTO của vòng đời topic.
2. **Không ghép DTO vòng đời với payload phản hồi.** `topicWorkflowSchema` là `strictObject` 35 key, là canonical state của D1. Nhồi mảng ghi chú vào đó khiến mọi thay đổi tương lai của tính năng ghi chú (D2 nói nó sẽ phát triển thành group chat) đều phải sửa RPC vòng đời — đúng kiểu ghép nối đã sinh ra drift escalation.
3. **Cơ chế refresh sẵn có đã khớp.** `TopicWorkflowPanel` nhận `onRefresh: () => router.refresh()` ([TopicBuilderTabs.tsx:270](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicBuilderTabs.tsx#L270>)), tức re-chạy server component → đọc lại cả workflow **lẫn** note. Không cần state client, không cần mutate cache.

**Phương án bị loại:** mở rộng payload `getTopicWorkflow` trong `app/actions/topic.ts`. Loại vì lý do 1 và 2 — nhưng ghi lại vì đây là lựa chọn thay thế hợp lệ nếu Owner muốn một round trip duy nhất.

**Hệ quả bắt buộc lên scope** (đã đồng bộ ở §9, §11.1, §12 A11):

* `app/(teacher)/teacher/courses/[id]/topics/[topicId]/page.tsx` — thêm lời gọi `getTopicReviewNotes` cạnh `getTopicWorkflow` ([page.tsx:2](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/page.tsx#L2>), [:24](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/page.tsx#L24>)) và truyền prop xuống.
* `__tests__/components/course-workspace-routes.test.tsx` — là **guard test trên chính `page.tsx`**: nó assert `expect(topicBuilderPageSource).toContain("getTopicWorkflow")` ([:1416](__tests__/components/course-workspace-routes.test.tsx#L1416)). Sửa `page.tsx` mà không cập nhật file này thì guard có thể vỡ. **Phải nằm trong §11.1.**
* `TopicWorkflowPanel.tsx` nhận thêm prop danh sách note (§6.6).

**`mapTopicReviewError` và `mapTopicOrderingRpcError` — gỡ cả hai literal (giải quyết câu hỏi treo ở bản trước):**

Bản plan trước viết *"giữ `TOPIC_REVIEW_ESCALATION_HOLD` **chỉ nếu** còn dùng cho `TOPIC_REVIEW_CREATION_HOLD`"* — câu đó **sai và tự mâu thuẫn**, vì hai literal là hai chuỗi khác nhau, không cái nào thay thế cái nào. Sự thật (F7b): `CREATION_HOLD` **cũng** đọc `topic_review_escalations`, nên khi bảng bị gỡ thì **cả hai** literal biến mất. Kết luận dứt khoát:

| File | Hành động |
| --- | --- |
| `app/actions/topic-review.ts:35` | Gỡ cả nhánh `ESCALATION_HOLD` **lẫn** `CREATION_HOLD` khỏi `mapTopicReviewError` |
| `app/actions/topic.ts:128` | Gỡ nhánh `CREATION_HOLD` khỏi `mapTopicOrderingRpcError` |

Thêm vào cả hai: `REVIEW_NOTE_IDENTITY_IMMUTABLE`, `REVIEW_NOTE_TARGET_TOPIC_MISMATCH` (chỉ `review-notes.ts`, nhưng nêu ở đây để hai mapper không lệch nhau).

**DTO đọc note** — thêm vào `lib/schemas/review-notes.ts`:

```ts
export const reviewNoteSchema = z.strictObject({
  id: z.uuid(),
  topicId: z.uuid(),
  cardId: z.uuid().nullable(),
  exerciseId: z.uuid().nullable(),
  author: topicAuthorIdentitySchema,   // tái dùng từ topic-workflow.ts
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  isEdited: z.boolean(),
  removedAt: z.string().nullable(),
  removedBy: topicAuthorIdentitySchema.nullable(),
});
```

`topicAuthorIdentitySchema` hiện là private trong `lib/schemas/topic-workflow.ts` → phải **export** nó (hoặc chuyển sang module dùng chung) để tránh định nghĩa trùng. Chọn: export từ `topic-workflow.ts` và import — ít thay đổi nhất, giữ một semantic owner. Note: đây là thay đổi **bắt buộc**, không phải refactor tùy ý.

**`lib/schemas/topic-workflow.ts`:**

* Bỏ `pendingSubmissionIsRescue`, `escalationUnresolved`, `escalationId`, `escalationSubmitterId`, `canResolveEscalation`.
* Bỏ `latestRejectionReason`, `latestRejectionReviewer`, `latestRejectionAt` (đã gộp vào `rejectionHistory`, §5.5).
* Thêm `rejectionHistory` + export `topicAuthorIdentitySchema` (đang private — §6.5 trên) và một schema cho phần tử lịch sử:

```ts
// Xuất ra để review-notes.ts tái dùng, tránh định nghĩa trùng DTO.
export const topicAuthorIdentitySchema = z.strictObject({ /* …như cũ… */ });

// Một lần từ chối. `index` do server cấp (1-based, cũ → mới) để UI render "Lần N"
// mà không phải tự đếm — tránh lệch nếu sau này có lần từ chối bị ẩn.
export const topicRejectionEntrySchema = z.strictObject({
  index: z.number().int().positive(),
  reason: z.string().min(1),
  reviewer: topicAuthorIdentitySchema.nullable(),
  reviewedAt: z.string(),
});
export type TopicRejectionEntry = z.infer<typeof topicRejectionEntrySchema>;
```

Trong `topicWorkflowSchema`: giữ `rejectionCount: z.number().int().nonnegative()`, giữ `hasDistinctEligibleReviewer`, thêm `rejectionHistory: z.array(topicRejectionEntrySchema)`. Vì `strictObject`, việc bỏ 3 key `latestRejection*` sẽ **fail ngay** ở mọi consumer còn đọc chúng — đó là lợi ích, không phải phiền: `npx tsc --noEmit` liệt kê đúng chỗ cần sửa.

`reason` là `z.string().min(1)` chứ không `.nullable()` vì `topic_review_submissions` có check constraint buộc `rejection_reason` không rỗng khi `status='rejected'` (F9). `reviewer` vẫn nullable vì profile có thể bị xoá cứng.

**`types/database.ts`:** bỏ `TopicReviewEscalation`; bỏ `rescue_escalation_id` khỏi `TopicReviewSubmission`; bỏ `'cancel_escalation'` khỏi `PlatformModerationAction`; thêm `ReviewNote`. File viết tay (F19) nên đây là sửa tay.

### 6.6 Frontend

Screen type: **Teacher Authoring** (`frontend-design`) — design latitude thấp–trung bình; signature nằm ở **ngôn ngữ trạng thái/phản hồi**, không ở trang trí.

**a) Dọn `TopicWorkflowPanel.tsx`** (290 dòng; **23** dòng chứa `escalation` — đo không phân biệt hoa thường — và **25** dòng cho `escalation|rescue`, §3.2). Nhận thêm prop danh sách note từ `page.tsx` và render `TopicReviewNotes`.

* Bỏ `resolveTopicReviewEscalation` khỏi import; bỏ `handleResolveEscalation` ([:114-132](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicWorkflowPanel.tsx#L114-L132>)).
* Bỏ state `isEscalationOpen`, `escalationAction`, `rescuePending` ([:58-59](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicWorkflowPanel.tsx#L58-L59>), [:65](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicWorkflowPanel.tsx#L65>)).
* Bỏ `Dialog` xử lý escalation ([:262-286](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicWorkflowPanel.tsx#L262-L286>)) và 3 nút `Gửi nhờ người duyệt khác` / `Kết thúc xử lý và về bản nháp` / `Ẩn bài học` ([:219-230](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicWorkflowPanel.tsx#L219-L230>)).
* Bỏ nhánh `workflow.escalationUnresolved` khỏi hàm mô tả trạng thái ([:50](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicWorkflowPanel.tsx#L50>)) và nhánh `pendingSubmissionIsRescue` ([:33](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicWorkflowPanel.tsx#L33>)).
* **Thay khối "Lý do cần chỉnh sửa gần nhất" bằng khối lịch sử từ chối** ([:209-217](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicWorkflowPanel.tsx#L209-L217>)) theo §5.5 — đây là thay đổi **nội dung**, không chỉ xoá.
* Bỏ biến `rejectionReviewerLabel` ([:66-68](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicWorkflowPanel.tsx#L66-L68>)) — logic lấy tên chuyển vào khối lịch sử.
* Giữ nguyên toàn bộ phần không liên quan (readiness, gửi duyệt, duyệt/từ chối, authorship).

Bố cục khối lịch sử (thay chỗ khối cũ):

```txt
Desktop / Mobile (một cột)
- Tiêu đề: "Đã bị từ chối duyệt: N lần"          (N = rejectionHistory.length)
- Mục gần nhất (Lần N) — luôn mở, giữ trọng lượng như khối hiện tại
    Lần N
    "<reason>"
    Người đánh giá: <tên hoặc email>
    14:32 · 17/09/2026
- Các mục cũ (Lần 1 … N-1) — gấp sau nút "Xem tất cả N lần" khi N >= 3
    mỗi mục cùng cấu trúc, KHÔNG dùng màu cảnh báo đỏ (đây là lịch sử)
```

Trạng thái phải xử lý: `empty` (không có lần nào → không render khối), `published` (`rejectionHistory` rỗng → không render), `collapsed`/`expanded`, `long data` (reason tới 2000 ký tự phải wrap), `reviewer = null` (profile đã xoá → hiện `"Người đánh giá: không còn trong hệ thống"` thay vì khoảng trắng).

Định dạng thời gian theo đúng mẫu Owner đã chốt: `HH:mm · dd/MM/yyyy`. Dùng `Intl.DateTimeFormat("vi-VN")` hiện có trong file cho phần ngày; phần `HH:mm` phải là 24 giờ (`hour12: false`) — **không** dùng mặc định locale vì có thể ra `2:32 CH`, lệch với mẫu.

Copy tiếng Việt, không filler: tiêu đề `Đã bị từ chối duyệt: N lần`, nhãn `Người đánh giá`, nút `Xem tất cả N lần`.

**b) Component mới `TopicReviewNotes.tsx`** cùng thư mục `_components/`, render trong `TopicWorkflowPanel`.

Bố cục:

```txt
Desktop / Mobile (một cột, xếp dọc)
- Tiêu đề mục + số ghi chú đang hiển thị
- Composer (chỉ hiện khi canReview) — textarea + nút "Gửi ghi chú", disabled khi pending
- Danh sách note, mới nhất trước:
  - avatar + tên tác giả + thời gian tương đối (+ nhãn "đã chỉnh sửa" khi updatedAt > createdAt)
  - nhãn đích khi có: "Flashcard: <từ>" hoặc "Bài tập: <tiêu đề>"
  - body
  - nút "Sửa" / "Xóa" — chỉ hiện với note của chính mình
- Hàng tombstone: "Ghi chú đã bị xóa bởi <tên>" (không có body)
```

Trạng thái phải xử lý: `loading`, `empty` ("Chưa có ghi chú nào cho bài học này."), `error`, `pending` (submit), `disabled`, `permission` (không phải reader → không render mục này; là reader nhưng không phải reviewer → ẩn composer, hiện ghi chú ở chế độ chỉ đọc), `long data` (body 2000 ký tự phải wrap, không tràn), `stale`.

Không double-submit; giữ nội dung đã gõ khi submit lỗi; xóa mềm có xác nhận nêu rõ **đối tượng + hành động + hậu quả + khả năng hoàn tác** ("Ghi chú sẽ được đánh dấu đã xóa và vẫn hiển thị với người xem. Không thể hoàn tác.").

Copy tiếng Việt, câu chủ động, không filler: nút `Gửi ghi chú`, empty state chỉ ra việc làm tiếp theo.

**c) Không đụng** `components/ui/*`, không đổi toast toàn cục, không thêm package/icon/animation library.

---

## 7. Hệ quả của D8 (sửa thẳng chuỗi D1)

Đây là **deviation có chủ đích** khỏi default "create a new migration" của `supabase-safe-migration`. Điều kiện hợp lệ: D1 chưa từng lên prod (F23) và Owner đã cho phép (D8).

**Cách làm:** sửa nội dung 9 file migration trong phạm vi `20260915090000` … `20260917110000` để gỡ hẳn escalation, rồi `db reset` dựng lại state sạch. Không rewrite git history, không force-push — các file đã được commit nên việc sửa là **một commit mới** thay đổi chúng.

**Phần additive tách riêng (D11):** `review_notes` **không** nằm trong lần amend này. Nó là một migration mới `20260917120000_d1_review_notes.sql` — timestamp nối tiếp file cuối của chuỗi hiện tại. Nhờ vậy lần amend chỉ mang nghĩa "gỡ", đúng phạm vi đã được Owner cho phép, và thời điểm tính năng ghi chú ra đời vẫn truy được.

**Ràng buộc bắt buộc:** `topic_review_escalations` phải **không được tạo ra nữa** ở `20260915090000`. Do đó **mọi** hàm tham chiếu nó phải được dọn trong **cùng một lần amendment**, nếu không `db reset` sẽ fail ngay tại `create function`. Thứ tự file là ràng buộc cứng.

**Hệ quả phải chấp nhận:**

1. Local DB phải `db reset` → mất dữ liệu QA local hiện có.
2. Bất kỳ Supabase workdir nào đã apply bản D1 cũ (bao gồm E2E workdir nếu tách riêng) đều **stale** và phải reset/migrations lại. Nếu smoke E2E báo thiếu function sau khi sửa migration, kiểm tra cả root DB và E2E workdir theo `supabase-safe-migration`.
3. Reviewer/manual-QA evidence cũ (các commit `e631aca`, `ed3f925`, `4aa80fb`, `6779f93`, `03d4adb`) trỏ vào hành vi escalation nay không còn đúng → phải được ghi nhận là **superseded** bởi correction này (§13), không phải bị lặng lẽ bỏ qua.
4. Migration file sau amendment **không còn mô tả trung thực** quá trình phát triển D1 ban đầu. Chấp nhận: chúng mô tả **contract cuối cùng**, và lịch sử nằm ở git.

---

## 8. Dependency graph

```txt
[P1] SQL: gỡ escalation khỏi chuỗi D1 (9 file) + canonical read model
        │  (phải xong trước mọi thứ: nếu bảng còn được tạo, db reset không dựng được)
        ▼
[P2] SQL: review_notes (DDL + guard trigger + helper + RLS)
        │  (độc lập với P1 về mặt object, nhưng cùng migration chain → tuần tự)
        ▼
[P3] TS contract: types/database.ts → schemas → actions
        │  (types trước schemas: DTO dựa trên DB shape)
        ▼
[P4] Frontend: dọn TopicWorkflowPanel + TopicReviewNotes
        │
        ▼
[P5] Verification: db reset + integration + component/action/schema + lint + tsc + manual QA
```

**Quan hệ hard/soft:**

| Prerequisite | Dependent | Loại | Lý do |
| --- | --- | --- | --- |
| P1 (bảng escalation không còn được tạo) | P3, P4 | **Hard** | `types/database.ts` không thể bỏ `TopicReviewEscalation` khi SQL còn tạo bảng đó — nếu không sẽ lệch DB/type. |
| P2 (DDL + policy) | P3, P4 | **Hard** | Client chỉ query được `review_notes` sau khi bảng + policy tồn tại. |
| P3 (`topicAuthorIdentitySchema` được export) | P4 | **Hard** | Component notes cần DTO type. |
| P1/P2 cùng chain | — | Tuần tự | Cùng một migration chain; P2 đặt trong file migration **mới** hay cùng amendment là quyết định ở §14.4. |
| P4 | P5 manual QA | Soft | Manual QA cần UI ổn định. |

**Song song hóa:** P1 và P2 **không** nên làm song song — cùng migration chain, cùng phải `db reset`, và P2 cần biết P1 đã dọn xong để tránh `create function` hỏng. P4 phụ thuộc P3. **Toàn bộ là tuần tự.**

---

## 9. Phases

Một PR duy nhất (correction trong cùng workstream D1). Mỗi phase là một đơn vị mạch lạc, tự verify được.

### Phase 1 — Gỡ escalation/rescue khỏi chuỗi D1

| | |
| --- | --- |
| **Goal** | Chuỗi D1 không còn tạo `topic_review_escalations`, không còn 2 RPC escalation, 6 hàm còn lại sạch nhánh escalation; `rejectionCount` + `rejectionHistory` trở thành topic-scoped. |
| **Depends on** | — |
| **Scope** | 9 file migration: `20260915090000`, `20260915100000`, `20260915120000`, `20260915130000`, `20260916120000`, `20260916130000`, `20260916150000`, `20260917100000`, `20260917110000` |
| **Out of scope** | Mọi thay đổi hành vi **không** liên quan escalation (readiness, published demotion, authorship, collaborator, moderation `demote`/`takedown`/`invalidate_review`) |
| **Acceptance** | (a) `npx supabase db reset` thành công. (b) **Lưới quét literal — cả SQL lẫn TS, cả hai literal** (§10): `grep -rn "TOPIC_REVIEW_ESCALATION_HOLD\|TOPIC_REVIEW_CREATION_HOLD" supabase/migrations/ app/ lib/ types/` → 0 hit. (c) Từ chối lần 3 **không** chặn gửi duyệt lần 4. (d) `rejectionCount` và `rejectionHistory` giống nhau với mọi caller trên cùng topic. (e) Người đang có escalation cũ **tạo được** topic mới (chốt F7b đã gỡ). |
| **Verification** | `npx supabase db reset`; `npm.cmd run test:integration -- __tests__/integration/topic-review-lifecycle.test.ts`; lưới quét ở §10 |
| **Rủi ro** | Bỏ sót một tham chiếu → `db reset` fail. Bắt được ngay ở bước reset, không thể lọt. |

### Phase 2 — `review_notes`

| | |
| --- | --- |
| **Goal** | Bảng `review_notes` + guard trigger + helper đọc + 3 policy + grant tồn tại và ép đúng biên. |
| **Depends on** | P1 |
| **Scope** | **Một migration mới**: `supabase/migrations/20260917120000_d1_review_notes.sql` (D11). **`supabase/seed.sql` — task cụ thể, không còn là điều kiện**: thêm 5 mục ở §11.3.2 (editor không-review, previewer có-review, một `topic_contributors`, một topic `draft` trong khoá `44444444-…`). Không có chúng thì P4 (b)–(f) và A3b/A7/A8/A9 không chạy được |
| **Out of scope** | Không RPC mới; không đụng bảng nào khác; **không** sửa seed ngoài 5 mục §11.3.2 (đặc biệt: không đụng topic/khoá `b2000…`); **không** chạm lại 9 file của P1 |
| **Acceptance** | (a) Reviewer viết được note; người không có quyền review bị từ chối. (b) Note trỏ card của **topic khác** bị `REVIEW_NOTE_TARGET_TOPIC_MISMATCH`. (c) Sửa/xóa note của người khác bị từ chối. (d) Xóa cứng bị từ chối. (e) Tombstone vẫn `select` được. (f) Creator/responsible/contributor đọc được; người ngoài thì không. (g) **`db reset` rồi đăng nhập được cả 5 actor §11.3.2** — fixture checkpoint §11.3.4 |
| **Verification** | `npx supabase db reset`; integration test mới cho RLS + trigger; đăng nhập thử 5 actor |

### Phase 3 — TS contract

| | |
| --- | --- |
| **Goal** | TS phản ánh đúng DB: types, schemas, actions. |
| **Depends on** | P1, P2 |
| **Scope** | `types/database.ts`, `lib/schemas/topic-workflow.ts`, `lib/schemas/topic-review.ts`, `lib/schemas/review-notes.ts` (mới), `app/actions/topic-review.ts`, `app/actions/review-notes.ts` (mới), **`app/actions/topic.ts`** |
| **Out of scope** | Component/UI; `lib/course-authoring/*` ngoài phần bị ảnh hưởng type |
| **Acceptance** | (a) `npx tsc --noEmit` sạch. (b) Không còn `resolveTopicReviewEscalationSchema` / `ResolveTopicReviewEscalationInput` / `pendingSubmissionIsRescue` / `escalationUnresolved`. (c) `createReviewNoteSchema` **không** nhận `authorUserId`. (d) `app/actions/topic.ts` không còn nhánh `TOPIC_REVIEW_CREATION_HOLD`. (e) `getTopicReviewNotes` tồn tại và trả DTO hợp lệ. |
| **Verification** | `npx tsc --noEmit`; `npm.cmd run lint`; schema + action tests |

### Phase 4 — Frontend

| | |
| --- | --- |
| **Goal** | Panel không còn UI escalation; có mục ghi chú đúng contract. |
| **Depends on** | P3 |
| **Scope** | `TopicWorkflowPanel.tsx`, `TopicReviewNotes.tsx` (mới), **`page.tsx`** (gọi `getTopicReviewNotes`, truyền prop — §6.5) |
| **Out of scope** | `TopicBuilderTabs.tsx` — **chốt: KHÔNG sửa.** Đã kiểm: file chỉ truyền `workflow` xuống panel ([TopicBuilderTabs.tsx:270](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicBuilderTabs.tsx#L270>)), không đọc field nào bị bỏ (0 hit cho `escalation\|rescue\|latestRejection\|rejectionCount\|pendingSubmissionIsRescue`) → không vỡ ở tầng type lẫn render. `TopicAuthorshipSection.tsx` cũng 0 hit → **không sửa**. `components/ui/*`; toast toàn cục |
| **Acceptance** | (a) Không còn nút/dialog escalation. (b) Reviewer gửi được note, thấy note hiện ra. (c) Non-reviewer reader thấy note nhưng không thấy composer. (d) Tombstone hiển thị đúng câu. (e) Sửa được note của mình. (f) 375px không tràn ngang. |
| **Verification** | component tests; `npm.cmd run lint`; **manual QA §11.3** |

### Phase 5 — Verification tổng hợp

| | |
| --- | --- |
| **Goal** | Bằng chứng đầy đủ, phân biệt rõ automated / manual / chưa chạy. |
| **Depends on** | P1–P4 |
| **Scope** | Chạy test; **manual QA §11.3.3 (M1–M11)** trên fixture §11.3.2; cập nhật test-plan header; reconcile docs (§13) |
| **Out of scope** | Không sửa hành vi mới |
| **Acceptance** | Mọi mục §12 có bằng chứng hoặc được ghi rõ là `not run` kèm lý do. **Manual QA:** nếu fixture chưa đủ 5 actor (§11.3.4) thì ghi `NOT READY` và **không** chạy M1–M11 — chạy thiếu actor tạo bằng chứng giả cho A4/A6/A7/A8/A9 |
| **Verification** | Xem §10, §11.3 |

---

## 10. Verification

`package.json` **không có** script `typecheck` — dùng `npx tsc --noEmit`. Không được bịa script.

| Lớp | Lệnh | Khi nào |
| --- | --- | --- |
| DB rebuild | `npx supabase db reset` | Sau P1 và sau P2 (bắt buộc) |
| **Lưới literal** (§10.1) | **9** lệnh `grep -rn` cố định | Sau P1, P3, P4 |
| Integration | `npm.cmd run test:integration -- __tests__/integration/topic-review-lifecycle.test.ts` và `…topic-review-notes.test.ts` | Sau P1, P2, P3 |
| Unit/schema/action/component | `npm.cmd run test:run` | Sau P3, P4 |
| Type | `npx tsc --noEmit` | Sau P3, P4 |
| Lint | `npm.cmd run lint` | Sau P3, P4 |
| Diff hygiene | `git diff --check` | Cuối P4 |

Integration cần `ALLOW_DB_INTEGRATION_TESTS=true` (theo header test hiện có).

**Không** chạy full-suite/build cho mỗi phase — chỉ khi bước hẹp phát hiện rủi ro lan rộng, hoặc ở Phase 5.

### 10.1 Lưới quét literal (thay cho lưới `escalation|rescue` đã hỏng)

**Vì sao phải thay:** lưới cũ dùng mẫu `escalation|rescue`. Chuỗi `TOPIC_REVIEW_CREATION_HOLD` **không chứa** hai từ đó, nên lưới cũ trả 0 hit trong khi defect còn nguyên — và nó chỉ quét `supabase/migrations/`, bỏ qua toàn bộ TS. Đây là lỗi đã được xác nhận: với cùng một repo, mẫu cũ cho 220/53 hit và mẫu đã sửa cho 222/54 (§3.2).

Lưới mới quét **theo literal định danh**, phủ **cả SQL lẫn TS**. Mỗi lệnh có kỳ vọng `0`:

```bash
# Chạy từ gốc repo, shell POSIX (Git Bash). Trích dẫn bắt buộc — xem cảnh báo ngay dưới.

# 1. Hai literal hold — cả hai đều ghép escalation (F1, F7b)
grep -rn "TOPIC_REVIEW_ESCALATION_HOLD" supabase/migrations/ app/ lib/ types/ ; echo "expect 0"
grep -rn "TOPIC_REVIEW_CREATION_HOLD"   supabase/migrations/ app/ lib/ types/ ; echo "expect 0"

# 2. Bảng và cột
grep -rn "topic_review_escalations"     supabase/migrations/ app/ lib/ types/ ; echo "expect 0"
grep -rn "rescue_escalation_id"         supabase/migrations/ app/ lib/ types/ ; echo "expect 0"

# 3. Hai RPC bị gỡ hẳn
grep -rn "resolve_topic_review_escalation"                supabase/migrations/ app/ lib/ types/ ; echo "expect 0"
grep -rn "d1_resolve_topic_escalations_for_moderation"    supabase/migrations/ app/ lib/ types/ ; echo "expect 0"

# 4. DTO field bị bỏ, và giá trị moderation bị gỡ
grep -rn "latestRejection\|escalationUnresolved\|pendingSubmissionIsRescue\|escalationId\|escalationSubmitterId\|canResolveEscalation" app/ lib/ types/ ; echo "expect 0"
grep -rn "cancel_escalation" supabase/migrations/ app/ lib/ types/ ; echo "expect 0"

# 5. Copy ngân sách (A3c) — literal có ngữ cảnh, KHÔNG dùng "/3" trần
grep -rn "lần phản hồi trong lượt gửi" "app/(teacher)" lib/ ; echo "expect 0"
```

**Ba luật dùng lưới này — vi phạm là hỏng lại đúng chỗ vừa sửa:**

1. **Luôn trích dẫn mẫu.** Trong Git Bash/MSYS, `/3` **không** trích dẫn bị chuyển thành đường dẫn Windows và cho **0 hit giả** — đã đo được. Mọi mẫu ở trên đều được trích dẫn.
2. **Không dùng mẫu một ký tự ngắn kiểu `/3`.** Nó khớp Tailwind opacity: `/3` là tiền tố của `/30`, và `app/(teacher)` có 4 hit CSS như vậy (`CourseForm.tsx:308`, `CourseOverviewError.tsx:87`, `CollaboratorManagementDialog.tsx:256`, `:305`). Một tiêu chí vừa pass giả vừa fail giả thì không đo được gì — dùng literal có ngữ cảnh (lệnh 5).
3. **Bỏ qua `.e2e-runtime/**`.** Đó là mirror gitignored, không phải bằng chứng repo. Mọi lệnh trên đã giới hạn đường dẫn nên không chạm tới nó — nhưng nếu ai đó đổi sang `grep -rn ... .` thì phải thêm `--exclude-dir=.e2e-runtime`.

**Giới hạn phải biết:** lưới này chứng minh *literal đã biến mất*, **không** chứng minh *hành vi đúng*. Nó là điều kiện cần, không phải điều kiện đủ — bằng chứng hành vi nằm ở §11. Tương tự, nó quét được `supabase/migrations/` chứ **không** quét database đang chạy; điều kiện "bảng không còn tồn tại" thuộc về `db reset` + §12 A2.

---

## 11. Test plan

### 11.1 Test phải sửa (đang encode hành vi sai)

| File | Việc |
| --- | --- |
| `__tests__/integration/topic-review-lifecycle.test.ts` (1.191 dòng, 25 `it(`, 83 hit) | Gỡ các `it` escalation/rescue: `serializes third rejection, creation hold, rescue and approval` (:392 — **chứa assertion `TOPIC_REVIEW_CREATION_HOLD` duy nhất của repo**, tại :432), `resets the active rejection episode after terminal close while retaining history` (:452), `keeps the whole topic on escalation hold after responsibility transfer` (:517), `cancels pending submissions when an escalation is closed` (:549), `does not approve an ordinary submission while an escalation is unresolved` (:615), `does not publish a rescue while another topic escalation remains unresolved` (:631), `keeps moderation resolution separate from review resolution and cancels rescue` (:823), `resolves an open escalation as moderation during topic takedown` (:873). Cập nhật test-plan header (bỏ "escalation RPC", bỏ "Rescue", bỏ "Rejection hold", bỏ "creation hold"). |
| `__tests__/actions/topic-review.test.ts` | Bỏ case escalation; bỏ kỳ vọng `rejection_count`/`escalated` trong return shape của `reject_topic_review`. |
| `__tests__/schemas/topic-workflow.test.ts` | Bỏ 5 field escalation khỏi fixture hợp lệ; thay 3 field `latestRejection*` bằng `rejectionHistory: []`. |
| `__tests__/components/topic-workflow-panel.test.tsx` | Bỏ case dialog escalation; bỏ nút đã gỡ; **thêm** case render khối lịch sử từ chối (§11.2). |
| `__tests__/components/topic-authorship-section.test.tsx` | 5 hit escalation — kiểm và gỡ phần phụ thuộc state escalation. Kiểm cả rằng file này **không** cần sửa vì type: nó có 0 literal `escalation\|rescue` (§9 P4). |
| `__tests__/actions/course-structure.test.ts` | 5 hit — kiểm và gỡ. |
| **`__tests__/components/course-workspace-routes.test.tsx`** | **Guard test trên chính `page.tsx`** — assert `expect(topicBuilderPageSource).toContain("getTopicWorkflow")` ([:1416](__tests__/components/course-workspace-routes.test.tsx#L1416)). Thêm `getTopicReviewNotes` vào `page.tsx` (§6.5) có thể vỡ guard này. **Bắt buộc nằm trong scope** — bản plan trước bỏ sót hoàn toàn (0 hit). |

### 11.2 Test phải thêm

**Integration — `__tests__/integration/topic-review-notes.test.ts` (mới, cần test-plan header).** Chạy trên local Supabase thật, **không** mock RLS/DB.

*Case thành công:*
* Reviewer (`can_review_topics`) insert note cấp topic → đọc lại được.
* Reviewer insert note gắn `card_id` thuộc đúng topic → thành công.
* Creator/support/responsible đọc được note của topic mình.
* Tác giả sửa `body` note của mình → `updatedAt` đổi.
* Tác giả xóa mềm → `select` vẫn trả row, `removed_at` + `removed_by_user_id` set.

*Case thất bại:*
* Người không có quyền review insert → bị từ chối.
* Reviewer bị exclusion (creator) insert → bị từ chối.
* `update` note của người khác → bị từ chối.
* Xóa cứng (`delete`) → bị từ chối.
* `body` rỗng / toàn khoảng trắng / 2001 ký tự → bị từ chối.
* Cả `card_id` và `exercise_id` cùng set → vi phạm `review_notes_single_target_check`.
* `update` đổi `topic_id` / `card_id` / `author_user_id` → `REVIEW_NOTE_IDENTITY_IMMUTABLE`.

*Bảo mật/phân quyền:*
* Người ngoài khoá học `select` → không thấy row nào.
* Contributor còn `topic_contributors` nhưng **đã bị gỡ khỏi khoá học** → **không** đọc được (D5).
* `author_user_id` do client gửi bị bỏ qua: insert không kèm field, DB điền `auth.uid()`.

*Đường đọc `getTopicReviewNotes` (§6.5) — chạy ở tầng integration vì RLS là nơi ép quyền:*
* Reviewer gọi → thấy note của topic, đúng thứ tự mới nhất trước.
* Creator/responsible/active contributor gọi → thấy note dù không có quyền review.
* Người ngoài khoá học gọi → mảng rỗng, **không** lỗi (phân biệt "không có quyền" với "lỗi").
* Ghi chú đã xoá mềm **vẫn** có trong kết quả, kèm `removedAt` + `removedBy` — tombstone phải tới được UI (A7).
* Nhãn đích: note gắn `card_id` trả kèm `card.title`; gắn `exercise_id` trả kèm `exercise.title`; note cấp topic trả cả hai là `null`. **Đây là lý do đường đọc tách khỏi workflow RPC** — nếu test này không viết được thì quyết định ở §6.5 sai và phải xem lại.

*Bounded semantic substitution (theo `mocking-and-regression`):*
* Dựng graph hợp lệ: topic T1 (card C1) và topic T2 (card C2), reviewer có quyền review **cả hai**.
* Thay **đúng một** chiều: insert note `topic_id = T1`, `card_id = C2` (C2 là card hợp lệ, chỉ sai quan hệ).
* Kỳ vọng: `REVIEW_NOTE_TARGET_TOPIC_MISMATCH`, **không** có row nào được tạo.
* Case đối chứng: `topic_id = T1`, `card_id = C1` → thành công. Chứng minh test bắt **quan hệ**, không bắt syntax.
* Lặp lại cho `exercise_id`.

**Integration — bổ sung vào `topic-review-lifecycle.test.ts`:**
* `rejects a third time without locking the topic for resubmission` — từ chối 3 lần, lần gửi thứ 4 vẫn thành công.
* `reports the same rejection count to every caller` — 2 caller khác role đọc cùng topic → `rejectionCount` bằng nhau (chống tái phát F6).
* `reports the same rejection history to every caller` — cùng 2 caller → `rejectionHistory` **bằng nhau từng phần tử** (không chỉ cùng độ dài): cùng `index`, `reason`, `reviewer.userId`, `reviewedAt`.
* `numbers rejections chronologically across different submitters` — 3 lần từ chối xen kẽ giữa 2 người gửi khác nhau → `index` là `1,2,3` theo `reviewedAt`, **không** reset về 1 khi đổi người gửi (đây chính là hành vi cũ bị bỏ).
* `keeps rejectionCount equal to rejectionHistory length` — bất biến §5.5, kiểm sau mỗi lần từ chối.
* `hides the rejection history once the topic is published` — sau khi duyệt thành công, `rejectionHistory = []` và `rejectionCount = 0` (giữ nguyên hành vi ẩn hiện có).
* `allows the rejecting reviewer to approve a later submission` — chốt hành vi F4 là **cố ý**.

**Component — `__tests__/components/topic-workflow-panel.test.tsx` (bổ sung):** khối lịch sử render đủ N mục khi mở rộng; mục gần nhất hiện mặc định; `reviewer = null` hiện chuỗi thay thế; `rejectionHistory: []` → không render khối; **không** còn chuỗi `"/3"` trong output; thời gian ra đúng dạng `HH:mm · dd/MM/yyyy` 24 giờ.

**Schema — `__tests__/schemas/review-notes.test.ts` (mới):** valid/invalid body, `cardId` + `exerciseId` cùng lúc bị refine chặn, unknown key bị `strictObject` chặn, **`authorUserId` không tồn tại** trong contract.

**Action — `__tests__/actions/review-notes.test.ts` (mới):** payload hợp lệ/không hợp lệ, thiếu auth, mutation **không** chạy sau khi parse fail, error shape ổn định và không lộ internals; `getTopicReviewNotes` trả mảng rỗng khi RLS chặn, **không** trả lỗi.

**Component — `__tests__/components/topic-review-notes.test.tsx` (mới):** loading/empty/error/pending; composer chỉ hiện khi `canReview`; nút Sửa/Xóa chỉ hiện với note của mình; tombstone render đúng câu; giữ nội dung sau submit lỗi.

**Component — `__tests__/components/topic-review-notes.test.tsx` (mới):** loading/empty/error/pending; composer chỉ hiện khi `canReview`; nút Sửa/Xóa chỉ hiện với note của mình; tombstone render đúng câu; giữ nội dung sau submit lỗi.

### 11.3 Manual QA — state matrix và fixture

Bản plan trước **tham chiếu** mục này nhưng **chưa hề viết nó**: §9 P4 ghi "manual QA (§11)", §15 gap ghi "§QA fixture" — cả hai đều là tham chiếu treo. Đây là mục thật, và nó là **điều kiện chặn** browser QA theo `qa-fixture-readiness`.

#### 11.3.1 Fixture readiness — một kết quả, đã ghi

**Kết quả: `NOT READY`.** Seed hiện tại **không** dựng được các actor mà D3 phân biệt. Bảng dưới đây đã được **đo lại và sửa một lần** — bản nháp đầu của mục này nói "cả hai topic seed đều published" và "bị trigger chặn", **cả hai đều sai**; giữ lại ghi chú để người đọc biết chỗ nào dễ sai.

| Actor cần | Có trong seed? | Bằng chứng |
| --- | --- | --- |
| `owner` / `co_owner` (quyền review **theo vai trò**) | **Có** | Khoá `44444444-…` có admin `owner` + teacher `co_owner` ([seed.sql:245-273](supabase/seed.sql#L245-L273)) |
| Reviewer **khác** người tạo (cho "không tự duyệt bài mình") | **Có** | admin là `owner` cùng khoá → `has_topic_review_access` trả `true`, không bị exclusion. **Nhu cầu này đã được đáp** |
| `editor`/`previewer` có `can_review_topics = true` | **Không** | Cột bị bỏ khỏi INSERT → nhận `default false` ([20260915090000:22-23](supabase/migrations/20260915090000_d1_foundation.sql#L22-L23)) |
| **Thành viên đọc được nhưng KHÔNG có quyền review** | **Không** | Hai collaborator duy nhất đều là owner/co_owner → `has_topic_review_access` trả `true` cho **cả hai** (F21). Không ai đóng được vai "reader không phải reviewer" — mà đó chính là biên D3 tồn tại để kiểm |
| Contributor đang hoạt động (`topic_contributors`) | **Không** | `topic_contributors` xuất hiện **0 lần** trong `seed.sql` và `scripts/**`. Writer duy nhất trong toàn repo là RPC tại [20260916130000:445](supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql#L445) |
| Contributor **đã bị gỡ khỏi khoá học** (A9) | **Không** | Hệ quả của dòng trên |
| Topic ở `draft` | **Có, nhưng KHÔNG dùng được** | `b2200000-…0311` (`'Topic draft'`, `first_approved_at` null) nằm ở khoá `b2000000-…0003` ([seed.sql:746-775](supabase/seed.sql#L746-L775)) — khoá này **không có collaborator nào**: chỉ có **một** `insert into public.course_collaborators` trong toàn bộ seed ([:245](supabase/seed.sql#L245)), và nó chỉ phủ khoá `44444444-…`. Không thành viên → không mở được workflow, không gửi duyệt được |
| Topic ở `pending` | **Không** | **Không có** topic `pending` nào. Mọi topic khác đều `published` |

Ba dòng "Không" cộng một dòng "Có nhưng không dùng được" ⇒ `NOT READY`. Hệ quả: **A3b, A7, A8, A9 và P4 (b)–(f) không quan sát được trên UI** cho tới khi fixture được bổ sung.

**Hai chỗ dễ kết luận sai — ghi lại để không lặp:**

1. **`can_review_topics` false đến từ `DEFAULT`, không phải từ trigger.** Trigger `clear_topic_review_capability_on_role_downgrade` là **`before update`** ([20260915090000:188-194](supabase/migrations/20260915090000_d1_foundation.sql#L188-L194)) — nó **không** chạy khi INSERT. Nghĩa là seed **có thể** set `true` bằng một dòng; không có rào schema nào phải phá. (Chỉ tổ hợp `co_owner` + `true` bị CHECK chặn — trên bảng invitation, [20260915140000:15](supabase/migrations/20260915140000_d1_collaborator_invitations.sql#L15).) Việc thêm fixture vì thế là sửa seed, không phải sửa migration.
2. **`can_review_topics` có xuất hiện ngoài `__tests__/`**: [scripts/e2e/course-leave-navigation-fixture.mjs:59](scripts/e2e/course-leave-navigation-fixture.mjs#L59) set `false`. Con số "repo-wide 0" chỉ đúng nếu phát biểu chính xác là *"0 chỗ set `true`"* — và phải quét cả `.mjs`, không chỉ `.sql`/`.ts`/`.tsx`.

#### 11.3.2 Fixture phải thêm (biến điều kiện ở §9 P2 thành task)

`supabase/seed.sql` — thêm vào khoá `44444444-…`, giữ nguyên tính idempotent (`on conflict … do update`) hiện có:

1. **Một `editor` với `can_review_topics = false`** — actor "reader không phải reviewer" (biên D3; A8 ngược lại). Đây là dòng quan trọng nhất: không có nó thì **không** kiểm được rằng D3 phân biệt đọc và viết.
2. **Một `previewer` với `can_review_topics = true`** — nhánh review không-owner của `has_topic_review_access` (F21). Nếu chỉ có owner/co_owner thì nhánh `editor/previewer AND can_review_topics` **không bao giờ được chạy trong QA**. Set `true` được: xem §11.3.1 điểm 1.
3. **Một row `topic_contributors`** trỏ vào topic draft dưới đây → actor contributor đang hoạt động.
4. **Một topic `draft`** trong khoá `44444444-…`, có ≥1 card + ≥1 exercise hoạt động → trạng thái để diễn luồng gửi duyệt, từ chối, và khối lịch sử từ chối. **Không tái dùng** `b2200000-…0311` (§11.3.1): nó nằm ở khoá không có collaborator, và sửa khoá đó sẽ lan sang fixture pagination của B2.
5. **State "contributor đã bị gỡ khỏi khoá học"** (cho A9): contributor ở (3) có `topic_contributors` còn hiệu lực nhưng `course_collaborators` **không** còn. Cách dựng: dựng state này trong **integration test** bằng `service_role` thay vì nhét vào seed — seed là dữ liệu dev dùng chung, không nên chứa một state cố tình mâu thuẫn. Cơ chế đã được kiểm: gỡ collaborator chỉ xoá `course_collaborators` ([20260916130000:666](supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql#L666), [:710](supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql#L710)), **không** cascade sang `topic_contributors` — đây cũng chính là giả định §14.2 S1, và nó được xác nhận ở đây.

Ràng buộc khi thêm: không phá tính idempotent của seed; **không** đổi dữ liệu của `Local Test Topic` ([:293](supabase/seed.sql#L293)) hay bất kỳ topic/khoá `b2000…` nào — E2E và các test khác đang phụ thuộc chúng.

#### 11.3.3 State matrix cho browser QA

| # | Actor | Trạng thái topic | Việc làm | Kỳ vọng | Tiêu chí |
| --- | --- | --- | --- | --- | --- |
| M1 | admin (`owner`) | `draft` đủ điều kiện | Gửi duyệt → từ chối 1 lần với lý do | Topic về `draft`, khối lịch sử hiện `Lần 1` + tên admin + `HH:mm · dd/MM/yyyy` | A1, A3b |
| M2 | teacher (`co_owner`, responsible) | `draft` sau M1 | Đọc lại trang | Thấy **cùng** `Lần 1` và cùng số lần — không phụ thuộc người đọc | A3, A3b |
| M3 | admin | `draft` sau M2 | Từ chối tiếp 2 lần nữa → teacher gửi duyệt lần 4 | Lần gửi 4 **thành công**; không có nút mở khoá nào cho owner | A1, A12 |
| M4 | admin | `draft` | Mở khoá lịch sử (≥3 lần) | Mở rộng thấy đủ `Lần 1..N`; mục cũ **không** màu đỏ; **không** có chuỗi `/3` | A3b, A3c |
| M5 | previewer `can_review_topics=true` | `draft` | Viết note cấp topic | Note hiện ra; composer hiện | A4 |
| M6 | editor `can_review_topics=false` | `draft` | Mở cùng topic | **Thấy** note, **không** thấy composer | A4, A7b |
| M7 | admin | topic có note của previewer | Thử sửa/xoá note đó | Không có nút, hoặc bị từ chối | A6 |
| M8 | previewer (tác giả note) | như trên | Sửa note → rồi xoá mềm | Nhãn "đã chỉnh sửa"; sau xoá hiện `Ghi chú đã bị xóa bởi <tên>`, không còn nội dung | A6, A7 |
| M9 | contributor | `draft` | Mở topic | Thấy note (là participant) | A8 |
| M10 | bất kỳ | topic `pending` | Mở topic | Không gửi được note mới trùng; nội dung vẫn đóng băng như cũ | hồi quy |
| M11 | mọi actor | mọi trạng thái | Thu nhỏ 375px | Không tràn ngang; body note 2000 ký tự wrap | P4 (f) |

#### 11.3.4 Fixture checkpoint — khi nào được bắt đầu browser QA

**Chỉ bắt đầu browser QA khi:** `npx supabase db reset` sạch → fixture §11.3.2 đã apply → đăng nhập được **cả năm** actor (owner, co_owner, editor-no-review, previewer-reviewer, contributor). Nếu chưa đủ năm, ghi `NOT READY` và **không** chạy M1–M11 — chạy thiếu actor sẽ tạo bằng chứng giả cho A4/A6/A7/A8/A9.

**Reset/setup:**
```bash
npx supabase db reset      # dựng lại schema + seed
npx supabase status        # lấy URL/anon key cho browser QA
```
Mật khẩu các user seed: `123123` (theo header của test integration hiện có — dùng cùng nguồn, không tự đặt mật khẩu mới).

### 11.4 Ranh giới bằng chứng
Được phép khẳng định: hành vi RLS/trigger/RPC qua integration test trên local Supabase; hành vi component qua RTL.

**Không** được khẳng định: rằng D1 đã chạy trên remote (không có quyền); rằng smoke E2E phủ flow này (phải kiểm tooling + scenario thật trước); rằng manual QA đã xong khi state matrix chưa dựng đủ.

---

## 12. Acceptance criteria

| # | Tiêu chí |
| --- | --- |
| A1 | Sau 3 lần từ chối, người phụ trách vẫn gửi duyệt lại được ngay; không có thao tác nào của owner/co-owner là bắt buộc để mở khóa. |
| A2 | `select` vào `topic_review_escalations` báo lỗi "relation does not exist" trên DB dựng từ migration. |
| A3 | Hai caller khác role đọc cùng một topic nhận **cùng** `rejectionCount` **và** cùng `rejectionHistory` (từng phần tử). |
| A3b | Mọi lần từ chối của topic được hiển thị đầy đủ: đánh số `Lần 1..N` theo thứ tự thời gian, kèm lý do, người đánh giá và thời điểm `HH:mm · dd/MM/yyyy`. |
| A3c | Không còn **copy ngân sách**. Đo bằng literal có ngữ cảnh, **không** dùng `/3` trần (§10.1 luật 2): `grep -rn "lần phản hồi trong lượt gửi" "app/(teacher)" lib/` → 0 hit. |
| A4 | Người có quyền review gửi được ghi chú; người không có quyền review bị từ chối ở tầng DB. |
| A5 | Ghi chú trỏ `card_id`/`exercise_id` của topic khác bị từ chối ở tầng DB, kể cả khi ghi bằng `service_role`. |
| A6 | Chỉ tác giả sửa/xóa được ghi chú của mình; xóa cứng bất khả thi với `authenticated`. |
| A7 | Ghi chú đã xóa vẫn hiển thị tombstone `Ghi chú đã bị xóa bởi <tên>`. |
| A7b | **Người đọc tải được danh sách ghi chú** qua `getTopicReviewNotes` (§6.5): reviewer và participant thấy note; người ngoài khoá học thấy mảng rỗng, không lỗi. Không có tiêu chí này thì A4–A9 không quan sát được trên UI. |
| A8 | Creator đọc được ghi chú của topic mình kể cả khi bị loại khỏi vai trò reviewer. |
| A9 | Contributor đã bị gỡ khỏi khoá học **không** đọc được ghi chú. |
| A10 | `npx supabase db reset` thành công từ chuỗi migration đã sửa. |
| A11 | Không file nào ngoài danh sách ở §9 bị thay đổi. Danh sách §9 **đã bao gồm** đường đọc (`page.tsx`, `course-workspace-routes.test.tsx`, `app/actions/topic.ts`) — nếu thiếu, A11 và A4–A9 không thể cùng đúng. |
| A12 | Người đang có escalation chưa giải quyết **tạo được topic mới** trong khoá học đó (chốt `CREATION_HOLD` đã gỡ — F7b). |
| A13 | Lưới literal §10.1 trả 0 hit cho **cả 9** lệnh, trên cả `supabase/migrations/` lẫn `app/ lib/ types/`. |

---

## 13. Tài liệu phải reconcile + dọn artifact

### 13.1 Reconcile — thứ tự đã chốt (D14)

**`./plan.md` giữ stale có chủ đích.** v2 là contract hiện hành; `plan.md` chỉ được reconcile **sau khi v2 implement xong (P1–P5 land)**, không phải trước. Ở bước này `plan.md` chỉ nhận một marker "stale by decision" ở đầu file; **nội dung contract của nó không bị sửa**, nên nó vẫn mô tả escalation/rescue/review-budget cũ.

Khi reconcile (sau P1–P5):

* `./plan.md` — cập nhật contract D1: gỡ escalation/rescue/budget; thêm `review_notes` **và lịch sử từ chối** (§5.5). Lưu ý `plan.md` có thể còn câu mô tả "3 lần từ chối" hoặc trạng thái kết thúc — phải gỡ hết, không chỉ phần "escalation".
* Test-plan header trong các file test ở §11.1 — chúng chỉ stale **sau khi** code đổi, nên thuộc cùng bước reconcile này chứ không phải bước tài liệu hiện tại.
* **Không** reconcile `progress.md`, `problems.md` hay `plan.md` cấp program: các mục escalation/rescue ở đó là bản ghi lịch sử kèm ngày và commit hash, sửa lại là làm sai hồ sơ. Phạm vi durable docs của bước hiện tại **chỉ trong D1**.

### 13.2 Ba draft correction đã STALE

`correction-plan.md`, `correction-plan-gemini.md`, `correction-plan-deepseek.md` đều mô tả contract **escalation/rescue đã bị bỏ**. Chúng đang untracked (không có trong git → **xóa là không hoàn tác được**).

**Đề xuất:** chèn một khối cảnh báo ở **đầu mỗi file**, không xóa. Lý do: (a) chúng là bằng chứng của quá trình review song song đã được commit evidence nhắc tới; (b) xóa file untracked là mất dữ liệu vĩnh viễn; (c) cảnh báo ở đầu file là thứ một agent-session khác đọc thấy trước tiên, đủ để triệt rủi ro gây hiểu nhầm. Việc xóa vẫn có thể làm sau nếu Owner muốn.

Nội dung khối:

```md
> ⛔ **STALE — KHÔNG DÙNG LÀM CONTRACT.**
> Tài liệu này mô tả mô hình escalation/rescue/review-budget đã bị **bỏ hoàn toàn**.
> Contract hiện hành: [`correction-plan-deepseek-v2.md`](./correction-plan-deepseek-v2.md).
> Giữ lại chỉ để làm hồ sơ lịch sử.
```

### 13.3 Memory

`memory/d1-rescue-contract-drift.md` ghi *"rescue is now responsibility takeover"* — đúng hướng cũ, nay sai. Sửa để phản ánh: escalation/rescue đã bị gỡ, rejection chỉ trả topic về `draft`, phản hồi reviewer chuyển sang `review_notes`. Cập nhật dòng tương ứng trong `MEMORY.md`.

---

## 14. Rủi ro, giả định, unresolved decision

### 14.1 Rủi ro

| # | Rủi ro | Tác động | Giảm thiểu | Phase lộ ra sớm nhất |
| --- | --- | --- | --- | --- |
| R1 | `review_notes` là bảng D1 **đầu tiên** cấp quyền cho `authenticated` (F15), phá convention service_role-only | Sai policy = rò rỉ hoặc chặn nhầm ghi chú giữa các khoá học | Guard trigger + `WITH CHECK` ép sở hữu; integration test phủ cả allowed **và** denied cho từng operation (`select`/`insert`/`update`) | P2 |
| R2 | Sửa thẳng chuỗi D1 (D8) làm stale mọi môi trường đã apply D1 cũ | `db reset` bắt buộc; E2E workdir có thể lệch | Reset cả root DB và E2E workdir; kiểm tra function tồn tại trước khi restart PostgREST | P1 |
| R3 | Bỏ sót tham chiếu escalation trong 9 file | `db reset` fail | **Lưới cũ `escalation\|rescue` đã chứng minh là MÙ** với `TOPIC_REVIEW_CREATION_HOLD` (F7c) — nó pass trong khi defect sống. Lưới đã sửa ở §10 quét **theo literal** và phủ **cả TS**: `TOPIC_REVIEW_ESCALATION_HOLD`, `TOPIC_REVIEW_CREATION_HOLD`, `topic_review_escalations`, `rescue_escalation_id`, `resolve_topic_review_escalation`, `p_action` — cả `supabase/migrations/` lẫn `app/ lib/ types/`. Kèm `db reset` làm lưới thứ hai | P1 |
| R4 | Xóa `TOPIC_REVIEW_ESCALATION_HOLD` mở lại đường gửi duyệt cho topic bị từ chối nhiều lần | Spam gửi duyệt | Đây là **hành vi mong muốn** (D1). Owner đã chốt **không** thêm gate chống spam ở thời điểm này (D12) — ghi nhận là quyết định có thời hạn, không phải bỏ sót | P1 |
| R5 | `rejectionCount` + `rejectionHistory` topic-scoped lộ số lần từ chối **và danh tính người từ chối** cho mọi thành viên khoá học | Thay đổi thông tin hiển thị so với thiết kế cũ (vốn ẩn budget khỏi reviewer) | Owner đã chốt **không ẩn**, hiện đầy đủ lịch sử + người đánh giá (D13). Đây là chủ ý, không phải rò rỉ | P3 |
| R5b | `rejectionHistory` là mảng **không giới hạn** — topic bị từ chối rất nhiều lần làm payload `get_topic_workflow_state` phình theo | Response chậm dần | Chấp nhận ở quy mô hiện tại (RPC chỉ chạy cho một topic, mỗi phần tử vài trăm byte). Nếu thành vấn đề thật: phân trang hoặc chỉ trả N lần gần nhất — **chưa làm bây giờ**, ghi lại để không phải phát hiện lại | P3 |
| R6 | Action ghi chú không tự kiểm authorization (dựa RLS) | Nếu RLS viết sai, action trông vẫn "đúng" | Test phân quyền **bắt buộc** ở tầng integration; action test chỉ phủ parse/error shape | P2/P3 |
| R7 | `topicAuthorIdentitySchema` phải được export từ `topic-workflow.ts` | Chạm file ngoài phạm vi hẹp | Là thay đổi **bắt buộc** để tránh định nghĩa trùng DTO; ghi rõ trong §6.5 | P3 |

### 14.2 Giả định

| # | Giả định | Nếu sai thì sao |
| --- | --- | --- |
| S1 | `remove_course_collaborator` / `leave_course_collaboration` **không** dọn `topic_contributors`. | **Đã xác minh — không còn là giả định.** Gỡ collaborator chỉ xoá `course_collaborators` (`20260916130000:666`, `:710`); không có cascade sang `topic_contributors`. Nghĩa là điều kiện "còn là thành viên khoá học" ở `d1_can_read_topic_review_notes` là **cần**, không thừa → giữ. Xem §11.3.2 mục 5. |
| S2 | `d1_transfer_member_topic_responsibilities` chỉ xử lý `responsible_author`, không đụng `topic_contributors`. | Như S1. |
| S3 | Owner chấp nhận mất dữ liệu QA local khi `db reset` (hệ quả của D8). | Nếu không, phải chọn lại phương án migration. |

**Giả định S1/S2 phải được xác minh bằng đọc code trong Phase 2**, không được coi là fact. Nếu phát hiện cascade thật, ghi lại và **không** gỡ điều kiện membership (nó vẫn là biên đúng theo D5).

### 14.3 Hành vi cần Owner biết (không chặn)

| # | Hành vi | Ghi chú |
| --- | --- | --- |
| B1 | Reviewer mất quyền review thì không sửa/xóa mềm được note cũ của mình | Hệ quả trực tiếp của D5 trong `WITH CHECK`. Muốn khác thì phải nới policy. |
| B2 | `removed_by_user_id` trên `review_notes` **dư thừa** khi chỉ tác giả được xóa (D9) — luôn bằng `author_user_id` | Vẫn giữ để khớp convention soft-delete toàn repo (F13), làm audit tường minh, và là chỗ sẵn cho khả năng owner-moderation sau này mà không cần migration. Có thể bỏ nếu Owner muốn tối giản tuyệt đối. |
| B3 | `reject_topic_review` **bỏ** `rejection_count` và `escalated` khỏi return shape `jsonb` | Không consumer nào đọc hai field này (đã kiểm `app/actions/topic-review.ts`: chỉ forward `data` để `revalidateCourse` lấy `course_id`). |
| B4 | **Danh tính người từ chối** nay hiển thị cho mọi thành viên khoá học đọc được workflow state, không chỉ người bị từ chối | Hệ quả trực tiếp của D13 ("người reject càng tốt"). Trong phạm vi một khoá học, giữa các cộng tác viên đã biết nhau; nhưng đây là **thay đổi phạm vi hiển thị** so với hiện tại nên ghi rõ để không phải phát hiện lại sau |
| B5 | Bỏ bộ `latestRejection*` là **proposal của engineering gate**, không phải Owner decision (§5.4) | Nếu Owner muốn giữ để tránh churn ở consumer khác, chỉ cần đổi lại mục đó; phần còn lại của plan không phụ thuộc |

### 14.4 Unresolved decision

**Không còn.** Ba câu hỏi mở của bản plan trước đã được Owner chốt trong lượt này và đã chuyển thành D11/D12/D13 ở §4:

| # (cũ) | Câu hỏi | Chốt |
| --- | --- | --- |
| U1 | `review_notes` nằm trong migration mới hay gộp vào lần amend? | **Tách ra** → migration mới `20260917120000_d1_review_notes.sql` (D11) |
| U2 | Có cần chống spam gửi duyệt không? | **Tạm thời thì không** (D12) |
| U3 | Có ẩn `rejectionCount` khỏi reviewer thường không? | **Không ẩn**, và hiện thêm **toàn bộ lịch sử từ chối** kèm người đánh giá (D13) |

Điều này nghĩa là **không còn gì chặn việc implement** ngoài chính việc Owner approve plan. Các mục ở §14.2 (giả định S1/S2) vẫn phải verify trong lúc code, nhưng chúng không chặn khởi động — và cách xử lý nếu sai đã được định trước.

---

## 15. Self-review (plan)

Áp dụng `docs/agent-self-review.md` + extension của `tracked-program-and-durable-plan`.

**Anchor:** đối tượng được review là tài liệu này, đối chiếu với **13** Owner decision ở §4 và repository fact ở §3 (đã đọc trực tiếp, có `file:line`).

**Nỗ lực phản chứng:**

| Giả thuyết sai | Cách kiểm | Kết quả |
| --- | --- | --- |
| "Còn cơ chế chặn nào khác ngoài `TOPIC_REVIEW_ESCALATION_HOLD`" | Đọc toàn bộ precondition của `request_topic_review` + `d1_has_eligible_topic_reviewer` | Bác bỏ. F1 đứng vững. |
| "Bỏ escalation sẽ làm mất lịch sử từ chối" | Kiểm `topic_review_submissions` | Bác bỏ. Lịch sử nằm ở bảng submission (F9), không ở escalation. |
| "`has_topic_review_access` đã đủ cho cả đọc và viết note" | So với D3 | Bác bỏ. F21: hàm này **loại trừ** creator → cần helper mới. Đã sửa thiết kế (§6.3). |
| "Không cần điều kiện thành viên khoá học vì contributor đã bị gỡ sẽ mất `topic_contributors`" | grep cascade trong `20260916130000` | Bác bỏ. Không có cascade cho collaborator (S1) → điều kiện membership là **cần**. |
| "Guard trigger nên kiểm đích cả khi UPDATE cho chặt" | Truy vết tình huống card bị xóa mềm rồi tác giả sửa body | Bác bỏ. Sẽ tạo bug chặn sửa hợp lệ → thiết kế đã sửa thành chỉ kiểm khi INSERT (§6.2). |
| "`npm run typecheck` là lệnh verify" | Đọc `package.json` scripts | Bác bỏ. Không tồn tại script → đã đổi thành `npx tsc --noEmit` (§10). |
| "`platform_moderation_action` là enum nên phải `alter type`" | grep định nghĩa | Bác bỏ. Là check constraint (F22). |
| "`removed_by_user_id` là cần thiết" | Kiểm khi chỉ tác giả được xóa | **Không bác bỏ được** — cột này dư thừa về mặt logic. Đã ghi nhận minh bạch ở B2 thay vì biện minh. |
| "Giữ `latestRejection*` song song `rejectionHistory` cho an toàn" | So hai cách biểu diễn cùng dữ liệu | Bác bỏ. Hai nguồn có thể lệch, và UI buộc phải chọn một → đã bỏ bộ ba cũ, ghi rõ đây là proposal ở §5.4/B5. |
| "`rejectionHistory` phải lọc theo `v_episode_resolved_at` như code cũ" | Truy vết nguồn gốc biến đó | Bác bỏ. `episode_resolved_at` đọc từ `topic_review_escalations` — bảng bị gỡ, nên điều kiện lọc mất chủ thể. Giữ lại sẽ là bug biên dịch, không phải bug logic. |
| "Đếm `rejectionCount` riêng bằng `count(*)` là ổn" | Kiểm tính nhất quán với mảng | Bác bỏ. Hai truy vấn riêng có thể lệch khi có race → đã đổi thành suy count **từ** `jsonb_array_length(rejectionHistory)` (§5.5). |
| "Định dạng thời gian `Intl.DateTimeFormat("vi-VN")` mặc định là đủ" | So với mẫu Owner đưa (`14:32`) | Bác bỏ. Locale vi-VN mặc định có thể ra `2:32 CH` → đã ghi rõ `hour12: false` (§6.6a). |

**Kiểm tra currentness:** mọi `file:line` được đọc trong lượt discovery này, không lấy từ trí nhớ. Số liệu SQL/TS/test ở §3.2 đều là kết quả `grep`/`wc` thật, **và được đo lại bằng hai mẫu quét khác nhau** — chính độ lệch giữa hai mẫu là bằng chứng của C1.

**Đóng verification:** đây là tài liệu planning-only → không có test để chạy. Claim duy nhất cần bằng chứng là các fact ở §3, đã có `file:line`.

### 15.1 Vòng review độc lập (2026-09-17) — cái gì đã xác nhận, cái gì đã bác bỏ

Một reviewer độc lập đã soi plan này và trả về 7 finding. **Tôi đã tự đo lại từng cái**, và với hai cái cần đọc sâu thì dùng thêm verifier độc lập. Kết quả không đồng đều — 5 đúng, 1 sai, 1 sai một phần. Ghi lại cả hai chiều, vì một plan chỉ ghi những gì được xác nhận là một plan đang che giấu.

**Đã xác nhận và đã sửa:**

| Finding | Nội dung | Xử lý |
| --- | --- | --- |
| **C1** | Lưới quét `escalation\|rescue` **mù** với `TOPIC_REVIEW_CREATION_HOLD`; tiêu chí acceptance pass giả trong khi defect sống; `app/actions/topic.ts` không nằm trong scope | §3.1 F7b/F7c, §3.2 (hai phép đo), §9 P1 acceptance, §9 P3 scope, §10.1 (lưới literal mới), §14.1 R3, §12 A12/A13 |
| **C2** | Không có đường đọc `review_notes`; A11 và A4–A9 không thể cùng đúng | §6.5 (quyết định thiết kế + 3 lý do + phương án bị loại), §9 P3/P4 scope, §11.1 (guard test), §11.2 (test đường đọc), §12 A7b |
| **C3** | Mục manual QA không tồn tại; fixture không dựng được actor cần thiết | **Xác nhận một phần** — xem ghi chú riêng dưới bảng. §11.3 (mục mới + state matrix + một fixture outcome), §9 P2/P4/P5 scope, §14.2 S1 |
| **R3** | `grep -rn "/3"` là tiêu chí không đo được — khớp Tailwind `/30`, và `/3` không trích dẫn bị shell biến thành đường dẫn | §12 A3c (đổi sang literal có ngữ cảnh), §10.1 luật 2 |
| **S1** | F23 nằm trong bảng "Repository fact" nhưng nguồn là Owner, không phải repo | §3.4 ghi chú phân loại + ngày xác nhận + caveat |
| **S2** | §6.6a ghi "20 hit escalation" — không tái lập được | §6.6a → **23** dòng (`escalation`, không phân biệt hoa thường) / **25** dòng (`escalation\|rescue`) |
| **S3** | `TopicBuilderTabs.tsx` để ngỏ "trừ khi type đổi buộc phải sửa" | §9 P4 Out of scope → **chốt không sửa**, kèm bằng chứng 0 hit |

**Đã bác bỏ (không sửa, và đây là lý do):**

| Finding | Nội dung | Phán quyết |
| --- | --- | --- |
| **R2** | "Sau khi bỏ `cancel_escalation`, constraint còn nhận giá trị không code nào sinh ra" | **BÁC BỎ.** DDL cuối là `20260915130000:36` (4 giá trị). Bỏ `cancel_escalation` còn `{demote, takedown, invalidate_review}` — **cả ba** đều qua guard `:415` và đều tới `insert into platform_moderation_audits` (`:493-497`). Miền constraint **bằng** miền giá trị sinh ra; không có giá trị chết. Chi tiết + quan sát thật (effect-aliasing của `invalidate_review`, có test bảo vệ, **ngoài scope**) ở §6.4 ghi chú R2 |
| **S1 (một phần)** | Ngụ ý cần điều tra thêm về môi trường chia sẻ | **Đã đóng.** Owner xác nhận 2026-09-17; D8 được cấp phép. Chỉ còn việc sửa nhãn lớp bằng chứng, không phải điều tra |

**Điều đáng chú ý về chính vòng review này:** C1 và C2 không phải lỗi văn phong — chúng là **bất khả thi logic**. Người implement theo bản plan trước sẽ: (a) pass tiêu chí acceptance trong khi `CREATION_HOLD` còn sống, và (b) đâm tường ở P3/P4 vì UI đòi hiển thị thứ không có đường đọc. Cả hai đều nằm ở **cùng một file** (`app/actions/topic.ts`) mà bản plan trước **không hề nêu tên** — một file chứa cả lỗ hổng lẫn giải pháp. Đó là lý do hai finding riêng biệt lại hội tụ về một chỗ sửa.

**C3 xác nhận một phần — và vòng xác minh bắt được lỗi của CHÍNH BẢN NHÁP ĐẦU của mục này.** Kết luận `NOT READY` là đúng; hai lập luận dẫn tới nó thì sai:

| Bản nháp đầu của §11.3.1 nói | Sự thật đã đo lại |
| --- | --- |
| "Cả **hai** topic seed đều `published`" | **Sai.** Có **ba** nhóm topic; tồn tại một topic `draft` thật (`b2200000-…0311`). Nó **không dùng được** vì nằm ở khoá không có collaborator — kết luận không đổi, nhưng **lý do** thì khác hẳn, và lý do mới quan trọng hơn: sửa được bằng cách thêm topic vào khoá `44444444-…`, **không** phải bằng cách sửa khoá `b2000…` (sẽ lan sang fixture pagination của B2) |
| "`can_review_topics` bị **trigger chặn**" | **Sai.** Trigger là `before UPDATE` — không chạy khi INSERT. `false` đến từ `DEFAULT`. Nghĩa là thêm fixture là **một dòng seed**, không phải cuộc chiến với schema |
| "Repo-wide **0** chỗ set `can_review_topics` ngoài `__tests__/`" | **Phát biểu quá rộng.** [scripts/e2e/course-leave-navigation-fixture.mjs:59](scripts/e2e/course-leave-navigation-fixture.mjs#L59) có set — nhưng là `false`. Câu đúng phải là "0 chỗ set `true`", và phải quét cả `.mjs` |
| "Không có reviewer khác người tạo" | **Sai.** admin (`owner`) là reviewer hợp lệ khác người tạo → nhu cầu này **đã được đáp** |

Ba trong bốn dòng đó là **lỗi do tôi đọc chưa đủ sâu rồi kết luận sớm** — không phải lỗi của reviewer. Chúng được giữ nguyên trong bảng vì một plan tự sửa mà xoá dấu vết lần sai của mình thì lần sau sẽ lặp lại đúng chỗ đó. Cách phòng đã áp: mọi dòng của §11.3.1 giờ có `file:line` để kiểm lại được.

**Bài học đã áp vào chính plan này:** mọi tiêu chí acceptance từ nay phải **đo được bằng công cụ tất định** (AGENTS.md Rule 5). Lưới `escalation|rescue` và `grep "/3"` đều vi phạm điều đó — cái đầu mù, cái sau vừa pass giả vừa fail giả. §10.1 thay cả hai bằng literal định danh có trích dẫn, phủ cả SQL lẫn TS.

### 15.2 Khoảng trống còn lại của plan (đã ghi nhận, không giấu)

1. Chưa đọc hết nội dung `correction-plan.md` và `correction-plan-gemini.md` — chỉ xác định chúng mô tả hướng cũ qua tiêu đề và mật độ từ khóa. Vì cả hai đều bị supersede bởi D1–D13, việc không đọc toàn văn **không** ảnh hưởng contract của plan này, nhưng nghĩa là plan **không** loại trừ khả năng chúng chứa một finding đúng chưa được xét.
2. Chưa xác minh giả định §14.2 S1/S2 (cascade `topic_contributors`) — đã ghi là giả định cần verify ở Phase 2. **Lưu ý ký hiệu:** "S1/S2" ở §14.2 là *giả định*, khác "S1/S2" của vòng review ở §15.1 là *finding*. Hai không gian tên khác nhau trong cùng tài liệu — cố ý giữ nguyên để không đánh số lại §14.2.
3. Fixture readiness cho manual QA: xem §11.3 — đây là mục **đã được viết**, không còn là khoảng trống.
4. Chưa đọc 2 reference không match điều kiện: `master-plan-workflow.md`, `multi-agent-e2e-workflow.md` (không dùng managed mode), và các skill không được kích hoạt: `native-multi-agent-workflow`, `git-checkpoint-workflow`, `github-pr-ci-workflow`, `maintain-repo-skills`.

**Specialist review decision: 0 specialist.** Không có hard-risk signal nào từ domain skill ở tầng *plan* vượt quá khả năng của main review: đây là planning-only, không mutate gì, và mọi biên rủi ro (RLS mới, guard trigger, migration amendment) đều đã có verification tương ứng trong §10/§11. Các tín hiệu hard-risk của `supabase-safe-migration` (RLS boundary, `SECURITY DEFINER`, migration sửa trên dữ liệu có sẵn) áp cho **implementation**, sẽ được xét lại ở checkpoint đó.

**Kết quả self-review:** 6 finding tự phát hiện và **đã sửa trong plan** (helper đọc thiếu creator; guard trigger kiểm đích sai thời điểm; lệnh verify không tồn tại; bỏ bộ `latestRejection*` thay vì giữ song song; `rejectionCount` suy từ mảng thay vì `count(*)` riêng; `hour12: false` cho định dạng giờ). 1 finding **không** sửa được và đã ghi nhận trung thực (B2). Không phát hiện finding nào đòi đổi contract.

**Bổ sung ở lượt chốt D11–D13:** ba câu hỏi mở đã đóng (§14.4 rỗng), nên phép phản chứng quan trọng nhất của lượt này là: *"D13 có mâu thuẫn với D1/D7 không?"* — kiểm bằng cách đối chiếu ngôn ngữ UI. D1 bỏ **ngân sách** (ngưỡng chặn), D13 giữ **lịch sử** (thông tin). Hai thứ khác nhau: `rejectionCount` vẫn được expose nhưng không còn `canRequestReview` nào phụ thuộc nó. Không mâu thuẫn. Câu copy `"X/3 lần phản hồi"` là chỗ duy nhất hai khái niệm bị trộn, và nó đã bị liệt kê để xoá (§5.5).

---

## 16. Exclusions và stop conditions

### 16.1 Forbidden scope

* Không implementation, không commit, không push, không PR trong lượt này.
* Không `npx supabase db push`, không đụng remote/production DB.
* Không thêm RPC cho `review_notes` (D6).
* Không đổi `request_topic_review` / `approve_topic_review` / `reject_topic_review` ngoài phạm vi escalation (§5).
* Không thêm cơ chế chặn/gate mới thay cho `TOPIC_REVIEW_ESCALATION_HOLD` — Owner đã chốt không (D12).
* Không giới hạn/phân trang `rejectionHistory` ở lượt này (R5b) — chỉ ghi nhận.
* Không sửa `components/ui/*`, không đổi toast toàn cục, không thêm package/font/animation library.
* Không "dọn dẹp" các defect lân cận đã phát hiện (§14.2 giả định S1/S2, B2, và effect-aliasing của `invalidate_review` ở §6.4) — chỉ báo cáo.
* Không đổi ngữ nghĩa `moderate_platform_content` cho `demote` / `takedown` / `invalidate_review` (§6.4 ghi chú R2).
* Không đổi `d1_has_eligible_topic_reviewer`, `d1_has_distinct_topic_reviewer`, `d1_is_topic_reviewer_excluded`, `has_topic_review_access`, `d1_topic_group_member`, `can_modify_content_by_topic`.
* Không chạm `admin` / `services` / `lib/course-authoring/*` ngoài phần type bị ảnh hưởng.
* Không thêm smoke E2E scenario mới trừ khi Owner yêu cầu.

### 16.2 Stop conditions (dừng và báo, không tự quyết)

* Phát hiện cơ chế chặn thứ hai ngoài `TOPIC_REVIEW_ESCALATION_HOLD` → F1 sai, phải thiết kế lại.
* `db reset` fail vì một tham chiếu escalation không thể gỡ mà không đổi hành vi ngoài scope.
* RLS của `review_notes` không diễn đạt được biên D3/D5 bằng policy mà không cần RPC → mâu thuẫn với D6, phải hỏi Owner.
* Bất kỳ phát hiện nào cho thấy D1 **đã** lên một môi trường dùng chung → D8 mất điều kiện hợp lệ, phải chuyển sang migration gỡ xuôi.

### 16.3 Completion criteria của lượt này

Lượt này hoàn tất khi: tài liệu này tồn tại; `./plan.md` chưa bị sửa (chờ Owner approve); 3 draft cũ đã được đánh dấu STALE; memory đã được sửa; và báo cáo nêu rõ root mismatch, đường dẫn file, các phase, blocker, cùng danh sách skill đã dùng. **Không** commit.
