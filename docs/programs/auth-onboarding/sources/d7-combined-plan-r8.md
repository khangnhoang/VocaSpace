---
title: "D7 — Google OAuth và xác minh email"
wave: D7
branch: feat/student-flow-d7-auth-cta (đã đổi tên thành feat/auth-a1-email-verification)
base: "main @ ab92e21 (merge PR #118, D4)"
dependency: "Không phụ thuộc D5/D6. Cần Owner cấu hình Google Cloud và Supabase hosted (§2.5 G6, §8.2)"
parent: ../plan.md
progress: ../progress.md
problems: ../problems.md
---

> **Reviewed source, no longer an implementation contract (2026-10-02).** The Owner split D7 into a separate 4-PR program ([master plan](../plan.md), Decision 7). This file keeps the combined D7 plan that passed Codex r8 (`PASS`) unchanged, in its original Vietnamese; each PR cuts its part per master plan §6. Names such as "D7", "C1–C4" and the `progress.md`/`problems.md` paths in the body refer to the old program and are kept to match the review history.

# D7 Implementation Plan — Google OAuth và xác minh email

## 1. Trạng thái và quyền hiện tại

- Agent soạn plan ngày 2026-10-02 trên nhánh `feat/student-flow-d7-auth-cta`, tạo từ `main` tại `ab92e21`. Nhánh này sẽ chứa cả plan lẫn implementation của D7.
- Owner giao (2026-10-02): tự review plan, rồi review độc lập bằng Codex `gpt-6.1-sol` high (subagent `gpt-6.1-sol` medium nếu cần); sửa và review lại tới khi `PASS`.
- **Quyền hiện tại (Owner dặn lại 2026-10-02, thay quyền "PASS thì implement" trước đó):** khi plan `PASS` thì chỉ commit local plan rồi **dừng**. Implement cần Owner cho tiếp. Push, PR, merge và mọi thao tác hosted (Supabase dashboard, DB, `db push`, Vercel) vẫn cần Owner cho riêng.
- Agent **không** nhập Google client secret, SMTP password hay bất kỳ credential nào. Mọi cấu hình Google Cloud Console và Supabase dashboard do Owner tự làm theo runbook §8.2.
- Kích thước: **large**. D7 chạm auth, hai Route Handler mới, bốn Server Action, bốn màn hình, một migration chỉ chứa hook function (Quyết định 6) và cấu hình auth của production. Làm một PR, chia checkpoint C1–C4 (§7).

## 2. Binding Spec

### 2.1 Outcome

- Nút "Đăng nhập bằng Google" ở `/login` và `/register` hoạt động thật. Người dùng chọn tài khoản Google, quay về VocaSpace đã đăng nhập; lần đầu thì tài khoản và hồ sơ (role `student`) được tạo tự động.
- Đăng ký bằng email phải **xác minh email**, và **mật khẩu được đặt sau khi xác minh**: form đăng ký không còn ô mật khẩu; sau khi gửi form, người dùng thấy màn "kiểm tra email"; bấm link trong mail thì được xác minh, đăng nhập, rồi đặt mật khẩu ở `/auth/set-password` và về trang chủ (Quyết định 5).
- Người dùng chưa có username (ví dụ tài khoản Google mới) lưu được hồ sơ khi để trống username, ngày sinh, giới tính; và đặt được username **một lần** ở `/profile`.
- Đóng `AUTH-002`: không còn nút Google giả.

### 2.2 Quyết định Owner (2026-10-02)

1. **Làm Google OAuth thật**, không ẩn nút (thay cho lựa chọn "ẩn/disable" của `AUTH-002`).
2. **Bật xác minh email** cho đăng ký bằng mật khẩu trên production. Lý do: Supabase tự động liên kết danh tính cùng email. Khi xác minh email đang tắt, kẻ xấu có thể đăng ký trước email của nạn nhân bằng mật khẩu, rồi khi nạn nhân đăng nhập Google thì danh tính Google được gắn vào tài khoản kẻ xấu đã biết mật khẩu. Bật xác minh email kéo theo: SMTP riêng do Owner cung cấp, màn "kiểm tra email", và cho gửi lại mail.
3. **Hồ sơ không bắt buộc bổ sung** sau Google login: học viên học ngay; phone/username/ngày sinh/giới tính có thể trống. Cho đặt username một lần ở `/profile` khi đang trống. Không thêm migration cho phần hồ sơ (migration hook ở Quyết định 6 là việc riêng, Owner đã đồng ý).
4. Chấp nhận cơ chế **tự động liên kết** của Supabase: người đã có tài khoản mật khẩu đã xác minh (và đã qua cổng G3) đăng nhập Google cùng email sẽ vào **đúng tài khoản cũ**.
5. **Đặt mật khẩu sau khi xác minh email** (Owner chọn 2026-10-02, sau Codex plan review r4): form đăng ký bỏ ô mật khẩu; server tạo user với mật khẩu ngẫu nhiên không ai biết; người dùng đặt mật khẩu sau khi bấm link. Lý do: Supabase dùng lại user đang chờ khi có người đăng ký lại cùng email mà không kiểm tra mật khẩu cũ, nên mọi cách vá "mật khẩu nhập lúc đăng ký" đều còn race (Codex r3–r4). Khi không ai biết mật khẩu trước lúc xác minh, đăng ký trước bằng email người khác không cho kẻ xấu gì để giữ.
6. **Chặn tạo user email qua public Auth API bằng hook "Before User Created"** (agent đề xuất sau Codex plan review r5; **Owner đồng ý 2026-10-02**; thêm một migration và một bước cấu hình hosted). Lý do: Quyết định 5 chỉ đúng khi mọi user email đều do server tạo. Public `signUp` với anon key vẫn cho kẻ xấu tạo trước user đang chờ với mật khẩu P do họ chọn; đăng ký lại qua app không thay P; nạn nhân xác minh xong thì P đăng nhập được (Codex r5 C3). Hook là cơ chế Supabase hỗ trợ sẵn (gói Free có), chạy trước khi user mới được tạo qua public API (signup, OTP, OAuth). Phương án thay thế: chấp nhận rủi ro C3 (không khuyến nghị); tắt đăng ký toàn cục thì chặn luôn user Google mới; tắt provider email thì chặn luôn đăng nhập bằng mật khẩu.

### 2.3 Scope

- Route Handler mới:
  - `/auth/callback`: nhận `code` từ Google OAuth (PKCE), đổi lấy session.
  - `/auth/confirm`: nhận `token_hash` + `type` từ link mail xác minh, gọi `verifyOtp`, rồi chuyển tới `/auth/set-password`.
- Nút Google dùng chung cho `/login` và `/register`: kiểm tra provider đã bật rồi mới gọi `signInWithOAuth({ provider: "google" })`.
- Schema: `registerSchema` bỏ `password`/`confirmPassword`; thêm schema đặt mật khẩu dùng lại luật mật khẩu hiện có (tối thiểu 6 ký tự, nhập lại khớp).
- Server Actions trong `app/actions/auth.ts`:
  - `signUpUser` tạo user bằng service role `auth.admin.createUser` với mật khẩu ngẫu nhiên do server tạo, rồi gọi `resend` để gửi mail xác minh; kết quả trung tính "kiểm tra email"; lỗi map sang thông điệp cố định (H4);
  - `signInUser` parse bằng `loginSchema` có sẵn, lỗi giữ "Sai email hoặc mật khẩu!";
  - action mới gửi lại mail xác minh, luôn trả kết quả trung tính;
  - action mới `setPasswordAfterConfirmation` (G8, H11).
- Trang mới `/auth/set-password`.
- UI:
  - `/register`: bỏ ô mật khẩu; màn "kiểm tra email" sau khi gửi form, có nút gửi lại email và nút gửi lại form đăng ký;
  - `/login`: thông báo lỗi khi callback/confirm thất bại.
- `/profile`: chuẩn hoá giá trị rỗng; ô username sửa được khi đang trống; server chỉ đặt username khi giá trị hiện tại là null.
- Migration mới `supabase/migrations/<timestamp>_d7_before_user_created_hook.sql`: chỉ tạo function `public.d7_before_user_created(event jsonb)` và grant (H12). Không tạo bảng, không sửa trigger, không sửa migration đã phát hành.
- Local Supabase (`supabase/config.toml`): bật `[auth.hook.before_user_created]` trỏ tới function trên (H12), bật `enable_confirmations`, template mail xác minh dùng link `/auth/confirm` và nói rõ "bấm để xác minh và đặt mật khẩu", thêm redirect URL local, thêm khối `[auth.external.google]` lấy credential từ env (mặc định `enabled = false`).
- Docs: plan này, `progress.md`, `problems.md` (`AUTH-002` và follow-up), runbook rollout cho Owner (§8.2).

### 2.4 Non-goals

- Không thêm migration nào ngoài hook function của Quyết định 6; không thêm bảng, không sửa trigger `handle_new_user` (Google đã gửi `full_name` và `avatar_url`).
- Không bắt buộc bổ sung hồ sơ, không chặn học viên Google.
- Không làm quên mật khẩu, magic link, One Tap hay provider khác (Facebook, Apple).
- Không cho người dùng tự liên kết/huỷ liên kết danh tính trong `/profile`.
- Không cho người chỉ có Google đặt mật khẩu qua UI. Form đổi mật khẩu trong `/profile` hiện yêu cầu mật khẩu cũ, nên sẽ báo lỗi với họ; ghi follow-up.
- Không đổi luồng đăng nhập/đổi mật khẩu của user đã có.
- Không sửa lệch enum giới tính giữa `registerSchema` (`nam`/`nữ`) và `profileSchema` (`male`/`female`). Chuẩn hoá `gender = ""` → null ở H8 không phải là sửa lệch enum này. Không sửa toast "Chủ tịch Ú" ngoài phạm vi màn đăng ký D7 đụng tới. Báo riêng.
- Không cấu hình CAPTCHA, custom domain hay DKIM/SPF cho domain gửi mail (việc của Owner/nhà cung cấp SMTP).
- Không chống dò email ở tầng Supabase Auth API trực tiếp; D7 chỉ cam kết ở tầng app (G5).
- Agent không đụng Supabase dashboard, Google Cloud Console hay Vercel env.

