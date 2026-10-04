# Progress — Auth onboarding program

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | Master [plan.md](./plan.md) r4 (Decision 10 adds A1b; Owner-approved 2026-10-04). A1: [a1/plan.md](./implementation-plans/a1/plan.md) r3, frozen, cut from [source r8](./sources/d7-combined-plan-r8.md). A1b: [a1b/plan.md](./implementation-plans/a1b/plan.md) r3, frozen (merged and rolled out). A2: [a2/plan.md](./implementation-plans/a2/plan.md) r4.3 on `feat/auth-a2-password-recovery` (uncommitted), rewritten on the A1b table; Codex plan review r1 CHANGES_REQUIRED (2 Required, 2 Optional) and r2 CHANGES_REQUIRED (1 Required) fixed; r3 PASS (2026-10-04) on r4.2; r4.3 records the Owner's choice to keep default 5 and prioritize AUTH-007 (wording only); Owner-approved 2026-10-04 with §1.4 defaults 1–7. A3, A4: no detail plan yet |
| Current unit / checkpoint | A2 implementation: plan r4.3 Owner-approved 2026-10-04; the Owner runs the implementation with Codex CLI, then asks for a Codex implementation review. A1b is merged and fully rolled out. A1 is merged; its rollout step 6 is open |
| Status | A1 Rollout pending (step 6); A1b Done; A2 Implementation (by the Owner with Codex); A3 Not started; A4 Not started |
| Completed evidence | A1 merged in PR 119 as `3094600`. A1 before merge (historical): unit 778/778, integration 282/282, tsc, eslint and build passed; smoke E2E equals E2E-001 plus the flaky `issue-deep-links` (AUTH-010, accepted by the Owner); Codex implementation review r2 PASS (0 Critical, 0 Required). A1b merged in PR 121 as `5c43476`; local evidence before merge (historical): unit 784/784, integration 288/288, tsc and build passed, privilege matrix, backfill and `db diff` checks, local browser QA and Codex implementation review PASS. A1b hosted rollout 2026-10-04: R1 `db push` of `20261004100000`; R2 only `service_role` has select/insert, RLS on with 0 policies, service-role read works, coverage 0; R3 production deploy READY; R4 signed-out smoke and Vercel logs clean, signed-in `/auth/set-password` check passed (Owner); R5 backfill re-run inserted 0 rows, coverage 0, privileges unchanged. Details in the PR 121 body |
| Accepted deviations | None open |
| Blockers / Owner decisions | A1 rollout step 6 (re-enable sign-ups) waits for A2 deployed READY plus its recovery QA (Decision 9) and for AUTH-013 (auth mail lands in Gmail Spam) to meet its exit condition. A2 waits for the Owner-run Codex implementation. AUTH-007 is the next unit after A2 (Owner, 2026-10-04). Open problems are in [problems.md](./problems.md) |
| Next action | Owner runs the A2 implementation with Codex CLI and reports back; then a Codex implementation review on request; commits of the result need Owner permission |
| Current authority | A2 plan approved 2026-10-04; the Owner runs the A2 implementation with Codex CLI (Codex cannot commit; commits by me need Owner permission). No implementation is granted for A3 or A4 (no detail plan). Hosted rollout step 6 and every dashboard, `db push` and Vercel action need explicit Owner permission. Commit, push, PR and merge each need explicit Owner permission |
| Hosted state | A1 rollout steps 2–4 done by the Owner 2026-10-03 and step 5 passed in production (Owner, 2026-10-03); step 6 is open; evidence is kept outside the repo. SMTP through Resend from `noreply@auth.vocaspace.com`; Site URL and Redirect URLs as planned; Phone off; minimum password length 6 with no extra requirements; Secure password change off; sign-ups OFF; Confirm email ON since T_on (window 21:30:13–21:33:27 +07); Confirm signup template from `supabase/templates/confirmation.html`; migrations `20261003100000` and `20261004100000` (A1b `user_password_setups`) pushed; production runs `5c43476`; Before User Created hook enabled on `public.d7_before_user_created` (`supabase_auth_admin` execute only); the G3 list of 7 user ids is stored outside the repo (no emails here) |

## Milestones

One line each, newest last: date, what happened, commit or PR.

- 2026-10-02 D7 combined plan r8 passed Codex review on `feat/student-flow-d7-auth-cta` after the Owner chose real Google OAuth, email verification and optional profile completion; password set after verification (Decision 5) and the Before User Created hook (Decision 6) added on the way (`0c255f9`).
- 2026-10-02 The Owner split D7 into this program of 4 PRs (Decision 7); the D7 plan became the reviewed source; the branch was renamed to `feat/auth-a1-email-verification`.
- 2026-10-03 Master plan r3 passed Codex review r3 after Decision 8 (hide the Google buttons until A4); the Owner approved it with Decision 9 (`9bfd0c6`).
- 2026-10-03 A1 detail plan r3 passed Codex review r3; the Owner approved it and authorized implementation with local commits per checkpoint (`89cba5b`).
- 2026-10-03 A1 CP1: hook migration, confirmation template, local auth config (`90a5663`).
- 2026-10-03 A1 CP2+CP3: server actions, `/auth/confirm`, `/auth/set-password`, check-email screen, Google buttons hidden (`c5997a2`).
- 2026-10-03 A1 CP4: full checks and local browser QA passed; E2E difference AUTH-010 accepted by the Owner (`73bd0b5`).
- 2026-10-03 `allowedDevOrigins` for `127.0.0.1` after a local A/B check, closing AUTH-011 (`5782117`).
- 2026-10-03 Codex implementation review r1 FAIL (3 Required) fixed (`60c4e53`); r2 PASS (`e952a2c`).
- 2026-10-03 Owner QA fixes on the check-email screen, resend toast and login labels (`48a187e`); header mismatch deferred (AUTH-012); the Owner asked to push and open the PR (`f681270`).
- 2026-10-03 Owner ran hosted rollout steps 2–4; Gmail Spam placement found (AUTH-013) (`9f34536`, `a211f9f`).
- 2026-10-03 PR 119 merged (`3094600`).
- 2026-10-04 Migrated to the repo-docs-system templates: State moved here from the master plan and the A1 plan, AUTH-011 shrunk to one line (CP3 of the docs-system PR1, `docs/doc-system-optimization`).
- 2026-10-04 Decision 10: the G8 marker moves to an app-owned table in a new unit A1b before A2 (AUTH-014, found in A2 plan review); master plan r4 and the A1b detail plan r3 written from a local spike, Codex plan review r3 PASS, Owner-approved (`9a3cc93`).
- 2026-10-04 A1b CP1–CP3: marker table migration with backfill, table-first eligibility and write, unit and integration tests (`64f2300`); full local checks, browser QA and Codex implementation review PASS (`238c0aa`).
- 2026-10-04 PR 121 merged (`5c43476`); A1b hosted rollout R1–R5 passed, including the Owner's signed-in R4 check; AUTH-014 resolved, legacy cleanup split to AUTH-015.
- 2026-10-04 A2 branch fast-forwarded to `5c43476`; A2 detail plan rewritten as r4 on the A1b table (recovery evidence in an app-owned table, G8-M dropped); Codex plan review r1–r2 findings fixed, r3 PASS on r4.2; r4.3 keeps default 5 with AUTH-007 next; Owner-approved (this commit).
