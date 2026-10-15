# Progress — Admin console

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Future features: [future-features.md](./future-features.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [plan.md](./plan.md) r2 (master plan, Owner-approved 2026-10-13); AD7 [detail plan](./implementation-plans/ad7/plan.md) r1, accepted under the Owner's review-PASS condition (2026-10-15). |
| Current unit / checkpoint | AD7 CP1–CP3 and hosted SQL verification complete; Git delivery tracked in [PR 158](https://github.com/khangnhoang/VocaSpace/pull/158). |
| Status | AD7 implementation committed at `648c6a8` after independent implementation review PASS (candidate r2, correction round 1, same Reviewer). Accepted plan commit: `fe66cdc`. Hosted migration `20261015090000` applied and verified on 2026-10-15 before merge; PR 158 owns current merge/deployment state. Root migration has not run. |
| Completed evidence | Isolated rebuild includes `20261015090000`; focused unit/schema/form checks: 6 files / 66 tests passed; SQL/Storage/action and affected A5/AD2/AD3/D1 integration: 6 files / 179 tests passed on API 45441. Browser AD7: 5 passed (1280/375/320px self-edit, other-account role change, removed-admin failure with preserved input and fresh-page 404); existing admin gate: 9 passed. Screenshots inspected with no horizontal overflow. Scoped TypeScript excluding ignored `test-results` passes; full TypeScript remains blocked by two pre-existing broken imports in `test-results/l1-native-zoom-current/probe.spec.ts` (2026-10-09). Planning docs checks: 0 structure violations, 1 baseline broken link, 0 new; diff whitespace clean. |
| Accepted deviations | No product deviation. CI auto-discovery would run AD7 against the root API 45321 and fail its isolated-target guard; AD7 is now excluded from that job and included in the existing isolated API 45441 job, preserving the guard and test coverage. After the isolated reset, Kong returned Auth 502 until the isolated gateway was restarted; browser checks then reused the reset runtime. Fresh server requests are denied after removal; a route prefetched while authorized may remain cached, outside the plan's immediate-cancellation claim. |
| Blockers / Owner decisions | No unresolved AD7 implementation or review finding. Full local TypeScript has the pre-existing ignored-probe failures noted above. Hosted role/media write-based runtime probes and Owner production acceptance remain unverified; root migration is outside the rollout grant. |
| Next action | Owner production acceptance after Git deployment. Keep ADMIN-004 open for the unverified hosted runtime/acceptance boundary; any hosted role/media write-based QA requires its separate approval and rehearsal. Actual Vitest discovery confirms AD7 excluded from root and included on isolated. |
| Current authority | Owner, 2026-10-15: local implementation/commits and correction until PASS; later approved push/PR, CI watching, hosted migration and verification before merge, then merge/deployment verification. Read-only Edge QA on vocaspace.com authorized; no account-data mutation or root migration grant. |

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
- 2026-10-15 AD7 plan r1 passed independent review and was committed under the Owner's conditional acceptance and implementation/local-commit grant (`fe66cdc`).
- 2026-10-15 AD7 CP1–CP3 implemented and reviewed: round 0 required the isolated CI-routing correction; same-Reviewer round 1 passed with no remaining findings. Active-admin SQL/Storage boundaries, canonical-UUID self-role guard, self-edit UI and tests committed locally; root/hosted rollout and remote delivery remain separate (`648c6a8`).
- 2026-10-15 AD7 CI run `38694847592` passed all jobs, including full unit/build, both integration jobs, Vercel Preview and production-gate, on `f1805b6`. Hosted preflight matched all four function bodies to the source baseline; dry-run listed only AD7. Migration `20261015090000` then applied once; read-only postflight matched all four new bodies exactly, preserved signatures/owners/grants/config and unchanged dependent policies, retained thumbnail owner access, and returned false from is_admin with no actor. Security advisors retain the existing callable-definer grants; no grant widening occurred (PR 158).
