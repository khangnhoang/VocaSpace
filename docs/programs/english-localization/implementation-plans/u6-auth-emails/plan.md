# U6 detail plan — Auth emails

Revision: r1, 2026-11-26. Owner approval: pending. Master plan: [plan.md](../../plan.md), section 4 row U6, section 5 steps 2 and 8, decision 5, [ENLOC-001](../../problems.md#enloc-001-auth-email-language-approach).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the sign-up confirmation email and the password-recovery email are written in the interface language that is active when the person asks for them. The app sends a fixed language marker to Supabase Auth only when that language is English, and one template per email type picks Vietnamese or English from it. With the English flag off, the app never sends the marker, so every email stays Vietnamese. The flag change alone then controls the emails, and decision 5 needs no exception.

| ID | Observable result |
| --- | --- |
| AC1 | With the English flag off, sign-up, "resend confirmation" and "forgot password" send emails whose subject, body and link equal today's Vietnamese emails, whatever the `NEXT_LOCALE` cookie or `Accept-Language` says; the app calls `auth.resend` and `auth.resetPasswordForEmail` with exactly today's arguments. |
| AC2 | With the flag on and English active (`en` cookie, or an English-first `Accept-Language` with no cookie), the same three requests send an English subject and body (Appendix A); the confirm or recovery link is unchanged and still completes the flow (`/auth/confirm` then set password). |
| AC3 | With the flag on and Vietnamese active, the emails are the Vietnamese ones of AC1. |
| AC4 | The local trial of ENLOC-001 passes with real emails from the local stack in the order flag off, on, off again: off is Vietnamese, on follows the active language, off again is Vietnamese with the `en` cookie still set. |
| AC5 | A request whose marker is not on the Auth redirect allowlist, or any other `redirect_to`, gets the Vietnamese email (Auth falls back to the site URL). |
| AC6 | No language is stored on the user: `auth.users.raw_user_meta_data` and the app tables are unchanged by a request in either language. |
| AC7 | The admin "create user" flow (`createUserByAdmin`) is unchanged and its recovery email stays Vietnamese (the admin area is locked to Vietnamese, U9). |

### 1.2 Scope and non-goals

- In scope: `supabase/templates/confirmation.html`, `supabase/templates/recovery.html`, the two subjects and the redirect allowlist in `supabase/config.toml`, a small server helper that returns the email options for the active locale, its use in `signUpUser`, `resendSignupConfirmation` and `requestPasswordRecovery` (`app/actions/auth.ts`), and tests.
- Non-goals: storing a language on the user (master plan section 7); the hosted templates, subjects and allowlist (a U8 release step with its own grant, runbook in section 5); `createUserByAdmin` (step B, U10); email-change, invite and magic-link templates (not customised today); any Vietnamese wording change.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. When the active language is Vietnamese, including every flag-off request, the actions pass no option to Auth; the existing `auth.test.ts` assertions stay unchanged. | The flag-off path changes before the release step (decision 5), or a Vietnamese request depends on the allowlist. |
| G2. The marker is a single constant, `${SITE_URL}/?lang=en` from `lib/site.ts`, and the templates compare `.RedirectTo` to that exact string with Go's built-in `eq`; no other template function. | A template parse or runtime error makes Auth fail to send the email at all. |
| G3. Every email link keeps using `{{ .SiteURL }}/auth/confirm?token_hash=…`; `.RedirectTo` is used only for the language check. | The marker URL becomes a navigation target and the flow breaks or redirects to a page outside the flow. |
| G4. The Vietnamese text of both templates and subjects stays byte-identical to base `1c379999`; the English text is Appendix A. | An approved Vietnamese email changes without the Owner (master plan invariant). |
| G5. The locale comes from `getRequestLocale()`, never from a client field. | A forged input picks the email language, and the flag-off guarantee no longer comes from one place. |
| G6. The neutral results of the G5 rule in `auth.ts` (same response whether the email exists) stay unchanged in both languages. | The English path reveals which emails have accounts. |

### 1.4 Owner decisions that bind this unit

- Decision 5 (2026-11-21), amended by decision 6: English ships behind the flag, and the flag change is the release step.
- 2026-11-26 (ENLOC-001): the email follows the interface language active when it is requested; the local trial is granted on the local stack only.

## 2. Repository facts

Baseline: `1c379999`, checked 2026-11-26.

- `config.toml` lines 247–253 set Vietnamese subjects and point to the two templates; both bodies are Vietnamese and build the link from `{{ .SiteURL }}` and `{{ .TokenHash }}` — justifies G3, G4.
- `signUpUser` creates the user with the admin client, then calls `supabase.auth.resend({ type: "signup", email })`; `resendSignupConfirmation` makes the same call; `requestPasswordRecovery` calls `resetPasswordForEmail(email)` with no options (`app/actions/auth.ts` lines 154, 164, 177) — justifies the in-scope list and G1.
- `__tests__/actions/auth.test.ts` asserts `resend` with exactly `{ type: "signup", email }` (lines 212, 299, 402) — justifies G1.
- `getRequestLocale()` returns `vi` without reading the request when the flag is off and `vi` in locked areas (`lib/i18n/request-locale.ts`) — justifies G5 and AC7.
- `lib/site.ts` exports `SITE_URL = "https://vocaspace.com"`; local `NEXT_PUBLIC_APP_URL` is `http://localhost:3000` while the local Auth `SITE_URL` is `http://127.0.0.1:3000`, so neither app origin reliably equals Auth's site URL — justifies the fixed marker in G2.
- ENLOC-001 local trial, 2026-11-26, local stack `voca_space` (GoTrue v2.189.0), probe templates since reverted: Auth renders both the subject and the body as Go templates; `{{ if eq .RedirectTo (printf "%s/?lang=en" .SiteURL) }}` chose English for `recover` and `resend` (signup) with `redirect_to=http://127.0.0.1:3000/?lang=en` and Vietnamese without it; a `redirect_to` outside the allowlist fell back to `.SiteURL` (Vietnamese); Auth caches templates, so a local template edit needs `docker restart supabase_auth_voca_space` (then Kong) — justifies G2, AC5 and the CP1 procedure.

## 3. Bounded implementation hypotheses

- H1: A helper such as `authEmailOptions()` in `lib/i18n` returns `undefined` for `vi` and the marker for `en`; the actions spread it into the call (`resend({ type, email, options: { emailRedirectTo } })`, `resetPasswordForEmail(email, { redirectTo })`). May change shape if G1, G2 and G5 hold.
- H2: The marker uses the production `SITE_URL` in every environment, so local `additional_redirect_urls` gains `https://vocaspace.com/?lang=en`, and the templates compare to that literal. May switch to `printf` over `.SiteURL` only if a single app-side origin that equals Auth's site URL in every environment exists.
- H3: Each template holds both bodies in one `{{ if }} … {{ else }} … {{ end }}`, the Vietnamese one in the `else` branch byte-identical to base, and each subject in `config.toml` does the same.
- H4: With `@supabase/ssr` (PKCE), adding `redirectTo` stores no language on the user; checked in CP1 against `auth.users` and `auth.flow_state`.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Templates, subjects, allowlist, helper and the three call sites, with tests | Unit tests: helper by locale and flag; the three actions with `vi`, `en` and flag off (G1 arguments unchanged, G6 neutral results in both languages). Templates are Go templates that Node cannot render, so the local trial below is their render evidence. G4 diff of the Vietnamese branches against base. `npx tsc --noEmit`, `npm run lint`, `npm run test:ci`. Local trial (restart auth and Kong after the template change): AC1 to AC6 with real emails in Mailpit through the app (local production build, seeded student for recovery, a temporary `@example.test` user for sign-up, deleted afterwards), including following an English recovery link to set-password. |
| Final | Whole-diff self-review and the ENLOC-001 sequence | AC4 run on local production builds: flag off, flag on (`en` and `vi`), flag off again; AC7 from the admin create-user form once, with a temporary user deleted afterwards; final regression as `test-quality-strategy` Verification stages require. Owner reads the English emails during QA. |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| A template error stops Auth from sending any email. | G2 limits the template to `eq`; CP1 sends every email type in both languages through the real Auth before commit. |
| The hosted allowlist lacks the marker, so English requests get Vietnamese emails after release. | AC5 makes this a safe failure; the U8 runbook adds the marker and checks one English email before the flag goes on. |
| The hosted templates and the app drift (template deployed without the marker check, or the reverse). | The marker is a constant shared by app and template; the U8 runbook deploys the templates first and verifies a Vietnamese email while the flag is off. |

- Rollout runbook (U8, each step under its own grant): (1) with the flag still off, add `https://vocaspace.com/?lang=en` to the hosted redirect allowlist and replace the hosted confirmation and recovery subjects and templates with the merged ones; (2) trigger one recovery email to an Owner account and confirm it is Vietnamese; (3) turn the English flag on as step A; (4) trigger one recovery email in English and confirm it is English.
- Stop when: Auth does not render the template for one of the three requests; the flag-off arguments must change; a language would have to be stored on the user.
- Rollback: before release, revert the commit. After release, turning the flag off stops the marker, so every email is Vietnamese again without touching the hosted templates; restoring the previous hosted templates is only needed if a template itself fails.

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
