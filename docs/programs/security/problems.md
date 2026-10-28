# Problems, risks and follow-ups — Security

Charter: [README.md](./README.md). Progress: [progress.md](./progress.md). Transferred evidence below remains historical at its stated date; no probes were rerun.

## Open

<a id="auth-006"></a>

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
- Origin: auth-onboarding:AUTH-006; [original delivery contract](../auth-onboarding/plan.md).

<a id="auth-008"></a>

### AUTH-008: Email enumeration protection is app-level only

- Status: Open (accepted).
- Problem: G5 neutral results cover the app's actions and screens, not the direct Supabase Auth API. A2 keeps response timing differences (Owner default 3): an existing email may wait for mail sending, while an unknown email returns sooner. Results and the 60 s UI cooldown remain identical.
- Evidence: local unknown/pending/known/429 cases and provider failures are covered.
- Direction: timing neutralization is outside A2; this stays an accepted limit, and future handling is undecided.
- Exit condition: undefined until an approved plan defines how this limit is handled.
- Origin: auth-onboarding:AUTH-008; [original delivery contract](../auth-onboarding/plan.md).

<a id="auth-009"></a>

### AUTH-009: A failed sign-up can leave an orphan avatar file

- Status: Open (pre-existing).
- Problem: a sign-up that never completes leaves its avatar file in the `avatars` bucket.
- Evidence: `signUpUser` uploads the avatar before the user is created.
- Direction: none decided; this is pre-existing behaviour outside the four PRs.
- Exit condition: undefined until an approved plan defines how orphan files are handled.
- Origin: auth-onboarding:AUTH-009; [original delivery contract](../auth-onboarding/plan.md).

<a id="auth-022"></a>

### AUTH-022: The Before User Created hook did not run for `admin.createUser` on local GoTrue

- Status: Open 2026-10-07 (found while implementing A5 CP4; plan §2 inferred the opposite).
- Hosted check 2026-10-07 (A5 R3): an admin create on production with the marker succeeded and the account set its password and signed in; whether hosted GoTrue runs the hook for admin creates is still not observed, so the marker stays.
- Problem: on local GoTrue v2.189 an `auth.admin.createUser` call without the `d7_server_created` marker, and even with the known password `123456`, succeeded, while an anon `signUp` was refused by the hook with 403 "Signups must go through VocaSpace". So locally the hook does not gate admin-created users, and A5's AC5 clause "the hook accepts the marker" is trivially true there. `createUserByAdmin` still sends the marker for hosted parity (G4).
- Evidence: reproduced locally during A5 CP4; `__tests__/integration/a5-admin-create-user.test.ts` covers the create path. Hosted behavior was not read or tested (no hosted access granted).
- Direction: at the A5 rollout, create one admin user on production and check that it succeeds; if hosted GoTrue does run the hook, the marker is required, otherwise it is harmless. Do not remove the marker without that check.
- Exit condition: hosted admin creation confirmed to succeed with the marker (done 2026-10-07), and the plan's hook inference corrected in the next program revision.
- Origin: auth-onboarding:AUTH-022; [original delivery contract](../auth-onboarding/plan.md).

<a id="auth-023"></a>

### AUTH-023: Small A5 gaps left by design

- Status: Open 2026-10-07 (found in A5 CP4 and CP5, and in Codex implementation review r1; not fixed, to keep A5 inside its scope).
- Problem: (1) `deleteUserByAdmin` repeats the RPC's staff-history table list as an early check (the RPC is authoritative, so a new history table must be added in both places); (2) `course_collaborators.added_by` has no foreign key, so a direct service-role or SQL insert with `added_by = <learner>` that commits after the RPC's history check survives the delete and leaves a dangling uuid. The Owner accepted this as a residual on 2026-10-07, with no schema change. Why: every app write path of `added_by` involves a row the locked check already sees, or a foreign-key lock the RPC's `FOR UPDATE` on the profile already serialises. `create_course_with_owner` (`20260612100000`, redefined in `20260915090000`) inserts `added_by = user_id = auth.uid()`; that row's `user_id` is the learner, so the check sees an existing row, and a new insert takes a key-share lock on the learner's profile through `collab_user_id_fkey`. `accept_course_collaborator_invitation` (`20260915140000`) sets `added_by` to the invitation's `invited_by_user_id`; that invitation row already exists, and the check refuses on it. An invitation created after the check takes a key-share lock on the profile through `invited_by_user_id`'s foreign key, and creating one requires the inviter to hold an owner or co-owner `course_collaborators` row, which the check also sees. No app code inserts into `course_collaborators` directly (only these two RPCs). On the local stack `authenticated` has no `INSERT` on the table and RLS has only a `SELECT` policy. Only a direct service-role or SQL write can hit the race.
- Evidence: `app/actions/user.ts` (`STAFF_HISTORY_COLUMNS`), `supabase/migrations/20261007130000_a5_learner_deletion.sql`, the migrations named above, `pg_constraint` and `pg_policy` on the local stack.
- Direction: derive the early list from one source, or drop it, when a new history table is added; revisit the `added_by` residual only if a direct write path to `course_collaborators` is introduced. The earlier gaps (the create form after a partial failure, and lock-order test strength) are fixed in A5 correction round 1 (`52a9672`, `31074d1`).
- Exit condition: item (1) is fixed or the Owner accepts it; item (2) is accepted by the Owner (done 2026-10-07).
- Origin: auth-onboarding:AUTH-023; [original delivery contract](../auth-onboarding/plan.md).

## Resolved

One line each.
