> ⛔ **STALE — KHÔNG DÙNG LÀM CONTRACT.**
> Tài liệu này mô tả mô hình escalation / rescue / review-budget đã bị **bỏ hoàn toàn** theo quyết định của Owner.
> Contract hiện hành: [`correction-plan-deepseek-v2.md`](./correction-plan-deepseek-v2.md).
> Giữ lại chỉ để làm hồ sơ lịch sử. Mọi câu trong tài liệu này mô tả "rescue", "escalation", "takeover"
> hoặc ngưỡng từ chối 3 lần đều **không còn đúng**.

# Kế hoạch Hiệu chỉnh D1: Khắc phục Sai lệch Hợp đồng Giải cứu (Rescue Contract Drift)

## 1. Mục tiêu, trạng thái tài liệu và ranh giới thẩm quyền

### 1.1. Trạng thái tài liệu
- Tài liệu này là **kế hoạch hiệu chỉnh chi tiết (Correction Plan)** thuộc cùng phạm vi D1 (Topic Authoring, Review và Publication), không phải một workstream mới.
- Vị trí tài liệu: `docs/refactors/student-user-flow-route/implementation-plans/d1/correction-plan-gemini.md` (nằm cạnh `plan.md` của D1).
- **Phạm vi của task này là LẬP KẾ HOẠCH DUY NHẤT (Planning only)**:
  * Không thực hiện code implementation;
  * Không tạo migration hay sửa mã nguồn/test;
  * Không commit hay thực hiện bất kỳ Git/remote action nào;
  * Sau khi hoàn thiện kế hoạch và self-review, dừng lại để báo cáo.

### 1.2. Mục tiêu quan sát được (Observable Success)
Hệ thống phải tái căn chỉnh toàn diện từ Database Schema, RPC State Machine, RLS/Authorization, Canonical Read Model, Server Actions đến Frontend UI theo đúng Hợp đồng Chủ sở hữu (Owner Contract) đã chốt:

1. **Định danh độc lập**: `creator` (người tạo gốc, bất biến) và `responsible author` (người chịu trách nhiệm hiện tại) là hai định danh hoàn toàn tách biệt.
   * Ban đầu: `creator = A`, `responsible = A`, `contributors = C1/C2` (nếu có).
2. **Ngân sách từ chối tác giả thông thường**: Tác giả chịu trách nhiệm thông thường có tối đa 3 lần bị từ chối duyệt (rejection budget 3/3). Khi chạm `3/3`, bài học chuyển sang trạng thái tạm giữ (`held` / escalation unresolved), và Owner/Co-owner có thể giải cứu (`rescue`).
3. **Bản chất của Rescue là Tiếp quản Trách nhiệm (Responsibility Takeover)**, KHÔNG PHẢI "gửi duyệt hộ":
   * `creator = A` (bất biến)
   * `responsible: A → B` (B là Owner/Co-owner thực hiện rescue).
4. **Rescue KHÔNG tự động gửi duyệt**: B tiếp quản trách nhiệm, bài học giữ trạng thái `draft`, B trực tiếp chỉnh sửa nội dung bài học, và B chủ động nhấn gửi duyệt khi đã sẵn sàng.
5. **Quyền soạn thảo trong thời gian Rescue**: Nhóm tác giả có quyền chỉnh sửa bao gồm:
   ```text
   creator A + rescuer B + current contributors
   ```
6. **Loại trừ người duyệt (Reviewer Exclusion)**: Người duyệt bài học bắt buộc phải độc lập khách quan với:
   ```text
   creator A + responsible B + current contributors
   ```
   đồng thời bảo toàn nguyên vẹn mọi bất biến loại trừ lịch sử nghiêm ngặt hơn trước lần duyệt đầu tiên (`first_approved_at IS NULL`).
7. **Bất biến Rescue duy nhất (Single Rescue Invariant)**: Mỗi held episode chỉ được phép bắt đầu **DUY NHẤT 1 đợt rescue**. Tuyệt đối không có rescuer thứ hai, không có chuỗi rescue (rescue chain: A → B → C).
8. **Ngân sách từ chối độc lập cho Rescue**: Bên trong cùng đợt rescue đó, B sở hữu một ngân sách từ chối riêng biệt:
   ```text
   1/3 → B sửa → gửi lại (resubmit)
   2/3 → B sửa → gửi lại (resubmit)
   3/3 → rescue thất bại (rescue failed)
   ```
   Đây là các lần gửi duyệt lại bên trong cùng 1 rescue, không phải các đợt rescue mới.
9. **Hai quyền hạn tối cao của Owner/Co-owner ở bất kỳ thời điểm nào trong Rescue**:
   * **Khôi phục về bản nháp (`Khôi phục về bản nháp`)**: Đóng vai trò Ctrl+Z cho đợt rescue đang active:
     ```text
     responsible: B → A
     topic → draft
     B rời khỏi active workflow
     trạng thái rescue/review active kết thúc
     toàn bộ lịch sử/audit được bảo lưu
     ```
   * **Xóa bài học (`Xóa bài học`)**: Wording hiển thị cho người dùng (ngay cả khi backend dùng cơ chế soft-delete/ẩn `removed_at = now()`).
10. **Trạng thái kết thúc sau khi Rescue chạm 3/3**:
    * Khi rescue đạt `3/3`, **CHỈ CÒN DUY NHẤT 2 THAO TÁC**: `Khôi phục về bản nháp` hoặc `Xóa bài học`.
    * Tuyệt đối không còn nút gửi duyệt và không cho phép rescue thêm lần nào nữa.
11. **Tính Canonical của Read Model**: Trạng thái workflow chuẩn (như số lần từ chối hiện tại, thông tin từ chối gần nhất, trạng thái rescue) **không được phép thay đổi theo caller**. Chỉ có các cờ năng lực theo vai trò (role-specific capability flags) mới thay đổi theo caller.
12. **Giao diện người duyệt thông thường (Ordinary Reviewer UI)**: Không được hiển thị ngân sách từ chối (`x/3`).

---

## 2. Kết quả Discovery Repository & Phân tích Gốc rễ Sai lệch (Root Mismatch)

Bằng chứng thực tế thu thập từ mã nguồn tại commit hiện tại (`feat/topic-publish-validation`) khẳng định rằng hiện tượng sai lệch không phải là tập hợp các lỗi lẻ tẻ, mà bắt nguồn từ một **sai lầm thiết kế duy nhất (Root Mismatch)**:

### 2.1. Bằng chứng trực tiếp từ mã nguồn

1. **RPC `resolve_topic_review_escalation` (File `supabase/migrations/20260917100000_d1_senior_review_corrections.sql`, dòng 296–311)**:
   ```sql
   if p_action = 'rescue' then
     if v_escalation.submitted_by_user_id = v_user_id then raise exception 'TOPIC_REVIEW_RESCUE_FORBIDDEN'; end if;
     -- ... kiểm tra readiness ...
     insert into public.topic_review_submissions (
       topic_id, submitted_by_user_id, status, attempt_number, rescue_escalation_id
     ) values (v_topic.id, v_user_id, 'pending', v_attempt_number, v_escalation.id) returning * into v_submission;
     perform set_config('voca.d1_trusted_topic_lifecycle', 'on', true);
     update public.topics set status = 'pending' where id = v_topic.id;
     return jsonb_build_object('status', 'pending', ...);
   end if;
   ```
   * *Bằng chứng 1*: Cột `responsible_author_user_id` trên bảng `topics` **hoàn toàn không được cập nhật**. Nó vẫn giữ nguyên giá trị là tác giả cũ $A$.
   * *Bằng chứng 2*: RPC tự động chèn ngay một submission `pending` với `submitted_by_user_id = B`, và cập nhật `topics.status = 'pending'`. B bị ép vào vai "người gửi hộ", bài học bị đóng băng ngay lập tức, B không có quyền sửa nội dung trước khi gửi duyệt.
   * *Bằng chứng 3*: Escalation của $A$ không được giải quyết (`unresolved` vẫn là `true`), vì nhánh `rescue` trả về kết quả ngay tại dòng 310, bỏ qua lệnh update escalation ở dòng 325–327.

