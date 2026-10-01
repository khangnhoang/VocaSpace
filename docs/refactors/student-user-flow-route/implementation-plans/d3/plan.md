---
title: "D3 — Memory check"
wave: D3
branch: feat/student-flow-d3-memory-check
base: "origin/main @ 04490808849d5c55dc60267a5b62d0dffa97687f (docs reconcile 3cd831e on top)"
dependency: "D1 merged through PR #98; Q7 merged and rolled out through PR #101; D2 merged through PR #102"
parent: ../../plan.md
progress: ../../progress.md
problems: ../../problems.md
---

# D3 Implementation Plan — Memory check

## 1. Trạng thái và quyền hiện tại

- Plan do agent soạn ngày 2026-10-02 trên nhánh `feat/student-flow-d3-memory-check`. Nhánh này chứa cả plan lẫn implementation của D3.
- Review độc lập (Codex `gpt-6.1-sol`, effort high): vòng 1 FAIL, vòng 2 **PASS**. Owner đã cho quyền implement và commit local trên nhánh này với điều kiện review PASS. Plan không cấp quyền push, PR, merge, `db push` hay thao tác hosted DB; mỗi quyền đó cần Owner cho riêng.
- Kích thước: **large** — đi qua schema/RPC readiness của D1, Server Actions learner, Teacher Authoring UI, Learning Workspace UI và public preview của D2. Một PR dọc, chia checkpoint C1–C6 (§7).

## 2. Binding Spec

### 2.1 Outcome

Teacher có thể (không bắt buộc) soạn một bộ câu hỏi memory check cho từng topic. Khi topic có memory check, learner đã enroll đi theo thứ tự flashcards → memory check → exercises. Learner phải trả lời đúng **tất cả** câu memory check; câu sai được đưa lại hàng đợi cho tới khi đúng. Exercises bị khóa cho tới khi qua memory check, và server từ chối ghi đáp án exercise hoặc đánh dấu hoàn thành exercise stage khi chưa qua. Topic không có memory check giữ nguyên luồng flashcards → exercises.

### 2.2 Quyết định Owner (2026-10-02)

1. **Nội dung:** teacher tự soạn; memory check là tùy chọn theo từng topic. Đây là **sửa đổi Owner Decision 15** (trước đây ghi "bắt buộc") và phần "memory check bắt buộc" trong Decision 14. Sau sửa đổi: memory check bắt buộc với learner **chỉ khi** topic có nó.
2. **Điều kiện qua:** đúng hết; câu sai làm lại cho tới khi đúng.
3. **Khóa exercises:** khóa, server kiểm tra.
4. **Topic không có memory check:** stage được bỏ qua. Cổng request review của D1 (≥1 flashcard active, ≥1 exercise active) **không đổi**; memory check không trở thành điều kiện submit.

Các quyết định có sẵn vẫn áp dụng: Decision 16 và `MEMORY-001` (không gộp question category, answer format và activity stage vào một field), Decision 14 về completion thuộc D4.

### 2.3 Scope

- Data model phân biệt memory check với exercise theo **activity stage**, không qua `part_type`.
- Authoring: tạo, sửa, xóa bộ memory check trong Topic Builder, theo authority D1 sẵn có (draft sửa được, pending đóng băng, published theo rule D1 hiện hành).
- Readiness/review của D1 loại memory check khỏi đếm "exercise", và kiểm tra mọi câu memory check active đều trả lời được.
- Learner: workspace DTO, stage UI có retry queue, khóa exercises ở UI và server.
- D2 public preview không vỡ khi topic có memory check (§5.5).
- Fixture seed, integration/action/component tests, browser QA và Owner review kết quả chạy thật.

### 2.4 Non-goals

