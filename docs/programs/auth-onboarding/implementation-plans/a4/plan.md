# A4 detail plan — Google OAuth sign-in

Revision: r2, 2026-10-05 (Codex plan review: r1 FAIL, 4 Required fixed; r2 PASS, 0 Critical/0 Required). Owner approval: defaults 1–5 and the plan approved 2026-10-05; implementation granted 2026-10-05. Master plan: [plan.md](../../plan.md) (outcome 4, Decisions 1, 4 and 8, §5 A4, §7 gates). Cut from [source r8](../../sources/d7-combined-plan-r8.md) H1, H2, H7 (`oauth`), H9 (google block), §5.2, C2, §8.1 (Google rows), §8.2 steps 1, 7 and 8, §8.3 (Google incident), §9 (real Google) and G1, G2, G3, G6; deviations from the source are listed in §2.

Branch `feat/auth-a4-google-oauth` from `main` `2303f1b`. Size: medium code, high-risk rollout — no migration; one route handler, one shared client component, two auth pages, one local config block; the risk sits in the hosted enable order (gate G3 and the enable gate), which the Owner runs.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: `/login` and `/register` show a working "Sign in with Google" button again (Decision 8). While the hosted Google provider is off, the button says Google is not available and keeps the user on the page. Once the Owner enables Google after the gates, a first Google sign-in creates a `student` account with a null username, and a Google sign-in whose email matches an account that passed gate G3 lands in that existing account (Decision 4). `AUTH-002` closes when this works in production.

| ID | Observable result |
| --- | --- |
| AC1 | `/login` shows the Google button under the sign-in button; `/register` shows it on step 1 under "Tiếp tục"; the check-email screen and register steps 2–3 do not show it |
| AC2 | Clicking the button disables it and reads `GET <SUPABASE_URL>/auth/v1/settings` with the anon key before any redirect. If `external.google` is not `true`, or the request fails, returns non-OK or has no such field, the user sees the toast "Đăng nhập Google hiện chưa khả dụng", stays on the page, the button is enabled again, and `signInWithOAuth` is not called |
| AC3 | If Google is enabled, the button calls the browser client's `signInWithOAuth({ provider: "google", options: { redirectTo: "<window.location.origin>/auth/callback" } })` and stays disabled while the browser leaves; if that call returns an error, the user sees the toast "Đăng nhập Google không thành công" and the button is enabled again |
| AC4 | `GET /auth/callback?code=<valid>` exchanges the code for a session with the server client, sets the session cookies and redirects to `/`; reloading `/` stays signed in |
| AC5 | `/auth/callback` with no `code`, with an `error` or `error_description` from the provider (user cancelled), or whose exchange fails (expired, reused or bogus code, missing PKCE verifier because the link opened in another browser) redirects to `/login?auth_error=oauth`; signed out, `/login` shows "Đăng nhập Google không thành công"; signed in, middleware sends `/login` to `/` with no message (accepted, as A2 AC5) |
| AC6 | `/auth/callback` ignores `next`, `redirect_to` and any other query value as a destination: it only ever redirects to `/` or `/login?auth_error=oauth` (G1) |
| AC7 | `supabase/config.toml` has an `[auth.external.google]` block with `enabled = false`, `client_id` and `secret` read through `env(...)`, and `skip_nonce_check = false`; the local stack starts and `npm run test:integration` passes with those env vars unset |
| AC8 | (Production, rollout R6.) A first Google sign-in with an email that has no account passes the Before User Created hook (provider `google`), creates one `auth.users` row and one `profiles` row with `role = student`, `full_name`/`avatar_url` from Google and a null username, lands on `/` signed in, and can save `/profile` and set a username once (A3) |
| AC9 | (Production, rollout R6.) A Google sign-in whose email matches an existing password account that passed gate G3 lands in that account: same `auth.users.id`, learning data unchanged, and the password still signs in |

### 1.2 Scope and non-goals

- In scope:
  - `app/auth/callback/route.ts` (`GET`);
  - a shared client Google button used by `/login` and `/register` step 1;
  - the `auth_error=oauth` message on `/login`;
  - the `[auth.external.google]` block in `supabase/config.toml`;
  - route unit tests, button component tests, and updates to the existing `/login` and `/register` component tests that assert "no Google button";
  - the Owner rollout runbook (§5) for Google Cloud, gate G3, the enable gate and the enable itself.