2. **RPC `request_topic_review` (File `supabase/migrations/20260917100000_d1_senior_review_corrections.sql`, dòng 217–222)**:
   ```sql
   if v_topic.responsible_author_user_id <> v_user_id then
     raise exception 'TOPIC_RESPONSIBLE_AUTHOR_REQUIRED';
   end if;
   if exists (
     select 1 from public.topic_review_escalations e
     where e.topic_id = p_topic_id and e.unresolved
   ) then
     raise exception 'TOPIC_REVIEW_ESCALATION_HOLD';
   end if;
   ```
   * *Bằng chứng 4 (Runtime Deadlock)*: Nếu reviewer từ chối submission của $B$, topic quay về `draft`. Khi $B$ muốn sửa bài và gửi lại qua `request_topic_review`, $B$ bị chặn đứng bởi cả 2 điều kiện:
     - B không phải là `responsible_author_user_id` (vì responsible vẫn là $A$);
     - Escalation cũ của $A$ vẫn đang mở (`unresolved = true`).
     $B$ hoàn toàn bị bế tắc, không thể resubmit lần 2 hay lần 3!

3. **RPC `reject_topic_review` (File `supabase/migrations/20260917110000_d1_manual_qa_corrections.sql`, dòng 57–77)**:
   ```sql
   select count(*) into v_rejection_count
   from public.topic_review_submissions s
   where s.topic_id = v_topic.id
     and s.submitted_by_user_id = v_submission.submitted_by_user_id
     and s.status = 'rejected' ...;

   if v_rejection_count >= 3 then
     insert into public.topic_review_escalations (
       topic_id, submitted_by_user_id, rejection_count, unresolved
     ) values (v_topic.id, v_submission.submitted_by_user_id, v_rejection_count, true);
   end if;
   ```
   * *Bằng chứng 5 (Rescue Chain / Infinite Escalation)*: Rejection count được tính theo `s.submitted_by_user_id`. Khi submission do $B$ gửi bị từ chối 3 lần, RPC chèn một escalation mới cho $B$ (`submitted_by_user_id = B, unresolved = true`), cho phép một người khác nhảy vào cứu tiếp $B$ (tạo chuỗi rescue không hồi kết), phá vỡ bất biến single rescue.

4. **RPC `get_topic_workflow_state` (File `supabase/migrations/20260917110000_d1_manual_qa_corrections.sql`, dòng 155–186)**:
   ```sql
   select * into v_latest_rejection
   from public.topic_review_submissions s
   where s.topic_id = v_topic.id
     and s.submitted_by_user_id = v_user_id  -- v_user_id = auth.uid()!
     and s.status = 'rejected' ...;

   select count(*) into v_rejection_count
   from public.topic_review_submissions s
   where s.topic_id = v_topic.id
     and s.submitted_by_user_id = v_user_id  -- v_user_id = auth.uid()!
     and s.status = 'rejected' ...;
   ```
   * *Bằng chứng 6 (Phá vỡ Canonical Read Model)*: Cả `rejection_count` và `latest_rejection` bị lọc theo `auth.uid() = s.submitted_by_user_id`. Người duyệt hoặc đồng nghiệp không trực tiếp submit luôn nhận về count = 0 và rejection = null. Tác giả $A$ thấy 3/3, Rescuer $B$ thấy 1/3, Owner thấy 0/3.

5. **Quyền biên tập `d1_topic_group_member` (File `supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql`, dòng 81–90)**:
   ```sql
   and (
     t.responsible_author_user_id = auth.uid()
     or exists (
       select 1 from public.topic_contributors tc
       where tc.topic_id = t.id and tc.user_id = auth.uid() and tc.removed_at is null
     )
   )
   ```
   * *Bằng chứng 7*: `original_creator_user_id` không nằm trong danh sách được phép sửa. Khi đổi responsible từ $A \rightarrow B$, $A$ lập tức bị tước quyền sửa, trái với quy tắc nhóm tác giả trong rescue là `A + B + contributors`.

6. **Loại trừ người duyệt `d1_is_topic_reviewer_excluded` (File `supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql`, dòng 107–122)**:
   * *Bằng chứng 8*: Không kiểm tra bảng `topic_contributors`. Đồng thời điều kiện `and t.first_approved_at is null` làm mất toàn bộ logic loại trừ sau lần duyệt đầu tiên.

7. **Quyền xóa bài `d1_delete_topic` (File `supabase/migrations/20260915110000_d1_content_mutation_safety.sql`, dòng 170–189 & `20260916140000_d1_topic_group_content_boundary.sql`, dòng 224–228)**:
   * *Bằng chứng 9*: `d1_delete_topic` gọi `d1_prepare_topic_content_mutation`, đòi hỏi caller phải là `d1_topic_group_member`. Owner/Co-owner không phải author sẽ bị văng lỗi `COURSE_EDIT_FORBIDDEN`, và văng lỗi `TOPIC_PENDING_FROZEN` nếu topic đang pending.

8. **Giao diện Reviewer UI (`app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicWorkflowPanel.tsx`, dòng 215)**:
   ```tsx
   {workflow.rejectionCount > 0 ? (
     <p className="mt-2 text-xs font-semibold">Bạn đã nhận {workflow.rejectionCount}/3 lần phản hồi trong lượt gửi hiện tại.</p>
   ) : null}
   ```
   * *Bằng chứng 10*: Đoạn text mang tính author-facing được render mà không kiểm tra vai trò người xem, trước đây ẩn được là nhờ bug SQL trả về 0 cho reviewer.

9. **Test suite hiện tại encode drift (`__tests__/integration/topic-review-lifecycle.test.ts`, dòng 434–444 & 495–512)**:
   * *Bằng chứng 11*: Test assert thẳng rằng rescue tạo pending submission và giữ nguyên responsible author, đồng thời assert reviewer nhận `rejectionCount = 0`.

### 2.2. Chuỗi quan hệ nhân quả thống nhất (Causal Chain)
Toàn bộ các biểu hiện lỗi trên có chung một gốc rễ duy nhất:

```text
Rescue bị mô hình hóa thành "submitted_by = B gửi hộ A" (thay vì B tiếp quản responsible_author_user_id)
  │
  ├──► B không được sửa bài trước khi duyệt (bị auto-submit và freeze)
  ├──► Khi B bị từ chối, responsible vẫn là A và escalation vẫn mở ──► B bị deadlock, không resubmit được
  ├──► Hệ thống coi rejections của B là episode của B ──────────────► B chạm 3/3 mở escalation mới (rescue chain)
  ├──► Read model lọc count theo submitter (auth.uid()) ────────────► Trạng thái workflow bị vỡ tính canonical
  ├──► Quyền biên tập d1_topic_group_member bỏ quên creator A ──────► A mất quyền sửa trong rescue
  ├──► Reviewer exclusion bỏ quên contributors ─────────────────────► Vi phạm tính độc lập khách quan
  └──► Thiếu mô hình Rescue Persistence độc lập ───────────────────► Không có thao tác Khôi phục bản nháp (Ctrl+Z)
```

---

## 3. Mô hình Trạng thái Chuẩn hóa (Canonical State Machine & Identity Contract)

