# D1 Correction Plan v4 — Ba capability riêng, và đường delete/restore theo ownership

> **Quan hệ với các tài liệu khác.** Đây là **amendment** cho [`correction-plan-deepseek-v2.md`](./correction-plan-deepseek-v2.md),
> cùng lớp với [`correction-plan-deepseek-v3.md`](./correction-plan-deepseek-v3.md). v2 vẫn là contract hiệu lực cho mọi mục
> **không** được nêu ở §6.
>
> v3 và v4 **độc lập về contract**: v3 sửa đường tạo ghi chú gắn đích (`review_notes`), v4 sửa phạm vi quyền tác giả,
> quyền duyệt, và đường delete/restore. Không bản nào phụ thuộc thứ tự của bản kia.
>
> **Có một điểm chồng lấn file, đã kiểm ở review round 0:** `_components/TopicWorkflowPanel.tsx` xuất hiện ở **cả hai** —
> v3 §8.1 + P9 (có điều kiện) và v4 §8.1 + U1–U7. Đây là chồng lấn **file**, không phải chồng lấn **hunk**: v3 chạm phần
> hiển thị ghi chú, v4 chạm phần action/gate. Ai implement sau phải rebase trên bản trước và **không** được ghi đè phần
> của bản kia. §13 dựa trên giả định này, nên nếu v3 và v4 chạm cùng một hunk, dừng và báo thay vì tự hoà giải.
>
> `./plan.md` vẫn stale có chủ đích theo D14 (v2 §13.1). Bản này **không** reconcile `plan.md`.

---

## 0. Nguồn, phê duyệt và authority

| | |
| --- | --- |
| **Workflow / episode** | `MULTI_AGENT_E2E` · episode *detailed-plan candidate* · **`review_round=8`** — candidate trên đĩa là bản viết lại theo contract D23/D41 Owner chốt ở lượt 2026-09-19, rồi sửa tiếp theo 12 finding của round 5 + sweep chéo (round 6), rồi sửa 11 finding của round 6 + sweep ngữ nghĩa (round 7), rồi sửa 8 finding của round 7 (round 8), **chưa** review ở dạng này. Tám correction round đã dùng: round 0 `FAIL`, round 1 `FAIL`, round 2 `FAIL`, round 3 `FAIL` (⇒ `OWNER_DECISION_REQUIRED`), round 4 `FAIL` (⇒ `OWNER_DECISION_REQUIRED`), round 5 `FAIL` (⇒ `OWNER_DECISION_REQUIRED`), round 6 `FAIL` (⇒ `OWNER_DECISION_REQUIRED`), round 7 `FAIL` (⇒ `OWNER_DECISION_REQUIRED`). Round 3–8 là round **Owner cấp thêm ngoài budget** (§13) |
| **Owner input revision** | Lượt 2026-09-19 (a): chốt D20–D40 qua chuỗi trao đổi về phạm vi quyền topic, quyền duyệt theo capability, ba capability riêng, đường delete/restore, luật hiện/ẩn action, và phạm vi helper. Lượt 2026-09-19 (b): **đảo D23** — *"owner/co_owner luôn có quyền review mặc định từ role, không có toggle riêng; `can_review_topics` chỉ là capability bổ sung cho editor/previewer"* — và chốt exclusion theo hướng **(ii)**. Lượt 2026-09-19 (c): **bổ sung transition contract** cho review authority (**D42**) — tước grant khi hạ tier, không để cờ cũ resurrect, và chốt `previewer(cờ=true) → editor` **giữ** cờ. Lượt 2026-09-19 (d): **cấp round 6**, kèm yêu cầu bắt buộc *"sửa 12 finding + chạy một sweep chéo toàn candidate theo từng invariant đã đổi … **Sau sweep mới dispatch round 6**"* — sweep phải phủ **mọi consumer §14 / mọi scope row §8.1 / mọi câu kết §5.x / mọi acceptance-risk-test row liên quan / grep toàn doc các phrase-model cũ đã supersede**. Lượt 2026-09-19 (e): **cấp round 7** sau khi Reviewer round 6 báo hai blocking; Owner chốt hướng cho `B-F9` — *"D42 vẫn là hard contract. Enforcement source là trigger `clear_topic_review_capability_on_role_downgrade` + RPC role-change (`v_new_flag`, fallback `false`), đã phủ các downgrade hợp lệ của enum. Xóa wording 'mạnh hơn bằng chứng' ở §5.5 và mô tả đúng hai lớp enforcement này. §3.14 giữ như defense-in-depth / app-path constraints. Không thêm D42 logic vào ba reviewer helper; §5.4/§5.5/§8.2 vẫn giữ lệnh cấm sửa reviewer decision functions."* — và cho `B-F8`: *"quyền review hiện được quyết định nhất quán ở ba boundary/caller khác nhau, không được mô tả `has_topic_review_access` là 'chỗ duy nhất'."* |
| **Master Plan / workstream** | [`docs/native-multi-agent/plan.md`](../../../../native-multi-agent/plan.md) — D1 (topic authoring → review → publication) |
| **Contract nền** | [`correction-plan-deepseek-v2.md`](./correction-plan-deepseek-v2.md) — **Owner đã PASS**, **còn một correction round đang chờ manual QA**; v4 không thay thế round đó |
| **Phê duyệt hiện có** | v4 là **đề xuất**, `review_round=8`. Owner chưa approve v4 và **chưa** cấp authority implementation |

**Authority snapshot — phân biệt rõ, không suy diễn lẫn nhau:**

| Hành động | Trạng thái |
| --- | --- |
| Viết tài liệu v4 này | **Được cấp** (Owner yêu cầu lượt này) |
| Cập nhật `progress.md` / `problems.md` / memory | **BỊ CẤM** cho tới khi v4 được review và freeze |
| Cập nhật `plan.md` | **CHƯA cấp** — thuộc tầng reconcile (v2 §13.1) |
| Implementation P11–P18 | **CHƯA cấp** — cần Owner approve v4 sau review |
| Chạy migration, `db reset`, `db push` | **CHƯA cấp** |
| Push / PR / merge / deploy | **CHƯA cấp** |
| Review artifact vào Git | **Bị cấm** — phải ignored, untracked, unstaged |

`PASS` của Plan Reviewer **không** phải Owner approval và **không** cấp implementation/Git/remote authority.

---

## 1. Mục tiêu và kết quả quan sát được

1. Thành viên nhóm tác giả **hiện tại** (creator, responsible, active contributor) **không bao giờ** tự duyệt hoặc tự từ chối
   được topic của mình — ở **mọi** vòng, kể cả sau lần duyệt đầu tiên.
2. Creator là **thành viên nhóm tác giả**. Sau khi chuyển trách nhiệm, creator **vẫn** sửa nội dung, **vẫn** gửi duyệt,
   **vẫn** xoá và **vẫn** khôi phục được topic đó.
3. Quyền cấp topic đến từ **vị trí trong nhóm tác giả của X**, **độc lập** với course role. Creator bị hạ xuống `previewer`
   mất quyền cấp course nhưng **giữ nguyên** quyền cấp topic.
4. Quyền **duyệt** là **role-native cho `owner`/`co_owner`**, và là **capability** `can_review_topics` cho
   `editor`/`previewer`. Effective rule: `role ∈ {owner,co_owner} OR can_review_topics`, rồi trừ reviewer exclusion.
   Hệ quả quan sát được: một owner **luôn** duyệt được dù cờ của họ là gì; một `editor` **không** duyệt được nếu cờ `false`.
5. **Ba authority riêng biệt, không có boolean nào gánh hai nghĩa:** sửa nội dung, quản lý cấu trúc, xoá/khôi phục.
   Hệ quả quan sát được:
   * `editor` ngoài group **reorder được** nhưng **không** rename/không sửa content/không xoá topic của người khác.
   * `previewer` + creator **sửa content và xoá topic mình tạo được**, nhưng **không** reorder structure.
   * topic contributor **sửa content được**, **không** xoá, **reorder được** (vì course role luôn là `editor` — §7.3).
6. Nhóm tác giả phát hiện lỗi sau khi gửi duyệt thì **tự mở khoá được**: một nút đưa topic về `draft`, một nút huỷ và xoá.
7. UI trả lời được câu *"ủa sao tôi sửa được mà không gửi được?"*: contributor **thấy** nút Gửi duyệt ở dạng disabled kèm lý do.
8. Contributor **không** thấy affordance xoá.
9. Một destructive capability duy nhất xử lý xoá cho mọi actor; khác biệt giữa các actor chỉ ở **nhãn UI**, không ở
   permission. Không tồn tại hai RPC xoá với permission lệch nhau.

---

## 2. Owner decision

Bảng nhãn (Owner dùng **E/G/F** trong hội thoại; v4 phát biểu lại thành **D**):

| Nhãn Owner | D | Chủ đề |
| --- | --- | --- |
| E1 | D20 | Exclusion = nhóm hiện tại, vô điều kiện |
| E2 | D21 | Giữ logic loại trừ lịch sử |
| E3 | D22 | Creator ∈ nhóm; creator + responsible gửi được |
| G1 | **D23 (đảo)** | Quyền duyệt là **role-native** cho owner/co_owner; cờ chỉ cho editor/previewer |
| ~~G2~~ | ~~D24~~ | **RÚT LẠI** — default true + backfill |
| ~~G3~~ | ~~D25~~ | **RÚT LẠI** — cho phép tự cấp |
| F1, F2 | D28 | Luật hiện/ẩn action |
| F3 | D28 | Contributor: hiện-disabled / ẩn |
| F4 | D28 | owner/co_owner ngoài group khi pending |
| F5 | D28 | Reviewer actions = family riêng |
| F6 | D30 | `canWithdrawReview` / `canDeleteTopic` riêng |
| F7 | §5.12 U1 | Sửa bug `getNextAction` |
| F8 | §5.12 | Dọn accessibility |

| # | Quyết định |
| --- | --- |
| **D20** | **Exclusion = thành viên nhóm hiện tại, vô điều kiện.** Creator, responsible hiện tại và active contributor luôn bị loại khỏi việc duyệt, ở mọi vòng. Không phân biệt đã sửa nội dung hay chưa. |
| **D21** | **Giữ** logic loại trừ lịch sử (`topic_author_review_exclusions`), **vẫn** gate theo `first_approved_at is null`. Former member chỉ tiếp tục bị loại trừ theo nhánh này. |
| **D22** | **Creator là thành viên nhóm tác giả.** Creator **và** responsible đều gửi/gửi lại được. Contributor **không**. |
| **D23** | **Quyền duyệt là role-native cho `owner`/`co_owner`.** Effective rule: `canReview = role ∈ {owner, co_owner} OR can_review_topics = true`, sau đó **vẫn** áp reviewer exclusion (D20/D21). Đây là **đảo** nội dung D23 cũ (*"quyền duyệt đến từ cờ, không từ role"*) — Owner chốt lượt 2026-09-19. |
| ~~D24~~ | **RÚT LẠI** (Owner, 2026-09-19). Trước: `can_review_topics` default `true` cho owner/co_owner + backfill. **Không còn hiệu lực** — cờ không chi phối quyền của owner tier nên default và backfill đều vô nghĩa. |
| ~~D25~~ | **RÚT LẠI** (Owner, 2026-09-19). Trước: cho phép self-grant cờ. **Không còn hiệu lực** — owner tier không có toggle riêng; mất quyền duyệt chỉ đến từ **đổi/rời role**. |
| **D41** | **`can_review_topics` chỉ có nghĩa với `editor`/`previewer`.** Với `owner`/`co_owner` giá trị cột là **inert** — không được đọc ở bất kỳ đâu để phán quyết. Hệ quả: guard `COLLABORATOR_CAPABILITY_ROLE_INVALID` của `set_course_collaborator_review_capability` ([`20260915100000:832-834`](../../../../../supabase/migrations/20260915100000_d1_trusted_lifecycle.sql)) là **đúng** và **giữ nguyên**; CHECK + coercion của invitation cũng giữ nguyên. **Không** có "materialization guarantee", **không** backfill, **không** widen trigger. |
| **D26** | **Quyền cấp topic độc lập course role.** Bỏ nhánh `cc.role in ('owner','co_owner','editor')` khỏi `d1_topic_group_member`; **vẫn** yêu cầu active course collaboration. |
| **D27** | **Delete gate** = `owner/co_owner` ∨ `original_creator` ∨ `current_responsible`. Contributor không ké được. |
| **D28** | **Luật hiện/ẩn action**: action thuộc workflow user đang tham gia → **hiện, disabled** nếu thiếu quyền; action ngoài vai trò → **ẩn**. Contributor: hiện-disabled cho gửi + quay-về-draft, **ẩn** cho xoá. |
| **D29** | **Hai nút khi `pending`**: "Hủy gửi duyệt và quay về chỉnh sửa" và "Hủy gửi duyệt và xóa bài học". `cancellation_reason` dùng **hằng số hệ thống**, không bắt nhập. |
| **D30** | **Capability riêng** `canWithdrawReview` / `canDeleteTopic`. **Không** dùng `canRequestReview` cho action `pending`. |
| **D31** | **Ba capability riêng, không boolean nào gánh hai nghĩa:** `canEditContent`, `canManageStructure`, `canDeleteTopic`. Định nghĩa đầy đủ ở §7.1. Delete **không** được nhét vào content hay structure. |
| **D32** | **Rename topic thuộc `canEditContent`.** Đây là mutate chính artifact/topic, không phải sắp xếp structure. Hệ quả **có chủ đích**: `editor` ngoài group **reorder được** nhưng **rename topic người khác không được**. |
| **D33** | **Một destructive capability duy nhất.** `delete_topic(topic)` xử lý cả `draft`, `pending` và `published`. Khi `pending`: cancel submission rồi soft-delete, **atomic**, trong cùng transaction. Không tồn tại RPC xoá thứ hai với permission lệch. |
| **D34** | **`withdraw_review_to_draft(topic)` là action riêng**, chỉ creator/responsible. |
| **D35** | **Delete path mới phải tự gánh các invariant lifecycle** mà `d1_prepare_topic_content_mutation` từng gánh: `removed_at != null` → `TOPIC_NOT_FOUND`; `published` + chưa confirm → `TOPIC_PUBLISHED_CONFIRM_REQUIRED`. **Không** gánh group-authoring gate. |
| **D36** | **Restore mirror delete.** `owner/co_owner` mọi topic; `creator` topic của mình; `responsible` topic mình phụ trách; contributor ❌; unrelated editor ❌. Restore là lifecycle/ownership action, không phải sửa content. |
| **D37** | **Reorder và mutation Course Structure dùng `canManageStructure`** (course-level). Không để D26 vô tình biến `previewer + contributor` thành người reorder structure chỉ vì helper `d1_topic_group_member` bị reuse. |
| **D38** | **`cancellation_reason` của delete dùng string trung tính** `"Hủy yêu cầu duyệt để xóa bài học."` — vì actor có thể là owner/co_owner, không chỉ tác giả. Actor thật đã nằm ở `cancelled_by_user_id`. |
| **D39** | **Helper giữ private trừ khi client gọi trực tiếp.** Trước khi grant `EXECUTE` cho `authenticated`, phải kiểm security mode của caller: helper nào chỉ được gọi từ một `security definer` boundary thì **giữ private** (`grant … to service_role`). Không grant "cho chắc". |
| **D40** | **`d1_is_active_course_author` không được dùng làm generic active-collaboration check** — nó loại `previewer`, nên đúng cho `canManageStructure`, sai cho `canEditContent`/`canDeleteTopic`. |
| **D42** | **Transition contract cho review authority.** `owner`/`co_owner`: review là **role-native**, không phụ thuộc `can_review_topics`. `editor`/`previewer`: review **chỉ** từ explicit `can_review_topics`. Mọi hạ tier phải **tước** grant cũ: `owner/co_owner → editor/previewer` ⇒ cờ `false`; `editor(cờ=true) → previewer` ⇒ `false`; rời course ⇒ mất **toàn bộ** review authority. Nâng lên `owner`/`co_owner` ⇒ review **tự có từ role**, **không** cần set cờ. **Không** được để cờ cũ resurrect quyền review sau một vòng promote→downgrade: hạ khỏi owner tier ⇒ phải **cấp lại explicit capability**. Chốt kèm: `previewer(cờ=true) → editor` **giữ** cờ — grant cũ vốn đã explicit, nâng trong cùng tier thấp không cần cấp lại (**chủ ý**, không phải bỏ sót). |

**D27 + D31 là kết quả suy ra, không phải lựa chọn thay thế.** Owner xác nhận *"Editor xóa topic mình tạo" là kết quả của
editor → create → becomes creator, không phải delete permission của editor role*.

**D23 (đảo) là kết quả của một chuỗi bốn round review.** Bản v4 trước chủ trương D23 cũ (*bỏ* nhánh role khỏi ba hàm
reviewer) và phải bù bằng D24 (backfill) + D25 (self-grant) để không mất quyền duyệt. Owner chốt lại: giữ nguyên nhánh
role, và biến `can_review_topics` thành capability **chỉ dành cho `editor`/`previewer`**. Hệ quả:

* **Ưu điểm:** bỏ được toàn bộ §5.4 + §5.5 (backfill, widen trigger, sửa `case`, materialization guarantee) — đúng
  những chỗ đã sinh blocker ở **cả bốn** round (`F2 → B1 → B-F3 → B-F1 → B-F4`). Không cần migration nào cho phần
  quyền duyệt. Guard `COLLABORATOR_CAPABILITY_ROLE_INVALID` trở thành **đúng** thay vì phải nới.
* **Không còn trạng thái "course mất hết reviewer":** qua app, target role `owner` **luôn** bị
  `COLLABORATOR_MANAGEMENT_FORBIDDEN` ([`20260916130000:576-588`](../../../../../supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql)),
  nên owner luôn tồn tại và luôn có quyền duyệt theo role. R13/A2 trước đây lo "biện pháp giảm nhẹ rỗng" — lo ngại đó
  **không còn đối tượng**.
* **Đánh đổi còn lại, ghi trung thực:** cờ `can_review_topics` của row owner/co_owner vẫn **tồn tại trong schema** và
  vẫn có thể ghi được qua `service_role`, nhưng **inert**. Đây là dư lượng schema, không phải hành vi; v4 **không** đề
  xuất xoá cột (xem Q7 ở §4).

**D32/D37 là thay đổi hành vi có chủ đích so với hôm nay.** Hiện `editor` **bất kỳ** rename được topic (nhờ nhánh
role-derived trong `d1_topic_group_member`). Sau D26+D32, `editor` ngoài group **mất quyền rename**. Owner xác nhận:
*"Reorder là quản lý cấu trúc course, còn đổi title là mutate chính artifact/topic đó."*

---

## 3. Repository fact (đã kiểm chứng)

### 3.1 Role-derived review nằm ở **ba** hàm sống — và cả ba **đã đúng** contract D41

Tất cả trong [`20260916130000_d1_topic_authorship_boundary.sql`](../../../../../supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql):

| # | Hàm | Bắt đầu | Dạng nhánh role-derived (ĐÚNG, giữ nguyên) |
| --- | --- | --- | --- |
| 1 | `d1_has_eligible_topic_reviewer` | `:128` | `cc.role in ('owner','co_owner')` \| `:151-157` |
| 2 | `has_topic_review_access` | `:165` | `cc.role in ('owner','co_owner')` \| `:183-189` |
| 3 | `d1_assert_pending_review_reviewer_safety` | `:197` | `cc.role in ('owner','co_owner')` \| `:231-247` |

**Đây là đảo ngược kết luận của các bản v4 trước (round 0–3).** Bản trước coi ba hàm này là *đối tượng phải sửa* — bỏ
nhánh role-derived để quyền duyệt chỉ còn đến từ cờ (D23 cũ). Owner chốt lại D23 (lượt 2026-09-19): **giữ** nhánh role,
và `can_review_topics` chỉ có nghĩa với `editor`/`previewer`. Ba hàm này **đã** implement đúng dạng đó, nên
**không sửa dòng nào**.

Bằng chứng mạnh nhất rằng chúng đã đúng: `topic-review-lifecycle.test.ts:620-628` dựng một `co_owner` với
`can_review_topics: false` và assert `has_topic_review_access` = `true`. Test đó **đang xanh** ⇒ DB đã role-derive cho
owner tier. Đây là test **pin contract mới** — phải giữ xanh, **không** được "sửa".

**Hàm #3 có HAI nhánh, cùng dạng role-derived** — ghi lại vì các bản trước đã sai ở đây (H1, round 1). Body sống
([`20260916130000:220-247`](../../../../../supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql)) là một
`case` trên `cc.id = v_target.id`:

```sql
case
  when cc.id = v_target.id then              -- arm 1: NGƯỜI ĐANG BỊ ĐỔI ROLE
    not p_is_removal
    and (
      p_new_role in ('owner','co_owner')                      -- role-derived, dùng THAM SỐ
      or (p_new_role in ('editor','previewer') and p_new_can_review_topics)
    )
  else                                        -- arm 2: các collaborator KHÁC
    cc.role in ('owner','co_owner')                           -- role-derived, dùng cc.role
    or (cc.role in ('editor','previewer') and cc.can_review_topics)
end
```

* **Arm 1** suy từ `p_new_role`/`p_new_can_review_topics` — tham số, **không phải** `cc.role`. Với D41 điều này
  **đúng**: hạ một người xuống `owner`/`co_owner` cho họ quyền duyệt theo role mới.
* **Arm 2** dùng `cc.role`/`cc.can_review_topics` của các collaborator khác. Cũng **đúng**.

Cả hai arm **giữ nguyên**. Ghi chú này tồn tại để nếu ai đó định "sửa cho khớp D23 cũ" thì biết là **không được**.

**Hàm thứ tư sống trong schema nhưng đã chết** (review round 0 bắt được; bản nháp trước khẳng định "ba hàm" —
**sai**):

| # | Hàm | Định nghĩa | Nhánh role | Trạng thái |
| --- | --- | --- | --- | --- |
| 4 | `d1_has_distinct_topic_reviewer` | [`20260915130000:22`](../../../../../supabase/migrations/20260915130000_d1_correction_security_rescue.sql) | `:44` | **Dead** |

Hai caller duy nhất là `:122` (trong `request_topic_review` định nghĩa ở `:77`) và `:363` (trong
`get_topic_workflow_state` định nghĩa ở `:308`) — **cả hai đều nằm trong body đã bị thay thế**: `request_topic_review` được
viết lại ở `20260916130000:741` và `20260917100000:191`; `get_topic_workflow_state` ở `20260917110000:58`. Không bản
sống nào gọi nó.

**Tác động hành vi hôm nay: không.** Nó chết, nên dưới D41 nó **không** mâu thuẫn gì về ngữ nghĩa (dạng role-derived của
nó vốn đã đúng). Nhưng nó vẫn là một định nghĩa thừa chưa có disposition trong §8.2, và một bản sao của logic reviewer
nằm ngoài ba hàm canonical là chỗ để logic trôi lệch về sau. **Disposition: drop ở P18** — dọn code chết, không phải
sửa ngữ nghĩa. Đây là mục duy nhất còn lại của §3.1 cần chạm.

### 3.2 `can_review_topics` là `false` trên **mọi row owner/co_owner do contract quản**
(*Sửa ở round 5 — `L-F6`: headline cũ ghi "**mọi** row", quá rộng.*)

Cột: `boolean NOT NULL DEFAULT false` ([`20260915090000:15-23`](../../../../../supabase/migrations/20260915090000_d1_foundation.sql)).
Cả hai đường tạo owner đều **không** set cột: `create_course_with_owner` ([`20260612100000:46-57`](../../../../../supabase/migrations/20260612100000_create_course_with_owner_rpc.sql))
và D1 foundation (`20260915090000:219-230`).

**Phạm vi chính xác:** claim đúng cho **các đường tạo do contract quản** — #1–#3 của §3.3. Nó **không** đúng cho *mọi*
row trong DB: [`course-authoring-role-matrix.test.ts:207`](../../../../../__tests__/integration/course-authoring-role-matrix.test.ts)
dựng một row `co_owner` với cờ **`true`** qua helper fixture và assert đúng giá trị đó ở `:217-218`. Row owner-tier cờ
`true` **tồn tại thật** — và dưới D41 điều đó là **vô hại**, chính là điều A55 ca (3) khẳng định.

