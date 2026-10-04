# Problems, risks and follow-ups — Auth onboarding program

Plan: [plan.md](./plan.md). Progress: [progress.md](./progress.md). Follow-ups raised while implementing each PR (source r8 §8.3) are recorded here when that PR completes.

## Open

### AUTH-002: Google buttons do not mean OAuth is implemented

- Status: Open. Moved from the [student-user-flow-route](../student-user-flow-route/problems.md) program on 2026-10-02 with the same ID. Handled by A4.
- Problem: `/login` and `/register` show Google buttons with no handler.
- Evidence: the entry came from the [student-user-flow-route](../student-user-flow-route/problems.md) program with the same ID; A1 (PR 119) hides the buttons.
- Direction: the Owner chose real Google OAuth (Decision 1). A1 hides the buttons; A4 shows them again with the working flow (Decision 8).
- Exit condition: A4 merges and Google sign-in works in production.

### AUTH-004: `createUserByAdmin` creates users with a known default password

- Status: Open (follow-up, outside the 4 PRs). (`AUTH-003` is already used by the student-user-flow-route program.)
- Problem: `app/actions/user.ts` creates users with a fixed password and `email_confirm: true`.
  - Anyone who knows the default password can sign in to the account.
  - Once Google is enabled, that account is auto-linked to the email owner's Google identity.
- Evidence: `createUserByAdmin` in `app/actions/user.ts`; the G3 audit is in plan §4 and source §8.2 step 7.
- Direction: mitigation in this program is to audit these users under gate G3 before every Google enable. The later fix is a random password plus an email invitation to set a password.
- Exit condition: the later fix lands, so no admin-created user has a known default password.

### AUTH-005: Retire the D7 combined source plan once no plan references it

- Status: Open (docs housekeeping).
- Problem: [sources/d7-combined-plan-r8.md](./sources/d7-combined-plan-r8.md) is the reviewed source the per-PR plans are cut from.
- Evidence: the master plan and the A1 plan cite its sections (spikes, guardrail rationale, attacker acceptance), and A2/A4 still need its G8 and Google content.
- Direction: keep it until the A4 detail plan is cut; then delete it or mark it historical, updating every reference in the same change.
- Exit condition: no program document links to it, or it is explicitly marked historical.

### AUTH-006: G8 limits after A1/A2

- Status: Open (accepted A1 limits, source §8.3; A2 r4.3 G8-S/defaults 5–6).
- Problem:
  - profile data entered by someone who pre-registered an email through the app stays on the victim's profile (the Owner fixes it via the dashboard);
  - while `d7_password_set` is unset, a mailbox owner can also set a password once through a magic link from the direct Auth API;
  - if `updateUser` succeeds but the service-role flag write fails, `setPasswordAfterConfirmation` only logs the error code and still redirects to `/` (the password is already changed, so an error screen would mislead). Until the flag is written, the same `otp` session can set the password again; only the mailbox owner holds that session. Covered by a unit test; a retry or alert is not worth widening A1.
  - A2 recovery is checked at eligibility time, without a lock spanning `updateUser`: an in-flight S1 action may finish after S2 replaces its evidence. The consume deletes only S1's `user_id`/`session_id`, keeping S2's row; Auth still revokes S2 when S1 changes the password (verified locally).
  - a failed recovery evidence delete is logged and still redirects after the password changed. That recovery session can reset again until its session ends or a newer recovery replaces its row; unit tests cover the failed delete.
  - interleaved evidence writes are last-write-wins, so a delayed older recovery can replace a newer one; the rejected user requests a new link. A magic-link token submitted as `type=recovery` is also accepted (Owner default 5; local integration verified), while a direct magic-link session for an already-set user stays rejected by the app. Direct Auth API password changes are limited by A2b (AUTH-007, resolved 2026-10-05): a current password for password-sign-in sessions and a nonce after 24 hours; fresh email-link and passwordless sessions remain accepted residuals (A2b defaults 2 and 5).
- Evidence: accepted A1 limits in source §8.3; A2 r4.3 G8-S and defaults 5–6. Unit tests cover the failed flag write and the failed evidence delete; the S1/S2 consume was verified locally.
- Direction: keep the limits accepted until a later plan decides; A2b already limits direct Auth API password changes (see the last bullet of Problem).
- Exit condition: a later plan removes or explicitly accepts these limits.

### AUTH-008: Email enumeration protection is app-level only

- Status: Open (accepted).
- Problem: G5 neutral results cover the app's actions and screens, not the direct Supabase Auth API. A2 keeps response timing differences (Owner default 3): an existing email may wait for mail sending, while an unknown email returns sooner. Results and the 60 s UI cooldown remain identical.
- Evidence: local unknown/pending/known/429 cases and provider failures are covered.
- Direction: timing neutralization is outside A2; this stays an accepted limit.
- Exit condition: a later plan neutralizes timing; until then the limit is accepted.

### AUTH-009: A failed sign-up can leave an orphan avatar file

