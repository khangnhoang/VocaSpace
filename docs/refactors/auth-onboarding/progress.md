# Progress — Auth onboarding program

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | Master [plan.md](./plan.md) r3 (Owner-approved 2026-10-03). A1: [a1/plan.md](./implementation-plans/a1/plan.md) r3, frozen, cut from [source r8](./sources/d7-combined-plan-r8.md). A2: plan r1 written in another session (not on `main`, unreviewed). A3, A4: no detail plan yet |
| Current unit / checkpoint | None active. A1 is merged and in rollout; A2 planning is paused |
| Status | A1 Rollout pending; A2 Planning (paused); A3 Not started; A4 Not started |
| Completed evidence | A1 merged in PR 119 as `3094600`. A1 before merge (historical): unit 778/778, integration 282/282, tsc, eslint and build passed; smoke E2E equals E2E-001 plus the flaky `issue-deep-links` (AUTH-010, accepted by the Owner); Codex implementation review r2 PASS (0 Critical, 0 Required) |
| Accepted deviations | None open |
| Blockers / Owner decisions | A1 rollout step 6 (re-enable sign-ups) waits for A2 deployed READY plus its recovery QA (Decision 9) and for AUTH-013 (auth mail lands in Gmail Spam) to meet its exit condition. A2 planning waits for the docs-system PR1 (`docs/doc-system-optimization`) to merge. Open problems are in [problems.md](./problems.md) |
| Next action | After the docs-system PR1 merges, the A2 session rebases on `main`, drops its unpushed reconcile commit `ade2cd6`, and reshapes `a2/plan.md` to the detail-plan template (State goes into this file) before its review |
| Current authority | No implementation is granted for A2, A3 or A4 (A2 plan unreviewed; A3 and A4 have no detail plan). Hosted rollout step 6 and every dashboard, `db push` and Vercel action need explicit Owner permission. Commit, push, PR and merge each need explicit Owner permission |
| Hosted state | A1 rollout steps 2–4 done by the Owner 2026-10-03 and step 5 passed in production (Owner; undated here); step 6 is open; evidence is kept outside the repo. SMTP through Resend from `noreply@auth.vocaspace.com`; Site URL and Redirect URLs as planned; Phone off; minimum password length 6 with no extra requirements; Secure password change off; sign-ups OFF; Confirm email ON since T_on (window 21:30:13–21:33:27 +07); Confirm signup template from `supabase/templates/confirmation.html`; migration `20261003100000` pushed; Before User Created hook enabled on `public.d7_before_user_created` (`supabase_auth_admin` execute only); the G3 list of 7 user ids is stored outside the repo (no emails here) |

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
