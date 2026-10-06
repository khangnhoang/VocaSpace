# Problems, risks and follow-ups — Auth onboarding program

Plan: [plan.md](./plan.md). Progress: [progress.md](./progress.md). Follow-ups raised while implementing each PR (source r8 §8.3) are recorded here when that PR completes.

## Open

### AUTH-004: `createUserByAdmin` creates users with a known default password

- Status: Open (follow-up, outside the 4 PRs). (`AUTH-003` is already used by the student-user-flow-route program.)
- Problem: `app/actions/user.ts` creates users with a fixed password and `email_confirm: true`.
  - Anyone who knows the default password can sign in to the account.
  - Once Google is enabled, that account is auto-linked to the email owner's Google identity.
- Evidence: `createUserByAdmin` in `app/actions/user.ts`; the G3 audit is in plan §4 and source §8.2 step 7.
- Direction: mitigation in this program is to audit these users under gate G3 before every Google enable, and, while Google is on, to create no account for another person with a known password (A4 G7). The later fix is a random password plus an email invitation to set a password.
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
- Direction: timing neutralization is outside A2; this stays an accepted limit, and future handling is undecided.
- Exit condition: undefined until an approved plan defines how this limit is handled.

### AUTH-009: A failed sign-up can leave an orphan avatar file

- Status: Open (pre-existing).
- Problem: a sign-up that never completes leaves its avatar file in the `avatars` bucket.
- Evidence: `signUpUser` uploads the avatar before the user is created.
- Direction: none decided; this is pre-existing behaviour outside the four PRs.
- Exit condition: undefined until an approved plan defines how orphan files are handled.

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

### AUTH-016: Register and profile use different gender values

