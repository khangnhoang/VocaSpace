---
title: "D4 — Topic completion server truth"
wave: D4
branch: feat/student-flow-d4-topic-completion
base: "main @ fb8030f (merge PR #117, D3)"
dependency: "D3 merged through PR #117 and its three migrations applied to hosted on 2026-10-02"
parent: ../../plan.md
progress: ../../progress.md
problems: ../../problems.md
---

# D4 Implementation Plan — Topic completion server truth

## 1. Trạng thái và quyền hiện tại

- Agent soạn plan ngày 2026-10-02 trên nhánh `feat/student-flow-d4-topic-completion`, tạo từ `main` tại `fb8030f`. Nhánh này sẽ chứa cả plan lẫn implementation của D4.
- Owner chỉ giao **lập plan**. Chưa có quyền implement, commit, push, PR, merge, `db push` hay thao tác hosted DB; mỗi quyền cần Owner cho riêng. Plan cần Owner duyệt (và nên qua review độc lập như D3) trước khi implement.
- Cập nhật 2026-10-02: Owner cấp quyền implement và commit local trong suốt task. Push, PR, merge, `db push` và thao tác hosted DB vẫn cần Owner cho riêng.
- Kích thước: **large**. D4 chạm migration + RLS + RPC, ba Server Action learner, DTO và UI của Learning Workspace. Làm một PR dọc, chia checkpoint C1–C4 (§7).

## 2. Binding Spec

### 2.1 Outcome

`user_topic_progress.is_topic_completed` trở thành **sự thật do server suy ra**. Topic chỉ hoàn thành khi learner đã enroll:

- đã ôn mọi flashcard active,
- đã qua memory check (nếu topic có),
- đã trả lời đúng mọi câu hỏi active của mọi exercise active.

Client không còn tự khai "xong stage". Learner không còn ghi thẳng bảng progress qua Data API. Learner thấy được mọi câu hỏi phải làm, kể cả câu standalone (Part 5). Thông báo "hoàn thành bài học" chỉ hiện khi server xác nhận. Đây là phần thực thi Owner Decision 14 và đóng `PROGRESS-001`.

### 2.2 Quyết định Owner (2026-10-02)

1. **Câu bắt buộc:** mọi câu active của mọi exercise active (stage `exercise`) đều bắt buộc, và phải trả lời **đúng**; sai thì làm lại. Không thêm cờ "required".
2. **Flashcards:** xong khi **mọi thẻ active của topic đã được ôn ≥1 lần**, tức là learner có dòng `user_flashcards` cho thẻ đó. Server tự suy ra. Preview không bị ảnh hưởng, vì Preview không gọi action ghi nào.
3. **Giữ hoàn thành:** khi `is_topic_completed` đã `true` thì giữ nguyên, kể cả khi teacher thêm nội dung sau đó; `completed_at` giữ mốc lần đầu.
4. **Câu standalone:** sửa workspace để hiện câu exercise có `group_id = null` (Part 5) ngay trong D4.
5. **Chặn ghi trực tiếp:** chặn learner INSERT/UPDATE `user_topic_progress` qua Data API; server ghi qua RPC. Ghi trực tiếp vào các bảng learner khác vẫn thuộc `LEARNING-INTEGRITY-001`.

Các quyết định có sẵn vẫn áp dụng:

- Decision 14 (đã sửa theo Decision 15 ở D3): memory check chỉ bắt buộc khi topic có.
- D3 H3/G3/G7: "đúng" được suy ra từ option learner chọn cộng với đáp án hiện hành; không đọc cột `is_correct` đã lưu.
- Q7: mọi ghi learning state cần enrollment.
- D2: Preview không ghi learning state.

### 2.3 Scope

- Migration:
  - một hàm suy ra trạng thái hoàn thành;
  - một RPC đồng bộ `user_topic_progress`;
  - bỏ policy INSERT/UPDATE của learner trên `user_topic_progress`.
- Server Actions:
  - `submitCardReview` và `submitQuestionAnswer` đồng bộ progress sau khi ghi, rồi trả trạng thái đã suy ra;
  - bỏ đường "client khai stage" (`updateStageProgress`);
  - chấm câu exercise theo option được chọn.
- Workspace DTO:
  - thêm câu standalone;
  - map `answers` của exercise dùng cùng predicate "đúng hiện hành";
  - đồng bộ progress khi mở topic chưa hoàn thành.
- Workspace UI:
  - render câu standalone;
  - thông báo hoàn thành theo server;
  - cuối chuỗi bài tập báo số câu còn thiếu và cho quay lại câu đó.
- Thêm fixture vào seed; viết integration, action và component tests; chạy browser QA; Owner review kết quả chạy thật.

### 2.4 Non-goals

- `LEARNING-INTEGRITY-001`. Các lỗ sau vẫn còn mở:
  - learner đọc được `question_options.is_correct`;
  - learner ghi thẳng `user_question_answers` (kể cả `selected_option_id` đúng) hoặc `user_flashcards` để "đủ điều kiện";
  - ràng buộc option thuộc đúng câu;
  - tính nhất quán course ID giữa các bảng.

  D4 không claim chặn những điểm này (§8).