### 2.5 Execution guardrails

- **G1 — Không open redirect.** `/auth/callback` và `/auth/confirm` chỉ redirect về path nội bộ cố định (`/` khi thành công, `/login?auth_error=...` khi lỗi). Không đọc `next`/`redirect_to` từ query. *Nếu bỏ:* link giả có thể đưa người dùng vừa đăng nhập sang site lừa đảo.
- **G2 — Không secret trong repo.** Google client secret và SMTP password chỉ nằm ở Supabase dashboard (hosted) hoặc env local không commit (`config.toml` dùng `env(...)`). *Nếu bỏ:* lộ credential qua Git.
- **G3 — Cổng trước khi bật Google trên production.** Google provider chỉ được bật khi **cả hai** điều kiện đúng:
  1. "Confirm email" đã bật (ghi lại thời điểm bật, gọi là T_on);
  2. Owner đã rà **toàn bộ tài khoản trong danh sách chốt ở §8.2 bước 4**. Danh sách này lấy khi đăng ký mới đang tạm tắt, sau khi "Confirm email" đã bật và đã chờ request đăng ký cũ kết thúc, nên bao cả 7 user hiện có và mọi request đăng ký còn đang chạy lúc chuyển chế độ. Không lọc theo `created_at`, và không lọc bớt theo `confirmation_sent_at` hay `raw_app_meta_data.provider`: các trường này không phải lịch sử xác minh đáng tin (đổi mật khẩu có thể xoá `confirmation_sent_at`; provider dạng scalar không phản ánh hết khả năng đăng nhập bằng mật khẩu). Tài khoản tạo khi xác minh còn tắt có `email_confirmed_at` nhưng điều đó **không** chứng minh ai giữ hộp thư. Với từng tài khoản, cổng chỉ đạt khi một trong hai đúng:
     - Owner biết chắc người giữ email **cũng chính là người đã đặt mật khẩu** (tài khoản của Owner, tài khoản test Owner tạo, người dùng Owner xác nhận trực tiếp là họ tự đăng ký);
     - hoặc tài khoản nghi vấn đã bị xoá hoặc bị chặn (ban) trong dashboard. Chỉ "liên hệ" người dùng thì **chưa đủ** để đạt cổng, vì xác nhận người giữ hộp thư không loại bỏ mật khẩu hay session do người khác tạo trước đó.

     Agent chỉ hỗ trợ bằng truy vấn đọc (§8.2 bước 4) khi Owner cho phép.
  3. Sau danh sách chốt, chỉ user tạo qua luồng D7 (`app_metadata.d7_server_created = true`) hoặc user Google mới được miễn rà. User tạo bằng đường khác sau thời điểm chốt (admin tạo trong app qua `createUserByAdmin` với mật khẩu mặc định đã biết và `email_confirm: true`, dashboard, import) không qua xác minh hay G8 và **phải rà như danh sách chốt** trước **mỗi lần** bật (hoặc bật lại) Google, theo cách đối chiếu tập `id` ở §8.2 bước 7. Không dùng đường mật khẩu mặc định để tạo tài khoản thật cho người khác khi Google đã bật (follow-up §8.3).

  *Nếu bỏ:* tài khoản đăng ký trước bằng email của nạn nhân khi xác minh còn tắt vẫn được auto-link với danh tính Google của nạn nhân, tức là lỗ hổng ở Quyết định 2 vẫn còn.
- **G4 — Đăng ký qua app không bao giờ cấp session, và tôn trọng công tắc "Allow new users to sign up".** `signUpUser` tạo user bằng `admin.createUser({ email_confirm: false })`, API này không cấp session và không phụ thuộc cài đặt "Confirm email". Admin API cũng **bỏ qua** công tắc đóng đăng ký của Supabase, nên trước khi tạo user, `signUpUser` đọc `GET <SUPABASE_URL>/auth/v1/settings` phía server: `disable_signup === true`, fetch lỗi hoặc thiếu trường → trả "Đăng ký tạm thời chưa khả dụng", không tạo user, không gửi mail (đóng an toàn). Nhờ vậy tắt đăng ký trong dashboard vẫn đóng được đăng ký qua app (runbook, sự cố mail). Runbook vẫn bật "Confirm email" **trước** deploy (§8.2) vì cài đặt đó quyết định việc đăng ký lại một email đang chờ qua public API có được cấp session hay không (§3, §8.3). *Nếu bỏ:* người dùng vào app mà chưa chứng minh giữ hộp thư.
- **G5 — Không lộ chi tiết lỗi Supabase và không cho dò email ở tầng app.**
  - Lỗi trả về dùng thông điệp tiếng Việt cố định.
  - Đăng ký bằng email mới, email đang chờ xác minh hay email đã xác minh đều cho cùng kết quả "kiểm tra email" (H4).
  - Lỗi username chỉ trả khi bước kiểm tra trước `createUser` thấy username đã có, nên giống nhau với mọi trạng thái email. Lỗi tạo user (kể cả trigger lỗi do race username) **không** được đoán là lỗi username; trả cùng result trung tính, người dùng gửi lại form (H4).
  - Gửi lại mail luôn trả cùng một kết quả trung tính, kể cả khi Supabase báo lỗi hay rate limit (H6); UI áp cùng một cooldown sau mọi lần bấm.
  - Đăng nhập: user chưa xác minh không có mật khẩu ai biết, nên mọi lỗi đăng nhập là "Sai email hoặc mật khẩu!" (H5).
  - Giới hạn: gọi thẳng Supabase Auth API vẫn có thể phân biệt (ví dụ rate limit gửi lại của email đang chờ xác minh); không thuộc phạm vi D7.

  *Nếu bỏ:* rò thông tin nội bộ hoặc cho phép dò email qua giao diện app.
- **G6 — Cấu hình hosted là việc của Owner.** Agent chỉ đọc kiểm tra (khi được phép) và không bao giờ nhập credential. *Nếu bỏ:* vi phạm quyền và quy tắc an toàn.
- **G7 — Username chỉ đặt một lần ở tầng app.** UI chỉ mở ô username khi đang trống. Action cập nhật hồ sơ chỉ ghi `username` bằng update có điều kiện "username hiện tại là null" và không tin client (H8). *Nếu bỏ:* request tự chế qua action đổi được username bất kỳ lúc nào, trái quyết định 3. **Giới hạn đã biết:** migration D1 `20260915130000` cấp quyền `update (username, …)` trên `profiles` cho `authenticated`, nên người dùng vẫn đổi được username của chính mình qua Data API trực tiếp như hiện tại (trước D7). Chặn ở DB cần trigger/migration, trái quyết định 3 (không migration), nên ghi follow-up chứ không làm trong D7.
- **G8 — Không có mật khẩu nào được biết trước khi xác minh; chỉ người vừa chứng minh giữ hộp thư được đặt mật khẩu không cần mật khẩu cũ.**
  - `signUpUser` tạo mật khẩu ngẫu nhiên phía server (`crypto.randomBytes(32)`, base64url) cho mỗi lần gọi `createUser`; không trả về client, không log, không lưu.
  - **Mọi user email đều do server tạo** (Quyết định 6, H12): hook chặn tạo user mới qua public Auth API trừ provider `google`, nên kẻ xấu không tạo trước được user đang chờ với mật khẩu tự chọn. Đăng ký lại qua public `signUp` một email đang chờ (user đã tồn tại nên hook không chạy) không đổi mật khẩu hay metadata; khi "Confirm email" bật thì chỉ gửi lại mail tới hộp thư nạn nhân (spike §3).
  - Action đặt mật khẩu (H11) chỉ chạy khi **cả hai** đúng, đọc phía server:
    1. claim `amr` của session hiện tại (đọc bằng `getClaims()`, có kiểm chữ ký) có method `otp`. Supabase cấp `otp` khi `verifyOtp` thành công, gồm cả SMS và đổi số điện thoại; VocaSpace đã tắt provider phone (`[auth.sms]`, hosted chỉ có provider `email`, §3), nên trong D7 `otp` nghĩa là session sinh từ link/mã email. Session đăng nhập bằng mật khẩu có `amr` `password`, Google có `oauth`: bị từ chối;
    2. `app_metadata.d7_password_set` khác `true`, đọc từ `getUser()` (Auth server tra user hiện tại), **không** đọc từ claim của JWT (JWT cũ chưa refresh không có cờ mới).
  - Đặt bằng `supabase.auth.updateUser({ password })` của chính session đó (không dùng admin), rồi service role ghi `app_metadata.d7_password_set = true`. Ghi cờ lỗi chỉ có nghĩa người đó đặt lại được một lần nữa bằng cùng session, không mở quyền cho ai khác.
  - Spike local 2026-10-02 (§3) xác nhận: `verifyOtp` cho `amr` `otp`, giữ nguyên sau refresh; `updateUser` đổi mật khẩu xong session vẫn sống và mật khẩu cũ hết hiệu lực; đăng nhập mật khẩu cho `amr` `password`; `updateUserById` gộp `app_metadata`.
  - **Giới hạn đã biết (ghi follow-up):**
    - Ai giữ hộp thư thì có thể lấy session `otp` (link xác minh, hoặc magic link nếu gọi thẳng Auth API cho email đã tồn tại) và đặt mật khẩu nếu cờ chưa có. Đây là cùng mức quyền với "quên mật khẩu" và chấp nhận được, vì giữ hộp thư chính là chủ tài khoản. Hệ quả: user cũ (trước D7) chưa có cờ, nếu chủ hộp thư tự lấy magic link qua API thì đặt được mật khẩu mới.
    - Người xác minh xong mà rời trang trước khi đặt mật khẩu vẫn đăng nhập (session còn) và mở lại `/auth/set-password` được; nếu đăng xuất hoặc mất session trước khi đặt thì không có mật khẩu dùng được và cần Google (sau rollout) hoặc Owner hỗ trợ (chưa có quên mật khẩu).
    - Kẻ xấu đăng ký trước email nạn nhân **qua app** thì hồ sơ (username, họ tên, …) do trigger tạo từ lần đăng ký đầu, tức dữ liệu kẻ xấu nhập; nạn nhân sửa được họ tên nhưng username chỉ đặt một lần (G7). Không ảnh hưởng quyền truy cập; Owner sửa qua dashboard nếu cần.
    - Nạn nhân bấm link của lần đăng ký do kẻ xấu tạo thì nhận tài khoản của chính mình (kẻ xấu không có mật khẩu); mail ghi "Nếu bạn không đăng ký, hãy bỏ qua email này".
    - Hook lỗi (function mất, timeout) làm **mọi** lần tạo user qua public API thất bại, gồm user Google mới: đóng an toàn, không mở lại C3. Đăng ký email qua app không qua hook nên vẫn chạy.

  *Nếu bỏ:* mật khẩu nhập lúc đăng ký (qua app hoặc public API) có thể là của kẻ xấu và còn hiệu lực sau khi nạn nhân xác minh (Codex r3/r5 C3), rồi tài khoản được auto-link với Google của nạn nhân.