### 3.1. Bất biến Định danh (Identity Invariant)
Quy ước định danh qua các giai đoạn:
* $A$: Người tạo ban đầu (`original_creator_user_id`), bất biến suốt vòng đời topic.
* $B$: Chủ sở hữu hoặc đồng sở hữu thực hiện rescue.
* $C1, C2$: Các cộng tác viên đóng góp (`topic_contributors`) hiện tại (tối đa 2 người).
* $R$: Người duyệt độc lập, bắt buộc thỏa mãn: $R \notin \{A, B, C1, C2\}$ và không nằm trong danh sách loại trừ lịch sử trước lần duyệt đầu.

| Giai đoạn vòng đời | `original_creator` | `responsible_author` | `topic.status` | Nhóm có quyền Sửa (`canEdit`) | Ai được Gửi duyệt (`canSubmit`) | Trạng thái Rescue |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Soạn thảo ban đầu** | $A$ | $A$ | `draft` | $A + C1/C2$ | $A$ | Không có (Inactive) |
| **Đang chờ duyệt thường** | $A$ | $A$ | `pending` | Không ai (Frozen) | Không ai | Không có (Inactive) |
| **Tạm giữ thường (3/3 Held)**| $A$ | $A$ | `draft` (held) | $A + C1/C2$ | Không ai (Bị khóa gửi duyệt)| Escalation unresolved |
| **Rescue Active (Draft)** | $A$ | $B$ | `draft` | **$A + B + C1/C2$** | **Chỉ $B$** | Active (Count: 0/3, 1/3, 2/3) |
| **Rescue Pending** | $A$ | $B$ | `pending` | Không ai (Frozen) | Không ai | Active (đang chờ $R$ duyệt) |
| **Rescue Failed (3/3)** | $A$ | $B$ | `draft` (terminal)| **Không ai** | **Không ai** | Failed (Terminal) |
| **Rescue Restored (Ctrl+Z)** | $A$ | $A$ | `draft` | $A + C1/C2$ | Theo hợp đồng khôi phục | Restored (Inactive) |
| **Rescue Deleted (Xóa)** | $A$ | $B$ / $A$ | `draft` (removed) | Không ai | Không ai | Deleted (Terminal) |

### 3.2. Ngân sách Từ chối của Rescue (Rescue Rejection Budget)
Mỗi đợt rescue có ngân sách 3 lần từ chối hoàn toàn độc lập với ngân sách thông thường trước đó:
```text
[Start Rescue] ──► rescue_rejection_count = 0/3 (Topic: draft, responsible: B)
                        │
                        ▼ (B sửa nội dung và bấm Gửi duyệt)
                   [Submission 1 pending]
                        │
                        ▼ (Reviewer từ chối)
                   [Rejection 1] ──► rescue_rejection_count = 1/3 (Topic: draft)
                        │
                        ▼ (B sửa nội dung và bấm Gửi duyệt lại)
                   [Submission 2 pending]
                        │
                        ▼ (Reviewer từ chối)
                   [Rejection 2] ──► rescue_rejection_count = 2/3 (Topic: draft)
                        │
                        ▼ (B sửa nội dung và bấm Gửi duyệt lại)
                   [Submission 3 pending]
                        │
                        ▼ (Reviewer từ chối)
                   [Rejection 3] ──► rescue_rejection_count = 3/3 (Topic: draft)
                        │
                        ▼
                   [Rescue Failed - Trạng thái bế tắc cuối cùng]
                   KHÔNG mở escalation mới! KHÔNG cho rescue thêm!
                   CHỈ CÒN 2 THAO TÁC: "Khôi phục về bản nháp" HOẶC "Xóa bài học"
```

### 3.3. Bất biến Single Rescue (Không Rescue Chain)
* Trên cùng một held episode: **Chỉ được phép tồn tại duy nhất 1 bản ghi rescue**.
* Khi rescue đang active hoặc đã failed ở 3/3, bất kỳ yêu cầu bắt đầu rescue mới nào đều bị database unique constraint và RPC check từ chối ngay lập tức (`TOPIC_REVIEW_RESCUE_ALREADY_ACTIVE` / `TOPIC_REVIEW_SINGLE_RESCUE_VIOLATION`).

### 3.4. Hành vi Khôi phục về bản nháp (`Khôi phục về bản nháp`)
* Là thao tác hoàn tác (Ctrl+Z) đợt rescue đang diễn ra.
* Khả dụng tại **bất kỳ thời điểm nào** trong suốt rescue (khi rescue đang ở draft 0/3, 1/3, 2/3, khi đang có submission pending, hoặc khi rescue đã failed ở 3/3).
* Hành động nguyên tử:
  1. Trả quyền chịu trách nhiệm về cho tác giả ban đầu: `responsible_author_user_id: B → A`.
  2. Đưa topic về trạng thái `status = 'draft'`.
  3. Hủy bỏ (cancel) submission pending đang mở nếu có với lý do audit rõ ràng.
  4. Đóng rescue record: `status = 'restored'`, `completed_at = now()`, `completed_by_user_id = auth.uid()`.
  5. Rescuer $B$ hoàn toàn rời khỏi active workflow của bài học.
  6. Toàn bộ lịch sử từ chối của cả đợt thông thường lẫn đợt rescue được giữ nguyên vẹn để phục vụ audit.

### 3.5. Hành vi Xóa bài học (`Xóa bài học`)
* Wording trên UI luôn là `Xóa bài học`.
* Khả dụng tại **bất kỳ thời điểm nào** trong suốt rescue do Owner/Co-owner thực hiện.
* Hành động nguyên tử:
  1. Cập nhật `topics.removed_at = now()`, `topics.status = 'draft'`.
  2. Hủy bỏ submission pending nếu có (`status = 'cancelled'`).
  3. Đóng rescue record: `status = 'deleted'`.
  4. Bài học bị ẩn khỏi cây cấu trúc khóa học và không còn thực hiện được bất kỳ action nào khác.

---

## 4. Thiết kế Chi tiết Kiến trúc Đa tầng (Detailed Architecture)

### 4.1. Tầng Database Persistence (Bảng và Ràng buộc Mới)

Bổ sung bảng chuyên biệt sở hữu trạng thái của đợt rescue: `public.topic_review_rescues`. Không nhồi nhét trạng thái vào bảng submissions hay escalations cũ.

```sql
create table public.topic_review_rescues (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.topics(id) on delete cascade,
  source_escalation_id uuid not null references public.topic_review_escalations(id) on delete cascade,
  rescuer_user_id uuid not null references public.profiles(id),
  original_responsible_user_id uuid not null references public.profiles(id),
  status text not null default 'active',
  rejection_count integer not null default 0,
  latest_rejection_submission_id uuid references public.topic_review_submissions(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  completed_by_user_id uuid references public.profiles(id),
  completion_reason text,

  constraint topic_review_rescues_status_check
    check (status in ('active', 'failed', 'approved', 'restored', 'deleted')),
  constraint topic_review_rescues_rejection_count_check
    check (rejection_count >= 0 and rejection_count <= 3),
  constraint topic_review_rescues_terminal_state_check
    check (
      (status = 'active' and completed_at is null and completed_by_user_id is null) or
      (status <> 'active' and completed_at is not null and completed_by_user_id is not null)
    )
);

-- Bảo đảm tại một thời điểm chỉ có tối đa 1 active rescue cho mỗi topic
create unique index topic_review_rescues_one_active_idx
  on public.topic_review_rescues (topic_id)
  where status = 'active';

-- Bảo đảm mỗi held escalation chỉ có tối đa 1 rescue (chống rescue chain)
create unique index topic_review_rescues_one_per_escalation_idx
  on public.topic_review_rescues (source_escalation_id);

create index topic_review_rescues_topic_idx
  on public.topic_review_rescues (topic_id, created_at desc);

alter table public.topic_review_rescues enable row level security;
revoke all on table public.topic_review_rescues from public, anon, authenticated;
grant select on table public.topic_review_rescues to authenticated;
grant all on table public.topic_review_rescues to service_role;
```

