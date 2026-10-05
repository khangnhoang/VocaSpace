# Future features — Auth onboarding program

Owner direction outside the current scope of the program. Problems and risks live in [problems.md](./problems.md); the program plan is [plan.md](./plan.md).

## FEAT-001: "Password changed" notification email

- Status: Deferred (A2b default 4, Owner-approved 2026-10-05).
- Outcome: after any password change (`/profile`, set-password or the direct Auth API) the account email receives a notice, so a user whose session was misused learns about it.
- Why deferred: A2b closes AUTH-007 with the hosted password-change protections and accepted residuals; a notice is extra hardening, not needed for that exit.
- Pointers: [A2b plan](./implementation-plans/a2b/plan.md) §1.4 default 4; AUTH-007 (resolved 2026-10-05) in [progress.md](./progress.md).

## FEAT-002: Global discount codes

- Status: Deferred (Owner direction, 2026-10-05, while deciding the A4b removed-course clause).
- Outcome: a discount code is not tied to one course (`discounts.course_id` is `NOT NULL` today), so support can give a learner one code usable on any course, for example after a bought course is removed.
- Why deferred: the A4b terms only promise support "such as a discount code for another course", which per-course codes can already do; the redesign is a product change outside this program.
- Pointers: [A4b plan](./implementation-plans/a4b/plan.md) §1.4 decision 8 and §2.

## FEAT-003: Removing a course that learners have bought

- Status: Deferred (product question raised 2026-10-05 while writing the A4b terms).
- Outcome: decide whether a teacher may remove a course that has paying learners, and if so whether those learners keep access. Today `deleteCourse` sets `removed_at` and `can_view_course_basic` then hides the course from learners (A4b terms option A describes this behavior).
- Why deferred: the Owner chose to describe current behavior in the terms (option A) instead of changing code in A4b.
- Pointers: [A4b plan](./implementation-plans/a4b/plan.md) §1.4 decision 8 and §2.
