# D1 Correction Plan v3 — Ghi chú gắn đích tạo tại chỗ

> **Quan hệ với các tài liệu khác.** Đây là **amendment** cho [`correction-plan-deepseek-v2.md`](./correction-plan-deepseek-v2.md),
> không phải bản thay thế. v2 vẫn là contract hiệu lực cho mọi mục **không** được nêu ở §6 dưới đây.
>
> `./plan.md` vẫn stale có chủ đích theo D14 (v2 §13.1). Bản này **không** reconcile `plan.md`.

---

## 0. Nguồn, phê duyệt và authority

| | |
| --- | --- |
| **Workflow / episode** | `MULTI_AGENT_E2E` · episode *detailed-plan candidate* · `review_round=0`, `0` correction round đã dùng |
| **Owner input revision** | Lượt hiện tại của Owner, 2026-09-18: chốt ghi chú gắn đích tạo tại chỗ; chọn hướng sửa contract; D18 (chỉ card + exercise); D19 (hiện ở cả hai chỗ); yêu cầu review v3 trước khi commit |
| **Master Plan / workstream** | [`docs/native-multi-agent/plan.md`](../../../../native-multi-agent/plan.md) — D1 (topic authoring → review → publication) |
| **Contract nền** | [`correction-plan-deepseek-v2.md`](./correction-plan-deepseek-v2.md) — đã `PASS` Owner review 2026-09-18 |
| **Phê duyệt hiện có** | v3 là **đề xuất**, `review_round=0`. Owner chưa approve v3 và **chưa** cấp authority implementation cho P6–P10 |

**Authority snapshot — phân biệt rõ, không suy diễn lẫn nhau:**

| Hành động | Trạng thái |
| --- | --- |
| Commit local cho artifact v2 (lượt chạy cũ) | **Được cấp** (Owner yêu cầu lượt này) |
| Commit local cho tài liệu v3 | **Được cấp** (Owner yêu cầu lượt này) |
| Commit local cho thay đổi Tailwind của Owner | **Được cấp** (Owner yêu cầu lượt này) |
| Commit local cho correction durable docs | **Được cấp** (Owner yêu cầu lượt này) |
| Implementation P6–P10 của v3 | **CHƯA cấp** — cần Owner approve v3 sau review |
| Push / PR / merge / deploy | **CHƯA cấp** |
| `npx supabase db push`, remote DB, production data | **CHƯA cấp** |
| Review artifact vào Git | **Bị cấm** — phải ignored, untracked, unstaged |

`PASS` của Plan Reviewer **không** phải Owner approval và **không** cấp implementation/Git/remote authority.

---

## 1. Mục tiêu và kết quả quan sát được

1. Người có quyền review mở tab **Flashcard**, thấy badge trên mỗi thẻ **có** ghi chú; bấm vào đọc được **ai ghi, lúc nào, nội dung gì**.
2. Bấm badge ngay trên một thẻ → soạn ghi chú → lưu **gắn đúng `card_id` của thẻ đó**, không cần chọn đích ở nơi khác.
3. Tương tự với **bài tập** trong tab Exercises → gắn đúng `exercise_id`.
4. Ghi chú gắn đích **đồng thời** hiện trong panel tổng hợp cấp topic, kèm nhãn đích (D19).
5. Ghi chú **cấp topic** vẫn tạo được từ panel như hiện tại — không mất đường cũ.
6. Panel và affordance tại chỗ dùng **cùng một** cách render note; không có hai bản JSX song song (§5.4).

---

## 2. Owner decision

| # | Quyết định |
| --- | --- |
| **D15** | Ghi chú gắn đích được **tạo ngay trên nội dung** (card / bài tập) là đường chính. Không bắt người dùng chọn đích từ danh sách. |
| **D16** | Chọn hướng **sửa contract** — không gỡ năng lực gắn đích, không để UI lệch contract. |
| **D17** | UI ghi chú hiện tại bị đánh giá **giống CRUD, không phải prod UI**. Đây là **tiêu chí nghiệm thu**, không phải lời bình. |
| **D18** | Đích ghi chú **chỉ** `card` + `exercise`. **Không** mở rộng xuống câu hỏi hay nhóm ngữ liệu. Hệ quả: **không cần migration nào**. |
| **D19** | Một ghi chú gắn đích hiện ở **cả hai chỗ**: badge đọc nhanh tại nội dung **và** panel tổng hợp cấp topic. Owner: *"như này tiện hơn cho người dùng rất nhiều"*. |