- Status: Open 2026-10-05 (pre-existing; found while planning A3, outside A3 by its default 1).
- Problem: `/register` stores `gender` as `nam`/`nữ`/`other`, while `profileSchema` and the `/profile` select accept only `male`/`female`/`other`. A user who registered through the app with `nam` or `nữ` cannot save `/profile` until they pick a gender again, or at all if the stored value is resubmitted.
- Evidence: `registerSchema` and `signUpUser` (`lib/schemas/auth.ts`, `app/actions/auth.ts`) and `handle_new_user` copy the value into `profiles.gender`; `profileSchema` in `lib/schemas/profile.ts`. The exact form behavior with an unmatched select value is not yet observed in a browser.
- Direction: choose one canonical set and map or migrate the other side in a separate PR (master §9 keeps it outside this program's four PRs).
- Exit condition: a user registered through the app can save `/profile` without touching the gender field, and both forms use one value set.

### AUTH-017: A signed-out visitor can open `/profile`

- Status: Open 2026-10-05 (pre-existing; first seen at A2b R1, reported by the Owner during the A4 enable-gate check).
- Problem: `/profile` renders for a signed-out visitor; only the client fetch fails and shows the sign-in toast, instead of sending the visitor to `/login`. No profile data is exposed, because `getUserProfile` and the profile actions check the session on the server.
- Evidence: `utils/supabase/middleware.ts` redirects signed-out visitors only for `/teacher`; `app/(client)/profile/page.tsx` and its layout have no auth check; `ProfileSidebar` shows `res.error` as a toast. A2b R1 milestone in `progress.md`.
- Direction: redirect signed-out visitors from `/profile` to `/login` (middleware or a server check in the page), with a test; part of the post-A4 problems batch the Owner chose on 2026-10-05.
- Exit condition: a signed-out visit to `/profile` lands on `/login`, and a signed-in visit still renders the page.

### AUTH-018: Admin user deletion likely fails for users with learning or payment data

- Status: Open 2026-10-05 (pre-existing; found while writing the A4b privacy policy, not yet reproduced).
- Problem: the A4b privacy policy promises account deletion within 30 days on request, but `deleteUserByAdmin` (`app/actions/user.ts`) calls `auth.admin.deleteUser`, and the `profiles` row it cascades to is still referenced without `ON DELETE` by `enrollments`, `payments`, `uqa` and `utp`, so the delete should fail for any user who has enrolled, paid or studied. Until fixed, a deletion request is handled by hand in the dashboard.
- Evidence: `enrollments_user_id_fkey`, `payments_user_id_fkey`, `uqa_user_id_fkey`, `utp_user_id_fkey` in migration `20260609114505`; several D1/D2 authorship columns also reference `profiles(id)` without `ON DELETE`. Inferred from the schema; no local reproduction yet.
- Direction: at the first deletion request, write and run the manual procedure (dependent rows, retained order records, the uploaded avatar in Storage) within the 30 days; then decide what deletion keeps (for example payments anonymized vs removed) and fix the foreign keys or the action, with a local integration test; part of the post-A4 problems batch.
- Exit condition: an admin can delete a local user who has an enrollment, a payment and progress rows, and the result matches the chosen retention rule.

### AUTH-020: A user can change their own `profiles.email` through the API

- Status: Open 2026-10-05 (pre-existing; found while planning A4a; deferred to the post-A4 batch by the Owner).
- Problem: migration `20260915130000` grants `UPDATE (email, …)` on `profiles` to `authenticated`, so a signed-in user can set `profiles.email` to any value through the REST API. The admin list and course teams then see an email that is not the sign-in email (`auth.users.email`), and an invitation shown under that email can mislead.
- Evidence: `supabase/migrations/20260915130000_d1_correction_security_rescue.sql` (`grant update (email, phone, username, …) on table public.profiles to authenticated`); found by reading migrations, not reproduced.
- Direction: drop `email` from the column `UPDATE` grant and keep `profiles.email` in sync with `auth.users` from the server side; check that no app path writes it on the user client.
- Exit condition: a signed-in user's `UPDATE profiles SET email` is refused, and `profiles.email` matches `auth.users.email` after sign-up and email change.

### AUTH-021: The admin dashboard shows only the admin's own enrollments

- Status: Open 2026-10-06 (pre-existing; found while testing A4a; for the post-A4 batch).
- Problem: `enrollments` has a single `SELECT` policy, "Users can view their own enrollments" (`auth.uid() = user_id`), and `getAdminDashboardData` reads enrollments with the admin's user client. The dashboard's recent enrollments, enrollment counts per course and revenue therefore count only the admin's own enrollments.
- Evidence: (2026-10-06) `pg_policies` on the local stack lists only that policy for `enrollments`; the A4a integration test with a real admin session saw no other user's enrollment, so it uses the admin's own (`b1b4db6`).
- Direction: give admins read access to enrollments (an admin `SELECT` policy, or a service-role read after the admin check), and cover it with an integration test that sees another learner's enrollment and hides soft-deleted profiles.
- Exit condition: a real admin session sees other learners' recent enrollments and correct counts on the dashboard.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git (`git show 3094600:docs/refactors/auth-onboarding/problems.md`).

- AUTH-002 — Resolved 2026-10-06: A4 merged (PR 129, `cbd87e9`); production Google sign-in passed for a new student account and an existing password account with the same UID, with the Owner confirming the old password still signs in; Google-only recovery and new-password sign-in also passed. Detailed production evidence stays outside Git.
- AUTH-011 — Resolved 2026-10-03: the Owner approved `allowedDevOrigins: ["127.0.0.1"]` in `next.config.ts`, so auth QA runs on `next dev` at the `site_url` host (`5782117`); if a hydration mismatch like vercel/next.js#98604 appears later, re-run the recorded A/B check in a clean profile before reverting.
- AUTH-013 — Resolved 2026-10-04: after A2 rolled out the Vietnamese recovery template linking to the site domain, a production recovery mail reached the Inbox of a Gmail account that had never marked VocaSpace as safe, with no warning; the Owner chose to accept a recovery mail as the exit (originally a Confirm signup mail, which cannot be sent while sign-ups are off), so A1 rollout step 6 is unblocked; full entry: `git show 5697d01:docs/refactors/auth-onboarding/problems.md`.
- AUTH-014 — Resolved 2026-10-04: A1b moved the G8 marker to `public.user_password_setups` (PR 121, `5c43476`); hosted rollout R1–R5 passed (migration, privileges, deploy READY, smoke incl. the Owner's signed-in check, backfill re-run 0 rows); the legacy read/write and residual gaps moved to AUTH-015; full entry: `git show 5c43476:docs/refactors/auth-onboarding/problems.md`.
- AUTH-019 — Resolved 2026-10-06: unit A4a (PR 130, `94d91df`) narrowed `profiles` `SELECT` for `anon` and `authenticated` to eight public columns and moved private-field reads to service-role reads after the existing checks; migration `20261005100000` pushed after the deploy was READY and the R3 production checks passed; full entry: `git show 501d3de:docs/programs/auth-onboarding/problems.md`.
