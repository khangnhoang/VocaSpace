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

- Chỉ chạy smoke với local Supabase. Không chạy với production, staging, preview hoặc linked remote database.
- Root `supabase/` là source canonical cho migrations, seed, functions và config local-dev `voca_space`.
- Runner tạo runtime gitignored tại `.e2e-runtime/supabase`, copy từ root `supabase/`, rồi chỉ sửa runtime `config.toml` sang `project_id = "voca_space_e2e"` và các port `5544x`.
- Runtime values luôn được lấy động bằng `supabase --workdir .e2e-runtime status -o env`.
- Service-role key chỉ được dùng trong Node fixture/persistence verification, không đưa vào browser.

## Commands

```bash
npm run test:e2e
npm run test:e2e:smoke
npm run test:e2e:smoke:exercise
npm run test:e2e:report
```

`test:e2e` forward Playwright args, nên có thể chạy một file hoặc một folder:

```bash
npm run test:e2e -- e2e/smoke/exercise-authoring.smoke.spec.ts
```

## E2E support helpers

- Node-side helper đặt trong `scripts/e2e/support/`: Supabase admin client, auth user setup, upsert row, base authoring fixture và cleanup learning-content. Các helper này được dùng bởi fixture scripts, không import trực tiếp vào browser spec.
- Browser-side Playwright helper đặt trong `e2e/support/`: UI login, console/page-error guard và các thao tác UI nhỏ. Các helper này không được dùng service-role key hoặc Supabase admin client.
- Dùng base authoring fixture khi spec cần cùng teacher/profile/course/collaborator và dữ liệu authoring nền giống nhau. Fixture data cụ thể vẫn nên được caller truyền rõ ràng.
- Chỉ tạo helper mới khi phần lặp là plumbing ổn định ở nhiều spec. Không gom flow nghiệp vụ chính như tạo TOEIC exercise, xóa flashcard, xử lý dashboard issue hoặc deep-link history vào helper lớn.
- Cleanup phải dùng ID hoặc fixture-owned identifiers hẹp, xóa theo đúng thứ tự phụ thuộc dữ liệu, và fail loud khi database báo lỗi.
- Business flow nên vẫn nhìn thấy trong spec để reviewer đọc được actor, route, action và assertion chính mà không phải nhảy qua nhiều lớp helper.

## Runtime lifecycle

Runner sẽ:

- nạp `.env.e2e.local`, `.env.test.local`, `.env.local` cho các env app không thuộc Supabase;
- kiểm tra Docker và Playwright Chromium;
- recreate `.e2e-runtime/supabase` từ root `supabase/`, bỏ qua `.temp` và `.branches`;
- patch chỉ runtime `config.toml` sang `project_id = "voca_space_e2e"`, app redirect `127.0.0.1:3100`, và port `5544x`;
- start isolated Supabase bằng `supabase --workdir .e2e-runtime start` nếu status chưa sẵn sàng;
- đọc `API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY` bằng `supabase --workdir .e2e-runtime status -o env`;
- inject các giá trị đó vào Playwright và Next web server;
- chạy Playwright Chromium một worker, không parallel;
- trả đúng exit code của Playwright.

E2E luôn chạy trên `.e2e-runtime/`; root project `voca_space` là database phát triển bền vững và không bị E2E reset hoặc mutate trực tiếp.

## Test data

Fixture ổn định:

- teacher: `teacher@gmail.com` / `123123`;
- course: `44444444-4444-4444-8444-444444444444`;
- chapter: `55555555-5555-4555-8555-555555555555`;
- topic: `66666666-6666-4666-8666-666666666666`.

Exercise không được seed sẵn. Spec tạo fixture idempotent bằng service role trong Node, xoá các exercise cũ có prefix `E2E Smoke Exercise`, rồi browser tạo exercise mới với title unique theo run. Sau submit, spec query local DB bằng service role để xác nhận đúng `course_id`, `topic_id`, `part_type`, group, question và options.

## Artifacts

- Screenshots/traces chỉ giữ khi fail.
- Output nằm trong `test-results/e2e/`.
- Playwright HTML report nằm trong `playwright-report/` nếu được tạo.
- `.e2e-runtime/`, `test-results/`, `playwright-report/`, và `coverage/` đều được ignore.

## Debug failure

Khi fail, kiểm tra theo thứ tự:

1. Terminal output của runner.
2. `test-results/e2e/**/test-failed-*.png`.
3. `test-results/e2e/**/trace.zip` bằng `npx playwright show-trace <trace.zip>`.
4. Next dev output do Playwright webServer in ra.
5. Supabase local logs của isolated runtime nếu lỗi DB/Auth/RLS.

Smoke này cố ý không cover Part 5, course creation, student attempts, grading, media upload, AI generation, payment hoặc CI.
