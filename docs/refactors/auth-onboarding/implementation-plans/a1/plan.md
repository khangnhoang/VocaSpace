---
title: "A1 — Email verification + Before User Created hook"
pr: A1
branch: feat/auth-a1-email-verification
base: "main @ ab92e21 (merge PR #118); branch also carries docs commits 0c255f9 and 9bfd0c6"
dependency: "None in code. Hosted rollout needs the Owner (SMTP, URL config, Confirm email, template, hook) and, for step 6, A2 deployed READY + recovery QA passed (Decision 9)"
parent: ../../plan.md
progress: ../../progress.md
problems: ../../problems.md
source: ../../sources/d7-combined-plan-r8.md
---

# A1 Implementation Plan — Email verification + "Before User Created" hook

## 1. Status and current authority

- Written 2026-10-03 on `feat/auth-a1-email-verification`. `origin/main` is still `ab92e21`, the baseline the source facts were read against.
- The Owner asked (2026-10-03) to write this plan, self-review and fix it, then send it for Codex review. Because A1 is high-risk, Codex may use multi-agent review.
- **Implementation authorized 2026-10-03:** the Owner approved r3 and allowed local commits per checkpoint after self-review. Push, PR, merge, `db push`, Supabase dashboard, Google Cloud Console and Vercel each need explicit Owner permission.
- The agent never enters SMTP passwords, Google secrets or any credential. The Owner performs every hosted step in §8.2. The agent may only run read-only checks there, and only when the Owner allows it.
- Size: **large/high-risk**. A1 touches auth, two new auth routes, four Server Actions, three screens, one migration containing only a hook function, local auth config and production auth settings. It ships as one PR with checkpoints CP1–CP4 (§7).
- This plan is cut from the reviewed source [d7-combined-plan-r8.md](../../sources/d7-combined-plan-r8.md) per master plan §6. Content copied unchanged keeps the source's review. Content that is new or changed is listed in §2.6 and needs this plan's review.

## 2. Binding Spec

### 2.1 Outcome

- **Email sign-up requires email verification, and the password is set after verification** (Decision 5):
  - the registration form no longer has password fields;
  - after submitting, the user sees a "check your email" screen;
  - clicking the link in the email verifies the address and signs the user in;
  - the user then sets a password at `/auth/set-password` and lands on `/` signed in.
- **Email users are created only by the server.** The "Before User Created" hook rejects creation of email users through the public Auth API, so nobody can pre-create an email account with a self-chosen password (Decision 6).
- **No fake Google buttons:** `/login` and `/register` render no Google button until A4 (Decision 8).

### 2.2 Owner decisions that bind A1

Master plan §3 has the full list. These bind A1:

- **2:** "Confirm email" is turned on in production.
- **5:** the password is set after verification; the server creates users with a random password nobody knows.
- **6:** the hook only allows provider `google` or the server marker.
- **8:** A1 hides the Google buttons on `/login` and `/register`; A4 shows them again.
- **9:** after A1 deploys, sign-ups stay off. Rollout step 6 (re-enable sign-ups) runs only after A2 is deployed READY in production and its recovery QA has passed.

Decision 1 (real Google OAuth) and Decision 4 (auto-linking) belong to A4. Decision 3 (profile) belongs to A3.

### 2.3 Scope

- **Migration:** a new `supabase/migrations/<timestamp>_<name>.sql` that only creates the hook function `public.d7_before_user_created(event jsonb)` and its grants (H12). No tables, no trigger changes, no edits to published migrations.
- **Local Supabase (`supabase/config.toml`, H9 minus the Google block):**
  - `[auth.email] enable_confirmations = true`;
  - a confirmation template at `supabase/templates/confirmation.html`;
  - `http://127.0.0.1:3000/**` and `http://localhost:3000/**` added to `additional_redirect_urls`;
  - `[auth.hook.before_user_created]` enabled and pointing at the function.
- **Schemas (`lib/schemas/auth.ts`):**
  - `registerSchema` loses `password`/`confirmPassword`;
  - a new set-password schema reuses the current password rules (at least 6 characters, confirmation must match).
- **Server Actions (`app/actions/auth.ts`):**
  - `signUpUser`:
    - the sign-up switch gate (G4);
    - a username pre-check;
    - `auth.admin.createUser` with a random password and the marker;
    - `resend`;
    - a neutral result (H4);
  - `signInUser` parses `loginSchema` (H5);
  - a new `resendSignupConfirmation` (H6);
  - a new `setPasswordAfterConfirmation` (H11, G8).
- **Routes and pages:**
  - Route Handler `/auth/confirm` (H3);
  - page `/auth/set-password` with its form (H11).
- **UI:**
  - `/register` without password fields, plus the "check your email" screen. That screen has "Resend email", "Resend registration form" and a "Already have an account? Sign in" link;
  - `/login` shows a fixed message for `auth_error=confirm` (H7, `confirm` only);
  - both pages render no Google button (Decision 8).