Đồng thời mở rộng bảng `topic_review_submissions`:
* Bổ sung cột `rescue_id uuid references public.topic_review_rescues(id) on delete set null`.

### 4.2. Tầng RPC State Machine Transitions

Thay thế hàm rescue gộp hiện tại bằng các RPC có ranh giới ngữ nghĩa độc lập, rõ ràng:

#### 1. `start_topic_rescue(p_topic_id uuid, p_escalation_id uuid)`
* **Quyền thực thi**: Chỉ Course Owner hoặc Co-owner (`is_course_owner_or_co_owner`). Caller $B$ phải khác submitter bị giữ $A$.
* **Khóa đồng thời (Locking)**:
  `pg_advisory_xact_lock(course_id)` $\rightarrow$ `pg_advisory_xact_lock(topic_id)` $\rightarrow$ `SELECT FOR UPDATE` trên topic và escalation.
* **Kiểm tra nghiệp vụ**:
  - Escalation phải đang `unresolved = true`.
  - Topic phải có `status = 'draft'` và `removed_at IS NULL`.
  - Không có pending submission nào đang mở.
  - Không có active rescue nào trên topic (`topic_review_rescues`).
  - Chưa từng có rescue nào gắn với `p_escalation_id`.
  - Kiểm tra điều kiện có ít nhất một reviewer độc lập $R$ ($R \notin \{A, B, \text{contributors}\}$).
* **Thao tác**:
  - Đổi `topics.responsible_author_user_id = B` (bằng cách bật cờ trusted session `voca.d1_topic_authorship = 'on'`).
  - Giữ nguyên `topics.status = 'draft'`. Tuyệt đối **KHÔNG tạo submission** và **KHÔNG set pending**.
  - Insert bản ghi vào `topic_review_rescues`: `topic_id`, `source_escalation_id`, `rescuer_user_id = B`, `original_responsible_user_id = A`, `status = 'active'`, `rejection_count = 0`.
  - Trả về JSONB chứa thông tin rescue đã khởi tạo thành công.

#### 2. `request_topic_review(p_topic_id uuid)`
* **Quyền thực thi**: Caller phải là `responsible_author_user_id` hiện tại.
  - Nếu topic ở luồng thông thường: Caller là $A$, không có escalation unresolved.
  - Nếu topic đang trong rescue active: Caller phải là Rescuer $B$.
* **Kiểm tra nghiệp vụ**:
  - Đủ readiness: $\ge 1$ flashcard và $\ge 1$ bài tập còn hoạt động.
  - Topic `status = 'draft'` và `removed_at IS NULL`.
  - Có reviewer độc lập hợp lệ ($R \notin \{A, B, \text{contributors}\}$).
  - Nếu trong rescue active: `topic_review_rescues.rejection_count < 3` (rescue chưa failed).
* **Thao tác**:
  - Chèn dòng mới vào `topic_review_submissions` với:
    `submitted_by_user_id = auth.uid()`, `status = 'pending'`, `rescue_id = active_rescue.id` (nếu có rescue).
  - Cập nhật `topics.status = 'pending'` (đóng băng nội dung trong thời gian review).

#### 3. `reject_topic_review(p_submission_id uuid, p_reason text)`
* **Quyền thực thi**: Reviewer độc lập hợp lệ (`has_topic_review_access`). Không được tự review chính mình.
* **Thao tác**:
  - Cập nhật submission: `status = 'rejected'`, ghi nhận `reviewed_by_user_id`, `reviewed_at`, `rejection_reason`.
  - Cập nhật `topics.status = 'draft'`.
  - **Phân nhánh xử lý ngân sách**:
    * **Trường hợp A: Submission thuộc Rescue (`rescue_id IS NOT NULL`)**:
      - Tăng `topic_review_rescues.rejection_count = rejection_count + 1`.
      - Cập nhật `latest_rejection_submission_id = p_submission_id`.
      - Nếu `rejection_count = 3`: Cập nhật `topic_review_rescues.status = 'failed'`, `completed_at = now()`, `completion_reason = 'Exhausted 3/3 rescue rejection budget'`.
      - **TUYỆT ĐỐI KHÔNG INSERT escalation mới**.
    * **Trường hợp B: Submission thông thường (`rescue_id IS NULL`)**:
      - Đếm số lần bị từ chối của tác giả thường trong đợt hiện tại.
      - Nếu chạm lần thứ 3: Chèn bản ghi vào `topic_review_escalations` (`unresolved = true`), đưa bài học vào trạng thái tạm giữ (Held).

#### 4. `approve_topic_review(p_submission_id uuid)`
* **Quyền thực thi**: Reviewer độc lập hợp lệ (`has_topic_review_access`).
* **Thao tác**:
  - Cập nhật submission: `status = 'approved'`, `reviewed_by_user_id`, `reviewed_at`.
  - Cập nhật `topics.status = 'published'` (trigger tự động gán `first_approved_at = now()` nếu là lần đầu).
  - Nếu submission thuộc rescue:
    - Cập nhật `topic_review_rescues.status = 'approved'`, `completed_at = now()`, `completed_by_user_id = auth.uid()`.
    - Đóng escalation gốc: `unresolved = false`, `resolution_action = 'rescue'`, `resolved_by_user_id = auth.uid()`, `resolved_at = now()`.

#### 5. `restore_topic_rescue(p_topic_id uuid, p_rescue_id uuid, p_reason text)`
* **Quyền thực thi**: Chỉ Course Owner hoặc Co-owner.
* **Điều kiện**: Rescue record phải thuộc `p_topic_id`, ở trạng thái `status in ('active', 'failed')`.
* **Thao tác nguyên tử**:
  - Nếu topic đang có submission `pending`: Cập nhật submission `status = 'cancelled'`, `cancelled_by_user_id = auth.uid()`, `cancellation_reason = 'Rescue cancelled via restore'`.
  - Đổi lại quyền chịu trách nhiệm: `topics.responsible_author_user_id = rescue.original_responsible_user_id` (trả về $A$).
  - Đưa `topics.status = 'draft'`.
  - Cập nhật rescue: `status = 'restored'`, `completed_at = now()`, `completed_by_user_id = auth.uid()`, `completion_reason = p_reason`.
  - Đóng escalation gốc với action `'restored_to_draft'` hoặc reset đợt held theo quyết định của Owner.

#### 6. `delete_topic_from_rescue(p_topic_id uuid, p_rescue_id uuid, p_reason text)`
* **Quyền thực thi**: Chỉ Course Owner hoặc Co-owner.
* **Thao tác nguyên tử**:
  - Soft-delete topic: `topics.removed_at = now()`, `topics.status = 'draft'`.
  - Hủy submission pending nếu có: `status = 'cancelled'`.
  - Cập nhật rescue: `status = 'deleted'`, `completed_at = now()`, `completed_by_user_id = auth.uid()`, `completion_reason = p_reason`.
  - Đóng escalation gốc: `unresolved = false`, `resolution_action = 'abandon'`.

### 4.3. Tầng Authorization & RLS Policies

