# Future features — Security

Charter: [README.md](./README.md). Directions below are not implementation authority. Transferred wording retains its original planning scope and dated evidence; this migration does not revalidate runtime status.

<a id="feat-013"></a>

## FEAT-013: "Password changed" notification email

- Status: Deferred (A2b default 4, Owner-approved 2026-10-05).
- Direction: after any password change (`/profile`, set-password or the direct Auth API) the account email receives a notice, so a user whose session was misused learns about it.
- Why deferred: A2b closes AUTH-007 with the hosted password-change protections and accepted residuals; a notice is extra hardening, not needed for that exit.
- Pointers: [A2b plan](../auth-onboarding/implementation-plans/a2b/plan.md) §1.4 default 4; AUTH-007 (resolved 2026-10-05) in [progress.md](../auth-onboarding/progress.md).
- Target program: [Security](./README.md).
- Legacy identity: auth-onboarding:FEAT-001.
