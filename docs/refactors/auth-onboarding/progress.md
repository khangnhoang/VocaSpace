# Progress — Auth onboarding program

Plan: [plan.md](./plan.md). Problems and follow-ups: [problems.md](./problems.md). The repository and Git history are the final evidence when documents disagree.

Statuses: Not started, Planning, In progress, Automated checks passed, Manual QA pending, Merged, Rollout pending, Completed, Blocked.

## Overview

| PR | Status | Detail plan | Notes | Updated |
| --- | --- | --- | --- | --- |
| A1 — Email verification + hook | Not started | None yet (cut from [source r8](./sources/d7-combined-plan-r8.md)) | Branch `feat/auth-a1-email-verification`; sign-ups re-enabled only after A2 (Decision 9) | 2026-10-03 |
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
