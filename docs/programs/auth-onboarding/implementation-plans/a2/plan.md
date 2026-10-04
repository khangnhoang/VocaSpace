# A2 detail plan — Password recovery

Revision: r4.3, 2026-10-04 (Owner chose to keep default 5 and prioritize AUTH-007 right after A2; wording only. r4.2: Codex r4 review round 2: 1 Required fixed — the S1/S2 ordering case expects S2 revoked, not accepted. Round 1: 2 Required and 2 Optional fixed — AC8/AC9 scope, the cross-session check-to-use window in G8-S, G8-M wording). r4: rewritten on the A1b marker table, Decision 10: the recovery evidence moves from `app_metadata` to an app-owned table, so r3's G8-M workaround and its fail-safe cost are gone; r1–r3 Codex findings carried over). Owner approval: approved 2026-10-04 with §1.4 defaults 1–7. Master plan: [`../../plan.md`](../../plan.md).

Branch `feat/auth-a2-password-recovery`. Size: large/high-risk — A2 loosens the A1 G8 rule (password set without the old password) for a new case, adds a public mail-sending action, a migration, changes to `/auth/confirm` and set-password eligibility, and a hosted template. Source r8 only holds the D7b follow-up (source §8.3), so all of this plan is new (master plan §6). One PR, checkpoints CP1–CP4.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome (master plan outcome 2): a user who forgot their password, or never managed to set one, recovers access by email. `/login` links to a forgot-password page with a neutral result; the Vietnamese recovery mail links to `/auth/confirm?type=recovery`; the link signs the user in on `/auth/set-password`, where a new password can be set once, even when the password is already set (G8), but only by the session an accepted recovery created (G8-R).

"Already set" means a `public.user_password_setups` row exists **or** the legacy `app_metadata.d7_password_set === true` (A1b G2).

