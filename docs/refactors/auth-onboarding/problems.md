# Problems, risks and follow-ups — Auth onboarding program

Plan: [plan.md](./plan.md). Progress: [progress.md](./progress.md). Follow-ups raised while implementing each PR (source r8 §8.3) are recorded here when that PR completes.

### AUTH-002: Google buttons do not mean OAuth is implemented

- Status: Open. Moved from the [student-user-flow-route](../student-user-flow-route/problems.md) program on 2026-10-02 with the same ID. Handled by A4.
- Problem: `/login` and `/register` show Google buttons with no handler.
- Direction: the Owner chose real Google OAuth (Decision 1). A1 hides the buttons; A4 shows them again with the working flow (Decision 8).
- Resolved when: A4 merges and Google sign-in works in production.

### AUTH-004: `createUserByAdmin` creates users with a known default password

- Status: Open (follow-up, outside the 4 PRs). (`AUTH-003` is already used by the student-user-flow-route program.)
- Problem: `app/actions/user.ts` creates users with a fixed password and `email_confirm: true`.
  - Anyone who knows the default password can sign in to the account.
  - Once Google is enabled, that account is auto-linked to the email owner's Google identity.
- Mitigation in this program: audit these users under gate G3 before every Google enable (plan §4, source §8.2 step 7).
- Later fix: random password plus an email invitation to set a password.

### AUTH-005: Retire the D7 combined source plan once no plan references it

- Status: Open (docs housekeeping).
- Problem: [sources/d7-combined-plan-r8.md](./sources/d7-combined-plan-r8.md) is the reviewed source the per-PR plans are cut from. The master plan and the A1 plan cite its sections (spikes, guardrail rationale, attacker acceptance), and A2/A4 still need its G8 and Google content.
- Direction: keep it until the A4 detail plan is cut; then delete it or mark it historical, updating every reference in the same change.
- Resolved when: no program document links to it, or it is explicitly marked historical.

### AUTH-006: G8 limits after A1

- Status: Open (accepted A1 limits, source §8.3).
- Problem:
  - profile data entered by someone who pre-registered an email through the app stays on the victim's profile (the Owner fixes it via the dashboard);
  - while `d7_password_set` is unset, a mailbox owner can also set a password once through a magic link from the direct Auth API.
- Resolved when: a later plan removes or explicitly accepts these limits.

### AUTH-007: The Auth API can change a password with any valid session

- Status: Open (follow-up after A2).
- Problem: any valid access token, including the original `otp` session, can change the password directly through `PUT /auth/v1/user`; concurrent set-password requests from one verified session are last-write-wins (A1 §2.5 replay-guard scope).
- Candidate fix: turn on "Secure password change" after A2, evaluated in its own plan.

### AUTH-008: Email enumeration protection is app-level only

- Status: Open (accepted).
- Problem: G5 neutral results cover the app's actions and screens, not the direct Supabase Auth API.

### AUTH-009: A failed sign-up can leave an orphan avatar file

- Status: Open (pre-existing).
- Problem: `signUpUser` uploads the avatar before the user is created, so a sign-up that never completes leaves the file in the `avatars` bucket.

### AUTH-010: `issue-deep-links` smoke E2E is flaky

- Status: Open (found during A1 CP4, not caused by A1).
- Evidence 2026-10-03: after the Topic Builder settings tab click the URL still keeps `from=dashboard`. On the pre-A1 commit `9bfd0c6` it failed 1 of 3 runs; on A1 it passed 1 of 5 runs. A1 does not touch the Topic Builder tabs.
- Direction: a separate fix of the tab URL update in `TopicBuilderTabs.tsx` or of the spec's wait; track together with E2E-001.

### AUTH-011: `next dev` blocks dev resources for `127.0.0.1`

- Status: Open (local tooling).
- Problem: `npm run dev` logs "Blocked cross-origin request to Next.js dev resource" for host `127.0.0.1`, and pages opened on `http://127.0.0.1:3000` did not respond to clicks during A1 QA. Auth links use `site_url = http://127.0.0.1:3000`, so local browser QA of the mail flow ran on `next build` + `next start` instead.
- Candidate fix: add `allowedDevOrigins: ["127.0.0.1"]` to `next.config.ts` in a small tooling change.