- Cờ "câu bắt buộc/tùy chọn", trọng số, điểm phần trăm, lịch sử nhiều lượt làm.
- Bỏ trạng thái hoàn thành khi nội dung đổi (Owner chọn giữ), và mô hình revision.
- Cổng server "phải xong flashcards mới được làm memory check/exercise" (Owner chưa yêu cầu; D3 cũng loại).
- Thay đổi cổng memory check của D3, FSRS/`ReviewSheet`, UI dashboard/overview (vẫn đọc `is_topic_completed` như cũ), analytics D5.
- Animation/polish trang học (`FEAT-008`).

### 2.5 Execution guardrails

Mỗi guardrail kèm failure mode nếu bỏ qua.

- **G1 — Hoàn thành chỉ suy ra từ dữ liệu server.**
  - Nguồn duy nhất: thẻ, câu và option active do teacher sở hữu, cộng với dòng `user_flashcards` và `selected_option_id` của learner.
  - Không đọc lời khai stage của client.
  - Không đọc cột `user_question_answers.is_correct`.
  - Không đọc cờ stage đã lưu để quyết định "xong", trừ việc giữ `true` theo G4.
  - *Nếu bỏ:* client hoặc Data API khai "xong" là topic hoàn thành — đúng triệu chứng của `PROGRESS-001`.
- **G2 — Tập câu bắt buộc khớp với tập câu learner được thấy.**
  - Câu được tính khi:
    - câu chưa bị xóa;
    - exercise cha active, có stage `exercise` và thuộc topic đang xét;
    - `exercise.course_id` và `question.course_id` bằng course của topic. Workspace đang lọc đúng như vậy (`learning-workspace.ts:268-300`);
    - nếu câu có `group_id` thì group chưa bị xóa và thuộc đúng exercise đó;
    - câu standalone cũng được tính.
  - Workspace DTO và hàm SQL phải dùng **cùng** định nghĩa này.
  - *Nếu bỏ:* có câu bắt buộc mà learner không thấy, nên topic không bao giờ hoàn thành. Hoặc ngược lại: learner thấy câu không được tính.
- **G3 — "Đúng" có một nghĩa duy nhất ở mọi nơi.**
  - Định nghĩa: option learner đang chọn còn active, thuộc đúng câu đó, và hiện có `is_correct = true`.
  - Phải áp dụng như nhau ở:
    - chấm điểm (`submitQuestionAnswer`, cho cả câu memory check lẫn câu exercise);
    - map `answers` của DTO;
    - hàm suy ra trong SQL.
  - *Nếu bỏ:* UI báo sai nhưng completion tính đúng, hoặc ngược lại. Ví dụ: câu có hai option đúng thì hiện nay learner bị báo sai.
- **G4 — Hoàn thành không bao giờ bị hạ.**
  - `is_topic_completed` đã `true` thì giữ `true`; `completed_at` giữ giá trị đầu tiên.
  - Nhiều lần đồng bộ chạy đồng thời hoặc lệch thứ tự không được ghi đè `true` thành `false`.
  - *Nếu bỏ:* vi phạm quyết định "Giữ hoàn thành"; dashboard nhảy lùi; race giữa hai action làm mất completion.
- **G5 — Learner không ghi thẳng `user_topic_progress`.**
  - Không còn policy INSERT/UPDATE cho `authenticated`; SELECT self-owner giữ nguyên; DELETE vẫn bị chặn như hiện nay.
  - Chỉ RPC đồng bộ được ghi. RPC tự kiểm tra:
    - `auth.uid()`;
    - read boundary Q7 hiệu lực: `private.q7_can_read_topic(p_topic_id)` (`20260923143029_q7_topic_read_and_private_media.sql:6-43`: profile chưa bị xóa, `has_course_content_read_access`, course/chapter chưa xóa);
    - điều kiện riêng của learner: topic `published` và chưa xóa, chapter cha và course chưa xóa, đúng course — áp cả với admin hay collaborator, vì helper Q7 cho họ đọc topic draft;
    - enrollment theo Q7.
  - *Nếu bỏ:* learner chỉ cần một lệnh `update is_topic_completed = true`; trái quyết định Owner 5.
- **G6 — Không mở rộng quyền đọc hay ghi khác.**
  - RPC chỉ ghi dòng progress của chính người gọi, và chỉ trả trạng thái của dòng đó.
  - Không đổi RLS của `user_question_answers` và `user_flashcards`.
  - Không đổi read boundary Q7/D2.
  - Preview vẫn không ghi gì.
  - *Nếu bỏ:* hồi quy Q7/D2, hoặc RPC thành kênh đọc/ghi dữ liệu người khác.
- **G7 — UI chỉ báo hoàn thành theo kết quả server.**
  - Toast hoặc trạng thái "hoàn thành bài học" chỉ xuất hiện khi action trả về topic **vừa** hoàn thành (hoặc DTO báo đã hoàn thành).
  - Hết chuỗi câu mà còn câu chưa đúng thì UI nói rõ còn bao nhiêu câu.
  - Bổ sung sau Owner review UI (2026-10-02): topic đã hoàn thành (theo progress đã lưu hoặc kết quả server trong phiên) luôn hiện "Đã hoàn thành" ở header workspace và dấu tích Growth Green trong danh sách chương; syllabus mang `isCompleted` của chính learner. Nút "Hoàn thành bài học" (không có tác dụng, STUDENT-007) bị bỏ; khi topic đã hoàn thành, "Bài sau" (hoặc "Về tổng quan khóa học" ở topic cuối) thành nút chính.
  - *Nếu bỏ:* lỗi QuizSidebar hiện tại — báo "hoàn thành trọn vẹn" ngay ở câu cuối của exercise đang mở — vẫn còn.

