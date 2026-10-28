# Problems, risks and follow-ups — Auth onboarding program

Plan: [plan.md](./plan.md). Progress: [progress.md](./progress.md). Follow-ups raised while implementing each PR (source r8 §8.3) are recorded here when that PR completes.

## Open

### AUTH-005: Retire the D7 combined source plan once no plan references it

- Status: Open (docs housekeeping).
- Problem: [sources/d7-combined-plan-r8.md](./sources/d7-combined-plan-r8.md) is the reviewed source the per-PR plans are cut from.
- Evidence: the master plan and the A1 plan cite its sections (spikes, guardrail rationale, attacker acceptance), and A2/A4 still need its G8 and Google content.
- Direction: keep it until the A4 detail plan is cut; then delete it or mark it historical, updating every reference in the same change.
- Exit condition: no program document links to it, or it is explicitly marked historical.

## Resolved

One line each: ID, status, one-line outcome. Details stay in Git (`git show 3094600:docs/refactors/auth-onboarding/problems.md`).

- AUTH-010 — Resolved locally 2026-10-08: D6 CP2 (`0d00270`) fixes the URL/tab race and fixture Back synchronization; the subsequent native-history correction prevents Settings save/refresh restoring old query context. Its regression failed before the fix and passed twice independently, retaining recovery/exit and Back/Forward assertions; correction evidence is in [D6 progress](../student-user-flow-route/progress.md). Remote delivery pending; full earlier entry: `git show 0d00270:docs/programs/auth-onboarding/problems.md`.
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
- AUTH-006 — Moved to [AUTH-006](../security/problems.md#auth-006). <a id="auth-006-g8-limits-after-a1a2"></a> <a id="auth-006"></a>
- AUTH-008 — Moved to [AUTH-008](../security/problems.md#auth-008). <a id="auth-008-email-enumeration-protection-is-app-level-only"></a> <a id="auth-008"></a>
- AUTH-009 — Moved to [AUTH-009](../security/problems.md#auth-009). <a id="auth-009-a-failed-sign-up-can-leave-an-orphan-avatar-file"></a> <a id="auth-009"></a>
- AUTH-022 — Moved to [AUTH-022](../security/problems.md#auth-022). <a id="auth-022-the-before-user-created-hook-did-not-run-for-admincreateuser-on-local-gotrue"></a> <a id="auth-022"></a>
- AUTH-023 — Moved to [AUTH-023](../security/problems.md#auth-023). <a id="auth-023-small-a5-gaps-left-by-design"></a> <a id="auth-023"></a>
- AUTH-012 — Moved to [AUTH-012](../ui-ux-design/problems.md#auth-012). <a id="auth-012-auth-screens-have-no-accepted-design-yet"></a> <a id="auth-012"></a>