## 3. Sự thật đã xác nhận từ repository (baseline `ab92e21`)

### Auth hiện tại

- `app/actions/auth.ts`:
  - `signUpUser(formData)` parse `registerSchema`, upload avatar vào bucket `avatars` trước khi gọi `supabase.auth.signUp({ email, password, options: { data: {...} } })`, không có `emailRedirectTo`. Lỗi trả nguyên `error.message` của Supabase.
  - `signInUser` lấy `email`/`password` thô (chưa parse, dù `lib/schemas/auth.ts` đã có `loginSchema`), mọi lỗi đều thành "Sai email hoặc mật khẩu!".
  - `signOutUser` redirect `/login`.
- `app/(client)/login/page.tsx` và `register/page.tsx` là client page. Nút Google là `<Button type="button" variant="outline">` không có handler; register có comment "Đống Google Login để tạm, xử lý logic sau". Đăng ký xong hiện toast "Đăng ký thành công! Chào mừng Chủ tịch Ú!" rồi `router.push("/")`.
- `utils/supabase/client.ts` (`createBrowserClient`) và `utils/supabase/server.ts` có sẵn; `@supabase/ssr` ^0.9.0 mặc định PKCE.
- `utils/supabase/middleware.ts` (`updateSession`, gọi từ `proxy.ts`): chưa đăng nhập vào `/teacher` hoặc `/teacher/…` → `/login`; đã đăng nhập vào `/login`/`/register` → `/`. Không chặn `/auth/*`.
- Chưa có thư mục `app/auth`. Chưa có test cho `app/actions/auth.ts`.
- `lib/supabase/service-role.ts` có `createServiceRoleClient()` (`server-only`, không lưu session), đang dùng ở các action server khác; `SUPABASE_SERVICE_ROLE_KEY` đã là env bắt buộc của app.
- `profiles.id` tham chiếu `auth.users(id)` `ON DELETE CASCADE` (`profiles_id_fkey`).

### Hồ sơ

- Trigger `on_auth_user_created` → `public.handle_new_user()` (`supabase/migrations/20260609114505_remote_schema.sql`) insert `profiles(id, email, phone, full_name, avatar_url, username, dob, gender)` từ `raw_user_meta_data`. `id` NOT NULL (khoá chính, tham chiếu `auth.users`); các cột còn lại nullable; `role` mặc định `student`; `profiles_username_key` UNIQUE cho phép nhiều null.
- `updateUserProfile` (`app/actions/profile.ts`) parse `profileSchema` rồi ghi `full_name`, `username`, `dob`, `gender`, `updated_at` trong một update; `23505` → "Tên người dùng (Username) đã tồn tại!". Hiện server ghi `username` từ client bất kể giá trị cũ; UI chặn bằng ô disabled. Migration `20260915130000_d1_correction_security_rescue.sql` cấp `update (email, phone, username, full_name, avatar_url, dob, gender, updated_at, removed_at)` trên `profiles` cho `authenticated`, kèm policy "Profiles - Owner Update" (`auth.uid() = id`).
- `edit-profile-form.tsx`: `defaultValues` đặt `username: initialData?.username || ""`, `dob: initialData?.dob || ""`; select giới tính có option `value=""`; ô username `readOnly disabled`, hiện `initialData?.username || "Chưa thiết lập"`.
- `profileSchema` (`lib/schemas/profile.ts`): `username` là `z.string().min(3).optional().nullable()` nên **từ chối `""`**; `gender` là `z.enum(["male","female","other"]).optional().nullable()` nên từ chối `""`; `dob` nhận `""` rồi ghi vào cột `date` (lỗi SQL). Hệ quả: user có username null hiện **không lưu được** hồ sơ qua form (ô username rỗng bị từ chối), đúng trạng thái mặc định của user Google mới.
- `app/actions/profile.ts:164` đổi mật khẩu bằng `updateUser` sau khi xác thực mật khẩu cũ bằng `signInWithPassword`.

### Supabase local (`supabase/config.toml`)

- API port 45321, inbucket (mail UI) port 45324.
- `site_url = "http://127.0.0.1:3000"`, `additional_redirect_urls = ["https://127.0.0.1:3000"]`.
- `[auth.email] enable_confirmations = false`, `max_frequency = "1s"`, `otp_expiry = 3600`. `[auth.sms] enable_confirmations = false`.
- `[auth.rate_limit] email_sent = 2`; theo docs giới hạn này chỉ áp dụng khi dùng SMTP riêng, nên không chặn QA local (inbucket).
- Template mail chưa tùy biến; có ví dụ comment `[auth.email.template.invite]`.
- `[auth.external.apple]` mẫu dùng `secret = "env(...)"`, `enabled = false`. Chưa có khối google.

### Test, seed, E2E

- Mọi `admin.createUser` trong integration test, `scripts/e2e/support/auth-users.mjs` và `scripts/supabase/test-d2-chapter-creator-upgrade.mjs` đều dùng `email_confirm: true`; `seed.sql` set `email_confirmed_at`. Không có E2E nào đăng ký qua UI. Bật xác minh email ở local nên không ảnh hưởng, nhưng phải chạy lại để chứng minh.
- Integration test (`__tests__/integration/*.test.ts`, `npm run test:integration`, cần `ALLOW_DB_INTEGRATION_TESTS=true`) gọi Server Action thật bằng cách mock `@/utils/supabase/server` trả client Supabase thật (ví dụ `topic-completion.test.ts`).
- `scripts/e2e/run-e2e.mjs` chạy Supabase riêng trong `.e2e-runtime/` (copy config từ `supabase/`), và **giữ stack đang chạy** nếu `status` thành công (`ensureSupabaseStarted`), nên đổi `config.toml` phải dừng stack E2E (`npx supabase --workdir .e2e-runtime stop`) để lần chạy sau nạp config mới.
- Đổi phần auth của `config.toml` cần khởi động lại stack (`npx supabase stop` rồi `npx supabase start`); `db reset` không nạp lại config auth.

### Spike local (2026-10-02, script ngoài repo, stack local đang chạy)

- `admin.generateLink({ type: "signup" })` → `verifyOtp({ type: "email", token_hash })` trả session có `amr: [{ method: "otp" }]`; `getClaims()` đọc được cùng giá trị; `refreshSession()` giữ `amr` `otp`.
- `updateUser({ password })` bằng session đó thành công; `getUser()` sau đó vẫn hợp lệ; mật khẩu tạo lúc đăng ký không còn đăng nhập được; đăng nhập bằng mật khẩu mới cho `amr` `password`.
- `auth.admin.updateUserById(id, { app_metadata: { d7_password_set: true } })` gộp với `provider`/`providers` có sẵn.
- `GET /auth/v1/settings` của stack local (anon key) trả trường `disable_signup` (hiện `false`) cùng `external.email`/`external.phone` (G4).
- Spike dùng `generateLink` thay cho mail thật; luồng qua mail + `/auth/confirm` được kiểm lại ở C1.

### Spike hook "Before User Created" (2026-10-02, GoTrue `v2.189.0` local)

Chạy một GoTrue tạm cùng image với stack local, trỏ vào DB local, bật hook Postgres tạm (`provider = 'email'` không có marker thì trả lỗi 403). Đã gỡ container, function và user tạm sau khi chạy.