## 3. Sự thật đã xác nhận từ repository (baseline `fb8030f`)

### Server Actions

- **`updateStageProgress(topicId, 'flashcard'|'exercise')`** (`app/actions/progress.ts:78`):
  - đặt cờ stage `true` theo lời client;
  - tính `is_topic_completed = flashcard && exercise`;
  - reset `completed_at = null` khi chưa xong (không giữ hoàn thành);
  - với stage `exercise` thì áp cổng memory check D3;
  - upsert trực tiếp qua Data API (`onConflict user_id,topic_id`).
- **`submitQuestionAnswer`** (`progress.ts:184`):
  - chấm câu memory check theo `isOptionCurrentlyCorrect` (G7 của D3);
  - chấm câu exercise bằng `correctOption?.id === selectedOption.id`, tức là so với option đúng **đầu tiên**: sai khi câu có hai option đúng;
  - không tham gia completion.
- **`submitCardReview`** (`app/actions/review.ts:33`):
  - kiểm tra parent chain và enrollment;
  - update dòng `user_flashcards` nếu đã có, ngược lại insert dòng mới;
  - `user_flashcards` có unique `unique_user_card (user_id, card_id)` (`20260609114505_remote_schema.sql:1105-1106`), nên mỗi thẻ có tối đa một dòng cho mỗi learner.
  - `ReviewSheet` trên dashboard cũng gọi action này.

### Learning Workspace

- **Gọi action hoàn thành:**
  - `LearningWorkspace.tsx:139` gọi `updateStageProgress('flashcard')` khi hàng thẻ trống. Thẻ Again/Hard được đưa lại cuối hàng.
  - `QuizSidebar.tsx:122-141` gọi `updateStageProgress('exercise')` và toast "Chúc mừng bạn đã hoàn thành trọn vẹn bài học!" khi trả lời đúng câu cuối của group cuối **trong exercise đang mở**. Learner bỏ qua câu được bằng nút next.
  - `LearningWorkspace.tsx:199` toast "Bạn đã hoàn thành tất cả bài tập!" khi bấm qua câu cuối, dù có câu đã bị bỏ qua.
  - `canSkipToQuiz` (`LearningWorkspace.tsx:72`) lấy giá trị đầu từ `progress.isFlashcardCompleted`; đây chỉ là UX, không có cổng server.
- **Topic query của `getLearningWorkspace`** (`app/actions/learning-workspace.ts:455-488`):
  - chỉ đọc câu exercise **qua `question_groups`**, nên câu `group_id = null` không bao giờ tới learner;
  - map `answers` cho câu exercise lấy từ cột `is_correct` đã lưu (`learning-workspace.ts:303`), trong khi câu memory check đã dùng predicate H3 (`:333`).
- **Ngân sách query:** test `__tests__/actions/learning-workspace.test.ts:433` khóa ngân sách 3 lần `from()`.
- **Preview D2:**
  - exercise DTO có `questions` (standalone) và `groups` (`lib/schemas/public-course-preview.ts:45-46`);
  - UI làm phẳng câu standalone trước, rồi tới các group (`PublicCoursePreviewExperience.tsx:44-62`).
  - Đây là mẫu cho workspace.

### Database và RLS

- Bảng `user_topic_progress` (`20260609114505_remote_schema.sql:989`):
  - có các cờ `is_flashcard_completed`, `is_exercise_completed`, `is_topic_completed` và cột `completed_at`;
  - unique `utp_user_topic_unique (user_id, topic_id)` (`:1130`);
  - policy SELECT là self-owner (`:1617`); không có policy DELETE.
- Q7 (`20260923150243_q7_learning_target_enrollment.sql:40-55`) thay hai policy INSERT/UPDATE bằng `auth.uid() = user_id and private.q7_has_learning_target_enrollment('topic', topic_id)`.
- `__tests__/integration/q7-learning-enrollment.test.ts:181-280` **khẳng định learner đã enroll INSERT/UPDATE được `user_topic_progress`**. D4 cố ý đổi kỳ vọng này (§5.1).
- Cổng D3 có nguồn duy nhất ở TS: `lib/memory-check.ts` (`isOptionCurrentlyCorrect`, `isMemoryCheckPassed`).

### Reader của completion (không đổi)

- `app/actions/enrolled-course-overview.ts:159`
- `app/actions/learn-dashboard.ts:172`
- `lib/learn-dashboard.ts:117`

### Seed (`supabase/seed.sql`)

- Learner `3333` có progress đã hoàn thành ở các Topic `111`, `132`, `211`, `212`, `222`.
- Có dòng `user_flashcards` cho thẻ của các Topic `111`, `112`, `131`.
- Topic 3 (`131`) không có memory check, có một exercise Part 6 gồm 2 câu, chưa có progress.
- Topic 4 (`132`) đã hoàn thành nhưng 2 câu Part 6 **chưa trả lời** — fixture có sẵn cho G4.
- Exercise Part 5 duy nhất (`seed.sql:634`) nằm ở topic draft và không có câu nào.

### Hosted production (đọc 2026-10-02)

- 24 exercise active, tất cả Part 5, với 24 câu standalone và 0 câu trong group.
- 0 dòng `user_topic_progress`, 0 answer, 0 `user_flashcards`, 0 enrollment.
- Hệ quả:
  - không cần backfill;
  - nếu không sửa phần hiển thị câu standalone thì **mọi** topic production không thể hoàn thành theo G2.

## 4. Giả thuyết triển khai có biên

