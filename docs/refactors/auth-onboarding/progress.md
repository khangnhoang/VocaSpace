# Progress — Auth onboarding program

Plan: [plan.md](./plan.md). Problems and follow-ups: [problems.md](./problems.md). The repository and Git history are the final evidence when documents disagree.

Statuses: Not started, Planning, In progress, Automated checks passed, Manual QA pending, Merged, Rollout pending, Completed, Blocked.

## Overview

| PR | Status | Detail plan | Notes | Updated |
| --- | --- | --- | --- | --- |
| A1 — Email verification + hook | Automated checks passed | [a1/plan.md](./implementation-plans/a1/plan.md) (cut from [source r8](./sources/d7-combined-plan-r8.md)) | Branch `feat/auth-a1-email-verification`; sign-ups re-enabled only after A2 (Decision 9) | 2026-10-03 |
| A2 — Password recovery | Not started | None yet (needs full planning) | Needs A1 merged | 2026-10-02 |
| A3 — Profile + one-time username | Not started | None yet | Independent | 2026-10-02 |
| A4 — Google OAuth | Not started | None yet | Needs A1 rollout + A3 merged before enabling Google | 2026-10-02 |

## History: D7 planning in the student-user-flow-route program (2026-10-02)

- The branch was created from `main` at `ab92e21` as `feat/student-flow-d7-auth-cta`. Commit `0c255f9` holds D7 plan r8, together with the old program's D4 reconcile and the D5 deferral.
- Owner choices:
  - real Google OAuth;
  - email verification on;
  - profile completion optional after Google sign-in.
- After Codex r4, the Owner chose to set the password after verification (Decision 5).
- After Codex r5, the agent proposed the "Before User Created" hook (Decision 6). The Owner approved it on 2026-10-02.
- Codex plan review (`gpt-6.1-sol` high): r1–r7 `FAIL`, r8 `PASS` (0 Critical/Required).
- No tests, browser QA or build have run. Evidence so far is discovery, hosted reads and two local spikes.

## Program setup (2026-10-02)

- The Owner split D7 into a separate program of 4 PRs (Decision 7).
- D7 plan r8 moved to [sources/d7-combined-plan-r8.md](./sources/d7-combined-plan-r8.md) as the reviewed source.
- The branch was renamed to `feat/auth-a1-email-verification`. It has no upstream and has not been pushed.
- Master plan r1 is written and self-reviewed. It is not Owner-approved, and nothing is implemented.
- 2026-10-03: Codex master review r1 (`gpt-6.1-sol` high, fresh session) `FAIL`: 3 Required (order diagram vs pre-deploy steps, A4 enable gate on production A3, `AUTH-003` ID collision), 3 Advisory. The Owner decided to hide the Google buttons until A4 (Decision 8). Master plan r2 fixes all findings; awaiting Codex review r2.
- 2026-10-03: Codex review r2 `FAIL`: R1, R3 and all Advisory resolved; R2 partially open (A3 rollback could drop null-username profile save by disabling Google first). r3 removes that exception; awaiting Codex review r3.
- 2026-10-03: Codex review r3 `PASS`: R2 resolved; no Critical/Required open. Master plan r3 awaits Owner approval; next step after approval is the A1 detail plan.
- 2026-10-03: The Owner approved master plan r3 and decided sign-ups stay off after A1 until A2 is deployed READY and its recovery QA has passed (Decision 9). Master plan committed; next step is the A1 detail plan.
- 2026-10-03: A1 detail plan r1 written from source r8 plus Decisions 8 and 9, and self-reviewed. Codex review (`gpt-6.1-sol` high, multi-agent allowed) r1 `FAIL` (6 Required: concurrent/direct-API replay scope, rollback vs hard rules, `oauth` reject rows, PowerShell command, 320px/200% QA; 1 Advisory) → r2; r2 `FAIL` (all r1 resolved; 1 Required page-guard expectation, 1 Advisory) → fixed in r3; r3 `PASS` (0 Critical/Required). Awaiting Owner approval.
- 2026-10-03: The Owner approved A1 plan r3, authorized implementation with local commits per checkpoint (self-review before each), and kept the D7 source until the A4 plan is cut (AUTH-005). Plan committed in `89cba5b`.
- 2026-10-03: CP1 `90a5663` — hook migration, confirmation template, local auth config; hook integration test 10/10.
- 2026-10-03: CP2+CP3 `c5997a2` — server actions, `/auth/confirm`, `/auth/set-password`, `/register` check-email screen, `/login` invalid-link message, Google buttons hidden; unit/component/schema 62 tests and sign-up flow integration 8/8. Browser QA found that an absolute redirect from `/auth/confirm` moves `127.0.0.1` to `localhost` and loses the session cookie, fixed as V8.
- 2026-10-03: CP4 — full unit 768/768, integration 282/282, tsc, targeted lint, build passed; smoke E2E matches E2E-001 plus the flaky `issue-deep-links` (AUTH-010); local browser QA passed (details in the A1 plan State). Not pushed.
- 2026-10-03: `next dev` on `127.0.0.1` fixed with `allowedDevOrigins` after a local A/B check (AUTH-011, `5782117`). Full-branch self-review against plan r3: no Critical/Required; the flag-write-failure path got a unit test and an AUTH-006 note. The Owner accepted the AUTH-010 E2E difference. Next: Codex multi-agent review, then Owner QA.
- 2026-10-03: Codex multi-agent implementation review r1 FAIL (0 Critical, 3 Required: `auth_error` prototype keys crashed `/login`; set-password form stayed pending on a request failure; check-email and set-password headers/CTAs below WCAG contrast and outside the Button contract). Fixed with regression tests (verified to fail on the old code), plus the two advisory test gaps (fail-closed settings/claims branches, avatar kept on resubmit). Unit 778/778, tsc, eslint, build passed. Next: Codex r2.
- 2026-10-03: Codex implementation review r2 PASS on `89cba5b..60c4e53` (0 Critical, 0 Required, 0 Advisory). Next: Owner review/QA, then push/PR on request.
