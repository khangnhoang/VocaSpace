---
title: "D1 Correction Plan (deepseek) — Rescue = Responsibility Takeover"
wave: D1
branch: feat/topic-publish-validation
parent: ./plan.md
status: "STALE — superseded; KHÔNG dùng làm contract"
superseded_by: "./correction-plan-deepseek-v2.md"
relationship: "Bản nháp cũ, giữ làm hồ sơ lịch sử. Mô hình rescue-as-takeover trong tài liệu này đã bị Owner bỏ hoàn toàn."
related_artifacts:
  - "./correction-plan-deepseek-v2.md (contract hiện hành; đã pass Owner review 2026-09-18)"
  - "./plan.md (D1 implementation contract trước amendment — Owner chốt KHÔNG reconcile ở bước này; sẽ xử lý khi P1–P5 land)"
  - "./correction-plan.md, ./correction-plan-gemini.md (draft song song, cũng đã STALE)"
---

> ⛔ **STALE — KHÔNG DÙNG LÀM CONTRACT.**
> Tài liệu này mô tả mô hình escalation / rescue / review-budget đã bị **bỏ hoàn toàn** theo quyết định của Owner.
> Contract hiện hành: [`correction-plan-deepseek-v2.md`](./correction-plan-deepseek-v2.md).
> Giữ lại chỉ để làm hồ sơ lịch sử. Mọi câu trong tài liệu này mô tả "rescue", "escalation", "takeover"
> hoặc ngưỡng từ chối 3 lần đều **không còn đúng**.

# D1 Correction Plan — Rescue là **tiếp quản trách nhiệm**, không phải "gửi hộ"

> Tài liệu này là **planning-only**: không thay đổi code, migration, test hay commit. Nó thuộc D1, không phải workstream mới.

## 0. Phân loại nguồn (evidence classification)

| Loại | Nội dung trong tài liệu |
| --- | --- |
| **Repository fact** | Đọc trực tiếp từ migration/action/component/test hiện tại, có `file:line`. |
| **Owner decision** | Contract rescue đã chốt trong yêu cầu hiện tại (creator ≠ responsible; rescue = takeover; 1 rescue/topic bị giữ; budget riêng của rescuer; 2 action còn lại; restore = Ctrl+Z; canonical read model). |
| **D1 plan decision** | Contract D1 đã approve trước đó trong `./plan.md` (P2 pending freeze, published demotion, moderation boundary, topic authorship…). |
| **Proposal (engineering gate)** | Tên bảng/cột/RPC, lock ladder, field DTO — do tài liệu này đề xuất, không phải Owner decision. |
| **Assumption** | Điều chưa chứng minh được bằng repository. |
| **Unresolved decision** | Cần Owner chốt trước khi implement (mục 11). |

---

## 1. Mục tiêu và authority

### 1.1 Kết quả quan sát được

Sau correction:

1. Một topic luôn có `creator` (A, immutable) **và** `responsible author` (D) là **hai identity khác nhau**; ban đầu `creator = responsible = A`. **Trước rescue, D có thể ≠ A** (một transfer thường đã xảy ra trước khi escalation hình thành) — khi đó escalation nguồn có `submitted_by_user_id = D`.
2. Khi responsible author nhận **3/3 rejection** thường, topic bị **hold**; owner/co-owner có thể **rescue**.
3. Rescue = **B tiếp quản trách nhiệm**: `creator = A` giữ nguyên, `responsible: D → B`. Rescue **không** tự động submit.
4. Trong rescue, editable set = **A + B + contributors hiện tại** — trong đó **A là creator**, không phải "người từng giữ trách nhiệm" D.
5. Reviewer phải độc lập với **creator A**, **responsible B**, **current contributors** — độc lập này áp dụng **vô điều kiện**; cộng thêm invariant loại trừ lịch sử trước first-approval (chỉ khi `first_approved_at is null`) mạnh hơn hiện có.
6. Một held topic chỉ được **một rescue**. Không rescuer thứ hai, không rescue chain.
7. Trong chính rescue đó, B có budget riêng: `1/3 → sửa → gửi lại`, `2/3 → sửa → gửi lại`, `3/3 → rescue thất bại`. Đây là các lần gửi lại **trong cùng một rescue**, không phải rescue mới.
8. Trong bất kỳ thời điểm nào của rescue, owner/co-owner có thể `Xóa bài học` hoặc `Khôi phục về bản nháp`.
9. Sau khi rescue đạt 3/3, **chỉ còn hai action đó**; không submit, không rescue thêm, **và không sửa nội dung thường**.
10. `Khôi phục về bản nháp` = Ctrl+Z của rescue đang hoạt động: `responsible: B → D` (người giữ trách nhiệm ngay trước takeover), topic → `draft`, B rời workflow đang hoạt động, active rescue/review state kết thúc, audit/history còn lại.
11. Canonical workflow state (rejection count hiện hành, latest rejection…) **không được thay đổi theo caller**. Role-specific capability flag được phép thay đổi.
12. Reviewer thường **không** hiển thị rejection budget; budget là ngữ cảnh workflow của authoring/management actor.

### 1.2 Authority

* Chỉ **planning**. Không implementation, không migration execution, không test change, không commit/push/PR.
* Remote migration / production-data mutation vẫn ngoài authority (kể cả phần reconciliation ở §5).
* `./plan.md` vẫn sở hữu D1 implementation contract; tài liệu này sở hữu **correction delta** và phải được merge ngược vào `./plan.md` khi Owner approve (§10).

---

## 2. Discovery hiện tại và root mismatch

### 2.1 Repository fact — rescue hiện tại là "submit hộ", không phải takeover

Rescue hiện hành nằm trong `resolve_topic_review_escalation(p_escalation_id, p_action, p_reason)` với `p_action = 'rescue'`:

```sql
-- supabase/migrations/20260917100000_d1_senior_review_corrections.sql:296-311
if p_action = 'rescue' then
  if v_escalation.submitted_by_user_id = v_user_id then raise exception 'TOPIC_REVIEW_RESCUE_FORBIDDEN'; end if;
  ...
  select coalesce(max(s.attempt_number), 0) + 1 into v_attempt_number
  from public.topic_review_submissions s
  where s.topic_id = v_topic.id and s.submitted_by_user_id = v_user_id;
  insert into public.topic_review_submissions (topic_id, submitted_by_user_id, status, attempt_number, rescue_escalation_id)
  values (v_topic.id, v_user_id, 'pending', v_attempt_number, v_escalation.id) returning * into v_submission;
  perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
  update public.topics set status = 'pending' where id = v_topic.id;
```

Xác nhận độc lập (không chỉ dựa vào báo cáo trước):

* Rescue **ghi một submission `pending`** với `submitted_by_user_id = B` và `rescue_escalation_id = escalation.id`.
* Rescue **không** chạm `topics.responsible_author_user_id`. `responsible_author_user_id` chỉ được ghi bởi `d1_transfer_topic_responsibility_locked` (`20260917100000:86-88`) và bởi backfill/insert topic; grep toàn bộ `supabase/migrations/*.sql` xác nhận không có đường rescue nào khác.
* ⇒ Trạng thái sau rescue hiện tại: **`creator = A`, `responsible = A`, `submitted_by = B`** — đúng drift được báo cáo.
* Rescue hiện tại là **submit ngay**, không có bước "B nhận trách nhiệm → sửa → gửi".
* Không có guard "một rescue cho mỗi held episode". Guard duy nhất là `TOPIC_REVIEW_ALREADY_PENDING` (`:304`) và unique index `topic_review_escalations_open_topic_submitter_idx` (`20260917110000:10-12`) — cả hai đều **hết hiệu lực** ngay khi rescue submission bị reject (không còn pending), nên rescue thứ hai/ thứ n có thể bắt đầu.
* `resolve_topic_review_escalation` vẫn giữ `p_action in ('rescue','close','abandon')` (`:281`).

### 2.2 Chuỗi hệ quả — tất cả từ **một** root mismatch

Drift không phải tập bug rời; nó là hệ quả tất yếu của việc đồng nhất "rescue" với "submission của B":

> **Quy ước ký hiệu trong bảng này:** vì §2.2 mô tả **hiện trạng đang drift**, `A` ở đây nghĩa là **người giữ trách nhiệm trước rescue** (= **D** trong hệ ký hiệu ba identity ở §3.1). Trong ca phổ biến `D = creator`, hai cách gọi trùng nhau; ở ca có transfer trước escalation thì `A` trong bảng này chính là **D**. Bảng dùng `A` để khớp với code hiện tại (`responsible_author_user_id`), không phải để đồng nhất D với creator.

| # | Hệ quả quan sát được | Vì sao suy ra từ root |
| --- | --- | --- |
| D1 | **B không sửa được topic trong rescue.** `canEdit = d1_topic_group_member(...)` (`20260917110000:140`), predicate chỉ nhận `responsible_author_user_id` hoặc `topic_contributors` active (`20260916130000:56-92`, `:81-90`). B không nằm trong cả hai ⇒ `canEdit = false`. | Rescuer không được đưa vào group vì không có takeover. |
| D2 | **B không gửi lại được.** `request_topic_review` yêu cầu `v_topic.responsible_author_user_id = v_user_id` (`20260917100000:218` → `TOPIC_RESPONSIBLE_AUTHOR_REQUIRED`) **và** không có escalation unresolved (`:219-222`). Trong rescue, escalation nguồn vẫn `unresolved` ⇒ B bị chặn bởi cả hai điều kiện. | Hold gắn với A, còn submit quyền gắn với responsible. |
| D3 | **A vẫn `canEdit = true` nhưng không submit được** (`responsible` vẫn là A, nhưng `TOPIC_REVIEW_ESCALATION_HOLD` chặn). Topic rơi vào trạng thái ai cũng không đẩy tiếp được. | Hai quyền (edit và submit) trỏ vào hai identity khác nhau. |
| D4 | **Rescue lặp vô hạn.** Không có guard nào chặn rescue thứ hai sau khi rescue đầu bị reject. | Rescue không có identity/row riêng để "chỉ tồn tại một". |
| D5 | **Budget rejection không thuộc rescue.** `reject_topic_review` đếm theo `topic + submitted_by_user_id` và mốc `resolved_at` của episode đã resolve của **chính submitter đó** (`20260917110000:57-68`); ở 3/3 nó **tạo thêm một escalation mới** (`:70-77`). Với rescue, không có "episode" nào của B được resolve ⇒ budget của B trôi nổi và có thể sinh escalation thứ hai song song. | Budget scope là `topic+submitter`, không phải "rescue". |
| D6 | **Read model phụ thuộc caller.** `get_topic_workflow_state` lọc `s.submitted_by_user_id = v_user_id` cho `latestRejection*` và `rejectionCount` (`20260917110000:155-168`, `:181-186`, `:247-250`). Cùng một topic: A thấy `2/3` + lý do; reviewer thấy `0` + `null`. Test hiện tại **assert đúng hành vi sai này** (`__tests__/integration/topic-review-lifecycle.test.ts:495-512`: teacher `rejectionCount: 1`, student `0`). | Read model trộn "state của topic" với "state của tôi". |
| D7 | **Trường escalation lại canonical, trường rejection lại caller-scoped** trong cùng một DTO (`escalationId`/`escalationSubmitterId` lấy escalation unresolved mới nhất của topic — `:188-192`, `:253-254`). Mixed scope, không có dấu hiệu phân biệt trong schema. | Hệ quả của việc thêm dần field theo từng bug. |
| D8 | **Không có "hai action còn lại" sau rescue 3/3.** UI hiện chỉ có `Gửi nhờ người duyệt khác` / `Hủy yêu cầu và về bản nháp` / `Kết thúc xử lý và về bản nháp` / `Ẩn bài học`. | Chưa có khái niệm "rescue failed" là trạng thái terminal. |
| D9 | **`Khôi phục về bản nháp` không tồn tại ở application layer.** RPC `d1_restore_topic` có (`20260916140000:248-288`) nhưng **không có Server Action, không có `rpc("d1_restore_topic")`, không có UI** trong `app/` và `lib/`. | Chưa có rescue để "Ctrl+Z". |
| D10 | **Owner/co-owner không phải group member không `Xóa bài học` được.** `d1_delete_topic` → `d1_prepare_topic_content_mutation` yêu cầu `d1_topic_group_member` (`20260916140000:224-226`). Trong rescue, B là responsible nên qua được, nhưng co-owner C (không trong group) thì không — trái với "owner/co-owner may at any point". | Quyền delete/restore đang gắn với topic group, không gắn với rescue episode. |
| D11 | **"Rescue failed" không tồn tại như một trạng thái, nên 3/3 không khóa được gì.** Sau lần reject thứ 3 của B, topic về `draft` và `d1_topic_group_member` vẫn trả `true` cho responsible ⇒ normal edit vẫn mở. | Không có entity rescue ⇒ không có trạng thái `failed` để bám vào. |
| D12 | **Không có gì để reconstruct.** Vì rescue không được mô hình hóa, một rescue đã bị reject để lại **không dấu vết nào** ngoài vài `topic_review_submissions` có `rescue_escalation_id`; escalation vẫn `unresolved`. Đây chính là lỗ hổng khiến `start_topic_rescue` có thể chạy lần hai sau deploy (§5.2). | Rescue được biểu diễn gián tiếp qua submission, không qua identity riêng. |
| D13 | **Hai identity A và D bị gộp không thể tách.** Vì không có chỗ lưu "ai giữ trách nhiệm trước takeover", một `Khôi phục về bản nháp` (nếu có) buộc phải đoán giữa creator và pre-rescue responsible. | Việc rescue không ghi lại `previous_responsible` khiến Ctrl+Z mất cơ sở. |

**Kết luận root mismatch:** repository đang mô hình hóa rescue bằng **submission của người khác** (`submitted_by = B`) trong khi giữ nguyên **trách nhiệm** ở người giữ trước đó (**D**). Mọi hệ quả D1–D13 đều suy ra từ đó — kể cả những cái trông như bug độc lập: rescue lặp (D4, D12), budget trôi nổi (D5), read model theo caller (D6), 3/3 không khóa được (D11), và việc không thể tách A khỏi D (D13). Correction phải là **một state-machine/authorship fix xuyên suốt**, không phải sửa từng triệu chứng.

### 2.3 Repository fact — những gì ĐÃ đúng và phải giữ

* `topics.original_creator_user_id` / `responsible_author_user_id` / `first_approved_at` đã tồn tại và được bảo vệ: direct write của `authenticated` bị `42501`, `original_creator` immutable (`TOPIC_ORIGINAL_CREATOR_IMMUTABLE`), responsible `NOT NULL` (`20260916120000:25-27`; test `__tests__/integration/topic-authorship-foundation.test.ts:151-185`, `:246-259`).
* Exclusion lịch sử trước first-approval: `topic_author_review_exclusions` với `exclusion_type in ('original_creator','initial_contributor','preapproval_responsible')` (`20260916120000:57-68`); `original_creator` mint lúc tạo topic (`:274`), `initial_contributor` mint khi add contributor (`20260916130000:448-460`), `preapproval_responsible` mint khi transfer (`20260917100000:64-76`). Đây là invariant **mạnh hơn** cần được bảo toàn khi thêm rule "reviewer ≠ current contributors".
* Review/escalation tables là **service_role-only + RPC-mediated**: RLS bật, `revoke all ... from anon, authenticated` (`20260915090000:160-167`).
* Boundary transfer đã atomic, có lock, có transfer history + feedback: `d1_transfer_topic_responsibility_locked(p_topic_id, p_recipient_user_id, p_actor_user_id, p_allow_unrelated_owner_recipient)` (`20260917100000:6-133`) — guard `TOPIC_PENDING_FROZEN`, recipient phải là collaborator `owner|co_owner|editor`, self-take chỉ owner/co_owner, ghi `preapproval_responsible` cho responsible cũ, xóa contributor row của recipient, set responsible mới, ghi feedback khi `recipient ≠ actor`. **Đây là primitive nên tái sử dụng cho takeover** thay vì viết lại logic transfer trong rescue.
* Pending freeze, published demotion, moderation boundary, readiness derivation vẫn hợp lệ và **không** thuộc correction này.

