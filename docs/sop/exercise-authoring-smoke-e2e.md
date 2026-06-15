# Exercise Authoring Smoke E2E

## Mục tiêu

Smoke test này chứng minh giáo viên đã đăng nhập có thể tạo một TOEIC Part 7 exercise thật qua browser UI, đi qua Next.js UI, Server Action, local Supabase Auth/Postgres/RLS/RPC và persisted record.

## Prerequisites

- Docker đang chạy.
- Supabase CLI dùng được qua `npx supabase`.
- Playwright Chromium đã cài bằng:

```bash
npx playwright install chromium
```

- Local Supabase chỉ dùng môi trường local. Không chạy smoke này với production, staging, preview hoặc linked remote database.
- Repo đang dùng local Supabase port `55421+` trong `supabase/config.toml` vì Windows trên máy này reserve dải `54321-54324/54322`.
- `.env.local` hoặc `.env.test.local` cần có local anon/service-role key. Runner override `NEXT_PUBLIC_SUPABASE_URL` sang `http://127.0.0.1:55421` khi chạy E2E.

## Command

```bash
npm run test:e2e:smoke:exercise
```

Runner sẽ:

- kiểm tra Docker;
- start local Supabase nếu `supabase status` chưa sẵn sàng;
- fail nếu Chromium chưa cài;
- chuẩn bị teacher/course/chapter/topic fixture idempotent bằng service role trong Node;
- xoá các exercise cũ có prefix `E2E Smoke Exercise`;
- start Next dev bằng webpack tại `127.0.0.1:3100`;
- chạy Playwright Chromium một worker, không parallel;
- trả đúng exit code của Playwright.

## Test Data

Fixture ổn định:

- teacher: `teacher@gmail.com` / `123123`;
- course: `44444444-4444-4444-8444-444444444444`;
- chapter: `55555555-5555-4555-8555-555555555555`;
- topic: `66666666-6666-4666-8666-666666666666`.

Exercise không được seed. Browser tạo exercise mới với title unique theo run. Sau submit, test query local DB bằng service role để xác nhận đúng `course_id`, `topic_id`, `part_type`, group, question và options.

## Artifacts

- Screenshots/traces chỉ giữ khi fail.
- Output nằm trong `test-results/e2e/`.
- Playwright HTML report nằm trong `playwright-report/` nếu được tạo.
- Cả hai đường dẫn đều được ignore, không commit.

## Debug Failure

Khi fail, kiểm tra theo thứ tự:

1. Terminal output của runner.
2. `test-results/e2e/**/test-failed-*.png`.
3. `test-results/e2e/**/trace.zip` bằng `npx playwright show-trace <trace.zip>`.
4. Next dev output do Playwright webServer in ra.
5. Supabase local logs nếu lỗi DB/Auth/RLS.

Smoke này cố ý không cover Part 5, course creation, student attempts, grading, media upload, AI generation, payment hoặc CI.
