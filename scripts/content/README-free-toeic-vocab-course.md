# Khóa học TOEIC từ vựng miễn phí

Trạng thái ngày 2026-10-10: **đã COMMIT transaction và xuất bản production với ảnh bìa**, theo approval của Khang trong chat. Preflight, rehearsal local cho ảnh, postflight production, đối chiếu nội dung và public browser QA đã PASS. Kiểm tra chỉ đọc ratings/progress production đã PASS; Khang xác nhận luồng học ổn. Hiệu năng thao tác học thuộc PR khác. Branch: `feat/free-toeic-vocab-course`, từ `main` tại `7bb92ceac6ac8f55a55b57f43c0b1ebecb55accd`.

## Nội dung để duyệt

- Nội dung chuẩn: [free-toeic-vocab-basics.json](free-toeic-vocab-basics.json).
- Script: [apply-free-toeic-vocab-course.mjs](apply-free-toeic-vocab-course.mjs).
- Test giới hạn nội dung và cổng production: [apply-free-toeic-vocab-course.test.mjs](apply-free-toeic-vocab-course.test.mjs).

- Ảnh bìa được tạo bằng công cụ `image_gen` tích hợp: [free-toeic-vocab-cover.png](free-toeic-vocab-cover.png), 1448 × 1086, 1.846.577 bytes, chữ “TOEIC / 30 TỪ VỰNG”. Khang cho phép bổ sung ảnh bìa; các bài học/câu hỏi vẫn chỉ có văn bản.
- Tên: **TOEIC nền tảng: 30 từ vựng cho công việc và công tác**.
- Slug: `toeic-tu-vung-nen-tang-mien-phi`; giá `0`, miễn phí lâu dài.
- Một chương: **Từ vựng nền tảng trong môi trường làm việc**.
- Mỗi bài có 10 flashcards, 5 câu Memory check và 8 câu Part 5; tổng cộng 30 thẻ, 15 câu ôn nhớ, 24 câu Part 5, 156 lựa chọn.
- Tất cả thẻ có IPA Anh-Anh, từ loại, nghĩa tiếng Việt, ví dụ và bản dịch. Mỗi câu hỏi có bốn lựa chọn, một đáp án đúng và giải thích tiếng Việt. Chỉ có văn bản; ví dụ, câu hỏi và giải thích được biên soạn mới.

File test dùng `node:test`, chạy bằng lệnh `node --test` bên dưới. `vitest.config.ts` loại đúng file này khỏi Vitest để tránh lỗi `No test suite found`; CI hiện tại chưa có bước riêng chạy nhóm test nội dung này.

| Bài | Từ vựng |
| --- | --- |
| Công sở và công việc | office, colleague, department, employee, manager, document, equipment, deadline, submit, available |
| Cuộc họp và lịch làm việc | meeting, schedule, agenda, attend, confirm, postpone, cancel, appointment, reminder, minutes |
| Đi công tác | reservation, itinerary, departure, arrival, luggage, passport, receipt, expense, destination, delay |

Schema hiện tại chỉ có `courses.description`; đoạn đầu là giới thiệu ngắn, các đoạn sau mô tả đầy đủ đối tượng, nội dung, cách học và giới hạn khóa học. Không thêm cột để tách hai mô tả.

