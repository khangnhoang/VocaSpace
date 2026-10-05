# A4b detail plan — Privacy policy and terms pages

Revision: r3, 2026-10-05 (Codex plan review r1 FAIL, 8 Required, fixed in r2; r2 FAIL, 3 Required, fixed in r3; r3 PASS, 0 Critical/0 Required; r3.1 makes the order sequential per the Owner; Owner-approved 2026-10-05; the Owner chose option A for AUTH-019: fix it in its own PR, and publish only after both are live). Master plan: [plan.md](../../plan.md) (Decision 12, §5 A4b, §7 gates). Content decisions: Owner, 2026-10-05, listed in §1.4.

Branch `feat/auth-a4b-legal-pages` from `main` `cbd87e9`. Size: small — no migration, no server action, no schema; two static pages, footer links, one consent line on two auth pages, tests. The rollout is the Owner's Google consent-screen publish (A4 R2), which needs these pages live.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: production serves a Vietnamese privacy policy at `/privacy` and terms of use at `/terms`. The home page links to both, and `/login` and `/register` tell the user that continuing means they are 16 or older and accept both. The Owner can then enter the homepage, privacy and terms URLs on the Google OAuth consent screen and publish the app to "In production" (A4 rollout R2), so Google sign-in is no longer limited to test users.

| ID | Observable result |
| --- | --- |
| AC1 | `GET /privacy` renders the privacy policy with the exact copy of Appendix A: page title "Chính sách quyền riêng tư", a "Cập nhật lần cuối" date, and a `mailto:support@vocaspace.com` link; the browser tab title is "Chính sách quyền riêng tư \| VocaSpace" |
| AC2 | `GET /terms` renders the terms with the exact copy of Appendix B: page title "Điều khoản sử dụng", the same date, the 16+ rule, the payment and removed-course clauses and the `mailto:` link; the tab title is "Điều khoản sử dụng \| VocaSpace" |
| AC3 | Both pages are public: signed out and signed in (any role) they render with status 200 and no redirect; each links to the other |
| AC4 | The home page footer "Pháp lý" links point to `/privacy` ("Chính sách quyền riêng tư") and `/terms` ("Điều khoản sử dụng"); the other footer links stay unchanged |
| AC5 | `/login` shows the consent line of §1.4 decision 6 under the Google button; `/register` shows it on step 1 under the Google button. The two link words go to `/terms` and `/privacy`. No checkbox; steps 2–3 and the check-email screen do not show it |
| AC6 | The admin user list no longer sends a user's email to `api.dicebear.com`: the fallback avatar seed is the user `id` (decision 1); the policy lists DiceBear as receiving that id |
| AC7 | (Production, Owner rollout R1–R2.) After the deploy is READY, `https://vocaspace.vercel.app/privacy` and `/terms` load signed out, and the Owner enters the URLs on the Google consent screen and publishes the app |

### 1.2 Scope and non-goals

- In scope:
  - `app/(client)/privacy/page.tsx` and `app/(client)/terms/page.tsx` (server components, static copy, `metadata` title);
  - the two "Pháp lý" links in `app/(client)/page.tsx`;
  - the consent line in `app/(client)/login/page.tsx` and `app/(client)/register/page.tsx` step 1;
  - the dicebear seed in `app/admin/user-management/page.tsx` (default 1);
  - component tests for the pages, the footer links and the consent line.
- Non-goals:
  - a consent checkbox, stored consent record, age check or age field (decision 4);
  - self-service account deletion, data export, a cookie banner (no non-essential cookies exist);
  - the other `#` footer links (Home, Product, Contact Us, social);
  - an English version of the pages;
  - teacher course removal rules for bought courses and global discount codes ([future-features.md](../../future-features.md) FEAT-002, FEAT-003);
  - any claim of compliance with a specific law.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Page copy is Appendix A/B verbatim, except the date line; any wording change goes back to the Owner | The published legal text says something the Owner never approved |
