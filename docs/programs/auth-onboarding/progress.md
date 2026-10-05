# Progress — Auth onboarding program

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | Master [plan.md](./plan.md) r5, Owner-approved 2026-10-05 (Decision 11 adds unit A2b; r4 added A1b, Decision 10). Detail plans, all frozen: [a1/plan.md](./implementation-plans/a1/plan.md) r3, cut from [source r8](./sources/d7-combined-plan-r8.md); [a1b/plan.md](./implementation-plans/a1b/plan.md) r3; [a2/plan.md](./implementation-plans/a2/plan.md) r4.3; [a2b/plan.md](./implementation-plans/a2b/plan.md) r2; [a3/plan.md](./implementation-plans/a3/plan.md) r2. A4: [a4/plan.md](./implementation-plans/a4/plan.md) r2, frozen (Owner-approved 2026-10-05 after Codex plan review PASS). |
| Current unit / checkpoint | A4 CP1 (branch `feat/auth-a4-google-oauth` from `2303f1b`). A1, A1b, A2, A2b and A3 are done. |
| Status | A1 Done; A1b Done; A2 Done; A2b Done; A3 Done; A4 In progress (plan r2 approved, implementation granted 2026-10-05). AUTH-007 is resolved (2026-10-05). |
| Completed evidence | Earlier units: see Milestones (PR 125 holds the A2b rollout and A1 step 6 results). A3: PR 128 merged (`2303f1b`) with CI 4/4 green at `c312ec1`; its body holds the local checks, review result and smoke E2E; production deploy READY and the Owner saved full name and gender on an existing account (2026-10-05). |
| Accepted deviations | Owner 2026-10-04 chose option 1: defer A2's Required input-border/focus contrast defect to the shared auth redesign (AUTH-012); preserve current auth UI consistency. The contrast defect remains open and mandatory in that redesign; no WCAG compliance claim. |
| Blockers / Owner decisions | None for A4 implementation. Open problems are in [problems.md](./problems.md); the Owner will fix the remaining AUTH problems in one batch after A4 (2026-10-05). |
| Next action | Implement A4 CP1, then CP2 (plan §4); then the implementation review and the Owner checkpoint. |
| Current authority | This file grants no implementation, commit, push, PR, merge, deploy or remote database authority. The Owner granted A4 implementation with local commits on `feat/auth-a4-google-oauth` on 2026-10-05; push, PR, merge, the Google Cloud and Supabase Google settings, and any hosted read for gate G3 each need their own grant. |
| Hosted state | SMTP through Resend from `noreply@auth.vocaspace.com`; Site URL and Redirect URLs as planned; Phone off; minimum password length 6 with no extra requirements. Secure password change and Require current password when updating are both on (both off before 2026-10-05, A2b R2). Sign-ups ON since 2026-10-05 (A1 step 6). Confirm email ON since T_on (window 21:30:13–21:33:27 +07). Confirm signup template from `supabase/templates/confirmation.html`; Reset password template from `supabase/templates/recovery.html`. Migrations `20261003100000`, `20261004100000` (A1b `user_password_setups`) and `20261004135036` (A2 `user_password_recoveries`) pushed. Before User Created hook enabled on `public.d7_before_user_created` (`supabase_auth_admin` execute only). Production runs `2303f1b` (A3). Google provider never enabled by this program. The G3 list of 7 user ids is stored outside the repo (no emails here). |

## Milestones

One line each, newest last: date, what happened, commit or PR.