Có thể đổi khi triển khai, miễn là giữ §2.

- **H1 — Hàm suy ra (SQL là chủ của completion).**
  - Hàm `private.d4_topic_completion_state(p_user_id uuid, p_topic_id uuid)`, `stable`, `search_path = ''`, trả bốn cờ:
    - `flashcards_done`: không còn thẻ active nào của topic thiếu dòng `user_flashcards` của user (`not exists`; `unique_user_card` bảo đảm tối đa một dòng mỗi thẻ).
    - `memory_check_done`: theo định nghĩa H3 của D3, gồm cả các bộ lọc của `toLoadedMemoryCheck` (bộ memory check active của topic; câu active, `group_id is null`, thuộc đúng bộ).
    - `exercises_done`: mọi câu thuộc tập G2 có dòng `user_question_answers` mà `selected_option_id` thỏa G3.
    - `all_done`: cả ba cờ trên.
  - Stage không có phần tử nào thì tính là xong (chân lý rỗng). Topic published đã qua cổng D1 (≥1 thẻ và ≥1 exercise); sửa nội dung published thì D1 đưa topic về draft.
  - Cổng memory check của D3 vẫn ở TS (`lib/memory-check.ts`), không đổi. Hai bản cài đặt predicate H3 (TS cho cổng, SQL cho completion) được giữ khớp bằng **parity test** trên DB thật (§7 C1).
  - *Đã cân nhắc:*
    - chuyển cổng D3 sang gọi hàm SQL — đụng code D3 đã merge mà không cần thiết;
    - để TS suy ra completion rồi ghi — cần thêm cột hoặc quyền ghi cho learner, trái G5.
- **H2 — RPC đồng bộ `public.d4_sync_topic_progress(p_topic_id uuid)`.**
  - `security definer`, `search_path = ''`. Revoke khỏi `public` và `anon`; grant `execute` cho `authenticated`.
  - Thứ tự xử lý:
    1. Kiểm tra `auth.uid()` (lỗi `AUTH_REQUIRED`).
    2. Kiểm tra `private.q7_can_read_topic(p_topic_id)` **và** topic `published`, chưa xóa, chapter cha và course chưa xóa, đúng course (lỗi `TOPIC_UNAVAILABLE`). Dùng lại helper Q7, không tự viết lại boundary đọc.
    3. Kiểm tra `private.q7_has_learning_target_enrollment('topic', p_topic_id)` (lỗi `ENROLLMENT_REQUIRED`).
    4. Gọi H1.
    5. Upsert `on conflict (user_id, topic_id) do update`:
       - `is_topic_completed = old or all_done`;
       - `completed_at = coalesce(old.completed_at, case when all_done then now() end)`;
       - `is_flashcard_completed` và `is_exercise_completed` luôn là snapshot hiện tại của H1, kể cả khi topic đã hoàn thành. Chỉ `is_topic_completed` và `completed_at` là sticky (G4).
    6. Trả về `is_flashcard_completed`, `is_memory_check_passed`, `is_exercise_completed` (cả ba lấy từ snapshot H1), `is_topic_completed` (sau upsert) và `newly_completed` (lần gọi này chuyển `false → true`).
  - Không ép cờ stage thành `true` khi topic đã hoàn thành: `is_memory_check_passed` phải luôn khớp cổng D3 (parity H3). Nếu ép, workspace sẽ mở khóa exercise trong khi action vẫn trả `MEMORY_CHECK_REQUIRED`.
  - Gọi lại không có tác dụng phụ (idempotent). Vế `or` giữ G4 khi race; không cần advisory lock.
  - `newly_completed` phải lấy từ giá trị cũ **dưới row lock của chính lệnh ghi**: `insert … on conflict do update` đọc phiên bản mới nhất đã commit. Không lấy từ một `select` chạy trước, vì như vậy hai lần sync đồng thời có thể cùng báo `true` và toast hiện hai lần.
  - Gọi RPC trực tiếp qua Data API vô hại: RPC chỉ ghi sự thật nó tự suy ra.
  - Mã lỗi theo pattern `raise exception` của các RPC D1/D3 hiện có.
- **H3 — Migration RLS.**
  - Drop `"User_progress - Auth Insert"` và `"User_progress - Auth Update"`, không tạo lại.
  - SELECT policy giữ nguyên.
  - Không đụng grant bảng (RLS đã chặn khi không có policy).
  - Không sửa migration đã publish.
- **H4 — Server Actions.**
  - `submitCardReview` và `submitQuestionAnswer` gọi `d4_sync_topic_progress` **sau** khi ghi thành công, rồi trả thêm `topicProgress` theo schema SSOT trong `lib/schemas/learning-workspace.ts`.
  - **Cô lập mọi bước sau khi ghi.** Sau khi ghi chính thành công, mọi lỗi đọc hay sync không được rơi vào outer catch (`progress.ts:309-311`) để thành `{ error }`. Gồm: RPC lỗi; `loadMemoryCheck` ném lỗi khi tính `isMemoryCheckPassed` (`progress.ts:290-293`); lỗi bất ngờ khác.
    - Kết quả vẫn `success: true`, giữ `isCorrect`/`explanation` đã chấm, kèm `progressError` là chuỗi tiếng Việt an toàn; lỗi chi tiết chỉ ghi log server.
    - Không giả định giá trị chưa xác minh: phần nào không tính được (`isMemoryCheckPassed`, `topicProgress`) thì bỏ trống, và UI giữ trạng thái khóa/tiến độ hiện tại.
    - Không biến lần ghi đã thành công thành lỗi; cũng không im lặng.
  - Xóa `updateStageProgress` và `stageProgressInputSchema`, vì vai trò "khai stage" không còn. Caller hiện có:
    - UI: `LearningWorkspace`, `QuizSidebar`;
    - test: `__tests__/actions/progress.test.ts` và `__tests__/integration/memory-check-learner-gate.test.ts` (import dòng 4; gọi ở `:203`, `:226`, `:263`, `:267`, `:293`; assertion shape kết quả `submitQuestionAnswer` ở `:234-236`).
  - Cổng memory check D3 vẫn nằm trong `submitQuestionAnswer`. Các ca của D3 gate test chuyển sang khẳng định qua `submitQuestionAnswer` và `d4_sync_topic_progress`, không giảm độ phủ.
  - Câu exercise chấm bằng `isOptionCurrentlyCorrect` (G3).