| G2. Every statement about data, third parties, cookies and payments matches the repository facts in §2; a code change that makes one untrue (new tracker, new third party, new stored field) must update the page in the same PR | Google review or a user relies on a false policy |
| G3. The "Cập nhật lần cuối" date is set to the merge date in the last commit before merge (decision 9); until then it holds the implementation date | The effective date does not match when the text went live |
| G4. Pages are static server components with no data fetch and no auth check; middleware is not changed | A signed-out Google reviewer gets a redirect or an error instead of the policy |
| G5. The agent does not touch the Google Cloud console, Vercel or Supabase settings; R1–R2 are the Owner's | Violates program authority |

### 1.4 Owner decisions that bind this unit

All from the Owner, 2026-10-05.

1. **(Owner-approved 2026-10-05)** Fix the dicebear email seed in this PR (AC6, one line: seed `p.id`) so the policy's third-party list is true at publish. Alternative: keep it for the post-A4 batch and list `api.dicebear.com` as a recipient of admin-viewed emails in the policy until then.
2. Contact: `support@vocaspace.com` (Cloudflare Email Routing to the Owner, set up by the Owner before publish). The Google "User support email" stays the Owner's Gmail.
3. Operator: "nhóm phát triển VocaSpace", no personal names. Wording (Owner-approved 2026-10-05): "một dự án do nhóm phát triển VocaSpace vận hành"; "phi thương mại" is not used because the platform sells paid courses.
4. Audience 16+: terms say "Bạn phải từ 16 tuổi trở lên"; privacy says VocaSpace does not knowingly collect data of anyone under 16 and deletes it on request. No age check in the product.
5. Teachers own their content and are responsible for its copyright; VocaSpace may store and display it to run the service and may remove violating content.
6. Consent line, no checkbox, on `/login` and `/register` step 1: "Bằng việc tiếp tục, bạn xác nhận đã đủ 16 tuổi và đồng ý với [Điều khoản sử dụng] và [Chính sách quyền riêng tư] của VocaSpace." It covers email and Google sign-in.
7. Payments (1a): "Khoản thanh toán thành công không được hoàn lại, trừ khi lỗi từ hệ thống (ví dụ đã trừ tiền nhưng khoá học không được mở); khi đó VocaSpace sẽ mở khoá học hoặc hoàn tiền."
8. Removed courses (option A, matching current code): the removed-course clause in Appendix B §6, ending with support such as a discount code for another course.
9. Effective date = merge date (G3).
10. **(Owner-approved 2026-10-05, option a)** Account deletion on request to the contact email, completed within 30 days; order records may be kept after deletion only as long as needed to settle a payment issue. The admin delete action likely fails today for a user with enrollments, payments or progress (AUTH-018), so a request is handled by hand until that is fixed; no deletion feature in this unit. The manual procedure (dependent rows, retained order records, uploaded avatar in Storage) is written and run at the first request, inside the 30 days (AUTH-018); it is not a publish gate.
11. **(Owner-approved 2026-10-05, option A)** AUTH-019 (anyone can read profile emails, phones, dob) is fixed in its own security PR, not in A4b. The Owner's order: the AUTH-019 PR is merged and live in production first; only then is A4b rebased on `main` and implemented, because Appendix A says email, phone, dob and gender are visible only to the user and admins; the Google "Publish app" step (R2) then follows the A4b deploy.

## 2. Repository facts

Baseline: `cbd87e9`, checked 2026-10-05.

