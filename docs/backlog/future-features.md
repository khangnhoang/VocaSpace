# Future features — backlog

Owner direction that no open program owns. This is not a program: it has no plan and no progress. Work that is in scope belongs in the owning program's plan.

## BFEAT-001: Dependency update policy

Moved to [BFEAT-001](../programs/infrastructure/future-features.md#bfeat-001).

<a id="feat-014"></a>

## FEAT-014: Global discount codes

- Status: Deferred (Owner direction, 2026-10-05, while deciding the A4b removed-course clause).
- Direction: a discount code is not tied to one course (`discounts.course_id` is `NOT NULL` today), so support can give a learner one code usable on any course, for example after a bought course is removed.
- Why deferred: the A4b terms only promise support "such as a discount code for another course", which per-course codes can already do; the redesign is a product change outside this program.
- Pointers: [A4b plan](../programs/auth-onboarding/implementation-plans/a4b/plan.md) §1.4 decision 8 and §2.
- Target program: none yet.
- Legacy identity: auth-onboarding:FEAT-002.

<a id="feat-015"></a>

## FEAT-015: Removing a course that learners have bought

- Status: Deferred (product question raised 2026-10-05 while writing the A4b terms).
- Direction: decide whether a teacher may remove a course that has paying learners, and if so whether those learners keep access. Today `deleteCourse` sets `removed_at` and `can_view_course_basic` then hides the course from learners (A4b terms option A describes this behavior).
- Why deferred: the Owner chose to describe current behavior in the terms (option A) instead of changing code in A4b.
- Pointers: [A4b plan](../programs/auth-onboarding/implementation-plans/a4b/plan.md) §1.4 decision 8 and §2.
- Target program: none yet.
- Legacy identity: auth-onboarding:FEAT-003.

<a id="feat-022"></a>

## FEAT-022: Learning streak direction

- Status: Deferred; direction only, requiring its own acceptance and implementation authority.
- Direction: Learning streak direction; the complete Owner direction and limits follow below.
- Target program: none yet.

Learning Experience may later use a compact learning-streak metric as supporting context when the runtime owns truthful learning-history data. Current UI-2 work must omit streak rather than derive it from topic completion, flashcard review dates, or other proxy signals.

Future streak work owns the history model, day and timezone boundary, qualifying activity, repair/freeze behavior if any, privacy and reset semantics, and the surface-specific presentation. This direction is not permission to add persistence, analytics, gamification, or a placeholder streak to the current LE candidate.
