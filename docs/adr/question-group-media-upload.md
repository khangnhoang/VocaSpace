# ADR: Question group media upload

## Status

Accepted

## Context / Problem

Teachers cần gắn hình ảnh và âm thanh cho question groups. Luồng paste URL hiện có vẫn phải được giữ vì dữ liệu đã dùng `image_url` và `audio_url`.

Local file upload cũng cần được hỗ trợ để teachers không phải tự host media ở nơi khác. PR4 ban đầu gửi `File` qua Server Actions, nhưng Server Actions không phù hợp cho media payload lớn vì có request body limit. Manual QA với MP3 khoảng 7.5 MB đã gặp lỗi `Body exceeded 1 MB limit.`

Supabase Storage buckets và policies phải được biểu diễn bằng migrations để local/dev/remote schema có cùng contract. Hệ thống cũng cần validation để tránh unsafe URLs, SVG upload, sai MIME/extension, file rỗng hoặc quá lớn.

## Decision

Sử dụng 2 public buckets:

- `question_group_images`
- `question_group_audios`

Giữ nguyên DB columns:

- `image_url`
- `audio_url`

File upload đi qua Route Handler `app/api/question-group-media/upload/route.ts`, không gửi large `File` payload qua Server Actions. Route nhận multipart `FormData`, kiểm tra session, kiểm tra role `teacher` hoặc `admin`, validate file server-side, sinh storage path server-side theo dạng `auth.uid()/uuid.ext`, upload lên bucket tương ứng với `upsert: false`, rồi trả về `bucket`, `path`, `publicUrl`.

Uploaded file được chuyển thành public URL. Existing exercise/question group flows tiếp tục gửi URL qua `createExercise` và `updateQuestionGroup`.

Paste URL vẫn được hỗ trợ. URL/file validation được thực hiện client-side để phản hồi nhanh cho UX và server-side/bucket-level để bảo vệ hệ thống. Không đổi `create_exercise_with_content` vì RPC hiện đã lưu `image_url` và `audio_url`.

PR4 follow-up bổ sung rule TOEIC MVP theo `part_type`:

- `part1`: grouped exercise, mỗi group cần `image_url` và `audio_url`.
- `part2`, `part3`, `part4`: grouped exercise, mỗi group cần `audio_url`.
- `part5`: standalone questions, không cần question group context.
- `part6`, `part7`: grouped exercise, mỗi group cần `passage_text`.

Rule này hiện được hardcode có chủ đích trong TypeScript validation và trong `create_exercise_with_content` RPC replacement migration. Đây là quyết định MVP tạm thời để hoàn tất đúng TOEIC scope, không phải kiến trúc format/template lâu dài.

Bulk insert/import qua AIKEN parser cũng phải đi qua cùng rule TOEIC như manual create. Parser failure hoặc Zod/context validation failure phải dừng trước DB insert; RPC failure phải rollback transaction.

UI create/edit cũng dùng rule TOEIC MVP hardcoded để chỉ hiển thị các field media/context phù hợp với từng `part_type`. Mục tiêu là giảm việc nhập dư `passage_text`, `audio_url`, hoặc `image_url` khi TOEIC part hiện tại không cần đến chúng. DB vẫn giữ linh hoạt vì `question_groups.passage_text`, `audio_url`, và `image_url` đều nullable; PR này không tự xóa stored values và không thêm rule RPC/server để reject extra optional fields.

## Solved

- Teachers có thể upload image/audio từ máy.
- Existing URL workflow vẫn hoạt động.
- Buckets và Storage policies được track bằng migration.
- Unsafe protocols và invalid file types bị reject.
- Large files không còn đi qua Server Action body payload.
- Invalid pasted media URL hiển thị inline error, toast/form error, và focus/scroll tới field lỗi.
- TOEIC Part-specific context được chặn ở create UI, Server Action, `updateQuestionGroup`, và `create_exercise_with_content`.
- Bulk insert/import không được bypass TOEIC context rules.

## Trade-offs

- Public buckets đơn giản và tương thích với UI hiện tại, nhưng chưa riêng tư.
- Lưu public URL dễ render nhưng kém linh hoạt hơn lưu storage path.
- Storage upload và Postgres insert/update không nằm trong cùng một transaction.
- Best-effort cleanup giảm orphan files nhưng không loại bỏ hoàn toàn. Nếu network/client failure xảy ra sau Storage upload nhưng trước DB submit, orphan files vẫn có thể xuất hiện.
- Hardcode TOEIC rule trong code/RPC đơn giản và nhanh cho MVP, nhưng sẽ không scale tốt cho nhiều exam formats hoặc languages.

## Security model

- Public read cho media objects.
- Chỉ `teacher` hoặc `admin` được upload.
- Owner hoặc `admin` được delete.
- Không cho SVG upload.
- Không cho arbitrary external `http://`.
- Không fetch pasted URLs server-side.
- Storage paths được sinh server-side, không tin original filename.
- Bucket-level `file_size_limit` và `allowed_mime_types` được set trong migration khi Storage schema hỗ trợ.
- `create_exercise_with_content` là write-boundary cuối cho TOEIC context validation.
- Bulk parser errors không expose stack trace/raw DB errors ra UI.

## Testing / Verification

Verification gồm:

- Unit tests cho URL/file validators.
- Route/action tests cho upload route và cleanup action.
- Integration tests với local Supabase Storage cho buckets, upload/read/delete policies và lưu public URL qua `create_exercise_with_content`.
- Unit tests cho TOEIC context schema và AIKEN parser.
- Server Action tests cho create/update context validation và block đổi `part_type`.
- Integration tests cho `create_exercise_with_content` với TOEIC Part 1-7 và bulk/import payload.
- Manual QA checklist cho paste URL, upload, remove, cleanup, create/edit group media và DB persistence.

## Risks / TODO

- Signed/private URLs later.
- Orphan cleanup job later.
- File scanning later.
- Audio silence/content detection không được hỗ trợ.
- Course-level object path/access policy later.
- E2E/UI tests later.
- Cân nhắc platform upload/request size limits cho media rất lớn.
- Future scalable validation should move to `exercise_formats`, `exercise_part_templates`, `rules_jsonb`, language/format-specific rules, and parser templates per exam/language.
- PR này không triển khai future multi-format system vì scope hiện tại là hoàn tất TOEIC MVP đúng và an toàn.
