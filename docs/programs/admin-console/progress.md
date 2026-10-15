# Progress — Admin console

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Future features: [future-features.md](./future-features.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [AD4 plan](./implementation-plans/ad4/plan.md) r2, Owner-approved 2026-10-15 |
| Current unit / checkpoint | AD4 CP4 done; independent implementation review next |
| Status | AD4 CP1 to CP4 done as local commits (summary RPC, action and Zod contract, rebuilt `/admin`, verification); automated checks passed, browser QA done on the isolated runtime except the items under Accepted deviations; Owner review of the running screen, CI, hosted rollout and merge are not started with the Sonnet implementor session. AD7 merged (PR 158); ADMIN-004 stays open for the Owner's production acceptance. |
| Completed evidence | AD4 plan review: round 1 FAIL (paid-row `updated_at` moves when a learner is deleted; Owner chose `created_at`), round 2 PASS with three nits applied. Discovery on the isolated runtime rebuilt from `44335ad`: AD2, AD3, AD7 integration 3 files / 110 tests passed. `npm run docs:check`: 0 structure violations, 1 baseline broken link, 0 new. AD4 CP1 on the isolated runtime rebuilt with the new migration: `ad4-admin-dashboard-summary` 16 tests passed; with the A5 admin-reads, AD2, AD3 and AD7 suites 5 files / 138 tests passed; mutation checks (UTC buckets, no currency filter, `updated_at` buckets) each made the new suite fail. AD4 CP2: action unit test 17 passed; A5 admin-reads and `profile-private-columns` integration 2 files / 19 tests passed on the isolated runtime. AD4 CP3: component test 31 passed, formatter unit test 8 passed, `npx tsc --noEmit` and eslint on `app/admin` clean. AD4 CP4: `npm run test:ci` 114 files / 1661 tests passed; integration (A5 admin-reads, `profile-private-columns`, AD2, AD3, AD7, `ad4-admin-dashboard-summary`) 6 files / 145 tests passed; `npx tsc --noEmit`, `npm run lint` and `npm run docs:check` (0 violations, 1 baseline link, 0 new) clean; `npm run build` passed with the CI placeholder PayOS and cron variables; browser QA on the isolated runtime with a narrow fixture (removed afterwards): 38 of 38 checks passed at 1440, 375 and 320 px (pending and no-pending panel, six revenue months matching the fixture with a Vietnam month-edge order, constant card height in all three views, tab and trend keyboard, tooltip equal to the live region, removed learner without email, reduced motion without animation and with all values present, no sideways scroll, 44 px view-switch targets, error state with Thử lại after a temporarily revoked EXECUTE, restored). |
| Accepted deviations | AD4 CP2 commit (`db71470`) left `npx tsc --noEmit` red only in `app/admin/page.tsx`, which still read the old DTO; the CP3 commit rebuilt it and `tsc` is clean again. The AD4 plan's one link to the removed `stats-cards.tsx` became plain code text so `docs:check` reports no new broken link (the file no longer exists). Browser QA used the Playwright library with the preinstalled Chromium 1194 (`executablePath`), because no `playwright-cli` binary exists in this container; `e2e/smoke/admin-gate.smoke.spec.ts` was not run (it resets the isolated database; the h1 text it checks is unchanged), and `/_next/image` returned one HTTP 500 for an external shell image the container cannot fetch. Cloud session without Codex CLI or the user-level `sonnet-high-implementor` agent: at the Owner's direction (2026-10-15) the plan review ran as a Claude subagent, and implementation runs as one `general-purpose` subagent on Sonnet at high effort. |
| Blockers / Owner decisions | None open. |
| Next action | Main runs the independent implementation review; then the Owner reviews the running `/admin`, and CI, the hosted rollout runbook and merge each need their own grant. |
| Current authority | Owner, 2026-10-15: implement AD4 r2 with local commits on `feat/admin-dashboard-real-data`. No push, PR, merge, hosted or root migration. Main does not edit product code or tests while the implementor owns the plan. |

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
- 2026-10-15 AD7 merged after the hosted migration and its read-only verification; Owner production acceptance pending under ADMIN-004 (PR 158, `fea4f47`).
- 2026-10-15 AD4 detail plan r2 approved by the Owner after independent plan review PASS (round 2) (`7000bf4`).
- 2026-10-15 AD4 CP1: read-only `admin_dashboard_summary()` RPC (SECURITY INVOKER, EXECUTE for authenticated only, Vietnam-month revenue buckets on `created_at`) and its integration suite (this commit).