1. **Sửa đổi `d1_topic_group_member(p_topic_id uuid)`**:
   Được cập nhật để phản ánh chính xác nhóm có quyền sửa bài:
   ```sql
   create or replace function public.d1_topic_group_member(p_topic_id uuid)
   returns boolean language sql stable security definer set search_path = public as $$
     select auth.uid() is not null and exists (
       select 1
       from public.topics t
       join public.courses c on c.id = t.course_id
       join public.course_collaborators cc on cc.course_id = t.course_id and cc.user_id = auth.uid()
       left join public.topic_review_rescues r on r.topic_id = t.id and r.status in ('active', 'failed')
       where t.id = p_topic_id
         and t.removed_at is null
         and c.removed_at is null
         and cc.role in ('owner', 'co_owner', 'editor')
         -- Khi rescue failed ở 3/3: khóa toàn bộ quyền sửa
         and coalesce(r.status, '') <> 'failed'
         and (
           -- Trách nhiệm hiện tại (A trong ordinary, B trong active rescue)
           t.responsible_author_user_id = auth.uid()
           -- Người tạo ban đầu A được sửa nếu rescue đang active
           or (r.status = 'active' and t.original_creator_user_id = auth.uid())
           -- Contributors hiện tại luôn được sửa nếu không bị freeze/failed
           or exists (
             select 1 from public.topic_contributors tc
             where tc.topic_id = t.id and tc.user_id = auth.uid() and tc.removed_at is null
           )
         )
     );
   $$;
   ```

2. **Sửa đổi `d1_is_topic_reviewer_excluded(p_topic_id uuid, p_user_id uuid)`**:
   Quy tắc loại trừ reviewer trở thành Single Source of Truth (SSOT), bảo vệ tính độc lập tuyệt đối:
   ```sql
   create or replace function public.d1_is_topic_reviewer_excluded(
     p_topic_id uuid,
     p_user_id uuid
   ) returns boolean language sql stable security definer set search_path = public as $$
     select exists (
       select 1
       from public.topics t
       left join public.topic_review_rescues r on r.topic_id = t.id and r.status = 'active'
       where t.id = p_topic_id
         and (
           -- 1. Loại trừ người chịu trách nhiệm hiện tại
           t.responsible_author_user_id = p_user_id
           -- 2. Loại trừ người tạo ban đầu (trước duyệt lần đầu hoặc trong thời gian rescue)
           or ((t.first_approved_at is null or r.id is not null) and t.original_creator_user_id = p_user_id)
           -- 3. Loại trừ rescuer đang active
           or (r.rescuer_user_id = p_user_id)
           -- 4. Loại trừ toàn bộ contributors hiện tại
           or exists (
             select 1 from public.topic_contributors tc
             where tc.topic_id = t.id and tc.user_id = p_user_id and tc.removed_at is null
           )
           -- 5. Loại trừ lịch sử bất biến trước first approval
           or (
             t.first_approved_at is null and exists (
               select 1 from public.topic_author_review_exclusions e
               where e.topic_id = t.id and e.user_id = p_user_id
             )
           )
         )
     );
   $$;
   ```

3. **Quyền Xóa Topic**: Cập nhật `d1_prepare_topic_content_mutation` để cho phép Course Owner/Co-owner thực hiện xóa topic kể cả khi không thuộc `d1_topic_group_member`.

### 4.4. Tầng Canonical Read Model (`get_topic_workflow_state`)

Sửa đổi toàn diện `get_topic_workflow_state` để trả về đúng DTO tách bạch giữa **Canonical State** (bất biến với mọi caller) và **Capability Flags** (tính theo vai trò caller):

#### Các trường Canonical Workflow State (Giống nhau 100% cho mọi caller có quyền đọc)
* `status`: Trạng thái topic (`draft`, `pending`, `published`).
* `ordinaryRejectionCount`: Số lần từ chối đợt thông thường (0..3).
* `latestRejectionReason`, `latestRejectionReviewer`, `latestRejectionAt`: Thông tin phản hồi từ chối gần nhất của bài học.
* `escalationUnresolved`: Cờ boolean báo bài học đang bị tạm giữ bởi escalation thông thường.
* `rescueStatus`: Trạng thái rescue (`null`, `'active'`, `'failed'`, `'approved'`, `'restored'`, `'deleted'`).
* `rescueRescuer`: Thông tin định danh của Rescuer B (nếu có).
* `rescueRejectionCount`: Số lần từ chối trong đợt rescue (0..3).
* `isReady`: Đủ điều kiện flashcard/exercise hay chưa.
* `hasDistinctEligibleReviewer`: Có người duyệt độc lập khả dụng hay không.
* `pendingSubmissionId`, `pendingSubmitterId`: Thông tin submission đang chờ duyệt (nếu có).

#### Các trường Role-specific Capability Flags (Tính riêng theo `auth.uid()`)
* `canEdit`: Caller có quyền sửa bài hay không.
* `canRequestReview` (hoặc `canSubmit`): Caller có quyền nhấn Gửi duyệt lúc này hay không.
* `canReview`: Caller có quyền Duyệt / Từ chối hay không.
* `canStartRescue`: Caller có quyền bắt đầu rescue hay không (chỉ Owner/Co-owner, khi topic held và chưa có rescue).
* `canRestoreRescue`: Caller có quyền Khôi phục về bản nháp hay không (chỉ Owner/Co-owner trong suốt rescue).
* `canDeleteTopic`: Caller có quyền Xóa bài học hay không (chỉ Owner/Co-owner).
* `canViewRejectionBudget`: **Cờ kiểm soát hiển thị ngân sách từ chối**. Giá trị `true` cho author/owner/co-owner; giá trị `false` đối với người duyệt thông thường (`ordinary reviewer`).

### 4.5. Tầng Server Actions, Zod Schemas và Frontend UI

#### 1. Server Actions (`app/actions/topic-review.ts`)
* Tách biệt các Server Actions tường minh:
  - `startTopicRescueAction({ topicId, escalationId })`
  - `requestTopicReviewAction({ topicId })`
  - `approveTopicReviewAction({ submissionId })`
  - `rejectTopicReviewAction({ submissionId, reason })`
  - `restoreTopicRescueAction({ topicId, rescueId, reason })`
  - `deleteTopicFromRescueAction({ topicId, rescueId, reason })`
* Loại bỏ việc gọi `resolveTopicReviewEscalationAction` với `action = 'rescue'`.
* Tự động revalidate path: `getCourseOverviewPath` và `getCourseStructurePath`.

#### 2. Zod Schemas (`lib/schemas/topic-workflow.ts` & `topic-review.ts`)
* Cập nhật `topicWorkflowSchema` với các trường canonical và capabilities mới.
* Loại bỏ các trường phái sinh sai lệch như `pendingSubmissionIsRescue`, `isCurrentUserSubmitter`.
* Thêm Zod schemas cho các action mới: `startTopicRescueSchema`, `restoreTopicRescueSchema`, `deleteTopicRescueSchema`.

#### 3. Frontend UI (`TopicWorkflowPanel.tsx`)
Thiết kế lại panel luồng duyệt để thể hiện đúng các kịch bản nghiệp vụ:

* **Kịch bản 1: Topic bị Tạm giữ (Ordinary Held - 3/3)**
  - Hiển thị hộp cảnh báo màu cam: *"Bài học đã nhận 3/3 phản hồi từ chối và đang tạm giữ để giải cứu hoặc xử lý."*
  - Nếu caller là Owner/Co-owner: Hiển thị nút **"Tiếp nhận trách nhiệm và giải cứu"** (`startTopicRescueAction`).
  - Không hiển thị nút "Gửi nhờ người duyệt khác" (tránh hiểu lầm là gửi duyệt hộ).