- Thiết kế lại completion (`is_topic_completed`, required questions, exercise-attempt semantics), lỗi QuizSidebar đánh dấu xong khi chưa làm hết — thuộc **D4** / `PROGRESS-001`.
- Chặn learner ghi trực tiếp qua Data API (`user_question_answers.is_correct`, cờ `user_topic_progress`) — thuộc `LEARNING-INTEGRITY-001` (§8).
- Cổng server "phải xong flashcards mới được làm memory check" — Owner chỉ yêu cầu khóa exercises.
- Question category/skill analytics — D5.
- Memory check có media, passage hoặc định dạng câu hỏi khác trắc nghiệm văn bản.
- Sửa lỗi learner workspace bỏ qua câu hỏi standalone của exercises (§3, báo cáo riêng).

### 2.5 Execution guardrails

Mỗi guardrail kèm failure mode nếu bỏ qua.

- **G1 — Stage tách khỏi TOEIC part.** Memory check không được mang `part_type` TOEIC, và stage không được mã hóa vào `part_type` hay `title`. *Nếu bỏ:* vi phạm Decision 16; readiness, preview và analytics sau này hiểu sai memory check là một Part.
- **G2 — Memory check không bao giờ được tính là exercise.** Không thỏa "≥1 exercise active" khi request/approve review, không hiện trong danh sách exercise của teacher, learner hay preview, không tham gia đếm exercise. *Nếu bỏ:* topic chỉ có memory check lọt qua review; learner thấy memory check trong quiz; số liệu course sai.
- **G3 — Cổng exercise do server quyết định.** Khi topic có ≥1 câu memory check active mà learner chưa qua, `submitQuestionAnswer` từ chối câu thuộc exercise và `updateStageProgress('exercise')` từ chối, không ghi DB. Trạng thái "đã qua" được server suy ra từ **độ đúng hiện hành của option learner đã chọn** (`question_options.is_correct` của option còn active), **không** đọc cột `user_question_answers.is_correct`, vì Q7 cho learner tự INSERT/UPDATE cột đó qua Data API. Cổng chỉ tin vào lựa chọn của learner (dữ liệu vốn thuộc learner) cộng với đáp án do teacher sở hữu. *Nếu bỏ:* client bỏ khóa UI là làm exercise được, trái quyết định "Khóa, server kiểm tra".
- **G4 — Mọi câu memory check active đều trả lời được trước khi topic rời draft.** Readiness request/approve kiểm tra mỗi câu có ≥2 option active và ≥1 option đúng. *Nếu bỏ:* một câu không có đáp án đúng khóa vĩnh viễn exercises của mọi learner.
- **G5 — Tối đa một bộ memory check active cho mỗi topic**, ràng buộc ở DB. *Nếu bỏ:* thứ tự và điều kiện qua trở nên mơ hồ giữa nhiều bộ.
- **G7 — Chấm memory check theo option được chọn.** Câu memory check được chấm đúng khi option learner chọn là option active có `is_correct = true`, nhất quán với chấm stateless của D2 và với cách suy ra "đã qua" ở G3. *Nếu bỏ:* teacher đánh dấu hai option đúng thì workspace bắt learner làm lại trong khi Preview báo đúng.
- **G6 — Không mở rộng quyền đọc hay ghi.** Memory check dùng đúng read boundary của exercises (RLS, Q7 enrollment, D2 preview gate) và write policy learner hiện hành. *Nếu bỏ:* hồi quy Q7/D2.

## 3. Sự thật đã xác nhận từ repository (baseline `3cd831e`)