- **H5 — DTO workspace.**
  - Thêm `questions` (standalone) vào exercise DTO, giống Preview: câu `group_id = null`, cùng embed `answers`, xếp trước các group.
  - Map `answers` của mọi câu exercise dùng `isOptionCurrentlyCorrect` với option đang chọn, không dùng `is_correct` đã lưu.
  - Khi topic hợp lệ và progress lưu sẵn chưa hoàn thành, `getLearningWorkspace` gọi `d4_sync_topic_progress` một lần, rồi dùng kết quả cho `progress`. Topic đã hoàn thành không tốn thêm lời gọi.
    - Mục đích: learner đủ điều kiện mà không có lần ghi mới (ví dụ teacher xóa câu còn thiếu rồi topic được duyệt lại) vẫn được ghi nhận khi mở topic.
    - Lời gọi này là `rpc()`, không phải `from()`, nên không phá ngân sách 3 query; test được cập nhật để khóa đúng một lời gọi `rpc` có điều kiện.
    - Lời gọi chỉ chạy trên nhánh sắp trả `status: "success"` (`learning-workspace.ts:526`), vốn chỉ đạt được khi learner đã enroll (`:425`), nên điều kiện enrollment của RPC luôn thỏa. Nếu RPC lỗi lúc tải trang: ghi log server và dùng progress đã lưu, **không** làm hỏng trang.
  - *Đã cân nhắc:* chỉ đồng bộ khi learner ghi — đơn giản hơn, nhưng learner kẹt "chưa hoàn thành" mà không còn việc gì để làm.
- **H6 — UI.**
  - **Câu standalone:** `LearningWorkspace` làm phẳng câu của exercise như Preview (`flattenQuestions`): câu standalone hiện không có passage, sau đó tới câu của từng group. Thay bộ ba chỉ số exercise/group/question bằng một chỉ số trên danh sách phẳng chỉ khi đó là thay đổi nhỏ nhất; nếu không thì giữ bộ ba và coi phần standalone là một "đoạn" không có passage.
  - **Thông báo hoàn thành:** toast "Chúc mừng bạn đã hoàn thành trọn vẹn bài học!" chỉ hiện khi kết quả action có `newly_completed`. Thẻ hết hàng thì chuyển stage như cũ, không toast "hoàn thành toàn bộ bài học" trừ khi server báo vậy.
  - **Cuối chuỗi câu khi còn câu chưa đúng:** báo "Còn x câu chưa trả lời đúng" kèm CTA "Làm câu còn thiếu", đưa tới câu đầu tiên chưa đúng. `x` tính từ map `answers` cục bộ, vốn cùng predicate G3 với server.
  - **Lỗi sync** (`progressError`): toast có sẵn "…đã lưu nhưng chưa thể ghi nhận tiến độ bài học."
  - **Consumer của kết quả action:** `LearningWorkspace` (thẻ), `QuizSidebar` (exercise) và `MemoryCheckStage` (`MemoryCheckStage.tsx:123-139`, memory check) đều xử lý `topicProgress.newly_completed` (toast) và `progressError`. Memory check có thể là bước cuối khiến topic hoàn thành, nên `MemoryCheckStage` không được bỏ qua.
  - **Ngoại lệ có chủ đích:** `ReviewSheet` trên dashboard bỏ qua `topicProgress`/`progressError`, vì đó là luồng ôn FSRS, không phải trang học topic; dashboard đọc `is_topic_completed` đã lưu khi tải lại.
  - Giữ hành vi `canSkipToQuiz`, retry câu sai và khóa câu đã đúng.

## 5. Contract theo bề mặt

### 5.1 Database (C1)

- Một migration mới, timestamp sau `20261002120000`, gồm H1 + H2 + H3. Comment tiếng Việt ngắn cho:
  - `security definer` và `search_path`;
  - vế `or` giữ hoàn thành;
  - lý do bỏ policy.