| ID | Observable result |
| --- | --- |
| AC1 | Forgot-password with a valid email (unknown, verified, pending, Google-only) shows the same neutral message and a 60 s cooldown; a mail is sent only when an account exists |
| AC2 | The same email again within the rate-limit window, or any Supabase error, shows the same neutral message; a malformed email gets a client-side field error and the server returns the neutral result without calling Supabase |
| AC3 | A recovery link (same or another browser) for a user whose password is already set signs in and lands on `/auth/set-password`; F5 keeps the page; a valid password → `/` signed in; the old password fails, the new one signs in |
| AC4 | The same holds for a pending user (the email becomes verified), a user with no password set yet, and a Google-only user (password then signs in; local simulation, production after A4) |
| AC5 | A reused, superseded, expired, wrong or incomplete recovery link (signed out) lands on `/login` with "Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn…"; signed in, middleware sends `/login` to `/` with no message (accepted, as A1) |
| AC6 | If recording the recovery evidence fails after a valid link, the browser receives no auth cookie for the new session (even when the Auth sign-out call fails), and the user lands on `/login?auth_error=recovery` and sees the recovery message (a browser already signed in keeps its old session and gets AC5's signed-in behavior) |
| AC7 | A foreign `next`/`redirect_to` on the link is ignored; only fixed paths are used |
| AC8 | Rejected at `/auth/set-password` for a user whose password is already set, judged when eligibility is checked (page → `/`; the action returns the fixed error; password unchanged; limits in G8-S: an action that already passed eligibility, and a failed evidence delete): the same recovery session after it reset the password; a recovery session whose evidence was replaced by a later evidence write (normally a newer link; interleaving per G8-S); the original A1 verification session after the password was set; password and Google (`oauth`) sessions; an `otp` session not created by a `/auth/confirm` recovery (for example a direct-API magic link) |
| AC9 | Every A1 contract row (A1 plan §5) and every A1b acceptance row (A1b plan §1.1) still holds, except the rows that reject an already-set user (A1 §5 "password already set → rejected", A1b AC3 "legacy flag only → rejected"): G8-R widens those only for the session that matches the stored recovery evidence. The original verification session and every other session stay rejected |
| AC10 | `/login` shows a "Quên mật khẩu?" link to `/forgot-password`, keeps the G9 labels and shows no Google button |
| AC11 | A fresh magic-link token submitted to `/auth/confirm?type=recovery` is handled as an accepted recovery (default 5) |
| AC12 | The recovery evidence table is reachable only by `service_role` (select, insert, update, delete), has RLS on with no policies, and `anon`/`authenticated`/`public` hold no privilege on it, locally and on hosted |

### 1.2 Scope and non-goals

- In scope:
  - migration `supabase/migrations/<timestamp>_a2_user_password_recoveries.sql`: table `public.user_password_recoveries` (G12), no backfill;
  - local template `supabase/templates/recovery.html` (Vietnamese) and `[auth.email.template.recovery]` in `supabase/config.toml`, link `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`;
  - schemas in `lib/schemas/auth.ts`: a recovery-request email schema; confirmation params accept `type: "recovery"`;
  - `app/actions/auth.ts`: new `requestPasswordRecovery`; `setPasswordAfterConfirmation` also consumes the recovery evidence (G8-R(d));
  - `lib/auth/password-setup.ts`: the recovery exception (G8-R) and the evidence write/consume helpers;
  - `app/auth/confirm/route.ts`: a `type=recovery` branch that records the evidence, with its own fixed failure path;
  - UI: page `/forgot-password`, the `/login` link and `auth_error=recovery` message, set-password copy that fits both cases;
  - tests per §4; docs: `progress.md`, `problems.md` (§5).
- Non-goals:
  - any hook or trigger change (the hook is untouched, master plan §4); no `profiles` column; no change to `public.user_password_setups` or its privileges (A1b G1, G5);
  - any new `app_metadata` key; A2 keeps the A1b legacy fallback write unchanged and does not remove it (AUTH-015);
  - changing A1 sign-up, resend, sign-in or the first password set;
  - `/profile` change-password (still needs the old password);
  - "Secure password change" or closing `PUT /auth/v1/user` (AUTH-007, own plan right after A2, default 5);
  - neutralizing response timing; enumeration at the direct Auth API layer (AUTH-008);
  - magic-link sign-in, Google, profile/username (A4, A3); login/register redesign (AUTH-012);
  - AUTH-013 beyond the Vietnamese recovery template.

### 1.3 Execution guardrails

IDs follow the program numbering (G1, G5, G8, G9 as in the A1 plan); G8-R, G8-S, G10–G13 are new in A2. r3's G8-M is retired: the recovery evidence no longer lives in `app_metadata`, so A2's new writes cannot cause the AUTH-014 lost update. The A1b legacy fallback write stays unchanged; protection against a lost marker holds only once the setup row exists (AUTH-015).

| Guardrail | Failure if omitted |
| --- | --- |
| G1. No open redirect: `requestPasswordRecovery` passes no `redirectTo`; the template builds the link from `{{ .SiteURL }}`; `/auth/confirm` redirects only to `/auth/set-password`, `/login?auth_error=confirm` (email/signup) or `/login?auth_error=recovery` (recovery), never from `next`/`redirect_to` | A crafted link sends a freshly authenticated user to a foreign site |
| G5. Neutral result: `requestPasswordRecovery` returns one `{ success: true, message }` for unknown, existing, pending, rate-limited, erroring and server-side-malformed emails; never returns `error.message`; logs only error codes, never the email; the page applies one 60 s cooldown after every submit | `429` appears only for existing emails, so surfacing it reveals which accounts exist |
| G8. A1/A1b path unchanged: `amr` contains `otp` and the password is not already set (no setup row, legacy flag not `true`; table read error → not eligible, A1b G4) → eligible | A1 replay guarantees, A1b's table protection and their tests stop holding |
| G8-R. Recovery exception tied to the specific accepted recovery. An *accepted recovery* is a token that `verifyOtp` accepts at `/auth/confirm` with parsed `type=recovery`: a recovery token, or a magic-link token, since GoTrue keeps both in one slot and cannot tell them apart (both prove the mailbox; default 5). (a) only `/auth/confirm` writes evidence, only after `verifyOtp` succeeded for a parsed `type=recovery`, for every user (set or not): it upserts `{ user_id: sub, session_id }` from the new session's claims (`getClaims()`, signature checked), replacing any earlier row for that user; (b) the recovery branch commits the session cookies `verifyOtp` issues to the response only after the evidence write succeeds; if the claims read or the write fails, it writes no new auth cookie, best-effort revokes only the new session (`signOut({ scope: "local" })`; the default scope is `global`, which would revoke the user's other sessions; errors logged), and redirects to `/login?auth_error=recovery`. After an ambiguous failure (write committed but its response lost, and revocation failed) server-side evidence may remain on a session the browser never received; (c) eligible = `amr` has `otp` **and** (not already set **or** the current `session_id` equals the stored evidence `session_id` for that user), read from the table with the service role, never from JWT claims; an evidence read error → not eligible; (d) after `updateUser({ password })` succeeds, the action keeps the A1b marker writes (setup row insert, `23505` = success, then the legacy fallback) and then deletes the evidence row only where `user_id` and `session_id` both match the current session | Without it, recovery cannot work for users who already set a password (outcome fails), or any `otp` session — the original verification session or a leftover magic-link session — resets the password without the old one (master plan §5 A2 acceptance). Without (b), the user stays signed in but is bounced from set-password with no explanation, and middleware hides the `/login` message. Without the `session_id` match in (d), a delayed consume could delete a newer recovery's evidence |
| G8-S. Replay-guard scope as A1 (A1 plan §2.5): the markers and evidence guard the app path only; any access token can still use `PUT /auth/v1/user` (AUTH-007); concurrent action requests from one recovery session are last-write-wins; eligibility is checked when the request starts, so an action that already passed it (session S1) still completes `updateUser` if another recovery session S2 replaces the evidence meanwhile — the scoped delete then keeps S2's evidence, and S1 is rejected on any later request; the password change revokes S2's session (GoTrue logs out every other session), so S2's leftover evidence is inert and the user requests a new link; a failed evidence delete lets that session reset once more until the session ends or a newer recovery replaces the row (AUTH-006 analogue). Interleaved evidence writes across recovery sessions are not ordered (default 6): the last upsert wins, not the newest link, so a delayed write of an older recovery can replace a newer one (the newer session is then rejected and the user requests a new link). Every party involved has just proved the mailbox | The plan would promise protection the action-level tests cannot prove |
| G9. `/login` keeps `aria-label` "Email", "Password" and "Sign in"; the new link does not reuse those names | Every smoke E2E login breaks |
| G10. Phone provider stays off (existing A1 dependency) | An SMS `otp` session of a user without a password would count as mailbox proof |
| G11. Hard rules after T_on (master plan §4): never disable or remove `/auth/confirm`, the check-email screen or the set-password flow | A1 users lose their only verification path |
| G12. Evidence table privileges, as A1b G1: `public.user_password_recoveries(user_id uuid primary key references auth.users(id) on delete cascade, session_id uuid not null, created_at timestamptz not null default now())`; RLS on with no policies; revoke all from `anon`, `authenticated`, `service_role`, `public`; grant only `select, insert, update, delete` to `service_role`; the app touches it only through `createServiceRoleClient()` on the server | New `public` tables get full default privileges for `anon` and `authenticated` (A1b §2); a signed-in user could write evidence naming their own leftover `otp` session and reset the password without a recovery |
| G13. Rollout order: plan and PR approved, migration pushed, hosted checks passed, hosted Reset password template set, then merge and deploy (§5). No deployed code may skip the A1b setup-row read (A1b G7) | Deployed code would read a missing table and fail closed for every recovery; a default template sends users to GoTrue's `/verify` with no handler |