- **Tests:** per §7.
- **Docs:**
  - this plan's State;
  - `progress.md`;
  - `problems.md` follow-ups when A1 completes (§8.4).

### 2.4 Non-goals

- A working Google button, `/auth/callback`, `auth_error=oauth`, and the `[auth.external.google]` config block (A4).
- Password recovery (A2).
- Profile/username changes (A3).
- Any migration beyond the hook function. No change to the `handle_new_user` trigger.
- Changing sign-in or password change for existing users. That includes `/profile`'s change-password form.
- The register/profile gender enum mismatch, and the avatar upload order (avatar uploads before user creation; failed sign-ups can leave an orphan file, as today).
- CAPTCHA, custom domain, DKIM/SPF.
- Email enumeration at the direct Supabase Auth API layer (G5 limit).
- Refactoring `createUserByAdmin` (`AUTH-004`).
- The agent touching Supabase dashboard, Google Cloud Console or Vercel env.

### 2.5 Execution guardrails

Rationale and history for G1–G8 are in source §2.5; A1 keeps the parts listed here. Each guardrail states what breaks if it is omitted.

- **G1 — No open redirect.** `/auth/confirm` redirects only to fixed internal paths: `/auth/set-password` on success, `/login?auth_error=confirm` on failure. It never reads `next`/`redirect_to`. *If omitted:* a crafted link can send a freshly verified user to a phishing site.
- **G2 — No secrets in the repo.** SMTP credentials live only in the Supabase dashboard. *If omitted:* credentials leak through Git.
- **G4 — App sign-up never issues a session and honors "Allow new users to sign up".**
  - `signUpUser` creates users with `admin.createUser({ email_confirm: false })`, which never issues a session.
  - Before creating a user, it reads `GET <NEXT_PUBLIC_SUPABASE_URL>/auth/v1/settings` server-side with header `apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>`, uncached (`cache: "no-store"` or equivalent). If `disable_signup === true`, the fetch fails, or the field is missing, it returns "Đăng ký tạm thời chưa khả dụng" ("Sign-up is temporarily unavailable"), creates nothing and sends nothing (fail closed).
  - *If omitted:* the admin API bypasses the dashboard switch, so turning sign-ups off would not stop app sign-ups. That breaks Decision 9 and the mail-incident runbook. A cached settings response would have the same effect.
- **G5 — Neutral errors; no email enumeration at the app layer.**
  - Fixed Vietnamese messages only; never return Supabase `error.message`.
  - A new, pending or verified email all get the same "check your email" result.
  - The username error is returned only by the pre-check, so it is the same for every email state.
  - Every `createUser`/`resend` failure returns the same neutral result.
  - Resend always returns one neutral result and the UI applies one 60-second cooldown.
  - Every sign-in failure is "Sai email hoặc mật khẩu!" ("Wrong email or password!").
  - *If omitted:* internal details leak or the UI reveals which emails exist.
- **G6 — Hosted configuration belongs to the Owner.** *If omitted:* permission and safety rules are broken.
- **G8 — No password is known before verification; only someone who just proved mailbox ownership may set a password without the old one.**
  - **Random password:** `signUpUser` builds a random password server-side for every `createUser` call: at least 256 bits from `crypto.randomBytes`. It is never returned to the client, logged or stored.
  - **Character policy (new in A1):** the random password must also always contain a lowercase letter, an uppercase letter, a digit and a symbol, so any Supabase character policy accepts it. *If omitted:* with a hosted policy that requires symbols, base64url output lacks one about 25% of the time, so sign-up would fail at random.
  - **Hook:** blocks every public creation except provider `google` and users carrying `app_metadata.d7_server_created = true`.
  - **`setPasswordAfterConfirmation` runs only when both conditions hold, read server-side:**
    1. the current session's `amr` claim (via `getClaims()`, signature checked) contains method `otp`. The phone provider is off, so in A1 `otp` means a session created from the email link or code;
    2. `app_metadata.d7_password_set` is not `true`, read from `getUser()`, not from JWT claims.
  - **Setting the password:**
    - call `supabase.auth.updateUser({ password })` on that same session (not admin);
    - then the service role sets `d7_password_set = true`.
  - *If omitted:* a password chosen before verification (through the app or the public API) survives verification and can sign in to the victim's account (source C3). A replayed verification session could also reset the password.
- **Scope of the G8 replay guard (from Codex r1):**
  - The `d7_password_set` flag guards the app's no-old-password path (`setPasswordAfterConfirmation`) against sequential replay of the original `otp` session.
  - It does **not** bound the Supabase Auth API itself. Any holder of a valid access token can call `PUT /auth/v1/user` with a new password, as every session can today. That is existing Supabase behavior and is not changed by A1 ("Secure password change" off on local; hosted read in §8.2 step 3).
  - Two concurrent action requests from the same verified session can both pass the flag read; the last write wins. Both requests come from the party that just proved mailbox ownership, so no third party gains a password.
  - A1 claims only these bounds. Closing the Auth API path (for example via "Secure password change") is a follow-up (§8.4), not an A1 acceptance item. *If the claim were wider:* the plan would promise a protection that tests through the action cannot prove.