* **Kịch bản 2: Rescue đang Soạn thảo (Rescue Active - Draft)**
  - Hiển thị banner xanh: *"Bài học đang trong đợt giải cứu bởi [Tên Rescuer B]. Trách nhiệm biên tập thuộc về [B]."*
  - Nếu caller là $B$: Hiển thị nút **"Gửi duyệt"** (chỉ enabled khi đủ card + exercise và có reviewer).
  - Nếu caller là $A$ hoặc Contributor: Hiển thị trạng thái được phép chỉnh sửa nội dung, nhưng **không có nút gửi duyệt**.
  - Nếu caller là Owner/Co-owner: Hiển thị 2 nút: **"Khôi phục về bản nháp"** và **"Xóa bài học"**.
* **Kịch bản 3: Rescue đang Chờ duyệt (Rescue Pending)**
  - Topic bị đóng băng nội dung.
  - Reviewer độc lập thấy 2 nút: **"Duyệt"** và **"Từ chối"**.
  - **Giao diện Reviewer tuyệt đối KHÔNG hiển thị ngân sách từ chối** (`canViewRejectionBudget = false`).
* **Kịch bản 4: Rescue bị Từ chối lần 1/3 hoặc 2/3**
  - Hiển thị lý do từ chối gần nhất.
  - Hiển thị số lần phản hồi đợt giải cứu: *"Đợt giải cứu đã nhận X/3 lần phản hồi."* (chỉ hiện cho author/rescuer/owner, ẩn với reviewer).
  - Rescuer $B$ chỉnh sửa nội dung và có nút **"Gửi duyệt lại"**.
  - Owner/Co-owner vẫn có 2 nút: **"Khôi phục về bản nháp"** và **"Xóa bài học"**.
* **Kịch bản 5: Rescue Thất bại ở 3/3 (Rescue Failed - Terminal State)**
  - Hiển thị hộp cảnh báo màu đỏ đậm: *"Đợt giải cứu đã không thành công sau 3 lần chỉnh sửa. Bài học đã kết thúc chu trình gửi duyệt."*
  - Toàn bộ quyền soạn thảo và nút gửi duyệt bị **ẨN HOÀN TOÀN**.
  - **CHỈ HIỂN THỊ DUY NHẤT 2 NÚT HÀNH ĐỘNG CHO OWNER/CO-OWNER**:
    1. **"Khôi phục về bản nháp"** (hoàn tác B $\rightarrow$ A về bản nháp);
    2. **"Xóa bài học"** (ẩn bài học).

---

## 5. Kế hoạch Di chuyển Dữ liệu và Đối soát (Migration & Data Reconciliation)

Để triển khai schema mới mà không làm hỏng dữ liệu staging/production hiện có:

### 5.1. Kiểm kê Dữ liệu trước Migration (Pre-migration Inventory Query)
Chạy script kiểm kê ở chế độ read-only để phát hiện toàn bộ các bản ghi chịu ảnh hưởng của contract drift cũ:
1. Đếm số lượng topic có `topic_review_escalations` đang `unresolved = true`.
2. Đếm số lượng submission có `rescue_escalation_id IS NOT NULL`.
3. Tìm toàn bộ các trường hợp drift: `topic_review_submissions.submitted_by_user_id <> topics.responsible_author_user_id`.
4. Tìm các topic có nhiều hơn 1 escalation unresolved (hậu quả của bug rescue chain).
5. Xuất danh sách topic IDs và escalation IDs cần xử lý.

### 5.2. Chiến lược Chuyển đổi và Đối soát Dữ liệu (Backfill Strategy)
1. **Tạo bảng mới `topic_review_rescues`**: Áp dụng DDL, index và constraints.
2. **Backfill các rescue records từ submissions cũ**:
   - Với mỗi submission có `rescue_escalation_id`:
     - Nếu topic hiện đang pending: Tạo bản ghi `topic_review_rescues` với `status = 'active'`, `rescuer_user_id = submission.submitted_by_user_id`, `original_responsible_user_id = topics.responsible_author_user_id`.
     - Cập nhật đồng bộ `topics.responsible_author_user_id = submission.submitted_by_user_id` để đưa về đúng trạng thái rescue active!
   - Nếu submission rescue cũ đã bị reject và topic đang ở draft:
     - Tính số lần reject của rescuer để điền vào `topic_review_rescues.rejection_count`.
     - Nếu đã đạt 3 lần: Set `status = 'failed'`.
   - Nếu submission rescue cũ đã được approve:
     - Tạo bản ghi `topic_review_rescues` với `status = 'approved'`.
3. **Cách ly dữ liệu mâu thuẫn (Ambiguity Quarantine)**:
   - Nếu phát hiện 1 topic có từ 2 escalation unresolved trở lên (do chuỗi rescue cũ):
     - Không tự tiện chọn lựa. Đóng các escalation trùng lặp với lý do `'legacy_drift_reconciled'`.
     - Giữ lại duy nhất 1 escalation hợp lệ nhất để Owner quyết định.
4. **Bảo tồn Audit Trail**: Không sửa đổi hay xóa lịch sử actor trong `topic_review_submissions`.

### 5.3. Xác thực sau Migration (Post-migration Assertions)
Chạy bộ kiểm tra tự động sau migration:
- Assert: Không còn bất kỳ topic nào đang rescue mà `topics.responsible_author_user_id` bị lệch với rescuer.
- Assert: Không còn topic nào có $>1$ active rescue.
- Assert: Mọi rescue có `rejection_count` thuộc $[0, 3]$.
- Assert: Mọi topic `status = 'published'` đều có `first_approved_at IS NOT NULL`.

---

## 6. Xử lý Race Conditions và Stale Actions (Concurrency & Locking)

Toàn bộ các tác vụ thay đổi trạng thái bắt buộc phải được bọc trong database transaction với chiến lược khóa đa tầng nhất quán:

```text
Cấp 1: pg_advisory_xact_lock(hashtext(course_id::text))
Cấp 2: pg_advisory_xact_lock(hashtext(topic_id::text))
Cấp 3: SELECT * FROM topics WHERE id = topic_id FOR UPDATE
Cấp 4: SELECT * FROM topic_review_rescues / escalations FOR UPDATE
```

### Bảng Phân tích và Xử lý 6 Điểm Xung đột Đồng thời (Race Matrix)