### 1.4 Owner decisions that bind this unit

- Decision 2: "Confirm email" stays on; A2 extends `/auth/confirm` and set-password and removes nothing.
- Decision 5 / master invariant G8: only someone who just proved mailbox ownership may set a password without the old one; A2 keeps that level of proof.
- Decision 9: A1 rollout step 6 runs only after A2 is deployed READY and its recovery QA passed (§5 R6). AUTH-013 is a separate blocker of step 6.
- Decision 10: the G8 marker lives in `public.user_password_setups`; A2 builds its recovery rule on that table.
- Proposed defaults for the Owner to confirm with approval (follow from the master plan and §2):
  1. recovery also confirms a pending account and lets it set a password (the "lost the session before setting a password" case);
  2. a Google-only user may add a password through recovery and keeps only the `google` identity (D7b, source §8.3);
  3. response timing is not neutralized (recorded with AUTH-008);
  4. `/forgot-password` stays reachable while signed in (middleware unchanged; the result is neutral either way);
  5. "accepted recovery" in the master A2 acceptance includes a magic-link token accepted through `/auth/confirm?type=recovery` (**Owner-chosen 2026-10-04**). `type` comes from the browser-supplied query, so whoever holds a magic-link token can deliberately rewrite it to `type=recovery`; ordinary users clicking a mail never land in recovery by accident. The app cannot prevent this by any URL or path design: GoTrue stores both tokens as one `recovery_token`, and a magic-link token verifies as `type=recovery` (§2 Q1). It adds no power: the token is mailed only to the account mailbox, whose holder can request a real recovery mail, and a magic-link session can already change the password through `PUT /auth/v1/user` (AUTH-007). Separating "sign in" from "create a new password credential" belongs to AUTH-007 (reauthentication), which is prioritized right after A2;
  6. last-write-wins ordering for interleaved evidence writes across recovery sessions (G8-S) instead of ordering by session creation time, and no lock between the eligibility check and `updateUser` (an in-flight action of a replaced session may still finish once); the consume delete is already scoped to its own session;
  7. one evidence row per user (primary key `user_id`): only the latest accepted recovery session may reset.
  If the Owner rejects 5 or 6, the plan stops (§5): stronger provenance or ordering needs mechanisms outside this scope.