- **Integration test mới:** `__tests__/integration/topic-completion.test.ts`, chạy DB thật, gọi RPC bằng client learner. Phải phủ:
  - **Ghi trực tiếp bị chặn:** learner đã enroll INSERT và UPDATE `user_topic_progress` đều bị từ chối; SELECT vẫn đọc được dòng của mình.
  - **Nhiều exercise:** đúng hết exercise 1 nhưng chưa xong exercise 2 thì chưa hoàn thành; đủ cả hai thì hoàn thành.
  - **Câu standalone:** câu Part 5 là bắt buộc.
  - **Group bị xóa:** câu trong group đã xóa không bắt buộc.
  - **Sai rồi làm lại:** chọn sai thì chưa xong; chọn lại đúng thì xong.
  - **Hai option đúng:** chọn option nào trong hai cũng tính đúng.
  - **Giả `is_correct`:** learner tự ghi `is_correct = true` cho option sai qua Data API thì vẫn chưa xong.
  - **Flashcards:** thiếu một thẻ chưa ôn thì chưa xong; thẻ đã xóa không bắt buộc.
  - **Memory check:** topic có memory check chưa qua thì chưa xong; topic không có thì bỏ qua.
  - **Giữ hoàn thành:** teacher thêm câu bằng service role sau khi đã hoàn thành → `is_topic_completed` vẫn `true`, `completed_at` không đổi, còn `is_exercise_completed` trả `false` theo snapshot. Chưa hoàn thành mà thêm câu → cờ exercise về `false`.
  - **Parity sau khi hoàn thành:** topic đã hoàn thành, rồi teacher thêm câu memory check active → RPC trả `is_topic_completed = true` nhưng `is_memory_check_passed = false`, bằng kết quả cổng TS.
  - **Đồng thời:** hai lần sync chạy song song (`Promise.all`) không làm mất completion, và chỉ đúng một lần trả `newly_completed = true`.
  - **Tập câu G2:** câu có `course_id` lệch so với course của topic thì không bắt buộc (khớp với bộ lọc của workspace).
  - **Từ chối:** chưa enroll, topic draft, topic đã xóa, chapter đã xóa, course đã xóa, course về draft (mất quyền đọc course), profile learner bị xóa, anon → đều bị từ chối và không có dòng mới. Admin hay collaborator gọi trên topic draft cũng bị từ chối.
  - **Parity G3/H3:** với các trường hợp memory check ở trên, `isMemoryCheckPassed(loadMemoryCheck(...))` của TS bằng cờ `is_memory_check_passed` của RPC.
- **Cập nhật `q7-learning-enrollment.test.ts`:**
  - kỳ vọng INSERT/UPDATE trực tiếp `user_topic_progress` của learner đã enroll đổi từ "được" thành "bị từ chối";
  - dòng progress cần cho kịch bản revoke được tạo bằng service role;
  - mọi assertion khác của Q7 giữ nguyên.
  - Đây là thắt chặt có chủ đích theo quyết định Owner 5, không phải hồi quy Q7.
- **Seed:** theo §9.

### 5.2 Learner Server Actions (C2)

- **Thứ tự xử lý** giữ như hiện hành: parse → auth → parent chain → enrollment → cổng memory check (D3) → ghi → sync.
- **`submitQuestionAnswer`:**
  - chấm theo G3 cho cả hai stage;
  - trả `isCorrect`, `explanation`, `isMemoryCheckPassed` như D3, cộng thêm `topicProgress` và có thể có `progressError`.
- **`submitCardReview`:**
  - trả `topicProgress` sau khi ghi; lỗi sau khi ghi được cô lập như H4;
  - `ReviewSheet` bỏ qua field mới mà không lỗi (ngoại lệ có chủ đích, H6).
- **Kết quả trả về:**
  - `topicProgress` được định nghĩa bằng Zod trong `lib/schemas/learning-workspace.ts`; dùng lại `learningWorkspaceProgressSchema` nếu khớp, ngược lại mở rộng nó;
  - lỗi RPC không lộ chi tiết SQL hay Supabase.
- **Xóa:**
  - `updateStageProgress` và `stageProgressInputSchema`;
  - test của chúng trong `__tests__/actions/progress.test.ts` được thay bằng test cho hành vi mới;
  - `__tests__/integration/memory-check-learner-gate.test.ts` bỏ import và lời gọi `updateStageProgress`, cập nhật assertion shape (`toEqual` ở `:234-236`) theo contract mới; các ca cổng D3 vẫn giữ.

### 5.3 Workspace DTO + UI (C3)

- Screen type: Learning Experience (đã Accepted). D4 không tạo surface mới. Bổ sung:
  - câu standalone dùng card câu hỏi có sẵn, không có khối passage;
  - thông báo "còn x câu" kèm CTA dùng Button contract có sẵn;
  - phản hồi bằng chữ, không chỉ bằng màu.
- **Trạng thái cần xử lý:**
  - pending khi gửi;
  - lỗi sync (`progressError`) không chặn việc học tiếp;
  - topic đã hoàn thành mở lại thì không toast lại;
  - `MEMORY_CHECK_REQUIRED` vẫn đưa learner về memory check như D3.
- Responsive 320/375 px, tablet, desktop; giữ bàn phím và focus như hiện tại.
- Owner review kết quả chạy thật ở C4.

## 6. Phụ thuộc

C1 → C2 → C3 → C4. C2 cần RPC của C1; C3 cần shape kết quả của C2.

## 7. Checkpoints

Checkpoint là ranh giới review/resume, không tự động là ranh giới commit.

