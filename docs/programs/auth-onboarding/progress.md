# Progress — Auth onboarding program

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | Master [plan.md](./plan.md) r5, Owner-approved 2026-10-05 (Decision 11 adds unit A2b; r4 added A1b, Decision 10). Detail plans, all frozen: [a1/plan.md](./implementation-plans/a1/plan.md) r3, cut from [source r8](./sources/d7-combined-plan-r8.md); [a1b/plan.md](./implementation-plans/a1b/plan.md) r3; [a2/plan.md](./implementation-plans/a2/plan.md) r4.3; [a2b/plan.md](./implementation-plans/a2b/plan.md) r2. A3 and A4 have no detail plan yet. |
| Current unit / checkpoint | None active. A1, A1b, A2 and A2b are done. Next unit: A3 or A4, chosen by the Owner. |
| Status | A1 Done; A1b Done; A2 Done; A2b Done; A3 Not started; A4 Not started. AUTH-007 is resolved (2026-10-05). |
| Completed evidence | A1 merged in PR 119 (`3094600`), A1b in PR 121 (`5c43476`), A2 in PR 122 (`bde2bae`), A2b in PR 124 (`3cbcff2`). Each PR body holds its local checks, review result and hosted rollout steps; PR 125 holds the A2b rollout and A1 step 6 results. The milestones below summarize each result. |
| Accepted deviations | Owner 2026-10-04 chose option 1: defer A2's Required input-border/focus contrast defect to the shared auth redesign (AUTH-012); preserve current auth UI consistency. The contrast defect remains open and mandatory in that redesign; no WCAG compliance claim. |
| Blockers / Owner decisions | No blocker. Open problems are in [problems.md](./problems.md). |
| Next action | The Owner chooses the next unit (A3 or A4) and asks for its detail plan. |
| Current authority | This file grants no implementation, commit, push, PR, merge, deploy or remote database authority. A3 and A4 each need their own grant. |
| Hosted state | SMTP through Resend from `noreply@auth.vocaspace.com`; Site URL and Redirect URLs as planned; Phone off; minimum password length 6 with no extra requirements. Secure password change and Require current password when updating are both on (both off before 2026-10-05, A2b R2). Sign-ups ON since 2026-10-05 (A1 step 6). Confirm email ON since T_on (window 21:30:13–21:33:27 +07). Confirm signup template from `supabase/templates/confirmation.html`; Reset password template from `supabase/templates/recovery.html`. Migrations `20261003100000`, `20261004100000` (A1b `user_password_setups`) and `20261004135036` (A2 `user_password_recoveries`) pushed. Before User Created hook enabled on `public.d7_before_user_created` (`supabase_auth_admin` execute only). Production runs `3cbcff2`. The G3 list of 7 user ids is stored outside the repo (no emails here). |

## Milestones

One line each, newest last: date, what happened, commit or PR.

