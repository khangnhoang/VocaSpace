# Local Development Supabase

## Mô hình hai project local

VocaSpace chỉ dùng hai project Supabase local:

- `supabase/`: project phát triển local bền vững, `project_id = "voca_space"`, dùng database và Docker volume hiện có.
- `.e2e-runtime/`: project E2E cô lập, `project_id = "voca_space_e2e"`, dùng database disposable cho smoke test tự động.

Không tạo workdir hoặc database local thứ ba cho phát triển thường ngày.

## Vì sao đổi port canonical

Máy Windows hiện đang giữ dải port mặc định `54321-54329`, khiến Docker không bind được Supabase root project vào API URL cũ `http://127.0.0.1:54321`. Root `supabase/config.toml` vì vậy đổi sang dải canonical an toàn `45320-45329` nhưng giữ nguyên `project_id = "voca_space"`. Đây vẫn là cùng project local-dev và vẫn dùng cùng Docker volume database.

Port root local-development:

- Shadow DB: `45320`
- API: `45321`
- DB: `45322`
- Studio: `45323`
- Mailpit/Inbucket: `45324`
- SMTP/POP3 nếu bật: `45325`/`45326`
- Analytics: `45327`
- Pooler: `45329`

E2E tiếp tục dùng dải riêng `5544x` và không dùng dữ liệu phát triển thường ngày.

## Lệnh phát triển

```bash
npm run dev
```

Lệnh này kiểm tra Docker, đảm bảo root Supabase project đang chạy, đọc runtime env thật bằng `supabase status -o env`, xác nhận URL là loopback/local trên port canonical, rồi inject:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Sau đó Next.js chạy bằng webpack qua `npm run dev:app`. Runner không rewrite `.env.local`, nên không cần copy thủ công URL/key mới và không commit credential runtime.

```bash
npm run dev:app
```

Lệnh này chỉ chạy Next.js bằng `next dev --webpack`. Dùng khi môi trường đã có đủ Supabase env. Webpack đang là runner local đáng tin cậy vì Turbopack từng tái hiện fatal panic trong quá trình phát triển.

## Lệnh Supabase root dev

```bash
npm run supabase:dev:start
npm run supabase:dev:status
npm run supabase:dev:stop
```

Các lệnh này chỉ thao tác root project `voca_space`, không dùng `--workdir`, không chạm `.e2e-runtime/`, không chạy `supabase stop --all` và không reset database.

Plain `supabase stop` rồi `supabase start` giữ Docker volume database. Các lệnh reset hoặc `stop --no-backup` là phá dữ liệu local và không thuộc workflow mặc định.

## Tách biệt E2E

E2E tạo `.e2e-runtime/supabase` từ source canonical `supabase/`, rồi patch runtime copy sang `project_id = "voca_space_e2e"` và port `5544x`. Runtime này disposable để smoke test tự động có dữ liệu lặp lại được. Không dùng dữ liệu E2E cho phát triển thường ngày và không trỏ integration/dev app sang `.e2e-runtime/`.