| Checkpoint | Outcome | Verification và điều kiện dừng |
| --- | --- | --- |
| **C1 — DB** | Migration H1–H3, seed §9, cập nhật test Q7. | **Verification:** `npx supabase db reset`; chạy `topic-completion.test.ts` (đủ các ca §5.1) và `q7-learning-enrollment.test.ts`; chưa claim toàn bộ integration xanh ở C1: `memory-check-learner-gate.test.ts` dự kiến lỗi tạm thời vì `updateStageProgress` cũ vẫn upsert trực tiếp mà RLS mới đã chặn; toàn bộ integration (hồi quy D3, D2, Q7) chạy sau C2. **Dừng nếu:** inventory cho thấy có caller ngoài hai component đã biết đang ghi thẳng `user_topic_progress`; hoặc sửa câu exercise có thể để lại câu không có option đúng nào (khi đó topic không thể hoàn thành) mà cổng D1 không chặn — cần Owner quyết. |
| **C2 — Actions** | H4. | **Action tests:** kết quả có `topicProgress`; sync lỗi trả `progressError` nhưng vẫn ghi; `loadMemoryCheck` lỗi sau khi upsert answer vẫn trả `success: true` + kết quả chấm + `progressError`, còn `isMemoryCheckPassed` bỏ trống; câu exercise có hai option đúng được chấm đúng; lỗi parse, auth hoặc enrollment không ghi và không sync; `memory-check-learner-gate.test.ts` xanh sau khi chuyển khỏi `updateStageProgress`. **Integration qua action** trên DB thật: chuỗi trả lời qua nhiều exercise dẫn tới `newly_completed` đúng một lần. |
| **C3 — Workspace** | H5 + H6. | **Action tests cho DTO:** câu standalone có mặt; `answers` theo G3; có đúng một lời gọi `rpc` khi chưa hoàn thành, 0 lời gọi khi đã hoàn thành; vẫn 3 lời gọi `from`. **Component tests:** câu standalone render không có passage; toast hoàn thành chỉ khi `newly_completed`; hết chuỗi còn câu thì hiện "còn x câu" và CTA tới đúng câu; `progressError` hiện toast; trả lời đúng câu cuối của exercise 1 **không** báo hoàn thành; `MemoryCheckStage` toast khi `newly_completed` và hiện `progressError`. |
| **C4 — Tích hợp** | Browser QA, Owner review UI chạy thật, self-review, reconcile `progress.md`/`problems.md` (đóng `PROGRESS-001`)/master plan. | `npm run test:run`; `npm run test:integration`; `npx tsc --noEmit`; eslint các file đổi; `npm run test:e2e` cho luồng learner bị ảnh hưởng: `e2e/smoke/learning-workspace.smoke.spec.ts` điều hướng qua Topic 3, nên phải kiểm lại sau khi seed thêm thẻ và Part 5. D2 E2E ghi progress bằng service role nên không bị RLS mới ảnh hưởng. Browser QA bằng Playwright CLI theo §9. Báo rõ check nào không chạy. |

## 8. Rủi ro, dừng, rollback

- **Data API (rủi ro còn lại, thuộc `LEARNING-INTEGRITY-001`):**
  - Learner đã enroll vẫn có thể:
    - tự insert `user_flashcards` cho mọi thẻ;
    - tự ghi `selected_option_id` đúng, vì đọc được đáp án;
    - rồi gọi RPC để "hoàn thành".
  - D4 chặn được việc khai thẳng cờ hoàn thành và việc ghi giả `is_correct`, nhưng không chặn được hai đường trên.
  - **Dừng** và hỏi Owner nếu cần đóng chúng trong D4.
- **Lệch predicate TS/SQL:** giảm bằng parity test C1 và việc dùng chung test case cho G2/G3.
- **Đổi contract Q7:** test Q7 đổi kỳ vọng ghi progress; ghi lý do trong PR. Mọi kỳ vọng Q7 khác phải giữ.
- **Hosted rollout:** cần quyền riêng.
  - Thứ tự đề xuất giống D3: merge rồi `db push` ngay.
  - Cửa sổ giữa migration và deploy: code cũ upsert trực tiếp sẽ bị RLS từ chối. Production đang có 0 enrollment, nên tác động thực tế bằng 0.
  - Trước khi push: chạy lại preflight đếm `user_topic_progress` **và** `enrollments` (số 0 ở §3 có thể đã đổi), rồi chạy `--dry-run`. Nếu enrollment > 0 thì báo Owner trước khi push, vì cửa sổ giữa migration và deploy sẽ có tác động thật.
- **Rollback:**
  - App D4 và RPC phải đi cùng nhau: app D4 không còn `updateStageProgress` mà cần RPC, nên **rollback chỉ DB sẽ làm app D4 hỏng** phần sync progress.
  - Thứ tự: revert và redeploy app về bản trước D4 trước; sau đó một migration mới tạo lại hai policy Q7 (định nghĩa có sẵn trong `20260923150243`) và drop RPC cùng hàm.
  - Nếu vẫn giữ app D4 thì không drop RPC.
  - Dữ liệu progress không mất.
- **Dừng khi:**
  - Owner đổi quyết định 1–5;
  - cần nới RLS hoặc boundary Q7/D2;
  - tập câu G2 không thể dùng chung một định nghĩa giữa DTO và SQL.

## 9. QA fixture readiness

- **QA type:** browser QA của learner, phụ thuộc dữ liệu.
- **Canonical fixture:** `supabase/seed.sql`.
- **Trạng thái đã có:**
  - learner `3333` enroll course `b2…001`;
  - Topic 2 có memory check và Part 6;
  - Topic 3 có Part 6, không có memory check, chưa có progress;
  - Topic 4 đã hoàn thành nhưng còn câu chưa trả lời (dùng cho G4).