**Dưới D41, fact này mất hết ý nghĩa thiết kế.** Trước đây nó là tiền đề cho lập luận *"bỏ nhánh role mà không backfill
thì toàn bộ owner/co_owner mất quyền duyệt ngay"* — lập luận đó chỉ đúng khi cờ **là** nguồn quyền duyệt. Nay quyền duyệt
của owner tier đến từ role, nên cờ `false` trên row owner **không** làm mất gì. Ghi lại vì §3.2 từng là bàn đạp của
toàn bộ §5.4/§5.5.

### 3.3 Đường INSERT ép `false` cho owner/co_owner — và dưới D41 điều đó là **đúng**

[`20260915140000:221-228`](../../../../../supabase/migrations/20260915140000_d1_collaborator_invitations.sql) insert
`can_review_topics` nguyên từ invitation. UI set cứng `false` cho mọi invite không phải editor/previewer —
[`CollaboratorManagementDialog.tsx:176`](<../../../../../app/(teacher)/teacher/courses/[id]/_components/CollaboratorManagementDialog.tsx>):

```tsx
canReviewTopics: inviteRole === "editor" || inviteRole === "previewer" ? inviteCanReview : false,
```

Ràng buộc thật nằm ở **hai tầng DB**:

```sql
-- 20260915140000:15-17 — CHECK trên bảng invitation
constraint course_collaborator_invitations_capability_check check (
  role <> 'co_owner' or not can_review_topics
)
-- 20260915140000:99-101 — RPC create_collaborator_invitation
if p_role = 'co_owner' and p_can_review_topics then
  raise exception 'INVITATION_CAPABILITY_ROLE_INVALID';
end if;
-- 20260915140000:151-155 — cùng RPC, ép giá trị lưu
case when p_role in ('editor','previewer') then p_can_review_topics else false end
```

⇒ Một invitation `co_owner` **không thể** mang `can_review_topics = true`; nó luôn `false`, và materialization copy thẳng.

**Dưới D41, cả ba tầng này đều ĐÚNG và giữ nguyên** — chúng chính là biểu hiện của luật *"`can_review_topics` chỉ có
nghĩa với `editor`/`previewer`"*. Bản v4 trước coi chúng là rào cản cần vượt qua và đề xuất một "materialization
guarantee" ở tầng `course_collaborators` để ép `true`. **Đề xuất đó bị rút.** Không tầng nào cần sửa.

Số đường INSERT vào `course_collaborators` (**đếm lại ở round 5** — `L-F8`): **năm** lời gọi `insert into
public.course_collaborators` **ở tầng SQL trong `supabase/`**, tái lập bằng
`grep -rn "insert into public.course_collaborators" supabase/`.

Đây **không** phải con số của mọi đường tạo row: fixture trong `__tests__/**` cũng INSERT vào bảng này qua
`supabaseAdmin.from("course_collaborators").insert(...)` — **21** lời gọi trên **18** file TS/TSX. Các row đó chính là
những row mà §10.2 Lớp A′/Lớp B nói tới. Ghi rõ hai phạm vi để con số không bị trích sai.

**Lệnh tái lập cho con số `21`/`18`** (*bổ sung round 6 — `N-F8`: bản round 5 không ghi lệnh, và lệnh suy diễn
`.insert(` toàn cây cho `143`/`19`, **không** khớp*):

```bash
grep -rn -A2 'from("course_collaborators")' --include=*.ts --include=*.tsx . | grep -c '\.insert('   # ⇒ 21
grep -rl -A2 'from("course_collaborators")' --include=*.ts --include=*.tsx . | wc -l                # ⇒ 18
```

Phải giữ `-A2` (dạng nhiều dòng) — `grep -rn '\.insert('` **toàn cây** cho `143`/`19` vì nó đếm **mọi** bảng.
Lệnh thứ hai dùng `-rl` (không `-rn`): `-l` liệt kê **tên file** nên đếm trực tiếp ra `18`. **Không** dùng
`-rn … | cut -d: -f1 | sort -u` — dòng ngữ cảnh do `-A2` sinh ra không có `file:` ở đầu, nên `cut -d: -f1` cắt sai và
cho `153` (*đã thử ở round 8 — `L-F16(a)`: bản round 7 ghi dạng đó kèm comment `⇒ 18`, **sai**; dạng `-rl` mới đúng*).

| # | Đường INSERT | `can_review_topics` | Ghi chú |
| --- | --- | --- | --- |
| 1 | `create_course_with_owner` (`20260612100000:46-57`) | không set ⇒ `false` | owner |
| 2 | D1 foundation (`20260915090000:219-230`) | không set ⇒ `false` | |
| 3 | Materialization invitation (`20260915140000:221-228`) | copy từ invitation | |
| 4 | [`seed.sql:245`](../../../../../supabase/seed.sql) | không set ⇒ `false` | owner; ngoài contract §8.2 |
| 5 | [`seed.sql:528`](../../../../../supabase/seed.sql) | `:541` editor `false`, `:549` previewer `true` | ngoài contract §8.2 |

Chỉ #1–#3 nằm trong phạm vi contract. #4/#5 là seed dev, bị §8.2 loại trừ, và dưới D41 **không** có hậu quả hành vi
(row owner của seed không cần cờ để duyệt được). Ghi đủ **năm** để con số tái lập được bằng `grep` — nhưng **chỉ** trong
phạm vi `supabase/` nêu trên.

### 3.4 `plan.md` tự mâu thuẫn ở đúng điểm G1

| Dòng | Nói |
| --- | --- |
| [`:79`](./plan.md) | "owner/co_owner **derive từ role**, editor/previewer cần flag `true`" |
| [`:80`](./plan.md) | "course-scoped topic review authority **theo effective reviewer capability**" |
| `:330` | "reviewers are **separately governed by `can_review_topics`**" |
| `:455`, `:496` | Cùng nội dung |

`:79` biến role thành **nguồn** của quyền duyệt; bốn câu còn lại nói quyền duyệt đến từ **capability**. Bản v4 round 0–3
giải theo bốn câu sau (tức bỏ role-derived khỏi ba hàm). **Owner chốt lại ở lượt 2026-09-19 (b): theo `:79`.**
`:80`, `:330`, `:455`, `:496` là bốn dòng **stale** của `plan.md` — chúng mô tả một mô hình chưa từng được implement
(DB luôn role-derive cho owner tier, xem §3.1) và nay bị D41 bác bỏ. **Không** sửa `plan.md` ở v4 (thuộc tầng reconcile
D14); chỉ ghi nhận chúng là stale để implementor không đọc nhầm.

`:304` gộp **hai** mệnh đề, phải tách khi sửa. Vế *"raw flag không thể nâng role"* vẫn đúng và **độc lập** với D23.

### 3.5 Quyền cấp topic hiện có **hai** hàm, và **ba** authority bị dồn vào một boolean

**(a) `d1_topic_group_member`** — [`20260916130000:56-92`](../../../../../supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql).
**(b) `d1_topic_group_member_for_restore`** — `20260916140000:57-92`. Hàm **thứ hai**, `create or replace` riêng, **cũng**
chứa `cc.role in ('owner','co_owner','editor')` (`:76-80`). Khác (a) ở chỗ **bỏ** `t.removed_at is null`. Chỉ dùng bởi
`d1_restore_topic` (`:269`).

**(c)** `d1_topic_structure_permissions` ([`20260917100000:257-268`](../../../../../supabase/migrations/20260917100000_d1_senior_review_corrections.sql))
trả **một** cột `can_edit` = `d1_topic_group_member` (dòng `:264`), nhưng consumer dùng nó cho **ba** việc khác nhau:

| Consumer | Thao tác | Backend đi qua | Authority đúng |
| --- | --- | --- | --- |
| `TopicManagementSheet.tsx:142`, `:175`, `:558`, `:576` | Rename topic | `d1_update_topic` → `d1_prepare_topic_content_mutation` (`20260915110000:163`) → `d1_topic_group_member` | **content** |
| `TopicManagementSheet.tsx:154`, `:342` | Move/reorder | `move_topic_order` → `d1_topic_group_member` (`:329`) | **structure** |
| `TopicManagementSheet.tsx:234`, `:588` | Ẩn/xoá topic | `d1_delete_topic` | **delete** |

Rename đi qua `prepare` ⇒ **content**, không phải structure. Dữ liệu chảy: `d1_topic_structure_permissions` → `TopicStructurePermissionRow.can_edit` ([app/actions/topic.ts:67-70](../../../../../app/actions/topic.ts)) → `Topic.canEdit` ([`types.ts:20`](<../../../../../app/(teacher)/teacher/courses/[id]/_components/types.ts>)) → bốn nhóm consumer trên.

Đây là **gốc rễ của D31**: một boolean `can_edit` đang trả lời ba câu hỏi khác nhau, nên bất kỳ ánh xạ hai-chiều nào
cũng làm hỏng ít nhất một consumer (§4.1 C5).

### 3.6 Mọi call site của `d1_topic_group_member`, phân loại theo D31/D36/D37

| Category | Call site | Sau v4 |
| --- | --- | --- |
| **Content** | `d1_lock_topic_for_mutation:48` → guard trigger (`20260915100000:306,309`) + `soft_delete_exercise_cascade` (`:1267`) | giữ |
| | `can_modify_content_by_topic:112` → RLS cards/exercises/questions | giữ |
| | `d1_prepare_topic_content_mutation:224` → 15 content RPC | giữ |
| | storage upload policies `:546`, `:566` | giữ |
| | media delete `20260916153007:24,49` + `d1_question_group_media_delete_allowed` (`20260917100000:313`) | giữ |
| | `get_topic_workflow_state:101` → `canEdit` (workflow DTO) | giữ |
| | RLS `Topics - Staff Update` / `Staff Soft Delete` (`20260916130000:729-736`) | **đã chết** — xem §3.7 |
| **Structure** | `move_topic_order:329` | **đổi** → `canManageStructure` (D37) |
| | `d1_topic_structure_permissions:264` | **đổi** → trả ba cột (D31/D32) |
| **Delete/Restore** | `d1_restore_topic` → `_for_restore:269` | **đổi** → mirror delete (D36) |
| | `d1_delete_topic` | **viết lại** theo D33/D35 |

### 3.7 Delete path hiện tại, và vì sao nó chặn owner/co_owner ngoài group

Trace chính xác:

`app/actions/topic.ts:377` `.rpc("d1_delete_topic", …)`
→ `d1_delete_topic` [`20260915110000:170`](../../../../../supabase/migrations/20260915110000_d1_content_mutation_safety.sql)
→ `:182` `perform public.d1_prepare_topic_content_mutation(...)`
→ body hiện hành [`20260916140000:189`](../../../../../supabase/migrations/20260916140000_d1_topic_group_content_boundary.sql)
→ `:224` `if not public.d1_topic_group_member(v_topic.id) then raise 'COURSE_EDIT_FORBIDDEN'`

Sau D26, owner/co_owner **ngoài group** không phải creator, không phải responsible, không phải contributor ⇒ **bị từ chối**.
Hôm nay họ **pass** qua nhánh role-derived, nên **đang xoá được** ⇒ D26 là **regression** nếu không sửa kiến trúc.
Đây là blocker P1, và lý do D33 tồn tại.

**Thứ tự kiểm tra thật của `d1_prepare_topic_content_mutation`** (khác với giả định ban đầu của v4):

```
:AUTH_REQUIRED → :TOPIC_NOT_FOUND → advisory lock (course → topic)
→ :select … for update → :removed_at → :d1_topic_group_member → :pending → :published
```

Nó **không** gọi `d1_lock_topic_for_mutation`; nó inline `pg_advisory_xact_lock` riêng. Group check (`:224`) đứng
**trước** pending freeze (`:228`).