- `app/(client)/page.tsx` footer "Pháp lý" column: `<Link href="#">Privacy Policy</Link>` and `<Link href="#">Terms of Use</Link>` with class `text-gray-400 hover:text-[#5FE8EF] hover:translate-x-2 transition-all duration-300`; the other footer links are also `#` — justifies AC4 and its non-goal.
- `app/(client)/layout.tsx` wraps every `(client)` page with `Header` and `main`; `app/layout.tsx` sets `metadata.title = "VocaSpace"` — new pages go in `(client)` and set their own `metadata`.
- `utils/supabase/middleware.ts` redirects only `/teacher` (signed out) and `/login`, `/register` (signed in) — `/privacy` and `/terms` need no change (AC3, G4).
- `/login` renders `<GoogleSignInButton />` in the `CardFooter` grid after the submit button; `/register` step 1 renders it after "Tiếp tục" — placement for AC5.
- Data collected (privacy §2): `signUpUser` (`app/actions/auth.ts`) takes email, username, full name, phone, date of birth, gender and an avatar uploaded to the public `avatars` storage bucket; the password is set after email verification (`/auth/set-password`) and stored by Supabase Auth as a hash; Google sign-in requests `openid`, `email`, `profile` and `handle_new_user` copies `full_name` and `avatar_url`; learning data in `enrollments` and the learning tables; teacher course content and media in storage.
- Payments: `app/actions/payment.ts` and `app/api/webhook/payos/route.ts` use PayOS (`@payos/node`); the app stores `payments` rows (user, course, amounts, discount, status, gateway order id and metadata), no card or bank data; the QR image URL points to `api.qrserver.com` with the PayOS QR string in it, and `PublicCoursePaymentStageQr.tsx` renders it through `next/image`, so the Next.js image optimizer (server side) fetches it.
- `enrollments` have no expiry. `deleteCourse` (`app/actions/course.ts`) soft-deletes with `removed_at`; `can_view_course_basic` (migration `20260609114505`) then lets only admins and `owner`/`co_owner` collaborators see the course, so learners lose access — justifies decision 8. `discounts.course_id` is `NOT NULL` (per-course codes).
- No analytics, ads or tracking dependency in `package.json`; cookies are the Supabase auth session cookies plus `sidebar_state` (open/closed sidebar, 7 days, `components/ui/sidebar.tsx`).
- Other third parties: Supabase (database, auth, storage), Vercel (hosting), Resend (auth emails from `noreply@auth.vocaspace.com`), Google (sign-in). `app/admin/user-management/page.tsx:53` builds a fallback avatar from `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.email}` — for each listed user without `avatar_url`, the admin's browser sends that email to dicebear (AC6). Images from other hosts load directly in the visitor's browser: the home page testimonial avatar from `github.com` (`AvatarImage`), and the course thumbnail fallback from `images.unsplash.com`. `support@vocaspace.com` is forwarded by Cloudflare Email Routing (decision 2).
- `profiles` policy "Profiles - Public Active Select" (`FOR SELECT USING (removed_at IS NULL)`, no role) plus `GRANT ALL ON TABLE profiles TO anon` (migration `20260609114505`): anyone with the public anon key can read every active profile's email, phone, dob and gender. Reproduced on the local stack 2026-10-05 (signed-out REST read returned emails); production confirmed by a signed-out count-only read on 2026-10-05 (AUTH-019).
- No self-service account deletion; `deleteUserByAdmin` exists in `app/actions/user.ts` — justifies decision 10.
- Google consent screen (Owner, 2026-10-05): "Publish app" is refused without a privacy policy URL; R2 of A4 is blocked on this unit.

## 3. Bounded implementation hypotheses

- H1. A static server component with `export const metadata` under `(client)` renders for anonymous visitors with status 200; checked in browser QA and on production at R1.
- H2. `next/link` to `/privacy` and `/terms` inside the auth cards does not change form submission or the Google button behavior; the existing `/login` and `/register` component tests keep passing.
- H3. Google publishing with only `openid`, `email`, `profile` does not trigger a verification review; if the console asks for brand or domain verification, R2 stops and the Owner decides.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | `/privacy`, `/terms`, footer links and the dicebear seed meet AC1–AC4 and AC6 | **Copy:** a script compares each rendered page's text (whitespace-normalized) with its appendix and must report no difference except the date value; both pages show the same date. **Component:** each page renders its title, the date line and a `mailto:support@vocaspace.com` link, and links to the other page; each page's exported `metadata.title` equals the AC1/AC2 tab title; the home footer has links with names "Chính sách quyền riêng tư" → `/privacy` and "Điều khoản sử dụng" → `/terms`. The dicebear line is a one-line change checked by `tsc` and reading the diff (no new test) |
| CP2 | The consent line meets AC5 and the full unit is checked | **Component:** `/login` and `/register` step 1 show the consent text with links to `/terms` and `/privacy`; step 2, step 3 and the check-email screen do not. **Full checks:** `npm run test:run`, `npx tsc --noEmit`, eslint on changed files, `git diff --check`, `npm run build`, `npm run docs:check`; smoke E2E only if a changed file is under an existing smoke path (failures must equal the E2E-001 baseline plus AUTH-010). **Local browser QA** at `http://127.0.0.1:3000`: signed out and signed in as `student@gmail.com`, `/privacy` and `/terms` render with no redirect and no console errors at 375 px and desktop width; footer links open the pages; the consent links on `/login` and `/register` step 1 open the pages; the Google button and email sign-in still work as after A4 (local Google is off, so the button shows the unavailable toast; real OAuth stays with A4 R6–R7) |