- `exercises.part_type text NOT NULL` (`20260609114505_remote_schema.sql:811`). `create_exercise_with_content` (`20260919130000_d1_inner_create_authority.sql`) bắt buộc part type, áp `TOEIC_PART_RULES`. Câu hỏi standalone được lưu `group_id = null`; mỗi câu cần ≥2 option và ≥1 option đúng.
- `request_topic_review` (`20260919100000_d1_topic_authority_split.sql`) yêu cầu ≥1 card active và ≥1 exercise active; readiness client ở `lib/course-readiness.ts`; `approve_topic_review` ở `20260915130000_d1_correction_security_rescue.sql`. Nhiều migration D1 khác đọc `public.exercises` — cần inventory đầy đủ ở C1.
- `updateStageProgress` (`app/actions/progress.ts`) chỉ nhận `flashcard|exercise` và suy `is_topic_completed = flashcard && exercise`. `submitQuestionAnswer` kiểm tra parent chain và enrollment, upsert một dòng mới nhất mỗi câu (`onConflict user_id,question_id`) với `is_correct` do server chấm.
- `getLearningWorkspace` (`app/actions/learning-workspace.ts`) chỉ đọc câu hỏi **qua `question_groups`**; câu `group_id = null` không được đọc. Hệ quả: exercise Part 5 standalone hiện không hiện cho learner — lỗi có sẵn, ngoài phạm vi D3. Option gửi cho client không có `is_correct` (`lib/schemas/learn.ts:28`). Map `answers` chứa các câu learner đã trả lời đúng.
- `LearningWorkspace.tsx` có hai stage (flashcards, quiz); flashcard queue đưa thẻ Again/Hard lại cuối hàng, hết hàng thì gọi `updateStageProgress('flashcard')`. `QuizSidebar.tsx` gọi `updateStageProgress('exercise')` ở câu cuối nhóm cuối.
- D2 `get_public_course_preview` (`20260924120000_d2_guarded_public_preview_service.sql`) trả `part_type` cho mọi exercise và đã xử lý câu standalone; `lib/schemas/public-course-preview.ts:44` parse `part_type: z.string()`.
- RLS learner (Q7, `20260923150243_q7_learning_target_enrollment.sql`) chỉ kiểm tra self-owner + enrollment khi INSERT/UPDATE.
- `types/database.ts` là type viết tay, không phải generated.
- Design: Learning Experience và Teacher Authoring screen-types cùng Button contract đã `Accepted` (`docs/ui-design-system-and-review/index.md`). D3 thêm một stage và một section vào surface có sẵn, không tạo surface mới.

## 4. Giả thuyết triển khai có biên

Có thể đổi trong lúc làm, miễn là giữ §2.

- **H1 — Data model:** thêm `exercises.activity_stage text not null default 'exercise'` với check `('exercise','memory_check')`, không đổi được sau khi tạo. Bỏ `NOT NULL` của `part_type` và thêm check ghép đôi: stage `exercise` ⇒ có `part_type`; `memory_check` ⇒ `part_type is null`. Partial unique index `(topic_id) where activity_stage = 'memory_check' and removed_at is null` cho G5. Dữ liệu cũ tự nhận `exercise` nhờ default, không cần backfill.
  - *Lựa chọn đã cân nhắc:* bảng riêng cho memory check tránh nullable `part_type` nhưng nhân đôi question/option, RLS, RPC và preview — trái hướng "reuse" của Decision 15. Chỉ quay lại nếu inventory C1 cho thấy không cô lập được consumer.
- **H2 — Câu hỏi memory check** là câu standalone (`group_id = null`), trắc nghiệm văn bản, không media.
- **H3 — Trạng thái "đã qua" được suy ra, không lưu thêm cột:** qua khi, với mọi câu memory check active của topic, dòng `user_question_answers` mới nhất có `selected_option_id` trỏ tới option **còn active, thuộc đúng câu đó và hiện có `is_correct = true`**. Không thêm `is_memory_check_completed`, không dùng cột `is_correct` lưu sẵn (G3).
  - Lý do: tránh đồng bộ cờ thứ hai, cả hai cách đều có cùng rủi ro Data API.
  - Hệ quả có chủ đích khi teacher sửa memory check (D1 đưa topic published về draft khi sửa nội dung, rồi phải duyệt lại):
    - thêm câu mới → learner chưa trả lời đúng câu đó bị khóa exercises lại;
    - đổi đáp án đúng hoặc xóa option learner đã chọn → câu đó không còn tính là đúng, learner phải làm lại câu đó;
    - chỉ sửa chữ của câu hỏi, option hoặc giải thích mà không đổi option đúng → đáp án cũ vẫn tính;
    - xóa câu → không còn là điều kiện.
  - Đây là ứng xử nhất quán với "đúng hết" trên bộ hiện hành. Nếu Owner muốn cờ "đã qua" cố định, đó là sửa Spec.
  - `user_question_answers.is_correct` vẫn được ghi như hiện nay để tương thích, nhưng không phải nguồn của cổng.