- 2026-10-02 D7 combined plan r8 passed Codex review on `feat/student-flow-d7-auth-cta` after the Owner chose real Google OAuth, email verification and optional profile completion; password set after verification (Decision 5) and the Before User Created hook (Decision 6) added on the way (`0c255f9`).
- 2026-10-02 The Owner split D7 into this program of 4 PRs (Decision 7); the D7 plan became the reviewed source; the branch was renamed to `feat/auth-a1-email-verification` (`9bfd0c6`).
- 2026-10-03 Master plan r3 passed Codex review r3 after Decision 8 (hide the Google buttons until A4); the Owner approved it with Decision 9 (`9bfd0c6`).
- 2026-10-03 A1 detail plan r3 passed Codex review r3; the Owner approved it and authorized implementation with local commits per checkpoint (`89cba5b`).
- 2026-10-03 A1 CP1: hook migration, confirmation template, local auth config (`90a5663`).
- 2026-10-03 A1 CP2+CP3: server actions, `/auth/confirm`, `/auth/set-password`, check-email screen, Google buttons hidden (`c5997a2`).
- 2026-10-03 A1 CP4: full checks and local browser QA passed; E2E difference AUTH-010 accepted by the Owner (`73bd0b5`).
- 2026-10-03 `allowedDevOrigins` for `127.0.0.1` after a local A/B check, closing AUTH-011 (`5782117`).
- 2026-10-03 Codex implementation review r1 FAIL (3 Required) fixed (`60c4e53`); r2 PASS (`e952a2c`).
- 2026-10-03 Owner QA fixes on the check-email screen, resend toast and login labels (`48a187e`); header mismatch deferred (AUTH-012); the Owner asked to push and open the PR (`f681270`).
- 2026-10-03 Owner ran hosted rollout steps 2–4; Gmail Spam placement found (AUTH-013) (`a211f9f`).
- 2026-10-03 A1 merged (PR 119, `3094600`).
- 2026-10-03 A1 rollout step 5 passed in production after the merge, checked by the Owner (PR 119).
- 2026-10-04 Migrated to the repo-docs-system templates: State moved here from the master plan and the A1 plan, AUTH-011 shrunk to one line (CP3 of the docs-system PR1, `docs/doc-system-optimization`) (`4fa8813`).
- 2026-10-04 Decision 10: the G8 marker moves to an app-owned table in a new unit A1b before A2 (AUTH-014, found in A2 plan review); master plan r4 and the A1b detail plan r3 written from a local spike, Codex plan review r3 PASS, Owner-approved (`9a3cc93`).
- 2026-10-04 A1b CP1–CP3: marker table migration with backfill, table-first eligibility and write, unit and integration tests (`64f2300`); full local checks, browser QA and Codex implementation review PASS (`238c0aa`).
- 2026-10-04 PR 121 merged; A1b hosted rollout R1–R5 passed, including the Owner's signed-in R4 check; AUTH-014 resolved, legacy cleanup split to AUTH-015 (PR 121, `5c43476`).
- 2026-10-04 A2 branch fast-forwarded to `5c43476`; A2 detail plan rewritten as r4 on the A1b table (recovery evidence in an app-owned table, G8-M dropped); Codex plan review r1–r2 findings fixed, r3 PASS on r4.2; r4.3 keeps default 5 with AUTH-007 next; Owner-approved (`cb55fed`).
- 2026-10-04 A2 CP1–CP4: recovery table/template, neutral request UI, buffered auth cookie commit, session-bound G8-R and scoped consume; unit 863/863, integration 299/299, types/build/local browser QA passed, smoke 10 pass / 4 E2E-001 baseline fails; one earlier full run hit the existing public-course aggregate-index test's 5 s timeout and the final run passed; local implementation checkpoint (`39581b0`).
- 2026-10-04 A2 review r1 CHANGES_REQUIRED on `39581b0`; Owner chose AUTH-012 deferral for Required contrast and both Optional test fixes. Deterministic rate-limit/active-access-token S2 checks passed 11/11, types/lint passed; correction re-review and R1–R6 pending (`01dfe7f`).
- 2026-10-04 A2 implementation re-review round 2 PASS on `01dfe7f` (review run in the Owner's Codex app thread `01a10757-9a52-7440-ab95-3f9554bdcb5f`; test counts are author-reported, not re-run by the reviewer) (`7f64df2`).
- 2026-10-04 PR 122 merged; A2 rollout R1–R5 passed and R6 Owner production QA passed: an email without an account sent no mail and showed the neutral result; an account with a password received the recovery mail, changed its password through link 1, then link 2 (a second mail) reached set-password and was rejected only by `same_password`; the hosted read-only check found the remaining evidence row was created after mail 2 was sent, so link 1's row was consumed (the upsert keeps `created_at` on conflict) and the leftover row has no live session; Gmail Inbox placement still unverified (AUTH-013) (PR 122, `bde2bae`).
- 2026-10-04 A2 copy follow-up from Owner QA: forgot-password toast, `same_password`/`weak_password` messages; "Quên mật khẩu?" placement noted in AUTH-012 (PR 123, `5697d01`).
- 2026-10-04 AUTH-013 resolved by Owner option 1 (clean-Gmail Inbox for the recovery mail); A1 step 6 unblocked. AUTH-007 spike on local GoTrue v2.189.0 and A2b plan with master Decision 11 draft; Codex plan review r1 FAIL fixed, r2 PASS (`115c5bf`).
- 2026-10-05 Owner approved Decision 11 and A2b defaults 1–5. A2b CP1: `/profile` sends `current_password` and maps GoTrue codes to Vietnamese messages; set-password maps `reauthentication_needed` to a new-link message; local `secure_password_change = true`; unit 876/876, auth integration 37/37 (incl. aged recovery session and `/profile` change on local GoTrue), tsc, build passed; local browser `/profile` wrong/same/right and one recovery set-password passed (`340b484`). CP2: approvals recorded, FEAT-001 password-changed email deferred in [future-features.md](./future-features.md) (`a6acb2f`).
- 2026-10-05 Codex implementation review of `5697d01..a6acb2f` PASS (0 Critical, 0 Required); 2 Optional fixed: recovery-flow integration header and the `/profile` case name no longer claim AC6 evidence; file rerun 13/13 on the local stack (`3e6703f`).
- 2026-10-05 PR 124 merged, CI 4/4; A2b R1: production READY, signed-out `/forgot-password` renders; signed-out `/profile` shows the existing "Vui lòng đăng nhập" toast instead of the redirect the runbook names (pre-existing, not changed by A2b). R2: Owner turned on both toggles (previously off). R3a direct API probe (Owner, test account, new password equal to the old one): no `current_password` → 400 `current_password_required`, wrong → 400 `current_password_invalid`, old password still signs in. R3b (Owner): `/profile` wrong/right current password and a fresh recovery set-password passed. R3c pending A1 step 6 (PR 124, `3cbcff2`).
- 2026-10-05 A1 step 6 (Owner): sign-ups re-enabled; public `signUp` with the anon key returned the hook's 403 "Signups must go through VocaSpace"; a real app sign-up got the mail, set its first password from the link (A2b R3c, both toggles on), landed signed in on `/`, then signed in again with the new password. Hosted read-only check: exactly one user created in the window, confirmed, with a password and a `user_password_setups` marker, so the probe created none. A1 and A2b done; AUTH-007 resolved (`24ed7e8`).