- **G9 — Keep the login form contract used by smoke E2E (new in A1).** The `/login` email input keeps `aria-label="Email"`, the password input keeps `aria-label="Password"` and the submit button keeps `aria-label="Sign in"`. *If omitted:* every smoke spec breaks, because each logs in through `e2e/support/auth.ts`, which finds these elements by those names.
- **Hard rules after T_on** (source §8.3, master plan §4):
  - never turn off "Confirm email";
  - never disable the hook;
  - never remove `/auth/confirm`, the "check your email" screen or the set-password-after-verification flow.

  These bind from T_on (master plan §4), regardless of when step 6 runs. Decision 9 changes only when sign-ups are re-enabled.
- **Names kept from the source:** `public.d7_before_user_created`, `app_metadata.d7_server_created` and `app_metadata.d7_password_set` keep their `d7_` names. The master plan, the A2 acceptance and the hosted runbook refer to them, and the markers persist in production data. *If renamed:* the reviewed runbook and A2's contract would point at names that do not exist.

### 2.6 Deviations from source r8 (need this plan's review)

| # | Deviation | Reason |
| --- | --- | --- |
| V1 | Google buttons hidden on both pages; no `[auth.external.google]` block | Decision 8; Google is A4 |
| V2 | Rollout step 6 runs only after A2 is deployed READY + recovery QA passed; hard rules still bind from T_on | Decision 9 |
| V3 | Random password always contains all four character classes; rollout reads the hosted password policy (§8.2 step 3) | Self-review: hosted character policies could reject a base64url password |
| V4 | G9: keep the login form's aria labels | Self-review: smoke E2E logs in through them |
| V5 | `/login` handles only `auth_error=confirm` | `oauth` belongs to A4 |
| V6 | The register success toast "Đăng ký thành công! Chào mừng Chủ tịch Ú!" is replaced by the "check your email" screen | The flow no longer signs the user in; source §8.3 lists this toast as a follow-up only if it stays |
| V7 | G8 replay-guard scope stated explicitly (app path only; Auth API and concurrent same-session requests out of scope); `oauth` sessions added to the reject rows | Codex r1 findings 1, 2, 4 |
| V8 | `/auth/confirm` answers `303` with a relative `Location` (one of the two fixed paths), not an absolute URL built from the request; G1 unchanged | Implementation 2026-10-03: `NextRequest` rewrites host `127.0.0.1` to `localhost`, so an absolute redirect moved the browser to another host and lost the session cookie set by `verifyOtp` |

## 3. Repository facts (baseline `ab92e21`, re-checked 2026-10-03)

Source §3 holds the full facts and both spikes. The ones A1 relies on, confirmed again on the current branch:

- **`app/actions/auth.ts`:**
  - `signUpUser` parses `registerSchema` from raw FormData;
  - it uploads the avatar with the anon server client, then calls public `supabase.auth.signUp` with metadata;
  - it returns Supabase's `error.message` on failure.
- **`signInUser`:**
  - reads raw `email`/`password`;
  - returns "Sai email hoặc mật khẩu!" for every error.
- **`signOutUser`:** redirects to `/login`.
- **`lib/schemas/auth.ts`:**
  - `registerSchema = z.intersection(step1Schema, step2Schema)`;
  - step 1 holds username/email/password/confirmPassword plus a match refine;
  - step 2 holds full_name, phone, `dob: z.date()` and gender `nam/nữ/other`;
  - `loginSchema` exists but is unused by the action.
- **`app/(client)/register/page.tsx`:**
  - a client page with three steps;
  - step 1's "Next" and the Enter key trigger validation of `username`, `email`, `password`, `confirmPassword`;
  - an unhandled Google button sits under step 1;
  - success shows the "Chủ tịch Ú" toast, then `router.push("/")`;
  - there is no "sign in" link.
- **`app/(client)/login/page.tsx`:**
  - a client page with an unhandled Google button;
  - the inputs carry `aria-label="Email"` and `aria-label="Password"`, and the submit button carries `aria-label="Sign in"`.
- `e2e/support/auth.ts` logs in through exactly those labels (G9). No E2E spec registers through the UI or uses the Google button.
- **`utils/supabase/middleware.ts`:**
  - signed-in users visiting `/login` or `/register` are redirected to `/`;
  - `/auth/*` is not guarded.
- No `app/auth` directory exists and there are no tests for `app/actions/auth.ts`.
- **Route Handler tests:**
  - existing ones live under `__tests__/actions/` and import from `@/app/api/...`;
  - the repo has five route handlers, all under `app/api`.
- **Clients and env:**
  - `lib/supabase/service-role.ts` exports `createServiceRoleClient()`;
  - `utils/supabase/server.ts` uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
  - `@supabase/supabase-js` is `^2.99.1` (it has `getClaims`), `@supabase/ssr` is `^0.9.0`, `next` is `^16.2.3`.