- Non-goals (master §5 A4 and §9):
  - any migration, hook or trigger change (the hook already allows provider `google`);
  - One Tap, magic link, other providers, self-service identity linking/unlinking in `/profile`;
  - a Google-only user changing the password from `/profile` (that form needs the current password; a Google-only user adds a password through forgot-password, A2);
  - Google sign-in on Vercel preview deployments (default 3);
  - auth screen redesign (AUTH-012), `createUserByAdmin` default passwords (AUTH-004), the gender mismatch (AUTH-016);
  - changing `/auth/confirm`, `/auth/set-password`, the hook, or any hard rule after T_on (master §4).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. `/auth/callback` redirects only to the fixed paths `/` and `/login?auth_error=oauth`, with a relative `Location` like `/auth/confirm`; it never reads a destination from the query | A crafted link could send a freshly signed-in user to a phishing site; an absolute redirect built from `NextRequest` turns `127.0.0.1` into `localhost` and drops the new session cookie locally (fact in `app/auth/confirm/route.ts`) |
| G2. No Google client id or secret in the repo: `config.toml` uses `env(...)` and the hosted values are entered only by the Owner | Credentials leak through Git |
| G3. The button checks the provider through `/auth/v1/settings` before calling `signInWithOAuth`, and treats every failure of that check as "not available" | The browser SDK only builds the `/authorize` URL and returns `error: null` even when the provider is off, so the user would leave the app for a Supabase error page (source §3) |
| G4. Google is enabled in production only after: A1 rollout steps 2–6 (done), a READY production deployment containing A3 and A4, the null-username profile check on that deployment (R3), and gate G3 over the stored list plus the `id`-set diff (R4). The agent never enables or configures Google | Accounts pre-registered with someone else's email before "Confirm email" would be auto-linked to that person's Google identity (Decision 2); new Google users could not save their profile |
| G7. While Google is enabled, nobody creates an account for another person with a password someone else knows: no admin create-user action (`createUserByAdmin`, fixed password) and no dashboard "Add user" for a real person's email, until AUTH-004 is fixed. Accounts whose email the Owner controls (Owner tests) are exempt. If such an account is needed, turn Google off first and repeat R4 before re-enabling | Source G3 clause 3: whoever knows the default password keeps access to an account that auto-links to the email owner's Google identity; the R4 diff only runs before an enable |
| G5. A4 touches no hard-rule part (master §4): "Confirm email", the hook, `/auth/confirm`, the check-email screen and set-password stay as they are | Re-opens the pre-registration takeover paths A1 closed |
| G6. Hosted configuration is the Owner's; the agent only runs read-only hosted queries when the Owner grants them and records counts, never emails, in the repo | Violates program authority and leaks personal data into Git |

### 1.4 Owner decisions that bind this unit

Master Decisions 1, 4 and 8 and invariants G1–G3, G6 bind this unit. Defaults below, all Owner-approved 2026-10-05:

