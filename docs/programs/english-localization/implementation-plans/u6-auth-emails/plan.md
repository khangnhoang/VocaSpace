# U6 detail plan — Auth emails

Revision: r3, 2026-11-26. Owner approval: pending. Master plan: [plan.md](../../plan.md), section 4 row U6, section 5 steps 2, 3, 5 and 8, decision 5, [ENLOC-001](../../problems.md#enloc-001-auth-email-language-approach).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the sign-up confirmation email and the password-recovery email that the app asks Supabase Auth to send are written in the interface language active when the person asks for them. The app sends a fixed language marker as the Auth redirect URL only when that language is English, and one template per email type picks Vietnamese or English from it. With the English flag off, the app never sends the marker, so the emails of every app flow stay Vietnamese. Once the new hosted templates and allowlist are installed, the flag alone switches app emails between the languages, which AC4 shows locally. The first release still has a gap: under the master plan order the hosted templates change after the flag, so between the two steps English users get Vietnamese emails. That gap is the step 8 exception, decided by the Owner (section 1.4).

| ID | Observable result |
| --- | --- |
| AC1 | With the English flag off, sign-up, "resend confirmation", "forgot password" and the admin "create user" send emails whose subject and body equal today's Vietnamese emails and whose link has today's structure (origin, `/auth/confirm` path, `type`, a non-empty `token_hash`), whatever the `NEXT_LOCALE` cookie or `Accept-Language` says; the app calls `auth.resend` and `auth.resetPasswordForEmail` with exactly today's arguments. |
| AC2 | With the flag on and English active (`en` cookie, or an English-first `Accept-Language` with no cookie), sign-up, "resend confirmation" and "forgot password" send the English subject and body of Appendix A; the link keeps the AC1 structure, and opening the newest link of each type reaches `/auth/set-password`. |
| AC3 | With the flag on and Vietnamese active, the emails are the Vietnamese ones of AC1. |
| AC4 | With the new templates and allowlist installed on the local stack, the ENLOC-001 sequence with real emails in the order flag off, on, off again: off is Vietnamese, on follows the active language, off again is Vietnamese with the `en` cookie still set. This proves that the flag controls app emails after installation; the first-release order is covered by the step 8 decision in section 1.4, not by AC4. If any step fails, ENLOC-001 stays open and U6 returns to the Owner. |
| AC5 | Direct requests to the local Auth API (not through the app) with a `redirect_to` that is allowed but is not the marker, and with one outside the allowlist, get the Vietnamese email; with the marker they get the English one. |
| AC6 | No locale or marker is stored on data tied to the user: the request payloads carry no language field, and after an English and a Vietnamese request for the same temporary account, `auth.users.raw_user_meta_data`, the account's `profiles` row and its `auth.flow_state` rows hold no locale or marker; records the flows already write (profile creation, recovery evidence) are unchanged in shape. |
| AC7 | The admin "create user" email follows the same rule: with the English flag on, the step B flag off and an `en` cookie, the admin form sends a Vietnamese email; with the step B flag also on and English active, it sends an English one. |

### 1.2 Scope and non-goals

- In scope: `supabase/templates/confirmation.html`, `supabase/templates/recovery.html`, the two subjects and the redirect allowlist in `supabase/config.toml`, a small server helper that returns the email options for the active locale, its use in `signUpUser`, `resendSignupConfirmation` and `requestPasswordRecovery` (`app/actions/auth.ts`) and in the recovery email of `createUserByAdmin` (`app/actions/user.ts`), and tests.
- Non-goals: storing a language on the user (master plan section 7); the hosted templates, subjects and allowlist (the U8 release step, runbook in section 5, each step under its own grant); any other `createUserByAdmin` text (U10); email-change, invite and magic-link templates (not customised today); any Vietnamese wording change.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. When the active language is Vietnamese, including every flag-off request and every locked admin request, the call sites pass no new option to Auth; the existing `auth.test.ts` and `user.test.ts` assertions stay unchanged. | The flag-off path changes before the release step (decision 5), or a Vietnamese email depends on the allowlist. |
| G2. The marker is a single constant, `${SITE_URL}/?lang=en` from `lib/site.ts`, and the templates and subjects compare `.RedirectTo` to that exact string with Go's built-in `eq`; no other template function. | A template parse or runtime error makes Auth fail to send any email. |
| G3. Every email link keeps using `{{ .SiteURL }}/auth/confirm?token_hash=…`; `.RedirectTo` is used only for the language check. | The marker URL becomes a navigation target and the flow breaks. |
| G4. The Vietnamese text of both templates and subjects stays byte-identical to base `1c379999`; the English text is Appendix A. | An approved Vietnamese email changes without the Owner (master plan invariant). |
| G5. The locale comes from `getRequestLocale()`, never from a client field. | A forged input picks the email language, and the flag-off and lock guarantees no longer come from one place. |
| G6. The neutral results of the G5 rule in `auth.ts` (same response whether the email exists) stay unchanged in both languages. | The English path reveals which emails have accounts. |
| G7. Local trials use temporary `@example.test` accounts for every flow that consumes a token, deleted afterwards even when a step fails; seeded accounts are not used to open links. | A seeded QA account gains recovery evidence or a changed password. |
| G8. Before stopping the `voca_space` stack, confirm the project ID and that no other session or running dev server needs it (`list_sessions` and running `next` processes); if unclear, ask the Owner. Stop it with `npx supabase stop --project-id voca_space`; when checking the loaded config, read only the subject and allowlist variables. | Another session's work or QA breaks mid-run, or secrets from the container environment enter the transcript. |

### 1.4 Owner decisions that bind this unit

- Decision 5 (2026-11-21), amended by decision 6: English ships behind the flag; the flag change is the release step.
- 2026-11-26 (ENLOC-001, approach c): the email follows the interface language active when it is requested; no language may be persisted on the user; the local trial is granted on the local stack only.
- Pending at plan approval, first-release order (master plan section 5, steps 5 and 8): either (a) the step 8 exception, recorded in ENLOC-001: flag first, then the hosted templates and allowlist, with the check and separate rollbacks of the section 5 runbook, and English users get Vietnamese emails between the two steps; or (b) a master plan amendment that installs the inert templates and allowlist before the flag, so the flag alone switches emails from the first release (the app sends no marker while the flag is off). The runbook below follows (a); (b) changes only its order.
- Pending at plan approval: H5 as a known limitation.

## 2. Repository facts

Baseline: `1c379999`, checked 2026-11-26.

- `config.toml` lines 247–253 set Vietnamese subjects and point to the two templates; both bodies are Vietnamese and build the link from `{{ .SiteURL }}` and `{{ .TokenHash }}`; the local allowlist is `https://127.0.0.1:3000`, `http://127.0.0.1:3000/**`, `http://localhost:3000/**` — justifies G3, G4 and the allowlist change.
- `signUpUser` creates the user with the admin client, then calls `supabase.auth.resend({ type: "signup", email })`; `resendSignupConfirmation` makes the same call; `requestPasswordRecovery` calls `resetPasswordForEmail(email)` (`app/actions/auth.ts` lines 154, 164, 177); `createUserByAdmin` calls `resetPasswordForEmail(email)` on a session-less anon client (`app/actions/user.ts` lines 99–105) — justifies the in-scope list and G1.
- `__tests__/actions/auth.test.ts` asserts `resend` with exactly `{ type: "signup", email }` (lines 212, 299, 402) — justifies G1.
- `getRequestLocale()` returns `vi` without reading the request when the flag is off, and `vi` on teacher and admin paths while the lock is active (`lib/i18n/request-locale.ts`) — justifies G5 and AC7.
- `/auth/confirm` handles `type=email` and `type=recovery` in different branches; the recovery branch records recovery evidence for the session (`app/auth/confirm/route.ts` lines 26–68) — justifies AC2 checking both link types and G7.
- `lib/site.ts` exports `SITE_URL = "https://vocaspace.com"`; local `NEXT_PUBLIC_APP_URL` is `http://localhost:3000` while the local Auth `SITE_URL` is `http://127.0.0.1:3000`, so no app origin reliably equals Auth's site URL — justifies the fixed marker in G2.
- ENLOC-001 local probe, 2026-11-26, local stack `voca_space` (GoTrue v2.189.0), probe templates and config since reverted: Auth renders both the subject and the body as Go templates; `{{ if eq .RedirectTo (printf "%s/?lang=en" .SiteURL) }}` chose English for `recover` and signup `resend` with `redirect_to=http://127.0.0.1:3000/?lang=en` and Vietnamese without it; for `recover`, a `redirect_to` outside the allowlist fell back to `.SiteURL` (Vietnamese). The probe did not use the fixed `https://vocaspace.com/?lang=en` marker. Auth caches templates: a template file edit applied only after `docker restart supabase_auth_voca_space` (then Kong, which returned 502 until restarted); the subject and allowlist come from container environment set at `npx supabase start` — justifies G2, AC5 and the CP1 procedure.

## 3. Bounded implementation hypotheses

- H1: A helper such as `authEmailRedirect()` in `lib/i18n` returns `undefined` for `vi` and the marker for `en`; call sites add the option only when it is defined (`resend({ type, email, options: { emailRedirectTo } })`, `resetPasswordForEmail(email, { redirectTo })`). May change shape if G1, G2 and G5 hold.
- H2: The marker uses the production `SITE_URL` in every environment, so the local `additional_redirect_urls` gains `https://vocaspace.com/?lang=en`, and the templates compare to that literal. May switch to `printf` over `.SiteURL` only if one app-side origin equals Auth's site URL in every environment.
- H3: Each template holds both bodies in one `{{ if }} … {{ else }} … {{ end }}`, the Vietnamese body in the `else` branch byte-identical to base, and each subject in `config.toml` does the same.
- H4: With `@supabase/ssr` (PKCE), adding `redirectTo` stores no language on the user; AC6 checks it.
- H5: For direct Auth requests (AC5), the marker is accepted from anyone because it is on the allowlist, so a direct API call can get an English email even while the app flag is off. This changes only the language of an email Auth would send anyway. If the Owner does not accept it as a known limitation, U6 stops and returns to ENLOC-001.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Templates, subjects, allowlist, helper and the four call sites, with tests | Unit tests: the helper by flag, lock and locale; the three `auth.ts` actions and `createUserByAdmin` with `vi`, `en`, flag off and the admin lock (G1 arguments unchanged, G6 neutral results in both languages). G4 diff of the Vietnamese branches against base. `npx tsc --noEmit`, `npm run lint`, `npm run test:ci`. Apply the new `config.toml` to the `voca_space` stack under G8 (`npx supabase stop --project-id voca_space`, then `npx supabase start`; data kept in the Docker volume), then restart Kong if Auth returns 502, and confirm the container environment holds the new subjects and allowlist. Templates are Go templates that Node cannot render, so the local trial is their render evidence: AC5 by direct Auth requests with the fixed marker; AC2 and AC3 through a local production build with the flag on, on temporary accounts (G7), opening the newest confirmation and recovery links; AC6 on the same accounts before their links are used and after. |
| Final | Whole-diff self-review and the ENLOC-001 sequence | AC4 on local production builds (flag off, on with `en` and `vi`, off again); AC1 including the admin create-user flow on a temporary user; AC7 through the admin form on two builds (English flag on with the step B flag off, then both on), each with an `en` cookie and a temporary user, subject and body read in Mailpit; final regression as `test-quality-strategy` Verification stages require. Owner reads the English emails during QA. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A template or subject error stops Auth from sending any email. | G2 limits the template to `eq`; CP1 sends every email type in both languages through the real local Auth before commit; the runbook saves the previous hosted templates and subjects before changing them. |
| The hosted allowlist or templates lack the marker, so English users get Vietnamese emails. | AC5 makes this a safe failure; runbook step 4 checks one English email. |
| A direct Auth API call gets an English email while the app flag is off (H5). | Language only; recorded as a limitation for Owner acceptance at plan approval. |

- Rollout runbook (U8, each step under its own grant, in master plan section 5 order, option (a) of section 1.4): (1) turn the English flag on, rebuild, redeploy and confirm on the serving deployment (step A); English users get Vietnamese emails until step 3; (2) save the current hosted confirmation and recovery subjects, templates and redirect allowlist; (3) add `https://vocaspace.com/?lang=en` to the hosted allowlist and install the merged subjects and templates; (4) from the serving deployment, with Owner-provided fixtures approved at U8, trigger a confirmation email (resend for an unconfirmed account) and a recovery email, each once in English and once in Vietnamese, and confirm subject, body and link structure of all four.
- Stop when: Auth does not render a template for one of the requests; a flag-off call must change its arguments; a language would have to be stored on the user; AC4 fails; the Owner rejects H5 or decides neither (a) nor (b).
- Rollback: before release, revert the commit. Interface: turn the flag off, rebuild, redeploy and confirm on the serving deployment; app flows then send no marker, so their emails are Vietnamese whatever the hosted templates hold. Auth step: if step 4 fails (no email, wrong language or broken link), restore exactly the values saved in step 2, including removing the marker from the allowlist, then trigger one confirmation and one recovery email and confirm they arrive in Vietnamese; this rolls back only the Auth step.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).

## Appendix A — English email text (draft for Owner review)

Confirmation subject: "Verify your VocaSpace email".

Confirmation body:

- Heading: Verify your VocaSpace email
- You just signed up for a VocaSpace account with this email address.
- Click the link below to verify your email and set the password for your account:
- Link text: Verify email and set password
- If you didn't sign up for VocaSpace, you can ignore this email.

Recovery subject: "Reset your VocaSpace password".

Recovery body:

- Heading: Reset your VocaSpace password
- You just asked to reset the password of your VocaSpace account with this email address.
- Click the link below to verify your email and set a new password:
- Link text: Reset password
- If you didn't ask for this, you can ignore this email; your current password stays the same.