- Public `signUp` (email mới, mật khẩu do client chọn) → `403` với thông điệp của hook; không tạo user.
- Public `signInWithOtp` cho email mới → `403`; không tạo user.
- `auth.admin.createUser` (có hoặc không có marker trong `app_metadata`) → thành công; bảng log của hook **không** có dòng nào cho hai lần này, tức hook **không chạy** với admin API ở phiên bản này. `app_metadata` truyền vào được gộp với `provider`/`providers`.
- `resend({ type: "signup" })` cho user do admin tạo (`email_confirm: false`) → thành công, mail tới inbucket.
- Public `signUp` lại email đang chờ đó với mật khẩu P (sau cooldown) → không lỗi; P không đăng nhập được khi đang chờ; `user_metadata` không đổi; sau `verifyOtp` (link magic) P vẫn không đăng nhập được. Lần gọi này gửi thêm một mail xác minh tới hộp thư nạn nhân.
- Hook trả lỗi khi function lỗi (ví dụ bị RLS chặn ghi log) → `500`: đóng an toàn.
- Payload hook có `user.app_metadata.provider`; docs Supabase có ví dụ chặn theo provider OAuth bằng chính trường này. Google thật chưa thử được ở local (chưa có credential).
- Fixture hiện có (`__tests__/integration/*`, `scripts/e2e/support/auth-users.mjs`, `scripts/supabase/*`, `app/actions/user.ts`) đều tạo user bằng `admin.createUser`; chỉ `app/actions/auth.ts` gọi public `signUp`. Bật hook ở local không ảnh hưởng fixture.

### Hosted production (agent đọc ngày 2026-10-02, có thể đã đổi)

- Project `zmnfsorjuibfjowmjtxo`: 7 user; agent quan sát thấy cả 7 đều có `email_confirmed_at` khác null và `confirmation_sent_at` null, và provider duy nhất là `email`. Điều này **gợi ý** xác minh email đang tắt khi họ đăng ký, nhưng không khẳng định cấu hình dashboard hiện tại; Owner kiểm tra lại trong dashboard ở runbook §8.2.
- Domain production `vocaspace.vercel.app` (Vercel project `prj_KC3rfpcGIRDvoxGJpHENsf9xkP0H`). Preview deploy cũng dùng Supabase hosted này.

### Supabase Auth (docs và mã nguồn auth, đọc 2026-10-02)

- Auto-linking: danh tính mới cùng email được gắn vào user có sẵn; khi gắn, Supabase chỉ dọn danh tính **chưa xác minh** của user đó. Tài khoản được tự xác nhận khi xác minh tắt vẫn được coi là đã xác minh, và bật xác minh sau đó **không** xác minh lại chúng (lý do của G3).
- Đăng ký trùng email (mã nguồn `signup.go`, `mail.go`):
  - email **đã xác minh**: Supabase chỉ trả user giả (không lỗi) khi **cả** xác nhận email lẫn xác nhận phone đều bật; nếu không thì trả lỗi `user_already_exists`. Local có `[auth.sms] enable_confirmations = false`, nên local sẽ trả lỗi; hosted chưa rõ;
  - email **đang chờ xác minh**: Supabase dùng lại user đó (không kiểm tra mật khẩu cũ, giữ `created_at` cũ). Khi xác minh bật, nó gửi lại mail xác minh, và trong thời gian chờ giữa hai mail thì trả `over_email_send_rate_limit` (link cũ vẫn dùng được). Khi xác minh tắt, nó xác nhận user rồi cấp session, nên **tắt xác minh khi còn user đang chờ là mở đường chiếm tài khoản** (§8.3);
  - H4 xử lý mọi nhánh; G8 + hook (Quyết định 6) làm mật khẩu lúc đăng ký trở nên vô nghĩa với mọi nhánh.
- `resend` trả thành công cho email không tồn tại hoặc đã xác minh, nhưng email đang chờ có thể bị rate limit (`over_email_send_rate_limit`); khác biệt này là kênh dò email nếu app trả lỗi khác nhau (G5, H6).
- `signInWithOAuth` của SDK trên trình duyệt chỉ dựng URL `/authorize` rồi `window.location.assign`, trả `error: null` cả khi provider đang tắt; lỗi chỉ xuất hiện sau khi trình duyệt đã rời app. Muốn báo lỗi trong app phải kiểm tra trước bằng `GET <SUPABASE_URL>/auth/v1/settings` (trả `external.google`).
- SMTP mặc định chỉ gửi tới thành viên team và bị giới hạn tần suất, không dùng cho production. Cần SMTP riêng (Resend, Brevo, SES…), cấu hình ở Authentication → SMTP; sau khi bật, giới hạn mặc định 30 mail/giờ, chỉnh ở Rate Limits.
- Với server-side auth, docs khuyên đổi template "Confirm signup" sang `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` và xử lý bằng `verifyOtp`. Cách này chạy được cả khi mở link ở trình duyệt/thiết bị khác, khác với luồng PKCE `?code=` cần code verifier của trình duyệt đã đăng ký.

## 4. Giả thuyết triển khai có biên

Các mục dưới có thể thay bằng cách tương đương nếu giữ nguyên Spec và guardrail §2.5; ghi lệch vào State.

- **H1 — Nút Google:** component client dùng chung (dự kiến `components/auth/google-sign-in-button.tsx` hoặc cạnh trang auth).
  - Khi bấm: chuyển sang loading/disabled; `fetch(`${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: NEXT_PUBLIC_SUPABASE_ANON_KEY } })`.
  - Nếu `external.google !== true` hoặc fetch lỗi: toast cố định "Đăng nhập Google hiện chưa khả dụng", bỏ loading, không redirect.
  - Nếu bật: `createClient()` từ `utils/supabase/client.ts`, `signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback` } })`. Có `error` thì toast cố định và bỏ loading.
  - Origin lấy từ trình duyệt; allowlist redirect của Supabase là chốt chặn cuối.
- **H2 — `/auth/callback`:** `app/auth/callback/route.ts`, `GET`. Có `code` thì `exchangeCodeForSession(code)` bằng server client; thành công → redirect `/`. Thiếu code, có `error` từ provider (người dùng huỷ), đổi thất bại hoặc thiếu code verifier (mở link ở trình duyệt khác) → `/login?auth_error=oauth`. Redirect dựng từ `request.nextUrl.origin` + path cố định; không đọc `next`/`redirect_to` (G1).
- **H3 — `/auth/confirm`:** `app/auth/confirm/route.ts`, `GET`. Parse `token_hash` (chuỗi không rỗng) + `type` (chỉ `email`/`signup`) bằng schema Zod nhỏ; input sai → `/login?auth_error=confirm` mà không gọi Supabase. Hợp lệ thì `verifyOtp({ type, token_hash })`: thành công → `/auth/set-password`; thất bại (hết hạn, đã dùng, sai) → `/login?auth_error=confirm`. Không đọc `next`/`redirect_to` (G1).
- **H4 — `signUpUser`:**
  - Parse `registerSchema` (đã bỏ mật khẩu).
  - **Kiểm tra công tắc đăng ký (G4)** trước mọi bước khác sau parse: đóng hoặc không đọc được → "Đăng ký tạm thời chưa khả dụng", không gọi Supabase thêm.
  - **Kiểm tra username trước khi tạo user:** service role đọc `profiles` theo username đã parse. Đã có → "Username đã được dùng, hãy thử username khác.", không tạo user. Lỗi đọc → thông điệp chung, không tạo user.
  - Service role gọi `auth.admin.createUser({ email, password: <ngẫu nhiên, G8>, email_confirm: false, user_metadata: data, app_metadata: { d7_server_created: true } })`. Trigger `handle_new_user` tạo profile như cũ.
  - Sau đó (cả khi `createUser` thành công lẫn khi báo email đã tồn tại) gọi `supabase.auth.resend({ type: "signup", email })` để Supabase gửi mail xác minh qua SMTP và template "Confirm signup". Email đang chờ nhận mail mới (theo cooldown); email đã xác minh không nhận gì.
  - Kết quả luôn là `{ success: true, needsEmailConfirmation: true }`, trừ lỗi username ở bước kiểm tra trước và input sai. Mọi lỗi của `createUser` (`email_exists`, lỗi lưu user do trigger/race username, lỗi khác) và của `resend` (`over_email_send_rate_limit`, lỗi khác) đều trả **đúng cùng result** trung tính, và log server-side mã lỗi (không log email). Không trả `error.message` của Supabase.
  - Hệ quả: khi tạo user hoặc gửi mail thực ra thất bại, người dùng thấy màn "kiểm tra email" mà không có mail. Màn này có nút "Gửi lại email" và "Gửi lại form đăng ký": quay về form với dữ liệu đã nhập còn nguyên để gửi lại sau vài phút (lần gửi lại sẽ gặp bước kiểm tra username nếu do trùng username). Câu hướng dẫn: "Không nhận được mail sau vài phút? Bấm Gửi lại email, hoặc Gửi lại form đăng ký."
  - Không cần `emailRedirectTo` vì template dùng `{{ .SiteURL }}`.
  - Thứ tự upload avatar trước khi tạo user giữ nguyên (ngoài phạm vi).
  - Thời gian phản hồi khác nhau giữa email mới và email đã có không được che (ngoài phạm vi, như G5).
