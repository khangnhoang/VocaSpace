# Problems, risks and follow-ups — Auth onboarding program

Plan: [plan.md](./plan.md). Progress: [progress.md](./progress.md). Follow-ups raised while implementing each PR (source r8 §8.3) are recorded here when that PR completes.

## Open

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

### AUTH-022: The Before User Created hook did not run for `admin.createUser` on local GoTrue

- Status: Open 2026-10-07 (found while implementing A5 CP4; plan §2 inferred the opposite).
- Hosted check 2026-10-07 (A5 R3): an admin create on production with the marker succeeded and the account set its password and signed in; whether hosted GoTrue runs the hook for admin creates is still not observed, so the marker stays.
- Problem: on local GoTrue v2.189 an `auth.admin.createUser` call without the `d7_server_created` marker, and even with the known password `123456`, succeeded, while an anon `signUp` was refused by the hook with 403 "Signups must go through VocaSpace". So locally the hook does not gate admin-created users, and A5's AC5 clause "the hook accepts the marker" is trivially true there. `createUserByAdmin` still sends the marker for hosted parity (G4).
- Evidence: reproduced locally during A5 CP4; `__tests__/integration/a5-admin-create-user.test.ts` covers the create path. Hosted behavior was not read or tested (no hosted access granted).
- Direction: at the A5 rollout, create one admin user on production and check that it succeeds; if hosted GoTrue does run the hook, the marker is required, otherwise it is harmless. Do not remove the marker without that check.
- Exit condition: hosted admin creation confirmed to succeed with the marker (done 2026-10-07), and the plan's hook inference corrected in the next program revision.

### AUTH-023: Small A5 gaps left by design

- Status: Open 2026-10-07 (found in A5 CP4 and CP5, and in Codex implementation review r1; not fixed, to keep A5 inside its scope).
- Problem: (1) `deleteUserByAdmin` repeats the RPC's staff-history table list as an early check (the RPC is authoritative, so a new history table must be added in both places); (2) `course_collaborators.added_by` has no foreign key, so a direct service-role or SQL insert with `added_by = <learner>` that commits after the RPC's history check survives the delete and leaves a dangling uuid. The Owner accepted this as a residual on 2026-10-07, with no schema change. Why: every app write path of `added_by` involves a row the locked check already sees, or a foreign-key lock the RPC's `FOR UPDATE` on the profile already serialises. `create_course_with_owner` (`20260612100000`, redefined in `20260915090000`) inserts `added_by = user_id = auth.uid()`; that row's `user_id` is the learner, so the check sees an existing row, and a new insert takes a key-share lock on the learner's profile through `collab_user_id_fkey`. `accept_course_collaborator_invitation` (`20260915140000`) sets `added_by` to the invitation's `invited_by_user_id`; that invitation row already exists, and the check refuses on it. An invitation created after the check takes a key-share lock on the profile through `invited_by_user_id`'s foreign key, and creating one requires the inviter to hold an owner or co-owner `course_collaborators` row, which the check also sees. No app code inserts into `course_collaborators` directly (only these two RPCs). On the local stack `authenticated` has no `INSERT` on the table and RLS has only a `SELECT` policy. Only a direct service-role or SQL write can hit the race.
- Evidence: `app/actions/user.ts` (`STAFF_HISTORY_COLUMNS`), `supabase/migrations/20261007130000_a5_learner_deletion.sql`, the migrations named above, `pg_constraint` and `pg_policy` on the local stack.
- Direction: derive the early list from one source, or drop it, when a new history table is added; revisit the `added_by` residual only if a direct write path to `course_collaborators` is introduced. The earlier gaps (the create form after a partial failure, and lock-order test strength) are fixed in A5 correction round 1 (`52a9672`, `31074d1`).
- Exit condition: item (1) is fixed or the Owner accepts it; item (2) is accepted by the Owner (done 2026-10-07).

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git (`git show 3094600:docs/refactors/auth-onboarding/problems.md`).

