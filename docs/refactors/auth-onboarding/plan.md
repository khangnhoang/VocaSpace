# Master plan — Auth onboarding program (email verification, password recovery, profile, Google OAuth)

## 1. Program, ownership and authority rules

- Program created 2026-10-02 at the Owner's request: D7 of the [student-user-flow-route](../student-user-flow-route/plan.md) program becomes a **separate program of 4 PRs**. The old program no longer owns D7.
- Revision: r3, 2026-10-03 (Codex master review r3 `PASS`, 0 Critical/Required open; Owner-approved 2026-10-03 together with Decision 9).
- This file owns the program outcome, Owner decisions, shared invariants, the 4 PR boundaries, dependencies, hosted rollout gates and merge order. It holds no State: current status, authority and next action belong to [progress.md](./progress.md); problems, risks and follow-ups belong to [problems.md](./problems.md). Each PR gets its own detail plan at `implementation-plans/<pr>/plan.md`, which owns that PR's implementation contract.
- [sources/d7-combined-plan-r8.md](./sources/d7-combined-plan-r8.md) is the combined D7 plan that passed Codex review r8 (`PASS`). It is the **reviewed source** for most of this program's content (repository facts, spikes, contracts, runbook). It is **no longer** an implementation contract, and it stays in Vietnamese as reviewed. Each PR's detail plan is cut from it per §6 and written in English.
- **Authority rule:** each PR needs an Owner-approved detail plan and a separate Owner go-ahead to implement. Commit, push, PR, merge, `db push`, Supabase dashboard, Google Cloud Console and Vercel are separate authorities that need explicit Owner permission. What is granted now is recorded in `progress.md`.
- The agent never enters Google client secrets, SMTP passwords or any credential. The Owner configures hosted services by following each detail plan's runbook.
- Size: large/high-risk (auth, hook migration, production auth settings, gated rollout order). Splitting into 4 PRs gives each PR one outcome and one rollout.

## 2. Program outcome

1. Email sign-up requires email verification, and the password is set after verification. Nobody can pre-create an email account with a self-chosen password through the public Auth API.
2. A verified user who forgot their password, or never managed to set one, can recover access by email.
3. A user without a username (e.g. a new Google account) can save their profile with optional fields left blank, and can set a username **once** in `/profile`.
4. The "Sign in with Google" button on `/login` and `/register` works. A first sign-in creates a `student` account; an email matching an existing account that passed gate G3 lands in that existing account. `AUTH-002` is closed.

## 3. Owner decisions

Decisions 1–6 were recorded on 2026-10-02 in source §2.2. They are unchanged and summarized here so the program stands on its own:

1. Build real Google OAuth; do not hide the button.
2. Turn on email verification ("Confirm email") in production. Reason: Supabase auto-links identities with the same email, so an account pre-registered with someone else's email could be linked to that person's Google identity.
3. Profile completion is not required after Google sign-in. A username can be set once in `/profile` while it is empty. No migration for the profile part.
4. Accept Supabase auto-linking for accounts that passed gate G3.
5. Set the password after email verification: the server creates the user with a random password, and the user sets a password after clicking the link.
6. Block email user creation through the public Auth API with a "Before User Created" hook (one migration containing only the hook function, plus one hosted setting).
7. **(2026-10-02)** Split into a separate program of 4 PRs: A1 email verification, A2 password recovery (the D7b follow-up the Owner already approved), A3 profile + one-time username, A4 Google OAuth.
8. **(2026-10-03)** Do not keep the fake Google button: A1 hides the Google buttons on `/login` and `/register`; A4 shows them again together with the working flow. This refines Decision 1 for the interim period only; the end state is still a visible, working Google button.

9. **(2026-10-03)** Sign-ups stay off after A1 deploys. A1 rollout step 6 (re-enable sign-ups) runs only after A2 is deployed READY in production and its recovery QA has passed, so a user who loses their session before setting a password can always recover on their own (§5, A1 rollout).

## 4. Shared program invariants

Details and rationale are in source §2.5. Every PR must keep them:

