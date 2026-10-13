# Master plan — Admin console

Progress: [progress.md](./progress.md). Problems: [problems.md](./problems.md). Each unit has a detail plan at `implementation-plans/<unit>/plan.md`, written and approved before that unit starts.

Revision: r2, 2026-10-13.

## 1. Goal and outcome

- Goal: turn `/admin` from a partly mocked shell into a protected operations console, starting with a real gate on which courses reach the public catalog.
- Outcome 1: only an active admin can open an `/admin` page; the sidebar links only to pages that exist.
- Outcome 2: a course reaches the public catalog only after an admin approves it; course status and review fields can no longer be changed by a direct table update.
- Outcome 3: `/admin/courses` lists real courses and lets an admin approve submitted courses, reject them with a reason, and demote or take down published ones with a reason.
- Outcome 4: the admin dashboard shows only numbers computed from real data.
- Outcome 5: an admin can see payments and orders.
- Outcome 6: an admin can create, edit and deactivate discount codes.
- Outcome 7: admin user management cannot lock out or escalate itself by mistake, and a removed admin has no admin power.
- Size and risk: large as a program (permissions, a new status workflow, payments data); each unit is kept small and gets its own detail plan, review and Owner approval.

## 2. Owner decisions

1. (2026-10-13) Admin work is its own program, `docs/programs/admin-console/`.
2. (2026-10-13) D1 stays: topic content review and publication stay with the course owner tier and reviewers (`student-user-flow-route` plan, W2, W4, W9 and the D1 gate); the global `admin` role alone grants no topic review or publication; an admin who is also a course collaborator keeps exactly that collaborator's D1 authority.
3. (2026-10-13) Publishing must not be open to anyone: a course enters the public catalog only through admin approval. The course owner or co-owner submits (`draft` to `pending`); an admin approves (`pending` to `published`) or rejects with a required reason (`pending` to `draft`). This is a course-level listing gate added beside D1, not topic review; it amends the D1 gate line "a global admin alone does not … publish" for course listing only.
4. (2026-10-13) Only `owner` and `co_owner` may submit a course or withdraw a pending submission; `editor` may not.
5. (2026-10-13) A course may be submitted only when it is `draft`, not removed, and has at least one active `published` topic.
6. (2026-10-13) After approval, edits to course title, description, price or cover take effect at once and do not send the course back to review; the admin moderates afterwards (demote or take down through `moderate_platform_content`).
7. (2026-10-13) The admin course screen includes course-level demote and takedown (existing `moderate_platform_content`, reason required, audited).
8. (2026-10-13) Later units on the roadmap: real dashboard numbers, payments and discount codes, and user-management hardening. A system settings page is not on the roadmap.

## 3. Shared invariants

- Every admin page and admin Server Action checks on the server that the caller is an active admin (`profiles.role = 'admin'` and `removed_at is null`); hiding a link is never the check — prevents a non-admin reading admin data or reaching admin actions.
- After AD2, course `status`, `submitted_at`, `reviewed_at`, `reviewed_by` and `reject_message` change only through security-definer RPCs (the AD2 lifecycle RPCs and the existing `moderate_platform_content`) or trusted service-role paths, never through a client table update — prevents self-publishing and forged review records.
- A write that locks a course's structure rows takes the course advisory lock first (`student-user-flow-route` Decision 31) — prevents new deadlocks with structure edits.
- Topic review, topic publication and course membership rules from D1 are not changed by this program — prevents two owners of the review model.
- No screen shows mock or invented numbers as real; an unfinished control is hidden or visibly disabled — prevents admins acting on false data (ADR `docs/adr/admin-course-review-ui.md`).
- Admin moderation and course rejection always store a reason and, where the existing RPC audits, an audit row — prevents unexplained removals.
- A unit that adds a new read of user or payment data checks `/privacy` and `/terms` in the same PR — prevents the policy drifting from what the app reads.

