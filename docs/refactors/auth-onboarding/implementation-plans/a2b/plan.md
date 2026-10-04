# A2b detail plan — Password change protection (AUTH-007)

Revision: r2, 2026-10-05 (Codex plan review r1: cumulative gates, passwordless exception, direct API probe in R3; review r2 PASS, Optional wording fix applied). r1, 2026-10-04. Owner approval: pending. Master plan: [plan.md](../../plan.md) (Decision 11, pending with this plan).

Branch `feat/auth-a2b-password-change`. Size: medium/high-risk — no migration and few files, but it changes who may change a password through the public Auth API (two hosted toggles) and must keep the A1 and A2 set-password flows and the `/profile` password change working.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: after merge and rollout, the public Auth API changes a password only when the caller passes two cumulative gates (GoTrue checks them in this order): (a) the session was created less than 24 hours ago, or the call carries a valid email reauthentication nonce; and (b) the call carries the current password, unless the session was created from an email link (sign-up confirmation, recovery, magic link) or the user has no password yet (default 5). A stolen or left-open password-sign-in session can no longer change the password without the current password, and no session can after 24 hours without a nonce; the gate (b) exemptions stay as accepted residuals (defaults 2 and 5). The app's two password paths keep working with both toggles on.

| ID | Observable result |
| --- | --- |
| AC1 | With "Require current password" on, a password-sign-in session less than 24 hours old that calls `PUT /auth/v1/user` with a new password and no or a wrong `current_password` is rejected (`current_password_required` / `current_password_invalid`); the password is unchanged |
| AC2 | With "Secure password change" on, any session created more than 24 hours ago that calls `PUT /auth/v1/user` with a new password is rejected before the current-password check: without a nonce (`reauthentication_needed`) or with an invalid nonce; the password is unchanged |
| AC3 | On `/profile`, a signed-in user who enters the right current password and a valid new password changes the password with both toggles on; a wrong current password shows "Mật khẩu hiện tại không chính xác!"; the same password shows "Mật khẩu mới phải khác mật khẩu cũ."; no raw English GoTrue message reaches the UI |
| AC4 | The A1 first password set and the A2 recovery set-password, from a link session less than 24 hours old, still succeed with both toggles on, without asking for any old password; A1/A2 eligibility, marker writes and recovery consume are unchanged |
| AC5 | On `/auth/set-password`, an eligible link session older than 24 hours is told to request a new link from "Quên mật khẩu?" (`/forgot-password`); no marker is written and the recovery evidence is not consumed |
| AC6 | The code merged in this unit behaves the same with both toggles off, so rollback can turn the toggles off without reverting code |

### 1.2 Scope and non-goals

- In scope:
  - `/profile` password change sends the current password with the update and maps GoTrue error codes to Vietnamese messages;
  - set-password maps `reauthentication_needed` to the new-link message (AC5);
  - local `secure_password_change = true` in `supabase/config.toml` and tests for AC2–AC5;
  - Owner turns on both hosted toggles after deploy (§5);
  - close AUTH-007 with the accepted residual (§1.4 default 2) after rollout.
- Non-goals:
  - a nonce entry UI (`reauthenticate()` + code field);
  - a "password changed" notification email (default 4);
  - MFA, session timebox or inactivity timeout;
  - Google-only accounts adding a password (belongs to A4, default 5);
  - the last-write-wins behavior of concurrent set-password requests from one session (stays accepted from A1 §2.5);
  - redesign of `/profile` (AUTH-012 covers auth screens only).

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Deploy the app change and confirm READY before turning on "Require current password" | The current `/profile` flow calls `updateUser` without `current_password` and fails with `current_password_required` (spike case 8): every profile password change breaks |
| G2. Never send the user's current password anywhere except the `current_password` field of the same `updateUser` call and the existing `signInWithPassword` check; never log it or return it | Password exposure in logs or responses |
| G3. Set-password must not ask for an old password and must not change A1/A2 eligibility, marker or consume order | A1 users (random server password) and recovery users cannot set a password; G8 replay protection changes without review |
| G4. Keep the fresh `signInWithPassword` before `updateUser` in `/profile` | A user whose session is older than 24 hours would get `reauthentication_needed` with no nonce UI (non-goal), so long-lived sessions could not change the password |
| G5. Hosted toggles are Owner-only Dashboard actions (program G6); record before/after values without secrets | Untracked hosted drift; rollback unknown |