### 2.4 Trạng thái hai draft correction plan hiện có

Hai file `correction-plan.md` (Doc C) và `correction-plan-gemini.md` (Doc G) đã được tạo trong session trước, **cùng hướng contract đã sửa** (không có file nào bảo vệ contract cũ). Tài liệu này kế thừa phần đúng và loại bỏ các điểm sau:

| Vấn đề trong draft cũ | Xử lý trong tài liệu này |
| --- | --- |
| Cả hai dùng phase `P0-C → P4-C` | **Loại bỏ.** `plan.md:473` bắt buộc amendment reopen là `P0-A → P1-A → P2-A → P3-A → P4-A`. Không tạo alphabet thứ ba (§7). |
| Doc G backfill "đồng bộ `responsible = submitted_by`" cho mọi row cũ (`correction-plan-gemini.md:544`) | **Loại bỏ.** Chỉ re-align khi evidence chứng minh được đó là rescue takeover; còn lại fail-closed + quarantine (§5). |
| Doc G dùng `resolution_action = 'restored_to_draft'` / `'legacy_drift_reconciled'` (`:372`, `:552`) | **Không hợp lệ**: check constraint sống chỉ cho `('rescue','close','abandon','moderation')` (`20260915130000:26-29`). Phải widen constraint trước (§4.1). |
| Doc G rewrite `d1_is_topic_reviewer_excluded` nhưng không restate grant | Hiện chỉ `service_role` được execute (`20260916130000:125-126`). Plan yêu cầu giữ nguyên grant (§4.3). |
| Doc C để ngỏ "giữ B là responsible nếu Owner contract yêu cầu" | Owner contract đã chốt: B **là** responsible sau takeover (§3.3). |
| Cả hai bỏ sót `d1_topic_group_member_for_restore` và quyền owner/co-owner không thuộc group (D10) | Đưa vào §4.3 và §4.7. |
| Cả hai không có idempotency/version token cho stale-action | Đưa vào §6. |

---

## 3. Target contract (Owner decision)

### 3.1 Identity invariant

```text
creator(A)  : immutable, đặt lúc tạo topic, không đổi trong mọi đường (kể cả rescue)
responsible : đúng một, đổi được qua trusted boundary (transfer thường HOẶC rescue takeover)
contributors: 0..2 active, không tính responsible
```

Khởi tạo: `creator = A`, `responsible = A`, `contributors = C1/C2 nếu có`.

**Ba identity phải phân biệt được (không được gộp):**

| Ký hiệu | Là gì | Nguồn sự thật |
| --- | --- | --- |
| **A** | `original_creator_user_id` — người tạo topic, immutable | `topics.original_creator_user_id` |
| **D** | responsible **ngay trước takeover** = `escalation.submitted_by_user_id` | `topic_review_rescues.previous_responsible_user_id` lưu lại |
| **B** | rescuer = responsible **sau takeover** | `topics.responsible_author_user_id` + `topic_review_rescues.rescuer_user_id` |

`D ≠ A` là **reachable** và không phải ca hiếm: `transfer_topic_responsibility` cho phép owner/co_owner chuyển trách nhiệm trước first-approval (`20260916130000:515-547`, ghi exclusion `preapproval_responsible`), và `d1_transfer_member_topic_responsibilities` chuyển trách nhiệm khi một member rời course (`20260917100000:138-186`). Sau đó D submit, nhận 3/3, và escalation mang `submitted_by_user_id = D`.

**Hệ quả bắt buộc:** mọi chỗ trong tài liệu này dùng "A" phải đọc là **creator**, không phải "người từng giữ trách nhiệm". Chỗ nào cần D thì gọi đúng tên D. Việc dùng `previous_responsible` như proxy cho creator là **sai** và đã được sửa ở §4.3.

**Invariant bắt buộc:** trong mọi trạng thái, kể cả đang rescue, `responsible` là **một user active là collaborator** của course; không có cửa sổ nào topic thiếu responsible.

### 3.2 Ordinary episode (giữ như D1 hiện có)

```text
draft → (request review, responsible-only, ready)      → pending
pending → approve (reviewer ≠ submitter, effective)     → published
pending → reject  (reason bắt buộc)                     → draft + count++
reject thứ 3 của cùng submitter                         → hold (escalation unresolved)
```

Budget ordinary scope = `topic + submitted_by` trong episode hiện hành. Không đổi.

### 3.3 Rescue = tiếp quản trách nhiệm (Owner decision)

```text
[start rescue]  owner/co_owner B, B ≠ D
                creator: A (không đổi)
                responsible: D → B        ← takeover thật, atomic
                topic: giữ draft, KHÔNG submit, KHÔNG pending
                escalation nguồn: vẫn unresolved (topic vẫn bị hold)
                tạo rescue record (status = active, previous_responsible = D)

[B sửa topic]   editable = A (creator) + B (responsible) + current contributors
                A giữ quyền sửa nhưng KHÔNG có quyền submit — submit là responsible-only
                D KHÔNG có quyền sửa trong rescue, trừ khi D đồng thời là A hoặc contributor

[B gửi duyệt]   submission của B, gắn với rescue đang active
                reviewer C: loại trừ A, B, current contributors (vô điều kiện)
                            + exclusion lịch sử pre-first-approval (giữ nguyên)
                pending freeze vẫn áp dụng

reject 1/3      → draft, rescue rejection (derive) = 1, B sửa và gửi lại (vẫn cùng rescue)
reject 2/3      → draft, rescue rejection (derive) = 2, B sửa và gửi lại (vẫn cùng rescue)
reject 3/3      → rescue.status = failed; topic vẫn held
                  CHỈ còn: Xóa bài học | Khôi phục về bản nháp
                  không submit, không rescue thêm, không sửa nội dung thường

approve         → published; rescue.status = approved; escalation nguồn resolved
                  responsible vẫn là B (takeover là thật, không rollback sau approve)
```

> Ghi chú có chủ đích: trong lúc rescue, **D mất quyền sửa** (D không nằm trong `A + B + contributors`) nhưng **lấy lại** khi restore xong. Đây là hệ quả trực tiếp của contract "editable = creator + responsible + contributors", không phải sót.

### 3.4 Single-rescue invariant (Owner decision)

* Một **held episode** (một escalation row) chỉ được **một rescue**, kể cả khi rescue đó đã `failed`/`restored`/`deleted`: không có rescuer thứ hai, không rescue chain trên cùng episode.
* Trong **toàn bộ** topic, tại một thời điểm chỉ có **tối đa một rescue `active`**.

### 3.5 Hai action còn lại và restore semantics (Owner decision)

| Action | Wording người dùng | Semantics |
| --- | --- | --- |
| `Xóa bài học` | **chính xác** `Xóa bài học` | soft-delete/hide (`removed_at`) là chấp nhận được ở backend, nhưng wording người dùng là `Xóa bài học`. Kết thúc episode: hủy pending submission nếu có, `rescue.status = deleted` (**terminal cho rescue này**), resolve escalation nguồn, **giải phóng creation hold** của D. Trách nhiệm **không** rollback: B vẫn là responsible. |
| `Khôi phục về bản nháp` | **chính xác** `Khôi phục về bản nháp` | Ctrl+Z của rescue đang hoạt động: `responsible: B → D`; topic → `draft`; B rời active workflow; hủy pending submission nếu có; `rescue.status = restored`; resolve escalation nguồn; active rescue/review state kết thúc; **audit/history giữ nguyên** (không xóa row nào). |

Cả hai action có hiệu lực **trong suốt** rescue (không chỉ sau 3/3), và là **duy nhất** còn lại sau 3/3.

**Restore target là D, không phải A.** Lý do: restore là Ctrl+Z — nó phải hoàn tác **đúng** takeover, tức trả trách nhiệm về người giữ nó ngay trước rescue, và đó chính là giá trị đã được lưu ở `topic_review_rescues.previous_responsible_user_id`. Trả về creator A (khi `A ≠ D`) không phải undo mà là **một lần transfer mới**. Vì điều này quyết định authorship sau restore và prose gốc của Owner viết "B → A" (trường hợp suy biến `A = D`), nó được ghi thành **UD-3** ở §11.1 để Owner xác nhận — plan implement theo D.

**`deleted` là terminal của rescue, không phải của topic.** Sau `Xóa bài học`, rescue kết thúc vĩnh viễn; topic vẫn có thể được đưa lại bằng đường topic-restore hiện có và khi đó quay về vòng đời draft bình thường với episode mới (§3.4, khớp UD-1 đã chốt). Restore-về-bản-nháp **không** áp dụng cho rescue đã `deleted` — xem §4.2 và finding 7 ở §12.2b.

### 3.6 Reviewer independence (Owner decision + kế thừa D1)

Reviewer C của một submission phải thỏa **đồng thời** hai nhóm điều kiện **độc lập** — không được gộp chúng dưới một cổng chung:

```text
(a) Dynamic exclusion — ÁP DỤNG VÔ ĐIỀU KIỆN, ở mọi submission đang được duyệt:
    C ≠ submission.submitted_by                       (no-self-review — đã có, giữ nguyên)
    C ≠ topics.original_creator_user_id               (creator A)
    C ≠ topics.responsible_author_user_id             (D trước rescue, B trong/sau rescue)
    C ∉ current active contributors
    C ∉ {rescuer_user_id, previous_responsible_user_id} của rescue đang active/failed

(b) Historical pre-first-approval exclusion — CHỈ khi topics.first_approved_at is null:
    C ∉ topic_author_review_exclusions (original_creator | initial_contributor | preapproval_responsible)
```