- **H5 — `signInUser`:** parse `loginSchema`; input sai → "Sai email hoặc mật khẩu!" mà không gọi Supabase; mọi lỗi Supabase → "Sai email hoặc mật khẩu!" như cũ. Không xử lý riêng `email_not_confirmed` (không ai biết mật khẩu của user chưa xác minh, G8).
- **H6 — Gửi lại mail:** action mới `resendSignupConfirmation(email)` parse email; input hợp lệ thì gọi `supabase.auth.resend({ type: "signup", email })`. Mọi trường hợp (thành công, lỗi Supabase, rate limit, email sai định dạng) đều trả **cùng** `{ success: true, message }` trung tính, ví dụ "Nếu email này đang chờ xác minh, mail mới sẽ tới trong vài phút." UI tắt nút gửi lại 60 giây sau **mọi** lần bấm (cùng cooldown cho mọi kết quả).
- **H7 — `/login` đọc `auth_error`:** đọc search param và hiện thông báo cố định theo `oauth`/`confirm`. Vì page là client component, `useSearchParams` cần bọc `Suspense` để build không lỗi; nếu rắc rối thì tách phần form thành component con.
- **H8 — Hồ sơ và username một lần:**
  - **Chuẩn hoá rỗng:** `profileSchema` coi `""` (sau trim) của `username`, `dob`, `gender` là null, ở tầng schema để server tự bảo vệ. Kiểm tra kiểu input/output của `zodResolver` vẫn khớp form; nếu không thì tách schema form khỏi schema action và ghi lệch.
  - **Server đọc username hiện tại** của chính user (`select username … eq id`).
  - **Nhánh đặt username** (username hiện tại null và payload có username khác null): **một** update gồm mọi trường hồ sơ cộng `username`, lọc `.eq("id", user.id).is("username", null)` và `.select()` để biết số dòng đã ghi.
    - 1 dòng → thành công.
    - 0 dòng (request khác vừa đặt username trước) → báo "Username đã được thiết lập, vui lòng tải lại trang"; không ghi gì (không ghi nửa chừng).
    - `23505` → "Tên người dùng (Username) đã tồn tại!"; không ghi gì vì cả update là một câu lệnh.
  - **Nhánh còn lại** (username đã có, hoặc payload không có username): update các trường khác, **bỏ** `username` khỏi payload. Username gửi lên khi đã có username thì bị bỏ qua.
  - Trả kết quả thành công kèm hồ sơ đã lưu, và form gọi `onRefreshData` như hiện tại để hiện giá trị thật.
  - Form: bật ô username khi `initialData.username` rỗng; giữ disabled khi đã có.
- **H9 — Local config:**
  - `[auth.email] enable_confirmations = true`.
  - Thêm `[auth.email.template.confirmation]` với `content_path = "./supabase/templates/confirmation.html"`; template dùng link `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` và có câu "Nếu bạn không đăng ký, hãy bỏ qua email này".
  - Thêm `http://127.0.0.1:3000/**` và `http://localhost:3000/**` vào `additional_redirect_urls`.
  - Thêm `[auth.external.google]` với `enabled = false`, `client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"`, `secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"`, `skip_nonce_check = false`.
  - Owner muốn thử Google ở local thì tự tạo OAuth client dev, đặt env và đổi `enabled` ở máy mình (không commit).
  - Thêm `[auth.hook.before_user_created]` với `enabled = true`, `uri = "pg-functions://postgres/public/d7_before_user_created"` (H12).
- **H12 — Hook "Before User Created" (Quyết định 6):**
  - Migration mới chỉ tạo `public.d7_before_user_created(event jsonb) returns jsonb`, `language plpgsql`, không `security definer`, không đọc/ghi bảng nào.
  - Cho phép (trả `{}`) khi `event->'user'->'app_metadata'->>'provider' = 'google'`, hoặc khi `app_metadata.d7_server_created = true`. Marker này chỉ đặt được qua admin API (public signup không nhận `app_metadata`); nó giữ cho đăng ký qua app vẫn chạy nếu một phiên bản Supabase sau này cho hook chạy cả với admin API.
  - Mọi trường hợp khác (email, phone, anonymous, provider lạ) trả `{"error": {"http_code": 403, "message": "Signups must go through VocaSpace"}}`.
  - `grant execute … to supabase_auth_admin`; `revoke execute … from authenticated, anon, public`.
  - Hosted: Owner bật ở Authentication → Hooks → Before User Created → Postgres → `public.d7_before_user_created` (§8.2 bước 4). Migration phải có trên hosted trước khi bật hook.
- **H11 — `/auth/set-password`:** page server: chưa đăng nhập → `/login`; đã đăng nhập nhưng không đạt điều kiện G8 (không có `amr` `otp`, hoặc đã có `d7_password_set`) → `/`. Form client: mật khẩu mới + nhập lại (schema đặt mật khẩu ở §2.3). Action `setPasswordAfterConfirmation` parse input; `getUser()` (đọc cờ `d7_password_set` từ user trả về) + `getClaims()` (đọc `amr`); không đạt G8 → lỗi cố định, không gọi `updateUser`; đạt → `updateUser({ password })`, rồi service role ghi `d7_password_set = true`; thành công → `/`. `updateUser` lỗi → thông điệp chung, giữ nguyên để thử lại. Nếu hosted bật "Secure password change" thì session vừa xác minh vẫn mới nên không cần xác thực lại; session quá cũ có thể bị Supabase từ chối → thông điệp chung (giới hạn G8).
- **H10 — Test:** xem lớp test và case ở §7.

## 5. Contract theo bề mặt

### 5.1 Xác minh email (C1)

| Tình huống | Kết quả mong đợi |
| --- | --- |
| Đăng ký hợp lệ (form không có ô mật khẩu) | Không có session; `/register` hiện màn "kiểm tra email" có email đã nhập, nút "Gửi lại email", nút "Gửi lại form đăng ký" và link "Đã có tài khoản? Đăng nhập"; không vào trang chủ |
| Đăng ký lại email đã xác minh, hoặc email đang chờ (kể cả Supabase báo rate limit) | Giống hệt dòng đầu; không lộ trạng thái email |
| Đăng ký trùng username (bước kiểm tra thấy đã có), với email mới, đang chờ hay đã xác minh | Cùng thông điệp username, không tạo user |
| `createUser` lỗi (trigger/race username) hoặc `resend` lỗi (giới hạn gửi mail) | Giống hệt dòng đầu; "Gửi lại form đăng ký" mở lại form với dữ liệu cũ và gửi lại được |
| Input đăng ký sai | Lỗi validate như hiện tại; không gọi Supabase |
| Đăng ký mới đang tắt ở Supabase (`disable_signup`), hoặc không đọc được settings | "Đăng ký tạm thời chưa khả dụng"; không tạo user, không gửi mail (G4) |
| Gọi thẳng public Auth API (`signUp`, `signInWithOtp`) bằng anon key để tạo user email mới | Bị hook từ chối (403); không có user nào được tạo |
| Gọi thẳng public `signUp` cho email đang chờ (đã tạo qua app) với mật khẩu P | Mật khẩu và hồ sơ không đổi; P không đăng nhập được trước lẫn sau khi nạn nhân xác minh |
| Bấm link xác minh (cùng hoặc khác trình duyệt) | Email được xác minh, có session, tới `/auth/set-password`; F5 vẫn ở trang này |
| Đặt mật khẩu hợp lệ ở `/auth/set-password` | Về `/` đã đăng nhập; đăng xuất rồi đăng nhập bằng mật khẩu mới được |
| Đặt mật khẩu khi session là đăng nhập mật khẩu/Google, hoặc đã đặt rồi | Page chuyển `/`; action trả lỗi cố định, mật khẩu không đổi |
| Kẻ xấu đăng ký trước email nạn nhân (qua app hoặc thử qua public API), nạn nhân đăng ký lại rồi bấm link mới nhất (hoặc link cũ) | Nạn nhân đặt mật khẩu của mình; không mật khẩu nào trước đó đăng nhập được; kẻ xấu không có session |
| Dùng lại chính session `otp` ban đầu (JWT chưa refresh) để đặt mật khẩu lần hai | Bị từ chối vì cờ đọc từ `getUser()`; mật khẩu giữ nguyên |
| Link hết hạn/đã dùng/sai/thiếu tham số | Về `/login` với thông báo "Link xác minh không hợp lệ hoặc đã hết hạn" |
| Link có `next`/`redirect_to` lạ | Bỏ qua, vẫn về `/auth/set-password` hoặc `/login?auth_error=confirm` (G1) |
| Đăng nhập với tài khoản chưa xác minh | "Sai email hoặc mật khẩu!" (không ai biết mật khẩu, không lộ trạng thái) |
| Gửi lại | Luôn cùng một thông báo trung tính, cùng cooldown 60 giây, kể cả rate limit hoặc lỗi |

### 5.2 Google OAuth (C2)

| Tình huống | Kết quả mong đợi |
| --- | --- |
| Bấm nút Google ở `/login` hoặc `/register`, provider bật | Chuyển sang Google; nút disabled trong lúc chuyển |
| Provider tắt (local mặc định, hoặc production trước bước bật Google) | Toast "Đăng nhập Google hiện chưa khả dụng", ở lại trang, nút bấm lại được |
| Không lấy được settings (mạng lỗi) | Như dòng trên |
| Google trả về thành công, email mới | Hook cho qua (provider `google`); tạo user + profile (`role = student`, `full_name`/`avatar_url` từ Google, username null); về `/` đã đăng nhập; F5 vẫn đăng nhập |
| Email trùng tài khoản mật khẩu đã xác minh (đã qua G3) | Vào đúng tài khoản cũ (cùng `auth.users.id`), dữ liệu học giữ nguyên |
| Người dùng huỷ ở Google / code lỗi / thiếu code verifier | Về `/login` với thông báo "Đăng nhập Google không thành công" |
| `/auth/callback?next=https://evil.com` hoặc `redirect_to=…` | Bỏ qua, chỉ về `/` hoặc `/login?auth_error=oauth` (G1) |

### 5.3 Hồ sơ và username một lần (C3)