### 1.4 Owner decisions that bind this unit

Proposed defaults, pending Owner approval:

1. Turn on both hosted toggles: "Secure password change" (reauthentication after 24 hours) and "Require current password when updating". Alternatives: only the first toggle (password-sign-in sessions under 24 hours stay unprotected), or no change and close AUTH-007 as accepted.
2. Accept and record the residual that GoTrue cannot narrow: a session created from any email link (sign-up confirmation, recovery, or a magic link, including a magic link submitted as `type=recovery`, A2 default 5) may change the password without the old one for 24 hours after it was created. This proves the same thing as recovery: control of the mailbox. With this accepted, AUTH-007 closes after rollout.
3. A set-password session older than 24 hours gets a "request a new link" message (AC5), not a nonce UI.
4. No "password changed" notification email in this unit; record it in `future-features.md` as a possible later hardening.
5. Accept the passwordless-account exception: a user with no password yet (Google-only after A4) can add one from any session less than 24 hours old, including a fresh OAuth session, without mailbox proof or a current password, because GoTrue skips the current-password check when the user has no password. Master Decision 11 and G8 record this exception; the A4 detail plan restates it. Nothing to build now.

## 2. Repository facts

Baseline: `5697d01`, checked 2026-10-04. GoTrue source tag `v2.189.0` (the local image).

- `app/actions/profile.ts` `updateUserPassword` checks the current password with `signInWithPassword`, then calls `updateUser({ password })` without `current_password`, and returns GoTrue's raw `error.message` — justifies AC3, G1, G4.
- `app/actions/auth.ts` `setPasswordAfterConfirmation` maps `same_password` and `weak_password`; any other `updateUser` error, including `reauthentication_needed`, shows the generic retry message — justifies AC5.
- `supabase/config.toml:228` `secure_password_change = false`. Supabase CLI 2.106.0 has no config key for "Require current password" (only `secure_password_change` appears in the binary), so local stacks cannot enable it from `config.toml` — justifies the AC1 evidence plan (§4).
- No test covers `updateUserPassword` today — justifies new tests in CP1.
- GoTrue `internal/api/user.go` (v2.189.0): with reauthentication on, a nonce is required only when the session is missing or `created_at` is more than 24 hours ago; with current password on, it is required only when the user has a password and `!session.IsRecovery()`. `internal/models/factor.go`: `IsRecovery()` is true for `otp`, `magiclink` and `recovery` methods; `internal/api/verify.go` issues `otp` for email links verified with `POST /verify` (`verifyOtp` with `token_hash`, which `/auth/confirm` uses); the GET/PKCE path uses the parsed method. The nonce gate runs before the current-password gate, so the gates are cumulative — justifies the outcome, defaults 2 and 5, and AC1, AC2, AC4.
- The Supabase password-security guide documents both Dashboard toggles ("Require reauthentication when changing password", "Require current password when changing password") — justifies default 1 and G5.

Local spike, 2026-10-04 (isolated stack `voca_space_spike007`, GoTrue v2.189.0, `secure_password_change = true`; current-password case by restarting the auth container with `GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD=true`; sessions aged by setting `auth.sessions.created_at` 25 hours back):

| # | Session and call | Result |
| --- | --- | --- |
| 1 | recovery link (`amr` otp), fresh, no nonce | changed |
| 2 | recovery link, aged 25 h, no nonce / after `reauthenticate()` with the mailed nonce | `reauthentication_needed` / changed |
| 3 | magic link submitted as `type=recovery`, fresh | changed |
| 4 | password sign-in, fresh / aged 25 h, no nonce | changed / `reauthentication_needed` |
| 5 | password sign-in, current-password on: none / wrong / right | `current_password_required` / `current_password_invalid` / changed |
| 6, 7 | recovery link / magic link, current-password on, no current password | changed |
| 8 | current `/profile` sequence (sign in, then `updateUser` without `current_password`), current-password on | `current_password_required` |