## 2. Repository facts

Baseline: `5c43476` (A1b merge), checked 2026-10-04.

- `app/auth/confirm/route.ts` parses `token_hash` + `type` (`email | signup`), calls `verifyOtp`, answers `303` with a relative `Location` to `/auth/set-password` or `/login?auth_error=confirm` — justifies the recovery branch and G1.
- `lib/auth/password-setup.ts` `getPasswordSetupEligibility` returns `signed_out` / `not_eligible` / `eligible { userId }`: `getUser()`, `amr` from `getClaims()`, the legacy flag, then a service-role read of `user_password_setups` that fails closed; used by `app/auth/set-password/page.tsx` and `setPasswordAfterConfirmation` — justifies G8/G8-R living in one helper.
- `setPasswordAfterConfirmation` (`app/actions/auth.ts`) calls `updateUser`, inserts the setup row (`23505` treated as success), then writes the legacy `{ d7_password_set: true }`, logging failures only; `resendSignupConfirmation` is the existing neutral mail action — justifies G8-R(d) and G5.
- `supabase/migrations/20261004100000_a1b_user_password_setups.sql` is the latest migration and the privilege pattern G12 copies (RLS on, no policies, revoke all, narrow `service_role` grant). Hosted has it applied and verified (A1b R1–R5) — justifies G12 and G13.
- `app/(client)/login/page.tsx` has `AUTH_ERROR_MESSAGES = { confirm }` behind an `Object.hasOwn` guard, the G9 labels, and no forgot-password link; no forgot-password page exists — justifies the UI scope.
- `utils/supabase/middleware.ts` redirects signed-in users away from `/login` and `/register`; `/auth/*` is unguarded — justifies AC5 and default 4.
- `supabase/config.toml`: `site_url = "http://127.0.0.1:3000"`, `max_frequency = "1s"`, `secure_password_change = false`, a confirmation template only; local recovery mail is GoTrue's English default linking to `/auth/v1/verify` — justifies CP1.
- `@supabase/ssr` 0.9.0 server client uses PKCE; local GoTrue `v2.189.0`.
- `@supabase/auth-js` `_signOut` (`node_modules/@supabase/auth-js/src/GoTrueClient.ts:2327–2355`) calls the Auth server even for `scope: "local"` and returns before removing the stored session on any error other than 401/403/404; `verifyOtp` writes the new session through the SSR `setAll` adapter, which `utils/supabase/server.ts` applies to the Next cookie store — justifies G8-R(b) committing cookies only on success instead of relying on sign-out.
- `supabase/seed.sql` seeds `student@gmail.com` without a setup row or legacy flag, so the seeded learner takes the unchanged A1 branch — justifies the CP3 fixture preparation and R6's already-set account.
- A1 plan §8.3: after step 6, sign-ups are turned off if an incident lets users reach a broken flow — justifies the A2 rollback rule.

Local spikes, 2026-10-03/04, GoTrue `v2.189.0` (scripts outside the repo, users deleted); answer the master-plan A2 questions:

- **Q1 `amr`:** a recovery session has `amr` `otp` — identical to a sign-up verification and a magic-link session — and keeps it after refresh with the same `session_id`. `getClaims().claims.session_id` equals the `auth.sessions` row. A recovery token also verifies as `type=email`, and a magic-link token as `type=recovery` (signup ↔ recovery cross-use → `403 otp_expired`). So neither `amr` nor URL `type` identifies a recovery — justifies G8-R.
- **Q2 condition:** recovery tokens are single-use and a newer link supersedes an older one (`403 otp_expired`) — justifies G8-R's stored `session_id`.
- **Q3 Google-only (simulated):** with the email identity replaced by a `google` identity and no password, the user gets the mail, the recovery session sets a password, and the password signs in; identities and `app_metadata.providers` stay `google` only — justifies AC4 and default 2.
- **Q4 rate limit and neutrality:** unknown email → `200`, no mail, no user created; existing or pending → `200` and a mail; the same existing email within `max_frequency` → `429 over_email_send_rate_limit` (never for unknown); malformed → `400 validation_failed`; the recovery window is separate from the sign-up resend window; existing emails respond slower (mail sent synchronously) — justifies G5 and default 3.
- `updateUser({ password })` with a recovery session succeeds, keeps that session, and revokes other sessions' refresh tokens (the verify step alone does not); a second `updateUser` on the same session also succeeds at the Auth API (AUTH-007) — justifies G8-S.
- A pending user's recovery verify sets `email_confirmed_at` — justifies default 1.
- GoTrue's Admin update and its `verifyOtp` rewrite the whole `raw_app_meta_data` from an unlocked snapshot, so concurrent `app_metadata` writes lose keys (493/1000 Admin trials, 126/820 swept verify trials; AUTH-014). This is why r4 keeps the evidence out of `app_metadata`; the A1b table design lost the marker in 0 of 1320 trials (A1b plan §2).
- A PKCE `resetPasswordForEmail` stores a `pkce_…` hash that `verifyOtp(recovery)` accepts from another client without a code verifier — links work across browsers (AC3).

## 3. Bounded implementation hypotheses