- AUTH-002 — Resolved 2026-10-06: A4 merged (PR 129, `cbd87e9`); production Google sign-in passed for a new student account and an existing password account with the same UID, with the Owner confirming the old password still signs in; Google-only recovery and new-password sign-in also passed. Detailed production evidence stays outside Git.
- AUTH-011 — Resolved 2026-10-03: the Owner approved `allowedDevOrigins: ["127.0.0.1"]` in `next.config.ts`, so auth QA runs on `next dev` at the `site_url` host (`5782117`); if a hydration mismatch like vercel/next.js#98604 appears later, re-run the recorded A/B check in a clean profile before reverting.
- AUTH-013 — Resolved 2026-10-04: after A2 rolled out the Vietnamese recovery template linking to the site domain, a production recovery mail reached the Inbox of a Gmail account that had never marked VocaSpace as safe, with no warning; the Owner chose to accept a recovery mail as the exit (originally a Confirm signup mail, which cannot be sent while sign-ups are off), so A1 rollout step 6 is unblocked; full entry: `git show 5697d01:docs/refactors/auth-onboarding/problems.md`.
- AUTH-014 — Resolved 2026-10-04: A1b moved the G8 marker to `public.user_password_setups` (PR 121, `5c43476`); hosted rollout R1–R5 passed (migration, privileges, deploy READY, smoke incl. the Owner's signed-in check, backfill re-run 0 rows); the legacy read/write and residual gaps moved to AUTH-015; full entry: `git show 5c43476:docs/refactors/auth-onboarding/problems.md`.
- AUTH-019 — Resolved 2026-10-06: unit A4a (PR 130, `94d91df`) narrowed `profiles` `SELECT` for `anon` and `authenticated` to eight public columns and moved private-field reads to service-role reads after the existing checks; migration `20261005100000` pushed after the deploy was READY and the R3 production checks passed; full entry: `git show 501d3de:docs/programs/auth-onboarding/problems.md`.
- AUTH-004 — Resolved 2026-10-07: admin-created accounts get no password and a set-password mail (`d7_server_created` marker); on production an admin-created QA account received the mail, set a password and signed in, so A4 G7 is retired. Unit A5 (PR 136, `cea012b`); migrations `20261007100000`–`20261007130000` pushed after the deploy was READY and the R0/R3 production checks passed; full entry: `git show cea012b:docs/programs/auth-onboarding/problems.md`.
- AUTH-015 — Resolved 2026-10-07: the app no longer reads or writes `app_metadata.d7_password_set`; R0 found 0 flagged users without a setup row before the deploy. Unit A5 (PR 136, `cea012b`); migrations `20261007100000`–`20261007130000` pushed after the deploy was READY and the R0/R3 production checks passed; full entry: `git show cea012b:docs/programs/auth-onboarding/problems.md`.
- AUTH-016 — Resolved 2026-10-07: register and profile use `male`/`female`/`other` with a `CHECK`; production now holds only those values and null. Unit A5 (PR 136, `cea012b`); migrations `20261007100000`–`20261007130000` pushed after the deploy was READY and the R0/R3 production checks passed; full entry: `git show cea012b:docs/programs/auth-onboarding/problems.md`.
- AUTH-017 — Resolved 2026-10-07: a signed-out `/profile` visit redirects to a bare `/login`, checked on production. Unit A5 (PR 136, `cea012b`); migrations `20261007100000`–`20261007130000` pushed after the deploy was READY and the R0/R3 production checks passed; full entry: `git show cea012b:docs/programs/auth-onboarding/problems.md`.
- AUTH-018 — Resolved 2026-10-07: admins delete learners through the `service_role`-only RPC `admin_delete_learner` (payments kept with a null `user_id`, owned avatars removed); a production QA account was deleted with no orphan auth, profile, identity, session or setup rows, and its sign-in is refused. Unit A5 (PR 136, `cea012b`); migrations `20261007100000`–`20261007130000` pushed after the deploy was READY and the R0/R3 production checks passed; full entry: `git show cea012b:docs/programs/auth-onboarding/problems.md`.
- AUTH-020 — Resolved 2026-10-07: `authenticated` lost `UPDATE` on `profiles.email`, `phone` and `removed_at` (six columns kept) and a trigger syncs `profiles.email` from `auth.users`; checked by `has_column_privilege` on production. Unit A5 (PR 136, `cea012b`); migrations `20261007100000`–`20261007130000` pushed after the deploy was READY and the R0/R3 production checks passed; full entry: `git show cea012b:docs/programs/auth-onboarding/problems.md`.
- AUTH-021 — Resolved 2026-10-07: active admins read all `enrollments` and `user_flashcards`; the production dashboard shows other learners' enrollments (flashcard counts unverified beyond 0, as production has no flashcards). Unit A5 (PR 136, `cea012b`); migrations `20261007100000`–`20261007130000` pushed after the deploy was READY and the R0/R3 production checks passed; full entry: `git show cea012b:docs/programs/auth-onboarding/problems.md`.
