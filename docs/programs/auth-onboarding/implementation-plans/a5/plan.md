# A5 detail plan — Post-A4 auth fixes batch

Revision: r5, 2026-10-07 (Codex plan review r3 FAIL fixed: the deletion RPC locks `auth.users` before `profiles`, the same order as the email trigger and the FK cascade, with a real overlapping-transaction test; §2 and AC6 schema corrections). r4, 2026-10-07 (Codex plan review r2 FAIL fixed: avatar ownership from `storage.objects.owner_id` only, read through a service-role RPC; the deletion checks and the auth-user delete run in one locked database transaction; payment `updated_at` may change). r3, 2026-10-07 (Codex plan review r1 FAIL fixed: owned-avatar cleanup after a successful delete, a payments `CHECK` for active payments, explicit staff and review-history pre-checks, an active-admin condition on the new policies, rollback by failure). r2, 2026-10-07 (Owner moved the users' own `phone`/`removed_at` update grants into scope and placed the email template redesign in a later PR, FEAT-005). Codex plan review: r1–r3 FAIL, r4 `PASS` (2026-10-07). Owner approval: 2026-10-07, by the instruction to commit and implement on PASS; decisions 2, 4, 6 and 7 in §1.4 stand as written. Frozen. Master plan: [plan.md](../../plan.md) (Decision 14, §5 A5, §7 gates). Problems: [AUTH-004, AUTH-015, AUTH-016, AUTH-017, AUTH-018, AUTH-020, AUTH-021](../../problems.md).

Branch `fix/auth-a5-post-a4-batch` from `main` `d426ff4`. Size: large/high-risk — one PR, seven auth problems plus the admin sidebar logo (Owner, 2026-10-07), four small migrations (one with a data update and a `CHECK`, one changing foreign keys, one trigger on `auth.users`), then an Owner-granted `db push` after the app deploy.

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the auth and account defects collected after A4 are fixed in one PR. Admin-created accounts have no password anyone knows, an admin can delete a learner as the privacy policy promises, the admin dashboard counts every learner, users can update only the profile fields `/profile` edits, register and profile share one gender value set, a signed-out visitor is sent from `/profile` to `/login`, the app stops using the legacy `d7_password_set` flag, and the admin sidebar shows the VocaSpace logo.

| ID | Observable result |
| --- | --- |
| AC1 (AUTH-017) | A signed-out visit to `/profile` (and any path under it) is redirected to `/login`; a signed-in visit still renders the page; the redirect carries no `next`/`redirect_to` parameter (G1) |
| AC2 (AUTH-021) | Signed in as an active admin (`role = 'admin'` and `removed_at is null`), the dashboard's recent enrollments, enrollment counts per course, revenue and the total-flashcards stat include other learners' rows; a soft-deleted learner still shows as a missing learner (A4a AC6b); a non-admin and a soft-deleted admin still read only their own enrollments and flashcards |
| AC3 (AUTH-020) | A signed-in user's `UPDATE profiles SET email`, `SET phone` or `SET removed_at` through the REST API is refused (`42501`), while the `/profile` save, the one-time username and the avatar upload still work; admin edits of phone keep working; after sign-up `profiles.email` equals `auth.users.email`, and after an `auth.users.email` change it follows (decision 4) |
| AC4 (AUTH-016) | `/register` stores `male`/`female`/`other`; a user registered with any gender can save `/profile` without touching the gender field; existing `nam`/`nữ` rows read as `male`/`female`; `profiles.gender` rejects any other non-null value; Google and admin-created users keep `null` |
| AC5 (AUTH-004) | An admin creates a user from the user-management page: the account is created with no password, passes the "Before User Created" hook, gets the requested role, and receives the standard recovery email; following it, the user sets a password on `/auth/set-password` and signs in; nobody, the admin included, can sign in with a default password |
| AC6 (AUTH-018) | An admin deletes a learner who has an enrollment, a paid payment, progress rows, answers, flashcards and an avatar: the delete succeeds; their auth user, profile, learning rows and the `avatars` objects whose storage `owner_id` is their id are gone; an object owned by anyone else is never deleted, even when the learner's `avatar_url` names it or its name starts with the learner's id; the payment row remains with `user_id` null and every other column except `updated_at` (amounts, course, status, `created_at`, `gateway_*` fields and `gateway_metadata`) unchanged; `updated_at` is set by the existing `set_updated_at_payments` trigger (decision 2) |
| AC7 (AUTH-018) | Deleting a user is refused with a clear Vietnamese message and changes nothing (no database row and no storage object removed) when: the target is not a `student`; the target has a `creating`/`pending` payment (also enforced by the payments `CHECK`); or the target appears in any staff or review-history table listed in §2 (`course_collaborators`, `course_collaborator_invitations`, `topic_review_submissions`, `review_notes`, `topic_authorship_feedback`, `topic_contributors`, `topic_author_review_exclusions`, `platform_moderation_audits`, or the authorship columns of `courses`/`chapters`/`topics`), including a reviewer with no authorship. The role and history checks run in the same database transaction as the delete, after locking the target's profile row, so an invitation, role change or review row committed after the action's early check still makes the delete refuse; deleting oneself stays refused |
| AC8 (AUTH-015) | The app no longer reads or writes `app_metadata.d7_password_set`; G8 eligibility and the A1/A2 set-password and recovery flows behave as before for users with a `user_password_setups` row |
| AC9 (logo) | The admin sidebar header shows the VocaSpace logo from `public/brand/` instead of the `Codepen` icon and text, with `alt="VocaSpace"` (decision 7) |
| AC10 (production, after rollout) | §5 R3 checks pass; AUTH-004, -015, -016, -017, -018, -020 and -021 are resolved in `problems.md`, and A4 G7 is retired |

### 1.2 Scope and non-goals

- In scope:
  - `utils/supabase/middleware.ts`: redirect signed-out `/profile` visits like `/teacher`;
  - migration `a5_admin_learning_reads`: active-admin `SELECT` on `enrollments` and `user_flashcards`, with the inline condition `exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.removed_at is null)` (not `public.is_admin()`, which ignores `removed_at`);
  - migration `a5_profiles_email_owner`: narrow the `authenticated` column `UPDATE` grant to `username, full_name, avatar_url, dob, gender, updated_at` (drops `email`, `phone`, `removed_at`), plus a trigger syncing `profiles.email` from `auth.users.email` (decision 4);
  - migration `a5_profiles_gender_values`: update `nam`→`male`, `nữ`→`female`, then `CHECK (gender is null or gender in ('male','female','other'))`; `registerSchema` and the register select switch to `male`/`female`/`other` with the same Vietnamese labels;
  - `createUserByAdmin` (decision 5) and the admin user-management copy that mentions the default password;
  - migration `a5_learner_deletion`: `payments.user_id` nullable with `ON DELETE SET NULL`; `enrollments`, `user_topic_progress`, `user_question_answers` user FKs `ON DELETE CASCADE`; `CHECK (status not in ('creating','pending') or user_id is not null)` on `payments`; a service-role-only RPC `admin_delete_learner(target uuid)` that locks the target profile, re-checks AC7, collects the names of `avatars` objects with `owner_id = target`, deletes the `auth.users` row (cascading as above) and returns those names; `deleteUserByAdmin` calls it after its early checks and then removes the returned objects through the Storage API (decision 2); `BasePayment.user_id` in `types/database.ts` becomes `string | null` and its readers handle null;
  - `lib/auth/password-setup.ts` and `setPasswordAfterConfirmation`: remove the legacy flag read and write (decision 6);
  - `components/ui/admin-sidebar.tsx`: logo (decision 7);
  - unit, action and integration tests for each AC; `problems.md`, `progress.md` updates.
- Non-goals:
  - deleting users with teaching or review history (authored topics, chapters, reviews, moderation audits); those stay a manual, Owner-handled case;
  - removing the stale `d7_password_set` key from existing `app_metadata` (harmless once unread);
  - AUTH-005, -006, -008, -009, -010, -012; the login/register redesign; the client header logo;
  - a new or redesigned email template, or an invite flow (`type=invite` is not handled by `/auth/confirm`); the template redesign is FEAT-005 (Owner, 2026-10-07);
  - self-service account deletion.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. Rollout order: merge, production deploy READY, then `db push` of the A5 migrations; never push first | The old register action still sends `nam`/`nữ`; after the gender `CHECK`, every app sign-up would fail in `handle_new_user` |
| G2. Before deploy, a hosted read confirms 0 users have `app_metadata.d7_password_set = true` without a `user_password_setups` row (R0) | Such a user would become eligible to set a password again from any email-link session, reopening G8 replay |
| G3. Every service-role read or write added here runs after the existing `requireAdmin()` and touches only the target user id; the deletion RPC is executable by `service_role` only | A service-role path without the admin check would let any signed-in user delete or create accounts |
| G4. The admin-created user carries `app_metadata.d7_server_created = true` and no `password` | Without the marker the hook refuses the create; with a password, AUTH-004 stays open |
| G5. FK changes cover only the learner tables and `payments`; no authorship or audit FK gets `ON DELETE` | Deleting a teacher would silently erase or orphan course history the Owner never decided to drop |
| G6. The `auth.users` trigger function is `security definer`, `set search_path = ''`, only updates `public.profiles.email` for `new.id`, and runs only when `email` changes; any new code that locks both rows takes `auth.users` first, then `profiles` | A wider or failing trigger would break GoTrue updates (sign-in, recovery, Google linking) for every user |
| G7. No change to the "Before User Created" hook, `handle_new_user`, the G8 tables or `/auth/confirm` | Re-opens A1/A1b/A2 hard rules (§4 of the master plan) |
| G8. Hosted `db push`, production reads and the production create/delete test need explicit Owner grants; recorded evidence is counts and booleans only | Program authority; personal data in the repo |

### 1.4 Owner decisions that bind this unit

1. **(2026-10-07, Owner)** One combined PR for AUTH-004, -015, -016, -017, -018, -020, -021 and the admin sidebar logo, as unit A5 of this program (master Decision 14).
2. **(2026-10-07, Owner-adopted default) AUTH-018 retention:** deleting a learner removes their account, profile, enrollments, progress, answers, flashcards and avatar files; payment rows stay as anonymous order records (`user_id` null), matching the `/privacy` sentence on order data. A user with a `creating`/`pending` payment or with teaching/review history is refused and handled by hand. Alternative: delete payment rows too.
3. **(2026-10-05, Owner)** AUTH-016: one canonical set `male`/`female`/`other` (Vietnamese only in labels), a data migration `nam`→`male`, `nữ`→`female`, a `CHECK` on `profiles.gender`, tests for both register and profile.
4. **(2026-10-07, Owner-adopted default) AUTH-020:** besides the grant change, an `AFTER UPDATE OF email ON auth.users` trigger keeps `profiles.email` in sync (the app has no email-change UI, but the direct Auth API allows it). Alternative: no trigger, accept drift after a direct-API email change.
5. **(2026-10-07, Owner) AUTH-004:** create with no password and send the existing recovery email (`resetPasswordForEmail`); its "đặt lại mật khẩu" wording is accepted for this case. The admin sees "Đã tạo tài khoản và gửi email đặt mật khẩu". A send failure keeps the account and tells the admin to ask the user to use "Quên mật khẩu?". Redesigning the email templates is a separate later PR (FEAT-005).
6. **(2026-10-07, Owner-adopted default) AUTH-015:** remove the legacy read and write. If only the table write fails after the password changed, the session that just set it can set it again until it ends; this joins the AUTH-006 accepted residuals (only the mailbox owner holds that session).
7. **(2026-10-07, Owner-adopted default) Logo:** the gradient `vocaspace-logo.svg` if its rendered contrast against the sidebar background is at least 3:1, otherwise `vocaspace-logo-white.svg`.

## 2. Repository facts

Baseline: `d426ff4`, checked 2026-10-07.

- `utils/supabase/middleware.ts` redirects signed-out visitors only for `/teacher` — AC1.
- `enrollments` has one `SELECT` policy, `auth.uid() = user_id` (`20260609114505`); `user_flashcards` "Auth Select" is the same; `getAdminDashboardData` reads both on the user client after its admin check; `public.is_admin()` exists (`security definer`) and is used by other staff policies, but checks only `role = 'admin'`, not `removed_at` — AC2.
- `20260915130000` grants `UPDATE (email, phone, username, full_name, avatar_url, dob, gender, updated_at, removed_at)` on `profiles` to `authenticated`; `updateUserProfile` writes only `full_name, dob, gender, updated_at` (+ `username` once); no app path changes the auth email; `handle_new_user` copies `new.email` on insert only — AC3, decision 4. The same grant lets a user edit their own `phone` and `removed_at` (soft-delete flag), though `/profile` shows phone read-only and no app path writes either on the user client (`updateUserProfile`, `uploadAvatar`); admin phone edits use the service role (`updateUserByAdmin`) — AC3.
- `registerSchema` and `/register` use `nam`/`nữ`/`other`; `profileSchema` and the profile form use `male`/`female`/`other`; `profiles.gender` has no constraint; `handle_new_user` copies `raw_user_meta_data->>'gender'` — AC4.
- `createUserByAdmin` calls `admin.createUser` with `password: "123456"`, `email_confirm: true` and no `app_metadata`; the A1 hook (`20261003100000`) allows an email user only with `app_metadata.d7_server_created = true`, which `signUpUser` sets. So admin creation is expected to be refused by the hook since A1 (inferred; CP4 reproduces it locally) — AC5, G4.
- `deleteUserByAdmin` calls `auth.admin.deleteUser`; `profiles.id` cascades from `auth.users`; `enrollments_user_id_fkey`, `payments_user_id_fkey`, `uqa_user_id_fkey`, `utp_user_id_fkey` reference `profiles(id)` with no `ON DELETE`; `uf_user_id_fkey` and `collab_user_id_fkey` cascade; authorship/audit FKs without `ON DELETE`: `courses.reviewed_by`, `chapters.created_by_user_id`, `topics.original_creator_user_id`/`responsible_author_user_id`, `topic_contributors`, `topic_author_review_exclusions` (`20260916120000`), `platform_moderation_audits.actor_user_id`. Review and staff history is not protected by FKs: `topic_review_submissions` (submitter cascade, reviewer/canceller set null), `review_notes` (author cascade, remover set null), `topic_authorship_feedback` (all set null), `course_collaborator_invitations` (cascade / set null) and `course_collaborators` (cascade) would be silently erased or anonymised by a delete, so AC7 needs explicit pre-checks — AC6, AC7, G5.
- `payments.user_id` is `NOT NULL`; `gateway_metadata` holds the PayOS order code, checkout URL and QR, and `handle_payment_success` adds `gateway_transaction_id` on success; `uq_active_payment` is partial on `creating`/`pending`; `handle_payment_success` processes only `creating`/`pending` rows (enrolling `user_id`), returns `IDEMPOTENT_SUCCESS` for an already-`paid` row without using `user_id`, and `INVALID_STATUS` for other statuses; `types/database.ts` `BasePayment.user_id` is `string`; the `set_updated_at_payments` trigger sets `updated_at = now()` on every update, including the one `ON DELETE SET NULL` performs — decision 2, AC6, AC7.
- `course_collaborator_invitations` can be created for a learner by the invitation RPC (`20260916090000`) and its invitee FK cascades; `updateUserByAdmin` can change a target's role at any time; both can commit between an app-side check and `deleteUser`, so an app-side check alone cannot keep AC7 — AC7.
- Integration teardown in several files (12 at baseline) calls `auth.admin.deleteUser` for teachers, admins and users with payments (e.g. `payment-race.test.ts`) — H6.
- `/privacy` §5 promises deletion within 30 days and keeps order information only when needed for a payment issue — decision 2.
- Avatars: the `avatars` insert policy (`20260609114505`, line 2187) checks only the bucket, so anyone signed in can upload any name, including `<another id>-…`; a name prefix proves nothing. Storage sets `storage.objects.owner_id` to the uploader; `Storage.list()` does not return it and the `storage` schema is not exposed through the Data API, so it is read in SQL. `/profile` uploads `<user id>-<timestamp>.<ext>` on the user client (owner = the user); sign-up uploads a random name before the user exists and stores it in `profiles.avatar_url`; users can write their own `avatar_url` (kept in the AC3 grant), so `avatar_url` may name another user's object and is not proof of ownership — AC6. A sign-up avatar with a random name and no owner is therefore not deleted by A5 (residual, joins AUTH-009).
- `lib/auth/password-setup.ts` reads `app_metadata.d7_password_set`; `setPasswordAfterConfirmation` (`app/actions/auth.ts`) writes it after the table insert — AC8.
- `components/ui/admin-sidebar.tsx` header renders a `Codepen` icon and the text "VocaSpace"; `public/brand/` has both logos; the client header already uses `next/image` with the white logo — AC9.

## 3. Bounded implementation hypotheses

- H1. A path check next to `isTeacherRoutePath` (`/profile` or `/profile/…`) is enough, because the root middleware matcher already runs on every non-asset path.
- H2. Admin access in AC2 is two additive `SELECT` policies with the inline active-admin condition (§1.2); a service-role read after an active-admin check is an acceptable equivalent if a policy proves unsafe.
- H3. FK changes are `drop constraint` + `add constraint … on delete …` in one migration on small tables; the `payments` change also drops `NOT NULL`.
- H4. `deleteUserByAdmin` order: (1) `requireAdmin()` and self-check; (2) an early service-client check of role, active payment and the AC7 tables, only for a fast message; (3) the RPC: first `select … for update` on the target's `auth.users` row, then `select … for update` on its `profiles` row — the same order as the email-sync trigger (`auth.users` → `profiles`) and the FK cascade, so a concurrent email change and a delete serialise instead of deadlocking; the `profiles` lock conflicts with the FK key-share lock of a concurrent invitation insert and with a role update, so they serialise), re-check role and every AC7 table in the same transaction, select `name` from `storage.objects` where `bucket_id = 'avatars' and owner_id = target::text`, `delete from auth.users where id = target`, return the names; any refusal raises a coded error mapped to the AC7 message and nothing changes; the payments `CHECK` covers a payment created concurrently; (4) only after the RPC succeeds, `storage.from('avatars').remove(names)`; a storage failure is a warning to the admin and does not undo the delete. The RPC is `security definer`, `search_path ''`, `execute` revoked from `public`/`anon`/`authenticated` and granted to `service_role` only. Deleting `auth.users` in SQL replaces `auth.admin.deleteUser` here; CP5 confirms on the local stack that it cascades to identities, sessions and the G8 tables, and R3 confirms it on production — if the hosted `postgres` role cannot delete from `auth.users`, stop and ask the Owner.
- H5. `handle_payment_success` enrols only for `creating`/`pending` rows, which the `CHECK` keeps non-null; an already-`paid` anonymous row returns `IDEMPOTENT_SUCCESS` without using `user_id`; CP5 confirms no other reader (admin payments list, dashboard, types) assumes non-null.
- H6. Integration helpers that seed users may rely on the default password path; if they call `createUserByAdmin`, they switch to their own service-role setup. Teardown that deletes a user who still has a `creating`/`pending` payment must delete or settle that payment first, because the `CHECK` now refuses it; teardown of staff users keeps using `auth.admin.deleteUser`, which A5 does not restrict (AC7 is enforced only in the RPC).

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | AC1, AC8, AC9: middleware redirect, legacy flag removed, sidebar logo | Unit tests for the middleware paths (signed out `/profile` → `/login`, signed in passes, `/teacher` unchanged); `password-setup` and set-password unit tests updated (row present / absent, no flag); re-run A1/A2 integration specs |
| CP2 | AC2, AC3: admin read policies, email grant and sync trigger | Integration: active admin sees another learner's enrollment and flashcard; non-admin and an admin with `removed_at` set do not; user `UPDATE` of `email`, `phone`, `removed_at` → `42501`, while `full_name`, username-once and `avatar_url` updates still work; `auth.admin.updateUserById(email)` changes `profiles.email`; sign-up keeps them equal |
| CP3 | AC4: gender values | Unit: `registerSchema` and `profileSchema` accept the same set; integration: migration maps seeded `nam`/`nữ`, `CHECK` refuses `nam`, `null` allowed; register → profile save without touching gender |
| CP4 | AC5: admin create | Reproduce the current hook refusal first; action tests (non-admin refused before any service call, no `password` key, marker set, recovery mail requested, send failure message); local Inbucket mail → set password → sign in |
| CP5 | AC6, AC7: learner deletion | Integration on the local stack: learner with enrollment, paid payment, progress, answer, flashcard and an avatar uploaded on the learner's own session is deleted, along with its auth identities, sessions and G8 rows; the payment row equals its pre-delete snapshot in every column except `user_id` (now null) and `updated_at`; an object uploaded by another user survives both when the learner's `avatar_url` names it and when its name starts with the learner's id; refused with no row or object change: pending payment, teacher with a topic, reviewer with only a `topic_review_submissions` / `review_notes` row, collaborator; interleaving tests where, after the action's early check and before the RPC, an invitation for the learner is created or the learner's role is changed — the RPC refuses and nothing changes; the RPC is not executable by `authenticated`; lock order, with two real overlapping transactions through `__tests__/integration/helpers/local-postgres-coordination.ts` (`beginLocalPostgresTransaction`): one holds an email update on the learner's `auth.users` row open while the RPC runs, and the RPC waits (seen in `pg_locks`/`pg_blocking_pids`) and then completes after the commit, with no deadlock error, and the reverse (RPC lock held, email update waits); a direct service-role `auth.admin.deleteUser` on a learner with a `pending` payment fails on the `CHECK`; `handle_payment_success` on a paid anonymous row returns `IDEMPOTENT_SUCCESS`; action test asserts no Storage `remove` or other Storage mutation before the RPC succeeds (reads are allowed) |
| CP6 | Whole PR ready | `npx supabase db reset`, `npm run test:run`, `npm run test:integration`, `npx tsc --noEmit`, eslint on changed files, `git diff --check`, `npm run build`, `npm run docs:check`; smoke E2E = E2E-001 baseline plus AUTH-010; browser QA at `http://127.0.0.1:3000`: signed-out `/profile`, register with a gender then `/profile` save, admin dashboard counts, admin create → mail → set password, admin delete of a seeded learner, sidebar logo at 375 px and 1280 px |

QA fixture readiness: seed users `student@gmail.com`, `teacher@gmail.com`, `admin@gmail.com`; CP5 and CP6 create the learner's enrollment, payment, progress and avatar locally through the service client or the app, with no seed change.

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Production holds a gender value outside `nam`/`nữ`/`male`/`female`/`other`, so the `CHECK` fails on push | R0 reads the distinct values; stop and extend the mapping before push |
| The `auth.users` trigger fails and blocks GoTrue writes | G6; integration covers sign-up, recovery and email change; R3 sign-in check right after push |
| FK change locks learner tables during push | Tables are small (R0 counts); push off-peak |
| A payment is created between the delete pre-check and the delete | The payments `CHECK` makes `ON DELETE SET NULL` fail for a `creating`/`pending` row, so the whole delete rolls back; the admin sees the AC7 message |
| The admin deletes a learner whose sign-up avatar has a random name | The object is left in storage (residual, AUTH-009); no other user's object is touched |
| Dashboard revenue is computed from enrollments × course price, so it drops when a paying learner is deleted, while the anonymous payment row remains | Accepted for A5 (payments stay the order record); a payments-based revenue figure is a separate follow-up if the Owner wants one |
| Recovery mail rate limit (30/h) blocks bulk admin creation | Admin creation is rare; AC5 message tells the admin what to do |

Owner rollout (after review):

- R0 (before merge, hosted read grant, counts only): users with the legacy flag and no setup row = 0 (G2); distinct `profiles.gender` values with counts; row counts of `enrollments`, `payments`, `user_topic_progress`, `user_question_answers`.
- R1: merge; production deploy READY; signed-out `/profile` redirects; register a test account owned by the Owner (gender stored as `male`/`female`/`other`).
- R2: Owner grants and runs `npx supabase db push` for the A5 migrations only; `migration list` matches.
- R3: production checks: the gender distinct values are within the set; `has_column_privilege('authenticated','public.profiles',<col>,'UPDATE')` is false for `email`, `phone`, `removed_at` and true for the six kept columns; the admin dashboard shows other learners; an admin creates an Owner-controlled test email, it receives the recovery mail and sets a password, then the admin deletes it; email sign-in and Google sign-in still work. Resolve the seven problems and retire A4 G7 only when every check passes.

Stop when: R0 finds a flagged user without a row, an unmapped gender value, or a `creating`/`pending` payment with null `user_id` (impossible today; it would block the `CHECK`); any R3 sign-in check fails (then follow rollback).

Rollback, by failure:

- App bug before R2: redeploy the previous production build; the A5 migrations are not pushed yet.
- After R2: fix forward with a new app deploy and/or migration. The previous build is not redeployed, because its register action sends `nam`/`nữ`, which the gender `CHECK` refuses.
- The `auth.users` email trigger blocks GoTrue writes: a fix migration; as an emergency only, drop the trigger and accept `profiles.email` drift until the fix (recorded in `problems.md`).
- The gender `CHECK` blocks sign-ups: drop only that constraint in a fix migration; the data mapping stays.
- Never restore the removed `email`/`phone`/`removed_at` grants (that reopens AUTH-020); never touch the A1/A1b/A2 objects (G7).
- `ON DELETE SET NULL`/`CASCADE` and the payments `CHECK` can be put back to the previous form with a new migration; rows already deleted cannot come back.

## 6. Progress

Current State and milestones: [progress.md](../../progress.md).