**Có lớp chặn thứ hai trên đường delete — và §5.7 phụ thuộc vào nó.** (Bản nháp trước của v4 khẳng định "không có
trigger nào trên `topics`". **Sai.** Đã sửa theo review round 0.)
`public.topics` mang **hai** trigger sống:

| Trigger | Thời điểm | Gắn tại | Chạm delete? |
| --- | --- | --- | --- |
| `d1_guard_topic_lifecycle_mutation` | `before update or delete` | [`20260915100000:382-385`](../../../../../supabase/migrations/20260915100000_d1_trusted_lifecycle.sql) | **Có** |
| `d1_guard_topic_authorship_mutation` | `before insert or update` | [`20260916120000:128-131`](../../../../../supabase/migrations/20260916120000_d1_topic_authorship_foundation.sql) | Không |

Body **sống** của `d1_guard_topic_lifecycle_mutation` ([`20260915110000:49-84`](../../../../../supabase/migrations/20260915110000_d1_content_mutation_safety.sql)):

```sql
if auth.uid() is null or coalesce(auth.role(), '') = 'service_role' then ... return new; end if;
-- advisory lock course -> topic, rồi:
select t.status into v_status from public.topics t where t.id = old.id for update;
if v_status = 'pending'
   and current_setting('voca.d1_trusted_topic_lifecycle', true) is distinct from 'on' then
  raise exception 'TOPIC_PENDING_FROZEN';
end if;
```

Câu `update public.topics` **cuối cùng** của `delete_topic` đi qua trigger này, và trên topic `pending` nó raise
`TOPIC_PENDING_FROZEN` **trừ khi** GUC `voca.d1_trusted_topic_lifecycle` = `'on'`. §5.7 thoả điều kiện đó **gián tiếp**:
`d1_cancel_pending_reviews_for_topics` set GUC ấy ở dòng đầu
([`20260915100000:956`](../../../../../supabase/migrations/20260915100000_d1_trusted_lifecycle.sql)),
transaction-local qua `set_config(..., true)`. Đây là **phụ thuộc không hiển nhiên** — §5.7 nay ghi rõ, và §14 bắt
Implementor tự kiểm trước khi code.

Hai nhánh còn lại **không** cần GUC: topic `draft` ⇒ `v_status <> 'pending'`; topic `published` chưa cancel ⇒ cũng vậy.

`d1_guard_topic_authorship_mutation` **không** chặn: câu `update` của delete chỉ đụng `status` + `removed_at`, mà trigger
này chỉ raise khi `original_creator_user_id`, `first_approved_at`, hoặc `responsible_author_user_id` đổi.

**Các lớp khác trên đường delete** (đã kiểm):
* `d1_guard_topic_content_mutation` gắn trên **năm** bảng — `cards`, `exercises`, `question_groups`, `questions`,
  **`question_options`** ([`20260915100000:316-344`](../../../../../supabase/migrations/20260915100000_d1_trusted_lifecycle.sql),
  năm lời gọi ở `:324`, `:329`, `:334`, `:339`, `:344`). Không gắn trên `topics` ⇒ không chạm delete. (Bản nháp trước ghi
  "bốn bảng" — **sai**, đã sửa.)
* Hai policy topic-level dùng `d1_topic_group_member` bị `drop` ở
  [`20260917100000:253-254`](../../../../../supabase/migrations/20260917100000_d1_senior_review_corrections.sql) và
  **không tạo lại** ⇒ hiện **không có** UPDATE policy nào trên `topics`.
* `d1_delete_topic` là `security definer` ⇒ qua RLS.

Bỏ lời gọi `prepare` khỏi delete path là **đủ về authorization**, nhưng **không** đủ về lifecycle: trigger
`d1_guard_topic_lifecycle_mutation` vẫn là cổng chặn thật, và nó chỉ mở nhờ GUC do **bước cancel** set.
`d1_lock_topic_for_mutation` **không tái dùng được** cho delete vì nó có group check ở `:48`; cần lifecycle lock
primitive riêng (§5.6).

### 3.8 `d1_is_active_course_author` **đã tồn tại** và chính là `canManageStructure`

[`20260916130000:26-48`](../../../../../supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql):

```sql
select exists (
  select 1 from public.courses c
  join public.course_collaborators cc on cc.course_id = c.id
  join public.profiles p on p.id = cc.user_id
  where c.id = p_course_id and c.removed_at is null
    and cc.user_id = p_user_id and p.removed_at is null
    and cc.role in ('owner','co_owner','editor')
)
```

Đây **chính xác** là `canManageStructure` của §7.1 — có cả `profiles.removed_at is null`, mà
`has_course_authoring_access` (`20260915090000:145`) **thiếu**.

**Nó là predicate nội bộ, và phải giữ nguyên như vậy.** Hai đặc điểm quyết định:

* Nó nhận `p_user_id` **tường minh**, không đọc `auth.uid()` ⇒ không phải actor-bound predicate, không dành cho client.
* Caller duy nhất hiện tại là `add_topic_contributor` (`:438`), bản thân hàm này là `security definer`.

⇒ D37 **không** cần grant. `move_topic_order` ([20260916140000:302](../../../../../supabase/migrations/20260916140000_d1_topic_group_content_boundary.sql#L302))
cũng là `security definer`, nên gọi nội bộ được dù `authenticated` không có `EXECUTE`. Giữ nguyên
`revoke all … from public, anon, authenticated` + `grant execute … to service_role` (`:53-54`).

**Cấm dùng nó làm generic active-collaboration check.** Nó **loại `previewer`**; điều đó đúng cho
`canManageStructure` và **sai** cho `canEditContent`/`canDeleteTopic` — hai capability này phải admit `previewer`.
Đây chính là cái bẫy mà D31 dựng ra để chặn (§4.1 C5/C6).

### 3.9 Pending là **ngõ cụt** cho mọi actor

| | Hiện tại |
| --- | --- |
| Sửa nội dung khi `pending` | ❌ `TOPIC_PENDING_FROZEN` (`20260916140000:228`) |
| Xoá topic khi `pending` | ❌ `TOPIC_PENDING_FROZEN` + group check |
| Tác giả tự huỷ để sửa | ❌ không có đường nào |
| Actor-facing cancel | ❌ `d1_cancel_pending_reviews_for_topics` bị `revoke … from authenticated`; caller duy nhất là `moderate_platform_content`, đòi `profiles.role = 'admin'` (platform admin) |

⇒ Hiện **không actor nào** xoá được topic `pending`. D29/D33 không phải "nới quyền cho owner" mà là **capability mới
hoàn toàn**.

### 3.10 Hạ tầng cho việc huỷ **đã có sẵn**

* Enum `topic_review_submission_status` **đã có** `'cancelled'` (`20260915090000:3-8`).
* Bảng đã có **3 cột**: `cancelled_by_user_id`, `cancelled_at`, `cancellation_reason` (`:71-80`).
* Ràng buộc đòi lý do **không rỗng** khi `cancelled` (`:86-89`) ⇒ hằng số hệ thống của D29/D38 thoả.
* `d1_cancel_pending_reviews_for_topics(p_topic_ids, p_actor_user_id, p_reason)` — set `cancelled` + đưa topic về `draft`
  ([`20260915100000:941-964`](../../../../../supabase/migrations/20260915100000_d1_trusted_lifecycle.sql)). Hiện
  `revoke … from authenticated` (`:967`), `grant … to service_role` (`:968`).

⇒ D33 **không cần bảng mới, không cần enum mới**. Nhưng **không** để tác giả gọi thẳng helper này như một RPC độc lập —
nó phải nằm trong đường delete/withdraw (§5.7, §5.9).

### 3.11 `d1_restore_topic` đã có sẵn các guard khác

[`20260916140000:248-296`](../../../../../supabase/migrations/20260916140000_d1_topic_group_content_boundary.sql): group check
(`:269`), `TOPIC_PENDING_FROZEN` (`:272`), `TOPIC_NOT_REMOVED` (`:273`), chapter check (`:274-281`).
**Chỉ** lời gọi group check phải đổi; các guard còn lại giữ nguyên.

**Restore không cần guard `published` — và đây là fact đã kiểm, không phải giả định.** Kiểm bằng cách liệt kê **mọi**
writer của `topics.removed_at` trong toàn bộ `supabase/migrations/`:

| Writer | Câu lệnh | Set `status`? |
| --- | --- | --- |
| `d1_delete_topic` — [`20260915110000:184`](../../../../../supabase/migrations/20260915110000_d1_content_mutation_safety.sql) | `set status = 'draft', removed_at = timezone('utc', now())` | ✅ |
| `moderate_platform_content` takedown — [`20260915130000:247`](../../../../../supabase/migrations/20260915130000_d1_correction_security_rescue.sql) | `set status = 'draft', removed_at = case when p_action = 'takedown' then now() else null end` | ✅ |
| `moderate_platform_content` — **body cũ, đã bị thay thế** — [`20260915100000:1014`](../../../../../supabase/migrations/20260915100000_d1_trusted_lifecycle.sql) | `set status = 'draft', removed_at = case when p_action = 'takedown' then now() else removed_at end` | ✅ |
| `d1_restore_topic` — [`20260916140000:283`](../../../../../supabase/migrations/20260916140000_d1_topic_group_content_boundary.sql) | `set status = 'draft', removed_at = null` | ✅ |

⇒ **Bất biến:`removed_at is not null` ⇒ `status = 'draft'`.** Mọi câu lệnh set `removed_at` non-null đều set `status='draft'`
trong **cùng một statement**, nên không có cửa sổ trung gian. Hệ quả: tới lúc một topic `restorable` (`removed_at is not
null`), `status` **đã** là `draft` ⇒ `d1_restore_topic` không thể hồi sinh topic `published`, và việc §5.9 giữ nguyên guard
set của nó là **đúng**, không phải thiếu sót.

Bất biến này là thứ D35 và D36 tựa vào, nên v4 ghi thành acceptance criterion A50 và một test riêng (§10.1) — nếu một
migration sau này set `removed_at` mà quên `status`, cả delete lẫn restore đều sai theo.

Ghi chú: `d1_delete_topic` là writer `removed_at` **duy nhất** hướng tới người dùng. `moderate_platform_content` là đường
platform-admin; nó cũng đã ở dạng `draft` + removed, nên không mâu thuẫn bất biến.

### 3.12 Capability đang được suy ở client, không có field server

`TopicAuthorshipSection.tsx:96-99,179`:

```tsx
const currentGroupUserIds = new Set([workflow.responsibleAuthor.userId, ...contributors.map(c => c.userId)]);
const inCurrentGroup = workflow.isCurrentUserResponsible || workflow.isCurrentUserContributor;
```

`topicWorkflowSchema` ([`lib/schemas/topic-workflow.ts:39-65`](../../../../../lib/schemas/topic-workflow.ts)) có
`isCurrentUserResponsible`, `isCurrentUserContributor` — **không** có `isCurrentUserOriginalCreator`. Read model cũng chỉ
build hai cờ đó (`20260917110000:202-203`). `originalCreator` **có** trong DTO (`:58`) và read model (`:198`) ⇒ không cần
field mới cho U6.

### 3.13 `previewer` **không thể** là contributor ⇒ một dòng của §7.3 hiện không đạt tới được

`add_topic_contributor` ([`20260916130000:413`](../../../../../supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql))
chặn tại `:438`:

```sql
if not public.d1_is_active_course_author(v_topic.course_id, p_user_id) then
  raise exception 'TOPIC_CONTRIBUTOR_MEMBERSHIP_REQUIRED';
end if;
```

`d1_is_active_course_author` đòi `cc.role in ('owner','co_owner','editor')` ⇒ **`previewer` không được thêm làm
contributor**. Nên actor `previewer + contributor` **không tồn tại** ở trạng thái hiện tại của repo.

Hệ quả cho v4:
* §7.3 vẫn ghi semantics cho tổ hợp đó (để ma trận đầy đủ và để chốt sẵn **nếu** rào này được nới sau), nhưng đánh dấu
  **không đạt tới được hôm nay**.
* A45 chỉ được kiểm chứng phần `previewer + creator` — **không** viết test cho `previewer + contributor`.
* Đây là **fact**, không phải blocker: nó không mâu thuẫn D26/D31, chỉ thu hẹp tập actor thực tế. Nới rào này là
  quyết định contract riêng, xếp cùng chỗ với Q4 (§5.14).

### 3.14 Qua app **không nâng được** ai lên owner tier, và **`owner` không bị hạ** — nhưng `co_owner` **hạ được**

Phát hiện ở round 3 khi audit `B-F4`; là fact **mới** của bản này. **Mục này đã được viết lại ba lần** — truy vết đầy
đủ ở một chỗ (*bổ sung round 7 — `N-F11`: bản trước phải ghép lịch sử từ ba chỗ khác nhau*):
**round 5** sửa độ rộng (bản trước viết *"không có đường đổi role owner/co_owner"* — quá rộng, xem A1 dưới đây);
**round 6** thu hẹp điều kiện dừng xuống **chỉ** vế (i) (`B-F6`);
**round 7** đổi vai trò của vế 4 từ *nguồn sức mạnh duy nhất của D42* thành **defense-in-depth** (`B-F9` — enforcement
thật của D42 ở §5.5); **round 8** giữ nguyên vế 4, chỉ sửa `A60` cho khớp (`B-F10`).
*Ghi chú thuật ngữ (`N-F14`):* chữ **"vế"** trong mục này dùng cho **hai** danh sách khác nhau — "vế (i)/(ii)/(iii)" là
**ba guard** ở §14, còn "vế 3"/"vế 4" là **bốn kết luận** ở phần "Hệ quả" dưới đây. Đọc theo ngữ cảnh.

**Hai guard sống ở `update_course_collaborator_role_with_responsibility`**
([`20260916130000:576-588`](../../../../../supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql)) —
**không** phải ở `update_course_collaborator_role`; hàm sau (`:620-628`) chỉ là wrapper `language sql` gọi hàm trước và
**thừa hưởng** guard:

```sql
if v_target.role = 'owner'
   or (
     v_target.role = 'co_owner'
     and not exists (
       select 1 from public.course_collaborators cc
       where cc.course_id = v_target.course_id and cc.user_id = v_actor
         and cc.role = 'owner'::public.course_member_role
     )
   ) then
  raise exception 'COLLABORATOR_MANAGEMENT_FORBIDDEN';   -- :576-585
end if;
if p_role not in ('editor'::public.course_member_role, 'previewer'::public.course_member_role) then
  raise exception 'COLLABORATOR_ROLE_CHANGE_OUTSIDE_D1';  -- :586-588
end if;
```

Tầng client khớp lại: [`lib/schemas/course-collaborator.ts:15-17`](../../../../../lib/schemas/course-collaborator.ts)
(`role: z.enum(["editor","previewer"])`).

**Đọc chính xác hệ quả** — ba vế, không gộp:

1. **`owner` không bị hạ.** Guard đầu raise bất kể actor là ai ⇒ hàng `owner` bất động.
2. **`co_owner` hạ được, bởi `owner`.** Guard đầu chỉ raise khi actor **không** phải owner. Nên `owner` hạ được `co_owner`
   xuống `editor`/`previewer`. **Đây là transition thật, và đúng là transition mà D42 nói tới** — và nó **đã** tuân D42:
   cả RPC (`case … else false`) lẫn trigger clear-on-downgrade đều tước cờ (§5.5).
3. **Không nâng ai lên owner tier được.** Guard hai đòi `p_role ∈ {editor, previewer}` ⇒ `editor → owner/co_owner` bất khả.

⇒ **`owner ↔ co_owner` bất khả qua app**, và **không** thể nâng một member có sẵn lên `owner`/`co_owner`. Row owner-tier
chỉ sinh ra từ `create_course_with_owner`, invitation (chỉ tới `co_owner` — `INVITATION_OWNER_ROLE_FORBIDDEN`,
[`20260915140000:95`](../../../../../supabase/migrations/20260915140000_d1_collaborator_invitations.sql)), hoặc ghi thẳng
`service_role`.

**Hệ quả — đây là cơ sở của A2 và của việc D41 không có đánh đổi ẩn:**

1. **Mọi course luôn có ít nhất một `owner`**, và owner đó **luôn** có quyền duyệt theo role. Nên pool reviewer
   **không bao giờ rỗng vì lý do cờ** — chỉ có thể rỗng vì **exclusion** (mọi reviewer đều là tác giả của topic đó).
2. **A52 của bản trước mô tả một transition bất khả.** Nó khẳng định hành vi của `owner ↔ co_owner` trong khi không có
   đường app nào tới đó — đúng lớp lỗi của `B-F4` (khẳng định cơ chế tồn tại khi đường thi hành không có). Vì vậy A52
   **xoá**, không sửa.
3. Nếu ai đó **nới** hai guard này sau này, kết luận (1) mất hiệu lực và A2 phải được xét lại. Ghi thành mục tự-kiểm ở §14.
4. **Không có vòng promote→downgrade nào chạm owner tier.** Vì vế (3) chặn mọi đường nâng vào owner tier qua app, nên
   đường **app** không sinh ra được vòng nào như vậy. **Đây là defense-in-depth, KHÔNG phải nguồn sức mạnh của D42**
   (*sửa ở round 7 — `B-F9`; Owner chốt: D42 vẫn là **hard contract**, và enforcement source là **hai lớp** ở §5.5*):
   bất biến "cờ cũ không resurrect" đứng bằng **cơ chế** — RPC `v_new_flag` (`else false`) + trigger
   clear-on-downgrade phủ hết bốn giá trị enum — chứ **không** bằng lập luận cấu trúc này. Vế 4 chỉ **thu hẹp thêm**
   không gian tấn công ở tầng đường app; nếu hai guard bị nới, D42 **vẫn** được thi hành bởi hai lớp ở §5.5.

---

## 4. Giả định, xung đột, câu hỏi mở

### 4.1 Xung đột đã xử lý

| # | Xung đột | Xử theo |
| --- | --- | --- |
| C1 | `plan.md:79` (role-derived) vs `:80` (capability) | **D23 (đảo, Owner 2026-09-19) → theo `:79`.** Bản v4 round 0–3 chọn `:80`; Owner chốt lại `:79` |
| C2 | `plan.md:164/330/522` nói nhóm = 3 người vs UI render creator trong section nhóm | D22 → theo UI |
| C3 | `plan.md:167` "sau first approval exclusion kết thúc" vs D20 "vô điều kiện" | D20/D21 → tách **historical ban** khỏi **current membership** |
| C4 | Ba draft correction cũ ghi "editable = A + B + contributors" nhưng bị đánh STALE | Phần authorship **chưa từng bị revoke**; D22 khôi phục nó |
| C5 | Một `can_edit` phục vụ ba authority (§3.5) | D31 → **ba** field, không ánh xạ hai-chiều |
| C6 | D26 (bỏ role check) vs `move_topic_order` dựa vào chính helper đó | D37 → helper đổi semantics theo call site, không đổi một lần cho tất cả |
| C7 | D23 cũ (quyền duyệt từ cờ) vs D20/D21 (exclusion) | Owner chốt **(ii)**: exclusion **giữ nguyên như hiện tại**, D20/D21 **không** bị đảo. Việc tách `d1_is_topic_reviewer_excluded` (P11) **vẫn trong scope** |

**C3 là điểm dễ đọc sai nhất.** `plan.md:167` gộp hai thứ khác nhau vào một điều kiện `first_approved_at is null`:
*"không cấm vĩnh viễn người từng ở nhóm"* ≠ *"thành viên hiện tại được tự duyệt bài mình"*.

**C6 là điểm dễ gây regression nhất.** Trước v4, `d1_topic_group_member` trả lời **một** câu hỏi; sau D26 nó trả lời câu
"thuộc nhóm tác giả", và `move_topic_order` đang hỏi nhầm câu. Nếu không sửa `:329`, `previewer + contributor` sẽ
**reorder được** structure.

### 4.2 Giả định

| # | Giả định | Nếu sai thì |
| --- | --- | --- |
| A1 | Không có đường ghi content nào bỏ qua `d1_topic_group_member` | D26 không phủ hết. **Đã kiểm §3.6** — `can_modify_content_by_topic` đã được viết lại để dùng helper (§5.1, giữ nguyên ở §5.4), nên giả định đứng |
| A2 | Pool reviewer **không bao giờ rỗng** ở mọi course đang vận hành | Dưới D41 điều này **được bảo đảm bởi cấu trúc**, không còn là giả định cần M-QA: qua app, target role `owner` luôn bị `COLLABORATOR_MANAGEMENT_FORBIDDEN` ([`20260916130000:576-585`](../../../../../supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql)) nên **mọi course luôn có owner**, và owner **luôn** có quyền duyệt theo role. Rủi ro `TOPIC_REVIEW_NO_ELIGIBLE_REVIEWER` chỉ còn đến từ **exclusion** (mọi reviewer đều là tác giả), không từ cờ |
| A3 | Ba authority ở D31 phủ hết consumer hiện có của `can_edit` | Còn consumer thứ tư bị bỏ sót; §10.2 audit bắt buộc |
| A4 | Không có app-side consumer nào khác đọc `d1_topic_structure_permissions` | Đã kiểm: chỉ `app/actions/topic.ts:510` |

### 4.3 Câu hỏi mở

| # | Câu hỏi | Xử |
| --- | --- | --- |
| Q1 | Contributor + Xóa topic — hiện disabled hay ẩn? | **Chốt: ẩn** (D28) |
| Q2 | owner/co_owner ngoài group khi `pending` làm được gì? | **Chốt:** read + delete + approve/reject; ẩn edit/submit/withdraw |
| Q3 | Tên mã lỗi `TOPIC_RESPONSIBLE_AUTHOR_REQUIRED` giờ sai nghĩa | Đề xuất đổi thành `TOPIC_AUTHOR_SUBMIT_REQUIRED` (§5.13). **v4 đề xuất, Owner chưa xác nhận riêng** |
| Q4 | Creator có được nhận lại trách nhiệm qua transfer không? | **Không chốt ở v4** — câu hỏi contract mới (§5.14) |
| Q5 | `withdraw_review_to_draft` có cần confirm dialog không? | **Không chốt** — thuộc UI polish, không thuộc contract |
| Q6 | Nút Settings (`TopicManagementSheet.tsx:566`, `aria-label` ở `:579`) mở topic-builder hiện **không** có gate. Có nên gate bằng `canEditContent`? | **Không chốt ở v4.** Nó không nằm trong `canEdit` overloaded, nên gán gate là **thêm** ràng buộc mới chứ không phải migrate (U16b). Cần Owner quyết vì ảnh hưởng `previewer + creator` và `editor` ngoài group |
| Q7 | Cột `can_review_topics` trở nên **inert** với `owner`/`co_owner`. Có nên xoá cột, hoặc thêm CHECK ràng buộc cờ với role (ví dụ `role in ('editor','previewer') or not can_review_topics`)? | **Không chốt ở v4 — đề xuất: KHÔNG làm.** Xoá cột là migration phá huỷ đụng `course_collaborators`, `course_collaborator_invitations`, năm đường INSERT **cấp SQL trong `supabase/`** (§3.3 — fixture test INSERT qua PostgREST là phạm vi khác, và cũng đụng), và nhiều fixture; thêm CHECK sẽ chặn `service_role` ghi cờ cho owner tier, mà hiện **không** có lý do nghiệp vụ nào cần chặn. Không có failure mode thực tế nào phát sinh từ việc để cột inert ⇒ theo AGENTS.md rule 2 (Simplicity First), **giữ nguyên**. Ghi thành câu hỏi mở để Owner biết dư lượng này là **có chủ đích**, không phải sót. **Bổ sung round 5:** field `canReviewTopics` trong DTO (`app/actions/course-collaborator.ts:197/252/456/483`) là **giá trị thô của cột** cho **mọi** role, **không** phải `canReview` — consumer phải dùng `canReview` cho mọi phán quyết (A57). **Bổ sung round 7 (`N-F9`):** con số *"năm đường INSERT cấp SQL"* ở câu trên và con số *"**21** lời gọi trên **18** file TS/TSX"* ở §3.3 đều **tái lập được** — lệnh đếm nằm ở §3.3 (*"Lệnh tái lập cho con số `21`/`18`"*); Q7 dẫn lại đây để không trích số trần |

---

## 5. Thiết kế

### 5.1 `d1_topic_group_member` — bỏ role check, giữ course collaboration

```sql
-- giữ nguyên: join chapters/courses/course_collaborators/profiles + các removed_at is null
-- BỎ hẳn: and cc.role in ('owner','co_owner','editor')
and (
  t.original_creator_user_id = auth.uid()
  or t.responsible_author_user_id = auth.uid()
  or exists (select 1 from public.topic_contributors tc
             where tc.topic_id = t.id and tc.user_id = auth.uid() and tc.removed_at is null)
)
```

Vẫn giữ `join public.course_collaborators` + `p.removed_at is null` ⇒ mất membership khoá học = mất hết quyền topic
(D26 + P3).

**Hàm này giờ là `canEditContent`.** Đây là semantic **duy nhất** của nó; các caller khác phải đổi (§5.2, §5.3).

### 5.2 `d1_can_delete_topic` — helper mới, semantic owner của delete/restore authority

```sql
create or replace function public.d1_can_delete_topic(p_topic_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null and exists (
    select 1 from public.topics t
    join public.courses c on c.id = t.course_id
    join public.course_collaborators cc on cc.course_id = t.course_id and cc.user_id = auth.uid()
    join public.profiles p on p.id = auth.uid()
    where t.id = p_topic_id
      and c.removed_at is null and p.removed_at is null
      and (
        cc.role in ('owner'::public.course_member_role, 'co_owner'::public.course_member_role)
        or t.original_creator_user_id = auth.uid()
        or t.responsible_author_user_id = auth.uid()
      )
  )
$$;
```

```sql
revoke all on function public.d1_can_delete_topic(uuid) from public, anon, authenticated;
grant execute on function public.d1_can_delete_topic(uuid) to service_role;
```

**Giữ private (D39).** Cả ba caller — `delete_topic` (§5.7), `d1_restore_topic` (§5.9),
`d1_topic_structure_capabilities` (§5.10) — đều là `security definer`, nên `EXECUTE` của `authenticated` là **không cần
thiết**. `auth.uid()` vẫn đọc đúng người gọi bên trong `security definer`, vì nó lấy từ `request.jwt.claims` chứ không
từ `current_user`.

Đây là `canDeleteTopic` = §7.1. **`d1_topic_group_member_for_restore` bị drop**; `d1_restore_topic` gọi thẳng helper này
(D36 — restore mirror delete) ⇒ **một** authority surface, không hai (§8.2).

### 5.3 `move_topic_order` — đổi sang course-level

`:329` đổi từ `d1_topic_group_member(v_target.id)` thành:

```sql
if not public.d1_is_active_course_author(v_chapter.course_id, v_actor) then
  raise exception 'COURSE_EDIT_FORBIDDEN';
end if;
```

Dùng helper **đã có** (§3.8) ⇒ **không** tạo helper mới và **không** grant gì thêm. `move_topic_order` là
`security definer`, nên gọi được `d1_is_active_course_author` dù `authenticated` không có `EXECUTE` trên nó.
Comment đầu hàm (`:293-295`) nói *"Topic ordering is a topic-scoped mutation"* phải viết lại — sau D37 nó là
**course-structure** mutation.

**Ranh giới helper (D39) — áp cho cả §5.2 và §5.8:** helper nào chỉ được gọi từ một `security definer` boundary
**giữ private** (`revoke … from public, anon, authenticated`; `grant … to service_role`). Chỉ helper nào có client gọi
trực tiếp qua `.rpc(...)` mới được grant cho `authenticated`. Áp cụ thể:

| Helper | Client gọi trực tiếp? | Grant |
| --- | --- | --- |
| `d1_topic_group_member` | **Có** — `app/actions/exercise.ts:760` (`supabase.rpc`) | giữ nguyên `authenticated` (đã có) |
| `d1_topic_structure_capabilities` | **Có** — `app/actions/topic.ts:510` | **phải** grant `authenticated` (§5.10) |
| `d1_is_active_course_author` | Không | giữ **private** |
| `d1_can_delete_topic` (§5.2) | Không | **private** |

`d1_is_topic_author_member` **không tồn tại** trong thiết kế này — P3 tái dùng `d1_topic_group_member` (§5.8).

### 5.4 Ba hàm reviewer — **KHÔNG SỬA** (đảo ngược so với v4 round 0–3)

**Mục này từng là phần thiết kế lớn nhất của v4 và nay rỗng.** Bản trước đề xuất bỏ nhánh role-derived khỏi cả ba hàm
(D23 cũ) rồi bù bằng backfill + materialization guarantee (§5.5). Owner chốt lại D23 ở lượt 2026-09-19: giữ nhánh role,
`can_review_topics` chỉ có nghĩa với `editor`/`previewer`. **Ba hàm đã đúng dạng đó** (§3.1) ⇒ **không đổi dòng nào**.

Kiểm chứng độc lập bằng test **đang xanh**: `topic-review-lifecycle.test.ts:620-628` dựng `co_owner` với cờ `false` và
assert `has_topic_review_access` = `true`. Nếu ai đó "sửa" ba hàm theo D23 cũ, test này sẽ đỏ — và đỏ là **đúng**.

**Cấm sửa, ghi rõ để không ai làm nhầm:** không bỏ `cc.role in ('owner','co_owner')` khỏi
`d1_has_eligible_topic_reviewer` (`:151-157`), `has_topic_review_access` (`:183-189`), hay khỏi **cả hai** arm của
`d1_assert_pending_review_reviewer_safety` (`:231-247`).

**Phạm vi chính xác của lệnh cấm này** (*bổ sung ở round 7 — `B-F9`: bản round 4–6 viết ở dạng "cấm chạm hàm", và
Implementor đọc D42 xong sẽ tưởng hai mệnh lệnh mâu thuẫn.*). Lệnh cấm ở trên cấm **một** việc: **bỏ hoặc đổi nhánh
`cc.role in ('owner','co_owner')`** — vì đó chính là regression lên D41 (`R16′`). Nó **không** cấm mọi thay đổi trên ba
hàm.

**D42 KHÔNG đòi sửa gì ở đây.** Enforcement của D42 nằm ở **§5.5** (RPC `v_new_flag` + trigger clear-on-downgrade) — đó
là nơi trả lời câu hỏi *"sau khi đổi role thì cờ là gì"*, và câu trả lời đó **đã đúng** (hai lớp, phủ hết enum — xem
bảng vét cạn ở §5.5). Ba hàm dưới đây chỉ **đọc** giá trị đã được hai lớp đó bảo đảm, nên chúng **không** cần và
**không** được thêm logic D42. Owner chốt ở round 7: **không** thêm D42 logic vào ba reviewer helper.

Nói cách khác: **D42 và §5.4 không mâu thuẫn** — chúng nói về hai tầng khác nhau. §5.4 cấm *đổi định nghĩa quyền duyệt*;
§5.5 thi hành *transition contract* trên giá trị lưu trữ. Implementor **không** có việc ở §5.4.

`can_modify_content_by_topic` (`20260916140000:99`) **giữ nguyên** — nó đã gọi `d1_topic_group_member`, nên tự động nhận
semantics `canEditContent` mới. **Không** đổi gì ở RLS cards/exercises/questions.

### 5.5 Trigger và `case` đổi role — **KHÔNG SỬA**

**Mục này cũng rỗng, cùng lý do.** Bản trước đề xuất: widen đăng ký trigger `clear_topic_review_capability_on_role_downgrade`
thành `before insert or update of …`, viết lại body trigger, và sửa biểu thức `case` đổi role ở `update_course_collaborator_role`.
Toàn bộ ba việc đó tồn tại **chỉ để** ép `can_review_topics = true` cho row owner/co_owner — mục tiêu mà D41 đã bỏ.

**Vì sao bỏ được mà không mất gì:** dưới D41, giá trị `can_review_topics` của row **owner tier** là **inert** — không
reader nào phán quyết owner tier bằng cờ (§3.1).

**Nhưng "inert" không có nghĩa là "vô hại nếu xoá".** Khi một row **rời** owner tier (`co_owner → editor|previewer`), nó
trở thành row tier thấp, và ở đó cờ **được đọc** — nhánh thứ hai của `has_topic_review_access`
([`20260916130000:183-189`](../../../../../supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql)) và của
`d1_has_eligible_topic_reviewer` (`:151-157`). Nên trigger clear-on-downgrade **có** hiệu ứng hành vi quan sát được, và
**phải giữ**. Nếu bỏ nó, `co_owner → editor` sẽ mang theo cờ `true` ⇒ người bị hạ tier **vẫn** duyệt được qua cờ, làm đỏ
hai fixture đang xanh (`course-authoring-role-matrix.test.ts:224-235`, `topic-review-lifecycle.test.ts:652-657`) và phá
đúng D42 ("hạ khỏi owner tier phải cấp lại explicit capability"). Lệnh cấm ở §8.2 là defence **thứ hai** — xem bảng
vét cạn hai lớp enforcement ở dưới.

Các hệ quả cần ghi lại, vì chúng là **gốc blocker của cả năm round**:

* **B1 tan.** Không cần phủ `INSERT` nữa ⇒ không cần đụng đăng ký trigger. Lý do **đúng** không phải "không ai đọc", mà
  là: cờ của row owner tier là inert, và **mọi đường rời owner tier** đều đi qua `UPDATE role` — tức đã nằm trong phạm
  vi `before update of role, can_review_topics`. Một `INSERT` thẳng row owner-tier cờ `true` (chỉ tới được bằng
  `service_role`) để lại cờ inert.

**Hai lớp enforcement của D42** (*sửa cách quy nguồn ở round 7 — `B-F9`: Owner chốt D42 vẫn là **hard contract**, và
enforcement source là hai lớp dưới đây, **không** phải một lập luận cấu trúc.*) Bất biến *"cờ cũ không resurrect"* **có**
cơ chế, gồm **hai lớp độc lập**:

1. **Lớp chủ động — RPC `update_course_collaborator_role_with_responsibility`**
   ([`20260916130000:601-605`](../../../../../supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql)):
   `v_new_flag := case when p_role = v_target.role then v_target.can_review_topics when v_target.role = 'previewer' and
   p_role = 'editor' then v_target.can_review_topics else false end` — **mọi** thay đổi role khác hai ngoại lệ tường
   minh đều hạ cờ, và giá trị đó được ghi thẳng vào `UPDATE`. Đây là lớp chạy **trước** khi row chạm bảng.
2. **Lớp phòng vệ — trigger `clear_topic_review_capability_on_role_downgrade`**
   ([`20260915100000:13-30`](../../../../../supabase/migrations/20260915100000_d1_trusted_lifecycle.sql)), đăng ký
   `before update of role, can_review_topics` ([`20260915090000:140`](../../../../../supabase/migrations/20260915090000_d1_foundation.sql)):
   ba nhánh `owner → ¬owner`, `co_owner → {editor, previewer}`, `editor → previewer`. Lớp này bắt **cả** những đường ghi
   **không** đi qua RPC — kể cả `UPDATE` trực tiếp bằng `service_role`.

**Vì sao hai lớp phủ hết — đây là chứng minh vét cạn, không phải quan sát mẫu.** Enum `course_member_role` chỉ có **bốn**
giá trị: `previewer`, `editor`, `co_owner`, `owner`
([`20260609114505:55-60`](../../../../../supabase/migrations/20260609114505_remote_schema.sql)). Nên tập hạ tier **chỉ
có thể** là ba nhóm sau, và **cả ba** đều khớp một nhánh trigger:

| Transition | Nhánh trigger bắn | Kết quả |
| --- | --- | --- |
| `owner → co_owner` | nhánh 1 (`new.role <> 'owner'`) | cờ `false` |
| `owner → editor` / `owner → previewer` | nhánh 1 | cờ `false` |
| `co_owner → editor` / `co_owner → previewer` | nhánh 2 | cờ `false` |
| `editor → previewer` | nhánh 3 | cờ `false` |

Hai transition **còn lại** của enum là `co_owner → owner` và `editor → {co_owner, owner}` — đều là **đi vào** owner tier,
không phải hạ tier: cờ không bị tước, nhưng ở đó nó **inert**, và **mọi** đường rời owner tier sau đó đều bị tước theo
bảng trên. Nên **không tồn tại đường resurrect nào** — kể cả qua `service_role`. Với **app path**, cả ba nhóm hạ tier
cũng đều rơi vào `else false` của RPC (lớp 1).

§3.14 vế 4 + `A60` **giữ nguyên**, nhưng hạ vai trò: chúng là **defense-in-depth** và là ràng buộc **đường app**
(`owner ↔ co_owner` bất khả qua app, không nâng được ai vào owner tier), **không** còn là nguồn sức mạnh duy nhất của
D42. Ghi chú `L-F10` cũ — *"trigger tước được trong mọi trường hợp là mạnh hơn bằng chứng"* — **đã gỡ**: với enum bốn
giá trị, phát biểu đó **đúng** và nay được chứng minh vét cạn ở bảng trên.

* **B-F3 tan.** Không còn "trạng thái owner-tier cờ TẮT không dựng được bằng INSERT" — dưới D41 trạng thái đó **không
  cần dựng**, vì cờ không mang nghĩa gì với owner tier.
* **B-F1/B-F4 tan.** Không còn biểu thức `case` phải viết lại, không còn materialization guarantee phải thi hành.

**Không đụng:** `clear_topic_review_capability_on_role_downgrade` ([`20260915100000:13-30`](../../../../../supabase/migrations/20260915100000_d1_trusted_lifecycle.sql)),
đăng ký trigger ([`20260915090000:137-143`](../../../../../supabase/migrations/20260915090000_d1_foundation.sql)), biểu thức
`case` ở [`20260916130000:601-605`](../../../../../supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql), các
bản sao ở `20260915100000:876-877` / `20260915160000:51-52`, và CHECK + coercion của invitation.

**Dư lượng schema, ghi trung thực:** cột `can_review_topics` vẫn tồn tại và vẫn ghi được vào row owner/co_owner qua
`service_role`. Nó **inert**, không phải sai. v4 **không** đề xuất xoá cột hay thêm CHECK ràng buộc nó với role — xem Q7.

### 5.6 Lock primitive cho delete/restore

`d1_lock_topic_for_mutation` **không** tái dùng được (group check ở `:48`). Thêm:

```sql
create or replace function public.d1_lock_topic_lifecycle(p_topic_id uuid)
returns public.topics%rowtype
language plpgsql security definer set search_path = public
as $$
declare v_topic public.topics%rowtype; v_course_id uuid;
begin
  select t.course_id into v_course_id from public.topics t where t.id = p_topic_id;
  if not found then raise exception 'TOPIC_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtext(v_course_id::text));
  perform pg_advisory_xact_lock(hashtext(p_topic_id::text));
  select * into v_topic from public.topics t where t.id = p_topic_id for update;
  return v_topic;
end;
$$;
```

Thứ tự lock **course → topic**, **đúng** như `approve_topic_review` (`20260915130000:170-174`),
`reject_topic_review` (`20260917110000:28-31`), và `prepare` (`20260916140000:213-214`). Sai thứ tự ⇒ deadlock.
`pg_advisory_xact_lock` tái nhập được trong cùng transaction, nên việc trigger `d1_guard_topic_lifecycle_mutation`
(§3.7) cũng lấy đúng cặp lock này **không** gây deadlock.

**Grant (D39, review round 0 bổ sung):** cả ba caller — `delete_topic`, `withdraw_review_to_draft`, `d1_restore_topic` —
đều là `security definer`, nên helper này **giữ private**:

```sql
revoke all on function public.d1_lock_topic_lifecycle(uuid) from public, anon, authenticated;
grant execute on function public.d1_lock_topic_lifecycle(uuid) to service_role;
```

Hàm trả `public.topics%rowtype` nên **không** được grant cho `authenticated` dù chỉ để "cho chắc" — nó lộ nguyên row
topic, gồm cả cột mà RLS đang che.

### 5.7 `delete_topic` — RPC thống nhất (D33 + D35)

Viết lại `d1_delete_topic`, **không** gọi `d1_prepare_topic_content_mutation`:

```sql
-- auth
if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
v_topic := public.d1_lock_topic_lifecycle(p_topic_id);

-- D35: invariant lifecycle do prepare từng gánh
if v_topic.removed_at is not null then raise exception 'TOPIC_NOT_FOUND'; end if;

-- D33/D27: delete authority riêng, KHÔNG dùng group authoring
if not public.d1_can_delete_topic(p_topic_id) then raise exception 'COURSE_EDIT_FORBIDDEN'; end if;

-- D33: pending → cancel trước, atomic
if v_topic.status = 'pending' then
  perform public.d1_cancel_pending_reviews_for_topics(
    array[p_topic_id], auth.uid(),
    'Hủy yêu cầu duyệt để xóa bài học.'      -- D38
  );
end if;

-- D35: published guard giữ nguyên semantics
if v_topic.status = 'published' and not coalesce(p_confirm_published, false) then
  raise exception 'TOPIC_PUBLISHED_CONFIRM_REQUIRED';
end if;

update public.topics
set status = 'draft', removed_at = timezone('utc', now())
where id = p_topic_id;
```

**Thứ tự bắt buộc:** cancel **trước** khi xoá. Nếu không, partial unique index
`topic_review_submissions_one_pending_idx` (`20260915090000:97`) còn row `pending` sẽ **chặn mọi lần gửi duyệt sau** nếu
topic được khôi phục.

**Phụ thuộc GUC — bắt buộc, không hiển nhiên (review round 0 bổ sung).** Câu `update` cuối cùng đi qua trigger
`d1_guard_topic_lifecycle_mutation` (§3.7), mà trigger đó raise `TOPIC_PENDING_FROZEN` khi
`current_setting('voca.d1_trusted_topic_lifecycle', true) is distinct from 'on'`. Trên nhánh `pending`, điều kiện này
**chỉ** được thoả vì `d1_cancel_pending_reviews_for_topics` set GUC ấy ở dòng đầu
([`20260915100000:956`](../../../../../supabase/migrations/20260915100000_d1_trusted_lifecycle.sql)) với
`set_config(..., true)` — transaction-local, nên còn hiệu lực cho câu `update` phía sau **trong cùng transaction**.

⇒ **Bước cancel không được bỏ, không được đổi thứ tự xuống sau `update`, và không được thay bằng một lệnh `update`
submission tự viết.** Implementor phải tự xác nhận chuỗi này trước khi code (§14). Hai nhánh `draft` và `published`
không cần GUC vì `v_status <> 'pending'`.

**Chữ ký giữ nguyên** `(p_topic_id uuid, p_confirm_published boolean default false)` ⇒ `app/actions/topic.ts:377` không đổi.

**Kiểm tra lại bất biến sau v4:** cancel → topic về `draft`; rồi `update` set `status='draft'` (idempotent) + `removed_at`.
Nhánh `published` + confirmed: prepare cũ từng demote trước; nay `update` cuối set thẳng `draft` ⇒ cùng kết quả cuối, **một**
statement thay vì hai. Nhánh `published` + chưa confirm raise **trước** khi `update`, nên không có mutation nào xảy ra.

### 5.8 `withdraw_review_to_draft` — action riêng (D34)

```sql
create or replace function public.withdraw_review_to_draft(p_topic_id uuid)
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_topic public.topics%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  v_topic := public.d1_lock_topic_lifecycle(p_topic_id);

  if v_topic.removed_at is not null then raise exception 'TOPIC_NOT_FOUND'; end if;
  -- P3: topic identity AND active membership — tái dùng chính d1_topic_group_member
  if not (public.d1_topic_group_member(p_topic_id)
          and auth.uid() in (v_topic.original_creator_user_id, v_topic.responsible_author_user_id))
  then raise exception 'COURSE_EDIT_FORBIDDEN'; end if;
  if v_topic.status <> 'pending' then raise exception 'TOPIC_NOT_PENDING'; end if;

  perform public.d1_cancel_pending_reviews_for_topics(
    array[p_topic_id], auth.uid(),
    'Tác giả hủy yêu cầu duyệt để tiếp tục chỉnh sửa.'   -- D29, giữ "Tác giả"
  );
  return jsonb_build_object('status','withdrawn','topic_id',p_topic_id);
end;
$$;
```

**Không tạo helper mới cho vế membership (P3).** `d1_topic_group_member(p_topic_id)` **chính là**
`topic identity AND active course collaboration` cần cho P3 — nó đã join `course_collaborators` + `courses.removed_at`
+ `profiles.removed_at`. Thêm `d1_is_topic_author_member` sẽ là surface **thứ hai** trả lời cùng một câu hỏi, đúng thứ
A41 cấm. Vế `auth.uid() in (creator, responsible)` chỉ **thu hẹp** kết quả đó xuống creator/responsible.

Hệ quả kiểm chứng được: creator đã bị xoá khỏi course (`course_collaborators` không còn row) ⇒ `d1_topic_group_member`
trả `false` ⇒ `withdraw_review_to_draft` từ chối. Đây đúng là P3.

### 5.9 `d1_restore_topic` — chỉ đổi lời gọi group check

`:269` đổi `d1_topic_group_member_for_restore(v_topic.id)` → `public.d1_can_delete_topic(v_topic.id)`.
Các guard còn lại (`:272` pending freeze, `:273` `TOPIC_NOT_REMOVED`, `:274-281` chapter check) **giữ nguyên** (§3.11).
Helper `d1_topic_group_member_for_restore` **drop** (§8.2).

### 5.10 Read model — capability mới

`get_topic_workflow_state` (`20260917110000`) thêm:

| Field | Điều kiện |
| --- | --- |
| `canWithdrawReview` | `d1_topic_group_member(p_topic_id)` AND `status='pending'` AND có submission `pending` AND `v_user_id ∈ {original_creator, responsible}` |
| `canDeleteTopic` | `d1_can_delete_topic(p_topic_id)` |
| `canEdit` (**giữ tên**, semantics = `canEditContent`) | `d1_topic_group_member(v_topic.id)` — không đổi |

Cả ba suy từ dữ liệu **đã có** trong read model (`v_topic`, `v_pending`) — không cần join mới.

`canRequestReview` đổi theo §5.11.

`d1_topic_structure_permissions` → **hàm mới** `d1_topic_structure_capabilities` trả **ba** cột
`(topic_id, can_edit_content, can_manage_structure, can_delete_topic)` (D31). Consumer `app/actions/topic.ts:510-529` đổi
theo §5.12 U14. Hàm cũ **drop** sau khi consumer đã chuyển (B4).

**Đây là helper DUY NHẤT trong v4 phải grant cho `authenticated`** (D39), vì client gọi trực tiếp qua
`supabase.rpc("d1_topic_structure_capabilities", …)`:

```sql
revoke all on function public.d1_topic_structure_capabilities(uuid[]) from public, anon;
grant execute on function public.d1_topic_structure_capabilities(uuid[]) to authenticated, service_role;
```

Đổi **shape** trả về (3 cột thay 1) là lý do phải là **tên mới**: `create or replace function` **không** đổi được return
type, phải `drop` trước. Lý do **thứ hai** là B4 — không để hai authority surface song song. Thứ tự bắt buộc:
`create` hàm mới → chuyển consumer (P14/P15) → `drop` hàm cũ (P18).

Read gate `has_course_topic_read_access(t.course_id)` giữ nguyên trong hàm mới.

### 5.11 `request_topic_review` — nới submitter, đổi gate sang topic scope

| Hiện tại | Sửa thành |
| --- | --- |
| `has_course_authoring_access(v_topic.course_id)` (`20260917100000:215`) | `d1_topic_group_member(p_topic_id)` |
| `responsible_author_user_id <> v_user_id` → lỗi (`:216`) | `v_user_id not in (original_creator_user_id, responsible_author_user_id)` |

Gate cũ vừa **sai phạm vi** (course thay vì topic) vừa **chặn oan** creator bị hạ role xuống `previewer`.

`canRequestReview` (§5.10) thêm `v_user_id in (original_creator, responsible)`:

```sql
'canRequestReview', v_can_edit
  and v_topic.status = 'draft'
  and v_user_id in (v_topic.original_creator_user_id, v_topic.responsible_author_user_id)
  and v_card_count > 0 and v_exercise_count > 0
  and v_has_distinct_reviewer,
```

### 5.12 UI

**`TopicWorkflowPanel.tsx`**

| # | Sửa |
| --- | --- |
| U1 | `getNextAction`: thêm nhánh contributor → *"Chỉ người tạo hoặc người phụ trách có thể gửi bài học để duyệt."* |
| U2 | Nút Gửi duyệt: **ẩn** khi `!canEdit`; giữ `status === "draft"` |
| U3 | Hai nút `pending` theo `canWithdrawReview` / `canDeleteTopic` |
| ~~U4~~ | `:175` (bản trước ghi `:176` — nit round 3) — **GIỮ NGUYÊN, không sửa.** `TopicWorkflowPanel.tsx:175` đọc `workflow.role === "owner" \|\| workflow.role === "co_owner" ? "Có quyền duyệt theo vai trò" : workflow.canReview ? "Có quyền duyệt" : "Chỉ xem / soạn"` — đã phân nhánh đúng theo D41 |
| U5 | Reviewer actions giữ family riêng theo `canReview` |
| U6 | **Copy của nút quay-về-draft** (D29, verbatim): *"Quay về chỉnh sửa 🔒 / Chỉ người tạo hoặc người phụ trách có thể hủy yêu cầu duyệt."* Lý do Owner nêu: *"Contributor nhìn vào hiểu ngay pending đang freeze và ai có quyền mở khóa."* |
| U7 | **Nhãn nút xoá khác theo actor** (D33): creator/responsible → *"Hủy gửi duyệt và xóa bài học"*; owner/co_owner ngoài group → *"Xóa bài học"*. **Cùng một RPC.** |

**`TopicAuthorshipSection.tsx`**

| # | Sửa |
| --- | --- |
| U8 | `currentGroupUserIds` (`:96`) thêm `workflow.originalCreator.userId` |
| U9 | `inCurrentGroup` (`:179`) → `!workflow.canEdit` — sửa câu amber sai |
| U10 | Copy `:195` *"Người phụ trách là người **duy nhất** được gửi..."* → phản ánh D22 |

**`CollaboratorManagementDialog.tsx`**

| # | Sửa |
| --- | --- |
| U11 | `:176` — **GIỮ NGUYÊN** việc gửi `canReviewTopics: false` cho invite co_owner. Không đổi payload. (B-F2, round 2: bản trước của v4 bảo gửi `true` — **sai**) |
| ~~U13~~ | `:268` — checkbox **đang ẩn** với `inviteRole === "co_owner"`. **GIỮ ẨN — không sửa.** Bản trước biện luận bằng D25; D25 đã **rút lại** (D41), nhưng kết luận *"giữ ẩn"* vẫn đúng vì `can_review_topics` không có nghĩa với `co_owner`. |
| ~~U13b~~ | **XOÁ** (round 3, M-F3). Bản trước yêu cầu *"`:315` mở checkbox cho owner/co_owner đã là collaborator (D25)"*. Hai lỗi: (a) D25 đã rút lại ⇒ không còn cơ sở; (b) nó mô tả `:315` **ngược source** — `:315` là `{(member.role === "editor" \|\| member.role === "previewer") ? (<label>…) : null}`, owner/co_owner nhận `null`, **không** có checkbox nào để "mở". |
| ~~U12~~ | `:296` — **GIỮ NGUYÊN, không sửa.** Bản trước đòi đổi badge *"Duyệt theo vai trò"* sang "theo capability thật". Dưới D41 badge này **đã đúng**: owner/co_owner duyệt theo role thật. |
| U14 | `:229` copy *"Quyền soạn nội dung và quyền duyệt bài học được tính theo vai trò hiện tại"* — **đổi ở round 5.** Bản trước đòi đổi thành *"theo capability"*; dưới D41 điều đó **sai** với owner tier. Copy mới phải nói đúng hai mặt phẳng: quyền duyệt của `owner`/`co_owner` **theo vai trò**, của `editor`/`previewer` **theo thiết lập duyệt của khóa học**. Đây là cùng họ lỗi với B-F5 — sửa cùng lượt. **Wording (sửa round 6 — `N-F5`):** dùng *"thiết lập duyệt của khóa học"*, **không** dùng *"thiết lập riêng"* — nguồn DB là cột `can_review_topics`, và Q7 + `A57` nói consumer phải dùng `canReview`, **không** đọc giá trị thô của cột; copy UI không được gợi ý đọc cột |

**Bốn mục U4, U12, U13, U13b đều là hệ quả trực tiếp của D23 cũ.** Chúng yêu cầu đổi UI từ *role-derived* sang
*capability-derived*. D41 đảo lại đúng chiều đó, nên cả bốn **không còn việc để làm** — UI hiện tại đã ở trạng thái đích.
Đây là lý do §5.12 co lại đáng kể: **dialog quản lý collaborator chỉ còn `U14`** (sửa copy `:229`) — **không** phải "zero
thay đổi"; `U14` được thêm ở cùng round 5 vì copy sống nói quyền duyệt "theo vai trò hiện tại" cho **mọi** role, sai với
`editor`/`previewer` dưới D41/D42.

**Kiểm chứng độc lập (round 3):** `handleCapabilityChange` (`:107-114`) chỉ với tới được từ checkbox ở `:315`, mà `:315`
chỉ render cho `editor`/`previewer`. Nên không có đường UI nào gọi RPC capability cho owner/co_owner — khớp guard
`COLLABORATOR_CAPABILITY_ROLE_INVALID`, và khớp D41.

**Vì sao U11 vẫn giữ `false` — và vì sao điều đó nay là hiển nhiên.** Payload đi thẳng vào `p_can_review_topics`
(`CollaboratorManagementDialog.tsx:175-176` → `app/actions/course-collaborator.ts:394` →
`send_course_collaborator_invitation`), và DB chặn ở ba tầng:

* CHECK `role <> 'co_owner' or not can_review_topics` ([`20260915140000:15-17`](../../../../../supabase/migrations/20260915140000_d1_collaborator_invitations.sql))
* RPC raise `INVITATION_CAPABILITY_ROLE_INVALID` ([`:99-101`](../../../../../supabase/migrations/20260915140000_d1_collaborator_invitations.sql))
* RPC ép `else false` khi ghi ([`:151-155`](../../../../../supabase/migrations/20260915140000_d1_collaborator_invitations.sql))

Và `owner` **không mời được** qua đường này (`INVITATION_OWNER_ROLE_FORBIDDEN`); dialog chỉ cho chọn `co_owner`, `editor`,
`previewer`. Dưới D23 cũ, ba tầng này là **rào cản** phải vượt; dưới D41 chúng **chính là contract**. U11 vì thế chuyển
từ "giữ `false` để tránh lỗi" thành "gửi `false` vì đó là giá trị đúng duy nhất".

**`TopicManagementSheet.tsx` + `types.ts` + `app/actions/topic.ts` — consumer của `canEdit` bị quá tải**

| # | Vị trí | Đổi sang |
| --- | --- | --- |
| U15 | `types.ts:20` | `canEdit` → **ba** field `canEditContent`, `canManageStructure`, `canDeleteTopic` |
| U16 | `:142`, `:175`, `:558` (rename dialog) | `canEditContent` (D32) |
| U16b | `:566` (nút Settings mở topic-builder; `aria-label` ở `:579`) | **Chưa chốt** — hiện **không** có gate nào (không `disabled`). Không phải `canEdit` gate, nên gán vào `canEditContent` là **thêm** một ràng buộc mới, không phải migrate. Xem Q6 |
| U17 | `:154`, `:342` (move/reorder) | `canManageStructure` (D37) |
| U18 | `:234`, `:588` (ẩn/xoá) | `canDeleteTopic` (D31) |
| U19 | `app/actions/topic.ts:510-529` | gọi `d1_topic_structure_capabilities`, map ba cột |

**Chi tiết 1 của Owner — guard contributor cap**

| # | Sửa |
| --- | --- |
| U20 | `d1_guard_topic_contributor_mutation` (`20260916120000:170-172`): chặn thêm **creator** làm contributor, cạnh nhánh chặn responsible hiện có. Đặt ở **trigger** để ép cả direct Data API và `service_role` |

### 5.13 Đổi tên mã lỗi (Q3 — v4 đề xuất, Owner chưa xác nhận riêng)

`TOPIC_RESPONSIBLE_AUTHOR_REQUIRED` → `TOPIC_AUTHOR_SUBMIT_REQUIRED`. Phạm vi **live**: `request_topic_review` (raise tại
`20260917100000:216` — bản sống), `app/actions/topic-review.ts:26` (map), hai assertion trong
`topic-authorship-boundary.test.ts`. Chuỗi này **vẫn còn** trong migration lịch sử đã bị thay thế
(`20260916130000:766`) — **không** tính là vi phạm (xem A38). Lý do: sau D22 tên cũ **đọc là hiểu sai** — không còn
nghĩa "chỉ responsible".

### 5.14 Câu hỏi mới D26 làm nảy ra — **không chốt ở v4**

`transfer_topic_responsibility` chỉ nhận recipient là owner/co_owner (tự nhận) hoặc contributor đang hoạt động
(`20260917100000:52-63`). Creator với role `editor` và không phải contributor ⇒ **không nhận lại trách nhiệm được**.
Sau D22 câu hỏi tự nhiên là creator có nên là recipient hợp lệ. **v4 không tự quyết.**

### 5.15 Accessibility — `disabled` + `title` không đọc được bằng bàn phím

Pattern hiện tại (`TopicWorkflowPanel.tsx:189-190`) dùng `disabled` + `title=`. Button `disabled` **không nhận focus**,
nên tooltip không bao giờ hiện với người dùng bàn phím. Repo có `components/ui/tooltip.tsx` sẵn.

**Sửa:** dùng `aria-disabled` + giữ focusable, hoặc render lý do thành text như `getNextAction` đang làm. Vấn đề **có
sẵn** trong repo, không do v4 gây ra, nhưng D28 làm nó phổ biến hơn.

---

## 6. Delta contract — sửa đúng các mục này của v2

| Mục v2 / `plan.md` | Sửa thành |
| --- | --- |
| `plan.md:79` | **GIỮ NGUYÊN — nay là câu ĐÚNG.** "owner/co_owner derive từ role, editor/previewer cần flag `true`" chính là D23 (đảo) + D41. Bản v4 round 0–3 định viết lại câu này; **huỷ** |
| `plan.md:80` | **STALE** — "theo effective reviewer capability" mô tả mô hình chưa từng implement và nay bị D41 bác. Ghi nhận stale, **không** sửa ở v4 (tầng reconcile D14) |
| `plan.md:164` | Nhóm tác giả = **creator + responsible + tối đa 2 contributor** (D22) |
| `plan.md:165` | Vế "**là người duy nhất** được request/resubmit" → creator + responsible. Vế "Contributor không được request/resubmit" **giữ** |
| `plan.md:166` | "chỉ responsible author resubmit" → creator + responsible |
| `plan.md:167` | **Tách hai vế:** bỏ historical ban sau first approval (giữ); **thêm** current membership vô điều kiện (D20/D21) |
| `plan.md:168` | Giữ nguyên |
| `plan.md:185` | Thêm creator; bỏ role check (D26) |
| `plan.md:304` | **Tách hai mệnh đề.** Vế "hiển thị `theo vai trò`, không toggle" nay **đúng** (D41) — giữ. Vế "raw flag không thể nâng role" cũng đúng — giữ. **Bỏ** yêu cầu mở toggle cho owner/co_owner (D25 đã rút lại) |
| `plan.md:305` | **Giữ** nội dung (hierarchy + bảo vệ reviewer cuối cùng); "reviewer hợp lệ" phải viết theo **D41** — `role ∈ {owner,co_owner} OR can_review_topics` — **không** theo capability đơn thuần |
| `plan.md:330` | "The current responsible author is the only request/resubmit actor" → creator + responsible. Vế "reviewers are separately governed by `can_review_topics`" là **STALE** (xem `:80`) — D41 bác bỏ |
| `plan.md:415` | "responsible author alone can request/resubmit" → creator + responsible |
| `plan.md:455` | "responsible-only submit/resubmit" → creator + responsible; "initial-review exclusion" theo D20/D21 |
| `plan.md:476` | "responsible-only request/resubmit" → creator + responsible |
| `plan.md:496` | Cập nhật theo D20–D38; "post-first-approval reset" tách hai vế như `:167` |
| `plan.md:522` | Nhóm tác giả theo D22 |
| `plan.md:523` | **Tách hai vế** như `:167` |
| **Mới — cần thêm vào `plan.md`** | **Ba authority riêng** (D31): content / structure / delete-restore. `plan.md` chưa có khái niệm này; `:185` chỉ nói về content |

---

## 7. Ma trận quyền sau v4

### 7.1 Định nghĩa ba capability

```text
canEditContent
= active course collaborator
  AND (creator OR responsible OR active contributor)

canManageStructure
= active course collaborator
  AND course role ∈ {owner, co_owner, editor}

canDeleteTopic
= active course collaborator
  AND (owner/co_owner OR creator OR current responsible)
```

`active course collaborator` = có row `course_collaborators`, `courses.removed_at is null`, `profiles.removed_at is null`.
`canManageStructure` = `d1_is_active_course_author` (§3.8). `canDeleteTopic` = `d1_can_delete_topic` (§5.2), và **cũng là**
restore authority (D36).

### 7.2 Cấp course

| Role | Tạo topic | Quản lý course | Duyệt |
| --- | --- | --- | --- |
| `owner` | ✅ | ✅ | **theo role (D41/D42)** — cờ `can_review_topics` là **inert** với owner tier |
| `co_owner` | ✅ | ✅ | **theo role (D41/D42)** — cờ `can_review_topics` là **inert** với owner tier |
| `editor` | ✅ | ❌ | theo `can_review_topics` (cột `DEFAULT false`) |
| `previewer` | ❌ | ❌ | theo `can_review_topics` (cột `DEFAULT false`) |

Không có cột nào ở đây là "default true": cột được khai `set default false` ([`20260915090000:15-23`](../../../../../supabase/migrations/20260915090000_d1_foundation.sql)), và các đường tạo do contract quản đều ép `false` cho owner tier (§3.3). Quyền duyệt của owner tier **không** đọc cột đó — xem `has_topic_review_access` (§3.1).

### 7.3 Cấp topic X — độc lập course role

| Vị trí | `canEditContent` | `canManageStructure` | `canDeleteTopic` | Tự duyệt |
| --- | --- | --- | --- | --- |
| creator | ✅ | theo course role | ✅ | ❌ D20 |
| responsible | ✅ | theo course role | ✅ | ❌ D20 |
| active contributor | ✅ | theo course role | ❌ | ❌ D20 |
| `owner`/`co_owner` ngoài group | ❌ | ✅ | ✅ | **theo role (D41/D42)** |
| `editor` ngoài group | ❌ | ✅ | ❌ | theo capability |
| `previewer` ngoài group | ❌ | ❌ | ❌ | theo capability |

**Ngoại lệ có thật trong repo:** `active contributor` **luôn** có course role ∈ {owner, co_owner, editor}, vì
`add_topic_contributor` chặn `previewer` (§3.13). Cột `canManageStructure` của dòng đó vì vậy luôn là ✅ **hôm nay** —
nhưng nó đến từ **course role**, không từ membership. Hai trục vẫn độc lập; chỉ là tập giá trị khả dĩ bị thu hẹp.

**Hệ quả kiểm chứng được (D31/D32/D37):**

| Actor | Rename topic người khác | Sửa content | Reorder | Xoá topic người khác |
| --- | --- | --- | --- | --- |
| `editor` ngoài group | ❌ | ❌ | ✅ | ❌ |
| `previewer` + creator | ✅ (topic mình) | ✅ | ❌ | ✅ (topic mình) |
| topic contributor (`editor` role) | ✅ (topic mình) | ✅ | ✅ | ❌ |

**Không có dòng `previewer + contributor`** — trạng thái đó bất khả (§3.13). Nếu rào `add_topic_contributor` được nới sau
này, dòng đó sẽ là `✅ / ❌ / ❌` (content có, structure không, delete không); ghi ở đây để lần nới đó không phải suy lại.

Dòng cuối: contributor giữ được `canManageStructure` **vì course role vẫn là `editor`** — không phải vì topic membership.
Đây là điểm D37 bảo vệ: hai trục độc lập.

### 7.4 Hiện/ẩn action (D28)

| Actor | Quay về chỉnh sửa | Gửi duyệt | Xoá topic |
| --- | --- | --- | --- |
| Creator | hiện/enabled khi hợp lifecycle | hiện/enabled | hiện/enabled |
| Responsible | hiện/enabled khi hợp lifecycle | hiện/enabled | hiện/enabled |
| Contributor | **hiện disabled** | **hiện disabled** | **ẩn** |
| Owner/co_owner ngoài group | **ẩn** (pending) | **ẩn** | hiện/enabled |
| Editor ngoài group | **ẩn** | **ẩn** | **ẩn** |
| Previewer ngoài group | **ẩn** | **ẩn** | **ẩn** |

**Owner/co_owner ngoài group khi `pending`:** read + delete + **approve/reject** — quyền duyệt đến từ **role** (D41), **không**
phụ thuộc `can_review_topics`. Ẩn **chỉ** edit/submit/withdraw. Nếu họ **thuộc** current authoring group thì D20 chặn review.

**Nhãn khác nhau, capability giống nhau (D33):** owner/co_owner ngoài group thấy *"Xóa bài học"*; creator/responsible thấy
*"Hủy gửi duyệt và xóa bài học"*. Cả hai gọi **cùng** `delete_topic`.

---

## 8. Scope, và scope bị cấm

### 8.1 Trong scope (P11–P18)

| Path | Việc |
| --- | --- |
| `supabase/migrations/20260919100000_d1_topic_authority_split.sql` (mới) | §5.1, §5.2, §5.3, §5.9, §5.11, §5.13, U20 |
| ~~`…_d1_reviewer_capability_correction.sql`~~ | **XOÁ khỏi scope** (D41). Bản trước định tạo migration này cho §5.4/§5.5; nay cả hai rỗng. **Không** tạo file, **không** đụng `course_collaborators`, trigger, hay invitation |
| `supabase/migrations/20260919120000_d1_topic_lifecycle_delete.sql` (mới) | §5.6, §5.7, §5.8, §5.10 (phần `d1_topic_structure_capabilities`) |
| `lib/schemas/topic-workflow.ts` | Thêm `canWithdrawReview`, `canDeleteTopic` |
| `app/actions/topic.ts` | U19 + action `withdrawReviewToDraft` + `mapTopicReviewError` §5.13 |
| `app/actions/topic-review.ts` | Map error §5.13 |
| `_components/types.ts` | U15 |
| `_components/TopicManagementSheet.tsx` | U16, U17, U18 |
| `_components/TopicWorkflowPanel.tsx` | U1–U3, U5–U7, §5.15 (**U4 đã rút** — D41) |
| `_components/TopicAuthorshipSection.tsx` | U8–U10 |
| `_components/CollaboratorManagementDialog.tsx` | **`U14`** — sửa copy `:229` (hai mặt phẳng quyền duyệt). **U11–U13 rút** (D41) — nhưng dialog **KHÔNG** phải "zero thay đổi": `U14` là một sửa **bắt buộc** |
| `types/database.ts` | Nếu regeneration bắt buộc (đổi return type hàm) |
| `__tests__/**` | §10 |

**Số migration mới giảm từ ba xuống hai** (D41). Không migration nào chạm `course_collaborators` hay
`course_collaborator_invitations`.

**Shorthand `_components/` ở bảng trên gộp HAI thư mục khác nhau** (*nit của round 4 — ghi rõ để implementor không đoán*):

* `…/courses/[topicId]/_components/` → `TopicWorkflowPanel.tsx`, `TopicAuthorshipSection.tsx`, `TopicBuilderTabs.tsx`
* `…/courses/[id]/_components/` → `TopicManagementSheet.tsx`, `types.ts`, `CollaboratorManagementDialog.tsx`

Mỗi tên file là duy nhất trong cây nên shorthand không gây hỏng; chỉ cần ghi đủ path khi implement.

### 8.2 Bị cấm / phải xoá

| Path / việc | Lý do |
| --- | --- |
| `drop function public.d1_topic_structure_permissions(uuid[])` | B4 — không để hai authority surface song song |
| `drop function public.d1_topic_group_member_for_restore(uuid)` | D36 — restore dùng `d1_can_delete_topic`; một semantic owner |
| `drop function public.d1_has_distinct_topic_reviewer(uuid, uuid, uuid)` | **F4** (review round 0) — hàm chết, nhưng vẫn là **bản sao thứ tư** của logic reviewer ngoài ba hàm canonical. Disposition ở P18 (§3.1). Dưới D41 nó **không** mâu thuẫn ngữ nghĩa (dạng role-derived của nó vốn đúng) — chỉ là chỗ để logic trôi lệch về sau |
| Sửa `course_collaborators`, `clear_topic_review_capability_on_role_downgrade`, `case` đổi role, `course_collaborator_invitations` | **CẤM** (D41). Bản round 0–3 định chạm cả bốn chỗ này; nay tất cả **giữ nguyên** (A56, A57) |
| `docs/refactors/**/plan.md` | Tầng reconcile, **chưa** được cấp |
| `docs/refactors/**/progress.md`, `problems.md` | Owner yêu cầu rõ: **chưa** update trước khi v4 review/freeze |
| `memory/**` | Cùng lý do |
| `d1_prepare_topic_content_mutation` | **Không** sửa. Là content-editing authority, không phải delete |
| `d1_lock_topic_for_mutation` | **Không** nới `TOPIC_PENDING_FROZEN`; thêm primitive riêng §5.6 |
| RLS cards/exercises/questions | Đã đúng qua `can_modify_content_by_topic` (§5.1) |
| `_components/TopicBuilderTabs.tsx`, `FlashcardTab.tsx`, `ExerciseTab.tsx` | Thuộc v3, không chồng lấn |
| `supabase/seed.sql`, `components/ui/**` | Ngoài contract v4 |
| Attribution cấp content (ai sửa card/exercise) | Không có cột nào trong repo; workstream riêng |
| Revision/candidate system | `plan.md:532` đã defer |
| CHECK constraint trên `exercises.part_type` | Owner đã chốt không thêm (việc treo #4) |

### 8.3 Skill và semantic owner

`supabase-safe-migration` (**bắt buộc** — **2** migration, drop function, RLS, RPC; **không** còn backfill dữ liệu hay
đụng trigger sau D41),
`nextjs-server-action-zod`, `frontend-design` + `frontend-workflow`, `test-quality-strategy`,
`code-commenting-and-maintainability`, `git-checkpoint-workflow`.

**Semantic owner — mỗi câu hỏi có đúng một chủ** (*sửa ở round 7 — `B-F8`: bản round 4–6 ghi luật này rồi tự vi phạm
ngay ở dòng cuối, khi gán một câu hỏi cho **một** hàm trong **ba** định nghĩa trùng. Luật nay đọc là: **một câu hỏi,
một semantics** — và khi nhiều hàm cùng hiện thực một semantics thì bảng ghi **hết** chúng, kèm lý do khác biệt.*):

| Câu hỏi | Chủ sở hữu |
| --- | --- |
| Ai được sửa content topic X | `d1_topic_group_member` (= `canEditContent`) |
| Ai được quản lý cấu trúc course | `d1_is_active_course_author` (= `canManageStructure`) |
| Ai được xoá/khôi phục topic X | `d1_can_delete_topic` |
| Ai không được duyệt topic X | `d1_is_topic_reviewer_excluded` (D20/D21 — **giữ nguyên**, Owner chốt hướng (ii)) |
| Ai có quyền duyệt | **Ba hàm canonical cùng dạng, không hàm nào là "chỗ duy nhất":** `d1_has_eligible_topic_reviewer` ([`:128`](../../../../../supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql)), `has_topic_review_access` ([`:165`](../../../../../supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql)), `d1_assert_pending_review_reviewer_safety` ([`:197`](../../../../../supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql)) — cả ba suy từ `cc.role` (owner/co_owner) **hoặc** `can_review_topics` (editor/previewer), rồi trừ exclusion (D41). `A29` cấm sửa **cả ba** |

**Dòng cuối đã đổi chủ so với bản round 0–3**, vốn ghi `course_collaborators.can_review_topics`. Dưới D41, cột đó
**một mình không trả lời được** câu hỏi — nó chỉ là một trong hai vế. Luật cũ *"Không nơi nào khác được suy các câu
trên từ role"* **bị bác bỏ** cho dòng cuối: role **là** một nguồn hợp lệ của quyền duyệt. Ba dòng đầu không đổi.

**Ba định nghĩa trùng nhau là CHỦ ĐÍCH, không phải ba authority surface cạnh tranh** (*sửa ở round 7 — `B-F8`: bản
round 4–6 chọn **một** hàm trong **ba**, tức vá triệu chứng và tự mâu thuẫn với chính luật "mỗi câu hỏi có đúng một
chủ".*). Chúng không cạnh tranh vì **cùng một công thức, cùng một nguồn dữ liệu**, chỉ khác **tham số vào** — và khác
đó là có lý do:

| Hàm | Khác biệt | Ai gọi |
| --- | --- | --- |
| `d1_has_eligible_topic_reviewer` | nhận `p_first/second_excluded_user_id` ⇒ hỏi được *"còn reviewer nào **khác** hai người này không"* | cổng gác `request_topic_review` ([`20260917100000:227`](../../../../../supabase/migrations/20260917100000_d1_senior_review_corrections.sql)) |
| `has_topic_review_access` | gắn `cc.user_id = auth.uid()` ⇒ hỏi *"**chính tôi** có quyền không"* | nhiều call site, expose cho `authenticated` |
| `d1_assert_pending_review_reviewer_safety` | đọc `p_new_role`/`p_new_can_review_topics` cho **row đang đổi** ⇒ hỏi *"**sau khi** đổi role thì còn ai duyệt được"* | guard trước `UPDATE` role |

**Hệ quả cho Implementor — đây là mục đích duy nhất của bảng này:** *"đổi quyền duyệt thì sửa ở đâu?"* ⇒ câu trả lời là
**KHÔNG SỬA Ở ĐÂU CẢ** (§5.4). D41 không đòi đổi hành vi quyền duyệt — cả ba hàm **đã đúng dạng role-derived**. Ai định
sửa "một chủ" ở đây là đang implement D23 cũ ⇒ `R16′`. Riêng câu *"sau khi đổi role thì còn ai duyệt được"* có thêm một
chỗ phải đọc: **hai lớp enforcement của D42 ở §5.5** (RPC `v_new_flag` + trigger clear-on-downgrade) — đó là nơi D42
sống, không phải ba hàm này.

---

## 9. Phases, dependency, writer boundary

| # | Phase | Scope | Acceptance |
| --- | --- | --- | --- |
| **P11** | Migration — topic authority split | `d1_topic_group_member`, `d1_can_delete_topic` (mới), `move_topic_order:329`, `d1_restore_topic:269`, drop `_for_restore`, `request_topic_review`, `d1_is_topic_reviewer_excluded`, guard creator-contributor | Creator sửa/gửi/restore được sau transfer; contributor không xoá; `editor` ngoài group reorder được nhưng không rename; mã lỗi mới |
| ~~P12~~ | **XOÁ** — con số **không được tái sử dụng**. Bản trước: *"Migration — reviewer capability: ba hàm §3.1, backfill, widen trigger, sửa `case`"*. D41 huỷ toàn bộ phase này (§5.4/§5.5 nay rỗng). Các phase sau **giữ nguyên số** để không phá cross-ref đã có trong v2/v3 | — |
| **P13** | Migration — lifecycle delete/restore | `d1_lock_topic_lifecycle`, viết lại `d1_delete_topic`, `withdraw_review_to_draft` | Xoá được ở `draft`/`pending`/`published`; guard D35 giữ; lock đúng thứ tự; contributor không xoá được |
| **P14** | Read model | `canWithdrawReview`, `canDeleteTopic`, `d1_topic_structure_capabilities`, drop hàm cũ | DTO trả đúng cho 6 actor; ba cột ở structure row |
| **P15** | UI | U1–U20 | §7.3 + §7.4 đúng cho 6 actor |
| **P16** | Test | Fixture audit + test mới | §10.1, §10.2 |
| **P17** | Verification | Test + manual QA | §10 |
| **P18** | Cleanup | Xác nhận hàm cũ đã drop, không còn hai authority surface | A41 |

**Dependency:** P11 trước P13 (delete gate dùng `original_creator`/`responsible`, và `d1_can_delete_topic` do P11 tạo).
P13 trước P14 (read model đọc `d1_can_delete_topic`). P14 trước P15. P16 sau P13. P17–P18 cuối.

**Writer boundary:** P11–P17 writer tuần tự trên candidate. Managed workflow **serialize** — Main cấp một writer tại một
thời điểm. P17–P18 chỉ đọc + chạy test.

**Không** phase nào chạy `db push` hoặc chạm remote.

---

## 10. Verification

### 10.1 Test phải thêm

| File | Nội dung |
| --- | --- |
| `topic-authorship-boundary.test.ts` | Creator sửa/gửi được sau transfer (D22/D26); **contributor hiện tại duyệt bị chặn ở vòng 2+** (D20 — **đảo** assertion `:181`); contributor đã rời nhóm vẫn bị chặn **trước** first approval (D21 regression); mã lỗi mới tại `:155`, `:216` |
| `topic-review-lifecycle.test.ts` | Contributor hiện tại không duyệt được sau first approval; **owner `can_review_topics=false` VẪN duyệt được** (D41 — **đảo** so với bản trước, vốn yêu cầu `false` ⇒ không duyệt được). Ca `:620-628` **đã** assert đúng điều này và đang xanh — **giữ nguyên, không sửa** |
| `course-authoring-role-matrix.test.ts` | `previewer → editor` giữ nguyên; `editor → previewer` clear. **Các hàng D24/D25/A52 cũ đã xoá** — không còn backfill, không còn `owner ↔ co_owner`, không còn ràng buộc nào lên cờ của owner tier (`:234` là `editor` ⇒ vẫn đúng, giữ nguyên) |
| **mới** — transition contract (D42) | **Lỗ hổng phủ test đo ở audit round 5, thu hẹp ở round 6 (`M-F8`).** `role-matrix:209-235` chạy `supabaseAdmin.from(...).update({role:"editor", can_review_topics:true})` — tức test **trigger**, **không** test đường app. **Ba guard phải tách rõ, đừng gộp:** `:576-577` target `owner` ⇒ `COLLABORATOR_MANAGEMENT_FORBIDDEN`; `:579-585` target `co_owner` + actor không phải owner ⇒ `COLLABORATOR_MANAGEMENT_FORBIDDEN`; `:586-588` `p_role` ngoài `{editor,previewer}` ⇒ `COLLABORATOR_ROLE_CHANGE_OUTSIDE_D1`. `course-creation-rls.test.ts:315-320` test **guard thứ ba** (`p_role: "owner"` ⇒ `COLLABORATOR_ROLE_CHANGE_OUTSIDE_D1`), **không** phải hai guard `COLLABORATOR_MANAGEMENT_FORBIDDEN`. **Lỗ hổng thật, hẹp hơn khai báo round 5:** (i) **thiếu** ca `co_owner → editor/previewer` qua RPC (assert cờ `false` + `has_topic_review_access` `true → false` + phải cấp lại bằng `set_course_collaborator_review_capability` mới `true` lại); (ii) **thiếu** ca target-`owner` ⇒ `COLLABORATOR_MANAGEMENT_FORBIDDEN`; (iii) **thiếu** ca `co_owner` actor hạ `co_owner` khác ⇒ `COLLABORATOR_MANAGEMENT_FORBIDDEN`; (iv) **thiếu assertion cờ** trên đường RPC `previewer → editor` — đường này **đã** chạy ở `course-collaborator-invitations.test.ts:287-297` nhưng **không** assert cờ |
| **mới** — role-native của owner tier (A55) | **Bốn** ca khẳng định `canReview` của owner/co_owner **không** phụ thuộc cờ: (1) `owner` cờ `false` vẫn duyệt được; (2) `co_owner` cờ `false` vẫn duyệt được; (3) `co_owner` cờ `true` vẫn duyệt được; (4) `editor`/`previewer` cờ `false` **không** duyệt được, bật cờ thì duyệt được. Ca (2) đã có ở `topic-review-lifecycle.test.ts:620-628`; ba ca còn lại là **thêm**. Đây là test thay thế cho "INSERT guarantee (A53)" đã xoá |
| **mới** — `withdraw_review_to_draft` | Creator/responsible huỷ được khi pending → `draft`; contributor/ngoài group bị từ chối; **creator đã bị remove khỏi course bị từ chối** (P3) |
| **mới** — `delete_topic` hợp nhất | Xoá được ở `draft`; ở `pending` → cancel + xoá, **không còn row `pending`** chặn lần gửi sau; ở `published` chưa confirm → `TOPIC_PUBLISHED_CONFIRM_REQUIRED`; `removed_at != null` → `TOPIC_NOT_FOUND`; contributor **không** xoá được; owner/co_owner ngoài group xoá được; **creator đã bị remove khỏi course bị từ chối** (P3) |
| **mới** — `delete_topic` race | Reviewer approve vs actor delete đồng thời → không deadlock, không để lại `pending` mồ côi |
| **mới** — bất biến removed/status | Sau `delete_topic` ở **cả ba** trạng thái `draft`/`pending`/`published`, row có `removed_at is not null` **và** `status = 'draft'`; `d1_restore_topic` trên row đó trả về `draft`, **không** hồi sinh `published` (A50) |
| **mới** — structure split | `editor` ngoài group: `move_topic_order` **pass**, `d1_update_topic` **fail**; `previewer` + creator: `d1_update_topic` pass, `move_topic_order` fail (D31/D32/D37) |
| `topic-workflow-panel.test.tsx` | Contributor: nút Gửi **hiện + disabled**; nút Xoá **không render**; `getNextAction` trả câu contributor-specific; owner/co_owner ngoài group khi pending **có** Duyệt/Từ chối, **không** có Quay-về-chỉnh-sửa |
| `topic-authorship-section.test.tsx` | Creator bị transfer **không** thấy câu "chưa thuộc nhóm tác giả" (U9); creator không có trong dropdown contributor (U8) |
| `TopicManagementSheet` test | Rename gate dùng `canEditContent`; move gate dùng `canManageStructure`; delete gate dùng `canDeleteTopic` (U16–U18) |
| `collaborator-management-dialog.test.tsx` | Checkbox *"Có thể duyệt bài học"* render cho `editor`/`previewer` và **KHÔNG** render cho `owner`/`co_owner` (`:315`); badge *"Duyệt theo vai trò"* render cho `owner`/`co_owner` (`:296`). **Hai mặt phẳng này hiện có ZERO test** (round 3) — đây là test **mới**, không phải sửa test cũ |
| `topic-workflow.test.ts` (schema) | Hai field mới |

### 10.2 Fixture audit — **đã đảo kết luận so với các bản v4 round 0–3**

**Dưới D41, KHÔNG fixture nào cần sửa vì quyền duyệt.** Bản trước dựng một "Lớp A" 14 file trên tiền đề *"D23 đổi ngữ
nghĩa cờ ⇒ fixture owner/co_owner cờ `false` mà kỳ vọng duyệt được sẽ sai"*. D41 đảo tiền đề đó: cờ của owner tier
**không** đổi ngữ nghĩa hành vi, chỉ trở nên inert. Mọi assertion hiện có về cờ owner/co_owner vẫn **đúng** và vẫn
**xanh** — vì chúng chưa bao giờ là thứ quyết định quyền duyệt.

**Lớp A cũ — XOÁ.** Ghi lại vì sao, để không ai dựng lại:

* Tiền đề *"quyền duyệt đến từ cờ chứ không từ role"* là D23 cũ, đã rút lại (D41).
* "Recipe INSERT-rồi-UPDATE để dựng owner-tier cờ TẮT" (B-F3, round 2) **không còn đối tượng** — không cần dựng trạng thái
  đó, vì cờ không mang nghĩa gì với owner tier. Không còn "no-op im lặng" nào để tránh.
* "INSERT guarantee (A53)" và "hàm #3 hai arm (A54)" **xoá** cùng lý do.

**Lớp A′ — điều thay thế, và nó là lớp phải GIỮ XANH.** Fixture khẳng định owner/co_owner duyệt được **bất kể cờ**:

| File:dòng | Assertion | Vì sao phải giữ nguyên |
| --- | --- | --- |
| `topic-review-lifecycle.test.ts:620-628` | `co_owner` cờ `false` ⇒ `has_topic_review_access` = `true` | Pin trực tiếp D41 |
| `topic-review-lifecycle.test.ts:243-249` | `previewer` cờ `true` ⇒ `canReview: true` | Mặt phẳng editor/previewer |
| `topic-authorship-boundary.test.ts:151` | `co_owner` cờ `false` ⇒ `canReview: true` | Pin D41 qua DTO |
| `topic-authorship-boundary.test.ts:441-446` | Xoá `co_owner` cờ `false` ⇒ `COLLABORATOR_LAST_REVIEWER_REQUIRED` | Arm 2 của hàm #3 tính co_owner là reviewer bất kể cờ |
| `topic-review-notes.test.ts:281-307` | `editor` cờ `false` bị chặn; `editor` cờ `true` viết được | Mặt phẳng editor |

**Fixture chỉ *đặt* cờ owner/co_owner mà không *assert*** — không cần chạm:
`topic-authorship-boundary.test.ts:61,63`; `topic-group-content-boundary.test.ts:69,71`;
`topic-authorship-foundation.test.ts:70`; `course-collaborator-invitations.test.ts:77`; `topic-review-lifecycle.test.ts:80`;
các mock component `collaborator-management-dialog.test.tsx:46,49`, `topic-authorship-section.test.tsx:164,167,194`,
`course-collaboration-leave-dialog.test.tsx:53`.

**Fixture assert cờ trên `editor`/`previewer`** — cờ vẫn có nghĩa với họ, **giữ nguyên**:
`course-authoring-role-matrix.test.ts:234`; `topic-review-lifecycle.test.ts:637-640`, `:657`;
`topic-authorship-boundary.test.ts:296-297`, `:326-327`; `course-collaborator-invitations.test.ts:137-138`, `:311-312`.
Dòng `:234` từng được gọi là "điểm neo … nếu đổi, trigger §5.5 sai" — **trigger §5.5 nay không còn**, nhưng `:234` vẫn
đúng vì nó là `editor`, và cột cờ vẫn có nghĩa với `editor`.

**Lớp B — thêm field **bắt buộc** vào DTO `topicWorkflow`. ĐÂY LÀ LỚP DUY NHẤT CÒN LẠI.**
(*Sửa cơ chế ở round 5 — nit của round 4: bản trước gọi lớp này là "`z.strictObject` vỡ", **sai cơ chế**.*)

Cơ chế thật: §5.10 thêm **hai** field **bắt buộc** (`canWithdrawReview`, `canDeleteTopic`) vào `topicWorkflowSchema`
([`lib/schemas/topic-workflow.ts:39`](../../../../../lib/schemas/topic-workflow.ts)), parse ở
[`app/actions/topic.ts:348`](../../../../../app/actions/topic.ts). Fixture dựng một DTO **thiếu** field sẽ **fail parse**
vì field bắt buộc — **bất kể** `strictObject`. `strictObject` chi phối chiều **ngược lại**: nó từ chối **key thừa**
không khai trong schema. Nên "vỡ vì `strictObject`" mô tả sai chiều.

Kết quả hành động **không đổi**: fixture dựng một `topicWorkflow` DTO thiếu field sẽ vỡ, và Lớp này **độc lập hoàn
toàn** với D41 — nó đến từ §5.10.

**Lớp B có HAI nhánh vỡ khác nhau — phải sửa theo đúng thứ tự này** (*bổ sung round 6 — `M-F9`; bản round 5 chỉ nêu
nhánh 2*):

| Nhánh | Cơ chế | Ca điển hình | Sửa thế nào |
| --- | --- | --- | --- |
| **B1 — lỗi type** (sửa **trước**) | Fixture dựng object literal **thiếu** hai field rồi truyền thẳng vào prop `workflow: TopicWorkflow`. `tsconfig.json` include `**/*.ts` + `**/*.tsx` ⇒ `npx tsc --noEmit` **đỏ** | [`__tests__/components/topic-workflow-panel.test.tsx:22`](../../../../../__tests__/components/topic-workflow-panel.test.tsx) — `baseWorkflow` thiếu `canWithdrawReview`/`canDeleteTopic`, truyền vào `:90`, `:100`, `:126`, `:140`, `:153`, `:159`, `:165`, `:178`, `:197`. File này có **0** `toEqual` ⇒ vỡ **thuần vì type** | Thêm hai field vào `baseWorkflow`. **Không** đọc `toEqual` — file không có |
| **B2 — fail parse** (sửa **sau**) | Fixture dựng DTO **đầy đủ** rồi assert bằng `toEqual`; field bắt buộc mới làm `toEqual` đỏ | [`actions/course-structure.test.ts`](../../../../../__tests__/actions/course-structure.test.ts) (**:56 có** `canReview: true` — xem cảnh báo dưới), `schemas/topic-workflow.test.ts` | Đọc **từng** `toEqual` rồi mới thêm field — đừng grep cờ |

**⚠️ Cảnh báo phương pháp (sửa ở round 6 — `M-F9`).** Bản round 5 viết *"`actions/course-structure.test.ts` **không**
chứa cờ `canReview` nào"* — **SAI**: `:56` có `canReview: true`. Điểm mà câu đó **muốn** nói vẫn đúng (file vỡ vì field
bắt buộc thiếu, không vì cờ), nhưng **phát biểu thì sai** — và chính phát biểu đó là thứ người đọc dùng để kiểm phương
pháp. Vì vậy: **grep cờ KHÔNG đủ để quyết định**, ở cả hai chiều.

**Danh sách file Lớp B — nêu theo nhánh, không gộp** (*sửa round 6 — `N-F6`: bản round 5 gộp 8 file dưới một mô tả
"DTO `topicWorkflow` + `toEqual`", mà mô tả đó **không** tái lập được*):

* **B1 (lỗi type):** `__tests__/components/topic-workflow-panel.test.tsx`, `__tests__/components/topic-authorship-section.test.tsx`.
  File thứ hai (*chuyển từ nhóm "audit riêng" ở round 7 — `M-F11`*): **0** lần `supabase`/`createClient`, chạy
  `// @vitest-environment jsdom`, dựng `const baseWorkflow = {…}` tại `:38` và truyền vào prop `workflow: TopicWorkflow`
  ở **6** chỗ (`:103`, `:123`, `:138`, `:143`, `:172`, `:202`); **0** lần `canWithdrawReview`/`canDeleteTopic`. Prop khai
  ở `TopicAuthorshipSection.tsx:41` là `workflow: TopicWorkflow`; `tsconfig.json` include `**/*.ts` + `**/*.tsx` ⇒ vỡ
  **type**, không phải parse. Sửa: thêm hai field vào `baseWorkflow` — và vào **bốn** chỗ spread `...baseWorkflow` ở
  các dòng trên, **không** phải fixture inline (file có **0** object literal; *sửa ở round 8 — `N-F15`*).
* **B2 (fail parse + `toEqual`):** `__tests__/actions/course-structure.test.ts`, `__tests__/schemas/topic-workflow.test.ts`.
* **Cần audit riêng, chưa phân nhánh được từ source tĩnh:** `topic-authorship-boundary.test.ts`,
  `topic-review-lifecycle.test.ts` — các file này dựng DTO từ **fixture DB** (integration) nên nhánh vỡ phụ thuộc giá trị
  trả về thật, không suy được từ đọc source. Đọc từng chỗ trước khi sửa.
* **ĐÃ XOÁ khỏi danh sách:** `topic-review-notes.test.tsx` — có **0** lần xuất hiện `topicWorkflow` và **0** `toEqual`;
  nó chỉ render `<TopicReviewNotes />` (không nhận prop workflow). Không có cơ sở để nằm trong danh sách.

**Lệnh đếm để tái lập** (`N-F6`) — phải lọc thêm `canReview`, vì `topicWorkflow` một mình còn bắt cả file chỉ **đọc
source text** (`course-workspace-routes.test.tsx:1400` dùng `readFileSync` rồi `toContain`, **không** dựng DTO):

```bash
grep -rln 'topicWorkflow' __tests__ | xargs grep -ln 'toEqual' | xargs grep -ln 'canReview'
# ⇒ __tests__/actions/course-structure.test.ts
#    __tests__/schemas/topic-workflow.test.ts          (đúng 2 file)
```

Đây là cơ sở cho nhánh **B2**, **không** phải "8 file".

**Con số grep cũ `14 file` / `16 file` không còn dùng để quyết định việc gì** — chúng đếm fixture có chuỗi `false`, mà
chuỗi đó nay không tương quan với vỡ. Giữ lại chỉ như dấu vết lịch sử của các round trước.

**Bổ sung cho D31 — đây là lớp độc lập thứ hai còn thật sự có việc.** Phải audit consumer của `can_edit`
(`TopicManagementSheet.tsx`, `types.ts`, `app/actions/topic.ts`) — chọn đường sửa cho **từng** chỗ trước khi động vào,
không để test đỏ rồi sửa cho xanh (giả định A3).

### 10.3 Deterministic (phải chạy lại)

| Check | Trạng thái |
| --- | --- |
| `npm.cmd run test:run` | **Chưa chạy cho v4.** Con số `1 failed \| 524 passed` mà bản nháp trước trích là **stale** (review round 0): nó đo trên **working tree bẩn**, không phải `HEAD`, và `HEAD` `30e517f` đã sửa chính dòng `course-workspace-routes.test.tsx:1523` đó. Phải chạy lại từ trạng thái sạch trước khi dùng làm baseline |
| `npx tsc --noEmit` | Chưa chạy |
| Integration suite (`ALLOW_DB_INTEGRATION_TESTS=true`) | **Chưa chạy** — cần local Supabase |

### 10.4 Manual QA — bổ sung vào state matrix v2 §11.3.3

Fixture readiness của v2 là **`NOT READY`** (v2 §11.3.1) — điều kiện chặn browser QA **không đổi**, bản này **không** tự nới.

| # | Actor | Việc làm | Kỳ vọng |
| --- | --- | --- | --- |
| M17 | creator (khác responsible sau transfer) | Sửa một flashcard | Lưu được; **không** hiện câu "chưa thuộc nhóm tác giả" |
| M18 | contributor | Mở topic `draft` | Nút Gửi duyệt **hiện, disabled**, kèm lý do "Chỉ người tạo hoặc người phụ trách..." |
| M19 | contributor | Tìm affordance xoá | **Không có** nút/không có mục nào |
| M20 | responsible | Gửi duyệt → "Quay về chỉnh sửa" | Topic về `draft`; nhóm sửa được ngay; lịch sử từ chối **không** tăng |
| M21 | responsible | Gửi duyệt → "Hủy gửi duyệt và xóa bài học" | Topic `removed_at` set; **không** còn submission `pending` |
| M22 | owner ngoài group, cờ bất kỳ | Topic người khác đang `pending` | **Có** Duyệt/Từ chối; **không** có Quay-về-chỉnh-sửa; **có** Xoá, nhãn *"Xóa bài học"*. **Cờ không ảnh hưởng kết quả (D41)** — chạy lại với cờ `false` phải ra **đúng** kết quả này |
| ~~M23~~ | **XOÁ** (D41). Trước: *"owner tắt `can_review_topics` của chính mình ⇒ không còn Duyệt/Từ chối"*. Không còn đối tượng — owner tier **không có** toggle cờ (UI `:315` chỉ render cho editor/previewer; RPC capability raise `COLLABORATOR_CAPABILITY_ROLE_INVALID`), và cờ không chi phối quyền duyệt của họ |
| M24 | creator bị hạ role xuống `previewer` | Sửa content + thử reorder | Sửa **được**; reorder **không** được (D31) |
| ~~M25~~ | **XOÁ** (D41). Trước: *"Mời `co_owner` mới ⇒ row materialize với `can_review_topics = true`"*. Không còn yêu cầu "materialize `true`" — cờ của co_owner là `false` và **inert**. Thay bằng **M28** |
| M26 | `editor` ngoài group | Thử rename topic người khác, rồi reorder | Rename **không** được (D32); reorder **được** (D37) |
| M27 | creator bị hạ xuống `previewer` | Xoá topic `pending` mình tạo | Xoá được; không còn `pending` mồ côi (D33) |
| M28 | owner | Mời `co_owner` mới, rồi người đó mở topic đang `pending` | Row materialize với `can_review_topics = **false**` (đúng theo CHECK + coercion invitation); **nhưng** vẫn **có** Duyệt/Từ chối, vì quyền đến từ role (D41). Đây là ca chứng minh *"cờ `false` không làm mất quyền duyệt của owner tier"* |

### 10.5 Ranh giới bằng chứng

Được phép khẳng định: hành vi RPC/RLS qua integration test trên local Supabase; hành vi component qua RTL; kết quả test đã chạy.

**Không** được khẳng định: ma trận §7.3/§7.4 đã kiểm trên browser thật cho tới khi fixture v2 §11.3.2 đủ **năm** actor;
E2E smoke phủ flow này; `PASS` của reviewer là Owner approval.

---

## 11. Acceptance criteria (nối tiếp A1–A13 của v2 và A14–A22 của v3)

| # | Tiêu chí |
| --- | --- |
| A23 | Thành viên nhóm **hiện tại** không duyệt/từ chối được topic của mình ở **mọi** vòng, kể cả sau first approval (D20) |
| A24 | Người **đã rời** nhóm vẫn bị loại trừ **trước** first approval (D21 regression — không bị D20 nuốt) |
| A25 | Creator sửa được content, gửi được, xoá được, **và restore được** topic của mình sau khi đã chuyển trách nhiệm (D22, D26, D36) |
| A26 | Creator bị hạ role xuống `previewer` **vẫn** sửa/gửi/xoá/restore được topic mình tạo, nhưng **không** tạo topic mới và **không** reorder (D26, D31) |
| A27 | `canReview = role ∈ {owner, co_owner} OR can_review_topics = true`, rồi **vẫn** áp reviewer exclusion (D41). Owner/co_owner cờ `false` **vẫn** duyệt được; `editor`/`previewer` cờ `false` **không** duyệt được |
| A28 | `can_review_topics` **không** được đọc ở bất kỳ điểm phán quyết nào cho `owner`/`co_owner` — giá trị cột là inert với họ (D41) |
| A29 | Ba hàm reviewer (`d1_has_eligible_topic_reviewer`, `has_topic_review_access`, `d1_assert_pending_review_reviewer_safety`) **không đổi dòng nào** — nhánh `cc.role in ('owner','co_owner')` **giữ nguyên** ở cả ba, kể cả **cả hai** arm của hàm #3 (§3.1, §5.4; đảo ngược A29 cũ) |
| A30 | Contributor **không** xoá được topic dù là thành viên nhóm tác giả (D27) |
| A31 | Editor/previewer xoá được topic **mình tạo** — với tư cách `original_creator` (D27) |
| A32 | Creator/responsible huỷ được yêu cầu duyệt khi `pending` qua `withdraw_review_to_draft` (D34); contributor và ngoài group bị từ chối |
| A33 | `canWithdrawReview` và `canDeleteTopic` là field riêng; **không** suy từ `canRequestReview` (D30) |
| A34 | Contributor **thấy** nút Gửi duyệt disabled kèm lý do, và **không thấy** affordance xoá (D28) |
| A35 | owner/co_owner ngoài group khi `pending` có approve/reject; **ẩn** edit/submit/withdraw (D28 + D41). Kết quả **không phụ thuộc** `can_review_topics` |
| A36 | Creator bị transfer **không** còn thấy câu "chưa thuộc nhóm tác giả" (U9) |
| A37 | Creator **không** thêm được làm contributor (U20) ⇒ không chiếm slot, không render trùng |
| A38 | Mã lỗi `TOPIC_RESPONSIBLE_AUTHOR_REQUIRED` **không** còn ở **live raise site** và **không** còn trong app code (`app/actions/**`). Chuỗi này **vẫn tồn tại** trong migration lịch sử (`20260916130000:766`, `20260917100000:216`) — đó là text đã bị thay thế, **không** phải hành vi sống. Tiêu chí chỉ áp cho nơi còn hiệu lực (§5.13) |
| A39 | Huỷ-rồi-xoá **không** để lại row submission `pending` nào chặn lần gửi duyệt sau (§5.7) |
| A40 | Mọi RPC lifecycle lấy advisory lock **đúng thứ tự** course → topic như approve/reject (§5.6) |
| A41 | **Chỉ tồn tại một authority surface cho mỗi câu hỏi** ở §8.3: `d1_topic_structure_permissions`, `d1_topic_group_member_for_restore` **và** `d1_has_distinct_topic_reviewer` **không** còn trong schema (D31/D36, B4, F4) |
| A42 | Chỉ **một** RPC xoá topic. `delete_topic` phục vụ `draft`, `pending`, `published`; không có RPC xoá thứ hai (D33) |
| A43 | `delete_topic` giữ `TOPIC_NOT_FOUND` khi `removed_at != null`, và `TOPIC_PUBLISHED_CONFIRM_REQUIRED` khi `published` chưa confirm (D35) |
| A44 | `editor` ngoài group **reorder được** nhưng **rename topic người khác không được** (D32, D37) |
| A45 | `previewer` + creator **sửa content được** nhưng **không reorder được** (D31, D37). Không kiểm `previewer + contributor` — bất khả theo §3.13 |
| A46 | `cancellation_reason` của delete là string trung tính, **không** chứa "Tác giả"; reason của withdraw **giữ** "Tác giả" (D38, D29) |
| A47 | `Topic.canEdit` **không** còn tồn tại như một boolean gánh ba nghĩa; Course Structure row trả đủ `canEditContent`, `canManageStructure`, `canDeleteTopic` (D31) |
| A48 | Chỉ **hai** helper có client gọi trực tiếp — `d1_topic_group_member` và `d1_topic_structure_capabilities` — là grant cho `authenticated`. `d1_is_active_course_author`, `d1_can_delete_topic` **và `d1_lock_topic_lifecycle`** vẫn `revoke … from authenticated` (D39, §5.6) |
| A49 | `d1_is_active_course_author` **không** được dùng ở bất kỳ đâu làm generic active-collaboration check; chỉ dùng cho `canManageStructure` (D40) |
| A50 | Bất biến `removed_at is not null ⇒ status = 'draft'` giữ nguyên sau P11–P13: mọi writer của `topics.removed_at` set `status` trong **cùng** statement (§3.11) |
| A51 | `delete_topic` trên topic `pending` **không** raise `TOPIC_PENDING_FROZEN`: bước cancel set GUC `voca.d1_trusted_topic_lifecycle='on'` transaction-local **trước** câu `update` cuối (§5.7, R28) |
| ~~A52~~ | **XOÁ** (D41). Trước: *"`owner ↔ co_owner` giữ nguyên cờ; lên tier owner ép `true`; hạ xuống editor/previewer clear"*. Không còn đối tượng — không có cơ chế nào trong v4 đọc/ghi cờ của owner tier. Ngoài ra transition `owner ↔ co_owner` **bất khả qua app** (§3.14), nên ngay cả một tiêu chí mô tả nó cũng thuộc đúng lớp lỗi B-F4 |
| ~~A53~~ | **XOÁ** (D41). Trước: *"cả ba đường INSERT cho ra `can_review_topics = true` khi role ∈ {owner,co_owner}"*. Không còn "materialization guarantee" (§5.5 rỗng). Thay bằng **A55** |
| ~~A54~~ | **XOÁ** (D41). Trước: *"hàm #3 không còn tham chiếu `p_new_role`/`cc.role`"*. Nay ba hàm reviewer **giữ nguyên** ⇒ tiêu chí đảo thành A29 mới |
| A55 | **Bốn** ca chứng minh `canReview` của owner tier độc lập với cờ: (1) `owner` cờ `false` duyệt được; (2) `co_owner` cờ `false` duyệt được; (3) `co_owner` cờ `true` duyệt được; (4) `editor`/`previewer` cờ `false` **không** duyệt được, bật cờ thì duyệt được. Ca (2) đã xanh ở `topic-review-lifecycle.test.ts:620-628`; ba ca còn lại là **thêm** (§10.1) |
| A56 | `set_course_collaborator_review_capability` **giữ nguyên** guard `COLLABORATOR_CAPABILITY_ROLE_INVALID`: gọi trên row `owner`/`co_owner` **phải** raise. CHECK + coercion của invitation cũng **giữ nguyên** (§3.3, D41) |
| A57 | Cột `can_review_topics` **vẫn tồn tại** trên `course_collaborators` — v4 **không** xoá cột và **không** thêm CHECK ràng buộc cờ với role (Q7, quyết định có chủ đích). Field `canReviewTopics` trong DTO là **giá trị thô của cột**, **không** phải `canReview` — consumer phải dùng `canReview` cho mọi phán quyết |
| A58 | **Transition contract (D42) — ba chiều hạ tier đều tước grant, kiểm bằng hành vi:** (1) `co_owner → previewer/editor` ⇒ cờ `false` **và** `has_topic_review_access` chuyển `true → false`; (2) `editor(cờ=true) → previewer` ⇒ `false` (đã có ở `topic-review-lifecycle.test.ts:652-657`); (3) remove/leave khỏi course ⇒ row **bị xoá cứng**, `has_topic_review_access` = `false` (đã có ở `:662-668`). Sau (1), muốn duyệt lại **phải** gọi `set_course_collaborator_review_capability` — cờ cũ **không** tự trở lại |
| A59 | **`previewer(cờ=true) → editor` giữ cờ** — chủ ý của D42, không phải bỏ sót. Chiều ngược lại (`editor → previewer`) **xoá**. Không thêm cơ chế nào để "cân đối" hai chiều |
| A60 | **Không có vòng promote→downgrade nào chạm owner tier qua app:** `owner` là target ⇒ `COLLABORATOR_MANAGEMENT_FORBIDDEN`; `p_role ∈ {editor,previewer}` ⇒ không nâng ai vào owner tier; invitation `owner` ⇒ `INVITATION_OWNER_ROLE_FORBIDDEN`. Đây là **defense-in-depth** trên đường app — **không** phải nguồn sức mạnh của bất biến "cờ cũ không resurrect": bất biến đó đứng bằng **cơ chế** ở **§5.5** (RPC `v_new_flag` + trigger clear-on-downgrade, phủ vét cạn bốn giá trị enum), với **§3.14 vế 4** là lớp thu hẹp thêm |

---

## 12. Rủi ro

| # | Rủi ro | Tác động | Giảm thiểu | Lộ sớm nhất |
| --- | --- | --- | --- | --- |
| ~~R13~~ | **XOÁ** (D41). Trước: *"bỏ role-derived mà quên backfill ⇒ owner/co_owner mất quyền duyệt"*. Không còn "bỏ role-derived" lẫn backfill |
| ~~R14~~ | **XOÁ** (D41). Trước: *"trigger default ép `true` cả trên UPDATE ⇒ không thu hồi được"*. Không còn trigger nào bị sửa |
| ~~R14b~~ | **XOÁ** (D41). Trước: *"hai nguồn clear cờ khi `owner ↔ co_owner`"*. Cả hai nguồn **giữ nguyên** và cờ owner-tier là inert |
| ~~R14c~~ | **XOÁ** (D41). Trước: *"thêm trigger `before update` thứ hai ⇒ thứ tự alphabet"*. Không thêm trigger nào |
| ~~R14d~~ | **XOÁ** (D41). Trước: *"đăng ký trigger chỉ `update` ⇒ mất phủ INSERT"*. Không cần phủ INSERT — đó là B1, nay không còn đối tượng |
| ~~R15~~ | **XOÁ** (D41). Trước: *"D23 phá fixture ngầm"*. §10.2 đã đảo: không fixture nào vỡ vì quyền duyệt. Rủi ro "sửa cho xanh" nay thuộc **Lớp B** (field DTO bắt buộc) — giữ dưới dạng **R15′** |
| R15′ | Thêm field **bắt buộc** vào DTO ⇒ implementor "sửa cho xanh" bằng cách thêm hai field vào fixture mà **không** đọc assertion | Test xanh nhưng không còn kiểm điều nó tuyên bố | §10.2 Lớp B nêu theo **hai nhánh** (B1 type error / B2 parse fail) — đọc từng `toEqual` **và** từng prop `workflow: TopicWorkflow` trước khi sửa | P16 |
| ~~R16~~ | **XOÁ** (D41). Trước: *"sửa 1–2 trong 3 hàm §3.1 ⇒ bất nhất"*. Không hàm nào bị sửa | — |
| R16′ | Ai đó "sửa cho khớp D23 cũ" và **bỏ** nhánh role-derived khỏi một trong ba hàm | Regression trực tiếp lên D41; `topic-review-lifecycle.test.ts:620-628` đỏ | §5.4 ghi rõ **KHÔNG SỬA** + A29. **Thu hẹp ở round 7 (`B-F9`):** chỉ áp cho việc **BỎ** nhánh role-derived — **không** áp cho việc thêm vế, và D42 **không** đòi thêm vế nào ở ba hàm này | P11 |
| R17 | RPC lifecycle sai thứ tự lock | Deadlock, hoặc khe hở khi reviewer hành động đồng thời | §5.6 + test race + A40 | P13 |
| R18 | Xoá `pending` mà không huỷ submission trước | Partial unique index chặn **mọi** lần gửi duyệt sau | §5.7 + A39 | P13 |
| R19 | `d1_prepare_topic_content_mutation` là helper dùng chung 15 RPC | Đổi gate của nó nới/chặn quyền cho **mọi** content mutation | §8.2 — **không** sửa nó; delete có authority riêng | P13 |
| R19b | Bỏ prepare khỏi delete ⇒ mất guard lifecycle nó từng gánh | Xoá được topic published không confirm; `TOPIC_NOT_FOUND` biến mất | §5.7 khôi phục tường minh (D35) + A43 | P13 |
| R19c | Nới `TOPIC_PENDING_FROZEN` trong `d1_lock_topic_for_mutation` để "cho tiện" | Mở đường sửa content khi pending cho **mọi** mutation | §8.2 cấm rõ; thêm primitive riêng | P13 |
| R19d | `d1_can_delete_topic` bỏ sót `profiles.removed_at` | Người đã bị xoá profile vẫn xoá được topic | §5.2 giữ cả `p.removed_at is null`; test P3 | P11 |
| R20 | Fixture v2 `NOT READY` ⇒ A23–A47 chỉ có bằng chứng integration/RTL | Không chứng minh được hành vi thật | Ghi thẳng §10.5; **không** nới fixture readiness | P17 |
| R21 | D26 nới quyền topic cho người bị hạ role | Người mất quyền soạn ở cấp course vẫn sửa topic cũ | **Có chủ đích** (D26). Cần M24 xác nhận không gây bất ngờ vận hành | P17 |
| R22 | Đổi `move_topic_order` sang course-level | `editor` **nội bộ** group cũng reorder được — nhưng đó là D37, không phải lỗi | Xác nhận bằng A44 | P16 |
| R23 | Gỡ `canEdit` khỏi `Topic` type làm sót consumer | Nút hiện sai trạng thái cho một actor | §10.2 audit A3 + test `TopicManagementSheet` | P16 |
| R24 | Drop function rồi mới grant ⇒ **anon** gọi được | Rò rỉ capability ra `anon` nếu chạy ngoài transaction | Migration chạy trong một transaction; vẫn revoke+grant tường minh cùng lượt (B4) | P14 |
| R25 | Grant `d1_can_delete_topic` cho `authenticated` "cho chắc" | Client gọi thẳng được predicate delete, bỏ qua `delete_topic` ⇒ mất cancel-pending, mất guard D35 | D39 — giữ private; A48 | P13 |
| R26 | Dùng `d1_is_active_course_author` cho `canEditContent`/`canDeleteTopic` | `previewer` + creator **mất** quyền sửa/xoá topic mình tạo ⇒ regression trực tiếp lên D26 | D40 + §3.8 ghi rõ nó loại `previewer`; A49 | P11 |
| R27 | §3.13 bị bỏ qua ⇒ viết test cho `previewer + contributor` | Test đỏ vĩnh viễn cho trạng thái bất khả; dễ bị "sửa" bằng cách nới `add_topic_contributor` ngoài contract | §3.13 + A45 ghi rõ | P16 |
| R28 | Bỏ bước cancel khỏi nhánh `pending` của `delete_topic` (coi là thừa) | Câu `update` cuối đi qua `d1_guard_topic_lifecycle_mutation` **không** có GUC ⇒ `TOPIC_PENDING_FROZEN`, delete luôn hỏng trên topic `pending` | §5.7 ghi rõ phụ thuộc GUC; §3.7 mô tả trigger | P13 |
| ~~R29~~ | **XOÁ** (D41). Trước: *"thêm trigger `before update` mới mà không thay body trigger cũ"*. Không thêm trigger nào |
| ~~R30~~ | **XOÁ** (D41). Trước: *"đổi trigger sang `INSERT OR UPDATE OF …` mà quên nhánh `old.role = new.role`"*. Không đổi trigger |
| ~~R31~~ | **XOÁ** (D41). Trước: *"sửa hàm #3 chỉ ở arm 2 mà bỏ arm 1"*. Không sửa arm nào |
| R32 | Xoá trigger `clear_topic_review_capability_on_role_downgrade` vì tin *"cờ owner-tier là inert ⇒ trigger là dead code"* — **đúng lớp lý do sai đã bị `M-F6` bắt ở round 4 và sửa ở §5.5** | `co_owner → editor` mang theo cờ `true` ⇒ người bị hạ tier **vẫn** duyệt được qua cờ; đỏ `course-authoring-role-matrix.test.ts:224-235` + `topic-review-lifecycle.test.ts:652-657`; phá D42 | §5.5 ghi rõ **vì sao "inert" ≠ "xoá được"**; §8.2 cấm; A58 (1) kiểm bằng hành vi | P16 |
| R33 | "Chuẩn hoá" `v_new_flag` bằng cách bỏ nhánh `previewer → editor` cho hai chiều đối xứng | Đổi hành vi đang chạy mà không có yêu cầu contract nào — D42 **chốt giữ** (A59) | A59 ghi rõ là **chủ ý**; §5.5 liệt kê `case` vào danh sách "Không đụng" | P16 |

---

## 13. Mismatch routing, rollback, stop

**Mismatch routing:**
* Implementor thấy repo khác contract v4 ⇒ `PLAN_CONTRACT_MISMATCH`, dừng mutation phụ thuộc, giữ nguyên partial state, trả
  bằng chứng nhỏ nhất. Main resume **đúng Planner gốc**.
* Conflict chạm contract v2 (upstream) ⇒ `MASTER_PLAN_CONTRACT_MISMATCH`, dừng việc tầng dưới, route read-only Master Plan
  Correction nếu upstream đã đóng, rồi `OWNER_DECISION_REQUIRED`.
* Conflict chạm v3 (`review_notes`) ⇒ hai bản độc lập; dừng v4, **không** sửa v3.
* Reviewer thấy candidate đổi byte ⇒ `BLOCKED(candidate_moved)`. Ghi ngoài artifact path ⇒
  `BLOCKED(reviewer_scope_violation)`. Artifact bị tracked/staged ⇒ `BLOCKED(review_artifact_git_scope_violation)`.

**Rollback:** P11–P15 land migration mới + sửa app. **Không còn "migration nghịch cho backfill"** — D41 bỏ backfill (§5.5
rỗng). Rollback = revert commit **+** khôi phục **ba** hàm đã drop
(`d1_topic_structure_permissions`, `d1_topic_group_member_for_restore`, `d1_has_distinct_topic_reviewer`) từ định nghĩa
tại `20260917100000:257`, `20260916140000:57` và `20260915130000:22`. Không có `drop table`, không mất dữ liệu. Remote
chưa từng bị chạm.

**Stop conditions:** dừng và báo Owner khi cần quyết định về (a) creator có nhận lại được trách nhiệm qua transfer (§5.14);
(b) pool reviewer rỗng ở một course thật (A2 sai — nay khó xảy ra, xem A2); (c) **đã gỡ** — trước là "ngưỡng backfill";
D41 bỏ backfill nên không còn ngưỡng nào để chốt;
(d) correction budget cạn — **điều kiện này ĐÃ xảy ra ở round 2** (3 blocking: B-F1, B-F2, B-F3). Owner đã quyết định
bằng cách cấp thêm **round 3** ngoài budget (§0), rồi **round 4** sau khi chốt lại D23, rồi **round 5** sau khi bổ sung
D42, rồi **round 6** sau khi sửa 12 finding của round 5 + sweep chéo, rồi **round 7** sau khi sửa 11 finding của
round 6 + sweep ngữ nghĩa, rồi **round 8** sau khi sửa 8 finding của round 7. Nếu **round 8** vẫn còn blocking ⇒
`OWNER_DECISION_REQUIRED`, **không** tự mở round 9 và
**không** tự hạ severity để thoát.

**Yêu cầu bắt buộc của Owner cho round 6 (verbatim, lượt 2026-09-19 (d)):** *"sửa 12 finding + chạy một sweep chéo
toàn candidate theo từng invariant đã đổi, đặc biệt: mọi consumer ở §14 / mọi scope row §8.1 / mọi summary/câu kết ở
§5.x / mọi acceptance/risk/test row liên quan / grep toàn doc các phrase/model cũ đã supersede. Sau sweep mới dispatch
round 6."*

**Kết quả sweep round 6 — ghi trung thực, kể cả phần thất bại** (*chuyển từ `§11` sang đây ở round 7 — `N-F12`:
`§11` là acceptance criteria **hành vi sản phẩm**, không phải chỗ ghi quy trình. Bản round 6 đặt nó ở `§11` và kết bằng
claim *"Kết quả: `0` chỗ còn sót sau sửa"* — **claim đó SAI**, round 6 tìm được **ba** chỗ sót.*):

| Trục | Kết quả round 6 |
| --- | --- |
| (1) Mọi consumer `§14` | **SẠCH** |
| (2) Mọi scope row `§8.1` | **SẠCH** |
| (3) Mọi câu kết `§5.x` | **SÓT** — `§5.4` (*"Cấm sửa"*) ⇒ `B-F9` |
| (4) Acceptance/risk/test row | **SÓT** — `R15′` còn `8 file` ⇒ `M-F10` |
| (5) Grep phrase cũ đã supersede | **SẠCH ở tầng chuỗi** — nhưng **không** bắt được `§8.3` ⇒ `B-F8` |

**Bài học đo được, giữ lại để round sau không lặp:** sweep phủ **bốn trong năm** trục, và **grep theo chuỗi là không
đủ** — `§8.3` là lỗi **ngữ nghĩa** (gán sai chủ sở hữu), không chứa từ khoá nào bị supersede nên không lệnh `grep` nào
bắt được. Round 7 thêm **trục thứ sáu, theo ngữ nghĩa**: *"câu nào trong candidate đang phát biểu một **quy tắc**, một
**chủ thể**, hoặc một **mệnh lệnh** mà D41/D42 đã thay đổi?"* Đây là lớp lỗi đã xuất hiện **bốn lần liên tiếp**
(`M-F4` r3 → `B-F5` r4 → `B-F6`/`B-F7` r5 → `B-F8`/`B-F9` r6).

Sweep đã chạy và ghi kết quả ở bảng trên; reviewer round 5 là bên đề xuất sweep này (*"đây là lần thứ ba liên
tiếp blocker thuộc lớp 'câu stale ở biên đối diện của một sửa'"*) — nên round 6 phải kiểm **cả** rằng sweep không tự
sinh câu stale mới.

**Progress ownership:** `docs/refactors/student-user-flow-route/progress.md` — **chưa** được ghi cho tới khi v4
review/freeze. Sau `PASS` được admit: commit implementation trước, rồi commit **progress-only** ghi hash implementation.
Tracker **không** ghi hash của chính commit chứa nó và **không** ghi trạng thái tạm.

---

## 14. Handoff cho implementation (sau khi Owner approve)

Một Implementor mới, **không** kế thừa lịch sử phiên, nhận: contract v4 này + v2 (nền) + v3 (song song, không chồng lấn)
+ authority snapshot §0 + **Appendix A** (prompt gốc của Owner).

**Không** được tự suy diễn:
* Ai trong nhóm bị loại trừ — D20 (membership hiện tại, vô điều kiện) + D21 (giữ nhánh lịch sử).
* Ai gửi được — D22: **creator + responsible**.
* Quyền duyệt đến từ đâu — **D23 (đảo) + D41**: `role ∈ {owner,co_owner} OR can_review_topics`, rồi áp exclusion.
  `can_review_topics` **chỉ** có nghĩa với `editor`/`previewer`. **Không** được suy theo D23 cũ.
* Transition của quyền duyệt — **D42**: hạ khỏi owner tier ⇒ **tước** grant; `editor(cờ=true) → previewer` ⇒ tước;
  rời course ⇒ mất toàn bộ; nâng lên owner tier ⇒ **tự có từ role**, **không** set cờ; **không** để cờ cũ resurrect.
  Chốt kèm: `previewer(cờ=true) → editor` **giữ** cờ — **chủ ý**, **không** "chuẩn hoá" hai chiều cho đối xứng.
* ~~Default capability — D24/D25~~ — **hai quyết định này đã RÚT LẠI.** Không có default/backfill/self-grant.
* Delete authority — D27 + **D31**: `canDeleteTopic`, **không** dùng content hay structure.
* Ba capability — **D31**; rename thuộc content (**D32**); reorder thuộc structure (**D37**).
* Một RPC xoá duy nhất — **D33**; restore mirror delete — **D36**.
* Guard lifecycle của delete — **D35**.
* Hằng số `cancellation_reason` — **D38** (delete trung tính) và **D29** (withdraw giữ "Tác giả").
* Luật hiện/ẩn — D28, bảng §7.4.
* Field capability — D30; ba field structure row — D31.
* Phạm vi helper — **D40**: `d1_is_active_course_author` **chỉ** cho `canManageStructure`, vì nó loại `previewer`.
* Grant helper — **D39**: kiểm security mode trước; chỉ grant `authenticated` cho helper có client gọi trực tiếp.
* Tên mã lỗi — §5.13 (**v4 đề xuất, chưa được Owner xác nhận riêng**).

**Phải** tự kiểm trước khi code:
* `§10.2` — **Lớp B (field DTO bắt buộc)** là lớp duy nhất còn thật sự vỡ vì quyền duyệt đã bị D41 loại khỏi phương trình.
  Đọc **từng** `toEqual` chứ đừng grep cờ. Và **Lớp A′** — danh sách test **đang xanh phải giữ xanh**, không được "sửa".
  **Lớp B có HAI nhánh vỡ, sửa theo thứ tự:** (1) **lỗi type** trước — fixture truyền object thiếu field vào prop
  `workflow: TopicWorkflow` ⇒ `npx tsc --noEmit` đỏ (ca điển hình `__tests__/components/topic-workflow-panel.test.tsx`,
  **0** `toEqual`); (2) **fail parse** sau — fixture dựng DTO đầy đủ rồi assert bằng `toEqual` (ca điển hình
  `actions/course-structure.test.ts`, `schemas/topic-workflow.test.ts`). Xem §10.2 để có danh sách chính xác và lệnh đếm.
* `§3.1` — xác nhận **ba** hàm reviewer sống vẫn có nhánh role-derived (đúng theo D41) **cộng**
  `d1_has_distinct_topic_reviewer` (chết, drop ở P18). Nếu ai đó đã **bỏ** nhánh role khỏi một trong ba hàm — tức đã
  implement theo D23 cũ — **dừng và báo** (R16′): đó là regression lên D41.
  **Điều kiện dừng này chỉ áp cho việc BỎ nhánh role-derived** (*thu hẹp ở round 7 — `B-F9`*). Nó **không** áp cho việc
  **thêm** một vế — nhưng cũng **không** có vế nào cần thêm: D42 **không** đòi sửa ba hàm này (Owner chốt round 7).
  Enforcement của D42 nằm ở §5.5. Nếu bạn thấy mình đang định thêm logic D42 vào ba hàm reviewer ⇒ **dừng**, đọc lại
  §5.4 + §5.5.
* `§5.5` — xác nhận **hai lớp enforcement** của D42 còn nguyên: (1) `v_new_flag` ở RPC role-change
  ([`20260916130000:601-605`](../../../../../supabase/migrations/20260916130000_d1_topic_authorship_boundary.sql)) với
  `else false`; (2) trigger `clear_topic_review_capability_on_role_downgrade` với **đủ ba nhánh**. Nếu ai đó **rút gọn**
  biểu thức `case` (ví dụ "chuẩn hoá" `previewer → editor` cho đối xứng — `R33`) hoặc bỏ một nhánh trigger ⇒ **dừng và
  báo**: bất biến "cờ cũ không resurrect" mất cơ chế. Đây là nơi D42 **thật sự** sống.
* `§3.5` — xác nhận `d1_topic_group_member_for_restore` vẫn là hàm thứ hai tại thời điểm implement (nếu đã đổi, dừng).
* `§3.6` — inventory call site; xác nhận không có đường ghi content nào bỏ qua `d1_topic_group_member` (A1).
* `§3.7` — xác nhận **hai** trigger trên `topics` vẫn tên như ghi (`d1_guard_topic_lifecycle_mutation`,
  `d1_guard_topic_authorship_mutation`); và `Topics - Staff Update` / `Staff Soft Delete` **không** được tạo lại sau
  `20260917100000`.
* `§3.7` + `§5.7` — **kiểm chứng chuỗi GUC**: đọc `d1_cancel_pending_reviews_for_topics` và xác nhận nó thật sự
  `set_config('voca.d1_trusted_topic_lifecycle', 'on', true)` **trước** mọi câu `update public.topics`. Nếu bước đó bị bỏ,
  đổi thứ tự, hoặc set non-local, `delete_topic` trên topic `pending` sẽ raise `TOPIC_PENDING_FROZEN`. Đây là phụ thuộc
  dễ vỡ nhất trong toàn bộ v4 (R28).
* `§3.14` — xác nhận **lại** ba vế của transition contract (D42). (i) `owner` **không** bị hạ: guard `:576-577` raise
  `COLLABORATOR_MANAGEMENT_FORBIDDEN` bất kể actor. (ii) `co_owner` **hạ được bởi `owner`** xuống `editor`/`previewer` —
  **đây là transition thật của D42, KHÔNG phải dấu hiệu ai đó đã nới guard**; nó đã tuân D42 vì cả RPC (`case … else
  false`) lẫn trigger clear-on-downgrade đều tước cờ. (iii) **không** nâng được ai vào owner tier:
  `COLLABORATOR_ROLE_CHANGE_OUTSIDE_D1` cho `p_role` ngoài `{editor,previewer}`.
  **Điều kiện dừng chỉ áp cho vế (i)**: nếu `owner` **hạ được** (guard `:576-577` biến mất), **dừng và báo** — lúc đó
  A2 ("course luôn có owner ⇒ pool reviewer không rỗng") mới mất cơ sở. Vế (ii) **không** phải điều kiện dừng: hạ một
  `co_owner` không xoá row `owner` nào.
* `§3.8` + `§5.3` — xác nhận **lại** security mode của `move_topic_order` (`20260916140000:302`) là `security definer`
  trước khi quyết định grant. Nếu ai đó đổi nó thành `security invoker`, D39 **bắt buộc** phải grant lại
  `d1_is_active_course_author` cho `authenticated` — nếu không, reorder hỏng hoàn toàn.
* `§3.13` — xác nhận `add_topic_contributor` vẫn chặn `previewer` trước khi viết test §7.3.

**Chưa** được cấp authority để implement. Cần Owner approve v4 sau khi review xong.

---

## Appendix A — Prompt gốc của Owner (để reviewer đối chiếu)

Trích verbatim từ transcript phiên, chỉ gồm các lượt mang quyết định contract. Giữ nguyên tiếng Việt và định dạng gốc;
chỗ rút gọn đánh dấu `[…]`.

### A.1 — Mở màn: cổng submit quá chặt

> 'Người phụ trách là người duy nhất được gửi hoặc gửi lại yêu cầu duyệt; người đóng góp có thể hỗ trợ soạn nội dung.'
>
> như này thì hơi chặt quá nhỉ, tối đa 4 người nhưng người gửi duyệt giới hạn 1, nếu muốn giữ y nguyên như này thì phải
> làm tính năng bên contri kiểu 'Thông báo cho người phụ trách là đã sửa xong' kiểu thế, còn không thì phải nới lỏng ra tí

### A.2 — Creator, responsible, nhóm 4 người

> tối đa 4 người = creator, respon + 2 contri? trên UI cũng hiện thế mà? database cũng có row đó, người chịu trách nhiệm
> và người tạo là 2 người khác nhau, lúc mới tạo thì người chịu trách nhiệm và người tạo là như nhau nhưng quyền chịu
> trách nhiệm có thể chuyển cho người khác, còn creator là bất biến

### A.3 — Contract bị hiểu sai + câu hỏi exclusion lịch sử

> có vẻ có hiểu lầm ở đây, creator là thành viên trong nhóm mà? vậy là contract ban đầu bị hiểu sai
>
> còn có một lớp nữa kiểu các thành viên trong nhóm không được duyệt/từ chối topic của chính mình dù đã out ra khỏi
> nhóm, cái này có làm đúng như contract chưa?
>
> ví dụ contri C tham gia vào nhưng không có sửa gì thì có thể duyệt sau khi rời khỏi nhóm đó
> nhưng contri D tham gia vào, và content của topic đó bị thay đổi với người thay đổi là D thì D dù có out khỏi contri
> vẫn không đc duyệt/từ chối

### A.4 — Phương án sửa nhẹ nhất

> h sửa nhẹ nhất là dù lần đầu hay các lần sau thì các thành viên trong nhóm đều không thể tự duyệt topic của mình?
> không làm cái out hay phân biệt đã sửa hay chưa? sau đó sửa lại đúng contract là creator cũng là 1 thành viên?

### A.5 — Trả lời AskUserQuestion

* *"Logic loại trừ theo lịch sử (người đã rời nhóm) — giữ hay bỏ?"* → **"Giữ (khuyến nghị)"**
* *Creator gửi duyệt?* → **"bạn phải hiểu là như này, nguyên tắc một người ký vốn dĩ sinh ra là để tránh topic đó bị khóa
  khi mà nhóm ít người, h cả 4 xác đều bị khóa vô điều kiện thì thả cho cả 4 người gửi duyệt cũng được luôn ấy :v nên
  là creator + respon có thể gửi duyệt sẽ hợp lý"**
* `can_review_topics` cho owner/co_owner → **"Default true cho owner/co_owner"**
* Self-grant → **"Cho phép tự cấp"**

### A.6 — previewer + creator

> cụ thể như này nè
>
> quyền = role, role nào nhỏ hơn thì apply quyền của role đó :v ví dụ previewer nên ko đc tạo topic các thứ nữa nhưng
> nó vẫn có thể sửa content của topic mà nó có quyền, ở đây là creator
>
> Ở cấp course:
> - tạo topic mới            ❌
> - thêm/xóa topic tùy ý      ❌
> - quản lý course            ❌
>
> Ở đúng Topic X:
> - vẫn là creator            ✅ bất biến
> - sửa content               ✅
> - gửi / gửi lại review      ✅
> - tự approve/reject         ❌

### A.7 — Course-level + hai nút pending

> COURSE-LEVEL
>
> owner
> - tạo topic ✅
> - xóa mọi topic ✅
>
> co_owner
> - tạo topic ✅
> - xóa mọi topic ✅
>
> editor
> - tạo topic ✅
> - không tự nhiên được xóa topic người khác ❌
>
> previewer
> - tạo topic ❌
>
> thế thì creator + respon có quyền gửi duyệt, đồng thời trong lúc gửi duyệt có thể có 2 nút kiểu "Hủy gửi duyệt và
> quay về chỉnh sửa" -> về draft, group có quyền sửa tiếp
>
> nút còn lại là "Hủy gửi duyệt và xóa bài học"
>
> đủ chặt và rõ ràng chưa?

### A.8 — Delete gate + hằng số cancellation

> 1. **"Topic của mình" = creator hoặc current responsible**, không phải toàn bộ authoring group.
>    * Creator ✅ xóa được topic đó
>    * Responsible ✅ xóa được topic đó
>    * Contributor ❌ không xóa được chỉ vì đang cộng tác
>    * Editor ngoài group ❌ không xóa được topic người khác
>    * Owner/co_owner ✅ xóa được mọi topic
>
> 2. **`previewer + creator` vẫn xóa được topic mình tạo.** `previewer` chỉ làm mất các quyền course-level như tạo topic
>    mới. Quyền trên Topic X vẫn đến từ topic-scoped identity. Nên creator dù là previewer vẫn: edit content ✅ /
>    submit/re-submit ✅ / delete topic đó ✅
>
> 3. **Responsible được xóa topic.** Không phải vì họ là `editor`, mà vì họ là **current responsible của topic đó**. Vậy
>    delete gate phải là:
>    ```text
>    owner/co_owner
>    OR original creator
>    OR current responsible
>    ```
>    Contributor không được ké quyền delete.
>
> 4. **`cancellation_reason` dùng hằng số hệ thống, không bắt user nhập.** […] * Quay về chỉnh sửa →
>    `"Tác giả hủy yêu cầu duyệt để tiếp tục chỉnh sửa."` * Hủy gửi duyệt và xóa bài học →
>    `"Tác giả hủy yêu cầu duyệt và xóa bài học."` Không cần biến nó thành một form nhập lý do như reject, vì đây là
>    lifecycle action chứ không phải feedback.
>
> Thêm một correction cho change set của nó: nút pending **không nên dựa vào `canRequestReview`**. Nên có capability
> riêng kiểu `canWithdrawReview` / `canDeleteTopic`, vì `canRequestReview` là semantics của trạng thái draft.

### A.9 — Luật hiện/ẩn action

> Nên dùng rule:
>
> Action thuộc workflow mà user đang tham gia → hiện nhưng disable nếu thiếu quyền.
> Action hoàn toàn không thuộc vai trò của user → ẩn.
>
> | Actor | Quay về chỉnh sửa | Gửi duyệt | Xóa topic |
> | --- | --- | --- | --- |
> | Creator | hiện/enabled khi hợp lifecycle | hiện/enabled | hiện/enabled |
> | Responsible | hiện/enabled khi hợp lifecycle | hiện/enabled | hiện/enabled |
> | Contributor | **hiện disabled** | **hiện disabled** | **hiện disabled hoặc ẩn** |
> | Owner/co_owner ngoài group | **ẩn** | **ẩn** | hiện/enabled |
> | Editor ngoài group | **ẩn** | **ẩn** | **ẩn** |
> | Previewer ngoài group | **ẩn** | **ẩn** | **ẩn** |
>
> Lý do là contributor thực sự đang tham gia authoring workflow. Việc cho nó thấy:
>
> Gửi duyệt 🔒
> Chỉ người tạo hoặc người phụ trách có thể gửi bài học để duyệt.
>
> rất có ích. Nó trả lời luôn câu "ủa sao tôi sửa được mà không gửi được?" thay vì user phải đoán feature có tồn tại
> hay không.
>
> Tương tự lúc pending:
>
> Quay về chỉnh sửa 🔒
> Chỉ người tạo hoặc người phụ trách có thể hủy yêu cầu duyệt.
>
> Contributor nhìn vào hiểu ngay pending đang freeze và ai có quyền mở khóa.

### A.10 — Reviewer là capability family riêng + F4 correction

> Contributor + delete: ẩn. Contributor không có ownership/delete authority.
> Reviewer actions đúng là capability family riêng. Owner/co_owner không được review chỉ vì course role; review phải đến
> từ review capability riêng.
> Vì vậy nhận định "owner/co_owner ngoài group có thể reject để quay về draft" là không đúng target contract. Nếu họ
> không có reviewer capability riêng thì trong pending họ chỉ read + delete; không
> edit/submit/withdraw/approve/reject. Creator/responsible mới có withdraw-to-draft.
> getNextAction contributor bug: sửa như đề xuất. Accessibility cleanup cũng giữ.

> ⚠️ **ĐÃ BỊ ĐẢO** bởi `A.24`/`A.25` (D23 đảo + D41) — **câu đầu tiên** của lượt này (*"review phải đến từ review
> capability riêng"*) **không còn hiệu lực**: Owner chốt owner/co_owner review **role-native**. Phần còn lại của lượt vẫn
> đúng. Đọc theo D41/D42 ở §2, **không** đọc theo câu đầu.

### A.11 — Chốt cuối trước v4

> Xác nhận: bỏ hẳn course-role check khỏi d1_topic_group_member cho creator/responsible/active contributor; vẫn yêu cầu
> active course collaboration. Topic-scoped rights độc lập course role.
> F4 đang sai: owner/co_owner ngoài group mặc định có can_review_topics=true, nên khi pending họ có read + delete +
> approve/reject; chỉ ẩn edit/submit/withdraw. Nếu họ thuộc current authoring group thì E1 chặn review.
> Invite/materialization bug xác nhận. Backend phải guarantee owner/co_owner materialize với can_review_topics=true; UI
> cũng gửi đúng nhưng không phải authority.
> "Editor xóa topic mình tạo" là kết quả của editor → create → becomes creator, không phải delete permission của editor
> role.

> ⚠️ **ĐÃ BỊ ĐẢO** bởi `A.24`/`A.25` (D23 đảo + D41) — **hai câu về invite/materialization** (*"mặc định có
> can_review_topics=true"* và *"Backend phải guarantee owner/co_owner materialize với can_review_topics=true; UI cũng gửi
> đúng"*) **không còn hiệu lực**. D41 nói thẳng: **không** có "materialization guarantee", **không** backfill, **không**
> widen trigger; và §8.2 **cấm** cho UI gửi `can_review_topics: true` cho owner tier — đó chính là trap `B-F2` đã xảy ra ở
> round 2 (xem §5.12 `U11`). Lý do Owner đổi: quyền duyệt của owner tier đến từ **role**, nên không cần materialize cờ.
> Bốn câu còn lại của lượt vẫn đúng.

### A.12 — Ruling P1: kiến trúc delete

> P1 — sửa kiến trúc delete. Không được làm kiểu:
>
> delete gate riêng ✅
> → rồi gọi d1_prepare_topic_content_mutation
> → lại bắt topic_group_member ❌
>
> Delete phải có authority riêng:
>
> canDeleteTopic = active course collaborator AND (owner/co_owner OR creator OR current responsible)
>
> Sau đó dùng lifecycle/locking primitive cần thiết để soft-delete, không chạy lại authoring-group authorization.
> d1_prepare_topic_content_mutation là đường content editing, không phải delete authority.

### A.13 — Ruling P2: một delete path

> P2 — cùng một delete path phải xử lý pending. Không nên có một RPC "delete thường" và một RPC "author cancel+delete"
> với permission lệch nhau.
>
> Semantics sạch nhất:
>
> delete_topic(topic)
> auth: owner/co_owner OR creator OR responsible
> nếu draft: → soft delete
> nếu pending: → atomic: cancel pending submission → soft delete
>
> UI mới khác nhau theo actor:
> creator/responsible: "Hủy gửi duyệt và xóa bài học"
> owner/co_owner ngoài group: "Xóa bài học"
>
> nhưng backend operation là cùng một destructive capability. Với owner ngoài group, cancel submission chỉ là side
> effect bắt buộc của delete, không phải họ "withdraw review".
>
> Còn action riêng: withdraw_review_to_draft thì chỉ creator/responsible.

### A.14 — Ruling P3: membership sống

> P3 — fix như DeepSeek nói. Topic identity không đủ, phải còn membership sống:
>
> topic-scoped authority = active course collaboration AND topic identity
>
> Áp cho RPC authority lẫn capability DTO. UI read gate đã bảo vệ hiện tại không có nghĩa backend được bỏ guard.

### A.15 — Ruling P4: restore + reorder + taxonomy

> P4 — tôi khuyên chốt rõ thế này:
>
> RESTORE
> owner/co_owner ✅ mọi topic
> creator ✅ topic của mình
> responsible ✅ topic mình phụ trách
> contributor ❌
> unrelated editor ❌
>
> Tức restore mirror delete.
>
> Lý do đơn giản: restore là lifecycle/ownership action, không phải sửa content. Contributor có quyền sửa nội dung không
> đồng nghĩa được hồi sinh nguyên topic.
>
> Và move_topic_order thì ngược lại: nếu đúng là reorder course structure/topic order, nó phải theo course-level authoring:
> owner/co_owner/editor ✅
> previewer ❌
> topic contributor chỉ nhờ membership → ❌
>
> Không được để D26 vô tình biến previewer + contributor → reorder course structure chỉ vì helper d1_topic_group_member
> đang bị reuse.
>
> Nói cách khác, discovery này cho thấy cái helper hiện tại gánh nhiều semantic quá. D26 đúng với content authoring, nhưng
> không nên apply máy móc cho mọi caller:
>
> topic authoring membership → edit cards/exercises/content
> delete/restore authority → owner/co_owner/creator/responsible
> course structure authority → owner/co_owner/editor

### A.16 — Ruling W1: wording

> W1 sửa wording:
>
> Sai: "Không có đường thoát khi rời nhóm."
>
> Đúng: "Current creator/responsible/active contributor luôn bị review exclusion ở mọi vòng. Former members chỉ tiếp tục
> bị historical exclusion trước first approval theo D21."

### A.17 — Ruling B1: ba capability

> B1: xác nhận 3 capability riêng. Đừng cố nhét delete vào content hay structure nữa:
>
> canEditContent = active collaborator AND (creator OR responsible OR active contributor)
> canManageStructure = active collaborator AND course role ∈ {owner, co_owner, editor}
> canDeleteTopic = active collaborator AND (owner/co_owner OR creator OR current responsible)
>
> Rename topic thuộc canEditContent. Và đúng, đây là thay đổi có chủ đích:
>
> editor ngoài group
> - reorder topic trong course ✅
> - rename topic người khác ❌
> - sửa content topic người khác ❌
> - delete topic người khác ❌
>
> Tôi thấy cái này hợp model hơn. Reorder là quản lý cấu trúc course, còn đổi title là mutate chính artifact/topic đó.
> Không nên vì editor có quyền sắp xếp structure mà được đổi tên bài của nhóm khác.
>
> Course Structure row vì vậy cần cả 3 field, không còn canEdit overloaded.

### A.18 — Ruling B2: giữ lifecycle guard

> B2: giữ nguyên published lifecycle guard. delete_topic mới phải preserve:
>
> removed_at != null → TOPIC_NOT_FOUND
> published + !p_confirm_published → TOPIC_PUBLISHED_CONFIRM_REQUIRED
> published + confirmed → giữ semantics hiện tại cần thiết → rồi soft-delete
>
> Không được vì bỏ d1_prepare_topic_content_mutation mà vô tình mất những invariant lifecycle nó từng gánh.
>
> Tức delete RPC mới phải explicitly übernehmen những validation thuộc delete lifecycle, nhưng không übernehmen
> group-authoring gate.
>
> Với pending: pending → cancel pending submission → delete, vẫn atomic như đã chốt.

### A.19 — Ruling B3: string trung tính

> B3: đổi delete cancellation reason sang string trung tính, đừng tạo string riêng owner/co_owner.
>
> Giữ withdraw: "Tác giả hủy yêu cầu duyệt để tiếp tục chỉnh sửa." vì action đó đúng là chỉ creator/responsible.
>
> Còn delete dùng chung: "Hủy yêu cầu duyệt để xóa bài học."
>
> Actor thật đã nằm ở cancelled_by_user_id, nên audit reason không cần nhắc "Tác giả". Như vậy creator/responsible hay
> owner/co_owner đều không nói sai người.
>
> UI vẫn khác:
> creator/responsible: "Hủy gửi duyệt và xóa bài học"
> owner/co_owner ngoài group: "Xóa bài học"
>
> nhưng backend cancellation reason dùng cùng string trung tính.

### A.20 — Ruling B4: đồng ý hướng, sửa lý do

> Còn B4 không cần Owner decision. Tôi đồng ý với hướng tránh overloaded function, nhưng không coi "PUBLIC exposure
> window" là lý do bắt buộc phải tạo tên mới. Nếu migration DROP → CREATE → REVOKE/GRANT chạy atomically thì không có
> external window giữa các statement trước commit. Tuy vậy, tạo function shape mới/tên rõ semantics rồi chuyển consumer
> sang vẫn khá sạch, miễn sau đó remove function cũ để không tồn tại hai authority surface song song.

### A.21 — Ruling cuối: tách hai capability cho structure permissions

> Chốt d1_topic_structure_permissions: tách hai capability, không chọn một trong hai semantics cho canEdit.
>
> canEditContent = active course collaboration AND current topic authoring-group membership (creator || responsible ||
> active contributor).
> canManageStructure = active course collaboration AND course role owner/co_owner/editor.
> Reorder và các mutation thuộc Course Structure dùng canManageStructure.
> Quyền mở/sửa content của topic dùng canEditContent.
> previewer + creator/contributor được edit content nhưng không reorder structure.
> editor ngoài group được manage/reorder structure nhưng không edit content của topic đó.
>
> Audit consumers hiện tại của d1_topic_structure_permissions/row canEdit; đổi mỗi consumer sang capability đúng
> semantics, không giữ một boolean overloaded.

### A.22 — Ruling cuối: thứ tự và phạm vi

> Sau đó patch toàn bộ L1–L5 + P1–P4 + W1 theo các ruling đã chốt, nhưng chưa implementation; rồi gọi plan reviewer, nhớ
> nhét đủ owner prompt vào để reviewer đối chiếu
>
> trước khi sửa phải kiểm tra xem có mismatch, blocker nào không, nếu có thì dừng và báo lại, không sửa mù, không giả
> định rằng prompt luôn đúng

### A.23 — Ruling bổ sung: phạm vi của `d1_is_active_course_author` và luật grant helper

> Proceed patch L1–L5 + P1–P4 + W1 + B1–B3 theo rulings đã chốt. Reuse d1_is_active_course_author chỉ cho
> canManageStructure; không dùng nó làm generic active-collaboration check vì nó loại previewer. Trước khi grant helper
> cho authenticated, kiểm security mode/call path; nếu chỉ được gọi nội bộ từ canonical security-definer boundary thì
> giữ helper private

Ánh xạ: **D40** (không dùng làm generic check) và **D39** (giữ private). Đây là ruling đã **bác bỏ** một câu trong bản
nháp trước của v4 (*"D37 chỉ cần grant lại"*) — xem §3.8.

### A.24 — Lựa chọn hướng cho `B-F4` (đảo D23) — **lượt 2026-09-19 (b)**

> Correction contract: owner / co_owner luôn có quyền review mặc định từ role, không có toggle riêng và không dùng
> can_review_topics để bật/tắt quyền đó. Muốn mất quyền review thì phải đổi/rời role.
> can_review_topics chỉ là capability bổ sung cho editor / previewer.
>
> Effective rule:
> canReview = role in {owner, co_owner} OR can_review_topics = true, sau đó vẫn áp reviewer exclusion như hiện tại.
>
> Trước khi sửa v4, audit read-only xem đổi về model này có blocker/regression nào trong current repo không: reviewer
> helpers/safety check, invitations/materialization, role-change paths, UI checkbox, tests/fixtures, và các
> migration/backfill mà v4 đang đề xuất. Báo finding trước, chưa patch.

Ánh xạ: **D23 (đảo)**, **D41** (cờ chỉ cho editor/previewer), **D24/D25 rút lại**, **C7**, **A2/A27/A28/A29/A55/A56/A57**,
và việc **xoá §5.4/§5.5 + P12 + A52/A53/A54 + R13/R14*/R16/R29/R30/R31**. Đây là ruling **đảo** nội dung D23 mà chính
Owner đã chốt ở A.5 (*"Default true cho owner/co_owner"* / *"Cho phép tự cấp"*) — Owner chủ động thay đổi, không phải
Planner suy diễn.

### A.25 — Chốt hướng (ii) cho quan hệ D23 ↔ exclusion

> Chọn (ii). "Vẫn áp reviewer exclusion" chỉ nghĩa là review authority vẫn đi qua exclusion layer; D20/D21 không bị đảo.
> Current creator/responsible/active contributor luôn bị exclude ở mọi vòng; former members chỉ bị historical exclusion
> trước first_approved_at.
> Giữ P11 phần tách d1_is_topic_reviewer_excluded.
> Với reviewer authority: owner/co_owner role-native; can_review_topics chỉ cho editor/previewer. Proceed patch theo
> audit vừa chốt, chưa implementation, rồi fresh review.

Ánh xạ: **C7** (xử theo (ii)), **D20/D21 giữ nguyên**, **P11 giữ phần tách `d1_is_topic_reviewer_excluded`**, và cấp
authority để patch v4 + gọi fresh review (round 4).

### A.26 — Bổ sung transition contract cho review authority — **lượt 2026-09-19 (c)**

> bổ sung:
>
> Bổ sung transition contract cho review authority:
>
> owner/co_owner: review là role-native, không phụ thuộc can_review_topics.
> editor/previewer: review chỉ từ explicit can_review_topics.
> Mọi downgrade phải tước review grant cũ: owner/co_owner -> editor/previewer ⇒ can_review_topics=false; editor(flag=true) -> previewer ⇒ false; remove khỏi course ⇒ mất toàn bộ review authority.
> Promotion lên owner/co_owner ⇒ review tự có từ role, không cần set flag.
> Không được để flag cũ resurrect quyền review sau một vòng promote→downgrade; khi hạ khỏi owner-tier phải yêu cầu cấp lại explicit capability.
>
> Audit current role-change/invitation/remove paths và tests xem có chỗ nào trái transition contract này trước khi patch.
>
> để tránh bạn nhầm lẫn

Ánh xạ: **D42** (mới, §2). Audit read-only đã chạy trước khi patch; kết quả ở §3.14 (sửa độ rộng), §5.5 (sửa lý do),
và `§10.1` hàng mới cho lỗ hổng phủ test. Chốt kèm của Owner: `previewer(cờ=true) → editor` **giữ** cờ — giữ nguyên hành
vi đang chạy, ghi thành chủ ý trong D42.

---

## Appendix B — Nguồn transcript (để reviewer kiểm chứng độc lập)

> **Đã sửa ở review round 0.** Bảng số dưới đây trước kia ghi `267` / `15` / `27-27` — **cả ba đều không tái lập được**.
> Đó là claim về bằng chứng, nên sai số ở đây không phải lỗi trình bày. Số mới lấy bằng cách chạy lệnh, ghi kèm thời điểm đo.

**Cảnh báo quan trọng: transcript này là của phiên đang chạy, nên nó vẫn đang được ghi.** Mọi con số bên dưới là **ảnh
chụp tại thời điểm đo** và sẽ tăng khi phiên tiếp tục. Reviewer tái lập phải chấp nhận sai lệch tăng dần, và chỉ cần xác
nhận **bậc độ lớn** và **tính chất phạm vi**, không phải khớp tuyệt đối.

| | Đo lúc 2026-09-19 (**phiên đang chạy** — số **tăng** giữa các lần đo) |
| --- | --- |
| **Transcript** | `C:\Users\khang\.claude\projects\c--VocaSpace\42383274-6b12-4e8a-a5a5-8ef9418540a6.jsonl` |
| **Tổng entry `type:"user"`** | *Bỏ số cứng ở round 8 (`L-F17`/`N-F13`).* Phiên đang chạy nên số **tăng sau mỗi lượt** — ba lần đo liên tiếp cho ba số khác nhau, nên mọi con số cứng ở đây **tự tạo stale**. Đo bằng `jq 'select(.type=="user")' \| jq -s 'length'`; chỉ cần xác nhận **bậc độ lớn** (`~8xx`), không khớp tuyệt đối |
| **Sau filter chuẩn** | *Bỏ số cứng, cùng lý do.* Đo bằng `jq 'select(.type=="user" and (.toolUseResult==null) and (.isMeta != true))' \| jq -s 'length'` ⇒ **~3x** |
| **Prompt được trích vào Appendix A** | `26` mục (A.1–A.26). **Không** bằng số filter — Appendix A là **tập con do Main chọn**: chỉ các lượt mang quyết định contract. Phần còn lại là câu hỏi vận hành và xác nhận ngắn. *Sửa ở round 5: trước ghi `23` (A.1–A.23), sót `A.24`/`A.25`; `A.26` thêm cùng lượt.* **Round 6 kiểm lại: vẫn `26`** — lượt (d) cấp round 6 **không** được trích thành `A.27` vì đó là câu lệnh quy trình, không phải quyết định contract; nội dung của nó nằm ở §0 + §13. Con số này **đếm được bằng lệnh**: `grep -c '^### A\.' <candidate>` |
| **Cách lọc** | `jq 'select(.type=="user" and (.toolUseResult==null) and (.isMeta != true))'` |
| **Kiểm chứng phạm vi** | *Sửa ở round 6 (`L-F12`); đo lại ở round 7 (`L-F13`/`L-F14`/`L-F15`); **bỏ số cứng ở round 8** (`L-F17`/`N-F13`).* Lệnh dẫn ở bản round 6 dùng `grep -c -E "…\|…"` — với `-E`, `\|` là **pipe literal** nên lệnh chỉ khớp **một** chuỗi và cho `0`/`1`; **không tái lập được** chính các con số nó khai. Dạng **đúng**: `grep -c "tối đa 4 người\|một người ký\|Hủy gửi duyệt"` (BRE, escape `\|`) — chạy được, cho **~7x** dòng trên transcript. Trên **candidate** = **13** dòng (ổn định, không tăng — file tĩnh). Thư mục `C:\Users\khang\.claude\projects\c--VocaSpace\` chứa **9** file `.jsonl` **tổng cộng** ⇒ **8** file còn lại ngoài `42383274-….jsonl`; đếm **top-level** thì **1** file khớp, đệ quy thì **2** (thêm một transcript subagent). Con số dòng khớp **không** được ghi cứng — nó tăng theo phiên. Kết luận định tính — **toàn bộ mạch contract D1 nằm gọn trong một phiên** — **vẫn đứng**; hàng này không chống đỡ kết luận nào. Giữ `Low` theo tiền lệ `L-F7`. |

**Giới hạn đã biết của Appendix A:** đây là **bản transcription do Main thực hiện**, không phải bản do một bên độc lập
sinh ra. Main vừa là tác giả của kế hoạch vừa là người trích nguồn, nên **không** là bên trung lập cho phần này. Reviewer
được yêu cầu tự đối chiếu lại với transcript thay vì tin bản trích — và ở round 0 đã làm vậy cho A.12–A.16, A.17–A.23,
A.5, kết quả **không sai lệch nội dung**.

Câu trả lời AskUserQuestion **không** nằm trong `type:"user"` prompt mà nằm trong tool result — lấy bằng
`jq 'select(.type=="user" and .toolUseResult!=null)'` rồi grep. Ba câu đã dùng: *"Giữ (khuyến nghị)"*,
*"Default true cho owner/co_owner"*, *"Cho phép tự cấp"*.

A.23 (ruling bổ sung về `d1_is_active_course_author`) đến ở dạng **attachment `queued_command`** chứ không phải prompt
thường; filter chuẩn **không** bắt được dạng này. Người kiểm chứng phải grep thẳng chuỗi
`Reuse d1_is_active_course_author` trong file thay vì chỉ dựa vào filter.

**`A.26` cũng ở dạng đó** (*bổ sung round 6 — `N-F7`*): transition contract (lượt 2026-09-19 (c)) đến dưới
`attachment.type == "queued_command"`, **không** phải `type:"user"`. Người kiểm chứng theo đúng "Cách lọc" ở trên sẽ
**không** tìm thấy `A.26`. Grep thẳng chuỗi `Bổ sung transition contract cho review authority` để định vị.
