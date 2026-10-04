# Problems, risks and follow-ups — Auth onboarding program

Plan: [plan.md](./plan.md). Progress: [progress.md](./progress.md). Follow-ups raised while implementing each PR (source r8 §8.3) are recorded here when that PR completes.

## Open

### AUTH-002: Google buttons do not mean OAuth is implemented

- Status: Open. Moved from the [student-user-flow-route](../student-user-flow-route/problems.md) program on 2026-10-02 with the same ID. Handled by A4.
- Problem: `/login` and `/register` show Google buttons with no handler.
- Direction: the Owner chose real Google OAuth (Decision 1). A1 hides the buttons; A4 shows them again with the working flow (Decision 8).
- Resolved when: A4 merges and Google sign-in works in production.

### AUTH-004: `createUserByAdmin` creates users with a known default password

- Status: Open (follow-up, outside the 4 PRs). (`AUTH-003` is already used by the student-user-flow-route program.)
- Problem: `app/actions/user.ts` creates users with a fixed password and `email_confirm: true`.
  - Anyone who knows the default password can sign in to the account.
  - Once Google is enabled, that account is auto-linked to the email owner's Google identity.
- Mitigation in this program: audit these users under gate G3 before every Google enable (plan §4, source §8.2 step 7).
- Later fix: random password plus an email invitation to set a password.

### AUTH-005: Retire the D7 combined source plan once no plan references it

- Status: Open (docs housekeeping).
- Problem: [sources/d7-combined-plan-r8.md](./sources/d7-combined-plan-r8.md) is the reviewed source the per-PR plans are cut from. The master plan and the A1 plan cite its sections (spikes, guardrail rationale, attacker acceptance), and A2/A4 still need its G8 and Google content.
- Direction: keep it until the A4 detail plan is cut; then delete it or mark it historical, updating every reference in the same change.
- Resolved when: no program document links to it, or it is explicitly marked historical.

### AUTH-006: G8 limits after A1/A2

- Status: Open (accepted A1 limits, source §8.3; A2 r4.3 G8-S/defaults 5–6).
- Problem:
  - profile data entered by someone who pre-registered an email through the app stays on the victim's profile (the Owner fixes it via the dashboard);
  - while `d7_password_set` is unset, a mailbox owner can also set a password once through a magic link from the direct Auth API;
  - if `updateUser` succeeds but the service-role flag write fails, `setPasswordAfterConfirmation` only logs the error code and still redirects to `/` (the password is already changed, so an error screen would mislead). Until the flag is written, the same `otp` session can set the password again; only the mailbox owner holds that session. Covered by a unit test; a retry or alert is not worth widening A1.
  - A2 recovery is checked at eligibility time, without a lock spanning `updateUser`: an in-flight S1 action may finish after S2 replaces its evidence. The consume deletes only S1's `user_id`/`session_id`, keeping S2's row; Auth still revokes S2 when S1 changes the password (verified locally).
  - a failed recovery evidence delete is logged and still redirects after the password changed. That recovery session can reset again until its session ends or a newer recovery replaces its row; unit tests cover the failed delete.
  - interleaved evidence writes are last-write-wins, so a delayed older recovery can replace a newer one; the rejected user requests a new link. A magic-link token submitted as `type=recovery` is also accepted (Owner default 5; local integration verified), while a direct magic-link session for an already-set user stays rejected by the app. Direct Auth API password changes remain AUTH-007.
- Resolved when: a later plan removes or explicitly accepts these limits.

### AUTH-007: The Auth API can change a password with any valid session

- Status: Open (follow-up; prioritized by the Owner 2026-10-04 as the next unit right after A2).
- Problem: any valid access token, including the original `otp` session, can change the password directly through `PUT /auth/v1/user`; concurrent set-password requests from one verified session are last-write-wins (A1 §2.5 replay-guard scope).
- Also: a magic-link token can be submitted as `type=recovery` and used for A2's password reset (A2 default 5); GoTrue cannot tell the two apart, so only reauthentication before a password change separates "sign in" from "create a password".
- Candidate fix: turn on "Secure password change" (reauthentication) right after A2, evaluated in its own plan.

### AUTH-008: Email enumeration protection is app-level only

- Status: Open (accepted).
- Problem: G5 neutral results cover the app's actions and screens, not the direct Supabase Auth API.
- A2 keeps response timing differences (Owner default 3): an existing email may wait for mail sending, while an unknown email returns sooner. Results and the 60 s UI cooldown remain identical; local unknown/pending/known/429 cases and provider failures are covered. Timing neutralization is outside A2.

### AUTH-009: A failed sign-up can leave an orphan avatar file

- Status: Open (pre-existing).
- Problem: `signUpUser` uploads the avatar before the user is created, so a sign-up that never completes leaves the file in the `avatars` bucket.