- **Còn thiếu (bổ sung hẹp, làm trong C1):**
  - trên Topic 3: một exercise **Part 5 standalone** (`activity_stage = 'exercise'`) có 2 câu; một câu có **hai option đúng** (QA cho G3);
  - thêm một thẻ active trên Topic 3 mà learner `3333` chưa ôn (QA cho quyết định 2).
- **Kịch bản QA (Topic 3):**
  1. Mở topic: chưa hoàn thành.
  2. Ôn thẻ mới.
  3. Part 6: trả lời sai một câu, rồi trả lời lại cho đúng.
  4. Part 5: bỏ qua một câu.
  5. Tới cuối chuỗi: thấy "còn 1 câu" và **không** có toast hoàn thành.
  6. Bấm CTA, trả lời đúng: có toast hoàn thành đúng một lần.
  7. Reload vẫn hoàn thành; overview/dashboard tính Topic 3 là xong.
- **Kịch bản QA khác:**
  - Topic 4 vẫn hiện là hoàn thành (G4);
  - Topic 2 giữ luồng memory check của D3;
  - kiểm tra mobile 375/320 px.
- **Kết luận:** canonical fixture cần bổ sung hẹp như trên, làm trong C1.
- **Reset:** `npx supabase db reset`, và workdir E2E theo `scripts/e2e/run-e2e.mjs`.
- **Browser QA bắt đầu khi:** C1–C3 xong và seed có đủ các trạng thái trên.

## 10. State

```txt
Current Spec revision: d4/plan.md 2026-10-02 r2 (Codex review r2 PASS, đã áp advisory A5)
Current Checkpoint: C4 xong phần agent; correction sau Codex implementation review r1; chờ review r2 và Owner review UI
Status: C1–C3 implement xong, commit local `15b4f3b` (migration `20261002130000_d4_topic_completion.sql`, chỉ áp trên Supabase local). C4: browser QA §9 đạt, tự review không phát hiện lỗi mới. Lịch sử plan: tự review sửa 4 lỗi; Codex r1 FAIL (R1–R4, A1–A4) đã sửa; Codex r2 PASS, áp A5
Completed evidence (2026-10-02, tại `15b4f3b`): `npm run test:run` 75 file / 703 test; `npm run test:integration` 24 file / 263 test (gồm `topic-completion.test.ts` 12/12); `npx tsc --noEmit` sạch; eslint các file đổi sạch; `git diff --check` sạch. `npm run test:e2e:smoke` 10 pass / 4 fail, trong đó `learning-workspace.smoke.spec.ts` pass; 4 spec fail (`dashboard-return-freshness`, `exercise-authoring`, `flashcard-delete`: fixture trùng owner `course_collaborators_one_owner_idx`; `public-course-discovery`: không thấy "Xem trước tạm thời") fail y hệt trên baseline `8ca5a5c`, không do D4. Browser QA Playwright CLI, learner seed `student@gmail.com`, Topic 3: ôn thẻ mới; Part 6 sai rồi đúng; Part 5 bỏ một câu; cuối chuỗi hiện "Còn 1 câu chưa trả lời đúng", không toast hoàn thành; CTA về đúng câu, chọn option đúng thứ hai "complete" được chấm đúng (G3), toast hoàn thành đúng một lần, DB `t/t/t`; reload không toast lại; overview Topic 3 "Đã hoàn thành" (3/4), Topic 4 vẫn hoàn thành (G4); Topic 2 giữ luồng memory check D3 (3/3, mở bài tập, không hoàn thành sớm); 320/375/768/desktop không tràn ngang
Correction (2026-10-02) sau Codex implementation review r1 (phiên mới, `gpt-6.1-sol` high, 3 subagent medium; FAIL 0 Critical/2 Required/2 Advisory): R1 bỏ `explanation` khỏi DTO câu exercise (lộ đáp án trước khi trả lời); R2 CTA "Làm câu còn thiếu" dùng `Button size="lg"` theo Button contract, bỏ class ghi đè; A1 sửa dòng D4 trong master plan; A2 `completed_at` theo đúng H2 (`coalesce(cũ, case when all_done then now() end)`). Verify sau correction: `npx supabase db reset`; `npm run test:run` 75/703; `npm run test:integration` 24 file / 264 test (`topic-completion.test.ts` 13/13, thêm ca legacy thiếu `completed_at`); `tsc`, eslint các file đổi, `git diff --check` sạch. Browser QA chưa chạy lại cho CTA mới (thay đổi chỉ là style).
Correction (2026-10-02) sau Owner review UI: F5 lại không thấy topic đã hoàn thành. Thêm trạng thái hoàn thành bền theo G7 (nhãn header, dấu tích danh sách chương, cập nhật ngay khi server báo hoàn thành), bỏ nút "Hoàn thành bài học" và đẩy "Bài sau"/"Về tổng quan khóa học" thành nút chính khi đã hoàn thành (Owner chọn). Verify: `npm run test:run` 75 file / 706 test; `tsc`, eslint các file đổi, `git diff --check` sạch; browser QA Playwright CLI: Topic 3 đã hoàn thành sau reload có nhãn + dấu tích (Topic 3, Topic 4) + "Bài sau" chính; Topic 4 (cuối) có "Về tổng quan khóa học"; Topic 2 chưa hoàn thành không có nhãn, "Bài sau" phụ; 320/375 px không tràn ngang.
Open blockers or Owner decisions: Owner review UI chạy thật; quyền push/PR/merge và áp migration hosted
Next action: Owner review UI; sau đó PR khi Owner cho phép
Current authority: implement + commit local; không push, PR, merge, hosted DB
```