- **H4 — Authoring:** tạo qua `create_exercise_with_content` có thêm stage trong payload; RPC từ chối part type, group, media cho stage memory. Sửa/xóa câu và option dùng lại các RPC D1 sẵn có (`sync_question_with_options`, `d1_delete_question`). Hiện **không có** đường ghi thêm câu vào exercise đã tồn tại (RPC sync trả `QUESTION_NOT_FOUND`), nên D3 thêm **một mutation hẹp** để thêm một câu standalone cùng options vào bộ memory check hiện có trong một transaction. Mutation chỉ nhận exercise stage `memory_check`, dùng đúng authority D1 (draft sửa được, pending đóng băng, published về draft như các sửa nội dung khác) và validation câu/option như RPC create. `d1_update_exercise_basic` không được đổi stage hay gán `part_type` cho memory check. UI: một section "Memory check" riêng trong Topic Builder; `ExerciseTab` lọc bỏ memory check.
- **H5 — Learner DTO:** `learningWorkspaceResultSchema` thêm `memoryCheck` (null khi topic không có, ngược lại là danh sách câu standalone kèm option không có `is_correct`) và `isMemoryCheckPassed`; `exercises` chỉ chứa stage `exercise`. Các câu memory check được coi là "đã đúng" trong DTO (dùng để dựng retry queue) phải dùng cùng predicate với H3, không dùng mapper `answers` cũ dựa trên `is_correct` lịch sử. Lỗi server ổn định `MEMORY_CHECK_REQUIRED` khi bị cổng G3 chặn.
- **H6 — Workspace UI:** thứ tự stage là flashcards → memory check → exercises. Memory check dùng retry queue giống flashcard queue: hàng đợi bắt đầu từ các câu chưa đúng (dựa vào map `answers`), câu sai hiện giải thích rồi quay lại cuối hàng. Topic không còn card active (trường hợp biên vì D1 yêu cầu ≥1 card khi submit) bắt đầu ở memory check; topic không có memory check đi thẳng vào exercises như hiện nay. Nút sang exercises bị khóa, kèm lý do, cho tới khi qua.

## 5. Contract theo bề mặt

### 5.1 Database và readiness (C1)

- Migration mới theo H1; không sửa migration đã publish.
- Inventory xác định mọi chỗ SQL/TS đọc `public.exercises` (grep `exercises` trong `supabase/migrations`, `app/`, `lib/`) và phân loại: phải lọc theo stage, phải nhận cả hai stage, hay không bị ảnh hưởng. Kết quả ghi vào §10 State.
- `request_topic_review`, `approve_topic_review`, workflow/readiness đọc bởi D1 và `lib/course-readiness.ts`: chỉ stage `exercise` thỏa yêu cầu exercise; memory check active phải qua G4.

### 5.2 Authoring (C2)

- Zod schema trong `lib/schemas/exercise.ts` có biến thể memory check không có `part_type`; Server Action parse rồi gọi RPC; lỗi RPC map sang thông báo tiếng Việt an toàn.
- Section memory check: tạo bộ, thêm/sửa/xóa câu, ≥2 option, chọn đáp án đúng, giải thích tùy chọn; empty state nói rõ đây là tùy chọn. Pending topic hiện chỉ đọc như các phần khác.

### 5.3 Learner Server Actions (C3)

- `submitQuestionAnswer`: xác định stage từ exercise cha đã kiểm tra. Câu memory check: chấm theo G7, trả `isCorrect` và giải thích như hiện nay, kèm trạng thái "đã qua" mới tính theo H3 để UI mở exercises. Cách chấm exercise hiện tại (so với option đúng đầu tiên) giữ nguyên; sai lệch đó là lỗi có sẵn, báo riêng. Câu exercise: nếu topic có câu memory check active và learner chưa qua (H3) thì trả `MEMORY_CHECK_REQUIRED`, không upsert.
- `updateStageProgress('exercise')`: cùng điều kiện, không ghi. Schema stage giữ `flashcard|exercise`; không thêm stage memory vào action này.
- Kiểm tra parse → auth → enrollment → trạng thái → mutation như hiện hành.

