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

## Solved

- Teachers có thể upload image/audio từ máy.
- Existing URL workflow vẫn hoạt động.
- Buckets và Storage policies được track bằng migration.
- Unsafe protocols và invalid file types bị reject.
- Large files không còn đi qua Server Action body payload.
- Invalid pasted media URL hiển thị inline error, toast/form error, và focus/scroll tới field lỗi.

## Trade-offs

- Public buckets đơn giản và tương thích với UI hiện tại, nhưng chưa riêng tư.
- Lưu public URL dễ render nhưng kém linh hoạt hơn lưu storage path.
- Storage upload và Postgres insert/update không nằm trong cùng một transaction.
- Best-effort cleanup giảm orphan files nhưng không loại bỏ hoàn toàn. Nếu network/client failure xảy ra sau Storage upload nhưng trước DB submit, orphan files vẫn có thể xuất hiện.

## Security model

- Public read cho media objects.
- Chỉ `teacher` hoặc `admin` được upload.
- Owner hoặc `admin` được delete.
- Không cho SVG upload.
- Không cho arbitrary external `http://`.
- Không fetch pasted URLs server-side.
- Storage paths được sinh server-side, không tin original filename.
- Bucket-level `file_size_limit` và `allowed_mime_types` được set trong migration khi Storage schema hỗ trợ.

## Testing / Verification

Verification gồm:

- Unit tests cho URL/file validators.
- Route/action tests cho upload route và cleanup action.
- Integration tests với local Supabase Storage cho buckets, upload/read/delete policies và lưu public URL qua `create_exercise_with_content`.
- Manual QA checklist cho paste URL, upload, remove, cleanup, create/edit group media và DB persistence.

## Risks / TODO

- Signed/private URLs later.
- Orphan cleanup job later.
- File scanning later.
- Audio silence/content detection không được hỗ trợ.
- Course-level object path/access policy later.
- E2E/UI tests later.
- Cân nhắc platform upload/request size limits cho media rất lớn.