| Cặp thao tác đồng thời | Rủi ro xung đột | Chiến lược xử lý an toàn | Kết quả kỳ vọng |
| :--- | :--- | :--- | :--- |
| **1. Hai Owner cùng bấm "Giải cứu" đồng thời** | Tạo ra 2 active rescue song song cho cùng 1 bài học. | Lock Course + Lock Topic. Transaction đầu tiên tạo rescue thành công; Transaction thứ hai gặp check `EXISTS active rescue` và partial unique index `topic_review_rescues_one_active_idx`. | 1 Owner thành công; Owner kia nhận lỗi domain sạch: `TOPIC_REVIEW_RESCUE_ALREADY_ACTIVE`. |
| **2. Rescuer bấm "Gửi duyệt" đồng thời với Owner bấm "Khôi phục về nháp"** | Tạo ra submission pending mồ côi sau khi bài đã trả về nháp cho tác giả cũ. | Lock Topic. Nếu Restore commit trước: Gửi duyệt gặp topic ở responsible $A$ $\rightarrow$ Bị chặn (`TOPIC_RESPONSIBLE_AUTHOR_REQUIRED`). Nếu Gửi duyệt commit trước: Restore thấy submission pending $\rightarrow$ Hủy atomic submission (`status = 'cancelled'`) và đưa về draft. | Không bao giờ để lại orphan pending submission. Trạng thái cuối cùng luôn nhất quán. |
| **3. Reviewer bấm "Từ chối" đồng thời với Owner bấm "Khôi phục về nháp"** | Rejection count tăng sai sau khi rescue đã bị hủy. | Lock Topic + Lock Rescue row `FOR UPDATE`. Rejection kiểm tra `rescue.status = 'active'`. Nếu đã bị restore (`status = 'restored'`), rollback hoặc bỏ qua tăng count. | Rejection count của rescue không tăng sai; topic trả về nháp cho $A$. |
| **4. Owner bấm "Xóa bài học" đồng thời với Rescuer "Gửi duyệt"** | Tạo ra pending submission trên một bài học đã bị xóa. | Lock Topic. Delete cập nhật `removed_at = now()` và cancel pending submission. Lệnh gửi duyệt kiểm tra `removed_at IS NULL` $\rightarrow$ Văng lỗi `TOPIC_NOT_FOUND`. | Bài học bị xóa an toàn, không có submission mồ côi. |
| **5. Lần từ chối thứ 3 đồng thời với lệnh Resubmit** | Vượt quá ngân sách 3 lần từ chối cho phép. | Row lock trên pending submission và rescue record. Khi reject lần 3 commit, rescue chuyển `status = 'failed'`. Lệnh resubmit sau đó kiểm tra `rescue.status = 'active'` $\rightarrow$ Văng lỗi `TOPIC_REVIEW_RESCUE_FAILED`. | Không có lần submit thứ 4; trạng thái terminal 3/3 được bảo toàn. |
| **6. Thêm Contributor đồng thời với Reviewer kiểm tra điều kiện duyệt** | Contributor vừa được thêm lại chính là Reviewer đang nhấn duyệt bài. | Hàm duyệt (`approve_topic_review`) kiểm tra lại `d1_is_topic_reviewer_excluded` ngay trong transaction duyệt sau khi đã lock topic. | Giao dịch duyệt bị chặn ngay lập tức (`TOPIC_REVIEW_FORBIDDEN` / `SELF_REVIEW`), bảo toàn tính độc lập khách quan. |

---

## 7. Kế hoạch Kiểm thử Toàn diện (Test Strategy & Test Plan)

### 7.1. Cập nhật các Test hiện có đang mã hóa Sai lệch
1. **`__tests__/integration/topic-review-lifecycle.test.ts`**:
   - **L392 (`serializes third rejection, creation hold, rescue and approval`)**:
     * Sửa: Bỏ assert `rescuedSubmission` tồn tại ngay sau rescue.
     * Thêm: Assert sau rescue, `topics.responsible_author_user_id` chuyển sang Teacher B, `topics.status = 'draft'`.
     * Thêm bước: Teacher B gọi `request_topic_review` $\rightarrow$ lúc này mới có pending submission do B gửi.
     * Thêm bước: Reviewer duyệt $\rightarrow$ topic thành published.
   - **L452 (`resets the active rejection episode after terminal close`)**:
     * Sửa: Bỏ assert `ordinaryReviewerWorkflow.rejectionCount === 0`. Thay bằng assert `rejectionCount` chuẩn canonical hiển thị như nhau cho các roles.
   - **L631 (`does not publish a rescue while another topic escalation remains unresolved`)**:
     * Sửa: Loại bỏ việc insert thủ công 2 open escalation trên 1 topic. Thay bằng test assert partial unique index chặn đứng việc tạo escalation/rescue thứ hai.
2. **`__tests__/components/topic-workflow-panel.test.tsx`**:
   - **L101 (`hides duplicate rescue action and explains close consequence`)**:
     * Cập nhật fixture: Không dùng `pendingSubmissionIsRescue` hay `isCurrentUserSubmitter`. Dùng `rescueStatus: 'active'`, `canRestoreRescue: true`, `canDeleteTopic: true`.
     * Assert các nút hiển thị đúng: "Khôi phục về bản nháp", "Xóa bài học", "Gửi duyệt".
   - **L78 (`shows current rejection provenance`)**:
     * Thêm test case: Khi render dưới vai trò Ordinary Reviewer (`canReview: true, canEdit: false, canManageAuthorship: false`), dòng chữ `"Bạn đã nhận x/3 lần phản hồi"` **KHÔNG XUẤT HIỆN trong DOM**.
3. **`__tests__/schemas/topic-workflow.test.ts`**:
   - Cập nhật DTO schema test theo các trường canonical mới.

### 7.2. Các Test Suites mới Bắt buộc Bổ sung

#### Suite 1: Integration Test Vòng đời Hoàn chỉnh của Rescue (`topic-rescue-lifecycle.test.ts`)
1. **Test Full Budget 3/3**:
   - Topic bị hold ở 3/3 $\rightarrow$ Owner B start rescue $\rightarrow$ verify B là responsible, topic draft.
   - Rescuer B submit lần 1 $\rightarrow$ pending $\rightarrow$ Reviewer reject $\rightarrow$ verify topic draft, rescue count = 1/3.
   - Rescuer B sửa bài và submit lần 2 $\rightarrow$ pending $\rightarrow$ Reviewer reject $\rightarrow$ verify topic draft, rescue count = 2/3.
   - Rescuer B sửa bài và submit lần 3 $\rightarrow$ pending $\rightarrow$ Reviewer reject $\rightarrow$ verify topic draft, rescue count = 3/3, rescue `status = 'failed'`.
   - Cố tình submit lần 4 $\rightarrow$ Bị từ chối (`TOPIC_REVIEW_RESCUE_FAILED`).
   - Cố tình start rescue lần 2 $\rightarrow$ Bị từ chối (`TOPIC_REVIEW_SINGLE_RESCUE_VIOLATION`).
2. **Test Quyền Soạn thảo trong Rescue**:
   - Trong khi rescue ở draft: Cả A, B và Contributor C đều update được thẻ flashcard / bài tập.
   - Nhưng chỉ B mới gọi được `request_topic_review`. A hoặc C gọi bị văng `TOPIC_RESPONSIBLE_AUTHOR_REQUIRED`.
   - Khi rescue chạm 3/3 failed: Khóa quyền sửa đối với cả A, B và C.
3. **Test Khôi phục về bản nháp (`restore_topic_rescue`)**:
   - Restore tại draft (0/3, 1/3, 2/3) $\rightarrow$ verify responsible trả về A, rescue đóng (`restored`), B rời workflow.
   - Restore khi đang có pending submission $\rightarrow$ verify submission bị cancelled an toàn, topic về draft cho A.
   - Restore khi rescue đã failed ở 3/3 $\rightarrow$ verify topic về draft cho A.
4. **Test Xóa bài học (`delete_topic_from_rescue`)**:
   - Delete tại draft, pending, hoặc 3/3 failed $\rightarrow$ verify `topics.removed_at IS NOT NULL`, pending submission bị cancelled.
5. **Test Reviewer Exclusion**:
   - Khẳng định Creator A, Rescuer B, Contributor C đều bị từ chối khi cố duyệt bài (`TOPIC_REVIEW_FORBIDDEN` / `SELF_REVIEW`).
   - Chỉ reviewer độc lập thứ tư mới duyệt được bài.

#### Suite 2: Integration Test Concurrency & Race (`topic-rescue-concurrency.test.ts`)
1. Test concurrent start rescue: 2 transaction chạy song song, đúng 1 thắng.
2. Test concurrent submit vs restore: Không để lại pending submission mồ côi.
3. Test concurrent review reject vs restore: Count không tăng sai.
4. Test concurrent delete vs submit: Topic bị xóa an toàn.

---

## 8. Các Giai đoạn Triển khai (Implementation Phases & Dependency Order)

Khi được Owner phê duyệt kế hoạch, quá trình triển khai sẽ tuân thủ nghiêm ngặt thứ tự phụ thuộc (Dependency Graph):