**D18 là quyết định có chủ đích, không phải bỏ sót.** Hệ quả ghi nhận trung thực: trong `ExerciseTab`, nội dung thật nằm ở câu hỏi và nhóm ngữ liệu (§3.2), nên reviewer **không** ghim được ghi chú vào một câu cụ thể. Nếu nhu cầu đó xuất hiện thật, nó là **phase riêng cần migration**.

---

## 3. Repository fact (đã kiểm chứng)

### 3.1 Bề mặt UI

| File | Vị trí | Dòng |
| --- | --- | --- |
| `TopicReviewNotes.tsx` | Context `TopicReviewNotesContext` — **chưa export** | [`:27`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicReviewNotes.tsx#L27>) |
| | `targetLabel()` → `"Flashcard: <từ>"` / `"Bài tập: <tiêu đề>"` | [`:79-83`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicReviewNotes.tsx#L79-L83>) |
| | Nơi gọi `createReviewNote` — hiện **chỉ** gửi `{ topicId, body }` | [`:105`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicReviewNotes.tsx#L105>) |
| | Guard `if (!value \|\| (!value.canRead && !value.readError)) return null;` | [`:97`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicReviewNotes.tsx#L97>) |
| | `formatRelativeTime` → `"3 phút trước"` | [`:50-68`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicReviewNotes.tsx#L50-L68>) |
| `FlashcardTab.tsx` | `cards.map((card) => (` — `card.id` **trong scope** | [`:148`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/FlashcardTab.tsx#L148>) |
| | Wrapper một thẻ (`group` class) | [`:149-189`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/FlashcardTab.tsx#L149-L189>) |
| | Toolbar hover (`hidden … group-hover:opacity-100 md:flex`) | [`:167-188`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/FlashcardTab.tsx#L167-L188>) |
| | Thân thẻ (word / pos / phonetic / translation) — **luôn hiển thị** | [`:153-166`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/FlashcardTab.tsx#L153-L166>) |
| `ExerciseTab.tsx` | `exercises.map((ex) => (` — `ex.id` **trong scope** | [`:605`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/ExerciseTab.tsx#L605>) |
| | Wrapper một bài tập | [`:606-616`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/ExerciseTab.tsx#L606-L616>) |
| | Khối header bài tập (`{ex.title}`) | [`:617-651`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/ExerciseTab.tsx#L617-L651>) |
| | Cụm nút Sửa/Xóa bài tập (`hidden gap-2 md:flex`) | [`:631-650`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/ExerciseTab.tsx#L631-L650>) |
| `page.tsx` | `TopicReviewNotesProvider` **bao quanh** `TopicBuilderTabs` | [`:89-110`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/page.tsx#L89-L110>) |
| `TopicBuilderTabs.tsx` | `TopicWorkflowPanel` (nơi render panel note) | [`:270`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicBuilderTabs.tsx#L270>) |
| | `readOnly={!workflow.canEdit \|\| workflow.status === "pending"}` trên cả 3 tab | [`:319`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicBuilderTabs.tsx#L319>), [`:329`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicBuilderTabs.tsx#L329>), [`:343`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicBuilderTabs.tsx#L343>) |

**`TopicBuilderTabs.tsx` KHÔNG cần sửa cho v3.** Đã kiểm: provider bao ngoài `TopicBuilderTabs`, nên `FlashcardTab`/`ExerciseTab` nằm trong cây context và đọc note bằng hook trực tiếp — **không cần truyền prop qua `TopicBuilderTabs`**. File này chỉ xuất hiện trong kế hoạch commit vì **thay đổi Tailwind của chính Owner** (§7), là việc độc lập, không thuộc contract v3.

### 3.2 Cấu trúc con của một bài tập

| Nhánh | Dòng | `id` trong scope |
| --- | --- | --- |
| Nhóm ngữ liệu (Part 1/3/7) | [`:653-787`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/ExerciseTab.tsx#L653-L787>) | `group.id` |
| Câu hỏi trong nhóm | [`:711-784`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/ExerciseTab.tsx#L711-L784>) | `q.id` |
| Câu hỏi độc lập (Part 5) | [`:790-862`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/ExerciseTab.tsx#L790-L862>) | `q.id` |

Exercise có `title`, **không** có `front_content`. Card có `front_content.word` ([`types.ts:43-60`](<app/(teacher)/teacher/courses/[id]/_components/types.ts#L43-L60>)) — khớp cách `toTopicReviewNote` lấy nhãn ([`app/actions/review-notes.ts:110`](app/actions/review-notes.ts#L110)).

**Ranh giới bằng chứng:** dòng của `ExerciseTab.tsx` (§3.2) đến từ khảo sát subagent, **chưa** được Main đối chiếu trực tiếp. Trước khi implement P8 phải tự kiểm; nếu lệch thì sửa §3.2 chứ **không** implement theo số cũ.

### 3.3 Đường ghi đã đủ — không cần đụng

| Tầng | Trạng thái | Bằng chứng |
| --- | --- | --- |
| DB: cột + `single_target_check` + guard trigger + index | ✅ đủ | [`20260917120000_d1_review_notes.sql:15-38`](supabase/migrations/20260917120000_d1_review_notes.sql#L15-L38) |
| Zod: `cardId`/`exerciseId` + refine một-đích | ✅ đủ | [`lib/schemas/review-notes.ts:16-25`](lib/schemas/review-notes.ts#L16-L25) |
| Action: truyền `card_id`/`exercise_id` xuống DB | ✅ đủ | [`app/actions/review-notes.ts:220-225`](app/actions/review-notes.ts#L220-L225) |
| Integration: insert gắn card **và** gắn exercise chạy thật | ✅ pass | [`topic-review-notes.test.ts:216-228`](__tests__/integration/topic-review-notes.test.ts#L216-L228) |

⇒ **Toàn bộ delta nằm ở tầng UI + test. Không migration, không RLS, không action, không schema.**

### 3.4 Primitive sẵn có

| Primitive | Có? | Ghi chú |
| --- | --- | --- |
| `components/ui/badge.tsx` | ✅ | `Badge`, `badgeVariants` |
| `components/ui/popover.tsx` | ✅ | `Popover`, `PopoverTrigger`, `PopoverContent`, … |
| `components/ui/tooltip.tsx` | ✅ | `TooltipProvider` đã mount toàn cục ở [`app/layout.tsx:8`](app/layout.tsx#L8) |
| `components/ui/hover-card.tsx` | ❌ | Không tồn tại |

Chưa component nào dưới `app/(teacher)/` dùng `Badge`/`Popover`/`Tooltip`. Chọn **`Popover`**: chứa được cả danh sách **và** ô soạn; tooltip thì không.

### 3.5 Ghi chú đã xoá mềm **vẫn** được trả về

`getTopicReviewNotes` không lọc `removed_at` — tombstone phải tới được UI (v2 A7). Xác nhận ở [`20260917120000:169-171`](supabase/migrations/20260917120000_d1_review_notes.sql#L169-L171) (policy `select` không lọc `removed_at`) và [`app/actions/review-notes.ts:191-193`](app/actions/review-notes.ts#L191-L193) (query không lọc).

**Hệ quả thiết kế bắt buộc:** badge **không** được đếm tombstone (§5.3).

---

## 4. Giả định, xung đột, câu hỏi mở

### 4.1 Xung đột đã xử lý

v2 §6.5 (truyền prop xuống `TopicWorkflowPanel`) và v2 §9 P4 (`TopicBuilderTabs.tsx` — chốt KHÔNG sửa) **không thể cùng đúng**, vì file đó là nơi duy nhất render panel. `progress.md` đã ghi nợ mục (5). Bản này đóng khoản nợ đó.

### 4.2 Giả định

* Hai tab hiện tải **đủ** danh sách card/bài tập để đối chiếu note (không phân trang/filter phía server — đã xác nhận §3.1). Nếu sau này có phân trang, badge phải lọc theo tập đã tải.
* `TopicReviewNotesProvider` vẫn bao ngoài `TopicBuilderTabs`. Nếu cấu trúc đó đổi, P6 phải cập nhật lại `page.tsx` và §4.1 mất hiệu lực.

### 4.3 Câu hỏi mở (không chặn)

**Ghi chú trên topic đã `published`.** Policy insert chỉ đòi `has_topic_review_access(topic_id)` và `removed_at is null` — **không** kiểm `status` ([`20260917120000:173-181`](supabase/migrations/20260917120000_d1_review_notes.sql#L173-L181)). Nghĩa là theo contract hiện tại vẫn ghi được note vào topic đã published. **Bản này không đổi hành vi đó**; ghi lại để không phải phát hiện lại. Cần Owner chốt nếu muốn siết.

---

## 5. Thiết kế

### 5.1 Ràng buộc gating — cái bẫy phải tránh

`readOnly` mà `TopicBuilderTabs` truyền xuống hai tab là `!workflow.canEdit || workflow.status === "pending"` (§3.1, ba call site).

**Affordance ghi chú TUYỆT ĐỐI không được gate bằng `readOnly`.** Một previewer có `can_review_topics = true` nhưng `canEdit = false` là **đúng đối tượng của tính năng này** (v2 §5.6: quyền viết note là `has_topic_review_access`). Gate bằng `readOnly` sẽ khoá mất đường ghi của chính reviewer — vô hiệu hoá tính năng trong khi test vẫn xanh.

| Thứ | Gate bằng |
| --- | --- |
| Badge (đọc) | `notes !== null` **và** `canRead` — xem §5.2 |
| Ô soạn + nút gửi | `canReview` từ context note |
| Nút Sửa/Xóa một note | `note.author.userId === currentUserId` (như hiện tại) |

### 5.2 Badge: vị trí và điều kiện hiện

**Vị trí — không đặt trong toolbar hover.** Toolbar card là `hidden … group-hover:opacity-100 md:flex` ([`:167`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/FlashcardTab.tsx#L167>)). Đặt badge vào đó thì **trên mobile badge biến mất hoàn toàn** (`hidden`), desktop phải hover mới thấy — ngược mục tiêu "nổi bật một tí".

⇒ Badge đặt ở **vùng thân/header luôn hiển thị** (card: cạnh khối `:153-166`; exercise: trong khối header `:617-651`), **không** nằm trong khối `hidden md:flex`, **không** phụ thuộc `group-hover`.

**Điều kiện hiện badge (cả ba phải đúng):**

1. `notes !== null` — nếu `null` (đường đọc lỗi) thì **không** render badge và **không** crash.
2. `canRead === true`.
3. Số ghi chú **đang hoạt động** của đích đó `> 0`.

### 5.3 Badge đếm gì — tombstone không tính

Vì tombstone vẫn được trả về (§3.5), đếm `notes.length` sẽ làm badge phình vì ghi chú đã xoá. **Badge đếm số note có `removedAt === null`.**

Popover thì **vẫn hiện tombstone** (v2 A7) — đọc và đếm là hai ngữ nghĩa khác nhau, và cả hai đều phải đúng.

### 5.4 Không nhân đôi JSX

Phần render một note (avatar, tên, thời gian, nhãn "đã chỉnh sửa", nhãn đích, tombstone, nút Sửa/Xóa) hiện nằm trong `TopicReviewNotes.tsx`. Sau thay đổi nó cần xuất hiện ở **hai** chỗ (panel + popover). Phải **tách phần dùng chung**, không copy — nếu không sẽ có hai bản logic lệch nhau dần (vi phạm Rule 2 và Rule 11).

Đề xuất: tách `ReviewNoteList`, `ReviewNoteComposer`, và hook `useTopicReviewNotes()` export từ `TopicReviewNotes.tsx` (giữ một chủ sở hữu ngữ nghĩa). Hook trả `null` khi thiếu provider — theo pattern hiện có ([`:97`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicReviewNotes.tsx#L97>)), để tab không vỡ nếu sau này dùng ngoài provider.

### 5.5 Bố cục

```txt
FlashcardTab — một thẻ
┌────────────────────────────────┐
│         resilient              │
│        (adj) /rɪˈzɪliənt/      │
│          kiên cường            │
├────────────────────────────────┤
│ 💬 2 ghi chú          ← badge, luôn hiển thị, bấm mở popover
└────────────────────────────────┘
        ↓ bấm
┌─ Popover ────────────────────────────┐
│ 2 ghi chú                            │
│ ──────────────────────────────────── │
│ (A) Admin · 03:46 · 18/09/2026       │
│     Thiếu nội dung                   │
│ ──────────────────────────────────── │
│ (B) Editor · 04:02 · 18/09/2026      │
│     Phiên âm sai                     │
│     [Sửa] [Xóa]        ← chỉ note mình
│ ──────────────────────────────────── │
│ ┌──────────────────────────────────┐ │
│ │ Ghi chú cho thẻ này...           │ │  ← chỉ khi canReview
│ └──────────────────────────────────┘ │
│                      [Gửi ghi chú]   │
└──────────────────────────────────────┘
```

`ExerciseTab` dùng cùng badge + popover, gắn `exercise_id`, đặt trong khối header bài tập.

### 5.6 Định dạng thời gian

Hiện panel dùng `formatRelativeTime` → `"3 phút trước"` ([`:50-68`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicReviewNotes.tsx#L50-L68>)). Owner cho mẫu tuyệt đối: *"bởi admin vào lúc **03:46 18/09/2026**"*, khớp định dạng v2 §5.5 đã chốt cho lịch sử từ chối.

⇒ Ghi chú chuyển sang **`HH:mm · dd/MM/yyyy` 24 giờ** (`hour12: false`), dùng lại convention v2 §5.5.

**Đây là thay đổi hành vi hiển thị so với v2 §6.6.b** (vốn ghi "thời gian tương đối") — ghi rõ để reviewer không coi là hồi quy.

---

## 6. Delta contract — sửa đúng các mục này của v2

| Mục v2 | Sửa thành |
| --- | --- |
| §1.1 #4 | Nêu rõ ghi chú gắn đích được **tạo tại chỗ trên card/bài tập**, không chỉ cấp topic |
| §5.6 | Thêm dòng **"Đường tạo"**: đích do **ngữ cảnh UI** quyết định; người dùng không chọn đích từ danh sách |
| §6.5 | Ghi nhận `createReviewNote` **đã** nhận `cardId`/`exerciseId` → action **không** sửa |
| §6.6 | **Viết lại.** Thêm tiểu mục affordance tại chỗ (badge + popover + compose); thêm ngữ nghĩa đếm §5.3; mô tả lại panel theo D17; ghi rõ gating §5.1 |
| §6.6.b | Đổi "thời gian tương đối" → `HH:mm · dd/MM/yyyy` (§5.6) |
| **§9 P4 `Out of scope`** | **Gỡ câu** *"`TopicBuilderTabs.tsx` — chốt: KHÔNG sửa"* — nó mâu thuẫn với v2 §6.5 (đã ghi nợ ở `progress.md` mục 5). Đưa **`FlashcardTab.tsx`** và **`ExerciseTab.tsx`** vào Scope. **`TopicBuilderTabs.tsx` vẫn không cần sửa** cho v3 |
| §11.2 | Sửa assertion `{ topicId, body }`; thêm test cho đường tạo gắn đích + badge + đếm tombstone |
| §11.3.3 | Thêm M12–M16 (note gắn đích **trên UI**) — đóng đúng gap mà browser QA đã ghi |
| §12 | Thêm A14–A22; cập nhật **A11** cho khớp danh sách §9 mới |
| §14.1 | Thêm R8–R12 |

---

## 7. Commit độc lập của Owner — thay đổi Tailwind

**Đây không thuộc contract v3.** Ghi lại vì nó ảnh hưởng kế hoạch commit.

`TopicBuilderTabs.tsx` đang có thay đổi **của chính Owner**: chuyển important-modifier Tailwind sang cú pháp v4 (`!h-auto` → `h-auto!`). Bằng chứng: 4× `h-auto!`, **0** `!h-auto`; `TabsList` dòng [`:295`](<app/(teacher)/teacher/courses/[id]/topics/[topicId]/_components/TopicBuilderTabs.tsx#L295>) là `flex! h-auto! w-full!`.

**Thay đổi này làm vỡ một assertion đọc source** — đã chạy và xác nhận:

```
❯ __tests__/components/course-workspace-routes.test.tsx:1523:36
   1523|     expect(topicBuilderTabsSource).toContain("!h-auto");
```

Full suite: **`1 failed | 524 passed` (62 files, 525 tests)** — **chỉ** fail tại dòng 1523. Guard `course-workspace-routes.test.tsx` không render component; nó `readFileSync` rồi `toContain`, nên ghim **nguyên văn chuỗi class**.

**Hệ quả cho kế hoạch commit:** dòng 1523 phải đổi `"!h-auto"` → `"h-auto!"`, và hunk đó thuộc **commit Tailwind của Owner**, không thuộc commit artifact v2. File test này mang **cả hai** loại thay đổi (3 dòng thêm của v2 ở `:1416-1419` **và** dòng 1523) ⇒ cần **hunk staging**.

**Không** phải mọi assertion trong file này đều vỡ: `"group-hover:opacity-100 md:flex"` ([`:1536`](__tests__/components/course-workspace-routes.test.tsx#L1536)) và `"hidden gap-2 md:flex"` ([`:1546`](__tests__/components/course-workspace-routes.test.tsx#L1546)) chỉ vỡ nếu P7/P8 sửa **chính chuỗi class đó** — mà §5.2 đặt badge **ngoài** toolbar, nên không cần sửa. Tương tự `'readOnly={!workflow.canEdit || workflow.status === "pending"}'` ([`:1548-1550`](__tests__/components/course-workspace-routes.test.tsx#L1548-L1550)) chỉ vỡ nếu `TopicBuilderTabs` đổi — mà §3.1 kết luận file đó **không** cần sửa.

---

## 8. Scope, và scope bị cấm

### 8.1 Trong scope (P6–P10)

| Path | Việc |
| --- | --- |
| `_components/TopicReviewNotes.tsx` | Export hook; tách `ReviewNoteList` + `ReviewNoteComposer`; đổi định dạng thời gian (§5.6) |
| `_components/FlashcardTab.tsx` | Badge + popover trên mỗi thẻ (§5.2, §5.5) |
| `_components/ExerciseTab.tsx` | Badge + popover trên header bài tập (§5.2, §5.5) |
| `_components/TopicWorkflowPanel.tsx` | Chỉ nếu P9 cần để panel dùng lại phần tách ra |
| `__tests__/components/topic-review-notes.test.tsx` | Sửa assertion `{ topicId, body }`; thêm case |
| `__tests__/components/` (file mới) | Test badge + popover + gating |

### 8.2 Bị cấm

| Path / việc | Lý do |
| --- | --- |
| `supabase/migrations/**` | D18 — không có migration nào |
| `supabase/seed.sql` | Ngoài contract v3 |
| `lib/schemas/review-notes.ts`, `app/actions/review-notes.ts` | Đã đủ (§3.3) |
| `types/database.ts` | Không đổi DB shape |
| `_components/TopicBuilderTabs.tsx` | Không cần cho v3 (§3.1) |
| `components/ui/**` | Primitive đã đủ (§3.4) |
| Ghi chú gắn câu hỏi / nhóm ngữ liệu | D18 |
| Chất lượng UI của khối không liên quan trong hai tab | Rule 3 |
| Gỡ `formatRelativeTime` nếu còn dùng nơi khác | Kiểm trước khi xoá |
| Package / animation library mới | Convention repo |

### 8.3 Skill và semantic owner

`frontend-design` (D17 — tiêu chí chất lượng UI), `frontend-workflow` (không đổi DB/action nên nhẹ), `test-quality-strategy`, `code-commenting-and-maintainability`, `git-checkpoint-workflow`.

Semantic owner: `TopicReviewNotes.tsx` giữ **một** chủ sở hữu cho hình dạng một note; badge/popover chỉ tiêu thụ.

---

## 9. Phases, dependency, và writer boundary

| # | Phase | Scope | Acceptance |
| --- | --- | --- | --- |
| **P6** | Tách phần dùng chung | `TopicReviewNotes.tsx` — **không đổi hành vi** | `tsc` sạch; test hiện có vẫn xanh (trừ assertion §7) |
| **P7** | Affordance trên FlashcardTab | `FlashcardTab.tsx` | Badge đúng số note hoạt động theo `card.id`; tạo note gắn **đúng** `cardId`; hiện cả trên mobile |
| **P8** | Affordance trên ExerciseTab | `ExerciseTab.tsx` | Như P7 với `exercise.id`; đặt ở header bài tập, **không** đụng nhánh groups/questions |
| **P9** | Polish panel theo D17 | `TopicReviewNotes.tsx` (+ `TopicWorkflowPanel.tsx` nếu cần) | Bỏ cảm giác form-quản-trị; nút Sửa/Xóa không phơi ra danh sách; thời gian theo §5.6 |
| **P10** | Verification | Tests + manual QA | §10 |

**Dependency:** P6 → P7, P8 (cùng dùng phần tách ra) → P9 (cùng file với P6, sau P6) → P10 cuối.
P7 và P8 **song song được** sau P6 (hai file khác nhau), nhưng managed workflow **serialize** writer candidate — Main cấp một writer tại một thời điểm.
**Không** phase nào chạm DB ⇒ không cần `db reset`, không cần migration chain.

**Writer boundary:** P6–P9 là writer tuần tự trên candidate; P10 chỉ đọc + chạy test.

---

## 10. Verification

### 10.1 Test phải thêm

| File | Nội dung |
| --- | --- |
| `__tests__/components/` (mới/mở rộng) | Badge hiện đúng số note **hoạt động** theo `cardId`/`exerciseId`; thẻ không có note **không** hiện badge; **note đã xoá mềm không tính vào badge** (§5.3) nhưng **vẫn hiện** trong popover; `notes === null` → không badge, không crash; popover mở ra đủ tác giả + thời gian + nội dung; ô soạn **chỉ** hiện khi `canReview`; gửi note → `createReviewNote` được gọi **kèm `cardId`/`exerciseId` đúng** |
| | **Case gating §5.1:** `canReview: true` + `readOnly: true` (previewer-reviewer) → **vẫn** thấy ô soạn. Test này bắt đúng cái bẫy đã nêu |
| `__tests__/components/topic-review-notes.test.tsx` | Sửa assertion `{ topicId, body }`; note gắn đích **vẫn** hiện trong panel kèm nhãn (D19) |

### 10.2 Deterministic (đã chạy, còn hiệu lực)

| Check | Kết quả |
| --- | --- |
| `npm.cmd run test:run` | `1 failed \| 524 passed` (62 files, 525 tests) — **chỉ** fail ở `course-workspace-routes.test.tsx:1523` (§7) |

### 10.3 Manual QA — bổ sung vào state matrix v2 §11.3.3

Fixture readiness của v2 là **`NOT READY`** (v2 §11.3.1) — điều kiện chặn browser QA **không đổi**, bản này **không** tự nới.

| # | Actor | Việc làm | Kỳ vọng |
| --- | --- | --- | --- |
| M12 | previewer `can_review_topics=true` | Bấm badge trên thẻ **chưa có** ghi chú | Popover mở, soạn được, note lưu gắn **đúng** `card_id` |
| M13 | previewer | Bấm badge trên một **bài tập** | Như M12 với `exercise_id` |
| M14 | editor `can_review_topics=false` | Xem cùng thẻ | **Thấy** badge + đọc note; **không** thấy ô soạn |
| M15 | previewer | Mở panel tổng hợp | Note vừa tạo ở M12 **có mặt** kèm nhãn `Flashcard: <từ>` (D19) |
| M16 | mọi actor | Thu nhỏ **375px** | Badge **vẫn hiện** (không bị `hidden md:flex` nuốt) |

### 10.4 Ranh giới bằng chứng

Được phép khẳng định: hành vi component qua RTL; cấu trúc UI qua đọc source; kết quả test đã chạy.

**Không** được khẳng định: rằng hành vi gắn đích đã được kiểm trên browser thật cho tới khi fixture v2 §11.3.2 đủ **năm** actor; rằng E2E smoke phủ flow này; rằng `PASS` của reviewer là Owner approval.

---

## 11. Acceptance criteria (nối tiếp A1–A13 của v2)

| # | Tiêu chí |
| --- | --- |
| A14 | Người có quyền review tạo được ghi chú gắn `card_id` **từ UI ngay trên thẻ**, không qua bộ chọn đích nào. |
| A15 | Người có quyền review tạo được ghi chú gắn `exercise_id` từ UI ngay trên header bài tập. |
| A16 | Thẻ/bài tập có **note đang hoạt động** hiện badge kèm đúng số lượng; thẻ chỉ có tombstone **không** hiện badge (§5.3). |
| A17 | Ghi chú gắn đích hiện ở **cả** popover tại chỗ **và** panel tổng hợp (D19), cùng thời điểm ghi. |
| A18 | Thời gian ghi chú render `HH:mm · dd/MM/yyyy` 24 giờ (§5.6). |
| A19 | Previewer-reviewer (`canReview: true`, `readOnly: true`) **vẫn** thấy ô soạn — chứng minh affordance không bị gate nhầm bởi `readOnly` (§5.1). |
| A20 | Badge hiện ở **375px** (không nằm trong khối `hidden md:flex`). |
| A21 | `supabase/migrations/` **không đổi** (D18). |
| A22 | Danh sách §9 của v2 đã gồm `FlashcardTab.tsx`, `ExerciseTab.tsx`, `course-workspace-routes.test.tsx` — nếu thiếu, A11 của v2 tự mâu thuẫn. |

---

## 12. Rủi ro

| # | Rủi ro | Tác động | Giảm thiểu | Lộ ra sớm nhất |
| --- | --- | --- | --- | --- |
| R8 | Gate affordance bằng `readOnly` thay vì `canReview` | Reviewer mất đường ghi note; test dễ vẫn xanh nếu thiếu case A19 | Test A19 **bắt buộc**, không tuỳ chọn (§10.1) | P7 |
| R9 | Badge đặt trong toolbar hover (`hidden md:flex`) | Mobile mất hẳn affordance; desktop phải hover | §5.2 + M16 | P7 |
| R10 | Nhân đôi JSX render note giữa panel và popover | Hai bản lệch nhau dần | P6 tách phần dùng chung **trước** P7/P8 | P6 |
| R11 | Badge đếm cả tombstone | Badge phình vì ghi chú đã xoá | §5.3 + test A16 | P7 |
| R12 | Fixture v2 `NOT READY` ⇒ A14–A20 chỉ có bằng chứng RTL, không browser | Không chứng minh được hành vi thật | Ghi thẳng §10.4; **không** nới fixture readiness | P10 |

---

## 13. Mismatch routing, rollback, stop

**Mismatch routing:**
* Implementor thấy repo khác contract v3 ⇒ `PLAN_CONTRACT_MISMATCH`, dừng mutation phụ thuộc, giữ nguyên partial state, trả bằng chứng nhỏ nhất. Main resume **đúng Planner gốc**.
* Nếu conflict chạm contract v2 (upstream) ⇒ `MASTER_PLAN_CONTRACT_MISMATCH`, dừng việc tầng dưới, route read-only Master Plan Correction nếu upstream đã đóng, rồi `OWNER_DECISION_REQUIRED`.
* Reviewer thấy candidate đổi byte ⇒ `BLOCKED(candidate_moved)`. Ghi ngoài artifact path ⇒ `BLOCKED(reviewer_scope_violation)`. Artifact bị tracked/staged ⇒ `BLOCKED(review_artifact_git_scope_violation)`.

**Rollback:** mọi phase là local, không DB, không remote ⇒ revert commit là đủ. Không có migration để rollback.

**Stop conditions:** dừng và báo Owner khi cần quyết định về (a) ghi chú trên topic `published` (§4.3); (b) mở rộng đích xuống câu hỏi (D18); (c) gate affordance bằng gì nếu §5.1 bị chứng minh sai; (d) correction budget cạn (rereview round 2 vẫn còn blocking).

**Progress ownership:** `docs/refactors/student-user-flow-route/progress.md`. Sau `PASS` được admit: commit implementation trước, rồi commit **progress-only** ghi hash implementation. Tracker **không** ghi hash của chính commit chứa nó và **không** ghi trạng thái tạm.

---

## 14. Handoff cho implementation (sau khi Owner approve)

Một Implementor mới, **không** kế thừa lịch sử phiên, nhận: contract v3 này + v2 (nền) + authority snapshot §0.

Những gì Implementor **không** được tự suy diễn:
* Đích ghi chú — D18 chốt card + exercise.
* Gate — §5.1 chốt `canReview`, **không** `readOnly`.
* Badge đếm gì — §5.3 chốt loại tombstone.
* Vị trí badge — §5.2 chốt ngoài toolbar hover.
* Định dạng thời gian — §5.6 chốt `HH:mm · dd/MM/yyyy`.
* Danh sách path — §8.1/§8.2.

Những gì Implementor **phải** tự kiểm trước khi code:
* Số dòng `ExerciseTab.tsx` (§3.2) — chưa được Main đối chiếu trực tiếp.
* `formatRelativeTime` còn dùng nơi khác không, trước khi xoá.

**Chưa** được cấp authority để implement. Cần Owner approve v3 sau khi review xong.