## 4. Units

| Unit | Branch | Outcome | Dependencies | Gate to start or enable |
| --- | --- | --- | --- | --- |
| AD1 | `fix/admin-route-gate` | Outcome 1 | none | Master plan and AD1 detail plan approved |
| AD2 | `feat/course-listing-approval` | Outcome 2 (submission RPCs, column lock-down, teacher submit and withdraw UI, admin approve and reject actions) | none (soft: after AD1) | AD2 detail plan approved; hosted migration after CI is green and before merge |
| AD3 | `feat/admin-course-screen` | Outcome 3 | hard on AD2 merged and its migration on hosted | AD3 detail plan approved |
| AD4 | `feat/admin-dashboard-real-data` | Outcome 4 | hard on AD1 | AD4 detail plan approved, including metric definitions |
| AD5 | `feat/admin-payments-view` | Outcome 5 (read-only payments and orders) | hard on AD1 | AD5 detail plan approved; `/privacy` reviewed |
| AD6 | `feat/admin-discount-codes` | Outcome 6 (discount code writes) | hard on AD1 | AD6 detail plan approved, including what a code change does to open checkouts |
| AD7 | `fix/admin-user-hardening` | Outcome 7 | hard on AD1 | AD7 detail plan approved; any account-lock design is an Owner decision there |

## 5. Order and rollout gates

1. AD1, then AD2, then AD3, in that order. AD2 can start before AD1 merges because the two touch different files; AD3 needs AD2's RPCs on hosted.
2. AD2 migration rollout: CI green, then `supabase db push` to hosted, then read-only verification (migration listed, RPC grants, column privileges), then merge. The old app never writes course status, so the lock-down is safe to push before the new app is deployed.
3. AD4 to AD7 follow in any order the Owner picks; each gets its own detail plan, and any migration follows the same push-before-merge rule.
4. Root (API 45321) receives a migration only when the Owner asks; integration and E2E runs use the isolated runtime (API 45441).

## 6. Program risks

| Risk | Mitigation |
| --- | --- |
| Revoking client updates on course status columns breaks an existing write path or test | AD2 inventories every writer of those columns first; `removed_at` and the editable metadata columns keep their grant; integration tests cover refusal and the RPC paths |
| Existing published courses (3 on hosted, many in the local seed) would be hidden by a new rule | Existing `published` courses stay published; the workflow only governs future transitions (confirm in the AD2 detail plan) |
| Existing `pending` courses predate the workflow (root has `b2-qa-hidden-pending`: no `submitted_at`, no active published topic) and would look like valid submissions | Gate for AD2: inventory legacy `pending` courses on root, isolated and hosted, and decide in the AD2 detail plan how they are handled before approval is enabled; never treat them as submissions that met decision 5 |
| A course sits in `pending` with no admin screen if AD2 merges long before AD3 | Ship AD3 right after AD2; AD2 has the approve and reject actions but no admin screen, so between the two merges submitted courses wait in `pending` |
| `/admin` gate in a layout alone misses Server Actions or route handlers | Invariant 1: every admin action keeps its own server check; AD1 adds tests for both the page gate and the actions |
| Admin read of all courses depends on the admin branch of `can_view_course_basic`, which does not check `removed_at` of the admin profile | AD7 aligns admin checks with `removed_at`; AD3 detail plan decides whether its reads go through that branch or a dedicated RPC |
| Payment and discount screens expose personal data | AD5 and AD6 read through server-checked actions only and reviews `/privacy` |

## 7. Out of scope

- Admin review or publication of topics, and any change to the D1 topic review model.
- Admin create-on-behalf of courses, ownership transfer, and email or push notifications for course review results.
- A system settings page (`/admin/settings`) and a separate statistics page (`/admin/stats`); their sidebar links are removed in AD1.
- User or content report queues (no tables exist).
- Refunds and changes to the PayOS payment flow.