1. Copy and placement: button label "Đăng nhập bằng Google" with the `FcGoogle` icon (as before A1) in the old places; toasts "Đăng nhập Google hiện chưa khả dụng" (provider off or settings check failed) and "Đăng nhập Google không thành công" (`signInWithOAuth` error); `/login` message for `auth_error=oauth`: "Đăng nhập Google không thành công. Bạn có thể thử lại hoặc đăng nhập bằng email." The visual style follows the current auth screens until AUTH-012.
2. (Owner-confirmed 2026-10-05; first run passed on `2303f1b`; it must be repeated on the A4 deployment, see R3.) Enable-gate check without a permanent production fixture: before enabling Google (R3), the Owner creates a temporary user in the Supabase dashboard (Authentication → Add user, auto-confirm, a throwaway password, no metadata), so its profile has a null username; signs in on production, saves `/profile` with username, date of birth and gender blank, then sets a username once and sees it lock after reload; then deletes the user. This user is the Owner's own test and is deleted, so it needs no G3 review. If the dashboard refuses to create it (for example because the hosted hook also runs for dashboard creation), stop and ask the Owner instead of changing the hook.
3. Preview deployments: Google is not supported there. Redirect URLs stay production-only (`https://vocaspace.vercel.app/**`), so a Google sign-in started on a preview falls back to the Site URL and does not complete on the preview. Alternative: the Owner adds a Vercel preview pattern to Redirect URLs (preview deployments use the production Supabase, so any test creates real users).
4. (Owner-confirmed 2026-10-05: External; no logo on the consent screen until the Owner has one designed in a separate session.) Google Cloud consent screen: "External" user type, only the default scopes (`openid`, `email`, `profile`), app name "VocaSpace", published to "In production" before R6 so any Google account can sign in (basic scopes need no Google verification). Alternative: stay in "Testing" and add test users first, which limits sign-in to those accounts.
5. The source plan stays referenced by this plan until A4 rollout completes; retiring it (AUTH-005) goes into the post-A4 problems batch the Owner chose on 2026-10-05.

## 2. Repository facts

Baseline: `2303f1b`, checked 2026-10-05. Source r8 §3 (baseline `ab92e21`) was updated by A1–A3; the current facts that justify this plan are:

- `supabase/migrations/20261003100000_a1_before_user_created_hook.sql`: `public.d7_before_user_created` returns `{}` when `app_metadata.provider = 'google'` or the D7 marker is set; `__tests__/integration/auth-before-user-created-hook.test.ts` asserts the `google` case — justifies AC8 with no migration.
- `handle_new_user` (migration `20260609114505`) inserts `profiles` from `raw_user_meta_data` (`full_name`, `avatar_url`, `username`, `phone`, `dob`, `gender`), and `profiles.role` defaults to `student`; Google metadata has no `username`, so a new Google profile has a null username — justifies AC8 and why A3 must be live first.
- A3 (PR 128, `2303f1b`) lets a null-username user save `/profile` and set a username once; production deploy READY and an existing-account save checked by the Owner on 2026-10-05 — satisfies the "contains A3" half of G4; the null-username save on production passed on 2026-10-05 before A4 (R3 first run, default 2); R3 repeats on the A4 deployment.
- `app/(client)/login/page.tsx`: client page; `AuthErrorNotice` inside `Suspense` maps `auth_error` through `Object.hasOwn` on `{ confirm, recovery }`; no Google button since A1 (`c5997a2` removed the `FcGoogle` buttons from `/login` and `/register` step 1) — justifies AC1, AC5's message and the placement in default 1.
- `app/auth/confirm/route.ts`: redirects with a relative `Location` and status 303 because `NextRequest` turns `127.0.0.1` into `localhost`; uses `createClient()` from `utils/supabase/server.ts` for the non-recovery branch — justifies G1's relative redirect. Deviation from source H2, which built the redirect from `request.nextUrl.origin`.
- `utils/supabase/middleware.ts` only guards `/teacher` (signed out → `/login`) and `/login`/`/register` (signed in → `/`); `/auth/*` passes through — `/auth/callback` needs no middleware change.
- `@supabase/ssr` ^0.9.0 uses PKCE by default; the browser client stores the code verifier in a cookie that the server client reads during `exchangeCodeForSession` — justifies AC4 and the missing-verifier case in AC5.
- `supabase/config.toml`: `site_url = "http://127.0.0.1:3000"`; `additional_redirect_urls` includes `http://127.0.0.1:3000/**` and `http://localhost:3000/**`; `[auth.external.apple]` already uses `enabled = false` with `secret = "env(...)"`; no google block — justifies AC7.
- `__tests__/components/auth-onboarding.test.tsx` asserts there is no Google text on `/register` step 1, on the check-email screen and on `/login` — these assertions change with AC1 (the check-email one stays).
- `next.config.ts` allows remote images from any HTTPS host, so a Google `avatar_url` renders in the header and `/profile`.
- Hosted (from `progress.md` State, 2026-10-05): "Confirm email" ON since T_on; hook enabled; sign-ups ON; Site URL and Redirect URLs as planned; Phone off; the G3 list of 7 user ids is stored outside the repo. Google provider never enabled. A2 AC4 left the Google-only recovery check for production after A4.