- **`supabase/config.toml`:**
  - API port 45321; inbucket port 45324;
  - `site_url = "http://127.0.0.1:3000"`, `additional_redirect_urls = ["https://127.0.0.1:3000"]`;
  - `minimum_password_length = 6`, `password_requirements = ""`;
  - `[auth.email] enable_confirmations = false`, `secure_password_change = false`, `max_frequency = "1s"`;
  - `[auth.sms] enable_signup = false`;
  - the `[auth.hook.before_user_created]` block is commented out;
  - `supabase/templates/` does not exist.
- **Latest migration:** `20261002130000_d4_topic_completion.sql`.
- **Integration tests:**
  - existing ones call Server Actions directly with `vi.mock("next/headers", …)` (for example `course-readiness.test.ts`);
  - `lib/supabase/service-role.ts` imports `server-only`; integration tests mock `@/lib/supabase/service-role` with a factory that returns a real local admin client (pattern: `public-course-preview-service.test.ts:12`);
  - they live in `__tests__/integration/` with helpers in `__tests__/integration/helpers/` (including local Postgres coordination);
  - they run with `npm run test:integration` and `ALLOW_DB_INTEGRATION_TESTS=true`.
- **Smoke E2E baseline:** `E2E-001` (old program `problems.md`) records four specs already failing on `main`:
  - `dashboard-return-freshness`;
  - `exercise-authoring`;
  - `flashcard-delete`;
  - `public-course-discovery`.
- **Spikes (source §3, 2026-10-02, local GoTrue `v2.189.0`):**
  - `verifyOtp` gives `amr` `otp`, and it survives a refresh;
  - `updateUser` keeps the session alive;
  - `updateUserById` merges `app_metadata`;
  - the hook blocks public `signUp`/`signInWithOtp` with 403 and does not run for admin `createUser`;
  - `resend` delivers mail for admin-created users;
  - a public re-`signUp` of a pending email changes neither its password nor its metadata.
- **Hosted (read 2026-10-02, may have changed):**
  - 7 users, all email-confirmed, only the `email` provider;
  - production domain `vocaspace.vercel.app`;
  - preview deploys share the production Supabase project.

## 4. Bounded implementation hypotheses

Each item may be replaced by an equivalent that keeps §2. Any replacement is recorded in State.

- **H3 — `/auth/confirm`:**
  - `app/auth/confirm/route.ts`, `GET`;
  - a small Zod schema parses `token_hash` (non-empty) and `type` (`email` or `signup`); invalid input redirects to `/login?auth_error=confirm` without calling Supabase;
  - valid input calls `verifyOtp({ type, token_hash })` with the server client;
  - success redirects to `/auth/set-password`, failure to `/login?auth_error=confirm`;
  - redirects are built from `request.nextUrl.origin` plus a fixed path.
- **H4 — `signUpUser`, in this order:**
  1. Parse `registerSchema` (no password).
  2. Sign-up gate (G4).
  3. Username pre-check with the service role: if taken, return "Username đã được dùng, hãy thử username khác." ("Username is taken, try another one."); if the read fails, return a generic message. Neither path creates a user.
  4. Avatar upload as today (order unchanged).
  5. `admin.createUser({ email, password: <G8 random>, email_confirm: false, user_metadata, app_metadata: { d7_server_created: true } })`.
  6. Whether `createUser` succeeded or reported the email exists, call `supabase.auth.resend({ type: "signup", email })`.
  7. Always return `{ success: true, needsEmailConfirmation: true }`, except for invalid input, the gate and the username pre-check. Log error codes server-side, never emails.
- **H5 — `signInUser`:**
  - parse `loginSchema`;
  - invalid input returns "Sai email hoặc mật khẩu!" without calling Supabase;
  - every Supabase error returns the same message.
- **H6 — `resendSignupConfirmation(email)`:**
  - parse the email; if valid, call `resend({ type: "signup", email })`;
  - every outcome returns the same `{ success: true, message }`, for example "Nếu email này đang chờ xác minh, mail mới sẽ tới trong vài phút." ("If this email is awaiting verification, a new email will arrive in a few minutes.");
  - the UI disables the button for 60 seconds after every click.
- **H7 (confirm only) — `/login`:**
  - read `auth_error` with `useSearchParams` inside a `Suspense` boundary, or move the form into a child component;
  - show the fixed message "Link xác minh không hợp lệ hoặc đã hết hạn" ("The verification link is invalid or has expired") for `confirm`;
  - ignore unknown values.