| Tình huống | Kết quả mong đợi |
| --- | --- |
| Username null, chỉ nhập username hợp lệ | Lưu; username được ghi; các trường rỗng khác thành null |
| Username null, để trống username, sửa họ tên/ngày sinh/giới tính | Lưu các trường đó; username vẫn null; `dob`/`gender` rỗng thành null, không lỗi SQL |
| Username null, username trùng người khác | "Tên người dùng (Username) đã tồn tại!"; không trường nào bị ghi |
| Hai request cho cùng user **cùng đọc thấy username null** rồi cùng đặt username khác nhau | Đúng một update có điều kiện ghi được; request kia ghi 0 dòng, không ghi trường nào và báo tải lại; DB giữ username của request thắng |
| Request đến sau, đọc thấy username đã có (request khác vừa đặt xong) | Đi nhánh "username đã có": username gửi lên bị bỏ qua, các trường khác vẫn lưu, báo thành công |
| Username đã có | Ô disabled như cũ; request tự chế gửi username khác qua action thì username không đổi, các trường khác vẫn lưu (Data API trực tiếp: giới hạn đã biết ở G7) |

## 6. Phụ thuộc

- C1–C3 làm và verify hoàn toàn ở local (xác minh bật), trừ Google thật (cần credential).
- Rollout production phụ thuộc Owner: Google OAuth client, SMTP, redirect allowlist, tạm tắt đăng ký + bật "Confirm email" + template + đẩy migration hook và bật hook **trước** deploy, rà tài khoản tự xác nhận, rồi mới bật Google, đúng thứ tự §8.2 (G3, G4, Quyết định 6).
- Quyết định 6 đã được Owner đồng ý (2026-10-02); implement vẫn chờ Owner cho tiếp.
- Không phụ thuộc D5/D6/D8/D9.

## 7. Checkpoints

Trước C1: thêm migration hook (H12), sửa `config.toml` (H9) rồi `npx supabase stop` → `npx supabase start` → `npx supabase db reset` để nạp config, migration và dữ liệu sạch (§9).

| CP | Outcome | Verify |
| --- | --- | --- |
| C1 | Xác minh email + đặt mật khẩu sau xác minh ở local: migration hook + config + template, schema, `/auth/confirm`, `/auth/set-password`, `signUpUser`/`signInUser`/`resendSignupConfirmation`/`setPasswordAfterConfirmation`, form đăng ký không mật khẩu + màn "kiểm tra email", thông báo ở `/login` | **Unit (mock Supabase):** `signUpUser` gọi `admin.createUser` với `email_confirm: false`, marker `d7_server_created`, mật khẩu ngẫu nhiên khác nhau mỗi lần và không có trong result, rồi gọi `resend`; mọi lỗi `createUser` (`email_exists`, lỗi lưu user, lỗi khác) và `resend` (`over_email_send_rate_limit`, lỗi khác) → cùng result trung tính; `email_exists` vẫn gọi `resend`; username đã có → không gọi `createUser`; lỗi đọc username → thông điệp chung; input sai không gọi Supabase; settings `disable_signup: true`, fetch lỗi hoặc thiếu trường → "Đăng ký tạm thời chưa khả dụng", không gọi `createUser`/`resend`. `signInUser`: input sai, lỗi Supabase. Resend: thành công/lỗi/rate limit/email sai đều cùng result. `setPasswordAfterConfirmation`: `amr` `otp` + chưa có cờ → `updateUser` rồi ghi cờ; `amr` `password`/`oauth` hoặc đã có cờ hoặc chưa đăng nhập → không gọi `updateUser`; `updateUser` lỗi → thông điệp chung; input sai/không khớp → không gọi Supabase. Route `/auth/confirm`: thành công → `/auth/set-password`, `verifyOtp` lỗi, thiếu/sai `token_hash`/`type` (không gọi Supabase), có `next`/`redirect_to` vẫn về path cố định. **Schema:** `registerSchema` không còn mật khẩu; schema đặt mật khẩu (độ dài, khớp). **Component:** register không có ô mật khẩu, hiện màn "kiểm tra email", gửi lại có cooldown, "Gửi lại form đăng ký" mở lại form và gửi lại đúng dữ liệu cũ; form đặt mật khẩu; login hiện thông báo theo `auth_error`. **Integration (local Supabase thật, xác minh bật, hook bật, test chấp nhận G8 phải pass):** **hook function** gọi trực tiếp qua kết nối Postgres local (helper `waitForLocalPostgresQuery`): payload provider `google` → `{}`; `email` không marker → lỗi 403; `email` có marker → `{}`; `phone` → lỗi. Đăng ký qua action → không session, user chưa xác minh, có mail trong inbucket (local `enable_signup = true`); đọc settings thật của stack local trả `disable_signup: false` (chứng minh tên trường); đăng ký lại email đã xác minh và email đang chờ → cùng result; username trùng với email mới/đang chờ/đã xác minh → cùng lỗi username, không user mới; resend cho email chưa tồn tại và đang chờ → cùng result. **Kẻ xấu qua public API (C3):** anon client gọi `signUp` email X với mật khẩu P → lỗi, không có user X; nạn nhân đăng ký X qua action; anon client gọi lại `signUp` X với P → P đăng nhập không được; lấy `token_hash` của mail cũ và mail mới từ inbucket, gọi handler `/auth/confirm` với một link → redirect `/auth/set-password`; **ngay sau xác minh, trước khi nạn nhân đặt mật khẩu**, `signInWithPassword(X, P)` → không có session. **Kẻ xấu qua app:** đăng ký X (lần 1), đăng ký lại X (lần 2) qua action, như trên. **Đặt mật khẩu và chặn replay (R11):** `setPasswordAfterConfirmation` với C bằng session `otp` đó → thành công; admin đọc user thật → `app_metadata.d7_password_set === true`; dùng lại **chính client giữ session `otp` ban đầu** (không refresh, JWT cũ chưa có cờ) gọi action với D → bị từ chối, không gọi `updateUser`; đăng nhập C được, D không được; session đăng nhập bằng C gọi action → bị từ chối. **Browser:** đăng ký → mail trong inbucket → bấm link → `/auth/set-password` → đặt mật khẩu → `/` đã đăng nhập, F5 vẫn đăng nhập; đăng xuất, đăng nhập bằng mật khẩu mới được; bấm lại link lần hai → `/login` báo link không hợp lệ; mở link ở trình duyệt khác (context riêng) → tới trang đặt mật khẩu |
| C2 | Google OAuth: `/auth/callback`, nút Google dùng chung ở hai trang, khối config google | **Unit route:** thành công, thiếu code, provider `error`, `exchangeCodeForSession` lỗi (gồm thiếu verifier), có `next`/`redirect_to` vẫn về path cố định. **Component nút:** settings `google: false` → toast, không gọi `signInWithOAuth`; fetch lỗi → toast; `google: true` → gọi đúng `redirectTo`; `signInWithOAuth` trả lỗi → toast, bỏ loading. **Browser local:** provider tắt → toast, ở lại trang; `/auth/callback?code=bogus` → `/login?auth_error=oauth`. Google thật **chưa verify** cho tới khi có credential (local tuỳ Owner, hoặc production sau rollout) |
| C3 | Hồ sơ chuẩn hoá rỗng + username một lần ở `/profile` | **Schema/unit:** `""` → null cho `username`/`dob`/`gender`; action chọn đúng nhánh, nhánh đã có username không gửi `username`, 0 dòng → báo tải lại. **Component:** user username null chỉ nhập username và lưu được; lưu trường khác khi để trống username; ô khoá khi đã có. **Integration (DB thật):** đặt username lần đầu; lần hai bị bỏ qua mà trường khác vẫn lưu; trùng username người khác → không trường nào đổi; hai action cùng đọc username null (client bọc có barrier ở bước đọc, nên cả hai đọc xong rồi mới cùng update; phần ghi chạy trên DB thật) với username khác nhau → đúng một thắng, bên thua ghi 0 dòng và không đổi trường nào, DB khớp; action đến sau khi username đã có → bỏ qua username, lưu trường khác. **Browser:** user username null (fixture §9) lưu hồ sơ trống rồi đặt username một lần, sau đó ô bị khoá |
| C4 | Tổng kiểm tra + docs | `npm run test:run`, `npm run test:integration`, `npx tsc --noEmit`, eslint các file đổi, `git diff --check`, `npm run build` (bắt lỗi Suspense/route handler). Dừng stack E2E cũ (`npx supabase --workdir .e2e-runtime stop`) rồi `npm run test:e2e:smoke` để chạy trên config mới, so với baseline `E2E-001`. Cập nhật State, `progress.md`, `problems.md` (follow-up §8.3) |

Phạm vi bằng chứng: chế độ xác minh **bật** được kiểm ở integration và browser local; nhánh đóng đăng ký (G4) chỉ kiểm ở unit test với settings mock (đổi `enable_signup` ở local cần khởi động lại stack nên không đưa vào integration). Giới hạn gửi mail chung không ép được ở local; chỉ có bằng chứng unit/component. Production chỉ được kiểm sau rollout (§8.2).

Checkpoint là mốc review/resume, không phải mốc commit; commit theo quyền Owner cấp (§1).

## 8. Rủi ro, dừng, rollback

### 8.1 Rủi ro