- **No open redirect (G1):** auth routes redirect only to fixed internal paths and never read `next`/`redirect_to` from the query.
- **No secrets in the repo (G2):** credentials live only in hosted dashboards or uncommitted local env (`config.toml` uses `env(...)`).
- **Google gate (G3):** the Google provider may be enabled in production only when "Confirm email" is on and the Owner has audited the full user list captured at the mode switch (A1 rollout), plus every user created afterwards that is not exempt (by `id`-set diff). Re-audit before **every** Google re-enable.
- **Sign-up never issues a session; the "allow new sign-ups" switch is honored (G4).**
- **Neutral errors; no email enumeration at the app layer (G5).**
- **Hosted configuration belongs to the Owner (G6).**
- **No password is known before verification; only someone who just proved mailbox ownership may set a password without the old one (G8).** A2 extends this rule to recovery and must keep the same level of proof.
- **Hard rules after T_on** (the moment "Confirm email" is turned on during A1 rollout): never turn off "Confirm email", never disable the hook, never remove `/auth/confirm`, the "check your email" screen or the set-password-after-verification flow (source §8.3).
- Never edit a published migration; fix the hook with a new migration.

## 5. The four PRs

| PR | Planned branch | Outcome | Dependencies |
| --- | --- | --- | --- |
| A1 — Email verification + hook | `feat/auth-a1-email-verification` (renamed from `feat/student-flow-d7-auth-cta`) | Outcome 1 | None. Rollout needs the Owner: SMTP, template, hook, "Confirm email" |
| A2 — Password recovery | `feat/auth-a2-password-recovery` | Outcome 2 | Hard: A1 merged (reuses `/auth/confirm`, the G8 rule, templates) |
| A3 — Profile + one-time username | `feat/auth-a3-profile-username` | Outcome 3 | No code dependency on A1/A2; can run in parallel |
| A4 — Google OAuth | `feat/auth-a4-google-oauth` | Outcome 4 | Code: after A1 merges (both edit `/login` and `config.toml`). Enabling Google in production: hard, requires A1 rollout complete (all steps 2–6), gate G3 passed, and a READY production deployment containing A3 and A4 with the null-username profile save checked |

### A1 — Email verification + "Before User Created" hook

- **Scope:**
  - hook migration (source H12);
  - `config.toml` (source H9, **except** the `[auth.external.google]` block);
  - verification email template;
  - `registerSchema` without password, plus a set-password schema;
  - `signUpUser`: settings gate, username pre-check, `admin.createUser` with a random password and the marker, `resend`, neutral result;
  - `signInUser` parsing `loginSchema`;
  - `resendSignupConfirmation`;
  - `/auth/confirm`;
  - `/auth/set-password` + `setPasswordAfterConfirmation`;
  - `/register` without a password field, plus the "check your email" screen;
  - `/login` reading `auth_error=confirm`;
  - hide the Google buttons on `/login` and `/register` (Decision 8; not in source r8).
- **Non-goals:** a working Google button, `/auth/callback`, profile/username, password recovery.
- **Acceptance:** source §5.1. The C3/G8 acceptance tests in source C1 must pass.
- **Verification:**
  - source C1 plus the C4 full check: unit, integration with the hook on, `tsc`, eslint, build, and E2E smoke compared against the `E2E-001` baseline;
  - browser QA of sign-up → email → set password;
  - no Google button is rendered on `/login` or `/register`.
- **Rollout (Owner):** source §8.2 steps 2–6:
  1. SMTP.
  2. URL config, and confirm the Phone provider is off.
  3. Disable sign-ups, turn on "Confirm email" (T_on), update the template, `db push` the hook and enable it, wait, then **capture the G3 `id` list and store it outside the repo for A4**.
  4. Merge and deploy.
  5. Re-enable sign-ups (source step 6), **only after A2 is deployed READY in production and its recovery QA has passed** (Decision 9). The public `signUp` probe must get the hook's 403, then do a real sign-up.
- Between A1 deploy and step 6, sign-ups stay off; existing users keep signing in with their passwords.

### A2 — Password recovery

