# Future features — Auth onboarding program

Owner direction outside the current scope of the program. Problems and risks live in [problems.md](./problems.md); the program plan is [plan.md](./plan.md).

## FEAT-001: "Password changed" notification email

- Status: Deferred (A2b default 4, Owner-approved 2026-10-05).
- Outcome: after any password change (`/profile`, set-password or the direct Auth API) the account email receives a notice, so a user whose session was misused learns about it.
- Why deferred: A2b closes AUTH-007 with the hosted password-change protections and accepted residuals; a notice is extra hardening, not needed for that exit.
- Pointers: [A2b plan](./implementation-plans/a2b/plan.md) §1.4 default 4; AUTH-007 in [problems.md](./problems.md).