```text
Phase P0-C (Chuẩn bị & Đối soát Dữ liệu)
    │
    ▼
Phase P1-C (Database Schema, Table topic_review_rescues & Core RPCs)
    │
    ▼
Phase P2-C (Authorization / RLS & Canonical Read Model get_topic_workflow_state)
    │
    ▼
Phase P3-C (Server Actions, Zod Schemas & Frontend TopicWorkflowPanel UI)
    │
    ▼
Phase P4-C (Cập nhật Test Suite cũ, Bổ sung Integration & Concurrency Tests)
    │
    ▼
Review Checkpoint (Báo cáo nghiệm thu & Đề xuất Commit)
```

### Chi tiết từng Phase:

* **Phase P0-C: Chuẩn bị & Kiểm kê Dữ liệu (Inventory)**
  - Chốt quyết định về ngữ nghĩa sau khi restore (Mục 9).
  - Chạy script kiểm kê read-only dữ liệu staging/local để xác định số lượng escalation/submission drift cần chuyển đổi.
* **Phase P1-C: Database Migration & RPC State Machine**
  - Viết migration tạo bảng `public.topic_review_rescues` kèm foreign keys, partial unique indexes và constraints.
  - Viết các RPC: `start_topic_rescue`, sửa `request_topic_review`, `reject_topic_review`, `approve_topic_review`, `restore_topic_rescue`, `delete_topic_from_rescue`.
  - Viết migration backfill dữ liệu lịch sử an toàn.
* **Phase P2-C: Authorization/RLS & Canonical Read Model**
  - Cập nhật hàm `d1_topic_group_member` (hỗ trợ nhóm A + B + contributors khi rescue active; khóa khi failed).
  - Cập nhật hàm `d1_is_topic_reviewer_excluded` (loại trừ A, B, contributors triệt để).
  - Cập nhật hàm `d1_delete_topic` / prepare mutation cho phép Owner/Co-owner xóa bài.
  - Viết lại `get_topic_workflow_state` trả về dữ liệu canonical độc lập với caller + cờ `canViewRejectionBudget`.
* **Phase P3-C: Server Actions, Schemas & Frontend UI**
  - Cập nhật Zod schemas trong `lib/schemas/topic-workflow.ts` và `lib/schemas/topic-review.ts`.
  - Viết các Server Actions mới trong `app/actions/topic-review.ts`.
  - Cập nhật component `TopicWorkflowPanel.tsx`:
    * Render đúng các nút bấm: "Tiếp nhận trách nhiệm và giải cứu", "Gửi duyệt", "Gửi duyệt lại", "Khôi phục về bản nháp", "Xóa bài học".
    * Trạng thái 3/3 failed chỉ hiển thị 2 nút duy nhất.
    * Ẩn hoàn toàn `x/3` ngân sách từ chối đối với Reviewer UI.
* **Phase P4-C: Test Suite & Verification**
  - Sửa các test cũ đang assert drift trong `topic-review-lifecycle.test.ts` và component tests.
  - Bổ sung integration tests vòng đời rescue và concurrency tests.
  - Chạy toàn bộ deterministic tests (unit, schemas, components, integration RPC).

---

## 9. Tự Đánh giá Kế hoạch (Author Self-Review)

Áp dụng phương pháp tự rà soát theo `docs/agent-self-review.md` và `docs/agent-loops.md`:

1. **Tính trọn vẹn hợp đồng (Contract Completeness)**:
   - Đã bao phủ 100% các điểm trong hợp đồng Owner đã chốt: Tách biệt `creator` và `responsible`, Rescue là tiếp quản trách nhiệm và không auto-submit, nhóm tác giả `A + B + contributors` được sửa trong rescue, loại trừ reviewer triệt để, single rescue (chống rescue chain), ngân sách từ chối 3/3 riêng cho rescue, quyền `Khôi phục về bản nháp` (Ctrl+Z) và `Xóa bài học` tại mọi thời điểm, chỉ còn 2 action sau 3/3, read model canonical, và ẩn rejection budget trên reviewer UI.
2. **An toàn Kiến trúc và Đua trạng thái (Architecture & Race Safety)**:
   - Kiến trúc tách bảng `topic_review_rescues` giúp phân định ranh giới sở hữu nghiệp vụ rõ ràng, không làm biến dạng bảng submissions hay escalations.
   - Toàn bộ state transitions được bảo vệ bởi cả database check constraints, partial unique index và 4 cấp độ lock (Advisory Course lock $\rightarrow$ Advisory Topic lock $\rightarrow$ Topic row lock $\rightarrow$ Rescue row lock).
   - Xử lý triệt để nguy cơ mồ côi pending submission khi restore/delete.
3. **An toàn Di chuyển Dữ liệu (Migration Safety)**:
   - Có giai đoạn kiểm kê (inventory) trước khi chạy DDL.
   - Chiến lược backfill có điều kiện, cách ly dữ liệu mâu thuẫn (quarantine), không rewrite lịch sử audit actor cũ.
   - Có assertions tự động xác nhận tính toàn vẹn dữ liệu sau migration.
4. **Độ phủ Kiểm thử (Test Coverage)**:
   - Xác định chính xác 4 nhóm drift trong test suite hiện tại cần sửa đổi.
   - Thiết kế 2 test suites mới bao quát đầy đủ happy paths, failure paths, boundary conditions và race conditions.

---

## 10. Các Quyết định Mở cần Owner Xác nhận (Open Decisions & Blocker Assessment)

Trước khi tiến hành code implementation, cần Owner xác nhận **2 quyết định nghiệp vụ tinh chỉnh (Refinement Decisions)**:

> [!IMPORTANT]
> **Quyết định 1: Ngữ nghĩa của Held Episode sau khi `Khôi phục về bản nháp` (Restore)**
> Khi Owner/Co-owner thực hiện "Khôi phục về bản nháp" (Ctrl+Z đợt rescue để trả responsible về cho $A$ ở trạng thái draft):
> - *Lựa chọn 1A (Đề xuất)*: Escalation cũ được đóng với trạng thái `'restored'`, cho phép tác giả $A$ tiếp tục chỉnh sửa bài học và gửi lại một lượt duyệt mới (mở một episode duyệt thông thường mới). Toàn bộ lịch sử từ chối và rescue cũ vẫn được lưu trong audit log.
> - *Lựa chọn 1B*: Topic trả về draft cho $A$ nhưng trạng thái Held cũ vẫn được giữ nguyên (không cho $A$ gửi duyệt lại). Muốn gửi duyệt bắt buộc phải có một đợt can thiệp khác.
> *(Kế hoạch đang mặc định đi theo Lựa chọn 1A để đảm bảo ý nghĩa phục hồi của Ctrl+Z).*

> [!NOTE]
> **Quyết định 2: Phạm vi của Single Rescue Invariant**
> - *Lựa chọn 2A (Đề xuất)*: "Duy nhất 1 rescue" được định nghĩa là **duy nhất 1 rescue cho mỗi held episode**. Nếu một bài học trong tương lai xa (sau khi đã được duyệt hoặc sau một chu trình mới) bị held lại ở một episode độc lập khác, Owner vẫn có thể rescue episode mới đó.
> - *Lựa chọn 2B*: Duy nhất 1 rescue trên **toàn bộ vòng đời vĩnh viễn của topic** (một topic trong cả cuộc đời chỉ được rescue 1 lần duy nhất, bất kể trải qua bao nhiêu episode).
> *(Kế hoạch đang thiết kế unique index theo `source_escalation_id` tương ứng với Lựa chọn 2A).*

Ngoài 2 điểm tinh chỉnh trên, **không có blocker kỹ thuật nào ngăn cản việc triển khai**. Mọi thông tin kiến trúc, mã nguồn và dữ liệu đều đã được xác thực rõ ràng.