- **H9 — config:** the items in §2.3. The template links to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email` and says both "click to verify and set your password" and "if you did not sign up, ignore this email".
- **H11 — `/auth/set-password`:**
  - a server page: signed out → `/login`; signed in but not eligible under G8 → `/`;
  - the client form has a new password and a confirmation field (set-password schema);
  - `setPasswordAfterConfirmation`:
    - parses input;
    - checks G8 via `getUser()` + `getClaims()`;
    - on failure returns a fixed error without calling `updateUser`;
    - otherwise calls `updateUser({ password })`, then sets the flag with the service role, then redirects to `/`;
  - an `updateUser` error returns a generic message and the form stays retryable.
- **H12 — hook function:**
  - `language plpgsql`, not `security definer`, reads and writes no table;
  - returns `{}` when `event->'user'->'app_metadata'->>'provider' = 'google'` or when `app_metadata.d7_server_created = true`;
  - otherwise returns `{"error": {"http_code": 403, "message": "Signups must go through VocaSpace"}}`;
  - `grant execute … to supabase_auth_admin`; `revoke execute … from authenticated, anon, public`.
- **Random password builder (G8):**
  - for example `randomBytes(32).toString("base64url")` plus a fixed suffix covering each character class (for example `"aA1!"`);
  - the suffix adds no secret, and the 256 random bits remain the entropy.
- **UI:**
  - the "check your email" state lives in `/register` client state, and "Resend registration form" returns to step 1 with the form values and avatar file kept;
  - a refresh of the "check your email" screen returns to an empty form (acceptable: the email was already sent).
- **Middleware:** unchanged. `/auth/*` stays unguarded, so `/auth/confirm` and `/auth/set-password` do their own session checks (H3, H11).
- **Test locations:**
  - actions and route in `__tests__/actions/`;
  - schemas in `__tests__/schemas/`;
  - pages and forms in `__tests__/components/`;
  - real stack in `__tests__/integration/`;
  - mail is read from the local mail server's HTTP API (inbucket/Mailpit, port 45324).

## 5. Contract

Every row comes from source §5.1, except those marked *A1*. Source §5.1 adds the attacker/replay acceptance rows; all of them bind A1.

| Situation | Expected result |
| --- | --- |
| Valid sign-up (form without password fields) | No session. `/register` shows "check your email" with the entered email, "Resend email", "Resend registration form" and a sign-in link; the user is not sent to `/` |
| Sign-up again with a verified or pending email (even if Supabase reports a rate limit) | Same as the first row; email state not revealed |
| Username taken (pre-check), with a new, pending or verified email | Same username message; no user created |
| `createUser` fails (trigger/username race) or `resend` fails (mail limit) | Same as the first row; "Resend registration form" reopens the form with the old data and can submit again |
| Invalid sign-up input | Validation errors as today; Supabase not called |
| Sign-ups off in Supabase (`disable_signup`) or settings unreadable | "Đăng ký tạm thời chưa khả dụng"; no user, no mail (G4) |
| Public Auth API (`signUp`, `signInWithOtp`) with the anon key creating a new email user | Rejected by the hook (403); no user created |
| Public `signUp` for a pending email (created through the app) with password P | Password and profile unchanged; P cannot sign in before or after the victim verifies |
| Clicking the verification link (same or other browser) | Email verified, session created, lands on `/auth/set-password`; F5 stays there |
| Valid password at `/auth/set-password` | Lands on `/` signed in; after sign-out, the new password signs in |
| Set password with a password-sign-in or `oauth` session, or after the password was already set | Page redirects to `/`; the action returns a fixed error and the password is unchanged |
| An attacker pre-registers the victim's email (through the app or the public API), the victim registers again and clicks the newest (or old) link | The victim sets their own password; no earlier password signs in; the attacker has no session |
| Reusing the original `otp` session (JWT not refreshed) to set the password a second time | Rejected because the flag is read from `getUser()`; password unchanged |
| Expired, used, wrong or incomplete link (signed out) | `/login` with "Link xác minh không hợp lệ hoặc đã hết hạn" |
| Same, while already signed in | The existing middleware redirects `/login` to `/`; the user stays signed in and sees no message (accepted, unchanged middleware) |
| Link with a foreign `next`/`redirect_to` | Ignored; still `/auth/set-password` or `/login?auth_error=confirm` (G1) |
| Sign-in to an unverified account | "Sai email hoặc mật khẩu!" |
| Resend | Always the same neutral message and the same 60-second cooldown, including rate limits and errors |
| *A1:* `/login` and `/register` at any step, including "check your email" | No Google button rendered |
| *A1:* existing user signs in through `/login` | Unchanged; smoke E2E login still works (G9) |

## 6. Dependencies and order

- **Code:** none. A1 is the first PR of the program.
- **Local verification:** CP1–CP3 are verified fully on the local stack with verification on.
- **Hosted:** the Owner follows §8.2 in strict order: pre-deploy steps 2–4, then merge and deploy (step 5), then step 6 after A2 (Decision 9).
- **Downstream:**
  - A2 needs A1 merged;
  - A4 code needs A1 merged;
  - enabling Google needs A1 steps 2–6 plus the A4 gate (master plan §7).

## 7. Checkpoints

Checkpoints are review/resume boundaries, not commit boundaries.

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Local foundation: hook migration, `config.toml` (H9 minus Google), confirmation template. Stack restarted (`npx supabase stop` → `npx supabase start` → `npx supabase db reset`) | **Integration, hook function called directly over the local Postgres connection (`waitForLocalPostgresQuery` helper):** provider `google` → `{}`; `email` without marker → 403 error; `email` with marker → `{}`; `phone` → error. **Integration, public API:** anon `signUp` and `signInWithOtp` for a new email → error and no user. **Admin path:** admin `createUser` with the marker → success. The settings endpoint of the local stack returns `disable_signup: false` |
| CP2 | Server boundary: schemas, `signUpUser`, `signInUser`, `resendSignupConfirmation`, `setPasswordAfterConfirmation`, `/auth/confirm`, `/auth/set-password` page guard | **Schema:** `registerSchema` has no password; set-password length and match rules. **Unit (mocked Supabase), `signUpUser`:** `email_confirm: false`, the marker, a random password that differs per call, contains all four character classes and is absent from the result; then `resend`; every `createUser` error (`email_exists`, save failure, other) and every `resend` error (rate limit, other) → same neutral result; `email_exists` still calls `resend`; username taken → no `createUser`; username read error → generic message; invalid input → no Supabase call; settings `disable_signup: true`, fetch error or missing field → unavailable message with no `createUser`/`resend`. **Unit, `signInUser`:** invalid input and Supabase error. **Unit, resend:** success, error, rate limit and invalid email all return the same result. **Unit, `setPasswordAfterConfirmation`:** `amr` `otp` without flag → `updateUser` then flag; `amr` `password` or `oauth`, already flagged or signed out → no `updateUser`; `updateUser` error → generic message; invalid or mismatched input → no Supabase call. **Unit, `/auth/set-password` page guard:** signed out → `/login`; signed in with `password`/`oauth` or already flagged → `/`. **Unit, route `/auth/confirm`:** success, `verifyOtp` error, missing/invalid `token_hash`/`type` (no Supabase call), `next`/`redirect_to` ignored. **Integration (local stack, verification and hook on):** app sign-up → no session, unverified user, mail in the local mail server; repeat for verified and pending emails → same result; duplicate username with a new, pending or verified email → same username error and no new user; resend for an unknown and a pending email → same result. **Integration, attacker through the public API (C3):** anon `signUp` X with P → error, no user X; victim registers X through the action; anon `signUp` X with P again → P cannot sign in; take the `token_hash` from the old and the new mail, call the `/auth/confirm` handler with one → redirect to `/auth/set-password`; right after verification and before the victim sets a password, `signInWithPassword(X, P)` → no session. **Integration, attacker through the app:** register X twice through the action, same assertions. **Integration, set password and replay (R11):** set C with that `otp` session → success; admin read shows `d7_password_set === true`; the same client holding the original `otp` session (not refreshed) tries D → rejected with no `updateUser`; C signs in and D does not; a session signed in with C is rejected |
| CP3 | UI: `/register` without passwords plus the "check your email" screen; `/login` `auth_error=confirm`; `/auth/set-password` form; Google buttons removed from both pages | **Component:** no password fields; "check your email" screen after a neutral result; resend disables for 60 s after every click; "Resend registration form" reopens the form and resubmits the same data; set-password form validation, pending state and server error; login shows the confirm message only for `auth_error=confirm`; no Google button on either page; login inputs and button keep their G9 labels. **Browser (local, `http://127.0.0.1:3000`):** register → mail in inbucket → click the link → `/auth/set-password` → set password → `/` signed in, F5 stays signed in; sign out, sign in with the new password, sign out again; click the same link again → `/login` shows the invalid-link message; open a fresh link in a separate browser context → set-password page; no Google button on `/login` or `/register`; register, check-email and set-password screens at 375 px and 320 px width and at 200% zoom: no horizontal overflow, form fields and CTAs fully visible and usable, keyboard focus visible |
| CP4 | Full check + docs | `npm run test:run`; integration with `ALLOW_DB_INTEGRATION_TESTS=true` (PowerShell: `$env:ALLOW_DB_INTEGRATION_TESTS='true'; npm.cmd run test:integration`; POSIX shell: `ALLOW_DB_INTEGRATION_TESTS=true npm run test:integration`); `npx tsc --noEmit`; eslint on changed files; `git diff --check`; `npm run build`. Stop the old E2E stack (`npx supabase --workdir .e2e-runtime stop`), then `npm run test:e2e:smoke`; failures must match the `E2E-001` baseline exactly. Update State, `progress.md`, `problems.md` (§8.4) |

**Evidence limits** (from source §7):

- Verification-on behavior is proven locally.
- The sign-ups-off branch (G4) is proven only by unit tests with mocked settings: flipping `enable_signup` locally needs a stack restart.
- Shared-SMTP rate limits cannot be forced locally.
- Production behavior is proven only by the §8.2 checks.

## 8. Risks, rollout, stop and rollback

### 8.1 Risks

Source §8.1 rows owned by A1 (master plan §6), plus the new ones:

| Risk | Impact | Mitigation | Earliest exposure |
| --- | --- | --- | --- |
| Attacker pre-registers a victim's email (app or public API) | Attacker keeps a password on the victim's account | G8 + hook; CP2 acceptance tests | CP2 |
| Sign-up requests in flight during the mode switch | Unaudited auto-confirmed accounts | Step 4: sign-ups off, Confirm email on, wait, then capture the G3 list | Rollout |
| Hook not enabled or disabled on hosted | Public `signUp` can pre-create pending users with a chosen password | Enable the hook before re-enabling sign-ups; step 6 probe; hard rules | Rollout |
| Hook error, or a future Supabase runs the hook for admin API without the marker | No new Google users, or app sign-up fails (fails closed) | Marker; step 6 probe; fix with a new migration | Rollout |
| Confirm email turned off after T_on while users are pending | Anyone knowing a pending email gets that user's session | Hard rule; app sign-up uses the admin API (G4) | Rollout |
| SMTP not configured before Confirm email | New users get no mail | Step 2 test mail before step 4 | Rollout |
| Hosted template still uses `{{ .ConfirmationURL }}` | Link misses `/auth/confirm`; no set-password step | Step 4 template edit; step 6 real sign-up | Rollout |
| Site URL wrong on hosted | Mail links point elsewhere | Step 3 check | Rollout |
| *New:* hosted password policy stricter than the app (min length > 6 or character requirements) | User-chosen passwords rejected with a generic error; or, without V3, random sign-up failures | V3 random password; step 3 reads the policy and stops if it differs from local (6, none) | Rollout |
| *New:* login labels change | Every smoke E2E login fails | G9; component test; CP4 smoke | CP3 |
| `useSearchParams` in a client page breaks build | CI/build fails | Suspense (H7); `npm run build` in CP4 | CP3 |
| User loses the session after verification before setting a password | Cannot sign in with a password | Session kept after verification; Decision 9 keeps sign-ups off until A2 recovery works, so no new user hits this in production | Rollout |
| Preview deploys share production Supabase | Testing sign-up on a preview creates real users | Accepted; preview redirect allowlist is the Owner's choice | Rollout |

### 8.2 Owner rollout runbook (after the PR is approved)

The step numbers match source §8.2. Step 1 (Google Cloud) belongs to A4. The agent does none of these steps and may only run read checks when allowed.

2. **SMTP** (Authentication → SMTP):
   - enter the chosen provider;
   - send a test mail to an address outside the team;
   - review Rate Limits.
3. **URL configuration and policy reads:**
   - Site URL `https://vocaspace.vercel.app`;
   - Redirect URLs include `https://vocaspace.vercel.app/**` (plus a preview pattern if wanted);
   - read the current "Confirm email" state (expected off);
   - confirm the **Phone** provider is off (G8 relies on it);
   - *new (V3):* read "Minimum password length" and "Password requirements"; they must be 6 and none, as in local. If they differ, stop and align the schema and local config under a plan revision first;
   - read "Secure password change". If it is on, it does not block A1 because the verification session is fresh, but record it.
4. **Mode switch, only when the PR is approved and ready to merge:**
   - turn off "Allow new users to sign up";
   - turn on "Confirm email" and record **T_on**. From here on, never turn it off;
   - Email Templates → Confirm signup: link `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`, content per `supabase/templates/confirmation.html`;
   - push the hook migration to hosted (the Owner runs `supabase db push`, or the agent with separate permission);
   - then enable Authentication → Hooks → Before User Created → Postgres → `public.d7_before_user_created`. While sign-ups are off, public `signUp` returns `422 signup_disabled` before reaching the hook, so do read checks only:
     - the function exists;
     - `supabase_auth_admin` has execute;
     - `anon`/`authenticated` do not;
     - the Hooks page shows the hook enabled with that function;
   - wait at least 2 minutes for in-flight sign-up requests to finish;
   - **capture the G3 list:** every user id (for example `select id, email, created_at, email_confirmed_at, last_sign_in_at from auth.users order by created_at;`). Store the id list **outside the repo** for A4. `progress.md` records only that it was stored (no emails).

   Existing users keep signing in while sign-ups are off.
5. **Merge the PR and wait for the production deploy to be READY.**
   - No Google button appears.
   - App sign-up shows "Đăng ký tạm thời chưa khả dụng". Try it once and confirm no new user exists.
   - An existing user signs in normally.
   - **Sign-ups stay off** (Decision 9). A1's status becomes "Rollout pending".
6. **Only after A2 is deployed READY in production and its recovery QA has passed (Decision 9):**
   - re-enable sign-ups;
   - **immediately** call public `signUp` with the anon key for a test email (for example `curl` to `/auth/v1/signup`). It must return the hook's 403 "Signups must go through VocaSpace" and create no user. Otherwise turn sign-ups off again at once, delete the test user if any, and stop;
   - then do a real sign-up through the app: mail arrives, link → set password → `/` signed in; sign out and sign in with the new password;
   - if app sign-up fails because of the hook, turn sign-ups off (keep the hook on) and fix the function with a new migration;
   - A1 rollout is complete only when both checks pass.

### 8.3 Stop and rollback

- **Stop when:**
  - a migration other than the hook function is needed, or the trigger must change;
  - through real mail plus `/auth/confirm`, the session lacks `amr` `otp`, `updateUser` drops the session, or `updateUserById` overwrites `app_metadata` (contradicts the spikes);
  - locally, the hook does not block public `signUp`/`signInWithOtp`, blocks marker `createUser`, or `resend` does not deliver for admin-created users;
  - build or tests show new failures beyond the baseline;
  - a redirect path would have to come from the query.
- **Mail incident (SMTP, template):** keep "Confirm email" on and keep the code. Turn sign-ups off while fixing; that switch closes both the public API and app sign-up (G4). Pending users use "Resend email" afterwards.
- **Code incident:** fix forward with a new PR. Never revert the hook migration; fix the function with a new migration. From T_on the PR is never reverted as a whole (hard rules); only the faulty part may be removed or fixed, keeping `/auth/confirm`, the "check your email" screen and the set-password flow. Before step 6, sign-ups stay off while the fix lands (Decision 9); after step 6, turn sign-ups off if the incident lets users reach a broken flow.

### 8.4 Follow-ups to record in `problems.md` when A1 completes

- **G8 limits:**
  - profile data entered by someone who pre-registered through the app stays on the victim's profile (Owner fixes it via the dashboard);
  - a mailbox owner can set a password once via a magic link from the direct API while the flag is unset.
- **Auth API password change:** any valid access token, including the original `otp` session, can change the password directly through `PUT /auth/v1/user`; concurrent set-password requests from one verified session are last-write-wins (§2.5 replay-guard scope). Candidate fix: turn on "Secure password change" after A2, evaluated in its own plan.
- **App-level only:** email enumeration protection does not cover the direct Supabase Auth API (G5).
- **Pre-existing:** a failed sign-up can leave an orphan avatar file.

`AUTH-004`, the gender enum mismatch and the Google-only follow-ups already have owners (master plan §8–9, A2, A4), so they are not repeated.

## 9. QA fixture readiness

- **QA type:** local browser QA of sign-up → mail → set password, link replay, a separate browser context, and no Google buttons; plus a login regression check.
- **Outcome:** manual QA does not require seeded data.
  - Sign-up users are created through the UI during QA, and mail is read in inbucket at `http://127.0.0.1:45324`.
  - The login check uses the seeded learner `student@gmail.com`.
  - Integration tests create and clean up their own users.
  - The attacker cases (two sign-ups for one email, one public `signUp` with the anon key) are created during QA.
- **Host:** open the app at `http://127.0.0.1:3000` (same as `site_url`). Links point to `site_url`, and `localhost` would put the session cookie on another host.
- **Reset/setup:**
  - after changing auth config, run `npx supabase stop` → `npx supabase start` → `npx supabase db reset`;
  - stop the E2E stack separately before E2E.
- **Browser QA may begin when:** CP3 is complete and CP1–CP2 checks pass.

## 10. Specialist review decision

`0 specialist` from the agent. Codex review is the Owner-requested independent review; multi-agent is allowed because A1 is high-risk. Its output is advisory and is reconciled against repository evidence before any plan change.

## 11. State

```txt
Current Spec revision: implementation-plans/a1/plan.md 2026-10-03 r3 (Codex r3 PASS; Owner approved and authorized implementation + local commits 2026-10-03)
Current Checkpoint: CP4 complete (CP1 `90a5663`, CP2+CP3 `c5997a2`, CP4 docs commit)
Status: implementation complete locally; automated checks and local browser QA passed; awaiting Owner review of the branch
Completed evidence (2026-10-03, local stack): `npm run test:run` 79 files / 768 tests passed; `npm run test:integration` 26 files / 282 tests passed (incl. hook 10, sign-up flow 8: C3 public API + app attacker, R11 replay); `npx tsc --noEmit` clean; targeted eslint 0 errors (1 pre-existing warning in `app/actions/auth.ts` avatar upload); `git diff --check` clean; `npm run build` passed; smoke E2E 9 passed / 5 failed = the 4 E2E-001 specs plus `issue-deep-links`, which is flaky on both the pre-A1 commit `9bfd0c6` (1 of 3 runs failed) and A1 (1 of 5 runs passed) — see AUTH-010; browser QA on `next start` at http://127.0.0.1:3000: register → Mailpit link → /auth/set-password → set password → `/` signed in, F5 kept; sign out → sign in with the new password → sign out; reused link → /login invalid-link message; newest link in an isolated browser context → set-password page; resend shows the neutral message and a disabled 60 s countdown; no Google button on /login or /register; no horizontal overflow at 375 px and 320 px (320 CSS px also stands in for 200% zoom on a 640 px window); visible keyboard focus on the set-password inputs
Accepted bounded deviations: V8 (§ deviations table)
Open blockers or Owner decisions: Owner review of the branch; push/PR need explicit permission; hosted rollout §8.2 is Owner-only; sign-ups re-enable only after A2 (Decision 9)
Next action: Owner reviews the A1 commits; on request, push and open the PR
Current authority: local commits only; no push, PR, merge, `db push` or hosted action
```