QA fixture readiness: `supabase/seed.sql` after `npx supabase db reset` gives the signed-in student; the pages need no data. Browser QA may begin when the CP2 component tests pass.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| The published text promises something the code does not do | G1, G2; §2 facts; review checks each claim against code |
| `support@vocaspace.com` does not deliver | R0: the Owner sends a test mail before publish |
| Google asks for verification on publish | H3: stop at R2 and report; Google stays in testing mode, test users keep working |
| A later PR adds a tracker or third party without updating the policy | G2; noted in the policy section "Thay đổi chính sách" and in review |

Owner rollout (after merge):

- R0 (before or after merge): Cloudflare Email Routing for `support@vocaspace.com` set up; a test mail arrives.
- R1: production deploy READY for the merge commit; open `https://vocaspace.vercel.app/privacy` and `/terms` in a private window (signed out).
- R2 (resumes A4 R2; only after R1 and after the AUTH-019 fix is live in production, decision 11): Google Cloud → OAuth consent screen: Application home page `https://vocaspace.vercel.app`, privacy policy `https://vocaspace.vercel.app/privacy`, terms `https://vocaspace.vercel.app/terms`, authorized domain `vocaspace.vercel.app`; then "Publish app". A4 R3–R7 continue from there.

Rollback: revert the PR; the pages disappear, so the Owner must move the Google app back to testing first, because a published app must keep a working privacy policy URL.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).

## Appendix A — `/privacy` copy