- Migration timestamp after `20261004100000`; table, RLS and grants exactly as G12; no backfill (no evidence exists before A2) — may change if G12 holds.
- Schema `passwordRecoveryRequestSchema` (or a shared email schema with resend); confirmation `type: z.enum(["email", "signup", "recovery"])` — may change if G1 and AC2 still hold.
- `requestPasswordRecovery` mirrors `resendSignupConfirmation`: parse → `resetPasswordForEmail(email)` with no options → log `error.code ?? error.status` → always "Nếu email này có tài khoản VocaSpace, link đặt lại mật khẩu sẽ tới trong vài phút. Bạn kiểm tra cả mục Spam nhé!" — wording may change if G5 holds.
- `/auth/confirm` recovery branch: `verifyOtp` → `getClaims()` → `sub`, `session_id` → service-role `upsert({ user_id, session_id }, { onConflict: "user_id" })`; a route-local `createServerClient` whose `setAll` buffers cookies; the buffer is applied to the redirect response only on success; failure → `signOut({ scope: "local" })` in `try` (scope asserted in the route test; its cookie writes discarded too) → `/login?auth_error=recovery` with no new auth cookie — may change if G8-R(a–b) hold.
- The evidence upsert, the evidence read and the scoped delete live in small server-only helpers in `lib/auth/password-setup.ts`, so the route, the eligibility check and the action share them — may change if G8-R holds.
- `getPasswordSetupEligibility` keeps its three statuses; `eligible` also carries the current `sessionId` so the action can scope the delete — may change if G8/G8-R(c–d) hold.
- `app/(client)/forgot-password/page.tsx`: RHF + schema, one email field, neutral notice as A1's resend, 60 s countdown, link back to `/login`, current auth card style — may change if AC1/AC2 hold.
- `/login`: `recovery: "Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Bạn có thể gửi lại link mới."`; set-password copy such as "Đặt mật khẩu mới để đăng nhập bằng email." — may change if G9 and AC5 hold.
- Template subject "Đặt lại mật khẩu VocaSpace", link text "Đặt lại mật khẩu", plus "Nếu bạn không yêu cầu, hãy bỏ qua email này; mật khẩu hiện tại không đổi."
- Tests extend the A1/A1b files; a new `__tests__/integration/auth-password-recovery-flow.test.ts` reuses the sign-up flow test's Mailpit helpers.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Migration, local recovery template + config | `npx supabase stop` → `npx supabase start` → `npx supabase db reset`; privilege catalog: only `service_role` holds `select, insert, update, delete`, RLS on, 0 policies, `anon`/`authenticated` writes rejected; `npx supabase db diff` clean; `resetPasswordForEmail` for a seeded user → Mailpit shows the Vietnamese subject/body and `http://127.0.0.1:3000/auth/confirm?token_hash=pkce_…&type=recovery` |
| CP2 | Server boundary: schemas, `requestPasswordRecovery`, `/auth/confirm` recovery branch, eligibility, consume | **Schema:** email valid/invalid; params accept `recovery`, reject unknown types. **Unit action:** success, `429`, other error, malformed (no Supabase call) → identical result; no `redirectTo`; no email in logs. **Unit route:** recovery success → evidence upsert with the claim's `sub`/`session_id` → `/auth/set-password` with cookies committed (user set or not); `verifyOtp` error → `/login?auth_error=recovery`, no write; claims or write failure → `/login?auth_error=recovery` whose final `Set-Cookie` headers carry no new auth cookie, for a cookie-less request and a request with existing chunked auth cookies, including when `signOut` errors or throws (real `@supabase/ssr` adapter, final headers asserted); `email`/`signup` unchanged with no evidence write; `next`/`redirect_to` ignored. **Unit eligibility + action + page guard:** `amr` (`otp`/`password`/`oauth`) × already set (no / row / legacy flag) × evidence (missing / equal / different / read error) → only `otp` ∧ (not set ∨ equal); evidence read error fails closed; success keeps the A1b writes and deletes evidence scoped to `user_id` + `session_id`. **Integration (local stack, hook + confirmations on):** action → Mailpit → route → stored `session_id` = that session's; set password → setup row present, evidence removed, old password fails, new signs in; same session again rejected without `updateUser`; old-then-new links → old rejected, new accepted; a `generateLink(magiclink)` token through the route with `type=recovery` → evidence written and accepted (AC11); an already-set user's direct `generateLink(magiclink)` session rejected; sign-up via action, set password, recover → original session rejected; password session rejected; pending user recovers and sets a password; a delayed consume of an older session does not delete a newer session's evidence (S1 passes eligibility, S2's evidence is written and S2 is eligible, S1's action finishes → S2's evidence row remains and S1 is rejected afterwards; S2's session is now revoked by the password change, so S2 needs a new link); signed-in `authenticated` client cannot read or write the evidence table; Google-only simulation sets a password and signs in; neutrality: unknown, existing, existing again in the window, pending → identical results and no new user |
| CP3 | UI: `/forgot-password`, `/login` link + `auth_error=recovery`, set-password copy | **Component:** field validation, submit payload, pending state, identical notice on success and error, cooldown after every submit, back link; login shows the recovery message only for `auth_error=recovery`, keeps `confirm` and the prototype-key guard, renders the link, keeps G9 labels, no Google button. **Browser (`npm run dev`, `http://127.0.0.1:3000`, Mailpit `http://127.0.0.1:45324`, fixtures: seeded `student@gmail.com` with a `user_password_setups` row inserted first through the service role, and a fresh account signed up through the app locally, verified, then its browser context closed before setting a password):** already-set account: login → forgot → submit → mail → link → set password → `/`, F5 kept; sign out, new password signs in; reuse link → recovery message; newest link in a separate browser context → set-password; lost-session account: forgot → link → set-password → `/`; unknown email shows the same notice; 375 px and 320 px without horizontal overflow; visible keyboard focus. `npx supabase db reset` afterwards restores the seeded password and tables |
| CP4 | Full checks + docs | `npm run test:run`; `$env:ALLOW_DB_INTEGRATION_TESTS='true'; npm.cmd run test:integration`; `npx tsc --noEmit`; eslint on changed files; `git diff --check`; `npm run build`; stop the dev stack, then `npm run test:e2e:smoke` — failures must equal E2E-001 plus the accepted flaky `issue-deep-links` (AUTH-010); update `progress.md` and `problems.md` |