Phiên âm và cách dùng được đối chiếu với Cambridge Dictionary, gồm [schedule](https://dictionary.cambridge.org/us/dictionary/english/schedule?q=schedule_1), [itinerary](https://dictionary.cambridge.org/dictionary/english/itinerary), [receipt](https://dictionary.cambridge.org/pronunciation/english/receipt), [equipment](https://dictionary.cambridge.org/grammar/british-grammar/equipment) và nghĩa biên bản của [minutes](https://dictionary.cambridge.org/dictionary/english/minute). Không lấy câu ví dụ hoặc câu hỏi của nguồn này đưa vào khóa học.

## Phạm vi và cơ chế ghi dữ liệu

Khang đã chỉ định các tài khoản sau và cho phép thêm reviewer vào course mới:

| Môi trường | Owner | Reviewer |
| --- | --- | --- |
| Local | `teacher@gmail.com` | `admin@gmail.com` |
| Production | `mrkhang05k@gmail.com` | `zindemo00z@gmail.com` |

Ngoại lệ đã được Khang duyệt trong chat: được UPDATE **chỉ các row tạo mới trong cùng transaction**, để thực hiện quy trình xuất bản. Không sửa hoặc xóa dữ liệu có từ trước; không migration, DDL, RLS, reset hoặc sửa profile.

Script dùng RPC hiện hành để tạo course/chapter/topic/cards/exercises, rồi `request_topic_review` dưới danh tính owner và `approve_topic_review` dưới danh tính reviewer. Reviewer được INSERT vào course mới với role `previewer`, `can_review_topics = true`; không xuất hiện như đồng tác giả công khai. Các JWT claims chỉ đặt trong transaction của kết nối quản trị để RPC kiểm tra đúng danh tính; không tạo token hoặc đổi tài khoản người dùng.

Hai thao tác SQL trực tiếp có phạm vi rõ ràng:

1. INSERT collaborator vào đúng `course_id` vừa tạo: luồng collaborator hiện hành cần mời/chấp nhận riêng, trong khi Khang đã chỉ định reviewer cho thao tác quản trị này.
2. UPDATE course mới từ `draft` sang `published`, kèm metadata review: `acceptCourse` ở trang admin chưa có implementation. Chỉ làm sau khi cả ba topic được duyệt bằng D1 RPC.

Dry-run là transaction chỉ đọc. Rehearsal local chạy đầy đủ rồi ROLLBACK. Apply có một transaction, kiểm tra tài khoản, slug, migrations L1/LF1 và năm quan hệ L1 trước/sau; dùng advisory lock theo slug. Postflight kiểm tra số lượng, trạng thái review, metadata, đáp án duy nhất và khả năng đọc catalog/detail dưới role `anon` trước COMMIT. Receipt ghi trực tiếp toàn bộ IDs trước COMMIT và thêm `outcome: committed` sau COMMIT; không ghi đè file cũ và không tự retry.

Nếu có lỗi kết nối quanh COMMIT, trạng thái là **chưa xác định** cho tới khi đối soát chỉ đọc theo receipt/slug. Không chạy apply lần nữa để đoán kết quả. Khi slug đã tồn tại, script dừng ở `PREFLIGHT_SLUG_EXISTS`; không cập nhật khóa học cũ.

## Kết quả local

Target đã dùng: `supabase_db_voca_space`, Supabase API `http://127.0.0.1:45321`, app `http://localhost:3000`. Không sử dụng database E2E riêng và không reset.

Course ID: `f0e74888-b8d0-4834-b9f5-0b744d1eeae4`.

| Bài | Topic ID | Topic slug |
| --- | --- | --- |
| Công sở và công việc | `9e39f9b3-dee9-44ab-b508-e764e2c54ed6` | `9c9db462-2d18-480e-b46d-2e32dcfa4241` |
| Cuộc họp và lịch làm việc | `e5955e53-6454-4279-9167-43777f10349a` | `81e6e0a8-2e1b-449f-ac8a-98f618ace4d8` |
| Đi công tác | `2ff17695-1584-417a-a5e7-1e1ae717ceb3` | `25e1cec1-a0f1-42c3-9081-2736e641046a` |

Mở [khóa học local](http://localhost:3000/courses/toeic-tu-vung-nen-tang-mien-phi) để duyệt giao diện và nội dung.

| Kiểm tra đã chạy | Kết quả |
| --- | --- |
| Validator, Node unit tests, ESLint script/test | PASS; 6/6 nhóm unit test |
| Dry-run trước apply | PASS |
| Rehearsal đầy đủ và dry-run sau rollback | PASS; slug không tồn tại sau rehearsal |
| Lỗi chủ động `LOCAL_ATOMICITY_CHECK` sau toàn bộ bước tạo/xuất bản | PASS; kết nối dừng, kiểm tra lại course thử có 0 row |
| Apply local + postflight chỉ đọc sau COMMIT | PASS; 244 IDs nội dung; 1 course, 2 collaborators, 1 chapter, 3 topics, 3 author exclusions, 30 cards, 6 exercises, 0 groups, 39 questions, 156 options, 3 review submissions |
| Đối chiếu nội dung đã lưu với JSON | PASS; toàn bộ front/back của 30 thẻ, nội dung/giải thích/đáp án của 39 câu và 156 lựa chọn khớp JSON |
| Dry-run khi slug đã tồn tại | Dừng đúng `PREFLIGHT_SLUG_EXISTS`; vẫn chỉ 1 course |
| Năm quan hệ L1 trước/sau apply | Tất cả 0 row sai |
| Catalog/detail công khai | PASS; có nhãn Miễn phí, 1 chương và 3 bài |
| Học viên `student@gmail.com` đăng ký miễn phí qua UI | PASS; enrollment mới và payment `paid`, gateway `free`, `amount_original = amount_final = 0` |
| Mở cả ba bài, hiển thị thẻ/ví dụ/bản dịch | PASS với thẻ đầu mỗi bài |
| Công sở: đánh giá 10 thẻ Ổn, thử mở bài tập khi Memory check chưa xong | PASS; bài tập bị khóa |
| Công sở: trả lời đúng 5/5 Memory check | PASS; mở được Part 5 |
| Công sở: trả lời đúng câu Part 5 đầu | PASS; hiển thị giải thích tiếng Việt cả khi đúng |
| Cuộc họp: đánh giá cả 10 thẻ Lại và reload | PASS; tất cả `last_rating = 1`, hai cờ `is_flashcard_completed` và `is_topic_completed` đều false; `private.d4_topic_completion_state` cũng false |
| Công sở: trạng thái rating Ổn | `last_rating = 3` cho 10 thẻ; flashcards/memory check xong; topic chưa xong vì chỉ trả lời 1/8 Part 5 |

Bằng chứng nằm trong `C:/VocaSpace/test-results/` (ignored, không commit):

- `free-toeic-local-apply.jsonl`: toàn bộ 244 IDs nội dung và marker COMMIT.
- `free-toeic-local-rehearsal.jsonl`: IDs tạm của rehearsal đã rollback; không dùng cho rollback course thật.
- `free-toeic-local-learner-qa.jsonl`: ratings, completion state, enrollment/payment và IDs learner QA.
- `free-toeic-local-postflight.txt`: postflight chỉ đọc sau learner QA; IDs nội dung vẫn trùng receipt và năm quan hệ L1 vẫn 0 sai.
- `free-toeic-correct-explanation.png`, `free-toeic-catalog.png`: ảnh local.

Một hiện tượng UI ngoài phạm vi được quan sát khi chuyển thẻ nhanh: sau vòng đánh giá Lại, mặt trước còn `meeting` nhưng mặt sau hiển thị ví dụ/nghĩa của `minutes`. Reload hiển thị lại cặp đúng; database giữ đủ 10 ratings và cờ LF1 đúng. Chưa kết luận nguyên nhân, chưa sửa code ứng dụng. Console không có error; có warning Next.js về LCP của logo.

Ở checkpoint local, chưa kiểm thử mọi câu hỏi qua trình duyệt, giao diện mobile hoặc toàn bộ suite ứng dụng. Nội dung từng câu được rà soát; validator kiểm tra cấu trúc và đáp án duy nhất. Kết quả local không thay thế QA production; kết quả production được ghi riêng bên dưới.

Các lệnh local (đã chạy; **không apply lại vào database hiện tại**):

```powershell
node scripts/content/apply-free-toeic-vocab-course.mjs --validate
node --test scripts/content/apply-free-toeic-vocab-course.test.mjs
npx --no-install eslint scripts/content/*.mjs
node scripts/content/apply-free-toeic-vocab-course.mjs --local --dry-run --owner teacher@gmail.com --reviewer admin@gmail.com
node scripts/content/apply-free-toeic-vocab-course.mjs --local --rehearse --owner teacher@gmail.com --reviewer admin@gmail.com --manifest test-results/free-toeic-local-rehearsal.jsonl
node scripts/content/apply-free-toeic-vocab-course.mjs --local --apply --owner teacher@gmail.com --reviewer admin@gmail.com --manifest test-results/free-toeic-local-apply.jsonl
node scripts/content/apply-free-toeic-vocab-course.mjs --local --postflight --owner teacher@gmail.com --reviewer admin@gmail.com --manifest test-results/free-toeic-local-apply.jsonl
```

## Production qua Supabase CLI đã xác thực

Không có thông tin PG password trong môi trường hiện tại. CLI `db query --linked` có phiên xác thực sẵn và đã kiểm chứng hỗ trợ transaction; [publish-free-toeic-production.mjs](publish-free-toeic-production.mjs) dùng CLI này với linked project bắt buộc đúng `zmnfsorjuibfjowmjtxo`, không reset hay push migration. Các lệnh:

```powershell
node scripts/content/publish-free-toeic-production.mjs --dry-run
node scripts/content/publish-free-toeic-production.mjs --apply --owner-approved-production
node scripts/content/publish-free-toeic-production.mjs --postflight
```

Wrapper dùng cùng `buildSql` đã kiểm thử local. API keys chỉ giữ trong bộ nhớ, không in hoặc lưu file. Ảnh upload vào bucket có sẵn `course_thumbnails`, path mới `create/<owner_id>/<uuid>.png`, `upsert = false`; xác minh URL công khai trả đúng bytes trước khi tạo course. Không đổi bucket/policy hoặc cập nhật course local cũ.

CLI chỉ trả SELECT cuối, nên receipt của transport này được lấy trong cùng kết nối **sau COMMIT** qua một session setting chỉ chứa IDs/metadata (không có secret); không sửa schema. File receipt được tạo độc quyền trước khi chạy, chặn retry. Nếu kết nối mất quanh COMMIT, receipt có thể trống: chỉ đối soát read-only theo slug và các ID/path đã ghi, không chạy apply lại. Receipt ảnh riêng được ghi ngay sau upload; nếu course thất bại thì giữ path này để Khang quyết định cleanup, không tự xóa.

Preflight đã xác minh: owner `58c81cb6-10ca-448f-9379-afc742e7791d` có role teacher; reviewer `6563c9f6-70a3-4e5d-bc94-141f4691f4ea` có role admin; slug chưa tồn tại; bucket public; L1/LF1 có sẵn; năm quan hệ L1 đều 0 sai. Unit tests sau bổ sung ảnh: 7/7 PASS; rehearsal URL ảnh và receipt sau transaction local PASS.

Kết quả apply thực tế:

- [Khóa học production](https://vocaspace.com/courses/toeic-tu-vung-nen-tang-mien-phi), course ID `d16bdc42-d910-43b5-add3-eb60fd7468c3`, status published, price 0.
- Đủ 244 IDs nội dung trong `test-results/free-toeic-production-apply.jsonl`, có marker `committed`. Postflight chỉ đọc xác nhận toàn bộ IDs không đổi, đủ số lượng/review và năm quan hệ L1 vẫn 0 sai.
- Ảnh có Storage object ID `ac57a7b2-0e7c-4339-9446-6458a1c45a4f`; path `create/58c81cb6-10ca-448f-9379-afc742e7791d/3f85552b-4668-401d-8784-a7d988f21077.png`; receipt riêng `test-results/free-toeic-production-cover.json`. Tổng 245 IDs gồm nội dung và object ảnh.
- URL public của ảnh đã trả đúng toàn bộ bytes asset. Browser ẩn danh thấy ảnh tải qua Next.js image optimizer, nhãn Miễn phí, đúng 1 chương/3 bài và giảng viên Khang. Catalog cũng hiển thị course mới.
- Catalog ở 375px và 320px: ảnh tải đủ, không tràn ngang; đây là kiểm tra ảnh bìa, không phải QA toàn bộ giao diện responsive.
- Đối chiếu trực tiếp database: front/back của 30 thẻ, nội dung/giải thích/đáp án của 39 câu và 156 lựa chọn khớp JSON. Bằng chứng: `test-results/free-toeic-production-content-check.json`.
- Ảnh browser: `test-results/free-toeic-production-detail.png`, `free-toeic-production-catalog.png`, `free-toeic-production-mobile.png`.
- Agent không đăng ký hoặc tạo ratings/answers/progress bằng học viên production. Khang tự học; kết quả kiểm tra chỉ đọc được ghi bên dưới. Không thay đổi profile, role, schema, RLS hoặc dữ liệu course cũ; không deploy ứng dụng. Chỉ thêm course/ảnh mới theo phạm vi đã duyệt.

Kiểm tra tích hợp đã lần theo asset PNG → upload bucket hiện có → URL public → tham số `create_course_with_owner` → transaction/review → public read model → Next.js image optimizer → catalog/detail. Tham khảo Supabase đã áp dụng: `migration-and-seed.md` cho nội dung ban đầu, `rls-and-storage.md` cho bucket/path/quyền ảnh, `rpc-trigger-concurrency.md` cho khóa, transaction và giới hạn retry. Không tạo/sửa RPC, trigger, RLS hoặc Storage policy; verification của transport mới dùng rehearsal thật và COMMIT/postflight thật, không mock database.

Prompt cuối cho ảnh (công cụ tích hợp, không dùng CLI image generation):

> Use case: stylized-concept. Asset type: public course cover for VocaSpace, displayed as a 4:3 course thumbnail with object-cover cropping. Generate one polished landscape 4:3 illustration for a beginner TOEIC vocabulary course covering office work, meetings and business travel. A coherent editorial still life: an open vocabulary notebook with a few simple flashcards, a desk calendar, and a small business travel suitcase with a passport tucked beside it. Tasteful soft 3D/paper illustration, crisp clear silhouettes, calm friendly professional mood, clean white and light cyan background with teal and blue accents matching an educational website. Center-weighted composition; leave generous safe margins so modest cropping does not cut important details. Large clean legible title text exactly "TOEIC", and smaller text exactly "30 TỪ VỰNG"; preserve Vietnamese diacritics. No other text. No people, no ETS or other logos, no invented certificates, no score promises, no price badges, no watermark. High visual quality with restrained detail readable at small thumbnail sizes.

## Kết nối psql trực tiếp (phương án thay thế, chưa chạy)

Course production đã tồn tại. Các lệnh psql dưới đây lưu để tham khảo cơ chế kết nối; **không chạy apply lại bằng bất kỳ transport nào**. Dùng wrapper `--postflight` phía trên để kiểm tra chỉ đọc course đã tạo.

Chỉ chạy sau khi Khang duyệt nội dung và production apply trong chat. Target cố định là project `zmnfsorjuibfjowmjtxo`. Cần `psql` và thông tin kết nối PostgreSQL quản trị từ cấu hình an toàn có sẵn; không gửi password trong chat, không in biến chứa password.

Ví dụ kết nối direct; các lệnh dưới đây không thiết lập password:

```powershell
$env:PGHOST = 'db.zmnfsorjuibfjowmjtxo.supabase.co'
$env:PGUSER = 'postgres'
$env:PGPORT = '5432'
$env:PGDATABASE = 'postgres'
$env:PGSSLMODE = 'require'

node scripts/content/apply-free-toeic-vocab-course.mjs --production --dry-run --owner mrkhang05k@gmail.com --reviewer zindemo00z@gmail.com
```

Nếu direct không truy cập được, lấy **Session pooler** từ Connect của chính project: host thực tế dạng `*.pooler.supabase.com`, user `postgres.zmnfsorjuibfjowmjtxo`, port `5432`; giữ database/SSL như trên. Không dùng transaction pooler `6543`. Script kiểm tra host/user/project trước khi kết nối.

Dry-run phải đạt. Nếu migration, tài khoản, role teacher, slug hoặc L1 không đạt thì dừng; không tự sửa môi trường. Sau approval, chạy đúng một lần:

```powershell
node scripts/content/apply-free-toeic-vocab-course.mjs --production --apply --owner mrkhang05k@gmail.com --reviewer zindemo00z@gmail.com --manifest test-results/free-toeic-production-apply.jsonl --owner-approved-production
node scripts/content/apply-free-toeic-vocab-course.mjs --production --postflight --owner mrkhang05k@gmail.com --reviewer zindemo00z@gmail.com --manifest test-results/free-toeic-production-apply.jsonl
```

Đã xác nhận `psql.exe` có sẵn tại `C:/Program Files/PostgreSQL/18/bin/psql.exe`. Phương án psql/password này chưa chạy; apply thật dùng CLI đã xác thực như mục trên. Tuyệt đối không dùng IDs local để thao tác production. Không cần deploy ứng dụng để thêm nội dung.

Sau khi Khang tự đánh giá thẻ, đã kiểm tra **chỉ đọc** production lúc 2026-10-10T14:05:18.110Z bằng transaction READ ONLY/ROLLBACK. Learner thực tế là `mrkhang2005k@gmail.com` (`22a90027-2799-4517-9e68-b40dd38ab041`), bài Công sở và công việc (`54e5c20e-00ed-4168-b845-d509c457e73f`). Tại thời điểm truy vấn có 5/10 thẻ đã lưu: office = 3 (Ổn), colleague = 1 (Lại), department = 2 (Khó), employee = 4 (Dễ), manager = 4 (Dễ). Tất cả rating hợp lệ. `is_flashcard_completed`, `is_exercise_completed`, `is_topic_completed` đều false; `private.d4_topic_completion_state` trả cả bốn trạng thái false, gồm Memory check. Trạng thái chưa hoàn tất phù hợp với dữ liệu đang học; không sửa dữ liệu learner. Bằng chứng: `test-results/free-toeic-production-lf1-check.json`. Đây là kiểm tra trạng thái học dở trên production; trường hợp đủ 10 thẻ đều Lại/Khó đã kiểm chứng local, chưa chạy trên production.

## Kế hoạch rollback, chưa thực thi

Lỗi trước COMMIT: `ON_ERROR_STOP` dừng kết nối và PostgreSQL rollback cả transaction. Đã kiểm chứng bằng rehearsal và lỗi chủ động local. Lỗi quanh COMMIT phải đối soát trước; không mặc định kết luận đã rollback.

Rollback sau COMMIT là thao tác xóa riêng, chỉ thực hiện khi Khang cho phép:

1. Đọc đúng receipt có marker `committed` của môi trường cần rollback, xác minh course ID, slug, owner, reviewer và **toàn bộ tập IDs hiện tại trùng receipt**. Chụp nội dung hiện tại trước khi xóa.
2. Kiểm tra chỉ đọc mọi FK, trigger và dữ liệu phụ thuộc hiện hành. Nếu có enrollment, payment, ratings, answers, progress, review/collaborator/content bổ sung hoặc dependency ngoài tập 244 IDs thì **dừng**, trình Khang phạm vi phát sinh; không cascade xóa dữ liệu học viên. Local hiện đã có learner QA nên không đủ điều kiện rollback chỉ bằng receipt nội dung.
3. Trong một transaction quản trị, lock các row thuộc tập IDs này để ngăn thay đổi hoặc thêm phụ thuộc trong lúc rollback; kiểm tra lại điều kiện ở bước 1–2. Không sửa profile, role hoặc dữ liệu của course khác.
4. Xóa theo FK hiện hành, dùng `WHERE id = ANY(...)` với đúng mảng IDs từng bảng từ receipt. Thứ tự dự kiến: options → questions → groups → exercises; review submissions và author exclusions → cards → topics → chapters → collaborators → course. Đối chiếu các FK vòng nếu có trước khi viết câu lệnh; không tự tắt trigger/constraint hoặc dùng DDL.
5. Mỗi DELETE phải có số row bằng số IDs dự kiến; sai khác thì ROLLBACK. Trước COMMIT kiểm tra mọi ID trong receipt đã biến mất, năm quan hệ L1 vẫn 0 sai và không có row ngoài phạm vi bị xóa. Nếu bất kỳ kiểm tra nào lỗi, rollback toàn transaction.

Không có lệnh reset hoặc xóa hàng loạt theo slug. Reviewer/profile vốn tồn tại được giữ nguyên.

Ảnh nằm ngoài transaction PostgreSQL. Nếu rollback course được duyệt và đạt đủ precondition, kiểm tra riêng Storage object theo cả `storage_object_id`, bucket và path trong receipt ảnh. Chỉ xóa đúng object mới này qua Storage API sau khi xác nhận không có course khác tham chiếu URL; không xóa prefix/bucket hoặc sửa trực tiếp `storage.objects`. Cleanup ảnh cũng cần Khang duyệt, không tự thực hiện.

Commit đề xuất khi Khang duyệt: `feat(content): add free introductory TOEIC vocabulary course`.