**Đây là điểm đã sửa (finding 3).** Hiện tại `d1_is_topic_reviewer_excluded` ([20260916130000:107-123](supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql#L107-L123)) bọc **toàn bộ** predicate trong `t.first_approved_at is null and (...)` — kể cả `original_creator_user_id` và `responsible_author_user_id` ở dòng 111-114. Hệ quả: **sau lần publish đầu tiên, không còn exclusion nào cả**; một topic đã từng publish có thể để chính responsible author hoặc contributor của nó duyệt bài. Nhóm (a) phải được **nhấc ra khỏi** cổng `first_approved_at`, nhóm (b) giữ nguyên trong cổng đó.

Rủi ro kèm theo (đã ghi ở §11.3): sau publish, tập reviewer hợp lệ thu hẹp còn "collaborator không phải A, D/B, và không phải contributor hiện tại" ⇒ course nhỏ có thể không còn reviewer nào và gặp `TOPIC_REVIEW_NO_ELIGIBLE_REVIEWER`. Đây là hệ quả **có chủ đích** của contract, không phải lỗi; D1 đã có sẵn mã lỗi đó.

### 3.7 Canonical vs capability (Owner decision)

| Nhóm | Đặc tính | Ví dụ field |
| --- | --- | --- |
| **Canonical workflow state** | **Giống nhau với mọi caller** | `status`, `activeFlashcardCount`, `activeExerciseCount`, `isReady`, `creator`, `responsibleAuthor`, `contributors`, `episodeType`, `rejectionCount`, `rejectionLimit`, `latestRejection*`, `escalation*`, `rescue*`, pending submission identity |
| **Capability / role flag** | Được phép khác theo caller | `role`, `canEdit`, `canReview`, `canRequestReview`, `canStartRescue`, `canCloseOrAbandonEpisode`, `canDeleteTopic`, `canRestoreRescueToDraft`, `canViewRejectionBudget`, `hasDistinctEligibleReviewer`, `isCurrentUser*`, `canManageAuthorship` |

* `canViewRejectionBudget` là **capability**, không phải hằng true và không phải mặc định false. Budget là ngữ cảnh workflow cho **authoring/management actor** (creator, responsible, rescuer, current contributors, owner/co-owner theo state áp dụng); **reviewer thường không thấy** để tránh bias khi phán xử. Định nghĩa đầy đủ ở §4.5.
* `latestAuthorshipFeedback` là **notice cá nhân** (lọc theo `recipient_user_id`) — được giữ viewer-scoped **có chủ đích**, và phải được ghi rõ trong DTO/schema là viewer-scoped để không bị nhầm là workflow state.

---

## 4. Thiết kế correction theo lớp

### 4.1 DB/state (Proposal — engineering gate)

**(a) Bảng mới `topic_review_rescues`** — rescue trở thành entity có identity:

```sql
create table public.topic_review_rescues (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  source_escalation_id uuid not null references public.topic_review_escalations(id),
  rescuer_user_id uuid not null references public.profiles(id),
  previous_responsible_user_id uuid references public.profiles(id) on delete set null, -- A, để Ctrl+Z
  previous_creator_user_id uuid references public.profiles(id) on delete set null,       -- A tại thời điểm takeover (audit)
  status text not null default 'active',
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  ended_by_user_id uuid references public.profiles(id) on delete set null,
  end_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint topic_review_rescues_status_check
    check (status in ('active','approved','failed','restored','deleted')),
  constraint topic_review_rescues_rescuer_not_previous_check
    check (previous_responsible_user_id is null or rescuer_user_id <> previous_responsible_user_id)
);

-- Single-rescue: mỗi held episode chỉ một rescue, kể cả đã terminal (no rescue chain).
create unique index topic_review_rescues_source_escalation_idx
  on public.topic_review_rescues (source_escalation_id);
-- Tối đa một rescue active trên mỗi topic.
create unique index topic_review_rescues_one_active_topic_idx
  on public.topic_review_rescues (topic_id) where status = 'active';
-- Ràng buộc kép: rescue failed phải chạm trần budget.
create index topic_review_rescues_topic_idx on public.topic_review_rescues (topic_id, started_at desc);
```

RLS: `enable row level security`, `revoke all ... from public, anon, authenticated`, `grant all ... to service_role` — theo đúng pattern của `topic_review_submissions` (`20260915090000:160-167`). Không mở read trực tiếp cho client.

**(b) `topic_review_submissions.rescue_id`** — SSOT mới cho "submission thuộc rescue nào":

```sql
alter table public.topic_review_submissions
  add column rescue_id uuid references public.topic_review_rescues(id) on delete set null;
create index topic_review_submissions_rescue_idx
  on public.topic_review_submissions (rescue_id) where rescue_id is not null;
```

`rescue_escalation_id` (`20260915130000:14-20`) trở thành **legacy, chỉ đọc**: code mới **không** ghi và **không** đọc nó; escalation linkage lấy qua `topic_review_rescues.source_escalation_id`. Lý do: hai cột cùng nghĩa "rescue" là hai nguồn sự thật. Không drop cột trong correction này (giữ lịch sử), nhưng mọi logic mới phải qua `rescue_id`.

**(c) Widen check constraint** (bắt buộc trước mọi ghi `resolution_action` mới):

```sql
alter table public.topic_review_escalations
  drop constraint if exists topic_review_escalations_resolution_action_check;
alter table public.topic_review_escalations
  add constraint topic_review_escalations_resolution_action_check check (
    resolution_action is null
    or resolution_action in ('rescue','close','abandon','moderation','restore','delete')
  );
```

Theo đúng cách `20260915130000:22-29` đã làm khi thêm `'moderation'`.

**(d) Budget **derive**, không **store** — bắt buộc theo precedent của repo**

`topic_review_escalations.rejection_count` (`20260915090000:109`) chỉ được ghi lúc INSERT và **không bao giờ** được increment; bản `20260917110000_d1_manual_qa_corrections.sql:57-77` đã **bỏ** hướng "upsert snapshot" của `20260915100000:762-768` và chuyển sang **đếm `COUNT(*)`** rejected submissions. Đây là precedent đúng và correction phải theo:

```text
rescueRejectionCount(rescue) := count(*) from topic_review_submissions
                                 where rescue_id = rescue.id and status = 'rejected'
```

Không thêm cột `rejection_count` vào `topic_review_rescues` (đã loại khỏi DDL ở (a)). Lý do: một counter được lưu song song với dữ liệu nguồn là **đúng loại hai-nguồn-sự-thật** mà chính correction này đang loại bỏ ở `rescue_escalation_id`; thêm nó vào sẽ tái tạo drift tương tự. `rescue.status` thì **được lưu** vì nó là một **lifecycle fact** (`failed` không suy ra được chỉ từ count nếu restore/delete xen vào), không phải một phép đếm.

**(e) Hằng số budget ở tầng DB**

```sql
create or replace function public.d1_topic_review_rejection_limit()
returns integer language sql immutable as $$ select 3 $$;
```

Mọi nơi (`reject_topic_review`, `get_topic_workflow_state`) so sánh với `d1_topic_review_rejection_limit()` thay vì literal `3` rải rác (`20260917110000:70` hardcode `>= 3`; `TopicWorkflowPanel.tsx:215` hardcode `/3` trong JSX). DTO trả `rejectionLimit` để UI không tự bịa.

**(f) `topics`**: không thêm cột nào. `responsible_author_user_id` đã đủ; rescue state nằm ở bảng riêng với đúng một active row/topic.

### 4.2 RPC boundaries

| RPC | Trạng thái | Thay đổi |
| --- | --- | --- |
| `start_topic_rescue(p_escalation_id uuid, p_reason text)` | **MỚI** | Takeover + tạo rescue. Không submit. |
| `request_topic_review(p_topic_id uuid)` | Sửa | Thêm nhánh rescue cho B. |
| `reject_topic_review(p_submission_id uuid, p_reason text)` | Sửa | Budget scope theo rescue khi `rescue_id is not null`. |
| `approve_topic_review(p_submission_id uuid)` | Sửa | Nhánh rescue qua `rescue_id`; kết thúc rescue. |
| `resolve_topic_review_escalation(p_escalation_id, p_action, p_reason)` | Sửa | **Bỏ hẳn** `p_action = 'rescue'`; giữ `close`/`abandon` **chỉ khi chưa có rescue**. |
| `restore_topic_rescue(p_rescue_id uuid, p_reason text)` | **MỚI** | Ctrl+Z: `responsible: B → D`. |
| `delete_topic_rescue(p_rescue_id uuid, p_reason text)` | **MỚI** | `Xóa bài học` trong rescue. |
| `get_topic_workflow_state(p_topic_id uuid)` | Sửa | Canonical/capability split + rescue block. |
| `d1_topic_group_member(uuid)` / `d1_topic_group_member_for_restore(uuid)` | Sửa | Thêm **creator A** khi rescue `active`; chặn khi rescue `failed`; bỏ `previous_responsible`. |
| `d1_is_topic_reviewer_excluded(uuid, uuid)` | Sửa | Tách dynamic (vô điều kiện) khỏi historical (pre-first-approval). |
| `d1_prepare_topic_content_mutation` / `d1_delete_topic` / `d1_restore_topic` | Sửa | Chặn đường content/delete/restore chung khi rescue `active\|failed`. |
| `d1_transfer_topic_responsibility_locked(...)` | **Không đổi** | Được tái sử dụng bên trong `start_topic_rescue`. |
| `d1_topic_rescue_state(uuid)` | **MỚI (helper)** | Trả `'none' \| 'active' \| 'failed' \| 'ended'` — một nguồn duy nhất cho mọi guard rescue. |

**`start_topic_rescue` — logic bắt buộc:**

1. `AUTH_REQUIRED`; reason bắt buộc, `<= 2000`.
2. Lock ladder: `pg_advisory_xact_lock(hashtext(course_id))` → `pg_advisory_xact_lock(hashtext(topic_id))` → `select ... for update` escalation → topic (đúng ladder hiện có, `20260917100000:289-292`).
3. Guards (fail-closed, mã lỗi ổn định):
   * escalation tồn tại và `unresolved` → `TOPIC_REVIEW_ESCALATION_STALE`;
   * caller là `owner`/`co_owner` active → `TOPIC_REVIEW_ESCALATION_FORBIDDEN`;
   * `v_escalation.submitted_by_user_id <> v_user_id` → `TOPIC_REVIEW_RESCUE_FORBIDDEN` (**B ≠ D**);
   * **`v_escalation.submitted_by_user_id = v_topic.responsible_author_user_id`** → nếu không, `TOPIC_REVIEW_RESCUE_IDENTITY_MISMATCH`. Đây là guard **xác lập D**: escalation nguồn phải thuộc đúng người đang giữ trách nhiệm tại thời điểm takeover, nếu không thì `previous_responsible_user_id` sẽ không đáng tin và Ctrl+Z mất cơ sở;
   * topic `removed_at is null` và `status = 'draft'` → `TOPIC_NOT_DRAFT`;
   * không có unresolved escalation khác cho topic → `TOPIC_REVIEW_ESCALATION_HOLD`;
   * không có rescue `active` cho topic và không tồn tại rescue row với `source_escalation_id` này (kể cả terminal) → `TOPIC_REVIEW_RESCUE_ALREADY_STARTED`;
   * không có submission `pending` → `TOPIC_REVIEW_ALREADY_PENDING`.
4. Takeover: `v_previous_responsible := v_topic.responsible_author_user_id` (= `v_escalation.submitted_by_user_id` theo guard trên = **D**), rồi `perform public.d1_transfer_topic_responsibility_locked(p_topic_id, v_user_id, v_user_id, false);`
   → tự động: ghi `preapproval_responsible` exclusion cho **D** (`20260917100000:64-76`), xóa contributor row của B nếu có, set `responsible = B`, không ghi feedback cho self-take (đúng D1 contract "actor tự nhận không tự gửi notification cho chính mình").
5. `insert into topic_review_rescues (topic_id, source_escalation_id, rescuer_user_id, previous_responsible_user_id, previous_creator_user_id, status) values (..., D, v_topic.original_creator_user_id, 'active')` — không ghi counter nào (§4.1d). Lưu **cả** D và A để phân biệt được hai identity (§3.1).
6. Trả `{status:'rescue_started', course_id, topic_id, rescue_id, escalation_id, previous_responsible_user_id, rescuer_user_id}`. **Không** set `topics.status = 'pending'`.

**`request_topic_review` — nhánh rescue:**

```text
nếu tồn tại rescue active cho topic:
  caller phải = rescue.rescuer_user_id                  → TOPIC_RESPONSIBLE_AUTHOR_REQUIRED
  rescue.status = 'active'
  derived rejection count < d1_topic_review_rejection_limit()  → TOPIC_REVIEW_RESCUE_FAILED
  topic active + draft + ready                           → TOPIC_* như cũ
  không có pending submission                            → TOPIC_REVIEW_ALREADY_PENDING
  có ít nhất một reviewer hợp lệ khác B                   → TOPIC_REVIEW_NO_ELIGIBLE_REVIEWER
  insert submission (rescue_id = rescue.id, submitted_by = B)
  update topics set status = 'pending'
ngược lại: nhánh ordinary giữ nguyên (responsible-only).
```

Trong rescue, `TOPIC_REVIEW_ESCALATION_HOLD` **không** áp dụng cho B (B đi qua đường rescue); hold vẫn chặn mọi đường ordinary.

**`reject_topic_review`:**

```text
nếu v_submission.rescue_id is not null:
  (lock rescue row for update; rescue.status phải = 'active' → TOPIC_REVIEW_RESCUE_STALE)
  set submission rejected (+reviewed_by/at/reason); topics.status := 'draft'
  v_rescue_count := count(*) rejected submissions where rescue_id = v_submission.rescue_id   -- derive
  if v_rescue_count >= d1_topic_review_rejection_limit()
     → rescue.status := 'failed', ended_at/by, end_reason
  KHÔNG tạo escalation mới, KHÔNG chạm escalation nguồn
ngược lại: logic episode hiện có giữ nguyên (đếm theo topic+submitter, tạo escalation ở 3/3)
```

Điểm này xóa D5: budget của B thuộc **rescue**, không trôi nổi và không sinh escalation thứ hai. Vì không tạo escalation thứ hai, deadlock "hai escalation unresolved" (xem §4.2.1) không thể phát sinh từ đường rescue.

**`resolve_topic_review_escalation`**: bỏ nhánh `'rescue'`; `p_action` chỉ còn `('close','abandon')`; giữ nguyên phần cancel pending + `set status='draft'` + resolve escalation; giữ `'moderation'` cho đường admin (không do RPC này ghi).

**Thứ tự ưu tiên khi vừa có rescue vừa có escalation (finding 9 — đã chốt, không còn là câu hỏi mở):**

```text
escalation unresolved && CHƯA có rescue  -> close/abandon còn hợp lệ (đường thoát trước rescue)
escalation unresolved && ĐÃ có rescue    -> close/abandon bị từ chối:
                                            TOPIC_RESCUE_ACTIONS_REQUIRED
                                            (chỉ còn restore_topic_rescue | delete_topic_rescue)
```

* Lý do: sau khi rescue bắt đầu, hai action quản trị duy nhất là `Khôi phục về bản nháp` và `Xóa bài học`. Để `close`/`abandon` cùng tồn tại sẽ thành **4 action** và mâu thuẫn contract.
* Guard này **không** chặn admin moderation: `moderate_platform_content` resolve escalation qua helper riêng `d1_resolve_topic_escalations_for_moderation` (`20260915130000:73-97`), không đi qua `resolve_topic_review_escalation`. Đã kiểm để chắc chắn không tạo deadlock cho admin.
* Guard này cũng đóng luôn đường `abandon` set `removed_at` trong lúc rescue — một trong hai đường khiến "clear `removed_at`" ở §3.5 trở nên reachable (finding 7).

### 4.2.1 Lỗi hiện có phải sửa cùng lúc (precondition, không phải bug rời)

Hai defect dưới đây nằm ở **nhánh ordinary** của `reject_topic_review`, nhưng phải sửa trong cùng correction vì chúng chặn chính contract rescue:

| Defect | Bằng chứng | Vì sao chặn rescue |
| --- | --- | --- |
| **Raw `23505` ở rejection thứ 4** — submitter đã có escalation `unresolved`, rejection thứ 4 lại `insert into topic_review_escalations` (`20260917110000:70-77`, không còn `ON CONFLICT` sau khi `20260917100000:7-8` drop unique cũ và thay bằng partial index `MQ:10-12`) ⇒ vi phạm `topic_review_escalations_open_topic_submitter_idx` ⇒ lỗi Postgres thô, không có mã nghiệp vụ | `MQ:70-77`, `MQ:10-12` | Sau 3/3 topic bị hold; nếu A còn đường reject tiếp (ví dụ qua một submission cũ) hệ thống nổ lỗi thô thay vì `TOPIC_REVIEW_ESCALATION_HOLD` |
| **Deadlock hai escalation unresolved** — rescue submission bị reject ⇒ escalation của B được tạo trong khi escalation của A chưa resolve; khi đó `approve_topic_review` (`20260915130000:258-266`) và **mọi** rescue sau đó (`20260917100000:303`) đều raise `TOPIC_REVIEW_ESCALATION_HOLD` ⇒ topic chết cứng cho tới khi admin `moderate_platform_content` | `SR:303`, `R:258-266` | Chính là cơ chế khiến "rescue lặp" hiện tại trông như hoạt động nhưng thực tế dẫn tới deadlock |

Xử lý:

1. Trong `reject_topic_review`, trước khi insert escalation: nếu đã tồn tại escalation `unresolved` cho `(topic_id, submitted_by_user_id)` ⇒ raise `TOPIC_REVIEW_ESCALATION_HOLD` (mã nghiệp vụ, thay cho `23505` thô).
2. Vì correction **không** tạo escalation từ đường rescue (§4.2), số escalation `unresolved` tối đa trên một topic trở thành **1** trong luồng hợp lệ. Thêm test khẳng định điều đó (§8.2 #3b) thay vì chỉ dựa vào guard.

> Ghi nhận trung thực: hai defect này **không** được sinh ra bởi rescue-contract drift; chúng có trước. Nhưng contract rescue sau correction không thể đứng vững nếu nhánh ordinary vẫn có thể tạo escalation thứ hai hoặc nổ lỗi thô. Đây là lý do chúng nằm trong scope, không phải scope creep.

**`approve_topic_review`:**

```text
nếu v_submission.rescue_id is not null:
  rescue = select ... for update; rescue.status phải = 'active'   → TOPIC_REVIEW_RESCUE_STALE
  reviewer C: has_topic_review_access + C ≠ submitted_by (B)
             + C không bị d1_is_topic_reviewer_excluded (creator A, D, B, contributors hiện tại)
  topic ready; set submission approved; topics.status = 'published'
  (first_approved_at do trigger `d1_guard_topic_authorship_mutation` set khi sang published — AF:109-114)
  rescue.status = 'approved', ended_at/by
  resolve escalation nguồn: resolution_action = 'rescue'
ngược lại: nhánh ordinary giữ nguyên; ordinary approval KHÔNG resolve escalation (giữ nguyên D1).
```

**`restore_topic_rescue` — logic bắt buộc (một transaction):**

1. lock ladder; `select ... for update` rescue và topic.
2. Guards: caller là `owner`/`co_owner` active của course → `TOPIC_REVIEW_ESCALATION_FORBIDDEN`; rescue tồn tại và `status in ('active','failed')` → nếu `restored|approved|deleted` thì `TOPIC_REVIEW_RESCUE_STALE`; reason bắt buộc.
   * **`restored` và `approved` không restore lại được** — đã là terminal. **`deleted` cũng không** (finding 7): `Xóa bài học` kết thúc rescue vĩnh viễn, nên `deleted` là terminal và **không** có đường restore-sau-delete. Điều này làm cho mệnh đề "clear `removed_at`" trở nên không cần thiết; xem bước 5.
3. Hủy mọi submission `pending` của rescue: `status='cancelled'`, `cancelled_by_user_id`, `cancelled_at`, `cancellation_reason` (dùng đúng cột hiện có, `20260917100000:314-320`).
4. `perform set_config('voca.d1_topic_authorship','on',true)` + `update topics set responsible_author_user_id = rescue.previous_responsible_user_id` ⇒ **`responsible: B → D`** (D = người giữ trách nhiệm ngay trước takeover, **không** mặc định là creator A — §3.1, UD-3 ở §11.1). Fail-closed nếu D không còn là collaborator active của course: `TOPIC_RESPONSIBILITY_RECIPIENT_INVALID`.
5. `update topics set status='draft'` ⇒ về bản nháp. **Không** chạm `removed_at`: vì `deleted` là terminal (bước 2) và mọi đường delete/restore chung đều bị chặn khi rescue đang `active|failed` (§4.4), một rescue `active|failed` **không thể** đi kèm topic đã bị remove. Mệnh đề clear-`removed_at` trước đây là code chết và đã bị loại bỏ.
6. `insert topic_authorship_feedback (recipient = D, actor = caller, previous = B, new = D, feedback_type = 'responsibility_transfer')` — D được thông báo; nếu caller = D (self-take) thì theo convention hiện có, không ghi feedback.
7. `rescue.status='restored'`, `ended_at`, `ended_by_user_id`, `end_reason`.
8. Resolve escalation nguồn: `unresolved=false, resolved_by_user_id=caller, resolved_at, resolution_action='restore', resolution_reason`.
9. Trả `{status:'draft', course_id, topic_id, rescue_id, responsible_author_user_id, escalation_id}`.

> Sau restore: escalation nguồn đã resolved, không còn rescue active, topic ở `draft` với `responsible = D` ⇒ D có thể bắt đầu một **ordinary episode mới** với budget **0/3** (UD-1 đã chốt ở §11.1). "Một rescue cho mỗi held episode" vẫn đúng vì rescue mới chỉ có thể sinh từ một escalation mới.

**`delete_topic_rescue`:** cùng khung, thay bước 4–5 bằng `update topics set removed_at = now(), status='draft'`; **không** rollback responsibility (B vẫn là responsible), `rescue.status='deleted'` (**terminal**), `resolution_action='delete'`. Wording người dùng ở tầng UI là `Xóa bài học`.

> Sau delete: rescue kết thúc vĩnh viễn với rescue đó; escalation nguồn resolved; topic bị ẩn. Topic **có thể** được đưa lại bằng đường topic-restore hiện có (ngoài workflow rescue) và khi đó trở về draft bình thường với `responsible = B` và một episode mới — nhất quán với UD-1 (episode-scoped, không phải topic-lifetime) và với bản chất soft-delete của `Xóa bài học`.

### 4.3 Helper và authorization

**`d1_topic_group_member` / `d1_topic_group_member_for_restore`** — sửa theo đúng contract (finding 1 + finding 2):

```text
rescue_state := d1_topic_rescue_state(topic_id)   -- 'none' | 'active' | 'failed' | 'ended'

member  ⇔  collaborator active với role owner|co_owner|editor
           AND rescue_state <> 'failed'                      -- (finding 2) 3/3 khóa sửa thường
           AND (
             responsible_author_user_id = auth.uid()          -- B trong/sau rescue; D trước rescue
             OR có topic_contributors active
             OR (rescue_state = 'active'
                 AND original_creator_user_id = auth.uid())   -- (finding 1) CREATOR A, không phải D
           )
```

Ba điểm đã sửa so với bản trước:

1. **`previous_responsible_user_id` bị loại khỏi predicate.** Bản trước dùng nó như proxy cho "A trong rescue" — sai khi `D ≠ A`. Đúng phải là `original_creator_user_id`. D chỉ sửa được nếu D có authority độc lập (đồng thời là creator hoặc contributor).
2. **Nhánh creator chỉ mở khi `rescue_state = 'active'`.** Ngoài rescue, predicate giữ nguyên hành vi D1 hiện có (responsible + contributors) — không mở rộng blast radius. Trong rescue, creator A được sửa đúng như contract.
3. **`failed` chặn toàn bộ normal edit ở tầng DB.** Không dựa vào UI: sau 3/3 chỉ còn `Xóa bài học` và `Khôi phục về bản nháp`, nên `d1_prepare_topic_content_mutation` phải raise `TOPIC_RESCUE_FAILED_READONLY` (mã mới) trước khi tới `d1_topic_group_member`. Cả hai guard đều cần: guard trong `d1_prepare_topic_content_mutation` cho thông báo đúng nghĩa, và `rescue_state <> 'failed'` trong membership cho mọi đường khác đi qua predicate này.

* A giữ quyền **sửa** trong rescue, nhưng **không** submit được (nhánh rescue của `request_topic_review` chỉ nhận `rescuer_user_id`; nhánh ordinary yêu cầu `responsible = caller`).
* `..._for_restore` khác `..._member` ở chỗ bỏ điều kiện `t.removed_at is null` (`20260916140000:57-95`) — **phải dùng chung một predicate** còn lại (kể cả nhánh creator và nhánh `failed`) để hai bản không lệch nhau. Lưu ý `..._for_restore` **không** được mang nhánh `failed`, vì đường restore chung đã bị chặn riêng khi rescue `active|failed` (§4.4) và trộn hai mục đích vào một hàm là nguồn lệch tiếp theo.
* **Không** mở rộng predicate này cho owner/co-owner ngoài group (giữ P2 boundary).

**Quyền của owner/co-owner ngoài group cho hai action rescue (D10):** `delete_topic_rescue` và `restore_topic_rescue` authorize theo `is_course_owner_or_co_owner(course_id)`, **không** qua `d1_topic_group_member`. Đây là mở rộng có chủ đích, giới hạn đúng hai action này, và **không** cấp quyền sửa nội dung.

**`d1_is_topic_reviewer_excluded`** — tách hai nhóm điều kiện (finding 3):

```text
-- (a) DYNAMIC: áp dụng vô điều kiện, không phụ thuộc first_approved_at
EXISTS (
  select 1 from public.topics t
  where t.id = p_topic_id
    and (
      t.original_creator_user_id = p_user_id          -- creator A
      or t.responsible_author_user_id = p_user_id      -- D trước rescue, B trong/sau
      or exists (select 1 from public.topic_contributors tc
                 where tc.topic_id = t.id and tc.user_id = p_user_id and tc.removed_at is null)
      or exists (select 1 from public.topic_review_rescues r
                 where r.topic_id = t.id
                   and r.status in ('active','failed')
                   and p_user_id in (r.rescuer_user_id, r.previous_responsible_user_id))
    )
)
OR
-- (b) HISTORICAL: CHỈ trước first-approval, giữ nguyên như D1 hiện có
(
  t.first_approved_at is null
  and exists (select 1 from public.topic_author_review_exclusions e
              where e.topic_id = t.id and e.user_id = p_user_id)
)
```

**Vì sao loại trừ D là đúng, không phải siết thêm ngoài yêu cầu:** code hiện tại **đã** loại D khỏi tập reviewer của rescue — nhánh rescue truyền `v_escalation.submitted_by_user_id` (= D) làm tham số loại trừ thứ hai cho `d1_has_eligible_topic_reviewer` ([20260917100000:302](supabase/migrations/20260917100000_d1_senior_review_corrections.sql#L302), lỗi `TOPIC_REVIEW_NO_REMAINING_REVIEWER`). Việc đưa D vào predicate exclusion chỉ **làm cho hành vi đã có trở thành cấu trúc**, thay vì phụ thuộc vào việc caller có nhớ truyền tham số đó hay không. Lý do nghiệp vụ cũng rõ: D là tác giả của nội dung đã thất bại 3/3, cùng loại xung đột lợi ích với creator tự duyệt bài mình.

**Bắt buộc restate grant** sau `create or replace`: `revoke all ... from public, anon, authenticated; grant execute ... to service_role;` — nếu không sẽ vô tình đổi exposure (hiện chỉ `service_role`, `20260916130000:125-126`).

`d1_has_eligible_topic_reviewer` / `d1_has_distinct_topic_reviewer` / `has_topic_review_access` **không cần đổi logic** vì đã dựa trên exclusion predicate; nhưng phải chạy lại test matrix vì tập bị loại trừ **mở rộng đáng kể** (trước đây sau `first_approved_at` là rỗng, nay luôn có ít nhất creator + responsible + contributors).

### 4.4 RLS

* Bảng mới `topic_review_rescues`: RLS bật, không policy cho `authenticated`, `service_role` toàn quyền (§4.1a).
* `topic_review_submissions`/`topic_review_escalations`: giữ nguyên (đã service_role-only).
* `topics`: **không** thêm policy mới. Hai policy update cuối cùng đã bị drop không thay thế (`20260917100000:340-341`), nên `authenticated` **không** còn UPDATE policy nào trên `topics`; đường ghi duy nhất còn lại là column-level grant allowlist `update (title, description, slug, order_index, removed_at)` (`20260916120000:200-207`) — `status`, hai cột authorship và `first_approved_at` nằm **ngoài** allowlist. `responsible_author_user_id` vì vậy chỉ ghi được bên trong `SECURITY DEFINER` qua cờ `voca.d1_topic_authorship`; takeover trong rescue cũng đi qua đúng cờ đó nên invariant "authenticated không direct-write authorship" (`topic-authorship-foundation.test.ts:151-185`) được giữ. Correction **không** mở rộng allowlist này.
* Authorization của hai action rescue nằm trong RPC (owner/co_owner), **không** thêm RLS policy cho direct Data API.
* Integration test phải chứng minh: `authenticated` insert/update/delete trên `topic_review_rescues` bị từ chối (`42501`), và không có đường Data API nào set `responsible_author_user_id`.
* **Guard biên cho delete/restore chung (finding 7):** `d1_delete_topic` và `d1_restore_topic` phải raise `TOPIC_RESCUE_ACTIONS_REQUIRED` khi `d1_topic_rescue_state(topic) in ('active','failed')` — người dùng phải đi qua `delete_topic_rescue` / `restore_topic_rescue`.
* **Guard cho content mutation — chỉ `failed`, KHÔNG chặn `active`:**

  ```text
  d1_prepare_topic_content_mutation:
    rescue_state = 'failed'  -> TOPIC_RESCUE_FAILED_READONLY   (mã mới)
    rescue_state = 'active'  -> KHÔNG chặn ở đây; để các guard hiện có quyết định:
                                 status='pending' -> TOPIC_PENDING_FROZEN (đang chờ duyệt)
                                 status='draft'   -> cho phép (B/A/contributor sửa trước khi gửi)
    rescue_state = 'none'/'ended' -> không đổi
  ```

  **Đây là điểm phải viết đúng:** chặn `active` ở guard này sẽ vô hiệu hóa chính bước "B nhận trách nhiệm → sửa → gửi" của contract. Việc đóng băng khi đang chờ duyệt đã do `TOPIC_PENDING_FROZEN` (`20260916140000:227-229`) đảm nhiệm, không cần thêm. Chỉ `failed` mới là trạng thái khóa mới (finding 2).

  Guard này **không** phải phòng thủ hình thức: `d1_restore_topic` đang được grant cho `authenticated` (`20260916140000:290-291`) và gọi được trực tiếp qua Data API, nên nếu không có guard, một topic bị ẩn trong lúc rescue có thể bị "restore" qua đường chung và thoát khỏi state machine rescue. Guard này là điều kiện để `deleted` trở thành terminal thật (§3.5) và để mệnh đề clear-`removed_at` ở §4.2 bước 5 thực sự không cần thiết.

### 4.5 Canonical read model

`get_topic_workflow_state` phải trả **một** episode đang hoạt động và canonical hóa mọi con số:

```text
episodeType        : 'ordinary' | 'rescue' | null       -- canonical
rejectionCount     : số rejection của EPISODE ĐANG HOẠT ĐỘNG, không theo caller   -- canonical
rejectionLimit     : d1_topic_review_rejection_limit() = 3 (§4.1e)               -- canonical
latestRejectionReason / latestRejectionReviewer / latestRejectionAt
                   : rejection mới nhất của episode đang hoạt động, mọi submitter -- canonical
escalationId / escalationSubmitterId / escalationUnresolved : canonical (giữ nguyên)
pendingSubmissionId / pendingSubmitterId / pendingSubmissionIsRescue : canonical
rescueId / rescueStatus / rescueRescuer / rescuePreviousResponsibleUserId
   / rescueStartedAt : canonical, null khi không có rescue
```

`rejectionCount` khi `episodeType = 'rescue'` **phải** là kết quả derive ở §4.1d (`count(*) rejected where rescue_id = …`), **không** đọc từ cột lưu trữ — nếu không sẽ tái tạo đúng loại lệch mà `20260917110000:57-68` đã sửa cho nhánh ordinary.

Quy tắc chọn episode:

```text
nếu có rescue (active|failed) cho topic  -> episode = rescue đó (count = derive ở §4.1d)
ngược lại nếu có escalation unresolved    -> episode = ordinary episode của escalation.submitted_by_user_id
ngược lại                                 -> episode = ordinary episode của caller? KHÔNG: dùng null/0
```

> Ghi chú thiết kế: với topic không hold, "rejectionCount" canonical = số rejection của episode gần nhất **của topic** (không lọc theo caller). Nếu muốn giữ nghĩa "budget của tôi" cho tác giả, dùng field capability riêng `myRejectionCount`, **không** trộn vào `rejectionCount`.

Capability flags bổ sung:

```text
canStartRescue            : owner|co_owner && escalation unresolved && !rescueExists && B≠D && draft
canRequestReview          : ordinary: responsible && draft && ready && !hold
                            rescue  : rescuer && rescue active && derivedRejectionCount < rejectionLimit && draft && ready
canEdit                   : d1_topic_group_member — false khi rescue failed (§4.3)
canDeleteTopic            : rescue active|failed ? owner|co_owner
                            : (giữ semantics hiện có)
canRestoreRescueToDraft   : rescue status in ('active','failed') && owner|co_owner   -- 'deleted' là terminal
canCloseOrAbandonEpisode  : escalation unresolved && !rescueExists && owner|co_owner   -- không còn khi đã có rescue
canViewRejectionBudget    : isCreator(A) || isCurrentResponsible || isCurrentRescuer(B)
                            || isCurrentContributor || isOwnerOrCoOwner
                            -- false cho reviewer thường (không thuộc nhóm management ở trên)
```

`canSubmitActiveEpisode` (tên mới) có thể thay `canRequestReview` nếu muốn rõ nghĩa; nếu giữ tên cũ thì phải đảm bảo semantics rescue được test.

**`canViewRejectionBudget` — sửa theo finding 4.** Bản trước chỉ cho `responsible || rescuer`, quá hẹp: nó ẩn budget khỏi chính creator và contributor, những người cùng làm việc trên episode và cần biết còn bao nhiêu lượt (đặc biệt khi budget của rescue là thứ họ phải phối hợp). Định nghĩa đúng: **authoring/management actor** — creator A, responsible hiện tại, rescuer B, current contributors, owner/co-owner. Reviewer thường (người chỉ có vai trò duyệt, không thuộc nhóm trên) **không** thấy, để không bias phán xử.

Hệ quả được chấp nhận có ý thức: một owner/co-owner **đồng thời** là reviewer hợp lệ của submission đang chờ sẽ thấy budget. Đây là hệ quả trực tiếp của việc owner/co-owner là management actor theo contract; nếu Owner muốn chặt hơn (ẩn với bất kỳ ai đang là eligible reviewer của submission in-flight) thì đó là **một dòng guard** — ghi nhận ở §11.3, không chặn implement.

Backend state vẫn canonical (§3.7): visibility là **presentation rule**, không phải một phép biến đổi state. Budget vẫn được trả canonical trong DTO; việc ẩn là do client gate bằng capability flag, **và** server không cần che giá trị.

### 4.6 Server Actions / schemas / DTO

| File | Thay đổi |
| --- | --- |
| `lib/schemas/topic-workflow.ts` | Thêm `rejectionLimit`, `episodeType`, `rescue*`, các capability flag mới; giữ `strictObject`. Ghi chú rõ `latestAuthorshipFeedback` là viewer-scoped. |
| `lib/schemas/topic-review.ts` | `action` enum còn `["close","abandon"]`; thêm schema cho `startTopicRescue`, `restoreTopicRescue`, `deleteTopicRescue` (reason ≥ 10 ký tự theo convention hiện có). |
| `app/actions/topic-review.ts` | Thêm `startTopicRescue`, `restoreTopicRescue`, `deleteTopicRescue`; thêm mã lỗi mới vào error map; bỏ `'rescue'` khỏi `resolveTopicReviewEscalation`. |
| `types/database.ts` | Bổ sung type cho bảng mới + cột `rescue_id` (generated; không sửa tay ngoài generated flow). |
| Error code mới cần map | `TOPIC_REVIEW_RESCUE_IDENTITY_MISMATCH`, `TOPIC_REVIEW_RESCUE_ALREADY_STARTED`, `TOPIC_REVIEW_RESCUE_FAILED`, `TOPIC_REVIEW_RESCUE_STALE`. |

Error map hiện tại bỏ sót nhiều mã DB (`TOPIC_NOT_DRAFT`, `TOPIC_REMOVED`, `TOPIC_REVIEW_ESCALATION_STALE`…). Vì correction chạm đúng các action này, **bổ sung map** cho các mã reachable — nằm trong scope vì nếu không, người dùng nhận thông báo generic sai nghĩa.

### 4.7 Frontend state / actions / wording

`app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicWorkflowPanel.tsx`:

| Trạng thái | Ai | Action hiển thị |
| --- | --- | --- |
| Ordinary held, chưa rescue | owner/co_owner | `Tiếp nhận xử lý` (start rescue) + `Kết thúc xử lý và về bản nháp` (close/abandon hiện có — chỉ khi **chưa** có rescue) |
| Rescue `active`, chưa submit | **B** (responsible) | `Gửi duyệt`; B thấy budget (`{rejectionCount}/{rejectionLimit}` từ DTO) |
| Rescue `active`, chưa submit | **A** (creator) | Edit controls (được sửa), **không** có `Gửi duyệt` |
| Rescue `active`, chưa submit | **D** (pre-rescue responsible, khi `D ≠ A`) | **không** có edit control, **không** có `Gửi duyệt`; chỉ đọc + thấy budget |
| Rescue `active`, chưa submit | contributors | Edit controls; thấy budget |
| Rescue `active`, chưa submit | owner/co_owner | `Xóa bài học`, `Khôi phục về bản nháp` |
| Rescue submission `pending` | reviewer C | approve/reject; **không** thấy budget |
| Rescue `active` sau reject | B | reason + `{n}/{rejectionLimit}` của rescue, `Gửi duyệt` lại |
| Rescue `failed` (3/3) | **owner/co_owner** | **chỉ** `Xóa bài học`, `Khôi phục về bản nháp` |
| Rescue `failed` (3/3) | A / B / D / contributors | **không** edit control (khóa ở tầng DB, không chỉ ẩn nút) |
| Rescue `restored`/`approved`/`deleted` | — | không còn control rescue |
| Rescue `deleted` | owner/co_owner | không có restore-rescue (terminal); topic-restore (nếu còn đường UI) là thao tác ngoài workflow rescue |

* Thay wording cũ: `Gửi nhờ người duyệt khác` → `Tiếp nhận xử lý` (đây là takeover, không phải gửi hộ).
* `Ẩn bài học` → `Xóa bài học`. **Phân biệt hai đường** (finding 7): khi có rescue `active|failed`, affordance phải gọi `delete_topic_rescue` (không phải `d1_delete_topic`); khi không có rescue, giữ nguyên `d1_delete_topic`. Dialog nói rõ hệ quả (ẩn khỏi khóa học, có thể khôi phục). Hai nhãn khác nhau cho cùng một thao tác là lỗi nhất quán từ vựng, và hai **đường** khác nhau cho cùng một nhãn là lỗi state machine — cả hai đều được đóng ở đây.
* Thêm `Khôi phục về bản nháp` (chưa tồn tại) + confirm dialog mô tả Ctrl+Z: trả trách nhiệm về **người giữ trước takeover (D)**, đưa về bản nháp, kết thúc lượt xử lý. Copy **không** được nói cứng "về creator" vì `D ≠ A` là hợp lệ.
* Budget **không** render cho reviewer: gate bằng `canViewRejectionBudget` (§4.5).
* Không hardcode `/3` trong JSX (`TopicWorkflowPanel.tsx:215`) — dùng `rejectionLimit` từ DTO.
* Sau mọi mutation thành công: revalidate + refresh DTO (R3 hiện có); không giữ state rescue phía client.

**Blast radius rộng hơn một component** — trạng thái quyền hiện được **suy diễn lại ở 4 nơi độc lập**, không chỉ đọc DTO. Correction phải sửa cả bốn, nếu không contract sẽ đúng ở panel này và sai ở panel khác:

| Nơi | Suy diễn hiện tại | Yêu cầu |
| --- | --- | --- |
| `TopicWorkflowPanel.tsx:31-54` `getNextAction(workflow)` | copy/next-step suy ra client-side từ `status/canEdit/isReady/hasDistinctEligibleReviewer/escalationUnresolved` | phải nhận thêm `episodeType`/`rescue*` từ DTO; không tự suy ra "đang rescue" từ `pendingSubmissionIsRescue` |
| `TopicWorkflowPanel.tsx:63-65` `frozen` / `reviewerActionAllowed` / `rescuePending` | suy ra trong component | đọc trực tiếp capability flag từ DTO |
| `TopicManagementSheet.tsx:142,154,175,230-241,557-559,587-589` | `canEdit` lấy từ `getTopicsByChapterId` (`app/actions/topic.ts:530-533`) — **đường quyền thứ ba**, không đi qua `d1_topic_group_member` của workflow | `getTopicsByChapterId` phải dùng đúng predicate đã sửa (§4.3), nếu không A/B sẽ thấy nút sửa khác nhau giữa sheet và topic page |
| `SettingsTab.tsx:38-42,113-119` | status riêng qua `getTopicById`, không dùng workflow DTO | dùng cùng nguồn; đọc lại sau mutation |
| `SettingsTab.tsx:140-147` + `TopicManagementSheet.tsx:584-596` | cả hai gọi `deleteTopic` → `d1_delete_topic` | khi rescue `active\|failed`, cả hai phải chuyển sang action `deleteTopicRescue`; nếu không, `d1_delete_topic` sẽ raise `TOPIC_RESCUE_ACTIONS_REQUIRED` và người dùng thấy lỗi thay vì đường đúng |
| `CourseStructureWorkspace.tsx:157,497` | read-only suy từ `verifyCourseAccess().role === 'previewer'` | chỉ cần xác nhận không mâu thuẫn; không mở rộng quyền |

**Client state có thể stale (phải sửa cùng correction vì chúng che mất lỗi state):**

| Vấn đề | Bằng chứng | Hệ quả trong luồng rescue |
| --- | --- | --- |
| `SettingsTab` `useEffect` deps `[isDeleting, topicId]`, không chạy lại sau `router.refresh()` | `SettingsTab.tsx:46` | Sau reject/restore, tab Settings vẫn hiển thị status cũ (`Đang chờ duyệt` trong khi topic đã về `draft`) — **trực tiếp sai** trong luồng rescue |
| `reason` dùng chung giữa dialog reject và dialog escalation, chỉ clear khi thành công | `TopicWorkflowPanel.tsx:60,108,128` | Reject thất bại ⇒ text còn nguyên khi mở dialog rescue/restore |
| `isDeleting` set true trước `deleteTopic`, chỉ reset ở nhánh lỗi | `SettingsTab.tsx:30,70-76` | `Xóa bài học` thành công nhưng điều hướng bị chặn ⇒ nút kẹt disabled |
| `TopicAuthorshipSection` cache `members`/`currentUserId` lúc mở dialog, trộn với DTO mới | `TopicAuthorshipSection.tsx:101-123` | Sau takeover, danh sách recipient vẫn chứa người vừa thành responsible |
| `TopicManagementSheet` `hasTopicChanges` optimistic | `TopicManagementSheet.tsx:99,226,256` | Refresh cha phụ thuộc cờ này; có thể không refresh sau restore |

Các mục này **không** phải bug rời: chúng là những chỗ mà canonical read model mới sẽ bị **che** bởi state client cũ, khiến acceptance test ở trình duyệt pass giả.

---

## 5. Migration và data reconciliation

### 5.1 Thứ tự migration (một migration mới, additive-first)

1. Widen `topic_review_escalations_resolution_action_check`.
2. Tạo `topic_review_rescues` + index (chưa enforce ràng buộc cần backfill).
3. Thêm `topic_review_submissions.rescue_id` + index.
4. **Precheck fail-closed** cho toàn bộ legacy rescue còn `unresolved` (§5.2). Nếu có row không reconcile được → `raise exception` kèm **danh sách đầy đủ** id, migration dừng.
5. Reconstruct rescue row + gán `rescue_id` + hủy pending legacy submission + set `responsible` theo §5.2.
6. `create or replace` các RPC/helper theo §4.2–4.3, **kèm restate revoke/grant**.
7. `npx supabase db reset` local; mirror E2E không cần làm tay: `.e2e-runtime/supabase/` được tạo lại mỗi lần chạy bởi `scripts/e2e/prepare-supabase-workdir.mjs` (`rmSync` + `cpSync` từ `supabase/`).

### 5.2 Reconstruction và precheck fail-closed (sửa theo finding 5)

**Nguyên tắc dẫn đường:** một rescue phải được reconstruct khi và chỉ khi **escalation nguồn còn `unresolved`**. Đó chính xác là điều kiện khiến `start_topic_rescue` có thể chạy lại sau deploy; nếu không reconstruct, một held episode có thể nhận **rescue thứ hai** và vi phạm single-rescue invariant (§3.4). Escalation đã resolved thì không có rủi ro này.

**Nhóm 1 — escalation nguồn `unresolved` (BẮT BUỘC reconstruct).** Gồm cả ba trạng thái submission, không chỉ pending:

| Legacy state | Xử lý |
| --- | --- |
| rescue submission `pending` | Reconstruct rescue `active`; **set `responsible = rescuer`** (hoàn tất takeover hệ thống cũ chưa làm); gán `submission.rescue_id`; **hủy** submission pending đó (`status='cancelled'` + `cancelled_*` + `cancellation_reason` mô tả migration); topic → `draft`. B phải sửa rồi chủ động submit theo contract mới. |
| rescue submission(s) `rejected` | Reconstruct rescue; gán `rescue_id` cho **mọi** rescue submission attributable của episode đó (mọi attempt, không chỉ lần cuối); derive `count(*) rejected where rescue_id = …`; `1` hoặc `2` ⇒ rescue `active` + topic `draft`; `3` ⇒ rescue `failed`. Set `responsible = rescuer`. |
| rescue submission `cancelled` | **Không reconcile được** — xem nhóm 3. |

Vì sao **hủy** submission pending thay vì giữ: submission đó được tạo bởi đường code cũ — `resolve_topic_review_escalation('rescue')` tự submit ngay, trong khi B **chưa từng** là responsible. Contract mới nói rõ "rescue **không** tự động submit: B nhận trách nhiệm, sửa, rồi gửi khi sẵn sàng." Giữ nó lại sẽ để tồn tại một submission không có bước sửa và không tái tạo được bằng bất kỳ đường hợp lệ nào. **Đánh đổi được ghi nhận:** hủy làm mất công review đang dở và là thay đổi user-visible; đây là lý do nó chỉ áp cho trạng thái `pending`, không áp cho `rejected` (đã terminal, chỉ cần link).

**Nhóm 2 — escalation nguồn đã resolved, rescue submission `approved` (KHÔNG reconstruct).** Escalation đã resolved ⇒ `start_topic_rescue` không thể chạy lại trên nó (guard `unresolved`) ⇒ **không có rủi ro invariant**. Đổi `responsible` retroactively trên một topic **đã publish** là thay đổi authorship không có cơ sở: không có gì hỏng để sửa, và nó sẽ ghi một `responsible` khác với thực tế đã diễn ra. Đây là chỗ tài liệu này **không** làm theo hướng "reconstruct toàn bộ": reconstruct ở đây sẽ tạo ra row có `rescuer_user_id ≠ responsible_author_user_id` — tức là **tái tạo chính hình dạng bất biến mà correction đang xóa**. Chỉ inventory.

**Nhóm 3 — không reconcile được (fail closed, quarantine).** Abort với danh sách `topic_id, submission_id, lý do`:

* rescue submission `cancelled` + escalation còn `unresolved` — bất thường: mọi đường cancel hiện có (`resolve_topic_review_escalation(close)`, `moderate_platform_content`) đều resolve escalation, nên tổ hợp này không tái tạo được ⇒ không đoán;
* `submitted_by_user_id` không phải `owner|co_owner` active;
* `submitted_by_user_id = escalation.submitted_by_user_id` (không phải takeover);
* `responsible_author_user_id = submitted_by_user_id` (không có drift để sửa — ghi nhận, không hành động);
* topic `status <> 'draft'` không giải thích được, hoặc `removed_at is not null`;
* có **≥ 2 escalation `unresolved`** trên topic (ca deadlock §4.2.1);
* **≥ 2 rescue submission pending** cho cùng topic;
* derive ra `> 3` rejection trong một rescue.

**Thứ tự bắt buộc trong migration:** precheck chạy **trước** khi tạo unique index `source_escalation_id`, để một ca mơ hồ không thể đẩy migration vào trạng thái nửa vời. Precheck phải là **một câu truy vấn duy nhất** trả về toàn bộ danh sách vi phạm (không dừng ở lỗi đầu tiên) — nếu không, Owner phải chạy migration nhiều lần mới thấy hết.

Bổ sung inventory (chỉ báo cáo, không đổi state):

* các escalation `unresolved` có `submitted_by_user_id` không còn là responsible → báo cáo; không tự resolve.
* các topic có **≥ 2 escalation `unresolved`** → báo cáo riêng như ca deadlock (§4.2.1); không tự resolve vì việc resolve thuộc quyền admin (`moderate_platform_content`).

Pattern báo lỗi theo convention repo: `D1_TOPIC_RESCUE_PRECHECK_FAILED: topic ids=...`.

### 5.3 Ràng buộc "không grandfather"

Không có đường legacy nào được publish sai. Sau correction:

* Chỉ set `rescue.status = 'failed'` khi **derive** được đúng `rejectionLimit` rejection thuộc rescue đó (§4.1d). Nếu không chứng minh được, giữ `active` và báo cáo — **không** suy diễn `failed` từ số escalation hay số submission.
* Reconstruct **chỉ** cho escalation `unresolved` (§5.2). Escalation đã resolved không tạo rescue row ⇒ unique index `source_escalation_id` không bị chặn bởi dữ liệu lịch sử.
* Sau reconstruct, bất biến "mỗi escalation `unresolved` có tối đa một rescue row" phải kiểm được bằng truy vấn; đưa vào precheck của migration kế tiếp như một assertion thường trực.

### 5.4 Ghi chú dữ liệu local hiện có

`plan.md:534` ghi nhận sau reset: `11` published topic thiếu exercise / `8` thiếu flashcard. Đây là residual đã biết, **không** thuộc correction này và không được dùng làm lý do nới readiness invariant.

---

## 6. Race và stale-action

Lock ladder bắt buộc, giống code hiện có: `pg_advisory_xact_lock(hashtext(course_id))` → `pg_advisory_xact_lock(hashtext(topic_id))` → `select ... for update` trên row đích (`20260917100000:289-297`).

| Race | Guarantee bắt buộc |
| --- | --- |
| Hai co-owner cùng `start_topic_rescue` | Advisory lock + `unique (topic_id) where status='active'` ⇒ đúng một thắng; kẻ thua nhận `TOPIC_REVIEW_RESCUE_ALREADY_STARTED`, không tạo takeover thứ hai |
| Rescue start vs reject thứ 3 của A | Serialize trên topic lock; một bên thắng; nếu escalation đã resolve ⇒ `TOPIC_REVIEW_ESCALATION_STALE` |
| Rescue start vs `close/abandon` | Một terminal; bên thua `TOPIC_REVIEW_ESCALATION_STALE` hoặc `..._ALREADY_STARTED` |
| `start_topic_rescue` retry (double-click) | Idempotent theo `source_escalation_id` unique ⇒ lần hai lỗi ổn định, không tạo rescue thứ hai |
| Rescue submit vs restore/delete | Serialize trên topic + rescue lock; một terminal transition thắng; bên thua `TOPIC_REVIEW_RESCUE_STALE` |
| Delete chung (`d1_delete_topic`) vs rescue start | Cả hai lấy topic lock; nếu delete thắng, rescue start thấy `removed_at is not null` ⇒ `TOPIC_NOT_DRAFT`; nếu rescue thắng, delete nhận `TOPIC_RESCUE_ACTIONS_REQUIRED`. Không có trạng thái "rescue active + topic removed" (§4.4) |
| Delete chung vs delete rescue | Sau `delete_topic_rescue`, rescue `deleted` là terminal ⇒ `d1_restore_topic` bị chặn khi rescue `active\|failed`, nhưng **được phép** khi rescue đã terminal (đường topic-restore ngoài workflow). Hai đường không chồng lấn vì điều kiện loại trừ nhau |
| Restore vs delete cùng lúc | Một thắng; rescue còn lại đúng một terminal status (`restored` XOR `deleted`) |
| Rescue reject vs rescue approve | `select ... for update` trên submission ⇒ một bên thắng; bên thua `TOPIC_REVIEW_STALE` |
| Restore vs delete cùng lúc | Một thắng; rescue còn lại đúng một terminal status |
| Rescue approve vs contributor add/remove | Contributor mutation `TOPIC_PENDING_FROZEN` khi pending (`20260916130000:437`) ⇒ không đổi group trong lúc reviewer đang xem |
| Rescue approve vs bị rút quyền reviewer | `has_topic_review_access` re-check trong lock (giữ nguyên) |
| Restore vs A bị remove khỏi course | Restore vẫn set `responsible = A`; postcondition "responsible phải là collaborator active" bị vi phạm ⇒ **phải chặn**: nếu A không còn là collaborator active, `restore_topic_rescue` fail (`TOPIC_RESPONSIBILITY_RECIPIENT_INVALID`) và owner phải chọn delete; đây là gap của cả Doc C và Doc G, ghi thành test bắt buộc |
| Reject thứ 4 khi escalation đã `unresolved` | Guard mới ở §4.2.1 raise `TOPIC_REVIEW_ESCALATION_HOLD` **trước** insert ⇒ không còn `23505` thô; hai request đồng thời cùng submitter được serialize bởi partial unique index, bên thua nhận lỗi nghiệp vụ |

**Stale-action phía client:** mọi action rescue/restore/delete nhận id cụ thể (`escalation_id` / `rescue_id` / `submission_id`), không nhận state snapshot từ client ⇒ retry sau khi bên khác đã đổi state luôn fail ổn định, không ghi đè. Không cần version token riêng cho correction này; nếu Owner muốn optimistic-concurrency tường minh thì thêm `rescue.updated_at` vào điều kiện update (ghi nhận là optional, không blocking).

**Stale-render phía client** (bổ sung theo §4.7): các state cache trong `SettingsTab`, `TopicAuthorshipSection`, `TopicManagementSheet` phải được reset/revalidate trên cùng đường `router.refresh()`; nếu không, UI có thể hiển thị trạng thái **trước** restore/delete trong khi DB đã đổi — một dạng stale che lỗi, không phải stale gây lỗi, nhưng vẫn phải đóng trước manual QA.

---

## 7. Phases

`plan.md:473` bắt buộc amendment reopen là `P0-A → P1-A → P2-A → P3-A → P4-A`. Correction này **chính là** nội dung reopen đó; không tạo `-C`. Evidence ghi trước steer 2026-09-16/17 chỉ còn là historical evidence.

| Phase | Nội dung | Dependency |
| --- | --- | --- |
| **P0-A** | Chốt schema/DDL (`topic_review_rescues`, `submissions.rescue_id`, widen constraint), lock ladder, **hệ ký hiệu ba identity A/D/B**, danh sách mã lỗi mới (`TOPIC_RESCUE_ACTIONS_REQUIRED`, `TOPIC_RESCUE_FAILED_READONLY`, `TOPIC_REVIEW_RESCUE_IDENTITY_MISMATCH`, `TOPIC_REVIEW_RESCUE_ALREADY_STARTED`, `TOPIC_REVIEW_RESCUE_FAILED`, `TOPIC_REVIEW_RESCUE_STALE`, `TOPIC_RESPONSIBILITY_RECIPIENT_INVALID`), precheck/inventory script, fixture matrix **có ca `D ≠ A`** | — |
| **P1-A** | RPC/helper: `d1_topic_rescue_state`, `start_topic_rescue`, nhánh rescue của `request_topic_review`/`reject`/`approve`, `restore_topic_rescue` (target D), `delete_topic_rescue`, bỏ `'rescue'` khỏi `resolve_topic_review_escalation` + guard `close/abandon`, `d1_topic_group_member(_for_restore)` (creator A, chặn `failed`), `d1_is_topic_reviewer_excluded` (tách dynamic/historical), guard trong `d1_delete_topic`/`d1_restore_topic`/`d1_prepare_topic_content_mutation` | P0-A |
| **P2-A** | Migration + reconstruction (§5.2 nhóm 1) chạy được trên dữ liệu hiện có; integration/RLS/concurrency/migration tests cho toàn bộ invariant rescue | P1-A |
| **P3-A** | Read model canonical/capability + DTO/schema + Server Actions + UI (takeover, budget visibility, hai action, wording `Xóa bài học` / `Khôi phục về bản nháp`, sửa cả 4 surface quyền + stale state) | P2-A |
| **P4-A** | Đổi/bổ sung test theo §8, browser smoke/manual QA (gồm ca `D ≠ A`), reconcile `plan.md` (§10), self-review, checkpoint report | P3-A |

Không phase nào tự cấp quyền push/PR/merge/remote migration.

---

## 8. Test plan

### 8.1 Test phải **sửa** (đang encode hành vi sai)

| File:line | Hiện tại assert | Phải thành |
| --- | --- | --- |
| `__tests__/integration/topic-review-lifecycle.test.ts:392-450` | `submitted_by_user_id: USERS.teacher.id` trong khi responsible là student; không kiểm tra responsible sau rescue | Rescue **không** tạo submission; `responsible_author_user_id = B` (takeover); `original_creator_user_id` không đổi; sau đó B sửa + gửi → submission có `rescue_id` và `submitted_by = B = responsible` |
| `topic-review-lifecycle.test.ts:485-514` | teacher `rejectionCount: 1`, student `0` — caller-relative | `rejectionCount`/`latestRejection*` **giống nhau** cho mọi caller; chỉ capability flag khác |
| `topic-review-lifecycle.test.ts:823-871` | rescue + moderation, không assert responsible | Thêm takeover assertion + moderation trong rescue giữ history |
| `topic-review-lifecycle.test.ts:631-668` | hai escalation unresolved cùng tồn tại | Làm rõ đây là fixture-only; thêm test khẳng định **không** thể có hai rescue active |
| `__tests__/integration/topic-authorship-boundary.test.ts` (reviewer exclusion) | Sau `first_approved_at`, không có exclusion nào | Thêm case: topic đã publish rồi edit→draft→resubmit ⇒ creator, responsible, contributor **vẫn** bị loại (finding 3) |
| `__tests__/components/topic-workflow-panel.test.tsx:101-123` | ẩn `Gửi nhờ người duyệt khác` / `Ẩn bài học` | Rescue active ⇒ chỉ `Xóa bài học` + `Khôi phục về bản nháp`; rescue chưa start ⇒ có `Tiếp nhận xử lý` |
| `topic-workflow-panel.test.tsx:78-98` | `Bạn đã nhận 1/3` không gate role | Budget chỉ hiện khi `canViewRejectionBudget`; dùng `rejectionLimit` từ DTO |
| `__tests__/schemas/topic-workflow.test.ts:10-67` | fixture 30 field | Fixture mới với `rejectionLimit`, `episodeType`, `rescue*`; giữ `strictObject` reject field lạ |
| `__tests__/actions/topic-review.test.ts:98-148` | chỉ `close`/`abandon` | Thêm `startTopicRescue`/`restoreTopicRescue`/`deleteTopicRescue`; khẳng định `'rescue'` không còn trong enum |
| `__tests__/integration/topic-group-content-boundary.test.ts:351-371` | freeze cho contributor khi pending | Giữ nguyên; **thêm** test A sửa được khi rescue `active` **chưa** submit |
| `__tests__/integration/topic-authorship-boundary.test.ts:148-151` | `TOPIC_RESPONSIBLE_AUTHOR_REQUIRED` khi không phải responsible | Giữ; thêm nhánh rescue cho B |

### 8.2 Test phải **thêm**

**Integration (real DB, `npm run test:integration`)**

**Nhóm A — ba identity (finding 1, 6)**

1. `start_topic_rescue` với `D ≠ A` (fixture: A tạo → transfer sang D → D submit → 3/3): `original_creator_user_id` vẫn là **A**, `responsible_author_user_id` = **B**, `topic_review_rescues.previous_responsible_user_id` = **D**, có `preapproval_responsible` exclusion cho **D** (không phải A), **không** có submission nào được tạo, topic vẫn `draft`, escalation vẫn unresolved.
2. `restore_topic_rescue` trong cùng fixture ⇒ `responsible = D`, **không** phải A. Đây là test phân biệt A/D quan trọng nhất; nếu nó pass với `responsible = A` thì bản implement đã gộp hai identity.
3. Editable set với `D ≠ A`: **A sửa được**, **B sửa được**, contributor sửa được, **D KHÔNG sửa được** (trừ khi D cũng là contributor), collaborator ngoài group không; A **không** submit được (`TOPIC_RESPONSIBLE_AUTHOR_REQUIRED`).
4. `start_topic_rescue` khi `escalation.submitted_by_user_id <> topics.responsible_author_user_id` → `TOPIC_REVIEW_RESCUE_IDENTITY_MISMATCH` (guard xác lập D).

**Nhóm B — single rescue + budget (finding 2, 5, 9)**

5. Rescue **single**: lần hai (kể cả bởi co-owner khác) → `TOPIC_REVIEW_RESCUE_ALREADY_STARTED`; retry idempotent không tạo row thứ hai; rescue `failed`/`restored`/`deleted` rồi vẫn không start lại trên cùng escalation.
6. **Không sinh escalation thứ hai**: rescue submission bị reject 3 lần → đúng **một** escalation `unresolved` trên topic ở mọi thời điểm; `reject_topic_review` lần thứ 4 cho cùng submitter → `TOPIC_REVIEW_ESCALATION_HOLD` (mã nghiệp vụ), **không** phải lỗi `23505` (regression cho §4.2.1).
7. Budget rescue (derive): reject lần 1 → `count(*) rejected where rescue_id = …` = 1, topic `draft`, B gửi lại được; lần 2 tương tự; lần 3 → `rescue.status='failed'`, **không** tạo escalation mới, `canRequestReview=false`, chỉ còn delete/restore. Assert `rejectionCount` **không** đọc từ cột nào trên `topic_review_rescues` (không tồn tại cột đó).
8. **`failed` khóa sửa ở tầng DB** (finding 2): sau 3/3, `d1_prepare_topic_content_mutation` → `TOPIC_RESCUE_FAILED_READONLY` cho **mọi** actor (B, A, D, contributor, owner/co_owner); `d1_topic_group_member` trả `false`; `request_topic_review` → `TOPIC_REVIEW_RESCUE_FAILED`; `start_topic_rescue` → `TOPIC_REVIEW_RESCUE_ALREADY_STARTED`; `resolve_topic_review_escalation` → `TOPIC_RESCUE_ACTIONS_REQUIRED`. Chỉ `restore_topic_rescue` và `delete_topic_rescue` thành công.
8b. **`active` KHÔNG khóa sửa** (đối chứng bắt buộc cho #8): ở rescue `active` + topic `draft`, A/B/contributor sửa được bình thường; chỉ khi B gửi (`status='pending'`) mới `TOPIC_PENDING_FROZEN`. Test này bắt regression nếu guard `failed` bị viết lẫn sang `active`.

**Nhóm C — authorization và reviewer independence (finding 3, 7)**

9. `restore_topic_rescue`: `responsible: B → D`, topic `draft`, pending submission bị cancel có `cancellation_reason`, rescue `restored`, escalation `resolution_action='restore'`, **audit/history còn nguyên**, và D bắt đầu được ordinary episode **mới ở 0/3** (UD-1 đã chốt).
10. `delete_topic_rescue`: topic `removed_at` set, rescue `deleted`, escalation resolved `'delete'`, creation hold của D được giải phóng; **`restore_topic_rescue` sau đó → `TOPIC_REVIEW_RESCUE_STALE`** (terminal — finding 7).
11. `d1_delete_topic` và `d1_restore_topic` khi rescue `active|failed` → `TOPIC_RESCUE_ACTIONS_REQUIRED`; sau khi rescue đã terminal → hai hàm này trở lại hành vi bình thường.
12. `restore_topic_rescue` khi D đã bị remove khỏi course → fail-closed `TOPIC_RESPONSIBILITY_RECIPIENT_INVALID`.
13. Reviewer independence: trong rescue, A, D, B, contributor đều bị `d1_is_topic_reviewer_excluded` loại; **và** với topic đã `first_approved_at is not null` rồi quay lại pending, creator/responsible/contributor **vẫn** bị loại (finding 3 — regression cho cổng `first_approved_at`); exclusion lịch sử pre-first-approval vẫn nguyên.
14. `close`/`abandon` khi đã có rescue → `TOPIC_RESCUE_ACTIONS_REQUIRED`; khi chưa có rescue → vẫn hoạt động; `moderate_platform_content` vẫn resolve được escalation trong lúc có rescue (không bị guard mới chặn).

**Nhóm D — biên và đồng thời**

15. RLS: `authenticated` không insert/update/delete được `topic_review_rescues` (`42501`); không direct-write được `responsible_author_user_id`.
16. Concurrency: hai `start_topic_rescue` song song → đúng một thắng; `restore` vs `approve` song song → một terminal status; `delete_topic_rescue` vs `d1_delete_topic` song song → không tạo ra trạng thái "rescue active + topic removed".
17. Moderation/takedown trong rescue: rescue + escalation được resolve `'moderation'`, không tăng rejection budget.

**Migration / reconciliation (finding 5)**

18. Fixture migration: escalation `unresolved` + rescue submission `pending` ⇒ reconstruct `active`, hủy submission pending, `responsible = rescuer`, topic `draft`.
19. Fixture migration: escalation `unresolved` + 2 rescue submission `rejected` ⇒ reconstruct `active`, cả hai submission được gán `rescue_id`, derive count = 2.
20. Fixture migration: escalation `unresolved` + 3 rejected ⇒ reconstruct `failed`; và sau migration, `start_topic_rescue` trên escalation đó → `TOPIC_REVIEW_RESCUE_ALREADY_STARTED` (**đây là regression test cho chính finding 5** — nếu không reconstruct, test này fail).
21. Fixture migration: escalation đã `resolved` (`approved`) ⇒ **không** tạo rescue row, **không** đổi `responsible`.
22. Fixture migration: submission `cancelled` + escalation `unresolved` ⇒ precheck abort với đúng id.

**Component**

23. Panel cho từng actor: A (creator) / B (rescuer) / D (pre-rescue responsible, `D ≠ A`) / contributor / reviewer / owner-ngoài-group — đúng action, đúng wording `Xóa bài học` + `Khôi phục về bản nháp`, đúng trạng thái disabled/pending.
24. `Xóa bài học` và `Khôi phục về bản nháp` có dialog nêu object/action/consequence/reversibility; copy restore **không** nói cứng "về creator".
24b. **Nhất quán quyền giữa các surface**: cùng một DTO rescue cho ra cùng kết luận edit/submit ở `TopicWorkflowPanel`, `TopicManagementSheet` (qua `getTopicsByChapterId`) và `SettingsTab`; và cả `SettingsTab` lẫn `TopicManagementSheet` gọi `deleteTopicRescue` (không phải `deleteTopic`) khi có rescue (§4.7).
24c. **Không hardcode budget**: render `{n}/{rejectionLimit}`; test với `rejectionLimit` khác 3 để chứng minh UI không tự bịa số.
24d. **`canViewRejectionBudget` (finding 4)**: hiện cho creator/responsible/rescuer/contributor/owner/co-owner; **ẩn** cho reviewer thuần (editor/previewer có `can_review_topics` nhưng không thuộc nhóm management).
24e. **Stale render**: sau `router.refresh()`, `SettingsTab` và `TopicAuthorshipSection` phải bỏ state cũ; `reason` reset khi dialog đóng/mở lại.

**Action**

14. Ba action mới parse input, gọi đúng RPC, map đúng error code mới, revalidate đúng path.

**Schema**

15. `rejectionLimit` bắt buộc, `episodeType` enum, `rescue*` nullable nhất quán; DTO thiếu/thừa field bị reject.

**Browser smoke / manual QA (điều kiện: fixture readiness)**

16. Luồng bounded: 3 rejection → hold → `Tiếp nhận xử lý` → B sửa → gửi → reject → … → 3/3 → chỉ còn hai action → `Khôi phục về bản nháp` → responsible về **người giữ trước takeover**, topic draft. `e2e/smoke` hiện **không** có coverage review/rescue; fixture writer hiện có (`scripts/e2e/*-fixture.mjs`) là điểm mở rộng. Nếu fixture chưa sẵn sàng, ghi rõ `pending`, **không** claim đã kiểm.
17. Đường thay thế `D ≠ A` trong browser (fixture có transfer trước escalation): xác nhận D không có nút sửa trong rescue, A có, và sau restore D lấy lại quyền. Đây là case dễ bị bỏ sót nhất khi QA thủ công vì fixture mặc định thường là `D = A`.

### 8.3 Ranh giới bằng chứng

* `npm run test:run` (unit/schema/component/action) — `vitest.config.ts` loại trừ `__tests__/integration/**` và `e2e/**`.
* `npm run test:integration` — cần `ALLOW_DB_INTEGRATION_TESTS=true` + URL `http://127.0.0.1:45321` (`.env.test.local`).
* `npm run test:e2e:smoke` — cần Docker, reset DB, Playwright trên port 3100.
* Không mock DB cho invariant DB (theo `test-quality-strategy`).

---

## 9. Acceptance criteria

| # | Actor + action + condition ⇒ kết quả |
| --- | --- |
| AC1 | Owner/co-owner `B ≠ D` start rescue trên held topic ⇒ `creator` vẫn **A**, `responsible = B`, `previous_responsible_user_id = D`, **không** có submission nào được tạo, topic vẫn `draft`; khi `D ≠ A` thì D được ghi exclusion `preapproval_responsible`, không phải A |
| AC2 | Trong rescue, **creator A**, B và contributor hiện tại sửa được topic; **D không sửa được** (trừ khi D đồng thời là A/contributor); collaborator ngoài group không |
| AC3 | Trong rescue, chỉ B gửi được yêu cầu duyệt; A và D không gửi được |
| AC4 | Reviewer khác **A, D, B** và mọi current contributor — độc lập này áp dụng **vô điều kiện**, kể cả khi topic đã từng publish (`first_approved_at is not null`); exclusion lịch sử pre-first-approval vẫn nguyên |
| AC5 | Held topic chỉ start được **một** rescue; mọi lần thử thứ hai trả lỗi ổn định và không tạo row — kể cả `start_topic_rescue` sau khi rescue trước đã `failed`/`restored`/`deleted` |
| AC6 | Trong cùng một rescue, reject lần 1 và 2 cho phép B sửa + gửi lại; lần 3 set rescue `failed` và **không** tạo escalation mới |
| AC7 | Sau rescue `failed`, chỉ `Xóa bài học` và `Khôi phục về bản nháp` còn khả dụng; submit, rescue **và mọi content mutation** đều bị từ chối ở DB (`TOPIC_RESCUE_FAILED_READONLY`) cho mọi actor |
| AC8 | `Khôi phục về bản nháp` ⇒ `responsible: B → D`, topic `draft`, rescue `restored`, escalation nguồn resolved, audit/history còn nguyên; D bắt đầu được ordinary episode mới ở 0/3 |
| AC9 | `Xóa bài học` ⇒ topic soft-delete, rescue `deleted` (**terminal**), hold của D được giải phóng; `restore_topic_rescue` sau đó bị từ chối |
| AC9b | Khi rescue `active\|failed`, `d1_delete_topic` và `d1_restore_topic` đều bị từ chối (`TOPIC_RESCUE_ACTIONS_REQUIRED`); khi rescue đã terminal, hai hàm này trở lại hành vi bình thường |
| AC10 | `rejectionCount`/`latestRejection*`/`escalation*`/`rescue*` giống nhau với mọi caller; chỉ capability flag khác |
| AC11 | Budget **không** hiển thị cho reviewer thuần; hiển thị cho creator/responsible/rescuer/contributors/owner/co-owner; `rejectionLimit` đến từ DTO, không hardcode |
| AC12 | Migration reset local chạy được; precheck fail-closed nêu **đầy đủ** id khi có row không chứng minh được; mọi rescue còn `unresolved` đều được reconstruct nên single-rescue giữ nguyên sau deploy |
| AC13 | `authenticated` không direct-write được rescue table/authorship; không tồn tại bypass Data API cho `responsible_author_user_id` hay `removed_at` trong lúc rescue |
| AC14 | Sau approve rescue, responsible vẫn là B và learner đọc đúng approved content |
| AC15 | Ở mọi thời điểm trong luồng hợp lệ, một topic có **tối đa một** escalation `unresolved`; rejection thứ 4 trả mã nghiệp vụ chứ không phải lỗi `23505` |
| AC16 | `close`/`abandon` bị từ chối khi đã có rescue và vẫn hoạt động khi chưa có; admin moderation vẫn resolve được escalation trong lúc có rescue |
| AC17 | `start_topic_rescue` từ chối khi `escalation.submitted_by_user_id <> topics.responsible_author_user_id` (`TOPIC_REVIEW_RESCUE_IDENTITY_MISMATCH`), bảo đảm `previous_responsible_user_id` luôn đáng tin cho Ctrl+Z |

---

## 10. Tài liệu phải reconcile

`plan.md` đang mô tả contract rescue cũ ở nhiều dòng. Correction **phải** cập nhật các dòng sau (verbatim hiện tại → contract mới):

| Dòng | Nội dung cũ cần sửa |
| --- | --- |
| `plan.md:65-66` | rejection scope + "Rescue do owner/co_owner takeover tạo lifecycle mới với owner/co_owner là submitter `B`" |
| `plan.md:80` | "Linked rescue submission ghi `submitted_by_user_id = B`" (thiếu takeover) |
| `plan.md:138` | hàng rescue trong bảng lifecycle: "Tạo submission mới có `rescue_escalation_id` và `submitted_by_user_id = B`" |
| `plan.md:318`, `:321` | boundary mô tả rescue như submission |
| `plan.md:338`, `:342-343` | race table: rescue identity vs approve |
| `plan.md:403-404` | test matrix rescue |
| `plan.md:458` | manual QA bước 3 |
| `plan.md:508`, `:514` | §15 "Third rejection" + "Topic authorship/responsibility" |
| `plan.md:520` | "No unresolved Owner-decision blocker remains" — cần cập nhật theo §11 |

Ngoài ra `plan.md:473` (amendment rule) giữ nguyên và được dùng làm căn cứ phase ở §7. Hai draft `correction-plan.md` / `correction-plan-gemini.md` là draft song song; tài liệu này **không** phán xử chúng — việc hợp nhất về một nguồn là quyết định của Owner sau khi approve.

---

## 11. Rủi ro, assumption, unresolved decision

### 11.1 Unresolved decision

**UD-1 — ĐÃ CHỐT (Owner, phiên này), không còn là câu hỏi mở.** Sau `Khôi phục về bản nháp`: restore kết thúc lượt rescue/held đang hoạt động; topic về `draft`; **lần review thường kế tiếp bắt đầu một episode rejection MỚI ở 0/3**. Single-rescue được enforce **per held episode**, không phải per vòng đời topic. Hệ quả: nếu D lại nhận 3/3 trong một episode mới, một rescue mới cho episode đó là **hợp lệ** — điều này **không** vi phạm "một rescue" vì escalation là khác.

**UD-2 — ĐÃ CHỐT (Owner, phiên này).** Một khi rescue đã bắt đầu, `close`/`abandon` **không** còn là action cạnh tranh. Hai action quản trị rescue là `Khôi phục về bản nháp` và `Xóa bài học`. Trước khi rescue bắt đầu, `close`/`abandon` vẫn hợp lệ. Guard DB tương ứng ở §4.2.

> Kiểm tra xung đột repo cụ thể (theo yêu cầu finding 9): guard mới **có** chạm `resolve_topic_review_escalation`, nhưng **không** chặn admin moderation vì đường đó đi qua `d1_resolve_topic_escalations_for_moderation` (`20260915130000:73-97`), không qua RPC này. Đã kiểm; không có conflict.

**UD-3 — Restore target: creator A hay pre-rescue responsible D? (CẦN OWNER XÁC NHẬN — quyết định thật, không phải pseudo-ambiguity).**

Vấn đề chỉ xuất hiện khi `D ≠ A`. Prose gốc của Owner viết `responsible: B → A`, và trong kịch bản Owner mô tả thì `A` vừa là creator vừa là responsible ban đầu, nên hai cách đọc **trùng nhau** ở đó. Khi đã có transfer trước escalation, chúng tách ra:

* **Đọc "D" (plan implement theo, đề xuất):** restore là Ctrl+Z ⇒ phải hoàn tác **đúng** takeover, tức trả về người giữ trách nhiệm ngay trước đó — chính là giá trị `topic_review_rescues.previous_responsible_user_id`. Trả về creator A khi `A ≠ D` không phải undo mà là **một lần transfer mới**, và sẽ cấp lại trách nhiệm cho người không liên quan tới episode vừa thất bại.
* **Đọc "A" (creator):** trách nhiệm luôn quay về người tạo topic — đơn giản hơn về mặt sở hữu, nhưng biến nút "Ctrl+Z" thành một thao tác chuyển quyền, và làm mất khả năng khôi phục nguyên trạng.

**Đây là quyết định thật của Owner** vì nó xác định ai sở hữu topic sau restore và **repo không tự trả lời**. Plan implement theo **D**; nếu Owner chọn **A** thì đổi đúng một dòng (`rescue.previous_responsible_user_id` → `topics.original_creator_user_id`) cộng copy dialog, và phải bổ sung guard "A còn là collaborator active" thay cho guard D ở §4.2 bước 4.

### 11.2 Assumption

* A1: escalation `submitted_by_user_id` luôn là responsible author tại thời điểm submit — đúng ở code hiện tại vì `request_topic_review` yêu cầu `responsible = caller` (`20260917100000:218`). Rescue start kiểm tra lại điều này nên nếu sai sẽ fail-closed.
* A2: không có topic nào ở local DB đang có active drift ngoài các row precheck liệt kê (chưa xác minh — precheck sẽ trả lời khi chạy thật).
* A3 (**đã xác nhận, không còn là assumption**): `first_approved_at` được set **bởi trigger** `d1_guard_topic_authorship_mutation` khi topic chuyển sang `published` dưới lifecycle flag (`20260916120000:109-114`), không phải bởi `approve_topic_review`. Hệ quả cho plan: nhánh rescue approve **không** cần tự set `first_approved_at`; chỉ cần set `topics.status='published'` dưới flag như đường ordinary, và check `topics_published_requires_first_approval` (`AF:29-37`) sẽ tự thỏa.

### 11.3 Rủi ro

| Rủi ro | Ảnh hưởng | Giảm thiểu |
| --- | --- | --- |
| Bỏ sót đường ghi `responsible` ngoài cờ `voca.d1_topic_authorship` | Vỡ invariant authorship | Giữ nguyên trigger/guard hiện có; takeover tái dùng `d1_transfer_topic_responsibility_locked` |
| Hai bản predicate group (`..._member` và `..._for_restore`) lệch nhau | A sửa được nhưng không restore được (hoặc ngược lại) | Gộp về một predicate dùng chung |
| Grant bị mất khi `create or replace` helper đang `service_role`-only | Đổi exposure ngoài ý muốn | Restate revoke/grant trong cùng migration; integration test RLS |
| Backfill re-align responsible sai row | Gán trách nhiệm cho người không liên quan | Precheck fail-closed + quarantine; không silent rewrite |
| `rescue_escalation_id` legacy còn bị đọc ở đâu đó | Hai nguồn sự thật | Grep toàn bộ và chuyển hết sang `rescue_id`; ghi rõ cột legacy |
| Lưu counter budget song song dữ liệu nguồn | Tái tạo đúng loại drift đang sửa (counter lệch submission) | **Không** thêm cột counter; derive `count(*)` (§4.1d), theo precedent `20260917110000:57-68` |
| Escalation thứ hai unresolved ⇒ deadlock approve/rescue | Topic chết cứng, phải nhờ admin | Guard mã nghiệp vụ ở §4.2.1 + test bất biến "tối đa 1 unresolved" (§8.2 #3b) |
| Chỉ sửa `TopicWorkflowPanel`, bỏ qua 3 đường suy diễn quyền còn lại | Quyền đúng ở panel này, sai ở sheet/Settings ⇒ test trình duyệt pass giả | Sửa cả 4 nơi (§4.7) + test đối chiếu chéo (§8.2 #24b) |
| Stale client state che kết quả restore/delete | UI hiển thị trạng thái trước mutation, QA kết luận sai | Reset state theo §4.7/§6 + test #24e |
| Gộp creator A với pre-rescue responsible D | Restore trả trách nhiệm sai người; creator mất quyền sửa trong rescue; exclusion loại nhầm người | Tách ba identity ở §3.1; `previous_responsible_user_id` **không** dùng làm proxy cho creator (§4.3); test #1–#4 dùng fixture `D ≠ A` |
| Sau publish, không còn exclusion nào ⇒ responsible tự duyệt bài mình | Vi phạm reviewer independence một cách âm thầm | Tách dynamic/historical ở §4.3; regression test §8.2 #13 |
| Guard delete/restore chung không chặn trong rescue | `d1_restore_topic` gọi trực tiếp qua Data API ⇒ thoát state machine rescue | Guard `TOPIC_RESCUE_ACTIONS_REQUIRED` ở §4.4 + test #11 |
| Sau publish, tập reviewer hợp lệ thu hẹp còn rất ít | Course nhỏ có thể không còn reviewer ⇒ `TOPIC_REVIEW_NO_ELIGIBLE_REVIEWER` | **Hệ quả có chủ đích** của contract; mã lỗi đã tồn tại; test phải khẳng định thông báo đúng nghĩa chứ không coi là bug |
| Owner/co-owner vừa là management actor vừa là eligible reviewer ⇒ thấy budget | Trái tinh thần "không bias reviewer" | Chấp nhận có ý thức (§4.5); nếu Owner muốn chặt hơn là 1 dòng guard |
| Sửa read model làm vỡ test cũ đang assert caller-relative | Test đỏ kéo dài | Sửa test trong cùng P3-A/P4-A, không để lệch phase |
| Wording `Xóa bài học` lan sang surface khác | Scope creep | Chỉ đổi affordance map tới topic delete; ghi rõ trong checkpoint |

### 11.4 Blocker

Không có blocker kỹ thuật. **UD-3** là quyết định thật duy nhất còn lại (§11.1) và nó **không** chặn P0-A/P1-A: mặc định D đã được chọn, phần khác biệt chỉ là một dòng ở `restore_topic_rescue` cộng copy dialog. UD-1 và UD-2 đã chốt.

---

## 12. Self-review (plan)

Áp dụng `docs/agent-self-review.md` + `implementation-planning-and-pr-breakdown`.

**Đã kiểm tra và sửa trong chính tài liệu này:**

1. **Contract completeness** — rà 14 điểm của yêu cầu Owner: (1) creator ≠ responsible ✓ §3.1; (2) 3 rejection thường + hold ✓ §3.2; (3) rescue = takeover `D → B` ✓ §3.3; (4) rescue không submit ngay ✓ §3.3 + `start_topic_rescue` không set pending; (5) editable `A + B + contributors` ✓ §4.3; (6) reviewer độc lập A/B/contributors **vô điều kiện** + giữ exclusion lịch sử ✓ §3.6/§4.3; (7) một rescue, không chain ✓ §3.4 + hai unique index; (8) budget riêng 1/3→2/3→3/3 trong cùng rescue ✓ §4.2; (9) hai action bất kỳ lúc nào ✓ §3.5; (10) sau 3/3 chỉ còn hai action ✓ §3.3 + §4.3 (`failed` khóa sửa ở DB) + §4.5; (11) restore = Ctrl+Z ✓ §4.2; (12) wording `Xóa bài học`/`Khôi phục về bản nháp` ✓ §4.7; (13) canonical vs capability ✓ §3.7/§4.5; (14) reviewer không thấy budget ✓ §4.5.

2. **Sửa lỗi phát hiện khi tự rà:**
   * Bản nháp đầu chỉ định nghĩa "editable set" trong RPC mà **quên** rằng `d1_topic_group_member_for_restore` là bản sao thứ hai của cùng predicate → đã thêm yêu cầu gộp (§4.3, rủi ro §11.3).
   * Bản nháp đầu bỏ sót việc owner/co-owner **ngoài** topic group không `Xóa bài học`/restore được (D10) → đã bổ sung authorization riêng cho hai action (§4.3).
   * Bản nháp đầu không xử lý trường hợp A đã bị remove khỏi course khi restore → đã thêm fail-closed + test bắt buộc (§6, §8.2 #8).
   * Bản nháp đầu dùng `rescue_escalation_id` song song `rescue_id` → đã chốt `rescue_id` là SSOT, cột cũ thành legacy read-only (§4.1b) để tránh hai nguồn sự thật.
   * Bản nháp đầu không nêu rằng widening check constraint là **điều kiện tiên quyết** trước mọi ghi `resolution_action` mới → đã tách thành bước 1 của migration (§5.1).

2b. **Vòng self-review thứ hai, sau khi đối chiếu với discovery DB + frontend đầy đủ:**
   * **Bỏ counter lưu trữ.** Bản nháp đầu thiết kế `topic_review_rescues.rejection_count` như một cột. Discovery xác nhận repo đã **cố ý** bỏ hướng snapshot đó ở `20260917110000:57-68` và chuyển sang derive `COUNT(*)`. Giữ counter sẽ tái tạo chính loại hai-nguồn-sự-thật mà correction đang xóa ở `rescue_escalation_id` → đã đổi sang derive, **xóa cột** khỏi DDL (§4.1d), thêm hằng số `d1_topic_review_rejection_limit()` (§4.1e) và xóa literal `3`/`/3` khỏi cả RPC lẫn JSX.
   * **Phát hiện thêm hai defect chặn contract** ở nhánh ordinary: `23505` thô ở rejection thứ 4 và deadlock hai escalation unresolved. Đã thêm §4.2.1 + AC15 + test #6 (nhóm B). Ghi rõ chúng **có trước** drift, không phải do drift sinh ra — nhưng không thể để lại vì chúng vô hiệu hóa chính contract rescue.
   * **Blast radius frontend rộng hơn 1 component.** Discovery frontend cho thấy trạng thái quyền được suy diễn lại ở **bốn** nơi (`TopicWorkflowPanel.getNextAction`, `TopicManagementSheet`/`getTopicsByChapterId`, `SettingsTab`, `CourseStructureWorkspace`) và có **năm** điểm state client dễ stale. Đã bổ sung bảng blast radius + bảng stale state (§4.7), rủi ro (§11.3) và test #24b/#24e. Bản nháp đầu chỉ nói về một component.
   * **Xác nhận A3 bằng bằng chứng** (trigger set `first_approved_at`, `AF:109-114`) ⇒ chuyển từ assumption sang fact, và đơn giản hóa nhánh rescue approve (§11.2).
   * **Bổ sung bằng chứng grant chính xác** cho `topics`: hai policy UPDATE đã bị drop không thay thế (`SR:340-341`), chỉ còn column allowlist `update (title, description, slug, order_index, removed_at)` (`AF:200-207`) ⇒ §4.4 nay phát biểu đúng cơ chế thay vì chỉ nói "RLS".
   * **Bổ sung precheck**: loại trừ ca ≥2 escalation unresolved khỏi diện reconcile được (§5.2) — nếu không, backfill sẽ "reconcile" một topic đang deadlock và tạo rescue không thể chạy.
   * **Loại một kết luận sai của subagent khỏi phạm vi plan**: báo cáo frontend cho rằng creator A "thực sự nhận được `Duyệt`/`Từ chối`" cho submission của B. Kiểm lại: `canReview = has_topic_review_access(topic)` (`MQ:141`) và hàm này trả `false` khi `d1_is_topic_reviewer_excluded` đúng — A là `responsible_author` pre-approval nên **bị loại**, tức A **không** nhận được hai nút đó. UI chỉ đọc `canReview` từ DTO nên không có bug ở đây; plan giữ nguyên nguyên tắc "capability do server quyết" (§4.5) và **không** đưa claim sai vào phạm vi sửa.

3. **Architecture/race safety** — lock ladder kế thừa đúng code hiện có; mọi race trong §6 có guarantee hoặc được khai báo residual. Hai unique index là enforcement ở tầng DB, không chỉ application.

4. **Migration safety** — additive-first; precheck fail-closed trước backfill; không rewrite lịch sử terminal; tái sử dụng pattern `D1_*_PRECHECK_FAILED`; không cần mirror E2E thủ công (script tự copy).

5. **Test coverage** — mọi AC (AC1–AC17) đều có test tương ứng ở §8; phân biệt rõ tầng unit/schema/component/action/integration/concurrency/migration/browser; nêu rõ phần browser smoke phụ thuộc fixture readiness và phải ghi `pending` nếu thiếu.

6. **Điểm chưa đủ — ghi nhận trung thực:**
   * Chưa xác minh bằng DB thật số row drift thực tế (A2) — chỉ precheck khi implement mới trả lời được.
   * Chưa có smoke browser review/rescue trong repo; plan chỉ đề xuất, không claim đã có.
   * Chưa đọc các migration invitation (`20260915140000`, `20260916090000`) ở mức chi tiết, nên ảnh hưởng của luồng invitation lên membership/responsibility **chưa được loại trừ** — ghi thành stop condition (§13).
   * Chưa có fixture DB local để chạy thử precheck; mọi con số về dữ liệu hiện có trong tài liệu này là **mô tả**, không phải **đo**.

### 12.1 Vòng adversarial verification (theo yêu cầu review độc lập)

Mỗi finding được kiểm **trực tiếp với repo** trước khi sửa. Kết quả:

| # | Finding | Phán quyết | Bằng chứng / hành động |
| --- | --- | --- | --- |
| 1 | Creator / pre-rescue responsible / rescuer là 3 identity độc lập; không dùng `previous_responsible` làm proxy cho creator | **CONFIRMED** | `D ≠ A` reachable qua `transfer_topic_responsibility` (AB:515-547) và `d1_transfer_member_topic_responsibilities` (SR:138-186). Bản trước dùng `rescue.previous_responsible_user_id` cho nhánh "A trong rescue" → **sai**. Đã đổi sang `original_creator_user_id` (§4.3), thêm bảng ba identity + hệ quả D mất quyền sửa (§3.1, §3.3), test fixture `D ≠ A` (§8.2 nhóm A) |
| 2 | `failed` 3/3 phải khóa normal edit ở **DB**, không chỉ UI | **CONFIRMED** | Predicate cũ cho `active\|failed` vào nhánh `previous_responsible` ⇒ sau `failed` vẫn pass edit boundary. Đã thêm `rescue_state <> 'failed'` vào membership **và** guard `TOPIC_RESCUE_FAILED_READONLY` trong `d1_prepare_topic_content_mutation` (§4.3, §4.4), test #8 |
| 3 | Reviewer exclusion bị gate sai bởi `first_approved_at is null` | **CONFIRMED** | `20260916130000:107-123`: dòng 111 bọc **toàn bộ** predicate, kể cả `original_creator`/`responsible_author` (112-114) ⇒ sau publish không còn exclusion nào. Đã tách dynamic (vô điều kiện) / historical (pre-approval) ở §3.6 + §4.3, regression test #13 |
| 4 | `canViewRejectionBudget` quá hẹp | **CONFIRMED** | Đã mở thành creator/responsible/rescuer/contributors/owner/co-owner; reviewer thuần vẫn không thấy (§4.5). Ghi nhận hệ quả owner/co-owner-vừa-là-reviewer (§4.5, §11.3), test #24d |
| 5 | Legacy migration phải reconstruct **toàn bộ** rescue đã bắt đầu, không chỉ pending | **PARTIALLY CONFIRMED — thu hẹp có lý do** | **Phần đúng và quan trọng:** escalation còn `unresolved` + rescue submission `rejected` mà **không** reconstruct ⇒ sau deploy `start_topic_rescue` chạy lại được trên cùng escalation (guard duy nhất là `unresolved` + `rescueExists`), vi phạm single-rescue. Đã reconstruct cho **cả** `pending` và `rejected`, và hủy pending legacy submission (§5.2 nhóm 1), test #18–#20. **Phần không làm theo:** rescue submission `approved` có escalation **đã resolved** ⇒ `start_topic_rescue` không thể chạy lại (guard `unresolved`), nên **không có rủi ro invariant**; reconstruct nó sẽ đổi `responsible` retroactively trên topic **đã publish** và tạo row có `rescuer ≠ responsible` — tức tái tạo đúng hình dạng bất biến mà correction đang xóa. Giữ inventory-only (§5.2 nhóm 2), test #21. **Bổ sung ngoài finding:** `cancelled` + escalation `unresolved` là tổ hợp không tái tạo được (mọi đường cancel đều resolve escalation) ⇒ quarantine, không đoán (§5.2 nhóm 3), test #22 |
| 6 | Restore target `A` vs `D` là ambiguity thật | **CONFIRMED — flagged as UD-3** | Repo không trả lời. Prose Owner viết "B → A" nhưng ở kịch bản của Owner thì `A = D` nên hai cách đọc trùng nhau; khi `D ≠ A` chúng tách. Plan implement **D** (Ctrl+Z phải hoàn tác đúng takeover; trả về A là một transfer mới), ghi thành **UD-3** với chi phí đổi hướng là 1 dòng + copy dialog (§11.1). Prose §1.1/#10, §3.3, §3.5, §4.2 bước 4-6, §4.7 đã sửa để không còn gọi D là "A" |
| 7 | Delete vs restore reachability mâu thuẫn | **CONFIRMED** | §3.5 cũ nói restore clear `removed_at` "kể cả khi đã Xóa bài học", nhưng §4.2 chỉ cho `active\|failed` ⇒ mệnh đề đó là code chết. Đồng thời có đường chung `d1_delete_topic` (Settings tab/sheet) và `d1_restore_topic` **được grant cho `authenticated`** (GB:290-291) có thể set/clear `removed_at` trong lúc rescue. Đã: `deleted` là terminal + bỏ mệnh đề clear-`removed_at` (§4.2 bước 5) + guard `TOPIC_RESCUE_ACTIONS_REQUIRED` trong `d1_delete_topic`/`d1_restore_topic` (§4.4) + chặn `close`/`abandon` khi đã có rescue (đóng đường `abandon` set `removed_at`) + nêu rõ đường topic-restore sau `deleted` là ngoài workflow rescue (§3.5, §4.2, §6, §4.7), test #10, #11, #16 |
| 8 | Candidate không được tự tuyên bố supersede | **CONFIRMED** | `supersedes:` đã bị gỡ khỏi frontmatter, thay bằng `relationship` + `related_artifacts` mô tả quan hệ không có thẩm quyền (§frontmatter, §10) |
| 9 | Đóng các pseudo-ambiguity đã chốt | **CONFIRMED** | `UD-1` và `UD-2` không còn là "unresolved decision" mà là **Owner decision đã chốt** (§11.1); đã kiểm xung đột repo cụ thể theo yêu cầu: guard `close/abandon` **không** chặn admin moderation vì đường đó dùng `d1_resolve_topic_escalations_for_moderation` (R:73-97). UD-3 thay thế vị trí câu hỏi mở duy nhất |

**Giữ nguyên (finding 10) — đã kiểm lại và không bị vòng này bác bỏ:** tái dùng `d1_transfer_topic_responsibility_locked` (§4.2 bước 4, có thêm lý do rõ hơn: nó tự mint `preapproval_responsible` cho **D**); `rescue_id` tách khỏi `rescue_escalation_id` (§4.1b); derive rejection count thay vì counter (§4.1d); precheck fail-closed (§5.2); sửa `23505` + deadlock hai escalation (§4.2.1); canonical vs viewer-scoped capability (§3.7/§4.5); blast-radius 4 surface (§4.7); race/stale coverage (§6); phân loại nguồn (§0).

**Đối chiếu chéo cuối (prose ↔ pseudocode ↔ AC ↔ test):** đã rà lại toàn tài liệu sau khi sửa. Mọi chỗ nói về rescue dùng cùng một bộ ký hiệu `A/D/B`; `failed` khóa sửa xuất hiện nhất quán ở §3.3, §4.3, §4.4, §4.5, §4.7, §9 (AC7/AC8) và test #8; restore target là D ở §1.1, §3.3, §3.5, §4.2, §4.6, §4.7, §7, §8.2, §9 (AC9), §11.1; `deleted` terminal ở §3.5, §4.2, §4.5, §6, §9 (AC9), test #10.

---

## 13. Exclusions và stop conditions

**Trong scope:** đúng delta rescue/authorship/read-model/UI-wording ở §3–§4, migration/reconciliation §5, hai defect chặn contract ở §4.2.1, test §8, reconcile `plan.md` §10.

**Ngoài scope (quan sát được, không sửa ở đây):**

* candidate/published revision system; Q7/D2 preview; course publication; ownership transfer feature; email/push; expiry/reminder; bulk transfer UI; admin moderation product redesign; đổi `item_status` enum; đổi readiness invariant; service-role fixture boundary.
* `update_course_collaborator_role` (2 tham số, bản mới nhất `20260915160000_d1_role_capacity_guard.sql:1-59`) **không** gọi chuyển trách nhiệm, khác với `update_course_collaborator_role_with_responsibility` (`20260916130000:552-618`). Hệ quả: một thành viên có thể mất vai trò collaborator trong khi vẫn là `responsible_author_user_id` của topic chưa approve ⇒ sinh đúng tiền đề của ca fail-closed ở §6 (`TOPIC_RESPONSIBILITY_RECIPIENT_INVALID`) và của creation-hold. **Không** sửa trong correction này, nhưng phải ghi nhận vì nó quyết định tần suất gặp ca đó khi QA.

**Stop conditions:**

* **UD-3** (restore target `A` hay `D`) chưa được Owner xác nhận ⇒ vẫn implement được theo mặc định **D**, nhưng **không** merge `plan.md` cho tới khi chốt, vì nó quyết định authorship sau restore.
* Precheck fail-closed có row không reconcile được ⇒ dừng, báo Owner. **Không** hạ precheck thành cảnh báo để migration chạy tiếp.
* Phát hiện đường ghi `responsible` thứ ba ngoài hai đường đã biết ⇒ dừng, mở rộng discovery.
* Luồng invitation chạm `responsible_author_user_id` hoặc `topic_contributors` ⇒ dừng, đưa vào scope trước khi implement (chưa đọc chi tiết — §12.6).
* Phát hiện `topic_review_rescues` cần thêm trạng thái ngoài `active|approved|failed|restored|deleted` ⇒ dừng; thêm trạng thái là đổi state machine, phải qua Owner.