### 5.4 Workspace UI (C4)

Screen type: Learning Experience (đã Accepted), thêm một stage vào surface có sẵn. Brief ngắn:
- Hierarchy: một câu hỏi mỗi lần; tiến độ "đã đúng x/N"; phản hồi đúng/sai bằng chữ và icon, không chỉ màu; câu sai hiện giải thích và báo sẽ quay lại.
- Exercises bị khóa: điều hướng tới exercises hiển thị trạng thái khóa kèm lý do và CTA quay lại memory check.
- Trạng thái: loading/pending khi gửi đáp án, chống double submit, lỗi mạng giữ câu hiện tại, `MEMORY_CHECK_REQUIRED` từ server đưa learner về memory check.
- Responsive 320/375 px, tablet, desktop; bàn phím và focus theo screen-type; tôn trọng `prefers-reduced-motion`.
- Owner review kết quả chạy thật ở C6 trước khi coi UI là accepted.

### 5.5 D2 public preview (C5)

- **Mặc định đề xuất:** preview hiện memory check như một stage thoáng qua, không khóa exercises và không ghi learning state. Lý do: D2 cam kết "full topic content".
- RPC preview trả stage và để `part_type` null cho memory check; schema preview chấp nhận cặp đó; UI preview render stage này.
- **Phương án khác:** lọc memory check khỏi preview. Đây là **thay đổi contract D2** ("full topic content"), chỉ làm nếu Owner quyết định riêng. Cả hai phương án đều phải giữ D2 answer-key absence, quota/eligibility gate và zero learner-state writes.

## 6. Phụ thuộc

C1 → C2, C1 → C3 → C4, C1 → C5; C6 sau tất cả. C2 và C3/C4 có thể làm song song sau C1.

## 7. Checkpoints

Checkpoint là ranh giới review/resume, không tự động là ranh giới commit.

| Checkpoint | Outcome | Verification và điều kiện dừng |
| --- | --- | --- |
| C1 — DB + readiness | Migration H1; RPC create nhận stage; mutation thêm câu (H4); readiness/review loại memory check khỏi đếm exercise và áp G4; seed fixture (§9); inventory consumer. | `npx supabase db reset`; integration test DB thật: topic chỉ có memory check bị từ chối request review; memory check thiếu đáp án đúng bị chặn; thêm câu vào bộ hiện có thành công cho authoring group trên draft, bị từ chối khi pending, outsider hoặc stage `exercise`, lỗi giữa chừng không để lại câu dở; bộ thứ hai bị unique index chặn; memory check có `part_type` bị check chặn; exercise cũ không đổi; collaborator/previewer/outsider giữ đúng quyền D1/Q7. **Dừng** nếu inventory có consumer không cô lập được bằng lọc stage. |
| C2 — Authoring | Schema, Action, section Topic Builder (tạo bộ, thêm/sửa/xóa câu); `ExerciseTab` lọc memory check. | Schema tests (thiếu option, không có đáp án đúng, có part type); action tests (auth, pending bị chặn); component/form tests cho thêm/sửa/xóa và giữ input khi lỗi. |
| C3 — Learner actions | DTO tách `memoryCheck`; cổng G3 ở hai action. | Action + integration: chưa qua → exercise answer và exercise stage bị từ chối, không có dòng mới; qua rồi → được ghi; topic không có memory check → không đổi hành vi; thêm câu mới sau khi qua → khóa lại; đổi option đúng rồi duyệt lại → câu đó phải làm lại; chỉ sửa chữ → vẫn qua; learner tự ghi `is_correct = true` qua Data API cho option sai → cổng vẫn khóa; câu có hai option đúng → chọn option nào trong hai đều đúng; unenrolled bị từ chối như Q7. |
| C4 — Workspace UI | Stage memory check với retry queue, khóa exercises, bỏ qua khi không có. | Component tests: câu sai quay lại hàng, câu có option đã chọn bị đổi/xóa quay lại hàng sau khi tải lại, hết hàng thì mở exercises, lỗi server giữ câu, `MEMORY_CHECK_REQUIRED` đưa về memory check, topic không card/không memory check. |
| C5 — Preview | Phương án mặc định §5.5. | Integration RPC + schema test: topic có memory check vẫn trả preview hợp lệ, không lộ `is_correct`, chấm stateless câu memory check, bị từ chối khi quota/eligibility không đạt, không ghi learner rows. |
| C6 — Tích hợp | Browser QA, Owner review UI chạy thật, self-review, reconcile progress/problems/plan. | `npm run test:run`, `npm run test:integration` (focused), typecheck qua build hoặc `npx tsc --noEmit`, lint file đổi, `npm run test:e2e` cho luồng learner bị ảnh hưởng; mở rộng E2E smoke exercise authoring nếu chạm. Báo rõ check nào không chạy. |

