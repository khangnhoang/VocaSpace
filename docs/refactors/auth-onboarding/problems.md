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