- Status: Open (pre-existing).
- Problem: a sign-up that never completes leaves its avatar file in the `avatars` bucket.
- Evidence: `signUpUser` uploads the avatar before the user is created.
- Direction: none decided; this is pre-existing behaviour outside the four PRs.
- Exit condition: a later change removes the orphan files or uploads the avatar only after the user exists.

### AUTH-010: `issue-deep-links` smoke E2E is flaky

- Status: Open (found during A1 CP4, not caused by A1).
- Problem: after the Topic Builder settings tab click the URL still keeps `from=dashboard`, so the `issue-deep-links` smoke spec is flaky.
- Evidence: 2026-10-03: on the pre-A1 commit `9bfd0c6` it failed 1 of 3 runs; on A1 it passed 1 of 5 runs. A1 does not touch the Topic Builder tabs.
- Direction: a separate fix of the tab URL update in `TopicBuilderTabs.tsx` or of the spec's wait; track together with E2E-001.
- Exit condition: the `issue-deep-links` smoke spec passes reliably.

### AUTH-012: Auth screens have no accepted design yet

- Status: Deferred 2026-10-03 by the Owner to a separate login/register UI/UX redesign PR.
- Problem: A1's new check-email and set-password cards use a neutral white header, while `/login` and `/register` keep the older Blue 400 header. The login form is also small and visually dated. There is no accepted screen-type design for public/auth screens (the "Client/Marketing" type named in `docs/ui-design-system-and-review/plan.md`), so neither header can claim to be the target.
- A1 kept only cheap, behavior-level fixes: login floating labels now pass clicks to their inputs (`pointer-events-none`, matching `/register`).
- Direction: design Client/Marketing (homepage, login, register, check-email, set-password) first, then align all auth cards in one redesign PR.
- Evidence: A2 implementation review on `39581b0` (thread `01a10757-9a52-7440-ab95-3f9554bdcb5f`, 2026-10-04) found a Required contrast defect: the forgot-password email input inherits `Input`'s `--input` / `--ring` colors; on white, its border is 1.26:1 and focus border 2.59:1, with the translucent focus ring lighter still. The same defaults also affect A1's set-password input; login/register use that primitive with their own overrides.
- Owner decision 2026-10-04 (option 1): defer the shared auth contrast defect to this redesign PR; keep A2 consistent with set-password and change neither the auth pages nor shared primitive in this correction. This deferral does not mean the current UI meets WCAG 1.4.11.
- Required redesign acceptance: enabled input boundaries and focus indicators reach at least 3:1 against adjacent colors across all auth screens, verified in their rendered states with keyboard focus; align their styling together.
- Owner production QA of A2 (2026-10-04): move the "Quên mật khẩu?" link on `/login` to the right edge (under the password field) in this redesign.
- Exit condition: the auth redesign PR merges and meets the Required redesign acceptance above.

### AUTH-015: Legacy `d7_password_set` read and write after A1b

- Status: Open 2026-10-04 (split from AUTH-014 after A1b rollout R1–R5).
- Problem: `public.user_password_setups` is now the G8 marker, but the app still reads `app_metadata.d7_password_set` and writes it as a fallback. Residual gaps without a row: both marker writes failing after the password changes (AUTH-006, replay without any race); only the table write failing, with the fallback flag later erased by a concurrent GoTrue write (AUTH-014).
- Evidence: the hosted backfill re-run inserted 0 rows and coverage is 0, so no flagged user lacks a row today.
- Direction: a later cleanup removes the `app_metadata` read and write once no deployed code depends on them (A1b G7: never deploy eligibility code that skips the table read).
- A4 must keep the app-owned setup/recovery tables: GoTrue OAuth/provider metadata writes can replace an unlocked `app_metadata` snapshot (AUTH-014). Do not move either guard back into provider metadata.
- Exit condition: the app no longer reads or writes `app_metadata.d7_password_set` and no deployed code depends on it.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git (`git show 3094600:docs/refactors/auth-onboarding/problems.md`).

- AUTH-011 — Resolved 2026-10-03: the Owner approved `allowedDevOrigins: ["127.0.0.1"]` in `next.config.ts`, so auth QA runs on `next dev` at the `site_url` host (`5782117`); if a hydration mismatch like vercel/next.js#98604 appears later, re-run the recorded A/B check in a clean profile before reverting.
- AUTH-013 — Resolved 2026-10-04: after A2 rolled out the Vietnamese recovery template linking to the site domain, a production recovery mail reached the Inbox of a Gmail account that had never marked VocaSpace as safe, with no warning; the Owner chose to accept a recovery mail as the exit (originally a Confirm signup mail, which cannot be sent while sign-ups are off), so A1 rollout step 6 is unblocked; full entry: `git show 5697d01:docs/refactors/auth-onboarding/problems.md`.
- AUTH-014 — Resolved 2026-10-04: A1b moved the G8 marker to `public.user_password_setups` (PR 121, `5c43476`); hosted rollout R1–R5 passed (migration, privileges, deploy READY, smoke incl. the Owner's signed-in check, backfill re-run 0 rows); the legacy read/write and residual gaps moved to AUTH-015; full entry: `git show 5c43476:docs/refactors/auth-onboarding/problems.md`.