| Rủi ro | Ảnh hưởng | Giảm thiểu | Lộ ra sớm nhất |
| --- | --- | --- | --- |
| Bật Google trước khi bật xác minh email, hoặc trước khi rà tài khoản tự xác nhận | Chiếm tài khoản qua auto-linking | G3, runbook §8.2 có thứ tự và cổng cứng | Rollout |
| Request đăng ký đang chạy lúc chuyển chế độ | Thêm tài khoản tự xác nhận chưa rà | Runbook tạm tắt đăng ký mới, bật xác minh, chờ request cũ kết thúc rồi mới chốt danh sách rà (§8.2 bước 4) | Rollout |
| Kẻ xấu đăng ký trước email nạn nhân (qua app hoặc public API) | Kẻ xấu muốn giữ mật khẩu trên tài khoản nạn nhân sẽ xác minh | G8 + hook (Quyết định 6): user email chỉ do server tạo với mật khẩu ngẫu nhiên; chỉ session `otp` được đặt mật khẩu; test chấp nhận ở C1 | C1 |
| Admin tạo tài khoản thật bằng mật khẩu mặc định sau thời điểm chốt G3 | Người biết mật khẩu mặc định giữ quyền vào tài khoản sẽ được auto-link với Google của chủ email | G3 điều 3: rà mọi user không qua luồng D7; follow-up bỏ mật khẩu mặc định | Rollout |
| Hook chưa bật hoặc bị tắt trên hosted | Public `signUp` tạo lại được user đang chờ với mật khẩu tự chọn (C3) | Runbook bật hook trước khi mở lại đăng ký và smoke test public `signUp` phải bị từ chối; quy tắc cứng §8.3 | Rollout |
| Hook lỗi hoặc hosted cho hook chạy cả với admin API mà thiếu marker | Không tạo được user Google mới, hoặc đăng ký email qua app lỗi (đóng an toàn) | Marker `d7_server_created` ở H12; smoke test bước 6 và 8; sửa function bằng migration mới | Rollout |
| Hồ sơ do kẻ xấu nhập khi đăng ký trước | Username/họ tên lạ trên tài khoản nạn nhân | Giới hạn G8; Owner sửa qua dashboard | Rollout |
| Người xác minh xong mà mất session trước khi đặt mật khẩu | Không đăng nhập bằng mật khẩu được | Session giữ sau xác minh; Google sau rollout; Owner hỗ trợ; follow-up quên mật khẩu | Rollout |
| Tắt xác minh sau T_on khi còn user đang chờ | Ai biết email đang chờ có thể đăng ký lại và nhận session của user đó | §8.3: sau T_on không bao giờ tắt "Confirm email"; đăng ký qua app dùng admin API nên không bao giờ cấp session (G4) | Rollout |
| SMTP chưa cấu hình mà đã bật xác minh | Người dùng mới không nhận mail, không đăng ký được | Runbook: SMTP + gửi thử trước khi bật "Confirm email" | Rollout |
| Template hosted vẫn dùng `{{ .ConfirmationURL }}` | Link mail không tới `/auth/confirm`, người dùng không tới trang đặt mật khẩu | Runbook bắt buộc sửa template; smoke test đăng ký trên production | Rollout |
| Site URL hosted không phải `https://vocaspace.vercel.app` | Link mail trỏ sai nơi | Owner kiểm tra Site URL trong runbook | Rollout |
| `useSearchParams` trong client page làm build lỗi | CI/build fail | H7 bọc Suspense; `npm run build` ở C4 | C1 |
| Đổi kiểu `profileSchema` (preprocess) làm lệch kiểu form | `tsc` lỗi hoặc form gửi sai | H8 cho phép tách schema form; `tsc` + component test | C3 |
| Người chỉ có Google không đổi được mật khẩu, và mất truy cập nếu Google bị tắt | Form đổi mật khẩu báo lỗi; khoá ngoài khi rollback | Non-goal, ghi follow-up; rollback §8.3 nêu rõ | C4 / Rollout |
| Preview deploy dùng Supabase production | Thử Google/đăng ký trên preview tạo user thật | Chấp nhận; allowlist preview do Owner quyết | Rollout |

### 8.2 Runbook rollout cho Owner (sau khi PR được duyệt)

Agent không làm các bước này; chỉ đọc kiểm tra nếu Owner cho phép.

1. **Google Cloud Console:** tạo OAuth consent screen và OAuth client (Web). Authorized redirect URI: `https://zmnfsorjuibfjowmjtxo.supabase.co/auth/v1/callback` (thêm `http://127.0.0.1:45321/auth/v1/callback` nếu muốn thử ở local). Chưa nhập vào Supabase.
2. **Supabase → Authentication → SMTP:** nhập SMTP của nhà cung cấp đã chọn, gửi mail thử tới một địa chỉ ngoài team. Xem lại Rate Limits.
3. **Supabase → Authentication → URL Configuration:** Site URL `https://vocaspace.vercel.app`; Redirect URLs thêm `https://vocaspace.vercel.app/**` (và mẫu preview Vercel nếu muốn thử trên preview). Kiểm tra lại trạng thái "Confirm email" hiện tại (dự kiến đang tắt, §3), và xác nhận provider **Phone** đang tắt (G8 dựa vào điều này khi coi `amr` `otp` là từ email).
4. **Chuyển chế độ, khi PR đã được duyệt và sẵn sàng merge:**
   - tạm tắt đăng ký mới (Authentication → "Allow new users to sign up" tắt);
   - **bật "Confirm email"** (Authentication → Providers → Email); ghi lại thời điểm T_on. Từ đây **không tắt lại** (§8.3);
   - Email Templates → Confirm signup: đổi link thành `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`, nội dung theo `supabase/templates/confirmation.html` (gồm "bấm để xác minh và đặt mật khẩu" và "Nếu bạn không đăng ký, hãy bỏ qua email này");
   - **hook "Before User Created":** đẩy migration hook lên hosted (Owner chạy `supabase db push`, hoặc agent khi Owner cho phép riêng), rồi Authentication → Hooks → Before User Created → Postgres → `public.d7_before_user_created`, bật. Lúc này đăng ký đang tắt nên public `signUp` bị chặn trước hook (`422 signup_disabled`), chưa thử hook qua API được. Chỉ kiểm tra đọc: function `public.d7_before_user_created` tồn tại, `supabase_auth_admin` có quyền execute, `anon`/`authenticated` không có, và trang Hooks hiển thị hook đang bật với đúng function. Phép thử qua public API làm ở bước 6;
   - chờ ít nhất 2 phút để request đăng ký đang chạy với cấu hình cũ kết thúc;
   - **chốt danh sách rà G3**: lấy **toàn bộ** user hiện có, ví dụ truy vấn đọc `select id, email, created_at, email_confirmed_at, last_sign_in_at from auth.users order by created_at;` (Owner chạy, hoặc agent chạy khi Owner cho phép). Lưu danh sách id ngoài repo.

   Trong lúc đăng ký đang tắt, người dùng cũ vẫn đăng nhập bình thường.
5. **Merge PR, chờ deploy production READY.** Nút Google báo "chưa khả dụng" vì provider còn tắt. Đăng ký qua app báo "Đăng ký tạm thời chưa khả dụng" vì đăng ký đang tắt (G4); thử một lần để xác nhận và kiểm tra không có user mới.
6. **Bật lại đăng ký mới**, rồi **ngay lập tức** thử hook qua public API: gọi public `signUp` bằng anon key với một email test (ví dụ `curl` tới `/auth/v1/signup`) → phải nhận đúng lỗi của hook (403, thông điệp "Signups must go through VocaSpace") và không có user mới. Nếu không: tắt lại đăng ký ngay, xoá user test nếu có, dừng. Sau đó thử đăng ký một email thật qua app: nhận mail, bấm link, đặt mật khẩu, vào trang chủ đã đăng nhập; đăng xuất và đăng nhập lại bằng mật khẩu mới. Nếu đăng ký qua app lỗi do hook: tạm tắt đăng ký mới (giữ hook bật), sửa function bằng migration mới. Rollout chỉ coi là hoàn tất khi cả hai phép thử đạt.
7. **Cổng G3 — rà từng tài khoản trong danh sách ở bước 4** theo G3 (chủ thật đã tự đặt mật khẩu, hoặc xoá/ban). User tạo sau thời điểm chốt chỉ được miễn rà khi có `app_metadata.d7_server_created = true` (luồng D7); mọi user khác (admin, dashboard, import) phải rà theo G3 điều 3. Cách tìm: lấy tập `id` hiện tại của `auth.users` (truy vấn đọc), trừ tập `id` đã lưu ở bước 4 và các `id` đã rà ở lần trước; mỗi `id` còn lại mà không có `app_metadata.d7_server_created = true` và không phải user chỉ có danh tính Google đều phải rà. Không lọc theo `created_at` (transaction tạo user commit sau lúc chốt vẫn có thể mang `created_at` trước đó). Lưu tập `id` đã rà ngoài repo cho lần sau. Ghi kết quả rà (số tài khoản, cách xử lý; không ghi email) vào `progress.md`.
8. **Chỉ sau bước 4 và 7: bật Google provider** với client ID/secret từ bước 1. Thử đăng nhập Google bằng một tài khoản mới (xác nhận hook cho qua provider `google`) và một tài khoản trùng email người dùng cũ đã qua cổng G3.

### 8.3 Dừng và rollback

- **Dừng** khi:
  - cần migration khác ngoài hook function (H12), hoặc sửa trigger;
  - qua mail thật + `/auth/confirm`, session không có `amr` `otp`, `updateUser` làm mất session, hoặc `updateUserById` ghi đè `app_metadata` (khác spike §3);
  - ở local, hook không chặn public `signUp`/`signInWithOtp`, hoặc chặn `admin.createUser` có marker, hoặc `resend` không gửi mail cho user do admin tạo (khác spike hook §3);
  - build/test có lỗi mới không do baseline;
  - phát hiện cần nhận path redirect từ query.
