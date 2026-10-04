# A1b detail plan — Password-set marker in an app-owned table

Revision: r3, 2026-10-04 (Codex r1 and r2 findings fixed). Owner approval: 2026-10-04, including the §1.4 defaults (Codex plan review r3 `PASS`). Master plan: [../../plan.md](../../plan.md).

## 1. Binding Spec

### 1.1 Outcome and acceptance

Outcome: the fact "this user has set a password through the app" (A1's G8 replay guard) is recorded in `public.user_password_setups`. Only the server's service role can read or write that table, and no GoTrue or Admin API call ever rewrites it. Once a user's row exists, no concurrent GoTrue write can reopen that user's original verification session. The guarantee covers persisted rows only; the bounded markerless cases are listed in §1.4 and AUTH-014. The A1 user-facing flow is unchanged.

| ID | Observable result |
| --- | --- |
| AC1 | A user whose session has `amr` `otp` and who has no marker (no table row, legacy `app_metadata.d7_password_set` not `true`) is eligible and sets a password. Afterwards a `user_password_setups` row exists and `app_metadata.d7_password_set` is `true` |
| AC2 | After AC1, the same session (not refreshed) is rejected by the `/auth/set-password` page guard and by `setPasswordAfterConfirmation` with no `updateUser` call. This still holds after an Admin write has erased `app_metadata.d7_password_set`, which is the end state of the GoTrue lost update |
| AC3 | A user with legacy `app_metadata.d7_password_set === true` and no table row is rejected. Such users can come from the window between `db push` and deploy, or from a rolled-back deploy |
| AC4 | If the table read fails, the user is not eligible (fail closed), and there is no `updateUser` call |
| AC5 | If the table write fails after `updateUser` succeeds, the error code is logged, `app_metadata.d7_password_set` is still written as a fallback, and the action redirects to `/` (the A1 flag-failure behavior, AUTH-006). If the legacy write fails, or is later erased, while the row exists, the user is still rejected |
| AC6 | Through the Data API, `anon` and `authenticated` (including the row's own user) get `42501` on select, insert, update and delete of `user_password_setups`. The service role can select and insert, and gets `42501` on update and delete. The table has RLS enabled and no policies |
| AC7 | Deleting an auth user deletes that user's row |
| AC8 | The migration creates a row for every existing user whose `raw_app_meta_data->'d7_password_set'` is `true`. Running the backfill statement again changes nothing |
| AC9 | Signed-out users and `password` or `oauth` sessions are rejected exactly as in A1 |

### 1.2 Scope and non-goals

- In scope:
  - one migration with the table, RLS, grants and backfill;
  - the eligibility read in `lib/auth/password-setup.ts`;
  - the marker write in `setPasswordAfterConfirmation`;
  - unit and integration tests;
  - the `problems.md` entry AUTH-014.
- Non-goals:
  - recovery evidence or anything else A2 needs (A2 picks its own storage);
  - removing the legacy `app_metadata` read and write (follow-up under AUTH-014);
  - AUTH-007, a direct `PUT /auth/v1/user` password change;
  - the Before User Created hook and `d7_server_created`, which are read only inside the create event and have no lost-update exposure;
  - any other `app_metadata` key, a generated-types setup, or UI changes.

### 1.3 Execution guardrails

| Guardrail | Failure if omitted |
| --- | --- |
| G1. RLS is on with no policies. The migration revokes all table privileges from `anon`, `authenticated`, `service_role` and `public`, then grants only `select, insert` to `service_role`. The app reads and writes the table only through `createServiceRoleClient()` on the server | New `public` tables get full default privileges, including `UPDATE`/`DELETE`, for `anon`, `authenticated` and `service_role` (§2), and `grant` never subtracts them. A missing revoke or RLS step, or a later permissive policy, would let a signed-in user delete their own row (reopening replay) or insert rows for other user ids (blocking victims from setting a password). A service-role `UPDATE`/`DELETE` privilege would leave G5 enforced only by convention |
| G2. A user counts as already set if a table row exists **or** legacy `app_metadata.d7_password_set === true` | A user who set a password under the old code (between `db push` and deploy, or after a rollback) becomes eligible again |
| G3. On success, write the table first, then `app_metadata.d7_password_set: true` as a fallback marker | If the table write fails, the user would have no marker at all, instead of the A1-level protection AUTH-006 already accepts |
| G4. A failed table read returns not eligible | A database error would turn into a password-setting path |
| G5. The marker is insert-only. No code path updates, clears or deletes a row; only the auth-user cascade removes it | An update or delete path would reopen the replay that A1b closes |
| G6. Rollout order: code approved, migration pushed, hosted checks passed, then merge and deploy, then the backfill statement re-run once (§5) | Deployed code would read a missing table and lock pending A1 users out. Without the re-run, a user who set a password under the old code between `db push` and deploy would keep only the erasable legacy flag |
| G7. No deployed code may drop the table eligibility check. A faulty A1b is fixed forward; an emergency revert keeps the table read in `getPasswordSetupEligibility` | Reverting to the A1 eligibility code ignores rows, so any user whose legacy flag failed or was erased would be eligible again. The fallback write does not keep `app_metadata` reliably current (that is the AUTH-014 race) |

The program invariants (master plan §4), including G8 and the hard rules after T_on, are unchanged.

### 1.4 Owner decisions that bind this unit

- Decision 10 (master plan, 2026-10-04): move the G8 marker out of GoTrue-owned `app_metadata` into an app-owned table, as unit A1b, merged and rolled out before A2.
- Defaults the Owner confirms with this plan:
  1. The legacy read (G2) and the fallback write (G3) stay until a later cleanup tracked in AUTH-014.
  2. Accepted residual gaps without a row. None adds power beyond AUTH-007:
     - both marker writes fail after the password changes: no marker at all, so the same session can replay sequentially (the AUTH-006 exception);
     - only the table write fails: the fallback flag protects until a concurrent GoTrue write erases it;
     - an old-code password set in the `db push`→deploy window whose legacy flag a concurrent GoTrue write erases before the post-deploy backfill re-run.

     Sign-ups are OFF, but users with no flag and an `otp` session (for example from a magic link, AUTH-006) can exist, so the window is bounded, not proven empty.
  3. The shape is `public.user_password_setups(user_id uuid primary key references auth.users on delete cascade, password_set_at timestamptz not null default now())`: a row means "set". A2 decides its own recovery storage.

## 2. Repository facts

Baseline: `425ad40`, checked 2026-10-04.

- `lib/auth/password-setup.ts:27` reads `app_metadata.d7_password_set` from `getUser()`. Its only callers are `app/actions/auth.ts:172` and `app/auth/set-password/page.tsx:7` — justifies the scope.
- `app/actions/auth.ts:183–187` writes the flag through `auth.admin.updateUserById` and only logs a failure — justifies AC5 and G3.
- In GoTrue v2.189.0, the Admin user update and the verify endpoint both load the user without a row lock, merge metadata in memory and rewrite the whole `raw_app_meta_data` column (`internal/api/verify.go:233–265`, `internal/models/user.go:225–252, 563–565`) — the root cause (AUTH-014).
- Local spikes on 2026-10-04 (scripts kept outside the repo):
  - concurrent Admin writes lost the flag in 493 of 1000 trials;
  - GoTrue `verifyOtp` racing the flag write lost it in 126 of 820 swept-offset trials.
- Local spike on 2026-10-04 with a prototype table (nullable, mutable columns, upsert writes, default service-role grants) through PostgREST with the service role:
  - concurrent table writes (4 evidence + 4 password-set writes per trial) lost the flag in 0 of 500 trials;
  - with GoTrue `verifyOtp` and an Admin `app_metadata` write racing the table write, it was lost in 0 of 820 trials;
  - in a deterministic two-session test, a second writer waited for the row lock and kept the first writer's change;
  - the cascade removed rows.

  The prototype is more permissive than this plan's insert-only table. It shows that GoTrue writes never touch the table and that row writes do not lose each other; it does not test the final grants (CP1/CP2 do). These justify the Outcome and G5.
- On local Postgres 17.6, a new `public` table with RLS on still granted `SELECT` and `UPDATE` to `anon`, `authenticated` and `service_role` until an explicit `revoke` (checked 2026-10-04); Supabase documents these default privileges — justifies G1 and AC6.
- `createServiceRoleClient()` (`lib/supabase/service-role.ts`) is untyped, and the repository has no generated Supabase types — no type step is needed.
- Production per `progress.md` Hosted state: sign-ups are OFF, and the last pushed migration is `20261003100000` — so the G2 window holds few or no users.
- `__tests__/integration/auth-email-signup-flow.test.ts:373` asserts the legacy flag after a password set. G3 keeps that assertion true.

## 3. Bounded implementation hypotheses

- A new migration `supabase/migrations/<timestamp>_a1b_user_password_setups.sql` holds:
  - the table, `enable row level security`, `revoke all ... from anon, authenticated, service_role, public`, and `grant select, insert ... to service_role`;
  - the backfill `insert ... select id from auth.users where raw_app_meta_data->'d7_password_set' = 'true'::jsonb on conflict do nothing`.

  It may change if AC6–AC8 and G1 still hold.
- `getPasswordSetupEligibility` keeps `getUser()` and the `amr` check first, then reads the row by `user_id` through the service role. It may change if G2 and G4 hold.
- The action inserts the row and treats a unique-violation (`23505`) as success, then writes `app_metadata`. An upsert that ignores duplicates is equivalent if it needs no `UPDATE` grant. It may change if G3 and G5 hold.

## 4. Checkpoints

| CP | Outcome | Verification |
| --- | --- | --- |
| CP1 | Migration applied locally | `npx supabase db reset` succeeds. A privileges query over `select, insert, update, delete, truncate, references, trigger` shows `anon`/`authenticated` with none and `service_role` with only `select, insert`; `relrowsecurity` is true and `pg_policies` has no row for the table. Backfill check: `npx supabase db reset --version 20261003100000`, create one user with `app_metadata.d7_password_set: true` and one without, run `npx supabase migration up`, then exactly the flagged user has a row; run the backfill statement again and the row count is unchanged. `npx supabase db diff --schema public` shows no drift |
| CP2 | Eligibility read, dual write and tests | **Unit** (`__tests__/actions/auth.test.ts`, page guard): a table row → rejected with no `updateUser`; legacy flag only → rejected; table read error → rejected; success → table insert before the `app_metadata` write; insert error → logged, `app_metadata` still written, redirect `/`; legacy write error → logged, redirect `/`, and a later call with the row present → rejected; `23505` → treated as set. **Integration** (new file, local stack): Data API `42501` for `anon` and a signed-in user on select, insert, update and delete; service role allowed on select and insert and `42501` on update and delete (AC6); deleting the user removes the row (AC7); AC2 end to end — sign up, verify, set a password, erase `d7_password_set` with an Admin write, then the original session is still rejected. The existing `auth-email-signup-flow` test also asserts the row |
| CP3 | Full checks and local browser QA | `npm run test:run`; `ALLOW_DB_INTEGRATION_TESTS=true npm run test:integration`; `npx tsc --noEmit`; `npm run lint`; `npm run build`. Local browser, one pass: sign up, open the mail link, set a password, then open `/auth/set-password` again in the same browser session → redirected to `/`; sign in with the new password |

## 5. Risks, rollout and rollback

| Risk | Mitigation |
| --- | --- |
| Hosted default grants differ from local | Rollout R2 checks privileges on hosted before deploy; stop if `anon` or `authenticated` has any privilege |
| Code deployed before the table exists | G6 and runbook order; G4 fails closed, so nobody gains access |
| Users who set a password under the old code are missed | G2 legacy read and the R5 backfill re-run; a flag erased before R5 is an accepted residual gap (§1.4) |
| Production cannot exercise the table read through a real `otp` session while sign-ups are OFF | R2 checks service-role access on hosted and R4 checks runtime logs; the full production pass happens in A2 recovery QA and A1 step 6 |

- Rollout runbook (Owner or hosted steps, in order, each with explicit Owner permission):
  1. **R1:** The Owner approves the PR code, then `db push` of the A1b migration. Nothing merges before R2 passes.
  2. **R2:** Verify on hosted with read-only queries:
     - `list_migrations` shows the new version;
     - the CP1 privilege matrix, `relrowsecurity` true, and no policies;
     - `set role service_role` can `select count(*)` from the table;
     - coverage: the count of users with `raw_app_meta_data->'d7_password_set' = 'true'::jsonb` and no matching table row is zero (a count only, no emails). Extra rows are valid, since a row can outlive an erased legacy flag (AC5).
  3. **R3:** Merge and deploy to production READY.
  4. **R4:** Production smoke:
     - an existing account signed in with a password opens `/auth/set-password` and is redirected to `/` (this path rejects before the table read);
     - sign-in still works;
     - Vercel runtime logs show no `user_password_setups` error.
  5. **R5:** Re-run the migration's backfill statement once on hosted (an idempotent insert; needs Owner permission), then repeat the R2 coverage check (zero flagged users without a row). A1b rollout is complete only after R5.
- Stop when:
  - R2 or R5 shows a privilege outside the CP1 matrix, or a non-zero coverage count;
  - the deploy logs table read errors;
  - an existing A1 test needs a behavior change rather than an added assertion.
- Rollback:
  - Fix forward. An emergency code revert must keep the table eligibility read (G7); never redeploy A1's eligibility code.
  - Keep the table. Never drop it while any deployed code reads it.
  - Fix the table only with a new migration.

## 6. Progress

Current State and milestones: [../../progress.md](../../progress.md).
