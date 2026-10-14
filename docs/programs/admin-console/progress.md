# Progress — Admin console

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Future features: [future-features.md](./future-features.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [plan.md](./plan.md) r2 (master plan, Owner-approved 2026-10-13); AD7 [detail plan](./implementation-plans/ad7/plan.md) r1, conditional Owner acceptance after independent review PASS (2026-10-15). |
| Current unit / checkpoint | AD7 planning on `fix/admin-user-hardening`. |
| Status | AD7 plan drafted; implementation not started. AD3 merged in PR 157 (`0b50278`); fresh deployment or production QA was not performed during this reconciliation. |
| Completed evidence | Source/migration discovery on `0b50278`, including Luna-requested DB and application exploration; `main`, `origin/main` and the new AD7 branch matched after fetch and fast-forward pull on 2026-10-15. Planning checks: `npm run docs:check` has 0 structure violations and 1 baseline broken link (0 new); `git diff --check` clean. A local Zod probe confirmed UUID letter case is preserved, informing the self-role guard. Historical AD3 implementation/QA evidence is retained in its milestone commits below; no AD7 product or database tests have run. |
| Accepted deviations | None for AD7. |
| Blockers / Owner decisions | Independent plan review PASS pending. Owner chose on 2026-10-15 to lock only Role for self-edit and retain name, username and phone edits (AD7 §1.4). |
| Next action | Independent gpt-6.1-sol/high plan review, correct/review until PASS, then commit the accepted plan and implement. |
| Current authority | Owner, 2026-10-15: plan review/correction until PASS without the default two-round cap, then plan commit and implementation; local commits authorized throughout the task. No push, PR, merge, root or hosted write grant. |

## Milestones

- 2026-10-13 Program created and master plan r2 approved by the Owner after Codex plan review PASS; progress and problems from read-only discovery (`46951eb`).
- 2026-10-13 AD1 detail plan r3 approved by the Owner after Codex plan review PASS (round 2) (`f6ea583`).
- 2026-10-13 AD1 CP2: admin page gate (`lib/auth/admin-access.ts`), signed-out `/admin` redirect, user-management page split into a server page and a client component (`a22de1b`).
- 2026-10-13 AD1 CP3: two-link sidebar with exact `/admin` active state, `/admin/courses` removed, admin gate smoke spec and production status check, ADMIN-001 resolved (`e0f8dcf`).
- 2026-10-13 AD1 correction round 1: isolated-target guards and unit test for the admin gate scripts, guaranteed fixture cleanup, revocation case for both pages with a mutation check, whitespace fix (`10f3a6a`).
- 2026-10-13 AD1 correction round 2: fixture cleanup ignores only the GoTrue `user_not_found` code (confirmed on the isolated runtime: 404, `user_not_found`, "User not found"), with regression tests (`24cee31`).
- 2026-10-13 AD1 merged with CI green, no hosted step (PR 152, `1ff5588`).
- 2026-10-14 AD2 detail plan r3 approved by the Owner after Codex plan review PASS (round 3) (`c257a9b`).
- 2026-10-14 AD2 CP2: course listing approval migration (four RPCs, column lock-down of `courses`), seed pending row to draft, integration suite on the isolated runtime (`b244be6`).
- 2026-10-14 AD2 CP3: `submitCourseReview`/`withdrawCourseReview` and admin `approveCourseReview`/`rejectCourseReview` Server Actions, review fields and `publishedTopicCount` in the course readiness data, "Gửi duyệt" / "Rút yêu cầu duyệt" controls and rejection reason on both overview branches (`f1763ea`).
- 2026-10-14 AD2 CP4: ADMIN-002 resolved in the repository, final verification run (`a0e22d8`).
- 2026-10-14 AD2 correction round 1: `reject_course_review` counts the reason in UTF-16 units like `rejectCourseSchema` (astral boundaries tested in SQL, schema and action), review controls use the default `Button` styling with a busy label (`b94eab9`).
- 2026-10-14 AD2 Codex implementation review: round 1 FAIL on `a0e22d8`, round 2 PASS on `b94eab9`; progress records the review and the TypeScript result (`c6cae6a`).
- 2026-10-14 AD2 merged with CI green after the hosted migration push and read-only verification (PR 155, `8c537b6`); root runtime migrated (`1556ef6`).
- 2026-10-14 AD3 detail plan r4 approved by the Owner after Codex plan review PASS (round 4) (`2c474ac`).
- 2026-10-14 AD3 CP2 server side: admin course list/summary read module, `moderateCourse` and `getAdminCourseSummary` actions, active-admin helper, escaped search (`17b90f4`).
- 2026-10-14 AD3 CP3 course screen: `/admin/courses` page, client components, sidebar item, mock components removed (`95cf9ca`).
- 2026-10-14 AD3 CP4 e2e: admin course review spec, AD1 gate specs and production status check cover `/admin/courses` (`ff69562`).
- 2026-10-14 AD3 CP5 `/privacy` sentence on admin course review access and closeout (`8ab9d75`).
- 2026-10-14 AD3 correction round 1: literal `*` search via `imatch`, focus returns to the opener on close (AC9), State refreshed (`e2ee3db`).
- 2026-10-14 AD3 correction round 2: focus goes into the open summary panel when the opener disappears; Vietnamese case folding covered on both search paths (`dd99f7d`).
- 2026-10-14 Owner approved the `/privacy` wording ("họ sẽ xem được tên tác giả"); legal last-updated date set to 14/10/2026 (`2425d17`).
- 2026-10-14 Owner QA fix: the shared toaster uses the dark theme on `/admin` and `/admin/*` routes, light elsewhere (`430d475`).
- 2026-10-14 Owner QA fix: the admin sidebar logo links to the home page (`4e274ce`).
- 2026-10-14 Owner QA change: course search runs as the admin types (300 ms debounce, `router.replace`, Enter applies at once) (`c1b04f6`).
- 2026-10-14 Owner QA change: the course list pagination has a "Đến trang" input to jump to a page (`51476d2`).
- 2026-10-14 Owner QA fix: the course list pagination is one compact control, previous/next arrows around an editable current-page input with the total (`db6d3b7`).
- 2026-10-14 AD3 merged; the 2026-10-15 planning reconciliation confirmed the merge ancestry, without a fresh deployment or production-QA claim (PR 157, `0b50278`).