## 8. Rủi ro, dừng, rollback

- **Data API (rủi ro còn lại):**
  - Ghi giả `is_correct` không mở được cổng nhờ G3/H3.
  - Learner đã enroll vẫn đọc được `question_options.is_correct` qua Data API (policy SELECT hiện hành) và có thể ghi thẳng `selected_option_id` đúng. Việc này tương đương "trả lời đúng" nhờ xem đáp án; không cổng server nào chặn được khi đáp án còn đọc được.
  - Learner vẫn ghi thẳng được cờ `user_topic_progress` và answer của exercise mà không qua Action.
  - Các điểm trên thuộc `LEARNING-INTEGRITY-001`; D3 không claim chặn ở DB. **Dừng** và hỏi Owner nếu cần đóng chúng ngay trong D3.
- **Consumer bỏ sót lọc stage:** rủi ro chính của H1. Giảm bằng inventory C1 và test đếm/readiness/preview.
- **Nullable `part_type`:** code TS đang coi `part_type` luôn là string. Phải cập nhật type viết tay và schema ở mọi consumer đã inventory.
- **Hosted rollout:** migration chỉ áp local. Áp lên hosted cần quyền riêng; trước đó chạy preflight đếm exercise hiện có (tất cả phải nhận stage `exercise`).
- **Rollback:** migration là additive cộng với nới `NOT NULL`. Rollback cần xóa row memory check trước khi khôi phục `NOT NULL`. Không xóa dữ liệu hosted nếu không có quyền riêng.
- **Dừng khi:** sửa đổi Decision 14/15 chưa được ghi; D1 readiness phải nới ngoài G2/G4; Q7/D2 boundary phải nới; Owner đổi H3 sang cờ cố định.

## 9. QA fixture readiness

- QA type: browser QA learner và teacher, phụ thuộc dữ liệu.
- Canonical fixture: `supabase/seed.sql`.
- Đã có: course published, learner enrolled/unenrolled, topic published có cards, teacher draft topic (D1). Seed hiện **chỉ có một exercise** (Part 5, ở topic draft) và **không có** `question_groups`, `questions` hay `question_options`, nên chưa có exercise nào learner làm thật được.
- Còn thiếu:
  - trên một topic published của course có learner enrolled: một exercise grouped hợp lệ không cần media (Part 6 có passage) với 2 câu và options, cộng một bộ memory check 3 câu;
  - một topic published khác có exercise grouped tương tự nhưng không có memory check (luồng cũ);
  - một learner enrolled đã trả lời đúng hết memory check của topic thứ nhất;
  - một draft topic có memory check để authoring.
  - Trường hợp topic không còn card chỉ cần component test. Không dùng Part 5 vì workspace đang bỏ qua câu standalone của exercise (§3).
- Kịch bản QA: chưa qua → exercises khóa → trả lời sai → câu quay lại → đúng hết → exercises mở → ghi được đáp án exercise; topic không có memory check giữ luồng cũ.
- Kết luận: **canonical fixture cần bổ sung hẹp như trên**, làm trong C1.
- Reset: `npx supabase db reset`, và workdir E2E theo `scripts/e2e/run-e2e.mjs`.
- Browser QA bắt đầu khi C1–C5 xong và fixture có đủ các trạng thái trên.