- **Planned scope:**
  - a "Forgot password" page that sends a recovery email with a neutral result;
  - the link goes to `/auth/confirm` (type recovery), then to a new-password screen;
  - a "Reset password" template on hosted (Owner).
- **Questions the detail plan must answer from the repository plus a local spike before binding:**
  - What `amr` claim does a recovery session carry?
  - Under which condition may G8 allow a reset once `d7_password_set` is already set, without opening it to `password`/`oauth` sessions?
  - Does a Google-only user receive a recovery email and manage to set a password?
  - How do rate limits and neutrality of `resetPasswordForEmail` behave?
- **Acceptance (program level):**
  - The mailbox owner of a verified account can set a new password by email.
  - Every send result is identical regardless of email state.
  - A password or Google session cannot reset the password without going through email.
  - A1's replay protection is preserved: after the first password set, the original verification session (or any session not created from an accepted recovery email) still cannot set the password again. Any exception to the `d7_password_set` check must be tied to evidence of the specific accepted recovery.
- **Not yet reviewed:** the source only has the D7b follow-up. The A2 detail plan needs full planning.

### A3 — Profile + one-time username

- **Scope:** source H8:
  - `profileSchema` treats `""` as null for `username`/`dob`/`gender`;
  - the action writes `username` only via a conditional update where the current username is null;
  - the form enables the username field while it is empty.
- **Non-goals:**
  - blocking username changes through the Data API directly (G7 limitation, needs a migration);
  - the register/profile gender enum mismatch.
- **Acceptance:** source §5.3.
- **Verification:**
  - source C3 plus the shared checks: unit, integration including the two-request race, `tsc`, eslint, build;
  - browser QA with a null-username fixture user (source §9).
- **Rollout:** no hosted configuration.
- **Why it must be live before Google is enabled:** today a user with a null username cannot save their profile at all (source §3), which is exactly the state of a new Google user.
- **Rollback rule:** once Google has ever been enabled, null-username accounts exist; any later A3 rollback or fix must keep profile saving working for null-username users, even if Google is disabled at that time. Roll back only the faulty part or fix forward with a new PR.

### A4 — Google OAuth

- **Scope:**
  - show the Google buttons again (hidden by A1, Decision 8);
  - source H1: shared Google button that checks the provider via `/auth/v1/settings` before redirecting;
  - H2: `/auth/callback`;
  - the `auth_error=oauth` part of H7;
  - the `[auth.external.google]` block in `config.toml` (`enabled = false`, credentials via env).
- **Acceptance:** source §5.2.
- **Verification:** source C2 plus the shared checks. Real Google sign-in is verified only in production after rollout, or locally if the Owner configures credentials.
- **Rollout (Owner):** source §8.2:
  - step 1: Google Cloud OAuth client;
  - step 7: gate G3, auditing the A1 list plus the current `id`-set diff;
  - step 8: enable Google, then test a new account and an existing-email account that passed G3.
- **Google incidents:** handled per source §8.3.
- **Enable gate (in addition to G3):** production is running a READY deployment that contains A3 and A4, and a profile save for a null-username user has been checked on that deployment before Google is enabled.
- `AUTH-002` closes when Google sign-in works in production.

## 6. Which PR owns which part of source r8

| Source (`sources/d7-combined-plan-r8.md`) | A1 | A2 | A3 | A4 |
| --- | --- | --- | --- | --- |
| §2.2 Decisions | 2, 5, 6 | — | 3 | 1, 4 |
| §2.5 Guardrails | G1 (`/auth/confirm`), G2, G4, G5, G6, G8 | G8 (extension) | G7 | G1 (`/auth/callback`), G2, G3, G6 |
| §3 Facts + spikes | Current auth, local config, tests/E2E, both spikes, hosted, Supabase Auth | Current auth | Profile | Hosted, Supabase Auth (auto-linking, `signInWithOAuth`) |
| §4 Hypotheses | H3, H4, H5, H6, H7 (`confirm`), H9 (minus google), H11, H12 | — | H8 | H1, H2, H7 (`oauth`), H9 (google block) |
| §5 Contracts | §5.1 | — | §5.3 | §5.2 |
| §7 Checkpoints | C1 + C4 | — | C3 + C4 | C2 + C4 |
| §8.1 Risks | Verification, hook, SMTP, template, Site URL, pre-registration rows | Session lost before setting a password | `profileSchema` typing | Google before gate, admin-created default-password users, Google-only users |
| §8.2 Runbook | Steps 2–6 | Recovery template (new) | — | Steps 1, 7, 8 |
| §8.3 Stop/rollback | Hard rules, mail incident, code incident | D7b follow-up | — | Google incident |
| §9 Fixtures | (a), G8/hook | — | (b), (c) | Real Google |