Spike scripts stayed outside the repo; the stack was removed.

## 3. Bounded implementation hypotheses

- `updateUserPassword` passes `current_password: validated.data.currentPassword` to `updateUser` and maps `current_password_invalid`/`current_password_required` → the existing wrong-password message, `same_password`, `weak_password`, `reauthentication_needed` → a "sign in again" message, others → a generic retry message — may change if AC3 and G2/G4 hold.
- The Vietnamese messages may live as constants in each action file or a small shared module — may change if each UI message stays as in AC3/AC5.
- AC5 copy, for example "Phiên xác minh đã quá 24 giờ. Bạn yêu cầu link mới ở trang Quên mật khẩu nhé." with a link or pointer to `/forgot-password` — wording may change if it tells the user to request a new link.
- Tests: unit tests in `__tests__/actions/profile.test.ts` (new) and `__tests__/actions/auth.test.ts`; one integration case in `__tests__/integration/auth-password-recovery-flow.test.ts` that ages the session in the local database and expects the AC5 result — locations may change if the same behaviors are asserted.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | AC2–AC6 in code and tests: profile action sends `current_password` and maps errors; set-password maps `reauthentication_needed`; local `secure_password_change = true` | `npm run test:run`; `npm run test:integration` (local stack restarted with the new config); `tsc --noEmit`; eslint on changed files; `npm run build`; local browser check of `/profile` password change (right, wrong, same) and one recovery set-password |
| CP2 | Docs: progress State and milestone, AUTH-007 closing text ready for after rollout, future-features entry (default 4) | Link check of changed docs; `git diff --check` |

AC1, and the current-password half of AC4, are verified by the GoTrue source, the spike above and the hosted R3 checks (§5), because the local CLI cannot enable the current-password toggle. `/profile` QA alone cannot prove AC1, because the app already rejects a wrong current password through `signInWithPassword`; R3 therefore includes a direct public API probe. The spike did not run a sign-up confirmation session; AC4 for the A1 first password set rests on the source until R3 step c, which is required before AUTH-007 closes.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Toggle turned on before deploy breaks `/profile` (spike 8) | G1: R2 only after R1 READY |
| Hosted GoTrue version differs from local v2.189.0 | R3 Owner QA on production after the toggles; rollback is a toggle switch |
| A user stuck on set-password after 24 hours | AC5 message points to `/forgot-password`, which issues a fresh session |
| A3 also edits `app/actions/profile.ts` | A3 is not started; A3 rebases on this unit |
| Residual: fresh email-link sessions change the password without the old one | Owner default 2; same proof as recovery |
| Exception: passwordless accounts add a password from any fresh session | Owner default 5; recorded in master G8 and Decision 11 |

- Rollout runbook:
  1. R1: merge, Vercel production READY, signed-out smoke of `/profile` redirect and `/forgot-password`.
  2. R2 (Owner, Dashboard → Authentication → Email provider): record current values, then turn on "Secure password change" and "Require current password when updating".
  3. R3 (Owner, production), all required before AUTH-007 closes:
     a. direct public API probe with an Owner test account (the Owner runs it and types the password; Claude never handles it): sign in with the password, then `updateUser` with a new password and no `current_password`, then with a wrong one → `current_password_required` / `current_password_invalid`, and the old password still signs in;
     b. `/profile`: wrong current password → error, right → success; a new recovery link → set-password succeeds;
     c. one new sign-up after A1 step 6 sets the first password from the confirmation link. If step 6 is still pending, AUTH-007 stays open until this check passes.
- Stop when: R1 is not READY; either toggle is missing or named differently in the Dashboard; any R3 check fails (turn the toggles off first, then report).
- Rollback: turn the toggles off (immediate, no data change); the code stays compatible (AC6). Revert the app change only after the toggles are off.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