- 2026-10-02 D7 combined plan r8 passed plan review on `feat/student-flow-d7-auth-cta` after the Owner chose real Google OAuth, email verification and optional profile completion; password set after verification (Decision 5) and the Before User Created hook (Decision 6) added on the way (`0c255f9`).
- 2026-10-02 The Owner split D7 into this program of 4 PRs (Decision 7); the D7 plan became the reviewed source; the branch was renamed to `feat/auth-a1-email-verification` (`9bfd0c6`).
- 2026-10-03 Master plan r3 passed plan review after Decision 8 (hide the Google buttons until A4); the Owner approved it with Decision 9 (`9bfd0c6`).
- 2026-10-03 A1 detail plan r3 passed plan review; the Owner approved it and authorized implementation with local commits per checkpoint (`89cba5b`).
- 2026-10-03 A1 CP1: hook migration, confirmation template, local auth config (`90a5663`).
- 2026-10-03 A1 CP2+CP3: server actions, `/auth/confirm`, `/auth/set-password`, check-email screen, Google buttons hidden (`c5997a2`).
- 2026-10-03 A1 CP4: full checks and local browser QA passed; E2E difference AUTH-010 accepted by the Owner (`73bd0b5`).
- 2026-10-03 `allowedDevOrigins` for `127.0.0.1` after a local A/B check, closing AUTH-011 (`5782117`).
- 2026-10-03 Implementation review findings fixed (`60c4e53`); implementation review passed (`e952a2c`).
- 2026-10-03 Owner QA fixes on the check-email screen, resend toast and login labels (`48a187e`); header mismatch deferred (AUTH-012); the Owner asked to push and open the PR (`f681270`).
- 2026-10-03 Owner ran hosted rollout steps 2–4; Gmail Spam placement found (AUTH-013) (`a211f9f`).
- 2026-10-03 A1 merged (PR 119, `3094600`).
- 2026-10-03 A1 rollout step 5 passed in production after the merge, checked by the Owner (PR 119).
- 2026-10-04 Migrated to the repo-docs-system templates: State moved here from the master plan and the A1 plan, AUTH-011 shrunk to one line (CP3 of the docs-system PR1, `docs/doc-system-optimization`) (`4fa8813`).
- 2026-10-04 Decision 10: the G8 marker moves to an app-owned table in a new unit A1b before A2 (AUTH-014, found in A2 plan review); master plan r4 and the A1b detail plan r3 written from a local spike, passed plan review, Owner-approved (`9a3cc93`).
- 2026-10-04 A1b CP1–CP3: marker table migration with backfill, table-first eligibility and write, unit and integration tests (`64f2300`); full local checks, browser QA and implementation review passed (`238c0aa`).
- 2026-10-04 PR 121 merged; A1b hosted rollout R1–R5 passed, including the Owner's signed-in R4 check; AUTH-014 resolved, legacy cleanup split to AUTH-015 (PR 121, `5c43476`).
- 2026-10-04 A2 branch fast-forwarded to `5c43476`; A2 detail plan rewritten as r4 on the A1b table (recovery evidence in an app-owned table, G8-M dropped); review findings fixed, r4.2 passed plan review; r4.3 keeps default 5 with AUTH-007 next; Owner-approved (`cb55fed`).
- 2026-10-04 A2 CP1–CP4: recovery table/template, neutral request UI, buffered auth cookie commit, session-bound G8-R and scoped consume; local checks and browser QA passed, smoke failures limited to the known E2E-001 baseline; local implementation checkpoint (`39581b0`).
- 2026-10-04 A2 review findings on `39581b0`: Owner chose AUTH-012 deferral for Required contrast and both Optional test fixes (`01dfe7f`).
- 2026-10-04 A2 implementation review passed on `01dfe7f` (`7f64df2`).
- 2026-10-04 PR 122 merged; A2 rollout R1–R5 and the Owner's R6 production recovery QA passed; a hosted read-only check confirmed the used link's evidence row was consumed; Gmail Inbox placement still unverified (AUTH-013) (PR 122, `bde2bae`).
- 2026-10-04 A2 copy follow-up from Owner QA: forgot-password toast, `same_password`/`weak_password` messages; "Quên mật khẩu?" placement noted in AUTH-012 (PR 123, `5697d01`).
- 2026-10-04 AUTH-013 resolved by Owner option 1 (clean-Gmail Inbox for the recovery mail); A1 step 6 unblocked. AUTH-007 spike on local GoTrue v2.189.0 and A2b plan with master Decision 11 draft; review findings fixed, passed plan review (`115c5bf`).
- 2026-10-05 Owner approved Decision 11 and A2b defaults 1–5. A2b CP1: `/profile` sends `current_password` and maps GoTrue codes to Vietnamese messages; set-password maps `reauthentication_needed` to a new-link message; local `secure_password_change = true`; local checks, auth integration on local GoTrue and browser QA passed (`340b484`). CP2: approvals recorded, FEAT-001 password-changed email deferred in [future-features.md](./future-features.md) (`a6acb2f`).
- 2026-10-05 Implementation review of `5697d01..a6acb2f` passed; Optional review findings fixed: recovery-flow integration header and the `/profile` case name no longer claim AC6 evidence (`3e6703f`).
- 2026-10-05 PR 124 merged; A2b R1 passed (signed-out `/profile` shows the existing sign-in toast, not the runbook's redirect; pre-existing); R2 the Owner turned on both toggles; R3a API probe and R3b `/profile` and recovery checks passed; R3c waited for A1 step 6 (PR 124, `3cbcff2`).
- 2026-10-05 A1 step 6 (Owner): sign-ups re-enabled; the hook rejected a direct `signUp`; a real app sign-up verified, set its first password (A2b R3c) and signed in again; a hosted read-only check found exactly that one confirmed user with a marker. A1 and A2b done; AUTH-007 resolved (`24ed7e8`).
- 2026-10-05 A3 detail plan written on `feat/auth-a3-profile-username`: blank profile fields save as null, username set once through a conditional update; gender enum mismatch split to AUTH-016; Owner approved the plan with defaults 1–4 (`d50046f`).
- 2026-10-05 A3 CP1: `profileSchema` normalizes blank username, dob and gender to null with a Vietnamese gender message; `updateUserProfile` reads the caller's username, then sets it once through a conditional update or saves the other fields without it; schema, action and local-database integration tests (`7897bb7`).
- 2026-10-05 A3 CP2: `/profile` username field is editable only while empty with the one-time helper and locks after the data refresh; component tests; local checks passed except the pre-existing `npm run lint` errors outside this unit; browser QA passed (`057f9f7`).
- 2026-10-05 A3 implementation review (Codex, gpt-6.1-sol high) PASS: 0 Critical, 0 Required; optional gap: no compiled-build test guards the username error message (`80a3379`).
- 2026-10-05 A3 review follow-up: CP2 milestone states the lint result; State evidence trimmed to A3 (`15ca07a`).
- 2026-10-05 A3 smoke E2E `profile-username-once` guards the short-username message under the React Compiler dev server; it fails when the `usernameError` workaround is removed (`c312ec1`).
- 2026-10-05 Production deploy READY after the A3 merge; the Owner saved full name and gender on an existing account. A3 done (PR 128, `2303f1b`).
- 2026-10-05 A4 detail plan r1 written on `feat/auth-a4-google-oauth`; the Owner approved defaults 1–5 and passed a first R3 null-username profile check on production `2303f1b` with a temporary dashboard user, since deleted (R3 repeats on the A4 deployment); signed-out `/profile` recorded as AUTH-017; Codex plan review r1 FAIL (4 Required) fixed in r2, r2 PASS; the Owner approved plan r2 and granted implementation (this commit).