## 3. Bounded implementation hypotheses

- `components/auth/google-sign-in-button.tsx` (client): local `pending` state; `fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! } })`; any non-`true` `external.google`, thrown fetch, non-OK status or JSON error → unavailable toast; otherwise `createClient()` from `utils/supabase/client.ts` and `signInWithOAuth`. Another location next to the auth pages is acceptable if G3 and AC2/AC3 hold.
- `app/auth/callback/route.ts`: read `code`, `error` and `error_description` from `request.nextUrl.searchParams`; a small Zod schema for a non-empty `code` is acceptable; `error` or `error_description` present, or `code` invalid → failure without calling Supabase; otherwise `createClient()` (server) and `exchangeCodeForSession(code)`; error → failure; success → `/`. 303 with a relative `Location`, as `/auth/confirm` does.
- `/login`: add `oauth` to `AUTH_ERROR_MESSAGES`; render the button below the submit button. `/register`: render it on step 1 only.
- Tests: `__tests__/actions/auth-callback-route.test.ts` (new, beside the confirm route tests; mocks `@/utils/supabase/server`), `__tests__/components/google-sign-in-button.test.tsx` (new; mocks `fetch` and `@/utils/supabase/client`), and updates in `__tests__/components/auth-onboarding.test.tsx`. No integration test: the real exchange needs Google; the hook's `google` case is already covered.
- An optional smoke E2E (`e2e/smoke/`) that clicks the button with the local provider off and sees the toast is acceptable if cheap; browser QA covers it otherwise.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | `/auth/callback`, the `/login` `oauth` message and the config block meet AC4–AC7 | **Unit route:** valid code → `exchangeCodeForSession` called once with that code → 303 `Location: /`; no `code` → `/login?auth_error=oauth` without a Supabase call; `error=access_denied` (with or without `code`) and `error_description` alone with a `code` → failure without a Supabase call; exchange error (bogus code, missing verifier) → failure; `next=https://evil.example` and `redirect_to=//evil.example` with a valid code → still `/`, and with a failing exchange → still the failure path; every `Location` is relative. **Component:** `/login?auth_error=oauth` shows the fixed message; unknown keys still show nothing. **Config:** `npx supabase stop` and `npx supabase start` with the Google env vars unset, then `npx supabase db reset` and `ALLOW_DB_INTEGRATION_TESTS=true npm run test:integration` pass |
| CP2 | The shared button on both pages meets AC1–AC3, and the full unit is checked | **Component (button):** settings `external.google: false`, missing field, non-OK status, thrown fetch and invalid JSON → unavailable toast, `signInWithOAuth` not called, button enabled again; `google: true` → `signInWithOAuth` called once with `provider: "google"` and `redirectTo` = origin + `/auth/callback`, button disabled while pending and a second click makes no second call; `signInWithOAuth` error → failure toast, button enabled. **Component (pages):** `/login` and `/register` step 1 show the button; check-email and steps 2–3 do not. **Full checks:** `npm run test:run`, `ALLOW_DB_INTEGRATION_TESTS=true npm run test:integration`, `npx tsc --noEmit`, eslint on changed files (clean; full `npm run lint` keeps its 7 baseline errors outside this unit, no new ones), `git diff --check`, `npm run build`, `npm run docs:check`; stop the dev stack, then `npm run test:e2e:smoke` — failures must equal the `E2E-001` baseline plus the accepted flaky `issue-deep-links` (AUTH-010), as A2 CP4. **Local browser QA** at `http://127.0.0.1:3000` (provider off by default): the button on `/login` and `/register` shows the unavailable toast and stays on the page; signed out, `/auth/callback?code=bogus` and `/auth/callback?error=access_denied&next=https://evil.example` land on `/login?auth_error=oauth` with the message; signed in, `/auth/callback?code=bogus` lands on `/` with no message (AC5); no console errors. Real Google is not verified locally (no credentials) |

QA fixture readiness (manual QA is data-dependent):