Each PR's detail plan:

- copies its part into its own English contract;
- records any deviation from the source;
- points back to the source for shared material.

Content already reviewed in the source does not need re-review just because it was copied. Content that is **new or changed** by the split does need author self-review: intermediate states between PRs, per-PR rollouts, and all of A2. The Owner decides whether independent review is needed.

## 7. Order and gates

```text
A1 code approved
  -> A1 pre-deploy rollout (steps 2–4: SMTP, URL config, sign-ups off, "Confirm email" on = T_on, template, hook pushed + enabled, G3 list captured)
  -> A1 merge + production deploy READY (step 5)
  -> sign-ups stay off until A2 deploy READY + recovery QA (Decision 9)
A1 merged -> A2 code/merge -> A2 deploy READY + recovery QA
  -> A1 post-deploy rollout step 6 (Decision 9: sign-ups re-enabled only now)
A3 (independent; any time) -> A3 deploy READY
A1 merged -> A4 code/merge
A1 rollout steps 2–6 complete + gate G3 + READY deployment with A3 and A4 + null-username profile check -> A4 rollout (enable Google)
```

- A1 must never be merged or deployed before its pre-deploy steps (2–4) are complete; otherwise pending users could exist while "Confirm email" is off (source §3, §8.3).

- Recommended order: A1 → A2 → A3 → A4.
- A3 can run in parallel with A1/A2 because it shares no auth files. A3 edits `app/actions/profile.ts`, `lib/schemas/profile.ts` and the profile form.
- A4 code may merge after A1 has merged (so after A1's pre-deploy steps), even before A1 step 6 completes, because the button reports "not available" while the provider is off. Google is **enabled** only once the A4 enable gate (§5) passes.
- Each PR gets one branch from the latest `main` after the previous PR (except A3 if done in parallel).

## 8. Program-level risks

| Risk | Mitigation |
| --- | --- |
| Google enabled before gate G3 | Hard gate in §4 and §7; A4 rollout step 7 before step 8 |
| G3 list captured in A1 is lost before A4 | A1 rollout stores the `id` list outside the repo; progress records that it was stored (no emails) |
| Intermediate state between A1 and A2: user loses session before setting a password | Decision 9: sign-ups stay off until A2 is deployed READY and its recovery QA passed, so no new user can reach this state; A2 right after A1 |
| Sign-ups closed longer than planned if A2 slips | Accepted by the Owner (Decision 9); A2 is next in order |
| A2 loosens G8 and opens a password-setting path | A2 spikes the recovery `amr` claim, keeps mailbox-proof level and A1 replay protection (A2 acceptance); review before implementation |
| Hook disabled or dropped by a later PR or incident | The hook is permanent after T_on (§4 hard rules); A1 owns it, later PRs must not change it except through a new migration that keeps the §4 invariants |
| Google buttons hidden between A1 and A4 | Decision 8: A1 hides them, A4 shows them with the working flow |
| `createUserByAdmin` creates users with a default password | G3 audit before every Google enable; follow-up `AUTH-004` |

## 9. Out of program scope

- Magic link, One Tap, other providers (Facebook, Apple).
- Self-service identity linking/unlinking in `/profile`.
- CAPTCHA, custom domain, DKIM/SPF.
- Email enumeration at the direct Supabase Auth API layer.
- Blocking username changes through the Data API.
- Fixing the gender enum mismatch.
- Refactoring `createUserByAdmin` (separate follow-up).