> # Chính sách quyền riêng tư
>
> Cập nhật lần cuối: <ngày merge, dd/mm/yyyy>
>
> VocaSpace là một dự án do nhóm phát triển VocaSpace vận hành. Chính sách này cho biết chúng tôi thu thập dữ liệu gì khi bạn dùng VocaSpace, dùng để làm gì và bạn có những quyền gì.
>
> ## 1. Dữ liệu chúng tôi thu thập
>
> - **Thông tin tài khoản:** email và mật khẩu. Mật khẩu được lưu dưới dạng băm (mã hoá một chiều), không lưu ở dạng đọc được.
> - **Thông tin hồ sơ bạn cung cấp:** tên đăng nhập, họ tên, số điện thoại, ngày sinh, giới tính và ảnh đại diện.
> - **Khi đăng nhập bằng Google:** email, họ tên và ảnh đại diện từ tài khoản Google của bạn. Chúng tôi không nhận mật khẩu Google và không truy cập dữ liệu khác trong tài khoản Google.
> - **Dữ liệu học tập:** khoá học bạn tham gia, tiến độ học, bài làm và kết quả ôn tập.
> - **Nội dung của giáo viên:** khoá học, bài học, câu hỏi, hình ảnh và tệp mà giáo viên tải lên.
> - **Thông tin thanh toán:** mã đơn hàng, khoá học, số tiền, mã giảm giá đã dùng và trạng thái thanh toán. Chúng tôi không lưu số thẻ hay thông tin tài khoản ngân hàng của bạn.
>
> ## 2. Chúng tôi dùng dữ liệu để làm gì
>
> - Tạo và duy trì tài khoản, cho phép bạn đăng nhập.
> - Gửi email xác minh tài khoản và khôi phục mật khẩu.
> - Mở khoá học, lưu tiến độ và hiển thị kết quả học tập của bạn.
> - Xử lý thanh toán khoá học.
> - Hỗ trợ khi bạn liên hệ, giữ an toàn cho hệ thống và xử lý vi phạm.
>
> **Ai xem được thông tin của bạn:** tên đăng nhập, họ tên và ảnh đại diện có thể hiển thị cho người dùng khác và khách truy cập (ví dụ tên giáo viên trên trang khoá học). Ảnh đại diện được lưu ở dạng công khai, ai có đường dẫn ảnh đều xem được. Email, số điện thoại, ngày sinh và giới tính chỉ bạn và quản trị viên VocaSpace xem được.
>
> Chúng tôi không bán dữ liệu của bạn, không dùng dữ liệu để quảng cáo và không theo dõi hành vi của bạn trên các trang web khác.
>
> ## 3. Cookie
>
> VocaSpace dùng cookie để giữ phiên đăng nhập và để ghi nhớ trạng thái giao diện (ví dụ thanh bên đang đóng hay mở). Chúng tôi không dùng cookie quảng cáo hay công cụ phân tích hành vi.
>
> ## 4. Dịch vụ bên thứ ba
>
> Để vận hành, VocaSpace dùng các dịch vụ sau. Mỗi dịch vụ chỉ nhận phần dữ liệu cần cho việc của nó, và có thể lưu dữ liệu tại máy chủ ngoài Việt Nam:
>
> - **Supabase:** lưu cơ sở dữ liệu, tài khoản và tệp tải lên.
> - **Vercel:** lưu trữ và chạy website.
> - **Resend:** gửi email xác minh và khôi phục mật khẩu.
> - **Google:** đăng nhập bằng Google, nếu bạn chọn cách này.
> - **PayOS:** xử lý thanh toán khoá học.
> - **QR Server (api.qrserver.com):** nhận nội dung mã QR của đơn hàng để tạo ảnh mã QR thanh toán.
> - **Cloudflare:** chuyển tiếp email bạn gửi tới support@vocaspace.com.
> - **DiceBear:** tạo ảnh đại diện mặc định trong trang quản trị, chỉ nhận mã định danh của tài khoản (không nhận email).
>
> Một số hình ảnh trên website được tải trực tiếp từ dịch vụ lưu trữ ảnh bên ngoài (ví dụ GitHub, Unsplash, hoặc địa chỉ ảnh do giáo viên dùng cho khoá học). Khi đó trình duyệt của bạn gửi tới các dịch vụ này thông tin kỹ thuật thông thường như địa chỉ IP.
>
> ## 5. Lưu trữ và xoá dữ liệu
>
> Chúng tôi giữ dữ liệu của bạn khi tài khoản còn hoạt động. Bạn có thể yêu cầu xoá tài khoản bằng cách gửi email tới support@vocaspace.com từ email của tài khoản; chúng tôi sẽ xoá trong vòng 30 ngày. Thông tin đơn hàng có thể được giữ lâu hơn chỉ khi cần để giải quyết một vấn đề thanh toán.
>
> ## 6. Quyền của bạn
>
> - Xem và sửa thông tin hồ sơ tại trang Hồ sơ.
> - Yêu cầu bản sao dữ liệu hoặc yêu cầu xoá tài khoản qua email.
> - Ngừng đăng nhập bằng Google bất kỳ lúc nào; bạn vẫn có thể đặt mật khẩu qua "Quên mật khẩu".
>
> ## 7. Bảo mật
>
> Kết nối tới VocaSpace được mã hoá bằng HTTPS, và mỗi người dùng chỉ truy cập được dữ liệu mà họ có quyền xem. Không hệ thống nào an toàn tuyệt đối; nếu phát hiện vấn đề bảo mật, hãy báo cho chúng tôi qua email bên dưới.
>
> ## 8. Người dưới 16 tuổi
>
> VocaSpace dành cho người từ 16 tuổi trở lên. Chúng tôi không cố ý thu thập dữ liệu của người dưới 16 tuổi. Nếu bạn biết một người dưới 16 tuổi đã tạo tài khoản, hãy liên hệ để chúng tôi xoá dữ liệu đó.
>
> ## 9. Thay đổi chính sách
>
> Khi chính sách thay đổi, chúng tôi cập nhật trang này và ngày "Cập nhật lần cuối" ở đầu trang. Với thay đổi quan trọng, chúng tôi sẽ thông báo trên website.
>
> ## 10. Liên hệ
>
> Mọi câu hỏi về quyền riêng tư, xin gửi tới [support@vocaspace.com](mailto:support@vocaspace.com).
>
> Xem thêm: [Điều khoản sử dụng](/terms).

## Appendix B — `/terms` copy