## 10. State

```txt
Current Spec revision: d3/plan.md 2026-10-02 (review r2 PASS)
Current Checkpoint: C6 — Browser QA + reconcile (xong, commit local)
Status: BLOCKED(manual_qa_pending) — C1–C6 xong; chờ Owner review UI
Completed evidence: discovery tại 3cd831e; Owner answers 2026-10-02 (§2.2); C1: migration `20261002100000_d3_memory_check_stage.sql` + seed §9 áp dụng qua `npx supabase db reset`; `memory-check-stage.test.ts` 13/13; toàn bộ integration 21 file / 240 test pass; `tsc --noEmit` sạch. C2: `MemoryCheckSection` (thêm/sửa/xóa câu, gỡ bộ khi xóa câu cuối) trong tab bài tập; `addMemoryCheckQuestion` + `getMemoryCheckByTopicId`; lọc `activity_stage = 'exercise'` ở `getExercisesByTopicId`, `getCourseStats`, readiness khóa học; workflow DTO thêm `activeMemoryCheckQuestionCount`/`isMemoryCheckReady`; panel + `topic-review` báo `TOPIC_MEMORY_CHECK_NOT_READY`; `memory-check-stage.test.ts` 14/14; unit 73 file / 675 test pass; `tsc` sạch; eslint không lỗi mới. C3: `lib/memory-check.ts` là nguồn duy nhất của predicate H3 (option đang chọn + đáp án hiện hành, không đọc `is_correct` đã lưu); `submitQuestionAnswer` chặn câu exercise bằng `MEMORY_CHECK_REQUIRED` trước khi ghi, chấm câu memory theo G7 và trả `isMemoryCheckPassed`; `updateStageProgress('exercise')` cùng cổng; workspace DTO thêm `memoryCheck`/`isMemoryCheckPassed`, `exercises` chỉ còn stage `exercise`, memory check nhúng trong topic query (giữ ngân sách 3 query); `memory-check-learner-gate.test.ts` 6/6 trên DB thật; integration 22 file / 247 test; unit 73 file / 681 test; `tsc` + eslint sạch. C4: `MemoryCheckStage` (retry queue dựng từ `answers`, câu sai hiện giải thích inline và quay lại cuối hàng, "Đã đúng x/N", icon + chữ, chống double submit, lỗi server giữ câu); `LearningWorkspace` đổi stage sang flashcard → memory → exercise, topic không card bắt đầu ở memory check, "Tới Bài tập" khi chưa qua dẫn tới trạng thái khóa có lý do + CTA "Làm memory check"; `QuizSidebar` chuyển `MEMORY_CHECK_REQUIRED` (submit và stage update) về memory check, khi map `answers` cục bộ đã đủ thì stage báo "Memory check vừa thay đổi" kèm nút tải lại; `memory-check-stage.test.tsx` 7/7; unit 74 file / 688 test; `tsc` + eslint sạch. Browser QA để ở C6. C5: migration mới `20261002110000_d3_public_preview_memory_check.sql` thay `get_public_course_preview` bằng cùng thân/gate/grant D2, chỉ thêm `activity_stage` (không sửa migration đã publish; answer RPC D2 vốn chấm stateless theo option đang chọn nên giữ nguyên); schema preview là discriminated union (`exercise` + `part_type` chuỗi | `memory_check` + `part_type` null); UI preview đặt memory check ngay sau thẻ, badge "Memory check", câu sai vẫn bỏ qua được (không khóa bài tập); `memory-check-preview.test.ts` 3/3 trên DB thật (stage + không lộ `is_correct`, chấm stateless 2 option đúng, đóng khi bỏ đánh dấu/vượt quota, 0 dòng learner); unit 74 file / 690 test; integration 23 file / 250 test; `tsc` + eslint sạch. C6 (Playwright CLI, dev server local, seed student): Topic 2 — sau thẻ vào memory check "Đã đúng 0/3", "Tới Bài tập" ra panel khóa + CTA, câu sai hiện giải thích inline và quay lại cuối hàng, 3/3 → "Mở bài tập", câu exercise được server nhận, reload vẫn mở; Topic 3 (không có memory check) giữ flow thẻ → bài tập, 0 console error; 375px/320px không cuộn ngang sau fix header wrap (`8c4c0a2`, header chồng tiêu đề ở 375px), reduced motion đã emulate; Preview Topic 2 (đánh dấu preview tạm trên DB local rồi `db reset`) — memory check đi ngay sau thẻ với badge "Memory check", câu sai "Bỏ qua câu này" được, tiếp theo là bài Part 6, 0 console error. Sau fix: unit 74 / 690; integration 23 / 250; `tsc` + eslint sạch. Không chạy browser QA cho authoring UI (C2, có component/integration test); ghi chú UX: ở stage thẻ khi đang khóa header chỉ có "Tới Memory check"; các option là tab stop riêng, không điều hướng bằng phím mũi tên. Implementation review r1 (Codex `gpt-6.1-sol` high, session mới `01a0f918`): FAIL với 4 Required, đã sửa — R1 bỏ `explanation` khỏi DTO memory check ban đầu (giải thích chỉ trả sau khi chấm); R2 CTA "Tải lại" dùng `window.location.reload()` vì `router.refresh()` giữ state queue client; R3 thêm thông báo soạn trên máy tính dưới `md` như ExerciseTab/FlashcardTab (repo cố ý chỉ cho soạn trên desktop, nên không mở điều khiển trên mobile); R4 migration `20261002120000_d3_memory_check_standalone_questions.sql` chặn group thuộc bộ memory check và câu memory check có `group_id` (trigger `MEMORY_CHECK_GROUP_NOT_ALLOWED`). Sau sửa: unit 74 / 690; integration 23 / 251; `tsc` + eslint sạch
Consumer inventory (C1): `PublicCoursePreviewExperience.tsx`, `ExerciseContext.tsx`, `AddExerciseDialog.tsx`, `ExerciseTab.tsx`, `app/actions/{course-readiness,exercise,learning-workspace,topic}.ts`, `app/api/question-group-media/[groupId]/[type]/route.ts`, `lib/course-readiness.ts`, `lib/schemas/{course-readiness,exercise,learn,public-course-preview}.ts`, `types/database.ts` (đã thêm `activity_stage`, `part_type` nullable). Readiness phía TS: `lib/course-readiness.ts` giữ nguyên, query trong `app/actions/course-readiness.ts` lọc stage `exercise` (C2). Còn lại cho C3–C5: `learning-workspace`, `ExerciseContext`, `PublicCoursePreviewExperience`, `lib/schemas/{learn,public-course-preview}.ts` (seed đã có memory check ở topic published nên learner/preview chưa đúng tới khi C3–C5 xong).
Accepted bounded deviations: (1) H4 dùng một RPC `d3_add_memory_check_question` vừa tạo bộ (câu đầu tiên) vừa thêm câu, thay cho "RPC create nhận stage" + mutation thêm câu riêng; tạo bộ rỗng không có ý nghĩa vì bộ rỗng không ảnh hưởng cổng. (2) Fixture "learner đã qua" đặt ở Topic 4 (topic learner 3333 đã hoàn thành) thay vì Topic 2, để cùng learner vẫn chạy được kịch bản khóa → mở ở Topic 2 mà không cần thêm user seed. (3) Test C3 "đổi option đúng / thêm câu sau khi qua" sửa đáp án bằng service role trên topic vẫn published, không đi lại vòng D1 demote → duyệt lại; cổng chỉ phụ thuộc đáp án hiện hành nên vòng duyệt không đổi kết quả.
Open blockers or Owner decisions: Owner review UI (workspace, authoring, preview) trước khi push/PR; Owner có thể đổi mặc định preview §5.5 hoặc ứng xử H3
Next action: Owner review UI; sau đó Owner quyết định push/PR
Current authority: implementation + local commit trên nhánh này; không push, PR, merge, hosted DB
```