- **Quy tắc cứng sau T_on:** không tắt "Confirm email", không tắt hook "Before User Created", và không gỡ `/auth/confirm`, màn "kiểm tra email" hay G8 (mật khẩu ngẫu nhiên lúc đăng ký, `/auth/set-password`). Lý do: khi xác minh tắt, đăng ký lại một email đang chờ sẽ được xác nhận và nhận session mà không cần mật khẩu cũ (§3), nên ai biết email đang chờ là chiếm được tài khoản đó; tắt hook thì public `signUp` lại tạo được user đang chờ với mật khẩu tự chọn (C3); tắt Google trước cũng không chặn được các đường này.
- **Sự cố Google:** tắt Google provider. Nút Google tự báo "chưa khả dụng" (H1); luồng email vẫn chạy. Người chỉ có Google mất truy cập cho tới khi bật lại (không có mật khẩu, không có quên mật khẩu); Owner cần thông báo cho họ. Trước **mỗi lần** bật lại Google, rà lại theo bước 7 (đối chiếu tập `id`) mọi user mới không thuộc diện miễn, vì admin có thể đã tạo user bằng mật khẩu mặc định trong lúc Google tắt; "Confirm email" không bảo vệ đường admin API.
- **Sự cố mail (SMTP, template):** giữ "Confirm email" bật và giữ code. Nếu mail không gửi được, tạm tắt đăng ký mới ở Supabase (Authentication → "Allow new users to sign up" tắt) trong lúc sửa SMTP/template, rồi bật lại; công tắc này đóng cả public API lẫn đăng ký qua app (G4). Người đang chờ dùng "Gửi lại email" sau khi sửa xong.
- **Sự cố code:** sửa tiếp bằng PR mới. Nếu phải gỡ, chỉ gỡ phần lỗi (ví dụ nút Google, form username) và giữ các phần ở quy tắc cứng. **Không revert toàn bộ PR sau khi đã bật lại đăng ký ở bước 6** (code cũ nhận mật khẩu lúc đăng ký, gọi public `signUp` vốn bị hook chặn, và không có `/auth/confirm`). Không revert migration hook; sửa function bằng migration mới. Nếu sự cố trước bước 6 (đăng ký vẫn đang tắt, nên G4 đã chặn đăng ký qua app và chưa có user D7 nào chờ link): có thể revert code, giữ đăng ký tắt và giữ hook cho tới khi có bản sửa; không bật lại đăng ký với code cũ khi "Confirm email" đã bật.
- **Follow-up D7b — quên mật khẩu (Owner đồng ý 2026-10-02):** PR riêng làm ngay sau D7: trang "Quên mật khẩu" gửi mail recovery, link về route xác minh, rồi đặt mật khẩu mới. Giải quyết người mất session trước khi đặt mật khẩu (giới hạn G8) và người chỉ có Google muốn có mật khẩu. Có thể merge cả D7 và D7b rồi mới bật lại đăng ký ở §8.2 bước 6. Không làm trong D7.
- **Follow-up ghi vào `problems.md` khi implement xong:**
  - người chỉ có Google chưa đặt được mật khẩu;
  - giới hạn G8: người mất session trước khi đặt mật khẩu cần Google/Owner cho tới khi có D7b; hồ sơ do người đăng ký trước nhập; chủ hộp thư đặt được mật khẩu qua magic link API khi chưa có cờ;
  - D7b quên mật khẩu (ở trên);
  - username vẫn đổi được qua Data API trực tiếp (G7);
  - `createUserByAdmin` (`app/actions/user.ts`) tạo user với mật khẩu mặc định đã biết và `email_confirm: true`; khi Google bật, các user này cần rà (G3 điều 3) cho tới khi đổi sang mật khẩu ngẫu nhiên + mời đặt mật khẩu;
  - chống dò email ở tầng Supabase Auth API ngoài phạm vi app (G5);
  - lệch enum giới tính register/profile;
  - toast "Chủ tịch Ú" (nếu C1 không thay toast đó).

## 9. QA fixture readiness

- **Dữ liệu cần:**
  - (a) email chưa tồn tại để đăng ký; xem mail trong inbucket `http://127.0.0.1:45324`;
  - (b) user đã xác minh có username null để thử C3;
  - (c) user có username để thử ô bị khoá (learner seed `student@gmail.com` đã có).
- **Kết luận:** không cần sửa `seed.sql`.
  - (a) tạo trong lúc QA.
  - (b) không lấy được từ (a) vì form đăng ký bắt buộc username. Tạo bằng admin `createUser` (`email_confirm: true`, không có metadata username) trong lúc QA, không commit; user này giống user Google mới về mặt hồ sơ. Integration test tự tạo và dọn user riêng.
- **Host local:** QA mở app ở `http://127.0.0.1:3000` (trùng `site_url`), vì link xác minh trỏ về `site_url`; mở ở `localhost` thì cookie session nằm ở host khác.
- **Google thật:** không có fixture local; kiểm tra trên production sau bước 8 của runbook, hoặc ở local nếu Owner tự cấu hình credential.
- **Nạp config và reset:**
  - đổi phần auth của `config.toml` thì `npx supabase stop` rồi `npx supabase start`, sau đó `npx supabase db reset` cho dữ liệu sạch;
  - stack E2E ở `.e2e-runtime/` dừng riêng trước khi chạy E2E (§3, C4).
- **G8 / hook:** tạo trong lúc QA bằng hai lần đăng ký cùng email, và một lần gọi public `signUp` bằng anon key; integration test tự tạo và dọn user.
- **Browser QA bắt đầu khi:** C1–C3 xong.

## 10. State

```txt
Current Spec revision: d7/plan.md 2026-10-02 r8 (sửa cách rà G3 bổ sung sau Codex plan review r7)
Current Checkpoint: chưa bắt đầu (plan-only)
Status: r1 tự review (2 vòng). Codex r1–r4 FAIL. r4: C1, R8 đã giải quyết; R1 còn race; C3 chưa giải quyết; mới C4, R9 (đều do cơ chế cờ G8 cũ).
  r5: Owner chọn đặt mật khẩu sau xác minh (Quyết định 5). G8 mới: signUp dùng mật khẩu ngẫu nhiên; chỉ session amr=otp chưa có cờ d7_password_set được đặt mật khẩu bằng updateUser của chính session. Bỏ cờ untrusted, bỏ admin đổi mật khẩu, bỏ xử lý email_not_confirmed.
  R1: lỗi username chỉ khi bước kiểm tra trước signUp thấy trùng; mọi lỗi signUp khác trả result trung tính.
  G4: runbook bật xác minh + tạm tắt đăng ký trước deploy; code đóng an toàn khi signUp trả session.
  Spike local xác nhận amr otp, updateUser giữ session, app_metadata gộp (§3).
  Codex r5 FAIL: R1 đã giải quyết; C4, R9 không còn áp dụng; C3 còn (public signUp tạo trước user với mật khẩu tự chọn); mới R10 (quyền implement lệch), R11 (test chưa chứng minh chặn replay), A4 (amr otp gồm cả SMS).
  r6: Quyết định 6 (đề xuất, chờ Owner xác nhận): hook Before User Created chỉ cho provider google hoặc marker d7_server_created; signUpUser dùng admin.createUser + resend. Spike hook local xác nhận hook chặn public signUp/OTP, không chạy với admin API, resend gửi mail cho user do admin tạo, re-signup public không đổi mật khẩu (§3).
  R10: §1 và progress.md ghi quyền mới. R11: integration assert cờ trên user thật và dùng lại session otp ban đầu. A4: phạm vi amr otp. Thêm follow-up D7b.
  Codex r6 FAIL: C3, R10, R11 đã giải quyết; A4 một phần (advisory). Mới R12 (smoke test hook không chạy được khi đăng ký tắt), R13 (admin API bỏ qua công tắc đóng đăng ký), R14 (user do admin tạo sau thời điểm chốt bị miễn rà G3), A5 (còn câu G4 cũ).
  r7: G4 đọc /auth/v1/settings disable_signup phía server, đóng an toàn; runbook bước 4 chỉ kiểm đọc hook, phép thử public API chuyển sang ngay sau khi mở lại đăng ký ở bước 6; G3 điều 3 chỉ miễn rà user có marker d7_server_created; runbook bước 3 xác nhận Phone tắt; sửa câu G4 cũ; follow-up createUserByAdmin.
  Codex r7 FAIL: R12, R13, A4, A5 đã giải quyết; R14 một phần (rollback bật lại Google còn miễn rà); mới R15 (lọc theo created_at có thể bỏ sót user commit muộn).
  r8: rà bổ sung bằng đối chiếu tập id hiện tại với tập id đã chốt/đã rà, bỏ lọc created_at; rà lại trước mỗi lần bật lại Google.
  Codex r8: PASS (R14, R15 đã giải quyết; không còn Critical/Required). PASS ở mức plan. Owner đồng ý Quyết định 6 (2026-10-02), chưa cho implement.
Completed evidence: discovery repository + hosted (đọc) + tài liệu/mã nguồn Supabase + hai spike local như §3; chưa chạy test, browser hay build
Accepted bounded deviations: không
Open blockers or Owner decisions: Owner đã đồng ý Quyết định 6 (2026-10-02); Owner chưa cho implement (dặn 2026-10-02: chưa implement); Owner chọn nhà cung cấp SMTP và tự cấu hình hosted theo §8.2 trước khi rollout
  2026-10-02: Owner split D7 into the auth-onboarding program (4 PRs); this file became the reviewed source (see banner).
Next action: none; progress tracked in ../progress.md
Current authority: sau Codex PASS: commit plan local rồi dừng; implement cần Owner cho tiếp; không push, PR, merge hay thao tác hosted
```
