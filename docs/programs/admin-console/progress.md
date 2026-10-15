# Progress — Admin console

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Future features: [future-features.md](./future-features.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [AD4 plan](./implementation-plans/ad4/plan.md) r2, Owner-approved 2026-10-15 |
| Current unit / checkpoint | AD4 local implementation review and browser QA complete within the observed scope; Owner UI acceptance recorded; PR delivery |
| Status | No implementation review blocker found on `1b1a9bc`; Owner accepted the running dashboard UI on 2026-10-16. Local functional, responsive and reduced-motion QA passed; real screen-reader output remains unverified. PR CI, hosted rollout and merge remain pending. AD7 is merged (PR 158); ADMIN-004 remains open for Owner production acceptance. |
| Completed evidence | 2026-10-16: focused action/component/formatter tests 3 files / 61 tests passed, focused lint and diff checks passed; AD4 migration applied to E2E without reset, then AD4/A5/AD2/AD3/profile-private-columns integration 5 files / 131 tests and AD7 1 file / 14 tests passed (145 total). `npx tsc --noEmit --incremental false` passed after `f9359ff`. Playwright CLI QA on app 3100 / API 45441 verified guest/student/teacher/active-admin/removed-admin access, real metrics and six months, pending and empty queue, removed-learner identity, three chart views, keyboard/tooltip/live-region DOM, 1440/768/375/320 px, reduced motion, read failure and retry. Fixtures were removed, the summary returned to baseline and the temporary RPC grant change was restored. Screenshots and scratch scripts are local ignored artifacts under `test-results/ad4-current/` and `.playwright-cli/`; they are not remote evidence. Historical full-unit/build evidence remains in `f74c6dc`. |
| Accepted deviations | The standalone `e2e/smoke/admin-gate.smoke.spec.ts` was not rerun; equivalent dashboard access cases, including a removed admin with a pre-existing session, were exercised through Playwright CLI without resetting either database. The polite live region and exact tooltip text were verified in the DOM, but no real screen reader was run; do not claim audible announcement QA. Generated `test-results/` is now excluded from TypeScript rather than committing a temporary QA probe (`f9359ff`). |
| Blockers / Owner decisions | No product/code blocker identified. Before merge: finish required PR checks, resolve the remaining screen-reader evidence gap, and obtain the separate hosted rollout and merge grants. Hosted AD4 state is not verified; local application is not hosted rollout evidence. |
| Next action | Complete CI for the AD4 branch/PR and the remaining screen-reader acceptance evidence, then request the Owner's hosted rollout grant under AD4 plan section 5; the PR remains draft until its outstanding gates are resolved. |
| Current authority | Owner, 2026-10-16: complete local integration/browser QA, apply pending E2E migrations, commit the small TypeScript correction separately, record the accepted UI and QA handoff, commit/push these updates and open a PR. Root AD7/AD4 migration was separately authorized earlier and completed. No hosted mutation, merge, deployment or branch deletion is authorized. |
| Hosted state | AD4 migration `20261015120000` exists on root (API 45321) and E2E (API 45441). Hosted preflight/application/postflight have not run in this session. Follow the accepted push-before-merge runbook. |

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
- 2026-10-15 AD4 CP1: read-only `admin_dashboard_summary()` RPC (SECURITY INVOKER, EXECUTE for authenticated only, Vietnam-month revenue buckets on `created_at`) and its integration suite (`3b2d15e`).
- 2026-10-15 AD4 CP2: `getAdminDashboardData` returns the new contract (RPC summary plus five recent enrollments, nullable learner email, no price or fabricated values) with the rewritten action test and the A5 integration updated (`db71470`).
- 2026-10-15 AD4 CP3: `/admin` rebuilt to Admin design section 14 (needs-attention panel, one metric band, revenue card with Cột / Xu hướng / Bảng switch, share bars, recent enrollments, safe error state with Thử lại), old mock-fed components removed, component tests added (`f561a84`).
- 2026-10-15 AD4 CP4: narrow-width polish (view-switch labels on one line at 320 px, recent-enrollment rows stack the time under the course), full verification and browser QA on the isolated runtime (`f74c6dc`).
- 2026-10-15 AD4 correction round 1: dashboard bars and the trend line reveal once when their chart first enters view (IntersectionObserver, no animation without it or under reduced motion), Cột and Bảng panels focusable, milestone hashes and State evidence tidied (`1b1a9bc`).
- 2026-10-16 Excluded ignored generated QA output from TypeScript; the standard type check passes without modifying or committing temporary probe files (`f9359ff`).
- 2026-10-16 Recorded the AD4 implementation review, 145-test isolated integration rerun, functional/responsive/reduced-motion browser QA with cleanup, local migration state and Owner UI acceptance; hosted rollout, real screen-reader evidence and merge remain pending (this commit).