### AUTH-010: `issue-deep-links` smoke E2E is flaky

- Status: Open (found during A1 CP4, not caused by A1).
- Evidence 2026-10-03: after the Topic Builder settings tab click the URL still keeps `from=dashboard`. On the pre-A1 commit `9bfd0c6` it failed 1 of 3 runs; on A1 it passed 1 of 5 runs. A1 does not touch the Topic Builder tabs.
- Direction: a separate fix of the tab URL update in `TopicBuilderTabs.tsx` or of the spec's wait; track together with E2E-001.

### AUTH-012: Auth screens have no accepted design yet

- Status: Deferred 2026-10-03 by the Owner to a separate login/register UI/UX redesign PR.
- Problem: A1's new check-email and set-password cards use a neutral white header, while `/login` and `/register` keep the older Blue 400 header. The login form is also small and visually dated. There is no accepted screen-type design for public/auth screens (the "Client/Marketing" type named in `docs/ui-design-system-and-review/plan.md`), so neither header can claim to be the target.
- A1 kept only cheap, behavior-level fixes: login floating labels now pass clicks to their inputs (`pointer-events-none`, matching `/register`).
- Direction: design Client/Marketing (homepage, login, register, check-email, set-password) first, then align all auth cards in one redesign PR.

### AUTH-013: Hosted auth mail lands in Gmail Spam with a danger warning

- Status: Open 2026-10-03; deferred by the Owner. Blocks §8.2 step 6 (re-enabling sign-ups), not steps 4–5 or the A1 merge.
- Evidence: SMTP via Resend from `noreply@auth.vocaspace.com` works. After adding `_dmarc.vocaspace.com` (`v=DMARC1; p=none;`), a recovery test mail to Gmail showed SPF, DKIM (`auth.vocaspace.com`) and DMARC all PASS, but it still landed in Spam with a danger warning.
- Likely causes (not proven): the default "Reset Your Password" template links to `<ref>.supabase.co`, a different domain from the sender; `vocaspace.com` is brand new with no sending reputation; the default template is short, English and has a single link.
- To do later:
  - attach `vocaspace.com` (or a subdomain) to the Vercel app and use it for Site URL and Redirect URLs in §8.2 step 3, so the sender, link and site share one domain (no code hardcodes `vocaspace.vercel.app`; only docs and README do);
  - A2 local implementation completed 2026-10-04: `supabase/templates/recovery.html` has a Vietnamese body and a `{{ .SiteURL }}/auth/confirm?...&type=recovery` link; Mailpit checks passed. Setting the hosted Reset password template is still R3, after implementation review and separate rollout authorization;
  - register `vocaspace.com` in Gmail Postmaster Tools; keep test volume low and mark test mails as not spam;
  - optionally score one mail on mail-tester.com after the template change.
- Exit: a Confirm signup mail sent from production reaches the Gmail Inbox without a warning before step 6.

### AUTH-015: Legacy `d7_password_set` read and write after A1b

- Status: Open 2026-10-04 (split from AUTH-014 after A1b rollout R1–R5).
- Problem: `public.user_password_setups` is now the G8 marker, but the app still reads `app_metadata.d7_password_set` and writes it as a fallback. Residual gaps without a row: both marker writes failing after the password changes (AUTH-006, replay without any race); only the table write failing, with the fallback flag later erased by a concurrent GoTrue write (AUTH-014). The hosted backfill re-run inserted 0 rows and coverage is 0, so no flagged user lacks a row today.
- Direction: a later cleanup removes the `app_metadata` read and write once no deployed code depends on them (A1b G7: never deploy eligibility code that skips the table read).
- A4 must keep the app-owned setup/recovery tables: GoTrue OAuth/provider metadata writes can replace an unlocked `app_metadata` snapshot (AUTH-014). Do not move either guard back into provider metadata.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git (`git show 3094600:docs/refactors/auth-onboarding/problems.md`).

- AUTH-011 — Resolved 2026-10-03: the Owner approved `allowedDevOrigins: ["127.0.0.1"]` in `next.config.ts`, so auth QA runs on `next dev` at the `site_url` host (`5782117`); if a hydration mismatch like vercel/next.js#98604 appears later, re-run the recorded A/B check in a clean profile before reverting.
- AUTH-014 — Resolved 2026-10-04: A1b moved the G8 marker to `public.user_password_setups` (PR 121, `5c43476`); hosted rollout R1–R5 passed (migration, privileges, deploy READY, smoke incl. the Owner's signed-in check, backfill re-run 0 rows); the legacy read/write and residual gaps moved to AUTH-015; full entry: `git show 5c43476:docs/refactors/auth-onboarding/problems.md`.