> # Điều khoản sử dụng
>
> Cập nhật lần cuối: <ngày merge, dd/mm/yyyy>
>
> VocaSpace là một dự án do nhóm phát triển VocaSpace vận hành: nền tảng học từ vựng trực tuyến, nơi giáo viên tạo khoá học và học viên học theo khoá học. Khi tạo tài khoản, đăng nhập hoặc sử dụng VocaSpace, bạn đồng ý với các điều khoản dưới đây và với [Chính sách quyền riêng tư](/privacy).
>
> ## 1. Độ tuổi
>
> Bạn phải từ 16 tuổi trở lên để sử dụng VocaSpace.
>
> ## 2. Tài khoản
>
> - Bạn cung cấp thông tin đúng và giữ bí mật mật khẩu của mình.
> - Bạn chịu trách nhiệm về hoạt động diễn ra trong tài khoản của mình.
> - Nếu bạn đăng nhập bằng Google với email trùng với một tài khoản VocaSpace đã có, bạn sẽ vào chính tài khoản đó.
> - Nếu nghi ngờ tài khoản bị người khác sử dụng, hãy đổi mật khẩu và báo cho chúng tôi.
>
> ## 3. Quy tắc sử dụng
>
> Bạn không được:
>
> - dùng VocaSpace cho mục đích trái pháp luật;
> - tải lên nội dung vi phạm bản quyền, xúc phạm, lừa đảo hoặc độc hại;
> - truy cập trái phép tài khoản, dữ liệu hoặc hệ thống của VocaSpace;
> - làm gián đoạn hoặc gây quá tải hệ thống;
> - chia sẻ hoặc bán lại quyền truy cập khoá học trả phí.
>
> ## 4. Nội dung của giáo viên
>
> Giáo viên giữ quyền sở hữu nội dung mình tạo và chịu trách nhiệm bảo đảm có quyền sử dụng mọi nội dung tải lên, bao gồm bản quyền hình ảnh, âm thanh và tài liệu. Khi đăng nội dung lên VocaSpace, giáo viên cho phép VocaSpace lưu trữ và hiển thị nội dung đó cho người học để vận hành dịch vụ. VocaSpace có thể gỡ nội dung vi phạm điều khoản này hoặc pháp luật.
>
> ## 5. Khoá học và thanh toán
>
> - Khoá học trả phí được thanh toán qua PayOS. Khi thanh toán thành công, khoá học được mở trong tài khoản của bạn.
> - Khoản thanh toán thành công không được hoàn lại, trừ khi lỗi từ hệ thống (ví dụ đã trừ tiền nhưng khoá học không được mở); khi đó VocaSpace sẽ mở khoá học hoặc hoàn tiền.
>
> ## 6. Khoá học bị gỡ
>
> Khoá học có thể bị gỡ khi giáo viên ngừng cung cấp hoặc khi vi phạm chính sách; khi đó bạn có thể không truy cập được khoá học nữa. Nếu bạn đã thanh toán cho khoá học bị gỡ, hãy liên hệ support@vocaspace.com, VocaSpace sẽ hỗ trợ phù hợp, ví dụ cấp mã giảm giá cho khoá học khác.
>
> ## 7. Tạm khoá và chấm dứt
>
> VocaSpace có thể tạm khoá hoặc xoá tài khoản vi phạm các điều khoản này. Bạn có thể ngừng sử dụng và yêu cầu xoá tài khoản bất kỳ lúc nào theo [Chính sách quyền riêng tư](/privacy).
>
> ## 8. Giới hạn trách nhiệm
>
> VocaSpace được cung cấp theo hiện trạng. Chúng tôi cố gắng giữ dịch vụ hoạt động ổn định nhưng không cam kết dịch vụ luôn liên tục hoặc không có lỗi. Trong phạm vi pháp luật cho phép, VocaSpace không chịu trách nhiệm cho thiệt hại gián tiếp phát sinh từ việc sử dụng dịch vụ.
>
> ## 9. Thay đổi điều khoản
>
> Khi điều khoản thay đổi, chúng tôi cập nhật trang này và ngày "Cập nhật lần cuối" ở đầu trang. Với thay đổi quan trọng, chúng tôi sẽ thông báo trên website. Tiếp tục sử dụng VocaSpace sau thay đổi nghĩa là bạn đồng ý với điều khoản mới.
>
> ## 10. Liên hệ
>
> Mọi câu hỏi về điều khoản, xin gửi tới [support@vocaspace.com](mailto:support@vocaspace.com).
