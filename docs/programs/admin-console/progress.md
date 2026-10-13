# Progress — Admin console

Plan: [plan.md](./plan.md). Problems: [problems.md](./problems.md). Git history is the final evidence when documents disagree.

## State

| Field | Value |
| --- | --- |
| Spec revision | [plan.md](./plan.md) r2 (master plan, Owner-approved 2026-10-13); AD2 [detail plan](./implementation-plans/ad2/plan.md) r3, Codex plan review PASS (round 3, two minor fixes applied); Owner approval 2026-10-14 |
| Current unit / checkpoint | AD2 CP4 done; correction round 1 done; awaiting Codex re-review |
| Status | AD2 in progress on `feat/course-listing-approval`: CP2 (migration, seed, integration suite), CP3 (Server Actions, teacher review controls) and CP4 (docs, final verification) committed locally; correction round 1 of the Codex implementation review is committed; the unit waits for the re-review. Nothing is pushed; the migration is not applied to the root runtime or hosted. |
| Completed evidence | AD2 read-only discovery on 2026-10-14 against `d11c1b3` (detail plan §2), including one Owner-allowed read-only inventory of hosted course states: 3 draft, 4 published (1 removed), no pending. CP2 on the isolated runtime (API 45441) only: G2 inventory found two client writers of `courses` (`updateCourse`, `deleteCourse`), both inside the AC6 columns; upgrade rehearsal (reset to `20261013090000`, insert 3 courses as `postgres`, apply the AD2 migration): the pending course with `submitted_at` null changed only `status` (to `draft`) and `updated_at`, the pending course with `submitted_at` set and the published course with review fields set were entirely unchanged; full isolated reset with the new seed passed; `ad2-course-listing-approval.test.ts` 62/62, `course-creation-rls.test.ts` 9/9 and `topic-review-lifecycle.test.ts` 35/35 passed. CP3 unit and component tests: 8 files, 157 tests passed (new `course-review`, `admin-course-review` action suites and `course-listing-review-controls` component suite through `CourseOverview` on both branches; readiness, schema and route suites updated); `npx tsc --noEmit` and eslint on the changed files clean. CP4 final run: `npm run test:ci` 1459 tests passed in 106 files (the two failing files are gitignored local probe specs under `test-results/` that import missing modules; they are not tracked and fail the same way without the AD2 change); `npx tsc --noEmit` reports only those same probe files; `npm run lint`, `npm run build` and `git diff --check` clean; `npm run docs:check` 0 structure violations and 0 new broken links (1 in baseline); the AD2 integration file, `course-creation-rls` and `topic-review-lifecycle` again on the isolated runtime: 106/106. ADMIN-002 moved to Resolved. Correction round 1 on the isolated runtime (reset with the edited migration): the AD2 integration file 66/66; unit, schema, action and component suites touched or added 5 files, 115 tests passed; `npx tsc --noEmit`, eslint on the changed files, `npm run docs:check` (0 new broken links) and `git diff --check` clean. |
| Accepted deviations | None. |
| Blockers / Owner decisions | None open. AD2 decisions of 2026-10-14 are in the detail plan §1.4. |
| Next action | Codex re-review of `feat/course-listing-approval`; then, with separate Owner grants, push and PR, applying the migration to the root runtime (`supabase migration up --local`) and hosted (`supabase db push`). Approve and reject have no screen until AD3. |
| Current authority | Owner grant 2026-10-14: commit the AD2 plan and implement CP2–CP4 with local commits on `feat/course-listing-approval`. No push, PR, merge, hosted or root database authority. |

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
- 2026-10-14 AD2 correction round 1: `reject_course_review` counts the reason in UTF-16 units like `rejectCourseSchema` (astral boundaries tested in SQL, schema and action), review controls use the default `Button` styling with a busy label (this commit).