- Canonical fixture: `supabase/seed.sql` after `npx supabase db reset`; the local Google provider stays off, which is exactly the AC2 state.
- Missing state: a working Google provider. Not available locally without Owner credentials (G2); real Google is verified only in production at R6 (source §9).
- Outcome: no fixture change; browser QA may begin when CP1 and the CP2 component tests pass.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Google enabled before gate G3 or before the null-username check | G4; runbook order R1 → R6 with hard gates; the agent never enables Google |
| A user created after the G3 list without the D7 marker (admin, dashboard, import) has a password someone else knows and gets auto-linked | R4 `id`-set diff before every enable or re-enable; G7 while Google is on (AUTH-004) |
| The button sends users to a Supabase error page while the provider is off | G3 settings check; component tests and local browser QA |
| Open redirect through `/auth/callback` | G1; route tests with `next`/`redirect_to` |
| Callback loses the session cookie on `127.0.0.1` | Relative `Location` (G1); local QA on `127.0.0.1` |
| Google-only users lose access if Google is turned off | Incident rule below; they can still add a password through forgot-password (A2), verified in production at R7 |
| Google sign-in tried on a preview deployment | Default 3: not supported; preview uses production Supabase |

- Rollout runbook (Owner; the agent only runs read-only hosted queries when granted):
  - **R1.** Merge after review; wait for the production deployment to be READY (it contains A3 and A4). On production, click the Google button on `/login` and `/register`: the unavailable toast appears and the page stays.
  - **R2.** Google Cloud Console: OAuth consent screen per default 4; OAuth client of type Web application with authorized JavaScript origin `https://vocaspace.vercel.app` and authorized redirect URI `https://zmnfsorjuibfjowmjtxo.supabase.co/auth/v1/callback`. Keep the client id and secret out of the repo and chat; do not enter them in Supabase yet.
  - **R3.** Enable-gate check (default 2): temporary dashboard user with a null username saves `/profile` blank, then sets a username once; delete the user afterwards. First run passed 2026-10-05 on production `2303f1b`, before A4 (dashboard created the user with email and password only; sign-in, full-name save and one-time username set worked; user deleted). Repeat it once after R1 on the READY deployment containing A3 and A4, and again if any later deployment before R6 changes it; the enable gate counts only a run on the deployment being enabled.
  - **R4.** Gate G3: review every account in the stored 7-id list (the person holding the email is the one who set the password, or the account is deleted or banned), then take the current `auth.users` id set, subtract the stored list and previously reviewed ids, and review every remaining id that has neither `app_metadata.d7_server_created = true` nor only a `google` identity. Do not filter by `created_at`. Store the reviewed id set outside the repo; record only counts and handling in `progress.md`.
  - **R5.** Read-check in the dashboard: "Confirm email" ON, Before User Created hook enabled on `public.d7_before_user_created`, Site URL `https://vocaspace.vercel.app`, Redirect URLs include `https://vocaspace.vercel.app/**`.
  - **R6.** Authentication → Providers → Google: enter the R2 client id and secret, enable. Then: sign in with a Google account that has no VocaSpace account (AC8: lands on `/`, profile is `student` with a null username, `/profile` saves and sets a username once); sign in with Google as an existing account that passed R4 (AC9: same account, data intact, password still works). Close `AUTH-002`.
  - **R7.** A2 AC4 production check: the new Google-only account from R6 uses "Quên mật khẩu?", sets a password from the email link, and signs in with it; its identities stay `google` only (A2 Q3 local simulation).
  - **After R6, while Google stays on:** follow G7 (no account created for another person with a known password) until AUTH-004 is fixed.
- Stop when: the callback needs a destination from the query; the button cannot tell the provider state before redirecting; any change would need a migration or a hook change; the dashboard refuses the R3 temporary user; R4 finds an account that cannot be confirmed, deleted or banned; any R6 sign-in lands in a different account than expected.
- Rollback:
  - Google incident: turn the Google provider off. The button reports "not available" and email sign-in keeps working; Google-only users lose Google access until it is re-enabled and can add a password through forgot-password. Repeat R4 before **every** re-enable.
  - Code: fix forward with a new PR, or revert only the Google button and callback while the provider is off. Never revert A3 or any hard-rule part (A3 G5, master §4).

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