Evidence limits: hosted `max_frequency` and project email limits cannot be forced locally (unit tests + the local `429` case prove neutrality); Google-only is a local simulation (real Google only after A4); AC6 is proven on the route's final response headers, not in a browser; production behavior is proven only by R6.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Recovery exception keyed on `amr` alone lets verification or magic-link sessions reset passwords | G8-R stored `session_id`; CP2 rejection rows |
| Evidence table exposed to signed-in users | G12 revoke + RLS; CP1 catalog and CP2 client checks; R2 hosted checks |
| `429` or errors surfaced for existing emails (enumeration) | G5 single result; unit + integration neutrality |
| Evidence write fails after a valid link | G8-R(b) fail closed; user requests a new link |
| Code deployed before the migration | G13 order; R2 before R4 |
| Hosted Reset password template still default (link goes to GoTrue `/verify` → `/` with no handler) | R3 before R4; R6 catches it |
| Recovery mail lands in Spam; Site URL domain differs from the sender (AUTH-013) | Vietnamese template + SiteURL link; notice says to check Spam; remaining AUTH-013 items stay with the Owner |
| Login edit breaks G9 labels | Component test; CP4 smoke |
| Password change revokes the user's other sessions (spike) | Expected security behavior; noted in QA |

- Rollout runbook (each step needs explicit Owner permission; dashboard steps are the Owner's):
  - R1. `npx supabase db push` (dry-run first, listing only the A2 migration).
  - R2. Hosted read-only checks through the Supabase connector: migration listed; only `service_role` holds `select, insert, update, delete`; RLS on, 0 policies; `set local role service_role` can read the table. **No merge before R2 passes.**
  - R3. Owner: read Authentication → Rate Limits (emails per hour) and the per-user email frequency, record values, no change; set Email Templates → Reset password from `supabase/templates/recovery.html`, link `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`. Safe before merge: old code shows the invalid-link message and has no recovery UI.
  - R4. Merge; wait for the production deploy READY. No other dashboard change (sign-ups OFF, Confirm email ON, hook ON).
  - R5. Signed-out smoke (`/forgot-password`, `/login`, `/auth/set-password` → `/login`) and Vercel runtime logs without errors.
  - R6. Production recovery QA (Decision 9 gate), run by the Owner twice: (i) an account whose password is already set (a `user_password_setups` row, exercises G8-R); (ii) an account without a row or legacy flag (the same branch a user who lost the session before the first password takes). Each run: forgot-password → mail (note Inbox/Spam) → link → new password → `/` → sign out → new password works, old fails; reused link → invalid-link message; unknown email → same notice, no mail. A2 is complete when R6 passes; A1 step 6 still waits for AUTH-013. Recommended at step 6: the first real app sign-up closes the browser before setting a password, then recovers.
- On completion, record in `problems.md`: the response-timing difference (extend AUTH-008); the evidence-delete failure window and the magic-link note (AUTH-006); AUTH-007 unblocked and next in order (default 5); AUTH-013 recovery template done; for A4, GoTrue's own provider/identity writes rewrite `app_metadata` from a snapshot, so A4 keeps G8 on the tables and must not reintroduce `app_metadata` markers.
- Stop when: a hook or trigger change becomes necessary; real mail + `/auth/confirm` gives a recovery session without `otp` or `session_id`; G8-R cannot reject an AC8 row; the Owner rejects default 5 or 6; a redirect target would have to come from the query; build or tests fail beyond the baseline; hosted R2 shows any privilege beyond G12.
- Rollback: fix forward, or revert only the faulty A2 code (the evidence table is inert without the exception and stays; never drop it while deployed code reads it). No rollback may skip the A1b setup-row read (A1b G7). Never remove `/auth/confirm`, the check-email screen or the A1 set-password flow (G11). Before step 6, Decision 9 keeps sign-ups off while a fix lands. After step 6, if recovery breaks so users can reach a broken onboarding flow, turn sign-ups off (as A1 §8.3), keep Confirm email, the hook and the A1 routes, and reopen only after recovery QA passes again. A template incident is fixed in the dashboard with no code rollback.

## 6. Progress

Current State and milestones: [`../../progress.md`](../../progress.md).
